/* ladder.js — the ladder script driver, faithful to test/play_main.c.
 *
 * the UI design, section 15. This is the browser/wasm side of the commercial test
 * ladder. Its whole value is that it decides by the SAME RULE as the native
 * harness, so that a disagreement between the two means a disagreement between
 * two compilations of src/gb.c rather than between two opinions about what
 * "plays" means.
 *
 * Written as a generator that yields after every emulated frame. That is not a
 * style choice: it lets the logic below sit in the same order as play_main.c's
 * loop, so the resemblance can be checked by eye — while run(budget) still
 * pumps it a few frames at a time, so a page driving it stays responsive.
 *
 * DOM-free, so test/ui_net.py drives it headlessly.
 *
 * FIRMWARE: takes cartridge bytes the caller already holds. Never fetches,
 * bundles or names a cartridge, and never writes a frame anywhere.
 */

import { fnv1a, parseScript } from "./shell.js";
import { BTN, FRAME_HZ } from "./core.js";

const NLC = String.fromCharCode(10);

/* play_main.c: #define STATIC_CLASSIFY_FRAMES 600 */
export const STATIC_CLASSIFY_FRAMES = 600;
/* play_main.c: #define SETTLE_CAP 1200 */
export const SETTLE_CAP = 1200;
/* play_main.c: #define SEEN_CAP 4096 */
export const SEEN_CAP = 4096;

/* play_main.c "What a probe showed", mirrored exactly.
 *
 * `changed > 0` used to be the whole motion test on both sides, and it cannot
 * tell a game being played from a blinking cursor on a menu: two pictures
 * alternating on a 16-frame period give changed=113 over 1800 frames and scored
 * as motion. Six of the eight rungs were printing PASS over schedules that never
 * left a menu.
 *
 * The discriminator is NOVELTY: of the `changed` transitions, how many landed on
 * a picture never shown before -- (distinct-1)/changed. Measured over the eight
 * rungs (26 probes, 2026-08-29) the values fall in two groups with an empty
 * interval between them, 0.009..0.181 and 0.365..1.000. The cut is 1/4, CHOSEN
 * and not tuned: anywhere in 0.19..0.36 gives the same census.
 *
 * The comparison is written in INTEGERS on both sides -- (distinct-1)*4 <=
 * changed -- so the two builds cannot disagree by a rounding step. That is not
 * hypothetical care: this file's whole value is that it decides by the same
 * rule, and a float compare is a way for it to stop doing so silently. */
export const NOVELTY_NUM = 1;
export const NOVELTY_DEN = 4;

export const PR_MOVING = 0, PR_CYCLING = 1, PR_TWOPIC = 2,
             PR_WAITING = 3, PR_HUNG = 4, PR_UNSCORED = 5, PR_NSTATES = 6;
/* Every state this tally can produce, named. Same order as play_main.c's
 * PR_NAME so the two censuses can be compared position by position. */
export const PR_NAME = ["moving", "cycling", "two-picture", "static-waiting",
                        "static-hung", "unscored"];

/** play_main.c's probe classifier. `seenFull` means the distinct count is a
 *  FLOOR rather than a count, and a class computed from a floor is not a
 *  measurement -- so it is UNSCORED, and unscored is not a pass. */
export function classifyProbe(changed, distinct, seenFull) {
  if (seenFull) return PR_UNSCORED;
  if (changed === 0) return PR_WAITING;          /* refined by the wake test */
  if (distinct <= 2) return PR_TWOPIC;           /* no cut needed: two is two */
  if ((distinct - 1) * NOVELTY_DEN <= changed * NOVELTY_NUM) return PR_CYCLING;
  return PR_MOVING;
}

/* play_main.c classify_static(): four buttons, for a stall inside a moving
 * probe. The longer list exists because a stall mid-play can be a menu, a
 * dialogue box, a pause, or a "press down to continue". */
const WAKE_LONG = [
  { bit: BTN.START, name: "Start" }, { bit: BTN.A, name: "A" },
  { bit: BTN.B, name: "B" }, { bit: BTN.DOWN, name: "Down" },
];
/* play_main.c's inline wake for a wholly static probe: Start then A only. */
const WAKE_SHORT = [
  { bit: BTN.START, name: "Start" }, { bit: BTN.A, name: "A" },
];

/**
 * Replace the script's LEADING idle count — the seed.
 *
 * our method notes rule 1: this exact variable, unexamined, was an earlier confound. The
 * canonical "wait 500" hung Pinball and "wait 501" played it, with no emulator
 * constant touched. Everything else in the script is left alone, so the only
 * thing varying is where in the title's own state the run begins. Mirrors
 * test/ladder.py's seeded_script().
 */
/**
 * Apply a seed: PREPEND a leading idle of `n` frames.
 *
 * This must match test/ladder.py's `seeded_script` exactly, because a
 * cross-build comparison seeded two different ways compares two different
 * experiments -- and our method notes rule 1 was bought with the proof that the seed
 * decides the verdict.
 *
 * WITHDRAWN, and the error is worth keeping. This used to REPLACE the script's
 * first `wait`, which matched the native side while the scripts opened with a
 * tuned `wait 500`. The scripts were then re-cut to open with `settle 30`, and
 * the native seeder changed to prepend -- at which point "the first wait" in
 * tetris.txt became `wait 120`, an interior delay BETWEEN TWO START PRESSES.
 * Seeding rewrote the navigation instead of the start offset, and swept
 * 120..123 believing it swept 500..503.
 *
 * Measured, not reasoned: seeding tetris.txt with 999 produced
 * `press start 5` / `wait 999` in the body while the head still read
 * `settle 30`. Nothing announced it, because both sides still ran and both
 * still printed a fraction.
 */
export function seedScript(text, n) {
  return "wait " + n + NLC + text;
}

/* The seed base is NOT read from the script any more: the scripts settle on the
 * game's own steady picture and carry no constant to vary. It lives in
 * test/ladder.py as SEED_BASE and is passed in, so the two ladders cannot drift
 * apart by one of them keeping a copy. */
export function seedWindow(base, count) {
  const lo = base - Math.floor(count / 2);
  return Array.from({ length: count }, (_, i) => lo + i);
}

export class LadderRun {
  constructor(steps, machine) {
    this.steps = steps;
    this.m = machine;
    this.frames = 0;
    this.probes = 0;
    this.probesMoving = 0;
    this.longStalls = 0;
    this.worstStatic = 0;
    this.snaps = 0;
    this.notes = [];
    /* Per-probe counts, in the same three quantities test/play_main.c prints:
     * changed, distinct, longest-static. The cross-build check compares these
     * integers rather than the verdict alone — a verdict is one bit and two
     * builds can agree on it while disagreeing about everything underneath. */
    this.probeStats = [];
    /* One counter per PR_* state, in that order. */
    this.census = new Array(PR_NSTATES).fill(0);
    /* `reach` navigation: how many were asked for, and how many never got
     * there. A reach that fails costs the run its verdict -- see status(). */
    this.reaches = 0;
    this.reachesFailed = 0;
    this.done = false;
    this._it = this._drive();
  }

  /** play_main.c's PRE-WIDENING exit predicate, kept and exposed as a RECEIPT:
   *  probes && probes_moving == probes && !long_stalls, where probes_moving
   *  meant "changed > 0, or static but answered a button". It no longer decides
   *  anything. It exists so a later change to either ladder can be shown not to
   *  have moved the core question by diffing this one boolean. */
  get coreOk() {
    const oldMoving = this.census[PR_MOVING] + this.census[PR_CYCLING] +
                      this.census[PR_TWOPIC] + this.census[PR_WAITING];
    return this.probes > 0 && oldMoving === this.probes && this.longStalls === 0;
  }

  /** The native exit code, restated. WIDENED 2026-08-29 in this file and
   *  test/play_main.c TOGETHER, approved as a coordinated change: that file
   *  reimplements this predicate and ui_net.py:compare_ladders diffs the two,
   *  so a one-sided widening would report a disagreement between two builds
   *  that agree about everything.
   *    0 PLAYS -- every probe kept producing pictures it had not shown before
   *    1 FAIL  -- a genuine hang or a stall nothing answered. A CORE FAULT
   *    3 NO-PLAY -- ran clean, never demonstrated play. A STIMULUS fault */
  get status() {
    if (this.longStalls || this.census[PR_HUNG]) return 1;
    /* A `reach` that never reached is a schedule that did not get the title
     * into play, and it costs the verdict even if every later probe moved --
     * the probes would be measuring whatever screen it stopped on. */
    if (this.reachesFailed) return 3;
    if (!this.probes || this.census[PR_MOVING] !== this.probes) return 3;
    return 0;
  }
  get verdictWord() {
    return this.status === 0 ? "PLAYS" : this.status === 1 ? "FAIL" : "NO-PLAY";
  }
  /** Kept a BOOLEAN and kept this name, because test/ui_net.py reads it and
   *  that file is not ours. It now means `status === 0`, exactly as the native
   *  side's `returncode === 0` does, so the cross-build comparison stays a
   *  comparison of the same quantity on both sides. */
  get verdict() { return this.status === 0; }
  get locked() { return this.m && this.m.alive ? this.m.locked : false; }
  get emulatedSeconds() { return this.frames / FRAME_HZ; }

  summary() {
    return {
      /* Existing keys, unchanged in name and type: test/ui_net.py reads
       * verdict, probesMoving, probes, longStalls, worstStatic, notes,
       * probeStats and seconds, and that file belongs to the UI role. */
      verdict: this.verdict, frames: this.frames,
      seconds: +this.emulatedSeconds.toFixed(1),
      probes: this.probes, probesMoving: this.probesMoving,
      longStalls: this.longStalls, worstStatic: this.worstStatic,
      locked: this.locked, snaps: this.snaps, notes: this.notes.slice(),
      probeStats: this.probeStats.slice(),
      /* Added: the widened channel and the census behind it, so a consumer can
       * tell NO-PLAY from FAIL without re-deriving it. `probesMoving` is now
       * the STRICT count and no longer includes a static probe that merely
       * answered a button. */
      status: this.status, verdictWord: this.verdictWord,
      coreOk: this.coreOk, census: this.census.slice(),
      reaches: this.reaches, reachesFailed: this.reachesFailed,
    };
  }

  /** Advance by at most `budget` emulated frames. @returns frames advanced. */
  run(budget) {
    let did = 0;
    while (did < budget && !this.done) {
      if (this._it.next().done) { this.done = true; break; }
      did++;
    }
    return did;
  }

  /** Run to completion. Fine headlessly; the page uses run(budget). */
  runAll(maxFrames = 5e6) {
    while (!this.done && this.frames < maxFrames) this.run(4096);
    return this.summary();
  }

  _frame() { this.m.runFrame(); this.frames++; }
  /* frameBytes, not frame: the hash must not change meaning when the core's
   * framebuffer element type widens for CGB. */
  _hash() { return fnv1a(this.m.frameBytes); }

  /* play_main.c classify_static(). Returns the button that woke it, or null.
   * Note it ADVANCES THE MACHINE by up to 4*182 frames, and that state carries
   * onward — mirrored deliberately. Not mirroring it would desynchronise the
   * two builds' runs from the first stall onward. */
  *_classifyStatic(wake) {
    const h0 = this._hash();
    for (const w of wake) {
      this.m.setButtons(1 << w.bit);
      for (let i = 0; i < 2; i++) { this._frame(); yield; }
      this.m.setButtons(0);
      for (let i = 0; i < 180; i++) {
        this._frame(); yield;
        if (this._hash() !== h0) return w.name;
      }
    }
    return null;
  }

  *_drive() {
    for (const s of this.steps) {
      if (s.op === "wait") {
        this.m.setButtons(0);
        for (let i = 0; i < s.frames; i++) { this._frame(); yield; }

      } else if (s.op === "settle") {
        /* Mirrors play_main.c exactly, cap included: run until the frame hash
         * has been unchanged for N consecutive frames, or SETTLE_CAP frames
         * have passed, in which case it degrades to a plain wait and says so.
         * The stability counter resets on any change, and frame 0 never counts
         * as stable -- both as in the native harness. */
        this.m.setButtons(0);
        let prev = 0, stable = 0, k = 0;
        for (; k < SETTLE_CAP && stable < s.frames; k++) {
          this._frame(); yield;
          const h = this._hash();
          stable = (k && h === prev) ? stable + 1 : 0;
          prev = h;
        }
        if (k >= SETTLE_CAP)
          this.notes.push("settle " + s.frames + ": never stabilised within " +
                          SETTLE_CAP + " frames (treated as a plain wait)");

      } else if (s.op === "press") {
        this.m.setButtons(s.mask);
        for (let i = 0; i < s.frames; i++) { this._frame(); yield; }
        this.m.setButtons(0);
        this._frame(); yield;                 /* the one released frame */

      } else if (s.op === "reach") {
        /* test/play_main.c's `reach`, mirrored. NAVIGATE BY THE GAME'S ANSWER,
         * NOT BY COUNTING PRESSES: watch WINDOW frames, and if the picture is
         * moving we are there; otherwise tap and look again.
         *
         * Counting presses was measured to be seed-fragile, not supposed so.
         * Tetris's copyright screen ignores input for its first ~4 seconds and
         * then advances on its own before frame 500, so the canonical run has
         * two presses swallowed and needs six while the SAME script under a
         * seed has none swallowed and needs four. Four Starts stopped on a menu
         * in one mode and PAUSED THE GAME in the other, and both printed green.
         * No constant is right in both. */
        let taps = 0, got = false, changed = 0, distinct = 0, cls = PR_WAITING;
        for (; taps <= s.taps; taps++) {
          if (taps) {
            this.m.setButtons(s.mask);
            for (let i = 0; i < 2; i++) { this._frame(); yield; }
            this.m.setButtons(0);
            this._frame(); yield;
          }
          this.m.setButtons(0);
          let prev = 0, seenFull = false;
          const seen = new Set();
          changed = 0;
          for (let i = 0; i < s.frames; i++) {
            this._frame(); yield;
            const h = this._hash();
            if (i && h !== prev) changed++;
            prev = h;
            if (!seen.has(h)) { if (seen.size < SEEN_CAP) seen.add(h); else seenFull = true; }
          }
          distinct = seen.size;
          cls = classifyProbe(changed, distinct, seenFull);
          if (cls === PR_MOVING) { got = true; break; }
        }
        this.reaches++;
        if (got) {
          this.notes.push("reach " + s.btn + ": reached after " + taps +
                          " tap(s) (changed " + changed + ", distinct " + distinct + ")");
        } else {
          /* Loud, and it costs the run its verdict. The whole defect this
           * command answers was a script stopping early while everything
           * downstream reported green. */
          this.reachesFailed++;
          this.notes.push("reach " + s.btn + ": NOT REACHED after " + s.taps +
                          " tap(s) of " + s.frames + "-frame windows — last window was " +
                          PR_NAME[cls] + " (changed " + changed + ", distinct " +
                          distinct + ")");
        }

      } else if (s.op === "snap") {
        /* A marker and nothing else. The native harness writes a framebuffer
         * here; the browser writes NOTHING — a rendered frame is derived
         * content under the same policy as the cartridge. */
        this.snaps++;

      } else if (s.op === "probe") {
        let prev = 0, changed = 0, run = 0, maxrun = 0, seenFull = false;
        const seen = new Set();
        for (let i = 0; i < s.frames; i++) {
          this._frame(); yield;
          let h = this._hash();
          if (i && h !== prev) { changed++; run = 0; }
          else if (i) {
            if (++run > maxrun) maxrun = run;
            if (run === STATIC_CLASSIFY_FRAMES) {
              const by = yield* this._classifyStatic(WAKE_LONG);
              if (by) {
                this.notes.push("probe " + s.name + ": " + run + "-frame stall at frame " +
                                i + " responded to " + by + " — waiting, not stalled");
              } else {
                this.notes.push("probe " + s.name + ": " + run + "-frame stall at frame " +
                                i + " answers NOTHING");
                this.longStalls++;
              }
              h = this._hash();
              run = 0;
            }
          }
          prev = h;
          if (!seen.has(h)) { if (seen.size < SEEN_CAP) seen.add(h); else seenFull = true; }
        }
        this.probes++;
        if (maxrun > this.worstStatic) this.worstStatic = maxrun;

        /* Classified BEFORE anything is reported, so the note, the census and
         * the per-probe stats cannot disagree with each other. */
        let cls = classifyProbe(changed, seen.size, seenFull);
        const novelty = changed ? (seen.size - 1) / changed : 0;
        this.probeStats.push({ name: s.name, frames: s.frames, changed,
                               distinct: seen.size, longestStatic: maxrun,
                               /* Added AFTER longestStatic: ui_net.py compares
                                * the first three by name, and the native side
                                * prints them in this order for the same
                                * reason -- its _PROBE_RE wants distinct= and
                                * longest-static= adjacent. */
                               novelty: +novelty.toFixed(3), cls, class: PR_NAME[cls] });

        if (changed === 0 && cls !== PR_UNSCORED) {
          /* A fully static probe is not evidence of a fault until a pause has
           * been ruled out: holding Start into Super Mario Land's level pauses
           * it, and Tokyo Disneyland's briefing sits on a dialogue box that
           * answers to A and not Start. Both were reported as hangs once. */
          const by = yield* this._classifyStatic(WAKE_SHORT);
          if (by) {
            this.notes.push("probe " + s.name + ": STATIC, responded to " + by +
                            " — waiting, not hung");
          } else {
            this.notes.push("probe " + s.name +
                            ": STATIC, no response to Start or A — genuine hang");
          }
          /* Answering a button rules out an EMULATOR fault. It does not turn a
           * probe that showed no motion into one that did. Counting it as
           * motion is what let `probes 3/3 moving` be printed over a probe with
           * changed=0 distinct=1, on both sides of this comparison. */
          cls = by ? PR_WAITING : PR_HUNG;
          this.probeStats[this.probeStats.length - 1].cls = cls;
          this.probeStats[this.probeStats.length - 1].class = PR_NAME[cls];
        }
        if (cls !== PR_MOVING)
          this.notes.push("probe " + s.name + ": " + PR_NAME[cls] + " (changed " +
                          changed + ", distinct " + seen.size + ", new/changed " +
                          novelty.toFixed(3) + ", longest-static " + maxrun + ")");
        this.census[cls]++;
        if (cls === PR_MOVING) this.probesMoving++;
      }
    }
  }
}

/**
 * One rung, one seed, start to finish. Mounts through the host's normal switch
 * path, so the run uses exactly the code the shell uses.
 */
export function runRung(host, cartBytes, scriptText, opts = {}) {
  const steps = parseScript(scriptText);
  const m = host.create(cartBytes, {
    label: opts.label || "ladder",
    useBios: opts.useBios === true,
  });
  try {
    const r = new LadderRun(steps, m);
    const out = r.runAll(opts.maxFrames || 5e6);
    out.seed = opts.seed !== undefined ? opts.seed : null;
    return out;
  } finally {
    host.free(m);
  }
}

/**
 * A seed spread over one rung. Returns per-seed results and the k/N figure the
 * native ladder prints, so the two can be compared as DISTRIBUTIONS rather than
 * as two coin flips — our method notes rule 1.
 */
export function runSeeds(host, cartBytes, scriptText, n, opts = {}) {
  const base = opts.base;
  if (typeof base !== "number")
    throw new Error("runSeeds needs an explicit base (test/ladder.py SEED_BASE); " +
                    "reading one from the script is what let the two ladders diverge");
  const seeds = seedWindow(base, n);
  const runs = [];
  for (const seed of seeds) {
    runs.push(runRung(host, cartBytes, seedScript(scriptText, seed),
                      Object.assign({}, opts, { seed })));
  }
  /* The window travels with the fraction, always: absolute fractions are
   * window-dependent and must never be quoted bare. */
  return { seedable: true, base, lo: seeds[0], hi: seeds[seeds.length - 1],
           plays: runs.filter(r => r.verdict).length, of: n, runs };
}

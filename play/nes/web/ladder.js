/* ladder.js — the driver that turns a running core into a VERDICT.
 *
 * The Game Boy core's web/ladder.js is the same module: the module that drives
 * a cartridge and says what happened, so the same judgement runs in a browser,
 * in a worker and headlessly in Node from ONE file.  It imports nothing but
 * core.js and touches no DOM, which is what makes the Node path possible.
 *
 * ---------------------------------------------------------------------------
 * WHY IT MATTERS THAT THIS IS A PORT AND NOT A NEW INSTRUMENT.
 *
 * Every protocol below is transcribed from test/native_main.c — the board
 * machine's own runner — deliberately and line for line, including the parts
 * that look like they could be simplified.  The point is NOT to have a second
 * opinion.  It is to have the SAME opinion computed on the other host, so that
 * running a board row through the browser path and through the board path and
 * getting different answers is a FINDING rather than an expected difference
 * between two harnesses that were written independently.
 *
 * web/selfcheck.mjs runs exactly that comparison.  At first no file under
 * web/ had ever been measured against a board row; this is the file that makes
 * the measurement possible and the one that gets measured.
 *
 * WHERE IT KNOWINGLY DIFFERS — and there is one place, named rather than left
 * to be discovered: the native runner's `--fill` / `--phase` / `--apu` knobs
 * are settable here too (see RunOptions) but the DEFAULTS are the core's own
 * power-on defaults in both cases, so an unflagged run on either host is the
 * same run.  A verdict is never quoted without the fill it was taken under.
 * ------------------------------------------------------------------------- */

import { BTN } from './core.js';

/* ---------------------------------------------------------------------------
 *  READING THE SCREEN
 *
 *  Twenty-seven Stage 3 rows report only to a screen: they predate the
 *  status-byte protocol, so the verdict is a word drawn in tiles.
 *
 *  TWO FONTS, and which one is used is decided by EVIDENCE ON THE SCREEN
 *  rather than by a list of which cartridge uses which.  The blargg suites
 *  number their font tiles by ASCII code.  The mapper-chip suite numbers its
 *  letters 1..26 and leaves everything else ASCII — read off a tile dump, not
 *  guessed.  Extending one decoder to cover both would let a screen with a
 *  picture on it spell PASSED by accident.
 * ------------------------------------------------------------------------- */

function readScreen(core, letters) {
  let out = '', sp = 0;
  for (let row = 0; row < 30; row++) {
    for (let col = 0; col < 32; col++) {
      const t = core.ciramPeek(row * 32 + col);
      let c;
      if (letters && t >= 1 && t <= 26) c = String.fromCharCode(64 + t);
      else if (t >= 0x20 && t < 0x7f) c = String.fromCharCode(t);
      else c = '.';
      if (c === ' ') { sp++; continue; }
      if (sp && out.length) out += ' ';
      sp = 0;
      out += c;
    }
    sp = 1;
  }
  return out;
}

/** The ASCII decoding. The blank tile renders as '.', not as a space — which
 * is why a "the screen is exactly three characters" test has to strip dots. */
export const screenText = (core) => readScreen(core, false);
/** The mapper-suite decoding, letters 1..26. */
export const screenTextLetters = (core) => readScreen(core, true);

const ci = (hay, needle) => hay.toUpperCase().includes(needle.toUpperCase());

/* ---------------------------------------------------------------------------
 *  ONE RUNNER FOR EVERY BOARD ROW
 *
 *  The corpus reports its verdicts five ways and the protocol is DETECTED per
 *  run from what the cartridge actually does, never from a list.  A
 *  hand-maintained list of which suite answers how is exactly what has already
 *  been caught going wrong in this project, and a second one would rot the
 *  same way.
 *
 *  A cartridge that answers in none of them is CANNOT-SCORE.  Never a pass.
 * ------------------------------------------------------------------------- */

const SUITE_STATUS = 0x6000;
const CPU_HZ = 1789773;

/**
 * @typedef {object} RowResult
 * @property {'PASS'|'FAIL'|'CANNOT-SCORE'} verdict
 * @property {string} via        which protocol answered
 * @property {number} code       the cartridge's own code, or -1
 * @property {number} resets     reset presses the harness drove
 * @property {string} msg        the cartridge's own words
 * @property {string} why        why a failure is a failure, when we can say
 * @property {number} frames     frames run
 * @property {boolean} jammed
 */

/**
 * Run one board row to a verdict.
 *
 * @param {object} core          a NesCore with the cartridge already mounted
 * @param {object} [opt]
 * @param {number} [opt.maxFrames=2400]  the frame budget. A budget reached
 *        without a verdict is CANNOT-SCORE: a screen that never said anything
 *        is a run that did not happen.
 * @param {number} [opt.expectMapper]    the mapper number the cartridge's
 *        FILENAME records. The mapper suite writes the board it was built for
 *        nowhere else, and the detected number is the load-bearing half of its
 *        verdict — a chip the core does not have is detected as some other
 *        chip, and every later test then runs the wrong driver and can still
 *        print 0000.
 * @param {string} [opt.expectCrc]       comma-separated acceptable checksums,
 *        from test/BOARD-ROWS.json. Two sample-DMA rows print a CRC-32 and
 *        stop; their own source lists the values that are all correct and
 *        declines to pick one, because the right one depends on CPU/picture
 *        synchronisation at reset.
 * @returns {RowResult}
 */
export function runBoardRow(core, opt = {}) {
  const maxFrames = opt.maxFrames ?? 2400;
  const expectMapper = opt.expectMapper ?? -1;
  const expectCrc = opt.expectCrc || '';

  let verdict = -1, code = -1, resets = 0, resetArmed = false, via = 'nothing', why = '';
  let text = '', text2 = '';
  const limit = core.frame + maxFrames;

  while (core.frame < limit && !core.jammed) {
    const fr = core.frame;
    while (core.frame === fr && !core.jammed) core.stepInstruction();

    /* ---- the status-byte protocol, identified by its own signature ---- */
    if (core.peek(0x6001) === 0xde && core.peek(0x6002) === 0xb0 && core.peek(0x6003) === 0x61) {
      const st = core.peek(SUITE_STATUS);
      if (st !== 0x81) resetArmed = false;         /* the request was served */
      if (st === 0x80) continue;                   /* still running          */
      if (st === 0x81) {
        /* ONE PRESS PER REQUEST, AND THE STATUS BYTE MUST MOVE FIRST. $81 does
         * not clear itself; after the press the cartridge's own reset handler
         * runs — in this suite with a deliberate ~2-frame delay — before it
         * writes a new status. A poller that treats every sighting of $81 as a
         * fresh request presses again inside that window, and the cartridge
         * counts resets to select which test it runs. That produced a defect
         * filed against the audio unit's reset behaviour when the audio unit
         * was not what was wrong. */
        if (resetArmed) continue;
        if (resets >= 4) { via = 'status byte'; code = st; break; }
        /* 250 ms, MEASURED and not taken from the protocol's "at least
         * 100 ms": swept over one cartridge, 1/64s never finishes, 1/16s
         * resets too early and logs 00 00 00, 1/4s and 1/2s pass. */
        const until = core.cycles + BigInt(Math.floor(CPU_HZ / 4));
        while (core.cycles < until && !core.jammed) core.stepInstruction();
        core.reset();
        resets++;
        resetArmed = true;
        continue;
      }
      via = 'status byte'; code = st; verdict = st ? 1 : 0;
      break;
    }

    /* The screen is only read every eighth frame: it is a 960-tile walk
     * through the ABI and reading it every frame dominates the run. */
    if ((core.frame & 7) !== 0) continue;
    text = screenText(core);
    if (ci(text, 'FAILED')) { verdict = 1; via = 'screen text'; break; }
    if (ci(text, 'PASSED')) { verdict = 0; via = 'screen text'; break; }

    /* ---- THE DEVCART RESULT CODE ----------------------------------------
     * The oldest builds carry neither protocol. They print one token, "$HH",
     * and their own tests.txt says a code of 1 always means everything passed.
     *
     * THE FILTER IS DELIBERATELY NARROW: it fires only when the WHOLE screen,
     * with blanks and the blank tile removed, is exactly a dollar and two hex
     * digits. It will not fire on a screen carrying any other text, on a code
     * printed beside a title, or on a partially drawn screen — the token is
     * written in one go at the end of the run. */
    {
      const sq = text.replace(/[. ]/g, '').slice(0, 7);
      if (sq.length === 3 && sq[0] === '$' && /^[0-9a-fA-F]{2}$/.test(sq.slice(1))) {
        code = parseInt(sq.slice(1), 16);
        verdict = code === 1 ? 0 : 1;
        via = 'screen result code';
        break;
      }
    }

    /* ---- THE PRINTED CHECKSUM -------------------------------------------
     * The last eight hex digits on the screen, and only once the cartridge has
     * finished printing. Accepted on the checksum the cartridge COMPUTES and
     * never on a byte listing beside it: in this same suite one cartridge's
     * comment lists an output its own build does not produce while its
     * compiled-in check passes. A comment is weaker evidence than code. */
    if (expectCrc) {
      const m = text.match(/([0-9a-fA-F]+)[^0-9a-fA-F]*$/);
      const got = m && m[1].length === 8 ? m[1] : null;
      if (got) {
        const ok = expectCrc.split(',').map(s => s.trim().toUpperCase()).includes(got.toUpperCase());
        verdict = ok ? 0 : 1; via = 'printed checksum'; code = ok ? 0 : 1;
        why = `${got} vs expected ${expectCrc}`;
        break;
      }
    }

    /* ---- THE MAPPER-CHIP SUITE'S OWN REPORT ------------------------------
     * It prints no verdict word. It prints what it FOUND: the mapper number it
     * detected, an OK or PROBLEM per region, and a four-hex-digit detailed
     * result which is the program-side and character-side driver results.
     *
     * THE DETECTED MAPPER NUMBER IS THE LOAD-BEARING HALF. Our MMC3 cartridge
     * was once detected as U*ROM and would have scored a pass on the detailed [term-ok: literal on-screen text from a third-party cartridge]
     * result alone, because the suite fell back to a chip that IS present. */
    text2 = screenTextLetters(core);
    if (ci(text2, 'HOLY MAPPEREL')) {
      const i = text2.toUpperCase().indexOf('DETAILED TEST RESULT: ');
      if (i >= 0) {
        const dr = text2.slice(i + 'DETAILED TEST RESULT: '.length, i + 'DETAILED TEST RESULT: '.length + 4);
        const detailOk = dr === '0000';
        const noProblem = !ci(text2, 'PROBLEM');
        /* strtol()'s behaviour exactly, including the part that is easy to
         * miss: no leading digits yields 0, not "no answer". parseInt yields
         * NaN there, and NaN would compare unequal to every mapper number
         * including 0 — so a suite screen that began with a letter would score
         * differently on the two hosts for a reason that has nothing to do
         * with the machine. */
        const saw = parseInt(text2, 10) || 0;
        const mapperOk = expectMapper < 0 || saw === expectMapper;
        verdict = (detailOk && noProblem && mapperOk) ? 0 : 1;
        via = 'mapper-suite screen';
        if (!mapperOk) why = `detected mapper ${saw}, cartridge is mapper ${expectMapper}; `;
        else if (!detailOk) why = `detailed result ${dr}, not 0000; `;
        else if (!noProblem) why = 'a memory region reported PROBLEM; ';
        text = text2;
        break;
      }
    }
  }

  /* The cartridge's own words. The status-byte suites write theirs as text
   * from $6004, with ANSI colour escapes in it; everything else has only the
   * screen. */
  let msg = '';
  if (via === 'status byte') {
    for (let i = 0; i < 250; i++) {
      const c = core.peek(0x6004 + i);
      if (!c) break;
      if (c === 0x1b) { while (i < 250 && core.peek(0x6004 + i) !== 0x6d) i++; continue; }
      const ch = (c === 10 || c === 13) ? 32 : c;
      if (ch >= 32 && ch < 127) msg += String.fromCharCode(ch);
    }
  } else {
    msg = screenText(core).slice(0, 250);
  }
  msg = msg.replace(/ +$/, '');

  return {
    verdict: verdict < 0 ? 'CANNOT-SCORE' : (verdict ? 'FAIL' : 'PASS'),
    via, code, resets,
    msg: verdict < 0
      ? (core.jammed ? 'the CPU jammed and the cartridge never reported'
                     : 'no verdict by either protocol within the frame budget')
      : msg,
    why, frames: core.frame, jammed: core.jammed,
    /* The exit code the native runner returns, so a comparison can be made on
     * the same axis the board is scored on. 3 is never 0 and never a pass. */
    exit: verdict < 0 ? 3 : (verdict ? 1 : 0),
  };
}

/* ---------------------------------------------------------------------------
 *  THE COMMERCIAL LADDER
 *
 *  A title is not tested until it is PLAYED. Loading a cartridge and watching
 *  it not crash is not a result.
 *
 *  TIER 3, AND IT SAYS SO ON EVERY RESULT IT RETURNS. No outside reference
 *  decides any of this: the ladder detects CHANGE and gross breakage, never
 *  correctness. A title can climb every rung and still be drawing the wrong
 *  colours or silently skipping a level. What it CAN do is tell "boots" from
 *  "plays", which the board's Tier 1 cartridges cannot, because they are not
 *  games.
 * ------------------------------------------------------------------------- */

export const LADDER = {
  SETTLE: 240, WINDOW: 60, HOLD: 20, AFTER: 180, PLAY: 300,
  LISTEN_STEP: 60, LISTEN_CAP: 3600, LISTEN_MIN: 8,
};
export const RUNG_NAMES = ['-', 'BOOTS', 'DRAWS', 'ANIMATES', 'RESPONDS', 'PLAYS'];

function hist(core) {
  const fb = core.framebuffer();
  const h = new Int32Array(64);
  /* On PAL the core stores the 2C07's black
   * border (line 0, x < 2, x > 253) whatever the program does; counted, it
   * would make a one-colour PAL screen read DRAWS.  The border is the
   * machine's, not the program's, so it is not counted (the native harness,
   * test/boot_sweep_main.c histogram(), does the same). */
  if (core.region === 1) {
    for (let i = 0; i < fb.length; i++) {
      const y = i >> 8, x = i & 255;
      if (y === 0 || x < 2 || x > 253) continue;
      h[fb[i] & 0x3f]++;
    }
    return h;
  }
  for (let i = 0; i < fb.length; i++) h[fb[i] & 0x3f]++;
  return h;
}
function dist(a, b) { let d = 0; for (let i = 0; i < 64; i++) d += Math.abs(a[i] - b[i]); return d; }

/**
 * Climb the ladder on a mounted title.
 *
 * THE FORK CONTROL IS NOT OPTIONAL AND IS THE REASON THIS TAKES TWO CORES.
 * Rung 4 asks whether a button press reached the program. A title's attract
 * sequence is moving anyway, so "the screen changed after the press" measures
 * the attract sequence. Two identical machines are run in lockstep, ONE of
 * them is pressed, and the difference between the two arms is the press with
 * the attract sequence differenced out.
 *
 * And the control is checked before it is used: if the two arms differ BEFORE
 * the press, the core is not deterministic under this protocol and NO RUNG IS
 * CLAIMED. An instrument that cannot tell its two arms apart is measuring
 * nothing, and this project has shipped five instruments that were right by
 * construction.
 *
 * @param {object} arm     the core that gets pressed
 * @param {object} shadow  an identically-mounted core that never does
 */
export function runLadder(arm, shadow) {
  /* stepFrame(), NOT runFrame(). Both arms must stop on the frame boundary,
   * and so must the board machine, or the histograms are taken at three
   * different places in the frame and two of the five figures drift. See
   * NesCore#stepFrame: this exact substitution is what closed a 136-unit
   * disagreement on Super Mario Bros. 3 that EFFECT and the rung name both
   * hid. */
  const both = (n) => { for (let i = 0; i < n; i++) { arm.stepFrame(); shadow.stepFrame(); } };
  let rung = 0, stopped = '', listenAt = -1;
  let ambient = 0, response = 0, effect = 0, pixels = 0;

  both(LADDER.SETTLE);
  if (!arm.jammed && arm.frame >= LADDER.SETTLE) rung = 1;
  else stopped = arm.jammed ? 'the CPU jammed' : 'no frames were produced';

  let h0 = null;
  if (rung === 1) {
    h0 = hist(arm);
    let distinct = 0; for (let i = 0; i < 64; i++) if (h0[i]) distinct++;
    if (distinct >= 2) rung = 2; else stopped = 'the screen holds one palette index';
  }

  if (rung === 2) {
    /* Rung 3 compares RAW PIXELS frame by frame across the WHOLE window, not
     * two adjacent frames: a blinking cursor can leave the colour mix
     * identical, and a title screen can sit perfectly still for a second
     * before its demo starts. Sampling a pair of frames inside the window was
     * the first version and it reported "nothing changed" for three mapper-0
     * titles that were animating perfectly well. */
    let prev = Uint16Array.from(arm.framebuffer());
    let moved = false;
    for (let w = 0; w < LADDER.WINDOW; w++) {
      both(1);
      const fb = arm.framebuffer();
      for (let i = 0; i < fb.length; i++) if (fb[i] !== prev[i]) { moved = true; prev[i] = fb[i]; }
    }
    ambient = dist(h0, hist(arm));
    if (moved) rung = 3; else stopped = 'nothing on screen changed in a full second';
  }

  if (rung === 3) {
    /* FIRST, WAIT UNTIL THE CARTRIDGE IS LISTENING. Pressing at a title that
     * has not yet started polling the port measures nothing, and reports it as
     * a core fault. */
    for (let w = 0; w <= LADDER.LISTEN_CAP; w += LADDER.LISTEN_STEP) {
      const before = arm.padReads(0) + arm.padReads(1);
      both(LADDER.LISTEN_STEP);
      if (arm.padReads(0) + arm.padReads(1) - before >= LADDER.LISTEN_MIN) { listenAt = w; break; }
    }

    let forkdiff = 0;
    { const x = arm.framebuffer(), y = shadow.framebuffer();
      for (let i = 0; i < x.length; i++) if ((x[i] & 0x3f) !== (y[i] & 0x3f)) forkdiff++; }
    const hFork = hist(arm);

    if (forkdiff !== 0) {
      stopped = 'THE FORK IS NOT CONTROLLED — the two arms differ before the press, so this core is ' +
                'not deterministic under this protocol and NO RUNG IS CLAIMED';
      rung = -1;
    } else if (listenAt < 0) {
      stopped = 'the cartridge never read the controller port in a full minute, so there was ' +
                'nothing to press at — NO RUNG IS CLAIMED';
      rung = -1;
    } else {
      arm.setButtons(0, BTN.START);
      both(LADDER.HOLD);
      arm.setButtons(0, 0);
      both(LADDER.AFTER);
      const hA = hist(arm), hB = hist(shadow);
      ambient  = dist(hFork, hB);     /* the churn, with no input          */
      response = dist(hFork, hA);     /* what a one-armed ladder would say */
      effect   = dist(hB, hA);        /* THE PRESS, differenced out        */
      const x = arm.framebuffer(), y = shadow.framebuffer();
      for (let i = 0; i < x.length; i++) if ((x[i] & 0x3f) !== (y[i] & 0x3f)) pixels++;
      if (effect > 0) rung = 4;
      else stopped = 'the two arms stayed bit-identical: with the attract sequence differenced ' +
                     'out, the press reached nothing';
      if (rung === 4) {
        const h2 = hA;
        for (let i = 0; i < LADDER.PLAY; i++) arm.stepFrame();
        const h3 = hist(arm);
        let d2 = 0; for (let i = 0; i < 64; i++) if (h3[i]) d2++;
        if (!arm.jammed && d2 >= 2 && dist(h2, h3) > 0) rung = 5;
        else stopped = arm.jammed ? 'the CPU jammed during play' : 'the screen stopped changing';
      }
    }
  }

  return {
    rung, name: rung < 0 ? 'UNREADABLE' : RUNG_NAMES[rung],
    stopped, listenAt, ambient, response, effect, pixels,
    mapper: arm.mapper, frames: arm.frame, jammed: arm.jammed,
    tier: 3,
    note: 'TIER 3: detects change and gross breakage, never correctness.',
  };
}

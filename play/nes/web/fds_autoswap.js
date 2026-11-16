/* fds_autoswap.js -- CHANGE DISK SIDES WHEN THE PROGRAM ASKS.
 *
 * The host's half of the Disk System's automatic disk change. The core does no
 * swapping: it reports, and this decides. Nothing here touches the machine; it
 * returns "change to side N" and the host does what its own Media item does for
 * a person (eject, the swap gap, insert), so an automatic change and a manual
 * one are the same event to the drive firmware and to the title.
 *
 * TWO WAYS A TITLE ASKS FOR ANOTHER SIDE, and both are read from the machine:
 *
 *   ASKED (exact). A title that loads through the drive firmware hands the
 *     firmware's header check a ten-byte disk identity (core: nes_fds_want,
 *     nes_fds_want_count; src/nes_fds.inc fds_note_want, MECHANISM). If the
 *     side in the drive does not match it and another side of the mounted set
 *     does, change to that side. $FF in the identity matches anything. Where
 *     several sides match (unlicensed disks whose identities are blank), a side
 *     not yet tried is preferred, then the other side of the disk in the drive,
 *     then the set's order.
 *     If no side matches, nothing is done: the title shows its own message and
 *     the person can still use Media.
 *
 *   WAITING (inferred). A title with its own loader (Monitor Puzzle; the Fruits
 *     Mahjong engine) never calls the header check. It shows "SET SIDE B" and
 *     waits for the drive: MEASURED 2026-10-17 on both (probe
 *     scripts probe.mjs, dbg.mjs): $4032 read every frame, the controllers
 *     not read at all, no byte taken from the drive ($4031 not read), the
 *     picture still. A title screen reads the controllers; a cut scene moves;
 *     a load reads $4031. (NOT the motor bit: Monitor Puzzle leaves $4025's
 *     motor bit set all through its wait, measured, so "motor off" never held.)
 *     A BUSY wait stands in for the still picture: Kind Gal's "DISK 2 SIDE A"
 *     screen keeps a part of the picture moving but reads $4032 989-990 times
 *     a frame in a tight loop, no controller, no data (MEASURED 2026-10-17,
 *     probe script dbg2.mjs); a title in play reads it once a frame
 *     at most. BUSY_POLLS is FITTED between the two. When all four hold
 *     for WAIT_FRAMES, the next side not yet tried is put in. If the title
 *     answers with the header check, ASKED corrects a wrong guess; if it is
 *     its own loader, it rejects the side by waiting again and the next one is
 *     tried. Every side is tried at most once until the title shows life (reads
 *     a controller, or a header check finds its side in the drive), so a title
 *     that wants a disk the set does not hold is never cycled for ever.
 *     CENSUS 2026-10-18 (tools/r19fds/autoswap_census.mjs, all 433 disks alone, no
 *     input, 3,600 frames, at WAIT_FRAMES 90): the change acted on 35. Looked at
 *     by eye: every single-file disk it acted on but one was on its own "set
 *     side B" screen (Adian no Tsue, Bishoujo Control, Chitei Tairiku Ordola,
 *     German Tanteidan, Gokuraku Yuugi, Monitor Puzzle x4, Santa Claus, Super Boy
 *     Allan, Winter Games) or a firmware error (Souseiki Fammy ERR.02); Igo -
 *     Kyuu Roban Taikyoku was changed on a black pause after its handover and
 *     on its logo (FALSE). Hence: 300 frames, a one-colour picture is never a
 *     prompt, and "life" is controller reads on LIFE_FRAMES frames running (a
 *     lone Kouhen on the firmware's error screen read the pads twice in 300
 *     frames and was cycled between its sides).
 *     LABEL: FITTED (the conditions, WAIT_FRAMES, LIFE_FRAMES), from the measured
 *     wait loops above; check: a title that changes sides when no change was
 *     asked for (a still screen that polls the drive and reads no controller),
 *     or a "SET SIDE" screen that reads the controller and is never answered.
 *
 *   ASK FIRST (a trial insertion). A title that waits like this and then calls
 *     the header check says which side it wants only AFTER a side goes in, and
 *     where several sides could be next a wrong first guess is seen by the
 *     title: Kind Gal's, given Disk 1 side B, shows its own "the disk is
 *     different, press a button" message and stops until a button is pressed
 *     (MEASURED: side 1 put in, its header check asked for side 2
 *     31 frames later). So where more than one side is left to try and the host
 *     lends the machine (`machine`), the guess is first made on a saved copy of
 *     the moment: on the copy the disk is ejected, the guess is put in after the
 *     host's own swap gap (a shorter gap is not enough: Kind Gal's asked nothing
 *     on the copy with gaps of 2 to 30 frames, MEASURED), and the copy runs until
 *     the title's header check asks (PROBE_FRAMES at most). The copy runs
 *     PROBE_SLICE frames after each real frame, the real machine saved and put
 *     back round them, so the play window never stops and the title never sees
 *     the trial (a trial run in one go held the page for over a second on a
 *     busy machine, MEASURED). The side that check names is the one put in for
 *     real, never the side that was waited on. A title with its own loader asks
 *     nothing on the copy, and the order above stands. A trial is dropped when
 *     the title shows life, asks by itself, or the disk is changed by hand.
 *     LABEL: MECHANISM (the title's own header check, read as ASKED reads it);
 *     PROBE_FRAMES and PROBE_SLICE FITTED. Check: a title that, after the
 *     change, still shows a wrong-disk message, or one that behaves differently
 *     with and without the trial (the trial must leave no trace).
 *
 *   RECORDED ORDER (per set, where the title's own check cannot decide). Some
 *     sets carry the same identity on two sides: Tenshi Tachi no Houkago's
 *     Disk 1 side A and Disk 2 side A both read "side 0, disk 0", and its two
 *     B sides "side 1". Its check then names two sides, and the title tells
 *     them apart only by its own marker file (ID 64 at $DA00: $40 Disk 1 B,
 *     $80 Disk 2 A, $C0 Disk 2 B; the side it wants is RAM $5B bits 6-7, set
 *     from the scene's file ID at $65FC: below 17 Disk 1 A, below 29 Disk 1 B,
 *     below 41 Disk 2 A, else Disk 2 B; READ from its code). Its scenes follow
 *     one story list (16, 17, 19 ... 27, then 29 ... 39, then 41 ...; $6B48), so
 *     it moves Disk 1 A to 1 B, 1 B to Disk 2 A, and 2 A to 2 B. For such a set
 *     RECORDED_ORDERS lists, per side in the drive, the side the title wants
 *     next. Tenshi's was RECORDED by playing it: Disk 1 A to 1 B in ordinary
 *     play, and 1 B to 2 A and 2 A to 2 B with the title's own next-scene path
 *     from its own story list, reading each request on its screen ("SET SIDE
 *     2-A") and in its memory. It is used only to choose between sides the
 *     check cannot tell apart, or when a trial asks nothing; a side the check
 *     rules out is never chosen. LABEL: RECORDED per set, keyed by the sha256
 *     of each member disk file in mount order. Check: the title's marker check
 *     refusing a side the record chose ("DISK NO ERR 08" on Tenshi).
 *
 * USE: const auto = new FdsAutoSwap(nes.x, nes.ctx, { sides, disks, machine, gap });
 *      once per frame, after it ran and when no change is pending:
 *        const s = auto.step(frameBuffer);   // null, or the side to change to
 *      auto.reset() after a person changes the side by hand; auto.resync() after a state load.
 * `disks` is the side count of each member disk in mount order ([2, 2] for a
 * two-disk set); it only decides which sides count as "the same disk".
 * `members` (optional) is the mounted set's member hashes in mount order, for
 * RECORDED_ORDERS.
 * `machine` (optional) is the NesCore wrapper the host runs (saveState, loadState,
 * runFrame, fdsEject, fdsInsert) and `gap` its swap gap in frames; without a
 * machine no trial is made. During a trial each step() runs PROBE_SLICE frames of
 * the copy and puts the machine back as it was, picture and sound included.
 */

export const FDS_SIDE_BYTES = 65500;
export const WAIT_FRAMES = 300;         /* FITTED: 5 s of the wait signs together (was 90; census 2026-10-18) */
export const LIFE_FRAMES = 10;          /* FITTED: controller reads on this many frames running = the title is in play */
export const BUSY_POLLS = 64;           /* FITTED: $4032 reads in one frame that make a busy wait on the drive */
export const PROBE_FRAMES = 240;        /* FITTED: how long a trial insertion waits for the title's header check (Kind Gal's: 31) */
export const PROBE_SLICE = 3;           /* FITTED: frames of the trial copy run after each real frame */
/* RECORDED: see RECORDED ORDER above. after[side in the drive] = the sides wanted next, in order. */
export const RECORDED_ORDERS = [
  { title: 'Tenshi Tachi no Houkago', members: ['65143bfddb57ec17872abf15a87d444e45d24728047eff6b6ef5412e563509c1', '02bcd5dc755ca6a785bdec92abf398c64d1cd49d43bc02f253c6895d9026bb4c'], after: { 0: [1], 1: [2], 2: [3] } },
];
const HDR_AT = 15;                      /* the identity's offset in a side's disk-information block */

export class FdsAutoSwap {
  constructor(x, ctx, opt = {}) {
    this.x = x; this.ctx = ctx;
    this.sides = opt.sides || x.nes_fds_sides(ctx);
    this.diskOf = [];
    const disks = opt.disks && opt.disks.length ? opt.disks : [this.sides];
    disks.forEach((n, d) => { for (let i = 0; i < n; i++) this.diskOf.push(d); });
    while (this.diskOf.length < this.sides) this.diskOf.push(disks.length - 1);
    this.enabled = opt.enabled !== false;
    this.log = opt.log || null;
    this.wantSeen = x.nes_fds_want_count ? x.nes_fds_want_count(ctx) : 0;
    this.hasWant = typeof x.nes_fds_want_count === 'function';
    this.reads2 = x.nes_fds_reads(ctx, 2); this.prev2 = this.reads2;
    this.reads1 = x.nes_fds_reads(ctx, 1);
    this.pads = x.nes_pad_reads(ctx, 0) + x.nes_pad_reads(ctx, 1);
    this.lastHash = -1; this.still = 0; this.tried = new Set();
    this.changes = 0;
    this.machine = opt.machine || null;
    const mem = (opt.members || []).join('|');
    this.recorded = mem ? RECORDED_ORDERS.find(r => r.members.join('|') === mem) || null : null;
    this.gap = opt.gap > 0 ? opt.gap : 60;
    this.probes = 0;
    this.trial = null;
  }
  reset() { this.still = 0; this.tried.clear(); this.lastHash = -1; this.trial = null; }
  /* After a state is loaded: the counters jumped; take them as they are now. */
  resync() {
    const x = this.x, c = this.ctx;
    if (this.hasWant) this.wantSeen = x.nes_fds_want_count(c);
    this.reads2 = x.nes_fds_reads(c, 2); this.prev2 = this.reads2; this.reads1 = x.nes_fds_reads(c, 1);
    this.pads = x.nes_pad_reads(c, 0) + x.nes_pad_reads(c, 1);
    this.reset();
  }

  image() {
    const p = this.x.nes_fds_image(this.ctx), n = this.x.nes_fds_image_size(this.ctx);
    return new Uint8Array(this.x.memory.buffer, p, n);
  }
  /* Which sides of the mounted image carry an identity matching `want`. */
  matches(want) {
    const img = this.image(), out = [];
    for (let s = 0; s < this.sides; s++) {
      const o = s * FDS_SIDE_BYTES;
      if (img[o] !== 0x01) continue;                       /* no disk-information block */
      let ok = true;
      for (let i = 0; i < 10 && ok; i++) if (want[i] !== 0xFF && want[i] !== img[o + HDR_AT + i]) ok = false;
      if (ok) out.push(s);
    }
    return out;
  }
  /* Prefer the other side of the disk in the drive, then the set's order after it. */
  order(cands, cur) {
    const d = cur >= 0 ? this.diskOf[cur] : -1;
    const rank = s => (this.diskOf[s] === d ? 0 : 1) * 1000 + ((s - cur + this.sides) % this.sides);
    return cands.filter(s => s !== cur).sort((a, b) => rank(a) - rank(b));
  }
  note(msg) { if (this.log) try { this.log(msg); } catch (_) {} }
  /* Of the sides a check names (cur never among them), the one to put in: a side not yet
     tried first; where several are left and the set has a recorded order, the recorded one. */
  choose(cands, cur) {
    const fresh = cands.filter(s => !this.tried.has(s)), pool = fresh.length ? fresh : cands;
    this.byRecord = false;
    if (pool.length > 1 && this.recorded) {
      const r = (this.recorded.after[cur] || []).find(s => pool.includes(s));
      if (r !== undefined) { this.byRecord = true; return r; }
    }
    return this.order(pool, cur)[0];
  }
  /* With no check to go on: the recorded next side not yet tried, if the set has one. */
  recordedNext(cur) {
    if (!this.recorded) return undefined;
    return (this.recorded.after[cur] || []).find(s => s !== cur && !this.tried.has(s));
  }
  /* A trial insertion of `side` on a saved copy of the moment (ASK FIRST). */
  startTrial(side, cur) {
    const m = this.machine;
    if (!m || !this.hasWant || typeof m.saveState !== 'function') return false;
    try { this.trial = { side, cur, st: m.saveState(), f: 0, n0: this.x.nes_fds_want_count(this.ctx), ms: 0 }; } catch (_) { this.trial = null; return false; }
    this.probes++;
    return true;
  }
  /* PROBE_SLICE frames of the copy, the real machine saved and put back round them.
     Returns the identity the title's header check asked for, false when the trial
     ended with no ask, or null while it runs on. */
  trialSlice() {
    const m = this.machine, x = this.x, c = this.ctx, T = this.trial, end = this.gap + PROBE_FRAMES;
    const t0 = typeof performance === 'object' ? performance.now() : 0;
    let real, want = null;
    try { real = m.saveState(); } catch (_) { return false; }
    try {
      m.loadState(T.st);
      if (T.f === 0) m.fdsEject();
      for (let k = 0; k < PROBE_SLICE && T.f < end && !want; k++, T.f++) {
        if (T.f === this.gap) m.fdsInsert(T.side);
        m.runFrame();
        if (m.jammed) { T.f = end; break; }
        if (x.nes_fds_want_count(c) !== T.n0) { want = []; for (let i = 0; i < 10; i++) want.push(x.nes_fds_want(c, i)); T.at = T.f - this.gap; }
      }
      if (!want && T.f < end) T.st = m.saveState();
    } catch (_) { T.f = end; }
    m.loadState(real);
    if (typeof performance === 'object') T.ms += performance.now() - t0;
    return want || (T.f >= end ? false : null);
  }

  step(fb) {
    const x = this.x, c = this.ctx;
    const inserted = !!x.nes_fds_inserted(c), cur = inserted ? x.nes_fds_side(c) : -1;
    const r2 = x.nes_fds_reads(c, 2), polled = r2 !== this.reads2; this.reads2 = r2;
    const pr = x.nes_pad_reads(c, 0) + x.nes_pad_reads(c, 1), padRead = pr !== this.pads; this.pads = pr;
    const r1 = x.nes_fds_reads(c, 1), dataRead = r1 !== this.reads1; this.reads1 = r1;
    this.padRun = padRead ? (this.padRun || 0) + 1 : 0;
    if (this.padRun >= LIFE_FRAMES) { this.tried.clear(); this.trial = null; }    /* the title is in play again */

    /* ASKED: a header check started since the last frame. */
    if (this.hasWant) {
      const n = x.nes_fds_want_count(c);
      if (n !== this.wantSeen) {
        this.wantSeen = n; this.trial = null;          /* the title asks by itself: no trial needed */
        const want = []; for (let i = 0; i < 10; i++) want.push(x.nes_fds_want(c, i));
        const m = this.matches(want);
        /* A check that finds its side in the drive is life only when the identity names
           one side: a blank unlicensed identity matches every disk's side A, and the
           title then judges the disk itself (the Fruits Mahjong engine refuses its own
           program disk as a data disk, MEASURED 2026-10-17). */
        /* NOT life, ever (census 2026-10-18): the firmware's own boot check asks side 0
           of disk 0 with everything else "any", and on its error screen it asks again
           after every insertion; counting that as life cycled a lone Kouhen between its
           sides for ever. Only a controller read is life. */
        if (cur >= 0 && m.includes(cur)) { this.still = 0; }
        else if (m.length && this.enabled) {
          const pick = this.choose(m.filter(s => s !== cur), cur);
          if (pick !== undefined) { if (cur >= 0) this.tried.add(cur); this.tried.add(pick); this.still = 0; this.changes++; this.note(`asked for side ${pick}${this.byRecord ? ' (recorded order)' : ''} (in the drive: ${cur < 0 ? 'none' : cur})`); return pick; }
        }
      }
    }

    /* ASK FIRST, running: a slice of the trial; its answer decides the change. */
    if (this.trial) {
      const T = this.trial;
      if (!this.enabled || cur !== T.cur) { this.trial = null; return null; }
      const want = this.trialSlice();
      if (want === null) return null;
      this.trial = null;
      const m = want ? this.matches(want).filter(s => s !== cur) : [];
      const pick = m.length ? this.choose(m, cur) : undefined;
      const ms = Math.round(T.ms), real = Math.ceil(T.f / PROBE_SLICE);
      if (pick !== undefined) { this.tried.add(pick); this.changes++; this.note(`waiting on the drive: a trial with side ${T.side} asked for side ${pick}${this.byRecord ? ' (recorded order)' : ''} (${T.at} frames after it went in; the trial took ${ms} ms over ${real} frames), put in (in the drive: ${cur})`); return pick; }
      const rec = this.recordedNext(cur), side = rec !== undefined ? rec : T.side;
      this.tried.add(side); this.changes++; this.note(`waiting on the drive: a trial asked nothing; trying side ${side}${rec !== undefined ? ' (recorded order)' : ''} (in the drive: ${cur})`); return side;
    }

    /* WAITING: the four signs together. */
    let h = 0;
    let blank = true;
    if (fb) { h = 0x811C9DC5; const v0 = fb[0]; for (let i = 0; i < fb.length; i += 3) { const v = fb[i]; if (v !== v0) blank = false; h = Math.imul(h ^ v, 16777619); } h >>>= 0; }
    else blank = false;
    const stillPic = !fb || h === this.lastHash; this.lastHash = h;
    const busy = r2 - this.prev2 >= BUSY_POLLS; this.prev2 = r2;
    /* a prompt shows something: a one-colour picture is a pause, never "SET SIDE B" */
    if (inserted && !dataRead && polled && !padRead && !blank && (stillPic || busy)) this.still++; else this.still = 0;
    if (this.still >= WAIT_FRAMES && this.enabled && this.sides > 1) {
      this.still = 0;
      this.tried.add(cur);
      const all = []; for (let s = 0; s < this.sides; s++) all.push(s);
      const left = this.order(all, cur).filter(s => !this.tried.has(s));
      const next = left[0];
      /* ASK FIRST: the side the title's own header check names on a trial insertion */
      if (left.length > 1 && this.startTrial(next, cur)) return null;
      const rec = left.length > 1 ? this.recordedNext(cur) : undefined;
      if (rec !== undefined) { this.tried.add(rec); this.changes++; this.note(`waiting on the drive: trying side ${rec} (recorded order; in the drive: ${cur})`); return rec; }
      if (next !== undefined) { this.tried.add(next); this.changes++; this.note(`waiting on the drive: trying side ${next} (in the drive: ${cur})`); return next; }
    }
    return null;
  }
}

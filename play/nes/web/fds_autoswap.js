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
 * USE: const auto = new FdsAutoSwap(nes.x, nes.ctx, { sides, disks });
 *      once per frame, after it ran and when no change is pending:
 *        const s = auto.step(frameBuffer);   // null, or the side to change to
 *      auto.reset() after a person changes the side by hand; auto.resync() after a state load.
 * `disks` is the side count of each member disk in mount order ([2, 2] for a
 * two-disk set); it only decides which sides count as "the same disk".
 */

export const FDS_SIDE_BYTES = 65500;
export const WAIT_FRAMES = 300;         /* FITTED: 5 s of the wait signs together (was 90; census 2026-10-18) */
export const LIFE_FRAMES = 10;          /* FITTED: controller reads on this many frames running = the title is in play */
export const BUSY_POLLS = 64;           /* FITTED: $4032 reads in one frame that make a busy wait on the drive */
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
  }
  reset() { this.still = 0; this.tried.clear(); this.lastHash = -1; }
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

  step(fb) {
    const x = this.x, c = this.ctx;
    const inserted = !!x.nes_fds_inserted(c), cur = inserted ? x.nes_fds_side(c) : -1;
    const r2 = x.nes_fds_reads(c, 2), polled = r2 !== this.reads2; this.reads2 = r2;
    const pr = x.nes_pad_reads(c, 0) + x.nes_pad_reads(c, 1), padRead = pr !== this.pads; this.pads = pr;
    const r1 = x.nes_fds_reads(c, 1), dataRead = r1 !== this.reads1; this.reads1 = r1;
    this.padRun = padRead ? (this.padRun || 0) + 1 : 0;
    if (this.padRun >= LIFE_FRAMES) this.tried.clear();    /* the title is in play again */

    /* ASKED: a header check started since the last frame. */
    if (this.hasWant) {
      const n = x.nes_fds_want_count(c);
      if (n !== this.wantSeen) {
        this.wantSeen = n;
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
          const fresh = m.filter(s => !this.tried.has(s));
          const pick = this.order(fresh.length ? fresh : m, cur)[0];
          if (pick !== undefined) { if (cur >= 0) this.tried.add(cur); this.tried.add(pick); this.still = 0; this.changes++; this.note(`asked for side ${pick} (in the drive: ${cur < 0 ? 'none' : cur})`); return pick; }
        }
      }
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
      const next = this.order(all, cur).find(s => !this.tried.has(s));
      if (next !== undefined) { this.tried.add(next); this.changes++; this.note(`waiting on the drive: trying side ${next} (in the drive: ${cur})`); return next; }
    }
    return null;
  }
}

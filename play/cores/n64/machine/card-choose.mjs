// Which road a device draws by, found by measuring in play and kept under watch (a faster road: the drawing thread, bit
// 2048, with the graphics card, bit 67108864; core/rdp_card.c, docs/parts/SPEED.md sections 27 and 28).
//
// A card that wins on one device loses on another of the same maker a generation apart, which kinds of call are worth
// sending differs too, and on one device the answer moves with heat, with the device slowing itself and with what else
// runs. So nothing here goes by the card's name, and the choice is not made once. Every way draws the same words, so the
// way may change at any field and the player sees nothing of it.
//
// What is compared is the drawing thread's own time a field, its waits for the card in it, and not fields a second:
// those say nothing where the machine's own thread is the limit, and the card is not to be chosen where it only moves
// work about. The time comes from the host's clock through the core (n64_rdp_thread_clock, n64_rdp_thread_count(23));
// its reads cost time themselves, so the clock is on only while something is measured.
//
//   chooser(x, m, options)   one measure: block by block the ways in turn (the road off, the card with every kind, the card
//                            with only the kinds that are dear to a processor), so many rounds; the lowest mean is set, the
//                            card only where it is under the road off by the margin and did not fail.
//   watcher(x, m, options)   the same measure when play begins, and from then on:
//                              a watch    the clock is on for two fields of every sixteen; the median of the last samples
//                                         is held against the median when the way was chosen, and a clear worsening
//                                         (`worse` ms a field) has the ways measured again at once;
//                              a timer    the ways are measured again every `everyMs` whatever the watch says, one short
//                                         block each, so that a road that has become the better one is found;
//                              a margin   the way changes only when another is under the one in force by `margin` ms a
//                                         field in two measures running (the second follows the first at once), so two
//                                         ways that read alike never change places back and forth.
//                            A card that fails is drawn by hand by the core at once; the road is then off for good.
//
// The host calls step() after every field it has run. chooser's returns null while the measure goes on and the result
// when it has ended. watcher's returns null, or what has just happened: { what: "measured" | "changed" | "worse" |
// "failed", atMs, ... }; way() says the way in force.
//   x, m      the core's exports and its machine; the card's worker must be serving the desk
//   fields    fields a block; skip: fields at a block's start left out (a shader is compiled and the caches fill then)
//   now       the host's clock in ms (performance.now as given)
// The kinds: bit 1 the card's mode, 2 made line 8, 4 and 8 the two lines without a texture, 16 line 37, 32 a fill, 64 the mode as a decal.
// Each way is drawn by its own shader: the host draws a dispatch by the shader made for no more kinds than its calls
// have (shared/card.mjs), so the way of the dear kinds alone is measured with the shader made without line 8 and fill.

export const EVERY_KIND = 127, DEAR_KINDS = 93;
export const WAYS = [{ name: "the road off", how: 0, kinds: EVERY_KIND }, { name: "the card, every kind", how: 2, kinds: EVERY_KIND }, { name: "the card, the dear kinds", how: 2, kinds: DEAR_KINDS }];

const busyOf = (x) => () => Number(x.n64_rdp_thread_count(23));
// (Commands the machine's thread has sent and commands the drawing thread has drawn. The drawing thread may be behind the machine or catching up, so
// its time over some fields of the machine is not its time for those fields' work: its time a command is, and a field is so many commands.)
const commandsOf = (x) => () => [Number(x.n64_rdp_thread_count(0)), Number(x.n64_rdp_thread_count(18))];
const aField = (busyUs, sent, drawn, fields) => busyUs / 1000 / fields * (drawn > 0 && sent > 0 ? sent / drawn : 1);
const failedOf = (x) => () => Number(x.n64_rdp_card_count(5));
// (The card's worker keeps its own counts on the desk: requests answered, and the millionths of a second it waited for the card.)
const workerOf = (x) => { const deskAt = x.n64_rdp_card_desk(); return () => { const d = new Uint32Array(x.memory.buffer, deskAt, 64); return [d[32], d[34]]; }; };
const setter = (x, m) => (w) => { const got = x.n64_rdp_card_live(m, w.how); x.n64_rdp_card_kinds(w.kinds); return got; };

// One round or more of blocks, the ways in turn. step() returns null until the last block has ended, then the blocks and
// each way's mean. The clock is switched on at the start and left on: the caller switches it off.
function rounds(x, m, ways, { fields, skip, rounds: count }) {
  const busy = busyOf(x), failed = failedOf(x), worker = workerOf(x), commands = commandsOf(x), set = setter(x, m), blocks = [], failedBefore = failed();
  let at = 0, inBlock = 0, from = 0, tripsFrom = [0, 0], commandsFrom = [0, 0];
  x.n64_rdp_thread_clock(1);
  let got = set(ways[0]);
  return () => {
    inBlock++;
    if (inBlock === skip) { from = busy(); tripsFrom = worker(); commandsFrom = commands(); }
    if (inBlock < fields) return null;
    const w = ways[at % ways.length], trips = worker(), c = commands();
    blocks.push({ way: w.name, got, msAField: aField(busy() - from, c[0] - commandsFrom[0], c[1] - commandsFrom[1], fields - skip), tripsAField: (trips[0] - tripsFrom[0]) / (fields - skip), waitMsATrip: trips[0] > tripsFrom[0] ? (trips[1] - tripsFrom[1]) / 1000 / (trips[0] - tripsFrom[0]) : 0, failed: failed() > failedBefore });
    at++; inBlock = 0;
    if (at < count * ways.length) { got = set(ways[at % ways.length]); return null; }
    const anyFailed = blocks.some((b) => b.failed);
    const means = ways.map((v, i) => { const mine = blocks.filter((_b, k) => k % ways.length === i); return { way: v.name, how: v.how, kinds: v.kinds, msAField: mine.reduce((t, b) => t + b.msAField, 0) / mine.length, had: mine.every((b) => b.got === v.how), failed: anyFailed && v.how !== 0 }; });
    return { blocks, means, fieldsMeasured: at * fields };
  };
}
// The way with the lowest mean among those that may be chosen: the road off always may; a way of the card where it was had,
// did not fail and is under `than` (a way's mean) by the margin.
function lowest(means, than, margin) {
  let best = than;
  for (const v of means) if (v !== than && (v.how === 0 || (v.had && !v.failed)) && v.msAField < than.msAField - margin && v.msAField < (best === than ? Infinity : best.msAField)) best = v;
  return best;
}

export function chooser(x, m, { fields = 80, skip = 20, rounds: count = 2, margin = 0.5, ways = WAYS } = {}) {
  const step = rounds(x, m, ways, { fields, skip, rounds: count }), set = setter(x, m);
  let result = null;
  return {
    step() {
      if (result) return result;
      const r = step();
      if (!r) return null;
      const chosen = lowest(r.means, r.means.find((v) => v.how === 0), margin);
      set(chosen);
      x.n64_rdp_thread_clock(0);
      result = { chosen: chosen.way, how: chosen.how, kinds: chosen.kinds, ...r };
      return result;
    },
  };
}

export function watcher(x, m, { fields = 60, skip = 15, margin = 0.5, worse = 1, everyMs = 45000, samples = 24, ways = WAYS, now = () => performance.now(), confirm = 2 } = {}) {
  const busy = busyOf(x), failed = failedOf(x), commands = commandsOf(x), set = setter(x, m), started = now(), failedBefore = failed();
  let commandsFrom = [0, 0];
  const off = ways.find((w) => w.how === 0);
  let inForce = off, measuring = rounds(x, m, ways, { fields, skip, rounds: 2 }), first = true, why = "play begins";
  let candidate = null, agreed = 0;             // the way a measure found better than the one in force, and in how many measures running
  let watch = [], baseline = null, field = 0, from = 0, measuredAt = started, dead = false;
  const median = (a) => { const s = [...a].sort((p, q) => p - q); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : null; };
  const again = (reason) => { x.n64_rdp_thread_clock(0); measuring = rounds(x, m, ways, { fields, skip, rounds: 1 }); why = reason; };
  const watchAnew = () => { watch = []; baseline = null; field = 0; };
  return {
    way: () => inForce,
    watched: () => ({ medianMsAField: median(watch), whenChosenMsAField: baseline, samples: watch.length }),
    step() {
      const atMs = Math.round(now() - started);
      if (dead) return null;
      if (failed() > failedBefore) {
        // (The core draws by hand from the failure on; the road is switched off, and nothing is measured again.)
        dead = true; measuring = null; inForce = off; set(off); x.n64_rdp_thread_clock(0);
        return { what: "failed", atMs, why: Number(x.n64_rdp_card_count(101)), way: off.name };
      }
      if (measuring) {
        const r = measuring();
        if (!r) return null;
        measuring = null; measuredAt = now();
        const mine = r.means.find((v) => v.way === inForce.name);
        // (When play begins the ways are gone through twice and the lowest is taken at once: there is no way in force to keep.)
        const best = lowest(r.means, first ? r.means.find((v) => v.how === 0) : mine, margin);
        let changed = false;
        if (first) { changed = best.way !== inForce.name; candidate = null; agreed = 0; }
        else if (best === mine) { candidate = null; agreed = 0; }
        else { agreed = candidate === best.way ? agreed + 1 : 1; candidate = best.way; changed = agreed >= confirm; }
        const was = inForce.name, reason = why;
        if (changed) { inForce = ways.find((w) => w.name === best.way); candidate = null; agreed = 0; }
        first = false;
        set(inForce);
        x.n64_rdp_thread_clock(0);
        watchAnew();
        // (A way found better once is measured again at once: it is taken only if the second measure agrees.)
        if (candidate) again(`"${candidate}" read better once`);
        return { what: changed ? "changed" : "measured", atMs, why: reason, from: was, way: inForce.name, better: candidate, means: r.means.map((v) => ({ way: v.way, msAField: v.msAField, failed: v.failed })), blocks: r.blocks, fieldsMeasured: r.fieldsMeasured };
      }
      // The watch: the clock on for two fields of every sixteen.
      const phase = field++ & 15;
      if (phase === 13) { x.n64_rdp_thread_clock(1); from = busy(); commandsFrom = commands(); return null; }
      if (phase === 15) {
        const c = commands(), ms = aField(busy() - from, c[0] - commandsFrom[0], c[1] - commandsFrom[1], 2);
        x.n64_rdp_thread_clock(0);
        watch.push(ms);
        if (watch.length > samples) watch.shift();
        if (watch.length === samples && baseline === null) baseline = median(watch);
        if (baseline !== null && median(watch) > baseline + worse) { const was = baseline, is = median(watch); again("the way in force has grown worse"); return { what: "worse", atMs, way: inForce.name, whenChosenMsAField: was, nowMsAField: is }; }
      }
      if (now() - measuredAt >= everyMs && phase === 15) { again("the timer"); return null; }
      return null;
    },
  };
}

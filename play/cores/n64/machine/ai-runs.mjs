// The host's side of the AI, as far as it needs no part of Node: the calls the core offers for sound, and the
// video clock's arithmetic done a second time here (so a test does not check the core against itself).
// tools/ai-host.mjs gives the tools these and what reads and writes files.
//
//   const ai = aiOf(core);  ai.setTv(1);  ...  const runs = ai.takeRuns();
//
// A run is so many sample periods of one length in a row: either frames read from main memory
// (left, right, 16 bits each) or silence, when nothing was playing.

export const AI = { BASE: 0x04500000, DRAM_ADDR: 0x04500000, LEN: 0x04500004, CONTROL: 0x04500008, STATUS: 0x0450000C, DACRATE: 0x04500010, BITRATE: 0x04500014 };
export const MI = { INTR: 0x04300008, MASK: 0x0430000C, AI_BIT: 0x04 };
export const STATUS = { FULL: 0x80000001, BUSY: 0x40000000, ENABLED: 0x02000000, ALWAYS: 0x01100000, WORD_CLOCK: 0x00080000, BIT_CLOCK: 0x00010000, COUNT: 0x00007FFE };
export const TV = { PAL: 0, NTSC: 1, MPAL: 2 };
export const TV_NAME = ["PAL", "NTSC", "MPAL"];

// The video clock of each television type against the core's tick of 1/187,500,000 s: `n` of its
// cycles last `d` ticks. In Hz: NTSC 48,681,818.18 (1071/22 MHz), PAL 49,656,530, MPAL 48,628,322.
export const VIDEO_CLOCK = [
  { n: 4965653n, d: 18750000n, hz: [49656530, 1] },
  { n: 1071n, d: 4125n, hz: [535500000, 11] },
  { n: 24314161n, d: 93750000n, hz: [48628322, 1] },
];
export const cyclesAt = (tv, tick) => (BigInt(tick) * VIDEO_CLOCK[tv].n) / VIDEO_CLOCK[tv].d;
export const tickOf = (tv, cycles) => { const { n, d } = VIDEO_CLOCK[tv]; return (BigInt(cycles) * d + n - 1n) / n; };
export const rateOf = (tv, period) => VIDEO_CLOCK[tv].hz[0] / VIDEO_CLOCK[tv].hz[1] / period;

// The rules the sources dispute, as the core's own switches (core/parts/ai.h). Zero is the side a console
// took, or the core's choice where none has been asked.
export const RULE = { PERIOD_TWO_HALVES: 0, PERIOD_AS_WRITTEN: 1, PERIOD_PLUS_TWO: 2, PERIOD_PLUS_ONE: 3, IRQ_AT_END: 4, FULL_DROPS: 8, ZERO_IGNORED: 16, OVERSIZE_IGNORED: 32, CARRY_DROPPED: 64 };
// The sample period for a DAC rate setting, in video-clock cycles: twice (half the setting, rounded down, plus one).
export const periodOf = (dacRate) => 2 * (Math.floor(dacRate / 2) + 1);

export function aiOf(core) {
  const { x, machine } = core;
  const ROOM = 4096;                         // frames taken in one call
  const at = core.alloc(ROOM * 4);
  const ai = {
    setTv(tv) { x.n64_ai_set_tv(machine, tv); },
    tv() { return x.n64_ai_tv(machine); },
    setRules(bits) { x.n64_ai_set_rules(machine, bits); },
    rules() { return x.n64_ai_rules(machine); },
    clockHz() { return [x.n64_ai_clock_num(machine), x.n64_ai_clock_den(machine)]; },
    lost() { return Number(x.n64_ai_lost(machine)); },
    waiting() { return Number(x.n64_ai_waiting(machine)); },
    counts() { return { fetches: Number(x.n64_ai_fetches(machine)), framesPlayed: Number(x.n64_ai_frames_played(machine)), interrupts: Number(x.n64_ai_interrupts(machine)), registerWrites: x.n64_ai_writes(machine) }; },
    // Everything made since the last take, as runs. Takes that continue one run are joined again.
    takeRuns(into = []) {
      for (;;) {
        // Silence is taken whole, as a count; sound a few thousand frames at a time.
        const quiet = Number(BigInt.asUintN(64, x.n64_ai_take_silence(machine)));
        const n = quiet || x.n64_ai_take(machine, at, ROOM);
        if (n === 0) break;
        const period = x.n64_ai_taken_period(machine), silent = x.n64_ai_taken_silent(machine) !== 0, start = BigInt.asUintN(64, x.n64_ai_taken_start(machine));
        const frames = silent ? null : new Int16Array(core.x.memory.buffer.slice(at, at + n * 4));
        const last = into[into.length - 1];
        if (last && last.silent === silent && last.period === period && last.start + BigInt(last.count) * BigInt(period) === start) {
          if (!silent) { const joined = new Int16Array(last.frames.length + frames.length); joined.set(last.frames); joined.set(frames, last.frames.length); last.frames = joined; }
          last.count += n;
        } else into.push({ start, tick: BigInt.asUintN(64, x.n64_ai_taken_tick(machine)), period, silent, count: n, frames });
      }
      return into;
    },
  };
  return ai;
}

// Joins the runs of one rate into one stretch of sound, silence included, and says what was left out.
// Runs before the first sound and after the last are dropped unless `keepEdges` is set.
export function joinRuns(runs, { keepEdges = false } = {}) {
  let list = runs;
  if (!keepEdges) {
    const first = list.findIndex((r) => !r.silent), lastAt = list.length - 1 - [...list].reverse().findIndex((r) => !r.silent);
    list = first < 0 ? [] : list.slice(first, lastAt + 1);
  }
  const periods = [...new Set(list.map((r) => r.period))];
  const total = list.reduce((n, r) => n + r.count, 0);
  const out = new Int16Array(total * 2);
  let at = 0, gaps = 0;
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    if (i > 0 && list[i - 1].start + BigInt(list[i - 1].count) * BigInt(list[i - 1].period) !== r.start) gaps++;
    if (!r.silent) out.set(r.frames, at * 2);
    at += r.count;
  }
  return { frames: out, count: total, periods, gaps, sound: list.filter((r) => !r.silent).reduce((n, r) => n + r.count, 0), silence: list.filter((r) => r.silent).reduce((n, r) => n + r.count, 0) };
}

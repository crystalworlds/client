// The console's sound at the sound device's rate. It imports nothing and keeps no clock: it turns the sample
// frames the console sent, in the order sent, into frames at the device's rate, and nothing else.
//
// Sound stays pure. Every frame out is made from the console's frames around it by one fixed filter; no frame is
// made up where the console sent none, nothing is stretched or squeezed to fit the time, and a stretch of silence
// the console sent (its count of quiet sample periods) is silence here. So when the machine runs below full speed
// fewer frames come, the device's queue runs dry, and the sound breaks and resumes: it stutters, as it should.
//
// The filter: a windowed sinc (Blackman window) of 2 x TAPS console frames, its cut at the lower of the two
// rates' halves, kept as a table of PHASES places between two console frames: an output frame takes the nearest,
// at most 1/(2 x PHASES) of a console frame from its own place.
// The site's own sound engine resamples a core that does not by a straight line between two frames; that would
// fold the console's high notes back down into the sound, so this core resamples itself (Core API 1.0:
// LoadResult.audio.rate 0, and env.audioRate() the device's rate).

export const TAPS = 16, PHASES = 1024;

const blackman = (x) => 0.42 + 0.5 * Math.cos(Math.PI * x) + 0.08 * Math.cos(2 * Math.PI * x);   // x from -1 to 1
const sinc = (x) => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));

// A resampler to `outRate`. push(frames, inRate): Int16Array of left and right in turn, at the console's rate for
// this stretch. take(): the frames ready at the device's rate, as an Int16Array of left and right in turn. A new
// input rate starts a new stretch: what was held of the old one is let out first, so no frame is lost or doubled.
export function makeResampler(outRate) {
  let table = null, rate = 0, held = new Float32Array(0), heldFrames = 0, base = 0, place = 0, out = [], outN = 0;
  // held[i] is input frame base + i; place is the next output frame's place in input frames, from frame 0 of the stretch.
  const value = (k, ch) => { const i = k - base; return i >= 0 && i < heldFrames ? held[i * 2 + ch] : 0; };
  // The filter's weights for each phase p (the output frame p / PHASES of a frame past a console frame), tap by tap.
  const makeTable = () => {
    const cut = Math.min(1, outRate / rate), t = new Float32Array((PHASES + 1) * 2 * TAPS);
    for (let p = 0; p <= PHASES; p++) for (let j = 0; j < 2 * TAPS; j++) { const d = p / PHASES + TAPS - 1 - j; t[p * 2 * TAPS + j] = blackman(d / TAPS) * cut * sinc(cut * d); }
    return t;
  };
  const emit = (upTo) => {
    const step = rate / outRate;
    table ??= makeTable();
    while (place <= upTo) {
      const centre = Math.floor(place), row = Math.round((place - centre) * PHASES) * 2 * TAPS;
      let l = 0, r = 0;
      for (let j = 0, k = centre - TAPS + 1; j < 2 * TAPS; j++, k++) { const w = table[row + j]; l += w * value(k, 0); r += w * value(k, 1); }
      out.push(Math.max(-32768, Math.min(32767, Math.round(l))), Math.max(-32768, Math.min(32767, Math.round(r))));
      outN++;
      place += step;
    }
  };
  // Lets out what the frames held allow, and drops the frames no output frame will need again.
  const settle = () => {
    emit(base + heldFrames - 1 - TAPS);
    const keepFrom = Math.max(base, Math.floor(place) - TAPS + 1), drop = keepFrom - base;
    if (drop > 0) { held = held.slice(drop * 2); heldFrames -= drop; base = keepFrom; }
  };
  const self = {
    push(frames, inRate) {
      if (!(inRate > 0) || !frames.length) return;
      if (rate && Math.abs(inRate - rate) > 1e-9) self.flush();
      if (!rate) { rate = inRate; base = 0; place = 0; heldFrames = 0; held = new Float32Array(0); }
      const n = frames.length >> 1, next = new Float32Array((heldFrames + n) * 2);
      next.set(held.subarray(0, heldFrames * 2)); for (let i = 0; i < n * 2; i++) next[heldFrames * 2 + i] = frames[i];
      held = next; heldFrames += n;
      settle();
    },
    // The end of a stretch: the frames held are let out against silence after them, as the console's last
    // frames are followed by nothing of this stretch.
    flush() {
      if (rate) emit(base + heldFrames - 1);
      rate = 0; table = null; heldFrames = 0; held = new Float32Array(0); base = 0; place = 0;
    },
    take() { const r = Int16Array.from(out); out = []; return r; },
    get made() { return outN; },
  };
  return self;
}

/* data-recorder.js -- the page side of the Famicom Data Recorder (HVC-008).
 *
 *
 * The core plays and records the tape (src/nes.c, nes_dr_*); this module only
 * turns files into the one form the core takes -- 8-bit unsigned mono PCM,
 * 128 = silence -- and a recording back into a file a person can keep.
 *
 *   decodeTape(bytes)          -> { pcm: Uint8Array, rate, seconds }
 *       WAV, PCM 8/16/24/32-bit integer or 32-bit float, any channel count
 *       (averaged), any rate the core takes (4,000-192,000 Hz).  Every known
 *       Family BASIC / Data Recorder dump is a WAV; a file that is not one is
 *       refused with a sentence a person can read.
 *   encodeWav(pcm, rate)       -> Uint8Array   (8-bit mono PCM WAV)
 *   class Deck                 -- a tape deck bound to a NesCore:
 *       deck.load(bytes, name) / deck.eject()
 *       deck.play() / deck.stop() / deck.record() / deck.rewind() / deck.seek(s)
 *       deck.state             -- { mode, seconds, length, ... } for a display
 *       deck.save(name)        -- { name, bytes } of what RECORD made, as WAV
 *
 * The deck works only while the keyboard is attached (its jacks are on the
 * keyboard): core.kbAttached.  Family BASIC: type LOAD (RETURN), then PLAY;
 * SAVE "NAME" (RETURN) with RECORD pressed first.
 */

export const TAPE_EXT = /\.wav$/i;

const tag = (b, o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
const u16 = (b, o) => b[o] | b[o + 1] << 8;
const u32 = (b, o) => (b[o] | b[o + 1] << 8 | b[o + 2] << 16 | b[o + 3] << 24) >>> 0;

export function decodeTape(input) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (b.length < 12 || tag(b, 0) !== 'RIFF' || tag(b, 8) !== 'WAVE')
    throw new Error('This is not a tape recording (a WAV file was expected).');
  let o = 12, fmt = 0, ch = 0, rate = 0, bits = 0, data = -1, dlen = 0;
  while (o + 8 <= b.length) {
    const id = tag(b, o), n = u32(b, o + 4);
    if (id === 'fmt ' && n >= 16) {
      fmt = u16(b, o + 8); ch = u16(b, o + 10); rate = u32(b, o + 12); bits = u16(b, o + 22);
      if (fmt === 0xFFFE && n >= 40) fmt = u16(b, o + 32);          /* WAVE_FORMAT_EXTENSIBLE */
    } else if (id === 'data') { data = o + 8; dlen = Math.min(n, b.length - data); break; }
    o += 8 + n + (n & 1);
  }
  const intOk = fmt === 1 && (bits === 8 || bits === 16 || bits === 24 || bits === 32);
  const floatOk = fmt === 3 && bits === 32;
  if (data < 0 || !(intOk || floatOk) || ch < 1)
    throw new Error('This WAV file is not plain PCM audio, so it cannot be played as a tape.');
  if (rate < 4000 || rate > 192000) throw new Error(`This tape's sample rate (${rate} Hz) is outside what the deck plays.`);
  const bps = bits / 8, frame = bps * ch, n = Math.floor(dlen / frame);
  const pcm = new Uint8Array(n);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let c = 0; c < ch; c++) {
      const p = data + i * frame + c * bps;
      let v;                                                       /* -1 .. +1 */
      if (floatOk) v = dv.getFloat32(p, true);
      else if (bits === 8) v = (b[p] - 128) / 128;
      else if (bits === 16) v = dv.getInt16(p, true) / 32768;
      else if (bits === 24) v = ((b[p] | b[p + 1] << 8 | b[p + 2] << 16) << 8 >> 8) / 8388608;
      else v = dv.getInt32(p, true) / 2147483648;
      acc += v;
    }
    const s = Math.round(acc / ch * 128 + 128);
    pcm[i] = s < 0 ? 0 : s > 255 ? 255 : s;
  }
  return { pcm, rate, seconds: n / rate };
}

export function encodeWav(pcm, rate) {
  const out = new Uint8Array(44 + pcm.length), dv = new DataView(out.buffer);
  const put = (o, s) => { for (let i = 0; i < 4; i++) out[o + i] = s.charCodeAt(i); };
  put(0, 'RIFF'); dv.setUint32(4, 36 + pcm.length, true); put(8, 'WAVE');
  put(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true); dv.setUint32(28, rate, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
  put(36, 'data'); dv.setUint32(40, pcm.length, true);
  out.set(pcm, 44);
  return out;
}

export class Deck {
  constructor(core, { blankSeconds = 300 } = {}) { this.core = core; this.blankSeconds = blankSeconds; this.name = ''; this.rate = 32000; }
  get available() { return !!(this.core && this.core.hasDataRecorder && this.core.kbAttached); }
  load(bytes, name = '') {
    const t = decodeTape(bytes);
    const e = this.core.drInsert(t.pcm, t.rate);
    if (e) throw new Error('The deck refused this tape.');
    this.name = name; this.rate = t.rate;
    return t;
  }
  eject() { this.core.drEject(); this.name = ''; }
  play()   { return this.core.drPlay() === 1; }
  stop()   { this.core.drStop(); }
  rewind() { this.core.drStop(); this.core.drSeek(0); }
  seek(seconds) { this.core.drSeek(Math.max(0, Math.round(seconds * this.rate))); }
  /* RECORD onto a fresh blank tape (the inserted tape, if any, is untouched:
   * a recording is always a new tape image). */
  record() {
    const e = this.core.drBlank(this.blankSeconds, this.core.drState.tape ? this.core.drState.rate : this.rate);
    if (e) throw new Error('The deck could not make a blank tape.');
    return this.core.drRecord() === 2;
  }
  get state() {
    const s = this.core.drState;
    const rate = s.rate || this.rate;
    return { ...s, name: this.name, seconds: (s.mode === 'record' ? s.recorded : s.head) / rate,
             length: s.samples / rate, recordedSeconds: s.recorded / rate };
  }
  save(name = 'tape') {
    const pcm = this.core.drRecording();
    if (!pcm.length) return null;
    return { name: /\.wav$/i.test(name) ? name : name + '.wav', bytes: encodeWav(pcm, this.core.drState.rate || this.rate) };
  }
}

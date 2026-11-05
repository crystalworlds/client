/* studybox-deck.js — the page side of the Study Box tape deck (NES mapper 186).
 *
 * The core plays the tape; this module only FEEDS it, and it
 * is written so a 150-170 MB tape is NEVER held whole in memory:
 *
 *   1. THE INDEX. The tape's chunk headers are read one by one (8 bytes each),
 *      then its WAV header, to find where the audio's samples start. Only the
 *      file's PREFIX up to that point -- the header and every data page, 1-3 MB
 *      on the twelve known tapes -- is copied into the core's memory and lent
 *      with nes_studybox_insert(ctx, ptr, prefixLength, fileLength). The core
 *      sees "detached" audio (prefixLength < fileLength).
 *   2. THE AUDIO, streamed. A ring of RING_SECONDS of samples lives in core
 *      memory (nes_studybox_audio_ring). Every frame the page reads the
 *      playing position (nes_studybox_deck 15) and keeps the next AHEAD_SECONDS
 *      in the ring, reading the file in BLOCK_SECONDS blocks, asynchronously,
 *      and declares what is there (nes_studybox_audio_have). A sample the core
 *      needs that is not there plays as silence and is counted (deck 22).
 *   3. THE CUE. When the deck finds a page it keeps playing the old position
 *      through the page's lead-in (0.3 s or more on every known tape) and then
 *      JUMPS to the page's data offset. While the lead-in runs, deck 26 names
 *      that sample; the page reads CUE_SAMPLES from there and lends them with
 *      nes_studybox_audio_cue, so the jump never lands on an empty ring.
 *
 * A SOURCE is { name, size, read(offset, length) -> Promise<Uint8Array> }.
 * fileSource(File) is the local one (File.slice: the browser reads only the
 * bytes asked for). Any other source -- a host relay, a game server's HTTP
 * Range reads -- only has to answer read().
 *
 * MEMORY: the prefix (1-3 MB) + the ring (RING_SECONDS x 44,100 x 2 bytes,
 * 1.4 MB at 16 s) + the cue (16 KB) in core memory, and at most the blocks in
 * flight in JavaScript. The core's allocator never frees, so the regions are
 * allocated once per core instance and reused by the next tape when they fit.
 *
 * MEASURED in the core's own tests (studytape --detached): the core's audio out
 * of a per-frame ring host is sample-identical to the whole file lent at once.
 */

export const TAPE_EXT = /\.(study|studybox)$/i;
export const RING_SECONDS = 16, AHEAD_SECONDS = 6, BLOCK_SECONDS = 1, CUE_SAMPLES = 8192;

const u32 = (b, o) => (b[o] | b[o + 1] << 8 | b[o + 2] << 16 | b[o + 3] << 24) >>> 0;
const tag = (b, o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);

export function fileSource(file) {
  return {
    name: file.name, size: file.size, file,
    async read(offset, length) {
      const end = Math.min(file.size, offset + length);
      if (end <= offset) return new Uint8Array(0);
      return new Uint8Array(await file.slice(offset, end).arrayBuffer());
    },
  };
}

/* Walk the container's chunk headers: returns { prefix, rate, samples,
 * pages } where prefix is the byte offset of the first audio sample. Throws a
 * plain sentence on a file that is not a Study Box tape. Reads a few hundred
 * bytes per page, never a page's contents. */
export async function indexTape(src) {
  const h = await src.read(0, 12);
  if (h.length < 12 || tag(h, 0) !== 'STBX') throw new Error('This is not a Study Box tape (no STBX header).');
  if (u32(h, 4) !== 4 || u32(h, 8) !== 0x100) throw new Error('This Study Box tape is a format version this player does not read.');
  let o = 12, pages = 0;
  while (o + 8 <= src.size) {
    const c = await src.read(o, 8);
    const id = tag(c, 0), len = u32(c, 4);
    if (id === 'PAGE') { pages++; o += 8 + len; continue; }
    if (id !== 'AUDI') throw new Error(`This Study Box tape has an unknown part (${JSON.stringify(id)}).`);
    const a = await src.read(o + 8, 4 + 4096);
    if (u32(a, 0) !== 0) throw new Error('This Study Box tape\'s audio is not a WAV file; only WAV is played.');
    const w = a.subarray(4);
    if (tag(w, 0) !== 'RIFF' || tag(w, 8) !== 'WAVE') throw new Error('This Study Box tape\'s audio is not a WAV file.');
    let p = 12, rate = 0;
    while (p + 8 <= w.length) {
      const cid = tag(w, p), n = u32(w, p + 4);
      if (cid === 'fmt ') {
        const fmt = w[p + 8] | w[p + 9] << 8, ch = w[p + 10] | w[p + 11] << 8, bits = w[p + 22] | w[p + 23] << 8;
        rate = u32(w, p + 12);
        if (fmt !== 1 || ch !== 1 || bits !== 16) throw new Error('This Study Box tape\'s audio is not 16-bit mono PCM.');
      } else if (cid === 'data') {
        const prefix = o + 12 + p + 8;
        return { prefix, rate, samples: Math.floor(Math.min(n, src.size - prefix) / 2), pages };
      }
      p += 8 + n + (n & 1);
    }
    throw new Error('This Study Box tape\'s audio header is not in its first 4 KB.');
  }
  throw new Error('This Study Box tape has no audio part.');
}

/* The deck feeder for one core instance. */
export class TapeFeeder {
  constructor(core) {
    this.core = core; this.x = core.x; this.ctx = core.ctx;
    this.src = null; this.idx = null;
    this.pPrefix = 0; this.prefixCap = 0;
    this.ringLen = 0; this.pRing = 0; this.pCue = 0;
    this.haveLo = 0; this.haveHi = 0; this.wantHi = 0; this.inflight = 0;
    this.cueAt = -1; this.gen = 0;
  }
  static supported(core) {
    const x = core && core.x;
    return !!(x && ['nes_studybox_insert', 'nes_studybox_eject', 'nes_studybox_audio_ring', 'nes_studybox_audio_have',
                    'nes_studybox_audio_cue', 'nes_studybox_deck'].every(n => typeof x[n] === 'function'));
  }
  get mounted() { return !!(this.core && this.core.ctx && this.core.mapper === 186); }
  get present() { return this.mounted && this.x.nes_studybox_deck(this.ctx, 0) === 1; }
  deck(i) { return this.x.nes_studybox_deck(this.ctx, i) >>> 0; }

  /* Insert a tape. Returns the index ({ pages, rate, samples, prefix }). */
  async insert(src) {
    const idx = await indexTape(src);
    const prefix = await src.read(0, idx.prefix);
    if (prefix.length !== idx.prefix) throw new Error('The tape could not be read.');
    const c = this.core;
    if (this.prefixCap < prefix.length) { this.pPrefix = c._alloc(prefix.length); this.prefixCap = prefix.length; }
    c.u8.set(prefix, this.pPrefix);
    const r = this.x.nes_studybox_insert(this.ctx, this.pPrefix, prefix.length, src.size);
    if (r !== 0) {
      const why = { 1: 'this core has no tape deck', 2: 'the cartridge is not the Study Box', 3: 'the tape is damaged',
                    4: 'the tape has more pages than the deck takes', 5: 'the tape\'s audio is not 16-bit mono WAV' }[r] || `code ${r}`;
      throw new Error(`The Study Box did not take the tape: ${why}.`);
    }
    const want = RING_SECONDS * (idx.rate || 44100);
    if (this.ringLen < want) { this.pRing = c._alloc(want * 2); this.ringLen = want; }
    if (!this.pCue) this.pCue = c._alloc(CUE_SAMPLES * 2);
    this.x.nes_studybox_audio_ring(this.ctx, this.pRing, this.ringLen);
    this.src = src; this.idx = idx; this.gen++;
    this.haveLo = this.haveHi = this.wantHi = 0; this.inflight = 0; this.cueAt = -1;
    return idx;
  }
  eject() {
    if (this.mounted) this.x.nes_studybox_eject(this.ctx);
    this.src = null; this.idx = null; this.gen++;
  }

  /* Once per emulated frame (or batch), BEFORE running it. Synchronous: it
   * starts reads and returns; their samples land in the ring when they arrive. */
  tick() {
    if (!this.src || !this.mounted) return;
    const pos = this.deck(15), jump = this.deck(26), total = this.idx.samples;
    if (jump !== 0xFFFFFFFF && jump !== this.cueAt) {
      this.cueAt = jump;
      const g = this.gen;
      this.src.read(this.idx.prefix + jump * 2, CUE_SAMPLES * 2).then(b => {
        if (g !== this.gen) return;
        const n = b.length >> 1;
        const view = new Int16Array(this.core.mem.buffer, this.pCue, CUE_SAMPLES);
        view.set(new Int16Array(b.buffer, b.byteOffset, n));
        this.x.nes_studybox_audio_cue(this.ctx, this.pCue, jump, n);
      }).catch(() => {});
    }
    if (pos === 0xFFFFFFFF) return;
    const rate = this.idx.rate || 44100;
    /* a jump (or the first sound): restart the window at the position */
    if (pos < this.haveLo || pos > this.haveHi) { this.haveLo = this.haveHi = this.wantHi = pos; this.gen++; this.inflight = 0; }
    const target = Math.min(total, pos + AHEAD_SECONDS * rate);
    while (this.wantHi < target && this.inflight < 4) {
      const from = this.wantHi, to = Math.min(target, from + BLOCK_SECONDS * rate);
      this.wantHi = to; this.inflight++;
      const g = this.gen;
      this.src.read(this.idx.prefix + from * 2, (to - from) * 2).then(b => {
        if (g !== this.gen) return;
        this.inflight--;
        /* Blocks are asked for in order and a source answers in order (File
           reads and the relay both do); one out of order is dropped and asked
           again by the next tick rather than leaving a hole in the window. */
        if (from !== this.haveHi) { this.wantHi = this.haveHi; return; }
        const n = (b.length >> 1);
        const src16 = new Int16Array(b.buffer, b.byteOffset, n);
        const ring = new Int16Array(this.core.mem.buffer, this.pRing, this.ringLen);
        for (let i = 0; i < n; i++) ring[(from + i) % this.ringLen] = src16[i];
        this.haveHi = from + n;
        if (this.haveHi - this.haveLo > this.ringLen) this.haveLo = this.haveHi - this.ringLen;
        this.x.nes_studybox_audio_have(this.ctx, this.haveLo, this.haveHi);
      }).catch(() => { if (g === this.gen) { this.inflight--; this.wantHi = this.haveHi; } });
    }
  }

  status() {
    if (!this.mounted) return null;
    return { present: this.present, name: this.src ? this.src.name : null, motor: this.deck(1), page: this.deck(18),
             pages: this.deck(24), playing: this.deck(15) !== 0xFFFFFFFF, underruns: this.deck(22) };
  }
}

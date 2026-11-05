/* =====================================================================
 *  remux.js  —  client-side MKV -> fragmented-MP4 remux for the Video page
 *
 *  The user's Chrome already DECODES the codecs inside these files (HEVC,
 *  H.264, AAC, Opus, FLAC). What it can't do is play a Matroska (.mkv)
 *  container from a <video src>. So this module copies the already-encoded
 *  video and audio packets into a fragmented MP4 (moov up front) with
 *  mediabunny (pure JS, no WASM, no re-encode) and feeds the fragments to a
 *  Media Source Extensions <video> as they stream in. No server transcoding,
 *  no full download: mediabunny reads the .mkv over HTTP range requests.
 *
 *  Public API:
 *    remuxSupport(mediaSource) -> { ok, reason? }
 *    remuxToVideo(url, videoEl, opts) -> { destroy(), ready }
 * ===================================================================== */

import {
  Input, Output, Conversion, UrlSource,
  Mp4OutputFormat, AppendOnlyStreamTarget, ALL_FORMATS,
  EncodedPacket, EncodedPacketSink, EncodedVideoPacketSource, EncodedAudioPacketSource,
} from './vendor/mediabunny.mjs';

/* ------------------------------------------------------------------ *
 *  WASM Dolby audio decode (E-AC3 / AC3 / DTS)
 *
 *  Chrome has no decoder for Dolby / DTS audio, so those tracks used to
 *  play silent. This module now decodes them with a small self-hosted
 *  libav.js build (the "dolby" variant: eac3 + ac3 + dca decoders only,
 *  ~1.2 MB across .mjs + .wasm.js + .wasm), re-encodes the PCM to AAC (or
 *  Opus) with the browser's WebCodecs AudioEncoder, and muxes that back
 *  into the same fragmented MP4 as the copied video. Everything is lazy:
 *  the libav.js wasm is only imported the first time a Dolby file is
 *  opened, never for ordinary files.
 * ------------------------------------------------------------------ */

// Emby audio Codec -> in-app decoder name. eac3/ac3 are native; dts is `dca`
// (all three libav.js). 'mp2' is MPEG-1/2 Layer II, decoded by vendor/mp2dec.mjs
// in plain JavaScript (2026-10-10: TV recordings carry it and no browser
// decodes it). Keep in sync with DOLBY_DECODER in emby.js.
const DOLBY_DECODER = {
  ac3: 'ac3', 'ac-3': 'ac3',
  eac3: 'eac3', 'e-ac-3': 'eac3',
  dts: 'dca', dca: 'dca', 'dts-hd': 'dca', dtshd: 'dca',
  mp2: 'mp2', mp2a: 'mp2', 'mpeg-1 layer 2': 'mp2',
};

/* One decoder interface for the audio pump, whichever engine is behind it:
     decode(packetBytes, ptsSamples, sampleRate) -> frames, flush() -> frames,
     free(). A frame is libav's shape: { nb_samples, sample_rate, channels,
     data: [planar Float32Array per channel] } (or packed data, see the downmix).
   MP2 needs no WASM at all: the JS decoder is ~25 KB and lazy-imported. */
const MP2DEC_URL = './vendor/mp2dec.mjs?v=2.0.0';

/* A/V sync diagnostics for the decode-here audio path (2026-10-10). The
   re-encoded audio is timed by a running sample count from the first packet;
   the container's own packet times are the truth. driftMaxMs is the largest
   gap seen between the two, so a drift is a number, not a hunch. Read by the
   player tests (import this module, read audioPumpStats). */
export const audioPumpStats = { decoder: null, packets: 0, frames: 0, driftMs: 0, driftMaxMs: 0 };
async function openAudioDecoder(name) {
  if (name === 'mp2') {
    const mod = await import(MP2DEC_URL);
    const dec = new mod.Mp2Decoder();
    return {
      decode: async (data) => dec.decode(data instanceof Uint8Array ? data : new Uint8Array(data)),
      decodeMany: async (list) => { const fr = []; for (const p of list) fr.push(...dec.decode(p.data instanceof Uint8Array ? p.data : new Uint8Array(p.data))); return fr; },
      flush: async () => [],
      free: async () => {},
    };
  }
  const libav = await ensureLibav();
  const [, c, pkt, frame] = name === 'dca' ? await openDcaCore(libav) : await libav.ff_init_decoder(name);
  return {
    // ignoreErrors (24 Oct): a damaged frame is skipped, as a desktop player does, instead
    // of throwing and ending the whole title.
    decode: (data, pts, sampleRate) => libav.ff_decode_multi(c, pkt, frame,
      [{ data, pts, ptshi: 0, time_base_num: 1, time_base_den: sampleRate, stream_index: 0 }], { fin: false, ignoreErrors: true }),
    // Several packets in ONE call to the libav worker (28 Oct): see AUDIO_BATCH_SEC.
    decodeMany: (list, sampleRate) => libav.ff_decode_multi(c, pkt, frame,
      list.map(p => ({ data: p.data, pts: p.pts, ptshi: 0, time_base_num: 1, time_base_den: sampleRate, stream_index: 0 })), { fin: false, ignoreErrors: true }),
    flush: () => libav.ff_decode_multi(c, pkt, frame, [], true).catch(() => []),
    free: () => libav.ff_free_decoder(c, pkt, frame),
  };
}

/* DTS: THE CORE ONLY (24 Oct 2026). A DTS-HD Master Audio track is a lossy DTS
   core plus a lossless extension, and libav decodes both unless told not to. Every track
   decoded here is folded down to stereo AAC (frameToStereoAudioData), so the lossless part
   is thrown away anyway, yet decoding it is most of the work: the census of 15 Oct measured
   the 4K Dolby Vision films with DTS-HD MA (TMNT II and III) at 12 to 15 frames a second,
   while the 4K film without DTS played at full rate. The decoder's own "core_only" option
   decodes the core alone (the sound a DTS-only player gives). If the option is refused the
   decoder opens as before. */
async function openDcaCore(libav) {
  const codec = await libav.avcodec_find_decoder_by_name('dca');
  if (!codec) return libav.ff_init_decoder('dca');
  const c = await libav.avcodec_alloc_context3(codec);
  let ok = -1;
  try { ok = await libav.av_opt_set(c, 'core_only', '1', 1 /* AV_OPT_SEARCH_CHILDREN */); } catch {}
  audioPumpStats.coreOnly = ok >= 0;
  const r = await libav.avcodec_open2(c, codec, 0);
  if (r < 0) { try { await libav.avcodec_free_context_js(c); } catch {} return libav.ff_init_decoder('dca'); }
  const pkt = await libav.av_packet_alloc(), frame = await libav.av_frame_alloc();
  return [codec, c, pkt, frame];
}

/* AUDIO IN BATCHES (28 Oct 2026). The decoder lives in libav's own worker, and
   every call to it is a message there and back. The pump used to make one call per packet:
   a DTS packet is 512 samples, so 94 calls a second, and each answer waits its turn on the
   page's main thread behind the video copy. Measured with a 4K stand-in film (30 s, H.264
   40 Mb/s + DTS-HD MA 5.1, headless Chrome 1440x900 on the desk PC): the decoder alone runs
   at 27 times real time, yet the pump reached only 1.5 times real time, and 0.2 times with
   the CPU slowed four-fold (a phone-class main thread), the same 41 s for 9 s of sound as the
   TMNT II check of 26 Oct. Now the pump gathers packets and decodes them in one call: the
   first calls are short so the sound starts at once, then each call carries up to
   AUDIO_BATCH_SEC of sound (at most AUDIO_BATCH_MAX packets). Timing is unchanged: samples
   are still counted from the first packet, and the drift check runs per call. */
const AUDIO_BATCH_SEC = 0.5, AUDIO_BATCH_MAX = 64, AUDIO_ENC_QUEUE_MAX = 96;

// One shared libav.js instance for the whole page (in its own Web Worker), so
// seeks and successive files reuse it. Imported only on first Dolby open.
const LIBAV_URL = './vendor/libav-6.9.9.0-dolby.mjs';
let _libav = null;
let _libavPromise = null;
function ensureLibav() {
  if (_libav) return Promise.resolve(_libav);
  if (!_libavPromise) {
    _libavPromise = import(LIBAV_URL)
      .then(mod => (mod.default || mod).LibAV({ noworker: false }))
      .then(l => { _libav = l; return l; })
      .catch(e => { _libavPromise = null; throw e; });
  }
  return _libavPromise;
}

// Pick the re-encode target once: prefer AAC-LC (mp4a.40.2) at a bitrate Chrome
// accepts, fall back to Opus. Returns { name, mseCodec, encConfig } or null if
// neither can be configured. Stereo out (we downmix surround, see frameToStereo).
async function pickAudioTarget(sampleRate) {
  const sr = sampleRate || 48000;
  const candidates = [
    { name: 'aac',  mseCodec: 'mp4a.40.2', encConfig: { codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: 2, bitrate: 192000 } },
    { name: 'opus', mseCodec: 'opus',      encConfig: { codec: 'opus',      sampleRate: sr, numberOfChannels: 2, bitrate: 256000 } },
  ];
  for (const c of candidates) {
    try {
      if (typeof AudioEncoder === 'undefined') break;
      const s = await AudioEncoder.isConfigSupported(c.encConfig);
      if (s && s.supported) { audioPumpStats.encoder = 'webcodecs-' + c.name; return c; }
    } catch {}
  }
  // No WebCodecs encoder (a page over plain http, 25 Oct): FLAC packed here,
  // when this browser's MediaSource takes FLAC in MP4.
  try {
    if (globalThis.MediaSource && MediaSource.isTypeSupported('audio/mp4; codecs="flac"')) {
      audioPumpStats.encoder = 'flac-js';
      return { name: 'flac', mseCodec: 'flac', js: true, encConfig: { codec: 'flac', sampleRate: sr, numberOfChannels: 2 } };
    }
  } catch {}
  return null;
}

/* CLIPPING (2026-10-15, Emby formats census: MP3 out of the AVI converter and
   DTS-HD MA decoded here both measured peaks of 1.3 to 1.9 at the player, full
   scale being 1.0). Two causes: decoded MP3 carries overs above full scale and
   was passed straight to the AAC encoder, and the 5.1 fold-down summed up to
   2.4 times full scale into a hard clamp. Now the fold-down is normalised (its
   gains sum to 1, as an unnormalised ITU Lo/Ro would not), and every sample
   gets a fixed headroom of -3 dB and then a soft limiter (knee -3 dBFS,
   ceiling -1 dBFS) before the encoder.
   Why the fixed headroom as well (measured the same day): the limiter alone
   still gave peaks of 1.2 to 1.6 at the player, because the AAC encoder
   itself overshoots on loud, dense material. A test signal held at -1 dBFS
   came back from WebCodecs AAC at 192 kb/s with a peak of 1.80 (a sine at the
   same level came back at 0.893). Native AAC files are mastered with that room
   already; tracks re-encoded here were not. The cost is that these tracks play
   about 3 dB quieter than a native AAC track. (Much of the overshoot first
   measured was really the integer-sample fault fixed in
   frameToStereoAudioData.) */
const HEADROOM = 0.708;                          // -3 dB
const LIMIT_KNEE = 0.708, LIMIT_CEIL = 0.891;   // -3 dBFS, -1 dBFS
const _clamp1 = (x0) => {
  const x = x0 * HEADROOM;
  const a = x < 0 ? -x : x;
  if (a <= LIMIT_KNEE) return x;
  const r = LIMIT_CEIL - LIMIT_KNEE;
  const y = LIMIT_KNEE + r * Math.tanh((a - LIMIT_KNEE) / r);
  return x < 0 ? -y : y;
};
const _limitPlane = (p, n) => { for (let i = 0; i < n; i++) p[i] = _clamp1(p[i]); };

// Downmix a decoded libav audio Frame to interleaved-planar stereo Float32 and
// wrap it as a WebCodecs AudioData at the given microsecond timestamp. Handles
// planar (fltp, the Dolby norm) and packed sample data. Surround uses the
// standard ITU Lo/Ro coefficients (LFE dropped); unusual layouts fall back to
// the first two channels.
function frameToStereoAudioData(f, sampleRate, tsMicros) {
  const nb = f.nb_samples;
  const planar = Array.isArray(f.data);
  const nch = f.channels || (planar ? f.data.length : 1);
  /* INTEGER SAMPLES (2026-10-15). The decoders do not all hand back floats:
     the MP3 decoder in the AVI build and the DTS-HD decoder gave integer
     planes, which went to the encoder as if they were floats, thousands of
     times full scale, so those tracks reached the player as a clipped square
     wave (measured peaks 1.3 to 1.9, and the encoder input pinned at the
     limiter's ceiling). Every plane is scaled to -1..1 by its sample type. */
  const toFloat = (src) => {
    if (src instanceof Float32Array || src instanceof Float64Array) return src;
    const o = new Float32Array(src.length);
    if (src instanceof Int16Array) for (let i = 0; i < src.length; i++) o[i] = src[i] / 32768;
    else if (src instanceof Int32Array) for (let i = 0; i < src.length; i++) o[i] = src[i] / 2147483648;
    else if (src instanceof Uint8Array) for (let i = 0; i < src.length; i++) o[i] = (src[i] - 128) / 128;
    else for (let i = 0; i < src.length; i++) o[i] = src[i];
    return o;
  };
  const planes = planar ? f.data.map(toFloat) : null;
  const packed = planar ? null : toFloat(f.data);
  const plane = (ci) => {
    if (planar) return planes[ci];
    // packed: interleaved single typed array, stride = nch
    const src = packed, out = new Float32Array(nb);
    for (let i = 0; i < nb; i++) out[i] = src[i * nch + ci];
    return out;
  };
  const out = new Float32Array(nb * 2); // [L(nb), R(nb)] planar for AudioData
  const L = out.subarray(0, nb), R = out.subarray(nb, nb * 2);
  if (nch === 1) {
    const m = plane(0); L.set(m.subarray(0, nb)); R.set(m.subarray(0, nb));
    _limitPlane(L, nb); _limitPlane(R, nb);
  } else if (nch === 2) {
    L.set(plane(0).subarray(0, nb)); R.set(plane(1).subarray(0, nb));
    _limitPlane(L, nb); _limitPlane(R, nb);
  } else if (nch >= 6) {
    // FL FR FC LFE BL BR (+ any extra ignored). ITU Lo/Ro, LFE dropped,
    // normalised so the three gains sum to 1 (g = 1 / (1 + 2k)).
    const FL = plane(0), FR = plane(1), FC = plane(2), BL = plane(4), BR = plane(5), k = 0.7071, g = 1 / (1 + 2 * k);
    for (let i = 0; i < nb; i++) { L[i] = _clamp1(g * (FL[i] + k * FC[i] + k * BL[i])); R[i] = _clamp1(g * (FR[i] + k * FC[i] + k * BR[i])); }
  } else {
    // 3..5 channels: FL FR FC [..]; fold centre in if present, normalised.
    const FL = plane(0), FR = plane(1), FC = nch >= 3 ? plane(2) : null, k = 0.7071, g = FC ? 1 / (1 + k) : 1;
    for (let i = 0; i < nb; i++) { L[i] = _clamp1(g * (FL[i] + (FC ? k * FC[i] : 0))); R[i] = _clamp1(g * (FR[i] + (FC ? k * FC[i] : 0))); }
  }
  // No WebCodecs at all (25 Oct): the same planes in a plain object for FlacJsEncoder.
  if (typeof AudioData === 'undefined') return { _planes: out, sampleRate, numberOfFrames: nb, numberOfChannels: 2, timestamp: tsMicros, close() {} };
  return new AudioData({ format: 'f32-planar', sampleRate, numberOfFrames: nb, numberOfChannels: 2, timestamp: tsMicros, data: out });
}

/* ------------------------------------------------------------------ *
 *  SOUND WITHOUT WEBCODECS: a small FLAC encoder (25 Oct 2026)
 *
 *  WebCodecs (AudioEncoder, VideoEncoder) exists only in a secure context.
 *  A page opened over plain http (the site's LAN address on port 8080, the
 *  TV's way in) has neither, so every film whose sound is decoded here
 *  (AC-3, E-AC-3, DTS, MP2) stopped with "can't re-encode this audio" and
 *  showed "Can't play this one here". MediaSource is still there over http,
 *  and Chrome's takes FLAC in MP4 (isTypeSupported('audio/mp4;
 *  codecs="flac"') is true on http and https alike). So when no WebCodecs
 *  encoder can be configured, the decoded PCM is packed here as FLAC:
 *  16-bit stereo, fixed 4096-sample blocks, each channel coded with the
 *  best FIXED predictor (order 0 to 4) and one Rice parameter, or stored
 *  verbatim when that is smaller. Lossless, so it adds no encoder overshoot.
 *  It has the AudioEncoder shape the two pumps use (configure,
 *  encode(AudioData), encodeQueueSize, flush, close, state) and hands
 *  mediabunny EncodedPacket objects straight to output(), the first with its
 *  decoderConfig (codec 'flac', description "fLaC" + STREAMINFO), as
 *  WebCodecs would. Only used when AudioEncoder is missing or refuses both
 *  AAC and Opus; a secure page keeps AAC exactly as before.
 * ------------------------------------------------------------------ */
const FLAC_BLOCK = 4096;
const FLAC_SR_CODE = { 88200: 1, 176400: 2, 192000: 3, 8000: 4, 16000: 5, 22050: 6, 24000: 7, 32000: 8, 44100: 9, 48000: 10, 96000: 11 };
const _crc8T = new Uint8Array(256), _crc16T = new Uint16Array(256);
for (let i = 0; i < 256; i++) {
  let c = i; for (let k = 0; k < 8; k++) c = (c & 0x80) ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
  _crc8T[i] = c;
  let d = i << 8; for (let k = 0; k < 8; k++) d = (d & 0x8000) ? ((d << 1) ^ 0x8005) & 0xffff : (d << 1) & 0xffff;
  _crc16T[i] = d;
}
const _crc8 = (b, n) => { let c = 0; for (let i = 0; i < n; i++) c = _crc8T[c ^ b[i]]; return c; };
const _crc16 = (b, n) => { let c = 0; for (let i = 0; i < n; i++) c = ((c << 8) & 0xffff) ^ _crc16T[(c >> 8) ^ b[i]]; return c; };
class _FlacBits {
  constructor(cap) { this.b = new Uint8Array(cap); this.n = 0; this.acc = 0; this.nb = 0; }
  put(v, bits) {                       // the low `bits` (1..31) of v, most significant first
    while (bits > 0) {
      const room = 8 - this.nb, take = bits < room ? bits : room;
      this.acc = (this.acc << take) | ((v >>> (bits - take)) & ((1 << take) - 1));
      this.nb += take; bits -= take;
      if (this.nb === 8) {
        if (this.n >= this.b.length) { const g = new Uint8Array(this.b.length * 2); g.set(this.b); this.b = g; }
        this.b[this.n++] = this.acc; this.acc = 0; this.nb = 0;
      }
    }
  }
  zeros(q) { while (q > 0) { const t = q > 24 ? 24 : q; this.put(0, t); q -= t; } }
  align() { if (this.nb) this.put(0, 8 - this.nb); }
}
function _flacUtf8(w, v) {
  if (v < 0x80) { w.put(v, 8); return; }
  const len = v < 0x800 ? 2 : v < 0x10000 ? 3 : v < 0x200000 ? 4 : v < 0x4000000 ? 5 : 6;
  w.put(((0xff00 >> len) & 0xff) | (v >>> (6 * (len - 1))), 8);
  for (let i = len - 2; i >= 0; i--) w.put(0x80 | ((v >>> (6 * i)) & 0x3f), 8);
}
function _flacSubframe(w, x, n, res) {
  let order = -1, k = 0, best = n * 16;           // bits after the subframe header; verbatim to beat
  if (n > 8) {
    const s = [0, 0, 0, 0, 0];
    for (let i = 4; i < n; i++) {
      const a = x[i], b = x[i - 1], c = x[i - 2], d = x[i - 3], e = x[i - 4];
      const e1 = a - b, e2 = e1 - b + c, e3 = a - 3 * b + 3 * c - d, e4 = a - 4 * b + 6 * c - 4 * d + e;
      s[0] += a < 0 ? -a : a; s[1] += e1 < 0 ? -e1 : e1; s[2] += e2 < 0 ? -e2 : e2; s[3] += e3 < 0 ? -e3 : e3; s[4] += e4 < 0 ? -e4 : e4;
    }
    let o = 0; for (let j = 1; j < 5; j++) if (s[j] < s[o]) o = j;
    let sum = 0;
    for (let i = o; i < n; i++) {
      const a = x[i];
      const r = o === 0 ? a : o === 1 ? a - x[i - 1] : o === 2 ? a - 2 * x[i - 1] + x[i - 2]
        : o === 3 ? a - 3 * x[i - 1] + 3 * x[i - 2] - x[i - 3] : a - 4 * x[i - 1] + 6 * x[i - 2] - 4 * x[i - 3] + x[i - 4];
      const u = ((r << 1) ^ (r >> 31)) >>> 0;
      res[i] = u; sum += u;
    }
    const m = n - o, mean = sum / m;
    const k0 = mean >= 1 ? Math.floor(Math.log2(mean)) : 0;
    for (let kk = Math.max(0, k0 - 1); kk <= Math.min(14, k0 + 1); kk++) {
      let bits = m * (kk + 1);
      for (let i = o; i < n; i++) bits += res[i] >>> kk;
      bits += o * 16 + 10;                          // warm-up samples, coding method, partition order, parameter
      if (bits < best) { best = bits; order = o; k = kk; }
    }
  }
  w.put(0, 1);
  if (order < 0) {                                  // VERBATIM
    w.put(1, 6); w.put(0, 1);
    for (let i = 0; i < n; i++) w.put(x[i] & 0xffff, 16);
    return;
  }
  w.put(8 | order, 6); w.put(0, 1);                 // FIXED, no wasted bits
  for (let i = 0; i < order; i++) w.put(x[i] & 0xffff, 16);
  w.put(0, 2); w.put(0, 4); w.put(k, 4);            // Rice, partition order 0, the parameter
  const lowMask = (1 << k) - 1;
  for (let i = order; i < n; i++) { const u = res[i]; w.zeros(u >>> k); w.put((1 << k) | (u & lowMask), k + 1); }
}
function _flacFrame(L, R, n, frameNo, sr, res) {
  const w = new _FlacBits(n * 4 + 64);
  w.put(0x3ffe, 14); w.put(0, 1); w.put(0, 1);    // sync, reserved, fixed block size
  const bsCode = n === FLAC_BLOCK ? 12 : 7;
  w.put(bsCode, 4); w.put(FLAC_SR_CODE[sr] || 0, 4); w.put(1, 4); w.put(4, 3); w.put(0, 1);   // size, rate, L/R, 16-bit
  _flacUtf8(w, frameNo);
  if (bsCode === 7) w.put(n - 1, 16);
  w.put(_crc8(w.b, w.n), 8);
  _flacSubframe(w, L, n, res); _flacSubframe(w, R, n, res);
  w.align();
  const c = _crc16(w.b, w.n); w.put(c >> 8, 8); w.put(c & 0xff, 8);
  return w.b.slice(0, w.n);
}
function _flacDescription(sr) {
  const d = new Uint8Array(42);
  d.set([0x66, 0x4c, 0x61, 0x43, 0x80, 0, 0, 34]);   // "fLaC", last metadata block: STREAMINFO, 34 bytes
  const w = new _FlacBits(34);
  w.put(FLAC_BLOCK, 16); w.put(FLAC_BLOCK, 16); w.put(0, 24); w.put(0, 24);
  w.put(sr, 20); w.put(1, 3); w.put(15, 5); w.put(0, 4); w.put(0, 32);   // stereo, 16-bit, length unknown
  d.set(w.b.subarray(0, w.n), 8);                    // the MD5 stays zero (not computed)
  return d;
}
const _q16 = (x) => { const s = Math.round(x * 32767); return s > 32767 ? 32767 : s < -32768 ? -32768 : s; };
class FlacJsEncoder {
  constructor(init) { this._out = init.output; this._err = init.error; this.state = 'unconfigured'; this.encodeQueueSize = 0; }
  configure(cfg) {
    this.sr = cfg.sampleRate | 0;
    this.L = new Int16Array(FLAC_BLOCK); this.R = new Int16Array(FLAC_BLOCK); this.res = new Uint32Array(FLAC_BLOCK);
    this.fill = 0; this.frameNo = 0; this.t0 = null; this.done = 0; this.metaSent = false; this.bytes = 0;
    this.state = 'configured';
  }
  encode(ad) {
    if (this.state !== 'configured') throw new Error('FLAC encoder is not configured.');
    const nb = ad.numberOfFrames;
    let l, r;
    if (ad._planes) { l = ad._planes.subarray(0, nb); r = ad._planes.subarray(nb, 2 * nb); }
    else { l = new Float32Array(nb); r = new Float32Array(nb); ad.copyTo(l, { planeIndex: 0, format: 'f32-planar' }); ad.copyTo(r, { planeIndex: 1, format: 'f32-planar' }); }
    if (this.t0 == null) this.t0 = ad.timestamp / 1e6;
    for (let i = 0; i < nb; i++) {
      this.L[this.fill] = _q16(l[i]); this.R[this.fill] = _q16(r[i]);
      if (++this.fill === FLAC_BLOCK) this._emit();
    }
  }
  flush() { if (this.state === 'configured' && this.fill) this._emit(); return Promise.resolve(); }
  close() { this.state = 'closed'; }
  _emit() {
    const n = this.fill;
    this.fill = 0;
    try {
      const bytes = _flacFrame(this.L, this.R, n, this.frameNo++, this.sr, this.res);
      const pkt = new EncodedPacket(bytes, 'key', this.t0 + this.done / this.sr, n / this.sr);
      this.done += n; this.bytes += bytes.length;
      audioPumpStats.flacKbps = this.done ? Math.round(this.bytes * 8 / (this.done / this.sr) / 1000) : 0;
      const meta = this.metaSent ? undefined
        : { decoderConfig: { codec: 'flac', sampleRate: this.sr, numberOfChannels: 2, description: _flacDescription(this.sr) } };
      this.metaSent = true;
      this._out(pkt, meta);
    } catch (e) { if (this._err) this._err(e); }
  }
}
/* The encoder for a target picked by pickAudioTarget: WebCodecs, or the FLAC one above. */
const makeAudioEncoder = (target, init) => (target && target.js ? new FlacJsEncoder(init) : new AudioEncoder(init));
/* A packet from either encoder, as mediabunny wants it. */
const toPacket = (chunk) => (chunk instanceof EncodedPacket ? chunk : EncodedPacket.fromEncodedChunk(chunk));

/* ------------------------------------------------------------------ *
 *  Capability check (remuxSupport)
 *
 *  Pure DOM + MediaSource.isTypeSupported; no mediabunny needed here so it
 *  is cheap enough to call from the drawer render for every row.
 * ------------------------------------------------------------------ */

// Containers mediabunny can demux for us. mp4/mov/webm already direct-play,
// but they can still legitimately need a remux (e.g. an in-mp4 codec combo
// the <video> tag won't start), so they're allowed here too.
// No 'avi' (2026-10-15): mediabunny has no AVI reader. Keep in sync with emby.js.
const REMUXABLE_CONTAINERS = new Set([
  'mkv', 'webm', 'mp4', 'm4v', 'mov', 'ts', 'mts', 'm2ts',
]);

// Video codec (Emby's MediaStreams Codec) -> candidate MP4/MSE codec strings.
// We only need ONE candidate to be isTypeSupported for the gate to pass; the
// exact string handed to addSourceBuffer at play time comes from mediabunny.
function videoCodecCandidates(v) {
  const codec = String(v && v.Codec || '').toLowerCase();
  const bit = Number(v && v.BitDepth) || 8;
  if (codec === 'hevc' || codec === 'h265') {
    return bit >= 10
      ? ['hvc1.2.4.L153.B0', 'hev1.2.4.L153.B0']   // Main 10
      : ['hvc1.1.6.L153.B0', 'hev1.1.6.L153.B0'];  // Main
  }
  if (codec === 'h264' || codec === 'avc') return ['avc1.640028', 'avc1.4d4028', 'avc1.42e01e'];
  if (codec === 'vp9')  return ['vp09.00.10.08', 'vp09.02.10.10'];
  if (codec === 'av1')  return ['av01.0.08M.08', 'av01.0.08M.10'];
  return null; // unknown / undecodable-by-remux video codec
}

// Audio codecs we can COPY into MP4 and the browser can decode.
const AUDIO_COPYABLE = { aac: 'mp4a.40.2', opus: 'opus', flac: 'flac' };
// Friendly labels for the audio codecs that are the usual blockers.
const AUDIO_LABEL = {
  ac3: 'Dolby Digital (AC3)', eac3: 'Dolby Digital Plus (E-AC3)',
  'e-ac-3': 'Dolby Digital Plus (E-AC3)', 'ac-3': 'Dolby Digital (AC3)',
  dts: 'DTS', dca: 'DTS', truehd: 'Dolby TrueHD', mlp: 'Dolby TrueHD',
  mp2: 'MPEG audio (MP2)',
};

function mseSupported(mime) {
  try { return !!(window.MediaSource && window.MediaSource.isTypeSupported(mime)); }
  catch { return false; }
}

/**
 * remuxSupport(mediaSource) -> { ok:boolean, reason?:string }
 * ok when the file isn't a straight <video src> play but its codecs CAN be
 * copied into a fragmented MP4 the browser will decode.
 */
export function remuxSupport(src) {
  if (!src) return { ok: false, reason: 'No media source.' };
  const cont = String(src.Container || '').toLowerCase();
  const streams = src.MediaStreams || [];
  const v = streams.find(s => s.Type === 'Video');
  const a = streams.find(s => s.Type === 'Audio');

  if (!REMUXABLE_CONTAINERS.has(cont))
    return { ok: false, reason: `This is a .${cont || '?'} file, which can't be remuxed in the browser.` };

  // Video must exist and be decodable by MSE via one of our candidate strings.
  const vCands = v ? videoCodecCandidates(v) : null;
  if (!vCands) {
    const vc = String(v && v.Codec || '').toUpperCase();
    return { ok: false, reason: `The video is ${vc || 'an unsupported codec'}, which this browser can't decode.` };
  }
  const vStr = vCands.find(c => mseSupported(`video/mp4; codecs="${c}"`));
  if (!vStr) {
    const vc = String(v.Codec || '').toUpperCase();
    return { ok: false, reason: `This browser can't decode this ${vc} variant.` };
  }

  // Audio is optional. AAC/Opus/FLAC copy straight through. Dolby/DTS can't be
  // copied, but we can DECODE them in WASM (libav.js) and re-encode to AAC/Opus,
  // so those now play WITH sound (transcodeAudio). Anything we still can't handle
  // (e.g. Dolby TrueHD) falls back to VIDEO-ONLY (silent), same as before.
  if (a) {
    const ac = String(a.Codec || '').toLowerCase();
    const aStr = AUDIO_COPYABLE[ac];
    if (aStr && mseSupported(`video/mp4; codecs="${vStr},${aStr}"`)) return { ok: true };

    const dec = DOLBY_DECODER[ac];
    const label = AUDIO_LABEL[ac] || (a.Codec ? String(a.Codec).toUpperCase() : 'this audio');
    // We can re-encode to AAC when MSE can play video+AAC (always true for mp4).
    if (dec && mseSupported(`video/mp4; codecs="${vStr},mp4a.40.2"`))
      return { ok: true, transcodeAudio: dec, audioLabel: label };

    return { ok: true, videoOnly: true, audioLabel: label };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 *  Streaming remux (remuxToVideo)
 * ------------------------------------------------------------------ */

/**
 * remuxToVideo(url, videoEl, opts)
 *   url     : Emby direct .mkv stream URL
 *   videoEl : a <video> already in the DOM
 *   opts    : { onStart(), onError(err), audioTrackIndex } (all optional)
 *             audioTrackIndex — pick the Nth audio track (0-based among audio
 *             tracks) instead of the container's default, for audio-track
 *             selection. Forces the hand-copy path (mediabunny's Conversion
 *             always takes the primary track).
 * Returns { destroy(), ready } where `ready` resolves once playback starts.
 */
export function remuxToVideo(url, videoEl, opts = {}) {
  const onStart = typeof opts.onStart === 'function' ? opts.onStart : () => {};
  const onError = typeof opts.onError === 'function' ? opts.onError : () => {};
  const durationSeconds = Number(opts.durationSeconds) || 0; // true length from Emby

  // How close to a buffered range counts as "already there" (MSE handles it, no
  // restart). Small: a real forward/backward seek to an unbuffered spot is well
  // beyond this, while tiny scrub jitter near the buffered edge is absorbed.
  const SEEK_TOLERANCE = 0.5;   // seconds
  const SEEK_DEBOUNCE_MS = 200; // settle rapid scrubbing before acting

  let destroyed = false;
  let started = false;
  let durationSet = false;
  let sourceFinished = false;        // mediabunny finished writing (current gen)
  let sourceBuffer = null;
  let inflight = null;               // { data, resolve } currently appending
  const queue = [];                  // pending { data, resolve }
  let conversion = null;             // set on the sequential (from-0) path
  let activeOutput = null;           // set on the seek-copy path (manual mux)
  let input = null;

  // Every conversion (initial + each seek-restart) gets a fresh generation id.
  // Late callbacks from a cancelled conversion carry a stale id and are ignored,
  // so the old WritableStream / execute() promise can't corrupt the new stream.
  let generation = 0;
  let restarting = false;            // a teardown+restart is in progress
  let pendingRestartTime = null;     // newest seek target that arrived mid-restart
  let seekTimer = null;

  // Dolby/DTS files re-encode their audio (see the WASM section up top). The
  // chosen re-encode target (AAC or Opus) is decided once and reused across every
  // seek-restart so the SourceBuffer mime stays constant.
  const transcodeAudio = opts.transcodeAudio || null; // libav decoder name, or null
  let audioTarget = null;            // { name, mseCodec, encConfig }

  const mediaSource = new MediaSource();
  const objectUrl = URL.createObjectURL(mediaSource);

  let resolveReady, rejectReady;
  const ready = new Promise((res, rej) => { resolveReady = res; rejectReady = rej; });

  function fail(err) {
    if (destroyed) return;
    const e = err instanceof Error ? err : new Error(String(err && err.message || err || 'Remux failed'));
    console.warn('[Emby] remux engine failed:', e && e.message, e && e.stack ? e.stack.split('\n').slice(1, 3).join(' | ') : '');
    try { rejectReady(e); } catch {}
    onError(e);
    cleanup();
  }

  function markStarted() {
    if (started || destroyed) return;
    started = true;
    try { resolveReady(); } catch {}
    onStart();
  }

  function maybeEndOfStream() {
    if (destroyed || restarting || !sourceFinished) return;
    if (queue.length || inflight) return;
    if (mediaSource.readyState !== 'open') return;
    try { mediaSource.endOfStream(); } catch {}
  }

  function flush() {
    if (destroyed || !sourceBuffer || sourceBuffer.updating || inflight) return;
    const item = queue.shift();
    if (!item) { maybeEndOfStream(); return; }
    inflight = item;
    try {
      sourceBuffer.appendBuffer(item.data);
    } catch (e) {
      inflight = null;
      // QuotaExceededError: buffer full. Evict what's already played, retry.
      if (e && e.name === 'QuotaExceededError') {
        queue.unshift(item);
        _evict();
        return;
      }
      try { item.resolve(); } catch {}
      fail(e);
    }
  }

  function _evict() {
    try {
      const buffered = sourceBuffer.buffered;
      const cur = videoEl.currentTime;
      if (buffered.length && cur - buffered.start(0) > 12) {
        sourceBuffer.remove(buffered.start(0), Math.max(buffered.start(0), cur - 8));
      }
    } catch {}
  }

  // Shared SourceBuffer 'updateend' handler. Created once with the SourceBuffer
  // and kept across restarts (we reuse the same SourceBuffer to avoid a reload
  // flash), so it must not assume which conversion produced the append.
  function onUpdateEnd() {
    if (inflight) { const it = inflight; inflight = null; try { it.resolve(); } catch {} }
    // Fragmented-MP4 init segments carry no total duration, so MSE grows the
    // timeline as fragments arrive. Stamp the real length (from Emby) once,
    // after the init segment is in, so the scrubber shows the true duration
    // instead of expanding while it plays. Kept across restarts.
    if (!durationSet && durationSeconds > 0 && mediaSource.readyState === 'open' && !sourceBuffer.updating) {
      try { mediaSource.duration = durationSeconds; durationSet = true; } catch {}
    }
    // A stream whose first packet is not at 0 (MPEG-TS starts at about 1.4 s)
    // leaves the playhead in a gap before the first buffered range, and the
    // hand-copy path (decode-here audio) keeps those real times, so playback
    // never began until a seek (found 2026-10-10 on a stand-in MP2 .ts). Before
    // the first frame plays, step over a lead-in gap of up to 5 s.
    if (!started && !videoEl.seeking) {
      try {
        const b = sourceBuffer.buffered;
        if (b.length && videoEl.currentTime < b.start(0) && b.start(0) - videoEl.currentTime < 5) videoEl.currentTime = b.start(0);
      } catch {}
    }
    flush();
  }

  // Fresh MP4-byte WritableStream + fragmented Output for one conversion. The
  // write handler is gen-gated so a cancelled conversion's late writes are
  // dropped (and their promises resolved) instead of corrupting the new stream.
  function makeOutput(gen) {
    // WritableStream fed by mediabunny's AppendOnlyStreamTarget: each write gets
    // a raw Uint8Array of the next MP4 bytes (ftyp+moov, then moof/mdat frags).
    // Returning a promise applies backpressure so we never outrun the buffer.
    const writable = new WritableStream({
      write(data) {
        return new Promise((resolve) => {
          if (destroyed || gen !== generation) return resolve();
          // Copy: mediabunny may reuse the underlying buffer after write returns.
          queue.push({ data: data.slice(), resolve });
          flush();
        });
      },
      close() { if (gen === generation && !destroyed) { sourceFinished = true; maybeEndOfStream(); } },
      abort() { if (gen === generation) sourceFinished = true; },
    });
    return new Output({
      format: new Mp4OutputFormat({ fastStart: 'fragmented' }),
      target: new AppendOnlyStreamTarget(writable),
    });
  }

  /**
   * Build the input -> output pipeline and start streaming.
   *   fromSeconds === 0 : normal sequential start. Uses mediabunny's Conversion
   *                       (packet copy from the file start; proven path). Output
   *                       keeps real timestamps, so timestampOffset stays 0.
   *   fromSeconds  >  0 : seek-restart. mediabunny's `trim` CANNOT be used here:
   *                       in this vendored build any forward trim forces a video
   *                       re-encode (needsTranscode when firstTimestamp <
   *                       trim.start, and firstTimestamp is the track's global
   *                       first packet, ~0), which Chrome can't do for 10-bit
   *                       AV1/HEVC (no encoder). So we COPY encoded packets by
   *                       hand from the key frame at/before the seek target into
   *                       a fresh fragmented MP4. See copyFromKeyframe().
   * Shared by the initial start and every seek-restart.
   */
  async function startConversion(fromSeconds = 0) {
    const gen = ++generation;
    sourceFinished = false;
    try {
      input = new Input({ formats: ALL_FORMATS, source: new UrlSource(url) });

      const vTrack = await input.getPrimaryVideoTrack();
      // videoOnly: the audio codec (Dolby/DTS) can't be decoded, so drop it and
      // remux the video alone (plays silent) instead of failing the whole file.
      // audioTrackIndex: pick a specific audio track (audio-track selection);
      // falls back to the primary if the index is out of range.
      let aTrack = null;
      if (!opts.videoOnly) {
        if (opts.audioTrackIndex != null) {
          const all = await input.getAudioTracks();
          aTrack = all[opts.audioTrackIndex] || await input.getPrimaryAudioTrack();
        } else {
          aTrack = await input.getPrimaryAudioTrack();
        }
      }
      if (gen !== generation || destroyed) return;
      if (!vTrack) throw new Error('No video track found in the file.');

      const vStr = await vTrack.getCodecParameterString();
      // For a Dolby/DTS track we re-encode to AAC/Opus, so the SourceBuffer mime
      // must advertise the TARGET codec, not the (undecodable) source codec.
      let aStr = null;
      if (transcodeAudio && aTrack) {
        if (!audioTarget) audioTarget = await pickAudioTarget(aTrack.sampleRate);
        if (!audioTarget) throw new Error('The browser can\'t re-encode this audio (no AAC or Opus encoder).');
        aStr = audioTarget.mseCodec;
      } else if (aTrack) {
        aStr = await aTrack.getCodecParameterString().catch(() => null);
      }
      if (gen !== generation || destroyed) return;
      const codecs = [vStr, aStr].filter(Boolean).join(',');
      const mime = `video/mp4; codecs="${codecs}"`;
      if (!mseSupported(mime)) throw new Error('The browser can\'t decode this stream (' + mime + ').');
      if (gen !== generation || destroyed) return;

      // The SourceBuffer is created once and reused for every restart so the
      // <video> never reloads. A restart just feeds it a fresh init segment,
      // which MSE accepts mid-stream.
      if (!sourceBuffer) {
        sourceBuffer = mediaSource.addSourceBuffer(mime);
        sourceBuffer.mode = 'segments';
        sourceBuffer.addEventListener('updateend', onUpdateEnd);
        sourceBuffer.addEventListener('error', () => fail(new Error('SourceBuffer append error.')));
      }

      const output = makeOutput(gen);

      // Seek-restarts use the hand-rolled copy path. Dolby/DTS files also use it
      // FROM THE START, because mediabunny's Conversion can't decode+re-encode
      // their audio; copyFromKeyframe runs the WASM audio pipeline instead. A
      // non-default audio-track pick uses it too — Conversion always takes the
      // primary track, so a hand-copy of the chosen track is the only way.
      if (fromSeconds > 0 || transcodeAudio || opts.audioTrackIndex != null) {
        activeOutput = output;
        conversion = null;
        await copyFromKeyframe(gen, output, vTrack, aTrack, fromSeconds);
        return;
      }

      // Sequential from-start path: mediabunny Conversion copies the whole file.
      activeOutput = null;
      conversion = await Conversion.init({
        input,
        output,
        ...(opts.videoOnly ? { audio: { discard: true } } : {}),
      });
      if (gen !== generation || destroyed) { try { conversion.cancel(); } catch {} return; }
      if (!conversion.isValid) throw new Error('This file can\'t be remuxed (unsupported track layout).');

      conversion.execute()
        .then(() => { if (gen === generation && !destroyed) { sourceFinished = true; maybeEndOfStream(); } })
        .catch((e) => { if (gen === generation && !destroyed) fail(e); });
    } catch (e) {
      if (gen === generation && !destroyed) fail(e);
    }
  }

  /**
   * Seek-restart engine: hand-copy encoded packets (NO re-encode, so 10-bit
   * AV1/HEVC works) from the key frame at/before `fromSeconds` to the end.
   *
   * mediabunny's copy path resets output timestamps to 0 relative to the start
   * packet; we do the same by subtracting `base` (the earliest of the video key
   * frame and the aligned audio start), then set sourceBuffer.timestampOffset =
   * base so the fragments land back at their real time on the timeline. Video
   * and audio packets are merged in timestamp order so fragments interleave.
   */
  async function copyFromKeyframe(gen, output, vTrack, aTrack, fromSeconds) {
    const vCodec = await vTrack.getCodec();
    const aCodec = aTrack ? await aTrack.getCodec().catch(() => null) : null;
    if (gen !== generation || destroyed) return;
    if (!vCodec) throw new Error('Unknown video codec; cannot seek.');

    const vSink = new EncodedPacketSink(vTrack);
    // A track we decode ourselves needs no codec name from the demuxer (MKV's
    // A_MPEG/L2 has none in mediabunny; MP4 and MPEG-TS call MP2 "mp3").
    const aSink = (aTrack && (aCodec || transcodeAudio)) ? new EncodedPacketSink(aTrack) : null;

    // Nearest key frame at or before the target (snap-back is normal seek feel).
    const vKf = await vSink.getKeyPacket(fromSeconds, { verifyKeyPackets: true })
             ?? await vSink.getFirstKeyPacket({ verifyKeyPackets: true });
    if (gen !== generation || destroyed) return;
    if (!vKf) throw new Error('No key frame found to seek to.');
    // verifyKeyPackets needs to understand the codec; a track we decode ourselves
    // (every audio packet is a key packet anyway) is read without it.
    const aVerify = !transcodeAudio;
    const aStart = aSink
      ? (await aSink.getKeyPacket(vKf.timestamp, { verifyKeyPackets: aVerify })
         ?? await aSink.getFirstKeyPacket({ verifyKeyPackets: aVerify }))
      : null;
    if (gen !== generation || destroyed) return;

    // base <= every packet timestamp we emit, so adjusted timestamps stay >= 0
    // (MP4 baseMediaDecodeTime is unsigned) and A/V keep their relative offset.
    // FAR SEEKS (2026-10-10, two test episodes: a seek to 15-20 min or a
    // mid-file resume failed, the player fell to the server and restarted at
    // 0). An HEVC key frame there is often a CRA with "leading" pictures after
    // it in decode order but BEFORE it in time (here 18 ms), so anchoring the
    // base exactly on the key frame made those negative and the muxer threw
    // "Timestamps must be non-negative". From the start of the file it never
    // shows (the first key frame is an IDR). The base now sits 2 s earlier
    // (never below 0), which every leading picture fits inside; real times are
    // restored by timestampOffset exactly as before.
    const LEAD_MARGIN = 2;   // seconds
    const base = Math.max(0, Math.min(vKf.timestamp, aStart ? aStart.timestamp : vKf.timestamp) - LEAD_MARGIN);

    // Re-anchor the timeline NOW: restart() just cleared the buffer and nothing
    // appends until output.start() below, so the SourceBuffer is guaranteed idle
    // here (setting timestampOffset while updating would throw).
    try { sourceBuffer.timestampOffset = base; } catch {}

    const rotation = await vTrack.getRotation().catch(() => 0);
    const vSource = new EncodedVideoPacketSource(vCodec);
    output.addVideoTrack(vSource, rotation ? { rotation } : {});
    let aSource = null;
    if (transcodeAudio && aSink) {
      // Re-encode target (AAC/Opus). Its packets are produced by the audio pump.
      aSource = new EncodedAudioPacketSource(audioTarget.name);
      output.addAudioTrack(aSource);
    } else if (aSink && aCodec) {
      aSource = new EncodedAudioPacketSource(aCodec);
      output.addAudioTrack(aSource);
    }

    await output.start();
    if (gen !== generation || destroyed) { try { await output.cancel(); } catch {} return; }

    const vMeta = { decoderConfig: (await vTrack.getDecoderConfig().catch(() => null)) ?? undefined };
    const aMeta = (aTrack && !transcodeAudio) ? { decoderConfig: (await aTrack.getDecoderConfig().catch(() => null)) ?? undefined } : null;
    if (gen !== generation || destroyed) { try { await output.cancel(); } catch {} return; }

    // Every muxer add() goes through this lock so the two concurrent pumps (video
    // copy + audio transcode) can't interleave inside the muxer's per-track state.
    // Each add()'s backpressure promise is preserved (callers await mux()).
    let muxLock = Promise.resolve();
    const mux = (fn) => { const r = muxLock.then(fn); muxLock = r.then(() => {}, () => {}); return r; };

    // Video copy pump. When audio is COPIED (not transcoded) it is merged here in
    // timestamp order, exactly as before. When audio is TRANSCODED this carries
    // video only and the audio pump runs alongside.
    const videoPump = async () => {
      const vIt = vSink.packets(vKf, undefined, { verifyKeyPackets: true })[Symbol.asyncIterator]();
      const aIt = (aStart && !transcodeAudio) ? aSink.packets(aStart, undefined, { verifyKeyPackets: true })[Symbol.asyncIterator]() : null;
      try {
        let vN = await vIt.next();
        let aN = aIt ? await aIt.next() : { done: true };
        while (!vN.done || !aN.done) {
          if (destroyed || gen !== generation) return;
          const vt = vN.done ? Infinity : vN.value.timestamp;
          const at = aN.done ? Infinity : aN.value.timestamp;
          if (vt <= at) {
            const p = vN.value;
            await mux(() => vSource.add(p.clone({ timestamp: p.timestamp - base, sideData: {} }), vMeta));
            vN = await vIt.next();
          } else {
            const p = aN.value;
            await mux(() => aSource.add(p.clone({ timestamp: p.timestamp - base }), aMeta));
            aN = await aIt.next();
          }
        }
      } finally {
        try { vIt.return && vIt.return(); } catch {}
        try { aIt && aIt.return && aIt.return(); } catch {}
      }
    };

    // Audio transcode pump: demux Dolby/DTS packets -> libav decode to PCM ->
    // stereo downmix -> WebCodecs AudioEncoder -> mux the AAC/Opus packets, each
    // base-shifted exactly like the video so the <video> keeps A/V in sync.
    // Output timestamps come from a running sample counter anchored at the audio
    // start packet, so they are gapless regardless of decoder frame pts.
    const audioTranscodePump = async () => {
      if (!aSource || !aStart) return;
      const dec = await openAudioDecoder(transcodeAudio);
      if (destroyed || gen !== generation) { try { await dec.free(); } catch {} return; }
      const sampleRate = aTrack.sampleRate || 48000;
      let encoder = null, encErr = null, firstMeta = null, firstAudioAdded = false;
      const pending = [];
      let samplePos = Math.round(aStart.timestamp * sampleRate);
      Object.assign(audioPumpStats, { decoder: transcodeAudio, packets: 0, frames: 0, driftMs: 0, driftMaxMs: 0, decodeMs: 0, audioSec: 0 });
      const drain = async () => {
        while (pending.length) {
          if (destroyed || gen !== generation) return;
          const chunk = pending.shift();
          const packet = toPacket(chunk);
          const meta = firstAudioAdded ? undefined : (firstMeta ? { decoderConfig: firstMeta.decoderConfig } : undefined);
          firstAudioAdded = true;
          // Clamped: microsecond rounding of the re-encoded timestamps can land a
          // hair (~1e-7 s) before base, and the muxer rejects any negative time.
          await mux(() => aSource.add(packet.clone({ timestamp: Math.max(0, packet.timestamp - base) }), meta));
        }
      };
      const encodeFrames = (frames) => {
        for (const f of frames) {
          if (!f.nb_samples) continue;
          const sr = f.sample_rate || sampleRate;
          const tsMicros = Math.round(samplePos / sr * 1e6);
          samplePos += f.nb_samples;
          const ad = frameToStereoAudioData(f, sr, tsMicros);
          encoder.encode(ad); ad.close();
        }
      };
      try {
        encoder = makeAudioEncoder(audioTarget, {
          output: (chunk, meta) => { if (meta && meta.decoderConfig && !firstMeta) firstMeta = meta; pending.push(chunk); },
          error: (e) => { encErr = e; },
        });
        encoder.configure(audioTarget.encConfig);
        const aIt = aSink.packets(aStart, undefined, { verifyKeyPackets: aVerify })[Symbol.asyncIterator]();
        try {
          let n = await aIt.next();
          let batchSec = 0.04;                 // first calls short (sound starts at once), then AUDIO_BATCH_SEC
          audioPumpStats.calls = 0;
          while (!n.done) {
            if (destroyed || gen !== generation) return;
            if (encErr) throw encErr;
            const p0 = n.value;
            const driftMs = (samplePos / sampleRate - p0.timestamp) * 1000;
            audioPumpStats.driftMs = driftMs;
            if (Math.abs(driftMs) > Math.abs(audioPumpStats.driftMaxMs)) audioPumpStats.driftMaxMs = driftMs;
            const batch = [];
            while (!n.done && batch.length < AUDIO_BATCH_MAX && (batch.length === 0 || n.value.timestamp - p0.timestamp < batchSec)) {
              batch.push({ data: n.value.data, pts: Math.round(n.value.timestamp * sampleRate) });
              n = await aIt.next();
            }
            if (destroyed || gen !== generation) return;
            audioPumpStats.packets += batch.length; audioPumpStats.calls++;
            const td = performance.now();
            const frames = await dec.decodeMany(batch, sampleRate);
            audioPumpStats.decodeMs += performance.now() - td;
            audioPumpStats.frames += frames.length;
            encodeFrames(frames);
            audioPumpStats.audioSec = samplePos / sampleRate - aStart.timestamp;
            await drain();
            while (encoder.encodeQueueSize > AUDIO_ENC_QUEUE_MAX && !destroyed && gen === generation) await new Promise(r => setTimeout(r, 4));
            if (batchSec < AUDIO_BATCH_SEC) batchSec = Math.min(AUDIO_BATCH_SEC, batchSec * 2);
          }
          if (!destroyed && gen === generation) {
            const tail = await dec.flush();
            encodeFrames(tail);
            await encoder.flush();
            await drain();
          }
        } finally {
          try { aIt.return && aIt.return(); } catch {}
        }
        if (encErr) throw encErr;
      } finally {
        try { if (encoder && encoder.state !== 'closed') encoder.close(); } catch {}
        try { await dec.free(); } catch {}
      }
    };

    // Detached: run the pump(s), then close sources + finalize once, all gen-gated
    // so a superseded seek can't finalize the wrong stream.
    (async () => {
      if (transcodeAudio) await Promise.all([videoPump(), audioTranscodePump()]);
      else await videoPump();
      if (destroyed || gen !== generation) return;
      vSource.close();
      if (aSource) aSource.close();
      await output.finalize();
    })()
      .then(() => { if (gen === generation && !destroyed) { sourceFinished = true; maybeEndOfStream(); } })
      .catch((e) => { if (gen === generation && !destroyed) fail(e); });
  }

  function onSourceOpen() {
    mediaSource.removeEventListener('sourceopen', onSourceOpen);
    startConversion(0);
  }

  // True if `t` sits inside (or within tolerance of) an existing buffered range,
  // in which case MSE can seek there itself and no restart is needed.
  function isBuffered(t) {
    try {
      const b = sourceBuffer && sourceBuffer.buffered;
      if (!b) return false;
      for (let i = 0; i < b.length; i++) {
        if (t >= b.start(i) - SEEK_TOLERANCE && t <= b.end(i) + SEEK_TOLERANCE) return true;
      }
    } catch {}
    return false;
  }

  // Free the whole SourceBuffer and resolve once it is idle again. Reused across
  // a restart so the new fragments land in a clean buffer at the new offset.
  function clearBuffer() {
    return new Promise((resolve) => {
      if (destroyed || !sourceBuffer) return resolve();
      try {
        // Abort any append in flight so remove() (which needs updating===false)
        // is legal and so no stale fragment survives the restart.
        if (sourceBuffer.updating) { try { sourceBuffer.abort(); } catch {} }
        const hasBuf = sourceBuffer.buffered && sourceBuffer.buffered.length > 0;
        if (!hasBuf) return resolve();
        const end = (Number.isFinite(mediaSource.duration) && mediaSource.duration > 0)
          ? mediaSource.duration : Infinity;
        const onEnd = () => { try { sourceBuffer.removeEventListener('updateend', onEnd); } catch {} resolve(); };
        sourceBuffer.addEventListener('updateend', onEnd);
        sourceBuffer.remove(0, end);
      } catch { resolve(); }
    });
  }

  // Restart the remux from `toSeconds`, reusing the same MediaSource /
  // SourceBuffer / <video> (no reload flash). Sequenced so late callbacks from
  // the cancelled conversion are inert (generation bump) and a restart requested
  // while this one is still tearing down is chased afterwards.
  async function restart(toSeconds) {
    if (destroyed || !sourceBuffer) return;
    if (restarting) { pendingRestartTime = toSeconds; return; }
    restarting = true;
    try {
      // Invalidate the old conversion's callbacks NOW, before any await, so its
      // execute()/pump rejection or trailing writes can't act during teardown.
      generation++;
      cancelActive();
      const oldInput = input; input = null;
      try { oldInput && oldInput.dispose && oldInput.dispose(); } catch {}

      // Unblock the old WritableStream: resolve the inflight + queued write
      // promises so mediabunny's cancel can unwind, and drop those bytes.
      if (inflight) { const it = inflight; inflight = null; try { it.resolve(); } catch {} }
      while (queue.length) { const it = queue.shift(); try { it.resolve(); } catch {} }
      sourceFinished = false;

      await clearBuffer();
      if (destroyed) return;

      // The seek-copy resets output timestamps to ~0 relative to the key frame;
      // copyFromKeyframe() re-anchors the timeline via sourceBuffer.timestampOffset
      // once it knows the exact key-frame time. Duration is left untouched so the
      // scrubber keeps showing the full timeline.
      await startConversion(toSeconds);
    } finally {
      restarting = false;
      // A newer target arrived mid-restart: chase it if it's still unbuffered.
      if (!destroyed && pendingRestartTime !== null) {
        const next = pendingRestartTime;
        pendingRestartTime = null;
        if (!isBuffered(next)) restart(next);
      }
    }
  }

  // Debounced seek handler: only the final target of a scrub triggers a restart,
  // and only when that target isn't already buffered.
  function evaluateSeek() {
    if (destroyed || !sourceBuffer) return;
    const t = videoEl.currentTime;
    if (isBuffered(t)) return; // MSE seeks within the buffered range itself
    restart(t);
  }
  function onSeek() {
    if (destroyed) return;
    if (seekTimer) clearTimeout(seekTimer);
    seekTimer = setTimeout(() => { seekTimer = null; evaluateSeek(); }, SEEK_DEBOUNCE_MS);
  }

  // Re-drive the append queue as playback moves. Without this, once the buffer
  // fills and an append is deferred for eviction, nothing restarts it — playback
  // stalls at the buffered edge and the remux never resumes. On every timeupdate
  // / stall we retry: flush() evicts already-played data (freeing quota now that
  // currentTime has advanced) and appends the next fragment, so the whole file
  // streams in progressively instead of stopping partway.
  const _pump = () => { if (!destroyed) flush(); };
  mediaSource.addEventListener('sourceopen', onSourceOpen);
  videoEl.addEventListener('playing', markStarted);
  videoEl.addEventListener('loadeddata', markStarted);
  videoEl.addEventListener('timeupdate', _pump);
  videoEl.addEventListener('waiting', _pump);
  videoEl.addEventListener('seeking', _pump);
  videoEl.addEventListener('seeking', onSeek);
  videoEl.addEventListener('seeked', onSeek);
  videoEl.src = objectUrl;

  // Cancel whichever engine is running: the from-start Conversion or the
  // seek-copy manual mux Output.
  function cancelActive() {
    if (conversion) { try { conversion.cancel(); } catch {} conversion = null; }
    if (activeOutput) { try { activeOutput.cancel(); } catch {} activeOutput = null; }
  }

  function cleanup() {
    cancelActive();
    try { input && input.dispose && input.dispose(); } catch {}
    input = null;
    try {
      if (mediaSource.readyState === 'open') mediaSource.endOfStream();
    } catch {}
    try { URL.revokeObjectURL(objectUrl); } catch {}
    queue.length = 0;
    inflight = null;
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    generation++; // neutralize any in-flight conversion callbacks
    if (seekTimer) { clearTimeout(seekTimer); seekTimer = null; }
    videoEl.removeEventListener('playing', markStarted);
    videoEl.removeEventListener('loadeddata', markStarted);
    videoEl.removeEventListener('timeupdate', _pump);
    videoEl.removeEventListener('waiting', _pump);
    videoEl.removeEventListener('seeking', _pump);
    videoEl.removeEventListener('seeking', onSeek);
    videoEl.removeEventListener('seeked', onSeek);
    try { videoEl.pause(); } catch {}
    cleanup();
    try { videoEl.removeAttribute('src'); videoEl.load(); } catch {}
  }

  return { destroy, ready };
}

/* ==================================================================== *
 *  MPEG-4 / AVI transcode path (transcodeToVideo)
 *
 *  Chrome has NO decoder for MPEG-4 Part 2 (Simple/Advanced Simple Profile,
 *  the old DivX/Xvid codec) or the old MS-MPEG4 variants, and it can't open an
 *  AVI container either. Unlike the HEVC/AV1 remux (a straight packet copy),
 *  these files must be genuinely re-encoded. So we:
 *    1. demux the AVI + decode the video (mpeg4/msmpeg4) and audio (mp3) with a
 *       second self-hosted libav.js build (the "mp4v" variant: avi demuxer +
 *       mpeg4/msmpeg4v1-3 + mp3 decoders + the jsfetch protocol, ~1.2 MB). libav
 *       streams the file over HTTP range requests via jsfetch, so no 487 MB
 *       download.
 *    2. re-encode the decoded I420 frames to H.264 with the browser's hardware
 *       WebCodecs VideoEncoder, and the PCM to AAC with AudioEncoder (stereo
 *       downmix, reusing frameToStereoAudioData).
 *    3. mux the H.264 + AAC into the same fragmented MP4 -> MSE <video> as the
 *       remux path. The content is light (SD, ~1 Mbps) so it transcodes in real
 *       time. Everything is lazy: the mp4v wasm loads only on the first such file.
 *
 *  A jump restarts the conversion at the key frame at or before the target, and
 *  opts.startSeconds starts it at a saved place (resume, 24 Oct).
 * ==================================================================== */

const LIBAV_MP4V_URL = './vendor/libav-6.9.9.0-mp4v.mjs';
let _libavMp4v = null;
let _libavMp4vPromise = null;
function ensureLibavMp4v() {
  if (_libavMp4v) return Promise.resolve(_libavMp4v);
  if (!_libavMp4vPromise) {
    _libavMp4vPromise = import(LIBAV_MP4V_URL)
      .then(mod => (mod.default || mod).LibAV({ noworker: false }))
      .then(l => { _libavMp4v = l; return l; })
      .catch(e => { _libavMp4vPromise = null; throw e; });
  }
  return _libavMp4vPromise;
}
/* ONE CRASH POISONED EVERY LATER FILE (2026-10-15, Emby formats census). The
   mp4v instance is shared by the whole page, and after a wasm fault ("memory
   access out of bounds", seen on seeks and some MS-MPEG4 files) every later
   AVI conversion in the same page failed at once, even files that played
   before it. So any failed conversion throws its instance away: the worker
   is terminated, and the next file builds a fresh one (the module is cached,
   so this costs a fraction of a second). */
/* READ THE FILE IN CACHED BLOCKS, NOT AS ONE STREAM (24 Oct 2026). libav's
   "jsfetch:" reader opens a fresh HTTP request from the new place to the end of the file
   on EVERY seek, and the AVI reader seeks a lot: on a file whose sound tracks are stored
   apart from the picture it falls into "NI mode" and jumps between the tracks for every
   packet. Measured on a stand-in AVI with its second sound track stored in 8 s runs:
   2,306 requests in the first 20 s and no picture at all; on a real server this was
   the 62 to 70 s start of Barbie as the Island Princess (two sound tracks). Here libav
   reads a block device instead: each 512 KB block is fetched once with a closed Range
   request and kept (about 24 MB, oldest dropped first), and the next block is fetched
   ahead. Revisiting a recent place costs nothing. Falls back to jsfetch if the server
   gives no file size. */
const AVI_BLOCK = 512 * 1024, AVI_BLOCKS_KEPT = 48;
async function aviFileSize(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { Range: 'bytes=0-0' } });
      const cr = r.headers.get('Content-Range') || '';
      const m = /\/(\d+)\s*$/.exec(cr);
      const len = Number(r.headers.get('Content-Length')) || 0;
      try { if (r.body) r.body.cancel(); } catch {}
      if (m) return Number(m[1]);
      if (r.status === 200 && len > 0) return len;
      if (r.ok) return 0;
    } catch {}
    await new Promise(res => setTimeout(res, 400 * (i + 1)));
  }
  return 0;
}
async function openAviBlockFile(libav, url) {
  const size = await aviFileSize(url);
  if (!size) return null;
  const name = 'emby-' + Math.random().toString(36).slice(2, 10) + '.avi';
  await libav.mkblockreaderdev(name, size);
  const cache = new Map();   // block index -> Promise<Uint8Array>, oldest first
  const stats = { requests: 0, hits: 0, bytes: 0 };
  let closed = false;
  const getBlock = (bi) => {
    const have = cache.get(bi);
    if (have) { cache.delete(bi); cache.set(bi, have); stats.hits++; return have; }
    const start = bi * AVI_BLOCK, end = Math.min(size, start + AVI_BLOCK) - 1;
    const p = (async () => {
      let last;
      for (let i = 0; i < 4; i++) {
        if (closed) throw new Error('closed');
        try {
          stats.requests++;
          const r = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          let buf = new Uint8Array(await r.arrayBuffer());
          if (r.status === 200 && buf.length > end - start + 1) buf = buf.subarray(start, end + 1);   // a server that ignores Range
          stats.bytes += buf.length;
          return buf;
        } catch (e) { last = e; await new Promise(res => setTimeout(res, 300 * (i + 1))); }
      }
      throw last;
    })();
    p.catch(() => { if (cache.get(bi) === p) cache.delete(bi); });
    cache.set(bi, p);
    while (cache.size > AVI_BLOCKS_KEPT) cache.delete(cache.keys().next().value);
    return p;
  };
  libav.onblockread = (fname, pos, len) => {
    if (fname !== name || closed) return;
    const bi = Math.floor(pos / AVI_BLOCK);
    getBlock(bi).then(buf => {
      if (closed) return;
      libav.ff_block_reader_dev_send(name, bi * AVI_BLOCK, buf);
      if ((bi + 1) * AVI_BLOCK < size) getBlock(bi + 1).catch(() => {});
    }, e => { if (!closed) libav.ff_block_reader_dev_send(name, pos, null, { error: e }); });
  };
  return { name, size, stats, close() { closed = true; cache.clear(); try { libav.unlink(name); } catch {} } };
}

function resetLibavMp4v(l) {
  if (l && _libavMp4v && l !== _libavMp4v) return;   // already replaced
  const old = _libavMp4v || l;
  _libavMp4v = null; _libavMp4vPromise = null;
  try { if (old && typeof old.terminate === 'function') old.terminate(); } catch {}
}

/* Sound the mp4v build cannot decode (it has MP3 only). AVI files carry AC-3,
   MP2 and PCM too, and those failed outright ("Codec not found", "Format
   error"). AC-3/E-AC-3/DTS go to the Dolby build, MP2 to the JavaScript
   decoder (both via openAudioDecoder), PCM is unpacked here. Same frame
   shape as libav's, so the downmix and encoder are shared. Null: no decoder. */
/* AC-3 IN AN AVI ARRIVES IN PIECES (24 Oct 2026). The AVI build has no AC-3
   parser, so its packets are the file's chunks as stored, and the muxers of the DivX years
   cut the AC-3 bytes wherever a chunk ended. Measured on a stand-in mono AC-3 AVI cut into
   1000-byte chunks: 34 "incomplete frame" errors in 15 s (damaged sound). One damaged frame
   in a file stopped the whole conversion ("Error submitting the packet to the decoder"),
   the 'G' Men (1935) fault. So the bytes are put back into whole sync frames here (sync
   word 0x0B77, frame size from the header), a damaged frame is skipped, and the decoder
   only ever sees one frame at a time. */
const AC3_KBPS = [32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 448, 512, 576, 640];
function ac3FrameBytes(b, i) {
  const bsid = b[i + 5] >> 3;
  if (bsid > 16) return 0;
  if (bsid > 10) return ((((b[i + 2] & 7) << 8) | b[i + 3]) + 1) * 2;   // E-AC-3: frmsiz in words
  const fscod = b[i + 4] >> 6, code = b[i + 4] & 0x3f;
  if (fscod === 3 || code > 37) return 0;
  const kbps = AC3_KBPS[code >> 1];
  if (fscod === 0) return kbps * 4;                                       // 48 kHz
  if (fscod === 2) return kbps * 6;                                       // 32 kHz
  return (Math.floor(kbps * 96000 / 44100) + (code & 1)) * 2;             // 44.1 kHz
}
function ac3Framer(inner) {
  let pend = new Uint8Array(0);
  const take = (data) => {
    const d = data instanceof Uint8Array ? data : new Uint8Array(data);
    const all = new Uint8Array(pend.length + d.length); all.set(pend); all.set(d, pend.length);
    const frames = [];
    let i = 0;
    while (i + 6 <= all.length) {
      if (all[i] !== 0x0B || all[i + 1] !== 0x77) { i++; continue; }
      const n = ac3FrameBytes(all, i);
      if (!n) { i++; continue; }
      if (i + n > all.length) break;                                        // wait for the rest
      // A false sync inside the data: the next frame must start where this one ends.
      if (i + n + 2 <= all.length && (all[i + n] !== 0x0B || all[i + n + 1] !== 0x77)) { i++; continue; }
      frames.push(all.subarray(i, i + n)); i += n;
    }
    pend = all.slice(i);
    return frames;
  };
  return {
    decode: async (data, pts, sampleRate) => {
      const out = [];
      for (const f of take(data)) { try { out.push(...await inner.decode(f, pts, sampleRate)); } catch {} }
      return out;
    },
    flush: () => inner.flush(),
    free: () => inner.free(),
  };
}

async function openAviAudioDecoder(info) {
  const c = String((info && info.codec) || '').toLowerCase();
  const dec = DOLBY_DECODER[c];
  if (dec === 'ac3' || dec === 'eac3') return ac3Framer(await openAudioDecoder(dec));
  if (dec) return openAudioDecoder(dec);
  const pcm = /^pcm_(s16le|s16be|u8|s24le|s32le|f32le)$/.exec(c);
  if (pcm) {
    const ch = Math.max(1, Number(info.channels) || 2), sr = Number(info.sampleRate) || 48000, fmt = pcm[1];
    const bps = { s16le: 2, s16be: 2, u8: 1, s24le: 3, s32le: 4, f32le: 4 }[fmt];
    return {
      decode: async (data) => {
        const b = data instanceof Uint8Array ? data : new Uint8Array(data);
        const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
        const n = Math.floor(b.length / (bps * ch));
        if (!n) return [];
        const planes = Array.from({ length: ch }, () => new Float32Array(n));
        for (let i = 0; i < n; i++) for (let k = 0; k < ch; k++) {
          const o = (i * ch + k) * bps;
          let x;
          if (fmt === 's16le') x = dv.getInt16(o, true) / 32768;
          else if (fmt === 's16be') x = dv.getInt16(o, false) / 32768;
          else if (fmt === 'u8') x = (b[o] - 128) / 128;
          else if (fmt === 's24le') x = ((b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) << 8 >> 8) / 8388608;
          else if (fmt === 's32le') x = dv.getInt32(o, true) / 2147483648;
          else x = dv.getFloat32(o, true);
          planes[k][i] = x;
        }
        return [{ nb_samples: n, sample_rate: sr, channels: ch, data: planes }];
      },
      flush: async () => [],
      free: async () => {},
    };
  }
  return null;
}

// Pick an H.264 encoder config the browser accepts. Baseline/Main at level 3.1
// (0x1f) covers SD comfortably. Returns { name:'avc', mseCodec, config } or null.
async function pickVideoTarget(width, height, fps) {
  const cands = ['avc1.4d401f', 'avc1.42e01f', 'avc1.42001f', 'avc1.640020'];
  for (const codec of cands) {
    const config = {
      codec, width, height,
      bitrate: 4_000_000, framerate: fps || 25,
      avc: { format: 'avc' }, latencyMode: 'quality',
    };
    try {
      if (typeof VideoEncoder === 'undefined') break;
      const s = await VideoEncoder.isConfigSupported(config);
      if (s && s.supported) return { name: 'avc', mseCodec: codec, config };
    } catch {}
  }
  return null;
}

// Build a WebCodecs VideoFrame from a libav.js copied-out video frame. libav
// hands us the whole planar buffer plus a per-plane {offset,stride} layout, which
// is exactly the VideoFrame BufferInit shape. Only yuv420p/yuvj420p (I420) is
// handled; the mp4v build has no swscale, but Simple-Profile MPEG-4 is always
// 4:2:0 8-bit so that's all we need.
function libavFrameToVideoFrame(f, tsMicros) {
  const AV_PIX_FMT_YUV420P = 0, AV_PIX_FMT_YUVJ420P = 12;
  if (f.format !== AV_PIX_FMT_YUV420P && f.format !== AV_PIX_FMT_YUVJ420P) return null;
  const init = {
    format: 'I420',
    codedWidth: f.width,
    codedHeight: f.height,
    timestamp: tsMicros,
    layout: f.layout.map(l => ({ offset: l.offset, stride: l.stride })),
  };
  const cr = f.crop;
  if (cr && (cr.left || cr.top || cr.right || cr.bottom)) {
    init.visibleRect = {
      x: cr.left, y: cr.top,
      width: f.width - cr.left - cr.right, height: f.height - cr.top - cr.bottom,
    };
  }
  return new VideoFrame(f.data, init);
}

/**
 * transcodeToVideo(url, videoEl, opts)
 *   url     : Emby direct .avi stream URL (with api_key)
 *   videoEl : a <video> already in the DOM
 *   opts    : { onStart(), onError(err), durationSeconds }
 * Returns { destroy(), ready }, same shape as remuxToVideo.
 */
export function transcodeToVideo(url, videoEl, opts = {}) {
  const onStart = typeof opts.onStart === 'function' ? opts.onStart : () => {};
  const onError = typeof opts.onError === 'function' ? opts.onError : () => {};
  const durationSeconds = Number(opts.durationSeconds) || 0;
  /* RESUME (24 Oct). opts.startSeconds: the saved place to start from.
     The first run seeks there itself (key frame at or before it) instead of
     converting from 0 and then restarting, and the player's own jump to that
     place does not start a second run (see evaluateSeek). */
  const startSeconds = Math.max(0, Number(opts.startSeconds) || 0);

  const TX_DEBUG = false;  // flip to true to re-enable [transcode] seek diagnostics
  const tlog = (...a) => { if (TX_DEBUG) { try { console.log('%c[transcode]', 'color:#e0a94e', ...a); } catch {} } };
  const bufStr = () => {
    try { const b = sourceBuffer.buffered; let s = ''; for (let i = 0; i < b.length; i++) s += `[${b.start(i).toFixed(1)}-${b.end(i).toFixed(1)}]`; return s || 'empty'; }
    catch { return '?'; }
  };
  tlog('engine mp4v33 loaded');

  let destroyed = false;
  let started = false;
  let durationSet = false;
  let sourceFinished = false;
  let sourceBuffer = null;
  let inflight = null;
  const queue = [];

  const mediaSource = new MediaSource();
  const objectUrl = URL.createObjectURL(mediaSource);
  let resolveReady, rejectReady;
  const ready = new Promise((res, rej) => { resolveReady = res; rejectReady = rej; });

  function fail(err) {
    if (destroyed) return;
    const e = err instanceof Error ? err : new Error(String(err && err.message || err || 'Transcode failed'));
    try { rejectReady(e); } catch {}
    onError(e);
    cleanup();
    resetLibavMp4v(L);   // never let this instance near another file (see resetLibavMp4v)
  }
  function markStarted() {
    if (started || destroyed) return;
    started = true;
    try { resolveReady(); } catch {}
    onStart();
  }
  function maybeEndOfStream() {
    if (destroyed || !sourceFinished) return;
    if (queue.length || inflight) return;
    if (mediaSource.readyState !== 'open') return;
    try { mediaSource.endOfStream(); } catch {}
  }
  function flush() {
    // NOTE: must NOT gate on `restarting` — the new run's output.start() writes the
    // init segment through this backpressured queue, and its write promise only
    // resolves once flush() appends it. Blocking here deadlocks the whole restart.
    if (destroyed || !sourceBuffer || sourceBuffer.updating || inflight) return;
    const item = queue.shift();
    if (!item) { maybeEndOfStream(); return; }
    inflight = item;
    try {
      sourceBuffer.appendBuffer(item.data);
    } catch (e) {
      inflight = null;
      if (e && e.name === 'QuotaExceededError') { queue.unshift(item); _evict(); return; }
      try { item.resolve(); } catch {}
      fail(e);
    }
  }
  function _evict() {
    try {
      const buffered = sourceBuffer.buffered;
      const cur = videoEl.currentTime;
      if (buffered.length && cur - buffered.start(0) > 12)
        sourceBuffer.remove(buffered.start(0), Math.max(buffered.start(0), cur - 8));
    } catch {}
  }
  function onUpdateEnd() {
    if (inflight) { const it = inflight; inflight = null; try { it.resolve(); } catch {} }
    if (!durationSet && durationSeconds > 0 && mediaSource.readyState === 'open' && !sourceBuffer.updating) {
      try { mediaSource.duration = durationSeconds; durationSet = true; } catch {}
    }
    flush();
  }
  const _pump = () => { if (!destroyed) flush(); };

  // --- seek / restart state ---
  const SEEK_TOLERANCE = 0.5;     // s: within a buffered range => MSE seeks itself
  const SEEK_DEBOUNCE_MS = 200;   // settle a scrub before restarting
  let generation = 0;             // bumped per run; a superseded run bails on mismatch
  let restarting = false;
  let pendingRestartTime = null;
  let seekTimer = null;

  // Fragmented-MP4 byte sink -> MSE append queue (with backpressure). gen-gated so
  // a superseded run's trailing writes are dropped (promises still resolved).
  function makeOutput(gen) {
    const writable = new WritableStream({
      write(data) {
        return new Promise((resolve) => {
          if (destroyed || gen !== generation) return resolve();
          queue.push({ data: data.slice(), resolve });
          flush();
        });
      },
      close() { if (gen === generation && !destroyed) { sourceFinished = true; maybeEndOfStream(); } },
      abort() { if (gen === generation) sourceFinished = true; },
    });
    return new Output({
      format: new Mp4OutputFormat({ fastStart: 'fragmented' }),
      target: new AppendOnlyStreamTarget(writable),
    });
  }

  // Persistent libav handles: the demuxer + decoders are REUSED across every seek-
  // restart (a restart just seeks + flushes them), so seeking doesn't re-open the
  // stream. Freed on teardown.
  let L = null, fmtCtx = null, readPkt = null, blockFile = null;
  let vDec = null, aDec = null;               // [c, pkt, frame] each
  let aAlt = null;                            // openAviAudioDecoder() when this build has no decoder for the sound
  let vIdx = -1, aIdx = -1, vTb = null, aTb = null, aSR = 48000;
  let vTarget = null, aTarget = null, currentMime = null;
  let setupDone = false;
  let curRun = null;                          // { output, vSource, aSource, vEncoder, aEncoder }

  // One-time: open the demuxer, resolve dimensions + encode targets, create the
  // SourceBuffer and the decoders. Runs once, on sourceopen.
  async function setup() {
    // A fresh instance for every file (2026-10-15): after six good AVI
    // conversions in one page the seventh still hit "memory access out of
    // bounds" at open, so the shared instance is not trusted across files at
    // all, not only after a failure. The module itself stays cached.
    resetLibavMp4v();
    const libav = L = await ensureLibavMp4v();
    if (destroyed) return false;

    blockFile = await openAviBlockFile(libav, url).catch(() => null);
    if (destroyed) return false;
    const [fc, streams] = await libav.ff_init_demuxer_file(blockFile ? blockFile.name : 'jsfetch:' + url);
    fmtCtx = fc;
    if (destroyed) return false;

    const vStream = streams.find(s => s.codec_type === libav.AVMEDIA_TYPE_VIDEO);
    // The chosen sound track (opts.audio.ordinal, among audio streams), else the first.
    const aStreams = streams.filter(s => s.codec_type === libav.AVMEDIA_TYPE_AUDIO);
    const aOrd = opts.audio && Number.isInteger(opts.audio.ordinal) ? opts.audio.ordinal : 0;
    const aStream = aStreams[aOrd] || aStreams[0];
    if (!vStream) throw new Error('No video stream in the file.');
    vIdx = vStream.index; aIdx = aStream ? aStream.index : -1;
    vTb = { num: vStream.time_base_num, den: vStream.time_base_den };
    aTb = aStream ? { num: aStream.time_base_num, den: aStream.time_base_den } : null;

    let vW = await libav.AVCodecParameters_width(vStream.codecpar);
    let vH = await libav.AVCodecParameters_height(vStream.codecpar);
    vW = (vW || 0) & ~1; vH = (vH || 0) & ~1;
    if (!vW || !vH) throw new Error('Could not read the video dimensions.');
    aSR = aStream ? (await libav.AVCodecParameters_sample_rate(aStream.codecpar) || 48000) : 48000;

    vTarget = await pickVideoTarget(vW, vH, 25);
    if (!vTarget) throw new Error('This browser has no H.264 encoder to transcode into.');

    // Decoders first, so a track nobody here can decode is known before the
    // SourceBuffer is made. MP3 decodes in this build; anything else is tried
    // in the other decoders (openAviAudioDecoder); with none at all the
    // conversion fails and the player hands the file to the server, which
    // plays it with sound, rather than playing it silent here.
    vDec = await libav.ff_init_decoder(vStream.codec_id, vStream.codecpar);
    if (aStream) {
      try { aDec = await libav.ff_init_decoder(aStream.codec_id, aStream.codecpar); } catch { aDec = null; }
      if (!aDec) {
        aAlt = await openAviAudioDecoder(Object.assign({ sampleRate: aSR }, opts.audio || {}));
        if (!aAlt) throw new Error('No decoder here for this file’s ' + String((opts.audio && opts.audio.codec) || 'audio').toUpperCase() + ' sound.');
        if (opts.audio && opts.audio.sampleRate) aSR = opts.audio.sampleRate;
      }
    }
    aTarget = aStream ? await pickAudioTarget(aSR) : null;
    if (destroyed) return false;

    const codecs = [vTarget.mseCodec, aTarget && aTarget.mseCodec].filter(Boolean).join(',');
    const mime = currentMime = `video/mp4; codecs="${codecs}"`;
    if (!mseSupported(mime)) throw new Error('The browser can\'t play the transcoded stream (' + mime + ').');

    sourceBuffer = mediaSource.addSourceBuffer(mime);
    sourceBuffer.mode = 'segments';
    sourceBuffer.addEventListener('updateend', onUpdateEnd);
    sourceBuffer.addEventListener('error', () => {
      const me = videoEl.error;
      const info = `rs=${mediaSource.readyState} mediaErr=${me ? me.code + ':' + (me.message || '') : 'none'} buf=${bufStr()} t=${videoEl.currentTime.toFixed(1)}`;
      tlog('SourceBuffer error event —', info);
      fail(new Error('SourceBuffer append error [' + info + '].'));
    });

    readPkt = await libav.av_packet_alloc();
    setupDone = true;
    return true;
  }

  // Fire-and-forget: closing encoders is sync, and awaiting output.cancel() can
  // hang if a mux add() is mid-flight, which would stall the whole restart.
  function closeRun(run) {
    if (!run) return;
    try { if (run.vEncoder && run.vEncoder.state !== 'closed') run.vEncoder.close(); } catch {}
    try { if (run.aEncoder && run.aEncoder.state !== 'closed') run.aEncoder.close(); } catch {}
    try { const p = run.output.cancel(); if (p && p.catch) p.catch(() => {}); } catch {}
  }

  // Convert a decoded frame's best_effort_timestamp (in stream time base `tb`) to
  // microseconds, or null when there's no usable pts.
  function tsFromFrame(f, tb) {
    const noPts = (f.best_effort_timestamp == null) || (f.best_effort_timestamphi === -2147483648) || !Number.isFinite(f.best_effort_timestamp);
    if (noPts || !tb || !tb.den) return null;
    const ts = f.best_effort_timestamp + (f.best_effort_timestamphi || 0) * 0x100000000;
    return Math.round(ts * tb.num / tb.den * 1e6);
  }

  /* Transcode from `fromSeconds` to EOF, or until a newer run supersedes this one
   * (generation bump). Video AND audio carry their REAL stream pts as timestamps,
   * so fragments land at their true time and MSE plays from currentTime with
   * timestampOffset 0 — no base-shifting. Returns once the pipeline is primed; the
   * read/decode/encode loop then runs DETACHED so a fresh seek never waits on it.
   *   needSeek=false : initial run from the file start (demuxer already at 0).
   *   needSeek=true  : seek-restart — libav seeks to the keyframe at/before target
   *                    and both decoders are flushed first. */
  async function startRun(fromSeconds, gen, needSeek) {
    const libav = L;
    const [, vC, vPkt, vFrame] = vDec;
    const [, aC, aPkt, aFrame] = aDec || [];

    if (needSeek) {
      const target = Math.max(0, Math.round(fromSeconds * vTb.den / vTb.num));
      let sret = -1;
      try { sret = await libav.av_seek_frame(fmtCtx, vIdx, target, 1 /* AVSEEK_FLAG_BACKWARD: keyframe <= target */); }
      catch (e) { tlog('av_seek_frame threw', e && e.message); }
      if (sret < 0) {
        try { sret = await libav.avformat_seek_file_approx(fmtCtx, vIdx, target, 0); }
        catch (e) { tlog('approx seek threw', e && e.message); }
      }
      tlog('seek ->', fromSeconds.toFixed(1) + 's', 'target_tb=' + target, 'ret=' + sret);
      try { await libav.avcodec_flush_buffers(vC); } catch {}
      try { if (aC) await libav.avcodec_flush_buffers(aC); } catch {}
      if (aAlt) {   // the other decoders keep state across packets: a fresh one after a jump
        const old = aAlt;
        try { aAlt = await openAviAudioDecoder(Object.assign({ sampleRate: aSR }, opts.audio || {})) || old; } catch {}
        if (aAlt !== old) { try { await old.free(); } catch {} }
      }
    }
    if (gen !== generation || destroyed) return;

    const output = makeOutput(gen);
    const vSource = new EncodedVideoPacketSource(vTarget.name);
    output.addVideoTrack(vSource);
    const aSource = aTarget ? new EncodedAudioPacketSource(aTarget.name) : null;
    if (aSource) output.addAudioTrack(aSource);

    let muxLock = Promise.resolve();
    const mux = (fn) => { const r = muxLock.then(fn); muxLock = r.then(() => {}, () => {}); return r; };

    let encErr = null;
    const vPending = [], aPending = [];
    let vFirstMeta = null, vFirstAdded = false, aFirstMeta = null, aFirstAdded = false;

    const vEncoder = new VideoEncoder({
      output: (chunk, meta) => { if (meta && meta.decoderConfig && !vFirstMeta) vFirstMeta = meta; vPending.push(chunk); },
      error: (e) => { encErr = e; },
    });
    vEncoder.configure(vTarget.config);
    let aEncoder = null;
    if (aTarget) {
      aEncoder = makeAudioEncoder(aTarget, {
        output: (chunk, meta) => { if (meta && meta.decoderConfig && !aFirstMeta) aFirstMeta = meta; aPending.push(chunk); },
        error: (e) => { encErr = e; },
      });
      aEncoder.configure(aTarget.encConfig);
    }
    const run = { output, vSource, aSource, vEncoder, aEncoder };
    curRun = run;

    const drainVideo = async () => {
      while (vPending.length) {
        if (destroyed || gen !== generation) return;
        const packet = EncodedPacket.fromEncodedChunk(vPending.shift());
        const meta = vFirstAdded ? undefined : (vFirstMeta ? { decoderConfig: vFirstMeta.decoderConfig } : undefined);
        vFirstAdded = true;
        await mux(() => vSource.add(packet, meta));
      }
    };
    const drainAudio = async () => {
      if (!aSource) return;
      while (aPending.length) {
        if (destroyed || gen !== generation) return;
        const packet = toPacket(aPending.shift());
        const meta = aFirstAdded ? undefined : (aFirstMeta ? { decoderConfig: aFirstMeta.decoderConfig } : undefined);
        aFirstAdded = true;
        await mux(() => aSource.add(packet, meta));
      }
    };

    await output.start();
    if (gen !== generation || destroyed) { try { await output.cancel(); } catch {} return; }

    // Real-time timestamps from the stream pts. Monotonic guard keeps the encoder
    // happy; audio anchors its sample counter to the first frame's real pts so it
    // stays aligned to the video keyframe after a seek.
    const FRAME_US = Math.round(1e6 / 25);
    let vCount = 0, lastVTs = -1, firstVideoTsUs = null;
    const nextVideoTs = (f) => {
      let micros = tsFromFrame(f, vTb);
      if (micros == null) micros = vCount * FRAME_US;
      if (micros <= lastVTs) micros = lastVTs + FRAME_US;
      lastVTs = micros;
      return micros;
    };
    let aAnchored = false, aSamplePos = 0;

    const encodeVideoFrames = (frames) => {
      for (const f of frames) {
        if (destroyed || gen !== generation) return;
        const ts = nextVideoTs(f);
        if (firstVideoTsUs == null) { firstVideoTsUs = ts; tlog('first V frame: ts=' + (ts / 1e6).toFixed(2) + 's fmt=' + f.format + ' ' + f.width + 'x' + f.height); }
        const vf = libavFrameToVideoFrame(f, ts);
        if (!vf) throw new Error('Unsupported pixel format (needs 4:2:0 8-bit).');
        vEncoder.encode(vf, { keyFrame: (vCount % 50) === 0 });
        vf.close();
        vCount++;
      }
    };
    const encodeAudioFrames = (frames) => {
      if (!aEncoder) return;
      for (const f of frames) {
        if (destroyed || gen !== generation) return;
        if (!f.nb_samples) continue;
        const sr = f.sample_rate || aSR;
        if (!aAnchored) {
          // Anchor the audio timeline to the VIDEO's first-frame time (reliable),
          // NOT the audio frame's own pts — after a seek the decoded MP3 frame's
          // best_effort_timestamp comes back corrupt (a bogus 64-bit value, e.g.
          // 229837s for a 199.5s seek), which parked the audio track 63h away from
          // the video and stalled MSE forever. Fall back to the seek target if a
          // video frame hasn't been seen yet.
          const anchorUs = (firstVideoTsUs != null) ? firstVideoTsUs : Math.round((fromSeconds || 0) * 1e6);
          aSamplePos = Math.round(anchorUs / 1e6 * sr);
          aAnchored = true;
          tlog('first A frame: anchored to ' + (anchorUs / 1e6).toFixed(2) + 's sr=' + sr);
        }
        const ad = frameToStereoAudioData(f, sr, Math.round(aSamplePos / sr * 1e6));
        aSamplePos += f.nb_samples;
        aEncoder.encode(ad); ad.close();
      }
    };

    // Detached read -> decode -> encode -> mux loop, in ~4 MB input bites so memory
    // stays flat. Gen-gated throughout; a stale error is swallowed.
    (async () => {
      /* SMALL FIRST BITES (24 Oct): a 4 MB bite is 300 to 800 frames that were all decoded
         before the first one could be shown (5 to 9.5 s to the first picture in the census).
         The first four bites are 256 KB, then 1 MB. Measured on stand-ins: 720p 9.1 s -> 2.7 s,
         standard definition under full CPU load 9.4 s -> 2.6 s. */
      let eof = false, bites = 0;
      while (!eof) {
        if (destroyed || gen !== generation) return;
        if (encErr) throw encErr;
        const [res, packets] = await libav.ff_read_frame_multi(fmtCtx, readPkt, { limit: (bites++ < 4 ? 256 : 1024) * 1024 });
        if (destroyed || gen !== generation) return;
        const vPkts = packets[vIdx] || [];
        const aPkts = (aIdx >= 0 && packets[aIdx]) || [];
        // ignoreErrors (24 Oct): one damaged frame is skipped instead of ending the whole
        // conversion (the 2081 "header damaged" stop).
        if (vPkts.length) encodeVideoFrames(await libav.ff_decode_multi(vC, vPkt, vFrame, vPkts, { fin: false, ignoreErrors: true }));
        if (aC && aPkts.length) encodeAudioFrames(await libav.ff_decode_multi(aC, aPkt, aFrame, aPkts, { fin: false, ignoreErrors: true }));
        else if (aAlt && aPkts.length) {
          const dec = aAlt;
          for (const p of aPkts) {
            if (destroyed || gen !== generation) return;
            encodeAudioFrames(await dec.decode(p.data, p.pts, aSR));
          }
        }
        await drainVideo(); await drainAudio();
        while (!destroyed && gen === generation && (vEncoder.encodeQueueSize > 8 || (aEncoder && aEncoder.encodeQueueSize > 8))) await new Promise(r => setTimeout(r, 4));
        while (!destroyed && gen === generation && queue.length > 24) await new Promise(r => setTimeout(r, 8));
        // -6 is ff_read_frame_multi's "hit the byte limit, call again" sentinel,
        // NOT an error; only AVERROR_EOF ends the stream.
        if (res === libav.AVERROR_EOF) eof = true;
        else if (res !== -6 && res < 0) throw new Error('Read error ' + res + '.');
      }
      if (destroyed || gen !== generation) return;
      encodeVideoFrames(await libav.ff_decode_multi(vC, vPkt, vFrame, [], true).catch(() => []));
      if (aC) encodeAudioFrames(await libav.ff_decode_multi(aC, aPkt, aFrame, [], true).catch(() => []));
      else if (aAlt) encodeAudioFrames(await aAlt.flush().catch(() => []));
      await vEncoder.flush();
      if (aEncoder) await aEncoder.flush();
      if (encErr) throw encErr;
      await drainVideo(); await drainAudio();
      if (destroyed || gen !== generation) return;
      vSource.close();
      if (aSource) aSource.close();
      await output.finalize();
      if (gen !== generation || destroyed) return;
      sourceFinished = true;
      maybeEndOfStream();
    })().catch((e) => { if (!destroyed && gen === generation) fail(e); });
  }

  // --- seek engine (mirrors the remux path) ---
  function isBuffered(t) {
    try {
      const b = sourceBuffer && sourceBuffer.buffered;
      if (!b) return false;
      for (let i = 0; i < b.length; i++) if (t >= b.start(i) - SEEK_TOLERANCE && t <= b.end(i) + SEEK_TOLERANCE) return true;
    } catch {}
    return false;
  }
  function clearBuffer() {
    return new Promise((resolve) => {
      if (destroyed || !sourceBuffer) return resolve();
      // Let any in-flight append FINISH first (aborting mid-segment leaves partial
      // bytes in the parser, which then corrupt the next run's init segment). Only
      // once idle do we remove everything.
      const doRemove = () => {
        try {
          const hasBuf = sourceBuffer.buffered && sourceBuffer.buffered.length > 0;
          if (!hasBuf) return resolve();
          const end = (Number.isFinite(mediaSource.duration) && mediaSource.duration > 0) ? mediaSource.duration : Infinity;
          const onEnd = () => { try { sourceBuffer.removeEventListener('updateend', onEnd); } catch {} resolve(); };
          sourceBuffer.addEventListener('updateend', onEnd);
          sourceBuffer.remove(0, end);
        } catch { resolve(); }
      };
      if (sourceBuffer.updating) {
        const onIdle = () => { try { sourceBuffer.removeEventListener('updateend', onIdle); } catch {} doRemove(); };
        sourceBuffer.addEventListener('updateend', onIdle);
      } else doRemove();
    });
  }
  // Seek-restart: invalidate the running run, clear the buffer, seek libav to the
  // keyframe at/before the target and transcode from there. Reuses the same
  // MediaSource/SourceBuffer (no reload flash).
  async function restart(toSeconds) {
    if (destroyed || !setupDone || !sourceBuffer) return;
    if (restarting) { pendingRestartTime = toSeconds; return; }
    tlog('restart -> ' + toSeconds.toFixed(1) + 's (gen ' + (generation + 1) + ')');
    restarting = true;              // blocks flush() so no append races the teardown
    try {
      generation++;                 // invalidate the running run NOW (its loop bails)
      const old = curRun; curRun = null;
      closeRun(old);                // fire-and-forget (see closeRun); never blocks
      // Drop queued (not-yet-appended) fragments from the old run.
      while (queue.length) { const it = queue.shift(); try { it.resolve(); } catch {} }
      sourceFinished = false;
      await clearBuffer();           // waits for any in-flight append, then removes all
      if (destroyed) return;
      // changeType resets the segment parser to expect a fresh init segment, so the
      // new run's ftyp+moov can't be concatenated onto a stale/partial one.
      try { if (sourceBuffer.changeType) sourceBuffer.changeType(currentMime); } catch {}
      try { sourceBuffer.timestampOffset = 0; } catch {}
      await startRun(toSeconds, generation, true);
    } catch (e) { if (!destroyed) fail(e); }
    finally {
      restarting = false;
      _pump();                       // resume appends (drains the new run's init + fragments)
      if (!destroyed && pendingRestartTime !== null) {
        const next = pendingRestartTime; pendingRestartTime = null;
        if (!isBuffered(next)) restart(next);
      }
    }
  }
  function evaluateSeek() {
    if (destroyed || !sourceBuffer) return;
    const t = videoEl.currentTime;
    tlog('evaluateSeek t=' + t.toFixed(1) + ' buffered=' + isBuffered(t) + ' buf=' + bufStr());
    if (isBuffered(t)) return;      // MSE seeks within the buffered range itself
    // The jump to the resume place, before the first run has buffered anything:
    // that run already starts there, so wait for it instead of starting again.
    if (startSeconds > 0 && !restarting && !sourceFinished && generation === 0 && Math.abs(t - startSeconds) < 1) {
      let empty = true; try { empty = !sourceBuffer.buffered.length; } catch {}
      if (empty) return;
    }
    restart(t);
  }
  function onSeek() {
    if (destroyed) return;
    if (seekTimer) clearTimeout(seekTimer);
    seekTimer = setTimeout(() => { seekTimer = null; evaluateSeek(); }, SEEK_DEBOUNCE_MS);
  }

  function cleanup() {
    if (seekTimer) { clearTimeout(seekTimer); seekTimer = null; }
    closeRun(curRun); curRun = null;
    (async () => {
      try { if (L && vDec) await L.ff_free_decoder(vDec[0], vDec[1], vDec[2]); } catch {}
      try { if (L && aDec) await L.ff_free_decoder(aDec[0], aDec[1], aDec[2]); } catch {}
      try { if (aAlt) await aAlt.free(); } catch {}
      try { if (L && readPkt) await L.av_packet_free_js(readPkt); } catch {}
      try { if (L && fmtCtx) await L.avformat_close_input_js(fmtCtx); } catch {}
      try { if (blockFile) blockFile.close(); } catch {}
    })();
    try { if (mediaSource.readyState === 'open') mediaSource.endOfStream(); } catch {}
    try { URL.revokeObjectURL(objectUrl); } catch {}
    queue.length = 0; inflight = null;
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    generation++;                   // neutralize any in-flight run
    videoEl.removeEventListener('playing', markStarted);
    videoEl.removeEventListener('loadeddata', markStarted);
    videoEl.removeEventListener('timeupdate', _pump);
    videoEl.removeEventListener('waiting', _pump);
    videoEl.removeEventListener('seeking', _pump);
    videoEl.removeEventListener('seeking', onSeek);
    videoEl.removeEventListener('seeked', onSeek);
    try { videoEl.pause(); } catch {}
    cleanup();
    try { videoEl.removeAttribute('src'); videoEl.load(); } catch {}
  }

  mediaSource.addEventListener('sourceopen', function onOpen() {
    mediaSource.removeEventListener('sourceopen', onOpen);
    (async () => { if (await setup()) await startRun(startSeconds, generation, startSeconds > 0); })().catch((e) => { if (!destroyed) fail(e); });
  });
  // Resume: put the playhead on the saved place once the stream has a timeline
  // (the player's tracker does the same; whichever runs first, the second is a no-op).
  if (startSeconds > 0) videoEl.addEventListener('loadedmetadata', () => { try { if (!destroyed && videoEl.currentTime < 1) videoEl.currentTime = startSeconds; } catch {} }, { once: true });
  videoEl.addEventListener('playing', markStarted);
  videoEl.addEventListener('loadeddata', markStarted);
  videoEl.addEventListener('timeupdate', _pump);
  videoEl.addEventListener('waiting', _pump);
  videoEl.addEventListener('seeking', _pump);
  videoEl.addEventListener('seeking', onSeek);
  videoEl.addEventListener('seeked', onSeek);
  videoEl.src = objectUrl;

  return { destroy, ready };
}

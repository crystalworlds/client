/*
 * subsync.js -- line subtitles up with the speech in the soundtrack (2026-10-04).
 *
 * Loaded on demand by subs.js (the first Auto-sync), never at page load. Also
 * runs as its own Web Worker (the same file) so the number crunching never
 * competes with the picture.
 *
 * THE METHOD (own code; the published tools ffsubsync and alass were read for
 * the idea only -- speech/no-speech signals aligned by correlation -- nothing
 * is copied from either):
 *   1. Speech presence, every 10 ms, from the audio alone. No speech-to-text.
 *      A 16 ms window every 10 ms -> 12 bands across 300-3500 Hz -> for each
 *      band a noise floor tracked by minimum statistics over the last ~1.5 s
 *      -> how far each band stands above its floor (dB, capped) -> averaged.
 *      Steady music and hum sit in the floor; speech, which comes and goes
 *      several times a second, stands out of it. Result: a continuous score,
 *      not a yes/no, so no threshold has to be guessed per film.
 *   2. Cue presence, every 10 ms: 1 while a cue would be on screen.
 *   3. (2026-10-10, the simple model; see "THE SIMPLE MODEL" below) The
 *      heard soundtrack is cut into regions; for each of five known speeds
 *      every region finds its own best offset; offsets two or more regions
 *      agree on become segments (one offset each: advert breaks, a different
 *      cut). The best speed is applied once it clearly beats x1, a plain
 *      offset as soon as two regions agree, and both are refined after every
 *      window read. Rounds 1-5 (a single all-or-nothing gate of peak z,
 *      runner-up, halves and segment checks) were replaced by decision
 *      of 2026-10-08; their notes are in the site backups.
 *   4. Clock check: the server's MP3 has no timestamps, so an audio track
 *      that starts later than the video (a muxing delay) shifts the whole
 *      match. After a match from the server soundtrack, ~40 s of the
 *      player's own sound is compared with it and a lag of 0.4 s or more is
 *      corrected. (Not needed for windows read from the file itself: they
 *      carry the file's own timing.)
 *
 * GETTING THE AUDIO. Asked from Emby as a small mono MP3 (16 kHz, 32 kb/s,
 * ~14 MB for two hours):
 *   GET /Audio/{ItemId}/stream.mp3?MediaSourceId&AudioStreamIndex&AudioCodec=mp3
 *       &AudioSampleRate=16000&AudioChannels=1&AudioBitRate=32000&EnableAutoStreamCopy=false
 * Emby transcodes faster than real time. The bytes are cut at MP3 frame
 * boundaries into ~90 s pieces as they arrive, each decoded by the browser
 * (decodeAudioData) and placed on the timeline by counting frames, so no
 * error accumulates; the encoder + decoder delay (from the LAME tag, else the
 * LAME default of 576 + 529 samples) is taken off. Decoded samples are only
 * measured, never played.
 *   If that request fails, it falls back to listening while the film plays
 *   (captureStream -> a silent analysis graph) at normal speed, and solves
 *   once a few minutes have been heard. Slower, but it never stalls playback.
 */
(function () {
  'use strict';

  const HOP = 0.01;            // seconds per analysis frame
  const SR = 16000;            // analysis sample rate

  /* ------------------------------------------------------------- the FFT */

  function makeFFT(n) {
    const levels = Math.log2(n) | 0;
    const cos = new Float64Array(n / 2), sin = new Float64Array(n / 2), rev = new Uint32Array(n);
    for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos(2 * Math.PI * i / n); sin[i] = Math.sin(2 * Math.PI * i / n); }
    for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < levels; b++) r |= ((i >>> b) & 1) << (levels - 1 - b); rev[i] = r; }
    return function fft(re, im) {
      for (let i = 0; i < n; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
      for (let size = 2; size <= n; size <<= 1) {
        const half = size >>> 1, step = n / size;
        for (let i = 0; i < n; i += size) {
          for (let j = i, k = 0; j < i + half; j++, k += step) {
            const l = j + half;
            const tre = re[l] * cos[k] + im[l] * sin[k];
            const tim = -re[l] * sin[k] + im[l] * cos[k];
            re[l] = re[j] - tre; im[l] = im[j] - tim;
            re[j] += tre; im[j] += tim;
          }
        }
      }
    };
  }

  /* ------------------------------------------------------ speech detector */

  /* Streaming: push(pcm, startSample) any number of times, in time order, then
     result(). Frame k covers samples [k*160, k*160+256). */
  /* MODE 'contrast' (2026-10-10, the default): a real-file diagnostic on
     a control file (S26E09, narration over a music bed, 5.1) found the 'floor' score
     above saturated -- 87-99 % of frames above 3, on the mix and on the centre alone -- so
     the speech/no-speech pattern the matcher needs was gone. Contrast mode keeps each band's
     log power and scores every frame against that band's own mean over the 2.5 s either
     side: a steady bed cancels, a narrator's pauses between sentences go negative, and the
     sentences positive. Computed when result() is asked for (needs the frames after it).
     'floor' (the old score) is kept for listening live, where result() is read every few ms. */
  const CONTRAST_R = 250;   // frames either side (2.5 s)
  function createVad(sr = SR, mode = 'contrast') {
    const H = Math.round(sr * HOP), N = 256, fft = makeFFT(N);
    const win = new Float64Array(N); for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
    const binHz = sr / N, lo = Math.max(1, Math.round(300 / binHz)), hi = Math.min(N / 2 - 1, Math.round(3500 / binHz));
    // 12 bands, log-spaced across lo..hi
    const NB = 12, edges = [];
    for (let b = 0; b <= NB; b++) edges.push(Math.round(lo * Math.pow(hi / lo, b / NB)));
    for (let b = 1; b <= NB; b++) if (edges[b] <= edges[b - 1]) edges[b] = edges[b - 1] + 1;
    const BLOCK = 25, NBLK = 6;                  // minimum statistics over 6 x 0.25 s
    const blkMin = Array.from({ length: NB }, () => new Float64Array(NBLK).fill(Infinity));
    const curMin = new Float64Array(NB).fill(Infinity);
    const prevP = new Float64Array(NB);
    let blkPos = 0, blkFill = 0, framesSeen = 0;
    let out = new Float32Array(1 << 16), outLen = 0;
    let lps = mode === 'contrast' ? new Float32Array(NB << 16).fill(NaN) : null;   // band log power per frame
    const re = new Float64Array(N), im = new Float64Array(N);
    let tail = new Float32Array(0), tailStart = 0;   // samples carried between pushes

    function ensure(k) {
      if (k < out.length) return;
      let n = out.length; while (n <= k) n *= 2;
      const o = new Float32Array(n); o.set(out); out = o;
      if (lps) { const l2 = new Float32Array(NB * n).fill(NaN); l2.set(lps); lps = l2; }
    }
    function frame(buf, off, k) {
      for (let i = 0; i < N; i++) { re[i] = (buf[off + i] || 0) * win[i]; im[i] = 0; }
      fft(re, im);
      let score = 0;
      for (let b = 0; b < NB; b++) {
        let p = 1e-10;
        for (let i = edges[b]; i < edges[b + 1]; i++) p += re[i] * re[i] + im[i] * im[i];
        const ps = 0.5 * (p + prevP[b]); prevP[b] = p;     // light smoothing before the floor
        if (lps) { ensure(k); lps[k * NB + b] = 10 * Math.log10(ps); }
        if (ps < curMin[b]) curMin[b] = ps;
        let floor = curMin[b];
        for (let j = 0; j < NBLK; j++) if (blkMin[b][j] < floor) floor = blkMin[b][j];
        const snr = 10 * Math.log10(ps / (floor * 2 + 1e-10));
        score += snr < 0 ? 0 : snr > 25 ? 25 : snr;
      }
      if (++blkFill >= BLOCK) {
        for (let b = 0; b < NB; b++) { blkMin[b][blkPos] = curMin[b]; curMin[b] = Infinity; }
        blkPos = (blkPos + 1) % NBLK; blkFill = 0;
      }
      ensure(k);
      out[k] = score / NB;
      if (k + 1 > outLen) outLen = k + 1;
      framesSeen++;
    }
    return {
      push(pcm, startSample) {
        // Join to the carried tail when contiguous; otherwise start fresh at startSample.
        let buf, base;
        if (tail.length && Math.abs(tailStart + tail.length - startSample) <= 2) {
          buf = new Float32Array(tail.length + pcm.length); buf.set(tail); buf.set(pcm, tail.length); base = tailStart;
        } else { buf = pcm; base = startSample; }
        let k = Math.ceil(Math.max(0, base) / H);
        for (; k * H - base + N <= buf.length; k++) { const off = k * H - base; if (off >= 0) frame(buf, off, k); }
        const keepFrom = Math.max(0, k * H - base);
        tail = buf.slice(keepFrom); tailStart = base + keepFrom;
      },
      result(m = mode) {
        if (m !== 'contrast' || !lps) return out.slice(0, outLen);
        const n = outLen, R = CONTRAST_R, o = new Float32Array(n), acc = new Float64Array(n), cntF = new Float64Array(n);
        for (let b = 0; b < NB; b++) {
          let sum = 0, c = 0;
          const v = i => lps[i * NB + b];
          for (let i = 0; i < Math.min(n, R); i++) { const x = v(i); if (x === x) { sum += x; c++; } }
          for (let k = 0; k < n; k++) {
            const add = k + R; if (add < n) { const x = v(add); if (x === x) { sum += x; c++; } }
            const rem = k - R - 1; if (rem >= 0) { const x = v(rem); if (x === x) { sum -= x; c--; } }
            const x = v(k);
            if (x === x && c > 0) { let d = x - sum / c; d = d < -15 ? -15 : d > 15 ? 15 : d; acc[k] += d; cntF[k]++; }
          }
        }
        for (let k = 0; k < n; k++) o[k] = cntF[k] ? acc[k] / cntF[k] : 0;
        return o;
      },
      frames: () => framesSeen,
    };
  }

  /* --------------------------------------------------------------- solver */

  /* THE SIMPLE MODEL (2026-10-10; replaces the all-or-nothing
     gate of rounds 1-5 by decision:"It should be applying a fix
     and updating the sync based on passing each test. Not wait for all five
     tests." The old gate refused The Mandalorian and Grogu at "peak z 4.0
     (needs 5 or more)" although it had found the right speed, x0.9990).

     The soundtrack heard so far is cut into REGIONS: each window read from the
     file (about 25 s), or about 40 s pieces of a longer stretch. Then, for each
     of only five known speeds (x1, x0.999 and x1.001 for 24 vs 23.976 fps,
     x1.0427 and x0.959 for 23.976 vs 25 fps, the PAL speed-up):
       1. every region finds its own best offset within +/-300 s, with its own
          evidence z (its peak against the rest of its curve);
       2. offsets that two or more regions agree on (within 0.5 s) are the
          candidate offsets -- one region alone is never enough;
       3. each region takes the candidate it fits best; regions next to each
          other with the same candidate form one SEGMENT. Several segments are
          a different cut or a broadcast with its advert breaks kept or removed:
          each segment gets its own offset, with the boundary between two lines;
       4. a speed's score is the evidence of the regions it explains, less a
          penalty for each extra segment (a wrong speed shows as a drift, which
          the segments can only follow in steps).
     The best speed is applied as soon as it clearly beats x1; until then x1
     is applied with its segments (which follow a drift in steps). A pure
     offset is applied as soon as two regions agree on it. Nothing waits for
     the whole film: the caller solves again after every window it reads and
     applies what changed. Differences under 0.5 s between regions are normal
     subtitle timing and only feed the fine timing, never a refusal.
     The result also says what is still uncertain (need), so the caller reads
     more of the file there instead of stopping at what it already had. */

  /* LEAD -- FITTED, not derived. Cue starts are put this far BEFORE the
     detected speech onset, so the text is up as the line begins. */
  const LEAD = 0.1;
  const SCALES = [1, 23.976 / 24, 24 / 23.976, 25 / 23.976, 23.976 / 25];
  // Thresholds, all in z units of a region's own correlation curve. FITTED on
  // the synthetic suite (subsync/tests.mjs, kept outside the site): right
  // regions sit at z 4-12, regions of another film's subtitles at 2-4.5.
  const T = { ZC: 3.5, ZM: 2.5, ZSUM: 7, ZA: 2.5, PEN: 3, MARGIN: 5, TOL: 50, REGMIN: 500, REGLEN: 4000, STEP: 2 };

  function solve(speech, cues0, opts = {}) {
    const n = speech.length;
    const t = Object.assign({}, T, opts.t || {});
    if (!n || !cues0 || !cues0.length) return { ok: false, reason: 'no data', failed: ['no data'], need: [] };
    const cues = cues0.filter(c => c.end > c.start).slice().sort((a, b) => a.start - b.start);
    // Normalise: cap loud bursts at the 98th percentile, zero mean / unit variance over the heard frames.
    const vals = []; for (let i = 0; i < n; i += 7) if (speech[i] === speech[i]) vals.push(speech[i]);
    vals.sort((a, b) => a - b);
    const cap = vals[Math.floor(vals.length * 0.98)] || 1;
    let sum = 0, sum2 = 0, cnt = 0;
    for (let i = 0; i < n; i++) { const v = speech[i]; if (v === v) { const c = v > cap ? cap : v; sum += c; sum2 += c * c; cnt++; } }
    const heard = +(cnt * HOP).toFixed(1);
    if (cnt < 1000) return { ok: false, reason: 'not enough heard yet', failed: ['not enough heard yet'], heard, need: ['more'] };
    const mean = sum / cnt, sd = Math.sqrt(Math.max(1e-12, sum2 / cnt - mean * mean));
    const P = new Float64Array(n + 1), Q = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) { const v = speech[i], ok = v === v; P[i + 1] = P[i] + (ok ? ((v > cap ? cap : v) - mean) / sd : 0); Q[i + 1] = Q[i] + (ok ? 1 : 0); }
    // Regions: heard stretches of 5 s or more; long ones cut into ~40 s pieces.
    const regions = [];
    { let a = -1; for (let i = 0; i <= n; i++) { const h = i < n && speech[i] === speech[i]; if (h && a < 0) a = i; else if (!h && a >= 0) { if (i - a >= t.REGMIN) regions.push([a, i]); a = -1; } } }
    for (let q = 0; q < regions.length; q++) { const [a, b] = regions[q]; if (b - a > 1.5 * t.REGLEN) { const k = Math.round((b - a) / t.REGLEN), parts = []; for (let u = 0; u < k; u++) parts.push([a + Math.floor(u * (b - a) / k), a + Math.floor((u + 1) * (b - a) / k)]); regions.splice(q, 1, ...parts); q += k - 1; } }
    if (!regions.length) return { ok: false, reason: 'not enough heard yet', failed: ['not enough heard yet'], heard, need: ['more'] };
    const MF = Math.round((opts.maxOffset || 600) / HOP), STEP = t.STEP, NC = Math.floor(2 * MF / STEP) + 1;
    const span = sc => {
      const S = new Int32Array(cues.length), E = new Int32Array(cues.length); let maxLen = 0;
      for (let i = 0; i < cues.length; i++) { S[i] = Math.round(cues[i].start * sc / HOP); E[i] = Math.max(S[i] + 1, Math.round(cues[i].end * sc / HOP)); maxLen = Math.max(maxLen, E[i] - S[i]); }
      return { sc, S, E, maxLen };
    };
    const lower = (A, v) => { let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m] < v) lo = m + 1; else hi = m; } return lo; };
    // speech under the lines shown at offset d, inside region [a, b)
    const regionVal = (sp, a, b, d) => {
      const S = sp.S, E = sp.E, N = S.length;
      let r = 0, w = 0;
      for (let i = lower(S, a - d - sp.maxLen); i < N && S[i] + d < b; i++) {
        let x = S[i] + d, y = E[i] + d; if (y <= a) continue; if (x < a) x = a; if (y > b) y = b;
        r += P[y] - P[x]; w += Q[y] - Q[x];
      }
      return w > 0 ? r / Math.sqrt(Math.max(w, 300)) : 0;
    };
    // EDGES (2026-10-10, narration over music: the control episode S26E09 has cues over 64-87 % of
    // the time, so whether a line is ON says little; where a line STARTS says a lot). Onset
    // strength: the rise of the speech score over 0.15 s, where all of it was heard, as z over
    // the heard frames, then the largest within +/-0.03 s. A cue start is matched 0.1 s before it.
    const ONM = new Float32Array(n);
    {
      const ON = new Float32Array(n); let s1 = 0, s2 = 0, c1 = 0;
      for (let k = 15; k + 15 <= n; k++) { if (Q[k + 15] - Q[k - 15] < 30) continue; const v = (P[k + 15] - P[k]) / 15 - (P[k] - P[k - 15]) / 15; ON[k] = v > 0 ? v : 0; s1 += ON[k]; s2 += ON[k] * ON[k]; c1++; }
      const mo = c1 ? s1 / c1 : 0, so = c1 ? Math.sqrt(Math.max(1e-12, s2 / c1 - mo * mo)) : 1;
      for (let k = 0; k < n; k++) ON[k] = (Q[Math.min(n, k + 1)] - Q[k] > 0) ? (ON[k] - mo) / so : 0;
      for (let k = 0; k < n; k++) { let m = -Infinity; for (let j = Math.max(0, k - 3); j <= Math.min(n - 1, k + 3); j++) if (ON[j] > m) m = ON[j]; ONM[k] = m; }
    }
    const MATCH = opts.match || 'both';
    const edgeVal = (sp, a, b, d) => {
      const S = sp.S, N = S.length; let r = 0, c = 0;
      for (let i = lower(S, a - d - 10); i < N && S[i] + d + 10 < b; i++) { const j = S[i] + d + 10; if (j < a) continue; r += ONM[j]; c++; }
      return c ? r / Math.sqrt(c) : 0;
    };
    const rise = j => { if (j < 5 || j + 5 > n) return 0; const v = (P[j + 5] - P[j]) / 5 - (P[j] - P[j - 5]) / 5; return v > 0 ? v : 0; };
    // Fine timing from speech ONSETS: cue starts are put on the sharpest rises of the speech score.
    const onsetBest = (starts, centre, radius) => {
      const sc = new Float64Array(2 * radius + 1);
      for (let k = -radius; k <= radius; k++) { let v = 0; for (let i = 0; i < starts.length; i++) v += rise(starts[i] + centre + k); sc[k + radius] = v; }
      let bi = 1; const sm = i => (sc[i - 1] + 2 * sc[i] + sc[i + 1]) / 4;
      for (let i = 1; i < sc.length - 1; i++) if (sm(i) > sm(bi)) bi = i;
      let frac = 0;
      if (bi > 1 && bi < sc.length - 2) { const a = sm(bi - 1), b = sm(bi), c = sm(bi + 1), den = a - 2 * b + c; if (den < 0) frac = 0.5 * (a - c) / den; }
      return centre + (bi - radius) + Math.max(-0.5, Math.min(0.5, frac));
    };
    // the same, with how clearly the onsets peak (z of the peak over the searched range)
    const onsetPick = (starts, centre, radius) => {
      const sc = new Float64Array(2 * radius + 1);
      for (let k = -radius; k <= radius; k++) { let v = 0; for (let i = 0; i < starts.length; i++) v += rise(starts[i] + centre + k); sc[k + radius] = v; }
      let m = 0, m2 = 0, mx = -Infinity; for (const v of sc) { m += v; m2 += v * v; if (v > mx) mx = v; } m /= sc.length;
      const sd = Math.sqrt(Math.max(1e-12, m2 / sc.length - m * m));
      return { d: onsetBest(starts, centre, radius), z: (mx - m) / sd };
    };
    const median = A => { const s = A.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

    const analyse = sc => {
      const sp = span(sc);
      // 1. every region's curve, best offset and evidence
      // Each region keeps two views of its curve: PRESENCE (lines on/off against the speech score)
      // and, unless switched off, PRESENCE + EDGES (line starts against speech onsets). The
      // control (S26E09, diag-real v2) found the right lag by presence in 5 of 8 windows while the
      // edge score was noise there; the documentary stand-in needed the edges. A region's evidence
      // at an offset is the better of the two.
      const zview = (c) => { let m = 0, m2 = 0, bi = 0; for (let j = 0; j < NC; j++) { m += c[j]; m2 += c[j] * c[j]; if (c[j] > c[bi]) bi = j; } m /= NC; const s = Math.sqrt(Math.max(1e-12, m2 / NC - m * m)); return { curve: c, m, s, bd: -MF + bi * STEP, bz: (c[bi] - m) / s }; };
      const regs = regions.map(([a, b]) => {
        const views = [];
        const pc = new Float32Array(NC);
        if (MATCH !== 'edge') { for (let j = 0; j < NC; j++) pc[j] = regionVal(sp, a, b, -MF + j * STEP); views.push(zview(pc)); }
        if (MATCH !== 'presence') {
          const e = new Float32Array(NC); let em = 0, em2 = 0;
          for (let j = 0; j < NC; j++) { const v = edgeVal(sp, a, b, -MF + j * STEP); e[j] = v; em += v; em2 += v * v; }
          em /= NC; const es = Math.sqrt(Math.max(1e-12, em2 / NC - em * em));
          const c = new Float32Array(NC), P0 = views[0];
          for (let j = 0; j < NC; j++) c[j] = (P0 ? (pc[j] - P0.m) / P0.s : 0) + (e[j] - em) / es;
          views.push(zview(c));
        }
        const top = views.reduce((x, y) => (y.bz > x.bz ? y : x));
        return { a, b, views, bd: top.bd, bz: top.bz };
      });
      const zAt = (r, d, tol) => {
        let best = { z: -Infinity, d };
        for (const v of r.views) {
          let j0 = Math.max(0, Math.ceil((d - tol + MF) / STEP)), j1 = Math.min(NC - 1, Math.floor((d + tol + MF) / STEP)), bv = -Infinity, bj = j0;
          for (let j = j0; j <= j1; j++) if (v.curve[j] > bv) { bv = v.curve[j]; bj = j; }
          const z = (bv - v.m) / v.s; if (z > best.z) best = { z, d: -MF + bj * STEP };
        }
        return best;
      };
      // 2. candidate offsets: regions whose own bests (in either view) agree.
      //    CONSENSUS (2026-10-10): 4 or more regions within 0.3 s of each other,
      //    spread over 10 minutes or more, are a candidate whatever each one's own margin -- with
      //    offsets searched over +/-600 s, one region lands within 0.3 s of a given offset by chance
      //    about 0.05 % of the time, so four agreeing is far beyond chance. Otherwise: a seed of z 3.5+
      //    and 2+ agreeing regions with enough evidence, as before.
      const bestsNear = (r, d, tol, zmin) => r.views.some(v => v.bz >= zmin && Math.abs(v.bd - d) <= tol);
      const seeds = [];
      for (const r of regs) for (const v of r.views) if (v.bz >= t.ZM) seeds.push({ bd: v.bd, bz: v.bz });
      seeds.sort((x, y) => y.bz - x.bz);
      const cl = [];
      for (const c of seeds) {
        if (cl.some(k => Math.abs(k.d - c.bd) <= 2 * t.TOL)) continue;   // steps under 1 s are timing, not a new segment
        const cons = regs.filter(r => bestsNear(r, c.bd, 30, t.ZM));
        const consSpan = cons.length ? (Math.max(...cons.map(r => r.a)) - Math.min(...cons.map(r => r.a))) * HOP : 0;
        const mem = regs.filter(r => bestsNear(r, c.bd, t.TOL, t.ZM));
        const sz = mem.reduce((u, r) => u + r.bz, 0);
        const ds = [];
        for (const r of mem) for (const v of r.views) if (v.bz >= t.ZM && Math.abs(v.bd - c.bd) <= t.TOL) { ds.push(v.bd); break; }
        if (cons.length >= 4 && consSpan >= 600) cl.push({ d: median(ds), n: mem.length, sz, consensus: cons.length });
        else if (c.bz >= t.ZC && (mem.length >= 3 || sz >= t.ZSUM) && mem.length >= 2) cl.push({ d: median(ds), n: mem.length, sz });
      }
      // 3. each region takes the candidate it fits best; neighbours with the same one form a segment
      // (a region that fits the previous region's candidate nearly as well keeps it: a segment
      // changes only where the evidence says so, not on a coin toss between two near-equal peaks)
      let prevQ = -1;
      const lab = regs.map(r => {
        // a region with fewer than 3 lines at a candidate's timing can't confirm it (MEASURED: music-only
        // stretches of the stand-in's opening took z 5-8 against a candidate with 0-2 lines there)
        const nLines = d => { const S = sp.S; let c = 0; for (let i = lower(S, r.a - d); i < S.length && S[i] + d < r.b; i++) c++; return c; };
        const zs = cl.map(k => nLines(k.d) >= 3 ? zAt(r, k.d, t.TOL).z : -Infinity);
        let best = -1, bz = t.ZA; zs.forEach((z, q) => { if (z >= bz) { bz = z; best = q; } });
        if (best >= 0 && prevQ >= 0 && best !== prevQ && zs[prevQ] >= t.ZA && zs[prevQ] >= bz - 1.5) { best = prevQ; bz = zs[prevQ]; }
        if (best >= 0) prevQ = best;
        return { q: best, z: best >= 0 ? bz : r.bz };
      });
      const segs = [];
      regs.forEach((r, i) => { if (lab[i].q < 0) return; const last = segs[segs.length - 1]; if (last && last.q === lab[i].q) last.r.push(i); else segs.push({ q: lab[i].q, r: [i] }); });
      let zs = 0; lab.forEach(x => { if (x.q >= 0) zs += x.z; });
      const matched = lab.filter(x => x.q >= 0).length;
      const score = zs - t.PEN * Math.max(0, segs.length - 1);
      const spanS = matched ? (regs[lab.map(x => x.q >= 0).lastIndexOf(true)].b - regs[lab.findIndex(x => x.q >= 0)].a) * HOP : 0;
      return { sc, sp, regs, cl, lab, segs, score, matched, spanS, zAt };
    };
    const all = (opts.scales || SCALES).map(analyse);
    const one = all.find(x => x.sc === 1) || all[0];
    let best = all.reduce((x, y) => (y.score > x.score + 1e-9 ? y : x), one);
    const margin = best.score - one.score;
    let scaleClear = true, pick = best;
    if (best !== one) {
      const enoughSpan = Math.abs(best.sc - 1) * best.spanS >= 1.0 || one.matched === 0;
      // a speed must also make the model simpler: fewer segments, or clearly more of the film explained
      // (steps for advert breaks at x1 otherwise pass for a slight speed with the same steps)
      const simpler = !one.segs.length || best.segs.length < one.segs.length || best.matched >= one.matched + 3;
      if (!(margin >= Math.max(t.MARGIN, 0.1 * best.score) && enoughSpan && simpler)) { scaleClear = false; pick = one.segs.length ? one : best; }
    }
    // The chosen speed's model is checked by the acceptance test; if it fails, the other speeds'
    // models are tried, best score first (MEASURED, round i: x0.999 subtitles whose x0.999 margin
    // was not yet clear were judged at x1, where the drift showed as back-and-forth steps).
    const finish = (A) => {
    const sp = A.sp, S = sp.S, E = sp.E, N = S.length;
    const need = [];
    const runs = A.regs.map((r, i) => ({ from: +(r.a * HOP).toFixed(1), to: +(r.b * HOP).toFixed(1), z: +A.lab[i].z.toFixed(1), seg: -1, res: null }));
    // The model must explain at least half of what was heard: another film's subtitles
    // find two stretches that agree by chance once dozens are read (MEASURED: 2-4 of
    // 38-48 stretches, z sum 7.6-9.7, tests.mjs "another film" cases); right ones explain most.
    // Regions with fewer than 3 lines under the model (music, a sparse opening) can't count against it.
    let counted = A.regs.length;
    if (A.segs.length) {
      const segOfReg = i => { let best = null, bd = Infinity; for (const g of A.segs) for (const j of g.r) { const dd = Math.abs(j - i); if (dd < bd) { bd = dd; best = g; } } return best; };
      for (let i = 0; i < A.regs.length; i++) {
        if (A.lab[i].q >= 0) continue;
        const g = segOfReg(i), d = A.cl[g.q].d, r = A.regs[i]; let c = 0;
        for (let j = lower(S, r.a - d); j < N && S[j] + d < r.b; j++) c++;
        if (c < 3) counted--;
      }
    }
    // (or, once 8+ regions agree, 30 %: reading more where it is unsure adds unmatched regions on purpose)
    if (A.segs.length && A.matched < 0.5 * counted && !(A.matched >= 8 && A.matched >= 0.3 * counted)) { A.segs = []; }
    if (!A.segs.length) {
      need.push('more');
      const failed = [A.regs.length < 2 ? 'only ' + A.regs.length + ' stretch of speech heard so far' : 'no two stretches of the soundtrack agree on an offset yet (' + A.regs.length + ' heard, best evidence z ' + Math.max(...A.regs.map(r => r.bz)).toFixed(1) + ')'];
      // MISMATCH (2026-10-10, a real-file test: three test episodes had
      // another episode's subtitles). 15 or more stretches of speech heard and none of the five
      // speeds explains them: these subtitles are not for this video. The caller stops reading.
      const mismatch = A.regs.length >= (opts.mismatchAfter || 15);
      if (mismatch) failed.push('none of the five speeds fits the ' + A.regs.length + ' stretches heard');
      return { ok: false, mismatch, reason: mismatch ? 'couldn’t confirm the timing yet' : 'no clear match yet', failed, need: mismatch ? [] : need, heard, regions: A.regs.length, matched: 0, scale: 1, offset: 0, runs, scales: all.map(x => ({ scale: x.sc, score: +x.score.toFixed(1), segs: x.segs.length, matched: x.matched })) };
    }
    // fine timing per segment, from the lines inside its regions
    const fine = [], ONSET_Z = opts.onsetZ || 4;
    const linesIn = (a, b, d) => { const out = []; for (let i = lower(S, a - d - sp.maxLen); i < N && S[i] + d < b; i++) if (E[i] + d > a + 20) out.push(i); return out; };   // lines on screen in [a, b) for 0.2 s or more
    // ORDER CHECK (2026-10-10, the narration feature on the 2-hour stand-in's sparse opening):
    // segments must follow each other in the SUBTITLES too -- segment k+1's lines after segment
    // k's. A segment whose lines fall among another's (A, B, A, B...) is a chance agreement in a
    // stretch with few lines: the weaker of the two (less evidence) is dropped, and its regions
    // count as unmatched, until the order holds.
    const segLines = g => { const c = A.cl[g.q].d; let lo = Infinity, hi = -Infinity; for (const i of g.r) for (const j of linesIn(A.regs[i].a, A.regs[i].b, c)) { if (j < lo) lo = j; if (j > hi) hi = j; } return [lo, hi]; };
    const segZ = g => g.r.reduce((u, i) => u + A.lab[i].z, 0);
    // Only the regions that break the order are dropped (those of A holding lines past B's first,
    // or those of B holding lines before A's last), whichever side has less evidence.
    const regLines = (i, q) => linesIn(A.regs[i].a, A.regs[i].b, A.cl[q].d);
    for (let guard = 0; guard < 40 && A.segs.length > 1; guard++) {
      let drop = null;
      for (let k = 0; k + 1 < A.segs.length && !drop; k++) {
        const g = A.segs[k], h = A.segs[k + 1], x = segLines(g), y = segLines(h);
        if (!(isFinite(x[1]) && isFinite(y[0]) && y[0] < x[1] - 3)) continue;
        const oa = g.r.filter(i => regLines(i, g.q).some(j => j > y[0] + 3)), ob = h.r.filter(i => regLines(i, h.q).some(j => j < x[1] - 3));
        const za = oa.reduce((u, i) => u + A.lab[i].z, 0), zb = ob.reduce((u, i) => u + A.lab[i].z, 0);
        drop = (oa.length && (!ob.length || za <= zb)) ? oa : ob.length ? ob : (segZ(g) < segZ(h) ? g.r : h.r);
      }
      if (!drop) break;
      const ds = new Set(drop);
      for (const i of ds) A.lab[i] = { q: -1, z: A.regs[i].bz };
      A.matched -= ds.size;
      for (const g of A.segs) g.r = g.r.filter(i => !ds.has(i));
      A.segs = A.segs.filter(g => g.r.length);
      for (let k = 0; k + 1 < A.segs.length; k++) if (A.segs[k].q === A.segs[k + 1].q) { A.segs[k].r = A.segs[k].r.concat(A.segs[k + 1].r); A.segs.splice(k + 1, 1); k--; }
    }
    // PRUNE (round i): a segment held up by only 1-2 regions that makes the model jump back and forth,
    // or need more than 3 timings, is a chance agreement among many regions read (MEASURED: x0.999
    // subtitles, 41 regions: the true offset with 12 regions plus one at -422 s with 2): dropped,
    // weakest first, until the model is simple or no such segment is left.
    {
      const dirOk = () => { const ds = A.segs.map(g => A.cl[g.q].d); const sg = ds.slice(1).map((d, k) => Math.sign(d - ds[k])); return sg.every(x => x === sg[0]); };
      // also, once 10+ regions match, any 1-2 region segment (MEASURED, t23 replay: reading on beside
      // strays made a 2-region "segment" at -408 s over a sparse opening; a real short segment gains a
      // third region from the reading beside it)
      const tooSmall = () => A.matched >= 10 && A.segs.some(g => g.r.length <= 2);
      for (let guard = 0; guard < 20 && A.segs.length > 1 && (A.segs.length > 3 || !dirOk() || tooSmall()); guard++) {
        const small = A.segs.filter(g => g.r.length <= 2);
        if (!small.length) break;
        const w = small.reduce((x, y) => (segZ(y) < segZ(x) ? y : x));
        for (const i of w.r) A.lab[i] = { q: -1, z: A.regs[i].bz };
        A.matched -= w.r.length;
        A.segs = A.segs.filter(g => g !== w);
        for (let k = 0; k + 1 < A.segs.length; k++) if (A.segs[k].q === A.segs[k + 1].q) { A.segs[k].r = A.segs[k].r.concat(A.segs[k + 1].r); A.segs.splice(k + 1, 1); k--; }
      }
    }
    runs.forEach((g, i) => { g.z = +A.lab[i].z.toFixed(1); });
    const segs = A.segs.map((g, k) => {
      const ds = g.r.map(i => A.zAt(A.regs[i], A.cl[g.q].d, t.TOL).d);
      const c = Math.round(median(ds));
      let ln = []; for (const i of g.r) ln = ln.concat(linesIn(A.regs[i].a, A.regs[i].b, c));
      // Fine timing from speech onsets only where they peak clearly; otherwise the presence peak.
      // (MEASURED, control episode S26E09: presence lags clustered at 0.0-0.14 s, the onsets pulled
      // the answer to +0.33 s -- narration over music has no clean onsets.)
      const op = ln.length >= 3 ? onsetPick(ln.map(i => S[i]), c, 50) : null;
      // onsets are used when they peak clearly AND agree with the presence peak within 0.2 s; the
      // presence peak needs no lead taken off (the cue's own lead is inside it: MEASURED -0.08 s
      // bias on every stand-in when LEAD was taken off it as well)
      const useOn = !!(op && op.z >= ONSET_Z && Math.abs(op.d - c) <= 20);
      const d = useOn ? op.d : c;
      fine.push(op ? { z: +op.z.toFixed(1), off: +((op.d - c) * HOP).toFixed(2), used: useOn ? 'onsets' : 'presence' } : { used: 'presence' });
      g.r.forEach((i, u) => { runs[i].seg = k; runs[i].res = +((ds[u] - c) * HOP).toFixed(2); });
      return { d, r: g.r, lines: ln, lead: useOn ? LEAD : 0 };
    });
    // Boundaries between segments, from the lines each segment's own regions heard: the
    // last line heard in A and the first heard in B. Lines between them that nobody heard
    // leave the boundary open (midway for now); the caller reads the film where those
    // lines would be under A's timing, which halves the open stretch each time.
    const ov = (i, d) => { d = Math.round(d); const x = Math.max(0, Math.min(n, S[i] + d)), y = Math.max(0, Math.min(n, E[i] + d)); return P[y] - P[x]; };
    const heardLine = (i, d) => { d = Math.round(d); const x = Math.max(0, Math.min(n, S[i] + d)), y = Math.max(0, Math.min(n, E[i] + d)); return Q[y] - Q[x] > 0; };
    const cuts = [], gaps = [];
    for (let k = 0; k + 1 < segs.length; k++) {
      const a = segs[k], b = segs[k + 1];
      const maxA = a.lines.length ? Math.max(...a.lines) : 0, minB = b.lines.length ? Math.min(...b.lines) : N - 1;
      let cut = minB;
      // lines between them heard under BOTH timings: the split that puts the most speech under them
      // (a line heard under one timing only says nothing: any audio has some speech score)
      const both = i => heardLine(i, a.d) && heardLine(i, b.d);
      const ovA = i => both(i) ? ov(i, a.d) : 0, ovB = i => both(i) ? ov(i, b.d) : 0;
      let anyHeard = false;
      for (let i = maxA + 1; i < minB; i++) if (both(i)) { anyHeard = true; break; }
      if (maxA >= minB) {
        // contested: a region next to the break holds lines of both sides; each side keeps the
        // lines whose speech fits its timing better (heard both ways), the split between them
        let acc = 0, tail = 0, bv = -Infinity;
        for (let i = minB; i <= maxA; i++) tail += ovB(i);
        for (let i = minB; i <= maxA + 1; i++) { const v = acc + tail; if (v > bv + 1e-9) { bv = v; cut = i; } if (i <= maxA) { acc += ovA(i); tail -= ovB(i); } }
      } else if (minB - maxA >= 2 && anyHeard) {
        let acc = 0, tail = 0, bv = -Infinity;
        for (let i = maxA + 1; i < minB; i++) tail += ovB(i);
        for (let i = maxA + 1; i <= minB; i++) { const v = acc + tail; if (v > bv) { bv = v; cut = i; } if (i < minB) { acc += ovA(i); tail -= ovB(i); } }
        let unheard = 0; for (let i = maxA + 1; i < minB; i++) if (!both(i)) unheard++;
        if (unheard >= 1) {
          const f0 = (S[maxA + 1] + a.d) * HOP, f1 = (E[minB - 1] + a.d) * HOP, g0 = (S[maxA + 1] + b.d) * HOP, g1 = (E[minB - 1] + b.d) * HOP;
          gaps.push({ from: +Math.min(f0, f1).toFixed(1), to: +Math.max(f0, f1).toFixed(1), from2: +Math.min(g0, g1).toFixed(1), to2: +Math.max(g0, g1).toFixed(1), lines: unheard });
          need.push('gap');
        }
      } else if (minB - maxA >= 2) {
        cut = (maxA + 1 + minB) >> 1;
        const f0 = (S[maxA + 1] + a.d) * HOP, f1 = (E[minB - 1] + a.d) * HOP, g0 = (S[maxA + 1] + b.d) * HOP, g1 = (E[minB - 1] + b.d) * HOP;
        gaps.push({ from: +Math.min(f0, f1).toFixed(1), to: +Math.max(f0, f1).toFixed(1), from2: +Math.min(g0, g1).toFixed(1), to2: +Math.max(g0, g1).toFixed(1), lines: minB - maxA - 1 });
        need.push('gap');
      }
      cuts.push(Math.max(1, Math.min(N - 1, cut)));
    }
    const offS = (d, lead = LEAD) => Math.round((d * HOP - lead) * 1000) / 1000;
    const sections = segs.length > 1 ? segs.map((g, k) => ({ from: k === 0 ? 0 : +(((cues[cuts[k - 1] - 1].end + cues[cuts[k - 1]].start) / 2)).toFixed(3), o: offS(g.d, g.lead), lines: (k + 1 < segs.length ? cuts[k] : N) - (k === 0 ? 0 : cuts[k - 1]) })) : null;
    // what is still uncertain: the caller reads more of the file there
    if (A.matched < 6) need.push('more');
    if (!scaleClear && best.score > one.score) need.push('speed');
    const stray = A.regs.map((r, i) => ({ r, i })).filter(({ r, i }) => A.lab[i].q < 0 && r.bz >= t.ZC);
    if (stray.length) need.push('stray');
    // Long stretches of the film with dialogue but no matched region (a segment may hide
    // there: the first part of a film with sparse dialogue, MEASURED in t20 "ads"): read more
    // there, unless four or more regions inside it were read already and none matched.
    const uncovered = [];
    {
      const fr = A.regs.filter((r, i) => A.lab[i].q >= 0).map(r => [r.a * HOP, r.b * HOP]);
      const segOf = i => { let k = 0; for (let q = 0; q < cuts.length; q++) if (i >= cuts[q]) k = q + 1; return segs[k]; };
      const first = (S[0] + segOf(0).d) * HOP, last = (S[N - 1] + segOf(N - 1).d) * HOP;
      const edges = [[-Infinity, Math.max(0, first)], ...fr, [Math.min(n * HOP, last), Infinity]];
      const GAP = Math.max(480, 0.08 * n * HOP);
      for (let q = 0; q + 1 < edges.length; q++) {
        const u = Math.max(0, edges[q][1]), v = Math.min(n * HOP, edges[q + 1][0]);
        if (v - u < GAP) continue;
        const ins = A.regs.filter(r => r.a * HOP >= u && r.b * HOP <= v);
        // the most promising unmatched region inside: more is read right beside it
        const hint = ins.length ? ins.reduce((x, y) => (y.bz > x.bz ? y : x)) : null;
        if (ins.length < 6) uncovered.push([+u.toFixed(1), +v.toFixed(1), hint && hint.bz >= 2.5 ? [+(hint.a * HOP).toFixed(1), +(hint.b * HOP).toFixed(1)] : null]);
      }
      if (uncovered.length) need.push('cover');
    }
    const failed = [];
    if (!scaleClear) failed.push('speed x' + best.sc.toFixed(4) + ' fits better than x1 by ' + margin.toFixed(1) + ' (applied once it is ' + Math.max(t.MARGIN, 0.1 * best.score).toFixed(1) + ' or more' + (Math.abs(best.sc - 1) * best.spanS < 1 ? ' and the matches span ' + Math.ceil(1 / Math.abs(best.sc - 1) / 60) + ' min or more' : '') + '); listening further');
    const model = sections ? 'sections' : A.sc !== 1 ? 'rate' : 'constant';
    // ACCEPTANCE (2026-10-10: a wrong file was SAVED under tag f with 8 segments,
    // offsets -805..+156 s, applied +325.7 s). Auto-sync applies only a model that passes the same
    // test as choosing a file: at most 3 segments, their offsets in one direction (advert breaks
    // kept or removed move the timing one way), and 60 % or more of the counted stretches matched.
    const dirs = sections ? sections.slice(1).map((x, k) => Math.sign(x.o - sections[k].o)) : [];
    const oneWay = dirs.every(d => d === dirs[0]);
    const enough = A.matched >= 0.6 * counted || (A.matched >= 8 && A.matched >= 0.3 * counted);
    const fitsNow = (!sections || sections.length <= 3) && oneWay && enough;
    if (!fitsNow) {
      // a mismatch (another file is looked for) only when nothing real agrees; a near fit keeps listening
      const mm = A.regs.length >= (opts.mismatchAfter || 15) && A.matched <= 3;
      const why = (sections && sections.length > 3 ? sections.length + ' different timings' : !oneWay ? 'timings that jump back and forth' : A.matched + ' of ' + counted + ' stretches matched (needs 60 %, or 30 % with 8 or more)');
      return { ok: false, mismatch: mm, reason: 'couldn’t confirm the timing yet', failed: ['the best fit needs ' + why].concat(failed), need: mm ? [] : need.concat('more'), heard, regions: A.regs.length, matched: A.matched, scale: 1, offset: 0, runs,
        scales: all.map(x => ({ scale: x.sc, score: +x.score.toFixed(1), segs: x.segs.length, matched: x.matched })), cands: A.cl.map(k => [+(k.d * HOP).toFixed(2), k.n, +k.sz.toFixed(1)]) };
    }
    return {
      ok: true, offset: offS(segs[0].d, segs[0].lead), scale: A.sc, sections, model, heard,
      // already right: no speed, one segment, within 0.2 s -- reported as a result, not a change
      // FITS: the stricter test used to CHOOSE a subtitle file (another file, another episode, a search
      // result): at most 3 segments and 60 % or more of the counted stretches matched. MEASURED (t21,
      // round g): a wrong file's lines found 7 short segments at x0.959 and were downloaded.
      fits: true,   // the acceptance test above
      inSync: A.sc === 1 && !sections && Math.abs(offS(segs[0].d, segs[0].lead)) < 0.2, regions: A.regs.length, matched: A.matched,
      scaleClear, scaleMargin: +margin.toFixed(1), bestScale: best.sc,
      fine,
      cands: A.cl.map(k => [+(k.d * HOP).toFixed(2), k.n, +k.sz.toFixed(1)]),
      scales: all.map(x => ({ scale: x.sc, score: +x.score.toFixed(1), segs: x.segs.length, matched: x.matched })),
      peakZ: +Math.max(...A.lab.map(x => x.q >= 0 ? x.z : 0)).toFixed(1),
      runs, segments: runs, gaps, uncovered, cutGaps: gaps.length ? gaps : null, stray: stray.map(({ r }) => [+(r.a * HOP).toFixed(1), +(r.b * HOP).toFixed(1)]),
      need, failed, reason: need.length ? 'applied; still listening (' + need.join(', ') + ')' : 'settled',
    };
    };
    let res = finish(pick);
    if (!res.ok) for (const alt of all.filter(x => x !== pick && x.segs.length).sort((x, y) => y.score - x.score)) { const r2 = finish(alt); if (r2.ok) { r2.scaleClear = false; res = r2; break; } }
    return res;
  }

  /* Where a cue that starts at subtitle time t is shown, for a solve() result
     (or a saved record {offset, scale, sections}): scale * t + the offset of
     the section t falls in. */
  function shownAt(r, t) {
    let o = r.offset;
    if (r.sections) for (const x of r.sections) if (t >= x.from) o = x.o + (r.offset - r.sections[0].o);
    return r.scale * t + o;
  }

  /* ------------------------------------------------- windowed reading plan */

  /* WHERE TO READ. ~14 windows of 25 s placed by subtitle lines (so every
     window has dialogue), read in an order that spreads them early (first,
     last, middle, quarters, ...) so the first answer comes after two windows.
     Then, while the solver says something is uncertain (need), more windows:
     the middle of the widest stretch not read yet (more evidence, a speed),
     the middle of an unresolved boundary between two segments (halving it),
     and next to a region that fits no candidate (an unconfirmed segment). */
  function initialWindows(dur, cues, K = 14, W = 25) {
    const out = [];
    const cs = (cues || []).filter(c => c.start >= 0 && c.start < dur).sort((a, b) => a.start - b.start);
    if (cs.length >= K * 5) {
      for (let i = 0; i < K; i++) { const c = cs[Math.floor((i + 0.5) * cs.length / K)].start; out.push([Math.max(0, c - W / 2), Math.min(dur, c + W / 2)]); }
    } else for (let i = 0; i < K; i++) { const c = dur * (0.03 + 0.88 * (i + 0.5) / K); out.push([Math.max(0, c - W / 2), Math.min(dur, c + W / 2)]); }
    // spread order: 0, last, middle, then the middles of the halves, ...
    const order = [], seen = new Set(), push = i => { if (i >= 0 && i < K && !seen.has(i)) { seen.add(i); order.push(i); } };
    push(0); push(K - 1);
    for (let parts = 2; order.length < K; parts *= 2) for (let j = 1; j < parts; j += 2) push(Math.round(j * (K - 1) / parts));
    for (let i = 0; i < K; i++) push(i);
    return order.map(i => out[i]);
  }
  function moreWindows(r, have, dur, cues, W = 25) {
    if (!r || !r.need || !r.need.length) return [];
    const out = [];
    const free = (a, b) => { let parts = [[a, b]]; for (const [x, y] of have) parts = parts.flatMap(([u, v]) => (y <= u || x >= v) ? [[u, v]] : [[u, Math.max(u, x)], [Math.min(v, y), v]]).filter(([u, v]) => v - u > 2); return parts; };
    // a boundary between two segments: halve the unread part; read it whole when short
    // (the open lines are read where either timing would put them: under A's, and under B's)
    for (const g of (r.gaps || [])) {
      let parts = free(g.from - 3, g.to + 3);
      if (g.from2 != null) parts = parts.concat(free(g.from2 - 3, g.to2 + 3));
      parts.sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]));
      if (!parts.length) continue;
      const [u, v] = parts[0];
      out.push(v - u > 45 ? [(u + v) / 2 - W / 2, (u + v) / 2 + W / 2] : [u, v]);
    }
    // a region that fits nothing yet: read beside it, to confirm or rule out a segment there
    // a long stretch with no match: the middle of its widest unread part, on a line
    for (const [u0, v0, hint] of (r.uncovered || []).slice(0, 2)) {
      if (hint) { const p = free(hint[1], hint[1] + W + 15)[0] || free(hint[0] - W - 15, hint[0])[0]; if (p && p[1] - p[0] >= 10) { out.push([p[0], Math.min(p[1], p[0] + W)]); continue; } }
      const parts = free(u0, v0).sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]));
      if (!parts.length || parts[0][1] - parts[0][0] < W + 10) continue;
      const [u, v] = parts[0]; let m = (u + v) / 2, bd = Infinity;
      for (const c of (cues || [])) { const x = r.ok ? shownAt(r, c.start) : c.start; if (x > u + W / 2 && x < v - W / 2 && Math.abs(x - m) < bd) { bd = Math.abs(x - m); m = x; } }
      out.push([m - W / 2, m + W / 2]);
    }
    for (const [a, b] of (r.stray || []).slice(0, 2)) { const p = free(b, b + W + 15)[0] || free(a - W - 15, a)[0]; if (p) out.push([p[0], Math.min(p[1], p[0] + W)]); }
    // more evidence / a speed: the middle of the widest unread stretch with dialogue
    if (r.need.includes('more') || r.need.includes('speed')) {
      const lo = dur * 0.02, hi = dur * 0.93;
      const parts = free(lo, hi).sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]));
      const cs = (cues || []).map(c => r.ok ? shownAt(r, c.start) : c.start);
      for (const [u, v] of parts.slice(0, 2)) {
        if (v - u < W + 10) break;
        let m = (u + v) / 2;
        // snap to the line nearest the middle so the window has dialogue
        let bd = Infinity; for (const c of cs) if (c > u + W / 2 && c < v - W / 2 && Math.abs(c - m) < bd) { bd = Math.abs(c - m); m = c; }
        out.push([Math.max(0, m - W / 2), Math.min(dur, m + W / 2)]);
      }
    }
    return out.slice(0, 4);
  }

  /* --------------------------------------------------------- clock check */

  /* CLOCK CHECK (subsync-mando, 2026-10-07). The soundtrack is asked from the
     server as an audio-only MP3, and an MP3 has no timestamps: it starts at the
     audio track's first sample. When a file's audio track starts later than
     its video (a muxing "delay" on the audio), the MP3 timeline runs early
     against the player's clock by exactly that delay, and a perfect match is
     applied off by it. Stand-in: an MKV whose audio starts 1.6 s after its
     video, transcoded the way the server does it, was synced with full
     confidence to -1.50 s instead of +0.10 s. Encoder/decoder delay is a few
     tens of ms and is already taken off (LAME tag), so it is not this.
     The cure is to look: once the film has been heard playing for a while, the
     player's own sound is compared with the server soundtrack. They are the
     SAME audio, so the lag between them shows as a needle-sharp peak.
     live: per-10 ms speech score in PLAYER time (NaN = not heard);
     server: the same in MP3 time. lag = MP3 time - player time. */
  function lagBetween(live0, server0, opts = {}) {
    const maxLag = Math.round((opts.maxLag || 8) / HOP);
    // Compared as CHANGES of the score (frame minus two frames back), not the
    // score itself: the score's slow ups and downs make a broad hump around the
    // right lag (peak z 7-12 in the offline model, too close to the bar); its
    // changes line up only at the right lag (see subsync-mando/lagsim.mjs).
    const flux = a => { const o = new Float32Array(a.length).fill(NaN); for (let i = 2; i < a.length; i++) { const x = a[i], y = a[i - 2]; if (x === x && y === y) o[i] = x - y; } return o; };
    const live = flux(live0), server = flux(server0);
    const idx = [];
    for (let i = 0; i < live.length && i < server.length; i++) if (live[i] === live[i]) idx.push(i);
    if (idx.length < (opts.minFrames || 2500)) return { ok: false, reason: 'not enough heard yet', heard: +(idx.length * HOP).toFixed(1) };
    { let mx = 0; for (let i = 0; i < live0.length; i++) if (live0[i] > mx) mx = live0[i];
      if (mx < 0.5) return { ok: false, reason: 'the player’s sound came through silent (muted capture, or a video from another server without CORS)', heard: +(idx.length * HOP).toFixed(1) }; }
    const norm = (get, list) => {
      const vals = list.map(get), mags = vals.map(Math.abs).sort((a, b) => a - b);
      const cap = mags[Math.floor(mags.length * 0.98)] || 1;
      const cl = v => v > cap ? cap : v < -cap ? -cap : v;
      let s = 0, s2 = 0; for (const v0 of vals) { const v = cl(v0); s += v; s2 += v * v; }
      const m = s / vals.length, sd = Math.sqrt(Math.max(1e-12, s2 / vals.length - m * m));
      return v => (cl(v) - m) / sd;
    };
    const zl = norm(i => live[i], idx);
    const sv = []; for (let i = 0; i < server.length; i += 3) if (server[i] === server[i]) sv.push(i);
    const zs = norm(i => server[i], sv);
    const L = new Float64Array(idx.length); for (let j = 0; j < idx.length; j++) L[j] = zl(live[idx[j]]);
    const r = new Float64Array(2 * maxLag + 1);
    let bi = 0;
    for (let k = -maxLag; k <= maxLag; k++) {
      let acc = 0, n = 0;
      for (let j = 0; j < idx.length; j++) { const i = idx[j] + k; if (i < 0 || i >= server.length) continue; const v = server[i]; if (v !== v) continue; acc += L[j] * zs(v); n++; }
      r[k + maxLag] = n > idx.length / 2 ? acc / n : 0;
      if (r[k + maxLag] > r[bi]) bi = k + maxLag;
    }
    const excl = Math.round(0.3 / HOP);
    let m = 0, m2 = 0, c = 0, runner = -Infinity;
    for (let i = 0; i < r.length; i++) { if (Math.abs(i - bi) <= excl) continue; m += r[i]; m2 += r[i] * r[i]; c++; if (r[i] > runner) runner = r[i]; }
    m /= Math.max(1, c);
    const sd = Math.sqrt(Math.max(1e-12, m2 / Math.max(1, c) - m * m));
    const peakZ = (r[bi] - m) / sd, ratio = (runner - m) / Math.max(1e-9, r[bi] - m);
    let frac = 0;
    if (bi > 0 && bi < r.length - 1) { const a = r[bi - 1], b = r[bi], d = r[bi + 1], den = a - 2 * b + d; if (den < 0) frac = Math.max(-0.5, Math.min(0.5, 0.5 * (a - d) / den)); }
    const lag = (bi - maxLag + frac) * HOP;
    const ok = peakZ >= (opts.zMin || 10) && ratio <= (opts.ratioMax || 0.5) && r[bi] > 0.1;
    return { ok, lag: +lag.toFixed(3), peakZ: +peakZ.toFixed(1), ratio: +ratio.toFixed(2), corr: +r[bi].toFixed(2), heard: +(idx.length * HOP).toFixed(1),
      reason: ok ? 'clear' : 'no clear lag (the player’s sound and the server soundtrack did not line up clearly)' };
  }
  /* TRACKING. After the first clock check the player keeps being
     compared with the server soundtrack, on the last 90 s heard, every 2
     minutes of playback. A changed lag (0.2 s or more from the one applied)
     seen twice in a row (agreeing within 0.15 s) is applied: that follows a
     player whose sound drifts against the server soundtrack (e.g. gaps in the
     file's audio that the MP3 drops, or a re-encode that runs short) as the
     film goes on. state: { applied, cand }. Returns the lag to apply, or null. */
  function trackLag(state, res) {
    if (!res || !res.ok) { state.cand = null; return null; }
    if (Math.abs(res.lag - state.applied) < 0.2) { state.cand = null; return null; }
    if (state.cand != null && Math.abs(res.lag - state.cand) <= 0.15) {
      const lag = +res.lag.toFixed(3);   // the newer of the two: a drift keeps moving
      state.applied = lag; state.cand = null; return lag;
    }
    state.cand = res.lag; return null;
  }
  /* Below this the measured lag is within the listening path's own timing
     spread (MEASURED in the stand-in, see subtest/t8-clock), so the server
     timeline is taken as right and nothing is corrected. */
  const CLOCK_MIN = 0.4;

  /* ------------------------------------------------------- worker side */

  if (typeof document === 'undefined' && typeof self !== 'undefined' && typeof self.postMessage === 'function' && typeof window === 'undefined') {
    const vads = new Map();
    self.onmessage = (ev) => {
      const m = ev.data || {};
      const reply = (o, t) => self.postMessage(Object.assign({ rid: m.rid, ok: true }, o), t || []);
      try {
        if (m.cmd === 'vad-start') { vads.set(m.id, createVad(m.sr || SR)); reply({}); }
        else if (m.cmd === 'vad-push') { vads.get(m.id).push(m.pcm, m.start); reply({ frames: vads.get(m.id).frames() }); }
        else if (m.cmd === 'vad-end') { const v = vads.get(m.id), r = v.result(), r1 = v.result('floor'); vads.delete(m.id); reply({ speech: r, speech1: r1 }, [r.buffer, r1.buffer]); }
        else if (m.cmd === 'solve') { reply({ result: solve(m.speech, m.cues, m.opts || {}) }); }
        else if (m.cmd === 'lag') { reply({ result: lagBetween(m.live, m.server, m.opts || {}) }); }
        else if (m.cmd === 'ping') { reply({}); }
        else reply({ ok: false, error: 'unknown command' });
      } catch (e) { self.postMessage({ rid: m.rid, ok: false, error: String(e && e.message || e) }); }
    };
    return;
  }
  if (typeof window === 'undefined') {   // Node (tests): export the pure parts
    if (typeof module !== 'undefined') module.exports = { createVad, solve, lagBetween, shownAt, trackLag, initialWindows, moreWindows, SCALES, CLOCK_MIN };
    return;
  }

  /* --------------------------------------------------------- page side */

  const SELF_URL = (document.currentScript && document.currentScript.src) || 'subsync.js';
  let _worker = null, _wid = 0, _workerReady = null;
  /* The worker is proved with a ping before any job is given to it; if it
     cannot start (file://, a blocked script) the work runs on this thread. */
  function ready() {
    if (_workerReady) return _workerReady;
    _workerReady = new Promise(resolve => {
      let w;
      try { w = new Worker(SELF_URL); } catch { _worker = false; return resolve(false); }
      const t = setTimeout(() => { done(false); }, 5000);
      const done = ok => { clearTimeout(t); w.removeEventListener('message', onM); w.removeEventListener('error', onE);
        if (ok) _worker = w; else { _worker = false; try { w.terminate(); } catch {} } resolve(ok); };
      const onM = ev => { if (ev.data && ev.data.rid === 0) done(true); };
      const onE = () => done(false);
      w.addEventListener('message', onM); w.addEventListener('error', onE);
      w.postMessage({ rid: 0, cmd: 'ping' });
    });
    return _workerReady;
  }
  /* Request/response to the worker, matched by a request id. */
  async function call(msg, transfer) {
    await ready();
    const w = _worker;
    if (!w) return local(msg);
    return new Promise((resolve, reject) => {
      const rid = ++_wid;
      const onMsg = (ev) => {
        if (!ev.data || ev.data.rid !== rid) return;
        w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr);
        ev.data.ok ? resolve(ev.data) : reject(new Error(ev.data.error));
      };
      const onErr = () => { w.removeEventListener('message', onMsg); reject(new Error('analysis worker failed')); };
      w.addEventListener('message', onMsg);
      w.addEventListener('error', onErr);
      w.postMessage(Object.assign({ rid }, msg), transfer || []);
    });
  }
  const _localVads = new Map();
  function local(m) {
    if (m.cmd === 'vad-start') { _localVads.set(m.id, createVad(m.sr || SR)); return { ok: true }; }
    if (m.cmd === 'vad-push') { _localVads.get(m.id).push(m.pcm, m.start); return { ok: true }; }
    if (m.cmd === 'vad-end') { const v = _localVads.get(m.id), r = v.result(), r1 = v.result('floor'); _localVads.delete(m.id); return { ok: true, speech: r, speech1: r1 }; }
    if (m.cmd === 'solve') return { ok: true, result: solve(m.speech, m.cues, m.opts || {}) };
    if (m.cmd === 'lag') return { ok: true, result: lagBetween(m.live, m.server, m.opts || {}) };
    return { ok: false };
  }

  /* ---- MP3 frame walking (for exact timing of each decoded piece) ---- */
  const BR1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  const BR2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  const SRS = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
  function frameAt(b, o) {
    if (o + 4 > b.length || b[o] !== 0xFF || (b[o + 1] & 0xE0) !== 0xE0) return null;
    const ver = (b[o + 1] >> 3) & 3, layer = (b[o + 1] >> 1) & 3;
    if (ver === 1 || layer !== 1) return null;            // Layer III only
    const bri = b[o + 2] >> 4, sri = (b[o + 2] >> 2) & 3, pad = (b[o + 2] >> 1) & 1;
    if (bri === 0 || bri === 15 || sri === 3) return null;
    const sr = SRS[ver][sri], kbps = (ver === 3 ? BR1 : BR2)[bri];
    const len = Math.floor((ver === 3 ? 144000 : 72000) * kbps / sr) + pad;
    return { len, sr, spf: ver === 3 ? 1152 : 576 };
  }
  function findSync(b, o) {
    for (; o + 4 <= b.length; o++) {
      const f = frameAt(b, o);
      if (f && (o + f.len + 4 > b.length || frameAt(b, o + f.len))) return o;
    }
    return -1;
  }
  /* Encoder delay from a Xing/Info + LAME tag in the first frame, or null. */
  function lameDelay(b, o, len) {
    const s = String.fromCharCode.apply(null, b.subarray(o, Math.min(o + len, o + 200)));
    const ip = Math.max(s.indexOf('Xing'), s.indexOf('Info'));
    if (ip < 0) return { tag: false };
    let p = o + ip + 4;
    const flags = (b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3];
    p += 4 + (flags & 1 ? 4 : 0) + (flags & 2 ? 4 : 0) + (flags & 4 ? 100 : 0) + (flags & 8 ? 4 : 0);
    if (p + 24 > o + len) return { tag: true, delay: null };
    return { tag: true, delay: (b[p + 21] << 4) | (b[p + 22] >> 4) };
  }

  let _decodeCtx = null;
  function decodeCtx() {
    if (!_decodeCtx) _decodeCtx = new OfflineAudioContext(1, SR, SR);   // never rendered: decodes only, no sound
    return _decodeCtx;
  }
  function decode(bytes) {
    return new Promise((res, rej) => {
      const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      try {
        const p = decodeCtx().decodeAudioData(ab, res, rej);
        if (p && p.then) p.then(res, rej);
      } catch (e) { rej(e); }
    });
  }

  /* THE SOUNDTRACK FROM THE FILE ITSELF (2026-10-07). On a test
     server the audio-only transcode below answered HTTP 400 for a film, so
     auto-sync never ran there. The first choice is now the file the player is
     playing, read from the server's static stream (the same URL direct play
     uses: /Videos/{Id}/stream.{Container}?Static=true&MediaSourceId=..., byte
     ranges through the same proxy, read forward in one stream): the audio track is demuxed by mediabunny
     (MP4/MOV, MKV/WebM, TS, ...; already shipped for remux.js) and decoded by
     the browser's own WebCodecs AudioDecoder. No transcode, and its timing is
     the file's own -- the timeline the picture plays on (an audio track that
     starts late stays late). The whole file is streamed past (see below). Codecs the
     browser cannot decode (E-AC-3, AC-3, DTS) fall through to the server.
     Each piece: front left + right + centre mixed to mono (dialogue lives in
     the centre of a 5.1 mix), averaged down to 16 kHz, fed to the detector. */
  const MB_URL = new URL('vendor/mediabunny.mjs', SELF_URL).href;
  function fileUrl(L, I) {
    const a = I.api(), src = L.src;
    if (!src || !L.item || !src.Id) return null;
    const cont = String(src.Container || '').split(',')[0].trim().toLowerCase();
    if (!cont) return null;
    const q = new URLSearchParams({ Static: 'true', MediaSourceId: src.Id, [a.tokenParam ? a.tokenParam() : 'api_key']: a.token() });
    return a.base() + '/Videos/' + encodeURIComponent(L.item.Id) + '/stream.' + cont + '?' + q.toString();
  }
  /* THE SOUNDTRACK FROM WINDOWS OF THE FILE (2026-10-08). Streaming
     the whole file (5-8 GB for a film) through the proxy on every first sync
     is too heavy. Instead the audio is read only in windows of film time
     (initialWindows: ~14 x 25 s, placed by subtitle lines; refineWindows: more
     around a cut): mediabunny maps a time to its byte position (MP4: the moov
     index; MKV: Cues and cluster timestamps) and reads just that stretch, in
     aligned 4 MB blocks through byteSource below. About 350-600 MB of an 8 GB
     film (t14). If the mapping fails (no index, ranges refused, the read
     budget exceeded) the whole-file read below is the fallback.
     Playback first: no block is fetched while the player is starving
     (playing but without enough data, or seeking).
     Once per file and audio track: what was heard is kept in IndexedDB
     (gnw-subsync / speech), so another subtitle track, or another visit,
     reads nothing again -- only windows it still lacks. */
  function byteSource(mb, url, stats, L, signal, duration) {
    // block size: about 2 s of film (1-4 MB), so a 25 s window is read with little
    // waste at any bitrate (MEASURED, t15: fixed 4 MB blocks read 16.5 % of a
    // 1 Mb/s two-hour test film for 14 windows of 25 s)
    let BLOCK = 4 << 20, MAXBLOCKS = 16, PER_REQUEST = 8;
    const blocks = new Map();
    let size = null;
    const playFirst = async () => {
      for (let waited = 0; !L.dead && L.v && !L.v.paused && (L.v.readyState < 3 || L.v.seeking) && waited < 120000; waited += 250) {
        stats.waitedMs = (stats.waitedMs || 0) + 250;
        await new Promise(r => setTimeout(r, 250));
      }
    };
    const get = async (from, to) => {
      await playFirst();
      if (signal && signal.aborted) throw new DOMException('aborted', 'AbortError');
      if (L.dead) throw new DOMException('aborted', 'AbortError');
      const r = await fetch(url, { headers: { Range: 'bytes=' + from + '-' + to }, signal });
      stats.requests++;
      if (r.status !== 206) { try { r.body && r.body.cancel(); } catch {} throw new Error('the server did not answer a byte range (HTTP ' + r.status + ')'); }
      const cr = r.headers.get('content-range'), m = cr && /\/(\d+)/.exec(cr);
      if (m && size == null) {
        size = +m[1];
        if (duration > 0) { BLOCK = Math.max(1 << 20, Math.min(4 << 20, Math.round(size / duration * 2 / 65536) * 65536)); MAXBLOCKS = Math.round((64 << 20) / BLOCK); PER_REQUEST = Math.max(4, Math.round((32 << 20) / BLOCK)); }
        stats.block = BLOCK;
      }
      const b = new Uint8Array(await r.arrayBuffer());
      stats.bytes += b.length;
      if (stats.limit && stats.bytes > stats.limit) throw new Error('read more than its budget (' + Math.round(stats.bytes / 1e6) + ' MB): the file has no usable index');
      return b;
    };
    return {
      size: () => size,
      source: new mb.CustomSource({
        prefetchProfile: 'none',
        maxCacheSize: 8 << 20,
        getSize: async () => { if (size == null) await get(0, 0); return size; },
        read: async (start, end) => {
          const b0 = Math.floor(start / BLOCK), b1 = Math.floor((end - 1) / BLOCK);
          for (let b = b0; b <= b1;) {
            if (blocks.has(b)) { const v = blocks.get(b); blocks.delete(b); blocks.set(b, v); b++; continue; }
            let e = b; while (e + 1 <= b1 && e - b + 1 < PER_REQUEST && !blocks.has(e + 1)) e++;
            const from = b * BLOCK, to = Math.min(size != null ? size : Infinity, (e + 1) * BLOCK) - 1;
            const buf = await get(from, to);
            for (let k = b; k <= e; k++) blocks.set(k, buf.subarray((k - b) * BLOCK, Math.min(buf.length, (k - b + 1) * BLOCK)));
            while (blocks.size > MAXBLOCKS) blocks.delete(blocks.keys().next().value);
            b = e + 1;
          }
          const out = new Uint8Array(end - start);
          for (let b = b0; b <= b1; b++) {
            const v = blocks.get(b), base = b * BLOCK;
            if (!v) continue;
            const a = Math.max(start, base), z = Math.min(end, base + v.length);
            if (z > a) out.set(v.subarray(a - base, z - base), a - start);
          }
          return out;
        },
      }),
    };
  }
  const _idb = { p: null };
  function idbOpen() {
    if (!_idb.p) _idb.p = new Promise(res => {
      try { const rq = indexedDB.open('gnw-subsync', 1); rq.onupgradeneeded = () => { try { rq.result.createObjectStore('speech'); } catch {} }; rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); rq.onblocked = () => res(null); }
      catch { res(null); }
    });
    return _idb.p;
  }
  async function idbGet(k) { const db = await idbOpen(); if (!db) return null; return new Promise(res => { try { const rq = db.transaction('speech').objectStore('speech').get(k); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); } catch { res(null); } }); }
  async function idbPut(k, v) { const db = await idbOpen(); if (!db) return; await new Promise(res => { try { const tx = db.transaction('speech', 'readwrite'); tx.objectStore('speech').put(v, k); tx.oncomplete = res; tx.onerror = res; tx.onabort = res; } catch { res(); } }); }
  const SPEECH_STORE_V = 'w1|';
  /* PROGRESSIVE (2026-10-10). Windows are read one at a time and
     the model is solved after each (from the second on); onResult applies what
     it says straight away. After the first plan, more windows are read for as
     long as the model says something is uncertain (need: more evidence, a
     speed not yet clear, a boundary between segments, a stretch that fits
     nothing) -- also when every window of the first plan was already in this
     browser's store, which before stopped at "nothing fetched, 14 windows".
     Up to 48 windows (~20 min of film) in all. Errors before the first window
     is read go to the caller (the whole-file fallback); after that, reading
     stops and the last result stands. */
  const MAX_WINDOWS = 48;
  async function progressiveWindows(L, I, cues, ck, signal, note, onResult, onProgress) {
    if (window.__noWindowSync || window.__noFileSync || (window.GnwSubSync && window.GnwSubSync._noFile)) throw new Error('switched off (test)');
    const url = fileUrl(L, I);
    if (!url) throw new Error('no file address for this source');
    const dur = (((L.item && L.item.RunTimeTicks) || (L.src && L.src.RunTimeTicks) || 0) / 1e7) || (isFinite(L.v.duration) && L.v.duration) || 0;
    if (!dur) throw new Error('the film length is not known');
    const nFr = Math.ceil(dur / HOP) + 10;
    const key = SPEECH_STORE_V + ck;
    const saved = await idbGet(key);
    const okSaved = !!(saved && saved.speech && saved.speech.length === nFr);
    const R = { speech: okSaved ? saved.speech : new Float32Array(nFr).fill(NaN), have: okSaved ? (saved.have || []).slice() : [] };
    const stats = note.net = { requests: 0, bytes: 0, before: (okSaved && saved.bytes) || 0, windows: R.have.length, stored: okSaved && R.have.length > 0, fromStore: R.have.length };
    let mbm = null, input = null, track = null, fileStart = 0;
    const open = async (sig) => {
      if (input) return;
      mbm = mbm || await import(MB_URL);
      const src = byteSource(mbm, url, stats, L, sig, dur);
      stats.limit = (stats.bytes || 0) + 1.5e9;   // until the size is known
      input = new mbm.Input({ source: src.source, formats: mbm.ALL_FORMATS });
      const tracks = await input.getAudioTracks();
      if (!tracks.length) throw new Error('the file has no audio track');
      const size = src.size(); if (size) { stats.size = size; stats.limit = (stats.bytes || 0) + Math.min(2.5e9, Math.max(6e8, 0.35 * size)); }
      const auds = ((L.src && L.src.MediaStreams) || []).filter(x => x.Type === 'Audio' && !x.IsExternal);
      const want = L.audio || auds.find(x => x.IsDefault) || auds[0];
      let ord = want ? auds.findIndex(x => x.Index === want.Index) : 0;
      if (ord < 0 || ord >= tracks.length) ord = 0;
      track = tracks[ord];
      const codec = await track.getCodec().catch(() => null);
      Object.assign(note, { codec: codec || '?', channels: track.numberOfChannels, rate: track.sampleRate, track: ord });
      if (!(await track.canDecode())) throw new Error('this browser can’t decode its ' + (codec || 'unknown') + ' audio');
      let t0 = Infinity;
      for (const t of [...(await input.getVideoTracks().catch(() => [])), ...tracks]) { const f = await t.getFirstTimestamp().catch(() => null); if (f != null && isFinite(f)) t0 = Math.min(t0, f); }
      fileStart = isFinite(t0) && t0 > 0 ? t0 : 0;
      note.fileStart = +fileStart.toFixed(3);
    };
    const close = () => { try { input && input.dispose(); } catch {} input = null; };
    const covered = (a, b) => { let c = 0; for (const [x, y] of R.have) c += Math.max(0, Math.min(b, y) - Math.max(a, x)); return c >= 0.6 * (b - a); };
    let plane = new Float32Array(4096), mono = new Float32Array(4096);
    const readWin = async ([a, b], sig) => {
      a = Math.max(0, a); b = Math.min(dur, b);
      if (b - a < 6 || covered(a, b)) return false;
      await open(sig);
      const vad = createVad(SR);
      const sink = new mbm.AudioSampleSink(track);
      for await (const smp of sink.samples(a + fileStart, b + fileStart)) {
        if ((sig && sig.aborted) || L.dead) { smp.close(); throw new DOMException('aborted', 'AbortError'); }
        const sr = smp.sampleRate, nf = smp.numberOfFrames, nc = smp.numberOfChannels, ts = smp.timestamp - fileStart;
        // 5.1 and up: the centre alone (plane 2 in the decoder's FL FR FC LFE order -- MEASURED on the
        // control episode, centre RMS 70-83 against 5-49 left/right); 3-5 channels: front three; else all
        const pl = nc >= 6 ? [2] : nc >= 3 ? [0, 1, 2] : nc === 2 ? [0, 1] : [0], use = pl.length;
        if (plane.length < nf) { plane = new Float32Array(nf); mono = new Float32Array(nf); }
        mono.fill(0, 0, nf);
        for (const c of pl) { smp.copyTo(plane, { planeIndex: c, format: 'f32-planar' }); for (let i = 0; i < nf; i++) mono[i] += plane[i]; }
        smp.close();
        const s16 = Math.round(ts * SR), e16 = Math.round((ts + nf / sr) * SR), n16 = e16 - s16;
        if (n16 <= 0) continue;
        const out = new Float32Array(n16), k = nf / n16;
        for (let j = 0; j < n16; j++) { const a0 = Math.floor(j * k), a1 = Math.max(a0 + 1, Math.min(nf, Math.floor((j + 1) * k))); let v = 0; for (let i = a0; i < a1; i++) v += mono[i]; out[j] = v / ((a1 - a0) * use); }
        vad.push(out, s16);
      }
      // keep the window's frames, less the first 1.5 s (the detector's noise floor settling)
      const r = vad.result(), f0 = Math.ceil((a + 1.5) / HOP), f1 = Math.min(r.length, Math.floor(b / HOP), nFr);
      for (let f = Math.max(0, f0); f < f1; f++) R.speech[f] = r[f];
      R.have.push([a, b]);
      stats.windows = R.have.length;
      return true;
    };
    const save = () => idbPut(key, { speech: R.speech, have: R.have, bytes: stats.before + stats.bytes, at: Date.now() });
    let r = null, read = 0, unsaved = 0;
    const solveNow = async () => { r = (await call({ cmd: 'solve', speech: R.speech, cues, opts: {} })).result; r.windows = R.have.length; await onResult(r, false); };
    try {
      if (R.have.length >= 2) await solveNow();
      const plan = initialWindows(dur, cues).filter(([a, b]) => !covered(a, b));
      for (const w of plan) {
        try { if (await readWin(w, signal)) { read++; unsaved++; } }
        catch (e) { if (!read && !R.have.length) throw e; if (e && e.name === 'AbortError') throw e; note.stopped = (e && e.message) || String(e); break; }
        if (onProgress) onProgress(Math.min(0.99, R.have.length / 14));
        if (R.have.length >= 2) await solveNow();
        if (unsaved >= 3) { unsaved = 0; await save(); }
      }
      if (!r && R.have.length) await solveNow();
      // then more, where the model is still unsure
      for (let round = 0; !note.stopped && !(r && r.mismatch) && round < 16 && R.have.length < MAX_WINDOWS && r && r.need && r.need.length; round++) {
        const more = moreWindows(r, R.have, dur, cues).slice(0, MAX_WINDOWS - R.have.length);
        if (!more.length) break;
        let got = 0;
        for (const w of more) {
          try { if (await readWin(w, signal)) { got++; read++; unsaved++; } }
          catch (e) { if (e && e.name === 'AbortError') throw e; note.stopped = (e && e.message) || String(e); break; }
        }
        if (!got) break;
        stats.refined = (stats.refined || 0) + got;
        await solveNow();
        if (unsaved >= 3) { unsaved = 0; await save(); }
      }
      if (unsaved) await save();
    } finally { close(); }
    if (!R.have.length) throw new Error('no window of the file could be read');
    _winSpeech.set(ck, R.speech);
    return { speech: R.speech, r };
  }
  /* The soundtrack heard for this file and audio track (windows, a whole read, or the
     store), for scoring OTHER subtitle files against it without reading anything. */
  const _winSpeech = new Map();
  async function heardSpeech(ck) {
    let sp = _winSpeech.get(ck) || _speechCache.get(ck) || null;
    if (!sp) { const saved = await idbGet(SPEECH_STORE_V + ck); if (saved && saved.speech) sp = saved.speech; }
    return sp;
  }
  /* How well a subtitle file fits the soundtrack already heard: the solve() result. */
  async function scoreCues(ck, cues) {
    const sp = await heardSpeech(ck);
    if (!sp) return { ok: false, reason: 'nothing heard yet' };
    return (await call({ cmd: 'solve', speech: sp, cues: cues.map(c => ({ start: c.start, end: c.end })), opts: {} })).result;
  }

  async function speechFromFile(L, I, onProgress, signal, note) {
    if ((window.GnwSubSync && window.GnwSubSync._noFile) || window.__noFileSync) throw new Error('switched off (test)');
    const url = fileUrl(L, I);
    if (!url) throw new Error('no file address for this source');
    const mb = await import(MB_URL);
    // mediabunny's UrlSource reads FORWARD in one streamed request. That reads
    // the whole file (MEASURED, t13: the audio of a film is spread evenly
    // between the picture frames, so reading only it would take one request
    // per packet -- ~340 000 for two hours); one sequential stream is the
    // cheapest way to it. A 2-hour film of 5-8 GB is about a minute on a home
    // network, in the background, while it plays; the cost is shown in
    // Subtitle info. The server's MP3 (a few MB) is tried when this fails.
    const input = new mb.Input({ source: new mb.UrlSource(url, { maxCacheSize: 16 << 20, parallelism: 1 }), formats: mb.ALL_FORMATS });
    try {
      const tracks = await input.getAudioTracks();
      if (!tracks.length) throw new Error('the file has no audio track');
      // the audio track that plays: its place among the file's audio streams
      const auds = ((L.src && L.src.MediaStreams) || []).filter(x => x.Type === 'Audio' && !x.IsExternal);
      const want = L.audio || auds.find(x => x.IsDefault) || auds[0];
      let ord = want ? auds.findIndex(x => x.Index === want.Index) : 0;
      if (ord < 0 || ord >= tracks.length) ord = 0;
      const track = tracks[ord];
      const codec = await track.getCodec().catch(() => null);
      Object.assign(note, { codec: codec || '?', channels: track.numberOfChannels, rate: track.sampleRate, track: ord });
      if (!(await track.canDecode())) throw new Error('this browser can’t decode its ' + (codec || 'unknown') + ' audio');
      // The player's clock counts from the FILE's start (its earliest packet over
      // all tracks), as ffmpeg and the server do -- not from container time 0.
      // A file whose timestamps start at 1.5 s was synced 1.5 s off without this
      // (canonical t1 "remuxoff"). A later start of the AUDIO alone (a
      // muxing delay) is kept: that one is real.
      let t0 = Infinity;
      for (const t of [...(await input.getVideoTracks().catch(() => [])), ...tracks]) { const f = await t.getFirstTimestamp().catch(() => null); if (f != null && isFinite(f)) t0 = Math.min(t0, f); }
      const fileStart = isFinite(t0) && t0 > 0 ? t0 : 0;
      note.fileStart = +fileStart.toFixed(3);
      const dur = (L.item.RunTimeTicks || (L.src && L.src.RunTimeTicks) || 0) / 1e7 || (L.v.duration || 0);
      const vid = 'f' + Date.now() + Math.random();
      await call({ cmd: 'vad-start', id: vid, sr: SR });
      const sink = new mb.AudioSampleSink(track);
      let acc = new Float32Array(SR * 32), accN = 0, accStart = null, plane = new Float32Array(4096), mono = new Float32Array(4096), last = 0;
      const flushAcc = async () => {
        if (!accN) return;
        const pcm = acc.slice(0, accN);
        const st = accStart;
        accN = 0; accStart = null;
        await call({ cmd: 'vad-push', id: vid, pcm, start: st }, [pcm.buffer]);
      };
      for await (const smp of sink.samples()) {
        if (signal && signal.aborted) { smp.close(); throw new DOMException('aborted', 'AbortError'); }
        if (L.dead) { smp.close(); throw new DOMException('aborted', 'AbortError'); }
        const sr = smp.sampleRate, nf = smp.numberOfFrames, nc = smp.numberOfChannels, ts = smp.timestamp - fileStart;
        // 5.1 and up: the centre alone (plane 2 in the decoder's FL FR FC LFE order -- MEASURED on the
        // control episode, centre RMS 70-83 against 5-49 left/right); 3-5 channels: front three; else all
        const pl = nc >= 6 ? [2] : nc >= 3 ? [0, 1, 2] : nc === 2 ? [0, 1] : [0], use = pl.length;
        if (plane.length < nf) { plane = new Float32Array(nf); mono = new Float32Array(nf); }
        mono.fill(0, 0, nf);
        for (const c of pl) { smp.copyTo(plane, { planeIndex: c, format: 'f32-planar' }); for (let i = 0; i < nf; i++) mono[i] += plane[i]; }
        smp.close();
        // to 16 kHz: a box average over each output step; the piece ends where the next begins
        const s16 = Math.round(ts * SR), e16 = Math.round((ts + nf / sr) * SR), n16 = e16 - s16;
        if (n16 <= 0) continue;
        if (accStart != null && accStart + accN !== s16) await flushAcc();
        if (accN + n16 > acc.length) await flushAcc();
        if (accStart == null) accStart = s16;
        const k = nf / n16;
        for (let j = 0; j < n16; j++) {
          const a0 = Math.floor(j * k), a1 = Math.max(a0 + 1, Math.min(nf, Math.floor((j + 1) * k)));
          let v = 0; for (let i = a0; i < a1; i++) v += mono[i];
          acc[accN + j] = v / ((a1 - a0) * use);
        }
        accN += n16;
        if (accN >= SR * 30) await flushAcc();
        if (onProgress && dur && ts - last > 20) { last = ts; onProgress(Math.min(1, ts / dur)); }
      }
      await flushAcc();
      const r = await call({ cmd: 'vad-end', id: vid });
      if (!r.speech || r.speech.length < 3000) throw new Error('too little audio decoded');
      if (r.speech1) r.speech.v1 = r.speech1;   // the floor score, for the clock check against the player (listened with it)
      return r.speech;
    } finally { try { input.dispose && input.dispose(); } catch {} }
  }

  /* Fetch the soundtrack as MP3 from Emby, decode it piece by piece, feed the
     detector. Resolves to the per-10 ms speech score.
     A test server answered HTTP 400 to the first form below, so
     a few forms are tried in turn and each answer (status and the start of
     its body) is kept for Subtitle info; the first that streams MP3 is used.
     Emby's REST API (dev.emby.media/reference/RestAPI/AudioService and
     UniversalAudioService) documents /Audio/{Id}/stream.{Container},
     /Audio/{Id}/stream (Container required) and /Audio/{Id}/universal; both accept MediaSourceId /
     AudioStreamIndex / AudioCodec / AudioSampleRate / AudioChannels /
     AudioBitRate (universal: Container, TranscodingContainer, AudioCodec,
     MaxAudioChannels, MaxSampleRate, MaxStreamingBitrate). Whether a VIDEO
     item is accepted differs by server version -- hence the list. */
  async function speechFromServer(L, I, onProgress, signal, note) {
    const a = I.api();
    const audio = L.audio || ((L.src && L.src.MediaStreams) || []).find(s => s.Type === 'Audio' && s.IsDefault) || ((L.src && L.src.MediaStreams) || []).find(s => s.Type === 'Audio');
    const id = encodeURIComponent(L.item.Id), ai = audio && audio.Index != null ? String(audio.Index) : null;
    const mk = (path, o) => { const q = new URLSearchParams(o); if (ai != null) q.set('AudioStreamIndex', ai); q.set(a.tokenParam ? a.tokenParam() : 'api_key', a.token()); return a.base() + path + '?' + q.toString(); };
    const audioQ = { MediaSourceId: L.src.Id, AudioCodec: 'mp3', AudioSampleRate: String(SR), AudioChannels: '1', AudioBitRate: '32000' };
    const cands = [
      ['/Audio/stream.mp3', mk('/Audio/' + id + '/stream.mp3', Object.assign({}, audioQ, { EnableAutoStreamCopy: 'false', DeviceId: a.deviceId() }))],
      // the documented form: GET /Audio/{Id}/stream with Container (required) as a query parameter
      ['/Audio/stream?Container=mp3', mk('/Audio/' + id + '/stream', Object.assign({ Container: 'mp3' }, audioQ, { Static: 'false', DeviceId: a.deviceId() }))],
      ['/Audio/universal', mk('/Audio/' + id + '/universal', { MediaSourceId: L.src.Id, UserId: (a.userId && a.userId()) || '', DeviceId: a.deviceId(), Container: 'mp3', TranscodingContainer: 'mp3', TranscodingProtocol: 'http', AudioCodec: 'mp3', MaxAudioChannels: '1', MaxSampleRate: String(SR), MaxStreamingBitrate: '32000' })],
      ['/Videos/stream.mp3', mk('/Videos/' + id + '/stream.mp3', Object.assign({}, audioQ, { DeviceId: a.deviceId() }))],
    ];
    const tried = note.tried = [];
    let res = null;
    for (const [name, url] of cands) {
      if (signal && signal.aborted) throw new DOMException('aborted', 'AbortError');
      let r;
      try { r = await fetch(url, { signal, headers: a.authHeaders ? a.authHeaders() : { 'X-Emby-Token': a.token() } }); }
      catch (e) { if (e && e.name === 'AbortError') throw e; tried.push(name + ': ' + ((e && e.message) || 'network error')); continue; }
      const type = r.headers.get('content-type') || '';
      if (r.ok && r.body && !/json|html|text\//i.test(type)) { res = r; tried.push(name + ': HTTP ' + r.status + ' ' + type); note.used = name; break; }
      let body = ''; try { body = (await r.text()).replace(/\s+/g, ' ').slice(0, 120); } catch {}
      tried.push(name + ': HTTP ' + r.status + (type ? ' ' + type : '') + (body ? ' "' + body + '"' : ''));
    }
    if (!res) throw new Error('the server sent no soundtrack (' + tried.join('; ') + ')');
    const reader = res.body.getReader();
    const dur = (L.item.RunTimeTicks || (L.src && L.src.RunTimeTicks) || 0) / 1e7 || (L.v.duration || 0);
    const vid = 'v' + Date.now() + Math.random();
    await call({ cmd: 'vad-start', id: vid, sr: SR });
    let buf = new Uint8Array(0), first = true, delay = 1105, framesDone = 0, spf = 576, fsr = SR;
    const CHUNK = 2500;   // frames per decoded piece (~90 s at 16 kHz)
    const flush = async (final) => {
      // walk whole frames
      let o = findSync(buf, 0);
      if (o < 0) { if (final) buf = new Uint8Array(0); return; }
      let n = 0;
      if (first) {
        // skip an ID3v2 tag (findSync already stepped over it) and the Xing/Info frame
        const f = frameAt(buf, o);
        const t = lameDelay(buf, o, f.len);
        if (t.tag) { if (t.delay != null) delay = t.delay + 529; o += f.len; }
        spf = f.spf; fsr = f.sr;
        first = false;
        buf = buf.slice(o);   // drop any leading junk and the tag frame for good
        o = 0;
      }
      const s0 = o;
      while (true) {
        const f = frameAt(buf, o);
        if (!f || o + f.len > buf.length) break;
        o += f.len; n++;
        if (!final && n >= CHUNK) break;
      }
      if (!n) return;
      if (!final && n < CHUNK) return;          // wait for a full piece
      const piece = buf.slice(s0, o);
      buf = buf.slice(o);
      const startSample = framesDone * spf * (SR / fsr) - delay * (SR / fsr);
      framesDone += n;
      let pcm;
      try { const ab = await decode(piece); pcm = ab.getChannelData(0); }
      catch { return; }                         // one bad piece: skip it, keep going
      const want = Math.round(n * spf * (SR / fsr));
      pcm = pcm.slice(0, Math.min(pcm.length, want));   // a copy: the decoder's own buffer is not ours to transfer
      await call({ cmd: 'vad-push', id: vid, pcm, start: Math.round(startSample) }, [pcm.buffer]);
      if (onProgress && dur) onProgress(Math.min(1, framesDone * spf / fsr / dur));
    };
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const nb = new Uint8Array(buf.length + value.length); nb.set(buf); nb.set(value, buf.length); buf = nb;
      while (true) {
        const before = framesDone;
        await flush(false);
        if (framesDone === before) break;
      }
    }
    await flush(true);
    if (!framesDone) throw new Error('no MP3 audio in the response');
    const r = await call({ cmd: 'vad-end', id: vid });
    if (r.speech1) r.speech.v1 = r.speech1;
    return r.speech;
  }

  /* Fallback: listen while the film plays (1x only), into a silent analysis graph. */
  function speechLive(L, onProgress, signal) {
    return new Promise((resolve, reject) => {
      const v = L.v;
      let stream;
      try { stream = v.captureStream ? v.captureStream() : v.mozCaptureStream(); } catch (e) { return reject(new Error('this browser can’t listen to the player')); }
      // A test server's direct mp4 said "no audio track to listen to". A
      // captured stream gets its tracks when the element has them -- not yet
      // at the very start of playback -- so wait for one (addtrack, or the
      // element starting to play) for up to 20 s before giving up.
      if (!stream) return reject(new Error('this browser can’t listen to the player'));
      if (!stream.getAudioTracks().length) {
        const t0 = Date.now();
        const wait = () => new Promise(res => {
          const done = () => { clearInterval(iv); stream.removeEventListener('addtrack', done); res(); };
          const iv = setInterval(() => { if (stream.getAudioTracks().length || Date.now() - t0 > 20000 || L.dead) done(); }, 250);
          stream.addEventListener('addtrack', done);
        });
        return wait().then(() => {
          if (!stream.getAudioTracks().length) {
            const why = v.muted ? 'the player is muted' : v.readyState < 2 ? 'the video had not loaded yet' : (v.audioTracks && v.audioTracks.length === 0) ? 'the browser plays no audio track from this file' : 'the browser gave no audio track to listen to';
            throw new Error('no audio track to listen to (' + why + ', after 20 s)');
          }
          return startLive();
        }).then(resolve, reject);
      }
      return startLive().then(resolve, reject);
      function startLive() { return new Promise((resolve, reject) => {
      const ctx = new AudioContext({ sampleRate: SR });
      const src = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      const mute = ctx.createGain(); mute.gain.value = 0;     // analysis only: nothing reaches the speakers
      src.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
      try { if (ctx.state !== 'running') ctx.resume().catch(() => {}); } catch {}
      // the item's runtime when the element does not know its duration yet (the
      // test film runs 2:05 -- longer than the old 2-hour default)
      const dur = (isFinite(v.duration) && v.duration) || (((L.item && L.item.RunTimeTicks) || 0) / 1e7) || 0;
      const nFrames = Math.ceil((dur || 4 * 3600) / HOP) + 10;
      const speech = new Float32Array(nFrames).fill(NaN);
      let vad = createVad(SR, 'floor'), lastStart = -1e9, heard = 0, lastK = -1;
      proc.onaudioprocess = (e) => {
        if (v.paused || v.seeking || v.playbackRate !== 1) { lastStart = -1e9; return; }
        const pcm = e.inputBuffer.getChannelData(0).slice();
        const start = Math.round((v.currentTime - pcm.length / SR - (ctx.baseLatency || 0)) * SR);
        if (Math.abs(start - lastStart) > SR * 0.2) vad = createVad(SR, 'floor');   // a jump: restart the tracker
        lastStart = start + pcm.length;
        const before = vad.result().length;
        vad.push(pcm, start);
        const r = vad.result();
        for (let k = Math.max(0, before - 2); k < r.length && k < nFrames; k++) if (r[k] || r[k] === 0) { if (speech[k] !== speech[k]) heard++; speech[k] = r[k]; lastK = k; }
        if (onProgress) onProgress(heard * HOP);
      };
      const stop = () => { try { proc.disconnect(); src.disconnect(); mute.disconnect(); ctx.close(); } catch {} };
      if (signal) signal.addEventListener('abort', () => { stop(); reject(new DOMException('aborted', 'AbortError')); });
      // recent(sec): only the frames heard in the last `sec` seconds of film before the newest one
      const recent = sec => { const o = new Float32Array(nFrames).fill(NaN); if (lastK < 0) return o; const a = Math.max(0, lastK - Math.round(sec / HOP)); o.set(speech.subarray(a, lastK + 1), a); return o; };
      resolve({ speech, stop, heard: () => heard * HOP, recent, at: () => lastK * HOP });
      }); }
    });
  }

  /* ---------------------------------------------------- the Auto-sync job */

  const _speechCache = new Map();   // item|source|audio -> Float32Array (whole-file or server soundtrack)
  const _speechPending = new Map(); // same key -> Promise<Float32Array> while it is being read
  const _speechHow = new Map();     // same key -> where it came from (for Subtitle info)
  /* APPLY AS IT GOES (2026-10-10). Every result that has a match is applied at
     once (between two lines, by applyAuto in subs.js), and again whenever a
     later one moves any line by 0.1 s or more, or changes the speed or the
     segments. The viewer's own -/+ nudge stays on top (subs.js). Each change
     is kept in L.lastSync.history for Subtitle info. */
  function makeApplier(L, I, job, track) {
    let cur = null;
    const hist = [];
    const moved = (a, b) => {
      if (!a) return true;
      if (Math.abs(a.scale - b.scale) > 1e-7 || !!a.sections !== !!b.sections || (a.sections && a.sections.length !== b.sections.length)) return true;
      const T = L.cues.length ? L.cues[L.cues.length - 1].end : 7200;
      for (let t = 0; t <= T; t += 60) if (Math.abs(shownAt(a, t) - shownAt(b, t)) >= 0.1) return true;
      return false;
    };
    const apply = (r, final) => {
      const clock = L._clock && L._clock.ok && Math.abs(L._clock.lag) >= CLOCK_MIN ? L._clock : null;
      const o = Math.round((r.offset - (clock ? clock.lag : 0)) * 1000) / 1000;
      L.autoRaw = { track, r };
      I.setOffsetLive(L, o, r.scale, { auto: true, conf: r.peakZ, autoAt: Date.now(), clk: clock ? clock.lag : 0, autoSec: secDeltas(r), autoFinal: !!final });
      return clock ? o : null;
    };
    const fn = async (r, final) => {
      if (L.dead || L.track !== track) return;
      const prev = L.lastSync;
      L.lastSync = Object.assign({}, r, { track: track && track.Index, method: job.method, at: Date.now(), history: hist, clock: prev && prev.clock });
      if (!r || !r.ok) { if (cur) { L.lastSync = Object.assign({}, cur, { track: track && track.Index, method: job.method, at: Date.now(), history: hist, clock: prev && prev.clock, latest: r }); } return; }
      if (moved(cur, r)) {
        cur = r;
        const ap = apply(r, final);
        if (ap != null) L.lastSync.applied = ap;
        hist.push({ heard: r.heard, windows: r.windows || null, scale: r.scale, offset: r.offset, sections: r.sections ? r.sections.length : 1 });
        if (hist.length > 20) hist.splice(1, 1);
      } else if (final) apply(cur, true);
    };
    fn.current = () => cur;
    fn.reapply = () => { if (cur && !L.dead && L.track === track) { const ap = apply(cur, true); if (L.lastSync) L.lastSync.applied = ap; } };
    return fn;
  }
  async function autoSync(L, opts, I) {
    if (!L || L.dead || !L.on || !L.track || !L.cues.length) { I.setStatus(L, 'Auto-sync: no subtitles are showing. Choose a track under Subtitles first.', 6000); return; }
    if (L.sync && L.sync.running && L.sync.track === L.track) return;    // already working on this track
    const ctrl = new AbortController();
    const track = L.track;
    const job = L.sync = { running: true, track, method: '', background: !!opts.background, abort: (why) => { job.why = why || ''; ctrl.abort(); } };
    const btn = L.btn && L.btn.autosync;
    const label = t => { if (btn) btn.textContent = t; };
    const done = () => { job.running = false; label('Auto-sync'); };
    label('Listening…');
    I.setStatus(L, 'Auto-sync: listening…');
    const cues = L.cues.map(c => ({ start: c.start, end: c.end }));
    const audio = L.audio || ((L.src && L.src.MediaStreams) || []).find(s => s.Type === 'Audio' && s.IsDefault);
    const ck = [L.item.Id, L.src && L.src.Id, audio && audio.Index].join('|');
    const ckey = ck + '|' + (L.path || '');
    if (opts.fresh) _clockCache.delete(ckey);
    L._clock = _clockCache.get(ckey) || null;
    const onResult = makeApplier(L, I, job, track);
    // A later lag change seen by the clock tracker re-applies the current result.
    L._onClock = (res) => { if (L.dead || L.track !== track) return; L._clock = res; if (L.lastSync) L.lastSync.clock = res; onResult.reapply(); };
    const sources = job.sources = L.soundSources = [];
    const prog = p => { job.progress = p; label('Listening ' + Math.round(p * 100) + '%'); };
    const tryOne = async (name, fn) => {
      const note = { name, started: Date.now() };
      sources.push(note);
      try { const sp = await fn(note); note.ok = true; note.ms = Date.now() - note.started; return sp; }
      catch (e) { if (ctrl.signal.aborted || (e && e.name === 'AbortError')) throw e; note.ok = false; note.error = (e && e.message) || String(e); note.ms = Date.now() - note.started; return null; }
    };
    try {
      let speech = null, final = null;
      // 1. windows of the file, solved and applied as they are read
      job.method = 'soundtrack read from windows of the file';
      const w = await tryOne('windows of the file', note => progressiveWindows(L, I, cues, ck, ctrl.signal, note, onResult, prog));
      if (w) { speech = w.speech; final = w.r; }
      else {
        // 2. the whole file, or the server's soundtrack: solved once, all heard
        speech = _speechCache.get(ck) || null;
        if (speech) job.method = (_speechHow.get(ck) || 'soundtrack') + ' (already read)';
        else if (_speechPending.has(ck)) { speech = await _speechPending.get(ck).catch(() => null); if (speech) job.method = (_speechHow.get(ck) || 'soundtrack') + ' (shared with another track)'; }
        if (!speech) {
          const pr = (async () => {
            let sp = await tryOne('the whole file', note => speechFromFile(L, I, prog, ctrl.signal, note));
            if (sp) { job.method = 'soundtrack read from the whole file'; return sp; }
            sp = await tryOne('server soundtrack', note => speechFromServer(L, I, prog, ctrl.signal, note));
            if (sp) { job.method = 'soundtrack from the server'; return sp; }
            throw new Error(sources.map(x => x.name + ': ' + x.error).join('; '));
          })();
          _speechPending.set(ck, pr);
          try { speech = await pr; _speechCache.set(ck, speech); _speechHow.set(ck, job.method); }
          catch (e) { if (ctrl.signal.aborted) throw e; speech = null; job.whyLive = (e && e.message) || String(e); }
          finally { if (_speechPending.get(ck) === pr) _speechPending.delete(ck); }
        }
        if (speech) {
          label('Matching…');
          final = (await call({ cmd: 'solve', speech, cues, opts: {} })).result;
        }
      }
      if (!speech) {
        // 3. listening while it plays: solved every 30 s from 60 s heard, applied as it goes, for as long as it plays
        job.method = 'listening while it plays (' + job.whyLive + ')';
        const live = await speechLive(L, sec => label('Listening ' + Math.floor(sec / 60) + ':' + String(Math.floor(sec % 60)).padStart(2, '0')), ctrl.signal);
        job.live = live;
        done();
        let lastH = 0;
        try {
          while (!L.dead && !ctrl.signal.aborted && L.track === track) {
            await new Promise(res2 => setTimeout(res2, 10000));
            const h = live.heard();
            if (h < 60 || h - lastH < (onResult.current() ? 60 : 30)) continue;
            lastH = h;
            await onResult((await call({ cmd: 'solve', speech: live.speech, cues, opts: {} })).result, false);
          }
        } finally { live.stop(); }
        return;
      }
      done();
      await onResult(final, true);
      // not these subtitles at all: subs.js tries the other files, then the server's search
      if (final && !final.ok && final.mismatch && I.onMismatch && !L.dead && L.track === track) { try { I.onMismatch(L, track, final, ck); } catch (e) { console.warn('[subs] mismatch handling failed:', e && e.message); } }
      // Then the clock check (once per file and play path, while it plays).
      if (!w && onResult.current() && !L._clock && !L.dead && L.track === track) {
        let p = _clockPending.get(ckey);
        if (!p) {
          p = clockCheck(L, speech, ckey);
          _clockPending.set(ckey, p);
          p.then(res => { if (_clockPending.get(ckey) === p) _clockPending.delete(ckey); if (res.ok) _clockCache.set(ckey, res); L.clockCheck = Object.assign(L.clockCheck || {}, res, { state: 'done' }); });
        }
        const res = await p;
        if (L.dead || L.track !== track) return;
        L._clock = res;
        if (L.lastSync) L.lastSync.clock = res;
        if (res.ok && Math.abs(res.lag) >= CLOCK_MIN) onResult.reapply();
      }
    } catch (e) {
      done();
      if (ctrl.signal.aborted || (e && e.name === 'AbortError')) { if (!L.dead) I.setStatus(L, job.why === 'track changed' ? 'Auto-sync stopped: the subtitle track changed.' : 'Auto-sync cancelled.', 4000); return; }
      if (!onResult.current()) L.lastSync = { ok: false, error: (e && e.message) || String(e), track: track && track.Index, method: job.method };
      if (!L.dead) I.setStatus(L, 'Couldn’t sync: ' + ((e && e.message) || 'error') + '. The −0.1 / +0.1 buttons still work.', 9000);
    } finally { if (job.running) done(); }
  }
  /* sections as [subtitle time from, delta to the first section's offset] */
  const secDeltas = r => (r && r.sections && r.sections.length > 1) ? r.sections.map(x => [x.from, Math.round((x.o - r.sections[0].o) * 1000) / 1000]) : null;

  /* Listen to the player while it plays (1x) until the lag to the server
     soundtrack is clear: first try after 40 s heard, then every 15 s, up to
     3 minutes heard. Progress in L.clockCheck for Subtitle info. */
  const _clockCache = new Map();    // item|source|audio|play path -> the measured lag
  const _clockPending = new Map();  // same key -> Promise while listening
  function clockCheck(L, server, key) {
    const st = L.clockCheck = { state: 'listening', heard: 0, started: Date.now() };
    return new Promise((resolveFirst) => {
      let first = true;
      const fin = (res) => { if (first) { first = false; resolveFirst(res); } };
      (async () => {
        const live = await speechLive(L, sec => { st.heard = sec; });
        let res = null, lastTry = 0;
        try {
          for (;;) {
            await new Promise(res2 => setTimeout(res2, 3000));
            if (L.dead) throw new DOMException('aborted', 'AbortError');   // the player closed
            const h = live.heard();
            if (h >= 40 && h - lastTry >= 15) {
              lastTry = h;
              st.state = 'comparing';
              res = (await call({ cmd: 'lag', live: live.speech, server: server.v1 || server, opts: {} })).result;
              st.state = 'listening'; st.last = res;
              if (res.ok || h >= 180) break;
            }
            if (Date.now() - st.started > 40 * 60000) { res = res || { ok: false, reason: 'not enough of the film was heard playing (paused or skipped?)' }; break; }
          }
        } catch (e) { live.stop(); fin({ ok: false, reason: (e && e.name === 'AbortError') ? 'stopped' : ((e && e.message) || String(e)) }); return; }
        fin(res);
        if (!res || !res.ok) { live.stop(); return; }
        // tracking, for as long as this player is open
        const tr = { applied: Math.abs(res.lag) >= CLOCK_MIN ? res.lag : 0, cand: null };
        st.track = { applied: tr.applied, checks: 0, history: [] };
        try {
          for (;;) {
            await new Promise(res2 => setTimeout(res2, 5000));
            if (L.dead) break;
            const h = live.heard();
            if (h - lastTry < 120) continue;
            lastTry = h;
            const r2 = (await call({ cmd: 'lag', live: live.recent(90), server: server.v1 || server, opts: {} })).result;
            st.track.checks++;
            st.track.history.push({ at: Math.round(live.at()), lag: r2.ok ? r2.lag : null });
            if (st.track.history.length > 12) st.track.history.shift();
            const lag = trackLag(tr, r2);
            if (lag != null) {
              st.track.applied = lag;
              const upd = Object.assign({}, r2, { lag, tracked: true });
              if (key) _clockCache.set(key, upd);
              try { if (L._onClock) L._onClock(upd); } catch {}
            }
          }
        } finally { live.stop(); }
      })().catch(e => fin({ ok: false, reason: (e && e.message) || String(e) }));
    });
  }


  window.GnwSubSync = { createVad, solve, scoreCues, lagBetween, shownAt, trackLag, autoSync, _speechLive: speechLive, _fileUrl: fileUrl, _byteSource: byteSource, _mbUrl: MB_URL, SCALES, CLOCK_MIN, _frameAt: frameAt, _lameDelay: lameDelay, _clockCache };
})();

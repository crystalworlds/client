/*
 * play/cores/atari/rewind-worker.js -- the rewind helper worker (the build plan
 * Phase 3, the Core API, section 4.3 "delta and deflate in a helper worker"). 2026-10-14,
 * for the Atari migration. Driven by ./rewind-ring.mjs; nothing else talks to it.
 *
 * WHY. An Atari state is 0.6 to 2.8 MB (the Lynx's 2.7 MB), taken every 150 ms of play. Kept
 * raw, the host's 48 MB cap holds 17 Lynx moments (2.5 s); gzipped on the main thread, the
 * old pages stepped back at about 9 a second. Here the main thread only copies the state out
 * of the core and hands its buffer over (transferred, not cloned); everything else is done
 * on this thread:
 *
 *   HEAD    the newest state, kept raw.
 *   DELTAS  one per older moment: deflate(older XOR the next newer). Most of a state does
 *           not change in 150 ms, so a delta is mostly zeros and deflates to a few KB.
 *   STEP    drop the head; the moment before it is head XOR inflate(last delta). The step
 *           AFTER that one is decoded AHEAD, as soon as a step is answered, so a held Rewind
 *           is answered from a ready buffer and keeps the host's 60 ms cadence.
 *
 * Messages in:  {t:'push', b:ArrayBuffer} | {t:'step', id} | {t:'clear'} | {t:'config', max, capBytes}
 * Messages out: {t:'state', id, b:ArrayBuffer|null, n} | {t:'stats', n, bytes, ...}
 */
'use strict';
let head = null;              // Uint8Array, the newest moment
const deltas = [];            // [{ z: Uint8Array (deflated XOR), n: raw length }], oldest first
let bytes = 0, max = 100, capBytes = 48 * 1024 * 1024;
let chain = Promise.resolve();
let ahead = null;             // { forIndex, state } -- the state one step older than head, decoded
let gen = 0;                  // bumps on every change that invalidates `ahead`
const stats = { pushes: 0, steps: 0, aheadHits: 0, aheadMiss: 0, deflateMs: 0, inflateMs: 0, maxZ: 0 };

const hasZ = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
async function deflate(u8) {
  if (!hasZ) return u8;
  const s = new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function inflate(u8) {
  if (!hasZ) return u8;
  const s = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
function xorInto(out, a, b) {
  // out = a ^ b, word-wise where aligned (a state is a whole number of words in practice)
  const n = out.length;
  if ((n & 3) === 0 && (a.byteOffset & 3) === 0 && (b.byteOffset & 3) === 0 && (out.byteOffset & 3) === 0) {
    const o = new Uint32Array(out.buffer, out.byteOffset, n >> 2), x = new Uint32Array(a.buffer, a.byteOffset, n >> 2), y = new Uint32Array(b.buffer, b.byteOffset, n >> 2);
    for (let i = 0; i < o.length; i++) o[i] = x[i] ^ y[i];
  } else for (let i = 0; i < n; i++) out[i] = a[i] ^ b[i];
  return out;
}
function trim() {
  while (deltas.length && (deltas.length + 1 > max || bytes > capBytes)) { const d = deltas.shift(); bytes -= d.z.length; }
}
function report() { postMessage({ t: 'stats', n: head ? deltas.length + 1 : 0, bytes, ...stats }); }

async function push(buf) {
  const s = new Uint8Array(buf);
  stats.pushes++;
  if (head && head.length === s.length) {
    const t0 = performance.now();
    const x = xorInto(new Uint8Array(s.length), head, s);
    const z = await deflate(x);
    stats.deflateMs += performance.now() - t0;
    if (z.length > stats.maxZ) stats.maxZ = z.length;
    deltas.push({ z, n: s.length });
    bytes += z.length;
  } else if (head) {           // a state of another size (another core): a new timeline
    deltas.length = 0; bytes = 0;
  }
  head = s;
  gen++; ahead = null;
  trim();
}
/* The moment before the head, from the last delta. */
async function older(h, d) {
  const t0 = performance.now();
  const x = await inflate(d.z);
  stats.inflateMs += performance.now() - t0;
  return xorInto(x, x, h);    // x := x ^ head, in place
}
async function step(id) {
  if (!head || !deltas.length) { postMessage({ t: 'state', id, b: null, n: head ? 1 : 0 }); return; }
  const d = deltas.pop();
  bytes -= d.z.length;
  let prev;
  if (ahead && ahead.gen === gen) { prev = ahead.state; stats.aheadHits++; }
  else { prev = await older(head, d); stats.aheadMiss++; }
  head = prev;
  gen++; ahead = null;
  stats.steps++;
  const copy = head.slice();
  postMessage({ t: 'state', id, b: copy.buffer, n: deltas.length + 1 }, [copy.buffer]);
  // Decode the next one ahead, off the critical path.
  if (deltas.length) {
    const g = gen, h = head, dn = deltas[deltas.length - 1];
    older(h, dn).then(st => { if (g === gen) ahead = { gen: g, state: st }; }, () => {});
  }
}

onmessage = e => {
  const m = e.data || {};
  if (m.t === 'push') chain = chain.then(() => push(m.b)).catch(() => {});
  else if (m.t === 'step') chain = chain.then(() => step(m.id)).catch(() => postMessage({ t: 'state', id: m.id, b: null, n: 0 }));
  else if (m.t === 'clear') chain = chain.then(() => { head = null; deltas.length = 0; bytes = 0; gen++; ahead = null; });
  else if (m.t === 'config') { if (m.max) max = m.max; if (m.capBytes) capBytes = m.capBytes; chain = chain.then(trim); }
  else if (m.t === 'stats') chain = chain.then(report);
};

/*
 * play/host/save-envelope.mjs -- THE COMMON SAVE FORMAT (2026-10-18).
 *
 * Not one memory layout for every console: one ENVELOPE around each core's own save bytes,
 * written and read by the host alone (play/host/host.mjs, play/host/saves.mjs). Every save
 * the host writes goes through it: save-state slots and quick save, the Continue row's state
 * (and the integrity record on its rewind history), and the cartridge's battery save in the
 * host's own store. The payload is the core's own bytes, untouched.
 *
 * LAYOUT (little-endian):
 *   0   4  magic 'CWSV'
 *   4   1  envelope version (1)
 *   5   3  zero
 *   8   4  CRC-32 of the header bytes
 *   12  4  header length in bytes
 *   16  .. header: UTF-8 JSON
 *   ..  .. payload: the core's own bytes
 *   then, optionally, THE METADATA SECTION (2026-10-18):
 *       4  magic 'CWMD'
 *       4  length in bytes (at most META_MAX)
 *       .. UTF-8 JSON object { v: 1, ... }
 *   It is OUTSIDE both checksums and outside the payload: information that travels with the save
 *   (in future, RetroAchievements pointers, play time, notes, labels), never needed to load it.
 *   The host keeps it untouched when a save is copied, sealed again, exported or imported, and
 *   ignores keys it does not know. It is parsed as JSON only, never executed. A malformed or
 *   oversized section reads as no metadata and never stops the state from loading.
 *   RESERVED KEYS (the Core API, section 8):
 *     v             1
 *     achievements  [{ source: 'retroachievements', id, title, badge, unlockedAt }]: information
 *                   pointers only ("this save's game did this"), not proof of anything; nothing is
 *                   verified or submitted from them. Nothing writes them yet (parked until release).
 *     playtime      { totalSeconds, lastPlayed }: written by the host on every save (2026-10-18),
 *                   from the site's own play-time tracking. sessionSeconds, firstPlayed: reserved.
 *     notes, labels reserved for later.
 * HEADER (JSON):
 *   v        1
 *   kind     'state' | 'battery'
 *   core     { id, build, api }     the console module's id, the core's build tag, the Core API version
 *   game     { sha256, id }         the game file's SHA-256 (null for a built-in game) and the site's device id
 *   model    the console model the save was made on ('dmg', 'cgb', 'ntsc', 'pal', ...)
 *   created  milliseconds since 1970 (the device's clock: a label, never a decision)
 *   thumb    a small PNG data URL, or null
 *   extra    kind-specific facts the host needs (a battery region's id), or absent
 *   payload  { length, crc32 }
 *
 * Nothing here knows any console. Users' files stay in their browser.
 */
export const MAGIC = [0x43, 0x57, 0x53, 0x56];     // 'CWSV'
export const ENVELOPE_VERSION = 1;

/* CRC-32 (IEEE 802.3, the zip and PNG polynomial), table-driven. */
let TABLE = null;
export function crc32(u8) {
  if (!TABLE) { TABLE = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; TABLE[n] = c >>> 0; } }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) c = TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* The plain words every console uses (device-neutral, no dashes). */
export const MESSAGES = {
  damaged: 'This save is damaged and cannot be loaded.',
  'other-game': 'This save belongs to a different game.',
  'other-console': 'This save is from a different console.',
  older: 'This save was made by an older version and cannot be loaded.',
  newer: 'This save was made by a newer version of the site and cannot be loaded here.',
};
export class SaveError extends Error {
  constructor(code, message) { super(message || MESSAGES[code] || code); this.name = 'SaveError'; this.code = code; }
}

const bytesOf = v => v instanceof Uint8Array ? v : ArrayBuffer.isView(v) ? new Uint8Array(v.buffer, v.byteOffset, v.byteLength) : new Uint8Array(v);
export function isEnvelope(v) {
  if (v == null || typeof v !== 'object') return false;
  let u; try { u = bytesOf(v); } catch (_) { return false; }
  return u.length >= 16 && MAGIC.every((b, i) => u[i] === b);
}

export const META_MAGIC = [0x43, 0x57, 0x4D, 0x44];   // 'CWMD'
export const META_MAX = 65536;
/** Wrap a core's bytes. h: { kind, core: {id, build, api}, game: {sha256, id}, model, created?, thumb?, extra? }.
 *  metaSection: the metadata section to carry: an object (written as JSON) or the raw section bytes
 *  of another envelope (kept byte for byte). */
export function wrap(h, payload, metaSection) {
  const p = bytesOf(payload);
  const header = {
    v: ENVELOPE_VERSION, kind: h.kind,
    core: { id: h.core && h.core.id || null, build: h.core && h.core.build != null ? String(h.core.build) : null, api: h.core && h.core.api || null },
    game: { sha256: h.game && h.game.sha256 || null, id: h.game && h.game.id || null },
    model: h.model != null ? String(h.model) : null,
    created: h.created || Date.now(),
    thumb: h.thumb || null,
    payload: { length: p.length, crc32: crc32(p) },
  };
  if (h.extra) header.extra = h.extra;
  const hb = new TextEncoder().encode(JSON.stringify(header));
  const ms = metaBytes(metaSection);
  const out = new Uint8Array(16 + hb.length + p.length + ms.length);
  out.set(MAGIC, 0); out[4] = ENVELOPE_VERSION;
  const dv = new DataView(out.buffer);
  dv.setUint32(8, crc32(hb), true); dv.setUint32(12, hb.length, true);
  out.set(hb, 16); out.set(p, 16 + hb.length); out.set(ms, 16 + hb.length + p.length);
  return out;
}
/* The section's bytes for an object or a kept section (an empty array: none). */
function metaBytes(m) {
  if (m == null) return new Uint8Array(0);
  if (m instanceof Uint8Array) return m;
  let j; try { j = new TextEncoder().encode(JSON.stringify(Object.assign({ v: 1 }, m))); } catch (_) { return new Uint8Array(0); }
  if (j.length > META_MAX) return new Uint8Array(0);
  const s = new Uint8Array(8 + j.length);
  s.set(META_MAGIC, 0); new DataView(s.buffer).setUint32(4, j.length, true); s.set(j, 8);
  return s;
}
/* Where the payload ends (the metadata section, if any, starts there). */
function payloadEnd(u, header) { return 16 + new DataView(u.buffer, u.byteOffset, u.byteLength).getUint32(12, true) + header.payload.length; }
/** The metadata section's raw bytes, to carry into another envelope unchanged (empty: none). Never throws. */
export function metaSection(v) {
  try { const u = bytesOf(v), h = peek(u), e = payloadEnd(u, h); return u.length > e ? u.slice(e) : new Uint8Array(0); } catch (_) { return new Uint8Array(0); }
}
/** The metadata as an object, or null (none, malformed, too big). Never throws. */
export function readMeta(v) {
  try {
    const s = metaSection(v);
    if (s.length < 8 || !META_MAGIC.every((b, i) => s[i] === b)) return null;
    const n = new DataView(s.buffer, s.byteOffset, s.byteLength).getUint32(4, true);
    if (n > META_MAX || 8 + n > s.length) return null;
    const o = JSON.parse(new TextDecoder().decode(s.subarray(8, 8 + n)));
    return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
  } catch (_) { return null; }
}
/** The same envelope with its metadata replaced (header and payload untouched, checksums still good). */
export function withMeta(v, meta) {
  const u = bytesOf(v), h = peek(u), e = payloadEnd(u, h), ms = metaBytes(meta);
  const out = new Uint8Array(e + ms.length); out.set(u.subarray(0, e), 0); out.set(ms, e);
  return out;
}

/** The header alone, its own checksum verified (listing: thumbnails, labels, dates). */
export function peek(v) {
  const u = bytesOf(v);
  if (!isEnvelope(u)) throw new SaveError('damaged');
  if (u[4] > ENVELOPE_VERSION) throw new SaveError('newer');
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
  const hl = dv.getUint32(12, true);
  if (16 + hl > u.length) throw new SaveError('damaged');
  const hb = u.subarray(16, 16 + hl);
  if (crc32(hb) !== dv.getUint32(8, true)) throw new SaveError('damaged');
  let header; try { header = JSON.parse(new TextDecoder().decode(hb)); } catch (_) { throw new SaveError('damaged'); }
  // Bytes after the payload are the metadata section: never part of the save's integrity.
  if (!header || !header.payload || 16 + hl + header.payload.length > u.length) throw new SaveError('damaged');
  return header;
}

/** The header, with BOTH checksums verified and no copy made (listing marks a damaged save). */
export function verify(v) {
  const u = bytesOf(v);
  const header = peek(u);
  const hl = new DataView(u.buffer, u.byteOffset, u.byteLength).getUint32(12, true);
  if (crc32(u.subarray(16 + hl, 16 + hl + header.payload.length)) !== header.payload.crc32) throw new SaveError('damaged');
  return header;
}

/** Header and payload, both checksums verified. The payload is a copy. */
export function open(v) {
  const u = bytesOf(v);
  const header = peek(u);
  const hl = new DataView(u.buffer, u.byteOffset, u.byteLength).getUint32(12, true);
  const payload = u.slice(16 + hl, 16 + hl + header.payload.length);
  if (crc32(payload) !== header.payload.crc32) throw new SaveError('damaged');
  return { header, payload };
}

/** Why a save cannot go into this machine: a SaveError, or null. here: { coreId, sha256, gameId }.
 *  The model and the core build are the host's to judge (it can try an older build). */
export function judge(header, here) {
  if (!header) return new SaveError('damaged');
  if (here.coreId && header.core && header.core.id && header.core.id !== here.coreId) return new SaveError('other-console');
  const g = header.game || {};
  if (g.sha256 && here.sha256) { if (g.sha256 !== here.sha256) return new SaveError('other-game'); }
  else if (g.id && here.gameId && g.id !== here.gameId) return new SaveError('other-game');
  return null;
}

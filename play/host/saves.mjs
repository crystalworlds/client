/*
 * play/host/saves.mjs -- the one save store for every console (decision P5, 2026-10-11).
 *
 * NEW saves go to ONE IndexedDB database, 'cw-play':
 *   slots     `${sys}|${game}|${model}` -> [ { ts, state, thumb, thumbWhy, model, api, build } | null | TOMB ]
 *   battery   `${sys}|${game}|${id}`    -> Uint8Array (the cartridge's own save)
 *   firmware  `${sys}|${id}`            -> { bytes, from: 'site' | 'user', at }
 * OLD stores (each console's own database, named by its core module's manifest.legacy) are
 * read only for a cached boot program (firmware). Their saves were deleted once on
 * 2026-10-18 (play/host/save-purge.js) and are neither read nor written.
 *
 * Users' files stay in their browser: nothing here leaves this machine.
 */
import { isEnvelope, open as openEnvelope } from './save-envelope.mjs?v=2.1.0';
/* THE COMMON SAVE FORMAT (2026-10-18, play/host/save-envelope.mjs): every slot and battery save in
   cw-play is an envelope; nothing else is read as a save (decided 2026-10-18, below). */
const DB = 'cw-play', VER = 1, STORES = ['slots', 'battery', 'firmware'];
export const TOMB = { removed: true };

let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => { for (const s of STORES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
function tx(store, mode, fn) {
  return db().then(d => new Promise((res, rej) => {
    const t = d.transaction(store, mode), st = t.objectStore(store);
    let out; const q = fn(st);
    if (q) q.onsuccess = () => { out = q.result; };
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  }));
}
export const get = (store, key) => tx(store, 'readonly', st => st.get(key));
export const put = (store, key, v) => tx(store, 'readwrite', st => st.put(v, key));
export const del = (store, key) => tx(store, 'readwrite', st => st.delete(key));

/* ---- the old stores, read in place. Opening a database that does not exist would
   create it: refused here (the upgrade is aborted), so a read never leaves one behind. */
const legacyDbs = new Map();
function legacyDb(name) {
  if (legacyDbs.has(name)) return legacyDbs.get(name);
  const p = new Promise(res => {
    let created = false;
    const r = indexedDB.open(name);
    r.onupgradeneeded = () => { created = true; try { r.transaction.abort(); } catch (_) {} };
    r.onsuccess = () => res(created ? null : r.result);
    r.onerror = () => res(null);
  });
  // Only an open database is kept: a missing one is asked again next time (the old
  // window, in another tab, may create it meanwhile).
  legacyDbs.set(name, p);
  p.then(d => { if (!d) legacyDbs.delete(name); });
  return p;
}
export async function legacyGet(L, key) {
  if (!L || !L.db) return null;
  const d = await legacyDb(L.db);
  if (!d || !d.objectStoreNames.contains(L.store)) return null;
  return new Promise(res => {
    try { const q = d.transaction(L.store, 'readonly').objectStore(L.store).get(key); q.onsuccess = () => res(q.result == null ? null : q.result); q.onerror = () => res(null); }
    catch (_) { res(null); }
  });
}
/* ---------------------------------------------------------------- slots */
/* DECIDED 2026-10-18 (earlier saves were test data only): only saves in the common save format exist. The retired windows' slot stores are
   no longer read, a record here without an envelope is not a save, and every save made before the
   envelope was deleted once by play/host/save-purge.js. */
export const slotKey = (sys, game, model) => `${sys}|${game}|${model}`;
/** This game's slots on this model: the stored records ({ env: 1, ts, state: <envelope> }, null, TOMB). */
export async function listSlots(manifest, game, model, n) {
  const own = (await get('slots', slotKey(manifest.id, game, model)).catch(() => null)) || [];
  const out = [];
  for (let i = 0; i < Math.max(n, own.length); i++) {
    const o = own[i];
    out.push(o && !o.removed && o.env ? o : null);
  }
  return out;
}
export async function putSlot(manifest, game, model, i, rec) {
  const key = slotKey(manifest.id, game, model);
  const arr = (await get('slots', key).catch(() => null)) || [];
  while (arr.length <= i) arr.push(null);
  arr[i] = rec;
  await put('slots', key, arr);
}

/* ---------------------------------------------------------------- battery */
const b64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = t => { const s = atob(t), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
/* The keys for one battery region: this store's own record and its crash journal. The host adds
   keys.seal (bytes -> envelope) and keys.check (header -> null or a SaveError). The retired
   windows' mirror copies are neither read nor written any more (decision above). */
export function batteryKeys(manifest, game, gameBytes, id, hash) {
  return { id, gameBytes, own: `${manifest.id}|${game}|${id}`, journal: `cw.battery-journal:${manifest.id}|${game}|${id}` };
}
/* A stored image as the core's bytes: only an envelope is a save; it is opened (both checksums) and
   judged, and a damaged or foreign one is refused (thrown, so the caller says so). */
function unsealed(keys, v) {
  const u = new Uint8Array(v.buffer ? v.buffer.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength) : v);
  if (!isEnvelope(u)) return null;
  const { header, payload } = openEnvelope(u);
  const why = keys.check ? keys.check(header) : null;
  if (why) throw why;
  return payload;
}
/** The stored battery image: a journal left by an interrupted page first, then this store's own. */
export async function batteryLoad(manifest, keys) {
  try {
    const j = localStorage.getItem(keys.journal);
    if (j) {
      let u = null; try { u = unsealed(keys, unb64(j)); } catch (_) { u = null; }
      try { localStorage.removeItem(keys.journal); } catch (_) {}
      if (u && u.length) { await batterySave(manifest, keys, u); return { bytes: u, from: 'journal' }; }
    }
  } catch (_) {}
  const v = await get('battery', keys.own).catch(() => null);
  if (!v) return null;
  try { const u = unsealed(keys, v); return u ? { bytes: u, from: 'cw-play' } : null; }
  catch (e) { return { bytes: null, refused: e, from: 'cw-play' }; }
}
export async function batterySave(manifest, keys, bytes) {
  const copy = new Uint8Array(bytes);
  await put('battery', keys.own, keys.seal ? keys.seal(copy) : copy);
  try { localStorage.removeItem(keys.journal); } catch (_) {}
}
/** Synchronous, for pagehide: an IndexedDB write still open at teardown is not kept. */
export function batteryJournal(manifest, keys, bytes) {
  try { localStorage.setItem(keys.journal, b64(keys.seal ? keys.seal(bytes) : bytes)); return true; } catch (_) { return false; }
}

/* ---------------------------------------------------------------- firmware cache */
export async function firmwareCached(manifest, id) {
  const own = await get('firmware', `${manifest.id}|${id}`).catch(() => null);
  if (own && own.bytes) return own;
  const L = manifest.legacy, f = L && L.firmware && L.firmware[id];
  if (!f) return null;
  const bytes = await legacyGet(L, f.key);
  if (!bytes) return null;
  const from = f.fromKey ? await legacyGet(L, f.fromKey) : null;
  return { bytes: new Uint8Array(bytes), from: from === 'user' ? 'user' : 'site', legacy: true };
}
export const firmwareKeep = (manifest, id, bytes, from) => put('firmware', `${manifest.id}|${id}`, { bytes: new Uint8Array(bytes), from, at: Date.now() }).catch(() => {});

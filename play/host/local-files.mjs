/*
 * play/host/local-files.mjs -- files the player chose on this device, remembered on this device
 * (2026-10-19; the unified UI leftovers "remember chosen Study Box tapes" and "remember
 * games picked from this machine").
 *
 * One IndexedDB database of its own, 'cw-local' (never the save store 'cw-play': these are not
 * saves, so the common save envelope does not apply), with two stores:
 *   handles  `<console>|tapes`  -> [{ name, size, handle, at }]   a FILE HANDLE, never the file
 *            (a Study Box tape is 150 to 180 MB; the deck reads it a few seconds at a time). Only a
 *            browser with the file picker that gives handles (showOpenFilePicker: desktop Chrome and
 *            Edge) can keep one; elsewhere the tape is chosen again next visit, as before.
 *   recent   `<console>`        -> [{ id, name, size, sha256, bytes, at }]   a game file the player
 *            opened with the player's own file picker, kept whole (game files are small), newest
 *            first, at most RECENT_MAX per console and RECENT_BYTES each.
 * PRIVACY: nothing here leaves this device. Nothing is uploaded, logged or sent; the log names a
 * count only. "Forget" removes the entries for good.
 */
const DB = 'cw-local', VER = 1, STORES = ['handles', 'recent'];
export const RECENT_MAX = 8, RECENT_BYTES = 32 * 1024 * 1024, TAPES_MAX = 24;

let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => { for (const s of STORES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  dbp.catch(() => { dbp = null; });
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
const get = (store, key) => tx(store, 'readonly', st => st.get(key));
const put = (store, key, v) => tx(store, 'readwrite', st => st.put(v, key));
const del = (store, key) => tx(store, 'readwrite', st => st.delete(key));

/* ---------------------------------------------------------------- file handles (tapes) */
/** True where the browser's picker gives a handle that can be kept (desktop Chrome, Edge). */
export const canKeepHandles = () => typeof window.showOpenFilePicker === 'function';
export async function tapeHandles(sys) {
  const l = await get('handles', `${sys}|tapes`).catch(() => null);
  return Array.isArray(l) ? l.filter(e => e && e.name && e.handle) : [];
}
export async function rememberTape(sys, handle, size) {
  const l = (await tapeHandles(sys)).filter(e => e.name !== handle.name);
  l.push({ name: handle.name, size: size || 0, handle, at: Date.now() });
  await put('handles', `${sys}|tapes`, l.slice(-TAPES_MAX));
}
export async function forgetTapes(sys) { await del('handles', `${sys}|tapes`).catch(() => {}); }
/** The file behind a kept handle. The browser asks the player again where it wants to (that
    needs the press that chose the tape); a refusal or a moved file throws a plain message. */
export async function fileFromHandle(handle) {
  let p = 'granted';
  try { if (handle.queryPermission) p = await handle.queryPermission({ mode: 'read' }); } catch (_) { p = 'prompt'; }
  if (p !== 'granted') {
    try { if (handle.requestPermission) p = await handle.requestPermission({ mode: 'read' }); } catch (_) { p = 'denied'; }
  }
  if (p !== 'granted') throw new Error('The browser did not allow reading that tape again. Choose it once more with "Choose a tape file".');
  try { return await handle.getFile(); }
  catch (_) { throw new Error('That tape could not be read again (moved or renamed?). Choose it once more with "Choose a tape file".'); }
}

/* ---------------------------------------------------------------- recent games */
export async function recentGames(sys) {
  const l = await get('recent', sys).catch(() => null);
  return Array.isArray(l) ? l.filter(e => e && e.id && e.bytes) : [];
}
/** Keep a game file opened from this device (newest first). Returns false when it is too big. */
export async function rememberGame(sys, name, bytes, sha256) {
  if (!bytes || !bytes.length || bytes.length > RECENT_BYTES) return false;
  const id = sha256 || `${name}|${bytes.length}`;
  const l = (await recentGames(sys)).filter(e => e.id !== id);
  l.unshift({ id, name, size: bytes.length, sha256: sha256 || null, bytes: new Uint8Array(bytes), at: Date.now() });
  await put('recent', sys, l.slice(0, RECENT_MAX));
  return true;
}
export async function forgetGame(sys, id) {
  const l = (await recentGames(sys)).filter(e => e.id !== id);
  if (l.length) await put('recent', sys, l); else await del('recent', sys).catch(() => {});
}
export async function forgetGames(sys) { await del('recent', sys).catch(() => {}); }

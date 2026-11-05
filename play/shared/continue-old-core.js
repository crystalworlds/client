/* play/shared/continue-old-core.js: what an Atari play page does with a Continue
 * save that an older core made (decided 2026-10-10).
 *
 * THE CASE. The host's Continue row (continuerow.js on the site's index.html)
 * keeps one save per title in IndexedDB 'gnw-continue', store 'games', keyed
 * by the title's device id. Each Atari record carries `core`, the SHA-256 of
 * the core that wrote it (play/<sys>/CORE-VERSION.json). A state is the whole
 * machine context and is valid only for that core, so when the core is
 * swapped (2026-10-10: every context but the 5200's grew) the page's
 * window.__continue.restore() refuses it and the game starts from power on.
 * Before this file that refusal was a console warning only, and the card stayed
 * on the row to be refused again on every launch.
 *
 * WHAT HAPPENS NOW, in this order:
 *   1. The entry is deleted from 'gnw-continue'/'games' (and its rewind
 *      history, if it had one, from 'gnw-continue-rewind'/'rewind').
 *   2. The host's row is redrawn (window.parent.ContinueRow.refresh) and the
 *      page shows one short line: "Saved with an older emulator, starting
 *      fresh."
 * NO COPY IS KEPT (2026-10-12: losing saves does
 * not matter while testing, and there will be no converter). The game's battery save and save slots are never touched here.
 *
 * WHY HERE AND NOT IN THE HOST. The refusal happens in the page (its restore
 * throws), and the page and the host share an origin (the play frame is not
 * sandboxed), so the page can reach the host's database directly. Doing it here
 * keeps the whole change inside play/, and every Atari page shares this one
 * file. The host keeps its own behaviour: it still logs the refusal and sets
 * window.__continueRestored.error.
 *
 * NEVER CREATES THE HOST'S DATABASE. If 'gnw-continue' does not exist, opening
 * it would make an empty one without the 'games' store, which would break the
 * host (it creates the store only on its own first open). The open therefore
 * aborts its upgrade, so a missing database stays missing.
 */
const HOST_DB = 'gnw-continue', HOST_STORE = 'games';
const REWIND_DB = 'gnw-continue-rewind', REWIND_STORE = 'rewind';
export const OLD_SAVE_MESSAGE = 'Saved with an older emulator, starting fresh.';

/* Open an existing database without ever creating or upgrading it. */
function openExisting(name) {
  return new Promise((res, rej) => {
    let r;
    try { r = indexedDB.open(name); } catch (e) { rej(e); return; }
    r.onupgradeneeded = () => { try { r.transaction.abort(); } catch (e) { /* aborting anyway */ } };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error || new Error('no database ' + name));
  });
}
function done(t) {
  return new Promise((res, rej) => {
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('aborted'));
  });
}

/* Clear the refused record from the row. Resolves to { cleared } and never
 * throws: a failure leaves the entry as it was. */
export async function clearOldSave(rec) {
  const out = { cleared: false };
  if (!rec || !rec.id || typeof indexedDB === 'undefined') return out;
  try {
    const host = await openExisting(HOST_DB);
    try {
      if (host.objectStoreNames.contains(HOST_STORE)) {
        const t = host.transaction(HOST_STORE, 'readwrite');
        const st = t.objectStore(HOST_STORE);
        /* Only the very record that was refused: a newer save written in the
         * meantime (a different ts or core) is left alone. */
        const q = st.get(rec.id);
        q.onsuccess = () => {
          const cur = q.result;
          if (cur && cur.ts === rec.ts && cur.core === rec.core) { st.delete(rec.id); out.cleared = true; }
        };
        await done(t);
      }
    } finally { host.close(); }
  } catch (e) { console.warn('[continue] could not clear the older save:', e && e.message || e); }
  if (out.cleared && rec.rewindBytes) {
    try {
      const rw = await openExisting(REWIND_DB);
      try {
        if (rw.objectStoreNames.contains(REWIND_STORE)) {
          const t = rw.transaction(REWIND_STORE, 'readwrite');
          t.objectStore(REWIND_STORE).delete(rec.id);
          await done(t);
        }
      } finally { rw.close(); }
    } catch (e) { /* a stale history is ignored by the host anyway (its ts no longer matches) */ }
  }
  try { if (out.cleared && window.parent && window.parent !== window && window.parent.ContinueRow) window.parent.ContinueRow.refresh(); }
  catch (e) { /* not framed by the site, or another origin */ }
  return out;
}

/* The whole C2 path for one refused record: clear, say so. `say` shows
 * the line in the page (its banner). Recorded on window.__continuePreR8 for a
 * headless check. Fire and forget: restore() must still throw synchronously. */
export function handleOldSave(rec, reason, say) {
  try { if (typeof say === 'function') say(OLD_SAVE_MESSAGE); } catch (e) { /* the page goes on */ }
  const p = clearOldSave(rec).then(r => {
    window.__continuePreR8 = Object.assign({ id: rec && rec.id, reason: String(reason || ''), at: Date.now() }, r);
    return r;
  });
  window.__continuePreR8Pending = p;
  return p;
}

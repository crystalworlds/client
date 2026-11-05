/* store.js — user-supplied files, held locally and only locally.
 *
 * A content-agnostic key/value store over IndexedDB, the same plumbing the
 * Pokemon mini shell uses. Nothing here uploads, fetches, posts, or serialises
 * anything to anywhere; the only sink is the browser's own origin-private
 * database on this machine.
 *
 * Keys:
 *   bios              the boot program, user-supplied, optional
 *   cart:<slug>       the cartridge firmware bound to a ladder slot
 *   cram:<slug>       battery-backed cartridge RAM for that slot
 */

const DB_NAME = "gameboy", STORE = "blobs", VERSION = 1;

function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, VERSION);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function put(key, value) {
  const db = await open();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
}

export async function get(key) {
  const db = await open();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readonly");
    const rq = tx.objectStore(STORE).get(key);
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}

export async function del(key) {
  const db = await open();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
}

export async function keys() {
  const db = await open();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readonly");
    const rq = tx.objectStore(STORE).getAllKeys();
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}

/** Read a File/Blob the user picked or dropped. Never touches the network. */
export async function readFile(file) {
  return new Uint8Array(await file.arrayBuffer());
}

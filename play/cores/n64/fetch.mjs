// Fetching a game file from a game server, the core module's side of the contract written in FETCH-CONTRACT.md
// beside this folder. A cartridge is read at random from its first instruction, so the whole file is in memory
// before the game starts: it is fetched in pieces with progress, checked whole against the server's own name for
// its bytes, and kept in the browser so that a second visit fetches nothing. It imports only the shared hash.
//
//   const got = await fetchGame({ url, onProgress, store })    got.bytes, got.sha256, got.from ("store" or "server")
//
// The bytes are the user's own (their own server's): they go to the caller and to the store, nowhere else.

import { sha256 as ownSha256 } from "./machine/sha256.mjs?v=5ca4ef310af2";

export const PIECE = 4 * 1024 * 1024;        // bytes asked for in one request
export const IN_FLIGHT = 3;                  // requests at once
export const TRIES = 4;                      // tries of one piece before the fetch ends
export const WAIT_MS = [500, 1000, 2000, 4000];
// The browser's game store answers within STORE_WAIT_MS or is gone on without: a store that hangs (a browser busy, a
// database blocked by another tab) must not hold the game back; it is fetched anew and the page says so.
export const STORE_WAIT_MS = 5000;
const within = (promise, ms, fault) => (fault === 416 ? promise : Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(TOO_LATE), ms))]));   // 416, wrong on purpose: no limit
const TOO_LATE = Symbol("too late");

// The SHA-256 the server names the file's bytes by: the Repr-Digest header of RFC 9530 (sha-256, base64), or
// failing that a strong ETag that is 64 hex digits.
export function namedSha256(headers) {
  const d = /sha-256=:([A-Za-z0-9+/=]+):/.exec(headers.get("repr-digest") ?? "");
  if (d) { const raw = atob(d[1]); if (raw.length === 32) return [...raw].map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join(""); }
  const e = /^"([0-9a-f]{64})"$/i.exec(headers.get("etag") ?? "");
  return e ? e[1].toLowerCase() : null;
}
async function hashOf(bytes) {
  try { if (globalThis.crypto?.subtle) return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join(""); } catch { /* the shared one below */ }
  return ownSha256(bytes);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
class FetchError extends Error { constructor(kind, message) { super(message); this.kind = kind; } }

// What the user is shown, in the site's plain words, for each moment of a fetch.
export function words(event) {
  const mb = (n) => (n / 1048576).toFixed(n < 10485760 ? 1 : 0);
  switch (event.kind) {
    case "asking": return "Asking your game server for the game";
    case "kept": return "The game is already on this device";
    case "progress": return `Fetching the game: ${mb(event.got)} of ${mb(event.total)} MB`;
    case "again": return `The connection dropped; trying again (${event.attempt} of ${TRIES})`;
    case "checking": return "Checking the game is whole";
    case "damaged": return "The game that came was not whole, so nothing was kept. Try again; if it keeps happening, your game server's copy may be damaged";
    case "changed": return "The game changed on your game server while it was being fetched; starting again";
    case "failed": return `The game could not be fetched: ${event.why}. Try again`;
    case "store-slow": return "The browser's game store did not answer in time, so the game is fetched anew";
    case "store-slow-keep": return "The browser's game store did not answer in time, so this game was not kept for next time";
    case "no-name": return "Your game server did not say what the game's bytes are, so the game cannot be checked; it needs a newer game server";
    default: return "";
  }
}

// url: the file-by-id address. store: { get(sha256) -> bytes or null, put(sha256, bytes) }. onProgress(event).
// fault: a number that makes this wrong on purpose, for a check only.
export async function fetchGame({ url, store = null, onProgress = () => {}, fetchImpl = globalThis.fetch, piece = PIECE, waits = WAIT_MS, storeWaitMs = STORE_WAIT_MS, fault = 0 }) {
  const say = (e) => { try { onProgress({ ...e, words: words(e) }); } catch { /* the caller's own */ } };
  say({ kind: "asking" });
  const head = await fetchImpl(url, { method: "HEAD", cache: "no-store" }).catch((e) => { throw new FetchError("failed", `the game server did not answer (${e?.message ?? e})`); });
  if (!head.ok) throw new FetchError("failed", `the game server answered ${head.status}`);
  const total = Number(head.headers.get("content-length")), named = namedSha256(head.headers), tag = head.headers.get("etag");
  if (!named) { say({ kind: "no-name" }); throw new FetchError("no-name", words({ kind: "no-name" })); }
  if (!(total > 0)) throw new FetchError("failed", "the game server did not say how long the game is");
  store?.hold?.(named);                            // the game being loaded is never let go to make room
  if (store) {
    const have = await within(Promise.resolve(store.get(named)).catch(() => null), storeWaitMs, fault);
    if (have === TOO_LATE) say({ kind: "store-slow" });
    if (have && have.length === total && (await hashOf(have)) === named) { say({ kind: "kept", got: total, total }); return { bytes: have, sha256: named, from: "store", requests: 1 }; }
  }
  const ranges = head.headers.get("accept-ranges") === "bytes";
  const bytes = new Uint8Array(total);
  let got = 0, requests = 1;
  const pieces = [];
  for (let at = 0; at < total; at += ranges ? piece : total) pieces.push([at, Math.min(total, at + (ranges ? piece : total)) - 1]);
  // One piece, tried until it comes or the tries are spent. A piece of another file (the server's name for the
  // bytes changed) ends the fetch at once: the caller starts again.
  const one = async ([from, to]) => {
    for (let attempt = 1; ; attempt++) {
      try {
        requests++;
        const headers = ranges ? { Range: `bytes=${from}-${to}`, ...(tag ? { "If-Range": tag } : {}) } : {};
        const r = await fetchImpl(url, { headers, cache: "no-store" });
        const now = namedSha256(r.headers);
        if (now && now !== named) { say({ kind: "changed" }); throw new FetchError("changed", words({ kind: "changed" })); }
        if (ranges && r.status !== 206) throw new FetchError(r.status === 200 ? "changed" : "piece", `the game server answered ${r.status} for a piece`);
        const body = new Uint8Array(await r.arrayBuffer());
        if (body.length !== to - from + 1) throw new FetchError("piece", `a piece came ${body.length} bytes long, not ${to - from + 1}`);
        bytes.set(body, from);
        got += body.length;
        say({ kind: "progress", got, total });
        return;
      } catch (e) {
        if (e instanceof FetchError && e.kind === "changed") throw e;
        if (attempt >= TRIES) throw new FetchError("failed", `a piece did not come after ${TRIES} tries (${e?.message ?? e})`);
        say({ kind: "again", attempt: attempt + 1 });
        await sleep(waits[attempt - 1] ?? 4000);
      }
    }
  };
  const queue = [...pieces];
  await Promise.all(Array.from({ length: Math.min(IN_FLIGHT, queue.length) }, async () => { while (queue.length) await one(queue.shift()); }));
  say({ kind: "checking", got, total });
  // 405, wrong on purpose: the whole file is not checked.
  if (fault !== 405 && (await hashOf(bytes)) !== named) { say({ kind: "damaged" }); throw new FetchError("damaged", words({ kind: "damaged" })); }
  if (store) { const put = await within(Promise.resolve(store.put(named, bytes)).catch(() => {}), storeWaitMs, fault); if (put === TOO_LATE) say({ kind: "store-slow-keep" }); }
  return { bytes, sha256: named, from: "server", requests };
}

// How much of the browser's room fetched games may take: 512 MiB, eight of the largest cartridge (64 MiB) or a few
// dozen of the usual 8 to 16 MiB. A store over it lets go of the game used longest ago first, never the one being put
// in nor one held (the game playing now).
export const STORE_CAP = 512 * 1024 * 1024;

// A store with that cap, over a raw store: { get(sha), put(sha, bytes, usedAt), drop(sha), touch(sha, usedAt),
// list() -> [{ sha, bytes, usedAt }] }. get marks a game used; hold(sha) keeps it from being let go while it plays.
export function cappedStore(raw, { cap = STORE_CAP, now = () => Date.now(), fault = 0 } = {}) {
  const held = new Set();
  return {
    hold(sha) { held.add(sha); }, letGo(sha) { held.delete(sha); },
    async get(sha) { const b = await raw.get(sha); if (b) await raw.touch(sha, now()); return b; },
    async put(sha, bytes) {
      if (bytes.length > cap) return false;            // larger than the whole room: used from memory, not kept
      await raw.put(sha, bytes, now());
      // 406, wrong on purpose: the game used most lately is let go first, and the one just put is not spared.
      const others = (await raw.list()).filter((m) => fault === 406 || (m.sha !== sha && !held.has(m.sha))).sort((a, b) => (fault === 406 ? b.usedAt - a.usedAt : a.usedAt - b.usedAt));
      let total = (await raw.list()).reduce((n, m) => n + m.bytes, 0);
      while (total > cap && others.length) { const m = others.shift(); await raw.drop(m.sha); total -= m.bytes; }
      return true;
    },
    list: () => raw.list(),
  };
}
// A raw store in memory, for a test or a page that keeps nothing.
export function memoryStore() {
  const files = new Map(), meta = new Map();
  return {
    get: async (sha) => files.get(sha) ?? null, put: async (sha, bytes, usedAt) => { files.set(sha, bytes); meta.set(sha, { sha, bytes: bytes.length, usedAt }); },
    drop: async (sha) => { files.delete(sha); meta.delete(sha); }, touch: async (sha, usedAt) => { const m = meta.get(sha); if (m) m.usedAt = usedAt; },
    list: async () => [...meta.values()].map((m) => ({ ...m })),
  };
}

// The browser's store for fetched games, by the SHA-256 of their bytes: one IndexedDB database of this core's own
// ("files": the bytes; "meta": each game's size and when it was last used), under the cap above.
export function browserStore(name = "cw-n64-games", options = {}) {
  const db = () => new Promise((resolve, reject) => { const r = indexedDB.open(name, 2); r.onupgradeneeded = () => { for (const s of ["files", "meta"]) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); }; r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  const run = async (store, mode, f) => { const d = await db(); return new Promise((resolve, reject) => { const t = d.transaction(store, mode), q = f(t.objectStore(store)); t.oncomplete = () => { d.close(); resolve(q?.result); }; t.onerror = () => { d.close(); reject(t.error); }; }); };
  const raw = {
    get: async (sha) => { const v = await run("files", "readonly", (s) => s.get(sha)); return v ? new Uint8Array(v) : null; },
    put: async (sha, bytes, usedAt) => { await run("files", "readwrite", (s) => s.put(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), sha)); await run("meta", "readwrite", (s) => s.put({ sha, bytes: bytes.length, usedAt }, sha)); },
    drop: async (sha) => { await run("files", "readwrite", (s) => s.delete(sha)); await run("meta", "readwrite", (s) => s.delete(sha)); },
    touch: async (sha, usedAt) => { const m = await run("meta", "readonly", (s) => s.get(sha)); if (m) await run("meta", "readwrite", (s) => s.put({ ...m, usedAt }, sha)); },
    list: async () => (await run("meta", "readonly", (s) => s.getAll())) ?? [],
  };
  return cappedStore(raw, options);
}

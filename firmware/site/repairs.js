/* firmware/site/repairs.js -- bad copies repaired in memory when they are loaded (13 Nov 2026).
 * ===========================================================================
 *
 * The ruling: "Booting is not what we are aiming for. If a game is not playable its not
 * supported." A bad copy (a file copied wrongly from its cartridge or disk) is never played as it
 * is. Where the library held both a bad copy and the verified clean copy of the same game, a tiny
 * patch was made by comparing them (tools/repairs/build.mjs): the clean file's size, the stretches
 * kept from the bad file, a few changed bytes (at most 1,024 outside the header). A person who has
 * only the bad copy gets the clean copy: it is repaired here, in memory, before the emulator starts,
 * and the result's SHA-256 must equal the clean copy's or the file is refused like any unsupported
 * one. The person's own file is never changed or stored changed.
 *
 * A REPAIRED COPY IS THE CLEAN COPY EVERYWHERE. The first 12 hex digits of every patched bad copy
 * and of its clean copy are in firmware/repairs/alias.js, loaded before this file on every page, so
 * the tile, the variants, the details, the box art, the clip, the shelf and the not-supported check
 * all look up the clean copy's id (clean12 / cleanId below); the play host plays the repaired bytes
 * and keeps its saves under the clean copy's id. A bad copy with no patch is on the not-supported
 * list (reason code BAD_COPY) and is refused there.
 *
 * window.CWSRepair
 *   .clean12(sha12)      the clean copy's first 12 hex digits for a patched bad copy, else null (sync)
 *   .cleanId(id)         the same for a content-addressed id (<prefix>-x<sha12>), else null (sync)
 *   .repair(bytes)       Promise: { repaired: false } for every other file;
 *                        { repaired: true, bytes, from, to } (from/to: full SHA-256s);
 *                        { refused: entry } when the patch cannot be loaded or does not give the
 *                        clean copy exactly (entry as CWSUnsupported's, code BAD_COPY)
 *   .apply(bytes, patch) the patch alone (Uint8Array, or null if the patch does not fit the file)
 *   .REASON              the line a refused visitor reads
 *
 * No cartridge bytes leave the page and none are logged. Silent: no sound.
 */
(function () {
  'use strict';
  if (window.CWSRepair) return;

  const BASE = (function () {
    try { const s = document.currentScript && document.currentScript.src; if (s) return s.replace(/[^/]*$/, '') + '../repairs/'; } catch (e) {}
    return 'firmware/repairs/';
  })();
  const REASON = 'This file is a bad copy: it was copied wrongly from its cartridge or disk, so parts of the game are damaged. A clean copy of the same game plays.';

  /* alias.js: per system a string of 24-hex pairs (bad12 then clean12). Unpacked once, on first use. */
  let pairs = null;          // bad12 -> { sys, clean12 }
  function table() {
    if (pairs) return pairs;
    const A = self.CWSRepairAlias;
    if (!A || !A.systems) return null;     // not loaded (yet): nothing is a known bad copy
    const m = new Map();
    for (const sys in A.systems) {
      const s = String(A.systems[sys] || '');
      for (let i = 0; i + 24 <= s.length; i += 24) m.set(s.slice(i, i + 12), { sys, clean12: s.slice(i + 12, i + 24) });
    }
    pairs = m;
    return m;
  }
  function clean12(sha12) {
    const t = table(), k = String(sha12 || '').toLowerCase().slice(0, 12);
    const p = t && k.length === 12 && t.get(k);
    return p ? p.clean12 : null;
  }
  function cleanId(id) {
    const m = /^(.*-x)([0-9a-f]{12})$/.exec(String(id || ''));
    const c = m && clean12(m[2]);
    return c ? m[1] + c : null;
  }

  function hex(buf) { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i++) s += (u[i] < 16 ? '0' : '') + u[i].toString(16); return s; }
  function view(b) {
    if (b instanceof Uint8Array) return b;
    if (b instanceof ArrayBuffer) return new Uint8Array(b);
    if (ArrayBuffer.isView(b)) return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    return null;
  }
  function digest(u8) {
    if (window.cwsDigest) return window.cwsDigest('SHA-256', u8);
    if (window.crypto && crypto.subtle) return crypto.subtle.digest('SHA-256', u8);
    if (window.cwsSha) return Promise.resolve(window.cwsSha.sha256(u8).buffer);
    return Promise.reject(new Error('no SHA-256 on this page'));
  }
  function unhex(h) {
    if (typeof h !== 'string' || h.length % 2 || /[^0-9a-f]/i.test(h)) return null;
    const u = new Uint8Array(h.length / 2);
    for (let i = 0; i < u.length; i++) u[i] = parseInt(h.substr(i * 2, 2), 16);
    return u;
  }
  const isInt = n => Number.isInteger(n) && n >= 0;

  /** The patch applied to a copy of the bytes: the clean file's size, stretches copied from the bad
      file, padding, then the changed bytes. Null when the patch is malformed or does not fit. */
  function apply(bytes, p) {
    const src = view(bytes);
    if (!src || !p || !isInt(p.size) || p.size > 64 * 1024 * 1024) return null;
    const out = new Uint8Array(p.size);
    for (const s of p.src || []) {
      if (!Array.isArray(s) || !isInt(s[0]) || !isInt(s[1]) || !isInt(s[2]) || s[1] + s[2] > src.length || s[0] + s[2] > p.size) return null;
      out.set(src.subarray(s[1], s[1] + s[2]), s[0]);
    }
    for (const f of p.fill || []) {
      if (!Array.isArray(f) || !isInt(f[0]) || !isInt(f[1]) || !isInt(f[2]) || f[2] > 255 || f[0] + f[1] > p.size) return null;
      out.fill(f[2], f[0], f[0] + f[1]);
    }
    for (const d of p.data || []) {
      const u = Array.isArray(d) && isInt(d[0]) ? unhex(d[1]) : null;
      if (!u || d[0] + u.length > p.size) return null;
      out.set(u, d[0]);
    }
    return out;
  }

  let index = null;
  const shards = {};
  function loadIndex() {
    if (!index) index = fetch(BASE + 'index.json', { cache: 'no-cache' })
      .then(r => { if (!r.ok) throw new Error('index.json HTTP ' + r.status); return r.json(); })
      .catch(e => { index = null; throw e; });
    return index;
  }
  function shardFor(sys, sha) {
    return loadIndex().then(ix => {
      const s = ix && ix.systems && ix.systems[sys];
      if (!s) throw new Error('no repairs for ' + sys);
      const f = s.shards > 1 ? sys + '-' + sha[0] + '.json' : sys + '.json';
      if (!shards[f]) shards[f] = fetch(BASE + f + '?v=' + String(ix.version || '').slice(0, 16), { cache: 'no-cache' })
        .then(r => { if (!r.ok) throw new Error(f + ' HTTP ' + r.status); return r.json(); })
        .catch(e => { delete shards[f]; throw e; });
      return shards[f];
    });
  }
  function refusal(sha, title) {
    return { refused: { list: 'repairs', sha256: sha, kind: 'cartridge', code: 'BAD_COPY', reason: REASON, title: title || '' } };
  }

  /** Repair a known bad copy; every other file comes back { repaired: false } untouched. */
  async function repair(bytes, opts) {
    const u8 = view(bytes);
    const t = table();
    if (!u8 || !t || !t.size) return { repaired: false };
    let sha;
    try { sha = hex(await digest(u8)); } catch (e) { console.warn('[repairs] could not hash a file; not checked:', e && e.message || e); return { repaired: false }; }
    const hit = t.get(sha.slice(0, 12));
    if (!hit) return { repaired: false, sha256: sha };
    let p;
    try { const doc = await shardFor(hit.sys, sha); p = doc && doc.patches && doc.patches[sha]; }
    catch (e) { console.warn('[repairs] the repair for a known bad copy could not be loaded:', e && e.message || e); return refusal(sha, opts && opts.title); }
    /* the same first 12 digits but another file: not the bad copy the patch was made from */
    if (!p) return { repaired: false, sha256: sha };
    const out = apply(u8, p);
    let got = null;
    try { got = out ? hex(await digest(out)) : null; } catch (e) { got = null; }
    if (!out || got !== String(p.to).toLowerCase() || got.slice(0, 12) !== hit.clean12) {
      console.warn('[repairs] a repair did not give its clean copy; the file is refused');
      return refusal(sha, opts && opts.title);
    }
    return { repaired: true, bytes: out, from: sha, to: got };
  }

  window.CWSRepair = { REASON, clean12, cleanId, repair, apply, get loaded() { return !!table(); } };
})();

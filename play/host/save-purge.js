/*
 * play/host/save-purge.js -- the ONE-TIME deletion of every save made before the common save format.
 *
 * Decided 2026-10-18: earlier saves were test data only and may all be deleted. From the envelope version on (play/host/save-envelope.mjs), a save without the
 * envelope is not read anywhere; this deletes them once per browser (per site address, as browser
 * storage is), and a flag in localStorage ('cw.saves.purge') makes sure it never runs again.
 *
 * DELETED, and only these (a save-state, a slot, a quick save, a Continue-row state and its rewind
 * history, a battery save, a battery journal, made before the envelope):
 *   IndexedDB cw-play            slots without an envelope; battery images without an envelope
 *   IndexedDB gnw-continue       Continue cards whose state is not an envelope (a card with no state
 *                                is a relaunch card, kept), and their rewind history
 *                                (gnw-continue-rewind, same key)
 *   IndexedDB gameboy            states:*, cram:*, rtc:*              (the retired Game Boy window)
 *   IndexedDB nes-play           sram:*, fds-save:*, fds-set-save:*, state:*, states:*
 *   IndexedDB pokemini           states:*, eeprom:*
 *   IndexedDB twin-saves         every record (the colour units' slots)
 *   IndexedDB atari-saves        every record (the Atari slots)
 *   localStorage                 gnw.saves.*, tetrisjr.saves.*, atarilynx:eeprom:*, gb.cram-journal:*,
 *                                gb.rtc-journal:*, nes-sram-journal:*, pm.eeprom-journal:*, and
 *                                cw.battery-journal:* that are not an envelope
 * KEPT (never touched): boot programs cached in those databases (bios*, biosFrom, bios:fds), the
 * cw-play firmware store, cached cartridges, settings, controller layouts, the play-time store, the
 * vault code, manual and theme preferences, everything else.
 *
 * Nothing is opened that does not exist (an upgrade would create it: aborted). The result is kept in
 * window.__cwSavePurge (counts only, never contents). Users' files stay in their browser.
 */
(function () {
  'use strict';
  var FLAG = 'cw.saves.purge', VERSION = 'envelope-1';
  if (window.__cwSavePurge) return;
  var done = null;
  try { done = localStorage.getItem(FLAG); } catch (e) { return; }
  if (done === VERSION) { window.__cwSavePurge = { ran: false, already: true }; return; }
  var out = window.__cwSavePurge = { ran: true, at: Date.now(), deleted: {}, kept: {}, errors: [] };
  var isEnv = function (v) {
    try {
      if (v == null || typeof v !== 'object') return false;
      var u = v instanceof Uint8Array ? v : ArrayBuffer.isView(v) ? new Uint8Array(v.buffer, v.byteOffset, v.byteLength) : (v instanceof ArrayBuffer ? new Uint8Array(v) : null);
      return !!u && u.length >= 16 && u[0] === 0x43 && u[1] === 0x57 && u[2] === 0x53 && u[3] === 0x56;
    } catch (e) { return false; }
  };
  var count = function (k, n) { out.deleted[k] = (out.deleted[k] || 0) + (n || 1); };

  /* Open a database only if it exists. */
  function openIf(name) {
    return new Promise(function (res) {
      var created = false, r;
      try { r = indexedDB.open(name); } catch (e) { res(null); return; }
      r.onupgradeneeded = function () { created = true; try { r.transaction.abort(); } catch (e) {} };
      r.onsuccess = function () { if (created) { try { r.result.close(); } catch (e) {} res(null); } else res(r.result); };
      r.onerror = function () { res(null); };
      r.onblocked = function () { res(null); };
    });
  }
  /* Walk a store; decide(key, value) -> 'delete' | { put: value } | null. */
  function sweep(db, store, decide, label) {
    return new Promise(function (res) {
      if (!db || !db.objectStoreNames.contains(store)) { res(); return; }
      var t; try { t = db.transaction(store, 'readwrite'); } catch (e) { res(); return; }
      var q = t.objectStore(store).openCursor();
      q.onsuccess = function () {
        var c = q.result; if (!c) return;
        var d = null; try { d = decide(String(c.key), c.value); } catch (e) { d = null; }
        if (d === 'delete') { c.delete(); count(label); }
        else if (d && d.put !== undefined) { c.update(d.put); count(label, d.n || 1); }
        c.continue();
      };
      t.oncomplete = function () { res(); };
      t.onerror = t.onabort = function () { out.errors.push(label + ': ' + (t.error && t.error.name)); res(); };
    });
  }
  var prefix = function (re) { return function (k) { return re.test(k) ? 'delete' : null; }; };

  async function run() {
    // cw-play: the one store of the play window.
    var cw = await openIf('cw-play');
    await sweep(cw, 'slots', function (k, v) {
      if (!Array.isArray(v)) return 'delete';
      var n = 0, arr = v.map(function (r) { if (r && !r.removed && !(r.env && isEnv(r.state))) { n++; return null; } return r; });
      if (!n) return null;
      return arr.some(function (r) { return r; }) ? { put: arr, n: n } : 'delete';
    }, 'cw-play slots');
    await sweep(cw, 'battery', function (k, v) { return isEnv(v) ? null : 'delete'; }, 'cw-play battery');
    if (cw) cw.close();
    // The Continue row: cards whose state is not an envelope, and their rewind history.
    var gone = {};
    var cr = await openIf('gnw-continue');
    await sweep(cr, 'games', function (k, v) { if (v && v.state != null && !isEnv(v.state)) { gone[k] = 1; return 'delete'; } return null; }, 'Continue cards');
    if (cr) cr.close();
    var rw = await openIf('gnw-continue-rewind');
    await sweep(rw, 'rewind', function (k) { return gone[k] ? 'delete' : null; }, 'Continue rewind histories');
    if (rw) rw.close();
    // The retired windows' own stores: their saves only; their cached boot programs stay.
    var stores = [
      ['gameboy', 'blobs', /^(states:|cram:|rtc:)/],
      ['nes-play', 'carts', /^(sram:|fds-save:|fds-set-save:|states?:)/],
      ['pokemini', 'blobs', /^(states:|eeprom:)/],
      ['twin-saves', 'saves', /[\s\S]/],
      ['atari-saves', 'slots', /[\s\S]/],
    ];
    for (var i = 0; i < stores.length; i++) {
      var s = stores[i], d = await openIf(s[0]);
      await sweep(d, s[1], prefix(s[2]), s[0]);
      if (d) d.close();
    }
    // localStorage: the retired windows' slots and battery copies, and journals without an envelope.
    var LS = /^(gnw\.saves\.|tetrisjr\.saves\.|atarilynx:eeprom:|gb\.cram-journal:|gb\.rtc-journal:|nes-sram-journal:|pm\.eeprom-journal:)/;
    var keys = []; try { for (var j = 0; j < localStorage.length; j++) keys.push(localStorage.key(j)); } catch (e) {}
    keys.forEach(function (k) {
      if (!k) return;
      var del = LS.test(k);
      if (!del && /^cw\.battery-journal:/.test(k)) { var v = ''; try { v = localStorage.getItem(k) || ''; } catch (e) {} del = v.slice(0, 5) !== 'Q1dTV'; }   // 'CWSV' in base64
      if (del) { try { localStorage.removeItem(k); count('localStorage'); } catch (e) {} }
    });
    try { localStorage.setItem(FLAG, VERSION); } catch (e) {}
    out.finished = Date.now();
    try { console.info('[saves] saves made before the common save format deleted once:', JSON.stringify(out.deleted)); } catch (e) {}
  }
  out.done = run().catch(function (e) { out.errors.push(String(e && e.message || e)); });
})();

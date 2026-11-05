/* play/gnw/gwc-saves.js — one-time discard of old-engine save slots (G2b).
 *
 * 2026-10-03: saves may all be deleted if need be; they are only for
 * testing. Save slots written by gnw.js's own engine cannot be loaded by
 * the clean-room core (play/gnw/gwc-core.js) on SM5A/SM511/SM512, so on a
 * title's FIRST construction on the clean core its old slots are removed,
 * once, and a marker is written so it never repeats.
 *
 *   slots:  localStorage['gnw.saves.<gameKey>']   (gnw-host.js _saveKeyFor)
 *   marker: localStorage['gnw.gwc.savesDiscarded.<gameKey>'] = ISO time
 *
 * Rewind needs nothing here: RewindBuffer is in-memory only and is built
 * fresh for each GnwEmulator from its own (clean) CPU.
 *
 * Must load AFTER gwc-core.js and BEFORE gnw-host.js. Without gwc-core.js it does
 * nothing. 
 */
(function () {
  'use strict';
  var core = window.GWC_CORE;
  if (!core || typeof core.cpuFor !== 'function' || core._savesDiscardWrapped) return;
  var MARK = 'gnw.gwc.savesDiscarded.';
  var inner = core.cpuFor;
  core.discarded = [];
  function discardOnce(key) {
    try {
      if (localStorage.getItem(MARK + key)) return;
      var had = localStorage.getItem('gnw.saves.' + key) !== null;
      localStorage.removeItem('gnw.saves.' + key);
      localStorage.setItem(MARK + key, new Date().toISOString());
      core.discarded.push(key);
      if (had) console.info('[gwc] ' + key + ': old-engine save slots discarded (first load on the clean core)');
    } catch (e) { /* storage blocked: nothing to discard */ }
  }
  core.cpuFor = function (gameKey, game, decodeProgram) {
    var cpu = inner.apply(this, arguments);
    if (cpu) discardOnce(gameKey);
    return cpu;
  };
  Object.defineProperty(core, '_savesDiscardWrapped', { value: true });
})();

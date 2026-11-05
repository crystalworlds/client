/*
 * source-switch.js -- a data source switched off, kept set up (2026-10-28).
 *
 * The request (28 Oct): "Allow me, with a switch at the top right corner of the buttons, to turn data
 * sources on and off. The advantage is that I don't need to log out or disconnect a source I want
 * but don't want right now."
 *
 * One small record per browser, localStorage 'gnw.sources.off' = { <source id>: 1 } for each source
 * switched OFF (a source not named is on, so nothing changes for anyone who never touched it).
 * Source ids are settings-sources.js's tile ids: 'emby', 'jellyfin' (the media server of that kind),
 * 'cws' (the game servers) and 'pack' (the content pack).
 *
 * Switched off, a source is read as not set up by the files that use it: emby.js (its session
 * reads as signed out), cws.js (no server is asked, its titles are left out) and content_pack.js
 * (the pack reads as closed). Its sign-in, addresses, vault code, pairing and the pack itself are
 * all KEPT, so switching it on again needs nothing more. A change is announced as the window
 * event 'cw:source-switch' { id, on }.
 *
 * Loaded before content_pack.js, cws.js and emby.js, which read it as they start.
 */
(function () {
  'use strict';
  if (window.CwSources) return;
  const KEY = 'gnw.sources.off';
  function read() {
    try { const o = JSON.parse(localStorage.getItem(KEY) || '{}'); return o && typeof o === 'object' ? o : {}; }
    catch (_) { return {}; }
  }
  function on(id) { return !read()[id]; }
  /* quiet: store only (a sign-in or a pack opened while its source was off switches it on as it
     sets it up, and draws the page itself). */
  /* ONE MEDIA SERVER AT A TIME (31 Oct: "I should be signed in to both but only have one enabled at a
     time"). Switching Emby or Jellyfin on switches the other kind off in the same record; it stays
     signed in (emby.js keeps both sign-ins and uses the one switched on). */
  const MEDIA_OTHER = { emby: 'jellyfin', jellyfin: 'emby' };
  function set(id, want, quiet) {
    const o = read();
    const other = want && MEDIA_OTHER[id] && !o[MEDIA_OTHER[id]] ? MEDIA_OTHER[id] : null;
    if (!!want === !o[id] && !other) return;
    if (other) o[other] = 1;
    if (want) delete o[id]; else o[id] = 1;
    try { if (Object.keys(o).length) localStorage.setItem(KEY, JSON.stringify(o)); else localStorage.removeItem(KEY); } catch (_) {}
    if (quiet) return;
    try { window.dispatchEvent(new CustomEvent('cw:source-switch', { detail: { id, on: !!want } })); } catch (_) {}
  }
  window.CwSources = { KEY, on, set, off: () => Object.keys(read()) };
})();

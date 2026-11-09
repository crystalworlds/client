/*
 * play/shared/host-bridge.js -- the site's half of the Control Bar (2026-10-07).
 *
 * The bar itself lives inside each play window (play/shared/control-bar.js), as
 * the old pills did (A1: it stays where it is). This file is the host page's
 * side of it, for the framed windows:
 *
 *   THE FLAG. CwUnifiedHost.wants(sys) is the one answer to "does this family
 *   run the Control Bar?": ?ui=unified / ?ui=legacy on the site's URL (kept for
 *   the tab in sessionStorage, so the site's own navigation does not lose it),
 *   else the families proven and switched on by default (DEFAULT_ON). The play
 *   page asks this same function, so the page and the header always agree.
 *
 *   A14, THE TITLE BAR. An overlay whose window runs the bar gets the class
 *   .cb-unified; its header then shows only the title and the x. The controls
 *   the header used to hold (the Game Boy's Mono Palette / Matrix / Color palette, the
 *   variant picker) are hidden here and live in the bar and its Settings panel.
 *
 *   THE RELAY, over postMessage { cwUi: ... } from the window's own frame only:
 *     hello        the window runs the bar: answer with the TV state and the variants
 *     lastClosed   the Continue row's save of this title (A11's "Last closed" tile)
 *     variant      switch to another variant (variants.js switchTo)
 *     fullscreen   A13: the overlay fills the screen (the frame shows only the game)
 *     cheated      a cheat was switched on: this session stops counting play time
 *     keybind      open Settings -> Keyboard & controllers on this console; `via`
 *                  ("key" or "pointer", 2026-10-11) says how it was asked for
 *
 *   IN-PAGE WINDOWS (2026-10-11). Pokemon mini plays in the site's own document,
 *   not in a frame, so its bar cannot postMessage to a parent. local(ovId, recv)
 *   hands it the same relay as a function: what the bar posts is handled exactly as
 *   a frame's message would be, and what this side sends goes to recv().
 *
 *   THE ONE PLAY HOST (2026-10-14; the only play window since 2026-10-15, the build plan).
 *   Every console with a core module plays in play/host/; the old per-console pages are retired.
 *   The launch handlers still name the old page paths (they are never fetched): a wrapper round
 *   the site's _playFrameGo turns each into the host's URL, in one place.
 *
 * SOUND: none of its own. While the host is switched on, it loads play/host/cw-audio.js
 * into the site and arms it: the press that launches a game wakes the one AudioContext
 * inside that press, and the host frame borrows it (the build plan, section 3).
 * Tiles and drawers never get a sink, so they stay silent.
 */
(function () {
  'use strict';
  if (window.CwUnifiedHost) return;

  const BUILD = '20261026-cbh23-cht1';
  /* Families whose Control Bar is proven and on by default (the same set as
     control-bar.js's DEFAULT_ON; the host's answer is the one a framed page uses). */
  const DEFAULT_ON = new Set(['gb', 'pm', 'a2600', 'a5200', 'a7800', 'alynx']); // GB proven 2026-10-08 (232/232); PM 2026-10-11 (pm-cb run.mjs); the Ataris 2026-10-11 (pm-cb arun.mjs)
  /* Overlay -> the family names a window in it can register as. */
  const OVERLAY_SYS = { 'gb-play-overlay': ['gb'], 'pm-play-overlay': ['pm'], 'atari-play-overlay': ['a2600', 'a5200', 'a7800', 'alynx'],
    'nes-play-overlay': ['nes'],     // the NES window joins only when the one play host runs in it (wants('nes') is false otherwise)
    'play-overlay': ['gnw'],
    'tft-play-overlay': ['tft'], 'tj-play-overlay': ['tetrisjr'] };   // colour units, Tetris Jr.: likewise (2026-10-14)       // Game & Watch: likewise, only while the one play host runs in it (wants('gnw') follows wantsHost)
  const KEY = 'gnw.ui.flag';

  /* The ?ui= switch is gone (2026-10-15): there is one bar, the host's. */
  const flag = 'unified';
  try { sessionStorage.removeItem(KEY); } catch (_) {}

  /* ------------------------------------------------------------ the one play host (2026-10-14) */
  const HOST_READY = new Set(['gb', 'pm', 'nes', 'a2600', 'a5200', 'a7800', 'alynx', 'gnw', 'tetrisjr', 'tft']);   // tetrisjr, tft: Phase 5, play/cores/tetrisjr/ and play/cores/tft/   // gnw: Phase 5, play/cores/gnw/   // consoles with a core module in play/host (pm: 2026-10-14; nes: Phase 4; the four Ataris: Phase 3, play/cores/atari/)
  /* THE ONE PLAY HOST IS THE ONLY PLAY WINDOW (2026-10-15: "no two versions, no URL
     activation"). Every console with a core module plays in it; the switch (?host=, ?ui=host,
     sessionStorage cw.host.flag, HOST_PENDING, DEFAULT_HOST) is gone. */
  const DEFAULT_HOST = HOST_READY;             // kept as a name for callers that still read it
  const hostFlag = 'all';
  try { sessionStorage.removeItem('cw.host.flag'); } catch (_) {}
  function wantsHost(sys) { return HOST_READY.has(sys); }
  const hostAny = () => Array.from(HOST_READY).some(wantsHost);
  /* Old page path -> console id, for the frame redirect. */
  const HOST_PAGES = [[/^(?:\.\/|\/)?play\/gameboy\/index\.html/, 'gb'], [/^(?:\.\/|\/)?play\/nes\/index\.html/, 'nes'],
    [/^(?:\.\/|\/)?play\/atari2600\/index\.html/, 'a2600'], [/^(?:\.\/|\/)?play\/atari5200\/index\.html/, 'a5200'],
    [/^(?:\.\/|\/)?play\/atari7800\/index\.html/, 'a7800'], [/^(?:\.\/|\/)?play\/atarilynx\/index\.html/, 'alynx'],
    // The one built-in game, and the two colour units, whose unit is the game. A third entry
    // names the game; null keeps the old page (the player's custom firmware, ?fw=custom, keeps
    // its file panel there for now).
    [/^(?:\.\/|\/)?play\/tetrisjr\/index\.html/, 'tetrisjr', () => '#prototype-tetris-jr'],
    [/^(?:\.\/|\/)?play\/(mario|zelda)\/index\.html/, 'tft', (pm, q) => (/(^|[?&])fw=custom/.test(q || '') ? null : '#' + pm[1])]];
  function hostUrlFor(url) {
    const m = String(url).match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
    if (!m) return null;
    for (const [re, sys, gameOf] of HOST_PAGES) {
      const pm = m[1].match(re);
      if (!pm || !wantsHost(sys)) continue;
      let hash = m[3] || '';
      if (gameOf) { const h = gameOf(pm, m[2]); if (h === null) return null; hash = h; }
      const q = m[2] ? '&' + m[2].slice(1) : '';
      return 'play/host/index.html?sys=' + sys + q + hash;
    }
    return null;
  }
  /* ONE SHELL COLOUR PER GAME PER PAGE LOAD (2026-10-14): a variant is another
     cartridge in the SAME console, so the console a game's tile wears (its group's first
     member, the one on the shelf) is the console every variant of it plays in, all visit
     long. The colour itself is still the site's (GBC_SHELLS / pmConsoleKey); this only says
     whose. */
  function primaryOf(d) {
    try { const V = window.Variants, ms = V && V.members ? V.members(d) || [] : []; return ms.length ? ms[0] : d; } catch (_) { return d; }
  }
  function shellFor(sys, d) {
    if (!d) return null;
    const p = primaryOf(d) || d;
    try {
      if (sys === 'gb') return (typeof GBC_SHELLS !== 'undefined' && GBC_SHELLS.indexOf(p.img) >= 0) ? p.img : null;
      if (sys === 'pm') return typeof pmConsoleKey === 'function' ? pmConsoleKey(p) : null;
    } catch (_) {}
    return null;
  }
  /* The Game Boy's ?shell=&for= (old page and host alike): the group's shell, for this slot. */
  function fixShell(url) {
    const m = String(url).match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
    if (!m || !/play\/gameboy\/index\.html$/.test(m[1])) return url;
    const slot = decodeURIComponent((m[3] || '').replace(/^#/, ''));
    const d = slot ? deviceOf('gb-' + slot) : null;
    const k = shellFor('gb', d);
    const q = new URLSearchParams((m[2] || '').replace(/^\?/, ''));
    if (k) { q.set('shell', k); q.set('for', slot); } else { q.delete('shell'); q.delete('for'); }
    const qs = q.toString();
    return m[1] + (qs ? '?' + qs : '') + (m[3] || '');
  }
  /* EVERY HOST WINDOW IS ONE SIZE (2026-10-14: "the one UI for all"): the overlay
     that holds the play host gets .cw-host, and one rule sizes its window and frame, so the
     Control Bar lays out the same for every console. */
  /* THE ONE WINDOW RULE (2026-10-15): the host says how wide its device and its whole bar want
     the window; this caps it to the screen (96vw) and applies it. The same for every console. */
  addEventListener('message', ev => {
    const d = ev.data; if (!d || !d.cwHostSize) return;
    const f = Array.from(document.querySelectorAll('iframe.cw-host-frame')).find(x => x.contentWindow === ev.source);
    const m = f && f.closest('.modal'); if (!m) return;
    // The frame is what must be that wide: the window adds its own sides (padding, border).
    const sides = Math.max(0, m.getBoundingClientRect().width - f.getBoundingClientRect().width);
    m.__cwWant = (+d.cwHostSize.width || 980) + sides + 4;
    fitWindow(m);
  });
  /* Re-fitted on every resize and rotation (it used to be set once at open, so a rotated phone kept
     the old window). On a phone (body.play-lock, index.html) the window fills the screen: no cap. */
  /* Full screen takes no cap either (2026-10-17: full screen on a large PC screen sat on the
     left). The cap is an inline !important, which beat the full-screen rule's max-width:none, so the
     fixed full-screen window kept the windowed width from the left edge. */
  function fitWindow(m) {
    if (!m.__cwWant) return;
    const ov = m.closest('.overlay');
    if (document.body.classList.contains('play-lock') || (ov && ov.classList.contains('cb-full'))) { m.style.removeProperty('max-width'); return; }
    m.style.setProperty('max-width', Math.round(Math.min(m.__cwWant, innerWidth * 0.96)) + 'px', 'important');
  }
  const refit = () => setTimeout(() => document.querySelectorAll('.overlay.cw-host .modal').forEach(fitWindow), 150);
  addEventListener('resize', refit);
  addEventListener('orientationchange', refit);
  function markHost(fr, on) {
    const ov = fr && fr.closest ? fr.closest('.overlay') : null;
    if (ov) ov.classList.toggle('cw-host', !!on);
    if (fr) fr.classList.toggle('cw-host-frame', !!on);
  }
  function wrapFrameGo() {
    const orig = window._playFrameGo;
    if (typeof orig !== 'function' || orig.__cwHost) return;
    const w = function (fr, url) {
      url = fixShell(url);
      const to = hostUrlFor(url);
      markHost(fr, !!to);
      if (to) {
        // The launching press already woke the sound (armSound); keep it awake for the frame.
        try { if (window.CwPlayAudio) window.CwPlayAudio.reserve(30000); } catch (_) {}
        return orig.call(this, fr, to);
      }
      return orig.call(this, fr, url);
    };
    w.__cwHost = true; w.__orig = orig;
    window._playFrameGo = w;
  }
  function armSound() {
    if (!hostAny()) return;
    const arm = () => { try { window.CwPlayAudio.armGestures(() => hostAny()); } catch (_) {} };
    if (window.CwPlayAudio) { arm(); return; }
    const sc = document.createElement('script');
    sc.src = 'play/host/cw-audio.js?v=2.1.1';
    sc.onload = arm;
    (document.head || document.documentElement).appendChild(sc);
  }
  armSound();
  /* CONSOLES WHOSE OLD WINDOW PLAYS IN THIS PAGE (the Pokemon mini). In the host they play
     in the same host page as every other console, in a frame inside their overlay, opened
     here: the site's launcher is wrapped by name and nothing in index.html is edited. Moved
     from play/cores/pm/site.js on 2026-10-14 (a console's module holds its core, its art and
     its overlay only; the site's side of the host is this file, for every console). */
  const INPAGE = {
    pm: { overlay: 'pm-play-overlay', modal: 'pm-play-modal', frame: 'pm-host-frame', open: 'openPmPlay', launch: '_pmLaunchCart', teardown: '_pmTeardownActive',
          current: () => { try { return typeof _pmCurGame !== 'undefined' ? _pmCurGame : null; } catch (_) { return null; } } },
  };
  /* Game & Watch (Phase 5): its old window also plays in this page (gnw-host.js openPlayModal).
     It has no separate launch function to wrap (the boot is inside its closure), so the
     opener itself is wrapped (wrapGnw below): the window opens with its title and no in-page
     boot, and the host frame goes in its modal. */
  INPAGE.gnw = { overlay: 'play-overlay', modalSel: '#play-overlay .modal', frame: 'gnw-host-frame', direct: true };
  /* The frame keeps the id continuerow.js and keys.js already look for ('pm-host-frame'). */
  function inpageFrame(sys) { for (const k of (sys ? [sys] : Object.keys(INPAGE))) { const f = document.getElementById(INPAGE[k].frame); if (f) return f; } return null; }
  function dropInpage(sys) {
    const f = inpageFrame(sys); if (!f) return;
    const ov = f.closest('.overlay'); if (ov) ov.classList.remove('cw-host');
    try { f.remove(); } catch (_) {}   // discarding the element discards the document, its loop and its borrowed sound
  }
  function openInpage(sys, d, cont) {
    const I = INPAGE[sys], modal = I.modalSel ? document.querySelector(I.modalSel) : document.getElementById(I.modal);
    if (!modal) return false;
    dropInpage(sys);
    const f = document.createElement('iframe');
    f.id = I.frame; f.title = d.name || 'Play'; f.setAttribute('allow', 'autoplay; fullscreen; gamepad');
    modal.appendChild(f);
    markHost(f, true);
    const k = shellFor(sys, d);
    let q = '?sys=' + sys + (k ? '&shell=' + encodeURIComponent(k) + '&for=' + encodeURIComponent(d.id) : '') + (cont ? '&cont=1' : '');
    try { f.contentWindow.location.replace('play/host/index.html' + q + '#' + encodeURIComponent(d.id)); } catch (_) { f.src = 'play/host/index.html' + q + '#' + encodeURIComponent(d.id); }
    try { if (typeof window._playLockSync === 'function') window._playLockSync(); } catch (_) {}
    return true;
  }
  const pendingCont = {};
  function wrapName(name, make) {
    const orig = window[name];
    if (typeof orig !== 'function' || orig.__cwHost) return;
    const w = make(orig); w.__cwHost = true; w.__orig = orig; window[name] = w;
  }
  function wrapGnw() {
    wrapName('openPlayModal', orig => function (gameKey, opts) {
      if (!wantsHost('gnw')) return orig.apply(this, arguments);
      try { if (window.CwPlayAudio) window.CwPlayAudio.reserve(30000); } catch (_) {}   // inside the launching press
      let id = null;
      try { id = typeof deviceIdForGameKey === 'function' ? deviceIdForGameKey(gameKey) : null; } catch (_) { id = null; }
      if (!id) return orig.apply(this, arguments);
      let cont = false;
      try { cont = !!(window.ContinueRow && ContinueRow.pendingRelaunch && ContinueRow.pendingRelaunch(id)); } catch (_) { cont = false; }
      // The site's window, its title and its zoom-in, with no in-page boot (its own prompt is hidden below).
      const r = orig.call(this, gameKey, Object.assign({}, opts || {}, { autoBoot: false }));
      const pr = document.getElementById('play-start-prompt'); if (pr) pr.style.display = 'none';
      let d = deviceOf(id) || { id, name: gameKey };
      /* Another program revision picked in the drawer (8 Nov 2026, index.html openPlay): the frame's
         game is '<device>~<variant>', so the relay sends that program and its saves are its own. */
      const v = opts && opts.variant ? String(opts.variant).replace(/[^a-z0-9-]/gi, '') : '';
      if (v) d = Object.assign({}, d, { id: id + '~' + v });
      openInpage('gnw', d, cont);
      return r;
    });
    wrapName('closePlayModal', orig => function () { const r = orig.apply(this, arguments); dropInpage('gnw'); return r; });
  }
  function wrapInpage() {
    wrapGnw();
    for (const sys of Object.keys(INPAGE)) {
      const I = INPAGE[sys];
      if (I.direct) continue;
      wrapName(I.open, orig => function (deviceId) {
        if (wantsHost(sys)) {
          try { if (window.CwPlayAudio) window.CwPlayAudio.reserve(30000); } catch (_) {}   // inside the launching press
          try { pendingCont[sys] = window.ContinueRow && ContinueRow.pendingRelaunch && ContinueRow.pendingRelaunch(deviceId) ? deviceId : null; } catch (_) { pendingCont[sys] = null; }
        }
        return orig.apply(this, arguments);
      });
      wrapName(I.launch, orig => function () {
        const d = wantsHost(sys) ? I.current() : null;
        if (!d) return orig.apply(this, arguments);
        try { const t = window[I.teardown]; if (typeof t === 'function') (t.__orig || t)(); } catch (_) {}
        const cont = pendingCont[sys] === d.id; pendingCont[sys] = null;
        openInpage(sys, d, cont);
      });
      wrapName(I.teardown, orig => function () { const r = orig.apply(this, arguments); dropInpage(); return r; });
    }
  }
  /* What continuerow.js and keys.js ask (written against the retired play/cores/pm/site.js):
     is the Pokemon mini on the host, and which frame is it in. */
  window.CwPmHostSite = { BUILD, active: () => wantsHost('pm'), get frame() { return document.getElementById(INPAGE.pm.frame); } };
  /* The host frame asks for the title of what it plays (the catalogue is this page's). */
  function deviceInfo(id) {
    const d = deviceOf(id);
    return d ? { id: d.id, name: d.name, released: d.released || null, system: d.system || null, img: d.img || null } : null;
  }

  /* Families with no legacy window at all: always the bar, whatever the flag (the 5200 page was
     built on the Control Bar, 2026-10-11). */
  const ALWAYS_ON = new Set(['a5200']);
  /* Every play window is the host, and the host's frame runs the one bar (2026-10-15). */
  function wants(sys) { return true; }

  /* ------------------------------------------------------------ styles */
  const CSS = `
  .overlay.cb-unified .modal-head > :last-child > :not(.modal-close),
  .overlay.cb-unified .modal-head > .vr-pick-wrap,
  .overlay.cb-unified .modal-head .pm-title-row > :not(.modal-title) { display:none !important; }
  .overlay.cb-unified.cb-full { padding:0 !important; }
  /* Every play host window: one size, whatever console (the Game Boy's window, the site's
     standard .modal). The old in-page window's own body is hidden while the host plays. */
  /* ONE WINDOW for every console (2026-10-15): wide enough for the whole bar where the screen
     allows; the device art is fitted inside, never sizing the window. */
  /* body:not(.play-lock): on a phone the site's small-screen play lock makes the window fill the
     screen, and these desktop sizes must not override it (they did: bug, 2026-10-15). */
  body:not(.play-lock) .overlay.cw-host:not(.cb-full) .modal { width:100% !important; max-width:980px; }
  body:not(.play-lock) .overlay.cw-host:not(.cb-full) iframe.cw-host-frame { width:100% !important; height:min(90vh,700px) !important; }
  .overlay.cw-host:not(.cb-full) iframe.cw-host-frame { width:100% !important; border:0; display:block; background:#0b0c0e; }
  /* On a phone the window is the whole screen in both orientations: no console's old window cap
     (the Game & Watch window's 900px) may hold it narrower (2026-10-15). */
  body.play-lock .overlay.cw-host.open .modal { width:100% !important; max-width:100% !important; }
  .overlay.cw-host #pm-play-body, .overlay.cw-host #pm-keys-panel { display:none !important; }
  .overlay.cw-host #play-modal-emu-home, .overlay.cw-host #play-zoom-toggle { display:none !important; }
  .overlay.cb-unified.cb-full .modal { position:fixed !important; inset:0 !important; width:100vw !important; max-width:none !important;
    height:100vh !important; max-height:none !important; margin:0 !important; border-radius:0 !important; border:0 !important;
    transform:none !important; animation:none !important; display:flex; flex-direction:column; }
  .overlay.cb-unified.cb-full .modal-head { display:none !important; }
  .overlay.cb-unified.cb-full .modal > iframe { flex:1 1 auto; height:100vh !important; }
  `;
  function ensureCss() {
    if (document.getElementById('cbh-css')) return;
    const st = document.createElement('style'); st.id = 'cbh-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------ overlays */
  const tvOn = () => !!(document.body && document.body.classList.contains('gnw-tv'));
  function overlayOfFrame(win) {
    for (const id of Object.keys(OVERLAY_SYS)) {
      const ov = document.getElementById(id);
      const f = ov && ov.querySelector('iframe');
      if (f && f.contentWindow === win) return ov;
    }
    return null;
  }
  function frameOf(ov) { return ov ? ov.querySelector('iframe') : null; }
  function playingId() { try { return typeof _openPlayDeviceId !== 'undefined' ? _openPlayDeviceId : null; } catch (_) { return null; } }
  function deviceOf(id) {
    try {
      if (typeof ALL_DEVICES === 'undefined') return null;
      const d = ALL_DEVICES.find(x => x.id === id);
      /* '<device>~<variant>': a Game & Watch device's other program revision is that device (8 Nov 2026). */
      if (d || typeof id !== 'string' || id.indexOf('~') <= 0) return d || null;
      return ALL_DEVICES.find(x => x.id === id.slice(0, id.indexOf('~'))) || null;
    } catch (_) { return null; }
  }

  /* Marked as soon as it opens (not when the frame says hello), so the header
     never flashes the controls it is about to lose. */
  /* Every class change is guarded: classList.add/remove rewrite the attribute
     even when nothing changes, and that would re-fire this very observer. */
  /* The families a window in this overlay can be right now: the Atari overlay holds four
     machines, so it is the playing title's own (a 2600 under ?ui=legacy must not take the
     5200's always-on bar). */
  const CAT_SYS = { atari2600: 'a2600', atari5200: 'a5200', atari7800: 'a7800', atarilynx: 'alynx' };
  function sysListOf(ov) {
    const all = OVERLAY_SYS[ov.id] || [];
    if (all.length < 2) return all;
    const d = deviceOf(playingId()), s = d && CAT_SYS[d.catalogue];
    return s ? [s] : all;
  }
  function onOverlayClass(ov) {
    const sysList = sysListOf(ov);
    if (ov.classList.contains('open')) {
      if (!ov.classList.contains('cb-unified') && sysList.some(wants)) ov.classList.add('cb-unified');
    } else {
      if (ov.classList.contains('cb-full')) leaveFull(ov, false);
      if (ov.classList.contains('cb-unified')) ov.classList.remove('cb-unified');
      delete ov.dataset.cheated;          // a new session starts uncheated
    }
  }

  function variantsFor(ov) {
    const V = window.Variants, id = playingId(), d = id && deviceOf(id);
    if (!V || !d) return [];
    let ms = [];
    try { ms = V.members(d) || []; } catch (_) { ms = []; }
    if (ms.length < 2) return [];
    /* In menu order (variants.js split): releases, then translations, hacks and
       other copies, each with its bad dumps last. `cls` says which list an entry
       belongs to: r release (top level), t / h / o the submenus (2026-10-13). */
    const def = ms[0].id;
    let order = ms, cls = () => 'r';
    if (V.split && V.classOf) { const p = V.split(ms); order = p.r.concat(p.t, p.h, p.o); cls = x => V.classOf(x).c; }
    return order.map(x => ({ id: x.id, label: (V.labelOf && V.labelOf(x)) || x.fullName || x.name, current: x.id === id, default: x.id === def, cls: cls(x) }));
  }
  function send(ov, msg) {
    if (ov && ov.__cbRecv) { const r = ov.__cbRecv; setTimeout(() => { try { r(msg); } catch (e) { console.warn('[control bar] in-page relay failed', e); } }, 0); return; }
    const f = frameOf(ov); try { if (f && f.contentWindow) f.contentWindow.postMessage(msg, '*'); } catch (_) {}
  }
  function publish(ov) {
    if (!ov || !ov.classList.contains('cb-unified')) return;
    send(ov, { cwUi: 'host', tv: tvOn(), build: BUILD });
    send(ov, { cwUi: 'variants', list: variantsFor(ov) });
  }

  /* ------------------------------------------------------------ full screen (A13) */
  const fitOf = ov => { const m = ov && ov.querySelector('.modal'); if (m) fitWindow(m); };
  function enterFull(ov) {
    ov.classList.add('cb-full');
    fitOf(ov);
    try { if (!document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); } catch (_) {}
  }
  function leaveFull(ov, tell) {
    ov.classList.remove('cb-full');
    fitOf(ov);
    try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); } catch (_) {}
    if (tell) send(ov, { cwUi: 'fullscreen', on: false });
  }
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) return;
    for (const id of Object.keys(OVERLAY_SYS)) {
      const ov = document.getElementById(id);
      if (ov && ov.classList.contains('cb-full')) leaveFull(ov, true);
    }
  });

  /* ------------------------------------------------------------ Last closed (A11) */
  /* The title in a window: the Game & Watch window keeps its game key (_openPlayKey), not
     _openPlayDeviceId, as continuerow.js currentDeviceId reads it (8 Nov 2026: its auto save was never found). */
  function titleIn(ov) {
    try { if (ov && ov.id === 'play-overlay' && typeof _openPlayKey !== 'undefined' && _openPlayKey && typeof deviceIdForGameKey === 'function') return deviceIdForGameKey(_openPlayKey) || playingId(); } catch (_) {}
    return playingId();
  }
  async function lastClosed(ov) {
    const CR = window.ContinueRow, id = titleIn(ov);
    if (!CR || !id) return null;
    let rec = null;
    try { rec = (await CR.list()).find(r => r && r.id === id && !r.hidden && r.state != null) || null; } catch (_) { rec = null; }
    if (!rec) return null;
    let rewind = null;
    try { const packed = await CR.rewindOf(id); rewind = packed ? await CR.unpackRewind(packed) : null; } catch (_) { rewind = null; }
    return Object.assign({}, rec, { rewind });
  }

  /* ------------------------------------------------------------ the relay */
  window.addEventListener('message', ev => {
    const d = ev.data;
    if (!d || typeof d.cwUi !== 'string') return;
    const ov = overlayOfFrame(ev.source);
    if (!ov || !ov.classList.contains('open')) return;
    handle(ov, d);
  });
  function handle(ov, d) {
    switch (d.cwUi) {
      case 'hello':
        if (!ov.classList.contains('cb-unified')) ov.classList.add('cb-unified');
        ov.dataset.cbSys = String(d.sys || '');
        publish(ov);
        break;
      case 'lastClosed':
        lastClosed(ov).then(rec => send(ov, { cwUi: 'lastClosed', n: d.n, rec })).catch(() => send(ov, { cwUi: 'lastClosed', n: d.n, rec: null }));
        break;
      case 'variant':
        if (window.Variants && typeof Variants.switchTo === 'function' && d.id) { try { Variants.switchTo(String(d.id)); } catch (e) { console.warn('[control bar] variant switch failed', e); } }
        break;
      case 'cheated':
        /* 2026-10-26: a cheat was switched on (or a save made with cheats loaded) in this
           window. Play time stops counting for it until the window closes (index.html playTimeCurrentId). */
        ov.dataset.cheated = '1';
        break;
      case 'fullscreen':
        if (d.on) enterFull(ov); else leaveFull(ov, false);
        break;
      case 'keybind':
        try {
          if (typeof openVaultModal === 'function') openVaultModal();
          if (typeof window.switchSettingsTab === 'function') window.switchSettingsTab('keys');
          const K = window.GnwKeybind;
          if (K) { if (d.sys) K.system(String(d.sys)); K.render(); }
          // The bar says how Settings was asked for (control-bar.js viaOf): a key, a remote or a
          // pad keeps the ring; a pointer drops it. A bar that does not say: the guess below.
          if (d.via !== 'key') quietRing(d.via === 'pointer');
        } catch (e) { console.warn('[control bar] could not open Keyboard & controllers', e); }
        break;
    }
  }
  /* NO KEYBOARD RING FOR A TAP (kbtoggle, 2026-10-11). The tap that asked for Settings
     happened in the play window's frame, so this document never saw a pointer, and the
     focus keys.js then moves into Settings drew the keyboard ring (a blue box on a phone).
     Off a TV and off a gamepad, take the ring off whatever lands in Settings in the next
     second; a TV, a remote or a pad keeps it. */
  function quietRing(known) {
    if (!known && (tvOn() || (document.body && document.body.classList.contains('gk-pad')))) return;
    const v = document.getElementById('vault-overlay');
    const until = performance.now() + 1000;
    const tick = () => {
      const a = document.activeElement;
      if (a && v && v.contains(a) && a.matches(':focus-visible')) {
        try { a.blur(); a.focus({ preventScroll: true, focusVisible: false }); } catch (_) {}
      }
      if (performance.now() < until && v && v.classList.contains('open')) setTimeout(tick, 50);
    };
    tick();
  }
  /* An in-page window's relay: recv gets what this side sends; the function returned
     takes what the bar posts. Only while its overlay is open, as for a frame. */
  function local(ovId, recv) {
    const ov = document.getElementById(ovId);
    if (!ov) return () => {};
    ov.__cbRecv = recv;
    return msg => { if (msg && typeof msg.cwUi === 'string' && ov.classList.contains('open')) handle(ov, msg); };
  }

  /* The pause menu's "Change variant" (variants.js) opens the bar's Variant menu. */
  function openVariant(ovId) {
    const ov = document.getElementById(ovId);
    if (!ov || !ov.classList.contains('cb-unified')) return false;
    send(ov, { cwUi: 'openVariant' });
    const f = frameOf(ov); try { if (f) f.focus(); } catch (_) {}
    return true;
  }
  /* The pause menu's "Control Bar" item: focus moves onto the bar inside the frame. */
  function focusBar(ovId) {
    const ov = document.getElementById(ovId);
    if (!ov || !ov.classList.contains('cb-unified')) return false;
    const f = frameOf(ov); try { if (f) f.focus(); } catch (_) {}
    send(ov, { cwUi: 'focusBar' });
    return true;
  }

  function wire() {
    ensureCss();
    wrapFrameGo();
    wrapInpage();
    for (const id of Object.keys(OVERLAY_SYS)) {
      const ov = document.getElementById(id);
      if (!ov) continue;
      new MutationObserver(() => onOverlayClass(ov)).observe(ov, { attributes: true, attributeFilter: ['class'] });
      onOverlayClass(ov);
    }
    // Variant tables land lazily, and TV mode can change: re-publish to an open window.
    const again = () => { for (const id of Object.keys(OVERLAY_SYS)) publish(document.getElementById(id)); };
    window.addEventListener('gnw-variants', again);
    /* A tap or click on the site around a framed window (its header, the backdrop)
       never reaches the frame: tell its bar, so an open menu closes, the version
       unchanged (2026-10-13). The frame's own taps are the bar's to judge. */
    document.addEventListener('pointerdown', () => {
      for (const id of Object.keys(OVERLAY_SYS)) {
        const ov = document.getElementById(id);
        if (ov && ov.classList.contains('open') && ov.classList.contains('cb-unified') && !ov.__cbRecv) send(ov, { cwUi: 'closeMenu' });
      }
    }, true);
    let tv = tvOn();
    if (document.body) new MutationObserver(() => { const t = tvOn(); if (t !== tv) { tv = t; again(); } }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire, { once: true }); else wire();

  window.CwUnifiedHost = { BUILD, DEFAULT_ON, OVERLAY_SYS, wants, wantsHost, HOST_READY, DEFAULT_HOST, get hostFlag() { return hostFlag; }, hostUrlFor, deviceInfo, fixShell, shellFor, get flag() { return flag; }, openVariant, focusBar, lastClosed, local, publish: id => publish(document.getElementById(id)) };
})();

/*
 * keys.js -- keyboard first, phase 1: "no dead ends" (2026-10-04).
 *
 * The design is docs/tv-controller-support.md (sections 5.5, 6 and 7, phase 1),
 * with the decisions of 2026-10-04 in its section 8. In one place:
 *
 *   ONE BACK. Escape, Backspace (outside a text field), GoBack / BrowserBack /
 *   XF86Back and the TV codes 4, 10009 (Tizen) and 461 (webOS) all take the
 *   same single step: close the TOP layer only, as history Back already did.
 *   A menu or panel inside a layer (subtitle menu, chapters, Up Next, the Games
 *   menu, a play window's Controls screen) still closes first: those handlers
 *   stop the key themselves, and only an unclaimed Back reaches this file.
 *
 *   BACK IN A GAME opens a small pause menu (Resume, Controls, Saved states,
 *   Quit). Only Quit closes the window, through the window's own close button
 *   -- the same close path as the x, so the Continue row's save on close still
 *   runs. Back again (Escape, a pad's B, a remote's Back, history Back) and a
 *   click or tap outside the card all RESUME (2026-10-14: Cancel or B
 *   closed the game window when it should return to the game; this replaces
 *   the 2026-10-04 "a second Back quits" rule). Framed games pass their Back up with postMessage
 *   ({ gnwBack: 1 }, play/play-keys.js); history Back (a remote, a phone) is
 *   routed here by index.html's popstate and applyHashRoute hooks.
 *
 *   FOCUS IN, FOCUS BACK. Every layer (drawers, Settings, lightbox, manual,
 *   trailer, episode info, the player, the pause menu) takes focus when it
 *   opens and gives it back to the element that opened it when it closes.
 *   Everything behind the top layer is `inert`, and Tab wraps inside it.
 *
 *   THE PLAY KEY. P, MediaPlayPause / MediaPlay and a remote's Play key play
 *   or resume straight from a focused tile, a Continue card or an open drawer.
 *   Enter/OK still opens the drawer (2026-10-04: Tile -> Details -> Play).
 *
 *   THE PLAYER. Media keys and the Media Session API (play, pause, seek,
 *   next/previous episode), and the letter keys: K / Space play-pause, J / L
 *   10 s, F full screen, M mute, C subtitles, V next subtitle track, , and .
 *   nudge subtitles 0.1 s, N / Shift+N next / previous episode.
 *
 *   SETTINGS -> DISPLAY -> TV mode: Auto / On / Off (index.html's GNW_TV reads
 *   the stored value at load; this file draws the control and applies a change
 *   live). Auto is unchanged detection.
 *
 * Mouse and touch: unchanged. Focus moved by this file follows the browser's
 * :focus-visible rule, so a mouse user sees no new rings.
 * Sound: none. This file never starts audio.
 *
 * Arrow-key navigation of the grid is phase 2 and is deliberately not here.
 *
 * KEYS P3 (2026-10-04): every key below is a named action in actions.js
 * (window.Actions): the Play key ('item.play'), the player's letter keys
 * ('player.*'), the media keys ('media.*'), and Back ('back', described there;
 * Back itself stays the ladder below, and a pad or a remote runs it as a
 * GoBack key). The handlers look the key up in the registry and run the action
 * through it, so ?, quick jump and phase 4/5 read the same table. Without
 * actions.js the same tables are matched here, unchanged.
 */
(function () {
  'use strict';
  if (window.GnwKeys) return;

  const BUILD = '20261017-keys15-b1-endmode';
  const PLAY_IDS = ['play-overlay', 'pm-play-overlay', 'gb-play-overlay', 'nes-play-overlay', 'atari-play-overlay', 'tft-play-overlay', 'tj-play-overlay'];
  const EMBY_CLOSE = { 'video-overlay': 'closeVideo', 'video-player-overlay': 'closePlayer', 'video-info-overlay': 'closeEpisodeInfo', 'video-trailer-overlay': 'closeTrailer' };
  const PAUSE_ID = 'gk-pause';

  /* ------------------------------------------------------------ keys */

  const BACK_NAMES = new Set(['Escape', 'GoBack', 'BrowserBack', 'Backspace']);
  const ODD_BACK_NAMES = new Set(['Esc', 'XF86Back']);
  const TV_BACK_CODES = new Set([4, 10009, 461]);

  function isField(t) {
    if (!t || t.nodeType !== 1) return false;
    if (t.isContentEditable) return true;
    const tag = t.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag !== 'INPUT') return false;
    return !/^(button|checkbox|radio|range|color|file|submit|reset|image)$/i.test(t.type || 'text');
  }
  function isBack(e) {
    if (!BACK_NAMES.has(e.key)) return false;
    if (e.key === 'Backspace' && (isField(e.target) || e.ctrlKey || e.altKey || e.metaKey)) return false;
    return true;
  }
  const mods = e => e.ctrlKey || e.altKey || e.metaKey;

  /* ONE PRESS OF ENTER, OK OR SPACE IS ONE ACTION (bug, 2026-10-14:
     holding Enter on a tile opened the drawer many times a second, then the
     repeats landed on the drawer's Play and opened the game on top of it).
     The key's auto-repeats are stopped here, before every other listener on
     the page (window, capture phase) and before a focused button's own
     click. A TV remote that repeats OK without marking it (Tizen) is caught
     too: a second keydown with no keyup between them, within a second of the
     last, is a repeat. Left alone: text fields, and a running game (the game
     owns its keys). Nothing here plays: a held Enter never becomes Play. */
  const heldAt = new Map();                  // key -> time of its last keydown, until its keyup
  const ONE_PRESS = new Set(['Enter', ' ']);
  window.addEventListener('keydown', e => {
    if (!ONE_PRESS.has(e.key) || e.__gnwPad) return;
    const now = performance.now(), last = heldAt.get(e.key);
    heldAt.set(e.key, now);
    const rep = e.repeat || (last != null && now - last < 1000);
    if (!rep || isField(e.target)) return;
    const top = topLayer();
    if (top && isPlay(top.el)) return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  window.addEventListener('keyup', e => { if (ONE_PRESS.has(e.key)) heldAt.delete(e.key); }, true);
  window.addEventListener('blur', () => heldAt.clear());

  /* ------------------------------------------------------------ layers */

  const isPlay = el => !!el && PLAY_IDS.indexOf(el.id) !== -1;

  /* WHAT IT STARTS WITH IS WHAT IT ENDS WITH (2026-10-17). A game started with the keys or a
     controller (a remote, the pad's Start on a tile, Enter then Play) comes back to the same tile,
     highlighted, in that mode, however the window was closed (a finger on the x included); a game
     started with the mouse or a finger comes back to the tile with no ring. The mode is read at
     the moment the play window opens: the controller's (gamepad.js marks the body gk-pad while a
     pad is driving), else the last real key or pointer press, which is the launching press. */
  let lastInput = 'pointer';
  window.addEventListener('keydown', e => { if (e.isTrusted && !e.__gnwPad) lastInput = 'key'; }, true);
  for (const t of ['pointerdown', 'mousedown', 'touchstart']) window.addEventListener(t, e => { if (e.isTrusted) lastInput = 'pointer'; }, true);
  const inputMode = () => (document.body && document.body.classList.contains('gk-pad')) ? 'pad' : lastInput;
  /* Put the mode back on the element focus returned to. A pad or keys: the ring shows (focusVisible,
     as gamepad.js's own focus does); a pointer: no ring. GnwPad.setPadMode, where gamepad.js offers
     it, puts its pad mode back too. */
  function endIn(el, mode) {
    if (!el || !mode || document.activeElement !== el) return;
    try { if (window.GnwPad && typeof window.GnwPad.setPadMode === 'function') window.GnwPad.setPadMode(mode === 'pad'); } catch (_) {}
    const ring = mode !== 'pointer';
    if (el.matches(':focus-visible') === ring) return;
    try { el.blur(); el.focus({ preventScroll: true, focusVisible: ring }); } catch (_) {}
  }
  function isLayerEl(el) {
    return !!el && el.nodeType === 1 && (el.classList.contains('overlay') || !!EMBY_CLOSE[el.id] || el.id === PAUSE_ID);
  }
  const isOpen = el => !!el && el.isConnected && el.classList.contains('open');

  const stack = [];                 // open layers, oldest first: { el, opener, sel }
  const known = new Map();          // el -> was it open at the last look
  let seq = 0;

  function topLayer() {
    for (let i = stack.length - 1; i >= 0; i--) if (isOpen(stack[i].el)) return stack[i];
    return null;
  }
  const recOf = el => stack.find(r => r.el === el) || null;
  const layerOf = node => { for (let i = stack.length - 1; i >= 0; i--) if (stack[i].el.contains(node)) return stack[i]; return null; };

  /* A selector that finds the same opener again after a re-render replaced it. */
  function keyOf(el) {
    if (!el || el === document.body || !el.getAttribute) return null;
    try {
      if (el.id) return '#' + CSS.escape(el.id);
      for (const a of ['data-cr-open', 'data-id', 'data-ep', 'data-tab', 'data-play']) {
        const v = el.getAttribute(a);
        if (v != null) return (el.classList[0] ? '.' + CSS.escape(el.classList[0]) : '') + '[' + a + '="' + CSS.escape(v) + '"]';
      }
    } catch (_) {}
    return null;
  }
  function usable(el) {
    if (!el || !el.isConnected || typeof el.focus !== 'function' || el === document.body) return false;
    if (el.closest('[inert]') && !el.closest('[data-gk-inert]')) return false;
    if (!el.getClientRects().length) return false;
    for (const r of stack) if (!isOpen(r.el) && r.el.contains(el)) return false;
    for (const k of known.keys()) if (!isOpen(k) && k.contains(el)) return false;
    return true;
  }
  /* Where focus goes back to: the opener, or -- when the opener has gone with a
     layer that closed too (Play in a drawer closes the drawer) -- that layer's
     own opener, and so on down. */
  function resolveOpener(rec) {
    let r = rec, guard = 0;
    while (r && guard++ < 8) {
      if (usable(r.opener)) return r.opener;
      if (r.sel) { try { const again = document.querySelector(r.sel); if (usable(again)) return again; } catch (_) {} }
      r = r.opener && r.opener.__gkRec ? r.opener.__gkRec : (r.opener ? closedRecFor(r.opener) : null);
    }
    return null;
  }
  const closedRecs = [];
  const closedRecFor = node => { for (let i = closedRecs.length - 1; i >= 0; i--) if (closedRecs[i].el.contains(node)) return closedRecs[i]; return null; };

  function focusQuiet(el) {
    if (!el) return false;
    if (el.tabIndex < 0 && !el.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA|IFRAME|VIDEO)$/.test(el.tagName)) el.tabIndex = -1;
    try { el.focus({ preventScroll: true }); } catch (_) { try { el.focus(); } catch (__) {} }
    return document.activeElement === el;
  }

  const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';
  function focusables(root) {
    return Array.from(root.querySelectorAll(FOCUSABLE)).filter(el => el.tabIndex >= 0 && el.getClientRects().length && !el.closest('[inert]') && getComputedStyle(el).visibility !== 'hidden');
  }
  /* Each layer's default focus (doc §5.6): Play in a drawer, the current tab in
     Settings, the picture in the player. Anything else: its first control. */
  const DEFAULT_FOCUS = {
    'device-overlay': '.play-now, .drawer-tab.active',
    'video-overlay': '.vd-play, .vd-season.active, .vd-ep',
    'vault-overlay': '.settings-tab.active',
    'lightbox-overlay': '.lb-next-btn, .lb-close',
    // The manual booklet: Next (Previous on the last spread), else the close button (2026-10-17).
    'manualOverlay': '#manualNextBtn:not([disabled]), #manualPrevBtn:not([disabled]), .manual-window-close',
    'video-player-overlay': 'video',
  };
  function focusInto(rec, tries) {
    const el = rec.el;
    if (!isOpen(el) || topLayer() !== rec) return;
    if (isPlay(el)) return;                                        // the play windows focus the game themselves
    const a = document.activeElement;
    const settled = a && a !== document.body && a !== el && el.contains(a) && !a.__gkFallback;
    if (settled) return;
    let target = null;
    const sel = DEFAULT_FOCUS[el.id];
    if (sel) { for (const s of sel.split(',')) { const c = el.querySelector(s.trim()); if (c && c.getClientRects().length) { target = c; break; } } }
    if (!target && !sel) target = focusables(el)[0] || null;
    if (target) {
      if (target.tagName === 'VIDEO' && !target.hasAttribute('tabindex') && !target.controls) target.tabIndex = -1;
      if (a && a.__gkFallback) a.__gkFallback = false;
      focusQuiet(target);
      // A drawer that re-renders its body right after opening takes the focused
      // button with it; look once more and put focus back if it was lost.
      if (tries > 0) setTimeout(() => {
        const b = document.activeElement;
        if (topLayer() === rec && (!b || b === document.body || !el.contains(b))) focusInto(rec, tries - 1);
      }, 250);
      return;
    }
    // Not drawn yet (a drawer still "Gathering details", the player still
    // preparing): hold focus on the dialog itself and look again shortly.
    const box = el.querySelector('[role="dialog"]') || el;
    if (!el.contains(document.activeElement) || document.activeElement === el) { box.__gkFallback = true; focusQuiet(box); }
    if (tries > 0) setTimeout(() => focusInto(rec, tries - 1), 150);
  }

  /* Everything outside the top layer is inert (doc §5.6). The two "stages" the
     drawers draw beside themselves and the toast host are left alone. */
  const INERT_EXEMPT = new Set(['device-stage', 'video-stage', 'toast-host', 'toast']);
  function syncInert() {
    const top = topLayer();
    let root = top ? top.el : null;
    while (root && root.parentElement && root.parentElement !== document.body) root = root.parentElement;
    for (const c of Array.from(document.body.children)) {
      const want = !!root && c !== root && !INERT_EXEMPT.has(c.id) && !/^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(c.tagName) && !c.classList.contains('toast-host');
      if (want && !c.hasAttribute('inert')) { c.setAttribute('inert', ''); c.setAttribute('data-gk-inert', '1'); }
      else if (!want && c.hasAttribute('data-gk-inert')) { c.removeAttribute('inert'); c.removeAttribute('data-gk-inert'); }
    }
  }

  function scan(records) {
    const opened = [], closed = [];
    const look = el => {
      const was = known.get(el) || false, now = isOpen(el);
      if (was === now) return;
      known.set(el, now);
      (now ? opened : closed).push(el);
    };
    if (records) {
      for (const m of records) {
        if (m.type === 'attributes') { if (isLayerEl(m.target)) look(m.target); continue; }
        m.addedNodes.forEach(n => { if (isLayerEl(n)) { watch(n); look(n); } else if (n.nodeType === 1 && n.querySelectorAll) n.querySelectorAll('.overlay').forEach(x => { watch(x); look(x); }); });
        m.removedNodes.forEach(n => { if (known.has(n)) look(n); });
      }
    }
    if (!opened.length && !closed.length) return;
    const active = document.activeElement;
    let restoreTo = null;
    for (const el of closed) {
      const i = stack.findIndex(r => r.el === el);
      if (i < 0) continue;
      const rec = stack.splice(i, 1)[0];
      closedRecs.push(rec); if (closedRecs.length > 12) closedRecs.shift();
      if (!restoreTo && el.id !== PAUSE_ID) restoreTo = rec;          // the pause menu hands focus to the game itself
    }
    for (const el of opened) {
      let opener = active;
      if (!usable(opener) && restoreTo) opener = resolveOpener(restoreTo) || opener;
      const rec = { el, opener, sel: keyOf(opener), seq: ++seq };
      if (isPlay(el)) rec.mode = inputMode();                         // how this game was started (2026-10-17)
      el.__gkRec = rec;
      stack.push(rec);
    }
    /* A game's window never opens over a drawer (2026-10-14): whatever
       opened it, a game drawer still open underneath is closed, as Play in
       the drawer already does. Focus still returns through the drawer's
       opener (closedRecs) when the game closes. */
    if (opened.some(isPlay)) {
      const dr = document.getElementById('device-overlay');
      if (isOpen(dr)) setTimeout(() => { if (isOpen(dr)) closeLayer(dr); }, 0);
    }
    syncInert();
    if (opened.length) {
      const rec = topLayer();
      if (rec) requestAnimationFrame(() => setTimeout(() => focusInto(rec, 14), 30));
    } else if (restoreTo) {
      const a = document.activeElement;
      const lost = !a || a === document.body || !usable(a) || closed.some(el => el.contains(a));
      if (lost) {
        const t = topLayer();
        const target = resolveOpener(restoreTo);
        if (target && (!t || t.el.contains(target))) { focusQuiet(target); if (restoreTo.mode) endIn(target, restoreTo.mode); }
        else if (t) focusInto(t, 4);
      }
    }
  }
  const mo = new MutationObserver(scan);
  const watched = new WeakSet();
  function watch(el) {
    if (watched.has(el)) return;
    watched.add(el);
    mo.observe(el, { attributes: true, attributeFilter: ['class'] });
  }
  function boot() {
    document.querySelectorAll('.overlay').forEach(watch);
    Object.keys(EMBY_CLOSE).forEach(id => { const el = document.getElementById(id); if (el) watch(el); });
    mo.observe(document.body, { childList: true });
    // Anything already open at load (a deep link) counts as opened now.
    const recs = [];
    document.querySelectorAll('.overlay.open').forEach(el => recs.push({ type: 'attributes', target: el }));
    if (recs.length) scan(recs);
    mountDisplaySetting();
  }

  /* Close one layer, by the layer's own close path. */
  function closeLayer(el) {
    const id = el.id;
    if (id === PAUSE_ID) { pauseResume(); return; }   // Back from the pause menu resumes (2026-10-14)
    if (id === 'confirm-overlay' && typeof __confirmResolve === 'function') { __confirmResolve(false); return; }
    if (EMBY_CLOSE[id] && window.Emby && typeof window.Emby[EMBY_CLOSE[id]] === 'function') { window.Emby[EMBY_CLOSE[id]](); return; }
    if (id && typeof closeOverlay === 'function' && el.classList.contains('overlay') && !el.classList.contains('cws-overlay')) { closeOverlay(id); return; }
    const x = el.querySelector('.modal-close, [data-cws-action="close"], .lb-close');
    if (x) x.click(); else el.classList.remove('open');
  }

  /* ------------------------------------------------------------ Back */

  const snap = new WeakMap();
  window.addEventListener('keydown', e => {
    // A remote's Back, under a name the panels inside the player do not know:
    // send it on as GoBack, which every one of them does.
    if ((TV_BACK_CODES.has(e.keyCode) && !BACK_NAMES.has(e.key)) || ODD_BACK_NAMES.has(e.key)) {
      e.preventDefault(); e.stopImmediatePropagation();
      const t = e.target && e.target.dispatchEvent ? e.target : document.body;
      t.dispatchEvent(new KeyboardEvent('keydown', { key: 'GoBack', code: e.code, bubbles: true, cancelable: true, composed: true, repeat: e.repeat }));
      return;
    }
    if (e.key === 'Tab') { trapTab(e); return; }
    if (!isBack(e)) return;
    const top = topLayer();
    if (top && (top.el.id === PAUSE_ID || isPlay(top.el))) {
      // A running game owns its keys; Back is the one it never sees (P7).
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat) return;
      if (top.el.id === PAUSE_ID) { pauseResume(); return; }   // Back again resumes; only Quit quits (2026-10-14)
      gameBack(top.el);
      return;
    }
    snap.set(e, top);
  }, true);
  window.addEventListener('keydown', e => {
    if (!isBack(e) || e.defaultPrevented) return;
    if (!snap.has(e)) return;
    const top = snap.get(e);
    if (!top || !isOpen(top.el)) return;                           // nothing open, or already closed by its own handler
    if (topLayer() !== top) return;
    e.preventDefault();
    if (e.repeat) return;
    closeLayer(top.el);
  });

  function trapTab(e) {
    const top = topLayer();
    if (!top || mods(e)) return;
    const list = focusables(top.el);
    if (!list.length) { e.preventDefault(); return; }
    const a = document.activeElement, i = list.indexOf(a);
    if (!top.el.contains(a)) { e.preventDefault(); focusQuiet(e.shiftKey ? list[list.length - 1] : list[0]); return; }
    if (e.shiftKey && i === 0) { e.preventDefault(); focusQuiet(list[list.length - 1]); }
    else if (!e.shiftKey && i === list.length - 1) { e.preventDefault(); focusQuiet(list[0]); }
  }

  /* ------------------------------------------------------------ the pause menu */

  function frameOf(ov) { return ov ? ov.querySelector('iframe') : null; }
  function vis(el) { return !!el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none'; }
  function pressedState(b) { return !!b && b.getAttribute('aria-pressed') === 'true'; }

  /* What each window can do, by its own controls. */
  function adapterFor(ov) {
    const id = ov.id;
    if (id === 'play-overlay' && !frameOf(ov)) {      // the G&W host frame (?host=gnw) takes the framed path
      const pb = () => document.getElementById('play-pause-toggle');
      return {
        pause(on) { const b = pb(); if (!b || !window.gnwTogglePause || pressedState(b) === on) return false; window.gnwTogglePause(); return pressedState(b) === on; },
        controls: vis(document.getElementById('play-keys-btn')) ? () => document.getElementById('play-keys-btn').click() : null,
        saves: vis(document.getElementById('play-load-btn')) ? () => document.getElementById('play-load-btn').click() : null,
        sub() { if (document.querySelector('#play-toolbar-pill.sub-open') && window.gnwPillBack) { window.gnwPillBack(); return true; } return false; },
      };
    }
    // The Pokemon mini in the one play host is a frame like the Game Boy's (play/cores/pm/site.js):
    // only the old in-page window takes this branch.
    if (id === 'pm-play-overlay' && !frameOf(ov)) {
      // The Control Bar runs in this document for the Pokemon mini (play/pokemini/pm-controlbar.js,
      // 2026-10-11): pause, Keys, Saves, a panel's Back and the bar's focus all go through it.
      const B = window.ControlBar;
      if (B && B.active && B.sys === 'pm' && ov.classList.contains('cb-unified')) {
        return {
          pause(on) { try { return !!B.pause(on); } catch (_) { return false; } },
          controls: () => B.controls(),
          saves: () => B.saves(),
          bar: () => B.focusBar(),
          sub() { try { return !!B.back(); } catch (_) { return false; } },
        };
      }
      const dev = () => (typeof _pmActiveDevice !== 'undefined' ? _pmActiveDevice : null);   // index.html's own handle
      return {
        pause(on) { const d = dev(); if (!d) return false; if (on) { if (!d._running) return false; d.pause(); return true; } if (d._running) return false; d.start(); return true; },
        controls: typeof pmOpenKeys === 'function' ? () => pmOpenKeys() : null,
        saves: null,
        sub() { if ((document.querySelector('#pm-toolbar-pill.sub-open') || document.querySelector('#pm-keys-panel.open')) && typeof pmCloseKeys === 'function') { pmCloseKeys(); return true; } return false; },
      };
    }
    let k = null;
    try { const f = frameOf(ov); k = f && f.contentWindow && f.contentWindow.gnwPlayKeys; } catch (_) { k = null; }
    const has = k ? k.has() : {};
    return {
      pause(on) { try { return k ? !!k.pause(on) : false; } catch (_) { return false; } },
      controls: has.controls ? () => k.controls() : null,
      saves: has.saves ? () => k.saves() : null,
      // The Control Bar (play/shared/control-bar.js): focus onto it, for a remote or a pad.
      bar: has.bar && k.focusBar ? () => { try { const f = frameOf(ov); if (f) f.focus(); } catch (_) {} k.focusBar(); } : null,
      sub() {
        if (id === 'tft-play-overlay' && vis(document.getElementById('tft-custom-panel')) && window.tftCancelCustom) { window.tftCancelCustom(); return true; }
        /* An open Control Bar menu in the frame (the Variant menu, 2026-10-13): a phone's
           back gesture reaches only this page's history, so ask the bar to step back. */
        /* And an open panel (31 Oct: "When I'm in gameplay and enter a sub-menu of the Control Bar,
           like Keys or Saves, the Android Back button should back out of the menu and not show the
           Guide menu"): only a menu was asked about, so Back over Keys, Saves or Settings went past
           them to the Guide menu. Now the bar takes one step back (its innermost open thing: a
           note being typed, a submenu, a menu, a panel, a focused note); the Guide menu comes only
           when nothing there is open. */
        try { const f = frameOf(ov), B = f && f.contentWindow && f.contentWindow.ControlBar; if (B && B.active && B.state && (B.state.menu || B.state.panel || B.state.toast)) return !!B.back(); } catch (_) {}
        return false;
      },
    };
  }
  function gameFocus(ov) {
    if (window._playFocusGame) window._playFocusGame(ov);
  }

  let P = null;   // the open pause menu: { ov, el, ad, paused }
  function ensurePauseStyles() {
    if (document.getElementById('gk-style')) return;
    const st = document.createElement('style');
    st.id = 'gk-style';
    st.textContent = `
      #gk-pause { position:fixed; inset:0; z-index:400; display:none; align-items:center; justify-content:center;
        background:rgba(6,8,12,.62); -webkit-backdrop-filter:blur(3px); backdrop-filter:blur(3px); }
      #gk-pause.open { display:flex; }
      #gk-pause .gk-card { min-width:260px; max-width:min(92vw,360px); background:var(--bg-2,#151a24); color:var(--text,#e7ecf2);
        border:1px solid var(--line,#2a3342); border-radius:16px; padding:18px 18px 14px; box-shadow:0 18px 60px rgba(0,0,0,.55); }
      #gk-pause .gk-title { font-size:12px; letter-spacing:.18em; text-transform:uppercase; color:var(--muted,#9aa4b2); margin:0 0 12px; }
      #gk-pause .gk-list { display:flex; flex-direction:column; gap:8px; }
      #gk-pause button { appearance:none; text-align:left; font:inherit; font-size:15px; font-weight:600; color:inherit; cursor:pointer;
        background:rgba(255,255,255,.05); border:1px solid transparent; border-radius:10px; padding:11px 14px; }
      #gk-pause button:hover { background:rgba(255,255,255,.09); }
      #gk-pause button.gk-primary { background:rgba(var(--accent-rgb,155,225,93),.16); border-color:rgba(var(--accent-rgb,155,225,93),.45); }
      #gk-pause .gk-hint { margin:12px 2px 0; font-size:12px; color:var(--muted,#9aa4b2); }
      :root[data-theme="light"] #gk-pause .gk-card { background:#fff; }
      :root[data-theme="light"] #gk-pause button { background:rgba(0,0,0,.04); }
      body.gnw-tv #gk-pause button { font-size:18px; padding:14px 18px; }
    `;
    document.head.appendChild(st);
  }
  function openPause(ov) {
    if (P || !isOpen(ov)) return;
    _subFrom = null;
    ensurePauseStyles();
    const ad = adapterFor(ov);
    const el = document.createElement('div');
    el.id = PAUSE_ID;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Paused');
    const items = [['resume', 'Resume', 'gk-primary']];
    /* A window with a Control Bar offers "Control bar" (focus moves onto it: its Keys and
       Help hold the key reference); only a window without one keeps "Controls"
       (2026-10-14). */
    if (ad.controls && !ad.bar) items.push(['controls', 'Controls']);
    if (ad.saves) items.push(['saves', 'Saved states']);
    if (ad.bar) items.push(['bar', 'Control bar']);
    items.push(['quit', 'Quit']);
    el.innerHTML = '<div class="gk-card"><div class="gk-title">Paused</div><div class="gk-list">' +
      items.map(([a, l, c]) => `<button type="button" data-gk="${a}"${c ? ` class="${c}"` : ''}>${l}</button>`).join('') +
      '</div><div class="gk-hint">Press Back to return to the game.</div></div>';
    el.addEventListener('click', e => {
      if (e.target === el) { pauseResume(); return; }                // the backdrop: carry on playing
      const b = e.target.closest('[data-gk]'); if (!b) return;
      const a = b.dataset.gk;
      if (a === 'resume') pauseResume();
      else if (a === 'quit') pauseQuit();
      else if (a === 'controls') pauseThen(ad.controls);
      else if (a === 'saves') pauseThen(ad.saves);
      else if (a === 'bar') { const p = closePause(); if (!p) return; if (p.paused) p.ad.pause(false); setTimeout(() => { try { ad.bar(); } catch (e) { console.warn('[keys] Control Bar focus failed:', e); } }, 0); }
    });
    el.addEventListener('keydown', e => {
      const list = Array.from(el.querySelectorAll('button'));
      const i = list.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation();
        const n = list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length];
        if (n) n.focus();
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault(); e.stopPropagation();
        (e.key === 'Home' ? list[0] : list[list.length - 1]).focus();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); }
    });
    const paused = ad.pause(true);
    P = { ov, el, ad, paused };
    document.body.appendChild(el);
    el.classList.add('open');
    setTimeout(() => { const b = el.querySelector('button'); if (b && P && P.el === el) b.focus({ preventScroll: true }); }, 0);
  }
  function closePause() {
    if (!P) return null;
    const p = P; P = null;
    p.el.classList.remove('open');
    setTimeout(() => p.el.remove(), 0);
    return p;
  }
  function pauseResume() {
    const p = closePause(); if (!p) return;
    if (p.paused) p.ad.pause(false);
    if (isOpen(p.ov)) setTimeout(() => gameFocus(p.ov), 0);
  }
  /* A screen opened from the pause menu (Controls, Saved states) goes back to
     the pause menu when Back closes it (2026-10-14), as a TV menu does; the
     focus stays on the screen rather than going to the game behind it. */
  let _subFrom = null;
  function pauseThen(fn) {
    const p = closePause(); if (!p) return;
    if (p.paused) p.ad.pause(false);
    _subFrom = p.ov;
    setTimeout(() => {
      try { fn && fn(); } catch (e) { console.warn('[keys] window action failed:', e); }
      setTimeout(() => {
        if (!subOpenIn(p.ov)) { _subFrom = null; gameFocus(p.ov); return; }
        /* An in-page screen with nothing focused in it (Game & Watch): its first item takes focus. */
        const root = document.querySelector('#play-save-panel.open, #play-keys-panel.open');
        if (root && !root.contains(document.activeElement)) { const b = root.querySelector('button, [tabindex="0"]'); if (b) try { b.focus({ preventScroll: true }); } catch (_) {} }
      }, 50);
    }, 0);
  }
  /* Is a screen of the window open (its Keys or Saves screen, a Control Bar panel or menu)? */
  function subOpenIn(ov) {
    try {
      const f = frameOf(ov);
      if (f) { const k = f.contentWindow && f.contentWindow.gnwPlayKeys; return !!(k && k.subOpen && k.subOpen()); }
      if (ov.id === 'play-overlay') return typeof window.gnwSubOpen === 'function' ? !!window.gnwSubOpen() : !!document.querySelector('#play-toolbar-pill.sub-open');
      if (ov.id === 'pm-play-overlay') {
        const B = window.ControlBar;
        if (B && B.active && B.sys === 'pm') { const s = B.state || {}; return !!(s.panel || s.menu); }
        return !!document.querySelector('#pm-keys-panel.open, #pm-toolbar-pill.sub-open');
      }
    } catch (_) {}
    return false;
  }
  /* The last screen closed (play-pad.js, play-keys.js, or a Back here): back to the pause menu. */
  function subClosed(ov) {
    if (typeof ov === 'string') ov = document.getElementById(ov);
    if (!ov) ov = _subFrom;
    if (!ov || _subFrom !== ov || P || !isOpen(ov)) return;
    if (subOpenIn(ov)) return;
    _subFrom = null;
    setTimeout(() => openPause(ov), 0);
  }
  /* GUIDE IN SETTINGS (2026-10-23: the Guide button in Settings opens the Guide menu). With
     Settings open over a game (the Control Bar's Keyboard & controllers opens it there), the pad's
     Guide button (or Select+Start) closes Settings and opens that game's Guide menu. Without a game
     under Settings there is no Guide menu: false, and Guide keeps its usual job. */
  function guideFromSettings() {
    const top = topLayer();
    if (P || !top || top.el.id !== 'vault-overlay') return false;
    let ov = null;
    for (let i = stack.length - 1; i >= 0 && !ov; i--) if (isOpen(stack[i].el) && isPlay(stack[i].el)) ov = stack[i].el;
    if (!ov) return false;
    closeLayer(top.el);
    setTimeout(() => openPause(ov), 60);              // after Settings' focus-back has run
    return true;
  }
  /* Quit = the window's own close button, the same path as the x, so the
     Continue row's save on close runs exactly as it does for a click. The
     pause this menu made is undone first, so the window closes in the state
     the player left it in. */
  function pauseQuit() {
    const p = closePause(); if (!p) return;
    if (p.paused) p.ad.pause(false);
    quitWindow(p.ov);
  }
  function quitWindow(ov) {
    if (!isOpen(ov)) return;
    const x = ov.querySelector('.modal-close');
    if (x) x.click(); else if (typeof closeOverlay === 'function') closeOverlay(ov.id);
  }
  /* Back with a game in front: a sub-screen of the window closes first, else
     the pause menu opens. */
  function gameBack(ov) {
    const ad = adapterFor(ov);
    if (ad.sub()) { setTimeout(() => subClosed(ov), 0); return; }
    openPause(ov);
  }

  // Back from inside a framed game (play/play-keys.js).
  window.addEventListener('message', ev => {
    const d = ev.data;
    if (d && d.gnwSubClosed === 1) {           // a framed window's screen closed (play-pad.js / play-keys.js)
      for (const id of PLAY_IDS) { const ov = document.getElementById(id), f = frameOf(ov); if (isOpen(ov) && f && f.contentWindow === ev.source) { subClosed(ov); return; } }
      return;
    }
    if (!d || d.gnwBack !== 1) return;
    for (const id of PLAY_IDS) {
      const ov = document.getElementById(id);
      if (!isOpen(ov)) continue;
      const f = frameOf(ov);
      if (!f || f.contentWindow !== ev.source) continue;
      if (P) { if (P.ov === ov) pauseResume(); return; }   // Back from the frame with the menu up: resume
      const top = topLayer();
      if (!top || top.el !== ov) return;
      gameBack(ov);
      return;
    }
  });

  /* History Back (a remote that sends history.back, a phone's back gesture, the
     browser's own button) with a game in front. index.html calls this from its
     popstate handler and from applyHashRoute (the Game & Watch window is a
     route). true = "I handled it, keep the window"; false = "close it". With
     the menu already up, Back resumes the game and keeps the window
     (2026-10-14: only the Quit item closes a game). */
  function historyBack(ov) {
    if (!isOpen(ov) || !isPlay(ov)) return false;
    if (P) {
      if (P.ov !== ov) return false;
      pauseResume();
      return true;
    }
    /* The header's Variant menu (variants.js) closes first, the version unchanged. */
    try { if (window.Variants && Variants.menuOpen && Variants.menuOpen()) { Variants.closeMenu(); return true; } } catch (_) {}
    const ad = adapterFor(ov);
    if (ad.sub()) { setTimeout(() => subClosed(ov), 0); return true; }
    openPause(ov);
    return !!P;
  }

  /* ------------------------------------------------------------ the play key */

  const PLAY_KEY_CODES = new Set([415, 10252, 179]);          // MediaPlay / Tizen PlayPause / Windows VK_MEDIA_PLAY_PAUSE
  const isPlayKey = e => (!mods(e) && (e.key === 'p' || e.key === 'P') && !e.shiftKey) || e.key === 'MediaPlayPause' || e.key === 'MediaPlay' || PLAY_KEY_CODES.has(e.keyCode);

  function chooseEpisode(eps) {
    const real = eps.filter(x => x.ParentIndexNumber !== 0 && x.LocationType !== 'Virtual');
    const list = real.length ? real : eps;
    const ud = x => x.UserData || {};
    const inProgress = list.find(x => !ud(x).Played && ud(x).PlaybackPositionTicks > 0);
    if (inProgress) return inProgress;
    let lastPlayed = -1;
    list.forEach((x, i) => { if (ud(x).Played) lastPlayed = i; });
    return list[lastPlayed + 1] || list[0] || null;
  }
  function resumeTicksOf(it) {
    const E = window.Emby, ud = it.UserData || {}, run = it.RunTimeTicks || 0, pos = ud.PlaybackPositionTicks || 0;
    if (ud.Played || !(pos > 0) || !(run > 0) || pos >= run * 0.98) return 0;
        // (Player fixes 2026-10-04: remux and server conversion resume too now.)
    return pos;
  }
  let _playBusy = false;
  async function playVideoId(id, trigger) {
    const E = window.Emby;
    if (!E || !E.getItem || !E.openVideoPlayer || _playBusy) return;
    _playBusy = true;
    try {
      let item = await E.getItem(id);
      if (!item) return;
      if (item.Type === 'Series') {
        const { items } = await E.getEpisodes(item.Id);
        item = chooseEpisode(items || []);
        if (!item) { E.openVideo && E.openVideo(id); return; }
      } else if (item.Type !== 'Movie' && item.Type !== 'Episode' && item.Type !== 'Video' && item.Type !== 'MusicVideo') {
        E.openVideo && E.openVideo(id); return;                     // not something the player plays: show its details
      }
      // -1: resume from the newest saved place (emby.js reads it fresh; a list
      // read just after a close can still hold the session before last).
      const rt = resumeTicksOf(item);
      await E.openVideoPlayer(item, trigger || null, rt > 0 ? rt : (E.freshResumeTicks ? -1 : 0));
    } catch (e) {
      console.warn('[keys] play from tile failed:', e);
    } finally { _playBusy = false; }
  }
  /* Returns true when it found something to play. */
  function playKey(target) {
    const top = topLayer();
    const el = target && target.closest ? target : document.body;
    if (!top) {
      const cr = el.closest('[data-cr-open]');
      if (cr) { cr.click(); return true; }
      const vc = el.closest('.video-card[data-id]');
      if (vc) { playVideoId(vc.dataset.id, vc); return true; }
      const dc = el.closest('.device-card');
      if (dc) { const b = dc.querySelector('.play-badge'); if (b) { b.click(); return true; } }
      return false;
    }
    if (top.el.id === 'device-overlay') { const b = top.el.querySelector('.play-now'); if (b) { b.click(); return true; } return false; }
    if (top.el.id === 'video-overlay') {
      const ep = el.closest('.vd-ep');
      if (ep && top.el.contains(ep)) { const t = ep.querySelector('.vd-ep-thumb'); if (t) { t.click(); return true; } }
      const b = top.el.querySelector('.vd-play');
      if (b) { b.click(); return true; }
      const sid = window.__gkDrawerId;
      if (sid) { playVideoId(sid, null); return true; }
      return false;
    }
    if (top.el.id === 'video-info-overlay') {
      // The episode the info drawer is about: its row is in the drawer below.
      return false;
    }
    return false;
  }
  // Remember which title a video drawer is showing (for a series, whose drawer has no Play button).
  document.addEventListener('click', e => { const vc = e.target.closest && e.target.closest('.video-card[data-id], [data-cr-open]'); if (vc && vc.dataset.id) window.__gkDrawerId = vc.dataset.id; }, true);
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest) { const vc = e.target.closest('.video-card[data-id]'); if (vc) window.__gkDrawerId = vc.dataset.id; } }, true);

  /* ------------------------------------------------------------ the tile key map */

  /* THE TILE KEY MAP (2026-10-14; finger long press removed 2026-10-24;
     the pad's held A removed 2026-10-25).
     On a tile in the grid (a game or a film / series; .video-card is also a
     .device-card):
       play:   P, a remote's Play/Pause, the pad's Start (the Play key above),
               the tile's Play badge;
       drawer: Enter / OK, the pad's A, a tap (each tile's own click / Enter).
     Nothing is timed on a tile: a held A is only the Systems menu's
     add-or-remove (gamepad.js HOLD_SEL, emby.js). */
  const TILE_SEL = '.device-card[data-id]';
  const tileOf = t => {
    const tile = t && t.closest ? t.closest(TILE_SEL) : null;
    if (!tile || topLayer()) return null;
    const ctl = t.closest('button, a[href], [role="button"]');
    return ctl && ctl !== tile ? null : tile;
  };
  /* A FINGER'S LONG PRESS NO LONGER PLAYS (2026-10-24): people rest a
     finger on a tile before they scroll, and the hold started the game. A held
     finger now does nothing; the tap still opens the drawer and the Play badge
     still plays. Only the phone's own press-and-hold menu is still kept off the
     tiles (contextmenu below), so a resting finger never pops anything up. */
  let touchDownAt = -Infinity;
  document.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') touchDownAt = performance.now();
  }, true);
  /* No callout or text selection under a held finger (coarse pointers only). */
  try {
    const st = document.createElement('style');
    st.id = 'gk-tile-hold';
    st.textContent = '@media (pointer: coarse) { .device-card[data-id] { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; } }'
      /* The badges stay above every preview layer a tile draws (the live emulators' sheen is z-index 4). */
      + ' .device-card[data-id] > .play-badge, .device-card[data-id] > .manual-badge { z-index: 6; }';
    (document.head || document.documentElement).appendChild(st);
  } catch (_) {}

  /* A PRESS THAT STARTS ON THE PLAY BADGE PLAYS (2026-10-15, unified G3 gate:
     about 1 press in 6 on a tile whose preview was running opened the drawer).
     A preview can redraw the tile between the press and the click, and the
     click then lands on the tile body, whose own click opens the drawer. So the
     press is remembered here, and a click on the same tile that follows it
     (within 1.5 s, no badge under it any more) is turned into the badge's own
     click: the game, never the drawer. Mouse and touch alike. */
  let badgeDown = null;                      // { id, t } of a press that began on a tile's Play badge
  document.addEventListener('pointerdown', e => {
    const b = e.target && e.target.closest ? e.target.closest('.device-card[data-id] .play-badge') : null;
    badgeDown = b ? { id: b.closest('.device-card[data-id]').dataset.id, t: performance.now() } : null;
  }, true);
  document.addEventListener('click', e => {
    const bd = badgeDown; badgeDown = null;
    if (!bd || !e.isTrusted || performance.now() - bd.t > 1500 || !e.target || !e.target.closest) return;
    if (e.target.closest('.play-badge')) return;                       // it reached the badge: nothing to fix
    const card = e.target.closest('.device-card[data-id]');
    if (!card || card.dataset.id !== bd.id) return;
    const badge = card.querySelector('.play-badge');
    if (!badge) return;
    e.preventDefault(); e.stopImmediatePropagation();
    badge.click();
  }, true);
  document.addEventListener('contextmenu', e => {
    if (performance.now() - touchDownAt < 3000 && tileOf(e.target)) e.preventDefault();
  }, true);

  /* ------------------------------------------------------------ the player */

  const media = { live: null, last: {} };
  function once(action) {                                         // a key and a Media Session call for one press
    const now = performance.now();
    if (now - (media.last[action] || 0) < 350) return false;
    media.last[action] = now;
    return true;
  }
  const pv = () => document.querySelector('#video-player-overlay video');
  function pTime() { const E = window.Emby; return E && E.player ? E.player.time() : ((pv() || {}).currentTime || 0); }
  function pSeek(t) { const E = window.Emby; const d = E && E.player ? E.player.duration() : 0; t = Math.max(0, d ? Math.min(t, d - 0.5) : t); if (E && E.player) E.player.seek(t); else if (pv()) pv().currentTime = t; }
  function pToggle(want) {
    const v = pv(); if (!v) return;
    const play = want === undefined ? v.paused : want;
    if (play) { const r = v.play(); if (r && r.catch) r.catch(() => {}); } else v.pause();
  }
  const stageBtn = act => document.querySelector('#video-player-overlay [data-act="' + act + '"]');
  function pFullscreen() {
    const b = stageBtn('fs'); if (b) { b.click(); return; }
    const ov = document.getElementById('video-player-overlay');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else if (ov && ov.requestFullscreen) ov.requestFullscreen().catch(() => {});
  }
  function pCycleSubs() {
    try {
      const I = window.GnwSubs && window.GnwSubs._internal, L = I && I.live();
      if (!L || L.dead) return;
      const all = (I.subStreams(L.src) || []).filter(st => I.isTextStream(st));
      if (!all.length) { const b = stageBtn('pick'); if (b) b.click(); return; }
      const i = L.track ? all.indexOf(L.track) : -1;
      I.selectTrack(L, i + 1 < all.length ? all[i + 1] : null);
    } catch (e) { const b = stageBtn('pick'); if (b) b.click(); }
  }
  async function pEpisode(dir) {
    const E = window.Emby, L = media.live;
    if (!E || !E.player || !L || !L.item || (L.item.Type && L.item.Type !== 'Episode')) return;
    try {
      let target = null;
      if (dir > 0) {
        const U = window.GnwUpNext && window.GnwUpNext._live && window.GnwUpNext._live();
        target = (U && U.item && U.item.Id === L.item.Id && U.next) || await E.player.nextEpisode(L.item);
      } else {
        let it = L.item;
        if (!it.SeriesId) it = await E.getItem(it.Id);
        const { items } = await E.getEpisodes(it.SeriesId);
        const i = items.findIndex(x => x.Id === it.Id), special = it.ParentIndexNumber === 0;
        for (let j = i - 1; j >= 0; j--) { const x = items[j]; if ((!special && x.ParentIndexNumber === 0) || x.LocationType === 'Virtual') continue; target = x; break; }
      }
      if (target) await E.player.playNext(target, null);              // a skip, not a finish: nothing is marked Played
    } catch (e) { console.warn('[keys] episode skip failed:', e); }
  }
  function playerAction(a) {
    if (!document.getElementById('video-player-overlay') || !pv()) return false;
    switch (a) {
      case 'toggle': pToggle(); break;
      case 'play': pToggle(true); break;
      case 'pause': pToggle(false); break;
      case 'back10': pSeek(pTime() - 10); break;
      case 'fwd10': pSeek(pTime() + 10); break;
      case 'next': pEpisode(1); break;
      case 'prev': pEpisode(-1); break;
      case 'stop': if (window.Emby && window.Emby.closePlayer) window.Emby.closePlayer(); break;
      default: return false;
    }
    return true;
  }
  const MEDIA_KEYS = {
    MediaPlayPause: 'toggle', MediaPlay: 'play', MediaPause: 'pause', MediaStop: 'stop',
    MediaTrackNext: 'next', MediaTrackPrevious: 'prev', MediaFastForward: 'fwd10', MediaRewind: 'back10',
  };
  const MEDIA_CODES = { 179: 'toggle', 10252: 'toggle', 415: 'play', 19: 'pause', 413: 'stop', 417: 'fwd10', 412: 'back10', 176: 'next', 177: 'prev' };

  /* ------------------------------------------------------------ the action table (actions.js) */

  const onControl = t => !!(t && t.closest && t.closest('button, a[href], [role="button"], [role="menuitem"], [role="slider"]'));
  const stageClick = act => { const b = stageBtn(act); if (b) b.click(); };
  // The player's letter keys. A Shift+letter twin is listed where the key always took either case.
  const PLAYER_ACTIONS = {
    'player.toggle':     { label: 'Play / pause', keys: ['K', 'Shift+K', 'Space'], run: e => {
      if (e && e.key === ' ') {
        if (onControl(e.target)) return false;                               // Space presses the focused button
        if (e.target && e.target.tagName === 'VIDEO' && e.target.controls) return false;   // the native control already does this
      }
      playerAction('toggle'); } },
    'player.back10':     { label: 'Back 10 seconds', keys: ['J', 'Shift+J'], run: () => { playerAction('back10'); } },
    'player.fwd10':      { label: 'Forward 10 seconds', keys: ['L', 'Shift+L'], run: () => { playerAction('fwd10'); } },
    'player.fullscreen': { label: 'Full screen', keys: ['F', 'Shift+F'], run: () => { pFullscreen(); } },
    'player.mute':       { label: 'Mute', keys: ['M', 'Shift+M'], run: () => { const v = pv(); if (v) v.muted = !v.muted; } },
    'player.subs':       { label: 'Subtitles on / off', keys: ['C', 'Shift+C'], run: () => {
      // One Subtitles control opens a menu now (player fixes, 2026-10-04), so the key goes to the toggle itself.
      const I = window.GnwSubs && window.GnwSubs._internal;
      if (I && I.toggleSubs) I.toggleSubs(); else { const b = stageBtn('cc') || stageBtn('pick'); if (b) b.click(); } } },
    'player.subTrack':   { label: 'Next subtitle track', keys: ['V', 'Shift+V'], run: () => { pCycleSubs(); } },
    'player.subEarlier': { label: 'Subtitles 0.1 s earlier', keys: [','], run: () => { stageClick('minus'); } },
    'player.subLater':   { label: 'Subtitles 0.1 s later', keys: ['.'], run: () => { stageClick('plus'); } },
    'player.next':       { label: 'Next episode', keys: ['N'], run: () => { playerAction('next'); } },
    'player.prev':       { label: 'Previous episode', keys: ['Shift+N'], run: () => { playerAction('prev'); } },
  };
  // Media keys while the player is open: one action per player function, its key names and raw codes.
  const MEDIA_LABEL = { toggle: 'Play / pause (media key)', play: 'Play (media key)', pause: 'Pause (media key)', stop: 'Stop: close the player (media key)',
    next: 'Next episode (media key)', prev: 'Previous episode (media key)', fwd10: 'Forward 10 seconds (media key)', back10: 'Back 10 seconds (media key)' };
  const MEDIA_ACTIONS = {};
  for (const a of Object.keys(MEDIA_LABEL)) {
    MEDIA_ACTIONS['media.' + a] = {
      label: MEDIA_LABEL[a],
      keys: Object.keys(MEDIA_KEYS).filter(k => MEDIA_KEYS[k] === a).concat(Object.keys(MEDIA_CODES).filter(c => MEDIA_CODES[c] === a).map(c => '#' + c)),
      run: () => { if (once(a)) playerAction(a); },
    };
  }
  const TILE_ACTIONS = {
    'item.play': { label: 'Play or resume the focused tile, Continue card or open drawer', keys: ['P', 'MediaPlayPause', 'MediaPlay', '#415', '#10252', '#179'],
      run: e => (playKey(e && e.target ? e.target : document.activeElement) ? true : false) },
    /* M opens the focused game's instruction manual (30 Oct 2026), the tile's Manual badge or the drawer's Manual button. */
    'item.manual': { label: 'Open the instruction manual of the focused game tile or open game drawer', keys: ['M'],
      run: e => (manualKey(e && e.target ? e.target : document.activeElement) ? true : false) },
  };
  /* Returns true when it found a manual to open. */
  function manualKey(target) {
    const top = topLayer();
    const el = target && target.closest ? target : document.body;
    if (!top) {
      const dc = el.closest('.device-card');
      const b = dc && dc.querySelector('.manual-badge');
      if (b) { b.click(); return true; }
      return false;
    }
    if (top.el.id === 'device-overlay') {
      const b = top.el.querySelector('.manual-btn');
      if (b && !b.disabled && b.offsetParent !== null) { b.click(); return true; }
    }
    return false;
  }
  const REG = () => (window.Actions && typeof window.Actions.match === 'function' ? window.Actions : null);
  let registered = false;
  function registerActions() {
    const R = REG();
    if (registered || !R) return;
    try {
      const reg = (table, group, scope) => { for (const [id, d] of Object.entries(table)) R.register(id, { label: d.label, group, scope, keys: d.keys, run: e => table[id].run(e), palette: false }); };
      R.register('back', { label: 'Back: close the top layer, one step', group: 'Everywhere', scope: 'back', reserved: true, palette: false,
        keys: ['Escape', 'Backspace', 'GoBack', 'BrowserBack', 'Esc', 'XF86Back', '#4', '#10009', '#461'],
        // A pad or a remote without key events runs Back as the key every panel already understands.
        run: () => { const t = document.activeElement && document.activeElement !== document.body ? document.activeElement : document.body; t.dispatchEvent(new KeyboardEvent('keydown', { key: 'GoBack', bubbles: true, cancelable: true, composed: true })); } });
      reg(TILE_ACTIONS, 'Content page', 'tiles');
      reg(PLAYER_ACTIONS, 'Video player', 'player');
      reg(MEDIA_ACTIONS, 'Video player', 'media');
      R.register('game.back', { label: 'Pause menu (Back again resumes)', group: 'Play window', scope: 'game', keys: ['Escape', 'Backspace', 'GoBack'], reserved: true });
      R.register('game.rewind', { label: 'Rewind, held (where the game has it; also hold Enter on the Rewind button)', group: 'Play window', scope: 'game', keys: ['Ctrl+ArrowLeft'] });
      registered = true;
    } catch (err) { console.warn('[keys] action registry:', err); }
  }
  /* The action a key means in a scope: the registry's answer, or (no actions.js) the same tables here. */
  function keyAction(e, scope) {
    const R = REG();
    if (R && registered) return R.match(e, scope);
    if (scope === 'media') { const a = MEDIA_KEYS[e.key] || MEDIA_CODES[e.keyCode]; return a ? 'media.' + a : null; }
    if (scope === 'tiles') return isPlayKey(e) ? 'item.play' : (!mods(e) && !e.shiftKey && (e.key === 'm' || e.key === 'M') ? 'item.manual' : null);
    if (scope === 'player') {
      if (e.altKey || e.ctrlKey || e.metaKey) return null;
      const k = e.key === ' ' ? 'Space' : (e.key.length === 1 && /[a-z]/i.test(e.key) ? (e.shiftKey ? 'Shift+' : '') + e.key.toUpperCase() : e.key);
      for (const [id, d] of Object.entries(PLAYER_ACTIONS)) if (d.keys.includes(k)) return id;
    }
    return null;
  }
  function runAction(id, e) {
    const R = REG();
    if (R && registered) return R.run(id, e);
    const d = PLAYER_ACTIONS[id] || MEDIA_ACTIONS[id] || TILE_ACTIONS[id];
    return d ? d.run(e) : false;
  }

  // A player add-on (emby.js "PLAYER ADD-ONS"): the item, the picture, the Media Session.
  const addon = {
    name: 'keys', BUILD,
    attach(ctx) {
      this.detach();
      if (!ctx || !ctx.video || !ctx.item) return;
      media.live = { item: ctx.item, v: ctx.video, player: ctx.player };
      const ms = navigator.mediaSession;
      if (!ms) return;
      const it = ctx.item;
      try {
        const art = [];
        try { const u = ctx.player && ctx.player.thumbUrl && ctx.player.thumbUrl(it, 512); if (u) art.push({ src: u, sizes: '512x288' }); } catch (_) {}
        const sub = it.SeriesName ? it.SeriesName + (it.ParentIndexNumber != null && it.IndexNumber != null ? ' · S' + it.ParentIndexNumber + ':E' + it.IndexNumber : '') : '';
        ms.metadata = new MediaMetadata({ title: it.Name || '', artist: sub, album: '', artwork: art });
      } catch (_) {}
      const on = (name, fn) => { try { ms.setActionHandler(name, fn); } catch (_) {} };
      const act = a => () => { if (once(a)) playerAction(a); };
      on('play', act('play'));
      on('pause', act('pause'));
      on('stop', act('stop'));
      on('seekbackward', d => { if (once('back10')) pSeek(pTime() - ((d && d.seekOffset) || 10)); });
      on('seekforward', d => { if (once('fwd10')) pSeek(pTime() + ((d && d.seekOffset) || 10)); });
      on('seekto', d => { if (d && d.seekTime != null) pSeek(d.seekTime); });
      const ep = !it.Type || it.Type === 'Episode';
      on('nexttrack', ep ? act('next') : null);
      on('previoustrack', ep ? act('prev') : null);
      const v = ctx.video;
      const st = () => { try { ms.playbackState = v.paused ? 'paused' : 'playing'; } catch (_) {} };
      v.addEventListener('play', st); v.addEventListener('pause', st);
      media.live.off = () => { v.removeEventListener('play', st); v.removeEventListener('pause', st); };
    },
    detach() {
      const L = media.live; media.live = null;
      if (L && L.off) L.off();
      const ms = navigator.mediaSession;
      if (!ms) return;
      try { ms.metadata = null; ms.playbackState = 'none'; } catch (_) {}
      for (const n of ['play', 'pause', 'stop', 'seekbackward', 'seekforward', 'seekto', 'nexttrack', 'previoustrack']) { try { ms.setActionHandler(n, null); } catch (_) {} }
    },
  };
  (window.GnwPlayerAddons = window.GnwPlayerAddons || []).push(addon);

  function playerKey(e) {
    const ma = keyAction(e, 'media');
    if (ma) { runAction(ma, e); return true; }
    if (isField(e.target) || e.altKey || e.ctrlKey || e.metaKey) return false;
    const id = keyAction(e, 'player');
    if (!id) return false;
    return runAction(id, e) !== false;
  }

  /* Player keys and the play key, after every panel has had its chance. */
  window.addEventListener('keydown', e => {
    if (e.defaultPrevented) return;
    const top = topLayer();
    if (top && top.el.id === 'video-player-overlay') {
      if (playerKey(e)) e.preventDefault();
      return;
    }
    if (top && (isPlay(top.el) || top.el.id === PAUSE_ID)) return;     // the game has the keys
    if (isField(e.target)) return;
    const ta = keyAction(e, 'tiles');
    if (ta !== 'item.play' && ta !== 'item.manual') return;
    if (e.repeat) { e.preventDefault(); return; }
    if (runAction(ta, e) !== false) e.preventDefault();
  });
  // Media keys while the player is open, wherever focus is (the page catches
  // them before a panel can swallow them as unknown keys).
  window.addEventListener('keydown', e => {
    const top = topLayer();
    if (!top || top.el.id !== 'video-player-overlay') return;
    const ma = keyAction(e, 'media');
    if (!ma) return;
    e.preventDefault(); e.stopImmediatePropagation();
    runAction(ma, e);
  }, true);

  /* ------------------------------------------------------------ G&W Rewind from the keyboard */

  // Hold Enter or Space on the focused Rewind button (it reacts only to mouse
  // and touch by itself). Ctrl+← still works from the game.
  let rewKey = null;
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const b = e.target && e.target.id === 'play-rewind-btn' ? e.target : null;
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    if (e.repeat || rewKey) return;
    rewKey = e.key;
    if (window.gnwStartRewind) window.gnwStartRewind();
  }, true);
  const rewStop = () => { if (!rewKey) return; rewKey = null; if (window.gnwStopRewind) window.gnwStopRewind(); };
  document.addEventListener('keyup', e => { if (rewKey && e.key === rewKey) { e.preventDefault(); rewStop(); } }, true);
  document.addEventListener('focusout', e => { if (rewKey && e.target && e.target.id === 'play-rewind-btn') rewStop(); }, true);
  window.addEventListener('blur', rewStop);

  /* ------------------------------------------------------------ Settings -> Display -> TV mode */

  const TV_KEY = 'gnw.tvMode.setting';
  function tvSetting() { try { const v = localStorage.getItem(TV_KEY); return v === 'on' || v === 'off' ? v : 'auto'; } catch (_) { return 'auto'; } }
  function tvLinkOverride() { try { const s = localStorage.getItem('gnwTvMode'); return s === '1' ? 'on' : s === '0' ? 'off' : null; } catch (_) { return null; } }
  function applyTv() {
    const T = window.GNW_TV; if (!T) return;
    const link = tvLinkOverride(), set = tvSetting();
    T.setting = set;
    if (link) { T.isTV = link === 'on'; T.forced = T.isTV; T.source = 'url'; }
    else if (set !== 'auto') { T.isTV = set === 'on'; T.forced = T.isTV; T.source = 'setting'; }
    else { T.isTV = !!T.detected; T.forced = null; T.source = null; }
    document.body.classList.toggle('gnw-tv', !!T.isTV);
    syncDisplayUI();
  }
  function setTv(v) {
    /* Choosing here also forgets a ?tv= link choice (2026-10-24: links are for testing only,
       so the Settings choice always takes effect and there is no separate button to clear it). */
    try { localStorage.removeItem('gnwTvMode'); if (v === 'auto') localStorage.removeItem(TV_KEY); else localStorage.setItem(TV_KEY, v); } catch (_) {}
    applyTv();
  }
  function syncDisplayUI() {
    /* The TV mode section may have moved to Configurations (settings-config.js): look in Settings. */
    const panel = document.getElementById('vault-overlay');
    if (!panel) return;
    const T = window.GNW_TV || {}, set = tvSetting(), link = tvLinkOverride();
    panel.querySelectorAll('[data-tv-opt]').forEach(b => b.setAttribute('aria-checked', b.dataset.tvOpt === set ? 'true' : 'false'));
    const st = panel.querySelector('#gk-tv-status');
    if (st) {
      st.textContent = 'TV mode is ' + (T.isTV ? 'on' : 'off') + ' now' +
        (link ? ', set by a link (?tv=' + (link === 'on' ? '1' : '0') + ') in this browser; choosing Auto, On or Off below replaces it.'
          : set === 'auto' ? (T.detected ? ': this screen reads as a TV (no hover, no fine pointer).' : ': this screen does not read as a TV.')
          : '.');
    }
  }
  function mountDisplaySetting() {
    const tabs = document.querySelector('#vault-overlay .settings-tabs');
    const panels = document.querySelector('#vault-overlay .settings-panels');
    if (!tabs || !panels || tabs.querySelector('[data-tab="display"]')) return;
    const b = document.createElement('button');
    b.className = 'settings-tab'; b.type = 'button';
    b.dataset.tab = 'display';
    b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', 'false');
    b.textContent = 'Display';
    b.addEventListener('click', () => { if (typeof switchSettingsTab === 'function') switchSettingsTab('display'); syncDisplayUI(); });
    const after = tabs.querySelector('[data-tab="appearance"]');
    if (after && after.nextSibling) tabs.insertBefore(b, after.nextSibling); else tabs.appendChild(b);
    const p = document.createElement('div');
    p.className = 'settings-panel'; p.dataset.panel = 'display'; p.setAttribute('role', 'tabpanel');
    const opt = (v, label) => `<button type="button" class="theme-opt" data-tv-opt="${v}" role="radio" aria-checked="false">${label}</button>`;
    p.innerHTML = `<section class="vault-section">
        <label style="display:block; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--muted); margin-bottom:6px;">TV mode</label>
        <p style="color:var(--muted); font-size:12.5px; margin:0 0 12px; line-height:1.55;">
          For a television or a remote control: wider focus rings, a margin for the edges of the screen, and still tiles instead of moving previews.
          <strong style="color:var(--text); font-weight:700;">Auto</strong> (the default) turns it on when the screen has no mouse-style pointer and no touch.
          Saved only in this browser.
        </p>
        <div class="theme-toggle" role="radiogroup" aria-label="TV mode">${opt('auto', 'Auto')}${opt('on', 'On')}${opt('off', 'Off')}</div>
        <p id="gk-tv-status" role="status" style="color:var(--muted); font-size:12.5px; margin:12px 0 0; line-height:1.55;"></p>
        <p style="color:var(--muted); font-size:12px; margin:6px 0 0; line-height:1.55;">Tile previews follow the new choice from the next page load.</p>
      </section>`;
    /* On the section, not the panel: settings-config.js moves the section into Configurations. */
    p.querySelector('section').addEventListener('click', e => {
      const o = e.target.closest('[data-tv-opt]'); if (o) { setTv(o.dataset.tvOpt); return; }
    });
    panels.appendChild(p);
    syncDisplayUI();
  }

  /* ------------------------------------------------------------ expose */

  registerActions();
  if (!registered) window.addEventListener('gnw-actions-ready', registerActions, { once: true });

  window.GnwKeys = {
    BUILD, historyBack, isBack, topLayer: () => { const t = topLayer(); return t ? t.el : null; },
    openPause, closePause: pauseResume, playVideoId, setTv, applyTv, subClosed, guideFromSettings,
    /* Game help (2026-10-04, shortcuts.js): pause or resume a play window by its own controls
       (true = this call changed it), what its pause menu offers, and the window under the menu. */
    gamePause(ov, on) { if (!isOpen(ov) || !isPlay(ov)) return false; try { return !!adapterFor(ov).pause(!!on); } catch (_) { return false; } },
    gameHas(ov) { if (!isOpen(ov) || !isPlay(ov)) return {}; try { const ad = adapterFor(ov); return { controls: !!ad.controls, saves: !!ad.saves }; } catch (_) { return {}; } },
    pausedWindow: () => (P ? P.ov : null),
    _stack: () => stack.map(r => ({ id: r.el.id || r.el.className, opener: r.opener && (r.opener.id || r.opener.className), sel: r.sel })),
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

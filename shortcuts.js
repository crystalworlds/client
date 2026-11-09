/*
 * shortcuts.js -- keyboard first, phase 3: "speed and discoverability" (2026-10-04).
 *
 * The design is docs/tv-controller-support.md, sections 4, 5.2, 5.3, 5.7 and
 * 7 (phase 3). Every key here is a named action in actions.js; this file adds:
 *
 *   QUICK JUMP. `/` or Ctrl+K, or the Search button in the nav bar (mouse, TV).
 *   One box over everything: Continue items, titles (films, shows, games),
 *   systems, libraries, pages, settings and actions, each action with its key
 *   shown beside it. Empty, it lists the Continue items, the last five places
 *   jumped to, and the pages -- so a remote needs no typing. Up/Down move,
 *   Enter goes (Shift+Enter on a title plays it), Back closes. It is a layer
 *   like any other (keys.js: focus in and back, page behind inert, history
 *   Back closes it).
 *
 *   ? lists the keys, built from the action table: "This screen" first, then
 *   "Everywhere", then the other screens. Back closes it.
 *
 *   g THEN A LETTER: g h Home, g e Features, g m Media, g t Timeline, g a About, g s
 *   Settings, g c the Continue row (turned on if it was off), g f the search
 *   box. Never while typing, never with a game or the player in front.
 *
 *   FOCUS MODE (Z, or Settings -> Display): the Media page without its toolbar
 *   and library strip. Up past the top row, or Back, brings them back.
 *
 *   [ and ] step through the libraries, or through the game systems when the
 *   page shows games only.
 *
 * KEYS P4 (2026-10-04): ? and quick jump show a gamepad's buttons ('Pad:A',
 * gamepad.js) beside the keys, as rounded caps after at most three keys.
 *
 * GAME HELP (2026-10-04): ? (or the pad's R3, or a remote's Blue key) in a play
 * window opens the help over the game, paused: that game's controls with the
 * viewer's own keys and pad buttons, and the window's keys. See "? over a game".
 *
 * Principles kept: a text field owns its keys (P8), a running game owns its
 * keys (P7), Back is one step (P4), the mouse keeps everything (P6).
 * SOUND: none. Nothing here plays, previews or mounts a tile.
 */
(function () {
  'use strict';
  if (window.GnwShortcuts) return;

  const BUILD = '20261004-sc5';
  const A = () => window.Actions || null;
  const K = () => window.GnwKeys || null;
  const topEl = () => { const k = K(); return k && k.topLayer ? k.topLayer() : null; };
  const QUICK_ID = 'gk-quick', HELP_ID = 'gk-help';
  const GAME_LAYERS = new Set(['gk-pause', 'play-overlay', 'pm-play-overlay', 'gb-play-overlay', 'nes-play-overlay', 'atari-play-overlay', 'tft-play-overlay', 'tj-play-overlay']);
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };

  function isField(t) {
    if (!t || t.nodeType !== 1) return false;
    if (t.isContentEditable) return true;
    const tag = t.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag !== 'INPUT') return false;
    return !/^(button|checkbox|radio|range|color|file|submit|reset|image)$/i.test(t.type || 'text');
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function waitFor(fn, ms) {
    const end = Date.now() + (ms || 4000);
    for (;;) { let v = null; try { v = fn(); } catch (_) {} if (v) return v; if (Date.now() > end) return null; await sleep(60); }
  }
  const visible = el => !!el && el.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const activeView = () => document.querySelector('main .view.active') || document.querySelector('.view.active');
  const onMedia = () => { const v = activeView(); return !!v && v.id === 'view-media'; };
  const go = path => { if (typeof window.route === 'function') window.route(path); else location.hash = path; };
  const signedIn = () => { try { return !!(window.Emby && window.Emby.session && window.Emby.session.active); } catch (_) { return false; } };

  /* ------------------------------------------------------------ a small status chip (the g hint, [ ] feedback) */

  let chipT = 0;
  function chip(html, ms) {
    let c = document.getElementById('gk-chip');
    if (!c) {
      c = document.createElement('div');
      c.id = 'gk-chip'; c.setAttribute('role', 'status'); c.setAttribute('aria-live', 'polite');
      document.body.appendChild(c);
    }
    c.innerHTML = html;
    c.classList.add('show');
    clearTimeout(chipT);
    chipT = setTimeout(() => c.classList.remove('show'), ms || 1800);
  }
  const hideChip = () => { const c = document.getElementById('gk-chip'); if (c) c.classList.remove('show'); clearTimeout(chipT); };

  /* ------------------------------------------------------------ focus mode */

  const FM_KEY = 'gnw.focusMode';
  const fmOn = () => document.body.classList.contains('gk-focus');
  function setFocusMode(on, opts) {
    on = !!on;
    try { if (on) localStorage.setItem(FM_KEY, '1'); else localStorage.removeItem(FM_KEY); } catch (_) {}
    if (on === fmOn()) { syncDisplayUI(); return false; }
    // Focus on something that is about to be hidden goes to the grid first.
    const a = document.activeElement;
    document.body.classList.toggle('gk-focus', on);
    if (on && a && a !== document.body && !visible(a) && window.GnwNav) { window.GnwNav.focusZone('continue') || window.GnwNav.focusZone('grid'); }
    if (!(opts && opts.quiet)) chip(on ? 'Focus mode on <span class="gk-chip-dim">· Up past the top row or Back brings the toolbar back</span>' : 'Focus mode off', 2200);
    syncDisplayUI();
    try { window.dispatchEvent(new Event('resize')); } catch (_) {}      // the stacked grid measures again
    return true;
  }
  // nav.js asks before it leaves the Media page's top row for the nav bar.
  function revealAbove() { if (!fmOn() || !onMedia()) return false; setFocusMode(false, { quiet: true }); return true; }

  /* ------------------------------------------------------------ the wall: Movies and Widgets (X, Y, O, W) */

  /* NOTHING ON TOP (5 Nov): the content page with no drawer, menu, page, Settings, System Switcher,
     player or play window over it, and no text field being typed in. Only then do the controller's
     X and Y and the keys O and W switch Movies and Widgets; everywhere else they keep their meaning. */
  function wallFree() {
    if (!onMedia() || topEl()) return false;
    if (isField(document.activeElement)) return false;
    try {
      if (window.GnwSwitcher && window.GnwSwitcher.isOpen()) return false;
      if (window.CwAboutWindow && window.CwAboutWindow.isOpen()) return false;
      if (window.Emby && window.Emby.systemsMenuOpen && window.Emby.systemsMenuOpen()) return false;
      if (document.querySelector('#view-media .vtb-menu:not([hidden]), .overlay.open')) return false;
    } catch (_) {}
    return true;
  }
  /* The Systems menu's own switch by another route (Emby.wallToggle), with a short note. The wall goes
     to its top as it does from the menu, so a highlight on a tile moves to the new wall's first tile. */
  function wallToggle(key) {
    if (!wallFree()) return false;
    const E = window.Emby, name = key === 'media' ? 'Movies' : 'Widgets';
    if (!E || !E.wallToggle) return false;
    const a = document.activeElement;
    const r = E.wallToggle(key);
    if (!r.ok) { chip(name + ': sign in to a media server first', 2200); return true; }
    chip(name + ' ' + (r.on ? 'on' : 'off'), 1800);
    if (!a || a === document.body || (a.closest && a.closest('.video-card, .device-card'))) landOnWall(a);
    return true;
  }

  /* ------------------------------------------------------------ [ and ]: libraries, or systems */

  function mediaShown() { const b = document.querySelector('#view-media [data-vshow="media"]'); return !!b && b.classList.contains('active') && !b.disabled; }
  function systemKeys() {
    // One tile per system in the Games menu's 2 x 6 grid (2026-10-07): the tile carries the key and its name.
    // A system left out of the menu (Settings > Hide systems with no games, 4 Nov) is left out here too.
    const rows = Array.from(document.querySelectorAll('#view-media .vgames-menu .vgtile[data-vg-pick]')).filter(b => !b.closest('.vgcell[hidden]')).map(b => ({ b, n: b.querySelector('b') }));
    if (rows.length) return rows.map(x => ({ key: x.b.dataset.vgPick, label: (x.n || x.b).textContent.trim() || x.b.dataset.vgPick }));
    return SYSTEMS.slice();
  }
  const SYSTEMS = [
    { key: 'gnw', label: 'Game & Watch' }, { key: 'gb', label: 'Game Boy' }, { key: 'gbc', label: 'Game Boy Color' }, { key: 'pm', label: 'Pokémon Mini' },
    { key: 'nes', label: 'NES' }, { key: 'famicom', label: 'Famicom' }, { key: 'fds', label: 'Famicom Disk System' },
    { key: 'a2600', label: 'Atari 2600' }, { key: 'a5200', label: 'Atari 5200' }, { key: 'a7800', label: 'Atari 7800' }, { key: 'alynx', label: 'Atari Lynx' },
  ];
  /* [ and ]: the film and series libraries ONLY (31 Oct: one key, one meaning). With films and series
     hidden, or one library, there is nothing to step: a short note says so, and the system never changes. */
  function stepLibrary(dir) {
    if (!onMedia()) return false;
    const libs = Array.from(document.querySelectorAll('#video-cat-row .video-cat-btn'));
    if (!(mediaShown() && libs.length > 1)) { chip(mediaShown() ? 'Only one library' : 'No libraries: films and series are not shown', 1600); return true; }
    const i = libs.findIndex(b => b.classList.contains('active'));
    const n = libs[((i < 0 ? 0 : i) + dir + libs.length) % libs.length];
    const hadFocus = libs.includes(document.activeElement);
    n.click();
    if (hadFocus) { try { n.focus({ preventScroll: true }); } catch (_) {} }
    try { n.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }); } catch (_) {}
    chip('Library: <b>' + esc(n.getAttribute('aria-label') || n.textContent.trim()) + '</b>');
    return true;
  }
  /* , and . and the pad's LB / RB: the System Switcher ONLY (31 Oct), with films and series shown or
     not. The switcher's own behaviour is unchanged (system-switcher.js: one press one system, held
     repeats after 0.45 s, then about four a second). */
  function stepSection(dir, repeat) {   // repeat: a held shoulder or key
    if (!onMedia()) return false;
    // All systems, then each system in the Games menu's order.
    if (!window.Emby || typeof window.Emby.selectGameSystems !== 'function') return false;
    const sys = systemKeys();
    const on = Array.from(document.querySelectorAll('#view-media .vgames-menu .vgtile[data-vg-pick]'));
    const act = on.filter(b => b.classList.contains('active')).map(b => b.dataset.vgPick);
    /* THE SYSTEM SWITCHER (30 Oct, system-switcher.js): the steps are shown in its panel, from the
       same start, over the same systems in the same order; it keeps the second and applies the
       choice through stepApply below. Without it, the announced steps below. */
    if (window.GnwSwitcher && window.GnwSwitcher.step(dir, {
      sys, start: act.length === 1 ? sys.findIndex(s => s.key === act[0]) : -1,
      allNow: !!document.querySelector('#view-media .vggrid.is-all'),
      apply: (si, a) => { if (onMedia()) stepApply(sys, si, a, true); },
    }, !!repeat)) return true;
    if (repeat) return true;
    /* ONE SECOND BEFORE THE SWITCH (29 Oct: "wait 1 second before actually switching, so users can
       step to the right system before the request is sent"). Each press moves the announced choice
       and starts the second again; only the last choice is applied. The next press steps from the
       announced choice, not from what the wall still shows. */
    let i = stepPend ? stepPend.i : act.length === 1 ? sys.findIndex(s => s.key === act[0]) : -1;   // -1 = all
    i += dir;
    if (i >= sys.length) i = -1;
    if (i < -1) i = sys.length - 1;
    if (stepPend) clearTimeout(stepPend.t);
    const a0 = stepPend ? stepPend.a : document.activeElement;
    stepPend = { i, a: a0, t: setTimeout(() => { const p = stepPend; stepPend = null; if (p && onMedia()) stepApply(sys, p.i, p.a); }, 1000) };
    chip('Systems: <b>' + esc(i === -1 ? 'All systems' : sys[i].label) + '</b> <span class="gk-chip-dim">· in a moment</span>', 1600);
    return true;
  }
  let stepPend = null;   // { i, a, t }: the announced choice waiting for its second
  function stepApply(sys, i, a, quiet) {   // quiet: the System Switcher has shown the choice
    /* APPLIED AT ONCE (29 Oct: the shoulders "change the system in the menu but it isn't applied,
       only announced; it applies after a refresh"). selectGameSystems is the pick from outside the
       page and leaves the drawing to the navigation that follows it; here nothing follows, so the
       Media page's own pick is used: the wall is drawn again and goes to the top, as a press in the
       Systems menu does. The focus lands on the new wall's first tile once it is drawn. */
    const keys = i === -1 ? sys.map(s => s.key) : [sys[i].key];
    const pick = window.Emby.pickGameSystems || window.Emby.selectGameSystems;
    pick(keys);
    landOnWall(a);
    if (!quiet) chip('Systems: <b>' + esc(i === -1 ? 'All systems' : sys[i].label) + '</b>');
    return true;
  }
  /* THE FOCUS LANDS ON THE NEW WALL (31 Oct: "The Down, Up and Right buttons on the controller don't
     work after I change systems using the Systems menu. I need to press Left to get a selection on
     the main grid again"). After any system change (the Systems menu's pick, the System Switcher,
     the shoulders) the focus goes to the new wall's first tile, wherever it was before (a tile, the
     Systems tab, the search bar), so every D-pad direction works at once. It used to land only
     when it had been on the wall; the menu left it on the Systems tab at the right edge, where only
     Left goes anywhere. The new wall is drawn when its lists are in (a moment, or a second or two):
     until then the old tile keeps the focus or the focus is lost with it. Looked at every 150 ms
     for 5 s; a person who moves on in that time keeps their own focus. `a` = where the focus was
     when the change was asked for. */
  function landOnWall(a) {
    if (!(window.GnwNav && window.GnwNav.zoneItems)) return;
    const t0 = performance.now(); let landed = null;
    const land = () => {
      if (!onMedia() || topEl()) return;                                   // a page or a layer took over
      const c = document.activeElement;
      if (c && c !== document.body && c.isConnected && c !== a && c !== landed) return;   // the person moved on
      if (!(c && c !== document.body && c.isConnected && c === landed)) {
        const t = window.GnwNav.zoneItems('grid')[0];
        // The old tile may still be the first one: with the focus lost in the redraw it takes it back (5 Nov).
        if (t && (t !== a || !c || c === document.body || !c.isConnected)) { try { t.focus({ preventScroll: true }); } catch (_) {} if (document.activeElement === t) landed = t; }
      }
      if (performance.now() - t0 < 5000) setTimeout(land, 150);
    };
    setTimeout(land, 150);
  }

  /* ------------------------------------------------------------ g jumps */

  async function focusContinue() {
    if (!onMedia()) go('/media');
    const C = window.ContinueRow;
    if (C && typeof C.enabled === 'function' && !C.enabled()) C.setEnabled(true);
    const card = await waitFor(() => { const c = document.querySelector('#video-continue [data-cr-open]'); return c && visible(c) ? c : null; }, 6000);
    if (!card) { chip('Nothing to continue yet'); return; }
    if (!(window.GnwNav && window.GnwNav.focusZone('continue'))) card.focus();
  }
  async function focusSearch() {
    if (fmOn()) setFocusMode(false, { quiet: true });
    if (!onMedia()) go('/media');
    const s = await waitFor(() => { const x = document.getElementById('video-search'); return x && visible(x) ? x : null; }, 6000);
    // "Go to the search box" is asking to type: the box starts in its typing state (emby.js, 2026-10-18).
    if (s) { s.focus(); try { if (window.GnwMediaSearch) window.GnwMediaSearch.edit(); } catch (_) {} try { s.select(); } catch (_) {} }
  }
  /* The search keys (quick.open): over ? or an old quick-jump box, close it first; over anything
     else (a drawer, Settings, the player) they do nothing, as before. */
  function searchKey() {
    const top = topEl();
    if (top && top.id === HELP_ID && !GH) closeLayer(HELP_ID);
    else if (top && top.id === QUICK_ID) closeLayer(QUICK_ID);
    else if (top && top.id === SETTINGS_ID) closeSettings();       // 4 Nov: over Settings too, it steps aside
    else if (top) return false;
    focusSearch();
    return true;
  }
  function openSettings() { if (typeof window.openVaultModal === 'function') window.openVaultModal(); }
  /* SETTINGS IS NO WALL FOR THE g PANEL OR THE SEARCH KEYS (4 Nov: "with Settings open, the G menu (g
     then a letter) and the search keys (g f, /) do nothing"). Over Settings, g shows its panel above it,
     and the key after it closes Settings and goes where it says (g s leaves Settings open as it is);
     / and the other search keys close Settings and put the caret in the search box. Escape is unchanged:
     with the panel up it only ends the sequence, otherwise it closes Settings. A text field in Settings
     keeps its own keys. */
  const SETTINGS_ID = 'vault-overlay';
  const overSettings = top => !!top && top.id === SETTINGS_ID;
  function closeSettings() { try { if (typeof window.closeOverlay === 'function') window.closeOverlay(SETTINGS_ID); } catch (_) {} }

  /* ------------------------------------------------------------ styles */

  function ensureStyles() {
    if (document.getElementById('gk-sc-style')) return;
    const st = document.createElement('style');
    st.id = 'gk-sc-style';
    st.textContent = `
      .gq-overlay.overlay { z-index:450; padding:0; }
      .gq-overlay.open { display:flex; align-items:flex-start; justify-content:center; }
      .gq-box { width:min(680px, calc(100vw - 32px)); margin-top:10vh; background:var(--bg-2,#151a24); color:var(--text,#e7ecf2);
        border:1px solid var(--line,#2a3342); border-radius:16px; box-shadow:0 24px 70px rgba(0,0,0,.6); overflow:hidden; }
      :root[data-theme="light"] .gq-box { background:#fff; }
      .gq-field { display:flex; align-items:center; gap:10px; padding:12px 16px; border-bottom:1px solid var(--line,#2a3342); }
      .gq-field svg { flex:0 0 auto; color:var(--muted,#9aa4b2); }
      .gq-field input { flex:1 1 auto; min-width:0; background:transparent; border:0; outline:0; color:inherit; font:inherit; font-size:17px; padding:6px 0; }
      .gq-field:focus-within { box-shadow: inset 0 -2px 0 var(--focus-ring,#5dc8f0); }
      .gq-list { max-height:min(60vh, 560px); overflow-y:auto; padding:6px 0 8px; overscroll-behavior:contain; }
      .gq-sec { padding:10px 16px 4px; font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:var(--muted,#9aa4b2); }
      .gq-opt { display:flex; align-items:center; gap:12px; padding:9px 16px; cursor:pointer; border-left:3px solid transparent; }
      .gq-opt[aria-selected="true"] { background:rgba(var(--accent-rgb,155,225,93),.14); border-left-color:var(--focus-ring,#5dc8f0); }
      .gq-main { flex:1 1 auto; min-width:0; }
      .gq-label { display:block; font-size:14.5px; font-weight:650; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .gq-sub { display:block; font-size:12px; color:var(--muted,#9aa4b2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .gq-keys { flex:0 0 auto; display:flex; gap:4px; align-items:center; color:var(--muted,#9aa4b2); font-size:12px; }
      .gq-overlay kbd { display:inline-block; min-width:1.6em; padding:2px 6px; border:1px solid var(--line,#2a3342); border-bottom-width:2px; border-radius:6px;
        font:600 12px/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color:var(--text,#e7ecf2); background:rgba(255,255,255,.04); text-align:center; }
      :root[data-theme="light"] .gq-overlay kbd { background:rgba(0,0,0,.03); }
      .gq-overlay kbd.gk-padkey { border-radius:999px; border-color:rgba(var(--accent-rgb,155,225,93),.45); }
      .gq-empty { padding:16px; color:var(--muted,#9aa4b2); font-size:13.5px; }
      .gq-foot { display:flex; flex-wrap:wrap; gap:6px 14px; padding:9px 16px; border-top:1px solid var(--line,#2a3342); color:var(--muted,#9aa4b2); font-size:12px; }
      .gq-help .gq-box { width:min(980px, calc(100vw - 32px)); margin-top:6vh; }
      .gq-help-head { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 18px; border-bottom:1px solid var(--line,#2a3342); }
      .gq-help-head h2 { margin:0; font-size:16px; letter-spacing:.02em; }
      .gq-help-close { appearance:none; border:1px solid var(--line,#2a3342); background:transparent; color:inherit; border-radius:9px; padding:6px 12px; font:inherit; font-size:13px; cursor:pointer; }
      .gq-help-body { max-height:min(74vh, 760px); overflow-y:auto; padding:6px 18px 18px; display:grid; grid-template-columns:1fr 1fr; gap:0 28px; outline:0; }
      /* No ring on the list itself (31 Oct: "The entire keyboard shortcuts window gets highlighted like
         it's selected ... there is nothing there to select"). It keeps the focus so keys and the pad scroll it. */
      .gq-help-body:focus-visible { box-shadow: none; }
      .gq-help-col h3 { margin:16px 0 6px; font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:var(--muted,#9aa4b2); }
      .gq-help-col h4 { margin:12px 0 4px; font-size:13px; }
      .gq-help-row { display:flex; justify-content:space-between; gap:12px; padding:5px 0; border-bottom:1px dashed rgba(127,127,127,.18); font-size:13.5px; }
      .gq-help-row .gq-keys { justify-content:flex-end; flex-wrap:wrap; }
      .gq-help-other { grid-column:1 / -1; }
      .gq-help-other .gq-help-cols { display:grid; grid-template-columns:1fr 1fr; gap:0 28px; }
      /* UP AND DOWN ONLY (1 Nov: "must never scroll left to right"). A long key list
         ("Esc / Backspace / Back / Pad Home / Pad Select+Start", 385 px) did not shrink, so on a
         phone the list was 466 px wide in a 390 px window. Now the keys may shrink and wrap onto more
         lines under their own end, the action's name wraps, every column may be narrower than its
         longest line, and the list never scrolls sideways. */
      .gq-help-body { overflow-x:hidden; }
      .gq-help-body, .gq-help-col, .gq-help-other, .gq-help-other .gq-help-cols { min-width:0; }
      .gq-help-body { grid-template-columns:minmax(0,1fr) minmax(0,1fr); }
      .gq-help-other .gq-help-cols { grid-template-columns:minmax(0,1fr) minmax(0,1fr); }
      .gq-help-row { flex-wrap:wrap; row-gap:4px; }
      .gq-help-row > span:first-child { flex:1 1 11em; min-width:0; overflow-wrap:break-word; }
      .gq-help-row .gq-keys { flex:0 1 auto; min-width:0; max-width:100%; margin-left:auto; row-gap:4px; }
      .gq-help-row .gq-keys kbd, .gq-help-row .gq-keys .gk-padkey { white-space:nowrap; }
      @media (max-width:720px) { .gq-help-body, .gq-help-other .gq-help-cols { grid-template-columns:1fr; } }
      /* FULL SCREEN ON A SMALL SCREEN, like Settings (24 Oct; the same 760 px wide or 500 px
         tall rule as settings-ui.js): the sheet fills the screen, its head stays at the top, the list scrolls. */
      /* 31 Oct: by html.cw-small, the pages' and Settings' own small-device rule (settings-ui.js
         gnwSmall: the same sizes OR a phone, a fold or a small tablet either way up), so an open fold in
         landscape gets it too. Quick jump fills the screen the same way. */
      html.cw-small .gq-overlay.open { align-items:stretch; }
      html.cw-small .gq-box, html.cw-small .gq-help .gq-box { width:100vw; height:100vh; height:100dvh; margin:0; border:0; border-radius:0; display:flex; flex-direction:column; box-shadow:none; }
      html.cw-small .gq-field { padding-top:max(12px, env(safe-area-inset-top)); }
      html.cw-small .gq-list { flex:1 1 auto; max-height:none; }
      html.cw-small .gq-help-head { padding:max(8px, env(safe-area-inset-top)) 12px 8px 16px; }
      html.cw-small .gq-help-close { min-width:44px; min-height:44px; }
      html.cw-small .gq-help-body { flex:1 1 auto; max-height:none; padding:6px 16px max(18px, env(safe-area-inset-bottom)); overscroll-behavior:contain; }
      html.cw-small .gq-foot { padding-bottom:max(9px, env(safe-area-inset-bottom)); }
      .gq-quick-close { display:none; }
      html.cw-small .gq-quick-close { display:inline-flex; align-items:center; justify-content:center; padding:0; font-size:24px; line-height:1; flex:0 0 auto; }
      body.gnw-tv .gq-field input { font-size:22px; }
      body.gnw-tv .gq-label { font-size:18px; }
      body.gnw-tv .gq-sub, body.gnw-tv .gq-help-row { font-size:15px; }
      body.gnw-tv .gq-opt { padding:12px 18px; }
      .nav-link.nav-jump { display:inline-flex; align-items:center; gap:6px; }
      #gk-chip { position:fixed; left:50%; bottom:max(28px, 5vh); transform:translate(-50%, 12px); z-index:460; pointer-events:none; opacity:0;
        background:var(--bg-2,#151a24); color:var(--text,#e7ecf2); border:1px solid var(--line,#2a3342); border-radius:999px; padding:9px 16px;
        font-size:13.5px; box-shadow:0 10px 30px rgba(0,0,0,.45); transition:opacity .15s ease, transform .15s ease; }
      #gk-chip.show { opacity:1; transform:translate(-50%, 0); }
      #gk-chip kbd { font:600 12px ui-monospace, Consolas, monospace; border:1px solid var(--line,#2a3342); border-radius:5px; padding:1px 5px; margin:0 2px; }
      .gk-chip-dim { color:var(--muted,#9aa4b2); }
      body.gnw-tv #gk-chip { font-size:17px; padding:12px 20px; }
      @media (prefers-reduced-motion: reduce) { #gk-chip { transition:none; } }
      /* The g panel (31 Oct): the second keys after g, one per line, for 5 s. */
      #gk-goto { position:fixed; left:50%; bottom:max(28px, 5vh); transform:translate(-50%, 12px); z-index:461; pointer-events:none; opacity:0;
        max-width:calc(100vw - 32px); max-height:calc(100vh - 56px); overflow:hidden; box-sizing:border-box;
        background:var(--bg-2,#151a24); color:var(--text,#e7ecf2); border:1px solid var(--line,#2a3342); border-radius:14px; padding:12px 16px 12px;
        font-size:13.5px; box-shadow:0 10px 30px rgba(0,0,0,.45); transition:opacity .15s ease, transform .15s ease; }
      #gk-goto.show { opacity:1; transform:translate(-50%, 0); }
      #gk-goto .gk-goto-h { margin:0 0 8px; font-size:11px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:var(--muted,#9aa4b2); }
      #gk-goto ul { list-style:none; margin:0; padding:0; display:grid; grid-template-columns:auto auto; gap:6px 18px; }
      #gk-goto li { display:flex; align-items:center; gap:9px; white-space:nowrap; }
      #gk-goto kbd { font:600 12px ui-monospace, Consolas, monospace; border:1px solid var(--line,#2a3342); border-radius:5px; padding:1px 6px; min-width:1.2em; text-align:center; }
      #gk-goto .gk-goto-bar { height:2px; margin-top:10px; background:var(--accent,#9be15d); opacity:.6; transform-origin:left; }
      #gk-goto.show .gk-goto-bar { animation:gk-goto-time var(--gk-goto-ms,5000ms) linear forwards; }
      @keyframes gk-goto-time { from { transform:scaleX(1); } to { transform:scaleX(0); } }
      @media (max-width:420px) { #gk-goto ul { grid-template-columns:auto; } }
      body.gnw-tv #gk-goto { font-size:17px; padding:16px 22px; }
      body.gnw-tv #gk-goto kbd { font-size:15px; }
      @media (prefers-reduced-motion: reduce) { #gk-goto { transition:none; } #gk-goto.show .gk-goto-bar { animation:none; } }
      /* FOCUS MODE: the Media page without its toolbar and library strip. */
      body.gk-focus #view-media .collection-toolbar,
      body.gk-focus #view-media #video-library { display:none !important; }
      .gk-focus-pill { display:none; }
      body.gk-focus #view-media .gk-focus-pill { display:inline-flex; align-items:center; gap:8px; margin:0 0 10px; appearance:none; cursor:pointer;
        border:1px solid var(--line,#2a3342); background:transparent; color:var(--muted,#9aa4b2); border-radius:999px; padding:5px 12px; font:inherit; font-size:12.5px; }
      body.gk-focus #view-media .gk-focus-pill:hover { color:var(--text,#e7ecf2); }
      /* THE KEYS PAGE (4 Nov, pageHTML): sections in two columns on a wide window, one on a narrow
         one; in each row what it does, then its keyboard keys and its controller buttons side by side. */
      .gq-help-body.ks-body { display:block; padding:2px 22px 22px; }
      .gq-help .gq-box.ks-box { width:min(1180px, calc(100vw - 32px)); }
      .ks-arrows { display:inline-flex; gap:3px; }
      html.cw-small .gq-help-body.ks-body { padding:2px 16px max(18px, env(safe-area-inset-bottom)); }
      .ks-page { color:var(--text,#e7ecf2); }
      .ks-title { margin:2px 0 4px; font-size:22px; line-height:1.25; }
      .ks-intro { margin:12px 0 2px; max-width:72ch; color:var(--muted,#9aa4b2); font-size:13.5px; line-height:1.55; }
      .ks-cols { columns:2 440px; column-gap:36px; }
      .ks-sec { break-inside:avoid; padding:18px 0 4px; }
      .ks-sec h3 { display:flex; align-items:center; gap:9px; margin:0 0 4px; font-size:15.5px; font-weight:750; letter-spacing:.01em; color:var(--text,#e7ecf2); text-transform:none; }
      .ks-sec h3::before { content:''; flex:0 0 auto; width:4px; height:1.05em; border-radius:2px; background:var(--accent,#9be15d); }
      .ks-line { margin:0 0 8px; color:var(--muted,#9aa4b2); font-size:13px; line-height:1.5; }
      .ks-text { margin:0 0 9px; font-size:13.5px; line-height:1.6; }
      .ks-row { display:grid; grid-template-columns:minmax(0,1fr) 9.8em 9.4em; gap:4px 12px; align-items:center; padding:6px 0; border-bottom:1px dashed rgba(127,127,127,.2); font-size:13.5px; line-height:1.4; }
      .ks-row.ks-wide { grid-template-columns:9.4em minmax(0,1fr); }
      .ks-row.ks-head { padding:2px 0 4px; border-bottom:1px solid var(--line,#2a3342); font-size:10.5px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:var(--muted,#9aa4b2); }
      .ks-what { min-width:0; overflow-wrap:break-word; }
      .ks-cell { display:flex; flex-wrap:wrap; align-items:center; gap:4px; min-width:0; }
      .ks-or, .ks-then { color:var(--muted,#9aa4b2); font-size:11.5px; }
      .ks-page kbd { display:inline-block; min-width:1.6em; padding:2px 7px; border:1px solid var(--line,#2a3342); border-bottom-width:2px; border-radius:6px; white-space:nowrap;
        font:600 12px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color:var(--text,#e7ecf2); background:rgba(255,255,255,.05); text-align:center; }
      .ks-page kbd.ks-pad { border-radius:999px; border-color:rgba(var(--accent-rgb,155,225,93),.55); font-family:inherit; font-weight:700; }
      .ks-page kbd.ks-rc { font-family:inherit; font-weight:700; }
      .ks-page kbd.ks-rc::before { content:none; }
      .ks-page kbd[class*="ks-rc-"]::before { content:''; display:inline-block; width:.62em; height:.62em; margin-right:5px; border-radius:50%; vertical-align:-.02em; }
      .ks-page kbd.ks-rc-red::before { background:#e5484d; } .ks-page kbd.ks-rc-green::before { background:#30a46c; }
      .ks-page kbd.ks-rc-yellow::before { background:#f5d90a; } .ks-page kbd.ks-rc-blue::before { background:#3e8ef7; }
      :root[data-theme="light"] .ks-page kbd { background:rgba(0,0,0,.035); }
      /* Narrow: what it does across the row, its keyboard keys under it on the left and its controller
         buttons on the right, under the section's Keyboard and Controller heads. */
      @media (max-width:600px) {
        .ks-row { grid-template-columns:minmax(0,1fr) minmax(0,1fr); padding:7px 0; }
        .ks-row > .ks-what { grid-column:1 / -1; }
        .ks-row.ks-head > .ks-what { display:none; }
        .ks-row.ks-wide { grid-template-columns:8.6em minmax(0,1fr); }
        .ks-row.ks-wide > .ks-what { grid-column:auto; }
      }
      body.gnw-tv .ks-page { font-size:17px; }
      body.gnw-tv .ks-row:not(.ks-head), body.gnw-tv .ks-text { font-size:16px; }
      body.gnw-tv .ks-row.ks-head { font-size:12px; }
      body.gnw-tv .ks-line, body.gnw-tv .ks-intro { font-size:15px; }
      body.gnw-tv .ks-sec h3 { font-size:19px; }
      body.gnw-tv .ks-page kbd { font-size:14px; }
      body.gnw-tv .ks-row:not(.ks-wide) { grid-template-columns:minmax(0,1fr) 9.4em 9em; }
      @media (max-width:600px) { body.gnw-tv .ks-row:not(.ks-wide) { grid-template-columns:minmax(0,1fr) minmax(0,1fr); } }
    `;
    document.head.appendChild(st);
  }
  const ICON_SEARCH = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>';
  const isPad = k => k.slice(0, 4) === 'Pad:';
  const kbds = key => {
    const F = A(); if (!F) return '';
    if (isPad(key)) return '<kbd class="gk-padkey">' + esc(F.format(key)) + '</kbd>';
    if (key.indexOf(' ') > 0) return key.split(' ').map(p => '<kbd>' + esc(F.format(p)) + '</kbd>').join('<span aria-hidden="true">then</span>');
    return '<kbd>' + esc(F.format(key)) + '</kbd>';
  };
  // Up to three keyboard/remote keys, then the gamepad's buttons (Keys P4), which are never cut off by the keys.
  const keysHTML = keys => { const F = A(); if (!F || !keys || !keys.length) return ''; const s = F.shownKeys(keys); return s.filter(k => !isPad(k)).slice(0, 3).concat(s.filter(isPad).slice(0, 2)).map(kbds).join('<span aria-hidden="true">/</span>'); };

  /* ------------------------------------------------------------ layers of our own */

  function layer(id, cls, label) {
    let el = document.getElementById(id);
    if (el) return el;
    ensureStyles();
    el = document.createElement('div');
    el.id = id;
    el.className = 'overlay gq-overlay ' + (cls || '');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', label);
    document.body.appendChild(el);
    // The backdrop closes it, as every overlay's does.
    el.addEventListener('mousedown', e => { if (e.target === el) closeLayer(id); });
    // Back closes this layer only: stopped here, so a layer underneath (the player) never sees it.
    el.addEventListener('keydown', e => {
      const k = K();
      if (!k || !k.isBack || !k.isBack(e)) return;
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat) closeLayer(id);
    });
    return el;
  }
  function isOpenId(id) { const el = document.getElementById(id); return !!el && el.classList.contains('open'); }
  /* Opened over the page or an index.html overlay: through openOverlay, so it holds a
     history entry and history Back (a remote, a phone) closes it. Opened over one of
     emby.js's layers (the player, a video drawer), which keep their OWN history entry:
     no entry of ours, because giving it back would read to emby.js as Back and close
     the layer underneath too. Back keys close it either way (the handler in layer()). */
  const EMBY_LAYERS = '#video-player-overlay.open, #video-overlay.open, #video-info-overlay.open, #video-trailer-overlay.open';
  function openLayer(id) {
    const el = document.getElementById(id);
    if (typeof window.openOverlay === 'function' && !document.querySelector(EMBY_LAYERS)) { delete el.dataset.gqNoHist; window.openOverlay(id); return; }
    el.dataset.gqNoHist = '1';
    el.classList.add('open');
  }
  function closeLayer(id) {
    if (!isOpenId(id)) return;
    const el = document.getElementById(id);
    if (el.dataset.gqNoHist || typeof window.closeOverlay !== 'function') { delete el.dataset.gqNoHist; el.classList.remove('open'); return; }
    window.closeOverlay(id);
  }

  /* ------------------------------------------------------------ quick jump: the sources */

  const PAGES = [
    { label: 'Home', path: '/', act: 'go.home' },   // Media left out 31 Oct: it is the page everything opens over
    { label: 'Timeline', path: '/series', act: 'go.timeline' }, { label: 'About', path: '/about', act: 'go.about' },
    { label: 'Features', path: '/features', act: 'go.features' },   // 31 Oct
    { label: 'Settings', path: null, act: 'go.settings' },
  ];
  const CATALOGUE = { 'pokemon-mini': 'Pokémon Mini', 'game-boy': 'Game Boy', nes: 'NES' };
  function gameSystemLabel(d) {
    try {
      if (d.catalogue === 'game-boy') return d.system === 'gbc' ? 'Game Boy Color' : 'Game Boy';
      if (d.catalogue === 'nes' && typeof NES_CONSOLE_LABEL !== 'undefined') return NES_CONSOLE_LABEL[d.nesConsole || 'nes'] || 'NES';
      if (typeof ATARI_SYSTEMS !== 'undefined' && ATARI_SYSTEMS[d.catalogue]) return ATARI_SYSTEMS[d.catalogue].label;
    } catch (_) {}
    return CATALOGUE[d.catalogue] || 'Game & Watch';
  }
  function allGames() { try { return typeof ALL_DEVICES !== 'undefined' ? ALL_DEVICES : []; } catch (_) { return []; } }

  function score(text, q) {
    if (!q) return 1;
    const t = String(text || '').toLowerCase();
    const i = t.indexOf(q);
    if (i < 0) {
      // every word of the query somewhere in the text
      const words = q.split(/\s+/).filter(Boolean);
      return words.length > 1 && words.every(w => t.includes(w)) ? 0.3 : 0;
    }
    if (i === 0) return 3;
    if (/[\s\-–—:(·]/.test(t[i - 1])) return 2;
    return 1;
  }
  const best = (list, q, n) => list.map(x => [x, Math.max(score(x.label, q), score(x.keywords, q) * 0.9)]).filter(p => p[1] > 0)
    .sort((a, b) => b[1] - a[1]).slice(0, n).map(p => p[0]);

  function continueItems() {
    const cards = Array.from(document.querySelectorAll('#video-continue [data-cr-open]'));
    if (cards.length) {
      return cards.map(c => {
        const card = c.closest('.vcr-card') || c;
        const kind = (card.querySelector('.vcr-kind') || {}).textContent || 'Continue';
        const title = (card.querySelector('.vcr-title') || {}).textContent || c.getAttribute('aria-label') || '';
        const sub = (card.querySelector('.vcr-sub') || {}).textContent || '';
        return { kind: 'continue', key: c.dataset.crOpen, label: title.trim(), sub: (kind.trim() + (sub.trim() ? ' · ' + sub.trim() : '')) };
      });
    }
    return cachedGamesContinue;
  }
  let cachedGamesContinue = [];
  async function refreshGamesContinue() {
    try {
      const C = window.ContinueRow; if (!C || !C.list) return;
      const recs = (await C.list()).filter(r => !r.hidden).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 8);
      const byId = new Map(allGames().map(d => [d.id, d]));
      cachedGamesContinue = recs.map(r => { const d = byId.get(r.id); return { kind: 'continue', key: 'g:' + r.id, gameId: r.id, label: d ? d.name : r.id, sub: 'Continue Playing' + (d ? ' · ' + gameSystemLabel(d) : '') }; });
    } catch (_) {}
  }
  function libraryItems() {
    const btns = Array.from(document.querySelectorAll('#video-cat-row .video-cat-btn'));
    if (btns.length) return btns.map(b => ({ kind: 'library', id: b.dataset.libid, label: b.getAttribute('aria-label') || b.textContent.trim(), sub: 'Library' }));
    return cachedViews;
  }
  let cachedViews = [];
  async function refreshViews() {
    if (!signedIn() || !window.Emby.getViews) { cachedViews = []; return; }
    try { const v = await window.Emby.getViews(); cachedViews = (v || []).map(x => ({ kind: 'library', id: x.Id, label: x.Name, sub: 'Library' })); } catch (_) {}
  }
  function settingsItems() {
    const out = [];
    const tabs = Array.from(document.querySelectorAll('#vault-overlay .settings-tabs .settings-tab'));
    for (const t of tabs) {
      if (t.hidden || getComputedStyle(t).display === 'none') continue;
      const tab = t.dataset.tab, tabName = t.textContent.trim();
      out.push({ kind: 'setting', tab, sec: -1, label: tabName, sub: 'Settings', keywords: 'settings ' + tabName });
      const panel = document.querySelector('#vault-overlay .settings-panels > .settings-panel[data-panel="' + tab + '"]');
      if (!panel) continue;
      Array.from(panel.querySelectorAll('.vault-section')).forEach((s, i) => {
        if (s.style.display === 'none' || s.hidden) return;
        const h = s.querySelector('label, h3, h4');
        const name = h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
        if (!name || name.length > 48) return;
        out.push({ kind: 'setting', tab, sec: i, label: name, sub: 'Settings · ' + tabName, keywords: tabName + ' ' + name });
      });
    }
    out.push({ kind: 'action', id: 'help.open', label: 'Keyboard shortcuts', sub: 'Settings · Display', keywords: 'keys keyboard shortcuts help' });
    return out;
  }
  function actionItems() {
    const F = A(); if (!F) return [];
    return F.list().filter(a => a.palette && a.available).map(a => ({ kind: 'action', id: a.id, label: a.label, sub: a.group, keys: a.keys, keywords: a.group }));
  }
  function systemItems() { return systemKeys().map(s => ({ kind: 'system', key: s.key, label: s.label, sub: 'System · show only these games', keywords: 'system games' })); }
  function pageItems() { return PAGES.filter(p => !(window.__cwOffsite && /^go\.(home|timeline|about|features)$/.test(p.act))).map(p => ({ kind: 'page', path: p.path, act: p.act, label: p.label, sub: 'Page', keys: (A() && A().keysFor(p.act)) || [] })); }

  const RECENT_KEY = 'gnw.quick.recent';
  function recent() { try { const r = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(r) ? r.slice(0, 5) : []; } catch (_) { return []; } }
  function remember(it) {
    if (it.kind === 'continue' || it.kind === 'action') return;
    const keep = Object.assign({}, it); delete keep.keys; delete keep.score;
    const sig = JSON.stringify([keep.kind, keep.id, keep.key, keep.path, keep.tab, keep.sec, keep.vt]);
    try {
      const list = recent().filter(x => JSON.stringify([x.kind, x.id, x.key, x.path, x.tab, x.sec, x.vt]) !== sig);
      list.unshift(keep);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5)));
    } catch (_) {}
  }

  /* ------------------------------------------------------------ quick jump: the box */

  const Q = { el: null, input: null, list: null, items: [], sel: 0, videos: [], videoQ: null, timer: 0, seq: 0 };

  function buildQuick() {
    const el = layer(QUICK_ID, '', 'Quick jump');
    if (Q.el) return el;
    el.innerHTML = `<div class="gq-box">
        <div class="gq-field">${ICON_SEARCH.replace('14', '18').replace('14', '18')}
          <input id="gk-quick-input" type="text" role="combobox" aria-expanded="true" aria-controls="gk-quick-list" aria-autocomplete="list"
            aria-label="Jump to" placeholder="Jump to a title, system, library, page, setting or action…" autocomplete="off" spellcheck="false" enterkeyhint="go" inputmode="search">
          <button type="button" class="gq-help-close gq-quick-close" data-gq-close aria-label="Close">×</button>
        </div>
        <div class="gq-list" id="gk-quick-list" role="listbox" aria-label="Results"></div>
        <div class="gq-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> go</span><span><kbd>Shift+Enter</kbd> play a title</span><span><kbd>Esc</kbd> / Back close</span><span><kbd>?</kbd> all keys</span></div>
      </div>`;
    Q.el = el; Q.input = el.querySelector('input'); Q.list = el.querySelector('.gq-list');
    Q.input.addEventListener('input', () => { Q.sel = 0; render(); queueVideoSearch(); });
    Q.input.addEventListener('keydown', onQuickKey);
    el.querySelector('.gq-quick-close').addEventListener('click', () => closeLayer(QUICK_ID));   // full screen on a small device: a way out by touch
    Q.list.addEventListener('mousemove', e => { const o = e.target.closest('.gq-opt'); if (o) select(+o.dataset.i, false); });
    Q.list.addEventListener('click', e => { const o = e.target.closest('.gq-opt'); if (o) choose(Q.items[+o.dataset.i], e.shiftKey); });
    return el;
  }
  function onQuickKey(e) {
    const n = Q.items.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation();
      if (n) select((Q.sel + (e.key === 'ArrowDown' ? 1 : -1) + n) % n, true);
    } else if (e.key === 'PageDown' || e.key === 'PageUp') {
      e.preventDefault(); e.stopPropagation();
      if (n) select(Math.max(0, Math.min(n - 1, Q.sel + (e.key === 'PageDown' ? 6 : -6))), true);
    } else if (e.key === 'Enter') {
      e.preventDefault(); e.stopPropagation();
      if (n) choose(Q.items[Q.sel], e.shiftKey);
    } else if (e.key === '?' && !Q.input.value) {
      e.preventDefault(); e.stopPropagation();
      closeLayer(QUICK_ID); setTimeout(openHelp, 0);
    }
  }
  function select(i, scroll) {
    Q.sel = i;
    Q.list.querySelectorAll('.gq-opt').forEach(o => o.setAttribute('aria-selected', +o.dataset.i === i ? 'true' : 'false'));
    const o = Q.list.querySelector('.gq-opt[data-i="' + i + '"]');
    if (o) { Q.input.setAttribute('aria-activedescendant', o.id); if (scroll) o.scrollIntoView({ block: 'nearest' }); }
  }
  function sections(q) {
    const S = [];
    const add = (name, items) => { if (items.length) S.push([name, items]); };
    if (!q) {
      add('Continue', continueItems().slice(0, 8));
      add('Recent', recent());
      add('Pages', pageItems());
      return S;
    }
    add('Continue', best(continueItems(), q, 5));
    const games = best(allGames().map(d => ({ kind: 'title', vt: 'game', id: d.id, label: d.name, sub: gameSystemLabel(d), keywords: gameSystemLabel(d) })), q, 8);
    const vids = Q.videoQ === q ? Q.videos : [];
    add('Titles', vids.slice(0, 8).concat(games).slice(0, 12));
    add('Systems', best(systemItems(), q, 6));
    add('Libraries', best(libraryItems(), q, 6));
    add('Pages', best(pageItems(), q, 5));
    add('Settings', best(settingsItems(), q, 6));
    add('Actions', best(actionItems(), q, 8));
    return S;
  }
  function render() {
    const q = Q.input.value.trim().toLowerCase();
    const S = sections(q);
    Q.items = [];
    let html = '';
    for (const [name, items] of S) {
      html += '<div class="gq-sec" role="presentation">' + esc(name) + '</div>';
      for (const it of items) {
        const i = Q.items.length;
        Q.items.push(it);
        html += `<div class="gq-opt" role="option" id="gq-opt-${i}" data-i="${i}" data-kind="${esc(it.kind)}" aria-selected="false">`
          + `<span class="gq-main"><span class="gq-label">${esc(it.label)}</span>${it.sub ? `<span class="gq-sub">${esc(it.sub)}</span>` : ''}</span>`
          + (it.keys && it.keys.length ? `<span class="gq-keys">${keysHTML(it.keys)}</span>` : '') + '</div>';
      }
    }
    if (!Q.items.length) html = '<div class="gq-empty">' + (q ? 'Nothing matches “' + esc(Q.input.value.trim()) + '”.' : 'Type to search.') + '</div>';
    Q.list.innerHTML = html;
    if (Q.sel >= Q.items.length) Q.sel = 0;
    if (Q.items.length) select(Q.sel, false); else Q.input.removeAttribute('aria-activedescendant');
  }
  function queueVideoSearch() {
    clearTimeout(Q.timer);
    const q = Q.input.value.trim().toLowerCase();
    if (!q || !signedIn() || !window.Emby.getItems) { Q.videos = []; Q.videoQ = q; return; }
    const my = ++Q.seq;
    Q.timer = setTimeout(async () => {
      try {
        const r = await window.Emby.getItems({ SearchTerm: q, IncludeItemTypes: 'Movie,Series', Limit: 30 });
        if (my !== Q.seq) return;
        const items = (r && r.items) || [];
        Q.videos = best(items.map(it => ({ kind: 'title', vt: 'video', id: it.Id, label: it.Name, sub: (it.Type === 'Series' ? 'Series' : 'Film') + (it.ProductionYear ? ' · ' + it.ProductionYear : '') })), q, 8);
        Q.videoQ = q;
        if (isOpenId(QUICK_ID)) {
          const cur = Q.items[Q.sel];
          render();
          if (cur) { const j = Q.items.findIndex(x => x.kind === cur.kind && x.id === cur.id && x.key === cur.key && x.label === cur.label); if (j >= 0) select(j, false); }
        }
      } catch (_) {}
    }, 180);
  }
  function openQuick() {
    const top = topEl();
    if (top && top.id === HELP_ID && !GH) closeLayer(HELP_ID);
    else if (top) return false;
    buildQuick();
    refreshGamesContinue().then(() => { if (isOpenId(QUICK_ID) && !Q.input.value) render(); });
    if (!libraryItems().length) refreshViews();
    Q.input.value = ''; Q.sel = 0; Q.videos = []; Q.videoQ = null;
    render();
    openLayer(QUICK_ID);
    // After keys.js has noted where focus was (its observer runs first), so Back returns it there.
    setTimeout(() => { if (isOpenId(QUICK_ID)) Q.input.focus({ preventScroll: true }); }, 0);
    return true;
  }

  /* Enter on a result. The box closes first (focus goes back to where it was),
     then the jump runs -- so Back from wherever it lands steps back here. */
  function choose(it, shift) {
    if (!it) return;
    remember(it);
    const el = document.getElementById(QUICK_ID);
    const hist = el && !el.dataset.gqNoHist;
    closeLayer(QUICK_ID);
    const go2 = () => { runItem(it, shift).catch(e => console.warn('[shortcuts] jump failed:', e)); };
    if (!hist) { setTimeout(go2, 30); return; }
    // Closing gave the box's history entry back (history.back(), asynchronous). Jump once that
    // has landed, or the step back would undo a page change or close the drawer just opened.
    let done = false;
    const fire = () => { if (done) return; done = true; window.removeEventListener('popstate', onPop); setTimeout(go2, 0); };
    const onPop = () => fire();
    window.addEventListener('popstate', onPop);
    setTimeout(fire, 600);
  }
  async function runItem(it, shift) {
    switch (it.kind) {
      case 'continue': {
        const card = document.querySelector('#video-continue [data-cr-open="' + CSS.escape(it.key) + '"]');
        if (card) { card.click(); return; }
        if (it.gameId && window.ContinueRow && window.ContinueRow.openGame) window.ContinueRow.openGame(it.gameId);
        return;
      }
      case 'title':
        if (it.vt === 'video') {
          if (shift && K() && K().playVideoId) { K().playVideoId(it.id, null); return; }
          if (window.Emby && window.Emby.openVideo) window.Emby.openVideo(it.id);
          return;
        }
        if (typeof window.openDevice === 'function') {
          window.openDevice(it.id);
          if (shift) { const b = await waitFor(() => document.querySelector('#device-overlay.open .play-now'), 5000); if (b) b.click(); }
        }
        return;
      case 'system':
        if (typeof window.routeToMediaSystems === 'function') window.routeToMediaSystems([it.key]);
        return;
      case 'library': {
        if (!onMedia()) go('/media');
        const b = await waitFor(() => document.querySelector('#video-cat-row .video-cat-btn[data-libid="' + CSS.escape(it.id) + '"]'), 8000);
        if (b) { b.click(); }
        return;
      }
      case 'page':
        if (it.path == null) openSettings(); else go(it.path);
        return;
      case 'setting': return openSettingsAt(it.tab, it.sec);
      case 'action': A() && A().run(it.id); return;
    }
  }
  async function openSettingsAt(tab, sec) {
    openSettings();
    const btn = await waitFor(() => document.querySelector('#vault-overlay.open .settings-tab[data-tab="' + CSS.escape(tab) + '"]'), 3000);
    if (!btn) return;
    btn.click();
    await sleep(120);
    if (sec < 0) { try { btn.focus(); } catch (_) {} return; }
    const panel = document.querySelector('#vault-overlay .settings-panels > .settings-panel[data-panel="' + CSS.escape(tab) + '"]');
    const s = panel && panel.querySelectorAll('.vault-section')[sec];
    if (!s) return;
    const c = Array.from(s.querySelectorAll('button:not([disabled]), input:not([disabled]):not([type="hidden"]), select, textarea, a[href], [tabindex="0"]')).find(visible);
    try { s.scrollIntoView({ block: 'nearest' }); } catch (_) {}
    if (c) c.focus({ preventScroll: true }); else { try { btn.focus(); } catch (_) {} }
  }

  /* ------------------------------------------------------------ ? : the keys, from the table */

  /* THE KEYS PAGE (4 Nov: "the keyboard and shortcuts page needs a redesign to show proper sections
     and layout ... The System Switcher should get its own section and text describing it. This page
     should evolve to be more than a series of mapped buttons displayed"). Sections in the order a
     visitor meets things, each with a line saying what it is about, and one row per thing to do with
     its keyboard keys and its controller buttons side by side; the TV remote's keys have a section
     of their own. Every key and button comes from the action table (Actions, with the visitor's own
     changes), so the page follows any rebind and any new key: a row whose actions are gone is left
     out, and an action with keys that no row names is listed under "More keys" at the end. The rows'
     words are this page's own (shorter than the table's labels). A few rows name keys that the
     element owning them catches itself and that cannot be changed (Enter and A on the System
     Switcher, holding Enter or A in the Systems menu): those are written here as they are.
     Row: { ids, label, kb / pad / rc: extra keys, short: the Controller summary's words }. */
  const KS_REMOTE = /^(Media|GoBack|BrowserBack|XF86|Channel|AudioVolume|Launch|Info|Guide|ColorF|#)/;
  const KS_SECTIONS = [
    { id: 'move', title: 'Getting around', line: 'The highlight shows where you are. Move it with the arrow keys or the D-pad; it works the same way on every page, menu and window.', rows: [
      { ids: ['nav.up', 'nav.down', 'nav.left', 'nav.right'], label: 'Move the highlight', short: 'move' },
      { ids: ['tile.open', 'pad.ok'], label: 'Press the highlighted button, or open the highlighted tile', short: 'press or open' },
      { ids: ['back'], label: 'Back: close what is on top, one step at a time', short: 'back' },
      { ids: ['nav.pageUp'], label: 'One screen up (drawers, pages and Settings)', short: 'one screen up' },
      { ids: ['nav.pageDown'], label: 'One screen down (drawers, pages and Settings)', short: 'one screen down' },
      { ids: ['nav.first'], label: 'First in the row' },
      { ids: ['nav.last'], label: 'Last in the row' },
      { ids: ['pad.sticks'], label: 'Scroll: the right stick scrolls pages, menus and manuals; on the wall and in drawers either stick scrolls, faster the further you push it', short: 'scroll' },
    ] },
    { id: 'pages', title: 'Search and pages', line: 'Go to the search bar or open a page from anywhere. For the two-key jumps press g, then the letter: a small panel lists the letters for five seconds.', rows: [
      { ids: ['quick.open', 'go.search'], label: 'Go to the search bar and type', short: 'search' },
      { ids: ['go.home'], label: 'Home' },
      { ids: ['go.features'], label: 'Features' },
      { ids: ['go.timeline'], label: 'Timeline' },
      { ids: ['go.about'], label: 'About' },
      { ids: ['go.settings'], label: 'Settings' },
      { ids: ['go.continue'], label: 'The Continue row' },
      { ids: ['help.open'], label: 'This page: keys and controls', short: 'this page' },
    ] },
    { id: 'wall', title: 'The wall and drawers', line: 'The wall is the grid of game, film and show tiles. Opening a tile slides out its drawer, with its pictures, details, manual and Play button.', rows: [
      { ids: ['tile.open'], label: 'Open the highlighted tile’s drawer' },
      { ids: ['item.play'], label: 'Play, or carry on from where you stopped', short: 'play' },
      { ids: ['item.manual'], label: 'Open the game’s instruction manual', short: 'manual' },
      { ids: ['wall.movies'], label: 'On the wall, with nothing on top: Movies (films and shows) on or off', short: 'on the wall: Movies on or off' },
      { ids: ['wall.widgets'], label: 'On the wall, with nothing on top: Widgets on or off', short: 'on the wall: Widgets on or off' },
      { ids: ['pad.info'], label: 'Details for the highlighted Continue card or drawer item', short: 'details of a Continue card or drawer item' },
      { ids: ['continue.remove', 'pad.context'], label: 'Remove the highlighted card from the Continue row', short: 'remove a Continue card' },
      { ids: ['pad.home'], label: 'Go to the Home button on the search bar (it does not open it)', short: 'on the wall: the Home button' },
      { ids: ['section.prev'], label: 'Previous film or series library' },
      { ids: ['section.next'], label: 'Next film or series library' },
      { ids: ['focus.toggle'], label: 'Focus mode: hide the search bar and the library strip' },
    ] },
    { id: 'systems', title: 'Systems menu', line: 'The Systems tab on the right edge of the screen opens a menu of every console. Pick one to fill the wall with its games, or keep several.', rows: [
      { ids: ['pad.tab'], label: 'Reach the Systems tab: Right past the last tile in a row' },
      { ids: ['pad.systems'], label: 'Open or close the Systems menu', short: 'on the wall: the Systems menu' },
      { kb: ['Enter'], pad: ['Pad:A'], label: 'Show only the highlighted console' },
      { kb: ['Enter'], pad: ['Pad:A'], hold: true, label: 'Add or remove a console and keep the others (or Ctrl and click)' },
    ] },
    { id: 'switcher', title: 'System Switcher', line: 'Change which console fills the wall without opening the Systems menu.',
      text: ['Press one of the keys below and a panel opens in the middle of the screen with the consoles in a row, the chosen one large in the middle. Each press moves one console along; hold the key or button to keep moving. The consoles come in the Systems menu’s order, with All consoles at the start.',
        'A second after your last press the wall changes to that console and the panel fades away. Enter or A changes it at once; Back or B closes the panel and leaves the wall as it was. The panel works with the keys and a controller only: a click or tap outside it closes it.'], rows: [
      { ids: ['system.prev', 'pad.section.prev'], label: 'One console back', short: 'System Switcher' },
      { ids: ['system.next', 'pad.section.next'], label: 'One console on', short: 'System Switcher' },
      { kb: ['Enter'], pad: ['Pad:A'], label: 'Change the wall now' },
      { ids: ['back'], label: 'Close it and keep the wall as it was' },
    ] },
    { id: 'play', title: 'Playing a game', line: 'While a game runs it has the keyboard and controller to itself. The play window keeps only these; the help over the game lists that game’s own buttons.', rows: [
      { ids: ['game.back'], label: 'Pause menu: Resume, Controls, Saved states, Quit (Back again resumes)', short: 'pause menu in a game' },
      { ids: ['game.help'], label: 'Help over the game: its controls, while the game waits', short: 'game help' },
      { ids: ['game.rewind'], pad: ['Pad:LB', 'Pad:Start+Left'], label: 'Rewind, held, where the game has it' },
      { pad: ['Pad:RB', 'Pad:Start+Right'], label: 'Speed up, held' },
      { kb: ['Ctrl+B'], label: 'Swap a controller’s A with B and X with Y, in the game only: also the Swap A/B button on the Control Bar' },
      { ids: ['game.pad.buttons'], label: 'The console’s own buttons: the letters printed on the controller are the console’s, and so are Start and Select' },
      { ids: ['game.pad.bar'], label: 'The Control Bar along the top of the window (Pause, Reset, Saves, Keys, Settings): a trigger the console does not use moves to it, the triggers step along it, A presses, B goes back to the game', short: 'Control Bar in a game' },
      { ids: ['game.pad.players'], label: 'More controllers are players 2 to 4 where the game has them' },
    ] },
    { id: 'player', title: 'Films and shows', line: 'The player for films and series from your media server.', rows: [
      { ids: ['player.toggle', 'media.toggle', 'media.play', 'media.pause'], label: 'Play or pause', short: 'play or pause' },
      { ids: ['player.back10', 'media.back10'], label: 'Back 10 seconds', short: 'back 10 seconds' },
      { ids: ['player.fwd10', 'media.fwd10'], label: 'Forward 10 seconds', short: 'forward 10 seconds' },
      { ids: ['player.prev', 'media.prev'], label: 'Previous episode', short: 'previous episode' },
      { ids: ['player.next', 'media.next'], label: 'Next episode', short: 'next episode' },
      { ids: ['player.fullscreen'], label: 'Full screen' },
      { ids: ['player.mute'], label: 'Mute' },
      { ids: ['player.subs'], label: 'Subtitles on or off' },
      { ids: ['player.subTrack'], label: 'Next subtitle track' },
      { ids: ['player.subEarlier'], label: 'Subtitles 0.1 seconds earlier' },
      { ids: ['player.subLater'], label: 'Subtitles 0.1 seconds later' },
      { ids: ['media.stop'], label: 'Stop and close the player' },
    ] },
  ];
  const KS_PAD_ORDER = ['Up', 'A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Select', 'Start', 'Home', 'R3', 'LS', 'RS'];
  const KS_PAD_NAME = { Home: 'Guide', LS: 'Left stick', RS: 'Right stick', Up: '↑', Down: '↓', Left: '←', Right: '→' };
  const ksIsPad = k => k.slice(0, 4) === 'Pad:';
  const ksIsRemote = k => KS_REMOTE.test(k);
  function ksKeys(row) {
    const F = A(); if (!F) return null;
    let keys = [], any = false;
    for (const id of row.ids || []) { const a = F.list().find(x => x.id === id); if (!a) continue; any = true; for (const k of a.keys) if (!keys.includes(k)) keys.push(k); }
    if (row.ids && row.ids.length && !any && !row.kb && !row.pad) return null;    // its actions are not on this copy (off our address: no page jumps)
    for (const k of [].concat(row.kb || [], row.pad || [], row.rc || [])) if (!keys.includes(k)) keys.push(k);
    keys = F.shownKeys(keys);
    return { kb: keys.filter(k => !ksIsPad(k) && !ksIsRemote(k)), pad: keys.filter(ksIsPad), rc: keys.filter(ksIsRemote) };
  }
  function ksKb(k) {
    const F = A();
    if (k.indexOf(' ') > 0) return k.split(' ').map(p => '<kbd>' + esc(F.format(p)) + '</kbd>').join('<span class="ks-then">then</span>');
    return '<kbd>' + esc(F.format(k)) + '</kbd>';
  }
  function ksPad(k) {
    const name = k.slice(4).split('+').map(b => KS_PAD_NAME[b] || b).join(' + ');
    return '<kbd class="ks-pad">' + esc(name) + '</kbd>';
  }
  function ksRc(k) {
    const F = A(), name = F.format(k), col = /^(Red|Green|Yellow|Blue)$/.test(name) ? ' ks-rc-' + name.toLowerCase() : '';
    return '<kbd class="ks-rc' + col + '">' + esc(name) + '</kbd>';
  }
  function ksCell(list, fn, hold, kind) {
    if (kind === 'pad') {   // the four D-pad directions read as one button
      const dirs = ['Pad:Up', 'Pad:Down', 'Pad:Left', 'Pad:Right'];
      if (dirs.every(d => list.includes(d))) list = ['Pad:D-pad'].concat(list.filter(k => !dirs.includes(k)));
    }
    const arrows = ['ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight'];
    const allArrows = kind !== 'pad' && arrows.every(d => list.includes(d));   // the four arrow keys: one group, no "or" between
    if (allArrows) list = list.filter(k => !arrows.includes(k));
    if (!list.length && !allArrows) return '';
    const group = allArrows ? ['<span class="ks-arrows" role="group" aria-label="the arrow keys">' + arrows.map(fn).join('') + '</span>'] : [];
    return group.concat(list.slice(0, 4).map(fn)).join('<span class="ks-or" aria-label="or">/</span>') + (hold ? '<span class="ks-then">held</span>' : '');
  }
  function ksRow(row, k) {
    const kb = ksCell(k.kb, ksKb, row.hold), pc = ksCell(k.pad, ksPad, row.hold, 'pad');
    return `<div class="ks-row"><span class="ks-what">${esc(row.label)}</span>`
      + `<span class="ks-cell ks-kb${kb ? '' : ' ks-empty'}" data-head="Keyboard">${kb}</span>`
      + `<span class="ks-cell ks-pc${pc ? '' : ' ks-empty'}" data-head="Controller">${pc}</span></div>`;
  }
  function ksSection(s, body) {
    return `<section class="ks-sec" data-ks="${esc(s.id)}"><h3>${esc(s.title)}</h3><p class="ks-line">${esc(s.line)}</p>${(s.text || []).map(t => '<p class="ks-text">' + esc(t) + '</p>').join('')}${body}</section>`;
  }
  const KS_HEAD = '<div class="ks-row ks-head" aria-hidden="true"><span class="ks-what"></span><span class="ks-cell">Keyboard</span><span class="ks-cell">Controller</span></div>';
  function pageHTML(opts) {
    ensureStyles();
    const F = A(); if (!F) return '';
    opts = opts || {};
    const used = new Set(), remote = [], pads = new Map();
    let order = KS_SECTIONS.slice();
    const top = topEl();
    if (top && top.id === 'video-player-overlay') order = order.filter(s => s.id === 'player').concat(order.filter(s => s.id !== 'player'));   // over the film player: its keys first
    const secs = order.map(s => {
      const rows = [];
      for (const row of s.rows) {
        (row.ids || []).forEach(id => used.add(id));
        const k = ksKeys(row); if (!k) continue;
        const rcOwn = k.rc.filter(x => !/^(GoBack|BrowserBack|XF86Back)$/.test(x));   // Back is the remote's Back everywhere (the section's first line)
        if (rcOwn.length && !remote.some(r => r.label === row.label)) remote.push({ label: row.label, rc: rcOwn });
        if (row.short && s.id !== 'play') for (const p of k.pad) {   // the Controller summary: the site's words, then the film player's
          const b = p.slice(4); if (!pads.has(b)) pads.set(b, { site: [], player: [] });
          const l = pads.get(b)[s.id === 'player' ? 'player' : 'site']; if (!l.includes(row.short)) l.push(row.short);
        }
        if (k.kb.length || k.pad.length) rows.push(ksRow(row, k));
      }
      return rows.length || s.text ? ksSection(s, KS_HEAD + rows.join('')) : '';
    });
    // Anything in the table that no row names (a key added later): listed, so it is never missing.
    const more = F.list().filter(a => a.help && a.keys.length && !used.has(a.id)).map(a => {
      const k = ksKeys({ ids: [a.id] }); if (!k) return '';
      if (k.rc.length) remote.push({ label: a.label, rc: k.rc });
      return k.kb.length || k.pad.length ? ksRow({ label: a.label }, k) : '';
    }).join('');
    // The controller at a glance: each button and what it does on the site (not in a game).
    const padRows = KS_PAD_ORDER.concat(Array.from(pads.keys()).filter(b => !KS_PAD_ORDER.includes(b) && !/^(Down|Left|Right)$/.test(b))).filter(b => pads.has(b)).map(b =>
      `<div class="ks-row ks-wide"><span class="ks-cell">${ksPad('Pad:' + (b === 'Up' ? 'D-pad' : b))}</span><span class="ks-what">${esc([pads.get(b).site.join(', '), pads.get(b).player.length ? 'in the film player: ' + pads.get(b).player.join(', ') : ''].filter(Boolean).join('; ').replace(/^./, c => c.toUpperCase()))}</span></div>`).join('');
    const pad = ksSection({ id: 'pad', title: 'Controller', line: 'Any standard controller works: connect it and press a button. Its buttons, away from a game:' },
      padRows + '<p class="ks-text">To change a key or a button, or to see what your controller sends: Settings, then Keyboard &amp; controllers, then Test controller.</p>');
    const rc = remote.length ? ksSection({ id: 'remote', title: 'TV remote', line: 'A TV remote’s arrows, OK and Back work like the keyboard’s. Its colour, channel and play keys do these:' },
      remote.map(r => `<div class="ks-row ks-wide"><span class="ks-cell">${r.rc.slice(0, 4).map(ksRc).join('<span class="ks-or" aria-label="or">/</span>')}</span><span class="ks-what">${esc(r.label)}</span></div>`).join('')) : '';
    const intro = '<p class="ks-intro">Everything here works with a keyboard, a controller or a TV remote, as well as a mouse or touch. The keys shown are your own: change them in Settings, Keyboard &amp; controllers.</p>';
    return `<div class="ks-page${opts.window ? ' ks-in-window' : ''}">${opts.window ? '<h2 class="ks-title">Keyboard shortcuts</h2>' : ''}${intro}<div class="ks-cols">`
      + secs.join('') + pad + rc + (more ? ksSection({ id: 'more', title: 'More keys', line: 'Other keys the site knows.' }, KS_HEAD + more) : '') + '</div></div>';
  }
  /* ON A SMALL SCREEN THE KEYS ARE A PAGE (4 Nov: "on small devices it should behave the same as
     the other pages: open full screen under the search bar so it feels like another page"). The
     same window as Home and Features (emby.js CwAboutWindow, kind 'keys'): under the search bar,
     the same close X and Back. Only from the content page with nothing else open; over a drawer,
     Settings or the player, and off our own address (no page windows there), it stays a window
     of its own. The desk and the TV keep this window, with the new content. */
  function keysAsPage() {
    const W = window.CwAboutWindow;
    return !!W && !window.__cwOffsite && document.documentElement.classList.contains('cw-small') && onMedia() && !topEl() && !!document.getElementById('video-keys-btn');
  }
  function openHelp() {
    const top = topEl();
    if (top && top.id === QUICK_ID) closeLayer(QUICK_ID);
    else if (top && top.id === HELP_ID) { closeLayer(HELP_ID); return true; }
    else if (top && GAME_LAYERS.has(top.id)) return openGameHelp();        // Game help: over the game, paused
    if (keysAsPage()) {
      const W = window.CwAboutWindow;
      if (W.isOpen() && W.kind() === 'keys') { W.close(); const b = document.getElementById('video-keys-btn'); if (b) { try { b.focus({ preventScroll: true }); } catch (_) {} } return true; }
      const p = document.getElementById('video-about');
      if (p && p.dataset.kind === 'keys') p.dataset.kind = '';           // drawn fresh each time: the visitor's keys now
      W.open('keys');
      return true;
    }
    const el = layer(HELP_ID, 'gq-help', 'Keyboard shortcuts');
    el.setAttribute('aria-label', 'Keyboard shortcuts');
    el.innerHTML = `<div class="gq-box ks-box">
        <div class="gq-help-head"><h2>Keyboard shortcuts</h2><button type="button" class="gq-help-close" data-gq-close>Close <kbd>Esc</kbd></button></div>
        <div class="gq-help-body ks-body" tabindex="0" aria-label="Keyboard shortcuts">${pageHTML()}</div>
      </div>`;
    el.querySelector('[data-gq-close]').addEventListener('click', () => closeLayer(HELP_ID));
    openLayer(HELP_ID);
    const body = el.querySelector('.gq-help-body');
    body.scrollTop = 0;
    setTimeout(() => { if (isOpenId(HELP_ID)) body.focus({ preventScroll: true }); }, 0);
    return true;
  }

  /* ------------------------------------------------------------ ? over a game (Game help, 2026-10-04)

     Reported: "I am playing a GnW game, and I press '?' and I get no help screen but I think I
     should." In every play window the help key (help.open: ? by default, the viewer's own keys, a
     remote's Blue key) and the pad's R3 open this help OVER the game, and the game pauses while it
     is open (the pause menu's own pause, keys.js gamePause). Back, Esc or ? closes it and the game
     carries on. It lists this game's controls (the console's buttons, with the viewer's keys and pad
     buttons after the remaps in gnw.keys.games.v1 / gnw.pad.games.v2, read through play-pad.js's
     table; for Game & Watch the device's own buttons, from the Controls diagram's data), the window's
     keys, and where to change them. The key never reaches the game: in a framed window play-keys.js
     takes it; for the page's own windows (Game & Watch, Pokemon mini) the capture listener below.
     Sound: none; the game's audio pauses with the game. */

  const PLAY_LAYERS = new Set(Array.from(GAME_LAYERS).filter(id => id !== 'gk-pause'));
  let GH = null;                     // the open game help: { ov, paused }
  const ghDown = new Set();          // help keys whose key-up must not reach the game either
  function gameUnder(top) {
    if (!top) return null;
    if (PLAY_LAYERS.has(top.id)) return top;
    if (top.id === 'gk-pause') { const k = K(); const w = k && k.pausedWindow ? k.pausedWindow() : null; return w && w.classList.contains('open') ? w : null; }
    return null;
  }
  function gameHelpKeys() {
    const F = A(); if (!F) return ['?', 'Pad:R3'];
    const ks = F.keysFor('help.open').filter(k => k !== 'Pad:Home');        // Home is the pause menu in a game
    if (!ks.includes('Pad:R3')) ks.push('Pad:R3');
    return ks;
  }
  function isGameHelpKey(e) {
    const F = A(); if (!F || e.ctrlKey || e.altKey || e.metaKey || isField(e.target) || e.__gnwRemap || e.__gnwPad) return false;
    return F.match(e, 'global') === 'help.open';
  }
  function openDev() {
    try {
      const id = typeof _openPlayDeviceId !== 'undefined' ? _openPlayDeviceId : null;   // index.html's own
      return id ? allGames().find(d => d.id === id) || { id, name: id } : null;
    } catch (_) { return null; }
  }
  function systemOf(ov) {
    const f = ov.querySelector('iframe');
    try { const w = f && f.contentWindow; const s = w && w.gnwPlayPad && w.gnwPlayPad.info().system; if (s) return s; } catch (_) {}
    if (ov.id === 'play-overlay') return 'gnw';
    if (ov.id === 'pm-play-overlay') return 'pm';
    if (ov.id === 'gb-play-overlay') return 'gb';
    if (ov.id === 'nes-play-overlay') return 'nes';
    if (ov.id === 'tft-play-overlay') return 'twin';
    if (ov.id === 'tj-play-overlay') return 'tj';
    const d = openDev(), m = d && /^(a2600|a7800|alynx)/.exec(d.id || '');
    return m ? m[1] : null;
  }
  const PP = () => window.gnwPlayPad || null;
  const codeKbd = code => '<kbd>' + esc(PP() ? PP().codeLabel(code) : code) + '</kbd>';
  const padKbd = (b, n) => '<kbd class="gk-padkey">' + esc('Pad ' + (n ? n + ' ' : '') + ({ Up: '↑', Down: '↓', Left: '←', Right: '→' }[b] || b)) + '</kbd>';
  const SEP = '<span aria-hidden="true">/</span>';
  function helpRow(label, keysHtml, attrs) {
    return `<div class="gq-help-row"${attrs || ''}><span>${esc(label)}</span><span class="gq-keys">${keysHtml}</span></div>`;
  }
  // A Controls-diagram key glyph as the key code the remaps are keyed by.
  const GLYPH_CODE = { '←': 'ArrowLeft', '→': 'ArrowRight', '↑': 'ArrowUp', '↓': 'ArrowDown', Space: 'Space' };
  const glyphCode = g => GLYPH_CODE[g] || (/^\d$/.test(g) ? 'Digit' + g : /^[A-Z]$/.test(g) ? 'Key' + g : null);
  const GNW_NAMES = { btn1: 'Right', btn2: 'Up', btn3: 'Left', btn4: 'Down', p2up: 'Player 2 Up', p2down: 'Player 2 Down', p2left: 'Player 2 Left', p2right: 'Player 2 Right', p2fire: 'Player 2 Fire' };

  /* The console's buttons: [{ label, codes: [key codes the viewer presses], pads: [[button, padNo]] }]. */
  function controlRows(sys, dev) {
    const pp = PP(); if (!pp) return [];
    const t = pp.table(sys); if (!t) return [];
    const km = pp.keyRemap(sys);
    const maps = pp.mapsFor ? pp.mapsFor(sys) : [];
    const p1 = maps[0] || {}, p2 = maps[1] || null;
    const padsFor = (code, map) => Object.keys(map || {}).filter(b => map[b] === code);
    if (sys === 'gnw') {
      const info = typeof window.gnwControlsInfo === 'function' ? window.gnwControlsInfo() : null;
      if (info && info.buttons && info.buttons.length) {
        const out = [];
        for (const b of info.buttons) {
          const p2btn = /^p2/.test(b.name);
          const label = (p2btn ? GNW_NAMES[b.name] : (b.label || GNW_NAMES[b.name])) || b.name;
          const codes = [], pads = [];
          for (const g of b.keys) {
            const c = glyphCode(g); if (!c) continue;
            const mine = km[c] || c;                      // the viewer's key for this function
            if (!codes.includes(mine)) codes.push(mine);
            for (const pb of padsFor(c, p2btn ? p2 : p1)) if (!pads.some(x => x[0] === pb)) pads.push([pb, p2btn ? 2 : 0]);
          }
          const same = out.find(r => r.label === label);
          if (same) { for (const c of codes) if (!same.codes.includes(c)) same.codes.push(c); for (const x of pads) if (!same.pads.some(y => y[0] === x[0] && y[1] === x[1])) same.pads.push(x); }
          else out.push({ label, codes, pads, fn: b.name });
        }
        return out;
      }
    }
    const rows = [];
    for (const k of t.keys) rows.push({ label: k.label, codes: [k.key], pads: [], fn: k.fn });
    for (const p of t.pad) {
      let r = rows.find(x => x.label === p.label);
      if (!r && p.buttons.length) { r = { label: p.label, codes: [], pads: [], fn: p.fn }; rows.push(r); }
      if (r) for (const b of p.buttons) r.pads.push([b, 0]);
    }
    // Mario's shell has no Start or Select (play/twin-harness.js).
    const noStartSelect = sys === 'twin' && dev && /mario/i.test(dev.id || '');
    const keep = rows.filter(r => !(noStartSelect && /^(Start|Select)$/.test(r.label)));
    // Player 2 at the keyboard (and on pad 2): the second key table, function by function.
    if (p2 && !t.direct && sys !== 'gnw') {
      const seen = new Set();
      const def = pp.MAPS[sys].players;
      for (const k of t.keys) {
        for (const b of padsFor(k.fn, def[0])) {
          const c2 = def[1][b];
          if (!c2 || seen.has(k.label)) continue;
          seen.add(k.label);
          keep.push({ label: 'Player 2 ' + k.label, codes: [c2], pads: padsFor(c2, p2).map(x => [x, 2]), fn: c2 });
        }
      }
    }
    return keep;
  }
  /* The window's own keys, wherever this window has them. */
  function windowRows(ov, sys, shownCodes) {
    const F = A(); const k = K();
    const has = k && k.gameHas ? k.gameHas(ov) : {};
    const menu = ['Resume'].concat(has.controls ? ['Controls'] : [], has.saves ? ['Saved states'] : [], ['Quit']).join(', ');
    const rows = [];
    rows.push(helpRow('Pause menu: ' + menu + ' (Back again resumes)', F ? keysHTML(F.keysFor('game.back')) : '<kbd>Esc</kbd>', ' data-win="menu"'));
    rows.push(helpRow('This help (the game waits)', keysHTML(gameHelpKeys()), ' data-win="help"'));
    let microVs = false; try { const ci = window.gnwControlsInfo && window.gnwControlsInfo(); microVs = !!(ci && ci.microVs); } catch (_) {}
    // NES rewind: play/nes/rewind.js (2026-10-05), the Game Boy's hold-to-rewind.
    // The shoulders (play/host/host.mjs, 2026-10-23): LB rewinds, RB runs at 2x, both held, in the
    // shared play window, where the console's pad table (with the viewer's remaps) leaves them free.
    const padSys = ({ tetrisjr: 'tj', tft: 'twin' })[sys] || sys;
    let m0 = null; try { const mm = PP() && PP().mapsFor ? PP().mapsFor(padSys) : null; m0 = mm && mm[0]; } catch (_) { m0 = null; }
    const hosted = !!(m0 && PP().MAPS && PP().MAPS[padSys]);
    const lb = hosted && !(m0 && m0.LB), rb = hosted && !(m0 && m0.RB);
    const rewOld = (sys === 'gnw' && !microVs) || sys === 'gb' || sys === 'tj' || sys === 'pm' || sys === 'nes';
    if (rewOld || lb) rows.push(helpRow('Rewind, held', (rewOld ? '<kbd>Ctrl+←</kbd>' + SEP + '<kbd class="gk-padkey">Pad Start + ←</kbd>' : '') + (rewOld && lb ? SEP : '') + (lb ? padKbd('LB') : ''), ' data-win="rewind"'));
    // The play window's controller shortcut (2026-10-17): Start + Right runs at 2x while held.
    rows.push(helpRow('Speed up, held', '<kbd class="gk-padkey">Pad Start + →</kbd>' + (rb ? SEP + padKbd('RB') : ''), ' data-win="speed"'));
    // The Control Bar's Swap A/B (play/host/host.mjs), where A and B, or X and Y, do different things.
    if (hosted && m0 && (m0.A !== m0.B || m0.X !== m0.Y)) rows.push(helpRow('Swap a controller’s A with B and X with Y, in the game only', '<kbd>Ctrl+B</kbd>' + SEP + '<span class="gq-sub">the window’s Swap A/B button</span>', ' data-win="swap"'));
    if (has.saves) rows.push(helpRow('Save and load states', '<span class="gq-sub">Back, then Saved states</span>', ' data-win="saves"'));
    if (has.controls) rows.push(helpRow('The Controls diagram', '<span class="gq-sub">Back, then Controls</span>', ' data-win="controls"'));
    if (sys === 'gnw' || sys === 'tj') rows.push(helpRow('Mute', codeKbd('Minus'), ' data-win="mute"'));
    else rows.push(helpRow('Mute', '<span class="gq-sub">the window’s Mute button</span>', ' data-win="mute"'));
    if (sys === 'a7800') rows.push(helpRow('Difficulty switches: left / right', '<kbd>F4</kbd>' + SEP + '<kbd>Shift+F4</kbd>', ' data-win="difficulty"'));
    const wk = (PP() && PP().WINDOW_KEYS && PP().WINDOW_KEYS[sys]) || {};
    for (const [code, label] of Object.entries(wk)) {
      if (/^Player 2|^Log$|^Mute$/.test(label) || (shownCodes && shownCodes.has(code))) continue;   // already on a console row
      rows.push(helpRow(/ \(/.test(label) ? label.replace(/ \([^)]*\)$/, '') + ' (also)' : label, codeKbd(code), ' data-win="' + esc(code) + '"'));
    }
    if (sys === 'nes') {
      // The accessories this title uses, from the play frame (play/nes/app.js gnwNesHelp, 2026-10-04);
      // an older frame without it keeps the general line.
      let acc = null; try { const w = ov.querySelector('iframe').contentWindow; acc = typeof w.gnwNesHelp === 'function' ? w.gnwNesHelp() : null; } catch (_) { acc = null; }
      if (Array.isArray(acc)) for (const [label, keys] of acc) rows.push(helpRow(label, '<span class="gq-sub">' + esc(keys) + '</span>', ' data-win="accessory"'));
      else rows.push(helpRow('Zapper, Power Pad, microphone and VS. coins', '<span class="gq-sub">their keys are on the Controls screen</span>', ' data-win="accessories"'));
    }
    rows.push(helpRow('Full screen', '<span class="gq-sub">not in this window</span>', ' data-win="fullscreen"'));
    return rows.join('');
  }
  function gameHelpHTML(ov) {
    const sys = systemOf(ov), dev = openDev();
    const sysLabel = dev ? gameSystemLabel(dev) : ((PP() && PP().MAPS[sys] && PP().MAPS[sys].label) || 'Game');
    const rows = controlRows(sys, dev);
    /* Swap A/B on (the Control Bar, play/host/host.mjs): the list says what each button does now. */
    let swapOn = false; try { swapOn = localStorage.getItem('cw.pad.swap.v1') === '1'; } catch (_) {}
    if (swapOn) { const SW = { A: 'B', B: 'A', X: 'Y', Y: 'X' }; for (const r of rows) r.pads = r.pads.map(x => [SW[x[0]] || x[0], x[1]]); }
    const ctl = rows.map(r => helpRow(r.label,
      r.codes.map(codeKbd).join(SEP) + (r.codes.length && r.pads.length ? SEP : '') + r.pads.map(x => padKbd(x[0], x[1])).join(SEP),
      ` data-fn="${esc(r.fn || '')}" data-keys="${esc(r.codes.join(' '))}" data-pads="${esc(r.pads.map(x => (x[1] ? x[1] + ':' : '') + x[0]).join(' '))}"`)).join('');
    const more = sys === 'nes' ? '<p class="gq-sub" style="margin:10px 0 0;white-space:normal">Pads 3 and 4 are players 3 and 4 in a Four Score or Famicom 4-player game.</p>' : '';
    return `<div class="gq-box" data-gh-sys="${esc(sys || '')}">
        <div class="gq-help-head"><h2>${esc(dev ? dev.name : sysLabel)} <span class="gq-sub" style="display:inline">· ${esc(sysLabel)} · paused</span></h2><button type="button" class="gq-help-close" data-gq-close>Resume <kbd>Esc</kbd></button></div>
        <div class="gq-help-body" tabindex="0" aria-label="Help for this game">
          <div class="gq-help-col" data-col="game"><h3>This game’s controls</h3>${ctl || '<p class="gq-sub">No button list for this window.</p>'}${more}</div>
          <div class="gq-help-col" data-col="window"><h3>This window</h3>${windowRows(ov, sys, new Set([].concat(...rows.map(r => r.codes))))}</div>
          <div class="gq-help-other" data-col="change"><p class="gq-sub" style="margin:14px 0 0;white-space:normal">To change these keys and buttons: <b>Settings → Keyboard &amp; controllers</b>. Back, Esc or ? closes this help and the game carries on.</p></div>
        </div>
      </div>`;
  }
  function endGameHelp() {
    const g = GH; GH = null;
    if (!g) return;
    const k = K();
    if (g.paused && k && k.gamePause) k.gamePause(g.ov, false);
    setTimeout(() => { if (topEl() === g.ov && window._playFocusGame) window._playFocusGame(g.ov); }, 0);
  }
  function openGameHelp(ovArg) {
    const top = topEl();
    if (top && top.id === HELP_ID) { closeLayer(HELP_ID); return true; }
    const ov = ovArg || gameUnder(top);
    if (!ov || !ov.classList.contains('open')) return false;
    if (!top || (top !== ov && !(top.id === 'gk-pause' && gameUnder(top) === ov))) return false;   // something else is in front
    const k = K();
    const paused = top === ov && k && k.gamePause ? k.gamePause(ov, true) : false;   // under the pause menu it is paused already
    GH = { ov, paused };
    const el = layer(HELP_ID, 'gq-help', 'Keyboard shortcuts');
    if (!el.__ghObs) {
      el.__ghObs = new MutationObserver(() => { if (!el.classList.contains('open')) endGameHelp(); });
      el.__ghObs.observe(el, { attributes: true, attributeFilter: ['class'] });
    }
    el.setAttribute('aria-label', 'Help for this game');
    el.innerHTML = gameHelpHTML(ov);
    el.querySelector('[data-gq-close]').addEventListener('click', () => closeLayer(HELP_ID));
    openLayer(HELP_ID);
    const body = el.querySelector('.gq-help-body');
    body.scrollTop = 0;
    setTimeout(() => { if (isOpenId(HELP_ID)) body.focus({ preventScroll: true }); }, 0);
    return true;
  }
  // The page's own windows (and a framed window whose toolbar holds focus): the key stops here.
  /* Also while the game help itself is on top (2026-10-08): the same key that opened it
     closes it here, in the capture phase, so the second press never reaches the page or
     the game either (it used to fall through to the bubble-phase handler below, which
     closed the help only after every capture listener -- the game's included -- saw it). */
  window.addEventListener('keydown', e => {
    const top = topEl();
    const overGame = !!top && (GAME_LAYERS.has(top.id) || (top.id === HELP_ID && !!GH));
    if (!overGame || !isGameHelpKey(e)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    ghDown.add(e.code || e.key);
    if (!e.repeat) openGameHelp();
  }, true);
  window.addEventListener('keyup', e => {
    if (!ghDown.has(e.code || e.key)) return;
    ghDown.delete(e.code || e.key);
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  // A framed window's help key or R3 (play/play-keys.js).
  window.addEventListener('message', ev => {
    const d = ev.data;
    if (!d || d.gnwHelp !== 1) return;
    const ov = gameUnder(topEl());
    if (!ov) return;
    const f = ov.querySelector('iframe');
    if (!f || f.contentWindow !== ev.source) return;
    openGameHelp(ov);
  });

  /* ------------------------------------------------------------ the global key handler (with g sequences) */

  let pending = null;          // { first, t }
  /* THE g PANEL (31 Oct: "When pressing g (goto), show the goto options for 5 seconds"). g shows a small
     panel listing each second key and where it goes; it stays 5 s (a line under it runs down), or until
     the second key or Escape. Was a one-line chip for 1.5 s. */
  const SEQ_MS = 5000;
  let gotoT = 0;
  function showGoto(first, seqs) {
    const F = A(); if (!F) return;
    let p = document.getElementById('gk-goto');
    if (!p) {
      p = document.createElement('div');
      p.id = 'gk-goto'; p.setAttribute('role', 'status'); p.setAttribute('aria-live', 'polite');
      document.body.appendChild(p);
    }
    p.style.setProperty('--gk-goto-ms', SEQ_MS + 'ms');
    p.innerHTML = '<p class="gk-goto-h"><kbd>' + esc(F.format(first)) + '</kbd> then</p><ul>' + seqs.map(a =>
      '<li><kbd>' + esc(F.format(a.keys.find(k => k.split(' ')[0] === first).split(' ')[1])) + '</kbd><span>' +
      esc(a.label.replace(/^Go to (the )?/, '').replace(/^Open /, '')) + '</span></li>').join('') + '</ul><div class="gk-goto-bar" aria-hidden="true"></div>';
    p.classList.remove('show'); void p.offsetWidth;   // the line starts again on a second g
    p.classList.add('show');
    clearTimeout(gotoT);
    gotoT = setTimeout(() => { p.classList.remove('show'); pending = null; }, SEQ_MS);
  }
  function hideGoto() { const p = document.getElementById('gk-goto'); if (p) p.classList.remove('show'); clearTimeout(gotoT); }
  function cancelSeq() { if (pending) { pending = null; hideChip(); hideGoto(); } }
  function seqActions(first) {
    const F = A(); if (!F) return [];
    return F.list({ scope: 'global' }).filter(a => a.keys.some(k => k.indexOf(' ') > 0 && k.split(' ')[0] === first));
  }
  function allowed(id, top) {
    if (!top) return true;
    if (GAME_LAYERS.has(top.id)) return false;                       // P7: the game has the keys
    if (top.id === HELP_ID) return id === 'help.open' || (id === 'quick.open' && !GH);   // over a game: only ? (it closes)
    if (overSettings(top)) return id === 'help.open' || id === 'quick.open';            // Settings: ? and the search keys (4 Nov)
    return id === 'help.open';                                       // in a drawer or the player: only ?
  }
  function onKey(e) {
    if (e.defaultPrevented || e.isComposing) { cancelSeq(); return; }
    const F = A(); if (!F) return;
    if (isField(e.target)) { cancelSeq(); return; }                  // P8: a text field owns its keys
    const c = F.comboOf(e);
    if (!c || /^(Control|Alt|Shift|Meta|OS|AltGraph)$/.test(c)) return;
    const top = topEl();
    if (pending) {
      const p = pending; cancelSeq();
      if ((!top || overSettings(top)) && Date.now() - p.t < SEQ_MS) {
        const seq = p.first + ' ' + c;
        const hit = F.list({ scope: 'global' }).find(a => a.keys.includes(seq));
        if (hit) {
          e.preventDefault();
          if (e.repeat) return;
          if (overSettings(top)) { if (hit.id === 'go.settings') return; closeSettings(); }   // Settings steps aside first (4 Nov)
          F.run(hit.id, e); return;
        }
        if (c === 'Escape') { e.preventDefault(); return; }         // Escape just ends the sequence
        /* A letter that is not on the g panel only closes it (31 Oct): with g m gone, g then m would
           otherwise open the focused tile's manual (M). Arrows, Enter and the rest still pass. */
        if (/^[A-Z0-9]$/.test(c)) { e.preventDefault(); return; }
      }
    }
    if (top && GAME_LAYERS.has(top.id)) return;
    const id = F.match(e, 'global');
    if (id) {
      if (!allowed(id, top)) return;
      if (e.repeat && (id === 'system.prev' || id === 'system.next')) { e.preventDefault(); stepSection(id === 'system.prev' ? -1 : 1, true); return; }   // a held , . steps the System Switcher at its steady rate (31 Oct)
      if (e.repeat) { e.preventDefault(); return; }
      if (F.run(id, e) !== false) e.preventDefault();
      return;
    }
    if ((!top || overSettings(top)) && !e.repeat) {
      const seqs = seqActions(c);
      if (seqs.length) {
        e.preventDefault();
        pending = { first: c, t: Date.now() };
        hideChip();
        showGoto(c, seqs);
      }
    }
  }
  window.addEventListener('keydown', onKey);
  // Back on a page with nothing open, in focus mode: bring the toolbar back (one step).
  window.addEventListener('keydown', e => {
    if (e.defaultPrevented || !fmOn() || !onMedia() || topEl()) return;
    const k = K(); if (!k || !k.isBack || !k.isBack(e)) return;
    if (isField(e.target)) return;
    e.preventDefault();
    setFocusMode(false);
  });

  /* ------------------------------------------------------------ the action table */

  function registerAll() {
    const F = A(); if (!F) return;
    const G = 'Everywhere', M = 'Content page';
    /* The search keys and buttons (/, Ctrl+K, the pad's Select, the remote's yellow key) go to the
       Media page's search bar (21 Oct); the id stays so rebinds and pad keys carry over. */
    F.register('quick.open', { label: 'Search: the search bar on the content page', group: G, keys: ['/', 'Ctrl+K'], run: () => searchKey(), palette: false });
    F.register('help.open', { label: 'Show these keys', group: G, keys: ['?'], run: () => openHelp() });
    /* R3 (31 Oct: "Right stick press should open the manual on the tile in the main grid. Currently opens
       help system like the guide button"): on the site R3 is now the M key (keys.js item.manual, bound in
       gamepad.js); the Guide button keeps ?. In a game R3 is still the game's help (gameHelpKeys,
       play/play-pad.js). */
    F.register('game.help', { label: 'Help over the game: its controls and keys (the game waits)', group: 'Play window', scope: 'game', keys: gameHelpKeys() });
    F.onChange(ev => { if (ev.type === 'keys' && ev.id === 'help.open') F.setKeys('game.help', gameHelpKeys()); });
    /* Off our own address there is no Home, Timeline or About (28 Oct; index.html __cwOffsite). */
    if (!window.__cwOffsite) F.register('go.home', { label: 'Go to Home', group: G, keys: ['G H'], run: () => go('/') });
    /* g m (Go to Media) removed 31 Oct ("g then m goes to the media tab, which no longer exists as
       everything is just the media tab"): Home, Features, Timeline, About, Compatibility and Settings are
       windows over the content page and Escape (or Back, or B) closes each of them back to it, tested. */
    if (!window.__cwOffsite) F.register('go.timeline', { label: 'Go to Timeline', group: G, keys: ['G T'], run: () => go('/series') });
    if (!window.__cwOffsite) F.register('go.about', { label: 'Go to About', group: G, keys: ['G A'], run: () => go('/about') });
    if (!window.__cwOffsite) F.register('go.features', { label: 'Go to Features', group: G, keys: ['G E'], run: () => go('/features') });   // 31 Oct
    F.register('go.settings', { label: 'Open Settings', group: G, keys: ['G S'], run: () => openSettings() });
    F.register('go.continue', { label: 'Go to the Continue row', group: G, keys: ['G C'], run: () => { focusContinue(); } });
    F.register('go.search', { label: 'Go to the search box', group: G, keys: ['G F'], run: () => { focusSearch(); } });
    /* ONE KEY, ONE MEANING (31 Oct): [ and ] step the film and series libraries only; , and . (and the
       pad's LB / RB, gamepad.js) drive the System Switcher only. The ids stay so rebinds carry over. */
    F.register('section.prev', { label: 'Previous library (films and series)', group: M, keys: ['['], run: () => stepLibrary(-1), when: onMedia });
    F.register('section.next', { label: 'Next library (films and series)', group: M, keys: [']'], run: () => stepLibrary(1), when: onMedia });
    F.register('system.prev', { label: 'System Switcher: one system back (held: repeats; applied a second after the last press; Enter applies now, Back keeps the system)', group: M, keys: [','], run: () => stepSection(-1), when: onMedia });
    F.register('system.next', { label: 'System Switcher: one system on (held: repeats; applied a second after the last press; Enter applies now, Back keeps the system)', group: M, keys: ['.'], run: () => stepSection(1), when: onMedia });
    F.register('focus.toggle', { label: 'Focus mode: hide the toolbar and library strip', group: M, keys: ['Z'], run: () => { if (!onMedia()) return false; setFocusMode(!fmOn()); }, when: onMedia });
    /* The wall's two switches (5 Nov). Keys: O for mOvies (M is the manual), W for Widgets; neither is used
       by the film player, and a game keeps its own keys. The pad's X and Y reach these first on the wall
       (gamepad.js actionFor); on a Continue card and everywhere else they keep their own meaning. */
    F.register('wall.movies', { label: 'On the wall: Movies (films and shows) on or off', group: M, keys: ['O', 'Pad:X'], palette: false, run: () => wallToggle('media') });
    F.register('wall.widgets', { label: 'On the wall: Widgets on or off', group: M, keys: ['W', 'Pad:Y'], palette: false, run: () => wallToggle('widgets') });
    // Media page actions without a key (quick jump finds them).
    const tb = (sel, label, kw) => ({ label, group: M, keywords: kw, run: async () => { if (!onMedia()) go('/media'); if (fmOn()) setFocusMode(false, { quiet: true }); const b = await waitFor(() => document.querySelector('#view-media ' + sel), 6000); if (b && !b.disabled) b.click(); } });
    F.register('media.showGames', tb('[data-vshow="games"]', 'Show or hide games'));
    F.register('media.showMedia', tb('[data-vshow="media"]', 'Show or hide films and shows'));
    F.register('media.showWidgets', tb('[data-vshow="widgets"]', 'Show or hide widgets'));
    F.register('media.continueRow', tb('[data-vcontinue]', 'Show or hide the Continue row'));
    F.register('media.shuffle', tb('[data-vsort="random"]', 'Shuffle'));
    F.register('media.sort.name', tb('[data-vsort="name"]', 'Sort A–Z'));
    F.register('media.sort.year', tb('[data-vsort="year"]', 'Sort by release date'));
    F.register('media.sort.added', tb('[data-vsort="added"]', 'Sort by date added'));
    F.register('media.sort.rating', tb('[data-vsort="rating"]', 'Sort by rating'));
    F.register('media.art.hardware', tb('[data-vart="hardware"]', 'Artwork: live devices'));
    F.register('media.art.boxart', tb('[data-vart="boxart"]', 'Artwork: box art'));
    if (window.CW_BOX_ART_3D === true) F.register('media.art.boxart3d', tb('[data-vart="boxart3d"]', 'Artwork: 3D box art'));   // hidden until a later release (index.html, 1 Nov)
    const tv = v => () => { const k = K(); if (k && k.setTv) k.setTv(v); chip('TV mode: <b>' + (v === 'auto' ? 'Auto' : v === 'on' ? 'On' : 'Off') + '</b>'); };
    F.register('display.tv.on', { label: 'TV mode: On', group: G, run: tv('on') });
    F.register('display.tv.off', { label: 'TV mode: Off', group: G, run: tv('off') });
    F.register('display.tv.auto', { label: 'TV mode: Auto', group: G, run: tv('auto') });
    // Listed for ?, run by the element that owns the key.
    F.register('tile.open', { label: 'Open the details of a tile, card or row', group: M, scope: 'info', keys: ['Enter'], help: true, reserved: true });
    F.register('continue.remove', { label: 'Remove the focused Continue card (or Up to its × and Enter)', group: M, scope: 'info', keys: ['Delete'] });
  }

  /* ------------------------------------------------------------ the nav bar button, the focus-mode pill, Settings -> Display */

  function mountChrome() {
    ensureStyles();
    /* The top bar's Search item (#nav-jump-btn) is gone (21 Oct): searching is the Media
       page's search bar, and the search keys go there (searchKey). */
    hintTooltips();
    mountFocusPill();
    mountDisplaySetting();
  }
  /* Tooltips carry the key (doc 5.7). Only where this file owns the key. */
  function hintTooltips() {
    const F = A(); if (!F) return;
    const add = (el, id) => {
      if (!el) return;
      // Keys P5: the viewer can rebind keys, so the hint is redrawn from the registry each time.
      if (el.__gkBase == null) el.__gkBase = el.getAttribute('title') || el.textContent.trim();
      // Keyboard keys only: a mouse user's tooltip does not list pad buttons or remote keys.
      const s = (F.shownKeys ? F.shownKeys(F.keysFor(id)) : F.keysFor(id)).filter(k => !/^(Pad:|#|Media|Browser|GoBack|XF86|Channel|AudioVolume|Launch|Info|Guide|ColorF)/.test(k)).map(F.format).join(' or ');
      el.__gkHint = true;
      el.setAttribute('title', s ? el.__gkBase + ' (' + s + ')' : el.__gkBase);
    };
    for (const [route, id] of [['/', 'go.home'], ['/series', 'go.timeline'], ['/about', 'go.about']]) add(document.querySelector('.nav-link[data-route="' + route + '"]'), id);
    add(document.getElementById('nav-vault-btn'), 'go.settings');
    add(document.getElementById('nav-jump-btn'), 'quick.open');
  }
  function mountFocusPill() {
    const sec = document.querySelector('#view-media > .section');
    if (!sec || sec.querySelector('.gk-focus-pill')) return;
    const p = document.createElement('button');
    p.type = 'button'; p.className = 'gk-focus-pill';
    p.innerHTML = 'Focus mode <span aria-hidden="true">·</span> show the toolbar';
    p.title = 'Leave focus mode (Z, or Back)';
    p.addEventListener('click', () => setFocusMode(false));
    sec.insertBefore(p, sec.firstChild);
  }
  function mountDisplaySetting() {
    const panel = document.querySelector('.settings-panel[data-panel="display"]');
    /* settings-config.js moves the section into Configurations: look for it anywhere. */
    if (!panel || document.getElementById('gk-fm-section')) return;
    const s = document.createElement('section');
    s.className = 'vault-section'; s.id = 'gk-fm-section';
    const opt = (v, label) => `<button type="button" class="theme-opt" data-fm-opt="${v}" role="radio" aria-checked="false">${label}</button>`;
    s.innerHTML = `<label style="display:block; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--muted); margin-bottom:6px;">Focus mode</label>
        <p style="color:var(--muted); font-size:12.5px; margin:0 0 12px; line-height:1.55;">
          The content page without its toolbar and library strip: only the Continue row and the tiles.
          Press <kbd>z</kbd> to switch it, or Up past the top row (or Back) to bring the toolbar back. Saved only in this browser.
        </p>
        <div class="theme-toggle" role="radiogroup" aria-label="Focus mode">${opt('off', 'Off')}${opt('on', 'On')}</div>`;
    s.addEventListener('click', e => { const o = e.target.closest('[data-fm-opt]'); if (o) setFocusMode(o.dataset.fmOpt === 'on', { quiet: true }); });
    panel.appendChild(s);
    /* Keyboard shortcuts left Settings for the search bar's own button (24 Oct). */
    syncDisplayUI();
  }
  function syncDisplayUI() {
    document.querySelectorAll('[data-fm-opt]').forEach(b => b.setAttribute('aria-checked', (b.dataset.fmOpt === 'on') === fmOn() ? 'true' : 'false'));
  }

  /* ------------------------------------------------------------ boot */

  function boot() {
    registerAll();
    mountChrome();
    try { if (localStorage.getItem(FM_KEY) === '1') document.body.classList.add('gk-focus'); } catch (_) {}
    syncDisplayUI();
    // The Media view and Settings draw late (emby.js, keys.js): mount again when they appear.
    const vo = document.getElementById('vault-overlay');
    if (vo) new MutationObserver(() => { if (vo.classList.contains('open')) mountDisplaySetting(); }).observe(vo, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('hashchange', () => { setTimeout(() => { mountFocusPill(); hintTooltips(); }, 0); });
    if (A() && A().onChange) A().onChange(ev => { if (ev.type === 'keys') hintTooltips(); });
    setTimeout(mountChrome, 1500);
  }

  window.GnwShortcuts = {
    BUILD, openQuick, openHelp, openGameHelp, pageHTML: () => pageHTML({ window: true }), closeQuick: () => closeLayer(QUICK_ID), closeHelp: () => closeLayer(HELP_ID),
    _gameHelp: () => (GH ? { ov: GH.ov.id, paused: GH.paused } : null),
    focusMode: on => (on === undefined ? fmOn() : setFocusMode(on)), revealAbove, stepSection, landOnWall, wallFree,
    _quick: () => ({ items: Q.items.map(x => ({ kind: x.kind, label: x.label, sub: x.sub, keys: x.keys || null })), sel: Q.sel }),
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

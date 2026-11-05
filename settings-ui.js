/*
 * settings-ui.js -- the Settings window, reorganised (2026-10-11).
 *
 * WHY. Settings grew one tab at a time (Access Code, Appearance, Display, Keyboard &
 * controllers, Content, Data & Recovery) and, on a phone, became a desktop window to scroll
 * through: every tab stood in one grid cell, so each was as tall as the tallest one. As
 * noted then: "It was added to, and now the design is what's broken." Design and inventory:
 * docs/SETTINGS-REDESIGN.md.
 *
 * WHAT. Five pages (24 Oct), each made of the existing panels:
 *     Configurations           = the quick one-choice settings, gathered by settings-config.js
 *                                (Appearance and Display stay here as hidden source panels)
 *     Media and content        = Content (the source tiles, settings-sources.js; Subtitles)
 *     Subtitles                = the subtitle settings (subs.js), moved by settings-config.js
 *     Widgets                  = the ambient widgets, gathered by settings-config.js
 *     Keyboard and controllers = Keyboard & controllers (keybind.js)
 *     Your vault               = the vault note + Access Code + Data & Recovery
 * On a phone (up to 760px wide, or up to 500px tall, or any phone, fold or small tablet: 31 Oct, fit()) the window is a full-screen sheet: header
 * and x pinned, the pages as one row of icon buttons pinned under it (4 Nov), and only the chosen
 * page takes room. A desktop and a TV keep the window with its tab list down the left.
 *
 * HOW, WITHOUT BREAKING ANYONE. Nothing is rebuilt: the panels, their ids, their handlers and
 * their storage keys are the same nodes, MOVED into one wrapper per page. The other files keep
 * working unchanged:
 *   - emby.js, keys.js, shortcuts.js and keybind.js find their panels by
 *     `.settings-panel[data-panel=...]`, which still matches (nested is fine: index.html's
 *     `.settings-panel .settings-panel` rule already shows a nested panel with its parent).
 *   - keys.js and keybind.js decide whether to mount by looking for their tab
 *     (`[data-tab="display"]`, `[data-tab="keys"]`): the old tab buttons stay in the tab list,
 *     hidden, as markers; this page's own buttons carry `data-st`.
 *   - nav.js (arrows, a remote) walks `.settings-tabs .settings-tab` (visible ones) and the
 *     `.settings-panels > .settings-panel.active`: those are now the four page buttons and the
 *     page wrappers, so Up/Down move between pages, Right goes in, Back comes out.
 *   - switchSettingsTab(name) still takes every old name (code, appearance, display, keys,
 *     content, videologin, data, recovery, danger) and shows the page that holds it.
 *   - Settings opens on Look and feel (it opened on Access Code).
 * Panels that mount late (keys.js and keybind.js mount on boot or when Settings opens) are
 * gathered when they appear (a MutationObserver on the panel list) and on every open.
 * Sound: none.
 */
(function () {
  'use strict';
  if (window.GnwSettingsUi) return;
  const BUILD = '20261104-q3a';

  /* 24 Oct: Look and feel became Configurations, the quick one-choice settings in
     accordions (settings-config.js gathers them from every panel); Widgets got its own page.
     'appearance' and 'display' stay on Configurations as hidden source panels. */
  /* ic (4 Nov): each page's icon, the one row of icon buttons on a small screen (see styles()). */
  const PAGES = [
    { id: 'config',  label: 'Configurations',           panels: ['appearance', 'display'],
      ic: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>' },
    { id: 'media',   label: 'Media and content',        panels: ['content'],
      ic: '<rect x="2" y="3" width="20" height="18" rx="2"/><line x1="7" y1="3" x2="7" y2="21"/><line x1="17" y1="3" x2="17" y2="21"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7.5" x2="7" y2="7.5"/><line x1="2" y1="16.5" x2="7" y2="16.5"/><line x1="17" y1="7.5" x2="22" y2="7.5"/><line x1="17" y1="16.5" x2="22" y2="16.5"/>' },
    { id: 'subs',    label: 'Subtitles',                panels: [],
      ic: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 11h8M16 11h2M6 15h4M12 15h6"/>' },
    { id: 'widgets', label: 'Widgets',                  panels: [],
      ic: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>' },
    { id: 'keys',    label: 'Keyboard and controllers', panels: ['keys'],
      ic: '<path d="M7 6h10a5 5 0 0 1 4.9 6l-.8 4.2a2.8 2.8 0 0 1-4.8 1.3L14.5 15.5h-5l-1.8 2a2.8 2.8 0 0 1-4.8-1.3L2.1 12A5 5 0 0 1 7 6z"/><path d="M6 11.5h4M8 9.5v4"/><circle cx="15.5" cy="10.5" r=".6"/><circle cx="17.5" cy="13" r=".6"/>' },
    { id: 'vault',   label: 'Your vault',               panels: ['code', 'data'],
      ic: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' },
  ];
  // Every name a caller may pass, to its page. The old aliases of index.html stay valid.
  const PAGE_OF = { videologin: 'media', recovery: 'vault', danger: 'vault', look: 'config' };
  for (const pg of PAGES) { PAGE_OF[pg.id] = pg.id; for (const p of pg.panels) PAGE_OF[p] = pg.id; }

  const $ = s => document.querySelector(s);
  const ov = () => document.getElementById('vault-overlay');
  const tabsEl = () => $('#vault-overlay .settings-tabs');
  const panelsEl = () => $('#vault-overlay .settings-panels');
  let current = 'config';

  /* ------------------------------------------------------------ styles */
  function styles() {
    if (document.getElementById('st-style')) return;
    const st = document.createElement('style');
    st.id = 'st-style';
    st.textContent = `
      /* The old tab buttons: kept as markers for keys.js / keybind.js, never shown. */
      #vault-overlay .settings-tabs > .st-legacy { display: none !important; }
      /* A page wrapper is a .settings-panel (the grid cell and the .active rule apply); the
         panels inside it are nested and follow it. */
      #vault-overlay .st-page { gap: 14px; }
      #vault-overlay .st-page > .settings-panel { gap: 14px; }
      #vault-overlay .st-note { margin: 0 !important; }
      /* TV mode and Focus mode mark their choice with aria-checked only, so the chosen one
         never looked chosen. Same look as a chosen theme. */
      #vault-overlay .theme-opt[aria-checked="true"] { color: var(--text); border-color: rgba(var(--accent-rgb),.5); background: rgba(var(--accent-rgb),.12); }

      /* FULL SCREEN BY SIZE OR BY DEVICE (31 Oct: "Settings opens full screen on smaller devices like
         the fold, open or closed, either way up"). The sheet was a media query (760 px wide or 500 px
         tall); an opened fold on its side is wider and taller than that and got the desk's window. The
         rules below now hang on the class st-full, which fit() sets on the overlay by the same size rule
         OR by window.gnwHandheld() (a phone, a fold or a small tablet, whatever way up; see below). */
      #vault-overlay.st-full { padding: 0; overflow: hidden; }
      #vault-overlay.st-full .modal {
        max-width: none !important; width: 100%; margin: 0;
        height: 100vh; height: 100dvh; max-height: 100vh; max-height: 100dvh;
        border: 0; border-radius: 0;
      }
      #vault-overlay.st-full .modal-head {
        padding: 6px 8px 6px 16px; padding-top: max(6px, env(safe-area-inset-top));
        display: flex; align-items: center; justify-content: space-between; gap: 10px;
      }
      /* "Settings" is the title here; the version moves beside it, small. */
      #vault-overlay.st-full .modal-head .modal-sub { font-size: 17px; font-weight: 800; letter-spacing: 0; text-transform: none; color: var(--text); display: inline; }
      #vault-overlay.st-full .modal-head .modal-title { font-size: 12px; font-weight: 600; color: var(--muted); display: inline; margin-left: 8px; }
      #vault-overlay.st-full .modal-close { width: 44px; height: 44px; flex: 0 0 auto; }
      #vault-overlay.st-full .article {
        padding: 0 12px 22px !important; padding-bottom: max(22px, env(safe-area-inset-bottom)) !important;
        overscroll-behavior: contain;
      }
      #vault-overlay.st-full .settings-layout { display: block; }
      /* ONE ROW OF ICON BUTTONS (4 Nov: "replace the stacked text tabs with one row of small icon
         buttons"). On a small screen the pages were two columns of text buttons, three rows deep, a
         good part of a phone's height. They are one row of icons now; the name of the page the focus
         or pointer is on (else the chosen page) shows under the row, and each button is still named
         by its text for a screen reader. Left / Right move along the row (nav.js reads a one-row
         list that way), Down goes into the page. The desk keeps its text tabs down the left. */
      #vault-overlay .settings-tab > .st-ic { display: none; }
      #vault-overlay .settings-tabs > .st-cap { display: none; }
      #vault-overlay.st-full .settings-tabs {
        position: sticky; top: 0; z-index: 2;
        display: flex; flex-direction: row; flex-wrap: wrap; justify-content: center; gap: 6px;
        margin: 0 -12px 12px; padding: 8px 12px 6px; width: auto;
        background: var(--bg-1); border-bottom: 1px solid var(--line);
      }
      #vault-overlay.st-full .settings-tabs > .settings-tab {
        flex: 1 1 0; min-width: 40px; max-width: 96px; min-height: 44px; height: 44px; padding: 0;
        justify-content: center; border-color: var(--line);
      }
      #vault-overlay.st-full .settings-tabs > .settings-tab > .st-ic { display: block; flex: 0 0 auto; }
      #vault-overlay.st-full .settings-tabs > .settings-tab > .st-lbl {
        position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0;
        overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap;
      }
      #vault-overlay.st-full .settings-tabs > .settings-tab { position: relative; }
      #vault-overlay.st-full .settings-tabs > .settings-tab.active { border-color: rgba(var(--accent-rgb),.5); }
      #vault-overlay.st-full .settings-tabs > .settings-tab:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
      #vault-overlay.st-full .settings-tabs > .st-cap {
        display: block; flex: 1 0 100%; text-align: center; min-height: 16px;
        font-size: 12.5px; line-height: 16px; font-weight: 700; color: var(--accent);
      }
      #vault-overlay.st-full .settings-tabs > .st-cap.st-cap-other { color: var(--text); }
      :root[data-theme="light"] #vault-overlay.st-full .settings-tabs > .st-cap:not(.st-cap-other) { color: var(--accent-ink, var(--accent)); }
      /* The Home screen note is a D-pad stop (install-app.js, 4 Nov): its focus is shown. */
      #vault-overlay #gnw-install-section:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
      #vault-overlay.st-full .settings-panels { display: block; }
      #vault-overlay.st-full .settings-panels > .settings-panel { display: none; }
      #vault-overlay.st-full .settings-panels > .settings-panel.active { display: flex; }
      #vault-overlay.st-full .vault-section { padding: 12px; }
      #vault-overlay.st-full .theme-toggle { flex-wrap: wrap; }
      #vault-overlay.st-full .theme-opt, #vault-overlay.st-full .btn-tiny, #vault-overlay.st-full .kb-btn,
      #vault-overlay.st-full .vault-section button:not(.accent-swatch) { min-height: 44px; }
      #vault-overlay.st-full .accent-swatches { gap: 8px; }
      #vault-overlay.st-full .accent-swatch { width: 40px; height: 40px; }
      #vault-overlay.st-full input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]),
      #vault-overlay.st-full select { min-height: 44px; }
      #vault-overlay.st-full .kb-scroll { max-height: none; overflow: visible; padding-right: 0; }
      /* NOTHING TO SCROLL INTO (31 Oct: "I am able to scroll on the Settings / Media and content tab
         even though there is nothing to scroll in to except blank space"). Every page stood in one grid
         cell so the window kept the tallest page's height (Your vault, about 1,190 px), and every shorter
         page could be scrolled down into that empty height. A page that is not shown now takes no room;
         the window keeps one fixed height instead (as tall as it already was: 92% of the screen, never
         more than the screen less the overlay's own margin), so it still does not jump between pages,
         and a page scrolls only when it is taller than the window. */
      #vault-overlay .settings-panels > .settings-panel:not(.active) { display: none; }
      #vault-overlay:not(.st-full) .modal { height: min(92vh, calc(100vh - 80px)); max-height: min(92vh, calc(100vh - 80px)); }
    `;
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------ a phone, a fold, a small tablet */
  /* window.gnwHandheld() (31 Oct; also used by emby.js for the Systems menu). "The system menu on
     smaller devices like my phone should open full screen ... only an issue when my fold phone is open
     in landscape. This was reported before but not fixed." The rule of the morning (a coarse pointer
     and no fine one) could miss the fold: a Samsung with pen support, or Samsung's own pointer
     reporting, can say (any-pointer: fine) and (hover: hover) although nothing but a finger is used.
     What an opened Galaxy Fold reads: navigator.maxTouchPoints 5 or more, a screen of about 904 x 1085
     CSS pixels either way up (screen.width/height do not change with the browser window), an Android
     user agent; (pointer: coarse) usually true, (any-pointer: fine) and (hover: hover) true or false
     depending on the pen. So: a touch screen whose screen is at most 1400 CSS pixels on its long side
     and 1100 on its short side, AND either a phone or tablet system (Android, iPhone, iPad, or the
     browser's own "mobile" hint; Chrome's "desktop site" on Android names Linux on X11, which no desk
     with a touch screen here is) or, for any other system, a coarse pointer with no fine one beside it.
     A desk with a mouse (no touch points, or Windows with a trackpad), a touch laptop, a desk browser that reports
     no touch points at all and a television (body.gnw-tv) are never handheld. */
  function handheld() {
    try {
      if (document.body && document.body.classList.contains('gnw-tv')) return false;
      if (!((navigator.maxTouchPoints || 0) > 0)) return false;
      const s = window.screen || {}, a = s.width || 0, b = s.height || 0;
      if (!a || !b || Math.max(a, b) > 1400 || Math.min(a, b) > 1100) return false;
      const ua = navigator.userAgent || '', uad = navigator.userAgentData;
      if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (uad && uad.mobile) || (/X11; Linux/i.test(ua) && !/CrOS/i.test(ua))) return true;
      return matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
    } catch (_) { return false; }
  }
  window.gnwHandheld = handheld;
  /* ONE SMALL-DEVICE CLASS FOR EVERY WINDOW (31 Oct: "Keyboard shortcuts needs to be full screen
     like the pages are on mobile devices"). html.cw-small is the rule the pages, the Systems menu and
     Settings use (760 px wide or 500 px tall or less, or a handheld), kept current from the first frame
     and on every change of size or way up, so every window (the key list, quick jump, the controller
     test, confirmations, game-server dialogs, pictures) can open full screen by the same rule.
     emby.js aboutSmall() sets the same class by the same rule. */
  function small() {
    const vv = window.visualViewport;
    const w = vv ? vv.width : window.innerWidth, h = vv ? vv.height : window.innerHeight;
    const on = w <= 760 || h <= 500 || handheld();
    const de = document.documentElement;
    if (de.classList.contains('cw-small') !== on) de.classList.toggle('cw-small', on);
    return on;
  }
  window.gnwSmall = small;
  small();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', small, { once: true });
  window.addEventListener('resize', small);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', small);
  window.addEventListener('orientationchange', () => setTimeout(small, 120));
  /* Settings full screen (st-full): 760 px wide or 500 px tall or less, or a handheld. Set on every
     open and every change of size or way up. */
  function fit() {
    const o = ov(); if (!o) return;
    const vv = window.visualViewport;
    const w = vv ? vv.width : window.innerWidth, h = vv ? vv.height : window.innerHeight;
    const full = w <= 760 || h <= 500 || handheld();
    if (o.classList.contains('st-full') !== full) o.classList.toggle('st-full', full);
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 120));

  /* ------------------------------------------------------------ the pages */
  function organise() {
    const tabs = tabsEl(), panels = panelsEl();
    if (!tabs || !panels) return false;
    styles();
    fit();
    // The page buttons, first in the list, in order.
    let prev = null;
    for (const pg of PAGES) {
      let b = tabs.querySelector('.settings-tab[data-st="' + pg.id + '"]');
      if (!b) {
        b = document.createElement('button');
        b.type = 'button'; b.className = 'settings-tab'; b.dataset.st = pg.id; b.dataset.tab = pg.id;
        b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', 'false');
        b.id = 'st-tab-' + pg.id; b.setAttribute('aria-controls', 'st-page-' + pg.id);
        // An icon (shown on a small screen only) and the name (the desk's tab text; on a small
        // screen it is read out and shown under the row, see cap()).
        b.innerHTML = '<svg class="st-ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + pg.ic + '</svg><span class="st-lbl"></span>';
        b.querySelector('.st-lbl').textContent = pg.label;
        b.addEventListener('click', () => window.switchSettingsTab(pg.id));
        b.addEventListener('focus', cap); b.addEventListener('blur', () => setTimeout(cap, 0));
        b.addEventListener('pointerenter', () => cap(b)); b.addEventListener('pointerleave', () => cap());
      }
      const want = prev ? prev.nextSibling : tabs.firstChild;
      if (b !== want) tabs.insertBefore(b, want);
      prev = b;
    }
    // The name under the row of icons (small screens): the page the focus is on, else the chosen one.
    let c = tabs.querySelector(':scope > .st-cap');
    if (!c) { c = document.createElement('div'); c.className = 'st-cap'; c.dataset.st = '_cap'; c.setAttribute('aria-hidden', 'true'); }
    if (c.previousElementSibling !== prev) tabs.insertBefore(c, prev.nextSibling);
    // Every other tab button is an old marker.
    for (const b of Array.from(tabs.children)) {
      if (b.dataset.st) continue;
      if (b.classList.contains('settings-tab')) { b.classList.remove('settings-tab', 'active'); b.classList.add('st-legacy'); }
      b.hidden = true; b.tabIndex = -1; b.setAttribute('aria-hidden', 'true');
    }
    // The page wrappers, and each panel moved into its page, in the page's order.
    for (const pg of PAGES) {
      let w = panels.querySelector(':scope > .st-page[data-st="' + pg.id + '"]');
      if (!w) {
        w = document.createElement('div');
        w.className = 'settings-panel st-page'; w.dataset.st = pg.id; w.dataset.panel = pg.id;
        w.id = 'st-page-' + pg.id; w.setAttribute('role', 'tabpanel'); w.setAttribute('aria-labelledby', 'st-tab-' + pg.id);
        panels.appendChild(w);
      }
      for (const name of pg.panels) {
        const p = panels.querySelector(':scope > .settings-panel[data-panel="' + name + '"]:not(.st-page)');
        if (p) { p.classList.remove('active'); p.removeAttribute('role'); w.appendChild(p); }
      }
      // Keep the page's panels in the listed order (a late mount lands at the end).
      for (const name of pg.panels) { const p = w.querySelector(':scope > .settings-panel[data-panel="' + name + '"]'); if (p) w.appendChild(p); }
    }
    // The vault note ("No passwords. No accounts. Just a vault code.") belongs on the vault page.
    const art = $('#vault-overlay .article');
    const note = art && Array.from(art.children).find(c => !c.classList.contains('settings-layout') && /vault code/i.test(c.textContent || ''));
    const vw = panels.querySelector(':scope > .st-page[data-st="vault"]');
    if (note && vw) { note.classList.add('st-note'); vw.insertBefore(note, vw.firstChild); }
    mark(current);
    return true;
  }

  function mark(id) {
    const tabs = tabsEl(), panels = panelsEl(); if (!tabs || !panels) return;
    tabs.querySelectorAll(':scope > .settings-tab').forEach(b => { const on = b.dataset.st === id; b.classList.toggle('active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    panels.querySelectorAll(':scope > .settings-panel').forEach(p => p.classList.toggle('active', p.dataset.st === id));
    cap();
  }
  /* The row's caption (4 Nov): the name of the page button under the pointer or the focus, else of
     the chosen page, so each icon says what it is when it is reached with the D-pad or a key. */
  function cap(over) {
    const tabs = tabsEl(); if (!tabs) return;
    const c = tabs.querySelector(':scope > .st-cap'); if (!c) return;
    const a = document.activeElement;
    const b = (over && over.nodeType === 1 && over.dataset && over.dataset.st ? over : null) ||
      (a && a.parentNode === tabs && a.dataset.st ? a : null) || tabs.querySelector(':scope > .settings-tab.active');
    const l = b && b.querySelector('.st-lbl');
    const t = l ? l.textContent : '';
    if (c.textContent !== t) c.textContent = t;
    c.classList.toggle('st-cap-other', !!b && !b.classList.contains('active'));
  }

  /* Each page's own refresh, as the old tab buttons did when clicked. */
  function refresh(id) {
    try {
      if (id === 'keys' && window.GnwKeybind) window.GnwKeybind.render();
      if (id === 'media' && typeof window.gnwRenderContentStatus === 'function') window.gnwRenderContentStatus();
      if (id === 'config') syncLook();
      if (window.GnwConfig) window.GnwConfig.refresh();
    } catch (e) { console.warn('[settings] refresh', e); }
  }
  function syncLook() {
    try {
      {
        // Theme first: gnwSyncThemeUI() marks EVERY .theme-opt on the page by data-theme-opt, so it
        // also unticks the TV mode and Focus mode choices (same class). They are redrawn after it.
        if (typeof window.gnwSyncThemeUI === 'function') window.gnwSyncThemeUI();
        if (typeof window.gnwSyncAccentUI === 'function') window.gnwSyncAccentUI();
        if (window.GnwKeys && window.GnwKeys.applyTv) window.GnwKeys.applyTv();   // redraws the TV mode choice (same state)
        const S = window.GnwShortcuts;
        if (S && S.focusMode) { const on = !!S.focusMode(); document.querySelectorAll('#vault-overlay [data-fm-opt]').forEach(b => b.setAttribute('aria-checked', (b.dataset.fmOpt === 'on') === on ? 'true' : 'false')); }
      }
    } catch (e) { console.warn('[settings] sync', e); }
  }

  /* switchSettingsTab(name): every old name still works. Replaces index.html's function (the
     inline onclick handlers and the other files call it by name, which resolves to this). */
  function switchTo(name) {
    organise();
    const id = PAGE_OF[name] || 'config';
    const changed = id !== current;
    current = id;
    mark(id);
    refresh(id);
    const art = $('#vault-overlay .article');
    if (changed || !name || PAGE_OF[name] === name) { if (art) art.scrollTop = 0; const o = ov(); if (o) o.scrollTop = 0; }
    // A name for one part of a page (data, videologin, display...): bring that part into view.
    if (name && PAGE_OF[name] !== name && !(PAGES.find(p => p.id === id).panels[0] === name)) {
      const part = $('#vault-overlay .settings-panel[data-panel="' + name + '"]');
      if (part && part.getClientRects().length) { try { part.scrollIntoView({ block: 'start' }); } catch (_) {} }
    }
    // Media and content: the source tiles (settings-sources.js, 2026-10-24). 'videologin' opens the
    // media server's panel; any other way onto the page shows the tiles.
    if (id === 'media' && window.GnwSources) { try { window.GnwSources.onShow(name); } catch (e) { console.warn('[settings] sources', e); } }
  }

  function install() {
    if (!organise()) return false;
    window.switchSettingsTab = switchTo;
    // Picking a theme redraws every .theme-opt, which unticked TV mode and Focus mode beside it
    // (they share the class): redraw those two straight after.
    const syncOrig = window.gnwSyncThemeUI;
    if (typeof syncOrig === 'function' && !syncOrig.__st) {
      let busy = false;
      const w = function () { const r = syncOrig.apply(this, arguments); if (!busy) { busy = true; try { syncLook(); } finally { busy = false; } } return r; };
      w.__st = true; window.gnwSyncThemeUI = w;
    }
    // Settings opens on the first page (Configurations). openVaultModal() asks for 'code'.
    const openOrig = window.openVaultModal;
    if (typeof openOrig === 'function' && !openOrig.__st) {
      const wrapped = function () { const r = openOrig.apply(this, arguments); switchTo('config'); return r; };
      wrapped.__st = true;
      window.openVaultModal = wrapped;
    }
    // Late mounts (keys.js Display, keybind.js Keyboard & controllers, shortcuts.js sections).
    const panels = panelsEl(), tabs = tabsEl();
    const mo = new MutationObserver(() => { mo.disconnect(); organise(); mo.observe(panels, { childList: true }); mo.observe(tabs, { childList: true }); });
    mo.observe(panels, { childList: true }); mo.observe(tabs, { childList: true });
    const o = ov();
    if (o) new MutationObserver(() => { if (o.classList.contains('open')) organise(); }).observe(o, { attributes: true, attributeFilter: ['class'] });
    mark(current);
    return true;
  }

  window.GnwSettingsUi = { BUILD, pages: () => PAGES.map(p => ({ id: p.id, label: p.label, panels: p.panels.slice() })), current: () => current, show: switchTo };

  const boot = () => { if (!install()) setTimeout(install, 1500); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

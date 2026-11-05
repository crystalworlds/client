/*
 * nav.js -- keyboard first, phase 2: "arrows everywhere" (2026-10-04).
 *
 * The design is docs/tv-controller-support.md (sections 5.4, 5.6 and 7, phase 2).
 * keys.js (phase 1) owns Back, the layer stack and focus in and out of layers;
 * this file owns the arrow keys. In one place:
 *
 *   ZONES. The Media page is a column of zones, top to bottom: the nav bar, the
 *   toolbar, the search box, the library strip, the Continue row, the people /
 *   collections strips and the grid. The other pages are the nav bar plus the
 *   page body. An arrow moves to the nearest focusable thing in that direction
 *   INSIDE the zone, measured from on-screen rectangles (so the stacked/masonry
 *   grid is walked as it looks, not in DOM order). At the zone's top or bottom
 *   edge, Up/Down go to the zone above/below; Left/Right stop at the ends.
 *
 *   MEMORY. Every zone remembers the element last focused in it, and coming back
 *   to the zone goes there (as tvOS does), found again by its data-id after a
 *   re-render.
 *
 *   ONE TAB STOP PER ZONE (WAI-ARIA roving tabindex): the toolbar, the library
 *   strip, the Continue row, the grid, the Timeline list and the Settings tab
 *   list each have one tabindex=0 item (the remembered one); the rest are -1.
 *
 *   LAYERS. In an open drawer, episode info or Settings, arrows walk that
 *   layer's controls by position (Resume/Play, seasons, episodes, More Like
 *   This, cast). Settings: the tab list is a vertical tablist (Up/Down move
 *   and select, Home/End), Right goes into the tab's controls, Left at their
 *   edge and Back return to the tab, a second Back closes Settings.
 *
 *   NOT STOLEN: text fields (except Down out of the Media search box), range
 *   sliders, selects, radios, anything with its own arrow role, a play window
 *   or its pause menu (the game owns the keys), the video player, the
 *   lightbox and the manual (their own arrows), and any key a handler nearer
 *   the focus already took (the Continue row, the home banner).
 *
 *   NOTHING FOCUSED (a TV remote's first press): focus goes to the Continue
 *   row if it is there, else the first tile (other pages: their first item).
 *
 * Mouse and touch: a click still focuses what it hits (the browser's rule) and
 * no ring shows for it; focus moved by a key shows the ring by :focus-visible.
 *
 * THE MOUSE AND THE SCROLL MOVE THE CURSOR (nav5, 2026-10-04: "the mouse
 * should update where the cursor is"). From real pointermove / pointerdown and
 * wheel / scroll / touchmove events, never from hover media queries (a desktop
 * Chrome can report no hover and a coarse pointer, yet have a mouse):
 *   - Moving the mouse over, or pressing on, a zone item (a tile, a row item, a
 *     toolbar or nav button; not a text field, not inside a layer) makes it the
 *     cursor: its zone's memory and tab stop. Focus does not move and no ring
 *     shows (doc 5.6, "Mouse does not steal focus"). The next arrow moves FROM it.
 *   - After the page was scrolled (or clicked) by the user, if the cursor is off
 *     screen, the next arrow does not scroll back. If the pointer is on an item,
 *     the arrow moves from that item. Otherwise the first press only LANDS the
 *     ring on the visible item nearest the pointer (or nearest the middle of the
 *     screen when the pointer is outside the window), and later presses move
 *     from there.
 *   - Keyboard only: nothing changes (a resting mouse sends no pointermove; our
 *     own smooth scrolls are not counted as the user's).
 * Sound: none.
 *
 * Phase 3 builds an action registry on this: ACTIONS below is the one table
 * of what this file does, and KEYS the one table of which key does it. If
 * window.Actions exists (now or later) every action is registered there.
 *
 * KEYS P3 (2026-10-04): registered with actions.js (scope 'nav'); a key is
 * looked up in the registry and run through it (KEYS stays the fallback and
 * the defaults). Also here now: doc row 2.4, the TV tile lift (ring plus a
 * 1.05 scale and a soft shadow on the focused tile, no scale with reduced
 * motion) and larger tiles in TV mode; and the focus-mode hook (shortcuts.js):
 * Up past the Media page's top row brings the hidden toolbar back.
 */
(function () {
  'use strict';
  if (window.GnwNav) return;

  const BUILD = '20261004-nav5';

  /* ------------------------------------------------------------ the two tables */

  const KEYS = {
    ArrowUp: 'nav.up', ArrowDown: 'nav.down', ArrowLeft: 'nav.left', ArrowRight: 'nav.right',
    Home: 'nav.first', End: 'nav.last', PageUp: 'nav.pageUp', PageDown: 'nav.pageDown',
  };
  const ACTIONS = {
    'nav.up':       { label: 'Move up',               run: () => move('up') },
    'nav.down':     { label: 'Move down',             run: () => move('down') },
    'nav.left':     { label: 'Move left',             run: () => move('left') },
    'nav.right':    { label: 'Move right',            run: () => move('right') },
    'nav.first':    { label: 'First in this row',     run: () => move('first') },
    'nav.last':     { label: 'Last in this row',      run: () => move('last') },
    'nav.pageUp':   { label: 'One screen up',         run: () => move('pageUp') },
    'nav.pageDown': { label: 'One screen down',       run: () => move('pageDown') },
    'nav.zone.continue': { label: 'Go to the Continue row', run: () => focusZone('continue') },
    'nav.zone.grid':     { label: 'Go to the grid',         run: () => focusZone('grid') },
    'nav.zone.search':   { label: 'Go to the search box',   run: () => focusZone('search') },
    'nav.zone.library':  { label: 'Go to the library strip', run: () => focusZone('library') },
    'nav.zone.toolbar':  { label: 'Go to the toolbar',       run: () => focusZone('toolbar') },
    'nav.zone.nav':      { label: 'Go to the nav bar',       run: () => focusZone('nav') },
  };
  // Keys that only make sense on a row or grid item (never taken elsewhere).
  const ZONE_ONLY = new Set(['nav.first', 'nav.last', 'nav.pageUp', 'nav.pageDown']);
  // The same four as move() directions. (Keys P5 fix: move() used to test its direction against
  // the action ids above, so PageUp / PageDown / Home / End never reached the row and page rules.)
  const ZONE_DIRS = new Set(['first', 'last', 'pageUp', 'pageDown']);

  /* ------------------------------------------------------------ helpers */

  const K = () => window.GnwKeys || null;
  const topEl = () => { const k = K(); return k && k.topLayer ? k.topLayer() : null; };
  const isTV = () => !!(window.GNW_TV && window.GNW_TV.isTV) || document.body.classList.contains('gnw-tv');
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };

  function isField(t) {
    if (!t || t.nodeType !== 1) return false;
    if (t.isContentEditable) return true;
    const tag = t.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag !== 'INPUT') return false;
    return !/^(button|checkbox|submit|reset|image|color|file)$/i.test(t.type || 'text');   // range and radio count as fields here: they own their arrows
  }
  // Widgets with their own arrow keys (APG roles), and media elements.
  const OWN_ARROWS = '[role="slider"], [role="spinbutton"], [role="menu"], [role="menubar"], [role="listbox"], [role="tree"], [role="treegrid"], [role="grid"], video, audio, iframe';

  // Layers whose arrows belong to someone else.
  const SKIP_LAYERS = new Set(['video-player-overlay', 'gk-pause', 'lightbox-overlay', 'manual-overlay', 'video-trailer-overlay', 'gk-quick', 'gk-help',
    'play-overlay', 'pm-play-overlay', 'gb-play-overlay', 'nes-play-overlay', 'atari-play-overlay', 'tft-play-overlay', 'tj-play-overlay']);

  function visible(el) {
    if (!el || !el.isConnected) return false;
    if (!el.getClientRects().length) return false;
    if (el.closest('[hidden], [inert]')) return false;
    /* INSIDE A CLOSED <details> IS NOT ON SCREEN (2026-10-17: in Settings >
       Keyboard and controllers "I can expand out Navigation with the Enter key, but I cannot
       move around it", the arrows "just scroll"). Chrome keeps a closed section's content as
       content-visibility:hidden, so its controls still report client rects (stale positions)
       and nearest() chose them; focus() then refused, the move returned false, the key was not
       taken and the browser scrolled the panel instead. Only the section's own summary counts. */
    for (let d = el.closest('details:not([open])'); d; d = d.parentElement && d.parentElement.closest('details:not([open])')) {
      const sum = d.querySelector(':scope > summary');
      if (!sum || !(sum === el || sum.contains(el))) return false;
    }
    try { if (el.checkVisibility && !el.checkVisibility({ contentVisibilityAuto: false, visibilityProperty: true })) return false; } catch (_) {}
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  }
  const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]';
  function focusablesIn(root) {
    return Array.from(root.querySelectorAll(FOCUSABLE)).filter(el => visible(el) && (el.tabIndex >= 0 || el.hasAttribute('data-gn-item')) && !el.closest('[aria-hidden="true"]'));
  }

  /* ------------------------------------------------------------ zones */

  const activeView = () => document.querySelector('main .view.active') || document.querySelector('.view.active');
  const onMedia = () => { const v = activeView(); return !!v && v.id === 'view-media'; };
  const toolbarRow = () => document.querySelector('#view-media .collection-toolbar .view-mode-row');
  const gamesMenu = () => document.querySelector('#view-media .vgames-menu');
  /* The systems menu's opener sits in the toolbar's Display menu now (2026-10-19); while that
     menu is shut, the Display button stands in for it (emby.js _vgCaretEl does the same). */
  const gamesCaret = () => { const c = document.querySelector('#view-media [data-vgames-menu]'); return (c && visible(c)) ? c : (document.querySelector('#view-media [data-vdd-btn="display"]') || c); };

  /* id, root(), items(root), roving, preferred (the item to hold the tab stop
     when nothing is remembered). In order from the top of the page. */
  const MEDIA_ZONES = [
    { id: 'nav', root: () => document.querySelector('header'), items: r => focusablesIn(r) },
    { id: 'toolbar', root: toolbarRow, roving: true, prefer: '.view-mode-icon-btn.active',
      items: r => Array.from(r.querySelectorAll('button')).filter(b => !b.disabled && !b.closest('.vgames-menu, .vtb-menu') && !b.classList.contains('vg-tab') && visible(b)) },   // an open Views/Sorting/Display menu keeps its own items; the Systems tab (right edge) is reached from the wall (29 Oct)
    { id: 'search', root: () => document.querySelector('#view-media .collection-toolbar .filter-bar'), items: r => focusablesIn(r) },
    /* THE WINDOW UNDER THE BAR (22 Oct): Home, About and Timeline (emby.js aboutSet) hang
       under the search bar while the tiles behind are inert. Down from the bar goes into it and the
       arrows walk its links and buttons. Compatibility keeps its own keys (compat.js). */
    { id: 'window', root: () => { const w = document.getElementById('video-about'); return w && !w.hidden && w.dataset.kind !== 'compat' ? w : null; },
      items: r => focusablesIn(r) },
    { id: 'library', root: () => document.getElementById('video-library'), roving: true, prefer: '.video-cat-btn.active',
      items: r => Array.from(r.querySelectorAll('.video-cat-btn')).filter(visible) },
    { id: 'continue', root: () => document.getElementById('video-continue'), roving: true,
      items: r => Array.from(r.querySelectorAll('[data-cr-open]')).filter(visible),
      extra: r => Array.from(r.querySelectorAll('[data-cr-remove]')) },          // reached by Up from a card (continuerow.js)
    { id: 'people', root: () => document.getElementById('video-people'), items: r => focusablesIn(r) },
    { id: 'collections', root: () => document.getElementById('video-collections'), items: r => focusablesIn(r) },
    { id: 'banner', root: () => document.getElementById('video-person-banner'), items: r => focusablesIn(r) },
    { id: 'grid', root: () => document.getElementById('video-grid'), roving: true,
      /* A far tile is not drawn (.cw-far, index.html _farWatch) but is still the next tile: held
         arrows outrun the smooth scroll, and without it the next press left the wall for the
         toolbar (2026-10-24). go() draws it before focusing it. */
      items: r => Array.from(r.children).filter(gridItemOk) },   // same test as before, cheaper (see gridItemOk)
  ];
  const PAGE_ZONES = [
    MEDIA_ZONES[0],
    { id: 'page', root: () => activeView(), items: r => focusablesIn(r),
      roving: false },
  ];
  // The Timeline list is one Tab stop too.
  const TIMELINE = { id: 'timeline', root: () => document.getElementById('timeline-list'), roving: true,
    items: r => Array.from(r.querySelectorAll('.tl-item[tabindex]')).filter(visible) };

  function zones() {
    if (onMedia()) return MEDIA_ZONES;
    const v = activeView();
    if (v && v.id === 'view-series') return [MEDIA_ZONES[0], TIMELINE, PAGE_ZONES[1]];
    return PAGE_ZONES;
  }
  function zoneById(id) { return zones().find(z => z.id === id) || MEDIA_ZONES.find(z => z.id === id) || null; }
  /* The zone an element sits in, with its live root and items. */
  function zoneOf(el) {
    if (!el || el.nodeType !== 1) return null;
    for (const z of zones()) {
      const r = z.root();
      if (!r || !r.contains(el)) continue;
      if (z.id === 'page' && TIMELINE.root() && TIMELINE.root().contains(el)) continue;
      return { z, r };
    }
    return null;
  }
  function liveItems(z) { const r = z.root(); if (!r || !visible(r)) return []; return z.items(r); }

  /* THE WALL'S NEXT TILE, CHEAPLY (2026-10-28). Every arrow on the Media wall used to
     build the list of every tile on the page (1,600 and more), with the full on-screen test for
     each, and did it three times a press (the move, then focusin and the tab stop): about 15 ms a
     press, frames lost while a key, the remote or the pad is held (stacked layout about 18 fps).
     The choice is the same as before, made cheaper:
       - gridItemOk is visible() reduced to what can differ between children of a wall already
         found on screen (the ancestors' hidden, inert and closed-details tests are the wall's own);
       - gridPick scores every tile from its box (cheap) and runs the on-screen test only on the
         best one, then the next best if that one fails: the lowest score wins, the earlier tile
         on a tie, exactly as nearest() and the PageUp/PageDown loop chose. */
  function gridItemOk(el) {
    if (!el.hasAttribute('tabindex')) return false;
    if (el.classList.contains('cw-far')) return true;
    if (!el.getClientRects().length) return false;
    if (el.hasAttribute('hidden') || el.hasAttribute('inert')) return false;
    if (el.tagName === 'DETAILS' && !el.hasAttribute('open')) return false;       // a closed one is only its summary
    try { if (el.checkVisibility) return el.checkVisibility({ contentVisibilityAuto: false, visibilityProperty: true }); } catch (_) {}
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  }
  function gridPick(root, score) {
    const kids = root.children, n = kids.length, sc = new Float64Array(n);
    for (let i = 0; i < n; i++) { const c = kids[i]; const s = c.hasAttribute('tabindex') ? score(c) : null; sc[i] = s == null ? Infinity : s; }
    for (;;) {
      let bi = -1, bs = Infinity;
      for (let i = 0; i < n; i++) if (sc[i] < bs) { bs = sc[i]; bi = i; }
      if (bi < 0) return null;
      if (gridItemOk(kids[bi])) return kids[bi];
      sc[bi] = Infinity;
    }
  }
  /* A move from a wall tile (a, a child of the wall root, on screen). null: not handled here. */
  function gridMove(a, root, dir) {
    const kids = root.children;
    if (dir === 'first' || dir === 'last') {
      if (window._cwWallEdge) window._cwWallEdge(dir);   // the true first or last tile back on the page (index.html)
      if (dir === 'first') { for (let i = 0; i < kids.length; i++) if (gridItemOk(kids[i])) return go(kids[i], false); }
      else { for (let i = kids.length - 1; i >= 0; i--) if (gridItemOk(kids[i])) return go(kids[i], false); }
      return go(null, false);
    }
    const r = rectOf(a);
    if (dir === 'pageUp' || dir === 'pageDown') {
      const cx = (r.left + r.right) / 2, ty = (r.top + r.bottom) / 2 + (dir === 'pageDown' ? 1 : -1) * window.innerHeight * 0.8;
      const best = gridPick(root, c => { const q = rectOf(c); return Math.abs((q.top + q.bottom) / 2 - ty) + Math.abs((q.left + q.right) / 2 - cx) * 0.5; });
      if (best && best !== a) return go(best, false);
      if (leave(a, dir === 'pageDown' ? 'down' : 'up')) return true;
      return true;
    }
    if (dir !== 'up' && dir !== 'down' && dir !== 'left' && dir !== 'right') return null;
    a.__gnNested = false;                                            // as step() finds it: no tile holds another
    const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
    const tolY = Math.min(8, r.height / 3), tolX = Math.min(8, r.width / 3);
    const t = gridPick(root, c => {                                  // nearest()'s strict rule, term for term
      if (c === a) return null;
      const q = rectOf(c);
      const qx = (q.left + q.right) / 2, qy = (q.top + q.bottom) / 2;
      let primary, cross, off;
      if (dir === 'down' || dir === 'up') {
        if (!(dir === 'down' ? q.top >= r.bottom - tolY : q.bottom <= r.top + tolY)) return null;
        primary = Math.max(0, dir === 'down' ? q.top - r.bottom : r.top - q.bottom);
        cross = Math.max(0, q.left - r.right, r.left - q.right);
        off = Math.abs(qx - cx);
      } else {
        if (!(dir === 'right' ? q.left >= r.right - tolX : q.right <= r.left + tolX)) return null;
        primary = Math.max(0, dir === 'right' ? q.left - r.right : r.left - q.right);
        cross = Math.max(0, q.top - r.bottom, r.top - q.bottom);
        off = Math.abs(qy - cy);
      }
      return primary + cross * 2 + off * 0.1 + 0;
    });
    if (t) return go(t, false);
    if (dir === 'up' || dir === 'down') { if (leave(a, dir)) return true; }
    if (dir === 'right') { const tab = systemsTab(); if (tab) return go(tab, false); }   // past the right-most tile: the Systems tab (29 Oct)
    return true;                                                     // the end of a row: stay
  }
  /* RIGHT PAST THE WALL'S RIGHT-MOST TILE SELECTS THE SYSTEMS TAB (29 Oct: "Moving right when the
     right-most tile is selected does nothing; it should jump to the Systems menu button: select
     (focus) only, not open"). The tab sits fixed at the screen's right edge. From it, Left goes
     back to the tile it came from, A / Enter / OK opens the menu, Up and Down stay. It is not a
     toolbar item (MEDIA_ZONES), so Up from the wall's top row still goes to the search bar. */
  function systemsTab() {
    const c = document.querySelector('#view-media .vg-tab');
    return c && visible(c) && !gamesMenuOpen() ? c : null;
  }
  function tabMove(a, dir) {
    if (dir === 'left') return go(recalled(zoneById('grid')) || liveItems(zoneById('grid'))[0] || firstSensible(), false);
    return true;
  }

  /* ------------------------------------------------------------ memory */

  const memory = new Map();            // zone id -> { el, sel }
  const SEL_ATTRS = ['data-id', 'data-libid', 'data-cr-open', 'data-vsort', 'data-vart', 'data-vshow', 'data-vcontinue', 'data-vgames-menu', 'data-vdd-btn', 'data-tab', 'id'];
  function selOf(el) {
    try {
      for (const a of SEL_ATTRS) {
        const v = el.getAttribute(a);
        if (v == null || v === '') continue;
        if (a === 'id') return '#' + CSS.escape(v);
        return '[' + a + '="' + CSS.escape(v) + '"]';
      }
    } catch (_) {}
    return null;
  }
  function remember(zid, el) { memory.set(zid, { el, sel: selOf(el) }); }
  function recalled(z) {
    const m = memory.get(z.id);
    if (!m) return null;
    const items = liveItems(z);
    if (m.el && items.includes(m.el)) return m.el;
    if (m.sel) { const r = z.root(); const again = r && r.querySelector(m.sel); if (again && items.includes(again)) return again; }
    return null;
  }

  /* ------------------------------------------------------------ roving tabindex */

  /* THE WALL'S TAB STOP, CHEAPLY (2026-10-28). The full pass below lists every wall
     tile and runs after each focus move and each time tiles are put back on the page (every few
     frames while the wall scrolls): about 6 ms a key press on a 1,600-tile wall. On the wall the
     same tab stop is now chosen without the list, and only the tiles that changed are touched:
     the old and the new stop, and tiles added to the wall since the last pass (a watcher on the
     wall). 0.6 s after the last such quick pass, one full pass runs as before, so the wall at rest
     is exactly as the full pass leaves it. */
  let gridMO = null, gridMOroot = null, gridRoveCur = null, gridFullT = 0;
  const gridAdded = [];
  function gridRecs(recs) { for (const m of recs) for (const n of m.addedNodes) if (n.nodeType === 1) gridAdded.push(n); if (gridAdded.length > 5000) { gridAdded.length = 0; gridRoveCur = null; } }
  function gridWatch(root) {
    if (gridMOroot === root) { gridRecs(gridMO.takeRecords()); return true; }
    if (gridMO) gridMO.disconnect();
    gridMO = new MutationObserver(gridRecs); gridMO.observe(root, { childList: true }); gridMOroot = root; gridAdded.length = 0; gridRoveCur = null;
    return false;
  }
  const gridKid = (root, el) => !!el && el.parentElement === root && gridItemOk(el);
  /* The full pass's choice of stop, from the same inputs, without the list. */
  function gridCur(z, root, want0) {
    want0 = want0 || ptrEl;
    if (gridKid(root, want0)) return want0;
    const a = document.activeElement;
    if (gridKid(root, a)) return a;
    const m = memory.get(z.id);
    if (m) {
      if (gridKid(root, m.el)) return m.el;
      if (m.sel) { const again = root.querySelector(m.sel); if (gridKid(root, again)) return again; }
    }
    for (const c of root.children) if (gridItemOk(c)) return c;
    return null;
  }
  function gridRoveQuick(z, want0) {
    const root = z.root();
    if (!root || !gridWatch(root) || !gridRoveCur || !visible(root)) return false;
    const cur = gridCur(z, root, want0);
    if (!cur) return false;
    for (const n of gridAdded.splice(0)) {
      if (n === cur || !gridKid(root, n)) continue;
      if (!n.hasAttribute('data-gn-item')) n.setAttribute('data-gn-item', '');
      if (n.tabIndex !== -1) n.tabIndex = -1;
    }
    const p = gridRoveCur;
    if (p !== cur && gridKid(root, p) && p.tabIndex !== -1) p.tabIndex = -1;
    if (!cur.hasAttribute('data-gn-item')) cur.setAttribute('data-gn-item', '');
    if (cur.tabIndex !== 0) cur.tabIndex = 0;
    gridRoveCur = cur;
    clearTimeout(gridFullT);
    gridFullT = setTimeout(() => { gridFullT = 0; applyRoving(z, undefined, true); }, 600);
    return true;
  }

  function applyRoving(z, want0, full) {
    if (!z.roving) return;
    if (z.id === 'grid' && !full && gridRoveQuick(z, want0)) return;
    const items = liveItems(z);
    if (!items.length) return;
    const a = document.activeElement;
    want0 = want0 || ptrEl;                                          // a cursor the mouse set holds the tab stop
    let cur = want0 && items.includes(want0) ? want0 : items.includes(a) ? a : recalled(z);
    if (!cur && z.prefer) { const r = z.root(); const p = r && r.querySelector(z.prefer); if (p && items.includes(p)) cur = p; }
    if (!cur) cur = items[0];
    for (const it of items) {
      if (!it.hasAttribute('data-gn-item')) it.setAttribute('data-gn-item', '');
      const want = it === cur ? 0 : -1;
      if (it.tabIndex !== want) it.tabIndex = want;
    }
    if (z.id === 'grid') { const r = z.root(); if (r) { gridWatch(r); gridAdded.length = 0; gridRoveCur = cur; } }   // the quick pass starts from here
    if (z.extra) { const r = z.root(); if (r) for (const x of z.extra(r)) if (x.tabIndex !== -1) x.tabIndex = -1; }
  }
  let rovingQueued = false;
  function queueRoving() {
    if (rovingQueued) return;
    rovingQueued = true;
    requestAnimationFrame(() => { rovingQueued = false; for (const z of MEDIA_ZONES) applyRoving(z); applyRoving(TIMELINE); rovingSettings(); });
  }

  /* ------------------------------------------------------------ geometry */

  function rectOf(el) { return el.getBoundingClientRect(); }
  /* The nearest candidate in direction dir from rect r. Primary distance is
     the gap along the direction; the cross distance (zero when the two
     overlap on the other axis) weighs double; centre offset breaks ties. */
  function nearest(r, cands, dir, loose, from) {
    let best = null, bestScore = Infinity;
    const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
    // A control nested in another candidate (an episode's play thumbnail in
    // its row) loses ties to the outer one, unless we are moving from a
    // nested control ourselves (thumbnail to thumbnail).
    const set = new Set(cands);
    const nestedIn = el => { for (let p = el.parentElement; p; p = p.parentElement) if (set.has(p)) return true; return false; };
    const fromNested = !!(from && from.__gnNested);
    for (const c of cands) {
      const q = rectOf(c);
      const qx = (q.left + q.right) / 2, qy = (q.top + q.bottom) / 2;
      let primary, cross, off;
      const tolY = Math.min(8, r.height / 3), tolX = Math.min(8, r.width / 3);
      if (dir === 'down' || dir === 'up') {
        const ahead = dir === 'down' ? (loose ? qy > cy + 1 : q.top >= r.bottom - tolY) : (loose ? qy < cy - 1 : q.bottom <= r.top + tolY);
        if (!ahead) continue;
        primary = Math.max(0, dir === 'down' ? q.top - r.bottom : r.top - q.bottom);
        cross = Math.max(0, q.left - r.right, r.left - q.right);
        off = Math.abs(qx - cx);
      } else {
        const ahead = dir === 'right' ? (loose ? qx > cx + 1 : q.left >= r.right - tolX) : (loose ? qx < cx - 1 : q.right <= r.left + tolX);
        if (!ahead) continue;
        primary = Math.max(0, dir === 'right' ? q.left - r.right : r.left - q.right);
        cross = Math.max(0, q.top - r.bottom, r.top - q.bottom);
        off = Math.abs(qy - cy);
      }
      const score = primary + cross * 2 + off * 0.1 + (!fromNested && nestedIn(c) ? 60 : 0);
      if (score < bestScore) { bestScore = score; best = c; }
    }
    return best;
  }
  const notRelated = from => c => c !== from && !c.contains(from) && !from.contains(c);
  /* Nearest from an element among a list; Left/Right with nothing beside it
     look inside it (an episode row: Left is its play thumbnail, Right its
     buttons). */
  function step(from, list, dir) {
    const r = rectOf(from);
    from.__gnNested = list.some(c => c !== from && c.contains(from));
    const t = nearest(r, list.filter(notRelated(from)), dir, false, from);
    if (t || (dir !== 'left' && dir !== 'right')) return t;
    const inner = list.filter(c => c !== from && from.contains(c));
    return inner.length ? nearest(r, inner, dir, true, from) : null;
  }

  /* ------------------------------------------------------------ moving focus */

  /* How much of the top of the window is covered when the page is scrolled: the sticky header
     AND the Media page's sticky search/filter bar (2026-10-18: on a phone that bar is
     tall, and a focused tile was scrolled up behind it). A sticky bar covers its `top` plus its
     own height once it sticks; a bar the element is inside covers nothing. Same reading as
     emby.js bannerScrollTarget. */
  function topCover(el) {
    let cover = 0;
    for (const b of [document.querySelector('header'), document.querySelector('#video-body .collection-toolbar')]) {
      if (!b || (el && b.contains(el))) continue;
      const cs = getComputedStyle(b), r = b.getBoundingClientRect();
      if (!r.height || cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (cs.position === 'fixed') cover = Math.max(cover, r.bottom);
      else if (cs.position === 'sticky') cover = Math.max(cover, (parseFloat(cs.top) || 0) + r.height);
    }
    return Math.max(0, cover);
  }
  /* The nearest box above an element that scrolls up / down (null: none, the page). */
  function vScrollBox(el) {
    for (let p = el && el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      if (p.scrollHeight > p.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(p).overflowY)) return p;
    }
    return null;
  }
  /* A sideways strip between the element and its box scrolls itself sideways (as on the page). */
  function sideways(el, box, behavior) {
    for (let p = el.parentElement; p && p !== box && p !== document.body; p = p.parentElement) {
      if (p.scrollWidth > p.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(p).overflowX)) {
        const pr = p.getBoundingClientRect(), r = el.getBoundingClientRect(), pad = 24;
        let dx = 0;
        if (r.left < pr.left + pad) dx = r.left - pr.left - pad;
        else if (r.right > pr.right - pad) dx = r.right - pr.right + pad;
        if (dx) p.scrollBy({ left: dx, behavior });
        break;
      }
    }
  }
  /* What of a box is on screen, and where its own scroll is going (a running steady scroll). */
  function boxView(box) {
    const r = box.getBoundingClientRect();
    const sp = parseFloat(getComputedStyle(box).scrollPaddingTop) || 0;
    return { top: Math.max(0, r.top) + sp, bottom: Math.min(window.innerHeight, r.bottom), ahead: vs.on && vs.box === box ? vs.p1 - box.scrollTop : 0 };
  }
  function revealIn(el, box) {
    const v = boxView(box), m = 16;
    const r0 = el.getBoundingClientRect();
    const r = { top: r0.top - v.ahead, bottom: r0.bottom - v.ahead, height: r0.height };
    let dy = 0;
    if (r.height > v.bottom - v.top - 2 * m) dy = r.top - v.top - m;
    else if (r.top < v.top + m) dy = r.top - v.top - m;
    else if (r.bottom > v.bottom - m) dy = r.bottom - v.bottom + m;
    if (dy) pageScrollTo(box.scrollTop + v.ahead + dy, dy, box);
  }
  /* THE NEXT ITEM IS FAR AWAY (31 Oct): on a page window or in a layer (Features, Home, About,
     Timeline, Compatibility, Settings), when the next item up or down is more than a step beyond the
     edge of the box (a long run of text with nothing to focus in it), Up / Down scrolls the box one
     step instead (about a fifth of the box, 100 to 180 px) and the focus stays; once the item is
     within a step, the press moves to it as before. Held, that is a steady scroll through the text
     rather than a leap past it. True: the press was taken here. */
  const farLast = { dir: null, box: null, at: 0 };
  function farStep(a, t, dir) {
    if (dir !== 'up' && dir !== 'down') return false;
    const box = vScrollBox(t || a);
    if (!box || (t && box !== vScrollBox(a))) return false;
    if (!topEl() && !box.closest('#video-about')) return false;        // the wall and the page keep their own way
    const v = boxView(box), m = 16;
    const STEP = Math.max(100, Math.min(180, (v.bottom - v.top) * 0.22));
    if (!t) {                                                          // nothing more that way: the text past the last item still scrolls into view
      const at = box.scrollTop + v.ahead, max = box.scrollHeight - box.clientHeight;
      if (dir === 'down' ? at >= max - 1 : at <= 1) return false;
      const dy = dir === 'down' ? Math.min(STEP, max - at) : -Math.min(STEP, at);
      pageScrollTo(at + dy, dy, box);
      return true;
    }
    const r0 = t.getBoundingClientRect(), top = r0.top - v.ahead, bottom = r0.bottom - v.ahead;
    const tall = r0.height > v.bottom - v.top - 2 * m;
    const need = dir === 'down' ? (tall ? top - (v.top + m) : bottom - (v.bottom - m)) : (v.top + m) - top;
    const now = performance.now(), held = farLast.dir === dir && farLast.box === box && now - farLast.at < 260;
    farLast.dir = dir; farLast.box = box; farLast.at = now;
    if (need <= STEP) {
      /* Held, the box keeps its pace while the focus walks items already on screen (measured: without
         this the scroll stopped dead each time and started again, a stutter every three quarters of a
         second): it moves a step anyway, as far as keeps the next item on screen. */
      if (!held) return false;
      const room = dir === 'down' ? top - (v.top + m) : (v.bottom - m) - bottom;
      const want = Math.min(STEP, room);
      if (want > Math.max(0, need)) { const dy = dir === 'down' ? want : -want; pageScrollTo(box.scrollTop + v.ahead + dy, dy, box); }
      return false;                                                    // the focus moves on to it as before
    }
    const dy = dir === 'down' ? STEP : -STEP;
    pageScrollTo(box.scrollTop + v.ahead + dy, dy, box);
    return true;
  }
  function reveal(el, inLayer) {
    const behavior = reduced() ? 'auto' : 'smooth';
    /* In the window under the bar the page is held still and the window scrolls itself. */
    /* A LAYER OR A PAGE WINDOW SCROLLS LIKE THE PAGE (31 Oct: "Holding down button on my controller
       on the features page just scrolls jerky"). Measured on Features, D-pad Down held 4 s at 1440x900:
       every repeat started a new smooth scrollIntoView from wherever the last had got to, so the window
       stood still on 15 of 102 frames and leapt up to 233 px on others (Home: still on 54 of 106,
       leaps to 402 px). The same fault the wall had on 21 Oct, and the same cure: the box that scrolls
       is moved by the page's one steady scroll (pageScrollTo with a box), re-aimed by each press. */
    if (inLayer || (el.closest && el.closest('#video-about'))) {
      const box = vScrollBox(el);
      if (!box) { try { el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior }); } catch (_) {} return; }
      sideways(el, box, behavior);
      return revealIn(el, box);
    }
    /* THE SYSTEMS MENU SCROLLS ITSELF, CLEAR OF ITS OWN HEAD (4 Nov: on a phone, down to R.O.B. and
       back up to Movies, the top row only partly showed). The full-screen menu scrolls its own rows
       under a sticky head (collections, Display, Sort, Continue, the type boxes), and nothing moved it
       back for a row behind that head. Now the focused control is brought whole into the part of the
       menu that is not covered, by the same steady scroll as a page window. A menu that does not
       scroll (the strip on a desk, when it fits) is left as before. */
    const vm = el.closest && el.closest('.vgames-menu');
    if (vm && vm.scrollHeight > vm.clientHeight + 2) {
      const mr = vm.getBoundingClientRect(), head = vm.querySelector('.vgames-head'), m = 8;
      let vtop = Math.max(0, mr.top), vbot = Math.min(window.innerHeight, mr.bottom);
      if (head && !head.contains(el) && getComputedStyle(head).position === 'sticky') vtop = Math.max(vtop, head.getBoundingClientRect().bottom);
      if (!head || !head.contains(el)) {
        const ahead = vs.on && vs.box === vm ? vs.p1 - vm.scrollTop : 0;
        const r0 = el.getBoundingClientRect(), top = r0.top - ahead, bot = r0.bottom - ahead;
        let dy = 0;
        if (r0.height > vbot - vtop - 2 * m || top < vtop + m) dy = top - vtop - m;
        else if (bot > vbot - m) dy = bot - vbot + m;
        if (dy) pageScrollTo(vm.scrollTop + ahead + dy, dy, vm);
      }
      return;
    }
    // A horizontal strip (Continue row, library strip) scrolls itself sideways.
    /* A Continue card's remove X brings in its whole card (4 Nov: "When a close button has focus, the
       whole tile must be in view so the user sees what they would remove"). */
    const whole = (el.closest && el.closest('.vcr-card')) || el;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (p.scrollWidth > p.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(p).overflowX)) {
        const pr = p.getBoundingClientRect(), r = whole.getBoundingClientRect(), pad = 24;
        let dx = 0;
        if (r.left < pr.left + pad) dx = r.left - pr.left - pad;
        else if (r.right > pr.right - pad) dx = r.right - pr.right + pad;
        if (dx) p.scrollBy({ left: dx, behavior });
        break;
      }
    }
    // The page scrolls vertically, keeping clear of the sticky header (and a
    // wider margin in TV mode, doc 5.6).
    const top = topCover(el) + (isTV() ? 48 : 16);
    const bottom = window.innerHeight - (isTV() ? 48 : 16);
    const r0 = el.getBoundingClientRect();
    // Measured from where a running page scroll is GOING, not from where it is this frame.
    const ahead = vs.on && !vs.box ? vs.p1 - window.scrollY : 0;
    const r = { top: r0.top - ahead, bottom: r0.bottom - ahead, height: r0.height };
    let dy = 0;
    if (r.height > bottom - top) dy = r.top - top;
    else if (r.top < top) dy = r.top - top;
    else if (r.bottom > bottom) dy = r.bottom - bottom;
    if (dy) pageScrollTo(window.scrollY + ahead + dy, dy);
  }

  /* ---- THE PAGE'S OWN VERTICAL SCROLL (2026-10-21)
     Reported: "When I hold down the down button on the d-pad on the tiles, it doesn't just scroll
     down. It moves a tiny bit, jerks and keeps moving and jerking a little on the one tile
     until I let go, then jumps many tiles. I think the next cycle of key down interrupts the
     animation of moving down, repeatedly." Measured (a hold test, keyboard repeat): every
     repeat started a new window.scrollBy({behavior:'smooth'}) from wherever the last one had
     got to, and each was cut off a frame later, so the page crept about 9 px a frame while
     the focus ran 18,000 px ahead; on release the last smooth scroll covered all of it at once.
     The page scroll is now one animation that each press re-aims without restarting:
       - a single press glides to its place (ease in and out, 260 ms);
       - held presses (a key's or the pad's repeat) are tracked at the pace they arrive, so the
         page moves at one steady speed while the button is held, the motion carrying its
         speed from one press to the next (a cubic Hermite curve, position and speed continuous);
       - when the presses stop it eases to a stop on the last tile.
     A wheel, a touch or any other scroll that moves the page meanwhile ends it. Reduced motion
     and a hidden tab jump straight there. */
  /* vs.box (31 Oct): the box this scroll moves, null for the page itself (a page window, a
     layer: reveal / revealIn / farStep). One scroll runs at a time; another box takes it over.
     vs.V: the pace of the held presses, averaged, so presses of uneven length (an item close by, then
     a step through text) do not change the speed from press to press. */
  const vs = { on: false, y: 0, p0: 0, p1: 0, v0: 0, v1: 0, t0: 0, D: 1, last: 0, T: 0, V: 0, held: false, final: false, wrote: -1, raf: 0, box: null };
  const vsNow = () => vs.box ? vs.box.scrollTop : window.scrollY;
  function vsWrite(y) {
    if (vs.box) { try { vs.box.scrollTo({ top: Math.round(y), behavior: 'instant' }); } catch (_) { vs.box.scrollTop = Math.round(y); } }
    else window.scrollTo({ top: Math.round(y), behavior: 'instant' });
  }
  function vsAt(now) {
    const u = Math.max(0, Math.min(1, (now - vs.t0) / vs.D)), u2 = u * u, u3 = u2 * u, D = vs.D;
    const y = (2 * u3 - 3 * u2 + 1) * vs.p0 + (u3 - 2 * u2 + u) * D * vs.v0 + (-2 * u3 + 3 * u2) * vs.p1 + (u3 - u2) * D * vs.v1;
    const v = ((6 * u2 - 6 * u) * vs.p0 + (3 * u2 - 4 * u + 1) * D * vs.v0 + (-6 * u2 + 6 * u) * vs.p1 + (3 * u2 - 2 * u) * D * vs.v1) / D;
    return { y, v, u };
  }
  const vsMax = () => vs.box ? Math.max(0, vs.box.scrollHeight - vs.box.clientHeight) : Math.max(0, (document.scrollingElement || document.documentElement).scrollHeight - window.innerHeight);
  function vsPlan(now, p1, D, v1) {
    const cur = vs.on ? vsAt(now) : { y: vsNow(), v: 0 };
    vs.p0 = cur.y; vs.v0 = cur.v; vs.p1 = p1; vs.v1 = v1; vs.t0 = now; vs.D = Math.max(16, D);
  }
  function pageScrollTo(target, step, box) {
    const now = performance.now();
    box = box || null;
    if (vs.box !== box) {                                             // another box: the running scroll ends where it is
      if (vs.raf) cancelAnimationFrame(vs.raf);
      vs.on = false; vs.raf = 0; vs.last = 0; vs.T = 0; vs.V = 0; vs.box = box;
    }
    target = Math.max(0, Math.min(vsMax(), target));
    /* A jump of more than four screens (Home, End, Back to the first tile on a long wall) goes
       straight there (2026-10-24): gliding through thousands of tiles drew tiles that
       had never been drawn, their size settled on the way, the page moved under the glide and the
       glide stopped (measured: Home from 126,000 px down stopped at 124,000). */
    if (reduced() || document.visibilityState !== 'visible' || Math.abs(target - vsNow()) > 4 * (box ? box.clientHeight : window.innerHeight)) {
      vs.on = false; ownScrollUntil = now + 400;
      vsWrite(target);
      return;
    }
    const gap = now - vs.last; vs.last = now;
    vs.held = vs.on && gap < 260;
    if (vs.held) {
      vs.T = vs.T ? vs.T * 0.6 + gap * 0.4 : gap;
      const T = Math.max(16, Math.min(250, vs.T));
      const pace = step / T;
      vs.V = vs.V && Math.sign(vs.V) === Math.sign(pace) ? vs.V * 0.6 + pace * 0.4 : pace;
      vsPlan(now, target, T * 1.25, vs.V);                             // keep going at the pace of the presses
    } else {
      vs.T = 0; vs.V = 0;
      vsPlan(now, target, 260, 0);                                    // one press: glide there
    }
    vs.final = !vs.held;
    vs.y = vs.p0;
    ownScrollUntil = now + vs.D + 400;
    if (!vs.on) { vs.on = true; vs.wrote = -1; vs.raf = requestAnimationFrame(vsFrame); }
  }
  function vsFrame(now) {
    vs.raf = 0;
    if (!vs.on) return;
    if (vs.box && !vs.box.isConnected) { vs.on = false; return; }
    // Something else moved the page (a wheel, a touch, the browser): it is theirs now.
    if (vs.wrote >= 0 && Math.abs(vsNow() - vs.wrote) > 3) { vs.on = false; return; }
    // The presses stopped: ease to a stop on the last place asked for.
    if (vs.held && !vs.final && now - vs.last > Math.max(16, Math.min(250, vs.T)) * 1.1) {
      const cur = vsAt(now), dist = vs.p1 - cur.y;
      const sp = Math.abs(cur.v);
      const D = (sp > 0.01 && Math.sign(cur.v) === Math.sign(dist)) ? Math.max(80, Math.min(450, 2 * Math.abs(dist) / sp)) : 200;
      vsPlan(now, vs.p1, D, 0);
      vs.final = true;
    }
    const s = vsAt(now);
    let y = s.y;
    if (vs.final) y = vs.p1 >= vs.p0 ? Math.min(y, vs.p1) : Math.max(y, vs.p1);   // never past the last tile
    y = Math.max(0, Math.min(vsMax(), y));
    vs.y = y;
    vsWrite(y);
    vs.wrote = vsNow();
    ownScrollUntil = now + 400;
    if (s.u >= 1 && vs.final) { vs.on = false; return; }
    vs.raf = requestAnimationFrame(vsFrame);
  }
  function go(el, inLayer) {
    if (!el) return false;
    if (el.classList && el.classList.contains('cw-far')) { el.classList.remove('cw-far'); el.__cwFar = 0; }   // see the grid zone
    try { el.focus({ preventScroll: true }); } catch (_) { try { el.focus(); } catch (__) { return false; } }
    if (document.activeElement !== el) return false;
    ptrEl = null; touched = false; lastPtrTarget = null;             // a key moved the cursor: it is where the ring is (a later
                                                                     // mouse move, even on the same tile, takes it again)
    reveal(el, inLayer);
    return true;
  }

  /* ---- the mouse and the scroll move the cursor (nav5; see the header) */

  let ptrEl = null;            // the item the mouse last moved over or pressed (the cursor until focus moves)
  let touched = false;         // the user scrolled or clicked since the last key move
  let ownScrollUntil = 0;      // our own smooth scroll is running until then (not the user's)
  let ptr = null;              // the pointer's last client position while it is in the window
  let lastPtrTarget = null;

  /* The zone item an event target belongs to (cheap: no layout reads). */
  function itemAt(t) {
    for (let p = t && t.nodeType === 1 ? t : t && t.parentElement; p && p !== document.body; p = p.parentElement) {
      if (p.hasAttribute('data-gn-item') || (p.matches(FOCUSABLE) && p.tabIndex >= 0)) {
        if (isField(p)) return null;
        const at = zoneOf(p);
        if (!at) return null;
        if (at.z.id === 'page' && TIMELINE.root() && TIMELINE.root().contains(p)) return null;
        return { el: p, z: at.z };
      }
    }
    return null;
  }
  function pointerOn(t) {
    if (topEl()) return;                                             // a layer is open: its own rules (zones only)
    const it = itemAt(t);
    if (!it || it.el === ptrEl) return;
    ptrEl = it.el;
    remember(it.z.id, it.el);
    if (it.z.roving) applyRoving(it.z, it.el);
  }
  document.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    // Only a real move counts: Chrome can send a move with the pointer standing still
    // (after a scroll), and a resting mouse must never take the cursor from the keys.
    if (ptr && ptr.x === e.clientX && ptr.y === e.clientY) return;
    ptr = { x: e.clientX, y: e.clientY };
    if (e.target === lastPtrTarget) return;
    lastPtrTarget = e.target;
    pointerOn(e.target);
  }, { capture: true, passive: true });
  document.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') ptr = { x: e.clientX, y: e.clientY };
    touched = true;
    lastPtrTarget = e.target;
    pointerOn(e.target);
  }, { capture: true, passive: true });
  window.addEventListener('mouseout', e => { if (!e.relatedTarget) { ptr = null; lastPtrTarget = null; } });
  const userScroll = () => { touched = true; };
  window.addEventListener('wheel', userScroll, { capture: true, passive: true });
  window.addEventListener('touchmove', userScroll, { capture: true, passive: true });
  window.addEventListener('scroll', () => { if (performance.now() > ownScrollUntil) touched = true; }, { passive: true });

  /* On screen: a fair part of it (half, or 48px) inside the window below a sticky
     header, and inside its sideways strip. A sliver at the edge does not count. */
  function onScreen(el) {
    const r = rectOf(el);
    const top = topCover(el);
    const need = (len) => Math.min(48, len / 2);
    if (Math.min(r.bottom, window.innerHeight) - Math.max(r.top, top) < need(r.height)) return false;
    if (Math.min(r.right, window.innerWidth) - Math.max(r.left, 0) < need(r.width)) return false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (p.scrollWidth > p.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(p).overflowX)) {
        const pr = p.getBoundingClientRect();
        return Math.min(r.right, pr.right) - Math.max(r.left, pr.left) >= need(r.width);
      }
    }
    return true;
  }
  /* The visible item to put the cursor on: the one under the pointer (move from it),
     else the nearest to the pointer, else to the middle of the screen (land on it). */
  function pickVisible() {
    const cands = [];
    for (const z of zones()) {
      if (z.id === 'nav') continue;
      let items = liveItems(z);
      if (z.id === 'page') items = items.filter(el => !(TIMELINE.root() && TIMELINE.root().contains(el)));
      for (const el of items) if (!isField(el) && onScreen(el)) cands.push(el);
    }
    if (!cands.length) return null;
    if (ptr) {
      const it = itemAt(document.elementFromPoint(ptr.x, ptr.y));
      if (it && cands.includes(it.el)) return { el: it.el, land: false };
    }
    const px = ptr ? ptr.x : window.innerWidth / 2, py = ptr ? ptr.y : window.innerHeight / 2;
    let best = null, bd = Infinity;
    for (const el of cands) {
      const q = rectOf(el);
      const dx = Math.max(0, q.left - px, px - q.right), dy = Math.max(0, q.top - py, py - q.bottom);
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = el; }
    }
    return best ? { el: best, land: true } : null;
  }
  /* Where the next arrow starts, when the mouse or a scroll moved the cursor:
     { el, land } (land = only put the ring there), or null (the focus, as before). */
  function retarget() {
    if (topEl()) return null;
    const a = document.activeElement;
    const focused = !!a && a !== document.body && a !== document.documentElement && visible(a);
    const cur = ptrEl && ptrEl.isConnected && visible(ptrEl) ? ptrEl : null;
    if (!cur) ptrEl = null;
    if (cur && onScreen(cur)) return cur === a ? null : { el: cur, land: false };
    if (!touched) return cur && cur !== a ? { el: cur, land: false } : null;   // keyboard only: as before
    if (!cur) {
      if (focused) { if (!zoneOf(a) || onScreen(a)) return null; }
      else { const f = firstSensible(); if (!f || onScreen(f)) return null; }
    }
    return pickVisible();
  }

  /* Leave a zone through its edge: Up/Down to the next zone with something in
     it; the remembered item there, else the nearest by position. */
  function leave(from, dir) {
    if (dir !== 'up' && dir !== 'down') return false;
    if (topEl()) return false;
    const list = zones();
    const at = zoneOf(from);
    let i = at ? list.indexOf(at.z) : -1;
    if (i < 0) return false;
    const r = rectOf(from);
    /* DOWN FROM THE BAR'S BUTTONS GOES INTO THE OPEN PAGE (4 Nov: on a phone, Down from Home's
       button closed Home and put the focus in the search box, since the box takes the focus and a
       focused box closes the page, emby.js). While Home, Features, Timeline or About is open, Down from
       the buttons steps over the box into the page; the box is still reached on purpose (a tap, g f, /,
       or Up from the top of the page). */
    const intoPage = dir === 'down' && at.z.id === 'toolbar' && liveItems(MEDIA_ZONES[3]).length > 0;
    for (let j = i + (dir === 'down' ? 1 : -1); j >= 0 && j < list.length; j += dir === 'down' ? 1 : -1) {
      const z = list[j];
      if (intoPage && z.id === 'search') continue;
      let items = liveItems(z);
      if (z.id === 'page') items = items.filter(el => !(TIMELINE.root() && TIMELINE.root().contains(el)));
      if (!items.length) continue;
      // Focus mode (shortcuts.js) hides the toolbar and library strip: Up past the top row brings them back.
      if (dir === 'up' && z.id === 'nav' && onMedia() && window.GnwShortcuts && window.GnwShortcuts.revealAbove && window.GnwShortcuts.revealAbove()) return leave(from, dir);
      const t = recalled(z) || (z.id === 'window' && dir === 'down' && homeFilm()) || nearest(r, items, dir) || nearest(r, items, dir, true) || items[0];
      return go(t, false);
    }
    /* Nothing above (22 Oct: the top bar, whose zone came first, is gone): in focus mode
       Up past the top still brings the toolbar back, as Up into the top bar used to. */
    if (dir === 'up' && onMedia() && window.GnwShortcuts && window.GnwShortcuts.revealAbove && window.GnwShortcuts.revealAbove()) {
      const land = () => { const tb = liveItems(MEDIA_ZONES[1]); if (tb.length) go(recalled(MEDIA_ZONES[1]) || nearest(r, tb, dir) || tb[0], false); return tb.length; };
      if (!land()) requestAnimationFrame(() => { if (!land()) setTimeout(land, 120); });
      return true;
    }
    return false;
  }

  /* Home's film is the first stop of the Home window (5 Nov), for a remote's first press and for Down from the bar. */
  function homeFilm() { const f = document.getElementById('home-film'); return f && f.closest('#video-about') && visible(f) ? f : null; }
  function firstSensible() {
    const hf = homeFilm(); if (hf) return hf;
    if (onMedia()) {
      for (const id of ['continue', 'grid']) { const z = zoneById(id); const it = liveItems(z); if (it.length) return recalled(z) || it[0]; }
    }
    const v = activeView();
    if (v && v.id === 'view-series') { const it = liveItems(TIMELINE); if (it.length) return recalled(TIMELINE) || it[0]; }
    if (v) { const it = focusablesIn(v); if (it.length) return it[0]; }
    return liveItems(MEDIA_ZONES[0])[0] || null;
  }
  function focusZone(id) {
    if (topEl()) return false;
    const z = zoneById(id); if (!z) return false;
    const it = liveItems(z); if (!it.length) return false;
    return go(recalled(z) || it[0], false);
  }

  /* ---- Settings: a vertical tab list and its panel */

  const settingsEl = () => document.getElementById('vault-overlay');
  const settingsTabs = () => Array.from(document.querySelectorAll('#vault-overlay .settings-tabs .settings-tab')).filter(visible);
  const settingsPanel = () => document.querySelector('#vault-overlay .settings-panels > .settings-panel.active');
  const panelMemory = new Map();      // tab -> control
  function rovingSettings() {
    const tabs = settingsTabs(); if (!tabs.length) return;
    const cur = tabs.find(t => t.classList.contains('active')) || tabs[0];
    for (const t of tabs) { const want = t === cur ? 0 : -1; if (t.tabIndex !== want) t.tabIndex = want; }
    const list = tabs[0].parentElement;
    if (list && list.getAttribute('aria-orientation') !== 'vertical' && getComputedStyle(list).flexDirection.startsWith('column')) list.setAttribute('aria-orientation', 'vertical');
  }
  function selectTab(t) {
    if (!t) return false;
    if (!t.classList.contains('active')) t.click();               // automatic activation: switching a panel is cheap
    rovingSettings();
    return go(t, true);
  }
  function settingsMove(a, dir) {
    const tabs = settingsTabs();
    const onTab = tabs.indexOf(a);
    const vertical = tabs.length > 1 && Math.abs(rectOf(tabs[1]).top - rectOf(tabs[0]).top) > 4;
    if (onTab >= 0) {
      const prev = vertical ? 'up' : 'left', next = vertical ? 'down' : 'right', into = vertical ? 'right' : 'down';
      if (dir === prev) return selectTab(tabs[Math.max(0, onTab - 1)]) || true;
      if (dir === next) return selectTab(tabs[Math.min(tabs.length - 1, onTab + 1)]) || true;
      if (dir === 'first') return selectTab(tabs[0]) || true;
      if (dir === 'last') return selectTab(tabs[tabs.length - 1]) || true;
      if (dir === into) {
        const p = settingsPanel(); if (!p) return true;
        const items = focusablesIn(p);
        const m = panelMemory.get(a.dataset.tab);
        return go(items.includes(m) ? m : items[0], true) || true;
      }
      return true;
    }
    const p = settingsPanel();
    if (p && p.contains(a)) {
      if (dir === 'first' || dir === 'last' || dir === 'pageUp' || dir === 'pageDown') return false;
      const t = step(a, focusablesIn(p), dir);
      if (t) return go(t, true) || true;                             // never hand the key to the browser's scroll
      if (dir === 'left' || (dir === 'up' && !vertical)) { const cur = tabs.find(x => x.classList.contains('active')); return go(cur, true) || true; }
      return true;                                                   // the panel's edge: stay
    }
    return null;                                                     // the close button etc.: the plain layer rule
  }
  // Back from a Settings control goes to its tab first (doc 5.4.5); a second Back closes.
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented) return;
    const k = K(); if (!k || !k.isBack || !k.isBack(e)) return;
    const s = settingsEl(); if (!s || topEl() !== s) return;
    const p = settingsPanel(), a = document.activeElement;
    if (!p || !a || !p.contains(a)) return;
    if (a.tagName === 'SELECT') return;
    const cur = settingsTabs().find(x => x.classList.contains('active'));
    if (!cur) return;
    e.preventDefault();
    go(cur, true);
  });
  /* BACK ON A TILE (22 Oct). On the Media wall with nothing open, Escape, Back or
     the pad's B on a tile (or on the cast, box set or banner rows above them):
       1. a grouping is showing (search words in the box, a person's or a box set's banner): it is
          cleared through the page's own controls (the banner's x, the box's input path), and the
          focus stays on the same tile if the normal wall still has it, else the first tile;
       2. otherwise the focus goes to the first tile (the top of the wall);
       3. already there: nothing here, so focus mode's "Back brings the bar back" still runs.
     Open windows, drawers and menus stop Back before it reaches here (their own handlers, or
     topEl), the search box and its Recent row are not tiles, and the Systems menu stops it too. */
  const TILE_ZONES = new Set(['grid', 'people', 'collections', 'banner']);
  function groupingOn() {
    const q = document.getElementById('video-search');
    const b = document.getElementById('video-person-banner');
    return { q: !!(q && q.value.trim()), b: !!(b && !b.hidden && b.querySelector('.vpb-clear')) };
  }
  function firstTile() { try { if (window._cwWallEdge) window._cwWallEdge('first'); } catch (_) {} const z = zoneById('grid'); const it = z ? liveItems(z) : []; return it[0] || null; }
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || !onMedia() || topEl()) return;
    const k = K(); if (!k || !k.isBack || !k.isBack(e)) return;
    const a = document.activeElement;
    if (!a || isField(a) || (a.closest && a.closest('#video-about, .vgames-menu, .vtb-menu'))) return;
    const at = zoneOf(a); if (!at || !TILE_ZONES.has(at.z.id)) return;
    const g = groupingOn();
    if (g.q || g.b) {
      e.preventDefault();
      if (e.repeat) return;
      const id = a.getAttribute('data-id');
      if (g.b) { try { document.getElementById('video-person-banner').querySelector('.vpb-clear').click(); } catch (_) {} }
      if (g.q) { const q = document.getElementById('video-search'); q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); }
      /* The wall redraws (the search waits 90 ms, a library browse can take longer): land the
         focus once it has, and again if a later paint took it away. */
      const land = () => {
        if (topEl() || !onMedia()) return;
        const cur = document.activeElement, z = zoneById('grid'), items = z ? liveItems(z) : [];
        if (cur && cur !== document.body && cur.isConnected && visible(cur) && (cur !== a || items.includes(cur))) return;   // still somewhere real (or the person moved on)
        const r = z && z.root();
        const same = id && r ? Array.from(r.querySelectorAll('[data-id="' + CSS.escape(id) + '"]')).find(x => items.includes(x)) : null;
        const t = same || items[0];
        if (t) go(t, false);
      };
      setTimeout(land, 250); setTimeout(land, 800); setTimeout(land, 1600);
      return;
    }
    const f = firstTile();
    if (!f || f === a) return;
    e.preventDefault();
    if (e.repeat) return;
    go(f, false);
  });
  document.addEventListener('focusin', e => {
    const p = settingsPanel();
    if (p && p.contains(e.target)) { const t = settingsTabs().find(x => x.classList.contains('active')); if (t) panelMemory.set(t.dataset.tab, e.target); }
  });

  /* ---- the Games menu (doc 5.4.2) */

  function gamesMenuOpen() { const m = gamesMenu(); return !!m && !m.hidden && visible(m); }
  function closeGamesMenu(focusCaret) {
    const m = gamesMenu(), c = gamesCaret();
    if (m) m.hidden = true;
    if (c) { c.setAttribute('aria-expanded', 'false'); if (focusCaret) go(c, false); }
  }
  const menuItems = () => { const m = gamesMenu(); return m ? Array.from(m.querySelectorAll('button')).filter(visible) : []; };
  // Enter / Space on the caret opens the menu with focus inside it (emby.js vgOpenMenu puts it on the
  // lit system, 29 Oct); only if it is not there yet, its first row.
  document.addEventListener('keydown', e => {
    if ((e.key !== 'Enter' && e.key !== ' ') || !e.target || !e.target.closest || !e.target.closest('[data-vgames-menu]')) return;
    setTimeout(() => { if (gamesMenuOpen() && !gamesMenu().contains(document.activeElement)) { const it = menuItems()[0]; if (it) go(it, false); } }, 0);
  }, true);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab' || !gamesMenuOpen()) return;
    const m = gamesMenu();
    if (!m.contains(document.activeElement)) return;
    e.preventDefault();
    closeGamesMenu(true);                                          // Tab closes it and moves on from the caret
  });
  // Focus leaving the menu by key (not by a click, which emby.js handles) closes it.
  document.addEventListener('focusout', e => {
    if (!gamesMenuOpen()) return;
    const wrap = e.target && e.target.closest && e.target.closest('.vgames-wrap');
    if (!wrap || !e.relatedTarget || wrap.contains(e.relatedTarget)) return;
    // The search bar is not leaving it (4 Nov: the Systems menu stays open while searching).
    if (e.relatedTarget.closest && e.relatedTarget.closest('#video-body .collection-toolbar .filter-bar')) return;
    closeGamesMenu(false);
  });
  function gamesMenuMove(a, dir) {
    const items = menuItems();
    if (!items.length) return false;
    if (a === gamesCaret()) { if (dir === 'down') return go(items[0], false); return null; }
    if (dir === 'first') return go(items[0], false);
    if (dir === 'last') return go(items[items.length - 1], false);
    /* THE TOP ROW IS ONE ROW (2026-10-22): the three Display buttons and the four
       type boxes. Left and Right walk along it in its own order, across the gap between the two groups
       (the nearest rule took the console tile under the gap instead) and across the line break where a
       phone wraps it; its ends stay put. Up and Down are the plain nearest-on-screen rule: Down drops
       to the consoles, Up from the first console row comes back to this row. */
    const head = a.closest && a.closest('.vgames-head');
    if (head && (dir === 'left' || dir === 'right')) {
      const row = items.filter(b => head.contains(b));
      const i = row.indexOf(a), t = row[i + (dir === 'right' ? 1 : -1)];
      return t ? go(t, false) : true;
    }
    /* The consoles: Left and Right stay on the tile's own row on screen (the nearest rule took a tile
       on the row above from the last row's single tile); the row's ends stay put. */
    if ((dir === 'left' || dir === 'right') && a.closest && a.closest('.vggrid')) {
      /* Game & Watch's series caret sits in its tile's top right corner: Right from the tile reaches
         it, Left from it returns to the tile, Right from it goes on to the next console. */
      const cell = a.closest('.vgcell'), car = cell && cell.querySelector('[data-vg-sub]'), own = cell && cell.querySelector('.vgtile');
      if (car && a !== car && dir === 'right' && items.includes(car)) return go(car, false);
      if (car && a === car && dir === 'left' && own) return go(own, false);
      const r = rectOf(cell || a);
      const row = items.filter(b => { if (b === a || !b.closest('.vggrid') || (cell && cell.contains(b))) return false; const q = rectOf(b), cy = (q.top + q.bottom) / 2; return cy >= r.top && cy <= r.bottom; });
      const t = nearest(r, row, dir, false, a);
      return t ? go(t, false) : true;
    }
    const t = step(a, items, dir);
    if (t) return go(t, false);
    if (dir === 'up') return true;   // the top row's Up stays: the Systems tab is off screen while the strip is open (28 Oct)
    return true;
  }

  /* ---- the manual booklet: Left and Right stay on their row (2026-10-17)

     Reported: "Right key moves from the turn page right button to the 1x
     button. Basically right goes up on the keys." The general rule (nearest())
     lets Left/Right reach a control on another row when nothing is beside it,
     and the zoom buttons sit up in the title bar, to the right of Next. In the
     manual the two rows are separate: Left/Right move only among controls that
     share the current control's row (Previous <-> Next; 1x <-> 2x <-> close), and
     the end of a row stays put, as it does on the grid. Up and Down keep the
     general geometric rule (the nearest control in that direction). */
  function manualMove(a, dir, top) {
    if (dir !== 'left' && dir !== 'right') return null;
    /* LEFT AND RIGHT TURN THE PAGES (30 Oct 2026: the booklet is never selected with the
       keys or a controller; "Left and right (D-pad, arrow keys ...) turn pages"). From Previous,
       Next, or nothing in particular, Left and Right turn the page (manual_booklet.js
       cwManualTurn: back, forward). On the title bar's row (Normal, Large, close) they still
       move along that row, as above, so those three stay reachable; Up and Down move between
       the two rows. */
    if (!(a && a.closest && a.closest('.manual-head-actions')) && typeof window.cwManualTurn === 'function') return !!window.cwManualTurn(dir);
    if (!a) return null;
    const r = rectOf(a);
    const row = focusablesIn(top).filter(c => { if (c === a) return false; const q = rectOf(c); const cy = (q.top + q.bottom) / 2; return cy >= r.top && cy <= r.bottom; });
    const t = nearest(r, row, dir, false, a);
    return t ? go(t, true) : true;                                 // the end of the row: stay
  }

  /* ---- the main move */

  function move(dir) {
    let top = topEl();
    if (top && SKIP_LAYERS.has(top.id)) return false;

    // The mouse or a scroll moved the cursor (nav5): start there, or only land there.
    const rt = retarget();
    if (rt) {
      if (rt.land) return go(rt.el, false);
      try { rt.el.focus({ preventScroll: true }); } catch (_) {}
      if (document.activeElement !== rt.el) return go(rt.el, false);
      top = topEl();
    }
    const a = document.activeElement;

    // Nothing focused yet (a remote's first press): the screen's default.
    const nothing = !a || a === document.body || a === document.documentElement || !visible(a);
    if (nothing) {
      // The manual with nothing focused (a click on a page took the focus off its buttons): Left and Right still turn the pages (30 Oct 2026).
      if (top && top.id === 'manualOverlay') { const r = manualMove(null, dir, top); if (r !== null) return !!r; }
      if (top) { const it = focusablesIn(top); return it.length ? go(it[0], true) : false; }
      return go(firstSensible(), false);
    }

    if (top) {
      if (!top.contains(a)) { const it = focusablesIn(top); return it.length ? go(it[0], true) : false; }
      if (top.id === 'vault-overlay') { const r = settingsMove(a, dir); if (r !== null) return !!r; }
      if (top.id === 'manualOverlay') { const r = manualMove(a, dir, top); if (r !== null) return !!r; }
      if (ZONE_DIRS.has(dir)) return false;
      const t = step(a, focusablesIn(top), dir);
      if (farStep(a, t, dir)) return true;                           // far away, or nothing more: the layer scrolls a step
      return t ? go(t, true) : true;                                 // at the edge: stay (and keep the page still)
    }

    if (gamesMenuOpen() && (gamesMenu().contains(a) || a === gamesCaret())) { const r = gamesMenuMove(a, dir); if (r !== null) return !!r; }
    /* THE OPEN SYSTEMS MENU HOLDS THE ARROWS (29 Oct: a finger opened it, the focus stayed on the
       wall, and D-pad Down moved the wall and shut the menu). With the menu open and the focus
       outside it, any arrow goes into the menu (emby.js vgOpenMenu also puts it there on open). */
    if (gamesMenuOpen() && !ZONE_DIRS.has(dir)) { const it = menuItems(); const lit = it.find(b => b.classList.contains('active') && b.closest('.vggrid')); if (it.length) return go(lit || it[0], false); }
    if (a.classList && a.classList.contains('vg-tab')) return tabMove(a, dir);

    const at = zoneOf(a);
    if (!at) {
      if (ZONE_DIRS.has(dir)) return false;
      return go(firstSensible(), false);
    }
    const { z } = at;
    if (z.id === 'grid' && a.parentElement === at.r && visible(at.r) && gridItemOk(a)) { const r = gridMove(a, at.r, dir); if (r !== null) return r; }   // the wall's quick pass
    let items = liveItems(z);
    if (z.id === 'page') items = items.filter(el => !(TIMELINE.root() && TIMELINE.root().contains(el)));
    const isItem = items.includes(a);
    if (ZONE_DIRS.has(dir)) {
      if (!z.roving || !isItem) return false;
      /* The wall's true first or last tile, which may be off the page while far (index.html
         _cwWallEdge): put back first, then picked as before. */
      if ((dir === 'first' || dir === 'last') && z.id === 'grid' && window._cwWallEdge && window._cwWallEdge(dir)) items = liveItems(z);
      if (dir === 'first') return go(items[0], false);
      if (dir === 'last') return go(items[items.length - 1], false);
      // One screen up or down, the tile nearest the same column.
      const r = rectOf(a), cx = (r.left + r.right) / 2, ty = (r.top + r.bottom) / 2 + (dir === 'pageDown' ? 1 : -1) * window.innerHeight * 0.8;
      let best = null, bd = Infinity;
      for (const c of items) { const q = rectOf(c); const d = Math.abs((q.top + q.bottom) / 2 - ty) + Math.abs((q.left + q.right) / 2 - cx) * 0.5; if (d < bd) { bd = d; best = c; } }
      if (best && best !== a) return go(best, false);
      // Nothing a screen away in this zone (a one-row strip, the grid's last row): the next zone that way.
      if (leave(a, dir === 'pageDown' ? 'down' : 'up')) return true;
      return true;
    }
    const t = step(a, items, dir);
    if (farStep(a, t, dir)) return true;                             // a page window: far away, or nothing more that way
    if (t) return go(t, false);
    if (dir === 'up' || dir === 'down') { if (leave(a, dir)) return true; }
    if (dir === 'right' && z.id === 'grid') { const tab = systemsTab(); if (tab) return go(tab, false); }   // as gridMove (29 Oct)
    return true;                                                     // the end of a row: stay
  }

  /* ------------------------------------------------------------ the key handler */

  /* The action a key means here: the registry's (phase 5 may rebind it), else KEYS. */
  function keyAction(e) {
    const A = window.Actions;
    if (registered && A && typeof A.match === 'function') return A.match(e, 'nav');
    return KEYS[e.key] || null;
  }
  function shouldTake(e, origin) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return false;
    const action = keyAction(e);
    if (!action) return false;
    const t = e.target;
    const top = topEl();
    if (top && SKIP_LAYERS.has(top.id)) return false;
    if (t && t.nodeType === 1) {
      // Down leaves the Media search box; Up leaves it only from the very start
      // of the text (where Up has nothing left to do in the field).
      /* AT REST the box is not being typed in (readonly, emby.js wireSearchStates,
         2026-10-18): every arrow is the page's, so focus passes through it like a button. */
      if (t.id === 'video-search' && !top && t.readOnly && !ZONE_ONLY.has(action)) return action;
      if (t.id === 'video-search' && !top && (e.key === 'ArrowDown' || (e.key === 'ArrowUp' && t.selectionStart === 0 && t.selectionEnd === 0))) return action;
      /* SETTINGS: UP AND DOWN LEAVE A ONE-LINE FIELD (2026-10-17). On a TV or a pad
         there is no Tab key, so a text box, a closed drop-down or a readonly code box was a
         dead end: Media and content and Your vault could not be walked past their first box.
         In the Settings window Up/Down move on from a single-line input (a readonly one gives
         up Left/Right too) and from a closed <select> (OK opens it; the open list keeps its
         own arrows); Left/Right stay the caret's. Textareas keep every arrow. */
      if (top && top.id === 'vault-overlay' && t.tagName !== 'TEXTAREA' && !t.isContentEditable && (t.tagName === 'INPUT' || t.tagName === 'SELECT')) {
        const vert = e.key === 'ArrowUp' || e.key === 'ArrowDown';
        if (vert || (t.readOnly && (e.key === 'ArrowLeft' || e.key === 'ArrowRight'))) return action;
        /* Right at the end of the text, or Left at its start, leaves the box too: the button beside
           a box (Save, Send recovery) is otherwise out of reach without a pointer. */
        let at0 = false, atEnd = false;
        try {
          const v = String(t.value || '');
          if (t.selectionStart == null) at0 = atEnd = true;            // no caret to move (select, email, number): the key is ours
          else { at0 = t.selectionStart === 0 && t.selectionEnd === 0; atEnd = t.selectionStart === v.length && t.selectionEnd === v.length; }
        } catch (_) { at0 = atEnd = true; }
        if ((e.key === 'ArrowRight' && atEnd) || (e.key === 'ArrowLeft' && at0)) return action;
      }
      if (isField(t)) return false;
      if (t.closest && t.closest(OWN_ARROWS)) return false;
      if (t.tagName === 'IFRAME') return false;
    }
    if (ZONE_ONLY.has(action)) {
      // Home/End/PageUp/PageDown stay the browser's unless focus (or the cursor the mouse set) is on a row item or a Settings tab.
      const a = origin || document.activeElement;
      if (!a || !a.hasAttribute || !(a.hasAttribute('data-gn-item') || (a.classList && a.classList.contains('settings-tab')))) return false;
    }
    return action;
  }
  function onKey(e) {
    const action = shouldTake(e);
    if (!action) return;
    if (window.Actions && typeof window.Actions.run === 'function' && registered) { if (window.Actions.run(action, e) !== false) e.preventDefault(); return; }
    if (ACTIONS[action].run() !== false) e.preventDefault();
  }
  // Bubble phase on window: everything nearer the focus (the Continue row,
  // the home banner, the player's panels) has already had the key.
  window.addEventListener('keydown', onKey);
  // nav5: when the mouse or a scroll moved the cursor, the key is ours first, so a
  // handler at the old focus (the Continue row's own arrows) does not move from there.
  const MOVES = new Set(['nav.up', 'nav.down', 'nav.left', 'nav.right', 'nav.first', 'nav.last', 'nav.pageUp', 'nav.pageDown']);
  window.addEventListener('keydown', e => {
    if (e.defaultPrevented || (!ptrEl && !touched)) return;           // keyboard only: the normal path
    const rt = retarget();
    if (!rt) return;
    const action = shouldTake(e, rt.el);
    if (!action || !MOVES.has(action)) return;
    const done = window.Actions && typeof window.Actions.run === 'function' && registered ? window.Actions.run(action, e) : ACTIONS[action].run();
    if (done === false) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);

  /* ------------------------------------------------------------ memory and roving upkeep */

  document.addEventListener('focusin', e => {
    if (ptrEl && e.target !== ptrEl) ptrEl = null;                  // focus moved elsewhere (Tab, a script): it is the cursor again
    if (topEl()) return;
    const at = zoneOf(e.target);
    if (!at) return;
    /* The wall's items are its own children: tested directly, not by listing every tile. */
    if (at.z.id === 'grid' && (e.target.parentElement !== at.r || !visible(at.r) || !gridItemOk(e.target))) return;
    if (at.z.id !== 'grid' && !liveItems(at.z).includes(e.target)) return;
    remember(at.z.id, e.target);
    if (at.z.roving) applyRoving(at.z);
  });
  // Zones re-render (the grid appends pages, the row refreshes): keep one tab stop.
  const mo = new MutationObserver(recs => {
    for (const m of recs) {
      const t = m.target;
      if (t.nodeType !== 1) continue;
      if (t.id === 'video-grid' || t.id === 'video-continue' || t.id === 'video-cat-row' || t.id === 'timeline-list' ||
          (t.classList && (t.classList.contains('view-mode-row') || t.classList.contains('vcr-row') || t.classList.contains('settings-tabs'))) ||
          (t.querySelector && t.querySelector('#video-grid, #video-continue, #video-cat-row, #timeline-list, .view-mode-row'))) { queueRoving(); return; }
    }
  });

  /* ------------------------------------------------------------ registry and boot */

  let registered = false;
  function register() {
    const A = window.Actions;
    if (registered || !A || typeof A.register !== 'function') return;
    try {
      for (const [id, def] of Object.entries(ACTIONS)) {
        const keys = Object.keys(KEYS).filter(k => KEYS[k] === id);
        // run through ACTIONS[id] (not a copy), so a later change to the table is what runs.
        A.register(id, { label: def.label, group: 'Navigation', scope: 'nav', keys, run: e => ACTIONS[id].run(e), palette: keys.length === 0 });
      }
      registered = true;
    } catch (e) { console.warn('[nav] action registry:', e); }
  }

  /* ---- doc row 2.4: the TV tile lift and larger tiles in TV mode */
  function tvStyles() {
    if (document.getElementById('gn-tv-style')) return;
    const st = document.createElement('style');
    st.id = 'gn-tv-style';
    st.textContent = `
      /* The focused tile lifts: the one ring, plus a 1.05 scale and a soft shadow (doc 5.6).
         Only transform animates (the compositor's job, smooth on a TV); the shadow switches. */
      body.gnw-tv #video-grid .device-card { transition: transform .16s ease-out, border-color .2s; }
      body.gnw-tv #video-grid .device-card:focus-visible {
        transform: scale(1.05);
        box-shadow: var(--tile-glow), 0 22px 46px -14px rgba(0,0,0,.7);
        z-index: 6;
      }
      /* The clock and weather widgets are tiles too; their glow sits on .vw-main already. */
      body.gnw-tv #video-grid .vgrid-widget:not(.tilting):focus-visible { transform: scale(1.05); }
      @media (prefers-reduced-motion: reduce) {
        body.gnw-tv #video-grid .device-card { transition: none; }
        body.gnw-tv #video-grid .device-card:focus-visible,
        body.gnw-tv #video-grid .vgrid-widget:not(.tilting):focus-visible { transform: none; }
      }
      /* Larger tiles on a TV (doc 5.9): wider columns in both layouts (the stacked one reads
         --vw too) and a larger name. At 1920 wide: 5 columns of about 335px, not 6 of 273. */
      body.gnw-tv #video-grid.video-grid { --vw: 300px; }
      body.gnw-tv #video-grid .device-card .name { font-size: 18px; }
    `;
    document.head.appendChild(st);
  }

  function boot() {
    tvStyles();
    mo.observe(document.body, { childList: true, subtree: true });
    queueRoving();
    register();
    if (!registered) window.addEventListener('gnw-actions-ready', register, { once: true });
  }

  window.GnwNav = {
    BUILD, KEYS, ACTIONS, move, leave, focusZone, firstSensible,
    zoneOf: el => { const z = zoneOf(el); return z ? z.z.id : null; },
    /* A zone's live items, in its own order (2026-10-18: gamepad.js steps the Media
       toolbar with the triggers). [] when the zone is not on this page or not on screen. */
    zoneItems: id => { const z = zones().find(x => x.id === id); return z ? liveItems(z) : []; },
    /* Move a scroll box to a place by the steady scroll (31 Oct: compat.js's rows). */
    scrollBox: (box, top) => { if (!box) return; const at = vs.on && vs.box === box ? vs.p1 : box.scrollTop; pageScrollTo(top, top - at, box); },
    scrollGoal: box => (vs.on && vs.box === box ? vs.p1 : box.scrollTop),
    revealEl: el => { if (el) reveal(el, !!(topEl() && topEl().contains(el))); },
    _memory: () => Array.from(memory.entries()).map(([k, v]) => [k, v.sel]),
    _cursor: () => ({ ptr: ptrEl ? (selOf(ptrEl) || ptrEl.tagName) : null, touched, pointer: ptr }),
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

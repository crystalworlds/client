/*
 * deeplinks.js -- links anyone can paste (2026-10-21: "The pages like Compatibility
 * List, Timeline, About need a URL that anyone can link directly to. Also the Hardware and Emulation
 * tabs of each system").
 *
 *   #/compatibility                    the Media page with the compatibility list open
 *   #/compatibility?system=nes&status=nothing&kind=hack&q=mario
 *                                      ... with those filters (system: gnw, tft, gb, nes, pm, tj, a2600,
 *                                      a5200, a7800, alynx; status: plays, boots, nothing, untested)
 *   #/media/about, #/media/timeline    the Media page with the About or Timeline window open
 *                                      (#/about and #/timeline stay the full pages, as before)
 *   #/<system>/hardware                that system's Hardware page; <system>: gb, gbc, nes, famicom, fds,
 *   #/<system>/emulation               pokemon-mini, atari2600, atari5200, atari7800, atarilynx, or a
 *                                      Game & Watch unit's id (silver-ball, multiscreen-donkey-kong ...)
 *   #/device/<id>/hardware             a game's drawer opened on that tab (also /emulation, /source)
 *
 * Opening one of these from the page writes its link into the address bar (the windows push a history
 * entry, so Back closes them; a drawer tab replaces its entry). Closing returns the bar to the page.
 * REAL ADDRESSES (22 Oct 2026: "real paths (History API) with old # links forwarding").
 * Served by the site server (index.html's first <script> sets window.__cwPaths), every one of these is
 * a real path: /compatibility?system=nes, /about, /timeline, /home, /nes/hardware, /device/<id>/emulation.
 * The server answers each with this page (tools/localserver routes.go), with its own title from
 * site-routes.json. An old "#/..." link is forwarded to its path on arrival (replaceState, no extra
 * Back step). The routes inside the page keep their names; only the address bar changes:
 *   cwRouteNow()      the route the address bar names now ("/media", "/compatibility?system=nes" ...)
 *   cwRouteHref(r)    the address for route r: "/timeline" for "/series", else r ("#" + r without paths)
 * A copy opened as a file or from another web server keeps "#/" addresses (they need no server).
 *
 * Loaded in <head>, before the page's own boot, so index.html applyHashRoute can ask route() what a
 * hash means on the very first load; everything it opens waits until the page has built it.
 * Silent; nothing here plays.
 */
(function () {
  'use strict';
  if (window.CwDeepLink) return;

  /* MEDIA IS THE ONLY PAGE (22 Oct): Home, About and Timeline are
     windows over it, like Compatibility. Their old addresses (#/about, #/series, #/media/about ...)
     open the same windows and are rewritten to the one address each. */
  /* FEATURES (31 Oct): a window like the others, opened by the button right of Home. */
  const WIN = { '/compatibility': 'compat', '/about': 'about', '/timeline': 'timeline', '/series': 'timeline', '/home': 'home', '/features': 'features', '/stories': 'stories',
    '/media/about': 'about', '/media/timeline': 'timeline', '/media/home': 'home', '/media/features': 'features' };
  const WIN_PATH = { compat: '/compatibility', about: '/about', timeline: '/timeline', home: '/home', features: '/features', stories: '/stories' };
  const WIN_BTN = { compat: 'video-compat-btn', about: 'video-about-btn', timeline: 'video-timeline-btn', home: 'video-home-btn', features: 'video-features-btn', stories: 'video-stories-btn' };
  const ALIAS = { gameboy: 'gb', 'game-boy': 'gb', 'gameboy-color': 'gbc', 'game-boy-color': 'gbc', pm: 'pokemon-mini', pokemini: 'pokemon-mini',
    lynx: 'atarilynx', 'atari-lynx': 'atarilynx', a2600: 'atari2600', a5200: 'atari5200', a7800: 'atari7800', 2600: 'atari2600', 5200: 'atari5200', 7800: 'atari7800',
    'disk-system': 'fds', 'famicom-disk-system': 'fds', gnw: 'silver-ball', 'game-and-watch': 'silver-ball', 'game-and-watch-colour': 'reissue-super-mario-bros' };
  /* ------------------------------------------------------------ the address bar */
  const PATHS = !!window.__cwPaths;
  const PUB = { '/media': '/', '/series': '/timeline' };  // route -> address (Media is the site's root)
  const IN = { '/index.html': '/' };                      // address -> route
  /** The route the address bar names now. */
  function now() {
    if (!PATHS || /^#\//.test(location.hash)) return location.hash.replace(/^#/, '') || '/';
    let p = (location.pathname || '/').replace(/\/+$/, '') || '/';
    p = IN[p.toLowerCase()] || p;
    return p === '/compatibility' ? p + location.search : p;
  }
  /** The address for route r. */
  function href(r) {
    r = String(r || '/');
    if (!PATHS) return '#' + r;
    const i = r.indexOf('?'), p = i < 0 ? r : r.slice(0, i);
    return (PUB[p] || p) + (i < 0 ? '' : r.slice(i));
  }
  const bar = () => (PATHS ? location.pathname + location.search : location.hash);
  /** An old "#/..." link (a bookmark, a pasted link, an old page's link): its path takes its place. */
  function forward() {
    if (!PATHS || !/^#\//.test(location.hash)) return false;
    // 404.html sends a direct address here as /?query#/route#own-hash: the own hash goes back on the end
    const h = location.hash.slice(1), i = h.indexOf('#');
    const r = i < 0 ? h : h.slice(0, i), own = i < 0 ? '' : h.slice(i), u = href(r);
    // keep the address's own settings (?tv=1, ?diag=1) beside the route's own query
    const q = location.search ? location.search.slice(1) : '';
    try { history.replaceState(history.state, '', (q ? u + (u.indexOf('?') < 0 ? '?' : '&') + q : u) + own); } catch (_) { return false; }
    return true;
  }
  window.cwRouteNow = now;
  window.cwRouteHref = href;
  forward();
  // Media is the site's root: /media (and /index.html) read as "/" in the address bar.
  try { if (PATHS && /^\/(media|index\.html)\/?$/i.test(location.pathname)) history.replaceState(history.state, '', '/' + location.search + location.hash); } catch (_) {}

  const g = n => { try { return window[n] || (0, eval)('typeof ' + n + ' !== "undefined" ? ' + n + ' : undefined'); } catch (_) { return undefined; } };   // eslint-disable-line no-eval
  const call = (n, ...a) => { const f = g(n); return typeof f === 'function' ? f(...a) : ''; };
  const asHTML = r => (typeof r === 'string' ? r : (r && r.header ? '<div class="hw-tab">' + r.header + r.body + (r.sources || '') + '</div>' : ''));

  /* The system pages: the same builders the drawers use (drawer-unified.js PROFILES, index.html
     hardwareTabHTML), given the system instead of a game. */
  function nesD(c) { return { id: 'nes-proof', system: 'nes', catalogue: 'nes', nesConsole: c }; }
  const SYS = {
    gb: ['Game Boy', () => ({ catalogue: 'game-boy', system: 'gb' }), d => call('gbEmulationTabHTML', d)],
    gbc: ['Game Boy Color', () => ({ catalogue: 'game-boy', system: 'gbc' }), d => call('gbcEmulationTabHTML', d)],
    nes: ['NES', () => nesD('nes'), d => asHTML(call('nesEmulationTabHTML', d)) + asHTML(call('nesBuildSpecEmulationTabHTML', d))],
    famicom: ['Famicom', () => nesD('famicom'), d => asHTML(call('nesEmulationTabHTML', d)) + asHTML(call('nesBuildSpecEmulationTabHTML', d))],
    fds: ['Famicom Disk System', () => nesD('fds'), d => asHTML(call('nesEmulationTabHTML', d)) + asHTML(call('nesBuildSpecEmulationTabHTML', d))],
    'pokemon-mini': ['Pokémon mini', () => ({ catalogue: 'pokemon-mini' }), d => call('pmEmulationTabHTML', d)],
    atari2600: ['Atari 2600', () => ({ catalogue: 'atari2600' }), d => call('atariEmulationTabHTML', d)],
    atari5200: ['Atari 5200', () => ({ catalogue: 'atari5200' }), d => call('atariEmulationTabHTML', d)],
    atari7800: ['Atari 7800', () => ({ catalogue: 'atari7800' }), d => call('atariEmulationTabHTML', d)],
    atarilynx: ['Atari Lynx', () => ({ catalogue: 'atarilynx' }), d => call('atariEmulationTabHTML', d)],
  };
  /* A Game & Watch unit (or a colour unit, Tetris Jr.) by its id. */
  function unit(id) { const all = g('ALL_DEVICES') || g('DEVICES') || []; return all.find ? all.find(d => d.id === id) : null; }
  function sysOf(key) {
    key = ALIAS[key] || key;
    if (SYS[key]) { const [label, mk, emu] = SYS[key]; return { key, label, d: mk, emu }; }
    const u = unit(key);
    if (u) return { key, label: u.name, d: () => u, emu: d => asHTML((typeof g('gnwChipEmulationTabHTML') === 'function' && call('gnwChipEmulationTabHTML', d)) || call('emulationTabHTML', d)) };
    return null;
  }
  /* Called by the documentation window (emulators-table.js openProof through openDoc). */
  window.cwSysDocHTML = function (key, tab) {
    if (window.__cwNoDocs) return '';   // only on crystalworlds.media (4 Nov 2026)
    const s = sysOf(key); if (!s) return '';
    const d = s.d();
    if (tab !== 'hardware') return asHTML(s.emu(d));
    const html = asHTML(call('hardwareTabHTML', d));
    if (!SYS[s.key]) return html;
    /* A system's page has no game, so the per-game section ("This cartridge: ...") has nothing to say. */
    const t = document.createElement('template');
    t.innerHTML = html;
    t.content.querySelectorAll('section').forEach(sec => {
      const h = sec.querySelector('h1, h2, h3, h4, .sect-h');
      if (h && /^This (cartridge|disk)\b/i.test(h.textContent.trim())) sec.remove();
    });
    return t.innerHTML;
  };

  /* ------------------------------------------------------------ what a hash means */
  let pending = null, timer = 0, openedDoc = null, closedDoc = null;
  const curRoute = () => { try { const st = g('state'); const r = st && st.route; return r && !/^\/(device|play)\//.test(r) && !WIN[r] && !/\/(hardware|emulation)$/.test(r) ? r : '/'; } catch (_) { return '/'; } };
  const split = h => { const i = h.indexOf('?'); return [(i < 0 ? h : h.slice(0, i)).replace(/\/+$/, '') || '/', i < 0 ? '' : h.slice(i + 1)]; };

  /* BACK CLOSES WHAT A LINK OPENED (23 Oct: the phone's Back closed the installed
     app). Arriving on a window's or a drawer's address opened it with nothing under it in this tab's
     history, so Back left the site. The arrival entry becomes Media and the address goes back on top
     as its own entry, marked { cwLayer: 1 } like the entries the page pushes when it opens one itself.
     A reload of such an entry finds the mark and adds nothing. (A system page, /nes/hardware, already
     gets its window's own entry; a game's /play/ address is left as it was.) */
  /* OFF OUR OWN ADDRESS (28 Oct; index.html sets __cwOffsite): the windows'
     addresses (/home, /about, /timeline, /compatibility and their old forms) are the wall. */
  const OFF = !!window.__cwOffsite;
  try {
    const [p0] = split(now());
    if (OFF && WIN[p0]) history.replaceState(history.state, '', PATHS ? '/' + location.search : location.pathname + location.search + '#/');
  } catch (_) {}
  try {
    const st0 = history.state, [p0] = split(now());
    if (!(st0 && st0.cwLayer) && ((WIN[p0] && !OFF) || /^\/device\/[^/]+/.test(p0))) {
      const here = location.pathname + location.search + location.hash;
      history.replaceState(st0, '', PATHS ? '/' : location.pathname + location.search + '#/');
      history.pushState({ cwLayer: 1 }, '', here);
    }
  } catch (_) {}

  /** index.html applyHashRoute: the route to render for hash h (unchanged when it is not ours). */
  let routed = false;
  function route(h) {
    const [p, q] = split(String(h || '/'));
    const first = !routed; routed = true;
    const W = window.CwAboutWindow;
    if (WIN[p] && OFF) { try { history.replaceState(history.state, '', href('/media')); } catch (_) {} return '/media'; }   // off our address: the wall (28 Oct)
    if (WIN[p]) { pending = { win: WIN[p], q }; later(); return '/media'; }
    if (W && W.isOpen()) W.close(true);   // Back (or a new link) past an open window closes it
    if (p === '/' || p === '/media') { if (first) autoHome(); return '/media'; }   // the landing page
    let m = /^\/device\/([^/]+)\/(hardware|emulation|source)$/.exec(p);
    if (m) { pending = { tab: m[2], id: decodeURIComponent(m[1]) }; later(); return '/device/' + m[1]; }
    m = /^\/([a-z0-9-]+)\/(hardware|emulation)$/.exec(p);
    if (m && m[1] !== 'device' && m[1] !== 'play' && (SYS[ALIAS[m[1]] || m[1]] || ALIAS[m[1]] || /-/.test(m[1]))) {
      /* Closing the window steps history back onto the same link (index.html _ovSync): not a new visit. */
      if (closedDoc === p) { closedDoc = null; history.replaceState(history.state, '', href(curRoute())); return curRoute(); }
      pending = { doc: m[1], tab: m[2] }; later(); return curRoute();
    }
    if (openedDoc && document.getElementById('emu-proof-overlay') && document.getElementById('emu-proof-overlay').classList.contains('open')) { openedDoc = null; try { window.closeOverlay('emu-proof-overlay'); } catch (_) {} }
    return h;
  }
  /* HOME OPENS BY ITSELF (22 Oct): for a visitor with no game server joined, on the landing
     page, and only on the public site (a hostname containing crystalworlds.media). A copy of the
     source run anywhere else never opens it by itself. Once per page load. */
  let autoDone = false;
  function joinedServer() {
    try {
      const t = JSON.parse(localStorage.getItem('cws.servers.v1') || '{}') || {};
      return Object.keys(t).some(v => t[v] && typeof t[v] === 'object' && Object.keys(t[v]).some(s => t[v][s] && t[v][s].device_token));
    } catch (_) { return false; }
  }
  /* A NEW VAULT CODE IS A NEW VISITOR (28 Oct): Home opens for them too, joined server or
     not. New = no code stored when the page started, or one made on this load (index.html
     getOrCreateVaultCode sets vaultCodeFreshlyMinted). */
  const VAULT0 = (() => { try { return !localStorage.getItem('pp-vault-code-v1'); } catch (_) { return false; } })();
  const newVault = () => VAULT0 || g('vaultCodeFreshlyMinted') === true;
  function autoHome() {
    if (autoDone) return;
    autoDone = true;
    if (OFF) return;   // off our address there is no Home (28 Oct)
    if (window.__cwStoriesBack) return;   // just back from the Stories sign-in: its result shows instead (7 Nov)
    if (!newVault() && (!/crystalworlds\.media/i.test(location.hostname) || joinedServer())) return;
    pending = { win: 'home', q: '', auto: true }; later();
  }
  function later() { clearTimeout(timer); let n = 0; const tick = () => { if (!pending) return; if (run()) { pending = null; return; } if (++n < 300) timer = setTimeout(tick, 200); else pending = null; }; timer = setTimeout(tick, 0); }
  function run() {
    const P = pending;
    if (P.win) {
      const W = window.CwAboutWindow, media = document.getElementById('view-media');
      if (!W || !media || !media.classList.contains('active') || !document.getElementById(WIN_BTN[P.win])) return false;
      if (P.win === 'compat') { if (!window.CompatList) return false; try { window.CompatList.setQuery && window.CompatList.setQuery(P.q); } catch (_) {} }
      if (W.isOpen() && W.kind() === P.win) { linkOpened = false; return true; }
      linkOpened = !P.auto;   // a link names its window already; the automatic Home adds its own Back step
      W.open(P.win);
      return true;
    }
    /* HARDWARE AND EMULATION ONLY ON OUR OWN ADDRESS (4 Nov 2026, index.html head): elsewhere
       such an address opens nothing (a drawer's stays on its first tab) and the address bar
       drops the tab. Waits while site.local.json is still being read (showDocs). */
    if ((P.doc || /^(hardware|emulation)$/.test(P.tab || '')) && (window.__cwDocsPending || window.__cwNoDocs)) {
      if (window.__cwDocsPending) return false;
      try {
        if (P.doc) history.replaceState(history.state, '', href(curRoute()));
        else history.replaceState(history.state, '', href('/device/' + encodeURIComponent(P.id)));
      } catch (_) {}
      return true;
    }
    if (P.doc) {
      const E = window.CwEmuCards, s = sysOf(P.doc);
      if (!E || !E.openDoc || !s || typeof g('hardwareTabHTML') !== 'function') return false;
      if (!asHTML(window.cwSysDocHTML(P.doc, P.tab))) return false;   // its builder file has not loaded yet
      openedDoc = { key: P.doc, tab: P.tab };
      E.openDoc({ fn: 'cwSysDocHTML', args: [P.doc, P.tab], anchor: '', title: s.label, sub: P.tab === 'hardware' ? 'Hardware' : 'Emulation' });
      watchDoc();
      return true;
    }
    if (P.tab) {
      const b = document.querySelector('#device-modal .drawer-tab[data-tab="' + P.tab + '"]');
      if (!b) return false;
      try { window.switchDrawerTab(b, P.tab); } catch (_) { return false; }
      return true;
    }
    return true;
  }
  /* With real addresses no hashchange follows the window's own step back onto its link (index.html
     ignores that popstate as its own), so the link is put back to the page here. */
  window.addEventListener('popstate', () => {
    if (!closedDoc || !PATHS) return;
    const [p] = split(now());
    if (p === closedDoc) { closedDoc = null; history.replaceState(history.state, '', href(curRoute())); }
  });
  /* The documentation window closed (its x, Back, a click outside): the bar returns to the page. */
  function watchDoc() {
    const ov = document.getElementById('emu-proof-overlay'); if (!ov || ov.__clWatch) return;
    ov.__clWatch = true;
    new MutationObserver(() => {
      if (ov.classList.contains('open') || !openedDoc) return;
      openedDoc = null;
      const [p] = split(now());
      if (/^\/[a-z0-9-]+\/(hardware|emulation)$/.test(p) && !/^\/device\//.test(p)) { closedDoc = p; history.replaceState(history.state, '', href(curRoute())); setTimeout(() => { closedDoc = null; }, 1500); }
    }).observe(ov, { attributes: true, attributeFilter: ['class'] });
  }

  /* ------------------------------------------------------------ the windows write their link */
  let linkOpened = false, pushed = false;
  /** emby.js aboutSet: the window opened or closed. */
  function windowChanged(open, kind) {
    const [p] = split(now());
    /* KEYBOARD SHORTCUTS (4 Nov, kind 'keys': the page window on a small screen, shortcuts.js) has no
       address of its own: it takes one history entry on the content page's address (marked cwKeys),
       so a phone's Back closes it like the other windows, and gives it back when it is closed. */
    if (kind === 'keys') {
      const st = history.state;
      if (open) {
        if (st && st.cwKeys) return;
        if (WIN[p]) { history.replaceState(Object.assign({}, st, { cwKeys: 1 }), '', href('/media')); return; }   // it replaced another window: that entry is its own now
        history.pushState({ cwLayer: 1, cwKeys: 1 }, '', bar()); pushed = true;
        return;
      }
      if (!(st && st.cwKeys)) { pushed = false; return; }   // Back already left it
      if (pushed) { pushed = false; selfBack(); } else history.replaceState(Object.assign({}, st, { cwKeys: 0 }), '', bar());
      return;
    }
    if (open && history.state && history.state.cwKeys) {     // another window replaced Keyboard shortcuts: its entry, the new address
      const st = Object.assign({}, history.state, { cwKeys: 0 });
      history.replaceState(st, '', href(WIN_PATH[kind] + (kind === 'compat' ? compatQuery() : '')));
      return;
    }
    if (open) {
      const want = WIN_PATH[kind] + (kind === 'compat' ? compatQuery() : '');
      if (linkOpened || p === WIN_PATH[kind]) {
        linkOpened = false;
        pushed = !!(history.state && history.state.cwLayer);   // its link's entry sits on Media's: closing takes it back
        if (href(want) !== bar()) history.replaceState(history.state, '', href(want));
        return;
      }
      if (WIN[p]) history.replaceState(history.state, '', href(want));   // one window replaced another
      else { history.pushState({ cwLayer: 1 }, '', href(want)); pushed = true; }
      return;
    }
    if (!WIN[p]) { pushed = false; return; }   // Back already left it
    /* A story has its own entry on top of the Stories window's (stories.js, 7 Nov): step past both. */
    if (pushed) { pushed = false; selfBack(history.state && history.state.cwStory ? 2 : 1); } else history.replaceState(null, '', href('/media'));
  }
  /* The window took its own entry back (it was closed by its button, Escape or a click outside):
     index.html's popstate/hashchange must not route again, since the page under it has not changed
     (a fresh route redrew the bar and took the focus off the button the window had returned it to;
     22 Oct). One step each, forgotten after a second. */
  let skipPop = 0, skipHash = 0, skipT = 0;
  function selfBack(steps) {
    skipPop = 1; skipHash = PATHS ? 0 : 1;
    clearTimeout(skipT); skipT = setTimeout(() => { skipPop = skipHash = 0; }, 1000);
    history.go(-(steps || 1));
  }
  /** index.html: is this popstate ('pop') or hashchange ('hash') the window's own step back? */
  function ownStep(kind) {
    if (kind === 'pop' && skipPop) { skipPop = 0; return true; }
    if (kind === 'hash' && skipHash) { skipHash = 0; return true; }
    return false;
  }
  let compatQ = '';
  const compatQuery = () => (compatQ ? '?' + compatQ : '');
  /** compat.js: its filters changed (replaces the entry, never adds one). */
  function compatChanged(q) {
    compatQ = q || '';
    const [p] = split(now());
    if (p === '/compatibility') history.replaceState(history.state, '', href('/compatibility' + compatQuery()));
  }

  /* ------------------------------------------------------------ a drawer's tabs write theirs */
  function wrapTabs() {
    const orig = window.switchDrawerTab;
    if (typeof orig !== 'function' || orig.__cl) return;
    const w = function (el, tab) {
      const r = orig.apply(this, arguments);
      try {
        const [p] = split(now());
        const m = /^\/device\/([^/]+)/.exec(p);
        if (m && !(window.__cwNoDocs && /^(hardware|emulation)$/.test(tab))) history.replaceState(history.state, '', href('/device/' + m[1] + (/^(hardware|emulation|source)$/.test(tab) ? '/' + tab : '')));
      } catch (_) {}
      return r;
    };
    w.__cl = true;
    window.switchDrawerTab = w;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wrapTabs); else wrapTabs();
  window.addEventListener('load', wrapTabs);

  /* ------------------------------------------------------------ each address's own title
     site-routes.json: the same titles and descriptions the site server puts in each address's first
     HTML. A game's drawer takes the game's name. Written after every change of address. */
  let META = null, metaT = 0;
  function setAttr(sel, attr, v) { const e = document.querySelector(sel); if (e && v && e.getAttribute(attr) !== v) e.setAttribute(attr, v); }
  function meta() {
    metaT = 0;
    if (!META || !META.routes || !META.default) return;
    const [p] = split(href(now()).replace(/^#/, ''));
    const r = META.routes[p] || {};
    let title = r.title, desc = r.description;
    const m = /^\/(?:device|play)\/([^/]+)/.exec(p);
    /* The tab reads only the site name on every address (28 Oct 2026: shorter, never cut). */
    title = META.site || 'Crystal Worlds'; desc = desc || META.default.description;
    if (document.title !== title) document.title = title;
    setAttr('meta[name="description"]', 'content', desc);
    if (window.__cwPaths) {   // this copy's own address
      setAttr('link[rel="canonical"]', 'href', location.origin + p);
      setAttr('meta[property="og:url"]', 'content', location.origin + p);
    }
  }
  const metaSoon = () => { if (!metaT) metaT = setTimeout(meta, 0); };
  (function loadMeta() {
    if (typeof fetch !== 'function' || !/^https?:$/.test(location.protocol)) return;
    fetch('site-routes.json?v=2.1.1', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).then(j => { if (j) { META = j; meta(); } }).catch(() => {});
    for (const k of ['pushState', 'replaceState']) {
      const orig = history[k];
      if (typeof orig !== 'function') continue;
      history[k] = function () { const r = orig.apply(this, arguments); metaSoon(); return r; };
    }
    window.addEventListener('popstate', metaSoon);
    window.addEventListener('hashchange', metaSoon);
    document.addEventListener('DOMContentLoaded', metaSoon);   // a game's name needs the page's catalogue
    window.addEventListener('load', metaSoon);
  })();

  /* isWindow (1 Nov 2026): does route r open one of the windows over the page? index.html
     route() then leaves the page where it is, so the window stays under the search bar. */
  window.CwDeepLink = { route, windowChanged, compatChanged, sysDoc: window.cwSysDocHTML, now, href, forward, ownStep, stepBack: () => selfBack(), paths: PATHS, isWindow: r => !!WIN[split(String(r || '/'))[0]] };
})();

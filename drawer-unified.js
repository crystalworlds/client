/*
 * drawer-unified.js -- ONE game drawer for every system (phase 7 of the unified
 * UI work, docs/UNIFIED-BUILD-PLAN.md section 5; design input
 * docs/DRAWER-INVENTORY.md). Written 2026-10-14.
 *
 * The aim, 2026-10-11: "standardise every system's game drawer to the Game Boy
 * drawer's look, with ONE code base. Optional sections shown only when relevant."
 *
 * THE SWITCH. On by default since 2026-10-14; ?drawer=default (or old) on the site's URL
 * turns it off for the tab (sessionStorage 'cw.drawer.flag'), ?drawer=unified back on. With it
 * off, nothing here runs and every old builder in index.html (openDevice,
 * openGBDevice, openNESDevice, openAtariDevice, openPMDevice) is untouched.
 * With it on, those five names are wrapped (they are global function
 * declarations, so every caller, inline onclick or internal, reaches the
 * wrapper), and every drawer is built by build() below.
 *
 * ONE SHAPE (the Game Boy drawer's), top to bottom:
 *   header       system or series name, a dot, the release month and year
 *   tabs         the title, Hardware, then Emulation when the system has it
 *   hero         the console (or the unit's photograph), desktop only
 *   strip        the old image viewer's thumbnails, every size: 2D box art, 3D box art, photos
 *                and stills, the manual; each opens the old lightbox (D-pad, A, B on a TV)
 *   pills        series (always a link to that shelf on Media), model, genre, date, Play, Manual
 *   title row    the name, then the Game & Watch edition picker and rarity badge where they apply
 *   game details gamemeta.js's block (descriptions, publisher, ratings, the review score)
 *   body         About / Overview / Gameplay / Legacy / Additional Info / From the Promo / Releases, each only when held
 *   sidebar      Variants (variants.js), Facts (game rows first, then the machine's),
 *                Play time, Built-in Games, the status panel
 * PER-SYSTEM DIFFERENCES ARE DATA ONLY: the PROFILES table and profileOf().
 *
 * DESIGN DECISIONS IT CARRIES:
 *   - narrow screens (1400 px and under): no console picture (no hero, no inline live
 *     demo, no stage); the picture strip still shows, as one compact row on a phone;
 *   - the drawer always opens at the top (openOverlay's gnwDrawerToTop, and again here);
 *   - the version menu's Translations, Hacks and Other copies submenus, 50 at a
 *     time (variants.js), drivable by D-pad, A, B and a remote: B in an open
 *     submenu closes that submenu first (the keydown below);
 *   - review score "4.5/5 (N ratings)", linked, after the age rating (gamemeta.js);
 *   - one shell colour per game per load: the tile's (CwUnifiedHost.shellFor);
 *   - Enter, OK and A act once per press (keys.js, site-wide);
 *   - Play closes the drawer before the game opens (each system's launcher);
 *   - sound starts from the drawer's Play press: the shared AudioContext is woken
 *     inside that press when the play host's audio engine is on the page.
 *
 * WHAT A GAME DOES NOT KNOW IS LEFT OUT, NOT DASHED. Developer, Genre and Players
 * are written as "-" placeholders so gamemeta.js fills them from the built-in
 * metadata (its fillPlaceholders, which then keeps them out of its own block);
 * once its lookup has answered, any placeholder still empty is hidden.
 *
 * SOUND: none of its own; a drawer is silent (the sound rule).
 */
(function () {
  'use strict';
  if (window.CwDrawer) return;

  const BUILD = '20261026-cht1';
  /* THE UNIFIED DRAWER IS THE ONLY DRAWER (2026-10-15: no two versions, no URL switch).
     The ?drawer= switch and its sessionStorage key are gone. */
  try { sessionStorage.removeItem('cw.drawer.flag'); } catch (_) {}
  const on = () => true;

  /* ------------------------------------------------------------ helpers */
  /* index.html's top-level const/let names are visible to this classic script by
     name but are not properties of window, so each is read through its own getter. */
  const LEX = {
    formatMonthYear: () => typeof formatMonthYear !== 'undefined' ? formatMonthYear : undefined,
    formatDateFull: () => typeof formatDateFull !== 'undefined' ? formatDateFull : undefined,
    seriesById: () => typeof seriesById !== 'undefined' ? seriesById : undefined,
    ALL_DEVICES: () => typeof ALL_DEVICES !== 'undefined' ? ALL_DEVICES : undefined,
    GENRES: () => typeof GENRES !== 'undefined' ? GENRES : undefined,
    CUSTOM_RELEASED: () => typeof CUSTOM_RELEASED !== 'undefined' ? CUSTOM_RELEASED : undefined,
    NES_CONSOLE_LABEL: () => typeof NES_CONSOLE_LABEL !== 'undefined' ? NES_CONSOLE_LABEL : undefined,
    ATARI_SYSTEMS: () => typeof ATARI_SYSTEMS !== 'undefined' ? ATARI_SYSTEMS : undefined,
    GNW_EMULATED_GAMES: () => typeof GNW_EMULATED_GAMES !== 'undefined' ? GNW_EMULATED_GAMES : undefined,
    TFT_TWIN_UNITS: () => typeof TFT_TWIN_UNITS !== 'undefined' ? TFT_TWIN_UNITS : undefined,
    TJ_ID: () => typeof TJ_ID !== 'undefined' ? TJ_ID : undefined,
    STATIC_PREVIEW_IDS: () => typeof STATIC_PREVIEW_IDS !== 'undefined' ? STATIC_PREVIEW_IDS : undefined,
    GAME_SLUGS: () => typeof GAME_SLUGS !== 'undefined' ? GAME_SLUGS : undefined,
    BROKEN_IMG_KEYS: () => typeof BROKEN_IMG_KEYS !== 'undefined' ? BROKEN_IMG_KEYS : undefined,
    _imgArchivePending: () => typeof _imgArchivePending !== 'undefined' ? _imgArchivePending : undefined,
    BOX_ART_IMAGES: () => typeof BOX_ART_IMAGES !== 'undefined' ? BOX_ART_IMAGES : undefined,
    MANUAL_BOOKLETS: () => typeof MANUAL_BOOKLETS !== 'undefined' ? MANUAL_BOOKLETS : undefined,
    MANUALS: () => typeof MANUALS !== 'undefined' ? MANUALS : undefined,
    GBC_SHELLS: () => typeof GBC_SHELLS !== 'undefined' ? GBC_SHELLS : undefined,
    _pmFileAvailable: () => typeof _pmFileAvailable !== 'undefined' ? _pmFileAvailable : undefined,
  };
  const g = name => { try { if (LEX[name]) return LEX[name](); return window[name]; } catch (_) { return undefined; } };
  const fn = name => { const f = g(name); return typeof f === 'function' ? f : null; };
  const call = (name, ...a) => { const f = fn(name); try { return f ? f(...a) : undefined; } catch (e) { console.warn('[drawer] ' + name + ' failed', e); return undefined; } };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const attr = s => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  const unknown = v => v == null || v === '' || v === '\u2014' || v === '-' || (Array.isArray(v) && !v.length);
  const PH = '-';   // the placeholder gamemeta.js recognises (its DASH accepts a hyphen)
  const monthYear = s => { const f = g('formatMonthYear'); const v = s && f ? f(s) : ''; return unknown(v) ? '' : v; };
  const narrow = () => window.matchMedia('(max-width: 1400px)').matches;

  const PLAY_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="11" x2="10" y2="11"/><line x1="8" y1="9" x2="8" y2="13"/><line x1="15" y1="12" x2="15.01" y2="12"/><line x1="18" y1="10" x2="18.01" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258C21.166 6.83 19.51 5 17.32 5z"/></svg>';
  /* The open book (2026-10-17), the same shape as the tiles' badge (manual_booklet.js CW_OPEN_BOOK_SVG). */
  const BOOK_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4.5h6a4 4 0 0 1 4 4V21a3 3 0 0 0-3-3H2z"/><path d="M22 4.5h-6a4 4 0 0 0-4 4V21a3 3 0 0 1 3-3h7z"/></svg>';

  /* ------------------------------------------------------------ the data: one row per system */
  /* kind     'cart' a cartridge (or disk) the visitor supplies or the catalogue holds;
              'unit' a Game & Watch family unit (G&W, the colour twins, Tetris Jr.)
     fit      hero sizing: portrait cut-outs by height, landscape photographs contained
     emu      the Emulation tab's builder, or none
     machine  the machine's own Facts rows, after the game's */
  const PROFILES = {
    gb: {
      kind: 'cart', fit: 'auto 88%', system: d => d.sgb ? 'SUPER GAME BOY' : d.system === 'gbc' ? 'GAME BOY COLOR' : 'GAME BOY',
      playable: d => !!call('gbPlayable', d), play: 'openGbPlay', playTitle: 'Play on the Game Boy emulator',
      emu: d => d.system === 'gbc' ? call('gbcEmulationTabHTML', d) : call('gbEmulationTabHTML', d),
      machine: d => ({ Cartridge: d.cartridge, Features: (d.features && d.features.length) ? d.features.join(', ') : null }),
      regions: 'gbRegionsHTML', shell: 'gb',
    },
    nes: {
      kind: 'cart', fit: 'contain', system: d => ({ nes: 'NES', famicom: 'FAMICOM', fds: 'FAMICOM DISK SYSTEM' })[d.nesConsole || 'nes'] || 'NES',
      playable: d => !!call('nesPlayable', d), play: 'openNesPlay', playTitle: 'Play on the NES emulator',
      emu: d => (call('nesEmulationTabHTML', d) || '') + (call('nesBuildSpecEmulationTabHTML', d) || ''),
      machine: d => {
        const L = g('NES_CONSOLE_LABEL') || {};
        const disk = d.nesConsole === 'fds';
        const mapper = (d.mapper !== null && d.mapper !== undefined) ? (d.mapperName ? d.mapper + ' (' + d.mapperName + ')' : String(d.mapper)) : null;
        const o = { Console: L[d.nesConsole || 'nes'] };
        if (disk) o.Disk = d.cartridge; else { o.Cartridge = d.cartridge; o.Mapper = mapper; }
        o['Controller ports'] = 'Up to 2: both controller ports are wired';
        o.File = d.fullName;
        return o;
      },
      present: d => d.nesConsole === 'fds' ? 'DISK PRESENT' : 'CARTRIDGE PRESENT',
    },
    atari: {
      kind: 'cart', fit: 'contain', system: d => (atariOf(d).label || 'ATARI').toUpperCase(),
      playable: d => !!call('atariPlayable', d), play: 'openAtariPlay', playTitle: d => 'Play on the ' + (atariOf(d).label || 'Atari') + ' emulator',
      /* The Atari build guides (2026-10-18: "put the Atari emulation pages on the site"):
         atari*-emulation-tab.js, generated from the Atari emulation documents. */
      emu: d => call('atariEmulationTabHTML', d),
      machine: d => ({ Machine: atariOf(d).label, Cartridge: d.bytes ? d.bytes.toLocaleString('en-AU') + ' bytes, ' + d.cartridge : d.cartridge,
        'Controller ports': atariOf(d).players, File: d.fullName }),
      notYet: d => !!call('atariCartAvailable', d),
    },
    pm: {
      kind: 'cart', fit: 'auto 82%', system: () => 'POK\u00c9MON MINI',
      playable: d => !!call('pmPlayable', d), play: 'openPmPlay', playTitle: 'Play the Pok\u00e9mon mini emulator',
      emu: d => call('pmEmulationTabHTML', d),
      machine: d => ({ Cartridge: d.cartridge, Features: (d.features && d.features.length) ? d.features.join(', ') : null }),
      regions: 'pmRegionsHTML', shell: 'pm', stageNote: true,
    },
    unit: {
      kind: 'unit', fit: null, system: () => 'GAME & WATCH',
      playable: d => unitBuiltIn(d), play: 'openPlay',
      playable2: d => !!((g('GAME_SLUGS') || {})[d.id]),
      playTitle: d => unitBuiltIn(d) ? 'Play the built-in emulator' : 'Play on RetroFab (opens in new tab)',
      emu: d => (fn('gnwChipEmulationTabHTML') && call('gnwChipEmulationTabHTML', d)) || call('emulationTabHTML', d),
      machine: null,
    },
  };
  function atariOf(d) { const A = g('ATARI_SYSTEMS') || {}; return A[d.catalogue] || {}; }
  function unitBuiltIn(d) {
    const E = g('GNW_EMULATED_GAMES') || {}, T = g('TFT_TWIN_UNITS') || {};
    return !!(E[d.id] || T[d.id] || d.id === g('TJ_ID'));
  }
  function profileOf(d) {
    const c = d && d.catalogue;
    if (c === 'game-boy') return PROFILES.gb;
    if (c === 'nes') return PROFILES.nes;
    if (c === 'pokemon-mini') return PROFILES.pm;
    if (c && (g('ATARI_SYSTEMS') || {})[c]) return PROFILES.atari;
    if (!c) return PROFILES.unit;
    return null;   // a catalogue this drawer does not know: the old builder keeps it
  }
  const val = (p, k, d) => typeof p[k] === 'function' ? p[k](d) : p[k];

  /* ------------------------------------------------------------ parts */
  function heroKeyOf(d, p) {
    let k = call('heroImgKey', d) || null;
    // The home consoles' drawer shows the full photograph, the tile the TV with its controller (22 Oct; index.html STAGE_FULL_ART).
    if (k) k = call('stageArtKey', k) || k;
    // One shell colour per game per load: the colour its tile wears (its group's first member).
    try {
      const H = window.CwUnifiedHost;
      if (k && p.shell && H && typeof H.shellFor === 'function') {
        const isShell = p.shell === 'gb' ? (g('GBC_SHELLS') || []).indexOf(k) >= 0 : (k === call('pmConsoleKey', d));
        if (isShell) k = H.shellFor(p.shell, d) || k;
      }
    } catch (_) {}
    return k;
  }
  function heroHTML(d, p, k) {
    const missingBox = msg => `<div class="device-modal-img missing"><div style="height:100%;display:flex;align-items:center;justify-content:center;color:#2a3242;letter-spacing:.2em;text-transform:uppercase;font-size:13px;text-align:center;padding:0 24px;">${esc(msg)}</div></div>`;
    if (p.kind === 'unit') {
      const broken = k && g('BROKEN_IMG_KEYS') && g('BROKEN_IMG_KEYS').has(k);
      const src = (k && !broken) ? call('imgSrc', k) : '';
      const missing = !k || broken || (!src && !g('_imgArchivePending'));
      const BA = g('BOX_ART_IMAGES') || {};
      const noBox = call('effectiveViewMode', d) === 'boxart' && !BA[call('_artId', d)];
      if (missing) return missingBox(noBox ? 'Box art not yet added for this device' : 'No image available');
      const keys = call('lightboxKeys', d) || [];
      const idx = Math.max(0, keys.indexOf(k));
      const data = src ? ` data-hero-src="${esc(src)}" data-hero-key="${esc(k)}"` : '';
      return `<div class="device-modal-img"${data} style="${src ? `background-image:url('${attr(src)}')` : ''}" onclick="openLightbox('${attr(d.id)}', ${idx})"></div>`;
    }
    /* The Super Game Boy shelf (25 Oct): the drawer shows the television photograph
       switched off (screen black, no clip, as every system's drawer picture; 26 Oct: the clip plays only on the
       device that slides in from the left, sgb-shelf.js showStage), not the Game Boy console its tile wears. */
    if (d.sgb && window.SGB && typeof SGB.frameHTML === 'function') return `<div class="device-modal-img sgb-hero" onclick="openLightbox('${attr(d.id)}', 0)">${SGB.frameHTML(d, 'sgb-drawer')}</div>`;
    const src = k ? call('imgSrc', k) : '';
    if (!src) return missingBox(d.name);
    return `<div class="device-modal-img" onclick="openLightbox('${attr(d.id)}', 0)" data-hero-key="${esc(k)}" style="background-image:url('${attr(src)}');background-color:transparent;background-size:${p.fit};background-position:center;background-repeat:no-repeat;"></div>`;
  }
  /* ------------------------------------------------------------ the picture strip (2026-10-14)
     "the design of the old image viewer and how the thumbnails show on the drawer": the old
     .gallery-strip / .gallery-thumb and the old lightbox (showLightbox), reused, not redesigned.
     Every drawer, every screen size: the game's 2D box art, its 3D box art, then the photos and
     stills the system has (Game & Watch artwork stills, the colour units' photographs), then the
     manual where there is one. On narrow screens only the big console picture stays hidden.
     COVERS: the same R2 buckets and the same order the Media tiles use (emby.js GB_ART_BASE,
     GBC_ART_BASE, NES_ART_SHELVES, PM_ART_BASE; mirrored here because they are private there),
     then the second source the tiles fall back to (gamemeta.js: libretro's thumbnail server, by
     the No-Intro name). A picture that does not load is simply not in the strip. */
  const COVERS = {
    gb:  { '2d': 'https://pub-7bac68f21888416fb5ee42bfaf371e77.r2.dev', '3d': 'https://pub-ddda4c6d7b424e05992d8ebc8154278a.r2.dev' },
    gbc: { '2d': 'https://pub-ab3708bbc6714c41a7e8d73418133064.r2.dev', '3d': 'https://pub-eedf2c3c07734780add44aa475a609de.r2.dev' },
    /* The Super Game Boy shelf: no buckets of its own (28 Oct); its covers are the Game Boy / Color ones. */
    nes:     { '2d': 'https://pub-fa0fac80b3c14d358007e922389cdcd0.r2.dev', '3d': '' },
    famicom: { '2d': 'https://pub-ddbcec209bb34b41807958a690510c73.r2.dev', '3d': 'https://pub-ce9818fd0ef2497bae61cbfd113a9c43.r2.dev' },
    fds:     { '2d': 'https://pub-e2f49984356242a2a8d1093ec71767ce.r2.dev', '3d': '' },
    pm:  { '2d': 'https://pub-eee982432b794252aea6267b28610d68.r2.dev', '3d': 'https://pub-b7ce84cc08af4c94a360b8f95ea6c99e.r2.dev' },
    a2600: { '2d': 'https://pub-5a6bb80d82784ad39e3c174bef3c277f.r2.dev' /* atari2600-covers-2d (2026-10-17) */,
             '3d': 'https://pub-667eebbf0bf94d14b005d8f4245ae206.r2.dev' /* atari2600-covers-3d (2026-10-18) */ },
    a5200: { '2d': 'https://pub-c75c6bbea160407d91b051774522eb4c.r2.dev' /* atari5200-covers-2d (2026-10-18) */,
             '3d': 'https://pub-af3e3e656d58465892e228468ebea0ac.r2.dev' /* atari5200-covers-3d */ },
    a7800: { '2d': 'https://pub-0e40e9ded6d040ffb50e8e6c90a7c6f4.r2.dev' /* atari7800-covers-2d (2026-10-18) */,
             '3d': 'https://pub-1879504402bc44fe84720eeb9497317d.r2.dev' /* atari7800-covers-3d */ },
    alynx: { '2d': 'https://pub-6a52666460d64b4a8b732cfc2d1ca0ee.r2.dev' /* atarilynx-covers-2d (2026-10-18) */,
             '3d': 'https://pub-bd2be751db6e4b27a33dfd21fccff2ab.r2.dev' /* atarilynx-covers-3d */ },
  };
  /* GAME MAPS (2026-10-23): bucket site-images, maps/<shelf>/<cover key>-map.jpg (Game Boy:
     the cartridge's SHA-1, as its covers). NO LIST: the drawer asks directly; a 404 means no map. */
  const MAPS = 'https://pub-cdfcabf7a7fd40d5a0e9cb551d68599e.r2.dev';
  const GB_SHA1_KEY = 'gnw.gb.cartSha1.v1', GB_MISS_KEY = 'gnw.gb.artMiss.v4';   /* v4 28 Oct: SGB pictures copied into gb/gbc */   // shared with emby.js's tiles (v2/v3 2026-10-21: new covers uploaded)
  const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (_) { return {}; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const missed = new Set();   // url -> failed this page load
  function probe(url) {
    if (!url) return Promise.resolve(null);
    if (/^data:/.test(url)) return Promise.resolve(url);
    if (missed.has(url)) return Promise.resolve(null);
    return new Promise(res => {
      const im = new Image(); let done = false;
      const end = ok => { if (done) return; done = true; if (!ok) missed.add(url); res(ok ? url : null); };
      im.referrerPolicy = 'no-referrer';
      im.onload = () => end(im.naturalWidth > 0); im.onerror = () => end(false);
      setTimeout(() => end(false), 8000);
      im.src = url;
    });
  }
  async function firstOf(urls) { for (const u of urls) { const ok = await probe(u); if (ok) return ok; } return null; }
  async function gbSha1(d) {
    const map = lsGet(GB_SHA1_KEY);
    const id = d.sgbOf || d.id;   // the Super Game Boy shelf: its Game Boy copy's hash
    if (map[id]) return map[id];
    try {
      const f = fn('_gbFetchCart'); if (!f || !(window.crypto && crypto.subtle)) return null;
      const bytes = await f(String(id).slice(3)); if (!bytes || !bytes.length) return null;
      const hex = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', bytes)), b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      map[id] = hex; lsSet(GB_SHA1_KEY, map); return hex;
    } catch (_) { return null; }
  }
  /* CHEATS IN THE DRAWER (2026-10-26: shown like the variants list, COLLAPSED by
     default). The tile's own cheats file (the same key as its clip and covers, so the tile's
     representative version), read through play/host/cheats.mjs. A closed "Cheats (N)" section in the
     sidebar; inside, one closed group per provider, each cheat's name and code. Cheats are switched on
     from the Cheats button while the game plays. CHEAT_SYSTEMS: the consoles whose installed player
     runs cheats (the others join when their cheat build is installed), so the drawer never offers
     what the player cannot run. A 404 shows nothing. */
  const CHEAT_SYSTEMS = new Set(['gnw', 'nes', 'gb', 'atari', 'pm']);   // NES, Game Boy and Atari cheat builds installed 28 Oct 2026; Pokemon mini (our own cheats, served core unchanged) 28 Oct
  const CHEATS_MJS = './play/host/cheats.mjs?v=2.0.0';
  async function cheatPlaces(d, p) {
    if (p === PROFILES.gb) {
      const sha = await gbSha1(d); if (!sha) return [];
      const order = (d.series === 'game-boy-color' || d.system === 'gbc') ? ['gbc', 'gb'] : ['gb', 'gbc'];   // sgb-cheats: every file is also in gb/gbc (28 Oct)
      return order.map(bucket => ({ bucket, key: sha }));
    }
    if (p === PROFILES.nes) {
      const key = nesCoverId(d); if (!/^nes-x[0-9a-f]{12}$/.test(key)) return [];
      return (d.system === 'fds' ? ['fds', 'nes', 'famicom'] : ['nes', 'famicom', 'fds']).map(bucket => ({ bucket, key }));
    }
    if (p === PROFILES.atari) {
      const id = atariArtId(d); if (!id) return [];
      const bucket = { a2600: 'atari2600', a5200: 'atari5200', a7800: 'atari7800', alynx: 'atarilynx' }[id.slice(0, 5)];
      return bucket ? [{ bucket, key: id }] : [];
    }
    if (p.kind === 'unit' && (g('GNW_EMULATED_GAMES') || {})[d.id]) return [{ bucket: 'gnw', key: d.id }];
    if (p === PROFILES.pm) {                       // 28 Oct 2026: the tile's own file, 'pm-x' + 12 hex of its SHA-256
      const files = await call('ensurePmFiles'), b64 = files && files[d.id];
      if (!b64 || !(window.crypto && crypto.subtle)) return [];
      const u8 = call('_pmB64ToU8', b64); if (!u8) return [];
      const hex = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', u8)).subarray(0, 6), b => b.toString(16).padStart(2, '0')).join('');
      return [{ bucket: 'pm', key: 'pm-x' + hex }];
    }
    return [];
  }
  function fillCheats(modal, d, p) {
    const sys = p === PROFILES.gb ? 'gb' : p === PROFILES.nes ? 'nes' : p === PROFILES.atari ? 'atari' : p === PROFILES.pm ? 'pm' : p.kind === 'unit' ? 'gnw' : null;
    if (!sys || !CHEAT_SYSTEMS.has(sys)) return;
    import(CHEATS_MJS).then(M => cheatPlaces(d, p).then(M.findCheats)).then(doc => {
      if (!doc || !Array.isArray(doc.providers) || !modal.isConnected || modal.dataset.udId !== d.id) return;
      const inner = modal.querySelector('.sidebar-inner'); if (!inner || inner.querySelector('.ud-cheats')) return;
      const n = doc.providers.reduce((k, x) => k + (x.cheats || []).length, 0); if (!n) return;
      const code = c => (c.codes || []).map(k => k.s).filter(Boolean).join(' + ');
      const groups = doc.providers.filter(x => (x.cheats || []).length).map(x => `<details class="ud-ch-p"><summary>${esc(x.name)} (${x.cheats.length})</summary><ul>` +
        x.cheats.map(c => `<li><span>${esc(c.name)}</span>${code(c) ? `<small>${esc(code(c))}</small>` : ''}${c.note ? `<small>${esc(c.note)}</small>` : ''}</li>`).join('') + '</ul></details>').join('');
      const credit = (doc.credit || []).map(c => c.text).filter(Boolean).join(' ');
      const s = document.createElement('section');
      s.className = 'sect ud-cheats';
      s.innerHTML = `<details><summary class="sect-h">Cheats (${n})</summary><p class="ud-ch-how">Switch them on from the Cheats button while the game plays. Cheats never count towards play time.</p>${groups}${credit ? `<p class="ud-ch-credit">${esc(credit)}</p>` : ''}</details>`;
      const facts = inner.querySelector('.sect');
      if (facts && facts.nextSibling) inner.insertBefore(s, facts.nextSibling); else inner.appendChild(s);
      if (!document.getElementById('ud-cheats-css')) {
        const st = document.createElement('style'); st.id = 'ud-cheats-css';
        st.textContent = '.ud-cheats summary{cursor:pointer}.ud-cheats>details>summary.sect-h{display:list-item}.ud-ch-p{margin:6px 0 0 4px}.ud-ch-p ul{list-style:none;margin:4px 0 0;padding:0}' +
          '.ud-ch-p li{padding:3px 0;border-bottom:1px solid rgba(255,255,255,.06)}.ud-ch-p li small,.ud-cheats small{display:block;font-size:11px;opacity:.7;overflow-wrap:anywhere}' +
          '.ud-ch-how,.ud-ch-credit{font-size:12px;opacity:.8;margin:6px 0}';
        document.head.appendChild(st);
      }
    }).catch(() => {});
  }
  function nesCoverId(d) {
    try { const r = window.Variants && Variants.repOf('nes', d.id); if (r) return 'nes-x' + String(r).slice(0, 12); } catch (_) {}
    return d.id;
  }
  let _mdIndex = null;
  function secondSource(d) {
    const GM = window.GameMeta; if (!GM || !GM.lookup || !GM.thumbUrl) return Promise.resolve(null);
    if (!_mdIndex) _mdIndex = fetch('metadata/index.json').then(r => r.ok ? r.json() : null).catch(() => null);
    return Promise.all([GM.lookup(d), _mdIndex]).then(([hit, ix]) => {
      const lr = hit && ix && ix.shelves && ix.shelves[hit.shelf] && ix.shelves[hit.shelf].lr;
      if (lr && hit.rec && hit.rec.n && GM.refusedArt && GM.refusedArt(lr, hit.rec.n)) return null;
      return lr && hit.rec && hit.rec.n ? GM.thumbUrl(lr, hit.rec.n) : null;
    }).catch(() => null);
  }
  /* The URLs to try for one cover, in the tiles' order. mode '2d' | '3d'. */
  async function coverUrls(d, p, mode) {
    const src = k => k ? call('imgSrc', k) : '';
    const ba = mode === '2d' ? (g('BOX_ART_IMAGES') || {}) : (LEX_BA3D() || {});
    const own = src(ba[call('_artId', d)]);
    if (p.kind === 'unit') return [own];
    const out = [];
    if (p === PROFILES.pm) {
      const id = d.pmVariantOf || d.id, b = COVERS.pm[mode] + '/' + id + '.png';
      if (mode === '2d') out.push(b, own); else out.push(own, b);
    } else if (p === PROFILES.gb) {
      const sha = await gbSha1(d);
      const shelf = (d.series === 'game-boy-color' || d.system === 'gbc') ? 'gbc' : 'gb';
      /* The Super Game Boy shelf (28 Oct): the cartridge's own Game Boy bucket, then the other one
         (miss key 'alt:<mode>:<SHA1>', as the tiles); the sgb-covers buckets are no longer read. */
      const tries = d.sgb ? [['', COVERS[shelf][mode]], ['alt:', COVERS[shelf === 'gb' ? 'gbc' : 'gb'][mode]]] : [['', COVERS[shelf][mode]]];
      for (const [pre, base] of tries) {
        if (!sha || !base) continue;
        const key = pre + (mode === '2d' ? 'boxart' : 'boxart3d') + ':' + sha;
        if (!lsGet(GB_MISS_KEY)[key]) {
          const u = base + '/' + sha + '.png';
          const ok = await probe(u);
          if (ok) return [ok];
          const m = lsGet(GB_MISS_KEY); m[key] = 1; lsSet(GB_MISS_KEY, m);
        }
      }
    } else if (p === PROFILES.nes) {
      const id = nesCoverId(d), ownShelf = d.nesConsole || 'nes';
      for (const s of [ownShelf, 'nes', 'famicom', 'fds']) { const b = COVERS[s] && COVERS[s][mode]; if (b && !out.includes(b + '/' + id + '.png')) out.push(b + '/' + id + '.png'); }
    } else if (p === PROFILES.atari) {
      const id = atariArtId(d), b = id && COVERS[id.slice(0, 5)] && COVERS[id.slice(0, 5)][mode];
      if (b) out.push(b + '/' + id + '.png');
    }
    if (mode === '2d') out.push(await secondSource(d));   // the tiles' fallback (there is none for 3D)
    /* THE LAST SOURCE (21 Oct): the system's generic box, generic.png in its 2D bucket, as
       the tiles show it (emby.js paintGenericArt); the strip then always shows what the tile shows.
       No generic 3D box. */
    if (mode === '2d') { const gs = genericShelf(d, p), gb = gs && COVERS[gs] && COVERS[gs]['2d']; if (gb) out.push(gb + '/generic.png'); }
    return out.filter(Boolean);
  }
  function genericShelf(d, p) {
    if (p === PROFILES.pm) return 'pm';
    if (p === PROFILES.gb) return (d.series === 'game-boy-color' || d.system === 'gbc') ? 'gbc' : 'gb';
    if (p === PROFILES.nes) return d.nesConsole || 'nes';
    if (p === PROFILES.atari) { const id = atariArtId(d); return id ? id.slice(0, 5) : null; }
    return null;
  }
  function LEX_BA3D() { return typeof BOX_ART_3D_IMAGES !== 'undefined' ? BOX_ART_3D_IMAGES : undefined; }   // eslint-disable-line no-undef

  /* ------------------------------------------------------------ the marquee (2026-10-17)
     "Marquees for games, like the TV shows and movies have." The film's clear logo shows in the
     media player's title overlay (embytitle.js: text first, the logo replaces it once it loads, a
     failure keeps the text); a game's marquee does the same in the drawer's title row. Named by
     the key its 2D cover uses (WASM_Source/cover-art/marquees.py): Game Boy and Color by the
     cartridge's SHA-1, the NES family (NES, Famicom, Disk System, one bucket) by the tile's id.
     NO LIST: the drawer asks <bucket>/<key>.png directly, a 404 leaves the text title and is
     remembered for this page load only (probe's `missed`), so an upload shows on the next load.
     Systems without a bucket yet (Atari, Pokemon mini) ask nothing. */
  const MARQUEE = {
    gb:  'https://pub-0130de099e404a4aacf7fe94c05427a8.r2.dev',   // gb-marquee
    gbc: 'https://pub-d5ebd69e5bd24ee1abcb8a0b13b0b6d1.r2.dev',   // gbc-marquee
    nes: 'https://pub-b5733387d05e4e68851635d3f17925e4.r2.dev',   // nes-marquee (NES, Famicom, Disk System)
    a2600: 'https://pub-55f90e282c424635b6bc5e513ba92b25.r2.dev', // atari2600-marquee (2026-10-17)
    a5200: 'https://pub-45aeb460c42f4714909c889f7d4ac278.r2.dev', // atari5200-marquee (2026-10-18)
    a7800: 'https://pub-fa8459afca964d62bb1a27fdd4c6b864.r2.dev', // atari7800-marquee (2026-10-18)
    alynx: 'https://pub-439768261e8b43949da7b5625ac85a6c.r2.dev', // atarilynx-marquee (2026-10-18)
  };
  /* Atari art (atari-art.py) is named by the tile's clip id: the variant group's
     representative (atarivideo.js clipId). The id's prefix (a2600, a5200, a7800, alynx) picks
     the machine's buckets (all four have covers and a marquee since 2026-10-18). */
  function atariArtId(d) {
    const own = String(d && d.id || '');
    if (!/^(a2600|a5200|a7800|alynx)-x[0-9a-f]{12}$/.test(own)) return null;
    try { const c = window.ATARIVIDEO && ATARIVIDEO.clipId ? ATARIVIDEO.clipId(own) : own; return c || own; } catch (_) { return own; }
  }
  async function marqueeUrls(d, p) {
    if (p === PROFILES.gb) {
      const sha = await gbSha1(d); if (!sha) return [];
      const own = (d.series === 'game-boy-color' || d.system === 'gbc') ? 'gbc' : 'gb';
      return [MARQUEE[own], MARQUEE[own === 'gb' ? 'gbc' : 'gb']].map(b => b + '/' + sha + '.png');   // Super Game Boy too (sgb-marquee no longer read, 28 Oct)
    }
    if (p === PROFILES.nes) return [MARQUEE.nes + '/' + nesCoverId(d) + '.png'];
    /* ?v= (28 Oct): the 2600, 5200, 7800 and Lynx marquees were replaced under the same names; the tag keeps a browser from showing a cached old logo. */
    if (p === PROFILES.atari) { const id = atariArtId(d), b = id && MARQUEE[id.slice(0, 5)]; return b ? [b + '/' + id + '.png' + (/^a(2600|5200|7800|lynx)-/.test(id) ? '?v=20261028' : '')] : []; }
    return [];
  }
  function fillMarquee(modal, d, p) {
    marqueeUrls(d, p).then(firstOf).then(url => {
      if (!url || !modal.isConnected || modal.dataset.udId !== d.id) return;
      const h = modal.querySelector('.drawer-title-row h2');
      if (!h) return;
      const img = new Image();
      img.className = 'ud-marquee'; img.alt = d.name || ''; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
      img.onload = () => { if (!h.isConnected || modal.dataset.udId !== d.id) return; h.textContent = ''; h.appendChild(img); h.classList.add('ud-has-marquee'); };
      img.onerror = () => {};   // keep the text title
      img.src = url;
    }).catch(() => {});
  }

  function stripShell(color) { return `<div class="gallery-strip ud-gallery" data-ud-strip style="--c:${color}" hidden></div>`; }
  function fillStrip(modal, d, p) {
    const strip = modal.querySelector('[data-ud-strip]');
    if (!strip) return;
    const items = [];   // { slot, url, label, manual }
    const paint = () => {
      if (!strip.isConnected || modal.dataset.udId !== d.id) return;
      items.sort((a, b) => a.slot - b.slot);
      const seen = new Set(), list = items.filter(it => !seen.has(it.url) && seen.add(it.url));
      const had = strip.contains(document.activeElement) ? +document.activeElement.dataset.udI : -1;
      strip.innerHTML = list.map((it, i) =>
        `<button type="button" class="gallery-thumb ud-thumb${it.contain ? ' ud-contain' : ''}" data-ud-i="${i}" style="background-image:url('${attr(it.url)}')" aria-label="${esc(it.label)}, ${i + 1} of ${list.length}" title="${esc(it.label)}"><span class="thumb-idx">${i + 1}</span></button>`).join('');
      strip.hidden = !list.length;
      strip.__ud = list;
      if (had >= 0) { const b = strip.querySelector('[data-ud-i="' + Math.min(had, list.length - 1) + '"]'); if (b) b.focus({ preventScroll: true }); }
      // the type word on a generic box (21 Oct), as the tile draws it
      list.forEach((it, i) => {
        if (!it.generic || typeof window.cwGenericLabel !== 'function') return;
        const b = strip.querySelector('[data-ud-i="' + i + '"]');
        if (b) requestAnimationFrame(() => { try { window.cwGenericLabel(b, genericShelf(d, p), d.id, 0); } catch (_) {} });
      });
    };
    // Photos and stills the system holds (the units), then the manual: known now.
    if (p.kind === 'unit') {
      (call('getDeviceImages', d) || []).forEach((k, i) => {
        const u = call('imgSrc', k);
        if (u) items.push({ slot: 10 + i, url: u, label: /^gnwart-/.test(k) ? 'Artwork' : 'Photo', contain: /^gnwart-/.test(k) });
      });
      const MB = g('MANUAL_BOOKLETS') || {}, M = g('MANUALS') || {};
      const mk = (MB[d.id] && MB[d.id][0] && MB[d.id][0].key) || (M[d.id] || [])[0];
      // The booklet's front cover from the gnw-manual bucket (2026-10-17), else the old archive key.
      const mu = (fn('cwManualThumb') && call('cwManualThumb', d.id)) || (mk ? call('imgSrc', mk) : '');
      if (mu) items.push({ slot: 99, url: mu, label: 'Manual', manual: true, contain: true });
    }
    paint();
    // The two covers, as they resolve.
    [['2d', 0, 'Box art'], ['3d', 1, '3D box art']].forEach(([mode, slot, label]) => {
      coverUrls(d, p, mode).then(firstOf).then(url => { if (url) { const gen = /\/generic\.png$/.test(url); items.push({ slot, url, label, contain: true, generic: gen, gshelf: gen ? genericShelf(d, p) : null, gid: d.id }); paint(); } }).catch(() => {});
    });
    // The game's map (23 Oct): a picture in the strip, opened larger like the covers.
    if (p === PROFILES.gb) {
      gbSha1(d).then(sha => sha ? probe(MAPS + '/maps/gb/' + sha + '-map.jpg') : null)
        .then(url => { if (url) { items.push({ slot: 2, url, label: 'Map', contain: true }); paint(); } }).catch(() => {});
    }
  }
  function stripClick(e) {
    const b = e.target.closest && e.target.closest('.ud-thumb');
    if (!b) return;
    const strip = b.closest('[data-ud-strip]'), list = (strip && strip.__ud) || [];
    const it = list[+b.dataset.udI]; if (!it) return;
    e.preventDefault(); e.stopPropagation();
    const id = document.getElementById('device-modal').dataset.udId;
    if (it.manual) { call('openManual', id, e); return; }
    const pics = list.filter(x => !x.manual);
    /* A generic box carries its type word into the viewer too (25 Oct: the large picture
       showed the box without it); index.html draws it with window.cwGenericLabel, as the tile does. */
    call('showLightbox', pics.map(x => x.url), pics.indexOf(it), pics.map(x => x.generic ? { shelf: x.gshelf, id: x.gid } : null));
  }
  function seriesPill(d, s, p) {
    // Every series pill is a link to its shelf on Media (the per-system pages are gone,
    // so the NES and Atari "nowhere to route to" reason no longer holds).
    const go = p.kind === 'unit' && fn('routeToMediaSeries')
      ? `routeToMediaSeries('${attr(s.id)}')`
      : `routeToMediaSystems(mediaSystemsForSeries('${attr(s.id)}'))`;
    return `<span class="pill series-pill" role="link" tabindex="0" onclick="closeOverlay('device-overlay');${go}" onkeydown="if(event.key==='Enter'){event.preventDefault();this.click()}" style="cursor:pointer">${esc(s.name)}</span>`;
  }
  function playButton(d, p) {
    const can = val(p, 'playable', d) || (p.playable2 && p.playable2(d));
    if (!can) return '';
    const t = val(p, 'playTitle', d);
    return `<button class="play-now" data-ud-play="${esc(d.id)}" onclick="${p.play}('${attr(d.id)}', event)" title="${esc(t)}" aria-label="Play">${PLAY_SVG}<span>Play Now!</span></button>`;
  }
  function manualButton(d) {
    const MB = g('MANUAL_BOOKLETS') || {}, M = g('MANUALS') || {};
    // Every system (2026-10-17): manual_booklet.js knows which games have a manual.
    if (!(MB[d.id] || M[d.id]) && !(fn('cwHasManual') && call('cwHasManual', d))) return '';
    return `<button class="manual-btn" onclick="openManual('${attr(d.id)}', event)" title="View the instruction manual" aria-label="View manual">${BOOK_SVG}<span>Manual</span></button>`;
  }
  /* Releases: region, then month and year, then the serial when there is one (gbRegionsHTML and
     pmRegionsHTML's rows), but an unknown date or serial is said in words or left out, never dashed. */
  function regionsHTML(d) {
    const rows = (d.regions || []).map(r => {
      const when = monthYear(r.date) || 'Date not known';
      const ser = unknown(r.serial) ? '' : ` · <span style="font-variant-numeric:tabular-nums">${esc(r.serial)}</span>`;
      return `<div class="row"><span class="k">${esc(r.region)}</span><span class="v">${esc(when)}${ser}</span></div>`;
    }).join('');
    return `<div class="factbox">${rows}</div>`;
  }
  function sect(title, html) { return `<section class="sect"><h3 class="sect-h">${title}</h3>${html}</section>`; }
  function para(title, text) { return unknown(text) ? '' : sect(title, `<p>${text}</p>`); }   // curated HTML, as the old drawers print it
  function row(k, v, ph) {
    if (unknown(v) && !ph) return '';
    return `<div class="row"${unknown(v) ? ' data-ud-ph="1"' : ''}><span class="k">${esc(k)}</span><span class="v">${unknown(v) ? PH : esc(v)}</span></div>`;
  }
  function factsHTML(d, p) {
    if (p.kind === 'unit') {
      // The unit's curated rows, as its old drawer merged them (genre, its facts, the full release date).
      const G = g('GENRES') || {}, CR = g('CUSTOM_RELEASED');
      const rel = (CR && CR.has(d.id) && d.facts && d.facts.Released) ? d.facts.Released : (call('formatDateFull', d.released) || '');
      const merged = Object.assign({}, G[d.id] ? { Genre: G[d.id] } : {}, d.facts || {}, unknown(rel) ? {} : { Released: rel });
      // Curated values are site HTML already (the old drawer printed them raw).
      return Object.entries(merged).filter(([, v]) => !unknown(v)).map(([k, v]) => `<div class="row"><span class="k">${esc(k)}</span><span class="v">${v}</span></div>`).join('');
    }
    // The game's rows first (placeholders gamemeta.js fills), then the machine's.
    const gamePlayers = (p === PROFILES.nes || p === PROFILES.atari) ? null : d.players;
    let html = row('Developer', d.developer, true) + row('Genre', d.genre, true) + row('Players', gamePlayers, true);
    const m = p.machine ? p.machine(d) : {};
    for (const k of Object.keys(m)) html += row(k, m[k], false);
    return html;
  }
  function statusHTML(d, p, s) {
    const G = g('GENRES') || {};
    const genre = p.kind === 'unit' ? G[d.id] : d.genre;
    const rel = p.kind === 'unit'
      ? ((g('CUSTOM_RELEASED') && g('CUSTOM_RELEASED').has(d.id) && d.facts && d.facts.Released) ? d.facts.Released : call('formatDateFull', d.released))
      : monthYear(d.released);
    const playable = val(p, 'playable', d);
    let status = 'ARCHIVED';
    if (playable) status = p.kind === 'unit' ? 'READY TO PLAY' : (p.present ? p.present(d) : 'CARTRIDGE PRESENT');
    else if (p.notYet && p.notYet(d)) status = 'NO EMULATOR YET';
    const line = (k, v, opt) => (opt && unknown(v)) ? '' : `<div class="status-row"${opt ? ' data-ud-opt="1"' : ''}><span class="status-k">&gt; ${k}:</span><span class="status-v">${unknown(v) ? '' : esc(String(v).toUpperCase())}</span></div>`;
    return `<div class="status-panel">` +
      line('GAME', d.name) +
      line('SYSTEM', val(p, 'system', d)) +
      (d.model ? line('MODEL', d.model) : '') +
      `<div class="status-row" data-ud-st="GENRE"><span class="status-k">&gt; GENRE:</span><span class="status-v">${unknown(genre) ? '' : esc(String(genre).toUpperCase())}</span></div>` +
      `<div class="status-row" data-ud-st="RELEASE"><span class="status-k">&gt; RELEASE:</span><span class="status-v">${unknown(rel) ? '' : esc(String(rel).toUpperCase())}</span></div>` +
      `<div class="status-row"><span class="status-k">&gt; STATUS:</span><span class="status-v">${status}<span class="status-cursor">_</span></span></div>` +
      `</div>`;
  }

  /* ------------------------------------------------------------ the builder */
  function build(d) {
    const p = profileOf(d);
    const s = (fn('seriesById') && call('seriesById', d.series)) || { id: d.series || '', name: d.series || '', color: 'var(--accent)' };
    const color = s.color || 'var(--accent)';
    const date = monthYear(d.released);
    let emu = p.emu ? p.emu(d) : '';
    /* The test cartridges that don't start a game, after the tab's opening panel
       (2026-10-22; emulation-test-carts.js). */
    if (emu && fn('testCartsSectionHTML')) {
      const tc = call('testCartsSectionHTML', d) || '', at = emu.indexOf('</section>');
      if (tc) emu = at >= 0 ? emu.slice(0, at + 10) + tc + emu.slice(at + 10) : tc + emu;
    }
    const heroKey = heroKeyOf(d, p);
    const isUnit = p.kind === 'unit';
    const games = (d.games || []).map(x => `<div class="game-item"><span class="badge-g">\u25b8</span><div><b>${x.name}</b>: <span style="color:var(--muted)">${x.desc}</span></div></div>`).join('');
    const regions = p.regions && d.regions && d.regions.length ? regionsHTML(d) : '';
    const extras = isUnit ? (call('variantDropdownHTML', d) || '') + (call('rarityDrawerBadgeHTML', d) || '') : '';

    /* NO TITLE BAR (2026-10-17): "the top of the slide out window (title bar) can
       basically be removed freeing up more room for content. If you move the close box to the same
       level as the tabs there is no point for the text as it's all in other places below it." The
       name is the first tab, the title row and the status panel; the series and date are the pills.
       The close box ends the tab row (focus order: tabs, then close); the row is the sticky top.
       The dialog keeps the game's name as its aria-label (open()). */
    return `
    <div class="drawer-tabs ud-tabs" style="--c:${color}">
      <button type="button" class="drawer-tab active" data-tab="device" onclick="switchDrawerTab(this,'device')">${esc(d.name)}</button>
      ${d.id === 'prototype-tetris-jr' ? '' : `<button type="button" class="drawer-tab" data-tab="hardware" onclick="switchDrawerTab(this,'hardware')">Hardware</button>`}
      ${emu ? `<button type="button" class="drawer-tab" data-tab="emulation" onclick="switchDrawerTab(this,'emulation')">Emulation</button>` : ''}
      <button type="button" class="modal-close ud-tabs-close" onclick="closeOverlay('device-overlay')" aria-label="Close" title="Close">\u00d7</button>
    </div>
    <div class="drawer-tab-content active" data-tab-content="device">
    <div class="device-modal-grid">
      <div class="drawer-left">
        ${heroHTML(d, p, heroKey)}
        ${stripShell(color)}
        <div class="device-modal-body" style="--c:${color}">
          <div class="pill-row">
            ${seriesPill(d, s, p)}
            ${isUnit && d.model ? `<span class="pill model">${esc(d.model)}</span>` : ''}
            ${!isUnit ? (unknown(d.genre) ? '<span class="pill" data-ud-fill="genre" style="display:none"></span>' : `<span class="pill">${esc(d.genre)}</span>`) : ''}
            ${date ? `<span class="pill">${esc(date)}</span>` : '<span class="pill" data-ud-fill="date" style="display:none"></span>'}
            ${playButton(d, p)}
            ${manualButton(d)}
          </div>
          <div class="drawer-title-row">
            <h2>${esc(d.name)}</h2>
            ${extras ? `<div class="drawer-title-extras">${extras}</div>` : ''}
          </div>
          ${para('About', d.description)}
          ${para('Overview', d.overview)}
          ${para('Gameplay', d.gameplay)}
          ${para('Legacy &amp; Significance', d.legacy)}
          ${para('Additional Info', d.additional)}
          ${para('From the Promo', d.promo)}
          ${regions ? sect('Releases', regions) : ''}
        </div>
      </div>
      <aside class="drawer-sidebar" style="--c:${color}">
        <div class="sidebar-inner">
          ${sect('Facts', `<div class="factbox">${factsHTML(d, p)}</div>`)}
          ${call('playTimeSectionHTML', d) || ''}
          ${games ? sect('Built-in Games', `<div class="games-list">${games}</div>`) : ''}
          ${statusHTML(d, p, s)}
        </div>
      </aside>
    </div>
    </div>
    <div class="drawer-tab-content" data-tab-content="hardware">${call('hardwareTabHTML', d) || ''}</div>
    ${emu ? `<div class="drawer-tab-content" data-tab-content="emulation">${emu}</div>` : ''}`;
  }

  /* After gamemeta.js has answered: fill the genre and date pills and the header
     date it has no slot for, then hide every placeholder still empty. */
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function settle(modal, d, rec) {
    if (!modal.isConnected || modal.dataset.udId !== d.id) return;
    const r = rec || {};
    const my = r.y ? (r.mo ? MONTHS[r.mo - 1] + ' ' + r.y : String(r.y)) : '';
    const gp = modal.querySelector('[data-ud-fill="genre"]');
    if (gp && r.g) { gp.textContent = r.g; gp.style.display = ''; }
    const dp = modal.querySelector('[data-ud-fill="date"]');
    if (dp && my) { dp.textContent = my; dp.style.display = ''; }
    const sub = modal.querySelector('.modal-sub[data-ud-sub]');
    if (sub && my && sub.textContent.indexOf('\u00b7') < 0) sub.textContent = sub.dataset.udSub + ' \u00b7 ' + my;
    modal.querySelectorAll('.factbox .row[data-ud-ph]').forEach(rw => {
      const v = rw.querySelector('.v');
      if (v && /^\s*[\u2014-]?\s*$/.test(v.textContent)) rw.style.display = 'none';
    });
    modal.querySelectorAll('.status-row[data-ud-st]').forEach(rw => {
      const v = rw.querySelector('.status-v');
      if (v && !v.textContent.trim()) {
        const k = rw.dataset.udSt;
        const fill = k === 'GENRE' ? r.g : my;
        if (fill) v.textContent = String(fill).toUpperCase(); else rw.style.display = 'none';
      }
    });
  }

  /* ------------------------------------------------------------ opening */
  function open(d, opts) {
    const p = profileOf(d);
    const modal = document.getElementById('device-modal');
    if (!p || !modal) return false;
    try { if (!(opts && opts.refresh)) call('pauseCollectionTiles'); } catch (_) {}
    try { _setOpenId(d.id); } catch (_) {}

    // Desktop: the left stage, as each old builder chose it. Narrow: details only (by design).
    const thin = narrow();
    let stage = false;
    if (!thin) {
      if (p.kind === 'unit') {
        const E = g('GNW_EMULATED_GAMES') || {}, SP = g('STATIC_PREVIEW_IDS'), T = g('TFT_TWIN_UNITS') || {};
        const live = (!!E[d.id] && !(SP && SP.has(d.id))) || !!T[d.id] || d.id === g('TJ_ID');
        stage = live || (!!(SP && SP.has(d.id)) && !!d.img);
      } else stage = !!d.img;
    }
    document.body.classList.toggle('no-demo-device', !stage);

    modal.innerHTML = build(d);
    modal.dataset.udId = d.id;
    modal.setAttribute('aria-label', d.name || 'Game');   // no title bar any more: the dialog still names its game
    modal.classList.add('ud-drawer');
    modal.classList.remove('leaving');
    void modal.offsetWidth;   // commit the closed transform so the slide-in plays (openDevice's note)
    call('openOverlay', 'device-overlay');
    if (stage) call('showDeviceStage', d.id);
    if (p.stageNote && stage && !val(p, 'playable', d)) {
      const known = g('_pmFileAvailable');
      call('_pmStageNote', known === null ? 'Looking for the Pok\u00e9mon mini game files\u2026' : 'Pok\u00e9mon mini game files not found on this server or in a content pack.');
    }
    fillStrip(modal, d, p);
    fillMarquee(modal, d, p);
    fillCheats(modal, d, p);
    call('probeModalImage');
    call('hwMountSegMaps', modal);

    // Built-in game details (gamemeta.js), then the placeholders it could not fill are hidden.
    const GM = window.GameMeta;
    if (GM && typeof GM.decorateDrawer === 'function') {
      try { GM.decorateDrawer(d); } catch (_) {}
      Promise.resolve(GM.lookup ? GM.lookup(d) : null).catch(() => null)
        .then(hit => setTimeout(() => settle(modal, d, hit && hit.shelf !== 'gnw' ? hit.rec : null), 0));
    } else settle(modal, d, null);

    toTop(modal);
    requestAnimationFrame(() => toTop(modal));
    if (window.cwRouteNow ? cwRouteNow() !== '/device/' + d.id : location.hash.replace(/^#/, '') !== '/device/' + d.id) history.pushState({ cwLayer: 1 }, '', window.cwRouteHref ? cwRouteHref('/device/' + d.id) : '#/device/' + d.id);   // real addresses (22 Oct); marked as the page's own entry
    return true;
  }
  function toTop(modal) {
    try { if (window.gnwDrawerToTop) window.gnwDrawerToTop(document.getElementById('device-overlay')); else modal.scrollTop = 0; } catch (_) {}
  }
  // _openDeviceId is a top-level `let` in index.html: reachable by name from this classic script.
  function _setOpenId(id) { _openDeviceId = id; }   // eslint-disable-line no-undef

  /* ------------------------------------------------------------ the wrap (switch on only) */
  const BUILDERS = ['openGBDevice', 'openNESDevice', 'openAtariDevice', 'openPMDevice'];
  function wrap() {
    if (!on()) return;
    const od = window.openDevice;
    if (typeof od === 'function' && !od.__ud) {
      const w = function (id) {
        let d = null;
        try { d = (g('ALL_DEVICES') || []).find(x => x.id === id) || null; } catch (_) {}
        if (d && profileOf(d) && open(d)) return;
        return od.apply(this, arguments);
      };
      w.__ud = true; w.__orig = od; window.openDevice = w;
    }
    // The content probes re-open an open drawer through these names to add its Play button.
    for (const name of BUILDERS) {
      const f = window[name];
      if (typeof f !== 'function' || f.__ud) continue;
      const w = function (d) { if (d && profileOf(d) && open(d, { refresh: true })) return; return f.apply(this, arguments); };
      w.__ud = true; w.__orig = f; window[name] = w;
    }
  }

  /* ------------------------------------------------------------ keys: B steps out of a version submenu */
  const BACKS = new Set(['Escape', 'Esc', 'Backspace', 'GoBack', 'BrowserBack', 'XF86Back']);
  window.addEventListener('keydown', e => {
    if (!on()) return;
    if (!(BACKS.has(e.key) || e.keyCode === 10009 || e.keyCode === 461)) return;
    const ov = document.getElementById('device-overlay');
    if (!ov || !ov.classList.contains('open')) return;
    const a = document.activeElement;
    if (!a || !ov.contains(a) || (e.key === 'Backspace' && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
    const list = a.closest('.vr-subl:not([hidden])');
    const disc = list ? ov.querySelector('[data-vr-disc="' + list.dataset.vrSubl + '"]') : (a.matches('.vr-disc[aria-expanded="true"]') ? a : null);
    if (!disc) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat) return;
    disc.click();          // variants.js closes the submenu
    disc.focus({ preventScroll: false });
  }, true);

  /* ------------------------------------------------------------ sound from the Play press */
  /* The host's audio engine (play/host/cw-audio.js) is on the page only while the play host
     is switched on; its own capture listener already wakes it on this press. Waking it here
     too, inside the same press, keeps the drawer's Play right whatever the order of listeners. */
  function wakeSound() {
    try { const A = window.CwPlayAudio; if (A) { A.wake(true); A.reserve(30000); } } catch (_) {}
  }
  document.addEventListener('click', e => {
    if (!on()) return;
    if (e.target && e.target.closest && e.target.closest('#device-modal .ud-thumb')) { stripClick(e); return; }
    const b = e.target && e.target.closest && e.target.closest('#device-modal .play-now, #device-modal .vr-item[data-vr-play]');
    if (b) wakeSound();
  }, true);

  /* ------------------------------------------------------------ styles */
  function styles() {
    if (document.getElementById('ud-styles')) return;
    const st = document.createElement('style');
    st.id = 'ud-styles';
    st.textContent = `
      /* Narrow screens: details only, no console picture (by design). */
      @media (max-width: 1400px) {
        #device-modal.ud-drawer .drawer-left > .device-modal-img,
        #device-modal.ud-drawer .drawer-left > .device-modal-demo { display: none !important; }
      }
      /* The picture strip: the old viewer's thumbnails, as buttons so a remote and a pad reach them. */
      #device-modal.ud-drawer .ud-gallery[hidden] { display: none; }
      #device-modal.ud-drawer .ud-thumb { padding: 0; margin: 0; font: inherit; color: inherit; -webkit-appearance: none; appearance: none; width: 100%; }
      #device-modal.ud-drawer .ud-thumb.ud-contain { background-size: contain; background-repeat: no-repeat; }
      #device-modal.ud-drawer .ud-thumb:focus-visible { outline: none; }
      /* Phones: one compact row that scrolls sideways, above the details. */
      @media (max-width: 860px) {
        #device-modal.ud-drawer .ud-gallery { display: flex; gap: 8px; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: thin; padding: 10px 14px 12px; }
        #device-modal.ud-drawer .ud-thumb { flex: 0 0 92px; width: 92px; }
      }
      #device-modal.ud-drawer .series-pill:focus-visible { outline: 2px solid var(--c, var(--accent)); outline-offset: 2px; }
      /* The game's marquee (clear logo) in the title row, as the media player shows a film's logo
         (embytitle.js): same soft shadow so a white logo stays readable on the light theme. */
      #device-modal.ud-drawer .drawer-title-row h2.ud-has-marquee { line-height: 0; }
      #device-modal.ud-drawer .ud-marquee { display: block; width: auto; height: auto; max-width: min(100%, 420px); max-height: 110px;
        object-fit: contain; filter: drop-shadow(0 1px 3px rgba(0,0,0,.55)) drop-shadow(0 0 1px rgba(0,0,0,.45)); }
      @media (max-width: 560px) { #device-modal.ud-drawer .ud-marquee { max-width: 80vw; max-height: 80px; } }
      /* NO DEVICE, NO WAIT (2026-10-17): "when closing the slide out drawer on a phone
         (that has no device that is animating) it should close right away as there is no device to
         animate it leaving." open() marks body.no-demo-device whenever no stage shows (every phone
         drawer, and any title without one). Then the close has no hold: only the slide (.7 s, see below), and the backdrop
         goes with it (--drawer-out is redefined on the overlay only, so closeOverlay's scrollbar timer
         and the film drawer keep theirs). With a device on the left, the device-synced 1.4 s exit stays.
         Regressed by the 2026-10-10 change (uibugs #16) that gave every game drawer the film drawer's
         hold-then-slide, stage or not. */
      /* Corrected the same day ("It was slow to start, not slow to close, so please change the
         close speed back. I did notice it starts to close right away."): the slide keeps the old
         speed, the second half of the 1.4 s close (.7 s, the same easing), and only the hold is gone. */
      body.no-demo-device #device-overlay { --drawer-out: .7s; }
      body.no-demo-device #device-overlay .modal.leaving { animation-name: device-drawer-hide-fast; }
      /* No title bar (see NO TITLE BAR above): the tab row is the drawer's sticky top and ends with the close box.
         The tabs give way (the name tab shortens with an ellipsis), so the close box never leaves the row. */
      #device-modal.ud-drawer .ud-tabs { position: sticky; top: 0; z-index: 3; align-items: center; flex-wrap: nowrap; min-width: 0;
        padding-right: 12px; background: linear-gradient(180deg, rgba(26,33,46,.97), rgba(26,33,46,.9));
        backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
      :root[data-theme="light"] #device-modal.ud-drawer .ud-tabs { background: linear-gradient(180deg, rgba(248,249,251,.97), rgba(248,249,251,.9)); }      #device-modal.ud-drawer .ud-tabs .drawer-tab { flex: 0 0 auto; white-space: nowrap; }
      #device-modal.ud-drawer .ud-tabs .drawer-tab[data-tab="device"] { flex: 0 1 auto; min-width: 3em; overflow: hidden; text-overflow: ellipsis; }
      #device-modal.ud-drawer .ud-tabs-close { margin-left: auto; flex: 0 0 auto; }
      @media (max-width: 560px) {
        #device-modal.ud-drawer .ud-tabs { padding-left: 8px; padding-right: 8px; gap: 0; }
        #device-modal.ud-drawer .ud-tabs .drawer-tab { padding-left: 10px; padding-right: 10px; }
      }
      /* The play window's head with a marquee: logo and year only, at the two lines' own height. */
      .overlay .modal-head.ud-pm-on .modal-sub, .overlay .modal-head.ud-pm-on .modal-title { display: none !important; }
      .overlay .modal-head .ud-pm-row { display: flex; align-items: center; gap: 12px; min-width: 0; }
      .overlay .modal-head .ud-pm-logo { display: block; width: auto; height: 100%; max-width: min(60vw, 360px); object-fit: contain;
        filter: drop-shadow(0 1px 3px rgba(0,0,0,.55)) drop-shadow(0 0 1px rgba(0,0,0,.45)); }
      .overlay .modal-head .ud-pm-year { font-size: 15px; font-weight: 800; color: var(--muted); white-space: nowrap; }
    `;
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------ the marquee in the play window (2026-10-17)
     "The marquee should show on the title bar of the play window as well. Right now it says System
     then under that the game and year. I think we should have that as the fallback but show marquee
     and year only." The window's two lines stay as they are until the marquee has loaded (same key,
     same bucket, same silent 404 as the drawer); then the head shows the logo and the year only, the
     logo sized to the height the two lines had so the head never grows. The two lines are hidden, not
     removed, and come back on the next open or when there is no marquee. Watches the play overlays'
     class (an open window) so nothing in index.html or the play host is edited. */
  const PLAY_OVERLAYS = ['gb-play-overlay', 'nes-play-overlay', 'atari-play-overlay'];
  let _playMarqSeq = 0;
  function playOpenId() { try { return typeof _openPlayDeviceId !== 'undefined' ? _openPlayDeviceId : null; } catch (_) { return null; } }   // eslint-disable-line no-undef
  function playMarqueeReset(ov) {
    const head = ov && ov.querySelector('.modal-head'); if (!head) return;
    head.classList.remove('ud-pm-on');
    head.querySelectorAll('.ud-pm-row').forEach(n => n.remove());
  }
  async function playYear(d) {
    const y = String(d.released || '').slice(0, 4);
    if (/^\d{4}$/.test(y)) return y;
    try { const GM = window.GameMeta; const hit = GM && GM.lookup ? await GM.lookup(d) : null; if (hit && hit.rec && hit.rec.y) return String(hit.rec.y); } catch (_) {}
    return '';
  }
  function playMarquee(ov) {
    const seq = ++_playMarqSeq;
    playMarqueeReset(ov);
    const id = playOpenId();
    const d = id && (g('ALL_DEVICES') || []).find(x => x.id === id);
    const p = d && profileOf(d);
    if (!p || (p !== PROFILES.gb && p !== PROFILES.nes && p !== PROFILES.atari)) return;
    const head = ov.querySelector('.modal-head'), box = head && head.firstElementChild;
    if (!box || box.classList.contains('modal-close')) return;
    const live = () => seq === _playMarqSeq && ov.classList.contains('open') && playOpenId() === id;
    const yearP = playYear(d);   // may wait for the metadata on first use: never holds the logo back
    /* No 8 s give-up here (probe's): while a game boots on a busy machine the logo can take longer,
       and a timeout would mark it missing for the whole page load (seen once, CPU at 100%). */
    const load = u => new Promise(res => { const im = new Image(); im.referrerPolicy = 'no-referrer'; im.onload = () => res(im.naturalWidth > 0 ? u : null); im.onerror = () => res(null); im.src = u; });
    marqueeUrls(d, p).then(async us => { for (const u of us) { if (await load(u)) return u; } return null; }).then(url => {
      if (!url || !live()) return;
      const h = Math.max(24, Math.round(box.getBoundingClientRect().height)) || 40;   // the two lines' height, before the swap
      const img = new Image();
      img.className = 'ud-pm-logo'; img.alt = d.name || ''; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
      img.onload = () => {
        if (!live()) return;
        const row = document.createElement('div');
        row.className = 'ud-pm-row'; row.style.height = h + 'px';
        img.style.maxHeight = h + 'px';
        row.appendChild(img);
        box.appendChild(row);
        head.classList.add('ud-pm-on');
        yearP.then(year => {
          if (!year || !live() || !row.isConnected) return;
          const s = document.createElement('span'); s.className = 'ud-pm-year'; s.textContent = year; row.appendChild(s);
        }).catch(() => {});
      };
      img.onerror = () => {};   // keep the two lines
      img.src = url;
    }).catch(() => {});
  }
  function watchPlayOverlays() {
    for (const oid of PLAY_OVERLAYS) {
      const ov = document.getElementById(oid);
      if (!ov || ov.__udPm) continue;
      ov.__udPm = true;
      let was = ov.classList.contains('open');
      new MutationObserver(() => {
        const now = ov.classList.contains('open');
        if (now && !was) setTimeout(() => playMarquee(ov), 0);   // after the opener has written its title
        if (!now && was) { _playMarqSeq++; playMarqueeReset(ov); }
        was = now;
      }).observe(ov, { attributes: true, attributeFilter: ['class'] });
    }
  }

  function wire() { styles(); wrap(); watchPlayOverlays(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire, { once: true }); else wire();
  // index.html's own script runs before DOMContentLoaded; wrap as soon as the names exist too.
  wrap();

  window.CwDrawer = { BUILD, on, profileOf, build, open: id => { const d = (g('ALL_DEVICES') || []).find(x => x.id === id); return d ? open(d) : false; }, PROFILES };
})();

/*
 * sgb-shelf.js -- the Super Game Boy shelf (25 Oct 2026).
 *
 * 25 Oct: Super Game Boy is a system of its own, as many emulators show it. Its games are
 * ordinary Game Boy cartridges, kept on purpose in BOTH the Game Boy / Game Boy Color library and
 * the library's sgb folder; the game server lists each file once and says, per file, that a copy is
 * also on the sgb shelf (cws.js CWS.sgbIds()).
 *
 * WHAT THIS FILE OWNS
 *   - The shelf's entries: one per title on the sgb shelf, in GAME_BOY / ALL_DEVICES like every
 *     Game Boy title, with id 'sgb-' + the Game Boy id's slot, sgb: true and sgbOf = the Game Boy
 *     id (whose cartridge, saves and hash it shares). Everything else is its Game Boy copy's,
 *     system, series and console art included, because the TILE is exactly the Game Boy tile
 *     (25 Oct: same console art, same clip or live screen, in every art mode).
 *     A title held only in the sgb folder has no Game Boy entry at all (index.html skips it); its
 *     entry is built the way index.html builds a Game Boy title (_gbConsoleArt).
 *   - The drawer stage only: our own photograph of a television, a Super NES with the Super Game
 *     Boy and controllers (sgb/console/draw.png), the screen black when off, the title's clip
 *     from the sgb-clips bucket behind the television's glass when on.
 *   - The bucket addresses (covers, 3D covers, marquees, manuals, clips, fan art borders), named
 *     like the Game Boy buckets: <SHA-1 of the cartridge, upper case>.<ext>.
 *
 * NO DUPLICATES ON THE MIXED WALL (25 Oct): emby.js's gamePool leaves out an SGB entry
 * whenever the shelf of its Game Boy copy is asked for too, so the all-systems wall shows each
 * game once, as its normal Game Boy or Color tile. Picking Super Game Boy in the Systems menu
 * shows the whole shelf, playing in Super Game Boy mode.
 */
(function () {
  'use strict';
  if (window.SGB) return;

  const BUCKET = {
    clips:    'https://pub-0b705276a1924b02b00ff5cd10042fc8.r2.dev',   // sgb-clips
    /* covers 2D / 3D and marquee (28 Oct): none of their own; a Super Game Boy game is a Game Boy /
       Color cartridge, so the gb/gbc-covers and gb/gbc-marquee buckets serve it (emby.js, drawer-unified.js). */
    manuals:  'https://pub-09110fc212204aa894cdac0107291a6b.r2.dev',   // sgb-manuals
    borders:  'https://pub-5656d877345d49ae96626afa8d6ebd56.r2.dev',   // sgb-borders (fan art, .jpg)
  };
  /* The photograph, cropped to its own picture (1016x596 of the 1080x1080 original). The
     television's screen is a translucent glass layer (mean alpha 95/255) at 309,42 333x248 in
     the crop, measured from the file's own alpha; the CSS in index.html (.sgb-emu) holds the
     same rectangle as percentages. */
  const DRAW = 'images/consoles/sgb-draw.webp?v=2.0.0';
  const drawUrl = () => { try { return new URL(DRAW, document.baseURI).href; } catch (e) { return DRAW; } };

  const isSgb = d => !!(d && d.sgb && d.catalogue === 'game-boy');
  /* The Game Boy id behind an SGB id (its cartridge, its saves, its hash). */
  function baseId(id) { id = String(id || ''); return id.indexOf('sgb-') === 0 ? 'gb-' + id.slice(4) : id; }
  function sgbIdOf(gbId) { return 'sgb-' + String(gbId).slice(3); }

  /* ------------------------------------------------------------------ the entries */
  function adopt() {
    if (typeof GAME_BOY === 'undefined' || typeof ALL_DEVICES === 'undefined') return [];
    const ids = (window.CWS && typeof CWS.sgbIds === 'function') ? CWS.sgbIds() : [];
    if (!ids.length) return [];
    const byId = new Map(GAME_BOY.map(d => [d.id, d]));
    const extra = (typeof _gbPackExtra !== 'undefined' && _gbPackExtra) ? _gbPackExtra : {};
    const added = [];
    for (const gid of ids) {
      const sid = sgbIdOf(gid);
      if (byId.has(sid)) continue;
      const base = byId.get(gid) || null, x = extra[gid] || null;
      if (!base && !x) continue;
      const gbc = base ? base.system === 'gbc' : x.s >= 1;
      let d = base ? Object.assign({}, base) : {
        id: sid, catalogue: 'game-boy', series: gbc ? 'game-boy-color' : 'game-boy', system: gbc ? 'gbc' : 'gb',
        name: typeof _gbDisplayTitle === 'function' ? _gbDisplayTitle(x.n) : x.n, fullName: x.n,
        developer: '-', genre: '-', players: '-', cartridge: `${Math.round((x.z * 8) / 1024)} Kbit`,
        released: '', features: [], regions: [], additional: '', promo: '',
        compatible: x.s === 2 ? 'cgb-only' : 'dmg',
      };
      if (!base && typeof _gbConsoleArt === 'function') { try { d = _gbConsoleArt(d) || d; } catch (e) {} }
      Object.assign(d, { id: sid, sgb: true, sgbOf: gid, sgbOnly: !base, gbShelf: gbc ? 'gbc' : 'gb', fromPack: true });
      if (!base) d.description = `On your game server's Super Game Boy shelf only. Identified by cartridge hash, where it is catalogued as <b>${x.n}</b>; the machine it needs and its size are read from the cartridge itself.`;
      GAME_BOY.push(d); ALL_DEVICES.push(d); byId.set(sid, d); added.push(d);
    }
    if (window.CWS && typeof CWS.decorate === 'function') { try { CWS.decorate(added.filter(d => d.sgbOnly)); } catch (e) {} }
    return added;
  }

  /* ------------------------------------------------------------------ the cartridge's SHA-1 */
  const SHA1_KEY = 'gnw.gb.cartSha1.v1';      // the Game Boy art's own map, {gbId: SHA1}
  function sha1Known(gid) {
    try { const m = JSON.parse(localStorage.getItem(SHA1_KEY) || '{}') || {}; return m[gid] || null; } catch (e) { return null; }
  }
  const _sha1Wait = new Map();
  function sha1Of(id) {
    const gid = baseId(id);
    const k = sha1Known(gid);
    if (k) return Promise.resolve(k);
    if (_sha1Wait.has(gid)) return _sha1Wait.get(gid);
    const p = Promise.resolve(typeof _gbFetchCart === 'function' ? _gbFetchCart(gid.slice(3)) : null).then(u8 => {
      if (!u8 || !u8.length) return null;
      const dg = window.cwsDigest ? cwsDigest('SHA-1', u8) : (window.crypto && crypto.subtle) ? crypto.subtle.digest('SHA-1', u8) : null;
      return dg ? Promise.resolve(dg).then(buf => {
        const b = new Uint8Array(buf); let h = '';
        for (let i = 0; i < b.length; i++) h += b[i].toString(16).padStart(2, '0');
        h = h.toUpperCase();
        try { const m = JSON.parse(localStorage.getItem(SHA1_KEY) || '{}') || {}; m[gid] = h; localStorage.setItem(SHA1_KEY, JSON.stringify(m)); } catch (e) {}
        return h;
      }) : null;
    }).catch(() => null);
    _sha1Wait.set(gid, p);
    return p;
  }
  /* Synchronous form for URL builders that already run after the map is warm. */
  function sha1Now(id) { return sha1Known(baseId(id)); }

  /* ------------------------------------------------------------------ tile and stage */
  function frameHTML(d, extraClass) {
    return `<div class="sgb-emu${extraClass ? ' ' + extraClass : ''}" data-sgb="${String(d.id).replace(/"/g, '&quot;')}">`
         + `<div class="sgb-scr"></div><img class="sgb-emu-art" src="${drawUrl()}" alt=""></div>`;
  }
  const MISSING = new Set();     // clips that answered 404 (this page load only)
  const NEAR_PX = 300;
  function near(el) {
    if (window._mNear) return window._mNear(el, NEAR_PX);
    const r = el.getBoundingClientRect();
    return r.height > 0 && r.top < (innerHeight || 0) + NEAR_PX && r.bottom > -NEAR_PX;
  }
  function attach(wrap, always) {
    const id = wrap.dataset.sgb;
    if (!id || wrap._sgbArmed || MISSING.has(id)) return;
    wrap._sgbArmed = true;
    sha1Of(id).then(h => {
      if (!h || !wrap.isConnected) { wrap._sgbArmed = false; return; }
      const v = document.createElement('video');
      v.className = 'sgb-vid'; v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true;
      if (window.GBVIDEO && GBVIDEO.fitScale) GBVIDEO.fitScale(v, 256);   // smooth when shrunk (2 Nov)
      v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.preload = 'auto';
      v.addEventListener('error', () => { MISSING.add(id); v.remove(); }, { once: true });
      v.addEventListener('loadeddata', () => wrap.classList.add('ready'), { once: true });
      v.src = BUCKET.clips + '/' + h + '.webm';
      const scr = wrap.querySelector('.sgb-scr');
      if (scr) scr.after(v); else wrap.insertBefore(v, wrap.firstChild);
      const p = v.play(); if (p && p.catch) p.catch(() => {});
    });
  }
  function release(wrap) {
    const v = wrap.querySelector('video.sgb-vid');
    if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {} v.remove(); }
    wrap._sgbArmed = false; wrap.classList.remove('ready');
  }
  /* The drawer's picture (and any other frame): a clip plays while it is near the screen and stops when it goes. */
  let _sweepT = 0;
  function sweep() {
    _sweepT = 0;
    if (document.hidden) return;
    /* 26 Oct: the drawer's own picture is the console OFF, as on every system (screen black,
       no clip); only the device that slides in from the left (the stage, showStage) plays the clip. */
    document.querySelectorAll('.sgb-emu[data-sgb]:not(.sgb-stage):not(.sgb-drawer)').forEach(w => {
      if (near(w)) attach(w); else if (w._sgbArmed) release(w);
    });
  }
  function schedule() { if (!_sweepT) _sweepT = setTimeout(sweep, 120); }
  addEventListener('scroll', schedule, { passive: true, capture: true });
  addEventListener('resize', schedule);
  document.addEventListener('visibilitychange', schedule);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  /* The play window takes the whole screen: pause the wall's clips meanwhile, like the Game Boy clips. */
  /* Since 28 Oct the game drawer holds the wall as well (index.html _FG_IDS): the drawer's
     own clip (.sgb-stage / .sgb-drawer) keeps playing, and only a clip this paused is started again. */
  document.addEventListener('gnw:foreground', e => {
    const on = e && e.detail && e.detail.active;
    document.querySelectorAll('.sgb-emu:not(.sgb-stage):not(.sgb-drawer) video.sgb-vid').forEach(v => {
      try {
        if (on) { if (!v.paused) { v._fgHeld = 1; v.pause(); } }
        else if (v._fgHeld) { v._fgHeld = 0; v.play().catch(() => {}); }
      } catch (_) {}
    });
  });

  /* The drawer: the same photograph, tilted like the other stages, the clip behind the glass. */
  function showStage(d, stage) {
    stage.innerHTML = '<div class="device-card stage-card" data-series="super-game-boy" data-system="sgb">'
      + '<div class="img stage-img">' + frameHTML(d, 'sgb-stage') + '</div></div>';
    stage.classList.remove('open'); void stage.offsetWidth; stage.classList.add('open');
    try { if (typeof initStageTilt === 'function') initStageTilt(stage.querySelector('.stage-card')); } catch (e) {}
    const w = stage.querySelector('.sgb-emu');
    if (w) attach(w, true);
  }

  window.SGB = { BUCKET, drawUrl, isSgb, baseId, sgbIdOf, adopt, sha1Of, sha1Now, frameHTML, showStage, sweep: schedule,
                 MENU_YEARS: [1994, 2003] };
})();

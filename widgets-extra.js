/*
 * widgets-extra.js -- the Image and Play time widgets, and the play totals behind the games'
 * "Most played" sort (8 Nov 2026).
 *
 * Both widgets are off by default, live in Settings > Widgets beside the others and are placed
 * among the tiles by emby.js exactly like them (one in N tiles, a seeded place in each cycle).
 * Each has a size: 1x (one tile), 2x (two tiles wide) or 4x (two by two). emby.js keeps the
 * bigger ones where they fit the rows (see gridTake there); on a one-column screen every size is
 * one tile, the full width of the screen.
 *
 * IMAGE: the person picks one picture or a group from this device. Each Image tile shows only its
 * own pictures, one after another. The pictures are made smaller (at most 1280 px on the long side)
 * and kept in this browser's own database (cw-widget-images): never uploaded, never synced.
 * Removing a tile removes its pictures. Where the browser keeps nothing (blocked storage), the
 * tile and the settings say so and the rest of the page carries on.
 *
 * PLAY TIME: the games the person picks, each with its logo (or box art, then the generic box,
 * as the tiles fall back; CwDrawer.widgetArt) and how long it has been played: the total of the
 * play history's sessions (continuerow.js, window.CwPlayHistory), which counts play in this
 * browser only. A game with no sessions says "Not played in this browser yet".
 *
 * Silent: nothing here makes a sound.
 */
(function () {
  'use strict';
  const IDB = 'cw-widget-images', STORE = 'pics';
  const MAX_SIDE = 1280, QUALITY = 0.85, MAX_PICS = 200;
  const ROTATE_MS = 8000;   // Image: one picture every 8 s
  /* Play Time turns its page as Cast turns its face (emby.js ROT_MIN, ROT_SPREAD): each page holds
     18 s plus up to 14 s more, chosen afresh each time, so tiles drift apart (8 s was too quick). */
  const PT_HOLD_MS = 18000, PT_SPREAD_MS = 14000;
  const holdFor = el => el.classList.contains('vw-playtime') ? PT_HOLD_MS + Math.random() * PT_SPREAD_MS : ROTATE_MS;
  const SIZES = [['1', '1x: one tile'], ['2', '2x: two tiles wide'], ['4', '4x: two by two']];

  let H = null;   // emby.js helpers: esc, styles, save, cfg, redraw, mostOn
  const esc = s => (H ? H.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));

  /* ------------------------------------------------------------ settings record */
  const clampEvery = (n, def) => { n = parseInt(n, 10); return (!n || n < 3) ? def : Math.min(200, n); };
  const sizeOf = v => (String(v) === '2' || String(v) === '4') ? String(v) : '1';
  /* How a picture sits in its tile: the whole picture (the default), filled and
     cropped, or a slow pan and zoom over the filled picture. */
  const FITS = [['fit', 'Whole picture'], ['fill', 'Fill the tile (crops the edges)'], ['pan', 'Slow pan and zoom']];
  const fitOf = v => (v === 'fill' || v === 'pan') ? v : 'fit';
  /* From the stored gnw.widgets record: off by default, frequency 1 in 30 like the text cards. */
  function readCfg(c) {
    const im = (c && c.image) || {}, pt = (c && c.playtime) || {};
    const list = Array.isArray(im.list) ? im.list.filter(w => w && typeof w.id === 'string').slice(0, 20).map(w => ({
      id: w.id, name: String(w.name || '').slice(0, 40), every: clampEvery(w.every, 30), size: sizeOf(w.size), n: Math.max(0, parseInt(w.n, 10) || 0), fit: fitOf(w.fit),
    })) : [];
    return {
      image: { on: im.on === true, list },
      playtime: { on: pt.on === true, every: clampEvery(pt.every, 30), size: sizeOf(pt.size), games: Array.isArray(pt.games) ? pt.games.filter(x => typeof x === 'string').slice(0, 60) : [] },
    };
  }

  /* Seeds for each widget's place in its cycle, re-rolled with the others (emby.js reseedAmbientTiles). */
  const seeds = new Map();
  const seedOf = k => { let s = seeds.get(k); if (s === undefined) { s = Math.floor(Math.random() * 1e6); seeds.set(k, s); } return s; };
  function reseed() { seeds.clear(); }
  /* [key, { on, every }, seed] for each widget that can be placed now. */
  function defs(cfg) {
    const out = [];
    if (cfg.image.on) for (const w of cfg.image.list) out.push(['img:' + w.id, { on: true, every: w.every }, seedOf('img:' + w.id)]);
    if (cfg.playtime.on && cfg.playtime.games.length) out.push(['playtime', { on: true, every: cfg.playtime.every }, seedOf('playtime')]);
    return out;
  }

  /* ------------------------------------------------------------ the picture store */
  let _dbp = null, _storeOk = null;
  function db() {
    if (_dbp) return _dbp;
    _dbp = new Promise((res, rej) => {
      let r;
      try { r = indexedDB.open(IDB, 1); } catch (e) { rej(e); return; }
      r.onupgradeneeded = () => { try { r.result.createObjectStore(STORE, { keyPath: 'k' }).createIndex('wid', 'wid'); } catch (e) {} };
      r.onsuccess = () => { const d = r.result; d.onclose = () => { _dbp = null; }; res(d); };
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error('blocked'));
    }).catch(e => { _dbp = null; _storeOk = false; throw e; });
    return _dbp;
  }
  function tx(mode, fn) {
    return db().then(d => new Promise((res, rej) => {
      const t = d.transaction(STORE, mode), st = t.objectStore(STORE);
      let out;
      try { out = fn(st); } catch (e) { rej(e); return; }
      t.oncomplete = () => res(out && 'result' in out ? out.result : out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error('aborted'));
    }));
  }
  /* Can this browser keep pictures? Asked once: a write and a read of a tiny record. */
  function storeWorks() {
    if (_storeOk !== null) return Promise.resolve(_storeOk);
    return tx('readwrite', st => st.put({ k: '__probe', wid: '__probe', blob: null })).then(() => tx('readwrite', st => st.delete('__probe')))
      .then(() => (_storeOk = true), () => (_storeOk = false));
  }
  const getPic = (wid, n) => tx('readonly', st => st.get(wid + ':' + n)).catch(() => null);
  function dropPics(wid) {
    return tx('readwrite', st => {
      const r = st.index('wid').openKeyCursor(IDBKeyRange.only(wid));
      r.onsuccess = () => { const c = r.result; if (c) { st.delete(c.primaryKey); c.continue(); } };
    }).catch(() => {});
  }
  /* One picture made smaller: at most MAX_SIDE on the long side, as a JPEG. */
  function shrink(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => {
        try {
          const w = im.naturalWidth, h = im.naturalHeight;
          if (!w || !h) throw new Error('empty');
          const k = Math.min(1, MAX_SIDE / Math.max(w, h)), cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
          const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
          const x = cv.getContext('2d'); x.fillStyle = '#10131a'; x.fillRect(0, 0, cw, ch); x.drawImage(im, 0, 0, cw, ch);
          cv.toBlob(b => { URL.revokeObjectURL(url); b ? res({ blob: b, w: cw, h: ch }) : rej(new Error('no blob')); }, 'image/jpeg', QUALITY);
        } catch (e) { URL.revokeObjectURL(url); rej(e); }
      };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('not a picture')); };
      im.src = url;
    });
  }
  /* The tile's pictures replaced by these files. Answers how many were kept. */
  async function storePics(wid, files) {
    if (!(await storeWorks())) throw new Error('nostore');
    const list = Array.from(files || []).filter(f => /^image\//.test(f.type || '') || /\.(jpe?g|png|gif|webp|bmp|avif)$/i.test(f.name || '')).slice(0, MAX_PICS);
    const made = [];
    for (const f of list) { try { made.push(await shrink(f)); } catch (e) {} }
    if (!made.length) return 0;
    await dropPics(wid);
    await tx('readwrite', st => { made.forEach((m, i) => st.put({ k: wid + ':' + i, wid, n: i, blob: m.blob, w: m.w, h: m.h })); });
    _urls.forEach((u, key) => { if (key.indexOf(wid + ':') === 0) { URL.revokeObjectURL(u); _urls.delete(key); } });
    return made.length;
  }
  const _urls = new Map();   // 'wid:n' -> object URL, for the pictures on screen now
  async function picUrl(wid, n) {
    const key = wid + ':' + n;
    if (_urls.has(key)) return _urls.get(key);
    const rec = await getPic(wid, n);
    if (!rec || !rec.blob) return null;
    const u = URL.createObjectURL(rec.blob);
    _urls.set(key, u);
    if (_urls.size > 48) { const first = _urls.keys().next().value; URL.revokeObjectURL(_urls.get(first)); _urls.delete(first); }
    return u;
  }

  /* ------------------------------------------------------------ play totals */
  let _totals = null, _totalsAt = 0, _totalsP = null;
  /* id -> total ms of real play, from every session the play history holds. */
  function loadTotals(maxAgeMs = 30000) {
    if (_totals && Date.now() - _totalsAt < maxAgeMs) return Promise.resolve(_totals);
    if (_totalsP) return _totalsP;
    const P = window.CwPlayHistory;
    _totalsP = (P && P.all ? P.all() : Promise.resolve([])).catch(() => []).then(rows => {
      const m = new Map();
      for (const r of rows || []) { if (!r || !r.id) continue; const ms = Number(r.played) || 0; if (ms > 0) m.set(r.id, (m.get(r.id) || 0) + ms); }
      const first = !_totals;
      _totals = m; _totalsAt = Date.now(); _totalsP = null;
      if (first && H && H.mostOn && H.mostOn() && m.size) { try { H.redraw(); } catch (e) {} }
      return m;
    });
    return _totalsP;
  }
  /* For the games' sort, which must answer at once: what is known now, and a refresh behind it. */
  function totalsNow() {
    if (!_totals || Date.now() - _totalsAt > 60000) loadTotals(60000);
    return _totals || new Map();
  }
  function playText(ms) {
    const sec = Math.floor((ms || 0) / 1000), h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    if (h) return h + ' h ' + m + ' min';
    if (m) return m + ' min';
    return 'under a minute';
  }
  const devOf = id => { try { return (typeof ALL_DEVICES !== 'undefined' && ALL_DEVICES.find(d => d.id === id)) || null; } catch (e) { return null; } };
  /* A version's words (the Continue card's), so two versions of one game can be told apart. */
  const versionOf = id => { try { return (window.Variants && window.Variants.cardLabel(id)) || ''; } catch (e) { return ''; } };
  function systemWord(d) {
    if (!d) return '';
    const c = d.catalogue;
    if (!c) return 'Game & Watch';
    if (c === 'game-boy') return d.system === 'gbc' || d.series === 'game-boy-color' ? 'Game Boy Color' : 'Game Boy';
    if (c === 'pokemon-mini') return 'Pokémon mini';
    if (c === 'nes') { const n = d.nesConsole || 'nes'; return n === 'famicom' ? 'Famicom' : n === 'fds' ? 'Famicom Disk System' : 'NES'; }
    try { if (typeof ATARI_SYSTEMS !== 'undefined' && ATARI_SYSTEMS[c]) return ATARI_SYSTEMS[c].label; } catch (e) {}
    return '';
  }

  /* ------------------------------------------------------------ the tiles */
  const sizeCls = s => s === '4' ? ' vw-size-4 tile-wide' : s === '2' ? ' vw-size-2 tile-wide' : '';
  function tileHTML(key, cfg) {
    if (key === 'playtime') {
      const p = cfg.playtime;
      /* PLAY TIME (redone 8 Nov): the name in the caption like Weather; inside, three games a
         page, each its logo and its time, turning page by page like Cast. A game opens its drawer
         (click, tap, or OK on it: OK on the tile steps in, Up and Down move, Back steps out). */
      return `<div class="vgrid-widget vw-wx vw-playtime${sizeCls(p.size)}" role="group" tabindex="0" aria-label="Play Time: your games and how long you have played them. Press OK to pick one.">
      <div class="vw-main vw-pt-main"><i class="vw-sizer" aria-hidden="true"></i>
        <div class="pt-body pt-waiting"></div>
      </div>
      <div class="vw-cap"><div class="vw-title">Play Time</div><div class="vw-sub">Played in this browser</div></div>
    </div>`;
    }
    const id = key.slice(4), w = cfg.image.list.find(x => x.id === id);
    if (!w) return '';
    const name = w.name || 'My pictures';
    return `<div class="vgrid-widget vw-wx vw-image${sizeCls(w.size)}" data-wimg="${esc(id)}" data-wn="${w.n}" role="group" tabindex="0" aria-label="Pictures: ${esc(name)}">
      <div class="vw-main vw-img-main"><i class="vw-sizer" aria-hidden="true"></i><div class="wi-stage"></div>
        <div class="wi-note" hidden></div>
      </div>
      <div class="vw-cap"><div class="vw-title">${esc(name)}</div><div class="vw-sub">${w.n ? w.n + (w.n === 1 ? ' picture' : ' pictures') : 'No pictures yet'}</div></div>
    </div>`;
  }
  /* Every widget switched on, one tile each (the widgets-only wall). */
  function allTilesHTML(cfg) {
    let html = '', n = 0;
    for (const [k] of defs(cfg)) { const h = tileHTML(k, cfg); if (h) { html += h; n++; } }
    return { html, n };
  }

  /* Filling and turning: only the tiles on screen change (an IntersectionObserver keeps the list),
     one step every ROTATE_MS, none while a game or film is in front. */
  const _seen = new Set();
  let _io = null, _timer = null;
  function watch(el) {
    if (!_io && typeof IntersectionObserver === 'function') {
      _io = new IntersectionObserver(es => { for (const e of es) { if (e.isIntersecting) { _seen.add(e.target); if (!e.target.__wxFilled) fill(e.target); } else _seen.delete(e.target); } }, { rootMargin: '200px 0px' });
    }
    if (_io) _io.observe(el); else { _seen.add(el); fill(el); }
  }
  function mount() {
    ensureStyles();
    document.querySelectorAll('#video-grid > .vw-wx').forEach(el => {
      /* A 4x tile spans two rows, and a stand-in for it (index.html's far-tile code) would span one:
         it stays on the page instead (marked as already watched there). */
      if (el.classList.contains('vw-size-4')) el.__cwWallW = 1;
      if (el.__wxWatched) return;
      el.__wxWatched = 1;
      watch(el);
    });
    if (!_timer) _timer = setInterval(step, 1000);
  }
  const held = () => { try { return typeof window.gnwForegroundActive === 'function' && window.gnwForegroundActive(); } catch (e) { return false; } };
  function step() {
    const live = document.querySelectorAll('#video-grid > .vw-wx');
    if (!live.length) { clearInterval(_timer); _timer = null; _seen.clear(); return; }
    if (held() || document.hidden) return;
    const now = Date.now();
    for (const el of _seen) {
      if (!el.isConnected) { _seen.delete(el); continue; }
      if (!el.__wxNext) { el.__wxNext = now + holdFor(el) + (el.classList.contains('vw-playtime') ? 0 : Math.floor(Math.random() * 3000)); continue; }
      if (now >= el.__wxNext) { el.__wxNext = now + holdFor(el); turn(el); }
    }
  }
  function fill(el) { el.__wxFilled = 1; el.__wxAt = -1; turn(el); }
  function turn(el) {
    if (el.classList.contains('vw-image')) return turnImage(el);
    if (el.classList.contains('vw-playtime')) return turnPlay(el);
  }
  function note(el, text) { const n = el.querySelector('.wi-note'); if (n) { n.textContent = text; n.hidden = !text; } }
  async function turnImage(el) {
    const id = el.dataset.wimg, cfg = H ? readCfg(H.raw()) : null, w = cfg && cfg.image.list.find(x => x.id === id);
    if (!w) return;
    if (!(await storeWorks())) { note(el, 'This browser is not keeping pictures (a private window, or storage turned off), so there is nothing to show here.'); return; }
    if (!w.n) { note(el, 'No pictures yet. Pick them in Settings, Widgets, Image.'); return; }
    const at = (el.__wxAt + 1) % w.n;
    const url = await picUrl(id, at);
    if (!url) { if (at === 0) note(el, 'The pictures for this tile are not in this browser.'); el.__wxAt = at; return; }
    note(el, '');
    el.__wxAt = at;
    const stage = el.querySelector('.wi-stage'); if (!stage) return;
    const im = new Image();
    im.alt = ''; im.decoding = 'async';
    const still = (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || !!(window.GNW_TV && (GNW_TV.isTV || GNW_TV.lowPower));
    const fit = w.fit === 'pan' && still ? 'fill' : w.fit;   // no slow motion on a TV or with reduced motion: filled and still
    im.className = 'wi-pic wi-' + fit + (fit === 'pan' ? ' wi-pan' + (at % 4) : '');
    im.onload = () => {
      if (!stage.isConnected) return;
      stage.appendChild(im);
      requestAnimationFrame(() => requestAnimationFrame(() => im.classList.add('on')));
      const old = [...stage.querySelectorAll('img.wi-pic')].filter(x => x !== im);
      setTimeout(() => old.forEach(o => o.remove()), 700);
    };
    im.src = url;
    const sub = el.querySelector('.vw-sub'); if (sub && w.n > 1) sub.textContent = (at + 1) + ' of ' + w.n;
  }
  const _art = new Map();   // id -> Promise<{url, kind}|null>
  const artOf = id => { if (!_art.has(id)) _art.set(id, (window.CwDrawer && CwDrawer.widgetArt ? CwDrawer.widgetArt(id) : Promise.resolve(null)).catch(() => null)); return _art.get(id); };
  const PER_PAGE = 3;
  async function turnPlay(el) {
    const cfg = H ? readCfg(H.raw()) : null;
    const games = cfg ? cfg.playtime.games.filter(devOf) : [];
    const body = el.querySelector('.pt-body');
    if (!body) return;
    wirePlayTile(el);
    if (!games.length) { body.className = 'pt-body pt-none'; body.innerHTML = '<div class="pt-empty">Pick games in Settings, Widgets, Play Time.</div>'; return; }
    /* Not while someone is choosing: a page does not turn under the finger or the highlight. */
    if (el.__wxAt >= 0 && (el.contains(document.activeElement) && document.activeElement !== el || el.matches(':hover'))) return;
    const pages = Math.ceil(games.length / PER_PAGE), at = (el.__wxAt + 1) % pages;
    el.__wxAt = at;
    const ids = games.slice(at * PER_PAGE, at * PER_PAGE + PER_PAGE);
    const [tot, arts] = await Promise.all([loadTotals(), Promise.all(ids.map(artOf))]);
    if (!el.isConnected) return;
    const kept = [...tot.values()].some(v => v > 0) || await storeWorks();
    const rows = ids.map((id, i) => {
      const d = devOf(id), ms = tot.get(id) || 0, name = (d && d.name) || 'A game', art = arts[i];
      const time = ms ? playText(ms) : kept ? 'Not played yet' : 'Not kept here';
      const pic = art && art.url ? `<img class="pt-logo pt-${art.kind}" alt="" referrerpolicy="no-referrer" src="${esc(art.url)}">` : `<span class="pt-noart">${esc(name)}</span>`;
      return `<button type="button" class="pt-row" tabindex="-1" data-gid="${esc(id)}" aria-label="${esc(name)}, ${esc(ms ? playText(ms) + ' played' : kept ? 'not played in this browser yet' : 'play time is not kept in this browser')}. Open it.">
        <span class="pt-pic">${pic}</span><span class="pt-time${ms ? '' : ' pt-never'}">${esc(time)}</span></button>`;
    }).join('');
    body.className = 'pt-body pt-rows';
    body.innerHTML = rows;
    const s = el.querySelector('.vw-sub');
    if (s) s.textContent = 'Played in this browser' + (pages > 1 ? ' · ' + (at + 1) + ' of ' + pages : '');
  }
  /* A game opens its slide-out drawer, as its own tile does. */
  function openGame(id) {
    try { if (typeof window.openDevice === 'function') window.openDevice(id); else if (window.CwDrawer) CwDrawer.open(id); } catch (e) {}
  }
  function wirePlayTile(el) {
    if (el.__ptWired) return;
    el.__ptWired = 1;
    el.addEventListener('click', e => {
      const r = e.target.closest && e.target.closest('.pt-row');
      if (r && el.contains(r)) { e.preventDefault(); e.stopPropagation(); openGame(r.dataset.gid); }
    });
    el.addEventListener('keydown', e => {
      const rows = [...el.querySelectorAll('.pt-row')], i = rows.indexOf(document.activeElement);
      const k = e.key;
      if (i < 0) {
        /* OK on the tile steps in, to its first game. */
        if (document.activeElement === el && (k === 'Enter' || k === ' ') && rows.length) { e.preventDefault(); e.stopPropagation(); rows[0].focus(); }
        return;
      }
      if (k === 'Enter' || k === ' ') { e.preventDefault(); e.stopPropagation(); openGame(rows[i].dataset.gid); return; }
      if (k === 'ArrowDown' || k === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation();
        const j = i + (k === 'ArrowDown' ? 1 : -1);
        (rows[j] || el).focus();
        return;
      }
      /* Back, Left or Right: out to the tile, so the wall's own arrows go on from there. */
      if (k === 'Escape' || k === 'Esc' || k === 'GoBack' || k === 'BrowserBack' || k === 'XF86Back' || k === 'Backspace' || k === 'ArrowLeft' || k === 'ArrowRight') {
        e.preventDefault(); e.stopPropagation(); el.focus();
      }
    });
  }

  /* ------------------------------------------------------------ styles */
  function ensureStyles() {
    if (document.getElementById('cw-wx-styles')) return;
    const s = document.createElement('style');
    s.id = 'cw-wx-styles';
    s.textContent = `
      /* THE SIZES (8 Nov 2026). The picture box is sized by .vw-sizer: one tile's picture area at one
         column's width (half the tile less half the 18 px gap when two wide), so a 2x tile is exactly as
         tall as the tiles beside it. A 4x tile spans two rows and stretches to fill them. One column
         (.vgrid-1col): every size is one tile, the screen's width. */
      #video-grid .vgrid-widget.vw-wx { display:flex; flex-direction:column; }
      #video-grid .vgrid-widget.vw-wx .vw-main { aspect-ratio:auto; flex:1 1 auto; min-height:0; }
      #video-grid .vw-wx .vw-sizer { display:block; width:100%; aspect-ratio:5/6; pointer-events:none; }
      #video-grid .vw-wx.tile-wide .vw-sizer { width:calc(50% - 9px); }
      #video-grid.vlayout-grid:not(.vstack):not(.vgrid-1col) > .vw-wx.vw-size-2 { grid-column:span 2; }
      #video-grid.vlayout-grid:not(.vstack):not(.vgrid-1col) > .vw-wx.vw-size-4 { grid-column:span 2; grid-row:span 2; align-self:stretch; }
      /* Two pictures tall plus about one caption and a gap: a 4x tile is never shorter than two rows,
         even where nothing else shares its rows (two columns), and never taller than two rows of tiles. */
      #video-grid:not(.vgrid-1col) > .vw-wx.vw-size-4 .vw-sizer { aspect-ratio:5/12; margin-bottom:86px; }
      #video-grid.vgrid-1col > .vw-wx .vw-sizer { width:100%; aspect-ratio:5/6; margin-bottom:0; }
      #video-grid > .vw-wx.vw-size-4 { contain-intrinsic-size:auto 700px; }
      /* Image */
      #video-grid .vw-img-main { background:radial-gradient(120% 85% at 50% 30%, #1c2230, #0c0f16 72%); }
      #video-grid .vw-img-main .wi-stage { position:absolute; inset:0; overflow:hidden; }
      #video-grid .vw-img-main .wi-pic { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; opacity:0; transition:opacity .6s ease; }
      #video-grid .vw-img-main .wi-pic.on { opacity:1; }
      #video-grid .vw-img-main .wi-note { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; padding:18px; text-align:center; font-size:13px; line-height:1.5; color:#d7dce6; }
      #video-grid .vw-img-main .wi-note[hidden] { display:none; }
      /* Play Time: three games a page, each its logo and its time */
      #video-grid .vw-pt-main { background:radial-gradient(120% 85% at 50% 26%, #1d2433, #0b0e15 74%); }
      #video-grid .vw-pt-main .pt-body { position:absolute; inset:0; display:flex; flex-direction:column; gap:6px; padding:10px; }
      #video-grid .vw-pt-main .pt-none, #video-grid .vw-pt-main .pt-waiting { align-items:center; justify-content:center; text-align:center; }
      #video-grid .vw-pt-main .pt-empty { font-size:13px; line-height:1.5; color:#d7dce6; }
      #video-grid .vw-pt-main .pt-row { flex:0 0 calc((100% - 12px) / 3); min-height:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; padding:6px 8px; border:1px solid rgba(255,255,255,.08); border-radius:12px; background:rgba(255,255,255,.04); color:#fff; cursor:pointer; font:inherit; transition:background .15s ease, border-color .15s ease; }
      #video-grid .vw-pt-main .pt-row:hover, #video-grid .vw-pt-main .pt-row:focus-visible { background:rgba(var(--accent-rgb),.18); border-color:rgba(var(--accent-rgb),.8); outline:none; }
      #video-grid .vw-pt-main .pt-row:focus-visible { box-shadow:0 0 0 2px var(--accent); }
      #video-grid .vw-pt-main .pt-row { overflow:hidden; }
      #video-grid .vw-pt-main .pt-pic { position:relative; flex:1 1 0; min-height:0; width:100%; align-self:stretch; display:flex; align-items:center; justify-content:center; }
      #video-grid .vw-pt-main .pt-logo { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; filter:drop-shadow(0 4px 10px rgba(0,0,0,.55)); }
      #video-grid .vw-pt-main .pt-noart { font-size:13px; font-weight:800; line-height:1.25; color:#e8ecf3; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; text-align:center; }
      #video-grid .vw-pt-main .pt-time { flex:0 0 auto; font-size:14px; font-weight:800; line-height:1.15; color:#fff; text-shadow:0 1px 6px rgba(0,0,0,.6); white-space:nowrap; }
      #video-grid .vw-pt-main .pt-time.pt-never { font-size:12px; font-weight:700; color:#d7dce6; }
      #video-grid .vw-size-2 .vw-pt-main .pt-row, #video-grid .vw-size-4 .vw-pt-main .pt-row { flex-direction:row; gap:14px; padding:6px 16px; }
      #video-grid .vw-size-2 .vw-pt-main .pt-pic, #video-grid .vw-size-4 .vw-pt-main .pt-pic { width:auto; flex:1 1 0; }
      #video-grid .vw-size-4 .vw-pt-main .pt-time { font-size:22px; }
      #video-grid.vgrid-1col .vw-pt-main .pt-row { flex-direction:row; gap:12px; }
      #video-grid.vgrid-1col .vw-pt-main .pt-pic { flex:1 1 0; width:auto; }
      /* Image: how the picture sits (whole, filled, slow pan and zoom) */
      #video-grid .vw-img-main .wi-pic.wi-fit { object-fit:contain; }
      #video-grid .vw-img-main .wi-pic.wi-pan { animation:wi-pan 16s ease-in-out infinite alternate; }
      #video-grid .vw-img-main .wi-pic.wi-pan1 { animation-name:wi-pan1; }
      #video-grid .vw-img-main .wi-pic.wi-pan2 { animation-name:wi-pan2; }
      #video-grid .vw-img-main .wi-pic.wi-pan3 { animation-name:wi-pan3; }
      @keyframes wi-pan  { from { transform:scale(1.04) translate(-2%, -1%); } to { transform:scale(1.18) translate(2%, 1.5%); } }
      @keyframes wi-pan1 { from { transform:scale(1.18) translate(2%, -1.5%); } to { transform:scale(1.04) translate(-2%, 1%); } }
      @keyframes wi-pan2 { from { transform:scale(1.04) translate(2%, 1%); } to { transform:scale(1.16) translate(-2.5%, -1%); } }
      @keyframes wi-pan3 { from { transform:scale(1.16) translate(-2%, 1.5%); } to { transform:scale(1.04) translate(1.5%, -1.5%); } }
      @media (prefers-reduced-motion: reduce) { #video-grid .vw-img-main .wi-pic.wi-pan { animation:none; } }
      /* Settings */
      .aw-card .wx-list { display:flex; flex-direction:column; gap:10px; margin-top:12px; }
      .aw-card .wx-item { border:1px solid var(--line); border-radius:10px; padding:12px; }
      .aw-card .wx-row { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-top:10px; }
      .aw-card .wx-count { font-size:12px; color:var(--muted); }
      .aw-card .wx-note { margin:9px 0 0; font-size:11.5px; color:var(--muted); line-height:1.5; }
      .aw-card .wx-warn { margin:9px 0 0; font-size:12px; color:var(--text); line-height:1.5; }
      .aw-card .wx-chips { display:flex; flex-wrap:wrap; gap:7px; margin-top:8px; }
      .aw-card .wx-chip { display:inline-flex; align-items:center; gap:6px; padding:5px 6px 5px 11px; border-radius:20px; border:1px solid rgba(var(--accent-rgb),.5); background:rgba(var(--accent-rgb),.16); font-size:12px; color:var(--text); }
      .aw-card .wx-chip button { border:0; background:transparent; color:var(--text); cursor:pointer; font-size:14px; line-height:1; padding:2px 6px; border-radius:10px; }
      .aw-card .wx-chip button:focus-visible, .aw-card .wx-pick:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
      .aw-card .wx-results { display:flex; flex-direction:column; gap:4px; margin-top:8px; max-height:220px; overflow-y:auto; }
      .aw-card .wx-pick { display:flex; justify-content:space-between; gap:10px; text-align:left; padding:8px 10px; border-radius:8px; border:1px solid var(--line); background:rgba(255,255,255,.03); color:var(--text); font-size:12.5px; cursor:pointer; }
      .aw-card .wx-pick span:last-child { color:var(--muted); white-space:nowrap; }
      .aw-card .wx-pick[aria-pressed="true"] { border-color:rgba(var(--accent-rgb),.6); background:rgba(var(--accent-rgb),.12); }
      .aw-card .btn-tiny[disabled] { opacity:.5; cursor:default; }`;
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------ Settings > Widgets */
  const newId = () => { try { const a = new Uint8Array(6); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2, '0')).join(''); } catch (e) { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); } };
  const sw = (id, on) => `<label class="aw-switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span class="aw-slider"></span></label>`;
  function freqHTML(id, v) {
    const S = H.styles, num = S.inp.replace('width:100%;', 'width:64px;') + ' text-align:center;';
    return `<div><label style="${S.lbl}" for="${id}">Frequency</label><div style="display:flex; align-items:center; gap:7px; font-size:13px; color:var(--muted);">1 in <input id="${id}" type="number" min="3" max="200" value="${v}" style="${num}"> tiles</div></div>`;
  }
  function sizeHTML(id, v) {
    const S = H.styles;
    return `<div><label style="${S.lbl}" for="${id}">Size</label><select id="${id}" style="${S.inp} width:auto; min-width:170px;">${SIZES.map(([k, t]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
  }
  function imageItemHTML(w, i) {
    const S = H.styles;
    return `<div class="wx-item" data-wid="${esc(w.id)}">
      <div class="aw-opts" style="margin-top:0;">
        <div style="flex:1; min-width:180px;"><label style="${S.lbl}" for="w-img-name-${esc(w.id)}">Name</label><input id="w-img-name-${esc(w.id)}" data-wx="name" type="text" maxlength="40" placeholder="My pictures" value="${esc(w.name)}" style="${S.inp}"></div>
        ${freqHTML('w-img-every-' + w.id, w.every).replace('<input ', '<input data-wx="every" ')}
        ${sizeHTML('w-img-size-' + w.id, w.size).replace('<select ', '<select data-wx="size" ')}
        <div><label style="${S.lbl}" for="w-img-fit-${esc(w.id)}">Picture</label><select id="w-img-fit-${esc(w.id)}" data-wx="fit" style="${S.inp} width:auto; min-width:200px;">${FITS.map(([k, t]) => `<option value="${k}" ${k === w.fit ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      </div>
      <div class="wx-row">
        <button type="button" class="btn-tiny" data-wx="pick">${w.n ? 'Choose other pictures' : 'Choose pictures'}</button>
        <span class="wx-count" data-wx="count">${w.n ? w.n + (w.n === 1 ? ' picture' : ' pictures') : 'No pictures yet'}</span>
        <button type="button" class="btn-tiny" data-wx="remove" style="margin-left:auto;">Remove this tile</button>
        <input type="file" accept="image/*" multiple data-wx="file" hidden tabindex="-1" aria-hidden="true">
      </div>
    </div>`;
  }
  function imageOptsHTML(cfg) {
    const list = cfg.image.list;
    return `<p class="wx-note">Your own pictures, in a tile among the others. Pick one picture or a group: each tile shows only its own, one after another. You can make more than one tile.</p>
      <p class="wx-note"><strong style="color:var(--text);">Your pictures stay on this device.</strong> They are made smaller and kept in this browser only: never uploaded, never shared with your other devices. Removing a tile removes its pictures. In a private window they are gone when the window closes.</p>
      <p class="wx-warn" data-wx="nostore" hidden>This browser is not keeping pictures (a private window, or storage turned off), so Image tiles cannot show any here. Everything else works as normal.</p>
      <div class="wx-list">${list.map(imageItemHTML).join('')}</div>
      <div class="wx-row"><button type="button" class="btn-tiny" data-wx="add"${list.length >= 20 ? ' disabled' : ''}>${list.length ? 'Add another Image tile' : 'Add an Image tile'}</button><span class="wx-count" data-wx="status" aria-live="polite"></span></div>`;
  }
  function playOptsHTML(cfg) {
    const p = cfg.playtime;
    return `<div class="aw-opts">${freqHTML('w-playtime-every', p.every)}${sizeHTML('w-playtime-size', p.size)}</div>
      <p class="wx-note">The games you pick, three at a time, each with its logo or box and how long you have played it. Press one to open it. Play time counts play in this browser only (sessions of 30 seconds or more), so play on another device or browser is not in it.</p>
      <div style="margin-top:12px;"><label style="${H.styles.lbl}">Your games</label>
        <div class="wx-chips" data-wx="chips"></div>
        <input type="text" data-wx="find" id="w-playtime-find" placeholder="Find a game…" autocomplete="off" style="${H.styles.inp} margin-top:10px;" aria-label="Find a game to add">
        <div class="wx-results" data-wx="results" role="group" aria-label="Games to add"></div>
      </div>`;
  }
  function settingsHTML(cfgAll) {
    const cfg = readCfg(cfgAll);
    return `
          <div class="aw-card" id="w-image-card">
            <div class="aw-head"><span class="aw-name">Image</span>${sw('w-image-on', cfg.image.on)}</div>
            <div id="w-image-opts" ${cfg.image.on ? '' : 'style="display:none"'}>${imageOptsHTML(cfg)}</div>
          </div>
          <div class="aw-card" id="w-playtime-card">
            <div class="aw-head"><span class="aw-name">Play Time</span>${sw('w-playtime-on', cfg.playtime.on)}</div>
            <div id="w-playtime-opts" ${cfg.playtime.on ? '' : 'style="display:none"'}>${playOptsHTML(cfg)}</div>
          </div>`;
  }
  /* The stored record, changed and saved through emby.js (saveWidgetCfg), which redraws the wall. */
  const cur = () => readCfg(H.raw());
  function saveImage(patch) { H.save({ image: Object.assign({}, cur().image, patch) }); }
  function saveImageItem(id, patch) { const c = cur(); saveImage({ list: c.image.list.map(w => w.id === id ? Object.assign({}, w, patch) : w) }); }
  function savePlay(patch) { H.save({ playtime: Object.assign({}, cur().playtime, patch) }); }

  function wire(root) {
    ensureStyles();
    const imgCard = root.querySelector('#w-image-card'), ptCard = root.querySelector('#w-playtime-card');
    if (imgCard) wireImage(imgCard);
    if (ptCard) wirePlay(ptCard);
  }
  function wireImage(card) {
    const on = card.querySelector('#w-image-on'), opts = card.querySelector('#w-image-opts');
    const status = t => { const s = opts.querySelector('[data-wx="status"]'); if (s) s.textContent = t || ''; };
    const showStore = () => storeWorks().then(ok => { const w = opts.querySelector('[data-wx="nostore"]'); if (w) w.hidden = ok; });
    const redraw = (msg) => { opts.innerHTML = imageOptsHTML(cur()); showStore(); if (msg) status(msg); };
    on.addEventListener('change', () => {
      opts.style.display = on.checked ? '' : 'none';
      const c = cur();
      /* The first time it is switched on, one empty tile is ready to fill. */
      if (on.checked && !c.image.list.length) { saveImage({ on: true, list: [{ id: newId(), name: '', every: 30, size: '1', n: 0, fit: 'fit' }] }); redraw(); }
      else saveImage({ on: on.checked });
    });
    showStore();
    opts.addEventListener('click', async e => {
      const b = e.target.closest('button[data-wx]'); if (!b) return;
      const item = b.closest('.wx-item'), id = item && item.dataset.wid, act = b.dataset.wx;
      if (act === 'add') {
        const c = cur(); if (c.image.list.length >= 20) return;
        const nid = newId();
        saveImage({ list: c.image.list.concat({ id: nid, name: '', every: 30, size: '1', n: 0, fit: 'fit' }) });
        redraw();
        const p = opts.querySelector('.wx-item[data-wid="' + nid + '"] [data-wx="pick"]'); if (p) p.focus();
      } else if (act === 'pick' && item) {
        const f = item.querySelector('input[data-wx="file"]'); if (f) { f.value = ''; f.click(); }
      } else if (act === 'remove' && item) {
        const c = cur(), w = c.image.list.find(x => x.id === id);
        const ok = typeof window.confirmModal === 'function'
          ? await window.confirmModal({ title: 'Remove this Image tile?', body: 'Its ' + (w && w.n ? w.n + (w.n === 1 ? ' picture is' : ' pictures are') : 'pictures are') + ' removed from this browser too.', confirmLabel: 'Remove', cancelLabel: 'Keep' })
          : true;
        if (!ok) return;
        await dropPics(id);
        _urls.forEach((u, key) => { if (key.indexOf(id + ':') === 0) { URL.revokeObjectURL(u); _urls.delete(key); } });
        const rest = cur().image.list.filter(x => x.id !== id);
        saveImage({ list: rest });
        redraw('Tile removed.');
        const a = opts.querySelector('[data-wx="add"]'); if (a) a.focus();
      }
    });
    opts.addEventListener('change', async e => {
      const el = e.target, item = el.closest('.wx-item'), id = item && item.dataset.wid;
      if (!id) return;
      const k = el.dataset.wx;
      if (k === 'every') { const v = clampEvery(el.value, 30); el.value = v; saveImageItem(id, { every: v }); }
      else if (k === 'size') saveImageItem(id, { size: sizeOf(el.value) });
      else if (k === 'fit') saveImageItem(id, { fit: fitOf(el.value) });
      else if (k === 'name') saveImageItem(id, { name: String(el.value || '').trim().slice(0, 40) });
      else if (k === 'file') {
        const files = el.files;
        if (!files || !files.length) return;
        const cnt = item.querySelector('[data-wx="count"]');
        if (cnt) cnt.textContent = 'Making ' + files.length + (files.length === 1 ? ' picture' : ' pictures') + ' smaller…';
        try {
          const n = await storePics(id, files);
          if (!n) { if (cnt) cnt.textContent = 'None of those could be read as pictures.'; return; }
          saveImageItem(id, { n });
          redraw(n + (n === 1 ? ' picture' : ' pictures') + ' kept in this browser.');
        } catch (err) {
          if (cnt) cnt.textContent = 'This browser would not keep the pictures.';
          showStore();
        }
      }
    });
  }
  function wirePlay(card) {
    const on = card.querySelector('#w-playtime-on'), opts = card.querySelector('#w-playtime-opts');
    on.addEventListener('change', () => { opts.style.display = on.checked ? '' : 'none'; savePlay({ on: on.checked }); loadTotals(0).then(m => { tot = m; paint(); }); });
    const every = opts.querySelector('#w-playtime-every'), size = opts.querySelector('#w-playtime-size');
    every.addEventListener('change', () => { const v = clampEvery(every.value, 30); every.value = v; savePlay({ every: v }); });
    size.addEventListener('change', () => savePlay({ size: sizeOf(size.value) }));
    const chips = opts.querySelector('[data-wx="chips"]'), find = opts.querySelector('[data-wx="find"]'), results = opts.querySelector('[data-wx="results"]');
    let tot = new Map();
    const titles = new Map();   // id -> the title the play history saved, for a game whose list has not arrived
    try { if (window.CwPlayHistory) CwPlayHistory.all().then(rows => { for (const r of rows || []) if (r && r.id && r.title) titles.set(r.id, r.title); paint(); }).catch(() => {}); } catch (e) {}
    function paint(keepFocusId) {
      /* The totals as they are now: the card was drawn when the page loaded, and games are played after. */
      loadTotals(10000).then(m => { if (m !== tot) { tot = m; paint(); } });
      const picked = cur().playtime.games;
      /* THE SAVED GAMES SHOW AT ONCE (8 Nov: they appeared only after a search). The card is
         drawn when the page loads, often before the game lists have arrived, and a game not yet known
         had no chip. Until every saved game is known this asks again, and a game still unknown shows
         its name from the play history or a plain placeholder rather than nothing. */
      if (picked.some(id => !devOf(id)) && !paint.__retry && (paint.__tries = (paint.__tries || 0) + 1) < 40) { paint.__retry = setTimeout(() => { paint.__retry = 0; paint(); }, 1500); }
      chips.innerHTML = picked.length ? picked.map(id => { const d = devOf(id), nm = d ? d.name : (titles.get(id) || 'A saved game (loading)'); return `<span class="wx-chip" data-gid="${esc(id)}">${esc(nm)}${systemWord(d) ? ' <span style="color:var(--muted)">' + esc(systemWord(d)) + '</span>' : ''}<button type="button" data-wx="unpick" aria-label="Take ${esc(nm)} off">×</button></span>`; }).join('')
        : '<span class="wx-count">No games picked yet: find one below. Until then the tile is not shown.</span>';
      const q = String(find.value || '').trim().toLowerCase();
      let list = [];
      try {
        const all = typeof ALL_DEVICES !== 'undefined' ? ALL_DEVICES : [];
        if (q.length >= 2) {
          const seen = new Set();
          for (const d of all) {
            if (!d || !d.name || d.pmVariantOf || d.sgbOf || String(d.name).toLowerCase().indexOf(q) < 0) continue;
            const k = d.name + '|' + systemWord(d); if (seen.has(k)) continue; seen.add(k);
            list.push(d); if (list.length >= 30) break;
          }
        } else {
          /* No search yet: the games played most in this browser. */
          list = [...tot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id]) => devOf(id)).filter(Boolean);
        }
      } catch (e) {}
      results.innerHTML = list.length ? list.map(d => {
        const p = picked.includes(d.id), ms = tot.get(d.id) || 0;
        return `<button type="button" class="wx-pick" data-wx="pick" data-gid="${esc(d.id)}" aria-pressed="${p}"><span>${esc(d.name)}${systemWord(d) ? ' · ' + esc(systemWord(d)) : ''}${versionOf(d.id) ? ' · ' + esc(versionOf(d.id)) : ''}</span><span>${p ? 'Picked' : ms ? esc(playText(ms)) : 'Not played here'}</span></button>`;
      }).join('') : `<span class="wx-count">${q.length >= 2 ? 'No game by that name.' : 'Type two letters or more to find a game.'}</span>`;
      if (keepFocusId) { const b = opts.querySelector('[data-gid="' + keepFocusId + '"] button, button[data-gid="' + keepFocusId + '"]'); if (b) b.focus(); }
    }
    paint();
    find.addEventListener('input', () => paint());
    find.addEventListener('focus', () => loadTotals(10000).then(m => { if (m !== tot) { tot = m; paint(); } }));
    opts.addEventListener('click', e => {
      const b = e.target.closest('button[data-wx]'); if (!b) return;
      const picked = cur().playtime.games.slice();
      if (b.dataset.wx === 'pick') {
        const id = b.dataset.gid, i = picked.indexOf(id);
        if (i >= 0) picked.splice(i, 1); else if (picked.length < 60) picked.push(id);
        savePlay({ games: picked }); paint(id);
      } else if (b.dataset.wx === 'unpick') {
        const id = b.closest('[data-gid]').dataset.gid;
        savePlay({ games: picked.filter(x => x !== id) }); paint();
        find.focus();
      }
    });
  }

  window.CwWidgetsExtra = {
    attach(h) { H = h; },
    readCfg, defs, reseed, tileHTML, allTilesHTML, mount, settingsHTML, wire,
    totalsNow, loadTotals, playText,
  };
})();

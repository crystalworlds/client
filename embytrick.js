/*
 * embytrick.js -- the player's seek bar, with preview thumbnails (trickplay)
 * and chapters (2026-10-04).
 *
 * WHY A SEEK BAR OF OUR OWN. The player is a plain <video controls>; the
 * browser's own timeline cannot draw anything over itself and is not reachable
 * from a remote. This bar sits INSIDE the player's one control bar (subs.js,
 * since the player fixes of 2026-10-04), above its buttons, and hides with it, and is a real slider: a mouse can hover or drag
 * it, a finger can drag it, and a remote can scrub it with Left/Right.
 *
 * PREVIEW THUMBNAILS. Emby makes them when the library option "Generate video
 * preview thumbnails" (Library -> Manage library -> the library's options) is
 * on, and serves them as one Roku-style BIF file per title:
 *   GET /Videos/{Id}/index.bif?Width=320&MediaSourceId=...   (Width is required)
 *   (Emby REST reference, BifService: https://betadev.emby.media/reference/RestAPI/BifService.html,
 *    getVideosByIdIndexBif; the sibling GET /Items/{Id}/ThumbnailSet?Width= lists
 *    the frames.) 320 is the width Emby's own apps ask for.
 * BIF layout: 8-byte magic 89 42 49 46 0D 0A 1A 0A, u32 version, u32 frame
 * count, u32 frame interval in ms (0 means 1000), reserved to byte 64, then
 * (u32 timestamp, u32 byte offset) pairs ending with timestamp 0xFFFFFFFF, then
 * the JPEG frames back to back. Read once per title; each frame becomes a
 * blob: URL only when it is first shown; all are revoked when the player closes.
 * No BIF (the option is off, the file is still being made, any error): no
 * picture, the time label alone -- nothing is shown as broken.
 *
 * CHAPTERS. Item.Chapters (Name, StartPositionTicks, ImageTag). Real chapters
 * only: the IntroStart/IntroEnd/CreditsStart markers Emby keeps in the same
 * list are not chapters. Each gets a tick on the bar, its name in the preview
 * bubble, and a row in the Chapters panel with its image from
 *   GET /Items/{Id}/Images/Chapter/{ChapterIndex}?tag={ImageTag}
 * (ImageService: /Items/{Id}/Images/{Type}/{Index}). A chapter without an
 * ImageTag gets the BIF frame at its start, else a frame grabbed in the page
 * from a hidden muted second <video> (direct play only), else a plain time --
 * see "CHAPTER PICTURES" below.
 *
 * REMOTE. With focus free (the picture), Left/Right start a scrub straight
 * away: the bar comes up focused with the thumbnail, every press moves 10 s
 * (held: 30 s, then 60 s), Enter/OK seeks there, and stopping for 1.2 s seeks
 * too. Escape/Back drops the scrub. Up from the subtitle bar reaches this bar;
 * Down from it goes back to the subtitle bar; Up from it opens Chapters when
 * the title has any. The Chapters panel: Up/Down to move, Enter/OK to jump,
 * Back to close.
 *
 * SOUND. None. Thumbnails are images.
 *
 * HOOKS. Registers in window.GnwPlayerAddons (see emby.js, "PLAYER ADD-ONS").
 * Time and seeking go through window.Emby.player.time()/seek(), which a play
 * path with a shifted clock (a server transcode) overrides once, so this bar
 * follows it.
 */
(function () {
  'use strict';

  const BUILD = '20261103-p3a';
  const BIF_WIDTH = 320;
  const MAGIC = [0x89, 0x42, 0x49, 0x46, 0x0d, 0x0a, 0x1a, 0x0a];

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isTV = () => document.body.classList.contains('gnw-tv');
  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0');
  }

  /* ----------------------------------------------------------------- BIF */

  function parseBif(buf) {
    const u8 = new Uint8Array(buf);
    if (u8.length < 72) return null;
    for (let i = 0; i < 8; i++) if (u8[i] !== MAGIC[i]) return null;
    const dv = new DataView(buf);
    const count = dv.getUint32(12, true);
    let interval = dv.getUint32(16, true) || 1000;
    const frames = [];
    for (let i = 0, o = 64; o + 8 <= u8.length && i <= count; i++, o += 8) {
      const ts = dv.getUint32(o, true), off = dv.getUint32(o + 4, true);
      if (ts === 0xffffffff) { if (frames.length) frames[frames.length - 1].end = off; break; }
      if (frames.length) frames[frames.length - 1].end = off;
      frames.push({ t: ts * interval / 1000, off, end: 0 });
    }
    const good = frames.filter(f => f.end > f.off && f.end <= u8.length);
    if (!good.length) return null;
    return { blob: new Blob([buf]), frames: good, interval: interval / 1000 };
  }
  function bifIndexAt(bif, t) {
    const f = bif.frames;
    let lo = 0, hi = f.length - 1;
    if (t <= f[0].t) return 0;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (f[mid].t <= t) lo = mid; else hi = mid - 1; }
    return lo;
  }
  function bifUrl(L, i) {
    const f = L.bif.frames[i];
    if (f.url) return f.url;
    if (L.bif.sheets) return sheetFrame(L, f);
    f.url = URL.createObjectURL(L.bif.blob.slice(f.off, f.end, 'image/jpeg'));
    return f.url;
  }

  /* ------------------------------------------------- Jellyfin tile sheets */
  /* JELLYFIN (26 Oct). Jellyfin 10.9+ keeps its preview thumbnails as JPEG tile
     sheets, TileWidth x TileHeight thumbnails of Width x Height each, one every Interval ms
     (Emby.player.trickplay() reads the item's Trickplay field). They are made to look like the
     BIF above: the same frames list, so the bubble, the chapter rows and the cleanup work as
     they are. A sheet is fetched when a frame on it is first wanted (and all of them, one by
     one, once playing); a frame is cut from its sheet the first time it is shown. A frame whose
     sheet has not arrived yet shows no picture, as with no thumbnails at all. */
  async function loadTiles(L) {
    const t = await L.P.trickplay(L.item.Id, L.source);
    if (!t || L.dead) return;
    const I = t.info, per = Math.max(1, (I.TileWidth || 1) * (I.TileHeight || 1));
    const count = I.ThumbnailCount, step = (I.Interval || 1000) / 1000;
    if (!(count > 0) || !(I.Width > 0) || !(I.Height > 0)) return;
    const frames = [];
    for (let i = 0; i < count; i++) {
      const k = i % per;
      frames.push({ t: i * step, sheet: Math.floor(i / per), x: (k % I.TileWidth) * I.Width, y: Math.floor(k / I.TileWidth) * I.Height, w: I.Width, h: I.Height });
    }
    L.bif = { frames, interval: step, sheets: [], sheetUrl: t.sheetUrl, wanted: new Set() };
    if (L.panel && !L.panel.hidden) renderPanel(L);
    // Then the sheets in order, quietly, so scrubbing anywhere has its picture: after the
    // film's own start, so they never compete with its first seconds.
    const n = Math.ceil(count / per);
    // Not before the film is playing, then 3 s more (a slow start never shares the line with them).
    while (!L.dead && (L.v.paused || L.v.readyState < 3 || L.v.classList.contains('prepping')) && !(L.panel && !L.panel.hidden)) await new Promise(r => setTimeout(r, 500));
    await new Promise(r => setTimeout(r, 3000));
    for (let s = 0; s < n && !L.dead; s++) { try { await needSheet(L, s); } catch {} }
  }
  function needSheet(L, s) {
    const B = L.bif;
    if (!B.sheets[s]) {
      B.sheets[s] = (async () => {
        const res = await fetch(B.sheetUrl(s), { headers: L.P.authHeaders() });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const blob = await res.blob();
        const img = await createImageBitmap(blob);
        if (L.dead) { try { img.close(); } catch {} return null; }
        B.ready = B.ready || {};
        B.ready[s] = img;
        if (L._pt != null && L.bubble && !L.bubble.hidden) { try { preview(L, L._pt); } catch {} }
        if (L.panel && !L.panel.hidden && B.wanted.size) renderPanel(L);
        return img;
      })();
      B.sheets[s].catch(() => {});
    }
    return B.sheets[s];
  }
  function sheetFrame(L, f) {
    const B = L.bif, img = B.ready && B.ready[f.sheet];
    if (!img) { B.wanted.add(f.sheet); needSheet(L, f.sheet); return null; }
    const c = document.createElement('canvas');
    c.width = f.w; c.height = f.h;
    c.getContext('2d').drawImage(img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    try { f.url = c.toDataURL('image/jpeg', 0.85); } catch { return null; }
    return f.url;
  }

  /* ------------------------------------------------------------- chapters */

  function realChapters(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    list.forEach((c, i) => {
      if (!c || typeof c.StartPositionTicks !== 'number') return;
      if (c.MarkerType && c.MarkerType !== 'Chapter') return;
      out.push({ name: c.Name || '', t: c.StartPositionTicks / 1e7, tag: c.ImageTag || null, index: (c.ChapterIndex != null ? c.ChapterIndex : i) });
    });
    out.sort((a, b) => a.t - b.t);
    out.forEach((c, i) => { if (!c.name) c.name = 'Chapter ' + (i + 1); });
    return out;
  }
  function chapterAt(L, t) {
    let c = null;
    for (const x of L.chapters) { if (x.t <= t + 0.01) c = x; else break; }
    return c;
  }

  /* --------------------------------------------------------------- styles */

  function ensureStyles() {
    if (document.getElementById('gnw-trick-styles')) return;
    const s = document.createElement('style');
    s.id = 'gnw-trick-styles';
    s.textContent = `
      #video-player-overlay .gtr-wrap { position:absolute; z-index:4; left:clamp(20px,4vw,56px); right:clamp(20px,4vw,56px);
        bottom:calc(clamp(58px,8.5vh,96px) + 60px); display:flex; align-items:center; gap:12px; color:var(--text,#e7ecf2);
        font-size:13px; transition:opacity .25s ease; }
      #video-player-overlay .gtr-wrap.gtr-quiet { opacity:0; pointer-events:none; }
      #video-player-overlay .gtr-wrap[hidden] { display:none; }
      #video-player-overlay .gtr-time { font-variant-numeric:tabular-nums; font-weight:700; min-width:4.6em; text-align:center;
        text-shadow:0 1px 4px rgba(0,0,0,.8); }
      #video-player-overlay .gtr-track { position:relative; flex:1; height:30px; cursor:pointer; touch-action:none; outline:none; border-radius:8px; }
      #video-player-overlay .gtr-rail { position:absolute; left:0; right:0; top:50%; height:6px; margin-top:-3px; border-radius:6px;
        background:rgba(255,255,255,.22); box-shadow:0 1px 6px rgba(0,0,0,.5); overflow:hidden; }
      #video-player-overlay .gtr-buf { position:absolute; left:0; top:0; bottom:0; background:rgba(255,255,255,.18); }
      #video-player-overlay .gtr-fill { position:absolute; left:0; top:0; bottom:0; background:var(--accent,#9be15d); }
      #video-player-overlay .gtr-tick { position:absolute; top:50%; width:3px; height:12px; margin:-6px 0 0 -1.5px; border-radius:2px;
        background:rgba(255,255,255,.85); box-shadow:0 0 3px rgba(0,0,0,.8); pointer-events:none; }
      #video-player-overlay .gtr-knob { position:absolute; top:50%; width:16px; height:16px; margin:-8px 0 0 -8px; border-radius:50%;
        background:#fff; box-shadow:0 1px 6px rgba(0,0,0,.6); pointer-events:none; }
      #video-player-overlay .gtr-knob.gtr-pending { background:var(--accent,#9be15d); }
      #video-player-overlay .gtr-track:focus-visible .gtr-rail { outline:var(--focus-width,3px) solid var(--focus-ring,#5dc8f0); outline-offset:4px; }
      #video-player-overlay .gtr-track:focus-visible .gtr-knob { width:22px; height:22px; margin:-11px 0 0 -11px; }
      #video-player-overlay .gtr-bubble { position:absolute; bottom:calc(100% + 6px); transform:translateX(-50%); display:flex; flex-direction:column;
        align-items:center; gap:4px; pointer-events:none; }
      #video-player-overlay .gtr-bubble[hidden] { display:none; }
      #video-player-overlay .gtr-thumb { display:block; width:240px; aspect-ratio:16/9; object-fit:cover; border-radius:8px; border:2px solid rgba(255,255,255,.85);
        background:#000; box-shadow:0 12px 34px rgba(0,0,0,.6); }
      #video-player-overlay .gtr-thumb[hidden] { display:none; }
      #video-player-overlay .gtr-btime { font-weight:800; font-variant-numeric:tabular-nums; background:rgba(10,14,20,.86); padding:3px 9px; border-radius:7px; }
      #video-player-overlay .gtr-bname { font-size:12px; color:#dfe5ee; background:rgba(10,14,20,.86); padding:2px 9px; border-radius:7px; max-width:260px;
        overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      #video-player-overlay .gtr-bname:empty { display:none; }
      #video-player-overlay .gtr-chbtn { appearance:none; border:1px solid var(--line,#2a3242); background:rgba(10,14,20,.78); color:var(--text,#e7ecf2);
        font:inherit; font-weight:700; padding:7px 12px; border-radius:10px; cursor:pointer; min-height:36px; display:inline-flex; align-items:center; gap:6px; }
      #video-player-overlay .gtr-chbtn[hidden] { display:none; }
      #video-player-overlay .gtr-chbtn:focus-visible { outline:var(--focus-width,3px) solid var(--focus-ring,#5dc8f0); outline-offset:2px; }
      #video-player-overlay .gtr-chbtn svg { width:17px; height:17px; }
      #video-player-overlay .gtr-panel { position:absolute; z-index:6; right:clamp(20px,4vw,56px); bottom:calc(clamp(58px,8.5vh,96px) + 108px);
        width:min(460px, calc(100% - 40px)); max-height:min(62vh, 560px); overflow:auto; padding:8px; box-sizing:border-box; border-radius:14px;
        background:var(--bg-2,#1a212e); border:1px solid var(--line,#2a3242); box-shadow:0 24px 70px rgba(0,0,0,.6); color:var(--text,#e7ecf2); }
      #video-player-overlay .gtr-panel[hidden] { display:none; }
      #video-player-overlay .gtr-panel h3 { margin:6px 10px 8px; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--muted,#8a94a6); font-weight:700; }
      #video-player-overlay .gtr-row { display:flex; width:100%; align-items:center; gap:12px; appearance:none; border:0; background:none; color:inherit;
        font:inherit; text-align:left; padding:7px 8px; border-radius:10px; cursor:pointer; }
      #video-player-overlay .gtr-row:hover, #video-player-overlay .gtr-row:focus-visible { background:rgba(255,255,255,.06); }
      #video-player-overlay .gtr-row:focus-visible { outline:var(--focus-width,3px) solid var(--focus-ring,#5dc8f0); outline-offset:-3px; }
      #video-player-overlay .gtr-row[aria-current="true"] .gtr-rname { color:var(--accent,#9be15d); }
      #video-player-overlay .gtr-rimg { flex:0 0 auto; width:128px; aspect-ratio:16/9; border-radius:7px; overflow:hidden; background:#0c0f14;
        display:flex; align-items:center; justify-content:center; color:var(--muted,#8a94a6); font-size:12px; }
      #video-player-overlay .gtr-rimg img { width:100%; height:100%; object-fit:cover; display:block; }
      #video-player-overlay .gtr-rmain { display:flex; flex-direction:column; gap:3px; min-width:0; }
      #video-player-overlay .gtr-rname { font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      #video-player-overlay .gtr-rtime { font-size:12px; color:var(--muted,#8a94a6); font-variant-numeric:tabular-nums; }
      body.gnw-tv #video-player-overlay .gtr-wrap { left:max(6vw, env(safe-area-inset-left,0px)); right:max(6vw, env(safe-area-inset-right,0px));
        bottom:calc(max(10vh, env(safe-area-inset-bottom,0px)) + 80px); font-size:16px; }
      body.gnw-tv #video-player-overlay .gtr-track { height:40px; }
      body.gnw-tv #video-player-overlay .gtr-rail { height:8px; margin-top:-4px; }
      body.gnw-tv #video-player-overlay .gtr-thumb { width:320px; }
      body.gnw-tv #video-player-overlay .gtr-chbtn { min-height:48px; padding:10px 16px; }
      body.gnw-tv #video-player-overlay .gtr-panel { right:max(6vw, env(safe-area-inset-right,0px)); bottom:calc(max(10vh, env(safe-area-inset-bottom,0px)) + 140px); font-size:17px; }
      body.gnw-tv #video-player-overlay .gtr-rimg { width:170px; }`;
    document.head.appendChild(s);
  }

  const CH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>';

  /* ------------------------------------------------------------ the live */

  let _live = null;

  function attach(ctx) {
    detach();
    const P = ctx && ctx.player;
    if (!P || !ctx.video || !ctx.stage || !ctx.item || !ctx.item.Id) return;
    ensureStyles();
    const L = { v: ctx.video, stage: ctx.stage, item: ctx.item, source: ctx.source || null, P, dead: false, path: ctx.path || 'direct',
      bif: null, chapters: [], listeners: [], pending: null, dragging: false, hoverT: null, commitTimer: 0, quietTimer: 0,
      lastInput: Date.now(), repeat: 0, raf: 0 };
    _live = L;
    const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); L.listeners.push([el, ev, fn, opt]); };
    L.on = on;
    build(L);
    registerPanel(L);

    // Chapters and the BIF, both optional, both quiet on failure.
    Promise.resolve(P.getChapters(L.item.Id)).catch(() => []).then(list => {
      if (L.dead) return;
      L.chapters = realChapters(list);
      paintTicks(L);
      L.chBtn.hidden = !L.chapters.length;
      L.chaptersReady = true;
      schedulePrefetch(L);
    });
    L.bifDone = loadBif(L).finally(() => { L.bifSettled = true; });
    // Chapter pictures are made while the film plays, not when the panel opens.
    on(L.v, 'playing', () => schedulePrefetch(L));
    on(L.v, 'seeking', () => { if (L.prefetchTimer) { clearTimeout(L.prefetchTimer); L.prefetchTimer = 0; schedulePrefetch(L); } });
    // A start missed above (the picture still hidden, paused, chapters late) is caught here.
    on(L.v, 'timeupdate', () => { if (!L.prefetched && !L.prefetchTimer) schedulePrefetch(L); });

    on(L.v, 'timeupdate', () => paint(L));
    on(L.v, 'durationchange', () => { paintTicks(L); paint(L); });
    on(L.v, 'progress', () => paint(L));
    on(L.v, 'seeked', () => paint(L));
    // Keys: window capture runs before subs.js's document-capture handler.
    on(window, 'keydown', e => onKeyCapture(L, e), true);
    on(L.stage, 'pointermove', () => wake(L));
    on(L.stage, 'pointerdown', () => wake(L));
    // Follow the subtitle bar's show/hide.
    L.mo = new MutationObserver(() => syncQuiet(L));
    const watchBar = () => { const b = L.stage.querySelector('.gsub-bar'); if (b && b !== L.watched) { L.watched = b; L.mo.observe(b, { attributes: true, attributeFilter: ['class', 'hidden'] }); syncQuiet(L); } };
    watchBar();
    L.mo2 = new MutationObserver(watchBar);
    L.mo2.observe(L.stage, { childList: true });
    const tick = () => { if (L.dead) return; syncQuiet(L); L.raf = setTimeout(tick, 500); };
    tick();
    paint(L);
  }

  /* CHAPTER PICTURES AHEAD OF TIME (player fixes, 2026-10-04: "Chapters should
     populate when the movie starts playing, not when I open the menu"; again
     3 Nov: build them ahead of time, and keep building with the menu shut).
     Once playback has run undisturbed for 3 s (no seek since), in idle time:
     the server's chapter images are fetched at low priority into the
     browser's cache, and frames are grabbed for chapters that have no picture,
     one at a time, at the same pace whether the menu is open or shut. The film
     comes first in another way: a grab waits while the film itself is
     buffering or seeking. Nothing is drawn or heard; the panel opens with
     whatever is ready and the rest arrive in it. */
  function schedulePrefetch(L) {
    if (L.dead || L.prefetched || L.prefetchTimer || !L.chaptersReady || !L.chapters.length) return;
    if (L.v.paused || L.v.classList.contains('prepping')) return;
    L.prefetchTimer = setTimeout(async () => {
      L.prefetchTimer = 0;
      if (L.dead || L.prefetched) return;
      if (L.v.paused || L.v.seeking) { schedulePrefetch(L); return; }
      L.prefetched = true;
      await new Promise(r => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 3000 }) : setTimeout(r, 200)));
      if (L.dead) return;
      L.preloaded = [];
      for (const c of L.chapters) {
        if (!c.tag || c.tagFailed) continue;
        const im = new Image();
        try { im.fetchPriority = 'low'; } catch {}
        im.decoding = 'async';
        im.onerror = () => { c.tagFailed = true; if (L.panel && !L.panel.hidden) renderPanel(L); grabMissing(L); };
        im.src = L.P.chapterImageUrl(L.item.Id, c.index, c.tag, isTV() ? 340 : 256);
        L.preloaded.push(im);   // held so the request is not dropped
      }
      try { await L.bifDone; } catch {}
      if (!L.dead) { try { await grabMissing(L, true); } catch {} }
      L.prefetchDone = true;   // (read by the tests)
    }, 3000);
  }

  async function loadBif(L) {
    try {
      const url = L.P.bifUrl(L.item.Id, L.source, BIF_WIDTH);
      if (!url) { if (typeof L.P.trickplay === 'function') await loadTiles(L); return; }
      const res = await fetch(url, { headers: L.P.authHeaders() });
      if (!res.ok || L.dead) return;
      const buf = await res.arrayBuffer();
      if (L.dead) return;
      const bif = parseBif(buf);
      if (bif) { L.bif = bif; if (L.panel && !L.panel.hidden) renderPanel(L); }
    } catch { /* no thumbnails: the bar works without them */ }
  }

  function build(L) {
    const w = document.createElement('div');
    w.className = 'gtr-wrap';
    w.innerHTML = `
      <span class="gtr-time gtr-cur">0:00</span>
      <div class="gtr-track" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0">
        <div class="gtr-rail"><div class="gtr-buf"></div><div class="gtr-fill"></div></div>
        <div class="gtr-ticks"></div>
        <div class="gtr-knob"></div>
        <div class="gtr-bubble" hidden><img class="gtr-thumb" alt="" hidden><span class="gtr-bname"></span><span class="gtr-btime"></span></div>
      </div>
      <span class="gtr-time gtr-dur">0:00</span>
      <button type="button" class="gtr-chbtn" hidden aria-haspopup="dialog">${CH_ICON}<span>Chapters</span></button>`;
    // ONE CONTROL SET (player fixes, 2026-10-04): inside the player's control
    // bar (subs.js) when it is there -- the seek row above its buttons, and
    // Chapters among its buttons -- so the two show and hide as one. Without
    // subs.js it stands on its own as before.
    const row = L.stage.querySelector('.gsub-bar .gsub-seekrow');
    (row || L.stage).appendChild(w);
    L.inBar = !!row;
    L.wrap = w;
    L.track = w.querySelector('.gtr-track');
    L.fill = w.querySelector('.gtr-fill');
    L.buf = w.querySelector('.gtr-buf');
    L.knob = w.querySelector('.gtr-knob');
    L.ticks = w.querySelector('.gtr-ticks');
    L.bubble = w.querySelector('.gtr-bubble');
    L.thumb = w.querySelector('.gtr-thumb');
    L.bname = w.querySelector('.gtr-bname');
    L.btime = w.querySelector('.gtr-btime');
    L.cur = w.querySelector('.gtr-cur');
    L.dur = w.querySelector('.gtr-dur');
    L.chBtn = w.querySelector('.gtr-chbtn');
    const slot = L.inBar && L.stage.querySelector('.gsub-bar .gsub-chslot');
    if (slot) { L.chBtn.classList.add('gsub-btn'); slot.appendChild(L.chBtn); }
    const on = L.on;
    w.addEventListener('click', e => e.stopPropagation());   // never reaches the overlay's click-to-close

    const tAtX = x => { const r = L.track.getBoundingClientRect(); return Math.max(0, Math.min(1, (x - r.left) / (r.width || 1))) * dur(L); };
    on(L.track, 'pointermove', e => { wake(L); if (L.dragging) { L.pending = tAtX(e.clientX); paint(L); } else { L.hoverT = tAtX(e.clientX); preview(L, L.hoverT); } });
    on(L.track, 'pointerleave', () => { L.hoverT = null; if (!L.dragging && L.pending == null) preview(L, null); });
    on(L.track, 'pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      L.dragging = true;
      try { L.track.setPointerCapture(e.pointerId); } catch {}
      L.pending = tAtX(e.clientX);
      paint(L);
    });
    const end = e => {
      if (!L.dragging) return;
      L.dragging = false;
      try { L.track.releasePointerCapture(e.pointerId); } catch {}
      if (e.type === 'pointerup') commit(L); else cancelScrub(L);
    };
    on(L.track, 'pointerup', end);
    on(L.track, 'pointercancel', end);
    on(L.track, 'keydown', e => onTrackKey(L, e));
    on(L.track, 'keyup', () => { L.repeat = 0; });
    on(L.track, 'blur', () => { if (L.pending != null && !L.dragging) commit(L); });
    on(L.chBtn, 'click', e => { e.stopPropagation(); togglePanel(L); });
    on(L.chBtn, 'keydown', e => {
      const k = e.key;
      if (k === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); L.track.focus({ preventScroll: true }); wake(L); }
      else if (k === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); toSubsBar(L); }
      else if (k === 'ArrowUp' || k === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); wake(L); }
      else wake(L);
    });
  }

  const dur = L => L.P.duration() || 0;

  function paint(L) {
    if (L.dead) return;
    const D = dur(L);
    const t = L.P.time();
    const shown = L.pending != null ? L.pending : t;
    const pct = D > 0 ? Math.max(0, Math.min(100, shown / D * 100)) : 0;
    const playPct = D > 0 ? Math.max(0, Math.min(100, t / D * 100)) : 0;
    L.fill.style.width = playPct + '%';
    L.knob.style.left = pct + '%';
    L.knob.classList.toggle('gtr-pending', L.pending != null);
    L.cur.textContent = fmt(shown);
    L.dur.textContent = fmt(D);
    try {
      const b = L.v.buffered;
      if (b && b.length && D > 0) L.buf.style.width = Math.min(100, (b.end(b.length - 1) + (L.P.time() - (L.v.currentTime || 0))) / D * 100) + '%';
    } catch {}
    L.track.setAttribute('aria-valuemax', String(Math.round(D)));
    L.track.setAttribute('aria-valuenow', String(Math.round(shown)));
    L.track.setAttribute('aria-valuetext', fmt(shown) + ' of ' + fmt(D));
    if (L.pending != null) preview(L, L.pending);
  }

  function paintTicks(L) {
    const D = dur(L);
    if (!D || !L.chapters.length) { L.ticks.innerHTML = ''; return; }
    L.ticks.innerHTML = L.chapters.filter(c => c.t > 0.5 && c.t < D - 0.5)
      .map(c => `<span class="gtr-tick" style="left:${(c.t / D * 100).toFixed(3)}%" title="${esc(c.name)}"></span>`).join('');
  }

  function preview(L, t) {
    if (t == null) { L.bubble.hidden = true; return; }
    L._pt = t;   // the time shown, for a tile sheet that arrives while it is up
    const D = dur(L);
    L.bubble.hidden = false;
    L.bubble.style.left = (D > 0 ? Math.max(0, Math.min(100, t / D * 100)) : 0) + '%';
    // Keep the bubble on screen near the ends.
    const tr = L.track.getBoundingClientRect();
    const half = (L.thumb.hidden ? 60 : (isTV() ? 162 : 122));
    const x = tr.width * (D > 0 ? t / D : 0);
    const clamped = Math.max(half - 8, Math.min(tr.width - half + 8, x));
    L.bubble.style.left = clamped + 'px';
    L.btime.textContent = fmt(t);
    const ch = chapterAt(L, t);
    L.bname.textContent = ch ? ch.name : '';
    const u = L.bif ? bifUrl(L, bifIndexAt(L.bif, t)) : null;
    if (u) {
      if (L.thumb.getAttribute('src') !== u) L.thumb.src = u;
      L.thumb.hidden = false;
    } else L.thumb.hidden = true;
  }

  function seekTo(L, t) {
    const D = dur(L);
    const tt = Math.max(0, D > 0 ? Math.min(D - 0.5, t) : t);
    try { L.P.seek(tt); } catch {}
  }
  function commit(L) {
    clearTimeout(L.commitTimer);
    if (L.pending == null) return;
    const t = L.pending;
    L.pending = null;
    seekTo(L, t);
    if (L.hoverT == null) preview(L, null);
    paint(L);
  }
  function cancelScrub(L) {
    clearTimeout(L.commitTimer);
    L.pending = null;
    preview(L, null);
    paint(L);
  }

  /* ---- keys ---- */

  function stepFor(n) { return n >= 16 ? 60 : n >= 6 ? 30 : 10; }
  function scrubBy(L, dir, repeat) {
    const D = dur(L);
    const from = L.pending != null ? L.pending : L.P.time();
    L.pending = Math.max(0, D > 0 ? Math.min(D - 0.5, from + dir * stepFor(repeat)) : from + dir * stepFor(repeat));
    paint(L);
    clearTimeout(L.commitTimer);
    L.commitTimer = setTimeout(() => commit(L), 1200);
  }

  function onTrackKey(L, e) {
    const k = e.key;
    wake(L);
    if (k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault(); e.stopPropagation();
      L.repeat = e.repeat ? L.repeat + 1 : 0;
      scrubBy(L, k === 'ArrowRight' ? 1 : -1, L.repeat);
      return;
    }
    if (k === 'Enter' || e.keyCode === 13 || k === ' ') {
      e.preventDefault(); e.stopPropagation();
      if (L.pending != null) commit(L);
      else { if (L.v.paused) { const p = L.v.play(); if (p && p.catch) p.catch(() => {}); } else L.v.pause(); }
      return;
    }
    if (k === 'Escape' || k === 'Backspace' || k === 'GoBack' || k === 'BrowserBack') {
      if (L.pending != null) { e.preventDefault(); e.stopPropagation(); cancelScrub(L); return; }
      e.preventDefault(); e.stopPropagation();
      try { L.v.focus({ preventScroll: true }); } catch {}
      return;
    }
    if (k === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); if (L.pending != null) commit(L); toSubsBar(L); return; }
    if (k === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation();
      if (L.pending != null) commit(L);
      if (L.chapters.length) openPanel(L);
      return;
    }
    if (k === 'Home' || k === 'End') {
      e.preventDefault(); e.stopPropagation();
      L.pending = k === 'Home' ? 0 : Math.max(0, dur(L) - 1);
      paint(L); clearTimeout(L.commitTimer); L.commitTimer = setTimeout(() => commit(L), 1200);
    }
  }

  function subsLive() {
    try { return window.GnwSubs && window.GnwSubs._internal && window.GnwSubs._internal.live(); } catch { return null; }
  }
  function toSubsBar(L) {
    const S = subsLive();
    if (S && S.bar && !S.bar.hidden) { try { window.GnwSubs._internal.wake(S, true); return; } catch {} }
    try { L.v.focus({ preventScroll: true }); } catch {}
  }

  function playerOpen() {
    const ov = document.getElementById('video-player-overlay');
    return !!(ov && ov.classList.contains('open'));
  }
  /* Window-capture: runs before subs.js's document-capture handler, so the
     two keys this bar owns are taken before subs.js turns them into "show the
     bar". Everything else passes through untouched. */
  function onKeyCapture(L, e) {
    if (L.dead || !playerOpen() || L.wrap.hidden) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const a = document.activeElement;
    const ov = document.getElementById('video-player-overlay');
    const k = e.key;
    // Up from the subtitle bar -> this bar.
    if (k === 'ArrowUp' && a && a.closest && a.closest('.gsub-row')) {
      e.preventDefault(); e.stopImmediatePropagation();
      L.track.focus({ preventScroll: true });
      wake(L);
      return;
    }
    // Left/Right on the bare picture -> start a scrub.
    const free = !a || a === document.body || a === L.v || a === ov || !(ov && ov.contains(a));
    if (free && (k === 'ArrowLeft' || k === 'ArrowRight') && !L.v.classList.contains('prepping') && dur(L) > 0) {
      e.preventDefault(); e.stopImmediatePropagation();
      wakeSubs();
      L.track.focus({ preventScroll: true });
      wake(L);
      L.repeat = 0;
      scrubBy(L, k === 'ArrowRight' ? 1 : -1, 0);
    }
  }

  /* ---- show / hide with the subtitle bar ---- */

  function wakeSubs() { const S = subsLive(); if (S) { try { window.GnwSubs._internal.wake(S, false); } catch {} } }
  function wake(L) {
    L.lastInput = Date.now();
    wakeSubs();
    syncQuiet(L);
  }
  function syncQuiet(L) {
    if (L.dead) return;
    // Inside the control bar, the bar decides when it hides (subs.js); waking
    // it from here on every tick would hold it up for as long as focus sat on
    // the seek bar.
    if (L.inBar) { L.wrap.classList.remove('gtr-quiet'); return; }
    const S = subsLive();
    const ownFocus = L.wrap.contains(document.activeElement) || (L.panel && !L.panel.hidden);
    let quiet;
    if (S && S.bar) quiet = S.bar.hidden || S.bar.classList.contains('gsub-quiet');
    else quiet = !L.v.paused && Date.now() - L.lastInput > 5000;   // no subs.js: our own idle rule
    if (ownFocus || L.dragging || L.pending != null || L.hoverT != null) quiet = false;
    if (L.v.classList.contains('prepping')) quiet = true;
    L.wrap.classList.toggle('gtr-quiet', !!quiet);
    // Keep the subtitle bar up while this bar is in use, so the two move together.
    if (!quiet && S && S.bar && S.bar.classList.contains('gsub-quiet') && (ownFocus || L.dragging || L.pending != null)) wakeSubs();
  }

  /* ---- chapters panel ---- */

  /* The Chapters panel is one of the player's popups (subs.js): it opens just
     above its button, closes on a click or tap outside it, on Escape / Back
     (the panel only, never the player) and when the controls hide, and only
     one popup is open at a time. */
  function subsI() { try { return window.GnwSubs && window.GnwSubs._internal; } catch { return null; } }
  function registerPanel(L) {
    const I = subsI(); if (!I || !I.registerPopup) return;
    I.registerPopup('chapters', {
      isOpen: () => !L.dead && !!L.panel && !L.panel.hidden,
      close: refocus => closePanel(L, !!refocus),
      el: () => L.panel,
      anchor: () => L.chBtn,
    });
  }
  function placePanel(L) {
    const I = subsI();
    if (L.panel && !L.panel.hidden && I && I.placePopup && L.inBar) I.placePopup(L.stage, L.panel, L.chBtn);
  }
  function togglePanel(L) { if (L.panel && !L.panel.hidden) closePanel(L, true); else openPanel(L); }
  function openPanel(L) {
    if (!L.chapters.length) return;
    const I = subsI();
    if (I && I.closePopups) { try { I.closePopups(false); } catch {} }   // one popup at a time
    if (!L.panel) {
      const p = document.createElement('div');
      p.className = 'gtr-panel';
      p.setAttribute('role', 'dialog');
      p.setAttribute('aria-label', 'Chapters');
      p.hidden = true;
      L.stage.appendChild(p);
      L.panel = p;
      p.addEventListener('click', e => e.stopPropagation());
      p.addEventListener('dblclick', e => e.stopPropagation());
      p.addEventListener('keydown', e => {
        const rows = Array.from(p.querySelectorAll('.gtr-row'));
        const i = rows.indexOf(document.activeElement);
        const k = e.key;
        wake(L);
        if (k === 'ArrowDown' || k === 'ArrowUp') {
          e.preventDefault(); e.stopPropagation();
          const n = rows[Math.max(0, Math.min(rows.length - 1, i + (k === 'ArrowDown' ? 1 : -1)))];
          if (n) n.focus({ preventScroll: false });
        } else if (k === 'Escape' || k === 'Backspace' || k === 'GoBack' || k === 'BrowserBack') {
          e.preventDefault(); e.stopPropagation();
          closePanel(L, true);
        } else if (k === 'ArrowLeft' || k === 'ArrowRight') {
          e.preventDefault(); e.stopPropagation();
        }
      });
      if (window.ResizeObserver) { L.panelRo = new ResizeObserver(() => placePanel(L)); L.panelRo.observe(p); }
    }
    renderPanel(L);
    L.panel.hidden = false;
    L.chBtn.setAttribute('aria-expanded', 'true');
    placePanel(L);
    const cur = L.panel.querySelector('.gtr-row[aria-current="true"]') || L.panel.querySelector('.gtr-row');
    if (cur) { try { cur.focus({ preventScroll: true }); cur.scrollIntoView({ block: 'nearest' }); } catch {} }
    wake(L);
    grabMissing(L);   // pictures for chapters that have none, made here (lazily)
  }
  function closePanel(L, refocus) {
    if (!L.panel || L.panel.hidden) return;
    L.panel.hidden = true;
    L.chBtn.setAttribute('aria-expanded', 'false');
    if (refocus) { try { L.chBtn.focus({ preventScroll: true }); } catch {} }
  }

  /* CHAPTER PICTURES, best first (player fixes, 2026-10-04: "Chapters need
     images from the show"):
       1. Emby's own chapter image, when the chapter has an ImageTag
          (GET /Items/{Id}/Images/Chapter/{index}?tag=). The server makes these
          when the library's "Extract chapter images" option is on.
       2. The trickplay (BIF) frame at the chapter's start, when the library's
          "Generate video preview thumbnails" option made one.
       3. Otherwise a frame grabbed here: a second, hidden, muted <video> on the
          same direct stream seeks to each chapter start and the frame is drawn
          to a small canvas. Only on the direct-play path (a remuxed or
          server-converted stream has no plain URL to open twice). One frame at
          a time, in idle time, only once the panel has been opened; kept per
          title for the session. It is never played and never makes a sound.
       4. Failing all three, the chapter's time. */
  const _grabCache = new Map();   // itemId -> Map(chapter time -> data: URL)
  function grabbed(L, c) { const m = _grabCache.get(L.item.Id); return (m && m.get(c.t)) || null; }
  function imgFor(L, c) {
    if (c.tag && !c.tagFailed) return L.P.chapterImageUrl(L.item.Id, c.index, c.tag, isTV() ? 340 : 256);
    if (L.bif) { const u = bifUrl(L, bifIndexAt(L.bif, c.t + 1)); if (u) return u; }
    return grabbed(L, c);
  }
  function rowImgHTML(L, c) {
    const u = imgFor(L, c);
    // Never loading="lazy": a lazy picture in a shut or scrolled menu waits, and stops when it shuts.
    return u ? `<img alt="" decoding="async" src="${esc(u)}">` : esc(fmt(c.t));
  }
  function setRowImg(L, i) {
    if (!L.panel) return;
    const row = L.panel.querySelector(`.gtr-row[data-i="${i}"] .gtr-rimg`);
    if (!row) return;
    row.innerHTML = rowImgHTML(L, L.chapters[i]);
    wireImg(L, row.querySelector('img'), i);
  }
  function wireImg(L, im, i) {
    if (!im) return;
    im.addEventListener('error', () => {
      const c = L.chapters[i];
      if (c.tag && !c.tagFailed) { c.tagFailed = true; setRowImg(L, i); grabMissing(L); return; }   // the server had no picture: next best
      im.parentNode.textContent = fmt(c.t);
    }, { once: true });
  }
  function grabSource(L) {
    if (L.path && L.path !== 'direct') return null;
    const s = L.v.currentSrc || L.v.getAttribute('src') || '';
    return s && !/^blob:/i.test(s) && !/\.m3u8(\?|$)/i.test(s) ? s : null;
  }
  async function grabMissing(L, background) {
    if (L.grabbing || L.dead || L.bif) return;
    const need = L.chapters.map((c, i) => ({ c, i })).filter(x => !(x.c.tag && !x.c.tagFailed) && !grabbed(L, x.c));
    if (!need.length) return;
    const src = grabSource(L);
    if (!src) return;
    L.grabbing = true;
    const gv = document.createElement('video');
    L.grabVideo = gv;
    gv.muted = true; gv.volume = 0; gv.defaultMuted = true; gv.preload = 'auto'; gv.playsInline = true;
    gv.crossOrigin = 'anonymous';   // the frame is read back from a canvas
    gv.setAttribute('aria-hidden', 'true');
    gv.src = src;
    const cv = document.createElement('canvas');
    const g = cv.getContext('2d');
    const wait = (el, ev, ms) => new Promise(res => { const t = setTimeout(() => { el.removeEventListener(ev, f); res(false); }, ms); const f = () => { clearTimeout(t); res(true); }; el.addEventListener(ev, f, { once: true }); });
    const idle = () => new Promise(res => (window.requestIdleCallback ? requestIdleCallback(() => res(), { timeout: 600 }) : setTimeout(res, 60)));
    let cache = _grabCache.get(L.item.Id);
    if (!cache) { cache = new Map(); _grabCache.set(L.item.Id, cache); }
    try {
      if (gv.readyState < 1 && !(await wait(gv, 'loadedmetadata', 15000))) return;
      const W = isTV() ? 340 : 256, H = Math.round(W * 9 / 16);
      cv.width = W; cv.height = H;
      for (const { c, i } of need) {
        if (L.dead || L.grabVideo !== gv) return;
        await idle();
        // Same pace with the menu open or shut (3 Nov). The film comes first: while it is
        // buffering or seeking, wait (up to 8 s), then a short gap between frames.
        for (let w = 0; w < 16 && !L.dead && !L.v.paused && (L.v.seeking || L.v.readyState < 3); w++) await new Promise(r => setTimeout(r, 500));
        if (background) await new Promise(r => setTimeout(r, 250));
        if (L.dead || L.grabVideo !== gv) return;
        const at = Math.min(Math.max(0, c.t + 1), Math.max(0, (gv.duration || c.t + 1) - 0.5));
        gv.currentTime = at;
        if (!(await wait(gv, 'seeked', 10000))) continue;
        if (gv.requestVideoFrameCallback) await Promise.race([new Promise(r => gv.requestVideoFrameCallback(() => r())), new Promise(r => setTimeout(r, 400))]);
        if (L.dead || !gv.videoWidth) continue;
        const k = Math.min(W / gv.videoWidth, H / gv.videoHeight);
        const dw = gv.videoWidth * k, dh = gv.videoHeight * k;
        g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
        g.drawImage(gv, (W - dw) / 2, (H - dh) / 2, dw, dh);
        let url;
        try { url = cv.toDataURL('image/jpeg', 0.72); } catch { return; }   // a stream without CORS taints the canvas: stop, times stay
        cache.set(c.t, url);
        setRowImg(L, i);
      }
    } finally {
      L.grabbing = false;
      if (L.grabVideo === gv) L.grabVideo = null;
      try { gv.removeAttribute('src'); gv.load(); } catch {}
    }
  }

  function renderPanel(L) {
    const now = chapterAt(L, L.P.time());
    const rows = L.chapters.map((c, i) => `<button type="button" class="gtr-row" data-i="${i}" ${c === now ? 'aria-current="true"' : ''}>
        <span class="gtr-rimg">${rowImgHTML(L, c)}</span>
        <span class="gtr-rmain"><span class="gtr-rname">${esc(c.name)}</span><span class="gtr-rtime">${esc(fmt(c.t))}</span></span></button>`).join('');
    L.panel.innerHTML = `<h3>Chapters</h3>${rows}`;
    L.panel.querySelectorAll('.gtr-row').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const c = L.chapters[+b.dataset.i];
      closePanel(L, false);
      seekTo(L, c.t);
      try { L.track.focus({ preventScroll: true }); } catch {}
      paint(L);
    }));
    L.panel.querySelectorAll('.gtr-rimg img').forEach(im => wireImg(L, im, +im.closest('.gtr-row').dataset.i));
  }

  function detach() {
    const L = _live; if (!L) return;
    _live = null;
    L.dead = true;
    clearTimeout(L.commitTimer); clearTimeout(L.raf); clearTimeout(L.prefetchTimer);
    if (L.preloaded) for (const im of L.preloaded) { try { im.onerror = null; im.src = ''; } catch {} }
    for (const [el, ev, fn, opt] of L.listeners) { try { el.removeEventListener(ev, fn, opt); } catch {} }
    try { L.mo.disconnect(); L.mo2.disconnect(); } catch {}
    try { L.panelRo && L.panelRo.disconnect(); } catch {}
    const I = subsI(); if (I && I.registerPopup) { try { I.registerPopup('chapters', null); } catch {} }
    if (L.grabVideo) { try { L.grabVideo.removeAttribute('src'); L.grabVideo.load(); } catch {} L.grabVideo = null; }
    try { L.wrap.remove(); } catch {}
    try { L.chBtn.remove(); } catch {}
    try { if (L.panel) L.panel.remove(); } catch {}
    if (L.bif && !L.bif.sheets) for (const f of L.bif.frames) if (f.url) { try { URL.revokeObjectURL(f.url); } catch {} }
    if (L.bif && L.bif.ready) for (const k in L.bif.ready) { try { L.bif.ready[k].close(); } catch {} }
  }

  const api = { BUILD, name: 'trick', attach, detach, parseBif, realChapters, _live: () => _live };
  window.GnwTrick = api;
  (window.GnwPlayerAddons = window.GnwPlayerAddons || []).push(api);
})();

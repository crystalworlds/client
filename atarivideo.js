/* atarivideo.js: RECORDED Atari 2600, 5200, 7800 and Lynx tiles for the grids.
 * ===========================================================================
 *
 * The Atari counterpart of nesvideo.js, in the same shape and for the same
 * reason: a live Atari tile is a whole document (play/atari<machine>/ in an
 * iframe, its own core and pacer), capped at ATARI_MAX_LIVE. A clip costs a
 * video decoder. So a tile that HAS a clip plays it, and no iframe is built.
 *
 * ONE ID SCHEME, FOUR BUCKETS
 * ---------------------------
 * Every Atari grid tile is `.atari-emu[data-atari="<prefix>-x<first 12 hex of
 * the file's sha256>"]` (prefix a2600, a5200, a7800 or alynx; cws.js siteIdFor,
 * index.html ATARI_SYSTEMS). The capture harness (Atari_Capture)
 * names each clip `<that id>.webm`, and each machine has its own R2 bucket
 * (decided 2026-10-15), chosen here by the id's prefix. The drawer stage builds
 * its machine with NO data-atari, so it is never touched here.
 *
 * NO LIST: THE BUCKET IS THE INVENTORY (decided 2026-10-05). A tile asks
 * BASE + '<id>.webm' itself when it comes near the viewport; an upload shows on
 * the next page load. A miss is remembered in memory for this page load only.
 *
 * WHICH CLIP: the capture recorded each variant group's REPRESENTATIVE (flag R
 * in firmware/variants/<machine>.json.gz), so a tile showing any other variant
 * plays its representative's clip -- variants.js repOf, nesvideo.js's rule.
 *
 * A LYNX HELD ON ITS SIDE: the clip of a turned title is recorded portrait,
 * the shape of the turned tile's glass, so it lands upright on it.
 *
 * ALWAYS MUTED (sound only in the play window); the clips have no audio track.
 * SHORT CLIPS HOLD their last frame to the shared two-minute boundary.
 * NO CLIP, OR A CLIP THAT FAILS: the tile goes back to the live sweep
 * (mountAtariTilePreviews), inside ATARI_MAX_LIVE, or keeps its photograph.
 */
(function () {
  'use strict';

  /* The four clip buckets (2026-10-15). Clips at their roots. null = OFF. */
  var BASES = {
    a2600: 'https://pub-b06c91c6666e4da3ae82bd1fa1d3e503.r2.dev/',   // atari2600-clips
    a5200: 'https://pub-91771962e9ff4dc5b2447e994aa567d3.r2.dev/',   // atari5200-clips
    a7800: 'https://pub-c86bedebfec5473681f448fb09f7bec4.r2.dev/',   // atari7800-clips
    alynx: 'https://pub-69281f85c5894f8aa71dd2225e83c8e5.r2.dev/'    // atarilynx-clips
  };
  var SYS = { a2600: 'atari2600', a5200: 'atari5200', a7800: 'atari7800', alynx: 'atarilynx' };
  var ID_RE = /^(a2600|a5200|a7800|alynx)-x([0-9a-f]{12})$/;
  var NEAR_PX = 300;
  var CYCLE_MS = 120000;
  var FULL_SECS = 119;
  var EPOCH = Date.now();
  var MAX_VID = 20;
  var ENABLED = true;
  var MISSING = Object.create(null);
  var _probes = 0, _hits = 0;
  var io = null, bound = false;
  var SEL = '.atari-emu[data-atari]';

  function suppressed(el) {
    try {
      if (window.GNW_TV && (window.GNW_TV.isTV || window.GNW_TV.lowPower)) return true;
      if (el && typeof window._tilePreviewSuppressed === 'function') return !!window._tilePreviewSuppressed(el);
    } catch (e) {}
    return false;
  }

  /* undefined = the grouping table is still loading (claim nothing yet; the
     gnw-variants event re-sweeps), null = not an Atari clip id. */
  function clipId(id) {
    var m = ID_RE.exec(id || '');
    if (!m) return null;
    var V = window.Variants;
    if (!V || typeof V.repOf !== 'function') return id;
    var r;
    try { r = V.repOf(SYS[m[1]], id); } catch (e) { r = null; }
    if (r === undefined) return undefined;
    return r ? m[1] + '-x' + String(r).slice(0, 12) : id;
  }
  function urlFor(id) {
    var m = ID_RE.exec(id || '');
    var base = m && BASES[m[1]];
    if (!base) return null;
    var c = clipId(id);
    return (c && !MISSING[c]) ? base + c + '.webm' : null;
  }

  /* Asked by index.html's live sweep BEFORE it builds an iframe. */
  function claims(id, wrap) {
    if (!ENABLED) return false;
    if (!urlFor(id)) return false;
    if (suppressed(wrap || null)) return false;
    return true;
  }

  var _remountT = 0;
  function remount() {
    if (_remountT) return;
    _remountT = setTimeout(function () {
      _remountT = 0;
      if (typeof window.mountAtariTilePreviews === 'function') { try { window.mountAtariTilePreviews(); } catch (e) {} }
    }, 120);
  }

  function nearNow(el) {
    if (window._mNear) return window._mNear(el, NEAR_PX);
    var r = el.getBoundingClientRect();
    return r.height > 0 && r.top < (window.innerHeight || 0) + NEAR_PX && r.bottom > -NEAR_PX;
  }
  function _dist(el) {
    /* the card's cached box, not a measurement (2026-10-24; as gbvideo.js) */
    var r = window._mSweepRect ? window._mSweepRect(el) : el.getBoundingClientRect(), vh = window.innerHeight || 0;
    if (r.bottom < 0) return -r.bottom;
    if (r.top > vh) return r.top - vh;
    return 0;
  }

  function held() {
    try { return typeof window.gnwForegroundActive === 'function' && window.gnwForegroundActive(); } catch (e) { return false; }
  }
  function play(v) {
    if (!v || !v.isConnected || held()) return;
    v.muted = true;
    var p;
    try { p = v.play(); } catch (e) { return; }
    if (!p || !p.catch) return;
    p.catch(function () {
      if (!v.isConnected) return;
      v.addEventListener('canplay', function once() {
        v.removeEventListener('canplay', once);
        /* !held(): a play() cut short by the hold's own pause() lands here, and this retry restarted
           the clip behind the window (28 Oct); the hold's release plays it again. */
        if (v.isConnected && v.parentElement && nearNow(v.parentElement) && !held()) {
          v.muted = true;
          try { v.play().catch(function () {}); } catch (e) {}
        }
      });
    });
  }
  function armHold(v) {
    if (v._avHold) { clearTimeout(v._avHold); v._avHold = 0; }
    var since = (Date.now() - EPOCH) % CYCLE_MS;
    v._avHold = setTimeout(function () {
      v._avHold = 0;
      if (!v.isConnected || !v.parentElement || !nearNow(v.parentElement)) return;
      try { v.currentTime = 0; } catch (e) {}
      play(v);
    }, CYCLE_MS - since);
  }
  document.addEventListener('gnw:foreground', function (e) {
    var vids = document.querySelectorAll('video.atari-vid');
    if (e.detail && e.detail.active) {
      Array.prototype.forEach.call(vids, function (v) { if (!v.paused) { v._fgHeld = 1; try { v.pause(); } catch (err) {} } });
      return;
    }
    Array.prototype.forEach.call(vids, function (v) {
      if (!v._fgHeld) return;
      v._fgHeld = 0;
      if (v.isConnected && v.parentElement && nearNow(v.parentElement)) play(v);
    });
    if (bound) sweep();
  });

  function makeVideo() {
    var v = document.createElement('video');
    /* atari-screen is atari-screen.css's class: it puts the clip on the
       measured aperture, under the photograph, where the live iframe sits. */
    v.className = 'atari-screen atari-vid';
    v.muted = true; v.defaultMuted = true; v.playsInline = true;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    v.setAttribute('aria-hidden', 'true'); v.setAttribute('tabindex', '-1');
    v.disablePictureInPicture = true;
    v.preload = 'auto';
    v.addEventListener('volumechange', function () { if (!v.muted) v.muted = true; });
    /* (2 Nov 2026), as nesvideo.js: smooth while drawn smaller than the
       clip's own pixels, square pixels at 1:1 or larger (gbvideo.js fitScale; the
       size is read from each clip, 2600 320x228 ... Lynx 160x102). */
    if (window.GBVIDEO && GBVIDEO.fitScale) GBVIDEO.fitScale(v, 320, 228);
    return v;
  }

  function attach(wrap) {
    if (!ENABLED || held()) return;
    if (document.visibilityState !== 'visible') return;
    if (wrap.querySelector('video.atari-vid')) return;
    var id = wrap.getAttribute('data-atari');
    var src = urlFor(id), clip = src ? clipId(id) : null;
    if (!src || suppressed(wrap)) return;
    /* The Media wall moving fast (2026-10-25; as nesvideo.js) */
    if (fastNow(wrap)) { if (typeof window._tileClipCover === 'function') { try { window._tileClipCover(wrap); } catch (e) {} } return; }
    /* A live iframe already running here is stopped: the clip replaces it. */
    if (typeof window._atariStopTile === 'function') { try { window._atariStopTile(wrap); } catch (e) {} }
    else { var f = wrap.querySelector('iframe.atari-screen'); if (f) f.remove(); }
    var v = makeVideo();
    v.loop = true;
    v.addEventListener('loadedmetadata', function () {
      var d = v.duration;
      if (isFinite(d) && d < FULL_SECS) v.loop = false;
    });
    v.addEventListener('ended', function () { armHold(v); });
    v.addEventListener('loadeddata', function () {
      if (!v._avHit) { v._avHit = 1; _hits++; }
    });
    /* has-vid once a frame has been PAINTED, not at loadeddata, and the tile is kept behind the
       soft blur until then (2026-10-23: the black screen layer showed in between). */
    shownWhenPainted(v, wrap);
    v.addEventListener('error', function () {
      if (v.parentElement !== wrap) return;
      MISSING[clip] = true;
      try { release(wrap); } catch (err) {}
      remount();
    });
    _probes++;
    v.src = src;
    wrap.appendChild(v);
    if (typeof window._tileClipCover === 'function') { try { window._tileClipCover(wrap); } catch (e) {} }
    play(v);
  }

  /* As nesvideo.js: the first presented frame (requestVideoFrameCallback), else loadeddata; 1.5 s
     after playing at the latest, so a stalled decoder never holds a tile. */
  function shownWhenPainted(v, wrap) {
    var done = false;
    var mark = function () { if (done || v.parentElement !== wrap) return; done = true; wrap.classList.add('has-vid'); };
    if (typeof v.requestVideoFrameCallback !== 'function') { v.addEventListener('loadeddata', mark); return; }
    v.requestVideoFrameCallback(mark);
    v.addEventListener('playing', function () { setTimeout(mark, 1500); }, { once: true });
  }

  function release(wrap) {
    var vs = wrap.querySelectorAll('video.atari-vid');
    if (!vs.length) return;
    Array.prototype.forEach.call(vs, function (v) {
      if (v._avHold) { clearTimeout(v._avHold); v._avHold = 0; }
      try { v.pause(); } catch (e) {}
      try { v.removeAttribute('src'); v.load(); } catch (e) {}
      try { v.remove(); } catch (e) {}
    });
    wrap.classList.remove('has-vid');
  }

  function trim() {
    var list = [];
    var all = document.querySelectorAll(SEL + ' > video.atari-vid');
    for (var i = 0; i < all.length; i++) {
      var w = all[i].parentElement;
      if (!w || !w.isConnected) { if (w) release(w); continue; }
      list.push({ w: w, d: 0 });
    }
    if (list.length <= MAX_VID) return;
    /* measured only when over the cap (2026-10-24): most calls are not, and measuring first forced a layout of the wall in every observer callback while scrolling */
    for (var k = 0; k < list.length; k++) list[k].d = _dist(list[k].w);
    list.sort(function (a, b) { return b.d - a.d; });
    for (var j = 0; j < list.length && list.length - j > MAX_VID; j++) {
      if (list[j].d > 0) release(list[j].w);
    }
  }

  function observer() {
    if (io) return io;
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) attach(en.target); });
      trim();
    }, { rootMargin: NEAR_PX + 'px 0px' });
    return io;
  }

  function fastNow(el) {
    try { return !!(window._cwWallFast && window._cwWallFast() && el.closest('#video-grid')); } catch (e) { return false; }
  }
  document.addEventListener('cw-wall-slow', function () { if (bound) sweep(); });

  function sweep() {
    var wraps = document.querySelectorAll(SEL);
    for (var i = 0; i < wraps.length; i++) {
      var w = wraps[i];
      /* a far tile with no clip has nothing to attach or release (2026-10-24) */
      var near = nearNow(w);
      if (!near && !w.querySelector('video.atari-vid')) continue;
      if (!claims(w.getAttribute('data-atari'), w)) { release(w); continue; }
      if (near && w.isConnected) attach(w);
    }
    trim();
  }

  function bindFallback() {
    if (bound) return;
    bound = true;
    var t = 0;
    var recheck = function () {
      if (t) return;
      t = setTimeout(function () { t = 0; sweep(); }, 200);
    };
    window.addEventListener('scroll', recheck, { passive: true });
    window.addEventListener('resize', recheck);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') {
        /* covered while nobody is looking, so the tab comes back with these tiles behind the soft
           blur rather than painting their black screens for a frame before the clips return (2026-10-23) */
        Array.prototype.forEach.call(document.querySelectorAll(SEL + '.has-vid'), function (w) { release(w); if (typeof window._tileClipCover === 'function') { try { window._tileClipCover(w); } catch (e) {} } });
      } else sweep();
    });
  }

  /* Called from index.html's mountAtariTilePreviews(), after every render that
     can produce Atari tiles. Nothing is fetched here: attach() asks, near the
     viewport only. */
  function arm() {
    if (!ENABLED) {
      Array.prototype.forEach.call(document.querySelectorAll(SEL + '.has-vid'), release);
      return;
    }
    bindFallback();
    var wraps = document.querySelectorAll(SEL);
    for (var i = 0; i < wraps.length; i++) {
      if (!claims(wraps[i].getAttribute('data-atari'), wraps[i])) continue;
      observer().observe(wraps[i]);
    }
    sweep();
  }

  function setEnabled(on) {
    ENABLED = !!on;
    if (!ENABLED) {
      Array.prototype.forEach.call(document.querySelectorAll(SEL + '.has-vid'), release);
      remount();
    } else arm();
  }

  function stats() {
    var vids = document.querySelectorAll('video.atari-vid'), playing = 0, unmuted = 0;
    Array.prototype.forEach.call(vids, function (v) { if (!v.paused) playing++; if (!v.muted) unmuted++; });
    return { enabled: ENABLED, bases: BASES, probes: _probes, hits: _hits, missing: Object.keys(MISSING).length,
             attached: vids.length, playing: playing, unmuted: unmuted, cap: MAX_VID, nearPx: NEAR_PX };
  }

  /* Opacity only; geometry is atari-screen.css's. This selector outranks
     index.html's `.atari-emu > .atari-screen { opacity: 0 }`, so a clip shows
     on has-vid and never depends on the live tile's `ready`. */
  function css() {
    if (document.getElementById('atari-vid-css')) return;
    var s = document.createElement('style');
    s.id = 'atari-vid-css';
    s.textContent =
      '.device-card .img .atari-emu > video.atari-screen.atari-vid{opacity:0;transition:opacity .3s ease;pointer-events:none;object-fit:fill;}' +
      '.device-card .img .atari-emu.has-vid > video.atari-screen.atari-vid{opacity:1;}' +
      '.device-card .img.loading .atari-emu > video.atari-screen.atari-vid{transition:none;}';
    (document.head || document.documentElement).appendChild(s);
  }
  css();

  window.addEventListener('gnw-variants', function (e) {
    if (e && e.detail && /^atari/.test(String(e.detail.system || ''))) remount();
  });

  window.ATARIVIDEO = { clipId: clipId, arm: arm, claims: claims, stats: stats, urlFor: urlFor, release: release, trim: trim,
                        missing: function () { return Object.keys(MISSING); }, setEnabled: setEnabled,
                        /* a test knob: point one machine's tiles at another origin before they are armed */
                        setBase: function (prefix, b) { if (prefix in BASES) BASES[prefix] = b || null; },
                        get MAX_VID() { return MAX_VID; },
                        set MAX_VID(v) { MAX_VID = Math.max(0, v | 0); trim(); } };
})();

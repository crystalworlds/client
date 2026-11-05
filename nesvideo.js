/* nesvideo.js — RECORDED NES, Famicom and Disk System tiles for the grids.
 * ===========================================================================
 *
 * The NES counterpart of gbvideo.js, in the same shape and for the same
 * reason: a live NES tile is a whole document (play/nes/index.html in an
 * iframe, its own core, its own pacer), capped at NES_MAX_LIVE because each
 * one costs a 6502 and a PPU on this page's main thread. A clip costs a video
 * decoder. So a tile that HAS a clip plays it, and no iframe is built for it.
 *
 * ONE ID SCHEME FOR THREE CONSOLES
 * --------------------------------
 * The site shows one emulator as three consoles (nes-console.js): the NES, the
 * Famicom and the Disk System. Every one of their grid tiles is
 * `.nes-emu[data-nes="nes-x<first 12 hex of the file's sha256>"]`; the console
 * only chooses the photograph and, through `data-nes-console` on the card, the
 * aperture in nes-screen.css. The clips are named `<that id>.webm` by the
 * capture harness (NES_Capture), so this file needs no hash table
 * and no console logic: the clip lands on whichever aperture the card has.
 * The drawer stage builds its television with NO data-nes, so it is never
 * touched here -- the drawer and the play window stay live and interactive.
 *
 * NO LIST: THE BUCKET IS THE INVENTORY (2026-10-05)
 * --------------------------------------------------------
 * "Uploading the new clips to the R2 bucket should just immediately work on
 * the site." So there is no id list, baked or published, and nothing to
 * regenerate: a tile asks BASE + '<id>.webm' itself, and only when it comes
 * near the viewport (the same 300 px reach as the tile artwork). An upload
 * shows on the next page load; there is no step after the upload.
 * (The 2026-10-04 design gated every claim on a generated nes-clips.json;
 * that was ruled out as the mistake of hard-coding the inventory.)
 *
 * THE PROBE IS THE <video> ITSELF, not a HEAD first. A hit then costs exactly
 * one request -- the media fetch it needed anyway -- where HEAD-then-GET costs
 * two; a miss costs one either way (Chrome's ranged GET of a 404 returns R2's
 * short text body and fires `error`). Every request is the same R2 operation
 * class, so the <video> is the cheapest on the bucket and on the browser.
 * The clip is a plain <video src> with no crossorigin attribute, so CORS does
 * not apply (as for the Game Boy buckets); R2 answers Range with 206.
 *
 * ONE REQUEST PER TILE PER PAGE LOAD. A miss is remembered in MISSING (memory
 * only, never storage), so scrolling back, a re-render, a search or a route
 * change never asks again; a fresh page load asks again, which is how a clip
 * uploaded since shows up. No retry, no console output. While the probe is in
 * flight the tile shows its photograph (no iframe is built for a claimed
 * tile); on a miss it goes back to the live sweep, inside NES_MAX_LIVE.
 *
 * ALWAYS MUTED. Site rule: sound only in the play window. The clips are
 * encoded with no audio track at all, and the element is muted anyway, and
 * re-muted if anything ever unmutes it.
 *
 * SHORT CLIPS HOLD. A STATIC title's clip stops once its screen settles; it
 * plays once, holds its last frame, and restarts on the shared two-minute
 * boundary -- gbvideo.js's rule and its reasoning (a wall of held title
 * screens refreshes together, never blinking tile by tile). The clip's own
 * duration decides it, at loadedmetadata.
 *
 * SUPERSEDED ON TILES 2026-10-12 (decided: tiles play the game clip only; see
 * TILE_BOOT below). The chain described next is kept but switched off.
 * DISK SYSTEM TILES PLAY THE DRIVE'S BOOT FIRST (2026-10-06: "capture
 * the boot screen on FDS games just like we did with the animation of the Game
 * Boy ... as a separate file ... and just play one animation after another").
 * A tile whose card is data-nes-console="fds" (or whose representative sits on
 * the fds shelf) plays nes-fdsboot-<sha12 of the drive firmware>.webm, then its
 * own game clip, which the capture starts where the game itself begins. The
 * boot clip's name is DERIVED, never listed: the sha256 of the firmware this
 * page would hand the play window (__GNW_PACK.fdsBios(), hashed here once),
 * when it is one of the three captured images, else the standard firmware's
 * (Rev 1, 99c18490ed90 -- the one every game clip was recorded with). Two
 * <video>s per tile: the boot one shown, the game one preloading underneath
 * (it is the probe: a game clip that 404s releases the tile exactly as
 * before). A boot clip that 404s is remembered in BOOT_MISSING and the tile
 * plays its game clip alone. After the game clip: a full-length one goes
 * straight back to the boot; a short one holds its last frame to the shared
 * two-minute boundary, then the boot plays again.
 *
 * NO CLIP, OR A CLIP THAT FAILS: today's behaviour. A load error marks the id
 * missing for this page load, releases the video and hands the tile back to the
 * live sweep (mountNesTilePreviews), which gives it a live iframe within its
 * cap or leaves the photograph.
 */
(function () {
  'use strict';

  /* ---- the knobs -------------------------------------------------------- */
  /* The site's R2 bucket, as gbvideo.js's BASE. Clips at its root, named
     '<data-nes id>.webm'. null = OFF (no request, no claim). */
  var BASE = 'https://pub-476344a7e9a34219a007a6563f3a74d3.r2.dev/';   /* nes-clips (was nes-animation, moved 2026-10-17) */
  /* THE DISK SYSTEM'S OWN BUCKET (2026-10-06): every fds-shelf clip and
     the three nes-fdsboot-<sha12>.webm boot clips live here; NES and Famicom
     tiles stay on BASE. Same naming, same no-list rule. */
  var FDS_BASE = 'https://pub-dc08459511ce4d21bffd471892e52459.r2.dev/';   /* fds-clips (was fds-animation, moved 2026-10-17) */
  var ID_RE = /^nes-x[0-9a-f]{12}$/;
  var NEAR_PX = 300;          /* the tile artwork's reach, as gbvideo.js */
  var CYCLE_MS = 120000;      /* the shared two-minute cycle */
  var FULL_SECS = 119;        /* below this a clip is shortened: hold, do not loop */
  var EPOCH = Date.now();
  var MAX_VID = 20;           /* clips kept after scrolling away, as GBVIDEO */

  var ENABLED = true;         /* NESVIDEO.setEnabled(false) -> today's tiles */
  /* TILES PLAY THE GAME CLIP ONLY (2026-10-12: "tiles show the game
     clip only, never the boot clip, for every system"). The Disk System's
     shared boot clip is no longer chained in front of the game clip on a tile;
     the chain (attachFds) is kept, switched off here, for a stitched
     boot-then-game player elsewhere. Starting a game still boots normally:
     that is the play window, which this file never touches. The game clip
     itself is unchanged: same FDS bucket, same <id>.webm, same 404 fallback. */
  var TILE_BOOT = false;
  /* id -> true after a 404/error. Memory only: one request per tile per page
     load, and a page load later a newly uploaded clip is asked for again. */
  var MISSING = Object.create(null);
  var _probes = 0, _hits = 0;
  var io = null, bound = false;

  var SEL = '.nes-emu[data-nes]';

  /* ---- the Disk System's boot clip -------------------------------------- */
  var FDS_BOOT_STANDARD = '99c18490ed90';                 /* Rev 1, the game clips' firmware */
  var FDS_BOOT_KNOWN = { '99c18490ed90': 1, 'fdc1a76e654f': 1, 'a0a9d57cbace': 1 };
  var BOOT_MISSING = Object.create(null);                 /* memory only, like MISSING */
  var _biosKey = null, _biosBusy = null;    /* _biosBusy: the pending hash, a promise */
  /* WHEN THE LAST ASK ANSWERED "NONE" (2026-10-12, fds-freeze). Without it, a
     page whose pack holds no drive firmware (it may come from a game
     server) re-asked at once: attach() waited on the ask, the ask resolved in
     microtasks with nothing, attach() asked again -- a microtask loop that
     never yielded, and an FDS-only Media grid froze the tab for good. A "none"
     now stands for BIOS_REASK_MS; a pack opened later is still seen. */
  var _biosNoneAt = 0, BIOS_REASK_MS = 5000;
  function _hex(buf) {
    var u = new Uint8Array(buf), s = '';
    for (var i = 0; i < u.length; i++) s += (u[i] < 16 ? '0' : '') + u[i].toString(16);
    return s;
  }
  /* The firmware the play window would be handed (index.html _nesFetchFdsBios):
     the open content pack's, hashed here; else a linked game server's, whose
     listing already carries its sha256 (no download). Async, one at a time;
     until it answers, the standard boot clip plays. */
  function askBios() {
    if (_biosKey || _biosBusy) return;
    if (_biosNoneAt && Date.now() - _biosNoneAt < BIOS_REASK_MS) return;
    var P = window.__GNW_PACK;
    var hasPack = !!(P && typeof P.fdsBios === 'function' && window.crypto && crypto.subtle);
    var C = window.CWS;
    if (!hasPack && !(C && typeof C.bootSha256 === 'function')) return;
    /* capped: a pack that never answers must not keep FDS tiles waiting */
    var cap = new Promise(function (r) { setTimeout(r, 1500); });
    _biosBusy = Promise.race([Promise.resolve(hasPack ? P.ready : null), cap]).catch(function () {}).then(function () {
      var b64 = hasPack ? P.fdsBios() : null;
      if (!b64) {
        var sha = null;
        try { sha = C && typeof C.bootSha256 === 'function' && C.available('fds:bios') ? C.bootSha256('fds:bios') : null; } catch (e) {}
        if (sha) _biosKey = String(sha).slice(0, 12);
        return null;
      }
      var s = atob(b64), u = new Uint8Array(s.length);
      for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
      return crypto.subtle.digest('SHA-256', u).then(function (d) { _biosKey = _hex(d).slice(0, 12); });
    }).catch(function () {}).then(function () {
      _biosBusy = null;
      if (!_biosKey) _biosNoneAt = Date.now();
    });
  }
  function bootKey() {
    askBios();
    var k = (_biosKey && FDS_BOOT_KNOWN[_biosKey]) ? _biosKey : FDS_BOOT_STANDARD;
    if (BOOT_MISSING[k] && k !== FDS_BOOT_STANDARD) k = FDS_BOOT_STANDARD;
    return BOOT_MISSING[k] ? null : k;
  }
  function bootUrl() { var k = (BASE && FDS_BASE) ? bootKey() : null; return k ? FDS_BASE + 'nes-fdsboot-' + k + '.webm' : null; }
  /* ON THE FDS SHELF? The grouping table's shelf first (the same row the
     representative fallback reads, so a variant and its representative always
     agree on the bucket), else the card's console. */
  function shelfFds(id, wrap) {
    try {
      var V = window.Variants, r = V && typeof V.repRow === 'function' && id ? V.repRow('nes', id) : null;
      if (r && r.shelf) return r.shelf === 'fds';
    } catch (e) {}
    var c = wrap && wrap.closest ? wrap.closest('[data-nes-console]') : null;
    return !!(c && c.getAttribute('data-nes-console') === 'fds');
  }
  function isFds(wrap) { return shelfFds(wrap && wrap.getAttribute('data-nes'), wrap); }
  function baseFor(id, wrap) { return BASE ? (shelfFds(id, wrap) ? FDS_BASE : BASE) : null; }

  /* ---- the policy ------------------------------------------------------- */
  /* TV and low-power keep the photograph, exactly as gbvideo.js decides, and
     the page's own per-element predicate (twins at rest, etc.) is asked too. */
  function suppressed(el) {
    try {
      if (window.GNW_TV && (window.GNW_TV.isTV || window.GNW_TV.lowPower)) return true;
      if (el && typeof window._tilePreviewSuppressed === 'function') return !!window._tilePreviewSuppressed(el);
    } catch (e) {}
    return false;
  }

  /* WHICH CLIP A TILE PLAYS (2026-10-05). The capture recorded each
     variant group's REPRESENTATIVE only, so a tile showing any other variant
     (the visitor's best copy is Metroid (E), say) plays the representative's
     clip, found in the grouping table variants.js already loads
     (firmware/variants/nes.json.gz, flag R, same shelf). That table is the
     site's grouping data, not a clip inventory: uploads still just work.
     The variant's own id is never asked first -- it would always 404.
     A hash the table does not hold (standalone) uses its own id.
     undefined = the table is still loading: claim nothing yet (the tile keeps
     today's path) and re-sweep when it lands (the gnw-variants event). */
  function clipId(id) {
    if (!id || !ID_RE.test(id)) return null;
    var V = window.Variants;
    if (!V || typeof V.repOf !== 'function') return id;
    var r;
    try { r = V.repOf('nes', id); } catch (e) { r = null; }
    if (r === undefined) return undefined;
    return r ? 'nes-x' + String(r).slice(0, 12) : id;
  }
  function urlFor(id, wrap) {
    var base = baseFor(id, wrap);
    var c = base ? clipId(id) : null;
    return (c && !MISSING[c]) ? base + c + '.webm' : null;
  }

  /* Asked by index.html's live sweep BEFORE it builds an iframe, so a claimed
     tile costs no document and no NES_MAX_LIVE slot. */
  function claims(id, wrap) {
    if (!ENABLED) return false;
    if (!urlFor(id, wrap)) return false;
    if (wrap && suppressed(wrap)) return false;
    if (!wrap && suppressed(null)) return false;
    return true;
  }

  /* A miss hands the tile back to the live sweep. Coalesced: the first view
     of a grid can miss a dozen tiles in the same few milliseconds, and each
     sweep re-observes every NES tile. */
  var _remountT = 0;
  function remount() {
    if (_remountT) return;
    _remountT = setTimeout(function () {
      _remountT = 0;
      if (typeof window.mountNesTilePreviews === 'function') { try { window.mountNesTilePreviews(); } catch (e) {} }
    }, 120);
  }

  /* ---- geometry --------------------------------------------------------- */
  function fastNow(el) {
    try { return !!(window._cwWallFast && window._cwWallFast() && el.closest('#video-grid')); } catch (e) { return false; }
  }
  document.addEventListener('cw-wall-slow', function () { if (bound) sweep(); });
  function nearNow(el) {
    if (window._mNear) return window._mNear(el, NEAR_PX);
    var r = el.getBoundingClientRect();
    return r.height > 0 && r.top < (window.innerHeight || 0) + NEAR_PX && r.bottom > -NEAR_PX;
  }
  function _dist(el) {
    /* the card's cached box, not a measurement (2026-10-24; as gbvideo.js) */
    var r = window._mSweepRect ? window._mSweepRect(el) : el.getBoundingClientRect();
    var vh = window.innerHeight || 0;
    if (r.bottom < 0) return -r.bottom;
    if (r.top > vh) return r.top - vh;
    return 0;
  }

  /* ---- hold on the shared epoch ----------------------------------------- */
  function armHold(v, restart) {
    if (v._nvHold) { clearTimeout(v._nvHold); v._nvHold = 0; }
    var since = (Date.now() - EPOCH) % CYCLE_MS;
    v._nvHold = setTimeout(function () {
      v._nvHold = 0;
      if (!v.isConnected || !v.parentElement) return;
      if (!nearNow(v.parentElement)) return;
      if (restart) { restart(); return; }
      try { v.currentTime = 0; } catch (e) {}
      play(v);
    }, CYCLE_MS - since);
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


  /* FOREGROUND MEDIA (2026-10-04): while a play window or the film player is
     open (index.html's gnwForegroundActive), clips are PAUSED in place, not
     released, so they carry on from the same frame when it closes. Nothing
     attaches or starts in the meantime. */
  function held() {
    try { return typeof window.gnwForegroundActive === 'function' && window.gnwForegroundActive(); } catch (e) { return false; }
  }
  document.addEventListener('gnw:foreground', function (e) {
    var vids = document.querySelectorAll('video.nes-vid');
    if (e.detail.active) {
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

  /* ---- attach / release ------------------------------------------------- */
  function attach(wrap, waited) {
    if (!ENABLED || held()) return;
    if (document.visibilityState !== 'visible') return;
    if (wrap.querySelector('video.nes-vid')) return;
    var id = wrap.getAttribute('data-nes');
    var src = urlFor(id, wrap), clip = src ? clipId(id) : null;
    if (!src || suppressed(wrap)) return;
    /* The Media wall moving fast (2026-10-25; index.html
       _cwFastEnd): no clip yet, the tile keeps its soft blur, and 'cw-wall-slow' sweeps again. */
    if (fastNow(wrap)) { coverTile(wrap); return; }
    /* A live iframe already running here is stopped: the clip replaces it. */
    if (typeof window._nesStopTile === 'function') { try { window._nesStopTile(wrap); } catch (e) {} }
    else { var f = wrap.querySelector('iframe.nes-screen'); if (f) f.remove(); }

    var fds = TILE_BOOT && isFds(wrap);
    if (fds) {
      askBios();
      /* the firmware's hash is being taken (milliseconds): the tile keeps its
         photograph until it answers, so the first boot is already the right one */
      /* waited: this is the retry after that answer, which never waits again,
         so a tile can never chain itself into a loop of asks */
      if (_biosBusy && !waited) { _biosBusy.then(function () { if (wrap.isConnected && nearNow(wrap)) attach(wrap, true); }); return; }
    }
    var v = makeVideo();
    var fdsBoot = fds ? bootUrl() : null;
    if (fdsBoot) { attachFds(wrap, v, src, clip, fdsBoot); return; }
    /* EVERY FRAME FROM 0, NEVER CUT (23 Oct: "we are showing how we emulate, not game play
       video"): a clip is our emulator's own output from power-on, its black and loading screens
       included, so it plays from frame 0 and loops to frame 0. */
    v.loop = true;              /* until the metadata says the clip is short */
    v.addEventListener('loadedmetadata', function () {
      var d = v.duration;
      if (isFinite(d) && d < FULL_SECS) v.loop = false;
    });
    v.addEventListener('ended', function () { armHold(v); });
    v.addEventListener('loadeddata', function () {
      if (!v._nvHit) { v._nvHit = 1; _hits++; }
    });
    /* has-vid (the clip shown, and ?recdebug's tint) only once a real frame has been PAINTED,
       not at loadeddata: while the probe is in flight the tile keeps its photograph, and
       index.html keeps the soft blur over it until then (_tileClipPending). */
    shownWhenPainted(v, wrap);
    v.addEventListener('error', function () {
      /* A 404 (not uploaded yet) or a broken file. Silent, no retry. */
      if (v.parentElement !== wrap) return;   /* released already: not a verdict */
      MISSING[clip] = true;
      try { release(wrap); } catch (err) {}
      remount();               /* hand the tile back to today's path */
    });
    _probes++;
    v.src = src;
    wrap.appendChild(v);
    coverTile(wrap);
    play(v);
  }

  /* has-vid on the first frame the compositor has actually presented (requestVideoFrameCallback),
     whatever that frame shows (a black power-on frame is the clip's own picture), so the screen never shows the black layer under a clip
     that has data but no picture yet. Browsers without it: loadeddata, as before. A clip that
     never presents (a stalled decoder) is marked 1.5 s after it starts playing, so a tile is
     never held for good; index.html's 6 s cap stands behind that too. */
  function shownWhenPainted(v, wrap) {
    var done = false;
    var mark = function () { if (done || v.parentElement !== wrap) return; done = true; wrap.classList.add('has-vid'); };
    if (typeof v.requestVideoFrameCallback !== 'function') { v.addEventListener('loadeddata', mark); return; }
    v.requestVideoFrameCallback(mark);
    v.addEventListener('playing', function () { setTimeout(mark, 1500); }, { once: true });
  }

  /* A clip attached to a tile already revealed (scrolled back to, the tab shown again, a
     re-render) goes back behind the soft blur until it is shown (index.html _tileClipCover). */
  function coverTile(wrap) {
    if (typeof window._tileClipCover === 'function') { try { window._tileClipCover(wrap); } catch (e) {} }
  }

  /* THE DISK SYSTEM CHAIN: boot clip shown, game clip preloading beneath it. */
  function attachFds(wrap, g, src, clip, bootSrc) {
    var b = makeVideo();
    b.classList.add('nes-vid-boot');
    g.classList.add('nes-vid-off');
    g.loop = false; b.loop = false;
    var show = function (which) {
      if (which === g) { b.classList.add('nes-vid-off'); g.classList.remove('nes-vid-off'); }
      else { g.classList.add('nes-vid-off'); b.classList.remove('nes-vid-off'); }
    };
    var startGame = function () {
      try { b.pause(); } catch (e) {}
      try { g.currentTime = 0; } catch (e) {}
      show(g); play(g);
      /* the game may have loaded while the boot was still the shown one */
      if (g.readyState >= 2 && g.parentElement === wrap) wrap.classList.add('has-vid');
    };
    var startBoot = function () {
      if (b.parentElement !== wrap) { startGame(); return; }   /* no boot clip: the game alone */
      try { g.pause(); g.currentTime = 0; } catch (e) {}
      /* the firmware may have changed since (a pack opened): re-derive */
      var now = bootUrl();
      if (now && now !== bootSrc) { bootSrc = now; b.src = now; }
      try { b.currentTime = 0; } catch (e) {}
      show(b); play(b);
    };
    b.addEventListener('ended', function () { if (b.parentElement === wrap) startGame(); });
    g.addEventListener('ended', function () {
      if (g.parentElement !== wrap) return;
      var d = g.duration;
      if (isFinite(d) && d >= FULL_SECS) startBoot();   /* full length: straight back to the boot */
      else armHold(g, startBoot);                        /* short: hold to the shared boundary */
    });
    b.addEventListener('loadeddata', function () { if (b.parentElement === wrap) wrap.classList.add('has-vid'); });
    g.addEventListener('loadeddata', function () {
      if (!g._nvHit) { g._nvHit = 1; _hits++; }
      if (g.parentElement === wrap && !g.classList.contains('nes-vid-off')) wrap.classList.add('has-vid');
    });
    b.addEventListener('error', function () {
      if (b.parentElement !== wrap) return;
      /* no boot clip for this firmware: remember it, play the game alone */
      var m = /nes-fdsboot-([0-9a-f]{12})\.webm/.exec(bootSrc);
      if (m) BOOT_MISSING[m[1]] = true;
      try { b.pause(); b.removeAttribute('src'); b.load(); b.remove(); } catch (e) {}
      startGame();
    });
    g.addEventListener('error', function () {
      /* the game clip is the probe: a miss releases the tile as before */
      if (g.parentElement !== wrap) return;
      MISSING[clip] = true;
      try { release(wrap); } catch (err) {}
      remount();
    });
    _probes++;
    g.src = src;
    b.src = bootSrc;
    wrap.appendChild(g);
    wrap.appendChild(b);
    play(b);
  }

  function makeVideo() {
    var v = document.createElement('video');
    /* nes-screen is nes-screen.css's class: it puts the clip on the aperture
       of whichever console the card is (NES, Famicom, FDS), under the glass,
       exactly where the live iframe would sit. */
    v.className = 'nes-screen nes-vid';
    v.muted = true; v.defaultMuted = true; v.playsInline = true;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    v.setAttribute('aria-hidden', 'true'); v.setAttribute('tabindex', '-1');
    v.disablePictureInPicture = true;
    v.preload = 'auto';
    v.addEventListener('volumechange', function () { if (!v.muted) v.muted = true; });
    /* (2 Nov 2026): smooth while the clip is drawn smaller than its own
       pixels, square pixels at 1:1 or larger (gbvideo.js fitScale). nes-screen.css's
       pixelated shrink dropped every second row and column at wall size, so a
       one-pixel pattern flashed. The drawer's live screens are not clips: untouched. */
    if (window.GBVIDEO && GBVIDEO.fitScale) GBVIDEO.fitScale(v, 256, 240);
    return v;
  }

  function release(wrap) {
    /* every clip on the tile: a Disk System tile carries two (boot and game) */
    var vs = wrap.querySelectorAll('video.nes-vid');
    if (!vs.length) return;
    Array.prototype.forEach.call(vs, function (v) {
      if (v._nvHold) { clearTimeout(v._nvHold); v._nvHold = 0; }
      try { v.pause(); } catch (e) {}
      try { v.removeAttribute('src'); v.load(); } catch (e) {}
      try { v.remove(); } catch (e) {}
    });
    wrap.classList.remove('has-vid');
  }

  function trim() {
    var held = [], seen = [];
    var all = document.querySelectorAll(SEL + ' > video.nes-vid');
    for (var i = 0; i < all.length; i++) {
      var w = all[i].parentElement;
      if (!w || !w.isConnected) { if (w) release(w); continue; }
      if (seen.indexOf(w) >= 0) continue;          /* one entry per tile (FDS has two clips) */
      seen.push(w);
      held.push({ w: w, d: 0 });
    }
    if (held.length <= MAX_VID) return;
    /* measured only when over the cap (2026-10-24): most calls are not, and measuring first forced a layout of the wall in every observer callback while scrolling */
    for (var k = 0; k < held.length; k++) held[k].d = _dist(held[k].w);
    held.sort(function (a, b) { return b.d - a.d; });
    for (var j = 0; j < held.length && held.length - j > MAX_VID; j++) {
      if (held[j].d > 0) release(held[j].w);
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

  function sweep() {
    if (!BASE) return;
    var wraps = document.querySelectorAll(SEL);
    for (var i = 0; i < wraps.length; i++) {
      var w = wraps[i];
      /* a far tile with no clip has nothing to attach or release (2026-10-24) */
      var near = nearNow(w);
      if (!near && !w.querySelector('video.nes-vid')) continue;
      if (!claims(w.getAttribute('data-nes'), w)) { release(w); continue; }
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
           blur rather than painting their black screens for a frame before the clips return */
        Array.prototype.forEach.call(document.querySelectorAll(SEL + '.has-vid'), function (w) { release(w); coverTile(w); });
      } else sweep();
    });
  }

  /* Called from index.html's mountNesTilePreviews(), i.e. after every render
     that can produce NES tiles. Nothing is fetched here: a request is made
     only by attach(), for a tile near the viewport. */
  function arm() {
    if (!BASE) return;
    if (!ENABLED) {
      Array.prototype.forEach.call(document.querySelectorAll(SEL + '.has-vid'), release);
      return;
    }
    bindFallback();
    if (TILE_BOOT) askBios();  /* start hashing the drive firmware before any FDS tile asks */
    var wraps = document.querySelectorAll(SEL);
    for (var i = 0; i < wraps.length; i++) {
      if (!claims(wraps[i].getAttribute('data-nes'), wraps[i])) continue;
      observer().observe(wraps[i]);
    }
    sweep();
  }

  function setEnabled(on) {
    ENABLED = !!on;
    if (!ENABLED) {
      Array.prototype.forEach.call(document.querySelectorAll(SEL + '.has-vid'), release);
      if (typeof window.mountNesTilePreviews === 'function') { try { window.mountNesTilePreviews(); } catch (e) {} }
    } else arm();
  }

  function stats() {
    var vids = document.querySelectorAll('video.nes-vid'), playing = 0, unmuted = 0;
    Array.prototype.forEach.call(vids, function (v) { if (!v.paused) playing++; if (!v.muted) unmuted++; });
    return { enabled: ENABLED, base: BASE, fdsBase: FDS_BASE, probes: _probes, hits: _hits,
             fdsBoot: bootKey(), fdsBiosSeen: _biosKey, bootMissing: Object.keys(BOOT_MISSING),
             missing: Object.keys(MISSING).length, attached: vids.length,
             playing: playing, unmuted: unmuted, cap: MAX_VID, nearPx: NEAR_PX };
  }

  /* Opacity only; geometry, z-index and object-fit are nes-screen.css's. The
     selector outranks index.html's `.nes-emu.ready > .nes-screen`, so a clip
     shows on `has-vid` and never depends on the live tile's `ready`. */
  function css() {
    if (document.getElementById('nes-vid-css')) return;
    var s = document.createElement('style');
    s.id = 'nes-vid-css';
    s.textContent =
      '.device-card .img .nes-emu > video.nes-screen.nes-vid{opacity:0;transition:opacity .3s ease;pointer-events:none;}' +
      '.device-card .img .nes-emu.has-vid > video.nes-screen.nes-vid{opacity:1;}' +
      /* behind the blur the clip is not faded in a second time: it is simply there when the blur lifts */
      '.device-card .img.loading .nes-emu > video.nes-screen.nes-vid{transition:none;}' +
      /* the Disk System chain's hidden half (the game preloading, or the boot done) */
      '.device-card .img .nes-emu.has-vid > video.nes-screen.nes-vid.nes-vid-off{opacity:0;transition:none;}';
    (document.head || document.documentElement).appendChild(s);
  }
  css();

  /* The grouping table landed: tiles held back while it loaded can claim now. */
  window.addEventListener('gnw-variants', function (e) {
    if (e && e.detail && e.detail.system === 'nes') remount();
  });

  window.NESVIDEO = { clipId: clipId, arm: arm, bootUrl: bootUrl, isFds: isFds,
                      /* a test knob: point the tiles at another clip origin (a local
                         folder of test clips) before they are armed */
                      setBase: function (b) { BASE = b || null; },
                      setFdsBase: function (b) { FDS_BASE = b || null; }, claims: claims, stats: stats, missing: function () { return Object.keys(MISSING); }, setEnabled: setEnabled,
                      release: release, urlFor: urlFor, trim: trim,
                      get NEAR_PX() { return NEAR_PX; },
                      get MAX_VID() { return MAX_VID; },
                      set MAX_VID(v) { MAX_VID = Math.max(0, v | 0); trim(); } };
})();

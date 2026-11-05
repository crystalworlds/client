/* gbvideo.js — RECORDED Game Boy tiles for the CATALOGUE grids.
 * ===========================================================================
 *
 * WHAT THIS REPLACES, AND WHERE
 * -----------------------------
 * A catalogue Game Boy tile (`.gb-emu[data-gb]`) mounts a live wasm machine
 * stepping ~59.7 frames a second into its own canvas. That is the right thing
 * in the drawer and the play window, where the point is that you can press a
 * button. On a grid it is a dozen consoles running so that a dozen postage
 * stamps move.
 *
 * MEASURED, and it is the reason this file exists: on the Game Boy catalogue at
 * 1600x1000, 27 tile devices live at once put _gbLoop at 14,031 ms of a
 * 14,126 ms window -- 99.3% of the main thread, 0.7 fps. (The note lives in
 * index.html's _gbLoop, which is where the number was taken.)
 *
 * So a tile with a recording plays video instead, and NO core is built for it.
 *
 * WHAT THIS IS NOT
 * ----------------
 * It is not gbrec.js. That file owns the Video page wall -- `#video-grid
 * .gb-emu[data-gbrec]` -- records its own footage into IndexedDB and serves it
 * from blob URLs. Different mount attribute, different grid, different source;
 * the two do not meet and neither needs to know about the other. This file
 * never touches a `[data-gbrec]` tile.
 *
 * It is also not the drawer or the play page. Those stay live emulation,
 * because they are interactive and a recording is not.
 *
 * KEYING: THE CARTRIDGE SHA-1, UPPERCASE
 * --------------------------------------
 * The clips are published under the SHA-1 of the cartridge file, uppercase hex,
 * `.webm` -- the same key the cover art already uses, so `74591CC9...` is
 * Tetris in both places. Verified against both buckets before this file was
 * written: all fourteen objects present, every Content-Length byte-identical to
 * the local master, and `video/webm` on every one.
 *
 * The map below is SHA-1; GB_MANIFEST in firmware/site/content_pack.js is sha256.
 * They are not interchangeable and this is deliberately a second table rather
 * than a derivation, because nothing in the browser can turn one into the
 * other. It belongs in the manifest generator eventually; it is here so that
 * content_pack.js -- which is generated -- is not hand-edited.
 *
 * THE BOOT CLIP IS NOT USED HERE, ON PURPOSE
 * ------------------------------------------
 * Two shared boot clips exist (BOOT_DMG_..., BOOT_CGB_...) because the boot
 * sequence is identical across every title on a console and storing it per
 * title wastes disk. A TILE does not play them.
 *
 * gbrec.js records from power-on deliberately -- "the boot logo IS the opening
 * of every loop" -- so that a tile returning to view starts at the beginning
 * rather than mid-loop. That intent is KEPT, not discarded: these gameplay
 * clips are cut at the boot firmware's handover, and for a DMG title the first ~1.3
 * seconds are the settled Nintendo logo the cartridge inherits. So the loop
 * still opens on the logo -- it just opens on the END of the boot instead of
 * replaying all 4.2 seconds of it every time a tile is scrolled past. Twelve
 * tiles replaying a synchronised logo scroll is a worse wall than twelve tiles
 * playing.
 *
 * The boot clips remain published for a stitched boot-then-gameplay player,
 * which is a play-page question, not a tile question.
 */
(function () {
  'use strict';

  /* ---- the knobs -------------------------------------------------------- */
  var BASE = {
    dmg: 'https://pub-b1cac080319747d4a79d4d5607505a33.r2.dev/'   /* gb-clips (was gameboy-animation, moved 2026-10-17) */,
    cgb: 'https://pub-38743c0e5f494a10ae96bd434893fa89.r2.dev/'    /* gbc-clips (was gameboy-color-animation, moved 2026-10-17) */
  };
  /* Same reach the tile ARTWORK uses (_armTileArtwork, rootMargin 300px), so a
     video is never fetched earlier than the console photograph it sits inside.
     gbrec uses 400; matching the artwork matters more than matching gbrec. */
  var NEAR_PX = 300;

  /* device id -> cartridge SHA-1, uppercase. EMPTY SINCE 2026-10-12: the twelve
     hand-written rows belonged to the Game Boy showcase entries (gb-tetris ...),
     which are gone (decided: the game server supplies the games). Every title is
     now a gb-x<sha12> id whose SHA-1 is LEARNED from its own bytes (below), so
     the same clips are still found. Kept as a seed table for that path. */
  var SHA1 = {};

  /* ON, AND MEASURED 2026-09-23. The number this file was waiting for.
   *
   * Taken in a desktop Chrome with a real attached desktop session --
   * document.visibilityState "visible", document.hasFocus() true, and an rAF
   * callback rate asserted BEFORE every reading (that assertion is the whole
   * point: the earlier attempt ran in a session with no desktop, where rAF
   * fired zero callbacks and screenshots still rendered perfectly).
   *
   * Careful with the absolute frame numbers: this session PRESENTS AT 30 Hz,
   * so 30 fps is the ceiling here, not 60. Read them as fractions of it.
   * Game Boy catalogue, ?tv=0, 8-second windows:
   *
   *            rAF fps   main thread blocked   Chrome CPU / 8 s
   *   idle        30.1          0.0%              2.21 s
   *   12 videos   15.1          0.0%              2.28 s
   *   12 cores     2.2         94.4%                --
   *   27 cores     1.0         87.5%             10.31 s  (renderer 8.19 =
   *                                                        102% of one core)
   *
   * The live-core numbers reproduce the 99.3% case this file exists for: at 27
   * the emulators themselves reach 8.25 fps of 59.7 and the page is unusable.
   * Video does not move that cost, it removes it: ZERO long-task milliseconds
   * in an 8-second window, and no net CPU at all (with the feature actually
   * armed on the grid -- 7 tiles in view -- Chrome used 1.87 s, BELOW the
   * 2.21 s idle baseline, because the compositor then runs at half rate).
   *
   * THE ONE COST, and it is a step rather than a slope: page presentation
   * halves, 30 -> 15 fps, as soon as TWO clips play, and does not get worse at
   * 3, 4, 8 or 12 (measured at each). Twelve PAUSED clips cost nothing (30.2).
   * So it is the compositor losing its single-video fast path, not decode
   * load, and twelve tiles cost exactly what two do.
   *
   * HARDWARE DECODE DOES NOT ENGAGE, and that is a resolution floor, not a
   * slot shortage: with these 160x144 clips playing -- one or twelve -- the
   * GPU's video engine sits at 0.00% while a 1080p VP9 control clip on the
   * same machine drives it to 14.3%. The clips are decoded in software, at
   * about +0.62 renderer CPU-seconds per 8 s for twelve (~8% of one core).
   * Cheap here; still the reason suppressed() below keeps TV and low-power on
   * static art, where that share and the halved presentation both land on the
   * machine with the least headroom.
   *
   * CHECK -- turn this back off if: the presentation halving is ever seen
   * to SCALE with the number of clips (it does not today), or a machine shows
   * long-task milliseconds attributable to decode, or the halving persists on
   * a 60 Hz session where it would read as 60 -> 30 on a grid at rest.
   * GBVIDEO.setEnabled(false) does it live; this flag does it for good. */
  var ENABLED = true;          /* GBVIDEO.setEnabled(false) -> static art */
  var io = null;
  var bound = false;

  /* ---- the policy ------------------------------------------------------- */
  /* TV AND LOW-POWER GET STATIC ART, and that is a decision rather than an
     oversight. Those are software-decode machines with the least headroom on
     the box, and a VP9 decoder per tile is the last thing to hand them. They
     already show the console photograph with a still screen -- static, never
     dead -- which is exactly what _previewsSuppressed() produces today. */
  function suppressed() {
    try {
      return !!(window.GNW_TV && (window.GNW_TV.isTV || window.GNW_TV.lowPower));
    } catch (e) { return false; }
  }

  /* ---- LEARNED HASHES ---------------------------------------------------
     WHY THIS EXISTS. The SHA1 table above is twelve hand-written rows, and
     claims() refused any tile whose id was not in it. That was right when
     twelve clips existed; it silently caps the feature at twelve no matter
     how many clips the bucket holds. 2,061 were published on 2026-09-25 and
     not one new tile picked one up, because nothing here ever asked.

     The file header says SHA-1 and sha256 'are not interchangeable and this
     is deliberately a second table rather than a derivation, because nothing
     in the browser can turn one into the other.' True -- but the browser does
     not have to: it HOLDS THE CARTRIDGE BYTES, and SubtleCrypto will hash
     them. So the key is derived from the cartridge itself, which is the same
     thing the publisher keyed on, and the table stops being a gate.

     The twelve stay as a seed so a tile works before the learner has run,
     and so nothing regresses if the pack is absent. Learned rows only add.

     MISSING is the other half: a bucket 404 marks that id and the tile falls
     back to live emulation instead of showing an empty <video> forever. A
     derived key is a guess that a clip exists, and a guess needs a way to be
     wrong. */
  var LEARNED = Object.create(null);
  var MISSING = Object.create(null);
  /* id -> the URL that actually played (its own clip, the other bucket's, or
     its group representative's), so a tile scrolled away and back asks once,
     not the whole chain again. Memory only: a new page load starts afresh. */
  var FOUND = Object.create(null);
  var _repTries = 0, _repHits = 0;
  var _learned = false, _learning = false;

  /* THE SITE ALREADY HASHES EVERY CARTRIDGE, AND IT ALREADY USES SHA-1.
     emby.js's gbCartSha1() hashes a cartridge's bytes to fetch its COVER ART
     -- `SHA-1 of the .gb file, uppercase hex, plus .png` -- and persists the
     answer to localStorage `gnw.gb.cartSha1.v1` as { deviceId: HEX }. That is
     the same key the clips are published under, which is exactly what this
     file's own header claims ('the same key the cover art already uses').

     So read that map FIRST. It costs nothing, it survives reloads, and it is
     usually already warm because the cover art loaded. We only hash an id the
     map has never seen, and we write the result back into the same map, so
     the two features keep one source of truth instead of two caches that can
     disagree. gbCartSha1 itself is private to emby.js's closure; the store is
     not, and the store is the contract.

     SHA-1 is not a security choice here and nothing is being authenticated --
     it is an object name chosen by whoever published the bucket. */
  var CACHE_KEY = 'gnw.gb.cartSha1.v1';
  var _cache = null;

  function cacheMap() {
    if (_cache) return _cache;
    try { _cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}; }
    catch (e) { _cache = {}; }
    return _cache;
  }
  function cacheWrite(id, hex) {
    var m = cacheMap();
    if (m[id] === hex) return;
    m[id] = hex;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(m)); } catch (e) {}
  }

  function hashOf(id) { return SHA1[id] || LEARNED[id] || cacheMap()[id] || null; }

  /* Cartridge bytes, as a Promise, FROM THE SITE'S ONE ACCESSOR.
   *
   * _gbFetchCart() is index.html's single cartridge accessor and the only
   * thing that knows a title's bytes can come from THREE places: the open
   * content pack's catalogue half, the pack's extras half, and the BUILT
   * payload (firmware/output/gb_games.json), which is what a deploy with no pack open
   * runs entirely from.
   *
   * THIS USED TO ASK window.__GNW_PACK.gameboy(id) DIRECTLY, which sees only
   * the first two. MEASURED on a local build, 2026-09-30, Media page,
   * document.visibilityState 'visible' with rAF asserted at 31/s:
   *
   *   __GNW_PACK.has()      false        (no pack open; this is the normal
   *                                       state after clean_website.ps1 +
   *                                       a rebuild)
   *   GBVIDEO.stats()       learned: 0   for 30 Game Boy tiles on the page
   *   cached                18           written by emby.js's COVER ART path
   *
   * So the learner has never learned one key on that build. Every clip that
   * did play came either from the twelve-row seed table or from that
   * localStorage map -- and emby.js hashes `data-series="game-boy"` ONLY
   * ("NOT FOR GAME BOY COLOR", its own words), so no Game Boy Color title
   * outside the seed could ever acquire a key. Counted on the page: 18 of 18
   * DMG tiles claimed a clip, 4 of 12 colour ones did, and those four are
   * exactly the four hard-coded colour rows in SHA1 above. That is the whole
   * of "only three of the Game Boy Color games are using the videos".
   *
   * Going through the accessor fixes both halves at once and adds no second
   * source of truth: the same bytes the tile would be emulated from are the
   * bytes that get hashed.
   */
  function cartBytes(id) {
    if (typeof _gbFetchCart === 'function') {
      /* The id carries the catalogue's 'gb-' prefix; _gbFetchCart wants the
         slot -- the same slice emby.js's gbCartSha1() and gbrec.js take. */
      try {
        return Promise.resolve(_gbFetchCart(String(id).slice(3)))
          .catch(function () { return null; });
      } catch (e) { /* fall through to the pack-direct read below */ }
    }
    /* THE FLOOR, for a page that loads this file without index.html's
       accessor. Kept deliberately: this file is also usable standalone. */
    var pack = window.__GNW_PACK;
    if (!pack || typeof pack.gameboy !== 'function') return Promise.resolve(null);
    var v = null;
    try { v = pack.gameboy(id); } catch (e) { return Promise.resolve(null); }
    if (!v) return Promise.resolve(null);
    if (v.rom) v = v.rom; else if (v.b64) v = v.b64;
    if (typeof v !== 'string') {
      if (v instanceof Uint8Array) return Promise.resolve(v);
      if (v instanceof ArrayBuffer) return Promise.resolve(new Uint8Array(v));
      return Promise.resolve(null);
    }
    try {
      var bin = atob(v), u8 = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return Promise.resolve(u8);
    } catch (e) { return Promise.resolve(null); }
  }

  function sha1Hex(u8) {
    var digest = window.cwsDigest ? cwsDigest('SHA-1', u8)          // firmware/site/sha.js: pure-JS fallback on plain http
               : (window.crypto && crypto.subtle) ? crypto.subtle.digest('SHA-1', u8) : null;
    if (!digest) return Promise.resolve(null);
    return digest.then(function (buf) {
      var b = new Uint8Array(buf), out = '';
      for (var i = 0; i < b.length; i++) out += b[i].toString(16).padStart(2, '0');
      return out.toUpperCase();
    }).catch(function () { return null; });
  }

  /* Hash the Game Boy tiles that are WITHIN REACH and that we do not already
     have a key for, then re-arm so the newly-eligible tiles get claimed.
     Costs one hash per cartridge the user actually scrolls to -- not per
     title in the library, and not per clip in the bucket.

     BOUNDED BY THE VIEWPORT, AND NO LONGER ONE-SHOT. The old form ran exactly
     once, over every tile in the document, and latched `_learned` forever
     after. Both halves were wrong for a real library: the Media page appends
     as you scroll, so tiles that arrive after the first pass were never
     offered to it; and reading the bytes of every title in the document at
     once decodes the whole shelf into memory to hash it. nearNow() is the
     same reach attach() uses, so a tile is hashed at the moment it is about
     to want its clip, and TRIED means a title is attempted once per session
     whatever the answer. */
  var TRIED = Object.create(null);
  function learnHashes() {
    if (_learning) return;
    var ids = [], seen = Object.create(null);
    var wraps = document.querySelectorAll('.gb-emu[data-gb]:not([data-gbrec])');
    for (var i = 0; i < wraps.length; i++) {
      var id = wraps[i].dataset.gb;
      if (!id || seen[id] || TRIED[id] || hashOf(id)) continue;
      if (!nearNow(wraps[i])) continue;
      seen[id] = 1; TRIED[id] = 1; ids.push(id);
    }
    if (!ids.length) return;
    _learning = true;
    var pending = ids.length, gained = 0;
    var done = function () {
      if (--pending) return;
      _learning = false; _learned = true;
      if (gained) arm();
    };
    ids.forEach(function (id) {
      cartBytes(id).then(function (u8) {
        if (!u8 || !u8.length) { done(); return; }
        return sha1Hex(u8).then(function (hex) {
          if (hex) { LEARNED[id] = hex; cacheWrite(id, hex); gained++; }
          done();
        });
      }).catch(function () { done(); });
    });
  }
  /* Which bucket a title's clip is published in. */
  function bucketFor(id) {
    var kind = (typeof _gbDeviceFor === 'function') ? _gbDeviceFor(id) : null;
    /* A RECORDING NEEDS NO BOOT PROGRAM (2026-10-14). _gbDeviceFor
       answers null for a Color-only title when no CGB boot program is at hand,
       because a live machine cannot be built; the clip was recorded elsewhere
       and still plays. Fall back to the catalogue's own console. */
    if (!kind) {
      try {
        /* index.html's id index, not a scan of every game (2026-10-24) */
        var d = (typeof window._deviceById === 'function') ? window._deviceById(id)
          : (typeof ALL_DEVICES !== 'undefined') ? ALL_DEVICES.find(function (x) { return x.id === id; }) : null;
        if (d && d.system === 'gbc') kind = 'cgb';
      } catch (e) {}
    }
    return (kind && BASE[kind]) ? kind : null;
  }
  /* THE OTHER BUCKET. A title's console is decided here by _gbDeviceFor(),
     which reads the CATALOGUE's `system` field; the bucket a clip was
     published into was decided by whoever recorded it. Those two agree for
     every title checked, but a disagreement is indistinguishable from a
     missing clip -- both are a 404 -- and the cost of being wrong used to be
     MISSING[id] forever. One retry against the other bucket makes the answer
     honest: a clip that exists is found wherever it was put, and a title with
     no clip anywhere still falls back to live emulation, one request later. */
  var OTHER = { dmg: 'cgb', cgb: 'dmg' };
  function urlFor(id, kind) {
    var h = hashOf(id);
    if (!h || MISSING[id]) return null;
    var k = kind || bucketFor(id);
    if (!k || !BASE[k]) return null;
    return BASE[k] + h + '.webm';
  }

  /* Does this tile belong to this file? Asked by index.html's _gbBuild BEFORE
     it allocates a core, so a claimed tile costs no wasm machine at all --
     which is the entire point. A claim is refused when the recording does not
     exist, so the other titles keep the live path untouched. */
  function claims(id, wrap) {
    if (!ENABLED || suppressed()) return false;
    if (!id || !hashOf(id) || MISSING[id]) return false;
    if (wrap && wrap.hasAttribute && wrap.hasAttribute('data-gbrec')) return false;
    return !!urlFor(id);
  }

  /* ---- geometry, the floor under the observer --------------------------- */
  /* Same belt-and-braces the live path uses (_gbNearNow + _gbBindFallback), and
     for the same reason its comment gives: an IntersectionObserver entry that
     never arrives -- a grid append, a layout shift, a route change -- turns
     into "the tile never plays". */
  /* index.html's _mNear() when it is there: it answers from the CARD's cached
     document-space box instead of measuring this wrapper, which is what lets
     .device-card carry `content-visibility: auto` (a measurement inside a
     skipped subtree forces that subtree to lay out, and this sweep runs over
     every clipped tile in the document on every scroll). Same reach and a
     superset of the same answer -- the card contains the wrapper.
       The literal measurement stays as the fallback for a page that loads this
     file without index.html's sweep geometry. */
  function nearNow(el) {
    if (window._mNear) return window._mNear(el, NEAR_PX);
    var r = el.getBoundingClientRect();
    return r.height > 0 && r.top < (window.innerHeight || 0) + NEAR_PX && r.bottom > -NEAR_PX;
  }

  /* ---- SHORT CLIPS: HOLD, DO NOT LOOP -----------------------------------
     A STATIC title was captured only up to the point its screen settles --
     around 8 seconds, because encoding the other 112 seconds of an identical
     frame is waste. Left on loop:true such a clip restarts every 8 seconds,
     and a title screen that keeps re-appearing reads as a device rebooting,
     not as a game sitting at its menu. So a short clip PLAYS ONCE, holds its
     final frame (which is what a non-looping <video> does when it ends), and
     restarts on the two-minute mark.

     ONE SHARED EPOCH, not a timer per tile. If each clip restarted 120s after
     its own 'ended' they would fan out across the wall and you would see a
     tile blink somewhere every few seconds -- worse than the looping it
     replaces. Every tile restarts on the same global boundary, so a grid of
     held title screens refreshes together, once, like a wall of real devices
     switched on at the same moment.

     THE THRESHOLD IS THE CONTENT, NOT A FLAG. A full capture is ~120s; the
     site reads no manifest and builds its URLs from a hash, so v.duration at
     loadedmetadata is the only thing it needs and the only thing it gets. */
  var CYCLE_MS  = 120000;
  var FULL_SECS = 119;      /* below this, it is a truncated STATIC clip */
  var EPOCH     = Date.now();

  /* Cleared in release(). A stale timeout firing play() on a detached element
     is the one way this can leak, and release() drops the node. */
  function armHold(v) {
    if (v._gbHold) { clearTimeout(v._gbHold); v._gbHold = 0; }
    var since = (Date.now() - EPOCH) % CYCLE_MS;
    v._gbHold = setTimeout(function () {
      v._gbHold = 0;
      if (!v.isConnected || !v.parentElement) return;
      if (!nearNow(v.parentElement)) return;   /* scrolled away while held */
      try { v.currentTime = 0; } catch (e) {}
      play(v);
    }, CYCLE_MS - since);
  }

  /* FOREGROUND MEDIA (2026-10-04): while a play window or the film player is
     open (index.html's gnwForegroundActive), clips are PAUSED in place, not
     released, so they carry on from the same frame when it closes. Nothing
     attaches or starts in the meantime. */
  function held() {
    try { return typeof window.gnwForegroundActive === 'function' && window.gnwForegroundActive(); } catch (e) { return false; }
  }
  document.addEventListener('gnw:foreground', function (e) {
    var vids = document.querySelectorAll('video.gb-vid');
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

  /* ---- attach / TEAR DOWN ----------------------------------------------- */
  function attach(wrap) {
    if (!ENABLED || suppressed() || held()) return;
    if (document.visibilityState !== 'visible') return;
    if (wrap.querySelector('video.gb-vid')) return;
    var id = wrap.dataset.gb;
    /* The bucket matching the title's SHELF in the grouping table (gb -> dmg,
       gbc -> cgb) when the table holds it: that is where the capture filed
       4,115 of 4,132 tabled clips, whatever boot program this page has. A
       title the table does not hold keeps the catalogue's answer. */
    var kind = shelfBucket(id) || bucketFor(id);
    var src = urlFor(id, kind);
    if (!src) return;
    if (FOUND[id]) src = FOUND[id];      /* what played last time, asked once */
    /* The Media wall moving fast (2026-10-25; as nesvideo.js):
       no clip yet, and 'cw-wall-slow' sweeps again. */
    if (fastNow(wrap)) return;

    var art = wrap.querySelector('.gb-emu-art');
    var v = document.createElement('video');
    v.className = 'gb-vid';
    fitScale(v, 160);   /* smooth when shrunk, pixelated when enlarged */
    /* loop stays TRUE until the duration is known: a full-length clip is the
       common case and must not miss a loop while metadata is in flight. */
    v.muted = true; v.loop = true; v.playsInline = true;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    v.preload = 'auto';
    /* NO crossOrigin. The buckets send no Access-Control-Allow-Origin, and a
       plain media load does not need one -- asking for CORS here would fail the
       load outright. Nothing reads these pixels back, so nothing wants it. */
    /* A DERIVED KEY IS A GUESS. If the bucket does not hold this clip, mark
       the id and let the tile go back to live emulation -- an empty <video>
       over the artwork is worse than the thing this file replaced. */
    v.addEventListener('loadedmetadata', function () {
      var d = v.duration;
      if (!isFinite(d) || d >= FULL_SECS) return;     /* full capture: loop */
      v.loop = false;                                  /* truncated: hold   */
    });
    v.addEventListener('ended', function () { armHold(v); });
    v.addEventListener('loadeddata', function () { if (!FOUND[id]) FOUND[id] = v.currentSrc || v.src; });
    v.addEventListener('error', function () {
      if (v.parentElement !== wrap) return;              /* released: no verdict */
      var h = hashOf(id);
      var giveUp = function () {
        if (v.parentElement !== wrap) return;
        MISSING[id] = true;
        try { release(wrap); } catch (e) {}
      };
      var other = function () {
        /* ONE RETRY AGAINST THE OTHER BUCKET before giving up -- see OTHER. */
        var alt = OTHER[kind];
        if (alt && h && BASE[alt] && !v._gbOther && v.parentElement === wrap) {
          v._gbOther = 1;
          try { v.src = BASE[alt] + h + '.webm'; play(v); return; } catch (e) {}
        }
        giveUp();
      };
      if (FOUND[id] && v.src === FOUND[id]) { delete FOUND[id]; giveUp(); return; }
      /* THE GROUP'S REPRESENTATIVE (2026-10-05). The Game Boy capture
         recorded nearly every file, so the tile's OWN clip is asked first;
         when it is missing, a grouped title plays its representative's clip
         (variants.js: the grouping table's R row on the same shelf, its SHA-1
         from the table's cross-reference, loaded only now). The rep is asked
         in its own shelf's bucket (gb -> dmg, gbc -> cgb). The other-bucket
         retry for the tile's own clip comes last, so a title whose clip was
         filed in the other bucket (the Pokemon Yellow betas) still finds it.
         Requests per tile: 1 normally; 2 for a variant playing its rep or a
         title in the other bucket; 3 only for a variant with no clip at all. */
      if (!v._gbRepTried) {
        v._gbRepTried = 1;
        repTarget(id).then(function (t) {
          if (v.parentElement !== wrap) return;
          if (!t || !BASE[t.bucket]) { other(); return; }
          _repTries++;
          v._gbRep = 1;
          v.addEventListener('loadeddata', function once() { v.removeEventListener('loadeddata', once); if (v._gbRep) _repHits++; });
          try { v.src = BASE[t.bucket] + t.sha1 + '.webm'; play(v); } catch (e) { other(); }
        });
        return;
      }
      v._gbRep = 0;
      other();
    });
    v.src = src;
    if (art && art.nextSibling) wrap.insertBefore(v, art.nextSibling);
    else wrap.appendChild(v);
    wrap.classList.add('has-vid');
    play(v);
  }

  function shelfBucket(id) {
    var V = window.Variants, r = null;
    try { r = (V && typeof V.repRow === 'function') ? V.repRow('gb', id) : null; } catch (e) { r = null; }
    return r ? (r.shelf === 'gbc' ? 'cgb' : 'dmg') : null;
  }

  /* The representative's clip for a grouped title, or null (no table, not
     grouped, the title IS the representative, or no SHA-1 known). Resolves
     { sha1: UPPERCASE hex, bucket: 'dmg'|'cgb' }. */
  function repTarget(id) {
    var V = window.Variants;
    if (!V || typeof V.repRow !== 'function' || typeof V.sha1Of !== 'function') return Promise.resolve(null);
    var r;
    try { r = V.repRow('gb', id); } catch (e) { return Promise.resolve(null); }
    var p = (r === undefined)
      ? Promise.resolve(V.ready ? V.ready('gb') : null).then(function () { try { return V.repRow('gb', id) || null; } catch (e) { return null; } })
      : Promise.resolve(r);
    return p.then(function (row) {
      if (!row || row.self) return null;
      return V.sha1Of('gb', row.sha).then(function (s1) {
        if (!s1) return null;
        s1 = s1.toUpperCase();
        if (s1 === hashOf(id)) return null;
        return { sha1: s1, bucket: row.shelf === 'gbc' ? 'cgb' : 'dmg' };
      });
    }).catch(function () { return null; });
  }

  /* Rejected: pausing. A paused <video> keeps its decoder, its buffered frames
     and its GPU surface -- the same defect as an emulator core that keeps
     stepping after its view is gone, which is the bug closeOverlay() was fixed
     for. So an off-screen tile RELEASES: drop the source, tell the element to
     reload from nothing, and remove it. Coming back costs one fetch off the
     HTTP cache, which is the trade this file is making everywhere. */
  function release(wrap) {
    var v = wrap.querySelector('video.gb-vid');
    if (!v) return;
    if (v._gbHold) { clearTimeout(v._gbHold); v._gbHold = 0; }
    try { v.pause(); } catch (e) {}
    try { v.removeAttribute('src'); v.load(); } catch (e) {}
    try { v.remove(); } catch (e) {}
    try { if (_scaleRO) _scaleRO.unobserve(v); } catch (e) {}
    wrap.classList.remove('has-vid');
  }

  /* ---- RETENTION: AN ANIMATION IS NOT AN EMULATOR -----------------------
     GB_MAX_LIVE = 4 and NES_MAX_LIVE = 4 exist because a live core costs CPU
     every frame and a cheap machine has to survive a wall of them. A clip
     costs a decoder, which is an order of magnitude less, so the emulator
     cap is the wrong instrument here and this file never had one: a tile
     attached at NEAR_PX and was torn straight down on scroll-out.

     That is why only a handful are ever running. The window, not a number,
     was the limit -- and tearing down on exit means scrolling back re-fetches
     and restarts the clip, which reads as the device rebooting. The whole
     point of the shared epoch above is that a wall of tiles does NOT blink
     independently, and an eager release defeats it.

     So: attach on approach as before, but KEEP a clip after it leaves, up to
     MAX_VID. Over budget, the furthest from the viewport goes first, which
     is the one least likely to be scrolled back to. The number was set on 1 Oct.

     Tunable live as GBVID.MAX_VID for the same reason the other caps are. */
  var MAX_VID = 20;

  function _dist(el) {
    /* the card's cached box (index.html _mSweepRect), not a measurement: trim() runs after every
       observer batch, and a measurement there forced a layout of the whole wall */
    var r = window._mSweepRect ? window._mSweepRect(el) : el.getBoundingClientRect();
    var vh = window.innerHeight || 0;
    if (r.bottom < 0) return -r.bottom;          /* above the fold  */
    if (r.top > vh)   return r.top - vh;         /* below the fold  */
    return 0;                                    /* on screen       */
  }

  /* Called after every sweep and after each observer batch. Releases only
     what is BOTH off-screen and over budget -- an on-screen tile is never
     evicted, however many there are, because the viewport is the one thing
     the visitor can see. */
  function trim() {
    var held = [];
    var all = document.querySelectorAll('.gb-emu[data-gb] video.gb-vid');
    for (var i = 0; i < all.length; i++) {
      var w = all[i].parentElement;
      if (!w || !w.isConnected) { if (w) release(w); continue; }
      held.push({ w: w, d: 0 });
    }
    if (held.length <= MAX_VID) return;
    /* measured only when over the cap (2026-10-24): most calls are not, and measuring first forced a layout of the wall in every observer callback while scrolling */
    for (var k = 0; k < held.length; k++) held[k].d = _dist(held[k].w);
    held.sort(function (a, b) { return b.d - a.d; });   /* furthest first */
    for (var j = 0; j < held.length && held.length - j > MAX_VID; j++) {
      if (held[j].d > 0) release(held[j].w);            /* never on-screen */
    }
  }

  /* play() is a promise and a play issued in the same tick as the src
     assignment can lose to the load it is waiting on -- the AbortError gbrec
     documents. Try, then try once more when there is actually data. */
  function play(v) {
    if (!v || !v.isConnected || held()) return;
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
          try { v.play().catch(function () {}); } catch (e) {}
        }
      });
    });
  }

  function observer() {
    if (io) return io;
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        /* NO release on exit. A clip that leaves the window is kept until
           trim() decides it is both off-screen AND over budget. */
        if (en.isIntersecting) attach(en.target);
      });
      trim();
    }, { rootMargin: NEAR_PX + 'px 0px' });
    return io;
  }

  function fastNow(el) {
    try { return !!(window._cwWallFast && window._cwWallFast() && el.closest('#video-grid')); } catch (e) { return false; }
  }
  document.addEventListener('cw-wall-slow', function () { if (bound) sweep(); });

  function sweep() {
    /* HERE TOO, not only in arm(). The Media page appends as you scroll and
       learnHashes() is now viewport-bounded, so the tiles that come into
       reach between renders are offered to it on the same debounced pass that
       decides whether to attach them. TRIED keeps the cost to one attempt per
       title per session. */
    learnHashes();
    var wraps = document.querySelectorAll('.gb-emu[data-gb]:not([data-gbrec])');
    for (var i = 0; i < wraps.length; i++) {
      var w = wraps[i];
      /* A far tile with no clip has nothing to attach or release: skip it before the claim
         (2026-10-24; the claim was most of every scroll at 3,000 tiles). */
      var near = nearNow(w);
      if (!near && !w.querySelector('video.gb-vid')) continue;
      if (!claims(w.dataset.gb, w)) { release(w); continue; }
      /* Attach on approach; do NOT release on departure. A tile that has
         scrolled away keeps its clip so scrolling back does not re-fetch
         and restart it. trim() reclaims when the budget is exceeded. */
      if (near && w.isConnected) attach(w);
      else if (!w.isConnected) release(w);
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
    /* A hidden tab releases everything. Chrome suspends the decoders anyway,
       but holding the elements means holding their buffers for a tab nobody is
       looking at, and the live path already treats hidden as a full stop. */
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') {
        Array.prototype.forEach.call(
          document.querySelectorAll('.gb-emu[data-gb].has-vid'), release);
      } else sweep();
    });
  }

  /* Called by emby.js/index.html after any render that can produce GB tiles. */
  function arm() {
    if (!ENABLED || suppressed()) {
      Array.prototype.forEach.call(
        document.querySelectorAll('.gb-emu[data-gb].has-vid'), release);
      return;
    }
    bindFallback();
    learnHashes();          /* derives keys for tiles the 12-row table misses */
    var wraps = document.querySelectorAll('.gb-emu[data-gb]:not([data-gbrec])');
    for (var i = 0; i < wraps.length; i++) {
      if (!claims(wraps[i].dataset.gb, wraps[i])) continue;
      observer().observe(wraps[i]);
    }
    sweep();
  }

  function setEnabled(on) {
    ENABLED = !!on;
    if (!ENABLED) {
      Array.prototype.forEach.call(
        document.querySelectorAll('.gb-emu[data-gb].has-vid'), release);
    } else arm();
  }

  function stats() {
    var vids = document.querySelectorAll('video.gb-vid');
    var playing = 0;
    Array.prototype.forEach.call(vids, function (v) { if (!v.paused) playing++; });
    return { enabled: ENABLED, suppressed: suppressed(),
             titles: Object.keys(SHA1).length + Object.keys(LEARNED).length,
             seeded: Object.keys(SHA1).length, learned: Object.keys(LEARNED).length,
             cached: Object.keys(cacheMap()).length,
             tried: Object.keys(TRIED).length,
             missing: Object.keys(MISSING).length,
             repTries: _repTries, repHits: _repHits, found: Object.keys(FOUND).length,
             attached: vids.length, playing: playing,
             cap: MAX_VID, nearPx: NEAR_PX };
  }

  /* ---- the screen window ------------------------------------------------
     THE APERTURE IS NOT WRITTEN HERE. It is declared once, in index.html, as
     --gb-scr-l/t/w/h/bg on .device-card, with the Game Boy Color and Pokemon
     photographs overriding it on their own attribute selectors; this rule just
     reads whichever set has cascaded onto the tile. Percentages resolve
     against .gb-emu, the same containing block the canvas uses, so a clip and
     a live core land on exactly the same rectangle by construction.
       THIS USED TO BE A HAND-MAINTAINED COPY and it is why the screen sat too
     far right on every clipped tile: the numbers below said 23.65/12.08/
     51.9/29.51, measured from the retired SVG render, while the canvas had
     been re-measured against the photograph. Do not reintroduce literals here,
     and do not add a var() fallback -- a missing variable should break loudly
     rather than quietly become a second copy that can drift again.
       object-fit:fill because the aperture is the truth: the clip is 160x144
     and the window is measured from the artwork; letterboxing a two-pixel
     discrepancy would read as a misaligned screen.
       WHICH SIDE OF THE GLASS IS NOT WRITTEN HERE EITHER. --gb-scr-z is the
     fifth aperture property and it carries the answer: 1 for the photographs,
     whose glass is not cut out but is a translucent glare-and-fingerprint
     layer, so the clip goes UNDER .gb-emu-art (z2) exactly where the live core
     sits; 5 for an artwork whose screen region measures OPAQUE (the Pokemon
     edition), where "under" means invisible. It is declared beside the
     rectangle in index.html and checked against the artwork's own measured
     alpha at runtime by _gbGlassSweep(). Writing a literal here is the same
     defect as writing the rectangle here -- a clip and a live core must land
     on the same side of the glass as well as on the same rectangle.
       Unlike emby.js's copy this is NOT scoped to #video-grid -- these tiles
     live in the catalogue grids. */
  function css() {
    if (document.getElementById('gb-vid-css')) return;
    var s = document.createElement('style');
    s.id = 'gb-vid-css';
    s.textContent =
      '.device-card .img .gb-emu > video.gb-vid{position:absolute;' +
      'left:var(--gb-scr-l);top:var(--gb-scr-t);' +
      'width:var(--gb-scr-w);height:var(--gb-scr-h);' +
      'background:var(--gb-scr-bg);object-fit:fill;image-rendering:pixelated;' +
      'z-index:var(--gb-scr-z);opacity:0;transition:opacity .3s ease;pointer-events:none;}' +
      '.device-card .img .gb-emu.has-vid > video.gb-vid{opacity:1;}' +
      /* fitScale() below: a clip drawn SMALLER than its own pixels is smoothed. */
      '.device-card .img .gb-emu > video.gb-vid.scr-min,.sgb-emu video.sgb-vid.scr-min{image-rendering:auto;}';
    (document.head || document.documentElement).appendChild(s);
  }
  css();

  /* ---- PIXELATED ONLY WHEN THE CLIP IS DRAWN BIGGER THAN ITSELF ----------
     2 Nov 2026. image-rendering:pixelated is right when a 160x144
     picture is ENLARGED (every pixel becomes a crisp block). On the wall it is
     SHRUNK: 78x72 CSS px at 1440x900 and 101x93 on a 1920x1080 TV, both at
     device pixel ratio 1, so Chrome's nearest-neighbour keeps about every
     second row and column and throws the rest away. A game that draws a
     one-pixel checkerboard (Akazukin Chacha's sky and road) and scrolls it
     by one pixel then shows the kept half flipping between all-light and
     all-dark, every frame: big flashing blocks that are not in the game.
     Measured on that clip in headless Chrome: the shrunk pixelated tile
     changes 9.7 grey levels a frame on average, smooth 3.8; the full-size
     picture shows the same dither as a steady grey.
     So each clip is watched (one ResizeObserver) and, while it is drawn with
     fewer DEVICE pixels than the clip has, it gets .scr-min and is smoothed.
     A phone (101 CSS px at ratio 2 = 203 device px) and any larger tile keep
     the pixelated look. The clip files are not touched: they are the
     emulator's frames, every one, at its own rate. */
  /* SHARED WITH THE NES AND ATARI CLIPS (2 Nov 2026). nesvideo.js and
     atarivideo.js call fitScale(v, w, h) for their wall clips. With natH given:
     the HEIGHT is checked too (their 256x240 and 320x228 pictures are drawn
     into a 4:3 screen, so rows are dropped before columns are), and once the
     clip's own size is known (videoWidth x videoHeight) it replaces w x h,
     because the clips are not all one size. The setting is also written
     inline (image-rendering), so a system's own stylesheet needs no rule for
     it. Called with natW only (the Game Boy and Super Game Boy), it works
     exactly as before: width against natW. */
  var _scaleRO = null;
  function scaleCheck(t) {
    var r = window.devicePixelRatio || 1, dw = (t._fsW || 0) * r, dh = (t._fsH || 0) * r;
    var small = dw > 0 && (dw < (t._natW || 160) - 0.5 || (t._natH > 0 && dh < t._natH - 0.5));
    t.classList.toggle('scr-min', small);
    if (t._natH > 0) t.style.imageRendering = small ? 'auto' : '';
  }
  function fitScale(v, natW, natH) {
    if (!v || typeof ResizeObserver === 'undefined') return;
    v._natW = natW || 160;
    v._natH = natH || 0;
    if (natH) v.addEventListener('loadedmetadata', function () {
      if (v.videoWidth > 0 && v.videoHeight > 0) { v._natW = v.videoWidth; v._natH = v.videoHeight; scaleCheck(v); }
    });
    if (!_scaleRO) _scaleRO = new ResizeObserver(function (es) {
      for (var i = 0; i < es.length; i++) {
        var t = es[i].target, e = es[i];
        if (!t.isConnected) { _scaleRO.unobserve(t); continue; }
        /* CSS width times the ratio, not device-pixel-content-box: headless
           Chrome with a ratio-2 phone reported 102 there for a 101.5 CSS px box. */
        t._fsW = e.contentRect.width; t._fsH = e.contentRect.height;
        scaleCheck(t);
      }
    });
    try { _scaleRO.observe(v); } catch (e) {}
  }

  window.GBVIDEO = { arm: arm, claims: claims, stats: stats, setEnabled: setEnabled,
                     release: release, urlFor: urlFor, hashOf: hashOf, fitScale: fitScale,
                     learn: function () { _learned = false; learnHashes(); },
                     get NEAR_PX() { return NEAR_PX; },
                     /* Live-tunable, like GNW_MAX_LIVE / PM_MAX_LIVE.
                        Lowering it reclaims on the next sweep. */
                     get MAX_VID() { return MAX_VID; },
                     set MAX_VID(v) { MAX_VID = Math.max(0, v|0); trim(); },
                     trim: trim };
})();

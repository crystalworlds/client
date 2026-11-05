/* gbrec.js — RECORDED Game Boy tiles for the Video page.
 * ===========================================================================
 *
 * TURNED OFF 2026-09-24 — THE WALL NO LONGER RECORDS ANYTHING. READ THIS FIRST.
 * ---------------------------------------------------------------------------
 * `ENABLED` below is false and the whole of this file is asleep. Nothing here
 * runs: no capture slots, no emulator built to record, not one read or write of
 * the IndexedDB store. It is kept, entire and commented, because turning it
 * back on is one flag and because everything it learned is written down in it.
 *
 * WHY. Recorded clips are being published for the whole library --
 * "all 2000+ game videos" -- the same way the catalogue's clips are already
 * published to R2 and served by gbvideo.js. A wall that spends four emulators
 * and two minutes a title making its own footage is making something that is
 * about to arrive anyway, in better shape, for every title rather than thirty.
 *
 * WHAT THE MEDIA WALL DOES INSTEAD, as it was decided:
 * "It should only ever play them from the R2 storage, or the real hardware if
 * they are unavailable as a recording. No re-recording required."
 * So, exactly two sources and no third:
 *   1. A PUBLISHED R2 CLIP where one exists -- gbvideo.js, keyed by cartridge
 *      SHA-1, no build stamp anywhere in it.
 *   2. THE REAL EMULATOR where one does not -- the catalogue's live tile path,
 *      capped by GB_MAX_LIVE, nearest-first, torn down on scroll-out.
 * The Video page's tiles therefore ship as `data-gb` rather than `data-gbrec`
 * (see gameCard() in index.html, which reads GBREC.ENABLED to decide), which is
 * what hands them to those two and leaves this file with nothing to arm.
 *
 * LOCAL RECORDINGS ARE NO LONGER A PLAYBACK SOURCE, and that was asked and
 * answered rather than assumed: a cartridge the visitor supplied themselves has
 * no published clip, and the answer to "so those still need a local recording?"
 * was no -- R2 or hardware, nothing else. The existing store is NOT deleted.
 * ~30 recordings plus their cartridge hashes stay where they are, unread, until
 * decided otherwise; dropping them is a deliberate choice and it does not undo.
 *
 * TO TURN IT BACK ON: set ENABLED to true (or GBREC.setEnabled(true) live, then
 * re-render the Video page so the tiles come back as `data-gbrec`). Everything
 * below this line describes the machine as it was built and still works.
 *
 * WHAT THIS REPLACED, AND WHY
 * ---------------------------
 * The Video page's Game Boy tiles used the same live-emulator path the Game Boy
 * catalogue uses: every tile on screen is a wasm machine stepping ~59.7 frames a
 * second and blitting into its own canvas. On a catalogue page that is the
 * point. On an ambient wall of films it is a dozen emulators running so that
 * twelve postage stamps can move, and it costs CPU and arena the page has no
 * other use for.
 *
 * So the wall stops emulating and starts playing video. Each title is emulated
 * ONCE, from power-on, recorded to a short WebM loop, and every visit after
 * that plays the file. A <video> at 160x144 decoded by the browser's own
 * pipeline is not comparable in cost to a wasm Game Boy driven from rAF.
 *
 * THE FOUR-SLOT RULE
 * ------------------
 * At most FOUR emulators exist on this page at any moment, no exceptions, and
 * every one of them is recording. That is the invariant: an emulator that is not
 * being recorded has no reason to exist here. Tiles with no recording queue for
 * a slot, so a wall converts itself over a few visits rather than in one burst.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * -----------------------------
 * The slide-out drawer and the full play page always boot the real emulator.
 * They are interactive; a recording is not. Game & Watch is excluded because its
 * tiles show REAL TIME on screen and a recorded clock is a wrong clock. Pokemon
 * mini is excluded until Game Boy proves out.
 *
 * KEYING, AND WHY THE DEVICE ID IS THE CARTRIDGE HASH
 * --------------------------------------------------
 * Records are keyed by cartridge identity plus emulator build, so that a core
 * rebuild invalidates every stale recording rather than serving footage from an
 * emulator that no longer exists.
 *
 * The device id IS the cartridge hash here, and that is a fact about how titles
 * reach this page rather than a shortcut. A catalogue id (`gb-tetris`) exists
 * only because a file in the user's content pack hashed to that entry's sha256
 * in GB_MANIFEST -- identification is BY hash, so id implies hash. A pack-
 * supplied id (`gb-x44a0ffb72a22`) literally contains its sha256 prefix. There
 * is no route by which two different cartridges wear one id.
 *   The build stamp is the sha256 of build/gb.wasm, which is the actual artifact
 * -- not a version constant someone has to remember to bump.
 */
(function () {
  'use strict';

  var DB = 'gnwGbRec', STORE = 'rec', KEYIDX = 'stamp';

  /* ---- THE ONE FLAG ------------------------------------------------------
   * False, and every entry point in this file returns on it: arm() does not
   * walk the grid, nothing is queued, no slot is claimed, no emulator is built,
   * openDb() is never called so the store is never even opened.
   *
   * See the header for why. The short of it: clips are being published for
   * the whole library, the Media wall now plays those (or boots the real
   * machine when a title has none), and footage this page makes for itself is
   * work that is about to be redundant.
   *
   * Do not "fix" this back to true because the wall shows live emulators on
   * some titles -- that is the design, not a regression. index.html's gameCard()
   * reads GBREC.ENABLED to decide whether a Video-page tile is a `data-gbrec`
   * mount (this file) or a `data-gb` one (published clip, else live core), so
   * this flag is the whole switch and there is not a second one anywhere. */
  var ENABLED = false;         /* GBREC.setEnabled(true) -> recorder returns */

  /* ---- the knobs, all in one place ------------------------------------- */
  var MAX_LIVE   = 4;          /* emulators alive on this page. No exceptions. */
  var MAX_MS     = 120000;     /* 2 minutes of footage per title              */
  var MIN_MS     = 15000;      /* shorter than this is not worth keeping      */
  var CAP_FPS    = 30;         /* capture rate; the core runs at ~59.7        */
  var BITRATE    = 120000;     /* 120 kbit/s at 160x144 -- see SIZES below    */
  var REC_W      = 160, REC_H = 144;   /* native. See the note on downscaling. */
  var NEAR_PX    = 400;        /* how early a tile counts as "approaching"    */

  /* ---- tiny promise helpers over IndexedDB ------------------------------ */
  var _db = null;
  function openDb() {
    if (_db) return _db;
    _db = new Promise(function (res, rej) {
      var q = indexedDB.open(DB, 1);
      q.onupgradeneeded = function () {
        var d = q.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      };
      q.onsuccess = function () { res(q.result); };
      q.onerror = function () { rej(q.error); };
    });
    return _db;
  }
  function idb(mode, fn) {
    return openDb().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(STORE, mode), s = t.objectStore(STORE), req = fn(s);
        /* `'result' in req`, NOT `req.result !== undefined`.
         *
         * The first version fell through to resolving with the IDBRequest
         * ITSELF whenever the result was undefined -- i.e. on every cache miss.
         * A request object is truthy, so `if (h) return h` accepted it as a
         * stored value, and it serialised into the export bundle as `{}`. Every
         * one of thirty recordings shipped with `cart_sha256: {}` and the
         * uploader rejected the lot.
         *   A miss must resolve to undefined. `in` distinguishes "this request
         * has a result slot that happens to be empty" from "this is not a
         * request at all", which is the distinction the old test could not
         * make. */
        t.oncomplete = function () {
          res(req && typeof req === 'object' && 'result' in req ? req.result : undefined);
        };
        t.onerror = function () { rej(t.error); };
      });
    }).catch(function () { return null; });
  }
  var getRec  = function (k) { return idb('readonly',  function (s) { return s.get(k); }); };
  var putRec  = function (k, v) { return idb('readwrite', function (s) { return s.put(v, k); }); };
  var allKeys = function () { return idb('readonly',  function (s) { return s.getAllKeys(); }); };

  /* ---- the build stamp -------------------------------------------------- */
  /* sha256 of the actual wasm. Cached in localStorage keyed by the file's
     Last-Modified/length so the hash is computed once per build, not per visit,
     but is never trusted across a file that has changed underneath it. */
  /* The URL is the served core's own, ?v= tag included (index.html sets
     window.GB_WASM_URL beside the emulator's fetch). A new core gets a new
     URL, so 'force-cache' can no longer hand back an older build's bytes and
     an old stamp. With no tag to follow, the browser revalidates instead. */
  var _stamp = null;
  function buildStamp() {
    if (_stamp) return _stamp;
    var url = (typeof window !== 'undefined' && window.GB_WASM_URL) || '';
    _stamp = fetch(url || 'play/gameboy/build/gb.wasm', { cache: url ? 'force-cache' : 'no-cache' })
      .then(function (r) { return r.ok ? r.arrayBuffer() : null; })
      .then(function (buf) {
        if (!buf) return 'nowasm';
        return (window.cwsDigest ? cwsDigest('SHA-256', buf) : crypto.subtle.digest('SHA-256', buf)).then(function (h) {
          return [].map.call(new Uint8Array(h).slice(0, 6),
                             function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
        });
      })
      .catch(function () { return 'nowasm'; });
    return _stamp;
  }
  /* ---- the palette is part of a DMG recording's identity ----------------
   *
   * A recording bakes the palette into its pixels, so a palette change makes
   * every DMG recording as stale as a core rebuild does -- and for the same
   * reason, so it is handled the same way: by joining the key rather than by
   * remembering to purge. Old recordings stop matching and re-record; the
   * shared library is asked under the SAME identity, or a palette change would
   * be invisible to it and the wall would re-download footage the drawer no
   * longer matches.
   *
   * COLOUR TITLES CARRY NO SUFFIX. A CGB title renders its own palette through
   * the rgb555 path and never consults PALETTES at all, so a skin change cannot
   * alter one frame of it. Suffixing those would invalidate recordings that are
   * still perfectly good.
   *
   * REC_PALETTE must equal DEFAULT_PALETTE in play/gameboy/web/shell.js. This
   * file is a plain script and cannot import it, so the recorder asserts the
   * two agree at the moment it builds a device -- drift is caught the first
   * time a recording is made, not by a reader noticing. */
  var REC_PALETTE = 'dmggreen';
  function recSuffix(id) {
    var kind = (typeof _gbDeviceFor === 'function') ? _gbDeviceFor(id) : 'dmg';
    return kind === 'cgb' ? '' : '~' + REC_PALETTE;
  }
  function keyFor(id, stamp) { return id + '@' + stamp + recSuffix(id); }

  /* THE SHARED LIBRARY (Stage 2) IS GONE (2026-10-23). It asked a Supabase
   * table (cart_videos_available) whether a cartridge had already been recorded
   * and downloaded the clip from the cart-videos bucket; an exportAll() bundle fed
   * it. The table, the RPC and the bucket were deleted (migration_057), and
   * published clips come from R2 through gbvideo.js. A recording is now only
   * ever made locally, and only with ENABLED on. */

  /* sha256 of the cartridge image, hex. Cached in the same store as the
     recordings under a 'hash:' prefix -- a second object store would need a
     version bump and a migration for one string per title. */
  var _hashMem = {};
  function cartHash(id) {
    if (_hashMem[id]) return _hashMem[id];
    _hashMem[id] = idb('readonly', function (st) { return st.get('hash:' + id); })
      .then(function (h) {
        if (typeof h === 'string' && /^[0-9a-f]{64}$/.test(h)) return h;
        if (typeof _gbFetchCart !== 'function') return null;
        return _gbFetchCart(id.slice(3)).then(function (bytes) {
          if (!bytes) return null;
          return (window.cwsDigest ? cwsDigest('SHA-256', bytes) : crypto.subtle.digest('SHA-256', bytes)).then(function (buf) {
            var hex = [].map.call(new Uint8Array(buf),
              function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
            putRec('hash:' + id, hex);
            return hex;
          });
        });
      })
      .catch(function () { return null; });
    return _hashMem[id];
  }

  /* ---- codec pick ------------------------------------------------------- */
  var MIME = (function () {
    var want = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    for (var i = 0; i < want.length; i++) {
      try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(want[i])) return want[i]; }
      catch (e) {}
    }
    return null;
  })();
  var SUPPORTED = !!(MIME && window.MediaRecorder && HTMLCanvasElement.prototype.captureStream);

  /* ---- state ------------------------------------------------------------ */
  var live = {};        /* key -> { dev, rec, chunks, t0, timer, wrap } */
  var liveCount = 0;
  var queue = [];       /* wraps waiting for a slot, nearest-first        */
  var known = {};       /* key -> true|false, "has a recording"          */
  var urls = {};        /* key -> object URL, revoked on teardown        */
  var io = null;
  var sizes = {};       /* key -> bytes, for the report                  */

  function wrapId(w) { return w.getAttribute('data-gbrec'); }

  /* THE WRAPPER A RECORDING STARTED IN IS NOT NECESSARILY THE ONE IT FINISHES
     IN. The Video grid re-renders on scroll, sort, filter and layout, and each
     render builds fresh nodes -- so a two-minute recording almost always
     outlives the element it was started against. Anything that runs at the END
     of a recording must therefore ask "where is this title NOW", not use the
     node it closed over, or it attaches the finished video to a detached
     element and the live tile is left with nothing. */
  function currentWrap(id) {
    return document.querySelector('#video-grid .gb-emu[data-gbrec="' + id + '"]');
  }

  /* =======================================================================
   *  PLAYBACK
   * ===================================================================== */
  function attachVideo(wrap, key, blob) {
    if (wrap.querySelector('video.gb-rec')) return;
    var art = wrap.querySelector('.gb-emu-art');
    if (!urls[key]) urls[key] = URL.createObjectURL(blob);
    var v = document.createElement('video');
    v.className = 'gb-rec';
    v.muted = true; v.loop = true; v.playsInline = true;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    v.preload = 'auto';
    v.src = urls[key];
    /* Behind the console art's screen window, exactly where the canvas sat --
       the CSS in emby.js mirrors the .gbdev canvas rules onto this element. */
    if (art && art.nextSibling) wrap.insertBefore(v, art.nextSibling);
    else wrap.appendChild(v);
    wrap.classList.add('has-rec');
    /* Only start it if it can actually be seen. Tiles are now converted
       regardless of scroll position, so most videos are attached far off-screen
       and starting them all would put the decoder cost straight back in. The
       observer starts this one when it approaches -- from the beginning. */
    if (nearNow(wrap)) ensurePlaying(v);
  }

  /* GETTING A VIDEO TO PLAY IS NOT ONE CALL.
   *
   * `v.play()` returns a promise, and a play issued in the same tick as the
   * `src` assignment can reject with AbortError because the load that play was
   * waiting on is superseded by the load the assignment starts. The original
   * code did `v.play().catch(function(){})` -- so the rejection was swallowed,
   * nothing retried, and the tile sat on a black first frame forever. It looked
   * exactly like a broken recording; the file was perfect and simply never got
   * a second ask.
   *   So: try, and if that fails wait for the element to actually have data and
   * try once more. Still silent on the second failure, because by then it is a
   * real refusal (an autoplay policy, say) and not a race. */
  function ensurePlaying(v) {
    if (!v || !v.isConnected) return;
    var p;
    try { p = v.play(); } catch (e) { return; }
    if (!p || !p.catch) return;
    p.catch(function () {
      if (!v.isConnected) return;
      v.addEventListener('canplay', function once() {
        v.removeEventListener('canplay', once);
        if (v.isConnected && nearNow(v.parentElement)) { try { v.play().catch(function () {}); } catch (e) {} }
      });
    });
  }

  /* The same reach the observer uses, answered from geometry. Needed because a
     video can be attached at a moment when no observer entry is pending. */
  function nearNow(el) {
    /* Via index.html's _mNear() where it exists -- the card's cached box, not
       a fresh measurement of this wrapper, so the sweep is compatible with
       `content-visibility: auto` on .device-card. Note this copy has never
       tested height > 0 and still does not: _mNear does, and a placed card
       always has one, so the only behaviour that changes is for a card in a
       display:none panel, which this sweep should not be playing anyway. */
    if (window._mNear) return window._mNear(el, NEAR_PX);
    var r = el.getBoundingClientRect();
    return r.bottom > -NEAR_PX && r.top < (window.innerHeight || 0) + NEAR_PX;
  }

  /* A tile coming back toward the viewport starts AT THE BEGINNING, so the
     viewer sees the boot logo rather than arriving mid-loop. That is the whole
     reason the recording starts at power-on. */
  function restart(wrap) {
    var v = wrap.querySelector('video.gb-rec');
    if (!v) return;
    /* Back to the boot logo, which is the reason the recording starts at
       power-on. Seeking a stream that has not loaded its metadata yet throws,
       so the seek is guarded and the play is retried by ensurePlaying(). */
    try { v.currentTime = 0; } catch (e) {}
    ensurePlaying(v);
  }
  function pauseTile(wrap) {
    var v = wrap.querySelector('video.gb-rec');
    if (v) v.pause();
  }

  /* =======================================================================
   *  RECORDING
   * ===================================================================== */
  function canRecord() { return ENABLED && SUPPORTED && liveCount < MAX_LIVE; }

  function enqueue(wrap) {
    if (!ENABLED) return;            /* nothing waits for a slot that cannot open */
    if (queue.indexOf(wrap) >= 0) return;
    queue.push(wrap);
    pump();
  }

  function pump() {
    if (document.hidden) return;      /* nothing may start in a hidden tab */
    /* THE FOUR SLOTS GO TO THE FIRST FOUR TILES ON THE PAGE.
     *
     * The queue used to be filled in IntersectionObserver delivery order, and
     * that order is not document order -- entries arrive batched and unsorted,
     * so which four of the visible tiles got the slots was effectively
     * arbitrary. Watching it, the top of the wall would sit dead while
     * something further down recorded, which is the opposite of what a viewer
     * expects and reads as "it is not working".
     *   Sorted at pump time rather than at insert, because the answer changes
     * as the page scrolls and only the moment a slot frees actually matters. */
    if (queue.length > 1) {
      /* Document-space top, from the sweep cache when index.html supplies it:
         the queue can hold every unconverted tile on the wall, and measuring
         each one here would un-skip that many content-visibility subtrees. */
      var y = window._mSweepRect
        ? function (el) { return window._mSweepRect(el).top + window.scrollY; }
        : function (el) { return el.getBoundingClientRect().top + window.scrollY; };
      queue.sort(function (a, b) { return y(a) - y(b); });
    }
    while (canRecord() && queue.length) {
      var w = queue.shift();
      if (!document.body.contains(w)) continue;
      if (w.querySelector('video.gb-rec')) continue;
      startRecording(w);
    }
  }

  /* Kill one attempt and put its title back in the queue. Safe to call twice:
     the recorder's own state guard makes the second stop a no-op, and onstop
     runs exactly once. */
  function abortEntry(entry) {
    if (!entry || entry.aborted) return;
    entry.aborted = true;
    try { if (entry.rec && entry.rec.state !== 'inactive') entry.rec.stop(); } catch (e) {}
  }
  function abortAll() { Object.keys(live).forEach(function (k) { abortEntry(live[k]); }); }

  /* A SLOT MUST NEVER BE HELD BY SOMETHING THAT IS NOT RECORDING.
   *
   * Four slots and a queue is a design with exactly one catastrophic failure:
   * an entry that neither finishes nor releases. It happened -- the first batch
   * completed, its four entries stayed in `live`, liveCount stayed at 4, and
   * the remaining sixteen titles never started. No error, no symptom except a
   * wall that stops converting, which is indistinguishable from "it is just
   * slow" until you count.
   *   So the invariant is enforced rather than assumed. Any entry past its own
   * deadline, or whose recorder is no longer recording, is torn down and its
   * slot returned. This is a backstop for a bug, not a mechanism -- if it ever
   * fires in normal operation something else is wrong, so it says so. */
  setInterval(function () {
    if (!ENABLED) return;            /* nothing can be live, so nothing can stick */
    var now = Date.now(), stuck = [];
    Object.keys(live).forEach(function (k) {
      var e = live[k];
      if (!e) { stuck.push(k); return; }
      var overdue = now - (e.startedAt || 0) > MAX_MS + 20000;
      var dead = e.rec && e.rec.state === 'inactive' && !e.done;
      /* Recording into a wrapper that is no longer in the document produces a
         perfectly good file for a tile nobody is looking at, while a real tile
         waits for the slot. Give it a few seconds' grace so a mid-render blink
         is not mistaken for a departure. */
      var orphan = e.wrap && !document.body.contains(e.wrap) && !currentWrap(e.id)
                   && (now - (e.startedAt || 0) > 8000);
      if (overdue || dead || orphan) stuck.push(k);
    });
    if (!stuck.length) return;
    console.warn('[gbrec] watchdog reclaiming ' + stuck.length + ' stuck slot(s): ' + stuck.join(', '));
    stuck.forEach(function (k) {
      var e = live[k];
      if (e) {
        e.aborted = true;
        try { if (e.rec && e.rec.state !== 'inactive') e.rec.stop(); } catch (x) {}
        try { if (e.dev) { e.dev.stop(); e.dev.teardown(); } } catch (x) {}
      }
      delete live[k];
      var w = e && e.id ? currentWrap(e.id) : null;
      if (w) requeue(w);
    });
    liveCount = Object.keys(live).length;      /* the count follows the map, always */
    pump();
  }, 5000);
  function requeue(wrap) {
    if (wrap && document.body.contains(wrap) && queue.indexOf(wrap) < 0) queue.unshift(wrap);
  }
  /* One listener for the whole module, on top of the per-attempt one: it also
     restarts the queue when the tab comes back, so a wall left in a background
     tab resumes converting itself the moment it is looked at again. */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) abortAll(); else pump();
  });

  function startRecording(wrap) {
    if (!ENABLED) return;            /* belt and braces: canRecord() already said no */
    var id = wrapId(wrap);
    if (!id) return;
    /* Never begin in the background: the machine would not step, and the first
       seconds of the loop are the boot logo, which is the part that matters. */
    if (document.hidden) { requeue(wrap); return; }
    var slot = id.slice(3);
    if (typeof _gbLoadEmbed !== 'function' || typeof _gbFetchCart !== 'function') return;
    var entry = { dev: null, rec: null, wrap: wrap, aborted: false, done: false,
                  id: id, startedAt: Date.now() };

    liveCount++;                              /* claim the slot BEFORE any await */
    var claimed = true;
    /* liveCount is decremented here AND recomputed by the watchdog from
       Object.keys(live). Two writers to one counter is how it drifted in the
       first place; the map is the truth and the counter is a cache of it. */
    function release() { if (claimed) { claimed = false; liveCount = Math.max(0, liveCount - 1); pump(); } }

    buildStamp().then(function (stamp) {
      var key = keyFor(id, stamp);
      if (live[key]) { release(); return; }
      /* ALREADY DONE IS A REASON NOT TO START, AND IT HAS TO BE CHECKED HERE.
       * consider() decides "record or play" against the tile it is looking at,
       * and then the tile is queued -- but the queue outlives the render. A
       * grid rebuild leaves stale wrappers in it, and a stale wrapper for a
       * title that has since been recorded would spend one of four slots
       * re-recording something already on disk. Observed: two of four slots
       * doing exactly that while ten titles waited.
       *   `known` is the in-memory answer; the store is the authority, because
       * another tab or an earlier visit may have recorded it. */
      if (known[key] === true) { release(); attachIfStored(id, key); return; }
      return getRec(key).then(function (r) {
        if (r && r.blob) {
          known[key] = true; sizes[key] = r.blob.size;
          release();
          var w = currentWrap(id);
          if (w && !w.querySelector('video.gb-rec')) attachVideo(w, key, r.blob);
          return;
        }
        return startRecordingNow();
      });

      function attachIfStored(theId, theKey) {
        var w = currentWrap(theId);
        if (!w || w.querySelector('video.gb-rec')) return;
        getRec(theKey).then(function (rr) {
          var w2 = currentWrap(theId);
          if (rr && rr.blob && w2 && !w2.querySelector('video.gb-rec')) attachVideo(w2, theKey, rr.blob);
        });
      }

      function startRecordingNow() {
      return _gbLoadEmbed().then(function (GameBoyDevice) {
        return _gbFetchCart(slot).then(function (bytes) {
          if (!bytes || !document.body.contains(wrap)) { release(); return; }
          var kind = (typeof _gbDeviceFor === 'function') ? _gbDeviceFor(id) : 'dmg';
          if (!kind) { release(); return; }
          /* `_gbBiosCgb` is a top-level `let` in index.html, which lives in the
             global LEXICAL scope and never appears on `window` -- reading it off
             window would be a silent undefined, and every colour title would be
             refused here for the wrong reason. Read the binding directly. */
          if (kind === 'cgb' && (typeof _gbBiosCgb === 'undefined' || !_gbBiosCgb)) { release(); return; }

          /* No `palette` option -- the embed's DEFAULT_PALETTE applies, so what
             gets recorded is exactly what the catalogue tiles and a first-run
             play page show. Passing one here would be a second place to change
             the skin and the first one to be forgotten. */
          var dev = new GameBoyDevice(_gbHost, {
            label: slot, device: kind,
            /* useBios TRUE is not optional here: the boot logo IS the opening
               of every loop, and for a colour title the CGB boot sequence is
               what puts the palette on screen. A recording made without a boot
               program would start mid-air. */
            useBios: true
          });
          /* THE ASSERTION THAT KEEPS REC_PALETTE HONEST. This file cannot import
             DEFAULT_PALETTE, so it checks the device it just built against the
             constant the key was computed from. If someone changes the default
             and not this, every DMG recording would be filed under a palette it
             was not made in -- and nothing else would ever say so. */
          if (kind !== 'cgb' && dev.palette !== REC_PALETTE) {
            console.error('[gbrec] palette drift: recording in "' + dev.palette +
                          '" but keys say "' + REC_PALETTE + '". Update REC_PALETTE in gbrec.js ' +
                          'to match DEFAULT_PALETTE in play/gameboy/web/shell.js. Not recording.');
            dev.teardown(); release(); return;
          }
          dev.mount(wrap);
          var cv = dev.canvas;
          if (!cv) { dev.teardown(); release(); return; }

          /* Power on, THEN capture. mount() runs a self-test cart but never
             steps it, so nothing has been blitted yet and the first captured
             frame is the real machine's first frame. */
          if (!dev.setCart(bytes, { label: slot, useBios: true, device: kind })) {
            dev.teardown(); release(); return;
          }

          var stream, rec;
          try {
            stream = cv.captureStream(CAP_FPS);
            rec = new MediaRecorder(stream, { mimeType: MIME, videoBitsPerSecond: BITRATE });
          } catch (e) { dev.teardown(); release(); return; }

          /* NOTHING RECORDED IN A HIDDEN TAB IS EVER BANKED.
           *
           * The emulator is driven by requestAnimationFrame, which the browser
           * stops delivering when the tab is not the visible one. MediaRecorder
           * does NOT stop: it keeps sampling a canvas that has become a still
           * image. A wall-clock timer over a tab someone switched away from
           * therefore banks a mostly-frozen loop -- and banks it as FINISHED,
           * so the title is never recorded again and the wall is permanently
           * one dead tile worse.
           *
           * The obvious repair is to pause the recorder across the gap and
           * resume on return. That was rejected: it yields a loop stitched from
           * two sittings, and every recording is supposed to be one continuous
           * run from power-on -- that is the whole reason the boot logo opens
           * it. So a hide DISCARDS the attempt outright and the title goes back
           * on the queue to be recorded fresh, from power-on, when the tab is
           * visible again. Wasting ninety seconds of emulation is cheap; a
           * silently bad loop that never retries is not. */
          var chunks = [], t0 = performance.now(), timer = 0;
          function onVis() { if (document.hidden) abortEntry(entry); }
          rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
          rec.onstop = function () {
            if (entry.done) return;              /* onstop must run exactly once */
            entry.done = true;
            var ms = performance.now() - t0;
            wrap = currentWrap(id) || wrap;      /* the grid has probably re-rendered */
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', onVis);
            try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
            dev.stop(); dev.teardown();
            delete live[key];
            release();
            /* An aborted attempt is not a short recording -- it is no recording.
               Put the title back on the queue rather than leaving it converted
               to nothing, and do not mark it known. */
            wrap.classList.remove('ready');   /* the canvas it revealed is gone */
            if (entry.aborted) { requeue(wrap); return; }
            if (ms < MIN_MS || !chunks.length) { requeue(wrap); return; }
            var blob = new Blob(chunks, { type: MIME.split(';')[0] });
            sizes[key] = blob.size;
            /* The cartridge hash is stored WITH the recording so the seeding
               tool can publish it under the identity the shared library uses,
               without re-reading the cartridge. cartHash() is already cached by
               this point -- the bytes were decoded to record it. */
            cartHash(id).then(function (cartSha) {
            return putRec(key, { blob: blob, id: id, ms: Math.round(ms), w: REC_W, h: REC_H,
                          bitrate: BITRATE, fps: CAP_FPS, mime: MIME, made: Date.now(),
                          sha256: cartSha || null, source: 'local' })
              .then(function () {
                known[key] = true;
                if (document.body.contains(wrap)) {
                  wrap.innerHTML = '';
                  var art = document.createElement('img');
                  art.className = 'gb-emu-art';
                  art.src = _recArtFor(id); art.alt = '';
                  wrap.appendChild(art);
                  attachVideo(wrap, key, blob);
                }
              });
            });
          };

          /* THE CANVAS IS INVISIBLE UNTIL THE WRAPPER IS MARKED READY.
           * `.gb-emu .gbdev canvas` ships at opacity 0 and is revealed by
           * `.gb-emu.ready`, which the catalogue's shared rAF loop sets after
           * its first blit. This module drives the device with its own
           * dev.start() and so never went through that loop -- so a tile that
           * was recording perfectly showed a console with a dead grey screen,
           * indistinguishable from one that had failed. Two frames of margin so
           * the reveal lands on real output rather than on the cleared canvas. */
          requestAnimationFrame(function () { requestAnimationFrame(function () {
            if (document.body.contains(wrap)) wrap.classList.add('ready');
          }); });

          entry.dev = dev; entry.rec = rec; entry.wrap = wrap;
          live[key] = entry;
          document.addEventListener('visibilitychange', onVis);
          rec.start();
          dev.start();                                   /* self-driving rAF */
          /* The tab can go away between the visibility check at the top of
             startRecording() and here -- two awaits have happened since. */
          if (document.hidden) { abortEntry(entry); return; }
          timer = setTimeout(function () { try { rec.stop(); } catch (e) {} }, MAX_MS);
        });
      });
      }
    }).catch(function () { release(); });
  }

  /* The console art src, recovered from the catalogue the same way the tile
     builder does. Kept as a function so a missing catalogue degrades to no art
     rather than to a broken image. */
  function _recArtFor(id) {
    try {
      var d = ALL_DEVICES.find(function (x) { return x.id === id; });
      return d ? imgSrc(d.img) : '';
    } catch (e) { return ''; }
  }

  /* =======================================================================
   *  THE SWEEP
   * ===================================================================== */
  function observer() {
    if (io) return io;
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var w = en.target;
        if (en.isIntersecting) onNear(w); else pauseTile(w);
      });
    }, { rootMargin: NEAR_PX + 'px 0px' });
    return io;
  }

  /* WHAT THIS TILE NEEDS — asked for EVERY tile, not just the visible ones.
   *
   * Recording used to be armed by the IntersectionObserver, which tied the
   * conversion of the wall to how far someone had scrolled: a title below the
   * fold was never recorded, so the wall only ever converted the part of itself
   * that had been looked at, and the bottom stayed live-emulated forever.
   *   Recording and playback want opposite rules. PLAYBACK is about the
   * viewport -- a video nobody can see should not be decoding, and one coming
   * back into view must restart at the boot logo. RECORDING is about the four
   * slots and nothing else: it is work the page owes itself, and where the tile
   * happens to sit is irrelevant to whether the work is worth doing.
   *   So this runs over every tile on arm(), and the observer below now governs
   * playback only. The visible-tab rule is untouched and still absolute --
   * nothing records while the tab is hidden, because rAF is not delivered and
   * the footage would be a frozen frame. */
  function consider(wrap) {
    if (!ENABLED) return;                                /* recorder is off     */
    if (wrap.querySelector('video.gb-rec')) return;      /* already converted   */
    if (wrap.querySelector('.gbdev')) return;            /* already recording   */
    var id = wrapId(wrap);
    if (!id) return;
    buildStamp().then(function (stamp) {
      var key = keyFor(id, stamp);
      if (known[key] === false) { enqueue(wrap); return; }
      return getRec(key).then(function (r) {
        if (!document.body.contains(wrap)) return;
        if (r && r.blob) { known[key] = true; sizes[key] = r.blob.size; attachVideo(wrap, key, r.blob); }
        /* Not local: queue it for recording (asleep while ENABLED is off). */
        else { known[key] = false; if (ENABLED) enqueue(wrap); }
      });
    });
  }

  /* Approach is now a PLAYBACK event. It still calls consider() because a tile
     whose recording finished while it was off-screen has to pick the video up
     at some point, and arriving in view is the moment that matters. */
  function onNear(wrap) {
    if (wrap.querySelector('video.gb-rec')) { restart(wrap); return; }
    consider(wrap);
  }

  /* =======================================================================
   *  PRUNING RECORDINGS MADE BY A CORE THAT NO LONGER EXISTS
   * =======================================================================
   * The key is `id@build[~palette]` and the build is the sha256 of gb.wasm, so
   * a core rebuild does not INVALIDATE the old recordings -- it makes them
   * unaddressable. Nothing ever asks for them again, nothing ever overwrites
   * them, and the next visit re-records the whole wall beside them. Measured
   * 2026-09-24 on this machine: 146 records under SIX build stamps, of which
   * 30 were the current build. Five builds' worth of footage, held forever,
   * for a store whose whole live working set is thirty titles.
   *
   * WHY THIS IS AUTOMATIC WHEN clearDmg() DELIBERATELY IS NOT. clearDmg drops
   * recordings that a visitor can still SEE -- footage the wall is playing
   * right now, which the page would then spend two minutes per title making
   * again. That is a real cost and not this page's call to make. A superseded
   * build's recordings are the opposite: they are already unreachable by
   * construction, they cost the visitor storage quota and nothing else, and
   * deleting them cannot make the page re-record a single title it was not
   * going to re-record anyway.
   *
   * ONLY THE BUILD SEGMENT IS COMPARED, never the palette suffix. recSuffix()
   * asks _gbDeviceFor() which title is colour, and that table may not have
   * loaded when this runs -- on a miss it answers `dmg` for everything, which
   * would make every COLOUR recording of the current build look foreign.
   * Comparing `id@THIS[~anything]` against the current build alone cannot make
   * that mistake: a record of today's core is never deleted, whatever palette
   * it wears. A palette change is already handled the way its own comment says,
   * by the key going unmatched, and is not this function's business.
   *
   * And if the build cannot be identified at all (`nowasm` -- the fetch failed,
   * the file is missing), NOTHING is deleted. An unknown build must never read
   * as "everything stored is foreign". */
  function _buildOf(k) {
    k = String(k);
    var at = k.indexOf('@');
    if (at < 0) return null;                       /* not a recording key      */
    var rest = k.slice(at + 1), tilde = rest.indexOf('~');
    return tilde < 0 ? rest : rest.slice(0, tilde);
  }
  function pruneStale() {
    return buildStamp().then(function (stamp) {
      if (!stamp || stamp === 'nowasm') return { dropped: 0, bytes: 0, skipped: 'build unknown' };
      return allKeys().then(function (keys) {
        var doomed = (keys || []).filter(function (k) {
          if (String(k).indexOf('hash:') === 0) return false;   /* another namespace */
          var b = _buildOf(k);
          return b !== null && b !== stamp;
        });
        if (!doomed.length) return { dropped: 0, bytes: 0 };
        var bytes = 0, chain = Promise.resolve();
        doomed.forEach(function (k) {
          chain = chain.then(function () {
            return getRec(k).then(function (r) {
              if (r && r.blob) bytes += r.blob.size;
              try { if (urls[k]) { URL.revokeObjectURL(urls[k]); delete urls[k]; } } catch (e) {}
              delete known[k]; delete sizes[k];
              return idb('readwrite', function (st) { return st.delete(k); });
            });
          });
        });
        return chain.then(function () {
          console.log('[gbrec] pruned ' + doomed.length + ' recording(s) from superseded core builds, ' +
                      (bytes / 1048576).toFixed(1) + ' MB reclaimed');
          return { dropped: doomed.length, bytes: bytes };
        });
      });
    }).catch(function () { return { dropped: 0, bytes: 0, skipped: 'error' }; });
  }
  var _prunedThisLoad = false;

  /** Called by emby.js after every Video-page render. */
  function arm() {
    /* THE DOOR, AND IT IS SHUT. Everything past this line touches the store or
       the slots. With the recorder off there is also nothing to find: the Video
       page ships its Game Boy tiles as `data-gb`, so the selector below matches
       zero elements anyway. Both are true on purpose -- the flag is the rule and
       the markup follows it, rather than the markup being the rule. */
    if (!ENABLED) return;
    /* Once per page load, not once per render: the store is shared by every
       render and a second sweep would have nothing left to find. Deliberately
       not awaited -- nothing on the wall waits on a delete. */
    if (!_prunedThisLoad) { _prunedThisLoad = true; pruneStale(); }
    var wraps = document.querySelectorAll('#video-grid .gb-emu[data-gbrec]');
    if (!wraps.length) return;
    for (var i = 0; i < wraps.length; i++) {
      observer().observe(wraps[i]);   /* playback: start, restart, pause       */
      consider(wraps[i]);             /* recording: queue it wherever it sits  */
    }
  }

  /* =======================================================================
   *  REPORTING — what the recordings actually cost, per title
   * ===================================================================== */
  function report() {
    return buildStamp().then(function (stamp) {
      return openDb().then(function () { return allKeys(); }).then(function (keys) {
        keys = keys || [];
        var chain = Promise.resolve(), rows = [];
        keys.forEach(function (k) {
          chain = chain.then(function () {
            return getRec(k).then(function (r) {
              if (r && r.blob) rows.push({
                key: k, id: r.id, kb: Math.round(r.blob.size / 1024),
                sec: Math.round((r.ms || 0) / 1000), px: r.w + 'x' + r.h,
                kbps: r.bitrate ? Math.round(r.bitrate / 1000) : null,
                stale: k.indexOf('@' + stamp) < 0
              });
            });
          });
        });
        return chain.then(function () {
          rows.sort(function (a, b) { return b.kb - a.kb; });
          var total = rows.reduce(function (s, r) { return s + r.kb; }, 0);
          return { stamp: stamp, count: rows.length, totalKB: total,
                   avgKB: rows.length ? Math.round(total / rows.length) : 0, rows: rows };
        });
      });
    });
  }

  function stats() {
    return { enabled: ENABLED, supported: SUPPORTED, mime: MIME, maxLive: MAX_LIVE,
             liveNow: liveCount, queued: queue.length,
             /* The keys of what is recording, so an empty array is the healthy
                reading while the flag is off. `.length` is the number to check. */
             recording: Object.keys(live).map(function (k) { return k; }) };
  }

  /** Drop every DMG recording and keep the colour ones.
   *
   * The palette suffix already makes stale recordings unreachable, so this is
   * about space rather than correctness: without it the old footage sits in
   * IndexedDB forever, keyed under a palette nothing will ask for again.
   *
   * A maintenance action, called by hand. It is deliberately NOT automatic on
   * load -- deleting a visitor's cache every visit to reclaim a few megabytes
   * is not a trade this page gets to make on their behalf.
   */
  function clearDmg() {
    return allKeys().then(function (keys) {
      var doomed = (keys || []).filter(function (k) {
        k = String(k);
        if (k.indexOf('hash:') === 0) return false;      /* cartridge hashes are palette-free */
        var id = k.split('@')[0];
        var kind = (typeof _gbDeviceFor === 'function') ? _gbDeviceFor(id) : 'dmg';
        return kind !== 'cgb';
      });
      var chain = Promise.resolve();
      doomed.forEach(function (k) {
        chain = chain.then(function () {
          try { if (urls[k]) { URL.revokeObjectURL(urls[k]); delete urls[k]; } } catch (e) {}
          delete known[k]; delete sizes[k];
          return idb('readwrite', function (st) { return st.delete(k); });
        });
      });
      return chain.then(function () {
        console.log('[gbrec] dropped ' + doomed.length + ' DMG recording(s); colour recordings kept');
        return { dropped: doomed.length };
      });
    });
  }

  /** Drop everything — used when a content pack closes, and by hand in testing. */
  function clearAll() {
    Object.keys(urls).forEach(function (k) { try { URL.revokeObjectURL(urls[k]); } catch (e) {} });
    urls = {}; known = {}; sizes = {};
    return idb('readwrite', function (s) { return s.clear(); });
  }

  /* Live switch, the same shape gbvideo.js uses. Turning it OFF also drops
     whatever is mid-capture, because a half-recorded loop is not a recording
     and a slot held by a dead attempt is the one failure the watchdog exists
     for. Turning it ON does not retro-fit the tiles: the Video page's markup is
     chosen at render time from this flag, so re-render the page (or reload)
     and the `data-gbrec` mounts come back. */
  function setEnabled(on) {
    ENABLED = !!on;
    if (!ENABLED) { abortAll(); queue.length = 0; }
    else { if (typeof arm === 'function') arm(); }
    return ENABLED;
  }

  window.GBREC = { arm: arm, report: report, stats: stats, clearAll: clearAll,
                   setEnabled: setEnabled, get ENABLED() { return ENABLED; },
                   clearDmg: clearDmg, pruneStale: pruneStale, recSuffix: recSuffix,
                   get REC_PALETTE() { return REC_PALETTE; },
                   buildStamp: buildStamp, keyFor: keyFor,
                   get MAX_LIVE() { return MAX_LIVE; } };
})();

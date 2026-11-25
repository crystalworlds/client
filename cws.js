/* ===========================================================================
   cws.js  --  the CrystalVault Server client
   ---------------------------------------------------------------------------
   Lets this site play the cartridges on a person's own game servers. Built
   from the server's published contract only (CrystalWorldsServer docs/API.md
   and api/openapi.yaml, API 1.0.0-draft.1); the section numbers below are that
   document's.

   WHAT IT DOES, IN ORDER
     1. Finding a server, two ways:
        - Direct connection (2.4a, added 2026-10-10): the visitor types a server's
          host[:port] in Settings, Game servers, Direct connect. The typed address
          is the confirmation, and pairing sends "direct" with the vault's
          identity signed by the vault key (never the vault code).
        - Over the internet: cws-reach.mjs finds the servers that list this
          vault's connection key through the CrystalWorlds introducer and opens
          a WebRTC data channel to each.
     2. Health: the typed address, or the data channel, must answer with the
        expected server_id; a different one is a failure, never a success.
     3. Pairing (2.4, 2.5): asks the owner to approve this device, shows the
        match code while it waits, and stores the device token per vault and per
        server in localStorage['cws.servers.v1'].
     4. No PIN at a server: the owner's approval is the trust. The vault's
        own PIN is asked by cws-reach.mjs where the vault needs it.
     5. Library (6, 8): every reachable server's listing merged by SHA-256, so a
        cartridge held twice is shown once; titles become ordinary tiles through
        the site's existing manifests (gb, nes, atari, Pokemon mini).
     6. Downloads (6.3, 8.3, 8.4): ranged and resumable, failing over between
        servers, verified by SHA-256 before a byte reaches a core.
     7. Forgetting a server, revocation and vault changes clear its tokens and
        the cartridges only it supplied, including the play windows' caches.

   WITH NO SERVER LINKED NOTHING CHANGES: nothing is sent to any server, the
   Settings card shows the two ways to add one, and every hook in index.html is
   a no-op because nothing is listed.

   SECRETS: the vault code, device tokens, poll secrets and PINs are never
   logged, never put in a URL and never sent anywhere but where the contract
   says. Tokens travel only in the Authorization header to their own server.
   ======================================================================== */
(function () {
  'use strict';

  var API_MAJOR = '1';
  /* Game servers over the internet, through the CrystalWorlds introducer and
     WebRTC, and the vault as the person's identity on the site (a name, a
     picture and a PIN that every vault without them sets on the welcome
     screen): both live in cws-reach.mjs, which is always loaded. A server on
     the home network is still reached by its typed address (Direct connect)
     first, exactly as before. */
  var R = null, _reachP = null;
  function loadReach() {
    if (_reachP) return _reachP;
    /* Through Function, so a browser that cannot read import() still reads this file. */
    _reachP = Promise.resolve().then(function () { return (new Function('u', 'return import(u)'))('./cws-reach.mjs?v=2.3.0-nowelcome'); })
      .then(function (m) { R = m && m.default; return R; }, function (e) { warn('reach not loaded', e && e.message); return null; });
    return _reachP;
  }
  /* Reached over the internet now? A server with a typed address too is tried at home first (s.via). */
  function isRtc(s) { if (!s || !s.listing || !s.listing.rtc) return false; return s.listing.direct ? s.via === 'rtc' : true; }
  var K_TOKENS = 'cws.servers.v1';       // {vhp: {sid: {device_id, device_token, profile_id, profile_name}}}
  var K_TOKENS_R = 'cws.servers.remote.v1';   // REACH: the same, for passes made over the internet (a server issues one pass per connection kind)
  var K_CONFIRM = 'cws.confirmed.v1';    // {vhp: {sid: 'yes' | 'no'}}  ('no': set aside on this browser)
  var K_PAIR = 'cws.pairing.v1';         // {vhp: {sid: {request_id, poll_secret, match_code, expires_at}}}
  var K_WITHDRAWN = 'cws.withdrawn.v1';  // {vhp: {sid: iso time}}: the server's owner withdrew this browser
  var K_DIRECT = 'cws.direct.v1';        // {vhp: {sid: {host, port, scheme}}}  (2.4a: typed by the user)
  var K_GB_SHA1 = 'gnw.gb.cartSha1.v1';  // emby.js / gbvideo.js art lookup, {deviceId: UPPERHEX}
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var SID_RE = /^[a-z2-7]{26}$/;
  var SHA_RE = /^[0-9a-f]{64}$/;

  /* T_FIRST_BYTE (20 Nov 2026, 3 s -> 15 s): a game server whose library drive was busy took 3.8 and 7.7 s to
     start sending a 128 KB Game Boy file, and the old 3 s gave up on it. T_SLOW_NOTE: after this long with no
     bytes from a server that answered, the loading bar says the server is busy (the 'slow' event). */
  var T_ATTEMPT = 3000, T_FIRST_BYTE = 15000, T_STALL = 10000, T_SLOW_NOTE = 3000;
  var R_SLOW = 'your game server didn’t answer in time.';
  var T_FAIL_MEMORY = 5 * 60 * 1000, T_BAD_HASH = 30 * 60 * 1000;
  var T_REFRESH = 5 * 60 * 1000;
  var MAX_PARALLEL = 3;
  var CACHE_CAP = 200 * 1024 * 1024;

  /* ---------------------------------------------------------------- state */
  var C = {
    vault: null, vhp: null,
    servers: {},          // sid -> server record (see newServer)
    bySha: {}, byId: {}, boot: {},  // merged library
    added: { gb: {}, nes: {}, atari: {}, pm: {} },
    signature: '',
    events: [],           // debug trail, no secrets
    ready: null, readyResolve: null,
    unsupported: 0
  };
  C.ready = new Promise(function (r) { C.readyResolve = r; });

  function ev(kind, data) {
    var e = { t: Date.now(), kind: kind };
    if (data) for (var k in data) e[k] = data[k];
    var last = C.events[C.events.length - 1];
    if (kind === 'progress' && last && last.kind === 'progress' && last.id === e.id && last.server === e.server) C.events[C.events.length - 1] = e;
    else { C.events.push(e); if (C.events.length > 400) C.events.shift(); }
    try { window.dispatchEvent(new CustomEvent('cws:' + kind, { detail: e })); } catch (x) {}
  }
  function warn() { try { console.warn.apply(console, ['[cws]'].concat([].slice.call(arguments))); } catch (e) {} }

  /* ---------------------------------------------------------------- storage */
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function slot(k, sid, val) {   // read or write one vault+server cell of a keyed store
    var all = lsGet(k), v = all[C.vhp] || {};
    if (arguments.length < 3) return v[sid];
    if (val === undefined || val === null) delete v[sid]; else v[sid] = val;
    if (Object.keys(v).length) all[C.vhp] = v; else delete all[C.vhp];
    lsSet(k, all);
  }
  function slotAll(k) { return lsGet(k)[C.vhp] || {}; }

  /* ---------------------------------------------------------------- hashing
     crypto.subtle is missing on plain-HTTP pages (a LAN test copy of the site),
     and every download must still be verified, so a small SHA-256 is carried. */
  var K256 = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  function sha256js(bytes) {
    var l = bytes.length, n = ((l + 9 + 63) >> 6) << 6, buf = new Uint8Array(n);
    buf.set(bytes); buf[l] = 0x80;
    var dv = new DataView(buf.buffer);
    dv.setUint32(n - 8, Math.floor(l / 0x20000000)); dv.setUint32(n - 4, (l << 3) >>> 0);
    var h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    var w = new Int32Array(64);
    for (var i = 0; i < n; i += 64) {
      for (var t = 0; t < 16; t++) w[t] = dv.getInt32(i + t * 4);
      for (t = 16; t < 64; t++) {
        var x = w[t - 15], y = w[t - 2];
        var s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        var s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (t = 0; t < 64; t++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var t1 = (hh + S1 + ((e & f) ^ (~e & g)) + K256[t] + w[t]) | 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    var out = '';
    for (i = 0; i < 8; i++) out += ('00000000' + (h[i] >>> 0).toString(16)).slice(-8);
    return out;
  }
  function sha256(bytes) {
    if (window.crypto && crypto.subtle && window.isSecureContext) {
      return crypto.subtle.digest('SHA-256', bytes).then(function (b) {
        return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
      }).catch(function () { return sha256js(bytes); });
    }
    return Promise.resolve(sha256js(bytes));
  }
  function utf8(s) { return new TextEncoder().encode(s); }
  /* The per-vault storage partition (2.5's "vault hash prefix"). Prefixed, and
     never sent anywhere. */
  function storeKey(code) { return sha256(utf8('cws-client-store-v1\u0000' + code)).then(function (h) { return h.slice(0, 16); }); }

  function b64(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(out);
  }

  /* ---------------------------------------------------------------- IndexedDB
     'listings': each server's last listing, so its titles stay on the shelf
                 (unplayable) while it is unreachable (2.10).
     'carts':    verified cartridges, keyed by SHA-256, with the servers that
                 supplied them; capped, least recently used goes first. */
  var _db = null;
  function db() {
    if (_db) return _db;
    _db = new Promise(function (res, rej) {
      var r = indexedDB.open('cws-cache', 1);
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains('listings')) d.createObjectStore('listings');
        if (!d.objectStoreNames.contains('carts')) d.createObjectStore('carts').createIndex('t', 't');
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    }).catch(function () { return null; });
    return _db;
  }
  function idb(store, mode, fn) {
    return db().then(function (d) {
      if (!d) return null;
      return new Promise(function (res) {
        var tx = d.transaction(store, mode), out = null;
        try { out = fn(tx.objectStore(store)); } catch (e) { res(null); return; }
        tx.oncomplete = function () { res(out && 'result' in out ? out.result : out); };
        tx.onerror = tx.onabort = function () { res(null); };
      });
    }).catch(function () { return null; });
  }
  function cacheGet(sha) {
    return idb('carts', 'readonly', function (s) { return s.get(sha); }).then(function (v) {
      if (!v || !v.bytes || v.vhp !== C.vhp) return null;
      idb('carts', 'readwrite', function (s) { v.t = Date.now(); s.put(v, sha); });
      return new Uint8Array(v.bytes);
    });
  }
  function cachePut(sha, bytes, holders) {
    var rec = { bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), holders: holders, vhp: C.vhp, t: Date.now(), z: bytes.length };
    return idb('carts', 'readwrite', function (s) { s.put(rec, sha); }).then(trimCacheSoon);
  }
  /* One trim 3 s after the last put (28 Oct): the trim reads every cached game file
     back (up to the 200 MB cap), and the wall's live tiles put one file after another. */
  var _trimT = 0;
  function trimCacheSoon() { clearTimeout(_trimT); _trimT = setTimeout(trimCache, 3000); }
  function trimCache() {
    return db().then(function (d) {
      if (!d) return;
      var tx = d.transaction('carts', 'readwrite'), st = tx.objectStore('carts'), total = 0, rows = [];
      st.index('t').openCursor().onsuccess = function (e) {
        var cur = e.target.result;
        if (cur) { rows.push({ k: cur.primaryKey, z: cur.value.z || 0 }); total += cur.value.z || 0; cur.continue(); return; }
        for (var i = 0; i < rows.length && total > CACHE_CAP; i++) { st.delete(rows[i].k); total -= rows[i].z; }
      };
    }).catch(function () {});
  }

  /* ---------------------------------------------------------------- helpers */
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmtTime(ms) { return new Date(ms).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }); }
  function plural(n, a, b) { return n + ' ' + (n === 1 ? a : (b || a + 's')); }
  /* SWITCHED OFF (28 Oct; source-switch.js): the game servers' switch in Settings is
     off. Nothing is sent to any server or to the vault's server list, and the library is built
     as if no server were joined. Tokens, pairings, addresses and the cached listings are kept,
     so on again is one refresh. */
  function cwsOff() { try { return !!(window.CwSources && !window.CwSources.on('cws')); } catch (e) { return false; } }
  function timedFetch(url, opt, ms) {
    if (cwsOff()) return Promise.reject(Object.assign(new Error('Game servers are switched off in Settings.'), { status: 0, code: 'network' }));
    if (/^rtc:/.test(url)) return R ? R.fetch(url, opt || {}, ms) : Promise.reject(Object.assign(new Error('not connected'), { status: 0, code: 'network' }));   // REACH: a data channel
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, ms);
    /* A caller's own signal (the endpoint race cancelling the losers) is
       followed too. It used to replace this one, so the time limit never
       applied when a caller passed a signal: an address with no answer then
       waited for the browser's own limit (about 20 s) instead of 3 s. */
    var outer = opt && opt.signal;
    if (outer) { if (outer.aborted) ctl.abort(); else outer.addEventListener('abort', function () { ctl.abort(); }); }
    opt = Object.assign({ mode: 'cors', credentials: 'omit', cache: 'no-store' }, opt || {}, { signal: ctl.signal });
    return fetch(url, opt).then(function (r) { clearTimeout(t); return r; }, function (e) { clearTimeout(t); throw e; });
  }
  function siteVersion() {
    var el = document.querySelector('#vault-overlay .modal-title');
    var m = el && /(\d+\.\d+\.\d+)/.exec(el.textContent || '');
    return m ? m[1] : '2.3.0';
  }
  function deviceDescription() {
    var ua = navigator.userAgent || '', m, browser = 'Web browser', os = 'Unknown system';
    if ((m = /Edg\/(\d+)/.exec(ua))) browser = 'Edge ' + m[1];
    else if ((m = /SamsungBrowser\/(\d+)/.exec(ua))) browser = 'Samsung Internet ' + m[1];
    else if ((m = /Firefox\/(\d+)/.exec(ua))) browser = 'Firefox ' + m[1];
    else if ((m = /(?:Headless)?Chrome\/(\d+)/.exec(ua))) browser = 'Chrome ' + m[1];
    else if (/Safari\//.test(ua)) browser = 'Safari';
    if (/Tizen/.test(ua)) os = 'Samsung TV';
    else if (/Windows NT/.test(ua)) os = 'Windows';
    else if (/Android/.test(ua)) os = 'Android';
    else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
    else if (/Mac OS X/.test(ua)) os = 'macOS';
    else if (/CrOS/.test(ua)) os = 'ChromeOS';
    else if (/Linux/.test(ua)) os = 'Linux';
    return { device_name: (browser + ' on ' + os).slice(0, 64), browser: browser.slice(0, 64), os: os.slice(0, 64),
             client: { name: 'crystalworlds.media', version: siteVersion() } };
  }
  function toastSafe(msg, kind) {
    try {
      if (kind === 'error' && typeof toastErr === 'function') return toastErr(msg);
      if (kind === 'ok' && typeof toastOk === 'function') return toastOk(msg);
      if (typeof toastWarn === 'function') return toastWarn(msg);
    } catch (e) {}
  }

  /* ---------------------------------------------------------------- servers */
  function newServer(sid) {
    return { id: sid, listing: null, state: 'idle', msg: '', base: '', kind: '', rtt: Infinity,
             name: '', profile: '', clockSkew: 0, items: null, bootItems: null, etag: '', revision: '',
             failUntil: 0, badUntil: 0, retryAt: 0, pairing: null, pollTimer: 0, absent: {}, session: null,
             fresh: false, setupComplete: true };
  }
  function srvOf(sid) { return C.servers[sid] || (C.servers[sid] = newServer(sid)); }
  function confirmed(sid) { return slot(K_CONFIRM, sid) === 'yes'; }
  function hidden(sid) { return slot(K_CONFIRM, sid) === 'no'; }
  function tokKey(sid) { return isRtc(C.servers[sid]) ? K_TOKENS_R : K_TOKENS; }   // the pass matching the connection in use
  function tokenOf(sid) { return slot(tokKey(sid), sid) || null; }
  function label(s) {
    if (!s.name) return 'Game server ' + s.id.slice(0, 6).toUpperCase();
    var twin = Object.keys(C.servers).some(function (k) { return k !== s.id && C.servers[k].name === s.name; });
    return twin ? s.name + ' (' + s.id.slice(0, 4).toUpperCase() + ')' : s.name;   // two machines, one name
  }
  function setState(s, state, msg) {
    s.state = state; s.msg = msg || '';
    ev('state', { server: s.id, state: state });
    render();
  }

  /* ---------------------------------------------------------------- reaching a server
     A typed address (Direct connect), or the data channel cws-reach.mjs opened. */
  function schemeFor(host) { return (host === 'localhost' || host === '127.0.0.1') ? 'http://' : 'https://'; }
  function hostPart(host) { return host.indexOf(':') >= 0 && host.charAt(0) !== '[' ? '[' + host + ']' : host; }
  function healthAt(ep, sid, ctl) {
    var base = (ep.scheme || schemeFor(ep.host)) + hostPart(ep.host) + ':' + ep.port;
    var t0 = performance.now();
    return timedFetch(base + '/api/v1/health', { method: 'GET', signal: ctl.signal }, T_ATTEMPT).then(function (r) {
      if (r.status !== 200) throw new Error('health ' + r.status);
      return r.json();
    }).then(function (j) {
      if (!j || (sid && j.server_id !== sid)) throw new Error('wrong server');  // never a success
      return { ep: ep, health: j, rtt: performance.now() - t0, base: base };
    });
  }
  function locate(s) {
    var l = s.listing; if (!l) return Promise.reject(new Error('no listing'));
    /* REACH: the connection the introducer set up, and the server's health answer over it. */
    function overInternet() {
      if (!R) return Promise.reject(new Error('reach off'));
      return R.whenOpen(s.id, 15000).then(function (w) { s.via = 'rtc'; return { ep: { kind: w.kind }, health: w.health, rtt: w.rtt, base: w.base }; });
    }
    if (l.rtc && !l.direct) return overInternet();
    if (l.direct) {
      /* 2.4a: the address the user typed, and only it. A different server_id
         there is that address failing, never a success. */
      var ctl = new AbortController();
      var home = healthAt({ kind: 'lan', host: l.direct.host, port: l.direct.port, scheme: l.direct.scheme }, s.id, ctl).then(function (w) { s.via = 'direct'; return w; });
      return l.rtc ? home.catch(overInternet) : home;   // REACH: at home first, then over the internet
    }
    return Promise.reject(new Error('no address'));
  }

  /* ---------------------------------------------------------------- API calls */
  function apiErr(status, j, fallback) {
    var e = (j && j.error) || {};
    var x = new Error(e.message || fallback || ('HTTP ' + status));
    x.status = status; x.code = e.code || ''; x.info = e;
    return x;
  }
  function api(s, method, p, opt) {
    opt = opt || {};
    if (!s.base) return Promise.reject(Object.assign(new Error('not connected'), { status: 0, code: 'network' }));
    var h = {};
    if (opt.auth === 'device') {
      var t = tokenOf(s.id);
      if (!t) return Promise.reject(Object.assign(new Error('no token'), { status: 401, code: 'token_missing' }));
      h.Authorization = 'Bearer ' + t.device_token;
    } else if (opt.auth === 'poll') h.Authorization = 'CWS-Poll ' + opt.poll;
    if (opt.body) h['Content-Type'] = 'application/json';
    if (opt.headers) for (var k in opt.headers) h[k] = opt.headers[k];
    var t0 = performance.now();
    return timedFetch(s.base + '/api/v1' + p, { method: method, headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined }, opt.timeout || 20000)
      .catch(function (e) { throw Object.assign(new Error('network'), { status: 0, code: 'network', cause: e }); })
      .then(function (r) {
        s.rtt = Math.min(s.rtt, performance.now() - t0) * 0.5 + (performance.now() - t0) * 0.5;
        if (r.status === 204 || r.status === 304) return { status: r.status, json: null, headers: r.headers };
        return r.json().catch(function () { return null; }).then(function (j) {
          if (r.status >= 400) {
            var e = apiErr(r.status, j);
            var ra = r.headers.get('Retry-After');
            if (ra && !e.info.retry_after_seconds) e.info.retry_after_seconds = +ra;
            throw e;
          }
          return { status: r.status, json: j, headers: r.headers };
        });
      });
  }
  /* Device-level answers that change what this browser holds (2.5, 2.9, 4.4). */
  /* Withdrawn (4 Nov): remembered on this browser, so a reload
     or another tab still says so, never "not joined yet", and no PIN is
     asked. Asking again waits for the owner: the server holds this
     browser's vault code (server 2.4a), whatever this file does. */
  var WITHDRAWN_MSG = 'The server owner removed this browser.';
  var REMOVED_MSG = 'The server owner removed this vault.';
  function withdrawn(sid) { return !!slot(K_WITHDRAWN, sid); }
  function lostToken(s) {   // the token is gone: withdrawn here, or in another tab
    s.items = null; s.bootItems = null; s.session = null;
    dropServerContent(s.id, false);
    if (withdrawn(s.id)) setState(s, 'withdrawn', WITHDRAWN_MSG);
    else setState(s, 'unpaired', 'This browser\'s pass for this server is no longer valid. Ask again to join.');
    rebuild();
  }
  function onAuthError(s, e) {
    if (e.code === 'device_revoked' || e.code === 'token_invalid') {
      slot(tokKey(s.id), s.id, null);
      if (e.code === 'device_revoked') { removedByOwner(s, isRtc(s) ? REMOVED_MSG : WITHDRAWN_MSG); return true; }
      /* A pass the server no longer knows: asked for again quietly, once (approval is automatic while
         the vault is still approved). */
      if (e.code === 'token_invalid' && !s.mended) { s.mended = true; s.items = null; s.session = null; startPairing(s); return true; }
      if (e.code === 'device_revoked') slot(K_WITHDRAWN, s.id, new Date().toISOString());
      lostToken(s);
      return true;
    }
    if (e.code === 'token_missing' && !tokenOf(s.id) && s.state === 'ready') { lostToken(s); return true; }
    if (e.code === 'setup_incomplete') { setState(s, 'setup', 'The server\'s owner has not finished setting it up yet.'); return true; }
    if (e.code === 'origin_forbidden') { setState(s, 'error', 'This server does not accept this website yet. Its owner can allow it in the server\'s Security settings.'); return true; }
    return false;
  }

  /* The owner removed the person (over the internet: refused not_listed or device_revoked) or this
     browser (a typed address: device_revoked): the row goes and the tile shows the two ways again;
     over the internet a later re-add appears by itself. */
  function removedByOwner(s, msg) {
    var key = s.listing && s.listing.rtc && s.listing.rtc.server_key;
    [K_TOKENS, K_TOKENS_R, K_PAIR, K_CONFIRM, K_WITHDRAWN, K_DIRECT].forEach(function (k) { slot(k, s.id, null); });
    closePairingDialog(s, true);
    clearTimeout(s.pollTimer);
    dropServerContent(s.id, false);
    delete C.servers[s.id];
    if (R && key && R.untrust) R.untrust(key);
    toastSafe(msg || REMOVED_MSG, 'error');
    rebuild(); render();
  }

  /* ---------------------------------------------------------------- connect one server */
  function connect(s, why) {
    if (s.connecting) return s.connecting;
    var p = (function () {
      if (hidden(s.id)) { setState(s, 'hidden'); return Promise.resolve(); }
      if (!s.base || why === 'retry') {
        setState(s, 'connecting', 'Looking for this server…');
        return locate(s).then(function (w) {
          s.base = w.base; s.kind = w.ep.kind; s.rtt = w.rtt; s.health = w.health; s.setupComplete = !!w.health.setup_complete;
          var st = Date.parse(w.health.time); s.clockSkew = isNaN(st) ? 0 : st - Date.now();
          ev('connected', { server: s.id, kind: s.kind, rtt: Math.round(s.rtt) });
          return afterHealth(s);
        }, function () {
          s.base = ''; s.retryAt = Date.now() + T_FAIL_MEMORY;
          var ri = isRtc(s) && R ? R.info(s.id) : null;
          setState(s, 'unreachable', ri ? (ri.msg && ri.msg !== 'Not reachable from here right now.' ? ri.msg : 'Not online now.') :
            'Not reachable from here right now.');
          var dl = s.listing && s.listing.direct;
          if (dl) diagnose({ host: dl.host, port: dl.port }, dl.scheme).then(function (why) { if (s.state === 'unreachable') setState(s, 'unreachable', why); });
          ev('unreachable', { server: s.id });
          rebuild();
        });
      }
      return afterHealth(s);
    })();
    s.connecting = p.then(function () { s.connecting = null; }, function () { s.connecting = null; });
    return s.connecting;
  }
  function afterHealth(s) {
    var h = s.health || {};
    var majors = (h.api && h.api.majors) || [];
    if (majors.indexOf(API_MAJOR) < 0) {
      var newer = majors.some(function (m) { return +m > +API_MAJOR; });
      setState(s, 'version', newer ? 'This website needs updating to work with this server.' : 'This server needs updating to work with this website.');
      return Promise.resolve();
    }
    /* A listing comes only from a typed address or a server that lists this vault's connection
       key, and either is the confirmation (2.4a; reach). */
    if (!confirmed(s.id)) slot(K_CONFIRM, s.id, 'yes');
    if (!s.setupComplete) { setState(s, 'setup', 'The server\'s owner has not finished setting it up yet.'); return Promise.resolve(); }
    if (!tokenOf(s.id)) {
      var pend = slot(K_PAIR, s.id);
      if (pend) { s.pairing = pend; setState(s, 'pairing'); poll(s); return Promise.resolve(); }
      if (withdrawn(s.id)) { setState(s, 'withdrawn', WITHDRAWN_MSG); return Promise.resolve(); }
      if (isRtc(s)) return startPairing(s);   // REACH: the server let this connection key in, so this browser joins at once
      setState(s, 'unpaired', 'This browser has not joined this server yet.');
      return Promise.resolve();
    }
    return api(s, 'GET', '/session', { auth: 'device' }).then(function (r) {
      var j = r.json || {}, sv = j.server || {};
      s.session = j;
      s.name = sv.name || s.name;
      s.template = (j.template && j.template.name) || s.template || '';
      setState(s, 'ready');
      return loadLibrary(s);
    }, function (e) {
      if (onAuthError(s, e)) return;
      if (e.status === 0 || e.status >= 500 || e.status === 429 || e.status === 421) {
        s.base = ''; s.retryAt = Date.now() + T_FAIL_MEMORY;
        setState(s, 'unreachable', 'Not reachable from here right now.');
        return;
      }
      setState(s, 'error', 'The server answered in a way this site did not expect (' + (e.code || e.status) + ').');
    });
  }

  /* ---------------------------------------------------------------- 2.4 pairing
     A browser arrives as its vault, whichever way: over the internet the channel has already
     proved the connection key ("channel": true); by Direct connect the browser asks the server for a
     challenge and sends its vault identity (connection key, alias, picture) signed by the vault key.
     The vault code is never sent, and no PIN is ever asked by a server. */
  var WAIT_APPROVAL = 'Waiting for the server owner to approve your login.';
  var IDENTITY_MSG = 'This server could not check your vault. Reload the page and try again.';
  function identityFor(s) {
    if (!R || !R.identityReady || !R.identityReady()) return Promise.reject(Object.assign(new Error('no identity'), { status: 0, code: 'no_identity' }));
    return api(s, 'GET', '/pairing/challenge').then(function (r) {
      var j = r.json || {};
      if (!j.challenge || !j.server_key) throw Object.assign(new Error('no challenge'), { status: 0, code: 'challenge_missing' });
      s.serverKey = j.server_key;
      return R.directIdentity(j.server_key, j.challenge);
    });
  }
  function startPairing(s, retried) {
    var l = s.listing;
    if (!l || !(l.direct || l.rtc)) { setState(s, 'error', 'This browser does not know how to reach this server. Connect to it again.'); return Promise.resolve(); }
    setState(s, 'pairing', 'Asking to join…');
    var body = deviceDescription();
    var ready = isRtc(s) ? Promise.resolve((body.channel = true, body))   // the connection key proved on this channel is the identity
      : identityFor(s).then(function (id) { body.direct = true; body.identity = id; return body; });
    return ready.then(function (b) { return api(s, 'POST', '/pairing', { body: b }); }).then(function (r) {
      var j = r.json || {};
      var auto = j.approval === 'automatic';
      s.pairing = { request_id: j.request_id, poll_secret: j.poll_secret, match_code: j.match_code, expires_at: j.expires_at,
                    interval: Math.max(3, +j.poll_interval_seconds || 3), auto: auto };
      slot(K_PAIR, s.id, s.pairing);
      ev('pairing-requested', { server: s.id, approval: auto ? 'automatic' : 'owner' });
      setState(s, 'pairing', auto ? 'You are approved here. Joining…' : WAIT_APPROVAL);
      if (!auto) showPairingDialog(s);
      poll(s, auto);
    }, function (e) {
      if (e.code === 'no_identity') { setState(s, 'unpaired', 'Choose your alias and PIN first, then ask to join.'); return; }
      if (e.code === 'challenge_invalid' && !retried) return startPairing(s, true);   // a fresh challenge, once
      if (e.code === 'identity_invalid' || e.code === 'challenge_invalid' || e.code === 'challenge_missing') { warn('pairing', e.code, e.info && e.info.field); setState(s, 'unpaired', IDENTITY_MSG); return; }
      if (e.code === 'direct_connect_refused') { setState(s, 'unpaired', 'This server does not accept direct connections from here. Its owner can change that in the server\'s Security settings.'); return; }
      if (e.code === 'pairing_queue_full') { setState(s, 'unpaired', 'The server\'s owner already has many requests waiting. Ask them to clear some, then try again.'); return; }
      if (e.code === 'rate_limited') { setState(s, 'unpaired', 'Too many attempts from this network. Try again in ' + (e.info.retry_after_seconds || 60) + ' seconds.'); return; }
      if (onAuthError(s, e)) return;
      if (e.status === 0) { setState(s, 'unreachable', 'Not reachable from here right now.'); return; }
      setState(s, 'unpaired', 'The request to join could not be made (' + (e.code || e.status) + ').');
    });
  }
  function poll(s, now) {
    clearTimeout(s.pollTimer);
    var p = s.pairing; if (!p) return;
    s.pollTimer = setTimeout(function () {
      api(s, 'GET', '/pairing/' + encodeURIComponent(p.request_id), { auth: 'poll', poll: p.poll_secret }).then(function (r) {
        var j = r.json || {};
        if (j.status === 'approved' && j.device_token) {
          slot(tokKey(s.id), s.id, { device_id: j.device_id, device_token: j.device_token,
                                 vault_id: (j.vault || j.person || {}).id, template_name: j.template && j.template.name });
          slot(K_PAIR, s.id, null); s.pairing = null; slot(K_WITHDRAWN, s.id, null);
          s.template = (j.template && j.template.name) || '';
          ev('paired', { server: s.id });
          closePairingDialog(s, true);
          return afterHealth(s).then(function () { if (!p.auto) toastSafe('Approved. ' + label(s) + ' has let you in.', 'ok'); });
        }
        if (j.expires_at) p.expires_at = j.expires_at;
        if (j.poll_interval_seconds) p.interval = Math.max(3, +j.poll_interval_seconds);
        updatePairingDialog(s);
        poll(s);
      }, function (e) {
        var msg = null;
        if (e.code === 'pairing_denied') msg = 'The server owner said no.';
        else if (e.code === 'pairing_expired') msg = 'Nobody approved this in time.';
        else if (e.code === 'pairing_collected' || e.code === 'poll_secret_invalid' || e.code === 'not_found') msg = 'The request is no longer open.';
        if (msg) {
          slot(K_PAIR, s.id, null); s.pairing = null;
          ev('pairing-ended', { server: s.id, code: e.code });
          setState(s, 'unpaired', msg);
          closePairingDialog(s, false, msg);
          return;
        }
        if (e.code === 'rate_limited') { p.interval = Math.max(p.interval, (+e.info.retry_after_seconds || 5)); }
        poll(s);   // network trouble: keep waiting
      });
    }, now ? 50 : (p.interval || 3) * 1000 + 300);   // already approved: collect at once (2.4a step 4)
  }
  function cancelPairing(s) {
    var p = s.pairing; clearTimeout(s.pollTimer);
    slot(K_PAIR, s.id, null); s.pairing = null;
    setState(s, 'unpaired', 'Request withdrawn.');
    if (p) api(s, 'DELETE', '/pairing/' + encodeURIComponent(p.request_id), { auth: 'poll', poll: p.poll_secret }).catch(function () {});
  }

  /* ---------------------------------------------------------------- 6 / 8 library */
  function loadLibrary(s) {
    var items = [], cursor = null, first = null, pages = 0;
    function page() {
      var q = '/cartridges?limit=2000' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
      var hdr = (!cursor && s.etag && s.items) ? { 'If-None-Match': s.etag } : undefined;
      return api(s, 'GET', q, { auth: 'device', headers: hdr, timeout: 30000 }).then(function (r) {
        if (r.status === 304) return 'same';
        var j = r.json || {};
        if (!cursor) { first = j.revision; s.etag = r.headers.get('ETag') || ''; }
        (j.items || []).forEach(function (it) { if (it && SHA_RE.test(it.sha256 || '')) items.push(it); });
        cursor = j.next_cursor; pages++;
        if (cursor && pages < 200) return page();
        if (j.revision && first && j.revision !== first) return 'again';
        return 'done';
      });
    }
    var tries = 0;
    function walk() {
      items = []; cursor = null; first = null; pages = 0; tries++;
      return page().then(function (res) { return (res === 'again' && tries < 3) ? walk() : res; });
    }
    return walk().then(function (res) {
      if (res !== 'same') { s.items = items; s.revision = first || ''; }
      return api(s, 'GET', '/boot-firmware', { auth: 'device' }).then(function (r) {
        s.bootItems = ((r.json && r.json.items) || []).filter(function (b) { return b && SHA_RE.test(b.sha256 || ''); });
      }, function (e) { if (onAuthError(s, e)) throw e; s.bootItems = s.bootItems || []; });
    }).then(function () {
      s.fresh = true; s.absent = {};
      idb('listings', 'readwrite', function (st) {
        st.put({ items: s.items, boot: s.bootItems, etag: s.etag, revision: s.revision, name: s.name, template: s.template, t: Date.now() }, C.vhp + ':' + s.id);
      });
      ev('library', { server: s.id, count: (s.items || []).length });
      setState(s, 'ready');
      rebuild();
    }, function (e) {
      if (onAuthError(s, e)) return;
      if (e.status === 0 || e.status >= 500) { s.base = ''; s.retryAt = Date.now() + T_FAIL_MEMORY; setState(s, 'unreachable', 'Not reachable from here right now.'); rebuild(); return; }
      setState(s, 'error', 'The server\'s list of games could not be read (' + (e.code || e.status) + ').');
    });
  }
  function loadCachedListings() {
    return db().then(function (d) {
      if (!d) return;
      return new Promise(function (res) {
        var tx = d.transaction('listings', 'readonly'), pre = C.vhp + ':';
        tx.objectStore('listings').openCursor().onsuccess = function (e) {
          var cur = e.target.result; if (!cur) return;
          var k = String(cur.key);
          if (k.indexOf(pre) === 0) {
            var s = srvOf(k.slice(pre.length)), v = cur.value || {};
            s.items = v.items || null; s.bootItems = v.boot || null; s.etag = v.etag || ''; s.revision = v.revision || '';
            s.name = v.name || ''; s.template = v.template || '';
          }
          cur.continue();
        };
        tx.oncomplete = tx.onerror = function () { res(); };
      });
    }).catch(function () {});
  }

  /* Which id the site knows a title by (API.md 10; CLIENT-FINDINGS 2.4). The
     client's own rule wins over the listing's client_id. */
  function identify(sha) {
    try { return (window.__GNW_PACK && typeof window.__GNW_PACK.identify === 'function') ? window.__GNW_PACK.identify(sha) : null; } catch (e) { return null; }
  }
  function atariPrefixes() { try { return typeof ATARI_BY_PREFIX !== 'undefined' ? ATARI_BY_PREFIX : { a2600: 'atari2600' }; } catch (e) { return { a2600: 'atari2600' }; } }
  function siteIdFor(it) {
    var sys = it.system, h12 = it.sha256.slice(0, 12);
    /* 'sgb' (25 Oct): the Super Game Boy shelf's own files, Game Boy cartridges with the gb ids. */
    if (sys === 'gb' || sys === 'gbc' || sys === 'sgb') {
      var g = identify(it.sha256);
      if (g && g.kind === 'gb' && /^gb-/.test(g.device)) return { id: g.device, kind: 'gb' };
      return { id: 'gb-x' + h12, kind: 'gb' };
    }
    /* THE CASSETTE SHELF (2026-10-22): the server's "tapes" system, one shelf of audio
       cassettes any console's player asks for by file name (cassettes() / cassetteByName()). Never a tile. */
    if (sys === 'tapes') return { id: 'cas-x' + h12, kind: 'cassette' };
    if (sys === 'nes' || sys === 'famicom') {
      /* Not every NES-format file is a cartridge (2026-10-12): Study Box tapes
         go to the NES page's tape deck, never a tile; Family BASIC data-recorder
         .wav tapes and FCEUX save states (.fcs) have nothing on this site that
         reads them yet. UNIF (.unf) cartridges are cartridges: the core reads
         their header. */
      var f = String(it.format || '').toLowerCase();
      if (f === 'study' || f === 'studybox') return { id: 'tape-x' + h12, kind: 'tape' };
      if (f === 'wav' || f === 'fcs') return null;
      return { id: 'nes-x' + h12, kind: 'nes' };   // famicom: same ids, Famicom shelf (API.md 10)
    }
    // A Disk System disk is an NES-catalogue title (one emulator, three consoles;
    // index.html marks it c:'fds' and the play page mounts it as a disk).
    if (sys === 'fds') return { id: 'nes-x' + h12, kind: 'nes' };
    /* THE SAME BYTES IN THE MASTER SYSTEM AND GAME GEAR FOLDERS (20 Nov 2026): the server lists one
       file per hash, from the folder whose path sorts first (gg), with the other in `also`. A program held in
       both is a Master System program (programs also sold for the Game Gear stay on the Master System
       wall), so it goes on the Master System wall. Today one file: the
       Korean Wonder Kid, whose bytes are also the Wonder Kid (USA) (Proto) in the Game Gear folder. */
    if (sys === 'gg' && it.also && it.also.indexOf('sms') >= 0) sys = 'sms';
    /* THE SUFAMI TURBO (24 Nov 2026) is its own wall (index.html ATARI_SYSTEMS sufami): a server may list its
       mini-cartridges (.st) under its own system id sufami, or under snes; either way they go on the Sufami Turbo wall. */
    if (sys === 'snes' && String(it.format || '').toLowerCase() === 'st') sys = 'sufami';
    /* The Sufami Turbo switch (index.html window.CW_SUFAMI_ON, 25 Nov 2026): while off, its games are not shown anywhere. */
    if (sys === 'sufami' && !window.CW_SUFAMI_ON) return null;
    if (atariPrefixes()[sys]) return { id: sys + '-x' + h12, kind: 'atari' };
    if (sys === 'pokemini') {
      var p = identify(it.sha256);
      if (p && p.kind === 'pm' && /^pm-/.test(p.device)) return { id: p.device, kind: 'pm' };
      /* Any other Pokemon mini file (the server unzips .zip games and lists the
         .min inside): the PM page adopts every pm-x id, under its catalogue game
         when the variants table puts it there, else as a tile of its own. */
      return { id: 'pm-x' + h12, kind: 'pm' };
    }
    /* Game & Watch: the server serves each device's zip whole; the G&W page asks
       for them through gnwPrograms(), which unpacks them and matches each file by
       its hash, as a content pack import does. Not a tile of its own. */
    if (sys === 'gnw') return { id: 'gnw-x' + h12, kind: 'gnw' };
    return null;   // unknown systems: not wired on this site yet
  }
  function bootIdFor(b) {
    var g = identify(b.sha256);
    if (g && (g.kind === 'gb' || g.kind === 'pm') && (g.device === 'bios' || g.device === 'biosCgb')) return g.kind + ':' + g.device;
    if ((b.system === 'gb' || b.system === 'gbc') && b.size === 256) return 'gb:bios';
    if ((b.system === 'gb' || b.system === 'gbc') && b.size === 2304) return 'gb:biosCgb';
    if (b.system === 'pokemini' && b.size === 4096) return 'pm:bios';
    /* The Super Game Boy's SNES program (SGB1, 256 KB; SGB2, 512 KB): one slot, its built-in border.
       The server marks SGB1 the default; SGB2 is offered in the play window's choice. */
    if (b.system === 'sgb' && (b.size === 262144 || b.size === 524288)) return 'sgb:snes';
    /* (14 Nov) the Super Game Boy's and SGB2's Game Boy side start-up programs: the Game Boy slot, asked for by
       their roles on a Super Game Boy (never the slot's usual one: the server marks them no default) */
    if (b.system === 'sgb' && b.size === 256) return 'gb:bios';
    if (b.system === 'fds' && b.size === 8192) return 'fds:bios';   // the Disk System's drive firmware
    if (atariPrefixes()[b.system]) return 'atari-bios:' + b.sha256.slice(0, 12);   // 5200, 7800 and Lynx boot programs (atariBios)
    return null;
  }
  /* WHICH BOOT PROGRAM, 2026-10-14 (server DECISIONS L18). A Super Mario
     Land test showed a clone's "Loading ..." screen: every 256-byte file mapped to
     gb:bios by size and the first listed won, and "[BIOS] Maxstation ... (Unl)"
     sorts first. Now a boot program is chosen by identity only:
       0  the server marks it "default" (its preferred list, by SHA-256);
       1  this site knows the hash (content_pack.js: GB World Rev 1, GBC
          World Rev 2, Pokemon mini);
       2  only from a server too old to send "default": a size match whose
          name is not unlicensed, a clone, a bad dump or another console's.
       3  an Atari image the server did not mark (offered after the default).
     -1 never chosen automatically. Lowest rank wins; ties keep list order. */
  var BOOT_NEVER = /\(Unl\)|\[b\d*\]|Maxstation|Challenger|Genius|Touch Boy|Twin Famicom|High Score/i;
  function bootRank(b, id) {
    if (b['default'] === true) return 0;
    var g = identify(b.sha256);
    if (g && id === g.kind + ':' + g.device) return 1;
    var never = BOOT_NEVER.test(String(b.name || '') + ' ' + String(b.file_name || ''));
    /* An Atari image is offered in a map (each its own id), so a good
       non-default one (the 7800's PAL BIOS) stays available, after the default. */
    if (/^atari-bios:/.test(id)) return never ? -1 : 3;
    if (Object.prototype.hasOwnProperty.call(b, 'default')) return -1;
    return never ? -1 : 2;
  }
  function better(a, aSid, b, bSid) {   // 8.2: database names first, then the smallest server id
    var da = a.title_source === 'database', dbb = b.title_source === 'database';
    if (da !== dbb) return da;
    return aSid < bSid;
  }
  function usable(s) { return s.state === 'ready' && s.fresh && !(s.failUntil > Date.now()) && !(s.badUntil > Date.now()); }
  function rebuild() {
    var bySha = {}, byId = {}, boot = {}, unsupported = 0;
    Object.keys(C.servers).sort().forEach(function (sid) {
      var s = C.servers[sid];
      if (cwsOff() || !s.items || hidden(sid) || !confirmed(sid) || !tokenOf(sid)) return;   // switched off: no server's titles
      s.items.forEach(function (it) {
        var e = bySha[it.sha256];
        if (!e) {
          var m = siteIdFor(it);
          if (!m) { unsupported++; return; }
          e = bySha[it.sha256] = { sha256: it.sha256, size: it.size, entry: it, entrySid: sid, holders: {}, id: m.id, kind: m.kind, what: 'cartridges' };
        } else if (better(it, sid, e.entry, e.entrySid)) { e.entry = it; e.entrySid = sid; }
        e.holders[sid] = it;
        /* THE SUPER GAME BOY SHELF (25 Oct): a title the server lists as sgb, or whose
           other copies include one in the sgb folder (the listing's `also`), is on that shelf too. */
        if (it.system === 'sgb' || (it.also && it.also.indexOf('sgb') >= 0)) e.sgb = true;
      });
      (s.bootItems || []).forEach(function (b) {
        var id = bootIdFor(b); if (!id) return;
        var r = bootRank(b, id); if (r < 0) return;
        var e = boot[id];
        if (!e || r < e.rank) boot[id] = { sha256: b.sha256, size: b.size, entry: b, holders: {}, id: id, what: 'boot-firmware', rank: r };
      });
    });
    /* Holders after the choice, so a server listed before the winner's first
       holder still counts as holding it. EVERY boot program listed is also kept by its
       hash (bootAll, 2026-10-19), for the play window's Boot program choice: a person
       may pick one the automatic rule would not (it stays their explicit choice). */
    var bootAll = {};
    Object.keys(C.servers).sort().forEach(function (sid) {
      var s = C.servers[sid];
      if (cwsOff() || !s.items || hidden(sid) || !confirmed(sid) || !tokenOf(sid)) return;   // switched off: no server's titles
      (s.bootItems || []).forEach(function (b) {
        var id = bootIdFor(b), e = id && boot[id];
        if (e && e.sha256 === b.sha256) e.holders[sid] = b;
        if (!id) return;
        var a = bootAll[b.sha256] || (bootAll[b.sha256] = { sha256: b.sha256, size: b.size, entry: b, holders: {}, id: 'boot-sha:' + b.sha256.slice(0, 12), slot: id, what: 'boot-firmware', rank: bootRank(b, id) });
        a.holders[sid] = b;
      });
    });
    C.bootAll = bootAll;
    Object.keys(bySha).forEach(function (h) { var e = bySha[h]; if (!byId[e.id]) byId[e.id] = e; });
    C.bySha = bySha; C.byId = byId; C.boot = boot; C.unsupported = unsupported;
    if (_gnwPrograms && gnwIds(false).join(',') !== _gnwSig) _gnwPrograms = null;
    seedGbSha1();
    var sig = Object.keys(byId).sort().map(function (id) { return id + (reachable(byId[id]).length ? '+' : '-'); }).join(',') +
              '|' + Object.keys(boot).sort().map(function (id) { return id + (reachable(boot[id]).length ? '+' : '-'); }).join(',');
    render();
    if (sig !== C.signature) {
      C.signature = sig;
      ev('library-changed', { titles: Object.keys(byId).length });
      /* Not while the first answer is still awaited: the catalogues wait for it (first()) and
         read it once (28 Oct). */
      if (!_firstOpen && typeof reloadAllGameContent === 'function') { try { reloadAllGameContent(); } catch (e) {} }
    }
  }
  function reachable(e) {
    var now = Date.now();
    return Object.keys(e.holders).map(function (sid) { return C.servers[sid]; }).filter(function (s) {
      return s && usable(s) && !(s.absent[e.sha256] > now) && e.holders[s.id].size === e.size;
    }).sort(function (a, b) {
      var la = a.kind === 'lan' ? 0 : 1, lb = b.kind === 'lan' ? 0 : 1;
      return la !== lb ? la - lb : a.rtt - b.rtt;
    });
  }
  /* 6.4: the listing's SHA-1 lets the site find its own Game Boy art without
     downloading the cartridge. Merged, never overwriting what emby.js wrote. */
  function seedGbSha1() {
    var m = lsGet(K_GB_SHA1), changed = false;
    Object.keys(C.byId).forEach(function (id) {
      var e = C.byId[id];
      if (e.kind !== 'gb' || !e.entry.sha1 || m[id]) return;
      m[id] = String(e.entry.sha1).toUpperCase(); changed = true;
    });
    if (changed) lsSet(K_GB_SHA1, m);
  }

  /* ---------------------------------------------------------------- what index.html asks */
  function has(id) { return !!(C.byId[id] || C.boot[id]); }
  function available(id) { var e = C.byId[id] || C.boot[id]; return !!(e && reachable(e).length); }
  function unavailable(id) {
    for (var k in C.added) if (C.added[k][id]) return !available(id);
    return false;
  }
  function mergeManifest(kind, existing) {
    var out = existing ? Object.assign({}, existing) : {}, n = 0, added = {};
    Object.keys(C.byId).forEach(function (id) {
      var e = C.byId[id];
      if (e.kind !== kind || !/-x[0-9a-f]{12}$/.test(id) || out[id]) return;
      var it = e.entry;
      if (kind === 'gb') out[id] = it.system === 'sgb'
        ? { n: it.title, s: String(it.format || '').toLowerCase() === 'gbc' ? 1 : 0, z: e.size, o: 1 }   // o: held only on the Super Game Boy shelf
        : { n: it.title, s: it.system === 'gbc' ? 1 : 0, z: e.size };
      else if (kind === 'nes') out[id] = it.system === 'fds' ? { n: it.title, z: e.size, m: 20, c: 'fds' }
        : it.system === 'famicom' ? { n: it.title, z: e.size, m: null, c: 'famicom' }   // nes-console.js step 2: explicit console
        : { n: it.title, z: e.size, m: null };
      else if (kind === 'atari') out[id] = { s: id.slice(0, id.lastIndexOf('-x')), n: it.title, z: e.size };   // the site id's system (siteIdFor: the same bytes in sms and gg go on the Master System wall), never re-read from the listing
      else if (kind === 'pm') out[id] = { n: it.title, z: e.size };
      else return;
      /* A 64DD DISK (26 Nov 2026): the server lists it as an N64 game in the .ndd form; dd marks it, so its tile and
         drawer show the 64DD (index.html _n64IsDisk; the size alone also says so, as the play page's disk.mjs reads it). */
      if (kind === 'atari' && out[id].s === 'n64' && (String(it.format || '').toLowerCase() === 'ndd' || /\.ndd$/i.test(String(it.file_name || '')))) out[id].dd = 1;
      added[id] = true; n++;
    });
    C.added[kind] = added;
    return n ? out : existing;
  }
  function decorate(devices) {
    (devices || []).forEach(function (d) {
      var e = d && C.byId[d.id];
      if (!e || !(C.added.gb[d.id] || C.added.nes[d.id] || C.added.atari[d.id] || C.added.pm[d.id])) return;
      var it = e.entry, names = Object.keys(e.holders).map(function (sid) { return label(C.servers[sid]); });
      d.fromServer = true;
      d.description = 'On your game server' + (names.length > 1 ? 's' : '') + ' ' + esc(names.join(' and ')) +
        ': <b>' + esc(it.file_name || it.title) + '</b>' + (it.folder ? ' in ' + esc(it.folder) : '') + ', ' +
        Number(e.size).toLocaleString('en-AU') + ' bytes. This site holds nothing else about it; its name is the file\'s name on the server, tidied.';
    });
    return devices;
  }

  /* ---------------------------------------------------------------- 6.3 / 8.4 downloads */
  var _mem = {}, _inflight = {}, _queue = [], _active = 0;
  function fetchBytes(id) {
    var e = C.byId[id] || C.boot[id];
    if (!e) return Promise.resolve(null);
    return fetchEntry(e, id);
  }
  /* THE BOOT PROGRAM CHOICE (2026-10-19). Every boot program the joined servers list for
     one slot ('gb:bios', 'gb:biosCgb', 'pm:bios', 'fds:bios'; an Atari console by its server system
     name), reachable now, best ranked first; 'auto' marks the one the server prefers (its own
     "default", L18). Names and hashes only: nothing is downloaded until one is chosen. */
  /* FIRMWARE ROLES (2026-10-22: "the client should request either generic or specific
     firmware as it needs it"; server DECISIONS FW1). A server that knows roles lists each file with
     role ('boot', 'disk', 'boot-pal', 'supercharger' ...), role_name and generic (the normal one for
     that role). roles (optional) narrows a slot to those roles and want names the role this game
     needs: 'auto' then marks that role's generic file. A server too old to send roles is read as
     before ('default'). */
  function bootChoices(slot, system, roles, want) {
    var all = C.bootAll || {}, out = [];
    Object.keys(all).forEach(function (h) {
      var e = all[h];
      var fits = /^atari-bios:/.test(e.slot) ? (slot === 'atari-bios' && e.entry.system === system) : e.slot === slot;
      if (!fits || !reachable(e).length) return;
      var role = e.entry.role, sysRole = String(e.entry.system || '') + ':' + String(role || '');   // a role may be named system:role (14 Nov)
      if (roles && roles.length && role && roles.indexOf(role) < 0 && roles.indexOf(sysRole) < 0) return;
      out.push({ sha256: e.sha256, size: e.size, name: String(e.entry.title || e.entry.name || e.entry.file_name || 'Boot program'),
        role: role || '', roleName: String(e.entry.role_name || ''), generic: e.entry.generic === true,
        auto: (want && role) ? ((role === want || sysRole === want) && e.entry.generic === true) : (e.entry['default'] === true || (!!C.boot[slot] && C.boot[slot].sha256 === e.sha256)), rank: e.rank });
    });
    return out.sort(function (a, b) { var ra = a.rank < 0 ? 99 : a.rank, rb = b.rank < 0 ? 99 : b.rank; return (b.auto - a.auto) || ra - rb || (a.name < b.name ? -1 : 1); });
  }
  /* The generic file of one system's role, from the list kept since connecting (no download):
     { sha256, size, name, role } of the first reachable server's generic file, or null. From a
     server without roles, the system's 'default' stands for its first role (fallback names it). */
  function bootGeneric(system, role, fallback) {
    var all = C.bootAll || {}, hit = null, old = null;
    Object.keys(all).sort().forEach(function (h) {
      var e = all[h], n = e.entry || {};
      if (n.system !== system || !reachable(e).length) return;
      if (n.role === role && n.generic === true) { if (!hit) hit = e; }
      else if (!Object.prototype.hasOwnProperty.call(n, 'role') && fallback && n['default'] === true && !old) old = e;
    });
    var e = hit || old;
    return e ? { sha256: e.sha256, size: e.size, name: String(e.entry.title || e.entry.name || e.entry.file_name || ''), role: e.entry.role || role } : null;
  }
  /* Every firmware file the joined servers list, for a page that shows the whole list (names and
     hashes only). */
  function firmwareList() {
    var all = C.bootAll || {};
    return Object.keys(all).map(function (h) {
      var e = all[h], n = e.entry || {};
      return { sha256: e.sha256, size: e.size, system: n.system || '', role: n.role || '', roleName: n.role_name || '',
        name: String(n.title || n.name || n.file_name || ''), fileName: n.file_name || '', generic: n.generic === true,
        isDefault: n['default'] === true, reachable: reachable(e).length > 0 };
    }).sort(function (a, b) { return a.system < b.system ? -1 : a.system > b.system ? 1 : a.role < b.role ? -1 : a.role > b.role ? 1 : (b.generic - a.generic) || (a.name < b.name ? -1 : 1); });
  }
  /* The Kid Vid's tape audio (2600, 2026-10-19): WAV files in a server's atari2600
     bios folder, asked for by file name (KVSHARED.WAV, KVS1.WAV ...), as the recordings are
     named. The SHA-256 of the first reachable one of that name, or null. */
  function bootFileByName(system, name) {
    var all = C.bootAll || {}, want = String(name).toUpperCase(), hit = null;
    Object.keys(all).forEach(function (h) {
      var e = all[h];
      if (!hit && e.entry && e.entry.system === system && String(e.entry.file_name || '').toUpperCase() === want && reachable(e).length) hit = e.sha256;
    });
    return hit;
  }
  function fetchBootSha(sha) {
    var e = C.bootAll && C.bootAll[sha];
    return e ? fetchEntry(e, e.id) : Promise.resolve(null);
  }
  /* Failed downloads share one notice (25 Oct): a server that cannot send files
     failed every title the site asked for, one notice each (62 piled over a phone screen).
     One failure still gets its own message, word for word as before. Each further failure
     while that notice is on screen joins it: the notice then counts them ("Couldn't load 62
     games from your game servers") and "Show which" lists every title. The notice stays
     FAIL_NOTE_MS after the last failure joined, and while its list is open. */
  var FAIL_NOTE_MS = 6000, _failNote = null;
  var FAIL_PLURAL = {
    'none of your servers could send it just now.': 'none of your servers could send them just now.',
    'it is on a server that isn’t reachable right now.': 'they are on a server that isn’t reachable right now.',
    'your game server didn’t answer in time.': 'your game server didn’t answer in time.'
  };
  function failNoteText(n) {
    var one = n.items[0];
    if (n.items.length === 1) return 'Couldn’t load “' + one.t + '”' + (one.r === R_SLOW ? ': ' : ' from your game servers: ') + one.r;
    var g = 0, f = 0, same = one.r;
    n.items.forEach(function (x) { if (x.fw) f++; else g++; if (x.r !== same) same = null; });
    var what = [g ? g + (g === 1 ? ' game' : ' games') : '', f ? f + (f === 1 ? ' firmware file' : ' firmware files') : ''].filter(Boolean).join(' and ');
    n.same = !!(same && FAIL_PLURAL[same]);
    return 'Couldn’t load ' + what + ' from your game servers' + (n.same ? ': ' + FAIL_PLURAL[same] : '.');
  }
  /* THE NEW MESSAGES (28 Oct: "Game server load-failure message: move it to the new
     style? Yes, the new style."): with notify.js loaded the notice is a cwNotify message (top right, the
     countdown line round its edge, warn colours). Same words, same counting, "Show which" is one of its
     buttons and the list opens inside it. Each failure that joins starts the countdown again
     (restart()), and an open list holds it (hold()). Without notify.js it is the old toast, as before. */
  function failNoteDraw(n) {
    var body = n.el.querySelector(n.cw ? '.cwn-body' : '.toast-body');
    if (!body) return;
    if (n.cw) {
      var p = body.querySelector('.cwn-text');
      if (p) p.textContent = failNoteText(n);
      if (n.items.length === 1) return;
    } else if (n.items.length === 1) { body.textContent = failNoteText(n); return; }
    if (!n.btn) {
      n.btn = document.createElement('button');
      n.btn.type = 'button';
      n.btn.setAttribute('aria-expanded', 'false');
      n.list = document.createElement('ul');
      n.list.hidden = true;
      n.list.style.cssText = 'margin:4px 0 0;padding:0 0 0 18px;max-height:40vh;overflow:auto;font-weight:400';
      n.btn.addEventListener('click', function () {
        n.open = !n.open;
        n.list.hidden = !n.open;
        n.btn.textContent = n.open ? 'Hide the list' : 'Show which';
        n.btn.setAttribute('aria-expanded', n.open ? 'true' : 'false');
        failNoteTimer(n);
      });
      if (n.cw) {
        n.btn.className = 'cwn-act';
        n.list.className = 'cwn-list';
        body.appendChild(n.list);
        var acts = n.el.querySelector('.cwn-acts');
        (acts || body).appendChild(n.btn);
      } else {
        body.textContent = '';
        n.msg = document.createElement('div');
        n.btn.className = 'toast-more';
        n.btn.style.cssText = 'display:block;background:none;border:0;padding:6px 0 2px;margin:0;font:inherit;color:inherit;text-decoration:underline;cursor:pointer';
        n.list.className = 'toast-list';
        body.appendChild(n.msg); body.appendChild(n.btn); body.appendChild(n.list);
      }
    }
    if (n.msg) n.msg.textContent = failNoteText(n);
    if (!n.open) n.btn.textContent = 'Show which';
    n.list.textContent = '';
    n.items.forEach(function (x) {
      var li = document.createElement('li');
      li.textContent = (x.fw ? 'Firmware: ' : '') + x.t + (n.same ? '' : ': ' + x.r);
      n.list.appendChild(li);
    });
  }
  function failNoteTimer(n) {
    if (n.cw) { try { n.cw.hold(!!n.open); if (!n.open) n.cw.restart(); } catch (err) {} return; }
    clearTimeout(n.timer);
    if (n.open) return;
    n.timer = setTimeout(function () {
      var x = n.el && n.el.querySelector('.toast-close');
      if (x) x.click();
    }, FAIL_NOTE_MS);
  }
  /* TRY AGAIN (20 Nov 2026): a file the game server did not start sending in time (R_SLOW) gets a
     Try again button on the notice. It starts the same load again, from the same servers (a server
     that was only slow is not set aside): the open play window loads its game again, as its Play
     button did; with no play window open, the files are asked for again. */
  var PLAY_OPENERS = { 'gb-play-overlay': 'openGbPlay', 'nes-play-overlay': 'openNesPlay', 'atari-play-overlay': 'openAtariPlay', 'pm-play-overlay': 'openPmPlay' };
  function retryLoads(items) {
    var cur = null; try { cur = typeof _openPlayDeviceId !== 'undefined' ? _openPlayDeviceId : null; } catch (x) { cur = null; }   // eslint-disable-line no-undef
    var ov = cur && document.querySelector('[id$="-play-overlay"].open');
    var fn = ov && PLAY_OPENERS[ov.id] && window[PLAY_OPENERS[ov.id]];
    ev('retry', { id: cur || '', ids: items.map(function (x) { return x.id; }) });
    if (typeof fn === 'function') { fn(cur); return; }
    items.forEach(function (x) { if (x.id) fetchBytes(x.id); });
  }
  function failNoteRetry(n) {
    var slow = n.items.filter(function (x) { return x.r === R_SLOW; });
    if (!slow.length || (n.retry && n.retry.isConnected)) return;
    var b = n.retry = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Try again';
    b.addEventListener('click', function () {
      var again = n.items.filter(function (x) { return x.r === R_SLOW; });
      if (_failNote === n) _failNote = null;
      if (n.cw) { try { n.cw.close('action'); } catch (x) {} }
      else { var c = n.el && n.el.querySelector('.toast-close'); if (c) c.click(); else if (n.el) n.el.remove(); }
      retryLoads(again);
    });
    if (n.cw) {
      b.className = 'cwn-act';
      var acts = n.el.querySelector('.cwn-acts');
      if (acts) acts.insertBefore(b, acts.firstChild); else return;
    } else {
      var body = n.el.querySelector('.toast-body') || n.el;
      b.className = 'toast-more';
      b.style.cssText = 'display:block;background:none;border:0;padding:6px 0 2px;margin:0;font:inherit;color:inherit;text-decoration:underline;cursor:pointer';
      body.appendChild(b);
    }
  }
  function noteFailed(e, id, reason) {
    var t = String((e.entry && (e.entry.title || e.entry.name)) || id);
    var item = { sha: e.sha256, id: id, t: t, r: String(reason || ''), fw: !!(C.bootAll && C.bootAll[e.sha256] === e) };
    /* A Game & Watch file is listed by its model number (AC-01): the list names the device too. */
    try {
      if (e.kind === 'gnw' && typeof DEVICES !== 'undefined') {
        var dv = DEVICES.filter(function (d) { return d && d.model === t; })[0];
        if (dv && dv.name) item.t = dv.name + ' (' + t + ')';
      }
    } catch (err) {}
    var n = _failNote;
    if (n && (n.cw ? n.cw.closed : (n.el._dismissing || !n.el.isConnected))) n = _failNote = null;
    if (!n && typeof window.cwNotify === 'function') {
      try {
        var nn = { el: null, items: [item], open: false, timer: 0, cw: null };
        var h = window.cwNotify(failNoteText(nn), { kind: 'warn', id: 'cws-load-failed', onClose: function () { if (_failNote === nn) _failNote = null; } });
        if (h) { nn.cw = h; nn.el = h.el; _failNote = nn; failNoteRetry(nn); return; }
      } catch (err) { warn('notice failed', err && err.message); }
    }
    if (!n && typeof toast !== 'function') { toastSafe('Couldn’t load “' + item.t + '” from your game servers: ' + item.r, 'error'); return; }
    try {
      if (!n) {
        /* Its own timer, not toast()'s: a growing notice must outlast the first failure. */
        var el = toast('Couldn’t load “' + item.t + '” from your game servers: ' + item.r, 'error', 864e5);
        if (!el) return;
        n = _failNote = { el: el, items: [item], open: false, timer: 0 };
      } else {
        var dup = n.items.some(function (x) { return x.sha === item.sha; });
        if (!dup) n.items.push(item);
        failNoteDraw(n);
      }
      failNoteRetry(n);
      failNoteTimer(n);
    } catch (err) { warn('notice failed', err && err.message); }
  }
  /* A start-up file a game being played asks for: preload.js keeps it with that game when the game is
     pre-loaded (the model, the role or the file the player chose), from the bytes already here. */
  function noteFw(e, u) {
    if (!u || e.what !== 'boot-firmware') return;
    try { var PL = window.CwPreload; if (PL && typeof PL.noteFirmware === 'function') PL.noteFirmware(e.sha256, u, { size: e.size, system: (e.entry || {}).system || '', name: String((e.entry || {}).title || (e.entry || {}).name || (e.entry || {}).file_name || '') }); } catch (x) {}
  }
  function fetchEntry(e, id) {
    if (_mem[e.sha256]) { noteFw(e, _mem[e.sha256]); return Promise.resolve(_mem[e.sha256]); }
    if (_inflight[e.sha256]) return _inflight[e.sha256];
    /* PRE-LOAD ON DEVICE (18 Nov 2026, preload.js): a game the player set to pre-load is kept in this
       browser under its SHA-256, so its copy is used first, with no download. A copy of another
       fingerprint is not this file and is never used. */
    var PL = window.CwPreload;
    var pre = (PL && typeof PL.bytes === 'function') ? Promise.resolve().then(function () { return PL.bytes(e.sha256); }).catch(function () { return null; }) : Promise.resolve(null);
    var p = pre.then(function (b) {
      if (b && b.length === e.size) { _mem[e.sha256] = b; ev('cache-hit', { id: id, from: 'preload' }); return b; }
      return cacheGet(e.sha256);
    }).then(function (hit) {
      if (hit && _mem[e.sha256] === hit) return hit;   // the pre-loaded copy, above
      if (hit && hit.length === e.size) { _mem[e.sha256] = hit; ev('cache-hit', { id: id }); return hit; }
      ev('download-wait', { id: id, size: e.size });   // asked for and not here: loadbar.js starts its clock (2026-10-29)
      /* The game being opened to play goes before the wall's own live tiles in the queue (2026-10-29:
         measured on a slow server, it waited behind them for over 15 s). A boot program goes first too
         (1 Nov 2026): it is small, and it is asked for only when a game (or a tile's preview) is about to start; a
         file opened from this device has no catalogue id, so its firmware waited 5.5 s behind the tiles. */
      var playing = null; try { playing = typeof _openPlayDeviceId !== 'undefined' ? _openPlayDeviceId : null; } catch (x) { playing = null; }   // eslint-disable-line no-undef
      return queued(function () { return download(e); }, playing === id || e.what === 'boot-firmware');
    }).then(function (u) { delete _inflight[e.sha256]; noteFw(e, u); return u; }, function (err) {
      delete _inflight[e.sha256];
      noteFailed(e, id, err.message);
      warn('download failed', id, err.message);
      ev('download-failed', { id: id, reason: err.message });
      return null;
    });
    _inflight[e.sha256] = p;
    return p;
  }
  function fetchB64(id) { return fetchBytes(id).then(function (u) { return u ? b64(u) : null; }); }
  function queued(fn, first) {
    return new Promise(function (res, rej) { var j = { fn: fn, res: res, rej: rej }; if (first) _queue.unshift(j); else _queue.push(j); pump(); });
  }
  function pump() {
    while (_active < MAX_PARALLEL && _queue.length) {
      var j = _queue.shift(); _active++;
      j.fn().then(j.res, j.rej).then(function () { _active--; pump(); });
    }
  }
  /* ONE LOST REQUEST IS NOT A LOST SERVER (4 Nov: "Couldn't load 3 games from your game
     servers: they are on a server that isn't reachable right now", on a phone, with the server up and
     serving). One file download that failed in the network (a phone waking up, Wi-Fi dozing, a tab
     brought back) used to mark the whole server unreachable for five minutes, and every file queued
     behind it then failed at once with that message, without asking the server. Now the server is
     asked first (its health answer, after a short pause): still there, the same file is tried again from
     it; silent, it is unreachable as before. A file asked for while its server is still being looked
     for (the page just opened or came back) waits for that answer instead of failing straight away. */
  var T_RECHECK_PAUSE = 1000, T_CONNECT_WAIT = 20000;
  function stillThere(s) {
    var base = s.base;
    if (!base) return Promise.resolve(false);
    return new Promise(function (res) { setTimeout(res, T_RECHECK_PAUSE); }).then(function () {
      return timedFetch(base + '/api/v1/health', { method: 'GET' }, T_ATTEMPT);
    }).then(function (r) { return r.status === 200 ? r.json() : null; }).then(function (j) {
      return !!(j && j.server_id === s.id && s.base === base);
    }, function () { return false; });
  }
  function markDown(s) { s.base = ''; s.retryAt = Date.now() + T_FAIL_MEMORY; setState(s, 'unreachable', 'Not reachable from here right now.'); }
  /* spare: a download for the pre-load list (preloadFetch). Its bytes go to preload.js's own
     store only, so neither this page's memory nor the 200 MB cache holds a second copy. */
  function download(e, spare) {
    var size = e.size, buf = new Uint8Array(size), got = 0, contributors = {}, excluded = {}, last = null, rechecked = {}, waited = false, late = false;
    function attempt() {
      var cands = reachable(e).filter(function (s) { return !excluded[s.id]; });
      if (!cands.length && !waited) {
        var looking = Object.keys(e.holders).map(function (sid) { return C.servers[sid]; })
          .filter(function (s) { return s && !excluded[s.id] && (s.connecting || s.state === 'connecting'); });
        if (looking.length) {
          waited = true;
          var ask = Promise.all(looking.map(function (s) { return s.connecting || C.ready; }));
          return Promise.race([ask, new Promise(function (res) { setTimeout(res, T_CONNECT_WAIT); })])
            .then(function () { return attempt(); }, function () { return attempt(); });
        }
      }
      if (!cands.length) {
        var anyHolder = Object.keys(e.holders).some(function (sid) { var s = C.servers[sid]; return s && s.state === 'ready'; });
        /* late: a server answered but sent nothing for T_FIRST_BYTE (busy): it said so plainly (20 Nov 2026). */
        return Promise.reject(new Error(late ? R_SLOW : anyHolder ? 'none of your servers could send it just now.' : 'it is on a server that isn’t reachable right now.'));
      }
      var s = cands[0];
      var from = got;
      ev('download-from', { id: e.id, server: s.id, from: from, size: size });
      return rangeFrom(s, e, buf, from, last === s.id).then(function (pos) {
        if (pos > from || from === 0) contributors[s.id] = true;
        got = pos;
        if (got < size) throw Object.assign(new Error('short'), { status: 0, code: 'short' });
        return sha256(buf).then(function (h) {
          if (h === e.sha256) {
            ev('verified', { id: e.id, sha256: h, servers: Object.keys(contributors) });
            return buf;
          }
          /* 8.4: a mismatch is the servers' fault, never a game. */
          ev('bad-hash', { id: e.id, servers: Object.keys(contributors) });
          Object.keys(contributors).forEach(function (sid) { C.servers[sid].badUntil = Date.now() + T_BAD_HASH; excluded[sid] = true; });
          contributors = {}; got = 0; buf = new Uint8Array(size); last = null;
          return attempt();
        });
      }, function (err) {
        if (err.pos > got) { contributors[s.id] = true; got = err.pos; }
        last = s.id;
        excluded[s.id] = true;
        ev('download-failover', { id: e.id, server: s.id, at: got, reason: err.code || err.message });
        /* Busy, not gone (20 Nov 2026): it sent nothing for T_FIRST_BYTE. It is not asked again for this
           file, and not set aside for others either (they may be on another drive, and Try again uses it). */
        if (err.code === 'slow') { late = true; return attempt(); }
        if (err.code === 'device_revoked' || err.code === 'token_invalid') onAuthError(s, err);
        else if (err.status === 404) s.absent[e.sha256] = Date.now() + T_FAIL_MEMORY;
        else if (err.code === 'range_not_satisfiable') { got = 0; contributors = {}; }
        else if (err.status === 0 && !rechecked[s.id] && s.base && s.state === 'ready') {
          rechecked[s.id] = true;   // once per file and server: a second loss in a row counts
          return stillThere(s).then(function (ok) {
            if (ok) { delete excluded[s.id]; return attempt(); }
            if (s.state === 'ready') { s.failUntil = Date.now() + T_FAIL_MEMORY; markDown(s); }
            return attempt();
          });
        }
        else { s.failUntil = Date.now() + T_FAIL_MEMORY; if (err.status === 0 || err.status >= 500) markDown(s); }
        return attempt();
      });
    }
    return attempt().then(function (u) {
      if (spare) return u;
      _mem[e.sha256] = u;
      cachePut(e.sha256, u, Object.keys(e.holders));
      return u;
    });
  }
  /* PRE-LOAD ON DEVICE (18 Nov 2026): one listed title's verified bytes for preload.js. A copy this
     page already holds (in memory, or in the cache) is handed over with no network; otherwise,
     unless `local`, it is downloaded in the queue behind the games being opened, at most one at
     a time from preload.js. Resolves null when the title is not listed or not reachable now. */
  function preloadFetch(id, local) {
    var e = C.byId[id];
    if (!e || e.kind === 'gnw' || e.kind === 'cassette' || e.kind === 'tape') return Promise.resolve(null);
    if (_mem[e.sha256]) return Promise.resolve({ sha256: e.sha256, bytes: _mem[e.sha256] });
    return cacheGet(e.sha256).then(function (hit) {
      if (hit && hit.length === e.size) return { sha256: e.sha256, bytes: hit };
      if (local || !available(id)) return null;
      ev('preload-download', { id: id, size: e.size });
      return queued(function () { return download(e, true); }, false).then(function (u) { return u ? { sha256: e.sha256, bytes: u } : null; });
    });
  }
  /* THE START-UP FIRMWARE A PRE-LOADED GAME NEEDS (18 Nov 2026), so it starts after a log out with no
     download at all. The start-up firmware order (12 Nov): the original first, as the manufacturer made
     it; only the files a server lists count, and never a clone, an unlicensed or a bad copy (bootRank
     -1, BOOT_NEVER); our own firmware is built into the site and needs nothing kept. Per game:
       Game Boy: the Game Boy and Game Boy Color start-up programs the site would choose (every model
       plays with one of them), and a role-aware server's generic files for those systems; a game on the
       Super Game Boy shelf also its Super Game Boy files. Disk System: the drive firmware. Pokemon mini:
       its start-up program. Atari 5200, 7800, Lynx: the console's start-up images the site would offer
       (atariBios). Atari 2600 and NES cartridges need none (a 2600 game's own extras, such as the
       Supercharger's, are kept when the game is played: preload.js noteFirmware). No tape audio (.wav).
     Names, sizes and hashes only: nothing is downloaded here. */
  function preloadFirmware(id) {
    var e = C.byId[id];
    if (!e || !e.entry) return [];
    var sys = e.kind === 'atari' && /-x[0-9a-f]{12}$/.test(id) ? id.slice(0, id.lastIndexOf('-x')) : e.entry.system, want = [];   // the wall's system (siteIdFor)
    if (e.kind === 'gb') want = e.sgb || sys === 'sgb' ? ['gb', 'gbc', 'sgb'] : ['gb', 'gbc'];
    else if (e.kind === 'nes') want = sys === 'fds' ? ['fds'] : [];
    else if (e.kind === 'pm') want = ['pokemini'];
    else if (e.kind === 'atari') want = sys === 'a2600' ? [] : sys === 'sufami' ? ['snes'] : [sys];   // the Sufami Turbo's base program is a Super Nintendo start-up file (24 Nov 2026)
    if (!want.length) return [];
    var out = {}, WAV = /\.wav$/i;
    var add = function (b) {
      var n = b.entry || {};
      if (want.indexOf(n.system) < 0 || WAV.test(String(n.file_name || '')) || !reachable(b).length) return;
      out[b.sha256] = { sha256: b.sha256, size: b.size, system: n.system, name: String(n.title || n.name || n.file_name || 'Start-up program') };
    };
    Object.keys(C.boot).forEach(function (k) { add(C.boot[k]); });   // the site's own choice per slot (rank 0 to 3 only)
    var all = C.bootAll || {};
    Object.keys(all).forEach(function (h) { var b = all[h], n = b.entry || {}; if (b.rank >= 0 && (n.generic === true || n['default'] === true)) add(b); });
    return Object.keys(out).map(function (h) { return out[h]; });
  }
  /* One start-up file's verified bytes for preload.js, by its SHA-256 (as preloadFetch). */
  function preloadFetchSha(sha, local) {
    var e = (C.bootAll && C.bootAll[sha]) || null;
    if (!e) Object.keys(C.boot).forEach(function (k) { if (C.boot[k].sha256 === sha) e = C.boot[k]; });
    if (!e) return Promise.resolve(null);
    if (_mem[sha]) return Promise.resolve({ sha256: sha, bytes: _mem[sha] });
    return cacheGet(sha).then(function (hit) {
      if (hit && hit.length === e.size) return { sha256: sha, bytes: hit };
      if (local || !reachable(e).length) return null;
      ev('preload-download', { id: e.id, size: e.size, firmware: true });
      return queued(function () { return download(e, true); }, true).then(function (u) { return u ? { sha256: sha, bytes: u } : null; });
    });
  }
  function rangeFrom(s, e, buf, start, sameServer) {
    var tok = tokenOf(s.id);
    if (!tok) return Promise.reject(Object.assign(new Error('no token'), { status: 401, code: 'token_missing', pos: start }));
    var h = { Authorization: 'Bearer ' + tok.device_token };
    if (start > 0) { h.Range = 'bytes=' + start + '-'; if (sameServer) h['If-Range'] = '"' + e.sha256 + '"'; }
    var ctl = new AbortController(), pos = start, late = false, sent = false;
    var timer = setTimeout(function () { late = true; ctl.abort(); }, T_FIRST_BYTE);
    /* Asked and nothing yet after T_SLOW_NOTE: loadbar.js shows that the server is busy (20 Nov 2026).
       Cleared by the first bytes (cws:progress), or by the end of the download. */
    var slowT = setTimeout(function () { if (!sent) ev('slow', { id: e.id, server: s.id, size: e.size }); }, T_SLOW_NOTE);
    var url = s.base + '/api/v1/' + e.what + '/' + e.sha256 + '/data';
    var go = /^rtc:/.test(url) ? (R ? R.fetch(url, { headers: h, signal: ctl.signal }, 864e5) : Promise.reject(new Error('not connected')))   // REACH: the timers here still rule
      : fetch(url, { headers: h, mode: 'cors', credentials: 'omit', cache: 'no-store', signal: ctl.signal });
    return go.then(function (r) {
      clearTimeout(timer);
      if (r.status >= 400) {
        return r.json().catch(function () { return null; }).then(function (j) { var x = apiErr(r.status, j); x.pos = start; throw x; });
      }
      if (r.status === 206) {
        var m = /bytes (\d+)-(\d+)\/(\d+)/.exec(r.headers.get('Content-Range') || '');
        if (!m || +m[1] !== start || +m[3] !== e.size) { try { ctl.abort(); } catch (x) {} throw Object.assign(new Error('range'), { status: 0, code: 'range', pos: start }); }
      } else pos = 0;   // a 200 is the whole file, from the start
      var reader = r.body.getReader();
      function read() {
        timer = setTimeout(function () { ctl.abort(); }, T_STALL);
        return reader.read().then(function (x) {
          clearTimeout(timer);
          if (!sent) { sent = true; clearTimeout(slowT); }
          if (x.done) return pos;
          if (pos + x.value.length > buf.length) { try { ctl.abort(); } catch (y) {} throw Object.assign(new Error('longer than listed'), { status: 0, code: 'size', pos: 0 }); }
          buf.set(x.value, pos); pos += x.value.length;
          ev('progress', { id: e.id, server: s.id, got: pos, size: buf.length });
          return read();
        });
      }
      return read();
    }).catch(function (err) {
      clearTimeout(timer); clearTimeout(slowT); sent = true;
      /* First: an abort is a DOMException whose own code is the number 20, which the line after this one
         used to pass on as if it were a server's answer (20 Nov 2026). */
      if (late) throw Object.assign(new Error('no answer in time'), { status: 0, code: 'slow', pos: pos });
      if (err && typeof err.code === 'string' && err.code) { if (err.pos === undefined) err.pos = pos; throw err; }
      throw Object.assign(new Error('connection lost'), { status: 0, code: 'network', pos: pos });
    });
  }

  /* ---------------------------------------------------------------- archives and other systems (2026-10-12)
     A small zip reader (stored and deflate members), for Game & Watch device
     zips: the site carries no zip library, and DecompressionStream is in every
     browser this site supports. */
  function inflateRaw(u8) {
    var ds = new DecompressionStream('deflate-raw');
    return new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  function unzip(u8) {
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), eocd = -1;
    for (var i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) return Promise.resolve([]);
    var n = dv.getUint16(eocd + 10, true), off = dv.getUint32(eocd + 16, true), out = [];
    for (var k = 0; k < n && off + 46 <= u8.length; k++) {
      if (dv.getUint32(off, true) !== 0x02014b50) break;
      var method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true), nlen = dv.getUint16(off + 28, true),
          xlen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true), lho = dv.getUint32(off + 42, true);
      var name = new TextDecoder().decode(u8.subarray(off + 46, off + 46 + nlen));
      off += 46 + nlen + xlen + clen;
      if (/\/$/.test(name) || dv.getUint32(lho, true) !== 0x04034b50) continue;
      var start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true), data = u8.subarray(start, start + csize);
      if (method === 0) out.push(Promise.resolve({ name: name, bytes: data }));
      else if (method === 8) out.push(inflateRaw(data).then(function (nm) { return function (b) { return { name: nm, bytes: b }; }; }(name)));
    }
    return Promise.all(out);
  }
  function b64of(u8) {
    var out = '';
    for (var i = 0; i < u8.length; i += 0x8000) out += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(out);
  }
  /* Game & Watch: {<gameKey>: {program: b64, melody?: b64}}, the shape
     firmware/output/gnw_games.json and a content pack give gnw-host.js. Every
     reachable device zip is downloaded (verified by SHA-256 like any title),
     unpacked, and each file matched against the pack's own manifest by the
     pack's own rule (content_pack.js gnwMatch: whole file, then each shorter
     known length, for dumps padded to 2 KB), so only a known dump is used, and
     a dump that serves several devices reaches all of them. null when there is
     none. Zips of 1 MB and more are left to gnwTft: no classic device comes
     near that size, and the colour units' are 1 to 3 MB each. */
  var GNW_BIG = 1048576;
  var _gnwPrograms = null, _gnwSig = '', _gnwTft = {}, _tftSig = '';
  function gnwIds(big) {
    return Object.keys(C.byId).filter(function (id) { var e = C.byId[id]; return e.kind === 'gnw' && available(id) && (e.size >= GNW_BIG) === big; })
      .sort(function (a, b) { return C.byId[a].size - C.byId[b].size || (a < b ? -1 : 1); });
  }
  function gnwMatch(u8) {
    var P = window.__GNW_PACK;
    if (P && typeof P.gnwMatch === 'function') return P.gnwMatch(u8);
    return sha256(u8).then(function (h) {   // an older content_pack.js: whole-file hash only
      var m = identify(h);
      return m && m.kind === 'gnw' && m.device ? [{ device: m.device, part: m.part, bytes: u8.length }] : [];
    });
  }
  function gnwPrograms() {
    var ids = gnwIds(false), sig = ids.join(',');
    if (_gnwPrograms && sig === _gnwSig) return _gnwPrograms;
    _gnwSig = sig;
    if (!ids.length) return (_gnwPrograms = Promise.resolve(null));
    _gnwPrograms = Promise.all(ids.map(function (id) {
      return fetchBytes(id).then(function (u) { return u ? unzip(u) : []; }, function () { return []; });
    })).then(function (lists) {
      var files = [].concat.apply([], lists).filter(function (f) { return !/\.(svg|json|txt)$/i.test(f.name); }), dumps = {}, any = false;
      return Promise.all(files.map(function (f) {
        return gnwMatch(f.bytes).then(function (rows) {
          rows.forEach(function (m) {
            var part = m.part === 'melody' ? 'melody' : 'program', d = dumps[m.device] = dumps[m.device] || {};
            if (!d[part]) { d[part] = b64of(f.bytes.subarray(0, m.bytes)); any = true; }
          });
        });
      })).then(function () { return any ? dumps : null; });
    });
    return _gnwPrograms;
  }
  /* The colour units (Super Mario Bros. and Zelda, HXA-001 and HXB-001): the
     device zip's manifest.json names the unit ("key": "tft-mario") and its
     internal and external flash files. Answers {internal: b64, external: b64},
     the shape a content pack gives the twin (content_pack.js tft()), or null.
     Each file must have the size and SHA-256 the zip's own manifest states;
     the page's unsupported list still checks the bytes before they run. The
     big zips are tried smallest first and the search stops at the unit. */
  var TFT_EXT = { mario: 1048576, zelda: 4194304 };
  function gnwTft(unit) {
    if (!TFT_EXT[unit]) return Promise.resolve(null);
    var ids = gnwIds(true), sig = ids.join(',');
    if (sig !== _tftSig) { _tftSig = sig; _gnwTft = {}; }   // the library changed
    if (_gnwTft[unit]) return _gnwTft[unit];
    function check(files, name, size, want) {
      var f = files.filter(function (x) { return x.name === name; })[0];
      if (!f || f.bytes.length !== size || (want && want.bytes !== size)) return Promise.resolve(null);
      return sha256(f.bytes).then(function (h) { return !want || !want.sha256 || h === String(want.sha256).toLowerCase() ? f.bytes : null; });
    }
    function attempt(i) {
      if (i >= ids.length) return Promise.resolve(null);
      return fetchBytes(ids[i]).then(function (u) { return u ? unzip(u) : []; }, function () { return []; }).then(function (files) {
        var mf = files.filter(function (x) { return x.name === 'manifest.json'; })[0], man = null;
        try { man = mf ? JSON.parse(new TextDecoder().decode(mf.bytes)) : null; } catch (e) { man = null; }
        if (!man || man.kind !== 'tft' || man.key !== 'tft-' + unit || !man.load) return attempt(i + 1);
        var fl = man.files || {};
        return Promise.all([check(files, man.load.internalFlash, 131072, fl.internal), check(files, man.load.externalFlash, TFT_EXT[unit], fl.external)])
          .then(function (b) { return b[0] && b[1] ? { internal: b64of(b[0]), external: b64of(b[1]) } : attempt(i + 1); });
      });
    }
    return (_gnwTft[unit] = attempt(0).then(function (fw) { if (!fw) delete _gnwTft[unit]; return fw; }));
  }
  /* Atari 5200, 7800 and Lynx boot programs from the servers, in the shape the
     Atari pages already take from atari_bios.json: {sha256: {s, n, z, what, b}}. */
  function atariBios(prefix) {
    var ids = Object.keys(C.boot).filter(function (id) { var e = C.boot[id]; return /^atari-bios:/.test(id) && e.entry && e.entry.system === prefix && reachable(e).length; })
      .sort(function (a, b) { return C.boot[a].rank - C.boot[b].rank; });   // the server's default first (L18)
    if (!ids.length) return Promise.resolve(null);
    return Promise.all(ids.map(function (id) { return fetchB64(id).then(function (b) { return b; }, function () { return null; }); })).then(function (bs) {
      var out = {};
      ids.forEach(function (id, i) {
        var e = C.boot[id];
        if (bs[i]) out[e.sha256] = { s: prefix, n: e.entry.title || e.entry.file_name || 'BIOS', z: e.size, what: 'bios', b: bs[i] };
      });
      return Object.keys(out).length ? out : null;
    });
  }
  /* Study Box tapes (150-180 MB each) are never downloaded whole: the NES page's
     deck reads a few seconds ahead, by HTTP Range, from a server that holds it. */
  function tapes() {
    return Object.keys(C.byId).filter(function (id) {
      var e = C.byId[id];
      return (e.kind === 'tape' || (e.kind === 'cassette' && /^stud/.test(String((e.entry || {}).format || '').toLowerCase()))) && available(id);
    }).map(function (id) {
      var e = C.byId[id], n = e.entry || {};
      return { id: id, sha256: e.sha256, size: e.size, name: n.file_name || n.title || id };
    });
  }
  /* The cassette shelf: every reachable cassette ({ id, name, folder, size, format }), and the id of the
     first reachable one with a file name (compared ignoring case; Kid Vid tapes are asked for as
     KVS1.WAV and the like). Bytes come by fetchB64(id) or, for a long tape, readRange(id, ...). */
  function cassettes() {
    return Object.keys(C.byId).filter(function (id) { return C.byId[id].kind === 'cassette' && available(id); }).map(function (id) {
      var e = C.byId[id], n = e.entry || {};
      return { id: id, name: n.file_name || n.title || id, folder: n.folder || '', size: e.size, format: String(n.format || '').toLowerCase() };
    }).sort(function (a, b) { return (a.folder + '/' + a.name).localeCompare(b.folder + '/' + b.name); });
  }
  function cassetteByName(name) {
    var want = String(name || '').toUpperCase(), hit = null;
    cassettes().forEach(function (c) { if (!hit && String(c.name).toUpperCase() === want) hit = c.id; });
    return hit;
  }
  /* A LARGE GAME IN PIECES (22 Nov 2026, the Nintendo 64: 4 to 64 MB a game). The servers that hold
     a title and answer now, nearest first, each as { sha256, size, url, server, fetch }: the file's
     data address and a fetch that carries this device's token (a data channel too, by timedFetch).
     Nothing is fetched here; play/host/site-relay.js asks for the file in ranges (API.md 6.3). */
  function rangedSources(id) {
    var e = C.byId[id]; if (!e) return [];
    var out = [];
    reachable(e).forEach(function (s) {
      var tok = tokenOf(s.id); if (!tok) return;
      out.push({ sha256: e.sha256, size: e.size, server: label(s),
        url: s.base + '/api/v1/' + e.what + '/' + e.sha256 + '/data',
        fetch: function (u, init) {
          var o = Object.assign({}, init || {});
          o.headers = Object.assign({}, o.headers || {}, { Authorization: 'Bearer ' + tok.device_token });
          return timedFetch(u, o, 30000);
        } });
    });
    return out;
  }
  function readRange(id, off, len) {
    var e = C.byId[id]; if (!e) return Promise.reject(new Error('no such tape'));
    var cands = reachable(e);
    function attempt(i) {
      var s = cands[i]; if (!s) return Promise.reject(new Error('no server holding this tape is reachable'));
      var tok = tokenOf(s.id); if (!tok) return attempt(i + 1);
      var end = Math.min(e.size, off + len) - 1;
      return timedFetch(s.base + '/api/v1/cartridges/' + e.sha256 + '/data', { headers: { Authorization: 'Bearer ' + tok.device_token, Range: 'bytes=' + off + '-' + end } }, 20000)
        .then(function (r) {
          if (r.status !== 206 && r.status !== 200) throw new Error('HTTP ' + r.status);
          return r.arrayBuffer().then(function (b) {
            var u = new Uint8Array(b);
            return r.status === 200 ? u.subarray(off, end + 1) : u;
          });
        }).catch(function () { return attempt(i + 1); });
    }
    return attempt(0);
  }

  /* Pokemon mini: the site plays from one in-memory map of every title. */
  function pmAvailability() {
    var out = null;
    Object.keys(C.byId).forEach(function (id) { if (C.byId[id].kind === 'pm' && available(id)) { (out = out || {})[id] = true; } });
    if (out && available('pm:bios')) out.bios = true;
    return out;
  }
  function pmGameFiles() {
    var ids = Object.keys(C.byId).filter(function (id) { return C.byId[id].kind === 'pm' && available(id); });
    if (!ids.length) return Promise.resolve(null);
    var out = {};
    var jobs = ids.map(function (id) { return fetchB64(id).then(function (b) { if (b) out[id] = b; }); });
    if (available('pm:bios')) jobs.push(fetchB64('pm:bios').then(function (b) { if (b) out.bios = b; }));
    return Promise.all(jobs).then(function () { return Object.keys(out).length ? out : null; });
  }

  /* ---------------------------------------------------------------- forgetting */
  function frameCacheKeys(id) {
    if (id === 'gb:bios') return [['gameboy', 'blobs', 'bios']];
    if (id === 'gb:biosCgb') return [['gameboy', 'blobs', 'biosCgb']];
    if (/^gb-/.test(id)) return [['gameboy', 'blobs', 'cart:' + id.slice(3)]];
    if (/^nes-/.test(id)) return [['nes-play', 'carts', 'cart:' + id.slice(4)]];
    var pre = id.split('-')[0], sys = atariPrefixes()[pre];
    if (sys) return [[sys + '-play', 'carts', id]];
    return [];
  }
  function deleteFrameKey(dbName, store, key) {
    return new Promise(function (res) {
      try {
        var r = indexedDB.open(dbName);
        r.onupgradeneeded = function () { try { r.transaction.abort(); } catch (e) {} };   // never create a play page's database
        r.onsuccess = function () {
          var d = r.result;
          if (!d.objectStoreNames.contains(store)) { d.close(); res(); return; }
          var tx = d.transaction(store, 'readwrite'); tx.objectStore(store).delete(key);
          tx.oncomplete = tx.onerror = function () { d.close(); res(); };
        };
        r.onerror = function () { res(); };
      } catch (e) { res(); }
    });
  }
  function packHolds(id) {
    var P = window.__GNW_PACK; if (!P) return false;
    try {
      if (/^gb-/.test(id)) return !!P.gameboy(id);
      if (id === 'gb:bios' || id === 'gb:biosCgb') return !!P.gameboy(id.slice(3));
      if (/^nes-/.test(id)) return !!(P.nes && P.nes(id));
      if (atariPrefixes()[id.split('-')[0]]) return !!(P.atari && P.atari(id));
    } catch (e) {}
    return false;
  }
  /* The cartridges a server supplied go when it does: from this file's cache,
     from memory, and from the play windows' own databases, unless another
     linked server or the open content pack still holds them. */
  function dropServerContent(sid, all) {
    var before = {}, k;
    for (k in C.byId) if (C.byId[k].holders[sid]) before[k] = C.byId[k].sha256;
    for (k in C.boot) if (C.boot[k].holders[sid]) before[k] = C.boot[k].sha256;
    if (!all) { var s = C.servers[sid]; if (s) { s.items = null; s.bootItems = null; s.fresh = false; } }
    idb('listings', 'readwrite', function (st) { st.delete(C.vhp + ':' + sid); });
    rebuild();
    var gone = Object.keys(before).filter(function (id) { return all || !has(id); });
    var jobs = gone.map(function (id) {
      var sha = before[id];
      delete _mem[sha];
      var j = [idb('carts', 'readwrite', function (st) { st.delete(sha); })];
      if (!packHolds(id)) frameCacheKeys(id).forEach(function (x) { j.push(deleteFrameKey(x[0], x[1], x[2])); });
      return Promise.all(j);
    });
    ev('content-dropped', { server: sid, count: gone.length });
    return Promise.all(jobs);
  }
  /* Leaving a server (Use a different server): this browser drops it at once, so the tile is back to
     the two choices straight away; the goodbye to the server (DELETE /api/v1/session on the connection
     in use, 1.5 s at most), the vault's trusted list and the clean-up of its game copies follow without
     holding the tile. A server met over the internet stays set aside here (Use again), so it does not
     come back by itself; a typed address is simply forgotten. */
  function forgetServer(sid) {
    var s = C.servers[sid]; if (!s) return Promise.resolve();
    clearTimeout(s.pollTimer); s.left = true;
    var bye = (tokenOf(sid) && s.base) ? api(s, 'DELETE', '/session', { auth: 'device', timeout: 1500 }).catch(function () {}) : Promise.resolve();
    var rtc = !!(s.listing && s.listing.rtc);
    var drop = dropServerContent(sid, false);   // reads what only this server held, before it goes
    slot(K_TOKENS, sid, null); slot(K_TOKENS_R, sid, null); slot(K_PAIR, sid, null); slot(K_WITHDRAWN, sid, null); slot(K_DIRECT, sid, null);
    slot(K_CONFIRM, sid, rtc ? 'no' : null);
    s.pairing = null; closePairingDialog(s, true);
    delete C.servers[sid];
    rebuild(); render();
    ev('forgotten', { server: sid });
    /* REACH: the vault's trusted list, after the goodbye (forgetting closes the data channel it travels on) */
    var reg = (rtc && R) ? bye.then(function () { return R.forget(sid); }).catch(function () {}) : null;   // a typed address has no trusted list
    return Promise.all([bye, drop, reg]).then(function () {}, function () {});
  }
  /* Log out and switching vaults delete every token of the old vault (2.1). */
  function forgetVault() {
    if (R) R.stop();
    var vhp = C.vhp; if (!vhp) return Promise.resolve();
    [K_TOKENS, K_TOKENS_R, K_CONFIRM, K_PAIR, K_DIRECT, K_WITHDRAWN].forEach(function (k) { var a = lsGet(k); delete a[vhp]; lsSet(k, a); });
    Object.keys(C.servers).forEach(function (sid) { clearTimeout(C.servers[sid].pollTimer); });
    var ids = Object.keys(C.byId).concat(Object.keys(C.boot));
    var jobs = ids.map(function (id) { return packHolds(id) ? null : Promise.all(frameCacheKeys(id).map(function (x) { return deleteFrameKey(x[0], x[1], x[2]); })); });
    jobs.push(db().then(function (d) {
      if (!d) return;
      return new Promise(function (res) {
        var tx = d.transaction(['listings', 'carts'], 'readwrite');
        tx.objectStore('listings').clear(); tx.objectStore('carts').clear();
        tx.oncomplete = tx.onerror = function () { res(); };
      });
    }));
    C.servers = {}; C.byId = {}; C.bySha = {}; C.boot = {}; _mem = {};
    C.vault = null; C.vhp = null;
    return Promise.all(jobs).then(function () { rebuild(); });
  }
  /* Rotation keeps every server (D-C4): move this browser's tokens to the new
     code's partition. */
  function rekey(oldVhp, newVhp) {
    [K_TOKENS, K_TOKENS_R, K_CONFIRM, K_PAIR, K_DIRECT, K_WITHDRAWN].forEach(function (k) { var a = lsGet(k); if (a[oldVhp]) { a[newVhp] = a[oldVhp]; delete a[oldVhp]; lsSet(k, a); } });
    return db().then(function (d) {
      if (!d) return;
      return new Promise(function (res) {
        var tx = d.transaction(['listings', 'carts'], 'readwrite');
        tx.objectStore('listings').openCursor().onsuccess = function (e) {
          var cur = e.target.result; if (!cur) return;
          var k = String(cur.key);
          if (k.indexOf(oldVhp + ':') === 0) { tx.objectStore('listings').put(cur.value, newVhp + k.slice(oldVhp.length)); cur.delete(); }
          cur.continue();
        };
        tx.objectStore('carts').openCursor().onsuccess = function (e) {
          var cur = e.target.result; if (!cur) return;
          if (cur.value.vhp === oldVhp) { var v = cur.value; v.vhp = newVhp; cur.update(v); }
          cur.continue();
        };
        tx.oncomplete = tx.onerror = function () { res(); };
      });
    });
  }

  /* ---------------------------------------------------------------- 2.4a direct connection
     The user types host[:port]: the typed address is the confirmation, and
     pairing sends "direct" with the signed vault identity. */
  function directListings() {
    var all = slotAll(K_DIRECT);
    return Object.keys(all).filter(function (sid) { return SID_RE.test(sid) && all[sid] && all[sid].host; }).map(function (sid) {
      return { server_id: sid, direct: all[sid] };
    });
  }
  function parseAddress(text) {
    var t = String(text || '').trim(), scheme = '';
    var m = /^(https?):\/\//i.exec(t);
    if (m) { scheme = m[1].toLowerCase() + '://'; t = t.slice(m[0].length); }
    t = t.replace(/\/.*$/, '');
    var host, port = 34580;
    if ((m = /^\[([0-9a-f:.]+)\](?::(\d{1,5}))?$/i.exec(t))) { host = m[1]; if (m[2]) port = +m[2]; }
    else if ((m = /^([a-z0-9.-]+)(?::(\d{1,5}))?$/i.exec(t))) { host = m[1].toLowerCase(); if (m[2]) port = +m[2]; }
    else return null;
    if (!host || port < 1 || port > 65535) return null;
    var loop = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (scheme === 'http://' && !loop) return null;   // section 3: HTTPS only, except this machine
    return { host: host, port: port, scheme: scheme, loop: loop };
  }
  /* WHY A DIRECT ADDRESS FAILED, in plain words (2026-10-12). A browser does
     not say why a fetch failed, so it is worked out from what can be seen:
       - a loopback address (localhost) only ever reaches the computer the page
         is on, and a page that is not itself on localhost may not use it at all;
       - an answer to a no-cors request means the server is reachable and its
         certificate is trusted, so the CORS refusal is this site's address
         missing from the server's list;
       - no answer within the time limit is the network or a firewall;
       - a quick failure has several causes the browser will not separate: a
         misspelt name, another network, nothing on that port, the browser's
         local network permission, a plain http page, or (for a bare number,
         which gets the server's own certificate) an untrusted certificate.
         Only what can be told apart is stated; the rest is a list to check. */
  function isLoopName(h) { h = String(h || '').toLowerCase().replace(/^\[|\]$/g, ''); return h === 'localhost' || h === '127.0.0.1' || h === '::1' || /\.localhost$/.test(h); }
  function lanHint(port) {
    var h = location.hostname;
    return isLoopName(h) ? 'the server computer\'s network address' : hostPart(h) + ':' + port;
  }
  function loopbackProblem(a) {
    if (!isLoopName(a.host) || isLoopName(location.hostname)) return '';
    return 'This address only works on the server\'s own computer, and only from a page opened there as localhost. Use ' + lanHint(a.port) +
           ' instead (the server\'s Dashboard lists its addresses under Connecting devices).';
  }
  function isBareAddress(h) { h = String(h || ''); return /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.indexOf(':') >= 0; }
  function secureAddress() {
    return 'https://' + hostPart(location.hostname) + (location.port ? ':8443' : '') + '/';
  }
  /* Whether the browser says this site may not reach the local network. Names differ
     between browser versions and most browsers have neither: unknown is simply "no". */
  function localNetworkDenied() {
    if (!navigator.permissions || !navigator.permissions.query) return Promise.resolve(false);
    return Promise.all(['local-network-access', 'local-network'].map(function (name) {
      try { return navigator.permissions.query({ name: name }).then(function (p) { return p.state === 'denied'; }, function () { return false; }); }
      catch (e) { return Promise.resolve(false); }
    })).then(function (r) { return r[0] || r[1]; });
  }
  function diagnose(a, scheme) {
    var lp = loopbackProblem(a); if (lp) return Promise.resolve(lp);
    var base = (scheme || 'https://') + hostPart(a.host) + ':' + a.port, where = hostPart(a.host) + ':' + a.port;
    var ctl = new AbortController(), t0 = Date.now(), timer = setTimeout(function () { ctl.abort(); }, 4000);
    return fetch(base + '/api/v1/health', { mode: 'no-cors', credentials: 'omit', cache: 'no-store', signal: ctl.signal }).then(function () {
      clearTimeout(timer);
      if (location.protocol !== 'https:') {
        return 'The server at ' + where + ' answered, but it only accepts the secure version of this site. Open ' + secureAddress() + ' on this device, then connect again.';
      }
      return 'The server at ' + where + ' answered, but it does not accept this website\'s address (' + location.origin +
             '). Its owner adds it on the server\'s Security page, under Website addresses that may use this server.';
    }, function () {
      clearTimeout(timer);
      if (Date.now() - t0 >= 3500) {
        return 'No answer from ' + where + ' (it timed out). Check that the address is spelt correctly, that this device is on the same network as the server (a home address does not work over mobile data), and that the server is running. If all of those are right, the usual cause is the firewall on the server\'s computer: its owner allows inbound TCP port ' + a.port + ' for Private networks.';
      }
      if (location.protocol === 'https:' && location.hostname.toLowerCase() === String(a.host).toLowerCase()) {
        return 'Nothing answered on port ' + a.port + ' at ' + hostPart(a.host) + '. Check that the game server is running and that the port is right.';
      }
      if (location.protocol !== 'https:' && !isLoopName(location.hostname)) {
        return 'Could not connect to ' + where + ' from this page, because it is open as http://. Browsers stop a plain http page from reaching a game server on your network. Open ' + secureAddress() + ' on this device, then connect again.';
      }
      return localNetworkDenied().then(function (denied) {
        if (denied) return 'This browser is blocking this site from reaching devices on your network, so it could not connect to ' + where + '. Open the site settings from the icon beside the address bar, allow Local network access, reload the page and connect again.';
        return 'Could not connect to ' + where + ', and the browser does not give a reason. Check that the address is spelt correctly, that this device is on the same network as the server (a home address does not work over mobile data), that the server is running and that the port is right. If the browser asked to reach devices on your network, allow it.' +
               (isBareAddress(a.host) ? ' This address is a bare number, so this device must also trust the server\'s own certificate: install the home certificate in this device\'s Settings (on Android: Security, Install a certificate, CA certificate; opening the file in Files is not enough).' : '');
      });
    });
  }
  function directConnect(text) {
    if (!C.vault) return Promise.resolve({ ok: false, msg: 'This browser has no vault code yet. Set one up in Settings first.' });
    var a = parseAddress(text);
    if (!a) return Promise.resolve({ ok: false, msg: 'That is not an address. Type something like 192.168.1.20 or 192.168.1.20:34580.' });
    if (cwsOff() && window.CwSources) window.CwSources.set('cws', true);   // adding a server is wanting them: the switch goes on
    var lp = loopbackProblem(a);
    if (lp) return Promise.resolve({ ok: false, msg: lp });   // never saved
    var tries = a.scheme ? [a.scheme] : (a.loop ? ['https://', 'http://'] : ['https://']);
    function attempt(i) {
      var ctl = new AbortController();
      return healthAt({ kind: 'lan', host: a.host, port: a.port, scheme: tries[i] }, null, ctl).then(function (w) {
        return { w: w, scheme: tries[i] };
      }, function (e) { if (i + 1 < tries.length) return attempt(i + 1); throw e; });
    }
    return attempt(0).then(function (r) {
      var h = r.w.health || {}, sid = h.server_id;
      if (!SID_RE.test(sid || '')) return { ok: false, msg: 'Something answered at that address, but it is not a CrystalVault Server.' };
      slot(K_DIRECT, sid, { host: a.host, port: a.port, scheme: r.scheme });
      slot(K_CONFIRM, sid, 'yes');   // typing the address is the confirmation (2.4a step 2)
      var s = srvOf(sid);
      s.listing = directListings().filter(function (l) { return l.server_id === sid; })[0];
      s.base = ''; s.retryAt = 0;
      ev('direct-added', { server: sid });
      return connect(s, 'retry').then(function () {
        rebuild();
        if (s.state === 'unpaired' && !tokenOf(sid)) return startPairing(s);
      }).then(function () { return { ok: true, sid: sid, state: s.state }; });
    }, function () {
      return diagnose(a, tries[0]).then(function (why) { return { ok: false, msg: why }; });
    });
  }
  function directDialog() {
    var d = dialog({
      sub: 'Game servers', title: 'Direct connect',
      html: '<p style="' + P + '">Type the address of a game server on your network, or one whose owner gave you its address. The server\'s owner lists it on the server\'s Dashboard, under <b style="color:var(--text)">Connecting devices</b>.</p>' +
            '<form class="cws-direct-form" autocomplete="off" style="display:flex; gap:10px; align-items:center; margin:0 0 6px;">' +
            '<input class="cws-direct" type="text" inputmode="url" autocomplete="off" spellcheck="false" aria-label="Server address" placeholder="192.168.1.20:34580" style="flex:1; ' + INPUT + ' font-family:ui-monospace,Consolas,monospace;"></form>' +
            '<div class="cws-msg" role="status" style="margin-top:6px; font-size:12px; color:var(--muted); min-height:18px;"></div>' +
            '<p style="' + P + ' font-size:11px; font-style:italic;">The server\'s owner still decides: they approve your login on the server the first time. You join as yourself, with your alias and avatar.</p>',
      actions: [
        { label: 'Connect', kind: 'accent', action: 'direct-submit', onClick: function () { go(); } },
        { label: 'Cancel', action: 'close', onClick: function (dd) { dd.close(); } }
      ]
    });
    function go() {
      if (!d.el) return;
      var inp = d.el.querySelector('.cws-direct'), msg = d.el.querySelector('.cws-msg'), btn = d.el.querySelector('[data-cws-action="direct-submit"]');
      btn.disabled = true; msg.textContent = 'Connecting…'; msg.style.color = 'var(--muted)';
      directConnect(inp.value).then(function (r) {
        btn.disabled = false;
        if (r.ok) { d.close(); return; }
        msg.textContent = r.msg; msg.style.color = '#f08a5d';
        try { inp.focus(); } catch (e) {}
      });
    }
    var tryWire = function () {
      if (!d.el) { setTimeout(tryWire, 200); return; }
      d.el.querySelector('.cws-direct-form').addEventListener('submit', function (e) { e.preventDefault(); go(); });
    };
    tryWire();
    return d;
  }

  /* The cycle: at start, on the five-minute refresh and when asked. The servers are the typed
     addresses and the ones cws-reach.mjs found; a ready server only re-reads its library (cheap:
     the first page answers 304 when nothing changed, 6.1). */
  function refresh() {
    if (!C.vault) return Promise.resolve();
    if (cwsOff()) { rebuild(); render(); return Promise.resolve(); }   // switched off: nobody is asked
    return Promise.resolve(directListings()).then(function (list) {
      if (R) R.listings().forEach(function (l) {
        if (slot(K_CONFIRM, l.server_id) === undefined) slot(K_CONFIRM, l.server_id, 'yes');   // REACH: no first-visit question (the server lists this vault's connection key)
        var typed = list.filter(function (x) { return x.server_id === l.server_id && x.direct; })[0];
        if (typed) typed.rtc = l.rtc; else list.push(l);   // a typed address too: one server, both ways
      });
      list.forEach(function (l) { srvOf(l.server_id).listing = l; });
      return Promise.all(list.map(function (l) {
        var s = srvOf(l.server_id);
        if (s.state === 'ready' && s.base) return loadLibrary(s);
        if (s.state === 'unreachable' && s.retryAt > Date.now()) return null;
        return connect(s, s.base ? '' : 'retry');
      }));
    }).then(function () { rebuild(); render(); });
  }
  function retryDue(now) {
    if (!C.vault || cwsOff()) return;
    Object.keys(C.servers).forEach(function (sid) {
      var s = C.servers[sid];
      /* Coming back to the page or back online (now === true): ask again at once, not after
         the five minutes; what failed may have been this device's own network asleep (4 Nov). */
      if (now === true && s.listing && s.state === 'unreachable' && !s.connecting) s.retryAt = 0;
      if (s.listing && s.state === 'unreachable' && !(s.retryAt > Date.now())) connect(s, 'retry').then(rebuild);
    });
  }
  /* Another tab of this site changed what this browser holds (a withdrawal
     seen there, a join, a forget): follow it here, so no tab keeps offering
     a PIN for a pass that is gone. */
  window.addEventListener('storage', function (e) {
    if (!C.vault || (e.key !== K_TOKENS && e.key !== K_TOKENS_R && e.key !== K_WITHDRAWN)) return;
    Object.keys(C.servers).forEach(function (sid) {
      var s = C.servers[sid], tok = tokenOf(sid);
      if (!tok && s.state === 'ready') lostToken(s);
      else if (!tok && s.state === 'unpaired' && withdrawn(sid)) setState(s, 'withdrawn', WITHDRAWN_MSG);
      else if (tok && (s.state === 'unpaired' || s.state === 'withdrawn' || s.state === 'pairing')) {
        clearTimeout(s.pollTimer); s.pairing = null; closePairingDialog(s, true);   // the other tab collected the pass
        connect(s).then(rebuild);
      }
    });
  });

  /* ONE CATALOGUE READ ON A COLD LOAD (2026-10-28). The page's catalogue loaders
     (index.html ensureGbCarts, ensureNesFiles, ensureAtariFiles, pmProbeAvailability) used to
     merge in the game servers' titles as soon as they ran, which on a cold load was before the
     servers had answered; the servers' first answer then changed the library and every catalogue
     was read and adopted again (reloadAllGameContent): about 2 s of a busy page, and the wall
     (emby.js wallGamesSettled) waited for both. Now the loaders wait for the first answer here
     (the vault's servers asked once, C.ready) and merge it; a library change before then reloads
     nothing, as the waiting loaders will read it. At most T_FIRST_WAIT: a slower answer is merged
     when it comes, by the reload, as before. Every later change reloads as before. */
  var T_FIRST_WAIT = 8000;
  var _firstOpen = true, _firstP = null, _firstRes = null;
  function firstDone() { _firstOpen = false; if (_firstRes) _firstRes(); }
  function first() {
    if (!_firstOpen) return Promise.resolve();
    if (!_firstP) { _firstP = new Promise(function (res) { _firstRes = res; }); setTimeout(firstDone, T_FIRST_WAIT); }
    return _firstP;
  }
  C.ready.then(firstDone, firstDone);
  /* NOTHING TO WAIT FOR (28 Oct): with no game server set up in this browser
     (no device token for any vault) or game servers switched off in Settings (source-switch.js),
     no server can add a title, so the first answer is "none" at once and nothing waits for one
     (the catalogue loaders, emby.js's wall hold). init() asks the same of this vault. */
  function nothingSetUp(vhp) {
    if (cwsOff()) return true;
    var all = lsGet(K_TOKENS), rem = lsGet(K_TOKENS_R);
    if (vhp) return !Object.keys(all[vhp] || {}).length && !Object.keys(rem[vhp] || {}).length;
    return ![all, rem].some(function (a) { return Object.keys(a).some(function (k) { return a[k] && Object.keys(a[k]).length; }); });
  }
  if (nothingSetUp()) C.readyResolve();

  /* No vault part to answer (21 Nov 2026): the head script's wait (index.html, html.cw-vaultwait) ends now. */
  function liftVaultWait() { try { document.documentElement.classList.remove('cw-vaultwait'); } catch (e) {} }

  function init(code) {
    code = String(code || '').toLowerCase();
    if (!UUID_RE.test(code)) { liftVaultWait(); C.readyResolve(); return C.ready; }
    if (C.vault === code) return C.ready;
    var old = C.vhp;
    return storeKey(code).then(function (vhp) {
      C.vault = code; C.vhp = vhp; C.servers = {};
      C.signature = '|';   // the empty library's signature: no server, no repaint
      if (nothingSetUp(vhp)) C.readyResolve();   // nothing set up for this vault: nobody waits
      return loadCachedListings();
    }).then(function () {
      injectSettings();
      if (Object.keys(C.servers).length) rebuild();
      loadReach().then(function (r) {
        if (!r || C.vault !== code) { if (!r) liftVaultWait(); render(); return; }
        /* Then look once more, so trusted servers not in the room show as not online instead of waiting. */
        return Promise.resolve(r.start(reachHooks())).then(function () { if (C.vault === code) return refresh(); });
      });
      return refresh();
    }).then(function () { C.readyResolve(); ev('ready'); }, function (e) { warn('init', e && e.message); C.readyResolve(); });
  }

  /* ================================================================= UI
     Every surface is in the site's own tokens (docs/DESIGN-TOKENS.md):
     .vault-section cards, the small-capitals label, .btn-tiny, the solid accent
     button, the .overlay/.modal frame. */
  var P = 'color:var(--muted); font-size:12.5px; line-height:1.55; margin:0 0 10px;';
  var LBL = 'display:block; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--muted); margin-bottom:6px;';
  var BTN_ACCENT = 'background:var(--accent); color:#0a0e14; border:0; padding:10px 16px; border-radius:9px; font-weight:700; cursor:pointer; font-size:13px; font-family:inherit;';
  var BTN_WARN = 'background:rgba(240,138,93,.12); border-color:rgba(240,138,93,.4); color:var(--tabletop, #f08a5d);';
  var BTN_DANGER = 'background:rgba(240,80,80,.10); border-color:rgba(240,80,80,.4); color:#ff8a8a;';
  var INPUT = 'padding:10px 12px; border-radius:10px; background:rgba(255,255,255,.03); border:1px solid var(--line); color:var(--text); font-size:13px; font-family:inherit;';

  function button(a) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = a.label;
    if (a.kind === 'accent') b.setAttribute('style', BTN_ACCENT);
    else { b.className = 'btn-tiny'; if (a.kind === 'warn') b.setAttribute('style', BTN_WARN); if (a.kind === 'danger') b.setAttribute('style', BTN_DANGER); }
    if (a.action) b.setAttribute('data-cws-action', a.action);
    if (a.disabled) b.disabled = true;
    return b;
  }

  /* ---- dialogs: one at a time, queued ---- */
  var _dlgQueue = [], _dlgOpen = null;
  function dialog(o) {
    var d = { o: o, el: null, closed: false };
    d.close = function () {
      if (d.closed) return; d.closed = true;
      if (d.el) d.el.remove();
      if (_dlgOpen === d) _dlgOpen = null;
      try { o.onClose && o.onClose(d); } catch (e) {}
      if (_dlgQueue.length && !_dlgOpen) showDialog(_dlgQueue.shift());
    };
    d.setBody = function (html) { if (d.body) d.body.innerHTML = html; };
    d.setActions = function (acts) { if (d.acts) fillActions(d, acts); };
    if (_dlgOpen) _dlgQueue.push(d); else showDialog(d);
    return d;
  }
  function fillActions(d, acts) {
    d.acts.innerHTML = '';
    var first = null;
    (acts || []).forEach(function (a) {
      var b = button(a);
      b.addEventListener('click', function () { a.onClick && a.onClick(d, b); });
      d.acts.appendChild(b);
      if (a.primary && !first) first = b;
    });
    return first;
  }
  function topLayer() {
    var top = 150;
    try {
      document.querySelectorAll('.overlay.open, [role="dialog"]').forEach(function (o) {
        var z = parseInt(getComputedStyle(o).zIndex, 10);
        if (z > top && z < 100000) top = z;
      });
    } catch (e) {}
    return top;
  }
  function showDialog(d) {
    var o = d.o;
    _dlgOpen = d;
    var el = document.createElement('div');
    el.className = 'overlay open cws-overlay' + (o.cls ? ' ' + o.cls : '');
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    /* Above whatever is open now (2026-10-12): Settings sits at z-index 150,
       so a fixed 140 opened these dialogs UNDER it -- the backdrop showed and
       the inputs could not be reached, which looked like a freeze. */
    el.style.zIndex = String(topLayer() + 10);
    el.innerHTML =
      '<div class="modal" style="max-width:520px; margin-top:8vh;">' +
        '<div class="modal-head"><div><div class="modal-sub">' + esc(o.sub || 'Game servers') + '</div>' +
        '<div class="modal-title">' + esc(o.title || '') + '</div></div>' +
        /* A mandatory dialog has no close button; the hidden one is what the site's Back (keys.js) presses, and it does nothing. */
        (o.mandatory ? '<button type="button" hidden tabindex="-1" data-cws-action="close"></button>' : '<button class="modal-close" aria-label="Close" data-cws-action="close">×</button>') + '</div>' +
        '<div class="cws-dlg-body" style="padding:18px 22px 6px;"></div>' +
        '<div class="cws-dlg-acts" style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; padding:6px 22px 22px;"></div>' +
      '</div>';
    d.el = el; d.body = el.querySelector('.cws-dlg-body'); d.acts = el.querySelector('.cws-dlg-acts');
    d.body.innerHTML = o.html || '';
    el.querySelector('[data-cws-action="close"]').addEventListener('click', function () { if (o.mandatory) return; (o.onDismiss || d.close)(d); });
    el.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !o.mandatory) (o.onDismiss || d.close)(d); });
    /* A press on the dimmed page around the box, where the dialog asks for it (the welcome: it tucks away). */
    if (o.outsideDismiss && !o.mandatory) el.addEventListener('click', function (e) { if (e.target === el) (o.onDismiss || d.close)(d); });
    var first = fillActions(d, o.actions);
    document.body.appendChild(el);
    try { o.onOpen && o.onOpen(d); } catch (e) {}
    var f = el.querySelector('input:not([type="file"]):not([type="hidden"]):not([readonly])') || first || el.querySelector('.modal-close');
    if (f) setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (e) {} }, 30);
    /* Keys typed here belong to this dialog: a layer underneath (Settings,
       the site's keyboard and remote handling) must not take them. */
    el.addEventListener('keydown', function (e) { if (e.key !== 'Escape') e.stopPropagation(); });
  }

  /* ---- 2.4: waiting for approval ---- */
  function codeOf(p) { var c = String(p.match_code || ''); return c.length === 6 ? c.slice(0, 3) + '-' + c.slice(3) : c; }
  function pairingHtml(s, note) {
    var p = s.pairing || {};
    var exp = p.expires_at ? Date.parse(p.expires_at) - s.clockSkew : 0;
    return '<p style="' + P + '"><b style="color:var(--text)">' + WAIT_APPROVAL + '</b> On the computer running ' + esc(label(s)) +
           ', its owner opens the server\'s <b style="color:var(--text)">Pending devices</b> page and approves this browser. The same code appears beside the request:</p>' +
           '<div class="cws-match" style="font-family:ui-monospace,Consolas,monospace; font-size:28px; font-weight:800; letter-spacing:.12em; color:var(--accent-2, #f5c542); text-align:center; padding:14px; border:1px solid var(--line); border-radius:14px; margin:4px 0 12px;">' + esc(codeOf(p)) + '</div>' +
           '<p style="' + P + '">This window can stay open; the site notices the approval by itself.' + (exp ? ' The request lapses at ' + esc(fmtTime(exp)) + '.' : '') + '</p>' +
           (note ? '<p class="cws-msg" style="font-size:12px; color:#f08a5d; margin:0 0 8px;">' + esc(note) + '</p>' : '');
  }
  function showPairingDialog(s) {
    if (s.pairDlg && !s.pairDlg.closed) { s.pairDlg.setBody(pairingHtml(s)); return; }
    s.pairDlg = dialog({
      sub: 'Joining ' + label(s), title: 'Waiting for approval', html: pairingHtml(s),
      actions: [
        { label: 'Hide', primary: true, action: 'close', onClick: function (d) { d.close(); } },
        { label: 'Withdraw request', kind: 'warn', action: 'pair-cancel', onClick: function (d) { cancelPairing(s); d.close(); } }
      ]
    });
  }
  function updatePairingDialog(s) { if (s.pairDlg && !s.pairDlg.closed) s.pairDlg.setBody(pairingHtml(s)); }
  function closePairingDialog(s, ok, msg) {
    var d = s.pairDlg; if (!d || d.closed) return;
    if (ok) { d.close(); return; }
    d.setBody('<p style="' + P + '">' + esc(msg) + '</p>');
    d.setActions([
      { label: 'Ask again', kind: 'accent', primary: true, action: 'pair-again', onClick: function (d2) { d2.close(); startPairing(s); } },
      { label: 'Close', action: 'close', onClick: function (d2) { d2.close(); } }
    ]);
  }

  /* ---- Settings > Content > Game servers: one tile (item 4)
     With no server yet it explains both ways (at home by Direct connect, over the internet with the
     connection key). Once one server is added by one way, it shows that server and its state only,
     with a small Use a different server link that leaves it and brings the two choices back. ---- */
  function injectSettings() {
    if (document.getElementById('cws-section')) return;
    var anchor = document.getElementById('content-pack-section');
    if (!anchor || !anchor.parentNode) { setTimeout(injectSettings, 500); return; }
    var sec = document.createElement('section');
    sec.className = 'vault-section'; sec.id = 'cws-section';
    sec.style.order = '0';   /* first in the tab: Game servers, Media Login, Content pack, the rest */
    sec.innerHTML = '<label style="' + LBL + '">Game servers</label>' +
      '<p class="cws-intro" style="' + P + ' margin-bottom:12px;">Play the games on a CrystalVault Server.</p>' +
      '<div id="cws-list"></div>';
    anchor.parentNode.insertBefore(sec, anchor.nextSibling);
    sec.addEventListener('click', onSettingsClick);
    render();
  }
  var STATE_TEXT = {
    idle: 'Waiting', connecting: 'Connecting…', hidden: 'Set aside on this browser',
    unreachable: 'Not reachable', setup: 'Setup not finished', version: 'Needs an update', unpaired: 'Not joined', withdrawn: 'Removed',
    pairing: 'Waiting for approval', ready: 'Connected', error: 'Problem'
  };
  var KIND_TEXT_RTC = { lan: 'on your home network', rtc: 'over the internet', relay: 'over the internet, relayed' };
  var BOX = 'border:1px solid var(--line); border-radius:12px; padding:12px 14px; margin-bottom:10px; background:rgba(255,255,255,.015);';
  var LINK = 'background:none; border:0; padding:2px 0; margin:2px 0 0; font:inherit; font-size:12px; color:var(--muted); text-decoration:underline; cursor:pointer;';
  function stateColour(st) { return st === 'ready' ? 'var(--accent)' : (st === 'error' || st === 'unreachable' || st === 'version' || st === 'withdrawn') ? '#f08a5d' : 'var(--muted)'; }
  function rowHtml(sid) {
    var s = C.servers[sid], st = s.state || 'idle';
    var bits = [];
    if (st === 'ready') {
      if (s.listing && s.listing.direct && !isRtc(s)) bits.push('on your home network');
      else if (isRtc(s)) bits.push(KIND_TEXT_RTC[s.kind] || KIND_TEXT_RTC.rtc);
      var n = (s.items || []).length; bits.push(plural(n, 'title'));
    } else if (s.msg) bits.push(esc(s.msg));
    if (st !== 'ready' && s.listing && s.listing.direct) bits.push(esc(hostPart(s.listing.direct.host) + ':' + s.listing.direct.port));
    var acts = [];
    if (st === 'unpaired' || st === 'withdrawn') acts.push({ label: 'Ask again', kind: 'accent', action: 'join' });
    if (st === 'pairing') acts.push({ label: 'Show code', action: 'show-code' }, { label: 'Withdraw request', kind: 'warn', action: 'pair-cancel' });
    if (st === 'unreachable' || st === 'error') acts.push({ label: 'Try again', action: 'retry' });
    return '<div class="cws-row" data-sid="' + esc(sid) + '" data-state="' + esc(st) + '" style="' + BOX + '">' +
      '<div style="display:flex; gap:10px; align-items:baseline; justify-content:space-between; flex-wrap:wrap;">' +
        '<div style="font-size:13px; font-weight:700; color:var(--text); display:flex; gap:8px; align-items:center;">' +
          esc(label(s)) + '</div>' +
        '<div class="cws-state" style="font-size:11px; letter-spacing:.12em; text-transform:uppercase; font-weight:700; color:' + stateColour(st) + ';">' + esc(STATE_TEXT[st] || st) + '</div>' +
      '</div>' +
      '<div style="font-size:12px; color:var(--muted); line-height:1.5; margin-top:4px;">' + bits.filter(Boolean).join(' · ') + '</div>' +
      (acts.length ? '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">' + acts.map(function (a) { return button(a).outerHTML; }).join('') + '</div>' : '') +
      '<button type="button" class="cws-other" data-cws-action="other" style="' + LINK + '">Use a different server</button>' +
    '</div>';
  }
  function render() {
    var list = document.getElementById('cws-list');
    if (!list) return;
    var all = Object.keys(C.servers).filter(function (sid) { return C.servers[sid].listing || C.servers[sid].items || tokenOf(sid); }).sort();
    var shown = all.filter(function (sid) { return !hidden(sid) && C.servers[sid].state !== 'hidden'; });
    var aside = all.filter(function (sid) { return shown.indexOf(sid) < 0; });
    var offline = [];
    try { offline = (R && C.vault && R.offlineTrusted) ? R.offlineTrusted() : []; } catch (e) { offline = []; }
    /* (21 Nov): off crystalworlds.media (the home address, a local copy) the introducer is never
       reached, so a server this vault joined over the internet is not "not online": it is reached here by
       Direct connect only. Its row says so and offers Direct connect, and it never offers to drop the server
       from the vault (that would remove it on every device). Once a server is connected here, these rows go. */
    var offSite = false;
    try { offSite = !!(R && R.offSite && R.offSite()); } catch (e) { offSite = false; }
    if (offSite && shown.length) offline = [];
    var html = '';
    if (shown.length || offline.length) {
      shown.forEach(function (sid) { html += rowHtml(sid); });
      offline.forEach(function (o) {
        html += '<div class="cws-row" data-state="offline" style="' + BOX + '"><div style="display:flex; gap:10px; align-items:baseline; justify-content:space-between; flex-wrap:wrap;">' +
          '<div style="font-size:13px; font-weight:700; color:var(--text);">' + esc(o.name) + '</div><div class="cws-state" style="font-size:11px; letter-spacing:.12em; text-transform:uppercase; font-weight:700; color:var(--muted);">' + (offSite ? 'Not on this address' : 'Not online now') + '</div></div>' +
          (offSite
            ? '<div style="font-size:12px; color:var(--muted); line-height:1.5; margin-top:4px;">Over the internet, this server is reached from crystalworlds.media only. On this address, connect to it on your home network with Direct connect.</div>' +
              '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">' + button({ label: 'Direct connect', kind: 'accent', action: 'direct' }).outerHTML + '</div></div>'
            : '<div style="font-size:12px; color:var(--muted); line-height:1.5; margin-top:4px;">over the internet</div>' +
              '<button type="button" class="cws-other" data-cws-action="cwr-forget-key" data-key="' + esc(o.key) + '" style="' + LINK + '">Use a different server</button></div>');
      });
    } else {
      var card = '';
      try { card = (R && C.vault) ? R.cardHtml() : ''; } catch (e) { card = ''; }
      html += '<div class="cws-choice" data-choice="home" style="' + BOX + '">' +
          '<div style="font-size:13.5px; font-weight:700; color:var(--text); margin:0 0 4px;">At home, on the same network</div>' +
          '<p style="' + P + '">Type the server\'s address. Its owner finds it on the server\'s Dashboard, under <b style="color:var(--text)">Connecting devices</b>.</p>' +
          button({ label: 'Direct connect', kind: 'accent', action: 'direct' }).outerHTML +
        '</div>' +
        '<div class="cws-choice" data-choice="internet" style="' + BOX + '">' +
          '<div style="font-size:13.5px; font-weight:700; color:var(--text); margin:0 0 4px;">Over the internet</div>' +
          '<p style="' + P + '">With your connection key.</p>' + (card || '<p style="' + P + '">Loading…</p>') +
          aside.map(function (sid) {
            return '<div class="cws-row" data-sid="' + esc(sid) + '" data-state="hidden" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:10px; font-size:12.5px; color:var(--muted);">' +
              '<span><b style="color:var(--text)">' + esc(label(C.servers[sid])) + '</b> is set aside on this browser.</span>' + button({ label: 'Use again', action: 'unhide' }).outerHTML + '</div>';
          }).join('') +
        '</div>';
    }
    list.innerHTML = html;
  }
  function onSettingsClick(e) {
    var b = e.target.closest && e.target.closest('[data-cws-action]');
    if (!b) return;
    if (b.getAttribute('data-cws-action') === 'direct') { directDialog(); return; }
    if (R && /^cwr-/.test(b.getAttribute('data-cws-action'))) { R.onCardClick(b.getAttribute('data-cws-action'), b); return; }
    var row = b.closest('.cws-row'), sid = row && row.getAttribute('data-sid'), s = sid && C.servers[sid];
    if (!s) return;
    var a = b.getAttribute('data-cws-action');
    if (a === 'join') { slot(K_WITHDRAWN, sid, null); startPairing(s); }
    else if (a === 'show-code') showPairingDialog(s);
    else if (a === 'pair-cancel') cancelPairing(s);
    else if (a === 'retry') { s.retryAt = 0; connect(s, 'retry').then(rebuild); }
    else if (a === 'unhide') { slot(K_CONFIRM, sid, 'yes'); connect(s, 'retry').then(rebuild); }   // Use again is the person saying so
    else if (a === 'other') {
      dialog({
        sub: 'Game servers', title: 'Leave ' + label(s) + '?',
        html: '<p style="' + P + '">This browser stops using <b style="color:var(--text)">' + esc(label(s)) + '</b>. Its games disappear from your shelves on this browser, and the copies of its games kept on this browser are deleted. Your saves stay, and your other browsers are not affected.</p>' +
              '<p style="' + P + '">Your vault stays approved on the server, so to use it again from this browser, connect to it again' + ((s.listing && s.listing.rtc) ? ' (or press Use again)' : '') + ' and it lets you straight back in.</p>',
        actions: [
          { label: 'Leave server', kind: 'danger', primary: true, action: 'forget-yes', onClick: function (d) {
            d.close();
            forgetServer(sid).then(function () { toastSafe('Left ' + label(s) + '.', 'ok'); render(); });
          } },
          { label: 'Cancel', action: 'close', onClick: function (d) { d.close(); } }
        ]
      });
    }
  }

  /* ---------------------------------------------------------------- vault lifecycle
     index.html's own log-out, switch and rotate functions are wrapped rather
     than edited: each runs exactly as before, and this follows what it did. */
  function wrapVault(name, after) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig.__cws) return;
    var w = function () {
      var before = (typeof vaultCode !== 'undefined') ? vaultCode : null, beforeVhp = C.vhp;
      return Promise.resolve(orig.apply(this, arguments)).then(function (r) {
        var now = (typeof vaultCode !== 'undefined') ? vaultCode : null;
        if (now !== before) after(now, beforeVhp);
        return r;
      });
    };
    w.__cws = true;
    window[name] = w;
  }
  /* Log out (index.html logoutVault): every server this browser joined hears it left, best effort.
     DELETE /api/v1/session on the connection in use (a direct address with keepalive, so it outlives
     the reload; a data channel only if it is open now), never retried, never waited on for more than
     about a second and a half. The page then clears everything it keeps. */
  function leaveAll(ms) {
    var jobs = [];
    Object.keys(C.servers).forEach(function (sid) {
      var s = C.servers[sid];
      [K_TOKENS, K_TOKENS_R].forEach(function (k) {
        var t = slot(k, sid); if (!t || !t.device_token) return;
        var remote = k === K_TOKENS_R, h = { Authorization: 'Bearer ' + t.device_token };
        if (remote) {
          if (R && s.base && /^rtc:/.test(s.base)) jobs.push(R.fetch(s.base + '/api/v1/session', { method: 'DELETE', headers: h }, ms || 1500).catch(function () {}));
        } else {
          var d = s.listing && s.listing.direct;
          var base = (d && d.host) ? (d.scheme || schemeFor(d.host)) + hostPart(d.host) + ':' + d.port : (s.base && !/^rtc:/.test(s.base) ? s.base : '');
          if (base) { try { jobs.push(fetch(base + '/api/v1/session', { method: 'DELETE', headers: h, mode: 'cors', credentials: 'omit', cache: 'no-store', keepalive: true }).catch(function () {})); } catch (e) {} }
        }
      });
      clearTimeout(s.pollTimer);
    });
    ev('leave-all', { count: jobs.length });
    return Promise.race([Promise.all(jobs), new Promise(function (r) { setTimeout(r, ms || 1500); })]).then(function () {
      if (R) { try { R.stop(); } catch (e) {} }
      return closeDbs();
    });
  }
  /* Lets go of this page's databases so the page can delete them. */
  function closeDbs() {
    var p = _db; _db = null;
    var a = p ? p.then(function (d) { try { d && d.close(); } catch (e) {} }) : Promise.resolve();
    return Promise.all([a, R && R.closeDb ? R.closeDb() : null]).then(function () {}, function () {});
  }
  wrapVault('importVaultCode', function (now) { forgetVault().then(function () { if (now) init(now); }); });
  function afterRotate(now, oldVhp) {
    if (!now || !oldVhp) return;
    storeKey(String(now).toLowerCase()).then(function (nv) {
      return rekey(oldVhp, nv).then(function () { C.vault = String(now).toLowerCase(); C.vhp = nv; if (R) R.start(reachHooks()); });
    });
  }
  wrapVault('rotateVaultCode', afterRotate);

  /* REACH: what cws-reach.mjs may ask of this file. No tokens. */
  function reachHooks() {
    return {
      code: function () { return C.vault; }, vhp: function () { return C.vhp; }, storeKey: storeKey,
      hidden: hidden,
      found: function (sid) {
        var s = srvOf(sid);
        var l = R.listings().filter(function (x) { return x.server_id === sid; })[0];
        if (!l) return;
        if (s.listing && s.listing.direct) s.listing.rtc = l.rtc; else s.listing = l;
        if (slot(K_CONFIRM, sid) === undefined) slot(K_CONFIRM, sid, 'yes');
        if (hidden(sid)) { if (s.state !== 'hidden') setState(s, 'hidden', 'Forgotten on this browser.'); return; }
        if (s.connecting) {   // a look that started before this connection opened: ask again once it ends
          s.connecting.then(function () { if (s.state !== 'ready' && !hidden(sid)) { s.retryAt = 0; connect(s, 'retry').then(rebuild); } });
          return;
        }
        if (s.state === 'ready' && s.base) return;
        s.retryAt = 0;
        connect(s, 'retry').then(rebuild);
      },
      removed: function (sid, key) {
        var s = sid ? C.servers[sid] : null;
        if (!s) Object.keys(C.servers).forEach(function (k) { var x = C.servers[k]; if (x.listing && x.listing.rtc && x.listing.rtc.server_key === key) s = x; });
        if (s) removedByOwner(s, REMOVED_MSG); else { if (R && key && R.untrust) R.untrust(key); toastSafe(REMOVED_MSG, 'error'); render(); }
      },
      lost: function (sid, msg) {
        var s = C.servers[sid];
        if (!s || !isRtc(s)) return;
        if (s.base) { s.base = ''; s.retryAt = Date.now() + 15000; setState(s, 'unreachable', msg || 'Not online now.'); rebuild(); }
        else render();
      },
      render: function () { render(); },
      ev: ev,
      rewrapRotate: function () { wrapVault('rotateVaultCode', afterRotate); },
      ui: { dialog: dialog, button: button, esc: esc, P: P, LBL: LBL, INPUT: INPUT, fmtTime: fmtTime, plural: plural, toast: toastSafe }
    };
  }

  window.addEventListener('online', function () { retryDue(true); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') retryDue(true); });
  setInterval(function () { if (C.vault && document.visibilityState === 'visible') refresh(); }, T_REFRESH);

  /* CONTROLLERS (2026-10-17; server DECISIONS GC1): one controller's entry in the
     server's weekly controller database and its printed letters. q = { id, platform } (the
     Gamepad.id as the browser gives it). Asks the first joined server that is ready (or only
     waiting for a PIN: the lookup needs no PIN). Resolves the answer, or null when no server
     can answer now (none joined or reachable, or a server too old for the endpoint). gamepad.js
     keeps answers per controller, so a server is asked once per new controller. */
  function controller(q) {
    q = q || {};
    var list = Object.keys(C.servers).sort().map(function (k) { return C.servers[k]; })
      .filter(function (s) { return s.base && tokenOf(s.id) && s.state === 'ready'; });
    if (!list.length) return Promise.resolve(null);
    var qs = [];
    if (q.id) qs.push('id=' + encodeURIComponent(String(q.id).slice(0, 200)));
    if (q.name) qs.push('name=' + encodeURIComponent(String(q.name).slice(0, 200)));
    if (q.platform) qs.push('platform=' + encodeURIComponent(q.platform));
    if (!qs.length) return Promise.resolve(null);
    var i = 0;
    function next() {
      var s = list[i++];
      if (!s) return null;
      return api(s, 'GET', '/controllers/lookup?' + qs.join('&'), { auth: 'device', timeout: 8000 }).then(function (r) {
        ev('controller', { server: s.id, found: !!(r.json && r.json.found) });
        return r.json || null;
      }, function (e) { onAuthError(s, e); return next(); });
    }
    return Promise.resolve(next());
  }

  /* The switch in Settings (28 Oct): off, the library is rebuilt with no server (its
     titles leave the shelves through reloadAllGameContent); on, the servers are asked again. */
  window.addEventListener('cw:source-switch', function (e) {
    if (!e || !e.detail || e.detail.id !== 'cws') return;
    if (e.detail.on) { refresh(); } else { rebuild(); render(); }
  });
  /* For Settings: is the switch off (the servers kept, not used)? */
  function switchedOff() { return cwsOff(); }

  window.CWS = {
    switchedOff: switchedOff,
    init: init,
    first: first,   // the catalogue loaders wait for this before merging
    controller: controller,
    get ready() { return C.ready; },
    has: has, available: available, unavailable: unavailable,
    /* The sha256 the listing gives for a piece of boot firmware ('fds:bios'),
       or null. No download: nesvideo.js names the Disk System boot clip by it. */
    bootSha256: function (id) { var e = C.boot[id]; return e ? e.sha256 : null; },
    mergeManifest: mergeManifest, decorate: decorate,
    /* The Super Game Boy shelf (25 Oct): the Game Boy ids of every title a joined server
       holds in its sgb folder, whether or not a copy is also in gb or gbc. */
    sgbIds: function () { return Object.keys(C.byId).filter(function (id) { var e = C.byId[id]; return e.kind === 'gb' && e.sgb; }); },
    fetchBytes: fetchBytes, fetchB64: fetchB64, rangedSources: rangedSources,   // rangedSources: the Nintendo 64's games in pieces (22 Nov 2026)
    preloadFetch: preloadFetch, preloadFirmware: preloadFirmware, preloadFetchSha: preloadFetchSha,   // preload.js (18 Nov 2026)
    bootChoices: bootChoices, fetchBootSha: fetchBootSha, bootFileByName: bootFileByName,
    bootGeneric: bootGeneric, firmwareList: firmwareList,   // FW1 (2026-10-22)
    pmAvailability: pmAvailability, pmGameFiles: pmGameFiles,
    /* The Game & Watch device zips the servers offer now, by file name without
       ".zip", upper case: the model number ("AC-01", "HXA-001"). index.html's
       gnwAvailable() and tftAvailable() read it so a unit's tile appears as soon
       as a server lists its zip, before anything is downloaded (2026-10-14). */
    gnwFiles: function () {
      return Object.keys(C.byId).filter(function (id) { return C.byId[id].kind === 'gnw' && available(id); }).map(function (id) {
        var it = C.byId[id].entry || {};
        return String(it.file_name || it.title || '').replace(/^.*[\\/]/, '').replace(/\.zip$/i, '').trim().toUpperCase();
      });
    },
    gnwPrograms: gnwPrograms, gnwTft: gnwTft, atariBios: atariBios, tapes: tapes, cassettes: cassettes, cassetteByName: cassetteByName, readRange: readRange,
    refresh: refresh,
    directConnect: directConnect,
    leaveAll: leaveAll,
    /* For the Settings card and for testing: no tokens, no codes, no secrets. */
    servers: function () {
      return Object.keys(C.servers).map(function (sid) {
        var s = C.servers[sid];
        return { id: sid, name: s.name, state: s.state, msg: s.msg, kind: s.kind, rtt: Math.round(s.rtt),
                 titles: (s.items || []).length, joined: !!tokenOf(sid), confirmed: confirmed(sid), hidden: hidden(sid) };
      });
    },
    titles: function () {
      return Object.keys(C.byId).map(function (id) {
        var e = C.byId[id];
        return { id: id, sha256: e.sha256, title: e.entry.title, system: e.entry.system, kind: e.kind, format: e.entry.format, holders: Object.keys(e.holders), available: available(id) };
      });
    },
    events: function () { return C.events.slice(); },
    /* For tests: whether the reach side is loaded and what it holds (no keys, codes or PIN keys). */
    reach: function () { return { loaded: !!R, state: R ? R.state() : null }; },
    /* Drop this browser's verified copy of one title, so the next play downloads it again. */
    dropCached: function (id) {
      var e = C.byId[id] || C.boot[id]; if (!e) return Promise.resolve(false);
      delete _mem[e.sha256];
      return idb('carts', 'readwrite', function (st) { st.delete(e.sha256); }).then(function () { return true; });
    },
    _sha256js: sha256js
  };

  /* bootApp() may have run before this file loaded; it leaves a flag. */
  if (window.__cwsBoot) { try { init(typeof vaultCode !== 'undefined' ? vaultCode : null); } catch (e) {} }
})();

/* ===========================================================================
   keep.js  --  keeping this browser's sign-ins (2026-10-14)
   ---------------------------------------------------------------------------
   THE PROBLEM. It was reported (14 Oct 2026, "seen many times") that in the
   morning the site had a NEW vault code, Media Login was signed out and the
   game server had to be joined again by Direct connect. All three live in this
   origin's localStorage:
       pp-vault-code-v1, pp-vault-touched-v1      the vault code (index.html)
       gnw.emby.server/token/userId/userName/deviceId/serverType   Media Login (emby.js)
       cws.servers.v1, cws.confirmed.v1, cws.direct.v1  game servers (cws.js),
                                                  keyed by a hash of the vault code
   The site deletes the vault code in only three places (Log out, Remove
   account, and the boot check for a vault deleted elsewhere) and deletes the
   Media Login keys only on Sign out, so losing all three at once means the
   browser handed this page an EMPTY localStorage: a different address (storage
   is per scheme + host + port), or the browser cleared the site's data.

   WHAT THIS FILE DOES (all of it is local; no secret value is ever logged,
   shown or sent anywhere):
     1. Asks the browser to keep this site's storage (navigator.storage.persist),
        so it is not cleared first when the disk runs low. HTTPS only: the API
        does not exist on plain-HTTP pages.
     2. Keeps a second copy of those keys in IndexedDB ('cw-keep'). If a page
        loads with no vault code but the copy has one, and nobody logged out on
        purpose, the keys are put back and the page reloads once, so the vault
        code is never replaced by a freshly made one.
        "On purpose" is a marker (cw.keep.cleared.v1) written the moment the
        vault code is removed by the site itself; it is dropped once the copy
        has caught up, so a logged-out vault is never brought back.
     3. Remembers, in a host-wide cookie with no secrets (cw_seen), which
        addresses of this host have been used. Cookies ignore the port, so
        http://host:8080 can tell that https://host:8443 holds the sign-ins.
     4. Shows a short plain notice when it detects lost state, and how to
        recover.
     5. Keeps a diagnostic record (key NAMES and sizes, persisted yes/no,
        origin, first-seen and last-seen times, events). Shown by ?diag=1,
        ?diag=storage, or Settings, Access Code, Storage check. It stays in
        this browser; nothing is sent anywhere.
   Plain ES5 on purpose: it also runs on the TV's older engine.
   ======================================================================== */
(function () {
  'use strict';
  var VERSION = '20261014-persist2-canon';
  var VAULT = 'pp-vault-code-v1';
  var KEEP = ['pp-vault-code-v1', 'pp-vault-touched-v1',
              'gnw.emby.server', 'gnw.emby.token', 'gnw.emby.userId', 'gnw.emby.userName', 'gnw.emby.deviceId',
              'gnw.emby.serverType',   // Emby or Jellyfin (26 Oct): a kept token is useless without it
              'gnw.emby.sessions.v1',  // both kinds' sign-ins, one in use (31 Oct, emby.js)
              'cws.servers.v1', 'cws.confirmed.v1', 'cws.direct.v1'];
  var KEEPSET = {}; for (var i = 0; i < KEEP.length; i++) KEEPSET[KEEP[i]] = true;
  var TOMB = 'cw.keep.cleared.v1';        // the site removed the vault code on purpose
  var DIAG = 'cw.keep.diag.v1';           // non-secret record (also mirrored in IndexedDB)
  var COOKIE = 'cw_seen';                 // host-wide list of origins used; no secrets
  var DBN = 'cw-keep', ST = 'kv';
  var SS_RELOAD = 'cw.keep.reloadAt', SS_NOTICE = 'cw.keep.notice';
  var origin = location.origin || (location.protocol + '//' + location.host);
  var now0 = Date.now();

  /* ------------------------------------------------------------ storage access */
  var ls = null, lsError = '';
  try { ls = window.localStorage; ls.getItem(VAULT); } catch (e) { ls = null; lsError = (e && e.name) || 'error'; }
  var SP = (window.Storage && Storage.prototype) || null;
  var origSet = SP ? SP.setItem : null, origRemove = SP ? SP.removeItem : null, origClear = SP ? SP.clear : null;
  function lget(k) { try { return ls ? ls.getItem(k) : null; } catch (e) { return null; } }
  function lset(k, v) { try { if (ls) { origSet.call(ls, k, v); return true; } } catch (e) {} return false; }
  function ldel(k) { try { if (ls) origRemove.call(ls, k); } catch (e) {} }
  function ss(k, v) {
    try {
      if (arguments.length === 1) return sessionStorage.getItem(k);
      if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v);
      return true;
    } catch (e) { return null; }
  }
  function parse(s) { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }

  /* What this page found the moment it started, before anything else ran. */
  var start = { at: now0, hadVault: !!lget(VAULT), tomb: lget(TOMB), present: [] };
  for (i = 0; i < KEEP.length; i++) if (lget(KEEP[i]) !== null) start.present.push(KEEP[i]);

  /* A short fingerprint of the vault code: tells "same vault or a new one"
     apart in a log without revealing anything about the code. */
  function fp(s) {
    if (!s) return '';
    var h = 0x811c9dc5, t = 'cw-keep:' + s;
    for (var j = 0; j < t.length; j++) { h ^= t.charCodeAt(j); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  /* ------------------------------------------------------------ diagnostic record */
  var diag = parse(lget(DIAG)) || {};
  var fresh = !diag.first;
  if (!diag.first) diag.first = now0;
  diag.prevLast = diag.last || 0;
  diag.last = now0;
  diag.loads = (diag.loads || 0) + 1;
  diag.origin = origin;
  diag.events = diag.events || [];
  var loadEvents = [];
  function event(kind, detail) {
    var e = { t: Date.now(), k: kind };
    if (detail) e.d = String(detail).slice(0, 200);
    diag.events.push(e); if (diag.events.length > 40) diag.events.shift();
    loadEvents.push(kind);
    saveDiag();
  }
  function saveDiag() { lset(DIAG, JSON.stringify(diag)); }
  saveDiag();

  /* ------------------------------------------------------------ the host cookie */
  function cookieOrigins() {
    var m = (document.cookie || '').match(/(?:^|;\s*)cw_seen=([^;]*)/);
    if (!m) return [];
    var out = [];
    String(m[1]).split('|').forEach(function (x) { try { x = decodeURIComponent(x); if (/^https?:\/\/[^\s|]+$/.test(x)) out.push(x); } catch (e) {} });
    return out;
  }
  var seenBefore = cookieOrigins();
  function writeCookie(list) {
    try {
      var v = list.slice(0, 6).map(encodeURIComponent).join('|');
      document.cookie = COOKIE + '=' + v + '; Max-Age=34560000; Path=/; SameSite=Lax';
    } catch (e) {}
  }
  /* Only an address that holds real sign-ins is remembered: a used vault, a
     Media Login, or a joined game server. A fresh empty visit is not. */
  function hasState() {
    var c = lget('cws.servers.v1');
    return lget('pp-vault-touched-v1') === '1' || !!lget('gnw.emby.token') || !!(c && c.length > 2);
  }
  function rememberHere() {
    if (!hasState()) return;
    var list = cookieOrigins();
    if (list[0] === origin) return;
    writeCookie([origin].concat(list.filter(function (o) { return o !== origin; })));
  }
  rememberHere();

  /* ------------------------------------------------------------ IndexedDB copy */
  var _db = null;
  function db() {
    if (_db) return _db;
    _db = new Promise(function (res) {
      try {
        var r = indexedDB.open(DBN, 1);
        r.onupgradeneeded = function () { try { r.result.createObjectStore(ST); } catch (e) {} };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { res(null); };
        r.onblocked = function () { res(null); };
      } catch (e) { res(null); }
    });
    return _db;
  }
  function idbGet(key) {
    return db().then(function (d) {
      if (!d) return null;
      return new Promise(function (res) {
        try { var q = d.transaction(ST, 'readonly').objectStore(ST).get(key); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; }
        catch (e) { res(null); }
      });
    });
  }
  function idbPut(key, val) {
    return db().then(function (d) {
      if (!d) return false;
      return new Promise(function (res) {
        try { var tx = d.transaction(ST, 'readwrite'); tx.objectStore(ST).put(val, key); tx.oncomplete = function () { res(true); }; tx.onerror = tx.onabort = function () { res(false); }; }
        catch (e) { res(false); }
      });
    });
  }

  var ready = false, snapTimer = 0, lastMirror = null;
  function snapshot() {
    if (!ready || !ls) return Promise.resolve(false);
    var keys = {}, k;
    for (var j = 0; j < KEEP.length; j++) { k = lget(KEEP[j]); if (k !== null) keys[KEEP[j]] = k; }
    var rec = { at: Date.now(), origin: origin, keys: keys };
    return idbPut('mirror', rec).then(function (ok) {
      if (ok) {
        lastMirror = { at: rec.at, names: Object.keys(keys) };
        /* The copy now matches; the "removed on purpose" marker has done its job. */
        if (lget(TOMB) !== null) ldel(TOMB);
      }
      idbPut('diag', diag);
      return ok;
    });
  }
  function schedule() { clearTimeout(snapTimer); snapTimer = setTimeout(function () { snapshot(); if (ready) rememberHere(); }, 300); }

  /* Follow every change to the kept keys, whoever makes it. */
  if (SP && origSet) {
    try {
      SP.setItem = function (k, v) { var r = origSet.apply(this, arguments); try { if (this === ls && KEEPSET[k]) schedule(); } catch (e) {} return r; };
      SP.removeItem = function (k) {
        var r = origRemove.apply(this, arguments);
        try {
          if (this === ls && k === VAULT) { lset(TOMB, String(Date.now())); event('vault-code-removed-by-site'); }
          if (this === ls && KEEPSET[k]) schedule();
        } catch (e) {}
        return r;
      };
      SP.clear = function () {
        var r = origClear.apply(this, arguments);
        try { if (this === ls) { lset(TOMB, String(Date.now())); event('storage-cleared-by-page'); schedule(); } } catch (e) {}
        return r;
      };
    } catch (e) {}
  }
  window.addEventListener('pagehide', function () { if (ready) snapshot(); });
  document.addEventListener('visibilitychange', function () { if (ready && document.visibilityState === 'hidden') snapshot(); });

  /* ------------------------------------------------------------ persistence */
  var persist = { supported: !!(navigator.storage && navigator.storage.persist), persisted: null, asked: false };
  function askPersist() {
    if (!persist.supported) return Promise.resolve(null);
    return navigator.storage.persisted().then(function (p) {
      if (p) return true;
      persist.asked = true;
      return navigator.storage.persist();
    }).then(function (p) {
      if (persist.persisted !== p && diag.persisted !== p) event(p ? 'persist-granted' : 'persist-not-granted');
      persist.persisted = p; diag.persisted = p; saveDiag();
      return p;
    }).catch(function () { return null; });
  }

  /* ------------------------------------------------------------ the notice */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function notice(title, html, buttons) {
    function show() {
      if (!document.body) return;
      /* 28 Oct: the site's messages are one kind now (notify.js cwNotify),
         top right under the search bar. These stay until closed (they are about the vault
         code), with every button kept; a button without an action just closes. The dialog
         below is the fallback for a page without notify.js. */
      if (window.cwNotify) {
        var tmp = document.createElement('div');
        tmp.innerHTML = String(html).replace(/(<br\s*\/?>\s*)+/gi, '\n');
        window.cwNotify(tmp.textContent, {
          id: 'cw-keep', kind: 'warn', title: title, sticky: true,
          actions: (buttons || [{ label: 'OK' }]).map(function (b) { return { label: b.label, run: function () { if (b.go) b.go(); } }; })
        });
        return;
      }
      var old = document.getElementById('cw-keep-notice'); if (old) old.parentNode.removeChild(old);
      var el = document.createElement('div');
      el.id = 'cw-keep-notice';
      el.setAttribute('role', 'alertdialog');
      el.setAttribute('aria-label', title);
      el.style.cssText = 'position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147483600;width:min(560px,calc(100vw - 32px));' +
        'box-sizing:border-box;padding:16px 18px;border-radius:12px;background:var(--bg-2,#141a22);color:var(--text,#e8eef5);' +
        'border:1px solid var(--accent,#5fd0c0);box-shadow:0 10px 40px rgba(0,0,0,.5);font:14px/1.5 system-ui,sans-serif';
      var h = '<div style="font-weight:700;font-size:15px;margin:0 0 6px">' + esc(title) + '</div>' +
              '<div style="color:var(--muted,#aab4c0)">' + html + '</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"></div>';
      el.innerHTML = h;
      var row = el.lastChild;
      (buttons || [{ label: 'OK' }]).forEach(function (b, n) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = b.label;
        btn.className = 'btn-tiny';
        btn.style.cssText = 'padding:8px 14px;border-radius:9px;cursor:pointer;font-weight:700;font-size:13px;' +
          (n === 0 ? 'background:var(--accent,#5fd0c0);color:#0a0e14;border:0' : 'background:transparent;color:var(--text,#e8eef5);border:1px solid var(--line,#334)');
        btn.addEventListener('click', function () { if (el.parentNode) el.parentNode.removeChild(el); if (b.go) b.go(); });
        row.appendChild(btn);
      });
      document.body.appendChild(el);
      try { row.firstChild.focus(); } catch (e) {}
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
  }
  function openSettingsCode() { try { if (typeof window.openVaultModal === 'function') window.openVaultModal(); } catch (e) {} }

  /* ------------------------------------------------------------ one site address
     Every address keeps its own sign-ins. OFF unless this copy of the site names
     its one address in site.local.json at the site root (a local file that is
     never shipped; copy site.local.json.example):
         { "one_address": "https://name.example:8443" }
     Then the same server's other HTTPS names on that port (an IP address,
     localhost, the machine's name) move the visitor to that address, keeping
     path, query and hash.
     The file is only asked for when the page came from the site's own server
     (index.html's first script sets __cwPaths), and only from this page's own
     address, so a copy on any other web server makes no extra request and
     nobody waits on another host. The public address has no such file and is
     never asked (it would only print a "not found" in the browser's console).
     SAFE BY CONSTRUCTION: it moves only after that address has answered
     /__canon as this site within 1.5 s; no answer means it stays, silently.
     Never moved: plain HTTP, other ports, a framed page, and any session that
     opened with ?stay=1.
     Nothing secret ever goes in the URL: only the old address, so the notice
     on the new one can say where the old sign-ins are. */
  var CANON_HOST = '';
  var CANON_PORT = '';
  var CANON = '';
  var SS_STAY = 'cw.keep.stay';
  var canon = { state: 'not-applicable' };
  var movedFrom = '';
  var startAt = { path: '/', search: '', hash: '' };
  (function () {
    var q = location.search || '';
    var m = /[?&]cwmoved=([^&#]*)/.exec(q);
    if (m) {
      try { movedFrom = decodeURIComponent(m[1]); } catch (e) { movedFrom = ''; }
      if (!/^https:\/\/[^\s/?#]+$/.test(movedFrom)) movedFrom = '';
      try {
        var clean = q.replace(/([?&])cwmoved=[^&#]*&?/, '$1').replace(/[?&]$/, '');
        history.replaceState(history.state, '', location.pathname + clean + location.hash);
      } catch (e) {}
    }
    if (/[?&]stay=1(&|$)/.test(q)) ss(SS_STAY, '1');
    startAt = { path: location.pathname, search: location.search, hash: location.hash };   // before the page's router changes it
    if (location.protocol !== 'https:' || !window.__cwPaths) return;
    if (/^(www\.)?crystalworlds\.media$/i.test(String(location.hostname || '').replace(/\.$/, ''))) return;
    try { if (window.top !== window) return; } catch (e) { return; }
    if (ss(SS_STAY) === '1') { canon.state = 'stay'; return; }
    if (typeof fetch !== 'function') return;
    canon.state = 'reading-setting';
    fetch('/site.local.json', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) {
        var m2 = /^https:\/\/([a-z0-9.-]+)(?::(\d{1,5}))?\/?$/i.exec(cfg && typeof cfg.one_address === 'string' ? cfg.one_address : '');
        if (!m2) { canon.state = 'no-setting'; return; }
        CANON_HOST = m2[1].toLowerCase();
        CANON_PORT = String(window.__CW_CANON_TEST_PORT || m2[2] || '443');   // the test seam: headless tests only
        CANON = 'https://' + CANON_HOST + (CANON_PORT === '443' ? '' : ':' + CANON_PORT);
        canon.state = 'not-applicable';
        if (location.hostname.toLowerCase() === CANON_HOST) return;
        if (String(location.port || '443') !== CANON_PORT) return;
        moveIfAnswered();
      }, function () { canon.state = 'no-setting'; });
  })();
  function moveIfAnswered() {
    canon.state = 'checking';
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); canon.state = 'no-answer'; }, 1500);
    fetch(CANON + '/__canon', { mode: 'cors', credentials: 'omit', cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        clearTimeout(timer);
        if (!j || j.site !== 'crystal-worlds-site' || canon.state !== 'checking') { if (canon.state === 'checking') canon.state = 'not-the-site'; return; }
        canon.state = 'moving';
        var qs = startAt.search ? startAt.search + '&' : '?';
        event('moved-to-one-address', origin + ' -> ' + CANON);
        location.replace(CANON + startAt.path + qs + 'cwmoved=' + encodeURIComponent(origin) + startAt.hash);
      }, function () { clearTimeout(timer); if (canon.state === 'checking') canon.state = 'no-answer'; });
  }
  function movedNotice() {
    return false;   // 2026-10-14: no notice while the site is in development; the redirect itself stays.
    if (!movedFrom || location.hostname.toLowerCase() !== CANON_HOST) return false;
    if (lget('cw.keep.movedShown.v1')) return false;
    lset('cw.keep.movedShown.v1', String(Date.now()));
    event('moved-notice', 'from ' + movedFrom);
    notice('You are now on ' + CANON_HOST,
      'You are now on ' + esc(CANON_HOST) + '. Sign in to your media server and game server once here; this address will remember you. ' +
      '<br><br>Your earlier sign-ins and vault code stay saved at the old address, <b>' + esc(movedFrom) + '</b>. ' +
      'To bring the vault code across: open <b>' + esc(movedFrom) + '/?stay=1</b>, go to Settings, Access Code and press Copy, ' +
      'then come back here and paste it in <b>Settings, Access Code, Switch to a different vault</b>.',
      [{ label: 'OK' }, { label: 'Open Settings', go: openSettingsCode }]);
    return true;
  }

  /* ------------------------------------------------------------ boot */
  var outcome = 'ok';
  var pendingNotice = parse(ss(SS_NOTICE));
  if (pendingNotice) ss(SS_NOTICE, null);

  function decide(m) {
    var mirrorHasVault = !!(m && m.keys && m.keys[VAULT]);
    if (m) lastMirror = { at: m.at, names: Object.keys(m.keys || {}) };
    if (!ls) { outcome = 'storage-unreadable'; event('local-storage-unreadable', lsError); return; }

    /* LOST, AND WE HOLD A COPY: put it back and reload once. */
    if (!start.hadVault && mirrorHasVault && !start.tomb) {
      var recent = Number(ss(SS_RELOAD) || 0);
      var restored = [];
      for (var k in m.keys) {
        if (!KEEPSET[k]) continue;
        if (k === VAULT || lget(k) === null) { if (lset(k, m.keys[k])) restored.push(k); }
      }
      event('restored-from-backup', restored.join(','));
      if (restored.indexOf(VAULT) >= 0 && Date.now() - recent > 60000 && ss(SS_RELOAD, String(Date.now()))) {
        ss(SS_NOTICE, JSON.stringify({ kind: 'restored', names: restored }));
        outcome = 'reloading';
        location.reload();
        return;
      }
      outcome = 'restored-no-reload';
      notice('Your saved settings were missing',
        'This browser had lost what the site saved here. A backup copy was found and put back. Reload the page to use it.',
        [{ label: 'Reload now', go: function () { location.reload(); } }, { label: 'Later' }]);
      return;
    }

    if (start.hadVault && !m && diag.loads > 1) event('backup-copy-was-missing', 'IndexedDB lost, localStorage kept');

    if (!start.hadVault && !start.tomb) {
      var others = seenBefore.filter(function (o) { return o !== origin; });
      var hereBefore = seenBefore.indexOf(origin) >= 0;
      if (hereBefore) {
        outcome = 'lost-no-backup';
        event('lost-no-backup', 'cookie remembers this address');
        notice('This browser cleared this site\'s saved settings',
          'Your vault code, Media Login and game server connections were saved at this address before, but the browser has deleted them. ' +
          'To get your games and notes back, paste your vault code in <b>Settings, Access Code, Switch to a different vault</b>. ' +
          'Then sign in to Media Login again and use Direct connect for your game server.',
          [{ label: 'Open Settings', go: openSettingsCode }, { label: 'Close' }]);
      } else if (others.length) {
        outcome = 'other-address';
        event('other-address', 'used before: ' + others.join(' '));
        var target = others[0] + location.pathname + location.search + location.hash;
        notice('You are on a different address than last time',
          'This page is <b>' + esc(origin) + '</b>. Your sign-ins, vault code and game servers are kept by <b>' + esc(others[0]) + '</b>. ' +
          'Each address keeps its own, so this one starts empty. Open the usual address to carry on, or paste your vault code here in Settings, Access Code.',
          [{ label: 'Open ' + others[0], go: function () { location.href = target; } }, { label: 'Stay here' }]);
      } else if (!fresh) {
        outcome = 'vault-missing';
        event('vault-code-missing', 'diag record survived');
      } else {
        outcome = 'first-visit-or-full-wipe';
        event('first-seen-here');
      }
    }
  }

  db().then(function () { return idbGet('mirror'); }).then(function (m) {
    decide(m);
    if (outcome === 'reloading') return;
    ready = true;
    movedNotice();
    if (pendingNotice && pendingNotice.kind === 'restored') {
      notice('Your saved settings were put back',
        'This browser had lost what the site saved here (vault code, Media Login, game servers). The site kept a backup copy and has put it back, so nothing else needs doing. ' +
        'If it keeps happening, open <b>Settings, Access Code, Storage check</b> and keep a photo of it.',
        [{ label: 'OK' }, { label: 'Storage check', go: function () { CWKeep.showReport(); } }]);
    }
    return idbGet('diag').then(function (idiag) {
      if (idiag && idiag.first && idiag.first < diag.first) { diag.firstFromBackup = idiag.first; saveDiag(); }
      return askPersist();
    }).then(function () { return snapshot(); }).then(function () {
      rememberHere();
      if (/[?&]diag=(1|storage)(&|$)/.test(location.search)) CWKeep.showReport();
    });
  });

  /* ------------------------------------------------------------ report */
  function sizeOf(k) { var v = lget(k); return v === null ? -1 : v.length; }
  function summary() {
    var keys = {}, j;
    for (j = 0; j < KEEP.length; j++) keys[KEEP[j]] = sizeOf(KEEP[j]);
    var all = 0, chars = 0;
    try { for (j = 0; j < ls.length; j++) { var name = ls.key(j); all++; chars += name.length + (ls.getItem(name) || '').length; } } catch (e) {}
    return {
      v: VERSION, origin: origin, secure: !!window.isSecureContext,
      outcome: outcome, events: loadEvents.slice(), lsError: lsError,
      recent: (diag.events || []).slice(-6),
      oneAddress: canon.state, movedFrom: movedFrom,
      atStart: { hadVault: start.hadVault, present: start.present.slice(), cleared: !!start.tomb },
      keys: keys, lsKeyCount: all, lsChars: chars,
      vaultFp: fp(lget(VAULT)),
      persisted: persist.persisted, persistSupported: persist.supported,
      mirror: lastMirror ? { at: lastMirror.at, names: lastMirror.names.slice() } : null,
      first: diag.first, firstFromBackup: diag.firstFromBackup || 0, prevLast: diag.prevLast, last: diag.last, loads: diag.loads,
      cookieOrigins: cookieOrigins()
    };
  }
  function ts(t) { if (!t) return '-'; var d = new Date(t); return d.toLocaleString(); }
  function reportText() {
    var s = summary(), out = [], k;
    out.push('STORAGE CHECK  (' + VERSION + ')   no codes or tokens are shown');
    out.push('address        ' + s.origin + (s.secure ? '  (secure)' : '  (plain HTTP: the browser cannot be asked to keep storage here)'));
    out.push('kept storage   ' + (s.persisted === true ? 'YES, the browser will keep it' : s.persisted === false ? 'NO, best effort: may be cleared when the disk is low' : 'unknown'));
    out.push('one address    ' + (CANON || 'none set') + '  (this load: ' + s.oneAddress + (s.movedFrom ? ', moved here from ' + s.movedFrom : '') + ')');
    out.push('this load      ' + s.outcome + (s.events.length ? '  [' + s.events.join(', ') + ']' : ''));
    out.push('at page start  vault code ' + (s.atStart.hadVault ? 'present' : 'MISSING') + ', ' + s.atStart.present.length + ' of ' + KEEP.length + ' kept keys present' + (s.atStart.cleared ? ', removed on purpose' : ''));
    out.push('vault          fingerprint ' + (s.vaultFp || 'none') + '  (changes when the code changes)');
    out.push('first seen     ' + ts(s.first) + (s.firstFromBackup ? '   (backup says ' + ts(s.firstFromBackup) + ')' : ''));
    out.push('last seen      ' + ts(s.prevLast) + '   (before this load; ' + s.loads + ' loads)');
    out.push('backup copy    ' + (s.mirror ? 'saved ' + ts(s.mirror.at) + ', ' + s.mirror.names.length + ' keys' : 'none'));
    out.push('addresses used ' + (s.cookieOrigins.length ? s.cookieOrigins.join('  ') : 'none remembered'));
    out.push('localStorage   ' + s.lsKeyCount + ' keys, ' + Math.round(s.lsChars / 1024) + ' K characters' + (s.lsError ? ', UNREADABLE (' + s.lsError + ')' : ''));
    out.push('kept keys (size in characters):');
    for (k in s.keys) out.push('  ' + (s.keys[k] < 0 ? 'missing ' : 'present ') + k + (s.keys[k] >= 0 ? '  ' + s.keys[k] : ''));
    var ev = (diag.events || []).slice(-12);
    if (ev.length) { out.push('recent events:'); ev.forEach(function (e) { out.push('  ' + ts(e.t) + '  ' + e.k + (e.d ? '  ' + e.d : '')); }); }
    return out.join('\n');
  }
  function showReport() {
    var extra = '';
    var p = (navigator.storage && navigator.storage.estimate) ? navigator.storage.estimate().then(function (e) {
      extra += '\nquota          ' + Math.round((e.usage || 0) / 1048576) + ' MB used of ' + Math.round((e.quota || 0) / 1048576) + ' MB';
    }).catch(function () {}) : Promise.resolve();
    p = p.then(function () {
      if (!(window.indexedDB && indexedDB.databases)) return;
      return indexedDB.databases().then(function (l) { extra += '\ndatabases      ' + l.length + ': ' + l.map(function (d) { return d.name; }).join(', '); }).catch(function () {});
    });
    p.then(function () {
      var old = document.getElementById('cw-keep-report'); if (old) old.parentNode.removeChild(old);
      var el = document.createElement('div');
      el.id = 'cw-keep-report';
      el.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483646;max-width:calc(100vw - 24px);max-height:70vh;overflow:auto;box-sizing:border-box;' +
        'padding:12px 16px;background:rgba(0,0,0,.9);color:#d8f5d0;font:600 13px/1.4 ui-monospace,Consolas,monospace;white-space:pre-wrap;word-break:break-word;border:2px solid #6c6;border-radius:8px';
      var pre = document.createElement('div'); pre.textContent = reportText() + extra;
      var close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close';
      close.style.cssText = 'margin-top:10px;padding:6px 14px;border-radius:8px;border:1px solid #6c6;background:transparent;color:#d8f5d0;cursor:pointer;font-weight:700';
      close.addEventListener('click', function () { if (el.parentNode) el.parentNode.removeChild(el); });
      el.appendChild(pre); el.appendChild(close);
      (document.body || document.documentElement).appendChild(el);
      try { close.focus(); } catch (e) {}
    });
  }

  window.CWKeep = {
    version: VERSION,
    summary: summary,          // names, sizes, times and flags only
    report: reportText,
    showReport: showReport,
    snapshot: snapshot,
    persist: askPersist
  };
})();

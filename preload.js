/* ===========================================================================
   preload.js  --  Pre-load on device (18 Nov 2026)
   ---------------------------------------------------------------------------
   "Under the Settings / Machine section per game we should have an option to
   'pre-load on device'. This feature will download that game as soon as the user
   is logged in so the game is preloaded so that there is no delay in loading the
   game when the user wants to play it. Allow 20 games to be like this."

   WHAT IT KEEPS. A list of at most 20 games (by the site's game id) and, for each
   one that has finished, a verified copy of its game file, kept under the file's
   SHA-256. Both live in this browser's own database 'cw-preload', apart from the
   game servers' cache (cws.js 'cws-cache', 200 MB, least recently used goes first)
   so nothing here is ever removed by itself, and apart from what Log out clears
   (index.html cwWipeBrowser leaves this database alone): the next sign-in is
   instant. Nothing is uploaded anywhere. Settings, Media and content, Game server, Pre-loaded games
   lists them and removes one or all.

   WHEN IT DOWNLOADS. Once the vault's game server has connected (cws.js lists the
   game and can reach it): quietly, one game at a time, never while a game is
   being played. A game whose file this page already holds (the one being played
   when the switch is turned on) is copied at once with no download. A game the
   server now lists with another fingerprint (its file changed) is fetched again
   and the old copy goes.

   HOW IT IS USED. cws.js fetchEntry asks bytes(sha256) before its own cache and
   before any download, so a pre-loaded game starts with no download wait.

   THE SWITCH lives in each game's play window, Settings, Machine section
   (play/host/host.mjs preloadRow), and reads state(id) / set(id, on) here.
   Game & Watch units are built into the site and have no switch.

   SOUND: none. No feature switch: it is simply on.
   ======================================================================== */
(function () {
  'use strict';
  if (window.CwPreload) return;
  var BUILD = '2.2.2-preload';
  var MAX = 20;
  var DBN = 'cw-preload';

  /* ---------------------------------------------------------------- the database */
  var _db = null;
  function db() {
    if (_db) return _db;
    _db = new Promise(function (res, rej) {
      var r = indexedDB.open(DBN, 2);
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains('games')) d.createObjectStore('games');   // id -> { id, sha, size, sys, name, added, ready, fw: [sha256], fwOk }
        if (!d.objectStoreNames.contains('files')) d.createObjectStore('files');   // sha256 -> { bytes, z, id }  (games and start-up files alike)
        if (!d.objectStoreNames.contains('firmware')) d.createObjectStore('firmware');   // sha256 -> { sha, size, system, name, users: [game ids] }
      };
      r.onsuccess = function () { var d = r.result; d.onversionchange = function () { try { d.close(); } catch (e) {} _db = null; }; res(d); };
      r.onerror = function () { rej(r.error); };
    });
    _db.catch(function () { _db = null; });
    return _db;
  }
  /* One transaction; resolves the request's result, rejects with the browser's own error
     (a QuotaExceededError when the browser will not keep more). */
  function tx(store, mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t, req;
        try { t = d.transaction(store, mode); req = fn(t.objectStore(store)); } catch (e) { rej(e); return; }
        t.oncomplete = function () { res(req && 'result' in req ? req.result : undefined); };
        t.onerror = t.onabort = function () { rej(t.error || (req && req.error) || new Error('aborted')); };
      });
    });
  }
  function isQuota(e) { return !!e && (e.name === 'QuotaExceededError' || e.code === 22 || /quota/i.test(e.message || '')); }

  /* ---------------------------------------------------------------- the list */
  var games = {};          // id -> record, read once at start
  var fw = {};             // sha256 -> a start-up file kept for the games in users (not counted in the 20)
  var loaded = false, _loadP = null;
  var live = {};           // id -> { state: 'downloading', got, size } | { state: 'nospace' }  (this page only)
  function load() {
    if (_loadP) return _loadP;
    _loadP = db().then(function (d) {
      return new Promise(function (res) {
        var out = {}, f = {}, t = d.transaction(['games', 'firmware'], 'readonly');
        t.objectStore('games').openCursor().onsuccess = function (e) {
          var c = e.target.result;
          if (c) { if (c.value && c.value.id) out[c.value.id] = c.value; c.continue(); }
        };
        t.objectStore('firmware').openCursor().onsuccess = function (e) {
          var c = e.target.result;
          if (c) { if (c.value && c.value.sha) f[c.value.sha] = c.value; c.continue(); }
        };
        t.oncomplete = function () { res({ g: out, f: f }); };
        t.onerror = t.onabort = function () { res({ g: out, f: f }); };
      });
    }).catch(function () { return { g: {}, f: {} }; }).then(function (o) { games = o.g; fw = o.f; loaded = true; emit(null); return games; });
    return _loadP;
  }
  function emit(id) { try { window.dispatchEvent(new CustomEvent('cw:preload', { detail: { id: id } })); } catch (e) {} }
  function sorted() { return Object.keys(games).map(function (k) { return games[k]; }).sort(function (a, b) { return (a.added || 0) - (b.added || 0); }); }

  /* ---------------------------------------------------------------- the game servers */
  function C() { return window.CWS || null; }
  function titleOf(id) { var c = C(); if (!c) return null; try { return c.titles().filter(function (t) { return t.id === id; })[0] || null; } catch (e) { return null; } }
  function connected() { var c = C(); if (!c) return false; try { return c.servers().some(function (s) { return s.state === 'ready'; }); } catch (e) { return false; } }
  var KINDS = { gb: 1, nes: 1, atari: 1, pm: 1 };
  /* Does this game have a switch? A game a joined game server lists, of a console the play
     window runs from a file (not a Game & Watch unit, a tape or a cassette). */
  function applies(id) { var t = titleOf(id); return !!(t && KINDS[t.kind]); }
  var SYS = { gb: 'Game Boy', gbc: 'Game Boy Color', sgb: 'Super Game Boy', nes: 'NES', famicom: 'Famicom', fds: 'Disk System',
    a2600: 'Atari 2600', a5200: 'Atari 5200', a7800: 'Atari 7800', alynx: 'Atari Lynx', pokemini: 'Pokémon mini',
    sg1000: 'SG-1000', sms: 'Master System', gg: 'Game Gear', n64: 'Nintendo 64', snes: 'Super Nintendo' };
  function nameOf(id, t) {
    try { var d = (typeof ALL_DEVICES !== 'undefined' ? ALL_DEVICES : []).filter(function (x) { return x.id === id; })[0]; if (d && d.name) return d.name; } catch (e) {}   // eslint-disable-line no-undef
    return (t && t.title) || id;
  }
  function playing() {
    try {
      var ids = typeof PLAY_OVERLAY_IDS !== 'undefined' ? PLAY_OVERLAY_IDS : ['gb-play-overlay', 'nes-play-overlay', 'atari-play-overlay', 'pm-play-overlay'];   // eslint-disable-line no-undef
      return ids.some(function (i) { var el = document.getElementById(i); return !!(el && el.classList.contains('open')); });
    } catch (e) { return false; }
  }

  /* ---------------------------------------------------------------- state, for the switch and Settings */
  /* { on, state: 'off' | 'waiting' | 'downloading' | 'ready' | 'nospace', why, pct } */
  function state(id) {
    var g = games[id], l = live[id];
    if (!g) return { on: false, state: l && l.state === 'nospace' ? 'nospace' : 'off' };
    if (l && l.state === 'downloading') return { on: true, state: 'downloading', pct: l.size ? Math.min(99, Math.floor(100 * (l.got || 0) / l.size)) : 0 };
    var t = titleOf(id);
    if (g.ready && g.fwOk && (!t || t.sha256 === g.sha)) return { on: true, state: 'ready' };
    if (!connected() || !t) return { on: true, state: 'waiting', why: 'signin' };
    if (!t.available) return { on: true, state: 'waiting', why: 'server' };
    if (playing()) return { on: true, state: 'waiting', why: 'playing' };
    return { on: true, state: 'waiting', why: 'queue' };
  }
  function text(s) {
    switch (s.state) {
      case 'ready': return 'Ready on this device.';
      case 'downloading': return 'Downloading' + (s.pct ? ', ' + s.pct + '%' : '') + '…';
      case 'nospace': return 'Not enough space: this browser will not keep more. Nothing was kept.';
      case 'waiting':
        if (s.why === 'signin') return 'Waiting for sign-in: it downloads once your game server is connected.';
        if (s.why === 'server') return 'Waiting: your game server cannot send it right now.';
        if (s.why === 'playing') return 'Waiting: it downloads after you close the game.';
        return 'Waiting to download.';
      default: return 'Keeps this game in this browser so it starts with no wait. Up to ' + MAX + ' games.';
    }
  }
  function list() {
    return sorted().map(function (g) { var t = titleOf(g.id); return { id: g.id, name: g.name || nameOf(g.id, t), sys: g.sys, system: SYS[g.sys] || '', state: state(g.id) }; });
  }

  /* ---------------------------------------------------------------- turning it on and off */
  function persist() { try { if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(function (p) { if (!p) return navigator.storage.persist(); }).catch(function () {}); } catch (e) {} }
  function set(id, on) {
    return load().then(function () {
      if (!on) return remove(id).then(function () { return { ok: true, state: state(id) }; });
      if (games[id]) return { ok: true, state: state(id) };
      if (Object.keys(games).length >= MAX) return { ok: false, full: true, max: MAX, list: list() };
      var t = titleOf(id);
      if (!t || !KINDS[t.kind]) return { ok: false, reason: 'not-a-server-game' };
      var rec = { id: id, sha: t.sha256, size: 0, sys: t.system || '', name: nameOf(id, t), added: Date.now(), ready: false };
      delete live[id];
      return tx('games', 'readwrite', function (s) { return s.put(rec, id); }).then(function () {
        games[id] = rec; persist(); emit(id); kickSoon(0);
        return { ok: true, state: state(id) };
      }, function (e) {
        if (isQuota(e)) { live[id] = { state: 'nospace' }; emit(id); return { ok: false, nospace: true, state: state(id) }; }
        throw e;
      });
    });
  }
  function shaInUse(sha, but) { return Object.keys(games).some(function (k) { return k !== but && games[k].sha === sha && games[k].ready; }); }
  function remove(id) {
    var g = games[id];
    delete live[id];
    if (!g) { emit(id); return Promise.resolve(); }
    delete games[id];
    var jobs = [tx('games', 'readwrite', function (s) { return s.delete(id); }).catch(function () {})];
    if (g.sha && !shaInUse(g.sha, id)) jobs.push(tx('files', 'readwrite', function (s) { return s.delete(g.sha); }).catch(function () {}));
    (g.fw || []).forEach(function (h) { jobs.push(dropUser(h, id)); });
    return Promise.all(jobs).then(function () { emit(id); });
  }
  function clearAll() {
    return load().then(function () {
      games = {}; live = {}; fw = {};
      return Promise.all([tx('games', 'readwrite', function (s) { return s.clear(); }), tx('files', 'readwrite', function (s) { return s.clear(); }),
        tx('firmware', 'readwrite', function (s) { return s.clear(); })]).catch(function () {});
    }).then(function () { emit(null); });
  }
  /* For cws.js: this browser's pre-loaded copy of one file, or null. */
  function bytes(sha) {
    if (!/^[0-9a-f]{64}$/.test(String(sha))) return Promise.resolve(null);
    return load().then(function () {
      var any = !!fw[sha] || Object.keys(games).some(function (k) { return games[k].sha === sha && games[k].ready; });
      if (!any) return null;
      return tx('files', 'readonly', function (s) { return s.get(sha); }).then(function (v) { return v && v.bytes ? new Uint8Array(v.bytes) : null; }, function () { return null; });
    });
  }

  /* ---------------------------------------------------------------- the downloads, one at a time */
  var running = false, again = false, _kickT = 0;
  function kickSoon(ms) { clearTimeout(_kickT); _kickT = setTimeout(kick, ms == null ? 1500 : ms); }
  function due(g) { var t = titleOf(g.id); return !!t && (!g.ready || t.sha256 !== g.sha || !g.fwOk); }
  function kick() {
    if (running) { again = true; return; }
    if (!loaded || !C() || typeof C().preloadFetch !== 'function') return;
    var todo = sorted().filter(due);
    if (!todo.length) return;
    running = true; again = false;
    var waitPlay = false;
    var step = function (i) {
      if (i >= todo.length) return Promise.resolve();
      var g = todo[i], id = g.id;
      if (!games[id] || !due(games[id])) return step(i + 1);   // turned off, or done, meanwhile
      var t = titleOf(id), busy = playing(), local = busy || !(t && t.available);
      if (busy) waitPlay = true;
      live[id] = { state: 'downloading', got: 0, size: t ? t.size || 0 : 0 };
      if (!local) emit(id); else delete live[id];
      var gg = games[id], needFile = !gg.ready || !t || t.sha256 !== gg.sha;
      /* While a game is being played only a copy this page already holds is taken (no network). */
      var file = needFile ? C().preloadFetch(id, local).then(function (r) {
        if (!r || !r.bytes || !games[id]) { delete live[id]; emit(id); return; }
        return keep(id, r);
      }, function () { delete live[id]; emit(id); }) : Promise.resolve();
      /* Then the start-up files it needs (cws.js preloadFirmware), kept once for every game. */
      return file.then(function () {
        var g2 = games[id];
        if (g2 && g2.ready && !g2.fwOk && (!t || t.sha256 === g2.sha)) return firmwareFor(id, local);
      }).then(function () { if (live[id] && live[id].state === 'downloading') delete live[id]; emit(id); return step(i + 1); });
    };
    step(0).catch(function () {}).then(function () {
      running = false;
      if (again) kickSoon(500);
      else if (waitPlay) kickSoon(5000);   // after the game is closed
    });
  }
  function keep(id, r) {
    var g = games[id], old = g.sha, u = r.bytes;
    var buf = u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength);
    return tx('files', 'readwrite', function (s) { return s.put({ bytes: buf, z: u.byteLength, id: id }, r.sha256); }).then(function () {
      if (!games[id]) return tx('files', 'readwrite', function (s) { return s.delete(r.sha256); }).catch(function () {});   // turned off while it was written
      var rec = Object.assign({}, games[id], { sha: r.sha256, size: u.byteLength, ready: true, at: Date.now() });
      return tx('games', 'readwrite', function (s) { return s.put(rec, id); }).then(function () {
        games[id] = rec; delete live[id];
        if (old && old !== r.sha256 && !shaInUse(old, id)) return tx('files', 'readwrite', function (s) { return s.delete(old); }).catch(function () {});
      });
    }, function (e) {
      if (!isQuota(e)) { delete live[id]; return; }
      /* The browser refuses the space: say so, and the switch goes off (nothing is kept). */
      return remove(id).then(function () { live[id] = { state: 'nospace' }; });
    }).then(function () { emit(id); });
  }
  /* ---------------------------------------------------------------- start-up files (18 Nov 2026)
     Kept once by SHA-256 and shared by every pre-loaded game that needs one; not counted in the 20;
     removed when no pre-loaded game needs it any more (dropUser), or by Remove all. Which files: cws.js
     preloadFirmware (originals only, the start-up firmware order), and any other a pre-loaded game asks
     for while it is played (noteFirmware: the model, the role or the file the player chose). */
  function putFw(rec) { return tx('firmware', 'readwrite', function (s) { return s.put(rec, rec.sha); }); }
  function addUser(h, id, meta, u) {
    var f = fw[h];
    if (f) {
      if (f.users.indexOf(id) >= 0) return Promise.resolve(true);
      var nf = Object.assign({}, f, { users: f.users.concat([id]) });
      fw[h] = nf;
      return putFw(nf).then(function () { return true; });
    }
    if (!u) return Promise.resolve(false);
    var buf = u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength);
    var rec = { sha: h, size: u.byteLength, system: (meta && meta.system) || '', name: (meta && meta.name) || '', users: [id] };
    return tx('files', 'readwrite', function (s) { return s.put({ bytes: buf, z: u.byteLength, fw: true }, h); })
      .then(function () { return putFw(rec); }).then(function () { fw[h] = rec; return true; });
  }
  function dropUser(h, id) {
    var f = fw[h]; if (!f) return Promise.resolve();
    var users = f.users.filter(function (x) { return x !== id; });
    if (users.length) { var nf = Object.assign({}, f, { users: users }); fw[h] = nf; return putFw(nf).catch(function () {}); }
    delete fw[h];
    return Promise.all([tx('firmware', 'readwrite', function (s) { return s.delete(h); }), tx('files', 'readwrite', function (s) { return s.delete(h); })]).catch(function () {});
  }
  function linkFw(id, shas, fwOk) {
    var g = games[id]; if (!g) return Promise.resolve();
    var have = g.fw || [], add = shas.filter(function (h) { return have.indexOf(h) < 0; });
    var rec = Object.assign({}, g, { fw: have.concat(add) });
    if (fwOk) rec.fwOk = true;
    return tx('games', 'readwrite', function (s) { return s.put(rec, id); }).then(function () { if (games[id]) games[id] = rec; });
  }
  function firmwareFor(id, local) {
    var list = [];
    try { list = (C().preloadFirmware && C().preloadFirmware(id)) || []; } catch (e) { list = []; }
    var ok = true, got = [], full = false;
    var one = function (i) {
      if (i >= list.length || !games[id] || full) return Promise.resolve();
      var f = list[i];
      if (fw[f.sha256]) return addUser(f.sha256, id).then(function () { got.push(f.sha256); return one(i + 1); });
      if (!local) { live[id] = { state: 'downloading', got: 0, size: f.size || 0 }; emit(id); }
      return C().preloadFetchSha(f.sha256, local).then(function (r) {
        if (!r || !r.bytes || !games[id]) { ok = false; return; }
        return addUser(f.sha256, id, f, r.bytes).then(function () { got.push(f.sha256); }, function (e) { ok = false; if (isQuota(e)) full = true; });
      }, function () { ok = false; }).then(function () { return one(i + 1); });
    };
    return one(0).then(function () {
      if (!games[id]) return;
      /* The browser refuses the space: say so, and the switch goes off (nothing is kept). */
      if (full) return remove(id).then(function () { live[id] = { state: 'nospace' }; });
      return linkFw(id, got, ok);
    });
  }
  /* cws.js, when a start-up file reaches a game being played: kept with that game if it is pre-loaded
     (from the bytes already here, never a download). */
  function playingId() {
    var id = null; try { id = typeof _openPlayDeviceId !== 'undefined' ? _openPlayDeviceId : null; } catch (e) { id = null; }   // eslint-disable-line no-undef
    return id && /^sgb-/.test(id) ? 'gb-' + id.slice(4) : id;
  }
  function noteFirmware(h, u, meta) {
    if (!loaded || !/^[0-9a-f]{64}$/.test(String(h))) return;
    var id = playingId(), g = id && games[id];
    if (!g || !g.ready || ((g.fw || []).indexOf(h) >= 0 && fw[h])) return;
    addUser(h, id, meta, u).then(function (done) { if (done) return linkFw(id, [h], false); }).then(function () { emit(id); }, function () {});
  }

  /* Progress, from cws.js's own download events. */
  var _progT = 0;
  window.addEventListener('cws:progress', function (e) {
    var d = e && e.detail, l = d && live[d.id];
    if (!l || l.state !== 'downloading') return;
    l.got = d.got; l.size = d.size || l.size;
    if (!_progT) _progT = setTimeout(function () { _progT = 0; emit(d.id); }, 250);
  });
  /* Signed in: the vault's game server connected, or its list changed. */
  ['cws:library-changed', 'cws:ready', 'cws:connected', 'cws:paired', 'cws:state'].forEach(function (n) {
    window.addEventListener(n, function () { kickSoon(); emit(null); });
  });

  /* ---------------------------------------------------------------- Settings, Media and content, Game server: Pre-loaded games */
  var LBL = 'display:block; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--muted); margin-bottom:6px;';
  var P = 'color:var(--muted); font-size:12.5px; line-height:1.55; margin:0 0 10px;';
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  /* Inside the Game server panel (Settings, Media and content, Game server), under the server rows:
     a part of #cws-section, so it goes wherever settings-sources.js puts that section. */
  function injectSettings() {
    if (document.getElementById('cw-preload-section')) return;
    var host = document.getElementById('cws-section');
    if (!host) { setTimeout(injectSettings, 700); return; }
    var sec = document.createElement('div');
    sec.id = 'cw-preload-section';
    sec.style.cssText = 'margin-top:16px; padding-top:14px; border-top:1px solid var(--line);';
    sec.innerHTML = '<label style="' + LBL + '">Pre-loaded games</label>' +
      '<p style="' + P + '">Games kept in this browser so they start with no wait, up to ' + MAX + '. Switch it on for a game in its play window: Settings, Machine, Pre-load on device. Each game keeps the start-up program it needs with it, shared between games and not counted in the ' + MAX + '. They stay here when you log out, and are never sent anywhere.</p>' +
      '<div id="cw-preload-list"></div>';
    host.appendChild(sec);
    sec.addEventListener('click', function (e) {
      var b = e.target && e.target.closest && e.target.closest('[data-pl-act]');
      if (!b) return;
      if (b.dataset.plAct === 'remove') set(b.dataset.plId, false);
      else if (b.dataset.plAct === 'all') {
        var go = typeof confirmModal === 'function'
          ? confirmModal({ sub: 'Pre-loaded games', title: 'Remove every pre-loaded game?', body: 'Their copies are removed from this browser. You can switch any of them on again in its play window.', confirmLabel: 'Remove all', danger: true })   // eslint-disable-line no-undef
          : Promise.resolve(window.confirm('Remove every pre-loaded game from this browser?'));
        Promise.resolve(go).then(function (yes) { if (yes) clearAll(); });
      }
    });
    renderSettings();
  }
  function renderSettings() {
    var box = document.getElementById('cw-preload-list');
    if (!box) return;
    var had = document.activeElement && box.contains(document.activeElement) ? document.activeElement.getAttribute('data-pl-id') || document.activeElement.getAttribute('data-pl-act') : null;
    var rows = list();
    if (!rows.length) { box.innerHTML = '<p style="' + P + ' margin:0;">None yet.</p>'; return; }
    var nfw = Object.keys(fw).length;
    box.innerHTML = '<div style="font-size:12px; color:var(--muted); margin:0 0 8px;">' + rows.length + ' of ' + MAX + (nfw ? ' · ' + nfw + ' start-up program' + (nfw === 1 ? '' : 's') + ' kept with them' : '') + '</div>' +
      '<ul class="cw-pl-list" style="list-style:none; margin:0 0 10px; padding:0; display:flex; flex-direction:column; gap:6px;">' +
      rows.map(function (r) {
        return '<li style="display:flex; align-items:center; gap:10px; justify-content:space-between; border:1px solid var(--line); border-radius:10px; padding:8px 10px;">' +
          '<div style="min-width:0;"><div style="font-size:13px; font-weight:700; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + esc(r.name) + '</div>' +
          '<div style="font-size:12px; color:var(--muted);">' + esc([r.system, text(r.state)].filter(Boolean).join(' · ')) + '</div></div>' +
          '<button type="button" class="btn-tiny" data-pl-act="remove" data-pl-id="' + esc(r.id) + '" aria-label="Remove ' + esc(r.name) + '">Remove</button></li>';
      }).join('') + '</ul>' +
      '<button type="button" class="btn-tiny" data-pl-act="all">Remove all</button>';
    if (had) { var f = box.querySelector('[data-pl-id="' + had + '"]') || box.querySelector('[data-pl-act="' + had + '"]') || box.querySelector('[data-pl-act]'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {} }
  }
  var _rT = 0;
  window.addEventListener('cw:preload', function () { if (!_rT) _rT = setTimeout(function () { _rT = 0; renderSettings(); }, 120); });

  window.CwPreload = { BUILD: BUILD, MAX: MAX, applies: applies, state: state, text: text, list: list, set: set, remove: remove, clearAll: clearAll, bytes: bytes, noteFirmware: noteFirmware, firmware: function () { return Object.keys(fw).map(function (h) { return Object.assign({}, fw[h]); }); }, ready: function () { return load(); }, kick: function () { kickSoon(0); } };

  load().then(function () { var c = C(); if (c && c.ready) Promise.resolve(c.ready).then(function () { kickSoon(); }); else kickSoon(3000); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectSettings, { once: true }); else injectSettings();
})();

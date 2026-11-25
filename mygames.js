/*
 * mygames.js -- My games, the private game tracker (21 Nov 2026).
 *
 * WHAT. The vault's own record of its games: a status (Playing, Played, Backlog, Wishlist,
 * Dropped, Shelved), a completion mark (Beaten, 100%, Endless), favourites, half-star ratings,
 * playthroughs with one note each (their sessions listed under each), games owned without a game file,
 * the wishlist, and the play diary the emulator writes by itself (continuerow.js cw-play-history).
 * There is no page of its own: it shows in the drawer (the My games section, where Play time was),
 * in Settings (Your vault, the My games card) and on the wall (marks on tiles, owned and wishlist
 * tiles, the Filter panel's My games tab, three new orders).
 *
 * WHERE IT LIVES. In the vault, through the vault's My games functions only (mygames_get,
 * mygames_set_games, mygames_put_sessions, mygames_put_playthroughs, mygames_usage,
 * mygames_delete_all), never a table or a bucket open to the public key. This browser keeps a full
 * copy (IndexedDB cw-my-games), so everything works offline and is sent later. "This browser only"
 * in Settings sends nothing. The game server holds none of it.
 *
 * WHICH GAME A RECORD BELONGS TO. Every record is kept under an anchor that never changes, a file
 * (f:<id prefix>:<first 12 hex of its SHA-256>) or a built-in title (d:<site id>), and is matched
 * to the game's tile each time the page loads through the variants table (Variants.keyOf), so a
 * rebuilt table can never swap two games' records. Records that land on the same tile show as one:
 * status, completion and rating, the newest; favourite, owned and wishlist, on if any is on;
 * playthroughs and sessions, all of them. A hack or translation counts under its original.
 *
 * MERGING. Each field of a game or playthrough carries the time of its last change; the newer wins.
 * A session keeps the larger length unless it was fixed by hand, then the later fix wins. A removal
 * is a value (deleted), so another browser learns of it.
 *
 * NEVER IN IT: an address, a browser, a device, an input, a cheat, a game server's file name or
 * folder. The vault code is sent only in the body of the vault's own calls, never in an export.
 * Notes and titles are always put on screen as text.
 *
 * SOUND: none. Every control here is silent; only the play window makes sound.
 */
(function () {
  'use strict';
  if (window.CwMyGames) return;

  const BUILD = '2.3.0-tracker';
  const DB_NAME = 'cw-my-games';
  const LS = 'cw.mygames.';
  const STATUSES = [['playing', 'Playing'], ['played', 'Played'], ['backlog', 'Backlog'], ['wishlist', 'Wishlist'], ['dropped', 'Dropped'], ['shelved', 'Shelved']];
  const STATUS_WORD = Object.fromEntries(STATUSES);
  const COMPLETIONS = [['beaten', 'Beaten'], ['100', '100%'], ['endless', 'Endless']];
  const COMPLETION_WORD = Object.fromEntries(COMPLETIONS);
  const GAME_FIELDS = ['status', 'completion', 'favourite', 'rating', 'owned', 'my_length', 'title', 'deleted'];
  const PT_FIELDS = ['label', 'started_on', 'finished_on', 'completion', 'note', 'deleted'];
  const ANCHOR_RE = /^(f:[a-z0-9]{2,12}:[0-9a-f]{12}|d:[a-z0-9-]{1,64})$/;
  const RETRY = [30000, 120000, 600000, 3600000];
  /* The site id's prefix, its catalogue and the compatibility list's shelves. */
  const PREFIX_CAT = { nes: 'nes', gb: 'game-boy', pm: 'pokemon-mini', a2600: 'atari2600', a5200: 'atari5200', a7800: 'atari7800', alynx: 'atarilynx', sg1000: 'sg1000', sms: 'mastersystem', gg: 'gamegear', n64: 'n64', snes: 'snes' };
  const CAT_PREFIX = Object.fromEntries(Object.entries(PREFIX_CAT).map(([p, c]) => [c, p]));
  const SHELF_PREFIX = { nes: 'nes', famicom: 'nes', fds: 'nes', gb: 'gb', gbc: 'gb', sgb: 'gb', pm: 'pm', atari2600: 'a2600', atari5200: 'a5200', atari7800: 'a7800', atarilynx: 'alynx', sg1000: 'sg1000', mastersystem: 'sms', gamegear: 'gg', n64: 'n64', snes: 'snes' };
  const SHELF_LABEL = { gnw: 'Game & Watch', tft: 'Game & Watch', tj: 'Game & Watch', gb: 'Game Boy', gbc: 'Game Boy Color', sgb: 'Super Game Boy', nes: 'NES', famicom: 'Famicom', fds: 'Famicom Disk System',
    pm: 'Pokémon mini', atari2600: 'Atari 2600', atari5200: 'Atari 5200', atari7800: 'Atari 7800', atarilynx: 'Atari Lynx', sg1000: 'SG-1000', mastersystem: 'Master System', gamegear: 'Game Gear', n64: 'Nintendo 64', snes: 'Super Nintendo' };
  const PREFIX_LABEL = { nes: 'NES', gb: 'Game Boy', pm: 'Pokémon mini', a2600: 'Atari 2600', a5200: 'Atari 5200', a7800: 'Atari 7800', alynx: 'Atari Lynx', sg1000: 'SG-1000', sms: 'Master System', gg: 'Game Gear', n64: 'Nintendo 64', snes: 'Super Nintendo' };
  /* Score games: Endless is offered first. */
  const SCORE_CATS = new Set(['gnw']);

  /* ------------------------------------------------------------ the page's own names */
  const vcode = () => { try { return typeof vaultCode !== 'undefined' && vaultCode ? String(vaultCode) : null; } catch (e) { return null; } };   // eslint-disable-line no-undef
  const sbUrl = () => { try { return typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : ''; } catch (e) { return ''; } };   // eslint-disable-line no-undef
  const sbKey = () => { try { return typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : ''; } catch (e) { return ''; } };   // eslint-disable-line no-undef
  const allDevices = () => { try { return typeof ALL_DEVICES !== 'undefined' ? ALL_DEVICES : []; } catch (e) { return []; } };   // eslint-disable-line no-undef
  const glob = (fn) => { try { return fn(); } catch (e) { return undefined; } };
  const V = () => window.Variants || null;

  /* ------------------------------------------------------------ small helpers */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const now = () => Date.now();
  function randHex(n) {
    const a = new Uint8Array(n);
    try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256); }
    return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  function uuid() {
    const h = randHex(16).split('');
    h[12] = '4'; h[16] = '89ab'[parseInt(h[16], 16) & 3];
    const s = h.join('');
    return s.slice(0, 8) + '-' + s.slice(8, 12) + '-' + s.slice(12, 16) + '-' + s.slice(16, 20) + '-' + s.slice(20);
  }
  /* Text the vault accepts: no control or format characters, trimmed, at most n characters. */
  /* Characters the vault refuses in a title or a note: controls, format and invisible marks, line and
     paragraph separators, surrogates, private use and the replacement mark (the vault's cwsv_text_ok). */
  const BAD_CHARS = [[0, 31], [127, 159], [173, 173], [1536, 1541], [1564, 1564], [1757, 1757], [1807, 1807], [2192, 2193], [2274, 2274], [6158, 6158],
    [8203, 8207], [8232, 8238], [8288, 8292], [8294, 8303], [55296, 57343], [57344, 63743], [65279, 65279], [65529, 65531], [65533, 65533],
    [69821, 69821], [69837, 69837], [78896, 78911], [113824, 113827], [119155, 119162], [917505, 917505], [917536, 917631], [983040, 1114111]];
  function cleanText(s, n, lines) {
    if (s == null) return null;
    let t = String(s).replace(/\r\n?/g, '\n');
    let o = '';
    for (const ch of t) {
      const c = ch.codePointAt(0);
      if (lines && c === 10) { o += ch; continue; }
      o += BAD_CHARS.some((r) => c >= r[0] && c <= r[1]) ? (lines ? '' : ' ') : ch;
    }
    t = lines ? o : o.replace(/\s+/g, ' ');
    t = t.trim();
    if (lines) t = t.split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\n{3,}/g, '\n\n');
    if (t.length > n) t = t.slice(0, n).trim();
    return t || null;
  }
  function fmtLen(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    if (sec < 60) return sec + ' s';
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    if (!h) return m + ' min';
    return h + ' h' + (m ? ' ' + m + ' min' : '');
  }
  function fmtClock(sec) {
    if (typeof fmtPlayTime === 'function') return fmtPlayTime(sec);   // eslint-disable-line no-undef
    sec = Math.max(0, Math.floor(sec || 0));
    const p = (n, w) => String(n).padStart(w, '0');
    return p(Math.floor(sec / 86400), 3) + ':' + p(Math.floor((sec % 86400) / 3600), 2) + ':' + p(Math.floor((sec % 3600) / 60), 2) + ':' + p(sec % 60, 2);
  }
  const DATE_FMT = (() => { try { return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return null; } })();
  const dateText = (ms) => { if (!ms) return ''; const d = new Date(ms); return DATE_FMT ? DATE_FMT.format(d) : d.toDateString(); };
  const dayText = (iso) => (iso ? dateText(Date.parse(iso + 'T12:00:00')) : '');
  const isoDay = (ms) => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function ago(ms) {
    if (!ms) return '';
    const s = Math.max(0, (now() - ms) / 1000);
    if (s < 90) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' minutes ago';
    if (s < 5400) return 'an hour ago';
    if (s < 86400) return Math.round(s / 3600) + ' hours ago';
    const d = Math.floor(s / 86400);
    if (d === 1) return 'yesterday';
    if (d < 30) return d + ' days ago';
    return 'on ' + dateText(ms);
  }
  const plural = (n, one, many) => n.toLocaleString('en-AU') + ' ' + (n === 1 ? one : (many || one + 's'));
  const lsGet = (k) => { try { return localStorage.getItem(LS + k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(LS + k); else localStorage.setItem(LS + k, v); } catch (e) {} };

  /* ------------------------------------------------------------ the vault tag (brief 6.2)
     The first 16 hex of SHA-256 of "cw-my-games", a zero byte and the vault code: it is not the
     code and cannot be turned back into it. Each diary record carries it, so a browser used by two
     vaults never sends one vault's sessions to the other. */
  const _tags = new Map();
  function sha256Bytes(bytes) {
    if (window.crypto && crypto.subtle && window.isSecureContext !== false) {
      return crypto.subtle.digest('SHA-256', bytes).then((b) => new Uint8Array(b)).catch(() => jsSha(bytes));
    }
    return Promise.resolve(jsSha(bytes));
  }
  function jsSha(bytes) {
    const f = window.CWS && window.CWS._sha256js;
    const r = f ? f(bytes) : null;
    return r instanceof Uint8Array ? r : (r ? new Uint8Array(r) : null);
  }
  function tagFor(code) {
    if (!code) return Promise.resolve('local');
    if (_tags.has(code)) return Promise.resolve(_tags.get(code));
    const enc = new TextEncoder(), a = enc.encode('cw-my-games'), b = enc.encode(code), all = new Uint8Array(a.length + 1 + b.length);
    all.set(a, 0); all[a.length] = 0; all.set(b, a.length + 1);
    return sha256Bytes(all).then((h) => {
      const t = h ? Array.from(h.slice(0, 8), (x) => x.toString(16).padStart(2, '0')).join('') : 'local';
      _tags.set(code, t);
      return t;
    });
  }
  const tagNow = () => { const c = vcode(); return c ? (_tags.get(c) || null) : 'local'; };

  /* ------------------------------------------------------------ anchors */
  const _fake = new Map();
  function fakeDev(p, h) {
    const k = p + ':' + h;
    let d = _fake.get(k);
    if (!d) { d = { id: p + '-x' + h, catalogue: PREFIX_CAT[p] }; _fake.set(k, d); }
    return d;
  }
  function anchorOfDevice(d) {
    if (!d || !d.id) return null;
    if (d.mgAnchor) return d.mgAnchor;
    const m = /^([a-z0-9]+)-x([0-9a-f]{12})$/.exec(d.id);
    if (m && PREFIX_CAT[m[1]]) return 'f:' + m[1] + ':' + m[2];
    const p = CAT_PREFIX[d.catalogue];
    let sha = d.sha256 || null;
    if (!sha && p) { try { const e = V() && V().info(d); sha = e && e.sha; } catch (e) {} }
    if (p && sha && /^[0-9a-f]{12}/i.test(sha)) return 'f:' + p + ':' + sha.slice(0, 12).toLowerCase();
    const id = String(d.sgbOf || d.id).toLowerCase();
    return /^[a-z0-9-]{1,64}$/.test(id) ? 'd:' + id : null;
  }
  /* A diary record from the recorder: its file, else its built-in title. */
  function anchorOfRec(rec) {
    if (!rec) return null;
    if (rec.fa && ANCHOR_RE.test(rec.fa)) return rec.fa;
    const id = String(rec.id || '');
    const m = /^([a-z0-9]+)-x([0-9a-f]{12})$/.exec(id);
    if (m && PREFIX_CAT[m[1]]) return 'f:' + m[1] + ':' + m[2];
    let d = null; try { d = allDevices().find((x) => x.id === id) || null; } catch (e) {}
    if (d) { const a = anchorOfDevice(d); if (a) return a; }
    const p = { gb: 'gb', nes: 'nes', pm: 'pm' }[rec.sys];
    if (p && rec.sha256 && /^[0-9a-f]{64}$/i.test(rec.sha256)) return 'f:' + p + ':' + rec.sha256.slice(0, 12).toLowerCase();
    const lid = id.toLowerCase();
    return /^[a-z0-9-]{1,64}$/.test(lid) ? 'd:' + lid : null;
  }
  /* Which tile an anchor belongs to now: the variants table's game, else the anchor itself. */
  let _keyMemo = new Map(), _keyMemoV = -1;
  function keyOfAnchor(a) {
    const v = V(), ver = v ? v.version : 0;
    if (ver !== _keyMemoV) { _keyMemo = new Map(); _keyMemoV = ver; }
    let k = _keyMemo.get(a);
    if (k) return k;
    k = 'a:' + a;
    if (a && a[0] === 'f' && v && v.keyOf) {
      const parts = a.split(':');
      try { const g = v.keyOf(fakeDev(parts[1], parts[2])); if (g) k = g; } catch (e) {}
    }
    _keyMemo.set(a, k);
    return k;
  }
  function keyOfDevice(d) {
    if (!d) return null;
    if (d.mgAnchor) return keyOfAnchor(d.mgAnchor);
    const v = V();
    if (v && v.keyOf) { try { const g = v.keyOf(d.sgbOf ? { id: d.sgbOf, catalogue: d.catalogue } : d); if (g) return g; } catch (e) {} }
    const a = anchorOfDevice(d);
    return a ? keyOfAnchor(a) : null;
  }

  /* ------------------------------------------------------------ the browser's copy (IndexedDB) */
  let _dbp = null, storageOk = true;
  function db() {
    if (_dbp) return _dbp;
    _dbp = new Promise((res, rej) => {
      let r;
      try { r = indexedDB.open(DB_NAME, 1); } catch (e) { rej(e); return; }
      r.onupgradeneeded = () => {
        try {
          const d = r.result;
          if (!d.objectStoreNames.contains('rows')) d.createObjectStore('rows', { keyPath: 'k' }).createIndex('vt', 'vt');
          if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'vt' });
        } catch (e) {}
      };
      r.onsuccess = () => { const d = r.result; d.onclose = () => { _dbp = null; }; d.onversionchange = () => { try { d.close(); } catch (e) {} _dbp = null; }; res(d); };
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error('blocked'));
    }).catch((e) => { _dbp = null; storageOk = false; throw e; });
    return _dbp;
  }
  function idbAll(vt) {
    return db().then((d) => new Promise((res, rej) => {
      const t = d.transaction(['rows', 'meta'], 'readonly');
      const rq = t.objectStore('rows').index('vt').getAll(IDBKeyRange.only(vt)), mq = t.objectStore('meta').get(vt);
      t.oncomplete = () => res({ rows: rq.result || [], meta: mq.result || null });
      t.onerror = () => rej(t.error);
    }));
  }
  const _pending = new Map(); let _flushT = 0, _metaDirty = false;
  function persist(kind, id, obj) {
    if (!S.vt) return;
    _pending.set(S.vt + '|' + kind + '|' + id, obj ? { k: S.vt + '|' + kind + '|' + id, vt: S.vt, kind, id, o: obj } : null);
    flushSoon();
  }
  function persistMeta() { _metaDirty = true; flushSoon(); }
  function flushSoon() { if (!_flushT) _flushT = setTimeout(flushNow, 300); }
  function flushNow() {
    _flushT = 0;
    const items = Array.from(_pending.entries()); _pending.clear();
    const meta = _metaDirty ? Object.assign({ vt: S.vt }, S.meta) : null; _metaDirty = false;
    if (!items.length && !meta) return Promise.resolve();
    return db().then((d) => new Promise((res) => {
      const t = d.transaction(['rows', 'meta'], 'readwrite'), st = t.objectStore('rows');
      for (const [k, v] of items) { if (v) st.put(clone(v)); else st.delete(k); }
      if (meta) t.objectStore('meta').put(clone(meta));
      t.oncomplete = () => res(); t.onerror = () => res(); t.onabort = () => res();
    })).catch(() => {});
  }
  const clone = (o) => JSON.parse(JSON.stringify(o));
  function idbWipe(vt) {
    return db().then((d) => new Promise((res) => {
      const t = d.transaction(['rows', 'meta'], 'readwrite');
      const st = t.objectStore('rows');
      const rq = st.index('vt').getAllKeys(IDBKeyRange.only(vt));
      rq.onsuccess = () => { for (const k of rq.result || []) st.delete(k); };
      t.objectStore('meta').delete(vt);
      t.oncomplete = () => res(); t.onerror = () => res();
    })).catch(() => {});
  }

  /* ------------------------------------------------------------ state */
  const S = {
    code: null, vt: null, loaded: false, ready: null,
    games: new Map(), pts: new Map(), sess: new Map(),
    meta: { rev: 0, wiped_at: null, wipedMs: 0, lastSaved: 0, aliases: [] },
    ver: 0,                 // bumps on every change the wall or a drawer shows
    svc: 'unknown',         // unknown | ok | offline | missing | novault | full | local
    syncing: false, retryN: 0, retryT: 0, lastTry: 0, limit: null, refused: [],
    earlier: 0,             // earlier sessions in this browser with no vault tag (6.2)
  };
  const listeners = new Set();
  function changed(what) {
    S.ver++;
    _viewMemo = null;
    for (const f of listeners) { try { f(what); } catch (e) {} }
    scheduleUi(what);
  }
  const localOnly = () => !S.code || lsGet('mode.' + S.vt) === 'local';

  function emptyGame(anchor) {
    return { anchor, status: null, status_auto: false, completion: null, favourite: false, rating: null, owned: false, my_length: null, title: null, deleted: false, t: {}, dirty: {} };
  }
  function emptyPt(pt_id, anchor) {
    return { pt_id, anchor, label: null, started_on: null, finished_on: null, completion: null, note: null, deleted: false, t: {}, dirty: {} };
  }

  async function load(code) {
    S.code = code || null;
    const vt = await tagFor(S.code);
    if (S.code !== (code || null)) return;   // changed again meanwhile
    S.vt = vt;
    S.games = new Map(); S.pts = new Map(); S.sess = new Map();
    S.meta = { rev: 0, wiped_at: null, wipedMs: 0, lastSaved: 0, aliases: [] };
    S.svc = localOnly() ? 'local' : 'unknown'; S.retryN = 0; S.limit = null; S.refused = [];
    try {
      const r = await idbAll(vt);
      if (r.meta) S.meta = Object.assign(S.meta, r.meta);
      for (const row of r.rows) {
        if (row.kind === 'g') S.games.set(row.id, Object.assign(emptyGame(row.id), row.o));
        else if (row.kind === 'p') S.pts.set(row.id, Object.assign(emptyPt(row.id, row.o.anchor), row.o));
        else if (row.kind === 's') S.sess.set(row.id, row.o);
      }
      storageOk = true;
    } catch (e) { storageOk = false; }
    S.loaded = true;
    await importRecorder();
    changed('load');
    syncSoon(500);
  }

  /* ------------------------------------------------------------ the merged view of one game */
  let _viewMemo = null;
  function byKey() {
    if (_viewMemo && _viewMemo.v === S.ver && _viewMemo.vv === (V() ? V().version : 0)) return _viewMemo;
    const m = { v: S.ver, vv: V() ? V().version : 0, games: new Map(), pts: new Map(), sess: new Map() };
    const add = (map, k, x) => { let a = map.get(k); if (!a) map.set(k, a = []); a.push(x); };
    const keep = (k) => !_hidden.size || !_hidden.has(k);
    for (const g of S.games.values()) if (!g.deleted) { const k = keyOfAnchor(g.anchor); if (keep(k)) add(m.games, k, g); }
    for (const p of S.pts.values()) if (!p.deleted) { const k = keyOfAnchor(p.anchor); if (keep(k)) add(m.pts, k, p); }
    for (const s of S.sess.values()) if (!s.deleted && s.played_ms > 0) { const k = keyOfAnchor(s.anchor); if (keep(k)) add(m.sess, k, s); }
    _viewMemo = m;
    return m;
  }
  const newest = (recs, f) => { let best = null, bt = -1; for (const r of recs) { const t = r.t[f] || 0; if (r[f] != null && t > bt) { best = r; bt = t; } } return best ? best[f] : null; };
  const newestStatus = (recs) => { let best = null, bt = -1; for (const r of recs) { const t = r.t.status || 0; if (t > bt) { best = r; bt = t; } } return best ? { status: best.status, auto: !!best.status_auto } : { status: null, auto: false }; };
  function view(k) {
    const m = byKey(), recs = m.games.get(k) || [], ss = m.sess.get(k) || [], pts = (m.pts.get(k) || []).slice();
    const st = newestStatus(recs);
    let total = 0, last = 0, first = 0;
    for (const s of ss) { total += s.played_ms; const end = (s.started || 0) + s.played_ms; if (end > last) last = end; if (!first || s.started < first) first = s.started; }
    pts.sort((a, b) => String(a.started_on || '').localeCompare(String(b.started_on || '')) || (a.t.label || 0) - (b.t.label || 0));
    return {
      key: k, recs, sessions: ss, pts,
      status: st.status, statusAuto: st.auto,
      completion: newest(recs, 'completion'), rating: newest(recs, 'rating'), myLength: newest(recs, 'my_length'),
      title: newest(recs, 'title'),
      favourite: recs.some((r) => r.favourite), owned: recs.some((r) => r.owned),
      wish: st.status === 'wishlist',
      playMs: total, lastPlayed: last, firstPlayed: first,
    };
  }
  const hasRecord = (k) => (byKey().games.get(k) || []).length > 0;

  /* ------------------------------------------------------------ changes (all of a game's records) */
  function setGameFields(k, fields, opts) {
    const t = now();
    let recs = byKey().games.get(k) || [];
    if (!recs.length) {
      const a = opts && opts.anchor;
      if (!a || !ANCHOR_RE.test(a)) return false;
      let g = S.games.get(a);
      if (!g) { g = emptyGame(a); S.games.set(a, g); }
      if (g.deleted) { g.deleted = false; g.t.deleted = t; g.dirty.deleted = 1; }
      recs = [g];
    }
    const favOnly = Object.keys(fields).length === 1 && 'favourite' in fields;
    for (const g of recs) {
      for (const [f, v] of Object.entries(fields)) {
        if (f === 'status_auto') continue;
        g[f] = v; g.t[f] = t; g.dirty[f] = 1;
        if (f === 'status') g.status_auto = !!fields.status_auto && v != null;
      }
      if (opts && opts.title && !g.title) { g.title = cleanText(opts.title, 128); g.t.title = t; g.dirty.title = 1; }
      persist('g', g.anchor, g);
    }
    changed(favOnly ? 'fav' : 'game');
    syncSoon(1500);
    return true;
  }
  /* CLEAR MY GAMES DATA (21 Nov 2026; button renamed from "Remove from My games" the same day): the game's whole record goes: status, completion, favourite, rating, owned and
     wishlist, every playthrough with its note, every session (so its play time is none). For the 4 seconds of Undo it is only
     hidden here; then each row becomes a removal (deleted) that is sent to the vault, so other browsers follow. Undo in
     those seconds puts back exactly what was there; leaving the page meanwhile completes the removal. */
  const _hidden = new Set();   // game keys hidden while their removal can still be undone
  let _pendingRemove = null;
  function commitRemove(job) {
    if (!job || job.done) return;
    job.done = true; clearTimeout(job.t);
    _hidden.delete(job.k);
    const t = now();
    for (const g of job.games) {
      Object.assign(g, emptyGame(g.anchor), { t: g.t, dirty: g.dirty });
      g.deleted = true;
      for (const f of GAME_FIELDS) { g.t[f] = t; g.dirty[f] = 1; }
      persist('g', g.anchor, g);
    }
    for (const pt of job.pts) {
      Object.assign(pt, emptyPt(pt.pt_id, pt.anchor), { t: pt.t, dirty: pt.dirty, deleted: true });
      for (const f of PT_FIELDS) { pt.t[f] = t; pt.dirty[f] = 1; }
      persist('p', pt.pt_id, pt);
    }
    for (const s of job.sess) editSession(s, { deleted: true }, true);
    if (_pendingRemove === job) _pendingRemove = null;
    changed('game'); syncSoon(1000);
  }
  function removeGame(k) {
    if (_pendingRemove) commitRemove(_pendingRemove);
    const m0 = byKey();
    const job = { k, games: (m0.games.get(k) || []).slice(), pts: (m0.pts.get(k) || []).slice(), sess: (m0.sess.get(k) || []).slice(), done: false };
    _hidden.add(k);
    _pendingRemove = job;
    job.t = setTimeout(() => commitRemove(job), 4200);
    changed('game');
    return () => {   // undo: nothing was changed yet, so everything is exactly as it was
      if (job.done) return;
      job.done = true; clearTimeout(job.t);
      _hidden.delete(k);
      if (_pendingRemove === job) _pendingRemove = null;
      changed('game');
    };
  }
  function removeGameDialog(d, k) {
    const name = (d && d.name) || 'this game';
    dialog({ sub: 'My games', title: 'Clear My games data?',
      html: `<p class="mg-p">Clear the My games data for ${esc(name)}? This clears its status, rating, favourite, playthroughs, notes and play time. The game itself is not touched.</p>`,
      actions: [{ label: 'Clear My games data', kind: 'accent', run: (dd) => { dd.close(); const undo = removeGame(k); toast('My games data cleared.', undo); } },
        { label: 'Cancel', run: (dd) => dd.close() }] });
  }
  function setPt(pt, fields) {
    const t = now();
    for (const [f, v] of Object.entries(fields)) { pt[f] = v; pt.t[f] = t; pt.dirty[f] = 1; }
    if (!S.pts.has(pt.pt_id)) S.pts.set(pt.pt_id, pt);
    persist('p', pt.pt_id, pt);
    changed('pt'); syncSoon(1500);
  }
  function newPlaythrough(k, anchor, label) {
    const pt = emptyPt(uuid(), anchor);
    setPt(pt, { label: cleanText(label, 64) || null, started_on: isoDay(now()) });
    return pt;
  }
  function removePt(pt) {
    const kept = clone(pt), t = now();
    Object.assign(pt, emptyPt(pt.pt_id, pt.anchor), { t: pt.t, dirty: pt.dirty, deleted: true });
    for (const f of PT_FIELDS) { pt.t[f] = t; pt.dirty[f] = 1; }
    // Its sessions stand alone again.
    for (const s of S.sess.values()) if (s.pt_id === pt.pt_id && !s.deleted) editSession(s, { pt_id: null }, true);
    persist('p', pt.pt_id, pt); changed('pt'); syncSoon(5000);
    return () => {
      const u = now();
      Object.assign(pt, kept, { t: pt.t, dirty: pt.dirty, deleted: false });
      for (const f of PT_FIELDS) { pt.t[f] = u; pt.dirty[f] = 1; }
      persist('p', pt.pt_id, pt); changed('pt'); syncSoon(1500);
    };
  }
  function editSession(s, fields, quiet) {
    Object.assign(s, fields);
    s.edited = true; s.edit_t = Math.max(now(), (s.edit_t || 0) + 1); s.dirty = true;
    persist('s', s.sid, s);
    if (!quiet) { changed('sess'); syncSoon(1500); }
  }
  function removeSession(s) {
    const kept = clone(s);
    editSession(s, { deleted: true });
    return () => { const back = Object.assign(S.sess.get(s.sid) || s, kept, { deleted: false }); editSession(back, {}); };
  }
  function addManualSession(k, anchor, o) {
    const s = { sid: randHex(16), anchor, file: null, sys: null, title: cleanText(o.title, 128), version: null, machine: cleanText(o.machine, 40),
      started: o.started, played_ms: Math.round(o.minutes * 60000), pt_id: o.pt_id || null, source: 'manual', edited: true, edit_t: now(), deleted: false, dirty: true };
    S.sess.set(s.sid, s); persist('s', s.sid, s); changed('sess'); syncSoon(1500);
    return s;
  }
  /* A new session joins the game's newest unfinished playthrough (6.2 point 3). */
  function openPtFor(k) {
    const pts = (byKey().pts.get(k) || []).filter((p) => !p.finished_on);
    if (!pts.length) return null;
    pts.sort((a, b) => String(b.started_on || '').localeCompare(String(a.started_on || '')) || (b.t.label || 0) - (a.t.label || 0));
    return pts[0].pt_id;
  }

  /* ------------------------------------------------------------ the recorder (continuerow.js) */
  function recOwn(rec) {
    if (!rec || !rec.sid) return false;
    if (rec.vt) return rec.vt === S.vt || (S.meta.aliases || []).indexOf(rec.vt) >= 0;
    if (rec.v >= 2) return true;   // written by this version before the tag was known: this vault's
    return lsGet('earlier') === 'yes:' + S.vt;
  }
  function takeRecord(rec, live) {
    if (!S.vt || !recOwn(rec)) return false;
    if (!(rec.played >= 30000)) return false;
    if (S.meta.wipedMs && rec.started < S.meta.wipedMs) return false;   // from before Delete everything
    const anchor = anchorOfRec(rec);
    if (!anchor) return false;
    let s = S.sess.get(rec.sid);
    if (s) {
      if (s.edited || s.deleted) return false;
      if (!(rec.played > s.played_ms)) return false;
      s.played_ms = Math.min(86400000, Math.round(rec.played)); s.dirty = true;
      if (!s.version && rec.version) s.version = cleanText(rec.version, 80);
      persist('s', s.sid, s);
      return true;
    }
    const k = keyOfAnchor(anchor);
    const firstOfGame = !(byKey().sess.get(k) || []).length;
    s = { sid: rec.sid, anchor, file: /^[a-z0-9-]{1,32}$/.test(String(rec.id || '')) ? rec.id : null, sys: /^[a-z0-9]{1,16}$/.test(String(rec.sys || '')) ? rec.sys : null,
      title: cleanText(rec.title, 128), version: cleanText(rec.version, 80), machine: cleanText(rec.machine, 40),
      started: Math.round(rec.started || now()), played_ms: Math.min(86400000, Math.round(rec.played)), pt_id: openPtFor(k),
      source: 'auto', edited: false, edit_t: null, deleted: false, dirty: true };
    S.sess.set(s.sid, s);
    persist('s', s.sid, s);
    _viewMemo = null;
    /* PLAYING BY ITSELF (D10): the first saved session of a game with no status, or with Backlog or
       Wishlist, sets Playing, marked as set by the site. Nothing else is ever set by itself. Only a session My games
       itself recorded (v 2) does this: an earlier session brought in from before adds play time only (21 Nov 2026). */
    if (firstOfGame && rec.v >= 2) {
      const v = view(k);
      if (!v.status || v.status === 'backlog' || v.status === 'wishlist') setGameFields(k, { status: 'playing', status_auto: true }, { anchor, title: rec.title });
    }
    if (live) syncSoon(3000);
    return true;
  }
  /* EARLIER SESSIONS COME IN BY THEMSELVES (21 Nov 2026; it was a question in Settings). The sessions this browser
     recorded before sessions carried a vault tag belong to the first vault opened in this browser with My games: it claims
     them once (cw.mygames.earlier), and on every load any of them not yet in My games are added, each by its session id, so
     nothing is counted twice. A session cleared in My games stays cleared: its removal is kept under the same id, and
     takeRecord never brings back an id that is already there. Only sittings of 30 seconds or more were ever recorded. */
  async function importRecorder() {
    const H = window.CwPlayHistory;
    if (!H || !S.vt) return;
    if (S.code && !/^yes:/.test(lsGet('earlier') || '')) lsSet('earlier', 'yes:' + S.vt);
    let all = [];
    try { all = await H.all(); } catch (e) { all = []; }
    let any = false;
    for (const rec of all || []) {
      if (!rec || !rec.sid) continue;
      if (takeRecord(rec, false)) any = true;
    }
    S.earlier = 0;
    if ((S.pulled || localOnly()) && undoImportedPlaying(all)) any = true;   // after the vault's copy is in, so its statuses are seen
    if (any) { changed('sess'); syncSoon(1500); }
  }
  /* ONCE PER VAULT ON THIS BROWSER (21 Nov 2026): a Playing that an earlier session set by itself while it was
     brought in (before that stopped) is taken back: only where the site set it (status_auto) and every session of the
     game is one of those earlier ones. A status the player chose is never touched. */
  function undoImportedPlaying(all) {
    if (!S.code || lsGet('autofix.' + S.vt)) return false;
    lsSet('autofix.' + S.vt, '1');
    const old = new Set((all || []).filter((r) => r && r.sid && !r.vt && !(r.v >= 2)).map((r) => r.sid));
    if (!old.size) return false;
    let any = false;
    for (const [k, recs] of byKey().games) {
      const v = view(k);
      if (v.status !== 'playing' || !v.statusAuto) continue;
      if (!v.sessions.length || !v.sessions.every((s) => old.has(s.sid))) continue;
      setGameFields(k, { status: null, status_auto: false });
      any = true;
      void recs;
    }
    return any;
  }
  /* Called by continuerow.js as it writes a record: the vault tag and the anchor go on it. */
  function stamp(rec) {
    try {
      rec.v = 2;
      const t = tagNow();
      if (t) rec.vt = t;
      const a = anchorOfRec(rec);
      if (a) rec.fa = a;
    } catch (e) {}
    return rec;
  }
  function noteSession(rec) {
    try { if (S.loaded && takeRecord(rec, true)) changed('sess'); } catch (e) {}
  }

  /* ------------------------------------------------------------ the vault's functions */
  async function rpc(fn, args, opts) {
    const base = sbUrl(), key = sbKey();
    if (!base) return { status: 0, body: null, net: true };
    const headers = { 'Content-Type': 'application/json' };
    if (key) { headers.apikey = key; headers.Authorization = 'Bearer ' + key; }
    let r;
    try {
      r = await fetch(base.replace(/\/+$/, '') + '/rest/v1/rpc/' + fn, { method: 'POST', headers, body: JSON.stringify(args), mode: 'cors', credentials: 'omit', cache: 'no-store', keepalive: !!(opts && opts.keepalive) });
    } catch (e) { return { status: 0, body: null, net: true }; }
    let j = null; try { j = await r.json(); } catch (e) {}
    return { status: r.status, body: j };
  }
  function callError(r) {
    if (r.net || r.status >= 500 || r.status === 0) return 'offline';
    if (r.status === 404 || (r.body && r.body.code === 'PGRST202')) return 'missing';
    if (r.status >= 400) return 'refused';
    if (r.body && r.body.ok === false) return r.body.error || 'refused';
    return null;
  }

  /* ------------------------------------------------------------ pulling */
  function mergeGame(inc) {
    const a = inc.anchor;
    if (!ANCHOR_RE.test(a || '')) return;
    let g = S.games.get(a);
    if (!g) { g = emptyGame(a); S.games.set(a, g); }
    const it = inc.t || {};
    for (const f of GAME_FIELDS) {
      const ti = +it[f] || 0, tl = +g.t[f] || 0;
      if (ti > tl) { g[f] = inc[f]; g.t[f] = ti; delete g.dirty[f]; if (f === 'status') g.status_auto = !!inc.status_auto; }
      else if (ti === tl && ti && g.dirty[f]) delete g.dirty[f];
    }
    persist('g', a, g);
  }
  function mergePt(inc) {
    if (!inc.pt_id) return;
    let p = S.pts.get(inc.pt_id);
    if (!p) { p = emptyPt(inc.pt_id, inc.anchor); S.pts.set(inc.pt_id, p); }
    const it = inc.t || {};
    for (const f of PT_FIELDS) {
      const ti = +it[f] || 0, tl = +p.t[f] || 0;
      if (ti > tl) { p[f] = inc[f]; p.t[f] = ti; delete p.dirty[f]; }
      else if (ti === tl && ti && p.dirty[f]) delete p.dirty[f];
    }
    persist('p', p.pt_id, p);
  }
  function mergeSession(inc) {
    if (!/^[0-9a-f]{32}$/.test(inc.sid || '')) return;
    const l = S.sess.get(inc.sid);
    const fromVault = { sid: inc.sid, anchor: inc.anchor, file: inc.file, sys: inc.sys, title: inc.title, version: inc.version, machine: inc.machine,
      started: inc.started, played_ms: inc.played_ms || 0, pt_id: inc.pt_id, source: inc.source, edited: !!inc.edited, edit_t: inc.edit_t, deleted: !!inc.deleted, dirty: false, sent: inc.played_ms || 0 };
    if (!l) { S.sess.set(inc.sid, fromVault); persist('s', inc.sid, fromVault); return; }
    if (inc.edited) {
      if (!l.edited || (inc.edit_t || 0) >= (l.edit_t || 0)) { S.sess.set(inc.sid, fromVault); persist('s', inc.sid, fromVault); }
      return;
    }
    if (l.edited) return;   // ours is a fix, not sent yet
    l.sent = inc.played_ms;
    if (inc.played_ms >= l.played_ms) { l.played_ms = inc.played_ms; l.dirty = false; }
    if (!l.pt_id && inc.pt_id) l.pt_id = inc.pt_id;
    persist('s', l.sid, l);
  }
  function wipeLocal(wipedIso) {
    S.games = new Map(); S.pts = new Map(); S.sess = new Map();
    S.meta.rev = 0; S.meta.wiped_at = wipedIso || new Date().toISOString(); S.meta.wipedMs = Date.parse(S.meta.wiped_at) || now();
    _pending.clear();
    return idbWipe(S.vt).then(() => { persistMeta(); changed('wipe'); });
  }
  async function pull() {
    let rounds = 0;
    for (;;) {
      const r = await rpc('mygames_get', { p_vault: S.code, p_since: S.meta.rev || 0 });
      const e = callError(r);
      if (e) return e;
      const b = r.body;
      /* Everything was deleted from another browser: this copy goes too, then everything after it comes again. */
      if (b.wiped_at && b.wiped_at !== S.meta.wiped_at) {
        await wipeLocal(b.wiped_at);
        if (++rounds > 60) return null;
        continue;
      }
      for (const p of b.playthroughs || []) mergePt(p);
      for (const g of b.games || []) mergeGame(g);
      for (const s of b.sessions || []) mergeSession(s);
      S.meta.rev = b.rev || S.meta.rev; persistMeta();
      if ((b.games || []).length || (b.sessions || []).length || (b.playthroughs || []).length) changed('pull');
      if (!b.more || ++rounds > 60) return null;
    }
  }

  /* ------------------------------------------------------------ sending */
  function chunks(list, max, toItem) {
    const out = []; let cur = [], size = 2;
    for (const x of list) {
      const it = toItem(x); if (!it) continue;
      const n = JSON.stringify(it).length + 1;
      if (cur.length && (cur.length >= max || size + n > 60000)) { out.push(cur); cur = []; size = 2; }
      cur.push({ x, it }); size += n;
    }
    if (cur.length) out.push(cur);
    return out;
  }
  function gameItem(g) {
    const fs = Object.keys(g.dirty || {}); if (!fs.length) return null;
    const it = { anchor: g.anchor, t: {} };
    for (const f of fs) { if (GAME_FIELDS.indexOf(f) < 0) continue; it[f] = g[f]; it.t[f] = g.t[f] || now(); }
    if (g.dirty.status) it.status_auto = !!g.status_auto;
    if (it.title != null) it.title = cleanText(it.title, 128);
    return Object.keys(it.t).length ? it : null;
  }
  function ptItem(p) {
    const fs = Object.keys(p.dirty || {}); if (!fs.length) return null;
    const it = { pt_id: p.pt_id, anchor: p.anchor, t: {} };
    for (const f of fs) { if (PT_FIELDS.indexOf(f) < 0) continue; it[f] = p[f]; it.t[f] = p.t[f] || now(); }
    return Object.keys(it.t).length ? it : null;
  }
  function sessItem(s) {
    if (!s.dirty || s.refused) return null;
    if (s.deleted) return { sid: s.sid, anchor: s.anchor, deleted: true, edited: true, edit_t: s.edit_t || now() };
    if (!(s.played_ms >= 30000)) return null;
    const it = { sid: s.sid, anchor: s.anchor, started: s.started, played_ms: Math.min(86400000, s.played_ms), source: s.source || 'auto' };
    for (const f of ['file', 'sys', 'title', 'version', 'machine', 'pt_id']) if (s[f] != null) it[f] = s[f];
    if (s.edited) { it.edited = true; it.edit_t = s.edit_t || now(); }
    return it;
  }
  const LIMIT_ERRORS = new Set(['day_limit', 'busy', 'games_limit', 'sessions_limit', 'playthroughs_limit', 'full']);
  function noteRefusals(list, keyName, find) {
    for (const r of list || []) {
      const x = find(r[keyName]);
      if (LIMIT_ERRORS.has(r.error)) { S.limit = r.error; continue; }
      if (x) { x.refused = r.error; if (x.dirty && typeof x.dirty === 'object') x.dirty = {}; else x.dirty = false; S.refused.push(r.error); }
    }
  }
  async function push() {
    // Playthroughs first: a session may name one.
    for (const part of chunks(Array.from(S.pts.values()), 100, ptItem)) {
      const sentT = part.map((p) => Object.assign({}, p.it.t));
      const r = await rpc('mygames_put_playthroughs', { p_vault: S.code, p_items: part.map((p) => p.it) });
      const e = callError(r); if (e) return e;
      part.forEach((p, i) => { for (const f of Object.keys(sentT[i])) if ((p.x.t[f] || 0) <= sentT[i][f]) delete p.x.dirty[f]; persist('p', p.x.pt_id, p.x); });
      noteRefusals(r.body.refused, 'pt_id', (id) => S.pts.get(id));
    }
    for (const part of chunks(Array.from(S.games.values()), 200, gameItem)) {
      const sentT = part.map((p) => Object.assign({}, p.it.t));
      const r = await rpc('mygames_set_games', { p_vault: S.code, p_items: part.map((p) => p.it) });
      const e = callError(r); if (e) return e;
      part.forEach((p, i) => { for (const f of Object.keys(sentT[i])) if ((p.x.t[f] || 0) <= sentT[i][f]) delete p.x.dirty[f]; persist('g', p.x.anchor, p.x); });
      noteRefusals(r.body.refused, 'anchor', (a) => S.games.get(a));
    }
    for (const part of chunks(Array.from(S.sess.values()), 200, sessItem)) {
      const sent = part.map((p) => ({ played: p.x.played_ms, edit: p.x.edit_t }));
      const r = await rpc('mygames_put_sessions', { p_vault: S.code, p_items: part.map((p) => p.it) });
      const e = callError(r); if (e) return e;
      const bad = new Map((r.body.refused || []).map((x) => [x.sid, x.error]));
      part.forEach((p, i) => {
        const s = p.x;
        if (bad.get(s.sid) === 'bad_pt_id' && s.pt_id) { s.pt_id = null; persist('s', s.sid, s); return; }   // its playthrough was refused: sent alone next time
        if (bad.has(s.sid)) return;
        if (s.played_ms === sent[i].played && s.edit_t === sent[i].edit) { s.dirty = false; s.sent = s.played_ms; }
        persist('s', s.sid, s);
      });
      noteRefusals((r.body.refused || []).filter((x) => x.error !== 'bad_pt_id'), 'sid', (id) => S.sess.get(id));
    }
    return null;
  }
  const dirtyCount = () => {
    let n = 0;
    for (const s of S.sess.values()) if (s.dirty && !s.refused) n++;
    return n;
  };
  const dirtyAny = () => dirtyCount() > 0 || Array.from(S.games.values()).some((g) => Object.keys(g.dirty || {}).length) || Array.from(S.pts.values()).some((p) => Object.keys(p.dirty || {}).length);

  let _syncWanted = false, _syncT = 0;
  function syncSoon(ms) {
    if (!S.loaded) return;
    clearTimeout(_syncT);
    _syncT = setTimeout(() => { syncNow('soon'); }, ms == null ? 2000 : ms);
  }
  async function syncNow(why) {
    if (!S.loaded || !S.vt) return S.svc;
    if (localOnly()) { S.svc = 'local'; scheduleUi(); return S.svc; }
    if (S.syncing) { _syncWanted = true; return S.svc; }
    S.syncing = true; S.lastTry = now(); clearTimeout(S.retryT);
    let e = null;
    try {
      if (why !== 'push-only') { e = await pull(); if (!e) S.pulled = true; }
      if (!e) { await importRecorder(); e = await push(); }
      if (!e && why !== 'push-only' && dirtyAny() === false) { /* all sent */ }
    } catch (err) { e = 'offline'; }
    S.syncing = false;
    if (!e) {
      S.svc = S.limit === 'full' ? 'full' : 'ok';
      S.retryN = 0;
      if (!dirtyAny()) { S.meta.lastSaved = now(); persistMeta(); }
      if (cardHost() && !cardHost().hidden && document.getElementById('vault-overlay') && document.getElementById('vault-overlay').classList.contains('open')) refreshUsage();
      else if (S.limit) scheduleRetry(3);
    } else {
      S.svc = e === 'no_vault' ? 'novault' : e === 'missing' ? 'missing' : e === 'full' ? 'full' : 'offline';
      scheduleRetry(S.svc === 'offline' ? Math.min(S.retryN++, RETRY.length - 1) : 3);
    }
    scheduleUi();
    if (_syncWanted) { _syncWanted = false; syncSoon(500); }
    return S.svc;
  }
  function scheduleRetry(i) {
    clearTimeout(S.retryT);
    S.retryT = setTimeout(() => syncNow('retry'), RETRY[i]);
  }
  /* Leaving the page: what is not sent yet goes in one call that outlives the page. */
  function sendOnLeave() {
    try {
      if (!S.loaded || localOnly() || !S.code) return;
      const items = []; let size = 40;
      for (const s of S.sess.values()) {
        const it = sessItem(s); if (!it || it.pt_id) continue;
        const n = JSON.stringify(it).length + 1;
        if (size + n > 58000 || items.length >= 200) break;
        items.push(it); size += n;
      }
      if (items.length) rpc('mygames_put_sessions', { p_vault: S.code, p_items: items }, { keepalive: true });
      flushNow();
    } catch (e) {}
  }

  /* ------------------------------------------------------------ owned and wishlist tiles (brief 7) */
  const _ownDev = new Map();   // anchor -> device object (kept, so the tables' look-ups stay cheap)
  let _ownMemo = null;
  function playableDev(d) {
    try {
      const c = d.catalogue;
      if (c === 'nes') return typeof nesPlayable === 'function' && nesPlayable(d);   // eslint-disable-line no-undef
      if (c === 'game-boy') return typeof gbPlayable === 'function' && gbPlayable(d);   // eslint-disable-line no-undef
      if (c === 'pokemon-mini') return typeof pmPlayable === 'function' && pmPlayable(d);   // eslint-disable-line no-undef
      if (glob(() => ATARI_SYSTEMS[c])) return typeof atariPlayable === 'function' && atariPlayable(d);   // eslint-disable-line no-undef
      if (glob(() => TFT_TWIN_UNITS[d.id])) return typeof tftAvailable === 'function' ? tftAvailable(d) : false;   // eslint-disable-line no-undef
      if (glob(() => GNW_EMULATED_GAMES[d.id])) return typeof gnwAvailable === 'function' ? gnwAvailable(d) : false;   // eslint-disable-line no-undef
      if (d.id === 'prototype-tetris-jr') return true;
    } catch (e) {}
    return false;
  }
  /* The game server shelf (GAME_SYSTEMS id) a device sits on. */
  function shelfOfDev(d) {
    const c = d.catalogue;
    if (c === 'nes') return d.nesConsole || 'nes';
    if (c === 'game-boy') return d.system === 'gbc' ? 'gbc' : 'gb';
    if (c === 'pokemon-mini') return 'pm';
    if (glob(() => TFT_TWIN_UNITS[d.id])) return 'twin';
    if (d.id === 'prototype-tetris-jr') return 'tj';
    if (glob(() => ATARI_SYSTEMS[c])) return c;
    return 'gnw';
  }
  function buildOwnedDevice(anchor, title) {
    if (_ownDev.has(anchor)) { const d = _ownDev.get(anchor); if (title && !d.__realName) d.name = d.fullName = title; return d; }
    let d = null;
    if (anchor[0] === 'd') {
      const id = anchor.slice(2);
      d = allDevices().find((x) => x.id === id) || null;
      if (d) { _ownDev.set(anchor, d); return d; }
      return null;
    }
    const [, p, h] = anchor.split(':'), cat = PREFIX_CAT[p];
    if (!cat) return null;
    if (cat === 'pokemon-mini') {
      const pmList = glob(() => POKEMON_MINI) || [];   // eslint-disable-line no-undef
      const hit = pmList.find((x) => { try { const e = V() && V().info(x); return e && e.sha && e.sha.slice(0, 12) === h; } catch (e) { return false; } });
      if (hit) { _ownDev.set(anchor, hit); return hit; }
    }
    let shelf = null;
    try { const e = V() && V().info(fakeDev(p, h)); shelf = e && e.shelf; } catch (e) {}
    const name = title || 'Game';
    const base = { id: 'mg-' + p + '-x' + h, catalogue: cat, name, fullName: name, developer: '-', genre: '-', players: '-', released: '', features: [], regions: [],
      description: '', additional: '', promo: '', mgAnchor: anchor, mgTile: true, __realName: false };
    if (cat === 'nes') {
      const c = shelf === 'famicom' || shelf === 'fds' ? shelf : 'nes';
      Object.assign(base, { system: 'nes', nesConsole: c, series: (glob(() => NES_CONSOLE_SERIES) || {})[c] || 'nes', img: (glob(() => NES_CONSOLE_ART) || {})[c] || 'NesConsole.png', cartridge: '-' });   // eslint-disable-line no-undef
    } else if (cat === 'game-boy') {
      const gbc = shelf === 'gbc';
      Object.assign(base, { series: gbc ? 'game-boy-color' : 'game-boy', system: gbc ? 'gbc' : 'gb', compatible: 'dmg', cartridge: '-' });
      try { if (typeof _gbConsoleArt === 'function') d = _gbConsoleArt(base); } catch (e) {}   // eslint-disable-line no-undef
    } else if (cat === 'pokemon-mini') {
      Object.assign(base, { series: 'pokemon-mini', cartridge: '-' });
    } else {
      const t = glob(() => ATARI_SYSTEMS[cat]);   // eslint-disable-line no-undef
      if (!t) return null;
      Object.assign(base, { series: t.series, system: cat, img: t.art, cartridge: '-' });
    }
    d = d || base;
    _ownDev.set(anchor, d);
    return d;
  }
  /* For each game kept as owned or on the wishlist: its tile, unless a real one is on the wall. */
  function ownedTiles() {
    const all = allDevices(), vv = V() ? V().version : 0;
    const sig = S.ver + ':' + all.length + ':' + vv + ':' + Math.floor(now() / 3000);
    if (_ownMemo && _ownMemo.sig === sig) return _ownMemo;
    const m = byKey(), want = new Map();
    for (const [k, recs] of m.games) {
      const v = view(k);
      if (!v.owned && !v.wish) continue;
      want.set(k, v);
    }
    const present = new Set();
    if (want.size) {
      for (const d of all) {
        if (!d || d.mgTile) continue;
        let k = null; try { k = keyOfDevice(d); } catch (e) {}
        if (k && want.has(k) && !present.has(k) && playableDev(d)) present.add(k);
      }
    }
    const out = new Map(), ids = new Set();
    for (const [k, v] of want) {
      if (present.has(k)) continue;
      const rec = v.recs.find((r) => r.owned) || v.recs[0];
      const d = buildOwnedDevice(rec.anchor, v.title || rec.title);
      if (!d) continue;
      if (playableDev(d) && !d.mgTile) continue;   // a built-in title that is on the wall after all
      d.mgOwned = v.owned; d.mgWish = v.wish && !v.owned;
      out.set(d.id, { d, k, shelf: shelfOfDev(d) });
      ids.add(d.id);
    }
    // Into ALL_DEVICES while shown (the drawer and search find tiles there), out again when not.
    for (const [, d] of _ownDev) {
      if (!ids.has(d.id)) { d.mgOwned = false; d.mgWish = false; }
      if (!d.mgTile) continue;
      const i = all.indexOf(d);
      if (ids.has(d.id) && i < 0) all.push(d);
      else if (!ids.has(d.id) && i >= 0) all.splice(i, 1);
    }
    _ownMemo = { sig: S.ver + ':' + all.length + ':' + vv + ':' + Math.floor(now() / 3000), tiles: out };
    return _ownMemo;
  }
  /* emby.js: a shelf's raw pool, with the owned and wishlist tiles of that shelf added. */
  function extend(sysId, list) {
    try {
      if (!S.loaded) return list;
      const t = ownedTiles().tiles;
      if (!t.size) return list;
      const have = new Set((list || []).map((d) => d && d.id));
      const add = [];
      for (const x of t.values()) if (x.shelf === sysId && !have.has(x.d.id)) add.push(x.d);
      return add.length ? (list || []).concat(add) : list;
    } catch (e) { return list; }
  }
  const isOwnedTile = (d) => { try { return !!(d && ownedTiles().tiles.has(d.id)); } catch (e) { return false; } };

  /* ------------------------------------------------------------ the wall's filter and sorts */
  const FILTER_DEF = { show: [], noFile: true, wish: true, len: 'any' };
  let _filter = null;
  function filter() {
    if (_filter && _filter.vt === S.vt) return _filter;
    let f = null; try { f = JSON.parse(lsGet('filter.' + (S.vt || 'local')) || 'null'); } catch (e) {}
    f = Object.assign({}, FILTER_DEF, f || {});
    if (!Array.isArray(f.show)) f.show = [];
    f.vt = S.vt;
    _filter = f;
    return f;
  }
  function setFilter(patch) {
    const f = Object.assign({}, filter(), patch);
    if (!f.show.includes('backlog')) f.len = 'any';
    _filter = f;
    lsSet('filter.' + (S.vt || 'local'), JSON.stringify({ show: f.show, noFile: f.noFile, wish: f.wish, len: f.len }));
    S.ver++; _viewMemo = null;
    for (const fn of listeners) { try { fn('filter'); } catch (e) {} }
  }
  /* How long a game takes, for the length filter (4.4): your finished playthrough, then IGDB's Normal, then Rushed (21 Nov 2026: no guess any more). */
  const _igdb = new Map();   // key -> [rushed, normal, completionist, n, slug] | null
  function igdbFor(d, k) {
    if (_igdb.has(k)) return _igdb.get(k);
    _igdb.set(k, undefined);
    try {
      if (window.GameMeta && GameMeta.playTimes) GameMeta.playTimes(d).then((row) => { _igdb.set(k, row || null); if (filter().len !== 'any') { S.ver++; for (const fn of listeners) { try { fn('filter'); } catch (e) {} } } }, () => _igdb.set(k, null));
    } catch (e) { _igdb.set(k, null); }
    return undefined;
  }
  function finishedLength(v) {
    let best = 0;
    for (const p of v.pts) {
      if (!p.finished_on) continue;
      const t = v.sessions.filter((s) => s.pt_id === p.pt_id).reduce((a, s) => a + s.played_ms, 0) / 1000;
      if (t > best) best = t;
    }
    return best;
  }
  function lengthOf(d, v) {
    const fin = finishedLength(v);
    if (fin > 0) return { sec: fin, src: 'yours' };
    const row = igdbFor(d, v.key);
    if (row && row[1] > 0) return { sec: row[1], src: 'igdb' };
    if (row && row[0] > 0) return { sec: row[0], src: 'igdb-rushed' };
    return { sec: 0, src: row === undefined ? 'waiting' : 'none' };
  }
  function shown(d) {
    try {
      if (!d) return true;
      const f = filter();
      const own = d.mgTile || isOwnedTile(d);
      if (own) {
        if (d.mgWish && !f.wish) return false;
        if (d.mgOwned && !f.noFile) return false;
        if (!d.mgWish && !d.mgOwned) { /* a built-in owned unit */ if (!f.noFile) return false; }
      }
      if (!f.show.length) return true;
      const k = keyOfDevice(d), v = view(k);
      const hit = f.show.some((s) => (s === 'fav' ? v.favourite : v.status === s));
      if (!hit) return false;
      if (f.show.includes('backlog') && f.len !== 'any') {
        const L = lengthOf(d, v);
        if (f.len === 'none') return L.src === 'none' || L.src === 'waiting';
        if (!L.sec) return false;
        return L.sec <= (+f.len) * 3600;
      }
      return true;
    } catch (e) { return true; }
  }
  const filterActive = () => { const f = filter(); return f.show.length > 0 || !f.noFile || !f.wish; };
  function chips() {
    const f = filter(), out = [];
    for (const s of f.show) out.push({ id: 'mg:' + s, label: s === 'fav' ? 'Favourites' : STATUS_WORD[s] });
    if (f.show.includes('backlog') && f.len !== 'any') out.push({ id: 'mg:len', label: f.len === 'none' ? 'No time known' : 'Under ' + f.len + ' h' });
    if (!f.noFile) out.push({ id: 'mg:noFile', label: 'Games without a file off' });
    if (!f.wish) out.push({ id: 'mg:wish', label: 'Wishlist games off' });
    return out;
  }
  function removeChip(id) {
    const v = id.slice(3), f = filter();
    if (v === 'len') setFilter({ len: 'any' });
    else if (v === 'noFile') setFilter({ noFile: true });
    else if (v === 'wish') setFilter({ wish: true });
    else setFilter({ show: f.show.filter((x) => x !== v) });
  }
  const clearFilter = () => setFilter({ show: [], noFile: true, wish: true, len: 'any' });
  function toggleFilter(key) {
    const f = filter();
    if (key === 'noFile') setFilter({ noFile: !f.noFile });
    else if (key === 'wish') setFilter({ wish: !f.wish });
    else if (/^len:/.test(key)) setFilter({ len: key.slice(4) });
    else setFilter({ show: f.show.includes(key) ? f.show.filter((x) => x !== key) : f.show.concat(key) });
  }
  /* The counts in the panel: how many of each are on the wall now. */
  function counts() {
    const out = { fav: 0, noFile: 0, wish: 0, none: 0 };
    for (const [k] of byKey().games) {
      const v = view(k);
      if (v.status) out[v.status] = (out[v.status] || 0) + 1;
      if (v.favourite) out.fav++;
    }
    for (const x of ownedTiles().tiles.values()) { if (x.d.mgWish) out.wish++; else out.noFile++; }
    return out;
  }
  function filterColHTML() {
    const f = filter(), c = counts();
    const box = (key, on, label, n, extra) => `<button type="button" role="menuitemcheckbox" class="vtb-item fp-kind mg-fk${on ? ' active' : ''}" data-mg-f="${key}" aria-checked="${on}"${extra || ''}><span class="vmf-box" aria-hidden="true"></span><span class="vtb-lbl">${esc(label)}</span>${n != null ? `<i class="mg-fn">${n ? n.toLocaleString('en-AU') : ''}</i>` : ''}</button>`;
    const radio = (key, label) => { const on = f.len === key; return `<button type="button" role="menuitemradio" class="vtb-item mg-fk${on ? ' active' : ''}" data-mg-f="len:${key}" aria-checked="${on}"><span class="vtb-tick" aria-hidden="true"></span><span class="vtb-lbl">${esc(label)}</span></button>`; };
    let html = '<div class="fp-h">My games</div><div class="fp-sub">Show</div>'
      + STATUSES.map(([k, w]) => box(k, f.show.includes(k), w, c[k] || 0)).join('')
      + box('fav', f.show.includes('fav'), 'Favourites', c.fav);
    if (f.show.includes('backlog')) {
      // "No time known" is always listed with its count, so nothing drops out silently.
      let none = 0;
      for (const [k] of byKey().games) { const v = view(k); if (v.status !== 'backlog') continue; const d = deviceForKey(k); const L = d ? lengthOf(d, v) : { src: 'none' }; if (L.src === 'none' || L.src === 'waiting') none++; }
      html += '<div class="fp-sub">Length</div>' + radio('1', 'Under 1 h') + radio('3', 'Under 3 h') + radio('10', 'Under 10 h') + radio('any', 'Any length')
        + `<button type="button" role="menuitemradio" class="vtb-item mg-fk${f.len === 'none' ? ' active' : ''}" data-mg-f="len:none" aria-checked="${f.len === 'none'}"><span class="vtb-tick" aria-hidden="true"></span><span class="vtb-lbl">No time known</span><i class="mg-fn">${none.toLocaleString('en-AU')}</i></button>`;
    }
    html += '<div class="fp-sub">Tiles</div>' + box('noFile', f.noFile, 'Games without a file', c.noFile) + box('wish', f.wish, 'Wishlist games', c.wish)
      + '<p class="fp-tip">Ticks in Show combine as any of them. Games without a file are games you own that have no game file here yet; they have no Play button.</p>';
    return html;
  }
  /* A device for a game key: its tile on the wall, else its owned tile, else a stand-in from its anchor. */
  function deviceForKey(k) {
    for (const x of ownedTiles().tiles.values()) if (x.k === k) return x.d;
    const recs = byKey().games.get(k) || [];
    const a = recs.length ? recs[0].anchor : null;
    if (!a) return null;
    if (a[0] === 'f') { const p = a.split(':'); return fakeDev(p[1], p[2]); }
    return allDevices().find((x) => x.id === a.slice(2)) || null;
  }
  function sortValue(d, mode) {
    try {
      const v = view(keyOfDevice(d));
      if (mode === 'last') return v.lastPlayed || 0;
      if (mode === 'time') return v.playMs || 0;
      if (mode === 'myrating') return v.rating || 0;
    } catch (e) {}
    return 0;
  }

  /* ------------------------------------------------------------ marks on tiles (4.3) */
  const HEART = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.2 5.2 3 1.6-1.8 3.1-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z" fill="currentColor"/></svg>';
  const RIBBON = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M7 2h10v20l-5-4-5 4z" fill="currentColor"/></svg>';
  function marksFor(d) {
    const out = [];
    const k = keyOfDevice(d); if (!k) return out;
    const v = view(k);
    const tile = d.mgTile || isOwnedTile(d);
    if (v.favourite) out.push({ cls: 'mg-m-fav', html: HEART, label: 'In favourites' });
    if (v.wish) out.push({ cls: 'mg-m-wish', html: RIBBON + '<span>Wish</span>', label: 'On your wishlist' });
    if (v.status && v.status !== 'wishlist') out.push({ cls: 'mg-m-st', html: '<span>' + esc(STATUS_WORD[v.status]) + '</span>', label: STATUS_WORD[v.status] });
    if (tile && v.owned) out.push({ cls: 'mg-m-own', html: '<span>No game file</span>', label: 'No game file' });
    return out;
  }
  function decorateCard(card) {
    const id = card.getAttribute('data-id'); if (!id) return;
    const d = devById(id);
    const old = card.querySelector(':scope > .mg-marks');
    const marks = d ? marksFor(d) : [];
    const sig = marks.map((m) => m.cls + m.label).join('|');
    if (old && old.dataset.sig === sig) return;
    if (old) old.remove();
    const base = card.dataset.mgLabel || card.getAttribute('aria-label') || '';
    if (!card.dataset.mgLabel) card.dataset.mgLabel = base;
    if (!marks.length) { if (card.getAttribute('aria-label') !== base) card.setAttribute('aria-label', base); return; }
    const el = document.createElement('span');
    el.className = 'mg-marks'; el.dataset.sig = sig; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = marks.map((m) => `<span class="mg-m ${m.cls}" title="${esc(m.label)}">${m.html}</span>`).join('');
    card.appendChild(el);
    card.setAttribute('aria-label', base + ', ' + marks.map((m) => m.label).join(', '));
  }
  let _devIdx = null;
  function devById(id) {
    const all = allDevices();
    if (!_devIdx || _devIdx.n !== all.length) { _devIdx = { n: all.length, m: new Map() }; for (const d of all) if (d && d.id) _devIdx.m.set(d.id, d); }
    return _devIdx.m.get(id) || null;
  }
  let _decoT = 0;
  function decorateAll() {
    _decoT = 0;
    if (!S.loaded) return;
    document.querySelectorAll('#video-grid .device-card[data-id], #device-modal .device-card[data-id]').forEach(decorateCard);
  }
  const decorateSoon = () => { if (!_decoT) _decoT = requestAnimationFrame(decorateAll); };
  function watchGrid() {
    try {
      new MutationObserver((recs) => {
        for (const r of recs) for (const n of r.addedNodes) {
          if (n.nodeType !== 1) continue;
          if ((n.matches && n.matches('.device-card[data-id]')) || (n.querySelector && n.querySelector('.device-card[data-id]'))) { decorateSoon(); return; }
        }
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }

  /* ------------------------------------------------------------ the drawer (4.2) */
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>';
  let _openD = null;
  const _open = new Set(), _closed = new Set(), _more = new Map();   // which session lists are open, and how far down
  function drawerHTML(d) {
    if (!d) return '';
    _openD = d;
    const k = keyOfDevice(d);
    if (!k) return (typeof playTimeSectionHTML === 'function') ? playTimeSectionHTML(d) : '';   // eslint-disable-line no-undef
    return `<section class="sect mg-sect" data-mg-for="${esc(d.id)}" aria-label="My games">${sectionInner(d, k)}</section>`;
  }
  function sectionInner(d, k) {
    const v = view(k), tile = d.mgTile || isOwnedTile(d);
    const secs = Math.round(v.playMs / 1000);
    const n = v.sessions.length;
    let h = '<h3 class="sect-h"><button type="button" class="sect-tog" data-sect-kind="mygames" aria-expanded="true">My games</button></h3>';
    if (tile && v.owned) h += '<p class="mg-note">You own this game. When its game file is on one of your game servers, it plays here.</p>';
    else if (tile && v.wish) h += '<p class="mg-note">On your wishlist.</p>';
    // 1. Play time: the game's total over every version and every device (the sessions in My games).
    h += `<div class="drawer-playtime mg-pt${secs > 0 ? ' has-time' : ''}"><div class="dpt-value">${fmtClock(secs)}</div><div class="dpt-units"><span>days</span><span>hrs</span><span>min</span><span>sec</span></div>`
      + `<div class="dpt-note">${secs > 0 ? esc([v.lastPlayed ? 'Last played ' + ago(v.lastPlayed) : '', n ? plural(n, 'session') : ''].filter(Boolean).join(' · ') || 'Counted only while you are actually playing.') : (tile ? 'Not played here yet.' : 'Not played yet. The clock starts when you do.')}</div></div>`;
    // 2. Status.
    h += '<div class="mg-h">Status</div><div class="mg-row" role="group" aria-label="Status">'
      + STATUSES.map(([s, w]) => `<button type="button" class="mg-b${v.status === s ? ' on' : ''}" data-mg="status" data-mg-v="${s}" aria-pressed="${v.status === s}">${w}</button>`).join('')
      + `<button type="button" class="mg-b mg-clear" data-mg="status" data-mg-v=""${v.status ? '' : ' disabled'}>Clear</button></div>`;
    if (v.status === 'playing' && v.statusAuto) h += '<p class="mg-small">Set to Playing when you first played it here.</p>';
    // 3. Completion (Endless first for score games).
    const comps = SCORE_CATS.has(shelfOfDev(d)) ? [COMPLETIONS[2], COMPLETIONS[0], COMPLETIONS[1]] : COMPLETIONS;
    h += '<div class="mg-h">Completion</div><div class="mg-row" role="group" aria-label="Completion">'
      + comps.map(([c, w]) => `<button type="button" class="mg-b${v.completion === c ? ' on' : ''}" data-mg="completion" data-mg-v="${c}" aria-pressed="${v.completion === c}">${w}</button>`).join('') + '</div>';
    // 4. Rating (the favourite is the heart beside Manual, favButtonHTML).
    const r = v.rating || 0;
    h += '<div class="mg-h">Rating</div><div class="mg-row mg-rate-row">'
      + `<button type="button" class="mg-rate" data-mg="rate" aria-label="${esc(r ? 'Your rating: ' + (r / 2) + ' of 5 stars. Left and Right change it.' : 'Not rated. Right gives half a star.')}">`
      + [1, 2, 3, 4, 5].map((i) => { const full = r >= i * 2, half = !full && r === i * 2 - 1; return `<span class="mg-star${full ? ' full' : half ? ' half' : ''}" data-i="${i}">${STAR}${half ? `<span class="mg-halfc">${STAR}</span>` : ''}</span>`; }).join('')
      + `<span class="mg-rate-n">${r ? (r / 2).toString() : ''}</span></button>`
      + `<button type="button" class="mg-b mg-clear" data-mg="rate-clear"${r ? '' : ' disabled'}>Clear</button></div>`;
    // 5. How long it takes: your finished playthroughs (shown only when there is one; IGDB's times are in the green panel).
    const fin = finishedLength(v);
    if (fin) h += '<div class="mg-h">How long it takes</div><div class="mg-len">'
      + `<div class="mg-lr"><span>Your finished playthroughs</span><span>${esc(fmtLen(fin))}</span></div></div>`;
    // 6. Playthroughs, each with its sessions (a journal, newest first), then the sessions in none of them.
    h += '<div class="mg-h">Playthroughs</div>';
    const ptIds = new Set(v.pts.map((p) => p.pt_id));
    const newestFirst = (list) => list.slice().sort((a, b) => b.started - a.started);
    const sessList = (key, list) => {
      if (!_open.has(key)) return '';
      const shown = _more.get(key) || 10;
      let s = '<ul class="mg-diary">' + list.slice(0, shown).map((x) => {
        const bits = sessionWhere(x);
        return `<li class="mg-ses"><div class="mg-sl"><b>${esc(dateText(x.started))}, ${esc(fmtLen(x.played_ms / 1000))}</b>${bits ? `<span>${esc(bits)}</span>` : ''}`
          + `${x.source === 'manual' ? '<span class="mg-tag">added by hand</span>' : x.edited ? '<span class="mg-tag">edited</span>' : ''}</div>`
          + `<div class="mg-row"><button type="button" class="mg-b" data-mg="s-fix" data-mg-v="${x.sid}">Fix</button><button type="button" class="mg-b mg-del" data-mg="s-remove" data-mg-v="${x.sid}">Remove</button></div></li>`;
      }).join('') + '</ul>';
      if (list.length > shown) s += `<div class="mg-row"><button type="button" class="mg-b" data-mg="s-more" data-mg-v="${esc(key)}">Show ${Math.min(20, list.length - shown)} more of ${list.length - shown}</button></div>`;
      return s;
    };
    const toggle = (key, count) => count ? `<button type="button" class="mg-b mg-tog" data-mg="sessions" data-mg-v="${esc(key)}" aria-expanded="${_open.has(key)}">${_open.has(key) ? 'Hide sessions' : 'Show ' + plural(count, 'session')}</button>` : '';
    if (v.pts.length) {
      h += '<div class="mg-pts">' + v.pts.slice().reverse().map((p) => {
        const ps = newestFirst(v.sessions.filter((s) => s.pt_id === p.pt_id)), pt = ps.reduce((a, s) => a + s.played_ms, 0) / 1000;
        const when = [p.started_on ? dayText(p.started_on) : '', p.finished_on ? dayText(p.finished_on) : (p.started_on ? 'now' : '')].filter(Boolean).join(' to ');
        const bits = [when, p.completion ? COMPLETION_WORD[p.completion] : '', pt ? fmtLen(pt) : '', ps.length ? plural(ps.length, 'session') : 'no sessions yet'].filter(Boolean).join(', ');
        return `<div class="mg-ptr" data-pt="${esc(p.pt_id)}"><div class="mg-ptl"><b>${esc(p.label || 'Playthrough')}</b><span>${esc(bits)}</span></div>`
          + (p.note ? `<p class="mg-ptn">${esc(p.note)}</p>` : '')
          + `<div class="mg-row">${toggle(p.pt_id, ps.length)}<button type="button" class="mg-b" data-mg="pt-note" data-mg-v="${esc(p.pt_id)}">${p.note ? 'Edit note' : 'Add a note'}</button>`
          + (p.finished_on ? `<button type="button" class="mg-b" data-mg="pt-reopen" data-mg-v="${esc(p.pt_id)}">Not finished</button>` : `<button type="button" class="mg-b" data-mg="pt-finish" data-mg-v="${esc(p.pt_id)}">Finished</button>`)
          + `<button type="button" class="mg-b" data-mg="pt-edit" data-mg-v="${esc(p.pt_id)}">Change</button>`
          + `<button type="button" class="mg-b mg-del" data-mg="pt-remove" data-mg-v="${esc(p.pt_id)}">Remove</button></div>`
          + sessList(p.pt_id, ps) + '</div>';
      }).join('') + '</div>';
    }
    const others = newestFirst(v.sessions.filter((s) => !s.pt_id || !ptIds.has(s.pt_id)));
    if (others.length) {
      if (!v.pts.length && !_open.has('other') && !_closed.has('other')) _open.add('other');
      const ot = others.reduce((a, s) => a + s.played_ms, 0) / 1000;
      h += `<div class="mg-ptr mg-other"><div class="mg-ptl"><b>${v.pts.length ? 'Other sessions' : 'Sessions'}</b><span>${esc([fmtLen(ot), plural(others.length, 'session')].join(', '))}</span></div>`
        + `<div class="mg-row">${toggle('other', others.length)}</div>` + sessList('other', others) + '</div>';
    }
    if (!v.pts.length && !others.length) h += '<p class="mg-small">None yet. Every session of 30 seconds or more that you play here is written in by itself; a playthrough groups your sessions from start to finish, with one note.</p>';
    h += '<div class="mg-row"><button type="button" class="mg-b" data-mg="pt-new">Start a new playthrough</button><button type="button" class="mg-b" data-mg="s-add">Add a session</button>'
      + `<button type="button" class="mg-b mg-del" data-mg="g-remove"${hasData(v) ? '' : ' hidden'}>Clear My games data</button></div>`;
    h += `<p class="mg-small mg-where">${esc(whereLine())}</p>`;
    return h;
  }
  /* THE FAVOURITE HEART (21 Nov 2026): a heart button right of the drawer's Manual button (where Manual would be, if the game has none).
     Outline: not a favourite; filled: a favourite. */
  /* The line under a session: where it was played, then which release, briefly (21 Nov 2026): "Game Boy Advance · USA,
     Rev 1". Tags that say what a cartridge works with (SGB Enhanced, GB Compatible) are not a release and are left out;
     the stored record is not changed. */
  const FEATURE_TAG = /^(SGB Enhanced|GB Compatible|CGB Enhanced|SGB Compatible)$/i;
  function shortVersion(v) {
    if (!v) return '';
    return String(v).split(/\s*·\s*/).map((x) => x.trim()).filter((x) => x && !FEATURE_TAG.test(x)).join(', ');
  }
  function sessionWhere(x) { return [x.machine || '', shortVersion(x.version)].filter(Boolean).join(' · '); }
  /* Data to clear: anything My games holds for this game. Clear My games data shows only then. */
  function hasData(v) { return !!(v.status || v.completion || v.favourite || v.rating || v.owned || v.wish || v.pts.length || v.sessions.length); }
  function favButtonHTML(d) {
    try {
      const k = keyOfDevice(d); if (!k) return '';
      const on = view(k).favourite, lab = on ? 'In favourites' : 'Add to favourites';
      return savedButtonHTML(d) + `<button type="button" class="mg-favpill${on ? ' on' : ''}" data-mg-fav="${esc(d.id)}" aria-pressed="${on}" aria-label="${lab}" title="${lab}">${HEART}</button>`;
    } catch (e) { return ''; }
  }
  /* SAVE IN THIS BROWSER (21 Nov 2026): the same switch as the play window's Settings, Machine, Pre-load on device
     (preload.js: the game's file kept in this browser so it starts with no wait; 20 games at most). Shown only where that
     switch is offered (a game a joined game server lists). It works as the heart does (21 Nov 2026): the same round button, outline
     when off and filled when on, both in the accent chosen in Settings, the same focus ring, and it changes the moment it is pressed. No
     message when it works, as with the heart; only a refusal (20 games already kept) says why. */
  const SAVE_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M10 3.5h4v6.5h3.5L12 15.5 6.5 10H10z"/><path d="M3.5 15.5v3a2.5 2.5 0 0 0 2.5 2.5h12a2.5 2.5 0 0 0 2.5-2.5v-3"/></svg>';
  const PL = () => window.CwPreload || null;
  let _saveWant = null;   // { id, on } while the browser is still keeping (or dropping) the file: the button shows the wish
  function savedOn(id) { try { const s = PL().state(id); return !!(s && s.on); } catch (e) { return false; } }
  function savedShown(id) { return _saveWant && _saveWant.id === id ? _saveWant.on : savedOn(id); }
  function savedApplies(id) { try { return !!(PL() && PL().applies(id)); } catch (e) { return false; } }
  function savedButtonHTML(d) {
    if (!d || !savedApplies(d.id)) return '';
    const on = savedOn(d.id), lab = on ? 'Saved in this browser' : 'Save in this browser';
    return `<button type="button" class="mg-savepill${on ? ' on' : ''}" data-mg-save="${esc(d.id)}" aria-pressed="${on}" aria-label="${lab}" title="${lab}">${SAVE_ICON}</button>`;
  }
  function paintSaved() {
    const b = document.querySelector('#device-modal .mg-savepill'); if (!b) return;
    const id = b.getAttribute('data-mg-save'), on = savedShown(id), lab = on ? 'Saved in this browser' : 'Save in this browser';
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', lab); b.title = lab;
  }
  async function toggleSaved(id) {
    const P = PL(); if (!P) return;
    const want = !savedShown(id), mine = { id, on: want };
    _saveWant = mine; paintSaved();   // at once, as the heart does; put right below if the browser refuses
    try {
      const r = await P.set(id, want);
      if (_saveWant === mine) _saveWant = null;
      if (r && r.ok === false && r.full) toast(r.max + ' of ' + r.max + ' games are already saved in this browser. Turn one off in its play window, Settings, Machine, Pre-load on device.');
    } catch (e) { if (_saveWant === mine) _saveWant = null; }
    paintSaved();
  }
  function paintFav() {
    const b = document.querySelector('#device-modal .mg-favpill'); if (!b) return;
    const d = devById(b.getAttribute('data-mg-fav')) || _openD; if (!d) return;
    const on = view(keyOfDevice(d)).favourite, lab = on ? 'In favourites' : 'Add to favourites';
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', lab); b.title = lab;
    const c = document.querySelector('#device-modal .mg-sect [data-mg="g-remove"]');
    if (c) c.hidden = !hasData(view(keyOfDevice(d)));
    paintSaved();
  }
  function whereLine() {
    if (!storageOk && localOnly()) return 'This browser cannot keep My games (its storage is blocked).';
    if (localOnly()) return 'Kept in this browser only.';
    if (S.svc === 'ok' && !dirtyAny()) return 'Kept in your vault.';
    return 'Kept in this browser; saved to your vault when it can be reached.';
  }
  function repaintDrawer() {
    const sec = document.querySelector('#device-modal .mg-sect');
    if (!sec || !_openD || sec.getAttribute('data-mg-for') !== _openD.id) return;
    const a = document.activeElement, had = a && sec.contains(a);
    const sel = had ? (a.dataset.mg ? `[data-mg="${a.dataset.mg}"]` + (a.dataset.mgV != null ? `[data-mg-v="${CSS.escape(a.dataset.mgV)}"]` : '') : null) : null;
    const k = keyOfDevice(_openD);
    sec.innerHTML = sectionInner(_openD, k);
    if (had) {
      const t = (sel && sec.querySelector(sel)) || sec.querySelector('[data-mg]:not([disabled])');
      if (t) { try { t.focus({ preventScroll: true }); } catch (e) {} }
    }
  }
  function currentDrawerDev() {
    const sec = document.querySelector('#device-modal .mg-sect');
    if (!sec) return null;
    const id = sec.getAttribute('data-mg-for');
    return (_openD && _openD.id === id) ? _openD : devById(id);
  }
  function onDrawerClick(e) {
    const sb = e.target && e.target.closest && e.target.closest('#device-modal .mg-savepill');
    if (sb) { e.preventDefault(); toggleSaved(sb.getAttribute('data-mg-save')); return; }
    const fb = e.target && e.target.closest && e.target.closest('#device-modal .mg-favpill');
    if (fb) {
      e.preventDefault();
      const d = devById(fb.getAttribute('data-mg-fav')) || _openD; if (!d) return;
      const k = keyOfDevice(d), v = view(k);
      setGameFields(k, { favourite: !v.favourite }, { anchor: (v.recs[0] && v.recs[0].anchor) || anchorOfDevice(d), title: d.name });
      paintFav();
      return;
    }
    const b = e.target && e.target.closest && e.target.closest('#device-modal .mg-sect [data-mg]');
    if (!b || b.disabled) return;
    const d = currentDrawerDev(); if (!d) return;
    _openD = d;
    const k = keyOfDevice(d), a = anchorOfDevice(d), v = view(k), act = b.dataset.mg, val = b.dataset.mgV;
    const opts = { anchor: (v.recs[0] && v.recs[0].anchor) || a, title: d.name };
    e.preventDefault();
    if (act === 'status') setGameFields(k, { status: val || null, status_auto: false }, opts);
    else if (act === 'completion') setGameFields(k, { completion: v.completion === val ? null : val }, opts);
    else if (act === 'fav') setGameFields(k, { favourite: !v.favourite }, opts);
    else if (act === 'rate') {
      const star = e.target.closest('.mg-star');
      if (star) {
        const i = +star.dataset.i, rc = star.getBoundingClientRect(), half = (e.clientX || 0) < rc.left + rc.width / 2;
        const nv = i * 2 - (half ? 1 : 0);
        setGameFields(k, { rating: v.rating === nv ? null : nv }, opts);
      }
    }
    else if (act === 'rate-clear') setGameFields(k, { rating: null }, opts);
    else if (act === 'pt-new') ptDialog(k, null, opts, v);
    else if (act === 'pt-edit') ptDialog(k, S.pts.get(val), opts, v);
    else if (act === 'pt-note') noteDialog(S.pts.get(val));
    else if (act === 'pt-finish') { const p = S.pts.get(val); if (p) setPt(p, { finished_on: isoDay(now()) }); }
    else if (act === 'pt-reopen') { const p = S.pts.get(val); if (p) setPt(p, { finished_on: null }); }
    else if (act === 'pt-remove') { const p = S.pts.get(val); if (p) { const undo = removePt(p); toast('Playthrough removed.', undo); } }
    else if (act === 's-fix') sessionDialog(k, S.sess.get(val), opts, v);
    else if (act === 's-remove') { const s = S.sess.get(val); if (s) { const undo = removeSession(s); toast('Session removed.', undo); } }
    else if (act === 's-more') { _more.set(val, (_more.get(val) || 10) + 20); repaintDrawer(); }
    else if (act === 'sessions') { if (_open.has(val)) { _open.delete(val); _closed.add(val); } else { _open.add(val); _closed.delete(val); } repaintDrawer(); }
    else if (act === 's-add') sessionDialog(k, null, opts, v);
    else if (act === 'g-remove') removeGameDialog(d, k);
  }
  /* Left and Right on the rating move it by half a star (a pad's D-pad, a remote's arrows). */
  function onDrawerKey(e) {
    const b = e.target && e.target.closest && e.target.closest('#device-modal .mg-rate');
    if (!b || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    const d = currentDrawerDev(); if (!d) return;
    e.preventDefault(); e.stopPropagation();
    const k = keyOfDevice(d), v = view(k), r = v.rating || 0;
    const nv = Math.max(0, Math.min(10, r + (e.key === 'ArrowRight' ? 1 : -1)));
    if (nv === r) return;
    setGameFields(k, { rating: nv || null }, { anchor: (v.recs[0] && v.recs[0].anchor) || anchorOfDevice(d), title: d.name });
  }

  /* ------------------------------------------------------------ dialogs (one layer, the site's look) */
  function topZ() {
    let top = 150;
    try { document.querySelectorAll('.overlay.open, [role="dialog"]').forEach((o) => { const z = parseInt(getComputedStyle(o).zIndex, 10); if (z > top && z < 100000) top = z; }); } catch (e) {}
    return top;
  }
  function dialog(o) {
    const el = document.createElement('div');
    el.className = 'overlay open cws-overlay mg-dlg';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', o.title);
    el.style.zIndex = String(topZ() + 10);
    el.innerHTML = `<div class="modal" style="max-width:${o.wide ? 620 : 480}px; margin-top:8vh;"><div class="modal-head"><div><div class="modal-sub">${esc(o.sub || 'My games')}</div><div class="modal-title">${esc(o.title)}</div></div>`
      + '<button class="modal-close" aria-label="Close" data-cws-action="close">×</button></div>'
      + `<div class="mg-dlg-body" style="padding:16px 22px 6px;">${o.html || ''}</div><div class="mg-dlg-msg" role="status"></div>`
      + '<div class="mg-dlg-acts" style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; padding:6px 22px 22px;"></div></div>';
    const prev = document.activeElement;
    const d = { el, closed: false, msg: (t, bad) => { const m = el.querySelector('.mg-dlg-msg'); m.textContent = t || ''; m.style.color = bad ? '#f08a5d' : 'var(--muted)'; } };
    d.close = () => { if (d.closed) return; d.closed = true; el.remove(); try { if (prev && prev.isConnected) prev.focus({ preventScroll: true }); } catch (e) {} };
    const acts = el.querySelector('.mg-dlg-acts');
    for (const a of o.actions || []) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = a.label; b.className = a.kind === 'accent' ? 'mg-b mg-acc' : a.kind === 'danger' ? 'mg-b mg-del' : 'mg-b';
      b.addEventListener('click', () => a.run(d, b));
      acts.appendChild(b);
    }
    el.querySelector('[data-cws-action="close"]').addEventListener('click', () => d.close());
    el.addEventListener('click', (e) => { if (e.target === el) d.close(); });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); d.close(); return; }
      if (e.key === 'Enter' && e.target && e.target.tagName === 'INPUT' && o.enter) { e.preventDefault(); o.enter(d); }
      e.stopPropagation();
    });
    document.body.appendChild(el);
    setTimeout(() => { const f = el.querySelector('input, textarea, select') || acts.querySelector('button'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {} }, 30);
    return d;
  }
  const INPUT = 'padding:10px 12px; border-radius:10px; background:rgba(255,255,255,.03); border:1px solid var(--line); color:var(--text); font-size:13px; font-family:inherit;';
  const LBL = 'display:block; font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); margin:10px 0 6px;';
  function ptDialog(k, pt, opts, v) {
    const n = v.pts.length + 1;
    const label = pt ? (pt.label || '') : (n === 1 ? 'First run' : 'Run ' + n);
    dialog({ title: pt ? 'Change the playthrough' : 'Start a new playthrough',
      html: `<label style="${LBL}">Name</label><input class="mg-pl" maxlength="64" value="${esc(label)}" style="width:100%; box-sizing:border-box; ${INPUT}">`
        + `<label style="${LBL}">Started</label><input class="mg-ps" type="date" value="${esc(pt ? pt.started_on || '' : isoDay(now()))}" style="${INPUT}">`
        + (pt ? `<label style="${LBL}">Finished</label><input class="mg-pf" type="date" value="${esc(pt.finished_on || '')}" style="${INPUT}">`
          + `<label style="${LBL}">Completion</label><div class="mg-row" role="group">${COMPLETIONS.map(([c, w]) => `<button type="button" class="mg-b mg-pc${pt.completion === c ? ' on' : ''}" data-c="${c}" aria-pressed="${pt.completion === c}">${w}</button>`).join('')}</div>` : '')
        + (pt ? '' : '<p class="mg-small">New sessions of this game join it until it is finished.</p>'),
      enter: (d) => save(d),
      actions: [{ label: pt ? 'Save' : 'Start', kind: 'accent', run: (d) => save(d) }, { label: 'Cancel', run: (d) => d.close() }] });
    const dl = document.querySelector('.mg-dlg:last-of-type');
    if (dl) dl.querySelectorAll('.mg-pc').forEach((b) => b.addEventListener('click', () => { const on = !b.classList.contains('on'); dl.querySelectorAll('.mg-pc').forEach((x) => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); }); if (on) { b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); } }));
    function save(d) {
      const lab = cleanText(d.el.querySelector('.mg-pl').value, 64), st = d.el.querySelector('.mg-ps').value || null;
      if (st && !/^\d{4}-\d{2}-\d{2}$/.test(st)) { d.msg('That date does not look right.', true); return; }
      if (!pt) {
        const p = emptyPt(uuid(), opts.anchor || anchorOfDevice(_openD));
        if (!p.anchor) { d.close(); return; }
        // A game with no record yet gets one, so the playthrough has a game to belong to.
        if (!hasRecord(k)) setGameFields(k, {}, opts);
        setPt(p, { label: lab, started_on: st });
      } else {
        const fin = d.el.querySelector('.mg-pf').value || null, on = d.el.querySelector('.mg-pc.on');
        if (fin && st && fin < st) { d.msg('It cannot finish before it started.', true); return; }
        setPt(pt, { label: lab, started_on: st, finished_on: fin, completion: on ? on.dataset.c : null });
      }
      d.close();
    }
  }
  function noteDialog(pt) {
    if (!pt) return;
    dialog({ title: 'Playthrough note', wide: true,
      html: `<p class="mg-p">${esc(pt.label || 'Playthrough')}: one note, up to 2,000 characters. Only your vault code opens it.</p><textarea class="mg-nt" maxlength="2000" rows="8" style="width:100%; box-sizing:border-box; ${INPUT} resize:vertical;">${esc(pt.note || '')}</textarea><div class="mg-small mg-ntc"></div>`,
      actions: [{ label: 'Save', kind: 'accent', run: (d) => { setPt(pt, { note: cleanText(d.el.querySelector('.mg-nt').value, 2000, true) }); d.close(); } }, { label: 'Cancel', run: (d) => d.close() }] });
    const dl = document.querySelector('.mg-dlg:last-of-type'), ta = dl && dl.querySelector('.mg-nt'), cnt = dl && dl.querySelector('.mg-ntc');
    const paint = () => { if (cnt) cnt.textContent = (ta.value.length).toLocaleString('en-AU') + ' of 2,000 characters'; };
    if (ta) { ta.addEventListener('input', paint); paint(); }
  }
  function sessionDialog(k, s, opts, v) {
    const started = s ? s.started : now() - 3600000;
    const dt = new Date(started), local = isoDay(started) + 'T' + String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
    const mins = s ? Math.round(s.played_ms / 60000) : 60;
    const ptOpts = '<option value="">None</option>' + v.pts.map((p) => `<option value="${esc(p.pt_id)}"${s && s.pt_id === p.pt_id ? ' selected' : (!s && !p.finished_on && v.pts.indexOf(p) === v.pts.length - 1 ? ' selected' : '')}>${esc(p.label || 'Playthrough')}</option>`).join('');
    dialog({ title: s ? 'Fix this session' : 'Add a session',
      html: (s ? '' : '<p class="mg-p">A session that was not written in by itself.</p>')
        + `<label style="${LBL}">Started</label><input class="mg-sd" type="datetime-local" value="${esc(local)}" style="${INPUT}">`
        + `<label style="${LBL}">Minutes played</label><input class="mg-sm" type="number" inputmode="numeric" min="1" max="1440" value="${mins}" style="width:120px; ${INPUT}">`
        + (s ? '' : `<label style="${LBL}">Played on</label><input class="mg-sp" maxlength="40" value="CrystalWorlds" placeholder="CrystalWorlds" style="width:100%; box-sizing:border-box; ${INPUT}">`)
        + `<label style="${LBL}">Playthrough</label><select class="mg-st" style="${INPUT}">${ptOpts}</select>`,
      enter: (d) => save(d),
      actions: [{ label: 'Save', kind: 'accent', run: (d) => save(d) }, { label: 'Cancel', run: (d) => d.close() }] });
    function save(d) {
      const when = Date.parse(d.el.querySelector('.mg-sd').value), m = parseInt(d.el.querySelector('.mg-sm').value, 10), pt = d.el.querySelector('.mg-st').value || null;
      if (!when || when > now() + 60000 || when < Date.UTC(1980, 0, 1)) { d.msg('That date does not look right.', true); return; }
      if (!(m >= 1 && m <= 1440)) { d.msg('A session is 1 minute to 24 hours.', true); return; }
      if (s) editSession(s, { started: when, played_ms: Math.max(30000, m * 60000), pt_id: pt });
      else {
        if (!hasRecord(k)) setGameFields(k, {}, opts);
        addManualSession(k, opts.anchor || anchorOfDevice(_openD), { started: when, minutes: Math.max(0.5, m), pt_id: pt, title: opts.title, machine: d.el.querySelector('.mg-sp').value.trim() || 'CrystalWorlds' });
      }
      d.close();
    }
  }
  /* A short line with Undo, 4 seconds. */
  let _toastEl = null, _toastT = 0;
  function toast(text, undo) {
    if (_toastEl) _toastEl.remove();
    clearTimeout(_toastT);
    const el = document.createElement('div');
    el.className = 'mg-toast'; el.setAttribute('role', 'status');
    el.style.zIndex = String(topZ() + 20);
    el.innerHTML = `<span>${esc(text)}</span>` + (undo ? '<button type="button" class="mg-b mg-acc">Undo</button>' : '');
    const b = el.querySelector('button');
    if (b) b.addEventListener('click', () => { undo(); el.remove(); _toastEl = null; });
    document.body.appendChild(el);
    _toastEl = el;
    _toastT = setTimeout(() => { if (_toastEl === el) { el.remove(); _toastEl = null; } }, 4000);
  }

  /* ------------------------------------------------------------ Settings: the My games card (4.1) */
  let _cat = null;   // the supported games: [{t, n, sh, prefix, sha12, aka, ids, st}]
  function loadCatalogue() {
    if (_cat) return _cat;
    const ungz = (ab) => { const u = new Uint8Array(ab); if (u[0] !== 0x1f || u[1] !== 0x8b || typeof DecompressionStream !== 'function') return Promise.resolve(JSON.parse(new TextDecoder().decode(u))); return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).json(); };
    _cat = fetch('firmware/compat/list-index.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((ix) => {
      const files = Array.from(new Set(((ix && ix.systems) || []).map((s) => s.file))).filter((f) => /^list-[a-z0-9]+\.json\.gz$/.test(f));
      return Promise.all(files.map((f) => fetch('firmware/compat/' + f, { cache: 'no-cache' }).then((r) => (r.ok ? r.arrayBuffer() : null)).then((ab) => (ab ? ungz(ab) : null)).catch(() => null)));
    }).then((docs) => {
      const out = [];
      for (const doc of docs || []) for (const g of (doc && doc.games) || []) {
        const [title, shelf, st, cat, , files, aka] = g;
        /* SUPPORTED MEANS PLAYS OR UNTESTED ("it plays, but no test has read it"). Not: Boots,
           Nothing, Unseen by us, Data and tools; never a hack or translation, never a test program. */
        if (!(st === 0 || st === 3) || cat === 'hack' || cat === 'test' || !Array.isArray(files) || !files.length) continue;
        const main = files.find((f) => f[5] === 0 || f[5] === 3) || files[0];
        let anchor = null, prefix = SHELF_PREFIX[shelf];
        if (prefix && /^[0-9a-f]{64}$/.test(main[3] || '')) anchor = 'f:' + prefix + ':' + main[3].slice(0, 12);
        else if (!prefix && main[8] && /^[a-z0-9-]{1,64}$/.test(main[8])) anchor = 'd:' + main[8];
        if (!anchor) continue;
        const names = [title].concat(Array.isArray(aka) ? aka : []);
        out.push({ t: title, sh: shelf, cat, st, anchor, q: names.map(norm).join(' | '), ids: files.map((f) => String(f[4] || '').toLowerCase()).join(' '), shas: files.map((f) => f[3]).filter(Boolean) });
      }
      out.sort((a, b) => a.t.localeCompare(b.t));
      return out;
    }).catch(() => { _cat = null; return []; });
    return _cat;
  }
  const norm = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  function searchCat(list, q) {
    const words = norm(q).split(' ').filter(Boolean);
    if (!words.length) return [];
    const raw = String(q).trim().toLowerCase();
    const out = [];
    for (const g of list) {
      if (words.every((w) => g.q.indexOf(w) >= 0) || (raw.length >= 4 && g.ids.indexOf(raw) >= 0)) out.push(g);
      if (out.length >= 40) break;
    }
    return out;
  }
  /* Is a real tile for this title on the wall now? Any version of it. */
  function onWall(g) {
    const k = keyOfAnchor(g.anchor);
    if (g.anchor[0] === 'd') { const d = allDevices().find((x) => x.id === g.anchor.slice(2)); return !!(d && playableDev(d)); }
    const sha12s = new Set(g.shas.map((s) => s.slice(0, 12)));
    for (const d of allDevices()) {
      if (!d || d.mgTile) continue;
      const m = /-x([0-9a-f]{12})$/.exec(d.id);
      if ((m && sha12s.has(m[1])) || (!m && keyOfDevice(d) === k)) { if (playableDev(d)) return true; }
    }
    return false;
  }
  function cardHost() { return document.getElementById('mygames-section'); }
  let _q = '', _results = null;
  function cardHTML() {
    const on = !localOnly(), noVault = !S.code;
    const u = S.usage;
    let h = '<label class="mg-lbl">My games</label>'
      + '<p class="mg-p">My games keeps your own record of the games you play: what you are playing, what you have finished, what you thought, and every session you play here. It is kept in your vault and only your vault code can open it.</p>';
    h += `<button type="button" role="switch" class="mg-switch${on ? ' on' : ''}" data-mgc="mode" aria-checked="${on}"${noVault ? ' disabled' : ''}><span class="mg-sw" aria-hidden="true"></span><span>Keep My games in my vault</span></button>`
      + `<p class="mg-small">${on ? 'On: saved to your vault, so every browser with your vault code has it.' : 'Off: this browser only. Nothing is sent; everything works from this browser’s copy.'}</p>`;
    h += `<p class="mg-status" aria-live="polite">${esc(statusLine())}</p>`;
    if (S.refused.length) h += `<p class="mg-small mg-bad">${plural(S.refused.length, 'entry', 'entries')} could not be saved to your vault and ${S.refused.length === 1 ? 'is' : 'are'} kept in this browser only.</p>`;
    h += '<div class="mg-sub">Add a game you own that has no game file here</div>'
      + `<div class="mg-row"><input class="mg-q" id="mygames-q" type="search" autocomplete="off" placeholder="Search our supported games" aria-label="Search our supported games" value="${esc(_q)}" style="flex:1; min-width:180px; ${INPUT}"></div>`
      + '<div class="mg-res" role="list"></div>';
    h += '<div class="mg-sub">Download or restore</div><div class="mg-row">'
      + '<button type="button" class="mg-b" data-mgc="export-json">Download as JSON</button>'
      + '<button type="button" class="mg-b" data-mgc="export-csv">Download as CSV (zip)</button>'
      + '<button type="button" class="mg-b" data-mgc="restore">Restore from export</button>'
      + '<input type="file" class="mg-file" accept=".json,application/json" hidden></div>'
      + '<p class="mg-small">The download is your own copy and backup. It holds no vault code and no IGDB times.</p>';
    const c = localCounts();
    h += `<p class="mg-small mg-usage">${plural(u ? u.games : c.games, 'game')}, ${plural(u ? u.sessions : c.sessions, 'session')}, ${plural(u ? u.playthroughs : c.pts, 'playthrough')}. Room for 20,000 games and 50,000 sessions.</p>`;
    h += '<div class="mg-danger"><div class="mg-sub">Delete everything in My games</div><p class="mg-small">This removes your statuses, ratings, notes, owned games, wishlist and play diary from your vault and this browser. Download an export first if you want a copy. Your vault, alias, avatar, game servers and saves stay as they are.</p>'
      + '<button type="button" class="mg-b mg-del" data-mgc="delete-all">Delete everything in My games…</button></div>';
    return h;
  }
  function localCounts() {
    let games = 0, sessions = 0, pts = 0;
    for (const g of S.games.values()) if (!g.deleted) games++;
    for (const s of S.sess.values()) if (!s.deleted) sessions++;
    for (const p of S.pts.values()) if (!p.deleted) pts++;
    return { games, sessions, pts };
  }
  function statusLine() {
    if (!S.loaded) return 'Starting…';
    if (!storageOk) return localOnly() ? 'This browser cannot keep My games (its storage is blocked), so nothing here lasts past this visit.' : 'This browser cannot keep a copy (its storage is blocked); your vault saves what you change while the page is open.';
    if (!S.code) return 'Kept in this browser only: there is no vault on this browser yet.';
    if (localOnly()) return 'Kept in this browser only. Nothing is sent.';
    const n = dirtyCount();
    if (S.svc === 'full') return 'The vault service is full for now, so nothing new is saved there. Everything is kept in this browser.';
    if (S.limit === 'day_limit' || S.limit === 'busy') return 'Today’s saving is used up. Waiting to save ' + plural(Math.max(1, n), 'entry', 'entries') + ': will try again later.';
    if (S.limit && /_limit$/.test(S.limit)) return 'Your vault has no room for more in My games. Everything new is kept in this browser.';
    if (S.svc === 'missing') return 'Your vault cannot keep My games yet. Everything is kept in this browser and saved to your vault later.';
    if (S.svc === 'novault') return 'Your vault is not on the vault service yet. Everything is kept in this browser for now.';
    if (S.svc === 'offline') return n ? 'Waiting to save ' + plural(n, 'session') + ': will try again when you are online.' : 'The vault service cannot be reached right now. Everything is kept in this browser.';
    if (S.syncing) return 'Saving…';
    if (dirtyAny()) return n ? 'Waiting to save ' + plural(n, 'session') + '.' : 'Saving soon.';
    if (S.meta.lastSaved) return 'Saved to your vault ' + ago(S.meta.lastSaved) + '.';
    return 'Saved to your vault.';
  }
  function renderCard() {
    const host = cardHost(); if (!host) return;
    const a = document.activeElement, had = a && host.contains(a);
    const sel = had ? (a.dataset.mgc ? `[data-mgc="${a.dataset.mgc}"]${a.dataset.mgv ? `[data-mgv="${CSS.escape(a.dataset.mgv)}"]` : ''}` : a.classList.contains('mg-q') ? '.mg-q' : null) : null;
    const caret = had && a.classList.contains('mg-q') ? a.selectionStart : null;
    host.hidden = false;
    host.innerHTML = cardHTML();
    paintResults();
    if (sel) { const t = host.querySelector(sel) || host.querySelector('[data-mgc]'); if (t) { try { t.focus({ preventScroll: true }); if (caret != null && t.setSelectionRange) t.setSelectionRange(caret, caret); } catch (e) {} } }
  }
  function paintResults() {
    const host = cardHost(), box = host && host.querySelector('.mg-res'); if (!box) return;
    if (!_q.trim()) { box.innerHTML = ''; return; }
    if (!_results) { box.innerHTML = '<p class="mg-small">Looking…</p>'; return; }
    if (!_results.length) {
      /* About (with Suggestions and submissions) exists only on our own address; a copy run elsewhere has no About window. */
      box.innerHTML = window.__cwOffsite ? '<p class="mg-small mg-none">We can only add games this site supports. If a game is missing, write to us about it.</p>'
        : '<p class="mg-small mg-none">We can only add games this site supports. If a game is missing, <button type="button" class="mg-link" data-mgc="write-to-us">write to us about it</button>.</p>';
      return;
    }
    box.innerHTML = _results.map((g) => {
      const k = keyOfAnchor(g.anchor), v = view(k), wall = onWall(g);
      const state = wall ? '<span class="mg-tag">Already on your wall</span>' : v.owned ? '<span class="mg-tag">You own it</span>' : '';
      const wishState = v.wish ? '<span class="mg-tag">On your wishlist</span>' : '';
      const btns = wall ? '' : (v.owned ? `<button type="button" class="mg-b" data-mgc="unown" data-mgv="${esc(g.anchor)}">Remove</button>` : `<button type="button" class="mg-b mg-acc" data-mgc="own" data-mgv="${esc(g.anchor)}">I own it</button>`);
      const wbtn = v.wish ? `<button type="button" class="mg-b" data-mgc="unwish" data-mgv="${esc(g.anchor)}">Off wishlist</button>` : `<button type="button" class="mg-b" data-mgc="wish" data-mgv="${esc(g.anchor)}">Add to wishlist</button>`;
      return `<div class="mg-ri" role="listitem"><div class="mg-rt"><b>${esc(g.t)}</b><span>${esc(SHELF_LABEL[g.sh] || g.sh)}</span>${state}${wishState}</div><div class="mg-row">${btns}${wbtn}</div></div>`;
    }).join('') + (_results.length >= 40 ? '<p class="mg-small">More than 40 games match: type more of the name.</p>' : '');
  }
  let _qT = 0;
  function onSearchInput(e) {
    _q = e.target.value;
    clearTimeout(_qT);
    _results = null;
    if (!_q.trim()) { paintResults(); return; }
    paintResults();
    _qT = setTimeout(() => { loadCatalogue().then((list) => { _results = searchCat(list || [], _q); paintResults(); }); }, 200);
  }
  function catEntry(anchor) { return (_results || []).find((g) => g.anchor === anchor) || null; }
  function onCardClick(e) {
    const b = e.target && e.target.closest && e.target.closest('#mygames-section [data-mgc]');
    if (!b || b.disabled) return;
    const act = b.dataset.mgc, val = b.dataset.mgv;
    e.preventDefault();
    if (act === 'mode') { lsSet('mode.' + S.vt, localOnly() ? null : 'local'); S.svc = localOnly() ? 'local' : 'unknown'; renderCard(); if (!localOnly()) syncNow('mode'); }
    else if (act === 'own' || act === 'wish' || act === 'unown' || act === 'unwish') {
      const g = catEntry(val), k = keyOfAnchor(val), v = view(k);
      const opts = { anchor: (v.recs[0] && v.recs[0].anchor) || val, title: g ? g.t : null };
      if (act === 'own') setGameFields(k, { owned: true }, opts);
      else if (act === 'unown') setGameFields(k, { owned: false }, opts);
      else if (act === 'wish') setGameFields(k, { status: 'wishlist', status_auto: false }, opts);
      else setGameFields(k, { status: null }, opts);
      paintResults();
      const t = cardHost().querySelector(`[data-mgv="${CSS.escape(val)}"]`); if (t) try { t.focus({ preventScroll: true }); } catch (err) {}
      announce(act === 'own' ? 'Added to your wall with No game file.' : act === 'wish' ? 'Added to your wishlist.' : 'Changed.');
    }
    else if (act === 'write-to-us') writeToUs();
    else if (act === 'export-json') downloadJSON();
    else if (act === 'export-csv') downloadCSV();
    else if (act === 'restore') { const f = cardHost().querySelector('.mg-file'); if (f) { f.value = ''; f.click(); } }
    else if (act === 'delete-all') deleteAllDialog();
  }
  function announce(t) { const s = cardHost() && cardHost().querySelector('.mg-status'); if (s) { s.textContent = t; setTimeout(() => { if (s.isConnected) s.textContent = statusLine(); }, 4000); } }
  function writeToUs() {
    /* Closing Settings steps the history back; About opens once that step has landed, or Back would close it again. */
    let went = false;
    const go2 = () => { if (went) return; went = true; window.removeEventListener('popstate', onPop); setTimeout(openAbout, 120); };
    const onPop = () => go2();
    window.addEventListener('popstate', onPop);
    try { if (typeof closeOverlay === 'function') closeOverlay('vault-overlay'); } catch (e) {}   // eslint-disable-line no-undef
    setTimeout(go2, 900);
  }
  function openAbout() {
    {
      try { if (window.CwAboutWindow) window.CwAboutWindow.open('about'); } catch (e) {}
      let n = 0;
      // The About window shows its own copy of the page: the heading that is on screen.
      const find = () => Array.from(document.querySelectorAll('#about-submissions, h3')).find((h) => /Suggestions and submissions/.test(h.textContent) && h.getClientRects().length);
      const go = () => { const h = find(); if (h) { try { h.scrollIntoView({ block: 'start' }); } catch (e) {} return; } if (++n < 30) setTimeout(go, 100); };
      go();
    }
  }
  async function refreshUsage() {
    if (localOnly() || !S.code) { S.usage = null; return; }
    const r = await rpc('mygames_usage', { p_vault: S.code });
    S.usage = (!callError(r) && r.body) ? r.body : null;
    scheduleUi();
  }

  /* ------------------------------------------------------------ export (8) */
  function exportDoc() {
    const games = [], playthroughs = [], sessions = [];
    const iso = (ms) => (ms ? new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z') : null);
    const ptLabel = new Map();
    const sysOf = (anchor) => {
      const d = deviceForAnchor(anchor);
      if (d && d.series) { const s = glob(() => seriesById(d.series)); if (s && s.name) return s.name; }   // eslint-disable-line no-undef
      if (anchor[0] === 'f') return PREFIX_LABEL[anchor.split(':')[1]] || '';
      return 'Game & Watch';
    };
    const sessBy = new Map();
    for (const s of S.sess.values()) { if (s.deleted || !(s.played_ms > 0)) continue; const k = keyOfAnchor(s.anchor); if (!sessBy.has(k)) sessBy.set(k, []); sessBy.get(k).push(s); }
    for (const g of S.games.values()) {
      if (g.deleted) continue;
      const ss = sessBy.get(keyOfAnchor(g.anchor)) || [];
      const tot = ss.reduce((a, s) => a + s.played_ms, 0);
      const first = ss.length ? Math.min(...ss.map((s) => s.started)) : 0, last = ss.length ? Math.max(...ss.map((s) => s.started + s.played_ms)) : 0;
      const times = Object.values(g.t || {}).filter((x) => x > 0);
      games.push({ key: g.anchor, anchors: [g.anchor], system: sysOf(g.anchor), title: g.title || titleForAnchor(g.anchor),
        status: g.status || null, completion: g.completion || null, favourite: !!g.favourite, rating: g.rating ? g.rating / 2 : null,
        owned_without_file: !!g.owned,
        added: iso(times.length ? Math.min(...times) : 0), updated: iso(times.length ? Math.max(...times) : 0),
        play_seconds: Math.round(tot / 1000), sessions: ss.length, first_played: iso(first), last_played: iso(last) });
    }
    for (const p of S.pts.values()) {
      if (p.deleted) continue;
      ptLabel.set(p.pt_id, p.label || '');
      const ps = Array.from(S.sess.values()).filter((s) => !s.deleted && s.pt_id === p.pt_id);
      playthroughs.push({ id: p.pt_id, game: p.anchor, label: p.label || null, started: p.started_on || null, finished: p.finished_on || null,
        completion: p.completion || null, note: p.note || null, play_seconds: Math.round(ps.reduce((a, s) => a + s.played_ms, 0) / 1000) });
    }
    const list = Array.from(S.sess.values()).filter((s) => !s.deleted && s.played_ms > 0).sort((a, b) => a.started - b.started);
    for (const s of list) {
      sessions.push({ id: s.sid, game: s.anchor, file: s.file || null, system: sysOf(s.anchor), title: s.title || titleForAnchor(s.anchor), version: s.version || null,
        machine: s.machine || null, started: iso(s.started), played_seconds: Math.round(s.played_ms / 1000), playthrough: s.pt_id || null,
        source: s.source === 'manual' ? 'manual' : 'auto', edited: !!s.edited });
    }
    const off = -new Date().getTimezoneOffset(), sign = off >= 0 ? '+' : '-', oh = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0'), om = String(Math.abs(off) % 60).padStart(2, '0');
    const d = new Date(), localIso = isoDay(d.getTime()) + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0') + sign + oh + ':' + om;
    return { format: 'crystalworlds-my-games', version: 2, exported: localIso, site: 'CrystalWorlds.Media', games, playthroughs, sessions, lists: [] };
  }
  function deviceForAnchor(a) {
    const k = keyOfAnchor(a);
    for (const d of allDevices()) { if (d && !d.mgTile && anchorOfDevice(d) === a) return d; }
    return deviceForKey(k);
  }
  function titleForAnchor(a) {
    for (const s of S.sess.values()) if (s.anchor === a && s.title) return s.title;
    const d = deviceForAnchor(a);
    return (d && d.name) || null;
  }
  function saveFile(name, blob) {
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name; a.style.display = 'none';
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      return true;
    } catch (e) { return false; }
  }
  const stampName = () => isoDay(now());
  function downloadJSON() {
    const doc = exportDoc();
    saveFile('crystalworlds-my-games-' + stampName() + '.json', new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }));
    announce('Downloaded.');
    return doc;
  }
  /* CSV: three files in one zip (stored, not compressed), UTF-8 with a byte order mark. */
  function csvRows(rows) {
    const cell = (v) => { if (v == null) return ''; const s = String(v); return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? '"' + (/^[=+\-@]/.test(s) ? "'" : '') + s.replace(/"/g, '""') + '"' : s; };
    return String.fromCharCode(0xfeff) + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
  }
  function csvFiles(doc) {
    const hrs = (s) => (s == null ? '' : (Math.round(s / 36) / 100).toFixed(2));
    const bySys = new Map(doc.games.map((g) => [g.key, g]));
    const ptLab = new Map(doc.playthroughs.map((p) => [p.id, p.label || '']));
    const games = [['system', 'title', 'status', 'completion', 'favourite', 'rating', 'owned_without_file', 'play_hours', 'sessions', 'first_played', 'last_played', 'added', 'updated', 'key']]
      .concat(doc.games.map((g) => [g.system, g.title, g.status, g.completion, g.favourite ? 'yes' : 'no', g.rating, g.owned_without_file ? 'yes' : 'no', hrs(g.play_seconds), g.sessions, g.first_played, g.last_played, g.added, g.updated, g.key]));
    const pts = [['system', 'title', 'label', 'started', 'finished', 'completion', 'play_hours', 'note', 'id', 'game_key']]
      .concat(doc.playthroughs.map((p) => { const g = bySys.get(p.game); return [g ? g.system : '', g ? g.title : titleForAnchor(p.game), p.label, p.started, p.finished, p.completion, hrs(p.play_seconds), p.note, p.id, p.game]; }));
    const ses = [['date', 'start_time', 'system', 'title', 'version', 'machine', 'minutes', 'playthrough_label', 'source', 'edited', 'id', 'game_key']]
      .concat(doc.sessions.map((s) => { const d = new Date(s.started); return [isoDay(d.getTime()), String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), s.system, s.title, s.version, s.machine, Math.round(s.played_seconds / 6) / 10, s.playthrough ? ptLab.get(s.playthrough) || '' : '', s.source, s.edited ? 'yes' : 'no', s.id, s.game]; }));
    return [['games.csv', csvRows(games)], ['playthroughs.csv', csvRows(pts)], ['sessions.csv', csvRows(ses)]];
  }
  let _crcT = null;
  function crc32(u8) {
    if (!_crcT) { _crcT = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; _crcT[n] = c >>> 0; } }
    let c = 0xffffffff;
    for (let i = 0; i < u8.length; i++) c = _crcT[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function zipStored(files) {
    const enc = new TextEncoder(), parts = [], central = [];
    let off = 0;
    const d = new Date(), dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff, dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
    for (const [name, text] of files) {
      const nm = enc.encode(name), data = enc.encode(text), crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, dt, true); lh.setUint16(12, dd, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
      lh.setUint16(26, nm.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), nm, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, dt, true); ch.setUint16(14, dd, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, nm.length, true); ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), nm);
      off += 30 + nm.length + data.length;
    }
    const csize = central.reduce((a, p) => a + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, off, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/zip' });
  }
  function downloadCSV() {
    const doc = exportDoc();
    saveFile('crystalworlds-my-games-' + stampName() + '.zip', zipStored(csvFiles(doc)));
    announce('Downloaded.');
    return doc;
  }
  /* Restore from export: the file's records join this vault's (nothing is removed). */
  function restoreDoc(doc) {
    if (!doc || doc.format !== 'crystalworlds-my-games' || (doc.version !== 1 && doc.version !== 2) || !Array.isArray(doc.games)) throw new Error('That file is not a My games download.');
    const t = now(), toMs = (s) => { const v = Date.parse(s || ''); return v > 0 ? v : 0; };
    let n = 0;
    const ptIds = new Set(), ptMap = new Map();
    for (const p of doc.playthroughs || []) {
      if (!/^[0-9a-f-]{36}$/.test(p.id || '') || !ANCHOR_RE.test(p.game || '')) continue;
      /* A playthrough this vault does not hold gets a new id: its id may belong to the vault the file came from. */
      const id = S.pts.has(p.id) ? p.id : uuid();
      ptMap.set(p.id, id);
      let x = S.pts.get(id); if (!x) { x = emptyPt(id, p.game); S.pts.set(id, x); }
      const f = { label: cleanText(p.label, 64), started_on: /^\d{4}-\d{2}-\d{2}$/.test(p.started || '') ? p.started : null, finished_on: /^\d{4}-\d{2}-\d{2}$/.test(p.finished || '') ? p.finished : null,
        completion: COMPLETION_WORD[p.completion] ? p.completion : null, note: cleanText(p.note, 2000, true), deleted: false };
      for (const [k2, v2] of Object.entries(f)) { if ((x.t[k2] || 0) < t) { x[k2] = v2; x.t[k2] = t; x.dirty[k2] = 1; } }
      persist('p', x.pt_id, x); ptIds.add(id); n++;
    }
    for (const g of doc.games) {
      const a = g.key || (g.anchors && g.anchors[0]);
      if (!ANCHOR_RE.test(a || '')) continue;
      let x = S.games.get(a); if (!x) { x = emptyGame(a); S.games.set(a, x); }
      const f = { status: STATUS_WORD[g.status] ? g.status : null, completion: COMPLETION_WORD[g.completion] ? g.completion : null, favourite: !!g.favourite,
        rating: g.rating >= 0.5 && g.rating <= 5 ? Math.round(g.rating * 2) : null, owned: !!g.owned_without_file,
        title: cleanText(g.title, 128), deleted: false };   // a version 1 file's my_length_seconds (the old guess) is not read
      for (const [k2, v2] of Object.entries(f)) { x[k2] = v2; x.t[k2] = Math.max(t, (x.t[k2] || 0) + 1); x.dirty[k2] = 1; }
      x.status_auto = false;
      persist('g', a, x); n++;
    }
    for (const s of doc.sessions || []) {
      if (!/^[0-9a-f]{32}$/.test(s.id || '') || !ANCHOR_RE.test(s.game || '')) continue;
      const started = toMs(s.started), played = Math.round((+s.played_seconds || 0) * 1000);
      if (!started || !(played >= 30000 && played <= 86400000)) continue;
      const cur = S.sess.get(s.id);
      if (cur && !cur.deleted && cur.played_ms >= played) continue;
      const x = { sid: s.id, anchor: s.game, file: /^[a-z0-9-]{1,32}$/.test(s.file || '') ? s.file : null, sys: null, title: cleanText(s.title, 128), version: cleanText(s.version, 80), machine: cleanText(s.machine, 40),
        started, played_ms: played, pt_id: s.playthrough && ptMap.has(s.playthrough) ? ptMap.get(s.playthrough) : (s.playthrough && S.pts.has(s.playthrough) ? s.playthrough : null),
        source: s.source === 'manual' ? 'manual' : 'auto', edited: !!s.edited || s.source === 'manual', edit_t: (s.edited || s.source === 'manual') ? t : null, deleted: false, dirty: true };
      S.sess.set(x.sid, x); persist('s', x.sid, x); n++;
    }
    changed('restore'); syncSoon(500);
    return n;
  }
  function onRestoreFile(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    if (f.size > 64 * 1024 * 1024) { announce('That file is too big to be a My games download.'); return; }
    const r = new FileReader();
    r.onload = () => { try { const n = restoreDoc(JSON.parse(String(r.result))); announce('Restored ' + plural(n, 'record') + '.'); } catch (err) { announce(err && err.message && /My games/.test(err.message) ? err.message : 'That file could not be read as a My games download.'); } };
    r.readAsText(f);
  }

  /* ------------------------------------------------------------ delete everything (9) */
  let _proto = null;
  const proto = () => _proto || (_proto = (new Function('u', 'return import(u)'))('./cws-proto.mjs?v=2.3.0'));
  function deleteAllDialog() {
    const remote = !!S.code && sbUrl();
    dialog({ sub: 'My games', title: 'Delete everything in My games?',
      html: '<p class="mg-p">This removes your statuses, ratings, notes, owned games, wishlist and play diary from your vault and this browser. It cannot be undone. Download an export first if you want a copy.</p>'
        + (remote ? '<label style="' + LBL + '">Your PIN</label><form class="mg-pinf" autocomplete="off" onsubmit="return false"><input class="mg-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="12" aria-label="PIN" placeholder="6 to 12 digits" style="' + INPUT + ' font-family:ui-monospace,Consolas,monospace; letter-spacing:.2em;"></form>' : ''),
      enter: (d) => go(d),
      actions: [{ label: 'Delete everything', kind: 'danger', run: (d) => go(d) }, { label: 'Cancel', run: (d) => d.close() }] });
    let busy = false;
    async function go(d) {
      if (busy) return;
      busy = true; d.msg('Checking…');
      try {
        if (remote) {
          const pp = await rpc('get_pin_params', { p_vault: S.code });
          const pe = callError(pp);
          if (pe === 'offline') throw new Error('The vault service cannot be reached right now. Try again in a moment.');
          let x = null;
          const info = pp.body || {};
          if (!pe && !info.none) {
            const pin = (d.el.querySelector('.mg-pin').value || '').trim();
            const P = await proto();
            if (!P.validPin(pin)) throw new Error('A PIN is 6 to 12 digits.');
            x = P.b64u(await P.pinStretch(pin, P.unb64u(info.salt, 16), info.iterations));
          }
          const r = await rpc('mygames_delete_all', { p_vault: S.code, p_x: x });
          const e = callError(r);
          if (e === 'pin_incorrect') { const n = r.body.attempts_remaining; throw new Error('That PIN isn’t right.' + (typeof n === 'number' ? ' ' + plural(n, 'try', 'tries') + ' left before PIN checks are locked for a while.' : '')); }
          if (e === 'pin_locked') throw new Error('Too many wrong PINs. Try again later.');
          if (e === 'pin_required') throw new Error('Enter your PIN.');
          if (e === 'offline') throw new Error('The vault service cannot be reached right now. Try again in a moment.');
          if (e && e !== 'missing' && e !== 'no_vault') throw new Error('It could not be deleted (' + e + ').');
        }
        await wipeLocal(new Date().toISOString());
        S.usage = null;
        d.close();
        announce('Everything in My games is deleted.');
        syncSoon(500);
      } catch (err) { d.msg(err.message || String(err), true); const p = d.el.querySelector('.mg-pin'); if (p) p.value = ''; }
      busy = false;
    }
  }

  /* ------------------------------------------------------------ the page's hooks */
  /* A change of the favourite alone redraws only the heart and the tile marks: the drawer's section (its open
     session lists, the focus and the scroll) stays as it is. */
  let _uiT = 0, _uiAll = false;
  function scheduleUi(what) {
    if (what !== 'fav') _uiAll = true;
    if (_uiT) return;
    _uiT = setTimeout(() => {
      _uiT = 0;
      const all = _uiAll; _uiAll = false;
      if (all) { try { repaintDrawer(); } catch (e) {} }
      try { paintFav(); } catch (e) {}
      try { const h = cardHost(); if (h && !h.hidden && !(document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('mg-q'))) renderCard(); else if (h) { const s = h.querySelector('.mg-status'); if (s) s.textContent = statusLine(); } } catch (e) {}
      decorateSoon();
    }, 60);
  }
  /* The wall: a change of record repaints the shelves (once per burst). */
  let _wallT = 0;
  function wallSoon() {
    clearTimeout(_wallT);
    _wallT = setTimeout(() => { try { if (window.Emby && Emby.reseedGameTiles) Emby.reseedGameTiles({ force: true }); } catch (e) {} }, 250);
  }
  listeners.add((what) => { if (what === 'fav' ? filterActive() : (what !== 'sess' || filterActive() || /^(last|time|myrating)$/.test(sortMode()))) wallSoon(); else decorateSoon(); });
  const sortMode = () => { try { return (window.Emby && Emby.gameSort && Emby.gameSort()) || ''; } catch (e) { return ''; } };
  /* emby.js keeps the wall's order while this stays the same: the filter, and the diary when it orders the games. */
  const orderSig = (sort) => { const f = filter(); return JSON.stringify([f.show, f.noFile, f.wish, f.len, /^(last|time|myrating)$/.test(sort || '') ? S.ver : 0]); };

  function wrapLogout() {
    const cur = window.logoutVault;
    if (typeof cur !== 'function' || cur.__mg) return;
    const mine = async function () {
      const args = arguments;
      try {
        if (S.loaded && !localOnly() && dirtyAny()) {
          await Promise.race([syncNow('logout'), new Promise((r) => setTimeout(r, 6000))]);
          const n = dirtyCount();
          if (n && typeof confirmModal === 'function') {   // eslint-disable-line no-undef
            const ok = await confirmModal({ sub: 'Log out', title: 'Not saved to your vault yet', body: plural(n, 'session') + (n === 1 ? ' is' : ' are') + ' not saved to your vault yet. Log out now and ' + (n === 1 ? 'it is' : 'they are') + ' lost; or cancel, wait until you are online, and log out then.', confirmLabel: 'Log out anyway', danger: true });   // eslint-disable-line no-undef
            if (!ok) return;
          }
        }
      } catch (e) {}
      return cur.apply(window, args);
    };
    mine.__mg = true;
    window.logoutVault = mine;
  }
  /* The drawer's own play time readout (index.html refreshDrawerPlayTime) is per file; ours is the game's. */
  function wrapPlayTime() {
    const cur = window.refreshDrawerPlayTime;
    if (typeof cur !== 'function' || cur.__mg) return;
    const mine = function () { const r = cur.apply(this, arguments); try { repaintDrawer(); } catch (e) {} return r; };
    mine.__mg = true;
    window.refreshDrawerPlayTime = mine;
  }
  /* A vault code change: rotation keeps the vault (its rows hang on the vault, not the code), so this
     browser's copy and its unsent sessions move to the new code's tag; a switch to another vault loads that one. */
  let _lastCode;
  async function watchVault() {
    const c = vcode();
    if (c === _lastCode) return;
    const old = _lastCode; _lastCode = c;
    if (old === undefined) { load(c); return; }
    let rotated = false;
    if (old && c) {
      try { const r = await rpc('vault_exists', { p_vault: old }); rotated = r.status === 200 && r.body === false; } catch (e) {}
    }
    if (rotated) {
      const oldVt = S.vt, newVt = await tagFor(c);
      await flushNow();
      try {
        const r = await idbAll(oldVt);
        await db().then((d) => new Promise((res) => {
          const t = d.transaction(['rows', 'meta'], 'readwrite'), st = t.objectStore('rows');
          for (const row of r.rows) { st.delete(row.k); row.k = newVt + '|' + row.kind + '|' + row.id; row.vt = newVt; st.put(row); }
          const m = Object.assign({}, r.meta || {}, { vt: newVt, aliases: ((r.meta && r.meta.aliases) || []).concat(oldVt) });
          t.objectStore('meta').delete(oldVt); t.objectStore('meta').put(m);
          t.oncomplete = () => res(); t.onerror = () => res();
        }));
      } catch (e) {}
      const md = lsGet('mode.' + oldVt); if (md) lsSet('mode.' + newVt, md);
      const fl = lsGet('filter.' + oldVt); if (fl) lsSet('filter.' + newVt, fl);
      if (lsGet('earlier') === 'yes:' + oldVt) lsSet('earlier', 'yes:' + newVt);
    }
    _filter = null;
    load(c);
  }

  /* ------------------------------------------------------------ styles */
  function styles() {
    if (document.getElementById('mg-styles')) return;
    const st = document.createElement('style');
    st.id = 'mg-styles';
    st.textContent = `
      .mg-sect .mg-h { font-size: 10.5px; letter-spacing: .16em; text-transform: uppercase; color: var(--muted); margin: 14px 0 6px; }
      .mg-sect .mg-note { margin: 0 0 10px; font-size: 12.5px; line-height: 1.5; color: var(--text); }
      .mg-small { font-size: 11.5px; line-height: 1.5; color: var(--muted); margin: 6px 0 0; }
      .mg-p { font-size: 12.5px; line-height: 1.55; color: var(--muted); margin: 0 0 10px; }
      .mg-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 4px 0; }
      .mg-b { min-height: 32px; padding: 6px 11px; border-radius: 9px; border: 1px solid var(--line); background: rgba(255,255,255,.03); color: var(--text);
        font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
      .mg-b:hover, .mg-b:focus-visible { border-color: rgba(var(--accent-rgb),.6); outline: none; }
      .mg-b:focus-visible { box-shadow: 0 0 0 2px rgba(var(--accent-rgb),.55); }
      .mg-b.on { background: rgba(var(--accent-rgb),.16); border-color: rgba(var(--accent-rgb),.65); color: var(--text); }
      .mg-b[disabled] { opacity: .45; cursor: default; }
      /* THE MAIN BUTTON (21 Nov 2026: it read as white on light grey in light mode, where the theme rule below won).
         The site's own primary look: the accent colour with the accent's own text colour (--on-accent, chosen per accent for
         contrast), in both themes; disabled is an outline with muted text; the focus ring is a solid ring in the text colour. */
      .mg-b.mg-acc, :root[data-theme="light"] .mg-b.mg-acc { background: var(--accent); color: var(--on-accent, #0a0e14); border-color: transparent; font-weight: 800; }
      .mg-b.mg-acc:hover, :root[data-theme="light"] .mg-b.mg-acc:hover { filter: brightness(1.06); border-color: transparent; }
      .mg-b.mg-acc:focus-visible, :root[data-theme="light"] .mg-b.mg-acc:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; box-shadow: none; }
      .mg-b.mg-acc[disabled], :root[data-theme="light"] .mg-b.mg-acc[disabled] { background: transparent; color: var(--muted); border-color: var(--line); opacity: 1; filter: none; }
      .mg-b.mg-del { color: #ff8a8a; border-color: rgba(240,80,80,.4); background: rgba(240,80,80,.08); }
      :root[data-theme="light"] .mg-b.mg-del { color: #a8231b; border-color: rgba(168,35,27,.45); background: rgba(168,35,27,.06); }
      .mg-b:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
      /* The heart beside Manual, and Save in this browser left of it (21 Nov 2026): one look for both. Manual's round shape
         and height; an outline icon, filled when on; the same hover, focus ring and press. Both in the accent chosen in
         Settings (any of the ten), no pink (21 Nov 2026); the tile's heart mark keeps its own colour. */
      .device-modal-body .pill-row .mg-favpill, .device-modal-body .pill-row .mg-savepill { --mg-pc: var(--accent); --mg-pc-rgb: var(--accent-rgb);
        margin-left: auto; width: 36px; height: 36px; padding: 0; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center;
        background: rgba(255,255,255,.04); border: 1px solid var(--line); color: var(--mg-pc); cursor: pointer; transition: all .15s; font: inherit; }
      .device-modal-body .pill-row .play-now + .mg-favpill, .device-modal-body .pill-row .manual-btn + .mg-favpill,
      .device-modal-body .pill-row .play-now + .mg-savepill, .device-modal-body .pill-row .manual-btn + .mg-savepill,
      .device-modal-body .pill-row .mg-savepill + .mg-favpill { margin-left: 8px; }
      :root[data-theme="light"] .device-modal-body .pill-row .mg-favpill, :root[data-theme="light"] .device-modal-body .pill-row .mg-savepill { --mg-pc: var(--accent-ink, var(--accent)); background: #fff; border-color: rgba(0,0,0,.18); }
      .device-modal-body .pill-row .mg-favpill svg, .device-modal-body .pill-row .mg-savepill svg { width: 18px; height: 18px; display: block; }
      .device-modal-body .pill-row .mg-favpill svg path, .device-modal-body .pill-row .mg-savepill svg path { fill: none; stroke: currentColor; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
      .device-modal-body .pill-row .mg-favpill.on svg path, .device-modal-body .pill-row .mg-savepill.on svg path { fill: currentColor; }
      .device-modal-body .pill-row .mg-favpill:hover, .device-modal-body .pill-row .mg-favpill:focus-visible,
      .device-modal-body .pill-row .mg-savepill:hover, .device-modal-body .pill-row .mg-savepill:focus-visible { outline: none; border-color: var(--mg-pc); box-shadow: 0 0 0 2px rgba(var(--mg-pc-rgb),.45); transform: translateY(-1px); }
      .device-modal-body .pill-row .mg-favpill:active, .device-modal-body .pill-row .mg-savepill:active { transform: translateY(0) scale(.94); }
      .mg-link { background: none; border: 0; padding: 0 0 0 6px; color: var(--accent); font: inherit; font-weight: 700; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
      .mg-link:focus-visible { outline: 2px solid rgba(var(--accent-rgb),.6); outline-offset: 2px; border-radius: 4px; }
      .mg-rate { display: inline-flex; align-items: center; gap: 2px; padding: 4px 8px; border-radius: 9px; border: 1px solid var(--line); background: rgba(255,255,255,.03); cursor: pointer; color: var(--muted); }
      .mg-rate:focus-visible { outline: none; border-color: rgba(var(--accent-rgb),.6); box-shadow: 0 0 0 2px rgba(var(--accent-rgb),.55); }
      .mg-star { position: relative; width: 22px; height: 22px; display: inline-block; }
      .mg-star svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.6; display: block; }
      .mg-star.full svg { fill: var(--accent-2, #f5c542); stroke: var(--accent-2, #f5c542); }
      .mg-star .mg-halfc { position: absolute; inset: 0; width: 50%; overflow: hidden; }
      .mg-star .mg-halfc svg { fill: var(--accent-2, #f5c542); stroke: var(--accent-2, #f5c542); }
      .mg-rate-n { min-width: 22px; margin-left: 4px; font-size: 12px; font-weight: 800; color: var(--text); }
      .mg-len { font-size: 12px; }
      .mg-lr { display: flex; justify-content: space-between; gap: 10px; padding: 3px 0; border-bottom: 1px dashed var(--line); }
      .mg-lr > span:first-child { color: var(--muted); }
      .mg-lr > span:last-child { text-align: right; }
      .mg-pts { display: grid; gap: 8px; }
      .mg-ptr { border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; }
      .mg-ptl { display: flex; flex-direction: column; gap: 2px; font-size: 12.5px; }
      .mg-ptl span, .mg-sl span { color: var(--muted); font-size: 11.5px; }
      .mg-ptn { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; margin: 6px 0; color: var(--text); }
      .mg-diary { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
      /* Sessions nest under their playthrough (and under Other sessions): inset, with a thin guide line. */
      .mg-ptr .mg-diary { margin: 8px 0 0 10px; padding: 2px 0 0 12px; border-left: 2px solid var(--line); }
      .mg-ptr .mg-diary + .mg-row { margin-left: 24px; }
      .mg-b[hidden] { display: none; }
      .mg-ses { border-bottom: 1px solid var(--line); padding: 4px 0 6px; }
      .mg-sl { display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 12.5px; align-items: baseline; }
      .mg-tag { display: inline-block; font-size: 10.5px; padding: 1px 7px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); }
      .mg-sect .drawer-playtime { margin-bottom: 4px; }
      /* Marks on tiles: a shape and a word, never colour alone; silent. */
      /* Bottom right of the tile, on the line of the year (which is bottom left): 21 Nov 2026, the year was covered. */
      .device-card > .mg-marks { position: absolute; right: 10px; bottom: 10px; z-index: 6; display: flex; flex-wrap: wrap-reverse; justify-content: flex-end; gap: 4px; max-width: 46%; pointer-events: none; }
      .mg-m { display: inline-flex; align-items: center; gap: 3px; height: 20px; padding: 0 7px; border-radius: 999px; font-size: 10.5px; font-weight: 800; letter-spacing: .02em;
        background: rgba(10,14,20,.82); color: #fff; border: 1px solid rgba(255,255,255,.25); line-height: 1; white-space: nowrap; }
      .mg-m-fav { color: #ff7aa8; padding: 0 5px; }
      .mg-m-wish { color: #f5c542; }
      .mg-m-wish span, .mg-m-st span, .mg-m-own span { color: #fff; }
      .mg-m-own { background: rgba(60,30,10,.88); border-color: rgba(240,138,93,.7); }
      /* Settings card. */
      #mygames-section .mg-lbl { display: block; font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
      #mygames-section .mg-sub { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin: 16px 0 6px; }
      #mygames-section .mg-status { font-size: 12.5px; color: var(--text); margin: 8px 0 0; }
      #mygames-section .mg-bad { color: #f08a5d; }
      #mygames-section .mg-ask { border: 1px solid rgba(var(--accent-rgb),.4); border-radius: 10px; padding: 10px 12px; margin-top: 10px; }
      #mygames-section .mg-res { display: grid; gap: 6px; margin-top: 8px; max-height: 360px; overflow: auto; }
      #mygames-section .mg-ri { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px 10px; align-items: center; border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; }
      #mygames-section .mg-rt { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; font-size: 12.5px; min-width: 0; }
      #mygames-section .mg-rt b { overflow-wrap: anywhere; }
      #mygames-section .mg-rt span { color: var(--muted); font-size: 11.5px; }
      #mygames-section .mg-danger { margin-top: 18px; border: 1px solid rgba(240,80,80,.35); background: rgba(240,80,80,.05); border-radius: 12px; padding: 10px 12px; }
      .mg-switch { display: inline-flex; align-items: center; gap: 10px; background: none; border: 0; padding: 4px 0; color: var(--text); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
      .mg-switch:focus-visible { outline: 2px solid rgba(var(--accent-rgb),.6); outline-offset: 3px; border-radius: 8px; }
      .mg-sw { width: 38px; height: 22px; border-radius: 999px; background: rgba(255,255,255,.12); border: 1px solid var(--line); position: relative; flex: 0 0 auto; }
      .mg-sw::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--muted); transition: left .15s; }
      .mg-switch.on .mg-sw { background: rgba(var(--accent-rgb),.35); border-color: rgba(var(--accent-rgb),.7); }
      .mg-switch.on .mg-sw::after { left: 18px; background: var(--accent); }
      .mg-dlg-msg { min-height: 18px; padding: 0 22px; font-size: 12px; color: var(--muted); }
      .mg-toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 12px;
        background: var(--panel, #111820); color: var(--text); border: 1px solid var(--line); box-shadow: 0 10px 30px rgba(0,0,0,.45); font-size: 13px; max-width: calc(100vw - 32px); }
      .mg-fn { margin-left: auto; font-style: normal; font-size: 11px; color: var(--muted); padding-left: 8px; }
      @media (max-width: 600px) { .mg-b { min-height: 36px; } #mygames-section .mg-ri { flex-direction: column; align-items: flex-start; } }
      :root[data-theme="light"] .mg-b { background: rgba(0,0,0,.03); }
      :root[data-theme="light"] .mg-m { background: rgba(255,255,255,.92); color: #1a1f27; border-color: rgba(0,0,0,.2); }
      :root[data-theme="light"] .mg-m-wish span, :root[data-theme="light"] .mg-m-st span, :root[data-theme="light"] .mg-m-own span { color: #1a1f27; }
      :root[data-theme="light"] .mg-m-wish { color: #a87800; }
      :root[data-theme="light"] .mg-m-fav { color: #d43c74; }
      :root[data-theme="light"] .mg-m-own { background: #fff1e8; border-color: rgba(200,90,40,.6); }
    `;
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------ start */
  function start() {
    styles();
    document.addEventListener('click', onDrawerClick);
    document.addEventListener('keydown', onDrawerKey);
    document.addEventListener('click', onCardClick);
    document.addEventListener('input', (e) => { if (e.target && e.target.id === 'mygames-q') onSearchInput(e); });
    document.addEventListener('change', (e) => { if (e.target && e.target.classList && e.target.classList.contains('mg-file') && e.target.closest('#mygames-section')) onRestoreFile(e); });
    window.addEventListener('online', () => syncSoon(500));
    window.addEventListener('cw:preload', () => paintSaved());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncSoon(1000); });
    window.addEventListener('pagehide', () => { if (_pendingRemove) commitRemove(_pendingRemove); sendOnLeave(); });
    setInterval(() => { if (S.loaded && document.visibilityState === 'visible') syncNow('timer'); }, 300000);
    setInterval(watchVault, 1500);
    watchGrid();
    // Settings: the card is drawn as Settings opens (and its usage line asked once).
    const ov = document.getElementById('vault-overlay');
    if (ov) new MutationObserver(() => { if (ov.classList.contains('open')) { renderCard(); refreshUsage(); } }).observe(ov, { attributes: true, attributeFilter: ['class'] });
    // A drawer that opens asks the vault for anything new.
    const dov = document.getElementById('device-overlay');
    if (dov) new MutationObserver(() => { if (dov.classList.contains('open')) { _open.clear(); _closed.clear(); _more.clear(); if (S.loaded && now() - S.lastTry > 20000) syncSoon(300); } }).observe(dov, { attributes: true, attributeFilter: ['class'] });
    let tries = 0;
    const wrapAll = () => { wrapLogout(); wrapPlayTime(); if (++tries < 40) setTimeout(wrapAll, 500); };
    wrapAll();
    // Variants tables land after the page starts: anchors are matched to tiles again.
    window.addEventListener('gnw-variants', () => { _viewMemo = null; _ownMemo = null; scheduleUi(); });
    watchVault();
  }

  window.CwMyGames = {
    BUILD,
    // continuerow.js
    stamp, noteSession,
    // emby.js: the wall
    extend, shown, sig: () => S.ver + ':' + (S.loaded ? 1 : 0), filterColHTML, toggleFilter, chips, removeChip, clearFilter, chipCount: () => chips().length,
    sortValue, isOwnedTile, orderSig,
    _clearNow: (d) => { removeGame(keyOfDevice(d)); if (_pendingRemove) commitRemove(_pendingRemove); },   // tests: Clear My games data without the 4-second wait
    _own: (a, title, fields) => setGameFields(keyOfAnchor(a), fields, { anchor: a, title }),   // tests: a record as Settings makes it
    setStatus: (d, st) => { const k = keyOfDevice(d), v = view(k); return setGameFields(k, { status: st || null, status_auto: false }, { anchor: (v.recs[0] && v.recs[0].anchor) || anchorOfDevice(d), title: d && d.name }); },
    onChange: (fn) => listeners.add(fn),
    // drawer-unified.js
    drawerHTML, favButtonHTML,
    // tests and Settings
    syncNow, exportDoc, csvFiles, zipStored, restoreDoc, downloadJSON, downloadCSV, renderCard,
    state: () => ({ loaded: S.loaded, vt: S.vt, svc: S.svc, local: localOnly(), storage: storageOk, rev: S.meta.rev, games: S.games.size, sessions: S.sess.size, playthroughs: S.pts.size,
      dirty: dirtyCount(), dirtyAny: dirtyAny(), earlier: S.earlier, limit: S.limit, refused: S.refused.slice(), ownedTiles: S.loaded ? Array.from(ownedTiles().tiles.keys()) : [] }),
    viewOf: (d) => { const v = view(keyOfDevice(d)); return { status: v.status, statusAuto: v.statusAuto, completion: v.completion, favourite: v.favourite, rating: v.rating, owned: v.owned, wish: v.wish, playMs: v.playMs, sessions: v.sessions.length, pts: v.pts.length }; },
    anchorOf: anchorOfDevice, keyOf: keyOfDevice,
    search: (q) => loadCatalogue().then((list) => searchCat(list || [], q).map((g) => ({ title: g.t, shelf: g.sh, cat: g.cat, status: g.st, anchor: g.anchor, onWall: onWall(g) }))),
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

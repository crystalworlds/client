/* ===========================================================================
   cws-reach.mjs  --  reaching a game server over the internet
   ---------------------------------------------------------------------------
   Always loaded by cws.js. The vault's name, picture and PIN (items 1, 7
   and 8) are the person's identity on the whole site. Built from the game
   server's introducer protocol (docs/INTRODUCER-PROTOCOL.md, protocol 1); the
   section numbers below are that document's.

   WHAT IT DOES
     1. The vault key (4): gets the vault's key pair, or makes one, and keeps
        the private half in IndexedDB as a key page scripts cannot read. Its
        public half, in short form, is the person's connection key (3.2).
     2. The room (6): joins the introducer's room for that connection key,
        proves the key with a signed hello, and checks each waiting server's
        own signature itself.
     3. WebRTC (7): one connection per server, direct first, a relay pass from
        the room after 5 seconds without a path. Both sides sign their DTLS
        fingerprints, so the introducer cannot sit in the middle.
     4. The control channel (8.2 to 8.5): the challenge, the server's welcome,
        the person's alias and picture, the PIN hand-over and catch-up, moves.
     5. The API over data channels (8.6): cws.js's own calls, unchanged, on
        addresses of the form rtc:<server_id>/api/v1/...
     6. Trusted servers (10): each server's key is remembered in the vault and
        here; a known name with a different key waits for the person.
     7. The PIN (5): set, entered and changed against the vault; the PIN key is
        kept in memory only, for the page's life.
     8. The welcome screen (12), the Connection key card and the key and code
        changes in Settings.

   SECRETS: the vault code, the private key, PINs and PIN keys are never
   logged, never put in a URL and never sent anywhere but to the vault's own
   functions as the protocol says. Servers and the introducer see public keys,
   signatures and per-server PIN proofs only.
   ======================================================================== */
import * as P from './cws-proto.mjs?v=2.2.2';

const SUPPORTED = !!(globalThis.crypto && crypto.subtle && window.isSecureContext && window.RTCPeerConnection && window.WebSocket && window.indexedDB);

const INTRODUCER = 'wss://connect.crystalworlds.media';
const STUN = [{ urls: ['stun:stun.cloudflare.com:3478'] }];
const T_HELLO_PING = 30000, T_PONG = 10000, T_DIRECT = 5000, T_WELCOME = 15000, T_OPEN = 30000;
const ROOM_BACKOFF_MIN = 5000, ROOM_BACKOFF_MAX = 5 * 60 * 1000;
const MOVE_DAYS = 90;
const OFF_SITE_BACKOFF_MIN = 60 * 1000, OFF_SITE_BACKOFF_MAX = 30 * 60 * 1000;
const OFF_SITE_MESSAGE = 'Game servers over the internet are reached from crystalworlds.media. On this address, use Direct connect below for a server on your network.';
const K_TRUSTED = 'cws.trusted.v1';     // {vhp: {<b64u server key>: {name, sid, added}}}
const K_HELD = 'cws.keyHeld.v1';        // {vhp: {<b64u server key>: 'yes'}}: a changed key the person accepted

const RELAY_MESSAGE = 'Your game server can\'t be reached from this network right now.';
const KEY_OPEN_MESSAGE = 'This vault\'s game server key could not be opened. Your vault code may have changed on another device; reload and try again.';
const WEAK_PIN_MESSAGE = 'That PIN is too easy to guess.';
const REMOVED_MESSAGE = 'The server owner removed this vault.';
const LIMIT_MESSAGE = 'Too many new vaults from this network today. Try again tomorrow.';

/* ---------------------------------------------------------------- dev overrides
   Development only, and only on a page opened as localhost or 127.0.0.1, so a
   production page can never be pointed elsewhere: a stand-in introducer, a
   stand-in vault and the address mirror to use. */
function loopback() { const h = location.hostname; return h === 'localhost' || h === '127.0.0.1'; }
function dev(k) { if (!loopback()) return null; try { return localStorage.getItem(k); } catch (e) { return null; } }
/* Not the public address, and no stand-in introducer named for a test: the introducer will not let this page in. */
function offOwnAddress() { if (dev('cws.dev.introducer')) return false; return !/^(www\.)?crystalworlds\.media$/i.test(String(location.hostname || '').replace(/\.$/, '')); }
function introducerBase() { const o = dev('cws.dev.introducer'); return (o && /^wss?:\/\//.test(o)) ? o.replace(/\/+$/, '') : INTRODUCER; }
function vaultBase() {
  const o = dev('cws.dev.vault'); if (o && /^https?:\/\//.test(o)) return o.replace(/\/+$/, '');
  try { if (typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL) return SUPABASE_URL.replace(/\/+$/, ''); } catch (e) {}   // eslint-disable-line no-undef
  return '';
}
function baseIce() {
  const o = dev('cws.dev.ice');
  if (o !== null) { try { return JSON.parse(o); } catch (e) { return []; } }
  return STUN;
}
function anonKey() { try { return typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : ''; } catch (e) { return ''; } }   // eslint-disable-line no-undef

/* ---------------------------------------------------------------- state */
let H = null;            // the host's hooks (cws.js)
const S = {
  code: null, vhp: null, running: false,
  profileKnown: false,   // the vault answered the profile question (so a missing name is really missing)
  key: null,             // {pub: Uint8Array(65), pubB64, ck, priv: CryptoKey}
  noKey: false,          // the vault has no key yet (welcome screen not done)
  profile: null,         // {alias, avatar (data URL) | null}
  pinParams: null,       // {pin_id, salt, iterations} | {none: true}
  pinKeys: null,         // {current: {pin_id, pin_key: Uint8Array}, previous: [...]}: memory only
  rooms: [],             // Room objects: the own room, and old rooms with move notes
  conns: new Map(),      // b64u server key -> Conn
  bySid: new Map(),      // server_id -> Conn
  vaultState: 'idle',    // idle | ok | down
  msg: '',
  trustedVault: null,    // [{server_key, name}] from the vault
  pinAsk: null,          // the one PIN request in progress
};
const now = () => Date.now();
function ev(kind, data) { try { H && H.ev && H.ev('reach-' + kind, data); } catch (e) {} }
function render() { try { H && H.render && H.render(); } catch (e) {} }
function warn() { try { console.warn.apply(console, ['[cws reach]'].concat([].slice.call(arguments))); } catch (e) {} }
function rfc3339(ms) { return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z'); }

function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function trustedLocal() { return lsGet(K_TRUSTED)[S.vhp] || {}; }
function setTrustedLocal(key, val) {
  const all = lsGet(K_TRUSTED), v = all[S.vhp] || {};
  if (val) v[key] = val; else delete v[key];
  if (Object.keys(v).length) all[S.vhp] = v; else delete all[S.vhp];
  lsSet(K_TRUSTED, all);
}
function heldOk(key) { return (lsGet(K_HELD)[S.vhp] || {})[key] === 'yes'; }
function setHeldOk(key) { const all = lsGet(K_HELD), v = all[S.vhp] || {}; v[key] = 'yes'; all[S.vhp] = v; lsSet(K_HELD, all); }

/* ---------------------------------------------------------------- IndexedDB: the signing keys
   One record per vault partition: {pub, priv (a CryptoKey that cannot be
   exported), ck}. The browser stores the CryptoKey itself; no page script can
   read the private half out of it (4.1 step 4). */
let _kdb = null;
function kdb() {
  if (_kdb) return _kdb;
  _kdb = new Promise((res, rej) => {
    const r = indexedDB.open('cws-reach', 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('keys')) r.result.createObjectStore('keys'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }).catch(() => null);
  return _kdb;
}
/* Log out: the page is about to delete this database, so this page lets go of it first. */
function closeDb() { const p = _kdb; _kdb = null; if (p) return p.then((d) => { try { d && d.close(); } catch (e) {} }); return Promise.resolve(); }
async function kget(k) {
  const d = await kdb(); if (!d) return null;
  return new Promise((res) => { try { const q = d.transaction('keys', 'readonly').objectStore('keys').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); } catch (e) { res(null); } });
}
async function kput(k, v) {
  const d = await kdb(); if (!d) return;
  return new Promise((res) => { try { const tx = d.transaction('keys', 'readwrite'); if (v) tx.objectStore('keys').put(v, k); else tx.objectStore('keys').delete(k); tx.oncomplete = tx.onerror = () => res(); } catch (e) { res(); } });
}

/* ---------------------------------------------------------------- the vault's functions (protocol 11)
   Called as the vault's other functions are: POST <project>/rest/v1/rpc/<name>
   with the public key. Byte values travel as b64u text. The names and
   parameters are the vault's (the vault API); only this table knows them. */
const VF = {
  getKey: (c) => ['get_vault_key', { p_vault: c }],
  createKey: (c, pub, blob) => ['create_vault_key', { p_vault: c, p_public_key: pub, p_locked_key: blob }],
  rotateKeep: (o, n, blob, olds) => ['rotate_vault_keep_key', { p_old: o, p_new: n, p_locked_key: blob, p_old_locked_keys: olds }],
  replaceKey: (c, pub, blob, note) => ['replace_vault_key', { p_vault: c, p_public_key: pub, p_locked_key: blob, p_note: note }],
  listMoves: (c) => ['list_key_moves', { p_vault: c }],
  listServers: (c) => ['list_vault_servers', { p_vault: c }],
  addServer: (c, key, name) => ['add_vault_server', { p_vault: c, p_server_key: key, p_name: name }],
  forgetServer: (c, key) => ['forget_vault_server', { p_vault: c, p_server_key: key }],
  getProfile: (c) => ['get_vault_profile', { p_vault: c }],
  setProfile: (c, alias, avatar, type) => ['set_vault_profile', { p_vault: c, p_alias: alias, p_avatar: avatar, p_avatar_type: type }],
  pinParams: (c) => ['get_pin_params', { p_vault: c }],
  setPin: (c, salt, it, x) => ['set_vault_pin', { p_vault: c, p_salt: salt, p_iterations: it, p_x: x }],
  pinKeys: (c, x) => ['get_pin_keys', { p_vault: c, p_x: x }],
  changePin: (c, ox, salt, it, nx) => ['change_vault_pin', { p_vault: c, p_old_x: ox, p_salt: salt, p_iterations: it, p_new_x: nx }],
};
/* recover-vault (20 Nov 2026): the vault keeps only a fingerprint of the recovery email (a keyed hash made
   by this function, whose key the database never has) and a hint (p•••@gmail.com). It mails a vault code to the address
   typed, once the vault has checked the PIN; it also gives the PIN salt for an address ({action: 'params'}) and saves,
   changes or removes the recovery email ({action: 'save'}). The site never receives a full address back. */
const EF = { recover: 'recover-vault' };
async function vcall(spec) {
  const base = vaultBase(); if (!base) throw Object.assign(new Error('The vault service cannot be reached right now.'), { code: 'vault_down' });
  const [name, params] = spec, key = anonKey(), headers = { 'Content-Type': 'application/json' };
  if (key) { headers.apikey = key; headers.Authorization = 'Bearer ' + key; }
  let r;
  try { r = await fetch(base + '/rest/v1/rpc/' + name, { method: 'POST', headers, body: JSON.stringify(params), mode: 'cors', credentials: 'omit', cache: 'no-store' }); }
  catch (e) { S.vaultState = 'down'; throw Object.assign(new Error('The vault service cannot be reached right now.'), { code: 'vault_down' }); }
  let j = null; try { j = await r.json(); } catch (e) { j = null; }
  if (r.status >= 500) { S.vaultState = 'down'; throw Object.assign(new Error('The vault service cannot be reached right now.'), { code: 'vault_down' }); }
  S.vaultState = 'ok';
  if (r.status >= 400) throw Object.assign(new Error((j && (j.message || j.hint)) || ('vault ' + r.status)), { code: (j && j.code) || 'vault_refused', info: j });
  if (j && j.ok === false) throw Object.assign(new Error(j.message || j.error || 'refused'), { code: j.error || 'refused', info: j });
  return j;
}
async function efcall(name, body) {
  const base = vaultBase(); if (!base) throw Object.assign(new Error('The vault service cannot be reached right now.'), { code: 'vault_down' });
  const key = anonKey(), headers = { 'Content-Type': 'application/json' };
  if (key) { headers.apikey = key; headers.Authorization = 'Bearer ' + key; }
  let r;
  try { r = await fetch(base + '/functions/v1/' + name, { method: 'POST', headers, body: JSON.stringify(body), mode: 'cors', credentials: 'omit', cache: 'no-store' }); }
  catch (e) { throw Object.assign(new Error('The vault service cannot be reached right now.'), { code: 'vault_down' }); }
  let j = null; try { j = await r.json(); } catch (e) { j = null; }
  if (r.status >= 500) throw Object.assign(new Error('The vault service cannot be reached right now.'), { code: 'vault_down' });
  if (r.status >= 400 || (j && j.ok === false)) throw Object.assign(new Error((j && (j.message || j.error)) || ('HTTP ' + r.status)), { code: (j && j.error) || 'refused', info: j });
  return j || {};
}
const u8 = (s, n) => P.unb64u(s, n);

/* ---------------------------------------------------------------- 4: the vault key */
async function importKeyRecord(code, rec) {
  const pub = u8(rec.public_key, 65);
  const ck = await P.connectionKey(pub);
  if (rec.connection_key && rec.connection_key !== ck) throw new Error('connection key mismatch');
  const priv = await P.unlockKey(code, u8(rec.locked_key, 61), pub, false);
  return { pub, pubB64: rec.public_key, ck, priv };
}
async function loadKey() {
  const local = await kget(S.vhp);
  let rec;
  try { rec = await vcall(VF.getKey(S.code)); }
  catch (e) {
    if (local) { S.key = local; return local; }   // vault unreachable: this browser's copy still signs
    throw e;
  }
  if (!rec || rec.none) { S.noKey = true; S.key = null; if (local) await kput(S.vhp, null); return null; }
  S.noKey = false;
  if (local && local.pubB64 === rec.public_key) { S.key = local; return local; }
  let k;
  try { k = await importKeyRecord(S.code, rec); } catch (e) { S.msg = KEY_OPEN_MESSAGE; throw Object.assign(new Error(KEY_OPEN_MESSAGE), { code: 'key_locked' }); }
  await kput(S.vhp, k);
  S.key = k;
  return k;
}
/* 4.1: a new key pair, its private half exported only for this step. */
async function newKeyPair() {
  const kp = await P.generateKeyPair();
  const pub = await P.exportPublicKey(kp.publicKey);
  const d = await P.exportScalar(kp.privateKey);
  const priv = await P.importPrivateKey(d, pub, false);
  return { pub, pubB64: P.b64u(pub), ck: await P.connectionKey(pub), priv, d };
}
async function storeNewKey(fresh) {
  const blob = await P.lockKey(S.code, fresh.d, fresh.pub);
  const rec = await vcall(VF.createKey(S.code, fresh.pubB64, P.b64u(blob)));
  let k;
  if (rec && rec.public_key && rec.public_key !== fresh.pubB64) k = await importKeyRecord(S.code, rec);   // another browser won (4.1 step 3)
  else k = { pub: fresh.pub, pubB64: fresh.pubB64, ck: fresh.ck, priv: fresh.priv };
  fresh.d.fill(0);
  await kput(S.vhp, k);
  S.key = k; S.noKey = false;
  return k;
}

/* ---------------------------------------------------------------- 5: the PIN */
function pinWeak(pin) {
  const n = pin.length, d = [...pin].map(Number);
  let same = true, up = true, down = true;
  for (let i = 1; i < n; i++) { same = same && d[i] === d[0]; up = up && d[i] === (d[i - 1] + 1) % 10; down = down && d[i] === (d[i - 1] + 9) % 10; }
  if (same || up || down) return true;
  for (let p = 1; p <= n / 2; p++) if (n % p === 0 && pin === pin.slice(0, p).repeat(n / p)) return true;
  if (n % 2 === 0) {
    let doubled = true, mirror = true;
    for (let i = 0; i < n; i += 2) doubled = doubled && pin[i] === pin[i + 1];
    for (let i = 0; i < n / 2; i++) mirror = mirror && pin[i] === pin[n - 1 - i];
    if (doubled || mirror) return true;
  }
  return ['147258', '258369', '159753', '951753', '147852', '963852', '789456', '456789', '102030', '112233',
    '520520', '123321', '654456', '142536', '741852', '852963', '369258', '198410', '199001', '200000'].indexOf(pin) >= 0;
}
/* A PIN to set: 6 to 12 digits and not an obvious one (5.6). '' when fine. */
function newPinProblem(pin) {
  if (!P.validPin(pin)) return 'A PIN is 6 to 12 digits.';
  if (pinWeak(pin)) return WEAK_PIN_MESSAGE;
  return '';
}
async function loadPinParams() {
  try { const r = await vcall(VF.pinParams(S.code)); S.pinParams = (r && !r.none) ? r : { none: true }; }
  catch (e) { if (!S.pinParams) S.pinParams = null; }
  return S.pinParams;
}
function keepPinKeys(r) {
  const one = (x) => ({ pin_id: x.pin_id, pin_key: u8(x.pin_key, 32) });
  S.pinKeys = { current: one(r.current || r), previous: (r.previous || []).map(one) };
  S.pinParams = Object.assign({}, S.pinParams || {}, { pin_id: S.pinKeys.current.pin_id, none: false });
  delete S.pinParams.none;
  return S.pinKeys;
}
function pinError(e) {
  const i = e.info || {};
  if (e.code === 'pin_incorrect') {
    const n = i.attempts_remaining;
    return 'That PIN isn\'t right.' + (typeof n === 'number' ? ' ' + H.ui.plural(n, 'try', 'tries') + ' left before PIN checks are locked for a while.' : '');
  }
  if (e.code === 'pin_locked') {
    const until = i.locked_until ? Date.parse(i.locked_until) : now() + (+i.retry_after_seconds || 900) * 1000;
    return 'Too many wrong PINs. You can try again at ' + H.ui.fmtTime(until) + '.';
  }
  if (e.code === 'vault_down') return 'The vault service cannot be reached right now. Try again in a moment.';
  if (e.code === 'vault_limit' || e.code === 'key_limit') return LIMIT_MESSAGE;
  return 'Your PIN could not be checked (' + (e.code || e.message) + ').';
}
async function unlockPin(pin) {
  const pp = await loadPinParams();
  if (!pp || pp.none) throw Object.assign(new Error('No PIN set yet.'), { code: 'no_pin' });
  const x = await P.pinStretch(pin, u8(pp.salt, 16), pp.iterations);
  const r = await vcall(VF.pinKeys(S.code, P.b64u(x)));
  return keepPinKeys(r);
}
async function setPin(pin) {
  const salt = P.randomBytes(16), x = await P.pinStretch(pin, salt, P.PIN_ITERATIONS);
  const r = await vcall(VF.setPin(S.code, P.b64u(salt), P.PIN_ITERATIONS, P.b64u(x)));
  S.pinParams = { pin_id: r.pin_id, salt: P.b64u(salt), iterations: P.PIN_ITERATIONS };
  keepPinKeys({ current: r, previous: [] });
  return S.pinKeys;
}
async function changePin(oldPin, newPin) {
  const pp = await loadPinParams();
  if (!pp || pp.none) throw Object.assign(new Error('No PIN set yet.'), { code: 'no_pin' });
  const ox = await P.pinStretch(oldPin, u8(pp.salt, 16), pp.iterations);
  const salt = P.randomBytes(16), nx = await P.pinStretch(newPin, salt, P.PIN_ITERATIONS);
  const r = await vcall(VF.changePin(S.code, P.b64u(ox), P.b64u(salt), P.PIN_ITERATIONS, P.b64u(nx)));
  S.pinParams = { pin_id: r.current.pin_id, salt: P.b64u(salt), iterations: P.PIN_ITERATIONS };
  keepPinKeys(r);
  return S.pinKeys;
}

/* ---------------------------------------------------------------- 6: the room */
class Room {
  constructor(key, note) { this.key = key; this.note = note || null; this.ws = null; this.backoff = ROOM_BACKOFF_MIN; this.timer = 0; this.ping = 0; this.pong = 0; this.state = 'idle'; this.msg = ''; this.servers = new Map(); this.closed = false; }
  get ck() { return this.key.ck; }
  open() {
    if (this.closed || !S.running) return;
    clearTimeout(this.timer);
    let ws;
    try { ws = new WebSocket(introducerBase() + '/v1/room/' + this.ck, 'cws-intro-v1'); }
    catch (e) { this.retry(this.backoff); return; }
    this.ws = ws; this.state = 'joining'; render();
    ws.onmessage = (e) => { if (ws === this.ws) this.onMessage(e.data); };
    ws.onclose = (e) => { if (ws === this.ws) this.onClose(e.code); };
    ws.onerror = () => {};
  }
  send(o) { try { if (this.ws && this.ws.readyState === 1) { this.ws.send(typeof o === 'string' ? o : JSON.stringify(o)); return true; } } catch (e) {} return false; }
  async onMessage(data) {
    if (data === '{"t":"pong"}') { this.pong = now(); return; }
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'nonce') return this.hello(m.nonce);
    if (m.t === 'welcome') {
      this.state = 'joined'; this.backoff = ROOM_BACKOFF_MIN; this.joinedAt = now(); this.everJoined = true; this.msg = '';
      this.servers.clear();   // the room's own list from now on
      this.startPing();
      ev('room', { joined: true, servers: (m.servers || []).length });
      for (const s of (m.servers || [])) await this.serverSeen(s);
      render();
      return;
    }
    if (m.t === 'server-joined') return this.serverSeen(m.server);
    if (m.t === 'server-left') {
      this.servers.delete(m.server_key);
      /* An open connection stays up (6.6): the server may still have something to say on it (a refused
         when its owner removed this person), and it ends when the server closes it. */
      const c = S.conns.get(m.server_key); if (c && c.room === this && !(c.state === 'open' && c.isUp())) c.gone('left');
      return;
    }
    if (m.session) { for (const c of S.conns.values()) if (c.room === this && c.session === m.session) return c.onSignal(m); }
  }
  async hello(nonce) {
    try {
      const lines = P.buildLines('visitor-hello', { room: this.ck, key: this.key.pubB64, nonce });
      const sig = P.b64u(await P.sign(this.key.priv, lines));
      const trusted = this.note ? [] : (await Promise.all(Object.keys(trustedLocal()).slice(0, 32).map((k) => P.serverKeyCode(u8(k, 65)).catch(() => null)))).filter(Boolean);
      this.send({ t: 'visitor-hello', key: this.key.pubB64, trusted, sig });
    } catch (e) { warn('hello', e && e.message); try { this.ws.close(); } catch (x) {} }
  }
  /* 6.4: the browser checks each server's own hello signature, never the room's word. */
  async serverSeen(s) {
    if (!s || typeof s.server_key !== 'string') return;
    let pub;
    try { pub = u8(s.server_key, 65); } catch (e) { return; }
    const lines = P.buildLines('server-hello', { room: this.ck, key: s.server_key, nonce: String(s.nonce || '') });
    let ok = false; try { ok = await P.verify(pub, lines, u8(String(s.sig || ''), 64)); } catch (e) { ok = false; }
    if (!ok) { ev('server-refused', { why: 'hello signature' }); return; }
    this.servers.set(s.server_key, pub);
    let c = S.conns.get(s.server_key);
    if (c && c.room !== this) {
      if (this.note) return;            // reached through the own room already
      c.teardown(true); c = null;       // it moved: from now on it is met in the own room
    }
    if (!c) { c = new Conn(this, s.server_key, pub); S.conns.set(s.server_key, c); }
    if (c.state === 'idle' || c.state === 'failed' || c.state === 'gone') { c.final = false; c.start(); }
  }
  startPing() {
    clearInterval(this.ping);
    this.pong = now();
    this.ping = setInterval(() => {
      if (!this.ws || this.ws.readyState !== 1) return;
      this.send('{"t":"ping"}');
      const sent = now();
      setTimeout(() => { if (this.pong < sent && this.ws && this.ws.readyState === 1) { try { this.ws.close(); } catch (e) {} } }, T_PONG);
    }, T_HELLO_PING);
  }
  onClose(code) {
    clearInterval(this.ping); this.ws = null;
    if (this.closed || !S.running) { this.state = 'idle'; return; }
    this.state = 'down';
    if (code === 4403) { this.state = 'refused'; this.msg = 'CrystalWorlds could not confirm this browser\'s key.'; render(); return; }   // do not reconnect
    if (code === 4400 || code === 4401 || code === 4429) { this.msg = 'CrystalWorlds is busy. Try again in a few minutes.'; this.retry(5 * 60 * 1000 + Math.random() * 5000); }
    else if (!this.everJoined && offOwnAddress()) {
      /* The introducer takes only the public address, so a copy of the site at another address (a home
         copy, a local test) is never let in. One calm line on the card, and a slow retry in case it is. */
      this.msg = OFF_SITE_MESSAGE;
      this.backoff = Math.max(this.backoff, OFF_SITE_BACKOFF_MIN);
      this.retry(this.backoff + Math.random() * 5000);
      this.backoff = Math.min(this.backoff * 2, OFF_SITE_BACKOFF_MAX);
    } else {
      this.msg = 'Can\'t reach CrystalWorlds to find your servers.';
      if (this.joinedAt && now() - this.joinedAt > 60000) this.backoff = ROOM_BACKOFF_MIN;
      this.retry(this.backoff);
      this.backoff = Math.min(this.backoff * 2, ROOM_BACKOFF_MAX);
    }
    render();
  }
  retry(ms) { clearTimeout(this.timer); this.retryAt = now() + ms; this.timer = setTimeout(() => this.open(), ms); }
  close() { this.closed = true; clearTimeout(this.timer); clearInterval(this.ping); if (this.ws) { try { this.ws.close(1000); } catch (e) {} } this.ws = null; }
}

/* ---------------------------------------------------------------- 7, 8: one server */
class Conn {
  constructor(room, serverKey, pub) {
    this.room = room; this.serverKey = serverKey; this.pub = pub;
    this.state = 'idle'; this.session = ''; this.pc = null; this.ctrl = null; this.relay = null; this.relayAsked = false;
    this.name = ''; this.sid = ''; this.kind = ''; this.msg = '';
    this.waiters = []; this.tries = 0; this.retryT = 0;
  }
  get move() { return this.room.note; }
  async start(ice) {
    clearTimeout(this.retryT);
    this.teardown(false);
    this.state = 'connecting'; this.msg = '';
    const session = this.session = P.b64u(P.randomBytes(16));
    const pc = this.pc = new RTCPeerConnection({ iceServers: baseIce().concat(ice || []) });
    const ctrl = this.ctrl = pc.createDataChannel('cws-control/1', { ordered: true });
    this.out = []; this.sent = false; this.remoteSet = false; this.inbox = [];
    pc.onicecandidate = (e) => {
      const m = { t: 'candidate', session, candidate: e.candidate ? e.candidate.toJSON() : null };
      if (this.sent) this.room.send(m); else this.out.push(m);
    };
    pc.onconnectionstatechange = () => {
      if (pc !== this.pc) return;
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.lost('connection ' + pc.connectionState);
    };
    ctrl.onopen = () => { if (ctrl === this.ctrl) this.welcomeT = setTimeout(() => this.fail('no welcome'), T_WELCOME); };
    ctrl.onmessage = (e) => { if (ctrl === this.ctrl && typeof e.data === 'string') this.onControl(e.data); };
    ctrl.onclose = () => { if (ctrl === this.ctrl) this.lost('control closed'); };
    try {
      await pc.setLocalDescription(await pc.createOffer());
      const sdp = pc.localDescription.sdp, fp = P.sdpFingerprint(sdp);
      if (!fp) throw new Error('no single sha-256 fingerprint in our offer');
      this.fp = fp;
      const lines = P.buildLines('offer', { room: this.room.ck, session, visitor_key: this.room.key.pubB64, server_key: this.serverKey, fp });
      const fp_sig = P.b64u(await P.sign(this.room.key.priv, lines));
      if (pc !== this.pc) return;
      if (!this.room.send({ t: 'offer', session, to: this.serverKey, sdp, fp, fp_sig })) throw new Error('room closed');
      this.sent = true; this.out.forEach((m) => this.room.send(m)); this.out = [];
    } catch (e) { this.fail(e.message); return; }
    /* 7: direct first; no path in 5 s asks the room for a relay pass (once per server visit). */
    this.directT = setTimeout(() => {
      if (pc !== this.pc || this.isUp()) return;
      if (!ice && !this.relayAsked) { this.relayAsked = true; this.room.send({ t: 'relay-request', session }); }
    }, T_DIRECT);
    this.openT = setTimeout(() => { if (pc === this.pc && this.state === 'connecting') this.fail('timeout'); }, T_OPEN);
  }
  isUp() { const p = this.pc; return !!p && (p.connectionState === 'connected' || p.iceConnectionState === 'connected' || p.iceConnectionState === 'completed'); }
  async onSignal(m) {
    if (m.t === 'answer') {
      if (this.remoteSet || m.server_key !== this.serverKey) return;
      /* 10: the answer's SDP fingerprint must be one sha-256 line equal to fp, signed by this server's key. */
      let ok = P.checkSdpFingerprint(m.sdp, m.fp);
      if (ok) {
        const lines = P.buildLines('answer', { room: this.room.ck, session: this.session, visitor_key: this.room.key.pubB64, server_key: this.serverKey, fp: m.fp });
        try { ok = await P.verify(this.pub, lines, u8(String(m.fp_sig || ''), 64)); } catch (e) { ok = false; }
      }
      if (!ok) { this.room.send({ t: 'bye', session: this.session }); ev('server-refused', { why: 'answer signature' }); this.fail('answer refused', true); return; }
      this.serverFp = m.fp;
      try {
        await this.pc.setRemoteDescription({ type: 'answer', sdp: m.sdp });
        this.remoteSet = true;
        for (const c of this.inbox) await this.pc.addIceCandidate(c).catch(() => {});
        this.inbox = [];
      } catch (e) { this.fail('answer not usable'); }
      return;
    }
    if (m.t === 'candidate') {
      if (!m.candidate) return;
      if (this.remoteSet) this.pc.addIceCandidate(m.candidate).catch(() => {}); else this.inbox.push(m.candidate);
      return;
    }
    if (m.t === 'relay') {
      const ice = (m.ice_servers || []).map((s) => {
        const urls = [].concat(s.urls || []).filter((u) => !/:53(\?|$)/.test(u));   // 9.5: :53 addresses time out in browsers
        return urls.length ? Object.assign({}, s, { urls }) : null;
      }).filter(Boolean);
      this.relay = ice; ev('relay', { server: this.serverKey.slice(0, 8) });
      if (!this.isUp()) { this.room.send({ t: 'bye', session: this.session }); this.start(ice); }
      return;
    }
    if (m.t === 'bye') { this.lost('bye'); return; }
    if (m.t === 'error') {
      if (/^relay_/.test(m.code || '')) { this.msg = RELAY_MESSAGE; ev('relay-refused', { code: m.code }); render(); return; }
      if (m.code === 'unknown_server') { this.gone('unknown'); return; }
      this.fail(m.code || 'error');
    }
  }
  sendCtrl(o) { try { if (this.ctrl && this.ctrl.readyState === 'open') { this.ctrl.send(JSON.stringify(o)); return true; } } catch (e) {} return false; }
  async onControl(text) {
    let m; try { m = JSON.parse(text); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'challenge') {
      try {
        const lines = P.buildLines('channel', { room: this.room.ck, visitor_key: this.room.key.pubB64, server_key: this.serverKey, challenge: String(m.challenge), visitor_fp: this.fp, server_fp: this.serverFp });
        this.sendCtrl({ t: 'proof', sig: P.b64u(await P.sign(this.room.key.priv, lines)) });
      } catch (e) { this.fail('proof'); }
      return;
    }
    if (m.t === 'refused') {
      clearTimeout(this.welcomeT);
      if (m.code === 'not_listed') { this.msg = REMOVED_MESSAGE; this.removed = true; }
      else this.msg = 'This server did not accept this browser\'s proof.';
      this.fail(m.code || 'refused', true);
      if (this.removed) { const k = this.serverKey, sid = this.sid || (trustedLocal()[k] || {}).sid; try { H.removed && H.removed(sid || '', k); } catch (e) {} }
      return;
    }
    if (m.t === 'welcome') { clearTimeout(this.welcomeT); return this.welcomed(m); }
    const w = this.waiters.shift();
    if (w && (m.t === 'pin-ok' || m.t === 'pin-refused' || m.t === 'move-ok' || m.t === 'move-refused')) w(m);
  }
  ask(o, ms) {
    return new Promise((res) => {
      const t = setTimeout(() => { const i = this.waiters.indexOf(done); if (i >= 0) this.waiters.splice(i, 1); res({ t: 'timeout' }); }, ms || 15000);
      const done = (m) => { clearTimeout(t); res(m); };
      this.waiters.push(done);
      if (!this.sendCtrl(o)) done({ t: 'closed' });
    });
  }
  async welcomed(m) {
    if (this.welcomedFor === this.session) return;   // one welcome per connection
    this.welcomedFor = this.session;
    const srv = m.server || {};
    this.name = String(srv.name || '').slice(0, 64);
    if (this.move) return this.handMove();
    /* 10: a known name with a different key is held until the person says so. */
    const clash = this.keyClash();
    if (clash && !heldOk(this.serverKey)) {
      this.state = 'held'; render();
      keyChangeDialog(this, clash);
      return;
    }
    return this.letIn();
  }
  keyClash() {
    const t = trustedLocal();
    if (t[this.serverKey]) return null;
    const vt = S.trustedVault || [];
    for (const k in t) if (t[k].name && t[k].name === this.name) return { key: k, name: t[k].name };
    for (const r of vt) if (r.server_key !== this.serverKey && r.name && r.name === this.name) return { key: r.server_key, name: r.name };
    return null;
  }
  async letIn() {
    try {
      if (S.profile) this.sendCtrl({ t: 'visitor-info', alias: S.profile.alias || '', avatar: S.profile.avatar || null });
      this.state = 'open';   // http channels are allowed from here (8.1)
      const r = await rtcFetch('rtc:' + this.serverKey + '/api/v1/health', { method: 'GET', byKey: true }, 8000);
      const h = await r.json();
      if (!h || !/^[a-z2-7]{26}$/.test(h.server_id || '')) throw new Error('no server id');
      const other = S.bySid.get(h.server_id);
      if (other && other !== this) other.teardown(true);
      this.sid = h.server_id; this.health = h;
      S.bySid.set(this.sid, this);
      /* Forgotten on this browser: nothing more is sent, and it is not trusted again until Use again. */
      if (H.hidden && H.hidden(this.sid)) { this.teardown(false); this.state = 'hidden'; this.flushOpen(false); try { H.found(this.sid); } catch (e) {} render(); return; }
      this.kind = await pathKind(this.pc);
      await this.trust();
      this.tries = 0;
      ev('open', { server: this.sid, kind: this.kind });
      const ws = this.waitersOpen || []; this.waitersOpen = [];
      ws.forEach((f) => f(true));
      try { H.found(this.sid, { name: this.name }); } catch (e) {}
      render();
    } catch (e) { this.fail('after welcome: ' + (e && e.message)); }
  }
  async trust() {
    const t = trustedLocal(), had = t[this.serverKey];
    setTrustedLocal(this.serverKey, { name: this.name, sid: this.sid, added: (had && had.added) || rfc3339(now()) });
    const inVault = (S.trustedVault || []).some((r) => r.server_key === this.serverKey && r.name === this.name);
    if (!inVault) {
      try {
        await vcall(VF.addServer(S.code, this.serverKey, this.name || 'Game server'));
        S.trustedVault = (S.trustedVault || []).filter((r) => r.server_key !== this.serverKey).concat([{ server_key: this.serverKey, name: this.name }]);
      } catch (e) { warn('trusted list', e && e.code); }
    }
  }
  /* 8.5: a move note, handed over on a connection made in the old room. */
  async handMove() {
    const r = await this.ask({ t: 'move', note: this.move });
    ev('move', { answer: r.t, code: r.code || '' });
    this.teardown(true); this.state = 'moved';
  }
  fail(why, final) {
    if (this.state === 'gone' || this.state === 'held') return;
    warn('connection', why);
    this.teardown(false);
    this.state = 'failed'; this.final = !!final;
    if (!this.msg) this.msg = 'Not reachable from here right now.';
    this.flushOpen(false);
    if (this.sid) { try { H.lost(this.sid, this.msg); } catch (e) {} }
    render();
    if (!final && this.room.servers.has(this.serverKey) && S.running) {
      const wait = Math.min(5000 * Math.pow(2, this.tries++), 5 * 60 * 1000);
      this.retryT = setTimeout(() => { if (this.state === 'failed' && this.room.servers.has(this.serverKey)) { this.relayAsked = false; this.start(this.relay || undefined); } }, wait);
    }
  }
  lost(why) { if (this.state === 'open' || this.state === 'connecting') this.fail(why); }
  gone() { this.teardown(false); this.state = 'gone'; this.flushOpen(false); if (this.sid) { try { H.lost(this.sid, 'Not online now.'); } catch (e) {} } render(); }
  flushOpen(ok) { const ws = this.waitersOpen || []; this.waitersOpen = []; ws.forEach((f) => f(ok)); }
  teardown(silent) {
    clearTimeout(this.directT); clearTimeout(this.openT); clearTimeout(this.welcomeT);
    if (this.pc) { if (this.session && !silent) this.room.send({ t: 'bye', session: this.session }); try { this.pc.close(); } catch (e) {} }
    this.pc = null; this.ctrl = null; this.remoteSet = false;
    this.waiters.splice(0).forEach((w) => w({ t: 'closed' }));
    if (silent) this.state = 'idle';
  }
}
/* What the chosen path is: both ends' own addresses (home network), a relay, or straight across the internet. */
async function pathKind(pc) {
  try {
    const st = await pc.getStats(); let pair = null; const by = {};
    st.forEach((r) => { by[r.id] = r; });
    st.forEach((r) => { if (r.type === 'transport' && r.selectedCandidatePairId) pair = by[r.selectedCandidatePairId]; });
    if (!pair) st.forEach((r) => { if (r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded') pair = r; });
    const l = pair && by[pair.localCandidateId], rm = pair && by[pair.remoteCandidateId];
    if ((l && l.candidateType === 'relay') || (rm && rm.candidateType === 'relay')) return 'relay';
    if (l && rm && l.candidateType === 'host' && rm.candidateType === 'host') return 'lan';
    return 'rtc';
  } catch (e) { return 'rtc'; }
}

/* ---------------------------------------------------------------- 8.6: the API over a data channel */
const NULL_BODY = { 101: 1, 204: 1, 205: 1, 304: 1 };
function netErr(msg) { return Object.assign(new TypeError(msg || 'connection lost'), { rtc: true }); }
function rtcFetch(url, opt, ms) {
  opt = opt || {};
  const m = /^rtc:([A-Za-z0-9_-]+)(\/[^\s]*)$/.exec(url);
  if (!m) return Promise.reject(netErr('bad address'));
  const c = opt.byKey ? S.conns.get(m[1]) : S.bySid.get(m[1]);
  if (!c || c.state !== 'open' || !c.pc) return Promise.reject(netErr('not connected'));
  const body = opt.body == null ? null : String(opt.body);
  if (body && new TextEncoder().encode(body).length > 16384) return Promise.reject(netErr('request too large'));
  const headers = {};
  if (opt.headers) {
    if (typeof opt.headers.forEach === 'function' && !(opt.headers instanceof Object && opt.headers.constructor === Object)) opt.headers.forEach((v, k) => { headers[k] = v; });
    else for (const k in opt.headers) headers[k] = String(opt.headers[k]);
  }
  return new Promise((resolve, reject) => {
    let dc;
    try { dc = c.pc.createDataChannel('cws-http/1', { ordered: true }); } catch (e) { reject(netErr('channel')); return; }
    dc.binaryType = 'arraybuffer';
    let ctl = null, head = null, done = false, settled = false;
    const stream = new ReadableStream({ start(x) { ctl = x; }, cancel() { done = true; try { dc.close(); } catch (e) {} } });
    const t = setTimeout(() => fail(new DOMException('The request timed out.', 'AbortError')), ms || 20000);
    const sig = opt.signal;
    const onAbort = () => fail(new DOMException('The request was aborted.', 'AbortError'));
    if (sig) { if (sig.aborted) { onAbort(); return; } sig.addEventListener('abort', onAbort); }
    function fail(err) {
      if (done) return; done = true;
      clearTimeout(t); if (sig) sig.removeEventListener('abort', onAbort);
      try { dc.close(); } catch (e) {}
      if (!settled) { settled = true; reject(err); } else { try { ctl.error(err); } catch (e) {} }
    }
    dc.onopen = () => { try { dc.send(JSON.stringify({ method: opt.method || 'GET', path: m[2], headers, body })); } catch (e) { fail(netErr()); } };
    dc.onmessage = (e) => {
      if (done) return;
      if (typeof e.data === 'string') {
        let j; try { j = JSON.parse(e.data); } catch (x) { fail(netErr('bad answer')); return; }
        if (!head) {
          head = j; clearTimeout(t);
          const hd = new Headers();
          Object.keys(j.headers || {}).forEach((k) => { const v = j.headers[k]; try { hd.set(k, Array.isArray(v) ? v.join(', ') : String(v)); } catch (x) {} });
          const status = +j.status;
          if (!(status >= 200 && status <= 599)) { fail(netErr('bad status')); return; }
          settled = true;
          resolve(new Response(NULL_BODY[status] ? null : stream, { status, headers: hd }));
          return;
        }
        if (j.end) { done = true; if (sig) sig.removeEventListener('abort', onAbort); try { ctl.close(); } catch (x) {} try { dc.close(); } catch (x) {} }
        return;
      }
      if (head) { try { ctl.enqueue(new Uint8Array(e.data)); } catch (x) {} }
    };
    dc.onclose = () => fail(netErr('connection lost'));
    dc.onerror = () => fail(netErr('connection lost'));
  });
}

/* ---------------------------------------------------------------- Direct connect: the signed vault identity (item 6)
   The person arrives as their vault by Direct connect too: the connection key, alias and picture,
   signed by the vault key over the server's own challenge (cws-direct-join-v1). */
async function directIdentity(serverKey, challenge) {
  if (!S.key) throw Object.assign(new Error('no vault key yet'), { code: 'no_key' });
  if (!(S.profile && S.profile.alias)) throw Object.assign(new Error('no name yet'), { code: 'no_profile' });
  const alias = S.profile.alias, avatar = S.profile.avatar && /^data:image\/png;base64,/.test(S.profile.avatar) ? S.profile.avatar : null;
  const profile = await P.profileHash(alias, avatar);
  const lines = P.buildLines('direct-join', { room: S.key.ck, visitor_key: S.key.pubB64, server_key: serverKey, challenge, profile });
  const sig = P.b64u(await P.sign(S.key.priv, lines));
  return { public_key: S.key.pubB64, challenge, alias, avatar, sig };
}
/* Whether the vault's name and key are ready (the welcome screen is done). */
function identityReady() { return !!(S.key && S.profile && S.profile.alias); }

/* ---------------------------------------------------------------- start and stop */
async function start(host) {
  H = host;
  wrapRecover();
  const code = H.code(), vhp = H.vhp();
  if (!code || !vhp) return;
  if (S.running && S.code === code) return;
  stop();
  S.code = code; S.vhp = vhp; S.running = true; S.msg = ''; S.pinKeys = null; S.pinParams = null; S.profile = null; S.profileKnown = false; _fresh = null; S.key = null; S.noKey = false; S.trustedVault = null;
  setGate('checking');
  watchMe();
  if (!SUPPORTED) { S.msg = 'This browser or this address cannot reach game servers over the internet: it needs the secure (https) version of this site and WebRTC.'; setGate('open'); render(); return; }
  wrapRotate(); wrapEmail(); wrapImport(); emailWords();
  try { await loadKey(); }
  catch (e) { S.msg = e.code === 'key_locked' ? KEY_OPEN_MESSAGE : 'Can\'t reach CrystalWorlds to find your servers.'; if (S.code === code) setGate('open'); render(); return; }
  await Promise.all([loadProfile(), loadPinParams(), loadTrusted()]);
  /* The key pair is part of the vault: a vault that has its name and PIN but no key yet (set up before
     keys were made with the welcome screen) gets one now, so the connection key is always there. */
  if (!S.key && S.noKey && S.code === code && !needsWelcome() && S.profileKnown && S.pinParams && !S.pinParams.none) {
    try { await storeNewKey(await newKeyPair()); } catch (e) { warn('key', e && (e.code || e.message)); }
  }
  /* The gate (15 Nov): a vault with its name and PIN is ready; one without them finishes the welcome before
     a game plays or Settings opens; a vault that did not answer locks nothing. */
  if (S.code === code) setGate(needsWelcome() ? 'needed' : (S.profileKnown && S.pinParams ? 'ready' : 'open'));
  render(); renderMe();
  offerWelcome();
  if (S.key) joinRooms();
}
/* The welcome screen must be finished by every vault that has no name and PIN yet, new or old: it cannot be
   closed until it is saved, or the person chooses I already have a vault code. Only when the vault cannot be
   reached does it let the person carry on (Try later), and then it comes back on the next page load. */
function needsWelcome() {
  if (!S.profileKnown || !S.pinParams) return false;   // the vault did not answer: ask nothing
  return !(S.profile && S.profile.alias) || !!S.pinParams.none;
}
function offerWelcome() { if (S.code && needsWelcome()) welcomeOnStart(); }
function joinRooms() {
  if (!S.key) return;
  S.rooms.forEach((r) => r.close()); S.rooms = [];
  const own = new Room(S.key); S.rooms.push(own); own.open();
  loadMoves().then((notes) => notes.forEach((n) => { const r = new Room(n.key, n.note); S.rooms.push(r); r.open(); }));
}
function stop() {
  S.running = false;
  S.rooms.forEach((r) => r.close()); S.rooms = [];
  for (const c of S.conns.values()) c.teardown(false);
  S.conns.clear(); S.bySid.clear();
  S.pinKeys = null;
}
async function loadProfile() {
  try {
    const p = await vcall(VF.getProfile(S.code));
    S.profileKnown = true;
    if (p && !p.none && (p.alias || p.avatar)) {
      const t = p.avatar_type === 'image/png' ? 'image/png' : 'image/webp';
      S.profile = { alias: p.alias || '', avatar: p.avatar ? 'data:' + t + ';base64,' + b64std(u8(p.avatar)) : null, avatarB64u: p.avatar || null, avatarType: p.avatar ? t : null };
    }
  } catch (e) {}
}
async function loadTrusted() {
  try { const r = await vcall(VF.listServers(S.code)); S.trustedVault = (Array.isArray(r) ? r : (r && r.servers) || []).map((x) => ({ server_key: x.server_key, name: x.name || '' })); } catch (e) {}
}
/* 4.4: for 90 days each browser also stands in the old rooms, with the old key, to hand the note to a server that wakes up later. */
async function loadMoves() {
  let list = [];
  try { const r = await vcall(VF.listMoves(S.code)); list = Array.isArray(r) ? r : (r && r.moves) || []; } catch (e) { return []; }
  const out = [];
  for (const mv of list) {
    try {
      const note = mv.note, issued = Date.parse(note.issued_at);
      if (!(now() - issued < MOVE_DAYS * 864e5)) continue;
      const pub = u8(mv.old_public_key, 65);
      const priv = await P.unlockKey(S.code, u8(mv.old_locked_key, 61), pub, false);
      out.push({ note, key: { pub, pubB64: mv.old_public_key, ck: await P.connectionKey(pub), priv } });
    } catch (e) { warn('move note', e && e.message); }
  }
  return out;
}
function b64std(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }

/* ---------------------------------------------------------------- what cws.js asks */
function listings() {
  if (!S.running) return [];
  const out = [], seen = {};
  for (const c of S.bySid.values()) if (c.state === 'open' || c.state === 'hidden') { seen[c.sid] = true; out.push(listingOf(c.sid, c.serverKey)); }   // hidden: shown with Use again
  const t = trustedLocal();
  for (const k in t) if (t[k].sid && !seen[t[k].sid]) { seen[t[k].sid] = true; out.push(listingOf(t[k].sid, k)); }
  return out;
}
function listingOf(sid, key) { return { server_id: sid, rtc: { server_key: key } }; }
/* For the endpoint race: the connection to this server, once open, and its health answer over the channel. */
function whenOpen(sid, ms) {
  const c = S.bySid.get(sid);
  const ready = () => ({ base: 'rtc:' + sid, health: c.health, kind: c.kind || 'rtc', rtt: 0 });
  if (c && c.state === 'open') {
    return rtcFetch('rtc:' + sid + '/api/v1/health', { method: 'GET' }, 8000).then((r) => r.json()).then((h) => {
      if (!h || h.server_id !== sid) throw new Error('wrong server');
      c.health = h; return ready();
    });
  }
  const pend = c || [...S.conns.values()].filter((x) => trustedLocal()[x.serverKey] && trustedLocal()[x.serverKey].sid === sid)[0];
  /* Try again, or Use again after Forget: a server still waiting in the room is asked afresh. */
  if (pend && (pend.state === 'failed' || pend.state === 'hidden' || pend.state === 'idle') && !(pend.state === 'failed' && pend.final) && pend.room.servers.has(pend.serverKey) && S.running) { pend.msg = ''; pend.start(pend.relay || undefined); }
  if (!pend || (pend.state !== 'connecting' && pend.state !== 'open')) return Promise.reject(new Error(pend && pend.state === 'held' ? 'held' : 'not online'));
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('not online')), ms || T_OPEN);
    (pend.waitersOpen = pend.waitersOpen || []).push((ok) => { clearTimeout(t); if (ok && pend.sid === sid) res({ base: 'rtc:' + sid, health: pend.health, kind: pend.kind || 'rtc', rtt: 0 }); else rej(new Error('not online')); });
  });
}
function info(sid) {
  const c = S.bySid.get(sid);
  if (!c) { const t = trustedLocal(); for (const k in t) if (t[k].sid === sid) return { name: t[k].name, online: false, key: k }; return null; }
  return { name: c.name, online: c.state === 'open', kind: c.kind, msg: c.msg, key: c.serverKey, removed: !!c.removed, held: c.state === 'held' };
}
async function forget(sid) {
  const c = S.bySid.get(sid), t = trustedLocal();
  let key = c && c.serverKey;
  if (!key) for (const k in t) if (t[k].sid === sid) key = k;
  if (c) { c.teardown(false); c.state = 'hidden'; }   // kept, so Use again can ask it afresh
  if (!key) return;
  setTrustedLocal(key, null);
  try { await vcall(VF.forgetServer(S.code, key)); S.trustedVault = (S.trustedVault || []).filter((r) => r.server_key !== key); } catch (e) { warn('forget', e && e.code); }
}
/* The old key of a reinstalled server: no longer trusted, but met again as any unknown key would be. */
function untrust(key) {
  const c = S.conns.get(key);
  if (c) { c.teardown(false); c.state = 'idle'; }
  setTrustedLocal(key, null);
  return vcall(VF.forgetServer(S.code, key)).then(() => { S.trustedVault = (S.trustedVault || []).filter((r) => r.server_key !== key); render(); }, () => render());
}
function forgetKey(key) {
  const c = S.conns.get(key); if (c && c.sid) return forget(c.sid);
  setTrustedLocal(key, null);
  return vcall(VF.forgetServer(S.code, key)).then(() => { S.trustedVault = (S.trustedVault || []).filter((r) => r.server_key !== key); render(); }, () => render());
}

/* ================================================================= UI */
function ui() { return H.ui; }
function esc(s) { return ui().esc(s); }
const ERR = 'font-size:12px; color:#f08a5d; min-height:18px; margin:6px 0 0;';

/* ---- the PIN boxes (new PIN twice) used by the welcome screen, change and reset ---- */
function pinPairHtml(prefix) {
  const u = ui();
  return '<div style="display:flex; gap:10px; flex-wrap:wrap; margin:0 0 4px;">' +
    '<input class="' + prefix + '-a" type="password" inputmode="numeric" autocomplete="new-password" maxlength="12" aria-label="New PIN" placeholder="New PIN, 6 to 12 digits" style="flex:1; min-width:150px; ' + u.INPUT + ' font-family:ui-monospace,Consolas,monospace; letter-spacing:.15em;">' +
    '<input class="' + prefix + '-b" type="password" inputmode="numeric" autocomplete="new-password" maxlength="12" aria-label="New PIN again" placeholder="The same PIN again" style="flex:1; min-width:150px; ' + u.INPUT + ' font-family:ui-monospace,Consolas,monospace; letter-spacing:.15em;"></div>';
}
function readPinPair(el, prefix) {
  const a = (el.querySelector('.' + prefix + '-a').value || '').trim(), b = (el.querySelector('.' + prefix + '-b').value || '').trim();
  const p = newPinProblem(a);
  if (p) return { err: p };
  if (a !== b) return { err: 'The two PINs are not the same.' };
  return { pin: a };
}

function changePinDialog() {
  const u = ui();
  const d = u.dialog({
    sub: 'Your vault', title: 'Change your PIN',
    html: '<p style="' + u.P + '">' + 'The new PIN works at once, on every browser. You type it when you open your vault on another browser, when you change your recovery email, and when you ask for a lost vault code. ' + NO_RECOVERY + '</p>' +
      '<input class="cwr-old" type="password" inputmode="numeric" autocomplete="current-password" maxlength="12" aria-label="Current PIN" placeholder="Current PIN" style="width:100%; box-sizing:border-box; margin:0 0 10px; ' + u.INPUT + ' font-family:ui-monospace,Consolas,monospace; letter-spacing:.15em;">' +
      pinPairHtml('cwr-new') + '<div class="cwr-msg" role="status" style="' + ERR + '"></div>',
    actions: [
      { label: 'Change PIN', kind: 'accent', action: 'cwr-change-go', onClick: () => go() },
      { label: 'Cancel', action: 'close', onClick: (dd) => dd.close() },
    ],
  });
  let busy = false;
  async function go() {
    if (!d.el || busy) return;
    const msg = d.el.querySelector('.cwr-msg'), old = (d.el.querySelector('.cwr-old').value || '').trim();
    if (!P.validPin(old)) { msg.textContent = 'Your current PIN is 6 to 12 digits.'; return; }
    const n = readPinPair(d.el, 'cwr-new'); if (n.err) { msg.textContent = n.err; return; }
    if (n.pin === old) { msg.textContent = 'The new PIN is the same as the current one.'; return; }
    busy = true; msg.style.color = 'var(--muted)'; msg.textContent = 'Changing…';
    try { await changePin(old, n.pin); d.close(); u.toast('PIN changed.', 'ok'); renderMe(); }
    catch (e) { msg.style.color = '#f08a5d'; msg.textContent = pinError(e); }
    busy = false;
  }
}


/* ---- Forgot your vault code?: the recovery email and the vault's PIN. recover-vault finds the vault by the email's
   fingerprint and the vault checks the PIN, with the same lockout as every PIN check, before anything is mailed to the
   address typed. An email it does not know gets the same answers, so nothing here says whether an email is registered.
   The PIN is stretched here, as for every PIN check, with the salt recover-vault gives for that email. ---- */
async function recoverCode(email, pin) {
  const pp = await efcall(EF.recover, { action: 'params', email });
  const x = await P.pinStretch(pin, u8(pp.salt, 16), pp.iterations);
  return efcall(EF.recover, { email, salt: pp.salt, x: P.b64u(x) });
}
function recoverProblem(email, pin) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
  if (!P.validPin(pin)) return 'Enter your vault\'s PIN too: 6 to 12 digits.';
  return '';
}
const RECOVER_SENT = '<strong style="color:var(--accent)">Sent.</strong> Your vault code is on its way to that email. Check spam if it doesn\'t arrive within a minute.';
function recoverError(e) {
  const i = e.info || {};
  if (e.code === 'pin_incorrect') {
    const n = i.attempts_remaining;
    return 'That email and PIN do not match a vault.' + (typeof n === 'number' ? ' ' + H.ui.plural(n, 'try', 'tries') + ' left before this is locked for a while.' : '');
  }
  if (e.code === 'pin_locked') {
    const until = i.locked_until ? Date.parse(i.locked_until) : now() + (+i.retry_after_seconds || 900) * 1000;
    return 'Too many wrong tries. You can try again at ' + H.ui.fmtTime(until) + '.';
  }
  if (e.code === 'too_many_requests') {
    const sec = +i.retry_after_seconds || 60;
    return sec <= 90 ? 'Your code was sent a moment ago. Check your email (and its spam folder), or wait a minute and try again.'
      : 'Your code has already been sent several times today. You can ask again at ' + H.ui.fmtTime(now() + sec * 1000) + '.';
  }
  if (e.code === 'mail_failed') return 'The email could not be sent. Try again in a few minutes.';
  if (e.code === 'bad_email') return 'Enter a valid email address.';
  if (e.code === 'vault_down') return NET_MESSAGE;
  return 'Your code could not be sent (' + (e.code || e.message) + '). Try again in a moment.';
}
/* Settings, Data and Recovery, Forgot your vault code?: the same check (index.html's own recoverByEmail only says why it
   cannot run). It needs the browser's crypto, which only the secure site has. */
function wrapRecover() {
  const cur = window.recoverByEmail;
  if (typeof cur !== 'function' || cur.__reach || !(globalThis.crypto && crypto.subtle)) return;
  const mine = async function () {
    const inp = document.getElementById('vault-recover-input'), pinBox = document.getElementById('vault-recover-pin'), out = document.getElementById('vault-recover-msg');
    if (!inp || !out) return;
    const say = (t, ok) => { out.innerHTML = t; out.style.color = ok ? 'var(--muted)' : '#f08a5d'; };
    const email = (inp.value || '').trim(), pin = ((pinBox && pinBox.value) || '').trim();
    const p = recoverProblem(email, pin); if (p) { say(esc(p)); return; }
    say('Checking…', true);
    try { await recoverCode(email, pin); say(RECOVER_SENT, true); inp.value = ''; if (pinBox) pinBox.value = ''; }
    catch (e) { if (pinBox) pinBox.value = ''; say(esc(recoverError(e))); }
  };
  mine.__reach = true;
  window.recoverByEmail = mine;
}

/* ---- avatar: scaled to fit 128 x 128, WebP (PNG where the browser cannot make WebP), at most 16 KiB (12.2) ---- */
async function avatarFrom(file) {
  const bmp = await createImageBitmap(file);
  const cv = document.createElement('canvas');
  /* Always PNG, whatever was chosen (WebP included): made smaller until it fits 16 KiB, as the game server does. */
  let last = 0;
  for (const side of [128, 112, 96, 80, 64]) {
    const kk = Math.min(1, side / Math.max(bmp.width, bmp.height));
    if (Math.round(bmp.width * kk) === last) continue;   // already tried at its own size
    last = Math.round(bmp.width * kk);
    cv.width = Math.max(1, Math.round(bmp.width * kk)); cv.height = Math.max(1, Math.round(bmp.height * kk));
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    const png = await new Promise((r) => cv.toBlob(r, 'image/png'));
    if (png && png.size <= 16384) return { type: 'image/png', bytes: new Uint8Array(await png.arrayBuffer()) };
  }
  throw new Error('That avatar is too detailed to keep small. Try a simpler one.');
}
function aliasProblem(a) {
  if (!a) return 'Choose an alias others will see.';
  if ([...a].length > 32) return 'An alias is at most 32 characters.';
  if (a !== a.trim()) return 'An alias cannot start or end with a space.';
  if (/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Co}\p{Cs}]/u.test(a)) return 'That alias has a character that cannot be shown.';
  return '';
}

/* ---- 12: the welcome screen ---- */
/* A forgotten PIN is never recovered: every place a PIN is set says so, in these words. */
const NO_RECOVERY = 'There is no way to recover a forgotten PIN.';
const whyText = () => '<b style="color:var(--text)">Why we don\'t ask for an email or a password.</b> Your vault code is your account. It is made for you on this device, so we never need your name, an email address or a password to start. Keep it private, like a key to your home. Your PIN stays with you: we keep only a scrambled check of it, so nobody can read it back, not even with your vault code. If you like, you can add a recovery email in Settings. It is used only to send you your vault code if you lose it, and only once you also enter your PIN. We keep a scrambled fingerprint of it and a short reminder like p•••@gmail.com, never the address itself. ' + NO_RECOVERY;
let _fresh = null;   // the key pair made for the welcome screen, stored only on Save
const NET_MESSAGE = 'CrystalWorlds can\'t be reached right now. Check your connection and try again.';
/* A vault code as typed or pasted: any case, with or without dashes or spaces. A connection key
   (7 groups of 4 from a to z and 2 to 7) is public, so it is named for what it is. */
function parseVaultCode(raw) {
  const t = String(raw || '').trim().toLowerCase().replace(/[\s\u2010-\u2015-]+/g, '');
  if (!t) return { err: 'Enter your vault code.' };
  if (/^[a-z2-7]{28}$/.test(t)) return { err: 'That is a connection key, which is public. Enter your private vault code.' };
  if (!/^[0-9a-f]{32}$/.test(t)) return { err: 'That is not a vault code. A vault code has 32 letters and numbers, from 0 to 9 and a to f. Dashes and capitals do not matter.' };
  return { code: t.slice(0, 8) + '-' + t.slice(8, 12) + '-' + t.slice(12, 16) + '-' + t.slice(16, 20) + '-' + t.slice(20) };
}
/* This browser's current vault holds something of its own: the page's own "touched" mark, play time kept
   for its code, or a row in the vault service (which also holds a recovery email and game server data). */
async function ownData() {
  if (hasPlayData()) return true;
  try { return (await vcall(['vault_exists', { p_vault: S.code }])) === true; } catch (e) { return false; }
}
function hasPlayData() {
  try { if (typeof isVaultTouched === 'function' && isVaultTouched()) return true; } catch (e) {}   // eslint-disable-line no-undef
  try {
    const k = (typeof PLAY_TIME_KEY !== 'undefined' ? PLAY_TIME_KEY : 'pp-play-time-v2') + ':' + S.code;   // eslint-disable-line no-undef
    const v = JSON.parse(localStorage.getItem(k) || 'null');
    return !!(v && typeof v === 'object' && Object.keys(v).length);
  } catch (e) { return false; }
}
function existingPaneHtml(u, mono) {
  return '<div class="cwr-pane-old" role="tabpanel" hidden>' +
    '<label style="' + u.LBL + '">Your vault code</label>' +
    '<p style="' + u.P + ' font-size:11.5px;">Enter your vault code. You were given it when you signed up; you can also find it under Settings, Your vault, on any device where you are logged in.</p>' +
    '<div style="display:flex; gap:8px; align-items:center; margin:0 0 4px;"><input class="cwr-old-code" type="text" inputmode="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="64" aria-label="Your vault code" placeholder="Your vault code" style="flex:1; min-width:0; ' + u.INPUT + ' ' + mono + '">' +
      (canPaste() ? u.button({ label: 'Paste', action: 'cwr-old-paste' }).outerHTML : '') + '</div>' +
    '<div class="cwr-old-pinrow" hidden><label style="' + u.LBL + ' margin-top:10px;">Your PIN</label>' +
      '<p style="' + u.P + ' font-size:11.5px;">This vault has a PIN. Enter it to log in on this browser. A forgotten PIN cannot be recovered: choose Sign up to start a new vault.</p>' +
      '<input class="cwr-old-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="12" aria-label="Your PIN" placeholder="6 to 12 digits" style="width:100%; box-sizing:border-box; ' + u.INPUT + ' font-family:ui-monospace,Consolas,monospace; letter-spacing:.2em;">' +
      '</div>' +
    '<div class="cwr-old-msg" role="status" style="' + ERR + '"></div>' +
    '<p class="cwr-old-safe" hidden style="' + u.P + ' font-size:11.5px;">This browser\'s current vault stays safe in CrystalWorlds; you can return to it from Settings, Your vault.</p>' +
    /* FORGOT YOUR VAULT CODE? (20 Nov 2026): a link-styled button that opens the recovery in place, under it. */
    '<div style="border-top:1px solid var(--line); padding-top:10px; margin-top:8px;">' +
      '<button type="button" class="cwr-old-forgot" aria-expanded="false" style="padding:4px 0; background:none; border:0; color:var(--accent); font:inherit; font-size:13px; font-weight:700; cursor:pointer; text-decoration:underline; text-underline-offset:3px;">Forgot your vault code?</button>' +
      '<div class="cwr-old-rec" hidden style="margin-top:6px;">' +
      '<p style="' + u.P + ' font-size:11.5px;">If you saved a recovery email against your vault, enter that address and your vault\'s PIN. When both match, we\'ll mail the code to that address. Then enter the code above. Without a recovery email the code cannot be found again.</p>' +
      '<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;"><input class="cwr-old-mail" type="email" autocomplete="email" aria-label="Recovery email" placeholder="you@example.com" style="flex:1; min-width:160px; ' + u.INPUT + '">' +
        '<input class="cwr-old-mailpin" type="password" inputmode="numeric" autocomplete="off" maxlength="12" aria-label="Your vault\'s PIN" placeholder="PIN" style="width:110px; box-sizing:border-box; ' + u.INPUT + ' font-family:ui-monospace,Consolas,monospace; letter-spacing:.15em;">' +
        u.button({ label: 'Send my code', action: 'cwr-old-send' }).outerHTML + '</div>' +
      '<div class="cwr-old-mailmsg" role="status" style="font-size:12px; min-height:18px; margin:6px 0 0; color:var(--muted);"></div></div></div>' +
    '</div>';
}
let _welcomeOpen = false;
let _pinProved = null;   // the vault code whose PIN the welcome screen checked a moment ago
/* Paste needs the clipboard reading call, on a secure page. */
function canPaste() { try { return !!(window.isSecureContext && navigator.clipboard && typeof navigator.clipboard.readText === 'function'); } catch (e) { return false; } }
async function welcomeScreen(opts) {
  opts = opts || {};
  if (!SUPPORTED || !S.code || _welcomeOpen) { if (_welcomeOpen && opts.reason) setLead(opts.reason); return; }
  _welcomeOpen = true;
  markSlid();   // out this visit: it does not slide out by itself again
  try { _welcomeFirst = localStorage.getItem(OPENED_KEY) !== '1'; localStorage.setItem(OPENED_KEY, '1'); } catch (e) { _welcomeFirst = false; }
  gateUpdate();
  const must = needsWelcome();   // no name or no PIN yet: it must be saved before a game plays or Settings opens
  /* On our own address it can be put away: it tucks into the Your vault tab. On any other address it is
     compulsory, with no close button (15 Nov). */
  const offsite = !!window.__cwOffsite, tuck = must && !offsite;
  const u = ui();
  if (!S.key) _fresh = _fresh || await newKeyPair();
  const haveProfile = !!S.profile, havePin = !!(S.pinParams && !S.pinParams.none);
  let avatar = null;
  if (S.profile && S.profile.avatar) avatar = { url: S.profile.avatar };
  const mono = 'font-family:ui-monospace,Consolas,monospace; font-size:13px;';
  const box = (cls, val, note, copy) => '<div style="display:flex; gap:8px; align-items:center; margin:0 0 4px;"><input class="' + cls + '" readonly value="' + esc(val) + '" style="flex:1; ' + u.INPUT + ' ' + mono + '">' +
    u.button({ label: 'Copy', action: copy }).outerHTML + '</div><p style="' + u.P + ' font-size:11.5px;">' + note + '</p>';
  const TAB = 'padding:9px 4px; margin:0 14px -1px 0; background:none; border:0; border-bottom:2px solid transparent; color:var(--muted); font:inherit; font-size:13.5px; font-weight:700; cursor:pointer;';
  const d = u.dialog({
    sub: 'Welcome', title: 'Your place on CrystalWorlds', mandatory: must && offsite,
    cls: tuck ? 'cwr-welcome cwr-slide' : 'cwr-welcome', outsideDismiss: tuck, onDismiss: tuck ? (dd) => tuckAway(dd) : undefined,
    html:
      (must ? leadHtml(opts.reason) : '') +
      (must ? '<div class="cwr-tabs" role="tablist" style="display:flex; border-bottom:1px solid var(--line); margin:0 0 14px;">' +
        /* LOG IN FIRST AND SELECTED (20 Nov 2026): people coming back look for Log in, new ones for Sign up. */
        '<button type="button" role="tab" class="cwr-tab" data-cws-action="cwr-tab-old" aria-selected="true" style="' + TAB + '">Log in</button>' +
        '<button type="button" role="tab" class="cwr-tab" data-cws-action="cwr-tab-new" aria-selected="false" style="' + TAB + '">Sign up</button></div>' : '') +
      '<div class="cwr-pane-new" role="tabpanel">' +
      '<div style="display:flex; gap:14px; align-items:center; margin:0 0 12px;">' +
        '<button type="button" class="cwr-av" aria-label="Choose an avatar" title="Choose an avatar" style="width:64px; height:64px; flex:none; border-radius:50%; border:1px dashed var(--line); background:var(--line) center/cover no-repeat; color:var(--text); font-size:26px; font-weight:700; line-height:1; display:inline-flex; align-items:center; justify-content:center; cursor:pointer;"></button>' +
        '<input class="cwr-av-file" type="file" accept="image/*" style="display:none">' +
        '<div style="flex:1;"><label style="' + u.LBL + '">Your alias</label>' +
        '<input class="cwr-alias" type="text" maxlength="64" autocomplete="nickname" spellcheck="false" placeholder="The alias others see" value="' + esc(S.profile ? S.profile.alias : _aliasDraft) + '" style="width:100%; box-sizing:border-box; ' + u.INPUT + '"></div></div>' +
      '<p style="' + u.P + ' font-size:11.5px;">Your alias and avatar are public, so choose ones you are happy for anyone to see. Game server owners see them when you join. The avatar is optional.</p>' +
      (havePin ? '' : '<label style="' + u.LBL + '">Your PIN</label>' + pinPairHtml('cwr-wpin') +
        '<p style="' + u.P + ' font-size:11.5px;">You type it when you log in on another browser, so your vault code alone cannot open your vault. ' + NO_RECOVERY + ' Choose one you will remember.</p>') +
      '<label style="' + u.LBL + '">Your vault code (private)</label>' + box('cwr-vc', S.code, 'Keep this private, like a key to your home. Never give it to anyone, including server owners.', 'cwr-copy-vc') +
      '<p style="' + u.P + ' font-size:11.5px; border-top:1px solid var(--line); padding-top:10px;">' + whyText() + '</p>' +
      '<div class="cwr-msg" role="status" style="' + ERR + '"></div></div>' +
      (must ? existingPaneHtml(u, mono) : '') +
      (must && offsite ? '<p style="' + u.P + ' font-size:11.5px; border-top:1px solid var(--line); padding-top:10px; margin-top:4px;">Setting up your own copy of this site? The steps are in its <a href="README.md" target="_blank" rel="noopener" style="color:var(--accent);">README</a>.</p>' : ''),
    actions: newActions(),
    onClose: () => { _welcomeOpen = false; _welcomeDlg = null; gateUpdate(); },
  });
  _welcomeDlg = d;
  function newActions() {
    return [
      { label: must ? 'Sign up' : 'Save', kind: 'accent', action: 'cwr-welcome-go', onClick: () => go() },
      must ? null : { label: 'Cancel', action: 'cwr-welcome-cancel', onClick: (dd) => dd.close() },
      tuck ? { label: 'Keep browsing', action: 'cwr-welcome-tuck', onClick: (dd) => tuckAway(dd) } : null,
      /* Shown only after a Save the vault could not take: a failed call never locks the site. */
      { label: 'Try later', action: 'cwr-welcome-later', onClick: (dd) => dd.close() },
    ].filter(Boolean);
  }
  function oldActions() {
    return [{ label: 'Log in', kind: 'accent', action: 'cwr-old-go', onClick: () => oldGo() },
      tuck ? { label: 'Keep browsing', action: 'cwr-welcome-tuck', onClick: (dd) => tuckAway(dd) } : null].filter(Boolean);
  }
  function showTab(which) {
    const el = d.el; if (!el) return;
    const isNew = which === 'new';
    el.querySelector('.cwr-pane-new').hidden = !isNew;
    const old = el.querySelector('.cwr-pane-old'); if (old) old.hidden = isNew;
    el.querySelectorAll('.cwr-tab').forEach((t) => {
      const on = t.getAttribute('data-cws-action') === 'cwr-tab-' + which;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.style.color = on ? 'var(--text)' : 'var(--muted)';
      t.style.borderBottomColor = on ? 'var(--accent)' : 'transparent';
    });
    d.setActions(isNew ? newActions() : oldActions());
    const later = el.querySelector('[data-cws-action="cwr-welcome-later"]'); if (later) later.hidden = true;
    /* This browser's vault already holds something of its own (it was used, or it exists in the vault
       service): one line says it stays safe. A code made for this screen has nothing, so no line. */
    if (!isNew) ownData().then((has) => { const c = d.el && d.el.querySelector('.cwr-old-safe'); if (c) c.hidden = !has; });
  }
  /* Item 7: a vault opened on a new browser asks its code, then its PIN, checked by the vault's own
     get_pin_keys with its lockout, so a vault code alone does not open the vault anywhere. */
  let pinFor = null, pinPP = null;
  function pinRow(show) {
    const el = d.el; if (!el) return;
    el.querySelector('.cwr-old-pinrow').hidden = !show;
    if (!show) { pinFor = null; pinPP = null; el.querySelector('.cwr-old-pin').value = ''; }
  }
  async function oldGo() {
    const el = d.el; if (!el) return;
    const inp = el.querySelector('.cwr-old-code'), msg = el.querySelector('.cwr-old-msg');
    const say = (t, ok) => { msg.textContent = t; msg.style.color = ok ? 'var(--muted)' : '#f08a5d'; };
    const r = parseVaultCode(inp.value);
    if (r.err) { pinRow(false); say(r.err); return; }
    if (r.code === S.code) { say('That is the new vault code this browser made for you. Choose Sign up to set it up.'); return; }
    if (pinFor !== r.code) {
      pinRow(false);
      say('Checking…', true);
      let found;
      try { found = await vcall(['vault_exists', { p_vault: r.code }]); }
      catch (e) { say(e.code === 'vault_down' ? NET_MESSAGE : 'That code could not be checked (' + (e.code || e.message) + '). Try again in a moment.'); return; }
      if (found !== true) { say('No vault has that code. Check it, or choose Forgot your vault code? below.'); return; }
      let pp;
      try { pp = await vcall(VF.pinParams(r.code)); }
      catch (e) { say(e.code === 'vault_down' ? NET_MESSAGE : 'That vault could not be checked (' + (e.code || e.message) + '). Try again in a moment.'); return; }
      if (pp && !pp.none) {
        pinFor = r.code; pinPP = pp;
        el.querySelector('.cwr-old-pinrow').hidden = false;
        say('Now enter the PIN of this vault.', true);
        try { el.querySelector('.cwr-old-pin').focus(); } catch (x) {}
        return;
      }
      /* A vault without a PIN yet opens with its code; the welcome screen then sets its name and PIN. */
    } else {
      const pin = (el.querySelector('.cwr-old-pin').value || '').trim();
      if (!P.validPin(pin)) { say('A PIN is 6 to 12 digits.'); return; }
      say('Checking…', true);
      try {
        const x = await P.pinStretch(pin, u8(pinPP.salt, 16), pinPP.iterations);
        await vcall(VF.pinKeys(r.code, P.b64u(x)));
      } catch (e) { el.querySelector('.cwr-old-pin').value = ''; say(pinError(e)); return; }
    }
    say('Logging in…', true);
    const box = document.getElementById('vault-code-input');
    if (!box || typeof window.importVaultCode !== 'function') { say('This page cannot change vaults right now. Reload it and try again.'); return; }
    box.value = r.code;   // the page's own switch (index.html importVaultCode, wrapped by cws.js), called directly
    _pinProved = r.code;  // proved just now: the switch does not ask again
    try { await window.importVaultCode(); } catch (e) {}
    _pinProved = null;
    if (typeof vaultCode === 'undefined' || vaultCode !== r.code) { say('This browser could not change to that vault. Reload the page and try again.'); return; }   // eslint-disable-line no-undef
    /* The new vault's name, picture and PIN, loaded by start() for it. */
    const t0 = now();
    while (now() - t0 < 20000 && !(S.code === r.code && S.profileKnown && S.pinParams)) await new Promise((res) => setTimeout(res, 150));
    if (!(S.code === r.code && S.profileKnown && S.pinParams)) { say(NET_MESSAGE); return; }
    if (!needsWelcome()) { setGate('ready'); markDone(); }
    d.close();
    renderMe();
    if (needsWelcome()) welcomeScreen();   // that vault has no name or PIN yet: set them now, still in the welcome screen
    else u.toast('Welcome back, ' + S.profile.alias + '.', 'ok');
  }
  async function sendCode() {
    const el = d.el; if (!el) return;
    const inp = el.querySelector('.cwr-old-mail'), pinBox = el.querySelector('.cwr-old-mailpin'), msg = el.querySelector('.cwr-old-mailmsg');
    const say = (t, ok) => { msg.innerHTML = t; msg.style.color = ok ? 'var(--muted)' : '#f08a5d'; };
    const email = (inp.value || '').trim(), pin = (pinBox.value || '').trim();
    const p = recoverProblem(email, pin); if (p) { say(esc(p)); return; }
    say('Checking…', true);
    try { await recoverCode(email, pin); say(RECOVER_SENT, true); inp.value = ''; pinBox.value = ''; }
    catch (e) { pinBox.value = ''; say(esc(recoverError(e))); }
  }
  const wire = () => {
    if (!d.el) { setTimeout(wire, 200); return; }
    const el = d.el, av = el.querySelector('.cwr-av'), file = el.querySelector('.cwr-av-file'), msg = el.querySelector('.cwr-msg');
    /* No picture chosen: the lettered circle others will see (the first letter of the name as typed),
       or a plain person outline before any name. */
    const alias = el.querySelector('.cwr-alias');
    const paint = () => {
      if (avatar && avatar.url) { av.style.backgroundImage = 'url("' + avatar.url + '")'; av.textContent = ''; return; }
      const ch = Array.from((alias.value || '').trim())[0];
      if (ch) av.textContent = ch.toUpperCase();
      else av.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" style="color:var(--muted);"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';
    };
    paint();
    alias.addEventListener('input', paint);
    alias.addEventListener('input', () => { _aliasDraft = alias.value; });   // kept while it is tucked away
    av.addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      const f = file.files && file.files[0]; if (!f) return;
      try { const a = await avatarFrom(f); avatar = { type: a.type, bytes: a.bytes, url: 'data:' + a.type + ';base64,' + b64std(a.bytes) }; paint(); msg.textContent = ''; }
      catch (e) { msg.textContent = e.message || 'That avatar could not be read.'; }
    });
    el.querySelector('[data-cws-action="cwr-copy-vc"]').addEventListener('click', () => copyText(S.code, 'Vault code copied. Keep it private.'));
    const later = el.querySelector('[data-cws-action="cwr-welcome-later"]'); if (later) later.hidden = true;
    el.querySelectorAll('.cwr-tab').forEach((t) => t.addEventListener('click', () => showTab(t.getAttribute('data-cws-action') === 'cwr-tab-old' ? 'old' : 'new')));
    if (must) showTab('old');
    const oc = el.querySelector('.cwr-old-code');
    if (oc) {
      oc.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); oldGo(); } });
      /* Item 2: Paste reads the clipboard into the box. A browser that refuses (no permission, or none
         to give) loses the button rather than showing a broken one; typing still works. */
      const pb = el.querySelector('[data-cws-action="cwr-old-paste"]');
      if (pb) {
        try { navigator.permissions.query({ name: 'clipboard-read' }).then((st) => { if (st.state === 'denied') pb.hidden = true; }, () => {}); } catch (x) {}
        pb.addEventListener('click', async () => {
          const m = el.querySelector('.cwr-old-msg');
          try {
            const t = await navigator.clipboard.readText();
            oc.value = String(t || '').trim().slice(0, 64); m.textContent = '';
            oc.dispatchEvent(new Event('input', { bubbles: true }));
          } catch (x) {
            pb.hidden = true; m.style.color = 'var(--muted)';
            m.textContent = 'This browser did not let the site read what you copied. Type the code, or paste it into the box.';
          }
          try { oc.focus(); } catch (x) {}
        });
      }
      oc.addEventListener('input', () => { if (pinFor && parseVaultCode(oc.value).code !== pinFor) { pinRow(false); el.querySelector('.cwr-old-msg').textContent = ''; } });
      el.querySelector('.cwr-old-pin').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); oldGo(); } });
      el.querySelector('[data-cws-action="cwr-old-send"]').addEventListener('click', () => sendCode());
      /* Forgot your vault code? opens (and closes) the recovery right under it, the focus in its email box. */
      const fg = el.querySelector('.cwr-old-forgot'), rec = el.querySelector('.cwr-old-rec');
      fg.addEventListener('click', () => {
        const open = rec.hidden;
        rec.hidden = !open; fg.setAttribute('aria-expanded', String(open));
        if (open) { const m = el.querySelector('.cwr-old-mail'); try { m.focus({ preventScroll: true }); m.scrollIntoView({ block: 'nearest' }); } catch (x) {} }
      });
      el.querySelector('.cwr-old-mail').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendCode(); } });
      el.querySelector('.cwr-old-mailpin').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendCode(); } });
    }
    /* A remote or a pad has no Tab key: Up and Down move from box to box and button to button, and
       Left and Right do too from a button, a read-only box, or the end (start) of a box's text. */
    const order = () => [...el.querySelectorAll('button, input')].filter((x) => !x.hidden && x.type !== 'file' && !x.disabled && x.getClientRects().length);
    el.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target, key = e.key;
      let dir = key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0;
      if (key === 'ArrowRight' || key === 'ArrowLeft') {
        if (t.tagName === 'INPUT' && !t.readOnly) {
          let at0 = true, atEnd = true;
          try { const v = String(t.value || ''); if (t.selectionStart != null) { at0 = t.selectionStart === 0 && t.selectionEnd === 0; atEnd = t.selectionStart === v.length && t.selectionEnd === v.length; } } catch (x) {}
          if (!((key === 'ArrowRight' && atEnd) || (key === 'ArrowLeft' && at0))) return;
        }
        dir = key === 'ArrowRight' ? 1 : -1;
      }
      if (!dir) return;
      const it = order(), i = it.indexOf(t);
      if (i < 0) return;
      e.preventDefault();
      const n = it[i + dir];
      if (n) { n.focus(); try { n.scrollIntoView({ block: 'nearest' }); } catch (x) {} }
    });
  };
  wire();
  if (_welcomeFirst && tuck) welcomeNotes(d);
  let busy = false;
  async function go() {
    if (!d.el || busy) return;
    const el = d.el, msg = el.querySelector('.cwr-msg'), alias = (el.querySelector('.cwr-alias').value || '').trim();
    const ap = aliasProblem(alias); if (ap) { msg.textContent = ap; return; }
    let pin = null;
    if (!havePin) { const n = readPinPair(el, 'cwr-wpin'); if (n.err) { msg.textContent = n.err; return; } pin = n.pin; }
    busy = true; msg.style.color = 'var(--muted)'; msg.textContent = 'Saving…';
    try {
      if (!S.key) { await storeNewKey(_fresh); _fresh = null; }
      let avB64 = null, avType = null;
      if (avatar && avatar.bytes) { avB64 = P.b64u(avatar.bytes); avType = avatar.type; }
      else if (avatar && S.profile && S.profile.avatarB64u) { avB64 = S.profile.avatarB64u; avType = S.profile.avatarType; }
      await vcall(VF.setProfile(S.code, alias, avB64, avType));
      S.profile = { alias, avatar: avB64 ? avatar.url : null, avatarB64u: avB64, avatarType: avType };
      if (pin) await setPin(pin);
      try { if (typeof markVaultTouched === 'function') markVaultTouched(); } catch (e) {}   // eslint-disable-line no-undef
      setGate('ready'); markDone();
      d.close(); renderMe();
      u.toast('Saved. Welcome, ' + alias + '.', 'ok');
      joinRooms(); render();
    } catch (e) {
      msg.style.color = '#f08a5d';
      const yours = e.code === 'bad_alias' || e.code === 'bad_avatar';   // something to change in the boxes
      msg.textContent = (e.code === 'vault_limit' || e.code === 'key_limit') ? LIMIT_MESSAGE + ' Press Try later to use the site now.'
        : e.code === 'bad_alias' ? 'That alias has a character that cannot be shown.'
          : e.code === 'bad_avatar' ? 'That avatar could not be kept. Try another one.'
            : e.code === 'vault_down' ? 'CrystalWorlds can\'t be reached right now, so this was not saved. Press Save to try again, or Try later to use the site now. This screen comes back next time.'
              : 'Could not save (' + (e.code || e.message) + '). Press Save to try again, or Try later to use the site now.';
      const later = el.querySelector('[data-cws-action="cwr-welcome-later"]'); if (later && !yours) later.hidden = false;
    }
    busy = false;
  }
}
/* ---- the gate, the Your vault tab and the slide-back (15 Nov 2026) ----
   Without a vault (a vault code with its name and PIN) a visitor browses: the wall, the covers, the drawers
   and the pages. Play and Settings open the welcome instead. On our own address the welcome can be put away:
   it tucks into a slim Your vault tab on the right edge (a bar at the foot of a phone held upright), which
   slides it back out. It also slides out by itself once a visit, after a minute on the wall, never over a
   drawer, a game or anything else that is open. On any other address it is compulsory. A vault that does not
   answer locks nothing: the site is never shut by a failed call. */
let _gate = 'checking';      // checking | needed | ready | open
let _gateWaiters = [];
let _welcomeDlg = null;      // the welcome on screen
let _aliasDraft = '';        // the name typed so far, kept while the welcome is tucked away
const SEEN_KEY = 'cw.welcome.seen.v1';    // localStorage: this browser has seen the welcome once
const SLID_KEY = 'cw.welcome.slid.v1';    // sessionStorage: it has been out this visit
const LEAD = 'margin:0 0 14px; padding:10px 12px; border-radius:10px; border:1px solid rgba(var(--accent-rgb), .45); background:rgba(var(--accent-rgb), .10); color:var(--text); font-size:13px; line-height:1.5; font-weight:600;';
/* One plain line, only when the welcome answers a press: Play, or Settings. */
/* No line the first time the welcome opens in this browser (OPENED_KEY, kept in
   localStorage so a reload does not count as a first time); each later opening from Play, a way to the
   wall, the tab or the slide-back has the play line, and Settings its own. */
const OPENED_KEY = 'cw.welcome.opened.v1';
let _welcomeFirst = false;   // the welcome on screen is the first one this browser has seen
function leadText(reason) {
  if (_welcomeFirst) return '';
  if (reason === 'settings') return 'Log in or sign up to open Settings.';
  if (reason === 'play' || reason === 'tab' || reason === 'auto') return 'Log in or sign up to play.';
  return '';
}
function leadHtml(reason) { const t = leadText(reason); return t ? '<div class="cwr-lead" role="status" style="' + LEAD + '">' + esc(t) + '</div>' : ''; }
function setLead(reason) {
  const body = _welcomeDlg && _welcomeDlg.el && _welcomeDlg.el.querySelector('.cws-dlg-body');
  if (!body || !leadText(reason)) return;
  const el = body.querySelector('.cwr-lead');
  if (el) el.textContent = leadText(reason); else body.insertAdjacentHTML('afterbegin', leadHtml(reason));
}
function setGate(g) {
  _gate = g;
  if (g !== 'checking') { const w = _gateWaiters; _gateWaiters = []; w.forEach((f) => f()); }
  gateUpdate();
}
function gateSettled(ms) {
  if (_gate !== 'checking') return Promise.resolve();
  return new Promise((r) => { _gateWaiters.push(r); setTimeout(r, ms || 8000); });
}
function gateUpdate() {
  try { tabStyles(); } catch (e) {}   // the styles also hide Settings, on every address
  try { document.documentElement.classList.toggle('cw-novault', _gate === 'needed' || _gate === 'checking'); } catch (e) {}
  /* No vault: the search box goes and the top bar keeps only its row of buttons. Only once
     the vault has answered, so a visitor with a vault never sees the bar jump. The page window sits under
     the bar and fits itself on a resize. */
  try {
    const de = document.documentElement, need = _gate === 'needed';
    if (de.classList.contains('cw-vaultneeded') !== need) { de.classList.toggle('cw-vaultneeded', need); setTimeout(() => window.dispatchEvent(new Event('resize')), 0); }
  } catch (e) {}
  const onOwn = !window.__cwOffsite;
  showTab(_gate === 'needed' && onOwn && !_welcomeOpen);
  if (_gate === 'needed' && onOwn) startSlideBack();
  holdPages();
}
/* NO VAULT, NO WALL: on our own address a visitor without a vault stays on the
   pages (Home, Features, Stories, Compatibility, Timeline, About). They cannot be closed (emby.js aboutSet
   asks cwVaultHoldsPages), the wall and the Systems menu are hidden, and every way to the wall does nothing
   or slides the welcome out. Once the vault is saved everything opens up as before. */
function pagesHeld() { return _gate === 'needed' && !window.__cwOffsite; }
/* EVERY TAB AT ONCE: a vault saved in one tab of this browser (made with Sign up, or opened with
   Log in) lifts the holds in its other tabs too, with no reload. The saving tab leaves a mark (DONE_KEY);
   the others hear it through the storage event and ask the vault again. A tab coming back into view asks
   too. Another tab that opened a different vault code: this tab follows it with one reload, as a code
   change always has. */
const DONE_KEY = 'cw.welcome.done.v1';
function markDone() { try { localStorage.setItem(DONE_KEY, String(Date.now())); } catch (e) {} }
let _recheckBusy = false;
async function recheck() {
  if (_gate !== 'needed' || !S.code || !S.running || _recheckBusy) return;
  _recheckBusy = true;
  const code = S.code;
  try {
    await Promise.all([loadProfile(), loadPinParams()]);
    if (S.code !== code || _gate !== 'needed' || needsWelcome() || !S.profileKnown || !S.pinParams) return;
    if (!S.key) { try { await loadKey(); } catch (e) {} }
    setGate('ready');
    if (_welcomeDlg) { try { _welcomeDlg.close(); } catch (e) {} }
    renderMe(); render();
    if (S.key) joinRooms();
  } finally { _recheckBusy = false; }
}
window.addEventListener('storage', (e) => {
  if (_gate !== 'needed') return;
  if (e.key === 'pp-vault-code-v1' && e.newValue && S.code && e.newValue.toLowerCase() !== S.code) { location.reload(); return; }
  if (e.key === DONE_KEY || e.key === 'pp-vault-touched-v1') recheck();
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') recheck(); });
window.cwVaultHoldsPages = pagesHeld;
/* emby.js, when it keeps a page open: a press or key made inside the page (a link to the wall, such as
   Open the library) slides the welcome out; Escape, a press outside the page and Back do nothing. */
window.cwVaultPageRefused = () => {
  const e = window.event;
  if (!e || !e.target || !e.target.closest || !e.target.closest('#video-about')) return;
  if (e.type === 'click' || (e.type === 'keydown' && (e.key === 'Enter' || e.key === ' '))) welcomeScreen({ reason: 'play' });
};
let _holdT = null;
function holdPages() {
  const held = pagesHeld();
  try { document.documentElement.classList.toggle('cw-pagesheld', held); } catch (e) {}
  if (!held) { if (_holdT) { clearInterval(_holdT); _holdT = null; } return; }
  const keep = () => {
    if (!pagesHeld()) return;
    const W = window.CwAboutWindow, media = document.getElementById('view-media');
    if (W && !W.isOpen() && media && media.classList.contains('active')) { try { W.open('home'); } catch (e) {} }
  };
  keep();
  if (!_holdT) _holdT = setInterval(keep, 700);
}
/* Heard before the page's own handlers: the search box (it searches the wall only, so it has no use on the
   pages) and the Systems tab slide the welcome out instead. */
function wallRoute(e) {
  if (_gate !== 'needed') return;
  const t = e.target;
  if (!t || !t.closest) return;
  const search = t.id === 'video-search' || !!t.closest('#video-search');
  const systems = !!t.closest('.vg-tab, .vgames-menu');
  /* A Timeline row opens its system on the wall: without a vault it slides the welcome out instead. */
  if (!search && !systems && t.closest('#video-about .tl-item') && (e.type === 'click' || (e.type === 'keydown' && (e.key === 'Enter' || e.key === ' ')))) { e.stopPropagation(); e.preventDefault(); welcomeScreen({ reason: 'play' }); return; }
  if (!search && !systems) return;
  if (e.type === 'focusin' && !(search && !t.readOnly)) return;   // reaching the box at rest is not asking to search
  if (e.type === 'keydown' && !(e.key === 'Enter' || e.key === ' ' || (search && e.key.length === 1))) return;
  e.stopPropagation(); e.preventDefault();
  if (search) { try { t.readOnly = true; t.blur(); } catch (x) {} }
  welcomeScreen({ reason: 'play' });
}
['pointerdown', 'click', 'focusin', 'keydown'].forEach((k) => window.addEventListener(k, wallRoute, true));
/* THE ROUND PERSON BUTTON, heard before everything else on the page: an open page (Home and the
   others) would take the press for itself, closing the page and stopping the press (emby.js). Without a
   vault it slides the welcome out of its tab; with one it opens Settings at Your vault, page open or not.
   A key (Enter, Space, the pad's A) reaches it as a click. */
window.addEventListener('click', (e) => {
  const t = e.target;
  if (!t || !t.closest || !t.closest('#cw-me .cw-me-btn')) return;
  e.stopPropagation(); e.preventDefault();
  if (_gate === 'needed') { welcomeScreen({ reason: 'settings' }); return; }
  if (_gate === 'checking') { gateSettled().then(() => { if (_gate === 'needed') welcomeScreen({ reason: 'settings' }); else openMe(); }); return; }
  openMe();
}, true);
/* TWO HAND-DRAWN NOTES, THE FIRST TIME ONLY (16 Nov 2026): on a screen with room beside the welcome (a
   PC), "Write an alias" and "Set a PIN" fade in on the dimmed page to the left of the panel, each with a
   drawn arrow that ends at the panel's edge, level with its field, so nothing in the panel is covered.
   Never on a phone or a narrow window (less than NOTE_ROOM px beside the panel), never on a later opening.
   A note goes once its field has something typed in it, or while Log in is chosen; both go with
   the welcome. Reduced motion: shown at once, no fade. The arrows are drawn here as uneven pen strokes. */
const NOTE_ROOM = 420;
function noteStyles() {
  if (document.getElementById('cwr-notes-style')) return;
  const st = document.createElement('style');
  st.id = 'cwr-notes-style';
  st.textContent = `
    .cwr-notes { position:absolute; inset:0; pointer-events:none; z-index:2; }
    .cwr-note { position:absolute; opacity:0; transition:opacity .7s ease-out; color:var(--text);
      font-family:"Segoe Print", "Bradley Hand", "Chalkboard SE", "Comic Neue", "Comic Sans MS", cursive; font-size:24px; line-height:1.15; font-weight:700; white-space:nowrap; }
    .cwr-note.on { opacity:1; }
    /* A slip of the panel's own paper, so the words read over any page behind, light or dark. */
    .cwr-note .cwr-note-t { position:absolute; display:block; transform:rotate(-4deg); transform-origin:right center; padding:3px 15px 7px;
      border:1.5px solid rgba(var(--accent-rgb), .6); border-radius:14px 10px 15px 9px; background:var(--bg-1, var(--bg)); box-shadow:0 10px 26px -12px rgba(0,0,0,.7); }
    .cwr-note svg { position:absolute; left:0; top:0; overflow:visible; }
    .cwr-note .cwr-pen-u { stroke:var(--bg); stroke-width:7.5; fill:none; stroke-linecap:round; stroke-linejoin:round; opacity:.85; }
    .cwr-note .cwr-pen { stroke:var(--accent); fill:none; stroke-linecap:round; stroke-linejoin:round; }
    .cwr-out .cwr-note { opacity:0 !important; transition:opacity .25s linear; }
    @media (prefers-reduced-motion: reduce) { .cwr-note, .cwr-out .cwr-note { transition:none; } }
  `;
  document.head.appendChild(st);
}
/* A pen line from a to b through a bend: two strokes that do not quite meet, a little uneven. */
function penArrow(ax, ay, bx, by, bend) {
  const mx = (ax + bx) / 2, my = (ay + by) / 2, dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len, cx = mx + nx * bend, cy = my + ny * bend;
  const f = (v) => Math.round(v * 10) / 10;
  const q = (o1, o2, o3) => 'M' + f(ax + nx * o1) + ' ' + f(ay + ny * o1) + ' Q' + f(cx + nx * o2) + ' ' + f(cy + ny * o2) + ' ' + f(bx + nx * o3) + ' ' + f(by + ny * o3);
  /* The head: two short strokes back from the tip, along the curve's last direction, one longer. */
  const tx = bx - cx, ty = by - cy, tl = Math.hypot(tx, ty) || 1, ux = tx / tl, uy = ty / tl;
  const head = (ang, l) => { const c = Math.cos(ang), s = Math.sin(ang); const hx = -(ux * c - uy * s) * l, hy = -(ux * s + uy * c) * l; return 'M' + f(bx + hx) + ' ' + f(by + hy) + ' L' + f(bx + 0.6) + ' ' + f(by - 0.4); };
  return { main: q(0, 0, 0), echo: q(1.4, -2.2, 0.6), head1: head(0.52, 17), head2: head(-0.46, 13) };
}
function welcomeNotes(d) {
  const el = d && d.el;
  if (!el || barMode()) return;
  noteStyles();
  const box = document.createElement('div');
  box.className = 'cwr-notes';
  box.setAttribute('aria-hidden', 'true');
  el.appendChild(box);
  const defs = [
    { sel: '.cwr-alias', text: 'Write an alias', up: true },
    { sel: '.cwr-wpin-a', text: 'Set a PIN', up: false },
  ];
  const notes = defs.map((n) => {
    const w = document.createElement('div');
    w.className = 'cwr-note';
    w.innerHTML = '<svg width="1" height="1" aria-hidden="true"><path class="cwr-pen-u"/><path class="cwr-pen-u"/><path class="cwr-pen-u"/>' +
      '<path class="cwr-pen" style="stroke-width:2.8"/><path class="cwr-pen" style="stroke-width:1.3; opacity:.7"/><path class="cwr-pen" style="stroke-width:2.6"/><path class="cwr-pen" style="stroke-width:2.2"/></svg>' +
      '<span class="cwr-note-t"></span>';
    w.querySelector('.cwr-note-t').textContent = n.text;
    box.appendChild(w);
    return Object.assign({ w, gone: false, shown: false }, n);
  });
  const modal = el.querySelector('.modal');
  let started = false;
  function lay() {
    if (!el.isConnected) return false;
    const m = modal && modal.getBoundingClientRect();
    const room = !!m && m.left >= NOTE_ROOM && !barMode() && !document.documentElement.classList.contains('cw-small');
    for (const n of notes) {
      const f = el.querySelector(n.sel);
      const fr = f && f.getClientRects().length ? f.getBoundingClientRect() : null;
      const ok = room && !n.gone && !!fr && fr.bottom > m.top + 8 && fr.top < Math.min(m.bottom, innerHeight) - 8;
      if (!ok) { n.w.classList.remove('on'); if (!room || n.gone) n.w.style.visibility = 'hidden'; continue; }
      /* The arrow ends 10 px short of the panel, level with the field; the words sit up and to the left
         (alias) or down and to the left (PIN), so the two arrows come in from different sides. */
      const tipX = m.left - 10, tipY = fr.top + fr.height / 2;
      const startX = tipX - 150, startY = tipY + (n.up ? -46 : 54);
      const a = penArrow(startX, startY, tipX, tipY, n.up ? 22 : -22);
      const ps = n.w.querySelectorAll('path');
      [a.main, a.head1, a.head2].forEach((v, i) => ps[i].setAttribute('d', v));
      ps[3].setAttribute('d', a.main); ps[4].setAttribute('d', a.echo); ps[5].setAttribute('d', a.head1); ps[6].setAttribute('d', a.head2);
      const t = n.w.querySelector('.cwr-note-t');
      t.style.right = (innerWidth - startX + 4) + 'px'; t.style.left = 'auto';
      t.style.top = Math.round(startY - t.offsetHeight / 2) + 'px';
      n.w.style.left = '0'; n.w.style.top = '0'; n.w.style.right = '0'; n.w.style.bottom = '0';
      /* The words must fit beside the arrow, on screen. */
      const tr = t.getBoundingClientRect();
      if (tr.left < 12) { n.w.style.visibility = 'hidden'; n.w.classList.remove('on'); continue; }
      n.w.style.visibility = '';
      if (started) n.w.classList.add('on');
    }
    return true;
  }
  let raf = 0;
  const again = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; if (!lay()) stop(); }); };
  const watch = () => { if (!el.isConnected) { stop(); return; } again(); };
  const poll = setInterval(watch, 500);   // the panel's own layout settling (fonts, the avatar row)
  window.addEventListener('resize', again);
  if (modal) modal.addEventListener('scroll', again, { passive: true });
  function stop() { clearInterval(poll); window.removeEventListener('resize', again); }
  const field = (sel) => el.querySelector(sel);
  const typed = (n, sel) => { const f = field(sel); if (f) f.addEventListener('input', () => { if (String(f.value || '').trim()) { n.gone = true; n.w.classList.remove('on'); } }); };
  typed(notes[0], '.cwr-alias'); typed(notes[1], '.cwr-wpin-a');
  lay();
  /* After the panel has slid out (at once with reduced motion). */
  setTimeout(() => { started = true; lay(); }, reduceMotion() ? 0 : slideMs() + 80);
}
/* KEYS AND THE REMOTE REACH THE TUCKED WELCOME (16 Nov 2026). While it waits in its tab (no vault, our
   own address): Down from the round person button and Right from Home's film slide it out (nav.js asks
   here before it moves, so the pad's arrows count too), and Back on a page, after the page has done what
   it does (a held page stays; Keyboard shortcuts steps back to Home), slides it out as well. */
function welcomeWaits() { return _gate === 'needed' && !window.__cwOffsite && !_welcomeOpen && SUPPORTED && !!S.code; }
window.cwNavHook = (a, dir) => {
  if (!a || !a.closest || !welcomeWaits()) return false;
  if ((dir === 'down' && a.closest('#cw-me .cw-me-btn')) || (dir === 'right' && a.id === 'home-film')) { welcomeScreen({ reason: 'tab' }); return true; }
  return false;
};
const BACK_KEYS = new Set(['Escape', 'Esc', 'GoBack', 'BrowserBack', 'XF86Back', 'Backspace']);
let _backAt = 0;
window.addEventListener('keydown', (e) => {
  if (!(BACK_KEYS.has(e.key) || e.keyCode === 4 || e.keyCode === 10009 || e.keyCode === 461) || e.repeat) return;
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const t = e.target;
  if (e.key === 'Backspace' && t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  if (t && t.closest && t.closest('#cw-notify-host, .toast-host')) return;   // Back on a message closes only the message
  if (!welcomeWaits()) return;
  /* Only over a page: not over a film, a game or another window (the Keyboard shortcuts window is a page). */
  let top = null; try { top = window.GnwKeys && window.GnwKeys.topLayer ? window.GnwKeys.topLayer() : null; } catch (x) {}
  if (top && top.id !== 'gk-help') return;
  if (document.querySelector('.overlay.open:not(#gk-help), #video-player-overlay.open')) return;
  const now = Date.now();
  if (now - _backAt < 400) return;   // a remote's Back arrives twice (its own code, then GoBack from keys.js)
  _backAt = now;
  setTimeout(() => {
    if (!welcomeWaits()) return;
    let t2 = null; try { t2 = window.GnwKeys && window.GnwKeys.topLayer ? window.GnwKeys.topLayer() : null; } catch (x) {}
    if (t2 || document.querySelector('.overlay.open, #video-player-overlay.open')) return;
    welcomeScreen({ reason: 'tab' });
  }, 60);
}, true);
/* The first load on this browser opens it; after that it waits in the tab (and slides out once a visit). */
function welcomeOnStart() {
  if (_gate !== 'needed') return;
  if (window.__cwOffsite) { welcomeScreen({ reason: 'offsite' }); return; }
  let seen = false;
  try { seen = localStorage.getItem(SEEN_KEY) === '1'; localStorage.setItem(SEEN_KEY, '1'); } catch (e) { seen = true; }
  if (!seen) welcomeScreen({ reason: 'first' }); else gateUpdate();
}
function reduceMotion() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
/* Put away: it slides back into the tab. */
/* Where the tab is, the welcome comes from and goes back to: the right edge, or the bar at the foot of a
   phone held upright (the same test as the tab's own styles). */
function barMode() { try { return document.documentElement.classList.contains('cw-small') && matchMedia('(orientation: portrait)').matches; } catch (e) { return false; } }
function slideMs() {
  if (reduceMotion()) return 150;
  try { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--drawer-in')); if (v > 0) return Math.round(v * 1000); } catch (e) {}
  return 820;
}
function tuckAway(dd) {
  const el = dd && dd.el;
  if (!el || el.classList.contains('cwr-out')) return;
  el.classList.toggle('cwr-up', barMode());
  el.classList.add('cwr-out');
  const m = el.querySelector('.modal');
  let done = false;
  const fin = () => { if (done) return; done = true; dd.close(); };
  if (m) m.addEventListener('animationend', (e) => { if (e.target === m && /^cwr-(out|fade-out)/.test(e.animationName)) fin(); });
  setTimeout(fin, slideMs() + 120);
}
const VAULT_SVG = '<svg class="cwvt-ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3.5" width="18" height="15.5" rx="2.2"/><circle cx="12" cy="11.2" r="3.3"/><path d="M12 7.9v1.1M12 13.4v1.1M8.7 11.2h1.1M14.2 11.2h1.1M6.5 19v1.8M17.5 19v1.8"/></svg>';
function tabStyles() {
  if (document.getElementById('cw-vault-tab-style')) return;
  const st = document.createElement('style');
  st.id = 'cw-vault-tab-style';
  st.textContent = `
    #cw-vault-tab { position:fixed; right:0; z-index:61; bottom:calc(max(88px, calc(13vh + env(safe-area-inset-bottom, 0px))) + 84px);
      width:50px; margin:0; padding:12px 2px 14px 6px; box-sizing:border-box;
      display:flex; flex-direction:column; align-items:center; gap:9px; color:var(--accent); cursor:pointer; font:inherit;
      background:rgba(var(--vg-strip-rgb, 43, 54, 71), .22); border:1px solid rgba(var(--accent-rgb), .55); border-right:0; border-radius:14px 0 0 14px;
      -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px);
      transition:background .15s, border-color .15s, box-shadow .15s; animation:cwvt-in .45s cubic-bezier(.3,0,.2,1) both; }
    #cw-vault-tab[hidden] { display:none; }
    #cw-vault-tab .cwvt-ic { width:24px; height:24px; flex:0 0 auto; filter:drop-shadow(0 1px 2px rgba(0,0,0,.55)); }
    :root[data-theme="light"] #cw-vault-tab { color:var(--accent-ink, var(--accent)); }
    :root[data-theme="light"] #cw-vault-tab .cwvt-ic { filter:drop-shadow(0 0 2px rgba(255,255,255,.9)); }
    #cw-vault-tab .cwvt-chev { width:14px; height:14px; opacity:.85; flex:0 0 auto; }
    #cw-vault-tab .cwvt-txt { display:flex; flex-direction:column; align-items:center; }
    #cw-vault-tab .cwvt-name { writing-mode:vertical-rl; transform:rotate(180deg); font-size:12.5px; font-weight:700; letter-spacing:.04em; color:var(--text); white-space:nowrap; }
    #cw-vault-tab .cwvt-sub, #cw-vault-tab .cwvt-up { display:none; }
    #cw-vault-tab:focus-visible, #cw-vault-tab:active { outline:none; background:var(--vg-strip-bg, var(--bg-2)); border-color:var(--accent); box-shadow:-10px 0 28px -10px rgba(0,0,0,.75); }
    #cw-vault-tab:focus-visible { box-shadow:0 0 0 3px rgba(var(--accent-rgb), .45), -10px 0 28px -10px rgba(0,0,0,.75); }
    @media (hover: hover) and (pointer: fine) { #cw-vault-tab:hover { background:var(--vg-strip-bg, var(--bg-2)); border-color:var(--accent); } }
    body.gnw-tv #cw-vault-tab { width:66px; border-radius:18px 0 0 18px; bottom:calc(max(88px, 13vh) + 108px); }
    @keyframes cwvt-in { from { transform:translateX(100%); } to { transform:none; } }
    /* A phone held upright: a slim bar at the foot, like a mini player. */
    @media (orientation: portrait) {
      html.cw-small #cw-vault-tab { left:12px; right:12px; bottom:calc(12px + env(safe-area-inset-bottom, 0px)); width:auto; height:56px;
        flex-direction:row; justify-content:flex-start; gap:12px; padding:0 14px; border:1px solid rgba(var(--accent-rgb), .55); border-radius:14px;
        background:var(--vg-strip-bg, var(--bg-2)); box-shadow:0 10px 30px -12px rgba(0,0,0,.6); animation-name:cwvt-up; }
      html.cw-small #cw-vault-tab .cwvt-chev { display:none; }
      html.cw-small #cw-vault-tab .cwvt-txt { align-items:flex-start; text-align:left; min-width:0; }
      html.cw-small #cw-vault-tab .cwvt-name { writing-mode:horizontal-tb; transform:none; font-size:14px; letter-spacing:0; }
      html.cw-small #cw-vault-tab .cwvt-sub { display:block; font-size:12px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      html.cw-small #cw-vault-tab .cwvt-up { display:block; width:18px; height:18px; margin-left:auto; flex:0 0 auto; }
    }
    @keyframes cwvt-up { from { transform:translateY(140%); } to { transform:none; } }
    /* The welcome comes out of the tab and goes back into it, as one motion: from the right edge,
       or up from the bar at the foot of a phone held upright, the tab's own test. The drawers' timing and
       curve; the dimmed page fades in and out with it. Reduced motion: no slide, a quick fade. */
    .overlay.open.cwr-slide { display:flex; justify-content:flex-end; align-items:stretch; padding:0; overflow:hidden; opacity:1; transition:none;
      animation:cwr-bd-in var(--drawer-in, .82s) var(--drawer-ease, cubic-bezier(.3,0,.2,1)) both; }
    .overlay.open.cwr-slide > .modal { margin:0 !important; width:min(520px, 100vw); max-width:520px !important; height:100%; max-height:none;
      border-radius:22px 0 0 22px; border-right:0; overflow-y:auto; transform:none; transition:none;
      animation:cwr-in-r var(--drawer-in, .82s) var(--drawer-ease, cubic-bezier(.3,0,.2,1)) both; }
    .overlay.open.cwr-slide.cwr-out { animation-name:cwr-bd-out; pointer-events:none; }
    .overlay.open.cwr-slide.cwr-out > .modal { animation-name:cwr-out-r; }
    html.cw-small .overlay.open.cwr-slide > .modal { width:100%; max-width:none !important; border-radius:0; }
    @media (orientation: portrait) {
      html.cw-small .overlay.open.cwr-slide > .modal { animation-name:cwr-in-u; }
      html.cw-small .overlay.open.cwr-slide.cwr-out > .modal { animation-name:cwr-out-u; }
    }
    @keyframes cwr-in-r { from { transform:translateX(100%); } to { transform:none; } }
    @keyframes cwr-out-r { from { transform:none; } to { transform:translateX(100%); } }
    @keyframes cwr-in-u { from { transform:translateY(100%); } to { transform:none; } }
    @keyframes cwr-out-u { from { transform:none; } to { transform:translateY(100%); } }
    @keyframes cwr-bd-in { from { background-color:transparent; -webkit-backdrop-filter:blur(0); backdrop-filter:blur(0); } }
    @keyframes cwr-bd-out { to { background-color:transparent; -webkit-backdrop-filter:blur(0); backdrop-filter:blur(0); } }
    @keyframes cwr-fade-in { from { opacity:0; } to { opacity:1; } }
    @keyframes cwr-fade-out { from { opacity:1; } to { opacity:0; } }
    @media (prefers-reduced-motion: reduce) {
      #cw-vault-tab { animation:none; }
      .overlay.open.cwr-slide, html.cw-small .overlay.open.cwr-slide { animation:cwr-fade-in .15s linear both; }
      .overlay.open.cwr-slide > .modal, html.cw-small .overlay.open.cwr-slide > .modal { animation:none !important; }
      .overlay.open.cwr-slide.cwr-out, html.cw-small .overlay.open.cwr-slide.cwr-out { animation:cwr-fade-out .15s linear both; }
    }
    /* Settings and the Systems menu show once there is a vault. */
    html.cw-novault #video-settings-btn, html.cw-novault .vgames-wrap > .vg-tab, html.cw-novault .vgames-menu { display:none !important; }
    /* No vault on our own address: the pages stay open and the wall is out of reach. */
    html.cw-pagesheld #video-about .about-xbar, html.cw-pagesheld #video-about .about-x { display:none !important; }
    html.cw-vaultneeded #video-body .collection-toolbar .filter-bar { display:none !important; }
    html.cw-pagesheld :is(#video-grid, #video-continue, #video-library, #video-people, #video-collections, #video-person-banner, #video-status) { visibility:hidden !important; }
  `;
  document.head.appendChild(st);
}
function showTab(show) {
  let t = document.getElementById('cw-vault-tab');
  if (!show) { if (t) t.hidden = true; return; }
  if (!document.body) return;
  tabStyles();
  if (!t) {
    t = document.createElement('button');
    t.type = 'button'; t.id = 'cw-vault-tab';
    t.setAttribute('aria-label', 'Your vault');
    t.title = 'Your vault';
    t.innerHTML = '<svg class="cwvt-chev" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 6 9 12 15 18"/></svg>' +
      VAULT_SVG + '<span class="cwvt-txt"><span class="cwvt-name">Your vault</span></span>' +
      '<svg class="cwvt-up" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 15 12 9 18 15"/></svg>';
    /* Heard before the page's own catch-all (emby.js closes the Home window on any press outside it and
       stops that press), so the first press on the tab always slides the welcome out. */
    window.addEventListener('click', (e) => {
      const hit = e.target && e.target.closest && e.target.closest('#cw-vault-tab');
      if (!hit) return;
      e.stopPropagation(); e.preventDefault();
      welcomeScreen({ reason: 'tab' });
    }, true);
    document.body.appendChild(t);
  }
  t.hidden = false;
}
/* Once a visit, after a minute on the wall: no drawer, game, window or dialog open, the page in view, nobody typing. */
let _sbTimer = null, _sbWall = 0, _sbQuiet = 0;
function slidThisVisit() { try { return sessionStorage.getItem(SLID_KEY) === '1'; } catch (e) { return true; } }
function markSlid() { try { sessionStorage.setItem(SLID_KEY, '1'); } catch (e) {} }
function slideDelay() { const v = Number(dev('cws.dev.welcomeDelay')); return v > 0 ? v : 60; }   // a test on 127.0.0.1 may shorten it
function busyNow() {
  if (document.visibilityState !== 'visible') return true;
  if (document.querySelector('.overlay.open')) return true;
  try { if (typeof window.cwRouteNow === 'function' && /^\/play\//.test(window.cwRouteNow())) return true; } catch (e) {}
  const a = document.activeElement;
  return !!(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable));
}
function startSlideBack() {
  if (_sbTimer || slidThisVisit()) return;
  const need = slideDelay();
  _sbTimer = setInterval(() => {
    if (_gate !== 'needed' || window.__cwOffsite || slidThisVisit()) { clearInterval(_sbTimer); _sbTimer = null; return; }
    if (_welcomeOpen || busyNow()) { _sbQuiet = 0; return; }
    _sbWall++; _sbQuiet++;
    if (_sbWall >= need && _sbQuiet >= 3) { clearInterval(_sbTimer); _sbTimer = null; welcomeScreen({ reason: 'auto' }); }
  }, 1000);
}
/* Every way into a game, and into Settings, asks the gate first. The site's own functions are wrapped where
   they are defined, so a tile's Play, the drawer's Play Now! and Resume play, a key, a controller and a
   #/play/ address all arrive here. A press made while the vault is still answering waits for it. */
const PLAY_FNS = ['openPlay', 'openGbPlay', 'openNesPlay', 'openAtariPlay', 'openPmPlay', 'openTftPlay', 'openTjPlay', 'openPlayModal'];
function guardFn(obj, name, reason, held) {   // held: what a stopped call answers (undefined by default)
  const f = obj && obj[name];
  if (typeof f !== 'function') return false;
  if (f.__cwVaultGuard) return true;
  const g = function () {
    const args = [].slice.call(arguments), self = this;
    if (_gate === 'ready' || _gate === 'open') return f.apply(self, args);
    const e = args.find((a) => a && typeof a === 'object' && typeof a.stopPropagation === 'function');
    if (e) { try { e.stopPropagation(); e.preventDefault(); } catch (x) {} }
    if (_gate === 'needed') { welcomeScreen({ reason }); return held; }
    gateSettled().then(() => { if (_gate === 'needed') welcomeScreen({ reason }); else f.apply(self, args.map((a) => (a === e ? undefined : a))); });
    return held;
  };
  g.__cwVaultGuard = true; g.__cwOrig = f;
  try { obj[name] = g; } catch (x) { return false; }
  return true;
}
function installGuards() {
  let all = true;
  PLAY_FNS.forEach((n) => { if (!guardFn(window, n, 'play')) all = false; });
  if (!guardFn(window.CwRob, 'playTime', 'play')) all = false;
  if (!guardFn(window.ContinueRow, 'openGame', 'play')) all = false;
  if (!guardFn(window, 'openVaultModal', 'settings')) all = false;
  /* The drawers and the Systems switcher are the wall's: a page's link to a game or a system, a #/device/
     address, the shoulders and their keys. */
  ['openDevice', 'openGBDevice', 'openNESDevice', 'openAtariDevice', 'openPMDevice'].forEach((n) => { if (!guardFn(window, n, 'play')) all = false; });
  if (!guardFn(window.CwRob, 'openDrawer', 'play')) all = false;
  if (!guardFn(window.GnwSwitcher, 'step', 'play', true)) all = false;   // true: the step was taken, nothing else applies it
  return all;
}
if (SUPPORTED) {
  installGuards();
  let tries = 0;
  const gi = setInterval(() => { if (installGuards() || ++tries > 60) clearInterval(gi); }, 1000);   // scripts that load later
  gateUpdate();
  setTimeout(() => { if (_gate === 'checking') setGate('open'); }, 12000);   // no vault answer at all: lock nothing
} else {
  _gate = 'open';
}
function copyText(text, ok) {
  const done = () => ui().toast(ok, 'ok');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => ui().toast('Copy failed', 'error'));
}

/* ---- the person in the site's top line, and the top of Settings, Your vault ----
   A round button at the right end of the line that holds the CrystalWorlds mark (emby.js draws that
   line, #video-brand, and redraws it; this button is its own element placed beside it, so the mark's
   code is not touched). It shows the person's picture, else the lettered circle (the name's first
   letter), else a person outline, and opens Settings on Your vault. There, the "Your name and
   picture" block changes the picture, the name and the PIN, through the same vault functions. */
const PERSON_SVG = '<svg width="60%" height="60%" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" style="color:var(--muted);"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';
function paintAvatar(el) {
  const p = S.profile, ch = p && p.alias ? Array.from(p.alias.trim())[0] : '';
  if (p && p.avatar) { el.style.backgroundImage = 'url("' + p.avatar + '")'; el.textContent = ''; return; }
  el.style.backgroundImage = '';
  if (ch) el.textContent = ch.toUpperCase(); else el.innerHTML = PERSON_SVG;
}
function meStyles() {
  if (document.getElementById('cw-me-style')) return;
  const st = document.createElement('style');
  st.id = 'cw-me-style';
  st.textContent = `
    #cw-me { position:relative; height:0; z-index:6; }
    #cw-me .cw-me-btn { position:absolute; right:0; top:0; width:40px; height:40px; padding:0; border-radius:50%;
      border:1px solid var(--line); background:var(--line) center/cover no-repeat; color:var(--text);
      font-family:inherit; font-size:17px; font-weight:700; line-height:1; cursor:pointer;
      display:inline-flex; align-items:center; justify-content:center; }
    #cw-me .cw-me-btn:hover { border-color:var(--accent); }
    #cw-me .cw-me-btn:focus-visible { outline:var(--focus-width, 3px) solid var(--accent); outline-offset:var(--focus-offset, 3px); }
    body.gnw-tv #cw-me .cw-me-btn { width:52px; height:52px; font-size:22px; }
    @media (max-width: 560px) { #cw-me .cw-me-btn { width:32px; height:32px; font-size:14px; } }
    .cw-me-av { width:64px; height:64px; flex:none; border-radius:50%; border:1px solid var(--line); background:var(--line) center/cover no-repeat;
      color:var(--text); font-size:26px; font-weight:700; line-height:1; display:inline-flex; align-items:center; justify-content:center; }
  `;
  document.head.appendChild(st);
}
function openMe() {
  try { if (typeof openVaultModal === 'function') openVaultModal(); } catch (e) {}   // eslint-disable-line no-undef
  try { if (typeof switchSettingsTab === 'function') switchSettingsTab('code'); } catch (e) {}   // eslint-disable-line no-undef
  setTimeout(() => { const sec = document.getElementById('cw-me-section'); if (sec) { try { sec.scrollIntoView({ block: 'nearest' }); } catch (e) {} } }, 80);
}
function placeMe() {
  const brand = document.getElementById('video-brand');
  let w = document.getElementById('cw-me');
  if (!brand) { if (w) w.hidden = true; return; }
  if (!w || w.nextElementSibling !== brand) {
    meStyles();
    if (w) w.remove();
    w = document.createElement('div'); w.id = 'cw-me';
    w.innerHTML = '<button type="button" class="cw-me-btn"></button>';
    w.firstElementChild.addEventListener('click', openMe);
    brand.parentNode.insertBefore(w, brand);
  }
  w.hidden = false;
  const btn = w.firstElementChild, name = S.profile && S.profile.alias;
  paintAvatar(btn);
  const label = name ? name + ': your vault' : 'Your vault';
  if (btn.getAttribute('aria-label') !== label) { btn.setAttribute('aria-label', label); btn.title = label; }
  /* Centred on the mark, wherever emby.js put it (beside the search bar, or on its own line above it). */
  const mark = brand.querySelector('.vgbrand');
  if (mark) {
    const top = Math.round(mark.getBoundingClientRect().top - w.getBoundingClientRect().top + (mark.offsetHeight - btn.offsetHeight) / 2);
    if (btn.style.top !== top + 'px') btn.style.top = top + 'px';
  }
}
let _meWatch = false;
function watchMe() {
  if (_meWatch) return; _meWatch = true;
  let soon = 0;
  const later = () => { if (!soon) soon = requestAnimationFrame(() => { soon = 0; placeMe(); }); };
  window.addEventListener('resize', later);
  setInterval(placeMe, 1500);   // the mark moves when emby.js fits it (redraws, resizes, every 3 s)
  try { new MutationObserver(later).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  later();
}
function meSectionHtml() {
  const u = ui(), name = S.profile && S.profile.alias, pic = !!(S.profile && S.profile.avatar), havePin = !!(S.pinParams && !S.pinParams.none);
  return '<label style="' + u.LBL + '">Your alias and avatar</label>' +
    '<div style="display:flex; gap:14px; align-items:center; flex-wrap:wrap; margin:0 0 8px;">' +
      '<span class="cw-me-av" aria-hidden="true"></span>' +
      '<div style="flex:1; min-width:180px;"><div style="font-size:15px; font-weight:700; color:var(--text); margin:0 0 8px;">' + (name ? esc(name) : 'No alias yet') + '</div>' +
      '<div style="display:flex; gap:8px; flex-wrap:wrap;">' +
        u.button({ label: 'Change avatar', action: 'cwr-me-pic' }).outerHTML +
        (pic ? u.button({ label: 'Remove avatar', action: 'cwr-me-nopic' }).outerHTML : '') +
        u.button({ label: 'Change alias', action: 'cwr-me-name' }).outerHTML +
        u.button({ label: havePin ? 'Change PIN' : 'Set your PIN', action: 'cwr-me-pin' }).outerHTML +
      '</div></div></div>' +
    '<input class="cw-me-file" type="file" accept="image/*" style="display:none">' +
    '<p style="' + u.P + ' font-size:11.5px; margin:0;">Your alias and avatar are public: game server owners see them when you join. Without an avatar, others see the first letter of your alias.</p>' +
    '<div class="cw-me-msg" role="status" style="' + ERR + '"></div>';
}
function renderMe() {
  try { placeMe(); } catch (e) {}
  const sec = document.getElementById('cw-me-section');
  if (!sec || !H) return;
  if (!SUPPORTED || !S.code || !S.profileKnown) { sec.hidden = true; return; }
  const had = sec.contains(document.activeElement) && document.activeElement.getAttribute('data-cws-action');
  sec.innerHTML = meSectionHtml(); sec.hidden = false;
  paintAvatar(sec.querySelector('.cw-me-av'));
  if (had) { const b = sec.querySelector('[data-cws-action="' + had + '"]'); if (b) try { b.focus({ preventScroll: true }); } catch (e) {} }
  if (sec.__wired) return;
  sec.__wired = true;
  sec.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-cws-action]'); if (!b) return;
    const a = b.getAttribute('data-cws-action');
    if (a === 'cwr-me-pic') { if (!(S.profile && S.profile.alias)) { welcomeScreen(); return; } sec.querySelector('.cw-me-file').click(); }
    else if (a === 'cwr-me-nopic') saveMe(S.profile.alias, null, 'Avatar removed. Others see the first letter of your alias.');
    else if (a === 'cwr-me-name') changeNameDialog();
    else if (a === 'cwr-me-pin') { if (S.pinParams && !S.pinParams.none) changePinDialog(); else welcomeScreen(); }
  });
  sec.addEventListener('change', async (e) => {
    if (!e.target.classList.contains('cw-me-file')) return;
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { const a = await avatarFrom(f); await saveMe(S.profile.alias, a, 'Avatar saved.'); }
    catch (x) { meMsg(x.message || 'That avatar could not be read.', false); }
  });
}
function meMsg(t, ok) { const m = document.querySelector('#cw-me-section .cw-me-msg'); if (m) { m.textContent = t; m.style.color = ok ? 'var(--accent)' : '#f08a5d'; } }
/* pic: {type, bytes} for a new picture, null to remove it, undefined to keep the current one. */
async function saveMe(alias, pic, done) {
  let avB64 = null, avType = null, url = null;
  if (pic === undefined && S.profile && S.profile.avatarB64u) { avB64 = S.profile.avatarB64u; avType = S.profile.avatarType; url = S.profile.avatar; }
  else if (pic) { avB64 = P.b64u(pic.bytes); avType = pic.type; url = 'data:' + pic.type + ';base64,' + b64std(pic.bytes); }
  try {
    await vcall(VF.setProfile(S.code, alias, avB64, avType));
    S.profile = { alias, avatar: url, avatarB64u: avB64, avatarType: avType };
    renderMe(); render();
    if (done) meMsg(done, true);
    return true;
  } catch (e) {
    meMsg(e.code === 'vault_down' ? 'CrystalWorlds can\'t be reached right now, so this was not saved. Try again in a moment.'
      : e.code === 'bad_alias' ? 'That alias has a character that cannot be shown.'
        : e.code === 'bad_avatar' ? 'That avatar could not be kept. Try another one.'
          : 'Could not save (' + (e.code || e.message) + '). Try again in a moment.', false);
    return false;
  }
}
function changeNameDialog() {
  const u = ui();
  const d = u.dialog({
    sub: 'Your vault', title: 'Change your alias',
    html: '<label style="' + u.LBL + '">Your alias</label>' +
      '<input class="cwr-alias" type="text" maxlength="64" autocomplete="nickname" spellcheck="false" placeholder="The alias others see" value="' + esc(S.profile ? S.profile.alias : '') + '" style="width:100%; box-sizing:border-box; ' + u.INPUT + '">' +
      '<p style="' + u.P + ' font-size:11.5px; margin-top:8px;">Your alias is public: game server owners see it when you join.</p>' +
      '<div class="cwr-msg" role="status" style="' + ERR + '"></div>',
    actions: [
      { label: 'Save', kind: 'accent', action: 'cwr-name-go', onClick: () => go() },
      { label: 'Cancel', action: 'close', onClick: (dd) => dd.close() },
    ],
  });
  let busy = false;
  async function go() {
    if (!d.el || busy) return;
    const msg = d.el.querySelector('.cwr-msg'), alias = (d.el.querySelector('.cwr-alias').value || '').trim();
    const ap = aliasProblem(alias); if (ap) { msg.textContent = ap; return; }
    busy = true; msg.style.color = 'var(--muted)'; msg.textContent = 'Saving…';
    if (await saveMe(alias, undefined, 'Alias saved.')) d.close();
    else { msg.style.color = '#f08a5d'; msg.textContent = (document.querySelector('#cw-me-section .cw-me-msg') || {}).textContent || 'Could not save.'; }
    busy = false;
  }
  const wire = () => { if (!d.el) { setTimeout(wire, 200); return; } d.el.querySelector('.cwr-alias').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } }); };
  wire();
}

/* ---- 10: a known server's key changed ---- */
function keyChangeDialog(c, clash) {
  const u = ui();
  u.dialog({
    sub: 'Game servers', title: 'Is this the same server?',
    html: '<p style="' + u.P + '">This looks like <b style="color:var(--text)">' + esc(clash.name) + '</b>, but its key is different. If its owner has not told you they reinstalled it, choose Not now.</p>',
    actions: [
      { label: 'Not now', kind: 'accent', action: 'cwr-key-no', onClick: (d) => { d.close(); c.teardown(false); c.state = 'held'; c.msg = 'Waiting: its key is different from the one you know.'; render(); } },
      { label: 'It was reinstalled: use it', kind: 'warn', action: 'cwr-key-yes', onClick: (d) => {
        d.close(); setHeldOk(c.serverKey);
        untrust(clash.key).catch(() => {});
        if (c.ctrl && c.ctrl.readyState === 'open') { c.state = 'connecting'; c.letIn(); } else { c.state = 'failed'; c.start(); }
      } },
    ],
  });
}

/* ---- 4.4: Replace connection key ---- */
async function replaceConnectionKey(code) {
  code = code || S.code;
  const old = await vcall(VF.getKey(code));
  if (!old || old.none) throw Object.assign(new Error('no key'), { code: 'no_key' });
  const oldPub = u8(old.public_key, 65);
  const oldPriv = await P.unlockKey(code, u8(old.locked_key, 61), oldPub, false);
  const fresh = await newKeyPair();
  const blob = await P.lockKey(code, fresh.d, fresh.pub);
  const A = await P.connectionKey(oldPub), issued_at = rfc3339(now());
  const lines = P.buildLines('move', { old_code: A, new_code: fresh.ck, old_key: old.public_key, new_key: fresh.pubB64, issued_at });
  const note = { old_key: old.public_key, new_key: fresh.pubB64, issued_at, sig_old: P.b64u(await P.sign(oldPriv, lines)), sig_new: P.b64u(await P.sign(fresh.priv, lines)) };
  await vcall(VF.replaceKey(code, fresh.pubB64, P.b64u(blob), note));
  fresh.d.fill(0);
  const k = { pub: fresh.pub, pubB64: fresh.pubB64, ck: fresh.ck, priv: fresh.priv };
  await kput(S.vhp, k); S.key = k;
  /* The servers reached now hear of the move at once, in room A; the rest find the note there later (loadMoves). */
  for (const c of [...S.conns.values()]) c.teardown(false);
  S.conns.clear(); S.bySid.clear();
  joinRooms();
  render();
  return k;
}
function replaceKeyDialog() {
  const u = ui();
  const d = u.dialog({
    sub: 'Game servers', title: 'Replace your connection key?',
    html: '<p style="' + u.P + '">This makes a new connection key. Game servers that know you move you to it by themselves, keeping your access and devices, as each one next comes online (within 90 days). Use it if you think someone else had your vault code.</p>' +
      '<p style="' + u.P + '">After that, give the new key to anyone you share it with: the old one stops working.</p><div class="cwr-msg" role="status" style="' + ERR + '"></div>',
    actions: [
      { label: 'Replace connection key', kind: 'warn', action: 'cwr-replace-go', onClick: async (dd, b) => {
        b.disabled = true; const msg = dd.el.querySelector('.cwr-msg'); msg.style.color = 'var(--muted)'; msg.textContent = 'Replacing…';
        try { await replaceConnectionKey(); dd.close(); u.toast('Connection key replaced. Copy the new one from Settings, Game servers.', 'ok'); }
        catch (e) { msg.style.color = '#f08a5d'; msg.textContent = 'Could not replace it (' + (e.code || e.message) + ').'; b.disabled = false; }
      } },
      { label: 'Cancel', action: 'close', onClick: (dd) => dd.close() },
    ],
  });
  return d;
}

/* Settings, Recovery email: its own words (Forgot your vault code? needs the email and the PIN together). */
function emailWords() {
  const inp = document.getElementById('vault-email-input');
  const sec = inp && inp.closest('.vault-section'), p = sec && sec.querySelector('p');
  if (p && !p.__reach) { p.__reach = true; p.innerHTML = 'Used only so <em>Forgot your vault code?</em> below can mail your code to you, once you also enter this vault\'s PIN. We keep a scrambled fingerprint of it and a short reminder like p•••@gmail.com, never the address itself. Not used to log in. You can leave this blank.'; }
}

/* ---- Settings, Recovery email: once a vault has a PIN and an email, changing or clearing the email needs the PIN
   (otherwise someone with only the vault code could take the code recovery away from the vault's owner). The save goes
   through index.html's vaultSetEmail (recover-vault, action save); the page shows only the hint it answers. ---- */
let _origEmail = null;
function wrapEmail() {
  const cur = window.saveVaultEmail;
  if (typeof cur !== 'function' || cur.__reach) return;
  _origEmail = cur;
  const mine = async function () {
    const pp = await loadPinParams();
    if (!pp || pp.none || !(pp.has_email || pp.reset_needs_email)) return _origEmail.apply(window, arguments);
    const input = document.getElementById('vault-email-input'), out = document.getElementById('vault-email-msg');
    const email = ((input && input.value) || '').trim();
    const u = ui();
    const d = u.dialog({
      sub: 'Recovery email', title: 'Enter your PIN',
      html: '<p style="' + u.P + '">' + (email ? 'To change the recovery email to <b style="color:var(--text)">' + esc(email) + '</b>' : 'To remove the recovery email') + ', enter your PIN. This stops anyone who only has your vault code from changing how the code is recovered.</p>' +
        '<form class="cwr-pin-form" autocomplete="off" style="display:flex; gap:10px; align-items:center; margin:0 0 6px;">' +
        '<input class="cwr-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="12" aria-label="PIN" placeholder="6 to 12 digits" style="flex:1; ' + u.INPUT + ' font-family:ui-monospace,Consolas,monospace; letter-spacing:.2em;"></form>' +
        '<div class="cwr-msg" role="status" style="' + ERR + '"></div>',
      actions: [
        { label: 'Save', kind: 'accent', action: 'cwr-email-go', onClick: () => go() },
        { label: 'Cancel', action: 'close', onClick: (dd) => dd.close() },
      ],
    });
    let busy = false;
    async function go() {
      if (!d.el || busy) return;
      const inp = d.el.querySelector('.cwr-pin'), msg = d.el.querySelector('.cwr-msg'), v = (inp.value || '').trim();
      if (!P.validPin(v)) { msg.textContent = 'A PIN is 6 to 12 digits.'; return; }
      busy = true; msg.style.color = 'var(--muted)'; msg.textContent = 'Checking…';
      try {
        const x = await P.pinStretch(v, u8(pp.salt, 16), pp.iterations);
        const r = typeof window.vaultSetEmail === 'function' ? await window.vaultSetEmail(email, P.b64u(x)) : { ok: false, error: 'The page is still starting. Try again in a moment.' };
        if (!r.ok) throw Object.assign(new Error(r.error || 'refused'), { code: r.code || 'refused', info: r.info || {} });
        inp.value = ''; d.close();
        if (typeof window.vaultShowRecovery === 'function') window.vaultShowRecovery(r.hint || null);
        if (out) { out.textContent = email ? 'Saved. Forgot your vault code? can now mail your code to that address.' : 'Recovery email removed.'; out.style.color = 'var(--accent)'; }
        S.pinParams = null; loadPinParams();
      } catch (e) { msg.style.color = '#f08a5d'; msg.textContent = e.code === 'bad_email' ? 'That email address does not look right.' : (e.code === 'pin_incorrect' || e.code === 'pin_locked' || e.code === 'vault_down') ? pinError(e) : (e.message || pinError(e)); inp.value = ''; }
      busy = false;
    }
    const wire = () => { if (!d.el) { setTimeout(wire, 200); return; } d.el.querySelector('.cwr-pin-form').addEventListener('submit', (e) => { e.preventDefault(); go(); }); };
    wire();
  };
  mine.__reach = true;
  window.saveVaultEmail = mine;
}

/* ---- Settings, Switch to a different vault: the vault's PIN first (item 7), as on the welcome screen.
   A code no vault has yet, or a vault without a PIN, switches as before. ---- */
let _origImport = null;
function wrapImport() {
  const cur = window.importVaultCode;
  if (typeof cur !== 'function' || cur.__reach) return;
  _origImport = cur;
  const mine = async function () {
    const box = document.getElementById('vault-code-input'), out = document.getElementById('vault-msg');
    const r = parseVaultCode(box ? box.value : '');
    if (r.err || r.code === _pinProved || r.code === S.code) return _origImport.apply(window, arguments);
    const args = arguments;
    const say = (t, ok) => { if (out) { out.textContent = t; out.style.color = ok ? 'var(--muted)' : '#f08a5d'; } };
    let pp = null;
    try { if ((await vcall(['vault_exists', { p_vault: r.code }])) === true) pp = await vcall(VF.pinParams(r.code)); }
    catch (e) { say(e.code === 'vault_down' ? NET_MESSAGE : 'That code could not be checked (' + (e.code || e.message) + '). Try again in a moment.'); return; }
    if (!pp || pp.none) return _origImport.apply(window, args);
    const u = ui();
    return new Promise((done) => {
      const d = u.dialog({
        sub: 'Your vault', title: 'Enter that vault\'s PIN',
        html: '<p style="' + u.P + '">That vault has a PIN. Enter it to open the vault on this browser.</p>' +
          '<form class="cwr-pin-form" autocomplete="off" style="display:flex; gap:10px; align-items:center; margin:0 0 6px;">' +
          '<input class="cwr-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="12" aria-label="PIN" placeholder="6 to 12 digits" style="flex:1; ' + u.INPUT + ' font-family:ui-monospace,Consolas,monospace; letter-spacing:.2em;"></form>' +
          '<div class="cwr-msg" role="status" style="' + ERR + '"></div>',
        actions: [
          { label: 'Open the vault', kind: 'accent', action: 'cwr-import-go', onClick: () => go() },
          { label: 'Cancel', action: 'close', onClick: (dd) => dd.close() },
        ],
        onClose: () => done(),
      });
      let busy = false;
      async function go() {
        if (!d.el || busy) return;
        const inp = d.el.querySelector('.cwr-pin'), msg = d.el.querySelector('.cwr-msg'), v = (inp.value || '').trim();
        if (!P.validPin(v)) { msg.textContent = 'A PIN is 6 to 12 digits.'; return; }
        busy = true; msg.style.color = 'var(--muted)'; msg.textContent = 'Checking…';
        try {
          const x = await P.pinStretch(v, u8(pp.salt, 16), pp.iterations);
          await vcall(VF.pinKeys(r.code, P.b64u(x)));
          inp.value = '';
          if (box) box.value = r.code;
          await _origImport.apply(window, args);
          d.close();
        } catch (e) { msg.style.color = '#f08a5d'; msg.textContent = pinError(e); inp.value = ''; }
        busy = false;
      }
      const wire = () => { if (!d.el) { setTimeout(wire, 200); return; } d.el.querySelector('.cwr-pin-form').addEventListener('submit', (e) => { e.preventDefault(); go(); }); };
      wire();
    });
  };
  mine.__reach = true;
  window.importVaultCode = mine;
}

/* ---- Change code (Settings, Rotate access code), keeping the connection key unless the box stays ticked (4.2, design 2.5) ---- */
let _origRotate = null;
function wrapRotate() {
  const cur = window.rotateVaultCode;
  if (typeof cur !== 'function' || cur.__reach) return;
  _origRotate = cur;
  const mine = function () { return rotateWithKey(); };
  mine.__reach = true;
  window.rotateVaultCode = mine;
  try { H.rewrapRotate && H.rewrapRotate(); } catch (e) {}
}
async function rotateWithKey() {
  const msg = document.getElementById('vault-rotate-msg');
  const say = (t, ok) => { if (msg) { msg.innerHTML = t; msg.style.color = ok ? 'var(--accent)' : (ok === false ? '#f08a5d' : 'var(--muted)'); } };
  let rec = null; try { rec = await vcall(VF.getKey(S.code)); } catch (e) { say('The vault service cannot be reached right now.', false); return; }
  if (!rec || rec.none) return _origRotate.apply(window, arguments);   // no game server key: the rotation as before
  const u = ui();
  const go = await new Promise((res) => {
    u.dialog({
      sub: 'Rotate access code', title: 'Generate a new vault code?',
      html: '<p style="' + u.P + '">A brand-new code will replace the current one. Your recovery email stays with the vault and this browser\'s play time carries over; only the code changes.</p>' +
        '<p style="' + u.P + '">The old code stops working immediately. Make sure you can save the new one somewhere safe (password manager) before closing this window. If you lose it, only a saved recovery email, with your PIN, can get it back.</p>' +
        '<label style="display:flex; gap:8px; align-items:flex-start; font-size:12.5px; color:var(--text); margin:0 0 4px;"><input type="checkbox" class="cwr-also-key" checked> Also replace my connection key</label>' +
        '<p style="' + u.P + ' font-size:11.5px; margin-left:24px;">Someone who had the old code could also have copied your key. Untick this if you are only tidying up.</p>',
      actions: [
        { label: 'Rotate code', kind: 'danger', action: 'cwr-rotate-go', onClick: (d) => { const also = !!(d.el && d.el.querySelector('.cwr-also-key').checked); d.close(); res({ also }); } },
        { label: 'Cancel', action: 'close', onClick: (d) => { d.close(); res(null); } },
      ],
      onDismiss: (d) => { d.close(); res(null); },
    });
  });
  if (!go) return;
  say('Rotating…');
  try {
    const oldCode = S.code;
    const newCode = crypto.randomUUID();
    /* The private half is unlocked with the old code (only here, only for this step) and locked again with the new one. */
    const pub = u8(rec.public_key, 65);
    const ex = await P.unlockKey(oldCode, u8(rec.locked_key, 61), pub, true);
    const d = await P.exportScalar(ex);
    const blob = await P.lockKey(newCode, d, pub); d.fill(0);
    const relockMoves = async () => {
      const olds = {}, mv = await vcall(VF.listMoves(oldCode));
      for (const m of (mv && mv.moves) || []) {
        const op = u8(m.old_public_key, 65), ok = await P.unlockKey(oldCode, u8(m.old_locked_key, 61), op, true), od = await P.exportScalar(ok);
        olds[m.old_connection_key] = P.b64u(await P.lockKey(newCode, od, op)); od.fill(0);
      }
      return olds;
    };
    try { await vcall(VF.rotateKeep(oldCode, newCode, P.b64u(blob), await relockMoves())); }
    catch (e) { if (e.code !== 'moves_changed') throw e; await vcall(VF.rotateKeep(oldCode, newCode, P.b64u(blob), await relockMoves())); }
    // As the rotation before this one: the new code is kept, and this browser's play time follows it.
    try {
      if (typeof PLAY_TIME_KEY !== 'undefined' && typeof setVaultCode === 'function') {   // eslint-disable-line no-undef
        const pt = localStorage.getItem(PLAY_TIME_KEY + ':' + oldCode);   // eslint-disable-line no-undef
        setVaultCode(newCode);   // eslint-disable-line no-undef
        if (pt !== null && typeof _playKey === 'function') { localStorage.setItem(_playKey(), pt); localStorage.removeItem(PLAY_TIME_KEY + ':' + oldCode); }   // eslint-disable-line no-undef
      } else if (typeof setVaultCode === 'function') setVaultCode(newCode);   // eslint-disable-line no-undef
    } catch (e) {}
    const disp = document.getElementById('vault-code-display'); if (disp) disp.value = newCode;
    try { if (navigator.clipboard) navigator.clipboard.writeText(newCode).catch(() => {}); } catch (e) {}
    const oldVhp = S.vhp;
    const nv = await H.storeKey(newCode);
    const local = await kget(oldVhp); if (local) { await kput(nv, local); await kput(oldVhp, null); }
    const t = lsGet(K_TRUSTED); if (t[oldVhp]) { t[nv] = t[oldVhp]; delete t[oldVhp]; lsSet(K_TRUSTED, t); }
    const hk = lsGet(K_HELD); if (hk[oldVhp]) { hk[nv] = hk[oldVhp]; delete hk[oldVhp]; lsSet(K_HELD, hk); }
    S.code = newCode; S.vhp = nv;
    if (go.also) { say('New code made. Replacing your connection key…'); await replaceConnectionKey(newCode); }
    say('<strong style="color:var(--accent)">New code generated.</strong> Copy it now: the old code is dead.' + (go.also ? ' Your connection key was replaced too.' : ''), true);
  } catch (e) { say('Rotation failed: ' + esc(e.message || e), false); }
}

/* ---- Settings, Game servers: the "Over the internet" choice (item 4) ----
   The connection key with Copy and Share, the steps in plain words, then the waiting line, which
   becomes the server's row (drawn by cws.js) once a server lists the key. */
function canShare() { try { return typeof navigator.share === 'function'; } catch (e) { return false; } }
function cardHtml() {
  const u = ui();
  let h = '<div class="cwr-card">';
  if (!SUPPORTED) return h + '<p style="' + u.P + '">' + esc(S.msg) + '</p></div>';
  if (!S.key) {
    return h + '<p style="' + u.P + '">' + esc(S.msg || 'Choose your alias and PIN first. Then this shows your connection key.') + '</p>' +
      (S.msg && !/^Can't reach/.test(S.msg) ? '' : u.button({ label: 'Choose alias and PIN', kind: 'accent', action: 'cwr-welcome' }).outerHTML) + '</div>';
  }
  h += '<label style="' + u.LBL + ' margin-top:2px;">Your connection key</label>' +
    '<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;"><code class="cwr-ck-show" style="flex:1; min-width:200px; font-family:ui-monospace,Consolas,monospace; font-size:14px; letter-spacing:.04em; color:var(--text);">' + esc(P.showCode(S.key.ck)) + '</code>' +
      u.button({ label: 'Copy', action: 'cwr-copy' }).outerHTML + (canShare() ? u.button({ label: 'Share', action: 'cwr-share' }).outerHTML : '') + '</div>' +
    '<ol class="cwr-steps" style="' + u.P + ' margin:10px 0 10px; padding-left:20px;">' +
      '<li>Give this key to the server\'s owner. It is safe to share; your vault code stays private.</li>' +
      '<li>They add it on their server\'s Vaults page.</li>' +
      '<li>The server then appears here by itself. There is nothing else to do.</li></ol>';
  const room = S.rooms[0];
  if (room && room.state !== 'joined' && room.msg) h += '<p class="cwr-room-msg" style="font-size:12px; color:' + (room.msg === OFF_SITE_MESSAGE ? 'var(--muted)' : '#f08a5d') + '; margin:0 0 8px;">' + esc(room.msg) + '</p>';
  else h += '<p class="cwr-waiting" style="font-size:12.5px; color:var(--text); margin:0 0 8px;">Waiting for a server to add you…</p>';
  h += '<div style="display:flex; gap:8px; flex-wrap:wrap;">' + u.button({ label: 'Replace connection key', kind: 'warn', action: 'cwr-replace' }).outerHTML + '</div>';
  return h + '</div>';
}
/* Servers this vault trusts that this browser has not met yet (joined on another device): cws.js shows
   each as the one server, not online now. */
function offlineTrusted() {
  if (!S.running) return [];
  const t = trustedLocal();
  return (S.trustedVault || []).filter((r) => !t[r.server_key] && !S.conns.has(r.server_key)).map((r) => ({ key: r.server_key, name: r.name || 'Game server' }));
}
function shareKey() {
  const text = 'My CrystalWorlds connection key: ' + P.showCode(S.key.ck) + '. Add it on your game server\'s Vaults page to let my vault in.';
  try { navigator.share({ title: 'My CrystalWorlds connection key', text }).catch(() => {}); } catch (e) {}
}
function onCardClick(a, b) {
  if (a === 'cwr-copy' && S.key) copyText(P.showCode(S.key.ck), 'Connection key copied.');
  else if (a === 'cwr-share' && S.key) shareKey();
  else if (a === 'cwr-welcome') welcomeScreen();
  else if (a === 'cwr-replace') replaceKeyDialog();
  else if (a === 'cwr-forget-key' && b) forgetKey(b.getAttribute('data-key'));
  else return false;
  return true;
}

export default {
  supported: SUPPORTED,
  start, stop, fetch: rtcFetch, listings, whenOpen, info, forget, untrust, closeDb,
  cardHtml, onCardClick, offlineTrusted, directIdentity, identityReady, welcomeScreen, replaceKeyDialog, changePinDialog, renderMe,
  gate: () => _gate,   // checking | needed | ready | open (for tests)
  /* For tests: no keys, codes or PIN keys. */
  state: () => ({ running: S.running, key: !!S.key, ck: S.key ? S.key.ck : '', noKey: S.noKey, pin: !!(S.pinParams && !S.pinParams.none), pinInMemory: !!S.pinKeys,
    rooms: S.rooms.map((r) => ({ ck: r.ck, state: r.state, move: !!r.note, servers: r.servers.size, retryIn: r.retryAt ? Math.max(0, r.retryAt - now()) : 0 })),
    conns: [...S.conns.values()].map((c) => ({ key: c.serverKey.slice(0, 12), sid: c.sid, state: c.state, kind: c.kind, name: c.name, msg: c.msg })) }),
};

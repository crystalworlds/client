// The introducer protocol's shared pieces in JavaScript, using WebCrypto
// only. A copy of the game server's introducer/src/proto.js, kept byte for
// byte below this header so both sides check the same shared test vectors.
// The introducer protocol's shared pieces in JavaScript, using WebCrypto
// only (docs/INTRODUCER-PROTOCOL.md). The Worker, the tests and the site use
// this one module; its Go twin is internal/introproto. Both are checked
// against internal/introproto/testdata/vectors.json.

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();

export const L = {
  connectionKey: 'cws-connection-key-v1',
  serverKey: 'cws-server-key-v1',
  check: 'cws-check-v1',
  intro: 'cws-intro-v1',
  fingerprint: 'cws-fp-v1',
  channel: 'cws-channel-v1',
  directJoin: 'cws-direct-join-v1',
  profile: 'cws-profile-v1',
  move: 'cws-move-v1',
  keyWrap: 'cws-key-wrap-v1',
  pin: 'cws-pin-v1',
  pinKey: 'cws-pin-key-v1',
  pinStored: 'cws-pin-stored-v1',
  pinServer: 'cws-pin-server-v1',
  relayTag: 'cws-relay-tag-v1',
  relayAddr: 'cws-relay-addr-v1',
  wrapSalt: 'crystalworlds.media',
};
export const PIN_ITERATIONS = 600000;

// ---- encodings ----

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64REV = new Map([...B64].map((c, i) => [c, i]));

export function b64u(bytes) {
  bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const left = bytes.length - i;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (left > 1) out += B64[(n >> 6) & 63];
    if (left > 2) out += B64[n & 63];
  }
  return out;
}

// Strict: no padding, alphabet only, no spare bits (re-encoding must match).
export function unb64u(s, len) {
  if (typeof s !== 'string' || s.length % 4 === 1) throw new Error('bad encoding');
  const out = [];
  let acc = 0, bits = 0;
  for (const c of s) {
    const v = B64REV.get(c);
    if (v === undefined) throw new Error('bad encoding');
    acc = (acc << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 255); }
  }
  const b = new Uint8Array(out);
  if (b64u(b) !== s) throw new Error('bad encoding');
  if (len !== undefined && b.length !== len) throw new Error('bad length');
  return b;
}

const B32 = 'abcdefghijklmnopqrstuvwxyz234567';
export function base32(bytes) {
  let out = '', acc = 0, bits = 0;
  for (const b of bytes) {
    acc = (acc << 8) | b; bits += 8;
    while (bits >= 5) { bits -= 5; out += B32[(acc >> bits) & 31]; }
    acc &= (1 << bits) - 1;
  }
  if (bits > 0) out += B32[(acc << (5 - bits)) & 31];
  return out;
}

export function concat(...parts) {
  const n = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

const labelBytes = (label) => concat(enc.encode(label), new Uint8Array([0]));

export async function sha256(bytes) { return new Uint8Array(await subtle.digest('SHA-256', bytes)); }
export async function labelled(label, ...data) { return sha256(concat(labelBytes(label), ...data)); }
export const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

export function equalBytes(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

// ---- short codes ----

async function checkChars(body) { return base32(await labelled(L.check, enc.encode(body))).slice(0, 2); }

export async function shortCode(label, publicKey) {
  const body = base32(await labelled(label, publicKey)).slice(0, 26);
  return body + await checkChars(body);
}
export const connectionKey = (pk) => shortCode(L.connectionKey, pk);
export const serverKeyCode = (pk) => shortCode(L.serverKey, pk);
export const showCode = (c) => c.match(/.{4}/g).join('-');

const CODE_RE = /^[a-z2-7]{28}$/;
const VAULT_CODE_RE = /^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/;

// Protocol 3.4. Callers must not store, log or echo the input.
export const looksLikeVaultCode = (s) => typeof s === 'string' && VAULT_CODE_RE.test(s.trim());
export const VAULT_CODE_MESSAGE = 'That is a vault code. A vault code is private: never give it to anyone, including server owners. Ask for the person\'s connection key instead (on the site: Settings, Game servers).';
export const TYPO_MESSAGE = 'That connection key has a typing mistake. Check it and try again.';

export async function validCode(s) {
  return typeof s === 'string' && CODE_RE.test(s) && (await checkChars(s.slice(0, 26))) === s.slice(26);
}

// Returns {code} or {error: 'vault_code' | 'typo'}.
export async function parseCode(s) {
  if (looksLikeVaultCode(s)) return { error: 'vault_code' };
  const t = String(s).toLowerCase().replace(/[ \-.\t]/g, '');
  return (await validCode(t)) ? { code: t } : { error: 'typo' };
}

// ---- signing lines ----

export const LINE_ORDER = {
  'server-hello': [[L.intro, 'server'], ['room', 'key', 'nonce']],
  'visitor-hello': [[L.intro, 'visitor'], ['room', 'key', 'nonce']],
  offer: [[L.fingerprint, 'offer'], ['room', 'session', 'visitor_key', 'server_key', 'fp']],
  answer: [[L.fingerprint, 'answer'], ['room', 'session', 'visitor_key', 'server_key', 'fp']],
  channel: [[L.channel], ['room', 'visitor_key', 'server_key', 'challenge', 'visitor_fp', 'server_fp']],
  'direct-join': [[L.directJoin], ['room', 'visitor_key', 'server_key', 'challenge', 'profile']],
  move: [[L.move], ['old_code', 'new_code', 'old_key', 'new_key', 'issued_at']],
};

export function buildLines(kind, inputs) {
  const o = LINE_ORDER[kind];
  if (!o) throw new Error('unknown kind');
  const lines = [...o[0]];
  for (const n of o[1]) {
    const v = inputs[n];
    if (typeof v !== 'string') throw new Error('missing ' + n);
    lines.push(v);
  }
  if (lines.some((l) => l.includes('\n'))) throw new Error('newline in a line');
  return lines.join('\n');
}

// ---- keys and signatures ----

export async function importPublicKey(raw) {
  if (!(raw instanceof Uint8Array) || raw.length !== 65 || raw[0] !== 4) throw new Error('bad public key');
  return subtle.importKey('raw', raw, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
}

export async function generateKeyPair() {
  return subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
}

export async function exportPublicKey(key) { return new Uint8Array(await subtle.exportKey('raw', key)); }

export async function exportScalar(privateKey) { return unb64u((await subtle.exportKey('jwk', privateKey)).d, 32); }

export async function importPrivateKey(d, publicKey, extractable = false) {
  if (d.length !== 32 || publicKey.length !== 65 || publicKey[0] !== 4) throw new Error('bad key');
  return subtle.importKey('jwk', {
    kty: 'EC', crv: 'P-256', x: b64u(publicKey.slice(1, 33)), y: b64u(publicKey.slice(33)), d: b64u(d), ext: extractable,
  }, { name: 'ECDSA', namedCurve: 'P-256' }, extractable, ['sign']);
}

export async function sign(privateKey, text) {
  return new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, enc.encode(text)));
}

export async function verify(publicKeyRaw, text, sig) {
  if (!(sig instanceof Uint8Array) || sig.length !== 64) return false;
  let key;
  try { key = await importPublicKey(publicKeyRaw); } catch { return false; }
  return subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sig, enc.encode(text));
}

// ---- the locked vault key (4.2) ----

export function vaultCodeBytes(code) {
  if (!looksLikeVaultCode(code)) throw new Error('not a vault code');
  const h = code.trim().toLowerCase().replace(/-/g, '');
  return new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
}

export async function wrapKeyBytes(code) {
  const ikm = await subtle.importKey('raw', vaultCodeBytes(code), 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode(L.wrapSalt), info: enc.encode(L.keyWrap) }, ikm, 256));
}

async function wrapAesKey(code) {
  return subtle.importKey('raw', await wrapKeyBytes(code), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

const wrapAD = (pk) => concat(labelBytes(L.keyWrap), pk);

export async function lockKey(code, d, publicKey, iv) {
  iv = iv ?? globalThis.crypto.getRandomValues(new Uint8Array(12));
  if (d.length !== 32 || publicKey.length !== 65 || iv.length !== 12) throw new Error('bad input');
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: wrapAD(publicKey) }, await wrapAesKey(code), d));
  return concat(new Uint8Array([1]), iv, ct);
}

// Returns a non-extractable signing key, or throws.
export async function unlockKey(code, blob, publicKey, extractable = false) {
  if (blob.length !== 61 || blob[0] !== 1) throw new Error('locked key: bad form');
  const d = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: blob.slice(1, 13), additionalData: wrapAD(publicKey) }, await wrapAesKey(code), blob.slice(13)));
  const key = await importPrivateKey(d, publicKey, extractable); // refuses a d that does not match x, y
  const probe = await sign(key, 'cws-unlock-probe');
  if (!(await verify(publicKey, 'cws-unlock-probe', probe))) throw new Error('locked key: wrong pair');
  return key;
}

// ---- the PIN (5.1) ----

export const validPin = (p) => typeof p === 'string' && /^[0-9]{6,12}$/.test(p);

export async function pinStretch(pin, salt, iterations) {
  if (!validPin(pin) || salt.length !== 16 || !(iterations >= 1)) throw new Error('bad PIN input');
  const k = await subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: concat(labelBytes(L.pin), salt), iterations }, k, 256));
}

async function mac(key, label, data) {
  const k = await subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await subtle.sign('HMAC', k, concat(labelBytes(label), data)));
}

// Only the vault computes the PIN key; here for the vectors and tests.
export const pinKey = (secret, x) => mac(secret, L.pinKey, x);
export const storedCheck = (v) => labelled(L.pinStored, v);
// No server keeps a PIN check (protocol 5.1); kept for the vault's vectors.
export const serverPinProof = (c, serverPublicKey) => mac(c, L.pinServer, serverPublicKey);

// ---- the profile a browser shows a server it joins directly (8.7) ----

// b64u SHA-256("cws-profile-v1" || 0x00 || alias || 0x00 || avatar), where
// avatar is the data: URL, or "" when there is none.
export async function profileHash(alias, avatar) {
  return b64u(await labelled(L.profile, concat(enc.encode(String(alias)), new Uint8Array([0]), enc.encode(avatar ? String(avatar) : ''))));
}

// ---- relay tags (9.3) ----

const tag16 = async (s) => hex(await labelled(L.relayTag, enc.encode(s))).slice(0, 16);
export async function relayTag(ck, serverCode) { return `cws1-${await tag16(ck)}-${await tag16(serverCode)}`; }
export async function addressHash(addr) { return hex(await labelled(L.relayAddr, enc.encode(addr))); }

// ---- SDP fingerprints (6.6) ----

const FP_RE = /^sha-256 ([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
export const validFingerprint = (fp) => typeof fp === 'string' && FP_RE.test(fp);

export function sdpFingerprint(sdp) {
  const m = [...String(sdp).matchAll(/^a=fingerprint:(\S+) (\S+)\s*$/gim)];
  if (m.length !== 1 || m[0][1].toLowerCase() !== 'sha-256') return null;
  const fp = 'sha-256 ' + m[0][2].toUpperCase();
  return validFingerprint(fp) ? fp : null;
}

export function checkSdpFingerprint(sdp, fp) {
  const got = sdpFingerprint(sdp);
  return got !== null && validFingerprint(fp) && got === fp;
}

export function randomBytes(n) { return globalThis.crypto.getRandomValues(new Uint8Array(n)); }

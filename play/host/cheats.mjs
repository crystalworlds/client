/*
 * play/host/cheats.mjs -- the cheat engine's host half (2026-10-26).
 *
 * Finds this game's cheats file, keeps which cheats are on, and hands the core the codes of the
 * ones that are on (core.ext.cheats, built by play/cores/cheats-core.mjs or the Game & Watch
 * module). The rules it keeps:
 *   - ONE FILE PER GAME FILE, asked for by name, never a list: <bucket>/<key>.json. The key is the
 *     one the clips and covers use, worked out from this file's bytes (NES family 'nes-x' + 12 hex
 *     of the SHA-256; Game Boy family the SHA-1, upper case; Atari 'a2600-x' ... + 12 hex of the
 *     SHA-256 of the game file, the one file inside a .zip; Game & Watch the unit's id). A 404 is
 *     "no cheats", remembered for this page only.
 *   - Read straight from the bucket: every -cheats bucket that holds files allows reading from any
 *     site (a GET rule; checked 28 Oct 2026). The site relay is not used for cheats.
 *   - Every game starts with every cheat off; nothing is remembered between sessions.
 *   - A cheat is offered only when this console's player can run every one of its codes.
 *   - The first cheat switched on marks the session as cheated for good: the site then stops
 *     counting play time for it (host-bridge.js 'cheated'), and saves made after it carry the mark.
 */
const BUCKET = {
  atari2600: 'pub-556702343ef74360842d2f554013fd9e.r2.dev', atari5200: 'pub-127f6ccf8e0f40d4a50e7b1d27ab815f.r2.dev',
  atari7800: 'pub-5a97b048a4a94371a20ab9aa7d3ac226.r2.dev', atarilynx: 'pub-d6ab9fdba3104ad4b3b86aafaabb42b4.r2.dev',
  nes: 'pub-cc34c7dac117493187cfd98022a29295.r2.dev', famicom: 'pub-e198d62a3fe447749d25cbe7b4f9d578.r2.dev',
  fds: 'pub-be26d1a0779e4826b8de1a28ce831ca7.r2.dev', gb: 'pub-d649065aacbe4c738c9b4adc09793e9e.r2.dev',
  gbc: 'pub-9f4021d3534c417c8421307423e30ad6.r2.dev', sgb: 'pub-da7058f9bb754570a261cae1f02e8861.r2.dev',
  pm: 'pub-d505b71fa03b4756a2b40a56adc38d3c.r2.dev', gnw: 'pub-6595d58ba1f848c499afabb81ea14517.r2.dev',
};
const ATARI = { a2600: 'atari2600', a5200: 'atari5200', a7800: 'atari7800', alynx: 'atarilynx' };
const MISS = 'cw.cheats.miss.v1';
const PAGE = 50;

const hexOf = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');

/* The one game file inside a .zip (stored or deflated), as the game server and the covers count it. */
async function unzipOne(bytes) {
  const u = bytes, dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
  let eocd = -1;
  for (let i = u.length - 22; i >= Math.max(0, u.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return null;
  const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  const skip = /\.(txt|nfo|xml|htm|html|jpg|png|pdf|diz|doc|odt)$/i, found = [];
  for (let k = 0; k < n && p + 46 <= u.length; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) return null;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true),
      el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u.subarray(p + 46, p + 46 + nl));
    if (!/\/$/.test(name) && !skip.test(name)) found.push({ method, csize, lho });
    p += 46 + nl + el + cl;
  }
  if (found.length !== 1) return null;
  const f = found[0], q = f.lho;
  const data = u.subarray(q + 30 + dv.getUint16(q + 26, true) + dv.getUint16(q + 28, true)).subarray(0, f.csize);
  if (f.method === 0) return data;
  if (f.method !== 8 || typeof DecompressionStream !== 'function') return null;
  const out = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
  return new Uint8Array(out);
}

/* Where this game's cheats file may be: [{ bucket, key }], in the order to ask. */
export async function placesFor(sys, bytes, info) {
  const sha = async (alg, b) => hexOf(await crypto.subtle.digest(alg, b));
  if (sys === 'gnw') return info.deviceId ? [{ bucket: 'gnw', key: String(info.deviceId) }] : [];
  if (!bytes || !bytes.length || !(window.crypto && crypto.subtle)) return [];
  let b = bytes;
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4) { try { b = (await unzipOne(b)) || b; } catch (_) {} }
  if (sys === 'nes') {
    const key = 'nes-x' + (await sha('SHA-256', b)).slice(0, 12);
    return (info.system === 'fds' ? ['fds', 'nes', 'famicom'] : ['nes', 'famicom', 'fds']).map(bucket => ({ bucket, key }));
  }
  if (sys === 'gb') {
    const key = (await sha('SHA-1', b)).toUpperCase();
    // sgb-cheats is not asked: every file in it is also in gb-cheats or gbc-cheats (same key), and that bucket has no read rule.
    const order = info.model === 'cgb' ? ['gbc', 'gb'] : ['gb', 'gbc'];
    return order.map(bucket => ({ bucket, key }));
  }
  if (ATARI[sys]) return [{ bucket: ATARI[sys], key: sys + '-x' + (await sha('SHA-256', b)).slice(0, 12) }];
  if (sys === 'pm') return [{ bucket: 'pm', key: 'pm-x' + (await sha('SHA-256', b)).slice(0, 12) }];   // 28 Oct 2026: our own cheats
  return [];
}

function missed() { try { return JSON.parse(sessionStorage.getItem(MISS) || '{}') || {}; } catch (_) { return {}; } }
function remember(id) { try { const m = missed(); m[id] = 1; sessionStorage.setItem(MISS, JSON.stringify(m)); } catch (_) {} }

/* One file, straight from its bucket. null = no file (404 or no way to read it). */
async function fetchOne(bucket, key, log) {
  const host = BUCKET[bucket]; if (!host) return null;
  const id = bucket + '/' + key;
  if (missed()[id]) return null;
  const tries = ['https://' + host + '/' + encodeURIComponent(key) + '.json'];
  for (const url of tries) {
    let r = null;
    try { r = await fetch(url, { cache: 'no-cache', credentials: 'omit' }); } catch (_) { r = null; }   // straight: a bucket without a CORS rule refuses here
    if (!r) continue;
    if (r.status === 404) { remember(id); return null; }
    if (!r.ok) continue;
    try { const j = await r.json(); if (j && j.format === 'cw-cheats/1') return j; } catch (_) {}
    return null;
  }
  return null;
}

/* The first file found among places ([{ bucket, key }]), or null: the drawer's list (drawer-unified.js). */
export async function findCheats(places) {
  for (const pl of places || []) { const doc = await fetchOne(pl.bucket, pl.key); if (doc) return doc; }
  return null;
}

export class Cheats {
  /* env: { core, log(msg), onChange(), onCheated() } */
  constructor(env) {
    this.env = env; this.doc = null; this.list = []; this.on = new Set(); this.cheated = false; this.kinds = [];
  }
  /* Find and read this game's file. Answers true when there is at least one cheat this player can run. */
  async load(sys, bytes, info) {
    const x = this.env.core && this.env.core.ext && this.env.core.ext.cheats;
    if (!x) return false;
    try { this.kinds = await x.kinds(); } catch (_) { this.kinds = []; }
    if (!Array.isArray(this.kinds) || !this.kinds.length) return false;      // the installed build has no cheat calls: nothing shows
    let doc = null;
    for (const pl of await placesFor(sys, bytes, info || {})) { doc = await fetchOne(pl.bucket, pl.key, this.env.log); if (doc) break; }
    if (!doc || !Array.isArray(doc.providers)) return false;
    const ok = c => Array.isArray(c.codes) && c.codes.length && c.codes.every(k => this.kinds.includes(k.k));
    const provs = [];
    let left = 0;
    for (const p of doc.providers) {
      const cs = (p.cheats || []).filter(ok);
      left += (p.cheats || []).length - cs.length;
      if (cs.length) provs.push({ id: p.id, name: p.name, cheats: cs });
    }
    this.doc = doc; this.list = provs;
    this.env.log(`cheats: ${this.count()} for this game (${provs.map(p => p.name + ' ' + p.cheats.length).join(', ')})${left ? `, ${left} this player cannot run yet` : ''}`);
    await this.push();                                       // all off at the start
    return this.count() > 0;
  }
  count() { return this.list.reduce((n, p) => n + p.cheats.length, 0); }
  onCount() { return this.on.size; }
  providers() { return this.list.map(p => ({ id: p.id, name: p.name, cheats: p.cheats.map(c => ({ id: c.id, name: c.name, note: c.note || '', code: (c.codes || []).map(k => k.s).filter(Boolean).join(' + '), on: this.on.has(c.id) })) })); }
  credit() { return this.doc && Array.isArray(this.doc.credit) ? this.doc.credit.map(c => c.text).filter(Boolean).join(' ') : ''; }
  creditUrl() { const c = this.doc && Array.isArray(this.doc.credit) ? this.doc.credit.find(x => x.url) : null; return c ? c.url : null; }
  find(id) { for (const p of this.list) { const c = p.cheats.find(x => x.id === id); if (c) return c; } return null; }
  async push() {
    const codes = [];
    for (const p of this.list) for (const c of p.cheats) if (this.on.has(c.id)) codes.push(...c.codes);
    const x = this.env.core.ext.cheats;
    let r = null; try { r = await x.apply(codes); } catch (e) { r = { ok: false, why: e.message }; }
    return r || { ok: false, why: 'no answer' };
  }
  /* Switch one cheat. Answers { ok, why }. */
  async set(id, want) {
    const c = this.find(id); if (!c) return { ok: false, why: 'No such cheat.' };
    const was = this.on.has(id);
    if (!!want === was) return { ok: true };
    if (want) this.on.add(id); else this.on.delete(id);
    const r = await this.push();
    if (!r.ok) { if (want) this.on.delete(id); else this.on.add(id); await this.push(); return { ok: false, why: r.why || 'The player refused this cheat.' }; }
    if (want && !this.cheated) { this.cheated = true; try { this.env.onCheated(); } catch (_) {} }
    try { this.env.onChange(); } catch (_) {}
    return { ok: true };
  }
  async allOff() { this.on.clear(); await this.push(); try { this.env.onChange(); } catch (_) {} }
  activeIds() { return Array.from(this.on); }
  static get PAGE() { return PAGE; }
}

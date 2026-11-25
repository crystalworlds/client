/* cws-avatars.mjs  --  the 8-bit avatars (21 Nov 2026)

   Original pixel-art characters drawn for CrystalWorlds. The set is one small data file
   (images/avatars/avatars.json, built from WASM_Source/avatars): each character's pixels and its
   colours (the original and 2 to 4 colour swaps). They are drawn here, on the device, so the
   circle colour, the shadow and the head crop are decided when drawn.

   A chosen avatar is kept in the vault as a 120 x 120 PNG, exactly as an uploaded picture is.
   That PNG carries a small text note with the avatar's key (for example "knight~2"), so this
   file can tell one of ours from an uploaded picture on any device and show the head crop in
   small circles. Nothing else needs to know: a game server just shows the PNG.

   Keys: the character's id, then "~n" for its n-th colour swap ("knight" is the original). */

const V = '2.3.0-avatar';
const DATA_URL = new URL('images/avatars/avatars.json?v=' + V, import.meta.url).href;
const SIDE = 120;            // the stored picture and every drawing: 120 x 120
const NOTE = 'cwAvatar';     // the PNG text note's keyword

let _load = null, _set = null;
const _cache = new Map();

/* ---- the set ---- */
export function load() {
  if (_load) return _load;
  _load = fetch(DATA_URL).then((r) => { if (!r.ok) throw new Error('avatars ' + r.status); return r.json(); }).then((d) => {
    const list = d.list.map((e) => ({ id: e.id, about: e.a, w: e.w, h: e.h, px: unpack(e.p, e.w * e.h), colours: e.v }));
    const byId = new Map(list.map((e) => [e.id, e]));
    _set = { list, byId, shadow: d.shadow || '#BCBCBC', shadowDark: d.shadowDark || '#787878' };
    return _set;
  });
  _load.catch(() => { _load = null; });   // a failed fetch may be tried again later
  return _load;
}
export function ready() { return !!_set; }
function unpack(b64, n) {
  const bin = atob(b64), out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = (bin.charCodeAt(i >> 2) >> ((i & 3) * 2)) & 3;
  return out;
}
export function parseKey(key) {
  if (!_set || typeof key !== 'string') return null;
  const m = /^([a-z0-9-]+)(?:~(\d))?$/.exec(key);
  const e = m && _set.byId.get(m[1]);
  const n = m && m[2] ? +m[2] : 0;
  return e && n < e.colours.length ? { e, n } : null;
}
export function idOf(key) { const m = /^([a-z0-9-]+)/.exec(String(key || '')); return m ? m[1] : null; }
export function aboutOf(key) { const k = parseKey(key); return k ? k.e.about : ''; }
export const keyOf = (id, n) => (n ? id + '~' + n : id);
/* A random character in a random colour: any of the originals and their swaps. */
export function randomKey() {
  if (!_set) return null;
  const e = _set.list[Math.floor(Math.random() * _set.list.length)];
  return keyOf(e.id, Math.floor(Math.random() * e.colours.length));
}
function shuffled(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

/* ---- drawing ---- */
function lum(hex) { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; }
/* The picture on a canvas: 'full' is the whole character, 'head' its head and shoulders (for circles of
   40 px and smaller; a wide or short character, like the car, stays whole). The circle colour fills
   the square; the drop shadow is light grey, or a darker grey on a dark circle colour. */
function canvasFor(key, mode) {
  const k = parseKey(key); if (!k) return null;
  const { e, n } = k, [c1, c2, c3, bd] = e.colours[n], col = [null, c1, c2, c3];
  let x0 = 0, y0 = 0, w = e.w, h = e.h;
  if (mode === 'head' && h >= 22 && w <= h * 1.15) {
    const side = Math.max(14, Math.min(24, Math.round(h * 0.75)));   // the top three quarters: face and shoulders
    let sx = 0, cnt = 0;
    for (let y = 0; y < side; y++) for (let x = 0; x < e.w; x++) if (e.px[y * e.w + x]) { sx += x; cnt++; }
    const cx = cnt ? sx / cnt : e.w / 2;
    x0 = Math.round(cx - side / 2); w = h = side;
  }
  const scale = mode === 'head' && w === h && w !== e.w ? Math.floor(SIDE / w) : 3;
  const ox = Math.round((SIDE - w * scale) / 2) - x0 * scale, oy = Math.round((SIDE - h * scale) / 2) - y0 * scale;
  const cv = document.createElement('canvas'); cv.width = cv.height = SIDE;
  const g = cv.getContext('2d');
  g.fillStyle = bd; g.fillRect(0, 0, SIDE, SIDE);
  const off = Math.max(1, Math.round(scale / 2));
  g.fillStyle = lum(bd) < 0.35 ? _set.shadowDark : _set.shadow;
  for (let y = 0; y < e.h; y++) for (let x = 0; x < e.w; x++) if (e.px[y * e.w + x]) g.fillRect(ox + x * scale + off, oy + y * scale + off, scale, scale);
  for (let y = 0; y < e.h; y++) for (let x = 0; x < e.w; x++) { const c = e.px[y * e.w + x]; if (c) { g.fillStyle = col[c]; g.fillRect(ox + x * scale, oy + y * scale, scale, scale); } }
  return cv;
}
/* A data URL of the picture (cached). */
export function render(key, mode) {
  const ck = key + '|' + (mode || 'full');
  if (_cache.has(ck)) return _cache.get(ck);
  const cv = canvasFor(key, mode || 'full'); if (!cv) return '';
  const url = cv.toDataURL('image/png');
  _cache.set(ck, url);
  return url;
}

/* ---- the stored picture: a PNG with the key in a text note ---- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function withNote(png, text) {
  const body = new TextEncoder().encode(NOTE + '\0' + text);
  const ch = new Uint8Array(12 + body.length), dv = new DataView(ch.buffer);
  dv.setUint32(0, body.length); ch.set([116, 69, 88, 116], 4); ch.set(body, 8);   // "tEXt"
  dv.setUint32(8 + body.length, crc32(ch.subarray(4, 8 + body.length)));
  const at = 33;   // after the signature (8) and the IHDR chunk (25)
  const out = new Uint8Array(png.length + ch.length);
  out.set(png.subarray(0, at)); out.set(ch, at); out.set(png.subarray(at), at + ch.length);
  return out;
}
/* { type, bytes, url } for the vault, like an uploaded picture. */
export async function pngFor(key) {
  await load();
  const cv = canvasFor(key, 'full'); if (!cv) throw new Error('That avatar could not be drawn.');
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
  const bytes = withNote(new Uint8Array(await blob.arrayBuffer()), key);
  let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return { type: 'image/png', bytes, url: 'data:image/png;base64,' + btoa(s), key };
}
/* The key in a stored picture, or null for any other picture. Takes bytes, base64 or base64url. */
export function keyInPng(src) {
  try {
    let b = src;
    if (typeof src === 'string') {
      const s = src.replace(/^data:[^,]*,/, '').replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(s + '==='.slice((s.length + 3) % 4)); b = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    }
    if (!b || b.length < 45 || b[1] !== 80 || b[2] !== 78 || b[3] !== 71) return null;
    let p = 8;
    while (p + 12 <= b.length) {
      const len = ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0;
      const type = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
      if (type === 'tEXt') {
        const t = new TextDecoder('latin1').decode(b.subarray(p + 8, p + 8 + len)), z = t.indexOf('\0');
        if (t.slice(0, z) === NOTE && /^[a-z0-9-]+(~\d)?$/.test(t.slice(z + 1))) return t.slice(z + 1);
      }
      if (type === 'IDAT' || type === 'IEND') return null;   // the note comes before the picture data
      p += 12 + len;
    }
  } catch (e) {}
  return null;
}

/* ---- this browser remembers the chosen avatar's key per vault, so a later name roll can match it ---- */
const MEM = 'cw-avatar-key:';
export function remember(vault, key) { try { if (key) localStorage.setItem(MEM + vault, key); else localStorage.removeItem(MEM + vault); } catch (e) {} }
export function remembered(vault) { try { return localStorage.getItem(MEM + vault) || null; } catch (e) { return null; } }

/* ---- looks ---- */
export function styles() {
  if (document.getElementById('cwa-style')) return;
  const st = document.createElement('style');
  st.id = 'cwa-style';
  st.textContent = `
    .cw-av8 { image-rendering: crisp-edges; image-rendering: pixelated; }
    .cwa-pick { margin:0 0 12px; }
    .cwa-hint { color:var(--muted); font-size:11.5px; line-height:1.5; margin:0 0 8px; }
    .cwa-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(60px, 1fr)); gap:8px; max-height:46vh; overflow:auto;
      padding:4px; margin:0 -4px; overscroll-behavior:contain; }
    .cwa-tile { position:relative; display:flex; flex-direction:column; align-items:center; gap:3px; padding:3px; margin:0;
      background:none; border:2px solid transparent; border-radius:14px; cursor:pointer; color:var(--text); font:inherit; }
    .cwa-tile .cwa-img { display:block; width:100%; aspect-ratio:1; border-radius:50%; background:var(--line) center/cover no-repeat; }
    .cwa-tile[aria-pressed="true"] { border-color:var(--accent); }
    .cwa-tile:focus-visible { outline:var(--focus-width, 3px) solid var(--accent); outline-offset:1px; }
    .cwa-dots { display:flex; gap:4px; min-height:10px; }
    .cwa-dot { width:10px; height:10px; border-radius:50%; border:1px solid var(--line); box-sizing:border-box; }
    .cwa-dot.on { outline:2px solid var(--accent); outline-offset:1px; }
    .cwa-tile:not([aria-pressed="true"]) .cwa-dots { visibility:hidden; }
    .cwa-own { justify-content:center; text-align:center; font-size:11px; line-height:1.25; color:var(--muted); }
    .cwa-own .cwa-img { display:flex; align-items:center; justify-content:center; border:1px dashed var(--line); background:none; font-size:22px; }
    .cwa-dice { flex:none; width:44px; height:44px; padding:0; border-radius:10px; border:1px solid var(--line); background:rgba(255,255,255,.03);
      color:var(--text); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; align-self:flex-end; }
    .cwa-dice:hover, .cwa-dice:focus-visible { border-color:var(--accent); }
    body.gnw-tv .cwa-grid { grid-template-columns:repeat(auto-fill, minmax(76px, 1fr)); }
    body.gnw-tv .cwa-dice { width:52px; height:52px; }
    @media (max-width: 560px) { .cwa-grid { grid-template-columns:repeat(auto-fill, minmax(52px, 1fr)); gap:6px; } }
  `;
  document.head.appendChild(st);
}
export const DICE_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.3" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/></svg>';

/* ---- the picker ----
   Every character once, in a fresh random order each time it opens; "Your own picture" last.
   Pressing a character chooses it; pressing it again moves through its colours (the dots under
   it show which, and can be pressed with a mouse or a finger). Arrow keys move around the grid
   (a remote's arrows and OK work the same); Up from the top row and Down from the bottom row
   leave it through opts.exitUp / opts.exitDown.
   opts: { current: key | null, onPick(key), onOwn(), exitUp(), exitDown() } */
export async function picker(opts) {
  styles();
  const set = await load();
  const root = document.createElement('div');
  root.className = 'cwa-pick';
  root.innerHTML = '<div class="cwa-hint">Choose a character. Press it again for its other colours.</div><div class="cwa-grid" role="group" aria-label="Avatars"></div>';
  const grid = root.querySelector('.cwa-grid');
  const cur = parseKey(opts.current);
  let sel = cur ? cur.e.id : null, selN = cur ? cur.n : 0;
  const order = shuffled(set.list);
  const tiles = order.map((e) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'cwa-tile'; b.dataset.id = e.id; b.setAttribute('aria-pressed', String(e.id === sel));
    b.innerHTML = '<span class="cwa-img cw-av8"></span><span class="cwa-dots">' +
      e.colours.map((c, n) => '<span class="cwa-dot" data-n="' + n + '" style="background:' + c[1] + '"></span>').join('') + '</span>';
    return b;
  });
  const own = document.createElement('button');
  own.type = 'button'; own.className = 'cwa-tile cwa-own';
  own.innerHTML = '<span class="cwa-img" aria-hidden="true">+</span><span>Your own picture</span>';
  tiles.forEach((b) => grid.appendChild(b)); grid.appendChild(own);
  const label = (b) => {
    const e = set.byId.get(b.dataset.id), on = b.dataset.id === sel;
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', e.about + (on && e.colours.length > 1 ? ' Colour ' + (selN + 1) + ' of ' + e.colours.length + '; press again for another.' : ''));
    b.title = e.about;
    b.querySelectorAll('.cwa-dot').forEach((d) => d.classList.toggle('on', on && +d.dataset.n === selN));
    b.querySelector('.cwa-img').style.backgroundImage = 'url("' + render(keyOf(e.id, on ? selN : 0)) + '")';
  };
  /* Drawn a few at a time, so the box opens at once. */
  { const t0 = sel && tiles.find((t) => t.dataset.id === sel); if (t0) label(t0); }
  let next = 0;
  (function more() { const end = Math.min(tiles.length, next + 24); for (; next < end; next++) label(tiles[next]); if (next < tiles.length) requestAnimationFrame(more); })();
  function choose(b, n) {
    const prev = sel && tiles.find((t) => t.dataset.id === sel);
    const e = set.byId.get(b.dataset.id);
    if (n === undefined) n = b.dataset.id === sel ? (selN + 1) % e.colours.length : 0;
    sel = b.dataset.id; selN = n;
    if (prev && prev !== b) label(prev);
    label(b);
    try { opts.onPick && opts.onPick(keyOf(sel, selN)); } catch (x) {}
  }
  grid.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('.cwa-tile'); if (!b) return;
    if (b === own) { try { opts.onOwn && opts.onOwn(); } catch (x) {} return; }
    const d = ev.target.closest('.cwa-dot');
    choose(b, d ? +d.dataset.n : undefined);
  });
  grid.addEventListener('keydown', (ev) => {
    if (ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
    const all = [...grid.children], i = all.indexOf(document.activeElement);
    if (i < 0) return;
    const top0 = all[0].offsetTop; let cols = 0; while (cols < all.length && all[cols].offsetTop === top0) cols++;
    cols = Math.max(1, cols);
    let j = null;
    if (ev.key === 'ArrowRight') j = Math.min(all.length - 1, i + 1);
    else if (ev.key === 'ArrowLeft') j = Math.max(0, i - 1);
    else if (ev.key === 'ArrowDown') { if (i + cols < all.length) j = i + cols; else if (Math.floor(i / cols) < Math.floor((all.length - 1) / cols)) j = all.length - 1; else if (opts.exitDown) { ev.preventDefault(); ev.stopPropagation(); opts.exitDown(); return; } else return; }
    else if (ev.key === 'ArrowUp') { if (i - cols >= 0) j = i - cols; else if (opts.exitUp) { ev.preventDefault(); ev.stopPropagation(); opts.exitUp(); return; } else return; }
    else return;
    ev.preventDefault(); ev.stopPropagation();
    if (j !== null && all[j]) { all[j].focus({ preventScroll: true }); try { all[j].scrollIntoView({ block: 'nearest' }); } catch (x) {} }
  });
  return {
    el: root,
    focus() { const b = (sel && tiles.find((t) => t.dataset.id === sel)) || tiles[0]; try { b.focus({ preventScroll: true }); b.scrollIntoView({ block: 'nearest' }); } catch (x) {} },
    set(key) { const k = parseKey(key); const prev = sel && tiles.find((t) => t.dataset.id === sel); sel = k ? k.e.id : null; selN = k ? k.n : 0; if (prev) label(prev); const b = sel && tiles.find((t) => t.dataset.id === sel); if (b) label(b); },
  };
}

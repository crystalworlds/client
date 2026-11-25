/*
 * case3d-gl.mjs -- the drawing half of the 3D case beside a drawer (21 Nov 2026).
 *
 * Loaded by case3d.js only when a case is about to show on a wide window with WebGL, never on a
 * phone. three.js is the copy the R.O.B. page already uses (play/rob/vendor/three, r169), read
 * from there, not copied. The case shapes are the templates in firmware/boxes (manifest.json):
 * front faces +Z, the spine is on -X, origin at the centre, metres.
 *
 * WHAT IT DRAWS. One box: the cover on the front, the spine picture (or a drawn title) on the
 * spine, the cover's edge colour on a card box's other faces, the plastic of a case as modelled.
 * Every face is drawn with the picture's own colours and a soft light from the front, so the
 * front at its resting turn is exactly the flat cover.
 *
 * THE SHINE IS TODAY'S STREAK. The stage's .stage-sheen and the films' .vstage-sheen: a
 * linear-gradient(105deg) from clear at 40% to 10% white at 47%, 30% white at 50%, 10% at 53% and
 * clear at 60%, 250% as wide as the picture, placed at calc(50% + sheen), blended by screen (for a
 * white layer that is c + a(1 - c), in the page's own sRGB values). Here the same sum is done per
 * pixel on the case's faces, in the front cover's own box (the spine unfolded to its left, so the
 * streak runs on round the fold), after the colour is turned into sRGB: so at any turn the front
 * carries exactly the streak the flat picture carried. sheen rests at 10% and moves 34% per unit
 * of turn, set by case3d.js.
 *
 * ONE CANVAS FOR THE PAGE, moved between the game and film slide-ins; it draws only when asked
 * (case3d.js asks while something moves). The last 4 cases' pictures are kept; older ones freed.
 */
import * as THREE from './play/rob/vendor/three/three.module.js';
import { GLTFLoader } from './play/rob/vendor/three/jsm/loaders/GLTFLoader.js';

const V = '2.3.0-boxsite4';
const KEEP = 4;                 // cases whose pictures stay in graphics memory
const TEX_MAX = 1024;           // pictures at most this tall
const PERSP = 1400;             // the stage's CSS perspective, in CSS px

let renderer = null, canvas = null, scene = null, camera = null, lost = false;
const tplCache = new Map();     // template id -> Promise<gltf scene>
const kept = [];                // cases, oldest first

function setup() {
  if (renderer || lost) return !!renderer;
  canvas = document.createElement('canvas');
  canvas.className = 'case-gl';
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: true });
  } catch (e) { renderer = null; lost = true; return false; }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, 50, 6000);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; try { window.dispatchEvent(new CustomEvent('cw-case-lost')); } catch (_) {} }, false);
  return true;
}
export function ok() { return setup() && !lost; }
export function isLost() { return lost; }
export function canvasEl() { setup(); return canvas; }

/* ------------------------------------------------------------ the shine and the light */
const SHADER_COMMON = `
varying vec3 cwObj;
varying vec3 cwNv;
uniform float cwSheen;      // the streak's place: 0.10 at rest (CSS --sheen 10%)
uniform vec4 cwBox;         // front art: left x, top y, front z, 0 (metres)
uniform vec2 cwWH;          // front art width and height (metres)
uniform float cwShine;      // 1 on faces that carry the streak
float cwSheenA(vec2 p) {
  float W = cwWH.x, H = cwWH.y, Wg = 2.5 * W;
  float bx = p.x + 1.5 * W * (0.5 + cwSheen);          // background-position: calc(50% + sheen)
  if (bx < 0.0 || bx > Wg) return 0.0;                 // background-repeat: no-repeat
  float L = Wg * 0.9659258 + H * 0.2588190;            // the 105deg gradient line
  float t = 0.5 + ((bx - 0.5 * Wg) * 0.9659258 + (p.y - 0.5 * H) * 0.2588190) / L;
  if (t <= 0.40 || t >= 0.60) return 0.0;
  if (t < 0.47) return 0.10 * (t - 0.40) / 0.07;
  if (t < 0.50) return 0.10 + 0.20 * (t - 0.47) / 0.03;
  if (t < 0.53) return 0.30 - 0.20 * (t - 0.50) / 0.03;
  return 0.10 * (0.60 - t) / 0.07;
}
float cwShade() {
  vec3 L = normalize(vec3(-0.2, 0.25, 1.0));
  return clamp(0.35 + 0.8 * dot(normalize(cwNv), L), 0.0, 1.0);
}
`;
function decorate(mat, U, shine) {
  mat.userData.cwMapB = { value: null }; mat.userData.cwMix = { value: 0 };
  mat.onBeforeCompile = sh => {
    sh.uniforms.cwSheen = U.sheen; sh.uniforms.cwBox = U.box; sh.uniforms.cwWH = U.wh;
    sh.uniforms.cwShine = { value: shine ? 1 : 0 };
    sh.uniforms.cwMapB = mat.userData.cwMapB; sh.uniforms.cwMix = mat.userData.cwMix;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 cwObj;\nvarying vec3 cwNv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ncwObj = position;\ncwNv = normalize(normalMatrix * normal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + SHADER_COMMON + '#ifdef USE_MAP\nuniform sampler2D cwMapB;\nuniform float cwMix;\n#endif\n')
      .replace('#include <map_fragment>', '#include <map_fragment>\n#ifdef USE_MAP\n  if (cwMix > 0.0) diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(cwMapB, vMapUv).rgb, cwMix);\n#endif')
      .replace('#include <opaque_fragment>', 'outgoingLight *= cwShade();\n#include <opaque_fragment>')
      .replace('#include <colorspace_fragment>', `#include <colorspace_fragment>
  if (cwShine > 0.5) {
    vec2 p = vec2((cwObj.x - cwBox.x) - max(0.0, cwBox.z - cwObj.z), cwBox.y - cwObj.y);   // the spine unfolded to the front's left
    float a = cwSheenA(p);
    gl_FragColor.rgb += a * (1.0 - gl_FragColor.rgb);                                          // screen, white at a
  }`);
  };
  mat.customProgramCacheKey = () => 'cwcase' + (shine ? 1 : 0);
}

/* ------------------------------------------------------------ pictures */
function loadImage(url) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.decoding = 'async';
    im.onload = () => { if (!im.naturalWidth) { rej(new Error('empty')); return; } Promise.resolve(im.decode ? im.decode() : null).catch(() => {}).then(() => res(im)); };   // decoded off the main thread before it is drawn
    im.onerror = () => rej(new Error('load'));
    im.src = url;
  });
}
const _missed = new Set();      // addresses that answered 404 this page load (no list: a miss is remembered, never asked again)
async function bitmapOf(url) {
  if (typeof createImageBitmap === 'function' && typeof fetch === 'function') {
    let r;
    try { r = await fetch(url, { mode: 'cors', credentials: 'omit' }); } catch (_) { r = null; }
    if (r && r.status === 404) throw new Error('404');
    if (r && r.ok) { try { return await createImageBitmap(await r.blob()); } catch (_) {} }
  }
  return loadImage(url);
}
async function firstImage(urls) {
  for (const u of urls || []) {
    if (_missed.has(u)) continue;
    try { return { im: await bitmapOf(u), url: u }; } catch (e) { if (String(e && e.message) === '404') _missed.add(u); }
  }
  return null;
}
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
function tex(c, maxAniso) {
  const t = new THREE.CanvasTexture(c);
  t.flipY = false;                      // the glTF way (the templates' UVs)
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  t.needsUpdate = true;
  return t;
}
/* Colours of a picture drawn small: the design's spine rule 1 (48 px tall). */
const natW = im => im.naturalWidth || im.width, natH = im => im.naturalHeight || im.height;
function smallPixels(im, h) {
  const H = h || 48, W = Math.max(1, Math.round(H * natW(im) / natH(im)));
  const c = makeCanvas(W, H), x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(im, 0, 0, W, H);
  return { W, H, d: x.getImageData(0, 0, W, H).data };
}
const lum = (r, g, b) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contrast = (a, b) => { const x = lum(...a), y = lum(...b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const median = arr => { const s = arr.slice().sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0; };
/* The main colours of a picture: 4-bit-per-channel buckets, largest first. */
function palette(px) {
  const m = new Map(), n = px.W * px.H;
  for (let i = 0; i < n; i++) {
    const r = px.d[i * 4], g = px.d[i * 4 + 1], b = px.d[i * 4 + 2];
    const k = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4);
    const e = m.get(k); if (e) { e.n++; e.r += r; e.g += g; e.b += b; } else m.set(k, { n: 1, r, g, b });
  }
  return [...m.values()].sort((a, b) => b.n - a.n).map(e => ({ c: [e.r / e.n, e.g / e.n, e.b / e.n].map(Math.round), share: e.n / n }));
}
/* Design 4.5 rule 2: the middle colour of the front's left-most 6% (the edge the spine meets); a very
   busy edge takes the front's most common colour instead, skipping near-white and near-black when they
   cover little of it. */
function edgeColour(px) {
  const cols = Math.max(1, Math.round(px.W * 0.06)), rs = [], gs = [], bs = [], keys = new Set();
  for (let y = 0; y < px.H; y++) for (let x = 0; x < cols; x++) {
    const i = (y * px.W + x) * 4; rs.push(px.d[i]); gs.push(px.d[i + 1]); bs.push(px.d[i + 2]);
    keys.add((px.d[i] >> 5) << 6 | (px.d[i + 1] >> 5) << 3 | (px.d[i + 2] >> 5));
  }
  const busy = keys.size > Math.max(12, rs.length * 0.35);
  if (!busy) return [median(rs), median(gs), median(bs)];
  const pal = palette(px);
  const extreme = c => (c[0] + c[1] + c[2]) / 3 > 235 || (c[0] + c[1] + c[2]) / 3 < 20;
  const pick = pal.find(p => !extreme(p.c) || p.share > 0.25) || pal[0];
  return pick ? pick.c : [median(rs), median(gs), median(bs)];
}
const darker = (c, f) => c.map(v => Math.round(v * (1 - f)));
const css = c => 'rgb(' + c.map(v => Math.max(0, Math.min(255, Math.round(v)))).join(',') + ')';

/* Design 4.5: the spine drawn from the front's colours and the title, top to bottom, at twice screen
   size (1024 tall at most), kept for the page load only. */
let _font = null;
function generatedSpine(px, title, aspect, H) {
  const W = Math.max(8, Math.round(H * aspect));
  const bg = edgeColour(px);
  const pal = palette(px).map(p => p.c);
  let fg = pal.find(c => contrast(c, bg) >= 4.5);
  if (!fg) fg = contrast([255, 255, 255], bg) >= contrast([17, 17, 17], bg) ? [255, 255, 255] : [17, 17, 17];
  const c = makeCanvas(W, H), x = c.getContext('2d');
  x.fillStyle = css(bg); x.fillRect(0, 0, W, H);
  const band = Math.max(2, Math.round(H * 0.035));
  x.fillStyle = css(darker(bg, 0.12)); x.fillRect(0, 0, W, band); x.fillRect(0, H - band, W, band);
  // The title reads top to bottom: turned a quarter clockwise, so its baseline runs down the spine.
  const font = _font || (_font = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif');
  const len = H - 2 * band - Math.round(W * 0.6), room = W * 0.84;
  /* a line's width grows with the font size, so one measurement at 100 px gives the largest size that fits */
  const w100 = l => { x.font = `800 100px ${font}`; return x.measureText(l).width / 100; };
  const sizeFor = (lines, cap) => Math.floor(Math.min(cap, ...lines.map(l => len / Math.max(1e-6, w100(l)))));
  const fit = (lines, size) => { x.font = `800 ${size}px ${font}`; return lines.every(l => x.measureText(l).width <= len); };
  let text = String(title || '').trim() || ' ', lines = [text], size = sizeFor(lines, Math.floor(room * 0.9));
  const floor = Math.max(9, Math.round(W * 0.28));
  if (size < floor) {                                       // two lines, then three dots
    const words = text.split(/\s+/); let best = null;
    for (let i = 1; i < words.length; i++) { const a = words.slice(0, i).join(' '), b = words.slice(i).join(' '); const w = Math.max(w100(a), w100(b)); if (!best || w < best.w) best = { l: [a, b], w }; }
    size = Math.floor(room * 0.9 / 2.1);
    if (best) { lines = best.l; size = Math.max(Math.round(Math.max(8, floor * 0.6)), sizeFor(lines, size)); }
    if (!fit(lines, size)) {
      x.font = `800 ${size}px ${font}`;
      lines = lines.map(l => { if (x.measureText(l).width <= len) return l; let s = l; while (s.length > 1 && x.measureText(s + '…').width > len) s = s.slice(0, -1); return s.trimEnd() + '…'; });
    }
  }
  x.save();
  x.translate(W / 2, H / 2); x.rotate(Math.PI / 2);
  x.fillStyle = css(fg); x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `800 ${size}px ${font}`;
  const lh = size * 1.12, y0 = -(lines.length - 1) * lh / 2;
  lines.forEach((l, i) => x.fillText(l, 0, y0 + i * lh));
  x.restore();
  return { canvas: c, bg, fg, size, lines };
}
/* A spine picture fitted to the face: within 3% of its shape it fills it; otherwise fit and centred,
   never stretched, the sides filled with the picture's own edge colour (measurement note). */
function fittedSpine(im, aspect, H, fill) {
  const W = Math.max(8, Math.round(H * aspect));
  const c = makeCanvas(W, H), x = c.getContext('2d');
  const ia = natW(im) / natH(im);
  if (Math.abs(ia / aspect - 1) <= 0.03) { x.drawImage(im, 0, 0, W, H); return c; }
  let edge = fill;
  if (!edge) {
    const px = smallPixels(im, 64), cs = [];
    for (let y = 0; y < px.H; y++) for (const xx of [0, px.W - 1]) { const i = (y * px.W + xx) * 4; cs.push([px.d[i], px.d[i + 1], px.d[i + 2]]); }
    edge = [0, 1, 2].map(k => median(cs.map(p => p[k])));
    edge = css(edge);
  }
  x.fillStyle = edge; x.fillRect(0, 0, W, H);
  const s = Math.min(H / natH(im), W / natW(im)), dw = natW(im) * s, dh = natH(im) * s;
  x.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);
  return c;
}
/* The front: the cover fills the face (the covers were resized to one frame per system, so filling
   the real shape puts them back); a film poster is fitted to the width and trimmed equally top and
   bottom (design question 7). The type word of a generic box is drawn in, as the tile draws it. */
function frontCanvas(im, aspect, mode, generic) {
  const H = Math.min(TEX_MAX, Math.max(256, natH(im))), W = Math.round(H * aspect);
  const c = makeCanvas(W, H), x = c.getContext('2d');
  if (mode === 'trim') {
    const s = W / natW(im), dh = natH(im) * s;
    if (dh >= H) x.drawImage(im, 0, (H - dh) / 2, W, dh);
    else { const s2 = H / natH(im), dw = natW(im) * s2; x.drawImage(im, (W - dw) / 2, 0, dw, H); }
  } else x.drawImage(im, 0, 0, W, H);
  if (generic && typeof window.cwGenericLabel === 'function') {
    try { drawGenericWord(x, W, H, generic); } catch (_) {}
  }
  return c;
}
function drawGenericWord(x, W, H, g) {
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-${W + 50}px;top:0;width:${W}px;height:${H}px;visibility:hidden;pointer-events:none;contain:strict`;
  document.body.appendChild(host);
  try {
    window.cwGenericLabel(host, g.shelf, g.id, 0);
    const el = host.querySelector('.gb-art-generic-label');
    if (!el) return;
    const cs = getComputedStyle(el), hr = host.getBoundingClientRect(), r = el.getBoundingClientRect();
    const inner = el.firstElementChild, scale = inner ? (/scale\(([\d.]+)\)/.exec(inner.style.transform || '') || [0, 1])[1] * 1 : 1;
    const fs = parseFloat(cs.fontSize) * scale, word = (el.textContent || '').toUpperCase();
    x.save();
    x.font = `${cs.fontWeight || 800} ${fs}px ${cs.fontFamily}`;
    try { x.letterSpacing = (fs * 0.04).toFixed(2) + 'px'; } catch (_) {}
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const cx = r.left - hr.left + r.width / 2, cy = r.top - hr.top + r.height / 2;
    x.lineJoin = 'round'; x.strokeStyle = '#000'; x.lineWidth = Math.max(2, fs * 0.12);
    x.shadowColor = 'rgba(0,0,0,.85)'; x.shadowBlur = fs * 0.2; x.shadowOffsetY = fs * 0.05;
    x.strokeText(word, cx, cy);
    x.shadowColor = 'transparent';
    x.fillStyle = cs.color || '#fff';
    x.fillText(word, cx, cy);
    x.restore();
  } finally { host.remove(); }
}

/* ------------------------------------------------------------ templates */
function template(id, file) {
  if (tplCache.has(id)) return tplCache.get(id);
  const p = new GLTFLoader().loadAsync(new URL('firmware/boxes/' + file + '?v=' + V, document.baseURI).href).then(g => { tplDone.set(id, g.scene); return g.scene; });
  p.catch(() => tplCache.delete(id));
  tplCache.set(id, p);
  return p;
}

/* ------------------------------------------------------------ a case */
/* spec: { template, info (manifest row), front: [urls], frontMode: 'fill' | 'trim', generic, spines: [urls],
   spineFill (a colour for the clear sides, the Disk System), title, key } */
const tplDone = new Map();      // template id -> parsed scene, once loaded
function templateNow(id) { return tplDone.get(id) || null; }
/* THE ART, prepared ahead (22 Nov 2026: the box slides in as 3D on every open). The pictures fetched and decoded on
   intent (a tile hovered, focused or clicked), kept for the last ART_KEEP games, oldest dropped; the case's faces are
   drawn from them in a few milliseconds when the drawer opens. */
const ART_KEEP = 6;
const art = new Map();          // key -> Promise<{ front, spine, frontUrl, spineUrl } | null>
const artDone = new Map();      // key -> the same, once it has arrived
export function prefetchArt(spec) {
  const key = spec && (spec.artKey || spec.key);
  if (!key) return Promise.resolve(null);
  if (art.has(key)) { const p = art.get(key); art.delete(key); art.set(key, p); return p; }
  const p = (async () => {
    const [front, sp] = await Promise.all([firstImage(spec.front), spec.spines && spec.spines.length ? firstImage(spec.spines) : null]);
    return front ? { front: front.im, frontUrl: front.url, spine: sp ? sp.im : null, spineUrl: sp ? sp.url : null } : null;
  })().catch(() => null);
  p.then(A => { if (A && art.get(key) === p) artDone.set(key, A); });
  art.set(key, p);
  while (art.size > ART_KEEP) { const k = art.keys().next().value; const old = art.get(k); art.delete(k); artDone.delete(k); old.then(a => { if (a) { try { a.front.close && a.front.close(); a.spine && a.spine.close && a.spine.close(); } catch (_) {} } }); }
  return p;
}
/* The faces drawn from the art (or printed when there is none yet): front, spine and the edge colour. */
function faces(spec, info, A) {
  const fa = info.front_art_mm[0] / info.front_art_mm[1], sa = info.spine_art_mm[0] / info.spine_art_mm[1];
  if (!A) {
    /* the printed face: the box's own card in a quiet grey, the title on it, until the cover arrives */
    const H = 256, W = Math.max(8, Math.round(H * fa));
    const fc = makeCanvas(W, H), x = fc.getContext('2d');
    x.fillStyle = '#3a3f47'; x.fillRect(0, 0, W, H);
    const px = smallPixels(fc, 48);
    const sp = generatedSpine(px, spec.title, sa, 256);
    return { fc, spineC: sp.canvas, edge: [58, 63, 71], spineFrom: 'printed-face', placeholder: true };
  }
  const fc = frontCanvas(A.front, fa, spec.frontMode || 'fill', spec.generic);
  const px = smallPixels(fc, 48);
  const edge = edgeColour(px);
  const SH = Math.min(TEX_MAX, Math.max(512, Math.round(fc.height)));
  const spineC = A.spine ? fittedSpine(A.spine, sa, SH, spec.spineFill || null) : generatedSpine(px, spec.title, sa, SH).canvas;
  return { fc, spineC, edge, spineFrom: A.spine ? A.spineUrl : 'drawn', frontUrl: A.frontUrl };
}
/* quick(spec, A): the case at once, synchronously (its template already parsed): with its art when A is given, else
   the printed face. null when the template is not parsed yet. */
export function quick(spec, A) {
  if (!setup()) return null;
  const old = kept.find(k => k.key === spec.key);
  if (old && (!old.placeholder || !A)) { kept.splice(kept.indexOf(old), 1); kept.push(old); return old; }
  if (old) free(old), kept.splice(kept.indexOf(old), 1);
  const src = templateNow(spec.template);
  if (!src) return null;
  const T = spec.timings || null, now = () => performance.now(); let a = now();
  const mark = k => { if (T) { const b = now(); T[k] = (T[k] || 0) + (b - a); a = b; } };
  const info = spec.info;
  const root = src.clone(true);
  const U = { sheen: { value: 0.10 }, box: { value: new THREE.Vector4() }, wh: { value: new THREE.Vector2(1, 1) } };
  const parts = {};
  root.traverse(o => { if (o.isMesh) parts[o.name] = o; });
  if (!parts.front || !parts.spine) return null;
  parts.front.geometry.computeBoundingBox();
  const fb = parts.front.geometry.boundingBox;
  U.box.value.set(fb.min.x, fb.max.y, fb.max.z, 0);
  U.wh.value.set(fb.max.x - fb.min.x, fb.max.y - fb.min.y);
  mark('clone_template');
  const F = faces(spec, info, A);
  mark(A ? 'faces_from_art' : 'printed_face');
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const tFront = tex(F.fc, aniso), tSpine = tex(F.spineC, aniso);
  const card = info.kind === 'card';
  const edgeCol = new THREE.Color().setStyle(css(darker(F.edge, 0.12)), THREE.SRGBColorSpace);
  const mats = {};
  for (const [name, mesh] of Object.entries(parts)) {
    const om = mesh.material;
    const m = new THREE.MeshBasicMaterial({ transparent: om.transparent, opacity: om.opacity, side: om.side, depthWrite: om.depthWrite });
    decorate(m, U, name !== 'inner' && name !== 'back');
    if (name === 'front') { m.map = tFront; m.userData.cwMapB.value = tFront; m.color.set(0xffffff); }
    else if (name === 'spine') { m.map = tSpine; m.userData.cwMapB.value = tSpine; m.color.set(0xffffff); }
    else if (card && (name === 'edge' || name === 'back')) m.color.copy(edgeCol);
    else m.color.copy(om.color || new THREE.Color(0x808080));
    mesh.material = m; mats[name] = m;
  }
  try { renderer.initTexture(tFront); renderer.initTexture(tSpine); } catch (_) {}
  mark('texture_upload');
  const pivot = new THREE.Group();
  pivot.add(root);
  const res = { key: spec.key, template: spec.template, info, pivot, root, U, mats, tex: [tFront, tSpine], spineFrom: F.spineFrom, edge: css(F.edge),
    placeholder: !!F.placeholder, card, depth: info.size_mm[2], frontW: fb.max.x - fb.min.x, frontH: fb.max.y - fb.min.y, fade: null };
  root.updateMatrixWorld(true);
  res.bbox = new THREE.Box3().setFromObject(root);
  kept.push(res);
  while (kept.length > KEEP) { const o = kept.shift(); if (o === _shown) { kept.unshift(o); if (kept.length > KEEP + 1) free(kept.splice(1, 1)[0]); break; } free(o); }
  return res;
}
/* fill(res, spec): the real cover and spine onto a case that shows its printed face, cross-faded over FADE_MS on the
   case's own faces (and the card's edges from grey to the cover's edge colour). Resolves true when the art is on. */
const FADE_MS = 280;
export async function fill(res, spec) {
  if (!res || !res.placeholder) return true;
  const A = await prefetchArt(spec);
  if (!A || res.freed) return false;
  const t0 = performance.now();
  const F = faces(spec, res.info, A);
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const tF = tex(F.fc, aniso), tS = tex(F.spineC, aniso);
  try { renderer.initTexture(tF); renderer.initTexture(tS); } catch (_) {}
  res.mats.front.userData.cwMapB.value = tF; res.mats.spine.userData.cwMapB.value = tS;
  const edgeTo = new THREE.Color().setStyle(css(darker(F.edge, 0.12)), THREE.SRGBColorSpace);
  res.fade = { t0: performance.now(), tF, tS, edgeFrom: res.mats.edge ? res.mats.edge.color.clone() : null, edgeTo };
  res.placeholder = false; res.spineFrom = F.spineFrom; res.edge = css(F.edge); res.frontUrl = F.frontUrl;
  res.fillMs = performance.now() - t0;   // the main-thread part: faces drawn and sent to the graphics card
  return true;
}
function fadeStep(res) {
  const f = res.fade; if (!f) return false;
  const k = Math.min(1, (performance.now() - f.t0) / FADE_MS), e = k * k * (3 - 2 * k);
  res.mats.front.userData.cwMix.value = e; res.mats.spine.userData.cwMix.value = e;
  if (res.card && f.edgeFrom) for (const n of ['edge', 'back']) if (res.mats[n]) res.mats[n].color.copy(f.edgeFrom).lerp(f.edgeTo, e);
  if (k < 1) return true;
  const oldF = res.mats.front.map, oldS = res.mats.spine.map;
  res.mats.front.map = f.tF; res.mats.spine.map = f.tS;
  res.mats.front.userData.cwMix.value = 0; res.mats.spine.userData.cwMix.value = 0;
  res.tex = [f.tF, f.tS]; res.fade = null;
  try { oldF.dispose(); oldS.dispose(); } catch (_) {}
  return false;
}
export function fading(res) { return !!(res && res.fade); }
/* The old one-call form: wait for the template and the art, then the case with its art. */
export async function prepare(spec) {
  if (!setup()) throw new Error('no WebGL');
  await template(spec.template, spec.info.file);
  const A = await prefetchArt(spec);
  if (!A) throw new Error('no front picture');
  const res = quick(spec, A);
  if (!res) throw new Error('template not loaded');
  return res;
}
/* THE WARM-UP (once per page, at idle, desktop with WebGL): three.js, the one canvas, every template parsed, and every
   shader the cases use compiled with a dummy box, drawn once to a 1 x 1 canvas so nothing shows. Step by step, so
   the caller can run each in its own idle moment. */
let _warm = null;
export function warmSteps(man) {
  const W = {};
  return [
    () => { setup(); },
    /* one template per step: each is a few milliseconds to parse */
    ...Object.entries(man.templates).map(([id, x]) => () => template(id, x.file).catch(() => null)),
    () => {
      /* the shaders: an opaque card box and the see-through cases (Blu-ray: blended plastic and the inner block) */
      const ids = ['nes', 'film-bluray', 'fds'].filter(id => templateNow(id));
      W.dummies = ids.map(id => quick({ template: id, info: man.templates[id], title: ' ', key: '__warm__' + id }, null)).filter(Boolean);
      W.g = new THREE.Group(); W.dummies.forEach(r => W.g.add(r.pivot));
      scene.add(W.g);
    },
    async () => { try { if (renderer.compileAsync) await renderer.compileAsync(W.g, camera, scene); else renderer.compile(scene, camera); } catch (_) {} },
    () => {
      const w = renderer.domElement.width, h = renderer.domElement.height;
      renderer.setSize(1, 1, false); camera.aspect = 1; camera.updateProjectionMatrix();
      try { renderer.render(scene, camera); } catch (_) {}
      scene.remove(W.g);
      W.dummies.forEach(r => { const i = kept.indexOf(r); if (i >= 0) kept.splice(i, 1); free(r); });
      if (w > 1) renderer.setSize(w / renderer.getPixelRatio(), h / renderer.getPixelRatio(), false);
      _warm = true;
    },
  ];
}
export function isWarm() { return !!_warm; }
function free(res) {
  if (!res || res.freed) return;
  if (res.pivot.parent) res.pivot.parent.remove(res.pivot);
  res.tex.forEach(t => { try { t.dispose(); } catch (_) {} });
  if (res.fade) { try { res.fade.tF.dispose(); res.fade.tS.dispose(); } catch (_) {} }
  Object.values(res.mats).forEach(m => { try { m.dispose(); } catch (_) {} });
  res.root.traverse(o => { if (o.isMesh && o.geometry) { try { o.geometry.dispose(); } catch (_) {} } });
  res.freed = true;
}
export function keptCount() { return kept.length; }
/* For the measuring page. */
export function loadTemplate(id, file) { setup(); return template(id, file); }
export async function prepareTimed(spec) {
  const timings = {}, now = () => performance.now(); let a = now();
  await template(spec.template, spec.info.file); timings.wait_template = now() - a; a = now();
  const A = await prefetchArt(spec); timings.wait_art_fetch_and_decode = now() - a;
  const res = quick(Object.assign({}, spec, { timings }), A);
  a = now(); try { if (renderer.compileAsync) await renderer.compileAsync(res.pivot, camera, scene); } catch (_) {} timings.shader_compile = now() - a;
  return { res, t: timings };
}
export function firstDrawTimed(res) {
  show(res, { cssW: 600, cssH: 700, frontPx: 400 });
  draw(res, 20, 0, 0.1);
  const gl = renderer.getContext(), px = new Uint8Array(4), a = performance.now();
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);   // waits for the GPU to finish the frame
  return performance.now() - a;
}
export function has(key) { return kept.some(k => k.key === key && !k.placeholder); }
export function artNow(key) { return artDone.get(key) || null; }
export function info() {
  const i = renderer ? renderer.info : null;
  return { warm: !!_warm, art: art.size, kept: kept.map(k => k.key), textures: i ? i.memory.textures : 0, geometries: i ? i.memory.geometries : 0, calls: i ? i.render.calls : 0, frames: i ? i.render.frame : 0, lost };
}

/* ------------------------------------------------------------ drawing */
let _shown = null, _layout = null;
/* layout: { cssW, cssH } of the canvas, { frontPx } the front's width in CSS px. */
export function show(res, layout) {
  setup();
  if (_shown && _shown !== res && _shown.pivot.parent) scene.remove(_shown.pivot);
  _shown = res; _layout = layout;
  if (res.pivot.parent !== scene) scene.add(res.pivot);
  const pr = Math.min(2, window.devicePixelRatio || 1);
  if (renderer.getPixelRatio() !== pr) renderer.setPixelRatio(pr);
  renderer.setSize(layout.cssW, layout.cssH, false);
  canvas.style.width = layout.cssW + 'px'; canvas.style.height = layout.cssH + 'px';
  camera.aspect = layout.cssW / layout.cssH;
  camera.fov = 2 * Math.atan(layout.cssH / 2 / PERSP) * 180 / Math.PI;
  camera.position.set(0, 0, PERSP);
  camera.near = 50; camera.far = PERSP * 4;
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  const s = layout.frontPx / res.frontW;         // CSS px per metre
  res.root.scale.setScalar(s);
  res.root.position.set(0, 0, 0);
  res.pivot.position.set(0, 0, -(res.depth / 1000) * s / 2);   // the front face in the card's plane at rest turn 0
  res.scale = s;
}
/* ry, rx in CSS degrees (rotateY(ry) rotateX(rx), X applied first); sheen as a fraction (0.10 = 10%). */
export function draw(res, ry, rx, sheen) {
  if (!renderer || lost || res !== _shown) return false;
  res.pivot.rotation.set(-rx * Math.PI / 180, ry * Math.PI / 180, 0, 'YXZ');
  res.U.sheen.value = sheen;
  fadeStep(res);
  renderer.render(scene, camera);
  return true;
}
/* Is a point (CSS px from the canvas's top left) on the case as drawn? Its eight corners projected. */
export function hit(res, x, y) {
  if (!res || res !== _shown || !_layout) return false;
  const b = res.bbox, pts = [];
  res.pivot.updateMatrixWorld(true);
  for (const X of [b.min.x, b.max.x]) for (const Y of [b.min.y, b.max.y]) for (const Z of [b.min.z, b.max.z]) {
    const v = new THREE.Vector3(X, Y, Z).applyMatrix4(res.root.matrixWorld).project(camera);
    pts.push([(v.x + 1) / 2 * _layout.cssW, (1 - v.y) / 2 * _layout.cssH]);
  }
  // convex hull (monotone chain), then point in polygon
  pts.sort((a, c) => a[0] - c[0] || a[1] - c[1]);
  const cr = (o, a, c) => (a[0] - o[0]) * (c[1] - o[1]) - (a[1] - o[1]) * (c[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  const h = lo.slice(0, -1).concat(up.slice(0, -1));
  let inside = false;
  for (let i = 0, j = h.length - 1; i < h.length; j = i++) {
    const [xi, yi] = h[i], [xj, yj] = h[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/* For the test pages: the generated spine alone (contrast and fit checks). */
export function testSpine(frontCanvasEl, title, aspect, H) {
  const px = smallPixels(frontCanvasEl, 48);
  const g = generatedSpine(px, title, aspect, H || 1024);
  return { canvas: g.canvas, bg: g.bg, fg: g.fg, size: g.size, lines: g.lines, contrast: contrast(g.bg, g.fg) };
}

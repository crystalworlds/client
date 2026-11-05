/*
 * play/cores/nes/art.mjs -- the NES family's device art for the one play host.
 *
 * Three consoles, one emulator (decided 2026-10-03): the NES, the Famicom and the
 * Famicom Disk System, chosen by the site's ?console= (index.html openNesPlay) and, for a
 * disk with none, the Disk System. Each is a photograph of a television: the play view
 * shows the TELEVISION (a crop of the photograph) and the picture sits behind the glass.
 * Every number is /nes-screen.css's measurement (two detectors, recorded there), carried
 * over as fractions of the photograph; keep the two in step.
 */
/* 2026-10-22: the play window shows the TILE pictures (the television with its
   controller below it; the console corner is gone here, by choice), so these are their
   numbers, re-measured by nes-artwork/aperture.py and famicom-artwork/aperture.py (pixels of the
   picture, written as fractions). An earlier change swapped the pictures under these keys without moving
   these numbers, which put the game off the glass; the old full-photograph figures were
   nes 903x733 scr (226,67,429,323) tv (147,23,587,414), famicom 948x523 (284,66) (252,16),
   fds 893x591 (238,62) (206,12). */
import { artFileUrl } from '../artfile.mjs';   // single picture files since 24 Oct
const CONSOLES = {
  nes: { key: 'NesConsole.png', ar: 630 / 756,
    scr: { l: 100 / 630, t: 62 / 756, w: 429 / 630, h: 323 / 756 }, tv: { l: 24 / 630, t: 18 / 756, w: 582 / 630, h: 414 / 756 },
    glass: '#4f4f4f', radius: '3.1% / 4.1%' },
  famicom: { key: 'FamicomConsole.webp', ar: 520 / 624,
    scr: { l: 54 / 520, t: 74 / 624, w: 323 / 520, h: 243 / 624 }, tv: { l: 22 / 520, t: 24 / 624, w: 475 / 520, h: 347 / 624 },
    glass: '#4d5353', radius: '10% / 13%' },
  fds: { key: 'FdsConsole.webp', ar: 520 / 624,
    scr: { l: 54 / 520, t: 74 / 624, w: 323 / 520, h: 243 / 624 }, tv: { l: 22 / 520, t: 24 / 624, w: 475 / 520, h: 347 / 624 },
    glass: '#5d605d', radius: '10% / 13%' },
};

export function consoleFor({ params, result }) {
  const q = params && params.get('console');
  if (CONSOLES[q]) return q;
  return result && result.system === 'fds' ? 'fds' : 'nes';
}

export async function describe(ctx) {
  const id = consoleFor(ctx), c = CONSOLES[id];
  const src = await artFileUrl(c.key);
  if (!src) return null;
  return { kind: id, src, ar: c.ar,
    l: c.scr.l, t: c.scr.t, w: c.scr.w, h: c.scr.h, crop: c.tv, glass: c.glass, radius: c.radius, opaque: false };
}
export const LABEL = { nes: 'NES', famicom: 'Famicom', fds: 'Famicom Disk System' };

/* ------------------------------------------------------------------ the Keys panel's controller */
/* The old page's Keys screen (play/nes/index.html .nesk-*, retired 2026-10-15): an NES
   controller with each button's key printed over its name; positions are the fractions
   measured there off the photograph (face panel 2.64:1, D-pad at 14.7 %, B and A at 72.5 %
   and 86.1 %, Select and Start level). The keys are the host's own mapping, so a rebind
   shows; the host lights [data-btn] while held. Player one's standard pad only: any other
   device in port one keeps the host's plain key list. */
const NESK_CSS = `.nesk-pad{position:relative;width:min(100%,520px);aspect-ratio:2.30;margin:0 auto;background:linear-gradient(180deg,#d8d8d4,#b9b9b4);border:1px solid #8e8e89;border-radius:7px;box-shadow:0 10px 30px -14px rgba(0,0,0,.9),inset 0 1px 0 rgba(255,255,255,.55);--nesk-accent:#e4584f}
.nesk-face{position:absolute;left:5.2%;right:5.2%;top:11%;bottom:11%;background:#232323;border-radius:3px;box-shadow:inset 0 0 0 1px #0c0c0c}
.nesk-face [data-btn]{position:absolute;display:flex;align-items:center;justify-content:center;color:#eee;user-select:none;-webkit-user-select:none;text-align:center}
.nesk-face .kk{font-weight:800;font-size:clamp(10px,2.1vw,16px);line-height:1}
.nesk-face .kl{font-size:clamp(6px,1.2vw,9px);color:#a9a9a9;letter-spacing:.08em}
.nesk-dpad{position:absolute;left:14.7%;top:50%;transform:translate(-50%,-50%);width:21%;aspect-ratio:1}
.nesk-dpad svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.nesk-dpad [data-btn]{border-radius:5px;background:transparent}
.nesk-dpad [data-btn] .kk{color:#cfcfcf;font-size:clamp(9px,1.7vw,14px)}
.nesk-dpad [data-btn].down{background:rgba(228,88,79,.42)}
.nesk-dpad .u{left:34%;top:2%;width:32%;height:32%}.nesk-dpad .d{left:34%;top:66%;width:32%;height:32%}
.nesk-dpad .l{left:2%;top:34%;width:32%;height:32%}.nesk-dpad .r{left:66%;top:34%;width:32%;height:32%}
.nesk-se{position:absolute;left:46.5%;top:58%;transform:translate(-50%,-50%);width:26%;height:30%;background:#c9c9c4;border-radius:3px;box-shadow:inset 0 0 0 1px #8e8e89}
.nesk-se [data-btn]{top:50%;transform:translateY(-50%);width:38%;height:46%;flex-direction:column;gap:1px;border-radius:999px;background:#3a3a3a;box-shadow:inset 0 1px 2px rgba(0,0,0,.7)}
.nesk-se [data-btn="select"]{left:6%}.nesk-se [data-btn="start"]{right:6%}
.nesk-se [data-btn] .kk{font-size:clamp(8px,1.5vw,12px)}
.nesk-se [data-btn] .kl{font-size:clamp(5px,1vw,7px);color:#bdbdbd}
.nesk-se [data-btn].down{background:var(--nesk-accent)}.nesk-se [data-btn].down .kl{color:#1a1a1a}
.nesk-se::before{content:"SELECT   START";position:absolute;left:0;right:0;top:-34%;font-size:clamp(5px,.95vw,7px);letter-spacing:.12em;color:#c05a52;white-space:pre;text-align:center}
.nesk-face-btns [data-btn]{top:58%;transform:translateY(-50%);width:11%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 38% 32%,#f0665c,#c2231c 72%);box-shadow:0 0 0 4px #d8d8d4,0 0 0 5px #8e8e89;flex-direction:column;gap:1px}
.nesk-face-btns [data-btn="b"]{left:72.5%;margin-left:-5.5%}.nesk-face-btns [data-btn="a"]{left:86.1%;margin-left:-5.5%}
.nesk-face-btns [data-btn] .kk{color:#fff}.nesk-face-btns [data-btn] .kl{color:#ffd9d6}
.nesk-face-btns [data-btn].down{background:radial-gradient(circle at 38% 32%,#fff1ef,#f3786d 72%);box-shadow:0 0 0 4px #d8d8d4,0 0 0 5px var(--nesk-accent)}
.nesk-face-btns [data-btn].down .kk,.nesk-face-btns [data-btn].down .kl{color:#4a0b06}`;
const NESK_GLYPH = { ArrowUp: '\u2191', ArrowDown: '\u2193', ArrowLeft: '\u2190', ArrowRight: '\u2192' };
export function keysDiagram(table, keyLabel) {
  const pad = table[0] || [];
  const need = ['up', 'down', 'left', 'right', 'a', 'b', 'select', 'start'];
  if (!need.every(id => pad.some(c => c.id === id))) return null;
  if (!document.getElementById('nesk-css')) { const st = document.createElement('style'); st.id = 'nesk-css'; st.textContent = NESK_CSS; document.head.appendChild(st); }
  const esc = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const k = id => { const c = pad.find(x => x.id === id); return c && c.keys.length ? esc(NESK_GLYPH[c.keys[0]] || keyLabel(c.keys[0])) : ''; };
  const el = document.createElement('div');
  el.className = 'nesk-pad'; el.setAttribute('role', 'group'); el.setAttribute('aria-label', 'NES controller key map');
  el.innerHTML = `<div class="nesk-face"><div class="nesk-dpad"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M34 2 H66 V34 H98 V66 H66 V98 H34 V66 H2 V34 H34 Z" fill="#111" stroke="#5c5c5c" stroke-width="3" stroke-linejoin="round"/></svg>
<div class="u" data-btn="up" aria-label="Up"><span class="kk">${k('up')}</span></div><div class="l" data-btn="left" aria-label="Left"><span class="kk">${k('left')}</span></div>
<div class="r" data-btn="right" aria-label="Right"><span class="kk">${k('right')}</span></div><div class="d" data-btn="down" aria-label="Down"><span class="kk">${k('down')}</span></div></div>
<div class="nesk-se"><div data-btn="select" aria-label="Select"><span class="kk">${k('select')}</span><span class="kl">SELECT</span></div><div data-btn="start" aria-label="Start"><span class="kk">${k('start')}</span><span class="kl">START</span></div></div>
<div class="nesk-face-btns"><div data-btn="b" aria-label="B"><span class="kk">${k('b')}</span><span class="kl">B</span></div><div data-btn="a" aria-label="A"><span class="kk">${k('a')}</span><span class="kl">A</span></div></div></div>`;
  return el;
}

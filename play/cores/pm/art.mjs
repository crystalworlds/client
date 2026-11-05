/*
 * play/cores/pm/art.mjs -- the Pokemon mini's device art for the one play host.
 * Started 2026-10-14 in the Pokemon mini migration.
 *
 * WHICH SHELL: the site gives every Pokemon mini game one console colour per page load
 * (index.html pmConsoleKey), and the shared bridge (play/shared/host-bridge.js) passes the
 * colour of the game's own tile as ?shell=, so a variant is another cartridge in the same
 * console (decided 2026-10-14). The host never picks.
 *
 * WHERE THE SCREEN IS: the old window's own numbers (pm-embed.js SHELL_W/H, WIN_X/Y/W/H:
 * the 198 x 254 shell, the 96 x 64 window at 51, 58), which its hotspots and the overlay's
 * art buttons (play/shared/overlays/pm.json) are measured against. The whole device shows,
 * the game drawn over the artwork's window as in the old window.
 *
 * ALSO HERE, because they are the artwork's: the Keys diagram, and the rumble effect (the
 * device shaking on screen), which declares its option for the shared Settings (2026-10-14:
 * a console's module is its core, its art and its overlay; no UI of its own).
 */
const SHELL_W = 198, SHELL_H = 254, WIN_X = 51, WIN_Y = 58, WIN_W = 96, WIN_H = 64;
export const BEZEL = { ar: SHELL_W / SHELL_H, l: WIN_X / SHELL_W, t: WIN_Y / SHELL_H, w: WIN_W / SHELL_W, h: WIN_H / SHELL_H };
/* The whole shell: as many screen heights above and below the window as the shell has. */
export const BAND = { above: WIN_Y / WIN_H, below: (SHELL_H - WIN_Y - WIN_H) / WIN_H };
/* Keep in step with index.html PM_CONSOLE_COLORS. */
export const PM_SHELLS = ['PokemonMiniConsole.png', 'PokemonMiniConsoleGreen.png', 'PokemonMiniConsolePurple.png'];

/* The console pictures are single files since 24 Oct: images/art/, through ../artfile.mjs. */
import { artFileUrl } from '../artfile.mjs';
function site() { try { return window.parent && window.parent !== window ? window.parent : null; } catch (_) { return null; } }

/** The console colour this title wears: the one the site chose for this GAME (its group's
 *  tile) for this page load, passed by the shared bridge as ?shell= -- so a variant is a new
 *  cartridge in the same console, never a new console (decided 2026-10-14). */
export function shellFor({ game, params }) {
  const k = params && params.get('shell');
  if (k && PM_SHELLS.indexOf(k) >= 0) return k;
  const P = site();
  try { if (P && typeof P.pmConsoleKey === 'function') { const c = P.pmConsoleKey({ id: String(game) }); if (PM_SHELLS.indexOf(c) >= 0) return c; } } catch (_) {}
  return PM_SHELLS[0];
}

async function shellSrc(key) {
  let src = null;
  const P = site();
  try { if (P && typeof P.imgSrc === 'function') src = P.imgSrc(key) || null; } catch (_) {}
  return src || await artFileUrl(key);
}

/* TWO PLAYERS (2026-10-24; core.mjs model 'pm-link'): two consoles side by side,
   player 1's in the game's colour and player 2's in the next one, LINK_SPACE apart. The core's
   picture is both windows and the plastic between them at one pixel per screen dot (link.mjs
   LINK_W = 96 + 114 + 96), so the art's window runs from player 1's window to player 2's, and
   the 'link-gap' effect below lays the plastic back over the middle of the picture. */
const LINK_SPACE = 12;
const LINK_ART_W = SHELL_W * 2 + LINK_SPACE;                    // 408
export const LINK_GAP = SHELL_W + LINK_SPACE - WIN_W;             // 114, = link.mjs LINK_GAP
const loadImg = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
async function describeLink(ctx) {
  const key = shellFor(ctx), key2 = PM_SHELLS[(PM_SHELLS.indexOf(key) + 1) % PM_SHELLS.length];
  const [a, b] = await Promise.all([shellSrc(key).then(s => s && loadImg(s)), shellSrc(key2).then(s => s && loadImg(s))]);
  if (!a || !b) return null;
  const sc = a.naturalWidth / SHELL_W, c = document.createElement('canvas');
  c.width = Math.round(LINK_ART_W * sc); c.height = Math.round(SHELL_H * sc);
  const x = c.getContext('2d');
  x.drawImage(a, 0, 0, SHELL_W * sc, SHELL_H * sc);
  x.drawImage(b, (SHELL_W + LINK_SPACE) * sc, 0, SHELL_W * sc, SHELL_H * sc);
  let src = null;
  try { src = c.toDataURL('image/png'); } catch (_) { return null; }  // a picture the page may not read: the plain screens
  return { kind: 'pm-link:' + key, src, ar: LINK_ART_W / SHELL_H, l: WIN_X / LINK_ART_W, t: WIN_Y / SHELL_H,
    w: (LINK_ART_W - 2 * WIN_X) / LINK_ART_W, h: WIN_H / SHELL_H, opaque: true, band: BAND, measureGlass: false,
    gap: { from: WIN_W / (WIN_W * 2 + LINK_GAP), to: (WIN_W + LINK_GAP) / (WIN_W * 2 + LINK_GAP) },
    /* Player 1's on-screen buttons sit on player 1's console, the left part of the picture. */
    overlayView: { cut: [0, 0, LINK_ART_W / SHELL_W, 1] } };
}

export async function describe(ctx) {
  if (ctx && ctx.model === 'pm-link') return describeLink(ctx);
  const key = shellFor(ctx);
  const src = await shellSrc(key);
  if (!src) return null;
  return { kind: key, src, ar: BEZEL.ar, l: BEZEL.l, t: BEZEL.t, w: BEZEL.w, h: BEZEL.h, opaque: true, band: BAND, measureGlass: false };
}

/* ------------------------------------------------------------------ rumble
   The cartridge's motor (core.rumble, read every frame) shakes the device on screen and,
   where the phone can, the phone itself (navigator.vibrate). A DISPLAY EFFECT of the
   artwork: it declares its option and the shared host draws the Settings row. */
const RUMBLE_CSS = `
#lcdWrap.pm-rumble { animation: pm-rumble .07s linear infinite; }
@keyframes pm-rumble { 0%{transform:translate(0,0)} 25%{transform:translate(-1.5px,1px)} 50%{transform:translate(1.5px,-1px)} 75%{transform:translate(-1px,-1px)} 100%{transform:translate(0,0)} }
@media (prefers-reduced-motion: reduce) { #lcdWrap.pm-rumble { animation:none; } }`;
export const effects = [{
  /* Two players: the plastic between the two windows, laid over the middle of the picture (the
     picture is opaque, so the art cannot show through it). Nothing to set; off with one player. */
  id: 'link-gap',
  options: [],
  attach({ presenter }) {
    const el = document.createElement('div');
    el.className = 'pm-link-gap'; el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:absolute;z-index:3;pointer-events:none;background-repeat:no-repeat;display:none';
    presenter.wrap.appendChild(el);
    let last = '';
    const sync = () => {
      const g = presenter.art, cv = presenter.canvas, im = presenter.img;
      if (!g || !g.gap || presenter.full || !cv.offsetWidth) { if (last !== 'off') { el.style.display = 'none'; last = 'off'; } return; }
      const x = cv.offsetLeft + g.gap.from * cv.offsetWidth, w = (g.gap.to - g.gap.from) * cv.offsetWidth;
      const key = [g.src.length, x, w, cv.offsetTop, cv.offsetHeight, im.offsetLeft, im.offsetTop, im.offsetWidth, im.offsetHeight].join(',');
      if (key === last) return;
      /* The space between the two consoles is see-through in the art: under it, the colour behind the device. */
      let bg = 'transparent';
      for (let n = presenter.wrap.parentElement; n && n.nodeType === 1; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)) { bg = c; break; } }
      el.style.backgroundColor = bg;
      last = key;
      Object.assign(el.style, { display: 'block', left: x + 'px', top: cv.offsetTop + 'px', width: w + 'px', height: cv.offsetHeight + 'px',
        backgroundImage: `url("${g.src}")`, backgroundSize: `${im.offsetWidth}px ${im.offsetHeight}px`,
        backgroundPosition: `${im.offsetLeft - x}px ${im.offsetTop - cv.offsetTop}px` });
    };
    return { sync, frame: sync, detach() { el.remove(); } };
  },
}, {
  id: 'rumble',
  options: [{ id: 'rumble', label: 'Rumble', help: 'Shake the console when a game rumbles', type: 'bool', default: true, key: 'cw.pm.rumble', group: 'display', scope: 'console' }],
  attach({ presenter, core, live }) {
    if (!document.getElementById('pm-rumble-css')) { const st = document.createElement('style'); st.id = 'pm-rumble-css'; st.textContent = RUMBLE_CSS; document.head.appendChild(st); }
    let on = true, was = 0, buzzing = false, lastVib = 0;
    const stats = { on, starts: 0, vibrations: 0 };
    const vib = ms => { try { if (navigator.vibrate) { navigator.vibrate(ms); stats.vibrations++; } } catch (_) {} };
    const stop = () => { presenter.wrap.classList.remove('pm-rumble'); if (buzzing) vib(0); buzzing = false; };
    return {
      stats,                                   // read by the host's diagnostics (window.__cwHost.effects)
      setOption(id, v) { if (id === 'rumble') { on = stats.on = !!v; if (!on) stop(); } },
      frame() {
        const c = core();
        const r = live() && c ? c.rumble | 0 : 0;
        if (r === was) { if (r && buzzing && performance.now() - lastVib > 100) { lastVib = performance.now(); vib(140); } return; }
        was = r;
        if (r && on) { stats.starts++; presenter.wrap.classList.add('pm-rumble'); buzzing = true; vib(120); }
        else stop();
      },
    };
  },
}];

/* ------------------------------------------------------------------ the Keys diagram
   The Pokemon mini's own layout (index.html pmRenderKeys, carried over): the d-pad, B and
   A, the C trigger on the top edge, and Power and Shake, with the keys that press each NOW
   (the viewer's remaps included), lit while held. `table` is the host's input table. */
const PMK_CSS = `
.pmk2{display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;margin-bottom:16px}
.pmk2-diagram{position:relative;width:min(100%,540px);aspect-ratio:1.6;margin:0 auto}
.pmk2 [data-btn]{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:2px solid #9aa1ad;border-radius:999px;background:rgba(255,255,255,.02);color:#e6e8ec;user-select:none;-webkit-user-select:none;box-sizing:border-box}
.pmk2 [data-btn].down{border-color:#9bbc0f;background:rgba(155,188,15,.26)}
.pmk2 .kk{font-weight:800;font-size:clamp(11px,2.2vw,18px);line-height:1}
.pmk2 .kl{font-size:clamp(7px,1.3vw,10px);color:#9aa1ad;letter-spacing:.06em}
.pmk2-dpad{position:absolute;left:2%;top:22%;width:40%;height:56%;color:#9aa1ad}
.pmk2-dpad svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.pmk2-dpad [data-btn]{border:0;background:transparent;border-radius:7px}
.pmk2-dpad [data-btn].down{background:rgba(155,188,15,.30);border:0}
.pmk2-dpad .u{left:34%;top:3%;width:32%;height:32%}.pmk2-dpad .d{left:34%;top:65%;width:32%;height:32%}
.pmk2-dpad .l{left:3%;top:34%;width:32%;height:32%}.pmk2-dpad .r{left:65%;top:34%;width:32%;height:32%}
.pmk2-extra{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.pmk2-extra [data-btn]{position:relative;flex-direction:row;gap:8px;padding:6px 14px;border-radius:999px}`;
export function keysDiagram(table, keyLabel) {
  if (!document.getElementById('pmk2-css')) { const st = document.createElement('style'); st.id = 'pmk2-css'; st.textContent = PMK_CSS; document.head.appendChild(st); }
  const all = [].concat(...table);
  const k = id => { const c = all.find(x => x.id === id); return c && c.keys.length ? keyLabel(c.keys[0]) : ''; };
  const el = document.createElement('div');
  el.className = 'pmk2';
  el.innerHTML = `<div class="pmk2-diagram">
    <div class="pmk2-dpad"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M34 3 H66 V34 H97 V66 H66 V97 H34 V66 H3 V34 H34 Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>
      <div class="u" data-btn="up" aria-label="Up"><span class="kk">${k('up')}</span></div><div class="l" data-btn="left" aria-label="Left"><span class="kk">${k('left')}</span></div>
      <div class="r" data-btn="right" aria-label="Right"><span class="kk">${k('right')}</span></div><div class="d" data-btn="down" aria-label="Down"><span class="kk">${k('down')}</span></div></div>
    <div data-btn="c" aria-label="C" style="left:48%;top:2%;width:44%;height:15%;border-radius:10px"><span class="kk">${k('c')}</span><span class="kl">C</span></div>
    <div data-btn="b" aria-label="B" style="left:50%;top:46%;width:22%;height:32%"><span class="kk">${k('b')}</span><span class="kl">B</span></div>
    <div data-btn="a" aria-label="A" style="left:74%;top:46%;width:22%;height:32%"><span class="kk">${k('a')}</span><span class="kl">A</span></div>
  </div>
  <div class="pmk2-extra">
    <div data-btn="power" aria-label="Power"><span class="kk">${k('power')}</span><span class="kl">POWER</span></div>
    <div data-btn="shake" aria-label="Shake"><span class="kk">${k('shake')}</span><span class="kl">SHAKE</span></div>
  </div>`;
  return el;
}

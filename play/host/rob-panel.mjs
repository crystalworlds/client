/*
 * play/host/rob-panel.mjs -- R.O.B. beside the game (2026-10-21; the accessories
 * 2026-10-24).
 *
 * A core with result.extensions.rob ('gyro' or 'block') and core.ext.rob gets this: the play stage
 * becomes the game and R.O.B. side by side, always, on every screen (beside the game when the
 * window is wider than tall, under it otherwise; never a hidden window). R.O.B. is the rob-test 3D
 * page (play/rob/index.html?embed=1, three.js), facing the player at the start, moved by the
 * commands the core decodes from the game's screen flashes as each one starts, at the page's own
 * timings.
 *
 * THE ACCESSORIES (24 Oct): the page's world (play/rob/rob-accessories.mjs) holds the Gyromite set
 * (gyros, spinner and its D cell, gyro tray with Controller 2 and its blue and red caps, holder, Gyro
 * Hands) or the Stack-Up set (five blocks, five trays, Block Hands). They start in the box; the user
 * sets them up by hand ("Grab", named "Set up R.O.B." until 1 Nov 2026: drag with a mouse or a finger, or the arrow keys / a remote
 * / a controller with the hand cursor). R.O.B. then really picks things up and puts them down with
 * his commands; a spinning gyro standing on the blue cap presses controller two's A, on the red cap B,
 * and this panel hands those bits to the core (core.ext.rob.trays), with the manual override buttons
 * kept for a game that is stuck. For Stack-Up the core reads the game's goal picture and the
 * arrangement the game believes (rob.mjs readStackUp) and this panel compares them with the blocks
 * actually stacked. The saved set-up (per browser) comes back next time.
 */
const CSS = `
body.has-rob #stage{flex-direction:row}
body.has-rob #screenBox{flex:1 1 58%;min-width:0}
.rob-side{position:relative;flex:0 0 42%;min-width:0;min-height:0;display:flex;flex-direction:column;box-sizing:border-box;
  border-left:1px solid var(--line);background:var(--panel)}
.rob-view{flex:1 1 auto;min-height:120px;width:100%;border:0;display:block;background:#1b1e22}
.rob-side.rob-setup .rob-view{outline:2px solid var(--accent);outline-offset:-2px}
.rob-info{flex:0 0 auto;padding:8px 12px 10px;font-size:13px;line-height:1.4;color:var(--dim);display:flex;flex-direction:column;gap:6px;max-height:46%;overflow:auto}
.rob-info b{color:var(--ink);font-weight:600}
.rob-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.rob-led{display:inline-block;width:9px;height:9px;border-radius:50%;background:#3a2020;border:1px solid #6b2a2a}
.rob-led.lit{background:#ff3b2f;box-shadow:0 0 8px #ff3b2f}
.rob-parts{font-size:12px;line-height:1.35;columns:2;column-gap:14px}
.rob-parts span{display:block;break-inside:avoid}
.rob-trays{display:flex;gap:12px;flex-wrap:wrap}
.rob-tray.down b{color:var(--accent)}
.rob-match b.ok{color:var(--accent)}
.rob-btns{display:flex;gap:6px;flex-wrap:wrap}
.rob-btns button{font:inherit;font-size:12px;color:var(--ink);background:var(--cw-bar-field,#1d2026);border:1px solid var(--line);border-radius:8px;padding:5px 10px;cursor:pointer}
.rob-btns button[aria-pressed=true]{border-color:var(--accent);color:var(--accent)}
.rob-btns button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.rob-credit{font-size:10.5px;opacity:.75}
.rob-credit a{color:inherit}
@media (max-aspect-ratio:1/1){
  body.has-rob #stage{flex-direction:column}
  body.has-rob #screenBox{flex:1 1 52%;min-height:0}
  .rob-side{flex:0 0 48%;border-left:0;border-top:1px solid var(--line)}
  /* Under the game, the readout goes above R.O.B.: the touch pad docks to the window's bottom
     corners (overlay.js float, translucent), where it then covers only his base, never the buttons. */
  .rob-info{order:-1;padding:6px 10px 6px;gap:4px;font-size:12px;max-height:40%}
  .rob-btns button{padding:4px 8px}
  .rob-parts{columns:1}
}
.cw-preview .rob-side{display:none}
`;
const NAMES = { UP: 'Up 2', DOWN: 'Down 2', UP1: 'Up 1', DOWN1: 'Down 1', LEFT: 'Left', RIGHT: 'Right', OPEN: 'Open arms', CLOSE: 'Close arms', TEST: 'Test (LED on)', RESET: 'Reset' };
const A = 0x01, B = 0x02;
const V = '20261102-srchbat';   // the R.O.B. page's tag (was 20261102-robpad1; 20261102-robplay1; 20261101-fix4b; 20261025-robx3 before)

export class RobPanel {
  constructor({ core, kind, stage, layout, log, toast }) {
    this.core = core; this.kind = kind; this.stage = stage; this.relayout = layout || (() => {}); this.log = log || (() => {}); this.toast = toast || (() => {});
    this.win = null; this.pending = []; this.blink = 0; this.ledShown = null; this.sig = ''; this.traysSent = -1; this.wsig = '';
    if (!document.getElementById('rob-panel-css')) { const s = document.createElement('style'); s.id = 'rob-panel-css'; s.textContent = CSS; document.head.appendChild(s); }
    const el = this.el = document.createElement('div');
    el.className = 'rob-side';
    el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'R.O.B.');
    /* Facing the player: the turn's centre stop, the camera in front of his face, far enough back for the parts round his base. */
    const src = new URL(`../rob/index.html?v=${V}&embed=1&set=${kind}&pose=turn:2,lift:0,arms:1,led:1&view=az:22,el:16,dist:3.5,height:0.3`, import.meta.url).href;
    const gyroBtns = kind === 'gyro' ? `<button type="button" data-rob="stand">Stand the gyros up</button><button type="button" data-rob="a" aria-pressed="false">Hold blue (A)</button><button type="button" data-rob="b" aria-pressed="false">Hold red (B)</button>` : '';
    el.innerHTML = `<iframe class="rob-view" title="R.O.B., the robot and his ${kind === 'gyro' ? 'Gyromite' : 'Stack-Up'} set" src="${src}" tabindex="0"></iframe>
<div class="rob-info">
  <div class="rob-head"><b>R.O.B.</b><span class="rob-led" aria-hidden="true"></span><span class="rob-last" role="status" aria-live="polite">Waiting for the game's first command.</span></div>
  <div class="rob-setup-line"></div>
  <div class="rob-parts"></div>
  <div class="rob-trays"></div>
  <div class="rob-match"></div>
  <div class="rob-btns"><button type="button" data-rob="setup" aria-pressed="false">Grab</button><button type="button" data-rob="turn">Turn</button><button type="button" data-rob="box">Everything back in the box</button>${gyroBtns}</div>
  <div class="rob-credit">3D model: <a href="https://skfb.ly/oWXI7" target="_blank" rel="noopener">R.O.B. by Wrld_Bld</a>, <a href="http://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>, adapted; the parts are ours (measurements credited in play/rob/CREDITS.md).</div>
</div>`;
    this.lastEl = el.querySelector('.rob-last'); this.ledEl = el.querySelector('.rob-led');
    this.setupEl = el.querySelector('.rob-setup-line'); this.partsEl = el.querySelector('.rob-parts'); this.trEl = el.querySelector('.rob-trays'); this.matchEl = el.querySelector('.rob-match');
    el.addEventListener('click', e => { const b = e.target.closest('[data-rob]'); if (b) this.choose(b.dataset.rob); });
    const ifr = this.ifr = el.querySelector('iframe');
    ifr.addEventListener('load', () => { this.win = ifr.contentWindow; this.tall = undefined; this.flush(); this.hookWorld(); });
    stage.appendChild(el);
    document.body.classList.add('has-rob');
    this.x().onCommand(c => this.send(c));
    this.ro = 'ResizeObserver' in window ? new ResizeObserver(() => this.pad()) : null;
    if (this.ro) this.ro.observe(stage);
    /* A controller's or a remote's presses arrive as keys at the focused element (host.mjs navKey): while
       R.O.B.'s view has the focus (Set-up), pass them on into the page, where the hand cursor walks the parts. */
    this.keyFwd = e => {
      if (!this.win || e.target !== ifr) return;
      let d = null; try { d = this.win.document; } catch (_) { return; }
      if (!/^Arrow/.test(e.key) && e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Escape' && e.key !== 'Backspace' && e.key !== 'GoBack' && e.key !== 'BrowserBack') return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.type !== 'keydown') return;
      const key = e.key === 'GoBack' || e.key === 'BrowserBack' ? 'Escape' : e.key;
      (d.activeElement || d.body).dispatchEvent(new this.win.KeyboardEvent('keydown', { key, code: e.code, bubbles: true, cancelable: true }));
    };
    window.addEventListener('keydown', this.keyFwd, true); window.addEventListener('keyup', this.keyFwd, true);
    requestAnimationFrame(() => { this.pad(); this.relayout(); });
    this.paint(true);
  }
  x() { const c = this.core(); return (c && c.ext && c.ext.rob) || { status: () => null, onCommand() {}, hold() {}, trays() {}, resetGyros() {} }; }
  acc() { try { return this.win && this.win.robAcc ? this.win.robAcc : null; } catch (_) { return null; } }
  hookWorld() {
    const tryHook = () => { const w = this.acc(); if (!w) { setTimeout(tryHook, 250); return; } w.onChange(() => this.sync()); this.sync(); this.tall = undefined; this.pad(); };
    tryHook();
  }
  /* Keep R.O.B.'s view clear of the bar when the bar sits over his half. */
  pad() {
    const bar = document.querySelector('.cb-bar');
    let top = 0;
    if (bar && !document.body.classList.contains('cb-full')) {
      const b = bar.getBoundingClientRect(), r = this.el.getBoundingClientRect();
      if (b.bottom > r.top && b.right > r.left && b.left < r.right) top = Math.max(0, Math.round(b.bottom - r.top + 4));
    }
    this.el.style.paddingTop = top ? top + 'px' : '';
    /* Under the game (a phone held upright) the touch pad docks over the bottom of his view:
       frame him higher there (the view aimed at his base), so the pad covers the floor and his base rather than his body. */
    const tall = innerHeight > innerWidth;
    if (tall !== this.tall && this.ready()) {
      this.tall = tall;
      /* R.O.B. and his parts framed together, centred (1 Nov: robFit in play/rob/index.html);
         under the game, in the upper three quarters of his view, clear of the touch pad. */
      try {
        const win = this.win, rect = () => (tall ? { x: 0, y: 0, w: win.innerWidth, h: win.innerHeight * 0.75 } : { x: 0, y: 0, w: win.innerWidth, h: win.innerHeight });
        if (win.robFit && this.acc()) win.robFit({ az: 22, el: tall ? 20 : 16, rect: rect(), again: () => ({ az: 22, el: tall ? 20 : 16, rect: rect() }) });
        else win.robView(tall ? { az: 22, el: 20, dist: 5.2, height: 0.08 } : { az: 22, el: 16, dist: 3.5, height: 0.3 });
      } catch (_) {}
    }
  }
  ready() { try { return !!(this.win && this.win.robReady && this.win.robCommand); } catch (_) { return false; } }
  send(cmd) {
    this.log('r.o.b.: ' + cmd);
    if (this.ready()) { try { this.win.robCommand(cmd); } catch (_) {} } else if (this.pending.length < 8) this.pending.push(cmd);
  }
  flush() {
    if (!this.ready()) { if (!this.flushT) this.flushT = setTimeout(() => { this.flushT = 0; this.flush(); }, 200); return; }
    for (const c of this.pending.splice(0)) try { this.win.robCommand(c); } catch (_) {}
  }
  led(on) {
    if (this.ledShown === on) return;
    this.ledShown = on;
    if (this.ready()) try { this.win.robPose({ led: on }); } catch (_) {}
  }
  /* The world changed (a part moved, a gyro pressed a cap ...): the trays' bits to the core, the readout. */
  sync() {
    const w = this.acc(); if (!w) return;
    let s = null; try { s = w.state(); } catch (_) { return; }
    this.world = s;
    if (this.kind === 'gyro' && s.pad2 !== this.traysSent) { this.traysSent = s.pad2; this.x().trays(s.pad2); this.log(`r.o.b.: the trays press ${s.pad2 ? ((s.pad2 & A ? 'A ' : '') + (s.pad2 & B ? 'B' : '')).trim() : 'nothing'}`); }
    this.el.classList.toggle('rob-setup', !!s.setup);
    this.paint(true);
  }
  /* Once per emulated frame: the LED blinks to the TEST stream; the readout follows the state. */
  frame() {
    const s = this.x().status(); if (!s) return;
    if ((this.n = (this.n || 0) + 1) % 30 === 1) this.pad();   // the bar can arrive or move after the panel
    if (s.testing) { this.blink = (this.blink + 1) % 20; this.led(this.blink < 10); } else this.led(s.led);   // 3 Hz: the eye follows it (25 Oct; the toy's own flicker at the stream's rate is too fast to read)
    /* 25 Oct: the problem was knowing what Test did (the view and the light stay as they were). The booklet:
       "Test mode: this is used to focus R.O.B.'s eyes onto the T.V. screen"; the light blinks while he receives the
       signal. So: a short note in the play window's usual style, fading by itself, once each time the signal is seen;
       the Test button's tooltip carries the explanation. No sound, no dialog. */
    if (!!s.testing !== !!this.testNoted) {
      this.testNoted = !!s.testing;
      if (this.testNoted) { const t = 'R.O.B. tested: he can see the screen.'; this.log('r.o.b.: ' + t); try { this.toast(t); } catch (_) {} }
    }
    this.paint(false, s);
  }
  paint(force, s) {
    s = s || this.x().status(); if (!s) return;
    const w = this.world;
    const sig = JSON.stringify([s.last, s.running, s.testing, s.pad2, s.override, s.trays, s.stackup, w && [w.setup, w.cursor, w.inBox, w.held, w.pad2, w.parts.map(p => [p.where, Math.round(p.spin * 20), p.fallen]), w.stacks]]);
    if (!force && sig === this.sig) return;
    this.sig = sig;
    const lit = s.testing ? this.blink < 10 : !s.running && s.led;
    this.ledEl.classList.toggle('lit', !!lit);
    const t = s.testing ? 'Test signal: the LED blinks when R.O.B. sees the screen.' : s.running ? 'Moving: ' + NAMES[s.running] + (s.queued ? ` (${s.queued} waiting)` : '') : s.last ? 'Last command: ' + NAMES[s.last.cmd] : 'Waiting for the game’s first command.';
    if (this.lastEl.textContent !== t) this.lastEl.textContent = t;
    const setupBtn = this.el.querySelector('[data-rob="setup"]'); if (setupBtn) setupBtn.setAttribute('aria-pressed', String(!!(w && w.setup)));
    if (!w) { this.setupEl.innerHTML = 'R.O.B.’s parts are loading.'; return; }
    const line = w.setup
      ? (w.cursor === 'parts' ? '<b>Grab:</b> arrows pick a part, OK takes it; Back leaves.' : w.cursor === 'targets' ? '<b>Grab:</b> arrows pick a place, OK puts it there; Back returns it.' : '<b>Grab:</b> drag a part with the mouse or a finger, or press an arrow to use the hand cursor. Back leaves.')
      : (w.inBox ? `<b>Grab:</b> ${w.inBox} part${w.inBox > 1 ? 's are' : ' is'} still in the box (the manual: spinner in slot 1, tray with Controller 2 in 2 and 3, holder with the gyros in 4 and 5; Stack-Up: a tray in every slot, the blocks stacked on tray 3).` : 'All parts are out of the box.');
    this.setupEl.innerHTML = line;
    this.partsEl.innerHTML = w.parts.map(p => `<span>${w.label ? '' : ''}${labelOf(p)}: <b>${p.where}</b>${p.spin > 0 ? ` (spinning ${Math.round(p.spin * 100)}%)` : ''}</span>`).join('');
    if (this.kind === 'gyro') {
      const down = b => !!(s.pad2 & b);
      const lv = w.levers || {};
      this.trEl.innerHTML = `<span class="rob-tray${down(A) ? ' down' : ''}">Blue cap (A): <b>${lv.blue ? 'pressed' : 'up'}</b></span><span class="rob-tray${down(B) ? ' down' : ''}">Red cap (B): <b>${lv.red ? 'pressed' : 'up'}</b></span>` +
        (lv.padOk === false && (lv.blue || lv.red) ? '<span>Controller 2 is not in the tray the right way up, so nothing reaches the game.</span>' : '') +
        `<span>Controller 2 gets: <b>${s.pad2 ? ((s.pad2 & A ? 'A ' : '') + (s.pad2 & B ? 'B' : '')).trim() : 'nothing'}</b>${s.override ? ' (held by hand)' : ''}</span>`;
      for (const [k, bit] of [['a', A], ['b', B]]) { const b = this.el.querySelector(`[data-rob="${k}"]`); if (b) b.setAttribute('aria-pressed', String(!!(s.override & bit))); }
      this.matchEl.innerHTML = '';
    } else {
      this.trEl.innerHTML = '';
      this.matchEl.innerHTML = matchLine(w.stacks, s.stackup);
    }
  }
  choose(id) {
    const s = this.x().status() || { override: 0 };
    const w = this.acc();
    if (id === 'a' || id === 'b') { const bit = id === 'a' ? A : B, on = !(s.override & bit); this.x().hold(bit, on); this.log(`r.o.b.: ${id === 'a' ? 'blue' : 'red'} tray held by hand ${on ? 'on' : 'off'}`); }
    else if (id === 'setup' && w) { const on = !w.inSetup; w.setup(on); this.log(`r.o.b.: set-up ${on ? 'on' : 'off'}`); if (on) { try { this.ifr.focus(); this.win.focus(); } catch (_) {} } else { try { const b = this.el.querySelector('[data-rob="setup"]'); if (b) b.focus(); } catch (_) {} } }
    else if (id === 'turn' && w) { const st = w.state(); const c = w.cursor; const dragging = st.parts.find(p => p.support === 'drag'); if (dragging) w.turn(dragging.id); else if (c) w.key({ key: 'ArrowUp' }); else { const tray = st.parts.find(p => p.kind === 'gyrotray') || st.parts.find(p => p.kind === 'pad2'); if (tray) w.turn(tray.id); } }
    else if (id === 'box' && w) { w.reset(); this.log('r.o.b.: everything back in the box'); }
    else if (id === 'stand' && w) { w.standGyros(); this.log('r.o.b.: the gyros stood up'); }
    this.paint(true);
  }
  /* The bar's R.O.B. item (play/shared/control-bar.js devices). */
  label() { return 'R.O.B.'; }
  state() { return null; }
  menu() {
    const s = this.x().status() || { override: 0 };
    const w = this.world || {};
    const items = [
      { id: 'setup', label: w.setup ? 'Stop grabbing (Back)' : 'Grab (place his parts)', checked: !!w.setup },
      { id: 'turn', label: 'Turn the part in hand (caps, Controller 2, switch)' },
      { id: 'box', label: 'Everything back in the box' },
    ];
    if (this.kind === 'gyro') items.push({ id: 'stand', label: 'Stand the gyros up' },
      { id: 'a', label: 'Hold the blue tray (controller two A)', checked: !!(s.override & A) },
      { id: 'b', label: 'Hold the red tray (controller two B)', checked: !!(s.override & B) });
    else items.push({ id: 'none', label: 'Stack-Up: the game cannot see the blocks; the readout compares them with its picture', info: true });
    return items;
  }
  destroy() {
    if (this.ro) this.ro.disconnect();
    clearTimeout(this.flushT);
    window.removeEventListener('keydown', this.keyFwd, true); window.removeEventListener('keyup', this.keyFwd, true);
    this.el.remove();
    document.body.classList.remove('has-rob');
    requestAnimationFrame(() => this.relayout());
  }
}
const labelOf = p => p.kind === 'block' ? `${p.colour} block` : p.kind === 'gyro' ? `gyro ${p.id.slice(-1)}` : p.kind === 'blocktray' ? `tray ${p.id.slice(-1)}` : ({ spinner: 'spinner', dcell: 'D cell', gyrotray: 'gyro tray', pad2: 'Controller 2', holder: 'holder', hands: 'hands' })[p.kind] || p.id;
/* Our stacks (per tray 1..5, bottom up, or null = no tray) against the game's goal and its belief (five lists, bottom up). */
function matchLine(stacks, su) {
  if (!stacks) return '';
  if (!su || !su.goal) return 'The game is not showing its picture (menu, Test or the scoring screen).';
  const ours = [1, 2, 3, 4, 5].map(k => stacks[k] || []);
  const diffs = [];
  for (let k = 0; k < 5; k++) { const a = ours[k].join(','), b = (su.goal[k] || []).join(','); if (a !== b) diffs.push(`tray ${k + 1}: ${ours[k].length ? ours[k].join(', ') : 'empty'}; the picture wants ${su.goal[k] && su.goal[k].length ? su.goal[k].join(', ') : 'empty'}`); }
  let line = diffs.length ? `<b>Not yet:</b> ${diffs.slice(0, 2).join('; ')}${diffs.length > 2 ? '; ...' : ''}.` : '<b class="ok">The blocks match the picture.</b> Press Start to score.';
  if (su.believed) {
    const bel = [];
    for (let k = 0; k < 5; k++) if (ours[k].join(',') !== (su.believed[k] || []).join(',')) bel.push(k + 1);
    if (bel.length) line += ` The game believes tray${bel.length > 1 ? 's' : ''} ${bel.join(', ')} ${bel.length > 1 ? 'hold' : 'holds'} something else: a move did not go as it thinks.`;
  }
  return line;
}

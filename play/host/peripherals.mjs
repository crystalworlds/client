/*
 * play/host/peripherals.mjs -- cartridge peripherals the host drives for any core (2026-10-15).
 * First users: the Game Boy's licensed chips (the Game Boy core's licensed-chips ABI):
 * tilt (MBC7: Kirby Tilt 'n' Tumble, Command Master) and the Pocket Camera's sensor.
 *
 * A core declares the capability (load() result.extensions.tilt / .camera) and gives the calls
 * (core.ext.tilt.set(x, y); core.ext.camera.wants(), .frame(grey), .off(), .size). Nothing here
 * knows which console it is. The Control Bar shows a Tilt or Camera item only when declared.
 *
 * TILT, in milli-g (x > 0 tilted left, y > 0 toward the top), summed from:
 *   - keys I J K L (and the numpad's 8 4 6 2), easing to 600 milli-g, the ABI's suggestion;
 *   - a gamepad's right stick (the left stick stays the D-pad);
 *   - the mouse or a finger: press on the game screen and drag, like a stick, 600 milli-g at
 *     a quarter of the screen;
 *   - on a phone, the phone itself (DeviceOrientation), after the browser's own permission
 *     prompt where it has one, from the bar's Tilt menu; "Level here" sets the rest position.
 *
 * CAMERA. Off (the core's own test card) until the player chooses a camera in the bar's
 * Camera menu; then the browser asks its own permission. Each time the core wants a picture,
 * the current video frame is cropped to 8:7 around its centre, scaled to 128 x 112 and turned
 * to grey (0.299 R + 0.587 G + 0.114 B), and handed to the core. A picture the player picks
 * from this device goes the same way. The stream stops (the camera light goes off) when the
 * player stops it, the window closes or the tab is hidden; a camera stopped by a hidden tab
 * comes back on when the tab shows again (2026-10-23).
 * PRIVACY: frames stay in this window, in one 14,336-byte buffer handed to the core. They are
 * never uploaded, stored, logged or sent anywhere; the log says only which source is on.
 */
const TILT_MAX = 600;          // milli-g, full deflection
const TILT_KEYS = { KeyJ: [1, 0], Numpad4: [1, 0], KeyL: [-1, 0], Numpad6: [-1, 0], KeyI: [0, 1], Numpad8: [0, 1], KeyK: [0, -1], Numpad2: [0, -1] };

export class Tilt {
  constructor({ core, screen, log }) {
    this.core = core; this.screen = screen; this.log = log || (() => {});
    this.held = new Set(); this.ease = [0, 0]; this.drag = null; this.motion = null; this.rest = null;
    this.sent = [NaN, NaN]; this.last = performance.now();
    this._kd = e => { if (TILT_KEYS[e.code] && !e.ctrlKey && !e.metaKey && !e.altKey) { this.held.add(e.code); e.preventDefault(); } };
    this._ku = e => { if (TILT_KEYS[e.code]) this.held.delete(e.code); };
    this._blur = () => { this.held.clear(); this.drag = null; };
    addEventListener('keydown', this._kd); addEventListener('keyup', this._ku); addEventListener('blur', this._blur);
    this._pd = e => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const r = this.screen.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
      this.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, span: Math.max(40, Math.min(r.width, r.height) / 4) };
    };
    this._pm = e => { if (this.drag && e.pointerId === this.drag.id) { this.drag.x = e.clientX; this.drag.y = e.clientY; } };
    this._pu = e => { if (this.drag && e.pointerId === this.drag.id) this.drag = null; };
    addEventListener('pointerdown', this._pd, true); addEventListener('pointermove', this._pm, true);
    addEventListener('pointerup', this._pu, true); addEventListener('pointercancel', this._pu, true);
    this._or = e => { if (e.beta == null || e.gamma == null) return; this.motion = { beta: e.beta, gamma: e.gamma }; if (!this.rest) this.rest = { beta: e.beta, gamma: e.gamma }; };
  }
  /** Is there a phone-motion source to offer? */
  motionAvailable() { return typeof window.DeviceOrientationEvent === 'function' && (navigator.maxTouchPoints || 0) > 0; }
  /** From a press (the bar's menu): the browser's permission where it asks, then listen. */
  async motionOn() {
    try {
      const D = window.DeviceOrientationEvent;
      if (D && typeof D.requestPermission === 'function') { const r = await D.requestPermission(); if (r !== 'granted') { this.log('tilt: the phone\'s motion was not allowed'); return false; } }
      this.rest = null; addEventListener('deviceorientation', this._or);
      this.motionUsed = true; this.log('tilt: the phone\'s motion is on');
      return true;
    } catch (_) { return false; }
  }
  motionOff() { removeEventListener('deviceorientation', this._or); this.motionUsed = false; this.motion = null; this.rest = null; this.log('tilt: the phone\'s motion is off'); }
  level() { this.rest = this.motion ? { beta: this.motion.beta, gamma: this.motion.gamma } : null; this.ease = [0, 0]; }
  /** Once per emulated frame (or paint): the summed tilt to the core, when it changed. */
  frame() {
    const now = performance.now(), dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    // Keys ease in and out over about a quarter of a second.
    let kx = 0, ky = 0; for (const c of this.held) { kx += TILT_KEYS[c][0]; ky += TILT_KEYS[c][1]; }
    kx = Math.max(-1, Math.min(1, kx)); ky = Math.max(-1, Math.min(1, ky));
    const k = Math.min(1, dt * 4);
    this.ease[0] += (kx - this.ease[0]) * k; this.ease[1] += (ky - this.ease[1]) * k;
    let x = this.ease[0], y = this.ease[1];
    // The right stick.
    try {
      for (const p of (navigator.getGamepads ? navigator.getGamepads() : [])) {
        if (!p || !p.connected || p.axes.length < 4) continue;
        const ax = p.axes[2], ay = p.axes[3], dz = 0.15;
        if (Math.abs(ax) > dz) x += -ax;            // stick right = tilted right = negative x
        if (Math.abs(ay) > dz) y += -ay;            // stick up (negative) = toward the top
      }
    } catch (_) {}
    if (this.drag) { x += -(this.drag.x - this.drag.x0) / this.drag.span; y += -(this.drag.y - this.drag.y0) / this.drag.span; }
    if (this.motion && this.rest) {
      const g = (this.motion.gamma - this.rest.gamma) * Math.PI / 180, b = (this.motion.beta - this.rest.beta) * Math.PI / 180;
      x += -Math.sin(g) * 1000 / TILT_MAX; y += -Math.sin(b) * 1000 / TILT_MAX;
    }
    const mx = Math.round(Math.max(-1, Math.min(1, x)) * TILT_MAX), my = Math.round(Math.max(-1, Math.min(1, y)) * TILT_MAX);
    if (mx !== this.sent[0] || my !== this.sent[1]) { this.sent = [mx, my]; try { this.core().ext.tilt.set(mx, my); } catch (_) {} }
    return this.sent;
  }
  /** The bar's Tilt menu. */
  menu() {
    const items = [{ id: 'keys', label: 'Keys I J K L, right stick, or drag on the screen', checked: true, info: true }];
    if (this.motionAvailable()) items.push({ id: 'motion', label: 'Tilt the phone itself', checked: !!this.motionUsed });
    items.push({ id: 'level', label: 'Level here (this is flat)' });
    return items;
  }
  async choose(id) {
    if (id === 'motion') { if (this.motionUsed) this.motionOff(); else await this.motionOn(); }
    else if (id === 'level') this.level();
  }
  label() { return 'Tilt'; }
  state() { return 'on'; }               // the sensor always reads the keys, the stick and a drag
  destroy() {
    removeEventListener('keydown', this._kd); removeEventListener('keyup', this._ku); removeEventListener('blur', this._blur);
    removeEventListener('pointerdown', this._pd, true); removeEventListener('pointermove', this._pm, true);
    removeEventListener('pointerup', this._pu, true); removeEventListener('pointercancel', this._pu, true);
    this.motionOff();
  }
}

export class Camera {
  constructor({ core, log, toast, changed }) {
    this.core = core; this.log = log || (() => {}); this.toast = toast || (() => {}); this.changed = changed || (() => {});
    this.mode = 'card';        // 'card' (the core's test card) | 'live' | 'paused' | 'still'
    this.facing = null; this.stream = null; this.video = null; this.still = null; this.pulls = 0;
    const s = core().ext.camera.size || { width: 128, height: 112 };
    this.W = s.width; this.H = s.height;
    this.cv = document.createElement('canvas'); this.cv.width = this.W; this.cv.height = this.H;
    this.ctx = this.cv.getContext('2d', { willReadFrequently: true });
    this.grey = new Uint8Array(this.W * this.H);
    /* Back on when the player returns (2026-10-23): a camera that was on when the tab or
       app was hidden is remembered (which one, and whether paused) and opened again when it shows. */
    this.resumeTo = null;
    this._keep = () => { if (this.stream && (this.mode === 'live' || this.mode === 'paused')) this.resumeTo = { facing: this.facing, paused: this.mode === 'paused' }; };
    this._vis = () => {
      if (document.hidden && this.stream) { this._keep(); this.stop(); this.log('camera: stopped, the tab was hidden'); this.changed(); }
      else if (!document.hidden) this.resume();
    };
    document.addEventListener('visibilitychange', this._vis);
    this._hide = () => { this._keep(); this.stop(); };
    addEventListener('pagehide', this._hide);
    this._show = () => { if (!document.hidden) this.resume(); };
    addEventListener('pageshow', this._show);
  }
  async resume() {
    const r = this.resumeTo; this.resumeTo = null;
    if (!r || this.mode !== 'card') return false;
    const ok = await this.start(r.facing || 'user');
    if (ok && r.paused) this.pause(true);
    if (ok) this.log('camera: back on, the tab was shown again');
    this.changed();                                   // the bar's Camera item says what is on
    return ok;
  }
  async start(facing) {
    this.stopStream();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { this.toast('This browser has no camera access here.', true); return false; }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    } catch (e) {
      this.stream = null; this.mode = 'card'; this.core().ext.camera.off();
      this.toast(e && e.name === 'NotAllowedError' ? 'The camera was not allowed. The cartridge sees its test card.' : 'No camera could be opened. The cartridge sees its test card.', true);
      this.log('camera: not opened (' + ((e && e.name) || 'error') + ')');
      return false;
    }
    const v = this.video = document.createElement('video');
    v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.srcObject = this.stream;
    try { await v.play(); } catch (_) {}
    this.mode = 'live'; this.facing = facing;
    this.log(`camera: on (${facing === 'environment' ? 'back' : 'front'})`);
    return true;
  }
  stopStream() {
    if (this.stream) { for (const t of this.stream.getTracks()) { try { t.stop(); } catch (_) {} } }
    this.stream = null;
    if (this.video) { try { this.video.srcObject = null; } catch (_) {} this.video = null; }
  }
  stop() {
    const was = this.mode;
    this.stopStream(); this.still = null; this.mode = 'card'; this.facing = null;
    try { this.core().ext.camera.off(); } catch (_) {}
    if (was !== 'card') this.log('camera: off (test card)');
  }
  pause(on) { if (this.mode === 'live' && on) this.mode = 'paused'; else if (this.mode === 'paused' && !on) this.mode = 'live'; }
  /** A picture from this device, through the same pull path. */
  pickStill() {
    return new Promise(res => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = () => {
        const f = inp.files && inp.files[0]; if (!f) return res(false);
        const url = URL.createObjectURL(f), im = new Image();
        im.onload = () => { this.stopStream(); this.still = im; this.mode = 'still'; this.log('camera: a picture from this device'); URL.revokeObjectURL(url); res(true); };
        im.onerror = () => { URL.revokeObjectURL(url); this.toast('That file is not a picture this browser can read.', true); res(false); };
        im.src = url;
      };
      inp.click();
    });
  }
  /** Once per emulated frame: a fresh picture when the core asks for one. */
  frame() {
    const cam = this.core().ext.camera;
    if (this.mode !== 'live' && this.mode !== 'still') return;
    if (cam.wants() <= 0) return;
    const src = this.mode === 'live' ? this.video : this.still;
    const sw = src && (src.videoWidth || src.naturalWidth), sh = src && (src.videoHeight || src.naturalHeight);
    if (!sw || !sh) return;
    // Crop to the sensor's 8:7 around the centre, then scale.
    const ar = this.W / this.H;
    let cw = sw, ch = sw / ar; if (ch > sh) { ch = sh; cw = sh * ar; }
    const cx = (sw - cw) / 2, cy = (sh - ch) / 2;
    // The front camera is shown mirrored, as a selfie view is.
    this.ctx.save();
    if (this.mode === 'live' && this.facing === 'user') { this.ctx.translate(this.W, 0); this.ctx.scale(-1, 1); }
    this.ctx.drawImage(src, cx, cy, cw, ch, 0, 0, this.W, this.H);
    this.ctx.restore();
    const d = this.ctx.getImageData(0, 0, this.W, this.H).data, g = this.grey;
    for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] + 0.5) | 0;
    if (cam.frame(g)) this.pulls++;
  }
  menu() {
    const m = this.mode, phone = (navigator.maxTouchPoints || 0) > 0;
    const items = [{ id: 'card', label: 'Off (the cartridge’s test card)', checked: m === 'card' }];
    if (phone) {
      items.push({ id: 'user', label: 'Front camera', checked: (m === 'live' || m === 'paused') && this.facing === 'user' });
      items.push({ id: 'environment', label: 'Back camera', checked: (m === 'live' || m === 'paused') && this.facing === 'environment' });
    } else items.push({ id: 'user', label: 'This computer’s camera', checked: m === 'live' || m === 'paused' });
    items.push({ id: 'still', label: 'A picture from this device…', checked: m === 'still' });
    if (m === 'live') items.push({ id: 'pause', label: 'Pause the camera (hold this picture)' });
    if (m === 'paused') items.push({ id: 'resume', label: 'Resume the camera' });
    return items;
  }
  async choose(id) {
    this.resumeTo = null;
    if (id === 'card') this.stop();
    else if (id === 'user' || id === 'environment') await this.start(id);
    else if (id === 'still') await this.pickStill();
    else if (id === 'pause') this.pause(true);
    else if (id === 'resume') this.pause(false);
  }
  /* Off is the cartridge's test card (2026-10-15: say so plainly on the bar). */
  label() { return this.mode === 'live' ? 'Camera on' : this.mode === 'paused' ? 'Camera paused' : this.mode === 'still' ? 'Camera: picture' : 'Camera off'; }
  state() { return this.mode === 'card' ? 'off' : this.mode === 'paused' ? 'paused' : 'on'; }
  destroy() { this.resumeTo = null; this.stop(); document.removeEventListener('visibilitychange', this._vis); removeEventListener('pagehide', this._hide); removeEventListener('pageshow', this._show); }
}

/* MICROPHONE (the Famicom's controller II microphone, and any core that declares 'microphone'):
   off until the player turns it on in the bar's Microphone menu (the browser then asks its own
   permission). While on, the sound level is read in this window, and a voice louder than the
   room holds the console's microphone control down; the M key does the same at any time.
   PRIVACY: nothing is recorded, kept, uploaded or logged; only a level is read, then dropped. */
export class Microphone {
  constructor({ press, log, toast }) {
    this.press = press; this.log = log || (() => {}); this.toast = toast || (() => {});
    this.mode = 'off'; this.stream = null; this.ctx = null; this.an = null; this.buf = null; this.on = false; this.floor = 0.02;
    this._vis = () => { if (document.hidden && this.stream) { this.stop(); this.log('microphone: stopped, the tab was hidden'); } };
    document.addEventListener('visibilitychange', this._vis);
    this._hide = () => this.stop(); addEventListener('pagehide', this._hide);
  }
  async start() {
    this.stop(true);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { this.toast('This browser has no microphone access here.', true); return false; }
    try { this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false }, video: false }); }
    catch (e) { this.stream = null; this.toast(e && e.name === 'NotAllowedError' ? 'The microphone was not allowed. Hold M to blow or shout instead.' : 'No microphone could be opened. Hold M instead.', true); this.log('microphone: not opened (' + ((e && e.name) || 'error') + ')'); return false; }
    const C = window.AudioContext || window.webkitAudioContext;
    this.ctx = new C(); try { await this.ctx.resume(); } catch (_) {}
    this.an = this.ctx.createAnalyser(); this.an.fftSize = 1024; this.buf = new Float32Array(this.an.fftSize);
    this.ctx.createMediaStreamSource(this.stream).connect(this.an);   // to the analyser only: never to the speakers
    this.mode = 'on'; this.log('microphone: on');
    return true;
  }
  stop(quiet) {
    if (this.stream) for (const t of this.stream.getTracks()) { try { t.stop(); } catch (_) {} }
    this.stream = null;
    if (this.ctx) { try { this.ctx.close(); } catch (_) {} this.ctx = null; }
    this.an = null;
    if (this.on) { this.on = false; try { this.press(false); } catch (_) {} }
    const was = this.mode; this.mode = 'off';
    if (!quiet && was !== 'off') this.log('microphone: off');
  }
  /** Once per emulated frame: the level, with a little hysteresis, to the microphone control. */
  frame() {
    if (this.mode !== 'on' || !this.an) return;
    this.an.getFloatTimeDomainData(this.buf);
    let s = 0; for (let i = 0; i < this.buf.length; i++) s += this.buf[i] * this.buf[i];
    const rms = Math.sqrt(s / this.buf.length);
    if (!this.on) this.floor = this.floor * 0.995 + Math.min(rms, 0.1) * 0.005;   // the room's own level, slowly
    const want = this.on ? rms > this.floor * 2 + 0.02 : rms > this.floor * 3 + 0.04;
    if (want !== this.on) { this.on = want; try { this.press(want); } catch (_) {} }
  }
  menu() {
    return [
      { id: 'off', label: 'Off (hold M to blow or shout)', checked: this.mode === 'off' },
      { id: 'on', label: 'This device\u2019s microphone', checked: this.mode === 'on' },
    ];
  }
  async choose(id) { if (id === 'off') this.stop(); else if (id === 'on') await this.start(); }
  label() { return this.mode === 'on' ? 'Microphone on' : 'Microphone off'; }
  state() { return this.mode === 'on' ? 'on' : 'off'; }
  destroy() { this.stop(true); document.removeEventListener('visibilitychange', this._vis); removeEventListener('pagehide', this._hide); }
}

/* POWER PAD / FAMILY TRAINER (2026-10-15, from the old NES page's touch panel): a 3 x 4 grid of
   the mat's twelve pads on the screen, for a finger or the mouse, beside the keys the core maps.
   Any port of device 'mat' gets it; each pad presses that port's control the way a touch
   overlay button does (input.touchSend with the control's own key). Shown from the bar's
   Power Pad item; several pads can be held at once (several fingers). */
/* The same panel serves every accessory that declares `panel` on its port
   ({ cols, title, cursor }): the Party Tap's buzzers, the punching bag, the mahjong keypad, the mole mat,
   the Hyper Shot's buttons, the right hand of two pads, the Miracle Piano's keys. `cursor()` names the
   button a controller has chosen (the mahjong keypad), which is highlighted. */
export class MatPanel {
  constructor({ input, port, stage, log, cursor }) {
    this.input = input; this.port = port; this.stage = stage; this.log = log || (() => {});
    this.cursor = cursor || null; this.cur = -1;
    this.shown = false; this.held = new Map();
    const pn = port.panel || null, title = pn ? pn.title || port.label : 'Power Pad';
    this.title = title;
    const el = this.el = document.createElement('div');
    el.className = 'host-mat' + (pn ? ' host-mat-panel' : ''); el.hidden = true;
    el.setAttribute('aria-label', title);
    if (pn && pn.cols) el.style.gridTemplateColumns = `repeat(${pn.cols},1fr)`;
    const btns = pn ? port.controls.filter(c => c.type === 'button') : port.controls.slice(0, 12);
    el.innerHTML = btns.map((c, i) => `<button type="button" class="host-mat-pad" data-i="${port.controls.indexOf(c)}" aria-label="${pn ? c.label : 'Pad ' + c.label}">${c.short || c.label}</button>`).join('');
    if (!document.getElementById('host-mat-css')) {
      const st = document.createElement('style'); st.id = 'host-mat-css';
      st.textContent = `.host-mat{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);z-index:70;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;width:min(92%,520px);padding:10px;border-radius:14px;background:rgba(16,18,22,.86);border:1px solid var(--line);touch-action:none;user-select:none}
.host-mat[hidden]{display:none}
.host-mat-pad{aspect-ratio:1.4;border-radius:50%;border:2px solid var(--dim);background:rgba(255,255,255,.06);color:var(--ink);font:700 18px/1 ui-sans-serif,system-ui,sans-serif;touch-action:none}
.host-mat-pad.down{background:rgba(var(--cw-bar-accent-rgb,155,225,93),.35);border-color:var(--cw-bar-accent,#9be15d)}
.host-mat-panel{width:min(96%,640px);gap:6px}
.host-mat-panel .host-mat-pad{aspect-ratio:auto;min-height:44px;border-radius:12px;font-size:14px;padding:4px 2px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.host-mat-pad.cur{outline:3px solid var(--cw-bar-accent,#9be15d);outline-offset:1px}`;
      document.head.appendChild(st);
    }
    stage.appendChild(el);
    const keyOf = i => { const c = port.controls[i]; return c && c.defaults && c.defaults.key && c.defaults.key[0]; };
    const set = (i, down) => { const k = keyOf(i); if (k) this.input.touchSend(k, down); const b = el.querySelector(`[data-i="${i}"]`); if (b) b.classList.toggle('down', down); };
    const at = e => { const t = document.elementFromPoint(e.clientX, e.clientY); return t && t.closest ? t.closest('.host-mat-pad') : null; };
    el.addEventListener('pointerdown', e => { const b = at(e); if (!b) return; e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (_) {} const i = +b.dataset.i; this.held.set(e.pointerId, i); set(i, true); });
    el.addEventListener('pointermove', e => { if (!this.held.has(e.pointerId)) return; const b = at(e), was = this.held.get(e.pointerId), now = b ? +b.dataset.i : -1; if (now !== was) { if (was >= 0) set(was, false); if (now >= 0) set(now, true); this.held.set(e.pointerId, now); } });
    const up = e => { if (!this.held.has(e.pointerId)) return; const i = this.held.get(e.pointerId); this.held.delete(e.pointerId); if (i >= 0 && ![...this.held.values()].includes(i)) set(i, false); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
  }
  show(on) { this.shown = !!on; this.el.hidden = !this.shown; if (!this.shown) for (const [, i] of this.held) if (i >= 0) { const k = this.port.controls[i].defaults.key[0]; this.input.touchSend(k, false); } if (!this.shown) this.held.clear(); }
  frame() {
    if (!this.cursor) return;
    let i = -1; try { i = this.cursor(); } catch (_) {}
    if (i === this.cur) return;
    const old = this.el.querySelector('.host-mat-pad.cur'); if (old) old.classList.remove('cur');
    const b = i >= 0 ? this.el.querySelector(`[data-i="${i}"]`) : null; if (b) b.classList.add('cur');
    this.cur = i;
  }
  menu() { const what = this.port.panel ? 'buttons' : 'mat'; return [{ id: 'show', label: `Show the ${what} on the screen`, checked: this.shown }, { id: 'hide', label: 'Hide it (the keys still work)', checked: !this.shown }]; }
  choose(id) { this.show(id === 'show'); this.log(`${this.title} panel ${this.shown ? 'shown' : 'hidden'}`); }
  label() { return this.title; }
  state() { return null; }               // hidden is not off: the keys still press the mat
  destroy() { this.show(false); this.el.remove(); }
}

/* THE STUDY BOX TAPE (2026-10-15, from the old NES page's deck): a core with extension 'tape'
   (core.ext.tape: status, insert(source), eject) gets a Tape item. Its menu lists the tapes on
   the player's game servers (asked through the site, which reads them a few seconds ahead with
   HTTP Range: a tape is 150 to 180 MB and is never copied whole) and the tapes chosen from this
   device this visit, and offers "Choose a tape file…" and Eject. Key Y ejects or inserts. The
   tape's sound plays through the console's own audio. */
import * as LF from './local-files.mjs?v=2.1.0';
export const TAPE_EXT = /\.(study|studybox)$/i;
const tapeTidy = n => String(n).replace(TAPE_EXT, '').replace(/\s*\((Japan|Unl)\)/g, '');
/* TAPES REMEMBERED ON THIS DEVICE (2026-10-19; the old NES page's 'tape:handles'): a tape
   chosen with a picker that gives a file handle (showOpenFilePicker) is kept as that handle, never
   the file, in play/host/local-files.mjs, and listed in the Tape menu next visit; choosing it asks
   the browser for the file again (it may ask the player once). A browser without such a picker
   (phones, the TV) chooses the tape again, as before. "Forget the tapes kept here" removes them. */
export class Tape {
  constructor({ core, log, toast, sys, changed }) {
    this.core = core; this.log = log || (() => {}); this.toast = toast || (() => {});
    this.sys = sys || 'nes'; this.changed = changed || (() => {});
    this.shelf = []; this.sel = -1; this.rid = 0;
    this.ask(); this.loadKept();
    this._key = e => { if (e.code !== 'KeyY' || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return; e.preventDefault(); this.toggle(); };
    addEventListener('keydown', this._key);
  }
  t() { return this.core().ext.tape; }
  /* The site's list of tapes on the player's game servers (index.html nesNeedTapes). */
  ask() {
    if (window.parent === window) return;
    const onMsg = e => { const d = e.data; if (!d || !Array.isArray(d.nesTapes)) return; removeEventListener('message', onMsg);
      for (const t of d.nesTapes) if (t && t.id && t.name && !this.shelf.some(x => x.name === t.name)) this.shelf.push({ name: t.name, server: t }); };
    addEventListener('message', onMsg);
    try { window.parent.postMessage({ nesNeedTapes: true }, '*'); } catch (_) {}
    setTimeout(() => removeEventListener('message', onMsg), 15000);
  }
  serverSource(t) {
    return { name: t.name, size: t.size, read: (off, len) => new Promise((res, rej) => {
      const rid = ++this.rid;
      const onMsg = e => { const d = e.data; if (!d || d.nesTapeData !== rid) return; removeEventListener('message', onMsg); if (d.bytes) res(new Uint8Array(d.bytes)); else rej(new Error('The game server did not send that part of the tape.')); };
      addEventListener('message', onMsg);
      try { window.parent.postMessage({ nesTapeRead: { id: t.id, off, len, rid } }, '*'); } catch (_) { rej(new Error('No site to ask.')); }
      setTimeout(() => { removeEventListener('message', onMsg); rej(new Error('The game server took too long to send the tape.')); }, 30000);
    }) };
  }
  async loadKept() {
    let kept = []; try { kept = await LF.tapeHandles(this.sys); } catch (_) {}
    for (const k of kept) { const t = this.shelf.find(x => x.name === k.name && !x.server); if (t) t.handle = k.handle; else this.shelf.push({ name: k.name, handle: k.handle }); }
    if (kept.length) { this.log(`tape: ${kept.length} kept on this device`); this.changed(); }
  }
  fileSource(f) { return { name: f.name, size: f.size, read: async (o, l) => { const e = Math.min(f.size, o + l); return e <= o ? new Uint8Array(0) : new Uint8Array(await f.slice(o, e).arrayBuffer()); } }; }
  async insert(i) {
    const e = this.shelf[i]; if (!e) return;
    try {
      if (!e.server && !e.file && e.handle) e.file = await LF.fileFromHandle(e.handle);
      const idx = await this.t().insert(e.server ? this.serverSource(e.server) : this.fileSource(e.file));
      this.sel = i;
      this.toast(`Tape in: ${tapeTidy(e.name)} (${idx.pages} pages). Choose a page with the pad and press A.`);
      this.log('tape: in (' + (e.server ? 'game server' : 'this device') + ')');
    } catch (ex) { this.toast(String((ex && ex.message) || ex), true); }
  }
  /** A tape file from this device (the menu's picker, the player's Open picker or a drop): on the
      shelf, kept when a handle came with it, and in the deck. */
  async addFile(f, handle = null) {
    if (!f || !TAPE_EXT.test(f.name)) { this.toast('That is not a Study Box tape (.study or .studybox).', true); return false; }
    let i = this.shelf.findIndex(t => t.name === f.name && !t.server);
    if (i < 0) { this.shelf.push({ name: f.name, file: f, handle }); i = this.shelf.length - 1; }
    else { this.shelf[i].file = f; if (handle) this.shelf[i].handle = handle; }
    if (handle) { try { await LF.rememberTape(this.sys, handle, f.size); this.log('tape: kept on this device (the file stays where it is)'); } catch (_) {} }
    await this.insert(i); this.changed(); return true;
  }
  async pick() {
    if (LF.canKeepHandles()) {
      try {
        const [h] = await window.showOpenFilePicker({ types: [{ description: 'Study Box tape', accept: { 'application/octet-stream': ['.study', '.studybox'] } }] });
        if (!h) return false;
        return this.addFile(await h.getFile(), h);
      } catch (ex) { if (ex && ex.name === 'AbortError') return false; /* any other refusal: the plain picker below */ }
    }
    return new Promise(res => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.study,.studybox';
      inp.onchange = async () => { const f = inp.files && inp.files[0]; res(f ? await this.addFile(f) : false); };
      inp.click();
    });
  }
  async forget() {
    try { await LF.forgetTapes(this.sys); } catch (_) {}
    const cur = this.shelf[this.sel] || null;
    for (const t of this.shelf) delete t.handle;
    this.shelf = this.shelf.filter(t => t.server || t.file);
    this.sel = cur ? this.shelf.indexOf(cur) : -1;
    this.toast('The tapes kept on this device are forgotten. The tape files themselves are untouched.');
    this.log('tape: kept tapes forgotten'); this.changed();
  }
  toggle() { const s = this.t().status(); if (s && s.present) { this.t().eject(); this.log('tape: out'); } else if (this.sel >= 0) this.insert(this.sel); else this.pick(); }
  frame() {}
  menu() {
    const s = this.t().status(), present = !!(s && s.present);
    const items = this.shelf.map((t, i) => ({ id: 'i' + i, label: tapeTidy(t.name) + (t.server ? ' (game server)' : t.handle && !t.file ? ' (kept on this device)' : ''), checked: present && i === this.sel }));
    items.push({ id: 'pick', label: 'Choose a tape file\u2026' });
    if (present) items.push({ id: 'eject', label: 'Eject' });
    if (this.shelf.some(t => t.handle)) items.push({ id: 'forget', label: 'Forget the tapes kept here' });
    return items;
  }
  async choose(id) { if (id === 'pick') await this.pick(); else if (id === 'forget') await this.forget(); else if (id === 'eject') { this.t().eject(); this.log('tape: out'); } else if (/^i\d+$/.test(id)) await this.insert(+id.slice(1)); }
  label() { const s = this.t().status(); return s && s.present ? `Tape: page ${s.page + 1} of ${s.pages}${s.motor ? ', playing' : ''}` : 'No tape'; }
  state() { const s = this.t().status(); return s && s.present ? 'on' : 'off'; }
  destroy() { removeEventListener('keydown', this._key); }
}

/* THE FAMICOM DATA RECORDER (2026-10-18): a core with extension
   'recorder' (core.ext.recorder: status, load, loadPcm, play, stop, record, rewind, eject,
   recording, wav) gets a Data Recorder item, shown only for the titles that use the deck (Family
   BASIC, and the games that save to tape through the keyboard). Its menu is the deck's buttons:
   Play, Stop, Record onto a new blank tape, Rewind, Eject, Load a tape file (a WAV recording), and
   for what was recorded: keep it on this device (the common save envelope, in the host's store) or
   save it as a WAV file, the same format the dumps come in, so it loads back. Tapes kept on this
   device are listed in the menu, so the whole round trip works with a controller alone. The deck's
   jacks are on the keyboard: a game whose keyboard is not plugged in offers to plug it in. No
   hover: every control is a menu item, the status is the item's own label. */
const tapeName = n => String(n || '').replace(/\.wav$/i, '');
const mmss = s => { s = Math.max(0, Math.floor(+s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
export class DataRecorder {
  /* plug(on) plugs the keyboard in or out (the host's option); shelf { list, put, get, del };
     changed() repaints the bar; title() names a saved file. */
  constructor({ core, log, toast, plug, shelf, changed, title }) {
    this.core = core; this.log = log || (() => {}); this.toast = toast || (() => {});
    this.plug = plug || (async () => {}); this.shelf = shelf || null; this.changed = changed || (() => {}); this.title = title || (() => 'Tape');
    this.kept = []; this.take = null; this.wasRec = false; this.last = ''; this.n = 0; this.from = null;
    this.cassettes = []; this.casFrom = null;
    this.refreshShelf();
    this.askCassettes();
  }
  /* THE CASSETTE SHELF (2026-10-22): the .wav tapes on the player's game servers'
     cassette shelf, through the site's relay ({ cwNeed: 'cassettes' } and { cwNeed: 'cassette' },
     play/host/site-relay.js). Nothing is fetched until one is chosen. */
  relayAsk(msg, ms) {
    if (window.parent === window) return Promise.resolve(null);
    const n = 'cas' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    return new Promise(res => {
      const onMsg = e => { if (e.source !== window.parent || !e.data || e.data.cwFile !== n) return; removeEventListener('message', onMsg); res(e.data); };
      addEventListener('message', onMsg);
      try { window.parent.postMessage(Object.assign({ n }, msg), '*'); } catch (_) { removeEventListener('message', onMsg); res(null); }
      setTimeout(() => { removeEventListener('message', onMsg); res(null); }, ms);
    });
  }
  async askCassettes() {
    const d = await this.relayAsk({ cwNeed: 'cassettes', sys: 'nes', format: 'wav' }, 10000);
    this.cassettes = d && Array.isArray(d.list) ? d.list.slice(0, 20) : [];
    if (this.cassettes.length) { this.log(`data recorder: ${this.cassettes.length} tapes on the cassette shelf`); this.changed(); }
  }
  async fromCassette(i) {
    const c = this.cassettes[i]; if (!c) return;
    this.toast(`Fetching ${tapeName(c.name)} from the cassette shelf…`);
    const d = await this.relayAsk({ cwNeed: 'cassette', sys: 'nes', id: c.id }, 120000);
    if (!d || !d.b64) { this.toast('That tape could not be fetched from the game server.', true); return; }
    const bin = atob(d.b64), u = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
    const t = this.r().load(u, tapeName(c.name)); this.from = null; this.casFrom = c.id; this.loaded(t, c.name);
  }
  r() { return this.core().ext.recorder; }
  st() { try { return this.r().status(); } catch (_) { return null; } }
  async refreshShelf() { if (!this.shelf) return; try { this.kept = await this.shelf.list(); } catch (_) { this.kept = []; } this.changed(); }
  /* What RECORD made, taken off the deck when it stops (Stop, or the blank tape full). */
  takeNow() {
    let rec = null; try { rec = this.r().recording(); } catch (_) {}
    this.wasRec = false;
    if (!rec || !rec.pcm.length) return;
    this.take = { pcm: rec.pcm, rate: rec.rate, at: Date.now(), kept: false };
    this.log(`data recorder: recorded ${(rec.pcm.length / rec.rate).toFixed(1)} s`);
    this.toast(`Recorded ${mmss(rec.pcm.length / rec.rate)}. Keep it on this device or save it as a file from the Data Recorder menu.`);
  }
  frame() {
    if (++this.n % 15) return;                       // four times a second is enough for a clock
    const s = this.st(); if (!s) return;
    if (this.wasRec && s.mode !== 'record') this.takeNow();
    const l = this.label(); if (l !== this.last) { this.last = l; this.changed(); }
  }
  loaded(t, name) {
    this.toast(`Tape in: ${tapeName(name)} (${mmss(t.seconds)}). Start the game's LOAD (in BASIC: type LOAD and press Return), then choose Play.`);
    this.log('data recorder: tape in');
  }
  pick() {
    return new Promise(res => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.wav,audio/wav,audio/x-wav';
      inp.onchange = async () => {
        const f = inp.files && inp.files[0]; if (!f) return res(false);
        try { const t = this.r().load(new Uint8Array(await f.arrayBuffer()), tapeName(f.name)); this.from = null; this.loaded(t, f.name); res(true); }
        catch (e) { this.toast(String((e && e.message) || e), true); res(false); }
        this.changed();
      };
      inp.click();
    });
  }
  fileName() {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return `${String(this.title() || 'Tape').replace(/[\\/:*?"<>|]+/g, ' ').trim()} tape ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}`;
  }
  async keep() {
    if (!this.take || !this.shelf) return;
    const name = this.fileName();
    try { await this.shelf.put(name, this.take.pcm, this.take.rate); this.take.kept = true; this.toast(`Kept on this device: ${name}.`); this.log('data recorder: recording kept'); }
    catch (e) { this.toast('The recording could not be kept on this device.', true); this.log('data recorder: keep failed: ' + ((e && e.message) || e)); }
    await this.refreshShelf();
  }
  download() {
    if (!this.take) return;
    const bytes = this.r().wav(this.take.pcm, this.take.rate), name = this.fileName() + '.wav';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    this.toast(`Saved as a file: ${name}`); this.log('data recorder: recording saved as a file');
  }
  async fromShelf(i) {
    const k = this.kept[i]; if (!k || !this.shelf) return;
    try { const t = await this.shelf.get(k.id); const r = this.r().loadPcm(t.pcm, t.rate, k.name); this.from = k.id; this.loaded(r, k.name); }
    catch (e) { this.toast('That kept tape could not be read.', true); this.log('data recorder: kept tape unreadable: ' + ((e && e.message) || e)); }
  }
  menu() {
    const s = this.st();
    if (!s) return [{ id: 'none', label: 'The Data Recorder is not available.', info: true }];
    if (!s.keyboard) return [{ id: 'why', label: 'The Data Recorder plugs into the Family BASIC keyboard.', info: true },
      { id: 'plug', label: 'Plug in the keyboard and Data Recorder' }];
    const items = [{ id: 'now', label: this.label(), info: true }];
    if (s.mode === 'record') items.push({ id: 'stop', label: 'Stop recording' });
    else if (s.mode === 'play') items.push({ id: 'stop', label: 'Stop' });
    else if (s.tape) items.push({ id: 'play', label: 'Play' });
    if (s.mode !== 'record') items.push({ id: 'record', label: 'Record onto a new blank tape' });
    if (s.tape && s.mode !== 'record') items.push({ id: 'rewind', label: 'Rewind to the start' });
    if (this.take && s.mode !== 'record') {
      if (this.shelf && !this.take.kept) items.push({ id: 'keep', label: `Keep the recording on this device (${mmss(this.take.pcm.length / this.take.rate)})` });
      items.push({ id: 'download', label: 'Save the recording as a file (.wav)' });
    }
    items.push({ id: 'pick', label: 'Load a tape file…' });
    this.kept.slice(0, 8).forEach((k, i) => items.push({ id: 'k' + i, label: `Kept tape: ${k.name} (${mmss(k.seconds)})`, checked: !!s.tape && this.from === k.id }));
    this.cassettes.forEach((c, i) => items.push({ id: 'c' + i, label: `Cassette shelf: ${tapeName(c.name)}`, checked: !!s.tape && this.casFrom === c.id }));
    if (s.tape && this.from && this.shelf) items.push({ id: 'forget', label: 'Remove this kept tape from this device' });
    if (s.tape) items.push({ id: 'eject', label: 'Eject the tape' });
    if (!s.builtIn) items.push({ id: 'unplug', label: 'Unplug the keyboard' });
    return items;
  }
  async choose(id) {
    const R = this.r();
    try {
      if (id === 'plug' || id === 'unplug') {
        await this.plug(id === 'plug');
        this.toast(id === 'plug' ? 'Keyboard and Data Recorder plugged in. Scroll Lock switches your keys between typing and the controller.' : 'Keyboard unplugged.');
      } else if (id === 'play') {
        if (!R.play()) { const s = this.st(); this.toast(s && s.ended ? 'The tape is at its end. Choose Rewind to the start first.' : 'There is nothing to play.', true); }
      } else if (id === 'stop') { const was = this.st(); R.stop(); if (was && was.mode === 'record') this.takeNow(); }
      else if (id === 'record') {
        if (R.record()) { this.wasRec = true; this.toast(`Recording onto a new blank tape (up to ${mmss((this.st() || {}).blank || 300)}). Start the save in the game (in BASIC: SAVE "NAME" and Return), then choose Stop recording when it is done.`); }
        else this.toast('The deck could not start recording.', true);
      } else if (id === 'rewind') R.rewind();
      else if (id === 'eject') { R.eject(); this.from = null; this.casFrom = null; }
      else if (id === 'pick') await this.pick();
      else if (id === 'keep') await this.keep();
      else if (id === 'download') this.download();
      else if (id === 'forget') { const k = this.from; if (k && this.shelf) { await this.shelf.del(k); this.from = null; await this.refreshShelf(); this.toast('Removed from this device. The tape stays in the deck until you eject it.'); } }
      else if (/^k\d+$/.test(id)) await this.fromShelf(+id.slice(1));
      else if (/^c\d+$/.test(id)) await this.fromCassette(+id.slice(1));
    } catch (e) { this.toast(String((e && e.message) || e), true); }
    this.changed();
  }
  label() {
    const s = this.st();
    if (!s) return 'Data Recorder';
    if (!s.keyboard) return 'Data Recorder off';
    if (s.mode === 'record') return `Recording ${mmss(s.recorded)}`;
    if (s.mode === 'play') return `Tape ${mmss(s.head)} / ${mmss(s.length)}, playing`;
    if (s.tape) return `Tape ${mmss(s.head)} / ${mmss(s.length)}`;
    return 'No tape';
  }
  state() { const s = this.st(); if (!s || !s.keyboard) return 'off'; return s.mode === 'play' || s.mode === 'record' ? 'on' : null; }
  destroy() {}
}


/* THE DATACH BARCODE READER (2026-10-21): a Datach cartridge (core extension
   'barcode': busy(), scan(digits)) gets a Barcode item. Its menu swipes a card: type the 13 (or 8)
   digits printed under the bars, or swipe a random card, or one swiped before on this device.
   The core sends the bars to the game as the reader does; the game decides what the card is.
   Cards swiped are remembered on this device only (a convenience; nothing leaves it). */
const BC_KEY = 'cw-datach-cards';
const bcCheck = d => { let s = 0; for (let i = 0; i < d.length; i++) s += +d[i] * ((d.length - 1 - i) % 2 === 0 ? 3 : 1); return String((10 - s % 10) % 10); };
export class Barcode {
  constructor({ core, log, toast, changed }) {
    this.core = core; this.log = log || (() => {}); this.toast = toast || (() => {}); this.changed = changed || (() => {});
    this.cards = []; try { const v = JSON.parse(localStorage.getItem(BC_KEY) || '[]'); if (Array.isArray(v)) this.cards = v.filter(c => /^\d{8}$|^\d{13}$/.test(c)).slice(0, 8); } catch (_) {}
    this.last = null;
  }
  x() { const c = this.core(); return c && c.ext && c.ext.barcode; }
  known() { const X = this.x(); try { return X && typeof X.cards === 'function' ? X.cards() : []; } catch (_) { return []; } }

  swipe(digits) {
    const s = String(digits || '').replace(/\D/g, '');
    if (!/^(\d{7}|\d{8}|\d{12}|\d{13})$/.test(s)) { this.toast('A barcode has 13 digits (or 8 on a short card).', true); return; }
    const full = s.length === 12 || s.length === 7 ? s + bcCheck(s) : s;
    const X = this.x();
    if (!X || !X.scan(full)) { this.toast('The barcode reader could not take that card.', true); return; }
    this.last = full;
    this.cards = [full, ...this.cards.filter(c => c !== full)].slice(0, 8);
    try { localStorage.setItem(BC_KEY, JSON.stringify(this.cards)); } catch (_) {}
    this.log(`barcode reader: card ${full} swiped`);
    this.toast(`Card ${full} swiped.`);
  }
  menu() {
    const items = [{ id: 'now', label: this.label(), info: true },
      { id: 'type', label: 'Swipe a card: type its barcode…' },
      { id: 'random', label: 'Swipe a random card' }];
    /* 2026-10-24: the cards printed for the game, by name (the Game Boy's Barcode Boy). */
    const known = this.known();
    known.forEach(([n, d], i) => items.push({ id: 'k' + i, label: `Swipe the ${n} card`, checked: d === this.last }));
    this.cards.forEach((c, i) => items.push({ id: 'c' + i, label: `Swipe card ${c} again`, checked: c === this.last }));
    if (this.cards.length) items.push({ id: 'forget', label: 'Forget the cards kept here' });
    return items;
  }
  choose(id) {
    if (id === 'type') {
      let v = null; try { v = window.prompt('The digits under the barcode (13, or 8 on a short card):', ''); } catch (_) {}
      if (v != null && v.trim()) this.swipe(v);
    } else if (id === 'random') {
      let d = String(Math.floor(Math.random() * 9) + 1); while (d.length < 12) d += Math.floor(Math.random() * 10);
      this.swipe(d);
    } else if (/^k\d+$/.test(id)) { const k = this.known()[+id.slice(1)]; if (k) this.swipe(k[1]); }
    else if (/^c\d+$/.test(id)) this.swipe(this.cards[+id.slice(1)]);
    else if (id === 'forget') { this.cards = []; try { localStorage.removeItem(BC_KEY); } catch (_) {} this.toast('Forgotten on this device.'); }
    this.changed();
  }
  label() { const X = this.x(); if (X && X.busy()) return 'Reading a card'; return this.last ? `Last card ${this.last}` : 'Barcode reader'; }
  state() { const X = this.x(); return X && X.busy() ? 'on' : null; }
  frame() {}
  destroy() {}
}

/* THE GAME BOY PRINTER (2026-10-21): as the game sends print data, the image builds up line by
 * line in the print window, exactly as on a tiny thermal sticker. From there: print, save, or go
 * back to discard.
 *
 * The printer itself is in the core (gb.c "THE GAME BOY PRINTER"): it answers the game on
 * the link port with a real printer's replies and timing, and its head makes dot lines at the
 * printer's own pace. This class only takes those lines (core.ext.printer.poll(), 162 bytes
 * each: 160 darkness values 0..3, flags, exposure) and lays them on a roll of paper:
 *   - el: the Print window's content (the Control Bar's 'print' panel): a status line and the
 *     roll, newest line at the bottom, as paper comes out of a printer;
 *   - png(scale): the whole roll as a PNG at a whole-number scale;
 *   - print(): the roll through the browser's own print dialog, sized like the 38 mm sticker
 *     paper (its own page, play/host/print.html; 22 Oct);
 *   - discard(): the roll thrown away (Back).
 * Prints add to the roll until it is thrown away, like the paper roll in the printer.
 * Nothing is uploaded or kept: the roll lives in this window only.
 */
const PRN_PAPER = [242, 239, 230], PRN_INK = [26, 26, 30];
const PRN_LEVEL = [0, 0.36, 0.68, 1];
export class Printer {
  constructor({ core, listed, onShow, onPage, log }) {
    this.core = core; this.log = log || (() => {});
    this.onShow = onShow || (() => {}); this.onPage = onPage || (() => {});
    this.visible = !!listed;            // the bar shows Print: a listed title, or once the game talked to the printer
    this.rows = 0; this.px = null;      // RGBA of the roll, 160 wide
    this.sh = null; this.ex = null;     // the shade (0-3) of every dot and each line's exposure, kept to colour again
    this.pal = null;                    // the Mono Palette's four colours (core), or null: the printer's own grey paper
    this.active = false; this.busy = false; this.hush = false; this.prints = 0;
    const el = this.el = document.createElement('div');
    el.className = 'cwp';
    el.innerHTML = '<div class="cwp-status" role="status" aria-live="polite"></div>' +
      '<div class="cwp-view"><div class="cwp-paper"><canvas class="cwp-roll" width="160" height="1" aria-label="Printed paper"></canvas></div></div>' +
      '<div class="cwp-slot" aria-hidden="true"></div>';
    this.view = el.querySelector('.cwp-view'); this.canvas = el.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.statusEl = el.querySelector('.cwp-status');
    Printer.css();
    this.scale = 2;
    if ('ResizeObserver' in window) { this.ro = new ResizeObserver(() => this.layout()); this.ro.observe(this.view); }
    this.paint(); this.say();
  }
  static css() {
    if (document.getElementById('cwp-css')) return;
    const s = document.createElement('style'); s.id = 'cwp-css';
    s.textContent = '.cwp{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;flex:1 1 auto;min-height:0}' +
      '.cwp-status{font-size:13px;color:var(--cw-bar-dim,#9aa1ad);text-align:center;min-height:1.2em}' +
      '.cwp-view{flex:1 1 auto;min-height:0;width:100%;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;align-items:center;scrollbar-width:thin}' +
      '.cwp-paper{margin-top:auto;background:rgb(242,239,230);box-shadow:0 1px 6px rgba(0,0,0,.45);padding:0 var(--cwp-side,22px);line-height:0}' +
      '.cwp-roll{display:block;image-rendering:pixelated;image-rendering:crisp-edges}' +
      '.cwp-slot{flex:0 0 auto;height:10px;border-radius:5px;background:linear-gradient(#0b0c0e,#2a2e36);box-shadow:inset 0 2px 3px rgba(0,0,0,.8)}';
    (document.head || document.documentElement).appendChild(s);
  }
  /* The largest whole scale that fits the window (the paper is 38 mm for 28 mm of print). */
  layout() {
    const w = this.view.clientWidth || 320;
    const k = Math.max(1, Math.min(4, Math.floor((w - 8) / (160 * 1.12))));
    if (k !== this.scale || !this.laid) { this.scale = k; this.laid = true; this.size(); }
  }
  size() {
    const w = this.view.clientWidth || 320;
    const k = this.scale, side = Math.max(4, Math.min(Math.round(160 * k * 0.18), Math.floor((w - 160 * k) / 2) - 4));
    this.el.style.setProperty('--cwp-side', side + 'px');
    this.canvas.style.width = (160 * k) + 'px';
    this.canvas.style.height = (Math.max(1, this.rows) * k) + 'px';
    const slot = this.el.querySelector('.cwp-slot'); if (slot) slot.style.width = (160 * k + 2 * side + 16) + 'px';
  }
  say() {
    const t = this.busy ? 'Printing…' : this.rows ? 'Printed. Save it or print it on paper. Back keeps the paper here (Print in the bar opens it again); Throw away clears it.' : 'Nothing printed yet. Choose Print in the game and this window opens by itself.';
    if (this.statusEl.textContent !== t) this.statusEl.textContent = t;
  }
  /* Once per emulated frame. */
  frame() {
    const c = this.core(), x = c && c.ext && c.ext.printer;
    if (!x) return;
    /* 2026-10-21: the paper in the Mono Palette's colours, shade i in colour i as the
       screen draws it, following a change of palette at once. */
    const pal = x.palette ? x.palette() : null;
    if (pal !== this.pal) { this.pal = pal; this.colour(0, this.rows); this.paint(); }
    const lines = x.poll();
    if (lines && !this.hush) this.add(lines, x.record || 162);
    const info = x.info();
    if (!this.visible && (info & 0x100)) { this.visible = true; this.log('printer: the game is printing'); this.onShow(); }
    const active = !!(info & 0xC00), busy = !!(info & 0x400);
    if (active && !this.active && !this.hush) this.onPage();
    if (!active && this.hush) this.hush = false;      // a thrown-away print is over; the next one shows
    if (busy !== this.busy) {
      this.busy = busy;
      if (!busy && this.rows) { this.prints++; this.log('printer: printed (' + this.rows + ' dot lines on the roll)'); }
      this.say();
    }
    this.active = active;
  }
  add(lines, rec) {
    const n = (lines.length / rec) | 0;
    if (!n) return;
    const need = (this.rows + n) * 640;
    if (!this.px || need > this.px.length) {
      const cap = Math.max(need, (this.px ? this.px.length : 0) * 2, 640 * 256);
      const grown = new Uint8ClampedArray(cap), gs = new Uint8Array(cap / 4), ge = new Uint8Array(cap / 640);
      if (this.px) { grown.set(this.px.subarray(0, this.rows * 640)); gs.set(this.sh.subarray(0, this.rows * 160)); ge.set(this.ex.subarray(0, this.rows)); }
      this.px = grown; this.sh = gs; this.ex = ge;
    }
    for (let i = 0; i < n; i++) {
      const o = i * rec, r = this.rows + i;
      this.ex[r] = lines[o + 161];
      for (let xx = 0; xx < 160; xx++) this.sh[r * 160 + xx] = lines[o + xx] & 3;
    }
    this.colour(this.rows, this.rows + n);
    this.rows += n;
    this.paint();
    this.say();
  }
  /* Dot lines from..to-1 into RGBA: the Mono Palette's colour for each shade, or, with no four-colour
     palette (an original cartridge on the Color), the printer's grey ink darkened by the line's exposure. */
  colour(from, to) {
    if (!this.px) return;
    const pal = this.pal;
    for (let r = from; r < to; r++) {
      const k = Math.min(1.25, 0.75 + 0.5 * (this.ex[r] / 127));
      let p = r * 640, s = r * 160;
      for (let xx = 0; xx < 160; xx++, p += 4, s++) {
        const v = this.sh[s];
        if (pal) { const c = pal[v]; this.px[p] = c[0]; this.px[p + 1] = c[1]; this.px[p + 2] = c[2]; }
        else {
          const f = Math.min(1, PRN_LEVEL[v] * k);
          this.px[p] = PRN_PAPER[0] + (PRN_INK[0] - PRN_PAPER[0]) * f;
          this.px[p + 1] = PRN_PAPER[1] + (PRN_INK[1] - PRN_PAPER[1]) * f;
          this.px[p + 2] = PRN_PAPER[2] + (PRN_INK[2] - PRN_PAPER[2]) * f;
        }
        this.px[p + 3] = 255;
      }
    }
  }
  paperRgb() { const c = this.pal ? this.pal[0] : PRN_PAPER; return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
  paint() {
    const h = Math.max(1, this.rows);
    if (this.canvas.height !== h) this.canvas.height = h;
    if (this.rows) this.ctx.putImageData(new ImageData(this.px.slice(0, this.rows * 640), 160, this.rows), 0, 0);
    else { this.ctx.fillStyle = this.paperRgb(); this.ctx.fillRect(0, 0, 160, 1); }
    const paper = this.el.querySelector('.cwp-paper'); if (paper) paper.style.background = this.paperRgb();
    this.size();
    this.view.scrollTop = this.view.scrollHeight;   // the newest line, where the paper comes out
  }
  /* The roll at a whole scale, as a PNG data URL (null with nothing printed). */
  png(scale) {
    if (!this.rows) return null;
    const k = Math.max(1, scale | 0), c = document.createElement('canvas');
    c.width = 160 * k; c.height = this.rows * k;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(this.canvas, 0, 0, 160, this.rows, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }
  /* The print document: only the roll, on a 38 mm strip with 28 mm of print, as the sticker paper.
     @page margin 0 leaves the browser no room for its header, footer and page numbers. */
  /* 2026-10-21: at a whole scale k the strip is k times the real one (38k mm
     wide, 28k mm of print) and the page is sized to the strip, so 8x is not cut to a sheet. The
     picture is the roll at k whole pixels a dot. */
  printHtml(url, scale) {
    const k = Math.max(1, scale | 0), mm = v => (Math.round(v * 100) / 100) + 'mm';
    const w = 38 * k, ih = this.rows * 28 * k / 160, h = ih + 6 * k;
    return '<!doctype html><html><head><meta charset="utf-8"><title>Game Boy Printer</title><style>' +
      '@page{size:' + mm(w) + ' ' + mm(h) + ';margin:0}html,body{margin:0;padding:0;background:#fff}' +
      '.strip{width:' + mm(w) + ';height:' + mm(h) + ';box-sizing:border-box;padding:' + mm(3 * k) + ' ' + mm(5 * k) + ';overflow:hidden;break-inside:avoid}' +
      'img{display:block;width:' + mm(28 * k) + ';height:' + mm(ih) + ';image-rendering:pixelated;image-rendering:crisp-edges}' +
      '</style></head><body><div class="strip"><img alt="Printed picture" src="' + url + '"></div></body></html>';
  }
  /* The browser's print dialog for the strip alone (2026-10-22: printing had stopped
     working and still showed the browser's header/footer): a dedicated page of its own, print.html
     next to this module (found from import.meta.url, so no page address or route can change it).
     The job (the roll as a PNG at k whole pixels a dot, and its dot lines) waits on this window as
     __cwPrintJob; the page reads it from its parent or opener, sizes the strip with @page margin 0,
     and prints itself once the picture has loaded. Desktop: a frame out of sight. Android Chrome
     prints the top page whatever frame asks, so there the page opens in a tab of its own. */
  /* 2026-10-25: printing gave pages with no image, and the browser's header and footer
     were not removed. Those pages are the site page itself: whenever the browser prints the top
     page instead of the print page (Ctrl+P, the browser's menu, a phone's browser, or a frame's print
     the browser did not honour), the site has no print rules, so its dark pages print empty with the
     browser's date, address and page numbers. Now the strip is put into the TOP page as well, with
     print-only rules that hide everything else and size the page to the strip with no margin, and
     that page is the one printed. It stays there until the paper is thrown away or the game closes,
     so a print from the browser's own menu gives the strip too. The print page (print.html) is kept
     for a top page this window cannot reach. */
  printOnTop(url, k) {
    let top = null;
    try { top = window.top; if (!top || !top.document || !top.document.body) top = null; } catch (_) { top = null; }
    if (!top) return false;
    this.unprint();
    const d = top.document, mm = v => (Math.round(v * 100) / 100) + 'mm';
    const iw = 28 * k, ih = this.rows * 28 * k / 160;
    const st = d.createElement('style');
    st.id = 'cw-print-css'; st.media = 'print';
    /* (real Chrome, 25 Oct: the picture right-aligned and cut off, the
       header and footer, a second blank page). The page is now whatever paper the print dialog has
       (A4, Letter...): no @page size, margin 0 (no room for the browser's header and footer); the
       strip is one fixed box the size of the page, so the page has no flowing content and prints as
       exactly one sheet; the picture is centred in it at k mm per 1/28 of its width, never larger
       than the page less a 10 mm paper edge (object-fit keeps its shape). */
    st.textContent = '@page{margin:0}' +
      'html,body{margin:0!important;padding:0!important;border:0!important;background:#fff!important;width:auto!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;transform:none!important;zoom:1!important;display:block!important}' +
      'html::before,html::after,body::before,body::after{display:none!important;content:none!important}' +
      'body>*:not(#cw-print-job){display:none!important}' +
      '#cw-print-job{display:flex!important;position:fixed!important;left:0!important;top:0!important;right:auto!important;bottom:auto!important;width:100vw!important;height:100vh!important;margin:0!important;padding:10mm!important;box-sizing:border-box!important;align-items:center!important;justify-content:center!important;overflow:hidden!important;visibility:visible!important;opacity:1!important;transform:none!important;background:#fff!important;z-index:2147483647}' +
      '#cw-print-job img{display:block!important;flex:0 1 auto!important;width:' + mm(iw) + '!important;height:' + mm(ih) + '!important;max-width:100%!important;max-height:100%!important;margin:0!important;object-fit:contain!important;object-position:center!important;image-rendering:pixelated;image-rendering:crisp-edges}';
    const box = d.createElement('div');
    box.id = 'cw-print-job'; box.setAttribute('aria-hidden', 'true'); box.style.display = 'none';   // print only
    const img = d.createElement('img'); img.alt = 'Printed picture'; img.src = url;
    box.appendChild(img);
    d.head.appendChild(st); d.body.appendChild(box);
    this.onTop = { st, box };
    if (!this.unhook) { this.unhook = () => this.unprint(); window.addEventListener('pagehide', this.unhook); }
    const go = () => { if (this.onTop && this.onTop.box === box) { try { top.focus(); } catch (_) {} try { top.print(); } catch (_) {} } };
    (img.decode ? img.decode() : Promise.resolve()).then(go, go);
    return true;
  }
  /* The strip out of the top page again (thrown away, a new print, the game closed). */
  unprint() {
    const t = this.onTop; this.onTop = null;
    if (t) { try { t.st.remove(); } catch (_) {} try { t.box.remove(); } catch (_) {} }
  }
  print(scale) {
    const k = [1, 2, 4, 8].includes(scale | 0) ? (scale | 0) : 1;
    const url = this.png(k);
    if (!url) return false;
    window.__cwPrintJob = { url, scale: k, rows: this.rows };
    if (this.printOnTop(url, k)) return true;
    const page = new URL('./print.html?v=2.1.0', import.meta.url).href;
    if (/Android/i.test(navigator.userAgent || '')) {
      const w = window.open(page, '_blank');
      if (w) { this.lastPrintTab = w; return true; }
      /* a blocked tab falls through to the frame */
    }
    const old = document.getElementById('cw-print-frame'); if (old) old.remove();
    const f = document.createElement('iframe');
    f.id = 'cw-print-frame'; f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1; f.title = 'Game Boy Printer';
    f.style.cssText = 'position:fixed;left:-10000px;top:0;width:600px;height:400px;border:0;pointer-events:none';
    f.onload = () => { try { f.contentWindow.addEventListener('afterprint', () => setTimeout(() => { try { f.remove(); } catch (_) {} }, 500)); } catch (_) {} };
    f.src = page;
    document.body.appendChild(f);
    this.lastPrintFrame = f;
    return true;
  }
  discard() {
    if (this.active) this.hush = true;            // the rest of this print is thrown away as it comes
    this.rows = 0; this.px = null; this.sh = null; this.ex = null;
    this.unprint();
    this.paint(); this.say();
    this.log('printer: the paper was thrown away');
  }
  destroy() {
    try { this.ro && this.ro.disconnect(); } catch (_) {}
    this.unprint();
    if (this.unhook) { try { window.removeEventListener('pagehide', this.unhook); } catch (_) {} this.unhook = null; }
  }
}

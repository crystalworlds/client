/*
 * play/host/input.mjs -- one input mapper for every console (the Core API, section 3.5).
 *
 * Sources: the keyboard (and a TV remote, which sends keys), gamepads (the site's
 * gamepad.js polls them and feeds this window through window.gnwPlayPad.feed, as it
 * feeds every play window), the on-screen buttons (play/shared/overlay.js, its send
 * hook) and console keys from the bar. Each source's PHYSICAL state is kept, so:
 *   - after a load or a rewind step the core is handed what is held NOW (resync), never
 *     what was held when the state was made, and never nothing while a key is down;
 *   - blur, a hidden tab, pagehide, a panel or the pause menu release everything;
 *   - a control already held when the session starts or a hold ends (the A held to
 *     launch from a tile, the button that closed a menu) is LATCHED OUT until it is
 *     let go (A-hold vs A-tap, 2026-10-14);
 *   - a press shorter than a frame is still seen for one frame (latched presses).
 *
 * Remaps are the site's own: Settings -> Keyboard & controllers saves them in
 * localStorage 'gnw.keys.games.v1' and 'gnw.pad.games.v2' (play/play-pad.js; pad buttons by printed letter). A remap
 * moves the KEY, never the function: functions are named by their default key code,
 * which is each control's first default key here.
 */
const KEY_STORE = 'gnw.keys.games.v1';
const BACKISH = new Set(['Escape', 'Backspace', 'Tab']);

function storedJson(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }
function isField(t) {
  if (!t || t.nodeType !== 1) return false;
  if (t.isContentEditable) return true;
  return /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t.tagName) || (t.getAttribute && t.getAttribute('role') === 'button');
}

export class Input {
  constructor({ sys, onMenu, onHelp, log }) {
    this.sys = sys; this.onMenu = onMenu; this.onHelp = onHelp; this.log = log || (() => {});
    this.ports = [];
    this.keyMap = new Map();      // e.code -> [[port, bit], ...] (one key may press two things: the NES's X is A and the Zapper's trigger)
    this.fnMap = new Map();       // function code (a default key) -> [port, bit]
    this.keys = new Set();        // codes physically down (mapped ones)
    this.touch = new Map();       // function code -> refcount
    this.pad = new Map();         // `${port}:${bit}` -> true, from the latest feed
    this.ck = new Map();          // console keys from the bar
    this.latched = new Set();     // `${port}:${bit}` pressed since the last frame (short taps)
    this.out = new Set();         // latched OUT until released
    this.sent = [];               // last mask sent per port
    /* TIMED INPUT (2026-10-21; Stella #858 class): a core that sets `timedInput`
       is told WHEN in the coming frame each key, touch or console-key change happened, as
       `at` (0..1 of the frame), so a program that reads a button twice in one frame sees a
       change between the reads, as on the console. A press inside the window holds until
       the window ends (the tap latch below). Pads are polled once a frame: no time, at 0. */
    this.timed = false; this.marks = []; this.lastApplyT = 0;
    this.dirty = true;
    this.padLast = []; this.padChord = [];
    this.enabled = true;
    this.pointers = new Map();    // port index -> { x, y, inside, buttons } (light guns, paddles)
    this.kb = null;               // a keyboard device: { port, codes: Set, toggle, typing, held: Set }
    this.raw = new Set();
    this._kbd = e => this.onKbDevice(e, true); this._kbu = e => this.onKbDevice(e, false);
    addEventListener('keydown', this._kbd, true);
    addEventListener('keyup', this._kbu, true);
    this.stats = { keys: 0, pad: 0, touch: 0, resyncs: 0, releases: 0, latchedOut: 0 };
    this._kd = e => this.onKey(e, true); this._ku = e => this.onKey(e, false);
    addEventListener('keydown', this._kd);
    addEventListener('keyup', this._ku);
    const rel = () => { this.raw.clear(); this.releaseAll('blur'); };
    addEventListener('blur', rel);
    addEventListener('pagehide', rel);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.releaseAll('hidden'); });
  }

  setPorts(ports) {
    this.ports = ports || [];
    this.sent = this.ports.map(() => -1);
    this.sig = this.ports.map(() => '');
    this.pointers.clear();
    // A keyboard accessory (the Family BASIC keyboard): it takes the keys it names while typing.
    this.kb = null;
    this.ports.forEach((p, pi) => p.controls.forEach(c => {
      if (c.type === 'keyboard') this.kb = { port: pi, codes: new Set(c.codes || []), toggle: c.toggle || 'ScrollLock', typing: true, held: new Set() };
    }));
    window.gnwKbTyping = !!this.kb;      // play-keys.js and the remap stand aside while typing
    this.rebuildKeys();
  }
  /* The keyboard device, in the capture phase, before the pads and the site's keys. */
  onKbDevice(e, down) {
    // Keys held, as this window sees them. The page's own inline tracker (index.html
    // window.__cwRawKeys) is the one litSet reads: it runs before the Control Bar takes the
    // keyboard for an open panel; this set is its stand-in on a page without it.
    if (down) this.raw.add(e.code); else this.raw.delete(e.code);
    const K = this.kb;
    if (!K || !this.enabled) return;
    if (e.code === K.toggle) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (down && !e.repeat) { K.typing = !K.typing; K.held.clear(); window.gnwKbTyping = K.typing; this.dirty = true; if (this.onNote) this.onNote(K.typing ? 'Typing on the keyboard accessory.' : 'Keys go to the controller (' + K.toggle + ' to type again).'); }
      return;
    }
    if (!K.typing || !K.codes.has(e.code) || e.ctrlKey || e.metaKey) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (down) K.held.add(e.code); else K.held.delete(e.code);
    this.dirty = true;
  }
  /* A pointer over the picture, for the port that has a pointer control (0..1 each way). */
  pointer(pi, st) { this.pointers.set(pi, st); this.dirty = true; }
  pointerPort() { return this.ports.findIndex(p => p.controls.some(c => c.type === 'pointer')); }
  rebuildKeys() {
    this.keyMap.clear(); this.fnMap.clear();
    const all = storedJson(KEY_STORE), remap = (all && all[this.sys]) || {};
    this.ports.forEach((p, pi) => p.controls.forEach((c, bit) => {
      const keys = (c.defaults && c.defaults.key) || [];
      keys.forEach((k, j) => {
        const f = [pi, bit];
        if (!this.fnMap.has(k)) this.fnMap.set(k, f);       // a pad or touch press names the first owner
        // The first key is the function's name in Settings; the viewer may move it.
        const eff = j === 0 && remap[k] ? remap[k] : k;
        if (!this.keyMap.has(eff)) this.keyMap.set(eff, []);
        this.keyMap.get(eff).push(f);
      });
      // P4: names the function also answers to (a touch or pad table that presses by name); never keys.
      for (const a of (c.defaults && c.defaults.alias) || []) if (!this.fnMap.has(a)) this.fnMap.set(a, [pi, bit]);
    }));
    // A moved function's old key was never added above, so it presses nothing now,
    // unless it is another function's new key (then it was set for that one).
  }

  onKey(e, down) {
    if (!this.enabled) return;
    // A press with Ctrl, Alt or Meta held is never game input; a RELEASE always is, so a key
    // pressed before Ctrl is never left stuck down (2026-10-14).
    if (BACKISH.has(e.code) || (down && (e.ctrlKey || e.metaKey || e.altKey))) return;
    if (down && isField(e.target) && (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter')) return;   // a focused control's own press
    const fs = this.keyMap.get(e.code);
    if (!fs) return;
    e.preventDefault();
    if (down) { if (!this.keys.has(e.code)) { this.keys.add(e.code); for (const f of fs) this.latched.add(f[0] + ':' + f[1]); this.stats.keys++; } }
    else { this.keys.delete(e.code); for (const f of fs) this.unlatchOutIfFree(f); }
    this.dirty = true;
    this.mark();
  }
  /** Timed input: the held set at the moment of a change (see TIMED INPUT). */
  mark() {
    if (!this.timed) return;
    this.marks.push({ t: performance.now(), held: this.heldSet() });
    if (this.marks.length > 64) this.marks.shift();
  }

  /* overlay.js send(input, down): `input` is a function's default key code. */
  touchSend(code, down) {
    const f = this.fnMap.get(code);
    if (!f) return false;
    const n = (this.touch.get(code) || 0) + (down ? 1 : -1);
    if (n > 0) this.touch.set(code, n); else this.touch.delete(code);
    if (down) { this.latched.add(f[0] + ':' + f[1]); this.stats.touch++; } else this.unlatchOutIfFree(f);
    this.dirty = true;
    this.mark();
    return true;
  }
  consoleKey(id, down) {
    this.ports.forEach((p, pi) => p.controls.forEach((c, bit) => {
      if (c.id !== id) return;
      if (down) { this.ck.set(pi + ':' + bit, true); this.latched.add(pi + ':' + bit); } else { this.ck.delete(pi + ':' + bit); this.unlatchOutIfFree([pi, bit]); }
    }));
    this.dirty = true;
    this.mark();
  }

  /* The site's gamepad.js: players = [[button names], ...], pad 1 first. `maps` is the
     site's own table with the viewer's remaps (gnwPlayPad.mapsFor), button -> function code. */
  padFeed(players, maps) {
    if (!this.enabled) return null;
    let asked = null;
    const want = new Map();
    for (let p = 0; p < players.length && p < 4; p++) {
      const held = new Set(players[p] || []);
      const prev = this.padLast[p] || new Set();
      const fresh = n => held.has(n) && !prev.has(n);
      if (fresh('Home')) asked = 'menu';
      if (held.has('Select') && held.has('Start') && (fresh('Select') || fresh('Start'))) { asked = 'menu'; this.padChord[p] = true; }
      if (this.padChord[p]) { if (!held.has('Select') && !held.has('Start')) this.padChord[p] = false; else { held.delete('Select'); held.delete('Start'); } }
      held.delete('Home');
      let map = maps && maps[p], to = -1;
      // Players 3 and 4 (a Four Score): no keys of their own, so player 1's pad map, on their own port.
      if (!map && p > 0 && maps && maps[0] && this.ports[p] && this.ports[p].kind === 'player') { map = maps[0]; to = p; }
      if (held.has('R3') && !(map && map.R3)) { if (fresh('R3') && !asked) asked = 'help'; held.delete('R3'); }
      this.padLast[p] = new Set(players[p] || []);
      if (!map) continue;
      for (const n of held) {
        const code = map[n];
        if (code === '@menu') { if (fresh(n) && !asked) asked = 'menu'; continue; }   // P5: play-pad.js's menu target
        let f = code && this.fnMap.get(code);
        /* Onto this player's own port by the control's NAME (2026-10-25): the same id
           in port `to`, or nothing. By position, a press player 1 owns on a console port (the
           Pokemon mini's Shake) landed on whatever sits at that bit of player 2's port (its B). */
        if (f && to >= 0) { const c = this.ports[f[0]] && this.ports[f[0]].controls[f[1]], tp = this.ports[to]; const j = c && tp ? tp.controls.findIndex(x => x.id === c.id) : -1; f = j >= 0 ? [to, j] : null; }
        if (f) want.set(f[0] + ':' + f[1], f);
      }
    }
    for (const k of Array.from(this.pad.keys())) if (!want.has(k)) { this.pad.delete(k); const [pi, bit] = k.split(':').map(Number); this.unlatchOutIfFree([pi, bit]); }
    for (const [k] of want) if (!this.pad.has(k)) { this.pad.set(k, true); this.latched.add(k); this.stats.pad++; }
    this.dirty = true;
    if (asked) { this.releasePad(); if (asked === 'menu') this.onMenu && this.onMenu(); else this.onHelp && this.onHelp(); }
    return asked;
  }
  releasePad() { this.pad.clear(); this.padLast = []; this.padChord = []; this.dirty = true; }

  /** What to light on a Keys diagram: everything held, including keys a panel kept from the game. */
  litSet() {
    const s = this.heldSet();
    for (const code of (window.__cwRawKeys || this.raw)) { const fs = this.keyMap.get(code); if (fs) for (const f of fs) s.add(f[0] + ':' + f[1]); }
    return s;
  }
  heldSet() {
    const s = new Set();
    for (const code of this.keys) { const fs = this.keyMap.get(code); if (fs) for (const f of fs) s.add(f[0] + ':' + f[1]); }
    for (const code of this.touch.keys()) { const f = this.fnMap.get(code); if (f) s.add(f[0] + ':' + f[1]); }
    for (const k of this.pad.keys()) s.add(k);
    for (const k of this.ck.keys()) s.add(k);
    return s;
  }
  unlatchOutIfFree(f) {
    const k = f[0] + ':' + f[1];
    if (this.out.has(k) && !this.heldSet().has(k)) this.out.delete(k);
  }
  /** Whatever is held now does nothing until it is let go (a session start, a hold ending). */
  latchOut() {
    for (const k of this.heldSet()) { if (!this.out.has(k)) this.stats.latchedOut++; this.out.add(k); }
    this.latched.clear();
    this.dirty = true;
  }
  /** A hold begins (the player's pause, a panel, the pause menu, loading): the core lets
   *  go of everything now, and whatever is physically held stays latched out until it is
   *  released, so the button that opened or closed a menu never reaches the game. */
  suppress(core) {
    for (const k of this.heldSet()) this.out.add(k);
    this.latched.clear();
    if (this.overlay) { try { this.overlay.release(); } catch (_) {} }
    this.touch.clear();
    if (this.kb) this.kb.held.clear();
    for (const [k, pt] of this.pointers) this.pointers.set(k, Object.assign({}, pt, { buttons: 0 }));
    if (core) this.ports.forEach((p, pi) => { this.sent[pi] = 0; this.sig[pi] = '~'; try { core.setInput(p.port, { buttons: 0 }); } catch (_) {} });
    this.dirty = true;
  }
  /** Everything up, physically forgotten: blur, a hidden tab, pagehide (no key-up will come). */
  releaseAll(why) {
    this.keys.clear(); this.touch.clear(); this.ck.clear(); this.releasePad();
    if (this.kb) this.kb.held.clear();
    for (const [k, pt] of this.pointers) this.pointers.set(k, Object.assign({}, pt, { buttons: 0 }));
    this.latched.clear(); this.out.clear();
    this.stats.releases++;
    this.dirty = true;
    if (this.overlay) { try { this.overlay.release(); } catch (_) {} }
  }
  /** After unserialize: the core let every button go; send what is held now. */
  resync() { this.sent = this.sent.map(() => -1); this.sig = this.sent.map(() => '~'); this.dirty = true; this.stats.resyncs++; }

  /** Before each runFrame: the state of every port. */
  apply(core) {
    const now = performance.now(), t0 = this.lastApplyT || now;
    this.lastApplyT = now;
    this.timed = !!(core && core.timedInput);
    let lastAt = -1;
    if (this.timed && this.marks.length) {
      // Each change at its place in the window since the last frame; buttons only (a port
      // with a pointer, a keyboard device or axes keeps its once-a-frame state).
      const span = Math.max(1, now - t0), pressed = this.ports.map(() => 0);
      for (const mk of this.marks) {
        const at = Math.min(0.999, Math.max(0, (mk.t - t0) / span));
        this.ports.forEach((p, pi) => {
          if (this.pointers.get(pi) || (this.kb && this.kb.port === pi) || Array.isArray(p.axes)) return;
          let m = 0;
          p.controls.forEach((c, bit) => { const k = pi + ':' + bit; if (mk.held.has(k) && !this.out.has(k)) m |= (1 << bit); });
          const was = this.sent[pi] > 0 ? this.sent[pi] : 0;
          pressed[pi] |= m & ~was;
          m |= pressed[pi];                               // pressed in this window: held to its end
          if (m !== this.sent[pi]) { this.sent[pi] = m; core.setInput(p.port, { buttons: m, at }); }
        });
        lastAt = at;
      }
    }
    this.marks.length = 0;
    const held = this.heldSet();
    for (const k of this.latched) held.add(k);        // a tap shorter than a frame still counts once
    this.latched.clear();
    for (const k of this.out) held.delete(k);
    /* A port that declares `axes` (the 5200's analogue stick) gets its player's pad axes,
       read here as the old 5200 page read them (the site's pad feed carries buttons only). */
    let pads = null, player = 0;
    if (this.ports.some(p => Array.isArray(p.axes))) { try { pads = Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(g => g && g.connected); } catch (_) { pads = null; } }
    this.ports.forEach((p, pi) => {
      let axes = null;
      if (p.kind === 'player') { if (Array.isArray(p.axes)) { const g = pads && pads[player]; axes = g ? p.axes.map(i => Math.round((g.axes[i] || 0) * 1000) / 1000) : null; } player++; }
      let m = 0;
      p.controls.forEach((c, bit) => { if (held.has(pi + ':' + bit)) m |= (1 << bit); });
      const pt = this.pointers.get(pi) || null;
      const keys = this.kb && this.kb.port === pi ? Array.from(this.kb.held) : null;
      const sig = (pt ? `${pt.x.toFixed(4)},${pt.y.toFixed(4)},${pt.inside ? 1 : 0},${pt.buttons}` : '') + (keys ? '|' + keys.join(',') : '') + (axes ? '#' + axes.join(',') : '');
      if (m !== this.sent[pi] || sig !== this.sig[pi]) {
        this.sent[pi] = m; this.sig[pi] = sig;
        const st = { buttons: m };
        if (pt) st.pointer = pt;
        if (keys) st.keys = keys;
        if (axes) st.axes = axes;
        if (lastAt >= 0) st.at = lastAt;                  // timed: after this window's changes
        core.setInput(p.port, st);
      }
    });
    this.dirty = false;
  }
  /** For the Keys panel: each control with the keys that press it now. */
  table() {
    return this.ports.map((p, pi) => p.controls.map((c, bit) => ({
      id: c.id, label: c.label,
      keys: [...this.keyMap.entries()].filter(([, fs]) => fs.some(f => f[0] === pi && f[1] === bit)).map(([k]) => k),
    })));
  }
}

export const keyLabel = code => {
  if (!code) return '';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  const N = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ShiftRight: 'Right Shift', ShiftLeft: 'Left Shift',
    Enter: 'Enter', NumpadEnter: 'Numpad Enter', Space: 'Space' };
  return N[code] || code;
};

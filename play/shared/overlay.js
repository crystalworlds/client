/*
 * play/shared/overlay.js -- ON-SCREEN BUTTONS ("overlays") for every play window (2026-10-07).
 *
 * The answer to the play interface design Q8 / A8: "on-screen overlay system,
 * Atari extras at the bottom". Researched from RetroArch's input overlays, written here from
 * scratch: RetroArch's .cfg files and images are NOT used, only the ideas (see "WHAT WAS TAKEN
 * FROM RETROARCH" below). Each system's buttons are DATA, in play/shared/overlays/<sys>.json,
 * and every number in those files is our own measurement of our own artwork, or the site's
 * existing measured on-screen controls carried over unchanged.
 *
 * ------------------------------------------------------------------ THE DEFINITION FORMAT
 * Our own format, "cw-overlay/1". A definition has up to three parts:
 *
 *   art    buttons ON THE DEVICE ART: centre x, y and full size w, h as FRACTIONS of the
 *          artwork's own box (the element passed as `frame`), so they sit exactly on the
 *          drawn buttons at any size, and turn with the artwork (a turned Lynx). Invisible
 *          until pressed; then the button glows. Always live (they are the console's own
 *          buttons, as the Game & Watch and Pokemon mini hotspots always were).
 *   float  a translucent pad docked to the corners of the play area (the Game Boy / NES touch
 *          overlay, as decided: "The game pad is an overlay, its supposed overlay the
 *          screen"). Groups dock at bl / br / bc / tl / tr; sizes are in UNITS (one unit is
 *          the d-pad's side: clamp(min px, vw% of the play area, max px), a second triple for
 *          portrait) or a [min, vw, max] px clamp of their own. Shown when Display says so.
 *          It is also the Full screen overlay (A13: the game screen only, no art).
 *   strip  the console's extra switches at the BOTTOM of the window, where the Game Boy puts
 *          Select and Start (as decided: "The additional buttons on the Atari can be just placed
 *          at the bottom of the window"). Hold buttons (Reset, Select, Pause, Option) and
 *          toggles (difficulty, colour / B&W). Shown on every device, mouse included.
 *
 *   A control: { id, label, input, shape, x, y, w, h, rot }
 *     shape  'rect' | 'circle' (an ellipse filling w x h) | 'pill' | 'dpad' (8-way, by angle
 *            from the centre, dead centre 20%, diagonals in the corners: the Game Boy rule)
 *     input  WHAT IT PRESSES, by the same name the keyboard path uses:
 *              'KeyX', 'ArrowUp', 'Space', 'F1' ...   the function's DEFAULT key code from
 *                  play/play-pad.js FN, sent as a KeyboardEvent to the page's own key table.
 *                  A viewer's remap (Settings -> Game controls) moves the KEY, never the
 *                  function, so this keeps pressing the right thing, Keys stays the authority,
 *                  and Continue, rewind and help see exactly what a key press makes;
 *              'pm:a'      Pokemon mini's named press (_pmActiveDevice.press / release);
 *              'gnw:time'  Game & Watch's named press (gnwPress / gnwRelease);
 *              'call:NAME' a function the page hands in (`calls`), for a switch no key reaches.
 *            A d-pad has `dirs` instead: { up, down, left, right } inputs (default the arrows).
 *   A strip item adds kind: 'hold' (default) or 'toggle' { call, arg, states: [off, on] }.
 *   Every definition carries `provenance`: where each number came from and its licence.
 *
 * ------------------------------------------------------------------ THE MODULE
 *   const ov = CwOverlay.create({ sys, def, frame, stage, screen, calls, send })
 *     sys     'gb' | 'nes' | 'a2600' | 'a5200' | 'a7800' | 'alynx' | 'pm' | 'tj' | 'twin' | 'gnw'
 *     def     the definition (an object); omit to use CwOverlay.load(sys) first
 *     frame   the element whose box IS the artwork (art coordinates are fractions of it)
 *     stage   the element the float pad and strip are docked to (the Control Bar's core.stage)
 *     calls   { NAME: { get(arg), set(arg, on) } } for 'call:' inputs and toggles
 *     send    optional (input, down) => handled?  -- before the built-in senders
 *   ov.mount(stage?, { mode })   build the layers ('device' default)
 *   ov.setMode('device' | 'full' | 'off'),  ov.mode()
 *   ov.release()      let go of every held input (a panel opened, the game was held)
 *   ov.setUnit(u)     Game & Watch: this unit's own float pad { groups, artOff } (play/cores/gnw/art.mjs)
 *   ov.settingsNode() the Settings rows (the Control Bar's Settings -> Touch hosts it)
 *   ov.held()         the inputs held by the overlay now;  ov.lit() what is lit (show inputs)
 *   ov.destroy()
 *   CwOverlay.instance(sys)  the instance already made in this document, if any
 *   CwOverlay.load(sys)      -> Promise<def> (play/shared/overlays/<sys>.json, cached)
 *   CwOverlay.gnwDef()       the Game & Watch art definition, read from the live, measured
 *                            .play-hotspot boxes gnw-host.js places from its GAMES registry
 *   CwOverlay.settings()     the viewer's settings; CwOverlay.set(patch) changes them
 *
 * ------------------------------------------------------------------ BEHAVIOUR
 *   - Pointer events: mouse, touch and pen in one path. No hover anywhere.
 *   - Multi-touch: every pointer is tracked on its own and every input is REFCOUNTED, so two
 *     fingers on one button do not release it when the first lifts, and a d-pad thumb plus an
 *     A finger both hold.
 *   - Sliding: the hit test runs on every move (document.elementsFromPoint, so a rotated pill,
 *     a round button and a turned Lynx are tested against their real painted shape), so a
 *     thumb rolls across the d-pad and slides from Select to Start.
 *   - Hysteresis (RetroArch's range_mod): a held control's hit area grows by 25%, so a thumb on
 *     an edge does not flicker on and off.
 *   - One finger presses one control (8 Nov 2026): where two touch areas overlap (a thumb's
 *     slop reaching a neighbour, as Left reached Down on the Tetris Jr. picture), the finger
 *     gets the button drawn under it; between buttons, the one it already holds, else the
 *     nearest. A d-pad is one control, so its diagonals stay.
 *   - Released on pointerup / cancel / lost capture, window blur, a hidden tab, pagehide, any
 *     mode change, Display switched off, and release().
 *   - Pressed feedback always (the face sinks and its arc of light dims, 8 Nov 2026). A controller's presses light the same buttons always (7 Nov 2026,
 *     setLitSource); with "Show inputs" the keyboard's do too (read from the key events the page
 *     receives, so it is the truth).
 *   - SOUND: none. This file makes no sound and starts none (the sound rule); a press is a
 *     user gesture inside the play window, so the game's own audio unlocks as for a key.
 *
 * ------------------------------------------------------------------ SETTINGS (per viewer)
 *   localStorage 'cw.overlay.v1' = { display, showInputs, opacity, scale, spacing, rotate }
 *   Adopted from RetroArch's overlay settings, the ones that make sense here:
 *     Display overlay   auto | on | off. Auto = a touch screen ((pointer: coarse) AND
 *                       navigator.maxTouchPoints > 0: the Game Boy rule, because a
 *                       desktop Chrome can report coarse with no digitiser) AND no gamepad
 *                       connected (RetroArch's "Hide overlay when controller is connected").
 *     Show inputs       light buttons pressed on the keyboard too (RetroArch's "Show inputs on
 *                       overlay: Physical"). Teaching and streaming. A pad always lights them.
 *     Opacity           0.2-1, default 0.7 (RetroArch's default).
 *     Size              0.75-1.5 (RetroArch's overlay scale).
 *     Edge spacing      0-48 px (RetroArch's separation: how far the two halves sit from the edges).
 *     Auto-rotate       the portrait pad on a portrait screen (RetroArch's auto-rotate picks a
 *                       portrait page). The art buttons always turn with the art.
 *   Not adopted: "behind menu" / "hide in menu" (our panels cover the overlay and release it,
 *   always), the preset file browser (one definition per console, nothing to choose),
 *   "Show inputs from port" (player 1 only), mouse cursor (the page's own).
 *
 * ------------------------------------------------------------------ WHAT WAS TAKEN FROM RETROARCH
 *   Ideas only (RetroArch is GPLv3; libretro/common-overlays is CC-BY-4.0; nothing copied):
 *   normalised coordinates; rect and radial (ellipse) hit areas; range_mod hysteresis;
 *   an 8-way d-pad area (dpad_area) whose diagonals are the OR of two directions; the pressed state shown by raising opacity (alpha_mod); a
 *   full-screen layout separate from the device layout; landscape / portrait pages; the
 *   settings above. Sources and the licence table: the play interface design, section 11.
 */
(function () {
  'use strict';
  if (window.CwOverlay) return;

  const BUILD = '2.0.0-q8a';
  const STORE = 'cw.overlay.v1';
  const DEFAULTS = { display: 'auto', showInputs: false, opacity: 0.7, scale: 1, spacing: 0, rotate: true };
  const DIRS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  const HERE = (function () { try { return new URL('.', document.currentScript.src).href; } catch (_) { return ''; } })();

  /* ------------------------------------------------------------ settings */
  let cfg = read();
  function read() {
    let o = null; try { o = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (_) { o = null; }
    const c = Object.assign({}, DEFAULTS, o && typeof o === 'object' ? o : {});
    if (!['auto', 'on', 'off'].includes(c.display)) c.display = 'auto';
    c.opacity = clampN(+c.opacity, 0.2, 1, 0.7); c.scale = clampN(+c.scale, 0.75, 1.5, 1); c.spacing = clampN(+c.spacing, 0, 48, 0);
    c.showInputs = !!c.showInputs; c.rotate = c.rotate !== false;
    return c;
  }
  function clampN(v, lo, hi, d) { return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; }
  const live = new Set();       // instances in this document
  function set(patch) {
    cfg = Object.assign({}, cfg, patch || {});
    try { localStorage.setItem(STORE, JSON.stringify(cfg)); } catch (_) {}
    cfg = read();
    for (const i of live) i._apply();
  }
  addEventListener('storage', e => { if (e.key === STORE) { cfg = read(); for (const i of live) i._apply(); } });

  /* Touch screen, by capability (the Game Boy rule; see the header). */
  function touchScreen() {
    let coarse = false, touch = false;
    try { coarse = matchMedia('(pointer: coarse)').matches; } catch (_) {}
    try { touch = (navigator.maxTouchPoints || 0) > 0; } catch (_) {}
    return coarse && touch;
  }
  function padConnected() {
    try { const g = navigator.getGamepads ? navigator.getGamepads() : []; for (const p of g) if (p && p.connected) return true; } catch (_) {}
    return false;
  }
  addEventListener('gamepadconnected', () => { for (const i of live) i._apply(); });
  addEventListener('gamepaddisconnected', () => { for (const i of live) i._apply(); });
  function floatWanted() {
    if (cfg.display === 'on') return true;
    if (cfg.display === 'off') return false;
    return touchScreen() && !padConnected();
  }

  /* ------------------------------------------------------------ styles */
  const CSS = `
  .cwov { position:absolute; inset:0; z-index:70; pointer-events:none; touch-action:none;
    -webkit-user-select:none; user-select:none; -webkit-touch-callout:none; -webkit-tap-highlight-color:transparent;
    --cwov-op:.7; --cwov-press:rgba(155,188,15,.62); --cwov-press-ink:#0b0c0e; --cwov-fill:rgba(20,24,30,.34); }
  .cwov[hidden], .cwov-art[hidden], .cwov-float[hidden], .cwov-strip[hidden] { display:none !important; }
  .cwov-art { position:absolute; inset:0; z-index:40; pointer-events:none; touch-action:none; }
  .cwov-float { position:absolute; inset:0; pointer-events:none; }
  .cwov-c { position:absolute; pointer-events:auto; touch-action:none; box-sizing:border-box; cursor:pointer;
    -webkit-tap-highlight-color:transparent; }
  /* The hit area: the control plus a thumb's slop; grown 25% while held (RetroArch's range_mod). */
  .cwov-c::after { content:''; position:absolute; inset:-7px; border-radius:inherit; }
  .cwov-c.held::after { inset:-12.5%; }
  .cwov-c[data-shape="dpad"]::after { inset:-12px; border-radius:0; }
  .cwov-c[data-shape="dpad"].held::after { inset:-18%; }
  .cwov-tight .cwov-c::after { inset:0 !important; }   /* for one hit test only: the button as drawn (_pick) */
  .cwov-c[data-shape="circle"], .cwov-c[data-shape="circle"]::after { border-radius:50%; }
  .cwov-c[data-shape="pill"], .cwov-c[data-shape="pill"]::after { border-radius:999px; }
  /* ART: invisible until pressed, then the button glows (the G&W / Pokemon mini idiom). */
  .cwov-art .cwov-c { background:transparent; }
  .cwov-art .cwov-c.lit:not([data-shape="dpad"]), .cwov-art .cwov-arm.lit {
    background:radial-gradient(circle at 50% 50%, rgba(255,255,255,.42) 0%, rgba(255,255,255,.22) 55%, rgba(255,255,255,0) 100%);
    box-shadow:0 0 12px 3px rgba(255,255,255,.35) inset; }
  .cwov-art .cwov-arm { border-radius:22%; }
  .cwov-arm { position:absolute; pointer-events:none; }
  .cwov-arm.u { left:34%; top:0; width:32%; height:36%; } .cwov-arm.d { left:34%; bottom:0; width:32%; height:36%; }
  .cwov-arm.l { left:0; top:34%; width:36%; height:32%; } .cwov-arm.r { right:0; top:34%; width:36%; height:32%; }
  /* FLOAT: translucent, the game readable through it; lit = more opaque (alpha_mod). */
  .cwov-float .cwov-c, .cwov-strip { opacity:var(--cwov-op); }
  .cwov-float .cwov-c.lit, .cwov-strip .cwov-c.lit { opacity:1; }
  .cwov-float .cwov-c { display:flex; align-items:center; justify-content:center; color:#d7dce6; font:800 clamp(13px,3.4vw,20px)/1 system-ui,sans-serif;
    letter-spacing:.06em; background:var(--cwov-fill); border:1px solid rgba(255,255,255,.26);
    backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px); box-shadow:0 6px 18px -8px rgba(0,0,0,.85);
    transition:background .05s linear, color .05s linear; }
  .cwov-float .cwov-c.lit { background:var(--cwov-press); color:var(--cwov-press-ink); border-color:rgba(255,255,255,.6); }
  .cwov-float .cwov-c[data-shape="pill"] { font-size:clamp(8px,2vw,9.5px); letter-spacing:.1em; }
  /* DEPTH (8 Nov 2026): each button is a rim and a face. The 1px border is the rim's outer edge, a
     shaded band inside it, a thin light ring where the face starts, the face a little lighter at the
     top, a soft arc of light along its upper edge (::before) and a faint shadow under it. All of it is
     painted inside the button's own box (insets and a pseudo-element that takes no touches), so sizes,
     positions and the touch areas (::after) are exactly as before. Pressed: the face sinks (a shadow
     from the top edge, the arc moves down and dims). Static paint only: nothing animates while idle. */
  .cwov-float .cwov-c:not([data-shape="dpad"]) {
    background:radial-gradient(120% 90% at 50% 18%, rgba(255,255,255,.13) 0%, rgba(255,255,255,0) 58%), var(--cwov-fill);
    box-shadow:inset 0 0 0 .24em rgba(6,8,12,.28), inset 0 0 0 calc(.24em + 1px) rgba(255,255,255,.3),
      inset 0 -.3em .55em -.2em rgba(0,0,0,.32), 0 3px 10px -5px rgba(0,0,0,.75); }
  .cwov-float .cwov-c:not([data-shape="dpad"])::before, .cwov-strip .cwov-c::before { content:''; position:absolute; inset:13% 16% auto; height:52%;
    border-radius:50% 50% 0 0 / 100% 100% 0 0; border:max(1.5px,.11em) solid transparent; border-top-color:rgba(255,255,255,.5); border-bottom:0;
    pointer-events:none; transition:opacity .05s linear, transform .05s linear; }
  .cwov-float .cwov-c[data-shape="rect"]::before { border-radius:3px 3px 0 0; inset:12% 12% auto; }
  /* A pill's arc is shorter and flatter, so it stays above the word on it (SELECT, START, RESET). */
  .cwov-float .cwov-c[data-shape="pill"]::before, .cwov-strip .cwov-c[data-shape="pill"]::before { inset:9% 28% auto; height:22%; border-width:max(1px,.1em); }
  .cwov-strip .cwov-c[data-kind="toggle"]::before { inset:5% 30% auto; height:12%; }   /* two lines of words: the arc stays above them */
  .cwov-float .cwov-c:not([data-shape="dpad"]).lit { background:var(--cwov-press);
    box-shadow:inset 0 0 0 .24em rgba(6,8,12,.2), inset 0 0 0 calc(.24em + 1px) rgba(255,255,255,.36),
      inset 0 .28em .5em -.1em rgba(0,0,0,.42), 0 1px 4px -2px rgba(0,0,0,.7); }
  .cwov-float .cwov-c.lit::before, .cwov-strip .cwov-c.lit::before { opacity:.32; transform:translateY(1.5px); }
  .cwov-float .cwov-c[data-shape="dpad"] { background:transparent; border:0; box-shadow:none; backdrop-filter:none; -webkit-backdrop-filter:none; }
  /* The d-pad (and every stick drawn as one) sits in a round base: a rim ring whose top edge is the glare. */
  .cwov-float .cwov-c[data-shape="dpad"]::before { content:''; position:absolute; inset:-3%; border-radius:50%; pointer-events:none;
    border:1px solid rgba(255,255,255,.2); border-top-color:rgba(255,255,255,.46);
    background:radial-gradient(circle at 50% 50%, rgba(20,24,30,.12) 0 58%, rgba(20,24,30,.26) 72%);
    box-shadow:inset 0 0 0 4px rgba(6,8,12,.16), inset 0 0 0 5px rgba(255,255,255,.2), 0 3px 10px -5px rgba(0,0,0,.6); }
  .cwov-float .cwov-cross { position:absolute; inset:0; pointer-events:none;
    background:linear-gradient(to bottom, rgba(255,255,255,.12), rgba(255,255,255,0) 40%), rgba(150,162,180,.24);
    backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px); filter:drop-shadow(0 6px 16px rgba(0,0,0,.65));
    clip-path:polygon(34% 0,66% 0,66% 34%,100% 34%,100% 66%,66% 66%,66% 100%,34% 100%,34% 66%,0 66%,0 34%,34% 34%); }
  /* The cross's face, a step inside its rim, and the round dimple at its centre. */
  .cwov-float .cwov-cross::before { content:''; position:absolute; inset:0; background:linear-gradient(to bottom, rgba(255,255,255,.07), rgba(6,8,12,.16));
    clip-path:polygon(37.5% 3.5%,62.5% 3.5%,62.5% 37.5%,96.5% 37.5%,96.5% 62.5%,62.5% 62.5%,62.5% 96.5%,37.5% 96.5%,37.5% 62.5%,3.5% 62.5%,3.5% 37.5%,37.5% 37.5%); }
  .cwov-float .cwov-cross::after { content:''; position:absolute; left:50%; top:50%; width:19%; height:19%; transform:translate(-50%,-50%); border-radius:50%;
    border:1px solid rgba(255,255,255,.26); box-shadow:inset 0 1px 3px rgba(0,0,0,.35); }
  .cwov-float .cwov-arm { display:flex; align-items:center; justify-content:center; border-radius:9px; color:#aeb6c2; font-size:clamp(14px,3.4vw,20px); }
  .cwov-float .cwov-arm.lit { background:var(--cwov-press); color:var(--cwov-press-ink); box-shadow:inset 0 2px 5px rgba(0,0,0,.38); }
  /* STRIP: the console switches, bottom centre of the window. */
  .cwov-strip { position:absolute; left:50%; transform:translateX(-50%); bottom:calc(6px + env(safe-area-inset-bottom, 0px));
    display:flex; gap:8px; flex-wrap:nowrap; pointer-events:none; max-width:calc(100% - 12px); }
  .cwov-strip .cwov-c { position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px;
    min-width:clamp(46px,11vw,74px); height:clamp(26px,6vw,34px); padding:0 8px; border-radius:999px;
    background:rgba(20,22,26,.55); border:1px solid rgba(255,255,255,.28); color:#e7e4df;
    backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px); box-shadow:0 5px 14px -8px rgba(0,0,0,.85);
    font:700 clamp(8px,2.1vw,10px)/1.05 system-ui,sans-serif; letter-spacing:.08em; text-transform:uppercase; white-space:nowrap; }
  .cwov-strip .cwov-c small { font-weight:600; font-size:.86em; letter-spacing:.04em; opacity:.8; text-transform:none; }
  .cwov-strip .cwov-c.lit { background:var(--cwov-press); color:var(--cwov-press-ink); border-color:rgba(255,255,255,.6); }
  .cwov-strip .cwov-c[data-kind="toggle"][data-on="1"] { border-color:var(--cwov-press); }
  /* The strip's switches get the same rim, face and arc (see DEPTH above). */
  .cwov-strip .cwov-c { background:radial-gradient(120% 90% at 50% 18%, rgba(255,255,255,.13) 0%, rgba(255,255,255,0) 58%), rgba(20,22,26,.55);
    box-shadow:inset 0 0 0 .24em rgba(6,8,12,.28), inset 0 0 0 calc(.24em + 1px) rgba(255,255,255,.3),
      inset 0 -.3em .55em -.2em rgba(0,0,0,.32), 0 3px 10px -5px rgba(0,0,0,.75); }
  .cwov-strip .cwov-c.lit { background:var(--cwov-press);
    box-shadow:inset 0 0 0 .24em rgba(6,8,12,.2), inset 0 0 0 calc(.24em + 1px) rgba(255,255,255,.36),
      inset 0 .28em .5em -.1em rgba(0,0,0,.42), 0 1px 4px -2px rgba(0,0,0,.7); }
  /* Settings rows (hosted by the Control Bar's Settings panel). */
  .cwov-set { display:grid; gap:10px; font:13px/1.4 system-ui,sans-serif; color:inherit; }
  .cwov-set .row { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
  .cwov-set .seg { display:inline-flex; border:1px solid rgba(255,255,255,.25); border-radius:999px; overflow:hidden; }
  .cwov-set .seg button { font:inherit; padding:5px 12px; border:0; background:transparent; color:inherit; cursor:pointer; }
  .cwov-set .seg button[aria-pressed="true"] { background:rgba(155,188,15,.55); color:#0b0c0e; }
  .cwov-set input[type=range] { width:150px; }
  .cwov-set .hint { opacity:.7; font-size:12px; }
  `;
  function ensureCss(doc) {
    if (doc.getElementById('cwov-css')) return;
    const st = doc.createElement('style'); st.id = 'cwov-css'; st.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(st);
  }

  /* ------------------------------------------------------------ senders */
  function keyOf(code) {
    if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
    if (/^Digit\d$/.test(code)) return code.slice(5);
    if (code === 'Space') return ' ';
    if (code === 'ShiftRight' || code === 'ShiftLeft') return 'Shift';
    return code;
  }
  function keyTarget() {
    const a = document.activeElement;
    return a && a !== document.documentElement && a.dispatchEvent ? a : (document.body || document);
  }
  function sendKey(code, down) {
    const ev = new KeyboardEvent(down ? 'keydown' : 'keyup', { key: keyOf(code), code, bubbles: true, cancelable: true, composed: true,
      shiftKey: down && /^Shift/.test(code), location: /Right$/.test(code) && /^Shift|^Control|^Alt/.test(code) ? 2 : 0 });
    try { Object.defineProperty(ev, '__cwOverlay', { value: true }); } catch (_) {}
    keyTarget().dispatchEvent(ev);
  }
  const pmDev = () => { try { return typeof _pmActiveDevice !== 'undefined' ? _pmActiveDevice : null; } catch (_) { return null; } };   // eslint-disable-line no-undef

  /* ------------------------------------------------------------ geometry */
  function px(v, unit, stageW, scale) {
    if (Array.isArray(v)) return Math.min(v[2], Math.max(v[0], stageW * v[1] / 100)) * scale;
    return (+v || 0) * unit;
  }

  /* An art control's box in the frame, from its numbers on the whole photograph (see setArtView). */
  function artBox(c, v) {
    let x = c.x, y = c.y, w = c.w, h = c.h, rot = c.rot || 0;
    if (!v) return { x, y, w, h, rot };
    const cut = v.cut;
    if (cut) { x = (x - cut[0]) / cut[2]; y = (y - cut[1]) / cut[3]; w /= cut[2]; h /= cut[3]; }
    if (v.turn === 2) { [x, y, w, h] = [1 - y, x, h, w]; rot += 90; }          // a quarter turn right (clockwise)
    else if (v.turn === 1) { [x, y, w, h] = [y, 1 - x, h, w]; rot -= 90; }     // a quarter turn left
    const s = v.show;
    if (s) { x = (x - s[0]) / s[2]; y = (y - s[1]) / s[3]; w /= s[2]; h /= s[3]; }
    return { x, y, w, h, rot };
  }

  /* ------------------------------------------------------------ the instance */
  class Overlay {
    constructor(o) {
      this.sys = o.sys; this.def = o.def || {}; this.frame = o.frame || null; this.stage = o.stage || null;
      this.calls = o.calls || {}; this.customSend = o.send || null; this.when = o.when || {}; this.variant = o.variant || null;
      this._mode = 'device';
      this.byPointer = new Map();     // pointerId -> Set<input>
      /* Every finger down on a control, held until it lifts, even while it presses nothing
         (bug, 2026-10-15: circling the d-pad stopped it until the finger was lifted. A
         finger crossing the dead centre or leaving the pad's square pressed nothing, its entry
         was dropped, and _move then ignored it for good). */
      this.active = new Set();
      this.dpadOf = new Map();        // pointerId -> the d-pad it went down on: it keeps steering it
      this.count = new Map();         // input -> refcount (overlay presses)
      this.keyHeld = new Set();       // codes held as key events (show inputs)
      this.ctls = [];                 // { el, def, layer }
      this.stats = { downs: 0, ups: 0 };
      this._onKey = this._onKey.bind(this);
      this._relAll = () => this.release();
      this._vis = () => { if (document.hidden) this.release(); };
      this._down = this._down.bind(this); this._move = this._move.bind(this); this._up = this._up.bind(this);
    }

    /* ---- building ---- */
    mount(stage, opt) {
      if (stage) this.stage = stage;
      const doc = (this.stage || this.frame || document.body).ownerDocument || document;
      ensureCss(doc);
      this.destroyDom();
      const st = this.stage;
      if (st && getComputedStyle(st).position === 'static') st.style.position = 'relative';
      // Float pad and strip: one layer over the stage.
      this.root = doc.createElement('div'); this.root.className = 'cwov'; this.root.dataset.sys = this.sys;
      this.root.setAttribute('aria-hidden', 'true');
      const th = this.def.theme || {};
      if (th.press) this.root.style.setProperty('--cwov-press', th.press);
      if (th.pressInk) this.root.style.setProperty('--cwov-press-ink', th.pressInk);
      if (th.fill) this.root.style.setProperty('--cwov-fill', th.fill);
      this.floatEl = doc.createElement('div'); this.floatEl.className = 'cwov-float'; this.root.appendChild(this.floatEl);
      this.stripEl = doc.createElement('div'); this.stripEl.className = 'cwov-strip'; this.root.appendChild(this.stripEl);
      (st || doc.body).appendChild(this.root);
      // Game & Watch: the art buttons are the boxes gnw-host.js has placed for this title.
      if (this.def.artFrom === 'gnwDef' && this.frame) this.def = Object.assign({}, this.def, { art: gnwDef(this.frame).art });
      // A variant of the same shell (the Zelda twin has Select / Start where Mario has none).
      if (this.variant && this.def.art && this.def.art.variants && this.def.art.variants[this.variant])
        this.def = Object.assign({}, this.def, { art: Object.assign({}, this.def.art, { controls: this.def.art.variants[this.variant] }) });
      // Art buttons: INSIDE the frame, so they share its box (setArtView says which part of the art it shows).
      if (this.def.art && this.frame) {
        this.artEl = doc.createElement('div'); this.artEl.className = 'cwov-art'; this.artEl.dataset.sys = this.sys;
        if (getComputedStyle(this.frame).position === 'static') this.frame.style.position = 'relative';
        this.frame.appendChild(this.artEl);
        this._art0 = this.def.art;
        this._buildArt();
      }
      for (const g of (this.def.float && this.def.float.groups) || []) for (const c of g.controls) this._build(c, this.floatEl, 'float', g);
      for (const c of this.def.strip || []) this._build(c, this.stripEl, 'strip');
      for (const el of [this.root, this.artEl].filter(Boolean)) {
        el.addEventListener('pointerdown', this._down);
        el.addEventListener('pointermove', this._move);
        el.addEventListener('pointerup', this._up);
        el.addEventListener('pointercancel', this._up);
        el.addEventListener('lostpointercapture', this._up);
        el.addEventListener('contextmenu', e => e.preventDefault());
        el.addEventListener('dragstart', e => e.preventDefault());
      }
      addEventListener('keydown', this._onKey, true); addEventListener('keyup', this._onKey, true);
      addEventListener('blur', this._relAll); addEventListener('pagehide', this._relAll);
      document.addEventListener('visibilitychange', this._vis);
      this._ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this._layout()) : null;
      if (this._ro && this.stage) this._ro.observe(this.stage);
      this._onResize = () => this._layout(); addEventListener('resize', this._onResize);
      live.add(this);
      this.setMode(opt && opt.mode || this._mode);
      return this;
    }
    _build(c, parent, layer, group) {
      const doc = parent.ownerDocument;
      const el = doc.createElement('div');
      el.className = 'cwov-c'; el.dataset.id = c.id; el.dataset.shape = c.shape || (layer === 'strip' ? 'pill' : 'rect');
      el.dataset.layer = layer;
      if (c.kind) el.dataset.kind = c.kind;
      el.setAttribute('aria-hidden', 'true');
      if (c.shape === 'dpad') {
        if (layer === 'float') { const x = doc.createElement('div'); x.className = 'cwov-cross'; el.appendChild(x); }
        for (const [k, g] of [['u', '↑'], ['d', '↓'], ['l', '←'], ['r', '→']]) {
          const a = doc.createElement('div'); a.className = 'cwov-arm ' + k; if (layer === 'float') a.textContent = g; el.appendChild(a);
        }
      } else if (layer !== 'art') {
        el.textContent = c.label || '';
        if (layer === 'strip' && c.kind === 'toggle') { const s = doc.createElement('small'); el.appendChild(s); }
      }
      if (layer === 'art') {
        const b = artBox(c, this.view);
        el.style.left = ((b.x - b.w / 2) * 100) + '%'; el.style.top = ((b.y - b.h / 2) * 100) + '%';
        el.style.width = (b.w * 100) + '%'; el.style.height = (b.h * 100) + '%';
        // A d-pad is never turned: its arms stay SCREEN arms, as its presses are screen directions.
        const rot = c.shape === 'dpad' ? (c.rot || 0) : b.rot;
        if (rot) el.style.transform = `rotate(${rot}deg)`;
        el.hidden = !!this.view && !(b.x >= 0 && b.x <= 1 && b.y >= 0 && b.y <= 1);    // its centre is off the part shown (only judged with a view)
      }
      parent.appendChild(el);
      this.ctls.push({ el, def: c, layer, group });
    }
    /* The art buttons, (re)built for the current view: the definition's controls, or its variant's. */
    _buildArt() {
      if (!this.artEl) return;
      for (const k of this.ctls.filter(k => k.layer === 'art')) k.el.remove();
      this.ctls = this.ctls.filter(k => k.layer !== 'art');
      const A = this._art0 || {}, v = this.view;
      const list = (v && v.variant && A.variants && A.variants[v.variant]) || A.controls || [];
      for (const c of list) this._build(c, this.artEl, 'art');
      const mine = this.ctls.filter(k => k.layer === 'art');
      // Usable only when every button is on the part shown: half a console's buttons is none.
      this._artUsable = mine.length > 0 && mine.every(k => !k.el.hidden);
    }
    /* WHERE THE ART BUTTONS ARE NOW (2026-10-17: "The overlay key press on the Lynx is not
       accurate to the position of the keys"). A definition's art numbers are fractions of the WHOLE
       photograph they were measured on (def.art.size). The host draws something else and says so:
         variant  which art the console wears (the Game Boy: dmg | cgb | cgbPokemon), picking
                  def.art.variants[variant] where the definition has one;
         cut      [l, t, w, h] the part of the photograph the drawn art is (an Atari body cut), in
                  fractions of the photograph; default the whole;
         turn     0 upright, 1 the art drawn a quarter turn left, 2 a quarter turn right (a turned Lynx);
         show     [l, t, w, h] the part of the drawn art the frame shows (a Game Boy cut to its screen
                  band), in fractions of the drawn art; default the whole.
       A control whose centre is not on the part shown is hidden, and then the art buttons stand down
       and the float pad (where there is one) takes over. null: the numbers as they are (as before). */
    setArtView(v) {
      const key = JSON.stringify(v || null);
      if (key === this._viewKey) return;
      this._viewKey = key; this.view = v || null;
      if (this.artEl) { this.release(); this._buildArt(); }
      this._apply();
    }
    /* A GAME & WATCH UNIT'S OWN PAD (1 Nov 2026: "For DK Jr CJ-71 the unit has a joystick on
       the left and one button on the right. When zoomed in the overlay only shows two buttons for left
       and right"). Every unit got the same float pad (Left, Right, Game A, Game B, Time) whatever its
       controls. The unit's art module now hands its own: u = { groups, artOff }.
         groups  the float groups for this unit (the stick or the cross pad, the buttons on the side
                 the unit has them, its mode buttons), replacing the definition's;
         artOff  the art buttons stand down (the Table Top close-up crops them out), so the pad shows.
       The art buttons are read again too (another unit in the same window, or the close-up ended). */
    setUnit(u) {
      const key = JSON.stringify(u || null);
      if (key === this._unitKey || !this.root) return;
      this._unitKey = key;
      this.release();
      if (u && Array.isArray(u.groups) && u.groups.length) {
        this.def = Object.assign({}, this.def, { float: Object.assign({}, this.def.float || {}, { groups: u.groups }) });
        for (const k of this.ctls.filter(k => k.layer === 'float')) k.el.remove();
        this.ctls = this.ctls.filter(k => k.layer !== 'float');
        for (const g of this.def.float.groups) for (const c of g.controls) this._build(c, this.floatEl, 'float', g);
      }
      if (this.def.artFrom === 'gnwDef' && this.frame && this.artEl) { this._art0 = gnwDef(this.frame).art; this._buildArt(); }
      this._artOff = !!(u && u.artOff);
      this._apply();
    }
    /* Float pad geometry, in pixels, from the stage's own size (not the browser's: the host
       page's in-page windows are smaller than its viewport). */
    _layout() {
      if (!this.root || !this.stage) return;
      const F = this.def.float;
      const r = this.stage.getBoundingClientRect();
      const W = r.width || this.stage.clientWidth, H = r.height || this.stage.clientHeight;
      if (!W || !H) return;
      const portrait = cfg.rotate && W / H <= 0.8;
      // The strip first: its height lifts the toast (--cw-ov-bottom) and, when narrow, the corner groups.
      let stripH = 0, stripW = 0;
      if (!this.stripEl.hidden && this.stripEl.childElementCount) { const sr = this.stripEl.getBoundingClientRect(); stripH = sr.height; stripW = sr.width; }
      try { this.stage.style.setProperty('--cw-ov-bottom', stripH ? Math.ceil(stripH + 12) + 'px' : '0px'); } catch (_) {}
      if (!F || this.floatEl.hidden) return;
      const u3 = (portrait && F.unitPortrait) || F.unit || [104, 26, 168];
      const scale = cfg.scale;
      const unit = Math.min(u3[2], Math.max(u3[0], W * u3[1] / 100)) * scale;
      const gap = (F.gap != null ? F.gap : 10) + cfg.spacing;
      const lift = stripH && (W - stripW) / 2 < unit + gap + 16 ? stripH + 16 : 0;   // clear of the strip by more than a pad's 12 px slop
      /* UNDER THE CONTROL BAR (31 Oct: "For 5200 games, the on-screen number pad sits behind the
         Control Bar and needs to sit below it"). A group docked at the top (the 5200's keypad, the
         Pokemon mini's C) hung from the stage's top edge, where the bar is. It now starts under the
         bar's bottom (measured: the bar wraps onto more lines on a phone), and when that would run
         it into a group docked below it on the same side (the fire buttons), it is made smaller to
         fit between them (never under 55%). The bar's own size changes refit it (the same observer). */
      let topClear = 0;
      const cbar = this.stage.querySelector(':scope > .cb-bar');
      if (cbar && cbar.getClientRects().length) { const br = cbar.getBoundingClientRect(); topClear = Math.max(0, Math.round(br.bottom - r.top)); }
      if (cbar && this._ro && this._barObs !== cbar) { try { this._ro.observe(cbar); this._barObs = cbar; } catch (_) {} }
      const placed = [];
      for (const g of F.groups) {
        const P = portrait && g.portrait ? Object.assign({}, g, g.portrait) : g;
        const sizes = g.controls.map(c => {
          const C = portrait && c.portrait ? Object.assign({}, c, c.portrait) : c;
          return { C, w: px(C.w, unit, W, scale), h: C.sq ? null : px(C.h, unit, W, scale) };
        });
        let gw, gh;
        if (P.row) {
          const rg = P.row.gap != null ? P.row.gap : 12;
          for (const s of sizes) if (s.h == null) s.h = s.w;
          gw = sizes.reduce((a, s) => a + s.w, 0) + rg * (sizes.length - 1); gh = Math.max(...sizes.map(s => s.h));
          let x = 0; for (const s of sizes) { s.x = x; s.y = (gh - s.h) / 2; x += s.w + rg; }
        } else {
          gw = px(P.w, unit, W, scale); gh = px(P.h, unit, W, scale);
          for (const s of sizes) {
            s.w = s.C.w <= 1 && !Array.isArray(s.C.w) ? s.C.w * gw : s.w;
            s.h = s.C.sq ? s.w : (s.C.h <= 1 && !Array.isArray(s.C.h) ? s.C.h * gh : s.h);
            s.x = s.C.x * gw - s.w / 2; s.y = s.C.y * gh - s.h / 2;
          }
        }
        // A rotated control paints taller than its box: hang it from its painted bottom (the GB fix).
        let over = 0;
        for (const s of sizes) if (s.C.rot) { const a = Math.abs(s.C.rot) * Math.PI / 180; over = Math.max(over, (s.w * Math.sin(a) + s.h * Math.cos(a) - s.h) / 2); }
        const dock = P.dock || 'bl';
        let gx, gy;
        const b = (dock[0] === 'b' ? (P.bottom != null ? P.bottom + cfg.spacing : gap) + over + (dock === 'bc' ? 0 : lift) : 0);
        if (dock === 'bl' || dock === 'tl') gx = gap; else if (dock === 'br' || dock === 'tr') gx = W - gap - gw; else gx = (W - gw) / 2;
        gy = dock[0] === 't' ? topClear + gap + (P.top || 0) : H - b - gh - (dock === 'bc' && stripH ? stripH + 6 : 0) - (P.raise ? px(P.raise, unit, W, scale) : 0);
        placed.push({ g, sizes, dock, gx, gy, gw, gh });
      }
      // A top group that would reach a lower group on its side (or the stage's foot) is scaled down to fit.
      for (const p of placed) {
        if (p.dock[0] !== 't') continue;
        let limit = H - gap;
        for (const q of placed) if (q !== p && q.dock[0] !== 't' && q.gx < p.gx + p.gw && q.gx + q.gw > p.gx) limit = Math.min(limit, q.gy - gap);
        // The console's picture below it on the same side (a phone upright: the television under the bar).
        const art = this.frame || this.stage.querySelector('#lcdWrap');
        if (art && art.getClientRects().length) {
          const fr = art.getBoundingClientRect();
          let top = fr.top; for (const im of art.querySelectorAll('img, canvas')) { const q = im.getBoundingClientRect(); if (q.height && q.top < top) top = q.top; }   // the art drawn past its box
          const ft = top - r.top, fl = fr.left - r.left;
          if (ft > p.gy + 20 && fl < p.gx + p.gw && fl + fr.width > p.gx) limit = Math.min(limit, ft - gap / 2);
        }
        if (p.gy + p.gh <= limit) continue;
        const k = Math.max(0.55, (limit - p.gy) / p.gh);
        const right = p.gx + p.gw, mid = p.gx + p.gw / 2;
        p.gw *= k; p.gh *= k;
        for (const s of p.sizes) { s.x *= k; s.y *= k; s.w *= k; s.h *= k; }
        p.gx = p.dock === 'tr' ? right - p.gw : p.dock === 'tl' ? p.gx : mid - p.gw / 2;
      }
      for (const { g, sizes, gx, gy } of placed) {
        sizes.forEach((s, i) => {
          const k = this.ctls.find(c => c.def === g.controls[i]); if (!k) return;
          const el = k.el;
          el.style.left = Math.round(gx + s.x) + 'px'; el.style.top = Math.round(gy + s.y) + 'px';
          el.style.width = Math.round(s.w) + 'px'; el.style.height = Math.round(s.h) + 'px';
          el.style.transform = s.C.rot ? `rotate(${s.C.rot}deg)` : '';
        });
      }
    }

    /* ---- modes and visibility ---- */
    setMode(m) {
      if (!['device', 'full', 'off'].includes(m)) m = 'device';
      if (m !== this._mode) this.release();
      this._mode = m;
      this._apply();
    }
    mode() { return this._mode; }
    _apply() {
      if (!this.root) return;
      const m = this._mode, f = floatWanted();
      const hasArt = !!(this.def.art && this.artEl && this._artUsable !== false && !this._artOff);
      // Device mode: the art buttons are the console's; the float pad only where the art has
      // no buttons to press (or the definition says so) and Display wants it. Full: no art.
      const floatOn = m !== 'off' && !!this.def.float && f && (m === 'full' || !hasArt || this.def.floatWithArt);
      const wasFloat = this.floatEl.hidden === false;
      this.root.hidden = m === 'off';
      if (this.artEl) this.artEl.hidden = m !== 'device' || !hasArt;
      this.floatEl.hidden = !floatOn;
      let shown = 0;
      for (const k of this.ctls) if (k.layer === 'strip') {
        const w = k.def.when, fn = w && this.when[w];
        let on = true; if (w) { try { on = !!(fn && fn()); } catch (_) { on = false; } }
        // A toggle whose switch the machine does not have now (the 2600 on the 5200's VCS
        // Cartridge Adapter has no TV type switch) is not shown: its call says so.
        if (on && k.def.kind === 'toggle' && k.def.call) { const c = this.calls[k.def.call]; try { if (c && c.has && !c.has(k.def.arg)) on = false; } catch (_) {} }
        k.el.style.display = on ? '' : 'none'; if (on) shown++;
      }
      this.stripEl.hidden = m === 'off' || !shown;
      if (wasFloat && !floatOn) this.release();
      this.root.style.setProperty('--cwov-op', String(cfg.opacity));
      this._paintToggles(); this._paint();
      this._layout();
    }

    /* ---- the gesture ---- */
    _ctlOf(el) { for (const k of this.ctls) if (k.el === el) return k; return null; }
    _hit(x, y, id) {
      const out = new Set();
      const k = this._pick(x, y, id, false);             // a toggle answers a tap (pointerup), not a hold
      if (k) { if (k.def.shape === 'dpad') this._dpad(k, x, y, out); else if (k.def.input) out.add(k.def.input); }
      return out;
    }
    /* The ONE control a finger at x, y gets (see BEHAVIOUR). Only where touch areas overlap does
       it look further: the buttons as drawn (no slop) first, the smaller on top where two drawn
       shapes meet (a pill over the d-pad's base); between buttons, the one this finger holds, else
       the nearest drawn edge. */
    _pick(x, y, id, toggles) {
      const doc = this.root.ownerDocument, html = doc.documentElement;
      const at = tight => {
        let list = [];
        if (tight) html.classList.add('cwov-tight');
        try { list = doc.elementsFromPoint(x, y); } catch (_) { list = []; }
        if (tight) html.classList.remove('cwov-tight');
        const o = [];
        for (const el of list) { const k = this._ctlOf(el); if (k && !o.includes(k) && (toggles || k.def.kind !== 'toggle')) o.push(k); }
        return o;
      };
      const cand = at(false);
      if (cand.length < 2) return cand[0] || null;
      const area = k => k.el.offsetWidth * k.el.offsetHeight;
      const drawn = at(true).filter(k => cand.includes(k));
      if (drawn.length) return drawn.reduce((a, b) => (area(b) < area(a) ? b : a));
      const mine = id != null && this.byPointer.get(id);
      const held = mine && cand.find(k => k.def.input && mine.has(k.def.input));
      if (held) return held;
      const gap = k => { const r = k.el.getBoundingClientRect(); return Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom)); };
      return cand.reduce((a, b) => (gap(b) < gap(a) ? b : a));
    }
    /* Eight-way from the angle in SCREEN space, dead centre 20% (the Game Boy's rule). Screen
       space on purpose: a turned Lynx's page turns screen directions into console ones itself. */
    _dpad(k, x, y, out) {
      const r = k.el.getBoundingClientRect();
      const nx = (x - (r.left + r.width / 2)) / (r.width / 2 || 1), ny = (y - (r.top + r.height / 2)) / (r.height / 2 || 1);
      if (Math.hypot(nx, ny) < 0.2) return;
      const d = Object.assign({}, DIRS, k.def.dirs || {});
      const oct = Math.round(Math.atan2(ny, nx) / (Math.PI / 4)) & 7;
      if (oct === 7 || oct === 0 || oct === 1) out.add(d.right);
      if (oct === 3 || oct === 4 || oct === 5) out.add(d.left);
      if (oct === 1 || oct === 2 || oct === 3) out.add(d.down);
      if (oct === 5 || oct === 6 || oct === 7) out.add(d.up);
    }
    _down(e) {
      const k = this._pick(e.clientX, e.clientY, null, true) || this._ctlOf(e.target && e.target.closest ? e.target.closest('.cwov-c') : null);
      if (!k) return;
      e.preventDefault(); e.stopPropagation();
      try { k.el.setPointerCapture(e.pointerId); } catch (_) {}
      if (k.def.kind === 'toggle') { this._tapToggle = { id: e.pointerId, k }; k.el.classList.add('lit'); return; }
      this.active.add(e.pointerId);
      if (k.def.shape === 'dpad') this.dpadOf.set(e.pointerId, k);
      this._apply1(e.pointerId, this._inputsAt(e.pointerId, e.clientX, e.clientY));
    }
    /* A finger that went down on a d-pad steers that d-pad by its angle wherever it slides,
       as a real pad's thumb does: off its square it still points the same way. */
    _inputsAt(id, x, y) {
      const k = this.dpadOf.get(id);
      if (!k) return this._hit(x, y, id);
      const out = new Set(); this._dpad(k, x, y, out); return out;
    }
    _move(e) {
      if (!this.active.has(e.pointerId)) return;
      e.preventDefault();
      this._apply1(e.pointerId, this._inputsAt(e.pointerId, e.clientX, e.clientY));
    }
    _up(e) {
      const t = this._tapToggle;
      if (t && t.id === e.pointerId) {
        this._tapToggle = null; t.k.el.classList.remove('lit');
        if (e.type === 'pointerup') this.toggle(t.k.def.id);
      }
      this.active.delete(e.pointerId); this.dpadOf.delete(e.pointerId);
      if (this.byPointer.has(e.pointerId)) this._apply1(e.pointerId, new Set());
    }
    _apply1(id, inputs) {
      const prev = this.byPointer.get(id);
      if (prev) for (const i of prev) if (!inputs.has(i)) this._rel(i);
      for (const i of inputs) if (!prev || !prev.has(i)) this._acq(i);
      if (inputs.size) this.byPointer.set(id, inputs); else this.byPointer.delete(id);
      this._paint();
    }
    _acq(i) { const n = (this.count.get(i) || 0) + 1; this.count.set(i, n); if (n === 1) this._send(i, true); }
    _rel(i) { const n = (this.count.get(i) || 0) - 1; if (n > 0) { this.count.set(i, n); return; } this.count.delete(i); this._send(i, false); }
    release() {
      this.byPointer.clear(); this.active.clear(); this.dpadOf.clear();
      for (const i of Array.from(this.count.keys())) { this.count.delete(i); this._send(i, false); }
      if (this._tapToggle) { this._tapToggle.k.el.classList.remove('lit'); this._tapToggle = null; }
      this._paint();
    }
    _send(input, down) {
      down ? this.stats.downs++ : this.stats.ups++;
      try { if (this.customSend && this.customSend(input, down) === true) return; } catch (err) { console.warn('[overlay] send:', err); }
      const m = /^(pm|gnw|call):(.+)$/.exec(input);
      try {
        if (!m) return sendKey(input, down);
        if (m[1] === 'pm') { const d = pmDev(); if (d) down ? d.press(m[2]) : d.release(m[2]); return; }
        if (m[1] === 'gnw') { if (down && window.gnwPress) window.gnwPress(m[2]); else if (!down && window.gnwRelease) window.gnwRelease(m[2]); return; }
        const c = this.calls[m[2].split(':')[0]];
        if (c && c.set) c.set(m[2].split(':')[1], down);
      } catch (err) { console.warn('[overlay] ' + input + ':', err); }
    }
    /* A strip toggle (difficulty, colour / B&W): flips the switch through the page's call. */
    toggle(id) {
      const k = this.ctls.find(c => c.def.id === id && c.def.kind === 'toggle'); if (!k) return null;
      const c = this.calls[k.def.call]; if (!c) return null;
      const on = !c.get(k.def.arg); c.set(k.def.arg, on);
      this._paintToggles();
      return on;
    }
    _paintToggles() {
      for (const k of this.ctls) {
        if (k.def.kind !== 'toggle') continue;
        const c = this.calls[k.def.call]; let on = false; try { on = !!(c && c.get(k.def.arg)); } catch (_) {}
        k.el.dataset.on = on ? '1' : '0';
        const s = k.el.querySelector('small'); if (s) s.textContent = (k.def.states || ['off', 'on'])[on ? 1 : 0];
      }
    }

    /* ---- feedback ---- */
    _onKey(e) {
      if (!e.code) return;
      if (e.type === 'keydown') this.keyHeld.add(e.code); else this.keyHeld.delete(e.code);
      if (e.type === 'keydown' && this.ctls.some(k => k.def.kind === 'toggle')) setTimeout(() => this._paintToggles(), 0);
      this._paint();
    }
    lit() {
      const s = new Set(this.count.keys());
      if (cfg.showInputs) for (const c of this.keyHeld) s.add(c);
      return s;
    }
    /* THE CONSOLE'S OWN BUTTONS LIGHT FOR EVERY PRESS (2026-10-17: "when I press a key on the
       keyboard, the overlay will light up and it does not on the Lynx. It does on the G&W"). The
       host hands a source of what the game has held now from any input (keys with the viewer's
       remaps, a pad, touch), by the functions' default key codes; the art buttons and the strip
       light from it always. THE FLOAT PAD LIGHTS FOR A CONTROLLER TOO (7 Nov 2026: "When pressing the
       controller buttons, the same overlay buttons should light up"): padFn is the same thing for the
       controller's presses alone; the keyboard's light the float pad only with "Show inputs" as before.
       The host calls refreshLit() each frame; it repaints only when the set changed. */
    setLitSource(fn, padFn) { this.litSource = typeof fn === 'function' ? fn : null; this.litPad = typeof padFn === 'function' ? padFn : null; this._litKey = ''; this._paint(); }
    refreshLit() {
      if (!this.litSource || !this.root) return;
      let s, p; try { s = this.litSource(); p = this.litPad ? this.litPad() : null; } catch (_) { return; }
      const key = Array.from(s || []).sort().join(',') + '|' + Array.from(p || []).sort().join(',');
      if (key === this._litKey) return;
      this._litKey = key; this._srcLit = new Set(s || []); this._padLit = new Set(p || []); this._paint();
    }
    _paint() {
      const L0 = this.lit(), src = this.litSource ? (this._srcLit || new Set()) : null, pad = this._padLit || new Set();
      const litOf = k => (src && k.layer !== 'float') ? new Set([...L0, ...src]) : (pad.size ? new Set([...L0, ...pad]) : L0);
      for (const k of this.ctls) {
        const held = Array.from(this.byPointer.values()).some(set => k.def.shape === 'dpad'
          ? ['up', 'down', 'left', 'right'].some(n => set.has(Object.assign({}, DIRS, k.def.dirs || {})[n])) : set.has(k.def.input));
        k.el.classList.toggle('held', held);
        if (k.def.kind === 'toggle') continue;
        const L = litOf(k);
        if (k.def.shape === 'dpad') {
          const d = Object.assign({}, DIRS, k.def.dirs || {});
          for (const [cls, n] of [['u', 'up'], ['d', 'down'], ['l', 'left'], ['r', 'right']]) {
            const a = k.el.querySelector('.cwov-arm.' + cls); if (a) a.classList.toggle('lit', L.has(d[n]));
          }
        } else k.el.classList.toggle('lit', L.has(k.def.input));
      }
    }

    /* ---- Settings rows ---- */
    settingsNode() {
      const doc = (this.root && this.root.ownerDocument) || document;
      ensureCss(doc);
      const n = doc.createElement('div'); n.className = 'cwov-set';
      n.innerHTML = `
        <div class="row"><span>On-screen buttons</span><span class="seg" data-k="display">
          <button type="button" data-v="auto">Auto</button><button type="button" data-v="on">On</button><button type="button" data-v="off">Off</button></span></div>
        <div class="hint">Auto shows them on a touch screen, and hides them while a gamepad is connected.</div>
        <label class="row"><span>Light buttons pressed on the keyboard</span><input type="checkbox" data-k="showInputs"></label>
        <label class="row"><span>Opacity</span><input type="range" min="0.2" max="1" step="0.05" data-k="opacity"></label>
        <label class="row"><span>Size</span><input type="range" min="0.75" max="1.5" step="0.05" data-k="scale"></label>
        <label class="row"><span>Spacing from the edges</span><input type="range" min="0" max="48" step="2" data-k="spacing"></label>
        <label class="row"><span>Portrait layout on a portrait screen</span><input type="checkbox" data-k="rotate"></label>`;
      const sync = () => {
        for (const b of n.querySelectorAll('[data-k="display"] button')) b.setAttribute('aria-pressed', String(b.dataset.v === cfg.display));
        for (const i of n.querySelectorAll('input')) { if (i.type === 'checkbox') i.checked = !!cfg[i.dataset.k]; else i.value = cfg[i.dataset.k]; }
      };
      n.addEventListener('click', e => { const b = e.target.closest('[data-k="display"] button'); if (b) { set({ display: b.dataset.v }); sync(); } });
      n.addEventListener('input', e => { const i = e.target; if (!i.dataset || !i.dataset.k) return; set({ [i.dataset.k]: i.type === 'checkbox' ? i.checked : +i.value }); });
      sync();
      return n;
    }

    refresh() { this._apply(); return this; }
    held() { return Array.from(this.count.keys()); }
    info() {
      return { build: BUILD, sys: this.sys, mode: this._mode, held: this.held(), lit: Array.from(this.lit()), stats: Object.assign({}, this.stats),
        float: !!(this.floatEl && !this.floatEl.hidden), strip: !!(this.stripEl && !this.stripEl.hidden), art: !!(this.artEl && !this.artEl.hidden), view: this.view || null, cfg: Object.assign({}, cfg) };
    }
    destroyDom() {
      if (this.root) this.root.remove(); if (this.artEl) this.artEl.remove();
      this.root = this.artEl = this.floatEl = this.stripEl = null; this.ctls = [];
    }
    destroy() {
      this.release();
      removeEventListener('keydown', this._onKey, true); removeEventListener('keyup', this._onKey, true);
      removeEventListener('blur', this._relAll); removeEventListener('pagehide', this._relAll);
      document.removeEventListener('visibilitychange', this._vis);
      if (this._onResize) removeEventListener('resize', this._onResize);
      if (this._ro) this._ro.disconnect();
      this.destroyDom(); live.delete(this);
      if (instances.get(this.sys) === this) instances.delete(this.sys);
    }
  }

  /* ------------------------------------------------------------ definitions */
  const defs = new Map();
  function load(sys) {
    if (defs.has(sys)) return defs.get(sys);
    const p = fetch(HERE + 'overlays/' + sys + '.json?v=' + BUILD).then(r => { if (!r.ok) throw new Error('no overlay for ' + sys); return r.json(); });
    defs.set(sys, p); p.catch(() => defs.delete(sys));
    return p;
  }
  /* Game & Watch: the hotspot boxes gnw-host.js has ALREADY placed on #play-device from its
     measured GAMES registry (inline left/top/width/height %, hidden when a title lacks one).
     Reading them back keeps every measured position exactly and keeps one source of truth. */
  const GNW_CLASS = { 'hammer-left': 'left', 'hammer-right': 'right', 'quad-btn1': 'btn1', 'quad-btn2': 'btn2', 'quad-btn3': 'btn3', 'quad-btn4': 'btn4',
    'round-a': 'gameA', 'round-b': 'gameB', 'round-time': 'time', 'round-alarm': 'alarm', 'updown-hit': 'hit', 'updown-up': 'up', 'updown-down': 'down',
    'hammer-open': 'open', 'hammer-jump': 'jump' };
  function gnwDef(root) {
    root = root || document.getElementById('play-device');
    const controls = [];
    if (root) for (const el of root.querySelectorAll('.play-hotspot')) {
      if (el.style.display === 'none' || getComputedStyle(el).display === 'none') continue;
      const cls = Array.from(el.classList).find(c => GNW_CLASS[c]); if (!cls) continue;
      const cs = getComputedStyle(el), pr = el.offsetParent ? el.offsetParent.getBoundingClientRect() : null;
      const pc = (v, k) => (/%$/.test(v) ? parseFloat(v) / 100 : null);
      let l = pc(el.style.left), t = pc(el.style.top), w = pc(el.style.width), h = pc(el.style.height);
      if ([l, t, w, h].some(v => v == null) && pr && pr.width) { const r = el.getBoundingClientRect(); l = (r.left - pr.left) / pr.width; t = (r.top - pr.top) / pr.height; w = r.width / pr.width; h = r.height / pr.height; }
      const name = GNW_CLASS[cls];
      controls.push({ id: name, label: el.title || name, input: 'gnw:' + name, shape: cs.borderRadius === '50%' ? 'circle' : 'rect', x: l + w / 2, y: t + h / 2, w, h });
    }
    return { format: 'cw-overlay/1', sys: 'gnw', label: 'Game & Watch', art: { controls },
      provenance: [{ what: 'every hotspot', source: 'play/gnw/gnw-host.js GAMES registry (read back from the placed .play-hotspot boxes)', licence: 'site-owned measurements of the community .lay artwork, settled 2026-09-23 (licenses/THIRD-PARTY-NOTICES section 2)' }] };
  }

  const instances = new Map();
  function create(o) {
    if (!o || !o.sys) throw new Error('CwOverlay.create: a sys is required');
    const old = instances.get(o.sys);
    if (old && old.root && old.root.isConnected && !o.fresh) {     // one overlay per system per document
      if (o.frame) old.frame = o.frame; if (o.calls) Object.assign(old.calls, o.calls);
      return old;
    }
    if (old) old.destroy();
    const ov = new Overlay(o);
    instances.set(o.sys, ov);
    return ov;
  }

  window.CwOverlay = { BUILD, create, load, gnwDef, instance: sys => instances.get(sys) || null,
    settings: () => Object.assign({}, cfg), set, floatWanted, defaults: Object.assign({}, DEFAULTS), STORE, sendKey };
  try { window.dispatchEvent(new Event('cw-overlay-ready')); } catch (_) {}
})();

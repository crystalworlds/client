/*
 * play/play-pad.js -- gamepads in every play window (Keys phase 4, 2026-10-04).
 *
 * The design is the controller design, section 6.2 ("Gamepad in the
 * play window") and 7 (phase 4). ONE helper for every system, beside
 * play/play-keys.js:
 *
 *   - Loaded by every framed play page (Game Boy / Color, the NES family, the
 *     four Atari pages, the two colour twins, Tetris Jr.) and by the host page
 *     itself for the two windows that run in the page (Game & Watch,
 *     Pokemon mini).
 *   - It never polls. The host's gamepad.js polls navigator.getGamepads() on
 *     the page (one poll for the whole site, only while a pad is connected and
 *     the tab is visible) and hands this file the buttons each pad holds:
 *       gnwPlayPad.feed([['A','Up'], ['Start'], ...], { ov: 'play-overlay' })
 *     One array per pad, in order: pad 1 is player 1, pad 2 player 2, and so on.
 *   - It turns those buttons into the SAME presses the keyboard sends: a
 *     synthetic key on the game's own key table (so a key the game already
 *     knows is the only door in, and what the Controls screen shows is what a
 *     pad presses), or the core's own named press where the window has one
 *     (Pokemon mini: press('a'); the NES's players 3 and 4: nes_set_buttons34).
 *   - Select+Start together, or the pad's Home/Guide button, is Back: it goes in
 *     as an Escape key, so the window's own sub-screen closes first, else the
 *     host's pause menu opens (keys.js), exactly as a keyboard's Escape does.
 *   - R3 (the right stick pressed) opens the help over the game (Game help,
 *     2026-10-04), the same as the ? key; the game pauses while it is open.
 *
 * BUTTON NAMES (the host's, gamepad.js):
 *   A B X Y   the face buttons BY THE LETTER PRINTED ON THEM (2026-10-16):
 *             gamepad.js renames a Nintendo-lettered pad's positions, so A is
 *             always the button printed A (bottom on an Xbox-lettered pad, right
 *             on a Nintendo-lettered one)
 *   LB RB LT RT, Select, Start, L3 R3, Up Down Left Right (D-pad and left
 *   stick), Home (Guide).
 * The console's own A and B are the printed A and B (2026-10-16: "the A
 * button always feels most comfortable as the A button"). X repeats A and Y
 * repeats B, so any face button does something. Consoles with numbered fire
 * buttons (Atari 7800, 5200): the printed A is fire 1, B fire 2.
 *
 * FOR THE UNIFIED PLAY WINDOW (doc section 6.2, a future project): this file is
 * that window's gamepad layer already. MAPS is one table per system; a window
 * adopts it by loading this file and naming its system (feed's ctx.system, or
 * the page's path). The per-system override hook below (localStorage
 * 'gnw.pad.games.v2', {system: [player1Map, player2Map]}) is where the Controls
 * screen's Gamepad tab will save a remap.
 *
 * KEYS P5 (2026-10-04): Settings -> Keyboard & controllers -> Game controls remaps each
 * system's player-1 pad buttons (saved in 'gnw.pad.games.v2', read by feed) and keyboard keys
 * (saved in 'gnw.keys.games.v1', applied by onKbd below, before the window's own handlers).
 * FN is each system's list of console functions; gnwPlayPad.table(sys) is what Settings shows.
 *
 * Sound: none here. A pad press is not a user gesture to a browser, so it never
 * unlocks audio by itself (the window's own first key or tap still does).
 */
(function () {
  'use strict';
  if (window.gnwPlayPad) return;

  const BUILD = '20261017-pad8-stick';
  const MENU = '@menu';                 // a target: open the window menu (Back)
  const DIRS = { Up: 'ArrowUp', Down: 'ArrowDown', Left: 'ArrowLeft', Right: 'ArrowRight' };
  const NIN = Object.assign({}, DIRS, { A: 'KeyX', B: 'KeyZ', X: 'KeyX', Y: 'KeyZ', Start: 'Enter', Select: 'ShiftRight' });   // printed A = the console's A (KeyX)

  /* One table per system: player -> { pad button: key code (or a named press) }.
     `label` is for the docs and the ? list; `direct` is a named-press table. */
  const MAPS = {
    gb:    { label: 'Game Boy / Game Boy Color', players: [NIN] },
    nes:   { label: 'NES / Famicom / Famicom Disk System', players: [NIN,
             { Up: 'KeyI', Down: 'KeyK', Left: 'KeyJ', Right: 'KeyL', A: 'KeyG', B: 'KeyF', X: 'KeyG', Y: 'KeyF', Start: 'KeyT', Select: 'KeyR' }],
             four: true },                                                     // players 3 and 4: nes_set_buttons34 (Four Score / Famicom 4P titles)
    a2600: { label: 'Atari 2600', players: [
             Object.assign({}, DIRS, { A: 'Space', B: 'Space', X: 'Space', Y: 'Space', Start: 'F1', Select: 'F2' }),          // fire; Start = Game Reset, Select = Game Select
             { Up: 'KeyW', Down: 'KeyS', Left: 'KeyA', Right: 'KeyD', A: 'KeyQ', B: 'KeyQ', X: 'KeyQ', Y: 'KeyQ', Start: 'F1', Select: 'F2' }] },
    a7800: { label: 'Atari 7800', players: [
             Object.assign({}, DIRS, { A: 'KeyZ', B: 'KeyX', X: 'KeyZ', Y: 'KeyX', Start: 'Enter', Select: 'F2', RB: 'F3' }),    // Start = Reset, Select = Select, RB = Pause
             { Up: 'KeyW', Down: 'KeyS', Left: 'KeyA', Right: 'KeyD', A: 'KeyF', B: 'KeyG', X: 'KeyF', Y: 'KeyG', Start: 'Enter', Select: 'F2' }] },
    /* The 5200 (2026-10-10): the stick's directions (play/atari5200/app.js reads a pad's
       left stick in proportion itself), two fire buttons, and the controller's Start, Pause
       and Reset keys. The keypad stays on the keyboard and the on-screen overlay. */
    a5200: { label: 'Atari 5200', players: [
             Object.assign({}, DIRS, { A: 'KeyZ', B: 'KeyX', X: 'KeyZ', Y: 'KeyX', Start: 'Enter', Select: 'F3', LB: 'F1' }),     // lower fire, upper fire; Start, Select = Pause, LB = Reset
             { Up: 'KeyW', Down: 'KeyS', Left: 'KeyA', Right: 'KeyD', A: 'KeyG', B: 'KeyH', X: 'KeyG', Y: 'KeyH' }] },
    alynx: { label: 'Atari Lynx', players: [
             Object.assign({}, DIRS, { A: 'KeyX', B: 'KeyZ', X: 'KeyX', Y: 'KeyZ', Start: 'Enter', Select: 'Digit1', LB: 'Digit1', RB: 'Digit2' })] },  // printed A = Lynx A; Start = Pause, Option 1 / 2
    twin:  { label: 'Super Mario Bros. / Zelda colour units', players: [
             Object.assign({}, NIN, { LB: 'Digit1', RB: 'Digit3', LT: 'Digit2' })] },                                            // Game, Time, Pause
    tj:    { label: 'Tetris Jr.', players: [
             Object.assign({}, DIRS, { A: 'Space', B: 'Space', X: 'Space', Y: 'Space', Start: 'Digit1', Select: 'Digit2', LB: 'Digit3' })] }, // rotate; Game A, Game B, Time
    gnw:   { label: 'Game & Watch', players: [
             Object.assign({}, DIRS, { A: 'Space', B: 'Space', X: 'Space', Y: 'Space', Start: 'Digit1', Select: 'Digit2', LB: 'Digit3', RB: 'Digit4' }),  // Game A, Game B, Time, Alarm
             { Up: 'KeyW', Down: 'KeyS', Left: 'KeyA', Right: 'KeyD', A: 'KeyF', B: 'KeyF', X: 'KeyF', Y: 'KeyF' }],                                // Micro Vs. titles only
             p2only: 'microVs' },
    pm:    { label: 'Pokemon mini', direct: true, players: [
             { Up: 'up', Down: 'down', Left: 'left', Right: 'right', A: 'a', B: 'b', X: 'a', Y: 'b', LB: 'c', RB: 'c', RT: 'shake', Start: MENU }] },    // no Start on the console
  };
  /* Keys P5 (2026-10-04): each system's console functions for player 1, by the KEY CODE the
     window's own key table already answers to (play/<system>/app.js and friends), with a
     label. These are what Settings -> Keyboard & controllers -> Game controls remaps: a pad
     button or a keyboard key is pointed at one of them. Pokemon mini's pad presses by name
     (PAD_FN below); its keyboard keys are the device's KEYS table. */
  const ARROWS = [['ArrowUp', 'Up'], ['ArrowDown', 'Down'], ['ArrowLeft', 'Left'], ['ArrowRight', 'Right']];
  const FN = {
    gb:    ARROWS.concat([['KeyX', 'A'], ['KeyZ', 'B'], ['Enter', 'Start'], ['ShiftRight', 'Select']]),
    nes:   ARROWS.concat([['KeyX', 'A'], ['KeyZ', 'B'], ['Enter', 'Start'], ['ShiftRight', 'Select']]),
    a2600: ARROWS.concat([['Space', 'Fire'], ['F1', 'Game Reset'], ['F2', 'Game Select']]),
    a7800: ARROWS.concat([['KeyZ', 'Fire 1'], ['KeyX', 'Fire 2'], ['Enter', 'Reset'], ['F2', 'Select'], ['F3', 'Pause']]),
    a5200: ARROWS.concat([['KeyZ', 'Fire 1'], ['KeyX', 'Fire 2'], ['Enter', 'Start'], ['F3', 'Pause'], ['F1', 'Reset'],
             ['Digit1', 'Keypad 1'], ['Digit2', 'Keypad 2'], ['Digit3', 'Keypad 3'], ['Digit4', 'Keypad 4'], ['Digit5', 'Keypad 5'],
             ['Digit6', 'Keypad 6'], ['Digit7', 'Keypad 7'], ['Digit8', 'Keypad 8'], ['Digit9', 'Keypad 9'], ['Digit0', 'Keypad 0'],
             ['Minus', 'Keypad *'], ['Equal', 'Keypad #']]),
    alynx: ARROWS.concat([['KeyX', 'A'], ['KeyZ', 'B'], ['Enter', 'Pause'], ['Digit1', 'Option 1'], ['Digit2', 'Option 2']]),
    twin:  ARROWS.concat([['KeyX', 'A'], ['KeyZ', 'B'], ['Enter', 'Start'], ['ShiftRight', 'Select'], ['Digit1', 'Game'], ['Digit2', 'Pause'], ['Digit3', 'Time']]),
    tj:    [['ArrowLeft', 'Left'], ['ArrowRight', 'Right'], ['ArrowUp', 'Up (rotate)'], ['ArrowDown', 'Drop'], ['Space', 'Rotate'], ['Digit1', 'Game A'], ['Digit2', 'Game B'], ['Digit3', 'Time']],
    gnw:   ARROWS.concat([['Space', 'Action'], ['Digit1', 'Game A'], ['Digit2', 'Game B'], ['Digit3', 'Time'], ['Digit4', 'Alarm']]),
    pm:    ARROWS.concat([['KeyX', 'A'], ['KeyZ', 'B'], ['KeyC', 'C'], ['KeyS', 'Shake'], ['KeyP', 'Power']]),
  };
  const PAD_FN = { pm: [['up', 'Up'], ['down', 'Down'], ['left', 'Left'], ['right', 'Right'], ['a', 'A'], ['b', 'B'], ['c', 'C'], ['shake', 'Shake'], [MENU, 'Pause menu']] };
  /* Keys a window keeps for itself (not game buttons): a remap may not land on one. */
  const WINDOW_KEYS = {
    gnw: { KeyR: 'Reset', KeyL: 'Log', Minus: 'Mute', KeyQ: 'Left (Q)', KeyE: 'Right (E)', KeyA: 'Player 2 Left', KeyD: 'Player 2 Right', KeyW: 'Player 2 Up', KeyS: 'Player 2 Down', KeyF: 'Player 2 Action' },
    tj: { KeyP: 'Pause', Minus: 'Mute', KeyQ: 'Left (Q)', KeyE: 'Right (E)' },
    alynx: { KeyR: 'Turn the screen', KeyP: 'Pause (P)' },
    twin: { KeyP: 'Power', KeyQ: 'B (Q)', KeyE: 'A (E)', BracketLeft: 'Select ([)', BracketRight: 'Start (])' },
  };
  /* PAD_STORE v2 (2026-10-16): remaps are by printed letter now; v1's were by position and
     would mean something else, so they are not read. */
  const GAME_STORE = 'gnw.keys.games.v1', PAD_STORE = 'gnw.pad.games.v2';
  // Parsed once per change of the stored text (feed runs every frame; a key on every press).
  const cache = {};
  function stored(name) {
    let raw = null; try { raw = localStorage.getItem(name); } catch (_) { raw = null; }
    const c = cache[name];
    if (c && c.raw === raw) return c.val;
    let val = null; try { val = JSON.parse(raw || 'null'); } catch (_) { val = null; }
    cache[name] = { raw, val };
    return val;
  }
  function save(name, val) { try { if (val && Object.keys(val).length) localStorage.setItem(name, JSON.stringify(val)); else localStorage.removeItem(name); } catch (_) {} }
  /* The keyboard remap of a system: { defaultCode: viewerCode }. */
  function keyRemap(sys) { const o = stored(GAME_STORE); return o && o[sys] && typeof o[sys] === 'object' ? o[sys] : {}; }
  function setKeyRemap(sys, map) {
    const all = Object.assign({}, stored(GAME_STORE) || {});
    const clean = {};
    for (const [from, to] of Object.entries(map || {})) if (to && to !== from) clean[from] = to;
    if (Object.keys(clean).length) all[sys] = clean; else delete all[sys];
    save(GAME_STORE, all);
  }
  /* The pad remap of a system: player 1's { button: function code (or null: nothing) }. */
  function padRemap(sys) { const o = stored(PAD_STORE); return o && Array.isArray(o[sys]) && o[sys][0] && typeof o[sys][0] === 'object' ? o[sys][0] : {}; }
  function setPadRemap(sys, map) {
    const all = Object.assign({}, stored(PAD_STORE) || {});
    const base = MAPS[sys] ? MAPS[sys].players[0] : {};
    const clean = {};
    for (const [b, t] of Object.entries(map || {})) if ((t || null) !== (base[b] || null)) clean[b] = t || null;
    if (Object.keys(clean).length) { const rest = Array.isArray(all[sys]) ? all[sys].slice(1) : []; all[sys] = [clean].concat(rest); } else delete all[sys];
    save(PAD_STORE, all);
  }
  // The Controls screen's Gamepad tab (phase 5 / the unified window) saves a remap here.
  function mapsFor(sys) {
    const m = MAPS[sys]; if (!m) return null;
    const o = stored(PAD_STORE);
    if (!o || !Array.isArray(o[sys])) return m.players;
    return m.players.map((p, i) => Object.assign({}, p, o[sys][i] || {}));
  }

  /* Which system this document is. A framed page knows by its path; the host
     page is told by the overlay it feeds. */
  function systemHere(ctx) {
    if (ctx && ctx.system) return ctx.system;
    if (ctx && ctx.ov === 'play-overlay') return 'gnw';
    if (ctx && ctx.ov === 'pm-play-overlay') return 'pm';
    const p = location.pathname;
    if (/\/play\/gameboy\//.test(p)) return 'gb';
    if (/\/play\/nes\//.test(p)) return 'nes';
    if (/\/play\/atari2600\//.test(p)) return 'a2600';
    if (/\/play\/atari5200\//.test(p)) return 'a5200';
    if (/\/play\/atari7800\//.test(p)) return 'a7800';
    if (/\/play\/atarilynx\//.test(p)) return 'alynx';
    if (/\/play\/(mario|zelda)\//.test(p)) return 'twin';
    if (/\/play\/tetrisjr\//.test(p)) return 'tj';
    return null;
  }

  /* ---- synthetic keys: the game's own key handlers do the rest ---- */
  function keyOf(code) {
    if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
    if (/^Digit\d$/.test(code)) return code.slice(5);
    if (code === 'Space') return ' ';
    if (code === 'ShiftRight' || code === 'ShiftLeft') return 'Shift';
    return code;                                    // ArrowUp, Enter, F1, Escape
  }
  function target() {
    const a = document.activeElement;
    return a && a !== document.documentElement && a.dispatchEvent ? a : (document.body || document);
  }
  function key(code, down, extra) {
    const ev = new KeyboardEvent(down ? 'keydown' : 'keyup', Object.assign({
      key: keyOf(code), code, bubbles: true, cancelable: true, composed: true,
      location: /Right$/.test(code) && /^Shift|^Control|^Alt/.test(code) ? 2 : 0,
    }, extra || {}));
    try { Object.defineProperty(ev, '__gnwPad', { value: true }); } catch (_) {}
    target().dispatchEvent(ev);
  }

  /* ---- named presses ---- */
  const pmDev = () => { try { return typeof _pmActiveDevice !== 'undefined' ? _pmActiveDevice : null; } catch (_) { return null; } };   // index.html's handle
  // gnw-host.js shows its Micro Vs. control group only for a two-player Micro Vs. title.
  const gnwMicroVs = () => { const g = document.querySelector('#play-overlay .play-microvs-controls'); return !!g && g.style.display !== 'none'; };

  /* ---- state ---- */
  const S = { sys: null, sent: new Map(), direct: new Map(), four: [0, 0], chord: [], last: [], menus: 0, helps: 0 };
  // sent: key code -> refcount of (player, button) holding it; direct: name -> refcount.

  function release() {
    for (const code of Array.from(S.sent.keys())) key(code, false);
    S.sent.clear();
    const d = pmDev();
    for (const n of Array.from(S.direct.keys())) { try { if (d) d.release(n); } catch (_) {} }
    S.direct.clear();
    if (S.four[0] || S.four[1]) { S.four = [0, 0]; try { window.__gnwPad34.set(0, 0); window.__gnwPad34.set(1, 0); } catch (_) {} }
    S.last = []; S.chord = [];
  }

  function menu() {
    S.menus++;
    // Back: the window's own sub-screen closes first (play-keys.js / keys.js), else the pause menu opens.
    key('Escape', true); key('Escape', false);
  }
  /* Game help (2026-10-04): R3 (the right stick pressed) opens the site's help over the
     game, the window paused (Home stays the pause menu). A framed window asks its host
     through play-keys.js; the host page's own windows (Game & Watch, Pokemon mini) ask
     shortcuts.js directly. A system whose pad map gives R3 a console function keeps it. */
  const HELP_BTN = 'R3';
  function help() {
    S.helps++;
    try {
      if (window.parent !== window && window.gnwPlayKeys && window.gnwPlayKeys.help) return window.gnwPlayKeys.help();
      if (window.GnwShortcuts && window.GnwShortcuts.openGameHelp) return window.GnwShortcuts.openGameHelp();
    } catch (_) {}
    return false;
  }

  /* Four Score / Famicom 4-player: one byte per pad, the NES's own bit order. */
  function fourMask(held) {
    const B = (window.__gnwPad34 && window.__gnwPad34.BTN) || { A: 1, B: 2, SELECT: 4, START: 8, UP: 16, DOWN: 32, LEFT: 64, RIGHT: 128 };
    let m = 0;
    for (const n of held) {
      if (n === 'A' || n === 'X') m |= B.A; else if (n === 'B' || n === 'Y') m |= B.B;   // printed A = NES A
      else if (n === 'Start') m |= B.START; else if (n === 'Select') m |= B.SELECT;
      else if (n === 'Up') m |= B.UP; else if (n === 'Down') m |= B.DOWN; else if (n === 'Left') m |= B.LEFT; else if (n === 'Right') m |= B.RIGHT;
    }
    return m;
  }

  /* ---- a screen of the window's own in front of the game (2026-10-14) ----
     Found: in the Game Boy window, Guide then Controls opened the Keys screen,
     and from there the pad only played the game (the game showed A pressed) and
     B could not close it. While a screen of the window is open (a Control Bar
     panel or menu, focus on the bar, the NES / colour-unit / Tetris Jr. Keys and
     Saves screens, the Game & Watch toolbar's sub-screen), the pad drives that
     screen and the game gets nothing: the D-pad moves (arrow keys), A presses
     the focused item, B steps back, Home is still the menu. When B closes the
     last of it, the host is told, so a screen opened from the pause menu goes
     back to the pause menu (keys.js subClosed). */
  function uiScreen(sys, screensOnly) {
    try {
      if (sys === 'gnw') {
        const open = typeof window.gnwSubOpen === 'function' ? window.gnwSubOpen() : !!document.querySelector('#play-toolbar-pill.sub-open');
        if (open && typeof window.gnwPillBack === 'function') return { back: () => window.gnwPillBack(), move: gnwMove };
        return null;
      }
      const B = window.ControlBar && window.ControlBar.active ? window.ControlBar : null;
      if (B && (sys !== 'pm' || B.sys === 'pm')) {
        const s = B.state || {}, a = document.activeElement;
        const onBar = !!(a && a.closest && a.closest('#cb-bar'));
        return (s.panel || s.menu || (onBar && !screensOnly)) ? { back: () => B.back() } : null;
      }
      if (sys === 'pm') {
        if (document.querySelector('#pm-keys-panel.open, #pm-toolbar-pill.sub-open') && typeof pmCloseKeys === 'function') return { back: () => pmCloseKeys() };
        return null;
      }
      const K = window.gnwPlayKeys;
      if (K && K.subOpen && K.subOpen()) return { back: () => K.closeSub() };
    } catch (_) {}
    return null;
  }
  function uiKey(code) { key(code, true); key(code, false); }
  /* The Game & Watch screens (Keys, Saved states) have no arrow keys of their
     own: the D-pad walks their buttons and slots in order. */
  function gnwMove(n) {
    const root = document.querySelector('#play-save-panel.open, #play-keys-panel.open');
    if (!root) return;
    const list = Array.from(root.querySelectorAll('button, [tabindex="0"], a[href], input, select, textarea'))
      .filter(el => !el.disabled && el.getClientRects().length && !el.closest('.save-detail'));
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    const step = (n === 'Down' || n === 'Right') ? 1 : -1;
    const next = list[i < 0 ? 0 : (i + step + list.length) % list.length];
    try { next.focus({ preventScroll: false }); } catch (_) {}
  }
  function uiActivate() {
    const a = document.activeElement;
    if (a && a !== document.body && a !== document.documentElement && typeof a.click === 'function') a.click();
  }
  function told(sys, ctx) {
    setTimeout(() => {
      if (uiScreen(sys, true)) return;                 // a screen is still open: B goes on stepping back
      try {
        if (window.parent !== window && /\/play\//.test(location.pathname)) window.parent.postMessage({ gnwSubClosed: 1 }, '*');
        else if (window.GnwKeys && window.GnwKeys.subClosed) window.GnwKeys.subClosed(ctx && ctx.ov);
      } catch (_) {}
    }, 0);
  }
  function feedUi(players, sys, ui, ctx) {
    if (S.sent.size || S.direct.size || S.four[0] || S.four[1]) release();
    // Buttons already held when the screen opened (the A that opened it) are not presses here.
    const last = S.uiLast || players.map(p => new Set(p || []));
    let asked = null;
    players.forEach((p, i) => {
      const held = new Set(p || []), prev = last[i] || new Set();
      for (const n of held) {
        if (prev.has(n)) continue;
        if (n === 'Home') asked = 'menu';
        else if (DIRS[n]) { if (ui.move) ui.move(n); else uiKey(DIRS[n]); }
        else if (n === 'A') uiActivate();
        else if (n === 'B') { ui.back(); told(sys, ctx); }
      }
    });
    S.uiLast = players.map(p => new Set(p || []));
    if (asked === 'menu') { menu(); return 'menu'; }
    return null;
  }

  /* THE LEFT STICK AS THE D-PAD, PER CONSOLE (2026-10-17: "On systems that don't need the
     sticks, use the left stick the same as the D-pad"). gamepad.js names the stick LSUp, LSDown,
     LSLeft, LSRight. Consoles with no analogue stick take them as their D-pad: Game Boy and Color,
     NES, Famicom and Disk System, Game & Watch, the colour units, Tetris Jr., Pokemon mini, Atari
     2600, 7800 and Lynx. The Atari 5200 has an analogue stick, which its window reads from the pad's
     axes itself, so the stick is never its D-pad there. Recorded in the build plan. */
  const STICK_CONSOLES = new Set(['a5200']);
  const LS_DIR = { LSUp: 'Up', LSDown: 'Down', LSLeft: 'Left', LSRight: 'Right' };
  function stickAsDpad(sys, players) {
    const own = STICK_CONSOLES.has(sys);
    return players.map(p => {
      const out = [];
      for (const n of (p || [])) { if (LS_DIR[n]) { if (!own && !out.includes(LS_DIR[n])) out.push(LS_DIR[n]); } else if (!out.includes(n)) out.push(n); }
      return out;
    });
  }

  /* players: [[button names held], ...] for every pad, pad 1 first.
     Returns 'menu' when this call asked for the window menu. */
  function feed(players, ctx) {
    const sys = systemHere(ctx);
    if (sys !== S.sys) { release(); S.sys = sys; }
    if (!sys || !MAPS[sys]) return null;
    const ui = uiScreen(sys);
    /* A screen (Controls, Saved states) reads the buttons by printed letter, as the
       site and the game do (2026-10-16): ctx.uiPlayers is the same renamed list. */
    if (ui) return feedUi((ctx && ctx.uiPlayers) || stickAsDpad('', players), sys, ui, ctx);
    players = stickAsDpad(sys, players);
    if (S.uiLast) {
      // Back from a screen: what is still held (the B that closed it) stays out of the game until let go.
      S.block = players.map(p => new Set(p || []));
      S.uiLast = null; S.last = players.map(p => new Set(p || []));
    }
    if (S.block) {
      let any = false;
      players = players.map((p, i) => { const b = S.block[i]; if (!b) return p; for (const n of Array.from(b)) if (!(p || []).includes(n)) b.delete(n); if (b.size) any = true; return (p || []).filter(n => !b.has(n)); });
      if (!any) S.block = null;
    }
    const maps = mapsFor(sys);
    const sysDef = MAPS[sys];
    let asked = null;
    const wantKeys = new Map(), wantDirect = new Map(), four = [0, 0];
    const idle = !!document.querySelector('.tap-to-play:not(.gone)');                 // the colour twins before "Insert batteries"
    for (let p = 0; p < players.length && p < 4; p++) {
      const held = new Set(players[p] || []);
      const prev = S.last[p] || new Set();
      const fresh = n => held.has(n) && !prev.has(n);
      // Select+Start (or Home) is Back. The pair is latched out of the game until both are let go.
      if (held.has('Home') && !prev.has('Home')) asked = 'menu';
      if (held.has('Select') && held.has('Start') && (fresh('Select') || fresh('Start'))) { asked = 'menu'; S.chord[p] = true; }
      if (S.chord[p]) { if (!held.has('Select') && !held.has('Start')) S.chord[p] = false; else { held.delete('Select'); held.delete('Start'); } }
      held.delete('Home');
      if (held.has(HELP_BTN) && !(maps[p] && maps[p][HELP_BTN])) { if (fresh(HELP_BTN) && !asked) asked = 'help'; held.delete(HELP_BTN); }
      S.last[p] = new Set(players[p] || []);
      if (idle && (fresh('A') || fresh('Start'))) { const t = document.querySelector('.tap-to-play:not(.gone)'); if (t) t.click(); continue; }
      if (p >= 2 && sysDef.four) { four[p - 2] = fourMask(held); continue; }
      const map = maps[p];
      if (!map) continue;
      if (p === 1 && sysDef.p2only === 'microVs' && !gnwMicroVs()) continue;
      for (const n of held) {
        const t = map[n];
        if (!t) continue;
        if (t === MENU) { if (fresh(n)) asked = 'menu'; continue; }
        const into = sysDef.direct ? wantDirect : wantKeys;
        into.set(t, (into.get(t) || 0) + 1);
      }
    }
    // Ups first (a direction reversal must not hold both), then downs.
    for (const code of Array.from(S.sent.keys())) if (!wantKeys.has(code)) { key(code, false); S.sent.delete(code); }
    for (const [code, n] of wantKeys) { if (!S.sent.has(code)) key(code, true); S.sent.set(code, n); }
    if (sysDef.direct) {
      const d = pmDev();
      for (const name of Array.from(S.direct.keys())) if (!wantDirect.has(name)) { try { if (d) d.release(name); } catch (_) {} S.direct.delete(name); }
      for (const [name, n] of wantDirect) { if (!S.direct.has(name)) { try { if (d) d.press(name); } catch (_) {} } S.direct.set(name, n); }
    }
    if (sysDef.four && (four[0] !== S.four[0] || four[1] !== S.four[1])) {
      S.four = four;
      try { if (window.__gnwPad34) { window.__gnwPad34.set(0, four[0]); window.__gnwPad34.set(1, four[1]); } } catch (_) {}
    }
    if (asked === 'menu') { release(); S.sys = sys; menu(); }
    else if (asked === 'help') { release(); S.sys = sys; help(); }
    return asked;
  }

  /* How many players this window takes from pads right now. */
  function players(ctx) {
    const sys = systemHere(ctx); const m = MAPS[sys]; if (!m) return 0;
    if (m.four) { let four = false; try { four = [2, 3].includes(window.__gnwPad34 && window.__gnwPad34.device); } catch (_) {} return four ? 4 : 2; }
    if (m.p2only === 'microVs') return gnwMicroVs() ? 2 : 1;
    return m.players.length;
  }

  /* ---- Keys P5: the keyboard remap, applied before the window's own key handlers ----
     A key the viewer chose for a console function is sent on as that function's own key
     (the window's key table is untouched, so the Controls diagram stays the authority on
     what each function is); the function's old key then does nothing, unless it is another
     function's new key. Never: with Ctrl / Alt / Meta held, in a text field, on a focused
     button (Enter and Space press it), for the Back keys, or for the pad's own presses. */
  const REMAP_MARK = '__gnwRemap';
  function systemForKeys() {
    if (window.parent === window || !/\/play\//.test(location.pathname)) {
      // The host page: only while its in-page window (Game & Watch, Pokemon mini) is in front.
      const k = window.GnwKeys, t = k && k.topLayer ? k.topLayer() : null;
      if (!t) return null;
      return t.id === 'play-overlay' ? 'gnw' : t.id === 'pm-play-overlay' ? 'pm' : null;
    }
    return systemHere(null);
  }
  const BACKISH = new Set(['Escape', 'Backspace', 'Tab']);
  function onKbd(e) {
    if (e[REMAP_MARK] || e.__gnwPad || !e.isTrusted) return;
    if (window.gnwKbTyping) return;            /* NES Family BASIC keyboard typing: keys are characters */
    if (e.ctrlKey || e.altKey || e.metaKey || !e.code || BACKISH.has(e.code)) return;
    const t = e.target;
    if (t && t.nodeType === 1 && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t.tagName) || (t.getAttribute && t.getAttribute('role') === 'button'))) return;
    const sys = systemForKeys(); if (!sys) return;
    const map = keyRemap(sys);
    let to = null, moved = false;
    for (const [from, code] of Object.entries(map)) { if (code === e.code) to = from; if (from === e.code) moved = true; }
    if (!to && !moved) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (!to) return;                                  // the function's old key, now unused
    const ev = new KeyboardEvent(e.type, { key: keyOf(to), code: to, bubbles: true, cancelable: true, composed: true, repeat: e.repeat,
      shiftKey: to === 'ShiftRight' || to === 'ShiftLeft', location: /Right$/.test(to) && /^Shift/.test(to) ? 2 : 0 });
    try { Object.defineProperty(ev, REMAP_MARK, { value: true }); } catch (_) {}
    (t && t.dispatchEvent ? t : target()).dispatchEvent(ev);
  }
  addEventListener('keydown', onKbd, true);
  addEventListener('keyup', onKbd, true);

  /* For Settings: each system's functions, its keys and pad buttons now, and the remaps. */
  const codeLabel = code => {
    if (!code) return '';
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit\d$/.test(code)) return code.slice(5);
    const N = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ShiftRight: 'Right Shift', ShiftLeft: 'Left Shift', ControlRight: 'Right Ctrl', ControlLeft: 'Left Ctrl',
      AltRight: 'Right Alt', AltLeft: 'Left Alt', Space: 'Space', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Backquote: '`', Backslash: '\\',
      Comma: ',', Period: '.', Slash: '/', NumpadEnter: 'Numpad Enter' };
    if (N[code]) return N[code];
    if (/^Numpad/.test(code)) return 'Numpad ' + code.slice(6);
    return code;
  };
  function table(sys) {
    const m = MAPS[sys]; if (!m) return null;
    const fns = (m.direct ? PAD_FN[sys] : FN[sys]) || [];
    const pad = mapsFor(sys)[0] || {};
    const km = keyRemap(sys);
    const keyFns = FN[sys] || [];
    const p2 = [];
    if (m.players[1] && !m.direct) { const p1 = m.players[0]; for (const [b, code] of Object.entries(m.players[1])) { const f = keyFns.find(x => x[0] === p1[b]); if (f && !p2.some(x => x[0] === code)) p2.push([code, 'Player 2 ' + f[1]]); } }
    return {
      sys, label: m.label, direct: !!m.direct,
      pad: fns.map(([code, label]) => ({ fn: code, label, buttons: Object.keys(pad).filter(b => pad[b] === code) })),
      keys: keyFns.map(([code, label]) => ({ fn: code, label, key: km[code] || code, custom: !!km[code] })),
      padCustom: Object.keys(padRemap(sys)).length > 0, keysCustom: Object.keys(km).length > 0,
      reservedKeys: Object.assign({}, WINDOW_KEYS[sys] || {}, Object.fromEntries(p2)),
    };
  }

  window.gnwPlayPad = {
    stickAsDpad, STICK_CONSOLES,
    BUILD, MAPS, feed, release, players,
    FN, PAD_FN, table, codeLabel, keyRemap, setKeyRemap, padRemap, setPadRemap, GAME_STORE, PAD_STORE,
    info(ctx) { return { build: BUILD, system: systemHere(ctx), players: players(ctx), keys: Array.from(S.sent.keys()), direct: Array.from(S.direct.keys()), four: S.four.slice(), menus: S.menus, helps: S.helps }; },
    HELP_BTN, WINDOW_KEYS, mapsFor,
  };
  // Leaving the page (a reload, a close) lets every key go.
  addEventListener('pagehide', release);
})();

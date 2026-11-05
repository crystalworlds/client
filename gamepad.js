/*
 * gamepad.js -- keyboard first, phase 4: gamepads across the site, and TV
 * remote hardening (2026-10-04).
 *
 * The design is docs/tv-controller-support.md, sections 5.1, 6.2 and 7
 * (phase 4). A gamepad is a keyboard with fewer keys (P9): every pad button is
 * a KEY of an action in the action registry (actions.js), named 'Pad:A',
 * 'Pad:Start', ... (KEY NAMES in actions.js). This file only reads the pads and
 * runs whichever action holds the button, so the ? list and quick jump show the
 * pad buttons beside the keys, and phase 5's editor rebinds them like any key.
 *
 * HOW A PAD BUTTON RUNS ITS ACTION. An action of this file's own scope 'pad'
 * (OK, info, the context action) runs directly. Any other action is run by
 * pressing its KEYBOARD key (its first plain key: Escape for Back, the arrows
 * for moving, P for the Play key, '/' for quick jump...) at the focused
 * element, so every surface -- the grid, the Continue row, a drawer, Settings,
 * the player's seek bar, quick jump, the pause menu -- answers a pad exactly as
 * it answers that key, through the handlers that already exist. Where a key
 * has a browser default a synthetic key cannot trigger (a button's Enter, a
 * slider's arrows, scrolling a list), this file does that part itself.
 *
 * A AND B ARE THE LETTERS PRINTED ON THE PAD (2026-10-16, see LAYOUT_KEY): on
 * the site, in menus and in games, A is the button printed A. A pad counts as
 * Xbox-lettered (A bottom, B right) unless it is identified as Nintendo-lettered
 * (A right, B bottom); Settings can set it per controller.
 * THE MAP (standard mapping; A = OK, B = Back, X and Y the other two face buttons):
 *   D-pad / left stick   move (nav.up/down/left/right); held: repeats
 *   A                    OK: press the focused control (in the player: play/pause);
 *                        held 500 ms on a Systems menu entry: add / remove it
 *   B                    Back (one step, the Back ladder)
 *   Start                Play key on a tile, card or drawer; play/pause in the player
 *   Select               quick jump
 *   Home (Guide)         the key list (?)
 *   LB / RB              previous / next library or system ([ / ]); the systems in the System Switcher
 *                        (system-switcher.js, 30 Oct 2026: A applies, B keeps the system);
 *                        in the player: previous / next episode
 *   LT / RT              one screen up / down; in the player: back / forward 10 s (held: repeats)
 *                        On the Media page (2026-10-29): LT selects the Home button on the search
 *                        bar (it does not open), RT opens the Systems menu with the focus inside it.
 *                        In a play window a trigger the console does not use goes to the Control
 *                        Bar (play/host/host.mjs).
 *   Right on the wall's right-most tile selects the Systems tab (nav.js; it does not open).
 *   Y                    on the wall with nothing on top: Widgets on / off (5 Nov; shortcuts.js wall.widgets);
 *                        details of a Continue card or drawer item; in the player: the control bar
 *   X                    on the wall with nothing on top: Movies on / off (5 Nov; shortcuts.js wall.movies);
 *                        Remove on a Continue card; in the player: subtitles on/off
 * In a play window the pad is the console's own pad (play/play-pad.js): Start
 * and Select are the console's, Select+Start or Home opens the pause menu, and
 * pads 2-4 are players 2-4 where the game has them. In the pause menu: D-pad
 * moves, A presses, B is Back (which resumes: only the Quit item quits, 2026-10-14),
 * Start and Home resume.
 *
 * POLLING. navigator.getGamepads() is read once per animation frame, and only
 * while at least one pad is connected AND the tab is visible. No pad, no loop.
 * A "Controller connected" toast says when one arrives.
 *
 * TV REMOTES (hardening). Samsung Tizen and LG webOS: Back 10009 / 461 are
 * keys.js's already; here the colour keys (Red = context, Green = info,
 * Yellow = quick jump, Blue = the key list), Info, the Tizen track keys and
 * Channel up/down (one screen of the grid; next / previous episode in the
 * player) join the registry, and on Tizen every one of them is registered
 * with tizen.tvinputdevice.registerKey so the TV delivers it at all.
 *
 * KEYS P5 (2026-10-04): GnwPad.capture(fn) hands the next pad button to Settings' "press a
 * button" instead of running it; keybind.js uses it to rebind pad buttons.
 *
 * FOR PHASE 5 (Settings -> Keyboard & controllers -> Gamepad): GnwPad.bindings()
 * lists every pad button with the actions it runs; rebinding is Actions.setKeys;
 * GnwPad.onInput(fn) streams the live buttons for a "press a button" test;
 * GnwPad.gameMaps() is the per-system game table (play/play-pad.js MAPS) and
 * localStorage 'gnw.pad.games.v2' its override.
 *
 * THE GAME SERVER'S CONTROLLER DATABASE (2026-10-17; server DECISIONS GC1):
 * when a game server is joined, each new controller is looked up there once
 * (CWS.controller: the server keeps SDL_GameControllerDB, fetched weekly) and the
 * answer is kept per controller in localStorage 'gnw.pad.db.v1' (30 days). A
 * positive Nintendo answer sets the lettering; for a pad the browser does not map
 * itself (mapping not 'standard') an entry for this platform also gives the
 * button positions. With no server, the built-in table below decides alone.
 *
 * ONE CONTROLLER OUT, ANOTHER IN (bug, 2026-10-17: on the phone the second
 * pad was taken for the first until a reload): every slot remembers which pad
 * (index and id) it last held; a different one there, with or without the
 * browser's connect events, resets that slot and re-reads everything for it.
 *
 * Mouse, touch and keyboard: unchanged. Focus moved by a pad shows the ring
 * (focus({ focusVisible: true }) while the pad is the last input).
 * Sound: none. A pad press is not a user gesture to the browser, and nothing
 * here starts audio.
 */
(function () {
  'use strict';
  if (window.GnwPad) return;

  const BUILD = '20261031-fix3';
  const NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Select', 'Start', 'L3', 'R3', 'Up', 'Down', 'Left', 'Right', 'Home'];
  const DIR = { Up: 'up', Down: 'down', Left: 'left', Right: 'right' };
  const REPEAT = { Up: 1, Down: 1, Left: 1, Right: 1, LT: 1, RT: 1 };
  /* LB / RB held repeat only while the System Switcher is open (31 Oct: "I can hold the left
     shoulder button to go fast but not the right one"): both the same, paced by the switcher's
     own steady rate (system-switcher.js steer). Everywhere else a held shoulder is one press. */
  const SHOULDER = { LB: 1, RB: 1 };
  const SHOULDER_FIRST_MS = 460, SHOULDER_NEXT_MS = 230;   // just past the switcher's 450 / 200, so each pad repeat is taken
  const FIRST_MS = 400, NEXT_MS = 110, SEEK_NEXT_MS = 220;
  const DEADZONE = 0.5;
  /* rob-play-overlay (4 Nov 2026): R.O.B. Play Time takes the pad as a game window does; its page's
     window.gnwPlayPad.feed walks its controls and drives him (play/rob/index.html). */
  const PLAY_IDS = ['play-overlay', 'pm-play-overlay', 'gb-play-overlay', 'nes-play-overlay', 'atari-play-overlay', 'tft-play-overlay', 'tj-play-overlay', 'rob-play-overlay'];
  const IN_PAGE = new Set(['play-overlay', 'pm-play-overlay']);
  const PAUSE_ID = 'gk-pause';

  const A = () => window.Actions || null;
  const K = () => window.GnwKeys || null;
  const topEl = () => { const k = K(); return k && k.topLayer ? k.topLayer() : null; };

  function isField(t) {
    if (!t || t.nodeType !== 1) return false;
    if (t.isContentEditable) return true;
    const tag = t.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag !== 'INPUT') return false;
    return !/^(button|checkbox|radio|range|color|file|submit|reset|image)$/i.test(t.type || 'text');
  }

  /* ------------------------------------------------------------ the registry */

  /* Pad buttons and remote keys on actions other files own (Actions.addKeys keeps
     them if the owner registers later or again). */
  const BIND = {
    'nav.up': ['Pad:Up'], 'nav.down': ['Pad:Down'], 'nav.left': ['Pad:Left'], 'nav.right': ['Pad:Right'],
    'back': ['Pad:B'],
    'item.play': ['Pad:Start'], 'player.toggle': ['Pad:Start'],
    'quick.open': ['Pad:Select', 'ColorF2Yellow', '#405'],
    'help.open': ['Pad:Home', 'ColorF3Blue', '#406'],
    /* LB / RB are the System Switcher only (pad.section.* below, 31 Oct); [ ] (section.*) are the
       libraries only, so they no longer carry the shoulders. R3 is the M key: the focused tile's manual. */
    'item.manual': ['Pad:R3'],
    'player.prev': ['Pad:LB', 'ChannelDown', '#428'], 'player.next': ['Pad:RB', 'ChannelUp', '#427'],
    'player.back10': ['Pad:LT'], 'player.fwd10': ['Pad:RT'],
    'nav.pageUp': ['Pad:LT', 'ChannelUp', '#427'], 'nav.pageDown': ['Pad:RT', 'ChannelDown', '#428'],
    'media.next': ['#10233'], 'media.prev': ['#10232'],                       // Tizen's track keys
    'game.back': ['Pad:Home', 'Pad:Select+Start'],
  };
  function registerAll() {
    const F = A(); if (!F || typeof F.register !== 'function') return false;
    F.register('pad.ok', { label: 'OK: press the focused control (held on a Systems menu entry: add or remove it; in the player: play / pause)', group: 'Navigation', scope: 'pad', keys: ['Pad:A'], palette: false, run: () => activate() });
    F.register('pad.info', { label: 'Details for the focused Continue card or drawer item (in the player: the control bar)', group: 'Content page', scope: 'pad',
      keys: ['Pad:Y', 'ColorF1Green', '#404', 'Info', '#457'], palette: false, run: () => info() });
    F.register('pad.context', { label: 'Context action: remove the focused Continue card (in the player: subtitles on / off)', group: 'Content page', scope: 'pad',
      keys: ['Pad:X', 'ColorF0Red', '#403'], palette: false, run: () => context() });
    // In a game the pad is the console's (play/play-pad.js); listed for ?.
    F.register('game.pad.buttons', { label: 'Gamepad: the console’s own buttons by the letters printed on the pad (printed A is the console’s A, printed B its B); Start and Select are the console’s', group: 'Play window', scope: 'game', keys: ['Pad:A', 'Pad:B', 'Pad:Start'] });
    /* TOOLBAR BY TRIGGER (2026-10-18: "make the triggers ... set the focus to ... the search
       bar buttons on the tiles. Then the user can move around with the triggers or the d-pad").
       On the Media page, LT moves the focus to the toolbar above the tiles (art, sort and show
       buttons, then the search box); there LT / RT step left / right through them (wrapping), the
       D-pad moves as before, A presses, and B goes back to the tile (or row item) it came from.
       CONFLICT KEPT: LT and RT were already one screen up / down here (nav.pageUp / pageDown). LT
       now goes to the toolbar instead, which sits at the top (the place a screen up heads for);
       RT stays one screen down, and both stay one screen up / down everywhere else (drawers,
       Settings, other pages) and back / forward 10 s in the film player. Scope 'pad' runs first,
       and only while when() holds, so nothing else changes. */
    /* THE TRIGGERS ON THE CONTENT PAGE (29 Oct, replacing the 18 Oct toolbar route above):
       "Right Trigger opens the Systems menu, instead of what left and right trigger do now" and
       "Left Trigger jumps to the Home button on the search bar: select only, not open". RT opens
       the Systems menu with the focus inside it (pressed again, or B, it closes and the focus goes
       back where it was); LT puts the focus on the Home button without opening Home, and B there
       goes back to the tile it came from. The old LT / RT steps along the toolbar are gone (the
       D-pad walks the bar). Elsewhere (drawers, Settings, other pages) LT / RT stay one screen up /
       down, and back / forward 10 s in the film player. */
    F.register('pad.home', { label: 'Content page: go to the Home button on the search bar (it does not open; B goes back to the tile)', group: 'Content page', scope: 'pad',
      keys: ['Pad:LT'], palette: false, when: () => homeCan(), run: () => homeEnter() });
    F.register('pad.systems', { label: 'Content page: open the Systems menu, with the focus in it (again or B closes it)', group: 'Content page', scope: 'pad',
      keys: ['Pad:RT'], palette: false, when: () => systemsCan(), run: () => systemsToggle() });
    /* LB / RB FROM ANYWHERE ON THE CONTENT PAGE (29 Oct: "the shoulder-button system switch doesn't
       work when the search bar is selected"). They ran by pressing [ or ] at the focus, and a text
       box (the search box, even at rest) keeps its keys, so nothing happened there. On the content
       page the pad now steps the library or system itself, wherever the focus is. */
    const secOk = () => !topEl() && onMediaPage() && !!(window.GnwShortcuts && window.GnwShortcuts.stepSection);
    F.register('pad.section.prev', { label: 'System Switcher: one system back (held: repeats; applied a second after the last press; A applies now, B keeps the system)', group: 'Content page', scope: 'pad', keys: ['Pad:LB'], palette: false, when: secOk, run: () => { window.GnwShortcuts.stepSection(-1, curRepeat); } });
    F.register('pad.section.next', { label: 'System Switcher: one system on (held: repeats; applied a second after the last press; A applies now, B keeps the system)', group: 'Content page', scope: 'pad', keys: ['Pad:RB'], palette: false, when: secOk, run: () => { window.GnwShortcuts.stepSection(1, curRepeat); } });
    // Listed for ? (stickScroll below, 29 Oct): either stick's up / down scrolls the page or the drawer.
    F.register('pad.sticks', { label: 'Content page and drawers: either stick up or down scrolls, faster the further it is pushed (the D-pad still moves from tile to tile; the left stick’s left and right still step). Pages, Settings, menus and manuals: the right stick scrolls', group: 'Content page', scope: 'info', keys: ['Pad:LS', 'Pad:RS'], help: true, reserved: true });   // shown as "Pad LS", "Pad RS" (the left and right sticks)
    // Listed for ? (nav.js does it, 29 Oct): Right past the wall's right-most tile.
    F.register('pad.tab', { label: 'Content page: Right past the right-most tile selects the Systems tab (A or Enter opens it, Left goes back)', group: 'Content page', scope: 'info', keys: ['ArrowRight', 'Pad:Right'], help: true, reserved: true });
    F.register('game.pad.bar', { label: 'Gamepad: LT or RT (a trigger this console does not use) moves to the Control Bar; there LT / RT step along it, A presses, B goes back to the game', group: 'Play window', scope: 'game', keys: ['Pad:LT', 'Pad:RT'] });
    F.register('game.pad.players', { label: 'More gamepads are players 2 to 4 where the game has them (NES Four Score / Famicom 4-player, Atari 2600 / 7800, Game & Watch Micro Vs.)', group: 'Play window', scope: 'info', keys: [] });
    for (const [id, keys] of Object.entries(BIND)) F.addKeys(id, keys);
    return true;
  }

  /* ------------------------------------------------------------ running an action */

  const PUNCT = { '/': 'Slash', '?': 'Slash', '[': 'BracketLeft', ']': 'BracketRight', ',': 'Comma', '.': 'Period', '-': 'Minus', '=': 'Equal', ';': 'Semicolon', "'": 'Quote', '`': 'Backquote', '\\': 'Backslash' };
  /* A KEY NAME as the KeyboardEvent a keyboard would send. */
  function eventInit(name) {
    const init = { ctrlKey: false, altKey: false, shiftKey: false, metaKey: false };
    let k = name;
    for (;;) {
      const m = /^(Ctrl|Alt|Shift|Meta)\+(.+)$/.exec(k);
      if (!m) break;
      init[{ Ctrl: 'ctrlKey', Alt: 'altKey', Shift: 'shiftKey', Meta: 'metaKey' }[m[1]]] = true;
      k = m[2];
    }
    if (k === 'Space') { init.key = ' '; init.code = 'Space'; }
    else if (/^[A-Z]$/.test(k)) { init.key = init.shiftKey ? k : k.toLowerCase(); init.code = 'Key' + k; }
    else if (/^[0-9]$/.test(k)) { init.key = k; init.code = 'Digit' + k; }
    else if (k.length === 1) { init.key = k; init.code = PUNCT[k] || ''; if (k === '?') init.shiftKey = true; }
    else { init.key = k; init.code = k; }
    return init;
  }
  const dispatchable = k => k && k.slice(0, 4) !== 'Pad:' && k[0] !== '#' && k.indexOf(' ') < 0;
  const focusTarget = () => { const a = document.activeElement; return a && a !== document.documentElement && a.dispatchEvent ? a : document.body; };
  /* Press a key at the focus, as the keyboard would. true = something took it. */
  function press(name, repeat) {
    const init = Object.assign(eventInit(name), { bubbles: true, cancelable: true, composed: true, repeat: !!repeat });
    const t = focusTarget();
    const down = new KeyboardEvent('keydown', init);
    try { Object.defineProperty(down, '__gnwPad', { value: true }); } catch (_) {}
    t.dispatchEvent(down);
    const up = new KeyboardEvent('keyup', Object.assign({}, init, { repeat: false }));
    try { Object.defineProperty(up, '__gnwPad', { value: true }); } catch (_) {}
    (document.activeElement || document.body).dispatchEvent(up);
    return down.defaultPrevented;
  }

  /* The scopes a pad button looks in, nearest first, for what is on screen now. */
  function scopes() {
    const t = topEl();
    if (t && t.id === 'video-player-overlay') return ['pad', 'media', 'player', 'back', 'global', 'nav'];
    return ['pad', 'tiles', 'back', 'nav', 'global'];
  }
  function actionFor(padKey) {
    const F = A(); if (!F) return null;
    const all = F.list();
    /* The wall's two switches first (5 Nov), only with nothing on top; a highlighted Continue card
       keeps its X (remove) and Y (details). */
    const S = window.GnwShortcuts, foc = document.activeElement;
    if (S && S.wallFree && S.wallFree() && !(foc && foc.closest && foc.closest('[data-cr-open], [data-cr-remove]'))) {
      const w = all.find(a => (a.id === 'wall.movies' || a.id === 'wall.widgets') && a.keys.includes(padKey));
      if (w) return w;
    }
    for (const sc of scopes()) {
      const hit = all.find(a => a.scope === sc && a.available && a.keys.includes(padKey));
      if (hit) return hit;
    }
    return null;
  }
  const last = { padKey: null, id: null, how: null, at: 0 };
  let curRepeat = false;               // the press runPad is running is a held repeat (the toolbar's step reads it)
  function runPad(padKey, repeat) {
    curRepeat = !!repeat;
    const a = actionFor(padKey);
    last.padKey = padKey; last.id = a ? a.id : null; last.at = Date.now();
    if (!a) { last.how = 'none'; return false; }
    const F = A();
    if (a.scope === 'pad' || a.id === 'wall.movies' || a.id === 'wall.widgets') { last.how = 'run'; return F.run(a.id) !== false; }
    const k = a.keys.find(dispatchable);
    if (!k) { last.how = 'run'; return F.run(a.id) !== false; }
    last.how = 'key:' + k;
    const taken = press(k, repeat);
    if (!taken) fallback(a.id);
    return true;
  }

  /* What a synthetic key cannot do by itself. */
  function scrollParent(el) {
    for (let p = el; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      if (p.scrollHeight > p.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(p).overflowY)) return p;
    }
    return null;
  }
  function scrollBy(dy) {
    const a = document.activeElement;
    const p = a && a !== document.body ? scrollParent(a) : null;
    if (p) p.scrollBy({ top: dy }); else window.scrollBy({ top: dy });
  }
  function fallback(id) {
    const a = document.activeElement;
    const dir = { 'nav.up': 'up', 'nav.down': 'down', 'nav.left': 'left', 'nav.right': 'right' }[id];
    if (dir) {
      if (a && a.tagName === 'INPUT' && a.type === 'range' && (dir === 'left' || dir === 'right')) {
        try { if (dir === 'right') a.stepUp(); else a.stepDown(); } catch (_) {}
        a.dispatchEvent(new Event('input', { bubbles: true })); a.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
      if (isField(a) || (a && a.tagName === 'INPUT')) { if (window.GnwNav && window.GnwNav.move(dir)) return; }
      if (dir === 'up' || dir === 'down') scrollBy(dir === 'up' ? -120 : 120);
      return;
    }
    if (id === 'nav.pageUp' || id === 'nav.pageDown') { scrollBy((id === 'nav.pageUp' ? -1 : 1) * window.innerHeight * 0.8); return; }
  }

  /* ---- the pad's own actions ---- */
  const CLICKABLE = 'button, a[href], summary, label, [role="button"], [role="tab"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="option"], [role="radio"], [role="checkbox"], [role="switch"], [role="link"], input[type="checkbox"], input[type="radio"], input[type="button"], input[type="submit"], input[type="reset"]';
  function activate() {
    // The System Switcher open over the wall (30 Oct 2026; system-switcher.js): A applies its choice now.
    if (window.GnwSwitcher && window.GnwSwitcher.isOpen()) { window.GnwSwitcher.apply(); return true; }
    const a = document.activeElement;
    const t = topEl();
    if (!a || a === document.body || a === document.documentElement) {
      if (t && t.id === 'video-player-overlay') { A().run('player.toggle'); return true; }
      // The instruction manual with nothing focused (a click on a page): A turns the page forward, as Enter does (30 Oct 2026; manual_booklet.js).
      if (t && t.id === 'manualOverlay' && press('Enter')) return true;
      if (window.GnwNav) window.GnwNav.move('down');                  // a first press: the screen's default focus
      return true;
    }
    if (t && t.id === 'video-player-overlay' && (a.tagName === 'VIDEO' || !a.matches(CLICKABLE + ', input, select, textarea, [tabindex]:not(video)'))) { A().run('player.toggle'); return true; }
    if (press('Enter')) return true;                                     // a handler took Enter (tiles, rows, quick jump)
    if (a.tagName === 'SELECT') {
      try { a.showPicker(); return true; } catch (_) {}
      if (a.options.length) { a.selectedIndex = (a.selectedIndex + 1) % a.options.length; a.dispatchEvent(new Event('input', { bubbles: true })); a.dispatchEvent(new Event('change', { bubbles: true })); }
      return true;
    }
    if (a.matches(CLICKABLE)) { a.click(); return true; }
    return true;
  }
  function info() {
    const a = document.activeElement || document.body;
    const t = topEl();
    if (t && t.id === 'video-player-overlay') { press('ArrowUp'); return true; }   // the control bar (and chapters on a second press)
    const cr = a.closest && a.closest('[data-cr-open], [data-cr-remove]');
    if (cr) {
      const key = cr.getAttribute('data-cr-open') || cr.getAttribute('data-cr-remove') || '';
      const id = key.slice(2);
      if (key[0] === 'g' && typeof window.openDevice === 'function') { window.openDevice(id); return true; }
      const E = window.Emby;
      if (E && E.openVideo) {
        if (E.getItem) E.getItem(id).then(it => E.openVideo(it && it.SeriesId ? it.SeriesId : id)).catch(() => E.openVideo(id));
        else E.openVideo(id);
      }
      return true;
    }
    const ep = a.closest && a.closest('.vd-ep');
    if (ep) { ep.focus({ preventScroll: true }); press('Enter'); return true; }   // episode info (Enter on the row)
    const tile = a.closest && a.closest('.video-card, .device-card');
    if (tile) { if (tile !== a) tile.focus({ preventScroll: true }); press('Enter'); return true; }
    note('Nothing more to show here');
    return false;
  }
  function context() {
    const a = document.activeElement || document.body;
    const t = topEl();
    if (t && t.id === 'video-player-overlay') { A().run('player.subs'); return true; }
    const cr = a.closest && a.closest('[data-cr-open], [data-cr-remove]');
    if (cr) { press('Delete'); return true; }
    note('No action for this item');
    return false;
  }
  /* ---- the Media page toolbar by trigger (2026-10-18; see registerAll) ---- */
  const tb = { from: null, hold: false };   // from: the zone the focus came from; hold: the LT that entered is still held
  const onMediaPage = () => { const v = document.querySelector('main .view.active') || document.querySelector('.view.active'); return !!v && v.id === 'view-media'; };
  function tbItems() {
    const N = window.GnwNav; if (!N || !N.zoneItems || !onMediaPage()) return [];
    return N.zoneItems('toolbar').concat(N.zoneItems('search'));
  }
  const tbEditing = () => !!document.querySelector('#view-media .filter-bar .search.vs-editing');
  function tbOn() {
    if (topEl() || tbEditing()) return false;
    const a = document.activeElement;
    return !!a && a !== document.body && tbItems().includes(a);
  }
  /* LT: the Home button, selected only (29 Oct). Not while a layer or the Systems menu is open,
     nor while typing in the search box. */
  const sysOpen = () => !!(window.Emby && window.Emby.systemsMenuOpen && window.Emby.systemsMenuOpen());
  function homeCan() {
    if (topEl() || !onMediaPage() || tbEditing() || sysOpen()) return false;
    return !!document.getElementById('video-home-btn');
  }
  function homeEnter() {
    if (curRepeat) return true;                                         // a held LT: one jump
    const N = window.GnwNav, a = document.activeElement;
    const z = a && a !== document.body && N && N.zoneOf ? N.zoneOf(a) : null;
    if (!(a && a.id === 'video-home-btn')) tb.from = z && z !== 'toolbar' && z !== 'search' ? z : (tb.from || 'grid');
    if (window.GnwShortcuts && window.GnwShortcuts.revealAbove) window.GnwShortcuts.revealAbove();   // focus mode hides the toolbar
    const h = document.getElementById('video-home-btn');
    if (!h || !h.getClientRects().length) return false;
    try { h.focus({ preventScroll: true }); } catch (_) {}
    try { h.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) {}
    return document.activeElement === h;
  }
  /* RT: the Systems menu (29 Oct). emby.js opens it with the focus inside, and closes it with
     the focus back where it was. */
  function systemsCan() {
    if (topEl() || !onMediaPage() || tbEditing()) return false;
    return !!(window.Emby && window.Emby.toggleSystemsMenu && document.querySelector('#view-media [data-vgames-menu]'));
  }
  function systemsToggle() {
    if (curRepeat) return true;                                         // a held RT: one press
    if (window.GnwShortcuts && window.GnwShortcuts.revealAbove) window.GnwShortcuts.revealAbove();
    return window.Emby.toggleSystemsMenu() !== false;
  }
  /* B on a toolbar button the trigger brought the focus to: back where it came from (nav.js's
     memory of that zone finds the tile again after a sort re-drew the grid), else the grid. */
  function tbBack() {
    if (!tb.from || !tbOn()) return false;
    const N = window.GnwNav, from = tb.from;
    tb.from = null;
    return !!(N.focusZone(from) || N.focusZone('grid') || N.focusZone('continue'));
  }
  // The focus left the toolbar another way (the D-pad, a click): B there is the plain Back again.
  document.addEventListener('focusin', e => {
    if (tb.from && !(e.target && e.target.closest && e.target.closest('#view-media .collection-toolbar'))) tb.from = null;
  });

  function note(msg) {
    if (typeof window.toast === 'function') { try { window.toast(msg, 'info', 1800); return; } catch (_) {} }
  }

  /* ------------------------------------------------------------ input modality: the ring follows a pad */

  let padMode = false;
  const nativeFocus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (opts) {
    if (padMode) opts = Object.assign({}, opts || {}, { focusVisible: true });
    return nativeFocus.call(this, opts);
  };
  function setPadMode(on) {
    if (padMode === on) return;
    padMode = on;
    document.body && document.body.classList.toggle('gk-pad', on);
    if (on) {
      // A control clicked earlier holds focus without its ring: show it.
      const a = document.activeElement;
      if (a && a !== document.body && !a.matches(':focus-visible')) { try { a.focus({ preventScroll: true }); } catch (_) {} }
    }
  }
  for (const ev of ['pointerdown', 'mousedown', 'touchstart', 'keydown']) {
    window.addEventListener(ev, e => { if (e.isTrusted && !e.__gnwPad) setPadMode(false); }, true);
  }

  /* ------------------------------------------------------------ reading the pads */

  // A non-standard pad that reports its D-pad as one "hat" axis (doc 4.1).
  function hat(v, held) {
    if (!(v >= -1.05 && v <= 1.05)) return;
    const pos = Math.round((v + 1) / (2 / 7));                         // 0 up, 1 up-right, 2 right, ... 7 up-left
    if (pos === 0 || pos === 1 || pos === 7) held.add('Up');
    if (pos >= 1 && pos <= 3) held.add('Right');
    if (pos >= 3 && pos <= 5) held.add('Down');
    if (pos >= 5 && pos <= 7) held.add('Left');
  }
  function heldOf(gp) {
    const dbA = gp.mapping !== 'standard' && positionsOK() ? dbAnswer(gp.id) : null;
    if (dbA && dbA.mapping) return heldMapped(gp, dbA.mapping);
    const held = new Set();
    const b = gp.buttons || [];
    for (let i = 0; i < NAMES.length && i < b.length; i++) {
      const x = b[i];
      const on = x == null ? false : typeof x === 'object' ? (!!x.pressed || x.value > 0.5) : x > 0.5;
      if (on) held.add(NAMES[i]);
    }
    const ax = gp.axes || [];
    // The left stick is NOT the D-pad (2026-10-17): its directions are LSUp/LSDown/LSLeft/LSRight.
    if (ax[0] < -DEADZONE) held.add('LSLeft'); else if (ax[0] > DEADZONE) held.add('LSRight');
    if (ax[1] < -DEADZONE) held.add('LSUp'); else if (ax[1] > DEADZONE) held.add('LSDown');
    if (gp.mapping !== 'standard' && ax.length > 9) hat(ax[9], held);
    return held;
  }
  /* THE PRINTED LETTERS DECIDE (2026-10-16; supersedes the 2026-10-14
     "A and B follow gameplay" rule). heldOf() names the face buttons by POSITION,
     the standard mapping's 0..3: A bottom, B right, X left, Y top. That is the
     Xbox lettering, so on an Xbox-lettered pad the position IS the printed letter.
     A Nintendo-lettered pad prints A on the right, B at the bottom, X on top and Y
     on the left, so its positions are renamed (LABEL_SWAP). After byLabel() every
     button carries the letter printed on it, everywhere: on the site (OK is the
     printed A, Back the printed B), in the pause menu and a window's own screens,
     AND in the game itself (the console's A is the printed A; play/play-pad.js's
     tables are by printed letter). The aim: "the A button always feels most
     comfortable as the A button on both controllers"; "Xbox is most likely what
     everyone will use".
     Which lettering a pad has: a saved choice for that controller (Settings ->
     Keyboard & controllers -> Gamepad: Auto, "A right (Nintendo)", "A bottom
     (Xbox)", or the one-press check), else inferLayout(gp.id): Nintendo ONLY on a
     positive match in PADLAB below (Nintendo's vendor id, a known Nintendo-lettered
     VID:PID, or a Nintendo name); every other pad, PlayStation and unknown generic
     pads included, is Xbox-lettered (PlayStation's cross is the bottom button, the
     A position). Saved in LAYOUT_KEY as { id: choice }. */
  const LAYOUT_KEY = 'gnw.pad.layout.v2';
  const LABEL_SWAP = { A: 'B', B: 'A', X: 'Y', Y: 'X' };
  let _lsC = null, _lsAt = 0;
  function layoutStore() { const now = Date.now(); if (_lsC && now - _lsAt < 1000) return _lsC; _lsAt = now; _lsC = layoutStoreRead(); return _lsC; }
  function layoutStoreRead() { try { const o = JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (_) { return {}; } }
  /* PAD-LABELS:BEGIN generated 2026-10-16 by gen-pad-labels.mjs
     from SDL 6defbc0129b5 (controller_list.h, SDL_gamepad.c, usb_ids.h) and
     SDL_GameControllerDB c1d5289a1f71. Do not edit by hand: change the script and rerun.
     Nintendo-lettered: vendor 057e (Nintendo) except NOT; the VID:PIDs in IDS; a name passing NAME and
     not NOT_NAME; or, with no ids at all, a BARE name. Everything else is Xbox-lettered. */
  const PADLAB = {
    vendor: '057e',
    not: '057e0337 057e2073 057e2019 057e201e',
    ids: ('00791800 00791803 00791804 03141809 05a03232 0810e501 081fe401 092503e8 0e6f0180 0e6f0181 ' +
      '0e6f0184 0e6f0185 0e6f0186 0e6f0187 0e6f0188 0e6f0189 0e6f018b 0e6f018c 0e6f0193 0e6f0196 ' +
      '0e6f0197 0e6f0198 0f000001 0f0d0092 0f0d00aa 0f0d00c1 0f0d00dc 0f0d00f0 0f0d00f6 0f0d0202 ' +
      '10029000 10f5018f 11eca7e1 1235ab12 1235ab20 1235ab21 12924643 1292464b 12925346 17810a96 ' +
      '17810a9d 1d570020 1d570021 1d790301 20029000 20d6a711 20d6a712 20d6a713 20d6a714 20d6a715 ' +
      '20d6a716 20d6a718 20d6a720 28100009 28200009 288b0003 289b0002 289b0026 289b002b 289b002c ' +
      '289b002e 289b002f 289b0042 289b0056 289b0057 289b0080 2dc802e0 2dc81003 2dc81080 2dc82100 ' +
      '2dc82820 2dc82830 2dc82840 2dc82862 2dc82865 2dc83000 2dc83001 2dc83010 2dc83230 2dc83820 ' +
      '2dc85103 2dc85104 2dc85112 2dc86000 2dc86001 2dc86002 2dc86003 2dc86006 2dc86009 2dc86100 ' +
      '2dc86101 2dc86102 2dc86103 2dc89000 2dc89001 2dc89012 2dc89015 2dc89018 2dc8ab12 2dc8ab20 ' +
      '2dc8ab21 2e24200a 33dd0001 33dd0002 33dd0003 38200009 62dda715 62dda716 ').trim(),
    name: /\bnintendo\b|\bswitch\b|joy-?con|^pro controller$|\bwii\b|\b(?:s?nes|sfc|famicom|hvc)\b|super famicom|\b(?:n|sn|sf|nes|snes|sfc|fc)30\b|8bitdo (?:lite|zero|pro ?[23])\b/i,
    notName: /gamecube|game cube|\bn64\b|\bm64\b|genesis|mega ?drive|saturn|\bm30\b|lite se\b|x-?box/i,
    bare: /^(?:lic pro controller|nintendo wireless gamepad|wireless gamepad)$/i,
  };
  /* PAD-LABELS:END */
  const PL_IDS = new Set(PADLAB.ids.split(' ')), PL_NOT = new Set(PADLAB.not.split(' '));
  /* What a Gamepad.id says. Chrome (desktop): "Name (STANDARD GAMEPAD Vendor: 057e Product: 2009)";
     Chrome with XInput: "Xbox 360 Controller (XInput STANDARD GAMEPAD)"; Firefox and Safari:
     "57e-2009-Name"; Chrome on Android: the name only. */
  function parseId(id) {
    const s = String(id || '');
    let m = /Vendor:\s*([0-9a-f]{1,4})\s+Product:\s*([0-9a-f]{1,4})/i.exec(s);
    if (m) return { vp: m[1].padStart(4, '0').toLowerCase() + m[2].padStart(4, '0').toLowerCase(), name: s.replace(/\s*\([^)]*\)\s*$/, '').trim() };
    m = /^([0-9a-f]{1,4})-([0-9a-f]{1,4})-(.*)$/i.exec(s);
    if (m) return { vp: m[1].padStart(4, '0').toLowerCase() + m[2].padStart(4, '0').toLowerCase(), name: m[3].trim() };
    return { vp: '', name: s.replace(/\s*\([^)]*STANDARD GAMEPAD[^)]*\)\s*$/i, '').trim() };
  }
  /* 'nintendo' only on a positive match; everything else 'xbox'. */
  const _infer = new Map();             // id -> layout (the id of a connected pad does not change)
  function inferLayout(id) {
    const k = String(id || '');
    if (!_infer.has(k)) _infer.set(k, inferFresh(k));
    return _infer.get(k);
  }
  function inferFresh(id) {
    const { vp, name } = parseId(id);
    const ids = vp && vp !== '00000000';
    if (ids) {
      if (PL_NOT.has(vp)) return 'xbox';
      if (PL_IDS.has(vp) || vp.slice(0, 4) === PADLAB.vendor) return 'nintendo';
    }
    if (PADLAB.notName.test(name)) return 'xbox';
    if (PADLAB.name.test(name)) return 'nintendo';
    if (!ids && PADLAB.bare.test(name)) return 'nintendo';
    return 'xbox';
  }
  /* ---- the game server's answer for one controller (server DECISIONS GC1, 2026-10-17) ---- */
  /* v2 (2026-10-17): v1 answers could carry Android positions (see positionsOK); not read. */
  const DB_KEY = 'gnw.pad.db.v2', DB_MS = 30 * 864e5, DB_MAX = 40;
  /* WHERE THE DATABASE'S BUTTON NUMBERS MEAN THE BROWSER'S (bug, 2026-10-17: on a test phone the
     GameSir X5 Lite's D-pad Right paused the game like Start, and the D-pad did not move). The
     database's numbers are SDL's own joystick numbers for that platform. On Android SDL numbers
     buttons from Android's key codes in its own order (the X5 Lite's Android entry has start:b15,
     back:b16 and a hat D-pad), while Chrome on Android lays out even a pad it calls non-standard
     in the standard order (button 15 = D-pad Right, the D-pad as buttons 12 to 15). Applying the
     entry there turned D-pad Right into Start and lost the D-pad. So positions from the database
     are used only on desktop systems, where the browser's numbers for an unmapped pad are the raw
     HID order SDL also uses; never on Android, iOS or a TV. This would be wrong if a desktop pad's
     buttons read right without a game server and wrong with one. */
  function positionsOK() {
    const ua = navigator.userAgent || '';
    if (/Android|iPhone|iPad|iPod|Tizen|Web0S|webOS|SMART-TV/i.test(ua)) return false;
    const p = platform();
    return p === 'Windows' || p === 'Mac OS X' || p === 'Linux';
  }
  function platform() {
    const ua = navigator.userAgent || '';
    const p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
    if (/Android/i.test(ua)) return 'Android';
    if (/iPhone|iPad|iPod/i.test(ua) || (/Mac/i.test(p) && navigator.maxTouchPoints > 1)) return 'iOS';
    if (/Mac/i.test(p) || /Mac OS X/.test(ua)) return 'Mac OS X';
    if (/Win/i.test(p) || /Windows/.test(ua)) return 'Windows';
    if (/Linux|CrOS|X11|Tizen/i.test(p + ' ' + ua)) return 'Linux';
    return '';
  }
  let _db = null;
  function dbStore() { if (_db) return _db; try { const o = JSON.parse(localStorage.getItem(DB_KEY) || '{}'); _db = o && typeof o === 'object' ? o : {}; } catch (_) { _db = {}; } return _db; }
  const dbKey = id => platform() + '|' + String(id || '');
  function dbAnswer(id) { const r = dbStore()[dbKey(id)]; return r && r.a ? r.a : null; }
  const asking = new Set();
  let waitServer = false;
  /* Ask the server once per new controller; kept 30 days. No server: nothing happens, and the
     next server that becomes ready is asked (cws:state below). */
  function lookup(gp) {
    const id = gp && gp.id; if (!id) return;
    const k = dbKey(id), r = dbStore()[k];
    if ((r && Date.now() - r.at < DB_MS) || asking.has(k)) return;
    const C = window.CWS;
    if (!C || typeof C.controller !== 'function') { waitServer = true; return; }
    asking.add(k);
    Promise.resolve(C.controller({ id, platform: platform() })).then(a => {
      asking.delete(k);
      if (!a || (a.lettering !== 'xbox' && a.lettering !== 'nintendo')) { waitServer = true; return; }
      const e = a.entry || null;
      const keep = {
        lettering: a.lettering, identified: !!a.identified, source: String(a.lettering_source || '').slice(0, 200),
        found: !!a.found, name: e ? String(e.name || '').slice(0, 80) : '', platform: e ? e.platform : '',
        mapping: e && e.mapping && e.platform === platform() && positionsOK() ? e.mapping : null,   // positions: this platform's entry, desktop only
        db: a.database ? String(a.database.version || '') : '',
      };
      const o = dbStore(); o[k] = { at: Date.now(), a: keep };
      const keys = Object.keys(o).sort((x, y) => o[x].at - o[y].at);
      while (keys.length > DB_MAX) delete o[keys.shift()];
      try { localStorage.setItem(DB_KEY, JSON.stringify(o)); } catch (_) {}
      padsChanged();
    }, () => { asking.delete(k); waitServer = true; });
  }
  window.addEventListener('cws:state', e => {
    if (!waitServer || !e.detail || e.detail.state !== 'ready') return;
    waitServer = false;
    for (const p of readPads()) lookup(p);
  });
  window.addEventListener('storage', e => { if (e.key === DB_KEY) _db = null; if (e.key === LAYOUT_KEY) _lsC = null; });

  /* A pad the browser does not map itself, read through the server's entry for this platform:
     SDL's position names to this pad's buttons (b3), axes (a1, +a1, -a1, a2~) and, for hats,
     the browser's hat axis as before. Positions only: byLabel() still decides the letters. */
  const SDL_POS = { a: 'A', b: 'B', x: 'X', y: 'Y', leftshoulder: 'LB', rightshoulder: 'RB', lefttrigger: 'LT', righttrigger: 'RT',
    back: 'Select', start: 'Start', leftstick: 'L3', rightstick: 'R3', dpup: 'Up', dpdown: 'Down', dpleft: 'Left', dpright: 'Right', guide: 'Home' };
  function srcOn(gp, src) {
    const b = /^b(\d+)$/.exec(src);
    if (b) { const x = (gp.buttons || [])[+b[1]]; return x == null ? false : typeof x === 'object' ? (!!x.pressed || x.value > 0.5) : x > 0.5; }
    const m = /^([+-]?)a(\d+)(~?)$/.exec(src);
    if (m) {
      let v = (gp.axes || [])[+m[2]]; if (typeof v !== 'number') return false;
      if (m[3]) v = -v;
      return m[1] === '-' ? v < -DEADZONE : v > DEADZONE;
    }
    return false;
  }
  function heldMapped(gp, map) {
    const held = new Set();
    for (const k of Object.keys(SDL_POS)) { const s = map[k]; if (s && s[0] !== 'h' && srcOn(gp, s)) held.add(SDL_POS[k]); }
    const ax = gp.axes || [];
    const axis = s => { const m = /^a(\d+)/.exec(s || ''); return m ? ax[+m[1]] : undefined; };
    const lx = map.leftx ? axis(map.leftx) : ax[0], ly = map.lefty ? axis(map.lefty) : ax[1];
    if (lx < -DEADZONE) held.add('LSLeft'); else if (lx > DEADZONE) held.add('LSRight');
    if (ly < -DEADZONE) held.add('LSUp'); else if (ly > DEADZONE) held.add('LSDown');
    if (/^h/.test(map.dpup || '') && ax.length > 9) hat(ax[9], held);
    return held;
  }

  function layoutSetting(gp) { const v = gp ? layoutStore()[String(gp.id || '')] : null; return v === 'nintendo' || v === 'xbox' ? v : 'auto'; }
  /* Auto: the server's positive answer, else the built-in table (Xbox unless identified). */
  function autoLayout(gp) {
    const a = gp ? dbAnswer(gp.id) : null;
    if (a && a.identified) return a.lettering;
    return inferLayout(gp && gp.id);
  }
  /* Why Auto chose what it did, for the Keys panel. */
  function autoWhy(gp) {
    const a = gp ? dbAnswer(gp.id) : null;
    if (a && a.identified) return 'server';
    if (inferLayout(gp && gp.id) === 'nintendo') return 'table';
    return a ? 'server-default' : 'default';
  }
  /* 'nintendo': A is the right button. 'xbox': A is the bottom button. */
  function layoutOf(gp) {
    const s = layoutSetting(gp);
    if (s !== 'auto') return s;
    return autoLayout(gp);
  }
  /* A pad's held set, renamed to the letters printed on it (a new Set; positions untouched). */
  /* THE LEFT STICK AND THE D-PAD (2026-10-17: "When I move the left stick the D-pad is also
     activated by it ... On systems that don't need the sticks, use the left stick the same as the
     D-pad. In all other situations including the tests it should not show the D-pad move when the
     stick is moved"). heldOf() names the stick's directions LSUp, LSDown, LSLeft, LSRight, never
     Up/Down/Left/Right. navMerge() turns them into D-pad directions only to MOVE the focus (site
     menus, the pause menu, a window's own screens), as the stick always did; nothing reports them as
     the D-pad. A game gets them as they are: play-pad.js stickAsDpad() makes them the console's
     D-pad only for consoles without an analogue stick (every one but the Atari 5200, whose window
     reads the stick itself). The test window and onInput() show them as the stick. */
  const LS_DIR = { LSUp: 'Up', LSDown: 'Down', LSLeft: 'Left', LSRight: 'Right' };
  function navMerge(held) {
    let any = false; for (const n of held) if (LS_DIR[n]) { any = true; break; }
    if (!any) return held;
    const out = new Set();
    for (const n of held) out.add(LS_DIR[n] || n);
    return out;
  }
  function byLabel(held, gp) {
    if (layoutOf(gp) !== 'nintendo') return held;
    const out = new Set();
    for (const n of held) out.add(LABEL_SWAP[n] || n);
    return out;
  }
  function readPads() {
    let list = [];
    try { list = Array.from((navigator.getGamepads && navigator.getGamepads()) || []); } catch (_) { list = []; }
    return list.filter(p => p && p.connected !== false).sort((x, y) => x.index - y.index).slice(0, 4);
  }

  /* ------------------------------------------------------------ the loop */

  const stats = { polls: 0, starts: 0, stops: 0, edges: 0 };
  const known = new Map();             // index -> short name
  let raf = 0, polling = false;
  const prev = [];                     // per pad: Set of held names, last frame
  const suppressed = [];               // per pad: names held when the context changed, ignored until let go
  const rep = new Map();               // 'pad:name' -> next repeat time
  let ctxKey = null, sinkWin = null;
  const inputFns = new Set();
  let captureFn = null;                // Keys P5: GnwPad.capture(fn)
  let testFn = null;                   // the controller test window (GnwPad.test(fn), 2026-10-17)
  /* A HELD (2026-10-14; tiles dropped 2026-10-25, below). On an entry in the
     Systems menu, A is timed instead of run on the press: let go before
     HOLD_MS and it is the plain A (Enter: the menu's plain
     pick), run on the release; hold it and 'gnw-longpress' goes to the focused
     element (emby.js toggles the system into or out of
     the selection, as a finger's long press does), and the release then does
     nothing. If nothing answers the long press, the release is the plain A.
     Everywhere else A still acts on the press, unchanged. */
  const HOLD_MS = 500;
  /* NOT ON A TILE ANY MORE (2026-10-25): a held A on a wall tile no
     longer plays it, as a held finger already does not (24 Oct); A on a tile is the plain A on
     the press again (the drawer), and Start or the Play badge plays. Held A stays the Systems
     menu's add-or-remove. */
  const HOLD_SEL = '.vgames-menu [data-vg-pick], .vgames-menu [data-vg-serpick], .vgames-menu [data-vg-show]';   // + Movies / Widgets tiles (28 Oct)
  let aHold = null;                    // { pad, at, el, fired } while A is held on a holdable target
  function holdTarget() {
    const a = document.activeElement;
    if (!a || a === document.body || !a.matches || !a.matches(HOLD_SEL)) return null;
    if (topEl() && !a.closest('.vgames-menu')) return null;           // a tile under an open layer is not the focus that counts
    return a;
  }
  function rumble(i) {
    try {
      const gp = readPads()[i], v = gp && gp.vibrationActuator;
      if (v && v.playEffect) v.playEffect('dual-rumble', { duration: 60, strongMagnitude: 0.3, weakMagnitude: 0.3 }).catch(() => {});
    } catch (_) {}
  }

  const visible = () => document.visibilityState !== 'hidden';
  function shouldPoll() { return known.size > 0 && visible(); }
  function start() {
    if (polling || !shouldPoll()) return;
    polling = true; stats.starts++;
    raf = requestAnimationFrame(tick);
  }
  function stop() {
    if (!polling) return;
    polling = false; stats.stops++;
    cancelAnimationFrame(raf); raf = 0;
    releaseGame();
    prev.length = 0; rep.clear();
  }
  function sync() { if (shouldPoll()) start(); else stop(); }

  function screenCtx() {
    const t = topEl();
    if (t && t.id === PAUSE_ID) return { kind: 'menu', el: t };
    if (t && PLAY_IDS.includes(t.id)) return { kind: 'game', el: t };
    return { kind: 'site', el: t };
  }
  function sinkFor(ov) {
    if (IN_PAGE.has(ov.id) && !ov.querySelector('iframe')) return window.gnwPlayPad ? { win: window, pad: window.gnwPlayPad } : null;
    const f = ov.querySelector('iframe');
    try { const w = f && f.contentWindow; return w && w.gnwPlayPad ? { win: w, pad: w.gnwPlayPad } : null; } catch (_) { return null; }
  }
  function releaseGame() {
    if (!sinkWin) return;
    try { sinkWin.gnwPlayPad.release(); } catch (_) {}
    sinkWin = null;
  }

  /* THE STICKS SCROLL, ANALOGUE (29 Oct: "Both sticks scroll the page, analogue: the further the
     stick is pushed, the faster it scrolls ... Same for scrolling inside the slide-out drawer").
     WHO DOES WHAT, so nothing is lost:
       - the D-pad moves from tile to tile, as before;
       - up / down on EITHER stick scrolls: the content page, or the open drawer (a game's or a
         film's), smoothly, faster the further it is pushed (a dead zone, then a curve to a fast
         top speed); the next D-pad press lands on a tile that is on screen (nav.js);
       - left / right on the LEFT stick still steps left / right like the D-pad; the right stick's
         left / right does nothing on the site;
       - everywhere else on the site (Settings, the Systems menu, the page windows, manuals...) the
         left stick is the D-pad and the RIGHT stick scrolls (31 Oct, below); in a game and
         the film player the sticks are exactly as before.
     Which axes are the sticks: stickAxes() below (31 Oct; was the standard layout only). */
  const SCROLL_LAYERS = new Set(['device-overlay', 'video-info-overlay']);
  const SC_DEAD = 0.18, SC_MIN = 40, SC_MAX = 2800;   // px per second at the edge of the dead zone / at full push
  let scLast = 0, scEl = null, scLayer = null;
  function scrollerIn(root) {
    if (root.scrollHeight > root.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(root).overflowY)) return root;
    let best = null, bh = 0;
    for (const el of root.querySelectorAll('*')) {
      if (el.clientHeight < 120 || el.scrollHeight <= el.clientHeight + 2) continue;
      if (!/(auto|scroll)/.test(getComputedStyle(el).overflowY)) continue;
      if (el.clientHeight > bh) { bh = el.clientHeight; best = el; }
    }
    return best;
  }
  /* WHERE EACH STICK'S UP / DOWN IS, ON ANY PAD (31 Oct: "Also right stick still doesn't do
     anything"). Until now only a pad the browser lays out itself (mapping 'standard': axis 1 the left
     stick's up / down, axis 3 the right's) scrolled; a pad the browser leaves in its own order (an
     8BitDo or a generic pad in DirectInput mode, many pads on a desk) put its right stick elsewhere and
     nothing moved. Now, in order:
       1. the standard layout: axes 1 and 3;
       2. the game server's controller database entry for this pad on this desk system (the same entry
          heldMapped() reads its buttons from): its lefty / righty axes, "a5", "a5~" (upside down);
       3. otherwise, for the right stick, the browser's own order as most such pads use it: of axes 5, 4,
          3 and 2, in that order, the first that rested at the middle when first read (a trigger rests
          at one end and is never taken) and has since been pushed past half way (an axis the browser
          lists but the pad does not have never moves). The left stick stays axis 1, as heldOf() reads it.
     source says which one was used: the controller test shows it. */
  const RS_GUESS = [5, 4, 3, 2];
  const axRest = new Map();            // pad index|id -> { first: [first readings], mid: Set, run: [], up: Set, down: Set, last }
  function axisOf(gp, src) {
    const m = /^([+-]?)a(\d+)(~?)$/.exec(src || '');
    if (!m) return null;
    const ax = gp.axes || [], n = +m[2];
    if (typeof ax[n] !== 'number') return null;
    let v = ax[n];
    if (m[3]) v = -v;
    if (m[1] === '+') v = Math.max(0, v);                            // a half axis (rare for a stick): its own half only
    else if (m[1] === '-') v = Math.min(0, v);
    return { n, v };
  }
  function stickAxes(gp) {
    const ax = gp.axes || [];
    if (gp.mapping === 'standard') return { ly: +ax[1] || 0, ry: +ax[3] || 0, lyKnown: true, ryAxis: 3, rxAxis: 2, source: 'standard' };
    const a = positionsOK() ? dbAnswer(gp.id) : null, map = a && a.mapping;
    if (map && (map.righty || map.lefty)) {
      const l = axisOf(gp, map.lefty), r = axisOf(gp, map.righty), rx = axisOf(gp, map.rightx);
      return { ly: l ? l.v : +ax[1] || 0, ry: r ? r.v : 0, lyKnown: true, ryAxis: r ? r.n : -1, rxAxis: rx ? rx.n : -1, source: r ? 'database' : 'none' };
    }
    const k = gp.index + '|' + gp.id;
    let s = axRest.get(k);
    if (!s) { s = { first: Array.from(ax, v => +v || 0), mid: new Set(), run: [], nf: [], nm: [], up: new Set(), down: new Set(), last: -1 }; axRest.set(k, s); }
    /* NOTHING LEARNED STICKS (31 Oct: "When I first start I can't use the stick to move the tiles.
       However it works fine in pages. After ... switching systems I can now scroll the tiles ... and I
       cannot scroll the pages"). FIX2b kept, for good, the first axis seen past half way both ways; so the
       right stick's own left / right axis (2 on these pads), once moved both ways, took the place of its
       up / down (5) and a straight push scrolled nothing from then on (measured: 1514 px, then 0 px). And
       the first frame's readings were taken as the resting positions; Chrome lists a pad only once a button
       is pressed or a stick is pushed past half way, so a pad first seen on its push had that stick written
       off as "resting off the middle" for the whole session (measured: 0 px straight down, every time, while
       a slanted push still scrolled through the other axis). Which axis was which depended on what had been
       moved before, which is why it flipped between the tiles and the pages.
       Now, every frame, from what the pad does NOW:
         - the candidates are the axes that rest at the middle: the first reading within 0.15, or later 20
           frames in a row within 0.15 (a pushed stick let go rests there; a trigger passing through the
           middle on its way does not stay);
         - of the candidates pushed past the dead zone now, the one pushed furthest; an axis that has been
           seen past half way both ways wins over one that has only ever gone one way (a trigger on an axis);
         - let go, nothing stays chosen: the next push decides again. The test window lists the candidates. */
    let ry = 0, ryAxis = -1, bestA = 0, bestBoth = false;
    const cands = [];
    for (const n of RS_GUESS) {
      if (n >= ax.length) continue;
      const v = +ax[n] || 0, a = Math.abs(v);
      if (!s.mid.has(n)) {
        if (Math.abs(s.first[n] || 0) <= 0.15) s.mid.add(n);
        else { s.run[n] = a <= 0.15 ? (s.run[n] || 0) + 1 : 0; if (s.run[n] >= 20) { s.mid.add(n); s.nf[n] = 0; s.nm[n] = 0; } }
        if (!s.mid.has(n)) { cands.push({ n, v, state: 'not resting at the middle' }); continue; }
      } else if (Math.abs(s.first[n] || 0) > 0.15) {
        /* First seen off the middle and admitted after resting there: a trigger that rests at one end and
           only lingered through the middle on a slow pull spends its time back at that end; a stick spends
           its time at rest. More time at the first reading than at the middle, by a second: out again. */
        if (Math.abs(v - s.first[n]) <= 0.15) s.nf[n] = (s.nf[n] || 0) + 1; else if (a <= 0.15) s.nm[n] = (s.nm[n] || 0) + 1;
        if ((s.nf[n] || 0) > (s.nm[n] || 0) + 60) { s.mid.delete(n); s.run[n] = 0; cands.push({ n, v, state: 'not resting at the middle' }); continue; }
      }
      if (v > 0.5) s.down.add(n); else if (v < -0.5) s.up.add(n);
      const both = s.down.has(n) && s.up.has(n), any = s.down.has(n) || s.up.has(n);
      cands.push({ n, v, state: both ? 'moved both ways' : s.down.has(n) ? 'moved down only' : s.up.has(n) ? 'moved up only' : 'not moved yet' });
      if (a <= SC_DEAD || !any) continue;
      if (ryAxis < 0 || (both && !bestBoth) || (both === bestBoth && a > bestA)) { ryAxis = n; ry = v; bestA = a; bestBoth = both; }
    }
    if (ryAxis >= 0) s.last = ryAxis;
    return { ly: +ax[1] || 0, ry, lyKnown: true, ryAxis: ryAxis >= 0 ? ryAxis : s.last, rxAxis: -1, source: ryAxis >= 0 || s.last >= 0 ? 'guess' : 'none', cands };
  }
  /* WHAT THE RIGHT STICK DRIVES (31 Oct): stickScroll notes, every frame, what its scrolling would
     move (the tiles, a page window, the Systems menu, a drawer, another layer, or nothing and why), and the
     pixels the sticks moved there; the last few are kept for the controller test, so one look at it says
     where the stick was going on the wall or a page before the test was opened. */
  let rsDrive = { kind: 'none', target: '', why: 'not started', at: 0, px: 0 };
  const rsHist = [];
  const elDesc = el => el === window ? 'the page' : el && el.nodeType === 1 ? (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : '')) : String(el);
  function drive(kind, target, why) {
    if (rsDrive.kind === kind && rsDrive.target === target && rsDrive.why === why) return;
    if (rsDrive.at) { rsHist.push(rsDrive); while (rsHist.length > 6) rsHist.shift(); }
    rsDrive = { kind, target, why: why || '', at: Date.now(), px: 0 };
  }
  function stickScroll(pads, held, c, now) {
    const dt = scLast ? Math.min(50, now - scLast) : 16; scLast = now;
    if (c.kind !== 'site') { drive('none', '', c.kind === 'game' ? 'a game has the pad' : 'the pause menu has the pad'); return; }
    const t = c.el;
    let target = null, rsOnly = false;
    const winOpen = () => { try { return !!(window.CwAboutWindow && window.CwAboutWindow.isOpen()); } catch (_) { return false; } };
    if (!t && onMediaPage() && !sysOpen() && !winOpen()) {
      const fa = document.activeElement;
      if (tbEditing() || (isField(fa) && !fa.readOnly)) { drive('none', '', 'typing in a text box'); return; }   // the search box at rest is readonly: it scrolls too
      target = window;
      drive('tiles', 'the page', '');
    } else if (t && SCROLL_LAYERS.has(t.id)) {
      if (scLayer !== t || !scEl || !scEl.isConnected || !t.contains(scEl)) { scLayer = t; scEl = scrollerIn(t); }
      if (!scEl) { drive('none', '', 'nothing to scroll in ' + t.id); return; }
      target = scEl;
      drive('drawer', elDesc(scEl), '');
    } else {
      /* THE RIGHT STICK SCROLLS EVERY PAGE (31 Oct: "I still can't scroll with the right stick
         on pages. Left stick acts like the D-pad and jumps to areas. Right stick does nothing on
         pages."). Anywhere else on the site (Home, Features, About and its credits, Timeline,
         Compatibility, Settings, the Systems menu, a manual, any other layer or page) the RIGHT
         stick's up / down scrolls what is open, the same analogue speed; the left stick and the
         D-pad keep stepping the focus there, and the focus ring does not move. What scrolls: the
         scroll box around the focus inside the open layer or window, else the layer's or window's
         largest scroll box, else the page. */
      rsOnly = true;
      const root = t || (winOpen() ? document.getElementById('video-about') : sysOpen() ? document.querySelector('.vgames-menu') : null);
      const fa = document.activeElement;
      let near = fa && fa !== document.body ? scrollParent(fa) : null;
      if (near && root && !root.contains(near)) near = null;
      if (near) target = near;
      else if (root) {
        if (scLayer !== root || !scEl || !scEl.isConnected || !root.contains(scEl)) { scLayer = root; scEl = scrollerIn(root); }
        target = scEl;
      } else target = window;
      const kind = t ? 'layer' : winOpen() ? 'page' : sysOpen() ? 'menu' : 'site';
      if (!target) { drive('none', '', 'no scroll box found in ' + (root ? elDesc(root) : kind)); return; }
      drive(kind, elDesc(target) + (near ? ' (around the focus)' : ''), t ? t.id : '');
    }
    let v = 0;
    for (let i = 0; i < pads.length; i++) {
      const gp = pads[i]; if (!gp) continue;
      const r = stickAxes(gp);                                         // any pad the site understands (31 Oct)
      const vals = rsOnly ? [r.ry] : [r.ly, r.ry];
      for (const a of vals) if (Math.abs(a) > Math.abs(v)) v = a;
      if (!rsOnly && r.lyKnown) { held[i].delete('LSUp'); held[i].delete('LSDown'); }   // the left stick's up / down scrolls here, it does not step
    }
    const m = Math.abs(v);
    if (m <= SC_DEAD) { scAcc = 0; return; }
    const x = Math.min(1, (m - SC_DEAD) / (1 - SC_DEAD));
    // Whole pixels, the rest kept for the next frame (a slow push moves under 1 px a frame, which a scroll box would drop).
    scAcc += Math.sign(v) * (SC_MIN + (SC_MAX - SC_MIN) * Math.pow(x, 2.2)) * dt / 1000;
    const dy = Math.trunc(scAcc); scAcc -= dy;
    if (!dy) return;
    if (target === window) window.scrollBy(0, dy); else target.scrollTop += dy;
    rsDrive.px += Math.abs(dy);
    setPadMode(true);
  }
  let scAcc = 0;

  function tick(now) {
    if (!polling) return;
    raf = requestAnimationFrame(tick);
    stats.polls++;
    const pads = readPads();
    const c = screenCtx();
    const held = pads.map(p => byLabel(heldOf(p), p));                  // by printed letter: the site AND the games (2026-10-16)
    noteSlots(pads, held);
    const key = c.kind + ':' + (c.el ? c.el.id : '');
    if (key !== ctxKey) {
      // A new screen: a button still held from the last one does nothing here until let go.
      if (c.kind !== 'game') releaseGame();
      for (let i = 0; i < held.length; i++) suppressed[i] = new Set(held[i]);
      rep.clear();
      aHold = null;
      ctxKey = key;
    }
    for (let i = 0; i < held.length; i++) {
      const s = suppressed[i];
      if (s) for (const n of Array.from(s)) { if (held[i].has(n)) held[i].delete(n); else s.delete(n); }
    }
    if (inputFns.size) for (const fn of inputFns) { try { fn(pads.map((p, i) => ({ index: p.index, id: p.id, layout: layoutOf(p), held: Array.from(byLabel(heldOf(p), p)), raw: Array.from(heldOf(p)) }))); } catch (_) {} }

    /* THE CONTROLLER TEST (2026-10-17): while the test window is open, every pad input goes
       to it, every frame, and runs nothing on the site or in a game. Raw numbers, positions and
       printed letters, so what the browser exposes can be read straight off the screen. */
    if (testFn) {
      const info = pads.map((p, i) => {
        const a = dbAnswer(p.id);
        return { index: p.index, id: p.id, name: shortName(p.id), mapping: p.mapping, platform: platform(), positionsOK: positionsOK(),
          layout: layoutOf(p), setting: layoutSetting(p), auto: autoLayout(p), why: autoWhy(p), mapped: !!(p.mapping !== 'standard' && a && a.mapping && positionsOK()),
          db: a ? { found: a.found, name: a.name, source: a.source, version: a.db } : null,
          pos: Array.from(heldOf(p)), held: Array.from(byLabel(heldOf(p), p)),
          buttons: Array.from(p.buttons || [], b => { const v = b == null ? 0 : typeof b === 'object' ? (b.pressed ? Math.max(1, +b.value || 0) : +b.value || 0) : +b || 0; return Math.round(v * 100) / 100; }),
          pressed: Array.from(p.buttons || [], b => !!b && (typeof b === 'object' ? !!b.pressed : b > 0.5)),
          axes: Array.from(p.axes || [], v => Math.round((+v || 0) * 100) / 100),
          rs: (() => { const r = stickAxes(p); return { y: r.ryAxis, x: r.rxAxis, v: Math.round(r.ry * 100) / 100, source: r.source, cands: r.cands || null }; })(),   // the right stick as the pages read it, with its candidates
          dbmap: a && a.mapping ? { lefty: a.mapping.lefty || '', righty: a.mapping.righty || '', rightx: a.mapping.rightx || '' } : null,
          drive: Object.assign({}, rsDrive), hist: rsHist.slice() };   // what the right stick drives, and where it went before this window
      });
      if (info.some(x => x.pressed.some(Boolean))) setPadMode(true);
      try { testFn(info); } catch (_) {}
      for (let i = 0; i < held.length; i++) prev[i] = held[i];
      prev.length = held.length;
      return;
    }

    // Keys P5: Settings is asking for "press a button": the next new button goes to it and runs nothing.
    if (captureFn) {
      for (let i = 0; i < held.length; i++) {
        const p = prev[i] || new Set();
        for (const n of held[i]) if (!p.has(n) && !LS_DIR[n]) { stats.edges++; setPadMode(true); const fn = captureFn; const pos = layoutOf(pads[i]) === 'nintendo' ? (LABEL_SWAP[n] || n) : n; /* the position, for the one-press check */ try { fn('Pad:' + n, i, 'Pad:' + pos); } catch (_) {} }
        prev[i] = held[i];
      }
      prev.length = held.length;
      return;
    }

    if (c.kind === 'game') {
      const s = sinkFor(c.el);
      if (s && sinkWin && sinkWin !== s.win) releaseGame();
      if (s) {
        sinkWin = s.win;
        const anyNew = held.some((h, i) => Array.from(h).some(n => !(prev[i] && prev[i].has(n))));
        if (anyNew) { setPadMode(true); stats.edges++; }
        try { s.pad.feed(held.map(h => Array.from(h)), { ov: c.el.id, uiPlayers: held.map(h => Array.from(navMerge(h))) }); } catch (e) { console.warn('[gamepad] play window:', e); }
      } else {
        // No helper in this window (still loading): Home / Select+Start still reach the menu.
        held.forEach((h, i) => { const p = prev[i] || new Set(); if ((h.has('Home') && !p.has('Home')) || (h.has('Select') && h.has('Start') && !(p.has('Select') && p.has('Start')))) press('Escape'); });
      }
      for (let i = 0; i < held.length; i++) prev[i] = held[i];
      prev.length = held.length;
      return;
    }

    // The site and the pause menu: every pad drives the one focus (the left stick moves it too).
    stickScroll(pads, held, c, now);
    const nav = held.map(navMerge);
    const t = performance.now();
    if (aHold) {
      const h = nav[aHold.pad];
      if (!h || !h.has('A')) {                                          // let go
        const hd = aHold; aHold = null;
        if (!hd.fired && c.kind === 'site') runPad('Pad:A', false);
      } else if (!aHold.fired && t - aHold.at >= HOLD_MS) {
        aHold.fired = true;
        const el = aHold.el;
        let answered = false;
        if (el.isConnected && document.activeElement === el) {
          const ev = new CustomEvent('gnw-longpress', { bubbles: true, cancelable: true, detail: { source: 'pad' } });
          el.dispatchEvent(ev);
          answered = ev.defaultPrevented;
        }
        if (answered) rumble(aHold.pad);
        else { aHold.fired = false; aHold.at = Infinity; }               // unanswered: the release is the plain A
      }
    }
    for (let i = 0; i < nav.length; i++) {
      const p = prev[i] || new Set();
      const h = nav[i];
      for (const n of h) {
        const id = i + ':' + n;
        if (!p.has(n) && n === 'A' && c.kind === 'site' && !aHold && !h.has('Select')) {
          const el = holdTarget();
          if (el) { stats.edges++; setPadMode(true); aHold = { pad: i, at: t, el, fired: false }; continue; }
        }
        if (!p.has(n)) { stats.edges++; setPadMode(true); onPress(c, n, h, false); if (REPEAT[n] || SHOULDER[n]) rep.set(id, t + (SHOULDER[n] ? SHOULDER_FIRST_MS : FIRST_MS)); }
        else if ((REPEAT[n] || SHOULDER[n]) && rep.has(id) && t >= rep.get(id)) { rep.set(id, t + (SHOULDER[n] ? SHOULDER_NEXT_MS : n === 'LT' || n === 'RT' ? SEEK_NEXT_MS : NEXT_MS)); onPress(c, n, h, true); }
      }
      for (const n of p) if (!h.has(n)) rep.delete(i + ':' + n);
      prev[i] = h;
    }
    prev.length = held.length;
  }

  function onPress(c, n, held, repeat) {
    if (c.kind === 'menu') {
      if (n === 'Up' || n === 'Down') { press(n === 'Up' ? 'ArrowUp' : 'ArrowDown', repeat); return; }
      if (repeat) return;
      if (n === 'A') { const a = document.activeElement; if (a && c.el.contains(a) && a.tagName === 'BUTTON') a.click(); return; }
      if (n === 'B') { press('Escape'); return; }                         // Back: resumes the game (keys.js; only Quit quits)
      if (n === 'Start' || n === 'Home') { const k = K(); if (k && k.closePause) k.closePause(); return; }
      return;
    }
    if (repeat && !REPEAT[n] && !(SHOULDER[n] && c.kind === 'site' && window.GnwSwitcher && window.GnwSwitcher.isOpen())) return;
    // Select+Start is the Guide button here too (2026-10-17: the chord must open the Guide
    // menu wherever the focus is, as Home does). The play window does the same.
    const guide = n === 'Home' || (n === 'Start' && held.has('Select')) || (n === 'Select' && held.has('Start'));
    // Settings over a game: Guide closes Settings and opens the Guide menu (keys.js, 2026-10-23).
    if (guide && !repeat) { const k = K(); if (k && k.guideFromSettings && k.guideFromSettings()) return; }
    if ((n === 'Start' && held.has('Select')) || (n === 'Select' && held.has('Start'))) { if (!repeat) runPad('Pad:Home', false); return; }
    if (n === 'B' && !repeat && c.kind === 'site' && tbBack()) return;    // the Media toolbar, entered by LT: back to the tile
    runPad('Pad:' + n, repeat);
  }

  /* ------------------------------------------------------------ connect / disconnect */

  const shortName = id => String(id || 'Controller').replace(/\s*\((STANDARD GAMEPAD|Vendor:)[^)]*\)\s*/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 48) || 'Controller';
  const knownId = new Map();           // index -> the id of the pad there (2026-10-17)
  function padsChanged() { try { window.dispatchEvent(new CustomEvent('gnw-pads-changed')); } catch (_) {} }
  /* A pad at an index: new, or a DIFFERENT pad where another was (a phone bug,
     2026-10-17: the old code ignored a connect at an index it still knew, so the second pad
     kept the first one's name until a reload). The id is re-read from the browser's list. */
  function connected(gp) {
    if (!gp) return;
    const live = readPads().find(p => p.index === gp.index);
    if (live) gp = live;
    if (known.has(gp.index) && knownId.get(gp.index) === gp.id) return;
    const swapped = known.has(gp.index);
    known.set(gp.index, shortName(gp.id)); knownId.set(gp.index, gp.id);
    if (typeof window.toast === 'function') { try { window.toast('Controller connected: ' + shortName(gp.id), 'success', 3200); } catch (_) {} }
    if (swapped) resetSlots();
    lookup(gp);
    padsChanged();
    sync();
  }
  function disconnected(gp) {
    if (!gp || !known.has(gp.index)) return;
    const name = known.get(gp.index);
    known.delete(gp.index); knownId.delete(gp.index); goneSince.delete(gp.index);
    if (typeof window.toast === 'function') { try { window.toast('Controller disconnected: ' + name, 'info', 2600); } catch (_) {} }
    if (!known.size) setPadMode(false);
    resetSlots();
    padsChanged();
    sync();
  }
  /* Per list slot (players are the connected pads in index order): which pad it held last
     frame. A different pad in a slot starts clean: nothing held carries over, nothing it holds
     now acts until let go, no repeat or A-hold continues. */
  const slotKey = [];
  const goneSince = new Map();         // index -> when a known pad was first missing from the list
  function resetSlots() { slotKey.length = 0; }
  function noteSlots(pads, held) {
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i], k = p.index + '|' + p.id;
      if (knownId.get(p.index) !== p.id) connected(p);             // no event came (or a different pad there)
      if (slotKey[i] === k) continue;
      slotKey[i] = k;
      // A pad new to this slot (connected, swapped in, or after a reload): what it holds as it
      // arrives (often the press that woke it) acts only once let go and pressed again.
      prev[i] = new Set(); suppressed[i] = new Set(held[i]);
      for (const r of Array.from(rep.keys())) if (r.split(':')[0] === String(i)) rep.delete(r);
      if (aHold && aHold.pad === i) aHold = null;
    }
    slotKey.length = pads.length;
    // A known pad missing from the list for over a second, with no disconnect event: gone.
    const now = Date.now(), live = new Set(pads.map(p => p.index));
    for (const idx of Array.from(known.keys())) {
      if (live.has(idx)) { goneSince.delete(idx); continue; }
      if (!goneSince.has(idx)) goneSince.set(idx, now);
      else if (now - goneSince.get(idx) > 1000) disconnected({ index: idx });
    }
  }
  window.addEventListener('gamepadconnected', e => {
    let gp = e.gamepad;
    if (!gp) { const l = readPads(); gp = l.find(p => knownId.get(p.index) !== p.id) || null; }
    connected(gp);
  });
  window.addEventListener('gamepaddisconnected', e => {
    let gp = e.gamepad;
    if (!gp) { const live = new Set(readPads().map(p => p.index)); const gone = Array.from(known.keys()).find(i => !live.has(i)); gp = gone != null ? { index: gone } : null; }
    disconnected(gp);
  });
  document.addEventListener('visibilitychange', sync);

  /* ------------------------------------------------------------ remote keys (Tizen / webOS) */

  // The colour keys and Info run the pad's own actions (scope 'pad').
  window.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.__gnwPad) return;
    const F = A(); if (!F) return;
    const id = F.match(e, 'pad');
    if (!id) return;
    const t = topEl();
    if (t && (t.id === PAUSE_ID || PLAY_IDS.includes(t.id))) return;    // a game owns its keys
    if (isField(e.target)) return;
    e.preventDefault();
    if (!e.repeat) F.run(id, e);
  });
  // Channel up / down with focus off the grid: one screen of the page.
  window.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.__gnwPad) return;
    if (!(e.key === 'ChannelUp' || e.key === 'ChannelDown' || e.keyCode === 427 || e.keyCode === 428)) return;
    const t = topEl(); if (t) return;
    if (isField(e.target)) return;
    e.preventDefault();
    window.scrollBy({ top: ((e.key === 'ChannelUp' || e.keyCode === 427) ? -1 : 1) * window.innerHeight * 0.8 });
  });

  const TIZEN_KEYS = ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind', 'MediaTrackPrevious', 'MediaTrackNext',
    'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'ChannelUp', 'ChannelDown', 'Info'];
  const tizenState = { present: false, registered: [] };
  function registerTizenKeys() {
    try {
      const t = window.tizen && window.tizen.tvinputdevice;
      if (!t) return;
      tizenState.present = true;
      let sup = null;
      try { sup = new Set((t.getSupportedKeys() || []).map(k => k.name)); } catch (_) { sup = null; }
      const want = TIZEN_KEYS.filter(k => !sup || sup.has(k));
      for (const k of want) { try { t.registerKey(k); tizenState.registered.push(k); } catch (_) {} }
    } catch (_) {}
  }

  /* TV overscan (doc R8): the toast stack is fixed to the corner, outside the
     page's padded container, so it is pushed in by hand like the close buttons. */
  function styles() {
    if (document.getElementById('gp-style')) return;
    const st = document.createElement('style');
    st.id = 'gp-style';
    st.textContent = `
      body.gnw-tv .toast-host { top: max(4vh, env(safe-area-inset-top, 0px)); right: max(5vw, env(safe-area-inset-right, 0px)); width: calc(100vw - 2 * max(5vw, env(safe-area-inset-right, 0px))); }
    `;
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------ boot and the phase 5 hook */

  function boot() {
    styles();
    registerTizenKeys();
    if (!registerAll()) window.addEventListener('gnw-actions-ready', registerAll, { once: true });
    // A pad already connected before this page loaded (a reload): one look, not a loop.
    for (const gp of readPads()) connected(gp);
  }

  window.GnwPad = {
    BUILD, NAMES,
    /* auto: what Auto picks; why: 'server' (the game server's database identified it), 'table'
       (the built-in table did), 'server-default' / 'default' (not identified: Xbox letters);
       db: the server's answer kept for this pad, or null; mapped: positions from that answer. */
    pads: () => readPads().map(p => {
      const a = dbAnswer(p.id);
      return { index: p.index, id: p.id, name: shortName(p.id), mapping: p.mapping, layout: layoutOf(p), setting: layoutSetting(p), auto: autoLayout(p), why: autoWhy(p),
        db: a ? { found: a.found, name: a.name, source: a.source, version: a.db } : null, mapped: !!(p.mapping !== 'standard' && a && a.mapping) };
    }),
    platform, lookup: id => { const p = readPads().find(x => x.id === id); if (p) { const o = dbStore(); delete o[dbKey(id)]; lookup(p); } },
    /* The saved lettering, per controller id: 'auto' (inferLayout), 'nintendo' (A on the right) or 'xbox' (A at the bottom). */
    layout: id => { const v = layoutStore()[String(id || '')]; return v === 'nintendo' || v === 'xbox' ? v : 'auto'; },
    inferLayout, parseId,
    setLayout(id, v) {
      const o = layoutStore(), k = String(id || '');
      if (v === 'nintendo' || v === 'xbox') o[k] = v; else delete o[k];
      try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(o)); } catch (_) {}
      _lsC = o; _lsAt = Date.now();
      ctxKey = null;                     // buttons held through the change do nothing until let go
    },
    bindings() {
      const F = A(); if (!F) return [];
      const out = [];
      for (const n of NAMES.concat(['Select+Start'])) {
        const k = 'Pad:' + n;
        out.push({ key: k, label: F.format(k), actions: F.list().filter(a => a.keys.includes(k)).map(a => ({ id: a.id, label: a.label, scope: a.scope })) });
      }
      return out;
    },
    onInput(fn) { inputFns.add(fn); return () => inputFns.delete(fn); },
    /* Where this pad's sticks are, as the site reads them (stickAxes): { ly, ry, ryAxis, rxAxis, source }.
       R.O.B. Play Time turns its view with the right stick (4 Nov 2026). */
    sticks: gp => stickAxes(gp),
    /* Keys P5: while set, every NEW pad button goes to fn('Pad:A', padIndex) instead of running an
       action. Returns the release; buttons still held at release do nothing until let go. */
    capture(fn) {
      captureFn = typeof fn === 'function' ? fn : null;
      return () => { if (captureFn === fn) { captureFn = null; ctxKey = null; } };
    },
    capturing: () => !!captureFn,
    /* The controller test: fn(info) every frame while set; nothing runs. Returns the release; buttons
       still held at release do nothing until let go. Polling starts even before a pad is known. */
    test(fn) {
      testFn = typeof fn === 'function' ? fn : null;
      if (testFn && !polling && visible()) { polling = true; stats.starts++; raf = requestAnimationFrame(tick); }
      return () => { if (testFn === fn) { testFn = null; ctxKey = null; sync(); } };
    },
    testing: () => !!testFn,
    /* "What it starts with is what it ends with" (2026-10-17): keys.js sets the pad
       mode back to how a game was started when its window closes, however it was closed. The
       same state a pad press sets (body.gk-pad, focus with the ring); idempotent. On: the focus
       gets its ring. Off: the next focus draws none (the ring already drawn is keys.js's to clear). */
    setPadMode: on => { setPadMode(!!on); return padMode; },
    padMode: () => padMode,
    gameMaps: () => (window.gnwPlayPad ? window.gnwPlayPad.MAPS : null),
    state: () => ({ polling, connected: Array.from(known.entries()), padMode, context: ctxKey, last: Object.assign({}, last), tizen: Object.assign({}, tizenState), stats: Object.assign({}, stats), drive: Object.assign({}, rsDrive), hist: rsHist.slice() }),
    run: runPad,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

/*
 * play/shared/control-bar.js -- THE CONTROL BAR, the unified play window's shell (2026-10-07).
 *
 * The design is the play interface design; its section 0.1 holds the
 * binding decisions (A1-A14) and they are what this file implements:
 *   A1  the Control Bar IS the existing top bar (Vermin MT-03's pill), the same
 *       place, the same look, standard on every device.
 *   A2  a Settings panel (display choices: palette, zoom, language), opened
 *       with the same shrink-and-grow as Keys (play/play-pill.js).
 *   A3  Reset is instant, no confirmation.
 *   A4  saves: ONE TABLE on every console (8 Nov 2026, play/shared/save-table.js): up to 20 saves
 *       a game, newest first, the picture first (both screens, both linked consoles, as saved).
 *   A5  .cwsave export and import (CwSave below).
 *   A6  narrow: icons only, less-used items behind More (...).
 *   A7  Record and Cheats are in the source but hidden (ITEMS, `hidden: true`).
 *   A8  OPEN: buttons drawn on the device art are left exactly as they are; the
 *       bar adds nothing for them.
 *   A9  the bar never hides while playing, TV included.
 *   A11 the "Last closed" auto save is PINNED ON TOP of the table, in its own colour (8 Nov 2026).
 *   A13 Full screen: only the game screen, no art; the bar stays, with "< Back".
 *   A14 nothing in the window's title bar but the title and the x: everything a
 *       header used to hold is a bar item or a Settings row.
 * And the Keys clarification: the Keys panel is a shared FRAME; its
 * contents (buttons, diagram, default bindings) are each device's own.
 *
 * HOW A WINDOW USES IT. A play page loads this file, then registers its core:
 *     if (window.ControlBar && ControlBar.wants('gb')) ControlBar.register(core);
 * `core` is the capability contract (doc section 7, "gnwCore"). EVERYTHING IS
 * OPTIONAL: an item the core does not declare is not shown (hidden, never greyed).
 *
 *   sys, label                    'gb', 'Game Boy'
 *   stage                         the element the bar and panels float over
 *   caps()                        { pause, reset, rewind, saves: {slots, cols},
 *                                   transfer (export/import), lastClosed,
 *                                   screenshot, mute, keys, help, fullscreen,
 *                                   settings, variant, speed, record, cheats }
 *   title()                       the game's name (file names, the Saves heading)
 *   paused() / pause(on)          the PLAYER's pause; pause() returns true if it changed
 *   hold(on)                      a panel's pause: never touches the player's pause
 *   reset()                       power-cycle, instantly (A3)
 *   rewind: { start(), stop(), active() }
 *   muted() / setMuted(on)
 *   states: { list(), save(i), load(i), remove(i), put(i, rec),
 *             exportOf(i) -> {bytes, meta}, importInto(i, bytes, meta) }
 *            list() resolves to an array of { ts, thumb, thumbWhy } | null, any
 *            length: slots past the A4 count that hold a save are still shown
 *            (an older grid's saves are never hidden or lost).
 *   identity()                    { sys, game, title, gameHash, core, device }
 *   continueRestore(rec)          load the Continue row's save (Last closed)
 *   screenshot()                  a PNG data URL of the screen alone, native size
 *   keysContent()                 the device's own Keys diagram (an element, moved in)
 *   settings()                    [{ section, nodes: [elements moved in] }]
 *   fullscreen(on)                show only the screen (art off) / back
 *   onChange(fn)                  the core calls fn when pause/mute/rewind change
 *   consoleKeys (caps)            [{ id, label, icon, key }]: the console's own keys that
 *                                 have no button on the art (Pokemon mini Power and Shake).
 *                                 A bar item each, in the per-console group; held while the
 *                                 pointer is down; a keyboard or remote press taps it.
 *   consoleKey(id, down)          press / release one of them
 *   focusGame()                   give the keyboard back to the game (an in-page device
 *                                 takes keys on its own element, not on the window)
 *   help()                        open the help over the game (else the play page's own)
 *   onExit(what)                  Back left the bar ('bar') or closed a menu ('menu'): a window
 *                                 that came here from the Guide menu returns to it (2026-10-14)
 *   statusLog()  (caps.statusLog) show the status line and the log (the small-screen route to
 *                                 them, where the status line is hidden: 2026-10-14)
 *   rotate()  (caps.rotate)       turn the screen (the Lynx); the Rotate item, key R on the page
 *   devices (caps)                [{ id, icon, label }]: a cartridge's own peripherals the core
 *                                 declared (2026-10-15: the Game Boy's tilt sensor and Pocket
 *                                 Camera). An item each ('dev:<id>') that opens its menu.
 *   device(id)                    { label(), menu() -> [{ id, label, checked?, info? }], choose(itemId),
 *                                   state()? -> 'on' | 'off' | 'paused' }. Off shows the item's icon
 *                                 in the muted red, no cross (2026-10-17), paused shows it
 *                                 with a pause mark, on shows it plain (2026-10-15). The
 *                                 label, tooltip and accessible name are the device's label().
 *   media: { list(), current(), label(), insert(id), eject() }   (caps.media) disk sides and tapes
 *                                 (Core API extension 'media', 2026-10-14): the Media item shows
 *                                 what is in the drive and opens a menu of the sides, and Eject.
 *   printer (caps)                the Game Boy Printer's window (2026-10-21): a Print item, shown
 *                                 while printer.visible(), opens the 'print' panel (printer.content()).
 *                                 It does not pause: the game keeps sending the picture while it shows.
 *                                 While it is open the bar is Back / Save / Print / Throw away
 *                                 (2026-10-21; 2026-10-25): Back closes the window and KEEPS the
 *                                 paper (the Print item opens it again), Save keeps a PNG (printer.png(scale)),
 *                                 Print opens the print dialog (printer.print()), Throw away clears the
 *                                 paper (printer.discard()) and closes the window.
 *   padSwap: { on(), set(on), does(), seen() }   (caps.padSwap) the Swap A/B item (7 Nov 2026): a controller's A and B,
 *                                 and X and Y, change places for the game only. does(): pressing them reaches
 *                                 different controls here (else the item is hidden); seen(): a controller has fed
 *                                 this window (the host applies the swap, play/host/host.mjs).
 *   speed() / setSpeed(x)         (caps.speed: the choices, e.g. [1, 2, 4]) fast-forward (decision P4,
 *                                 2026-10-14): the Speed item opens a menu of the choices; the item
 *                                 shows the current one. Only the one play host declares it.
 *
 * IN-PAGE WINDOWS (2026-10-11, Pokemon mini). A console that is not in a frame of its
 * own runs the bar in the site's document. Its core adds:
 *   hostPost(msg)                 the relay to the host side (CwUnifiedHost.local), in
 *                                 place of postMessage; replies arrive by ControlBar.receive
 *   live()                        true while its window is open and in front: the bar's
 *                                 keys act only then, so the rest of the site is untouched
 * and the bar itself takes Back (Escape, Backspace, a remote's Back) while a menu, a
 * panel or full screen is open, because keys.js listens later than this file does.
 * ControlBar.sleep() / wake() follow the window closing and opening again.
 *
 * THE FLAG. `?ui=unified` on the site (or on the play page itself) turns the bar
 * on for every family that has an adapter; `?ui=legacy` turns it off. Without
 * either, DEFAULT_ON decides: a family is added there once it is proven. A framed
 * page asks its host (window.parent.CwUnifiedHost, play/shared/host-bridge.js),
 * so the host's header and the page agree on one answer.
 *
 * SOUND: none. The bar makes no sound and starts none (the sound rule);
 * Mute only calls the core's own mute.
 */
(function () {
  'use strict';
  if (window.ControlBar) return;

  const BUILD = '20261108-cb50-saves';
  /* Families whose unified bar is proven and on by default. */
  const DEFAULT_ON = new Set(['gb', 'pm', 'a2600', 'a5200', 'a7800', 'alynx']); // GB proven 2026-10-08 (232/232); PM 2026-10-11 (pm-cb run.mjs); the Ataris 2026-10-11 (pm-cb arun.mjs)
  const framed = window.parent && window.parent !== window;
  /* Screenshot -> phone photo library (play/shared/save-image.js), loaded now so it is ready before the tap. */
  if (!window.CwSaveImage) try { const s = document.createElement('script'); s.src = new URL('save-image.js?v=2.1.0', document.currentScript.src).href; document.head.appendChild(s); } catch (_) {}
  /* The one save table (play/shared/save-table.js, 8 Nov 2026), loaded now; renderSaves waits for it. */
  const saveTableReady = window.CwSaveTable ? Promise.resolve() : new Promise(res => { try { const s = document.createElement('script'); s.src = new URL('save-table.js?v=2.1.0', document.currentScript.src).href; s.onload = res; s.onerror = res; document.head.appendChild(s); } catch (_) { res(); } });

  /* ------------------------------------------------------------------ flag */
  /* One bar for every console, in the one play host (2026-10-15): the ?ui= switch is gone. */
  function wants(sys) { return true; }

  /* ------------------------------------------------------------------ .cwsave
     One file per save (A5, doc Q5). Layout, little-endian:
       0   "CWSAVE" 0x1A 0x01        magic + format version (8 bytes)
       8   u32 metaLen, then metaLen bytes of UTF-8 JSON:
             { format, sys, game, title, gameHash, core, device, ts, thumb }
       ..  u32 stateLen, then the core's own state bytes, untouched.
     The state is the core's native save-state container; the meta says which
     console, game and core made it, so a save from another core is refused with
     a reason, never loaded into the wrong machine. */
  const MAGIC = [0x43, 0x57, 0x53, 0x41, 0x56, 0x45, 0x1a, 0x01];
  const CwSave = {
    FORMAT: 1, EXT: '.cwsave',
    encode(meta, state) {
      const m = new TextEncoder().encode(JSON.stringify(Object.assign({ format: 1 }, meta)));
      const s = state instanceof Uint8Array ? state : new Uint8Array(state);
      const out = new Uint8Array(8 + 4 + m.length + 4 + s.length);
      const dv = new DataView(out.buffer);
      out.set(MAGIC, 0);
      dv.setUint32(8, m.length, true); out.set(m, 12);
      dv.setUint32(12 + m.length, s.length, true); out.set(s, 16 + m.length);
      return out;
    },
    decode(bytes) {
      const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      if (u.length < 16 || MAGIC.some((b, i) => u[i] !== b)) throw new Error('This is not a .cwsave file.');
      const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
      const ml = dv.getUint32(8, true);
      if (12 + ml + 4 > u.length) throw new Error('This .cwsave file is cut short.');
      let meta;
      try { meta = JSON.parse(new TextDecoder().decode(u.subarray(12, 12 + ml))); } catch (_) { throw new Error('This .cwsave file is damaged (its description cannot be read).'); }
      const sl = dv.getUint32(12 + ml, true);
      if (16 + ml + sl > u.length) throw new Error('This .cwsave file is cut short.');
      return { meta, state: u.slice(16 + ml, 16 + ml + sl) };
    },
    /* Why a save cannot go into this machine, or null when it can. */
    refusal(meta, id) {
      if (!meta || meta.format !== 1) return 'This save was written by a newer version of the site.';
      if (meta.sys !== id.sys) return `This save is from a different console (${meta.sysLabel || meta.sys}), not this ${id.label || id.sys}.`;
      if (id.gameHash && meta.gameHash && meta.gameHash !== id.gameHash) return `This save is for ${meta.title ? '"' + meta.title + '"' : 'a different game'}, not this one.`;
      // Another core build is no longer refused here: the host tries it and says plainly if the core
      // rejects it (the common save format, 2026-10-18).
      return null;
    },
  };
  window.CwSave = CwSave;

  /* ------------------------------------------------------------------ icons */
  const S = (w, body, extra) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra || ''}>${body}</svg>`;
  const ICON = {
    pause: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="1.5" width="2.6" height="9" rx=".6" fill="currentColor"/><rect x="7.4" y="1.5" width="2.6" height="9" rx=".6" fill="currentColor"/></svg>',
    play: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.6v8.8L10.4 6z" fill="currentColor"/></svg>',
    reset: S(15, '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v5h5"/>'),
    rewind: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11 6 L11 18 L3 12 Z M21 6 L21 18 L13 12 Z"/></svg>',
    saves: S(15, '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5"/>'),
    swap: S(15, '<path d="M4 8h14M14 4l4 4-4 4"/><path d="M20 16H6M10 12l-4 4 4 4"/>'),
    keys: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8.5" y="2" width="7" height="7" rx="1.8"/><rect x="1" y="10.5" width="7" height="7" rx="1.8"/><rect x="8.5" y="10.5" width="7" height="7" rx="1.8"/><rect x="16" y="10.5" width="7" height="7" rx="1.8"/></svg>',
    help: S(15, '<circle cx="12" cy="12" r="9.5"/><path d="M9.3 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.5-2.7 4"/><path d="M12 17.4h.01"/>'),
    variant: S(15, '<path d="M12 3 3 7.5 12 12l9-4.5z"/><path d="m3 12 9 4.5 9-4.5"/><path d="m3 16.5 9 4.5 9-4.5"/>'),
    speed: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 6 L3 18 L11 12 Z M13 6 L13 18 L21 12 Z"/></svg>',
    disk: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3" width="17" height="18" rx="2"/><rect x="7.5" y="3" width="9" height="6"/><rect x="7" y="13" width="10" height="8" rx="1"/></svg>',
    shot: S(15, '<path d="M4 8h3l1.6-2.4h6.8L17 8h3v11H4z"/><circle cx="12" cy="13.3" r="3.4"/>'),
    record: '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" style="fill:var(--cw-bar-rec,#e05a5a)"/></svg>',
    cheats: S(15, '<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 9.2-9.2M17 6l3 3M15 8l2 2"/>'),
    soundOn: S(15, '<path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" fill="currentColor" stroke-width="1.5"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
    soundOff: S(15, '<path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" fill="currentColor" stroke-width="1.5"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>'),
    full: S(15, '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>'),
    gear: S(15, '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    more: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    log: S(15, '<rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 8.5h8M8 12h8M8 15.5h5"/>'),
    power: S(15, '<path d="M12 3v8"/><path d="M6.6 6.6a7.5 7.5 0 1 0 10.8 0"/>'),
    switch: S(15, '<rect x="3" y="8" width="18" height="8" rx="4"/><circle cx="15" cy="12" r="2.2" fill="currentColor"/>'),
    rotate: S(15, '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
    shake: S(15, '<rect x="8" y="4" width="8" height="16" rx="2"/><path d="M4.5 8.5 3 12l1.5 3.5M19.5 8.5 21 12l-1.5 3.5"/>'),
    back: S(15, '<path d="M19 12H5M12 19l-7-7 7-7"/>'),
    camera: S(15, '<rect x="2.5" y="6.5" width="13" height="11" rx="2"/><path d="m15.5 10.5 6-3.5v10l-6-3.5z"/>'),
    mic: S(15, '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'),
    mat: S(15, '<rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="7" cy="9.5" r="1.6"/><circle cx="12" cy="9.5" r="1.6"/><circle cx="17" cy="9.5" r="1.6"/><circle cx="7" cy="14.5" r="1.6"/><circle cx="12" cy="14.5" r="1.6"/><circle cx="17" cy="14.5" r="1.6"/>'),
    tape: S(15, '<rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="8" cy="11" r="2.2"/><circle cx="16" cy="11" r="2.2"/><path d="M8 13.2h8M6 19l1.5-3h9L18 19"/>'),
    tilt: S(15, '<rect x="5" y="4" width="14" height="16" rx="2.2" transform="rotate(-14 12 12)"/><path d="M3 21h18"/>'),
    printer: S(15, '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>'),
    trash: S(15, '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
    download: S(15, '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>'),
    chev: '<svg width="9" height="9" viewBox="0 0 10 6" aria-hidden="true"><path d="M0 0l5 6 5-6z" fill="currentColor"/></svg>',
  };

  /* ------------------------------------------------------------------ the items
     In the bar's order (doc 3.1): the core group, the per-console items, the
     window group. `cap` names the capability that shows the item; `more` items
     go behind More (...) on a narrow bar (A6); `hidden` items are kept in the
     source but never shown (A7: Record). Cheats (2026-10-26) is a menu now: providers, then
     that game's cheats; its button shows only while the game has cheats this player can run. */
  /* THE ORDER AND THE TWO ROWS (2026-10-29, asked: "Put Pause, Rewind, Fast forward, Mute and
     Full screen together, in that order. Move Cheats to the right of Variants. Move Screenshots to
     the right of Saves. Start a second row with Keys, Help, Log and Settings, in that order").
     `row` 1 is the playing row: the play group (Pause, Rewind, Speed, Mute, Full screen), then
     Reset, Saves and Screenshot, then the console's own (Variant, Cheats, Rotate, Disk, Print,
     Console, its peripherals and keys). `row` 2 is the window's: Keys, Help, Log, Settings, never
     behind More (four buttons fit a phone). On a narrow bar More holds row 1's less-used items in
     this same order. Reset was not placed in the request: it stays beside Saves, the other
     "state of the game" items. */
  const ITEMS = [
    { id: 'pause',   group: 'play',    cap: 'pause',      icon: 'pause',   label: 'Pause',       key: 'Ctrl+P' },
    { id: 'rewind',  group: 'play',    cap: 'rewind',     icon: 'rewind',  label: 'Rewind',      key: 'hold Ctrl+←', hold: true },
    { id: 'speed',   group: 'play',    cap: 'speed',      icon: 'speed',   label: 'Turbo',          key: 'Ctrl+→', menu: true, more: true },
    { id: 'mute',    group: 'play',    cap: 'mute',       icon: 'soundOn', label: 'Mute',        key: 'Ctrl+M' },
    { id: 'full',    group: 'play',    cap: 'fullscreen', icon: 'full',    label: 'Full screen', key: 'Ctrl+Shift+F', iconOnly: true },
    { id: 'reset',   group: 'state',   cap: 'reset',      icon: 'reset',   label: 'Reset' },
    { id: 'saves',   group: 'state',   cap: 'saves',      icon: 'saves',   label: 'Saves',       key: 'Ctrl+S save · Ctrl+L load · Ctrl+[ ] select', panel: true },
    { id: 'shot',    group: 'state',   cap: 'screenshot', icon: 'shot',    label: 'Screenshot',  more: true },
    { id: 'record',  group: 'state',   cap: 'record',     icon: 'record',  label: 'Record',      more: true, hidden: true },
    /* VARIANT AND CHEATS START ROW 2 (31 Oct: "move Variants and Cheats to the start of the second
       row, then place a divider between them and the other buttons on that row"): row 2 is Variant,
       Cheats, a divider, then Keys, Help, Log and Settings; row 1 keeps its order without them. */
    { id: 'variant', group: 'pick',    row: 2, cap: 'variant',    icon: 'variant', label: 'Variant',     menu: true },
    { id: 'cheats',  group: 'pick',    row: 2, cap: 'cheats',     icon: 'cheats',  label: 'Cheats',      more: true, menu: true },
    { id: 'rotate',  group: 'console', cap: 'rotate',     icon: 'rotate',  label: 'Rotate',      key: 'R' },
    { id: 'media',   group: 'console', cap: 'media',      icon: 'disk',    label: 'Disk',        menu: true },
    /* The Game Boy Printer's window (2026-10-21): shown while the core says so (sync). */
    { id: 'print',   group: 'console', cap: 'printer',    icon: 'printer', label: 'Print',       panel: true },
    /* A crowded bar keeps every core item and puts the console's own keys in this one menu
       instead (2026-10-15: "the same bar as the Game Boy's on every system"). */
    { id: 'console', group: 'console', cap: 'consoleKeys', icon: 'keys',    label: 'Console',     menu: true },
    /* Row 2. Help, Full screen and Settings are universal icons: icon only at every width
       (2026-10-15); the tooltip and the accessible name keep their words. */
    /* Swap A/B (7 Nov 2026): directly left of Keys. A toggle, lit while on; see sync() and the host. */
    { id: 'swap',    group: 'window',  row: 2, cap: 'padSwap',   icon: 'swap',    label: 'Swap A/B',    key: 'Ctrl+B', title: 'Swap A with B and X with Y' },
    { id: 'keys',    group: 'window',  row: 2, cap: 'keys',      icon: 'keys',    label: 'Keys',        key: 'Ctrl+/', panel: true },
    { id: 'help',    group: 'window',  row: 2, cap: 'help',      icon: 'help',    label: 'Help',        key: '?', iconOnly: true },
    { id: 'status',  group: 'window',  row: 2, cap: 'statusLog', icon: 'log',     label: 'Log',         title: 'Log: the status line and the messages' },
    { id: 'settings',group: 'window',  row: 2, cap: 'settings',  icon: 'gear',    label: 'Settings',    panel: true, iconOnly: true },
  ];
  const PANEL_TITLE = { saves: 'Saves', keys: 'Keys', settings: 'Settings', cheats: 'Cheats', print: 'Back' };
  /* A panel shown by a capability of another name. */
  const PANEL_CAP = { print: 'printer' };
  /* Panels that leave the game running (the printer's paper comes while it is open). */
  const NO_HOLD = new Set(['print']);

  /* ------------------------------------------------------------------ styles
     The bar's look is the Game & Watch pill's (index.html #play-toolbar-pill and
     .play-pbtn), value for value; a framed page shares no stylesheet with the
     site, so the values are carried here.

     COLOUR TOKENS (2026-10-14, themes step 0):
     every colour is var(--cw-bar-<name>, <today's value>), so with nothing set the bar is
     exactly as before. The site sets the accent family on its :root (index.html: the bar
     follows Settings > Appearance > Accent, in its dark-ground variant, since the bar is
     always a dark surface over the game, in light mode too). A framed page has no site
     stylesheet: syncTokens() copies every --cw-bar-* value the site's root resolves to
     into the frame's root, and again when the site's accent or theme changes. Names:
       surfaces  pill menu toast panel-from panel-to field well card slot-act last shot
       ink       ink btn-ink dim faint muted-ink err-ink rec
       lines     line line-2 kbd-line err-line
       accent    accent accent-rgb accent-edge accent-ink accent-pale accent-soft accent-deep
       status    warn warn-rgb
     Neutral white and black overlays (hover washes, shadows) stay literal: they are relative
     to whatever surface they sit on. */
  const TOKENS = ['pill', 'menu', 'toast', 'panel-from', 'panel-to', 'field', 'well', 'card', 'slot-act', 'last', 'shot',
    'ink', 'btn-ink', 'dim', 'faint', 'muted-ink', 'err-ink', 'rec', 'line', 'line-2', 'kbd-line', 'err-line',
    'accent', 'accent-rgb', 'accent-edge', 'accent-ink', 'accent-pale', 'accent-soft', 'accent-deep', 'warn', 'warn-rgb',
    'host-stage', 'host-bezel', 'host-speed-ink', 'host-rewind-ink', 'host-warn-deep', 'host-line-on'];
  let tokenObs = null;
  function syncTokens() {
    let src = null;
    try { if (window.parent !== window && window.parent.document) src = window.parent.document.documentElement; } catch (_) { src = null; }
    if (!src) return;
    const dst = document.documentElement;
    const apply = () => {
      let cs = null; try { cs = window.parent.getComputedStyle(src); } catch (_) { return; }
      for (const t of TOKENS) {
        const v = cs.getPropertyValue('--cw-bar-' + t).trim();
        if (v) dst.style.setProperty('--cw-bar-' + t, v); else dst.style.removeProperty('--cw-bar-' + t);
      }
    };
    apply();
    if (!tokenObs && typeof MutationObserver === 'function') {
      // This window's own observer on the site's root; let go when this page goes.
      try { tokenObs = new MutationObserver(apply); tokenObs.observe(src, { attributes: true, attributeFilter: ['data-accent', 'data-theme', 'style', 'class'] }); } catch (_) { tokenObs = null; }
      if (tokenObs) addEventListener('pagehide', () => { try { tokenObs.disconnect(); } catch (_) {} tokenObs = null; });
    }
  }
  const CSS = `
  .cb-bar{position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:90;display:flex;justify-content:center;box-sizing:border-box;
    max-width:calc(100% - 20px);overflow:hidden;background:var(--cw-bar-pill,rgba(16,18,22,.72));border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:4px 6px;
    backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);box-shadow:0 8px 24px -12px rgba(0,0,0,.7);
    font:12px/1.2 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  .cb-bar .pill-controls{align-items:center}
  /* Two rows (2026-10-29): the playing row, then Keys, Help, Log and Settings under it. */
  .cb-bar:not(.sub-open){border-radius:20px}
  .cb-bar .pill-controls{flex-direction:column;gap:2px}
  .cb-bar .cb-row{display:flex;align-items:center;justify-content:center;gap:4px;flex-wrap:nowrap}
  .cb-bar .cb-row2{border-top:1px solid rgba(255,255,255,.10);padding-top:2px;align-self:stretch}
  body.cb-tv .cb-bar .cb-row{gap:2px}
  .cb-btn{display:inline-flex;align-items:center;gap:5px;margin:0;white-space:nowrap;background:transparent;border:0;border-radius:999px;cursor:pointer;
    color:var(--cw-bar-btn-ink,#d7dce6);font:inherit;font-size:12px;font-weight:600;line-height:1;padding:6px 11px;-webkit-tap-highlight-color:transparent}
  .cb-btn:hover,.cb-btn:focus-visible{background:rgba(255,255,255,.10);outline:none}
  .cb-btn:focus-visible{box-shadow:0 0 0 2px rgba(var(--cw-bar-accent-rgb,155,225,93),.55)}
  .cb-bar .cb-btn:focus-visible,.cb-menu button:focus-visible{outline:3px solid var(--cw-bar-accent,#9be15d);outline-offset:1px;background:rgba(var(--cw-bar-accent-rgb,155,225,93),.16)}
  .cb-btn:active,.cb-btn.active{background:rgba(var(--cw-bar-accent-rgb,155,225,93),.20);color:var(--cw-bar-accent-pale,#eaffd6)}
  .cb-btn svg{display:block;flex:0 0 auto}
  .cb-btn.muted{color:var(--cw-bar-muted-ink,#f0b7af)}
  .cb-btn.dev-off{color:var(--cw-bar-muted-ink,#f0b7af)}
  .cb-btn .cb-ico{position:relative}
  /* Off: the icon itself in the muted red, with no cross over it (2026-10-17: "Just remove the
     red cross ... but keep the red"). The colour alone says off, as the red Mute icon does. */
  .cb-btn.dev-paused .cb-ico::after{content:"";position:absolute;right:-5px;bottom:-3px;width:7px;height:7px;border-left:2px solid currentColor;border-right:2px solid currentColor;box-sizing:border-box}
  .cb-btn .cb-chev{opacity:.7;margin-left:-1px}
  .cb-sep{width:1px;align-self:stretch;margin:4px 2px;background:rgba(255,255,255,.14);flex:0 0 auto}
  .cb-sep[hidden]{display:none}
  .cb-bar .pill-back{gap:6px}
  /* The Print window's bar: Back / Save / Print (2026-10-21). */
  .cb-bar .pill-extra{display:none;gap:2px;align-items:center}
  .cb-bar.sub-open.cb-print-open .pill-extra{display:inline-flex}
  .cb-bar .pill-extra .cb-lbl{display:inline !important}
  .cb-bar .cb-exit{display:none}
  body.cb-full .cb-bar .cb-exit{display:inline-flex}
  body.cb-full .cb-bar [data-cb="full"]{display:none}
  /* A6: narrow screens show icons only. NO BUTTON IS HIDDEN FOR LACK OF ROOM (2026-10-30: "We can
     show and remove the text for buttons, but we can't just hide them"): Fast forward, Screenshot,
     Cheats and the console's keys used to go behind More on a phone. Now the labels come off first,
     then the rows wrap onto more lines (.cb-wrap); More is never drawn. */
  .cb-bar.cb-narrow .cb-lbl,.cb-bar.cb-narrow .cb-chev{display:none}
  .cb-bar.cb-narrow .cb-btn{padding:6px 8px}
  .cb-bar.cb-narrow .pill-back .cb-lbl{display:inline}
  .cb-bar [data-cb="more"]{display:none}
  .cb-bar.cb-compact [data-more="1"]:not([data-cb^="ck:"]) .cb-lbl,.cb-bar.cb-compact [data-more="1"]:not([data-cb^="ck:"]) .cb-chev{display:none}
  .cb-bar.cb-compact [data-more="1"]:not([data-cb^="ck:"]){padding:6px 8px}
  .cb-bar.cb-compact2 [data-cb^="ck:"] .cb-lbl{display:none}
  /* The Console menu (the console's keys gathered in one menu) is not used since 2026-10-30: each
     key keeps its own button, so it stays on screen. */
  .cb-bar [data-cb="console"]{display:none}
  .cb-bar.cb-devicons [data-cb^="dev:"] .cb-lbl,.cb-bar.cb-devicons [data-cb="media"] .cb-lbl,.cb-bar.cb-devicons [data-cb="rotate"] .cb-lbl,.cb-bar.cb-devicons [data-cb="console"] .cb-lbl{display:none}
  .cb-bar.cb-compact2 [data-cb^="ck:"]{padding:6px 6px}   /* 2026-10-15: the Lynx's three short names were 5 px over at 980 */
  .cb-bar .cb-ck-txt{font-weight:600;font-size:12px;letter-spacing:.01em;white-space:nowrap;line-height:18px}
  .cb-bar .cb-ck-short{display:none}
  .cb-bar.cb-compact2 .cb-ck-full{display:none}
  .cb-bar.cb-compact2 .cb-ck-short{display:inline}   /* short of room: the shorter name (k.short), never a bare icon */
  .cb-bar.cb-narrow .cb-ck-full{display:none}
  .cb-bar.cb-narrow .cb-ck-short{display:inline}
  /* Last step (2026-10-30): the rows wrap. max-content keeps the bar as wide as the screen allows
     (with left:50% an auto width would wrap at half the stage), the max-width wraps it. */
  .cb-bar.cb-wrap{width:max-content}
  .cb-bar.cb-wrap .cb-row{flex-wrap:wrap;row-gap:2px}
  .cb-bar.cb-wrap .cb-sep{display:none}
  .cb-bar.cb-wrap .cb-row2 .cb-sep:not([hidden]){display:block}   /* row 2's divider after Variant and Cheats stays (31 Oct) */
  /* TV (keys.js body.gnw-tv on the host): larger targets, the bar always shown (A9). */
  body.cb-tv .cb-btn,body.cb-tv .cb-bar .pill-back{font-size:13.5px;padding:8px 10px}
  body.cb-tv .cb-bar .pill-controls{gap:2px}
  /* Menus (Variant, Speed, More): a small list under their button, closed by Back. */
  .cb-menu{position:absolute;z-index:95;min-width:180px;max-width:min(320px,calc(100% - 20px));max-height:calc(100% - 70px);overflow:auto;
    background:var(--cw-bar-menu,rgba(20,23,28,.97));border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:6px;box-shadow:0 14px 40px rgba(0,0,0,.6);
    font:13px/1.3 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--cw-bar-ink,#e6e8ec)}
  .cb-menu[hidden]{display:none}
  .cb-menu button{display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:transparent;border:0;border-radius:8px;padding:8px 10px;
    color:inherit;font:inherit;cursor:pointer}
  .cb-menu button:hover,.cb-menu button:focus-visible{background:rgba(255,255,255,.09);outline:none}
  .cb-menu button:focus-visible{box-shadow:inset 0 0 0 2px rgba(var(--cw-bar-accent-rgb,155,225,93),.55)}
  .cb-menu .tick{width:14px;flex:0 0 14px;color:var(--cw-bar-accent,#9be15d)}
  .cb-menu .own{margin-left:auto;font-size:11px;color:var(--cw-bar-dim,#9aa1ad)}
  .cb-menu .cb-mh{padding:6px 10px 4px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--cw-bar-dim,#9aa1ad)}
  .cb-menu .cb-ch{display:flex;flex-direction:column;align-items:flex-start;text-align:left;min-width:0}
  .cb-menu .cb-ch small{font-size:11px;color:var(--cw-bar-dim,#9aa1ad);overflow-wrap:anywhere}
  .cb-menu .cb-ch-credit{text-transform:none;letter-spacing:0;max-width:30em;line-height:1.35}
  .cb-menu .cb-ch-credit a{color:inherit;text-decoration:underline}
  .cb-menu .cb-msep{height:1px;margin:4px 6px;background:rgba(255,255,255,.12)}
  /* A cheat that is on is green (9 Nov 2026), the site's on colour (the accent, green by default): the row
     tinted, its tick, and "on" as a filled tag in dark ink. The bar is a dark surface in every theme. */
  .cb-menu button.cb-ch-on{background:rgba(var(--cw-bar-accent-rgb,155,225,93),.16)}
  .cb-menu button.cb-ch-on:hover,.cb-menu button.cb-ch-on:focus-visible{background:rgba(var(--cw-bar-accent-rgb,155,225,93),.28)}
  .cb-menu button.cb-ch-on .own{color:#0a0e14;background:var(--cw-bar-accent,#9be15d);font-weight:700;border-radius:999px;padding:2px 8px}
  .cb-menu button.cb-up,.cb-menu button.cb-mmore{color:var(--cw-bar-accent-soft,#c9e7a9)}
  .cb-menu .cb-vr-find{position:sticky;top:0;z-index:1;display:flex;align-items:center;gap:6px;margin:0 0 6px;padding:0 4px 0 9px;box-sizing:border-box;
    background:var(--cw-bar-menu,rgb(20,23,28));border:1px solid rgba(255,255,255,.28);border-radius:8px}
  .cb-menu .cb-vr-find:focus-within{outline:3px solid var(--cw-bar-accent,#9be15d);outline-offset:-1px;border-color:var(--cw-bar-accent,#9be15d)}
  .cb-menu .cb-vr-in{flex:1 1 auto;min-width:0;margin:0;padding:7px 0;background:transparent;border:0;outline:0;box-shadow:none;color:var(--cw-bar-ink,#e6e8ec);font:inherit}
  .cb-menu .cb-vr-in::placeholder{color:var(--cw-bar-dim,#9aa1ad);opacity:1}
  .cb-menu button.cb-vr-x{flex:0 0 auto;width:28px;height:28px;padding:0;justify-content:center;color:var(--cw-bar-dim,#9aa1ad);font-size:16px;line-height:1}
  .cb-menu button.cb-vr-x[hidden]{display:none}
  .cb-menu .cb-vr-n{margin:0 0 4px;padding:0 10px;font-size:12px;color:var(--cw-bar-dim,#9aa1ad);overflow-wrap:anywhere}
  .cb-menu .cb-vr-n[hidden],.cb-menu .cb-vr-res[hidden],.cb-menu .cb-vr-main[hidden]{display:none}
  @media (pointer:coarse),(max-width:860px){.cb-menu .cb-vr-in{font-size:16px;padding:9px 0}.cb-menu button.cb-vr-x{width:36px;height:36px}}
  body.cb-tv .cb-menu .cb-vr-in{font-size:18px;padding:12px 0}
  body.cb-tv .cb-menu button.cb-vr-x{width:44px;height:44px;font-size:20px}
  body.cb-tv .cb-menu{font-size:16px}
  /* Panels: one at a time, over the play area, under the collapsed bar. */
  .cb-panel{position:absolute;inset:0;z-index:80;display:none;overflow:auto;box-sizing:border-box;padding:56px 18px 18px;
    background:linear-gradient(180deg,var(--cw-bar-panel-from,#15171b),var(--cw-bar-panel-to,#0b0c0e));color:var(--cw-bar-ink,#e6e8ec);
    font:13px/1.45 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  .cb-panel.open{display:flex;flex-direction:column;align-items:center;gap:12px}
  .cb-panel h3{margin:0;font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--cw-bar-dim,#9aa1ad);text-align:center}
  .cb-panel .cb-sub{color:var(--cw-bar-dim,#9aa1ad);font-size:12px;text-align:center}
  .cb-panel button.cb-act{background:var(--cw-bar-field,#1d2026);border:1px solid var(--cw-bar-line,#2a2e36);color:var(--cw-bar-ink,#e6e8ec);border-radius:8px;padding:6px 11px;font:inherit;font-size:12px;cursor:pointer}
  .cb-panel button.cb-act:hover,.cb-panel button.cb-act:focus-visible{border-color:var(--cw-bar-accent-edge,#9bbc0f);color:var(--cw-bar-accent-ink,#d8f08a);outline:none}
  .cb-panel button.cb-act.primary{border-color:var(--cw-bar-accent-deep,#3d4a1e);color:var(--cw-bar-accent-ink,#d8f08a)}
  /* Tabs (Keys: Keyboard, Gamepad, Window). */
  .cb-tabs{display:flex;gap:4px;padding:3px;background:var(--cw-bar-well,#101215);border:1px solid var(--cw-bar-line,#2a2e36);border-radius:999px}
  .cb-tabs button{background:transparent;border:0;border-radius:999px;color:var(--cw-bar-dim,#9aa1ad);font:inherit;font-size:12px;font-weight:600;padding:6px 14px;cursor:pointer}
  .cb-tabs button[aria-selected="true"]{background:rgba(var(--cw-bar-accent-rgb,155,225,93),.18);color:var(--cw-bar-accent-pale,#eaffd6)}
  .cb-tabs button:focus-visible{outline:none;box-shadow:0 0 0 2px rgba(var(--cw-bar-accent-rgb,155,225,93),.55)}
  .cb-tabpanel{width:min(100%,640px);display:flex;flex-direction:column;align-items:center;gap:12px}
  .cb-tabpanel[hidden]{display:none}
  .cb-table{border-collapse:collapse;width:min(100%,460px);font-size:12.5px}
  .cb-table td{padding:6px 8px;border-bottom:1px solid var(--cw-bar-line-2,#22262d)}
  .cb-table td:first-child{color:var(--cw-bar-dim,#9aa1ad)}
  .cb-table td:last-child{text-align:right}
  .cb-kbd{display:inline-block;min-width:1.6em;padding:2px 7px;border:1px solid var(--cw-bar-kbd-line,#2f343d);border-bottom-width:2px;border-radius:6px;background:var(--cw-bar-card,#15181d);color:var(--cw-bar-ink,#e6e8ec);
    font:600 11.5px ui-monospace,SFMono-Regular,Consolas,monospace;text-align:center;margin-left:3px}
  /* Saves: the table's own styles are in play/shared/save-table.js (8 Nov 2026). */
  /* Settings rows. */
  .cb-set{width:min(100%,560px);display:flex;flex-direction:column;gap:14px}
  .cb-set section{border:1px solid var(--cw-bar-line,#2a2e36);border-radius:12px;background:var(--cw-bar-card,#15181d);padding:12px 14px;display:flex;flex-direction:column;gap:10px}
  .cb-set section > h4{margin:0;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--cw-bar-dim,#9aa1ad);font-weight:600}
  .cb-set .cb-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
  .cb-set select{max-width:100%;min-width:0;text-overflow:ellipsis;font:inherit;font-size:13px;color:var(--cw-bar-ink,#e6e8ec);background:var(--cw-bar-field,#1d2026);border:1px solid var(--cw-bar-line,#2a2e36);border-radius:8px;padding:5px 9px;cursor:pointer}
  /* Toast. */
  .cb-toast{position:absolute;left:50%;bottom:calc(16px + var(--cw-ov-bottom, 0px));transform:translateX(-50%);z-index:96;background:var(--cw-bar-toast,rgba(16,18,22,.92));border:1px solid rgba(255,255,255,.16);
    border-radius:999px;color:var(--cw-bar-ink,#e6e8ec);padding:7px 14px;font:600 12.5px ui-sans-serif,system-ui,sans-serif;display:flex;gap:10px;align-items:center;
    box-shadow:0 8px 26px rgba(0,0,0,.5);max-width:calc(100% - 30px)}
  .cb-toast[hidden]{display:none}
  /* A toast never takes a press meant for the device under it (2026-10-17: a toast over a Lynx's
     lower A key ate the tap); only its own buttons answer. */
  .cb-toast{pointer-events:none}.cb-toast button{pointer-events:auto}
  .cb-toast.err{color:var(--cw-bar-err-ink,#ffc9c9);border-color:var(--cw-bar-err-line,#5a2a2a)}
  .cb-toast button{background:transparent;border:1px solid rgba(255,255,255,.25);border-radius:999px;color:var(--cw-bar-accent-ink,#d8f08a);font:inherit;padding:3px 10px;cursor:pointer}
  .cb-toast button:focus-visible{outline:3px solid var(--cw-bar-accent,#9be15d);outline-offset:2px;background:rgba(var(--cw-bar-accent-rgb,155,225,93),.16)}
  @media (prefers-reduced-motion: no-preference){.cb-panel.open{animation:cbFade .22s ease}}
  @keyframes cbFade{from{opacity:.2}to{opacity:1}}
  `;
  function ensureCss() {
    syncTokens();
    if (document.getElementById('cb-css')) return;
    const st = document.createElement('style'); st.id = 'cb-css'; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ------------------------------------------------------------------ state */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let C = null;                   // the registered core
  let caps = {};
  let bar = null, back = null, panels = {}, menus = {}, toastEl = null;
  let panel = null;               // the open panel id
  let menu = null;                // the open menu id
  let opener = null;              // the button that opened the panel or menu (focus returns there)
  let full = false;
  let slot = null;                // the selected save for Ctrl+S / Ctrl+L: a save's index, 'new', 'auto:last' or null
  let variants = null;            // { list: [{id, label, current, default}] } from the host
  let devOpen = null;             // the peripheral whose menu is open ('camera', 'tilt')
  let undo = null;                // { i, rec, t }

  const $b = id => bar && bar.querySelector('[data-cb="' + id + '"]');
  const visible = el => !!el && el.getClientRects().length > 0;

  /* ------------------------------------------------------------------ build */
  function btnHtml(it) {
    const chev = it.menu ? `<span class="cb-chev">${ICON.chev}</span>` : '';
    const title = (it.title || it.label) + (it.key ? ' (' + it.key + ')' : '');
    return `<button type="button" class="cb-btn" data-cb="${it.id}"${it.more ? ' data-more="1"' : ''}${it.menu ? ' aria-haspopup="menu" aria-expanded="false"' : ''}` +
      `${it.panel ? ' aria-expanded="false"' : ''} title="${esc(title)}" aria-label="${esc(it.label)}">` +
      (it.iconOnly ? `<span class="cb-ico">${ICON[it.icon]}</span>` : it.text ? `<span class="cb-ck-txt"><span class="cb-ck-full">${esc(it.text)}</span><span class="cb-ck-short">${esc(it.short || it.text)}</span></span>` : `<span class="cb-ico">${ICON[it.icon]}</span><span class="cb-lbl">${esc(it.label)}</span>`) + `${chev}</button>`;
  }
  function shown(it) {
    if (it.id === 'console') return Array.isArray(caps.consoleKeys) && caps.consoleKeys.length > 0;
    if (it.id === 'cheats') return !!caps.cheats && cheatN() > 0;
    return !it.hidden && !!caps[it.cap];
  }
  const cheatN = () => { try { return C && C.cheats ? C.cheats.count() | 0 : 0; } catch (_) { return 0; } };
  /* The console's own keys (caps.consoleKeys), as items: 'ck:<id>'. On a narrow bar
     they go behind More, since the bottom strip (overlay.js) carries them there too. */
  function consoleItems() {
    const list = Array.isArray(caps.consoleKeys) ? caps.consoleKeys : [];
    /* A key with no picture of its own (the generic 'keys' icon) shows its name as text, at
       every bar width: Game A, Game B, Time and Alarm side by side were identical icons
       (decided 2026-10-14). k.short, if given, is the shorter name. */
    return list.filter(k => k && k.id).map(k => {
      const icon = ICON[k.icon] ? k.icon : 'keys', label = k.label || k.id;
      // A key with a picture of its own (Power, Shake) is that picture alone, its name in the
      // tooltip and accessible name, so the bar fits beside the Game Boy's unchanged (2026-10-15).
      return { id: 'ck:' + k.id, ck: k.id, group: 'console', icon, label, text: icon === 'keys' ? label : null, iconOnly: icon !== 'keys', short: k.short || null, key: k.key, more: true, hold: true };
    });
  }

  /* A cartridge's peripherals (caps.devices): an item each, with its menu. Not behind More:
     a camera or a tilt sensor is how the game is played. */
  function deviceItems() {
    const list = Array.isArray(caps.devices) ? caps.devices : [];
    return list.filter(d => d && d.id).map(d => ({ id: 'dev:' + d.id, dev: d.id, group: 'console', icon: ICON[d.icon] ? d.icon : 'keys', label: d.label || d.id, menu: true }));
  }

  function build() {
    ensureCss();
    if (window.PlayPill) window.PlayPill.ensureCss();
    const stage = C.stage;
    bar = document.createElement('div');
    bar.className = 'cb-bar play-pill';
    bar.id = 'cb-bar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Control Bar');
    // Two rows (2026-10-29): row 1 the play, state and console groups; row 2 the window's own.
    const rowHtml = groups => {
      let h = '', first = true;
      for (const g of groups) {
        const its = ITEMS.filter(it => it.group === g && (shown(it) || (it.id === 'cheats' && caps.cheats))).concat(g === 'console' ? deviceItems().concat(consoleItems()) : []);
        if (!its.length) continue;
        const allMore = its.every(it => it.more);
        if (!first) h += `<span class="cb-sep${allMore ? ' cb-sep-more' : ''}" aria-hidden="true"></span>`;
        first = false;
        h += its.map(btnHtml).join('');
      }
      return h;
    };
    let html = `<button type="button" class="cb-btn cb-exit" data-cb="exit" title="Leave full screen (Back)" aria-label="Back: leave full screen">${ICON.back}<span class="cb-lbl">Back</span></button>`;
    html += rowHtml(['play', 'state', 'console']);
    if (ITEMS.some(it => it.more && shown(it)) || consoleItems().some(it => it.more)) html += `<button type="button" class="cb-btn" data-cb="more" aria-haspopup="menu" aria-expanded="false" title="More" aria-label="More">${ICON.more}</button>`;
    const row2 = rowHtml(['pick', 'window']);
    bar.innerHTML = `<div class="pill-controls"><div class="cb-row cb-row1">${html}</div>${row2 ? `<div class="cb-row cb-row2">${row2}</div>` : ''}</div>` +
      `<button type="button" class="pill-back" id="cb-back" aria-label="Back to game">${ICON.back}<span class="cb-lbl" data-pill-title>Back</span></button>` +
      (caps.printer ? `<span class="pill-extra"><button type="button" class="cb-btn" data-cbx="save" title="Save the paper as a picture" aria-label="Save the paper as a picture">${ICON.download}<span class="cb-lbl">Save</span></button>` +
        `<button type="button" class="cb-btn" data-cbx="print" title="Print the paper" aria-label="Print the paper">${ICON.printer}<span class="cb-lbl">Print</span></button>` +
        `<button type="button" class="cb-btn cb-scale" data-cbx="scale" aria-haspopup="listbox" aria-expanded="false" title="Size for Save and Print" aria-label="Size for Save and Print: ${prnScale}x"><span class="cb-lbl" data-scale-lbl>${prnScale}x</span><span class="cb-chev">${ICON.chev}</span></button>` +
        `<button type="button" class="cb-btn" data-cbx="discard" title="Throw the paper away" aria-label="Throw the paper away">${ICON.trash}<span class="cb-lbl">Throw away</span></button></span>` : '');
    stage.appendChild(bar);
    back = bar.querySelector('#cb-back');

    // Panels.
    for (const id of ['saves', 'keys', 'settings', 'print']) {
      if (!caps[PANEL_CAP[id] || id]) continue;
      const p = document.createElement('div');
      p.className = 'cb-panel'; p.id = 'cb-panel-' + id;
      p.setAttribute('role', 'region'); p.setAttribute('aria-label', PANEL_TITLE[id]);
      stage.appendChild(p);
      panels[id] = p;
    }
    if (panels.keys) buildKeys();
    if (panels.settings) buildSettings();
    if (panels.print) { try { const el = C.printer && C.printer.content(); if (el) panels.print.appendChild(el); } catch (_) {} }
    paintKeybind();
    // Menus.
    for (const id of ['variant', 'cheats', 'speed', 'media', 'device', 'console', 'more']) {
      const m = document.createElement('div');
      m.className = 'cb-menu'; m.id = 'cb-menu-' + id; m.hidden = true;
      m.setAttribute('role', 'menu');
      stage.appendChild(m);
      menus[id] = m;
    }
    toastEl = document.createElement('div');
    toastEl.className = 'cb-toast'; toastEl.hidden = true; toastEl.setAttribute('role', 'status');
    stage.appendChild(toastEl);

    bar.addEventListener('click', onBarClick);
    bar.addEventListener('pointerdown', onBarDown);
    // A console key is held while the pointer is down, like the button it stands for.
    if (consoleItems().length) {
      const up = () => ckUpAll();
      bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up); bar.addEventListener('pointerleave', up);
      addEventListener('pointerup', up); addEventListener('pointercancel', up); addEventListener('blur', up);
    }
    if (caps.rewind) {
      const r = $b('rewind');
      const stop = () => { try { C.rewind.stop(); } catch (_) {} };
      r.addEventListener('pointerup', stop); r.addEventListener('pointerleave', stop); r.addEventListener('pointercancel', stop);
      addEventListener('pointerup', stop); addEventListener('pointercancel', stop);
    }
    /* HOLD ITEMS BY KEY AND PAD (2026-10-17: "I tried rewinding with the controller on a Game
       Boy game and it asks me to hold rewind as a tip ... Works with my finger but not pressing the A
       button"). Rewind and the console keys are held while Enter or Space is held on them, as a
       finger holds them; the host sends a pad's A on a focused item as that Enter, down and up.
       Only a short press (under 300 ms) of Rewind still shows the tip. The key's own click is
       stopped, so the item does not also tap. */
    addEventListener('keyup', e => { if (keyHold && holdKeyOf(e)) holdKeyUp(e); }, true);
    addEventListener('blur', () => holdKeyUp(null));
    for (const m of Object.values(menus)) m.addEventListener('click', onMenuClick);
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(stage); else addEventListener('resize', fit);
    fit();
    sync();
    /* And on the first real layout, and once the fonts are in (31 Oct): a label measured in the
       fallback font is narrower or wider than in the real one, and nothing resizes when it swaps. */
    requestAnimationFrame(() => requestAnimationFrame(fit));
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fit()); } catch (_) {}
    if (document.readyState !== 'complete') addEventListener('load', () => fit(), { once: true });
  }

  function stepSelect(sel, dir) {
    const opts = Array.from(sel.options);
    for (let i = sel.selectedIndex + dir; i >= 0 && i < opts.length; i += dir) {
      if (opts[i].disabled || opts[i].dataset.padSkip) continue;
      sel.selectedIndex = i;
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  }

  /* A6: icons only, and More, when the full bar does not fit. Measured, not a
     breakpoint guess: the labels come off when the bar would be wider than the
     stage allows. */
  /* The width the controls need: the wider of the two rows (2026-10-29), each measured on its own
     (a row centred in the column hangs over both sides, which the column's scrollWidth half misses). */
  function ctlW(ctl) {
    const rows = ctl.querySelectorAll(':scope > .cb-row');
    if (!rows.length) return ctl.scrollWidth;
    let w = 0; for (const r of rows) w = Math.max(w, r.scrollWidth);
    return w;
  }
  function fit() {
    if (!bar) return;
    const avail = C.stage.clientWidth - 20;
    bar.classList.remove('cb-narrow', 'cb-compact', 'cb-compact2', 'cb-ckmenu', 'cb-devicons', 'cb-wrap');
    const ctl = bar.querySelector('.pill-controls');
    const fits = () => !ctl || ctlW(ctl) + 14 <= avail;
    /* (The first step used to gather the console's keys into one Console menu, 2026-10-15. Gone
       2026-10-30: a key in a menu is not on screen. Each keeps its button, shortened or wrapped.) */
    // First: the console's own items (its peripherals, the disk, Rotate) as icons,
    // still before any core item loses its label.
    if (avail > 0 && !fits() && C.stage.clientWidth >= 560) bar.classList.add('cb-devicons');
    const need = ctl ? ctlW(ctl) + 14 : 0;
    let narrow = (avail > 0 && need > avail) || C.stage.clientWidth < 560;
    /* Between the two (2026-10-11, the Pokemon mini's longer bar): on a normal screen
       that is a little short, the less-used items (those More would hold) show their
       icons only and every item stays in the bar; labels stay on the rest, the console's
       own keys included (a bare icon cannot say "Game Reset" from "Reset"). */
    if (narrow && C.stage.clientWidth >= 560 && avail > 0) {
      bar.classList.add('cb-compact');
      if (ctlW(ctl) + 14 <= avail) narrow = false;
      else {
        // Still short: the console's keys go to icons too (their names stay in the tooltip and the Keys panel).
        bar.classList.add('cb-compact2');
        if (ctlW(ctl) + 14 <= avail) narrow = false; else bar.classList.remove('cb-compact', 'cb-compact2');
      }
    }
    bar.classList.toggle('cb-narrow', narrow);
    if (menu === 'more') closeMenu(false);
    /* Still too wide with icons only (a phone, either way up): the rows wrap onto more lines,
       so every button stays on screen (2026-10-30). Never More. */
    if (avail > 0 && !fits()) bar.classList.add('cb-wrap');
  }

  /* ------------------------------------------------------------------ sync */
  function sync() {
    if (!bar) return;
    const p = $b('pause');
    if (p) {
      const on = !!C.paused();
      p.querySelector('.cb-ico').innerHTML = on ? ICON.play : ICON.pause;
      p.querySelector('.cb-lbl').textContent = on ? 'Resume' : 'Pause';
      p.classList.toggle('active', on);
      p.setAttribute('aria-pressed', on ? 'true' : 'false');
      p.title = (on ? 'Resume' : 'Pause') + ' (Ctrl+P)';
      p.setAttribute('aria-label', on ? 'Resume' : 'Pause');
    }
    const m = $b('mute');
    if (m) {
      const on = !!C.muted();
      m.querySelector('.cb-ico').innerHTML = on ? ICON.soundOff : ICON.soundOn;
      m.querySelector('.cb-lbl').textContent = on ? 'Unmute' : 'Mute';
      m.classList.toggle('muted', on);
      m.setAttribute('aria-pressed', on ? 'true' : 'false');
      m.title = (on ? 'Unmute' : 'Mute') + ' (Ctrl+M)';
    }
    const r = $b('rewind');
    if (r && C.rewind) r.classList.toggle('active', !!(C.rewind.active && C.rewind.active()));
    /* A device's label changes its width ("No tape" to "Tape: page 1 of 39, playing", a recording
       clock): the bar is fitted again when one changed, or an item could hang past its edge
       (2026-10-19: measured, a Study Box with a tape in put Pause and Settings partly outside it). */
    let relabelled = false;
    for (const d of (Array.isArray(caps.devices) ? caps.devices : [])) {
      const el = $b('dev:' + d.id); let l = null, st = null;
      try { const dv = C.device ? C.device(d.id) : null; l = dv ? dv.label() : null; st = dv && dv.state ? dv.state() : null; } catch (_) { l = null; }
      if (!el) continue;
      if (l) { const t = el.querySelector('.cb-lbl'); if (t && t.textContent !== l) { t.textContent = l; relabelled = true; } el.title = l; el.setAttribute('aria-label', l); }
      el.classList.toggle('dev-off', st === 'off');
      el.classList.toggle('dev-paused', st === 'paused');
    }
    /* Swap A/B: lit while on. Hidden where it could do nothing: a console with no such pair (every
       face button is the one Action or Fire), or a touch screen with no controller and no keyboard,
       the same rule as "Change keys and buttons..." below. */
    const sw = $b('swap');
    if (sw) {
      const on = swapOn();
      sw.style.display = swapDoes() && (kbWanted() || swapSeen()) ? '' : 'none';
      sw.classList.toggle('active', on);
      sw.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    const pr = $b('print');
    if (pr) {
      let v = false; try { v = !!(C.printer && C.printer.visible()); } catch (_) {}
      if ((pr.style.display !== 'none') !== v) { pr.style.display = v ? '' : 'none'; relabelled = true; }
    }
    const md = $b('media');
    if (md && C.media) {
      const l = C.media.label() || 'Media';
      if (md.querySelector('.cb-lbl').textContent !== l) relabelled = true;
      md.querySelector('.cb-lbl').textContent = l;
      md.title = l + ' (change disk side)';
    }
    const sp = $b('speed');
    if (sp && C.speed) {
      const x = +C.speed() || 1;
      sp.querySelector('.cb-lbl').textContent = x === 1 ? 'Turbo' : speedLabel(x);
      sp.classList.toggle('active', x !== 1);
      sp.title = 'Turbo: ' + speedLabel(x);
    }
    const v = $b('variant');
    if (v) {
      const cur = variants && variants.list && variants.list.find(x => x.current);
      const n = variants && variants.list ? variants.list.length : 0;
      v.style.display = n >= 2 ? '' : 'none';
      v.querySelector('.cb-lbl').textContent = cur ? cur.label || 'Variant' : 'Variant';
      v.title = 'Variant: ' + (cur ? cur.label : '') + ' (choose another version of this game)';
    }
    const ch = $b('cheats');
    if (ch) {
      const n = cheatN(), on = n && C.cheats.onCount ? C.cheats.onCount() | 0 : 0;
      ch.style.display = n > 0 ? '' : 'none';
      ch.querySelector('.cb-lbl').textContent = on ? `Cheats (${on} on)` : 'Cheats';
      ch.classList.toggle('active', on > 0);
      ch.title = on ? `Cheats: ${on} on` : 'Cheats';
    }
    for (const id of Object.keys(panels)) { const b = $b(id); if (b) { b.classList.toggle('active', panel === id); b.setAttribute('aria-expanded', panel === id ? 'true' : 'false'); } }
    /* A divider with nothing shown after it in its group (a single Variant, no cheats) is not drawn:
       it hung at the end of the first row (2026-10-29). Nor one with nothing shown before it on its
       row (31 Oct: row 2 starts with Variant and Cheats, which show only when the game has them). */
    const showing = n => n.dataset && n.dataset.cb && n.dataset.cb !== 'more' && n.dataset.cb !== 'exit' && n.dataset.cb !== 'console' && n.style.display !== 'none';
    for (const s of bar.querySelectorAll('.cb-sep')) {
      let any = false, before = false;
      for (let n = s.nextElementSibling; n && !n.classList.contains('cb-sep'); n = n.nextElementSibling) if (showing(n)) { any = true; break; }
      for (let n = s.previousElementSibling; n; n = n.previousElementSibling) if (!n.classList.contains('cb-sep') && showing(n)) { before = true; break; }
      if (s.hidden !== !(any && before)) { s.hidden = !(any && before); relabelled = true; }
    }
    /* FITTED AGAIN WHEN THE BAR'S CONTENTS CHANGE (31 Oct: "My phone opens an NES game in landscape
       and the Control Bar buttons overflow the bar. If I rotate to portrait and back to landscape
       it's fixed"). The game's versions and cheats arrive a moment after the bar is first fitted:
       Variant then shows with its version's name ("USA · PRG1 · [!]") and Cheats appears, and the
       bar grew past the room it had been fitted to. Only a resize fitted it again, so turning the
       phone fixed it. Now any change in what the bar shows, or in its labels, fits it again. */
    const sig = Array.from(bar.querySelectorAll('.pill-controls [data-cb]')).map(n => n.style.display === 'none' ? '-' : (n.querySelector('.cb-lbl') || n).textContent).join('|');
    if (sig !== lastSig) { lastSig = sig; relabelled = true; }
    if (relabelled) fit();
  }
  let lastSig = '';

  /* ------------------------------------------------------------------ clicks */
  function onBarDown(e) {
    const b = e.target.closest('[data-cb]');
    if (!b) return;
    if (b.dataset.cb === 'rewind') { e.preventDefault(); try { C.rewind.start(); } catch (_) {} sync(); }
    if (b.dataset.cb.indexOf('ck:') === 0) { e.preventDefault(); ckDown(b.dataset.cb.slice(3), b); }
  }
  /* Hold items by key and pad (see the bar's setup): the window's keydown handler below calls
     holdKeyDown before anything else sees an Enter or Space on Rewind or a console key. */
  const holdItem = b => b && b.closest && b.closest('[data-cb="rewind"], [data-cb^="ck:"]');
  const holdKeyOf = e => e.key === 'Enter' || e.key === ' ' || e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter';
  let keyHold = null;
  function holdKeyDown(e, b) {
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat || keyHold) return;
    keyHold = { b, at: performance.now() };
    if (b.dataset.cb === 'rewind') { try { C.rewind.start(); } catch (_) {} sync(); }
    else ckDown(b.dataset.cb.slice(3), b);
  }
  function holdKeyUp(e) {
    if (!keyHold) return;
    if (e && e.preventDefault) { e.preventDefault(); e.stopImmediatePropagation(); }
    const h = keyHold; keyHold = null;
    if (h.b.dataset.cb === 'rewind') { try { C.rewind.stop(); } catch (_) {} sync(); if (performance.now() - h.at < 300) toast('Hold Rewind, or hold Ctrl+←'); }
    else ckUp(h.b.dataset.cb.slice(3));
  }
  /* Console keys: held from pointerdown to pointerup; a click with no pointer (Enter,
     Space, a remote, More's menu) taps it for long enough that the game's next poll sees it. */
  const ckHeld = new Map();       // id -> the button lit for it
  function ckDown(id, b) {
    if (ckHeld.has(id)) return;
    ckHeld.set(id, b || null);
    if (b) b.classList.add('active');
    try { C.consoleKey && C.consoleKey(id, true); } catch (_) {}
  }
  function ckUp(id) {
    if (!ckHeld.has(id)) return;
    const b = ckHeld.get(id); ckHeld.delete(id);
    if (b) b.classList.remove('active');
    try { C.consoleKey && C.consoleKey(id, false); } catch (_) {}
  }
  function ckUpAll() { for (const id of Array.from(ckHeld.keys())) ckUp(id); }
  function ckTap(id, b) { ckDown(id, b); setTimeout(() => ckUp(id), 180); }
  function onBarClick(e) {
    if (e.target.closest('#cb-back')) { closePanel(true); return; }      // Back keeps the paper
    { const x = e.target.closest('[data-cbx]'); if (x) { if (x.dataset.cbx === 'scale') scaleToggle(x); else if (x.dataset.cbx === 'discard') { printDiscard(); closePanel(true); toast('Paper thrown away'); } else printAct(x.dataset.cbx); return; } }
    const b = e.target.closest('[data-cb]');
    if (!b) return;
    const kbd = e.detail === 0;                 // Enter / Space / a remote, not a pointer
    act(b.dataset.cb, b, kbd);
    // A pointer press hands the keyboard straight back to the game: arrow keys
    // must steer the game, not the bar. A keyboard press keeps its place.
    if (!kbd && !panel && !menu) focusGame();
  }
  function act(id, b, kbd) {
    switch (id) {
      case 'pause': C.pause(!C.paused()); sync(); break;
      case 'reset': try { C.reset(); toast('Reset'); } catch (err) { toast('Could not reset: ' + err.message, true); } break;
      case 'rewind': if (kbd) toast('Hold Rewind, or hold Ctrl+←'); break;
      case 'saves': case 'keys': case 'settings': case 'print': togglePanel(id, b || $b(id)); break;
      case 'cheats': toggleMenu('cheats', b || $b('cheats')); break;
      case 'help': help(); break;
      case 'variant': toggleMenu('variant', b); break;
      case 'speed': toggleMenu('speed', b); break;
      case 'media': toggleMenu('media', b); break;
      case 'console': toggleMenu('console', b); break;
      case 'more': toggleMenu('more', b); break;
      case 'shot': screenshot(); break;
      case 'rotate': try { C.rotate && C.rotate(); } catch (_) {} break;
      case 'mute': C.setMuted(!C.muted()); sync(); break;
      case 'swap': swapToggle(); break;
      case 'full': setFull(true); break;
      case 'status': try { C.statusLog && C.statusLog(); } catch (_) {} break;
      case 'exit': setFull(false); break;
      default:
        if (id && id.indexOf('dev:') === 0) { devOpen = id.slice(4); toggleMenu('device', b); break; }
        if (id && id.indexOf('ck:') === 0 && kbd) ckTap(id.slice(3), b);
    }
  }

  function help() {
    try { if (C.help) { C.help(); return; } } catch (_) {}
    try { if (window.gnwPlayKeys && window.gnwPlayKeys.help) { window.gnwPlayKeys.help(); return; } } catch (_) {}
    toast('Help: press ? at any time');
  }
  /* How an item was pressed, for the host (2026-10-11): a click with no pointer behind it
     (Enter, Space, a remote, a pad's A, which presses the focused control) is 'key'; any
     other is 'pointer'. The host keeps the focus ring for 'key' and drops it for 'pointer'. */
  function viaOf(e) { return e && e.detail === 0 ? 'key' : 'pointer'; }
  function focusGame() {
    if (C && C.focusGame) { try { const a = document.activeElement; if (a && bar && bar.contains(a) && a.blur) a.blur(); C.focusGame(); return; } catch (_) {} }
    try { const a = document.activeElement; if (a && a !== document.body && a.blur) a.blur(); } catch (_) {}
    try { window.focus(); } catch (_) {}
  }

  /* ------------------------------------------------------------------ panels */
  function togglePanel(id, from) { if (panel === id) closePanel(true); else openPanel(id, from); }
  function openPanel(id, from) {
    if (!panels[id]) return;
    closeMenu(false);
    const was = panel;
    if (was) { panels[was].classList.remove('open'); }
    else { opener = from || $b(id); overlayCall('release'); }
    /* The game is held while a panel is open, except the Print window's (NO_HOLD). */
    const heldBefore = !!was && !NO_HOLD.has(was), holdNow = !NO_HOLD.has(id);
    if (heldBefore !== holdNow) { try { C.hold && C.hold(holdNow); } catch (_) {} }
    bar.classList.toggle('cb-print-open', id === 'print');
    panel = id;
    if (id === 'saves') renderSaves();
    if (id === 'settings') refreshSettings();
    paintKeybind();
    panels[id].classList.add('open');
    morph(true, PANEL_TITLE[id]);
    if (id === 'print') { try { C.printer.layout && C.printer.layout(); } catch (_) {} }
    sync();
    setTimeout(() => { try { back.focus({ preventScroll: true }); } catch (_) {} }, 0);
  }
  function closePanel(restoreFocus) {
    if (!panel) return false;
    const was = panel;
    panels[panel].classList.remove('open');
    panel = null;
    scaleClose(false);
    bar.classList.remove('cb-print-open');
    morph(false);
    if (!NO_HOLD.has(was)) { try { C.hold && C.hold(false); } catch (_) {} }
    sync();
    const o = opener; opener = null;
    if (restoreFocus && o && visible(o)) { try { o.focus({ preventScroll: true }); } catch (_) {} } else focusGame();
    return true;
  }
  function morph(collapsed, title) {
    if (window.PlayPill) window.PlayPill.morph(bar, collapsed, { title: title || 'Back' });
    else { bar.classList.toggle('sub-open', collapsed); const t = bar.querySelector('[data-pill-title]'); if (t && title) t.textContent = title; }
  }

  /* ------------------------------------------------------------------ menus */
  /* THE VARIANT MENU (2026-10-13). Releases at the top level; translations, hacks
     and other copies (bad or overdumped dumps, a release's trainer/fixed copies)
     each behind one row with its count. The host (host-bridge.js variantsFor)
     sends the list in that order with `cls` r / t / h / o; the rule itself is
     variants.js classOf. A submenu shows VR_PAGE at a time, then "Show more", so a
     1,000-entry list stays light. Back in a submenu steps up to the releases. It
     closes, the version unchanged, on a tap outside (here, or on the site around
     the frame: the host's 'closeMenu'), Escape or Back (backStep), the phone's
     back gesture (keys.js historyBack) and the Variant button pressed again.
     A LIST OF MORE THAN 20 VERSIONS HAS A FILTER BOX (7 Nov 2026), the drawer's box (variants.js) with
     the same states: at rest it is readonly with no on-screen keyboard, so a remote or pad passes
     through it; A, Enter or a tap starts typing. Enter or Back while typing ends it and keeps the words;
     Down goes to the first row. At rest Back empties it, and an empty box lets Back close the menu.
     Back on a filtered row returns to the box. Nothing typed reaches the game. */
  const VR_PAGE = 50;
  const VR_FIND_OVER = 20;
  const VR_SUBS = [['t', 'Translations'], ['h', 'Hacks'], ['o', 'Other copies']];
  let vrLevel = null, vrShown = 0;
  let vrHits = [], vrHitsShown = 0, vrHay = null, vrHayOf = null, vrRefocus = false;
  /* The same folding as variants.js: case, accents; punctuation may also be left out. */
  const vrFold = s => String(s == null ? '' : s).normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase()
    .replace(/[\u00df\u00e6\u00f8\u0111\u0142]/g, c => ({ '\u00df': 'ss', '\u00e6': 'ae', '\u00f8': 'o', '\u0111': 'd', '\u0142': 'l' }[c]));
  const vrLoose = s => s.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const vrFmt = n => Number(n).toLocaleString('en-AU');
  function vrList(c) { return (variants && variants.list || []).filter(x => (x.cls || 'r') === c); }
  const vrItem = x => `<button type="button" role="menuitemradio" aria-checked="${!!x.current}" data-vr="${esc(x.id)}"><span class="tick">${x.current ? '✓' : ''}</span><span>${esc(x.label)}</span>${x.default ? '<span class="own">default</span>' : ''}</button>`;
  function paintVariant() {
    const m = menus.variant, item = vrItem;
    m.style.minHeight = '';
    if (!vrLevel) {
      const top = vrList('r'), subs = VR_SUBS.map(([c, n]) => [c, n, vrList(c)]).filter(s => s[2].length);
      const all = variants && variants.list || [], long = all.length > VR_FIND_OVER;
      m.innerHTML = (long ? `<div class="cb-vr-find" role="search"><input type="text" class="cb-vr-in" aria-label="Filter versions" placeholder="Filter ${vrFmt(all.length)} versions" readonly inputmode="none" enterkeyhint="done" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">` +
        `<button type="button" class="cb-vr-x" data-vr-clear aria-label="Clear filter" title="Clear filter" hidden>\u00d7</button></div><p class="cb-vr-n" role="status" hidden></p><div class="cb-vr-res" hidden></div><div class="cb-vr-main">` : '') +
        top.map(item).join('') + (top.length && subs.length ? '<div class="cb-msep" role="separator"></div>' : '') +
        subs.map(([c, n, l]) => `<button type="button" role="menuitem" data-vr-sub="${c}" aria-label="${esc(n + ', ' + vrFmt(l.length))}"><span class="tick">${l.some(x => x.current) ? '✓' : ''}</span><span>${esc(n)}</span><span class="own">${vrFmt(l.length)} ›</span></button>`).join('') + (long ? '</div>' : '');
      if (long) vrFindWire(m.querySelector('.cb-vr-in'));
    } else {
      const l = vrList(vrLevel), left = l.length - vrShown, name = (VR_SUBS.find(s => s[0] === vrLevel) || [])[1] || '';
      m.innerHTML = `<button type="button" role="menuitem" class="cb-up" data-vr-up aria-label="Back to all versions"><span class="tick">‹</span><span>All versions</span></button>` +
        `<div class="cb-mh" role="presentation">${esc(name)} · ${vrFmt(l.length)}</div>` + l.slice(0, vrShown).map(item).join('') +
        (left > 0 ? `<button type="button" role="menuitem" class="cb-mmore" data-vr-more><span class="tick">+</span><span>Show ${vrFmt(Math.min(VR_PAGE, left))} more (${vrFmt(left)} left)</span></button>` : '');
    }
    if (menu === 'variant' && !m.hidden) placeMenu(m, opener);
  }
  function vrFindHint(inp) { inp.placeholder = inp.readOnly && document.activeElement === inp ? 'Press OK or Enter to type\u2026' : 'Filter ' + vrFmt(variants.list.length) + ' versions'; }
  function vrFindRest(inp) { inp.readOnly = true; inp.setAttribute('inputmode', 'none'); vrFindHint(inp); }
  /* Blur and focus again: a phone shows or hides its keyboard on focus, not on an attribute change. */
  function vrFindRefocus(inp) { vrRefocus = true; try { inp.blur(); inp.focus({ preventScroll: true }); } catch (_) {} vrRefocus = false; }
  function vrFindEdit(inp, how) {
    inp.readOnly = false; inp.setAttribute('inputmode', 'search'); vrFindHint(inp);
    if (how === 'pointer') return;   // the press itself puts the focus and caret there
    vrFindRefocus(inp);
    try { const n = inp.value.length; inp.setSelectionRange(n, n); } catch (_) {}
  }
  function vrFindLeave(inp) { vrFindRest(inp); if (document.activeElement === inp) vrFindRefocus(inp); vrFindHint(inp); }
  function vrFindPaint() {
    const res = menus.variant.querySelector('.cb-vr-res'), names = { r: 'Versions', t: 'Translations', h: 'Hacks', o: 'Other copies' };
    let html = '', cur = '';
    for (const x of vrHits.slice(0, vrHitsShown)) {
      const c = x.cls || 'r';
      if (c !== cur) { cur = c; html += `<div class="cb-mh" role="presentation">${names[c]} · ${vrFmt(vrHits.filter(h => (h.cls || 'r') === c).length)}</div>`; }
      html += vrItem(x);
    }
    const left = vrHits.length - vrHitsShown;
    res.innerHTML = html + (left > 0 ? `<button type="button" role="menuitem" class="cb-mmore" data-vr-fmore><span class="tick">+</span><span>Show ${vrFmt(Math.min(VR_PAGE, left))} more (${vrFmt(left)} left)</span></button>` : '');
  }
  function vrFindApply(inp) {
    const m = menus.variant, res = m.querySelector('.cb-vr-res'), main = m.querySelector('.cb-vr-main'), note = m.querySelector('.cb-vr-n'), list = variants.list;
    m.querySelector('.cb-vr-x').hidden = !inp.value;
    const q = vrFold(inp.value).trim();
    if (!q) { vrHits = []; res.hidden = true; res.innerHTML = ''; note.hidden = true; note.textContent = ''; main.hidden = false; m.style.minHeight = ''; placeMenu(m, opener); return; }
    /* The menu keeps its height while narrowing, so the box does not move under the typing. */
    if (!m.style.minHeight) m.style.minHeight = m.offsetHeight + 'px';
    if (vrHayOf !== list) { vrHayOf = list; vrHay = list.map(x => { const f = vrFold(x.label); return f + '\n' + vrLoose(f); }); }
    const ql = vrLoose(q);
    vrHits = list.filter((x, i) => vrHay[i].includes(q) || (ql && vrHay[i].includes(ql)));
    vrHitsShown = VR_PAGE;
    main.hidden = true; note.hidden = false;
    note.textContent = vrHits.length ? vrFmt(vrHits.length) + ' of ' + vrFmt(list.length) + ' versions' : 'No versions match "' + inp.value.trim() + '".';
    res.hidden = !vrHits.length;
    vrFindPaint();
  }
  function vrFindWire(inp) {
    inp.addEventListener('pointerdown', () => { if (inp.readOnly) vrFindEdit(inp, 'pointer'); });
    inp.addEventListener('click', () => { if (inp.readOnly) vrFindEdit(inp, 'key'); });   // a pad's A presses what has the focus
    inp.addEventListener('input', () => vrFindApply(inp));
    inp.addEventListener('focus', () => vrFindHint(inp));
    inp.addEventListener('blur', () => { if (vrRefocus) return; vrFindHint(inp); setTimeout(() => { if (inp.isConnected && document.activeElement !== inp) vrFindRest(inp); }, 0); });
  }
  function vrFindClear(inp) { inp.value = ''; vrFindApply(inp); vrFindRest(inp); try { inp.focus({ preventScroll: true }); } catch (_) {} vrFindHint(inp); }
  /* Back on the box or a filtered row, a step at a time; false lets the menu's own Back go on. */
  function vrFindBack() {
    const inp = menu === 'variant' && menus.variant.querySelector('.cb-vr-in');
    if (!inp) return false;
    const a = document.activeElement;
    if (a === inp && !inp.readOnly) { vrFindLeave(inp); return true; }
    if (!inp.value) return false;
    if (a === inp) { vrFindClear(inp); return true; }
    vrFindRest(inp); try { inp.focus({ preventScroll: true, focusVisible: true }); } catch (_) {} vrFindHint(inp);
    return true;
  }
  function vrFocus(el) { if (el) setTimeout(() => { try { el.focus({ preventScroll: false }); } catch (_) {} }, 0); }
  function vrEnter(c) {
    const l = vrList(c), i = l.findIndex(x => x.current);
    vrLevel = c; vrShown = Math.min(l.length, Math.max(VR_PAGE, Math.ceil((i + 1) / VR_PAGE) * VR_PAGE));
    paintVariant();
    const m = menus.variant, f = m.querySelector('[aria-checked="true"]') || m.querySelector('[data-vr]');
    m.scrollTop = f ? Math.max(0, f.offsetTop - 48) : 0;
    vrFocus(f);
  }
  function vrUp() {
    if (!vrLevel) return false;
    const c = vrLevel; vrLevel = null; paintVariant();
    menus.variant.scrollTop = 0;
    vrFocus(menus.variant.querySelector('[data-vr-sub="' + c + '"]'));
    return true;
  }
  function vrMore() {
    const from = vrShown; vrShown = Math.min(vrList(vrLevel).length, from + VR_PAGE); paintVariant();
    vrFocus(menus.variant.querySelectorAll('[data-vr]')[from]);
  }
  /* THE CHEATS MENU (2026-10-26; the spec: Cheats -> providers -> that game's cheats, like
     the Variant submenus). One provider: its list straight away. Each cheat is an on/off row that
     stays open, so several can be switched; its code is under its name. 50 at a time, then
     "Show more". Back steps up to the providers, then closes. "Turn all off" heads the list while any
     cheat is on. The source's credit line ends each list. */
  /* Credit line (RESOLVED 2026-10-28): CC BY-SA 4.0 asks for the credit, a link to the
     licence and a note of changes, so the licence name is a link and libretro-database codes say they
     were reshaped. Full record: licenses/THIRD-PARTY-NOTICES section 8. */
  const CH_LIC = { 'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/' };
  const chCredit = t => Object.keys(CH_LIC).reduce((h, k) => h.split(esc(k)).join(`<a href="${CH_LIC[k]}" target="_blank" rel="noopener">${esc(k)}</a>`), esc(t)) +
    (/libretro-database/.test(t) ? ' Reshaped for this player: codes decoded to address and value, names lightly edited, codes it cannot run left out.' : '');
  let chLevel = null, chShown = 0;
  const chProvs = () => { try { return C && C.cheats ? C.cheats.providers() : []; } catch (_) { return []; } };
  function paintCheats(keepId) {
    const m = menus.cheats, provs = chProvs();
    if (!chLevel && provs.length === 1) { chLevel = provs[0].id; chShown = Math.min(provs[0].cheats.length, VR_PAGE); }
    const on = provs.reduce((n, p) => n + p.cheats.filter(c => c.on).length, 0);
    const off = on ? `<button type="button" role="menuitem" data-ch-off><span class="tick">×</span><span>Turn all off (${vrFmt(on)} on)</span></button>` : '';
    const credit = (() => { try { return C.cheats.credit ? C.cheats.credit() : ''; } catch (_) { return ''; } })();
    const foot = credit ? `<div class="cb-mh cb-ch-credit" role="note">${chCredit(credit)}</div>` : '';
    if (!chLevel) {
      m.innerHTML = off + (off ? '<div class="cb-msep" role="separator"></div>' : '') + provs.map(p => {
        const n = p.cheats.filter(c => c.on).length;
        return `<button type="button" role="menuitem"${n ? ' class="cb-ch-on"' : ''} data-ch-sub="${esc(p.id)}" aria-label="${esc(p.name + ', ' + vrFmt(p.cheats.length) + (n ? ', ' + n + ' on' : ''))}"><span class="tick">${n ? '✓' : ''}</span><span>${esc(p.name)}</span><span class="own">${n ? vrFmt(n) + ' on · ' : ''}${vrFmt(p.cheats.length)} ›</span></button>`;
      }).join('') + foot;
    } else {
      const p = provs.find(x => x.id === chLevel) || { name: '', cheats: [] }, l = p.cheats, left = l.length - chShown;
      const item = c => `<button type="button" role="menuitemcheckbox" aria-checked="${c.on}"${c.on ? ' class="cb-ch-on"' : ''} data-ch="${esc(c.id)}"><span class="tick">${c.on ? '✓' : ''}</span><span class="cb-ch">${esc(c.name)}${c.code ? `<small>${esc(c.code)}</small>` : ''}${c.note ? `<small>${esc(c.note)}</small>` : ''}</span><span class="own">${c.on ? 'on' : 'off'}</span></button>`;
      m.innerHTML = (provs.length > 1 ? `<button type="button" role="menuitem" class="cb-up" data-ch-up aria-label="Back to all cheat types"><span class="tick">‹</span><span>All cheat types</span></button>` : '') + off +
        `<div class="cb-mh" role="presentation">${esc(p.name)} · ${vrFmt(l.length)}</div>` + l.slice(0, chShown).map(item).join('') +
        (left > 0 ? `<button type="button" role="menuitem" class="cb-mmore" data-ch-more><span class="tick">+</span><span>Show ${vrFmt(Math.min(VR_PAGE, left))} more (${vrFmt(left)} left)</span></button>` : '') + foot;
    }
    if (menu === 'cheats' && !m.hidden) placeMenu(m, opener);
    if (keepId) vrFocus(Array.from(m.querySelectorAll('[data-ch]')).find(x => x.dataset.ch === keepId) || m.querySelector('button'));
  }
  function chEnter(id) {
    const p = chProvs().find(x => x.id === id); if (!p) return;
    chLevel = id; chShown = Math.min(p.cheats.length, VR_PAGE);
    paintCheats(); menus.cheats.scrollTop = 0;
    vrFocus(menus.cheats.querySelector('[data-ch]'));
  }
  function chUp() {
    if (!chLevel || chProvs().length <= 1) return false;
    const id = chLevel; chLevel = null; paintCheats();
    menus.cheats.scrollTop = 0;
    vrFocus(Array.from(menus.cheats.querySelectorAll('[data-ch-sub]')).find(x => x.dataset.chSub === id));
    return true;
  }
  function chMore() {
    const p = chProvs().find(x => x.id === chLevel); if (!p) return;
    const from = chShown; chShown = Math.min(p.cheats.length, from + VR_PAGE); paintCheats();
    vrFocus(menus.cheats.querySelectorAll('[data-ch]')[from]);
  }
  function chToggle(id) {
    const c = chProvs().reduce((f, p) => f || p.cheats.find(x => x.id === id), null); if (!c) return;
    Promise.resolve(C.cheats.set(id, !c.on)).then(r => {
      if (r && r.ok === false) toast(r.why || 'This cheat could not be switched on.', true);
      sync(); if (menu === 'cheats') paintCheats(id);
    }, () => {});
  }
  // Under its button, inside the stage (again after a submenu changes its width).
  /* ALWAYS ON SCREEN (31 Oct: "The bottom of the Variants menu on my phone in landscape loads off screen
     and I cannot click the items at the bottom ... Cheats menu could be the same"). The cap was the
     stage's height less 70 px, but on a phone the bar wraps onto two or three lines, so a menu hung from
     a row-2 button (Variant, Cheats) started 90 to 130 px down and ran past the screen's foot. Its height
     is now the room left between its top and the bottom of what is visible (the stage, and the window or
     the visible viewport), less 10 px, and it scrolls inside itself; when that room is under 160 px and
     there is more room above the button, it opens upwards instead. */
  function placeMenu(m, b) {
    const sr = C.stage.getBoundingClientRect(), br = (b || bar).getBoundingClientRect();
    const w = m.offsetWidth;
    let left = br.left - sr.left + br.width / 2 - w / 2;
    left = Math.max(10, Math.min(left, sr.width - w - 10));
    m.style.left = left + 'px';
    const vv = window.visualViewport;
    const viewTop = Math.max(sr.top, vv ? vv.offsetTop : 0), viewBot = Math.min(sr.bottom, vv ? vv.offsetTop + vv.height : window.innerHeight);
    const below = viewBot - 10 - (br.bottom + 8), above = (br.top - 8) - (viewTop + 10);
    m.style.boxSizing = 'border-box';   // the height set below includes the menu's padding and border
    m.style.maxHeight = '';
    const want = m.scrollHeight;
    if (below < Math.min(160, want) && above > below) {
      const h = Math.max(60, Math.min(want, above));
      m.style.maxHeight = h + 'px';
      m.style.top = (br.top - 8 - h - sr.top) + 'px';
    } else {
      m.style.maxHeight = Math.max(60, below) + 'px';
      m.style.top = (br.bottom - sr.top + 8) + 'px';
    }
  }
  // A menu open while the screen turns or the window changes size is placed again.
  window.addEventListener('resize', () => { if (menu && menus[menu] && !menus[menu].hidden) { try { placeMenu(menus[menu], opener); } catch (_) {} } });
  /* Speed (fast-forward, decision P4): the choices the core declares in caps.speed. */
  const speedLabel = x => (x === 1 ? 'Off' : x + '×');
  function speedChoices() { return Array.isArray(caps.speed) ? caps.speed : (caps.speed ? [1, 2, 4] : []); }
  function toggleMenu(id, b) { if (menu === id) closeMenu(true); else openMenu(id, b); }
  function openMenu(id, b) {
    const m = menus[id]; if (!m) return;
    closeMenu(false);
    if (id === 'variant') { vrLevel = null; paintVariant(); }
    if (id === 'cheats') { chLevel = null; chShown = 0; paintCheats(); }
    if (id === 'media' && C && C.media) {
      const cur = C.media.current();
      m.innerHTML = C.media.list().map(x => `<button type="button" role="menuitemradio" data-media="${esc(x.id)}" aria-checked="${x.id === cur ? 'true' : 'false'}"><span class="tick">${x.id === cur ? '✓' : ''}</span><span>${esc(x.label)}</span></button>`).join('')
        + (cur != null ? '<button type="button" role="menuitem" data-media-eject="1"><span class="tick"></span><span>Eject</span></button>' : '');
    }
    if (id === 'console') {
      m.innerHTML = consoleItems().map(it => `<button type="button" role="menuitem" data-ck-tap="${esc(it.ck)}"><span class="tick">${ICON[it.icon] && !it.text ? ICON[it.icon] : ''}</span><span>${esc(it.label)}</span>${it.key ? `<span class="own">${esc(it.key)}</span>` : ''}</button>`).join('');
    }
    if (id === 'device') {
      let d = null; try { d = C && C.device ? C.device(devOpen) : null; } catch (_) { d = null; }
      m.innerHTML = d ? d.menu().map(x => x.info
        ? `<div class="cb-mh" role="note">${esc(x.label)}</div>`
        : `<button type="button" role="${x.checked != null ? 'menuitemradio' : 'menuitem'}" data-dev-item="${esc(x.id)}"${x.checked != null ? ` aria-checked="${x.checked ? 'true' : 'false'}"` : ''}><span class="tick">${x.checked ? '✓' : ''}</span><span>${esc(x.label)}</span></button>`).join('') : '';
    }
    if (id === 'speed') {
      const cur = C && C.speed ? +C.speed() || 1 : 1;
      m.innerHTML = speedChoices().map(x => `<button type="button" role="menuitemradio" data-speed="${x}" aria-checked="${x === cur ? 'true' : 'false'}"><span class="tick">${x === cur ? '✓' : ''}</span><span>${esc(speedLabel(x))}</span>${x > 2 ? '<span class="own">sound off</span>' : ''}</button>`).join('');
    }
    if (id === 'more') m.innerHTML = ITEMS.filter(it => it.more && shown(it)).concat(consoleItems()).map(it =>
      `<button type="button" role="menuitem" data-more-act="${it.id}"><span class="tick">${ICON[it.icon]}</span><span>${esc(it.id === 'speed' && C && C.speed ? 'Turbo: ' + speedLabel(+C.speed() || 1) : it.label)}</span>${it.key ? `<span class="own">${esc(it.key)}</span>` : ''}</button>`).join('');
    if (!m.innerHTML) return;
    m.hidden = false;
    placeMenu(m, b);
    menu = id; opener = b;
    if (b) b.setAttribute('aria-expanded', 'true');
    const curSub = m.querySelector('[data-vr-sub] .tick:not(:empty)');
    const cur = m.querySelector('[aria-checked="true"]') || (curSub && curSub.parentNode) || m.querySelector('button');
    if (cur) setTimeout(() => cur.focus({ preventScroll: true }), 0);
  }
  function closeMenu(restoreFocus) {
    if (!menu) return false;
    const m = menus[menu]; m.hidden = true;
    if (menu === 'variant') { vrLevel = null; vrHits = []; m.style.minHeight = ''; }
    if (menu === 'cheats') chLevel = null;
    const o = opener;
    if (o) o.setAttribute('aria-expanded', 'false');
    menu = null;
    if (!panel) opener = null;
    if (restoreFocus && o && visible(o)) { try { o.focus({ preventScroll: true }); } catch (_) {} }
    return true;
  }
  function onMenuClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.media !== undefined || b.hasAttribute('data-media-eject')) {
      closeMenu(false);
      try { if (b.hasAttribute('data-media-eject')) C.media.eject(); else C.media.insert(b.dataset.media); } catch (_) {}
      sync(); focusGame();
      return;
    }
    if (b.dataset.ckTap !== undefined) {
      // A console key from the Console menu: pressed and let go, as a tap on the button would be.
      const id = b.dataset.ckTap;
      closeMenu(false);
      ckTap(id, null);
      focusGame();
      return;
    }
    if (b.dataset.devItem !== undefined) {
      const dev = devOpen, item = b.dataset.devItem;
      closeMenu(false);
      // Inside the press: a camera's or the phone's motion permission prompt needs it.
      let p = null; try { p = C.device(dev).choose(item); } catch (_) {}
      Promise.resolve(p).catch(() => {}).then(() => sync());
      focusGame();
      return;
    }
    if (b.dataset.speed) {
      closeMenu(false);
      try { C.setSpeed(+b.dataset.speed); } catch (_) {}
      sync(); focusGame();
      return;
    }
    if (b.dataset.chSub) { chEnter(b.dataset.chSub); return; }
    if (b.hasAttribute('data-ch-up')) { chUp(); return; }
    if (b.hasAttribute('data-ch-more')) { chMore(); return; }
    if (b.dataset.ch) { chToggle(b.dataset.ch); return; }
    if (b.hasAttribute('data-ch-off')) { Promise.resolve(C.cheats.allOff()).then(() => { sync(); if (menu === 'cheats') paintCheats(); }, () => {}); return; }
    if (b.hasAttribute('data-vr-clear')) { const i = menus.variant.querySelector('.cb-vr-in'); if (i) vrFindClear(i); return; }
    if (b.hasAttribute('data-vr-fmore')) { const from = vrHitsShown; vrHitsShown = from + VR_PAGE; vrFindPaint(); vrFocus(menus.variant.querySelectorAll('.cb-vr-res [data-vr]')[from]); return; }
    if (b.dataset.vrSub) { vrEnter(b.dataset.vrSub); return; }
    if (b.hasAttribute('data-vr-up')) { vrUp(); return; }
    if (b.hasAttribute('data-vr-more')) { vrMore(); return; }
    if (b.dataset.vr) {
      const cur = variants && variants.list.find(x => x.current);
      closeMenu(false);
      if (!cur || cur.id !== b.dataset.vr) post({ cwUi: 'variant', id: b.dataset.vr });
      focusGame();
      return;
    }
    if (b.dataset.moreAct) {
      const id = b.dataset.moreAct, kbd = e.detail === 0;
      closeMenu(false);
      if (id.indexOf('ck:') === 0) { ckTap(id.slice(3), null); focusGame(); return; }
      act(id, $b(id), kbd);
    }
  }
  document.addEventListener('pointerdown', e => {
    if (!menu) return;
    if (e.target.closest && (e.target.closest('.cb-menu') || e.target.closest('[aria-haspopup="menu"]'))) return;
    closeMenu(false);
  }, true);

  /* ------------------------------------------------------------------ toast */
  let toastT = 0;
  /* A NOTE'S BUTTON BY KEYS, REMOTE AND PAD (2026-10-24; found: the TV remote could not
     take down the SaveKey note). Back (Escape, a remote's Back, the pad's Home or Select+Start,
     which arrive as Back) puts the focus on the note's button when one shows and nothing else of
     the window is open (backStep, toastStep). OK, Enter or the pad's A then presses it; Back again
     closes the note. While the button has the focus the note stays up, the arrows and the pad's
     D-pad go nowhere, and the game's other keys still play; moving off it closes the note. No game
     key is ever taken: until Back is pressed the game gets every key, as before. */
  const toastFocused = () => !!(toastEl && !toastEl.hidden && document.activeElement && document.activeElement !== toastEl && toastEl.contains(document.activeElement));
  function toastClose() { const had = toastFocused(); clearTimeout(toastT); toastEl.hidden = true; if (had) focusGame(); }
  function toastStep() {
    if (!toastEl || toastEl.hidden) return false;
    const b = toastEl.querySelector('button');
    if (!b) return false;
    if (toastFocused()) { toastClose(); return true; }
    clearTimeout(toastT);
    try { window.focus(); } catch (_) {}
    try { b.focus({ focusVisible: true }); } catch (_) { b.focus(); }
    return true;
  }
  function toast(msg, err, action) {
    if (!toastEl) return;
    toastEl.className = 'cb-toast' + (err ? ' err' : '');
    toastEl.innerHTML = `<span>${esc(msg)}</span>`;
    if (action) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = action.label;
      b.addEventListener('click', () => { toastClose(); action.fn(); });
      b.addEventListener('focus', () => clearTimeout(toastT));     // the note stays while its button has the focus
      b.addEventListener('blur', () => setTimeout(() => { if (toastEl.contains(b) && !toastEl.hidden && !toastFocused()) toastEl.hidden = true; }, 0));
      toastEl.appendChild(b);
    }
    toastEl.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => { toastEl.hidden = true; }, action ? (action.ms > 0 ? action.ms : 6000) : err ? 4200 : 2200);   // action.ms: a longer instruction (host noticeOnce)
  }

  /* ------------------------------------------------------------------ Keys
     The shared FRAME: three tabs, the same everywhere. The CONTENTS are the
     device's own: its diagram (core.keysContent), and its keys and pad buttons
     from play-pad.js's table for this system (the same table Settings ->
     Keyboard & controllers edits, so a remap shows here). */
  const WINDOW_KEYS = [
    ['Pause / resume', 'Ctrl+P'], ['Rewind (hold)', 'Ctrl+←'], ['Turbo: off, 2×, 4× (where offered)', 'Ctrl+→'], ['Quick save', 'Ctrl+S'], ['Quick load', 'Ctrl+L'],
    ['Previous / next save', 'Ctrl+[  Ctrl+]'], ['Keys', 'Ctrl+/'], ['Mute', 'Ctrl+M'], ['Full screen', 'Ctrl+Shift+F'], ['On-screen buttons on / off', 'Ctrl+O'],
    ['Help', '?'], ['Back (close a panel, then the pause menu)', 'Esc'],
  ];
  function kbd(s) { return String(s).split(/\s{2,}/).map(x => `<span class="cb-kbd">${esc(x)}</span>`).join(' '); }
  /* Swap A/B, through the host (caps.padSwap). */
  function swapOn() { try { return !!(C && C.padSwap && C.padSwap.on()); } catch (_) { return false; } }
  function swapDoes() { try { return !!(C && C.padSwap && C.padSwap.does()); } catch (_) { return false; } }
  function swapSeen() { try { return !!(C && C.padSwap && C.padSwap.seen()); } catch (_) { return false; } }
  function swapToggle() {
    try { C.padSwap.set(!C.padSwap.on()); } catch (_) {}
    sync();
    if (panels.keys && panel === 'keys') renderPad();
  }
  function buildKeys() {
    const p = panels.keys;
    p.innerHTML = `<div class="cb-tabs" role="tablist" aria-label="Keys">
        <button type="button" role="tab" data-tab="kb" aria-selected="true">Keyboard</button>
        <button type="button" role="tab" data-tab="pad" aria-selected="false">Gamepad</button>
        <button type="button" role="tab" data-tab="win" aria-selected="false">Window</button></div>
      <div class="cb-tabpanel" data-tp="kb" role="tabpanel"></div>
      <div class="cb-tabpanel" data-tp="pad" role="tabpanel" hidden></div>
      <div class="cb-tabpanel" data-tp="win" role="tabpanel" hidden></div>
      <button type="button" class="cb-act" data-keybind>Change keys and buttons…</button>`;
    const kb = p.querySelector('[data-tp="kb"]');
    let content = null; try { content = C.keysContent && C.keysContent(); } catch (_) {}
    if (content) kb.appendChild(content);
    p.querySelector('[data-tp="win"]').innerHTML = `<table class="cb-table">${WINDOW_KEYS.concat(swapDoes() ? [['Swap a controller\'s A with B and X with Y, in the game only', 'Ctrl+B']] : []).map(([a, k]) => `<tr><td>${esc(a)}</td><td>${kbd(k)}</td></tr>`).join('')}</table>
      <div class="cb-sub">The window's keys use Ctrl, which no console here uses as a button, so they never take a game key.</div>`;
    p.querySelector('.cb-tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) keysTab(b.dataset.tab); });
    p.querySelector('[data-keybind]').addEventListener('click', e => post({ cwUi: 'keybind', sys: C.sys, via: viaOf(e) }));
  }
  function keysTab(t) {
    const p = panels.keys;
    p.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t ? 'true' : 'false'));
    p.querySelectorAll('[data-tp]').forEach(x => { x.hidden = x.dataset.tp !== t; });
    if (t === 'pad') renderPad();
  }
  function renderPad() {
    const el = panels.keys.querySelector('[data-tp="pad"]');
    let T = null; try { T = window.gnwPlayPad && window.gnwPlayPad.table(C.padSys || C.sys); } catch (_) { T = null; }
    if (!T) { el.innerHTML = '<div class="cb-sub">No gamepad table for this console.</div>'; return; }
    const swapped = swapOn() && swapDoes() ? { A: 'B', B: 'A', X: 'Y', Y: 'X' } : null;   // the table says what each button does now
    el.innerHTML = `<table class="cb-table">${T.pad.map(r => `<tr><td>${esc(r.label)}</td><td>${r.buttons.length ? r.buttons.map(b => kbd((swapped && swapped[b]) || b)).join(' ') : '<span class="cb-sub">none</span>'}</td></tr>`).join('')}
      <tr><td>Pause menu</td><td>${kbd('Home')} or ${kbd('Select')}+${kbd('Start')}</td></tr><tr><td>Help</td><td>${kbd('R3')}</td></tr>
      ${caps.overlay && !T.pad.some(r => r.buttons.includes('L3')) ? `<tr><td>On-screen buttons on / off</td><td>${kbd('L3')}</td></tr>` : ''}
      ${(() => { /* the shoulders, where the console leaves them free (play/host/host.mjs shoulders, 2026-10-23) */
        const free = b => !T.pad.some(r => r.buttons.includes(b));
        return (caps.rewind && free('LB') ? `<tr><td>Rewind (hold)</td><td>${kbd('LB')}</td></tr>` : '') +
          (free('RB') ? `<tr><td>Turbo 2× (hold)</td><td>${kbd('RB')}</td></tr>` : ''); })()}
      ${(() => { const free = ['LT', 'RT'].filter(b => !T.pad.some(r => r.buttons.includes(b))); return free.length ? `<tr><td>This bar (then ${kbd('LT')} ${kbd('RT')} step along it, ${kbd('B')} back to the game)</td><td>${free.map(b => kbd(b)).join(' or ')}</td></tr>` : ''; })()}</table>
      ${swapDoes() ? `<div class="cb-sub">Swap A/B on the bar changes A with B and X with Y, in the game only. It is ${swapped ? 'on: this list shows the buttons as they work now' : 'off'}.</div>` : ''}
      ${T.padCustom ? '<div class="cb-sub">Includes your changes from Settings.</div>' : ''}`;
  }

  /* ------------------------------------------------------------------ Settings */
  function buildSettings() {
    const p = panels.settings;
    p.innerHTML = '<div class="cb-set"></div><button type="button" class="cb-act" data-keybind>Keyboard &amp; controllers…</button>';
    const host = p.querySelector('.cb-set');
    let groups = []; try { groups = (C.settings && C.settings()) || []; } catch (_) { groups = []; }
    for (const g of groups) {
      if (!g || !g.nodes || !g.nodes.length) continue;
      const sec = document.createElement('section');
      sec.innerHTML = `<h4>${esc(g.section)}</h4>`;
      for (const n of g.nodes) {
        if (!n) continue;
        if (n.classList && n.classList.contains('cb-row')) { sec.appendChild(n); continue; }
        const row = document.createElement('div'); row.className = 'cb-row'; row.appendChild(n); sec.appendChild(row);
      }
      host.appendChild(sec);
    }
    // The on-screen buttons (play/shared/overlay.js): its own Auto / On / Off row.
    let ovRow = null; try { ovRow = caps.overlay && C.overlay && C.overlay.settingsNode ? C.overlay.settingsNode() : null; } catch (_) { ovRow = null; }
    if (ovRow) { const sec = document.createElement('section'); sec.innerHTML = '<h4>On-screen buttons</h4>'; sec.appendChild(ovRow);
      const tip = document.createElement('div'); tip.className = 'cb-sub'; tip.textContent = 'Ctrl+O, or pressing the left stick (L3) on a controller, turns them on or off.'; sec.appendChild(tip);
      host.appendChild(sec); }
    if (!host.children.length) host.innerHTML = '<div class="cb-sub">Nothing to set for this console.</div>';
    p.querySelector('[data-keybind]').addEventListener('click', e => post({ cwUi: 'keybind', sys: C.sys, via: viaOf(e) }));
  }
  function refreshSettings() { try { C.refreshSettings && C.refreshSettings(); } catch (_) {} }

  /* "KEYBOARD & CONTROLLERS..." ONLY WHERE ONE IS IN USE (2026-10-11). On a touch phone or
     tablet with no keyboard and no pad the button leads to settings for things that are not there,
     so it is hidden. It shows when the device has a fine pointer or hover (a desktop), in TV mode,
     while a gamepad is connected, or once a real key press has been seen in this tab (kept in
     sessionStorage, so the next game's window knows too). Live: a pad connecting or a key press
     shows it at once. Both buttons of the kind (Keys panel and Settings) follow the same rule; the
     site's own Settings -> Keyboard & controllers page is untouched. */
  const KEY_SEEN = 'cw.keySeen';
  let keySeen = false;
  try { keySeen = sessionStorage.getItem(KEY_SEEN) === '1'; } catch (_) {}
  function padConnected() { try { return Array.from((navigator.getGamepads && navigator.getGamepads()) || []).some(Boolean); } catch (_) { return false; } }
  function finePointer() { try { return ['(hover: hover)', '(pointer: fine)', '(any-hover: hover)', '(any-pointer: fine)'].some(q => matchMedia(q).matches); } catch (_) { return true; } }
  function tvMode() { const b = document.body; return !!b && (b.classList.contains('cb-tv') || b.classList.contains('gnw-tv')); }
  function kbWanted() { return finePointer() || tvMode() || padConnected() || keySeen; }
  function paintKeybind() { const on = kbWanted(); for (const el of Object.values(panels).map(p => p.querySelector('[data-keybind]')).filter(Boolean)) el.hidden = !on; if (bar) sync(); }
  addEventListener('keydown', e => {
    if (keySeen || !e.isTrusted || e.__gnwPad || e.__cwOverlay || e.__gnwRemap) return;
    keySeen = true; try { sessionStorage.setItem(KEY_SEEN, '1'); } catch (_) {}
    paintKeybind();
  }, true);
  addEventListener('gamepadconnected', () => paintKeybind());
  addEventListener('gamepaddisconnected', () => paintKeybind());

  /* ------------------------------------------------------------------ Saves
     ONE TABLE ON EVERY CONSOLE (8 Nov 2026, play/shared/save-table.js): every save of this game on
     this machine, up to caps.saves.slots (20), newest first, the picture first; the Continue row's
     "Last closed" save pinned on top as an auto save (A11). The saves stay where they always were
     (the host's states.*), so every save made before the table shows here and loads. Select a row,
     then Load or Save; Save on a row that holds a save asks first, and Undo puts the old one back. */
  let lastClosed = null;          // { ts, thumb, rec } for this game, from the host
  let renderSeq = 0;
  const maxSaves = () => (caps.saves && caps.saves.slots) || 20;
  const saveName = i => `Save ${i + 1}`;
  async function readSaves() { try { return (await C.states.list()) || []; } catch (e) { toast('Could not read the saves: ' + e.message, true); return []; } }
  /* focusWhere: 'row' (the selected row) or 'act' (its first button) takes the focus after the draw. */
  async function renderSaves(focusWhere, lcKnown) {
    const p = panels.saves; if (!p) return;
    const seq = ++renderSeq;
    const cfg = caps.saves || {};
    const list = await readSaves();
    let lc = lcKnown;
    if (lc === undefined && caps.lastClosed) {
      const ask = askLastClosed();
      lc = await Promise.race([ask, new Promise(r => setTimeout(() => r(undefined), 900))]);
      if (lc === undefined) {       // a slow answer: draw now with what was known, again when it comes
        lc = lastClosed;
        ask.then(v => { if (seq === renderSeq && panel === 'saves' && (v ? v.ts : 0) !== (lc ? lc.ts : 0)) renderSaves(p.contains(document.activeElement) ? 'row' : null, v); });
      }
    }
    await saveTableReady;
    if (seq !== renderSeq || !window.CwSaveTable) return;
    lastClosed = lc || null;
    const rows = []; list.forEach((s, i) => { if (s) rows.push(Object.assign({ i }, s)); });
    const N = maxSaves(), title = (C.title && C.title()) || '';
    p.innerHTML = `<h3>Saves</h3><div class="cb-sub">${esc(title)}${title ? ' · ' : ''}${rows.length} of ${N} saves${lastClosed ? ' · 1 auto save' : ''}</div>` +
      '<div class="cb-sv-host" style="display:contents"></div>' +
      '<div class="cb-sv-hint">Select a save, then Load or Save.<span class="kb"> Ctrl+S saves to the selected save, Ctrl+L loads it.</span></div>';
    const w = parseFloat(String(cfg.shot || '').split('/')[0]) || 0;
    window.CwSaveTable.render(p.querySelector('.cb-sv-host'), {
      max: N, shot: cfg.shot, pixelated: w > 0 && w <= 512, rows,
      autos: lastClosed ? [{ key: 'last', label: 'Last closed', sub: 'Saved by itself when you last closed this game', ts: lastClosed.ts, thumb: lastClosed.thumb }] : [],
      selected: slot, focus: focusWhere || null,
      can: { note: !!(C.states && typeof C.states.setNote === 'function'), transfer: !!caps.transfer },
      on: { select: s => { slot = s; }, load: loadSlot, loadAuto: loadLast, save: saveSlot, del: deleteSlot, note: setNote, exportRow: exportSlot, importRow: importSlot },
    });
  }
  async function freeIndex() { const list = await readSaves(), N = maxSaves(); for (let i = 0; i < N; i++) if (!list[i]) return i; return -1; }
  async function undoIt() {
    const u = undo; undo = null; if (!u) return;
    try { await C.states.put(u.i, u.rec); slot = u.i; if (panel === 'saves') renderSaves('act'); toast(`${saveName(u.i)} put back`); }
    catch (e) { toast('Could not undo: ' + e.message, true); }
  }
  /* i: a save's index (writes over it: the table asked first), or null (a new save). */
  async function saveSlot(i) {
    try {
      let before = null;
      if (i == null) { i = await freeIndex(); if (i < 0) { toast(`All ${maxSaves()} saves are in use: select one to replace it`, true); return; } }
      else before = (await readSaves())[i] || null;
      await C.states.save(i); slot = i;
      if (before && before.state && !before.damaged) { undo = { i, rec: before }; toast(`Saved over ${saveName(i)}`, false, { label: 'Undo', fn: undoIt }); }
      else toast(`Saved as ${saveName(i)}`);
      if (panel === 'saves') renderSaves('act');
    } catch (e) { toast('Could not save: ' + e.message, true); }
  }
  async function loadSlot(i) {
    try {
      // Rewind-aware: the core's load starts a new timeline (its rewind history
      // is cleared), so Rewind can never carry the game back past the load.
      await C.states.load(i); slot = i;
      if (panel) closePanel(false);
      toast(`Loaded ${saveName(i)}`);
    } catch (e) { toast('Could not load: ' + e.message, true); }
  }
  async function loadLast() {
    const lc = lastClosed;
    if (!lc || !C.continueRestore) { toast('There is no auto save for this game', true); return; }
    try { await C.continueRestore(lc.rec); slot = 'auto:last'; if (panel) closePanel(false); toast('Loaded the auto save from when you last closed this game'); }
    catch (e) { toast('Could not load it: ' + e.message, true); }
  }
  async function deleteSlot(i) {
    try {
      const rec = await C.states.remove(i);
      undo = { i, rec };
      slot = 'new';
      if (panel === 'saves') renderSaves('row');
      toast(`${saveName(i)} deleted`, false, { label: 'Undo', fn: undoIt });
    } catch (e) { toast('Could not delete: ' + e.message, true); }
  }
  /* SAVE NOTES (2026-10-19; the old Game & Watch window's "Add a note about this save", now for every
     console): a short note kept in the save's own metadata section (the common save format's 'notes'). */
  async function setNote(i, text) {
    try { await C.states.setNote(i, text); toast(String(text || '').trim() ? `Note kept with ${saveName(i)}` : `Note removed from ${saveName(i)}`); }
    catch (e) { toast('Could not keep the note: ' + e.message, true); }
    slot = i;
    if (panel === 'saves') await renderSaves('act');
  }
  function fileName(title, i, ts) {
    const d = new Date(ts || Date.now()), z = n => String(n).padStart(2, '0');
    const clean = String(title || C.label || 'save').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
    return `${clean} - slot ${i + 1} - ${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}${z(d.getMinutes())}`;
  }
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  async function exportSlot(i) {
    try {
      const x = await C.states.exportOf(i);
      const id = C.identity();
      const meta = Object.assign({ sys: id.sys, sysLabel: C.label, game: id.game, title: id.title, gameHash: id.gameHash, core: id.core, device: id.device, ts: Date.now() }, x.meta || {});
      download(new Blob([CwSave.encode(meta, x.bytes)], { type: 'application/octet-stream' }), fileName(id.title, i, meta.ts) + CwSave.EXT);
      toast(`${saveName(i)} exported`);
    } catch (e) { toast('Could not export: ' + e.message, true); }
  }
  /* i: a save's index, or null (into a new save). */
  function importSlot(i) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = CwSave.EXT + ',application/octet-stream';
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      try {
        const { meta, state } = CwSave.decode(new Uint8Array(await f.arrayBuffer()));
        const why = CwSave.refusal(meta, Object.assign({ label: C.label }, C.identity()));
        if (why) { toast(why, true); return; }
        if (i == null) { i = await freeIndex(); if (i < 0) { toast(`All ${maxSaves()} saves are in use: delete one first`, true); return; } }
        await C.states.importInto(i, state, meta);
        slot = i; renderSaves('act'); toast(`Imported as ${saveName(i)}`);
      } catch (e) { toast(e.message || String(e), true); }
    });
    inp.click();
  }

  /* Quick save / load / select (Ctrl+S, Ctrl+L, Ctrl+[ ]). Ctrl+[ and Ctrl+] step through the table's
     own order (New save, then the saves newest first). Ctrl+S saves to the selected save (Undo puts the
     old one back) or as a new save; Ctrl+L loads the selected save, else the newest. */
  async function quick(kind) {
    if (!caps.saves) return;
    const list = await readSaves(), N = maxSaves();
    const order = list.map((s, i) => (s ? { i, ts: s.ts || 0 } : null)).filter(Boolean).sort((a, b) => b.ts - a.ts || a.i - b.i).map(x => x.i);
    if (kind === 'prev' || kind === 'next') {
      const ring = (order.length < N ? ['new'] : []).concat(order), n = ring.length, at = ring.indexOf(slot);
      if (!n) return;
      slot = ring[at < 0 ? (kind === 'next' ? 0 : n - 1) : (at + (kind === 'next' ? 1 : n - 1)) % n];
      toast(slot === 'new' ? 'New save selected' : `${saveName(slot)} selected`);
      if (panel === 'saves') renderSaves('row');
      return;
    }
    if (kind === 'save') return saveSlot(typeof slot === 'number' && list[slot] ? slot : null);
    if (slot === 'auto:last' && caps.lastClosed) { if (!lastClosed) lastClosed = await askLastClosed(); return loadLast(); }
    const i = typeof slot === 'number' && list[slot] ? slot : order[0];
    if (i == null) { toast('No saves yet for this game', true); return; }
    return loadSlot(i);
  }

  /* ------------------------------------------------------------------ Last closed */
  let lcSeq = 0;
  const lcWait = new Map();
  function askLastClosed() {
    if ((!framed && !(C && C.hostPost)) || !C.continueRestore) return Promise.resolve(null);
    const n = ++lcSeq;
    return new Promise(res => {
      lcWait.set(n, res);
      post({ cwUi: 'lastClosed', n });
      setTimeout(() => { if (lcWait.has(n)) { lcWait.delete(n); res(null); } }, 4000);
    });
  }

  /* ------------------------------------------------------------------ Screenshot */
  /* The Print window's Save and Print (2026-10-21). Save: the whole roll as a PNG at four
     times its size (whole pixels), to the phone's photo library or as a download, like a screenshot. */
  /* The size for Save and Print, 1x / 2x / 4x / 8x whole pixels (2026-10-21): a
     drop-down last in the Print window's bar, remembered in this browser. Its list lives on the
     stage (the bar clips). A pad or remote: Left / Right reach it, A opens it, Up / Down pick,
     A takes the choice, Back closes the list and keeps the paper. */
  const PRN_SCALES = [1, 2, 4, 8], PRN_SCALE_KEY = 'cw.printer.scale';
  let prnScale = 4;
  try { const v = parseInt(localStorage.getItem(PRN_SCALE_KEY), 10); if (PRN_SCALES.includes(v)) prnScale = v; } catch (_) {}
  let scaleList = null, scaleBtn = null;
  const scaleOpen = () => !!(scaleList && !scaleList.hidden);
  function scaleToggle(btn) { if (scaleOpen()) scaleClose(true); else scaleShow(btn); }
  function scaleShow(btn) {
    const stage = C && C.stage; if (!stage || !btn) return;
    if (!scaleList || !scaleList.isConnected) {
      scaleList = document.createElement('div');
      scaleList.className = 'cb-menu cb-scale-list'; scaleList.setAttribute('role', 'listbox');
      scaleList.setAttribute('aria-label', 'Size for Save and Print'); scaleList.style.minWidth = '92px';
      scaleList.innerHTML = PRN_SCALES.map(k => `<button type="button" role="option" data-scale="${k}">${k}x</button>`).join('');
      scaleList.addEventListener('click', e => { const o = e.target.closest('[data-scale]'); if (o) scalePick(+o.dataset.scale); });
      stage.appendChild(scaleList);
    }
    scaleBtn = btn;
    for (const o of scaleList.querySelectorAll('[data-scale]')) o.setAttribute('aria-selected', String(+o.dataset.scale === prnScale));
    scaleList.hidden = false;
    const sr = stage.getBoundingClientRect(), br = btn.getBoundingClientRect();
    const left = Math.max(4, Math.min(br.left - sr.left, sr.width - scaleList.offsetWidth - 4));
    scaleList.style.left = left + 'px'; scaleList.style.top = (br.bottom - sr.top + 6) + 'px';
    btn.setAttribute('aria-expanded', 'true');
    const cur = scaleList.querySelector(`[data-scale="${prnScale}"]`);
    try { cur.focus({ focusVisible: true }); } catch (_) { cur.focus(); }
  }
  function scaleClose(refocus) {
    if (!scaleOpen()) return false;
    scaleList.hidden = true;
    if (scaleBtn) { scaleBtn.setAttribute('aria-expanded', 'false'); if (refocus && visible(scaleBtn)) { try { scaleBtn.focus({ preventScroll: true }); } catch (_) {} } }
    return true;
  }
  function scalePick(k) {
    if (PRN_SCALES.includes(k)) {
      prnScale = k;
      try { localStorage.setItem(PRN_SCALE_KEY, String(k)); } catch (_) {}
      for (const b of document.querySelectorAll('.cb-scale')) {
        b.setAttribute('aria-label', 'Size for Save and Print: ' + k + 'x');
        const l = b.querySelector('[data-scale-lbl]'); if (l) l.textContent = k + 'x';
      }
    }
    scaleClose(true);
  }
  document.addEventListener('pointerdown', e => { if (scaleOpen() && !scaleList.contains(e.target) && !(scaleBtn && scaleBtn.contains(e.target))) scaleClose(false); }, true);
  function printDiscard() { try { C.printer && C.printer.discard(); } catch (_) {} }
  async function printAct(what) {
    if (!C.printer) return;
    if (!(C.printer.rows && C.printer.rows())) { toast('Nothing printed yet'); return; }
    if (what === 'print') { try { if (!C.printer.print(prnScale)) toast('Nothing printed yet'); } catch (e) { toast('Could not print: ' + e.message, true); } return; }
    try {
      const url = C.printer.png(prnScale);
      if (!url) { toast('Nothing printed yet'); return; }
      const id = C.identity ? C.identity() : {};
      const name = fileName(id.title || C.label, 0, Date.now()).replace(/ - slot 1/, ' - print') + '.png';
      const S = window.CwSaveImage;
      if (S) {
        const done = r => { if (r.how === 'downloaded') toast('Picture saved'); else if (r.how === 'gesture') toast('Picture ready', false, { label: 'Save', fn: () => r.retry().then(done) }); };
        done(await S.save(S.toBlob(url), name, { title: id.title || C.label }));
        return;
      }
      download(await (await fetch(url)).blob(), name);
      toast('Picture saved');
    } catch (e) { toast('Could not save the picture: ' + e.message, true); }
  }
  async function screenshot() {
    try {
      const url = await C.screenshot();
      if (!url) { toast('Nothing on screen yet', true); return; }
      const id = C.identity ? C.identity() : {};
      const name = fileName(id.title || C.label, 0, Date.now()).replace(/ - slot 1/, '') + '.png';
      const S = window.CwSaveImage;
      if (S) {   // phone: share sheet (Save Image / Photos); desktop, TV, HTTP: download
        const done = r => { if (r.how === 'downloaded') toast('Screenshot saved'); else if (r.how === 'gesture') toast('Screenshot ready', false, { label: 'Save', fn: () => r.retry().then(done) }); };
        done(await S.save(S.toBlob(url), name, { title: id.title || C.label }));
        return;
      }
      const blob = await (await fetch(url)).blob();
      download(blob, name);
      toast('Screenshot saved');
    } catch (e) { toast('Could not take a screenshot: ' + e.message, true); }
  }

  /* ------------------------------------------------------------------ Full screen (A13) */
  function setFull(on) {
    on = !!on;
    if (on === full) return;
    full = on;
    closeMenu(false);
    if (panel) closePanel(false);
    document.body.classList.toggle('cb-full', on);
    try { C.fullscreen && C.fullscreen(on); } catch (_) {}
    overlayCall('setMode', on ? 'full' : 'device');
    post({ cwUi: 'fullscreen', on });
    if (!framed && !C.hostPost) { try { if (on) document.documentElement.requestFullscreen(); else if (document.fullscreenElement) document.exitFullscreen(); } catch (_) {} }
    setTimeout(fit, 50);
    if (on) toast('Full screen. Back or "< Back" returns to the device');
  }

  /* ------------------------------------------------------------------ host messages */
  function post(m) {
    if (C && C.hostPost) { try { C.hostPost(m); } catch (e) { console.warn('[control bar] host relay failed', e); } return; }
    if (!framed) { if (m.cwUi === 'keybind') toast('Keyboard & controllers is in the site\'s Settings'); return; }
    try { window.parent.postMessage(m, '*'); } catch (_) {}
  }
  addEventListener('message', ev => {
    const d = ev.data;
    if (!d || typeof d.cwUi !== 'string' || (framed && ev.source !== window.parent)) return;
    // An in-page window hears its host only through receive(): the site's document also
    // gets every framed window's own { cwUi } messages, which are not for this bar.
    if (C && C.hostPost) return;
    receive(d);
  });
  function receive(d) {
    if (!d || typeof d.cwUi !== 'string' || !C) return;
    if (d.cwUi === 'variants') { variants = { list: Array.isArray(d.list) ? d.list : [] }; sync(); }
    else if (d.cwUi === 'host') { document.body.classList.toggle('cb-tv', !!d.tv); setTimeout(fit, 0); paintKeybind(); }
    else if (d.cwUi === 'lastClosed') { const r = lcWait.get(d.n); if (r) { lcWait.delete(d.n); r(d.rec ? { ts: d.rec.ts, thumb: d.rec.thumb, rec: d.rec } : null); } }
    else if (d.cwUi === 'fullscreen' && !d.on && full) setFull(false);
    else if (d.cwUi === 'openVariant') { const b = $b('variant'); if (b && visible(b)) openMenu('variant', b); }
    else if (d.cwUi === 'closeMenu') closeMenu(false);
    else if (d.cwUi === 'focusBar') focusBar();
  }

  /* ------------------------------------------------------------------ keyboard
     Capture phase, registered before the play page's own handlers, so nothing
     here can reach the game:
       - inside an open panel or menu, the arrows move between its controls and
         Enter / Space press them (a pad's A arrives as its synthetic key);
       - on the bar, Left / Right move along it and Down opens a menu;
       - the window layer: Ctrl combinations, which no console here uses. */
  function focusables(root) {
    return Array.from(root.querySelectorAll('button, select, input, [tabindex]:not([tabindex="-1"])'))
      .filter(el => !el.disabled && visible(el) && !el.closest('[hidden]'));
  }
  function moveIn(list, dir) {
    if (!list.length) return;
    const a = document.activeElement, i = list.indexOf(a);
    const n = list[i < 0 ? 0 : (i + dir + list.length) % list.length];
    // The ring always shows for a move by keys, a remote or a pad (2026-10-29).
    try { n.focus({ preventScroll: false, focusVisible: true }); } catch (_) { try { n.focus(); } catch (__) {} }
  }
  /* The bar's other row (2026-10-29): the button nearest across, in the row above (dir -1) or
     below (1). False when there is no such row. */
  /* By LINE ON SCREEN since 2026-10-30: a wrapped row (.cb-wrap, a phone) has lines of its own,
     and Down from its first line goes to its second, not past it to row 2. */
  function barRow(a, dir) {
    if (!bar.contains(a)) return false;
    const r = a.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const mid = el => { const q = el.getBoundingClientRect(); return q.top + q.height / 2; };
    const list = focusables(bar.querySelector('.pill-controls')).filter(el => el !== a && (dir > 0 ? mid(el) > r.bottom - 2 : mid(el) < r.top + 2));
    if (!list.length) return false;
    let line = Infinity; for (const el of list) line = Math.min(line, Math.abs(mid(el) - cy));
    let best = null, bd = Infinity;
    for (const el of list) { if (Math.abs(mid(el) - cy) > line + 6) continue; const q = el.getBoundingClientRect(), d = Math.abs(q.left + q.width / 2 - cx); if (d < bd) { bd = d; best = el; } }
    if (!best) return false;
    try { best.focus({ preventScroll: false, focusVisible: true }); } catch (_) { try { best.focus(); } catch (__) {} }
    return document.activeElement === best;
  }
  /* The next (dir 1) or previous (-1) row in a panel's own order: the first control after `a` that
     is not beside it on the same line (Auto / On / Off are one row). False when there is none. */
  function moveRow(root, a, dir) {
    const list = focusables(root), i = list.indexOf(a); if (i < 0) { if (list[0]) list[0].focus(); return !!list[0]; }
    const r = a.getBoundingClientRect();
    const sameLine = el => { const q = el.getBoundingClientRect(); return q.top < r.bottom - 2 && q.bottom > r.top + 2; };
    for (let j = i + dir; j >= 0 && j < list.length; j += dir) {
      if (sameLine(list[j])) continue;
      try { list[j].focus({ preventScroll: false }); } catch (_) {}
      try { list[j].scrollIntoView({ block: 'nearest' }); } catch (_) {}
      return true;
    }
    return false;
  }
  function stepRange(inp, dir) {
    const st = parseFloat(inp.step) || 1, lo = parseFloat(inp.min), hi = parseFloat(inp.max), v0 = parseFloat(inp.value);
    let v = Math.round((v0 + dir * st) / st) * st;
    if (Number.isFinite(lo)) v = Math.max(lo, v); if (Number.isFinite(hi)) v = Math.min(hi, v);
    if (v === v0) return false;
    inp.value = String(+v.toFixed(4));
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  /* ON-SCREEN BUTTONS ON / OFF FROM A PAD OR A KEY (2026-10-22; found: "no way to turn off
     the on-screen controller overlay using a controller alone"). Ctrl+O, and the pad's L3 (the left
     stick pressed, host.mjs) where the console's own pad table leaves it free. Shown now -> Off; hidden
     -> On. Settings -> On-screen buttons -> Auto gives the touch-screen rule back. */
  function overlayToggle() {
    const O = window.CwOverlay;
    if (!C || !caps.overlay || !O || !O.set) return false;
    let shown = false; try { shown = !!O.floatWanted(); } catch (_) {}
    O.set({ display: shown ? 'off' : 'on' });
    try { const seg = panels.settings && panels.settings.querySelector('.cwov-set [data-k="display"]'); if (seg) for (const b of seg.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === (shown ? 'off' : 'on'))); } catch (_) {}
    toast(shown ? 'On-screen buttons off' : 'On-screen buttons on');
    return true;
  }
  /* Arrow keys in a grid of controls go to the nearest control that way. */
  function moveSpatial(root, key) {
    const list = focusables(root); if (!list.length) return;
    const a = document.activeElement;
    if (!root.contains(a)) { list[0].focus(); return; }
    const r = a.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best = null, bd = Infinity;
    for (const el of list) {
      if (el === a) continue;
      const q = el.getBoundingClientRect(), x = q.left + q.width / 2, y = q.top + q.height / 2, dx = x - cx, dy = y - cy;
      const ok = key === 'ArrowRight' ? dx > 4 : key === 'ArrowLeft' ? dx < -4 : key === 'ArrowDown' ? dy > 4 : dy < -4;
      if (!ok) continue;
      const along = (key === 'ArrowLeft' || key === 'ArrowRight') ? Math.abs(dx) : Math.abs(dy);
      const across = (key === 'ArrowLeft' || key === 'ArrowRight') ? Math.abs(dy) : Math.abs(dx);
      const d = along + across * 2.5;
      if (d < bd) { bd = d; best = el; }
    }
    if (best) best.focus();
  }
  function padA(e) {
    if (!e.__gnwPad) return false;
    try { const m = window.gnwPlayPad.mapsFor(C.padSys || C.sys)[0]; return e.code === m.A || e.code === m.X; } catch (_) { return false; }
  }
  function focusBar() {
    const list = focusables(bar.querySelector('.pill-controls'));
    try { window.focus(); } catch (_) {}
    // Clearly highlighted for a TV, a remote and a pad, however focus arrived.
    if (list[0]) { try { list[0].focus({ focusVisible: true }); } catch (_) { list[0].focus(); } }
  }
  function exited(what) { try { if (C && C.onExit) C.onExit(what); } catch (_) {} }
  let backTaken = false;
  const BACK_KEYS = new Set(['Escape', 'Esc', 'GoBack', 'BrowserBack', 'XF86Back', 'Backspace']);
  function isBackKey(e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return false;
    if (e.keyCode === 4 || e.keyCode === 10009 || e.keyCode === 461) return true;
    if (!BACK_KEYS.has(e.key)) return false;
    const t = e.target;
    if (e.key === 'Backspace' && t && (t.isContentEditable || /^(TEXTAREA|SELECT)$/.test(t.tagName) || (t.tagName === 'INPUT' && !/^(button|checkbox|radio|range|color|file|submit|reset|image)$/i.test(t.type || 'text')))) return false;
    return true;
  }
  addEventListener('keydown', e => {
    if (!C || !bar) return;
    if (C.live && !C.live()) return;
    // Typing a save's note: Enter keeps it, Back or Escape leaves it as it was, Left and Right move
    // in the text; nothing else here takes the keys (2026-10-19).
    { const ne = document.activeElement;
      if (ne && ne.classList && ne.classList.contains('cb-note-in')) {
        if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); ne._done(); return; }
        if (isBackKey(e)) { e.preventDefault(); e.stopImmediatePropagation(); ne._cancel(); return; }
        if (!/^Arrow(Up|Down)$/.test(e.key) && !e.ctrlKey && !e.metaKey) { e.stopImmediatePropagation(); return; }
      } }
    // The Variant menu's filter box: what is typed stays in the box, the game never sees it.
    { const vi = document.activeElement;
      if (vi && vi.classList && vi.classList.contains('cb-vr-in')) {
        const down = () => { e.preventDefault(); e.stopImmediatePropagation(); vrFindRest(vi); const l = focusables(menus.variant.querySelector(vi.value ? '.cb-vr-res' : '.cb-vr-main')); if (l[0]) try { l[0].focus({ preventScroll: false, focusVisible: true }); } catch (_) {} };
        if (vi.readOnly) {
          if (e.key === 'ArrowDown') { down(); return; }
          if (padA(e) || ((e.key === 'Enter' || e.key === ' ') && !e.ctrlKey && !e.altKey && !e.metaKey)) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) vrFindEdit(vi, 'key'); return; }
          if (!isBackKey(e) && !/^Arrow(Up|Left|Right)$/.test(e.key) && e.key !== 'Tab') { e.stopImmediatePropagation(); return; }
        } else {
          if (e.key === 'Enter' || isBackKey(e)) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) vrFindLeave(vi); return; }
          if (e.key === 'ArrowDown') { down(); return; }
          if (e.key === 'ArrowUp' && vi.selectionStart === 0 && vi.selectionEnd === 0) vrFindRest(vi);
          else if (e.key !== 'Tab') { e.stopImmediatePropagation(); return; }
        }
      } }
    // In-page: Back is taken here, one step at a time (menu, panel, full screen, bar
    // focus); with nothing open it goes on to keys.js, which opens the pause menu.
    if (C.hostPost && isBackKey(e)) {
      if (menu || panel || full || bar.contains(document.activeElement) || (toastEl && !toastEl.hidden && toastEl.querySelector('button'))) { e.preventDefault(); e.stopImmediatePropagation(); backTaken = true; if (!e.repeat) backStep(); }
      return;
    }
    // The Print window's size list, while open: Up / Down pick, A or Enter takes it, Back closes it.
    if (scaleOpen()) {
      const s = () => { e.preventDefault(); e.stopImmediatePropagation(); };
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { s(); moveIn(focusables(scaleList), e.key === 'ArrowDown' ? 1 : -1); return; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { s(); return; }
      const o = document.activeElement;
      if (padA(e) || e.key === 'Enter' || e.key === ' ') { s(); if (!e.repeat && o && scaleList.contains(o)) o.click(); return; }
      if (isBackKey(e)) { s(); scaleClose(true); return; }
      if (!e.ctrlKey && !e.metaKey && e.key !== 'Tab') { e.stopImmediatePropagation(); return; }
    }
    const a = document.activeElement;
    const inBar = bar.contains(a);
    const root = menu ? menus[menu] : panel ? panels[panel] : null;
    const arrows = /^Arrow(Up|Down|Left|Right)$/.test(e.key);
    const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    // Panels and menus own the keyboard while open.
    if (root || (panel && a === back)) {
      if (arrows && panel === 'print' && bar.contains(a) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        stop(); moveIn(focusables(bar), e.key === 'ArrowRight' ? 1 : -1); return;
      }
      if (arrows) {
        stop();
        if (menu === 'variant' && e.key === 'ArrowRight' && a && a.dataset && a.dataset.vrSub) vrEnter(a.dataset.vrSub);
        else if (menu === 'variant' && e.key === 'ArrowLeft' && vrLevel) vrUp();
        else if (menu === 'cheats' && e.key === 'ArrowRight' && a && a.dataset && a.dataset.chSub) chEnter(a.dataset.chSub);
        else if (menu === 'cheats' && e.key === 'ArrowLeft' && chLevel && chProvs().length > 1) chUp();
        else if (menu) moveIn(focusables(root), (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : -1);
        else if (a === back && e.key === 'ArrowDown') { const l = focusables(root); if (l[0]) l[0].focus(); }
        /* A drop-down in a panel (Settings): Left and Right step its choice (2026-10-19). A
           controller's press and a TV remote's arrow reach it here; before, they could focus a
           select but never change it. A choice that opens a file picker (data-pad-skip) is passed
           over: a pad press cannot open one. Up and Down still move between the rows. */
        else if (a && a.tagName === 'SELECT' && root.contains(a) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) stepSelect(a, e.key === 'ArrowRight' ? 1 : -1);
        /* A slider in a panel (Settings -> On-screen buttons: opacity, size, spacing): Left and Right
           step it, as they do a drop-down (2026-10-22). */
        else if (a && a.tagName === 'INPUT' && a.type === 'range' && root.contains(a) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) stepRange(a, e.key === 'ArrowRight' ? 1 : -1);
        /* SETTINGS: UP AND DOWN GO ROW BY ROW IN READING ORDER (2026-10-22; found: the
           on-screen buttons section "can't be reached with keys/pad"). Its sections sit side by side
           on a wide window, and the nearest-control rule went from the first column straight to the
           button under both, so the On-screen buttons column was never reached by a pad, a remote or
           the arrow keys. Now Down is the next row in the panel's own order, Up the row before; the
           top row's Up is the Back button, as before. */
        else if (panel === 'settings' && root.contains(a) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { if (!moveRow(root, a, e.key === 'ArrowDown' ? 1 : -1) && e.key === 'ArrowUp') back.focus(); }
        else if (root.contains(a) && e.key === 'ArrowUp' && !focusables(root).some(el => el !== a && el.getBoundingClientRect().bottom <= a.getBoundingClientRect().top + 2)) back.focus();
        else moveSpatial(root, e.key);
        return;
      }
      if (padA(e)) { stop(); if (a && a.click) a.click(); return; }
      if ((e.key === 'Enter' || e.key === ' ') && a && (root.contains(a) || a === back)) { e.stopImmediatePropagation(); return; }   // the browser presses it; the game never sees it
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key !== 'Tab' && !/^F\d+$/.test(e.key)) { if (root.contains(a) && /^(INPUT|SELECT)$/.test(a.tagName)) return; e.stopImmediatePropagation(); return; }
    }
    // Focus on the bar: Left / Right along it, Down opens a menu.
    if (inBar && !panel) {
      { const hb = holdItem(a); if (hb && holdKeyOf(e)) { holdKeyDown(e, hb); return; } }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { stop(); moveIn(focusables(bar.querySelector('.pill-controls')), e.key === 'ArrowRight' ? 1 : -1); return; }
      /* Up and Down go between the two rows (2026-10-29), to the nearest button in the other row;
         Down on a menu's button of the lower row (none today), or with no row below, opens it. */
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { stop(); if (barRow(a, e.key === 'ArrowDown' ? 1 : -1)) return; if (e.key === 'ArrowDown' && a.getAttribute('aria-haspopup') === 'menu') a.click(); return; }
      if (padA(e)) { stop(); a.click(); return; }
      if (e.key === 'Enter' || e.key === ' ') { e.stopImmediatePropagation(); return; }
    }
    // Focus on a note's button (toastStep): OK, Enter or A presses it, the arrows go nowhere.
    if (!root && toastFocused()) {
      if (arrows) { stop(); return; }
      if (padA(e)) { stop(); if (!e.repeat) a.click(); return; }
      if (e.key === 'Enter' || e.key === ' ') { e.stopImmediatePropagation(); return; }   // the browser presses it; the game never sees it
    }
    // The window layer.
    if (!e.ctrlKey || e.altKey || e.metaKey) return;
    if (C.windowKeysOff && C.windowKeysOff()) return;
    const k = e.code;
    let done = true;
    if (k === 'KeyP' && caps.pause) { if (!e.repeat) { C.pause(!C.paused()); sync(); toast(C.paused() ? 'Paused' : 'Resumed'); } }
    else if (k === 'KeyS' && caps.saves && !e.shiftKey) { if (!e.repeat) quick('save'); }
    else if (k === 'KeyL' && caps.saves) { if (!e.repeat) quick('load'); }
    else if (k === 'BracketLeft' && caps.saves) quick('prev');
    else if (k === 'BracketRight' && caps.saves) quick('next');
    else if ((k === 'Slash' || k === 'NumpadDivide' || e.key === '/') && caps.keys) { if (!e.repeat) togglePanel('keys', $b('keys')); }
    else if (k === 'KeyM' && caps.mute) { if (!e.repeat) { C.setMuted(!C.muted()); sync(); } }
    else if (k === 'KeyF' && e.shiftKey && caps.fullscreen) { if (!e.repeat) setFull(!full); }
    else if (k === 'KeyO' && !e.shiftKey && caps.overlay) { if (!e.repeat) overlayToggle(); }
    else if (k === 'KeyB' && !e.shiftKey && swapDoes()) { if (!e.repeat) { swapToggle(); toast(swapOn() ? 'Swap A/B on' : 'Swap A/B off'); } }
    else done = false;
    if (done) stop();
  }, true);
  /* A Back (play-keys.js) is offered here first: an open menu closes, then an
     open panel, then full screen. Only when nothing is open does it go on to the
     host's pause menu. Focus on the bar with nothing open hands it back to the game. */
  function backStep() {
    if (!C) return false;
    // A save's note being typed: Back (Escape, a remote's Back, a pad's B) leaves it as it was first.
    { const ne = panels.saves && panels.saves.querySelector('.cb-note-in'); if (ne && ne._cancel) { ne._cancel(); return true; } }
    // A save's "Replace?" question: Back is Cancel (8 Nov 2026).
    { const ak = panels.saves && panels.saves.querySelector('.cb-sv-ask'); if (ak && ak._cancel) { ak._cancel(); return true; } }
    if (vrFindBack()) return true;
    if (menu === 'variant' && vrUp()) return true;
    if (menu === 'cheats' && chUp()) return true;
    if (scaleClose(true)) return true;            // the Print window's size list first; the paper stays
    if (menu) { closeMenu(true); exited('menu'); return true; }
    if (panel) { closePanel(true); return true; }   // the Print window's paper stays
    if (full) { setFull(false); return true; }
    if (bar && bar.contains(document.activeElement)) { focusGame(); exited('bar'); return true; }
    if (toastStep()) return true;                 // a note's button: the first Back focuses it, the next closes the note
    return false;
  }

  /* The overlay contract (agreed for the overlay, 2026-10-07): core.overlay is a
     CwOverlay instance -- mount(stage, {mode}), setMode('device'|'full'|'off'), release(),
     settingsNode(). Every call is optional and guarded. */
  function overlayCall(fn, arg) { try { const o = C && caps.overlay && C.overlay; if (o && typeof o[fn] === 'function') return o[fn](arg); } catch (_) {} return null; }

  /* ------------------------------------------------------------------ register */
  function register(core) {
    if (C || !core || !core.stage) return false;
    C = core;
    try { caps = Object.assign({}, core.caps ? core.caps() : {}); } catch (_) { caps = {}; }
    if (caps.saves === true) caps.saves = { slots: 20 };
    document.body.classList.add('cb-on');
    build();
    // The on-screen buttons (overlay.js) live in the same stage, under the panels (z 70).
    if (caps.overlay && core.overlay) { try { core.overlay.mount(core.stage, { mode: 'device' }); } catch (e) { console.warn('[control bar] overlay mount failed', e); } }
    if (typeof core.onChange === 'function') core.onChange(sync);
    // In-page: the key-up of a Back this bar took never reaches the site either.
    if (core.hostPost) addEventListener('keyup', e => { if (C && C.live && C.live() && isBackKey(e) && backTaken) { backTaken = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
    // The host learns this window runs the Control Bar: it hides its header
    // controls (A14), sends the variants and the TV state.
    post({ cwUi: 'hello', sys: core.sys, build: BUILD });
    return true;
  }

  window.ControlBar = {
    BUILD, ITEMS, DEFAULT_ON, wants, register,
    get active() { return !!C; },
    get state() { return { panel, menu, full, slot, narrow: !!(bar && bar.classList.contains('cb-narrow')), compact: !!(bar && bar.classList.contains('cb-compact')), variants: variants ? variants.list.length : 0, toast: toastFocused() }; },
    back: backStep, sync, fit, toast, receive,
    /* The width the whole bar needs with every label (2026-10-15, the one window rule: a play
       window is never narrower than this where the screen allows). */
    minWidth() {
      if (!bar) return 0;
      const ctl = bar.querySelector('.pill-controls'); if (!ctl) return 0;
      const had = ['cb-narrow', 'cb-compact', 'cb-compact2', 'cb-ckmenu', 'cb-devicons', 'cb-wrap'].filter(c => bar.classList.contains(c));
      bar.classList.remove(...had);
      // Without the small-screen "Status and log" item: on a window this wide the status line shows.
      const st = bar.querySelector('[data-cb="status"]'), was = st ? st.style.display : null;
      if (st) st.style.display = 'none';
      const w = ctlW(ctl) + 14 + 20;
      if (st) st.style.display = was;
      bar.classList.add(...had);
      return w;
    },
    /* An in-page window closed: nothing stays open or held, and the page's body
       loses the bar's classes. wake() is its next opening: the host is told again. */
    sleep() {
      if (!C) return;
      ckUpAll();
      closeMenu(false);
      if (panel) closePanel(false);
      if (full) setFull(false);
      try { C.rewind && C.rewind.stop && C.rewind.stop(); } catch (_) {}
      document.body.classList.remove('cb-on', 'cb-tv');
      variants = null; lastClosed = null;
      sync();
    },
    wake() {
      if (!C) return;
      document.body.classList.add('cb-on');
      sync(); setTimeout(fit, 0);
      post({ cwUi: 'hello', sys: C.sys, build: BUILD });
    },
    get sys() { return C ? C.sys : null; },
    open: id => openPanel(id, $b(id)), close: () => closePanel(true), fullscreen: setFull, focusBar,
    has() { return { pause: !!caps.pause, controls: !!caps.keys, saves: !!caps.saves, bar: !!C }; },
    pause(on) { if (!caps.pause) return false; const was = !!C.paused(); if (was === !!on) return false; C.pause(!!on); sync(); return !!C.paused() === !!on; },
    controls() { if (panel !== 'keys') openPanel('keys', $b('keys')); return true; },
    overlayToggle,
    saves() { if (panel !== 'saves') openPanel('saves', $b('saves')); return true; },
    _quick: quick,
  };
})();

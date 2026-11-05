/*
 * actions.js -- keyboard first, phase 3: the one table of named actions (2026-10-04).
 *
 * The design is docs/tv-controller-support.md, section 5.1 ("One action set")
 * and principle P9: keyboard, remote, gamepad, mouse and touch all call the
 * same named actions. Every key the site answers to is listed here, by the
 * file that owns it (keys.js, nav.js, shortcuts.js), with a label, a group and
 * its default keys. The key handlers look a key up HERE and run the action
 * through HERE, so the help overlay (?), the quick-jump box, the phase 4
 * gamepad adapter and the phase 5 shortcut editor all read one source.
 *
 * Load order: before keys.js. A file that loads earlier than this one can
 * wait for the 'gnw-actions-ready' event on window (nav.js does).
 *
 * ------------------------------------------------------------------ THE API
 *
 *   Actions.register(id, def)  -> the stored action (re-registering an id replaces it)
 *     id       'group.name', e.g. 'player.mute', 'nav.up', 'go.home'
 *     def = {
 *       label:   'Mute'                    shown in ? and quick-jump
 *       group:   'Video player'            heading in ?; one of Actions.GROUPS, or any string
 *       scope:   'player'                  which handler matches it (see SCOPES below);
 *                                          keys clash only within one scope
 *       keys:    ['M', 'Shift+M']          default keys (KEY NAMES below)
 *       run(e, ctx) {...}                  does it; e = the KeyboardEvent, or undefined
 *                                          when run from quick-jump / a pad / code.
 *                                          Return false = "not handled here": the
 *                                          caller leaves the key alone (no preventDefault)
 *       when()    optional: false hides it from ? and quick-jump right now
 *       palette:  false to keep it out of quick-jump (arrows, Back: keys, not commands)
 *       help:     false to keep it out of ?
 *       reserved: true for keys phase 5 must not rebind (Escape/Back, Tab, Enter)
 *     }
 *   Actions.run(id, e, ctx)    -> run's result, or false when there is no such
 *                                 action. Never throws: a failing handler logs.
 *   Actions.keysFor(id)        -> its current keys (array of KEY NAMES)
 *   Actions.list(filter)       -> [{ id, label, group, scope, keys, palette, help, reserved, available }]
 *                                 in registration order; filter = { group, scope }
 *   Actions.onChange(fn)       -> unsubscribe(); fn({ type: 'register'|'keys', id })
 *
 *   For the key handlers, the gamepad adapter and the editor:
 *   Actions.match(e, scope)    -> the id whose key is this event, in that scope, or null.
 *                                 A sequence key ('G H') is never matched here;
 *                                 shortcuts.js runs sequences.
 *   Actions.comboOf(e)         -> this event's KEY NAME ('Ctrl+K', 'Shift+N', '?', 'Space')
 *   Actions.format(key)        -> a key name for people ('Ctrl+K', '↑', 'g then h')
 *   Actions.shortcut(id)       -> its keys for people, joined: 'K / Space'
 *   Actions.setKeys(id, keys)  -> phase 5: change an action's keys (this page load only;
 *                                 saving them is phase 5's job). resetKeys(id) restores.
 *   Actions.byKey(key, scope)  -> every id bound to that key in that scope (clash check)
 *   Actions.addKeys(id, keys)  -> Keys P4: add another input's default keys to an action
 *                                 owned by another file (a pad button, a remote key); kept
 *                                 across a re-register and by resetKeys
 *
 *   Keys P5 (2026-10-04), the viewer's own keys (Settings -> Keyboard & controllers, keybind.js):
 *   Actions.bind(id, keys)     -> { ok, reason }: change an action's keys AND save them for this
 *                                 viewer (localStorage 'gnw.keys.v1'). Refused (ok false) when it
 *                                 would take a reserved key or drop a fixed one (see LOCKED).
 *   Actions.resetKeys(id)      -> back to the defaults, and forgets the saved keys
 *   Actions.resetAll()         -> every action back to its defaults; the saved keys cleared
 *   Actions.isCustom(id)       -> true when the viewer changed this action's keys
 *   Actions.defaultsFor(id)    -> its default keys
 *   Actions.check(id, key)     -> { ok, reason, owner, clashes: [ids] } for adding that key there
 *   Actions.clashes(id, key)   -> the actions that already answer to that key where this one would
 *   Actions.fixedKeys(id)      -> keys of this action no one can remove (Back, Enter, the Play keys)
 *   Actions.editable(id)       -> false for rows listed only for ? (scopes game and info)
 *   Actions.lockedKey(key)     -> the reserved key's owner ('back', 'item.play', 'tile.open', 'tab'), or null
 *   Saved keys are read when this file loads and applied as each action registers, so they
 *   are in force before the first key press. What is saved is the whole key list (keyboard,
 *   remote and pad keys) of each action the viewer changed; the rest keep their defaults.
 *
 * KEY NAMES. Modifiers first, in the order Ctrl+Alt+Shift+Meta, then the key:
 *   - a letter is upper case: 'K' is k with no modifier, 'Shift+K' is Shift+k;
 *   - other printable keys are themselves and never carry Shift ('?', '/', '[',
 *     ','), because Shift is already in the character;
 *   - 'Space' for the space bar; otherwise KeyboardEvent.key ('ArrowUp',
 *     'PageDown', 'Escape', 'Enter');
 *   - remote and media keys (Media*, Browser*, GoBack, XF86*, Channel*,
 *     AudioVolume*) never carry modifiers: a remote has none;
 *   - '#415' is a raw keyCode, for TV remotes that send no key name (415 Play,
 *     10009 Tizen Back, 461 webOS Back);
 *   - 'G H' (a space between) is a sequence: g, then h.
 *   - 'Pad:A' is a gamepad button (Keys P4, gamepad.js): Pad:A / B / X / Y (the
 *     face buttons by the letter printed on them, 2026-10-16: gamepad.js renames a
 *     Nintendo-lettered pad's positions), Pad:LB / RB / LT / RT,
 *     Pad:Select, Pad:Start, Pad:L3 / R3, Pad:Up / Down / Left / Right (D-pad
 *     and left stick), Pad:Home (Guide), and 'Pad:Select+Start' (a chord).
 *     No KeyboardEvent ever matches one; gamepad.js runs them.
 *
 * SCOPE 'pad' (Keys P4): actions only a pad (or a remote's colour keys) runs:
 *   OK, info, the context action. gamepad.js matches them.
 *
 * SCOPES (who matches what):
 *   global   anywhere no text field, game or player has the keys (shortcuts.js)
 *   nav      the arrow keys etc. (nav.js)
 *   tiles    a focused tile, Continue card or open drawer (keys.js: the Play key)
 *   player   the film player's letter keys (keys.js)
 *   media    hardware media keys while the player is open (keys.js)
 *   back     the Back ladder (keys.js); described here, run by key events
 *   game     a running game's window keys (the game owns them; listed for ?)
 *   info     listed for ? only, run by the element that owns the key
 *
 * Sound: none. This file only routes keys.
 */
(function () {
  'use strict';
  if (window.Actions) return;

  const BUILD = '20261004-act3';
  const GROUPS = ['Everywhere', 'Navigation', 'Content page', 'Video player', 'Play window'];

  const actions = new Map();          // id -> action
  const defaults = new Map();         // id -> default keys
  const extras = new Map();           // id -> keys another input added (addKeys), kept across a re-register
  const listeners = new Set();

  const DEVICE_KEY = /^(Media|Browser|GoBack|XF86|Channel|AudioVolume|Launch|Info|Guide|ColorF)/;
  function comboOf(e) {
    if (!e || e.key == null) return '';
    let k = e.key;
    if (k === 'Unidentified' || k === '') return e.keyCode ? '#' + e.keyCode : '';
    if (DEVICE_KEY.test(k)) return k;
    const printable = k.length === 1;                      // Space included: Shift+Space is Space
    const letter = printable && /[a-z]/i.test(k);
    if (k === ' ' || k === 'Spacebar') k = 'Space';
    if (letter) k = k.toUpperCase();
    let m = '';
    if (e.ctrlKey) m += 'Ctrl+';
    if (e.altKey) m += 'Alt+';
    if (e.shiftKey && (!printable || letter)) m += 'Shift+';
    if (e.metaKey) m += 'Meta+';
    if (['Control', 'Alt', 'Shift', 'Meta', 'OS', 'AltGraph'].includes(k)) return k;   // a bare modifier
    return m + k;
  }

  const GLYPH = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'Esc', PageUp: 'Page Up', PageDown: 'Page Down',
    MediaPlayPause: 'Play/Pause', MediaPlay: 'Play', MediaPause: 'Pause', MediaStop: 'Stop', MediaTrackNext: 'Next track', MediaTrackPrevious: 'Previous track',
    MediaFastForward: 'Fast-forward', MediaRewind: 'Rewind', GoBack: 'Back', BrowserBack: 'Browser Back', Backspace: 'Backspace', Delete: 'Delete' };
  const CODE_NAME = { 415: 'Play', 19: 'Pause', 413: 'Stop', 417: 'Fast-forward', 412: 'Rewind', 10009: 'Back (Tizen)', 461: 'Back (webOS)', 4: 'Back (Android)', 10252: 'Play/Pause', 179: 'Play/Pause', 176: 'Next track', 177: 'Previous track',
    403: 'Red', 404: 'Green', 405: 'Yellow', 406: 'Blue', 427: 'Channel +', 428: 'Channel −', 457: 'Info', 10232: 'Previous track', 10233: 'Next track' };
  // Keys P4: remote keys by name, and the gamepad's buttons ('Pad:A', see gamepad.js).
  Object.assign(GLYPH, { ColorF0Red: 'Red', ColorF1Green: 'Green', ColorF2Yellow: 'Yellow', ColorF3Blue: 'Blue', ChannelUp: 'Channel +', ChannelDown: 'Channel −' });
  const PAD_GLYPH = { Up: '↑', Down: '↓', Left: '←', Right: '→' };
  function format(key) {
    if (!key) return '';
    if (key.slice(0, 4) === 'Pad:') return 'Pad ' + key.slice(4).split('+').map(b => PAD_GLYPH[b] || b).join('+');
    if (key.indexOf(' ') > 0) return key.split(' ').map(format).join(' then ');
    if (key[0] === '#') return CODE_NAME[key.slice(1)] || 'Key ' + key.slice(1);
    const parts = key.split('+');
    let last = parts.pop();
    if (last === '' && key.endsWith('+')) last = '+';
    last = GLYPH[last] || last;
    if (parts.length === 0 && last.length === 1 && /[A-Z]/.test(last)) last = last.toLowerCase();   // a plain letter reads as it is pressed
    return parts.concat([last]).join('+');
  }
  /* For people: the keys worth showing. A Shift+letter twin of a plain letter
     and a raw keyCode twin of a named key are the same key on another device;
     they stay bound, but are not repeated in the list. */
  function shown(keys) {
    const set = new Set(keys);
    const out = [];
    for (const k of keys) {
      if (/^Shift\+[A-Z]$/.test(k) && set.has(k.slice(6))) continue;
      if (k[0] === '#' && out.length) continue;
      if (/^(Esc|XF86Back|BrowserBack)$/.test(k) && set.has('Escape')) continue;
      out.push(k);
    }
    return out;
  }
  function shortcut(id) {
    const a = actions.get(id);
    return a ? shown(a.keys).map(format).join(' / ') : '';
  }

  function emit(ev) { for (const fn of Array.from(listeners)) { try { fn(ev); } catch (err) { console.warn('[actions] listener:', err); } } }

  function register(id, def) {
    if (!id || typeof id !== 'string') throw new Error('Actions.register: an id is required');
    def = def || {};
    const a = {
      id,
      label: def.label || id,
      group: def.group || 'Everywhere',
      scope: def.scope || 'global',
      keys: (Array.isArray(def.keys) ? def.keys.slice() : []).concat((extras.get(id) || []).filter(k => !(def.keys || []).includes(k))),
      run: typeof def.run === 'function' ? def.run : null,
      when: typeof def.when === 'function' ? def.when : null,
      palette: def.palette !== false && typeof def.run === 'function',
      help: def.help !== false,
      reserved: !!def.reserved,
      order: actions.has(id) ? actions.get(id).order : actions.size,
    };
    defaults.set(id, a.keys.slice());
    if (saved.has(id)) a.keys = sanitize(id, saved.get(id), a.keys, a.scope);    // Keys P5: the viewer's own keys
    actions.set(id, a);
    emit({ type: 'register', id });
    return a;
  }
  function run(id, e, ctx) {
    const a = actions.get(id);
    if (!a || !a.run) return false;
    try { return a.run(e, ctx); } catch (err) { console.warn('[actions] ' + id + ' failed:', err); return false; }
  }
  function keysFor(id) { const a = actions.get(id); return a ? a.keys.slice() : []; }
  function available(a) { if (!a.when) return true; try { return !!a.when(); } catch (_) { return false; } }
  function list(filter) {
    const f = filter || {};
    return Array.from(actions.values())
      .filter(a => (!f.group || a.group === f.group) && (!f.scope || a.scope === f.scope))
      .sort((x, y) => x.order - y.order)
      .map(a => ({ id: a.id, label: a.label, group: a.group, scope: a.scope, keys: a.keys.slice(), palette: a.palette, help: a.help, reserved: a.reserved, available: available(a) }));
  }
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function byKey(key, scope) { const out = []; for (const a of actions.values()) if ((!scope || a.scope === scope) && a.keys.includes(key)) out.push(a.id); return out; }
  function match(e, scope) {
    const c = comboOf(e);
    if (!c) return null;
    const code = e.keyCode ? '#' + e.keyCode : null;
    let byCode = null;
    for (const a of actions.values()) {
      if (scope && a.scope !== scope) continue;
      if (a.keys.includes(c)) return a.id;
      if (!byCode && code && a.keys.includes(code)) byCode = a.id;
    }
    return byCode;
  }
  function setKeys(id, keys) {
    const a = actions.get(id); if (!a) return false;
    a.keys = Array.isArray(keys) ? keys.slice() : [];
    emit({ type: 'keys', id });
    return true;
  }
  function resetKeys(id) { if (!defaults.has(id)) return false; if (saved.delete(id)) persist(); return setKeys(id, defaults.get(id)); }
  /* Keys P4: another input's DEFAULT keys for an action owned elsewhere (the
     gamepad's 'Pad:B' on 'back', a remote's 'ChannelUp' on 'nav.pageUp').
     Added to the keys and to the defaults (resetKeys keeps them), and kept if
     the owner registers the action again, or registers it later than this call. */
  function addKeys(id, keys) {
    const add = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
    extras.set(id, Array.from(new Set((extras.get(id) || []).concat(add))));
    const a = actions.get(id);
    if (!a) return false;
    // An action the viewer saved keys for keeps that list (they may have moved this very button).
    for (const k of add) { if (!saved.has(id) && !a.keys.includes(k)) a.keys.push(k); const d = defaults.get(id); if (d && !d.includes(k)) d.push(k); }
    emit({ type: 'keys', id });
    return true;
  }

  /* ------------------------------------------------------------ Keys P5: the viewer's own keys */

  /* Reserved keys (the design rules, doc 5.8 and 8): Escape and Backspace (and every remote's
     Back) are Back; Enter is OK / open the details; Tab moves focus; P and the media Play key
     play. No other action can take one, and an action that holds one by default keeps it. */
  const LOCKED = new Map();
  ['Escape', 'Esc', 'Backspace', 'GoBack', 'BrowserBack', 'XF86Back', '#4', '#10009', '#461'].forEach(k => LOCKED.set(k, 'back'));
  ['Enter', 'Shift+Enter', 'Ctrl+Enter'].forEach(k => LOCKED.set(k, 'tile.open'));
  ['Tab', 'Shift+Tab'].forEach(k => LOCKED.set(k, 'tab'));
  ['P', 'MediaPlayPause', 'MediaPlay', '#415', '#10252', '#179'].forEach(k => LOCKED.set(k, 'item.play'));
  const LOCK_LABEL = { back: 'Back', 'tile.open': 'OK (open the details)', tab: 'moving focus (Tab)', 'item.play': 'Play' };
  const lockedKey = k => LOCKED.get(k) || null;
  const isPad = k => typeof k === 'string' && k.slice(0, 4) === 'Pad:';
  // Read-only rows: listed for ?, run by whoever owns the key (a game window, an element).
  const READ_ONLY_SCOPES = new Set(['game', 'info']);
  function editable(id) { const a = actions.get(id); return !!a && !READ_ONLY_SCOPES.has(a.scope); }
  const fixedOf = (dflt, scope) => dflt.filter(k => LOCKED.has(k) || (scope === 'back' && !isPad(k)));
  function fixedKeys(id) { const a = actions.get(id); return fixedOf(defaults.get(id) || [], a ? a.scope : ''); }
  /* The viewer's list, made safe: the fixed keys are always there, no one else's reserved key is. */
  function sanitize(id, list, dflt, scope) {
    const fixed = fixedOf(dflt || [], scope);
    const out = [];
    for (const k of list) if (!out.includes(k) && (!LOCKED.has(k) || fixed.includes(k)) && (scope !== 'back' || isPad(k) || fixed.includes(k))) out.push(k);
    for (const k of fixed) if (!out.includes(k)) out.push(k);
    return out;
  }
  const STORE = 'gnw.keys.v1';
  const saved = new Map();            // id -> the viewer's whole key list for that action
  try {
    const o = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (o && o.keys && typeof o.keys === 'object') for (const [id, ks] of Object.entries(o.keys)) if (Array.isArray(ks)) saved.set(id, ks.filter(k => typeof k === 'string' && k));
  } catch (_) {}
  function persist() {
    try {
      if (!saved.size) localStorage.removeItem(STORE);
      else localStorage.setItem(STORE, JSON.stringify({ v: 1, keys: Object.fromEntries(saved) }));
    } catch (_) {}
  }
  /* Where a key answers. Keyboard: the site's screens (no layer, a drawer, Settings) and the
     film player. Pad buttons: gamepad.js looks in pad, tiles, back, nav, global on the site
     and in pad, media, player, back first in the player, so a site action and a player action
     may share a button (Start: Play on a tile, play / pause in the player). */
  const KB_PLACES = { global: ['site', 'player'], nav: ['site'], tiles: ['site'], pad: ['site', 'player'], back: ['site', 'player'], info: ['site'], player: ['player'], media: ['player'] };
  const PAD_PLACES = { global: ['site'], nav: ['site'], tiles: ['site'], pad: ['site', 'player'], back: ['site', 'player'], player: ['player'], media: ['player'] };
  const places = (scope, key) => (isPad(key) ? PAD_PLACES : KB_PLACES)[scope] || [];
  function clashes(id, key) {
    const a = actions.get(id); if (!a || !key) return [];
    const mine = places(a.scope, key);
    const out = [];
    for (const b of actions.values()) {
      if (b.id === id) continue;
      if (!places(b.scope, key).some(p => mine.includes(p))) continue;
      // The same key, or a key that starts one of their sequences ('G' would end 'G H').
      if (b.keys.includes(key) || (key.indexOf(' ') < 0 && b.keys.some(k => k.indexOf(' ') > 0 && k.split(' ')[0] === key))) out.push(b.id);
    }
    return out;
  }
  function refuse(reason, extra) { return Object.assign({ ok: false, reason }, extra || {}); }
  function check(id, key) {
    const a = actions.get(id);
    if (!a) return refuse('No such action.');
    if (!key) return refuse('No key.');
    if (!editable(id)) return refuse('This row is listed for reference: its keys belong to ' + (a.scope === 'game' ? 'the game window' : 'the control that shows it') + '.');
    if (/^(Control|Alt|Shift|Meta|OS|AltGraph)$/.test(key)) return refuse('A modifier on its own is not a key: hold it with another key.');
    const owner = LOCKED.get(key);
    if (owner && !(defaults.get(id) || []).includes(key)) return refuse(format(key) + ' is reserved for ' + LOCK_LABEL[owner] + '.', { reserved: true, owner });
    if (a.scope === 'back' && !isPad(key)) return refuse('Back keeps Escape, Backspace and the remote’s Back; only gamepad buttons can be added to it.', { reserved: true, owner: 'back' });
    if (key === 'Pad:Select+Start' || key === 'Pad:Home' && a.scope === 'game') return refuse('Select+Start is the way out of a game; it cannot be moved.', { reserved: true });
    if (!isPad(key)) {
      if (a.scope === 'nav' && /^(Ctrl|Alt|Shift|Meta)\+/.test(key)) return refuse('Moving takes a key without Ctrl, Alt, Shift or Meta.');
      if (a.scope === 'player' && /^(Ctrl|Alt|Meta)\+/.test(key)) return refuse('The player’s keys work without Ctrl, Alt or Meta (Shift is fine).');
      if (/^(Ctrl|Meta)\+[WTNQ]$/.test(key)) return refuse(format(key) + ' belongs to the browser.');
    }
    return { ok: true, clashes: clashes(id, key) };
  }
  function bind(id, keys) {
    const a = actions.get(id);
    if (!a) return refuse('No such action.');
    if (!editable(id)) return refuse('This row cannot be changed.');
    const list = Array.isArray(keys) ? keys.filter(k => typeof k === 'string' && k) : [];
    const dflt = defaults.get(id) || [];
    for (const k of list) { const o = LOCKED.get(k); if (o && !dflt.includes(k)) return refuse(format(k) + ' is reserved for ' + LOCK_LABEL[o] + '.', { reserved: true, owner: o }); }
    const clean = sanitize(id, list, dflt, a.scope);
    if (a.scope === 'back' && dflt.some(isPad) && !clean.some(isPad)) return refuse('Back needs at least one gamepad button.');
    a.keys = clean;
    const same = clean.length === dflt.length && clean.every((k, i) => k === dflt[i]);
    if (same) saved.delete(id); else saved.set(id, clean.slice());
    persist();
    emit({ type: 'keys', id });
    return { ok: true };
  }
  function resetAll() {
    const ids = Array.from(saved.keys());
    saved.clear(); persist();
    for (const id of ids) { const a = actions.get(id); if (a) { a.keys = (defaults.get(id) || []).slice(); emit({ type: 'keys', id }); } }
    return ids.length;
  }
  const isCustom = id => saved.has(id);
  const defaultsFor = id => (defaults.get(id) || []).slice();

  window.Actions = { BUILD, GROUPS, register, run, keysFor, list, onChange, match, comboOf, format, shortcut, setKeys, resetKeys, byKey, addKeys, shownKeys: shown,
    bind, resetAll, isCustom, defaultsFor, check, clashes, fixedKeys, editable, lockedKey, LOCK_LABEL, STORE };
  try { window.dispatchEvent(new Event('gnw-actions-ready')); } catch (_) {}
})();

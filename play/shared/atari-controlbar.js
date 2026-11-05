/*
 * play/shared/atari-controlbar.js -- the four Atari play pages' adapter for THE CONTROL BAR
 * (play/shared/control-bar.js, the play interface design), 2026-10-11.
 *
 * 2026-10-11: move the Ataris onto the Control Bar now, ahead of the NES. One file for
 * the 2600, 5200, 7800 and Lynx, loaded by each page after control-bar.js, as the Game Boy's
 * adapter is (play/gameboy/app.js "THE CONTROL BAR"). The split: the pages, cores and input are
 * the Atari side's; this file and the pages' "CONTROL BAR HOOKS" block are the Control Bar
 * side's.
 *
 * WHAT IT READS, all of it already published by each page:
 *   window.__atariPage      { sys, label, title, coreId, slot, audio, canvas, rotate? }  (the hooks)
 *   window.__continue       save() / restore(rec): the core's state ABI, with the page's own
 *                           core-hash and size checks (a save from another core is refused)
 *   window.__gnwPause(on)   holds the machine (the player's pause, a panel's hold, rewind)
 *   window.__atari<sys>     .core.powerOn(): Reset
 *   window.__cwOverlay      the on-screen buttons; its strip definition IS the console's switch
 *                           list, so the bar's console keys and the Settings switches are read
 *                           from play/shared/overlays/<sys>.json, never written twice
 *
 * WHERE EVERY OLD CONTROL WENT (A14):
 *   header Variant picker (variants.js)  -> the Variant item (host-bridge sends the list)
 *   status line key list (#keys)         -> the Keys panel's Keyboard tab (moved, not copied)
 *   status line core / scheme / lines    -> unchanged, hidden in the window as before
 *   no bar, no Pause / Reset / Saves     -> the full bar (Pause, Reset, Rewind, Saves, Keys,
 *                                           Help, Screenshot, Mute, Full screen, Settings)
 *   console hold switches (keys only)    -> console keys in the bar (2600 Game Reset / Game
 *                                           Select; 7800 those and Pause; 5200 Start / Pause /
 *                                           Reset; Lynx Option 1 / Pause / Option 2), held
 *                                           while pressed, and the bottom strip (A8)
 *   console toggles (strip, F4)          -> Settings -> Console switches (a remote reaches
 *                                           them there; the strip is pointer-only)
 *   Lynx R (turn)                        -> the Rotate item
 *   Accessory                            -> none in this release (the Atari lead's call: the
 *                                           pages drive the joystick only; a later round adds
 *                                           __atariPage.accessory and this file shows it)
 *
 * SAVES live in IndexedDB "atari-saves" / "slots", key <sys>:<slot id>, eight slots. A state is
 * the page's own __continue.save() record (the full context and its core hash), gzipped.
 * REWIND is written here once over the same ABI: a snapshot every 250 ms, gzipped, kept for
 * about 15 s and never more than 48 MB (the Lynx's context is 2.7 MB raw).
 *
 * SOUND: none. Mute only stops the page's own samples reaching its own audio graph.
 */
(function () {
  'use strict';
  const CB = window.ControlBar;
  const SYS_OF = { atari2600: 'a2600', atari5200: 'a5200', atari7800: 'a7800', atarilynx: 'alynx' };
  const SYS = SYS_OF[document.documentElement.getAttribute('data-system')] || null;
  const tile = new URLSearchParams(location.search).get('tile') === '1';
  if (!CB || !SYS || tile || !CB.wants(SYS)) return;

  const LABEL = { a2600: 'Atari 2600', a5200: 'Atari 5200', a7800: 'Atari 7800', alynx: 'Atari Lynx' }[SYS];
  const page = () => window.__atariPage || null;
  const machine = () => window['__' + document.documentElement.getAttribute('data-system')] || null;
  const $ = id => document.getElementById(id);
  const MUTE_KEY = 'atari.muted';
  const listeners = [];
  const notify = () => { for (const fn of listeners) { try { fn(); } catch (_) {} } };

  /* ------------------------------------------------------------ the three holds */
  const hold = { user: false, panel: false, rewind: false };
  let applied = false;          // what we last asked __gnwPause for
  function apply() {
    const want = hold.user || hold.panel || hold.rewind;
    if (want === applied) return;
    try { if (window.__gnwPause) window.__gnwPause(want); } catch (_) {}
    applied = want;
  }

  /* ------------------------------------------------------------ mute */
  let muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (_) {}
  let wrappedAudio = null;
  function wrapAudio() {
    const P = page(), A = P && P.audio;
    if (!A || A === wrappedAudio) return;
    const push = A.push.bind(A);
    A.push = s => { if (!muted) push(s); };
    wrappedAudio = A;
  }

  /* ------------------------------------------------------------ gzip helpers */
  async function gz(u8) {
    if (typeof CompressionStream !== 'function') return { raw: u8 };
    const s = new Blob([u8]).stream().pipeThrough(new CompressionStream('gzip'));
    return { gz: new Uint8Array(await new Response(s).arrayBuffer()) };
  }
  async function gunz(rec) {
    if (rec.raw) return rec.raw;
    const s = new Blob([rec.gz]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  const recBytes = r => (r.gz || r.raw).length;

  /* ------------------------------------------------------------ rewind, written here once */
  const RW_EVERY = 250, RW_SECONDS = 15, RW_MAX_BYTES = 48 * 1024 * 1024;
  let ring = [], ringBytes = 0, rwT = 0, rwBusy = false, stepT = 0;
  function canState() { try { return !!(window.__continue && window.__continue.ready && machine() && machine().core); } catch (_) { return false; } }
  async function capture() {
    if (rwBusy || hold.user || hold.panel || hold.rewind || document.hidden) return;
    if (!window.__continue || !window.__continue.ready()) return;
    rwBusy = true;
    try {
      const r = window.__continue.save();
      const z = await gz(r.state);
      ring.push({ z, core: r.core }); ringBytes += recBytes(z);
      while (ring.length > RW_SECONDS * 1000 / RW_EVERY || ringBytes > RW_MAX_BYTES) { const o = ring.shift(); ringBytes -= recBytes(o.z); }
    } catch (_) { /* a state the core would not give: no history this tick */ }
    rwBusy = false;
  }
  function rewindClear() { ring = []; ringBytes = 0; }
  async function stepBack() {
    if (rwBusy || !ring.length) return;
    rwBusy = true;
    try {
      const r = ring.pop(); ringBytes -= recBytes(r.z);
      const st = await gunz(r.z);
      window.__continue.restore({ state: st, core: r.core });   // the page repaints the restored frame
    } catch (_) {}
    rwHud();
    rwBusy = false;
  }
  /* THE VISIBLE REWIND (2026-10-14: "on the Game Boy I can see it rolling back like a VHS
   * tape"). The Game Boy's look, carried over: VHS scan bands over the picture and a
   * "◄◄ REW 12.3s" readout of the history left (play/gameboy/index.html #rewindScan, #rewindHud).
   * The bands follow the canvas's on-screen box, so they fit the TV artwork, full screen and the
   * Lynx's turn alike. Both are pointer-free and shown only while Rewind is held. */
  let rwScan = null, rwText = null;
  function rwHud() { if (rwText) rwText.textContent = '◄◄ REW  ' + (ring.length * RW_EVERY / 1000).toFixed(1) + 's'; }
  function rwPlace() {
    if (!rwScan) return;
    try {
      const c = (page() && page().canvas) || $('screen'), b = c.getBoundingClientRect();
      Object.assign(rwScan.style, { left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', height: b.height + 'px' });
      // the readout sits inside the top of the picture: a fixed offset can fall under the bar
      Object.assign(rwText.style, { left: (b.left + b.width / 2) + 'px', top: (b.top + 10) + 'px' });
    } catch (_) {}
  }
  function rwVisual(on) {
    if (on && !rwScan) {
      rwScan = document.createElement('div'); rwScan.id = 'acbRewindScan'; rwScan.setAttribute('aria-hidden', 'true');
      rwText = document.createElement('div'); rwText.id = 'acbRewindHud'; rwText.setAttribute('aria-hidden', 'true');
      document.body.appendChild(rwScan); document.body.appendChild(rwText);
    }
    if (on) { rwPlace(); rwHud(); }
  }
  function rewStart() {
    if (hold.rewind || !canState()) return;
    hold.rewind = true; apply();
    rwVisual(true);
    stepBack();
    stepT = setInterval(stepBack, 110);
    document.body.classList.add('rewinding');
    notify();
  }
  function rewStop() {
    if (!hold.rewind) return;
    clearInterval(stepT); stepT = 0;
    hold.rewind = false; apply();
    document.body.classList.remove('rewinding');
    notify();
  }

  /* ------------------------------------------------------------ keys: Ctrl+Left, and no key left held
   * (2026-10-14: "the Ctrl+Left key does not activate the rewind", and a direction stayed
   * held after a rewind).
   *
   * CTRL+LEFT is Rewind, held, as in the Game Boy and Game & Watch windows: release Left or Ctrl
   * to resume. Window capture phase, after the Control Bar's own Ctrl shortcuts (Ctrl+P, S, L ...,
   * registered first), before the page's key map, which would read it as a joystick Left.
   * While Ctrl is held no KEY-DOWN reaches the game; key-ups always go through, so a direction
   * that was down before Ctrl was pressed is still let go when its key comes up.
   *
   * NOTHING LEFT HELD. Each page rebuilds the core's input from the keys it holds on every frame
   * (tick: setJoystick / setStick / setButtons before runFrame), so a restored state's input is
   * overwritten on the first frame after a rewind or a load. What can still stick is the PAGE's own
   * idea of a held key when its key-up never arrives here: focus leaving the play window (a click
   * on the site around it, a host menu, Alt+Tab) sends that key-up somewhere else. The 5200 page
   * clears on blur; the 2600, 7800 and Lynx did not. So every key seen going down is tracked, and
   * on blur or a hidden tab each one still down gets its key-up delivered to the page. A rewind or
   * a load needs nothing more: the next frame sends the core what the page holds. */
  const physDown = new Map();     // code -> key, for every key-down that reached this window
  let ctrlRewind = false;
  function sendUp(code, key) {
    try {
      const ev = new KeyboardEvent('keyup', { key, code, bubbles: true, cancelable: true, composed: true });
      Object.defineProperty(ev, '__acbRelease', { value: true });
      (document.body || document).dispatchEvent(ev);
    } catch (_) {}
  }
  function releaseAll() { const all = Array.from(physDown); physDown.clear(); for (const [code, key] of all) sendUp(code, key); }
  function wireKeys() {
    addEventListener('keydown', e => {
      if (e.__acbRelease) return;
      if (e.code) physDown.set(e.code, e.key);
      if (!e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.code === 'ArrowLeft') {
        e.preventDefault(); e.stopImmediatePropagation();
        if (!e.repeat && !hold.rewind) { ctrlRewind = true; rewStart(); }
        return;
      }
      if (/^Control/.test(e.code)) return;          // Ctrl itself: no game uses it
      e.stopImmediatePropagation();                   // a Ctrl chord is never game input
    }, true);
    addEventListener('keyup', e => {
      if (e.__acbRelease) return;
      physDown.delete(e.code);
      if (ctrlRewind && (e.code === 'ArrowLeft' || e.key === 'Control')) { ctrlRewind = false; rewStop(); }
    }, true);
    addEventListener('blur', () => { if (ctrlRewind) { ctrlRewind = false; rewStop(); } releaseAll(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { if (ctrlRewind) { ctrlRewind = false; rewStop(); } releaseAll(); } });
  }

  /* ------------------------------------------------------------ saves */
  const DB = 'atari-saves', ST = 'slots';
  function idb() { return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  async function idbGet(k) { const d = await idb(); return new Promise((res, rej) => { const q = d.transaction(ST).objectStore(ST).get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
  async function idbPut(k, v) { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction(ST, 'readwrite'); t.objectStore(ST).put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
  const slotKey = () => SYS + ':' + ((page() && page().slot) || 'file');
  async function slots() { const a = await idbGet(slotKey()); return Array.isArray(a) ? a : []; }
  async function putSlots(a) { await idbPut(slotKey(), a); }
  function need() { if (!canState() || !window.__continue.ready || !machine().core) throw new Error('nothing is running'); }
  function thumb() {
    try {
      const c = (page() && page().canvas) || $('screen');
      const t = document.createElement('canvas'), w = 192, h = Math.round(w * 3 / 4);
      t.width = w; t.height = h;
      const g = t.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, w, h);
      return t.toDataURL('image/png');
    } catch (_) { return null; }
  }
  /* The game hash a .cwsave carries: the slot id's content hash (a2600-x<sha12> ...), else none. */
  function gameHash() { const s = (page() && page().slot) || ''; const m = /-x([0-9a-f]{12})$/.exec(s); return m ? m[1] : null; }

  /* ------------------------------------------------------------ console switches (from the overlay's strip) */
  function stripDef() { try { const o = window.__cwOverlay; return (o && o.def && o.def.strip) || []; } catch (_) { return []; } }
  const ICON_FOR = { reset: 'switch', pause: 'pause', select: 'switch', start: 'play', opt1: 'switch', opt2: 'switch' };
  const LABEL_FOR = { a2600: { reset: 'Game Reset', select: 'Game Select' }, a7800: { reset: 'Game Reset', select: 'Game Select', pause: 'Console Pause' },
    a5200: { reset: 'Game Reset', pause: 'Game Pause' }, alynx: { pause: 'Lynx Pause' } }[SYS] || {};
  function consoleKeys(def) {
    return (def || []).filter(c => c.kind !== 'toggle' && c.input).map(c => ({ id: c.id, label: LABEL_FOR[c.id] || c.label, icon: ICON_FOR[c.id] || 'switch', key: keyName(c.input) }));
  }
  function keyName(code) { return String(code).replace(/^Key/, '').replace(/^Digit/, ''); }
  function sendInput(input, down) {
    try { if (window.CwOverlay && CwOverlay.sendKey) { CwOverlay.sendKey(input, down); return; } } catch (_) {}
  }
  /* Toggles (difficulty, colour / B&W): a Settings row each, through the overlay's own call. */
  function switchRows(def) {
    const rows = [];
    for (const c of (def || []).filter(x => x.kind === 'toggle')) {
      const r = document.createElement('div'); r.className = 'cb-row acb-switch';
      const lab = document.createElement('span'); lab.className = 'acb-lab'; lab.textContent = c.label.replace(/\.$/, '');
      const seg = document.createElement('span'); seg.className = 'acb-seg'; seg.setAttribute('role', 'radiogroup'); seg.setAttribute('aria-label', c.label);
      (c.states || ['Off', 'On']).forEach((name, i) => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = name; b.dataset.on = String(i);
        b.addEventListener('click', () => { setToggle(c, i === 1); paintSwitches(); });
        seg.appendChild(b);
      });
      r.appendChild(lab); r.appendChild(seg); r.__acb = c;
      rows.push(r);
    }
    return rows;
  }
  function toggleCall(c) { try { const o = window.__cwOverlay; return o && o.calls && o.calls[c.call]; } catch (_) { return null; } }
  function getToggle(c) { const k = toggleCall(c); try { return !!(k && k.get(c.arg)); } catch (_) { return false; } }
  function setToggle(c, on) { const k = toggleCall(c); try { if (k) k.set(c.arg, on); } catch (_) {} try { window.__cwOverlay._paintToggles && window.__cwOverlay._paintToggles(); } catch (_) {} }
  function paintSwitches() {
    for (const r of document.querySelectorAll('.acb-switch')) {
      const on = getToggle(r.__acb);
      r.querySelectorAll('button').forEach(b => { const sel = (b.dataset.on === '1') === on; b.setAttribute('aria-pressed', sel ? 'true' : 'false'); b.classList.toggle('on', sel); });
    }
  }

  /* ------------------------------------------------------------ full screen (A13) */
  const ART_CLASSES = [['screenBox', ['atari-tv-crop', 'has-art']], ['art', ['atari-art-frame']], ['bezel', ['atari-art']], ['screen', ['atari-screen']]];
  let artSaved = null;
  function fullscreen(on) {
    if (on) {
      artSaved = ART_CLASSES.map(([id, cls]) => [id, cls.filter(c => $(id) && $(id).classList.contains(c))]);
      for (const [id, cls] of artSaved) for (const c of cls) $(id).classList.remove(c);
    } else if (artSaved) {
      for (const [id, cls] of artSaved) for (const c of cls) $(id).classList.add(c);
      artSaved = null;
    }
    try { window.__cwOverlay && window.__cwOverlay._layout && window.__cwOverlay._layout(); } catch (_) {}
  }

  /* ------------------------------------------------------------ the core (doc section 7) */
  const CSS = `
    /* The bar has its own band at the top of the window: the picture is never under it, at
       any size (the phone-size rule, 2026-10-11), and the picture's height budget pays for it. */
    body.cb-on main { padding-top:58px; }
    body.cb-on.embedded #screenBox.has-art { width:min(96vw, calc((100vh - 96px - var(--cw-ov-bottom, 0px)) * var(--at-tv-aspect-num))); }
    body.cb-on.embedded #screenBox:not(.has-art) canvas#screen { width:min(96vw, calc((100vh - 96px - var(--cw-ov-bottom, 0px)) * 4 / 3)); }
    body.cb-on #bar #keys { display:none; }
    body.cb-full main { padding:58px 6px 6px; background:#000; }
    body.cb-full #bezel { display:none !important; }
    body.cb-full #screenBox:not(.has-art) canvas#screen { width:min(99vw, calc((100vh - 70px - var(--cw-ov-bottom, 0px)) * 4 / 3)); box-shadow:none; }
    .cb-panel .acb-keys { width:min(100%, 600px); color:#c9cdd4; font-size:13px; line-height:2; text-align:center; }
    .cb-panel .acb-keys #keys { display:inline !important; color:inherit; font-size:13px; }
    .cb-panel .acb-keys kbd { border:1px solid #2f343d; border-bottom-width:2px; border-radius:6px; background:#15181d; color:#e6e8ec; padding:1px 6px; font:600 11.5px ui-monospace,Consolas,monospace; }
    .cb-set .acb-switch { justify-content:space-between; }
    .cb-set .acb-lab { color:#9aa1ad; font-size:12.5px; min-width:9em; }
    .cb-set .acb-seg { display:inline-flex; gap:4px; padding:3px; background:#101215; border:1px solid #2a2e36; border-radius:999px; }
    .cb-set .acb-seg button { background:transparent; border:0; border-radius:999px; color:#9aa1ad; font:inherit; font-size:12px; font-weight:600; padding:5px 12px; cursor:pointer; }
    .cb-set .acb-seg button.on { background:rgba(155,225,93,.18); color:#eaffd6; }
    .cb-set .acb-seg button:focus-visible { outline:none; box-shadow:0 0 0 2px rgba(155,225,93,.55); }
    /* The visible rewind (rwVisual above): the Game Boy window's bands and readout. */
    #acbRewindScan { position:fixed; z-index:45; display:none; overflow:hidden; pointer-events:none; }
    body.rewinding #acbRewindScan { display:block; }
    #acbRewindScan::after {
      content:""; position:absolute; left:0; right:0; top:-20%; bottom:-20%;
      background-image:repeating-linear-gradient(0deg,
        rgba(255,255,255,.20) 0, rgba(255,255,255,.20) 4px,
        transparent 4px, transparent 18px);
      mix-blend-mode:screen;
      animation:acb-scan-bands .16s steps(2) infinite;
    }
    @keyframes acb-scan-bands { 0%{transform:translateY(0)} 50%{transform:translateY(9px)} 100%{transform:translateY(-6px)} }
    @media (prefers-reduced-motion: reduce) { #acbRewindScan::after { animation:none; } }
    #acbRewindHud {
      position:fixed; top:66px; left:50%; transform:translateX(-50%); z-index:62;   /* rwPlace() moves it onto the picture */
      display:none; white-space:nowrap; pointer-events:none;
      background:rgba(16,18,22,.82); border:1px solid #2a2e36; border-radius:8px;
      color:#ffd27a; font:700 13px system-ui,sans-serif; letter-spacing:.08em;
      padding:5px 12px; font-variant-numeric:tabular-nums;
      box-shadow:0 8px 26px rgba(0,0,0,.5);
    }
    body.rewinding #acbRewindHud { display:block; }
  `;

  let registered = false;
  async function start() {
    // The page's hooks, its overlay (the switch list) and its core arrive asynchronously.
    for (let i = 0; i < 200 && !(page() && window.__continue && window.__gnwPause); i++) await new Promise(r => setTimeout(r, 50));
    for (let i = 0; i < 60 && !window.__cwOverlay; i++) await new Promise(r => setTimeout(r, 50));
    if (!page()) { console.warn('[atari bar] the page published no __atariPage; the Control Bar is off'); return; }
    const st = document.createElement('style'); st.id = 'acb-css'; st.textContent = CSS; document.head.appendChild(st);
    const def = stripDef();
    const keysBox = document.createElement('div'); keysBox.className = 'acb-keys';
    const keysLine = $('keys'); if (keysLine) keysBox.appendChild(keysLine);
    const hasRotate = !!(page() && typeof page().rotate === 'function');
    const core = {
      sys: SYS, label: LABEL, padSys: SYS,
      stage: document.querySelector('main'),
      caps: () => ({
        pause: true, reset: true, rewind: true, saves: { slots: 8, cols: 4, shot: SYS === 'alynx' ? '160/102' : '4/3' }, transfer: true,
        lastClosed: true, screenshot: true, mute: true, keys: true, help: true, fullscreen: true, settings: true,
        variant: true, rotate: hasRotate, overlay: !!window.__cwOverlay,
        consoleKeys: consoleKeys(def),
      }),
      title: () => (page() && page().title) || '',
      paused: () => hold.user,
      pause(on) { const was = hold.user; hold.user = !!on; apply(); notify(); return was !== hold.user; },
      hold(on) { hold.panel = !!on; if (on) rewStop(); apply(); },
      reset() {
        const m = machine(); if (!m || !m.core) throw new Error('nothing is running');
        rewStop(); m.core.powerOn(); rewindClear();
      },
      rewind: { start: rewStart, stop: rewStop, active: () => hold.rewind },
      muted: () => muted,
      setMuted(on) { muted = !!on; try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (_) {} wrapAudio(); notify(); },
      states: {
        list: slots,
        async save(i) {
          need();
          const r = window.__continue.save();
          const arr = await slots();
          arr[i] = { ts: Date.now(), state: (await gz(r.state)), core: r.core, thumb: thumb(), thumbWhy: '' };
          await putSlots(arr);
          return arr[i];
        },
        async load(i) {
          need();
          const s = (await slots())[i];
          if (!s) throw new Error(`slot ${i + 1} is empty`);
          const st = await gunz(s.state);
          rewStop();
          window.__continue.restore({ state: st, core: s.core });   // the page refuses another core's save, with its reason
          rewindClear();                                            // a load starts a new timeline
          notify();
        },
        async remove(i) { const a = await slots(), rec = a[i] || null; a[i] = null; await putSlots(a); return rec; },
        async put(i, rec) { const a = await slots(); a[i] = rec; await putSlots(a); },
        async exportOf(i) {
          const s = (await slots())[i];
          if (!s) throw new Error(`slot ${i + 1} is empty`);
          return { bytes: await gunz(s.state), meta: { ts: s.ts, thumb: s.thumb || null } };
        },
        async importInto(i, bytes, meta) {
          need();
          const P = page();
          const arr = await slots();
          arr[i] = { ts: (meta && meta.ts) || Date.now(), state: await gz(new Uint8Array(bytes)), core: (meta && meta.core) || (P && P.coreId) || null, thumb: (meta && meta.thumb) || null, thumbWhy: '' };
          await putSlots(arr);
        },
      },
      identity() { const P = page(); return { sys: SYS, game: P && P.slot, title: (P && P.title) || '', gameHash: gameHash(), core: (P && P.coreId) || null, device: SYS }; },
      continueRestore: rec => { const ok = window.__continue.restore(rec); rewindClear(); notify(); return ok; },
      async screenshot() { try { return ((page() && page().canvas) || $('screen')).toDataURL('image/png'); } catch (_) { return null; } },
      keysContent: () => keysBox,
      settings: () => { const rows = switchRows(def); return rows.length ? [{ section: 'Console switches', nodes: rows }] : []; },
      refreshSettings: paintSwitches,
      fullscreen,
      rotate() { try { page().rotate(); } catch (_) {} },
      consoleKey(id, down) { const c = def.find(x => x.id === id); if (c) sendInput(c.input, down); },
      onChange(fn) { listeners.push(fn); },
    };
    if (window.__cwOverlay) core.overlay = window.__cwOverlay;
    registered = CB.register(core);
    if (!registered) return;
    wrapAudio();
    wireKeys();
    setInterval(() => { wrapAudio(); capture(); }, RW_EVERY);
    window.__atariBar = { core, get ring() { return { n: ring.length, bytes: ringBytes }; }, rewindClear };
  }
  start();
})();

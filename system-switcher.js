/*
 * system-switcher.js -- the System Switcher (30 Oct 2026).
 *
 * The picture for stepping through the game systems with the shoulders (LB / RB) or the keys
 * [ ] and , . on the tile wall. A dark panel, centred over the wall, shows the systems as a
 * carousel: the chosen one in the middle, larger and ringed, two either side, the rest rotating
 * into view; L and R bumper marks at the ends say the shoulders move it.
 *
 *   The first press shows the panel already one system on from the one the wall shows now
 *   (several systems, All Consoles or a collection: from All Consoles, where the shoulders have
 *   always started; 31 Oct: one press, one system). Each further press or Left / Right moves it
 *   one system; a held shoulder or key repeats at one steady rate both ways (steer). A second after
 *   the last move the choice is applied, as the shoulders always did (shortcuts.js stepApply), and
 *   the panel fades. A or Enter applies at once; B or Back closes it with nothing changed. A press
 *   outside the panel closes it, nothing changed.
 *
 *   NO MOUSE OR TOUCH ON THE PANEL (2 Nov: "remove clicking ... it will never be responsive on that
 *   screen"). Clicking L or R, clicking or tapping a system and the mouse wheel over the panel used
 *   to move or pick; they do nothing now. The L and R marks and the systems are pictures, not
 *   buttons. Keys and the controller drive it; a click or tap outside still closes it (harmless:
 *   the panel only ever opens from a key or the pad).
 *
 * The systems and their order are the shoulders' own (shortcuts.js systemKeys: All Consoles,
 * then the Systems menu's tiles), and each picture is that tile's picture. shortcuts.js hands
 * every games step here (GnwSwitcher.step); the libraries step (Movies on) is not shown here.
 * The panel never takes the focus: its keys are caught here, before every other listener (this
 * file loads before actions.js and keys.js), and only while it is open. gamepad.js's A comes in
 * through GnwSwitcher.isOpen / apply; the pad's B, D-pad and shoulders arrive as their keys.
 * Screen readers hear the chosen system ("Game Boy, 3 of 12") from a polite live region.
 * Reduced motion: no slide, no fade. SOUND: none.
 */
(function () {
  'use strict';
  if (window.GnwSwitcher) return;

  const WAIT_MS = 1000;              // the shoulders' second (29 Oct)
  const VISIBLE = 5;                 // icons in view at a time (the design)
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const CSS = `
  #gk-switcher {
    --s: 84px; --g: 16px; --k: 1.5; --b: 40px; --p: 22px; --lbf: 14px;
    position: fixed; left: 50%; top: 50%; z-index: 9000;
    display: flex; align-items: center; gap: 14px;
    padding: var(--p); border-radius: 16px;
    background: #1c2024; color: #e8ebef;
    border: 1px solid rgba(255,255,255,.08);
    box-shadow: 0 18px 50px rgba(0,0,0,.55), 0 2px 8px rgba(0,0,0,.4);
    opacity: 0; visibility: hidden; transform: translate(-50%, -50%) scale(.96);
    transition: opacity .18s ease, transform .18s ease, visibility 0s linear .18s;
    -webkit-user-select: none; user-select: none; touch-action: manipulation;
  }
  #gk-switcher.open { opacity: 1; visibility: visible; transform: translate(-50%, -50%); transition: opacity .14s ease, transform .14s ease, visibility 0s; }
  #gk-switcher .gksw-track { position: relative; flex: none;   /* not clipped: the icons out of view are see-through */
    width: calc(var(--s) * var(--k) + 4 * var(--s) + 4 * var(--g));
    height: calc(var(--s) * var(--k) + 16px + var(--lbf) * 2.5 + 6px); }
  #gk-switcher .gksw-it { position: absolute; left: 50%; top: 0; width: var(--s); height: 100%; margin: 0 0 0 calc(var(--s) / -2);
    padding: 0; border: 0; background: none; color: inherit; font: inherit; cursor: default; -webkit-tap-highlight-color: transparent;
    transition: transform .22s ease, opacity .22s ease; }
  #gk-switcher .gksw-it.far { opacity: 0; visibility: hidden; pointer-events: none; }
  #gk-switcher .gksw-it.jump, #gk-switcher .gksw-it.jump .gksw-ic, #gk-switcher .gksw-it.jump .gksw-lb { transition: none; }
  #gk-switcher .gksw-ic { position: absolute; left: 0; top: calc(var(--s) * (var(--k) - 1) / 2 + 8px); width: var(--s); height: var(--s);
    box-sizing: border-box; display: flex; align-items: center; justify-content: center;
    border-radius: 12px; background: #2a3036; border: 2px solid transparent;
    transition: transform .22s ease, border-color .22s ease, background-color .22s ease, box-shadow .22s ease; }
  #gk-switcher .gksw-ic img { width: 84%; height: 84%; object-fit: contain; display: block; pointer-events: none; }
  #gk-switcher .gksw-ic svg { width: 58%; height: 58%; color: #a855f7; }
  #gk-switcher .gksw-lb { position: absolute; left: 50%; top: calc(var(--s) * (var(--k) - 1) / 2 + 8px + var(--s) + 6px);
    width: calc(var(--s) + var(--g)); margin-left: calc((var(--s) + var(--g)) / -2);
    font-size: var(--lbf); line-height: 1.25; text-align: center; color: #c9ced6; overflow-wrap: break-word;
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; transition: transform .22s ease, color .22s ease; }
  #gk-switcher .gksw-it.sel .gksw-ic { transform: scale(var(--k)); background: #343b43; border-color: #ffffff;
    box-shadow: 0 0 0 1px rgba(255,255,255,.25), 0 6px 18px rgba(0,0,0,.45); }
  #gk-switcher .gksw-it.sel .gksw-lb { transform: translateY(calc(var(--s) * (var(--k) - 1) / 2)); color: #fff;
    width: calc(var(--s) * var(--k) + 2 * var(--g)); margin-left: calc((var(--s) * var(--k) + 2 * var(--g)) / -2); }
  #gk-switcher .gksw-it.side { opacity: .82; }
  #gk-switcher .gksw-it.edge { opacity: .55; }
  #gk-switcher .gksw-bump { flex: none; position: relative; width: var(--b); height: calc(var(--b) * .72); padding: 0; margin: 0;
    border: 0; border-radius: 10px 10px 6px 6px; background: #a855f7; color: #fff; cursor: default;
    display: flex; align-items: center; justify-content: center; box-sizing: border-box;
    font-family: inherit; font-weight: 700; font-size: calc(var(--b) * .38); line-height: 1; -webkit-tap-highlight-color: transparent;
    box-shadow: 0 2px 6px rgba(0,0,0,.35); }
  #gk-switcher .gksw-l { border-top-left-radius: calc(var(--b) * .45); margin-left: calc(var(--b) * .3 + 3px); }
  #gk-switcher .gksw-r { border-top-right-radius: calc(var(--b) * .45); margin-right: calc(var(--b) * .3 + 3px); }
  #gk-switcher .gksw-bump svg { position: absolute; top: 50%; width: calc(var(--b) * .3); height: calc(var(--b) * .5); margin-top: calc(var(--b) * -.25);
    fill: none; stroke: #a855f7; stroke-width: 2.2; stroke-linecap: round; }
  #gk-switcher .gksw-l svg { right: 100%; margin-right: 3px; }
  #gk-switcher .gksw-r svg { left: 100%; margin-left: 3px; }
  #gk-switcher-live { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

  body.gnw-tv #gk-switcher { --s: 112px; --g: 22px; --b: 52px; --p: 28px; --lbf: 18px; gap: 18px; border-radius: 16px; }
  @media (max-width: 600px) {
    #gk-switcher { --s: 44px; --g: 6px; --b: 28px; --p: 8px; --lbf: 11px; gap: 4px; border-radius: 12px; }
    #gk-switcher .gksw-ic { border-radius: 9px; }
  }
  @media (max-width: 384px) { #gk-switcher { --s: 38px; --g: 5px; --b: 24px; --p: 6px; gap: 3px; } }

  :root[data-theme="light"] #gk-switcher { background: #f2f4f7; color: #1d232b; border-color: rgba(20,30,45,.12);
    box-shadow: 0 18px 50px rgba(20,30,45,.28), 0 2px 8px rgba(20,30,45,.18); }
  :root[data-theme="light"] #gk-switcher .gksw-ic { background: #ffffff; box-shadow: 0 1px 3px rgba(20,30,45,.14); }
  :root[data-theme="light"] #gk-switcher .gksw-it.sel .gksw-ic { background: #ffffff; border-color: #06b6d4; box-shadow: 0 0 0 1px rgba(6,182,212,.35), 0 6px 18px rgba(20,30,45,.22); }
  :root[data-theme="light"] #gk-switcher .gksw-lb { color: #4a5360; }
  :root[data-theme="light"] #gk-switcher .gksw-it.sel .gksw-lb { color: #11161c; }

  @media (prefers-reduced-motion: reduce) {
    #gk-switcher, #gk-switcher.open, #gk-switcher .gksw-it, #gk-switcher .gksw-ic, #gk-switcher .gksw-lb { transition: none; }
    #gk-switcher, #gk-switcher.open { transform: translate(-50%, -50%); }
  }`;

  let root = null, track = null, live = null;
  let st = null;   // while open: { entries, sel, start, moved, ctx, a0, t }
  let closing = 0;

  function build() {
    if (root) return;
    const css = document.createElement('style');
    css.id = 'gk-switcher-css'; css.textContent = CSS;
    document.head.appendChild(css);
    root = document.createElement('div');
    root.id = 'gk-switcher';
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'System Switcher');
    const arc = '<svg viewBox="0 0 12 20" aria-hidden="true"><path d="M2 3c5 4 5 10 0 14"/><path d="M7 1c6 5 6 13 0 18"/></svg>';
    root.innerHTML =
      '<span class="gksw-bump gksw-l" aria-hidden="true">' + arc.replace('<svg ', '<svg style="transform:scaleX(-1)" ') + 'L</span>' +
      '<div class="gksw-track"></div>' +
      '<span class="gksw-bump gksw-r" aria-hidden="true">R' + arc + '</span>';
    track = root.querySelector('.gksw-track');
    live = document.createElement('div');
    live.id = 'gk-switcher-live'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
    document.body.appendChild(root);
    document.body.appendChild(live);

    /* No click, tap or wheel handlers (2 Nov, see the head of this file): the panel is moved by keys
       and the controller only. */
  }

  /* The entries: All Consoles, then the shoulders' systems, each with its Systems menu picture. */
  function entriesFor(sys) {
    const menu = document.querySelector('#view-media .vgames-menu');
    const pic = sel => { const v = menu && menu.querySelector(sel + ' .vgimg'); return v ? v.innerHTML.replace(/\sloading="lazy"/g, '') : ''; };
    const allTile = menu && menu.querySelector('.vgtile[data-vg-all] b');
    const out = [{ i: -1, label: allTile ? allTile.textContent.trim() : 'All Consoles', ic: pic('.vgtile[data-vg-all]') }];
    sys.forEach((s, k) => out.push({ i: k, label: s.label, ic: pic('.vgtile[data-vg-pick="' + (window.CSS && CSS.escape ? CSS.escape(s.key) : s.key) + '"]') }));
    return out;
  }

  function render() {
    track.innerHTML = st.entries.map((en, p) =>
      '<span class="gksw-it jump" data-pos="' + p + '" aria-hidden="true">' +
        '<span class="gksw-ic">' + en.ic + '</span><span class="gksw-lb">' + esc(en.label) + '</span></span>').join('');
    st.off = st.entries.map(() => null);
  }

  /* Each icon's place: the chosen one in the middle at --k times its size, the others in steps out
     from it. An icon that wraps round from one end to the other moves without a slide. */
  function layout() {
    const cs = getComputedStyle(root);
    const s = parseFloat(cs.getPropertyValue('--s')) || 84, g = parseFloat(cs.getPropertyValue('--g')) || 16, k = parseFloat(cs.getPropertyValue('--k')) || 1.5;
    const n = st.entries.length, half = (VISIBLE - 1) / 2;
    const items = track.children;
    for (let p = 0; p < n; p++) {
      let o = ((p - st.sel) % n + n) % n;
      if (o > n / 2) o -= n;
      const b = items[p], prev = st.off[p];
      const jump = prev === null || Math.abs(o - prev) > 1 || (Math.abs(o) > half + 1 && Math.abs(prev) > half + 1);
      b.classList.toggle('jump', jump || reduced());
      const a = Math.abs(o);
      const x = a === 0 ? 0 : Math.sign(o) * (s * k / 2 + g + s / 2 + (a - 1) * (s + g));
      b.style.transform = 'translateX(' + x.toFixed(1) + 'px)';
      b.classList.toggle('sel', a === 0);
      b.classList.toggle('side', a === 1);
      b.classList.toggle('edge', a === 2);
      b.classList.toggle('far', a > half);
      b.setAttribute('aria-current', a === 0 ? 'true' : 'false');
      st.off[p] = o;
    }
    void track.offsetWidth;
    requestAnimationFrame(() => { if (!st) return; for (const b of items) if (!reduced()) b.classList.remove('jump'); });
  }

  function say(text) { if (!live) return; live.textContent = ''; setTimeout(() => { if (live) live.textContent = text; }, 30); }
  function announce() { const en = st.entries[st.sel]; say(en.label + ', ' + (st.sel + 1) + ' of ' + st.entries.length); }

  function arm() {
    clearTimeout(st.t);
    st.t = setTimeout(() => { if (!st) return; if (st.moved) apply(); else close(); }, WAIT_MS);
  }

  function open(ctx) {
    build();
    clearTimeout(closing); closing = 0;
    const entries = entriesFor(ctx.sys);
    const start = Math.max(0, Math.min(entries.length - 1, (ctx.start == null ? -1 : ctx.start) + 1));
    st = { entries, sel: start, start, moved: false, ctx, a0: document.activeElement, t: 0 };
    render();
    root.classList.add('open');
    layout();
    announce();
  }

  function move(dir) {
    if (!st) return;
    const n = st.entries.length;
    st.sel = ((st.sel + dir) % n + n) % n;
    st.moved = true;
    layout(); announce(); arm();
  }

  /* Applied only when it changes something: the system the wall already shows on its own, or
     All Consoles while every system is shown, is left as it is. */
  function apply() {
    if (!st) return;
    const s = st, en = s.entries[s.sel];
    const same = s.sel === s.start && (en.i !== -1 || s.ctx.allNow);
    close();
    if (same) return;
    try { s.ctx.apply(en.i, s.a0); } catch (e) { console.warn('[switcher] apply:', e); }
    say('Showing ' + en.label);
  }

  function close() {
    if (!st) return;
    clearTimeout(st.t);
    st = null;
    root.classList.remove('open');
  }

  function cancel() { if (st) { close(); say('System unchanged'); } }

  /* ONE PRESS, ONE SYSTEM; A HOLD REPEATS STEADILY, BOTH WAYS (31 Oct: "left seems to skip 2
     devices and then rolls through all devices at fast speed. Also I can hold the left shoulder
     button to go fast but not the right one"). Every move comes through here, whoever sent it:
     the pad's shoulders and D-pad (gamepad.js), [ ] , . and the arrow keys (a keyboard, or a
     controller the system also reports as keys). The causes were two: the pad never repeated a
     held shoulder (RB held did nothing), while a held key went straight through at the system's own
     key-repeat speed (about 30 a second, the "fast roll"); and a press that arrived both as a pad
     button and as a key moved twice. Now:
       - a press moves one system; the same direction again within DUP_MS is the same press
         arriving a second way and is dropped;
       - a held press (repeat) moves only after HOLD_MS, then once every RATE_MS, the same for
         Left and Right and for every source; a repeat of the other direction is ignored. */
  const DUP_MS = 120, HOLD_MS = 450, RATE_MS = 200;     // gamepad.js repeats a held shoulder at 460 / 230 to match
  const hold = { dir: 0, since: 0, last: 0 };
  function steer(dir, repeat) {
    const now = performance.now();
    if (!repeat) {
      if (hold.dir === dir && now - hold.since < DUP_MS) return false;
      hold.dir = dir; hold.since = hold.last = now;
      return true;
    }
    if (hold.dir !== dir || now - hold.since < HOLD_MS || now - hold.last < RATE_MS) return false;
    hold.last = now;
    return true;
  }
  /* shortcuts.js stepSection, games only. The first press shows the panel already moved one system
     (31 Oct: "one press steps exactly one system"); each one after it moves one more. */
  function step(dir, ctx, repeat) {
    if (!ctx || !ctx.sys || !ctx.sys.length || typeof ctx.apply !== 'function') return false;
    if (!document.body) return false;
    if (!st && repeat) return true;                       // a hold that outlived its panel opens nothing
    if (!steer(dir, repeat)) return true;
    if (st) { move(dir); return true; }
    open(ctx);
    move(dir);
    return true;
  }

  /* ---- keys while open (window, capture: before actions.js, keys.js and nav.js) ---- */
  const BACK = new Set(['Escape', 'GoBack', 'BrowserBack', 'Backspace', 'Esc', 'XF86Back']);
  const BACK_CODES = new Set([10009, 461]);
  window.addEventListener('keydown', e => {
    if (!st) return;
    const k = e.key;
    let what = null;
    if (k === 'Enter' || k === ' ' || k === 'Spacebar') what = 'apply';
    else if (BACK.has(k) || BACK_CODES.has(e.keyCode)) what = 'cancel';
    else if (k === 'ArrowLeft') what = 'prev';
    else if (k === 'ArrowRight') what = 'next';
    else if (k === 'ArrowUp' || k === 'ArrowDown') what = 'hold';
    if (!what) return;                                   // [ ] , . and every other key go on as before
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat && what !== 'prev' && what !== 'next') return;
    if (what === 'apply') apply();
    else if (what === 'cancel') cancel();
    else if (what === 'prev') { if (steer(-1, e.repeat)) move(-1); }   // the same steady repeat as the shoulders (31 Oct)
    else if (what === 'next') { if (steer(1, e.repeat)) move(1); }
  }, true);
  // A press anywhere outside the panel closes it, nothing changed (the press itself goes on).
  window.addEventListener('pointerdown', e => { if (st && root && !root.contains(e.target)) cancel(); }, true);
  window.addEventListener('hashchange', () => { if (st) close(); });

  window.GnwSwitcher = { step, isOpen: () => !!st, apply, cancel, _state: () => st && { sel: st.sel, start: st.start, label: st.entries[st.sel].label, moved: st.moved, n: st.entries.length } };
})();

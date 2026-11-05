/*
 * notify.js -- messages that slide in and count down, and the slow screen check
 * (28 Oct 2026).
 *
 * MESSAGES. window.cwNotify(message, options) shows a message at the top right, just below the
 * search bar (28 Oct: "where I looked for it"); with no search bar on screen, 16 px from the
 * top. place() follows the bar as the page scrolls, and when the stack would reach the Systems tab
 * on the right edge it stops short of the tab's column. Narrow screens: the whole width under the
 * search bar, less that column when needed.
 * A line runs around the message's outer edge and shrinks evenly over the countdown (10 s by
 * default); when it is gone the message slides out and is removed. Several messages stack
 * downward, the newest at the bottom.
 *   options: title, kind ('info' | 'warn' | 'ok'), duration (ms; 0, Infinity or sticky: true
 *   keep it until it is closed, with the whole edge line standing still), id (a second message with the
 *   same id replaces the first), actions ([{ label, run }]), onClose(reason).
 *   Returns { el, close(), restart(), hold(on) } (restart: the countdown starts again from full; hold: it waits until hold(false)).
 * Closing: the x button (mouse, touch, Enter or OK on it); Back (Escape, a remote's Back, a pad's
 * B) while the message has focus; and Back on the page itself when no drawer, window or Settings
 * is open (keys.js closes those first and marks the key handled, so this file only takes a Back
 * nothing else used). The countdown waits while the message has focus, while a mouse rests on it,
 * while the tab is hidden, while the browser window is not the active one and while something
 * covers the message, so nothing goes away unread.
 * Reduced motion: no slide (a short fade), the line still shrinks and the seconds left are shown
 * as a number.
 * Short replies come here too (28 Oct): index.html's toast() family, emby.js's
 * videoToast and the Continue row's Undo message hand their words and time to cwNotify, and keep
 * their old look only as the fallback. Messages inside a play window (the Control Bar's, the
 * Game & Watch save card, the film player's subtitle notes) stay in the window.
 * The holder carries the class toast-host so keys.js leaves it usable while a layer is open.
 *
 * SLOW SCREEN CHECK. A test screen ran at 30 Hz through a graphics driver fault, and a game's
 * every-other-frame flashing (Mario after he shrinks) then vanishes. window.cwRefresh measures
 * the time between animation frames while the tab is visible and focused: 3 s after the page
 * is read, or when a play window opens first.
 * THE CLOCK IS IN A WORKER (28 Oct). requestAnimationFrame inside a dedicated worker
 * (with an OffscreenCanvas) follows the screen and does not wait for the page's own work, so a
 * busy wall (clips, live tiles) cannot hold it back: measured on a 30 Hz PC, the worker kept a
 * 33.35 ms beat while the page was busy 45 ms every frame, and with screen sync switched off it
 * kept running when the page's own frames were held to 25 and 45 ms. The page's own frames are
 * the fallback where a worker has no frame clock; that path still needs an idle page for a slow
 * verdict (a 60 Hz page busy every frame reads exactly like a 30 Hz screen there).
 * A frame can come late but never early, so the screen's own rate is the SHORTEST interval that
 * keeps coming back, not the average. A slow verdict needs nearly every interval on that one
 * beat and a second sample, taken 5 s after the first, that agrees. A screen at about 42 Hz or slower then gets one message
 * on every visit (28 Oct), never over a drawer or a play window (it waits for them to
 * close). An unclear answer is measured again, every few seconds, for up to about a minute.
 * "Don't show again" and Settings > Configurations > Screen and tiles > Slow screen warning
 * switch it off; Settings also has a Check now button.
 * Not knowable from a page: the display's own setting, and a browser's power saving (Chrome's
 * Energy Saver and an iPhone's Low Power Mode both hold pages to 30 frames a second, which
 * reads exactly like a 30 Hz screen). When the browser says it runs on battery, the message adds
 * a line about power saving.
 * Storage (this browser only): localStorage cw.hzWarn.off ('1' = off), cw.hzWarn.test ('1' lets
 * a test tool's browser run the check). The first version's cw.hzWarn.day is removed on load.
 * A browser driven by a test tool (navigator.webdriver) skips the automatic check unless that
 * test key is set: headless Chrome on a 30 Hz PC sees 30 Hz too.
 * WHAT IT MEASURES (1 Nov): the pictures the browser shows a second, which is the screen's
 * rate only when nothing else holds the browser back. On a PC whose two screens Windows and DWM
 * both report at 60 Hz, Chrome with graphics acceleration on gave every page and worker exactly
 * 30 (33.35 ms, fresh profile, normal and private window, empty page too); with acceleration off
 * or ANGLE on OpenGL it gave 60. A busy start-up, a private window and a background tab do not
 * fool the check (busy wall at 60: 60, ok; private at 60: 60, ok; hidden or unfocused: aborted and
 * measured again later). The message now says what was measured and names both causes.
 * Sound: none.
 */
(function () {
  'use strict';
  if (window.cwNotify) return;

  const BUILD = '20261101-fix4a';
  const DEFAULT_MS = 10000;
  const MAX_SHOWN = 4;

  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
  const isField = t => !!t && t.nodeType === 1 && (t.isContentEditable || /^(TEXTAREA|SELECT)$/.test(t.tagName) ||
    (t.tagName === 'INPUT' && !/^(button|checkbox|radio|range|color|file|submit|reset|image)$/i.test(t.type || 'text')));
  const BACK = new Set(['Escape', 'Esc', 'GoBack', 'BrowserBack', 'XF86Back', 'Backspace']);
  const isBack = e => BACK.has(e.key) && !(e.key === 'Backspace' && (isField(e.target) || e.ctrlKey || e.altKey || e.metaKey));

  const SVG = (p, cls) => '<svg class="' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const ICONS = {
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="8.01"/>',
    warn: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17.01"/>',
    ok: '<polyline points="20 6 9 17 4 12"/>',
  };
  const X = '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>';

  /* ------------------------------------------------------------ look */
  function styles() {
    if (document.getElementById('cw-notify-style')) return;
    const st = document.createElement('style');
    st.id = 'cw-notify-style';
    st.textContent = `
      #cw-notify-host.cw-notify-host {
        /* top and right are set by place(): below the search bar, clear of the Systems tab. */
        position:fixed; top:var(--cwn-top, 16px); right:var(--cwn-right, 16px); left:auto; bottom:auto; z-index:9998;
        width:min(410px, calc(100vw - 16px - var(--cwn-right, 16px))); max-width:none;
        display:flex; flex-direction:column; justify-content:flex-start; gap:10px; pointer-events:none;
      }
      /* Narrow screens: the whole width under the search bar. */
      @media (max-width: 760px) { #cw-notify-host.cw-notify-host { width:auto; left:max(16px, env(safe-area-inset-left, 0px)); } }
      body.gnw-tv #cw-notify-host.cw-notify-host { width:min(620px, 40vw); gap:14px; }
      .cwn {
        --cwn-r:14px; --cwn-line:var(--accent, #5dc8f0);
        position:relative; box-sizing:border-box; pointer-events:auto;
        display:flex; gap:12px; align-items:flex-start; padding:15px 12px 15px 16px;
        border-radius:var(--cwn-r); background:var(--panel, #16161a); color:var(--text, #e7ecf2);
        box-shadow:0 18px 44px -14px rgba(0,0,0,.7); font-size:14px; line-height:1.45;
        animation:cwn-in .38s cubic-bezier(.2,.7,.2,1) both;
      }
      :root[data-theme="light"] .cwn { box-shadow:0 14px 36px -12px rgba(20,30,50,.35); }
      .cwn.cwn-warn { --cwn-line:var(--accent-2, #f5c542); }
      .cwn.cwn-ok { --cwn-line:var(--accent, #5dc8f0); }
      .cwn.cwn-out { animation:cwn-out .3s cubic-bezier(.4,0,.6,1) forwards; }
      @keyframes cwn-in { from { transform:translateX(calc(100% + 40px)); opacity:0; } to { transform:none; opacity:1; } }
      @keyframes cwn-out { from { transform:none; opacity:1; } to { transform:translateX(calc(100% + 40px)); opacity:0; } }
      .cwn-ring { position:absolute; left:0; top:0; width:100%; height:100%; pointer-events:none; overflow:visible; }
      .cwn-track { fill:none; stroke:var(--line, #2a3242); stroke-width:3; }
      .cwn-line { fill:none; stroke:var(--cwn-line); stroke-width:3; stroke-linecap:round; stroke-dasharray:100 100; stroke-dashoffset:0; }
      .cwn-icon { flex:0 0 auto; width:20px; height:20px; margin-top:1px; color:var(--cwn-line); }
      .cwn-main { flex:1 1 auto; min-width:0; }
      .cwn-title { margin:0 0 2px; font-weight:700; font-size:14.5px; }
      .cwn-text { margin:0; color:var(--text, #e7ecf2); opacity:.86; word-break:break-word; }
      .cwn-text + .cwn-text { margin-top:6px; }
      .cwn-acts { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
      .cwn-acts:empty { display:none; }
      .cwn-act, .cwn-close { font:inherit; color:inherit; cursor:pointer; background:transparent; }
      .cwn-act { padding:5px 12px; font-size:13px; font-weight:600; border:1px solid var(--line, #2a3242); border-radius:999px; }
      .cwn-close { flex:0 0 auto; display:grid; place-items:center; width:36px; height:36px; margin:-8px -4px -8px 0; padding:0; border:0; border-radius:10px; color:var(--muted, #8a94a6); }
      .cwn-close svg { width:18px; height:18px; }
      .cwn-act:focus-visible, .cwn-close:focus-visible { outline:var(--focus-width, 3px) solid var(--focus-ring, var(--accent, #5dc8f0)); outline-offset:2px; color:var(--text, #e7ecf2); }
      .cwn-secs { position:absolute; right:14px; bottom:9px; font-size:12px; font-variant-numeric:tabular-nums; color:var(--muted, #8a94a6); }
      .cwn-secs:empty { display:none; }
      body.gnw-tv .cwn { --cwn-r:20px; font-size:20px; padding:22px 18px 22px 24px; gap:16px; }
      body.gnw-tv .cwn-title { font-size:21px; }
      body.gnw-tv .cwn-icon { width:28px; height:28px; }
      body.gnw-tv .cwn-act { font-size:18px; padding:8px 18px; }
      body.gnw-tv .cwn-close { width:52px; height:52px; }
      body.gnw-tv .cwn-close svg { width:26px; height:26px; }
      body.gnw-tv .cwn-track, body.gnw-tv .cwn-line { stroke-width:4; }
      body.gnw-tv .cwn-secs { font-size:16px; right:20px; bottom:12px; }
      @media (prefers-reduced-motion: reduce) {
        .cwn { animation:cwn-fade-in .18s ease both; }
        .cwn.cwn-out { animation:cwn-fade-out .18s ease forwards; }
      }
      @keyframes cwn-fade-in { from { opacity:0; } to { opacity:1; } }
      @keyframes cwn-fade-out { from { opacity:1; } to { opacity:0; } }
    `;
    document.head.appendChild(st);
  }

  let host = null;
  function getHost() {
    if (host && host.isConnected) return host;
    host = document.createElement('div');
    host.id = 'cw-notify-host';
    host.className = 'toast-host cw-notify-host';
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
    place();
    return host;
  }

  /* Where the stack goes: just below the search bar (the visible .collection-toolbar, sticky at
     the top once the page scrolls), else 16 px from the top (TV: its overscan margin). Then, if
     the stack reaches down to the Systems tab (.vg-tab, fixed to the right edge), it moves left
     of the tab's column. Run on show, on scroll and resize, and every 300 ms while a message is
     up (bars appear and change size as pages draw). */
  const vis = el => { if (!el) return null; const r = el.getBoundingClientRect(); if (!r.width || !r.height) return null; const cs = getComputedStyle(el); return cs.display === 'none' || cs.visibility === 'hidden' ? null : r; };
  function place() {
    if (!host || !host.isConnected) return;
    const tv = document.body.classList.contains('gnw-tv');
    const edge = tv ? Math.round(Math.max(innerWidth * 0.03, 16)) : 16;
    let top = tv ? Math.round(Math.max(innerHeight * 0.02, 16)) : 16;
    let barR = null;
    for (const bar of document.querySelectorAll('.collection-toolbar')) {
      const r = vis(bar);
      if (r && r.bottom > 0 && r.bottom < innerHeight * 0.7) { barR = r; top = Math.max(top, Math.round(r.bottom + 10)); break; }
    }
    // Too tall to fit below the bar (a phone before it scrolls, the bar half way down): above
    // the bar if it fits there, else as low as fits on screen.
    host.style.setProperty('--cwn-top', top + 'px');
    const hh = host.getBoundingClientRect().height;
    if (hh && top + hh > innerHeight - 16) {
      if (barR && barR.top - 10 - hh >= 16) top = Math.round(barR.top - 10 - hh);
      else top = Math.max(16, Math.round(innerHeight - 16 - hh));
    }
    let right = edge;
    const tab = vis(document.querySelector('.vg-tab'));
    if (tab && tab.left > innerWidth / 2) {
      host.style.setProperty('--cwn-top', top + 'px');
      host.style.setProperty('--cwn-right', edge + 'px');
      const h = host.getBoundingClientRect();
      if (h.height && h.bottom > tab.top - 8 && h.top < tab.bottom + 8) right = Math.round(innerWidth - tab.left + 8);
    }
    if (host.style.getPropertyValue('--cwn-top') !== top + 'px') host.style.setProperty('--cwn-top', top + 'px');
    if (host.style.getPropertyValue('--cwn-right') !== right + 'px') host.style.setProperty('--cwn-right', right + 'px');
  }
  let placeT = 0;
  function placeLoop(on) {
    if (on && !placeT) {
      placeT = setInterval(place, 300);
      addEventListener('scroll', place, { passive: true, capture: true });
      addEventListener('resize', place, { passive: true });
    } else if (!on && placeT) {
      clearInterval(placeT); placeT = 0;
      removeEventListener('scroll', place, { capture: true });
      removeEventListener('resize', place);
    }
  }

  const live = [];   // oldest first

  function cwNotify(message, opts) {
    opts = opts || {};
    if (!document.body) return null;
    styles();
    if (opts.id) { const old = live.find(n => n.id === opts.id); if (old) old.close('replaced', true); }
    while (live.length >= MAX_SHOWN) live[0].close('crowded', true);

    const kind = /^(warn|ok)$/.test(opts.kind || '') ? opts.kind : 'info';
    // duration 0 or Infinity (or sticky: true): the message stays until it is closed.
    const sticky = !!opts.sticky || opts.duration === 0 || opts.duration === Infinity;
    const ms = sticky ? 0 : Math.max(1000, +opts.duration || DEFAULT_MS);
    const el = document.createElement('div');
    el.className = 'cwn cwn-' + kind + (sticky ? ' cwn-sticky' : '');
    el.setAttribute('role', kind === 'warn' ? 'alert' : 'status');
    el.innerHTML =
      '<svg class="cwn-ring" aria-hidden="true"><rect class="cwn-track"/><rect class="cwn-line" pathLength="100"/></svg>' +
      SVG(ICONS[kind], 'cwn-icon') +
      '<div class="cwn-main"><p class="cwn-title" hidden></p><div class="cwn-body"></div><div class="cwn-acts"></div></div>' +
      '<span class="cwn-secs" aria-hidden="true"></span>' +
      '<button type="button" class="cwn-close" aria-label="Close message">' + SVG(X, '') + '</button>';
    if (opts.title) { const t = el.querySelector('.cwn-title'); t.textContent = opts.title; t.hidden = false; }
    const body = el.querySelector('.cwn-body');
    String(message == null ? '' : message).split('\n').filter(Boolean).forEach(line => {
      const p = document.createElement('p'); p.className = 'cwn-text'; p.textContent = line; body.appendChild(p);
    });
    const acts = el.querySelector('.cwn-acts');
    (opts.actions || []).forEach(a => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'cwn-act'; b.textContent = a.label;
      b.addEventListener('click', () => { let keep = false; try { keep = a.run && a.run() === false; } catch (e) { console.warn('[notify]', e); } if (!keep) n.close('action'); });
      acts.appendChild(b);
    });

    const n = { id: opts.id || null, el, closed: false, close, restart, hold };
    // restart(): the countdown starts again from full (a message that grows, such as the game
    // server's load failures, stays its full time after the last addition).
    function restart() { if (anim && !n.closed) { try { anim.currentTime = 0; } catch (_) {} sync(); paintSecs(); } }
    // hold(true): the countdown waits until hold(false), as it does while focused (an opened list).
    function hold(on) { if (n.closed) return; if (on) holds.add('ext'); else holds.delete('ext'); sync(); }
    const holds = new Set();
    let anim = null, secsT = 0, from = null;

    /* The line: a rectangle just inside the edge, the same rounding as the box, measured again
       whenever the box changes size. pathLength=100 keeps the dash in percent of the way round. */
    const svg = el.querySelector('.cwn-ring');
    function fit() {
      const w = el.offsetWidth, h = el.offsetHeight;
      if (!w || !h) return;
      const sw = parseFloat(getComputedStyle(el.querySelector('.cwn-line')).strokeWidth) || 3;
      const r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 14;
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      el.querySelectorAll('rect').forEach(rc => {
        rc.setAttribute('x', sw / 2); rc.setAttribute('y', sw / 2);
        rc.setAttribute('width', Math.max(0, w - sw)); rc.setAttribute('height', Math.max(0, h - sw));
        rc.setAttribute('rx', Math.max(0, r - sw / 2)); rc.setAttribute('ry', Math.max(0, r - sw / 2));
      });
    }
    let ro = null;
    try { ro = new ResizeObserver(fit); ro.observe(el); } catch (_) {}

    function sync() {
      if (!anim || n.closed) return;
      const hold = holds.size > 0 || document.visibilityState === 'hidden';
      if (hold && anim.playState === 'running') anim.pause();
      else if (!hold && anim.playState === 'paused') anim.play();
    }
    const secs = el.querySelector('.cwn-secs');
    function paintSecs() {
      if (!anim || n.closed) return;
      // Not seen: the browser window is not the active one, or something covers the message
      // (the loading screen, a layer drawn above it). The countdown waits.
      let unseen = !document.hasFocus();
      if (!unseen) {
        const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        if (x > 0 && y > 0 && x < innerWidth && y < innerHeight) { const hit = document.elementFromPoint(x, y); unseen = !!hit && !el.contains(hit); }
      }
      if (unseen !== holds.has('unseen')) { if (unseen) holds.add('unseen'); else holds.delete('unseen'); sync(); }
      const left = Math.max(0, ms - (Number(anim.currentTime) || 0));
      const s = reduced() ? String(Math.ceil(left / 1000)) : '';
      if (secs.textContent !== s) secs.textContent = s;
    }

    function close(reason, quick) {
      if (n.closed) return;
      n.closed = true;
      const i = live.indexOf(n); if (i >= 0) live.splice(i, 1);
      clearInterval(secsT);
      document.removeEventListener('visibilitychange', sync);
      try { if (ro) ro.disconnect(); } catch (_) {}
      try { if (anim) anim.pause(); } catch (_) {}
      // Focus inside goes back where it came from, or to the next message.
      if (el.contains(document.activeElement)) {
        const next = live[live.length - 1];
        const back = from && from.isConnected && !from.closest('[inert]') ? from : (next ? next.el.querySelector('.cwn-close') : null);
        try { if (back) back.focus({ preventScroll: true }); else document.activeElement.blur(); } catch (_) {}
      }
      const done = () => { el.remove(); if (host && !host.children.length) { host.remove(); placeLoop(false); } };
      if (quick) done();
      else {
        el.classList.add('cwn-out');
        const h = el.offsetHeight;
        setTimeout(() => {
          // The ones above close the gap instead of jumping.
          try { const a = el.animate([{ height: h + 'px', marginTop: '0px' }, { height: '0px', marginTop: '-10px', paddingTop: '0px', paddingBottom: '0px' }], { duration: reduced() ? 1 : 180, easing: 'ease', fill: 'forwards' }); el.style.overflow = 'hidden'; a.finished.then(done, done); }
          catch (_) { done(); }
        }, reduced() ? 180 : 300);
      }
      try { if (opts.onClose) opts.onClose(reason); } catch (e) { console.warn('[notify]', e); }
    }

    el.querySelector('.cwn-close').addEventListener('click', () => close('closed'));
    el.addEventListener('keydown', e => {
      if (!isBack(e) || isField(e.target)) return;
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat) close('key');
    });
    // The countdown waits while the visitor is reading it: focus inside, or a resting mouse.
    el.addEventListener('focusin', e => { if (!holds.has('focus')) from = e.relatedTarget && !el.contains(e.relatedTarget) ? e.relatedTarget : from; holds.add('focus'); sync(); });
    el.addEventListener('focusout', e => { if (!el.contains(e.relatedTarget)) { holds.delete('focus'); sync(); } });
    el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { holds.add('mouse'); sync(); } });
    el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { holds.delete('mouse'); sync(); } });
    document.addEventListener('visibilitychange', sync);

    getHost().appendChild(el);
    live.push(n);
    placeLoop(true);
    place();
    fit();
    const line = el.querySelector('.cwn-line');
    if (sticky) return n;   // stays until closed: the whole line stays drawn, nothing counts down
    try {
      anim = line.animate([{ strokeDashoffset: '0' }, { strokeDashoffset: '100' }], { duration: ms, easing: 'linear', fill: 'forwards' });
      anim.finished.then(() => close('timeout'), () => {});
    } catch (_) {
      setTimeout(() => close('timeout'), ms);   // no Web Animations: the line stays whole, the message still goes
    }
    sync();
    paintSecs();
    secsT = setInterval(paintSecs, 250);
    return n;
  }

  /* Back on the page with nothing else open closes the newest message. keys.js (loaded before
     this file) has already closed a drawer, window or Settings for this key and marked it handled,
     and a play window stops it before it gets here. */
  window.addEventListener('keydown', e => {
    if (!live.length || e.defaultPrevented || !isBack(e) || isField(e.target) || e.ctrlKey || e.altKey || e.metaKey) return;
    if (document.querySelector('[data-gk-inert]')) return;   // a layer is open: Back is its own
    e.preventDefault();
    if (!e.repeat) live[live.length - 1].close('key');
  });

  window.cwNotify = cwNotify;
  cwNotify.BUILD = BUILD;
  cwNotify.list = () => live.slice();
  cwNotify.closeAll = () => live.slice().forEach(n => n.close('closed', true));

  /* ============================================================ the slow screen check */

  const RATES = [24, 25, 30, 48, 50, 60, 72, 75, 85, 90, 100, 120, 144, 165, 170, 180, 200, 240, 280, 360];
  const SLOW_HZ = 42;
  const CONFIRM_GAP_MS = 5000;   // the confirming sample starts this long after the first
  const KEY_OFF = 'cw.hzWarn.off';
  const lsGet = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) {} };
  const isOff = () => lsGet(KEY_OFF) === '1';
  lsSet('cw.hzWarn.day', null);   // the first version's once-a-day memory; every visit now (28 Oct)

  /* The verdict from a list of frame intervals (ms) and the share of the sample the page was idle
     (0..1, or null when the browser cannot say). Pure, so the test page can feed it directly.
       few   too few intervals to say anything
       busy  no steady beat, or a slow beat on a busy page: try again later
       slow  a steady beat at SLOW_HZ or slower
       ok    a steady beat faster than that */
  function classify(d, idle) {
    const n = d.length;
    if (n < 40) return { verdict: 'few', n };
    const s = d.slice().sort((a, b) => a - b);
    const p10 = s[Math.floor(n * 0.10)];
    // The screen's beat: the middle of the intervals near the short end (frames are never early).
    const near = s.filter(x => x >= p10 * 0.85 && x <= p10 * 1.2);
    const period = near[Math.floor(near.length / 2)];
    if (!(period > 0.5)) return { verdict: 'busy', n, period };   // no screen beat at all (a clock with no sync)
    const on = d.filter(x => Math.abs(x - period) <= period * 0.15).length / n;
    const aligned = d.filter(x => { const k = Math.max(1, Math.round(x / period)); return Math.abs(x - k * period) <= period * 0.15; }).length / n;
    const median = s[Math.floor(n / 2)];
    const raw = 1000 / period;
    const snap = RATES.reduce((b, r) => Math.abs(r - raw) < Math.abs(b - raw) ? r : b, RATES[0]);
    const hz = Math.abs(snap - raw) <= raw * 0.06 ? snap : Math.round(raw);
    const out = { n, hz, rawHz: +raw.toFixed(2), period: +period.toFixed(2), median: +median.toFixed(2), onBeat: +on.toFixed(3), aligned: +aligned.toFixed(3), idle: idle == null ? null : +idle.toFixed(3) };
    // A fast beat that keeps coming back proves a fast screen, however many frames a busy page
    // drops in between; a slow beat must be nearly every interval.
    if (hz > SLOW_HZ && on >= 0.2 && aligned >= 0.85) return Object.assign(out, { verdict: 'ok' });
    if (on < 0.6 || aligned < 0.85) return Object.assign(out, { verdict: 'busy' });
    if (hz <= SLOW_HZ) {
      // A slow beat counts only from a quiet page: a page that is busy every frame can hold a
      // fast screen to every second frame, which would read exactly like a slow screen.
      // 28 Oct: a 60 Hz stand-in with 23 ms of work a frame measured idle 0.41 here, so the
      // page path needs a nearly idle page (a quiet 30 Hz page measured 0.68 to 0.78).
      if (idle != null && idle < 0.65) return Object.assign(out, { verdict: 'busy' });
      return Object.assign(out, { verdict: 'slow' });
    }
    return Object.assign(out, { verdict: 'ok' });
  }

  /* One sample: about 90 frame intervals (3 s at 30 Hz, 1.5 s at 60 Hz, at most maxMs). Stops
     with 'aborted' if the tab is hidden or loses focus on the way. */
  function measure(o) {
    o = Object.assign({ frames: 90, maxMs: 4000, skip: 4, needFocus: true }, o || {});
    return new Promise(resolve => {
      const d = [];
      let last = 0, seen = 0, t0 = 0, stop = false;
      let idleSum = 0, idleEnd = 0, idleOn = typeof requestIdleCallback === 'function';
      const lost = () => document.visibilityState !== 'visible' || (o.needFocus && !document.hasFocus());
      const finish = verdict => {
        if (stop) return; stop = true;
        removeEventListener('blur', onLost); document.removeEventListener('visibilitychange', onLost);
        if (verdict) { resolve({ verdict, n: d.length }); return; }
        const span = last - t0;
        const res = classify(d, idleOn && span > 0 ? Math.min(1, idleSum / span) : null);
        res.intervals = d;
        resolve(res);
      };
      const onLost = () => { if (lost()) finish('aborted'); };
      addEventListener('blur', onLost); document.addEventListener('visibilitychange', onLost);
      if (lost()) { finish('aborted'); return; }
      // The idle share: the union of the idle periods the browser offered during the sample.
      if (idleOn) {
        const idle = dl => {
          if (stop) return;
          const a = performance.now(), b = a + dl.timeRemaining();
          if (t0 && b > Math.max(a, idleEnd)) idleSum += b - Math.max(a, idleEnd, t0);
          idleEnd = Math.max(idleEnd, b);
          requestIdleCallback(idle);
        };
        requestIdleCallback(idle);
      }
      const tick = ts => {
        if (stop) return;
        seen++;
        if (seen > o.skip) {
          if (!t0) t0 = ts; else d.push(ts - last);
        }
        last = ts;
        if (d.length >= o.frames || (t0 && ts - t0 > o.maxMs)) { finish(); return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  const state = { running: false, done: false, tries: 0, last: null, pending: null };

  /* The worker's frame clock (see the top of the file). The worker draws one pixel on its own
     OffscreenCanvas each frame and posts back the frame intervals. A test may put its own clock
     in front of the worker's code (window.__cwHzWorkerPrelude, a string). Answers
     { verdict: 'noworker' } where a worker has no frame clock, and 'aborted' as measure() does. */
  const WORKER_SRC = `
    let d = [], last = 0, seen = 0, t0 = 0, g = null;
    onmessage = e => {
      const o = e.data;
      try { g = new OffscreenCanvas(2, 2).getContext('2d'); } catch (_) {}
      if (typeof requestAnimationFrame !== 'function') { postMessage({ none: 1 }); return; }
      const tick = ts => {
        seen++;
        if (seen === 1) postMessage({ started: 1 });
        if (seen > o.skip) { if (!t0) t0 = ts; else d.push(ts - last); }
        last = ts;
        if (g) { g.fillStyle = seen & 1 ? '#000' : '#fff'; g.fillRect(0, 0, 2, 2); }
        if (d.length >= o.frames || (t0 && ts - t0 > o.maxMs)) { postMessage({ d }); return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };`;
  function measureWorker(o) {
    o = Object.assign({ frames: 90, maxMs: 4000, skip: 4, needFocus: true }, o || {});
    return new Promise(resolve => {
      let w = null, url = '', timer = 0, stop = false;
      const lost = () => document.visibilityState !== 'visible' || (o.needFocus && !document.hasFocus());
      const finish = r => {
        if (stop) return; stop = true;
        clearTimeout(timer);
        removeEventListener('blur', onLost); document.removeEventListener('visibilitychange', onLost);
        try { if (w) w.terminate(); } catch (_) {}
        try { if (url) URL.revokeObjectURL(url); } catch (_) {}
        resolve(r);
      };
      const onLost = () => { if (lost()) finish({ verdict: 'aborted' }); };
      if (typeof Worker !== 'function' || typeof OffscreenCanvas !== 'function') { finish({ verdict: 'noworker' }); return; }
      if (lost()) { finish({ verdict: 'aborted' }); return; }
      addEventListener('blur', onLost); document.addEventListener('visibilitychange', onLost);
      try {
        url = URL.createObjectURL(new Blob([(window.__cwHzWorkerPrelude || '') + WORKER_SRC], { type: 'text/javascript' }));
        w = new Worker(url);
      } catch (_) { finish({ verdict: 'noworker' }); return; }
      w.onerror = () => finish({ verdict: 'noworker' });
      w.onmessage = e => {
        const m = e.data || {};
        if (m.started) {
          // It has a frame clock. Its answer is posted to this page, which may be busy and slow
          // to read it, so the wait from here on is long; the frames themselves are not delayed.
          clearTimeout(timer); timer = setTimeout(() => finish({ verdict: 'noworker' }), o.maxMs + 15000);
          return;
        }
        if (!m.d) { finish({ verdict: 'noworker' }); return; }
        // The worker's frames do not wait for the page, so no idle share is needed.
        const res = classify(m.d, null);
        res.source = 'worker'; res.intervals = m.d;
        finish(res);
      };
      // A worker that gets no frames at all (no clock) must not hang the check.
      timer = setTimeout(() => finish({ verdict: 'noworker' }), 5000);
      w.postMessage({ frames: o.frames, maxMs: o.maxMs, skip: o.skip });
    });
  }
  async function measureBest() {
    const r = await measureWorker();
    if (r.verdict !== 'noworker' && r.verdict !== 'few') return r;
    const m = await measure();   // the page's own frames: a slow verdict needs an idle page
    m.source = 'page';
    return m;
  }

  async function sample() {
    const a = await measureBest();
    if (a.verdict !== 'slow') return a;
    // A second, separate sample must agree before anyone is told. It starts 5 s after the first ends
    // (28 Oct: "Test 5 seconds later again. No need to rush this prompt."; was 400 ms).
    await new Promise(r => setTimeout(r, CONFIRM_GAP_MS));
    const b = await measureBest();
    if (b.verdict === 'slow' && Math.abs(b.hz - a.hz) <= 3) return b;
    return b.verdict === 'ok' ? b : Object.assign(b, { verdict: b.verdict === 'slow' ? 'busy' : b.verdict });
  }

  function retryWhenBack() {
    const go = () => {
      if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
      removeEventListener('focus', go); document.removeEventListener('visibilitychange', go);
      setTimeout(() => check(), 1500);
    };
    addEventListener('focus', go); document.addEventListener('visibilitychange', go);
  }

  /* check(): measure if this page has not settled the question yet, and warn if slow.
     check({ force: true }) measures again and always answers (Settings' Check now). */
  async function check(o) {
    o = o || {};
    if (!o.force && (state.done || isOff())) return state.last;
    if (state.running) {
      if (!o.force) return null;
      try { await state.runP; } catch (_) {}   // Check now during the automatic check: wait, then measure afresh
      if (state.running) return null;
    }
    if (document.visibilityState !== 'visible' || !document.hasFocus()) { if (o.force) tellUnsure(); else retryWhenBack(); return { verdict: 'aborted' }; }
    state.running = true; state.tries++;
    let res;
    try { state.runP = sample(); res = await state.runP; } catch (e) { res = { verdict: 'error', error: String(e) }; }
    state.running = false;
    state.last = res;
    try { if (res.intervals) delete res.intervals; } catch (_) {}
    if (res.verdict === 'slow') { state.done = true; if (o.force || !isOff()) warn(res, o.force); }
    else if (res.verdict === 'ok') { state.done = true; if (o.force) tellOk(res); }
    else if (res.verdict === 'aborted') { if (o.force) tellUnsure(); else retryWhenBack(); }
    else if (o.force) tellUnsure();
    // No clear answer yet (a busy page on the fallback path): again in 3, 6, then every 8 s,
    // up to 12 tries (about a minute and a half).
    else if (state.tries < 12) setTimeout(() => check(), Math.min(8000, 3000 * state.tries));
    return res;
  }

  const fgOpen = () => { try { return !!(window.gnwForegroundActive && window.gnwForegroundActive()); } catch (_) { return false; } };

  async function warn(res, now) {
    // Never over a drawer or a play window: wait for it to close.
    if (!now && fgOpen()) {
      if (state.pending) return;
      state.pending = e => { if (e.detail && e.detail.active) return; document.removeEventListener('gnw:foreground', state.pending); state.pending = null; setTimeout(() => warn(res), 1200); };
      document.addEventListener('gnw:foreground', state.pending);
      return;
    }
    if (!now && isOff()) return;
    let battery = false;
    try { if (navigator.getBattery) { const b = await navigator.getBattery(); battery = b && b.charging === false; } } catch (_) {}
    /* What is measured is the pictures the browser shows a second, not the screen's own setting
       (1 Nov): a PC whose screens are set to 60 Hz measured 30 here with Chrome's graphics
       acceleration on, and 60 with it off. So the words name both places it can be set. */
    const lines = [
      'Games here run at 60, so some flashing things can vanish and movement can look uneven.',
      'Check your screen first: in your computer’s display settings (on Windows: Settings > System > Display > Advanced display), choose 60 Hz or more.',
      'If it already says 60 Hz, the browser’s graphics are holding it back: update your graphics driver, or turn off a frame rate limit in the graphics driver’s own settings. In Chrome you can also try turning Settings > System > Use graphics acceleration off and relaunching.',
    ];
    if (battery) lines.push('On battery, a power saving mode can also slow the browser to 30. Plugging in or turning it off helps.');
    cwNotify(lines.join('\n'), {
      id: 'cw-hz', kind: 'warn',
      title: 'This browser shows about ' + res.hz + ' pictures a second',
      actions: [{ label: 'Don’t show again', run: () => setOff(true) }],
    });
  }
  function tellOk(res) {
    cwNotify('That is fine for the games here.', { id: 'cw-hz', kind: 'ok', title: 'This browser shows about ' + res.hz + ' pictures a second' });
  }
  function tellUnsure() {
    cwNotify('The page was too busy, or the window was not in front. Try again in a moment.', { id: 'cw-hz', kind: 'info', title: 'Could not measure the screen' });
  }

  /* ------------------------------------------------------------ the Settings card */
  let cardEl = null;
  function setOff(off) {
    lsSet(KEY_OFF, off ? '1' : null);
    const i = cardEl && cardEl.querySelector('#cfg-hz-warn');
    if (i && i.checked === off) { i.checked = !off; i.dispatchEvent(new Event('change', { bubbles: true })); }
  }
  function card() {
    if (cardEl) return cardEl;
    const c = document.createElement('div');
    c.className = 'aw-card cfg-own';
    c.innerHTML = '<div class="aw-head"><span class="aw-name">Slow screen warning</span>' +
      '<label class="aw-switch"><input type="checkbox" id="cfg-hz-warn"' + (isOff() ? '' : ' checked') + ' aria-label="Slow screen warning"><span class="aw-slider"></span></label></div>' +
      '<p class="cfg-note">Games run at 60 pictures a second. When the browser shows only about 30 a second, some flashing things vanish and movement looks uneven. ' +
      'When the site measures that, it says so in a message each time you open the site. ' +
      'It is set on your device, not on this site: the screen’s refresh rate in your computer’s display settings, or the graphics driver (update it, or turn off its frame rate limit).</p>' +
      '<p class="cfg-note"><button type="button" class="btn-tiny" id="cfg-hz-check">Check my screen now</button></p>';
    c.querySelector('input').addEventListener('change', e => lsSet(KEY_OFF, e.target.checked ? null : '1'));
    const btn = c.querySelector('#cfg-hz-check');
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      btn.disabled = true; btn.textContent = 'Checking…';
      const back = () => { btn.disabled = false; btn.textContent = 'Check my screen now'; };
      Promise.resolve(check({ force: true })).then(back, back);
    });
    cardEl = c;
    return c;
  }

  window.cwRefresh = { BUILD, classify, measure, measureWorker, check, card, state, setOff, isOff };

  /* ============================================================ nothing connected */
  /* NOTHING CONNECTED (28 Oct: "convert the banner notifications to this new type").
     Two banners told a new visitor the same thing: the Game & Watch line at the top of the page
     ("Connect a game server or open a content pack to play", gnw-host.js _gnwContentMissing) and
     the "No media server connected" card on the Media page (emby.js renderNoServer). Both now
     hand over to this one message, which names every source.
     When: gnw-host.js says no Game & Watch files came from anywhere (missing()), then 4 s later
     (stored servers and sign-ins have had time to answer) nothing is connected at all: no media
     server signed in or remembered, no game server set up, no content pack, no file playing.
     What a visitor can do with nothing connected was checked on the page itself (28 Oct): the
     wall shows two tiles, Tetris Jr. and R.O.B. Play Time, both with Play Now; Game & Watch,
     Game Boy, NES, Atari and Pokemon mini games all need a source. Play a file needs none.
     It stays until closed (28 Oct; the whole edge line stands still), and shows
     the moment the wall draws its first tile. It goes by itself when a source arrives. Shown on every
     visit until something is connected, never over a drawer or a play window; "Don't show again"
     ends it for good (cw.notice.noSource). The settings page is named by its own tab label, so a
     renamed page keeps the sentence right. */
  const NOSRC_KEY = 'cw.notice.noSource';
  const src = { missing: false, done: false, timer: 0, poll: 0, pending: null, shown: null };
  function anySource() {
    try {
      if (window.Emby && window.Emby.session && window.Emby.session.active) return true;
      if (lsGet('gnw.emby.token')) return true;                          // signed in before; the server may only be slow
      if (document.querySelector('#cws-list .cws-row')) return true;     // a game server is set up
      if (window.__GNW_PACK && window.__GNW_PACK.has && window.__GNW_PACK.has()) return true;
      if (window.CwPlayFile && window.CwPlayFile.playing && window.CwPlayFile.playing()) return true;
    } catch (_) {}
    return false;
  }
  function sourcesLabel() {
    try { const p = window.GnwSettingsUi && window.GnwSettingsUi.pages().find(x => x.id === 'media'); if (p && p.label) return p.label; } catch (_) {}
    return 'Media and content';
  }
  function openSources(id) {
    try { if (typeof window.openVaultModal === 'function') window.openVaultModal(); } catch (_) {}
    try { if (window.GnwSettingsUi) window.GnwSettingsUi.show('media'); } catch (_) {}
    if (id) setTimeout(() => { try { if (window.GnwSources) window.GnwSources.open(id); } catch (_) {} }, 120);
  }
  function dropOldNotices() {
    const v = document.getElementById('video-noserver'); if (v) v.remove();   // drawn before this file loaded
    const g = document.getElementById('gnw-content-banner'); if (g) g.remove();
  }
  function srcFound() {
    src.done = true;
    clearTimeout(src.timer); clearInterval(src.poll);
    if (src.shown) src.shown.close('found');
  }
  function srcShow(tries) {
    if (src.done || src.shown || lsGet(NOSRC_KEY) === '1') return;
    if (anySource()) { srcFound(); return; }
    // It names the two tiles that play: it shows the moment the wall draws its first tile (with
    // nothing connected that took about 12 s on 28 Oct), watched, not polled; at most 30 s.
    if (!document.querySelector('.device-card') && !src.wallWaited) {
      if (!src.mo) {
        const go = () => { if (src.mo) { src.mo.disconnect(); src.mo = null; } clearTimeout(src.timer); src.wallWaited = true; srcShow(); };
        src.mo = new MutationObserver(() => { if (document.querySelector('.device-card')) go(); });
        src.mo.observe(document.body, { childList: true, subtree: true });
        src.timer = setTimeout(go, 30000);
      }
      return;
    }
    /* NOT BEFORE 30 S, NEVER OVER A PAGE (31 Oct: "Wait 30 seconds before showing the
       notification 'Nothing connected yet'. It opens directly over the home page text on my
       phone."). It waits until 30 s after the page started loading, and while Home, Features,
       About, Timeline or Compatibility is open it waits for that window to close (checked every
       second), then comes 1.2 s later; a window opened while it is up sends it away until then. */
    const early = 30000 - performance.now();
    if (early > 0) { clearTimeout(src.timer); src.timer = setTimeout(srcShow, early + 50); return; }
    if (winOpen()) { clearTimeout(src.timer); src.timer = setTimeout(() => { if (winOpen()) srcShow(); else src.timer = setTimeout(srcShow, 1200); }, 1000); return; }
    if (fgOpen()) {   // never over a drawer or a play window
      if (src.pending) return;
      src.pending = e => { if (e.detail && e.detail.active) return; document.removeEventListener('gnw:foreground', src.pending); src.pending = null; setTimeout(srcShow, 1200); };
      document.addEventListener('gnw:foreground', src.pending);
      return;
    }
    const lines = [
      'You can play Tetris Jr. and R.O.B. Play Time right now, or play a game file from this device.',
      'For more games, films and series, add a game server, a media server or a content pack in Settings > ' + sourcesLabel() + '.',
    ];
    src.shown = cwNotify(lines.join('\n'), {
      id: 'cw-nosrc', kind: 'info', sticky: true, title: 'Nothing connected yet',   // stays until closed (28 Oct)
      actions: [
        { label: 'Add a source', run: () => openSources(null) },
        { label: 'Play a file', run: () => openSources('file') },
        { label: 'Don’t show again', run: () => lsSet(NOSRC_KEY, '1') },
      ],
      onClose: () => { src.shown = null; clearInterval(src.poll); },
    });
    // A source connected while it is up (a sign-in, a pack, a server): it goes.
    clearInterval(src.poll);
    src.poll = setInterval(() => {
      if (anySource()) { srcFound(); return; }
      if (src.shown && winOpen()) { src.shown.close('busy', true); src.timer = setTimeout(srcShow, 1000); }   // a page opened over it: back when it closes
    }, 1000);
  }
  // A page window (Home, Features, About, Timeline, Compatibility; emby.js) is open.
  function winOpen() { try { return !!(window.CwAboutWindow && window.CwAboutWindow.isOpen()); } catch (_) { return false; } }
  window.cwSources = {
    missing() { dropOldNotices(); if (src.missing || src.done) return; src.missing = true; clearTimeout(src.timer); src.timer = setTimeout(srcShow, 1000); },
    found: srcFound,
    any: anySource,
    show: () => { src.done = false; src.shown = null; srcShow(); },
  };
  addEventListener('cws:library-changed', () => { if (src.shown && anySource()) srcFound(); });
  // A drawer or a play window opened while it is up: it steps aside, and comes back when that
  // closes (it stays until the visitor closes it; 28 Oct).
  document.addEventListener('gnw:foreground', e => {
    if (e.detail && e.detail.active) { if (src.shown) { src.reshow = true; src.shown.close('busy', true); } }
    else if (src.reshow) { src.reshow = false; setTimeout(srcShow, 1200); }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', dropOldNotices, { once: true }); else dropOldNotices();

  /* ------------------------------------------------------------ when to measure */
  // Only in the top window: 3 s after the page is read (not after 'load', which a busy wall can
  // hold back for a long time; the worker's clock does not need a quiet page), or when a play
  // window opens first.
  if (window.top !== window) return;
  // Not in a browser driven by a test tool (navigator.webdriver): on this PC headless Chrome follows
  // the real screen's 30 Hz too, and a message popping up would land in every other test's pictures.
  // A test of this check sets localStorage cw.hzWarn.test = '1'.
  if (navigator.webdriver && lsGet('cw.hzWarn.test') !== '1') return;
  function settled() {
    const go = () => setTimeout(() => check(), 3000);
    if (document.readyState !== 'loading') go(); else document.addEventListener('DOMContentLoaded', go, { once: true });
  }
  settled();
  document.addEventListener('gnw:foreground', e => {
    if (e.detail && e.detail.active && !state.done && !state.running && !state.tries) check();
  });
})();

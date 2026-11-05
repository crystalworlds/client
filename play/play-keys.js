/*
 * play/play-keys.js -- the play window's half of "one Back" (Keys phase 1, 2026-10-04).
 *
 * Loaded first by every framed play page (Game Boy / Color, NES family, the
 * three Atari pages, the two colour twins, Tetris Jr.). The host page
 * (keys.js) owns the other half.
 *
 * WHAT IT DOES.
 *   1. Back keys never reach the game. Escape, Backspace (outside a text field),
 *      GoBack / BrowserBack / XF86Back and the TV codes 4, 10009 (Tizen) and
 *      461 (webOS) are taken here, in the capture phase, before any game
 *      handler. Backspace is Back everywhere now (2026-10-04).
 *   2. A Back first closes a sub-screen inside this window (Controls, Saved
 *      states). Otherwise it is posted to the host page as { gnwBack: 1 },
 *      and the host opens its pause menu (Back again resumes; only Quit quits, 2026-10-14).
 *   3. window.gnwPlayKeys gives the host's pause menu the window's own actions:
 *      pause, Controls, Saved states. They press this window's own buttons, so
 *      nothing here duplicates a core's logic, and a page without a button
 *      simply does not offer that action.
 *   4. Game help (2026-10-04): the help key (? by default) never reaches the
 *      game either; it is posted to the host as { gnwHelp: 1 }, and the host
 *      shows its help over the game, paused (shortcuts.js).
 *
 * Deliberately generic and small: the planned unified emulator UI replaces it.
 */
(function () {
  'use strict';
  if (window.gnwPlayKeys) return;

  const BACK_KEYS = new Set(['Escape', 'Esc', 'GoBack', 'BrowserBack', 'XF86Back', 'Backspace']);
  const BACK_CODES = new Set([4, 10009, 461]);
  const framed = window.parent && window.parent !== window;

  function isField(t) {
    if (!t || t.nodeType !== 1) return false;
    if (t.isContentEditable) return true;
    const tag = t.tagName;
    if (tag === 'TEXTAREA') return true;
    if (tag !== 'INPUT') return false;
    return !/^(button|checkbox|radio|range|color|file|submit|reset|image)$/i.test(t.type || 'text');
  }
  function isBack(e) {
    if (BACK_CODES.has(e.keyCode) && e.key !== 'Backspace') return true;
    if (!BACK_KEYS.has(e.key)) return false;
    if (e.key === 'Backspace' && (isField(e.target) || e.ctrlKey || e.altKey || e.metaKey)) return false;
    return true;
  }
  const $ = s => document.querySelector(s);

  /* A sub-screen inside this window closes first: [is it open?, its Back]. */
  const SUBS = [
    ['body.sub-open', '#pillBack'],                                                     // Game Boy
    ['.sub-open #twin-back', '#twin-back'],                                             // colour twins
    ['#tj-keys[aria-hidden="false"], #tj-saves[aria-hidden="false"]', '#tj-back'],      // Tetris Jr.
    // NES family: an open bar drop-down (Controller menu, DIP, Power Pad) closes before the Keys screen (2026-10-04).
    ['#btnDev[aria-expanded="true"], #btnDip[aria-expanded="true"], #btnMat[aria-expanded="true"]', '#btnDev[aria-expanded="true"], #btnDip[aria-expanded="true"], #btnMat[aria-expanded="true"]'],
    ['#btnKeys[aria-pressed="true"]', '#btnKeys'],                                      // NES family
  ];
  /* The Control Bar (play/shared/control-bar.js, 2026-10-07) owns its own
     menus, panels and full screen: when it is on, it is asked first, and the
     page's old selectors below are never consulted for it. */
  const bar = () => (window.ControlBar && window.ControlBar.active ? window.ControlBar : null);
  function closeSub() {
    const B = bar();
    if (B) return !!B.back();
    for (const [open, back] of SUBS) {
      if (!$(open)) continue;
      const b = $(back);
      if (b) { b.click(); return true; }
    }
    return false;
  }

  /* Is a screen of this window open (a Control Bar panel or menu, or one of the
     older Keys / Saves screens)? play-pad.js asks, so the pad drives it. */
  function subOpen() {
    const B = bar();
    if (B) { const s = B.state || {}; return !!(s.panel || s.menu); }
    return SUBS.some(([open]) => !!$(open));
  }
  /* A screen closed by Back: when none is left, tell the host, which goes back
     to its pause menu if the screen was opened from it (keys.js, 2026-10-14). */
  function toldClosed() {
    setTimeout(() => { if (!subOpen() && framed) { try { window.parent.postMessage({ gnwSubClosed: 1 }, '*'); } catch (_) {} } }, 0);
  }

  addEventListener('keydown', e => {
    if (!isBack(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    if (closeSub()) { toldClosed(); return; }
    if (framed) { try { window.parent.postMessage({ gnwBack: 1, key: e.key || String(e.keyCode) }, '*'); } catch (_) {} }
  }, true);
  addEventListener('keyup', e => {
    if (!isBack(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);

  /* ---- Game help (2026-10-04): the help key opens the host's help over the game ----
     The help key is the site's own (actions.js 'help.open': ? by default, the viewer's
     rebinding, a remote's Blue key), read from the host page. It never reaches the game:
     taken here, in the capture phase, before any game handler, down and up. A Shift held
     for ? is let go in the game first (Right Shift is Select on several consoles), since
     the key-up lands on the host page once the help has taken focus. */
  const helpCodes = new Set();
  function isHelp(e) {
    if (e.ctrlKey || e.altKey || e.metaKey || isField(e.target) || e.__gnwRemap) return false;
    if (window.gnwKbTyping) return false;     /* NES Family BASIC keyboard typing: '?' is a character */
    let F = null; try { F = framed && window.parent.Actions; } catch (_) { F = null; }
    if (F && typeof F.match === 'function') { try { return F.match(e, 'global') === 'help.open'; } catch (_) { return false; } }
    return e.key === '?' || e.key === 'ColorF3Blue' || e.keyCode === 406;
  }
  function releaseShift() {
    for (const code of ['ShiftLeft', 'ShiftRight']) {
      try { (document.activeElement || document.body || document).dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', code, bubbles: true, cancelable: true, composed: true, location: code === 'ShiftRight' ? 2 : 1 })); } catch (_) {}
    }
  }
  function askHelp() {
    if (!framed) return false;
    releaseShift();
    try { window.parent.postMessage({ gnwHelp: 1 }, '*'); } catch (_) { return false; }
    return true;
  }
  addEventListener('keydown', e => {
    if (!isHelp(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    helpCodes.add(e.code || e.key);
    if (!e.repeat) askHelp();
  }, true);
  addEventListener('keyup', e => {
    if (!helpCodes.has(e.code || e.key) && !isHelp(e)) return;
    helpCodes.delete(e.code || e.key);
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);

  /* ---- the window's own actions, for the host's pause menu ---- */
  const PAUSE = ['#btnPause', '#twin-pause', '#tj-pause'];
  const CONTROLS = ['#btnKeys', '#twin-keys-btn', '#tj-keys-btn'];
  const SAVES = ['#btnSaves', '#twin-save', '#tj-save'];
  const first = list => { for (const s of list) { const el = $(s); if (el) return el; } return null; };
  const pressed = el => el && el.getAttribute('aria-pressed') === 'true';
  // Not started yet (the colour twins wait for "Insert batteries"): nothing to
  // pause, and their buttons would only answer with a toast.
  const idle = () => !!$('.tap-to-play:not(.gone)');

  window.gnwPlayKeys = {
    has() {
      const live = !idle();
      const B = bar();
      if (B) { const h = B.has(); return { pause: live && h.pause, controls: live && h.controls, saves: live && h.saves, bar: live && h.bar }; }
      return { pause: live && !!(window.__gnwPause || first(PAUSE)), controls: live && !!first(CONTROLS), saves: live && !!first(SAVES) };
    },
    /* Returns true when this call changed the state, so the host only undoes
       its own pause and never a pause the player chose. */
    pause(on) {
      const B = bar();
      if (B) return !!B.pause(!!on);
      if (typeof window.__gnwPause === 'function') return !!window.__gnwPause(!!on);
      if (on && idle()) return false;
      const b = first(PAUSE);
      if (!b || pressed(b) === !!on) return false;
      b.click();
      return pressed(b) === !!on;
    },
    controls() { const B = bar(); if (B) return B.controls(); const b = first(CONTROLS); if (b && !pressed(b)) b.click(); return !!b; },
    saves() { const B = bar(); if (B) return B.saves(); const b = first(SAVES); if (b) b.click(); return !!b; },
    /* The pause menu's "Control Bar" item: focus onto the bar, so a remote or a
       pad reaches every item (A9: the bar never hides, TV included). */
    focusBar() { const B = bar(); if (!B) return false; B.focusBar(); return true; },
    focusGame() { try { window.focus(); } catch (_) {} },
    subOpen, closeSub,
    help: askHelp,                       // play-pad.js: the pad's help button (R3)
  };
})();

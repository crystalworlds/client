/*
 * docterms.js -- the terms box before the Emulation pages (4 Nov 2026).
 *
 * The first time a visitor opens an Emulation page in this browser (a system's Emulation page
 * in the documentation window, a "See the proof" card, the rebuild table's links, or a game
 * drawer's Emulation tab), a short box over the page sums up the terms the documentation is
 * under and asks "I agree" or "Not now". The page's text is drawn behind it but cannot be
 * scrolled, selected or focused until the visitor agrees: the text is inert, its scroller is
 * held still (wheel, touch, keys, a controller, the scroll bar), and the focus stays in the box.
 * The rest of the site stays usable (a drawer's other tabs, its close box, the window's x).
 *
 *   I agree   remembered in this browser under 'cw.docterms' = the licence version. A new
 *             licence version (VERSION below, the version line of licenses/LICENSE) asks again.
 *             Storage blocked (a private window): agreed for this page load only.
 *   Not now   closes it back to where the visitor came from: the drawer's tab before, or the
 *             documentation window closes.
 *   Keys      Tab / Shift+Tab and the arrows move in the box; Enter or Space presses; Escape
 *             and every Back key (a TV remote's included) is Not now. A controller is the
 *             same (gamepad.js presses these keys at the focus: A = Enter, B = Escape).
 *
 * The pages only exist on crystalworlds.media (index.html head, __cwNoDocs), so the box does too.
 * Hooks: index.html switchDrawerTab -> cwDocTerms.drawerTab; emulators-table.js openProof ->
 * cwDocTerms.proof. Plain script, no build step; its CSS is added below.
 */
(function () {
  'use strict';
  if (window.cwDocTerms) return;

  const VERSION = '1.1';                 // licenses/LICENSE "Version 1.1": change both together
  const KEY = 'cw.docterms';
  let agreedNow = false;                 // this page load, whatever storage allows

  function agreed() {
    if (agreedNow) return true;
    try { return localStorage.getItem(KEY) === VERSION; } catch (_) { return false; }
  }
  function remember() {
    agreedNow = true;
    try { localStorage.setItem(KEY, VERSION); } catch (_) {}
  }

  /* ------------------------------------------------------------ the words */
  const HTML =
    '<h2 class="cw-terms-h" id="cw-terms-h">Before you read</h2>' +
    '<p id="cw-terms-d">Our Emulation pages are free to read. Please agree to the terms they are under first:</p>' +
    '<ul class="cw-terms-list">' +
      '<li>You may read, study and cite them, and check our results, freely.</li>' +
      '<li>They are for personal and educational use.</li>' +
      '<li>You may not use them, or our source code and emulator cores, to build other emulators or front ends.</li>' +
      '<li>You may not have an AI or any other automated tool build software mainly from them, or train an AI on them.</li>' +
      '<li>When you quote them, credit CrystalWorlds.Media.</li>' +
    '</ul>' +
    '<p class="cw-terms-more"><a href="licenses/LICENSE" download="CrystalWorlds-Licence-1.1.txt" target="_blank" rel="noopener">Read the full licence (version ' + VERSION + ')</a></p>' +
    '<div class="cw-terms-btns">' +
      '<button type="button" class="cw-terms-yes">I agree</button>' +
      '<button type="button" class="cw-terms-no">Not now</button>' +
    '</div>';

  /* ------------------------------------------------------------ the look */
  const CSS = `
  .cw-terms-locked { -webkit-user-select: none; user-select: none; opacity: .32; pointer-events: none; }
  .cw-terms {
    position: absolute; z-index: 40; box-sizing: border-box; margin: 0;
    background: var(--bg-1, #11161f); color: var(--text, #e7ecf2);
    border: 1px solid var(--line, #2a3242); border-radius: 16px;
    box-shadow: 0 18px 60px rgba(0, 0, 0, .55);
    padding: 22px 26px 24px; overflow-y: auto; overscroll-behavior: contain;
    text-align: left; font-size: 1rem; line-height: 1.5; -webkit-user-select: text; user-select: text;
  }
  :root[data-theme="light"] .cw-terms { box-shadow: 0 18px 60px rgba(20, 30, 50, .28); }
  .cw-terms .cw-terms-h { margin: 0 0 8px; font-size: 1.35rem; line-height: 1.25; color: var(--text, #e7ecf2); }
  .cw-terms p { margin: 0 0 10px; }
  .cw-terms .cw-terms-list { margin: 0 0 12px; padding-left: 1.25em; }
  .cw-terms .cw-terms-list li { margin: 0 0 6px; }
  .cw-terms a { color: var(--text, #e7ecf2); text-decoration: underline; text-underline-offset: 3px; }
  .cw-terms .cw-terms-btns { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 18px; }
  .cw-terms button {
    min-height: 48px; min-width: 140px; padding: 10px 22px; box-sizing: border-box;
    font: inherit; font-weight: 700; border-radius: 12px; cursor: pointer;
  }
  .cw-terms .cw-terms-yes { background: var(--accent, #9be15d); color: var(--on-accent, #0a0e14); border: 2px solid var(--accent, #9be15d); }
  .cw-terms .cw-terms-no { background: transparent; color: var(--text, #e7ecf2); border: 2px solid var(--muted, #8a94a6); }
  .cw-terms.cw-terms-narrow { padding: 18px 16px 18px; border-radius: 14px; }
  .cw-terms.cw-terms-narrow .cw-terms-btns button { flex: 1 1 0; min-width: 0; }
  `;
  function addCSS() {
    if (document.getElementById('cw-terms-css')) return;
    const s = document.createElement('style');
    s.id = 'cw-terms-css';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ------------------------------------------------------------ the box */
  let cur = null;          // the box on screen: { kind, host, frame, scroller, content, header, box, ... }
  let lastPointer = 0;
  window.addEventListener('pointerdown', () => { lastPointer = Date.now(); }, true);

  const BACK = new Set(['Escape', 'Esc', 'Backspace', 'GoBack', 'BrowserBack', 'XF86Back']);
  const STILL = new Set(['PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar']);

  function focusEl(el) {
    if (!el) return;
    const ring = Date.now() - lastPointer > 800;   // keys, a remote or a controller: show the ring
    try { el.focus({ preventScroll: true, focusVisible: ring }); } catch (_) { try { el.focus(); } catch (__) {} }
  }
  function controls(c) { return [c.box.querySelector('.cw-terms-more a'), c.yes, c.no].filter(Boolean); }

  function scrollerOf(frame, host) {
    for (const el of [frame, host]) {
      if (el && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) return el;
    }
    return host || frame;
  }

  function place() {
    const c = cur;
    if (!c || !c.box.isConnected) return;
    const f = c.frame, fr = f.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const w = f.clientWidth;
    const narrow = w < 600;
    c.box.classList.toggle('cw-terms-narrow', narrow);
    const bw = narrow ? Math.max(200, w - 24) : Math.min(580, w - 48);
    c.box.style.width = bw + 'px';
    c.box.style.left = Math.round((w - bw) / 2) + 'px';
    let top = Math.max(fr.top, 0), bottom = Math.min(fr.bottom, vh);
    if (c.header && c.header.isConnected) {
      const hb = c.header.getBoundingClientRect().bottom;
      if (hb > top && hb < bottom - 120) top = hb;
    }
    const room = Math.max(160, bottom - top - 24);
    c.box.style.maxHeight = room + 'px';
    const h = Math.min(c.box.offsetHeight, room);
    const y = top + Math.max(12, (bottom - top - h) / 2);
    c.box.style.top = Math.round(y - fr.top - f.clientTop + (c.scroller === f ? f.scrollTop : 0)) + 'px';
  }

  function ungate() {
    const c = cur;
    if (!c) return;
    cur = null;
    try { c.obs.forEach(o => o.disconnect()); } catch (_) {}
    try { c.ro && c.ro.disconnect(); } catch (_) {}
    c.timers.forEach(t => clearTimeout(t));
    window.removeEventListener('resize', place);
    try { window.visualViewport && window.visualViewport.removeEventListener('resize', place); } catch (_) {}
    document.removeEventListener('focusin', c.onFocus, true);
    c.host.removeEventListener('wheel', c.block, { capture: true });
    c.host.removeEventListener('touchmove', c.block, { capture: true });
    c.scroller.removeEventListener('scroll', c.onScroll);
    c.scroller.style.overflowY = c.savedOverflow;
    if (c.content) {
      c.content.removeAttribute('inert');
      c.content.classList.remove('cw-terms-locked');
    }
    if (c.box.parentNode) c.box.parentNode.removeChild(c.box);
    if (c.savedPosition != null) c.frame.style.position = c.savedPosition;
  }

  function gate(o) {
    if (agreed() || !o || !o.content || !o.frame || !o.host) return false;
    if (cur && cur.content === o.content && cur.box.isConnected) {   // asked again (the window jumped to its anchor): hold it there
      cur.top = cur.scroller.scrollTop;
      place(); focusEl(cur.yes);
      return true;
    }
    ungate();
    addCSS();
    const box = document.createElement('div');
    box.className = 'cw-terms';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'cw-terms-h');
    box.setAttribute('aria-describedby', 'cw-terms-d');
    box.innerHTML = HTML;
    const scroller = scrollerOf(o.frame, o.host);
    const c = cur = {
      kind: o.kind, host: o.host, frame: o.frame, scroller, content: o.content, header: o.header || null,
      box, yes: box.querySelector('.cw-terms-yes'), no: box.querySelector('.cw-terms-no'),
      savedOverflow: scroller.style.overflowY, top: scroller.scrollTop, obs: [], timers: [], ro: null,
    };

    /* The page behind: drawn, not usable. */
    o.content.setAttribute('inert', '');
    o.content.classList.add('cw-terms-locked');
    scroller.style.overflowY = 'hidden';
    c.onScroll = () => { if (scroller.scrollTop !== c.top) scroller.scrollTop = c.top; };
    scroller.addEventListener('scroll', c.onScroll);
    c.block = e => {
      if (box.contains(e.target) && box.scrollHeight > box.clientHeight + 1) return;   // the box's own scroll (a very small screen)
      if (e.cancelable) e.preventDefault();
    };
    o.host.addEventListener('wheel', c.block, { capture: true, passive: false });
    o.host.addEventListener('touchmove', c.block, { capture: true, passive: false });

    const notNow = () => { ungate(); try { o.notNow && o.notNow(); } catch (_) {} };
    const yes = () => {
      remember();
      const to = o.agreedFocus ? o.agreedFocus() : null;
      ungate();
      focusEl(to);
    };
    c.yes.addEventListener('click', yes);
    c.no.addEventListener('click', notNow);

    box.addEventListener('keydown', e => {
      const k = e.key;
      if (BACK.has(k) || e.keyCode === 10009 || e.keyCode === 461) {
        e.preventDefault(); e.stopPropagation();
        if (!e.repeat) notNow();
        return;
      }
      const list = controls(c), i = list.indexOf(e.target);
      if (k === 'Tab') {
        e.preventDefault(); e.stopPropagation();
        focusEl(list[((i < 0 ? 0 : i) + (e.shiftKey ? -1 : 1) + list.length) % list.length]);
        return;
      }
      if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'ArrowRight' || k === 'ArrowDown') {
        e.preventDefault(); e.stopPropagation();
        const step = (k === 'ArrowLeft' || k === 'ArrowUp') ? -1 : 1;
        focusEl(list[Math.max(0, Math.min(list.length - 1, (i < 0 ? 1 : i + step)))]);
        return;
      }
      if ((k === 'Enter' || k === ' ' || k === 'Spacebar') && i >= 0) {
        e.stopPropagation();
        if (!e.isTrusted || e.__gnwPad) { e.preventDefault(); if (!e.repeat) e.target.click(); }   // a controller's press: the browser does not click for it
        return;
      }
      if (STILL.has(k)) { e.preventDefault(); e.stopPropagation(); }
    });

    /* The focus stays in the box (a click elsewhere still works: a drawer tab, the x). */
    c.onFocus = e => {
      if (!cur || box.contains(e.target) || !o.host.contains(e.target)) return;
      if (Date.now() - lastPointer < 800) return;
      focusEl(c.yes);
    };
    document.addEventListener('focusin', c.onFocus, true);

    /* Gone with its window, or with its page (a drawer drawn again starts on its first tab). */
    const mo1 = new MutationObserver(() => { if (cur === c && !o.host.classList.contains('open')) ungate(); });
    mo1.observe(o.host, { attributes: true, attributeFilter: ['class'] });
    const mo2 = new MutationObserver(() => { if (cur === c && (!o.content.isConnected || !box.isConnected)) ungate(); });
    mo2.observe(o.frame, { childList: true });
    c.obs.push(mo1, mo2);

    const fs = getComputedStyle(o.frame);
    c.savedPosition = null;
    if (fs.position === 'static' && fs.transform === 'none') { c.savedPosition = o.frame.style.position; o.frame.style.position = 'relative'; }
    o.frame.appendChild(box);
    place();
    window.addEventListener('resize', place);
    try { window.visualViewport && window.visualViewport.addEventListener('resize', place); } catch (_) {}
    try { c.ro = new ResizeObserver(() => place()); c.ro.observe(o.frame); c.ro.observe(box); } catch (_) {}
    [60, 350, 900].forEach(ms => c.timers.push(setTimeout(place, ms)));   // the window's own opening slide
    focusEl(c.yes);
    return true;
  }

  /* ------------------------------------------------------------ the hooks */
  /** index.html switchDrawerTab: a drawer tab was chosen; prev = the tab active before it. */
  function drawerTab(modal, tabName, prev) {
    if (tabName !== 'emulation') { if (cur && cur.kind === 'drawer') ungate(); return; }
    if (!modal || agreed()) return;
    const content = modal.querySelector('.drawer-tab-content[data-tab-content="emulation"]');
    const host = modal.closest('.overlay') || modal.parentElement;
    const back = prev && prev.isConnected && prev.getAttribute('data-tab') !== 'emulation'
      ? prev : modal.querySelector('.drawer-tab[data-tab="device"]');
    gate({
      kind: 'drawer', host, frame: modal, content, header: modal.querySelector('.drawer-tabs'),
      notNow: () => {
        if (!back || !back.isConnected || typeof window.switchDrawerTab !== 'function') return;
        window.switchDrawerTab(back, back.getAttribute('data-tab'));
        focusEl(back);
      },
      agreedFocus: () => modal.querySelector('.drawer-tab[data-tab="emulation"]'),
    });
  }
  /** emulators-table.js openProof: the documentation window has opened (isEmu: an Emulation page). */
  function proof(ov, isEmu) {
    if (!isEmu || agreed()) { if (cur && cur.kind === 'proof') ungate(); return; }
    if (!ov) return;
    gate({
      kind: 'proof', host: ov, frame: ov.querySelector('.modal'), content: ov.querySelector('#emu-proof-body'),
      header: ov.querySelector('.modal-head'),
      notNow: () => { if (typeof window.closeOverlay === 'function') window.closeOverlay(ov.id); else ov.classList.remove('open'); },
      agreedFocus: () => ov.querySelector('.modal-close'),
    });
  }

  window.cwDocTerms = {
    VERSION, KEY, agreed, drawerTab, proof,
    isOpen: () => !!cur,
    /* For tools (a recorded tour, a test): agree or forget in this browser. */
    agree: () => { remember(); ungate(); },
    forget: () => { agreedNow = false; try { localStorage.removeItem(KEY); } catch (_) {} },
  };
})();

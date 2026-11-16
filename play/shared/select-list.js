/*
 * play/shared/select-list.js -- THE OPENED LIST OF EVERY DROP-DOWN ON THE SITE (14 Nov 2026).
 *
 * Reported: "When expanding the selection of boot programs one should be clearly selected in the
 * list but they are not. ... It should have the whole row coloured in the users accent color."
 * The browser's own list (the one a <select> opens) marks the current choice only faintly, and
 * only until the pointer moves. So every drop-down on the site (the main page, its Settings, the
 * play windows' Settings rows: Boot program, Machine and the rest) opens THIS list instead:
 *
 *   - the current choice has its whole row filled with the accent colour, its text in the ink the
 *     site already pairs with an accent fill (--on-accent on the page; the dark ink on the Control
 *     Bar, whose accent is always the dark-ground one);
 *   - the list opens scrolled to it, and the focus starts on it, for a mouse, the keyboard, a
 *     TV remote and a controller alike;
 *   - the focus is a separate ring: it moves with Up and Down while the fill stays on the current
 *     choice until another is taken (Enter, OK, A, a click or a tap);
 *   - Escape, Back or B closes the list and keeps the choice.
 *
 * The closed drop-down is untouched: the same <select>, its own look, its own value and change
 * event. Only the opening is ours: a press of the main button, Enter, Space, Alt+Up/Down or F4
 * on it, and a pad's A (a script's click). Taking a choice sets the select's value and sends
 * `input` and `change`, as the browser's list does, so no page code changes.
 *
 * The list is put in the page right after the select (inside the same panel, so the panel's own
 * colours, theme and accent apply, and everything that asks "is the focus in Settings?" still
 * says yes) and shown in the top layer (a manual popover), so no panel edge clips it. It is
 * removed again when it closes. While it is open its keys are its own: they reach no other
 * handler (the browser's own list kept them too), so the page, the Control Bar and the game
 * never see an arrow meant for it.
 *
 * Left as the browser's: a tap with a finger (the phone's own picker), a list of several rows
 * (multiple, size), a disabled select, and a select marked data-native-list.
 */
(function () {
  'use strict';
  if (window.CwSelectList) return;
  const doc = document;

  /* ------------------------------------------------------------------ look */
  const CSS = `
  .cw-sl{position:fixed;inset:auto;margin:0;box-sizing:border-box;overflow:auto;overscroll-behavior:contain;
    padding:4px;border-radius:10px;font:inherit;line-height:1.3;text-align:left;
    --cw-sl-bg:var(--panel,#16161a);--cw-sl-ink:var(--text,#e7ecf2);--cw-sl-line:var(--line,#2a3242);
    --cw-sl-fill:var(--accent,#9be15d);--cw-sl-on:var(--on-accent,#0a0e14);--cw-sl-wash:rgba(var(--accent-rgb,155,225,93),.14);
    background:var(--cw-sl-bg);color:var(--cw-sl-ink);border:1px solid var(--cw-sl-line);
    box-shadow:0 14px 40px rgba(0,0,0,.45);color-scheme:inherit}
  .cw-sl:not(:popover-open).cw-sl-pop{display:none}
  .cb-panel .cw-sl,.cb-menu .cw-sl,.cb-bar .cw-sl,.cw-sl.cw-sl-bar{
    --cw-sl-bg:var(--cw-bar-menu,rgb(20,23,28));--cw-sl-ink:var(--cw-bar-ink,#e6e8ec);--cw-sl-line:rgba(255,255,255,.16);
    --cw-sl-fill:var(--cw-bar-accent,#9be15d);--cw-sl-on:#0a0e14;--cw-sl-wash:rgba(255,255,255,.09)}
  .cw-sl .cw-sl-o{box-sizing:border-box;display:flex;align-items:center;gap:8px;min-height:32px;padding:6px 12px 6px 8px;border-radius:7px;
    cursor:pointer;white-space:nowrap;outline:none;color:inherit;background:transparent}
  .cw-sl .cw-sl-o::before{content:'';flex:0 0 14px;width:14px;text-align:center;font-weight:700}
  .cw-sl .cw-sl-o:hover{background:var(--cw-sl-wash)}
  .cw-sl .cw-sl-o[aria-selected="true"]{background:var(--cw-sl-fill);color:var(--cw-sl-on);font-weight:700}
  .cw-sl .cw-sl-o[aria-selected="true"]::before{content:'\\2713'}
  .cw-sl .cw-sl-o:focus-visible,.cw-sl .cw-sl-o.cw-sl-f{box-shadow:inset 0 0 0 2px var(--cw-sl-ink)}
  .cw-sl .cw-sl-o[aria-selected="true"]:focus-visible,.cw-sl .cw-sl-o[aria-selected="true"].cw-sl-f{box-shadow:inset 0 0 0 2px var(--cw-sl-on),inset 0 0 0 4px var(--cw-sl-fill)}
  .cw-sl .cw-sl-o[aria-disabled="true"]{opacity:.45;cursor:default}
  .cw-sl .cw-sl-o[aria-disabled="true"]:hover{background:transparent}
  .cw-sl .cw-sl-g{padding:8px 10px 3px;font-size:.8em;font-weight:700;letter-spacing:.04em;opacity:.7;white-space:nowrap}
  @media (pointer:coarse){.cw-sl .cw-sl-o{min-height:40px}}
  body.cb-tv .cw-sl .cw-sl-o,body.gnw-tv .cw-sl .cw-sl-o{min-height:40px;font-size:1.05em}
  @media (prefers-reduced-motion:no-preference){.cw-sl .cw-sl-o{transition:background-color .08s}}`;
  function addStyle() {
    if (doc.getElementById('cw-sl-style')) return;
    const s = doc.createElement('style'); s.id = 'cw-sl-style'; s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }

  /* ------------------------------------------------------------------ state */
  let cur = null;              // { sel, list, opts: [el], from }
  let swallowUp = null;        // the key that closed the list: its keyup reaches no one either
  const popOK = typeof HTMLElement !== 'undefined' && 'popover' in HTMLElement.prototype;

  const ours = sel => !!(sel && sel.tagName === 'SELECT' && !sel.multiple && !(sel.size > 1) && !sel.disabled &&
    !(sel.dataset && 'nativeList' in sel.dataset) && sel.isConnected && sel.options.length);
  const enabled = o => o && o.getAttribute('aria-disabled') !== 'true';
  const padSkip = o => !!(o && o.dataset.padSkip);
  const isBack = e => (!e.ctrlKey && !e.altKey && !e.metaKey) &&
    (e.key === 'Escape' || e.key === 'Esc' || e.key === 'GoBack' || e.key === 'BrowserBack' || e.key === 'XF86Back' || e.key === 'Backspace' ||
     e.keyCode === 4 || e.keyCode === 10009 || e.keyCode === 461);
  const synthetic = e => !e.isTrusted || !!e.__gnwPad;

  /* ------------------------------------------------------------------ open */
  function open(sel, from) {
    if (cur) close(false);
    if (!ours(sel)) return false;
    addStyle();
    const list = doc.createElement('div');
    list.className = 'cw-sl';
    list.setAttribute('role', 'listbox');
    list.tabIndex = -1;
    const name = sel.getAttribute('aria-label') || (sel.labels && sel.labels[0] && sel.labels[0].textContent.trim()) || sel.title || '';
    if (name) list.setAttribute('aria-label', name);
    const opts = [];
    let lastGroup = null;
    Array.from(sel.options).forEach((o, i) => {
      if (o.hidden) return;
      const g = o.parentElement && o.parentElement.tagName === 'OPTGROUP' ? o.parentElement : null;
      if (g && g !== lastGroup) { const h = doc.createElement('div'); h.className = 'cw-sl-g'; h.setAttribute('role', 'presentation'); h.textContent = g.label; list.appendChild(h); }
      lastGroup = g;
      const r = doc.createElement('div');
      r.className = 'cw-sl-o'; r.setAttribute('role', 'option'); r.tabIndex = -1;
      r.dataset.i = String(i);
      r.textContent = o.label || o.textContent;
      if (o.title) r.title = o.title;
      if (o.disabled || (g && g.disabled)) r.setAttribute('aria-disabled', 'true');
      if (o.dataset.padSkip) r.dataset.padSkip = '1';
      r.setAttribute('aria-selected', i === sel.selectedIndex ? 'true' : 'false');
      list.appendChild(r); opts.push(r);
    });
    if (!opts.length) return false;
    // Next to the select, inside its panel, but never inside a <label> (a click there would go to the select).
    let at = sel; for (let p = sel.parentElement; p; p = p.parentElement) if (p.tagName === 'LABEL') at = p;
    at.after(list);
    // The select's own type size; the panel's theme comes with the place.
    const cs = getComputedStyle(sel);
    list.style.fontFamily = cs.fontFamily;
    list.style.fontSize = Math.max(13, parseFloat(cs.fontSize) || 13) + 'px';
    if (popOK) { list.setAttribute('popover', 'manual'); list.classList.add('cw-sl-pop'); try { list.showPopover(); } catch (_) {} }
    else list.style.zIndex = '2147483000';
    cur = { sel, list, opts, from };
    place();
    sel.setAttribute('aria-expanded', 'true');
    const start = opts.find(r => r.getAttribute('aria-selected') === 'true') || opts.find(enabled) || opts[0];
    focusRow(start, true);
    return true;
  }

  function place() {
    if (!cur) return;
    const { sel, list } = cur;
    const r = sel.getBoundingClientRect(), vw = innerWidth, vh = innerHeight, gap = 4, edge = 8;
    list.style.minWidth = Math.max(140, Math.round(r.width)) + 'px';
    list.style.maxWidth = Math.max(160, vw - 2 * edge) + 'px';
    list.style.maxHeight = 'none';
    const below = vh - r.bottom - gap - edge, above = r.top - gap - edge;
    const want = list.scrollHeight;
    const down = want <= below || below >= above;
    const room = Math.max(120, down ? below : above);
    const h = Math.min(want, room, 420);
    list.style.maxHeight = h + 'px';
    const w = list.offsetWidth;
    const left = Math.max(edge, Math.min(r.left, vw - w - edge));
    const top = down ? Math.min(r.bottom + gap, vh - h - edge) : Math.max(edge, r.top - gap - h);
    list.style.left = Math.round(left) + 'px';
    list.style.top = Math.round(Math.max(edge, top)) + 'px';
  }

  function focusRow(r, centre) {
    if (!cur || !r) return;
    for (const o of cur.opts) o.classList.toggle('cw-sl-f', o === r);
    try { r.focus({ preventScroll: true, focusVisible: true }); } catch (_) { try { r.focus(); } catch (__) {} }
    // Scroll the list itself (never the page) so the row is in view; on opening, near the middle.
    const L = cur.list, top = r.offsetTop, bot = top + r.offsetHeight;
    if (centre) L.scrollTop = Math.max(0, top - (L.clientHeight - r.offsetHeight) / 2);
    else if (top < L.scrollTop + 4) L.scrollTop = Math.max(0, top - 4);
    else if (bot > L.scrollTop + L.clientHeight - 4) L.scrollTop = bot - L.clientHeight + 4;
  }

  function close(refocus) {
    if (!cur) return;
    const { sel, list } = cur;
    cur = null;
    try { if (popOK && list.matches(':popover-open')) list.hidePopover(); } catch (_) {}
    list.remove();
    sel.removeAttribute('aria-expanded');
    if (refocus && sel.isConnected) { try { sel.focus({ preventScroll: true, focusVisible: true }); } catch (_) { try { sel.focus(); } catch (__) {} } }
  }

  function choose(r) {
    if (!cur || !r || !enabled(r)) return;
    const sel = cur.sel, i = +r.dataset.i;
    close(true);
    if (sel.selectedIndex !== i) {
      sel.selectedIndex = i;
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function step(dir, pad, by) {
    if (!cur) return;
    const opts = cur.opts, a = doc.activeElement;
    let i = opts.indexOf(a); if (i < 0) i = opts.findIndex(o => o.classList.contains('cw-sl-f'));
    let n = by || 1, j = i, best = -1;
    for (let k = i + dir; k >= 0 && k < opts.length; k += dir) {
      if (!enabled(opts[k]) || (pad && padSkip(opts[k]))) continue;
      best = k; if (--n <= 0) break;
    }
    if (best < 0) return;
    j = best;
    focusRow(opts[j], false);
  }
  function edge(last, pad) {
    if (!cur) return;
    const l = cur.opts.filter(o => enabled(o) && !(pad && padSkip(o)));
    if (l.length) focusRow(last ? l[l.length - 1] : l[0], false);
  }

  /* Type to find, as the browser's list does: the next row starting with what was typed. */
  let typed = '', typedAt = 0;
  function typeahead(ch) {
    const now = Date.now();
    typed = (now - typedAt < 800 ? typed : '') + ch.toLowerCase(); typedAt = now;
    const opts = cur.opts, a = opts.indexOf(doc.activeElement);
    const same = typed.length > 1 && typed.split('').every(c => c === typed[0]);
    const q = same ? typed[0] : typed;
    for (let k = 1; k <= opts.length; k++) {
      const o = opts[(Math.max(a, 0) + (q.length > 1 ? k - 1 : k)) % opts.length];
      if (enabled(o) && o.textContent.trim().toLowerCase().startsWith(q)) { focusRow(o, false); return; }
    }
  }

  /* ------------------------------------------------------------------ keys */
  // Capture on the window, registered before the page's own key handlers (this file loads early).
  addEventListener('keydown', e => {
    const t = e.target;
    if (cur && cur.list.contains(t)) {
      e.stopImmediatePropagation();
      const pad = synthetic(e);
      const k = e.key;
      const done = () => { e.preventDefault(); };
      if (k === 'ArrowDown' || k === 'ArrowUp') { done(); if (e.altKey) { swallowUp = k; choose(doc.activeElement); } else step(k === 'ArrowDown' ? 1 : -1, pad); return; }
      if (k === 'PageDown' || k === 'PageUp') { done(); step(k === 'PageDown' ? 1 : -1, pad, 8); return; }
      if (k === 'Home' || k === 'End') { done(); edge(k === 'End', pad); return; }
      if (k === 'Enter' || k === ' ' || k === 'Spacebar') { done(); if (!e.repeat) { swallowUp = k; choose(doc.activeElement); } return; }
      if (isBack(e)) { done(); swallowUp = k; close(true); return; }
      if (k === 'Tab') { done(); close(true); return; }
      if (k === 'ArrowLeft' || k === 'ArrowRight') { done(); return; }
      if (k && k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { done(); typeahead(k); return; }
      return;                               // anything else: the browser's (zoom, reload), nobody else's
    }
    // A closed drop-down: the keys that open the browser's list open ours.
    if (t && t.tagName === 'SELECT' && ours(t) && !e.ctrlKey && !e.metaKey) {
      const k = e.key;
      const opens = k === 'Enter' || k === ' ' || k === 'Spacebar' || k === 'F4' || (e.altKey && (k === 'ArrowDown' || k === 'ArrowUp'));
      if (opens) {
        if (e.repeat) { e.preventDefault(); e.stopImmediatePropagation(); return; }
        if (open(t, synthetic(e) ? 'pad' : 'key')) { e.preventDefault(); e.stopImmediatePropagation(); swallowUp = k; }
      }
    }
  }, true);
  addEventListener('keyup', e => {
    if (swallowUp && e.key === swallowUp) { swallowUp = null; e.stopImmediatePropagation(); return; }
    if (cur && cur.list.contains(e.target)) e.stopImmediatePropagation();
  }, true);

  /* ------------------------------------------------------------------ pointer */
  /* A finger on a phone or tablet keeps the phone's own picker (it marks the current choice in its own
     way, and a page cannot reliably stop it opening, so two lists could show). Every other way in
     (a mouse, a pen, the keyboard, a remote, a controller) opens this one. */
  let lastPtr = 'mouse';
  addEventListener('pointerdown', e => { lastPtr = e.pointerType || 'mouse'; }, { capture: true, passive: true });
  // The main button on a select opens ours instead of the browser's (a second press closes it).
  addEventListener('mousedown', e => {
    const t = e.target;
    if (cur && cur.list.contains(t)) { e.stopPropagation(); return; }
    const sel = t && t.closest ? t.closest('select') : null;
    if (cur && (!sel || sel !== cur.sel)) close(false);
    if (!sel || e.button !== 0 || !ours(sel) || lastPtr === 'touch') return;
    e.preventDefault();
    if (cur && cur.sel === sel) { close(true); return; }
    try { sel.focus({ preventScroll: true }); } catch (_) {}
    open(sel, 'pointer');
  }, true);
  addEventListener('click', e => {
    const t = e.target;
    if (cur && cur.list.contains(t)) {
      e.stopImmediatePropagation();
      const r = t.closest('.cw-sl-o'); if (r) choose(r);
      return;
    }
    // A script's click on a closed select (the play window presses a pad's A this way): open it.
    if (!e.isTrusted && t && t.tagName === 'SELECT' && ours(t) && !cur) { e.stopImmediatePropagation(); open(t, 'pad'); }
  }, true);
  // Moving the mouse over a row moves nothing but the hover wash: the focus ring stays where the keys put it.

  /* ------------------------------------------------------------------ closing by itself */
  addEventListener('focusin', e => { if (cur && !cur.list.contains(e.target)) close(false); }, true);
  /* The panel or page moving under an open list (a smooth scroll still running, a resize): the list
     follows its select, and closes only once the select is out of sight. One measure a frame. */
  let follow = 0;
  function refollow() {
    follow = 0;
    if (!cur) return;
    const r = cur.sel.getBoundingClientRect();
    if (!cur.sel.isConnected || (!r.width && !r.height) || r.bottom < 0 || r.top > innerHeight) { close(false); return; }
    const keep = cur.list.scrollTop; place(); cur.list.scrollTop = keep;
  }
  const onMove = e => { if (cur && !(e && e.target && e.target.nodeType === 1 && cur.list.contains(e.target)) && !follow) follow = requestAnimationFrame(refollow); };
  addEventListener('resize', onMove);
  addEventListener('scroll', onMove, true);
  addEventListener('blur', () => { if (cur) close(false); });
  doc.addEventListener('visibilitychange', () => { if (cur && doc.hidden) close(false); });

  window.CwSelectList = {
    open: sel => open(sel, 'api'),
    close: () => close(true),
    isOpen: () => !!cur,
    current: () => (cur ? cur.sel : null)
  };
})();

/*
 * keybind.js -- keyboard first, phase 5: the viewer's own keys and buttons (2026-10-04).
 *
 * The design is docs/tv-controller-support.md, sections 5.8 and 7 (phase 5). It draws
 * Settings -> "Keyboard & controllers", which has three parts, since 2026-10-17 three tabs
 * (Controller, Keyboard, Game controls) whose contents fold into sections (see PANES and acc()):
 *
 *   KEYBOARD. Every action in the registry (actions.js), grouped as the ? list groups them,
 *   with its keys. Change (or OK on it) asks "Press a key... (Escape cancels)"; Add puts a
 *   second key beside the first. A key another action already answers to on the same screen
 *   is shown in red, naming that action, with Swap and Cancel. A reserved key (Escape and
 *   Backspace are Back, Enter is OK, Tab moves, P and the media Play key play, the remote's
 *   Back) is refused and says why; the rows that own one show it with a lock. Each row has
 *   Reset; Reset all sits at the bottom behind a second press.
 *
 *   GAMEPAD. The pad the browser sees, a live button test (GnwPad.onInput), and the site's
 *   pad buttons, rebound the same way: Change asks "Press a button..." (GnwPad.capture, so the
 *   press runs nothing), Escape or eight seconds cancel.
 *
 *   GAME CONTROLS. One system at a time (the play windows' table, play/play-pad.js): each
 *   console function with its keyboard key and its pad buttons, Change for either, and Reset
 *   for the system. Player 1; player 2 and the window's own keys are shown as taken.
 *
 * Saved per viewer in this browser: the site's keys in 'gnw.keys.v1' (actions.js reads it as
 * it loads, so they apply before the first key), the game keys in 'gnw.keys.games.v1' and the
 * game buttons in 'gnw.pad.games.v2' (play-pad.js reads them on every press). localStorage
 * only, every access wrapped. Nothing is sent to a server.
 *
 * Keyboard, remote and pad reach everything here: Up/Down/Left/Right walk the rows (nav.js),
 * OK presses, Back leaves a capture first, then the panel. No hover is needed anywhere.
 * Sound: none.
 */
(function () {
  'use strict';
  if (window.GnwKeybind) return;

  const BUILD = '20261017-kb12-shortcuts';
  const TAB = 'keys';
  const A = () => window.Actions || null;
  const PP = () => window.gnwPlayPad || null;
  const PAD = () => window.GnwPad || null;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isPadKey = k => typeof k === 'string' && k.slice(0, 4) === 'Pad:';
  const DEVICE = /^(#|Media|Browser|GoBack|XF86|Channel|AudioVolume|Launch|Info|Guide|ColorF)/;
  const isRemoteKey = k => !isPadKey(k) && DEVICE.test(k);
  const kindOf = k => (isPadKey(k) ? 'pad' : isRemoteKey(k) ? 'remote' : 'keyboard');
  const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Select', 'Start', 'L3', 'R3', 'Up', 'Down', 'Left', 'Right', 'Home'];
  const SYSTEMS = ['gb', 'nes', 'a2600', 'a5200', 'a7800', 'alynx', 'twin', 'tj', 'gnw', 'pm'];
  const SYS_SHORT = { gb: 'Game Boy', nes: 'NES', a2600: 'Atari 2600', a5200: 'Atari 5200', a7800: 'Atari 7800', alynx: 'Atari Lynx', twin: 'Mario / Zelda', tj: 'Tetris Jr.', gnw: 'Game & Watch', pm: 'Pokémon mini' };

  /* TABS AND FOLDING SECTIONS (2026-10-17: the menu was far too long). Three tabs at the
     top: Controller, Keyboard, Game controls; inside them, sections that fold (<details>, so a
     keyboard's Enter, a pad's A and a tap all open and close them; nothing needs hover). Which
     tab and which sections are open is remembered on this device (a convenience only). */
  const UI_KEY = 'gnw.keys.ui.v1';
  const PANES = [['pad', 'Controller'], ['keys', 'Keyboard'], ['games', 'Game controls']];
  let ui = { tab: null, open: ['pad-letters', 'pad-test'] };
  try { const o = JSON.parse(localStorage.getItem(UI_KEY) || 'null'); if (o && typeof o === 'object') ui = { tab: PANES.some(p => p[0] === o.tab) ? o.tab : null, open: Array.isArray(o.open) ? o.open.slice(0, 60) : ui.open }; } catch (_) {}
  const openSet = new Set(ui.open);
  function saveUi() { try { localStorage.setItem(UI_KEY, JSON.stringify({ tab: ui.tab, open: Array.from(openSet) })); } catch (_) {} }
  const acc = (id, title, body, note) => `<details class="kb-acc" data-kb-acc="${esc(id)}"${openSet.has(id) ? ' open' : ''}>
      <summary class="kb-acc-h" tabindex="0"><span>${esc(title)}</span>${note ? `<span class="kb-acc-n">${esc(note)}</span>` : ''}</summary>
      <div class="kb-acc-b">${body}</div></details>`;

  /* ------------------------------------------------------------ styles */

  function styles() {
    if (document.getElementById('kb-style')) return;
    const st = document.createElement('style');
    st.id = 'kb-style';
    st.textContent = `
      .kb-scroll { max-height: min(60vh, 600px); overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding-right: 4px; }
      .kb-h { display:block; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--muted); margin-bottom:6px; }
      .kb-note { color:var(--muted); font-size:12.5px; margin:0 0 12px; line-height:1.55; }
      .kb-group { font-size:12px; font-weight:700; color:var(--text); margin:14px 0 6px; letter-spacing:.02em; }
      .kb-group:first-of-type { margin-top: 4px; }
      .kb-row { display:grid; grid-template-columns: minmax(0,1fr) auto; gap:6px 12px; align-items:center; padding:8px 10px; border-radius:10px; border:1px solid transparent; }
      .kb-row:nth-child(even) { background: rgba(255,255,255,.02); }
      :root[data-theme="light"] .kb-row:nth-child(even) { background: rgba(0,0,0,.025); }
      .kb-row.kb-busy { border-color: rgba(var(--accent-rgb,155,225,93),.55); }
      .kb-row.kb-bad { border-color: rgba(240,80,80,.65); }
      .kb-label { font-size:13px; color:var(--text); line-height:1.4; }
      .kb-keys { display:flex; flex-wrap:wrap; gap:5px; margin-top:4px; }
      .kb-cap { font: 600 12px/1 ui-monospace, Consolas, monospace; padding:4px 7px; border-radius:6px; border:1px solid var(--line,#2a3342); color:var(--text); background:rgba(255,255,255,.04); white-space:nowrap; }
      .kb-cap.kb-fixed::before { content:'\\1F512\\FE0E'; font-size:10px; margin-right:4px; opacity:.75; }
      .kb-cap.kb-pad { border-radius: 999px; }
      .kb-cap.kb-none { color:var(--muted); border-style:dashed; }
      .kb-tag { font-size:11px; color:var(--muted); margin-left:6px; }
      .kb-tag.kb-custom { color: var(--accent); }
      .kb-btns { display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end; }
      .kb-btn { appearance:none; font:inherit; font-size:12.5px; font-weight:600; color:var(--text); cursor:pointer; background:rgba(255,255,255,.05);
        border:1px solid var(--line,#2a3342); border-radius:8px; padding:6px 11px; }
      .kb-btn:hover, .kb-btn:focus-visible { background:rgba(255,255,255,.1); }
      .kb-btn:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
      .kb-btn[aria-pressed="true"] { background:var(--accent); border-color:var(--accent); color:var(--on-accent, #0b0f14); }
      .kb-btn[aria-pressed="true"]:hover, .kb-btn[aria-pressed="true"]:focus-visible { background:var(--accent); filter:brightness(1.08); }
      .kb-btn[disabled] { opacity:.45; cursor:default; }
      :root[data-theme="light"] .kb-btn { background:rgba(0,0,0,.04); }
      .kb-btn.kb-warn { border-color: rgba(240,80,80,.6); color:#ff8a8a; }
      :root[data-theme="light"] .kb-btn.kb-warn { color:#b42318; }
      .kb-msg { grid-column: 1 / -1; font-size:12.5px; line-height:1.5; color:var(--muted); display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
      .kb-msg:empty { display:none; }
      .kb-msg.kb-red { color:#ff8a8a; }
      :root[data-theme="light"] .kb-msg.kb-red { color:#b42318; }
      .kb-msg.kb-ask { color: var(--accent); }
      .kb-test { display:flex; flex-wrap:wrap; gap:6px; margin:8px 0 4px; }
      .kb-test .kb-cap.on { background: rgba(var(--accent-rgb,155,225,93),.3); border-color: var(--accent); }
      .kb-systems { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px; }
      .kb-gt { display:grid; grid-template-columns: minmax(0,1fr) auto auto; gap:6px 10px; align-items:center; }
      .kb-gt .kb-row { grid-column: 1 / -1; grid-template-columns: minmax(0,1fr) auto auto; }
      .kb-gt .kb-cell { display:flex; gap:6px; align-items:center; justify-content:flex-end; flex-wrap:wrap; }
      .kb-foot { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
      .kb-tabs { display:flex; gap:6px; flex-wrap:wrap; position:sticky; top:0; z-index:1; padding:2px 0 8px; background:var(--bg-1, #11161f); border-bottom:1px solid var(--line,#2a3342); }
      .kb-tab { appearance:none; font:inherit; font-size:13px; font-weight:700; color:var(--muted); cursor:pointer; background:transparent;
        border:1px solid var(--line,#2a3342); border-radius:999px; padding:7px 14px; }
      .kb-tab[aria-selected="true"] { color:var(--text); background: rgba(var(--accent-rgb,155,225,93),.18); border-color: var(--accent); }
      .kb-tab:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
      .kb-pane[hidden] { display:none; }
      .kb-pane { display:flex; flex-direction:column; gap:8px; }
      .kb-acc { border:1px solid var(--line,#2a3342); border-radius:12px; background:rgba(255,255,255,.015); }
      :root[data-theme="light"] .kb-acc { background:rgba(0,0,0,.015); }
      .kb-acc-h { list-style:none; cursor:pointer; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px;
        font-size:13px; font-weight:700; color:var(--text); border-radius:12px; }
      .kb-acc-h::-webkit-details-marker { display:none; }
      .kb-acc-h::after { content:'+'; font-weight:700; color:var(--muted); margin-left:auto; }
      .kb-acc[open] > .kb-acc-h::after { content:'\\2212'; }
      .kb-acc-h:focus-visible { outline:2px solid var(--accent); outline-offset:-2px; }
      .kb-acc-n { font-size:11.5px; font-weight:500; color:var(--muted); }
      .kb-acc-b { padding:0 12px 12px; }
      .kb-id { font: 11px/1.4 ui-monospace, Consolas, monospace; color:var(--muted); word-break:break-all; }
      body.gnw-tv .kb-tab { font-size:16px; padding:9px 18px; }
      body.gnw-tv .kb-acc-h { font-size:16px; }
      body.gnw-tv .kb-label { font-size:16px; }
      body.gnw-tv .kb-btn { font-size:15px; padding:9px 14px; }
      body.gnw-tv .kb-cap { font-size:14px; padding:5px 8px; }
      @media (max-width: 760px) { .kb-row, .kb-gt .kb-row { grid-template-columns: 1fr; } .kb-btns, .kb-gt .kb-cell { justify-content:flex-start; } }
    `;
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------ capture: "press a key / a button" */

  let cap = null;     // { kind: 'key'|'code'|'pad', done(value), cancel(), el, timer, releasePad }
  function endCapture(silent) {
    const c = cap; if (!c) return;
    cap = null;
    clearTimeout(c.timer);
    if (c.releasePad) { try { c.releasePad(); } catch (_) {} }
    if (c.row) c.row.classList.remove('kb-busy');
    if (!silent && c.onCancel) c.onCancel();
  }
  function startCapture(c) {
    endCapture(true);
    cap = c;
    if (c.row) c.row.classList.add('kb-busy');
    if (c.kind === 'pad') {
      const P = PAD();
      if (P && P.capture) {
        const fn = (k, i, pos) => { if (cap !== c) return; const v = k; endCapture(true); c.done(v, pos); };
        c.releasePad = P.capture(fn);
      }
      c.timer = setTimeout(() => { if (cap === c) { endCapture(true); c.onTimeout && c.onTimeout(); } }, 8000);
    }
  }
  const MOD_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta', 'OS', 'AltGraph']);
  // Before every other key handler on the page (the Back ladder, nav.js, quick jump): while a
  // capture is up, the key is the answer and nothing else sees it.
  window.addEventListener('keydown', e => {
    if (!cap) return;
    const c = cap;
    if (e.key === 'Escape' || e.key === 'GoBack' || e.key === 'BrowserBack' || e.keyCode === 10009 || e.keyCode === 461) {
      e.preventDefault(); e.stopImmediatePropagation();
      endCapture(false);
      return;
    }
    if (c.kind === 'pad') { e.preventDefault(); e.stopImmediatePropagation(); return; }   // only a pad button answers this one
    if (MOD_KEYS.has(e.key)) return;                                                      // wait for the key the modifier is held with
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat) return;
    const F = A();
    const v = c.kind === 'code' ? { code: e.code, mods: e.ctrlKey || e.altKey || e.metaKey, key: e.key } : (F ? F.comboOf(e) : '');
    endCapture(true);
    c.done(v);
  }, true);
  window.addEventListener('keyup', e => { if (cap && !MOD_KEYS.has(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);

  /* ------------------------------------------------------------ the panel */

  let panel = null, gameSys = 'gb', confirmReset = 0, unsubInput = null;

  function mount() {
    const tabs = document.querySelector('#vault-overlay .settings-tabs');
    const panels = document.querySelector('#vault-overlay .settings-panels');
    if (!tabs || !panels) return false;
    styles();
    if (!tabs.querySelector('[data-tab="' + TAB + '"]')) {
      const b = document.createElement('button');
      b.className = 'settings-tab'; b.type = 'button';
      b.dataset.tab = TAB;
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', 'false');
      b.textContent = 'Keyboard & controllers';
      b.addEventListener('click', () => { if (typeof window.switchSettingsTab === 'function') window.switchSettingsTab(TAB); render(); });
      const after = tabs.querySelector('[data-tab="display"]') || tabs.querySelector('[data-tab="appearance"]');
      if (after && after.nextSibling) tabs.insertBefore(b, after.nextSibling); else tabs.appendChild(b);
    }
    if (!panels.querySelector('.settings-panel[data-panel="' + TAB + '"]')) {
      panel = document.createElement('div');
      panel.className = 'settings-panel'; panel.dataset.panel = TAB; panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-label', 'Keyboard & controllers');
      panel.innerHTML = `<div class="kb-scroll">
          <div class="kb-tabs" role="tablist" aria-label="Keyboard and controllers">${PANES.map(([id, label]) =>
            `<button type="button" class="kb-tab" role="tab" id="kb-tab-${id}" data-kb-tab="${id}" aria-controls="kb-pane-${id}" aria-selected="false">${esc(label)}</button>`).join('')}</div>
          ${PANES.map(([id]) => `<div class="kb-pane" id="kb-pane-${id}" data-kb-pane="${id}" role="tabpanel" aria-labelledby="kb-tab-${id}" hidden><div data-kb="${id}"></div></div>`).join('')}
          <details class="kb-acc" data-kb-acc="reset"><summary class="kb-acc-h" tabindex="0"><span>Reset everything</span></summary><div class="kb-acc-b" data-kb="reset"></div></details>
        </div>`;
      panel.addEventListener('click', onClick);
      // A section opened or closed: remembered (toggle does not bubble, so listen in the capture phase).
      panel.addEventListener('toggle', e => {
        const d = e.target, id = d && d.dataset ? d.dataset.kbAcc : null;
        if (!id || id === 'reset') return;
        if (d.open) openSet.add(id); else openSet.delete(id);
        saveUi();
      }, true);
      panels.appendChild(panel);
      setTab(ui.tab || defaultTab(), false);
    } else panel = panels.querySelector('.settings-panel[data-panel="' + TAB + '"]');
    render();
    return true;
  }

  /* With a controller connected the Controller tab comes first; otherwise the keyboard. */
  function defaultTab() { const P = PAD(); return P && P.pads && P.pads().length ? 'pad' : 'keys'; }
  function setTab(id, focus) {
    if (!panel || !PANES.some(p => p[0] === id)) return;
    if (cap) endCapture(true);
    ui.tab = id;
    panel.querySelectorAll('[data-kb-tab]').forEach(b => { const on = b.dataset.kbTab === id; b.setAttribute('aria-selected', String(on)); b.tabIndex = 0; });
    panel.querySelectorAll('[data-kb-pane]').forEach(p => { p.hidden = p.dataset.kbPane !== id; });
    if (focus) { const b = panel.querySelector('[data-kb-tab="' + id + '"]'); if (b) try { b.focus({ preventScroll: true }); } catch (_) {} }
  }

  const keyCaps = (keys, fixed, cls) => keys.length
    ? keys.map(k => `<span class="kb-cap${fixed.includes(k) ? ' kb-fixed' : ''}${cls ? ' ' + cls : ''}"${fixed.includes(k) ? ' title="Reserved: cannot be changed"' : ''}>${esc(A().format(k))}</span>`).join('')
    : `<span class="kb-cap kb-none${cls ? ' ' + cls : ''}">none</span>`;
  const btn = (act, label, extra, disabled) => `<button type="button" class="kb-btn" data-kb-act="${act}"${extra || ''}${disabled ? ' disabled' : ''}>${esc(label)}</button>`;

  /* -- the keyboard list -- */
  function groupsInOrder() {
    const F = A(); if (!F) return [];
    const seen = Array.from(new Set(F.list().map(a => a.group)));
    const order = (F.GROUPS || []).filter(g => seen.includes(g));
    return order.concat(seen.filter(g => !order.includes(g)));
  }
  function keyRow(a, where) {
    const F = A();
    const fixed = F.fixedKeys(a.id);
    const pad = where === 'pad';
    const shown = (F.shownKeys ? F.shownKeys(a.keys) : a.keys).filter(k => pad ? isPadKey(k) : !isPadKey(k));
    const editable = F.editable(a.id);
    const custom = F.isCustom(a.id);
    const canAdd = editable && !(a.scope === 'back' && !pad);
    return `<div class="kb-row" data-kb-id="${esc(a.id)}" data-kb-where="${where}">
        <div><div class="kb-label">${esc(a.label)}${custom ? '<span class="kb-tag kb-custom">changed</span>' : ''}${!editable ? '<span class="kb-tag">fixed</span>' : ''}</div>
          <div class="kb-keys">${keyCaps(shown, fixed, pad ? 'kb-pad' : '')}</div></div>
        <div class="kb-btns">${editable ? btn('change', 'Change', ` aria-label="Change the ${pad ? 'button' : 'key'} for: ${esc(a.label)}"`, !canAdd) + btn('add', 'Add', ` aria-label="Add a ${pad ? 'button' : 'key'} for: ${esc(a.label)}"`, !canAdd) + btn('reset', 'Reset', ` aria-label="Reset: ${esc(a.label)}"`, !custom) : ''}</div>
        <div class="kb-msg" role="status" aria-live="polite"></div>
      </div>`;
  }
  function renderKeys() {
    const box = panel && panel.querySelector('[data-kb="keys"]'); if (!box) return;
    const F = A(); if (!F) { box.innerHTML = '<p class="kb-note">Loading…</p>'; return; }
    let html = `<p class="kb-note">Every key the site answers to, in groups: open one to see its keys. <strong>Change</strong> (or OK) and press a key; Escape cancels.
      Keys with a lock are reserved: Escape and Backspace are Back, Enter is OK, P and the media Play key play.
      Saved on this device.</p>`;
    for (const g of groupsInOrder()) {
      // Every action: those with a key, and those without one yet that a key could run.
      const rows = F.list({ group: g }).filter(a => a.keys.some(k => !isPadKey(k)) || (F.editable(a.id) && !a.keys.length));
      if (!rows.length) continue;
      const changed = rows.filter(a => F.isCustom(a.id)).length;
      html += acc('keys-' + g, g, rows.map(a => keyRow(a, 'keys')).join(''), rows.length + (rows.length === 1 ? ' action' : ' actions') + (changed ? ', ' + changed + ' changed' : ''));
    }
    box.innerHTML = html;
  }

  /* -- the gamepad -- */
  function padActions() {
    const F = A(); if (!F) return [];
    return F.list().filter(a => F.editable(a.id) && (a.keys.some(isPadKey) || F.defaultsFor(a.id).some(isPadKey)));
  }
  function renderPad() {
    const box = panel && panel.querySelector('[data-kb="pad"]'); if (!box) return;
    const P = PAD();
    const pads = P && P.pads ? P.pads() : [];
    /* Plain words (2026-10-17: nobody will understand "Button letters"). */
    const LAY = { nintendo: 'A is the right-hand button, like a Nintendo controller', xbox: 'A is the bottom button, like an Xbox controller' };
    const layOpt = (p, v, t) => `<button type="button" class="theme-opt${p.setting === v ? ' active' : ''}" role="radio" aria-checked="${p.setting === v}" data-kb-layout="${v}" data-kb-pad="${p.index}">${t}</button>`;
    const layRows = pads.map(p => `
        <div class="kb-layrow" style="margin:8px 0;">
          <div class="kb-note" style="margin-bottom:6px;"><strong>${esc(p.name)}</strong>: ${LAY[p.layout] || ''} (${p.setting === 'auto' ? 'chosen automatically' : 'your choice'}).</div>
          <span role="radiogroup" aria-label="Button layout for ${esc(p.name)}">${layOpt(p, 'auto', 'Automatic')}${layOpt(p, 'xbox', 'A at the bottom (Xbox)')}${layOpt(p, 'nintendo', 'A on the right (Nintendo)')}</span>
          <button type="button" class="kb-btn" data-kb-act="calib" data-kb-pad="${p.index}">Press A to set</button>
          <span class="kb-msg" data-kb-calmsg="${p.index}"></span>
        </div>`).join('');
    const letters = pads.length ? `${layRows}
        <p class="kb-note" style="margin-top:6px;">The button marked A selects, and is A in every game; B goes back. If A and B feel swapped, choose <strong>Press A to set</strong> and press the button marked A. Saved for each controller.</p>`
      : '<p class="kb-note">No controller found. Connect one (USB or Bluetooth) and press any button.</p>';
    const test = `<p class="kb-note">Press any button: its name lights up, by the letter printed on it.</p>
        <div class="kb-test" aria-label="Button test">${PAD_NAMES.map(n => `<span class="kb-cap kb-pad" data-kb-btn="${n}">${esc(A() ? A().format('Pad:' + n).slice(4) : n)}</span>`).join('')}</div>`;
    const site = `<p class="kb-note">What each button does on the site. <strong>Change</strong> and press a button on the controller; Escape (or eight seconds) cancels.
        In a game the controller is the console's own: those buttons are on the Game controls tab.</p>
        ${padActions().map(a => keyRow(a, 'pad')).join('')}`;
    const details = pads.length ? pads.map(p => `<p class="kb-note" style="margin-bottom:8px;"><strong>${esc(p.name)}</strong><br>
        <span class="kb-id">id: ${esc(p.id)}<br>button order: ${esc(p.mapping === 'standard' ? 'the usual one' : 'the controller\'s own')}; platform: ${esc((PAD().platform && PAD().platform()) || 'unknown')}<br>
        button layout: ${esc(p.layout === 'nintendo' ? 'A on the right' : 'A at the bottom')} (${esc(p.setting === 'auto' ? 'automatic: ' + ({ server: 'found in the game server\u2019s list', table: 'recognised by its name' }[p.why] || 'the usual layout') : 'your choice')})${p.db ? '<br>game server: ' + (p.db.found ? 'listed as ' + esc(p.db.name) : 'not listed') + '; ' + esc(p.db.source) + (p.db.version ? ' (list ' + esc(p.db.version) + ')' : '') : '<br>game server: not asked yet (none joined, or not reachable)'}</span></p>`).join('')
      + `<button type="button" class="kb-btn" data-kb-act="relookup">Ask the game server again</button><span class="kb-msg" data-kb-relookup></span>` : '<p class="kb-note">No controller found.</p>';
    /* (A Reverse controllers switch stood here for an hour on 2026-10-17; not needed on this
       screen, the Button layout choices already do it. It stays in the test window.) */
    box.innerHTML = `<div class="kb-foot" style="margin:0 0 10px;"><button type="button" class="kb-btn" data-kb-act="padtest">Test controller</button></div>`
      + (pads.length ? `<p class="kb-note">Found: <strong>${pads.map(p => esc(p.name)).join(', ')}</strong>.</p>` : '')
      + acc('pad-letters', 'Button layout', letters, pads.length ? pads.length + (pads.length === 1 ? ' controller' : ' controllers') : 'none connected')
      + acc('pad-site', 'Buttons on the site', site)
      + acc('pad-short', 'Shortcuts in a game', padShortcuts(), 'every console')
      + acc('pad-details', 'Controller details', details, 'for reporting a problem');
    if (unsubInput) { unsubInput(); unsubInput = null; }
    if (P && P.onInput) unsubInput = P.onInput(list => {
      const held = new Set(); for (const p of list) for (const n of p.held) held.add(n);
      box.querySelectorAll('[data-kb-btn]').forEach(el => el.classList.toggle('on', held.has(el.dataset.kbBtn)));
    });
  }

  /* The confirm button, per controller (gamepad.js LAYOUT_KEY). */
  function setPadLayout(idx, v, note) {
    const P = PAD(); const pad = P && P.pads ? P.pads().find(p => p.index === idx) : null;
    if (!pad || !P.setLayout) return;
    P.setLayout(pad.id, v);
    renderPad();
    const again = panel && panel.querySelector('[data-kb-layout="' + v + '"][data-kb-pad="' + idx + '"]');
    if (again) again.focus({ preventScroll: true });
    const m = note && panel && panel.querySelector('[data-kb-calmsg="' + idx + '"]');
    if (m) m.textContent = note;
  }
  /* One press: the next A-or-B-position button this pad sends is its A. */
  function calibrate(idx) {
    const P = PAD(); if (!P || !P.capture) return;
    const m = panel && panel.querySelector('[data-kb-calmsg="' + idx + '"]');
    if (m) m.textContent = 'Press the button printed A on this controller.';
    let release = null, done = false;
    const t = setTimeout(() => { done = true; if (release) release(); if (m) m.textContent = 'No button pressed. Nothing changed.'; }, 8000);
    release = P.capture((k, i, pos) => {
      if (done) return;
      const pl = P.pads(); if (pl[i] && pl[i].index !== idx) return;          // another controller
      const b = String(pos || k || '').slice(4);
      if (b !== 'A' && b !== 'B') { if (m) m.textContent = 'Press the button printed A (one of the two main face buttons).'; return; }
      done = true; clearTimeout(t); release();
      setPadLayout(idx, b === 'B' ? 'nintendo' : 'xbox', b === 'B' ? 'Saved: A is the right button.' : 'Saved: A is the bottom button.');
    });
  }

  /* THE CONTROLLER'S SHORTCUTS IN A GAME (the play window, 2026-10-17; the same three rows and
     words as the window's own Keys panel, "Controller shortcuts"). Shown on the Controller tab and
     under Game controls. */
  function padShortcuts() {
    const k = t => `<span class="kb-cap kb-pad">${t}</span>`;
    const row = (l, keys, note) => `<div class="kb-row"><div class="kb-label">${l}</div><div class="kb-btns">${keys}${note ? ` <span class="kb-tag">${note}</span>` : ''}</div></div>`;
    return `<div class="kb-group">Controller shortcuts</div>`
      + row('Rewind, held', k('Start') + ' + ' + k('\u2190'))
      + row('Speed up, held', k('Start') + ' + ' + k('\u2192'))
      + row('Menu', k('Select') + ' + ' + k('Start'), 'or Guide; Escape on a keyboard');
  }

  /* -- game controls -- */
  function renderGames() {
    const box = panel && panel.querySelector('[data-kb="games"]'); if (!box) return;
    const pp = PP();
    if (!pp || !pp.table) { box.innerHTML = '<p class="kb-note">Not available on this page.</p>'; return; }
    const t = pp.table(gameSys);
    const pick = SYSTEMS.map(s => `<button type="button" class="theme-opt${s === gameSys ? ' active' : ''}" role="radio" aria-checked="${s === gameSys}" data-kb-sys="${s}">${esc(SYS_SHORT[s])}</button>`).join('');
    const padBy = Object.fromEntries(t.pad.map(r => [r.fn, r]));
    // One row per console function: its keyboard key and its pad buttons.
    const fnRows = (t.direct ? t.pad.map(r => ({ fn: r.fn, label: r.label, key: null })) : t.keys.map(r => ({ fn: r.fn, label: r.label, key: r })))
      .concat(t.direct ? t.keys.filter(k => !t.pad.some(p => p.label === k.label)).map(r => ({ fn: null, label: r.label, key: r })) : []);
    const keyFor = label => t.keys.find(k => k.label === label);
    const rows = fnRows.map(r => {
      const k = r.key || (t.direct ? keyFor(r.label) : null);
      const p = r.fn != null ? padBy[r.fn] : null;
      return `<div class="kb-row" data-kb-fn="${esc(r.fn || '')}" data-kb-kfn="${esc(k ? k.fn : '')}">
          <div class="kb-label">${esc(r.label)}</div>
          <div class="kb-cell">${k ? `<span class="kb-cap">${esc(pp.codeLabel(k.key))}</span>` + btn('gkey', 'Key', ` aria-label="Change the key for ${esc(t.label)}: ${esc(r.label)}"`) : ''}</div>
          <div class="kb-cell">${p ? (p.buttons.length ? p.buttons.map(b => `<span class="kb-cap kb-pad">${esc(b)}</span>`).join('') : '<span class="kb-cap kb-pad kb-none">none</span>') + btn('gpad', 'Button', ` aria-label="Change the pad button for ${esc(t.label)}: ${esc(r.label)}"`) : ''}</div>
          <div class="kb-msg" role="status" aria-live="polite"></div>
        </div>`;
    }).join('');
    box.innerHTML = `<p class="kb-note">Pick a console: each of its buttons for player 1, with its key on the keyboard and its button on a controller.
        Controller buttons are named by the letter marked on them (Button layout, on the Controller tab).</p>
      ${padShortcuts()}
      <div class="kb-systems" role="radiogroup" aria-label="System">${pick}</div>
      <div class="kb-gt" data-kb-sys-table="${gameSys}">${rows}</div>
      <div class="kb-foot" style="margin-top:10px;">${btn('greset', 'Reset ' + SYS_SHORT[gameSys], '', !(t.padCustom || t.keysCustom))}<span class="kb-tag">${t.padCustom || t.keysCustom ? 'Changed from the defaults.' : 'Defaults.'}</span></div>`;
  }

  function renderReset() {
    const box = panel && panel.querySelector('[data-kb="reset"]'); if (!box) return;
    const F = A();
    const n = F ? F.list().filter(a => F.isCustom(a.id)).length : 0;
    const pp = PP();
    const g = pp ? SYSTEMS.filter(s => { const t = pp.table(s); return t && (t.padCustom || t.keysCustom); }).length : 0;
    box.innerHTML = `<p class="kb-note">${n || g ? `Changed: ${n} site action${n === 1 ? '' : 's'}, ${g} game system${g === 1 ? '' : 's'}.` : 'Everything is on its defaults.'}</p>
      <div class="kb-foot">${btn('resetall', confirmReset ? 'Press again to reset everything' : 'Reset all keys and buttons', confirmReset ? ' class="kb-btn kb-warn"' : '', !(n || g))}</div>`;
    if (confirmReset) { const b = box.querySelector('[data-kb-act="resetall"]'); if (b) b.className = 'kb-btn kb-warn'; }
  }

  function render() {
    if (!panel) return;
    const a = document.activeElement;
    const keep = a && panel.contains(a) ? focusKey(a) : null;
    renderKeys(); renderPad(); renderGames(); renderReset();
    if (keep) restoreFocus(keep);
  }
  /* Focus survives a redraw: the same button in the same row. */
  function focusKey(el) {
    const row = el.closest('[data-kb-id], [data-kb-fn], [data-kb-kfn]');
    const sum = el.matches && el.matches('summary') && el.parentElement && el.parentElement.dataset.kbAcc;
    return { id: row && row.dataset.kbId, where: row && row.dataset.kbWhere, fn: row && row.dataset.kbFn, kfn: row && row.dataset.kbKfn, act: el.dataset.kbAct, sys: el.dataset.kbSys,
      tab: el.dataset.kbTab, accId: sum || null, layout: el.dataset.kbLayout, pad: el.dataset.kbPad };
  }
  function restoreFocus(k) {
    let el = null;
    if (k.tab) el = panel.querySelector('[data-kb-tab="' + k.tab + '"]');
    else if (k.accId) el = panel.querySelector('[data-kb-acc="' + CSS.escape(k.accId) + '"] > summary');
    else if (k.layout) el = panel.querySelector('[data-kb-layout="' + k.layout + '"][data-kb-pad="' + k.pad + '"]');
    else if (k.sys) el = panel.querySelector('[data-kb-sys="' + k.sys + '"]');
    else if (k.id) el = panel.querySelector('[data-kb-id="' + CSS.escape(k.id) + '"][data-kb-where="' + k.where + '"] [data-kb-act="' + k.act + '"]');
    else if (k.fn || k.kfn) el = panel.querySelector('[data-kb-fn="' + CSS.escape(k.fn || '') + '"][data-kb-kfn="' + CSS.escape(k.kfn || '') + '"] [data-kb-act="' + k.act + '"]');
    else if (k.act) el = panel.querySelector('[data-kb-act="' + k.act + '"]');
    if (el && el.disabled) el = el.closest('.kb-row, .kb-foot') && el.closest('.kb-row, .kb-foot').querySelector('button:not([disabled])');
    if (el) { try { el.focus({ preventScroll: true }); } catch (_) {} }
  }
  function say(row, html, cls) {
    const m = row && row.querySelector('.kb-msg'); if (!m) return;
    m.className = 'kb-msg' + (cls ? ' ' + cls : '');
    m.innerHTML = html;
    row.classList.toggle('kb-bad', cls === 'kb-red');
  }
  const labelOf = id => { const F = A(); const a = F && F.list().find(x => x.id === id); return a ? a.label + ' (' + a.group + ')' : id; };

  /* ------------------------------------------------------------ actions */

  function onClick(e) {
    const tb = e.target.closest('[data-kb-tab]');
    if (tb) { setTab(tb.dataset.kbTab, true); saveUi(); return; }
    if (e.target.closest('[data-kb-act="padtest"]')) { openTest(); return; }
    const rv = e.target.closest('[data-kb-act="reverse"]');
    if (rv) { const P = PAD(); const p = P && P.pads().find(x => x.index === +rv.dataset.kbPad); if (p) toggleReverse(p); const again = panel && panel.querySelector('[data-kb-act="reverse"]'); if (again) try { again.focus({ preventScroll: true }); } catch (_) {} return; }
    const rl = e.target.closest('[data-kb-act="relookup"]');
    if (rl) { const P = PAD(); if (P && P.lookup) for (const p of P.pads()) P.lookup(p.id); const m = panel.querySelector('[data-kb-relookup]'); if (m) m.textContent = window.CWS ? 'Asked. The answer shows here when it arrives.' : 'No game server on this page.'; return; }
    const ly = e.target.closest('[data-kb-layout]');
    if (ly) { setPadLayout(+ly.dataset.kbPad, ly.dataset.kbLayout, null); return; }
    const cal = e.target.closest('[data-kb-act="calib"]');
    if (cal) { calibrate(+cal.dataset.kbPad); return; }
    const s = e.target.closest('[data-kb-sys]');
    if (s) { gameSys = s.dataset.kbSys; endCapture(true); renderGames(); restoreFocus({ sys: gameSys }); return; }
    const b = e.target.closest('[data-kb-act]'); if (!b || b.disabled) return;
    const act = b.dataset.kbAct;
    const row = b.closest('.kb-row');
    if (act === 'resetall') {
      if (!confirmReset) { confirmReset = 1; renderReset(); restoreFocus({ act: 'resetall' }); setTimeout(() => { if (confirmReset) { confirmReset = 0; renderReset(); } }, 6000); return; }
      confirmReset = 0;
      resetAll();
      return;
    }
    if (act === 'greset') { resetSystem(gameSys); return; }
    if (act === 'gkey') { gameKey(row); return; }
    if (act === 'gpad') { gamePad(row); return; }
    const id = row && row.dataset.kbId; if (!id) return;
    const where = row.dataset.kbWhere;
    if (act === 'reset') { A().resetKeys(id); render(); restoreFocus({ id, where, act: 'change' }); return; }
    if (act === 'change' || act === 'add') siteKey(row, id, where, act);
  }

  /* The site's keys and pad buttons. */
  function siteKey(row, id, where, mode) {
    const F = A();
    const pad = where === 'pad';
    say(row, pad ? 'Press a button on the pad… <span class="kb-tag">Escape cancels</span>' : 'Press a key… <span class="kb-tag">Escape cancels</span>', 'kb-ask');
    startCapture({
      kind: pad ? 'pad' : 'key', row,
      onCancel: () => say(row, ''),
      onTimeout: () => say(row, 'No button pressed. Nothing changed.'),
      done: key => {
        if (!key) { say(row, ''); return; }
        if (pad && !isPadKey(key)) { say(row, ''); return; }
        const chk = F.check(id, key);
        if (!chk.ok) { say(row, esc(chk.reason) + ' Nothing changed.', 'kb-red'); focusRowBtn(row, mode); return; }
        const cur = F.keysFor(id);
        const cls = kindOf(key);
        const fixed = F.fixedKeys(id);
        const replaced = mode === 'change' ? cur.filter(k => kindOf(k) === cls && !fixed.includes(k) && k !== key) : [];
        const next = (mode === 'change' ? cur.filter(k => !replaced.includes(k)) : cur.slice());
        if (!next.includes(key)) next.push(key);
        if (cur.includes(key) && mode === 'add') { say(row, esc(F.format(key)) + ' is already one of its keys.'); focusRowBtn(row, mode); return; }
        const others = chk.clashes || [];
        if (!others.length) { apply(id, next, row, where, mode); return; }
        // A clash: name the other action, offer Swap or Cancel.
        say(row, `<span>${esc(F.format(key))} is already used by <strong>${esc(others.map(labelOf).join(', '))}</strong>.</span>` +
          btn('swap', 'Swap') + btn('cancel', 'Cancel'), 'kb-red');
        const m = row.querySelector('.kb-msg');
        m.querySelector('[data-kb-act="swap"]').addEventListener('click', ev => {
          ev.stopPropagation();
          // The other action gives up the key and takes over what this one had (when changing).
          for (const o of others) {
            const ok = F.keysFor(o).filter(k => k !== key && !(k.indexOf(' ') > 0 && k.split(' ')[0] === key));
            for (const r of replaced) if (!ok.includes(r) && F.check(o, r).ok) ok.push(r);
            const res = F.bind(o, ok);
            if (!res.ok) { say(row, esc(res.reason) + ' Nothing changed.', 'kb-red'); return; }
          }
          apply(id, next, row, where, mode, 'Swapped with ' + others.map(labelOf).join(', ') + '.');
        });
        m.querySelector('[data-kb-act="cancel"]').addEventListener('click', ev => { ev.stopPropagation(); say(row, 'Cancelled. Nothing changed.'); focusRowBtn(row, mode); });
        setTimeout(() => { const sw = m.querySelector('[data-kb-act="swap"]'); if (sw) sw.focus({ preventScroll: true }); }, 0);
      },
    });
  }
  function focusRowBtn(row, act) { const b = row.querySelector('[data-kb-act="' + act + '"]'); if (b && !b.disabled) { try { b.focus({ preventScroll: true }); } catch (_) {} } }
  function apply(id, keys, row, where, mode, note) {
    const res = A().bind(id, keys);
    render();
    const again = panel.querySelector('[data-kb-id="' + CSS.escape(id) + '"][data-kb-where="' + where + '"]');
    if (!res.ok) { say(again, esc(res.reason) + ' Nothing changed.', 'kb-red'); }
    else say(again, esc(note || 'Saved.') + ' <span class="kb-tag">Now: ' + esc(A().shortcut(id) || 'none') + '</span>');
    if (again) focusRowBtn(again, mode);
  }

  /* Game controls: a console function's key or pad button. */
  function gameKey(row) {
    const pp = PP(); const sys = gameSys; const fn = row.dataset.kbKfn; if (!fn) return;
    say(row, 'Press a key… <span class="kb-tag">Escape cancels</span>', 'kb-ask');
    startCapture({
      kind: 'code', row, onCancel: () => say(row, ''),
      done: v => {
        if (!v || !v.code) { say(row, ''); return; }
        const t = pp.table(sys);
        if (v.mods) { say(row, 'Game keys work without Ctrl, Alt or Meta. Nothing changed.', 'kb-red'); focusRowBtn(row, 'gkey'); return; }
        if (v.code === 'Backspace' || v.code === 'Tab' || v.code === 'Escape') { say(row, esc(pp.codeLabel(v.code)) + ' is reserved: ' + (v.code === 'Tab' ? 'it moves focus' : 'it is Back, which opens the window’s menu') + '. Nothing changed.', 'kb-red'); focusRowBtn(row, 'gkey'); return; }
        if (t.reservedKeys[v.code]) { say(row, esc(pp.codeLabel(v.code)) + ' is taken by the window: ' + esc(t.reservedKeys[v.code]) + '. Nothing changed.', 'kb-red'); focusRowBtn(row, 'gkey'); return; }
        const map = Object.assign({}, pp.keyRemap(sys));
        const cur = r => map[r] || r;
        const other = t.keys.find(k => k.fn !== fn && cur(k.fn) === v.code);
        const commit = note => { pp.setKeyRemap(sys, map); renderGames(); renderReset(); const again = panel.querySelector('[data-kb-kfn="' + CSS.escape(fn) + '"]'); say(again, esc(note || 'Saved.')); if (again) focusRowBtn(again, 'gkey'); };
        if (!other) { map[fn] = v.code; commit(); return; }
        const mine = cur(fn);
        say(row, `<span>${esc(pp.codeLabel(v.code))} is already <strong>${esc(other.label)}</strong>.</span>` + btn('gswap', 'Swap') + btn('gcancel', 'Cancel'), 'kb-red');
        const m = row.querySelector('.kb-msg');
        m.querySelector('[data-kb-act="gswap"]').addEventListener('click', ev => { ev.stopPropagation(); map[fn] = v.code; map[other.fn] = mine; commit('Swapped with ' + other.label + '.'); });
        m.querySelector('[data-kb-act="gcancel"]').addEventListener('click', ev => { ev.stopPropagation(); say(row, 'Cancelled. Nothing changed.'); focusRowBtn(row, 'gkey'); });
        setTimeout(() => { const sw = m.querySelector('[data-kb-act="gswap"]'); if (sw) sw.focus({ preventScroll: true }); }, 0);
      },
    });
  }
  function gamePad(row) {
    const pp = PP(); const sys = gameSys; const fn = row.dataset.kbFn; if (!fn) return;
    say(row, 'Press a button on the pad… <span class="kb-tag">Escape cancels</span>', 'kb-ask');
    startCapture({
      kind: 'pad', row, onCancel: () => say(row, ''), onTimeout: () => say(row, 'No button pressed. Nothing changed.'),
      done: (key, pos) => {
        const b = String(key || '').slice(4);                 // Game controls name pad buttons by printed letter (2026-10-16)
        if (!b) { say(row, ''); return; }
        if (b === 'Home') { say(row, 'Home is the way out of a game (it opens the window’s menu). Nothing changed.', 'kb-red'); focusRowBtn(row, 'gpad'); return; }
        const t = pp.table(sys);
        const eff = {};
        for (const r of t.pad) for (const x of r.buttons) eff[x] = r.fn;
        const base = pp.MAPS[sys].players[0];
        for (const x of Object.keys(base)) if (!(x in eff)) eff[x] = null;          // a button the viewer cleared
        const was = eff[b] || null;
        const commit = note => { pp.setPadRemap(sys, eff); renderGames(); renderReset(); const again = panel.querySelector('[data-kb-fn="' + CSS.escape(fn) + '"]'); say(again, esc(note || 'Saved.')); if (again) focusRowBtn(again, 'gpad'); };
        const mine = Object.keys(eff).filter(x => eff[x] === fn && x !== b);
        if (was === fn) { say(row, 'Pad ' + esc(b) + ' already presses it.'); focusRowBtn(row, 'gpad'); return; }
        if (!was) { for (const x of mine) eff[x] = null; eff[b] = fn; commit(); return; }
        const other = t.pad.find(r => r.fn === was);
        say(row, `<span>Pad ${esc(b)} already presses <strong>${esc(other ? other.label : was)}</strong>.</span>` + btn('gswap', 'Swap') + btn('gcancel', 'Cancel'), 'kb-red');
        const m = row.querySelector('.kb-msg');
        m.querySelector('[data-kb-act="gswap"]').addEventListener('click', ev => { ev.stopPropagation(); for (const x of mine) eff[x] = was; eff[b] = fn; commit('Swapped with ' + (other ? other.label : was) + '.'); });
        m.querySelector('[data-kb-act="gcancel"]').addEventListener('click', ev => { ev.stopPropagation(); say(row, 'Cancelled. Nothing changed.'); focusRowBtn(row, 'gpad'); });
        setTimeout(() => { const sw = m.querySelector('[data-kb-act="gswap"]'); if (sw) sw.focus({ preventScroll: true }); }, 0);
      },
    });
  }
  function resetSystem(sys) {
    const pp = PP(); if (!pp) return;
    pp.setKeyRemap(sys, {}); pp.setPadRemap(sys, {});
    renderGames(); renderReset();
    restoreFocus({ sys });
  }
  function resetAll() {
    const F = A(); if (F) F.resetAll();
    const pp = PP(); if (pp) for (const s of SYSTEMS) { pp.setKeyRemap(s, {}); pp.setPadRemap(s, {}); }
    render();
    const b = panel.querySelector('[data-kb-act="resetall"]');
    const box = panel.querySelector('[data-kb="reset"] .kb-note'); if (box) box.textContent = 'Everything is back on its defaults.';
    if (b) { const t = panel.querySelector('.settings-tab[data-tab="' + TAB + '"]') || document.querySelector('.settings-tab[data-tab="' + TAB + '"]'); if (t) t.focus({ preventScroll: true }); }
  }

  /* ------------------------------------------------------------ boot */

  function boot() {
    const tryMount = () => mount();
    if (!tryMount()) setTimeout(tryMount, 1500);
    const vo = document.getElementById('vault-overlay');
    if (vo) new MutationObserver(() => { if (vo.classList.contains('open')) { if (!document.querySelector('.settings-tab[data-tab="' + TAB + '"]')) mount(); else render(); } else endCapture(true); })
      .observe(vo, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('gamepadconnected', () => setTimeout(() => { if (panel) renderPad(); }, 50));
    window.addEventListener('gamepaddisconnected', () => setTimeout(() => { if (panel) renderPad(); }, 50));
    window.addEventListener('gnw-pads-changed', () => setTimeout(() => { if (panel && !cap) { const a = document.activeElement, keep = a && panel.contains(a) ? focusKey(a) : null; renderPad(); if (keep) restoreFocus(keep); } }, 0));
    // Another tab of this site changed the keys: apply them here too.
    window.addEventListener('storage', e => {
      if (e.key !== 'gnw.keys.v1') { if (panel && (e.key === 'gnw.keys.games.v1' || e.key === 'gnw.pad.games.v2')) renderGames(); return; }
      const F2 = A(); if (!F2) return;
      let o = null; try { o = JSON.parse(e.newValue || 'null'); } catch (_) {}
      const keys = (o && o.keys) || {};
      for (const a of F2.list()) { if (keys[a.id]) F2.bind(a.id, keys[a.id]); else if (F2.isCustom(a.id)) F2.resetKeys(a.id); }
      if (panel) render();
    });
  }

  /* ------------------------------------------------------------ the controller test window */

  /* TEST CONTROLLER (2026-10-17: "I need a 'Test controller' button where I can click it and
     it intercepts all button presses. To get out of it I need to press guide or start + select ...
     there should be a close box on the controller test window"). A site overlay (keys.js treats it
     as the top layer: the page under it is inert, Back or Escape closes it, focus goes back to the
     button). While it is open GnwPad.test() takes every pad input, so nothing on the site or in a
     game runs. It shows the controller as a picture (printed letters by the letters in force),
     every raw button number and axis value, and what the browser and the game server say. Leaving:
     the controller's Guide (Home), Start and Select held together, the close box, Back or Escape. */
  const TEST_ID = 'kb-padtest-overlay';
  let testRelease = null, testSel = null, testArmed = false, testOpened = false;
  // [position name, x %, y %, kind]: positions as heldOf() names them (A bottom, B right, X left, Y top).
  const DIAG = [['LT', 14, 6, 'sh'], ['LB', 14, 17, 'sh'], ['RT', 86, 6, 'sh'], ['RB', 86, 17, 'sh'],
    ['Up', 22, 38, 'dp'], ['Down', 22, 62, 'dp'], ['Left', 13, 50, 'dp'], ['Right', 31, 50, 'dp'],
    ['Y', 78, 36, 'fc'], ['A', 78, 64, 'fc'], ['X', 69, 50, 'fc'], ['B', 87, 50, 'fc'],
    ['Select', 41, 32, 'sm'], ['Home', 50, 22, 'sm'], ['Start', 59, 32, 'sm'], ['L3', 36, 78, 'st'], ['R3', 64, 78, 'st']];
  const PRINTED = { xbox: { A: 'A', B: 'B', X: 'X', Y: 'Y' }, nintendo: { A: 'B', B: 'A', X: 'Y', Y: 'X' } };
  const SHOW = { Select: 'Select', Start: 'Start', Home: 'Guide', L3: 'L3', R3: 'R3', Up: '▲', Down: '▼', Left: '◀', Right: '▶' };
  function testStyles() {
    if (document.getElementById('kb-padtest-style')) return;
    const st = document.createElement('style'); st.id = 'kb-padtest-style';
    const T = '#' + TEST_ID;
    st.textContent = [
      // Above everything the site stacks (Settings is 150, notices go to the top of the range): 2026-10-17.
      T + ' { z-index: 2147482000; padding: max(12px, env(safe-area-inset-top)) 12px 12px; }',
      T + ' .pt-modal { max-width: 860px; padding: 16px 16px 18px; position: relative; }',
      T + ' .pt-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:6px; }',
      T + ' h2 { margin:0; font-size:18px; }',
      T + ' .modal-close { appearance:none; width:44px; height:44px; border-radius:50%; border:1px solid var(--line,#2a3342); background:rgba(255,255,255,.06); color:var(--text); font-size:26px; line-height:1; cursor:pointer; flex:0 0 auto; }',
      T + ' .modal-close:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }',
      T + ' .pt-note { color:var(--muted); font-size:13px; line-height:1.5; margin:0 0 10px; }',
      T + ' .pt-pads { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px; }',
      T + ' .pt-pads span { font-size:12px; padding:4px 10px; border-radius:999px; border:1px solid var(--line,#2a3342); color:var(--muted); }',
      T + ' .pt-pads span.on { color:var(--text); border-color:var(--accent); background:rgba(var(--accent-rgb,155,225,93),.15); }',
      T + ' .pt-diag { position:relative; width:100%; max-width:560px; margin:4px auto 12px; aspect-ratio: 100 / 62; border-radius:28% / 40%; background:rgba(255,255,255,.04); border:1px solid var(--line,#2a3342); }',
      T + ' .pt-b { position:absolute; transform:translate(-50%,-50%); display:flex; align-items:center; justify-content:center; font-weight:700; color:var(--text); border:1px solid var(--line,#2a3342); background:rgba(255,255,255,.06); font-size:clamp(11px, 2.6vw, 16px); user-select:none; }',
      T + ' .pt-b.fc { width:11%; aspect-ratio:1; border-radius:50%; }',
      T + ' .pt-b.dp { width:9%; aspect-ratio:1; border-radius:6px; }',
      T + ' .pt-b.sh { width:17%; height:9%; border-radius:999px; overflow:hidden; }',
      T + ' .pt-b.sm { width:11%; height:8%; border-radius:999px; font-size:clamp(9px, 2vw, 12px); }',
      T + ' .pt-b.st { width:15%; aspect-ratio:1; border-radius:50%; font-size:clamp(9px, 2vw, 12px); }',
      T + ' .pt-b.on { background: rgba(var(--accent-rgb,155,225,93),.55); border-color: var(--accent); color:#000; }',
      T + ' .pt-fill { position:absolute; left:0; bottom:0; top:0; background:rgba(var(--accent-rgb,155,225,93),.35); width:0; }',
      T + ' .pt-b span { position:relative; z-index:1; }',
      T + ' .pt-dot { position:absolute; width:26%; aspect-ratio:1; border-radius:50%; background:var(--accent); opacity:.6; left:50%; top:50%; transform:translate(-50%,-50%); }',
      T + ' .pt-raw { display:flex; flex-wrap:wrap; gap:4px; margin:6px 0; }',
      T + ' .pt-raw span { font: 600 12px/1 ui-monospace, Consolas, monospace; padding:4px 6px; border-radius:6px; border:1px solid var(--line,#2a3342); color:var(--muted); }',
      T + ' .pt-raw span.on { color:#000; background:var(--accent); border-color:var(--accent); }',
      T + ' .pt-h { font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); margin:10px 0 4px; }',
      T + ' .pt-info { font: 12px/1.5 ui-monospace, Consolas, monospace; color:var(--muted); word-break:break-word; }',
      T + ' .pt-ring { position:absolute; left:50%; top:7%; width:12%; aspect-ratio:1; transform:translate(-50%,-50%); }',
      T + ' .pt-ring[hidden] { display:none; }',
      T + ' .pt-ring svg { width:100%; height:100%; transform:rotate(-90deg); }',
      T + ' .pt-ring circle { fill:none; stroke-width:4; }',
      T + ' .pt-ring-bg { stroke:rgba(255,255,255,.12); }',
      T + ' .pt-ring-fg { stroke:var(--accent); stroke-linecap:round; }',
      T + ' .pt-ring b { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:clamp(12px, 3vw, 18px); color:var(--text); }',
      T + ' .pt-raw span.quiet { opacity:.35; }',
      T + ' .pt-quiet-note { font-size:12px; margin-top:4px; }',
      T + ' .pt-rev { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin:0 0 8px; }',
      T + ' .pt-rev-msg { font-size:13px; color:var(--muted); }',
    ].join('\n');
    document.head.appendChild(st);
  }
  function testEl() {
    let ov = document.getElementById(TEST_ID);
    if (ov) return ov;
    testStyles();
    ov = document.createElement('div');
    ov.id = TEST_ID; ov.className = 'overlay';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'kb-padtest-title');
    ov.innerHTML = '<div class="modal pt-modal">'
      + '<div class="pt-head"><h2 id="kb-padtest-title">Test controller</h2><button type="button" class="modal-close" aria-label="Close the controller test">×</button></div>'
      + '<p class="pt-note">To leave, hold <strong>Guide</strong>, or <strong>Start and Select</strong> together, for 3 seconds.</p>'
      + '<div class="pt-rev"><button type="button" class="kb-btn" data-pt-act="reverse" aria-pressed="false">Reverse buttons</button><span class="pt-rev-msg" aria-live="polite"></span></div>'
      + '<div class="pt-pads" aria-live="polite"></div>'
      + '<div class="pt-diag" aria-hidden="true">' + DIAG.map(([n, x, y, k]) => '<div class="pt-b ' + k + '" data-pt="' + n + '" style="left:' + x + '%;top:' + y + '%;">'
        + (k === 'sh' ? '<i class="pt-fill"></i>' : '') + (k === 'st' ? '<i class="pt-dot"></i>' : '') + '<span></span></div>').join('')
        + '<div class="pt-ring" hidden><svg viewBox="0 0 40 40"><circle class="pt-ring-bg" cx="20" cy="20" r="17"></circle><circle class="pt-ring-fg" cx="20" cy="20" r="17"></circle></svg><b></b></div>'
        + '</div>'
      + '<p class="pt-note pt-quiet-note">Browsers list a full standard set of buttons and axes for every controller, whatever it really has. Greyed numbers have not moved since this window opened, so your controller may not have them.</p>'
      + '<div class="pt-h">Buttons as the browser numbers them</div><div class="pt-raw" data-pt-raw="b"></div>'
      + '<div class="pt-h">Axes</div><div class="pt-raw" data-pt-raw="a"></div>'
      + '<div class="pt-h">Right stick (scrolls the tiles, pages and menus)</div><div class="pt-info" data-pt-rs></div>'
      + '<div class="pt-h">This controller</div><div class="pt-info"></div>'
      + '</div>';
    ov.querySelector('.modal-close').addEventListener('click', closeTest);
    ov.querySelector('[data-pt-act="reverse"]').addEventListener('click', reverseTest);
    ov.addEventListener('click', e => { if (e.target === ov) closeTest(); });
    // Closed by any path (keys.js Back, Escape, a route change, the close box): stop the test.
    // Focus goes back to the Test controller button (after keys.js's own return, which may land on the tab).
    new MutationObserver(() => {
      if (ov.classList.contains('open')) return;
      const was = !!testRelease; stopTest();
      if (was || testOpened) { testOpened = false; setTimeout(() => { const b = panel && panel.querySelector('[data-kb-act="padtest"]'); if (b && b.getClientRects().length) try { b.focus({ preventScroll: true }); } catch (_) {} }, 120); }
    }).observe(ov, { attributes: true, attributeFilter: ['class'] });
    document.body.appendChild(ov);
    return ov;
  }
  function openTest() {
    const P = PAD(); if (!P || !P.test) return;
    endCapture(true);
    const ov = testEl();
    // Last in its layer, so it paints above Settings and any open window; inside an element shown
    // full screen (only that element's subtree is visible then), else in the body.
    const fs = document.fullscreenElement;
    const home = fs && fs !== document.documentElement && fs !== document.body ? fs : document.body;
    if (ov.parentNode !== home || home.lastElementChild !== ov) home.appendChild(ov);
    testSel = null; testArmed = false; exitSince = 0; testSeen = new Map();
    paintTest([]);
    if (typeof window.openOverlay === 'function') window.openOverlay(TEST_ID); else ov.classList.add('open');
    if (testRelease) testRelease();
    testRelease = P.test(paintTest); testOpened = true;
    setTimeout(() => { const x = ov.querySelector('.modal-close'); if (x && ov.classList.contains('open')) try { x.focus({ preventScroll: true }); } catch (_) {} }, 60);
  }
  function stopTest() { if (testRelease) { const r = testRelease; testRelease = null; r(); } }
  function closeTest() {
    stopTest();
    const ov = document.getElementById(TEST_ID); if (!ov || !ov.classList.contains('open')) return;
    if (typeof window.closeOverlay === 'function') window.closeOverlay(TEST_ID); else ov.classList.remove('open');
  }
  /* Leaving by the controller (2026-10-17): Guide, or Start and Select together, HELD for 3 s,
     with a ring above Guide emptying anti-clockwise and the seconds counting down; letting go
     early cancels, so the buttons can still be tested. The close box leaves at once. */
  const EXIT_MS = 3000;
  const RING_C = 2 * Math.PI * 17;
  // Per controller id: the button and axis numbers seen to change since the window opened.
  let testSeen = new Map();
  let exitSince = 0;
  /* REVERSE BUTTONS (2026-10-17: "a 'Reverse buttons' button that when clicked will reverse A
     with B and X with Y"). Saves the other layout for the controller shown (the same choice as
     Settings and Press A to set); the picture changes on the next frame. A pointer or the keyboard
     presses it: the controller itself is the thing under test here. */
  /* Reversed: the saved choice for this controller is the other way round from the automatic one.
     The switch goes between that and Automatic, so on and off always mean the same two layouts. */
  function reversedOf(p) { return !!p && p.setting !== 'auto' && p.setting !== p.auto; }
  function toggleReverse(p) {
    const P = PAD(); if (!P || !p) return;
    P.setLayout(p.id, reversedOf(p) ? 'auto' : (p.auto === 'nintendo' ? 'xbox' : 'nintendo'));
    renderPad();
  }
  function reverseTest() {
    const P = PAD(); const ov = document.getElementById(TEST_ID); if (!P || !ov) return;
    const p = (P.pads() || []).find(x => x.index === testSel) || (P.pads() || [])[0];
    const m = ov.querySelector('.pt-rev-msg');
    if (!p) { if (m) m.textContent = 'No controller yet. Press any button on it first.'; return; }
    if (m) m.textContent = '';
    toggleReverse(p);
  }
  function paintTest(list) {
    const ov = document.getElementById(TEST_ID); if (!ov) return;
    // Which pad to draw: the one pressing something now, else the last one drawn, else the first.
    const busy = list.find(p => p.pressed.some(Boolean) || p.axes.some((v, i) => i < 4 && Math.abs(v) > 0.5));
    if (busy) testSel = busy.index;
    const p = list.find(x => x.index === testSel) || list[0] || null;
    ov.querySelector('.pt-pads').innerHTML = list.length ? list.map(x => '<span class="' + (p && x.index === p.index ? 'on' : '') + '">' + esc(x.name) + '</span>').join('')
      : '<span>No controller seen yet. Press any button on it.</span>';
    const rb = ov.querySelector('[data-pt-act="reverse"]');
    if (rb) { const on = !!p && p.setting !== 'auto' && p.setting !== p.auto; if (rb.getAttribute('aria-pressed') !== String(on)) rb.setAttribute('aria-pressed', String(on)); }
    const pos = new Set(p ? p.pos : []);
    const L = PRINTED[p && p.layout === 'nintendo' ? 'nintendo' : 'xbox'];
    const val = i => (p && p.buttons[i]) || 0;
    ov.querySelectorAll('[data-pt]').forEach(el => {
      const n = el.dataset.pt;
      el.querySelector('span').textContent = L[n] || SHOW[n] || n;
      el.classList.toggle('on', pos.has(n));
      const fill = el.querySelector('.pt-fill');
      if (fill) fill.style.width = Math.min(1, n === 'LT' ? Math.max(val(6), pos.has(n) ? 1 : 0) : n === 'RT' ? Math.max(val(7), pos.has(n) ? 1 : 0) : pos.has(n) ? 1 : 0) * 100 + '%';
      const dot = el.querySelector('.pt-dot');
      if (dot && p) { const rs = p.rs || {}; const ax = n === 'L3' ? [p.axes[0], p.axes[1]] : [p.axes[rs.x >= 0 ? rs.x : 2], p.axes[rs.y >= 0 ? rs.y : 3]]; dot.style.left = (50 + 37 * Math.max(-1, Math.min(1, ax[0] || 0))) + '%'; dot.style.top = (50 + 37 * Math.max(-1, Math.min(1, ax[1] || 0))) + '%'; }
    });
    // Greyed: numbers the browser lists that have not moved since the window opened.
    for (const x of list) {
      let s = testSeen.get(x.id); if (!s) { s = { b: new Set(), a: new Set(), a0: x.axes.slice() }; testSeen.set(x.id, s); }
      x.buttons.forEach((v, i) => { if (v > 0.1 || x.pressed[i]) s.b.add(i); });
      x.axes.forEach((v, i) => { if (Math.abs(v - (s.a0[i] || 0)) > 0.3) s.a.add(i); });
    }
    const seen = p ? testSeen.get(p.id) : null;
    ov.querySelector('[data-pt-raw="b"]').innerHTML = p ? p.buttons.map((v, i) => '<span class="' + (p.pressed[i] ? 'on' : seen && !seen.b.has(i) ? 'quiet' : '') + '">' + i + ': ' + v.toFixed(2) + '</span>').join('') : '';
    ov.querySelector('[data-pt-raw="a"]').innerHTML = p ? p.axes.map((v, i) => '<span class="' + (Math.abs(v) > 0.5 ? 'on' : seen && !seen.a.has(i) ? 'quiet' : '') + '">' + i + ': ' + v.toFixed(2) + '</span>').join('') : '';
    /* The right stick as the pages read it (31 Oct): which axis is its up / down, where that came
       from, and its value now (-1 up, 1 down), so a stick that scrolls nothing can be read off the screen. */
    const rsEl = ov.querySelector('[data-pt-rs]');
    if (rsEl) {
      /* (31 Oct): enough on one screen to say why a stick scrolls nothing: which axis is read as the
         stick's up / down and why, the axes tried and what each has done, and what the stick was driving
         (the tiles, a page, a menu) just before this window opened, with the pixels it moved there. */
      const rs = p && p.rs;
      const lines = [];
      if (p) {
        const why = p.mapping === 'standard' ? 'the browser lays this controller out in the usual order' : p.dbmap && p.dbmap.righty ? 'from the game server\'s controller list (' + esc(p.dbmap.righty) + ')' : 'found by moving it: the axis pushed furthest right now';
        lines.push('up / down: ' + (rs && rs.y >= 0 ? 'axis ' + rs.y : 'not found yet') + ' (' + why + '); now <b>' + (rs ? (+rs.v || 0).toFixed(2) : '0.00') + '</b>' + (rs && Math.abs(rs.v) > 0.18 ? (rs.v < 0 ? ', scrolling up' : ', scrolling down') : ''));
        if (rs && rs.cands) lines.push('axes tried, in order: ' + rs.cands.map(c => c.n + ' (' + esc(c.state) + (c.n === rs.y && Math.abs(c.v) > 0.18 ? ', in use' : '') + ')').join(', ') + '. Push the right stick all the way up and down once if it is not listed as moved both ways.');
        const dt = x => { const s = Math.round((Date.now() - x.at) / 1000); return s < 60 ? s + ' s ago' : Math.round(s / 60) + ' min ago'; };
        const WN = { 'gk-help': 'the key list', 'gk-quick': 'quick jump', 'vault-overlay': 'Settings', 'device-overlay': 'a drawer', 'video-info-overlay': 'a drawer', 'kb-padtest-overlay': 'this test', 'manualOverlay': 'a manual', 'video-player-overlay': 'the film player' };
        const dk = x => x.kind === 'tiles' ? 'the tiles' : x.kind === 'page' ? 'a page window' : x.kind === 'menu' ? 'the Systems menu' : x.kind === 'drawer' ? 'a drawer' : x.kind === 'layer' ? (WN[x.why] || ('a window (' + esc(x.why || x.target) + ')')) : x.kind === 'site' ? 'the page' : 'nothing' + (x.why ? ' (' + esc(x.why.replace(/ in div#vault-overlay\S*/, ' in Settings')) + ')' : '');
        const d = p.drive;
        if (d && d.at) lines.push('before this window opened the stick was driving <b>' + dk(d) + '</b>' + (d.target && d.kind !== 'none' ? ' (' + esc(d.target) + ')' : '') + ', ' + d.px + ' px moved there, from ' + dt(d) + (p.hist && p.hist.length ? '; earlier: ' + p.hist.slice(-4).reverse().map(h => dk(h) + ' ' + h.px + ' px, ' + dt(h)).join('; ') : ''));
      }
      rsEl.innerHTML = lines.join('<br>');
    }
    ov.querySelector('.pt-info:not([data-pt-rs])').innerHTML = p ? [
      'name: ' + esc(p.name), 'id: ' + esc(p.id),
      'the browser lists ' + p.buttons.length + ' buttons and ' + p.axes.length + ' axes, ' + (p.mapping === 'standard' ? 'in the usual order' : 'in the controller\'s own order') + '; platform ' + esc(p.platform || 'unknown'),
      'button layout: ' + (p.layout === 'nintendo' ? 'A on the right, like a Nintendo controller' : 'A at the bottom, like an Xbox controller') + (p.setting === 'auto' ? ' (chosen automatically)' : ' (your choice)'),
      'Guide: ' + (p.buttons.length > 16 ? 'button 16' + (pos.has('Home') ? ', pressed now' : '') : 'not passed on by this browser or system; use Start and Select together'),
      'game server: ' + (p.db ? (p.db.found ? 'listed as ' + esc(p.db.name) : 'not listed') + '; ' + esc(p.db.source) : 'not asked (none joined or reachable)'),
    ].join('<br>') : '';
    // Leaving by the controller: Guide, or Start and Select together, held 3 s; only after a frame
    // with nothing held (the press that opened the test does not count).
    const anyHeld = list.some(x => x.pressed.some(Boolean) || x.pos.length);
    const ring = ov.querySelector('.pt-ring');
    if (!testArmed) { if (!anyHeld) testArmed = true; ring.hidden = true; return; }
    const chord = list.some(x => x.pos.includes('Home') || (x.pos.includes('Start') && x.pos.includes('Select')));
    const now = performance.now();
    if (!chord) { exitSince = 0; ring.hidden = true; return; }
    if (!exitSince) exitSince = now;
    const left = Math.max(0, EXIT_MS - (now - exitSince));
    ring.hidden = false;
    // The arc runs clockwise from the top; as it shortens its end moves back anti-clockwise.
    ring.querySelector('.pt-ring-fg').setAttribute('stroke-dasharray', (RING_C * left / EXIT_MS).toFixed(2) + ' ' + RING_C.toFixed(2));
    ring.querySelector('b').textContent = String(Math.max(1, Math.ceil(left / 1000)));
    if (left <= 0) closeTest();
  }

  window.GnwKeybind = { BUILD, render, mount, capturing: () => !!cap, testController: openTest, closeTest, cancel: () => endCapture(false), system: s => { if (s) { gameSys = s; setTab('games', false); renderGames(); } return gameSys; }, tab: id => { setTab(id, false); return ui.tab; } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

/*
 * play/shared/save-table.js -- THE SAVE TABLE, one list of saves for every play window (8 Nov 2026).
 *
 * "Instead of all the separate grids which we have now I would like a table with up to 20 saves."
 * Every system draws its saves here: the Control Bar's Saves panel (play/shared/control-bar.js,
 * every console in the one play host) and the colour units' own-firmware page (play/twin-harness.js).
 *
 *   ROWS       one per save, newest first. Column 1 is the save's own picture, as the save recorded
 *              it: both screens for a two-screen game, both consoles for two linked Game Boys. Then
 *              the save's name (Save 3, and its note), when it was made, the play time it carries,
 *              and the machine where a console has more than one.
 *   AUTO SAVES are pinned on top in their own colour and labelled. They do not count toward the
 *              limit and have no Save or Delete: nothing here can write over them.
 *   NEW SAVE   a row of its own while there is room (opts.max, 20). When every save is used, a line
 *              says so and the person picks one to replace.
 *   SELECT     a row, then press one of its buttons (Load, Save, Note, Export, Delete). Save on a row
 *              that holds a save asks first, in the row (Replace / Cancel). A press from a keyboard,
 *              a remote or a controller (A) moves the focus straight to the row's first button.
 *
 * What it does not do: read or write any save. The window that uses it does (opts.on), so the saves
 * stay where they always were and every save made before this table still shows and loads.
 * Keys: the Control Bar's own panel keys move between the rows (Up / Down) and press (A, Enter); a
 * page without the bar passes ownKeys: true and gets the same keys here. No sound.
 */
(function () {
  'use strict';
  if (window.CwSaveTable) return;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /* Colours are the Control Bar's tokens (var(--cw-bar-*), with the bar's own values when a page
     has none). The play window is a dark surface over the game in both themes. Auto rows use their
     own blue family (--cw-bar-auto-*), so they read as different at a glance. */
  const CSS = `
  .cb-sv{width:min(100%,880px);display:flex;flex-direction:column;gap:6px;--sv-w:112px;--sv-h:84px}
  .cb-sv-head{display:grid;grid-template-columns:var(--sv-cols);gap:12px;padding:0 12px 2px;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--cw-bar-dim,#9aa1ad)}
  .cb-sv-row{border:1px solid var(--cw-bar-line,#2a2e36);border-radius:10px;background:var(--cw-bar-field,#1d2026);overflow:hidden}
  .cb-sv-row.sel{border-color:var(--cw-bar-accent,#9be15d);box-shadow:0 0 0 1px var(--cw-bar-accent,#9be15d) inset}
  .cb-sv-pick{display:grid;grid-template-columns:var(--sv-cols);gap:12px;align-items:center;width:100%;box-sizing:border-box;margin:0;padding:8px 12px;
    background:transparent;border:0;color:var(--cw-bar-ink,#e6e8ec);font:inherit;font-size:13px;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent}
  .cb-sv-pick:hover{background:rgba(255,255,255,.05)}
  .cb-sv-pick:focus-visible{outline:3px solid var(--cw-bar-accent,#9be15d);outline-offset:-3px;background:rgba(var(--cw-bar-accent-rgb,155,225,93),.12)}
  .cb-sv-pick > span{min-width:0}
  .cb-sv .shot{display:flex;align-items:center;justify-content:center;width:var(--sv-w);height:var(--sv-h);border-radius:6px;background:var(--cw-bar-shot,#0e1013) center/contain no-repeat;
    font-size:11px;color:var(--cw-bar-dim,#9aa1ad);text-align:center;overflow:hidden}
  .cb-sv.px .shot{image-rendering:pixelated}
  .cb-sv .shot.none{color:var(--cw-bar-warn,#e0a800);background-image:repeating-linear-gradient(135deg,rgba(var(--cw-bar-warn-rgb,224,168,0),.08) 0 8px,transparent 8px 16px)}
  .cb-sv .shot.plus{font-size:28px;font-weight:300;background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.04) 0 8px,transparent 8px 16px)}
  .cb-sv .nm{display:flex;flex-direction:column;gap:2px}
  .cb-sv .nm b{font-weight:600;font-size:13.5px}
  .cb-sv .nm .note{color:var(--cw-bar-dim,#9aa1ad);font-size:12px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word}
  .cb-sv .tag{align-self:flex-start;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;border-radius:999px;padding:1px 7px;border:1px solid currentColor}
  .cb-sv .tag.old,.cb-sv .tag.bad{color:var(--cw-bar-warn,#e0a800)}
  .cb-sv .wh{display:flex;flex-direction:column;gap:2px}
  .cb-sv .wh small,.cb-sv .pl,.cb-sv .mc{color:var(--cw-bar-dim,#9aa1ad);font-size:12px}
  .cb-sv .lbl{display:none}
  .cb-sv-acts{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:0 12px 10px calc(12px + var(--sv-w) + 12px)}
  .cb-sv-acts[hidden]{display:none}
  .cb-sv-acts button{background:var(--cw-bar-slot-act,#141619);border:1px solid var(--cw-bar-line,#2a2e36);color:var(--cw-bar-ink,#e6e8ec);border-radius:8px;padding:7px 14px;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;min-width:0}
  .cb-sv-acts button.main{border-color:var(--cw-bar-accent-edge,#9bbc0f);color:var(--cw-bar-accent-ink,#d8f08a)}
  .cb-sv-acts button.minor{font-weight:500;color:var(--cw-bar-dim,#9aa1ad)}
  .cb-sv-acts button:hover,.cb-sv-acts button:focus-visible{border-color:var(--cw-bar-accent,#9be15d);color:var(--cw-bar-accent-ink,#d8f08a);outline:3px solid var(--cw-bar-accent,#9be15d);outline-offset:1px}
  .cb-sv-acts button:hover{outline:none}
  .cb-sv-ask{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
  .cb-sv-ask span{font-size:12.5px;margin-right:4px}
  .cb-sv-row .note-ed{display:flex;gap:6px;padding:0 12px 10px calc(12px + var(--sv-w) + 12px)}
  .cb-sv-row .note-ed input{flex:1 1 auto;min-width:0;font:inherit;font-size:13px;background:var(--cw-bar-slot-act,#141619);color:var(--cw-bar-ink,#e6e8ec);border:1px solid var(--cw-bar-line,#2a2e36);border-radius:6px;padding:6px 8px}
  .cb-sv-row .note-ed input:focus{border-color:var(--cw-bar-accent,#9be15d);outline:none}
  .cb-sv-row .note-ed button{background:var(--cw-bar-slot-act,#141619);border:1px solid var(--cw-bar-line,#2a2e36);color:var(--cw-bar-ink,#e6e8ec);border-radius:8px;padding:6px 12px;font:inherit;font-size:12.5px;cursor:pointer}
  .cb-sv-row .note-ed button:focus-visible{outline:3px solid var(--cw-bar-accent,#9be15d);outline-offset:1px}
  /* Auto saves: pinned on top, their own colour. */
  .cb-sv-row.auto{background:var(--cw-bar-auto-bg,#14233a);border-color:var(--cw-bar-auto-line,#36598c)}
  .cb-sv-row.auto.sel{border-color:var(--cw-bar-auto-edge,#7fb0ff);box-shadow:0 0 0 1px var(--cw-bar-auto-edge,#7fb0ff) inset}
  .cb-sv-row.auto .nm b{color:var(--cw-bar-auto-ink,#bcd5ff)}
  .cb-sv-row.auto .tag{color:var(--cw-bar-auto-ink,#bcd5ff)}
  .cb-sv-row.auto .wh small,.cb-sv-row.auto .pl,.cb-sv-row.auto .mc,.cb-sv-row.auto .nm .note{color:var(--cw-bar-auto-dim,#a8bad6)}
  .cb-sv-row.new .nm b{color:var(--cw-bar-accent-ink,#d8f08a)}
  .cb-sv-row.empty{border-style:dashed}
  .cb-sv-full{border:1px dashed var(--cw-bar-line,#2a2e36);border-radius:10px;padding:10px 14px;color:var(--cw-bar-dim,#9aa1ad);font-size:12.5px}
  .cb-sv-hint{color:var(--cw-bar-dim,#9aa1ad);font-size:12px;text-align:center;width:min(100%,880px)}
  @media (pointer:coarse){.cb-sv-hint .kb{display:none}}
  body.cb-tv .cb-sv-hint .kb{display:none}
  /* A narrow window: the picture, then the words under each other; still one list. */
  @media (max-width:600px){
    .cb-sv{--sv-w:96px;--sv-h:72px}
    .cb-sv-head{display:none}
    .cb-sv-pick{grid-template-columns:var(--sv-w) minmax(0,1fr);grid-template-areas:"s n" "s w" "s p";column-gap:10px;row-gap:2px;padding:8px 10px}
    .cb-sv-pick .shot{grid-area:s}
    .cb-sv-pick .nm{grid-area:n}.cb-sv-pick .wh{grid-area:w;flex-direction:row;flex-wrap:wrap;gap:0 8px}.cb-sv-pick .pl,.cb-sv-pick .mc{grid-area:p;display:inline}
    .cb-sv-pick .mc{display:none}
    .cb-sv-pick.has-mc .pl:after{content:attr(data-mc)}
    .cb-sv-acts,.cb-sv-row .note-ed{padding:0 10px 10px 10px}
    .cb-sv-acts button{padding:9px 14px;font-size:13px}
  }
  @media (pointer:coarse){.cb-sv-acts button{padding:9px 16px}}
  /* TV: readable from the sofa. */
  body.cb-tv .cb-sv{--sv-w:160px;--sv-h:120px;width:min(100%,1180px)}
  body.cb-tv .cb-sv-pick{font-size:17px;padding:10px 16px;gap:18px}
  body.cb-tv .cb-sv .nm b{font-size:18px}
  body.cb-tv .cb-sv .wh small,body.cb-tv .cb-sv .pl,body.cb-tv .cb-sv .mc,body.cb-tv .cb-sv .nm .note{font-size:15px}
  body.cb-tv .cb-sv-head{font-size:13px;padding:0 16px 2px;gap:18px}
  body.cb-tv .cb-sv-acts{padding:0 16px 12px calc(16px + var(--sv-w) + 18px);gap:10px}
  body.cb-tv .cb-sv-acts button{font-size:17px;padding:10px 20px}
  body.cb-tv .cb-sv-ask span{font-size:17px}
  body.cb-tv .cb-sv-hint,body.cb-tv .cb-sv-full{font-size:15px}
  `;
  function ensureCss(doc) {
    doc = doc || document;
    if (doc.getElementById('cb-sv-css')) return;
    const st = doc.createElement('style'); st.id = 'cb-sv-css'; st.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(st);
  }

  /* ------------------------------------------------------------ words */
  function relTime(ts) {
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    const d = Math.round(s / 86400);
    return d === 1 ? 'yesterday' : `${d} days ago`;
  }
  function when(ts) {
    if (!ts) return '';
    try { return new Date(ts).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (_) { return new Date(ts).toLocaleString(); }
  }
  function played(sec) {
    if (sec == null || !Number.isFinite(+sec)) return '';
    sec = Math.max(0, Math.floor(+sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h ? `${h} h ${m} min played` : m ? `${m} min played` : 'under a minute played';
  }
  const nameOf = i => `Save ${i + 1}`;

  /* ------------------------------------------------------------ the table */
  /**
   * render(host, opts) draws the table into `host` (its contents are replaced).
   *   opts.max       how many saves may be kept (20); autos are not counted
   *   opts.shot      the picture's shape, "w/h" (the game screen, both screens, both consoles)
   *   opts.pixelated small pictures stay sharp
   *   opts.rows      [{ i, ts, thumb, thumbWhy, playSeconds, note, machine, older, damaged }]: saves only
   *   opts.autos     [{ key, label, sub, ts, thumb, playSeconds, machine }]
   *   opts.selected  'new' | 'auto:<key>' | a save's index
   *   opts.can       { note, transfer, del }
   *   opts.on        { select(sel), load(i), loadAuto(key), save(i | null), del(i), note(i, text), exportRow(i), importRow(i | null) }
   *   opts.focus     'row' | 'act': after drawing, the selected row (or its first button) takes the focus
   *   opts.ownKeys   true: Up / Down / Enter / Escape handled here (a page without the Control Bar), with
 *                  opts.pressCodes / opts.backCodes: that page's keys a controller's A and B arrive as
 *   opts.askDelete true: Delete asks first, in the row (a page with no Undo note)
   * Returns { el, select(sel, toButton), selected() }.
   */
  function render(host, opts) {
    const doc = host.ownerDocument || document;
    ensureCss(doc);
    const o = Object.assign({ max: 20, rows: [], autos: [], can: {}, on: {} }, opts || {});
    const on = o.on, can = o.can;
    const rows = o.rows.filter(Boolean).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0) || a.i - b.i);
    const full = rows.length >= o.max;
    const hasMc = rows.some(r => r.machine) || o.autos.some(a => a.machine);
    let sel = o.selected;
    const exists = s => (s === 'new' && !full) || (typeof s === 'string' && s.startsWith('auto:') && o.autos.some(a => 'auto:' + a.key === s)) || (typeof s === 'number' && rows.some(r => r.i === s));
    if (!exists(sel)) sel = null;

    const box = doc.createElement('div');
    box.className = 'cb-sv' + (o.pixelated ? ' px' : '');
    box.setAttribute('role', 'list');
    box.setAttribute('aria-label', 'Saves');
    const [aw, ah] = String(o.shot || '4/3').split('/').map(Number);
    const ar = aw > 0 && ah > 0 ? aw / ah : 4 / 3;
    // The picture box keeps one width for the whole column; a tall picture (two screens one above
    // the other) gets a square box, a wide one (two linked consoles) a flatter one; it fits inside.
    box.style.setProperty('--sv-h', ar < 1 ? 'var(--sv-w)' : 'calc(var(--sv-w) / ' + Math.max(1.333, Math.min(2.6, ar)).toFixed(3) + ')');
    box.style.setProperty('--sv-cols', 'var(--sv-w) minmax(0,1.4fr) minmax(0,1.1fr) minmax(0,.9fr)' + (hasMc ? ' minmax(0,.9fr)' : ''));
    const head = doc.createElement('div'); head.className = 'cb-sv-head'; head.setAttribute('aria-hidden', 'true');
    head.innerHTML = `<span>Picture</span><span>Save</span><span>Saved</span><span>Play time</span>${hasMc ? '<span>Machine</span>' : ''}`;
    box.appendChild(head);

    const rowEls = new Map();
    function pickHtml(r, kind) {
      const shot = kind === 'new' ? '<span class="shot plus" aria-hidden="true">+</span>'
        : `<span class="shot${r.thumb ? '' : ' none'}"${r.thumb ? ` style="background-image:url('${esc(r.thumb)}')"` : ''}${!r.thumb && r.thumbWhy ? ` title="${esc(r.thumbWhy)}"` : ''}>${r.thumb ? '' : (r.damaged ? 'damaged' : 'no picture')}</span>`;
      if (kind === 'new') return shot + `<span class="nm"><b>New save</b><span class="note">Keeps the game as it is now</span></span><span class="wh"><small>${o.max - rows.length} of ${o.max} free</small></span><span class="pl"></span>${hasMc ? '<span class="mc"></span>' : ''}`;
      const title = kind === 'auto' ? esc(r.label || 'Auto save') : nameOf(r.i);
      const tags = kind === 'auto' ? '<span class="tag">Auto save</span>' : (r.damaged ? '<span class="tag bad">Damaged</span>' : r.older ? '<span class="tag old">Older version</span>' : '');
      const note = kind === 'auto' ? (r.sub ? `<span class="note">${esc(r.sub)}</span>` : '') : (r.note ? `<span class="note">${esc(r.note)}</span>` : '');
      return shot + `<span class="nm"><b>${title}</b>${note}${tags}</span><span class="wh">${esc(when(r.ts))}<small>${r.ts ? esc(relTime(r.ts)) : ''}</small></span><span class="pl">${esc(played(r.playSeconds))}</span>${hasMc ? `<span class="mc">${esc(r.machine || '')}</span>` : ''}`;
    }
    function ariaOf(r, kind) {
      if (kind === 'new') return `New save, ${o.max - rows.length} of ${o.max} free`;
      const parts = [kind === 'auto' ? (r.label || 'Auto save') + ', auto save' : nameOf(r.i)];
      if (r.note) parts.push(r.note);
      if (r.damaged) parts.push('damaged');
      if (r.ts) parts.push('saved ' + when(r.ts));
      const p = played(r.playSeconds); if (p) parts.push(p);
      if (r.machine) parts.push(r.machine);
      return parts.join(', ');
    }
    function addRow(id, r, kind) {
      const row = doc.createElement('div');
      row.className = 'cb-sv-row ' + kind + (kind === 'new' ? ' empty' : '');
      row.setAttribute('role', 'listitem');
      row.dataset.row = String(id);
      if (kind === 'save') row.dataset.slot = String(r.i);
      const pick = doc.createElement('button');
      pick.type = 'button'; pick.className = 'cb-sv-pick' + (hasMc && (r && r.machine) ? ' has-mc' : '');
      pick.innerHTML = pickHtml(r, kind);
      if (hasMc && r && r.machine) { const pl = pick.querySelector('.pl'); if (pl) pl.dataset.mc = (pl.textContent ? ' · ' : '') + r.machine; }
      pick.setAttribute('aria-label', ariaOf(r, kind));
      pick.addEventListener('click', ev => select(id, ev.detail === 0));
      const acts = doc.createElement('div'); acts.className = 'cb-sv-acts'; acts.hidden = true;
      row.appendChild(pick); row.appendChild(acts);
      row._r = r; row._kind = kind;
      rowEls.set(String(id), row);
      box.appendChild(row);
    }
    for (const a of o.autos) addRow('auto:' + a.key, a, 'auto');
    if (!full) addRow('new', null, 'new');
    else {
      const n = doc.createElement('div'); n.className = 'cb-sv-full'; n.setAttribute('role', 'note');
      n.textContent = `All ${o.max} saves are in use. Select one and press Save to replace it, or delete one.`;
      box.appendChild(n);
    }
    for (const r of rows) addRow(r.i, r, 'save');

    function button(acts, label, fn, cls) {
      const b = doc.createElement('button'); b.type = 'button'; b.textContent = label; if (cls) b.className = cls;
      b.addEventListener('click', fn); acts.appendChild(b); return b;
    }
    function fillActs(row) {
      const acts = row.querySelector('.cb-sv-acts'), r = row._r, k = row._kind;
      acts.textContent = '';
      if (k === 'auto') button(acts, 'Load', () => on.loadAuto && on.loadAuto(r.key), 'main');
      else if (k === 'new') {
        button(acts, 'Save', () => on.save && on.save(null), 'main');
        if (can.transfer && on.importRow) button(acts, 'Import', () => on.importRow(null), 'minor');
      } else {
        if (!r.damaged) button(acts, 'Load', () => on.load && on.load(r.i), 'main');
        button(acts, 'Save', () => ask(row), r.damaged ? 'main' : '');
        if (!r.damaged && can.note && on.note) button(acts, r.note ? 'Edit note' : 'Note', () => editNote(row), 'minor');
        if (!r.damaged && can.transfer && on.exportRow) button(acts, 'Export', () => on.exportRow(r.i), 'minor');
        if (can.del !== false && on.del) button(acts, 'Delete', () => (o.askDelete ? ask(row, 'delete') : on.del(r.i)), 'minor');
      }
    }
    /* Save over a save: asked first, in the row. Cancel (or Back) puts the buttons back. A page with no
       Undo note (opts.askDelete) asks before Delete the same way. */
    function ask(row, what) {
      const acts = row.querySelector('.cb-sv-acts'), r = row._r, del = what === 'delete';
      acts.textContent = '';
      const a = doc.createElement('div'); a.className = 'cb-sv-ask'; a.setAttribute('role', 'group');
      a.innerHTML = `<span>${del ? `Delete ${esc(nameOf(r.i))}?` : `Replace ${esc(nameOf(r.i))} with the game as it is now?`}</span>`;
      acts.appendChild(a);
      button(a, del ? 'Delete' : 'Replace', () => { a._cancel = null; if (del) on.del && on.del(r.i); else on.save && on.save(r.i); }, 'main');
      const no = button(a, 'Cancel', () => a._cancel && a._cancel(), '');
      a._cancel = () => { a._cancel = null; fillActs(row); focusIn(row, del ? 'Delete' : 'Save'); };
      focus(no);
    }
    function editNote(row) {
      if (row.querySelector('.note-ed')) return;
      const r = row._r, was = r.note || '';
      const ed = doc.createElement('div'); ed.className = 'note-ed';
      ed.innerHTML = '<input type="text" class="cb-note-in" maxlength="200" autocomplete="off" enterkeyhint="done"><button type="button">Done</button>';
      const inp = ed.querySelector('input'), done = ed.querySelector('button');
      inp.value = was; inp.setAttribute('aria-label', `Note for ${nameOf(r.i)}`); inp.placeholder = 'A note about this save';
      row.querySelector('.cb-sv-acts').hidden = true;
      row.appendChild(ed);
      let finished = false;
      const close = async keep => {
        if (finished) return; finished = true;
        if (keep && inp.value.trim() !== was) { try { await on.note(r.i, inp.value); } catch (_) {} return; }   // the window draws the table again
        ed.remove(); row.querySelector('.cb-sv-acts').hidden = false; focusIn(row, r.note ? 'Edit note' : 'Note');
      };
      inp._done = () => close(true); inp._cancel = () => close(false);
      done.addEventListener('click', () => close(true));
      focus(inp);
    }
    function focus(el) { if (!el) return; try { el.focus({ preventScroll: false, focusVisible: true }); } catch (_) { try { el.focus(); } catch (__) {} } try { el.scrollIntoView({ block: 'nearest' }); } catch (_) {} }
    function focusIn(row, label) {
      const bs = Array.from(row.querySelectorAll('.cb-sv-acts button'));
      focus(bs.find(b => b.textContent === label) || bs[0]);
    }
    function select(id, toButton) {
      const key = String(id);
      const row = rowEls.get(key); if (!row) return;
      for (const [k, el] of rowEls) {
        const me = k === key;
        el.classList.toggle('sel', me);
        el.querySelector('.cb-sv-pick').setAttribute('aria-expanded', String(me));
        const acts = el.querySelector('.cb-sv-acts');
        if (me) { if (acts.hidden || !acts.firstChild) fillActs(el); acts.hidden = false; }
        else { acts.hidden = true; acts.textContent = ''; const ed = el.querySelector('.note-ed'); if (ed) ed.remove(); }
      }
      sel = row._kind === 'save' ? row._r.i : key;
      try { on.select && on.select(sel); } catch (_) {}
      if (toButton) focusIn(row);
    }
    host.textContent = '';
    host.appendChild(box);
    if (sel != null) {
      select(sel, o.focus === 'act');
      if (o.focus === 'row') focus(rowEls.get(String(sel)).querySelector('.cb-sv-pick'));
    }
    /* A page without the Control Bar (opts.ownKeys): Up / Down from row to row (a selected row's buttons
       are a stop of their own), Left / Right along the buttons, Enter, Space or opts.pressCodes (a
       controller's A as that page's key) press, Escape or opts.backCodes answers Cancel to a question. */
    if (o.ownKeys) box.addEventListener('keydown', ev => {
      const a = doc.activeElement, press = o.pressCodes || [], back = o.backCodes || [];
      const stop = () => { ev.preventDefault(); ev.stopPropagation(); };
      if (a && a.classList && a.classList.contains('cb-note-in')) {
        if (ev.key === 'Enter') { stop(); a._done(); }
        else if (ev.key === 'Escape') { stop(); a._cancel(); }
        return;
      }
      if (ev.key === 'Escape' || back.includes(ev.code)) { const ak = box.querySelector('.cb-sv-ask'); if (ak && ak._cancel) { stop(); ak._cancel(); } else if (back.includes(ev.code)) stop(); return; }
      if (ev.key === 'Enter' || ev.key === ' ' || press.includes(ev.code)) { if (a && a.tagName === 'BUTTON' && box.contains(a)) { stop(); if (!ev.repeat) a.click(); } return; }
      if (!/^Arrow(Up|Down|Left|Right)$/.test(ev.key)) return;
      stop();
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
        const grp = a && a.closest && a.closest('.cb-sv-acts');
        if (grp) { const bs = Array.from(grp.querySelectorAll('button')), k = bs.indexOf(a) + (ev.key === 'ArrowRight' ? 1 : -1); if (bs[k]) focus(bs[k]); }
        return;
      }
      const stops = [];
      for (const el of box.querySelectorAll('.cb-sv-row')) { stops.push(el.querySelector('.cb-sv-pick')); const f = el.querySelector('.cb-sv-acts:not([hidden]) button, .note-ed input'); if (f) stops.push(f); }
      let cur = stops.indexOf(a);
      if (cur < 0 && a && a.closest) { const g = a.closest('.cb-sv-acts'); if (g) cur = stops.findIndex(x => g.contains(x)); }
      focus(stops[cur < 0 ? 0 : Math.max(0, Math.min(stops.length - 1, cur + (ev.key === 'ArrowDown' ? 1 : -1)))]);
    });
    return { el: box, select, selected: () => sel };
  }

  window.CwSaveTable = { render, relTime, when, played, nameOf, ensureCss };
})();

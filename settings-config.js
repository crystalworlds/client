/*
 * settings-config.js -- Settings > Configurations and Settings > Widgets (2026-10-24).
 *
 * WHAT. Configurations holds every quick, one-choice setting in collapsible rows (an accordion),
 * in groups: Theme, Accent colour, TV mode, Focus mode, Stack the tiles, the film and series
 * playback switches and the two automatic subtitle switches. Widgets holds each ambient widget
 * (clock, weather, trailers...) as its own collapsible row. Bigger settings (the rest of
 * Subtitles, sources, keys, the vault) stay on their pages.
 *
 * HOW. Nothing is rebuilt, as in settings-ui.js and settings-sources.js: the existing sections
 * and cards (index.html, keys.js, shortcuts.js, emby.js, embyupnext.js, embytranscode.js,
 * subs.js) are MOVED into the rows, with their ids, handlers and storage keys. emby.js redraws
 * its part of Settings on sign-in and sign-out; the new copies are found and moved in, and the
 * old copies are dropped. A row whose control does not exist (no media server: no playback,
 * grid, widget or subtitle switches) is hidden, and so is an empty group or page.
 * Each row's head shows its current choice (On / Off, Dark, Auto...).
 * Sound: none.
 */
(function () {
  'use strict';
  if (window.GnwConfig) return;
  const BUILD = '20261104-q3a';

  const ov = () => document.getElementById('vault-overlay');
  const page = id => document.querySelector('#vault-overlay .settings-panels > .st-page[data-st="' + id + '"]');
  const all = sel => { const o = ov(); return o ? Array.from(o.querySelectorAll(sel)) : []; };
  // A section that holds a control, or the card that holds an input with this id.
  const sectionOf = sel => all(sel).map(e => e.closest('section')).filter(Boolean);
  const cardOf = id => all('[id="' + id + '"]').map(e => e.closest('.aw-card')).filter(Boolean);
  const byId = id => all('[id="' + id + '"]');
  const embyOn = () => !!(window.Emby && window.Emby.session && window.Emby.session.active);

  const GROUPS = [
    { id: 'look', label: 'Look', items: [
      { id: 'theme', name: 'Theme', find: () => sectionOf('[data-theme-opt]') },
      { id: 'accent', name: 'Accent colour', find: () => sectionOf('.accent-swatches') },
    ] },
    { id: 'screen', label: 'Screen and tiles', items: [
      { id: 'tv', name: 'TV mode', find: () => sectionOf('[data-tv-opt]') },
      { id: 'focus', name: 'Focus mode', find: () => byId('gk-fm-section') },
      /* Grid layout (31 Oct: "Just leave it on the configurations tab always as it's not dependent on the
         media server"): our own switch, always here, whatever the media servers are doing. */
      { id: 'stack', name: 'Grid layout: stack the tiles', find: () => [stackCard()] },
      { id: 'twins', name: 'Show in grid Mario and Zelda', find: () => [twinsCard()] },
      { id: 'anim', name: 'Prefer games with animated demos', find: () => [animCard()] },
      { id: 'hideempty', name: 'Hide systems with no games', find: () => [hideEmptyCard()] },
      { id: 'hzwarn', name: 'Slow screen warning', find: () => (window.cwRefresh ? [window.cwRefresh.card()] : []) },   // notify.js builds the card (28 Oct)
    ] },
    { id: 'play', label: 'Films and series', items: [
      { id: 'autoskip', name: 'Skip intros automatically', media: true, find: () => cardOf('w-autoskip-on') },
      { id: 'upnext', name: 'Autoplay next episode', media: true, find: () => cardOf('gun-autoplay') },
      { id: 'conv', name: 'Server conversion', media: true, find: () => cardOf('w-srvconv') },
    ] },
    { id: 'subs', label: 'Subtitles', items: [
      { id: 'autofetch', name: 'Find subtitles automatically', media: true, find: () => cardOf('gsub-autofetch') },
      { id: 'fixbroken', name: 'Replace broken subtitles automatically', media: true, find: () => cardOf('gsub-fixbroken') },
    ] },
  ];

  /* SHOW IN GRID MARIO AND ZELDA (28 Oct). The one switch here that no other
     page draws, so it is built here, once, in the shape of the other switches (.aw-card, .aw-head,
     a checkbox), and kept: place() moves this same node into its row on every gather. Off by
     default; index.html's gnwSetTwinsOnGrid stores it (localStorage gnw.gridTwins) and redraws the
     wall. */
  let twinsEl = null;
  function twinsCard() {
    if (twinsEl) return twinsEl;
    const on = !!(window.gnwTwinsOnGrid && window.gnwTwinsOnGrid());
    const c = document.createElement('div');
    c.className = 'aw-card cfg-own';
    c.innerHTML = '<div class="aw-head"><span class="aw-name">Show in grid Mario and Zelda</span>' +
      '<label class="aw-switch"><input type="checkbox" id="cfg-twins-grid"' + (on ? ' checked' : '') + ' aria-label="Show in grid Mario and Zelda"><span class="aw-slider"></span></label></div>' +
      '<p class="cfg-note">The two colour Game &amp; Watch units, Super Mario Bros. and The Legend of Zelda, play live on their tiles ' +
      'like the other Game &amp; Watch tiles. Each one runs a whole colour-screen computer, so this takes much more of the ' +
      'processor. Off: their tiles show the device, and they play in the drawer, in search and in the play window.</p>';
    c.querySelector('input').addEventListener('change', e => { try { if (window.gnwSetTwinsOnGrid) window.gnwSetTwinsOnGrid(e.target.checked); } catch (_) {} });
    twinsEl = c;
    return c;
  }

  /* PREFER GAMES WITH ANIMATED DEMOS (30 Oct), built and kept like twinsCard. Off by default;
     emby.js setPreferAnimated stores it (localStorage gnw.preferAnimated) and draws the wall again
     from the top: games whose tile moves first, still pictures after, the order otherwise kept. */
  let animEl = null;
  function animCard() {
    if (animEl) return animEl;
    const on = !!(window.Emby && window.Emby.preferAnimated && window.Emby.preferAnimated());
    const c = document.createElement('div');
    c.className = 'aw-card cfg-own';
    c.innerHTML = '<div class="aw-head"><span class="aw-name">Prefer games with animated demos</span>' +
      '<label class="aw-switch"><input type="checkbox" id="cfg-prefer-anim"' + (on ? ' checked' : '') + ' aria-label="Prefer games with animated demos"><span class="aw-slider"></span></label></div>' +
      '<p class="cfg-note">Games whose tile shows a moving demo come first. Games whose tile stays a still picture ' +
      'come after them, for every system, in the same order as before. Off: every game keeps its place.</p>';
    c.querySelector('input').addEventListener('change', e => { try { if (window.Emby && window.Emby.setPreferAnimated) window.Emby.setPreferAnimated(e.target.checked); } catch (_) {} });
    animEl = c;
    return c;
  }

  /* HIDE SYSTEMS WITH NO GAMES (4 Nov), built and kept like twinsCard. Off by default;
     emby.js setHideEmptySystems stores it (localStorage gnw.hideEmptySystems) and redraws the
     Systems menu: a system with no games, counting the type boxes beside "Systems", is left out of
     the menu and of the System Switcher, and comes back as soon as it has a game to show. */
  let hideEl = null;
  function hideEmptyCard() {
    const on = !!(window.Emby && window.Emby.hideEmptySystems && window.Emby.hideEmptySystems());
    if (hideEl) { const i = hideEl.querySelector('input'); if (i && i.checked !== on && document.activeElement !== i) i.checked = on; return hideEl; }
    const c = document.createElement('div');
    c.className = 'aw-card cfg-own';
    c.innerHTML = '<div class="aw-head"><span class="aw-name">Hide systems with no games</span>' +
      '<label class="aw-switch"><input type="checkbox" id="cfg-hide-empty"' + (on ? ' checked' : '') + ' aria-label="Hide systems with no games"><span class="aw-slider"></span></label></div>' +
      '<p class="cfg-note">Systems that have no games to show are left out of the Systems menu and of the system switcher ' +
      '(the shoulder buttons). The game type buttons in the Systems menu count too: a system whose games are all of a type ' +
      'that is switched off is left out as well. Off: every system is shown, with its count. Saved only in this browser.</p>';
    c.querySelector('input').addEventListener('change', e => { try { if (window.Emby && window.Emby.setHideEmptySystems) window.Emby.setHideEmptySystems(e.target.checked); } catch (_) {} });
    hideEl = c;
    return c;
  }

  /* GRID LAYOUT: STACK THE TILES (31 Oct), built and kept like twinsCard. It was emby.js's switch,
     drawn only while a media server was signed in and switched on, so it sat on Media and content,
     moved here when Jellyfin was switched on and was gone when it was switched off. The choice is
     the same stored one (emby.js getWidgetCfg().layout.stacked), read and set through Emby.stacked /
     Emby.setStacked, which also lays the wall out again at once. Off by default. */
  let stackEl = null;
  function stackCard() {
    const on = !!(window.Emby && window.Emby.stacked && window.Emby.stacked());
    if (stackEl) { const i = stackEl.querySelector('input'); if (i && i.checked !== on && document.activeElement !== i) i.checked = on; return stackEl; }
    const c = document.createElement('div');
    c.className = 'aw-card cfg-own';
    c.innerHTML = '<div class="aw-head"><span class="aw-name">Grid layout: stack the tiles</span>' +
      '<label class="aw-switch"><input type="checkbox" id="cfg-stack-on"' + (on ? ' checked' : '') + ' aria-label="Grid layout: stack the tiles (Masonry mode)"><span class="aw-slider"></span></label></div>' +
      '<p class="cfg-note">Packs each tile under the shortest column instead of lining them up in rows (Masonry mode), so tiles of ' +
      'different heights fit together with no bands of empty space between rows. Posters, game tiles and widgets all take part. ' +
      'Saved only in this browser.</p>';
    c.querySelector('input').addEventListener('change', e => { try { if (window.Emby && window.Emby.setStacked) window.Emby.setStacked(e.target.checked); } catch (_) {} });
    stackEl = c;
    return c;
  }

  const CHEV = '<svg class="cfg-chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';

  function styles() {
    if (document.getElementById('cfg-style')) return;
    const st = document.createElement('style');
    st.id = 'cfg-style';
    st.textContent = `
      #vault-overlay .cfg-root { display: flex; flex-direction: column; gap: 18px; }
      #vault-overlay .cfg-intro { margin: 0; color: var(--muted); font-size: 12.5px; line-height: 1.55; }
      #vault-overlay .cfg-group { display: flex; flex-direction: column; gap: 8px; }
      /* A group with no row (no media server: Films and series, Subtitles) showed its heading over
         nothing, because the display rule above beat [hidden] (4 Nov). */
      #vault-overlay .cfg-group[hidden] { display: none; }
      #vault-overlay .cfg-group-h { margin: 0; font-size: 11px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; color: var(--muted); }
      #vault-overlay .cfg-item { border: 1px solid var(--line); border-radius: 12px; background: rgba(255,255,255,.02); }
      #vault-overlay .cfg-item.open { border-color: rgba(var(--accent-rgb),.45); }
      #vault-overlay .cfg-head { all: unset; box-sizing: border-box; width: 100%; min-height: 48px; padding: 10px 14px; display: flex; align-items: center; gap: 12px; cursor: pointer; border-radius: 12px; color: var(--text); }
      #vault-overlay .cfg-head:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
      #vault-overlay .cfg-name { flex: 1 1 auto; font-size: 13.5px; font-weight: 700; }
      #vault-overlay .cfg-val { flex: 0 1 auto; font-size: 12px; color: var(--muted); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 45%; }
      #vault-overlay .cfg-val[data-on="1"] { color: var(--accent); font-weight: 700; }
      #vault-overlay .cfg-chev { flex: 0 0 auto; color: var(--muted); transition: transform .15s ease; }
      #vault-overlay .cfg-item.open .cfg-chev { transform: rotate(180deg); }
      #vault-overlay .cfg-body { padding: 0 14px 14px; }
      #vault-overlay .cfg-body[hidden] { display: none; }
      /* The moved section or card: no second frame, and its own title is the row's head. */
      #vault-overlay .cfg-body > .vault-section, #vault-overlay .cfg-body > .aw-card { border: 0; padding: 0; margin: 0 !important; background: none; }
      #vault-overlay .cfg-body > .vault-section > label:first-child { display: none !important; }
      /* The Subtitles page: the tab is the title, so the section's own heading and frame go. */
      #vault-overlay .st-page[data-st="subs"] > #gsub-settings { margin-top: 0 !important; border: 0; padding: 0; background: none; }
      #vault-overlay .st-page[data-st="subs"] > #gsub-settings > label:first-child { display: none !important; }
      #vault-overlay .cfg-body > .aw-card > .aw-head > .aw-name, #vault-overlay .cfg-body > .aw-card > .aw-name:first-child { display: none; }
      #vault-overlay .cfg-body > .aw-card > .aw-head { justify-content: flex-start; }
      #vault-overlay .cfg-body > .aw-card > .aw-opts:first-of-type { margin-top: 10px; }
      /* Our own switch card (twinsCard): the switch's look, in case the media page's styles are not on the page yet. */
      #vault-overlay .cfg-own .aw-head { display: flex; align-items: center; gap: 12px; }
      #vault-overlay .cfg-own .aw-switch { position: relative; display: inline-block; width: 42px; height: 24px; flex: 0 0 auto; }
      #vault-overlay .cfg-own .aw-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
      #vault-overlay .cfg-own .aw-slider { position: absolute; inset: 0; cursor: pointer; background: rgba(255,255,255,.16); border-radius: 24px; transition: background .2s ease; }
      #vault-overlay .cfg-own .aw-slider::before { content: ''; position: absolute; width: 20px; height: 20px; left: 2px; top: 2px; background: #fff; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,.4); transition: transform .2s ease; }
      #vault-overlay .cfg-own .aw-switch input:checked + .aw-slider { background: var(--accent); }
      #vault-overlay .cfg-own .aw-switch input:checked + .aw-slider::before { transform: translateX(18px); }
      #vault-overlay .cfg-own .aw-switch input:focus-visible + .aw-slider { box-shadow: 0 0 0 2px rgba(var(--accent-rgb),.5); }
      #vault-overlay .cfg-own .cfg-note { margin: 9px 0 0; font-size: 11.5px; color: var(--muted); line-height: 1.5; }
      @media (prefers-reduced-motion: reduce) { #vault-overlay .cfg-chev { transition: none; } }
    `;
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------ rows */
  function row(id, name) {
    const it = document.createElement('div');
    it.className = 'cfg-item'; it.dataset.cfg = id; it.hidden = true;
    it.innerHTML = '<button type="button" class="cfg-head" id="cfg-h-' + id + '" aria-expanded="false" aria-controls="cfg-b-' + id + '">' +
      '<span class="cfg-name"></span><span class="cfg-val"></span>' + CHEV + '</button>' +
      '<div class="cfg-body" id="cfg-b-' + id + '" role="region" aria-labelledby="cfg-h-' + id + '" hidden></div>';
    it.querySelector('.cfg-name').textContent = name;
    return it;
  }
  function toggle(it, open) {
    const want = open == null ? !it.classList.contains('open') : open;
    it.classList.toggle('open', want);
    it.querySelector('.cfg-head').setAttribute('aria-expanded', want ? 'true' : 'false');
    it.querySelector('.cfg-body').hidden = !want;
    if (want) { setTimeout(() => showWhole(it), 30); setTimeout(() => showWhole(it, true), 700); }
  }
  /* AN OPENED SETTING IS SHOWN WHOLE (4 Nov: on the fold an opened setting opened below the
     bottom of the screen). The window scrolls just enough to show the whole row, its head and
     everything it opened; a row taller than the window puts its head at the top. The pinned page
     buttons over the top of a full-screen Settings are allowed for. Run once the row has opened
     and again a moment later (pictures and late parts can make it taller); the second run only
     moves when the row still does not fit. */
  function scrollBoxOf(el) {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (p.scrollHeight > p.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(p).overflowY)) return p;
    }
    return null;
  }
  function showWhole(it, again) {
    if (!it.isConnected || !it.classList.contains('open') || !it.getClientRects().length) return;
    const box = scrollBoxOf(it); if (!box) return;
    const b = box.getBoundingClientRect(), r = it.getBoundingClientRect(), m = 12;
    let top = Math.max(0, b.top), bottom = Math.min(window.innerHeight, b.bottom);
    const tabs = box.querySelector('.settings-tabs');
    if (tabs && getComputedStyle(tabs).position === 'sticky') {
      const t = tabs.getBoundingClientRect();
      if (t.height && t.left < r.right && t.right > r.left && t.bottom > top) top = t.bottom;   // the pinned page buttons above it
    }
    let dy = 0;
    if (r.height > bottom - top - 2 * m) dy = r.top - top - m;      // taller than the window: its head at the top
    else if (r.bottom > bottom - m) dy = r.bottom - bottom + m;
    else if (r.top < top + m) dy = r.top - top - m;
    if (Math.abs(dy) < 2) return;
    let smooth = !again;
    try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) smooth = false; } catch (_) {}
    try { box.scrollTo({ top: box.scrollTop + dy, behavior: smooth ? 'smooth' : 'auto' }); } catch (_) { box.scrollTop += dy; }
  }
  function wire(root) {
    root.addEventListener('click', e => {
      const h = e.target.closest && e.target.closest('.cfg-head');
      if (h && root.contains(h)) { toggle(h.parentNode); return; }
      schedule();
    });
    root.addEventListener('change', schedule);
    root.addEventListener('input', schedule);
  }
  // Put the newest copy of a control into its row: one not yet inside our rows wins (emby.js has
  // just drawn it again), else the one already there.
  function place(it, nodes, root) {
    const body = it.querySelector('.cfg-body');
    const fresh = nodes.filter(n => !root.contains(n));
    const pick = fresh.length ? fresh[fresh.length - 1] : nodes.find(n => body.contains(n));
    if (pick && pick.parentNode !== body) {
      while (body.firstChild) body.removeChild(body.firstChild);
      body.appendChild(pick);
    }
    if (!pick) while (body.firstChild) body.removeChild(body.firstChild);
    const has = !!body.firstChild;
    if (it.hidden === has) it.hidden = !has;
    return has;
  }

  /* What the row's control is set to, for its head. */
  function value(body) {
    const sw = body.querySelector('.aw-head input[type="checkbox"]');
    if (sw) return { text: sw.checked ? 'On' : 'Off', on: sw.checked };
    const r = body.querySelector('[role="radio"][aria-checked="true"]');
    if (r) { const t = (r.textContent || '').trim() || r.getAttribute('aria-label') || ''; return { text: t.replace(/\s*\(default\)\s*$/i, ''), on: false }; }
    const s = body.querySelector('select');
    if (s && s.selectedIndex >= 0) return { text: s.options[s.selectedIndex].text, on: false };
    return { text: '', on: false };
  }
  function paintValues(root) {
    root.querySelectorAll('.cfg-item').forEach(it => {
      const v = value(it.querySelector('.cfg-body'));
      const el = it.querySelector('.cfg-val');
      if (el.textContent !== v.text) el.textContent = v.text;
      const on = v.on ? '1' : '0';
      if (el.dataset.on !== on) el.dataset.on = on;
    });
  }

  /* ------------------------------------------------------------ Configurations */
  function buildConfig() {
    const pg = page('config'); if (!pg) return null;
    let root = document.getElementById('cfg-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'cfg-root'; root.className = 'cfg-root';
      for (const g of GROUPS) {
        const gr = document.createElement('section');
        gr.className = 'cfg-group'; gr.dataset.group = g.id; gr.setAttribute('aria-labelledby', 'cfg-g-' + g.id);
        gr.innerHTML = '<h3 class="cfg-group-h" id="cfg-g-' + g.id + '"></h3>';
        gr.querySelector('h3').textContent = g.label;
        for (const i of g.items) gr.appendChild(row(i.id, i.name));
        root.appendChild(gr);
      }
      wire(root);
    }
    if (root.parentNode !== pg || pg.firstChild !== root) pg.insertBefore(root, pg.firstChild);
    for (const g of GROUPS) {
      const gr = root.querySelector('.cfg-group[data-group="' + g.id + '"]');
      let any = false;
      // emby.js draws the media rows only while signed in; its last copies stay in our rows after a
      // sign-out, so those rows follow the sign-in state, not the nodes.
      for (const i of g.items) if (place(gr.querySelector('.cfg-item[data-cfg="' + i.id + '"]'), i.media && !embyOn() ? [] : i.find(), root)) any = true;
      if (gr.hidden === any) gr.hidden = !any;
    }
    // The old Appearance and Display panels are now empty holders: keep them out of the way.
    pg.querySelectorAll(':scope > .settings-panel').forEach(p => {
      const empty = !Array.from(p.children).some(c => !c.hidden);
      if (p.hidden !== empty) p.hidden = empty;
    });
    return root;
  }

  /* ------------------------------------------------------------ Widgets */
  function widgetSection() {
    return all('.settings-panel[data-panel="videologin"] > section').find(s => { const l = s.querySelector(':scope > label'); return l && /^ambient widgets$/i.test((l.textContent || '').trim()); }) || null;
  }
  function buildWidgets() {
    const pg = page('widgets'); if (!pg) return 0;
    let root = document.getElementById('wg-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'wg-root'; root.className = 'cfg-root';
      root.innerHTML = '<p class="cfg-intro">Live tiles woven through the tiles on the content page: a clock, the weather, trailers, film facts and more. Open one to switch it on or off and set how often it appears. Saved only in this browser.</p><div class="cfg-group" id="wg-list"></div>';
      wire(root);
    }
    if (root.parentNode !== pg) pg.appendChild(root);
    const list = root.querySelector('#wg-list');
    const sec = widgetSection();
    const fresh = sec ? Array.from(sec.querySelectorAll('.aw-card')) : [];
    const keyOf = card => { const i = card.querySelector('.aw-head input[type="checkbox"]'); return i ? i.id : ''; };
    for (const card of fresh) {
      const k = keyOf(card); if (!k) continue;
      let it = list.querySelector('.cfg-item[data-cfg="' + k + '"]');
      if (!it) { const n = card.querySelector('.aw-name'); it = row(k, n ? n.textContent.trim() : k); list.appendChild(it); }
      const body = it.querySelector('.cfg-body');
      while (body.firstChild) body.removeChild(body.firstChild);
      body.appendChild(card);
      it.hidden = false;
    }
    // A row whose card emby.js no longer draws (signed out) is hidden with its card.
    let n = 0;
    list.querySelectorAll('.cfg-item').forEach(it => {
      const card = it.querySelector('.cfg-body > .aw-card');
      const live = !!card && !!document.getElementById(it.dataset.cfg) && card.contains(document.getElementById(it.dataset.cfg));
      const show = live && embyOn();
      if (it.hidden === show) it.hidden = !show;
      if (show) n++;
    });
    return n;
  }

  /* ------------------------------------------------------------ Subtitles (24 Oct) */
  // subs.js's whole Subtitles section (show, languages, style) gets its own page; its two automatic
  // switches stay in Configurations. Shown only while a media server is signed in.
  function buildSubs() {
    const pg = page('subs'); if (!pg) return false;
    const secs = byId('gsub-settings');
    const fresh = secs.filter(n => n.parentNode !== pg);
    const pick = fresh.length ? fresh[fresh.length - 1] : secs.find(n => n.parentNode === pg);
    Array.from(pg.querySelectorAll(':scope > #gsub-settings')).forEach(n => { if (n !== pick) n.remove(); });
    if (pick && pick.parentNode !== pg) pg.appendChild(pick);
    return !!pick && embyOn();
  }

  /* emby.js's sections left empty by the moves (Playback, Grid layout, Ambient widgets, Server
     conversion keep only their heading): hidden, so nothing reads as a blank box. */
  function hideEmpties() {
    all('.settings-panel[data-panel="videologin"] > section').forEach(s => {
      const empty = !s.querySelector('input, select, button, textarea');
      if (s.hidden !== empty) s.hidden = empty;
    });
  }

  function pageButton(id) { return document.querySelector('#vault-overlay .settings-tabs > .settings-tab[data-st="' + id + '"]'); }

  function gather() {
    if (!ov()) return;
    styles();
    const root = buildConfig();
    const widgets = buildWidgets();
    const subs = buildSubs();
    hideEmpties();
    const sb = pageButton('subs');
    if (sb) { const d = subs ? '' : 'none'; if (sb.style.display !== d) sb.style.display = d; }
    if (!subs && window.GnwSettingsUi && window.GnwSettingsUi.current() === 'subs') window.GnwSettingsUi.show('config');
    const wb = pageButton('widgets');
    // The tab's own display rule beats [hidden]: hide it by style.
    if (wb) { const d = widgets ? '' : 'none'; if (wb.style.display !== d) wb.style.display = d; }
    if (!widgets && window.GnwSettingsUi && window.GnwSettingsUi.current() === 'widgets') window.GnwSettingsUi.show('config');
    if (root) paintValues(root);
    const wr = document.getElementById('wg-root');
    if (wr) paintValues(wr);
  }

  let pending = 0;
  // A timer, not an animation frame: a hidden tab runs no frames.
  function schedule() { if (pending) return; pending = setTimeout(() => { pending = 0; gather(); }, 30); }

  function install() {
    const o = ov();
    if (!o || !page('config')) return false;
    gather();
    new MutationObserver(schedule).observe(o, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-checked', 'class'] });
    return true;
  }

  window.GnwConfig = { BUILD, refresh: () => gather() };
  const boot = () => { if (!install()) setTimeout(boot, 800); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

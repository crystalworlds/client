/*
 * retroachievements.js -- RetroAchievements, read only (Phase A), 21 Nov 2026.
 *
 * Design: Briefs/research/RETROACHIEVEMENTS-DESIGN.md, sections 5.6 and 5.7 and its
 * Phase A mock-up. Approved 21 Nov 2026 ("build RetroAchievements phase 1").
 * Nothing is earned on this site: the drawer shows the achievements a player earned anywhere else
 * (an emulator at home, a handheld), read from RetroAchievements' Web API with the player's own key.
 *
 * WHERE IT SHOWS
 *   Settings > Media and content: an "Achievements" tile (RetroAchievements), set up like the media
 *   servers' (settings-sources.js holds the tile, this file draws its panel body): user name and Web API
 *   key, Connect (which tests them with one call), then Test the connection and Disconnect. The tile's
 *   switch turns the drawer section off without disconnecting (source-switch.js, id 'ra').
 *   The game drawer: an "Achievements" section after My games, before the green status panel. Only when
 *   connected, switched on, and the game has a set. A game with no set shows nothing.
 *
 * THE KEY STAYS IN THIS BROWSER. localStorage 'cw.ra.account.v1' = { u, k, ulid, pic }. It is sent to
 * retroachievements.org only (the Web API takes it as the y= parameter, over https), never to our site,
 * our game server or the vault, never written to the console or a log, never in an export. Disconnect
 * deletes it and the cached answers.
 *
 * MATCHING. A tile is matched to a RetroAchievements game by its file: firmware/retroachievements/<sys>.json
 * maps the first 12 hex digits of the file's SHA-256 (the part a tile's id carries) to RetroAchievements'
 * game id. The tables are built offline (WASM_Source/retroachievements/build_ra_table.mjs) by hashing each
 * game file with RetroAchievements' own rule and looking it up in their public hash lists, because the one
 * hash lookup call RetroAchievements has cannot be made from a browser (design 1.5 and 5.3). The drawer tries
 * the version Play opens, then the tile's own file, then the drawer's other versions (not hacks or
 * translations, which RetroAchievements keeps as games of their own).
 *
 * BEING A GOOD GUEST (their API terms, design 2.4): answers cached in this browser (a game's progress
 * for 10 minutes, "no set" for a day), one request at a time at least 1.5 seconds apart, a pause of a
 * minute after RetroAchievements says "too many requests", nothing fetched until a drawer is opened (or, for the
 * wall's widget, until its tile is on screen).
 * A browser cannot set its own User-Agent (the browser forbids it), so these requests carry the browser's.
 *
 * THE WALL'S WIDGET (23 Nov 2026): widgets-extra.js draws an Achievements tile among the
 * others from one shared summary kept here (see "the wall's widget" below). It asks only while a tile is
 * on screen, at most once every 12 minutes, in the same one-at-a-time queue.
 *
 * Badge pictures come from media.retroachievements.org and are RetroAchievements' own, shown as theirs:
 * each links to its achievement on RetroAchievements.org. SOUND: none.
 */
(function () {
  'use strict';
  if (window.CwRA) return;
  const BUILD = '20261121-raphasea';
  const TABLES = '2.3.0-n64infra';
  const API = 'https://retroachievements.org/API/';
  const MEDIA = 'https://media.retroachievements.org';
  const SITE = 'https://retroachievements.org';
  const LS_ACC = 'cw.ra.account.v1', LS_CACHE = 'cw.ra.cache.v1';
  const FRESH_MS = 10 * 60 * 1000, NOSET_MS = 24 * 3600 * 1000, KEEP_MS = 7 * 24 * 3600 * 1000, GAP_MS = 1500, BUSY_MS = 60 * 1000;
  const BASE = (function () {
    try { const s = document.currentScript && document.currentScript.src; if (s) return s.replace(/[^/]*$/, '') + 'firmware/retroachievements/'; } catch (e) {}
    return 'firmware/retroachievements/';
  })();
  /* The site's shelves (a drawer's catalogue) -> the table (variants.js's names). G&W, the 5200 and the
     colour twins have none: RetroAchievements has no hash rule for them (design 3). */
  const TABLE_OF = { nes: 'nes', 'game-boy': 'gb', 'pokemon-mini': 'pm', atari2600: 'atari2600', atari7800: 'atari7800', atarilynx: 'atarilynx', sg1000: 'sg1000', mastersystem: 'mastersystem', gamegear: 'gamegear', n64: 'n64', snes: 'snes' };

  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* ------------------------------------------------------------ the account (this browser only) */
  function account() {
    try { const a = JSON.parse(localStorage.getItem(LS_ACC) || 'null'); return a && a.u && a.k ? a : null; } catch (e) { return null; }
  }
  function saveAccount(a) { try { localStorage.setItem(LS_ACC, JSON.stringify(a)); return true; } catch (e) { return false; } }
  function forget() {
    try { localStorage.removeItem(LS_ACC); } catch (e) {}
    try { localStorage.removeItem(LS_CACHE); } catch (e) {}
    try { localStorage.removeItem('cw.ra.summary.v1'); } catch (e) {}   // the wall widget's summary
    mem.clear();
    try { sumMem = null; } catch (e) {}
  }
  const switchedOn = () => { try { return !window.CwSources || window.CwSources.on('ra'); } catch (e) { return true; } };
  const active = () => !!account() && switchedOn();

  /* ------------------------------------------------------------ the cache */
  const mem = new Map();   // game id -> { t, d } (d: the trimmed answer, or { none: 1 })
  function cacheAll() { try { const o = JSON.parse(localStorage.getItem(LS_CACHE) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
  function cacheGet(id, u) {
    const k = u + ':' + id;
    if (mem.has(k)) return mem.get(k);
    const e = cacheAll()[k]; if (e) mem.set(k, e);
    return e || null;
  }
  function cachePut(id, u, d) {
    const k = u + ':' + id, e = { t: Date.now(), d };
    mem.set(k, e);
    try {
      const o = cacheAll(); o[k] = e;
      const now = Date.now();
      for (const x of Object.keys(o)) if (!o[x] || now - o[x].t > KEEP_MS) delete o[x];
      const keys = Object.keys(o).sort((a, b) => o[b].t - o[a].t);
      for (const x of keys.slice(60)) delete o[x];   // the 60 latest games
      localStorage.setItem(LS_CACHE, JSON.stringify(o));
    } catch (e) {}
  }

  /* ------------------------------------------------------------ requests: one at a time, spaced */
  let chain = Promise.resolve(), lastAt = 0, busyUntil = 0;
  class RAError extends Error { constructor(kind) { super(kind); this.kind = kind; } }
  function call(name, params) {
    const run = async () => {
      if (Date.now() < busyUntil) throw new RAError('busy');
      const wait = lastAt + GAP_MS - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastAt = Date.now();
      const q = new URLSearchParams(params).toString();
      let r;
      try { r = await fetch(API + name + '.php?' + q, { method: 'GET', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' }); }
      catch (e) { throw new RAError(navigator.onLine === false ? 'offline' : 'network'); }
      if (r.status === 401 || r.status === 403) throw new RAError('key');
      if (r.status === 429) { busyUntil = Date.now() + BUSY_MS; throw new RAError('busy'); }
      if (r.status === 404) throw new RAError('missing');
      if (!r.ok) throw new RAError('server');
      try { return await r.json(); } catch (e) { throw new RAError('server'); }
    };
    const p = chain.then(run, run);
    chain = p.catch(() => {});
    return p;
  }
  const WHY = {
    key: 'RetroAchievements did not accept the user name and Web API key. Check them in Settings, Media and content, Achievements.',
    busy: 'RetroAchievements asked for fewer requests for a while. Try again in a minute.',
    offline: 'This device is offline, so RetroAchievements cannot be reached.',
    network: 'RetroAchievements could not be reached. Check the connection and try again.',
    server: 'RetroAchievements did not answer properly. Try again later.',
    missing: 'RetroAchievements does not know this game any more.',
  };
  const why = (e) => WHY[(e && e.kind) || 'network'] || WHY.network;

  /* ------------------------------------------------------------ the tables */
  const tables = {}, loading = {};
  function table(sys) {
    if (tables[sys] !== undefined) return Promise.resolve(tables[sys]);
    if (!loading[sys]) {
      loading[sys] = fetch(BASE + sys + '.json?v=' + TABLES)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { tables[sys] = (j && j.ids) || {}; return tables[sys]; })
        .catch(() => { delete loading[sys]; return {}; });
    }
    return loading[sys];
  }
  const sha12Of = (d) => {
    try { const e = window.Variants && Variants.info && Variants.info(d); if (e && e.sha) return String(e.sha).slice(0, 12); } catch (x) {}
    const m = /-x([0-9a-f]{12})$/.exec((d && d.id) || '');
    return m ? m[1] : null;
  };
  const isHack = (d) => { try { const e = window.Variants && Variants.info && Variants.info(d); return !!(e && e.th); } catch (x) { return false; } };
  const devOf = (id) => { try { return (typeof ALL_DEVICES !== 'undefined' && ALL_DEVICES.find((x) => x.id === id)) || null; } catch (e) { return null; } };
  /* The RetroAchievements game for a drawer: the version Play opens, the tile's own file, then the other versions. */
  async function gameIdFor(d) {
    const sys = d && TABLE_OF[d.catalogue];
    if (!sys) return 0;
    const t = await table(sys);
    const order = [];
    const add = (x) => { if (x && !order.includes(x)) order.push(x); };
    try { if (window.Variants && Variants.preferred) add(devOf(Variants.preferred(d.id))); } catch (e) {}
    add(d);
    try { if (window.Variants && Variants.members) for (const x of Variants.members(d)) if (!isHack(x)) add(x); } catch (e) {}
    for (const x of order) { const h = sha12Of(x); if (h && t[h]) return +t[h]; }
    return 0;
  }

  /* ------------------------------------------------------------ one game's progress */
  /* The answer of API_GetGameInfoAndUserProgress, trimmed to what the drawer shows. */
  function trim(j) {
    const list = Object.values((j && j.Achievements) || {}).map((a) => ({
      id: +a.ID, t: String(a.Title || ''), ds: String(a.Description || ''), p: +a.Points || 0, b: String(a.BadgeName || ''),
      o: +a.DisplayOrder || 0, e: a.DateEarned || '', h: a.DateEarnedHardcore || '',
    }));
    list.sort((a, b) => a.o - b.o || a.id - b.id);
    // the game's guide and its forum topic, linked (never copied) so players find tips there
    const guide = /^https:\/\/[^\s"'<>]+$/i.test(String(j.GuideURL || '')) ? String(j.GuideURL) : '';
    return { id: +j.ID, title: String(j.Title || ''), n: +j.NumAchievements || list.length, list, guide, forum: +j.ForumTopicID || 0 };
  }
  async function progress(gid, force) {
    const a = account(); if (!a) throw new RAError('key');
    const c = cacheGet(gid, a.u);
    const age = c ? Date.now() - c.t : Infinity;
    if (c && !force && (c.d.none ? age < NOSET_MS : age < FRESH_MS)) return { d: c.d, t: c.t };
    try {
      const j = await call('API_GetGameInfoAndUserProgress', { g: gid, u: a.ulid || a.u, y: a.k });
      const d = j && (+j.NumAchievements > 0 || Object.keys(j.Achievements || {}).length) ? trim(j) : { none: 1 };
      cachePut(gid, a.u, d);
      return { d, t: Date.now() };
    } catch (e) {
      if (c && e.kind !== 'key') return { d: c.d, t: c.t, stale: e };
      throw e;
    }
  }

  /* ------------------------------------------------------------ the drawer section */
  const raDate = (s) => { if (!s) return null; const t = Date.parse(String(s).replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? '' : 'Z')); return isNaN(t) ? null : new Date(t); };
  const dayText = (dt) => { try { return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return dt.toISOString().slice(0, 10); } };
  const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m === 1 ? '1 minute ago' : m < 60 ? m + ' minutes ago' : Math.round(m / 60) === 1 ? '1 hour ago' : Math.round(m / 60) + ' hours ago'; };
  const LIST_SHOWN = 8;
  function badgeHTML(a, small) {
    const got = !!(a.e || a.h);
    const src = MEDIA + '/Badge/' + encodeURIComponent(a.b) + (got ? '' : '_lock') + '.png';
    const when = a.h ? 'Earned in hardcore ' + dayText(raDate(a.h)) : a.e ? 'Earned ' + dayText(raDate(a.e)) : 'Not earned yet';
    const label = a.t + ', ' + a.p + (a.p === 1 ? ' point' : ' points') + '. ' + when + '. Opens on RetroAchievements.org';
    return `<a class="ra-badge${got ? ' got' : ''}${a.h ? ' hc' : ''}${small ? ' sm' : ''}" href="${SITE}/achievement/${a.id}" target="_blank" rel="noopener noreferrer" title="${esc(a.t + ' (' + when + ')')}" aria-label="${esc(label)}">`
      + `<img src="${src}" alt="" width="64" height="64" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a>`;
  }
  function sectionHTML(d, r, a, more) {
    const g = r.d, list = g.list;
    const got = list.filter((x) => x.e || x.h), hc = list.filter((x) => x.h).length, casual = got.length - hc;
    const pts = got.reduce((s, x) => s + x.p, 0), total = list.reduce((s, x) => s + x.p, 0);
    const last = got.map((x) => raDate(x.h && x.e ? (x.h > x.e ? x.h : x.e) : (x.h || x.e))).filter(Boolean).sort((x, y) => y - x)[0];
    const pct = list.length ? Math.round((got.length / list.length) * 100) : 0;
    const order = got.slice().sort((x, y) => x.o - y.o).concat(list.filter((x) => !(x.e || x.h)));
    const shown = more ? order : order.slice(0, LIST_SHOWN);
    let h = '<h3 class="sect-h"><button type="button" class="sect-tog" data-sect-kind="achievements" aria-expanded="true">Achievements</button></h3>';
    h += `<div class="ra-stats"><div class="ra-big">${got.length} <small>of ${list.length} earned</small></div><div class="ra-big">${pts} <small>of ${total} points</small></div></div>`;
    h += `<div class="ra-bar" role="progressbar" aria-label="Achievements earned" aria-valuemin="0" aria-valuemax="${list.length}" aria-valuenow="${got.length}" aria-valuetext="${got.length} of ${list.length} earned"><i style="width:${pct}%"></i></div>`;
    h += `<div class="ra-tags"><span class="ra-tag ra-tag-hc">Hardcore ${hc}</span><span class="ra-tag">Casual ${casual}</span>${last ? `<span class="ra-tag">Last earned ${esc(dayText(last))}</span>` : '<span class="ra-tag">None earned yet</span>'}</div>`;
    h += `<div class="ra-grid" role="list" aria-label="Badges">${order.map((x) => `<span role="listitem">${badgeHTML(x)}</span>`).join('')}</div>`;
    h += '<ul class="ra-list">' + shown.map((x) => {
      const w = x.h ? 'Hardcore, ' + dayText(raDate(x.h)) : x.e ? 'Casual, ' + dayText(raDate(x.e)) : '';
      return `<li class="ra-it${x.e || x.h ? ' got' : ''}">${badgeHTML(x, true)}<div class="ra-tx"><b>${esc(x.t)}</b><span>${esc(x.ds)}</span>${w ? `<span class="ra-when">${esc(w)}</span>` : ''}</div><span class="ra-pts">${x.p} ${x.p === 1 ? 'pt' : 'pts'}</span></li>`;
    }).join('') + '</ul>';
    if (!more && order.length > LIST_SHOWN) h += `<button type="button" class="ra-more" data-ra-more>Show all ${order.length} achievements</button>`;
    const tips = [];
    if (g.guide) tips.push(`<a href="${esc(g.guide)}" target="_blank" rel="noopener noreferrer">Achievement guide</a>`);
    if (g.forum) tips.push(`<a href="${SITE}/viewtopic.php?t=${g.forum}" target="_blank" rel="noopener noreferrer">Tips and discussion</a>`);
    if (tips.length) h += `<p class="ra-src">${tips.join(' · ')} (on RetroAchievements)</p>`;
    h += `<p class="ra-src"><a href="${SITE}/game/${g.id}" target="_blank" rel="noopener noreferrer">Open ${esc(g.title || 'this game')} on RetroAchievements.org</a></p>`;
    h += `<p class="ra-src">Achievements and badges from RetroAchievements.org, earned in any emulator that supports it. Your account: <b>${esc(a.u)}</b>. Updated ${esc(ago(r.t))}.</p>`;
    if (r.stale) h += `<p class="ra-err" role="status">${esc(why(r.stale))} These are the achievements from ${esc(ago(r.t))}.</p>`;
    return h;
  }
  function drawerSlotHTML(d) {
    if (!d || !TABLE_OF[d.catalogue] || !active()) return '';
    return `<section class="sect ra-sect" data-ra-for="${esc(d.id)}" aria-label="Achievements" hidden></section>`;
  }
  const _shown = new Map();   // drawer id -> { r, more }
  function fillDrawer(modal, d) {
    if (!modal || !d) return;
    const sec = modal.querySelector('.ra-sect[data-ra-for="' + (window.CSS && CSS.escape ? CSS.escape(d.id) : d.id) + '"]');
    if (!sec) return;
    styles();
    const a = account(); if (!a || !switchedOn()) { sec.hidden = true; return; }
    const live = () => sec.isConnected && modal.dataset.udId === d.id;
    gameIdFor(d).then((gid) => {
      if (!gid || !live()) return null;
      return progress(gid).then((r) => {
        if (!live()) return;
        if (r.d.none || !r.d.list || !r.d.list.length) { sec.hidden = true; sec.innerHTML = ''; return; }
        const st = { r, more: false }; _shown.set(d.id, st);
        sec.innerHTML = sectionHTML(d, r, a, false);
        sec.hidden = false;
      }, (e) => {
        if (!live()) return;
        // A plain line, so the player knows why nothing shows: a bad key, offline, too many requests.
        sec.innerHTML = '<h3 class="sect-h">Achievements</h3><p class="ra-err" role="status">' + esc(why(e)) + '</p>';
        sec.hidden = false;
      });
    }).catch(() => {});
  }
  document.addEventListener('click', (e) => {
    const b = e.target && e.target.closest && e.target.closest('#device-modal .ra-sect [data-ra-more]');
    if (!b) return;
    const sec = b.closest('.ra-sect'), id = sec && sec.dataset.raFor, st = id && _shown.get(id), a = account();
    if (!st || !a) return;
    st.more = true;
    const d = devOf(id) || { id };
    sec.innerHTML = sectionHTML(d, st.r, a, true);
    const items = sec.querySelectorAll('.ra-list .ra-it a');
    const f = items[LIST_SHOWN]; if (f) { try { f.focus({ preventScroll: false }); } catch (x) {} }
  });

  /* ------------------------------------------------------------ the wall's widget (23 Nov 2026)
     One shared answer for every Achievements tile on the wall: API_GetUserSummary (the player's points,
     recently played games with their progress, and recent achievements), fetched at most once every
     12 minutes and only while a tile is on screen (widgets-extra.js asks), one request in the same
     spaced queue as the drawer's. Kept in this browser ('cw.ra.summary.v1', per user) so the wall works
     offline from it with an "Updated ..." note. A key RetroAchievements refuses marks the summary bad:
     the wall then places no tile at all (no error tiles), until Connect or Test the connection works. */
  const LS_SUM = 'cw.ra.summary.v1', SUM_FRESH_MS = 12 * 60 * 1000, SUM_GAMES = 6, SUM_ACH = 12;
  /* RetroAchievements' console ids -> our tables (build_ra_table.mjs SYS): FDS is 81, Game Boy Color 6. */
  const CONSOLE_TABLE = { 7: 'nes', 81: 'nes', 4: 'gb', 6: 'gb', 24: 'pm', 25: 'atari2600', 51: 'atari7800', 13: 'atarilynx', 33: 'sg1000', 11: 'mastersystem', 15: 'gamegear', 2: 'n64', 3: 'snes' };
  const flag = (v) => v === true || v === 1 || v === '1';
  function trimSummary(j) {
    const aw = (j && j.Awarded) || {};
    const games = (Array.isArray(j && j.RecentlyPlayed) ? j.RecentlyPlayed : []).map((g) => {
      const a = aw[g.GameID] || aw[String(g.GameID)] || {};
      return {
        id: +g.GameID || 0, c: +g.ConsoleID || 0, cn: String(g.ConsoleName || ''), title: String(g.Title || ''), icon: String(g.ImageIcon || ''),
        last: String(g.LastPlayed || ''), n: +a.NumPossibleAchievements || +g.AchievementsTotal || 0, got: +a.NumAchieved || 0, gotH: +a.NumAchievedHardcore || 0,
      };
    }).filter((g) => g.id);
    const ach = [];
    const ra = (j && j.RecentAchievements) || {};
    for (const gk of Object.keys(ra)) {
      const per = ra[gk] || {};
      for (const ak of Object.keys(per)) {
        const x = per[ak] || {};
        if (x.IsAwarded !== undefined && !flag(x.IsAwarded)) continue;
        if (!x.DateAwarded) continue;
        ach.push({ id: +x.ID || +ak || 0, gid: +x.GameID || +gk || 0, game: String(x.GameTitle || ''), t: String(x.Title || ''), ds: String(x.Description || ''), p: +x.Points || 0, b: String(x.BadgeName || ''), at: String(x.DateAwarded), hc: flag(x.HardcoreAchieved) });
      }
    }
    ach.sort((x, y) => (raDate(y.at) || 0) - (raDate(x.at) || 0));
    return { u: String((j && j.User) || ''), pts: +(j && j.TotalPoints) || 0, soft: +(j && j.TotalSoftcorePoints) || 0, games, ach: ach.slice(0, SUM_ACH) };
  }
  function sumRead() { try { const o = JSON.parse(localStorage.getItem(LS_SUM) || 'null'); return o && typeof o === 'object' ? o : null; } catch (e) { return null; } }
  function sumWrite(o) { try { if (o) localStorage.setItem(LS_SUM, JSON.stringify(o)); else localStorage.removeItem(LS_SUM); } catch (e) {} }
  let sumMem = null;   // { u, t, d, bad } for the account now
  function sumNow() {
    const a = account(); if (!a) return null;
    if (sumMem && sumMem.u === a.u) return sumMem;
    const o = sumRead();
    sumMem = o && o.u === a.u ? o : null;
    return sumMem;
  }
  /* 'off' (not connected or switched off), 'bad' (the key was refused), 'none' (no answer yet), 'ready'. */
  function widgetState() {
    if (!active()) return 'off';
    const s = sumNow();
    if (s && s.bad) return 'bad';
    return s && s.d ? 'ready' : 'none';
  }
  const widgetSay = () => { try { window.dispatchEvent(new CustomEvent('cw:ra-widget', { detail: { state: widgetState() } })); } catch (e) {} };
  let sumP = null, sumFailAt = 0;
  /* The summary: the kept one while fresh, else one request (shared by every caller). Never throws. */
  function summary(force) {
    const a = account();
    if (!a || !switchedOn()) return Promise.resolve(null);
    const s = sumNow();
    if (s && s.bad && !force) return Promise.resolve(null);
    if (!force && s && s.d && Date.now() - s.t < SUM_FRESH_MS) return Promise.resolve(s);
    if (!force && Date.now() - sumFailAt < 2 * 60 * 1000) return Promise.resolve(s && s.d ? s : null);   // a failed try waits two minutes
    if (sumP) return sumP;
    const before = widgetState();
    sumP = call('API_GetUserSummary', { u: a.ulid || a.u, y: a.k, g: SUM_GAMES, a: SUM_ACH }).then((j) => {
      if (!j || !j.User) throw new RAError('missing');
      const cur = account(); if (!cur || cur.u !== a.u) return null;   // disconnected meanwhile
      sumMem = { u: a.u, t: Date.now(), d: trimSummary(j) };
      sumWrite(sumMem); sumFailAt = 0;
      return sumMem;
    }, (e) => {
      sumFailAt = Date.now();
      const cur = account(); if (!cur || cur.u !== a.u) return null;
      if (e && e.kind === 'key') { sumMem = { u: a.u, t: Date.now(), bad: 1 }; sumWrite(sumMem); return null; }
      const k = sumNow(); return k && k.d ? Object.assign({}, k, { stale: e }) : null;   // offline, busy: the kept answer
    }).finally(() => {
      sumP = null;
      if (widgetState() !== before) widgetSay();
      try { window.dispatchEvent(new CustomEvent('cw:ra-summary')); } catch (e) {}
    });
    return sumP;
  }
  /* A tile of ours for a RetroAchievements game: the reverse of gameIdFor, through the same tables.
     Per table, an index game id -> the shelf's titles whose file the table knows, built once per list. */
  const _rev = {};   // table -> { n, map: Map(gid -> [devices]) }
  async function tileFor(gid, consoleId) {
    gid = +gid; const sys = CONSOLE_TABLE[+consoleId];
    if (!gid || !sys || typeof ALL_DEVICES === 'undefined') return null;
    const t = await table(sys);
    const n = ALL_DEVICES.length;
    let r = _rev[sys];
    if (!r || r.n !== n) {
      const map = new Map();
      for (const d of ALL_DEVICES) {
        if (!d || TABLE_OF[d.catalogue] !== sys || d.pmVariantOf || d.sgbOf) continue;
        const h = sha12Of(d), g = h && t[h];
        if (g) { const l = map.get(+g); if (l) l.push(d); else map.set(+g, [d]); }
      }
      r = _rev[sys] = { n, map };
    }
    const list = (r.map.get(gid) || []).filter((d) => !isHack(d));
    if (!list.length) return null;
    let pick = list[0];
    try { if (window.Variants && Variants.collapse) { const c = Variants.collapse(list.slice()); if (c && c.length) pick = c[0]; } } catch (e) {}
    return pick.id;
  }
  const mediaUrl = (p) => (!p ? '' : /^https:\/\//.test(p) ? p : MEDIA + (p.charAt(0) === '/' ? '' : '/') + p);

  /* ------------------------------------------------------------ Settings: the tile's panel */
  let msgText = '', msgBad = false, busy = false;
  function tileState() {
    const a = account();
    if (!a) return { on: false, detail: '' };
    const off = !switchedOn();
    return { on: true, off, detail: off ? 'Switched off' : 'Connected as ' + a.u };
  }
  function drawPanel(body) {
    if (!body) return;
    styles();
    const a = account();
    const msg = `<div class="src-msg" id="ra-msg" role="status" aria-live="polite"${msgBad ? ' style="color:#f08a5d"' : ''}>${esc(msgText)}</div>`;
    const keep = '<p class="src-note">The key stays in this browser only. It goes to RetroAchievements.org and nowhere else: never to this site, a game server or your vault. Disconnect deletes it from this browser.</p>';
    if (!a) {
      body.innerHTML = '<form class="ra-form" autocomplete="off" novalidate>'
        + '<div class="src-field"><label for="ra-user">User name</label><input id="ra-user" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="64"></div>'
        + '<div class="src-field"><label for="ra-key">Web API key</label><input id="ra-key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="128"></div>'
        + msg
        + '<p class="src-note">Your Web API key is on RetroAchievements.org: sign in there, open <a href="https://retroachievements.org/controlpanel.php" target="_blank" rel="noopener noreferrer">Settings</a> and copy the key under <b style="color:var(--text)">Keys</b>. It is not your password. Your password is never asked for here.</p>'
        + keep
        + '<p class="src-note">Each game drawer then shows the achievements you earned in that game anywhere RetroAchievements counts them. A game with no achievement set shows nothing. Achievements are not earned on this site.</p>'
        + '</form>';
      const f = body.querySelector('.ra-form');
      f.addEventListener('submit', (e) => { e.preventDefault(); connect(); });
      return;
    }
    body.innerHTML = '<div class="ra-who">'
      + `<img class="ra-pic" src="${MEDIA}/UserPic/${encodeURIComponent(a.u)}.png" alt="" width="48" height="48" referrerpolicy="no-referrer" onerror="this.remove()">`
      + `<div><b>${esc(a.u)}</b><span>Connected to RetroAchievements.org</span></div></div>`
      + msg
      + '<div class="ra-acts"><button type="button" class="btn-tiny" data-ra-act="test">Test the connection</button>'
      + '<button type="button" class="btn-tiny ra-disc" data-ra-act="disconnect">Disconnect</button></div>'
      + '<p class="src-note">Disconnect deletes the user name and key from this browser. The switch on the tile hides achievements from the game drawers and keeps the key.</p>'
      + keep;
    body.querySelectorAll('[data-ra-act]').forEach((b) => b.addEventListener('click', () => (b.dataset.raAct === 'test' ? test() : disconnect())));
  }
  const panelBody = () => document.querySelector('#src-sheet .src-body[data-for="ra"]');
  function say(t, bad) {
    msgText = t || ''; msgBad = !!bad;
    const m = document.getElementById('ra-msg');
    if (m) { m.textContent = msgText; m.style.color = bad ? '#f08a5d' : ''; }
  }
  function redraw(focusSel) {
    drawPanel(panelBody());
    try { if (window.GnwSources) window.GnwSources.render(); } catch (e) {}
    if (focusSel) { const el = document.querySelector(focusSel); if (el) { try { el.focus({ preventScroll: true }); } catch (e) {} } }
  }
  async function connect() {
    if (busy) return;
    const ui = document.getElementById('ra-user'), ki = document.getElementById('ra-key');
    const u = ((ui && ui.value) || '').trim(), k = ((ki && ki.value) || '').trim();
    if (!u || !k) { say(!u ? 'Type your RetroAchievements user name.' : 'Paste your Web API key.', true); try { (!u ? ui : ki).focus(); } catch (e) {} return; }
    if (!/^[A-Za-z0-9_.-]{2,64}$/.test(u)) { say('That does not look like a RetroAchievements user name.', true); try { ui.focus(); } catch (e) {} return; }
    if (!/^[A-Za-z0-9]{8,128}$/.test(k)) { say('That does not look like a Web API key. Copy it again from RetroAchievements.org.', true); try { ki.focus(); } catch (e) {} return; }
    busy = true; say('Checking with RetroAchievements…');
    try {
      const p = await call('API_GetUserProfile', { u, y: k });
      if (!p || !p.User) throw new RAError('missing');
      if (!saveAccount({ u: String(p.User), k, ulid: p.ULID ? String(p.ULID) : '', pic: p.UserPic ? String(p.UserPic) : '' })) { busy = false; say('This browser does not allow the site to keep the key, so it cannot connect here.', true); return; }
      mem.clear();
      try { if (window.CwSources) window.CwSources.set('ra', true, true); } catch (e) {}
      busy = false; say('Connected. Open a game\'s drawer to see its achievements.');
      redraw('#src-sheet .src-sheet-back');
      sumMem = null; sumWrite(null); sumFailAt = 0; widgetSay();
      summary(true);   // the wall's Achievements widget gets its first answer now (it appears once there is one)
    } catch (e) {
      busy = false;
      say(e && e.kind === 'missing' ? 'RetroAchievements has no user by that name.' : e && e.kind === 'key' ? 'RetroAchievements did not accept that user name and Web API key. Check both and try again.' : why(e), true);
    }
  }
  async function test() {
    const a = account(); if (!a || busy) return;
    busy = true; say('Checking with RetroAchievements…');
    try {
      const p = await call('API_GetUserProfile', { u: a.ulid || a.u, y: a.k });
      busy = false;
      if (!p || !p.User) throw new RAError('missing');
      say('The connection works. RetroAchievements knows you as ' + p.User + '.');
      const s = sumNow(); if (s && s.bad) { sumMem = null; sumWrite(null); sumFailAt = 0; widgetSay(); summary(true); }   // the widget may come back
    } catch (e) { busy = false; say(e && e.kind === 'key' ? 'RetroAchievements did not accept the key. Disconnect, then connect again with the key from your RetroAchievements settings.' : why(e), true); }
  }
  function disconnect() {
    forget();
    try { if (window.CwSources) window.CwSources.set('ra', true, true); } catch (e) {}   // nothing set up: no switch to remember
    say('Disconnected. The user name and key are deleted from this browser.');
    redraw('#ra-user');
    document.querySelectorAll('#device-modal .ra-sect').forEach((s) => { s.hidden = true; s.innerHTML = ''; });
    widgetSay();
  }
  function onOpen() { msgText = ''; msgBad = false; drawPanel(panelBody()); }
  window.addEventListener('cw:source-switch', (e) => {
    if (!e || !e.detail || e.detail.id !== 'ra') return;
    if (!e.detail.on) document.querySelectorAll('#device-modal .ra-sect').forEach((s) => { s.hidden = true; s.innerHTML = ''; });
    widgetSay();
  });

  /* ------------------------------------------------------------ styles */
  function styles() {
    if (document.getElementById('ra-styles')) return;
    const st = document.createElement('style');
    st.id = 'ra-styles';
    st.textContent = `
      .ra-sect[hidden] { display: none !important; }
      .ra-stats { display: flex; gap: 18px; flex-wrap: wrap; align-items: baseline; }
      .ra-big { font-size: 22px; font-weight: 800; color: var(--text); line-height: 1.2; }
      .ra-big small { font-size: 12px; font-weight: 600; color: var(--muted); }
      .ra-bar { height: 8px; border-radius: 6px; overflow: hidden; margin: 10px 0 8px; background: rgba(127,127,127,.22); }
      .ra-bar i { display: block; height: 100%; background: var(--accent); border-radius: 6px; }
      .ra-tags { display: flex; flex-wrap: wrap; gap: 6px; }
      .ra-tag { display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 20px; border: 1px solid var(--line); color: var(--muted); }
      .ra-tag-hc { border-color: #d9a520; color: #e0ae2c; }
      :root[data-theme="light"] .ra-tag-hc { border-color: #9a6d00; color: #835c00; }
      .ra-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(38px, 1fr)); gap: 6px; margin-top: 12px; }
      .ra-badge { position: relative; display: block; aspect-ratio: 1; border-radius: 7px; overflow: hidden; border: 1px solid var(--line); background: rgba(127,127,127,.12); }
      .ra-badge img { display: block; width: 100%; height: 100%; object-fit: cover; }
      .ra-badge:not(.got) img { opacity: .6; }
      .ra-badge.got { border-color: rgba(var(--accent-rgb),.55); }
      .ra-badge.hc { border-color: #d9a520; box-shadow: 0 0 0 1px #d9a520; }
      .ra-badge:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
      .ra-badge.sm { width: 36px; height: 36px; flex: none; }
      .ra-list { list-style: none; margin: 12px 0 0; padding: 0; }
      .ra-it { display: flex; gap: 10px; align-items: center; padding: 8px 0; border-top: 1px solid var(--line); }
      .ra-tx { min-width: 0; display: flex; flex-direction: column; gap: 1px; font-size: 12.5px; line-height: 1.4; }
      .ra-tx b { color: var(--text); overflow-wrap: anywhere; }
      .ra-tx span { color: var(--muted); font-size: 12px; overflow-wrap: anywhere; }
      .ra-tx .ra-when { font-size: 11px; }
      .ra-pts { margin-left: auto; flex: none; font-size: 11.5px; font-weight: 800; color: var(--text); white-space: nowrap; }
      .ra-more { margin-top: 6px; min-height: 32px; padding: 6px 11px; border-radius: 9px; border: 1px solid var(--line); background: rgba(127,127,127,.06); color: var(--text); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
      .ra-more:hover, .ra-more:focus-visible { border-color: rgba(var(--accent-rgb),.6); }
      .ra-more:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
      .ra-src { margin: 10px 0 0; font-size: 11.5px; line-height: 1.5; color: var(--muted); }
      .ra-src a { color: var(--accent); font-weight: 700; text-underline-offset: 3px; }
      .ra-src a:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; border-radius: 3px; }
      .ra-err { margin: 6px 0 0; font-size: 12.5px; line-height: 1.5; color: #f08a5d; }
      :root[data-theme="light"] .ra-err { color: #a8431b; }
      .ra-who { display: flex; gap: 12px; align-items: center; }
      .ra-who img { width: 48px; height: 48px; border-radius: 10px; flex: none; }
      .ra-who div { display: flex; flex-direction: column; gap: 2px; font-size: 13px; color: var(--text); }
      .ra-who span { color: var(--muted); font-size: 12px; }
      .ra-form { display: flex; flex-direction: column; gap: 12px; }
      #vault-overlay .ra-form .src-note a, #vault-overlay .src-body[data-for="ra"] .src-note a { color: var(--accent); }
      .ra-acts { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
      .btn-tiny.ra-disc { color: #ff8a8a; border-color: rgba(240,80,80,.45); }
      :root[data-theme="light"] .btn-tiny.ra-disc { color: #a8231b; border-color: rgba(168,35,27,.45); }
    `;
    document.head.appendChild(st);
  }

  window.CwRA = {
    BUILD, drawerSlotHTML, fillDrawer, tileState, drawPanel, onOpen, connect, test, disconnect,
    connected: () => !!account(), user: () => { const a = account(); return a ? a.u : null; },
    gameIdFor, _tables: tables,
    /* The wall's Achievements widget (widgets-extra.js), 23 Nov 2026. */
    widgetState, summary, kept: () => { const s = sumNow(); return s && s.d && !s.bad ? s : null; }, tileFor, mediaUrl,
    raDate, dayText, SITE, MEDIA,
  };
})();

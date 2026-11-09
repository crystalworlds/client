/*
 * stories.js -- Stories for 16-Bit sponsors, read and heard on the site (7 Nov 2026).
 *
 * Settings > Media and content has a source tile (settings-sources.js) with Sign in with GitHub. A
 * Stories button sits right of Features on the search bar (emby.js), and opens the same window as Home
 * and Features. This file holds the sign-in, the reading and the drawing. index.html's small head
 * script loads it only when it is needed: a sign-in on this browser, a return from GitHub, the tile's
 * panel or the /stories address. A visitor who never signed in sends nothing to GitHub.
 *
 * NO STORY CONTENT IN THE SITE. Everything comes from the private repository below, through GitHub's
 * contents address, with the reader's own key. GitHub is the access list: when access goes, reads fail.
 *
 * EVERYTHING READ IS DATA. Words go in by textContent, never as HTML. Pictures and sound become blobs
 * of a type chosen here, not by the reply. Paths are checked. Nothing read is ever run.
 *
 * THE KEY. Kept in this browser's storage, as the content it opens is what the reader paid for and the
 * App reads one repository. Never in an address, never logged. It lasts 8 hours; a refresh token,
 * single use, lasts 6 months. The swap needs the App's secret, so it goes through insider-auth.
 */
(function () {
  'use strict';
  if (window.CwStories) return;

  const REPO = 'crystalworlds/insider';
  const LIST = 'stories/list.json';
  const API = 'https://api.github.com/repos/' + REPO + '/contents/';
  const AUTHORIZE = 'https://github.com/login/oauth/authorize';
  const AUTH_FN = 'https://xagjczzdqdezvrjbpbkt.supabase.co/functions/v1/insider-auth';
  /* Sign-in works on the public address. A copy of the site may add its one address in site.local.json (a
     local file that is never shipped, read the way keep.js reads it); GitHub must also know that address. */
  const ORIGINS = ['https://crystalworlds.media'];
  async function signInHere() {
    if (ORIGINS.indexOf(location.origin) >= 0) return true;
    if (location.protocol !== 'https:') return false;
    try {
      const r = await fetch('/site.local.json', { credentials: 'same-origin', cache: 'no-store' });
      const cfg = r.ok ? await r.json() : null;
      const one = cfg && typeof cfg.one_address === 'string' ? cfg.one_address.replace(/\/+$/, '').toLowerCase() : '';
      return !!one && one === location.origin.toLowerCase();
    } catch (_) { return false; }
  }
  const SPONSOR_URL = 'https://github.com/sponsors/crystalworlds';
  const INVITE_URL = 'https://github.com/crystalworlds/insider/invitations';
  const KEY = 'cw-stories-auth', FLOW = 'cw-stories-flow';
  const CSS = 'stories.css?v=2.1.0';
  const SOON_MS = 60000;   // a key this close to its end is swapped first

  const SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;
  const PICTURE = /^images\/[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.(jpe?g|png|webp|gif)$/i;
  const PICTURE_TYPE = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

  /* ------------------------------------------------------------ storage (the site's try/catch rule) */
  let memory = null;   // when storage is blocked, the sign-in lasts as long as the page
  function load() {
    try { const t = localStorage.getItem(KEY); return t ? JSON.parse(t) : memory; } catch (_) { return memory; }
  }
  function save(a) {
    memory = a;
    try { localStorage.setItem(KEY, JSON.stringify(a)); memory = null; } catch (_) {}
  }
  function forget() {
    memory = null;
    try { localStorage.removeItem(KEY); } catch (_) {}
  }
  function flowGet() { try { const t = sessionStorage.getItem(FLOW); return t ? JSON.parse(t) : null; } catch (_) { return null; } }
  function flowSet(f) { try { sessionStorage.setItem(FLOW, JSON.stringify(f)); return true; } catch (_) { return false; } }
  function flowDrop() { try { sessionStorage.removeItem(FLOW); } catch (_) {} }

  /* ------------------------------------------------------------ state */
  /* out, checking, ok, noaccess, ended, expired, unreachable, busy, empty. `note` is one plain sentence
     about the last sign-in attempt. */
  let state = 'out', note = '', list = null, lead = '';
  const failure = (kind, why) => Object.assign(new Error(why || kind), { kind });

  const TILE = {
    out: { on: false, detail: '' },
    expired: { on: false, text: 'Sign in again' },
    checking: { on: true, detail: 'Checking' },
    ok: { on: true, detail: 'Signed in' },
    noaccess: { on: true, detail: 'No access yet' },
    ended: { on: true, detail: 'Access ended' },
    empty: { on: true, detail: 'No stories yet' },
    unreachable: { on: true, detail: 'GitHub not reachable' },
    busy: { on: true, detail: 'GitHub is busy' },
  };

  function setState(s, n) {
    state = s;
    if (n !== undefined) note = n;
    document.documentElement.classList.toggle('cw-stories-on', s === 'ok');
    drawPanel();
    try { if (window.GnwSources) window.GnwSources.render(); } catch (_) {}
    if (windowOpen()) drawWindow();
  }

  /* ------------------------------------------------------------ the swap (insider-auth) */
  async function callFn(body) {
    let r;
    try {
      r = await fetch(AUTH_FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
    } catch (_) { throw failure('unreachable'); }
    let j = null;
    try { j = await r.json(); } catch (_) {}
    if (!r.ok || !j) throw failure('unreachable');
    return j;
  }
  function store(reply, had) {
    const now = Date.now();
    const a = {
      access: reply.access_token,
      exp: reply.expires_in ? now + reply.expires_in * 1000 : 0,
      refresh: reply.refresh_token || '',
      refreshExp: reply.refresh_token_expires_in ? now + reply.refresh_token_expires_in * 1000 : 0,
      had: !!had,
    };
    save(a);
    return a;
  }
  const fresh = a => !a.exp || a.exp - SOON_MS > Date.now();

  /* A refresh token works once, so two tabs must not both spend it: a lock where the browser has one,
     and a look at storage afterwards where it has not. */
  const withLock = fn => (navigator.locks && navigator.locks.request ? navigator.locks.request('cw-stories-refresh', fn) : fn());
  let refreshing = null;
  function refresh(seen) {
    if (refreshing) return refreshing;
    refreshing = withLock(async () => {
      const a = load();
      if (!a) throw failure('out');
      if (a.access !== seen && fresh(a)) return a.access;   // another tab has done it
      if (!a.refresh || (a.refreshExp && a.refreshExp <= Date.now())) { forget(); throw failure('expired'); }
      const reply = await callFn({ grant: 'refresh', refresh_token: a.refresh });
      if (!reply.access_token) {
        const b = load();
        if (b && b.refresh !== a.refresh && fresh(b)) return b.access;
        forget();
        throw failure('expired');
      }
      return store(reply, a.had).access;
    }).finally(() => { refreshing = null; });
    return refreshing;
  }
  async function currentKey() {
    const a = load();
    if (!a) throw failure('out');
    return fresh(a) ? a.access : refresh(a.access);
  }

  /* ------------------------------------------------------------ reading from GitHub */
  function pathUrl(path) { return API + path.split('/').map(encodeURIComponent).join('/'); }
  function get(path, key, signal) {
    /* Authorization and this media type are allowed from any origin. no-cache: asks GitHub each time
       (an unchanged file costs nothing), so access that has gone is noticed at once. */
    return fetch(pathUrl(path), {
      headers: { Accept: 'application/vnd.github.raw+json', Authorization: 'Bearer ' + key },
      credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-cache', signal,
    });
  }
  async function read(path, signal) {
    let key = await currentKey(), r;
    try {
      r = await get(path, key, signal);
      if (r.status === 401) { key = await refresh(key); r = await get(path, key, signal); }
    } catch (e) {
      if (e && (e.kind || e.name === 'AbortError')) throw e;
      throw failure('unreachable');
    }
    if (r.ok) return r;
    if (r.status === 401) { forget(); throw failure('expired'); }
    if ((r.status === 403 || r.status === 429) && (r.headers.get('x-ratelimit-remaining') === '0' || r.headers.get('retry-after'))) throw failure('busy');
    if (r.status === 403 || r.status === 404 || r.status === 451) throw failure('noaccess');
    throw failure('unreachable');
  }
  async function readJSON(path, signal) {
    const r = await read(path, signal);
    try { return JSON.parse(await r.text()); } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      throw failure('badfile');
    }
  }
  function goodList(j) {
    const all = j && Array.isArray(j.stories) ? j.stories : [];
    return all.filter(s => s && typeof s.slug === 'string' && SLUG.test(s.slug) && typeof s.title === 'string' && s.title);
  }
  function noAccessKind() { const a = load(); return a && a.had ? 'ended' : 'noaccess'; }

  /* Is the reader in, and is there anything to read? Sets the state. */
  let checkNo = 0;
  async function check() {
    if (!load()) { setState('out'); return state; }
    const mine = ++checkNo;
    try {
      const j = await readJSON(LIST);
      if (mine !== checkNo) return state;
      list = goodList(j);
      lead = j && typeof j.lead === 'string' ? j.lead : '';
      if (!list.length) { setState('empty'); return state; }
      const a = load();
      if (a && !a.had) { a.had = true; save(a); }
      setState('ok', '');
    } catch (e) {
      if (mine !== checkNo) return state;
      list = null;
      applyFailure(e);
    }
    return state;
  }
  function applyFailure(e) {
    const k = e && e.kind;
    if (k === 'noaccess') setState(noAccessKind());
    else if (k === 'expired') setState('expired');
    else if (k === 'out') setState('out');
    else if (k === 'busy') setState('busy');
    else if (k === 'badfile') setState('empty');
    else setState('unreachable');
  }

  /* ------------------------------------------------------------ sign in */
  const b64url = bytes => btoa(String.fromCharCode.apply(null, new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const random = n => b64url(crypto.getRandomValues(new Uint8Array(n)));

  async function signIn() {
    if (!(await signInHere())) { setState(state,'Sign-in works on crystalworlds.media, not on a copy of the site.'); return; }
    setState(state, 'Going to GitHub…');
    try {
      const cfg = await callFn({ grant: 'config' });
      if (!cfg.client_id) throw failure('unreachable');
      const verifier = random(32), st = 'cwst-' + random(16);
      const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
      if (!flowSet({ state: st, verifier })) { setState(state, 'This browser is blocking storage, so sign-in cannot finish here.'); return; }
      const q = new URLSearchParams({
        client_id: cfg.client_id, redirect_uri: location.origin + '/', state: st,
        code_challenge: challenge, code_challenge_method: 'S256', scope: 'offline_access',
      });
      location.assign(AUTHORIZE + '?' + q.toString());
    } catch (_) {
      setState(state, 'The sign-in service could not be reached. Please try again in a moment.');
    }
  }

  /* Back from GitHub. index.html's head script has already taken the code out of the address. */
  async function finishSignIn(ret) {
    const flow = flowGet();
    flowDrop();
    let ok = false;
    if (!flow || !flow.state || flow.state !== ret.state) {
      setState(load() ? state : 'out', 'That sign-in could not be confirmed, so nothing was saved. Please try again.');
    } else if (ret.error || !ret.code) {
      setState(load() ? state : 'out', 'Sign-in was cancelled at GitHub. Nothing was saved.');
    } else {
      try {
        const reply = await callFn({ grant: 'code', code: ret.code, code_verifier: flow.verifier, redirect_uri: location.origin + '/' });
        if (!reply.access_token) throw failure('refused');
        const before = load();
        store(reply, before && before.had);
        note = '';
        ok = true;
      } catch (e) {
        setState(load() ? state : 'out', e && e.kind === 'unreachable'
          ? 'The sign-in service could not be reached. Please try again in a moment.'
          : 'GitHub did not accept that sign-in. Please try again.');
      }
    }
    if (ok) await check();
    afterReturn();
  }
  /* The visitor has just come back: show them where they stand, once the page can. */
  function afterReturn(tries) {
    const n = tries || 0;
    const W = window.CwAboutWindow, S = window.GnwSources;
    const canWindow = !!(W && document.getElementById('video-stories-btn'));
    const canPanel = !!(S && typeof window.openVaultModal === 'function' && typeof window.switchSettingsTab === 'function');
    if (state === 'ok' ? !canWindow : !canPanel) { if (n < 100) setTimeout(() => afterReturn(n + 1), 200); return; }
    if (state === 'ok') { W.open('stories'); return; }
    openPanel();
  }
  function openPanel() {
    try { window.openVaultModal(); window.switchSettingsTab('content'); window.GnwSources.open('stories'); } catch (_) {}
  }
  function signOut() {
    checkNo++;
    forget();
    flowDrop();
    list = null;
    leaveStory();
    const W = window.CwAboutWindow;
    if (W && W.isOpen() && W.kind() === 'stories') W.close();
    setState('out', 'Signed out. Your sign-in has been removed from this browser.');
  }

  /* ------------------------------------------------------------ small DOM helpers */
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function link(text, href) {
    const a = el('a', '', text);
    a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
    return a;
  }
  /* A sentence with links in it: parts are strings, or [text, address]. */
  function para(cls, parts) {
    const p = el('p', cls);
    parts.forEach(x => p.appendChild(Array.isArray(x) ? link(x[0], x[1]) : document.createTextNode(x)));
    return p;
  }

  const SPONSOR_LINE = ['Stories are for ', ['16-Bit sponsors', SPONSOR_URL], '.'];
  const NOACCESS_LINE = ['This GitHub account cannot read the Stories yet. They are for ', ['16-Bit sponsors', SPONSOR_URL],
    '. If you already sponsor at that tier, accept your invitation at ', [INVITE_URL.replace('https://', ''), INVITE_URL], ', then check again.'];
  const ENDED_LINE = ['Your access to the Stories has ended, so the Stories button has gone. That happens when a ', ['16-Bit sponsorship', SPONSOR_URL], ' stops. Sponsor again and your access comes back.'];
  const EMPTY_LINE = ['There are no stories to read yet.'];
  const UNREACHABLE_LINE = ['GitHub could not be reached just now, so the Stories button is hidden. Your sign-in is still here.'];
  const BUSY_LINE = ['GitHub is asking for a pause in reading. Please try again in a little while.'];
  const EXPIRED_LINE = ['Your sign-in has run out. Sign in with GitHub again to carry on reading.'];
  const LINE = { noaccess: NOACCESS_LINE, ended: ENDED_LINE, empty: EMPTY_LINE, unreachable: UNREACHABLE_LINE, busy: BUSY_LINE, expired: EXPIRED_LINE };

  /* ------------------------------------------------------------ the Settings panel */
  function panelBody() { return document.querySelector('#src-sheet .src-body[data-for="stories"]'); }
  function drawPanel() {
    const body = panelBody();
    if (!body) return;
    const had = body.contains(document.activeElement);
    body.textContent = '';
    if (note) { const n = el('p', 'src-note st-note', note); n.setAttribute('role', 'status'); body.appendChild(n); }
    if (state === 'ok') {
      body.appendChild(el('p', 'src-note', 'Signed in. Press Stories in the search bar to read and listen.'));
    } else if (state === 'checking') {
      body.appendChild(el('p', 'src-note', 'Checking with GitHub…'));
    } else if (LINE[state]) {
      body.appendChild(para('src-note', LINE[state]));
    } else {
      body.appendChild(para('src-note', SPONSOR_LINE));
    }
    if (state === 'out' || state === 'expired') {
      body.appendChild(el('p', 'src-note', 'Sign-in is optional, and nothing else on this site needs it. It stays in this browser and can read only the Stories. Until you sign in, this site does not contact GitHub for them.'));
    }
    if (load()) {
      const row = el('div', 'st-panel-row');
      const again = el('button', 'btn-tiny', 'Check again');
      again.type = 'button'; again.dataset.stAct = 'check';
      const out = el('button', 'btn-tiny', 'Sign out');
      out.type = 'button'; out.dataset.stAct = 'signout';
      if (state !== 'ok') row.appendChild(again);
      row.appendChild(out);
      body.appendChild(row);
    }
    if (had) { const f = body.querySelector('button, a'); if (f) { try { f.focus({ preventScroll: true }); } catch (_) {} } }
  }
  document.addEventListener('click', e => {
    const b = e.target && e.target.closest && e.target.closest('[data-st-act]');
    if (!b) return;
    const act = b.dataset.stAct;
    if (act === 'check') { note = ''; setState('checking'); check(); }
    else if (act === 'signout') signOut();
    else if (act === 'settings') { const W = window.CwAboutWindow; if (W) W.close(); openPanel(); }
    else if (act === 'list') { showList(true); giveEntryBack(); }
    else if (act === 'retry-sound' && reading) getSound(reading);
  });

  /* ------------------------------------------------------------ the window */
  let winEl = null;     // #video-about
  let reading = null;   // { slug, key, ctrl, urls: [] } while a story is showing
  let lastSlug = '';
  const root = () => (winEl ? winEl.querySelector('#cw-stories-page') : null);
  function windowOpen() {
    const W = window.CwAboutWindow;
    return !!(W && W.isOpen() && W.kind() === 'stories' && root());
  }

  function leaveStory() {
    const r = reading;
    if (!r) return;
    reading = null;
    try { r.ctrl.abort(); } catch (_) {}
    try {
      const c = window.pageAudio && window.pageAudio.current();
      if (c && c.key === r.key && c.audio) c.audio.pause();
    } catch (_) {}
    try { if (window.PAGE_AUDIO_TIMINGS) delete window.PAGE_AUDIO_TIMINGS[r.key]; } catch (_) {}
    r.urls.forEach(u => { try { URL.revokeObjectURL(u); } catch (_) {} });
  }

  function page(view) {
    const p = el('div', 'story-page');
    p.dataset.view = view;
    return p;
  }
  function drawWindow() {
    const box = root();
    if (!box) return;
    if (state === 'ok') {
      if (!reading) drawList(box);
      return;
    }
    leaveStory();
    giveEntryBack();
    const p = page('message');
    p.appendChild(el('h1', '', 'Stories'));
    if (state === 'checking') p.appendChild(el('p', 'st-lead', 'Checking with GitHub…'));
    else if (LINE[state]) p.appendChild(para('st-lead', LINE[state]));
    else p.appendChild(para('st-lead', SPONSOR_LINE));
    if (state !== 'checking') {
      const b = el('button', 'st-btn', load() && state !== 'expired' ? 'Open Stories settings' : 'Sign in from Settings');
      b.type = 'button'; b.dataset.stAct = 'settings';
      p.appendChild(b);
    }
    box.replaceChildren(p);
  }
  function drawList(box, focus) {
    /* The access check answers after the list is drawn: unchanged, the list stays, and with it the
       focus of whoever has already moved onto a story with a remote or a pad. */
    const sig = JSON.stringify([lead, list]);
    if (!focus && box.dataset.sig === sig && box.querySelector('.story-page[data-view="list"]')) return;
    box.dataset.sig = sig;
    const had = box.contains(document.activeElement) && document.activeElement.dataset ? document.activeElement.dataset.stStory : '';
    const p = page('list');
    p.appendChild(el('h1', '', 'Stories'));
    if (lead) p.appendChild(el('p', 'st-lead', lead));
    const ul = el('ul', 'st-list');
    (list || []).forEach(s => {
      const li = el('li');
      const b = el('button', 'st-card');
      b.type = 'button';
      b.dataset.stStory = s.slug;
      b.appendChild(el('span', 'st-card-t', s.title));
      if (typeof s.sub === 'string' && s.sub) b.appendChild(el('span', 'st-card-s', s.sub));
      const mins = Number(s.mins) > 0 ? Math.round(Number(s.mins)) : 1;
      b.appendChild(el('span', 'st-card-m', mins + ' minute read' + (s.hasAudio ? ' or listen' : '')));
      li.appendChild(b);
      ul.appendChild(li);
    });
    p.appendChild(ul);
    box.replaceChildren(p);
    if (focus || had) {
      const t = ((had || lastSlug) && p.querySelector('[data-st-story="' + (had || lastSlug) + '"]')) || p.querySelector('.st-card');
      if (t) { try { t.focus({ preventScroll: true }); } catch (_) {} }
    }
  }
  function showList(focus) {
    leaveStory();
    const box = root();
    if (!box) return;
    drawList(box, focus);
    if (winEl) winEl.scrollTop = 0;
    check();
  }

  /* THE PHONE'S BACK ON A STORY (7 Nov 2026): the list, not closing the window. A story takes one history
     entry of its own on the window's address (marked cwStory), so Back lands on the window's entry and the
     list is drawn. Leaving by the page's own route (All stories, Escape, the pad's B) gives the entry back;
     closing the window with a story open steps past both (deeplinks.js windowChanged). */
  const storyEntry = () => { try { return (history.state && history.state.cwStory) || ''; } catch (_) { return ''; } };
  function takeEntry(slug) {
    try {
      if (storyEntry() === slug) return;
      if (storyEntry()) history.replaceState(Object.assign({}, history.state, { cwStory: slug }), '');
      else history.pushState(Object.assign({}, history.state, { cwStory: slug }), '');
    } catch (_) {}
  }
  function giveEntryBack() {
    if (!storyEntry()) return;
    try { if (window.CwDeepLink && window.CwDeepLink.stepBack) window.CwDeepLink.stepBack(); else history.back(); } catch (_) {}
  }
  window.addEventListener('popstate', () => {
    const want = storyEntry();
    if (reading && want !== reading.slug) { if (windowOpen()) showList(true); return; }   // closed on a story: it stays until the window opens again
    if (!reading && want && windowOpen() && state === 'ok') openStory(want);   // Forward onto a story
  });

  document.addEventListener('click', e => {
    const b = e.target && e.target.closest && e.target.closest('#cw-stories-page [data-st-story]');
    if (b) openStory(b.dataset.stStory);
  });

  function backButton(cls, text) {
    const b = el('button', cls, text);
    b.type = 'button'; b.dataset.stAct = 'list';
    return b;
  }

  async function openStory(slug) {
    const entry = (list || []).find(s => s.slug === slug);
    const box = root();
    if (!entry || !box) return;
    leaveStory();
    lastSlug = slug;
    const r = { slug, entry, key: 'story-' + slug, ctrl: new AbortController(), urls: [], host: null };
    reading = r;
    takeEntry(slug);

    const p = page('story');
    const back = backButton('st-back', 'All stories');
    p.appendChild(back);
    const art = el('article', 'st-story');
    art.appendChild(el('p', 'st-lead', 'Opening…'));
    p.appendChild(art);
    box.replaceChildren(p);
    if (winEl) winEl.scrollTop = 0;
    try { back.focus({ preventScroll: true }); } catch (_) {}

    const dir = 'stories/' + slug + '/';
    let story;
    try {
      story = await readJSON(dir + 'story.json', r.ctrl.signal);
    } catch (e) { return storyFailed(r, e); }
    if (reading !== r) return;
    drawStory(r, art, story);
    getPictures(r, art, dir);
    if (entry.hasAudio) getSound(r);
  }
  async function storyFailed(r, e) {
    if (reading !== r || (e && e.name === 'AbortError')) return;
    /* One missing file is not lost access: the list decides. */
    if (e && (e.kind === 'noaccess' || e.kind === 'badfile')) {
      await check();
      if (reading !== r) return;
      if (state === 'ok') {
        const art = root() && root().querySelector('.st-story');
        if (art) art.replaceChildren(el('p', 'st-lead', 'This story could not be read. Please go back and try again.'));
        return;
      }
      return;   // setState has drawn the message
    }
    applyFailure(e);
    if (reading === r && state === 'ok') {
      const art = root() && root().querySelector('.st-story');
      if (art) art.replaceChildren(el('p', 'st-lead', 'This story could not be read. Please go back and try again.'));
    }
  }

  /* The words, in the order the recording reads them: page-audio.js compares them with the timings. */
  function drawStory(r, art, story) {
    const n = r.key, frag = document.createDocumentFragment();
    const text = v => (typeof v === 'string' ? v : '');
    const h1 = el('h1', '', text(story.title));
    h1.dataset.narrate = n;
    frag.appendChild(h1);
    const sub = el('p', 'st-sub', text(story.sub));
    sub.dataset.narrateHost = n;
    frag.appendChild(sub);
    r.host = sub;
    (Array.isArray(story.body) ? story.body : []).forEach(b => {
      if (!b) return;
      if (b.k === 'h') { const h = el('h2', '', text(b.t)); h.dataset.narrate = n; frag.appendChild(h); }
      else if (b.k === 'q') { const q = el('blockquote'), x = el('p', '', text(b.t)); x.dataset.narrate = n; q.appendChild(x); frag.appendChild(q); }
      else if (b.k === 'p') { const x = el('p', '', text(b.t)); x.dataset.narrate = n; frag.appendChild(x); }
      else if (b.k === 'i' && typeof b.src === 'string' && PICTURE.test(b.src)) {
        const f = el('figure', 'st-fig');
        f.dataset.src = b.src;
        f.dataset.cap = text(b.cap);
        frag.appendChild(f);
      }
    });
    frag.appendChild(backButton('st-back st-back-end', 'Back to all stories'));
    art.replaceChildren(frag);
  }
  async function getPictures(r, art, dir) {
    for (const f of Array.from(art.querySelectorAll('.st-fig'))) {
      if (reading !== r) return;
      try {
        const res = await read(dir + f.dataset.src, r.ctrl.signal);
        const ext = f.dataset.src.split('.').pop().toLowerCase();
        const blob = new Blob([await res.arrayBuffer()], { type: PICTURE_TYPE[ext] });
        if (reading !== r) return;
        const u = URL.createObjectURL(blob);
        r.urls.push(u);
        const img = el('img');
        img.alt = f.dataset.cap;
        img.src = u;
        f.appendChild(img);
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        if (e && (e.kind === 'expired' || e.kind === 'out')) return applyFailure(e);
        f.remove();   // a picture that will not come: the words carry on
      }
    }
  }

  /* The audio element cannot send a key, so the sound comes down whole, then plays from a blob. It is
     fetched here and not at Listen: a phone refuses to start sound that long after the press. */
  async function getSound(r) {
    const old = r.host && r.host.parentNode ? r.host.parentNode.querySelector('.st-sound') : null;
    if (old) old.remove();
    const tab = el('div', 'st-sound');
    tab.setAttribute('role', 'status');
    const label = el('span', 'st-sound-t', 'Getting the sound');
    const pct = el('b', 'st-sound-p', '0%');
    tab.append(label, pct);
    r.host.insertAdjacentElement('afterend', tab);
    const dir = 'stories/' + r.slug + '/';
    try {
      const t = await readJSON(dir + 'timings.json', r.ctrl.signal);
      const res = await read(dir + 'audio.mp3', r.ctrl.signal);
      const total = Number(r.entry.audioBytes) || Number(res.headers.get('content-length')) || 0;
      let got = 0;
      const parts = [];
      if (res.body && res.body.getReader) {
        const rd = res.body.getReader();
        for (;;) {
          const { done, value } = await rd.read();
          if (done) break;
          parts.push(value);
          got += value.length;
          if (total && reading === r) pct.textContent = Math.min(99, Math.floor(got * 100 / total)) + '%';
        }
      } else parts.push(await res.arrayBuffer());
      if (reading !== r) return;
      const u = URL.createObjectURL(new Blob(parts, { type: 'audio/mpeg' }));
      r.urls.push(u);
      window.PAGE_AUDIO_TIMINGS = window.PAGE_AUDIO_TIMINGS || {};
      window.PAGE_AUDIO_TIMINGS[r.key] = { audio: u, words: t.words, t: t.t };
      tab.remove();
      if (window.pageAudio && window.pageAudio.attach) window.pageAudio.attach(root(), winEl);
    } catch (e) {
      if (reading !== r || (e && e.name === 'AbortError')) return;
      if (e && (e.kind === 'expired' || e.kind === 'out')) return applyFailure(e);
      tab.replaceChildren(el('span', 'st-sound-t st-sound-bad', 'The sound did not load.'));
      const again = el('button', 'st-btn st-sound-retry', 'Try again');
      again.type = 'button'; again.dataset.stAct = 'retry-sound';
      tab.appendChild(again);
    }
  }

  /* Back, Escape, a remote's Back or the pad's B while reading go to the list first. This listens on
     window so it hears them before emby.js closes the window. */
  window.addEventListener('keydown', e => {
    if (!reading || !windowOpen() || e.defaultPrevented) return;
    const K = window.GnwKeys;
    const back = K && typeof K.isBack === 'function' ? K.isBack(e) : e.key === 'Escape';
    if (!back) return;
    if (document.querySelector('.overlay.open, #vault-overlay.open, #video-player-overlay.open')) return;
    if (e.target && e.target.closest && e.target.closest('#cw-notify-host, .toast-host, input, textarea')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!e.repeat) { showList(true); giveEntryBack(); }
  }, true);

  /* emby.js aboutSet calls this each time the window opens on Stories. */
  function mount(w) {
    winEl = w;
    const box = root();
    if (!box) return;
    if (!box.firstChild || !reading) drawWindow();
    if (reading) takeEntry(reading.slug);   // closed on a story and opened again: Back still goes to the list
    if (load()) check(); else if (state !== 'out') setState('out');
  }

  /* ------------------------------------------------------------ start */
  function tileState() {
    return Object.assign({}, TILE[state] || TILE.out);
  }
  window.CwStories = { tileState, signIn, signOut, drawPanel, mount, state: () => state };

  const link_ = document.createElement('link');
  link_.rel = 'stylesheet';
  link_.href = CSS;
  document.head.appendChild(link_);

  const ret = window.__cwStoriesReturn;
  window.__cwStoriesReturn = null;
  if (ret) { state = load() ? 'checking' : 'out'; finishSignIn(ret); }
  else if (load()) { state = 'checking'; check(); }
  drawPanel();
  try { if (window.GnwSources) window.GnwSources.render(); } catch (_) {}
})();

/*
 * changelog.js -- the Change Log page (21 Nov 2026).
 *
 * WHAT. Every release of the site and its emulators, newest first, and the game server's releases as a
 * stream of their own. Each release: a version badge and date in a header that stays at the top while
 * the release is read and is pushed up by the next one, a one-sentence statement, then its changes in
 * three sections (New, Improvements, Fixes), each change with the consoles it touches. Tables and
 * pictures sit where a release's highlights place them. Search covers every release; filters narrow by
 * kind of change, console and stream; every release and every change has its own link
 * (/changelog#2.2.2, /changelog#2.2.2-fix-3).
 *
 * WHERE. In the Media page's window under the search bar, like Compatibility (emby.js aboutSet, kind
 * 'changelog'): emby.js asks CwChangelog.html() for the window's markup and calls CwChangelog.mount(win)
 * once it is in the page. The Info menu opens it, directly under Compatibility.
 *
 * DATA. firmware/changelog/, written by WASM_Source/changelog/build.mjs from CHANGELOG.md and
 * highlights.json. index.json is small and comes first (every release's version, date, statement,
 * counts and consoles); each release's own file is asked for as its place nears the screen
 * (IntersectionObserver), by its hash, so an unchanged release comes from the cache. search.json is
 * read on the first search. This file holds the one layout; the releases are data.
 *
 * IDEAS TAKEN (ideas only, the look is the site's own): Linear's changelog (the version header that
 * stays while its release is read and is pushed up by the next), Stripe's and Supabase's grouped
 * sections, Vercel's and Raycast's version list beside the releases, Notion's one-line summary at the top.
 *
 * KEYS. The arrows, the pad and a TV remote move through the controls and the changes (nav.js); Enter or
 * OK on the search box starts typing, Enter or Escape stops. A narrow screen and a TV have a Jump to
 * a release list in place of the version list at the side. No hover anywhere. Silent.
 *
 * THE VERSION BEING BUILT (22 Nov 2026): CHANGELOG.md's "## [2.3.0] - Unreleased" is the top release here for everyone,
 * shown with no date until push day fills the date in.
 * ?changelogpreview=1 also shows a bare "## [Unreleased]" section if CHANGELOG.md has one (docs/TEST-PARAMETERS.md).
 */
(function () {
  'use strict';
  if (window.CwChangelog) return;

  const BASE = 'firmware/changelog/';
  const INDEX_URL = 'firmware/changelog/index.json?v=2.3.0-changelog3';
  const IMG_V = '20261007';   // the Systems menu's console pictures (emby.js VG_IMG_V): the same cached files
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const KIND_ONE = { new: 'New', improvements: 'Improvement', fixes: 'Fix', limits: 'Known limit' };
  const KIND_MANY = { new: 'new', improvements: 'improvements', fixes: 'fixes', limits: 'known limits' };
  const ID_WORD = { new: 'new', improvements: 'improvement', fixes: 'fix', limits: 'limit' };

  const PREVIEW = (() => {
    try {
      if (new URLSearchParams(location.search).get('changelogpreview') === '1') { sessionStorage.setItem('cw.test.changelogpreview', '1'); return true; }
      return sessionStorage.getItem('cw.test.changelogpreview') === '1';
    } catch (_) { return false; }
  })();
  /* The address this tab arrived on: /changelog#2.2.2-fix-3 (or #/changelog#2.2.2-fix-3 without real
     paths). Read now, before the window's own address takes its place. */
  let firstAnchor = (() => {
    try {
      const h = location.hash || '';
      if (/^#\/changelog#/i.test(h)) return decodeURIComponent(h.slice(h.indexOf('#', 1) + 1));
      if (/^\/changelog\/?$/i.test(location.pathname) && /^#[^/]/.test(h)) return decodeURIComponent(h.slice(1));
    } catch (_) {}
    return '';
  })();

  const S = { kind: '', con: '', stream: '', q: '' };   // the filters ('' = all)
  let index = null, indexP = null, searchRows = null, searchP = null;
  const rels = new Map();       // anchor -> release data, once loaded
  const relP = new Map();       // anchor -> its fetch
  let root = null, scroller = null, io = null, spyRaf = 0, lastTarget = null;

  /* ------------------------------------------------------------------ helpers */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /* The entries' own few marks: **bold**, `code`, [words](address). Everything else is text. */
  function inline(s) {
    return esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]*)\)/g, '<a href="$2" rel="noopener">$1</a>');
  }
  const num = n => Number(n).toLocaleString('en-AU');
  function longDate(d) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : ''; }
  const conOf = k => (index && index.consoles.find(c => c[0] === k)) || null;
  const conLabel = k => { const c = conOf(k); return c ? c[1] : k; };
  const conImg = k => { const c = conOf(k); return c ? 'images/consoles/' + c[2] + '.webp?v=' + IMG_V : ''; };
  const linkHref = a => (window.cwRouteHref ? window.cwRouteHref('/changelog') : '#/changelog') + '#' + a;
  const releaseOf = id => { const m = /^(.*)-(new|improvement|fix|limit)-\d+$/.exec(id || ''); return m ? m[1] : id; };
  /* Per character, so a place in it is the same place in the words: Pokemon finds Pokémon. */
  const fold = s => Array.from(String(s), ch => (ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() || ' ')[0]).join('');
  const listed = () => (index ? index.releases.concat(PREVIEW && index.preview ? [Object.assign({ preview: true }, index.preview)] : []) : []);
  const ordered = () => { const l = listed(); const p = l.filter(r => r.preview); return p.concat(l.filter(r => !r.preview)); };

  function loadIndex() {
    if (index) return Promise.resolve(index);
    if (!indexP) indexP = fetch(INDEX_URL, { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).then(j => { index = j && j.releases ? j : null; if (!index) indexP = null; return index; }).catch(() => { indexP = null; return null; });
    return indexP;
  }
  function loadRelease(anchor) {
    if (rels.has(anchor)) return Promise.resolve(rels.get(anchor));
    if (relP.has(anchor)) return relP.get(anchor);
    const row = listed().find(r => r.anchor === anchor);
    if (!row) return Promise.resolve(null);
    /* At most 15 s: a server that stalls leaves this release waiting (the scroll asks again) and the rest go on. */
    const ac = window.AbortController ? new AbortController() : null, tm = ac ? setTimeout(() => ac.abort(), 15000) : 0;
    const p = fetch(BASE + row.file + '?h=' + row.h, ac ? { signal: ac.signal } : undefined).then(r => (r.ok ? r.json() : null))
      .then(j => { clearTimeout(tm); relP.delete(anchor); if (j) rels.set(anchor, j); return j; })
      .catch(() => { clearTimeout(tm); relP.delete(anchor); return null; });
    relP.set(anchor, p);
    return p;
  }
  function loadSearch() {
    if (searchRows) return Promise.resolve(searchRows);
    if (!searchP && index && index.search) {
      searchP = fetch(BASE + index.search.file + '?h=' + index.search.h).then(r => (r.ok ? r.json() : null)).then(j => {
        searchRows = j && j.rows ? j.rows.map(r => ({ id: r[0], rel: r[1], k: r[2], c: r[3] ? r[3].split(' ') : [], title: r[4], text: r[5], ft: fold(r[4]), fx: fold(r[5]) })) : null;
        searchP = null; return searchRows;
      }).catch(() => { searchP = null; return null; });
    }
    return searchP || Promise.resolve(null);
  }

  /* ------------------------------------------------------------------ markup */
  const CARET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
  /* The change's button copies its link (22 Nov 2026: a copy icon, two sheets, and the name says what it copies). */
  const COPY_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="12" rx="2"/><path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2"/></svg>';
  function html() {
    /* .chl-back: the frame's colours on a layer of their own, pinned behind it (changelog.css). */
    return '<div class="gw-frame-outer about-pop chl-pop"><div class="chl-back" aria-hidden="true"></div><div class="gw-frame-bezel"><div class="gw-screen-wrap"><div class="gw-frame-screen">'
      + '<div class="section chl-root" data-chl-root>'
      + '<div class="section-head"><div><div class="section-kicker">Change Log</div><h2 class="section-title">What changed, release by release</h2></div></div>'
      + '<div class="loading-card chl-loading" data-chl-loading role="status"><div class="loading-spinner" aria-hidden="true"></div><div class="loading-title">CHANGE LOG</div>'
      + '<div class="loading-sub">Loading the releases…</div><div class="loading-stat" data-chl-load-stat>Connecting…</div></div>'
      + '<p class="chl-lede">Every release of the site and its emulators, newest first. Each change is marked New, Improvement or Fix, with the consoles it touches.</p>'
      + '<div class="chl-tools" data-chl-tools>'
      + '<div class="chl-toprow"><div class="chl-search"><span aria-hidden="true">⌕</span><input type="text" data-chl-q placeholder="Search every release" autocomplete="off" readonly inputmode="none" enterkeyhint="search" aria-label="Search every release"></div>'
      + '<div class="chl-pickwrap"><button type="button" class="chl-pick" data-chl-pick aria-expanded="false" aria-controls="chl-picklist"><span>Jump to a release</span>' + CARET + '</button>'
      + '<div class="chl-picklist" id="chl-picklist" role="group" aria-label="Releases" data-chl-picklist hidden></div></div></div>'
      + '<div class="chl-chips" role="group" aria-label="Kind of change" data-chl-kinds></div>'
      + '<div class="chl-chips chl-cons" role="group" aria-label="Console" data-chl-cons></div>'
      + '<div class="chl-chips" role="group" aria-label="Releases of" data-chl-streams></div>'
      + '</div>'
      + '<p class="chl-shown" data-chl-shown aria-live="polite"></p>'
      + '<div class="chl-body"><nav class="chl-rail" aria-label="Releases" data-chl-rail></nav>'
      + '<div class="chl-main"><div class="chl-results" data-chl-results hidden></div><div class="chl-list" data-chl-list></div>'
      + '<p class="chl-empty" data-chl-empty hidden></p></div></div>'
      + '</div></div></div></div></div>';
  }
  function chip(attr, val, on, label, extra) {
    return `<button type="button" class="chl-chip${on ? ' on' : ''}" ${attr}="${esc(val)}" aria-pressed="${on}">${extra || ''}<span>${esc(label)}</span></button>`;
  }
  function chipsPaint() {
    if (!root || !index) return;
    const r = root;
    const used = new Set(); listed().forEach(x => x.consoles.forEach(c => used.add(c)));
    r.querySelector('[data-chl-kinds]').innerHTML = chip('data-chl-kind', '', !S.kind, 'All changes')
      + ['new', 'improvements', 'fixes'].map(k => chip('data-chl-kind', k, S.kind === k, k === 'new' ? 'New' : k === 'fixes' ? 'Fixes' : 'Improvements', `<i class="chl-dot chl-k-${k}" aria-hidden="true"></i>`)).join('');
    r.querySelector('[data-chl-cons]').innerHTML = chip('data-chl-con', '', !S.con, 'All consoles')
      + index.consoles.filter(c => used.has(c[0])).map(c => chip('data-chl-con', c[0], S.con === c[0], c[1], `<img src="${conImg(c[0])}" alt="" width="22" height="22" loading="lazy" decoding="async">`)).join('');
    r.querySelector('[data-chl-streams]').innerHTML = chip('data-chl-stream', '', !S.stream, 'Everything')
      + index.streams.map(s => chip('data-chl-stream', s.key, S.stream === s.key, s.label)).join('');
  }
  function countsText(c) {
    return ['new', 'improvements', 'fixes', 'limits'].filter(k => c[k]).map(k => `${c[k]} ${c[k] === 1 ? KIND_ONE[k].toLowerCase() : KIND_MANY[k]}`).join(', ');
  }
  function estimate(row) { const n = Object.values(row.counts || {}).reduce((a, b) => a + b, 0); return Math.round(60 + n * 64 + Object.keys(row.counts || {}).length * 56); }
  function relShellHTML(row) {
    const a = esc(row.anchor), stream = row.stream === 'server' ? '<span class="chl-stream">Game server</span>' : '';
    /* The release being built (22 Nov 2026): shown from its first line with no date until push day fills it in. */
    const pre = row.preview ? '<span class="chl-stream chl-pre">Not released</span>' : '';
    return `<section class="chl-rel" id="chl-r-${a}" data-anchor="${a}" data-stream="${esc(row.stream)}" aria-labelledby="chl-h-${a}">`
      + `<div class="chl-rel-head"><a class="chl-badge" id="chl-h-${a}" href="${esc(linkHref(row.anchor))}" data-chl-self="${a}" aria-label="Release ${esc(row.v)}${row.date ? ', ' + esc(longDate(row.date)) : ''}">${esc(row.v)}</a>`
      + (row.date ? `<time datetime="${esc(row.date)}">${esc(longDate(row.date))}</time>` : '') + stream + pre
      + `<span class="chl-counts">${esc(countsText(row.counts || {}))}</span></div>`
      + '<div class="chl-rel-body">'
      + (row.statement ? `<p class="chl-statement">${inline(row.statement)}</p>` : '')
      + `<div class="chl-rel-content" data-chl-content="${a}" data-state="wait" style="min-height:${estimate(row)}px"></div>`
      + '</div></section>';
  }
  /* A change's own picture (highlights.json icons, 22 Nov 2026: the Super Mario 64 box for the 3D boxes) stands in place
     of the console pictures; sharp on a high-density screen from its 2x file. Its h sets the height it is shown at (23 Nov
     2026: the box icon 39 px, half again the console pictures' 26; changelog.css --chl-ih, scaled down on a phone). */
  function iconsHTML(c, icon) {
    if (icon) return `<span class="chl-icons chl-icon-own" aria-hidden="true"><img src="${esc(icon.src)}"${icon.src2x ? ` srcset="${esc(icon.src)} 1x, ${esc(icon.src2x)} 2x"` : ''} alt="" width="${+icon.w || 26}" height="${+icon.h || 26}" style="--chl-ih:${+icon.h || 26}px" loading="lazy" decoding="async" title="${esc(icon.alt || '')}"></span>`;
    if (!c || !c.length) return '<span class="chl-icons" aria-hidden="true"></span>';
    const shown = c.slice(0, 2).map(k => `<img src="${conImg(k)}" alt="" width="26" height="26" loading="lazy" decoding="async" title="${esc(conLabel(k))}">`).join('');
    return `<span class="chl-icons" aria-hidden="true">${shown}${c.length > 2 ? `<b>+${c.length - 2}</b>` : ''}</span>`;
  }
  function pct(n, of) { return of ? Math.max(0, Math.min(100, (n / of) * 100)) : 0; }
  function blockHTML(b) {
    const cap = b.title ? `<figcaption>${inline(b.title)}</figcaption>` : '';
    const note = b.note ? `<p class="chl-fig-note">${inline(b.note)}</p>` : '';
    if (b.kind === 'share') {
      return `<figure class="chl-fig chl-share">${cap}<table><tbody>` + b.rows.map(r => `<tr><th scope="row">${inline(r.label)}</th>`
        + `<td class="chl-bar-c"><span class="chl-bar" aria-hidden="true"><i style="width:${pct(r.n, r.of).toFixed(1)}%"></i></span></td>`
        + `<td class="chl-num">${num(r.n)} <span>of ${num(r.of)}</span></td></tr>`).join('') + `</tbody></table>${note}</figure>`;
    }
    if (b.kind === 'beforeafter') {
      return `<figure class="chl-fig chl-ba">${cap}<table><thead><tr><th scope="col"></th><th scope="col">Before</th><th scope="col">After</th><th scope="col" class="chl-bar-c"><span class="chl-sr">Share</span></th></tr></thead><tbody>`
        + b.rows.map(r => `<tr><th scope="row">${inline(r.label)}</th><td class="chl-num">${num(r.before)}</td><td class="chl-num chl-after">${num(r.after)} <span>of ${num(r.of)}</span></td>`
          + `<td class="chl-bar-c"><span class="chl-bar chl-bar2" aria-hidden="true"><i style="width:${pct(r.before, r.of).toFixed(1)}%"></i><em style="left:${pct(r.before, r.of).toFixed(1)}%;width:${(pct(r.after, r.of) - pct(r.before, r.of)).toFixed(1)}%"></em></span></td></tr>`).join('')
        + `</tbody></table>${note}</figure>`;
    }
    if (b.kind === 'table') {
      return `<figure class="chl-fig chl-tab">${cap}<table><thead><tr>${(b.columns || []).map(c => `<th scope="col">${inline(c)}</th>`).join('')}</tr></thead><tbody>`
        + (b.rows || []).map(r => '<tr>' + r.map((c, i) => (i ? `<td>${inline(c)}</td>` : `<th scope="row">${inline(c)}</th>`)).join('') + '</tr>').join('') + `</tbody></table>${note}</figure>`;
    }
    if (b.kind === 'compare') {
      const pic = (p, w) => `<figure class="chl-cmp-one"><img src="${esc(p.src)}" alt="${esc(p.alt || '')}" loading="lazy" decoding="async"${p.w ? ` width="${+p.w}" height="${+p.h}"` : ''}><figcaption>${w}</figcaption></figure>`;
      return `<figure class="chl-fig chl-cmp">${cap}<div class="chl-cmp-row">${pic(b.before, 'Before')}${pic(b.after, 'After')}</div>${note}</figure>`;
    }
    /* Pictures of the site itself (22 Nov 2026): one or more screens side by side, a line under them. */
    if (b.kind === 'pictures') {
      /* "wrap": "right" floats the picture beside the change's text, which wraps round it; "scale" shrinks it
         (for example the avatars picture at two thirds, the text around it). */
      const sc = b.scale > 0 && b.scale < 1 ? +b.scale : 1;
      const imgs = (b.images || []).map(p => `<img src="${esc(p.src)}" alt="${esc(p.alt || '')}" loading="lazy" decoding="async"${p.w ? ` width="${Math.round(p.w * sc)}" height="${Math.round(p.h * sc)}"` : ''}>`).join('');
      return `<figure class="chl-shots${(b.images || []).length > 1 ? ' chl-shots-n' : ''}${b.wrap === 'right' ? ' chl-shots-wrap' : ''}"${b.wrap === 'right' && b.images && b.images[0] && b.images[0].w ? ` style="width:${Math.round(b.images[0].w * sc)}px"` : ''}><div class="chl-shots-row">${imgs}</div>${b.caption ? `<figcaption>${inline(b.caption)}</figcaption>` : ''}</figure>`;
    }
    return '';
  }
  function heroHTML(h) {
    if (!h) return '';
    if (h.kind === 'image') return `<figure class="chl-hero"><img src="${esc(h.src)}" alt="${esc(h.alt || '')}" loading="lazy" decoding="async">${h.caption ? `<figcaption>${inline(h.caption)}</figcaption>` : ''}</figure>`;
    if (h.kind === 'pictures') return `<figure class="chl-hero chl-hero-pics"><div class="chl-pics">${(h.images || []).map(i => `<img src="${esc(i.src)}" alt="${esc(i.alt || '')}" title="${esc(i.alt || '')}" width="160" height="160" loading="lazy" decoding="async">`).join('')}</div>${h.caption ? `<figcaption>${inline(h.caption)}</figcaption>` : ''}</figure>`;
    return '';
  }
  function relBodyHTML(R) {
    const at = {};
    (R.blocks || []).forEach(b => { const k = b.at || 'top'; (at[k] = at[k] || []).push(b); });
    let h = heroHTML(R.hero);
    (R.intro || []).forEach(p => { h += `<p class="chl-intro">${inline(p)}</p>`; });
    (at.top || []).forEach(b => { h += blockHTML(b); });
    for (const s of R.sections) {
      const n = s.groups.reduce((a, g) => a + g.entries.length, 0);
      h += `<div class="chl-sec" data-k="${esc(s.key)}"><h3 class="chl-sec-h"><span class="chl-kind chl-k-${esc(s.key)}">${esc(s.label)}</span><span class="chl-sec-n">${n}</span></h3>`;
      for (const g of s.groups) {
        h += '<div class="chl-grp">' + (g.title ? `<h4 class="chl-grp-h">${inline(g.title)}</h4>` : '') + '<ul class="chl-entries">';
        for (const e of g.entries) {
          const eb = at[e.id] || [];
          h += `<li class="chl-e${e.titled ? '' : ' chl-plain'}" id="chl-e-${esc(e.id)}" data-c="${esc((e.c || []).join(' '))}">${iconsHTML(e.c, e.icon)}<div class="chl-e-text">`
            + eb.filter(b => b.wrap === 'right').map(blockHTML).join('')   // a wrapped picture comes first so the text flows round it
            + `<p>${inline(e.text)}</p>`
            + eb.filter(b => b.wrap !== 'right').map(blockHTML).join('')   // a change's pictures and tables right under its first paragraph (22 Nov 2026)
            + (e.items ? '<ul class="chl-sub">' + e.items.map(x => `<li data-gn-item tabindex="-1">${inline(x)}</li>`).join('') + '</ul>' : '')   // each point an arrow stop (nav.js data-gn-item), not a Tab stop
            + `</div><a class="chl-link" href="${esc(linkHref(e.id))}" data-chl-self="${esc(e.id)}" aria-label="Copy link to this change" title="Copy link to this change">${COPY_IC}</a></li>`;
        }
        h += '</ul></div>';
      }
      h += '</div>';
    }
    return h;
  }

  /* ------------------------------------------------------------------ drawing */
  function paintList() {
    if (!root || !index) return;
    const list = root.querySelector('[data-chl-list]');
    list.innerHTML = ordered().map(relShellHTML).join('');
    root.querySelector('[data-chl-rail]').innerHTML = '<ol>' + ordered().map(r => `<li data-chl-for="${esc(r.anchor)}"><button type="button" data-chl-go="${esc(r.anchor)}"><b>${esc(r.v)}</b><span>${esc(r.date ? longDate(r.date) : '')}${r.stream === 'server' ? ', game server' : ''}</span></button></li>`).join('') + '</ol>';
    root.querySelector('[data-chl-picklist]').innerHTML = ordered().map(r => `<button type="button" data-chl-go="${esc(r.anchor)}" data-chl-for="${esc(r.anchor)}"><b>${esc(r.v)}</b><span>${esc(r.date ? longDate(r.date) : '')}${r.stream === 'server' ? ', game server' : ''}</span></button>`).join('');
    for (const a of rels.keys()) fill(a);
    watch();
    applyFilters();
  }
  function fill(anchor) {
    const box = root && root.querySelector(`[data-chl-content="${CSS.escape(anchor)}"]`);
    const R = rels.get(anchor);
    if (!box || !R || box.dataset.state === 'done') return;
    /* A release above the one being read grows or shrinks as it fills: the one being read keeps its
       place on screen (the page's own anchoring; the browser's is off for this window, changelog.css). */
    const ref = inView(), before = ref ? ref.getBoundingClientRect().top : 0;
    box.innerHTML = relBodyHTML(R);
    box.dataset.state = 'done';
    box.style.minHeight = '';
    applyFilters();
    if (ref && ref !== box.closest('.chl-rel') && (box.compareDocumentPosition(ref) & Node.DOCUMENT_POSITION_FOLLOWING)) {
      const dy = ref.getBoundingClientRect().top - before;
      if (Math.abs(dy) > 0.5) scroller.scrollTop += dy;
    }
  }
  /* The first release (or, inside one, the first change) at the top of the window now. */
  function inView() {
    if (!root || !scroller) return null;
    const top = Math.max(0, scroller.getBoundingClientRect().top) + 4;
    const rel = [...root.querySelectorAll('.chl-rel:not([hidden])')].find(s => s.getBoundingClientRect().bottom > top);
    if (!rel) return null;
    return [...rel.querySelectorAll('.chl-e:not([hidden])')].find(e => e.getBoundingClientRect().bottom > top) || rel;
  }
  function want(anchor) {
    const box = root && root.querySelector(`[data-chl-content="${CSS.escape(anchor)}"]`);
    if (!box || box.dataset.state === 'done') return Promise.resolve();
    if (box.dataset.state === 'wait') { box.dataset.state = 'loading'; box.innerHTML = '<p class="chl-wait">Loading this release…</p>'; }
    return loadRelease(anchor).then(R => {
      if (!root || !root.isConnected) return;
      if (R) fill(anchor);
      else { box.dataset.state = 'wait'; box.innerHTML = '<p class="chl-wait">This release could not be loaded. Scroll on and back to try again.</p>'; }
    });
  }
  /* THE REST SETTLES WHILE THE VISITOR READS (21 Nov 2026). A release filled in while the page is being scrolled
     moves everything after it, and the browser must draw the whole screen again at once: on a busy computer it showed
     boxes for a moment. So once the page is open, the other releases are asked for one at a time, in reading order,
     when the browser is idle, and drawn before the visitor reaches them. The scroll still asks first for any it reaches. */
  let settleT = 0;
  const settleTried = new Set();
  function settleSoon() {
    if (settleT) return;
    const idle = window.requestIdleCallback ? (f => requestIdleCallback(f, { timeout: 1500 })) : (f => setTimeout(f, 300));
    settleT = 1;
    const next = () => idle(() => {
      if (!root || !root.isConnected) { settleT = 0; return; }
      const box = [...root.querySelectorAll('.chl-rel-content[data-state="wait"]')].find(b => !settleTried.has(b.dataset.chlContent));
      if (!box) { settleT = 0; return; }
      settleTried.add(box.dataset.chlContent);   // once each: a file that does not come waits for the scroll
      want(box.dataset.chlContent).then(next, next);
    });
    next();
  }
  /* Each release's changes are asked for as its place comes within a screen or so of the view. */
  function watch() {
    if (io) io.disconnect();
    if (!('IntersectionObserver' in window)) { ordered().forEach(r => want(r.anchor)); return; }
    io = new IntersectionObserver(es => { es.forEach(e => { if (e.isIntersecting) want(e.target.dataset.chlContent); }); }, { root: scroller, rootMargin: '900px 0px 900px 0px' });
    root.querySelectorAll('[data-chl-content]').forEach(b => io.observe(b));
  }

  /* ------------------------------------------------------------------ filters */
  function relShown(row) {
    if (S.stream && row.stream !== S.stream) return false;
    if (S.kind && !(row.counts || {})[S.kind]) return false;
    if (S.con && !row.consoles.includes(S.con)) return false;
    return true;
  }
  function applyFilters() {
    if (!root || !index) return;
    root.dataset.kind = S.kind || '';
    let shown = 0;
    for (const row of ordered()) {
      const el = root.querySelector(`#chl-r-${CSS.escape(row.anchor)}`);
      let ok = relShown(row);
      if (el && ok && el.querySelector('.chl-rel-content[data-state="done"]')) {
        /* Loaded: each change and each section by itself, and the release only with something left. */
        let any = false;
        el.querySelectorAll('.chl-sec').forEach(sec => {
          let n = 0;
          sec.querySelectorAll('.chl-e').forEach(e => { const hit = !S.con || e.dataset.c.split(' ').includes(S.con); e.hidden = !hit; if (hit) n++; });
          sec.querySelectorAll('.chl-grp').forEach(g => { g.hidden = !g.querySelector('.chl-e:not([hidden])'); });
          const kindOk = !S.kind || sec.dataset.k === S.kind;
          sec.hidden = !kindOk || !n;
          if (!sec.hidden) any = true;
        });
        ok = any;
      }
      if (el) el.hidden = !ok;
      root.querySelectorAll(`[data-chl-for="${CSS.escape(row.anchor)}"]`).forEach(x => { x.hidden = !ok; });
      if (ok) shown++;
    }
    const empty = root.querySelector('[data-chl-empty]');
    empty.hidden = !!shown || !!S.q;
    if (!shown) empty.textContent = S.stream === 'server' && !index.releases.some(r => r.stream === 'server') ? 'No game server release is listed.' : 'No release matches these filters.';
    /* "5 releases.", "2 releases with fixes for Game Boy.", "4 releases of the game server with changes for NES." */
    const of = S.stream ? ' of the ' + (S.stream === 'server' ? 'game server' : 'site and emulators') : '';
    const what = S.kind ? ' with ' + (S.kind === 'new' ? 'new changes' : S.kind) : S.con ? ' with changes' : '';
    if (!S.q) root.querySelector('[data-chl-shown]').textContent = `${shown} ${shown === 1 ? 'release' : 'releases'}${of}${what}${S.con ? ' for ' + conLabel(S.con) : ''}.`;
    if (S.q) runSearch();
    spySoon();
  }
  function setFilter(k, v) {
    S[k] = S[k] === v ? '' : v;
    chipsPaint();
    applyFilters();
    /* The chips were drawn again: the focus stays on the one just pressed. */
    const f = root.querySelector(`[data-chl-${k}="${CSS.escape(v)}"]`);
    if (f) { try { f.focus({ preventScroll: true }); } catch (_) {} }
  }

  /* ------------------------------------------------------------------ search */
  function runSearch() {
    const box = root.querySelector('[data-chl-results]'), list = root.querySelector('[data-chl-list]');
    const q = S.q.trim();
    box.hidden = !q; list.hidden = !!q;
    root.classList.toggle('chl-searching', !!q);
    if (!q) { root.querySelector('[data-chl-empty]').hidden = true; applyFilters(); return; }
    if (!searchRows) { box.innerHTML = '<p class="chl-wait">Searching…</p>'; loadSearch().then(r => { if (root && root.isConnected && S.q.trim()) { if (r) runSearch(); else box.innerHTML = '<p class="chl-wait">The search could not be loaded.</p>'; } }); return; }
    const terms = fold(q).split(/\s+/).filter(Boolean);
    const rowOk = new Map(listed().map(r => [r.anchor, r]));
    const hits = [];
    for (const r of searchRows) {
      const rel = rowOk.get(r.rel); if (!rel) continue;
      if (S.stream && rel.stream !== S.stream) continue;
      if (S.kind && r.k !== S.kind) continue;
      if (S.con && !r.c.includes(S.con)) continue;
      if (!terms.every(t => r.ft.includes(t) || r.fx.includes(t))) continue;
      hits.push({ r, rel, score: terms.filter(t => r.ft.includes(t)).length });
    }
    hits.sort((a, b) => b.score - a.score);   // stable: newest first within the same score
    const MAX = 60;
    root.querySelector('[data-chl-shown]').textContent = hits.length ? `${hits.length} ${hits.length === 1 ? 'change' : 'changes'} match.${hits.length > MAX ? ` The first ${MAX} are shown; add a word to narrow it.` : ''}` : 'No change matches.';
    box.innerHTML = hits.slice(0, MAX).map(({ r, rel }) => {
      const i = terms.map(t => r.fx.indexOf(t)).filter(x => x >= 0).sort((a, b) => a - b)[0];
      const from = i == null ? 0 : Math.max(0, i - 60), to = Math.min(r.text.length, from + 190);
      let snip = r.text.slice(from, to), fsn = r.fx.slice(from, to);
      /* The words found, marked in place (found in the folded copy, drawn from the real words). */
      const marks = [];
      terms.forEach(t => { let j = fsn.indexOf(t); while (j >= 0 && t) { marks.push([j, j + t.length]); j = fsn.indexOf(t, j + t.length); } });
      marks.sort((a, b) => a[0] - b[0]);
      let out = '', at = 0;
      for (const [s, e] of marks) { if (s < at) continue; out += esc(snip.slice(at, s)) + '<mark>' + esc(snip.slice(s, e)) + '</mark>'; at = e; }
      out += esc(snip.slice(at));
      return `<button type="button" class="chl-res" data-chl-goto="${esc(r.id)}"><span class="chl-res-top"><span class="chl-badge chl-badge-s">${esc(rel.v)}</span><span class="chl-kind chl-k-${esc(r.k)}">${esc(KIND_ONE[r.k] || r.k)}</span>${iconsHTML(r.c)}</span>`
        + `<span class="chl-res-t">${esc(r.title)}</span><span class="chl-res-s">${from ? '…' : ''}${out}${to < r.text.length ? '…' : ''}</span></button>`;
    }).join('');
  }
  let typingT = 0;
  function startTyping() { const q = root.querySelector('[data-chl-q]'); q.readOnly = false; q.removeAttribute('inputmode'); try { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } catch (_) {} loadSearch(); }
  function endTyping() { const q = root && root.querySelector('[data-chl-q]'); if (q) { q.readOnly = true; q.setAttribute('inputmode', 'none'); } }

  /* ------------------------------------------------------------------ going to a release or a change */
  function headH(el) { const h = el && el.closest('.chl-rel') && el.closest('.chl-rel').querySelector('.chl-rel-head'); return h ? h.getBoundingClientRect().height : 0; }
  function scrollToEl(el, smooth) {
    if (!el || !scroller) return;
    const sr = scroller.getBoundingClientRect(), r = el.getBoundingClientRect();
    const isRel = el.classList.contains('chl-rel');
    const top = scroller.scrollTop + r.top - Math.max(0, sr.top) - (isRel ? 0 : headH(el) + 10);
    /* At once, never smooth: releases above it load while a smooth scroll runs and move its end point. */
    scroller.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
  }
  function setAddress(a) {
    try { if (window.CwAboutWindow && window.CwAboutWindow.isOpen() && window.CwAboutWindow.kind() === 'changelog') history.replaceState(history.state, '', linkHref(a)); } catch (_) {}
  }
  /** Show release or change `a` (2.2.2, 2.2.2-fix-3): filters that hide it are cleared, its file is loaded. */
  function go(a, opts) {
    opts = opts || {};
    if (!root || !index) return Promise.resolve(false);
    const relA = listed().some(r => r.anchor === a) ? a : releaseOf(a);
    const row = listed().find(r => r.anchor === relA);
    if (!row) return Promise.resolve(false);
    if (S.q) { S.q = ''; const q = root.querySelector('[data-chl-q]'); if (q) q.value = ''; runSearch(); }
    if (!relShown(row)) { S.kind = ''; S.con = ''; S.stream = ''; chipsPaint(); applyFilters(); }
    return want(relA).then(() => {
      if (!root || !root.isConnected) return false;
      let el = relA === a ? root.querySelector(`#chl-r-${CSS.escape(a)}`) : root.querySelector(`#chl-e-${CSS.escape(a)}`);
      if (el && el.hidden) { S.kind = ''; S.con = ''; chipsPaint(); applyFilters(); }
      if (!el) el = root.querySelector(`#chl-r-${CSS.escape(relA)}`);
      if (!el) return false;
      lastTarget = { el, until: performance.now() + 1500 };
      scrollToEl(el, opts.smooth);
      /* A release above it may grow as it loads: the browser keeps the view on this one, and if it moved anyway it is put back once. */
      setTimeout(() => { if (lastTarget && lastTarget.el === el && performance.now() < lastTarget.until) scrollToEl(el, false); }, 450);
      if (!opts.quiet) setAddress(a);
      if (el.classList.contains('chl-e')) { el.classList.remove('chl-hit'); void el.offsetWidth; el.classList.add('chl-hit'); setTimeout(() => el.classList.remove('chl-hit'), 2400); }
      if (opts.focus) { const f = el.classList.contains('chl-e') ? el.querySelector('.chl-link') : el.querySelector('.chl-badge'); if (f) { try { f.focus({ preventScroll: true }); } catch (_) {} } }
      spySoon();
      return true;
    });
  }
  /* The version list marks the release being read. */
  function spySoon() { if (!spyRaf) spyRaf = requestAnimationFrame(spy); }
  function spy() {
    spyRaf = 0;
    if (!root || !root.isConnected || !scroller) return;
    const top = scroller.getBoundingClientRect().top + 90;
    let cur = null;
    root.querySelectorAll('.chl-rel:not([hidden])').forEach(s => { if (s.getBoundingClientRect().top <= top) cur = s.dataset.anchor; });
    if (!cur) { const f = root.querySelector('.chl-rel:not([hidden])'); cur = f && f.dataset.anchor; }
    root.querySelectorAll('[data-chl-go]').forEach(b => { const on = b.dataset.chlGo === cur; if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    const pick = root.querySelector('[data-chl-pick] span'), row = listed().find(r => r.anchor === cur);
    if (pick) pick.textContent = row ? `Release ${row.v}` : 'Jump to a release';
  }
  function pickOpen(open, focusFirst) {
    const b = root.querySelector('[data-chl-pick]'), l = root.querySelector('[data-chl-picklist]');
    if (!b || !l) return;
    l.hidden = !open; b.setAttribute('aria-expanded', String(!!open));
    if (open && focusFirst) { const f = l.querySelector('[aria-current="true"]:not([hidden])') || l.querySelector('button:not([hidden])'); if (f) { try { f.focus({ preventScroll: true }); f.scrollIntoView({ block: 'nearest' }); } catch (_) {} } }
  }
  function copyLink(a, el) {
    setAddress(a);
    const full = location.href;
    const done = () => { el.classList.add('chl-copied'); el.setAttribute('aria-label', 'Link copied'); setTimeout(() => { el.classList.remove('chl-copied'); el.setAttribute('aria-label', el.classList.contains('chl-badge') ? el.textContent : 'Copy link to this change'); }, 1600); };
    try { if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(full).then(done, () => {}); } catch (_) {}
  }

  /* ------------------------------------------------------------------ keys */
  function onKey(e) {
    if (!root || !root.isConnected || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target, q = root.querySelector('[data-chl-q]');
    if (!t || t.nodeType !== 1 || !root.contains(t)) return;
    const back = e.key === 'Escape' || e.key === 'Esc' || e.key === 'GoBack' || e.key === 'BrowserBack' || e.keyCode === 4;
    if (t === q && !q.readOnly) {
      if (e.key === 'Enter' || back) { e.preventDefault(); e.stopImmediatePropagation(); endTyping(); }
      return;
    }
    if (t === q && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopImmediatePropagation(); startTyping(); return; }
    const l = root.querySelector('[data-chl-picklist]');
    if (l && !l.hidden && back) { e.preventDefault(); e.stopImmediatePropagation(); pickOpen(false); const b = root.querySelector('[data-chl-pick]'); if (b) b.focus({ preventScroll: true }); }
    /* THE VERSION LIST BY KEYS (22 Nov 2026). Up and Down move along the versions and take the page with them; Down
       past the last one, or Right, goes into the release being read (its first change on screen). The list stays at the
       side while the page moves, so a search "downward" from it never reached the changes. */
    const rb = t.closest && t.closest('.chl-rail [data-chl-go]');
    if (rb && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowRight')) {
      const all = [...root.querySelectorAll('.chl-rail [data-chl-go]')].filter(b => b.getClientRects().length);
      const i = all.indexOf(rb), next = e.key === 'ArrowUp' ? all[i - 1] : e.key === 'ArrowDown' ? all[i + 1] : null;
      e.preventDefault(); e.stopImmediatePropagation();
      if (next) { next.focus({ preventScroll: true }); go(next.dataset.chlGo, { quiet: false }); return; }
      if (e.key === 'ArrowUp') return;   // the first version: Up stays (the chips are reached from the page)
      const at = inView(), rel = at && at.closest('.chl-rel');
      const f = rel && ([...rel.querySelectorAll('.chl-e:not([hidden]) .chl-link, .chl-sub li')].find(x => x.getBoundingClientRect().top > scroller.getBoundingClientRect().top + 60) || rel.querySelector('.chl-badge'));
      if (f) { try { f.focus({ preventScroll: true }); } catch (_) {} }
    }
  }

  /* ------------------------------------------------------------------ mount */
  function size() {
    if (!root) return;
    const w = root.getBoundingClientRect().width, tv = document.body.classList.contains('gnw-tv');
    root.dataset.size = w >= 940 && !tv ? 'l' : 's';
    root.classList.toggle('chl-tv', tv);
  }
  function mount(win) {
    root = win.querySelector('[data-chl-root]');
    if (!root) return;
    scroller = win;
    size();
    try { new ResizeObserver(() => { if (root && root.isConnected) size(); }).observe(root); } catch (_) {}
    if (!win.__chlWired) {
      win.__chlWired = true;
      win.addEventListener('scroll', () => { if (root && root.isConnected) spySoon(); }, { passive: true });
      /* The visitor scrolling by themselves: a jump no longer holds its place. */
      ['wheel', 'touchstart', 'keydown'].forEach(ev => win.addEventListener(ev, () => { lastTarget = null; }, { passive: true }));
    }
    const q = root.querySelector('[data-chl-q]');
    q.value = S.q;
    q.addEventListener('pointerdown', () => { if (q.readOnly) startTyping(); });
    q.addEventListener('blur', () => endTyping());
    q.addEventListener('input', () => { clearTimeout(typingT); typingT = setTimeout(() => { S.q = q.value; runSearch(); }, 140); });
    root.addEventListener('click', ev => {
      const t = ev.target; if (!t || !t.closest) return;
      const k = t.closest('[data-chl-kind]'); if (k) { setFilter('kind', k.dataset.chlKind); return; }
      const c = t.closest('[data-chl-con]'); if (c) { setFilter('con', c.dataset.chlCon); return; }
      const s = t.closest('[data-chl-stream]'); if (s) { setFilter('stream', s.dataset.chlStream); return; }
      const p = t.closest('[data-chl-pick]'); if (p) { const l = root.querySelector('[data-chl-picklist]'); pickOpen(l.hidden, ev.detail === 0); return; }
      const g = t.closest('[data-chl-go]'); if (g) { const fromPick = !!g.closest('[data-chl-picklist]'); pickOpen(false); go(g.dataset.chlGo, { smooth: true, focus: ev.detail === 0 }); if (fromPick && ev.detail !== 0) { const b = root.querySelector('[data-chl-pick]'); if (b) b.blur(); } return; }
      const r = t.closest('[data-chl-goto]'); if (r) { go(r.dataset.chlGoto, { focus: true }); return; }
      const self = t.closest('[data-chl-self]'); if (self) { ev.preventDefault(); copyLink(self.dataset.chlSelf, self); return; }
      if (!t.closest('.chl-pickwrap')) pickOpen(false);
    });
    root.addEventListener('focusin', ev => { if (!ev.target.closest('.chl-pickwrap')) pickOpen(false); });
    const stat = root.querySelector('[data-chl-load-stat]');
    loadIndex().then(ix => {
      if (!root || !root.isConnected) return;
      const card = root.querySelector('[data-chl-loading]');
      if (!ix) { if (stat) stat.textContent = 'The change log could not be loaded. Close the window and try again.'; card.classList.add('chl-load-broken'); return; }
      card.hidden = true;
      root.dataset.ready = '1';
      chipsPaint();
      paintList();
      if (S.q) runSearch();
      const a = firstAnchor; firstAnchor = '';
      if (a) setTimeout(() => go(a, { quiet: true }), 0);
      else { const first = ordered()[0]; if (first) want(first.anchor); }
      settleSoon();
    });
  }
  window.addEventListener('keydown', onKey, true);
  (function css() {
    if (document.getElementById('chl-css')) return;
    const l = document.createElement('link'); l.id = 'chl-css'; l.rel = 'stylesheet'; l.href = 'changelog.css?v=2.3.0-changelog6';
    document.head.appendChild(l);
  })();
  window.CwChangelog = { html, mount, go, preview: PREVIEW };
})();

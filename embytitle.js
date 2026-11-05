/*
 * embytitle.js -- what is playing, top right of the media player (2026-10-15).
 *
 * WHAT IT SHOWS. The title's clear logo from the media server when it has
 * one: a movie's own Logo image, an episode's SERIES Logo with the episode
 * line under it ("S2 E5 · Episode title"). With no logo, or one that fails to
 * load, the same thing as text: "Movie title (year)", or the series name over
 * the episode line. Images come through Emby.imageUrl (maxWidth, the server's
 * own tag); the URL carries the session's api_key exactly as every other
 * picture on the page does, and is never written to the console.
 *
 * WHEN. It shows and hides WITH the player's controls (subs.js's .gsub-bar,
 * which comes up on a mouse move, a touch, a key or a remote press, and goes
 * after 3 s idle, 4 s on a TV), with the same .3 s fade. Watched the same way
 * embytrick.js follows that bar: a MutationObserver on its class and hidden
 * attributes, plus a slow tick. With no control bar (subs.js missing) it keeps
 * its own 3 s idle rule. Hidden while the player is still preparing.
 *
 * WHERE. Top right of the picture, left of the close button, at most 30% of
 * the width and 14% of the height: subtitles sit at the bottom, so it never
 * covers them. A soft drop shadow keeps a white logo readable on a bright
 * scene. The player is black in both site themes, so it has one look.
 *
 * PAUSED (2026-10-28). While the film or episode is paused with the
 * controls up, its synopsis shows under the logo in large type (see "the pause
 * synopsis" below), down to the first control under it and no further.
 *
 * HOOKS. Registers in window.GnwPlayerAddons (see emby.js, "PLAYER ADD-ONS").
 */
(function () {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LOGO_W = 520;          // asked of the server; drawn at most 30vw / 260px wide
  let L = null;                // the live state while a title plays

  function ensureStyles() {
    if (document.getElementById('gnw-ptitle-styles')) return;
    const s = document.createElement('style');
    s.id = 'gnw-ptitle-styles';
    s.textContent = `
      #video-player-overlay .ptitle {
        position:absolute; z-index:5; top:max(16px, env(safe-area-inset-top, 0px));
        right:calc(max(20px, env(safe-area-inset-right, 0px)) + 52px);
        max-width:min(30vw, 340px); display:flex; flex-direction:column; align-items:flex-end;
        gap:6px; text-align:right; color:#fff; pointer-events:none;
        transition:opacity .3s ease; opacity:1;
        filter:drop-shadow(0 2px 6px rgba(0,0,0,.75)) drop-shadow(0 0 2px rgba(0,0,0,.6));
      }
      #video-player-overlay .ptitle.ptitle-quiet { opacity:0; }
      #video-player-overlay .ptitle[hidden] { display:none; }
      #video-player-overlay .ptitle-logo { display:block; max-width:min(30vw, 260px); max-height:min(14vh, 110px);
        width:auto; height:auto; object-fit:contain; }
      #video-player-overlay .ptitle-name { font-size:clamp(15px, 1.6vw, 24px); font-weight:800; line-height:1.15;
        letter-spacing:.01em; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
      #video-player-overlay .ptitle-ep { font-size:clamp(12px, 1.15vw, 17px); font-weight:600; line-height:1.25; color:#e3e7ee;
        overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
      body.gnw-tv #video-player-overlay .ptitle { top:max(28px, 3.5vh); right:calc(4vw + 52px); }
      @media (max-width: 560px) {
        #video-player-overlay .ptitle { max-width:52vw; }
        #video-player-overlay .ptitle-logo { max-width:44vw; max-height:12vh; }
      }
      /* THE PAUSE SYNOPSIS (28 Oct): under the logo on the right, only while paused
         with the controls up. Its top and its line count are set by placeSyn(): it stops above the
         first control below it, and a longer text ends in an ellipsis. */
      #video-player-overlay .ptitle-syn { position:absolute; z-index:5; right:calc(max(20px, env(safe-area-inset-right, 0px)) + 52px);
        width:min(36vw, 640px); box-sizing:border-box; padding:.55em .85em; border-radius:12px;
        background:rgba(0,0,0,.58); color:#f3f5f8; text-align:left; pointer-events:none;
        font-size:clamp(17px, 1.45vw, 26px); line-height:1.4; font-weight:500; letter-spacing:.005em;
        text-shadow:0 1px 3px rgba(0,0,0,.8); transition:opacity .3s ease; opacity:1; }
      #video-player-overlay .ptitle-syn.ptitle-quiet { opacity:0; }
      #video-player-overlay .ptitle-syn[hidden] { display:none; }
      #video-player-overlay .ptitle-syn-text { display:-webkit-box; -webkit-box-orient:vertical; overflow:hidden; overflow-wrap:anywhere; }
      body.gnw-tv #video-player-overlay .ptitle-syn { right:calc(4vw + 52px); width:min(40vw, 860px); font-size:clamp(24px, 1.9vw, 42px); }
      @media (max-width: 560px) {
        #video-player-overlay .ptitle-syn { width:min(72vw, 420px); font-size:15px; }
      }
      @media (prefers-reduced-motion: reduce) { #video-player-overlay .ptitle-syn { transition:none; } }`;
    document.head.appendChild(s);
  }

  /* "S2 E5 · Episode title"; a special or an unnumbered episode keeps what it has. */
  function episodeLine(it) {
    const s = it.ParentIndexNumber, e = it.IndexNumber;
    const num = (s != null ? 'S' + s : '') + (e != null ? (s != null ? ' ' : '') + 'E' + e : '');
    return [num, it.Name].filter(Boolean).join(' · ');
  }
  function textHTML(it) {
    if (it.Type === 'Episode') {
      return `<div class="ptitle-name">${esc(it.SeriesName || it.Name || '')}</div>` +
             (it.SeriesName ? `<div class="ptitle-ep">${esc(episodeLine(it))}</div>` : '');
    }
    const y = it.ProductionYear || (it.PremiereDate ? new Date(it.PremiereDate).getFullYear() : '');
    return `<div class="ptitle-name">${esc(it.Name || '')}${y ? ' (' + esc(y) + ')' : ''}</div>`;
  }

  /* The logo to use, or null: the movie's own, or the series' for an episode.
     Episodes usually carry the series' logo inline (ParentLogoItemId and
     ParentLogoImageTag); when they do not, the series item is asked once. */
  async function logoFor(it) {
    const E = window.Emby;
    if (!E || !E.imageUrl) return null;
    if (it.Type === 'Episode') {
      if (it.ParentLogoItemId && it.ParentLogoImageTag)
        return E.imageUrl(it.ParentLogoItemId, 'Logo', { tag: it.ParentLogoImageTag, maxWidth: LOGO_W });
      if (it.SeriesId && E.getItem) {
        const s = await E.getItem(it.SeriesId).catch(() => null);
        if (s && s.ImageTags && s.ImageTags.Logo) return E.imageUrl(s.Id, 'Logo', { tag: s.ImageTags.Logo, maxWidth: LOGO_W });
      }
      return null;
    }
    if (it.ImageTags && it.ImageTags.Logo) return E.imageUrl(it.Id, 'Logo', { tag: it.ImageTags.Logo, maxWidth: LOGO_W });
    if (!it.ImageTags && it.Id && E.getItem) {
      const full = await E.getItem(it.Id).catch(() => null);
      if (full && full.ImageTags && full.ImageTags.Logo) return E.imageUrl(full.Id, 'Logo', { tag: full.ImageTags.Logo, maxWidth: LOGO_W });
    }
    return null;
  }

  async function fill(S) {
    const it = S.item;
    S.el.innerHTML = textHTML(it);            // text first: something true from the first frame
    S.el.dataset.mode = 'text';
    let url = null;
    try { url = await logoFor(it); } catch { url = null; }
    if (!url || S.dead) return;
    const img = new Image();
    img.className = 'ptitle-logo';
    img.alt = it.Type === 'Episode' ? (it.SeriesName || '') : (it.Name || '');
    img.decoding = 'async';
    img.onload = () => {
      if (S.dead) return;
      const ep = it.Type === 'Episode' ? `<div class="ptitle-ep">${esc(episodeLine(it))}</div>` : '';
      S.el.innerHTML = ep;
      S.el.insertBefore(img, S.el.firstChild);
      S.el.dataset.mode = 'logo';
    };
    img.onerror = () => {};                  // keep the text
    img.src = url;
  }

  /* ---- the pause synopsis (28 Oct 2026) ----
     The aim: "On the pause page of movies and shows, display the synopsis of the show in large
     readable letters under the logo on the right side." A film's overview; an episode's own,
     else its series'. Emby and Jellyfin both give it as Overview. A row that came without the
     field (the wall's title list keeps no overviews) asks for the item once. No overview: no
     box. The text is set as text, after the server's markup is read as plain words. */
  const plain = s => {
    const t = String(s == null ? '' : s);
    if (!/[<&]/.test(t)) return t.replace(/\s+/g, ' ').trim();
    try { return (new DOMParser().parseFromString(t.replace(/<br\s*\/?>/gi, ' '), 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim(); }
    catch { return t.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
  };
  async function synopsisFor(it) {
    const E = window.Emby;
    let own = it.Overview;
    if (typeof own !== 'string' && it.Id && E && E.getItem) {
      const full = await E.getItem(it.Id).catch(() => null);
      own = full && full.Overview;
    }
    own = plain(own);
    if (own || it.Type !== 'Episode' || !it.SeriesId || !E || !E.getItem) return own;
    const s = await E.getItem(it.SeriesId).catch(() => null);
    return plain(s && s.Overview);
  }
  async function fillSyn(S) {
    let text = '';
    try { text = await synopsisFor(S.item); } catch { text = ''; }
    if (S.dead || !text) return;
    S.syn.firstChild.textContent = text;
    S.synText = text;
    sync(S);
  }
  /* What may sit below the synopsis: the control bar, its menus and panels, Up Next, Skip
     Intro, the subtitle lines and the player's notes. The box stops above the first of them
     that is showing and shares its columns; a box with room for fewer than two lines is not
     shown at all. */
  const SYN_BELOW = '.gsub-bar, .gsub-menu, .gsub-notecard, .gsub-toast, .gsub-cue, .gtr-panel, .gun-card, .vp-skip, .vp-skip-toast';
  function placeSyn(S) {
    const box = S.syn, txt = box.firstChild;
    const st = S.stage.getBoundingClientRect(), tr = S.el.getBoundingClientRect();
    const gap = Math.max(10, Math.round(st.height * 0.015));
    const top = Math.max(tr.bottom, st.top + 16) - st.top + gap;
    box.style.top = Math.round(top) + 'px';
    const br = box.getBoundingClientRect();
    let floor = st.bottom - 16;
    const ov = S.stage.closest('#video-player-overlay') || S.stage;
    ov.querySelectorAll(SYN_BELOW).forEach(o => {
      if (o === box || box.contains(o) || o.hidden || !o.getClientRects().length) return;
      const cs = getComputedStyle(o);
      if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return;
      const r = o.getBoundingClientRect();
      if (!r.width || !r.height || r.right <= br.left || r.left >= br.right) return;   // another column
      if (r.bottom <= br.top) return;                                                   // above the box
      floor = Math.min(floor, r.top - gap);
    });
    const cs = getComputedStyle(box);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const lines = Math.floor((floor - br.top - pad) / lh);
    if (lines < 2) return false;
    const want = String(Math.min(lines, innerWidth <= 560 ? 8 : 40));   // a phone keeps most of the picture
    if (txt.style.webkitLineClamp !== want) txt.style.webkitLineClamp = want;
    return true;
  }
  function syncSyn(S, quiet) {
    if (!S.syn) return;
    const show = !quiet && !!S.synText && S.v.paused && !S.v.ended;
    if (!show) {
      if (!S.syn.hidden && !S.syn.classList.contains('ptitle-quiet')) S.syn.classList.add('ptitle-quiet');
      clearTimeout(S.synHide);
      if (!S.syn.hidden) S.synHide = setTimeout(() => { if (S.syn.classList.contains('ptitle-quiet')) S.syn.hidden = true; }, 320);
      return;
    }
    clearTimeout(S.synHide);
    if (S.syn.hidden) { S.syn.hidden = false; S.syn.classList.add('ptitle-quiet'); }
    const fits = placeSyn(S);
    S.syn.classList.toggle('ptitle-quiet', !fits);
  }

  /* ---- show and hide with the control bar ---- */
  function sync(S) {
    if (S.dead) return;
    const bar = S.stage.querySelector('.gsub-bar');
    let quiet;
    if (bar) quiet = bar.hidden || bar.classList.contains('gsub-quiet');
    else quiet = !S.v.paused && Date.now() - S.lastInput > 3000;
    if (S.v.classList.contains('prepping')) quiet = true;
    S.el.classList.toggle('ptitle-quiet', !!quiet);
    syncSyn(S, !!quiet);
  }

  const api = {
    name: 'title',
    attach(ctx) {
      api.detach();
      if (!ctx || !ctx.item || !ctx.stage || !ctx.video) return;
      ensureStyles();
      const S = L = { item: ctx.item, stage: ctx.stage, v: ctx.video, dead: false, lastInput: Date.now(), offs: [] };
      S.el = document.createElement('div');
      S.el.className = 'ptitle ptitle-quiet';
      S.el.setAttribute('aria-hidden', 'true');    // the controls already name the title for a screen reader
      S.stage.appendChild(S.el);
      S.syn = document.createElement('div');                 // the pause synopsis
      S.syn.className = 'ptitle-syn ptitle-quiet';
      S.syn.hidden = true;
      S.syn.setAttribute('aria-hidden', 'true');
      S.syn.appendChild(document.createElement('div')).className = 'ptitle-syn-text';
      S.stage.appendChild(S.syn);
      const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); S.offs.push(() => t.removeEventListener(ev, fn, o)); };
      const input = () => { S.lastInput = Date.now(); sync(S); };
      on(S.stage, 'pointermove', input); on(S.stage, 'pointerdown', input); on(window, 'keydown', input, true);
      on(S.v, 'pause', () => sync(S)); on(S.v, 'play', () => sync(S)); on(window, 'resize', () => sync(S));
      S.mo = new MutationObserver(() => sync(S));
      const watch = () => { const b = S.stage.querySelector('.gsub-bar'); if (b && b !== S.watched) { S.watched = b; S.mo.observe(b, { attributes: true, attributeFilter: ['class', 'hidden'] }); } sync(S); };
      S.mo2 = new MutationObserver(watch);
      S.mo2.observe(S.stage, { childList: true });
      S.mo3 = new MutationObserver(() => sync(S));
      S.mo3.observe(S.v, { attributes: true, attributeFilter: ['class'] });
      watch();
      const tick = () => { if (S.dead) return; sync(S); S.timer = setTimeout(tick, 500); };
      tick();
      fill(S);
      fillSyn(S);
    },
    detach() {
      const S = L; L = null;
      if (!S) return;
      S.dead = true;
      clearTimeout(S.timer); clearTimeout(S.synHide);
      try { S.mo.disconnect(); S.mo2.disconnect(); S.mo3.disconnect(); } catch {}
      S.offs.forEach(f => { try { f(); } catch {} });
      if (S.el) S.el.remove();
      if (S.syn) S.syn.remove();
    },
    _live: () => L,
  };
  (window.GnwPlayerAddons = window.GnwPlayerAddons || []).push(api);
})();

/*
 * embyupnext.js -- next-episode autoplay with an "Up Next" card (2026-10-04).
 *
 * WHAT IT DOES. Near the end of an episode a card slides in over the player:
 * the next episode's still, its season/episode and title, a countdown, and
 * Play now / Cancel. When the countdown runs out (or the episode ends) the next
 * episode starts in the same player. The finished episode is marked Played on
 * the server through emby.js's own played-state code (Emby.player.markPlayed).
 *
 * WHEN THE CARD APPEARS.
 *   1. At the episode's CreditsStart marker when the server has one (Emby
 *      saves it in Chapters[] with MarkerType 'CreditsStart', next to the
 *      IntroStart/IntroEnd markers Skip Intro reads). A marker earlier than
 *      half-way, or past the end, is ignored as nonsense.
 *   2. Otherwise at Emby Web's own point: 40 s before the end for episodes of
 *      50 min or more, 35 s for 40-50 min, 30 s for anything shorter. That is
 *      the expression in Emby Web's videoosd.js,
 *        runtimeTicks - 1e3*(fiftyMinuteTicks<=runtimeTicks?40:fortyMinuteTicks<=runtimeTicks?35:30)*1e4
 *      with CreditsStart used first when present -- quoted in
 *      https://emby.media/community/topic/148474-workaround-customize-upnext-next-episode-prompt-timing-in-emby-web/
 *      (tested there on Emby 4.9.5.0).
 *
 * THE NEXT EPISODE. /Shows/{SeriesId}/Episodes for the whole series (no
 * SeasonId), in the server's own order, so the episode after the last of a
 * season is the first of the next one. Specials (season 0) are skipped unless
 * the one playing is itself a special. Asked once, when playback starts, so the
 * card has its picture ready.
 *
 * SETTINGS (Settings -> Media -> Playback; saved in this browser):
 *   - Autoplay next episode: on (default) / off. Off, the card still appears
 *     with Play now / Cancel, but nothing starts by itself.
 *   - Countdown: 5, 10 (default), 15, 20 or 30 seconds.
 *
 * REMOTE AND KEYBOARD. Play now and Cancel are real <button>s. When the card
 * appears, Play now takes focus if focus is free (the picture, the page) or
 * always in TV mode. Left/Right move between the two, Enter/OK presses, and
 * Back (Escape, Backspace, GoBack, BrowserBack) cancels without closing the
 * player. The countdown holds while the video is paused.
 *
 * SOUND. None. The card's picture is an <img>; the only sound is the player's.
 *
 * HOOKS. Registers itself in window.GnwPlayerAddons (see emby.js, "PLAYER
 * ADD-ONS"); everything it needs from the player -- the media clock, the next
 * play, the played state -- goes through window.Emby.player, so a play path
 * whose <video> clock is not the title's own (a server transcode) only has to
 * set that clock once for this to follow it.
 */
(function () {
  'use strict';

  const BUILD = '20261004-pf1';
  const SET_KEY = 'gnw.emby.upnext.v1';
  const COUNTDOWNS = [5, 10, 15, 20, 30];
  const DEFAULTS = { autoplay: true, countdown: 10 };

  function loadSettings() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(SET_KEY) || '{}') || {}; } catch {}
    const out = Object.assign({}, DEFAULTS, s);
    out.autoplay = out.autoplay !== false;
    if (!COUNTDOWNS.includes(+out.countdown)) out.countdown = DEFAULTS.countdown;
    out.countdown = +out.countdown;
    return out;
  }
  function saveSettings(patch) {
    const s = Object.assign(loadSettings(), patch || {});
    try { localStorage.setItem(SET_KEY, JSON.stringify(s)); } catch {}
    return s;
  }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isTV = () => document.body.classList.contains('gnw-tv');

  /* Emby Web's rule (see header). Seconds. */
  function upNextAt(runSec, chapters) {
    if (!(runSec > 0)) return null;
    const cr = Array.isArray(chapters) && chapters.find(c => c && c.MarkerType === 'CreditsStart' && typeof c.StartPositionTicks === 'number');
    if (cr) {
      const t = cr.StartPositionTicks / 1e7;
      if (t >= runSec * 0.5 && t < runSec - 1) return { at: t, why: 'credits' };
    }
    const before = runSec >= 50 * 60 ? 40 : runSec >= 40 * 60 ? 35 : 30;
    return { at: Math.max(0, runSec - before), why: 'rule' };
  }

  function epLabel(ep) {
    const s = ep.ParentIndexNumber, e = ep.IndexNumber;
    if (s != null && e != null) return 'S' + s + ':E' + e;
    if (e != null) return 'Episode ' + e;
    return '';
  }

  function ensureStyles() {
    if (document.getElementById('gnw-upnext-styles')) return;
    const s = document.createElement('style');
    s.id = 'gnw-upnext-styles';
    s.textContent = `
      /* Just above the player's controls while they are up, lower when they hide
         (--gsub-chrome, set by subs.js; player fixes 2026-10-04). */
      #video-player-overlay .gun-card { position:absolute; z-index:6; right:clamp(20px,4vw,56px); bottom:calc(var(--gsub-chrome, 120px) + 18px); transition:bottom .25s ease;
        width:min(420px, calc(100% - 40px)); box-sizing:border-box; display:grid; grid-template-columns:150px 1fr; gap:14px; padding:14px;
        border-radius:16px; background:var(--bg-2,#1a212e); border:1px solid var(--line,#2a3242); color:var(--text,#e7ecf2);
        box-shadow:0 24px 70px rgba(0,0,0,.6); animation:gun-in .35s cubic-bezier(.2,.75,.25,1); }
      #video-player-overlay .gun-card[hidden] { display:none; }
      @keyframes gun-in { from { transform:translateY(16px); opacity:0 } to { transform:none; opacity:1 } }
      @media (prefers-reduced-motion: reduce) { #video-player-overlay .gun-card { animation:none; } }
      #video-player-overlay .gun-art { position:relative; width:150px; aspect-ratio:16/9; border-radius:10px; overflow:hidden; background:#0c0f14; }
      #video-player-overlay .gun-art img { width:100%; height:100%; object-fit:cover; display:block; }
      #video-player-overlay .gun-ring { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
        background:rgba(0,0,0,.35); font-size:26px; font-weight:800; color:#fff; font-variant-numeric:tabular-nums; text-shadow:0 2px 8px rgba(0,0,0,.7); }
      #video-player-overlay .gun-ring:empty { display:none; }
      #video-player-overlay .gun-body { min-width:0; display:flex; flex-direction:column; gap:4px; }
      #video-player-overlay .gun-kicker { font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:var(--muted,#8a94a6); font-weight:700; }
      #video-player-overlay .gun-title { font-size:15px; font-weight:800; line-height:1.3; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
      #video-player-overlay .gun-sub { font-size:12.5px; color:var(--muted,#8a94a6); }
      #video-player-overlay .gun-btns { display:flex; gap:8px; margin-top:auto; padding-top:6px; flex-wrap:wrap; }
      #video-player-overlay .gun-btns .btn { padding:9px 16px; font-size:13.5px; }
      #video-player-overlay .gun-btns .btn:focus-visible { outline:var(--focus-width,3px) solid var(--focus-ring,#5dc8f0); outline-offset:2px; }
      body.gnw-tv #video-player-overlay .gun-card { right:max(6vw, env(safe-area-inset-right,0px)); bottom:calc(max(var(--gsub-chrome, 18vh), 6vh) + 3vh);
        width:min(520px, calc(100% - 40px)); grid-template-columns:190px 1fr; }
      body.gnw-tv #video-player-overlay .gun-art { width:190px; }
      body.gnw-tv #video-player-overlay .gun-title { font-size:18px; }
      body.gnw-tv #video-player-overlay .gun-btns .btn { padding:13px 22px; font-size:16px; }`;
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------ the live */

  let _live = null;

  function attach(ctx) {
    detach();
    const P = ctx && ctx.player;
    const item = ctx && ctx.item;
    if (!P || !ctx.video || !ctx.stage || !item || !item.Id) return;
    if (item.Type && item.Type !== 'Episode') return;           // films: nothing
    const L = { v: ctx.video, stage: ctx.stage, item, P, dead: false, next: undefined, at: null, card: null,
      shown: false, dismissed: false, started: false, left: 0, timer: 0, listeners: [] };
    _live = L;
    const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); L.listeners.push([el, ev, fn, opt]); };
    ensureStyles();

    // Next episode + credits marker, both asked once, now.
    Promise.resolve(P.nextEpisode(item)).then(n => { if (!L.dead) { L.next = n || null; check(L); } })
      .catch(() => { if (!L.dead) L.next = null; });
    Promise.resolve(P.getChapters(item.Id)).catch(() => []).then(ch => {
      if (L.dead) return;
      L.chapters = ch || [];
      computeAt(L);
      check(L);
    });
    on(L.v, 'timeupdate', () => check(L));
    on(L.v, 'seeked', () => check(L));
    on(L.v, 'loadedmetadata', () => { computeAt(L); check(L); });
    on(L.v, 'ended', () => onEnded(L));
  }

  function computeAt(L) {
    const run = L.P.duration();
    const r = upNextAt(run, L.chapters);
    L.at = r ? r.at : null;
    L.why = r ? r.why : null;
  }

  function check(L) {
    if (!L || L.dead || L.started) return;
    if (L.at == null) computeAt(L);
    if (L.at == null || !L.next) return;
    const t = L.P.time();
    const inZone = t >= L.at;
    if (inZone && !L.shown && !L.dismissed) show(L);
    else if (!inZone && L.shown) hide(L, true);
    // Seeking well back before the zone re-arms a cancelled card.
    if (!inZone && L.dismissed && t < L.at - 5) L.dismissed = false;
  }

  function onEnded(L) {
    if (L.dead || L.started || !L.next) return;
    if (!loadSettings().autoplay || L.dismissed) return;
    playNow(L);
  }

  function show(L) {
    const n = L.next;
    const s = loadSettings();
    L.shown = true;
    const card = document.createElement('div');
    card.className = 'gun-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Up next');
    const img = L.P.thumbUrl(n, 320);
    const sub = [epLabel(n), n.SeriesName].filter(Boolean).join(' · ');
    card.innerHTML = `
      <div class="gun-art">${img ? `<img alt="" src="${esc(img)}">` : ''}<div class="gun-ring" aria-hidden="true"></div></div>
      <div class="gun-body">
        <div class="gun-kicker">Up next</div>
        <div class="gun-title">${esc(n.Name || 'Next episode')}</div>
        <div class="gun-sub">${esc(sub)}</div>
        <div class="gun-sub gun-count" aria-live="polite"></div>
        <div class="gun-btns">
          <button type="button" class="btn btn-primary gun-play">Play now</button>
          <button type="button" class="btn btn-ghost gun-cancel">Cancel</button>
        </div>
      </div>`;
    L.stage.appendChild(card);
    L.card = card;
    L.ring = card.querySelector('.gun-ring');
    L.countEl = card.querySelector('.gun-count');
    const play = card.querySelector('.gun-play'), cancel = card.querySelector('.gun-cancel');
    play.addEventListener('click', e => { e.stopPropagation(); playNow(L); });
    cancel.addEventListener('click', e => { e.stopPropagation(); cancelCard(L); });
    card.addEventListener('click', e => e.stopPropagation());
    card.addEventListener('keydown', e => {
      const k = e.key;
      if (k === 'Escape' || k === 'Backspace' || k === 'GoBack' || k === 'BrowserBack' || e.keyCode === 10009 || e.keyCode === 461) {
        e.preventDefault(); e.stopPropagation(); cancelCard(L); return;
      }
      if (k === 'ArrowLeft' || k === 'ArrowRight') {
        e.preventDefault(); e.stopPropagation();
        (document.activeElement === play ? cancel : play).focus({ preventScroll: true });
        return;
      }
      if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); }
    });
    const a = document.activeElement;
    const ov = document.getElementById('video-player-overlay');
    const free = !a || a === document.body || a === L.v || a === ov;
    // TV: Play now takes focus unless the viewer is inside a menu or panel
    // (subtitle menu, Chapters) or mid-scrub; elsewhere only when focus is free.
    const busy = a && a.closest && (a.closest('.gsub-menu, .gtr-panel') ||
      (a.closest('.gtr-track') && window.GnwTrick && window.GnwTrick._live() && window.GnwTrick._live().pending != null));
    if (free || (isTV() && !busy)) { try { play.focus({ preventScroll: true }); } catch {} }
    if (s.autoplay) {
      L.left = s.countdown;
      paint(L);
      L.timer = setInterval(() => {
        if (L.dead || !L.card) return;
        if (L.v.paused) return;            // hold while paused
        L.left -= 1;
        paint(L);
        if (L.left <= 0) playNow(L);
      }, 1000);
    } else {
      L.left = 0;
      paint(L);
    }
  }
  function paint(L) {
    if (!L.card) return;
    const auto = loadSettings().autoplay;
    L.ring.textContent = auto && L.left > 0 ? String(L.left) : '';
    L.countEl.textContent = auto && L.left > 0 ? 'Starts in ' + L.left + ' s' : '';
  }
  function hide(L, rearm) {
    clearInterval(L.timer); L.timer = 0;
    const hadFocus = L.card && L.card.contains(document.activeElement);
    try { if (L.card) L.card.remove(); } catch {}
    L.card = null; L.shown = false;
    if (hadFocus) { try { L.v.focus({ preventScroll: true }); } catch {} }
  }
  function cancelCard(L) {
    L.dismissed = true;
    hide(L, false);
  }
  function playNow(L) {
    if (L.dead || L.started || !L.next) return;
    L.started = true;
    const cur = L.item, next = L.next;
    hide(L, false);
    try { L.P.playNext(next, cur); } catch (e) { console.warn('[UpNext] could not start the next episode:', e); }
  }

  function detach() {
    const L = _live; if (!L) return;
    _live = null;
    L.dead = true;
    clearInterval(L.timer);
    for (const [el, ev, fn, opt] of L.listeners) { try { el.removeEventListener(ev, fn, opt); } catch {} }
    try { if (L.card) L.card.remove(); } catch {}
  }

  /* ------------------------------------------------------------ settings */

  /* A card for Settings -> Playback, in the same .aw-card markup emby.js uses
     for Auto Skip Intros (its styles come from emby.js). */
  function settingsCardHTML() {
    const s = loadSettings();
    const opts = COUNTDOWNS.map(n => `<option value="${n}" ${n === s.countdown ? 'selected' : ''}>${n} seconds</option>`).join('');
    return `
        <div class="aw-card" style="margin-top:12px;">
          <div class="aw-head"><span class="aw-name">Autoplay next episode</span><label class="aw-switch"><input type="checkbox" id="gun-autoplay" ${s.autoplay ? 'checked' : ''}><span class="aw-slider"></span></label></div>
          <p style="margin:9px 0 0; font-size:11.5px; color:var(--muted); line-height:1.5;">
            Near the end of an episode an Up Next card shows the next one, across seasons too. With this on,
            it starts by itself when the countdown ends; off, the card waits for Play now. The card appears when
            the credits start if your server has marked them, otherwise about 30&ndash;40 seconds before the end.
            Saved only in this browser.
          </p>
          <div class="aw-opts" style="margin-top:11px;">
            <div><label for="gun-countdown" style="display:block; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--muted); margin-bottom:6px;">Countdown</label>
            <select id="gun-countdown" style="background:var(--bg-2,#1a212e); color:var(--text); border:1px solid var(--line); border-radius:8px; padding:7px 10px; font:inherit; font-size:13px;">${opts}</select></div>
          </div>
        </div>`;
  }
  function wireSettings(mount) {
    const ap = mount.querySelector('#gun-autoplay'), cd = mount.querySelector('#gun-countdown');
    if (ap) ap.addEventListener('change', () => saveSettings({ autoplay: ap.checked }));
    if (cd) cd.addEventListener('change', () => saveSettings({ countdown: +cd.value }));
  }

  const api = { BUILD, name: 'upnext', attach, detach, settingsCardHTML, wireSettings, loadSettings, saveSettings, upNextAt,
    _live: () => _live };
  window.GnwUpNext = api;
  (window.GnwPlayerAddons = window.GnwPlayerAddons || []).push(api);
})();

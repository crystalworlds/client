/*
 * play/play-pill.js -- the play window's top bar morph, shared (2026-10-05).
 *
 * "On the NES you should use the same design for the control panel at the top
 * as is on GnW. For example when I press keys it shrinks down to keys, where as
 * on the NES Keys are just highlighted. The GnW is a better design." -- design note.
 *
 * THE DESIGN IS THE GAME & WATCH'S (#play-toolbar-pill, gnw-host.js _gnwSetPill):
 * while a panel is open the bar's controls (.pill-controls) are hidden and the
 * bar shrinks to one "← <title>" Back control (.pill-back); closing the panel
 * grows it back. The width is tweened rather than snapped, which needs an
 * explicit px width at both ends (`auto` does not animate): measure, flip the
 * class, measure, then animate old -> new. Reduced motion, or `instant`, snaps.
 *
 * ONE COPY OF THE BEHAVIOUR. gnw-host.js's _gnwSetPill calls morph() when this
 * file is loaded (and keeps its own body as the fallback); the NES window is the
 * first framed page to use it. The Game Boy, Tetris Jr. and the colour twins
 * still carry their own copies of the same function -- the unified play window
 * is where they fold in.
 *
 * THE STYLES. The site's pill rule in index.html styles #play-toolbar-pill and
 * #pm-toolbar-pill by id; a framed page shares no stylesheet with the site, so
 * ensureCss() puts the same values on the class `.play-pill` (values copied from
 * index.html's rule, not approximated).
 */
(function () {
  'use strict';
  if (window.PlayPill) return;

  const CSS =
    '.play-pill{overflow:hidden;transition:width .28s cubic-bezier(.4,0,.2,1)}' +
    '.play-pill .pill-controls{display:flex;gap:4px;flex-wrap:nowrap;justify-content:center}' +
    '.play-pill .pill-back{display:none;align-items:center;gap:6px;margin:0;white-space:nowrap;' +
      'background:transparent;border:0;border-radius:999px;cursor:pointer;' +
      'color:#d7dce6;font:inherit;font-size:12px;font-weight:700;line-height:1;' +
      'padding:6px 13px;-webkit-tap-highlight-color:transparent}' +
    '.play-pill .pill-back:hover,.play-pill .pill-back:focus-visible{background:rgba(255,255,255,.10)}' +
    '.play-pill .pill-back svg{display:block;flex:0 0 auto}' +
    '.play-pill.sub-open .pill-controls{display:none}' +
    '.play-pill.sub-open .pill-back{display:inline-flex}' +
    '@media (prefers-reduced-motion: no-preference){.play-pill .pill-controls,.play-pill .pill-back{animation:playPillFade .26s ease}}' +
    '@media (prefers-reduced-motion: reduce){.play-pill{transition:none}}' +
    '@keyframes playPillFade{from{opacity:.15}to{opacity:1}}';

  function ensureCss(doc) {
    doc = doc || document;
    if (doc.getElementById('play-pill-css')) return;
    const s = doc.createElement('style');
    s.id = 'play-pill-css';
    s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }

  /* morph(pill, back, { title, titleEl, instant }): back=true shrinks the bar to
     its Back control (titled `title`), back=false restores the controls. A title
     change while already collapsed is applied without a tween. */
  function morph(pill, back, opts) {
    if (!pill) return;
    opts = opts || {};
    back = !!back;
    if (opts.title != null) {
      const t = opts.titleEl || pill.querySelector('[data-pill-title]');
      if (t) t.textContent = opts.title;
    }
    let reduce = false;
    try { reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { /* older engine */ }
    if (pill.classList.contains('sub-open') === back) return;      // already in the target state
    if (opts.instant || reduce) { pill.style.width = ''; pill.classList.toggle('sub-open', back); return; }
    const from = pill.getBoundingClientRect().width;
    pill.style.width = '';                                          // the stylesheet's own width (auto or max-content)
    pill.classList.toggle('sub-open', back);
    const to = pill.getBoundingClientRect().width;
    pill.style.width = from + 'px';
    void pill.offsetWidth;                                          // force a reflow so the next set animates
    pill.style.width = to + 'px';
    const done = function () { pill.style.width = ''; pill.removeEventListener('transitionend', done); };
    clearTimeout(pill._playPillT); pill._playPillT = setTimeout(done, 360);   // if transitionend is missed
    pill.addEventListener('transitionend', done);
  }

  window.PlayPill = { css: CSS, ensureCss, morph };
})();

/*
 * loadbar.js -- the progress bar while a game's files load (2026-10-29).
 *
 * Asked: "Show a progress bar while loading the game files from the server, if it takes more
 * than 2 seconds (appears only after 2 s; real progress from bytes received when the size is
 * known, an indeterminate bar when it isn't; disappears when the game starts; works for game
 * server and Play a file)".
 *
 *   - The game server: cws.js sends window events for each download (cws:download-from with the
 *     listed size, cws:progress with the bytes so far, cws:verified when it is whole and checked,
 *     cws:download-failed when no server could send it). A download counts only while a play
 *     window is open, so the wall's own live previews never show a bar.
 *   - Play a file (play-file.js): CwLoadBar.start(size) / step(handle, got) / done(handle)
 *     while the chosen file is read.
 *   - Shown only once a load has run for 2 s. Several files at once (a game and its console's
 *     boot program) show as one bar: bytes so far of all the bytes. A size that is not known
 *     gives a bar that moves without a number.
 *   - It goes when the last load ends (the game then starts), or when the play window closes.
 * Sound: none. Text: plain words, no dashes.
 */
(function () {
  'use strict';
  if (window.CwLoadBar) return;
  const SHOW_AFTER_MS = 2000;
  const loads = new Map();        // key -> { got, size, t0 }
  let el = null, timer = 0, seq = 0;
  const PLAY_SEL = '#play-overlay.open, [id$="-play-overlay"].open';
  const playOpen = () => !!document.querySelector(PLAY_SEL);

  function css() {
    if (document.getElementById('cw-loadbar-css')) return;
    const st = document.createElement('style'); st.id = 'cw-loadbar-css';
    st.textContent = `
      #cw-loadbar { position:fixed; left:50%; top:62%; transform:translate(-50%,-50%); z-index:2147482000; pointer-events:none;
        width:min(360px, calc(100vw - 32px)); box-sizing:border-box; padding:12px 16px 14px; border-radius:14px;
        background:rgba(14,16,20,.92); border:1px solid rgba(255,255,255,.14); box-shadow:0 14px 40px rgba(0,0,0,.6);
        color:#e6e8ec; font:600 13px/1.3 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
      #cw-loadbar[hidden] { display:none; }
      #cw-loadbar .lb-row { display:flex; justify-content:space-between; gap:10px; margin-bottom:8px; }
      #cw-loadbar .lb-n { color:#9aa1ad; font-weight:500; font-variant-numeric:tabular-nums; white-space:nowrap; }
      #cw-loadbar .lb-track { position:relative; height:8px; border-radius:99px; overflow:hidden; background:rgba(255,255,255,.12); }
      #cw-loadbar .lb-fill { position:absolute; left:0; top:0; bottom:0; width:0; border-radius:99px; background:var(--accent, #9be15d); transition:width .2s linear; }
      #cw-loadbar.lb-unknown .lb-fill { width:35%; animation:cwLbSlide 1.2s ease-in-out infinite; transition:none; }
      @keyframes cwLbSlide { from { left:-35%; } to { left:100%; } }
      @media (prefers-reduced-motion: reduce) { #cw-loadbar.lb-unknown .lb-fill { animation:none; left:0; width:100%; opacity:.45; } }
      body.gnw-tv #cw-loadbar { width:min(520px, calc(100vw - 64px)); font-size:17px; padding:16px 22px 18px; }
      body.gnw-tv #cw-loadbar .lb-track { height:12px; }`;
    document.head.appendChild(st);
  }
  function ensure() {
    if (el) return el;
    css();
    el = document.createElement('div');
    el.id = 'cw-loadbar'; el.hidden = true;
    el.setAttribute('role', 'progressbar'); el.setAttribute('aria-label', 'Loading the game');
    el.innerHTML = '<div class="lb-row"><span class="lb-t">Loading the game</span><span class="lb-n"></span></div><div class="lb-track"><div class="lb-fill"></div></div>';
    document.body.appendChild(el);
    return el;
  }
  const mb = n => (n / 1048576).toFixed(n < 10 * 1048576 ? 1 : 0);
  // "40 of 128 KB" for a small game, "3.2 of 8.0 MB" for a large one.
  const amount = (got, size) => size < 1048576 ? Math.round(got / 1024) + ' of ' + Math.max(1, Math.round(size / 1024)) + ' KB' : mb(got) + ' of ' + mb(size) + ' MB';
  function paint() {
    if (!loads.size) { hide(); return; }
    const now = performance.now();
    let oldest = Infinity, got = 0, size = 0, unknown = false;
    for (const l of loads.values()) { oldest = Math.min(oldest, l.t0); got += l.got; if (l.size > 0) size += l.size; else unknown = true; }
    if (now - oldest < SHOW_AFTER_MS) { clearTimeout(timer); timer = setTimeout(paint, SHOW_AFTER_MS - (now - oldest) + 10); return; }
    const b = ensure();
    const known = !unknown && size > 0;
    b.classList.toggle('lb-unknown', !known);
    const pct = known ? Math.max(0, Math.min(100, got / size * 100)) : 0;
    b.querySelector('.lb-fill').style.width = known ? pct.toFixed(1) + '%' : '';
    b.querySelector('.lb-n').textContent = known ? amount(got, size) : got ? (got < 1048576 ? Math.round(got / 1024) + ' KB' : mb(got) + ' MB') : '';
    if (known) { b.setAttribute('aria-valuemin', '0'); b.setAttribute('aria-valuemax', '100'); b.setAttribute('aria-valuenow', String(Math.round(pct))); }
    else { b.removeAttribute('aria-valuenow'); }
    b.hidden = false;
  }
  function hide() { clearTimeout(timer); timer = 0; if (el) el.hidden = true; }

  /* The open API (Play a file, and anything else that reads a game). */
  function start(size, key) {
    const k = key || ('l' + (++seq));
    loads.set(k, { got: 0, size: size > 0 ? size : 0, t0: performance.now() });
    paint();
    return k;
  }
  function step(k, got, size) {
    const l = loads.get(k); if (!l) return;
    l.got = got; if (size > 0) l.size = size;
    if (el && !el.hidden) paint();
  }
  function done(k) { if (loads.delete(k)) paint(); }

  /* The game server's downloads (cws.js events). */
  const sk = d => 'cws:' + (d && (d.id || d.sha256) || '');
  /* download-wait: asked for and not cached (it may wait behind the wall's own loads);
     download-from: a server starts sending it (again from where the last one stopped). */
  for (const t of ['cws:download-wait', 'cws:download-from']) window.addEventListener(t, e => {
    const d = e.detail || {};
    if (!playOpen()) return;
    /* Only the game being played: the wall's own live tiles keep loading theirs behind the window
       (seen in testing: a bar for each of them). index.html's _openPlayDeviceId is that game. */
    let cur = null; try { cur = typeof _openPlayDeviceId !== 'undefined' ? _openPlayDeviceId : null; } catch (x) { cur = null; }   // eslint-disable-line no-undef
    if (!cur || d.id !== cur) return;
    const k = sk(d), l = loads.get(k);
    if (l) { l.got = d.from || 0; if (d.size > 0) l.size = d.size; return; }   // the next server, where the last one stopped
    loads.set(k, { got: d.from || 0, size: d.size > 0 ? d.size : 0, t0: performance.now() });
    paint();
  });
  window.addEventListener('cws:progress', e => { const d = e.detail || {}; const k = sk(d); if (loads.has(k)) step(k, d.got || 0, d.size || 0); });
  for (const t of ['cws:verified', 'cws:download-failed']) window.addEventListener(t, e => done(sk(e.detail || {})));

  /* The play window closed: nothing of it is loading any more as far as the bar is concerned. */
  function watchWindows() {
    const mo = new MutationObserver(() => { if (loads.size && !playOpen()) { loads.clear(); hide(); } });
    document.querySelectorAll('#play-overlay, [id$="-play-overlay"]').forEach(o => mo.observe(o, { attributes: true, attributeFilter: ['class'] }));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchWindows, { once: true }); else watchWindows();

  window.CwLoadBar = { start, step, done, _state: () => ({ loads: Array.from(loads.entries()), shown: !!(el && !el.hidden) }) };
})();

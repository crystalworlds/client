/*
 * case3d.js -- the case beside a drawer (21 Nov 2026; design: the drawer design note, sections 4 to 7).
 *
 * The picture that slides in from the left beside a game drawer or a film drawer is the game's box
 * or the film's case, drawn in 3D: the front with the cover, the spine on the left with the spine
 * picture (from the system's spine bucket, else drawn here from the cover and the title), and the
 * rest of the box in the cover's edge colour or the case's plastic. Its shape is one of the measured
 * templates in firmware/boxes (manifest.json says which system and region takes which). Game & Watch
 * units are not here: their slide-in is unchanged.
 *
 * THE SAME MOTION AND THE SAME SHINE AS THE FLAT PICTURE.
 *   - The slide stays CSS on the card (case-slide-in / case-slide-out, over --drawer-out, the curves
 *     of device-stage-reveal and device-stage-hide). The turn is drawn on the same curve: in from the
 *     left, flat by 48%, then the slow turn to 20 degrees; reversed on close (flat by 52%).
 *   - Turned by the mouse once settled: rotateY(20 + dx x 14) rotateX(-dy x 14), 6 to 34 degrees
 *     across and 14 up or down about the rest, so the back can never face you; off the case it eases
 *     back in 0.2 s (CSS 'ease'). Never under reduced motion. mousemove and mouseleave, as today, so
 *     a browser that reports no hover (a desk Chrome read as a television) still turns it.
 *   - The shine is today's streak (case3d-gl.mjs draws it on the case's faces): resting at 10%,
 *     moved by 34% of the turn, easing over 0.18 s (CSS 'ease-out').
 *   - A click on the case does nothing; on the clear space round it the drawer closes.
 *
 * LOADING AND MEMORY. three.js loads only when a case is about to show on a wide window (the stage is
 * hidden at 1400 px and under for games and 980 px and under for films: no case and no three.js
 * there). The flat cover slides in at once and the case takes over when it is ready, so nothing
 * waits on it. One canvas for the page, drawing only while something moves; four cases' pictures
 * kept. If the browser takes the canvas away, the flat picture is used for the rest of the page load.
 *
 * NO WEBGL (or only a software one), or ?case=flat on the address (held for the tab; ?case=3d ends
 * it): games show their front cover flat on the same card, with the same turn and shine done by CSS;
 * films keep their poster card exactly as before (emby.js asks CwCase.wanted() first).
 *
 * SOUND: none. Nothing here makes a sound.
 */
(function () {
  'use strict';
  if (window.CwCase) return;
  const V = '2.3.0-boxsite4';
  const PX_PER_MM = 720 / 190;          // one scale for every case: a DVD case 720 px tall, as the film poster was
  const PERSP = 1400, REST = 20, MAXT = 14, REST_SHEEN = 0.10, SHEEN_PER = 0.34;
  /* gnwStageFit's turns: the rest, straight on the way in, and the furthest the mouse can reach
     (rotateY() rotateX(): X applied first, so false). The films' poster list, unchanged. */
  const POSES = [[0, 20, false], [0, 0, false], [14, 34, false], [-14, 34, false], [14, 6, false], [-14, 6, false]];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ?case=flat: the flat path for checking (held for the tab's visit, as ?nowelcome=1 is); ?case=3d ends it. */
  let flatForced = false;
  try {
    const q = new URLSearchParams(location.search).get('case');
    if (q === 'flat') sessionStorage.setItem('cw.test.caseflat', '1');
    else if (q === '3d' || q === 'auto') sessionStorage.removeItem('cw.test.caseflat');
    flatForced = sessionStorage.getItem('cw.test.caseflat') === '1';
  } catch (_) { flatForced = /[?&]case=flat\b/.test(location.search); }

  /* WebGL alone decides (not TV mode: a desk Chrome can read as a television), and only a real one:
     a software renderer counts as none. */
  let _webgl = null;
  function webgl() {
    if (_webgl !== null) return _webgl;
    if (flatForced) return (_webgl = false);
    try {
      const c = document.createElement('canvas'), o = { failIfMajorPerformanceCaveat: true };
      const g = c.getContext('webgl2', o) || c.getContext('webgl', o);
      if (!g) return (_webgl = false);
      const dbg = g.getExtension('WEBGL_debug_renderer_info');
      const name = dbg ? String(g.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
      const lose = g.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      _webgl = !/swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
    } catch (_) { _webgl = false; }
    return _webgl;
  }
  let GL = null, glP = null, glDead = false;
  function loadGL() {
    if (glP) return glP;
    glP = import('./case3d-gl.mjs?v=' + V).then(m => { if (!m.ok()) throw new Error('no WebGL'); GL = m; return m; })
      .catch(e => { glDead = true; console.warn('[case] flat pictures only:', e && e.message); return null; });
    return glP;
  }
  const glWanted = () => !glDead && webgl();

  let manP = null, MAN = null;
  function manifest() {
    if (!manP) manP = fetch('firmware/boxes/manifest.json?v=' + V).then(r => (r.ok ? r.json() : null)).then(m => (MAN = m)).catch(() => null);
    return manP;
  }

  /* ------------------------------------------------------------ the warm-up (22 Nov 2026)
     "Can't we preload the 3D box and have it slide in as 3D?" Once per page, at idle, on a wide window with WebGL:
     the manifest, three.js, the one canvas, all 18 templates parsed, and every shader the cases use compiled with a
     dummy box, drawn to nothing. One step per idle moment, never while the page scrolls, so the wall keeps its frames.
     A drawer opened before it has finished runs the rest at once and shows its box when ready (never the flat card). */
  let warmP = null, lastMove = 0; const warmLog = [];   // each warm-up step's time, for the test pages
  ['scroll', 'wheel', 'touchmove'].forEach(t => window.addEventListener(t, () => { lastMove = performance.now(); }, { capture: true, passive: true }));
  const idle = fn => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 60));
  function ensureWarm(now) {
    if (warmP) { if (now) warmP.hurry(); return warmP; }
    let hurry = !!now, wake = null;
    const calm = () => new Promise(r => { wake = r; const go = () => (hurry || performance.now() - lastMove > 500 ? r() : setTimeout(() => idle(go), 250)); idle(go); });
    warmP = (async () => {
      const man = await manifest();
      if (!man) throw new Error('no manifest');
      if (!hurry) await calm();   // three.js is read in one piece (about 50 ms): also only while nothing moves
      wake = null;
      const a0 = performance.now();
      const m = await loadGL();
      warmLog.push(+(performance.now() - a0).toFixed(1));
      if (!m) throw new Error('no WebGL');
      for (const step of m.warmSteps(man)) {
        if (!hurry) await calm();
        wake = null;
        const a = performance.now();
        await step();
        warmLog.push(+(performance.now() - a).toFixed(1));
      }
      return m;
    })();
    warmP.hurry = () => { hurry = true; if (wake) wake(); };
    warmP.catch(e => { glDead = true; console.warn('[case] flat pictures only:', e && e.message); });
    return warmP;
  }
  function scheduleWarm() {
    if (flatForced || !webgl() || window.innerWidth <= 980) return;
    setTimeout(() => idle(() => ensureWarm(false)), 1200);
  }
  if (document.readyState === 'complete') scheduleWarm(); else window.addEventListener('load', scheduleWarm, { once: true });

  /* ------------------------------------------------------------ which box */
  /* East (Japan, Korea) or west from the file's No-Intro regions, the first bracket that is all region names. */
  const REGIONS = new Set(['USA', 'Europe', 'Japan', 'World', 'Korea', 'Brazil', 'Asia', 'Australia', 'Germany', 'France', 'Spain', 'Italy', 'Sweden',
    'Netherlands', 'Canada', 'China', 'Taiwan', 'Hong Kong', 'UK', 'Scandinavia', 'Russia', 'Portugal', 'Greece', 'Denmark', 'Finland', 'Norway', 'Poland', 'Unknown']);
  function eastern(d, man) {
    const s = String((d && (d.fullName || d.name)) || '');
    const east = new Set((man && man.east) || ['Japan', 'Korea']);
    /* The old one-letter codes of GoodTools names ("(J)", "(U)", "(JU)", "(Sw)"), from the manifest's region_codes:
       a bracket made only of known codes reads like the region words (22 Nov 2026, the Nintendo 64's older names). */
    const codes = (man && man.region_codes) || {};
    const fromCodes = t => { const ps = /^(?:[A-Z][a-z]{0,2}){1,4}$/.test(t) ? t.match(/[A-Z][a-z]{0,2}/g) : null; return ps && ps.every(c => codes[c]) ? ps.map(c => codes[c]) : null; };
    const brackets = []; const re = /\(([^()]+)\)/g; let m;
    while ((m = re.exec(s))) brackets.push(m[1].split(',').map(x => x.trim()).filter(Boolean));
    for (const parts of brackets) if (parts.length && parts.every(x => REGIONS.has(x))) return parts.every(x => east.has(x));
    /* the codes only when no bracket names regions in words: "3 in 1 (A) (Korea)" keeps its (A) as a version letter */
    for (const parts of brackets) { const old = parts.length === 1 ? fromCodes(parts[0]) : null; if (old) return old.every(x => east.has(x)); }
    if (Array.isArray(d && d.regions) && d.regions.length) return d.regions.every(r => east.has(String(r.region || '').trim()));
    return false;
  }
  function gameTemplate(d, man) {
    if (!man || !d) return null;
    const P = man.pick || {}, c = d.catalogue;
    const two = (row) => row && (typeof row === 'string' ? row : (eastern(d, man) ? row.east : row.west));
    let id = null;
    if (c === 'nes') id = (P.nes || {})[d.nesConsole || 'nes'] || (P.nes || {}).nes;
    else if (c === 'game-boy') id = two(P.gb);
    else if (c === 'pokemon-mini') id = P.pm;
    else id = two(P[c]);
    return id && man.templates[id] ? id : null;
  }
  /* Films: the copy Play would play (its first source), by the 4K filter's rule: at least 3200 wide or
     1600 high is 4K (black); the 720p class and up is Blu-ray (blue); smaller is DVD (black). */
  function filmKind(src) {
    const v = src && (src.MediaStreams || []).find(s => s && s.Type === 'Video');
    if (!v || !(v.Width || v.Height)) return null;
    const w = v.Width || 0, h = v.Height || 0;
    if (w >= 3200 || h >= 1600) return '4k';
    const px = Math.max(w, Math.round(h * 16 / 9));   // emby.js resLabel's class, 16:9-equivalent width
    return px >= 1260 ? 'bluray' : 'dvd';
  }
  const FILM_KEY = 'cw.case.film.v1';
  function filmRemembered(id) { try { return (JSON.parse(localStorage.getItem(FILM_KEY) || '{}') || {})[id] || null; } catch (_) { return null; } }
  function filmRemember(id, kind) {
    try {
      const m = JSON.parse(localStorage.getItem(FILM_KEY) || '{}') || {};
      delete m[id]; m[id] = kind;
      const ks = Object.keys(m); while (ks.length > 600) delete m[ks.shift()];
      localStorage.setItem(FILM_KEY, JSON.stringify(m));
    } catch (_) {}
  }

  /* ------------------------------------------------------------ curves */
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = t => ((ax * t + bx) * t + cx) * t, Y = t => ((ay * t + by) * t + cy) * t, dX = t => (3 * ax * t + 2 * bx) * t + cx;
    return x => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) { const e = X(t) - x, d = dX(t); if (Math.abs(e) < 1e-6) break; if (Math.abs(d) < 1e-6) break; t -= e / d; }
      if (t < 0 || t > 1 || Math.abs(X(t) - x) > 1e-4) { let lo = 0, hi = 1; t = x; for (let i = 0; i < 30; i++) { if (X(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; } }
      return Y(t);
    };
  }
  const EZ_IN = bezier(.2, .75, .25, 1), EZ_OUT = bezier(.35, 0, .35, 1), EZ_EASE = bezier(.25, .1, .25, 1), EZ_EOUT = bezier(0, 0, .58, 1);
  /* The turn the CSS keyframes give at a point of the slide (device-stage-reveal / -hide). */
  const turnIn = p => (p <= 0.48 ? 0 : REST * EZ_IN((p - 0.48) / 0.52));
  const turnOut = p => (p >= 0.52 ? 0 : REST + (0 - REST) * EZ_OUT(p / 0.52));

  /* ------------------------------------------------------------ the card */
  function styles() {
    if (document.getElementById('case3d-css')) return;
    const st = document.createElement('style');
    st.id = 'case3d-css';
    st.textContent = `
      .case-card { position: relative; flex: none; width: var(--fit-w, 360px); height: var(--fit-h, 480px); pointer-events: none;
        perspective: ${PERSP}px; transform: translateX(-160%); opacity: 0; transition: opacity .35s ease; }
      :is(#device-stage, #video-stage).open .case-card { animation: case-slide-in var(--drawer-out, 1.4s) cubic-bezier(.2,.75,.25,1) forwards; }
      :is(#device-stage, #video-stage).open .case-card .case-flat { animation: case-turn-in var(--drawer-out, 1.4s) cubic-bezier(.2,.75,.25,1) forwards; }
      .case-card.settled { animation: none !important; transform: none; opacity: 1; }
      .case-card.settled .case-flat { animation: none !important; transform: rotateY(20deg); transition: transform .2s ease; }
      .case-card.leaving { animation: case-slide-out var(--drawer-out, 1.4s) cubic-bezier(.35,0,.35,1) forwards !important; }
      .case-card.leaving .case-flat { animation: case-turn-out var(--drawer-out, 1.4s) cubic-bezier(.35,0,.35,1) forwards !important; }
      @keyframes case-slide-in { 0% { transform: translateX(-160%); opacity: 0; } 10% { opacity: 1; } 48% { transform: translateX(0); } 100% { transform: translateX(0); opacity: 1; } }
      @keyframes case-turn-in { 0% { transform: rotateY(0deg); } 48% { transform: rotateY(0deg); } 100% { transform: rotateY(20deg); } }
      @keyframes case-slide-out { 0% { transform: translateX(0); opacity: 1; } 52% { transform: translateX(0); } 90% { opacity: 1; } 100% { transform: translateX(-160%); opacity: 0; } }
      @keyframes case-turn-out { 0% { transform: rotateY(20deg); } 52% { transform: rotateY(0deg); } 100% { transform: rotateY(0deg); } }
      /* the flat picture: the cover (a film's poster card, as before) */
      .case-flat { position: absolute; inset: 0; pointer-events: auto; cursor: default; transform: rotateY(0deg); --sheen: 10%;
        border-radius: 3px; overflow: hidden; box-shadow: 0 30px 60px -24px rgba(0,0,0,.7); transition: opacity .25s ease; }
      .case-card[data-kind="film"] .case-flat { border-radius: 12px; box-shadow: 0 40px 80px -20px rgba(0,0,0,.85); }
      .case-flat > img { position: absolute; inset: 0; width: 100%; height: 100%; display: block; object-fit: fill; -webkit-user-drag: none; }
      .case-card[data-kind="film"] .case-flat > img { object-fit: cover; }
      .case-flat:not(.ready) { visibility: hidden; }   /* nothing shows (no shadow, no streak on an empty card) until the picture is there */
      /* the same streak as .stage-sheen and .vstage-sheen */
      .case-flat > .case-sheen { position: absolute; inset: 0; z-index: 3; pointer-events: none;
        background-image: linear-gradient(105deg, rgba(255,255,255,0) 40%, rgba(255,255,255,.10) 47%, rgba(255,255,255,.30) 50%, rgba(255,255,255,.10) 53%, rgba(255,255,255,0) 60%);
        background-repeat: no-repeat; background-size: 250% 100%; background-position: calc(50% + var(--sheen, 10%)) 0;
        mix-blend-mode: screen; transition: background-position .18s ease-out; }
      .case-flat > .gb-art-generic-label { z-index: 2; }
      /* No filter and no background on the canvas: it is cleared to fully clear, shown only once its first frame
         is drawn, and nothing round it is redrawn while it turns. */
      .case-card > canvas.case-gl { position: absolute; pointer-events: auto; cursor: default; opacity: 0; transition: opacity .2s ease; background: transparent; }
      .case-card.gl-on > canvas.case-gl { opacity: 1; }
      .case-card.gl-on > .case-flat, .case-card.gl-wait > .case-flat { opacity: 0; visibility: hidden; pointer-events: none; }
      .case-card.gl-now > canvas.case-gl, .case-card.gl-now > .case-flat { transition: none; }
      @media (prefers-reduced-motion: reduce) {
        .case-card, .case-card .case-flat { animation: none !important; }
        :is(#device-stage, #video-stage).open .case-card { transform: none; opacity: 1; }
        .case-card .case-flat { transform: rotateY(20deg); }
        .case-card.leaving { transform: none; opacity: 0; transition: opacity .3s ease; }
        .case-flat > .case-sheen { transition: none; }
      }`;
    document.head.appendChild(st);
  }

  const S = new Map();     // stage element -> its state

  /* The case's furthest painted reach from the card's centre at every pose (CSS px), for the canvas's size:
     the corners projected with the stage's perspective, the box turning about its own centre, which sits
     half its depth behind the card's plane. */
  function reach(w, h, d) {
    let mx = 0, my = 0;
    for (const [ax, ay] of POSES) {
      const a = ax * Math.PI / 180, b = ay * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      for (const x0 of [-w / 2, w / 2]) for (const y0 of [-h / 2, h / 2]) for (const z0 of [-d / 2, d / 2]) {
        let y = y0 * ca - z0 * sa, z = y0 * sa + z0 * ca;
        const x = x0 * cb + z * sb; z = -x0 * sb + z * cb;
        z -= d / 2;
        const s = PERSP / (PERSP - z);
        mx = Math.max(mx, Math.abs(x * s)); my = Math.max(my, Math.abs(y * s));
      }
    }
    return [mx, my];
  }

  function size(st) {
    const card = st.card;
    let aspect = 2 / 3, normalH = 720, depth = 0;
    if (st.info) {
      aspect = st.info.front_art_mm[0] / st.info.front_art_mm[1];
      normalH = st.info.front_art_mm[1] * PX_PER_MM;
      depth = st.info.size_mm[2] / st.info.front_art_mm[1];
    }
    if (st.flatOnly && st.info && st.picAspect) {   // the picture's own shape, its longer side the box front's longer side
      const big = Math.max(st.info.front_art_mm[0], st.info.front_art_mm[1]) * PX_PER_MM;
      aspect = st.picAspect; depth = 0;
      normalH = aspect >= 1 ? big / aspect : big;
    }
    st.aspect = aspect; st.depthR = depth;
    if (window.gnwStageFit) window.gnwStageFit(card, aspect, POSES, normalH, depth);
    else { card.style.setProperty('--fit-h', normalH + 'px'); card.style.setProperty('--fit-w', (normalH * aspect) + 'px'); }
  }

  function layoutGL(st) {
    if (!st.res || !st.canvas) return;
    const w = st.card.offsetWidth, h = st.card.offsetHeight;
    if (!w || !h) return;
    const d = st.depthR * h;
    const [rx, ry] = reach(w, h, d);
    const cw = Math.ceil(2 * rx + 16), ch = Math.ceil(2 * ry + 16);
    st.canvas.style.left = ((w - cw) / 2) + 'px';
    st.canvas.style.top = ((h - ch) / 2) + 'px';
    GL.show(st.res, { cssW: cw, cssH: ch, frontPx: w });
    st.layoutW = w; st.layoutH = h;
    st.drawn = null;
    frame(st);          // drawn at once: a resized canvas is cleared, and must not show empty for a frame
    kick(st);
  }

  /* ------------------------------------------------------------ the pose, frame by frame (GL only) */
  /* THE SLIDE'S CLOCK. The turn follows the card's CSS animation, timed from its animationstart and its duration
     (--drawer-out, read once), so no frame asks the browser for its animations (which would cost a style pass on a
     large page). A paused animation (the test pages) is still read from the browser. */
  function animOf(card) {
    const c = card.__clk;
    if (!c) return null;
    if (c.paused) {
      try {
        const a = card.getAnimations().find(x => x.animationName === c.name);
        if (a) { const d = a.effect.getComputedTiming().duration || c.dur; return { out: c.name === 'case-slide-out', p: Math.max(0, Math.min(1, (a.currentTime || 0) / d)), running: false }; }
      } catch (_) {}
    }
    const p = c.dur ? Math.max(0, Math.min(1, (performance.now() - c.t0) / c.dur)) : 1;
    return { out: c.name === 'case-slide-out', p, running: p < 1 };
  }
  function clockOn(card, name) {
    const v = parseFloat(getComputedStyle(card).animationDuration) || 1.4;
    card.__clk = { name, t0: performance.now(), dur: v * 1000 };
  }
  function now() { return performance.now(); }
  function pose(st) {
    if (reduce.matches) return { ry: REST, rx: 0, sh: REST_SHEEN, more: false };
    const a = animOf(st.card);
    if (a && !st.card.classList.contains('settled')) {
      const ry = a.out ? turnOut(a.p) : turnIn(a.p);
      return { ry, rx: 0, sh: REST_SHEEN, more: a.running || a.p < 1 };
    }
    if (st.phase === 'out') return { ry: 0, rx: 0, sh: REST_SHEEN, more: false };
    if (st.phase === 'in') return { ry: 0, rx: 0, sh: REST_SHEEN, more: true };   // before the animation has begun
    const t = now(), tw = st.tw, ts = st.ts;
    let ry = REST, rx = 0, sh = REST_SHEEN, more = false;
    if (tw) { const k = Math.min(1, (t - tw.t0) / 200), e = EZ_EASE(k); ry = tw.f[0] + (tw.to[0] - tw.f[0]) * e; rx = tw.f[1] + (tw.to[1] - tw.f[1]) * e; if (k < 1) more = true; }
    if (ts) { const k = Math.min(1, (t - ts.t0) / 180), e = EZ_EOUT(k); sh = ts.f + (ts.to - ts.f) * e; if (k < 1) more = true; }
    return { ry, rx, sh, more };
  }
  function frame(st) {
    const p = pose(st);
    if (st.mode === 'gl' && st.res && GL && GL.fading(st.res)) { p.more = true; st.drawn = null; }
    st.cur = p;
    if (st.mode === 'gl' && st.res && GL) {
      const key = p.ry.toFixed(3) + ',' + p.rx.toFixed(3) + ',' + p.sh.toFixed(4);
      if (st.drawn !== key) { if (GL.draw(st.res, p.ry, p.rx, p.sh)) { st.drawn = key; st.frames = (st.frames || 0) + 1; } }
    }
    return p.more;
  }
  function kick(st) {
    if (st.raf || st.mode !== 'gl') return;
    const c = st.card.__clk;
    if (c && !c.paused && c.name === 'case-slide-in' && st.drawn && !(st.res && GL && GL.fading(st.res))) {
      const wait = c.t0 + c.dur * 0.48 - performance.now() - 20;
      if (wait > 30) { st.raf = -1; setTimeout(() => { st.raf = 0; kick(st); }, wait); return; }
    }
    const step = () => {
      st.raf = 0;
      if (S.get(st.stage) !== st || st.mode !== 'gl') return;
      if (frame(st)) st.raf = requestAnimationFrame(step);
    };
    st.raf = requestAnimationFrame(step);
  }
  function target(st, ry, rx, sh) {
    const cur = st.cur && !st.card.classList.contains('leaving') ? st.cur : { ry: REST, rx: 0, sh: REST_SHEEN };
    const t = now();
    if (!st.tw || st.tw.to[0] !== ry || st.tw.to[1] !== rx) st.tw = { f: [cur.ry, cur.rx], to: [ry, rx], t0: t };
    if (!st.ts || st.ts.to !== sh) st.ts = { f: cur.sh, to: sh, t0: t };
    if (st.mode === 'gl') kick(st);
    else {
      st.flat.style.transform = 'rotateY(' + ry.toFixed(2) + 'deg) rotateX(' + rx.toFixed(2) + 'deg)';
      st.flat.style.setProperty('--sheen', (sh * 100).toFixed(1) + '%');
    }
  }
  function rest(st) {
    if (st.mode === 'gl') target(st, REST, 0, REST_SHEEN);
    else { st.flat.style.transform = ''; st.flat.style.removeProperty('--sheen'); st.tw = st.ts = null; }
  }

  /* ------------------------------------------------------------ pointer */
  function onCase(st, e) {
    if (st.mode === 'gl' && st.res && GL) {
      const r = st.canvas.getBoundingClientRect();
      return GL.hit(st.res, e.clientX - r.left, e.clientY - r.top);
    }
    return !!(e.target && e.target.closest && e.target.closest('.case-flat'));
  }
  function wire(st) {
    const card = st.card;
    card.addEventListener('animationstart', e => {
      if (e.target !== card || (e.animationName !== 'case-slide-in' && e.animationName !== 'case-slide-out')) return;
      clockOn(card, e.animationName);
      kick(st);
    });
    card.addEventListener('animationend', e => {
      if (e.target !== card) return;
      if (e.animationName === 'case-slide-in' || e.animationName === 'case-slide-out') card.__clk = null;
      if (e.animationName === 'case-slide-in') { card.classList.add('settled'); st.phase = 'rest'; st.cur = { ry: REST, rx: 0, sh: REST_SHEEN }; kick(st); if (st.onSettle) { const f = st.onSettle; st.onSettle = null; setTimeout(f, 0); } }
      if (e.animationName === 'case-slide-out') kick(st);
    });
    let raf = 0, ev = null;
    const apply = () => {
      raf = 0;
      if (!ev || st.phase !== 'rest' || reduce.matches || S.get(st.stage) !== st) return;
      if (!onCase(st, ev)) { rest(st); return; }
      const r = card.getBoundingClientRect();
      const cl = v => Math.max(-1, Math.min(1, v));
      const dx = cl((ev.clientX - (r.left + r.width / 2)) / (r.width / 2)), dy = cl((ev.clientY - (r.top + r.height / 2)) / (r.height / 2));
      target(st, REST + dx * MAXT, -dy * MAXT, REST_SHEEN + dx * SHEEN_PER);
    };
    card.addEventListener('mousemove', e => { ev = e; if (!raf) raf = requestAnimationFrame(apply); });
    card.addEventListener('mouseleave', () => { ev = null; if (st.phase === 'rest') rest(st); });
  }
  /* A click on the canvas: on the case, nothing (as before); on the clear space round it, the drawer closes.
     Heard on the window in the capture phase, before the page's own document-wide click handlers (one of them
     stops clicks on a canvas from going further). */
  window.addEventListener('click', e => {
    for (const st of S.values()) {
      if (st.mode !== 'gl' || !st.canvas || e.target !== st.canvas) continue;
      if (onCase(st, e)) return;
      e.stopPropagation();
      if (typeof st.onClose === 'function') st.onClose();
      return;
    }
  }, true);

  /* ------------------------------------------------------------ the case takes over */
  /* THE CASE FROM FRAME ONE. With the warm-up done and the template known, the case is made at once: with its cover and
     spine when they were fetched ahead (hover, focus or the click on the tile), else with a printed face that the real
     cover cross-fades onto when it arrives. A WebGL device never shows the flat card (it waits, empty, in the rare case
     the warm-up has not finished). */
  function specOf(st, fr, spines) {
    const sp = spines || [];
    return { template: st.template, info: st.info, front: [fr.url], frontMode: st.frontMode || 'fill', generic: fr.generic || null,
      spines: sp, spineFill: st.spineFill || null, title: st.title || '', artKey: fr.url + '#' + sp.join('|') + '#' + (fr.generic ? 'g' : ''),
      key: [st.kind, st.template, fr.url, sp.join('|'), st.title].join('#') };
  }
  function startGL(st) {
    if (!st.wantGL || st.flatOnly || !st.info || !st.template || glDead) return;
    if (!GL || !GL.isWarm()) { const tok = st.tok; ensureWarm(true).then(() => { if (S.get(st.stage) === st && st.tok === tok) startGL(st); }).catch(() => { if (S.get(st.stage) === st) toFlat(st); }); return; }
    const tok = st.tok;
    const known = st.frontKnown ? specOf(st, st.frontKnown, st.spinesKnown) : null;
    const A = known ? GL.artNow(known.artKey) : null;
    let res = known && A ? GL.quick(known, A) : null;
    if (!res) res = GL.quick({ template: st.template, info: st.info, title: st.title || '', key: '__face__#' + st.template + '#' + tok }, null);
    if (!res) { st.glFail = 'template not ready'; return; }
    for (const o of S.values()) if (o !== st && o.mode === 'gl') toFlat(o);   // one canvas: it moves here
    const was = st.mode === 'gl' && st.canvas && st.canvas.parentNode === st.card;
    st.res = res;
    if (!was) { st.canvas = GL.canvasEl(); st.card.classList.add('gl-now'); st.card.appendChild(st.canvas); }
    st.mode = 'gl';
    layoutGL(st);
    frame(st);
    st.card.classList.add('gl-on'); st.card.classList.remove('gl-wait');
    if (!was) requestAnimationFrame(() => requestAnimationFrame(() => st.card.classList.remove('gl-now')));
    kick(st);
    if (res.placeholder) {
      Promise.all([st.frontP, Promise.resolve(st.spinesP).catch(() => [])]).then(([fr, sp]) => {
        if (!fr || !fr.url || S.get(st.stage) !== st || st.tok !== tok || st.res !== res) return;
        return GL.fill(res, specOf(st, fr, sp)).then(ok => { if (ok && st.res === res) { st.drawn = null; kick(st); } });
      }).catch(() => {});
    }
  }
  function toFlat(st) {
    if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; }
    st.mode = 'flat';
    st.card.classList.remove('gl-on');
    if (st.canvas && st.canvas.parentNode === st.card) st.card.removeChild(st.canvas);
    st.canvas = null; st.res = null;
  }
  window.addEventListener('cw-case-lost', () => { glDead = true; for (const st of S.values()) toFlat(st); });

  /* Keep the canvas sized to its card (a window resize refits the card through gnwStageFit). */
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(es => {
    for (const e of es) for (const st of S.values()) if (st.card === e.target && st.mode === 'gl' && (st.card.offsetWidth !== st.layoutW || st.card.offsetHeight !== st.layoutH)) layoutGL(st);
  }) : null;

  /* The stage closing (hideDeviceStage, closeVideo): the case turns back and slides out. */
  function watch(stage) {
    if (stage.__cwCase) return;
    stage.__cwCase = true;
    new MutationObserver(() => {
      const st = S.get(stage);
      if (!st || stage.classList.contains('open') || st.phase === 'out') return;
      st.phase = 'out';
      st.tw = st.ts = null;
      st.flat.style.transform = ''; st.flat.style.removeProperty('--sheen');
      st.card.classList.remove('settled');
      st.card.classList.add('leaving');
      st.drawn = null;
      kick(st);
    }).observe(stage, { attributes: true, attributeFilter: ['class'] });
  }

  /* ------------------------------------------------------------ the API */
  /* spec: { kind: 'game' | 'film', template (an id from manifest.json, or null while not known), title,
     front: Promise<{ url, generic? } | null> or that object, spines: Promise<[url]> or [url], frontMode ('fill', 'trim'),
     spineFill, flatSrc (a picture to show flat at once; else the front's), onClose } */
  let _tok = 0;
  function show(stage, spec) {
    if (!stage) return null;
    styles(); watch(stage);
    const old = S.get(stage);
    if (old) { if (old.raf) cancelAnimationFrame(old.raf); if (old.mode === 'gl') toFlat(old); if (ro) ro.unobserve(old.card); }
    const st = { stage, kind: spec.kind || 'game', tok: ++_tok, phase: reduce.matches ? 'rest' : 'in', mode: 'flat', title: spec.title || '',
      frontP: Promise.resolve(spec.front), spinesP: Promise.resolve(spec.spines || []), frontMode: spec.frontMode, spineFill: spec.spineFill,
      onClose: spec.onClose, template: null, info: null, frames: 0, frontUrl: spec.front && spec.front.url || null,
      wantGL: glWanted() && !spec.flat, frontKnown: spec.frontNow || null, spinesKnown: spec.spinesNow || null };
    S.set(stage, st);
    const card = document.createElement('div');
    card.className = 'case-card' + (reduce.matches ? ' settled' : '') + (st.wantGL ? ' gl-wait' : '');
    card.dataset.kind = st.kind;
    const flat = document.createElement('div');
    flat.className = 'case-flat';
    const img = document.createElement('img');
    img.alt = ''; img.decoding = 'async'; img.draggable = false;
    img.addEventListener('load', () => { if (img.naturalWidth) flat.classList.add('ready'); });
    if (st.kind === 'film') img.crossOrigin = 'anonymous';
    const sheen = document.createElement('div');
    sheen.className = 'case-sheen';
    flat.appendChild(img); flat.appendChild(sheen);
    card.appendChild(flat);
    st.card = card; st.flat = flat; st.img = img;
    stage.innerHTML = '';
    stage.appendChild(card);
    size(st);
    if (spec.flatSrc) img.src = spec.flatSrc;
    Promise.resolve(st.spinesP).then(sp => { if (S.get(stage) === st) st.spinesKnown = sp || []; }).catch(() => {});
    st.frontP.then(fr => {
      if (fr && fr.url) { st.frontNow = fr.url; st.generic = !!fr.generic; st.frontKnown = fr; }
      if (S.get(stage) !== st || !fr || !fr.url) return;
      if (!spec.flatSrc || spec.flatUpgrade) {
        const up = new Image(); if (st.kind === 'film') up.crossOrigin = 'anonymous';
        up.onload = () => { if (S.get(stage) === st) { img.src = fr.url; if (fr.generic && window.cwGenericLabel) requestAnimationFrame(() => { try { window.cwGenericLabel(flat, fr.generic.shelf, fr.generic.id, 0); } catch (_) {} }); } };
        up.src = fr.url;
      }
    });
    wire(st);
    if (ro) ro.observe(card);
    stage.classList.remove('open');
    void card.offsetWidth;
    stage.classList.add('open');
    setTemplate(st, spec.template);
    return st;
  }
  function setTemplate(st, id) {
    if (!id || st.template === id) return;
    const go = man => {
      if (!man || !man.templates[id] || S.get(st.stage) !== st) return;
      st.template = id; st.info = man.templates[id];
      size(st);
      startGL(st);
    };
    if (MAN) go(MAN); else manifest().then(go);
  }
  /* A film's case once its full record (or its first episode) has arrived. */
  function update(stage, spec) {
    const st = S.get(stage);
    if (!st) return;
    let again = false;
    if (spec.front && spec.front.url && spec.front.url !== st.frontUrl) {
      st.frontUrl = spec.front.url; st.frontP = Promise.resolve(spec.front); if (spec.frontMode) st.frontMode = spec.frontMode;
      again = !!st.template;
    }
    if (spec.template && spec.template !== st.template) setTemplate(st, spec.template);
    else if (again && st.mode === 'gl' && st.res && GL) {   // a better front (a film's Box picture): cross-faded onto the case
      const res = st.res; st.frontKnown = spec.front;
      Promise.resolve(st.spinesP).then(sp => { if (st.res !== res) return; res.placeholder = true; return GL.fill(res, specOf(st, spec.front, sp || [])).then(() => { st.drawn = null; kick(st); }); }).catch(() => {});
    }
  }
  function stateOf(stage) { return S.get(stage) || null; }

  /* A game drawer's case: the template from the game's system and region; front, spines and title from the drawer. */
  function showGame(stage, d, parts) {
    const flat = MAN ? isFlat(MAN, parts.key) : false;
    const st = show(stage, { kind: 'game', title: parts.title || (d && d.name) || '', front: parts.front, spines: parts.spines,
      frontNow: parts.frontNow, spinesNow: parts.spinesNow, flat, spineFill: parts.spineFill, onClose: parts.onClose, template: null });
    const go = man => {
      if (S.get(stage) !== st) return;
      st.flatOnly = isFlat(man, parts.key);
      if (st.flatOnly) {
        st.img.addEventListener('load', () => { if (st.img.naturalWidth && S.get(stage) === st) { st.picAspect = st.img.naturalWidth / st.img.naturalHeight; size(st); } });
        if (st.img.complete && st.img.naturalWidth) st.picAspect = st.img.naturalWidth / st.img.naturalHeight;
      }
      if (st.flatOnly && st.wantGL) { st.wantGL = false; st.card.classList.remove('gl-wait'); }
      const id = gameTemplate(d, man); if (id) setTemplate(st, id);
    };
    if (MAN) go(MAN); else manifest().then(go);
    return st;
  }
  /* ON INTENT (a tile hovered, focused or clicked): the cover and spine fetched and decoded ahead, so the case opens with
     them. Desktop with WebGL only; the last few games' pictures are kept, the oldest dropped. */
  function prefetch(parts) {
    if (!glWanted() || window.innerWidth <= 980 || !parts) return;
    ensureWarm(false).catch(() => {});
    Promise.all([Promise.resolve(parts.front), Promise.resolve(parts.spines).catch(() => [])]).then(([fr, sp]) => {
      if (!fr || !fr.url) return;
      const go = () => { if (GL) GL.prefetchArt({ front: [fr.url], spines: sp || [], artKey: fr.url + '#' + (sp || []).join('|') + '#' + (fr.generic ? 'g' : '') }); };
      if (GL) go(); else loadGL().then(m => { if (m) go(); });
    }).catch(() => {});
  }
  /* THE FLAT LIST (manifest.json flat, 22 Nov 2026): covers more than 10% off their box's shape (cheat cartridges,
     add-ons, odd packs) keep the flat cover beside the drawer, in their own shape, with the same streak of light. */
  function isFlat(man, key) {
    const F = man && man.flat;
    if (!F || !key) return false;
    return Object.keys(F).some(k => Array.isArray(F[k]) && F[k].indexOf(key) >= 0);
  }
  /* A film: the case kind remembered for this title, else known once the full record says (filmCase()). */
  function filmTemplate(item, guess) {
    const k = item && item.MediaSources ? filmKind(item.MediaSources[0]) : null;
    if (k && item.Id) filmRemember(item.Id, k);
    const kind = k || (item && item.Id ? filmRemembered(item.Id) : null) || (guess ? 'bluray' : null);
    return kind ? ({ '4k': 'film-4k', bluray: 'film-bluray', dvd: 'film-dvd' })[kind] : null;
  }
  function filmFromEpisode(seriesId, ep) {
    const k = ep && ep.MediaSources ? filmKind(ep.MediaSources[0]) : null;
    if (!k) return null;
    if (seriesId) filmRemember(seriesId, k);
    return ({ '4k': 'film-4k', bluray: 'film-bluray', dvd: 'film-dvd' })[k];
  }
  /* Used by the drawers: is the case (or, without WebGL, the flat cover) the slide-in here? */
  const wanted = () => glWanted();

  /* For the test pages: hold the case (and the flat card) at one turn and shine, as the mouse would. */
  function forcePose(stage, ry, rx, sh) {
    const st = S.get(stage || document.getElementById('device-stage'));
    if (!st) return false;
    st.phase = 'rest'; st.card.classList.add('settled');
    const t = now() - 1000;
    st.tw = { f: [ry, rx], to: [ry, rx], t0: t }; st.ts = { f: sh, to: sh, t0: t };
    st.flat.style.transition = 'none';
    st.flat.style.transform = 'rotateY(' + ry + 'deg) rotateX(' + rx + 'deg)';
    st.flat.style.setProperty('--sheen', (sh * 100) + '%');
    const sheenEl = st.flat.querySelector('.case-sheen'); if (sheenEl) sheenEl.style.transition = 'none';
    if (st.mode === 'gl') { st.drawn = null; frame(st); }
    return true;
  }
  function redraw(stage) { const st = S.get(stage || document.getElementById('device-stage')); if (st && st.mode === 'gl') { st.drawn = null; frame(st); } }
  /* The test pages' view of the machinery (no effect on the page). */
  function debug() {
    const out = [];
    for (const st of S.values()) out.push({ stage: st.stage.id, kind: st.kind, template: st.template, mode: st.mode, phase: st.phase, frames: st.frames,
      drawn: st.drawn, flatOnly: !!st.flatOnly, glFail: st.glFail || null, front: st.frontNow || null, generic: !!st.generic, spineFrom: st.res ? st.res.spineFrom : null, fillMs: st.res && st.res.fillMs != null ? +st.res.fillMs.toFixed(1) : null, edge: st.res ? st.res.edge : null, card: [st.card.offsetWidth, st.card.offsetHeight] });
    return { webgl: webgl(), flatForced, glDead, glLoaded: !!GL, warmLog, gl: GL ? GL.info() : null, states: out };
  }

  window.CwCase = { V, show, showGame, update, stateOf, wanted, webgl, forcePose, redraw, prefetch, ensureWarm, flatForced: () => flatForced, gameTemplate, filmKind, filmTemplate, filmFromEpisode, manifest, debug,
    get GL() { return GL; }, loadGL };
})();

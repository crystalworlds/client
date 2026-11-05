/* ===========================================================================
 * hw-diagram.js: the labelled picture at the top of a Hardware tab.
 *
 * Game Boy Color and Atari Lynx (4 Nov 2026). hwDiagramHTML(key) returns a
 * figure laid out like a spec sheet: the title top left, the console's
 * picture in the middle, labelled boxes around it (left, right, top, bottom)
 * each joined to its part by a leader line, and a short specs table bottom
 * right with the figures the tab's own text gives. The boxes and lines are
 * SVG, so the text stays sharp at any size. There are two layouts of the same
 * callouts: a wide one, and a narrow one for phones with the picture smaller
 * and the boxes in columns either side; CSS shows one or the other by the
 * width of the tab. No numbered markers anywhere.
 *
 * Every anchor is a point in the SOURCE picture's own 1024 x 1024 pixels
 * (WASM_Source/hardware-diagrams/src); the shipped picture is a crop of it
 * (the crop box is in encode.py and repeated here), so a callout can be
 * checked against the source picture directly. A layout places the crop at
 * (px, py) with width pw, and the anchors follow. A leader line ends on the
 * part it names; a label with several anchors (A and B) gets one line each.
 * Box positions are in layout units: `at` is where the line leaves the box,
 * `side` which side of the box that is (r: box to the left of `at`, l: to the
 * right, b: box above, t: box below), `via` an elbow on the way.
 *
 * Loaded by a plain <script src> tag; this file adds its own stylesheet.
 * Wording rules: plain English, British spelling, no long dashes.
 * ======================================================================== */
(function () {
  'use strict';
  const V = '2.0.0-q9c';

  const GBC = {
    title: 'Nintendo Game Boy Color',
    sub: 'Model CGB-001, released 1998, in the Atomic Purple shell',
    alt: 'A Game Boy Color with its parts labelled',
    img: 'images/hardware/gbc-cgb-001.webp',
    crop: [110, 190, 910, 790],
    A: {   // anchors, source pixels
      led: [526, 287], ir: [668, 252], screen: [720, 370], logo: [520, 440], dpad: [332, 443], link: [866, 412],
      shell: [245, 545], vol: [766, 511], sel: [330, 541], start: [365, 575], a: [545, 562], b: [478, 536],
      phones: [300, 690], spk: [435, 640],
    },
    desk: {
      vb: [0, 40, 1200, 700], pic: [270, 120, 660], font: 21, boxH: 36, pad: 12, dot: 6, stroke: 2.4,
      parts: [
        { n: 'Power light',         a: ['led'],       at: [540, 150], side: 'r' },
        { n: 'Infrared port',       a: ['ir'],        at: [730, 95],  side: 'b' },
        { n: 'Screen',              a: ['screen'],    at: [880, 200], side: 'l' },
        { n: 'Game Boy Color logo', a: ['logo'],      at: [495, 240], side: 'r' },
        { n: 'D-pad',               a: ['dpad'],      at: [330, 330], side: 'r' },
        { n: 'Link port',           a: ['link'],      at: [960, 320], side: 'l' },
        { n: 'Atomic Purple shell', a: ['shell'],     at: [300, 420], side: 'r' },
        { n: 'Volume wheel',        a: ['vol'],       at: [960, 420], side: 'l' },
        { n: 'Select and Start',    a: ['sel', 'start'], at: [250, 500], side: 'r' },
        { n: 'A and B buttons',     a: ['a', 'b'],    at: [700, 600], side: 'l' },
        { n: 'Headphone socket',    a: ['phones'],    at: [330, 600], side: 'r' },
        { n: 'Speaker',             a: ['spk'],       at: [560, 660], side: 't' },
      ],
    },
    phone: {
      vb: [0, 0, 1000, 500], pic: [270, 60, 460], font: 32, boxH: 48, pad: 10, dot: 9, stroke: 3.5,
      parts: [
        { n: 'Logo',         a: ['logo'],      at: [420, 58],  side: 'b' },
        { n: 'Power light',  a: ['led'],       at: [255, 90],  side: 'r' },
        { n: 'D-pad',        a: ['dpad'],      at: [255, 160], side: 'r' },
        { n: 'Shell',        a: ['shell'],     at: [255, 230], side: 'r' },
        { n: 'Select/Start', a: ['sel', 'start'], at: [255, 300], side: 'r' },
        { n: 'Headphone',    a: ['phones'],    at: [255, 370], side: 'r' },
        { n: 'IR port',      a: ['ir'],        at: [745, 90],  side: 'l' },
        { n: 'Screen',       a: ['screen'],    at: [745, 160], side: 'l' },
        { n: 'Link port',    a: ['link'],      at: [745, 230], side: 'l' },
        { n: 'Volume wheel', a: ['vol'],       at: [745, 300], side: 'l' },
        { n: 'Speaker',      a: ['spk'],       at: [470, 440], side: 't' },
        { n: 'A and B',      a: ['a', 'b'],    at: [640, 440], side: 't' },
      ],
    },
    specs: [
      ['Processor', 'Sharp SM83 core inside the CPU CGB chip, 4.19 MHz, or 8.39 MHz in double-speed mode'],
      ['Screen', '2.3 inch colour TFT LCD, 160 × 144 pixels, no backlight'],
      ['Colours', '32,768 (15-bit); 56 on screen at once from the palettes'],
      ['Memory', '32 KB of work RAM and 16 KB of video RAM'],
      ['Sound', '4 channels; mono speaker, stereo through headphones'],
      ['Power', '2 × AA, about 10 hours, or 3 V DC'],
      ['Size', '133.5 × 78 × 27.4 mm, 138 g'],
      ['Released', 'October 1998 in Japan, November 1998 in North America and Europe'],
    ],
  };

  const LYNX = {
    title: 'Atari Lynx II',
    sub: 'The 1991 revision of the 1989 Lynx: smaller shell with rounded grips, power light and backlight button',
    alt: 'An Atari Lynx II with its parts labelled',
    img: 'images/hardware/lynx-ii.webp',
    crop: [60, 220, 960, 820],
    A: {
      screen: [530, 445], screenLo: [560, 480], logo: [405, 378], led: [305, 460], dpad: [265, 598],
      opt1: [650, 345], pause: [686, 374], opt2: [724, 402], a2: [655, 298], b2: [703, 272],
      a: [870, 394], b: [806, 414], spk: [775, 335], comlynx: [780, 520], shell: [140, 660], wheel: [205, 700],
      on: [325, 500], off: [361, 527], light: [396, 555], phones: [525, 660],
    },
    desk: {
      vb: [0, 20, 1210, 670], pic: [250, 120, 700], font: 21, boxH: 36, pad: 12, dot: 6, stroke: 2.4,
      parts: [
        { n: 'Screen',               a: ['screen'],  at: [480, 100], side: 'b' },
        { n: 'Lynx logo',            a: ['logo'],    at: [470, 180], side: 'r' },
        { n: 'Power light',          a: ['led'],     at: [400, 260], side: 'r' },
        { n: 'D-pad',                a: ['dpad'],    at: [290, 360], side: 'r' },
        { n: 'Option 1',             a: ['opt1'],    at: [660, 130], side: 'r' },
        { n: 'Pause',                a: ['pause'],   at: [870, 100], side: 'l', via: [[790, 120]] },
        { n: 'Option 2',             a: ['opt2'],    at: [780, 560], side: 'l' },
        { n: 'A and B, second pair', a: ['a2', 'b2'], at: [700, 60], side: 'b' },
        { n: 'A and B buttons',      a: ['a', 'b'],  at: [990, 300], side: 'l' },
        { n: 'Speaker',              a: ['spk'],     at: [950, 150], side: 'l' },
        { n: 'ComLynx socket',       a: ['comlynx'], at: [900, 450], side: 'l' },
        { n: 'Lynx II shell',        a: ['shell'],   at: [250, 470], side: 'r' },
        { n: 'Thumbwheel',           a: ['wheel'],   at: [280, 600], side: 't' },
        { n: 'On, Off, Backlight',   a: ['on', 'off', 'light'], at: [500, 640], side: 't' },
        { n: 'Headphone socket',     a: ['phones'],  at: [690, 600], side: 't' },
      ],
    },
    phone: {
      vb: [0, 0, 1000, 560], pic: [260, 70, 480], font: 32, boxH: 48, pad: 10, dot: 9, stroke: 3.5,
      parts: [
        { n: 'Option 1',     a: ['opt1'],    at: [360, 58],  side: 'b', via: [[538, 95]] },
        { n: 'Second A, B',  a: ['a2', 'b2'], at: [570, 58], side: 'b' },
        { n: 'Logo',         a: ['logo'],    at: [255, 100], side: 'r' },
        { n: 'Screen',       a: ['screenLo'], at: [255, 170], side: 'r' },
        { n: 'Power light',  a: ['led'],     at: [255, 240], side: 'r' },
        { n: 'D-pad',        a: ['dpad'],    at: [255, 310], side: 'r' },
        { n: 'Shell',        a: ['shell'],   at: [255, 380], side: 'r' },
        { n: 'Thumbwheel',   a: ['wheel'],   at: [255, 450], side: 'r' },
        { n: 'Speaker',      a: ['spk'],     at: [745, 100], side: 'l' },
        { n: 'A and B',      a: ['a', 'b'],  at: [745, 210], side: 'l' },
        { n: 'Option 2',     a: ['opt2'],    at: [745, 280], side: 'l' },
        { n: 'ComLynx',      a: ['comlynx'], at: [745, 350], side: 'l' },
        { n: 'Pause',        a: ['pause'],   at: [745, 420], side: 'l', via: [[650, 310]] },
        { n: 'Headphone',    a: ['phones'],  at: [745, 490], side: 'l' },
        { n: 'On, Off, Backlight', a: ['on', 'off', 'light'], at: [460, 500], side: 't' },
      ],
    },
    specs: [
      ['Processor', '65C02 core inside the Mikey chip, up to 4 MHz (about 3.6 MHz on average); 16 MHz system clock'],
      ['Screen', '3.5 inch backlit colour LCD, 160 × 102 pixels'],
      ['Colours', '4,096 (12-bit); 16 per line'],
      ['Memory', '64 KB of RAM; a 512-byte boot program inside Mikey'],
      ['Graphics', 'Suzy: hardware sprite scaling and a maths unit'],
      ['Sound', '4 channels with 8-bit output; stereo through headphones on the Lynx II'],
      ['Power', '6 × AA, about 5 to 6 hours on a Lynx II (4 to 5 on the first Lynx)'],
      ['Link', 'ComLynx cable, up to 8 players'],
      ['Released', 'Lynx September 1989; Lynx II 1991'],
    ],
  };

  const DIAGRAMS = { gbc: GBC, atarilynx: LYNX };

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const r1 = n => Math.round(n * 10) / 10;

  function boxRect(at, side, w, h) {
    const [lx, ly] = at;
    if (side === 'r') return { x: lx - w, y: ly - h / 2 };
    if (side === 'l') return { x: lx, y: ly - h / 2 };
    if (side === 'b') return { x: lx - w / 2, y: ly - h };
    return { x: lx - w / 2, y: ly };
  }

  function layoutSVG(D, L, cls) {
    const [cl, ct, cr, cb] = D.crop, [px, py, pw] = L.pic;
    const s = pw / (cr - cl), ph = (cb - ct) * s;
    const map = p => [r1(px + (p[0] - cl) * s), r1(py + (p[1] - ct) * s)];
    const estimate = str => Math.round(str.length * L.font * 0.58 + L.pad * 2);
    const img = `<image href="${D.img}?v=${V}" x="${px}" y="${py}" width="${pw}" height="${r1(ph)}" preserveAspectRatio="none"/>`;
    let leaders = '', labels = '';
    L.parts.forEach(p => {
      const w = estimate(p.n), rc = boxRect(p.at, p.side, w, L.boxH);
      p.a.forEach(key => {
        const a = map(D.A[key]);
        const pts = [p.at].concat(p.via || [], [a]).map(q => q.join(',')).join(' ');
        leaders += `<polyline points="${pts}"/><circle class="hwd-dot" cx="${a[0]}" cy="${a[1]}" r="${L.dot}"/>`;
      });
      labels += `<g class="hwd-lab" data-side="${p.side}" data-lx="${p.at[0]}" data-ly="${p.at[1]}"><rect x="${rc.x}" y="${rc.y}" width="${w}" height="${L.boxH}" rx="${Math.round(L.boxH / 5)}"/><text x="${rc.x + L.pad}" y="${rc.y + L.boxH / 2}">${esc(p.n)}</text></g>`;
    });
    const vb = L.vb.join(' ');
    return `<svg class="hwd-svg ${cls}" viewBox="${vb}" role="img" aria-label="${esc(D.alt)}" data-pad="${L.pad}" data-boxh="${L.boxH}" style="--hwd-font:${L.font}px;--hwd-stroke:${L.stroke}">${img}<g class="hwd-leaders">${leaders}</g><g class="hwd-labels">${labels}</g></svg>`;
  }

  window.hwDiagramHTML = function (key) {
    const D = DIAGRAMS[key];
    if (!D) return '';
    const specs = D.specs.map(sp => `<div class="hwd-spec"><span class="k">${sp[0]}</span><span class="v">${sp[1]}</span></div>`).join('');
    return `<figure class="hwd" data-hwd="${key}">
      <div class="hwd-head"><h3>${esc(D.title)}</h3><p>${esc(D.sub)}</p></div>
      <div class="hwd-pic">${layoutSVG(D, D.desk, 'hwd-svg-desk')}${layoutSVG(D, D.phone, 'hwd-svg-phone')}</div>
      <div class="hwd-foot"><div class="hwd-specs"><div class="hwd-specs-h">Tech specs</div>${specs}</div></div>
    </figure>`;
  };

  /* Each label box is drawn at an estimated width; once it is on screen the
     box is fitted to the text the browser actually set. Leaders start at the
     box's fixed attachment point, so only the box moves. */
  function fit(root) {
    (root.querySelectorAll ? root.querySelectorAll('.hwd-svg') : []).forEach(svg => {
      if (!svg.getClientRects().length) return;   // the layout not shown at this width: nothing to measure
      const pad = +svg.dataset.pad, h = +svg.dataset.boxh;
      svg.querySelectorAll('.hwd-lab').forEach(g => {
        const text = g.querySelector('text'), rect = g.querySelector('rect');
        let tw = 0; try { tw = text.getComputedTextLength(); } catch (_) {}
        if (!(tw > 0)) return;
        const w = Math.ceil(tw + pad * 2);
        const rc = boxRect([+g.dataset.lx, +g.dataset.ly], g.dataset.side, w, h);
        rect.setAttribute('width', w); rect.setAttribute('x', rc.x);
        text.setAttribute('x', rc.x + pad);
      });
    });
  }
  const ro = (typeof ResizeObserver === 'function') ? new ResizeObserver(es => es.forEach(e => fit(e.target))) : null;
  function watch(root) {
    (root.querySelectorAll ? root.querySelectorAll('.hwd') : []).forEach(f => {
      if (f.dataset.hwdWatched) return;
      f.dataset.hwdWatched = '1';
      fit(f);
      if (ro) ro.observe(f);
    });
  }
  function start() {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'hw-diagram.css?v=' + V;
    document.head.appendChild(css);
    css.addEventListener('load', () => watch(document));
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) watch(n); })))
      .observe(document.documentElement, { childList: true, subtree: true });
    watch(document);
  }
  if (document.head) start(); else document.addEventListener('DOMContentLoaded', start);
})();

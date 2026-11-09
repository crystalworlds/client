/*
 * play/host/present.mjs -- the raster presenter and the device art frame
 * (the Core API, section 3.4.1 and 4.2 present/*).
 *
 * The core hands a view of its own frame in its own format; this converts it once
 * (a lookup table for indexed and shade formats), puts it on the one canvas, and
 * places that canvas in the device art's screen aperture. Every console's play screen
 * is this; only the art description (play/cores/<id>/art.mjs) differs.
 *
 * ART LAYOUT is the Game Boy page's band rule, made general: the device's full width
 * fits the stage, it is cropped a set number of screen heights above and below the
 * screen, and the game sits in the aperture, behind translucent glass (a photograph)
 * or in front of opaque art (a render). Without art: the largest integer scale.
 * Full screen (A13): the screen alone, as large as fits, art off.
 */
import { SegmentLayer } from './segments.mjs?v=2.1.0';

/* The whole device on a tall screen only if its game screen stays at least this large against the
   cropped band (1 = never smaller). 0.85: a portrait phone and a Fold cover screen are width-bound
   (ratio 1); a Fold's inner screen (about 0.71) and every landscape screen keep the band. */
const TALL_KEEP = 0.85;

/* BALANCED (2026-10-22): a television's top, centred between the Control Bar's bottom and
   the top of the message room, never above minTop (the bar clear of the game) nor into the room. */
function tvBalanced(minTop, H, barB, lo) {
  const t = Math.max(0, barB) + (lo - Math.max(0, barB) - H) / 2;
  return Math.max(0, Math.min(Math.max(t, minTop), lo - H));
}

export class Presenter {
  constructor({ box, wrap, img, canvas, scan }) {
    this.box = box; this.wrap = wrap; this.img = img; this.canvas = canvas;
    // The rewind scan bands sit on the GAME SCREEN only (2026-10-14), every console.
    this.scan = scan || null;
    if (this.scan) wrap.appendChild(this.scan);
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.w = 0; this.h = 0; this.image = null; this.px = null;
    this.art = null; this.full = false;
    this.shownRect = null;      // the part of the art the frame shows, [l, t, w, h] in fractions of the art (null: no art shown)
    this.tallView = false;      // the whole device is shown on a tall, narrow screen (art.tall)
    this.onArtView = null;      // told after every layout (the on-screen art buttons follow it)
    this.lut16 = null;
    this.presented = 0;
    addEventListener('resize', () => requestAnimationFrame(() => this.layout()));
    if (window.visualViewport) visualViewport.addEventListener('resize', () => requestAnimationFrame(() => this.layout()));
    this.onLayout = null;
  }

  configure(v) {
    this.pixelAspect = v.pixelAspect || 1;
    this.fill = !!v.fill;       // a plain screen that fills the stage (the Super Game Boy, two linked Game Boys)
    /* A picture behind the screen, filling the stage (25 Oct: the Super Game Boy's fan art
       borders, 1920x1080, around the Game Boy screen). Absent or '': the stage's own background. */
    this.setBackdrop(v.backdrop);
    /* A segment LCD (the Core API, section 3.4.2): the canvas is the screen box and
       holds a raster of it (screenshots); the segments themselves are the art's SVG. */
    if (v.format === 'segments' && v.segments) { this.segLayer().setIds(v.segments.ids); }
    if (v.width !== this.w || v.height !== this.h) {
      this.w = v.width; this.h = v.height;
      this.canvas.width = v.width; this.canvas.height = v.height;
      this.image = this.ctx.createImageData(v.width, v.height);
      this.px = new Uint32Array(this.image.data.buffer);
    }
    this.layout();
  }

  /* The picture behind the screen. A string sets it ('' clears it); anything else keeps it.
     Read from every frame too (present), so a frame whose size did not change still brings it. */
  setBackdrop(b) {
    if (typeof b !== 'string' || b === (this.backdrop || '')) return;
    this.backdrop = b;
    const st = this.box.style;
    st.backgroundImage = b ? 'url("' + b.replace(/"/g, '%22') + '")' : '';
    st.backgroundSize = b ? 'cover' : ''; st.backgroundPosition = b ? 'center' : ''; st.backgroundRepeat = b ? 'no-repeat' : '';
  }

  /* bgr555 -> ABGR, built once (32768 entries): the Game Boy Color's standard
     expansion, 5 bits to 8 by replicating the top 3 (web/shell.js blitInto). */
  bgr555() {
    if (this.lut16) return this.lut16;
    const t = new Uint32Array(32768);
    for (let c = 0; c < 32768; c++) {
      const r5 = c & 31, g5 = (c >> 5) & 31, b5 = (c >> 10) & 31;
      t[c] = (0xFF << 24) | (((b5 << 3) | (b5 >> 2)) << 16) | (((g5 << 3) | (g5 >> 2)) << 8) | ((r5 << 3) | (r5 >> 2));
    }
    return (this.lut16 = t);
  }

  segLayer() { return this.seg || (this.seg = new SegmentLayer(this)); }

  present(f) {
    if (!f || !f.data) return;
    if (f.format === 'segments') { if (this.seg) this.seg.paint(f.levels || f.data); this.presented++; return; }
    if (f.width !== this.w || f.height !== this.h) this.configure(f);
    else if (typeof f.backdrop === 'string') this.setBackdrop(f.backdrop);
    const out = this.px, src = f.data, n = this.w * this.h;
    switch (f.format) {
      case 'shade8': { const p = f.palette; for (let i = 0; i < n; i++) out[i] = p[src[i] & 3]; break; }
      case 'index8': case 'index16': {
        // A power-of-two palette is indexed by mask (the NES: 64 colours x 8 emphasis states = 512).
        const p = f.palette, m = (p.length & (p.length - 1)) === 0 ? p.length - 1 : 0xFFFF;
        for (let i = 0; i < n; i++) out[i] = p[src[i] & m] | 0xFF000000;
        break;
      }
      case 'bgr555': { const t = this.bgr555(); for (let i = 0; i < n; i++) out[i] = t[src[i] & 0x7FFF]; break; }
      case 'rgba8888': out.set(src.length === n ? src : new Uint32Array(src.buffer, src.byteOffset, n)); break;
      default: return;
    }
    this.ctx.putImageData(this.image, 0, 0);
    this.presented++;
  }

  /** A copy of a frame view, for the rewind ring's picture of each moment. */
  static copyFrame(f) {
    return f && f.data ? { format: f.format, width: f.width, height: f.height, stride: f.stride, palette: f.palette, data: f.data.slice(), levels: f.levels ? f.levels.slice() : undefined } : null;
  }

  setArt(desc) {
    this.art = desc || null;
    const wrap = this.wrap, img = this.img;
    if (desc && desc.lcd) this.segLayer().build(desc); else if (this.seg) this.seg.clear();
    if (!desc) {
      wrap.classList.remove('has-art', 'glass-opaque'); this.box.classList.remove('art-mode');
      img.removeAttribute('src');
      this.layout();
      return Promise.resolve();
    }
    return new Promise(res => {
      img.onload = () => { res(); this.layout(); };
      img.onerror = () => { this.setArt(null); res(); };
      img.src = desc.src;
      wrap.classList.toggle('glass-opaque', !!desc.opaque);
      wrap.classList.add('has-art'); this.box.classList.add('art-mode');
      this.layout();
      if (desc.measureGlass) this.measureGlass(desc).then(op => { if (this.art === desc) wrap.classList.toggle('glass-opaque', op); });
    });
  }
  /* The art's own alpha over the aperture decides which side of the glass the game is
     on (play/gameboy/app.js measureGlass): mean alpha 240 or more is opaque art. */
  measureGlass(g) {
    return new Promise(res => {
      const im = new Image();
      im.onerror = () => res(!!g.opaque);
      im.onload = () => {
        try {
          const W = im.naturalWidth, H = im.naturalHeight, S = 96, c = document.createElement('canvas');
          c.width = S; c.height = S;
          const x = c.getContext('2d', { willReadFrequently: true });
          const ix = g.w * W * 0.06, iy = g.h * H * 0.06;
          x.drawImage(im, g.l * W + ix, g.t * H + iy, g.w * W - 2 * ix, g.h * H - 2 * iy, 0, 0, S, S);
          const d = x.getImageData(0, 0, S, S).data;
          let sum = 0; for (let i = 3; i < d.length; i += 4) sum += d[i];
          res(sum / (S * S) >= 240);
        } catch (_) { res(!!g.opaque); }
      };
      im.src = g.src;
    });
  }

  setFull(on) { this.full = !!on; this.box.classList.toggle('full', this.full); this.layout(); }

  layout() {
    const box = this.box, wrap = this.wrap, img = this.img, cv = this.canvas;
    if (!box.clientWidth || !box.clientHeight || !this.w) return;
    const cs = getComputedStyle(box);
    const bw = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const bh = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (!(bw > 0 && bh > 0)) return;
    const g = this.art;
    if (!g || this.full || !g.crop) box.style.paddingTop = '';
    box.style.paddingBottom = '';
    this.shownRect = null; this.tallView = false;
    wrap.style.alignSelf = ''; wrap.style.marginTop = '';
    if (!g || this.full) {
      wrap.classList.toggle('art-off', !!g);
      wrap.style.width = ''; wrap.style.height = '';
      cv.style.position = ''; cv.style.left = ''; cv.style.top = '';
      const pa = this.pixelAspect || 1, w = this.w * pa;
      let s = Math.min(bw / w, bh / this.h);
      if (!this.full && !g && this.fill) {
        /* FILL (2026-10-25: enlarge the display area to fit the space in the window,
           until the top and the bottom meet the window): a plain screen the core marks fill
           (the Super Game Boy's television, two linked Game Boys) takes the whole stage below the
           Control Bar at any scale, keeping its shape; the pixels stay crisp (image-rendering). */
        const bs = getComputedStyle(box), pt = parseFloat(bs.paddingTop), pb = parseFloat(bs.paddingBottom);
        const bh1 = box.clientHeight - pt - pb;        // measured without a previous layout's inset
        const barB = this.barBottom ? this.barBottom() : 0;
        const inset = Math.max(0, Math.min(barB - pt, bh1 * 0.5));
        if (inset > 0) box.style.paddingTop = (pt + inset) + 'px';
        s = Math.min(bw / w, (bh1 - inset) / this.h);
      } else if (!this.full && s >= 1 && pa === 1) s = Math.floor(s);   // a square pixel stays square and whole
      cv.style.width = Math.floor(w * s) + 'px';
      cv.style.height = Math.floor(this.h * s) + 'px';
      cv.style.borderRadius = ''; cv.style.background = '';
    } else if (g.crop) {
      /* A CROP of the art (a television, not a handheld): the crop box fits the stage
         whole, the art is drawn at the size that makes that true, and the picture is
         stretched over the aperture exactly as the old NES page's nes-screen.css did. */
      wrap.classList.remove('art-off');
      const c = g.crop, ar = g.ar;                       // ar: whole art width / height
      const cropAr = (c.w * ar) / c.h;
      // Measured without any inset a previous layout added (so the decision does not feed back).
      box.style.paddingTop = '';
      const bh = box.clientHeight - parseFloat(getComputedStyle(box).paddingTop) - parseFloat(getComputedStyle(box).paddingBottom);
      let wrapW = Math.min(bw, bh * cropAr), wrapH = wrapW / cropAr;
      let artW = wrapW / c.w, artH = artW / ar;
      /* The Control Bar never covers the picture (A9): when the centred television would put
         the screen under the bar (a phone on its side), it is fitted below the bar instead. */
      let inset = 0;
      const barB = this.barBottom ? this.barBottom() : 0;
      if (this.tvTop) {
        /* TV BALANCED (2026-10-22): the television fits between the bar and the messages at the
           bottom and is centred there (tvBalanced): the bar never on the game, a message never on the TV. */
        const s = (g.t - c.t) / c.h, room = Math.min(this.msgRoom ? this.msgRoom() : 0, bh * 0.3);
        wrapW = Math.min(bw, (bh - room - Math.max(0, barB)) * cropAr); wrapH = wrapW / cropAr;   // fits between bar and messages
        artW = wrapW / c.w; artH = artW / ar;
        inset = tvBalanced(Math.max(0, barB - s * wrapH), wrapH, barB, bh - room);
      } else if (barB > 0 && (bh - wrapH) / 2 + (g.t - c.t) * artH < barB) {
        inset = Math.min(barB, bh * 0.5);
        wrapW = Math.min(bw, (bh - inset) * cropAr); wrapH = wrapW / cropAr;
        artW = wrapW / c.w; artH = artW / ar;
      }
      // At the top: the wrap itself is placed (a padded box grows in a flex column and feeds back).
      if (this.tvTop) { wrap.style.alignSelf = 'start'; wrap.style.marginTop = inset ? Math.round(inset) + 'px' : ''; }
      else box.style.paddingTop = inset ? inset + 'px' : '';
      this.shownRect = [c.l, c.t, c.w, c.h];
      wrap.style.width = Math.round(wrapW) + 'px'; wrap.style.height = Math.round(wrapH) + 'px';
      img.style.width = Math.round(artW) + 'px'; img.style.height = Math.round(artH) + 'px';
      img.style.left = Math.round(-c.l * artW) + 'px'; img.style.top = Math.round(-c.t * artH) + 'px';
      cv.style.position = 'absolute';
      cv.style.left = Math.round((g.l - c.l) * artW) + 'px';
      cv.style.top = Math.round((g.t - c.t) * artH) + 'px';
      cv.style.width = Math.round(g.w * artW) + 'px';
      cv.style.height = Math.round(g.h * artH) + 'px';
      cv.style.borderRadius = g.radius || ''; cv.style.background = g.glass || '';
    } else {
      wrap.classList.remove('art-off');
      // Measured without any inset a previous layout added (box.style.paddingTop was cleared above).
      const bh0 = box.clientHeight - parseFloat(getComputedStyle(box).paddingTop) - parseFloat(getComputedStyle(box).paddingBottom);
      /* THE WHOLE DEVICE ON A TALL, NARROW SCREEN (2026-10-17: "If a really narrow and tall
         display is detected like on a phone, can the play window be the full sized Game Boy / Game
         Boy Color and not the cropped zoomed-in image? ... if it's a fold phone and the outer display
         is shown it should always be a full sized display of the device artwork"). An art with a
         `tall` band (the whole device) uses it whenever the stage is so narrow that the whole device
         shows the game screen at least TALL_KEEP as large as the cropped band does: a phone held
         upright and a Fold's cover screen (both width-bound, so the screen is the same size either
         way). A wide or landscape stage keeps the cropped band, unchanged. Measured on the stage
         itself, so a rotation or a fold re-decides it on the next layout. */
      let B = g.band;
      if (g.tall) {
        const nb = 1 + g.band.above + g.band.below, tb = 1 + g.tall.above + g.tall.below;
        const wBand = Math.min(bw, (bh0 * g.ar) / (g.h * nb)), wTall = Math.min(bw, (bh0 * g.ar) / (g.h * tb));
        if (wTall >= TALL_KEEP * wBand) { B = g.tall; this.tallView = true; }
      }
      /* TV AT THE TOP (2026-10-22), as in the crop layout: a television's band drops its
         headroom (desc.tvHead) and sits at the top of the stage, clear of the messages below. */
      const tvTop = !!(this.tvTop && g.tvHead != null && !this.tallView);
      if (tvTop) B = { above: B.above - g.tvHead, below: B.below };
      const band = 1 + B.above + B.below;
      let artW = Math.min(bw, (bh0 * g.ar) / (g.h * band));
      if (tvTop) {
        const k = g.h * band / g.ar, s = B.above / band;            // wrap height per art width; the glass's top in the wrap
        const tb = this.barBottom ? this.barBottom() : 0, room = Math.min(this.msgRoom ? this.msgRoom() : 0, bh0 * 0.3);
        artW = Math.min(bw, (bh0 - room - Math.max(0, tb)) / k);          // fits between bar and messages
        const H = artW * k, inset = tvBalanced(Math.max(0, tb - s * H), H, tb, bh0 - room);
        wrap.style.alignSelf = 'start'; wrap.style.marginTop = inset ? Math.round(inset) + 'px' : '';
      }
      /* HEADROOM (2026-10-14): an art whose top edge carries something to
         see (desc.headroom: a whole unit, the Tetris Jr. title, a colour unit's top edge) is fitted
         below the Control Bar when the centred band would put its top under the bar, as the crop
         layout does for a television. Other bands (the Game Boy's shell top) keep their look. */
      /* FOOT ROOM (2026-10-17), the same for the bottom: the on-screen strip of console switches
         (an Atari's Option and Pause pills) never covers the device's own buttons. Measured: a turned
         Lynx on a phone held sideways had its d-pad and A key under the strip. */
      const barB = (g.headroom || this.tallView) && this.barBottom ? this.barBottom() : 0;
      const footB = (g.headroom || this.tallView) && this.footRoom ? this.footRoom() : 0;
      const spare = (bh0 - (artW / g.ar) * g.h * band) / 2;
      if ((barB > 0 && spare < barB) || (footB > 0 && spare < footB)) {
        const inset = Math.min(barB, bh0 * 0.5), foot = Math.min(footB, bh0 * 0.3);
        if (inset) box.style.paddingTop = inset + 'px';
        if (foot) box.style.paddingBottom = foot + 'px';
        artW = Math.min(bw, ((bh0 - inset - foot) * g.ar) / (g.h * band));
      }
      const artH = artW / g.ar;
      const scrH = g.h * artH, scrTop = g.t * artH;
      const cropTop = scrTop - B.above * scrH;
      this.shownRect = [0, cropTop / artH, 1, (scrH * band) / artH];
      wrap.style.width = Math.round(artW) + 'px';
      wrap.style.height = Math.round(scrH * band) + 'px';
      img.style.width = Math.round(artW) + 'px';
      img.style.height = Math.round(artH) + 'px';
      img.style.left = '0px'; img.style.top = Math.round(-cropTop) + 'px';
      cv.style.position = 'absolute';
      cv.style.left = Math.round(g.l * artW) + 'px';
      cv.style.top = Math.round(scrTop - cropTop) + 'px';
      cv.style.width = Math.round(g.w * artW) + 'px';
      cv.style.height = Math.round(scrH) + 'px';
    }
    if (this.scan) {
      const cv2 = this.canvas, sc = this.scan.style;
      sc.left = cv2.offsetLeft + 'px'; sc.top = cv2.offsetTop + 'px'; sc.width = cv2.offsetWidth + 'px'; sc.height = cv2.offsetHeight + 'px';
      sc.borderRadius = getComputedStyle(cv2).borderRadius;
    }
    if (this.seg) this.seg.place();
    if (this.onLayout) this.onLayout();
    if (this.onArtView) { try { this.onArtView(); } catch (_) {} }
  }

  /** A pointer's place on the picture, 0..1 each way (inside: on the picture). */
  pointOf(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const x = (clientX - r.left) / r.width, y = (clientY - r.top) / r.height;
    return { x, y, inside: x >= 0 && x < 1 && y >= 0 && y < 1 };
  }
  /** A light gun's crosshair at a picture position (0..1), or hidden (null). */
  crosshair(p) {
    let h = this._xh;
    if (!h) {
      h = this._xh = document.createElement('div');
      h.className = 'host-xhair'; h.setAttribute('aria-hidden', 'true');
      this.wrap.appendChild(h);
    }
    if (!p || !(p.x >= 0 && p.x < 1 && p.y >= 0 && p.y < 1)) { h.hidden = true; return; }
    h.hidden = false;
    const cv = this.canvas;
    h.style.left = (cv.offsetLeft + p.x * cv.offsetWidth) + 'px';
    h.style.top = (cv.offsetTop + p.y * cv.offsetHeight) + 'px';
  }

  /** The screen alone at native size (screenshots, slot pictures, Continue cards). */
  shot(type = 'image/png', q) { try { return this.canvas.toDataURL(type, q); } catch (_) { return null; } }
}

/*
 * play/host/segments.mjs -- the segment presenter (the Core API, section 3.4.2).
 * PROPOSED 2026-10-14 for the Game & Watch migration, for the host to adopt.
 *
 * A segment LCD is not a frame buffer. The core reports one level per segment address
 * (FrameView.levels, indexed like VideoInfo.segments.ids); the console's ART describes
 * the LCD as a stack of layers (desc.lcd.layers: images and segment SVGs, each with its
 * box in fractions of the device art). This builds that stack once, binds every SVG
 * element whose own <title> is an address to its level, and on each frame only shows or
 * hides the elements whose level changed. The core never sees the SVG; the art never
 * sees the levels.
 *
 * Layers with `over: true` sit above the device art (a glass reflection); the rest sit
 * under it (behind the case's window), or above it when the art is opaque (a cabinet
 * with no window cut: desc.opaque).
 *
 * SCREENSHOTS AND THUMBNAILS: the presenter's canvas (the screen box) is kept as a
 * raster of the same stack, redrawn at most every 200 ms after a change, so
 * Presenter.shot() stays the one synchronous way to take a picture for every console.
 *
 * Nothing here is console-specific: Game & Watch is the first user; Tetris Jr.'s sprite
 * ids fit the same binding (an element titled with its id).
 *
 * THREE CHOICES AN ART MAY MAKE (desc.lcd; for Tetris Jr., 2026-10-14; all default to
 * the G&W behaviour above):
 *   bindBy: 'id'        bind elements by their id attribute instead of a <title> child
 *                       (the Tetris Jr. sheets carry ids);
 *   levels: 'opacity'   a level is the element's opacity (level / 255; 0 hides it) instead
 *                       of lit at 128 and up (Tetris Jr.'s unlit grid cell is an etched
 *                       ghost at 13 % ink, level 33);
 *   hideCanvas: true    the presenter's canvas stays a raster for shots but is not seen
 *                       (two windows with case between them: a black box would cover it).
 */
export class SegmentLayer {
  constructor(presenter) {
    this.p = presenter;
    this.ids = null; this.index = null;          // address -> level index
    this.bound = [];                             // [{ el, i, on }]
    this.layers = [];
    this.under = this.mk('host-seg-under'); this.over = this.mk('host-seg-over');
    this.rasterDue = 0; this.rasterBusy = false; this.rasterT = 0;
    this.changes = 0;
  }
  mk(cls) {
    const d = document.createElement('div');
    d.className = cls;
    d.style.cssText = 'position:absolute;pointer-events:none;overflow:visible;isolation:isolate;display:none';
    this.p.wrap.appendChild(d);
    return d;
  }
  /** VideoInfo.segments: the address of each level index. */
  setIds(ids) {
    this.ids = ids || [];
    this.index = new Map(this.ids.map((id, i) => [id, i]));
    this.bind();
  }
  /** The art description's LCD stack (or null to clear). */
  build(desc) {
    this.desc = desc && desc.lcd ? desc : null;
    this.under.textContent = ''; this.over.textContent = '';
    this.layers = [];
    this.p.canvas.style.opacity = this.desc && this.desc.lcd.hideCanvas ? '0' : '';
    if (!this.desc) { this.under.style.display = this.over.style.display = 'none'; this.bound = []; return; }
    this.under.style.zIndex = desc.opaque ? '2' : '0';
    this.over.style.zIndex = '3';
    for (const L of desc.lcd.layers || []) {
      let el;
      if (L.kind === 'svg') {
        const box = document.createElement('div');
        box.innerHTML = L.svg;
        el = box.firstElementChild;
        if (!el) continue;
        el.style.cssText = 'position:absolute;overflow:visible;mix-blend-mode:' + (L.blend || 'multiply');
      } else {
        el = document.createElement('img');
        el.alt = ''; el.decoding = 'async'; el.src = L.src;
        el.style.cssText = 'position:absolute;display:block;user-select:none;-webkit-user-drag:none';
      }
      if (L.opacity != null) el.style.opacity = String(L.opacity);
      (L.over ? this.over : this.under).appendChild(el);
      this.layers.push({ L, el });
    }
    this.bind();
    this.place();
  }
  bind() {
    this.bound = [];
    if (!this.index) return;
    for (const { L, el } of this.layers) {
      if (L.kind !== 'svg') continue;
      if (this.desc && this.desc.lcd.bindBy === 'id') {
        el.querySelectorAll('[id]').forEach(e => {
          const i = this.index.get(e.getAttribute('id'));
          if (i == null) return;
          e.style.visibility = 'hidden';
          this.bound.push({ el: e, i, on: false, lv: -1 });
        });
        continue;
      }
      el.querySelectorAll('g, path').forEach(e => {
        const t = e.querySelector(':scope > title');
        if (!t) return;
        const i = this.index.get(t.textContent.trim());
        if (i == null) return;
        e.style.visibility = 'hidden';
        this.bound.push({ el: e, i, on: false });
      });
    }
  }
  /** Follow the presenter's canvas (the screen box on the art, or the screen alone). */
  place() {
    const p = this.p, cv = p.canvas, d = this.desc;
    if (!d) return;
    const show = cv.offsetWidth > 0;
    for (const c of [this.under, this.over]) {
      c.style.display = show ? 'block' : 'none';
      c.style.left = cv.offsetLeft + 'px'; c.style.top = cv.offsetTop + 'px';
      c.style.width = cv.offsetWidth + 'px'; c.style.height = cv.offsetHeight + 'px';
    }
    // Over-the-case layers only with the art showing.
    this.over.style.display = show && !p.full ? 'block' : 'none';
    // Each layer's box is in fractions of the art; the containers are the screen box.
    for (const { L, el } of this.layers) {
      const b = L.box || { l: d.l, t: d.t, w: d.w, h: d.h };
      el.style.left = ((b.l - d.l) / d.w * 100) + '%';
      el.style.top = ((b.t - d.t) / d.h * 100) + '%';
      el.style.width = (b.w / d.w * 100) + '%';
      el.style.height = (b.h / d.h * 100) + '%';
    }
    this.rasterSoon(0);
  }
  /** One frame's levels: show what is lit (level 128 and up), hide the rest. */
  paint(levels) {
    if (!levels) return;
    let n = 0;
    if (this.desc && this.desc.lcd.levels === 'opacity') {
      for (const b of this.bound) {
        const lv = levels[b.i];
        if (lv === b.lv) continue;
        b.lv = lv; n++;
        b.el.style.visibility = lv ? 'visible' : 'hidden';
        b.el.style.opacity = lv >= 255 ? '' : String(lv / 255);
      }
      if (n) { this.changes += n; this.rasterSoon(200); }
      return;
    }
    for (const b of this.bound) {
      const on = levels[b.i] > 127;
      if (on !== b.on) { b.on = on; b.el.style.visibility = on ? 'visible' : 'hidden'; n++; }
    }
    if (n) { this.changes += n; this.rasterSoon(200); }
  }
  /* The canvas raster (for Presenter.shot): the under-layers in order, each SVG with its
     current segments, drawn with its own blend. Asynchronous; at most one in flight. */
  rasterSoon(ms) {
    if (this.rasterT) return;
    this.rasterT = setTimeout(() => { this.rasterT = 0; this.raster(); }, ms);
  }
  async raster() {
    if (this.rasterBusy || !this.desc) return;
    this.rasterBusy = true;
    try {
      const p = this.p, d = this.desc, cv = p.canvas, ctx = p.ctx, W = cv.width, H = cv.height;
      const load = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
      const pics = await Promise.all(this.layers.filter(x => !x.L.over).map(async ({ L, el }) => {
        if (L.kind === 'svg') {
          // A copy at the size it is drawn, without the page's positioning style.
          const b = L.box || d, c = el.cloneNode(true);
          c.removeAttribute('style');
          c.setAttribute('width', String(Math.max(1, Math.round(b.w / d.w * W))));
          c.setAttribute('height', String(Math.max(1, Math.round(b.h / d.h * H))));
          const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(c)], { type: 'image/svg+xml' }));
          const im = await load(url); URL.revokeObjectURL(url); return { L, im };
        }
        return { L, im: el.complete && el.naturalWidth ? el : await load(L.src) };
      }));
      ctx.save();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      for (const { L, im } of pics) {
        if (!im) continue;
        const b = L.box || d;
        ctx.globalAlpha = L.opacity != null ? L.opacity : 1;
        ctx.globalCompositeOperation = L.kind === 'svg' && (L.blend || 'multiply') === 'multiply' ? 'multiply' : 'source-over';
        ctx.drawImage(im, (b.l - d.l) / d.w * W, (b.t - d.t) / d.h * H, b.w / d.w * W, b.h / d.h * H);
      }
      ctx.restore();
    } catch (_) { /* a picture missed costs one thumbnail */ }
    finally { this.rasterBusy = false; }
  }
  clear() { this.build(null); }
}

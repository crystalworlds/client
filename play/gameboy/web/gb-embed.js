/* gb-embed.js — an embeddable Game Boy device.
 *
 * The family's embed shape, matching PokemonMini/web/pm-embed.js: one class,
 * mounts into any element, owns its canvas, keys and teardown, and releases the
 * core on teardown rather than leaking an instance behind a removed element.
 *
 * One deliberate difference from the sibling, and it is the interesting one.
 * pm-embed drives itself from its own requestAnimationFrame. This core's ABI is
 * multi-instance, so a page can hold a WALL of devices — and N rAF loops for N
 * devices is N times the scheduling for no benefit. So a device exposes
 * step(now) and blit(), and either drives itself (start(), for a lone embed) or
 * is driven by the page's single loop (for the wall). Same class, both ways.
 *
 * FIRMWARE: nothing is bundled. A device runs the synthetic self-test cartridge
 * until the user supplies their own, which never leaves the machine.
 */

import { GBHost, Pacer, FRAME_HZ, SCREEN_W, SCREEN_H } from "./core.js";
import { paletteLUT, integerScale, KEYMAP, makeProbeCart, PROBE_SELECT_ACTIONS,
         validateKeymap, blitInto, DEFAULT_PALETTE } from "./shell.js";

export class GameBoyDevice {
  /**
   * Standalone embed: builds its own host from the wasm bytes.
   * @param {BufferSource} wasmBytes
   */
  static async create(wasmBytes, opts = {}) {
    const host = await GBHost.instantiate(wasmBytes);
    const d = new GameBoyDevice(host, opts);
    d._ownsHost = true;
    return d;
  }

  /** Shared-host form: every device on a wall shares one wasm module. */
  constructor(host, opts = {}) {
    this.host = host;
    this.scale = opts.scale || 2;
    this.palette = opts.palette || DEFAULT_PALETTE;
    this.label = opts.label || "device";
    this.useBios = opts.useBios !== false;
    /* "dmg" or "cgb". A CGB-only title cannot boot as a DMG -- it checks the
     * console at startup and refuses -- so this is not a colour preference,
     * it is whether the cartridge runs at all. */
    this.device = opts.device === "cgb" ? "cgb" : "dmg";
    this._ownsHost = false;
    /* A caller's remapped layout, if they have one. Validated rather than
     * trusted: a device handed a layout with an unreachable button would look
     * like a dead key on the pad, and diagnosing that from the outside is
     * miserable. An invalid layout falls back to the default. */
    this.keymap = opts.keymap && validateKeymap(opts.keymap).ok ? opts.keymap : KEYMAP;

    this.machine = null;
    this.cart = null;
    this.pacer = new Pacer(FRAME_HZ, 8);
    this.keyMask = 0;
    this.running = false;
    this.error = null;
    this._raf = 0;
    this._lut = paletteLUT(this.palette);

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._tick = this._tick.bind(this);
  }

  /** Build the DOM and attach. Returns the root element. */
  mount(parent) {
    const root = document.createElement("div");
    root.className = "gbdev";
    root.tabIndex = 0;
    root.style.cssText =
      "position:relative;display:inline-flex;flex-direction:column;gap:4px;outline:none;" +
      "user-select:none;-webkit-user-select:none;touch-action:none;-webkit-tap-highlight-color:transparent";

    const cv = document.createElement("canvas");
    cv.width = SCREEN_W; cv.height = SCREEN_H;
    cv.style.cssText =
      `width:${SCREEN_W * this.scale}px;height:${SCREEN_H * this.scale}px;` +
      "image-rendering:pixelated;display:block;background:#0f380f;box-shadow:0 0 0 1px #232c3a";

    const cap = document.createElement("div");
    cap.className = "gbdev-cap";
    cap.style.cssText = "font:11px ui-monospace,monospace;color:#8592a3;display:flex;gap:8px";

    root.appendChild(cv); root.appendChild(cap);
    (parent || document.body).appendChild(root);

    this.root = root; this.canvas = cv; this.caption = cap;
    this.ctx = cv.getContext("2d", { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this._img = this.ctx.createImageData(SCREEN_W, SCREEN_H);
    this._img32 = new Uint32Array(this._img.data.buffer);

    /* Keys only while this device has focus — a wall of devices must not have
     * every one of them answering the same keypress. */
    root.addEventListener("keydown", this._onKeyDown);
    root.addEventListener("keyup", this._onKeyUp);
    root.addEventListener("blur", this._onBlur);
    root.addEventListener("pointerdown", () => root.focus());

    root.addEventListener("dragover", e => { e.preventDefault(); root.style.opacity = "0.7"; });
    root.addEventListener("dragleave", () => { root.style.opacity = ""; });
    root.addEventListener("drop", async e => {
      e.preventDefault(); e.stopPropagation(); root.style.opacity = "";
      const f = e.dataTransfer.files[0];
      if (f) this.setCart(new Uint8Array(await f.arrayBuffer()), { useBios: this.useBios });
    });

    this.setCart(makeProbeCart(PROBE_SELECT_ACTIONS), { useBios: false, label: "self-test" });
    return root;
  }

  /**
   * Mount a cartridge. Goes through the host's one switch path, so a device on
   * a wall reclaims and reallocates exactly like the test bench does.
   */
  setCart(bytes, opts = {}) {
    try {
      this.machine = this.host.switchTo(this.machine, bytes, {
        label: opts.label || this.label,
        useBios: opts.useBios !== undefined ? opts.useBios : this.useBios,
        device: opts.device || this.device,
      });
      this.cart = bytes;
      this.error = null;
      this.pacer.reset(performance.now());
      this.running = true;
    } catch (e) {
      /* An arena or pool exhaustion on a wall is the D3 ceiling, and the device
       * says so on its face rather than going quietly blank. */
      this.machine = null; this.cart = null; this.running = false;
      this.error = e;
    }
    this._paintCaption();
    return !this.error;
  }

  /** Advance by wall time. Call from the page's loop, or use start(). */
  step(now) {
    if (!this.machine || !this.machine.alive || !this.running || this.machine.locked) {
      this.pacer.last = now;
      return 0;
    }
    const n = this.pacer.step(now);
    for (let i = 0; i < n; i++) this.machine.runFrame();
    return n;
  }

  blit() {
    if (!this.ctx) return;
    if (this.machine && this.machine.alive) {
      /* PER MACHINE, never host-wide: the host's format is the null-context
       * answer (SHADE8) and a CGB machine reports BGR555. Reading the host
       * here is what turns a booting colour title into a screen of garbage. */
      blitInto(this._img32, this.machine.frame, this.machine.frameFormat, this._lut);
    } else {
      this._img32.fill(this._lut[0]);
    }
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.putImageData(this._img, 0, 0);
  }

  setPalette(key) { this.palette = key; this._lut = paletteLUT(key); }

  setScale(s) {
    this.scale = Math.max(1, s | 0);
    if (this.canvas) {
      this.canvas.style.width = `${SCREEN_W * this.scale}px`;
      this.canvas.style.height = `${SCREEN_H * this.scale}px`;
    }
  }

  /** Self-driving form, for a lone embed. */
  start() {
    if (this._raf) return;
    this.pacer.reset(performance.now());
    const loop = now => { this._raf = requestAnimationFrame(loop); this.step(now); this.blit(); };
    this._raf = requestAnimationFrame(loop);
  }
  stop() { if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; } }

  _tick() { /* reserved: the Worker drive lands here, see the UI design, section 14 */ }

  setKeymap(map) {
    this.keymap = map && validateKeymap(map).ok ? map : KEYMAP;
    this.keyMask = 0;
    if (this.machine && this.machine.alive) this.machine.setButtons(0);
  }

  _onKeyDown(e) {
    const bit = this.keymap[e.code];
    if (bit === undefined) return;
    e.preventDefault();
    this.keyMask |= 1 << bit;
    if (this.machine && this.machine.alive) this.machine.setButtons(this.keyMask);
  }
  _onKeyUp(e) {
    const bit = this.keymap[e.code];
    if (bit === undefined) return;
    e.preventDefault();
    this.keyMask &= ~(1 << bit);
    if (this.machine && this.machine.alive) this.machine.setButtons(this.keyMask);
  }
  _onBlur() {
    this.keyMask = 0;
    if (this.machine && this.machine.alive) this.machine.setButtons(0);
  }

  _paintCaption() {
    if (!this.caption) return;
    this.caption.textContent = this.error
      ? `${this.label}: ${this.error.name}`
      : `${this.label}${this.cart ? ` · ${(this.cart.length / 1024) | 0} KiB` : ""}`;
    this.caption.style.color = this.error ? "#ff6b6b" : "#8592a3";
  }

  /** Release everything. The core instance included — that is the point. */
  teardown() {
    this.stop();
    this.running = false;
    if (this.root) {
      this.root.removeEventListener("keydown", this._onKeyDown);
      this.root.removeEventListener("keyup", this._onKeyUp);
      this.root.removeEventListener("blur", this._onBlur);
      this.root.remove();
    }
    if (this.machine) this.host.free(this.machine);
    this.machine = null; this.cart = null;
    this.root = this.canvas = this.ctx = this.caption = null;
    /* A device that built its own host drops it here; a device on a shared wall
     * must not, because its neighbours are still using it. */
    if (this._ownsHost) this.host = null;
  }
}

/* core.js — the ABI wrapper around build/gb.wasm.
 *
 * Deliberately DOM-free: this module is imported unchanged by the page and by
 * test/ui_net.py's Node driver, so every claim the bench makes about the core
 * is checkable headlessly. It is also what makes the eventual move behind a
 * Worker a one-file change rather than a rewrite (see the UI design, section 10).
 *
 * The ABI here is read out of src/gb.c, which the UI role does not own and does
 * not touch. Nothing in this file may be "fixed" by changing the core.
 *
 * FIRMWARE POLICY: this module never fetches, bundles or embeds a BIOS or a
 * cartridge. It takes bytes the caller already has and copies them into the
 * core's linear memory. Nothing leaves the machine.
 */

/* DMG timing. FRAME_TCYCLES is a src/gb.c constant that is not exported, so it
 * is restated here; test/ui_net.py checks the restatement against the core by
 * measuring how far one gb_run_frame() advances the machine. */
export const DMG_CLOCK_HZ = 4194304;
export const FRAME_TCYCLES = 70224;
export const FRAME_HZ = DMG_CLOCK_HZ / FRAME_TCYCLES;   /* 59.7275, not 60 */

export const SCREEN_W = 160, SCREEN_H = 144;

/* gb_set_buttons bit order, from the comment on the export in src/gb.c.
 * The directions run RIGHT, LEFT, UP, DOWN -- not the order anybody types from
 * memory. test/ui_net.py verifies this against the core's own JOYP behaviour
 * rather than against this table. */
export const BTN = {
  A: 0, B: 1, SELECT: 2, START: 3,
  RIGHT: 4, LEFT: 5, UP: 6, DOWN: 7,
};
export const BTN_NAMES = ["A", "B", "Select", "Start", "Right", "Left", "Up", "Down"];

/* The arena is 32 MiB of static wasm memory (GB_CART_ARENA in src/gb.c). Its
 * base is measured at load, never assumed, and its SIZE is now read from the
 * core via gb_cart_capacity() -- this constant is only the fallback for an
 * artifact old enough not to export it. Two hardcoded copies of one number in
 * two languages is exactly how a shell comes to misreport the core it is
 * talking to. */
export const ARENA_BYTES = 32 * 1024 * 1024;

export class ArenaExhausted extends Error {
  constructor(want, used, capacity = ARENA_BYTES) {
    super(`cartridge arena exhausted: wanted ${want} B, ${capacity - used} B left ` +
          `of ${capacity} B (buddy allocator; the largest free block could not fit)`);
    this.name = "ArenaExhausted"; this.want = want; this.used = used;
    this.top = used;                      /* back-compat with older readers */
    this.capacity = capacity;
  }
}
export class PoolExhausted extends Error {
  constructor(n) {
    super(`instance pool exhausted at ${n} live machines (GB_MAX_INSTANCES in src/gb.c)`);
    this.name = "PoolExhausted"; this.live = n;
  }
}

/* ---------------------------------------------------------------------------
 *  GBHost — one wasm module instance, N machines, one cartridge arena.
 * ------------------------------------------------------------------------- */
export class GBHost {
  /** @param {BufferSource} wasmBytes */
  static async instantiate(wasmBytes) {
    /* The core is freestanding and imports nothing; an empty import object is
     * supplied so a stray import during a future rung fails loudly here rather
     * than silently at the first call. */
    const { instance } = await WebAssembly.instantiate(wasmBytes, { env: {} });
    return new GBHost(instance);
  }

  constructor(instance) {
    this.instance = instance;

    /* ---------------------------------------------------------------------
     *  THE DEVICE LOCK.  gb_set_device IS SEALED SHUT AT THIS BOUNDARY.
     *
     *  WHY THIS EXISTS AT ALL, given the core used to do it.
     *
     *  gb_set_device(gb, GB_DEV_CGB) USED TO RETURN 0 AND CHANGE NOTHING. The
     *  core enforced the fence itself, and every shell got the guarantee for
     *  free. THAT IS NO LONGER TRUE. The core lifted the refusal deliberately
     *  -- see the block headed "THE DOOR IS NOW OPEN" above gb_set_device in
     *  src/gb.c -- because reference vetting landed and the CGB layer is
     *  sanctioned WORK IN THE CORE. The core now accepts CGB:
     *
     *      int gb_set_device(struct GB *gb, int dev){
     *          if (dev == GB_DEV_DMG || dev == GB_DEV_CGB) { gb->dev = dev; return 1; }
     *
     *  The core opening that door is CORRECT AND NOT A DEFECT. It is the core's
     *  own work, and this file does not get an opinion about it. What
     *  changed is only this: the guarantee the SHELL was resting on stopped
     *  being enforced upstream, and nobody told the shell. So the shell enforces
     *  it here, at the one place every consumer has to come through.
     *
     *  WHAT GOES WRONG IF THIS LOCK IS NOT HERE. Not "colour looks odd":
     *
     *    1. A guard row still written GB_DMG_ONLY(...) RETURNS THE DMG VALUE in
     *       CGB mode and records itself as a fence breach. Those rows are, in
     *       the core's own words, "the ones where a CGB defect is invisible to
     *       every figure we print". A page that flips the device gets confident
     *       wrong pixels with every check still green -- the EXACT failure shape
     *       §2.3 of ABI.md calls the most important paragraph in the document.
     *    2. This shell reads the framebuffer format ONCE, below, with
     *       gb_frame_format(0), BEFORE any machine exists. A per-machine device
     *       switch after load cannot move that read. blitInto would keep taking
     *       the shade8 branch over what the core now considers colour.
     *
     *  Neither of those is a crash. Both are silent. That is why the answer is a
     *  throw and not a return value: a refusal is information, and information
     *  nobody is forced to read is not a fence.
     *
     *  WHAT WOULD HAVE TO BE TRUE TO LIFT THIS -- ALL OF IT, NOT SOME:
     *
     *    (a) the core reports a colour format for the machine in question, and
     *        this shell reads that format PER MACHINE rather than once at load;
     *    (b) blitInto's rgb555 branch is exercised by something that fails when
     *        it is wrong -- it is correct-and-untested today and ABI.md says so;
     *    (c) gb_fence_breach() reads ZERO for the run being presented, because a
     *        non-zero breach means fossil DMG values are being shown as CGB;
     *    (d) it arrives as a NEW ARTIFACT AND A NEW CONTRACT through UPDATING.md,
     *        with ABI.md §2.8 rewritten -- not as an edit to this line.
     *
     *  ***DELETING THIS STUB TO "SEE IF CGB WORKS" IS THE FAILURE, NOT THE
     *  EXPERIMENT.*** The experiment belongs in the core's own test bench, which owns
     *  the core and the fence audit. This is a consumer.
     *
     *  HOW IT IS ENFORCED. instance.exports is frozen by the WebAssembly spec,
     *  so it cannot be patched in place. this.exports is therefore a frozen
     *  SANITISED COPY: every export carried across by name, with gb_set_device
     *  replaced by the throwing stub. Frozen so that reassigning it back cannot
     *  take: from module or otherwise strict code -- which is every real
     *  consumer -- the write throws a TypeError; from a sloppy-mode console eval
     *  it is silently discarded. VERIFIED BOTH WAYS in the browser rather than
     *  reasoned about: the stub survives the assignment in either case, so the
     *  quiet arm is a lock that holds without complaining, not a hole.
     *
     *  ONLY THE MUTATOR IS SEALED. gb_get_device, gb_cgb_mode, gb_key0,
     *  gb_double_speed, gb_speed_stall and the gb_fence_* family are READ-ONLY
     *  observers and are carried across untouched. Locking them would buy
     *  nothing and would remove the only honest way to ask the core what it
     *  thinks it is.
     *
     *  THE ONE REMAINING WAY THROUGH, RECORDED RATHER THAN PRETENDED AWAY:
     *  this.instance still holds the raw WebAssembly.Instance, so
     *  host.instance.exports.gb_set_device reaches the open door. That is four
     *  deliberate steps past this comment and is not something anybody does by
     *  accident. It is left reachable because the field is part of GBHost's
     *  shape and this file belongs with the core, not the site. Anyone who uses it
     *  owns condition (c) above.
     * ------------------------------------------------------------------- */
    const raw = instance.exports;
    /* The refusal is TOTAL -- DMG is refused as well as CGB, and deliberately.
     * gb_create() zeroes the context and GB_DEV_DMG is 0, so the machine is
     * already DMG and setting it is a no-op; permitting the "harmless" call
     * would mean this stub had to branch on its argument, and a lock with a
     * conditional in it is a lock with a way through it. The message names the
     * argument so a DMG caller is not left reading a CGB explanation. */
    const deviceLocked = (_gb, dev) => {
      const which = dev === 0 ? "GB_DEV_DMG (0)"
                  : dev === 1 ? "GB_DEV_CGB (1)"
                  : `device ${dev}`;
      throw new Error(
        `REFUSED: gb_set_device(${which}) -- the device mode is locked by the ` +
        "shell, for every value. The CORE now ACCEPTS GB_DEV_CGB: the core " +
        "lifted its own refusal once the CGB layer was sanctioned, so the " +
        "guarantee this shell used to inherit is gone and is re-imposed here. " +
        "This shell reads the frame format ONCE at load and its rgb555 blit " +
        "path is correct-but-unexercised, so a device switch yields fossil DMG " +
        "values presented as CGB -- see gb_fence_breach(). DMG is refused too " +
        "because it is already the reset default and a lock that branches on " +
        "its argument is a lock with a way through it. CGB arrives as a NEW " +
        "ARTIFACT AND A NEW CONTRACT via UPDATING.md. Read the device-lock " +
        "note in web/core.js and ABI.md 2.8 before touching this; deleting " +
        "the stub to try CGB is the failure, not the experiment.");
    };
    /* The stub REPLACES the export and never INVENTS it. On an artifact with no
     * gb_set_device at all, "gb_set_device" in host.exports must stay false --
     * otherwise this lock would answer a capability probe with a lie, which is
     * the absence-read-as-presence mistake tools/stamp.mjs exists to refuse. */
    const sanitised = { ...raw };
    if ("gb_set_device" in raw) sanitised.gb_set_device = deviceLocked;
    this.exports = Object.freeze(sanitised);

    const e = this.exports;
    for (const n of ["gb_create", "gb_destroy", "gb_reset", "gb_set_cart", "gb_set_bios",
                     "gb_set_buttons", "gb_run_frame", "gb_frame_ptr",
                     "gb_frame_bytes", "gb_frame_pixels", "gb_frame_format",
                     "gb_cart_alloc", "gb_cart_reset", "gb_sizeof_context", "memory"]) {
      if (!(n in e)) throw new Error(`core is missing export ${n} -- stale build/gb.wasm?`);
    }
    this.coreVersion = e.core_version ? e.core_version() : 0;
    this.contextBytes = e.gb_sizeof_context();
    /* Framebuffer FORMAT, now STATED by the core rather than derived from its
     * length. Core version 2; guard row G21.
     *
     * WHAT THIS REPLACED, AND WHY THE OLD RULE WAS GOOD BUT OUT OF RANGE.
     * This used to read gb_frame_len() and infer the format from bytes per
     * pixel: 1 B/px meant a DMG shade index, 2 B/px meant 15-bit colour. That
     * anticipated the widening years early and was right to. But it can only
     * distinguish formats of DIFFERENT WIDTHS, and the core widened to 16 bits
     * while STILL CARRYING SHADE INDICES — two formats, one width.
     *
     * The core keeps shade indices on the DMG path deliberately: PALETTES below
     * is applied in blitInto's shade branch only, so a core that emitted greys
     * would silently retire the panel-colour choice. It also keeps every .raw in
     * the test estate a shade index, which is what the 31-raw fence compares.
     *
     * gb_frame_len() is GONE rather than redefined, and that is the point: a
     * stale shell reading 46080 would have matched its second handled size,
     * concluded "colour", and blitted noise. It now fails on the missing export
     * in the loop above, which is the loudest available failure.
     */
    this.frameBytes_ = e.gb_frame_bytes();
    this.framePixels = e.gb_frame_pixels();
    this.frameLen = this.frameBytes_;          /* BYTES, as it always meant */
    this.bytesPerPixel = this.frameBytes_ / this.framePixels;
    const FMT = { 0: "shade8", 1: "rgb555" };
    /* THE NULL-CONTEXT ANSWER, AND ONLY THAT. Kept because it is the honest
     * default before any machine exists, and because a core that reported an
     * unknown format should fail at load rather than at first blit. It is NOT
     * an answer about a machine: read GBMachine#frameFormat for that. */
    this.frameFormat = FMT[e.gb_frame_format(0)];
    if (!this.frameFormat) throw new Error(
      `core reports frame format ${e.gb_frame_format(0)}, which this shell does not know`);
    if (this.framePixels !== SCREEN_W * SCREEN_H) throw new Error(
      `core frame is ${this.framePixels} pixels; expected ${SCREEN_W * SCREEN_H}`);

    /* Measure the arena base rather than assuming it: allocate one byte from a
     * known-empty arena, note where it landed, then put the arena back. */
    e.gb_cart_reset();
    this.arenaBase = e.gb_cart_alloc(1);
    e.gb_cart_reset();
    if (!this.arenaBase) throw new Error("cart arena refused a 1-byte allocation at load");

    /* Asked of the core, not assumed, so the shell cannot drift from the
     * artifact it loaded. Older artifacts answer neither and get the
     * constants, which is what they were built against. */
    this.arenaBytes = typeof e.gb_cart_capacity === "function"
      ? e.gb_cart_capacity() >>> 0 : ARENA_BYTES;
    this.minBlock = typeof e.gb_cart_min_block === "function"
      ? e.gb_cart_min_block() >>> 0 : 1;
    /* Per-cartridge free exists only on a core built with the buddy allocator.
     * Without it the shell must keep the old whole-arena discipline, so the
     * capability is read once here rather than probed at every free. */
    this.canFreeBlocks = typeof e.gb_cart_free === "function";

    /* Two independent numbers for the same quantity (the UI design, section 3):
     *   arenaTop  -- the shell's ledger: BLOCK bytes currently allocated
     *   held      -- REQUESTED bytes currently allocated
     * The core answers the first question itself via gb_cart_used(), and
     * leaked is the disagreement between the two answers -- zero in health,
     * and non-zero only if a block was taken and then lost track of. Under the
     * old bump allocator arenaTop could only rise; it now falls again on free,
     * which is the whole point of the change.
     *   arenaTop - held is not a leak but ROUNDING: a buddy allocator hands
     * out whole blocks, so a 2304-byte boot program occupies a 32 KiB leaf.
     * That is reported separately as `rounding` and never as a leak. */
    this.arenaTop = 0;
    this.allocs = [];            /* {ptr, len, block, tag, owner} */
    /* Staged cartridges, keyed by the byte array itself and reference counted.
     * See _stageCart. */
    this.carts = new Map();      /* Uint8Array -> { ptr, len, refs } */
    this.live = new Set();
    this.reclaims = 0;           /* how many times the arena was actually reset */
    this.frees = 0;              /* how many individual blocks were released */
    this.switches = 0;

    /* NAMED BOOT PROGRAMS -- ONE HOST, N OF THEM.
     *
     * This used to be one (bytes, ptr) pair, which made the host DMG-or-CGB
     * and not both. That was a SHELL limitation and never an ABI one:
     * gb_set_bios(ctx, ptr, len) has always been PER CONTEXT, so the core
     * could already give two live machines two different boot programs. The
     * shell was collapsing a per-machine capability into a global.
     *
     * A CGB-only title needs the CGB boot program to be handed A = $11; with
     * the no-boot reset the core sets A = $01 unconditionally and the title
     * renders nothing. A DMG title needs the DMG one. Tiles share one host, so
     * one-bios-per-host cannot serve a wall carrying both.
     *
     * Keyed by kind ("dmg", "cgb"). Staged lazily and re-staged after an arena
     * reclaim, exactly as the single one was. */
    this.bioses = new Map();          /* kind -> { bytes, ptr } */
    this.audioPtr = 0;
    this.audioBytes = 0;
  }

  /** A fresh view every time: cheap, and never stale if the memory is ever grown. */
  get mem() { return new Uint8Array(this.exports.memory.buffer); }

  get held() {
    let n = 0;
    for (const a of this.allocs) n += a.len;
    return n;
  }
  /** Bytes lost to whole-block rounding. Expected and harmless; NOT a leak. */
  get rounding() { return this.arenaTop - this.held; }

  /** What the CORE says is allocated, which is an answer the shell did not
   *  compute. A disagreement with arenaTop is the accounting bug signal. */
  get leaked() {
    return typeof this.exports.gb_cart_used === "function"
      ? (this.exports.gb_cart_used() >>> 0) - this.arenaTop : 0;
  }

  /** The core's own count of allocated bytes.
   *  This REPLACES the old one-byte probe. That probe found the bump
   *  allocator's top by allocating from it, and so permanently leaked the byte
   *  it measured with; under a buddy allocator there is no single top to find
   *  anyway. gb_cart_used() answers the same question -- how much does the
   *  core think it has handed out -- and costs nothing. */
  probeArenaTop() {
    return typeof this.exports.gb_cart_used === "function"
      ? (this.exports.gb_cart_used() >>> 0) : this.arenaTop;
  }

  /** The block a request of this size will occupy: the buddy allocator's own
   *  rule, mirrored so the ledger records what was really taken. */
  _blockFor(len) {
    let size = this.minBlock;
    while (size < len) size <<= 1;
    return size;
  }

  /** Ownership of a dead machine's allocations, dropped -- and, on a core that
   *  can free, the blocks themselves released. Under the bump allocator the
   *  bytes stayed gone until the whole arena reset; that was D3 and it is now
   *  fixed rather than worked around. */
  _dropOwner(m) {
    const mine = this.allocs.filter(a => a.owner === m);
    for (const a of mine) this._free(a.ptr);
    this.allocs = this.allocs.filter(a => a.owner !== m);
  }

  _alloc(len, tag, owner) {
    const p = this.exports.gb_cart_alloc(len);
    if (!p) throw new ArenaExhausted(len, this.arenaTop, this.arenaBytes);
    const block = this._blockFor(len);
    this.allocs.push({ ptr: p, len, block, tag, owner });
    this.arenaTop += block;
    return p;
  }

  /** Release one block and forget it. Silent no-op on a core without
   *  gb_cart_free, which keeps this shell able to drive an older artifact. */
  _free(ptr) {
    if (!ptr) return false;
    const i = this.allocs.findIndex(a => a.ptr === ptr);
    if (i < 0) return false;
    if (this.canFreeBlocks && !this.exports.gb_cart_free(ptr)) {
      /* The core refused a pointer the ledger believes it owns. That is a
       * disagreement worth hearing about, not worth hiding. */
      console.warn(`[gb] core refused to free block at ${ptr} (${this.allocs[i].tag})`);
      return false;
    }
    this.arenaTop -= this.allocs[i].block;
    this.allocs.splice(i, 1);
    this.frees++;
    return true;
  }

  /* -------------------------------------------------------------------------
   * CARTRIDGES ARE STAGED ONCE AND SHARED.
   *
   * The same title can legitimately be running in two places at once -- a
   * catalogue tile and the drawer showing that tile's game. Staging it per
   * machine put the identical cartridge in the arena twice: measured at 5,767,168 B
   * of pure duplication on the Game Boy page, 41% of everything allocated.
   *
   * Keyed on the byte array's IDENTITY, because the caller already caches one
   * Uint8Array per cartridge, so two machines arriving with the same object
   * are asking for the same cartridge. No hashing, and no risk of two different
   * cartridges colliding on a digest.
   *
   * Sharing is safe because cartridge memory is read-only: writes to a cartridge
   * address go to the mapper or to save RAM, both of which live in the machine
   * context, never in this buffer.
   * ---------------------------------------------------------------------- */
  _stageCart(bytes, label) {
    let entry = this.carts.get(bytes);
    if (!entry) {
      const ptr = this._alloc(bytes.length, `cart:${label}`, null);
      this.mem.set(bytes, ptr);
      entry = { ptr, len: bytes.length, refs: 0 };
      this.carts.set(bytes, entry);
    }
    entry.refs++;
    return entry.ptr;
  }

  /** Drop one machine's claim on a staged cartridge; free it at zero. */
  _releaseCart(bytes) {
    const entry = this.carts.get(bytes);
    if (!entry) return false;
    if (--entry.refs > 0) return false;
    this.carts.delete(bytes);
    return this._free(entry.ptr);
  }

  /* The BIOS is user-supplied and optional. Without one the core takes its
   * documented no-BIOS reset path. Held in JS because every arena reclaim
   * destroys the staged copy and it has to go back. */
  setBios(bytes, kind = "dmg") {
    if (!bytes) { this.bioses.delete(kind); }
    else { this.bioses.set(kind, { bytes: new Uint8Array(bytes), ptr: 0 }); }
    for (const m of this.live) m.needsBios = true;
  }

  /** Is a boot program of this kind loaded? */
  hasBios(kind = "dmg") { return this.bioses.has(kind); }

  /* Back-compat readers for the DMG boot program. The diagnostics block and
   * any older caller still ask for these by name; they are now views onto the
   * "dmg" entry rather than the only entry there can be. */
  get biosBytes() { const b = this.bioses.get("dmg"); return b ? b.bytes : null; }
  get biosPtr()   { const b = this.bioses.get("dmg"); return b ? b.ptr : 0; }

  _stageBios(kind = "dmg") {
    const b = this.bioses.get(kind);
    if (!b) return null;
    if (!b.ptr) {
      b.ptr = this._alloc(b.bytes.length, `bios:${kind}`, null);
      this.mem.set(b.bytes, b.ptr);
    }
    return b;
  }

  /**
   * A scratch buffer inside wasm memory for the audio pull path.
   *
   * The core's audio export writes into caller memory, and the caller has no
   * allocator but the cart arena. So it is staged from the arena and, like the
   * BIOS, re-staged after every reclaim -- which is why no second core export
   * is needed for it. Idempotent: asking twice for the same size is free.
   */
  stageAudioBuffer(bytes) {
    if (this.audioPtr && this.audioBytes >= bytes) return this.audioPtr;
    this.audioBytes = bytes;
    this.audioPtr = this._alloc(bytes, "audio", null);
    return this.audioPtr;
  }

  /* D3's reclaim point. gb_cart_reset() resets the arena GLOBALLY, so it is
   * legal exactly when no machine holds a pointer into it. Returns whether it
   * fired -- the bench displays that, because "the arena was not reclaimed" is
   * the interesting case and it must not be silent. */
  _reclaim() {
    if (this.live.size > 0) return false;
    this.exports.gb_cart_reset();
    this.allocs.length = 0;
    this.carts.clear();
    this.arenaTop = 0;
    for (const b of this.bioses.values()) b.ptr = 0;
    this.audioPtr = 0;              /* re-staged by the audio source on demand */
    this.reclaims++;
    return true;
  }

  /**
   * Bring a machine up on a cartridge. The only construction path there is.
   * @param {Uint8Array} cartBytes user-supplied cartridge firmware
   * @param {{label?:string, useBios?:boolean, device?:string, bios?:string}} opts
   */
  create(cartBytes, opts = {}) {
    const label = opts.label || "cartridge";
    const useBios = opts.useBios !== false;
    const device = opts.device === "cgb" ? "cgb" : "dmg";
    /* Default the boot program to the device, because that pairing is the
     * whole point: a CGB machine handed the DMG boot program is handed A = $01
     * and a CGB-only title renders nothing. */
    const biosKind = opts.bios || device;
    if (!cartBytes || cartBytes.length < 0x150) {
      throw new Error(`${label}: a cartridge must be at least 0x150 bytes (header); got ${cartBytes ? cartBytes.length : 0}`);
    }
    const m = new GBMachine(this, label);
    const bios = useBios ? this._stageBios(biosKind) : null;
    /* Shared and reference counted -- see _stageCart. The machine records the
     * bytes it staged from so free() can drop exactly its own claim. */
    const cartPtr = this._stageCart(cartBytes, label);
    m.cartBytes = cartBytes;

    const ctx = this.exports.gb_create();
    if (!ctx) {
      /* Give the cartridge claim back. Under the bump allocator the bytes were
       * gone regardless and only the ownership could be corrected; now the
       * block is genuinely released, so a failed create costs nothing. */
      this._releaseCart(cartBytes); m.cartBytes = null;
      this._dropOwner(m);
      throw new PoolExhausted(this.live.size);
    }

    /* A brand-new context is memset to zero by gb_create, and gb_reset then
     * rebuilds it from the cartridge header alone. That, not hope, is why no
     * byte of the previous title can survive a switch. */
    /* ---------------------------------------------------------------------
     * THE DEVICE, AND THE STUB IS STILL SEALED.
     *
     * gb_set_device stays replaced by the throwing stub on this.exports. What
     * runs here is the raw instance export, which the device-lock note names
     * as "the one remaining way through" and makes a condition of use:
     * "Anyone who uses it owns condition (c)."
     *
     * WE OWN IT AND WE DO NOT MEET IT. gb_fence_breach() reads 1, not 0, on
     * all three CGB titles, because the CGB board breaches 11 guard rows on
     * every run -- it always has, and no CGB run this project has ever done
     * met condition (c). Discharging those rows is core work measured in guard
     * rows. These titles were asked twice to boot and to be tested by
     * playing, so the unlock is authorised with (c) KNOWINGLY UNMET.
     *
     * "Knowingly" is only true if it is visible, so the breach is READ BACK
     * off every CGB machine and published on m.fenceBreach for the UI, and
     * announced once per machine on the console. It is never swallowed and it
     * is never quietly satisfied.
     *
     * Condition (a) IS met: frame format is now read per machine (see
     * GBMachine#frameFormat), which is what makes the colour blit reachable.
     * Condition (b) is met by test/rgb555-blit.test.mjs. Condition (d) -- new
     * artifact, UPDATING.md, ABI 2.8 -- belongs to the core, not here.
     * ------------------------------------------------------------------- */
    if (device === "cgb") {
      /* The stub REPLACES and never INVENTS, so an artifact with no
       * gb_set_device has none here either. Say which artifact problem it is
       * rather than throwing "undefined is not a function". */
      if (typeof this.instance.exports.gb_set_device !== "function") {
        this.exports.gb_destroy(ctx);
        this._releaseCart(cartBytes); m.cartBytes = null;
        this._dropOwner(m);
        throw new Error(`${label}: this core has no gb_set_device; it cannot run a CGB title`);
      }
      const ok = this.instance.exports.gb_set_device(ctx, 1);
      if (!ok) {
        this.exports.gb_destroy(ctx);
        this._releaseCart(cartBytes); m.cartBytes = null;
        this._dropOwner(m);
        throw new Error(`${label}: core refused GB_DEV_CGB (gb_set_device returned 0)`);
      }
    }

    this.exports.gb_set_bios(ctx, bios ? bios.ptr : 0, bios ? bios.bytes.length : 0);
    this.exports.gb_set_cart(ctx, cartPtr, cartBytes.length);
    this.exports.gb_reset(ctx);

    m.ctx = ctx;
    m.cartPtr = cartPtr;
    m.cartLen = cartBytes.length;
    m.device = device;
    m.biosKind = bios ? biosKind : null;
    m.usedBios = !!bios;

    /* Read the fence AFTER reset, on the machine being presented. -1 means
     * the artifact cannot answer, which is NOT the same as zero and must never
     * be shown as a clean run. */
    m.fenceBreach = typeof this.exports.gb_fence_breach === "function"
      ? (this.exports.gb_fence_breach(ctx) | 0) : -1;
    if (device === "cgb" && m.fenceBreach !== 0) {
      console.warn(
        `[gb] ${label}: running as CGB with gb_fence_breach() = ${m.fenceBreach}. ` +
        "Condition (c) of the device lock is KNOWINGLY UNMET: guard rows still " +
        "return DMG values in CGB mode, so some pixels are fossil DMG values " +
        "presented as colour. The title boots; it is not therefore correct.");
    }
    this.live.add(m);
    return m;
  }

  /** Tear a machine down and reclaim the arena if it was the last one. */
  free(m) {
    if (!m || !this.live.delete(m)) return false;
    this.exports.gb_set_buttons(m.ctx, 0);   /* a held button must not outlive its machine */
    this.exports.gb_destroy(m.ctx);
    m.ctx = 0;
    /* The cartridge block comes back HERE, per machine, which is what D3 could
     * not do: the arena no longer has to wait for an empty host to recover
     * anything. If another machine is still running this same cartridge the block
     * stays, because the claim is reference counted, not owned. */
    if (m.cartBytes) { this._releaseCart(m.cartBytes); m.cartBytes = null; }
    this._dropOwner(m);
    /* Still attempted, and still only legal on an empty host. It is no longer
     * how the arena recovers -- it is a floor-sweep that also returns the boot
     * programs and the audio buffer once nothing at all is running. */
    this._reclaim();
    return true;
  }

  /**
   * THE switch path. One operation, used identically by the strip, the file
   * picker and the stress test, because a second path is a second thing to get
   * wrong. Frees the outgoing machine first so the reclaim in free() can fire.
   */
  switchTo(outgoing, cartBytes, opts = {}) {
    if (outgoing) this.free(outgoing);
    const m = this.create(cartBytes, opts);
    this.switches++;
    return m;
  }

  stats() {
    return {
      live: this.live.size,
      arenaTop: this.arenaTop,
      held: this.held,
      leaked: this.leaked,
      rounding: this.rounding,
      arenaBytes: this.arenaBytes,
      carts: this.carts.size,            /* distinct cartridges staged */
      cartRefs: Array.from(this.carts.values()).reduce((n, c) => n + c.refs, 0),
      reclaims: this.reclaims,
      frees: this.frees,
      switches: this.switches,
      biosStaged: !!this.biosPtr,
      /* Every boot program the host holds, and whether each is staged in the
       * arena right now. One host can hold both DMG and CGB. */
      bioses: Array.from(this.bioses, ([k, b]) => ({ kind: k, bytes: b.bytes.length, staged: !!b.ptr })),
    };
  }
}

/* ---------------------------------------------------------------------------
 *  GBMachine — one emulated console.
 * ------------------------------------------------------------------------- */
export class GBMachine {
  constructor(host, label) {
    this.host = host;
    this.label = label;
    this.ctx = 0;
    this.cartPtr = 0; this.cartLen = 0;
    this.frames = 0;
    this.buttons = 0;
    this.usedBios = false;
    this.needsBios = false;
    this.device = "dmg";
    this.biosKind = null;
    this.fenceBreach = 0;
  }

  get alive() { return this.ctx !== 0; }

  /**
   * THE FRAME FORMAT, READ PER MACHINE. This is condition (a) of the device
   * lock and it was the one blocker.
   *
   * The host still reads gb_frame_format(0) once at load, and that read is not
   * wrong -- it is the NULL-context answer, which the core defines as SHADE8.
   * It is simply not an answer about any machine. Two contexts can be alive at
   * once with different formats: a DMG machine reports SHADE8 and a CGB
   * machine reports BGR555. Asking the host means every machine inherits the
   * null answer, which is how a booting CGB title renders as garbage through
   * the shade8 branch -- a failure that looks like success.
   */
  get frameFormat() {
    if (!this.ctx) return this.host.frameFormat;
    const FMT = { 0: "shade8", 1: "rgb555" };
    const raw = this.host.exports.gb_frame_format(this.ctx);
    const f = FMT[raw];
    if (!f) throw new Error(
      `${this.label}: core reports frame format ${raw}, which this shell does not know`);
    return f;
  }

  runFrame() {
    this.host.exports.gb_run_frame(this.ctx);
    this.frames++;
  }

  /**
   * The framebuffer as ELEMENTS. A live view into wasm memory.
   *
   * KEYED ON THE ELEMENT WIDTH, NOT ON THE FORMAT, and the two stopped being
   * the same question at core version 2: the element is 16 bits wide while
   * still carrying shade indices, so a view chosen by format would read every
   * other byte and blit a diagonal smear. Width decides the view; format
   * decides what blitInto does with it.
   */
  get frame() {
    const e = this.host.exports;
    const ptr = e.gb_frame_ptr(this.ctx);
    const n = this.host.framePixels;
    return this.host.bytesPerPixel === 2
      ? new Uint16Array(e.memory.buffer, ptr, n)
      : new Uint8Array(e.memory.buffer, ptr, n);
  }

  /**
   * The same bytes, always as bytes. Anything that hashes or copies the frame
   * uses this, so it is format-agnostic by construction rather than by having
   * remembered to update it.
   */
  get frameBytes() {
    return new Uint8Array(this.host.exports.memory.buffer,
                          this.host.exports.gb_frame_ptr(this.ctx),
                          this.host.frameLen);
  }

  /** The whole context, for the clean-switch hash. */
  get context() {
    return new Uint8Array(this.host.exports.memory.buffer, this.ctx, this.host.contextBytes);
  }

  get cram() {
    const len = this.host.exports.gb_cram_len(this.ctx);
    if (!len) return null;
    return new Uint8Array(this.host.exports.memory.buffer,
                          this.host.exports.gb_cram_ptr(this.ctx), len);
  }
  get hasBattery() { return !!this.host.exports.gb_has_battery(this.ctx); }
  /* The MBC3 clock block (gb_rtc_ptr / gb_rtc_len, 20 bytes: latched S M H DL DH,
   * live S M H DL DH, the latch register, the cycle accumulator), a live view like
   * cram. null when the cartridge has no clock, or the core predates the export. */
  get rtc() {
    const e = this.host.exports;
    if (typeof e.gb_rtc_len !== "function") return null;
    const len = e.gb_rtc_len(this.ctx);
    return len ? new Uint8Array(e.memory.buffer, e.gb_rtc_ptr(this.ctx), len) : null;
  }
  get pc() { return this.host.exports.gb_reg_pc(this.ctx); }
  get locked() { return !!this.host.exports.gb_is_locked(this.ctx); }
  get stopped() { return !!this.host.exports.gb_is_stopped(this.ctx); }

  /**
   * Edge-driven, deliberately. The core raises the joypad interrupt on the
   * high-to-low transition inside gb_set_buttons, so calling it every frame
   * with an unchanged mask is harmless today but is a standing invitation to
   * get interrupts wrong. One call per changed mask, and no more.
   */
  setButtons(mask) {
    mask &= 0xFF;
    if (mask === this.buttons) return false;
    this.buttons = mask;
    this.host.exports.gb_set_buttons(this.ctx, mask);
    return true;
  }
}

/* ---------------------------------------------------------------------------
 *  Pacer — wall-clock to emulated frames, without drift.
 *
 *  The emulated rate is 59.7275 Hz and the display's is 60, 120 or 144. One
 *  gb_run_frame() per rAF is therefore wrong on every display. The fractional
 *  residue is KEPT, not discarded, so there is no systematic bias; catch-up is
 *  capped so a backgrounded tab returning does not spiral.
 * ------------------------------------------------------------------------- */
export class Pacer {
  constructor(hz = FRAME_HZ, maxCatchUp = 8) {
    this.hz = hz;
    this.maxCatchUp = maxCatchUp;
    this.acc = 0;
    this.last = null;
    this.frames = 0;
    this.elapsedMs = 0;
    this.dropped = 0;      /* frames abandoned to the catch-up cap */
  }
  reset(now = 0) { this.acc = 0; this.last = now; this.frames = 0; this.elapsedMs = 0; this.dropped = 0; }

  /** @returns {number} how many emulated frames to run for this tick. */
  step(now) {
    if (this.last === null) { this.last = now; return 0; }
    const dt = now - this.last;
    this.last = now;
    if (dt <= 0) return 0;
    this.elapsedMs += dt;
    this.acc += dt * this.hz / 1000;
    let n = 0;
    while (this.acc >= 1 && n < this.maxCatchUp) { this.acc -= 1; n++; }
    if (this.acc >= 1) {
      /* Too far behind to catch up: drop the backlog rather than accumulate a
       * debt that can never be paid. Counted, because a pacer that is quietly
       * dropping frames looks exactly like one that is keeping up. */
      this.dropped += Math.floor(this.acc);
      this.acc -= Math.floor(this.acc);
    }
    this.frames += n;
    return n;
  }

  /**
   * Frames ACCOUNTED FOR minus the frames wall time called for. Bounded ==
   * correct.
   *
   * Frames abandoned to the catch-up cap count as accounted: they were a
   * deliberate decision, not a pacing error, and folding them in here would
   * make the readout a record of how long the tab spent backgrounded rather
   * than a measure of the pacer. They are reported separately as `dropped`
   * precisely so that concession is visible and not hidden inside this number.
   */
  get drift() { return this.frames + this.dropped - this.elapsedMs * this.hz / 1000; }
}

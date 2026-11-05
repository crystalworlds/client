/*
 * play/cores/cheats-core.mjs -- the cheat engine's half inside a core module (2026-10-26).
 *
 * A core module (play/cores/<sys>/core.mjs) builds one of these when its loaded build exports the
 * cheat calls, and offers it as core.ext.cheats. The host (play/host/cheats.mjs) hands it the codes
 * of the cheats the player switched on, exactly as the per-game cheats file holds them
 * (format cw-cheats/1: { k, a, v, c, ... }); this file turns them into:
 *   - read patches (Game Genie): the core's own table, set through setSlot/clear. The table lives
 *     outside the machine's state, so saves, rewind and the picture are untouched while it is empty;
 *   - memory writes (GameShark, Action Replay, community codes): written after every frame, as the
 *     cartridge devices did once a frame.
 * The table is pushed again whenever the machine is rebuilt (a power-cycle Reset or a new cartridge
 * makes a new context), so cheats switched on survive Reset (the cheats design, section 2).
 *
 * o = {
 *   kinds:   the code kinds this build can run (['nes-gg', ...]); empty = no cheats on this build
 *   token(): what identifies the machine now (its context); a change pushes the table again
 *   slots:   the read-patch table's size (0 = no table)
 *   setSlot(i, a, v, c), clear()          the core's table calls (c = -1: no compare byte)
 *   poke(a, v) -> bool, pokeBank(bank, a, v) -> bool, peek(a) -> 0..255 or -1
 *   raAddr(a) -> the address a native memory code means on this console (default: a itself)
 * }
 */
export function cheatEngine(o) {
  const kinds = Array.isArray(o.kinds) ? o.kinds.slice() : [];
  let patches = [], writes = [], pushedFor = null, dirty = false;

  function push() {
    if (!o.slots) return;
    try {
      o.clear();
      patches.forEach((p, i) => o.setSlot(i, p.a, p.v, p.c == null ? -1 : p.c));
      pushedFor = o.token(); dirty = false;
    } catch (_) { pushedFor = null; }
  }
  /* One code -> patches and writes (or a refusal with the reason). */
  function plan(code, P, W) {
    const k = code && code.k;
    if (!kinds.includes(k)) return 'This code type does not run on this console yet.';
    const a = code.a | 0, v = code.v & 0xff, c = code.c == null ? null : code.c & 0xff;
    if (k === 'nes-gg' || k === 'gb-gg') { P.push({ a, v, c }); return null; }
    if (k === 'nes-raw') { if (a >= 0x8000) P.push({ a, v, c }); else W.push({ a, v, c }); return null; }
    if (k === 'nes-par') { W.push({ a, v }); return null; }
    if (k === 'gb-gs') {
      const t = code.t | 0, hi = t & 0xf0;
      W.push({ a, v, bank: (hi === 0x80 || hi === 0x90) ? (t & 0x0f) : -1 });
      return null;
    }
    if (k === 'ra-mem') {
      const size = code.size == null ? 3 : code.size | 0, n = Math.max(1, code.n | 0 || 1);
      const bytes = size >= 5 ? 4 : size === 4 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const base = (code.a | 0) + i * ((code.step | 0) || bytes), val = ((code.v | 0) + i * (code.vstep | 0)) >>> 0;
        if (bytes === 1 && size < 3) W.push({ a: o.raAddr ? o.raAddr(base) : base, mask: (code.bit | 0) & 0xff || (size === 2 ? 0x0f : size === 1 ? 0x03 : 0x01), v: val });
        else for (let b = 0; b < bytes; b++) {
          const sh = code.be ? (bytes - 1 - b) * 8 : b * 8;
          const at = base + b;
          W.push({ a: o.raAddr ? o.raAddr(at) : at, v: (val >>> sh) & 0xff });
        }
      }
      return null;
    }
    return 'This code type does not run on this console yet.';
  }
  return {
    /* The kinds this build can run: the host offers only cheats whose every code is in it. */
    kinds: () => kinds.slice(),
    /* codes: every code of every cheat that is on. Answers { ok, patches, max } or { ok: false, why }. */
    apply(codes) {
      const P = [], W = [];
      for (const code of codes || []) { const why = plan(code, P, W); if (why) return { ok: false, why }; }
      if (P.length > (o.slots | 0)) return { ok: false, why: `Too many codes at once (${P.length} of ${o.slots | 0}). Switch one off first.`, patches: P.length, max: o.slots | 0 };
      patches = P; writes = W; dirty = true;
      push();
      return { ok: true, patches: P.length, writes: W.length, max: o.slots | 0 };
    },
    /* After every frame (the core module's runFrame calls it). */
    frame() {
      if (!patches.length && !writes.length && !dirty) return;
      if (dirty || pushedFor !== o.token()) push();
      for (const w of writes) {
        if (w.c != null && o.peek && o.peek(w.a) !== w.c) continue;            // a compare code: only over the expected byte
        if (w.mask != null) {
          const cur = o.peek ? o.peek(w.a) : -1; if (cur < 0) continue;
          const sh = Math.max(0, 31 - Math.clz32(w.mask & -w.mask));
          o.poke(w.a, (cur & ~w.mask) | ((w.v << sh) & w.mask));
        } else if (w.bank != null && w.bank >= 0 && o.pokeBank) o.pokeBank(w.bank, w.a, w.v);
        else o.poke(w.a, w.v);
      }
    },
    active: () => patches.length + writes.length > 0,
  };
}

/*
 * play/cores/tft/jit.mjs -- block translation for the colour units' ARM code: the hot code in
 * the unit's ITCM, turned into one WebAssembly function at run time, with the twin's own
 * WebAssembly interpreter (play/twin.js, core.wasm) as the fallback for everything else.
 * Started 2026-10-15 (processor round, stage 2).
 *
 * WHY: 98 % of the units' instructions run from ITCM (measured with a PC histogram), at about 16 ns
 * each in the interpreter, which decodes every instruction and keeps registers and flags in
 * memory. Translated, each instruction is its own straight-line code with registers and flags
 * in WebAssembly locals and every address the PC reads known in advance.
 *
 * THE SAME MACHINE, INSTRUCTION FOR INSTRUCTION. Every translated instruction is the
 * interpreter's handler (WASM_Source/twin/assembly/core.ts) written out again for that one
 * encoding, in the same order of reads, writes and checks. Anything not written out here (IT
 * blocks, WFI / WFE, coprocessor, exceptions, any memory access outside the plain RAM and
 * flash regions) stops the translated code BEFORE the instruction, with all state stored, and
 * the interpreter runs it. A memory access is checked before anything is changed, exactly as
 * the interpreter checks it before trapping. The cycle count is one per instruction, the
 * budget is honoured instruction by instruction, and a branch to an exception return value
 * ends the run the way the interpreter's trap 3 does. Proved by the pictures, the sound and
 * save replay over long runs on both units.
 *
 * WHEN CODE CHANGES (self-modifying code, flash or RAM written back, DMA): the translation is
 * of a copy of the window's bytes. It is dropped the moment anything writes into the window:
 *   - the twin's JS writes call bus._smcCb for the ITCM region (the twin's own JIT hook), which
 *     this chains onto;
 *   - the interpreter's own stores into ITCM are routed through the twin's JS path while a
 *     translation is live (the ITCM entry of the interpreter's region table is marked
 *     read-only, which makes the interpreter hand such a store to cpu.js, which writes it);
 *   - a loaded state calls invalidate();
 *   - and as a check that nothing else writes there, the window is compared with the copy
 *     before every frame (a mismatch is counted in stats.unexpected and drops the translation).
 * It is made again once the window has held still for a while.
 */

/* ------------------------------------------------------------------ the WebAssembly writer */
const OP = {
  block: 0x02, loop: 0x03, if: 0x04, else: 0x05, end: 0x0b, br: 0x0c, br_if: 0x0d, br_table: 0x0e, return: 0x0f, call: 0x10,
  drop: 0x1a, select: 0x1b, lget: 0x20, lset: 0x21, ltee: 0x22,
  i32load: 0x28, i32load8s: 0x2c, i32load8u: 0x2d, i32load16s: 0x2e, i32load16u: 0x2f, i32store: 0x36, i32store8: 0x3a, i32store16: 0x3b,
  i32const: 0x41, i64const: 0x42,
  eqz: 0x45, eq: 0x46, ne: 0x47, lt_s: 0x48, lt_u: 0x49, gt_s: 0x4a, gt_u: 0x4b, le_s: 0x4c, le_u: 0x4d, ge_s: 0x4e, ge_u: 0x4f,
  i64ne: 0x52,
  clz: 0x67, add: 0x6a, sub: 0x6b, mul: 0x6c, div_s: 0x6d, div_u: 0x6e, and: 0x71, or: 0x72, xor: 0x73, shl: 0x74, shr_s: 0x75, shr_u: 0x76, rotr: 0x78,
  i64add: 0x7c, i64mul: 0x7e, i64or: 0x84, i64shl: 0x86, i64shr_u: 0x88,
  wrap: 0xa7, ext_s: 0xac, ext_u: 0xad, ext8s: 0xc0, ext16s: 0xc1,
};
const uleb = (n, out) => { n >>>= 0; do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; out.push(b); } while (n); return out; };
const sleb = (n, out) => { n |= 0; for (;;) { const b = n & 0x7f; n >>= 7; if ((n === 0 && !(b & 0x40)) || (n === -1 && (b & 0x40))) { out.push(b); return out; } out.push(b | 0x80); } };
const sleb64 = (n, out) => { n = BigInt.asIntN(64, BigInt(n)); for (;;) { const b = Number(n & 0x7fn); n >>= 7n; if ((n === 0n && !(b & 0x40)) || (n === -1n && (b & 0x40))) { out.push(b); return out; } out.push(b | 0x80); } };
const append = (o, a) => { for (let i = 0; i < a.length; i++) o.push(a[i]); return o; };   // no spread: bodies are large
const vec = (items, out) => { uleb(items.length, out); for (const it of items) append(out, it); return out; };
const section = (id, body) => { const o = [id]; uleb(body.length, o); return append(o, body); };

/* Expression pieces are plain byte arrays. */
const c32 = v => sleb(v | 0, [OP.i32const]);
const get = l => uleb(l, [OP.lget]);
const set = (l, e) => [...e, ...uleb(l, [OP.lset])];
const tee = (l, e) => [...e, ...uleb(l, [OP.ltee])];
const bin = (o, a, b) => [...a, ...b, o];
const un = (o, a) => [...a, o];
const ld = (o, addr, off = 0) => [...addr, o, o === OP.i32load ? 2 : o === OP.i32load16u || o === OP.i32load16s ? 1 : 0, ...uleb(off, [])];
const st = (o, addr, val, off = 0) => [...addr, ...val, o, o === OP.i32store ? 2 : o === OP.i32store16 ? 1 : 0, ...uleb(off, [])];
const add = (a, b) => bin(OP.add, a, b), sub = (a, b) => bin(OP.sub, a, b), and = (a, b) => bin(OP.and, a, b), or = (a, b) => bin(OP.or, a, b);
const xor = (a, b) => bin(OP.xor, a, b), shl = (a, b) => bin(OP.shl, a, b), shru = (a, b) => bin(OP.shr_u, a, b), shrs = (a, b) => bin(OP.shr_s, a, b);
const not = a => xor(a, c32(-1));

/* Linear-memory header (core.ts): registers at 0, flags at 0x40.., IT 0x50, trap words 0x54..0x64. */
const F_N = 0x40, F_Z = 0x44, F_C = 0x48, F_V = 0x4c, IT = 0x50, TRAP_ADDR = 0x54, TRAP_REASON = 0x58, TRAP_HW1 = 0x5c, TRAP_HW2 = 0x60, PC_OUT = 0x64;
const EXIT_KIND = 0x70;          // free header word (core.ts uses up to 0x67, RCNT 0xB8, RTAB 0xC0)
const RCNT = 0xb8, RTAB = 0xc0;

/* Locals of the translated function. */
const P_PC = 0, P_BUD = 1;
const R = n => 2 + n;           // r0..r14 -> 2..16
const LN = 17, LZ = 18, LC = 19, LV = 20, CNT = 21, PC = 22, BRF = 23, TGT = 24;
const T = n => 25 + n;          // i32 temporaries 25..36
const NT = 12;
const Q = n => 25 + NT + n;     // i64 temporaries
const NQ = 3;

/* ------------------------------------------------------------------ the translator */
class Emit {
  constructor(regions, win) {
    this.b = []; this.depth = 0; this.regions = regions; this.win = win;
    this.exitLabel = null; this.loopLabel = null;
  }
  push(...a) { for (const x of a) this.b.push(...x); }
  open(kind, type = 0x40) { this.b.push(kind, type); return ++this.depth; }
  close() { this.b.push(OP.end); this.depth--; }
  brTo(label) { this.b.push(OP.br, ...uleb(this.depth - label, [])); }
  rel(label) { return this.depth - label; }
}

/* condTrue(cond) as an expression on the flag locals. */
function cond(c) {
  const N = get(LN), Z = get(LZ), C = get(LC), V = get(LV);
  switch (c) {
    case 0x0: return Z;                                   // Z == 1 (flags are 0/1)
    case 0x1: return un(OP.eqz, Z);
    case 0x2: return C;
    case 0x3: return un(OP.eqz, C);
    case 0x4: return N;
    case 0x5: return un(OP.eqz, N);
    case 0x6: return V;
    case 0x7: return un(OP.eqz, V);
    case 0x8: return and(C, un(OP.eqz, Z));
    case 0x9: return or(un(OP.eqz, C), Z);
    case 0xA: return bin(OP.eq, N, V);
    case 0xB: return bin(OP.ne, N, V);
    case 0xC: return and(un(OP.eqz, Z), bin(OP.eq, N, V));
    case 0xD: return or(Z, bin(OP.ne, N, V));
    default: return c32(1);
  }
}

const popcount = x => { let n = 0; x &= 0xffff; while (x) { n += x & 1; x >>>= 1; } return n; };

/*
 * Translate one instruction at `pc` into `e`. Returns false if it is not written out here
 * (the caller then emits a stop before it). `ctx` carries the instruction's halfwords.
 */
function translate(e, pc, hw1, hw2, is32, inIT = false, itOk = false) {
  const S16 = !inIT;                 // 16-bit data processing sets flags only outside an IT block
  const out = [];                 // pieces of this instruction's code
  const emit = (...a) => { for (const x of a) out.push(...x); };
  let mayBranch = false;
  // Helpers mirroring core.ts, in this instruction's context.
  const readReg = n => (n === 15 ? c32((pc + 4) | 0) : get(R(n)));
  const pcAligned = () => c32(((pc + 4) & ~3) | 0);
  const wr = (n, ex) => emit(set(R(n), ex));            // rd() / wr(): plain register (never 15 here)
  const writeReg = (n, ex) => {                           // n == 15 -> a branch at the end
    if (n === 15) { mayBranch = true; emit(set(TGT, and(ex, c32(~1))), set(BRF, c32(1))); }
    else emit(set(R(n), ex));
  };
  const setNZ = ex => emit(set(T(11), ex), set(LN, shru(get(T(11)), c32(31))), set(LZ, un(OP.eqz, get(T(11)))));
  /* addWithCarry(x, y, cin) -> T(8) result, T(9) carry, T(10) overflow (x, y kept in T(6), T(7)). */
  const awc = (x, y, cin) => emit(
    set(T(6), x), set(T(7), y),
    set(Q(0), bin(OP.i64add, bin(OP.i64add, un(OP.ext_u, get(T(6))), un(OP.ext_u, get(T(7)))), un(OP.ext_u, cin))),
    set(T(8), un(OP.wrap, get(Q(0)))),
    set(T(9), un(OP.wrap, bin(OP.i64shr_u, get(Q(0)), sleb64(32, [OP.i64const])))),
    set(T(10), shru(and(xor(get(T(6)), get(T(8))), xor(get(T(7)), get(T(8)))), c32(31))));
  const awFlags = () => emit(set(LN, shru(get(T(8)), c32(31))), set(LZ, un(OP.eqz, get(T(8)))), set(LC, get(T(9))), set(LV, get(T(10))));
  /* Shifts with carry (lslC / lsrC / asrC / rorC): value in T(4), result T(4) (sh_val), T(5) (sh_c). */
  const shiftConst = (type, value, amount) => {           // amount known now (imm forms, after the 0 -> 32 mapping)
    emit(set(T(4), value));
    if (type === 'lsl') {
      if (amount === 0) { emit(set(T(5), get(LC))); return; }
      if (amount >= 32) { emit(set(T(5), amount === 32 ? and(get(T(4)), c32(1)) : c32(0)), set(T(4), c32(0))); return; }
      emit(set(T(5), and(shru(get(T(4)), c32(32 - amount)), c32(1))), set(T(4), shl(get(T(4)), c32(amount))));
    } else if (type === 'lsr') {
      if (amount === 0) { emit(set(T(5), get(LC))); return; }
      if (amount >= 32) { emit(set(T(5), amount === 32 ? shru(get(T(4)), c32(31)) : c32(0)), set(T(4), c32(0))); return; }
      emit(set(T(5), and(shru(get(T(4)), c32(amount - 1)), c32(1))), set(T(4), shru(get(T(4)), c32(amount))));
    } else if (type === 'asr') {
      if (amount === 0) { emit(set(T(5), get(LC))); return; }
      if (amount >= 32) { emit(set(T(5), shru(get(T(4)), c32(31))), set(T(4), shrs(get(T(4)), c32(31)))); return; }
      emit(set(T(5), and(shru(get(T(4)), c32(amount - 1)), c32(1))), set(T(4), shrs(get(T(4)), c32(amount))));
    } else if (type === 'ror') {
      const a = amount & 31;
      if (a === 0) { emit(set(T(5), shru(get(T(4)), c32(31)))); return; }
      emit(set(T(4), bin(OP.rotr, get(T(4)), c32(a))), set(T(5), shru(get(T(4)), c32(31))));
    } else if (type === 'rrx') {
      emit(set(T(5), and(get(T(4)), c32(1))), set(T(4), or(shl(get(LC), c32(31)), shru(get(T(4)), c32(1)))));
    }
  };
  /* applyShiftC(value, type, imm5) */
  const applyShift = (value, type, imm5) => {
    if (type === 0) return shiftConst('lsl', value, imm5);
    if (type === 1) return shiftConst('lsr', value, imm5 === 0 ? 32 : imm5);
    if (type === 2) return shiftConst('asr', value, imm5 === 0 ? 32 : imm5);
    if (imm5 === 0) return shiftConst('rrx', value, 0);
    return shiftConst('ror', value, imm5);
  };
  /* Shift by a register amount (0..255) in T(3): lslC / lsrC / asrC / rorC with runtime cases. */
  const shiftDyn = (type, value) => {
    emit(set(T(4), value));
    const ifc = (c, a, b) => [...c, OP.if, 0x40, ...a, ...(b ? [OP.else, ...b] : []), OP.end];
    const amt = get(T(3)), A0 = un(OP.eqz, amt);
    if (type === 'ror') {
      emit(set(T(2), and(amt, c32(31))));
      emit(ifc(un(OP.eqz, get(T(2))), set(T(5), shru(get(T(4)), c32(31))),
        [...set(T(4), bin(OP.rotr, get(T(4)), get(T(2)))), ...set(T(5), shru(get(T(4)), c32(31)))]));
      return;
    }
    let ge32, mid;
    if (type === 'lsl') {
      ge32 = [...set(T(5), bin(OP.eq, amt, c32(32))), ...set(T(5), and(get(T(5)), and(get(T(4)), c32(1)))), ...set(T(4), c32(0))];
      mid = [...set(T(5), and(shru(get(T(4)), sub(c32(32), amt)), c32(1))), ...set(T(4), shl(get(T(4)), amt))];
    } else if (type === 'lsr') {
      ge32 = [...set(T(5), and(bin(OP.eq, amt, c32(32)), shru(get(T(4)), c32(31)))), ...set(T(4), c32(0))];
      mid = [...set(T(5), and(shru(get(T(4)), sub(amt, c32(1))), c32(1))), ...set(T(4), shru(get(T(4)), amt))];
    } else {                                                // asr
      ge32 = [...set(T(5), shru(get(T(4)), c32(31))), ...set(T(4), shrs(get(T(4)), c32(31)))];
      mid = [...set(T(5), and(shru(get(T(4)), sub(amt, c32(1))), c32(1))), ...set(T(4), shrs(get(T(4)), amt))];
    }
    emit(ifc(A0, set(T(5), get(LC)), ifc(bin(OP.ge_u, amt, c32(32)), ge32, mid)));
  };
  /* Memory: map(a, size, write) -> offset or -1 (module function 0). A failed map stops the
     translated code before this instruction (the interpreter then traps it, as before). */
  const mapInto = (tl, addr, size, write) => emit(set(tl, [...addr, ...c32(size), ...c32(write ? 1 : 0), OP.call, 0]));
  const failExit = tl => emit([...bin(OP.lt_s, get(tl), c32(0)), OP.if, 0x40, ...CUR.stop(1), OP.end]);
  const loadSized = (size, signed, offEx) => size === 0 ? ld(signed ? OP.i32load8s : OP.i32load8u, offEx)
    : size === 1 ? ld(signed ? OP.i32load16s : OP.i32load16u, offEx) : ld(OP.i32load, offEx);
  /* memLoad(size, signed, rt, addr) */
  const memLoad = (size, signed, rt, addr) => {
    emit(set(T(0), addr));
    mapInto(T(1), get(T(0)), size === 2 ? 4 : size === 1 ? 2 : 1, false); failExit(T(1));
    const v = loadSized(size, signed, get(T(1)));
    if (rt === 15) { mayBranch = true; emit(set(TGT, and(v, c32(~1))), set(BRF, c32(1))); }
    else writeReg(rt, v);
  };
  /* memStore(size, rt, addr) */
  const memStore = (size, rt, addr) => {
    emit(set(T(0), addr));
    mapInto(T(1), get(T(0)), size === 2 ? 4 : size === 1 ? 2 : 1, true); failExit(T(1));
    const v = readReg(rt);
    emit(size === 0 ? st(OP.i32store8, get(T(1)), v) : size === 1 ? st(OP.i32store16, get(T(1)), v) : st(OP.i32store, get(T(1)), v));
  };
  const branchTo = target => { mayBranch = true; emit(set(TGT, c32(target | 0)), set(BRF, c32(1))); };

  let ok = true;
  if (!is32) {
    const op = hw1;
    switch (op >>> 12) {
      case 0x0: case 0x1: {                                  // dp_shift_addsub (S = !itActive = true here)
        const opc = (op >>> 11) & 3, rdi = op & 7, rm = (op >>> 3) & 7;
        if (opc === 3) {
          const subOp = (op >>> 9) & 1, imm = (op >>> 10) & 1;
          const opnd = imm ? c32((op >>> 6) & 7) : get(R((op >>> 6) & 7));
          if (subOp) awc(get(R(rm)), not(opnd), c32(1)); else awc(get(R(rm)), opnd, c32(0));
          wr(rdi, get(T(8))); if (S16) awFlags();
        } else {
          const amt = (op >>> 6) & 0x1f;
          if (opc === 0) shiftConst('lsl', get(R(rm)), amt);
          else if (opc === 1) shiftConst('lsr', get(R(rm)), amt === 0 ? 32 : amt);
          else shiftConst('asr', get(R(rm)), amt === 0 ? 32 : amt);
          wr(rdi, get(T(4))); if (S16) { setNZ(get(T(4))); emit(set(LC, get(T(5)))); }
        }
        break;
      }
      case 0x2: case 0x3: {                                  // dp_mov_cmp_add_sub_imm8
        const opc = (op >>> 11) & 3, rdi = (op >>> 8) & 7, imm = op & 0xff;
        if (opc === 0) { wr(rdi, c32(imm)); if (S16) setNZ(c32(imm)); }
        else if (opc === 1) { awc(get(R(rdi)), c32(~imm), c32(1)); awFlags(); }
        else if (opc === 2) { awc(get(R(rdi)), c32(imm), c32(0)); wr(rdi, get(T(8))); if (S16) awFlags(); }
        else { awc(get(R(rdi)), c32(~imm), c32(1)); wr(rdi, get(T(8))); if (S16) awFlags(); }
        break;
      }
      case 0x4: {
        if (op < 0x4400) {                                   // dp_alu
          const opc = (op >>> 6) & 0xf, rdi = op & 7, rm = (op >>> 3) & 7;
          emit(set(T(0), get(R(rdi))), set(T(1), get(R(rm))));
          const a = get(T(0)), m = get(T(1));
          const nz = x => { if (S16) setNZ(x); };
          const nzc = () => { if (S16) { setNZ(get(T(4))); emit(set(LC, get(T(5)))); } };
          const nzcv = () => { if (S16) awFlags(); };
          switch (opc) {
            case 0x0: emit(set(T(11), and(a, m))); wr(rdi, get(T(11))); nz(get(T(11))); break;
            case 0x1: emit(set(T(11), xor(a, m))); wr(rdi, get(T(11))); nz(get(T(11))); break;
            case 0x2: emit(set(T(3), and(m, c32(0xff)))); shiftDyn('lsl', a); wr(rdi, get(T(4))); nzc(); break;
            case 0x3: emit(set(T(3), and(m, c32(0xff)))); shiftDyn('lsr', a); wr(rdi, get(T(4))); nzc(); break;
            case 0x4: emit(set(T(3), and(m, c32(0xff)))); shiftDyn('asr', a); wr(rdi, get(T(4))); nzc(); break;
            case 0x5: awc(a, m, get(LC)); wr(rdi, get(T(8))); nzcv(); break;
            case 0x6: awc(a, not(m), get(LC)); wr(rdi, get(T(8))); nzcv(); break;
            case 0x7: emit(set(T(3), and(m, c32(0xff)))); shiftDyn('ror', a); wr(rdi, get(T(4))); nzc(); break;
            case 0x8: setNZ(and(a, m)); break;
            case 0x9: awc(c32(0), not(m), c32(1)); wr(rdi, get(T(8))); nzcv(); break;
            case 0xA: awc(a, not(m), c32(1)); awFlags(); break;
            case 0xB: awc(a, m, c32(0)); awFlags(); break;
            case 0xC: emit(set(T(11), or(a, m))); wr(rdi, get(T(11))); nz(get(T(11))); break;
            case 0xD: emit(set(T(11), bin(OP.mul, a, m))); wr(rdi, get(T(11))); nz(get(T(11))); break;
            case 0xE: emit(set(T(11), and(a, not(m)))); wr(rdi, get(T(11))); nz(get(T(11))); break;
            default: emit(set(T(11), not(m))); wr(rdi, get(T(11))); nz(get(T(11))); break;
          }
        } else if (op < 0x4800) {                            // hireg_bx
          const opc = (op >>> 8) & 3, dn = ((op >>> 4) & 8) | (op & 7), rm = (op >>> 3) & 0xf;
          if (opc === 0) writeReg(dn, add(readReg(dn), readReg(rm)));
          else if (opc === 1) { awc(readReg(dn), not(readReg(rm)), c32(1)); awFlags(); }
          else if (opc === 2) writeReg(dn, readReg(rm));
          else {
            const link = (op >>> 7) & 1;
            emit(set(T(0), readReg(rm)));
            if (link) wr(14, c32(((pc + 2) | 1) | 0));
            mayBranch = true; emit(set(TGT, and(get(T(0)), c32(~1))), set(BRF, c32(1)));
          }
        } else {                                             // ldr_literal
          const rt = (op >>> 8) & 7, imm = (op & 0xff) << 2;
          memLoad(2, false, rt, c32((((pc + 4) & ~3) + imm) | 0));
        }
        break;
      }
      case 0x5: {                                            // ldst_reg
        const opc = (op >>> 9) & 7, rt = op & 7, rn = (op >>> 3) & 7, rm = (op >>> 6) & 7;
        const addr = add(get(R(rn)), get(R(rm)));
        switch (opc) {
          case 0: memStore(2, rt, addr); break; case 1: memStore(1, rt, addr); break; case 2: memStore(0, rt, addr); break;
          case 3: memLoad(0, true, rt, addr); break; case 4: memLoad(2, false, rt, addr); break; case 5: memLoad(1, false, rt, addr); break;
          case 6: memLoad(0, false, rt, addr); break; default: memLoad(1, true, rt, addr); break;
        }
        break;
      }
      case 0x6: case 0x7: {                                  // ldst_imm_word_byte
        const isByte = (op >>> 12) & 1, load = (op >>> 11) & 1, rt = op & 7, rn = (op >>> 3) & 7;
        let imm = (op >>> 6) & 0x1f; if (!isByte) imm <<= 2;
        const addr = add(get(R(rn)), c32(imm));
        if (load) memLoad(isByte ? 0 : 2, false, rt, addr); else memStore(isByte ? 0 : 2, rt, addr);
        break;
      }
      case 0x8: {                                            // ldst_imm_half
        const load = (op >>> 11) & 1, rt = op & 7, rn = (op >>> 3) & 7;
        const addr = add(get(R(rn)), c32(((op >>> 6) & 0x1f) << 1));
        if (load) memLoad(1, false, rt, addr); else memStore(1, rt, addr);
        break;
      }
      case 0x9: {                                            // ldst_sp
        const load = (op >>> 11) & 1, rt = (op >>> 8) & 7, imm = (op & 0xff) << 2;
        const addr = add(get(R(13)), c32(imm));
        if (load) memLoad(2, false, rt, addr); else memStore(2, rt, addr);
        break;
      }
      case 0xA: {                                            // adr_add_sp
        const sp = (op >>> 11) & 1, rdi = (op >>> 8) & 7, imm = (op & 0xff) << 2;
        wr(rdi, sp ? add(get(R(13)), c32(imm)) : c32((((pc + 4) & ~3) + imm) | 0));
        break;
      }
      case 0xB: {                                            // misc16
        if ((op & 0x0f00) === 0x0000) {
          const imm = (op & 0x7f) << 2;
          wr(13, ((op >>> 7) & 1) ? sub(get(R(13)), c32(imm)) : add(get(R(13)), c32(imm)));
          break;
        }
        const hi = (op >>> 8) & 0xf;
        if (hi === 0x1 || hi === 0x3 || hi === 0x9 || hi === 0xb) {   // cbz / cbnz
          const nonzero = (op >>> 11) & 1, rn = op & 7;
          const imm = (((op >>> 9) & 1) << 6) | (((op >>> 3) & 0x1f) << 1);
          const taken = nonzero ? bin(OP.ne, get(R(rn)), c32(0)) : un(OP.eqz, get(R(rn)));
          mayBranch = true;
          emit([...taken, OP.if, 0x40, ...set(TGT, c32(((pc + 4) + imm) | 0)), ...set(BRF, c32(1)), OP.end]);
          break;
        }
        if ((op & 0xfe00) === 0xb400 || (op & 0xfe00) === 0xbc00) {    // push / pop
          const pop = (op >>> 11) & 1, list = op & 0xff, extra = (op >>> 8) & 1;
          if (pop) {
            const n = popcount(list) + (extra ? 1 : 0);
            emit(set(T(2), get(R(13))));
            mapInto(T(1), get(T(2)), 4 * n, false); failExit(T(1));
            let k = 0;
            for (let i = 0; i < 8; i++) if (list & (1 << i)) { wr(i, ld(OP.i32load, get(T(1)), 4 * k)); k++; }
            if (extra) { mayBranch = true; emit(set(TGT, and(ld(OP.i32load, get(T(1)), 4 * k), c32(~1))), set(BRF, c32(1))); k++; }
            wr(13, add(get(T(2)), c32(4 * k)));
          } else {
            let n = extra ? 1 : 0; for (let i = 0; i < 8; i++) if (list & (1 << i)) n++;
            emit(set(T(2), sub(get(R(13)), c32(4 * n))));
            mapInto(T(1), get(T(2)), 4 * n, true); failExit(T(1));
            let k = 0;
            for (let i = 0; i < 8; i++) if (list & (1 << i)) { emit(st(OP.i32store, get(T(1)), get(R(i)), 4 * k)); k++; }
            if (extra) emit(st(OP.i32store, get(T(1)), get(R(14)), 4 * k));
            wr(13, get(T(2)));
          }
          break;
        }
        if ((op & 0xff00) === 0xb200) {                                // SXTH, SXTB, UXTH, UXTB
          const opc = (op >>> 6) & 3, rdi = op & 7, rm = (op >>> 3) & 7, v = get(R(rm));
          wr(rdi, opc === 0 ? un(OP.ext16s, v) : opc === 1 ? un(OP.ext8s, v) : opc === 2 ? and(v, c32(0xffff)) : and(v, c32(0xff)));
          break;
        }
        if ((op & 0xff00) === 0xba00) {                                // REV, REV16, REVSH
          const opc = (op >>> 6) & 3, rdi = op & 7, rm = (op >>> 3) & 7;
          if (opc === 2) { ok = false; break; }
          emit(set(T(0), get(R(rm)))); const v = get(T(0));
          if (opc === 0) wr(rdi, or(or(shl(and(v, c32(0xff)), c32(24)), shl(and(v, c32(0xff00)), c32(8))), or(and(shru(v, c32(8)), c32(0xff00)), shru(v, c32(24)))));
          else if (opc === 1) wr(rdi, or(or(shl(and(v, c32(0xff)), c32(8)), shru(and(v, c32(0xff00)), c32(8))), or(shl(and(v, c32(0xff0000)), c32(8)), shru(and(v, c32(0xff000000 | 0)), c32(8)))));
          else wr(rdi, un(OP.ext16s, or(shl(and(v, c32(0xff)), c32(8)), and(shru(v, c32(8)), c32(0xff)))));
          break;
        }
        if ((op & 0xff00) === 0xbf00) {
          if ((op & 0x000f) === 0) { const hint = (op >>> 4) & 0xf; if (hint === 2 || hint === 3) ok = false; break; }   // WFE / WFI: the interpreter
          if (!itOk) ok = false;                                       // IT: written out with its block (buildModule), else the interpreter
          break;
        }
        if ((op & 0xffe8) === 0xb660) break;                           // CPS -> NOP
        ok = false; break;
      }
      case 0xC: {                                            // ldm_stm16
        const load = (op >>> 11) & 1, rn = (op >>> 8) & 7, list = op & 0xff;
        const n = popcount(list);
        emit(set(T(2), get(R(rn))));
        mapInto(T(1), get(T(2)), 4 * n, !load); failExit(T(1));
        let k = 0;
        if (load) {
          for (let i = 0; i < 8; i++) if (list & (1 << i)) { wr(i, ld(OP.i32load, get(T(1)), 4 * k)); k++; }
          if (!(list & (1 << rn))) wr(rn, add(get(T(2)), c32(4 * k)));
        } else {
          for (let i = 0; i < 8; i++) if (list & (1 << i)) { emit(st(OP.i32store, get(T(1)), get(R(i)), 4 * k)); k++; }
          wr(rn, add(get(T(2)), c32(4 * k)));
        }
        break;
      }
      case 0xD: {                                            // cond_branch_svc
        const cc = (op >>> 8) & 0xf;
        if (cc === 0xe || cc === 0xf) { ok = false; break; }
        const imm = ((op & 0xff) << 24) >> 24;
        mayBranch = true;
        emit([...cond(cc), OP.if, 0x40, ...set(TGT, c32(((pc + 4) + (imm << 1)) | 0)), ...set(BRF, c32(1)), OP.end]);
        break;
      }
      case 0xE: {                                            // uncond_branch
        const imm = ((op & 0x7ff) << 21) >> 21;
        branchTo((pc + 4) + (imm << 1));
        break;
      }
      default: ok = false;
    }
  } else {
    ok = translate32(pc, hw1, hw2, { emit, readReg, pcAligned, wr, writeReg, setNZ, awc, awFlags, applyShift, shiftDyn, memLoad, memStore, mapInto, failExit, branchTo,
      setBranch: () => { mayBranch = true; } });
  }
  return ok ? { code: out, mayBranch } : null;
}

/* "Stop before this instruction": set by buildModule for the instruction being translated
   (PC = its address; br to the exit block, `extra` levels of nesting deeper). */
const CUR = { stop: () => { throw new Error('no instruction context'); } };

function translate32(pc, hw1, hw2, h) {
  const { emit, readReg, wr, writeReg, setNZ, awc, awFlags, applyShift, shiftDyn, memLoad, memStore, mapInto, failExit, branchTo } = h;
  const op1 = (hw1 >>> 11) & 3;
  const dpTail = (op, S, rn, rdi, a, m, carry, isMod) => {   // the shared body of dp_modimm / dp_shifted_reg
    // a: rn's value expression; m: operand expression (in a local already); carry: carry expression.
    const res = T(11);
    const nzc = () => { setNZ(get(res)); emit(set(h.LC_, carry)); };
    switch (op) {
      case 0x0: emit(set(res, and(a, m))); if (rdi === 15 && S) { nzc(); return true; } writeReg(rdi, get(res)); if (S) nzc(); return true;
      case 0x1: emit(set(res, and(a, xor(m, [65, 127])))); writeReg(rdi, get(res)); if (S) nzc(); return true;
      case 0x2: emit(set(res, rn === 15 ? m : or(a, m))); writeReg(rdi, get(res)); if (S) nzc(); return true;
      case 0x3: emit(set(res, rn === 15 ? xor(m, [65, 127]) : or(a, xor(m, [65, 127])))); writeReg(rdi, get(res)); if (S) nzc(); return true;
      case 0x4: emit(set(res, xor(a, m))); if (rdi === 15 && S) { nzc(); return true; } writeReg(rdi, get(res)); if (S) nzc(); return true;
      case 0x8: awc(a, m, [65, 0]); if (rdi === 15 && S) { awFlags(); return true; } writeReg(rdi, get(T(8))); if (S) awFlags(); return true;
      case 0xA: awc(a, m, get(LC)); writeReg(rdi, get(T(8))); if (S) awFlags(); return true;
      case 0xB: awc(a, xor(m, [65, 127]), get(LC)); writeReg(rdi, get(T(8))); if (S) awFlags(); return true;
      case 0xD: awc(a, xor(m, [65, 127]), [65, 1]); if (rdi === 15 && S) { awFlags(); return true; } writeReg(rdi, get(T(8))); if (S) awFlags(); return true;
      case 0xE: awc(xor(a, [65, 127]), m, [65, 1]); writeReg(rdi, get(T(8))); if (S) awFlags(); return true;
    }
    return false;
  };
  h.LC_ = LC;
  const setC = ex => emit(set(LC, ex));
  if (op1 === 0b10) {
    if ((hw2 & 0x8000) === 0) {
      if ((hw1 >>> 9) & 1) {                                // t32_dp_plainimm
        const op = (hw1 >>> 4) & 0x1f, rn = hw1 & 0xf, rdi = (hw2 >>> 8) & 0xf;
        const i = (hw1 >>> 10) & 1, imm3 = (hw2 >>> 12) & 7, imm8 = hw2 & 0xff;
        const imm12 = (i << 11) | (imm3 << 8) | imm8;
        switch (op) {
          case 0x00: writeReg(rdi, add(rn === 15 ? h.pcAligned() : readReg(rn), c32(imm12))); return true;
          case 0x0A: writeReg(rdi, sub(rn === 15 ? h.pcAligned() : readReg(rn), c32(imm12))); return true;
          case 0x04: writeReg(rdi, c32(((hw1 & 0xf) << 12) | imm12)); return true;
          case 0x0C: { const imm16 = ((hw1 & 0xf) << 12) | imm12; writeReg(rdi, or(and(readReg(rdi), c32(0xffff)), c32((imm16 << 16) | 0))); return true; }
          case 0x14: case 0x1C: {
            const lsb = ((imm3 << 2) | ((hw2 >>> 6) & 3)) & 0x1f, width = (imm8 & 0x1f) + 1;
            const mask = width >= 32 ? -1 : ((1 << width) - 1);
            if (op === 0x1C) { writeReg(rdi, and(shru(readReg(rn), c32(lsb)), c32(mask))); return true; }
            emit(set(T(0), and(shru(readReg(rn), c32(lsb)), c32(mask))));
            if (width < 32) emit([...and(get(T(0)), c32(1 << (width - 1))), OP.if, 0x40, ...set(T(0), or(get(T(0)), c32(~((1 << width) - 1)))), OP.end]);
            writeReg(rdi, get(T(0))); return true;
          }
          case 0x16: {
            const lsb = ((imm3 << 2) | ((hw2 >>> 6) & 3)) & 0x1f, msb = imm8 & 0x1f;
            if (msb < lsb) return false;
            const width = msb - lsb + 1;
            const mask = ((width >= 32 ? -1 : ((1 << width) - 1)) << lsb) | 0;
            const src = rn === 15 ? c32(0) : readReg(rn);
            emit(set(T(0), and(shl(src, c32(lsb)), c32(mask))));
            writeReg(rdi, or(and(readReg(rdi), c32(~mask)), get(T(0)))); return true;
          }
        }
        return false;
      }
      // t32_dp_modimm
      const op = (hw1 >>> 5) & 0xf, S = (hw1 >>> 4) & 1, rn = hw1 & 0xf, rdi = (hw2 >>> 8) & 0xf;
      const i = (hw1 >>> 10) & 1, imm3 = (hw2 >>> 12) & 7, imm8 = hw2 & 0xff;
      const imm12 = (i << 11) | (imm3 << 8) | imm8;
      let imm32, carry;
      if ((imm12 & 0xc00) === 0) {
        const t = (imm12 >>> 8) & 3, b = imm12 & 0xff;
        imm32 = t === 0 ? b : t === 1 ? ((b << 16) | b) : t === 2 ? ((b << 24) | (b << 8)) : ((b << 24) | (b << 16) | (b << 8) | b);
        carry = get(LC);
      } else {
        const unrot = 0x80 | (imm12 & 0x7f), rot = (imm12 >>> 7) & 0x1f;
        imm32 = ((unrot >>> rot) | (unrot << (32 - rot))) | 0;
        carry = c32((imm32 >>> 31) & 1);
      }
      emit(set(T(3), c32(imm32 | 0)), set(T(2), readReg(rn)));
      return dpTail(op, S, rn, rdi, get(T(2)), get(T(3)), carry, true);
    }
    // branch_misc32
    const op2_14 = (hw2 >>> 14) & 1, op2_12 = (hw2 >>> 12) & 1, S = (hw1 >>> 10) & 1;
    if (op2_12 === 1) {                                     // BL / B.W (T4)
      const imm10 = hw1 & 0x3ff, imm11 = hw2 & 0x7ff, j1 = (hw2 >>> 13) & 1, j2 = (hw2 >>> 11) & 1;
      const i1 = (~(j1 ^ S)) & 1, i2 = (~(j2 ^ S)) & 1;
      let imm = (S << 24) | (i1 << 23) | (i2 << 22) | (imm10 << 12) | (imm11 << 1); imm = (imm << 7) >> 7;
      if (op2_14 === 1) wr(14, c32(((pc + 4) | 1) | 0));
      branchTo((pc + 4) + imm);
      return true;
    }
    const cc = (hw1 >>> 6) & 0xf;
    if (cc < 0xe) {
      const imm11 = hw2 & 0x7ff, imm6 = hw1 & 0x3f, j1 = (hw2 >>> 13) & 1, j2 = (hw2 >>> 11) & 1;
      let imm = (S << 20) | (j2 << 19) | (j1 << 18) | (imm6 << 12) | (imm11 << 1); imm = (imm << 11) >> 11;
      h.setBranch();
      emit([...cond(cc), OP.if, 0x40, ...set(TGT, c32(((pc + 4) + imm) | 0)), ...set(BRF, c32(1)), OP.end]);
      return true;
    }
    if ((hw1 & 0xfff0) === 0xf3b0 && (hw2 & 0xff00) === 0x8f00) return true;   // DSB / DMB / ISB
    return false;
  }
  if (op1 === 0b11) {
    const op2 = (hw1 >>> 4) & 0x7f;
    const ldst = (op2 & 0b1110001) === 0 || (op2 & 0b1100111) === 0b0000001 || (op2 & 0b1100111) === 0b0000011 || (op2 & 0b1100111) === 0b0000101;
    if (ldst) {                                             // t32_ldst_single
      const size = (hw1 >>> 5) & 3, load = (hw1 >>> 4) & 1, signed = ((hw1 >>> 8) & 1) !== 0;
      const rn = hw1 & 0xf, rt = (hw2 >>> 12) & 0xf;
      if (rn === 15 && load) {
        const u = (hw1 >>> 7) & 1, imm12 = hw2 & 0xfff, base = (pc + 4) & ~3;
        memLoad(size, signed, rt, c32((u ? base + imm12 : base - imm12) | 0)); return true;
      }
      if ((hw1 >>> 7) & 1) {
        const addr = add(readReg(rn), c32(hw2 & 0xfff));
        if (load) memLoad(size, signed, rt, addr); else memStore(size, rt, addr); return true;
      }
      if ((hw2 >>> 11) & 1) {
        const imm8 = hw2 & 0xff, P = (hw2 >>> 10) & 1, U = (hw2 >>> 9) & 1, W = (hw2 >>> 8) & 1;
        emit(set(T(7), readReg(rn)));
        emit(set(T(6), add(get(T(7)), c32(U ? imm8 : -imm8))));
        const addr = P ? get(T(6)) : get(T(7));
        if (load) memLoad(size, signed, rt, addr); else memStore(size, rt, addr);
        if (W || !P) writeReg(rn, get(T(6)));
        return true;
      }
      const rm = hw2 & 0xf, shamt = (hw2 >>> 4) & 3;
      const addr = add(readReg(rn), shl(readReg(rm), c32(shamt)));
      if (load) memLoad(size, signed, rt, addr); else memStore(size, rt, addr);
      return true;
    }
    if ((op2 & 0b1110000) === 0b0100000) {                  // t32_dp_register
      const rn = hw1 & 0xf, rdi = (hw2 >>> 8) & 0xf, rm = hw2 & 0xf;
      if (((hw2 >>> 12) & 0xf) === 0xf) {
        const o1 = (hw1 >>> 5) & 7, o2 = (hw2 >>> 4) & 0xf, S = (hw1 >>> 4) & 1;
        if ((o2 & 0x8) === 0) {
          if (o1 > 3) return false;
          emit(set(T(3), and(readReg(rm), c32(0xff))));
          shiftDyn(['lsl', 'lsr', 'asr', 'ror'][o1], readReg(rn));
          writeReg(rdi, get(T(4))); if (S) { setNZ(get(T(4))); setC(get(T(5))); }
          return true;
        }
        if ((hw1 >> 7) & 1) return revFamily((hw1 >>> 4) & 3, (hw2 >>> 4) & 3, readReg(rm), rdi, h);
        const xop = (hw1 >>> 4) & 7, rot = ((hw2 >>> 4) & 3) << 3;
        emit(set(T(0), readReg(rm)));
        emit(set(T(1), rot ? bin(OP.rotr, get(T(0)), c32(rot)) : get(T(0))));
        const acc = rn === 15 ? c32(0) : readReg(rn), rot_ = get(T(1));
        switch (xop) {
          case 0x0: writeReg(rdi, add(acc, un(OP.ext16s, rot_))); return true;
          case 0x1: writeReg(rdi, add(acc, and(rot_, c32(0xffff)))); return true;
          case 0x4: writeReg(rdi, add(acc, un(OP.ext8s, rot_))); return true;
          case 0x5: writeReg(rdi, add(acc, and(rot_, c32(0xff)))); return true;
          case 0x2: case 0x3: {
            emit(set(T(2), rn === 15 ? c32(0) : readReg(rn)));
            emit(set(T(3), and(rot_, c32(0xff))), set(T(4), and(shru(rot_, c32(16)), c32(0xff))));
            if (xop === 2) emit(set(T(3), un(OP.ext8s, get(T(3)))), set(T(4), un(OP.ext8s, get(T(4)))));
            emit(set(T(5), and(add(and(get(T(2)), c32(0xffff)), get(T(3))), c32(0xffff))));
            emit(set(T(6), and(add(and(shru(get(T(2)), c32(16)), c32(0xffff)), get(T(4))), c32(0xffff))));
            writeReg(rdi, or(shl(get(T(6)), c32(16)), get(T(5)))); return true;
          }
        }
        return false;
      }
      return revFamily((hw1 >>> 4) & 3, (hw2 >>> 4) & 3, readReg(rm), rdi, h);
    }
    if ((op2 & 0b1111000) === 0b0110000) {                  // t32_multiply
      const o1 = (hw1 >>> 4) & 7, rn = hw1 & 0xf, ra = (hw2 >>> 12) & 0xf, rdi = (hw2 >>> 8) & 0xf, o2 = (hw2 >>> 4) & 0xf, rm = hw2 & 0xf;
      if (o1 === 0 && o2 === 0) { emit(set(T(0), bin(OP.mul, readReg(rn), readReg(rm)))); writeReg(rdi, ra === 15 ? get(T(0)) : add(get(T(0)), readReg(ra))); return true; }
      if (o1 === 0 && o2 === 1) { emit(set(T(0), bin(OP.mul, readReg(rn), readReg(rm)))); writeReg(rdi, sub(readReg(ra), get(T(0)))); return true; }
      return false;
    }
    if ((op2 & 0b1111000) === 0b0111000) {                  // t32_long_mul_div
      const o1 = (hw1 >>> 4) & 7, rn = hw1 & 0xf, rdlo = (hw2 >>> 12) & 0xf, rdhi = (hw2 >>> 8) & 0xf, o2 = (hw2 >>> 4) & 0xf, rm = hw2 & 0xf;
      if (o2 === 0 && (o1 === 0 || o1 === 2 || o1 === 4 || o1 === 6)) {
        if (rdlo === 15 || rdhi === 15) return false;
        const ext = (o1 === 0 || o1 === 4) ? OP.ext_s : OP.ext_u;
        emit(set(Q(0), bin(OP.i64mul, un(ext, readReg(rn)), un(ext, readReg(rm)))));
        if (o1 >= 4) emit(set(Q(0), bin(OP.i64add, get(Q(0)), bin(OP.i64or, bin(OP.i64shl, un(OP.ext_u, get(R(rdhi))), sleb64(32, [OP.i64const])), un(OP.ext_u, get(R(rdlo)))))));
        wr(rdlo, un(OP.wrap, get(Q(0)))); wr(rdhi, un(OP.wrap, bin(OP.i64shr_u, get(Q(0)), sleb64(32, [OP.i64const]))));
        return true;
      }
      if (o1 === 1 && o2 === 0xf) {                          // SDIV
        if (rdhi === 15) return false;
        emit(set(T(0), readReg(rn)), set(T(1), readReg(rm)));
        emit([...un(OP.eqz, get(T(1))), OP.if, 0x40, ...set(R(rdhi), c32(0)), OP.else,
          ...and(bin(OP.eq, get(T(0)), c32(0x80000000 | 0)), bin(OP.eq, get(T(1)), c32(-1))), OP.if, 0x40, ...set(R(rdhi), c32(0x80000000 | 0)), OP.else,
          ...set(R(rdhi), bin(OP.div_s, get(T(0)), get(T(1)))), OP.end, OP.end]);
        return true;
      }
      if (o1 === 3 && o2 === 0xf) {                          // UDIV
        if (rdhi === 15) return false;
        emit(set(T(0), readReg(rn)), set(T(1), readReg(rm)));
        emit([...un(OP.eqz, get(T(1))), OP.if, 0x40, ...set(R(rdhi), c32(0)), OP.else, ...set(R(rdhi), bin(OP.div_u, get(T(0)), get(T(1)))), OP.end]);
        return true;
      }
      return false;
    }
    return false;
  }
  // op1 == 0b01
  const op2 = (hw1 >>> 4) & 0x7f;
  if ((op2 & 0b1100100) === 0b0000000) {                    // t32_ldm_stm
    const opc = (hw1 >>> 7) & 3, W = (hw1 >>> 5) & 1, L = (hw1 >>> 4) & 1, rn = hw1 & 0xf, list = hw2 & 0xffff;
    if (rn === 15) return false;
    const n = popcount(list);
    emit(set(T(2), readReg(rn)));
    if (opc === 0b01) emit(set(T(3), get(T(2))), set(T(4), add(get(T(2)), c32(4 * n))));
    else emit(set(T(3), sub(get(T(2)), c32(4 * n))), set(T(4), get(T(3))));
    mapInto(T(1), get(T(3)), 4 * n, !L); failExit(T(1));
    let k = 0;
    for (let i = 0; i < 16; i++) {
      if (!(list & (1 << i))) continue;
      if (L) { if (i === 15) { h.setBranch(); emit(set(TGT, and(ld(OP.i32load, get(T(1)), 4 * k), c32(~1))), set(BRF, c32(1))); } else writeReg(i, ld(OP.i32load, get(T(1)), 4 * k)); }
      else emit(st(OP.i32store, get(T(1)), readReg(i), 4 * k));
      k++;
    }
    if (W) writeReg(rn, get(T(4)));
    return true;
  }
  if ((op2 & 0b1100100) === 0b0000100) {                    // t32_ldrd_strd_ex_tb
    if (((hw1 & 0xfff0) === 0xe8d0) && ((hw2 & 0xffe0) === 0xf000)) {   // TBB / TBH
      const rn = hw1 & 0xf, rm = hw2 & 0xf, isH = (hw2 >>> 4) & 1;
      emit(set(T(0), readReg(rn)));
      if (isH) { mapInto(T(1), add(get(T(0)), shl(readReg(rm), c32(1))), 2, false); failExit(T(1)); emit(set(T(2), ld(OP.i32load16u, get(T(1))))); }
      else { mapInto(T(1), add(get(T(0)), readReg(rm)), 1, false); failExit(T(1)); emit(set(T(2), ld(OP.i32load8u, get(T(1))))); }
      h.setBranch(); emit(set(TGT, add(c32((pc + 4) | 0), shl(get(T(2)), c32(1)))), set(BRF, c32(1)));
      return true;
    }
    const rn = hw1 & 0xf, rt = (hw2 >>> 12) & 0xf, rt2 = (hw2 >>> 8) & 0xf;
    if ((hw1 & 0xfff0) === 0xe840) {                        // STREX
      const rdd = (hw2 >>> 8) & 0xf;
      mapInto(T(1), add(readReg(rn), c32((hw2 & 0xff) << 2)), 4, true); failExit(T(1));
      emit(st(OP.i32store, get(T(1)), readReg((hw2 >>> 12) & 0xf)));
      writeReg(rdd, c32(0)); return true;
    }
    if ((hw1 & 0xfff0) === 0xe850) {                        // LDREX
      mapInto(T(1), add(readReg(rn), c32((hw2 & 0xff) << 2)), 4, false); failExit(T(1));
      writeReg(rt, ld(OP.i32load, get(T(1)))); return true;
    }
    const P = (hw1 >>> 8) & 1, U = (hw1 >>> 7) & 1, W = (hw1 >>> 5) & 1, L = (hw1 >>> 4) & 1, imm8 = (hw2 & 0xff) << 2;
    if (((hw1 >>> 6) & 1) === 1) {
      emit(set(T(7), readReg(rn)));
      emit(set(T(6), U ? add(get(T(7)), c32(imm8)) : sub(get(T(7)), c32(imm8))));
      mapInto(T(1), P ? get(T(6)) : get(T(7)), 8, !L); failExit(T(1));
      if (L) { writeReg(rt, ld(OP.i32load, get(T(1)))); writeReg(rt2, ld(OP.i32load, get(T(1)), 4)); }
      else { emit(st(OP.i32store, get(T(1)), readReg(rt))); emit(st(OP.i32store, get(T(1)), readReg(rt2), 4)); }
      if (W || !P) writeReg(rn, get(T(6)));
      return true;
    }
    return false;
  }
  if ((op2 & 0b1100000) === 0b0100000) {                    // t32_dp_shifted_reg
    const op = (hw1 >>> 5) & 0xf, S = (hw1 >>> 4) & 1, rn = hw1 & 0xf, rdi = (hw2 >>> 8) & 0xf, rm = hw2 & 0xf, type = (hw2 >>> 4) & 3;
    const imm5 = (((hw2 >>> 12) & 7) << 2) | ((hw2 >>> 6) & 3);
    applyShift(readReg(rm), type, imm5);
    emit(set(T(3), get(T(4))), set(T(2), readReg(rn)));
    if (op === 0x6) { writeReg(rdi, type === 2 ? or(and(get(T(2)), c32(0xffff0000 | 0)), and(get(T(3)), c32(0xffff))) : or(and(get(T(2)), c32(0xffff)), and(get(T(3)), c32(0xffff0000 | 0)))); return true; }
    return dpTail(op, S, rn, rdi, get(T(2)), get(T(3)), get(T(5)), false);
  }
  return false;
}

function revFamily(mop1, mop2, vEx, rdi, h) {
  const { emit, writeReg } = h;
  emit(set(T(0), vEx)); const v = get(T(0));
  if (mop1 === 0x3 && mop2 === 0x0) { writeReg(rdi, un(OP.clz, v)); return true; }
  if (mop1 === 0x1 && mop2 === 0x0) { writeReg(rdi, or(or(shl(and(v, c32(0xff)), c32(24)), shl(and(v, c32(0xff00)), c32(8))), or(and(shru(v, c32(8)), c32(0xff00)), shru(v, c32(24))))); return true; }
  if (mop1 === 0x1 && mop2 === 0x1) { writeReg(rdi, or(or(shl(and(v, c32(0xff)), c32(8)), shru(and(v, c32(0xff00)), c32(8))), or(shl(and(v, c32(0xff0000)), c32(8)), shru(and(v, c32(0xff000000 | 0)), c32(8))))); return true; }
  if (mop1 === 0x1 && mop2 === 0x3) { writeReg(rdi, un(OP.ext16s, or(shl(and(v, c32(0xff)), c32(8)), and(shru(v, c32(8)), c32(0xff))))); return true; }
  return false;                                             // RBIT and the rest: the interpreter
}

/* ------------------------------------------------------------------ building the module */
/*
 * One function exec(pc, budget) -> instructions run, for the window [lo, hi) of the region
 * whose bytes are `code` (at guest address lo). Every instruction start found by decoding the
 * window in order is an entry point. Layout:
 *   block $exit
 *     loop $dispatch
 *       block $I(n-1) ... block $I0
 *         br_table on (pc - lo) / 2 -> $I(k) for an instruction start, else $exit
 *       end  ;; $I0: instruction 0's code, then instruction 1's, ...
 *     end ;; falls out after the last instruction (pc already set)
 *   end
 *   store everything; return count
 */
/* The generator form: yields every 128 instructions so the runner can spread a build over frames. */
function buildModule(lo, code, regions, winRegionIndex, exitInfo) {
  const g = buildSteps(lo, code, regions, winRegionIndex, exitInfo);
  for (;;) { const r = g.next(); if (r.done) return r.value; }
}
function* buildSteps(lo, code, regions, winRegionIndex, exitInfo) {
  const n16 = code.length >> 1;
  const hw = i => code[i * 2] | (code[i * 2 + 1] << 8);
  // Decode the window in order.
  const ins = [];                      // { pc, hw1, hw2, is32, idx }
  for (let i = 0; i < n16;) {
    const h1 = hw(i), is32 = (h1 >>> 11) >= 0x1d;
    if (is32 && i + 1 >= n16) break;
    ins.push({ pc: lo + i * 2, hw1: h1, hw2: is32 ? hw(i + 1) : 0, is32, i16: i });
    i += is32 ? 2 : 1;
  }
  const n = ins.length;
  // IT blocks: each instruction's ITSTATE as the interpreter would have it (core.ts itAdvance),
  // known here because an IT block is straight-line code.
  const itAt = new Array(n).fill(0), itOk = new Array(n).fill(false);
  for (let k = 0; k < n; k++) {
    const h1 = ins[k].hw1;
    if (ins[k].is32 || (h1 & 0xff00) !== 0xbf00 || (h1 & 0xf) === 0) continue;
    let st_ = h1 & 0xff, j = k + 1, okb = true;
    while ((st_ & 0xf) !== 0) {
      if (j >= n || ins[j].pc !== ins[j - 1].pc + (ins[j - 1].is32 ? 4 : 2) || itAt[j]) { okb = false; break; }
      itAt[j] = st_;
      st_ = (st_ & 0x7) === 0 ? 0 : ((st_ & 0xe0) | ((st_ << 1) & 0x1f));
      j++;
    }
    if (okb) itOk[k] = true; else for (let q = k + 1; q < j; q++) itAt[q] = 0;
  }
  const body = [];
  // Prologue: registers and flags into locals.
  for (let r = 0; r < 15; r++) body.push(...set(R(r), ld(OP.i32load, c32(r * 4))));
  body.push(...set(LN, ld(OP.i32load, c32(F_N))), ...set(LZ, ld(OP.i32load, c32(F_Z))), ...set(LC, ld(OP.i32load, c32(F_C))), ...set(LV, ld(OP.i32load, c32(F_V))));
  body.push(...set(PC, get(P_PC)), ...set(CNT, c32(0)));
  body.push(...st(OP.i32store, c32(EXIT_KIND), c32(0)));
  // Structure. Depths: exit = outermost block (depth 1), dispatch loop (2), then n instruction blocks.
  body.push(OP.block, 0x40);                                  // $exit
  body.push(OP.loop, 0x40);                                   // $dispatch
  for (let k = n - 1; k >= 0; k--) body.push(OP.block, 0x40); // $I(n-1) .. $I0 (I0 innermost)
  // br_table index: (pc - lo) >>> 1, out of range -> default ($exit)
  // Guard: pc odd or outside -> exit.
  body.push(...or(bin(OP.ge_u, sub(get(PC), c32(lo)), c32(code.length)), and(get(PC), c32(1))), OP.br_if, ...uleb(n + 1, []));
  body.push(...shru(sub(get(PC), c32(lo)), c32(1)));
  const table = new Array(n16).fill(n + 1);                   // default: $exit (depth from innermost: n blocks + loop -> n+1)
  ins.forEach((it, k) => { if (!itAt[k]) table[it.i16] = k; });   // never entered in the middle of an IT block
  body.push(OP.br_table, ...uleb(n16, []));
  for (const t of table) uleb(t, body);
  uleb(n + 1, body);
  // Each instruction's code follows the end of its block.
  let translated = 0;
  for (let k = 0; k < n; k++) {
    if (k && (k & 127) === 0) yield k;
    body.push(OP.end);                                        // end of $I(k)
    // Depth now: enclosing $I(k+1..n-1) (n-1-k), $dispatch, $exit.
    const dDispatch = n - 1 - k, dExit = n - k;
    const it = ins[k];
    const its = itAt[k];
    // A stop before an instruction inside an IT block leaves its ITSTATE for the interpreter.
    const stopHere = (extraDepth) => [...(its ? st(OP.i32store, c32(IT), c32(its)) : []), ...set(PC, c32(it.pc)), OP.br, ...uleb(dExit + extraDepth, [])];
    CUR.stop = its ? (x => stopHere(x + 1)) : stopHere;     // inside the condition's `if`
    const tr = translate(null, it.pc, it.hw1, it.hw2, it.is32, !!its, itOk[k]);
    // Budget: stop before this instruction when the budget is spent.
    body.push(...bin(OP.ge_u, get(CNT), get(P_BUD)), OP.if, 0x40, ...stopHere(1), OP.end);
    if (!tr) {
      body.push(...st(OP.i32store, c32(EXIT_KIND), c32(1)), ...stopHere(0));   // not written out: the interpreter runs it
      continue;
    }
    translated++;
    const code_ = tr.code;
    if (tr.mayBranch) body.push(...set(BRF, c32(0)));
    if (its) { append(body, cond((its >> 4) & 0xf)); body.push(OP.if, 0x40); }
    append(body, code_);
    if (its) body.push(OP.end);
    if (tr.mayBranch) {
      // if (BRF) { exception return? -> stop as trap 3 (not counted); else count, pc = target, dispatch }
      body.push(...get(BRF), OP.if, 0x40,
        ...bin(OP.ge_u, get(TGT), c32(0xfffffff0 | 0)), OP.if, 0x40,
          ...st(OP.i32store, c32(EXIT_KIND), c32(3)), ...st(OP.i32store, c32(TRAP_ADDR), c32(it.pc)),
          ...st(OP.i32store, c32(TRAP_HW1), c32(it.hw1)), ...st(OP.i32store, c32(TRAP_HW2), c32(it.hw2)),
          ...set(PC, get(TGT)), OP.br, ...uleb(dExit + 2, []),
        OP.end,
        ...set(CNT, add(get(CNT), c32(1))), ...set(PC, get(TGT)), OP.br, ...uleb(dDispatch + 1, []),
        OP.end);
    }
    body.push(...set(CNT, add(get(CNT), c32(1))));
    // Falls through to the next instruction's code; after the last one, set pc and leave.
    if (k === n - 1) body.push(...set(PC, c32((it.pc + (it.is32 ? 4 : 2)) | 0)), OP.br, ...uleb(dExit, []));
    else if (ins[k + 1].pc !== it.pc + (it.is32 ? 4 : 2)) body.push(...set(PC, c32((it.pc + (it.is32 ? 4 : 2)) | 0)), OP.br, ...uleb(dDispatch, []));
  }
  body.push(OP.end);                                          // $dispatch loop (unreachable fall-out)
  body.push(OP.end);                                          // $exit
  // Epilogue: everything back to memory.
  for (let r = 0; r < 15; r++) body.push(...st(OP.i32store, c32(r * 4), get(R(r))));
  body.push(...st(OP.i32store, c32(F_N), get(LN)), ...st(OP.i32store, c32(F_Z), get(LZ)), ...st(OP.i32store, c32(F_C), get(LC)), ...st(OP.i32store, c32(F_V), get(LV)));
  body.push(...st(OP.i32store, c32(PC_OUT), get(PC)));
  body.push(...get(CNT), OP.end);

  // map(a, size, write) -> linear offset or -1: mapData's answer, without its cache. A write
  // into the translated window's region is refused (the interpreter does it, and the window is
  // dropped).
  const mb = [];
  regions.forEach((rg, i) => {
    // if (a >= base && a < end && (end - a) >= size) { if (write && (ro || i == win)) return -1; return lin + (a - base) }
    mb.push(...and(and(bin(OP.ge_u, get(0), c32(rg.base | 0)), bin(OP.lt_u, get(0), c32(rg.end | 0))), bin(OP.ge_u, sub(c32(rg.end | 0), get(0)), get(1))), OP.if, 0x40);
    if (rg.ro || i === winRegionIndex) mb.push(...get(2), OP.if, 0x40, ...c32(-1), OP.return, OP.end);
    mb.push(...add(c32(rg.lin | 0), sub(get(0), c32(rg.base | 0))), OP.return, OP.end);
  });
  mb.push(...c32(-1), OP.end);

  // Module: type 0 (i32 i32 i32)->i32 for map, type 1 (i32 i32)->i32 for exec; memory imported.
  const types = [[0x60, 3, 0x7f, 0x7f, 0x7f, 1, 0x7f], [0x60, 2, 0x7f, 0x7f, 1, 0x7f]];
  const typeSec = section(1, vec(types, []));
  const imp = []; vec([[...vec([...'m'].map(c => [c.charCodeAt(0)]), []), ...vec([...'memory'].map(c => [c.charCodeAt(0)]), []), 0x02, 0x00, ...uleb(1, [])]], imp);
  const importSec = section(2, imp);
  const funcSec = section(3, vec([[0], [1]], []));
  const exportSec = section(7, vec([[...vec([...'exec'].map(c => [c.charCodeAt(0)]), []), 0x00, 1]], []));
  const fnMap = [...vec([], []), ...mb];                       // no locals
  const execLocals = vec([[...uleb(23 + NT, []), 0x7f], [...uleb(NQ, []), 0x7e]], []);
  const fnExec = append(append([], execLocals), body);
  const codeSec = section(10, vec([append(uleb(fnMap.length, []), fnMap), append(uleb(fnExec.length, []), fnExec)], []));
  const all = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
  for (const sct of [typeSec, importSec, funcSec, exportSec, codeSec]) append(all, sct);
  const bytes = new Uint8Array(all);
  exitInfo.instructions = n; exitInfo.translated = translated;
  return bytes;
}

/* ------------------------------------------------------------------ the runner */
/*
 * HOT SPANS. The code that runs is found by counting, per 1 KiB page, the instructions the
 * interpreter runs; a page with at least 1 % of them over a stretch of frames is hot, and hot
 * pages next to each other (a gap of one page at most) make one span, translated as one
 * module. Spans live in three regions: ITCM (code the firmware copies to RAM; 98 % of a game's
 * instructions), the internal flash and the external flash (the clock and the menus run there).
 *
 * KEEPING A SPAN TRUE TO MEMORY. A span is built from a copy of its bytes and is dropped when
 * they could have changed:
 *   ITCM: the twin's JS writes call bus._smcCb (chained here); the interpreter's own ITCM
 *     stores go through the twin's JS while an ITCM span is live (the ITCM entry of the
 *     interpreter's region table is marked read-only, so such a store traps to cpu.js);
 *     translated code never writes ITCM (it stops and the interpreter does the store);
 *   the flashes: read-only to the program; only the twin's OTFDEC model rewrites the external
 *     flash (decrypting it in place when the firmware enables it), which is chained here;
 *   a loaded state drops every span (drop());
 *   and every frame each live span's bytes are compared with its copy: a difference that none
 *     of the above reported is counted in stats.unexpected and drops the span.
 * An ITCM page is translated only after its bytes have held still for QUIET frames.
 */
export function makeJit({ cpu, bus, machine, periph, opts = {} }) {
  const wc = machine.wasmCore;
  if (!wc || !cpu._wasmRun) return null;
  const interp = cpu._wasmRun;
  const memory = wc.memory;
  const U32 = () => cpu._wasmU32;
  const stats = { spans: 0, builds: 0, drops: 0, unexpected: 0, jitInstr: 0, interpInstr: 0, exits: 0, stopsAt: 0, buildMs: 0, translated: 0, instructions: 0, compileFails: 0, smcHits: 0, otfdecDrops: 0 };
  const PAGE = 1024, QUIET = opts.quietFrames || 30, EVERY = opts.every || 30, MAX_SPANS = 96, MAX_SPAN = 4 * 1024;   // small spans: a build stays a few ms
  let regions = null, itcm = -1;
  const codeRegion = rg => rg.name === 'ITCM' || rg.ro;        // ITCM, IFLASH, QSPI
  function readRegions() {
    const u = U32(), cnt = u[RCNT >> 2], out = [];
    for (let i = 0; i < cnt; i++) { const o = (RTAB >> 2) + i * 4; out.push({ base: u[o] >>> 0, end: u[o + 1] >>> 0, lin: u[o + 2] >>> 0, ro: (u[o + 3] & 1) !== 0, flagIndex: o + 3, name: (bus.regions[i] && bus.regions[i].name) || '' }); }
    return out;
  }
  const regionOf = a => { for (let i = 0; i < regions.length; i++) if (a >= regions[i].base && a < regions[i].end) return i; return -1; };
  let spans = [];                                   // { lo, hi, ri, exec, copy }
  let pageSpan = new Map();                         // page -> span (live spans only)
  let pageHits = new Map(), hitTotal = 0, framesSince = 0;
  const pending = new Map();                        // ITCM candidates: key -> { lo, hi, ri, copy, quiet }
  const queue = [];                                 // spans to build: one a frame, so no frame waits on several (a build is ~10 ms)
  function itcmLive() { return spans.some(sp => sp.ri === itcm); }
  function setItcmTrap() {                          // the interpreter's ITCM stores through cpu.js while an ITCM span is live
    if (itcm < 0) return;
    U32()[regions[itcm].flagIndex] = itcmLive() ? 1 : (regions[itcm].ro ? 1 : 0);
  }
  function reindex() { pageSpan = new Map(); for (const sp of spans) for (let p = Math.floor(sp.lo / PAGE); p * PAGE < sp.hi; p++) pageSpan.set(p, sp); stats.spans = spans.length; setItcmTrap(); }
  function dropSpan(sp, why) { const k = spans.indexOf(sp); if (k < 0) return; spans.splice(k, 1); stats.drops++; stats['drop_' + why] = (stats['drop_' + why] || 0) + 1; if (why === 'unexpected') stats.unexpected++; reindex(); }
  function dropWhere(lo, hi, why) {
    for (const sp of spans.slice()) if (sp.lo < hi && lo < sp.hi) dropSpan(sp, why);
    for (const [k, pd] of pending) if (pd.lo < hi && lo < pd.hi) pending.delete(k);
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i].lo < hi && lo < queue[i].hi) queue.splice(i, 1);
    if (job && job.lo < hi && lo < job.hi) job = null;
  }
  function dropAll() { stats.drops += spans.length; spans = []; pending.clear(); queue.length = 0; job = null; if (regions) reindex(); }
  function hookSmc() {
    const prev = bus._smcCb;
    if (prev && prev.__tftJit) return;
    const f = function (addr) {
      if (prev) prev.call(this, addr);
      addr >>>= 0;
      if (pageSpan.has(Math.floor(addr / PAGE)) || pending.size) { stats.smcHits++; dropWhere(addr, addr + 4, 'smc'); }
    };
    f.__tftJit = true;
    bus._smcCb = f;
  }
  function hookOtfdec() {
    const prev = periph && periph.onOtfdecEnable;
    if (!prev || prev.__tftJit) return;
    const f = function () { const r = prev.apply(this, arguments); stats.otfdecDrops++; for (const sp of spans.slice()) if (regions[sp.ri].base >= 0x90000000) dropSpan(sp, 'otfdec'); return r; };
    f.__tftJit = true;
    periph.onOtfdecEnable = f;
  }
  const bytesAt = (ri, lo, hi) => new Uint8Array(memory.buffer, regions[ri].lin + (lo - regions[ri].base), hi - lo);
  const sameBytes = (a, b) => { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
  /* A build is generated a slice at a time (GEN_MS of each frame at most), so a frame never
     carries a whole build; the finished module is compiled in the background. */
  const GEN_MS = opts.genMs || 2;
  let job = null;                                   // { lo, hi, ri, snap, gen, info, t0, ms }
  function startJob(lo, hi, ri, snap) {
    const info = {};
    // Every module refuses stores into ITCM (the interpreter does them, so ITCM spans hear of them).
    job = { lo, hi, ri, snap, info, gen: buildSteps(lo, snap, regions, itcm, info), t0: performance.now(), ms: 0 };
  }
  function stepJob() {
    if (!job) return;
    const t = performance.now(), end = opts.sync ? Infinity : t + GEN_MS;
    let r;
    try { do { r = job.gen.next(); } while (!r.done && performance.now() < end); }
    catch (e) { stats.compileFails++; stats.lastError = String(e && e.message || e); job = null; return; }
    job.ms += performance.now() - t;
    if (!r.done) return;
    const j = job; job = null;
    stats.genMs = +((stats.genMs || 0) + j.ms).toFixed(1); if (j.ms > (stats.genMax || 0)) stats.genMax = +j.ms.toFixed(1);
    build(j.lo, j.hi, j.ri, j.snap, r.value, j.info, j.t0);
  }
  function build(lo, hi, ri, snap, bytes, info, t0) {
    stats.builds++;
    const finish = mod => {
      try {
        if (!sameBytes(bytesAt(ri, lo, hi), snap)) return;          // changed while compiling
        if (spans.length >= MAX_SPANS || spans.some(sp => sp.lo < hi && lo < sp.hi)) return;
        const inst = new WebAssembly.Instance(mod, { m: { memory } });
        spans.push({ lo, hi, ri, exec: inst.exports.exec, copy: snap, n: info.instructions, t: info.translated, used: 0, cold: 0 });
        stats.translated += info.translated; stats.instructions += info.instructions;
        stats.buildMs = +(stats.buildMs + performance.now() - t0).toFixed(1);
        reindex();
      } catch (e) { stats.compileFails++; stats.lastError = String(e && e.message || e); }
    };
    // Compiled in the background and live when ready, so a new span never stalls a frame (a
    // compile is ~10 ms). opts.sync compiles here and now (the Node checks, whose loop never yields).
    if (opts.sync) { try { finish(new WebAssembly.Module(bytes)); } catch (e) { stats.compileFails++; stats.lastError = String(e && e.message || e); } return; }
    WebAssembly.compile(bytes).then(finish, e => { stats.compileFails++; stats.lastError = String(e && e.message || e); });
  }
  /* Hot pages since the last look -> spans (merged, capped), leaving out what is translated. */
  function pickSpans() {
    const hot = [];
    for (const [p, n] of pageHits) if (n >= hitTotal * 0.01 && n > 2000 && !pageSpan.has(p)) hot.push(p);
    pageHits = new Map(); hitTotal = 0;
    hot.sort((a, b) => a - b);
    const out = [];
    for (const p of hot) {
      const lo = p * PAGE, ri = regionOf(lo);
      if (ri < 0 || !codeRegion(regions[ri])) continue;
      const hi = Math.min((p + 1) * PAGE, regions[ri].end);
      const last = out[out.length - 1];
      if (last && last.ri === ri && lo - last.hi <= PAGE && hi - last.lo <= MAX_SPAN && !pageSpan.has(p - 1)) last.hi = hi;
      else out.push({ lo, hi, ri });
    }
    return out;
  }
  /* Before every frame. */
  function frame() {
    if (!regions) { regions = readRegions(); itcm = regions.findIndex(r => r.name === 'ITCM'); }
    hookSmc(); hookOtfdec();
    for (const sp of spans.slice()) if (!sameBytes(bytesAt(sp.ri, sp.lo, sp.hi), sp.copy)) dropSpan(sp, 'unexpected');
    for (const [k, pd] of pending) {                              // ITCM candidates wait for their bytes to hold still
      const now = bytesAt(pd.ri, pd.lo, pd.hi);
      if (!sameBytes(now, pd.copy)) { pd.copy = now.slice(); pd.quiet = 0; continue; }
      if (++pd.quiet >= QUIET) { pending.delete(k); queue.push(pd); }
    }
    if (++framesSince >= EVERY) {
      framesSince = 0;
      // A span that ran nothing for two looks in a row makes room (the code moved on: another screen).
      for (const sp of spans) { sp.cold = sp.used === 0 ? sp.cold + 1 : 0; sp.used = 0; }
      const cand = hitTotal > 0 ? pickSpans() : [];
      if (cand.length && spans.length + pending.size + cand.length > MAX_SPANS) {
        for (const sp of spans.filter(x => x.cold >= 2).sort((a, b) => b.cold - a.cold)) {
          if (spans.length + pending.size + cand.length <= MAX_SPANS) break;
          dropSpan(sp, 'cold');
        }
      }
      for (const c of cand) {
        if (spans.length + pending.size + queue.length >= MAX_SPANS) break;
        if ([...pending.values(), ...queue].some(pd => pd.lo < c.hi && c.lo < pd.hi)) continue;
        const snap = bytesAt(c.ri, c.lo, c.hi).slice();
        if (c.ri === itcm) pending.set(c.lo + ':' + c.hi, { lo: c.lo, hi: c.hi, ri: c.ri, copy: snap, quiet: 0 });
        else queue.push({ lo: c.lo, hi: c.hi, ri: c.ri, copy: snap });
      }
    }
    // One build at a time, a slice a frame; its bytes must still be what was copied.
    if (job && !sameBytes(bytesAt(job.ri, job.lo, job.hi), job.snap)) job = null;
    while (!job && queue.length) {
      const q = queue.shift();
      if (spans.some(sp => sp.lo < q.hi && q.lo < sp.hi)) continue;
      if (!sameBytes(bytesAt(q.ri, q.lo, q.hi), q.copy)) continue;
      startJob(q.lo, q.hi, q.ri, q.copy);
    }
    stepJob();
  }
  /* cpu._wasmRun's contract (twin.js CortexM7.run): run up to `budget` instructions from pc,
     flags and IT in the header words, return the count; PC_OUT, TRAP_* as core.wasm sets them. */
  function run(pc0, budget) {
    const u = U32();
    u[TRAP_REASON >> 2] = 0;
    let total = 0, pc = pc0 >>> 0;
    while (total < budget) {
      const sp = (u[IT >> 2] & 0xf) === 0 ? pageSpan.get(Math.floor(pc / PAGE)) : undefined;
      if (sp && pc >= sp.lo && pc < sp.hi) {
        const n = sp.exec(pc, budget - total) >>> 0;
        total += n; stats.jitInstr += n; stats.exits++; sp.used += n;
        pc = u[PC_OUT >> 2] >>> 0;
        const kind = u[EXIT_KIND >> 2];
        if (kind === 3) { u[TRAP_REASON >> 2] = 3; return total; }
        if (total >= budget) return total;
        if (kind !== 1 && n > 0) continue;                    // left the span or dispatched out: look again
        stats.stopsAt++;
        if (stats.stopPcs) stats.stopPcs.set(pc, (stats.stopPcs.get(pc) || 0) + 1);   // diagnostics (tests switch it on)
        const n1 = interp(pc, 1);                               // the instruction not written out
        total += n1; stats.interpInstr += n1;
        if (u[TRAP_REASON >> 2] !== 0 || n1 === 0) return total;
        pc = u[PC_OUT >> 2] >>> 0;
        continue;
      }
      // The interpreter: one instruction inside an IT block or on a translated page, else a stretch.
      const p = Math.floor(pc / PAGE), inSpan = pageSpan.has(p);
      const k = ((u[IT >> 2] & 0xf) !== 0 || inSpan) ? 1 : Math.min(64, budget - total);
      const n = interp(pc, k);
      total += n; stats.interpInstr += n;
      if (!inSpan) { pageHits.set(p, (pageHits.get(p) || 0) + n); hitTotal += n; }
      if (u[TRAP_REASON >> 2] !== 0) return total;
      pc = u[PC_OUT >> 2] >>> 0;
      if (n === 0) return total;
    }
    return total;
  }
  return {
    run, frame, drop: dropAll, stats,
    get live() { return spans.length > 0; },
    get spans() { return spans.map(s => ({ lo: s.lo, hi: s.hi, region: regions[s.ri].name, instructions: s.n, translated: s.t })); },
  };
}

export { buildModule as _buildModule };

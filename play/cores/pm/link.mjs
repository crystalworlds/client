/*
 * play/cores/pm/link.mjs -- two Pokemon mini units on one screen, linked by infrared.
 * 24 Oct 2026. Used by core.mjs when the visitor picks "Two players".
 *
 * WHAT THE LINK IS. The core (pokemini.wasm, unchanged) already models the console's infrared
 * port as the hardware has it: the transmitter is a pin the game toggles ($2061 bit 1, while the
 * port is an output and IR is enabled), the receiver is a pin the game reads ($2061 bit 0), and a
 * rising edge on it raises the IR interrupt ($2A bit 7, vector $1E). There is no carrier, no baud
 * rate and no byte framing in the hardware: every game bit-bangs its own protocol off its timers
 * (our notes Q5, Q6). The core hands out each edge of its transmitter stamped with
 * the cycle it happened on (pm_ir_tx_*), and takes edges for its receiver stamped with the cycle
 * they arrive on (pm_ir_rx_push). This file is only the light between two units:
 *   - both units run in lockstep on one link clock, SLICE cycles at a time (16 cycles = 4 us);
 *   - after every slice each unit's new edges go to the other unit's receiver at the cycle they
 *     were sent plus DELAY (32 cycles = 8 us), the transceivers' latency;
 *   - DELAY is at least one slice, so an edge always lands in the receiver's future and is seen
 *     at its exact cycle, never early and never bunched with the next one.
 * So each edge keeps the timing the sending game gave it, to the cycle; only the 8 us flight
 * time is added (a real IrDA-class transceiver takes a few microseconds). Measured with the five
 * link games: every link mode reaches play with DELAY from 32 up to 512 cycles;
 * a 2 ms delay breaks Party mini's handshake, as a delay that long would on the console.
 *
 * WHICH GAMES. The cartridge header's game code (offset $21AC, 4 characters; the 4th is the
 * region) names the five titles whose instruction booklets describe an infrared mode:
 * MPT Party mini (Sneasel's Fake Out, Battlefield), MAC Zany Cards (and its Japanese release),
 * MST Pokemon Tetris / Shock Tetris, MRC Race mini (Ditto battle, ranking exchange) and
 * MBR Pichu Bros. mini. Only these are offered the Two players choice.
 */
export const SLICE = 16, DELAY = 32;
const EV = 16;                                                   // sizeof pm_ir_event: u64 cycle, u8 level, 7 pad
export const LINK_CODES = ['MPT', 'MAC', 'MST', 'MRC', 'MBR'];
export function linkable(cart) {
  if (!cart || cart.length < 0x21B0) return false;
  const code = String.fromCharCode(cart[0x21AC], cart[0x21AD], cart[0x21AE]);
  return LINK_CODES.includes(code);
}
/* Two screens side by side with the gap of the two shells between them (art.mjs LINK_*): the
   picture is the two windows and the plastic between, at one pixel per screen dot. */
export const LINK_GAP = 114, LINK_W = 96 * 2 + LINK_GAP, LINK_H = 64;

function readTx(X) {
  const n = X.pm_ir_tx_count();
  if (!n) return null;
  const dv = new DataView(X.memory.buffer), b = X.pm_ir_tx_ptr(), out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = [Number(dv.getBigUint64(b + i * EV, true)), dv.getUint8(b + i * EV + 8)];
  X.pm_ir_tx_clear();
  return out;
}
function pushRx(X, edges, shift) {
  const dv = new DataView(X.memory.buffer), sp = X.pm_ir_rx_scratch_ptr();
  edges.forEach((e, i) => { dv.setBigUint64(sp + i * EV, BigInt(Math.max(0, e[0] + shift)), true); dv.setUint8(sp + i * EV + 8, e[1]); });
  X.pm_ir_rx_push(sp, edges.length);
}

/** The light between two cores (their wasm exports). */
export class Link {
  constructor(XA, XB) {
    this.u = [{ X: XA, cnt: 0, base: 0 }, { X: XB, cnt: 0, base: 0 }];
    this.G = 0;                                                  // the link clock, cycles
    this.stats = { edges: [0, 0], late: 0, slices: 0 };
    this.rebase();
  }
  /** After a power-on, a snap or a load: each unit's own cycle count, read again. */
  rebase() {
    for (const u of this.u) { u.cnt = Number(u.X.pm_cycle_counter()); u.base = u.cnt - this.G; }
    // An edge in flight belongs to the moment that was just replaced.
    for (const u of this.u) u.X.pm_ir_tx_clear();
  }
  /** Run both units `cycles` cycles of the link clock. */
  run(cycles) {
    const [a, b] = this.u, end = this.G + cycles;
    while (this.G < end) {
      this.G = Math.min(end, this.G + SLICE);
      this.stats.slices++;
      for (const u of this.u) {
        const want = u.base + this.G - u.cnt;
        if (want > 0) u.cnt += u.X.pm_run_cycles(want);
      }
      const ea = readTx(a.X), eb = readTx(b.X);
      if (ea) { this.stats.edges[0] += ea.length; this.cross(ea, a, b); }
      if (eb) { this.stats.edges[1] += eb.length; this.cross(eb, b, a); }
    }
  }
  cross(edges, from, to) {
    const shift = to.base - from.base + DELAY;
    if (edges[0][0] + shift < to.cnt) this.stats.late++;          // only when a unit overran its slice
    pushRx(to.X, edges, shift);
  }
}

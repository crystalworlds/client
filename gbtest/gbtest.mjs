/*
 * gbtest/gbtest.mjs -- the machine behind the /gbtest/ page (13 Nov 2026).
 *
 * The page exists for the public Game Boy Emulator Shootout
 * (github.com/gbdev/GBEmulatorShootout): its harness opens the page, picks a model, hands the
 * page a test cartridge and reads the picture off the canvas. So this module does one thing:
 * start the site's own Game Boy core on one cartridge, on one model, and give back each
 * frame as plain pixels.
 *
 * Nothing here is a second copy of the emulator. The core is the one the play window runs
 * (play/gameboy/build/gb.wasm), loaded through the same wrapper (play/gameboy/web/core.js),
 * and the pixels go through the same conversion (play/gameboy/web/shell.js blitInto) with the
 * "Reference grey" palette. No colour correction, no screen response, no border.
 *
 * START-UP PROGRAMS (the standing order: the original, a manufacturer's, our own, none).
 * A public page holds no Nintendo start-up program, so every model runs our own
 * (play/gameboy/gb-boot.js), which leaves the machine exactly as the console's own does, on the
 * same cycle. It runs in full before the first frame is shown, unseen and unheard, as the play
 * window does with "Show start-up logo" off, so a test's own timing starts at the game.
 *
 * No DOM, no storage, so a Node script can run this module unchanged.
 */
import { GBHost, FRAME_HZ, SCREEN_W, SCREEN_H } from '../play/gameboy/web/core.js';
import { paletteLUT, blitInto } from '../play/gameboy/web/shell.js';
import { cgbAppliesTo, cgbAssignmentFor } from '../play/gameboy/cgb-assign.js';
import { cgbStartup } from '../play/gameboy/cgb-boot.js?v=2.2.2';

export { FRAME_HZ, SCREEN_W, SCREEN_H };
export const MODELS = ['DMG', 'CGB', 'SGB'];

export async function loadHost(wasmBytes) {
  return GBHost.instantiate(wasmBytes);
}

/* One machine on one cartridge. Returns { runFrame(), draw(out32), info }. */
export function startMachine(host, bytes, model) {
  if (MODELS.indexOf(model) < 0) throw new Error('unknown model ' + model);
  if (!bytes || bytes.length < 0x150) throw new Error('This file is too short to be a Game Boy cartridge.');
  const X = host.exports;
  const cgb = model === 'CGB';
  const ours = cgbStartup(cgb && cgbAppliesTo(bytes) ? cgbAssignmentFor(bytes).config : undefined, bytes, cgb ? 'cgb' : model === 'SGB' ? 'sgb' : 'dmg');
  host.setBios(ours.bios, ours.key);
  const startup = 'own';
  const m = host.create(bytes, { label: 'test', device: cgb ? 'cgb' : 'dmg', useBios: true, bios: ours.key });
  if (model === 'SGB') {
    if (typeof X.gb_set_sgb !== 'function' || !X.gb_set_sgb(m.ctx, 1)) { host.free(m); throw new Error('This core has no Super Game Boy.'); }
    X.gb_reset(m.ctx);                  // as the play window does: the Game Boy inside a Super Game Boy, from power-on
  }
  for (const [a, b] of ours.vram) for (let i = 0; i < b.length; i++) X.gb_poke(m.ctx, a + i, b[i]);
  /* the start-up, run before the first frame is shown */
  for (let n = 0; n < ours.frames; n++) { m.runFrame(); if (model === 'SGB' && typeof X.gb_sgb_npackets === 'function' && (X.gb_sgb_npackets(m.ctx) | 0) > 0) X.gb_sgb_consume(m.ctx); }
  const sgb = model === 'SGB' && typeof X.gb_sgb_npackets === 'function';
  const lut = paletteLUT('reference');
  const modelName = typeof X.gb_get_model === 'function' && typeof X.gb_model_name === 'function'
    ? cString(X, X.gb_model_name(X.gb_get_model(m.ctx))) : '';
  return {
    machine: m,
    info: { model, coreModel: modelName, startup, device: m.device },
    runFrame() {
      m.runFrame();
      /* The Super Game Boy's packets go to the SNES side (its colours and border), which this
         page does not draw; they are taken off the queue as the play window takes them. */
      if (sgb && (X.gb_sgb_npackets(m.ctx) | 0) > 0) X.gb_sgb_consume(m.ctx);
    },
    draw(out32) { blitInto(out32, m.frame, m.frameFormat, lut); },
    free() { host.free(m); },
  };
}

function cString(X, ptr) {
  if (!ptr) return '';
  const u = new Uint8Array(X.memory.buffer, ptr, 64);
  let s = '';
  for (let i = 0; i < u.length && u[i]; i++) s += String.fromCharCode(u[i]);
  return s;
}

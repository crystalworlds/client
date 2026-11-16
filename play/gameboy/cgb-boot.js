/* cgb-boot.js: the Game Boy Color start-up program for a cartridge, our own.
 *
 * This file used to hold a 256-byte stub that only wrote the palettes. The full program now lives in
 * gb-boot.js: the CrystalWorlds letter drop with its notes and bell, then the machine left exactly as the
 * Color's own start-up leaves it, on the same cycle, with the same palettes for an original cartridge.
 * The two exports keep their names so the play window and the test page call them as before; both now
 * take the cartridge, because the hand-over moment and the registers depend on its header.
 *
 *   cfg   the three palettes for an original cartridge the console does not recognise (the site's palette
 *         setting, as if its button combination were held); ignored when the console recognises the title.
 */
import { gbStartup } from "./gb-boot.js?v=2.2.1";

const cache = new Map();
function startup(cfg, cart, kind) {
  const r = gbStartup(kind || "cgb", cart, { config: cfg });
  cache.set(r.key, r);
  return r;
}
/** The program's bytes (2,304), for this cartridge on the Color. */
export function cgbBootStub(cfg, cart, kind) { return startup(cfg, cart, kind).bios; }
/** A stable key for caching one program per cartridge and palette choice. */
export function cgbBootKey(cfg, cart, kind) { return startup(cfg, cart, kind).key; }
/** The whole start-up: { bios, vram, key, frames }. */
export function cgbStartup(cfg, cart, kind) { return startup(cfg, cart, kind); }

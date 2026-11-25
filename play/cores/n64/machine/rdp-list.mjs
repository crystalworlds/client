// Reads a list of RDP command words: each command's name and length, which pipeline mode and
// which images were in force when it ran, and what a whole list uses. Used by the scene tool to
// name the command behind a differing pixel and to sort scenes by mode. It draws nothing. It imports nothing.

export const MODES = ["one-cycle", "two-cycle", "copy", "fill"];
// Scenes are sorted by the furthest pipeline mode they draw in, in the order the modes are built.
export const GROUP_ORDER = ["fill", "copy", "one-cycle", "two-cycle"];

const NAMES = {
  0x24: "textured rectangle", 0x25: "textured rectangle, flipped", 0x26: "sync load", 0x27: "sync pipe", 0x28: "sync tile", 0x29: "full sync",
  0x2A: "set key (green, blue)", 0x2B: "set key (red)", 0x2C: "set convert", 0x2D: "set scissor", 0x2E: "set primitive depth", 0x2F: "set other modes",
  0x30: "load palette", 0x32: "set tile size", 0x33: "load block", 0x34: "load tile", 0x35: "set tile", 0x36: "filled rectangle", 0x37: "set fill colour",
  0x38: "set fog colour", 0x39: "set blend colour", 0x3A: "set primitive colour", 0x3B: "set environment colour", 0x3C: "set combine mode",
  0x3D: "set texture image", 0x3E: "set depth image", 0x3F: "set colour image",
};

export function commandWords(first) {
  const id = (first >>> 24) & 0x3F;
  if (id >= 8 && id <= 15) return 8 + ((id & 4) ? 16 : 0) + ((id & 2) ? 16 : 0) + ((id & 1) ? 4 : 0);
  return id === 0x24 || id === 0x25 ? 4 : 2;
}

export function commandName(first) {
  const id = (first >>> 24) & 0x3F;
  if (id >= 8 && id <= 15) return "triangle" + ((id & 4) ? ", shaded" : "") + ((id & 2) ? ", textured" : "") + ((id & 1) ? ", with depth" : "");
  return NAMES[id] ?? "no operation";
}

const isDraw = (id) => (id >= 8 && id <= 15) || id === 0x24 || id === 0x25 || id === 0x36;

// Walks the list. Returns one entry for each whole command: where it starts (in words), its number,
// its name, and for a drawing command the mode and images in force. A command cut short at the end
// of the list is left out, as both renderers leave it out.
export function readList(words) {
  const out = [];
  let mode = 0, colour = { address: 0, width: 0, size: 0, format: 0 }, depth = 0;
  for (let at = 0; at < words.length; ) {
    const first = words[at], id = (first >>> 24) & 0x3F, n = commandWords(first);
    if (at + n > words.length) break;
    const e = { at, words: n, id, name: commandName(first) };
    if (id === 0x2F) mode = (first >>> 20) & 3;
    else if (id === 0x3F) colour = { address: words[at + 1] & 0xFFFFFF, width: (first & 0x3FF) + 1, size: (first >>> 19) & 3, format: (first >>> 21) & 7 };
    else if (id === 0x3E) depth = words[at + 1] & 0xFFFFFF;
    if (isDraw(id)) { e.draws = true; e.mode = MODES[mode]; }
    e.colour = colour; e.depth = depth;
    out.push(e);
    at += n;
  }
  return out;
}

// What a list uses: how many primitives it draws in each mode, and which features.
export function listUse(list) {
  const use = { commands: list.length, fullSyncs: 0, loads: 0, drawn: { fill: 0, copy: 0, "one-cycle": 0, "two-cycle": 0 }, triangles: 0, rectangles: 0, shaded: 0, textured: 0, withDepth: 0, pixelSizes: [] };
  for (const e of list) {
    if (e.id === 0x29) use.fullSyncs++;
    if (e.id === 0x30 || e.id === 0x33 || e.id === 0x34) use.loads++;
    if (!e.draws) continue;
    use.drawn[e.mode]++;
    if (e.id >= 8 && e.id <= 15) { use.triangles++; if (e.id & 4) use.shaded++; if (e.id & 2) use.textured++; if (e.id & 1) use.withDepth++; }
    else { use.rectangles++; if (e.id !== 0x36) use.textured++; }
    const bits = [4, 8, 16, 32][e.colour.size];
    if (!use.pixelSizes.includes(bits)) use.pixelSizes.push(bits);
  }
  use.group = [...GROUP_ORDER].reverse().find((g) => use.drawn[g] > 0) ?? "draws nothing";
  return use;
}

// Says what a byte address of main memory is to the command that was running: a pixel of its
// colour image, a place in its depth image, or neither. Of the two images, the one that starts
// nearest below the address is taken.
export function placeOf(address, entry) {
  const c = entry.colour, bytes = [1, 1, 2, 4][c.size];
  const images = [];
  if (c.width && address >= c.address) images.push({ what: "colour image", base: c.address, bytes });
  if (c.width && entry.depth && address >= entry.depth) images.push({ what: "depth image", base: entry.depth, bytes: 2 });
  images.sort((p, q) => q.base - p.base);
  const hit = images[0];
  if (!hit || address >= hit.base + c.width * 1024 * hit.bytes) return { what: "memory outside both images" };
  const index = Math.floor((address - hit.base) / hit.bytes);
  return { what: hit.what, x: index % c.width, y: Math.floor(index / c.width), bytesAPixel: hit.bytes, pixelAddress: hit.base + index * hit.bytes };
}

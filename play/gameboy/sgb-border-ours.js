/* sgb-border-ours.js: our own Super Game Boy border, "Colour bands", drawn here from shapes.
 *
 * Shown around the screen from power-on, whenever our start-up program runs on a Super Game Boy, until the
 * game sends its own border, exactly where the Super Game Boy's own border would be. It is in the real
 * border format (4-bit tiles, at most 256 of them, a 32 x 28 map, palette 4; colour 0 shows the screen),
 * so a game's own border replaces it as on the console. Our own drawing: a light Game Boy body with a
 * rainbow band, a dark glass around the screen, SUPER GAME BOY in our letters and two sparkles.
 */
const W = 256, H = 224, SX = 48, SY = 40, SW = 160, SH = 144;
const F = {
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."], U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."], E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"], G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".###."],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"], M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."], O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."], " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
};
const COLOURS = [[0, 0, 0], [236, 236, 230], [210, 210, 204], [60, 60, 72], [220, 60, 70], [240, 160, 40], [60, 170, 90], [50, 110, 220], [140, 70, 190], [30, 30, 40]];
function picture() {
  const pic = new Uint8Array(W * H);
  const rect = (x0, y0, x1, y1, c, r = 0) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const dx = Math.max(x0 + r - x - 0.5, x - (x1 - r) + 0.5, 0), dy = Math.max(y0 + r - y - 0.5, y - (y1 - r) + 0.5, 0);
    if (r && dx > 0 && dy > 0 && dx * dx + dy * dy > r * r) continue; pic[y * W + x] = c; } };
  const text = (s, x, y, sc, c) => { for (const ch of s) { const g = F[ch]; for (let r = 0; r < 7; r++) for (let k = 0; k < 5; k++) if (g[r][k] === "#") rect(x + k * sc, y + r * sc, x + k * sc + sc, y + r * sc + sc, c); x += 6 * sc; } };
  const spark = (cx, cy, c1, c2) => { for (let d = -3; d <= 3; d++) { pic[cy * W + cx + d] = Math.abs(d) > 1 ? c1 : c2; pic[(cy + d) * W + cx] = Math.abs(d) > 1 ? c1 : c2; } };
  rect(0, 0, W, H, 1);
  [4, 5, 6, 7, 8].forEach((c, i) => rect(0, 4 + i * 3, W, 7 + i * 3, c));     // the rainbow band
  rect(28, 24, 228, 200, 9, 10); rect(30, 26, 226, 198, 3, 8);                    // the glass around the screen
  const s = "SUPER GAME BOY"; text(s, 128 - ((s.length * 12 - 2) >> 1), 205, 2, 9);
  spark(14, 120, 5, 4); spark(242, 120, 7, 8);
  rect(SX, SY, SX + SW, SY + SH, 0);                                              // the screen shows through
  return pic;
}
let made = null;
/** { tiles: Uint8Array(8192), map: Uint16Array(1024), pal: Uint16Array(64), which } as the play window's border takes it */
export function ourSgbBorder() {
  if (made) return made;
  const pic = picture(), tiles = [], key = new Map(), map = new Uint16Array(1024);
  for (let ty = 0; ty < 28; ty++) for (let tx = 0; tx < 32; tx++) {
    const t = new Uint8Array(32);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const v = pic[(ty * 8 + r) * W + tx * 8 + c], m = 0x80 >> c;
      if (v & 1) t[r * 2] |= m; if (v & 2) t[r * 2 + 1] |= m; if (v & 4) t[16 + r * 2] |= m; if (v & 8) t[16 + r * 2 + 1] |= m; }
    const k = Array.from(t).join(","); if (!key.has(k)) { key.set(k, tiles.length); tiles.push(t); }
    map[ty * 32 + tx] = key.get(k) | (4 << 10);
  }
  if (tiles.length > 256) throw new Error("sgb border: too many tiles");
  const t8 = new Uint8Array(8192); tiles.forEach((t, i) => t8.set(t, i * 32));
  const pal = new Uint16Array(64); COLOURS.forEach(([r, g, b], i) => { pal[i] = (Math.round(b * 31 / 255) << 10) | (Math.round(g * 31 / 255) << 5) | Math.round(r * 31 / 255); });
  return (made = { tiles: t8, map, pal, which: "CrystalWorlds" });
}

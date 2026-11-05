/*
 * play/cores/gb/mode.mjs -- what the Game Boy core is showing, for its art module (2026-10-24).
 * core.mjs sets it on every load; art.mjs reads it: a wide picture (the Super Game Boy's television,
 * 256 x 224, or two linked consoles side by side) is shown as a plain screen, not inside the console photograph.
 */
export const GB_MODE = { wide: false, sgb: false, link: false };

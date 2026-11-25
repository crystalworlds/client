// The graphics card's worker of the core's threaded build (a build with the card's bit, machine/n64core-threads-card.wasm):
// it opens the browser's WebGPU with the RDP's compute shader and serves the core's desk over the shared memory for as
// long as the device lives (machine/card.mjs, serve). The drawing thread puts the calls the card may draw on the desk
// and looks for the answer; this worker's loop is JavaScript's, so the card's read-back can end here meanwhile. What
// the card draws is what the core draws by itself, word for word: the core's own checks hold that, not this file.
// Started by core.mjs beside the drawing thread's worker, and only where the browser offers WebGPU.
//
//   posted to it: { memory, deskAt, wgsl }   the core's shared memory, where its desk lies, the shader's text
//   it posts:     { card: { adapter } } once it serves, { card: { error } } when it cannot (no WebGPU here, no adapter,
//                 a shader the card would not take), { card: { ended } } when it serves no more (the device was lost)
//
// A card that serves no more must not leave the drawing thread waiting: from then on every request is refused at once
// (the desk's state word, the first of the desk: 1 a request, 5 it could not be done), and the core draws by itself.

import { Card } from "./machine/card.mjs?v=8339d6272279";

const STATE = 0, ASKED = 1, COULD_NOT = 5;
async function refuse(memory, deskAt) {
  for (;;) {
    const h = new Int32Array(memory.buffer, deskAt, 64), s = Atomics.load(h, STATE);
    if (s === ASKED) { if (Atomics.compareExchange(h, STATE, ASKED, COULD_NOT) === ASKED) Atomics.notify(h, STATE); continue; }
    const w = Atomics.waitAsync(h, STATE, s, 250);
    if (w.async) await w.value;
  }
}

self.onmessage = async ({ data: { memory, deskAt, wgsl } }) => {
  let ended = null;
  try {
    const card = await Card.open(wgsl);
    self.postMessage({ card: { adapter: card.adapter } });
    ended = String(await card.serve(memory, deskAt));
  } catch (err) {
    self.postMessage({ card: { error: String(err?.message ?? err) } });
    return;
  }
  self.postMessage({ card: { ended } });
  await refuse(memory, deskAt);
};

// The host's side of the RDP's mode drawn on a graphics card (a faster road, a trial; bit 67108864;
// docs/parts/SPEED.md, section 19): the card's queue (core/rdp_card.h) cut into dispatches, each drawn by
// the mode's compute shader (card-mode-0.wgsl) over main memory's words on the card, and read back.
//
// Main memory is kept here one 32-bit number a 16-bit word: the word, and above it the byte of the hidden
// bits' plane (`wide`). The shader keeps the order of the list at every place by itself, as long as nothing
// a pixel reads is another place's word: so a dispatch is a row of calls that draw into the same two images,
// whose colour words and depth words do not lie across each other. A call the shader cannot take (its lines
// leave the 1,024 places a line has, its words wrap round memory's end, its two images lie across each
// other) ends the dispatch and is given to `byHand`, which draws it as the core does.
//
// The frame (section 20) has the core cut and pack by itself: `serve` only sends a core's desk up, makes its
// dispatches and brings the answer back (core/rdp_card.h has the desk).
//
// This file runs in a page or a worker: it touches nothing but WebGPU and, in `serve`, the desk.

export const HEAD = 64, LINE = 24, TMEM_WORDS = 1026, KIND_JOB = 1, KIND_TMEM = 2;
const BIN = 64;                 // places a bin, and a work group
const LEFT = 64, UNIFORM = 16;  // the words of what calls leave besides memory, and of a dispatch's own (core/rdp_card.h)
const WORDS23 = 0x800000, FILL = 100, DECAL = 101;

// The kinds of call, a bit each (core/rdp_card.h): 1 the card's mode, 2 made line 8, 4 and 8 the two lines without a
// texture, 16 line 37, 32 a fill, 64 the mode as a decal. The dear kinds are those that cost a processor most a place:
// all but line 8 and fill. The first dear kinds are those without the decal, which came later and is seldom drawn.
export const EVERY_KIND = 127, DEAR_KINDS = 93, FIRST_DEAR_KINDS = 29;
export const kindOf = (line) => (line === FILL ? 32 : line === DECAL ? 64 : line === 0 ? 1 : line === 8 ? 2 : line === 13 ? 4 : line === 18 ? 8 : line === 37 ? 16 : 0);
// The shader's text for a set of kinds: a line of the whole text that is marked with a kind the set lacks is left out,
// or becomes what its mark says (the shader's head says how a line is marked). For every kind it is the text as it is.
export function shaderFor(wgsl, kinds) {
  if ((kinds & EVERY_KIND) === EVERY_KIND) return wgsl;
  const out = [];
  for (const line of wgsl.split("\n")) {
    const m = line.match(/\/\/~(\d+)(?:=(.*))?$/);
    if (!m || (kinds & Number(m[1]))) out.push(line);
    else if (m[2] !== undefined) out.push(m[2]);
  }
  return out.join("\n");
}

// Cuts a row of records into steps: { dispatch } or { byHand: [at, length] }. `words` is the queue. `cut`, when
// given, is asked before every call whether the dispatch should end there (a tool cuts at random: where a
// dispatch ends must change nothing).
// `apart`: a dispatch also ends where a call of the dear kinds follows one of the others or the other way about, so
// that the calls of the dear kinds are drawn by their own shader (a tool's switch: that too must change nothing).
export function plan(words, length = words.length, cut = null, loose = false, apart = false) {
  const steps = [];
  let d = null, texture = -1;      // the dispatch being gathered; where the texture memory in force lies in the queue
  const close = () => { if (d && d.jobs.length) steps.push({ dispatch: d }); d = null; };
  const begin = (cbase, zbase, ramWords) => ({ cbase, zbase, ramWords, lo: 0xFFFFFFFF, hi: 0, jobs: [], lines: 0, textures: [], entries: 0, kinds: 0 });
  for (let at = 0; at + 2 <= length;) {
    const len = words[at], kind = words[at + 1];
    if (kind === KIND_TMEM && len === TMEM_WORDS) { texture = at + 2; at += len; continue; }
    if (kind !== KIND_JOB || len !== HEAD + words[at + 6] * LINE || at + len > length) break;       // (kinds a tool adds behind a call are passed over by the tool)
    const left = words[at + 4] !== 0, width = words[at + 8], n = words[at + 6];
    // (A fill of a 16-bit image, word 56 of its head 100: no depth image, no texture memory; the card takes one whose words
    // all lie in memory and whose major edge is the right one or whose image begins on a multiple of eight bytes.)
    const fill = words[at + 56] === FILL;
    const cbase = (words[at + 7] >>> 1) & (WORDS23 - 1), zbase = fill ? WORDS23 : (words[at + 9] >>> 1) & (WORDS23 - 1), ramWords = words[at + 13] >>> 1;
    let lo = 0xFFFFFFFF, hi = 0, fits = (fill || texture >= 0) && width <= 0x10000, entries = 0;
    for (let i = 0, l = at + HEAD; i < n && fits; i++, l += LINE) {
      const from = (left ? words[l + 2] : words[l + 1]) | 0, to = (left ? words[l + 1] : words[l + 2]) | 0;
      if (to < from) continue;
      if (from < 0 || to > 1023 || words[l] > 1023) { fits = false; break; }
      const a = width * words[l] + from, b = width * words[l] + to;
      if (a < lo) lo = a;
      if (b > hi) hi = b;
      entries += ((b >>> 6) - (a >>> 6)) + 1;
    }
    const empty = lo > hi;
    const across = (l2, h2) => !loose && !fill && cbase + l2 <= zbase + h2 && zbase + l2 <= cbase + h2;
    if (fits && !empty && (cbase + hi >= WORDS23 || (!fill && zbase + hi >= WORDS23) || across(lo, hi))) fits = false;
    if (fits && !empty && fill && (cbase + hi >= ramWords || (left && (words[at + 7] & 7) !== 0))) fits = false;
    if (!fits) { close(); steps.push({ byHand: [at, len], texture }); at += len; continue; }
    if (empty) { at += len; continue; }
    if (d && cut && cut()) close();
    const kinds = kindOf(words[at + 56]);
    if (d && apart && !(d.kinds & ~DEAR_KINDS) !== !(kinds & ~DEAR_KINDS)) close();
    if (d && (d.cbase !== cbase || d.zbase !== zbase || d.ramWords !== ramWords || across(Math.min(lo, d.lo), Math.max(hi, d.hi)) || !fill && d.textures.length >= 255 && d.textures[d.textures.length - 1] !== texture)) close();
    if (!d) d = begin(cbase, zbase, ramWords);
    if (!fill && d.textures[d.textures.length - 1] !== texture) d.textures.push(texture);
    d.jobs.push({ at, slot: fill ? -1 : d.textures.length - 1 });
    d.lines += n; d.entries += entries; d.kinds |= kinds;
    if (lo < d.lo) d.lo = lo;
    if (hi > d.hi) d.hi = hi;
    at += len;
  }
  close();
  return steps;
}

const roomFor = (n) => { let r = 4096; while (r < n) r *= 2; return r; };

export class Card {
  // `wgsl`: the shader's text. `wrong`: a copy made wrong on purpose (the shader says which; two are the host's own: 5, images across each other are not asked
  // after; 13, every dispatch is drawn by the shader of the fewest kinds, whatever its calls), for a tool's proof. `sets`: the sets of kinds a shader is made for
  // when the card is opened (every kind is always among them); a dispatch is drawn by the shader of the smallest set that holds its calls' kinds.
  static async open(wgsl, { wrong = 0, powerPreference = undefined, sets = [FIRST_DEAR_KINDS, DEAR_KINDS] } = {}) {
    if (!globalThis.navigator?.gpu) throw new Error("this host offers no WebGPU");
    const adapter = await navigator.gpu.requestAdapter(powerPreference ? { powerPreference } : undefined);
    if (!adapter) throw new Error("WebGPU gives no adapter here");
    const device = await adapter.requestDevice();
    const card = new Card();
    card.adapter = { vendor: adapter.info?.vendor ?? null, architecture: adapter.info?.architecture ?? null, device: adapter.info?.device ?? null, description: adapter.info?.description ?? null, fallback: adapter.info?.isFallbackAdapter ?? adapter.isFallbackAdapter ?? null };
    card.device = device; card.wrong = wrong; card.lost = null;
    device.lost.then((e) => { card.lost = e.message || "the device was lost"; });
    device.pushErrorScope("validation");
    // (One layout for every set's shader, so that a dispatch's bindings serve whichever draws it.)
    const kindsOfBinding = ["uniform", "storage", "read-only-storage", "read-only-storage", "read-only-storage", "read-only-storage", "read-only-storage", "storage", "uniform"];
    card.layout = device.createBindGroupLayout({ entries: kindsOfBinding.map((type, binding) => ({ binding, visibility: GPUShaderStage.COMPUTE, buffer: { type } })) });
    const layout = device.createPipelineLayout({ bindGroupLayouts: [card.layout] });
    const bits = (v) => { let n = 0; for (let b = v; b; b &= b - 1) n++; return n; };
    const all = [...new Set([...sets.map((s) => s & EVERY_KIND), EVERY_KIND])].sort((a, b) => bits(a) - bits(b));
    card.shaders = await Promise.all(all.map(async (kinds) => {
      const module = device.createShaderModule({ code: shaderFor(wgsl, kinds) });
      const info = await module.getCompilationInfo();
      const errors = info.messages.filter((m) => m.type === "error").map((m) => `${m.lineNum}:${m.linePos} ${m.message}`);
      if (errors.length) throw new Error(`the shader for the kinds ${kinds} does not compile: ${errors.slice(0, 5).join("; ")}`);
      return { kinds, pipeline: await device.createComputePipelineAsync({ layout, compute: { module, entryPoint: "main" } }), dispatches: 0 };
    }));
    const bad = await device.popErrorScope();
    if (bad) throw new Error(`the card refused the shader: ${bad.message}`);
    card.buffers = {}; card.sizes = {}; card.groups = []; card.uniforms = [];
    // The shader's four tables once more in a buffer, read from its own text (for a reading: the shader says when it takes them from there).
    const table = (name) => { const m = wgsl.match(new RegExp(`const ${name} = array<[iu]32, \\d+>\\(([^;]*)\\);`)); if (!m) throw new Error(`the shader's text has no table ${name}`); return m[1].split(",").map((v) => Number(v.trim().replace(/u$/, ""))); };
    const tables = new Uint32Array(100);
    tables.set(table("RECIPROCAL"), 0); tables.set(table("MAGIC"), 68); tables.set(table("DEPTH_SHIFT"), 84); tables.set(table("DEPTH_BASE"), 92);
    card.tables = device.createBuffer({ size: 400, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(card.tables, 0, tables);
    card.back = null; card.backSize = 0;
    return card;
  }

  buffer(name, words, usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST) {
    // (A part that is empty still has a buffer: a pass binds every part, and a desk of fills alone has no texture memory.)
    if (this.buffers[name] && this.sizes[name] >= words) return this.buffers[name];
    this.buffers[name]?.destroy();
    const size = roomFor(Math.max(1, words));
    this.buffers[name] = this.device.createBuffer({ size: size * 4, usage });
    this.sizes[name] = size; this.groups = [];
    return this.buffers[name];
  }

  // The shader a dispatch is drawn by: that of the smallest set that holds all the kinds of its calls.
  shaderOf(kinds) {
    const s = this.wrong === 13 ? this.shaders[0] : this.shaders.find((v) => (kinds & ~v.kinds) === 0) ?? this.shaders[this.shaders.length - 1];
    s.dispatches++;
    return s;
  }

  uniform(i) { return (this.uniforms[i] ??= this.device.createBuffer({ size: 4 * UNIFORM, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })); }
  group(i) {
    return (this.groups[i] ??= this.device.createBindGroup({ layout: this.layout, entries: [{ binding: 0, resource: { buffer: this.uniform(i) } }, ...["ram", "jobs", "spans", "bins", "list", "tmem", "left"].map((n, k) => ({ binding: k + 1, resource: { buffer: this.buffers[n] } })), { binding: 8, resource: { buffer: this.tables } }] }));
  }

  // Draws a row of plan()'s dispatches over `wide` (main memory, a number a word): the words they may reach go up
  // once, the dispatches are made in order in one pass (a later one finds what an earlier one wrote), and the words
  // come back once into `wide`. The promise ends when they are there. `times`, when given, is added to, in ms.
  async draw(words, run, wide, times = null) {
    const t0 = performance.now();
    let J = 0, L = 0, E = 0, B = 0;
    const slots = new Map();
    for (const d of run) {
      d.first = d.lo & ~(BIN - 1); d.count = d.hi - d.first + 1; d.binCount = Math.ceil(d.count / BIN);
      J += d.jobs.length; L += d.lines; E += d.entries; B += d.binCount;
      for (const at of d.textures) if (!slots.has(at)) slots.set(at, slots.size);
    }
    // The calls' heads, the lines, and the bins: every span is listed in each bin its places reach, in drawing order.
    const jobs = new Uint32Array(J * HEAD), spans = new Uint32Array(Math.max(1, L) * LINE), bins = new Uint32Array(B * 2), list = new Uint32Array(Math.max(1, E)), ends = new Uint32Array(Math.max(1, L) * 2);
    let j = 0, s = 0, binBase = 0, listAt = 0, number = 0, texelLast = 0, memoryLast = 0, pipeLast = 0;      // (pipeLast: likewise of the last call that is not a fill)     // (number: the pixels of the pass so far, in drawing order; texelLast: one more than the number of the last pixel of the last call that has a texel)
    for (const d of run) {
      const s0 = s;
      d.binBase = binBase;
      for (const job of d.jobs) {
        const at = job.at, left = words[at + 4] !== 0, width = words[at + 8], n = words[at + 6];
        jobs.set(words.subarray(at, at + HEAD), j * HEAD);
        jobs[j * HEAD + 14] = job.slot < 0 ? 0 : slots.get(d.textures[job.slot]);
        const numberBefore = number;
        spans.set(words.subarray(at + HEAD, at + HEAD + n * LINE), s * LINE);
        for (let i = 0, l = at + HEAD; i < n; i++, l += LINE, s++) {
          spans[s * LINE + 21] = j; spans[s * LINE + 22] = number;
          const from = (left ? words[l + 2] : words[l + 1]) | 0, to = (left ? words[l + 1] : words[l + 2]) | 0;
          if (to < from) { ends[2 * s] = 1; ends[2 * s + 1] = 0; continue; }
          number += to - from + 1;
          const p = (width * words[l] + from - d.first) >>> 6, q = (width * words[l] + to - d.first) >>> 6;
          ends[2 * s] = p; ends[2 * s + 1] = q;
          for (let k = p; k <= q; k++) bins[2 * (binBase + k) + 1]++;
        }
        if ((words[at + 56] === 0 || words[at + 56] === 8 || words[at + 56] === 37 || words[at + 56] === DECAL) && number > numberBefore) texelLast = number;      // (word 56: the call's line of the core's modes; lines 0, 8 and 37 and the decal have a texel)
        if (words[at + 56] !== 8 && words[at + 56] !== FILL && number > numberBefore) memoryLast = number;      // (every line but 8 reads the image in memory)
        if (words[at + 56] !== FILL && number > numberBefore) pipeLast = number;
        j++;
      }
      for (let k = binBase; k < binBase + d.binCount; k++) { bins[2 * k] = listAt; listAt += bins[2 * k + 1]; bins[2 * k + 1] = 0; }
      for (let i = s0; i < s; i++) for (let k = ends[2 * i]; k <= ends[2 * i + 1]; k++) list[bins[2 * (binBase + k)] + bins[2 * (binBase + k) + 1]++] = i;
      binBase += d.binCount;
    }
    const textures = new Uint32Array(Math.max(1, slots.size) * 1024);
    for (const [at, slot] of slots) textures.set(words.subarray(at, at + 1024), slot * 1024);

    this.pipeLast = pipeLast;
    const dev = this.device, q = dev.queue, ramWords = run[0].ramWords;
    const ram = this.buffer("ram", ramWords + 1, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC);
    const put = (name, data) => { const buf = this.buffer(name, data.length); q.writeBuffer(buf, 0, data); return buf; };
    put("jobs", jobs); put("spans", spans); put("bins", bins); put("list", list); put("tmem", textures);
    const leftBuffer = this.buffer("left", LEFT, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC);
    q.writeBuffer(leftBuffer, 0, new Uint32Array(LEFT));
    // The words the dispatches may reach, as far as memory goes, each once: up, drawn, and back.
    const asked = [];
    for (const d of run) for (const base of [d.cbase, d.zbase]) { const from = Math.min(base + d.first, ramWords), to = Math.min(base + d.first + d.count, ramWords); if (to > from) asked.push([from, to]); }
    asked.sort((x, y) => x[0] - y[0]);
    const reach = [];
    for (const [from, to] of asked) { const last = reach[reach.length - 1]; if (last && from <= last[1]) { if (to > last[1]) last[1] = to; } else reach.push([from, to]); }
    let total = 0;
    for (const [from, to] of reach) { q.writeBuffer(ram, from * 4, wide, from, to - from); total += to - from; }
    if (this.backSize < total + LEFT) { this.back?.destroy(); this.backSize = roomFor(total + LEFT); this.back = dev.createBuffer({ size: this.backSize * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }); }
    const enc = dev.createCommandEncoder(), pass = enc.beginComputePass();
    for (let i = 0; i < run.length; i++) {
      const d = run[i];
      q.writeBuffer(this.uniform(i), 0, new Uint32Array([d.first, BIN, d.count, d.ramWords, d.cbase, d.zbase, this.wrong, d.binBase, (pipeLast - 1) >>> 0, this.variant | 0, texelLast, memoryLast, d.kinds]));
      this.group(i);
      pass.setPipeline(this.shaderOf(d.kinds).pipeline);
      pass.setBindGroup(0, this.groups[i]);
      pass.dispatchWorkgroups(d.binCount);
    }
    pass.end();
    let o = 0;
    for (const [from, to] of reach) { enc.copyBufferToBuffer(ram, from * 4, this.back, o * 4, (to - from) * 4); o += to - from; }
    enc.copyBufferToBuffer(leftBuffer, 0, this.back, total * 4, LEFT * 4);
    q.submit([enc.finish()]);
    const t1 = performance.now();
    let worked = t1;
    // (`split`, for a reading: the card's own work is waited for by itself before the words are asked back, so the wait can be told apart.)
    if (this.split) { await q.onSubmittedWorkDone(); worked = performance.now(); }
    {
      await this.back.mapAsync(GPUMapMode.READ, 0, (total + LEFT) * 4);
      const got = new Uint32Array(this.back.getMappedRange(0, (total + LEFT) * 4));
      o = 0;
      for (const [from, to] of reach) { wide.set(got.subarray(o, o + to - from), from); o += to - from; }
      this.left = got.slice(total, total + LEFT);       // what the calls of this pass left besides memory (core/rdp_card.h)
      this.back.unmap();
    }
    if (this.lost) throw new Error(this.lost);
    if (times) { times.pack += t1 - t0; times.wait += performance.now() - t1; times.entries = (times.entries ?? 0) + E; times.bins = (times.bins ?? 0) + B; times.work = (times.work ?? 0) + (worked - t1); times.dispatches += run.length; times.roundTrips++; times.wordsUpAndBack += total; for (const d of run) times.places += d.count; }
  }

  // A whole row of records, in order. `byHand(at, length, texture)` draws one call as the core does, on `wide`:
  // the dispatches before it are drawn and read back first.
  async drawAll(words, wide, byHand, times = null, length = words.length, cut = null) {
    const t0 = performance.now();
    const steps = plan(words, length, cut, this.wrong === 5, !!this.apart);
    if (times) times.plan += performance.now() - t0;
    let run = [];
    for (const st of steps) {
      if (st.dispatch && (!run.length || run[0].ramWords === st.dispatch.ramWords)) { run.push(st.dispatch); continue; }
      if (run.length) { await this.draw(words, run, wide, times); run = []; }
      if (st.dispatch) run.push(st.dispatch);
      else { if (times) times.byHand++; await byHand(st.byHand[0], st.byHand[1], st.texture); }
    }
    if (run.length) await this.draw(words, run, wide, times);
    return steps.length;
  }

  // ---- The card in the frame (core/rdp_card.c, its second half) ----
  // Serves the desk of a core: `memory` is the core's shared memory, `deskAt` what n64_rdp_card_desk() gave. Every
  // request of the drawing thread is drawn and answered, until the device is lost, the core gives a request up, or
  // `stop()` is called. It must run on a thread whose loop is JavaScript's (a worker of its own): the drawing
  // thread sleeps until the answer is there. Returns why it ended.
  async serve(memory, deskAt) {
    const STATE = 0;
    this.serving = true;
    for (;;) {
      const h = new Int32Array(memory.buffer, deskAt, 64);
      const s = Atomics.load(h, STATE);
      if (this.lost) { if (s === 1 && Atomics.compareExchange(h, STATE, 1, 5) === 1) Atomics.notify(h, STATE); this.serving = false; return this.lost; }
      if (!this.serving) return "stopped";
      if (s === 6) { this.serving = false; return "the core gave a request up"; }
      if (s !== 1) { const w = Atomics.waitAsync(h, STATE, s, 250); if (w.async) await w.value; continue; }
      if (Atomics.compareExchange(h, STATE, 1, 2) !== 1) continue;
      let ok = false;
      try { await this.answer(memory, deskAt); ok = !this.lost; } catch (e) { this.lost ??= String(e?.message ?? e); }
      const h2 = new Int32Array(memory.buffer, deskAt, 64);
      Atomics.compareExchange(h2, STATE, 2, ok ? 4 : 5);
      Atomics.notify(h2, STATE);
    }
  }
  stop() { this.serving = false; }

  // One request: the desk's parts up, its dispatches in one pass, the staged words and what the calls left back.
  async answer(memory, deskAt) {
    const t0 = performance.now();
    const buf = memory.buffer, h = new Uint32Array(buf, deskAt, 64);
    const [oUniforms, oLeft, oReach, oJobs, oSpans, oBins, oList, oTmem, oStage] = h.subarray(16, 25);
    const part = (o, n) => new Uint32Array(buf, deskAt + 4 * o, n);
    const dispatches = h[2], reaches = h[3], staged = h[4], serial = h[1];
    const dev = this.device, q = dev.queue;
    // (A view of a shared memory is taken as it is where the browser's queue takes one; where it does not, a copy is.)
    const send = (buffer, at, view) => {
      if (!view.length) return;
      if (this.sharedViews !== false) { try { q.writeBuffer(buffer, at, view); this.sharedViews = true; return; } catch (e) { if (this.sharedViews) throw e; this.sharedViews = false; } }
      q.writeBuffer(buffer, at, view.slice());
    };
    const put = (name, view) => { const b = this.buffer(name, view.length); send(b, 0, view); return b; };
    const ram = this.buffer("ram", h[10] + 1, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC);
    put("jobs", part(oJobs, h[5] * HEAD)); put("spans", part(oSpans, h[6] * LINE)); put("bins", part(oBins, h[7] * 2)); put("list", part(oList, Math.max(1, h[8]))); put("tmem", part(oTmem, h[9] * 1024));
    const leftBuffer = this.buffer("left", LEFT, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC);
    q.writeBuffer(leftBuffer, 0, (this.zeros ??= new Uint32Array(LEFT)));
    const reach = part(oReach, 2 * reaches), stage = part(oStage, staged);
    for (let k = 0, o = 0; k < reaches; k++) { const n = reach[2 * k + 1] - reach[2 * k]; send(ram, reach[2 * k] * 4, stage.subarray(o, o + n)); o += n; }
    if (this.backSize < staged + LEFT) { this.back?.destroy(); this.backSize = roomFor(staged + LEFT); this.back = dev.createBuffer({ size: this.backSize * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }); }
    for (let i = 0; i < dispatches; i++) send(this.uniform(i), 0, part(oUniforms + UNIFORM * i, UNIFORM));
    const enc = dev.createCommandEncoder(), pass = enc.beginComputePass();
    let fewer = 0;
    for (let i = 0; i < dispatches; i++) {
      // (Word 12 of a dispatch's own: the kinds of its calls, as the core says them.)
      const u = part(oUniforms + UNIFORM * i, UNIFORM), shader = this.shaderOf(u[12]);
      if (shader.kinds !== EVERY_KIND) fewer++;
      pass.setPipeline(shader.pipeline); pass.setBindGroup(0, this.group(i)); pass.dispatchWorkgroups(Math.ceil(u[2] / BIN));
    }
    pass.end();
    for (let k = 0, o = 0; k < reaches; k++) { const n = reach[2 * k + 1] - reach[2 * k]; enc.copyBufferToBuffer(ram, reach[2 * k] * 4, this.back, o * 4, n * 4); o += n; }
    enc.copyBufferToBuffer(leftBuffer, 0, this.back, staged * 4, LEFT * 4);
    q.submit([enc.finish()]);
    const t1 = performance.now();
    await this.back.mapAsync(GPUMapMode.READ, 0, (staged + LEFT) * 4);
    const got = new Uint32Array(this.back.getMappedRange(0, (staged + LEFT) * 4));
    // (The memory may have grown while the card drew: the views are taken anew.)
    new Uint32Array(memory.buffer, deskAt + 4 * oStage, staged).set(got.subarray(0, staged));
    new Uint32Array(memory.buffer, deskAt + 4 * oLeft, LEFT).set(got.subarray(staged, staged + LEFT));
    this.back.unmap();
    const t2 = performance.now(), back = new Uint32Array(memory.buffer, deskAt, 64);
    back[13] = serial; back[32] += 1; back[33] += Math.round((t1 - t0) * 1000); back[34] += Math.round((t2 - t1) * 1000); back[35] += fewer;
  }
}

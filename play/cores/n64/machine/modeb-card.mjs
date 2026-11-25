// Mode B's picture drawn by the graphics card (WebGPU): fast and approximate, never the default, never
// evidence of anything about the console (docs/parts/MODE-B.md, section 12).
//
// A core built with the piece (core/modeb_card.c) and switched on leaves, after a field, the host's orders,
// the vertices, the states of the draws and the bytes of the textures met for the first time. This file
// draws them with ordinary pipelines into a texture for each colour image the game names, at the console's
// size times `scale`, and shows the one the VI reads, laid out as the VI's registers say. It imports no
// part of Node and nothing of a page: whoever has a GPUDevice (a page or a worker) runs it.
//
//   const card = await openCard(core, { scale: 2 });    null where the browser has no WebGPU or the core no piece
//   (or in two steps: const gpu = await cardDevice(), once; then makeCard(core, gpu, { scale }) for each core, at once)
//   card.flush()                 after every field: draws what the core left (cheap when there is nothing)
//   card.show(context)           the VI's picture now, into a canvas context configured by card.configure(canvas)
//   await card.picture(win)      the same picture as bytes (for the tools), the VI's usual window `win`
//   card.read() / card.latest()  the same for a host that takes a field as bytes and cannot wait: read() asks for the
//                                picture now (nothing while one is on its way), latest() gives the newest that has come
//                                and was not given yet ({ width, height, data }, the bytes its own until the next), or null
//   card.state()                 { on, refused, why, counts }
//   await card.bring(address)    the picture of the colour image at this address written into main memory at the console's
//                                size (the core orders it by itself when the game reads a picture the card drew)
//   card.close()

const VERTEX_BYTES = 40, STATE_BYTES = 32, VERTICES = 98304, STATES = 4096;
const ORDER = { TARGET: 1, TEXTURE: 2, DRAW: 3, FORGET: 4, PICTURE: 5, BRING: 6 };
const PIPE = { BLEND: 1, Z_COMPARE: 2, Z_WRITE: 4, DECAL: 8, NO_COLOUR: 16 };
export const WHY = ["it stands", "a colour image the card does not draw (8 bits a pixel)", "(not used)", "a buffer of the card's was full"];

const DRAW = /* wgsl */`
struct St { prim: u32, env: u32, fog: u32, blend: u32, mux0: u32, mux1: u32, flags: u32, more: u32 }
@group(0) @binding(0) var<storage, read> states: array<St>;
@group(1) @binding(0) var tex0: texture_2d<f32>;
@group(1) @binding(1) var tex1: texture_2d<f32>;
@group(1) @binding(2) var smp0: sampler;
@group(1) @binding(3) var smp1: sampler;
struct V { @builtin(position) pos: vec4f, @location(0) colour: vec4f, @location(1) uv: vec4f, @location(2) @interpolate(flat) state: u32 }
@vertex fn vs(@location(0) pos: vec4f, @location(1) colour: vec4f, @location(2) uv: vec4f, @location(3) state: u32) -> V {
  var o: V; o.pos = pos; o.colour = colour; o.uv = uv; o.state = state; return o;
}
fn rgba(u: u32) -> vec4f { return vec4f(f32(u >> 24u), f32((u >> 16u) & 255u), f32((u >> 8u) & 255u), f32(u & 255u)) / 255.0; }
// One cycle of the combiner: (A - B) * C + D for the colour and for the alpha. The inputs by number:
// 0 the cycle before, 1 and 2 the texels, 3 the primitive's colour, 4 the shade, 5 the environment's, 6 one, 7 nought.
fn cycle(mux: u32, inp: ptr<function, array<vec4f, 8>>, plod: f32) -> vec4f {
  let a = mux & 15u; let b = (mux >> 4u) & 15u; let c = (mux >> 8u) & 31u; let d = (mux >> 13u) & 7u;
  let aa = (mux >> 16u) & 7u; let ab = (mux >> 19u) & 7u; let ac = (mux >> 22u) & 7u; let ad = (mux >> 25u) & 7u;
  var A = vec3f(0.0); if (a < 7u) { A = (*inp)[a].rgb; } else if (a == 7u) { A = vec3f(0.5); }
  var B = vec3f(0.0); if (b < 6u) { B = (*inp)[b].rgb; }
  var C = vec3f(0.0); if (c < 6u) { C = (*inp)[c].rgb; } else if (c >= 7u && c <= 12u) { C = vec3f((*inp)[c - 7u].a); } else if (c == 14u) { C = vec3f(plod); }
  var D = vec3f(0.0); if (d < 7u) { D = (*inp)[d].rgb; }
  var CA = 0.0; if (ac >= 1u && ac <= 5u) { CA = (*inp)[ac].a; } else if (ac == 6u) { CA = plod; }
  return vec4f((A - B) * C + D, ((*inp)[aa].a - (*inp)[ab].a) * CA + (*inp)[ad].a);
}
// One cycle of the blender without the picture in memory: (P * A + M * B) / (A + B).
fn blend_once(how: u32, pixel: vec3f, alpha: f32, shade_alpha: f32, blend: vec4f, fog: vec4f) -> vec3f {
  let P = how & 3u; let A = (how >> 2u) & 3u; let M = (how >> 4u) & 3u; let B = (how >> 6u) & 3u;
  var p = pixel; if (P == 2u) { p = blend.rgb; } else if (P == 3u) { p = fog.rgb; }
  var m = pixel; if (M == 2u) { m = blend.rgb; } else if (M == 3u) { m = fog.rgb; }
  var a = alpha; if (A == 1u) { a = fog.a; } else if (A == 2u) { a = shade_alpha; } else if (A == 3u) { a = 0.0; }
  var b = 1.0 - a; if (B == 1u || B == 3u) { b = 0.0; } else if (B == 2u) { b = 1.0; }
  return (p * a + m * b) / max(a + b, 0.001);
}
@fragment fn fs(in: V) -> @location(0) vec4f {
  let st = states[in.state];
  let ta = textureSample(tex0, smp0, in.uv.xy);
  let tb = textureSample(tex1, smp1, in.uv.zw);
  let fl = st.flags;
  let plod = f32(st.more & 255u) / 255.0;
  var inp = array<vec4f, 8>(vec4f(0.0), ta, tb, rgba(st.prim), in.colour, rgba(st.env), vec4f(1.0), vec4f(0.0));
  var cc: vec4f;
  if ((fl & 1u) != 0u) {
    inp[0] = clamp(cycle(st.mux0, &inp, plod), vec4f(0.0), vec4f(1.0));
    inp[1] = tb; inp[2] = ta;                       // the second cycle reads the texels the other way round
    cc = cycle(st.mux1, &inp, plod);
  } else { cc = cycle(st.mux1, &inp, plod); }
  cc = clamp(cc, vec4f(0.0), vec4f(1.0));
  let blend = rgba(st.blend); let fog = rgba(st.fog);
  let test = (fl >> 1u) & 3u;
  if (test == 1u && cc.a < blend.a) { discard; }
  if (test >= 2u && cc.a < 0.5) { discard; }
  var alpha = cc.a; if ((fl & 0x1000000u) != 0u) { alpha = 1.0; }
  var rgb = cc.rgb;
  if ((fl & 1u) != 0u) { rgb = blend_once((fl >> 4u) & 255u, rgb, alpha, in.colour.a, blend, fog); }
  let how = (fl >> 12u) & 255u;
  let P = how & 3u; let A = (how >> 2u) & 3u; let M = (how >> 4u) & 3u;
  var p = rgb; if (P == 2u) { p = blend.rgb; } else if (P == 3u) { p = fog.rgb; }
  if ((fl & 0x100000u) == 0u) { return vec4f(p, 1.0); }
  if (M != 1u) { return vec4f(blend_once(how, rgb, alpha, in.colour.a, blend, fog), 1.0); }
  var a = alpha; if (A == 1u) { a = fog.a; } else if (A == 2u) { a = in.colour.a; } else if (A == 3u) { a = 0.0; }
  return vec4f(p, a);                               // the pipeline weighs it against the picture
}`;

const SHOW = /* wgsl */`
struct U { dst: vec4f, src: vec4f }
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var smp: sampler;
struct V { @builtin(position) pos: vec4f, @location(0) uv: vec2f }
@vertex fn vs(@builtin(vertex_index) i: u32) -> V {
  let c = vec2f(f32(i & 1u), f32(i >> 1u));
  var o: V; o.pos = vec4f(mix(u.dst.xy, u.dst.zw, c), 0.0, 1.0); o.uv = mix(u.src.xy, u.src.zw, c); return o;
}
@fragment fn fs(in: V) -> @location(0) vec4f { return vec4f(textureSample(tex, smp, in.uv).rgb, 1.0); }`;

// The graphics card, asked for once: null where the browser offers none.
export async function cardDevice() {
  if (!globalThis.navigator?.gpu) return null;
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) return null;
  const info = adapter.info ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture, device: adapter.info.device, description: adapter.info.description } : null;
  const device = await adapter.requestDevice();
  const gpu = { device, adapter: info, lost: false };
  device.lost.then(() => { gpu.lost = true; });
  return gpu;
}
export async function openCard(core, options = {}) {
  if (!core.x.n64_modeb_card) return null;
  const gpu = await cardDevice();
  return gpu ? makeCard(core, gpu, options) : null;
}

// The card's road for one core (null where the core has no piece for it): switched on at once.
export function makeCard(core, gpu, { scale = 2 } = {}) {
  const x = core.x, m = core.machine;
  if (!x.n64_modeb_card || !gpu || gpu.lost) return null;
  const device = gpu.device, adapterInfo = gpu.adapter;
  let lost = false, closed = false;
  device.lost.then(() => { lost = true; try { if (!closed) x.n64_modeb_card(0); } catch { /* the core is gone */ } });
  const errors = [];
  device.addEventListener?.("uncapturederror", (e) => { if (errors.length < 8) errors.push(String(e.error?.message ?? e).slice(0, 300)); });

  const module = device.createShaderModule({ code: DRAW });
  const stateLayout = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } }] });
  const texLayout = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} }, { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} }, { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: {} }] });
  const layout = device.createPipelineLayout({ bindGroupLayouts: [stateLayout, texLayout] });
  const vertexBuffer = device.createBuffer({ size: VERTICES * VERTEX_BYTES, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  const stateBuffer = device.createBuffer({ size: STATES * STATE_BYTES, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  const stateGroup = device.createBindGroup({ layout: stateLayout, entries: [{ binding: 0, resource: { buffer: stateBuffer } }] });
  const FORMAT = "rgba8unorm", DEPTH = "depth24plus";

  const pipelines = new Map();
  const pipelineOf = (pipe) => {
    let p = pipelines.get(pipe);
    if (p) return p;
    const noColour = !!(pipe & PIPE.NO_COLOUR), decal = !!(pipe & PIPE.DECAL);
    p = device.createRenderPipeline({ layout,
      vertex: { module, entryPoint: "vs", buffers: [{ arrayStride: VERTEX_BYTES, attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x4" }, { shaderLocation: 1, offset: 16, format: "unorm8x4" },
        { shaderLocation: 2, offset: 20, format: "float32x4" }, { shaderLocation: 3, offset: 36, format: "uint32" }] }] },
      fragment: { module, entryPoint: "fs", targets: [{ format: FORMAT, writeMask: noColour ? 0 : GPUColorWrite.ALL,
        ...(pipe & PIPE.BLEND ? { blend: { color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" } } } : {}) }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: { format: DEPTH, depthWriteEnabled: !!(pipe & PIPE.Z_WRITE), depthCompare: noColour || !(pipe & PIPE.Z_COMPARE) ? "always" : decal ? "less-equal" : "less",
        depthBias: decal ? -64 : 0, depthBiasSlopeScale: decal ? -2 : 0 } });
    pipelines.set(pipe, p);
    return p;
  };
  const samplers = new Map();
  const MODES = ["clamp-to-edge", "repeat", "mirror-repeat", "clamp-to-edge"];
  const samplerOf = (bits) => {
    let s = samplers.get(bits);
    if (!s) { const f = bits & 16 ? "linear" : "nearest"; s = device.createSampler({ addressModeU: MODES[bits & 3], addressModeV: MODES[(bits >> 2) & 3], magFilter: f, minFilter: f }); samplers.set(bits, s); }
    return s;
  };
  const white = device.createTexture({ size: [1, 1], format: FORMAT, usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
  device.queue.writeTexture({ texture: white }, new Uint8Array([255, 255, 255, 255]), {}, [1, 1]);
  let textures = new Map([[0, white.createView()]]), groups = new Map(), old = [];
  const groupOf = (t0, t1, samp) => {
    const key = t0 + t1 * 65536 + samp * 4294967296;
    let g = groups.get(key);
    if (!g) {
      g = device.createBindGroup({ layout: texLayout, entries: [
        { binding: 0, resource: textures.get(t0) ?? textures.get(0) }, { binding: 1, resource: textures.get(t1) ?? textures.get(0) },
        { binding: 2, resource: samplerOf(samp & 255) }, { binding: 3, resource: samplerOf((samp >> 8) & 255) }] });
      groups.set(key, g);
    }
    return g;
  };

  // The pictures: one texture for each colour image the game draws to, and one of depths for each size.
  const targets = new Map(), depths = new Map();
  const targetOf = (address, width) => {
    let t = targets.get(address);
    if (t && t.width === width) return t;
    if (t) t.texture.destroy();
    const height = Math.floor(width * 3 / 4);
    const texture = device.createTexture({ size: [width * scale, height * scale], format: FORMAT, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC });
    t = { address, width, height, texture, view: texture.createView(), fresh: true, drawn: 0 };
    targets.set(address, t);
    if (targets.size > 12) { const [first, gone] = targets.entries().next().value; if (gone !== t) { gone.texture.destroy(); targets.delete(first); } }
    return t;
  };
  const depthOf = (t) => {
    const key = t.width;
    let d = depths.get(key);
    if (!d) { const texture = device.createTexture({ size: [t.width * scale, t.height * scale], format: DEPTH, usage: GPUTextureUsage.RENDER_ATTACHMENT }); d = { view: texture.createView(), fresh: true }; depths.set(key, d); }
    return d;
  };

  let lastTarget = null, target = null, pictures = 0, draws = 0, flushes = 0, texturesMade = 0, msDrawing = 0, pending = 0;
  x.n64_modeb_card(1);

  function flush() {
    if (lost || closed) return 0;
    const n = x.n64_modeb_card_take(1);
    if (!n) return 0;
    const t0 = performance.now();
    const buffer = x.memory.buffer, shared = typeof SharedArrayBuffer !== "undefined" && buffer instanceof SharedArrayBuffer;
    const bytesAt = (at, size) => (shared ? new Uint8Array(buffer, at, size).slice() : new Uint8Array(buffer, at, size));
    const words = new Uint32Array(buffer, x.n64_modeb_card_take(0), n);
    const nv = x.n64_modeb_card_take(3), ns = x.n64_modeb_card_take(5), texels = x.n64_modeb_card_take(6);
    if (nv) device.queue.writeBuffer(vertexBuffer, 0, bytesAt(x.n64_modeb_card_take(2), nv * VERTEX_BYTES));
    if (ns) device.queue.writeBuffer(stateBuffer, 0, bytesAt(x.n64_modeb_card_take(4), ns * STATE_BYTES));
    const encoder = device.createCommandEncoder();
    let pass = null, lastPipe = -1, lastGroup = null, lastScissor = "";
    const end = () => { if (pass) { pass.end(); pass = null; } };
    const begin = () => {
      if (!target) target = lastTarget && !lastTarget[2] ? targetOf(lastTarget[0], lastTarget[1]) : targetOf(0xFFFFFFFF, 320);
      const d = depthOf(target);
      pass = encoder.beginRenderPass({ colorAttachments: [{ view: target.view, loadOp: target.fresh ? "clear" : "load", storeOp: "store", clearValue: { r: 0, g: 0, b: 0, a: 1 } }],
        depthStencilAttachment: { view: d.view, depthLoadOp: d.fresh ? "clear" : "load", depthClearValue: 1, depthStoreOp: "store" } });
      target.fresh = false; d.fresh = false; target.drawn = ++flushes;
      pass.setVertexBuffer(0, vertexBuffer); pass.setBindGroup(0, stateGroup);
      lastPipe = -1; lastGroup = null; lastScissor = "";
    };
    for (let i = 0; i < n;) {
      const what = words[i] & 255, len = words[i] >>> 8, w = i + 1;
      i += len + 1;
      if (what === ORDER.TARGET) { end(); if (!words[w + 2]) target = targetOf(words[w], words[w + 1]); else if (!target) target = null; lastTarget = [words[w], words[w + 1], words[w + 2]]; }
      else if (what === ORDER.TEXTURE) {
        const tw = words[w + 1], th = words[w + 2];
        const texture = device.createTexture({ size: [tw, th], format: FORMAT, usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
        device.queue.writeTexture({ texture }, bytesAt(texels + words[w + 3], tw * th * 4), { bytesPerRow: tw * 4 }, [tw, th]);
        textures.set(words[w], texture.createView()); old.push(texture); texturesMade++;
      } else if (what === ORDER.FORGET) {
        const gone = old; old = [];
        device.queue.onSubmittedWorkDone().then(() => { for (const t of gone) t.destroy(); });
        textures = new Map([[0, textures.get(0)]]); groups = new Map(); lastGroup = null;
      } else if (what === ORDER.DRAW) {
        if (!pass) begin();
        const tw = target.width, th = target.height;
        const sx0 = Math.min(tw, words[w + 6] >>> 16), sy0 = Math.min(th, words[w + 6] & 0xFFFF), sx1 = Math.min(tw, words[w + 7] >>> 16), sy1 = Math.min(th, words[w + 7] & 0xFFFF);
        if (sx1 <= sx0 || sy1 <= sy0) continue;
        const pipe = words[w + 2];
        if (pipe !== lastPipe) { pass.setPipeline(pipelineOf(pipe)); lastPipe = pipe; }
        const g = groupOf(words[w + 3], words[w + 4], words[w + 5]);
        if (g !== lastGroup) { pass.setBindGroup(1, g); lastGroup = g; }
        const sc = sx0 + "," + sy0 + "," + sx1 + "," + sy1;
        if (sc !== lastScissor) { pass.setScissorRect(sx0 * scale, sy0 * scale, (sx1 - sx0) * scale, (sy1 - sy0) * scale); lastScissor = sc; }
        pass.draw(words[w + 1], 1, words[w], 0);
        draws++;
      } else if (what === ORDER.PICTURE) pictures++;
      else if (what === ORDER.BRING) wanted.add(words[w]);
    }
    end();
    device.queue.submit([encoder.finish()]);
    if (wanted.size) { for (const a of wanted) bring(a); wanted.clear(); }
    pending++; device.queue.onSubmittedWorkDone().then(() => { pending--; }, () => { pending--; });
    x.n64_modeb_card_taken();
    msDrawing += performance.now() - t0;
    return n;
  }

  // The VI's picture: which of the card's pictures the VI reads, which part of it, and where in the usual window it lies.
  const showModule = device.createShaderModule({ code: SHOW });
  const showLayout = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: {} }, { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} }, { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} }] });
  const showPipes = new Map();
  const showPipe = (format) => {
    let p = showPipes.get(format);
    if (!p) { p = device.createRenderPipeline({ layout: device.createPipelineLayout({ bindGroupLayouts: [showLayout] }), vertex: { module: showModule, entryPoint: "vs" }, fragment: { module: showModule, entryPoint: "fs", targets: [{ format }] }, primitive: { topology: "triangle-strip" } }); showPipes.set(format, p); }
    return p;
  };
  const showUniform = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const showSampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });
  const window_ = () => ({ x0: x.n64_vi_usual_window(m, 0), width: x.n64_vi_usual_window(m, 1), top: x.n64_vi_usual_window(m, 2), rows: x.n64_vi_usual_window(m, 3) });
  function layoutNow(win) {
    const reg = (i) => x.n64_vi_reg(m, i) >>> 0;
    const origin = reg(1) & 0xFFFFFF, bytes = (reg(0) & 3) === 3 ? 4 : 2;
    if ((reg(0) & 3) < 2) return null;
    let t = null;
    for (const c of targets.values()) if (c.address !== 0xFFFFFFFF && origin >= c.address && origin < c.address + c.width * c.height * bytes && (!t || c.address > t.address)) t = c;
    if (!t) return null;
    const off = Math.floor((origin - t.address) / bytes), ox = off % t.width, oy = Math.floor(off / t.width);
    const h0 = (reg(9) >>> 16) & 0x3FF, h1 = reg(9) & 0x3FF, v0 = (reg(10) >>> 16) & 0x3FF, v1 = reg(10) & 0x3FF;
    if (h1 <= h0 || v1 <= v0) return null;
    const xs = (reg(12) & 0xFFF) / 1024, ys = (reg(13) & 0xFFF) / 1024;
    const sx0 = ox + ((reg(12) >>> 16) & 0xFFF) / 1024, sy0 = oy + ((reg(13) >>> 16) & 0xFFF) / 1024;
    const sx1 = sx0 + (h1 - h0) * xs, sy1 = sy0 + ((v1 - v0) / 2) * ys;
    const dx0 = (h0 - win.x0) / win.width, dx1 = (h1 - win.x0) / win.width, dy0 = (v0 - win.top) / win.rows, dy1 = (v1 - win.top) / win.rows;
    return { t, dst: [dx0 * 2 - 1, 1 - dy0 * 2, dx1 * 2 - 1, 1 - dy1 * 2], src: [sx0 / t.width, sy0 / t.height, sx1 / t.width, sy1 / t.height] };
  }
  function showInto(view, format, win, whole = null) {
    const lay = whole ? { t: whole, dst: [-1, 1, 1, -1], src: [0, 0, 1, 1] } : layoutNow(win);
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({ colorAttachments: [{ view, loadOp: "clear", storeOp: "store", clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
    if (lay) {
      device.queue.writeBuffer(showUniform, 0, new Float32Array([...lay.dst, ...lay.src]));
      pass.setPipeline(showPipe(format));
      pass.setBindGroup(0, device.createBindGroup({ layout: showLayout, entries: [{ binding: 0, resource: { buffer: showUniform } }, { binding: 1, resource: lay.t.view }, { binding: 2, resource: showSampler }] }));
      pass.draw(4);
    }
    pass.end();
    device.queue.submit([encoder.finish()]);
    return !!lay;
  }
  const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
  // A picture brought back into main memory, at the console's size: asked by the core when the game reads a picture the
  // card drew. One on its way for each colour image; it is written when the card has handed it over, a field or two later.
  const wanted = new Set(), bringing = new Map();
  let brought = 0, bringRoom = 0, bringRoomBytes = 0;
  function bring(address) {
    const t = targets.get(address);
    if (lost || closed || !t || bringing.has(address)) return bringing.get(address) ?? Promise.resolve(0);
    const w = t.width, h = t.height;
    if (!t.back) t.back = { texture: device.createTexture({ size: [w, h], format: FORMAT, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC }), buffer: device.createBuffer({ size: w * h * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }) };
    showInto(t.back.texture.createView(), FORMAT, null, t);
    const encoder = device.createCommandEncoder();
    encoder.copyTextureToBuffer({ texture: t.back.texture }, { buffer: t.back.buffer, bytesPerRow: w * 4 }, [w, h]);
    device.queue.submit([encoder.finish()]);
    const p = t.back.buffer.mapAsync(GPUMapMode.READ).then(() => {
      bringing.delete(address);
      let n = 0;
      if (!closed && targets.get(address) === t) {
        if (bringRoomBytes < w * h * 4) { bringRoom = core.alloc(w * h * 4); bringRoomBytes = w * h * 4; }
        new Uint8Array(x.memory.buffer, bringRoom, w * h * 4).set(new Uint8Array(t.back.buffer.getMappedRange()));
        n = x.n64_modeb_card_brought(m, address, w, h, bringRoom);
        if (n) brought++;
      }
      t.back.buffer.unmap();
      return n;
    }, () => { bringing.delete(address); return 0; });
    bringing.set(address, p);
    return p;
  }
  let room = null;
  // A field as bytes for a host that cannot wait: two rooms take turns, one being read while the other's bytes are the host's.
  const reads = { rooms: [null, null], turn: 0, busy: false, fresh: null, asked: 0, come: 0 };
  function read(win = window_()) {
    if (lost || closed || reads.busy) return false;
    const w = win.width, h = win.rows >> 1, i = reads.turn ^= 1;
    let r = reads.rooms[i];
    if (!r || r.w !== w || r.h !== h) {
      r = reads.rooms[i] = { w, h, texture: device.createTexture({ size: [w, h], format: FORMAT, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC }), buffer: device.createBuffer({ size: w * h * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }), data: new Uint32Array(w * h) };
    }
    if (!showInto(r.texture.createView(), FORMAT, win)) return false;
    const encoder = device.createCommandEncoder();
    encoder.copyTextureToBuffer({ texture: r.texture }, { buffer: r.buffer, bytesPerRow: w * 4 }, [w, h]);
    device.queue.submit([encoder.finish()]);
    reads.busy = true; reads.asked++;
    r.buffer.mapAsync(GPUMapMode.READ).then(() => {
      r.data.set(new Uint32Array(r.buffer.getMappedRange()));
      r.buffer.unmap();
      reads.fresh = { width: w, height: h, data: r.data }; reads.busy = false; reads.come++;
    }, () => { reads.busy = false; });
    return true;
  }

  return {
    device, adapter: adapterInfo, get scale() { return scale; },
    flush,
    configure(canvas) { const context = canvas.getContext("webgpu"); context.configure({ device, format: canvasFormat, alphaMode: "opaque" }); return context; },
    show(context) { return lost ? false : showInto(context.getCurrentTexture().createView(), canvasFormat, window_()); },
    // The VI's picture as bytes, in the shape the software's field has: the usual window's width by half its lines.
    async picture(win = window_()) {
      const w = win.width, h = win.rows >> 1;
      if (!room || room.w !== w || room.h !== h) {
        room = { w, h, texture: device.createTexture({ size: [w, h], format: FORMAT, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC }), buffer: device.createBuffer({ size: w * h * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }) };
      }
      const made = showInto(room.texture.createView(), FORMAT, win);
      const encoder = device.createCommandEncoder();
      encoder.copyTextureToBuffer({ texture: room.texture }, { buffer: room.buffer, bytesPerRow: w * 4 }, [w, h]);
      device.queue.submit([encoder.finish()]);
      await room.buffer.mapAsync(GPUMapMode.READ);
      const pixels = new Uint8Array(room.buffer.getMappedRange()).slice();
      room.buffer.unmap();
      let notBlack = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] | pixels[i + 1] | pixels[i + 2]) notBlack++;
      return { made, width: w, height: h, pixels, pixelsNotBlack: notBlack };
    },
    state() {
      const why = x.n64_modeb_card_take(7);
      return { on: !lost && !closed && x.n64_modeb_card_take(8) !== 0 && !why, lost, refused: why, readsAsked: reads.asked, readsCome: reads.come, brought, bringsAsked: Number(x.n64_modeb_card_count(8)), cpuReads: Number(x.n64_modeb_card_count(10)), notBroughtOverAnothersBytes: Number(x.n64_modeb_card_count(11)), pending, scale, adapter: adapterInfo, why: WHY[why] ?? String(why), pictures, draws, texturesMade, msDrawing: Number(msDrawing.toFixed(1)), targets: targets.size, errors,
        core: { tasks: Number(x.n64_modeb_card_count(0)), triangles: Number(x.n64_modeb_card_count(1)), rectangles: Number(x.n64_modeb_card_count(2)), texturesMade: Number(x.n64_modeb_card_count(3)), verticesLost: Number(x.n64_modeb_card_count(4)), odd: Number(x.n64_modeb_card_count(6)) } };
    },
    read, bring,
    // The picture on its way into main memory for this colour image, if one is: the pixels written when it has come (else 0).
    coming: (address) => bringing.get(address) ?? Promise.resolve(0),
    // The colour image the VI reads now (its address), or null.
    shownAddress() { const lay = layoutNow(window_()); return lay ? lay.t.address : null; },
    latest() { const f = reads.fresh; reads.fresh = null; return f; },
    standing: () => !lost && !closed && x.n64_modeb_card_take(7) === 0,
    // Another size for the pictures (the console's size times this): they are made anew, empty until next drawn.
    setScale(n) {
      n = Math.max(1, Math.min(4, Math.floor(Number(n) || 1)));
      if (n === scale) return scale;
      scale = n;
      for (const t of targets.values()) t.texture.destroy();
      targets.clear(); depths.clear(); target = null;
      return scale;
    },
    done: () => device.queue.onSubmittedWorkDone(),
    // This core's road is ended; the device stays for the next core.
    close() { closed = true; try { x.n64_modeb_card(0); } catch { /* gone */ } for (const t of targets.values()) t.texture.destroy(); targets.clear(); },
  };
}

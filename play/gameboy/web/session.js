/* session.js — the main thread's handle on the worker play path.
 *
 * the UI design, section 23. The page keeps the AudioContext (it needs a gesture)
 * and hands the worker the RING, which is all the producer needs. Samples never
 * cross this boundary — the worker writes the SharedArrayBuffer and the
 * AudioWorklet reads it.
 *
 * Capability is CHECKED, not assumed, and the result is reported rather than
 * silently changing the architecture: a page served without COOP/COEP has no
 * SharedArrayBuffer, and a shell that quietly became single-threaded there
 * would be blamed for something else later.
 */

export function workerCapability() {
  const reasons = [];
  if (typeof SharedArrayBuffer === "undefined") reasons.push("no SharedArrayBuffer (needs COOP/COEP)");
  if (typeof Worker === "undefined") reasons.push("no Worker");
  if (typeof OffscreenCanvas === "undefined") reasons.push("no OffscreenCanvas");
  if (typeof HTMLCanvasElement !== "undefined" &&
      !HTMLCanvasElement.prototype.transferControlToOffscreen) reasons.push("no transferControlToOffscreen");
  return { ok: reasons.length === 0, reasons };
}

export class WorkerSession {
  constructor() {
    this.worker = null;
    this.ready = false;
    this.info = null;
    this.stats = null;
    this.onEvent = () => {};
    this._id = 0;
    this._waiting = new Map();
  }

  /**
   * @param {ArrayBuffer} wasm the already-fetched core
   * @param {HTMLCanvasElement} canvasEl its control is TRANSFERRED; the page
   *        must not draw on it again
   */
  async start(wasm, canvasEl) {
    this.worker = new Worker("./web/worker.js", { type: "module" });
    this.worker.onmessage = (e) => this._recv(e.data);
    this.worker.onerror = (e) => this.onEvent({ type: "error", where: "worker",
                                                name: "WorkerError", message: e.message });
    const off = canvasEl.transferControlToOffscreen();
    const done = this._await("ready");
    this.worker.postMessage({ type: "init", wasm, canvas: off }, [off]);
    this.info = await done;
    this.ready = true;
    return this.info;
  }

  _recv(m) {
    if (m.type === "stats") { this.stats = m.stats; }
    if (m.id !== undefined && this._waiting.has("id:" + m.id)) {
      this._waiting.get("id:" + m.id)(m);
      this._waiting.delete("id:" + m.id);
      return;
    }
    const k = this._waiting.get(m.type);
    if (k) { this._waiting.delete(m.type); k(m); }
    this.onEvent(m);
  }
  _await(type) { return new Promise(res => this._waiting.set(type, res)); }
  _awaitId(id) { return new Promise(res => this._waiting.set("id:" + id, res)); }

  send(type, data = {}, transfer = []) {
    if (this.worker) this.worker.postMessage({ type, ...data }, transfer);
  }

  /** Give the worker the ring the worklet is draining. */
  attachAudio(ring, rate) {
    const done = this._await("audioReady");
    this.send("audio", { ring: ring.transferable(), rate });
    return done;
  }

  mount(bytes, opts = {}) {
    const done = this._await("mounted");
    this.send("mount", { bytes, ...opts });
    return done;
  }
  setBios(bytes) { this.send("bios", { bytes }); }
  setButtons(mask) { this.send("buttons", { mask }); }
  setRunning(on) { this.send("run", { on }); }
  setPalette(key) { this.send("palette", { key }); }
  requestStats() { this.send("stats"); }

  async getContext() {
    const id = ++this._id;
    const p = this._awaitId(id);
    this.send("context", { id });
    return p;
  }
  async restoreContext(bytes, frames) {
    const id = ++this._id;
    const p = this._awaitId(id);
    this.send("restore", { id, bytes, frames });
    return p;
  }
  async getCram() {
    const id = ++this._id;
    const p = this._awaitId(id);
    this.send("cram", { id });
    return p;
  }
  setCram(bytes) { this.send("cramSet", { bytes }); }
  setRtc(bytes) { this.send("rtcSet", { bytes }); }   /* the MBC3 clock block, 20 bytes */

  stop() { this.send("stop"); if (this.worker) { this.worker.terminate(); this.worker = null; } this.ready = false; }
}

// A worker of the core's threaded build: one more instance of the same module over the same shared memory, given a
// stack of its own, running one of the build's threads (entry: n64_rdp_thread_main, the RDP's drawing, or
// n64_rcp_thread_main, the RSP's tasks; n64_rdp_band_main with its number, a band of the picture), which does not come back: it sleeps until the machine's worker sends it work.
// Started by core.mjs from inside the site's worker runner's worker; it needs the page and this script served
// cross-origin isolated (the folder's README says how).
//
// A build with the RSP's recompiler makes its blocks on the RSP's thread: a table of functions is not shared between
// workers, so the RSP's worker answers the core's one host call itself: the bytes of the module the core has written
// in the shared memory are compiled as they are, its one function put in THIS instance's table at the place the core
// names or at a new one, and the place given back; 0 when it could not be done (the core then keeps to its
// interpreter). The made module is given the shared memory and this table and nothing else. The drawing worker
// makes nothing and answers 0. A worker started anew over a memory already in use (anew) tells the core first that
// its table is empty, so the core forgets what it made for the worker before.
self.onmessage = ({ data: { module, memory, stack, entry = "n64_rdp_thread_main", arg = 0, anew = false } }) => {
  const imports = Object.fromEntries(WebAssembly.Module.imports(module).filter((i) => i.kind === "memory").map((i) => [i.module, { [i.name]: memory }]));
  let exports = null;
  if (WebAssembly.Module.imports(module).some((i) => i.module === "env" && i.name === "n64_wasm_host")) {
    (imports.env ??= {}).n64_wasm_host = entry !== "n64_rcp_thread_main" ? () => 0 : (at, size, slot) => {
      try {
        const table = exports?.__indirect_function_table;
        if (!table) return 0;
        const f = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array(memory.buffer).slice(at, at + size)), { e: { m: memory, t: table } }).exports.f;
        if (slot === 0) slot = table.grow(1);
        table.set(slot, f);
        return slot;
      } catch { return 0; }
    };
  }
  // (A build with the graphics card's bit asks its host the time, in millionths of a second, and reads it only while the
  // module measures which road draws faster on this device: core.mjs, the card.)
  if (WebAssembly.Module.imports(module).some((i) => i.module === "env" && i.name === "n64_clock")) (imports.env ??= {}).n64_clock = () => performance.now() * 1000;
  exports = new WebAssembly.Instance(module, imports).exports;
  exports.__stack_pointer.value = stack;
  if (anew && entry === "n64_rcp_thread_main") exports.n64_rsp_jit_new_host?.(1);
  exports[entry](arg);           // a band's thread is given its band's number
};

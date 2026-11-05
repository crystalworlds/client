/* ===========================================================================
 * NES / Famicom Emulation tab: the index of areas and the composing router
 *
 * GENERATED. DO NOT EDIT. Source: the clean-room NES core's build
 * specification, docs/build/ in the NES core's source tree, rendered by
 * tools/build_emulation_tabs.mjs there (2026-10-04).
 * Edit the markdown and regenerate; `--check` reds on any drift.
 * Loaded by a plain <script src> tag (the site must open over file://).
 * =========================================================================== */

/* The eight areas, in reading order. Each area's builder is a global function
 * defined by its own tab file; an area whose file is not loaded is skipped by
 * the router and named in its table of contents as not loaded. */
const NES_EMU_AREAS = [{"key":"machine","title":"Machine &amp; ABI","heading":"Machine &amp; ABI: how to build it, exactly as our core runs it","fn":"nesMachineEmulationTabHTML","file":"nes-machine-emulation-tab.js","chapters":["README.md","00-MACHINE.md","70-ABI.md"]},{"key":"cpu","title":"CPU","heading":"CPU: how to build it, exactly as our core runs it","fn":"nesCpuEmulationTabHTML","file":"nes-cpu-emulation-tab.js","chapters":["10-CPU.md"]},{"key":"ppu","title":"PPU","heading":"PPU: how to build it, exactly as our core runs it","fn":"nesPpuEmulationTabHTML","file":"nes-ppu-emulation-tab.js","chapters":["20-PPU.md"]},{"key":"apu","title":"APU &amp; expansion audio","heading":"APU &amp; expansion audio: how to build it, exactly as our core runs it","fn":"nesApuEmulationTabHTML","file":"nes-apu-emulation-tab.js","chapters":["30-APU.md","35-EXPANSION-AUDIO.md"]},{"key":"mappers","title":"Cartridge &amp; mappers","heading":"Cartridge &amp; mappers: how to build it, exactly as our core runs it","fn":"nesMappersEmulationTabHTML","file":"nes-mappers-emulation-tab.js","chapters":["40-CARTRIDGE.md","41-MAPPERS-NINTENDO.md","42-MAPPERS-LICENSED.md","43-MAPPERS-UNLICENSED.md","44-MAPPERS-TAIL.md"]},{"key":"fds","title":"Disk System","heading":"Disk System: how to build it, exactly as our core runs it","fn":"nesFdsEmulationTabHTML","file":"nes-fds-emulation-tab.js","chapters":["50-FDS.md"]},{"key":"peripherals","title":"Peripherals &amp; VS","heading":"Peripherals &amp; VS: how to build it, exactly as our core runs it","fn":"nesPeripheralsEmulationTabHTML","file":"nes-peripherals-emulation-tab.js","chapters":["60-PERIPHERALS.md","65-VS.md"]},{"key":"acceptance","title":"Acceptance","heading":"Acceptance: how to build it, exactly as our core runs it","fn":"nesAcceptanceEmulationTabHTML","file":"nes-acceptance-emulation-tab.js","chapters":["80-ACCEPTANCE.md","85-CORPUS.md","90-FIX-HISTORY-AUDIT.md"]}];

/* One area's HTML, or '' if that area's file is not loaded. */
function nesEmulationAreaHTML(d, key) {
  const a = NES_EMU_AREAS.find(function (x) { return x.key === key; });
  const g = typeof window !== "undefined" ? window : globalThis;
  const f = a && g[a.fn];
  return typeof f === "function" ? f(d) : "";
}
/* The whole specification: a table of contents, then every loaded area. */
function nesBuildSpecEmulationTabHTML(d) {
  const g = typeof window !== "undefined" ? window : globalThis;
  let toc = '<nav class="gbemu-toc"><b>NES build specification</b> ';
  let body = "";
  for (let i = 0; i < NES_EMU_AREAS.length; i++) {
    const a = NES_EMU_AREAS[i];
    const loaded = typeof g[a.fn] === "function";
    toc += loaded ? '<a href="#nesemu-area-' + a.key + '">' + a.heading + '</a> ' : '<span>' + a.title + ' (not loaded)</span> ';
    if (loaded) body += '<div id="nesemu-area-' + a.key + '">' + g[a.fn](d) + '</div>';
  }
  return toc + '</nav>' + body;
}

// play/cores/n64/core.mjs: the Nintendo 64 as a console module of the site's Core API 1.0 (the site's
// play/host/core-api.mjs): a manifest, and create(env) giving load, reset, setInput, runFrame, video, audio and
// destroy, with battery, options, setOption and a debug extension. thread: "worker": the site's worker runner
// (play/host/core-worker.js) imports this file in a module worker and calls it there.
//
// The machine is the pilot's, unchanged: the opening of a game, the lockout chip, the game table, the save memory,
// the controller and the picture are the modules of machine/ (copied from the pilot's shared/ folder, which the
// pilot's tools and play page run too), and the core is machine/n64core.wasm. A core has no page, timer, storage
// or sound device: the host gives the game file, the firmware and the time, and takes pictures and sound.
//
// The game file and the user's firmware are private: they are in this worker's memory only. Nothing here fetches
// a game, keeps one, or sends a byte of it anywhere.

import { compileCore, coreFromModule } from "./machine/core-host.mjs?v=6aeda4313354";
import { startGame } from "./machine/open-game.mjs?v=23a81c63a549";
import { fieldNow } from "./machine/vi-field.mjs?v=2c5559918536";
import { aiOf } from "./machine/ai-runs.mjs?v=934158910438";
import { takeSave, fitSave } from "./machine/save-memory.mjs?v=c6ee6fefce5c";
import { BUTTON } from "./machine/si-host.mjs?v=47f9e207851d";
import { normalise } from "./machine/byte-order.mjs?v=44ab6b171d43";
import { tablesFromRows, gameKey, lookUp, defaultPak } from "./machine/game-table.mjs?v=8f85dd5af7bf";
import { DEAD_ZONE, stateOf } from "./pads.mjs?v=29e40393f9c9";
import { makePorts, PORTS, portOfOption, portOfPak, pakId } from "./ports.mjs?v=ac70dba3f1d1";
import { SLOTS, PREFERRED_FIELD, preferredOf, regionOf, chooseStart, NONE } from "./machine/firmware-rule.mjs?v=3caf6089a39c";
import { makeResampler } from "./sound.mjs?v=e0b1ca2d327a";
import { sha256 } from "./machine/sha256.mjs?v=5ca4ef310af2";
import * as TPAK from "./tpak.mjs?v=32a45e039147";
import { watcher, WAYS as CARD_WAYS } from "./machine/card-choose.mjs?v=8bb37d8b9931";
import { cardDevice, makeCard } from "./machine/modeb-card.mjs?v=92e6c3449e2b";
import * as DD from "./disk.mjs?v=b3dd58d1f949";

const TICKS_A_SECOND = 187_500_000;
const TV_NAMES = ["pal", "ntsc", "mpal"];
// The machine's tables, as JSON beside it (the game table's three, made from the pilot's .tsv files, and the firmware's time).
// The first twelve hex digits of the SHA-256 of every file this module fetches from machine/, written in here when
// the folder is put together (tools/site-lib.mjs, assemble): each fetch asks for "machine/<file>?v=<them>", so a new
// folder is always a new address and a browser never keeps an old core or table beside a new module. (Empty in the
// pilot's source: nothing is added to the address there.)
const VERSIONS = {"card-mode-0.json":"71aff140cb3b","firmware-time.json":"569158a6898b","flash-chips-seen.json":"4a78d59a5ea8","n64core-modeb-thread.wasm":"cb11e23a1041","n64core-modeb-threads.wasm":"37ecd490c087","n64core-modeb.wasm":"27fc07d7a2aa","n64core-thread.wasm":"769d186c8ed1","n64core-threads-card.wasm":"3cd3a931ba79","n64core-threads.wasm":"32b476d134df","n64core.wasm":"3b5c6f5fc447","save-by-hash.json":"67b5047b8b85","save-types.json":"73874d7241ff"};
const TABLES = ["save-types.json", "save-by-hash.json", "flash-chips-seen.json", "firmware-time.json"];
// How often the run looks up from the machine, in instructions (the play page's figure while playing).
let STEP = 1024;

// The destination letter of a game file's header, in any of the three byte orders (null when it is too short).
function destinationOf(bytes) {
  try { return gameKey(normalise(bytes).bytes).destination; } catch { return null; }
}
const asBytes = (b) => (b instanceof Uint8Array ? b : b ? new Uint8Array(b.buffer ?? b, b.byteOffset ?? 0, b.byteLength ?? undefined) : null);

export class CoreError extends Error {
  /** @param {'wrong-core'|'wrong-game'|'damaged'|'needs-firmware'|'unsupported'} code */
  constructor(code, message) { super(message); this.name = "CoreError"; this.code = code; }
}

export const manifest = {
  api: "1.0", id: "n64", label: "Nintendo 64", form: "console", thread: "worker",
  build: "play/cores/n64/BUILD.json",
  files: {
    // (".ndd": a 64DD disk, opened as a game: disk.mjs)
    game: { exts: [".z64", ".n64", ".v64", ".ndd"], maxBytes: 64 * 1024 * 1024 },
    // The boot programs, the 64DD disk drive's two (disk.mjs), and after them the Game Boy cartridge of each port's
    // Transfer Pak: a file of the player's own, kept by the host on the player's device, needed by no game and off
    // until the player picks one (tpak.mjs).
    firmware: [...SLOTS.map(({ id, label, required }) => ({ id, label, required })), ...DD.SLOTS, ...TPAK.SLOTS],
  },
  // The firmware a game asks for: the image its region prefers, or every image when it has no preference. A disk asks
  // for the drive's own (disk.mjs).
  firmwareFor: (bytes) => { const b = asBytes(bytes); if (DD.isDisk(b)) return DD.firmwareFor(b); const p = preferredOf(destinationOf(b)); return [...(p === NONE ? SLOTS.map((s) => s.id) : [p]), ...DD.firmwareFor(b), ...TPAK.SLOTS.map((s) => s.id)]; },
  firmwareRole: (bytes, id) => DD.roleFor(asBytes(bytes), id),
  // A disk's save is put in before power-on: the drive reads it at its start.
  preloadBatteryFor: (bytes) => DD.preloadFor(asBytes(bytes)),
  // The game's record's preferred firmware value, as the region sets it (firmware-rule.mjs keeps the field's name).
  preferredFirmware: (bytes) => ({ [PREFERRED_FIELD]: preferredOf(destinationOf(asBytes(bytes))) }),
  video: { kind: "raster", maxWidth: 640, maxHeight: 576, screens: 1 },
  audio: { channels: 2, format: "s16", filtered: true },
  state: { supported: false, deterministic: true },
  extensions: ["options", "debug"],
};

// env: the site's (now, emit, log, audioRate). env.files, given by a test host only: { core, tables } in place of
// fetching them from beside this file. env.fault: a number that makes this module wrong on purpose (tests only).
export async function create(env = {}) {
  const fault = Number(env.fault) || 0;
  const at = (rel) => new URL(rel, import.meta.url);
  // A machine file that does not come within FILE_WAIT_MS (the request and its whole body) is asked for once more; if
  // it does not come again the load fails, saying so: a connection that stalls must not leave the page waiting for ever.
  const FILE_WAIT_MS = Number(env.fileWaitMs) || 30000;
  const fetchedOnce = async (url, how) => {
    const stop = typeof AbortController === "function" ? new AbortController() : null;
    let timer = null;
    const late = new Promise((_, reject) => { timer = setTimeout(() => { stop?.abort(); reject(Object.assign(new Error("late"), { late: true })); }, FILE_WAIT_MS); });
    late.catch(() => {});                          // (answered by the race below, never left unhandled)
    const work = (async () => { const r = await fetch(url, stop ? { signal: stop.signal } : {}); if (!r.ok) return { status: r.status }; return { body: how === "text" ? await r.text() : new Uint8Array(await r.arrayBuffer()) }; })();
    try { return fault === 415 ? await work : await Promise.race([work, late]); } finally { clearTimeout(timer); }   // 415, wrong on purpose: no limit
  };
  const fetched = async (rel, how) => {
    const name = rel.replace(/^machine\//, ""), url = at(VERSIONS[name] ? `${rel}?v=${VERSIONS[name]}` : rel);
    for (let tries = 1; ; tries++) {
      let got;
      try { got = await fetchedOnce(url, how); } catch (e) {
        if (tries < 2) continue;
        throw new CoreError("unsupported", e?.late ? `the core's own file ${rel} did not come within ${FILE_WAIT_MS >= 1000 ? Math.round(FILE_WAIT_MS / 1000) + " s" : FILE_WAIT_MS + " ms"}, twice; check the connection and load again` : `the core's own file ${rel} could not be fetched (${e?.message ?? e})`);
      }
      if (got.status) throw new CoreError("unsupported", `the core's own file ${rel} was not given (${got.status})`);
      return got.body;
    }
  };
  // Up to four builds of the core may lie beside this file, taken in this order where each can run:
  //   n64core-threads-card.wasm  as the next, with the graphics card's road in it: only where the browser offers WebGPU (below, the graphics card)
  //   n64core-threads.wasm  the RDP's drawing and the RSP's tasks each on a worker of its own (two more workers)
  //   n64core-thread.wasm   the RDP's drawing alone on a worker of its own (one more worker)
  //   n64core.wasm          no thread: runs anywhere
  // A threaded build needs this worker cross-origin isolated with a shared memory, and the workers it asks for: two
  // can be had where this worker can start two (each started and ended at once here) and the computer has four
  // logical processors or more; one, where it can start one and has two or more. A file not in the folder is passed by.
  // The logical processors the browser reports (a test host may say another number: core.mjs?cpus=<n>, to stand in for
  // a smaller computer; the threads then follow that number).
  const cpusSaid = Number(new URL(import.meta.url).searchParams.get("cpus")) || Number(globalThis.navigator?.hardwareConcurrency) || 0;
  // On a page's main thread (the host's fall-back when its worker runner does not start) a threaded build cannot run: the
  // drawing thread's waits (Atomics.wait) are not allowed there. The module then takes the plain core and starts no thread.
  const onPageMain = fault === 414 ? false : typeof window !== "undefined" && typeof document !== "undefined";   // 414, wrong on purpose: a threaded core taken on the page's main thread
  // How long each step of the start took (test.startTimes), from this module's first line.
  const t0 = performance.now(), startTimes = {};
  const canShare = !onPageMain && globalThis.crossOriginIsolated === true && (() => { try { return new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true }).buffer instanceof SharedArrayBuffer; } catch { return false; } })();
  const workersToHave = (() => {
    if (!canShare || typeof Worker !== "function" || env.thread === false) return 0;
    const made = [];
    try { for (let i = 0; i < 2; i++) made.push(new Worker(new URL("./draw-worker.mjs?v=65724dc5d856", import.meta.url), { type: "module" })); } catch { /* fewer */ }
    for (const w of made) try { w.terminate(); } catch { /* gone */ }
    const cpus = cpusSaid;
    return Math.min(made.length, cpus >= 4 ? 2 : cpus >= 2 ? 1 : 0);
  })();
  // What this browser found the last time (the browser's own storage, a convenience of this device only; nothing leaves
  // it): whether the RSP's thread ran, for the build the folder has now. Absent, unreadable or for another build: the
  // module starts from the least that is known to pay (below). A number of bands kept there by an earlier module (which
  // chose bands by itself) is never taken, and is cleared at this load (below, the bands).
  const CHOICE_DB = "n64-core-choice-3";
  const choiceStore = (mode, fn) => new Promise((resolve) => {
    try {
      const r = indexedDB.open(CHOICE_DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore("choice");
      r.onerror = () => resolve(null);
      r.onsuccess = () => { try { const d = r.result, t = d.transaction("choice", mode), q = fn(t.objectStore("choice")); t.oncomplete = () => { d.close(); resolve(q?.result ?? null); }; t.onerror = () => { d.close(); resolve(null); }; } catch { resolve(null); } };
    } catch { resolve(null); }
  });
  startTimes.probeWorkers = performance.now() - t0;
  const remembered = typeof indexedDB === "undefined" ? null : await choiceStore("readonly", (st) => st.get("choice")).catch(() => null);
  const tryFile = async (name, key) => env.files ? (env.files[key] ?? null) : await fetched("machine/" + name).catch(() => null);
  // Mode B, the engine "Performance" (approximate): a second set of builds that may lie beside the first (n64core-modeb-threads.wasm,
  // n64core-modeb-thread.wasm, n64core-modeb.wasm), taken only when the host asks for it (env.engine "fast", or
  // core.mjs?engine=fast) and never otherwise. Its timing is not the console's: it is labelled as such in the readout,
  // in info and in the options, and nothing read on it says anything about the accurate machine. Where the folder
  // holds no such build the accurate one is taken, and the readout says so.
  // Who asks: the host (env.engine), the module's own address (?engine=fast), or the player's own choice of the option
  // "Engine", which the module keeps in its own store on the device (the site's worker runner hands a module nothing
  // but its address when it makes it, so the choice is remembered here and taken the next time the module is made).
  const engineKept = typeof indexedDB === "undefined" ? null : await choiceStore("readonly", (st) => st.get("engine")).catch(() => null);
  let engineAsked = (env.engine ?? new URL(import.meta.url).searchParams.get("engine") ?? engineKept) === "fast" ? "fast" : "accurate";
  // The builds for the engine asked, fetched: made when the module is made, and again when the player chooses the other
  // engine (below, "the engine's change").
  async function buildsFor(asked) {
    let threadBytes = null, threadFile = null, engine = "accurate";
    if (asked === "fast") {
      if (workersToHave >= 2 && (threadBytes = await tryFile("n64core-modeb-threads.wasm", "modeBThreads"))) threadFile = "n64core-modeb-threads.wasm";
      else if (workersToHave >= 1 && (threadBytes = await tryFile("n64core-modeb-thread.wasm", "modeBThread"))) threadFile = "n64core-modeb-thread.wasm";
      else if ((threadBytes = await tryFile("n64core-modeb.wasm", "modeB"))) threadFile = "n64core-modeb.wasm";
      if (threadBytes) engine = "fast";
    }
    // THE GRAPHICS CARD. Where the browser offers WebGPU to this worker and both threads can be had, the build taken first
    // is n64core-threads-card.wasm: n64core-threads.wasm with the card's road compiled in (off until a card serves), and
    // with it the RDP's compute shader's text (card-mode-0.json). Its worker (card-worker.mjs) is started beside the
    // drawing thread's; which road draws is then measured on the device while the game plays, and measured again (below,
    // "the card's choice"). No WebGPU, no such file or no shader: the builds below, exactly as before.
    // (The fast engine, Mode B, is never given the card: its builds hold no card's road, and the two are untried together.)
    const gpuOffered = engine !== "fast" && !onPageMain && env.card !== false && !!globalThis.navigator?.gpu;
    let cardShader = null;
    if (engine === "fast") { /* taken */ }
    else if (gpuOffered && workersToHave >= 2 && (threadBytes = await tryFile("n64core-threads-card.wasm", "coreThreadsCard"))) {
      threadFile = "n64core-threads-card.wasm";
      try { const t = env.files ? env.files.cardShader : await fetched("machine/card-mode-0.json", "text"); cardShader = JSON.parse(t).wgsl || null; } catch { cardShader = null; }
    }
    else if (workersToHave >= 2 && (threadBytes = await tryFile("n64core-threads.wasm", "coreThreads"))) threadFile = "n64core-threads.wasm";
    else if (workersToHave >= 1 && (threadBytes = await tryFile("n64core-thread.wasm", "coreThread"))) threadFile = "n64core-thread.wasm";
    const coreBytes = threadBytes ?? env.files?.core ?? (await fetched("machine/n64core.wasm"));
    return { asked, threadBytes, threadFile, engine, gpuOffered, cardShader, coreBytes };
  }
  // The Log's words for the engine (the option's own words: Accuracy, the default, and Performance, Mode B, which is approximate).
  const labelOf = (b) => (b.engine === "fast" ? "PERFORMANCE (Mode B, approximate) " : b.asked === "fast" ? "accuracy (no Performance build here) " : "");
  const firstBuilds = await buildsFor(engineAsked);
  let { threadBytes, threadFile, engine, gpuOffered, cardShader } = firstBuilds, ENGINE_LABEL = labelOf(firstBuilds);
  // THE FAST ENGINE'S PICTURE ON THE GRAPHICS CARD (Mode B alone; machine/modeb-card.mjs). Where the fast engine's build
  // holds the piece and the browser offers WebGPU here, the game's triangles are drawn by the card with ordinary
  // pipelines, at the console's size times FAST_SCALE, and the RDP draws nothing: a field is then read back from the card
  // for the host (one field later, never waited for). What the card cannot take is left to the RDP from the next
  // picture on, and the Log's words say why. Off where the host says env.card false or the address says card=0.
  // The size of the card's picture: the console's size times 1 or 2 (twice is sharper and costs the card four times the
  // pixels). The host (env.cardScale), the address (scale=), or the player's own choice of the option, kept as the engine's is.
  // Made again with the builds when the engine changes (below, "the engine's change").
  const fastSetup = async (eng) => {
    const asked = eng === "fast" && env.card !== false && new URL(import.meta.url).searchParams.get("card") !== "0";
    const gpu = asked ? await cardDevice().catch(() => null) : null;
    const kept = eng === "fast" && typeof indexedDB !== "undefined" ? await choiceStore("readonly", (st) => st.get("cardScale")).catch(() => null) : null;
    return { fastCardAsked: asked, fastGpu: gpu, scaleKept: kept };
  };
  const scaleOf = (kept) => Math.max(1, Math.min(4, Math.floor(Number(env.cardScale ?? new URL(import.meta.url).searchParams.get("scale") ?? kept) || 2)));
  let { fastCardAsked, fastGpu, scaleKept } = await fastSetup(engine);
  let FAST_SCALE = scaleOf(scaleKept);
  let fastCard = null;
  const fastCardText = () => (fastCard ? (fastCard.standing() ? `picture: the graphics card, ${FAST_SCALE} times the console's size` : `picture: the RDP (the card's road was left: ${fastCard.state().why})`)
    : `picture: the RDP (${!fastCardAsked ? "the card is switched off" : !fastGpu ? "this browser offers no WebGPU here" : fastGpu.lost ? "the graphics card was lost" : "the core file has no piece for the card"})`);
  startTimes.fetchCore = performance.now() - t0;
  const tableTexts = env.files?.tables ?? Object.fromEntries(await Promise.all(TABLES.map(async (n) => [n, await fetched("machine/" + n, "text").catch(() => null)])));
  startTimes.fetchTables = performance.now() - t0;
  let compiled = await compileCore(firstBuilds.coreBytes, threadFile ?? "n64core.wasm");
  firstBuilds.coreBytes = null;
  startTimes.compile = performance.now() - t0;
  let choiceFor = remembered && remembered.build === compiled.build.sha256 ? remembered : null;
  // A band an earlier module remembered (site-push-1 and before added one by itself in a slow window and kept it, which
  // shut the card out on a phone): cleared from the store at this load, for every build, the rest kept as it was.
  if (remembered && remembered.bands > 0 && fault !== 2102) choiceStore("readwrite", (st) => st.put({ ...remembered, bands: 0 }, "choice"));   // 2102, wrong on purpose: a remembered band is left in the store
  // THE ENGINE'S CHANGE. The player's choice of the option "Engine" is kept (above, for the next time the module is made)
  // and is also applied now: the other engine's builds are fetched and compiled while the game plays on as it was; when
  // they are ready the module asks the host, by the option's own event, to set the option again, and answers that with
  // "reload", so the host starts the game again (as for a change of main memory) and the start takes the new builds.
  // With no game loaded the builds are taken at once. Settings show how it stands (the option's notice).
  let engineNext = null;      // { asked, state: "getting" | "ready" | "failed", builds, compiled }
  function engineGet(asked) {
    const next = engineNext = { asked, state: "getting" };
    (async () => {
      const b = await buildsFor(asked);
      if (engineNext !== next) return;                                   // chosen otherwise meanwhile
      if (b.engine === engine && b.threadFile === threadFile) { engineNext = null; engineAsked = asked; ENGINE_LABEL = labelOf(b); env.emit?.("options"); return; }   // no such build here: nothing to change
      const c = await compileCore(b.coreBytes, b.threadFile ?? "n64core.wasm"), fast = await fastSetup(b.engine);
      if (engineNext !== next) return;
      b.coreBytes = null; next.builds = b; next.compiled = c; next.fast = fast; next.state = "ready";
      if (fault === 2020) return;                                        // 2020, wrong on purpose: the change waits for the page to be loaded again
      if (req) env.emit?.("option", { id: "engine", v: asked }); else engineTake();
      env.emit?.("options");
    })().catch(() => { if (engineNext === next) { next.state = "failed"; env.emit?.("options"); } });
  }
  function engineTake() {
    const n = engineNext;
    if (!n || n.state !== "ready") return false;
    engineNext = null;
    ({ threadBytes, threadFile, engine, gpuOffered, cardShader } = n.builds);
    engineAsked = n.asked; ENGINE_LABEL = labelOf(n.builds); compiled = n.compiled;
    ({ fastCardAsked, fastGpu, scaleKept } = n.fast); FAST_SCALE = scaleOf(scaleKept);
    choiceFor = remembered && remembered.build === compiled.build.sha256 ? remembered : null;
    Object.assign(core.info, infoNow());
    return true;
  }
  // The option's notice, which Settings show beside it.
  const engineNotice = () => {
    const other = engineNext?.asked === "fast" ? "Performance" : "Accuracy";
    if (engineNext?.state === "getting") return `Getting the ${other} engine ready: the game starts again on it in a moment`;
    if (engineNext?.state === "ready") return `The ${other} engine is ready: the game starts again on it`;
    if (engineNext?.state === "failed") return "The engine chosen could not be fetched: the game plays on as it was. Loading the page again tries once more";
    if (engineAsked === "fast" && engine !== "fast") return "This site holds no Performance build: Accuracy runs";
    return engine === "fast" ? "Now Performance: the console's exact timing is given up for speed, and some games may show faults that are not the console's. A change starts the game again" : "Now Accuracy. A change starts the game again on the engine chosen";
  };
  const cpusHere = cpusSaid;
  // The workers of the game playing now, one for each thread the build asks for (core.threads: "drawing", the RDP's
  // lines; "rsp", the RSP's tasks), started once the game is chosen. A thread whose worker cannot be had is left out
  // and its part runs on the machine's own worker: both threads, else the drawing thread alone, else none.
  // test.drawing false (before a load): no worker is started; test.rsp false: the RSP's worker alone is not.
  let drawing = null, testNoDrawing = false, testNoRsp = false, testBands = null, adapt = null, lastWork = 0;
  const READY_WITHIN_MS = 3000;
  // The threaded build's pictures: after each field the machine asks the drawing thread for that field's picture
  // (n64_vi_field_later, into one of ROOMS rooms of this module's own) and never waits for it. The pictures asked wait
  // in a short queue in field order; the drawing thread makes them in that order.
  const ROOMS = 6;
  let later = [], shown = null, rooms = null, roomTurn = 0, askedAt = -10, frameCount = 0;
  // How the threaded build gives its picture (test.pictureWay, a test host's; "queue" is the module's own):
  //   "queue"   pictures in order, none twice, and the machine's worker never waits: video() gives the newest picture
  //             made that was not given yet, or nothing (null: the page keeps the picture it has) when the drawing
  //             thread has not finished the next one; that one comes with a later frame. When two or more were made
  //             since the last frame (the drawing thread catching up) the older ones are passed over (even.passed),
  //             so the picture is never further behind than the drawing thread. At most ROOMS - 1
  //             pictures wait: while all are waiting (the drawing thread far behind the machine for a while) a field's
  //             picture is not asked, so the pictures given are still in order and never one given before; at full
  //             speed the drawing thread keeps up and every field's picture is asked and given.
  //   "order"   the picture of the field before the one just run, waited for (up to 50 ms) when it is not made yet;
  //   "newest"  the newest picture made, else the last one given again (site-fast-trim-9f984e8 and before);
  //   "now"     the field just run, made on the machine's worker after the drawing queue is settled.
  let pictureWay = "queue";
  const askPicture = () => {
    const X = x(), M = m(), win = winNow(), bytes = win.width * (win.rows >> 1) * 4, c = game.core;
    if (!rooms || rooms.bytes < bytes) rooms = { bytes, list: Array.from({ length: ROOMS }, () => ({ room: c.alloc(bytes), info: c.alloc(16) })) };
    // Every room holds a picture not given yet (the drawing thread far behind the machine for a while): this field's
    // picture is not asked. The pictures waiting are kept: they are the next made, in order.
    if (later.length >= ROOMS - 1) { even.dropped++; return; }
    const r = rooms.list[roomTurn = (roomTurn + 1) % ROOMS];
    const t = performance.now();
    const number = X.n64_vi_field_later(M, r.room, win.x0, win.width, win.top, win.rows, X.n64_vi_state(M, 1) & 1, 0, r.info);
    costs.later += performance.now() - t;
    if (!number) return;
    later.push({ field, bytes, room: r.room, info: r.info, made: () => X.n64_vi_field_made(number) !== 0 });
  };
  const takePicture = (e) => {
    const t = performance.now(), X = x(), info = new Uint32Array(X.memory.buffer, e.info, 4);
    if (!info[2]) return null;
    const w = info[2], h = info[3], data = new Uint32Array(new Uint8Array(X.memory.buffer, e.room, w * h * 4).slice().buffer);
    costs.take += performance.now() - t;
    return { w, h, data, field: e.field };
  };
  const ORDER_WAIT_MS = 50;
  // What the page was given, for a test host (test.even): for each picture the field just run and the field shown.
  const evenNew = () => ({ videos: 0, none: 0, again: 0, passed: 0, repeats: 0, skips: 0, dropped: 0, behind: {}, waited: 0, waitedMs: 0, waitedMostMs: 0, gaveUp: 0, log: [] });
  let even = evenNew(), lastShownField = -1;
  const noteShown = (asked, shownField) => {
    even.videos++;
    if (shownField === lastShownField) even.repeats++;
    else if (lastShownField >= 0 && shownField > lastShownField + 1) even.skips++;
    const k = String(asked - shownField); even.behind[k] = (even.behind[k] ?? 0) + 1;
    if (even.log.length < 4096) even.log.push([asked, shownField]);
    lastShownField = shownField;
  };
  const winNow = () => { const X = x(), M = m(); return { x0: X.n64_vi_usual_window(M, 0), width: X.n64_vi_usual_window(M, 1), top: X.n64_vi_usual_window(M, 2), rows: X.n64_vi_usual_window(M, 3) }; };
  // THE CARD'S CHOICE. Three ways draw the same words: the drawing thread alone (the road off), the card with every kind
  // of call it can take, and the card with only the kinds that are dear to a processor. Which is fastest differs from
  // device to device and moves with heat, so it is measured here while the game plays and kept under watch
  // (machine/card-choose.mjs, watcher: the drawing thread's own time a field each way when play begins, a watch of the
  // way in force, a measure again every 45 s, a change only on two measures running). Whatever is chosen the machine
  // and its pictures are the same, so the way may change at any field.
  // The road is off, the drawing thread alone exactly as a build without the card draws, whenever the card cannot
  // serve: no WebGPU or no adapter (the worker says so), a worker that says nothing within CARD_WITHIN_MS, a device
  // lost or a request the core gave up (the core then draws what was asked by itself, and the road stays off for the
  // rest of the game), and while the picture is drawn in bands (the card draws only while one thread draws everything).
  // The module never starts a band by itself (below, the bands), so a band never shuts out a card that serves. test.card (a test host's): "auto" (the module's own),
  // "off", "every", "dear" hold one way; asked with nothing it answers how things stand.
  const CARD_WITHIN_MS = Number(env.cardWithinMs) || 10000, CARD_LOOK_MS = 250, CARD_BEGIN_FIELDS = 30, CARD_BEGIN_COMMANDS = 100, CARD_BEGIN_AT_MOST = 600;
  const CARD_SHORT = { [CARD_WAYS[0].name]: "the thread alone", [CARD_WAYS[1].name]: "every kind", [CARD_WAYS[2].name]: "dear kinds" };
  const CARD_FAILED = ["the card failed", "the card's worker could not draw a request", "a request was given up: the card did not answer", "the card answered another request", "the card's answer was not whole", "the card's answer was not whole", "the card's answer was not whole"];
  const CARD_BANDS = "the picture is drawn in bands";
  let card = null, cardMode = "auto";
  const cardHas = () => !!game?.core.x.n64_rdp_card_desk;
  const cardBands = () => (drawing ? drawing.threads.some((t) => t.band) : false);
  // The way set in the core: the road and the kinds the card takes. Returns the road the core says is in force.
  const cardSet = (w) => { const X = x(), got = X.n64_rdp_card_live(m(), w.how); X.n64_rdp_card_kinds(w.kinds); if (card) { card.way = got === w.how ? w : CARD_WAYS[0]; } return got; };
  const cardOff = (why) => { if (!card) return; card.watch = null; if (cardHas() && game) { try { x().n64_rdp_thread_clock(0); cardSet(CARD_WAYS[0]); } catch { /* gone */ } } card.way = CARD_WAYS[0]; card.why = why; };
  const cardEnd = (why) => { if (!card) return; cardOff(why); card.state = "none"; try { card.worker?.terminate(); } catch { /* gone */ } card.worker = null; };
  const stopCard = () => { if (!card) return; try { card.worker?.terminate(); } catch { /* gone */ } card = null; };
  const startCard = () => {
    card = { state: "none", worker: null, adapter: null, since: performance.now(), way: CARD_WAYS[0], why: "", watch: null, held: null, means: null, measures: 0, changes: 0, events: [], failedBefore: 0, begin: null, looksAMs: 0 };
    if (!cardHas()) { card.why = engine === "fast" ? "not with the fast engine" : gpuOffered ? "the core file has no card" : onPageMain || !game.core.sharedWith ? "no drawing thread" : env.card === false ? "switched off by the host" : "this browser offers no WebGPU"; return; }
    // (A build with the card has its desk drawn by the core itself until a host says otherwise: the road is switched off
    // here, so that the drawing thread draws exactly as a build without the card until a card serves and is chosen.)
    if (fault !== 1903) game.core.x.n64_rdp_card_live(game.core.machine, 0);   // 1903, wrong on purpose: the road is left as the build has it
    if (!drawing) { card.why = "no drawing thread"; return; }
    if (!cardShader) { card.why = "the shader's text did not come"; return; }
    if (cardBands()) { card.why = CARD_BANDS; return; }
    const c = game.core, deskAt = c.x.n64_rdp_card_desk();
    card.failedBefore = Number(c.x.n64_rdp_card_count(5));
    try {
      card.worker = new Worker(new URL("./card-worker.mjs?v=1a0bb93318c7", import.meta.url), { type: "module", name: "n64-card" });
      const mine = card;
      card.worker.onmessage = ({ data }) => {
        if (card !== mine || !data?.card) return;
        if (data.card.adapter && mine.state === "starting") { mine.state = "serving"; mine.adapter = data.card.adapter; mine.why = "waiting for play to begin"; }
        else if (data.card.error && fault !== 1900) cardEnd(String(data.card.error));
        else if ("ended" in data.card) cardEnd(`the card serves no more: ${data.card.ended}`);
      };
      card.worker.onerror = (e) => { e?.preventDefault?.(); if (card === mine) cardEnd("the card's worker could not be started"); };
      card.worker.postMessage({ memory: c.sharedWith.memory, deskAt, wgsl: cardShader });
      card.state = "starting"; card.why = "the card's worker is starting";
      if (fault === 1900) { card.state = "serving"; card.why = "waiting for play to begin"; }   // 1900, wrong on purpose: the card is taken as serving though its worker has not said so, or has said it cannot
    } catch { card.worker = null; card.why = "the card's worker could not be started"; }
  };
  // After every field run. Nothing here reads or changes the machine: it sets which road draws, and reads counts.
  const cardStep = () => {
    if (!card || !game || !cardHas()) return;
    const X = x();
    if (card.state === "starting" && performance.now() - card.since > CARD_WITHIN_MS) cardEnd(`the card's worker said nothing in ${CARD_WITHIN_MS >= 1000 ? Math.round(CARD_WITHIN_MS / 1000) + " s" : CARD_WITHIN_MS + " ms"}`);
    if (card.state !== "serving" || !drawing?.up || !drawing.picture) return;
    // A request that failed: the core has drawn it by itself and draws so from then on; the road is off for good.
    if (!card.watch && Number(X.n64_rdp_card_count(5)) > card.failedBefore && fault !== 1902) { const why = Number(X.n64_rdp_card_count(101)); cardEnd(CARD_FAILED[why] ?? CARD_FAILED[0]); return; }   // 1902, wrong on purpose: a card that failed is still said to draw
    if (cardBands()) { if (card.why !== CARD_BANDS) cardOff(CARD_BANDS); return; }
    if (!card.looksAMs) {
      // How the drawing thread waits for the card: awake, looking for the answer, for CARD_LOOK_MS at most (many times a
      // trip's length); a card that has not answered by then is slept for, and given up by the core some seconds later.
      X.n64_rdp_card_look(100000);
      const t = performance.now(); X.n64_rdp_card_look(1000000);
      card.looksAMs = 1000000 / Math.max(0.01, performance.now() - t);
      X.n64_rdp_card_wait(Math.min(0xFFFFFFFF, Math.round(CARD_LOOK_MS * card.looksAMs)), 0);
    }
    if (cardMode !== "auto") {
      const w = cardMode === "off" ? CARD_WAYS[0] : cardMode === "every" ? CARD_WAYS[1] : CARD_WAYS[2];
      if (card.held !== cardMode) { card.held = cardMode; card.watch = null; card.begin = null; X.n64_rdp_thread_clock(0); cardSet(w); card.why = "set by a test host"; }
      return;
    }
    if (card.held) { card.held = null; cardSet(CARD_WAYS[0]); card.why = "waiting for play to begin"; }
    if (!card.watch) {
      // Play begins for the measure when the game draws: CARD_BEGIN_FIELDS fields with CARD_BEGIN_COMMANDS drawing
      // commands a field or more (a boot's black fields say nothing of any road), or after CARD_BEGIN_AT_MOST fields.
      const sent = Number(X.n64_rdp_thread_count(0));
      card.begin ??= { fields: 0, since: 0, sent };
      const b = card.begin;
      b.fields++; b.since++;
      if (b.since >= CARD_BEGIN_FIELDS) { const busy = sent - b.sent >= CARD_BEGIN_COMMANDS * b.since; b.since = 0; b.sent = sent; if (!busy && b.fields < CARD_BEGIN_AT_MOST) return; } else return;
      card.begin = null;
      card.watch = watcher(X, m(), env.cardWatch ?? {});
      card.way = CARD_WAYS[0]; card.why = "measuring: play begins";
      return;
    }
    const e = card.watch.step();
    if (!e) return;
    if (card.events.length >= 32) card.events.shift();
    card.events.push({ what: e.what, atMs: e.atMs, field, why: e.why, way: e.way, better: e.better ?? null, means: e.means ? e.means.map((v) => ({ way: CARD_SHORT[v.way] ?? v.way, msAField: Math.round(v.msAField * 100) / 100, failed: !!v.failed })) : undefined });
    if (e.what === "failed") { if (fault !== 1902) cardEnd(CARD_FAILED[e.why] ?? CARD_FAILED[0]); return; }
    if (e.what === "measured" || e.what === "changed") {
      card.measures++; if (e.what === "changed") card.changes++;
// (The times the Log shows are those of the last measure that settled the way: one in which another way read better
      // once is followed at once by a second, and that one says.)
      if (!e.better || !card.means) card.means = Object.fromEntries(e.means.map((v) => [v.way, v.msAField]));
      card.way = card.watch.way(); card.why = "";
    }
  };
  // The Log's words: which way is in force and why. "card: dear kinds (8.9 vs 9.9 ms)": the card draws the kinds that
  // are dear to a processor, the drawing thread's ms a field so against the thread alone, as last measured.
  const cardText = () => {
    if (engine === "fast") return fastCardText();
    if (!card) return "card: off (no game)";
    const ms = (v) => (Number.isFinite(v) ? v.toFixed(1) : "-"), mn = card.means, off = CARD_WAYS[0].name;
    const way = fault === 1901 ? CARD_WAYS[1] : card.way;   // 1901, wrong on purpose: the Log says the card draws every kind whatever is in force
    if (way.how) return `card: ${CARD_SHORT[way.name]} (${card.why || !mn ? card.why || "measured" : `${ms(mn[way.name])} vs ${ms(mn[off])} ms`})`;
    if (card.why || !mn) return `card: off (${card.why || "not measured yet"})`;
    return `card: off, the thread alone (${ms(mn[off])} ms; every kind ${ms(mn[CARD_WAYS[1].name])}, dear kinds ${ms(mn[CARD_WAYS[2].name])})`;
  };
  // Stopping, in the order the threads ask: across off (it settles both), no RSP task handed out any more, the drawing
  // thread detached, then the workers ended (never the RSP's with across on: the machine would wait for it).
  // THE FAST ENGINE'S WORKERS WAIT FOR WORK. With the fast engine's picture on the graphics card the drawing thread has
  // nothing to draw, and where the host does the game's graphics and sound lists the RSP's thread is handed nothing: read
  // in a test browser in turn, the threaded build with both workers and the build of one thread then take the same time a
  // field, flat out and at a player's pace, and the workers cost a quarter of a second at the start. So no worker is
  // started while the card draws and next to nothing runs on the RSP. Nothing is measured against anything for this: the
  // need shows by itself. The card's road left (the RDP draws again), or more than RSP_BUSY_A_FIELD instructions a field
  // on the RSP over FAST_NEED_EVERY fields (lists the host does not read), and the workers are started then, as they are
  // at a game's start elsewhere: the machine does their work itself until they say they are there. The Log says which.
  const RSP_BUSY_A_FIELD = 10000, FAST_NEED_EVERY = 60;
  const fastWorkersNeeded = ({ card, rspAField }) => fault === 2062 || !card || rspAField > RSP_BUSY_A_FIELD;   // 2062, wrong on purpose: the workers are started though the card draws and nothing stays on the RSP
  let held = null;      // while the fast engine's workers wait: { fields, rsp, started (why they were started, once they are), force }
  const rspCount = () => { try { return Number(x().n64_rsp_instructions?.(m()) ?? 0); } catch { return 0; } };
  const heldStep = () => {
    if (!held || held.started) return;
    held.fields++;
    let rspAField = 0;
    if (held.fields % FAST_NEED_EVERY === 0) { const now = rspCount(); rspAField = (now - held.rsp) / FAST_NEED_EVERY; held.rsp = now; }
    const cardDraws = !!fastCard && fastCard.standing();
    if (!held.force && !fastWorkersNeeded({ card: cardDraws, rspAField })) return;
    held.started = held.force ? "a test host asked" : !cardDraws ? "the card's road was left" : "work stays on the RSP";
    startDrawing();
  };
  const heldText = () => (!held ? "" : held.started ? ` | workers started in play (${held.started})` : " | no worker started (the card draws, nothing for the RSP)");
  const stopDrawing = () => {
    // (The card first: the road off, which settles what its desk holds, then its worker ended.)
    if (card) { try { if (game && cardHas()) { x().n64_rdp_thread_clock(0); x().n64_rdp_card_live(m(), 0); } } catch { /* gone */ } stopCard(); }
    if (!drawing) return;
    const c = drawing.core;
    try { c.across(false); } catch { /* gone */ }
    try { c.x.n64_rcp_thread_use?.(0); } catch { /* gone */ }
    try { c.x.n64_rdp_thread_detach?.(c.machine); } catch { /* gone */ }
    for (const t of drawing.threads) try { t.worker.terminate(); } catch { /* gone */ }
    drawing = null;
  };
  // The picture drawn in bands (a build with bit 4194304 lists "band 1" to "band 3" in core.threads): each band beside the
  // first drawing thread is a worker more. The module never starts a band by itself, on any device: only a test host does,
  // by test.bands (0 to 3, before a load). A band takes a processor from the machine's and the RSP's threads, and a page
  // cannot tell a phone's fast cores from its slow ones; on a Fold a band added in a slow (hot) window and remembered
  // shut the card out and came with RSP waits about 2.5 times longer (site-push-1), and on a desktop bands read about the
  // same as none. So the card's chooser alone decides how the picture is drawn (the thread alone, every kind, the dear
  // kinds). A band whose worker cannot be started is left out with every band after it; one that comes late joins at the
  // start of a later run; the machine never waits for one. While a band draws the card does not (it draws only while
  // one thread draws everything).
  // One window's reading: m = { workerMs, late, waits, fps }, kept for the readout. Returns { add, keep }: never a band.
  const judgeWindow = (a, m, bandsNow) => {
    a.lastFps = m.fps; a.lastLate = m.late; a.lastWorkerMs = m.workerMs;
    // 2100, wrong on purpose: the rule of site-push-1, a band added (and remembered) when the drawing seems to hold the worker
    if (fault === 2100 && bandsNow < 1 && m.workerMs > 16.0 && (m.late > 0.05 || m.waits > 0.2)) { a.said = `band ${bandsNow + 1} started (worker ${m.workerMs.toFixed(1)} ms)`; return { add: true, keep: bandsNow + 1 }; }
    return { add: false, keep: fault === 2100 ? bandsNow : 0 };
  };
  const bandsFor = () => {
    if (testBands !== null) return testBands;
    return fault === 2101 ? Math.min(1, Math.max(0, choiceFor?.bands ?? 0)) : 0;   // 2101, wrong on purpose: a remembered band is started at the load
  };
  const rspFor = () => (testNoRsp ? false : choiceFor ? choiceFor.rsp !== false : cpusHere > 2);
  const startOne = (c, t) => {
    const worker = new Worker(new URL("./draw-worker.mjs?v=65724dc5d856", import.meta.url), { type: "module", name: `n64-${t.name.replace(" ", "")}` });
    worker.postMessage({ ...c.sharedWith, stack: t.stack(), entry: t.entry, arg: t.arg ?? 0 });
    return { name: t.name, worker, ready: t.ready, band: t.name.startsWith("band ") ? Number(t.arg) : 0 };
  };
  const startDrawing = () => {
    const c = game.core;
    if (!c.sharedWith || !c.threads?.length) return;
    const threads = [];
    const hasBands = c.threads.some((t) => t.name.startsWith("band "));
    const bandsWanted = hasBands ? bandsFor() : 0;
    // The bands the core may enrol: as many as could ever be started here, so that one started while the game runs joins.
    if (c.x.n64_rdp_bands_want) c.x.n64_rdp_bands_want(1 + (testBands !== null ? testBands : fault === 2100 || fault === 2101 ? 1 : 0));
    let bandsCut = false;
    for (const t of c.threads) {
      if (t.name === "rsp" && !rspFor()) continue;
      const band = t.name.startsWith("band ") ? Number(t.arg) : 0;
      if (band && (band > bandsWanted || bandsCut)) continue;
      try { threads.push(startOne(c, t)); } catch { if (band) bandsCut = true; /* this thread's part runs on the machine's worker, or the band is left out */ }
    }
    adapt = { wall: 0, work: 0, winFields: 0, lastAt: 0, given: 0, none: 0, waitFields: 0, waitedSeen: 0, bandsOk: hasBands && testBands === null && !bandsCut, lastFps: 0, liveFps: 0, lastLate: 0, lastWorkerMs: 0, said: "", saved: "" };
    if (!threads.length) return;
    drawing = { core: c, threads, up: false, since: performance.now(), rsp: false, picture: false };
  };
  // Once every thread started says it is there, the machine leaves their work to them from one run to the next
  // (across). An RSP thread not there in time is let go (no task is handed to it) and the drawing thread goes on alone.
  const drawingUp = () => {
    if (!drawing || drawing.up) return;
    const ready = drawing.threads.filter((t) => t.band || t.ready());          // the bands join when they come
    if (ready.length < drawing.threads.length) {
      if (performance.now() - drawing.since < READY_WITHIN_MS) return;
      const late = drawing.threads.filter((t) => !t.ready());
      if (late.some((t) => t.name === "drawing")) return;      // without its drawing thread the build draws by itself
      try { drawing.core.x.n64_rcp_thread_use?.(0); } catch { /* gone */ }
      for (const t of late) try { t.worker.terminate(); } catch { /* gone */ }
      drawing.threads = ready;
    }
    drawing.core.across(true);
    drawing.up = true;
    startTimes.threadsUp = performance.now() - drawing.since;
    drawing.rsp = drawing.threads.some((t) => t.name === "rsp");
    drawing.picture = drawing.threads.some((t) => t.name === "drawing");
  };
  // Before this module reads the machine's memory itself (a hash, a kept state), the drawing queued is done.
  const settled = () => { if (game) game.core.settle(); };
  const tables = tablesFromRows(Object.fromEntries(Object.entries(tableTexts).filter(([n]) => n !== "firmware-time.json").map(([n, t]) => [n, t == null ? null : JSON.parse(t)])));
  const firmwareTimes = (() => { try { return JSON.parse(tableTexts["firmware-time.json"]).byBootCode; } catch { return {}; } })();
  const deviceRate = () => (typeof env.audioRate === "function" ? env.audioRate() : 48000) || 48000;
  // The host's clock (its virtual clock, which starts at the real time at load), for a cartridge with a clock of its own:
  // set from it when the machine starts, kept by the machine's own count after that.
  const hostMs = () => { try { const t = typeof env.now === "function" ? Number(env.now()) : NaN; return Number.isFinite(t) && t > 0 ? t : Date.now(); } catch { return Date.now(); } };

  let game = null, ai = null, watchAt = 0, req = null, field = 0, frozen = false, sound = null, video = null, options = { memory: 8, pak: "controller", deadZone: DEAD_ZONE };
  // The four controller ports: what is in each, the player's setting for the second to the fourth, and each one's input.
  const ports = makePorts({ fault });
  let sentInput = [null, null, null, null];
  // Where the worker's time goes, for a test host (test.costs): the machine's run, the sound, the picture.
  let costs = { machine: 0, sound: 0, picture: 0, fields: 0, pictures: 0, between: 0, betweenMax: 0, betweens: [], later: 0, take: 0 }, lastEnd = 0;
  // The same field by field, for a test host (test.fieldTimes): for each field the machine's run and the worker's whole
  // time for it (the run, its sound, its picture and the sound taken), kept for the last FIELD_KEEP fields in a ring. A
  // field is numbered as core.frames is once it has run (the run that takes it from 3,700 to 3,701 is field 3,701).
  const FIELD_KEEP = 1 << 15;
  const fieldTimes = { field: new Int32Array(FIELD_KEEP), machine: new Float32Array(FIELD_KEEP), worker: new Float32Array(FIELD_KEEP), when: new Float64Array(FIELD_KEEP), n: 0, at: -1 };
  // Beside the times, the counts of the core that say why a field was dear, where the core file has them: the messages the
  // machine put on the drawing thread's queue in that field and the queue's depths summed over them (n64_rdp_thread_count
  // 5 and 6, so depth sum / messages is the field's mean depth), the deepest the queue has been since the load (7), and the
  // RSP's functions made in that field, found already made, and the bytes made (n64_rsp_jit_count 0, 1, 5). Read once a
  // field from counts the core keeps anyway; nothing of the machine.
  // Also the machine's waits in that field: for the RSP's thread (n64_rcp_count 6) and for the drawing thread (n64_rdp_thread_count
  // 10, 13 and 14: at a join, for its whole queue, for room in its ring). Counts only: a WebAssembly core has no clock to time them.
  const FIELD_COUNTS = ["queued", "depthSum", "depthMax", "rspMade", "rspFound", "rspBytes", "rspWaits", "drawingWaits"];
  fieldTimes.counts = new Float64Array(FIELD_KEEP * FIELD_COUNTS.length);
  let countsBefore = null;
  const countsNow = () => {
    const X = x(), rdp = X.n64_rdp_thread_count, jit = X.n64_rsp_jit_count, rcp = X.n64_rcp_count;
    return [rdp ? Number(rdp(5)) : NaN, rdp ? Number(rdp(6)) : NaN, rdp ? Number(rdp(7)) : NaN, jit ? Number(jit(m(), 0)) : NaN, jit ? Number(jit(m(), 1)) : NaN, jit ? Number(jit(m(), 5)) : NaN,
      rcp ? Number(rcp(6)) : NaN, rdp ? Number(rdp(10)) + Number(rdp(13)) + Number(rdp(14)) : NaN];
  };
  const fieldCounts = (i, add) => {
    const now = countsNow(), c = fieldTimes.counts, o = i * FIELD_COUNTS.length;
    for (let k = 0; k < now.length; k++) {
      const d = k === 2 ? now[k] : now[k] - (countsBefore ? countsBefore[k] : 0);
      c[o + k] = add && k !== 2 ? c[o + k] + d : d;
    }
    countsBefore = now;
  };
  // The game's own speed for the readout, from the last READOUT_FIELDS fields of the ring (or as many as there are): fields
  // a second from their start times, the worker's median ms a field and the time the slowest 1% take at least (the 99th
  // centile), and how many took more than 14.3 ms (a 70th of a second: the line the owner reads a slow field by).
  // Read from the ring only: it changes nothing the machine runs or draws.
  const READOUT_FIELDS = 600, SLOW_MS = 14.3, readoutSorted = new Float32Array(FIELD_KEEP);
  // Fields a second over the Log's own window (the last READOUT_FIELDS fields, or as many as there are; null before two):
  // core.info.fieldsPerSecond reads it live, for a host that tells the player when the game runs slow.
  const fieldsPerSecondNow = () => {
    const ft = fieldTimes, k = Math.min(ft.n, FIELD_KEEP, READOUT_FIELDS);
    if (k < 2 || fault === 2022) return null;                          // 2022, wrong on purpose: no live figure
    const span = ft.when[(ft.n - 1) % FIELD_KEEP] - ft.when[(ft.n - k) % FIELD_KEEP];
    return span > 0 ? Number(((k - 1) * 1000 / span).toFixed(1)) : null;
  };
  const gameSpeed = () => {
    const ft = fieldTimes, k = Math.min(ft.n, FIELD_KEEP, fault === 418 ? FIELD_KEEP : READOUT_FIELDS);   // 418, wrong on purpose: every kept field, not the last 600
    if (k < 2) return `game: - fields/s, ${cardText()} | `;
    const last = (ft.n - 1) % FIELD_KEEP, first = (ft.n - k) % FIELD_KEEP, span = ft.when[last] - ft.when[first];
    let over = 0;
    for (let j = 0; j < k; j++) { const w = ft.worker[(ft.n - k + j) % FIELD_KEEP]; readoutSorted[j] = w; if (w > SLOW_MS) over++; }
    const sorted = readoutSorted.subarray(0, k).sort();
    const median = k & 1 ? sorted[k >> 1] : (sorted[k / 2 - 1] + sorted[k / 2]) / 2, slow = sorted[Math.max(0, Math.ceil(k * 0.99) - 1)];
    const NC = FIELD_COUNTS.length, R = FIELD_COUNTS.indexOf("rspWaits"), D = FIELD_COUNTS.indexOf("drawingWaits"), f = { machine: [], worker: [], rspWaits: [], drawingWaits: [] };
    for (let j = 0; j < k; j++) { const i = (ft.n - k + j) % FIELD_KEEP; f.machine.push(ft.machine[i]); f.worker.push(ft.worker[i]); f.rspWaits.push(ft.counts[i * NC + R]); f.drawingWaits.push(ft.counts[i * NC + D]); }
    return `game: ${span > 0 ? ((k - 1) * 1000 / span).toFixed(1) : "-"} fields/s, worker median ${median.toFixed(1)} ms, slowest 1% ${slow.toFixed(1)} ms, over ${SLOW_MS} ms ${over} of ${k}, ${cardText()} | ${splitText(splitOf(f))}${adapt?.said ? adapt.said + " | " : ""}`;
  };
  // Where the worker's ms a field go over the same fields (means): the machine's run (the CPU and all it runs on this worker),
  // within it the waits for the RSP's thread and for the drawing thread, and the rest, the host's part (the picture given,
  // the sound made and taken). The core keeps the waits as counts, not times, so their ms are estimated: the machine's ms
  // of each field fitted to its two wait counts by least squares (ms = a + b rsp waits + c drawing waits), b and c being
  // the ms a wait costs; a busier scene may both wait more and run longer, so the estimate leans high.
  // Read from the ring only. f: { machine, worker, rspWaits, drawingWaits } arrays (a count NaN: no such thread).
  const splitOf = (f) => {
    const k = f.machine.length;
    let mm = 0, wm = 0, rm = 0, dm = 0, rspNone = false, drawNone = false;
    for (let j = 0; j < k; j++) { mm += f.machine[j]; wm += f.worker[j]; if (Number.isNaN(f.rspWaits[j])) rspNone = true; else rm += f.rspWaits[j]; if (Number.isNaN(f.drawingWaits[j])) drawNone = true; else dm += f.drawingWaits[j]; }
    mm /= k; wm /= k; rm /= k; dm /= k;
    let srr = 0, sdd = 0, srd = 0, srm = 0, sdm = 0;
    for (let j = 0; j < k; j++) {
      const r = rspNone ? 0 : f.rspWaits[j] - rm, d = drawNone ? 0 : f.drawingWaits[j] - dm, y = f.machine[j] - mm;
      srr += r * r; sdd += d * d; srd += r * d; srm += r * y; sdm += d * y;
    }
    let b = 0, c = 0;
    const det = srr * sdd - srd * srd;
    if (srr > 0 && sdd > 0 && det > 1e-9 * srr * sdd) { b = (srm * sdd - sdm * srd) / det; c = (sdm * srr - srm * srd) / det; }
    else if (srr > 0) b = srm / srr;
    else if (sdd > 0) c = sdm / sdd;
    let rspMs = Math.max(0, b) * rm, drawMs = Math.max(0, c) * dm;
    if (rspMs + drawMs > mm) { const sc = mm / (rspMs + drawMs); rspMs *= sc; drawMs *= sc; }
    const host = fault === 419 ? 0 : wm - mm;   // 419, wrong on purpose: the host's part counted as the machine's
    return { machine: wm - host - rspMs - drawMs, rspMs, drawMs, host, worker: wm, rspWaits: rspNone ? null : rm, drawingWaits: drawNone ? null : dm, rspEach: Math.max(0, b), drawingEach: Math.max(0, c) };
  };
  // Each kind of wait: how many a field (the times the machine stopped for that thread: one for each look that found it
  // behind, however long it then spun; for the RSP's thread a look comes each time the machine reaches where that thread last
  // said it stood, so with the two close a thousand a field is ordinary), then the ms the fit gives them and what one wait costs by the fit.
  const waitText = (name, n, ms, each) => n === null ? `${name} waits -` : `${name} waits ${n >= 10 ? Math.round(n) : n.toFixed(1)}/field ~${ms.toFixed(1)} ms (${each < 1 ? (each * 1000).toFixed(1) + " us" : each.toFixed(2) + " ms"} each, fitted)`;
  const splitText = (p) => `split (mean ${p.worker.toFixed(1)} ms): machine ${p.machine.toFixed(1)}, ${waitText("rsp", p.rspWaits, p.rspMs, p.rspEach)}, ${waitText("drawing", p.drawingWaits, p.drawMs, p.drawingEach)}, host ${p.host.toFixed(1)} ms | `;
  const fieldTimesClear = () => { fieldTimes.n = 0; fieldTimes.at = -1; };
  const fieldWork = (ms) => { if (fieldTimes.at >= 0) fieldTimes.worker[fieldTimes.at] += fault === 417 ? 0 : ms; };   // 417, wrong on purpose: the worker's time is the machine's alone
  // What the console's sound was, frame by frame, as it went to the resampler: counted and hashed in pieces for tests.
  const sent = { frames: 0, parts: [] };
  const clean = { cart: null, eeprom: null, pak: null };
  // The Game Boy cartridge in each port's Transfer Pak: what its header says, or null when the Pak is empty.
  let carts = [null, null, null, null];
  // The calendar time in seconds, when the host's clock gives one (for a cartridge's clock between two visits).
  const wallSeconds = () => { const t = Number(typeof env.now === "function" ? env.now() : 0); return t > 1e12 ? Math.floor(t / 1000) : 0; };
  const x = () => game.core.x, m = () => game.core.machine;

  // The ruling's pak for a game file, by its row of the game table.
  const pakOf = (bytes) => { try { const n = normalise(bytes); return defaultPak(lookUp(tables, gameKey(n.bytes), n.fileKey), n.fileKey); } catch { return "controller"; } };
  // What goes in the slot for the host's word: a pak it names, else (nothing said, or "auto") the ruling's.
  const slotFor = (said, bytes) => (["none", "controller", "rumble", "transfer"].includes(said) && !(fault === 1351 && said === "rumble") ? said : pakOf(bytes));   // 1351, wrong on purpose: the player's Rumble Pak is not taken

  // THE RUMBLE PAK'S MOTOR, read once a field after the field has run (n64_pak_motor: whether the last byte written to
  // its register was odd; n64_pak_motor_changes: how often it was switched). A game that wants a weak rumble switches
  // the motor on and off every few fields, so the level is the share, out of 1,000, of the last RUMBLE_FIELDS fields in
  // which the motor ran at the field's end or was switched during it: the page's pad follows it as core.rumble (the
  // site's form for a cartridge's motor, as the Game Boy core gives it) and, for a host whose core is on a worker, as
  // an event "rumble" each time it changes. Nothing of the machine is changed by reading it.
  const RUMBLE_FIELDS = 6;
  const motor = { ring: new Uint8Array(RUMBLE_FIELDS), at: 0, changes: 0, level: 0 };
  const motorClear = () => { motor.ring.fill(0); motor.at = 0; motor.changes = game ? game.si.motorChanges(0) : 0; setRumble(0); };
  const setRumble = (level) => { if (level === motor.level) return; motor.level = level; core.rumble = level; env.emit?.("rumble", { level }); };
  function readMotor() {
    if (options.pak !== "rumble") return;
    const ch = game.si.motorChanges(0), ran = game.si.motor(0) || ch !== motor.changes;
    motor.changes = ch;
    motor.ring[motor.at] = ran ? 1 : 0; motor.at = (motor.at + 1) % RUMBLE_FIELDS;
    const n = motor.ring.reduce((s, v) => s + v, 0);
    setRumble(fault === 1350 ? 0 : Math.round((n * 1000) / RUMBLE_FIELDS));   // 1350, wrong on purpose: the motor never reaches the pad
  }

  // A game opened on a machine made anew, by the start the rule chooses. Throws only when nothing can start it.
  // prep(core): said on each core before its start (the disk drive attached under a cartridge that a disk expands).
  function open(gameBytes, firmware, prep = null) {
    const dest = destinationOf(gameBytes), gameTv = regionOf(dest) ?? 1;
    const given = SLOTS.map((s) => s.id).filter((id) => asBytes(firmware?.[id])?.length);
    const tryOpen = (opts) => { try { const c = coreFromModule(compiled); prep?.(c); return startGame(c, gameBytes, { tables, firmwareTimes, memory: options.memory, pak: options.pak, clockMs: hostMs(), ...opts }); } catch { return null; } };
    const tried = new Map();
    const handsOver = (slot, tv) => {
      const key = slot + "@" + tv;
      if (!tried.has(key)) tried.set(key, tryOpen({ firmwareImages: [asBytes(firmware[slot])], tv }));
      return !!tried.get(key);
    };
    let ours = null, without = null;
    const choice = decide(dest, given, handsOver, () => !!(ours ??= tryOpen({ tv: gameTv })), () => !!(without ??= tryOpen({ tv: gameTv, ownLoader: false, firmwareTimeOn: false })));
    if (choice.way === "firmware") return tried.get(choice.slot + "@" + choice.tv);
    if (choice.way === "ours") return ours ?? tryOpen({ tv: choice.tv });
    if (choice.way === "without") return without;
    throw new CoreError("damaged", "this game file could not be started: the machine would not take it");
  }

  // The rule's answer for a game of this destination letter, the images given, and which of them hand over.
  function decide(dest, given, handsOver, ownWorks = true, withoutWorks = true) {
    const preferred = fault === 401 ? NONE : preferredOf(dest);      // 401, wrong on purpose: a game's preferred value is ignored
    return chooseStart({ preferred, given, handsOver, gameTv: regionOf(dest) ?? 1, ownWorks, withoutWorks });
  }

  // The 64DD disk drive's side (disk.mjs): a disk opened as a game, its save, its line in the Log.
  const dd = DD.diskSide({ compiled, compiledNow: () => compiled, open, CoreError, hostMs, fault });
  let diskNote = null;
  function start() {
    stopDrawing();
    dd.stop(); diskNote = null;
    if (DD.isDisk(req.bytes)) ({ game, note: diskNote } = dd.start({ ...req, save: kept.get(DD.SAVE_ID) ?? req.battery?.[DD.SAVE_ID] ?? null }, options));
    else game = open(req.bytes, req.firmware);
    if (!game) throw new CoreError("damaged", "this game file could not be started");
    if (fastCard) { fastCard.close(); fastCard = null; }
    if (fastGpu && !fastGpu.lost) { try { fastCard = makeCard(game.core, fastGpu, { scale: FAST_SCALE }); } catch { fastCard = null; } }
    x().n64_rdp_capture(m(), 0, 0, 0, 0, 0, 0);          // the tools' count of drawing commands is not wanted here
    const watchBytes = x().n64_run_watch_size();
    watchAt = game.core.alloc(watchBytes);
    game.core.u8().fill(0, watchAt, watchAt + watchBytes);
    ai = aiOf(game.core);
    sound = makeResampler(deviceRate());
    field = 0; frozen = false; video = null; fieldTimesClear(); countsBefore = countsNow();
    ports.start(game.si, options.pak);
    giveCarts();
    giveSavesBack(); motorClear();
    applyInput();
    core.frames = 0;
    core.model = TV_NAMES[game.television];
    // With the thread: the picture is taken by the VI as it sends each line (n64_vi_watch), which needs nothing settled,
    // into room for two fields; and the drawing worker is started.
    later = []; shown = null; rooms = null; askedAt = -10;
    const tw = performance.now();
    held = null;
    if (game.core.sharedWith && !testNoDrawing) {
      if (engine === "fast" && fastCard && !fastWorkersNeeded({ card: fastCard.standing(), rspAField: 0 })) held = { fields: 0, rsp: rspCount(), started: null, force: false };
      else startDrawing();
    }
    startCard();
    startTimes.startWorkers = performance.now() - tw;
  }
  let raw = false, testKept = null;
  const applyInput = () => {
    if (!game) return;
    ports.late(game.si, options.pak);
    for (let p = 0; p < PORTS; p++) {
      if (raw && p === 0) continue;   // a test host's raw word holds controller 1
      if (!ports.in(p).controller) { sentInput[p] = null; continue; }
      const held = ports.held(p);
      const s = stateOf(held.mask, held.axes, BUTTON, { deadZone: options.deadZone, cFromRightStick: fault !== 404 });   // 404, wrong on purpose: the right stick is not the C buttons
      sentInput[p] = s;
      game.si.set(p, s.buttons, s.x, s.y);
    }
  };

  // Each port's Transfer Pak gets the Game Boy cartridge file the player chose for it, before the machine runs on.
  // A file that is no Game Boy cartridge, or one too large to be one, leaves the Pak empty.
  function giveCarts() {
    carts = [null, null, null, null];
    for (const p of ports.tpaks()) {
      const prog = fault === 1670 ? null : asBytes(req.firmware?.[TPAK.cartSlot(p)]);       // 1670, wrong on purpose: the cartridge file is not put into the Pak
      if (!prog || prog.length < 0x150 || prog.length > TPAK.MAX_CART_BYTES) continue;
      try { carts[p] = game.si.giveCart(p, prog, null); } catch { carts[p] = null; }
    }
  }
  const cartOf = (id) => { const p = TPAK.portOfSave(id); return p >= 0 && carts[p]?.saveBytes ? p : -1; };
  // A kept Game Boy save goes back into the cartridge when it is this cartridge's size; its clock is counted on
  // by the time since it was kept, when the host's clock gives a calendar time.
  function giveCartSave(p, bytes) {
    const got = TPAK.unpackSave(bytes, carts[p].saveBytes, carts[p].clock);
    if (!got || fault === 1673) return false;                                              // 1673, wrong on purpose: a kept save is not put back into the cartridge
    game.si.giveCartSave(p, got.memory);
    if (got.clock) { const now = wallSeconds(); game.si.setCartClock(p, { running: got.clock.running, held: got.clock.held, secondsSince: now && got.clock.at && now > got.clock.at ? now - got.clock.at : 0 }); }
    game.si.cartTaken(p);
    return true;
  }

  // ---- saves: each kind the cartridge or the controller holds, by the site's battery calls
  const ids = () => {
    if (!game) return [];
    const out = [];
    const cartBytes = x().n64_save_size(m());
    if (cartBytes) out.push({ id: game.facts.save.fitted.startsWith("flash") ? "flash" : "sram", kind: game.facts.save.fitted.startsWith("flash") ? "flash" : "sram", bytes: cartBytes, ext: game.facts.save.fitted.startsWith("flash") ? ".fla" : ".sra" });
    if (game.si.eepromSize()) out.push({ id: "eeprom", kind: "eeprom", bytes: game.si.eepromSize(), ext: ".eep" });
    for (const p of ports.paks()) out.push({ id: pakId(p), kind: "pak", bytes: 32768, ext: ".mpk" });
    for (const p of ports.tpaks()) if (carts[p]?.saveBytes) out.push({ id: TPAK.saveId(p), kind: "sram", bytes: carts[p].saveBytes + (carts[p].clock ? TPAK.CLOCK_BYTES : 0), ext: ".sav" });
    return [...out, ...dd.battery.ids()];
  };
  const read = (id) => {
    if (!game) return null;
    if (id === DD.SAVE_ID) return dd.battery.read();
    if (id === "sram" || id === "flash") return takeSave(game.core);
    if (id === "eeprom") return game.si.eepromSize() ? new Uint8Array(game.si.eepromBytes()) : null;
    if (portOfPak(id) >= 0) return ports.hasPak(portOfPak(id)) ? new Uint8Array(game.si.pakBytes(portOfPak(id))) : null;
    if (cartOf(id) >= 0) { const p = cartOf(id); return TPAK.packSave(game.si.cartSave(p), carts[p].clock ? game.si.cartClock(p) : null, wallSeconds()); }
    return null;
  };
  const same = (a, b) => { if (!a || !b || a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
  const kept = new Map();
  function giveSavesBack() {
    for (const [id, bytes] of kept) {
      if ((id === "sram" || id === "flash") && x().n64_save_size(m()) === bytes.length) fitSave(game.core, game.facts.save.fitted, bytes);
      if (id === "eeprom" && game.si.eepromSize() === bytes.length) game.si.giveEeprom(bytes);
      if (ports.hasPak(portOfPak(id)) && bytes.length === 32768) game.si.givePak(portOfPak(id), bytes);
      if (cartOf(id) >= 0) giveCartSave(cartOf(id), bytes);
    }
    for (const b of ids()) if (b.id !== DD.SAVE_ID) clean[b.id] = read(b.id);
  }

  // What the page is told of the module's builds (core.info), made again when the engine changes.
  function infoNow() {
    return { mainThread: onPageMain, engine, engineLabel: engine === "fast" ? "Performance" : "Accuracy", build: compiled.build.sha256, file: compiled.build.file, drawingThread: !!threadBytes && compiled.build.file !== "n64core-modeb.wasm", card: threadFile === "n64core-threads-card.wasm", webgpu: gpuOffered, workersFree: workersToHave, isolated: globalThis.crossOriginIsolated === true, sharedMemory: (() => { try { return new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true }).buffer instanceof SharedArrayBuffer; } catch { return false; } })() };
  }
  const core = {
    // Whether the thread this module runs in is cross-origin isolated and can make a shared memory (the drawing thread's
    // build needs both; the page learns it from here, as the worker's own answer).
    info: Object.defineProperty(infoNow(), "fieldsPerSecond", { get: () => (game ? fieldsPerSecondNow() : null), enumerable: true, configurable: true }),
    model: null, frames: 0, rumble: 0,

    // req: { game: { bytes, name, sha256 }, firmware: { [slot id]: bytes }, options }
    load(r) {
      const bytes = asBytes(r?.game?.bytes);
      if (!bytes || bytes.length < 0x1000) throw new CoreError("damaged", `a game file holds at least 4,096 bytes (a header and a boot code); this one holds ${bytes?.length ?? 0}`);
      if (bytes.length > manifest.files.game.maxBytes) throw new CoreError("unsupported", "this file is larger than the largest cartridge (64 MiB)");
      if (r.options?.memory !== undefined) options.memory = Number(r.options.memory) === 4 ? 4 : 8;
      // The controller's slot: what the host says (the site table's pak column, or the player's choice), else the
      // ruling's default for this game from the game table (defaultPak: a Controller Pak, a Rumble Pak only for a game
      // that supports it and uses no Controller Pak). The player's setting is kept for each game, and its default, "auto",
      // is that ruling: a host that reads the options before a game is loaded stores "auto", never the plain default.
      options.pak = slotFor(r.options?.pak, bytes);
      ports.take(r.options);
      kept.clear();
      req = { bytes, firmware: r.firmware ?? {}, battery: r.battery ?? {}, sha: r.game?.sha256 ?? null };
      engineTake();
      start();
      const tv = game.television;
      return {
        fps: TICKS_A_SECOND / Number(game.fieldTicks),
        video: { width: 640, height: x().n64_vi_usual_window(m(), 3) >>> 1, format: "rgba8888", pixelAspect: 0.5, rotation: 0 },
        audio: { rate: 0 },                               // 0: this core resamples itself to env.audioRate()
        ports: core.ports(),
        battery: ids(),
        options: core.options(),
        model: TV_NAMES[tv],
        ...(diskNote ? { note: diskNote } : {}),
      };
    },
    // The power switched off and on again with the same cartridge in; what the game saved is kept, as a cartridge keeps it.
    reset() {
      if (!req) return;
      for (const b of ids()) { const v = read(b.id); if (v) kept.set(b.id, v); }
      start();
    },
    setInput(port, s) {
      if (ports.input(port, s)) applyInput();
    },
    // One field of the machine's time.
    // The readout's window, while a game runs: every 180 fields of play, the worker's ms a field (its run, picture and
    // sound), the share of picture asks that found nothing new (late), the share of fields in which the machine waited
    // for the drawing thread (the core's own counts) and fields a second. Gaps of more than 150 ms between fields (a
    // pause, a hidden page) are left out. No band is ever started from it (above, the bands); what is remembered is
    // whether the RSP's thread ran.
    _adapt(now, workMs) {
      const a = adapt;
      if (!a || !drawing?.up || frozen || STEP !== 1024) return;   // judged only at the playing slice (a test host's scripted run is not play)
      const X = x(), waited = X.n64_rdp_thread_count ? [10, 13, 14].reduce((n, i) => n + Number(X.n64_rdp_thread_count(i)), 0) : 0;
      if (a.lastAt) { const gap = now - a.lastAt; if (gap <= 150) a.wall += gap; }
      a.lastAt = now;
      if (waited > a.waitedSeen) a.waitFields++;
      a.waitedSeen = waited;
      a.work += workMs; a.winFields++;
      a.liveFps = a.wall ? a.winFields * 1000 / a.wall : 0;
      if (a.winFields < 180) return;
      const m = { workerMs: a.work / a.winFields, late: a.none / Math.max(1, a.given + a.none), waits: a.waitFields / a.winFields, fps: a.wall ? a.winFields * 1000 / a.wall : 0 };
      a.wall = 0; a.work = 0; a.winFields = 0; a.given = 0; a.none = 0; a.waitFields = 0;
      const bandsNow = drawing.threads.filter((t) => t.band).length;
      const d = judgeWindow(a, m, bandsNow);
      if (d.add && a.bandsOk) {
        const t = game.core.threads.find((x2) => x2.name === `band ${bandsNow + 1}`);
        if (t) { try { drawing.threads.push(startOne(game.core, t)); } catch { a.bandsOk = false; } }
      }
      const choice = { build: compiled.build.sha256, bands: d.keep, rsp: drawing.threads.some((t) => t.name === "rsp"), workerMs: Math.round(m.workerMs * 10) / 10 };
      const key = JSON.stringify([choice.bands, choice.rsp]);
      if (typeof indexedDB !== "undefined" && key !== a.saved && testBands === null) { a.saved = key; choiceFor = choice; choiceStore("readwrite", (st) => st.put(choice, "choice")); }
    },
    runFrame() {
      if (!game || frozen) return;
      frameCount++;
      core._adapt(performance.now(), lastWork); lastWork = 0;
      const until = BigInt(field + 1) * game.fieldTicks, t0 = performance.now();
      if (lastEnd) { const b = t0 - lastEnd; costs.between += b; if (b > costs.betweenMax) costs.betweenMax = b; if (costs.betweens.length < 4096) costs.betweens.push(+b.toFixed(2)); }
      x().n64_run_watched(m(), watchAt, 4_000_000_000n, until, STEP, 0);
      const t1 = performance.now(); costs.machine += t1 - t0; costs.fields++; lastWork += t1 - t0;
      {
        // this run's field: a run that ends before its field does (a freeze) is added to the same field's place
        const ft = fieldTimes, at = ft.at, ran = field + 1;
        if (at >= 0 && ft.field[at] === ran) { ft.machine[at] += t1 - t0; ft.worker[at] += t1 - t0; fieldCounts(at, true); }
        else { const i = ft.n % FIELD_KEEP; ft.field[i] = ran; ft.when[i] = t0; ft.machine[i] = t1 - t0; ft.worker[i] = t1 - t0; ft.at = i; ft.n++; fieldCounts(i, false); }
      }
      heldStep();
      drawingUp();
      cardStep();
      if (fastCard) { const c0 = performance.now(); fastCard.flush(); const d = performance.now() - c0; costs.machine += d; lastWork += d; }
      const why = Number(new BigUint64Array(x().memory.buffer, watchAt + 64 * 8, 1)[0]);
      if (why === 2) { frozen = true; env.emit?.("error", { message: "The game stopped: the machine froze." }); return; }
      if (why === 1) { field++; core.frames = field; readMotor(); }
      if (drawing?.up && drawing.picture && pictureWay !== "now" && !fastCard?.standing()) askPicture();
      video = null;
      // The sound the console made in this field, as it made it, resampled to the device's rate.
      for (const run of ai.takeRuns()) {
        const clock = ai.clockHz(), rate = clock[0] / clock[1] / run.period;
        if (rate < 4000 || rate > 200000) continue;     // a period no sound device plays: not sound
        const frames = run.silent ? new Int16Array(run.count * 2) : run.frames;
        sound.push(frames, rate);
        if (fault === 403) sound.push(frames, rate);   // 403, wrong on purpose: frames are given twice, which fills in sound the console did not make
        if (env.keepSent) { sent.frames += frames.length >> 1; sent.parts.push({ rate, frames }); }
      }
      const t2 = performance.now(); costs.sound += t2 - t1; fieldWork(t2 - t1);
    },
    video() {
      if (!game) return null;
      if (video) return video;
      const t0 = performance.now();
      try { return fastCard?.standing() ? core._cardVideo() : core._composeVideo(); } finally { const d = performance.now() - t0; costs.picture += d; costs.pictures++; lastWork += d; fieldWork(d); }
    },
    audio() {
      const t0 = performance.now();
      try { return core._takeAudio(); } finally { lastEnd = performance.now(); costs.sound += lastEnd - t0; lastWork += lastEnd - t0; fieldWork(lastEnd - t0); }
    },
    // The fast engine's field from the graphics card: the newest one read back and not given yet, or nothing (the page
    // keeps the picture it has) while the next is on its way; the read of this field's picture is asked for here.
    _cardVideo() {
      const got = fastCard.latest();
      fastCard.read();
      if (!got) { video = null; return null; }
      video = { format: "rgba8888", width: got.width, height: got.height, stride: got.width, data: got.data, pixelAspect: 0.5, rotation: 0 };
      noteShown(field, field);
      return video;
    },
    // The field the VI sends now, each line written twice so that it has a frame's shape.
    _composeVideo() {
      if (drawing?.up && drawing.picture && pictureWay === "now") { settled(); later = []; }
      else if (drawing?.up && drawing.picture && pictureWay === "queue") {
        // The newest picture made and not given yet (the drawing thread makes them in order: the made ones come first);
        // nothing if it has not finished the next one. Older ones made with it are not given: the picture never falls
        // further behind than the drawing thread is, and none is given twice.
        let k = -1; while (k + 1 < later.length && later[k + 1].made()) k++;
        even.passed += Math.max(0, k);
        const p = k >= 0 ? takePicture(later[k]) : null;
        if (k >= 0) later = later.slice(k + 1);
        // Nothing new made (or a field with no picture). A host that asks for a picture with every frame (the site's runner
        // with everyPicture) is given nothing: it keeps its picture and the next comes with a later frame. A host that asks
        // only now and then (the runner without everyPicture asks with the frame after a paint, and paints only when a
        // picture comes) would never ask again: it is given the last picture given once more, so it always has one to
        // paint and asks again. Which host it is shows in the asks: one with every frame, or not.
        const sparse = askedAt < frameCount - 1;
        askedAt = frameCount;
        if (adapt) { if (p) adapt.given++; else adapt.none++; }
        if (!p) {
          if (!sparse || fault === 409) { even.none++; video = null; return null; }   // 409, wrong on purpose: a host that asks now and then is given nothing and its picture stops
          if (!shown) { const win = winNow(); shown = { w: win.width, h: win.rows >> 1, data: new Uint32Array(win.width * (win.rows >> 1)).fill(0xFF000000), field: -1 }; }
          even.again++;
          video = { format: "rgba8888", width: shown.w, height: shown.h, stride: shown.w, data: shown.data, pixelAspect: 0.5, rotation: 0 };
          return video;
        }
        shown = p;
        video = { format: "rgba8888", width: shown.w, height: shown.h, stride: shown.w, data: shown.data, pixelAspect: 0.5, rotation: 0 };
        noteShown(field, shown.field);
        return video;
      }
      else if (drawing?.up && drawing.picture) {
        const give = (i) => {
          const e = later[i];
          later = later.slice(i + 1);
          const p = takePicture(e);
          if (p) shown = p;
        };
        let i = pictureWay === "order" ? later.findIndex((e) => e.field === field - 1) : -1;
        if (i >= 0) {
          // In order: the field before the one just run, waited for if it is not made yet.
          if (!later[i].made()) {
            const t = performance.now();
            while (!later[i].made() && performance.now() - t < ORDER_WAIT_MS) { /* the drawing thread is a moment behind */ }
            const w = performance.now() - t; even.waited++; even.waitedMs += w; if (w > even.waitedMostMs) even.waitedMostMs = w;
          }
          if (later[i].made()) give(i); else { even.gaveUp++; i = -1; }
        }
        if (i < 0) {
          // The newest picture made, else the last one given.
          for (let j = later.length - 1; j >= 0; j--) if (later[j].made()) { give(j); break; }
        }
        if (!shown) { const win = winNow(); shown = { w: win.width, h: win.rows >> 1, data: new Uint32Array(win.width * (win.rows >> 1)).fill(0xFF000000) }; }
        video = { format: "rgba8888", width: shown.w, height: shown.h, stride: shown.w, data: shown.data, pixelAspect: 0.5, rotation: 0 };
        noteShown(field, shown.field ?? -1);
        return video;
      }
      // One field as the VI sends it, 640 pixels by half the frame's lines, its pixels already opaque (the core writes
      // 255 in the fourth byte): shown at a pixel aspect of one half, so the host's canvas gives it the frame's 4:3 shape
      // with no line written twice here. The pixels are handed as a view of the core's memory: the site's worker runner
      // copies them at once (core-worker.js, frameOut), so nothing is copied twice.
      const X = x(), M = m(), win = { x0: X.n64_vi_usual_window(M, 0), width: X.n64_vi_usual_window(M, 1), top: X.n64_vi_usual_window(M, 2), rows: X.n64_vi_usual_window(M, 3) };
      const w = win.width, h = win.rows >> 1, bytes = w * h * 4, c = game.core;
      if (!c.viRoom || c.viRoomBytes < bytes) { c.viRoom = c.alloc(bytes); c.viRoomBytes = bytes; c.viInfo = c.alloc(16); }
      const made = X.n64_vi_field_now(M, c.viRoom, win.x0, w, win.top, win.rows, X.n64_vi_state(M, 1) & 1, 0, c.viInfo);
      const data = new Uint32Array(X.memory.buffer, c.viRoom, w * h);
      if (!made) data.fill(0xFF000000);
      video = { format: "rgba8888", width: w, height: h, stride: w, data, pixelAspect: 0.5, rotation: 0 };
      noteShown(field, field);
      return video;
    },
    // The sound since the last call at the device's rate: frames of left and right, 16 bits each.
    _takeAudio() {
      if (!sound) return { data: new Int16Array(0), frames: 0 };
      const data = sound.take();
      return { data, frames: data.length >> 1 };
    },
    ports() {
      return ports.list();
    },
    options() {
      return [
        { id: "memory", label: "Main memory", type: "enum", group: "machine", scope: "console", live: false, default: 8, values: [{ v: 8, label: "8 MiB: with the Expansion Pak" }, { v: 4, label: "4 MiB: with the Jumper Pak" }], help: "A few games need the Expansion Pak; most run with either" },
        { id: "pak", label: "In controller 1's slot", type: "enum", group: "machine", scope: "game", live: false, default: "auto", values: [{ v: "auto", label: req ? `As the game prefers (now ${{ none: "nothing", controller: "a Controller Pak", rumble: "a Rumble Pak" }[pakOf(req.bytes)]})` : "As the game prefers" }, { v: "controller", label: "A Controller Pak: saves notes" }, { v: "rumble", label: "A Rumble Pak: the pad vibrates" }, { v: "transfer", label: "A Transfer Pak" }, { v: "none", label: "Nothing" }], help: "A game that takes both can have only one in the slot: a Controller Pak keeps its notes, a Rumble Pak shakes the controller. A Transfer Pak holds a Game Boy cartridge: choose your own cartridge file for it beside the boot programs" },
        // The engine is chosen when the module is made (env.engine, the address, or the choice kept from this option); a
        // change is kept, and applied now by the engine's change (above). Settings show an enum's notice, not its help.
        { id: "engine", label: "Engine", type: "enum", group: "machine", scope: "console", live: false, default: "accurate", values: [{ v: "accurate", label: "Accuracy" }, { v: "fast", label: "Performance" }], help: "Performance gives up the console's exact timing for speed on slower devices; some games may show faults that are not the console's. A change starts the game again on the engine chosen", ...(fault === 2021 ? {} : { notice: engineNotice() }) },
        ...(engine === "fast" && fastGpu ? [{ id: "cardScale", label: "Fast engine's picture", type: "enum", group: "machine", scope: "console", live: true, default: 2, values: [{ v: 2, label: "Twice the console's size (sharper)" }, { v: 1, label: "The console's size (less work for the graphics card)" }] }] : []),
        { id: "deadZone", label: "Pad stick's rest area", type: "enum", group: "machine", scope: "console", live: true, default: DEAD_ZONE, values: [0.05, 0.1, 0.15, 0.2, 0.3].map((v) => ({ v, label: `${Math.round(v * 100)}% of its travel` })) },
        ...ports.options(),
      ];
    },
    setOption(id, v) {
      // For a test host only, through the site's own runner (no other road reaches the worker): the controller's raw
      // word and stick as a script gives them; the machine's memory kept and put back, so that a stretch can be
      // timed again from one place. Never listed among the options a person sees.
      if (id === "test.raw") { if (!game) return "unknown"; raw = !!v; if (v) game.si.set(0, v.buttons >>> 0, v.x | 0, v.y | 0); else applyInput(); return "live"; }
      // The SHA-256 of the field the tools take (the even one, 640 by half the frame's lines, four bytes a pixel as the
      // core makes them), as a pinned picture is: answered as the setting's own answer.
      if (id === "test.fastCard") return JSON.stringify(fastCard ? { ...fastCard.state(), text: fastCardText() } : { on: false, pending: 0, text: engine === "fast" ? fastCardText() : "not the fast engine" });
      if (id === "test.picture") { if (!game) return "unknown"; settled(); const win = { x0: x().n64_vi_usual_window(m(), 0), width: x().n64_vi_usual_window(m(), 1), top: x().n64_vi_usual_window(m(), 2), rows: x().n64_vi_usual_window(m(), 3) }; const p = fieldNow(game.core, win, 0); return p.made ? sha256(p.pixels) : "none"; }
      // How many instructions between two looks at the clock (the pins were made at 16; the core plays at 1,024).
      if (id === "test.step") { STEP = Math.max(1, Math.min(1 << 20, Number(v) | 0)) || 1024; return "live"; }
      if (id === "test.drawing") { testNoDrawing = v === false; return "live"; }
      // The threads' own counts as they stand (a test host takes differences): the drawing thread's (n64_rdp_thread_count 0 to 24),
      // the RSP thread's (n64_rcp_count 0 to 15) and both threads' states. Nothing is settled or changed.
      if (id === "test.counts") { if (!game) return "unknown"; const X = x(); return JSON.stringify({ rdp: X.n64_rdp_thread_count ? Array.from({ length: 25 }, (_, i) => Number(X.n64_rdp_thread_count(i))) : null, rcp: X.n64_rcp_count ? Array.from({ length: 16 }, (_, i) => Number(X.n64_rcp_count(i))) : null, rdpState: X.n64_rdp_thread_state ? X.n64_rdp_thread_state() : null, rcpState: X.n64_rcp_thread_state ? X.n64_rcp_thread_state() : null, threads: drawing?.up ? drawing.threads.map((t) => t.name) : [] }); }
      if (id === "test.pictureWay") { if (!["queue", "order", "newest", "now"].includes(v)) return "unknown"; pictureWay = v; later = []; return "live"; }
      // The pictures given since the last ask: how many, how many gave the field shown before again, how many jumped
      // over a field, how far behind the field just run each was (fields: count), the waits for a picture in order.
      if (id === "test.even") { const out = JSON.stringify({ way: drawing?.up && drawing.picture ? pictureWay : "machine", ...even }); even = evenNew(); return out; }
      if (id === "test.rsp" || id === "test.rspThread") { testNoRsp = v === false; return "live"; }
      if (id === "test.split") { if (!v || !Array.isArray(v.machine) || v.machine.length < 2) return "unknown"; const p = splitOf({ machine: v.machine, worker: v.worker, rspWaits: v.rspWaits.map((c) => (c === null ? NaN : c)), drawingWaits: v.drawingWaits.map((c) => (c === null ? NaN : c)) }); return JSON.stringify({ ...p, text: splitText(p) }); }
      if (id === "test.judge") {
        const st = { said: "" }, out = [];
        let bands = 0;
        for (const m of v.windows) { const d = judgeWindow(st, m, bands); if (d.add) bands++; out.push({ add: d.add, keep: d.keep }); }
        return JSON.stringify({ steps: out, remember: out.length ? out[out.length - 1].keep : 0, said: st.said });
      }
      // The fast engine's workers (above): whether they wait, and why they were started; "start" starts them at the next field.
      // test.fastNeed: the rule itself, asked with { card, rspAField }.
      if (id === "test.fastWorkers") { if (v === "start" && held && !held.started) held.force = true; return JSON.stringify({ waiting: !!held && !held.started, started: held?.started ?? null, running: drawing ? drawing.threads.map((t) => t.name) : [] }); }
      if (id === "test.fastNeed") return JSON.stringify(fastWorkersNeeded({ card: v?.card === true, rspAField: Number(v?.rspAField) || 0 }));
      if (id === "test.startTimes") return JSON.stringify(Object.fromEntries(Object.entries(startTimes).map(([k, ms]) => [k, Math.round(ms)])));
      if (id === "test.drawingThread") { testNoDrawing = v === false; return "live"; }
      // The card: asked with nothing, how things stand (the core file's card, whether WebGPU is offered, the worker, the way
      // in force as the module has it and as the core says it, the last measure's ms a field each way, what happened last,
      // and the core's own counts of the desk); given "auto", "off", "every" or "dear", that way is held from the next field.
      if (id === "test.card") {
        if (["auto", "off", "every", "dear"].includes(v)) { cardMode = v; return "live"; }
        const X = game?.core.x, has = !!X?.n64_rdp_card_desk, n = (i) => (has ? Number(X.n64_rdp_card_count(i)) : null);
        return JSON.stringify({ file: compiled.build.file, cardInFile: has, webgpuOffered: gpuOffered, shader: !!cardShader, mode: cardMode, worker: card?.state ?? "none", adapter: card?.adapter ?? null,
          way: card ? CARD_SHORT[card.way.name] : "the thread alone", road: card?.way.how ?? 0, kinds: card?.way.kinds ?? 0, roadInTheCore: n(100), why: card?.why ?? "", text: cardText(),
          means: card?.means ? Object.fromEntries(Object.entries(card.means).map(([k, ms]) => [CARD_SHORT[k] ?? k, Math.round(ms * 100) / 100])) : null, measures: card?.measures ?? 0, changes: card?.changes ?? 0, events: card?.events ?? [],
          looksAMs: Math.round(card?.looksAMs ?? 0), counts: has ? { callsTaken: n(0), callsNotTaken: n(1), desksDrawn: n(2), byHand: n(3), byTheCard: n(4), failed: n(5), failedWhy: n(101), requestsAnswered: new Uint32Array(X.memory.buffer, X.n64_rdp_card_desk(), 64)[32] } : null });
      }
      // One line a host may show (a player's readout): the core file, isolated or not, the threads running, the drawing
      // threads at work, fields a second over the last judged window, pictures in time, the worker's ms a field.
      if (id === "test.readout") {
        const speed = gameSpeed();
        const th = drawing?.up ? drawing.threads.map((t) => t.name) : [];
        const bands = game?.core.x.n64_rdp_bands ? game.core.x.n64_rdp_bands() : 0;
        const ms = costs.fields ? (costs.machine + costs.sound + costs.picture) / costs.fields : 0;
        return `N64 ${ENGINE_LABEL}${speed}${onPageMain ? "main thread: plain core " : ""}${compiled.build.file} ${compiled.build.sha256.slice(0, 12)} | ${globalThis.crossOriginIsolated === true ? "isolated" : "not isolated"} | threads: machine${th.length ? ", " + th.join(", ") : ""} | drawing threads ${bands || (th.includes("drawing") ? 1 : 0)} | ${adapt?.lastFps ? adapt.lastFps.toFixed(1) : adapt?.liveFps ? adapt.liveFps.toFixed(1) : "-"} fields/s | pictures in time ${adapt?.lastFps ? Math.round(100 * (1 - adapt.lastLate)) + "%" : "-"} | worker ${(adapt?.lastWorkerMs || ms).toFixed(1)} ms/field${choiceFor ? " | remembered" : ""}${heldText()}${speed.startsWith("game: - ") && adapt?.said ? " | " + adapt.said : ""}`;
      }
      // Which threads run now beside the machine's worker (a test host's question).
      if (id === "test.threads") return JSON.stringify({ asked: (game?.core.threads ?? []).map((t) => t.name), running: drawing?.up ? drawing.threads.map((t) => t.name) : [], up: !!drawing?.up, bandsDrawing: game?.core.x.n64_rdp_bands ? game.core.x.n64_rdp_bands() : 0 });
      if (id === "test.bands") { const n = Number(v); if (!(n >= 0 && n <= 3)) return "unknown"; testBands = n | 0; return "live"; }
      if (id === "test.costs") { const c = JSON.stringify(costs); costs = { machine: 0, sound: 0, picture: 0, fields: 0, pictures: 0, between: 0, betweenMax: 0, betweens: [], later: 0, take: 0 }; lastEnd = 0; return c; }
      // Field by field, for the fields from..to kept (the last FIELD_KEEP run since the load or test.back), in field order:
      // { fields, workerMs, machineMs, missing } (ms to a thousandth; missing: the fields of the range not kept) and an array
      // for each of FIELD_COUNTS (null where the core file has not that count). Asked
      // with no range: { first, last, kept }. Nothing is cleared by asking.
      if (id === "test.fieldTimes") {
        const ft = fieldTimes, kept = Math.min(ft.n, FIELD_KEEP), start = ft.n - kept;
        const at = (k) => (start + k) % FIELD_KEEP;
        if (v == null || typeof v !== "object") return JSON.stringify({ first: kept ? ft.field[at(0)] : null, last: kept ? ft.field[at(kept - 1)] : null, kept });
        const from = Number(v.from) | 0, to = Number(v.to) | 0;
        if (!(to >= from) || to - from >= FIELD_KEEP) return "unknown";
        const byField = new Map();
        for (let k = 0; k < kept; k++) { const i = at(k), f = ft.field[i]; if (f >= from && f <= to) byField.set(f, i); }
        const out = { from, to, fields: [], workerMs: [], machineMs: [], missing: 0, ...Object.fromEntries(FIELD_COUNTS.map((n) => [n, []])) };
        for (let f = from; f <= to; f++) {
          const i = byField.get(f);
          if (i === undefined) { out.missing++; continue; }
          out.fields.push(f); out.workerMs.push(Math.round(ft.worker[i] * 1000) / 1000); out.machineMs.push(Math.round(ft.machine[i] * 1000) / 1000);
          FIELD_COUNTS.forEach((n, k) => { const c = ft.counts[i * FIELD_COUNTS.length + k]; out[n].push(Number.isNaN(c) ? null : c); });
        }
        return JSON.stringify(out);
      }
      if (id === "test.keep") { if (!game) return "unknown"; testKept = { memory: game.core.keep(), field, frozen }; return "live"; }
      if (id === "test.back") {
        if (!game || !testKept) return "unknown";
        game.core.putBack(testKept.memory); later = []; lastShownField = -1;
        field = testKept.field; frozen = testKept.frozen; core.frames = field; video = null; sound = makeResampler(deviceRate()); ai.takeRuns(); fieldTimesClear();
        return "live";
      }
      if (id === "cardScale") {
        FAST_SCALE = Number(v) === 1 ? 1 : 2;
        if (typeof indexedDB !== "undefined") choiceStore("readwrite", (st) => st.put(FAST_SCALE, "cardScale"));
        if (fastCard) fastCard.setScale(FAST_SCALE);
        return "live";
      }
      if (id === "engine") {
        const wanted = v === "fast" ? "fast" : "accurate";
        if (typeof indexedDB !== "undefined") choiceStore("readwrite", (st) => st.put(wanted, "engine"));       // kept for the next time the module is made
        if (wanted === engineAsked) { engineNext = null; return "live"; }                  // the engine running: nothing to change
        if (engineNext?.asked === wanted && engineNext.state === "ready") { if (req) return "reload"; engineTake(); return "live"; }
        if (engineNext?.asked !== wanted || engineNext.state === "failed") engineGet(wanted);
        return "live";                                                                      // the game plays on until the builds are ready
      }
      if (id === "deadZone") { options.deadZone = Math.min(0.9, Math.max(0, Number(v) || 0)); applyInput(); return "live"; }
      if (id === "memory" || id === "pak") { if (id === "memory") options.memory = Number(v) === 4 ? 4 : 8; else options.pak = req ? slotFor(String(v), req.bytes) : String(v); return "reload"; }
      if (portOfOption(id) > 0) { ports.set(portOfOption(id), String(v)); return "reload"; }
      return "unknown";
    },
    battery: {
      read,
      // A write is the stored save going back in: kept for the next start, and in the machine now when it fits.
      write(id, b) {
        const bytes = asBytes(b);
        if (!bytes) return false;
        kept.set(id, new Uint8Array(bytes));
        if (!game) return true;
        if ((id === "sram" || id === "flash") && x().n64_save_size(m()) === bytes.length) fitSave(game.core, game.facts.save.fitted, bytes);
        else if (id === "eeprom" && game.si.eepromSize() === bytes.length) game.si.giveEeprom(bytes);
        else if (ports.hasPak(portOfPak(id)) && bytes.length === 32768) game.si.givePak(portOfPak(id), bytes);
        else if (cartOf(id) >= 0 && giveCartSave(cartOf(id), bytes)) { /* in the cartridge now */ }
        else if (id === DD.SAVE_ID) return dd.battery.write(bytes);
        else return false;
        clean[id] = new Uint8Array(bytes);
        return true;
      },
      // What the game has written since the host last kept it: each is written the moment the game writes it.
      // A Game Boy save is told by the cartridge's own count of changed bytes: its kept form carries the time of day.
      dirty() { return fault === 402 ? [] : [...ids().map((b) => b.id).filter((id) => id !== DD.SAVE_ID).filter((id) => (cartOf(id) >= 0 ? fault !== 1671 && game.si.cartChanges(cartOf(id)) > 0 : !same(read(id), clean[id]))), ...dd.battery.dirty()]; },   // 402, wrong on purpose: no save is ever reported; 1671: no Game Boy save is
      clean(id) { if (id === DD.SAVE_ID) return dd.battery.clean(); clean[id] = read(id); if (cartOf(id) >= 0) game.si.cartTaken(cartOf(id)); },
    },
    ext: {
      // For tests: the controller's raw word and stick, and what a test program printed.
      debug: {
        set(buttons, stickX, stickY, port = 0) { if (game) game.si.set(port & 3, buttons >>> 0, stickX | 0, stickY | 0); },
        text() { return game ? game.core.takeDebugText() : ""; },
        facts() { return game ? { title: game.facts.title, television: game.facts.consoleTelevisionType, save: game.facts.save.fitted, field } : null; },
        // The start the rule takes for a destination letter, the slots given and those that hand over (no machine is run).
        decide(destination, given, working) { return decide(destination, given, (slot) => working.includes(slot)); },
        input(port = 0) { return sentInput[port & 3]; },
        // What is in each port now, and how often the program has read each one's state.
        ports() { return [0, 1, 2, 3].map((p) => ({ ...ports.in(p), setting: ports.setting(p), reads: game ? game.si.polls(p) : 0 })); },
        // Each port's Transfer Pak: the cartridge in it by its header's facts, what the Pak is doing, and the blocks read and written through it.
        tpaks() { return game ? ports.tpaks().map((p) => ({ port: p, cartridge: carts[p], state: game.si.tpakState(p), counts: game.si.tpakCounts(p) })) : []; },
        // What went to the resampler since the last call (env.keepSent only): { frames, parts: [{ rate, frames }] }.
        sent() { const r = { frames: sent.frames, parts: sent.parts }; sent.frames = 0; sent.parts = []; return r; },
        // The 64DD disk drive: its clock, its counts, the blocks written, the disk's code and how it started (null: no drive).
        disk() { return dd.look(); },
      },
    },
    // The Log's line once a game is in: for a disk the drive, its boot program, the console's boot firmware and the disk
    // (disk.mjs); for a cartridge its title, television type, start and boot firmware.
    details() { return dd.details() ?? (game ? `N64 cartridge: ${game.facts.title}; ${game.facts.consoleTelevisionType}; started ${game.facts.startWay}; boot firmware ${game.facts.bootFirmware}` : null); },
    destroy() { stopDrawing(); dd.stop(); if (fastCard) { fastCard.close(); fastCard = null; } game = null; ai = null; sound = null; req = null; },
  };
  return core;
}

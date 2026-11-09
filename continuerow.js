/* continuerow.js — the Media page's single "Continue" row (2026-10-04).
 *
 * THE DESIGN: "you could add an option to show or hide
 * 'Continue watching'. Maybe have it as a button to the right of the show games
 * menu. It can appear under the library as one row only with scroll bars like
 * the library shows combining 'up next', 'continue watching' and 'Continue
 * Playing'. Games that are just closed are saved out automatically and added to
 * a continue playing list. ... each game only appears once per game with the
 * latest save showing."
 *
 * WHAT IS IN THE ROW, newest activity first. Each card carries exactly one of
 * three labels, decided by the item's data, not by which call returned it:
 *   - Continue Watching: a film or episode WITH a resume position, with progress
 *     (Emby /Users/{id}/Items/Resume, or a part-watched /Shows/NextUp item).
 *   - Next Episode: an episode with NO resume position, from /Shows/NextUp, one
 *     per series, minus any series already above or not tracked here.
 *     Its activity time is the series' last played episode (one list call).
 *   - Continue Playing: a game whose play window was closed. ONE record per
 *     title, keyed by device id, replaced on every close: the latest save only.
 *
 * REMOVE DELETES a game's Continue save (2026-10-11; it only marked it
 * under the 2026-10-04 rule, now superseded): see "remove" below. The game's
 * own battery save and the player's save slots are never touched.
 *
 * WHERE THE GAMES ARE KEPT. This browser's own IndexedDB ('gnw-continue'),
 * never Supabase, never a server. Every access is wrapped: a private window or
 * blocked storage loses the row, never the page.
 *
 * HOW A GAME IS SAVED. index.html's closeOverlay() -- the one choke point every
 * exit of every play window passes through -- calls onPlayClose() before the
 * window is torn down, and closePlayModal / closePmPlay are wrapped here because
 * they stop their emulators BEFORE they reach closeOverlay. Each system's own
 * save routine is used, nothing new is invented. WHEN (2026-10-07, see
 * MIN_PLAY_MS): a session launched from its Continue card saves on every close,
 * however short; any other session -- a cold boot from a tile, the drawer or
 * search, even of a game that has an entry -- saves only after 30 seconds of
 * real play, and under that leaves any entry and its save untouched:
 *   Game & Watch      gnwSaveState / gnwLoadState + gnwRenderSaveThumb (gnw-host.js)
 *   Pokemon mini      the core's pm_state_ptr / pm_state_size (what its rewind uses);
 *                     its EEPROM is flushed by its own teardown, as before
 *   Game Boy / Color  window.__continue in play/gameboy/app.js (its save slots' path)
 *   Atari 2600/7800/Lynx  window.__continue in each play/<sys>/app.js (core state ABI)
 *   Tetris Jr.        window.game.serialize / deserialize (its own save slots')
 *   NES / Famicom / FDS  NES.saveState / NES.loadState and NES.flushSave (battery),
 *                     play/nes/app.js; window.__continue wins if it
 *                     is ever published. On a core without the state export the
 *                     title is recorded and relaunches without a save.
 *   Colour twins      no state API: recorded, relaunch only
 * An iframe system whose save is asynchronous (the Game Boy's worker round trip)
 * asks closeOverlay to keep the frame for at most HOLD_MS, silenced first, and
 * the frame is replaced the moment the save lands.
 *
 * REWIND HISTORY GOES WITH THE SAVE (2026-10-07: "Make sure
 * you save the rewind to the games as well so when the user launches the save,
 * they can rewind as well."). Each system hands over its OWN rewind ring at the
 * moment of the save, oldest frame first, as one block of equal-length frames
 * (Tetris Jr.: a list of JSON frames; the Game & Watch adds a JSON line per
 * frame, because its core keeps the machine as text in cpu.coreState):
 *   Game & Watch   gnwRewindExport / gnwRewindImport (gnw-host.js) -- its
 *                  RewindBuffer, every frame, 3600 frames = 60 s
 *   Game Boy/Color window.__continue save().rewind / restore(rec.rewind)
 *                  (play/gameboy/app.js) -- 100 contexts, 150 ms apart = 15 s
 *   NES/Famicom/FDS NES_REWIND.exportHistory / importHistory (play/nes/rewind.js)
 *                  -- up to 100 states, 150 ms apart = 15 s (fewer for disks)
 *   Pokemon mini   the device's own 16-slot ring (pm-embed.js), read and
 *                  refilled here -- one state every 20 frames, about 5 s
 *   Tetris Jr.     window.__tjRewind (play/tetrisjr) -- 2400 frames = 40 s
 *   Atari, colour twins: they rewind in the play host (play/host/rewind-ring.mjs,
 *                  for big states), but that ring hands over no history
 *                  (exportHistory() gives null), so nothing changes for them.
 * Kept here XOR-delta coded frame against frame (consecutive states are mostly
 * equal bytes) and deflated, at most REWIND_CAP_BYTES a game, oldest frames
 * dropped first, and REWIND_TOTAL_BYTES across all games (the oldest games'
 * histories go first; their saves stay). Stored apart from the card, in the
 * 'gnw-continue-rewind' database keyed like 'games', so drawing the row never
 * reads it and 'gnw-continue' itself is unchanged (still version 1). A
 * relaunch puts the state back and THEN the history, so holding Rewind at once
 * walks back past the moment of the save. A history that does not fit the
 * machine is refused by that system and the save loads without one; an old
 * save with no history loads exactly as before (REWIND_FORMAT is versioned).
 *
 * SOUND RULE (docs/SOUND-RULE.md): this row never makes a sound. Its cards are
 * still pictures -- a saved screenshot or the console's photograph -- and no
 * emulator, trailer or video is ever mounted in it.
 */
(function () {
  'use strict';
  if (window.ContinueRow) return;

  const PREF_KEY = 'gnw.continueRow.on';
  const DB = 'gnw-continue', STORE = 'games';
  const MAX_GAMES = 40;           // oldest beyond this are dropped on save
  const HOLD_MS = 2500;           // longest an iframe is kept after close for an async save
  const RESTORE_WAIT_MS = 45000;  // how long a relaunch waits for its machine to come up
  /* THE 30-SECOND RULE (2026-10-04): "Games should only be
     auto saved if they are played for longer than 30 seconds. If someone just
     goes in there and never starts anything in 10 seconds that is not really
     worth filling up the continue panel for."
     Only PLAY counts, per session: the window is open, the tab is visible, the
     game has started (a Game & Watch past its demo, a colour twin past "Insert
     batteries"), and neither the pause menu (keys.js) nor the game's own pause
     holds it. See "play clock" below.
     CARD SESSIONS SAVE AT ONCE (2026-10-07): "If a game has
     already been auto saved before, no need to wait 30 seconds, the user wants
     to save the progress as they are no longer opening the game to see it
     animate." And on what "already saved" means: "yes
     replace them even if it's 2 seconds in as long as it's an existing
     session. 30 second wait on new sessions before auto saving." So:
       card session (launched from its Continue card, resuming that save):
         saved on every close, any length -- 2 s counts
       new session (a cold boot: tile, drawer, search, anything but the card),
       whether or not the game has an entry:
         under 30 s     nothing is written; an existing entry keeps its save
         30 s or more   saved: a new card, or the old one replaced
     A HIDDEN entry has no card to launch from, so it only ever has new
     sessions: 30 s or more saves and unhides it, as before ("playing it again
     is the clearest sign it is wanted again"). Only real play counts. Where a
     session came from is fixed when it starts (originOf). */
  const MIN_PLAY_MS = 30000;
  /* Rewind history (see the header): the format, a cap per game and a cap
     across every game. Measured sizes are in the report of 2026-10-07. */
  const REWIND_FORMAT = 1;
  const REWIND_CAP_BYTES = 4 * 1024 * 1024;
  const REWIND_TOTAL_BYTES = 48 * 1024 * 1024;
  const RDB = 'gnw-continue-rewind', RSTORE = 'rewind';
  /* AUTO SAVE ON EXIT (9 Nov 2026: a setting, on by default, today's behaviour). Off: leaving
     a game writes no save here (a card it already has keeps the save it had). The game's own battery
     save is still kept, and the saves the player makes are not touched. The switch is in Settings,
     Configurations (settings-config.js). Kept only in this browser. */
  const AUTOSAVE_KEY = 'gnw.autoSaveOnExit';
  function autoSaveOnExit() { try { return localStorage.getItem(AUTOSAVE_KEY) !== '0'; } catch (e) { return true; } }
  function setAutoSaveOnExit(on) { try { if (on) localStorage.removeItem(AUTOSAVE_KEY); else localStorage.setItem(AUTOSAVE_KEY, '0'); } catch (e) {} }

  /* ------------------------------------------------------------ storage */
  let _dbp = null;
  function idb() {
    if (_dbp) return _dbp;
    _dbp = new Promise((res, rej) => {
      let r;
      try { r = indexedDB.open(DB, 1); } catch (e) { rej(e); return; }
      r.onupgradeneeded = () => { try { r.result.createObjectStore(STORE); } catch (e) {} };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error('blocked'));
    }).catch(e => { _dbp = null; throw e; });
    return _dbp;
  }
  /* The rewind histories live in a database of their own ('gnw-continue-rewind',
     2026-10-07), so 'gnw-continue' keeps its version 1 -- a tab still running
     the previous script, and anything else that opens it, is never blocked by
     an upgrade -- and drawing the row never reads a history. A history is used
     only if its `ts` matches its card's (written first, card second). */
  let _rdbp = null;
  function rdb() {
    if (_rdbp) return _rdbp;
    _rdbp = new Promise((res, rej) => {
      let r;
      try { r = indexedDB.open(RDB, 1); } catch (e) { rej(e); return; }
      r.onupgradeneeded = () => { try { r.result.createObjectStore(RSTORE); } catch (e) {} };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error('blocked'));
    }).catch(e => { _rdbp = null; throw e; });
    return _rdbp;
  }
  async function txn(mode, fn, rewindDb) {
    const db = await (rewindDb ? rdb() : idb());
    return new Promise((res, rej) => {
      let out;
      const name = rewindDb ? RSTORE : STORE;
      const t = db.transaction(name, mode);
      const st = t.objectStore(name);
      out = fn(st);
      t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  }
  /* Which titles have an entry, hidden or not: kept in step with the store so
     a close can decide SYNCHRONOUSLY, while the machine is still alive, whether
     to take a save at all. The store stays the authority: a short close checks
     it again before writing (see keep in onPlayClose). Entries leave by the
     MAX_GAMES cap, by Remove (deleteGame) and by the orphan sweep. */
  const _known = new Map();         // device id -> { hidden }
  let _knownReady = false;
  function know(r) { if (r && r.id) _known.set(r.id, { hidden: !!r.hidden }); }
  async function listGames() {
    try {
      const all = (await txn('readonly', st => st.getAll())) || [];
      all.forEach(know);
      _knownReady = true;
      return all;
    } catch (e) { return []; }
  }
  async function getGame(id) {
    try { return await txn('readonly', st => st.get(id)); } catch (e) { return null; }
  }
  /* A card's history, or null: none kept, or one from another save. */
  async function getRewind(rec) {
    if (!rec || !rec.rewindBytes) return null;
    try {
      const h = await txn('readonly', st => st.get(rec.id), true);
      return h && h.ts === rec.ts ? h : null;
    } catch (e) { return null; }
  }
  async function dropRewinds(ids) {
    if (!ids.length) return;
    try { await txn('readwrite', st => { ids.forEach(id => st.delete(id)); }, true); } catch (e) {}
  }
  /* One save: its history first, then the card. A save without a history
     deletes any older one -- that belongs to an earlier timeline. */
  async function putGame(rec, rewind) {
    try {
      rec.rewindBytes = 0; rec.rewindFrames = 0;
      if (rewind) {
        try {
          await txn('readwrite', st => st.put(Object.assign({ id: rec.id, ts: rec.ts }, rewind), rec.id), true);
          rec.rewindBytes = rewind.total || rewind.bytes.byteLength; rec.rewindFrames = rewind.n;
        } catch (e) { console.warn('[continue] the rewind history was not kept:', e && e.message || e); }
      }
      if (!rec.rewindBytes) await dropRewinds([rec.id]);
      await txn('readwrite', st => st.put(rec, rec.id));
      know(rec);
      const all = await listGames();
      all.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      if (all.length > MAX_GAMES) {
        const drop = all.slice(MAX_GAMES).map(r => r.id);
        await txn('readwrite', st => { drop.forEach(id => st.delete(id)); });
        await dropRewinds(drop);
        drop.forEach(id => _known.delete(id));
        all.length = MAX_GAMES;
      }
      /* Every history together stays under REWIND_TOTAL_BYTES: the least
         recently saved games lose their history first, never their save. */
      let total = all.reduce((s, r) => s + (r.rewindBytes || 0), 0);
      const strip = [];
      for (let i = all.length - 1; i >= 0 && total > REWIND_TOTAL_BYTES; i--) {
        const r = all[i];
        if (!r.rewindBytes || r.id === rec.id) continue;
        total -= r.rewindBytes;
        r.rewindBytes = 0; r.rewindFrames = 0;
        strip.push(r);
      }
      if (strip.length) {
        await txn('readwrite', st => { strip.forEach(r => st.put(r, r.id)); });
        await dropRewinds(strip.map(r => r.id));
      }
      return true;
    } catch (e) { console.warn('[continue] could not keep the save:', e && e.message || e); return false; }
  }

  /* ----------------------------------------------------- rewind history
     takeRewind() runs at the moment of the save, synchronously: it copies the
     system's block out of the play frame's realm into this one, XOR-coded
     frame against frame. packRewind() then deflates it and keeps it under
     REWIND_CAP_BYTES by dropping the oldest frames. unpackRewind() reverses
     both for a relaunch. */
  function xorFrames(buf, size, encode) {
    // encode: buf[i] ^= buf[i - size], from the end back; decode: from the start on.
    const wide = size % 4 === 0 && buf.byteOffset % 4 === 0 && buf.byteLength % 4 === 0;
    const a = wide ? new Uint32Array(buf.buffer, buf.byteOffset, buf.byteLength >> 2) : buf;
    const s = wide ? size >> 2 : size;
    if (encode) for (let i = a.length - 1; i >= s; i--) a[i] ^= a[i - s];
    else for (let i = s; i < a.length; i++) a[i] ^= a[i - s];
    return buf;
  }
  function takeRewind(h) {
    if (!h) return null;
    try {
      if (Array.isArray(h)) {                       // Tetris Jr.: JSON frames
        const frames = h.map(f => JSON.stringify(f));
        return frames.length ? { kind: 'json', frames, meta: {} } : null;
      }
      const n = h.n | 0, size = h.size | 0, src = h.data;
      if (n < 1 || size < 1 || !src || !(src.byteLength >= n * size)) return null;
      const buf = new Uint8Array(n * size);
      buf.set(new Uint8Array(src.buffer, src.byteOffset, n * size));
      let meta = {};
      try { meta = JSON.parse(JSON.stringify(h.meta || {})); } catch (e) {}
      // A JSON line per frame beside the bytes (the Game & Watch core's state text).
      let side = null;
      if (h.side != null) { if (!(h.side.length === n)) return null; side = Array.from(h.side, String); }
      return { kind: 'bin', n, size, delta: xorFrames(buf, size, true), side, meta };
    } catch (e) { return null; }
  }
  async function zpipe(u8, Stream) {
    const out = await new Response(new Blob([u8]).stream().pipeThrough(new Stream('deflate-raw'))).arrayBuffer();
    return new Uint8Array(out);
  }
  const canZip = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
  /* Drop the oldest `d` frames: the new first frame is rebuilt whole, the rest stay deltas. */
  function dropOldest(pre, d) {
    if (pre.kind === 'json') { pre.frames = pre.frames.slice(d); return; }
    const { size, delta } = pre;
    const first = delta.slice(0, size);
    for (let k = 1; k <= d; k++) { const o = k * size; for (let j = 0; j < size; j++) first[j] ^= delta[o + j]; }
    const next = delta.slice(d * size);
    next.set(first, 0);
    pre.delta = next; pre.n -= d;
    if (pre.side) pre.side = pre.side.slice(d);
    if (Array.isArray(pre.meta.frames) && pre.meta.frames.length === pre.n + d) pre.meta.frames = pre.meta.frames.slice(d);
  }
  async function packRewind(pre) {
    if (!pre) return null;
    const t0 = performance.now();
    for (let tries = 0; tries < 6; tries++) {
      const n = pre.kind === 'json' ? pre.frames.length : pre.n;
      if (n < 1) return null;
      const raw = pre.kind === 'json' ? new TextEncoder().encode('[' + pre.frames.join(',') + ']') : pre.delta;
      const z = canZip() ? await zpipe(raw, CompressionStream) : null;
      const bytes = z || raw;
      let side = null, sideRaw = 0;
      if (pre.side) {
        const sr = new TextEncoder().encode(JSON.stringify(pre.side));
        sideRaw = sr.byteLength;
        side = canZip() ? await zpipe(sr, CompressionStream) : sr;
      }
      const total = bytes.byteLength + (side ? side.byteLength : 0);
      if (total <= REWIND_CAP_BYTES) {
        return { v: REWIND_FORMAT, kind: pre.kind, enc: z ? 'xor+deflate-raw' : 'xor', n, size: pre.size || 0,
                 rawBytes: raw.byteLength + sideRaw, bytes, side, total, meta: pre.meta, packMs: Math.round(performance.now() - t0) };
      }
      if (n < 2) return null;
      const keep = Math.max(1, Math.min(n - 1, Math.floor(n * REWIND_CAP_BYTES / total * 0.92)));
      dropOldest(pre, n - keep);
    }
    return null;
  }
  async function unpackRewind(p) {
    if (!p || p.v !== REWIND_FORMAT || !p.bytes) return null;      // an unknown format is no history, never an error
    let raw = new Uint8Array(p.bytes);
    if (/deflate/.test(p.enc || '')) { if (!canZip()) return null; raw = await zpipe(raw, DecompressionStream); }
    if (p.kind === 'json') return { kind: 'json', n: p.n, list: JSON.parse(new TextDecoder().decode(raw)), meta: p.meta || {} };
    if (raw.byteLength !== p.n * p.size) return null;
    let side = null;
    if (p.side) {
      let sr = new Uint8Array(p.side);
      if (/deflate/.test(p.enc || '')) sr = await zpipe(sr, DecompressionStream);
      side = JSON.parse(new TextDecoder().decode(sr));
      if (!Array.isArray(side) || side.length !== p.n) return null;
    }
    return { kind: 'bin', n: p.n, size: p.size, data: xorFrames(raw, p.size, false), side, meta: p.meta || {} };
  }

  /* REMOVE DELETES (2026-10-11: "When a game save is removed
     from the Continue strip, it should be deleted. Otherwise we keep a stack in
     memory all the time.") This SUPERSEDES the 2026-10-04 rule ("Deleting is
     a strong word, dont delete anything, just mark it"), under which a removed
     game only gained `hidden: true` and kept its save and rewind history for
     good, so every removed card went on taking space.
     Removing a game's card now deletes everything the Continue row keeps for it:
       'gnw-continue' / 'games'          the record: state snapshot, thumbnail
                                         (a data URL inside the record), device,
                                         core hash, time
       'gnw-continue-rewind' / 'rewind'  its rewind history
     That is all of it: the row keeps nothing per game in localStorage, the
     vault, a server or any cache, and a card's picture is the record's own
     data URL (no blob URL to revoke). Undo (the toast, about 8 s) puts back the
     copy held in memory for that time; when the toast goes, the copy goes.
     The next close of that game after 30 s or more of play makes a new card.
     NEVER DELETED HERE, ON PURPOSE: the game's own memory and the player's own
     saves. Cartridge battery RAM, EEPROM and FDS disk writes (the Game Boy's
     cram:<slug>, the NES page's battery and disk stores, the Pokemon mini
     EEPROM) and the numbered save slots the player made (states:<slug>, the
     control bars' slots) live in each play page's own database. They are the
     game's memory and the player's explicit saves, not the Continue row's, and
     removing a Continue card must never take them.
     A record marked hidden by an older version is deleted by the orphan sweep. */
  async function deleteGame(id) {
    let rec = null, rw = null;
    try { rec = await getGame(id); } catch (e) {}
    try { rw = await txn('readonly', st => st.get(id), true); } catch (e) {}
    await txn('readwrite', st => st.delete(id));      // throws: nothing deleted, the card stays
    await dropRewinds([id]);                          // a failure here is caught by the next load's sweep
    _known.delete(id);
    return { rec, rw };
  }
  /* Undo: the deleted record and history back as they were, unless a new save
     of that game has been written meanwhile (that one is newer: it wins). */
  async function undeleteGame(d) {
    if (!d || !d.rec) return false;
    if (await getGame(d.rec.id)) return false;
    if (d.rw) { try { await txn('readwrite', st => st.put(d.rw, d.rec.id), true); } catch (e) {} }
    await txn('readwrite', st => st.put(d.rec, d.rec.id));
    know(d.rec);
    return true;
  }

  /* ORPHANS (2026-10-11): Continue data with no card, deleted once per page
     load (and callable as ContinueRow._sweepOrphans):
       - a record marked `hidden: true` (a card removed under the old "mark,
         never delete" rule) and its rewind history;
       - a rewind history whose card is gone, or older than its card or kept
         against a card that says it has none (another save's timeline, which
         getRewind would never use);
     Left alone: a history NEWER than its card, or one with no card written in
     the last minute (putGame writes the history first and the card second, so
     that is a save being written now); a record of a game on the unsupported
     list or not in the catalogue yet (it is a card, only not drawn); every
     play page's own database (battery saves and save slots). */
  const ORPHAN_GRACE_MS = 60000;
  async function sweepOrphans() {
    const out = { hiddenRecords: 0, rewinds: 0, bytes: 0 };
    let all;
    try { all = (await txn('readonly', st => st.getAll())) || []; } catch (e) { return out; }
    const hidden = all.filter(r => r && r.hidden);
    const cards = new Map(all.filter(r => r && !r.hidden).map(r => [r.id, r]));
    const size = v => { try { return v == null ? 0 : (v.byteLength != null ? v.byteLength : JSON.stringify(v).length); } catch (e) { return 0; } };
    if (hidden.length) {
      try {
        await txn('readwrite', st => { hidden.forEach(r => st.delete(r.id)); });
        hidden.forEach(r => { _known.delete(r.id); out.bytes += size(r.state) + size(r.thumb); });
        out.hiddenRecords = hidden.length;
      } catch (e) { console.warn('[continue] could not delete hidden saves:', e && e.message || e); }
    }
    try {
      const db = await rdb();
      await new Promise((res, rej) => {
        const t = db.transaction(RSTORE, 'readwrite');
        const req = t.objectStore(RSTORE).openCursor();
        const now = Date.now();
        req.onsuccess = () => {
          const cur = req.result;
          if (!cur) return;
          const v = cur.value || {}, card = cards.get(cur.key), vts = v.ts || 0;
          const orphan = card ? (vts < (card.ts || 0) || (vts === card.ts && !card.rewindBytes))
                              : !(vts > now - ORPHAN_GRACE_MS);
          if (orphan) {
            out.rewinds++;
            out.bytes += v.total || ((v.bytes ? size(v.bytes) : 0) + (v.side ? size(v.side) : 0));
            cur.delete();
          }
          cur.continue();
        };
        t.oncomplete = () => res();
        t.onerror = () => rej(t.error);
        t.onabort = () => rej(t.error);
      });
    } catch (e) { console.warn('[continue] could not sweep rewind histories:', e && e.message || e); }
    window.__continueSwept = Object.assign({ at: Date.now() }, out);
    return out;
  }

  /* THE NOT-TRACKED LIST IS GONE (2026-10-12). Removing a series card
     used to add the series to localStorage 'gnw.continueRow.untracked', which
     kept its Next Episode cards off this row, with a Restore list in Settings
     ("Hidden from Continue"). Now Remove clears the series' watch status on the
     media server instead (see "remove"), so nothing needs hiding: the list,
     its Settings section and the hidden-game Restore are removed, and the
     leftover key is deleted on load. */
  const OLD_UNTRACK_KEY = 'gnw.continueRow.untracked';
  try { localStorage.removeItem(OLD_UNTRACK_KEY); } catch (e) {}

  /* ---------------------------------------------------------- the toggle */
  function enabled() {
    try { return localStorage.getItem(PREF_KEY) !== '0'; } catch (e) { return true; }
  }
  function setEnabled(on) {
    try { localStorage.setItem(PREF_KEY, on ? '1' : '0'); } catch (e) {}
    syncButton();
    refresh();
  }
  function syncButton() {
    const on = enabled();
    document.querySelectorAll('[data-vcontinue]').forEach(b => {
      b.hidden = false;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
      b.title = b.dataset.tip || (on ? 'Hide the Continue row' : 'Show the Continue row');   // data-tip: a fixed tooltip (Systems menu icon, 2026-10-22)
    });
  }

  /* ------------------------------------------------------------ systems */
  /* One row per play window: which frame holds it (if any), how to open a
     title in it, and the label its cards carry. */
  const SYSTEMS = {
    'play-overlay':       { id: 'gnw',   frame: 'gnw-host-frame', open: id => window.openPlay ? openPlay(id) : null },
    'tft-play-overlay':   { id: 'tft',   frame: 'tft-play-frame',   open: id => window.openPlay ? openPlay(id) : null },
    'tj-play-overlay':    { id: 'tj',    frame: 'tj-play-frame',    open: id => window.openPlay ? openPlay(id) : null },
    'pm-play-overlay':    { id: 'pm',    frame: 'pm-host-frame', open: id => window.openPmPlay && openPmPlay(id) },
    'gb-play-overlay':    { id: 'gb',    frame: 'gb-play-frame',    open: id => window.openGbPlay && openGbPlay(id) },
    'nes-play-overlay':   { id: 'nes',   frame: 'nes-play-frame',   open: id => window.openNesPlay && openNesPlay(id) },
    'atari-play-overlay': { id: 'atari', frame: 'atari-play-frame', open: id => window.openAtariPlay && openAtariPlay(id) },
  };
  const overlayOf = sysId => Object.keys(SYSTEMS).find(k => SYSTEMS[k].id === sysId);
  /* The Pokemon mini in the one play host (?host=pm, play/cores/pm/site.js) is a frame in its
     overlay and takes the frame path below, like the Game Boy; its old in-page window keeps
     its own branches. Off the switch this is always false. */
  const pmHost = () => { try { return !!(window.CwPmHostSite && window.CwPmHostSite.active()); } catch (e) { return false; } };
  /* Game & Watch in the one play host (?host=gnw, play/shared/host-bridge.js): a frame in its
     overlay ('gnw-host-frame'), so it takes the frame path; the old in-page window keeps its branches. */
  const gnwHost = () => { try { return !!(window.CwUnifiedHost && CwUnifiedHost.wantsHost('gnw')); } catch (e) { return false; } };

  function unsupportedGame(id) {
    try { const U = window.CWSUnsupported; return !!(U && (U.forId(id) || U.forDevice(deviceOf(id)))); } catch (e) { return false; }
  }
  function deviceOf(id) {
    try { return (typeof ALL_DEVICES !== 'undefined' && ALL_DEVICES.find(d => d.id === id)) || null; } catch (e) { return null; }
  }
  function systemLabel(rec, d) {
    switch (rec.sys) {
      case 'gnw': case 'tft': return 'Game & Watch';
      case 'tj': return 'Game & Watch prototype';
      case 'pm': return 'Pokémon mini';
      case 'gb': return d && d.system === 'gbc' ? 'Game Boy Color' : 'Game Boy';
      case 'nes': {
        const c = (d && d.nesConsole) || 'nes';
        return c === 'famicom' ? 'Famicom' : c === 'fds' ? 'Famicom Disk System' : 'NES';
      }
      case 'atari': {
        try { const t = typeof ATARI_SYSTEMS !== 'undefined' && d && ATARI_SYSTEMS[d.catalogue]; if (t) return t.label; } catch (e) {}
        return 'Atari';
      }
    }
    return 'Game';
  }
  /* The console's own photograph: the same art key the system's tiles use. */
  function deviceArt(rec, d) {
    if (!d) return '';
    try {
      let key = d.img || '';
      if (rec.sys === 'pm' && typeof pmConsoleKey === 'function') key = pmConsoleKey(d);
      if (rec.sys === 'nes' && !key) key = 'NesConsole.png';
      if (!key) return '';
      if (typeof imgObjSrc === 'function') { const u = imgObjSrc(key); if (u) return u; }
      if (typeof imgSrc === 'function') return imgSrc(key) || '';
    } catch (e) {}
    return '';
  }

  /* A small still of a canvas, or null. A canvas handed to a worker or a GPU
     context that keeps no buffer reads as an error or as nothing -- both null. */
  function canvasThumb(cv) {
    try {
      if (!cv || !cv.width || !cv.height) return null;
      const w = Math.min(320, cv.width * 2), h = Math.round(w * cv.height / cv.width);
      const out = document.createElement('canvas');
      out.width = w; out.height = h;
      const x = out.getContext('2d');
      x.imageSmoothingEnabled = false;
      x.drawImage(cv, 0, 0, w, h);
      const px = x.getImageData(0, 0, w, h).data;
      let lit = false;
      for (let i = 0; i < px.length; i += 4 * 97) { if (px[i] | px[i + 1] | px[i + 2]) { lit = true; break; } }
      if (!lit) return null;   // an all-black grab is no picture at all
      return out.toDataURL('image/jpeg', 0.85);
    } catch (e) { return null; }
  }

  /* Bytes out of another document's realm, copied into this one, so a record
     never holds a view onto a frame that is about to be discarded. */
  /* "3 h 12 min played" (the save's own play time, when the save carries one). */
  function playedText(sec) {
    sec = Math.max(0, Math.floor(+sec || 0));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h ? h + ' h ' + m + ' min played' : m ? m + ' min played' : 'under a minute played';
  }
  function ownBytes(v) {
    if (v == null) return null;
    if (ArrayBuffer.isView(v)) {
      const out = new Uint8Array(v.byteLength);
      out.set(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
      return out;
    }
    if (Object.prototype.toString.call(v) === '[object ArrayBuffer]') return ownBytes(new Uint8Array(v));
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return null; }
  }

  /* The save API a play frame offers, or null. */
  function frameApi(win, sysId) {
    if (!win) return null;
    try {
      if (win.__continue && typeof win.__continue.ready === 'function') return win.__continue;
      if (sysId === 'nes' && win.NES) {
        const N = win.NES;
        const save = N.saveState || N.exportState || N.getState;
        const load = N.loadState || N.importState || N.restoreState;
        if (typeof save === 'function' && typeof load === 'function') {
          return {
            ready: () => !!N.running,
            /* SAVING IS NOT PLAYING (2026-10-11): `ready` above is also the play
               clock's gate, so it is false while paused, and a paused game
               closed with no state. A mounted machine can always be saved. */
            canSave: () => ('mounted' in N ? !!N.mounted : !!N.running),
            quiesce() { try { if (N.ctx && N.ctx.state === 'running') N.ctx.suspend(); } catch (e) {} },
            save: () => save.call(N),
            // Its rewind ring (play/nes/rewind.js), taken in the same turn as the save.
            history: () => (win.NES_REWIND && typeof win.NES_REWIND.exportHistory === 'function' ? win.NES_REWIND.exportHistory() : null),
            restore(rec) {
              const r = load.call(N, rec.state);
              let rewind = 0;
              const R = win.NES_REWIND;
              if (rec.rewind && R && typeof R.importHistory === 'function') { try { rewind = R.importHistory(rec.rewind, new Uint8Array(rec.state)); } catch (e) { rewind = 0; } }
              return { ok: r !== false, rewind };
            },
            // The cartridge's own battery save, written now rather than left to pagehide.
            flush: () => (typeof N.flushSave === 'function' ? N.flushSave() : null),
          };
        }
      }
      if (sysId === 'tj' && win.game && typeof win.game.serialize === 'function') {
        const g = () => win.game;
        return {
          ready: () => !!g(),
          save: () => ({ state: g().serialize() }),
          history: () => (win.__tjRewind ? win.__tjRewind.export() : null),
          restore(rec) {
            if (g().deserialize(rec.state) === false) throw new Error('Tetris Jr. refused the save');
            let rewind = 0;
            if (rec.rewind && rec.rewind.list && win.__tjRewind) { try { rewind = win.__tjRewind.import(rec.rewind.list); } catch (e) { rewind = 0; } }
            return { ok: true, rewind };
          },
        };
      }
    } catch (e) {}
    return null;
  }
  function frameWin(frameId) {
    const f = document.getElementById(frameId);
    try { const w = f && f.contentWindow; if (w) void w.document; return w || null; } catch (e) { return null; }
  }
  function normalise(r) {
    if (r == null) return null;
    if (ArrayBuffer.isView(r) || Object.prototype.toString.call(r) === '[object ArrayBuffer]') return { state: r };
    if (typeof r === 'object' && !('state' in r)) return { state: r };
    return r;
  }

  /* ------------------------------------------------------------ capture */
  let _closing = null;              // device id being captured in this turn of the event loop
  const _holds = new WeakMap();     // iframe -> promise the teardown should wait for

  /* Which title a play window holds. The Game & Watch modal keeps its own key
     (_openPlayKey, or the running machine's) rather than _openPlayDeviceId. */
  function currentDeviceId(overlayId) {
    try {
      if (overlayId === 'play-overlay') {
        let key = typeof _openPlayKey !== 'undefined' ? _openPlayKey : null;
        if (!key) { const st = window.gnwSaveState && window.gnwSaveState(); key = st && st.key; }
        return key && typeof deviceIdForGameKey === 'function' ? deviceIdForGameKey(key) : null;
      }
      return typeof _openPlayDeviceId !== 'undefined' ? _openPlayDeviceId : null;
    } catch (e) { return null; }
  }

  /* ---------------------------------------------------- the record of play
     GAME SESSIONS ARE RECORDED (7 Nov 2026: "Yes add the history of games recording in this
     version"). One record for each session of 30 seconds or more of real play, in a database of
     its own, so nothing that looks after Continue touches it: not Remove, not the 40-game cap, not
     the orphan sweep, not deleting saves. NOTHING PRUNES IT, and there is no way to clear it.
       { sid, id, sha256, title, sys, version, machine, started, played, v: 1 }
     played is ms of real play: the Continue clock's time, less anything after a cheat came on (play
     time's rule of 26 Oct, index.html). Device, address, inputs, cheats and game bytes are never in it.
     THE RECORD IS WRITTEN WHILE THE GAME IS OPEN: at 30 s, each minute after, on a hidden page and
     on close. One session keeps one sid, so these writes are one record whose played grows; a sid is
     never reused. An IndexedDB write still open as a page goes away is not kept (play/host/saves.mjs),
     so each record goes first to a small localStorage note, taken off once the database has it and
     read back on the next load. A failure is silent: no storage, no record, and the game never waits.
     Films and shows are not here: Emby and Jellyfin hold those. */
  const HDB = 'cw-play-history', HSTORE = 'sessions';
  const HNOTE = 'cw.playHistory.pending.';
  const HISTORY_EVERY_MS = 60000;
  let _hdbp = null;
  function hdb() {
    if (_hdbp) return _hdbp;
    _hdbp = new Promise((res, rej) => {
      let r;
      try { r = indexedDB.open(HDB, 1); } catch (e) { rej(e); return; }
      r.onupgradeneeded = () => { try { r.result.createObjectStore(HSTORE, { keyPath: 'sid' }).createIndex('started', 'started'); } catch (e) {} };
      r.onsuccess = () => { const db = r.result; db.onclose = () => { _hdbp = null; }; res(db); };
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error('blocked'));
    }).catch(e => { _hdbp = null; throw e; });
    return _hdbp;
  }
  function newSid() {
    try {
      const a = new Uint8Array(16);
      crypto.getRandomValues(a);     // not randomUUID: that needs HTTPS, and the TV may be on plain HTTP
      return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) { return Date.now().toString(16) + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2); }
  }
  /* The larger played wins, so an old note read back late never shortens a record. */
  async function historyPut(rec) {
    const db = await hdb();
    return new Promise((res, rej) => {
      const t = db.transaction(HSTORE, 'readwrite'), st = t.objectStore(HSTORE), g = st.get(rec.sid);
      g.onsuccess = () => { if (!g.result || !(g.result.played > rec.played)) st.put(rec); };
      t.oncomplete = () => res();
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  }
  function historyNoteDone(key, text) {
    try { if (localStorage.getItem(key) === text) localStorage.removeItem(key); } catch (e) {}
  }
  function historyKeep(rec) {
    const key = HNOTE + rec.sid, text = JSON.stringify(rec);
    try { localStorage.setItem(key, text); } catch (e) {}
    historyPut(rec).then(() => historyNoteDone(key, text), () => {});
  }
  /* Notes a page left behind go into the database. A read does this first, so it sees everything. */
  function historyDrain() {
    const jobs = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || key.indexOf(HNOTE) !== 0) continue;
        const text = localStorage.getItem(key);
        let rec = null;
        try { rec = JSON.parse(text); } catch (e) {}
        if (rec && rec.sid && rec.v) jobs.push(historyPut(rec).then(() => historyNoteDone(key, text), () => {}));
        else jobs.push(Promise.resolve().then(() => historyNoteDone(key, text)));
      }
    } catch (e) {}
    return Promise.all(jobs);
  }
  /* What the window holds, read once, as soon as its game is running: the frame is the right one
     then and may be gone by the time the session ends. Cheap, and no save routine. */
  function historyLook(overlayId, s) {
    try {
      const win = frameWin(SYSTEMS[overlayId].frame), H = win && win.__cwHost;
      if (!H || H.state !== 'running') return;   // a page still loading counts as open, before it has a game
      s.looked = true;
      if (typeof H.sha256 === 'string') s.sha256 = H.sha256;
      // The machine it really ran on: a Game Boy game can play on the Color.
      if (SYSTEMS[overlayId].id === 'gb' && H.model) s.machine = H.model === 'cgb' ? 'Game Boy Color' : 'Game Boy';
    } catch (e) {}
  }
  function historySave(overlayId, s) {
    try {
      if (!s || s.real < MIN_PLAY_MS || s.real === s.kept) return;
      // A file opened from this computer has no id here, as with Continue and play time (play-file.js).
      const id = overlayId === 'play-overlay' && typeof deviceIdForGameKey === 'function' ? deviceIdForGameKey(s.dev) : s.dev;
      if (!id) return;
      const sysId = SYSTEMS[overlayId].id, d = deviceOf(id);
      let version = null;
      try { version = (window.Variants && window.Variants.cardLabel(id)) || null; } catch (e) {}
      s.kept = s.real;
      historyKeep({ sid: s.sid, id, sha256: s.sha256 || null, title: (d && d.name) || String(id), sys: sysId, version,
        machine: s.machine || systemLabel({ sys: sysId }, d), started: s.started, played: Math.round(s.real), v: 1 });
    } catch (e) {}
  }
  function historySaveOpen() {
    for (const overlayId of Object.keys(_sess)) historySave(overlayId, _sess[overlayId]);
  }
  /* For the panel and the sync that come later; nothing on screen reads these yet. Oldest first. */
  async function historyRead(ask, none) {
    try {
      await historyDrain();
      const db = await hdb();
      return await new Promise((res, rej) => {
        const r = ask(db.transaction(HSTORE, 'readonly').objectStore(HSTORE));
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    } catch (e) { return none; }
  }
  window.CwPlayHistory = {
    all: () => historyRead(st => st.index('started').getAll(), []),
    since: startedAfterMs => historyRead(st => st.index('started').getAll(IDBKeyRange.lowerBound(+startedAfterMs || 0, true)), []),
    count: () => historyRead(st => st.count(), 0),
  };

  /* ---------------------------------------------------------- play clock
     How long each open play window has really been PLAYED this session (the
     30-second rule above). Sampled every SAMPLE_MS and on every visibility
     change; the time since the last sample counts only if the window was
     playing AT that sample, so a pause or a hidden tab stops the count at
     once. A session starts when a window opens or changes title and ends when
     it closes. The clock is swappable for tests (ContinueRow._playClock). */
  const SAMPLE_MS = 250;
  const MAX_STEP_MS = 2000;         // a stalled timer (a sleeping laptop) never counts as play
  let _clock = () => performance.now();
  const _sess = Object.create(null);   // overlay id -> { dev, ms, last, on }
  const PAUSE_BTNS = '#btnPause[aria-pressed="true"], #twin-pause[aria-pressed="true"], #tj-pause[aria-pressed="true"]';

  /* Cheap: runs four times a second. Never calls a save routine. */
  function sessionKey(overlayId) {
    try {
      if (overlayId === 'play-overlay') return typeof _openPlayKey !== 'undefined' ? _openPlayKey : null;
      return typeof _openPlayDeviceId !== 'undefined' ? _openPlayDeviceId : null;
    } catch (e) { return null; }
  }
  function playingNow(overlayId) {
    try {
      if (document.hidden) return false;
      const ov = document.getElementById(overlayId);
      if (!ov || !ov.classList.contains('open')) return false;
      // keys.js's pause menu (Back in a game) holds whichever window it is over.
      if (window.GnwKeys && typeof GnwKeys.pausedWindow === 'function' && GnwKeys.pausedWindow()) return false;
      const sys = SYSTEMS[overlayId];
      if (sys.id === 'gnw' && !gnwHost()) {
        // Its boot demo is not play; the first real input ends it (gnw-host.js).
        if (!(window.gnwIsActivelyPlaying && window.gnwIsActivelyPlaying())) return false;
        const b = document.getElementById('play-pause-toggle');
        return !(b && b.getAttribute('aria-pressed') === 'true');
      }
      if (sys.id === 'pm' && !pmHost()) {
        const dev = typeof _pmActiveDevice !== 'undefined' ? _pmActiveDevice : null;
        return !!(dev && dev._running);
      }
      const win = frameWin(sys.frame);
      if (!win || win.location.href === 'about:blank') return false;
      const d = win.document;
      if (!d || !d.body) return false;
      if (d.querySelector('.tap-to-play:not(.gone)')) return false;        // a colour twin before "Insert batteries"
      if (d.querySelector(PAUSE_BTNS) || d.body.classList.contains('paused')) return false;
      const api = frameApi(win, sys.id);
      if (api) { try { if (!api.ready()) return false; } catch (e) { return false; } }   // loading, or held (Atari / NES running flag)
      return true;
    } catch (e) { return false; }
  }
  function samplePlay() {
    const t = _clock();
    for (const overlayId of Object.keys(SYSTEMS)) {
      const ov = document.getElementById(overlayId);
      if (!ov || !ov.classList.contains('open')) { historySave(overlayId, _sess[overlayId]); delete _sess[overlayId]; continue; }
      const dev = sessionKey(overlayId);
      let s = _sess[overlayId];
      if (!s || s.dev !== dev) {
        historySave(overlayId, s);
        s = _sess[overlayId] = { dev, ms: 0, last: t, on: false, origin: originOf(overlayId), sid: newSid(), started: Date.now(), real: 0, kept: 0 };
      }
      if (s.on) {
        const step = Math.max(0, Math.min(t - s.last, MAX_STEP_MS));
        s.ms += step;
        if (ov.dataset.cheated !== '1') s.real += step;
      }
      s.last = t;
      s.on = playingNow(overlayId);
      if (s.on && !s.looked) historyLook(overlayId, s);
      if (s.real >= MIN_PLAY_MS && (!s.kept || s.real - s.kept >= HISTORY_EVERY_MS)) historySave(overlayId, s);
    }
  }
  /* WHERE THIS SESSION CAME FROM (decided 2026-10-07, see MIN_PLAY_MS):
     'card' -- launched from its Continue card, resuming that save; 'fresh' --
     a cold boot from a tile, the drawer, search or anywhere else. Fixed when
     the session starts. A VARIANT SWITCH mid-session (another file in the
     same window) starts a new session, and it is 'fresh': the card resumed the
     other variant's save, and this file is a cold boot. */
  function originOf(overlayId) {
    const r = _relaunch;
    return r && r.ov === overlayId && r.id === currentDeviceId(overlayId) ? 'card' : 'fresh';
  }
  function playedMs(overlayId) {
    samplePlay();
    const s = _sess[overlayId];
    return s ? s.ms : 0;
  }
  setInterval(samplePlay, SAMPLE_MS);
  document.addEventListener('visibilitychange', samplePlay);
  /* The record of play: a hidden page may never come back. The same two moments as play time. */
  document.addEventListener('visibilitychange', () => { if (document.hidden) historySaveOpen(); });
  window.addEventListener('pagehide', () => { samplePlay(); historySaveOpen(); });

  function onPlayClose(overlayId, deviceId) {
    try {
      const sys = SYSTEMS[overlayId];
      deviceId = deviceId || currentDeviceId(overlayId);
      if (!sys || !deviceId) return;
      // The wrappers below and closeOverlay() both call this for one close; the
      // first one, which still has a live machine, is the one that counts.
      if (_closing === deviceId) return;
      _closing = deviceId;
      setTimeout(() => { if (_closing === deviceId) _closing = null; }, 0);

      /* THE 30-SECOND RULE, 2026-10-07 form. 30 s or more of play always saves.
         Under 30 s saves only a CARD session (MIN_PLAY_MS), and then never
         over its save with something that is not progress:
           - no real play at all this visit (an untouched boot, a demo): nothing;
           - a relaunch from its card whose restore has not landed yet: nothing
             (the machine is still showing a fresh boot);
           - no state could be taken: nothing (see keep below; a colour twin,
             which has no state to take, keeps its card as it was).
         A new session under 30 s writes nothing ('first-peek' with no entry,
         'fresh-under-30s' with one: that save is left exactly as it was).
         Whatever is decided, the game's own battery save is still flushed:
         that is the cartridge, not this row. */
      const played = playedMs(overlayId);
      const sess = _sess[overlayId];
      historySave(overlayId, sess);
      delete _sess[overlayId];
      const long = played >= MIN_PLAY_MS;
      const prior = _known.get(deviceId) || null;
      const relaunch = _relaunch && _relaunch.ov === overlayId ? _relaunch : null;
      if (relaunch) _relaunch = null;
      const origin = sess && sess.origin ? sess.origin : (relaunch && relaunch.id === deviceId ? 'card' : 'fresh');
      let skip = null;
      if (!long) {
        if (origin !== 'card') skip = prior ? 'fresh-under-30s' : 'first-peek';
        else if (!(played > 0)) skip = 'no-play';
        else if (!(relaunch && relaunch.id === deviceId && relaunch.restored)) skip = 'restore-pending';
      }
      /* NO GAME, NO SAVE (4 Nov 2026: a Game & Watch is saved only once Game A or Game B started a
         game, else it would only save the demo). A machine that says no game is running now (the
         play host's started(): Game & Watch, Tetris Jr., the colour units) keeps nothing, however
         long it ran; a save already on its card stays as it was. */
      if (!skip && sys.frame) {
        try {
          const a = frameApi(frameWin(sys.frame), sys.id);
          if (a && typeof a.started === 'function' && !a.started()) skip = 'no-game-started';
        } catch (e) {}
      }
      if (!autoSaveOnExit()) skip = 'auto-save-off';   // Settings: Auto save on exit is off (9 Nov 2026)
      if (skip) {
        window.__continueLastClose = { id: deviceId, origin, playedMs: Math.round(played), saved: false, reason: skip, at: Date.now() };
        if (sys.frame) {
          try {
            const api = frameApi(frameWin(sys.frame), sys.id);
            if (api && api.quiesce) api.quiesce();
            const f = api && api.flush ? api.flush() : null;
            const frame = document.getElementById(sys.frame);
            if (f && typeof f.then === 'function' && frame) _holds.set(frame, Promise.race([Promise.resolve(f).catch(() => {}), new Promise(r => setTimeout(r, HOLD_MS))]));
          } catch (e) {}
        }
        return;
      }
      window.__continueLastClose = { id: deviceId, origin, playedMs: Math.round(played), saved: true,
        reason: long ? 'played' : 'card-session', hiddenKept: !long && !!(prior && prior.hidden), at: Date.now() };

      const rec = { id: deviceId, sys: sys.id, ts: Date.now(), state: null, thumb: null };
      let pre = null;               // this close's rewind history (takeRewind), taken with the state
      /* Write the card and its history. Under 30 s the store is asked again:
         no entry means nothing is written; a hidden one stays hidden. */
      const keep = r => (async () => {
        if (!long) {
          if (r.state == null) { window.__continueLastClose = Object.assign({}, window.__continueLastClose, { saved: false, reason: 'no-state' }); return; }
          const cur = await getGame(r.id);
          if (!cur) { window.__continueLastClose = Object.assign({}, window.__continueLastClose, { saved: false, reason: 'first-peek' }); return; }
          if (cur.hidden) r.hidden = true;
        }
        let rw = null;
        try { rw = await packRewind(pre); } catch (e) { rw = null; }
        pre = null;
        const ok = await putGame(r, rw);
        window.__continueLastSave = { id: r.id, ok, at: Date.now(), playedMs: Math.round(played), short: !long, hidden: !!r.hidden,
          stateBytes: r.state && r.state.byteLength != null ? r.state.byteLength : (r.state ? JSON.stringify(r.state).length : 0),
          rewind: rw ? { frames: rw.n, frameBytes: rw.size, rawBytes: rw.rawBytes, bytes: rw.total || rw.bytes.byteLength, enc: rw.enc, packMs: rw.packMs } : null };
        refresh();
      })().catch(e => console.warn('[continue] could not keep the save:', e && e.message || e));

      if (sys.id === 'gnw' && !gnwHost()) {
        let st = null;
        try { st = window.gnwSaveState ? window.gnwSaveState() : null; } catch (e) {}
        rec.state = ownBytes(st);
        try { pre = takeRewind(window.gnwRewindExport ? window.gnwRewindExport() : null); } catch (e) { pre = null; }
        if (!st || typeof window.gnwRenderSaveThumb !== 'function') { keep(rec); return; }
        let done = false;
        const fin = u => { if (done) return; done = true; rec.thumb = u || null; keep(rec); };
        setTimeout(() => fin(null), HOLD_MS);
        try { window.gnwRenderSaveThumb(fin); } catch (e) { fin(null); }
        return;
      }

      if (sys.id === 'pm' && !pmHost()) {
        try {
          const dev = typeof _pmActiveDevice !== 'undefined' ? _pmActiveDevice : null;
          const X = dev && dev.exp;
          if (X && typeof X.pm_state_ptr === 'function' && typeof X.pm_state_size === 'function') {
            const n = X.pm_state_size();
            rec.state = new Uint8Array(new Uint8Array(X.memory.buffer, X.pm_state_ptr(), n));
            rec.thumb = canvasThumb(dev.canvas);
            try { pre = takeRewind(pmRingExport(dev, n)); } catch (e) { pre = null; }
          }
        } catch (e) { rec.state = null; }
        keep(rec);
        return;
      }

      // An iframe play window.
      const frame = document.getElementById(sys.frame);
      const win = frameWin(sys.frame);
      const api = frameApi(win, sys.id);
      let ready = false;
      try { ready = !!(api && (api.canSave ? api.canSave() : api.ready())); } catch (e) {}
      try { if (win) rec.thumb = canvasThumb(win.document.querySelector('canvas#screen, canvas#lcd, canvas')); } catch (e) {}
      let out = null;
      if (ready) {
        try { out = api.save(); } catch (e) { console.warn('[continue] save failed:', e && e.message || e); }
        // A synchronous history (NES, Tetris Jr.) is taken in the same turn as the state.
        if (api.history) { try { pre = takeRewind(api.history()); } catch (e) { pre = null; } }
      }
      try { if (api && api.quiesce) api.quiesce(); } catch (e) {}
      let flushed = null;
      try { flushed = api && api.flush ? api.flush() : null; } catch (e) {}
      if (flushed && typeof flushed.then === 'function') {
        const o = out;
        out = Promise.resolve(flushed).catch(() => {}).then(() => o);
      }
      const finish = r => {
        r = normalise(r);
        if (r) {
          rec.state = ownBytes(r.state);
          if (r.thumb && typeof r.thumb === 'string') rec.thumb = r.thumb;
          if (r.device) rec.device = String(r.device);
          if (r.core) rec.core = String(r.core);
          // The play time the host put in the save's metadata (the common save format, 2026-10-18).
          if (r.playSeconds != null && isFinite(r.playSeconds)) rec.playSeconds = Math.max(0, Math.floor(+r.playSeconds));
          // A history handed over with the save (the Game Boy's): copied out of the frame now.
          if (r.rewind && !pre) pre = takeRewind(r.rewind);
        }
        // Everything is in this realm now: the frame need not wait for the deflate and the write.
        keep(rec);
        return null;
      };
      if (out && typeof out.then === 'function') {
        const p = Promise.resolve(out).then(finish, e => { console.warn('[continue] save failed:', e && e.message || e); keep(rec); return null; });
        if (frame) _holds.set(frame, Promise.race([p.catch(() => {}), new Promise(r => setTimeout(r, HOLD_MS))]));
      } else {
        finish(out);
      }
    } catch (e) {
      console.warn('[continue] capture failed:', e && e.message || e);
    }
  }
  /* closeOverlay() asks before it discards a play frame. A promise means "wait
     for this, then discard"; null means "discard now". */
  function frameHold(frame) {
    const p = frame && _holds.get(frame);
    if (p) _holds.delete(frame);
    return p || null;
  }

  /* closePlayModal and closePmPlay stop their machine BEFORE they reach
     closeOverlay(), so the save has to be taken on the way in. */
  function wrapCloser(name, overlayId) {
    const orig = window[name];
    if (typeof orig !== 'function' || orig.__continueWrapped) return;
    const w = function () { onPlayClose(overlayId, currentDeviceId(overlayId)); return orig.apply(this, arguments); };
    w.__continueWrapped = true;
    window[name] = w;
  }

  /* The Pokemon mini's rewind ring is the device's own (pm-embed.js): a fixed
     array of state-sized slots, a head and a count, read and refilled here
     rather than through an export of its own. Oldest slot first.
     Its meta says how it is paced, for the record only (nothing reads it back):
     by EMULATED time, one state every `everyCycles` CPU cycles at 4 MHz, a
     spacing that doubles each time the full ring is thinned (pm-embed.js,
     PM_REWIND_EVERY .. PM_REWIND_MAX_EVERY). It was { everyFrames: 20 } when the
     ring was paced by drawn frames. (site regress, 2026-10-08) */
  function pmRingExport(dev, n) {
    const ring = dev && dev._rewind, cap = ring ? ring.length : 0, count = dev ? dev._rewindCount | 0 : 0;
    if (!cap || !count) return null;
    const data = new Uint8Array(count * n);
    for (let i = 0; i < count; i++) {
      const s = ring[(dev._rewindHead - count + i + cap * 2) % cap];
      if (!s || s.length !== n) return null;
      data.set(s, i * n);
    }
    return { n: count, size: n, data, meta: { pacedBy: 'emulated-cycles', everyCycles: dev._rewindEvery || null, cpuHz: 4000000 } };
  }
  function pmRingImport(dev, h, n) {
    if (!dev || !h || h.kind !== 'bin' || h.size !== n || typeof dev._ensureRewind !== 'function') return 0;
    dev._ensureRewind();
    const ring = dev._rewind, cap = ring.length;
    let k = 0;
    for (let i = Math.max(0, h.n - cap); i < h.n; i++, k++) ring[k].set(h.data.subarray(i * n, (i + 1) * n));
    dev._rewindHead = k % cap;
    dev._rewindCount = k;
    dev._rewindCtr = 0;
    return k;
  }

  /* ------------------------------------------------------------ restore */
  function restoreApi(rec) {
    if (rec.sys === 'gnw' && !gnwHost()) {
      return {
        ready() { const s = window.gnwSaveState && window.gnwSaveState(); return !!(s && (!rec.state || !rec.state.key || s.key === rec.state.key)); },
        restore(h) {
          if (!window.gnwLoadState(rec.state)) throw new Error('nothing to load into');
          // A restored save is the player's game: stop the attract demo (gnw-host.js's hook; _emu
          // itself is private to that file, so the old typeof _emu test never ran).
          try { if (window.gnwStopAttract) window.gnwStopAttract(); } catch (e) {}
          let rewind = 0;
          if (h && h.kind === 'bin' && window.gnwRewindImport) { try { rewind = window.gnwRewindImport(h); } catch (e) { rewind = 0; } }
          return { ok: true, rewind };
        },
        readBack() { const s = window.gnwSaveState(); return s && { cpu: s.cpu }; },
        expected: () => ({ cpu: rec.state.cpu }),
      };
    }
    if (rec.sys === 'pm' && !pmHost()) {
      let readyAt = 0;
      const pre = () => !!(_pmResume && _pmResume.applied && _pmResume.id === rec.id);
      return {
        ready() {
          const dev = typeof _pmActiveDevice !== 'undefined' ? _pmActiveDevice : null;
          const X = dev && dev.exp;
          if (pre()) return !!X;                    // already in place before the first frame

          if (!X || !dev._running) { readyAt = 0; return false; }
          const slotIn = typeof PM_SLOTIN_FRAMES !== 'undefined' ? PM_SLOTIN_FRAMES : 120;
          if (Number(X.pm_prc_frame_count()) < slotIn) return false;
          // The snap to the main screen loads its boot state just after the
          // slot-in; give it time so it does not land on top of the restore.
          if (!readyAt) readyAt = Date.now() + 900;
          return Date.now() >= readyAt;
        },
        restore(h) {
          const X = _pmActiveDevice.exp, n = X.pm_state_size(), st = new Uint8Array(rec.state);
          if (st.length !== n) throw new Error('this save does not fit this core');
          if (pre()) { this._pre = true; _pmResume = null; }   // the launcher put it in place; only the history is left
          else new Uint8Array(X.memory.buffer, X.pm_state_ptr(), n).set(st);
          let rewind = 0;
          try { rewind = pmRingImport(_pmActiveDevice, h, n); } catch (e) { rewind = 0; }
          return { ok: true, rewind };
        },
        // After a launcher restore frames have already run, so there is nothing to compare.
        readBack() { if (this._pre) return undefined; const X = _pmActiveDevice.exp; return new Uint8Array(X.memory.buffer, X.pm_state_ptr(), X.pm_state_size()); },
      };
    }
    const sys = SYSTEMS[overlayOf(rec.sys)];
    return {
      ready() { const a = frameApi(frameWin(sys.frame), rec.sys); try { return !!(a && a.ready()); } catch (e) { return false; } },
      // The system's restore reads the unpacked history from rec.rewind (a copy: the card's record is untouched).
      restore(h) { return frameApi(frameWin(sys.frame), rec.sys).restore(h ? Object.assign({}, rec, { rewind: h }) : rec); },
      readBack() {
        const r = frameApi(frameWin(sys.frame), rec.sys).save();
        if (r && typeof r.then === 'function') return undefined;     // asynchronous: not checked here
        const n = normalise(r);
        return n ? n.state : null;
      },
    };
  }

  /* `words` is how many aligned 32-bit words may differ. The Atari cores'
     state carries text pointers that a load replaces by design (INTERFACE.md
     "Save states": "the only pointer inside is a text address, which a load
     replaces"; the 7800 has two) -- measured 2026-10-04 as exactly 1 / 2 / 1
     differing words on the 2600 / 7800 / Lynx, against 0 for save-then-save. */
  function same(a, b, words = 0) {
    if (a == null || b == null) return false;
    if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
      if (!ArrayBuffer.isView(a) || !ArrayBuffer.isView(b) || a.byteLength !== b.byteLength) return false;
      const x = new Uint8Array(a.buffer, a.byteOffset, a.byteLength), y = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
      let bad = 0, last = -1;
      for (let i = 0; i < x.length; i++) {
        if (x[i] === y[i]) continue;
        const w = i >> 2;
        if (w !== last) { last = w; if (++bad > words) return false; }
      }
      return true;
    }
    try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; }
  }

  let _restoring = 0;
  /* POKEMON MINI: THE SAVE GOES IN BEFORE THE FIRST FRAME (2026-10-11). The
     generic relaunch below waits for a running machine and then restores, which
     on the Pokemon mini meant ~3 s of slot-in animation and main screen before
     the saved game appeared. Instead the card's state is handed to the launcher:
     index.html's _pmLaunchCart calls pmResume(id, dev) the moment the device is
     mounted, before its first frame, and skips the slot-in. The relaunch then
     only adds the rewind history. Valid only for the relaunch that set it. */
  let _pmResume = null;             // { id, state, applied }
  function pmResume(id, dev) {
    const p = _pmResume;
    if (!p || p.applied || p.id !== id || !_relaunch || _relaunch.id !== id) return false;
    const X = dev && dev.exp;
    if (!X || typeof X.pm_state_ptr !== 'function') return false;
    const n = X.pm_state_size(), st = new Uint8Array(p.state);
    if (st.length !== n) return false;            // does not fit: the normal boot, and the old path refuses it
    new Uint8Array(X.memory.buffer, X.pm_state_ptr(), n).set(st);
    p.applied = true;
    return true;
  }
  /* The window a card relaunched, until its restore lands (`restored`). A
     close under 30 s before then must not save: the machine is still showing a
     fresh boot, not the player's game (see onPlayClose). */
  let _relaunch = null;
  async function openGame(id) {
    const rec = await getGame(id);
    if (!rec) return;
    const ovId = overlayOf(rec.sys), sys = SYSTEMS[ovId];
    if (!sys) return;
    /* The history is unpacked while the machine comes up; a failure is no history, never no game. */
    const hist = rec.state != null && rec.rewindBytes ? getRewind(rec).then(unpackRewind).catch(() => null) : Promise.resolve(null);
    _pmResume = rec.sys === 'pm' && rec.state != null ? { id: rec.id, state: rec.state, applied: false } : null;
    if (_pmResume) _relaunch = { id: rec.id, ov: ovId, restored: false };   // set before the launcher can ask
    try { sys.open(rec.id); } catch (e) { console.warn('[continue] could not open', rec.id, e); return; }
    if (rec.state == null) return;                 // relaunch only
    const relaunch = _relaunch = (_pmResume && _relaunch && _relaunch.id === rec.id) ? _relaunch : { id: rec.id, ov: ovId, restored: false };
    historySave(ovId, _sess[ovId]);
    delete _sess[ovId];                            // the session starts again, as a 'card' one (originOf)
    const token = ++_restoring;
    const api = restoreApi(rec);
    const until = Date.now() + RESTORE_WAIT_MS;
    let seenOpen = false;
    const step = async () => {
      if (token !== _restoring) return;            // another launch superseded this one
      const ov = document.getElementById(ovId);
      const open = !!(ov && ov.classList.contains('open'));
      if (open) seenOpen = true;
      else if (seenOpen) return;                   // closed before it came up
      if (Date.now() > until) { console.warn('[continue] the machine did not come up in time; not restored'); return; }
      let ok = false;
      try { ok = api.ready(); } catch (e) {}
      if (!ok) { setTimeout(step, 150); return; }
      try {
        let h = null;
        try { h = await hist; } catch (e) { h = null; }
        if (token !== _restoring) return;
        const res = await api.restore(h);
        relaunch.restored = true;
        const rewind = res && typeof res === 'object' && 'rewind' in res ? res.rewind | 0 : 0;
        /* READ IT BACK. Where the save is synchronous, the state is taken again in
           the same turn as the restore -- before a single frame runs -- and must
           match what was kept. A mismatch is said, not swallowed. */
        let exact;
        try {
          if (api.readBack) {
            const back = api.readBack();
            if (back !== undefined) exact = same(back, api.expected ? api.expected() : rec.state, rec.sys === 'atari' ? 2 : 0);
          }
        } catch (e) { exact = false; }
        if (exact === false) console.warn('[continue] restored state does not read back as saved:', rec.id);
        window.__continueRestored = { id: rec.id, ts: rec.ts, at: Date.now(), exact,
          rewind: { stored: rec.rewindFrames || 0, unpacked: h ? h.n : 0, loaded: rewind } };
      } catch (e) {
        console.warn('[continue] restore refused:', e && e.message || e);
        window.__continueRestored = { id: rec.id, error: String(e && e.message || e), at: Date.now() };
      }
    };
    setTimeout(step, 150);
  }

  /* -------------------------------------------------------------- video */
  /* WHEN IT WAS LAST PLAYED (2 Nov: "If I play a movie that I played before, it moves to the
     top of the movies, not first on Continue"). Films and games share one row, newest first,
     so every film needs the time the server last saw it played. Two things took it away:
       - Emby (4.8 on) leaves LastPlayedDate out of a list unless the list asks for it by
         name in Fields (UserDataLastPlayedDate; a single item still carries it). Every film
         then counted as never played and sat behind every game, in the server's own order.
         PLAYED_FIELD is added to each list call below. Jellyfin always sends it and is not
         sent the Emby name.
       - Both servers keep the time in UTC, but a server can write it without a zone mark
         ("...T10:00:00.1234567"), which a browser reads as local time, hours early east of
         Greenwich. A time with no zone mark is read as UTC. */
  const ts = s => {
    if (!s) return 0;
    s = String(s);
    const z = /([zZ]|[+-]\d\d:?\d\d)$/.test(s) || !/T\d/.test(s) ? s : s + 'Z';
    const t = Date.parse(z);
    return isFinite(t) ? t : 0;
  };
  const playedField = A => { try { return A && A.serverType && A.serverType() === 'jellyfin' ? '' : ',UserDataLastPlayedDate'; } catch (e) { return ',UserDataLastPlayedDate'; } };
  async function fetchVideo() {
    const E = window.Emby;
    if (!E || !E.session || !E.session.active || !E.subsApi) return [];
    const A = E.subsApi, uid = A.userId();
    const PLAYED_FIELD = playedField(A);
    const fields = (E.FIELDS || 'UserData,RunTimeTicks') + PLAYED_FIELD;
    const imgs = E.IMAGE_TYPES || 'Primary,Backdrop,Thumb';
    const [res, next, played] = await Promise.allSettled([
      A.get(`/Users/${uid}/Items/Resume`, { MediaTypes: 'Video', Recursive: true, Limit: 24, Fields: fields, EnableImageTypes: imgs }),
      A.get('/Shows/NextUp', { UserId: uid, Limit: 24, Fields: fields, EnableImageTypes: imgs }),
      /* Only the order of the Next Episode cards depends on this whole-library list, so it is a
         background read (28 Oct): 45 s and not asked again. With the default 12 s cut
         and four more tries, a server on slow disks got it five times over, each kept running
         after the page gave up, ahead of the page's own first titles (measured on a stand-in). */
      (A.request ? A.request('GET', `/Users/${uid}/Items`, { timeout: 45000, retries: 0, params: { Recursive: true, IncludeItemTypes: 'Episode', Filters: 'IsPlayed',
        SortBy: 'DatePlayed', SortOrder: 'Descending', Limit: 300, Fields: 'UserData' + PLAYED_FIELD, EnableImages: false } }) : A.get(`/Users/${uid}/Items`, { Recursive: true, IncludeItemTypes: 'Episode', Filters: 'IsPlayed',
        SortBy: 'DatePlayed', SortOrder: 'Descending', Limit: 300, Fields: 'UserData' + PLAYED_FIELD, EnableImages: false })),
    ]);
    const items = r => (r.status === 'fulfilled' && r.value && (Array.isArray(r.value) ? r.value : r.value.Items)) || [];
    /* THE TYPE COMES FROM THE DATA, not from which call returned the item
       (2026-10-04: an unplayed next episode is "Next Episode", not
       "Continue Watching"). A resume position means Continue Watching; an
       episode with none is the Next Episode of its series. */
    const resumable = it => ((it.UserData || {}).PlaybackPositionTicks || 0) > 0;
    const lastBySeries = new Map();
    for (const ep of items(played)) {
      const t = ts(ep.UserData && ep.UserData.LastPlayedDate);
      if (ep.SeriesId && t > (lastBySeries.get(ep.SeriesId) || 0)) lastBySeries.set(ep.SeriesId, t);
    }
    const out = [];
    const ids = new Set();
    const resumeSeries = new Set();
    const nextOf = it => ({ kind: 'next', key: 'n:' + it.Id, ts: lastBySeries.get(it.SeriesId) || ts((it.UserData || {}).LastPlayedDate), item: it });
    for (const it of items(res)) {
      ids.add(it.Id);
      if (resumable(it) || !it.SeriesId) {
        if (it.SeriesId) resumeSeries.add(it.SeriesId);
        out.push({ kind: 'watch', key: 'v:' + it.Id, ts: ts((it.UserData || {}).LastPlayedDate), item: it });
      } else {
        resumeSeries.add(it.SeriesId);
        out.push(nextOf(it));
      }
    }
    const seen = new Set();
    for (const it of items(next)) {
      if (!it.SeriesId || ids.has(it.Id) || resumeSeries.has(it.SeriesId) || seen.has(it.SeriesId)) continue;
      seen.add(it.SeriesId);
      if (resumable(it)) out.push({ kind: 'watch', key: 'v:' + it.Id, ts: ts((it.UserData || {}).LastPlayedDate), item: it });
      else out.push(nextOf(it));
    }
    return out;
  }
  function videoArt(it) {
    const I = window.Emby && window.Emby.imageUrl;
    if (!I) return '';
    const h = { maxHeight: 192 };
    const tg = it.ImageTags || {};
    if (it.Type === 'Episode') {
      return I(it.Id, 'Primary', Object.assign({ tag: tg.Primary }, h))
          || I(it.ParentThumbItemId, 'Thumb', Object.assign({ tag: it.ParentThumbImageTag }, h))
          || I(it.ParentBackdropItemId, 'Backdrop', Object.assign({ tag: (it.ParentBackdropImageTags || [])[0] }, h))
          || I(it.SeriesId, 'Primary', Object.assign({ tag: it.SeriesPrimaryImageTag }, h)) || '';
    }
    return I(it.Id, 'Thumb', Object.assign({ tag: tg.Thumb }, h))
        || I(it.Id, 'Backdrop', Object.assign({ tag: (it.BackdropImageTags || [])[0] }, h))
        || I(it.Id, 'Primary', Object.assign({ tag: tg.Primary }, h)) || '';
  }

  /* ------------------------------------------------------------- render */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function ago(t) {
    if (!t) return '';
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    const d = Math.round(s / 86400);
    return d < 30 ? d + ' d ago' : new Date(t).toLocaleDateString();
  }
  const epCode = it => (it.ParentIndexNumber != null && it.IndexNumber != null) ? `S${it.ParentIndexNumber}:E${it.IndexNumber}` : '';

  /* The three card types, exactly one per card (2026-10-04). */
  const KIND_LABEL = { game: 'Continue Playing', watch: 'Continue Watching', next: 'Next Episode' };
  /* What Remove will do, said on the button itself (its tooltip and name). */
  const REMOVE_SAYS = { game: 'Delete this Continue save', watch: 'Clear its watch progress', next: 'Clear its watch progress' };
  const cardTitle = e => e.kind === 'game' ? ((deviceOf(e.rec.id) || {}).name || e.rec.id)
    : (e.item.Type === 'Episode' ? (e.item.SeriesName || e.item.Name) : e.item.Name);

  function cardHTML(e) {
    let art = '', title = cardTitle(e), sub = '', kind = KIND_LABEL[e.kind], pct = 0, cls = '', label = '';
    const remove = `<button type="button" class="vcr-remove" data-cr-remove="${esc(e.key)}" aria-label="Remove ${esc(title)}: ${esc(REMOVE_SAYS[e.kind])}" title="Remove: ${esc(REMOVE_SAYS[e.kind])}">`
      + `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M17 7 7 17M7 7l10 10"/></svg></button>`;
    if (e.kind === 'game') {
      const r = e.rec, d = deviceOf(r.id);
      /* The variant this save belongs to (variants.js): saves are per file, and a
         group's variants share a name, so the card says which one it resumes. */
      let vl = '';
      try { vl = window.Variants ? window.Variants.cardLabel(r.id) : ''; } catch (err) {}
      sub = systemLabel(r, d) + (vl ? ' · ' + vl : '') + ' · ' + ago(r.ts) + (r.playSeconds != null ? ' · ' + playedText(r.playSeconds) : '');
      art = r.thumb || deviceArt(r, d);
      cls = r.thumb ? ' vcr-shot' : ' vcr-device';
      label = `Continue Playing ${title}${vl ? ' (' + vl + ')' : ''}, ${systemLabel(r, d)}, saved ${ago(r.ts)}`;
    } else {
      const it = e.item, ud = it.UserData || {};
      const ep = it.Type === 'Episode';
      sub = ep ? [epCode(it), it.Name].filter(Boolean).join(' · ') : (it.ProductionYear || '');
      art = videoArt(it);
      if (ud.PlaybackPositionTicks > 0 && it.RunTimeTicks > 0) pct = Math.max(1, Math.min(100, ud.PlaybackPositionTicks / it.RunTimeTicks * 100));
      cls = ' vcr-video';
      label = `${kind}: ${title}${sub ? ', ' + sub : ''}`;
    }
    return `<div class="vcr-card" role="listitem" data-cr-kind="${e.kind}">`
      + `<button type="button" class="vcr-open" data-cr-open="${esc(e.key)}" aria-label="${esc(label)}">`
      + `<span class="vcr-art${cls}">${art ? `<img src="${esc(art)}" alt="" loading="lazy" decoding="async" draggable="false">` : `<span class="vcr-noart">${esc(title)}</span>`}`
      + (pct ? `<span class="vcr-prog" aria-hidden="true"><i style="width:${pct.toFixed(1)}%"></i></span>` : '')
      + `</span>`
      + `<span class="vcr-meta"><span class="vcr-kind">${esc(kind)}</span><span class="vcr-title">${esc(title)}</span>`
      + (sub ? `<span class="vcr-sub">${esc(sub)}</span>` : '') + `</span>`
      + `</button>${remove}</div>`;
  }

  let _entries = new Map();
  function render(host, entries) {
    _entries = new Map(entries.map(e => [e.key, e]));
    if (!entries.length) { host.hidden = true; host.innerHTML = ''; return; }
    const prevScroll = (host.querySelector('.vcr-row') || {}).scrollLeft || 0;
    const fa = host.contains(document.activeElement) ? document.activeElement : null;
    const focusKey = fa ? (fa.getAttribute('data-cr-open') || '') : '';
    const focusRm = fa ? (fa.getAttribute('data-cr-remove') || '') : '';
    host.innerHTML = `<div class="vp-head" id="video-continue-head">Continue</div>`
      + `<div class="vcr-scroller">`
      + `<button class="video-cat-arrow vcr-arrow" type="button" data-cr-scroll="-1" aria-label="Scroll Continue left">&#8249;</button>`
      + `<div class="vcr-row" role="list" aria-labelledby="video-continue-head">${entries.map(cardHTML).join('')}</div>`
      + `<button class="video-cat-arrow vcr-arrow" type="button" data-cr-scroll="1" aria-label="Scroll Continue right">&#8250;</button>`
      + `</div>`;
    host.hidden = false;
    const row = host.querySelector('.vcr-row');
    row.scrollLeft = prevScroll;
    row.addEventListener('scroll', () => arrows(host), { passive: true });
    row.querySelectorAll('img').forEach(i => i.addEventListener('load', () => arrows(host), { once: true }));
    arrows(host);
    if (focusKey) { const b = row.querySelector(`[data-cr-open="${CSS.escape(focusKey)}"]`); if (b) b.focus({ preventScroll: true }); }
    if (focusRm) { const b = row.querySelector(`[data-cr-remove="${CSS.escape(focusRm)}"]`); if (b) b.focus({ preventScroll: true }); }
  }
  function arrows(host) {
    const row = host.querySelector('.vcr-row');
    const sc = host.querySelector('.vcr-scroller');
    if (!row || !sc) return;
    const over = row.scrollWidth > row.clientWidth + 1;
    sc.classList.toggle('fits', !over);
    const [prev, next] = sc.querySelectorAll('.vcr-arrow');
    if (prev) prev.disabled = !over || row.scrollLeft <= 0;
    if (next) next.disabled = !over || row.scrollLeft >= row.scrollWidth - row.clientWidth - 1;
  }

  let _seq = 0;
  async function refresh() {
    const host = document.getElementById('video-continue');
    if (!host) return;
    const seq = ++_seq;
    if (!enabled()) { host.hidden = true; host.innerHTML = ''; _entries = new Map(); return; }
    /* LOADING (31 Oct: "The continue row should show loading when it is gathering data to present").
       While the saves and the media server's lists are gathered and the row has no cards yet, it shows
       its heading and three loading cards with the tiles' own shimmer, instead of nothing. Shown after
       150 ms, so a quick answer goes straight to the cards; not shown when the last gathering found
       nothing (LAST_KEY 0), so a row that is always empty does not flash. Cards already showing stay
       while they are refreshed. */
    let loadT = 0;
    if (!host.querySelector('.vcr-card:not(.vcr-skel)') && lastCount() !== 0) loadT = setTimeout(() => { if (seq === _seq && !host.querySelector('.vcr-card')) renderLoading(host); }, 150);
    let games, video;
    try { [games, video] = await Promise.all([listGames(), fetchVideo().catch(() => [])]); }
    finally { clearTimeout(loadT); }
    if (seq !== _seq) return;
    /* A game on the unsupported list (firmware/site/unsupported.js) is left off the
       row: its card could only lead to a refusal. Its record and save are kept,
       so it comes back by itself when the list drops it. */
    /* A Game & Watch, colour-unit or Pokemon mini card whose files are not here
       (no game server or content pack holding them) is left off too, its record
       and save kept, and comes back when they are (index.html
       gameTitleAvailable, 2026-10-14). */
    /* A game source switched off in Settings (28 Oct; source-switch.js): its titles
       have left the catalogue, so a card whose title is not in it is left off too (record and
       save kept); with every game source on, "not adopted yet" still counts as here, as before. */
    const srcOff = (() => { try { return !!(window.CwSources && (!CwSources.on('cws') || !CwSources.on('pack'))); } catch (e) { return false; } })();
    const inCat = id => { try { return typeof ALL_DEVICES === 'undefined' || ALL_DEVICES.some(d => d.id === id); } catch (e) { return true; } };
    const here = id => { try { if (srcOff && !inCat(id)) return false; return typeof gameTitleAvailable !== 'function' || gameTitleAvailable(id); } catch (e) { return true; } };
    const entries = video.concat(games.filter(r => !r.hidden && !unsupportedGame(r.id) && here(r.id)).map(r => ({ kind: 'game', key: 'g:' + r.id, ts: r.ts || 0, rec: r })))
      .filter(e => !_gone.has(e.key));
    entries.sort((a, b) => b.ts - a.ts);
    lastCount(entries.length);
    render(host, entries);
  }
  const LAST_KEY = 'gnw.continue.lastCount';
  function lastCount(n) {
    try {
      if (n == null) { const v = localStorage.getItem(LAST_KEY); return v == null ? -1 : +v; }
      localStorage.setItem(LAST_KEY, String(n));
    } catch (e) { /* storage blocked: always show loading */ }
    return -1;
  }
  function renderLoading(host) {
    host.innerHTML = `<div class="vp-head" id="video-continue-head">Continue</div>`
      + `<div class="vcr-scroller fits"><div class="vcr-row vcr-loading" role="list" aria-labelledby="video-continue-head" aria-busy="true">`
      + [0, 1, 2].map(i => `<div class="vcr-card vcr-skel" role="listitem"${i ? ' aria-hidden="true"' : ''}><span class="vcr-art"></span>`
        + `<span class="vcr-meta"><span class="vcr-skel-line"></span><span class="vcr-skel-line vcr-skel-short"></span></span>`
        + (i ? '' : '<span class="vcr-skel-sr">Loading</span>') + `</div>`).join('')
      + `</div></div>`;
    host.hidden = false;
  }

  /* -------------------------------------------------------------- remove
     One Remove per card:
       Continue Playing   DELETES the card's Continue save: its record and its
                          rewind history (2026-10-11; see deleteGame).
                          The game's battery save and save slots are kept.
       Continue Watching  CLEARS ITS WATCH STATUS on the media server, so it looks
       Next Episode       never watched (2026-10-12: "That is how it's
                          cleared out normally in Emby"). Nothing is hidden.
         An episode (either card): the whole SERIES is marked unplayed,
           DELETE /Users/{uid}/PlayedItems/{seriesId}
         which Emby applies to every episode of it (played flag, play count),
         and then the card's own episode gets its resume point cleared,
           POST /Users/{uid}/Items/{episodeId}/UserData
         with its UserData as the card had it, Played false, PlayCount 0 and
         PlaybackPositionTicks 0 (the whole record is sent back, so a favourite
         or a rating is kept). With nothing played and nothing part-watched the
         series drops out of Next Up and Resume by itself.
         A film, or any item with no series: the same two calls on the item itself.
     NO UNDO for a film or series card (2026-10-12): the toast only says
     what was done. A game card keeps its Undo (about 8 s), which puts back the
     deleted save from memory. */
  const _gone = new Set();          // keys removed this session, kept off the row while the server catches up
  async function removeEntry(e) {
    if (!e) return null;
    const title = cardTitle(e);
    if (e.kind === 'game') {
      let gone;
      try { gone = await deleteGame(e.rec.id); }
      catch (err) { console.warn('[continue] could not delete the save:', err && err.message || err); toast('Couldn’t remove ' + title + '.'); return null; }
      return { msg: 'Removed ' + title + ' and deleted its Continue save.', undo: () => undeleteGame(gone) };
    }
    const E = window.Emby, A = E && E.subsApi;
    if (!E || !E.setPlayed || !A) { toast('Couldn’t clear ' + title + ': not connected to your media server.'); return null; }
    const it = e.item, uid = A.userId(), ud = Object.assign({}, it.UserData || {});
    const series = it.Type === 'Episode' && it.SeriesId ? it.SeriesId : null;
    const cleared = Object.assign({}, ud, { Played: false, PlayCount: 0, PlaybackPositionTicks: 0 });
    delete cleared.LastPlayedDate;
    // Every card of this series (or this item) leaves the row now, while the server catches up.
    const keys = [..._entries.values()].filter(x => x.kind !== 'game' && (series ? x.item.SeriesId === series : x.item.Id === it.Id)).map(x => x.key);
    keys.forEach(k => _gone.add(k));
    try {
      await E.setPlayed(series || it.Id, false);
      await A.post(`/Users/${uid}/Items/${it.Id}/UserData`, undefined, cleared);   // undefined, not null: emby.js qs() only defaults undefined
    } catch (err) {
      keys.forEach(k => _gone.delete(k));
      toast('Couldn’t clear ' + title + '. ' + (err && err.message || ''));
      return null;
    }
    setTimeout(() => keys.forEach(k => _gone.delete(k)), 15000);   // the server has it by then
    return { msg: 'Removed ' + title + ' and cleared its watch progress.' };
  }
  async function removeKey(key, host) {
    const e = _entries.get(key);
    if (!e) { toast('That card had already changed. The row has been refreshed.'); refresh(); return; }
    if (_busy.has(key)) return;
    _busy.add(key);
    // Where focus goes: the same control on the neighbouring card.
    const keys = [..._entries.keys()], i = keys.indexOf(key);
    const nextKey = keys[i + 1] || keys[i - 1] || null;
    const onRemove = !!(document.activeElement && document.activeElement.hasAttribute && document.activeElement.hasAttribute('data-cr-remove'));
    try {
      const done = await removeEntry(e);
      if (!done) return;
      await refresh();
      host = host || document.getElementById('video-continue');
      const sel = nextKey && (onRemove ? `[data-cr-remove="${CSS.escape(nextKey)}"]` : `[data-cr-open="${CSS.escape(nextKey)}"]`);
      const b = sel && host && host.querySelector(sel);
      if (b) b.focus({ preventScroll: true });
      window.__continueRemoved = { key, kind: e.kind, at: Date.now() };
      toast(done.msg, done.undo && (async () => {
        try { await done.undo(); } catch (err) { toast('Couldn’t undo that. ' + (err && err.message || '')); return; }
        await refresh();
        const h = document.getElementById('video-continue');
        const back = h && h.querySelector(`[data-cr-open="${CSS.escape(key)}"]`);
        if (back && (!document.activeElement || document.activeElement === document.body || h.contains(document.activeElement) || document.activeElement.id === 'vcr-toast-undo')) back.focus({ preventScroll: true });
        window.__continueUndone = { key, at: Date.now() };
      }));
    } finally { _busy.delete(key); }
  }
  const _busy = new Set();

  /* The toast: a line and an Undo button, never a sound. Ctrl+Z also undoes
     while it shows. It never takes focus by itself. */
  let _toastT = null, _undo = null, _cwn = null;
  function toast(msg, undo) {
    /* 28 Oct: in the new message box (cwNotify), same words, same time, Undo as its
       button; Ctrl+Z still undoes while it shows. The old line below is the fallback. */
    if (typeof window.cwNotify === 'function') {
      try {
        clearTimeout(_toastT); hideOld();
        const mine = window.cwNotify(String(msg), {
          kind: 'info', duration: undo ? 8000 : 5000, id: 'vcr-toast',
          actions: undo ? [{ label: 'Undo', run: () => { runUndo(); } }] : [],
          onClose: () => { if (_cwn === mine) { _cwn = null; _undo = null; } },
        });
        if (mine) { _cwn = mine; _undo = undo || null; return; }
      } catch (_) {}
    }
    let t = document.getElementById('vcr-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'vcr-toast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
      t.innerHTML = '<span class="vcr-toast-msg"></span><button type="button" id="vcr-toast-undo" class="vcr-toast-undo">Undo</button>';
      t.querySelector('button').addEventListener('click', () => runUndo());
      document.body.appendChild(t);
    }
    t.querySelector('.vcr-toast-msg').textContent = msg;
    _undo = undo || null;
    t.querySelector('button').hidden = !undo;
    t.classList.add('show');
    clearTimeout(_toastT);
    _toastT = setTimeout(hideToast, undo ? 8000 : 5000);
  }
  function hideToast() {
    if (_cwn) {   // the new message box: focus inside goes back to the row, as with the old line
      const c = _cwn; _cwn = null;
      if (c.el.contains(document.activeElement)) { const h = document.querySelector('#video-continue [data-cr-open]'); if (h) h.focus({ preventScroll: true }); }
      try { c.close('closed'); } catch (_) {}
    }
    hideOld();
    _undo = null;
  }
  function hideOld() {
    const t = document.getElementById('vcr-toast');
    if (t) {
      if (t.contains(document.activeElement)) { const h = document.querySelector('#video-continue [data-cr-open]'); if (h) h.focus({ preventScroll: true }); }
      t.classList.remove('show');
    }
  }
  function runUndo() {
    const u = _undo;
    clearTimeout(_toastT);
    hideToast();
    if (u) u();
  }
  document.addEventListener('keydown', ev => {
    if (_undo && (ev.ctrlKey || ev.metaKey) && !ev.altKey && (ev.key === 'z' || ev.key === 'Z')
        && !(ev.target && ev.target.closest && ev.target.closest('input, textarea, [contenteditable="true"]'))) {
      ev.preventDefault();
      runUndo();
    }
  });

  /* ----------------------------------------------------------- wiring */
  function onHostClick(ev) {
    const host = ev.currentTarget;
    const sc = ev.target.closest('[data-cr-scroll]');
    if (sc) {
      const row = host.querySelector('.vcr-row');
      if (row) row.scrollBy({ left: Number(sc.dataset.crScroll) * Math.max(160, row.clientWidth * 0.8), behavior: 'smooth' });
      return;
    }
    const rm = ev.target.closest('[data-cr-remove]');
    if (rm) {
      ev.stopPropagation();
      removeKey(rm.dataset.crRemove, host);
      return;
    }
    const op = ev.target.closest('[data-cr-open]');
    if (!op) return;
    const e = _entries.get(op.dataset.crOpen);
    if (!e) return;
    if (e.kind === 'game') { openGame(e.rec.id); return; }
    const E = window.Emby;
    if (!E || !E.openVideoPlayer) return;
    const ud = e.item.UserData || {};
    E.openVideoPlayer(e.item, op, ud.PlaybackPositionTicks > 0 ? ud.PlaybackPositionTicks : 0);
  }
  /* TV and keyboard. Tab reaches the row between the library strip and the
     grid, in document order. Inside it, left and right walk the cards and
     down / up leave for the grid and the toolbar -- a remote has no Tab.
     Up from a card first reaches that card's Remove button (a remote has no
     Delete key either); up again leaves. Delete removes the focused card. There is NO Back / Escape handling here:
     keys.js owns Back, and returns focus to the card a game was opened from
     (render() keeps that focus across the refresh a close causes). */
  function onHostKey(ev) {
    const rmCur = ev.target.closest('[data-cr-remove]');
    const cur = ev.target.closest('[data-cr-open]');
    if (!cur && !rmCur) return;
    const host = ev.currentTarget;
    const attr = rmCur ? '[data-cr-remove]' : '[data-cr-open]';
    const all = [...host.querySelectorAll(attr)];
    const i = all.indexOf(rmCur || cur);
    const leaveUp = () => document.querySelector('#video-library:not([hidden]) .video-cat-btn.active, #video-library:not([hidden]) .video-cat-btn')
        || document.querySelector('[data-vcontinue]');
    let to = null;
    if (ev.key === 'ArrowRight') to = all[i + 1];
    else if (ev.key === 'ArrowLeft') to = all[i - 1];
    else if (ev.key === 'Delete') {   // and Shift+Delete. Never Backspace: Backspace is Back everywhere (keys.js, 2026-10-04)
      const rm = rmCur || cur.parentElement.querySelector('[data-cr-remove]');
      if (rm) { ev.preventDefault(); removeKey(rm.dataset.crRemove, host); }
      return;
    } else if (ev.key === 'ArrowDown') {
      // From a card's Remove (top right of the card) down is the card itself.
      // Leaving the row goes through nav.js (keys phase 2) when it is loaded:
      // the grid's remembered tile, or the one nearest below.
      if (!rmCur && window.GnwNav && window.GnwNav.leave(cur, 'down')) { ev.preventDefault(); return; }
      to = rmCur ? rmCur.parentElement.querySelector('[data-cr-open]')
        : document.querySelector('#video-grid [tabindex="0"], #video-grid button, #video-grid a[href]');
    } else if (ev.key === 'ArrowUp') {
      // A remote has no Delete key: up from a card reaches its Remove, up again leaves the row.
      to = rmCur ? null : cur.parentElement.querySelector('[data-cr-remove]');
      if (!to && window.GnwNav && window.GnwNav.leave(rmCur || cur, 'up')) { ev.preventDefault(); return; }
      if (!to) to = leaveUp();
    } else return;
    ev.preventDefault();
    /* THE WHOLE CARD, NOT ONLY ITS X (4 Nov: "When a close button has focus, the whole tile must be
       in view so the user sees what they would remove"). The browser's own focus scroll and the old
       scrollIntoView of the target itself stopped as soon as the small X in the card's corner was in
       view, cutting the right-most card off at its X. The card the focus lands in is what scrolls in. */
    if (to) {
      const card = to.closest('.vcr-row') && to.closest('.vcr-card');
      if (!card) { to.focus(); return; }
      try { to.focus({ preventScroll: true }); } catch (_) { to.focus(); }
      card.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }
  function onHostFocus(ev) {
    const b = ev.target.closest && ev.target.closest('.vcr-card');
    if (b) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function mount() {
    ensureStyles();
    const host = document.getElementById('video-continue');
    if (host && !host.__crWired) {
      host.__crWired = true;
      host.addEventListener('click', onHostClick);
      host.addEventListener('keydown', onHostKey);
      host.addEventListener('focusin', onHostFocus);
    }
    document.querySelectorAll('[data-vcontinue]').forEach(b => {
      if (b.__crWired) return;
      b.__crWired = true;
      b.addEventListener('click', ev => { ev.preventDefault(); setEnabled(!enabled()); });
    });
    syncButton();
    refresh();
  }

  /* The film player closing changes Emby's resume positions; the server has
     them a moment after the final report, so the row asks again then. */
  function watchPlayer() {
    let wasOpen = false;
    const look = () => {
      const ov = document.getElementById('video-player-overlay');
      if (!ov) return;
      if (!ov.__crObserved) {
        ov.__crObserved = true;
        new MutationObserver(() => {
          const open = ov.classList.contains('open');
          if (wasOpen && !open) setTimeout(refresh, 1500);
          wasOpen = open;
        }).observe(ov, { attributes: true, attributeFilter: ['class'] });
      }
    };
    look();
    // The overlay is created on first play.
    new MutationObserver(look).observe(document.body, { childList: true });
    window.addEventListener('resize', () => { const h = document.getElementById('video-continue'); if (h && !h.hidden) arrows(h); });
  }

  /* ------------------------------------------------------------- styles */
  function ensureStyles() {
    if (document.getElementById('continue-row-styles')) return;
    const st = document.createElement('style');
    st.id = 'continue-row-styles';
    st.textContent = `
      .video-continue { margin:4px 0 12px; }
      .video-continue[hidden] { display:none; }
      .video-continue .vp-head { font-size:11px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); margin:0 2px 8px; }
      .vcr-scroller { display:flex; align-items:center; gap:6px; }
      .vcr-scroller.fits .vcr-arrow { display:none; }
      .vcr-scroller .vcr-arrow { height:96px; }
      .vcr-row {
        display:flex; flex-wrap:nowrap; gap:14px; overflow-x:auto; flex:1 1 auto;
        scroll-behavior:smooth; scrollbar-width:none; -ms-overflow-style:none; padding:4px 2px 6px;
      }
      .vcr-row::-webkit-scrollbar { display:none; }
      .vcr-card { position:relative; flex:0 0 auto; width:171px; }
      /* Loading cards (31 Oct): the wall tiles' loading look (index.html .device-card .img.loading: a flat
         light base and a white sweep, tile-shimmer), at the cards' own size. */
      .vcr-skel .vcr-art { background:#e6e2da; border-color:transparent; }
      .vcr-skel .vcr-art::before { content:""; position:absolute; inset:0; background:linear-gradient(90deg, transparent, rgba(255,255,255,.9), transparent);
        transform:translateX(-100%); animation:tile-shimmer 1.5s linear infinite; }
      .vcr-skel .vcr-meta { display:flex; flex-direction:column; gap:6px; margin-top:6px; }
      .vcr-skel-line { display:block; height:10px; width:80%; border-radius:5px; background:rgba(127,127,127,.22); }
      .vcr-skel-line.vcr-skel-short { width:50%; }
      .vcr-skel-sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
      html.cw-held .vcr-skel .vcr-art::before { animation-play-state:paused; }
      @media (prefers-reduced-motion: reduce) { .vcr-skel .vcr-art::before { animation:none; opacity:0; } }
      .vcr-open {
        display:flex; flex-direction:column; gap:6px; width:100%; padding:0; margin:0;
        background:none; border:0; color:var(--text); text-align:left; cursor:pointer; font-family:inherit;
      }
      .vcr-art {
        position:relative; display:block; width:171px; height:96px; border-radius:8px; overflow:hidden;
        background:var(--bg-1); border:1px solid var(--line);
        transition:transform .15s, border-color .15s;
      }
      .vcr-art img { display:block; width:100%; height:100%; object-fit:cover; }
      .vcr-art.vcr-shot img { object-fit:contain; background:#0b0d10; image-rendering:pixelated; }
      .vcr-art.vcr-device img { object-fit:contain; padding:6px; box-sizing:border-box; }
      .vcr-noart { display:flex; align-items:center; justify-content:center; height:100%; padding:8px; font-size:12px; font-weight:700; color:var(--muted); text-align:center; }
      .vcr-prog { position:absolute; left:0; right:0; bottom:0; height:4px; background:rgba(0,0,0,.45); }
      .vcr-prog i { display:block; height:100%; background:var(--accent); }
      .vcr-open:hover .vcr-art, .vcr-open:focus-visible .vcr-art { border-color:var(--accent); transform:translateY(-2px); }
      .vcr-open:focus-visible { outline:none; }
      .vcr-open:focus-visible .vcr-art { outline:var(--focus-width,3px) solid var(--focus-ring,#5dc8f0); outline-offset:2px; }
      .vcr-meta { display:flex; flex-direction:column; gap:1px; min-width:0; padding:0 2px; }
      .vcr-kind { font-size:9.5px; font-weight:800; letter-spacing:.09em; text-transform:uppercase; color:var(--accent); }
      .vcr-title { font-size:12.5px; font-weight:700; line-height:1.25; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .vcr-sub { font-size:11px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      /* REMOVE: one small icon-only chip in the card's corner, always on screen
         (a TV browser has no hover). Built like the tiles' round count
         badge (.video-unplayed / .collected-badge): dark translucent fill, blur,
         hairline border, thin outline icon. The action's words are in its
         tooltip, its accessible name and the Undo toast, never on the card. */
      .vcr-remove {
        position:absolute; top:6px; right:6px; z-index:2; width:26px; height:26px; padding:0; box-sizing:border-box;
        display:inline-flex; align-items:center; justify-content:center; border-radius:999px; cursor:pointer;
        background:rgba(10,14,20,.72); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
        border:1px solid rgba(255,255,255,.18); color:rgba(255,255,255,.82); box-shadow:0 2px 10px rgba(0,0,0,.4);
        transition:color .15s, border-color .15s, background .15s;
      }
      .vcr-remove svg { display:block; flex:0 0 auto; }
      .vcr-card:hover .vcr-remove, .vcr-card:focus-within .vcr-remove { color:#fff; border-color:rgba(255,255,255,.32); }
      .vcr-remove:hover, .vcr-remove:focus-visible { color:var(--accent); border-color:var(--accent); background:rgba(10,14,20,.88); }
      .vcr-remove:focus-visible { outline:var(--focus-width,3px) solid var(--focus-ring,#5dc8f0); outline-offset:2px; }
      body.gnw-tv .vcr-remove { width:30px; height:30px; }
      body.gnw-tv .vcr-remove svg { width:16px; height:16px; }
      #vcr-toast {
        position:fixed; left:50%; bottom:28px; transform:translateX(-50%) translateY(18px);
        z-index:421; max-width:min(560px,92vw); padding:10px 12px 10px 18px; border-radius:12px;
        display:flex; align-items:center; gap:14px;
        background:var(--bg-2); border:1px solid var(--line); color:var(--text);
        font-size:13.5px; line-height:1.45; box-shadow:0 18px 50px rgba(0,0,0,.55);
        opacity:0; visibility:hidden; transition:opacity .2s ease, transform .2s ease, visibility 0s linear .2s;
      }
      #vcr-toast.show { opacity:1; visibility:visible; transform:translateX(-50%) translateY(0); transition:opacity .2s ease, transform .2s ease; }
      .vcr-toast-undo {
        flex:0 0 auto; padding:7px 14px; border-radius:8px; border:1px solid rgba(var(--accent-rgb),.55);
        background:rgba(var(--accent-rgb),.14); color:var(--text); font:inherit; font-weight:700; cursor:pointer;
      }
      .vcr-toast-undo[hidden] { display:none; }
      .vcr-toast-undo:focus-visible { outline:var(--focus-width,3px) solid var(--focus-ring,#5dc8f0); outline-offset:2px; }
      body.gnw-tv #vcr-toast { bottom:max(8vh, env(safe-area-inset-bottom, 0px)); font-size:16px; }
      @media (max-width:760px) {
        .vcr-card, .vcr-art { width:128px; }
        .vcr-art { height:72px; }
        .vcr-scroller .vcr-arrow { height:72px; }
      }
      @media (prefers-reduced-motion: reduce) { .vcr-art { transition:none; } .vcr-row { scroll-behavior:auto; } }
    `;
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------- start */
  wrapCloser('closePlayModal', 'play-overlay');
  wrapCloser('closePmPlay', 'pm-play-overlay');

  window.ContinueRow = {
    mount, refresh, enabled, setEnabled,
    onPlayClose, frameHold,
    /* Settings, Auto save on exit (9 Nov 2026): read and set. */
    autoSaveOnExit, setAutoSaveOnExit,
    /* Is this play window being genuinely played right now (open, visible, not
       paused, not loading, past any attract demo)? index.html's play-time
       total counts only while this is true. */
    playingNow,
    /* For tests and a console: read-only views and the two actions a card has. */
    list: listGames, openGame,
    /* index.html's Pokemon mini launcher: put a Continue card's state in before the first frame. */
    pmResume,
    /* Is a Continue card relaunching this title right now (its save not yet back)? The Pokemon
       mini in the host asks, so its frame holds the machine until the save is in. */
    pendingRelaunch: id => !!(_relaunch && _relaunch.id === id && !_relaunch.restored),
    /* Remove a card by its key ('g:<device id>', 'v:<item id>', 'n:<item id>'): a game's
       Continue save is deleted (record and rewind history); a video card is marked. */
    remove: key => removeKey(key), undo: () => runUndo(),
    /* The 30-second rule, for tests: the threshold, this session's played time
       per window, and a swappable clock (fn returning ms; null restores
       performance.now) plus a sample step, so a test advances play time
       without real waiting. The real sampler keeps running alongside. */
    MIN_PLAY_MS,
    /* Rewind history kept with each save, for tests and a console: the stored
       (packed) record and the caps. */
    rewindOf: async id => getRewind(await getGame(id)), unpackRewind, REWIND_CAP_BYTES, REWIND_TOTAL_BYTES, REWIND_FORMAT,
    _rewindCodec: { take: takeRewind, pack: packRewind, unpack: unpackRewind, put: putGame },
    /* The orphan sweep (also run once on every load); resolves to what it deleted. */
    _sweepOrphans: sweepOrphans,
    _playClock: {
      use(fn) { _clock = typeof fn === 'function' ? fn : () => performance.now(); for (const k in _sess) _sess[k].last = _clock(); },
      sample: samplePlay,
      played: overlayId => (_sess[overlayId] ? _sess[overlayId].ms : 0),
    },
  };

  // The orphan sweep first, then the list, so a hidden record from an older version is never drawn.
  const start = () => { historyDrain().catch(() => {}); ensureStyles(); watchPlayer(); sweepOrphans().then(listGames, listGames).catch(() => {}); if (document.getElementById('video-continue')) mount(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

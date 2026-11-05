/*
 * play-file.js -- "Play a file": a game file from this device, played at once (2026-10-28).
 *
 * WHY. The request (28 Oct): "a drag-and-drop box for instant boot of games: it takes the zip or
 * uncompressed file and runs the game instantly, then deletes the file from memory after the
 * game is closed." The tile is drawn by settings-sources.js (Settings > Media and content);
 * this file does the work behind it.
 *
 * WHAT IT PLAYS. Every game file the play windows take, by the same lists the cores declare
 * (play/cores/<console>/core.mjs manifest files.game.exts), and a .zip of them, unpacked in the
 * browser by the content pack's own reader (firmware/site/content_pack.js readZip):
 *     Game Boy and Game Boy Color   .gb .gbc .sgb
 *     NES, Famicom, Disk System     .nes .unf .unif .fds
 *     Pokemon mini                  .min
 *     Atari 2600 / 5200 / 7800      .a26 / .a52 .car / .a78
 *     Atari Lynx                    .lnx .lyx .o
 * The file's own header decides first where it has one (iNES, FDS, UNIF, .a78, Lynx, the Game
 * Boy logo), the extension otherwise. A .bin says nothing about its machine: it is refused with
 * the rename the content pack also asks for. Game & Watch programs and the colour units' flash
 * need their artwork and their other parts with them, so they are sent to the content pack.
 *
 * HOW. The console's own play window opens (the one play host, play/host/) on a game id made
 * from the file's SHA-256 ("x" + 12 hex, the content pack's and the game server's id scheme),
 * and when the window asks the site for that game (play/host/site-relay.js, cwNeed 'game')
 * this file answers from memory. Nothing else is asked for it; the relay sends every other
 * question (firmware, a second disk) to the usual places.
 *
 * KEPT ONLY IN MEMORY. The bytes are never written anywhere: no IndexedDB, no cache, no
 * "recent files" list, no Continue card (the play window opens with no catalogue id, so the
 * Continue row and play time record nothing). The game's OWN battery save (the cartridge's
 * save RAM, never the game) is kept by the play window as for any game, under the file's id,
 * so a second visit with the same file finds it, as a real cartridge would. When the window
 * closes, every reference to the bytes is dropped.
 *
 * Firmware: a Disk System disk needs the Disk System's own boot program, and the Pokemon mini
 * its BIOS. Both are looked for first (content pack, built files, game server) and a missing
 * one is said plainly instead of opening a window that cannot start.
 */
(function () {
  'use strict';
  if (window.CwPlayFile) return;
  const BUILD = '20261028-media1';

  const MAX_FILE = 72 * 1024 * 1024;          // a .zip or a file; the largest game the cores take is 64 MB (NES)
  /* The game server's limits: the NES 64 MB plus the 16-byte header and 512-byte trainer (its
     core takes the largest multicarts); every other system 16 MB. A core whose machine holds
     less says so itself. */
  const MB16 = 16 * 1024 * 1024;
  const SYS = {
    gb:    { label: 'Game Boy', max: MB16 },
    nes:   { label: 'Nintendo Entertainment System', max: 64 * 1024 * 1024 + 16 + 512 },
    pm:    { label: 'Pokémon mini', max: MB16 },
    a2600: { label: 'Atari 2600', max: MB16, cat: 'atari2600' },
    a5200: { label: 'Atari 5200', max: MB16, cat: 'atari5200' },
    a7800: { label: 'Atari 7800', max: MB16, cat: 'atari7800' },
    alynx: { label: 'Atari Lynx', max: MB16, cat: 'atarilynx' },
  };
  const EXT = {
    gb: 'gb', gbc: 'gb', sgb: 'gb', cgb: 'gb',
    nes: 'nes', unf: 'nes', unif: 'nes', fds: 'nes',
    min: 'pm',
    a26: 'a2600', a52: 'a5200', car: 'a5200', a78: 'a7800',
    lnx: 'alynx', lyx: 'alynx', o: 'alynx',
  };
  const ACCEPT = Object.keys(EXT).map(e => '.' + e).concat(['.zip', '.bin']).join(',');
  const extOf = n => ((/\.([a-z0-9]+)$/i.exec(String(n || '')) || [])[1] || '').toLowerCase();
  const baseName = n => String(n || '').replace(/^.*[\\/]/, '');

  const ascii = (u, at, n) => { let s = ''; for (let i = 0; i < n && at + i < u.length; i++) s += String.fromCharCode(u[at + i]); return s; };
  /* The machine, from what the file says about itself, else its extension. */
  function detect(name, u) {
    if (ascii(u, 0, 4) === 'NES\x1a') return { sys: 'nes', fds: false };
    if (ascii(u, 0, 4) === 'FDS\x1a' || ascii(u, 1, 14) === '*NINTENDO-HVC*') return { sys: 'nes', fds: true };
    if (ascii(u, 0, 4) === 'UNIF') return { sys: 'nes', fds: false };
    if (ascii(u, 1, 9) === 'ATARI7800') return { sys: 'a7800' };
    if (ascii(u, 0, 4) === 'LYNX') return { sys: 'alynx' };
    // The Game Boy's boot logo at 0x104 (its first bytes are fixed: CE ED 66 66).
    if (u.length > 0x150 && u[0x104] === 0xCE && u[0x105] === 0xED && u[0x106] === 0x66 && u[0x107] === 0x66) return { sys: 'gb' };
    const e = extOf(name);
    if (EXT[e]) return { sys: EXT[e], fds: e === 'fds' };
    if (e === 'bin') return { err: 'bin' };
    if (e === 'svg' || e === 'json') return { err: 'gnw' };
    return { err: 'unknown' };
  }
  const MSG = {
    bin: 'A .bin file carries no header, so nothing in it says which machine it is for. Rename it to .a26 (Atari 2600), .a52 (Atari 5200) or .a78 (Atari 7800) and choose it again. Game & Watch programs and the colour units\' flash go in a content pack, with their artwork.',
    gnw: 'Game & Watch units need their program, their artwork and their other parts together. Put them in one .zip and open it as a content pack (the Content pack tile).',
    unknown: 'This is not a game file the site can play. It takes Game Boy (.gb, .gbc), NES and Famicom (.nes, .unf, .fds), Pokémon mini (.min), Atari (.a26, .a52, .a78, .lnx) files, and a .zip of them.',
    empty: 'There is no game file the site can play in this .zip.',
    big: 'This file is larger than any game the site plays.',
    zip: 'This .zip could not be read. It may be damaged, or packed in a way the browser cannot open.',
    read: 'The file could not be read from this device.',
    busy: 'The play windows are not ready yet. Wait a moment and try again.',
  };

  let session = null;            // the one file playing: { sys, slot, b64, frame, ov, watch }
  let picked = null;             // a .zip with several games, waiting for a choice: [{ name, bytes, det }]

  function b64of(u) { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
  async function sha256hex(u) {
    const buf = window.cwsDigest ? await window.cwsDigest('SHA-256', u) : await crypto.subtle.digest('SHA-256', u);
    return Array.from(new Uint8Array(buf), x => x.toString(16).padStart(2, '0')).join('');
  }

  /* The whole file, piece by piece, telling the progress bar how far it is. */
  async function readAll(file, lk) {
    const LB = window.CwLoadBar;
    if (!lk || !LB || typeof file.stream !== 'function') return new Uint8Array(await file.arrayBuffer());
    const out = new Uint8Array(file.size), rd = file.stream().getReader();
    let pos = 0;
    for (;;) {
      const x = await rd.read();
      if (x.done) break;
      if (pos + x.value.length > out.length) throw new Error('size');
      out.set(x.value, pos); pos += x.value.length;
      LB.step(lk, pos, file.size);
    }
    return pos === out.length ? out : out.subarray(0, pos);
  }

  /* A file from the picker or a drop: one game, a .zip of one, or a .zip of several (then
     { choose: [names] }, and choose(i) plays one). Resolves { ok, msg } or { choose }. */
  async function open(file) {
    picked = null;
    if (!file) return { ok: false, msg: MSG.read };
    if (file.size > MAX_FILE) return { ok: false, msg: MSG.big };
    let u;
    /* Read with a progress bar (loadbar.js, 2026-10-29): it shows only if the reading takes more
       than 2 s (a large file on a phone) and goes once the file is in. */
    const LB = window.CwLoadBar, lk = LB ? LB.start(file.size) : null;
    try { u = await readAll(file, lk); } catch (_) { if (lk) LB.done(lk); return { ok: false, msg: MSG.read }; }
    if (lk) LB.done(lk);
    const name = baseName(file.name);
    if (extOf(name) === 'zip' || (u[0] === 0x50 && u[1] === 0x4B && u[2] === 0x03 && u[3] === 0x04)) {
      const P = window.__GNW_PACK;
      if (!P || typeof P.readZip !== 'function') return { ok: false, msg: MSG.busy };
      let entries;
      try { entries = await P.readZip(u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength)); } catch (_) { return { ok: false, msg: MSG.zip }; }
      u = null;
      const games = [];
      for (const e of entries || []) {
        const b = e.bytes instanceof Uint8Array ? e.bytes : new Uint8Array(e.bytes || []);
        const det = detect(e.name, b);
        if (det.sys) games.push({ name: baseName(e.name), bytes: b, det });
      }
      if (!games.length) {
        const any = (entries || []).map(e => detect(e.name, new Uint8Array(0)));
        return { ok: false, msg: any.some(d => d.err === 'bin') ? MSG.bin : any.some(d => d.err === 'gnw') ? MSG.gnw : MSG.empty };
      }
      if (games.length === 1) return play(games[0].name, games[0].bytes, games[0].det);
      picked = games;
      return { choose: games.map(g => g.name + ' (' + SYS[g.det.sys].label + (g.det.fds ? ', Disk System' : '') + ')') };
    }
    const det = detect(name, u);
    if (det.err) return { ok: false, msg: MSG[det.err] };
    return play(name, u, det);
  }
  function choose(i) {
    const g = picked && picked[i];
    picked = null;                                       // the other games in the .zip go now
    return g ? play(g.name, g.bytes, g.det) : Promise.resolve({ ok: false, msg: MSG.empty });
  }
  function forgetChoice() { picked = null; }

  async function firmwareThere(sys, id) {
    const R = window.CwSiteRelay;
    if (!R || typeof R.resolve !== 'function') return true;      // cannot tell: the window will say
    try { const r = await R.resolve(sys, 'firmware', id); return !!(r && r.b64); } catch (_) { return true; }
  }

  async function play(name, bytes, det) {
    const S = SYS[det.sys];
    if (!S) return { ok: false, msg: MSG.unknown };
    if (!bytes || !bytes.length) return { ok: false, msg: MSG.read };
    if (bytes.length > S.max) return { ok: false, msg: 'This file is larger than any ' + S.label + ' game (' + Math.round(S.max / 1048576) + ' MB at most).' };
    if (typeof window._playFrameGo !== 'function' || typeof window.openOverlay !== 'function' || !window.CwSiteRelay) return { ok: false, msg: MSG.busy };
    if (det.sys === 'nes' && det.fds && !(await firmwareThere('nes', 'fds')))
      return { ok: false, msg: 'Disk System games need the Disk System\'s own boot program (its firmware), and none is set up here. Add it with a content pack or a game server, then try again.' };
    if (det.sys === 'pm' && !(await firmwareThere('pm', 'bios')))
      return { ok: false, msg: 'Pokémon mini games need the Pokémon mini\'s own BIOS (its firmware), and none is set up here. Add it with a content pack or a game server, then try again.' };
    let hash;
    try { hash = await sha256hex(bytes); } catch (_) { return { ok: false, msg: MSG.read }; }
    end();                                               // a file already playing is let go first
    const x = 'x' + hash.slice(0, 12);
    const slot = det.sys === 'gb' || det.sys === 'nes' || det.sys === 'pm' ? x : det.sys + '-' + x;
    const title = name.replace(/\.[a-z0-9]{1,4}$/i, '');
    // No catalogue id: the Continue row and play time record nothing for this window.
    try { if (typeof _openPlayDeviceId !== 'undefined') _openPlayDeviceId = null; } catch (_) {}   // eslint-disable-line no-undef
    try { if (typeof window.closeOverlay === 'function') { const v = document.getElementById('vault-overlay'); if (v && v.classList.contains('open')) window.closeOverlay('vault-overlay'); } } catch (_) {}
    try { if (typeof window.pauseCollectionTiles === 'function') window.pauseCollectionTiles('play'); } catch (_) {}
    const set = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
    let ovId, frame;
    if (det.sys === 'gb') {
      ovId = 'gb-play-overlay'; frame = document.getElementById('gb-play-frame');
      set('gb-play-title', title);
      const sub = document.querySelector('#gb-play-overlay .modal-sub'); if (sub) sub.textContent = 'Game Boy';
      session = { sys: 'gb', slot, b64: b64of(bytes), frame, ov: ovId };
      window._playFrameGo(frame, 'play/gameboy/index.html#' + encodeURIComponent(slot));
    } else if (det.sys === 'nes') {
      ovId = 'nes-play-overlay'; frame = document.getElementById('nes-play-frame');
      let con = det.fds ? 'fds' : 'nes';
      try { if (!det.fds && window.NesConsole) con = window.NesConsole.classify({ name, id: 'nes-' + x }).console || 'nes'; } catch (_) {}
      set('nes-play-title', title);
      set('nes-play-sub', con === 'fds' ? 'Famicom Disk System' : con === 'famicom' ? 'Famicom' : 'Nintendo Entertainment System');
      const ov = document.getElementById(ovId); if (ov) ov.classList.remove('rob-wide');
      session = { sys: 'nes', slot, b64: b64of(bytes), frame, ov: ovId };
      window._playFrameGo(frame, 'play/nes/index.html' + (con !== 'nes' ? '?console=' + con : '') + '#' + encodeURIComponent(slot));
    } else if (det.sys === 'pm') {
      ovId = 'pm-play-overlay';
      const modal = document.getElementById('pm-play-modal');
      if (!modal) return { ok: false, msg: MSG.busy };
      set('pm-play-title', title);
      const old = document.getElementById('pm-host-frame'); if (old) old.remove();
      frame = document.createElement('iframe');
      frame.id = 'pm-host-frame'; frame.title = title; frame.setAttribute('allow', 'autoplay; fullscreen; gamepad');
      frame.className = 'cw-host-frame';
      modal.appendChild(frame);
      const ov = document.getElementById(ovId); if (ov) ov.classList.add('cw-host');
      session = { sys: 'pm', slot, b64: b64of(bytes), frame, ov: ovId };
      try { if (window.CwPlayAudio) window.CwPlayAudio.reserve(30000); } catch (_) {}
      frame.src = 'play/host/index.html?sys=pm#' + encodeURIComponent(slot);
    } else {
      ovId = 'atari-play-overlay'; frame = document.getElementById('atari-play-frame');
      const t = (typeof ATARI_SYSTEMS !== 'undefined' && ATARI_SYSTEMS[S.cat]) || null;   // eslint-disable-line no-undef
      if (!t || !t.play) return { ok: false, msg: S.label + ' games cannot be played here yet.' };
      set('atari-play-sub', t.label); set('atari-play-title', title);
      if (frame) frame.title = t.label;
      session = { sys: det.sys, slot, b64: b64of(bytes), frame, ov: ovId };
      window._playFrameGo(frame, t.play + 'index.html#' + encodeURIComponent(slot));
    }
    bytes = null;
    window.openOverlay(ovId);
    watchClose(session);
    return { ok: true, sys: det.sys, label: SYS[det.sys].label, title };
  }

  /* The window closing (the x, Back, Escape, a remote's Back: all reach closeOverlay) lets go. */
  function watchClose(s) {
    const ov = document.getElementById(s.ov);
    if (!ov) return;
    let seenOpen = ov.classList.contains('open');
    s.watch = new MutationObserver(() => {
      const open = ov.classList.contains('open');
      if (open) { seenOpen = true; return; }
      if (seenOpen && session === s) end();
    });
    s.watch.observe(ov, { attributes: true, attributeFilter: ['class'] });
  }
  function end() {
    const s = session;
    session = null;
    picked = null;
    if (!s) return;
    try { s.watch && s.watch.disconnect(); } catch (_) {}
    s.b64 = null; s.frame = null;
  }

  /* play/host/site-relay.js asks this first: the game ask of the window this file opened is
     answered here, from memory, and nothing else is. */
  function answers(ev, d) {
    const s = session;
    if (!s || !s.b64 || !d || d.cwNeed !== 'game' || String(d.sys || '') !== s.sys || String(d.id || '') !== s.slot) return false;
    if (!s.frame || !s.frame.contentWindow || ev.source !== s.frame.contentWindow) return false;
    try { ev.source.postMessage({ cwFile: d.n, b64: s.b64, source: 'a file on this device' }, '*'); } catch (_) {}
    return true;
  }

  window.CwPlayFile = { BUILD, ACCEPT, open, choose, forgetChoice, answers, playing: () => !!session, detect: (n, u) => detect(n, u || new Uint8Array(0)), end };
})();

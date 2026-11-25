/*
 * play/host/site-relay.js -- the ONE game-file relay for the play host (2026-10-14).
 * the Core API, section 4.2 files.mjs: "one relay {cwNeed: 'game' | 'firmware', id}".
 *
 * Loaded by the site's index.html (a classic script in the site's own document, so it
 * can read the site's game sources). It replaces, for host windows only, the six
 * per-system relays (gbNeedCart, nesNeedCart, nesNeedBios, atariNeedCart, atariNeedBios,
 * tftNeedFw); the old pages keep theirs until they are retired.
 *
 *   frame -> site   { cwNeed: 'game' | 'firmware', sys, id, n }
 *   frame -> site   { cwNeed: 'art', sys, id: <artwork path>, n }   (2026-10-14: an art file the
 *                   site resolves for the console, e.g. a G&W segment SVG through the site's
 *                   artwork gateway with its content-pack fallback; answered { cwFile: n, text })
 *   site  -> frame  { cwFile: n, b64: string | null, source: 'content pack' | 'site files' | 'game server' | null }
 *
 * ORDER, and the edge case of a content pack AND a game server both present: the pack
 * is asked first, then the site's own built files, then a linked game server -- the
 * order the old per-system relays used -- so the same title resolves to the same file
 * in the old page and the host. `source` says which answered, so a test (and the host's
 * diagnostics) can see it. Only a play host frame is answered.
 *
 * SOUND: none. Users' files stay in their browser: nothing is uploaded.
 */
(function () {
  'use strict';
  if (window.CwSiteRelay) return;
  const BUILD = '2.3.0';

  /* Per console: how a game id and a firmware id are found. Each `pack` / `site` / `server`
     returns base64 or null. Added to per phase (the build plan, section 5). */
  const SOURCES = {
    gb: {
      key: (kind, id) => kind === 'firmware' ? ({ dmg: 'bios', cgb: 'biosCgb', sgb: 'sgb:snes' })[id] || null : (/^gb-/.test(id) ? id : 'gb-' + id),   // sgb: the Super Game Boy's SNES program (game server only)
      pack: what => (window.__GNW_PACK && window.__GNW_PACK.gameboy) ? window.__GNW_PACK.gameboy(what) : null,
      site: what => Promise.resolve(typeof ensureGbCarts === 'function' ? ensureGbCarts() : null)
        .then(() => (typeof _gbLoadBakedFiles === 'function' ? _gbLoadBakedFiles() : null))
        .then(() => ((typeof _gbPackContent !== 'undefined' && _gbPackContent && _gbPackContent[what]) || null)),
      server: what => {
        const cid = (what === 'bios' || what === 'biosCgb') ? 'gb:' + what : what;
        return (window.CWS && CWS.has(cid)) ? CWS.fetchB64(cid) : null;
      },
      /* (14 Nov) the Advance's own Color-mode program: the game server's generic file of role 'agb' (system gbc) */
      /* (14 Nov, GBFW2) and each Game Boy model's own: the first model's (gb role dmg0, 15 Nov), the Pocket's (gb role mgb), the Super Game Boy's (sgb role
         boot) and the Super Game Boy 2's (sgb role boot2); the core names the role (core.mjs firmwareRole) */
      serverRole: { cgb: ['agb'], dmg: ['dmg0', 'mgb', 'sgb', 'sgb2'] },
      byRole: async (id, role) => {
        const at = ({ cgb: { agb: ['gbc', 'agb'] }, dmg: { dmg0: ['gb', 'dmg0'], mgb: ['gb', 'mgb'], sgb: ['sgb', 'boot'], sgb2: ['sgb', 'boot2'] } })[id];
        const sr = at && at[role]; if (!sr) return null;
        const g = window.CWS && typeof CWS.bootGeneric === 'function' ? CWS.bootGeneric(sr[0], sr[1], false) : null;
        if (!g || typeof CWS.fetchBootSha !== 'function') return null;
        const u = await CWS.fetchBootSha(g.sha256);
        return u ? { b64: b64of(u), source: serverName(id === 'cgb' ? 'gb:biosCgb' : 'gb:bios') } : null;
      },
    },
    /* Pokemon mini (Phase 2): the site's one loader, ensurePmFiles(), takes ONE source for the
       whole visit -- the built payload, else the content pack, else the game servers -- so the
       answer names the source that loader settled on. A game id is the device id. */
    pm: {
      combined: (kind, id) => Promise.resolve(typeof ensurePmFiles === 'function' ? ensurePmFiles() : null).then(files => {
        if (!files) return null;
        let b64 = null;
        if (kind === 'firmware') b64 = id === 'bios' && typeof files.bios === 'string' ? files.bios : null;
        else {
          const v = typeof pmCartVariants === 'function' ? pmCartVariants(files, id) : (typeof files[id] === 'string' ? { default: files[id] } : null);
          if (v) { const lang = typeof pmDefaultLang === 'function' ? pmDefaultLang(v) : Object.keys(v)[0]; b64 = v[lang] || null; }
        }
        if (!b64) return null;
        let source = 'site files';
        if (typeof _pmFileAvailable !== 'undefined' && !_pmFileAvailable) {
          const P = window.__GNW_PACK;
          source = (P && typeof P.pokemini === 'function' && P.pokemini()) ? 'content pack' : serverName(kind === 'firmware' ? 'pm:bios' : id);
        }
        return { b64, source };
      }),
    },
    /* NES / Famicom / Disk System (Phase 4): the old page's two relays, nesNeedCart and
       nesNeedBios (index.html _nesFetchCart, _nesFetchFdsBios), split into the same three
       sources in the same order. A game id is the device id, 'nes-<slot>'. */
    nes: {
      key: (kind, id) => kind === 'firmware' ? (id === 'fds' ? 'fds:bios' : null) : (/^nes-/.test(id) ? id : 'nes-' + id),
      pack: what => {
        const P = window.__GNW_PACK;
        if (!P) return null;
        if (what === 'fds:bios') return typeof P.fdsBios === 'function' ? P.fdsBios() : null;
        return Promise.resolve(typeof ensureNesFiles === 'function' ? ensureNesFiles() : null).then(() => (P.nes ? P.nes(what) : null));
      },
      site: what => {
        if (what === 'fds:bios') return null;                     // never baked: the player's own firmware only
        return Promise.resolve(typeof ensureNesFiles === 'function' ? ensureNesFiles() : null)
          .then(() => (typeof _nesLoadFiles === 'function' ? _nesLoadFiles() : null))
          .then(() => ((typeof _nesContent !== 'undefined' && _nesContent && _nesContent[what]) || null));
      },
      server: what => {
        if (!window.CWS || !CWS.has(what)) return null;
        if (what === 'fds:bios' && CWS.available && !CWS.available(what)) return null;
        return CWS.fetchBytes(what).then(u => {
          if (!u) return null;
          let out = '';
          for (let i = 0; i < u.length; i += 0x8000) out += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
          return btoa(out);
        });
      },
    },
  };

  /* "game server Home" -- the server(s) that hold this file, by the name they were
     given (cws.js titles/servers; no tokens, no codes). Boot firmware is not in the title
     list, so it is named by the servers that are joined. */
  function serverName(id) {
    try {
      const sv = CWS.servers(), t = CWS.titles().find(x => x.id === id);
      const sids = t ? t.holders : sv.filter(x => x.joined).map(x => x.id);
      // A server's own name may already say "game server" ("Mini game server"): said once.
      const names = sv.filter(x => sids.indexOf(x.id) >= 0 && x.name).map(x => String(x.name).replace(/\s*game\s*server\s*$/i, '').trim()).filter(Boolean);
      return names.length ? 'game server ' + names.map(n => '“' + n + '”').join(', ') : 'game server';
    } catch (_) { return 'game server'; }
  }
  /* The four Atari consoles (the Atari migration, 2026-10-14). A game id is the site's
     whole device id (a2600-x<12 hex>), as the old atariNeedCart relay took it. 'bios' is the
     player's console firmware: the first image of a size the console takes, in the site's
     own order (_atariFetchBios: the content pack, the built set, then the game server with
     its DEFAULT first, cws.js L18), which is how the old 5200 page chose it. */
  const ATARI_LONG = { a2600: 'atari2600', a5200: 'atari5200', a7800: 'atari7800', alynx: 'atarilynx' };
  const ATARI_FW = { a5200: [2048], a7800: [4096, 16384], alynx: [512] };   // alynx: the Lynx boot program (1 Nov 2026)
  /* The 2600 Kid Vid's tape audio (2026-10-19; play/cores/atari/core.mjs THE KID VID'S
     NARRATION): a game server's atari2600 bios folder, by file name. Never baked into the site. */
  const KV_FILE = { kvshared: 'KVSHARED.WAV', kvs1: 'KVS1.WAV', kvs2: 'KVS2.WAV', kvs3: 'KVS3.WAV', kvb1: 'KVB1.WAV', kvb2: 'KVB2.WAV', kvb3: 'KVB3.WAV' };
  function kidVidTape(name) {
    if (!window.CWS) return null;
    /* The cassette shelf first (the game server's tapes folder, any sub-folder), then the
       older place, the 2600's bios folder, so a server not yet moved keeps working. */
    const cas = typeof CWS.cassetteByName === 'function' ? CWS.cassetteByName(name) : null;
    if (cas) return CWS.fetchB64(cas);
    if (typeof CWS.bootFileByName !== 'function') return null;
    const sha = CWS.bootFileByName('a2600', name);
    return sha ? CWS.fetchBootSha(sha).then(u => (u ? b64of(u) : null)) : null;
  }
  const b64of = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  /* THE SUPERCHARGER'S TAPE (2600; 2026-10-22; play/cores/atari/core.mjs): a recording
     on the cassette shelf (.wav, any folder), matched to the game by its title (the words outside
     brackets, letters and digits only: "Dragonstomper (Excalibur) (1 of 3) (1982) ..." and
     "Dragonstomper.wav" match), a PAL tape first for a PAL game; and the player's Supercharger
     firmware from the 2600's boot programs (2048 bytes, "Supercharger" in its name, "(PAL)" for
     the PAL slot). Asked for as firmware 'artape' (with the game's id), 'arfw' and 'arfwpal'. */
  const scKey = s => String(s || '').replace(/\.[a-z0-9]{1,4}$/i, '').replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const scPal = s => /\(PAL\)/i.test(String(s || ''));
  function scTapes(gameId) {
    if (!window.CWS || typeof CWS.cassettes !== 'function') return [];
    let t = null; try { t = CWS.titles().find(x => x.id === gameId); } catch (_) {}
    const want = t && scKey(t.title);
    if (!want) return [];
    const pal = scPal(t.title);
    return CWS.cassettes().filter(c => c.format === 'wav' && scKey(c.name) === want)
      .sort((a, b) => (scPal(a.name) === pal ? 0 : 1) - (scPal(b.name) === pal ? 0 : 1));
  }
  async function superchargerFile(id, gameId) {
    if (!window.CWS) return { b64: null, source: null };
    if (id === 'artape') {
      const c = scTapes(gameId)[0];
      const b = c ? await CWS.fetchB64(c.id) : null;
      return b ? { b64: b, source: 'the cassette shelf' } : { b64: null, source: null };
    }
    /* FW1 (2026-10-22): the server's generic file for the role, by hash; from a server
       without roles, the old rule (2048 bytes, "Supercharger" in its name, "(PAL)" for PAL). */
    const g = typeof CWS.bootGeneric === 'function' ? CWS.bootGeneric('a2600', id === 'arfwpal' ? 'supercharger-pal' : 'supercharger') : null;
    let list = []; try { list = typeof CWS.bootChoices === 'function' ? CWS.bootChoices('atari-bios', 'a2600') : []; } catch (_) {}
    const c = (g && g.size === 2048) ? g : list.filter(x => x.size === 2048 && !x.role && /supercharger/i.test(x.name) && scPal(x.name) === (id === 'arfwpal'))[0];
    const u = c ? await CWS.fetchBootSha(c.sha256) : null;
    return u ? { b64: b64of(u), source: serverName('a2600') } : { b64: null, source: null };
  }
  /* The console firmware 'bios' (FW1, 2026-10-22): the content pack and the built set
     first (index.html _atariLoadBios), then ONE file from the game server, asked for at this moment:
     the generic file of the role this game needs ('boot', or 'boot-pal' for a PAL 7800 cartridge;
     play/cores/atari/core.mjs firmwareRole). Only a server without roles falls back to the old way
     (every image of the system, the first of the right size). */
  /* THE 7800 BIOS FOR THE CARTRIDGE'S TV SYSTEM (23 Oct; the same firmware rule as
     for the two-port 5200): 'bios@boot-pal' is answered only with the PAL console's BIOS and
     'bios' never with it, from the site as from a game server; anything else is no answer, so the
     next place is asked and, at the end, the game refuses (core.mjs PAL_7800_FW). By identity:
     Atari 7800 BIOS (198x)(Atari)(PAL), the file the game server's role boot-pal names. */
  const A7800_PAL_BIOS = '63e1884e27c89d47e968e2c31dd268e17b415be590865739d5b366c76c123c48';
  async function fwFits(sys, role, b64) {
    if (!b64 || sys !== 'a7800') return !!b64;
    let pal = false;
    try {
      const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const h = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', u)), x => x.toString(16).padStart(2, '0')).join('');
      pal = h === A7800_PAL_BIOS;
    } catch (_) { return false; }
    return (role === 'boot-pal') === pal;
  }
  function atariLocalBios(sys, role) {
    if (typeof _atariLoadBios !== 'function') return atariBios(sys, role);
    return Promise.resolve(_atariLoadBios()).then(async all => {
      for (const h of Object.keys(all || {})) {
        const e = all[h]; if (!e || e.s !== sys || !e.b) continue;
        try { if (ATARI_FW[sys].indexOf(atob(e.b).length) >= 0 && await fwFits(sys, role, e.b)) return e.b; } catch (_) {}
      }
      return null;
    });
  }
  async function atariServerBios(sys, role) {
    if (!window.CWS) return null;
    const g = typeof CWS.bootGeneric === 'function' ? CWS.bootGeneric(sys, role || 'boot', !role || role === 'boot') : null;
    if (g) {
      const u = ATARI_FW[sys].indexOf(g.size) >= 0 ? await CWS.fetchBootSha(g.sha256) : null;
      const b = u ? b64of(u) : null;
      return (await fwFits(sys, role || 'boot', b)) ? b : null;
    }
    const roles = typeof CWS.firmwareList === 'function' && CWS.firmwareList().some(f => f.system === sys && f.role);
    if (roles || typeof CWS.atariBios !== 'function') return null;          // a server with roles has no generic file for this one
    const srv = await CWS.atariBios(sys).catch(() => null);
    for (const h of Object.keys(srv || {})) { const e = srv[h]; try { if (e && e.b && ATARI_FW[sys].indexOf(atob(e.b).length) >= 0 && await fwFits(sys, role || 'boot', e.b)) return e.b; } catch (_) {} }
    return null;
  }
  function atariBios(sys, role) {
    if (typeof _atariFetchBios !== 'function') return null;
    return Promise.resolve(_atariFetchBios(ATARI_LONG[sys])).then(async images => {
      for (const h of Object.keys(images || {})) {
        const e = images[h]; if (!e || !e.b) continue;
        try { if (ATARI_FW[sys].indexOf(atob(e.b).length) >= 0 && await fwFits(sys, role || 'boot', e.b)) return e.b; } catch (_) {}
      }
      return null;
    });
  }
  for (const sys of Object.keys(ATARI_LONG)) SOURCES[sys] = {
    key: (kind, id, role) => kind === 'firmware' ? (id === 'bios' && ATARI_FW[sys] ? (role && role !== 'boot' ? 'bios@' + role : 'bios') : (sys === 'a2600' && KV_FILE[id] ? 'kv:' + KV_FILE[id] : null)) : id,
    pack: what => (/^bios(@|$)/.test(what) || /^kv:/.test(what)) ? null : ((window.__GNW_PACK && typeof window.__GNW_PACK.atari === 'function') ? window.__GNW_PACK.atari(what) : null),
    site: what => {
      if (what === 'bios@boot-2port') return null;   // the site's own images are four-port ones: the two-port firmware comes from a game server only
      if (/^bios(@|$)/.test(what)) return atariLocalBios(sys, what.split('@')[1] || 'boot');
      if (/^kv:/.test(what)) return null;
      // The visit's own cache first (a file the site already holds), then the machine's built shelf.
      try { if (typeof _atariCartBytes !== 'undefined' && _atariCartBytes.has(what)) return b64of(_atariCartBytes.get(what)); } catch (_) {}
      return Promise.resolve(typeof ensureAtariFiles === 'function' ? ensureAtariFiles() : null)
        .then(() => (typeof _atariLoadShelf === 'function' ? _atariLoadShelf(ATARI_LONG[sys]) : null))
        .then(() => { const s = typeof _atariContent !== 'undefined' && _atariContent[ATARI_LONG[sys]]; return (s && s[what]) || null; });
    },
    server: what => (/^kv:/.test(what) ? kidVidTape(what.slice(3)) : /^bios(@|$)/.test(what) ? atariServerBios(sys, what.split('@')[1]) : ((window.CWS && CWS.has(what)) ? CWS.fetchB64(what) : null)),
  };

  /* THE SEGA 8-BIT DEVICES (20 Nov 2026; play/cores/sega8/). A game id is the site's whole device id
     (sms-x<12 hex>). No content pack and no baked shelf: the visit's own cache (a file the site already
     holds), then a game server. The start-up firmware is asked for by slot (the core's manifest:
     sms1, sms2, smsj, gg) and answered with the game server's generic file of that role, by hash;
     none answers "none" and the core runs ours, the firmware order. Never another emulator's. */
  const SEGA_FW_ROLE = { sms: { sms1: 'sms1', sms2: 'sms2', smsj: 'smsj', smsk: 'smsk' }, gg: { gg: 'boot' }, sg1000: {} };
  /* A firmware a cartridge may prefer that the game servers list under no role of its own (20 Nov 2026):
     smsk, Samsung's Korean Master System II firmware (the only known dump), asked for by its hash when a
     Korean cartridge's record names it. The game server lists it among its other start-up images. */
  const SEGA_FW_SHA = { smsk: '57abf3c00c82a8e042ebeb2bfe412adac9ba005e9009845236390de3ee645248' };
  async function segaServerFw(sys, role) {
    if (!window.CWS || typeof CWS.bootGeneric !== 'function' || typeof CWS.fetchBootSha !== 'function') return null;
    const g = CWS.bootGeneric(sys, role, false);
    const sha = g ? g.sha256 : SEGA_FW_SHA[role];
    const u = sha ? await CWS.fetchBootSha(sha) : null;
    return u ? b64of(u) : null;
  }
  /* A game built into the Master System's start-up firmware (21 Nov 2026; index.html SEGA8_BUILT_IN): its "game" is
     the firmware image itself, by its hash, from a game server; the core starts it with an empty cartridge slot. */
  async function segaBuiltIn(id) {
    let d = null; try { d = typeof ALL_DEVICES !== 'undefined' ? ALL_DEVICES.find(x => x && x.id === id) : null; } catch (_) {}
    if (!d || !d.builtIn || !window.CWS || typeof CWS.fetchBootSha !== 'function') return null;
    const u = await CWS.fetchBootSha(d.builtIn.sha);
    return u ? b64of(u) : null;
  }
  for (const sys of Object.keys(SEGA_FW_ROLE)) SOURCES[sys] = {
    key: (kind, id) => kind === 'firmware' ? (SEGA_FW_ROLE[sys][id] ? 'fw:' + SEGA_FW_ROLE[sys][id] : null) : id,
    pack: () => null,
    site: what => {
      if (/^fw:/.test(what)) return null;
      try { if (typeof _atariCartBytes !== 'undefined' && _atariCartBytes.has(what)) return b64of(_atariCartBytes.get(what)); } catch (_) {}
      return null;
    },
    server: what => (/^fw:/.test(what) ? segaServerFw(sys, what.slice(3)) : ((window.CWS && CWS.has(what)) ? CWS.fetchB64(what) : segaBuiltIn(what))),
  };

  /* THE SUPER NINTENDO (23 Nov 2026; play/cores/snes/). A game id is the site's device id (snes-x<12 hex>): the
     visit's own cache (a file the site already holds), then a game server, as the Sega devices'. The cartridge
     chips' program images come by role (the core's manifest: dsp1, dsp1b, dsp2, dsp3, dsp4, cx4, st010, st011,
     st018, the game server's roles of the same names), asked for only when a cartridge's header names such a
     chip; sufami (the Sufami Turbo base cartridge's program, asked for only by a Sufami Turbo cartridge); none
     answers "none". Never another emulator's. */
  const SNES_FW_ROLE = { dsp1: 1, dsp1b: 1, dsp2: 1, dsp3: 1, dsp4: 1, cx4: 1, st010: 1, st011: 1, st018: 1, sufami: 1 };
  SOURCES.snes = {
    key: (kind, id) => kind === 'firmware' ? (SNES_FW_ROLE[id] ? 'fw:' + id : null) : id,
    pack: () => null,
    site: what => {
      if (/^fw:/.test(what)) return null;
      try { if (typeof _atariCartBytes !== 'undefined' && _atariCartBytes.has(what)) return b64of(_atariCartBytes.get(what)); } catch (_) {}
      return null;
    },
    server: what => (/^fw:/.test(what) ? segaServerFw('snes', what.slice(3)) : ((window.CWS && CWS.has(what)) ? CWS.fetchB64(what) : null)),
  };

  /* THE NINTENDO 64 (22 Nov 2026; play/cores/n64/). A game id is the site's device id (n64-x<12 hex>).
     A game is 4 to 64 MB and the whole file must be in the machine before it starts, so it is not sent
     as one piece of text like the others: the core's own fetch (play/cores/n64/fetch.mjs) asks the game
     server for it in pieces of 4 MB, checks the whole against the server's name for its bytes, and keeps
     it in this browser (its database cw-n64-games, by SHA-256), so a second visit fetches nothing. The
     site's load bar shows the pieces arriving (loadbar.js); the bytes go to the play window whole
     (n64Game below). The start-up programs come by role, as the Sega devices' do: the game server's
     generic file for pif-ntsc, pif-pal or pif-mpal; none answers "none" and the core starts with its own. */
  const N64_FW_ROLE = { 'pif-ntsc': 'pif-ntsc', 'pif-pal': 'pif-pal', 'pif-mpal': 'pif-mpal', 'dd-ipl': 'dd-ipl' };   // dd-ipl: the 64DD drive's start-up program (26 Nov 2026)
  SOURCES.n64 = {
    key: (kind, id) => kind === 'firmware' ? (N64_FW_ROLE[id] ? 'fw:' + N64_FW_ROLE[id] : null) : null,   // the game itself: n64Game
    pack: () => null,
    site: () => null,
    server: what => (/^fw:/.test(what) ? segaServerFw('n64', what.slice(3)) : null),
  };
  let n64FetchMod = null;
  /* TIME LIMITS (23 Nov 2026): the browser's storage can hold a request for ever (a database another
     tab keeps open at an older version, a store that never answers); a game is then fetched rather than read,
     and one fetched is played from memory rather than kept, so a start never waits on the storage. */
  const within = (p, ms, fallback) => { let t = 0; return Promise.race([Promise.resolve(p), new Promise(r => { t = setTimeout(() => r(fallback), ms); })]).finally(() => clearTimeout(t)); };
  function n64Store(mod) {
    const own = mod.browserStore('cw-n64-games');
    return {
      /* A game this device pre-loaded (Settings, Pre-load on device; preload.js) is used as it is; the pre-load
         store has 10 seconds, this core's own store 15 (none: the game server's copy). */
      get: async sha => {
        try { const P = window.CwPreload; const u = P && typeof P.bytes === 'function' ? await within(P.bytes(sha), 10000, null) : null; if (u && u.length) return u; } catch (_) {}
        return within(Promise.resolve(own.get(sha)).catch(() => null), 15000, null);
      },
      /* keeping it has 30 seconds (none: the game plays from memory and is fetched again next time) */
      put: (sha, bytes) => within(Promise.resolve(own.put(sha, bytes)).catch(() => false), 30000, false),
      /* (22 Nov 2026, the core's 512 MiB store) the game being loaded is never let go to make room */
      hold: sha => { try { if (typeof own.hold === 'function') own.hold(sha); } catch (_) {} },
    };
  }
  /* One N64 game, whole: { bytes (Uint8Array), source } or { bytes: null, why } with the fetch's own words. */
  async function n64Game(id) {
    if (!/^n64-x[0-9a-f]{12}$/.test(id)) return { bytes: null };
    if (!window.CWS || typeof CWS.rangedSources !== 'function') return { bytes: null };
    const list = CWS.rangedSources(id);
    if (!list.length) return { bytes: null };
    try { n64FetchMod = n64FetchMod || await within(import(new URL('play/cores/n64/fetch.mjs?v=0095606f96d9', document.baseURI).href), 30000, null); } catch (_) { n64FetchMod = null; }
    if (!n64FetchMod) return { bytes: null, why: 'the part of the site that fetches the game did not arrive. Check the connection and try again' };
    const M = n64FetchMod, store = n64Store(M);
    const bar = window.CwLoadBar || null;
    let why = null;
    for (const s of list) {
      const k = bar ? bar.start(s.size, 'n64:' + id) : null;
      try {
        const got = await M.fetchGame({ url: s.url, fetchImpl: s.fetch, store, onProgress: e => {
          if (!bar || !k) return;
          if (e.kind === 'progress' || e.kind === 'kept') bar.step(k, e.got || 0, e.total || s.size);
          else if (e.words && typeof bar.say === 'function') bar.say(k, e.words);
        } });
        if (bar && k) bar.done(k);
        /* The listing's SHA-256 is the file asked for (API.md 6.3, verify every download). */
        if (got.sha256 !== s.sha256) { why = 'the game server sent another file than the one it lists'; continue; }
        return { bytes: got.bytes, source: got.from === 'store' ? 'this device' : serverName(id) };
      } catch (e) {
        if (bar && k) bar.done(k);
        why = (e && e.message) || String(e);
        if (e && e.kind === 'changed') { try { const again = await M.fetchGame({ url: s.url, fetchImpl: s.fetch, store }); if (again.sha256 === s.sha256) return { bytes: again.bytes, source: serverName(id) }; } catch (_) {} }
      }
    }
    return { bytes: null, why };
  }

  /* THE CARTRIDGE A 64DD DISK EXPANDS (26 Nov 2026; play/cores/n64/disk.mjs, slot dd-cart). A disk whose own code
     begins "E" asks for the cartridge it expands by that cartridge's header code (role 'cart:CFZJ'), naming no game.
     A game server lists no header codes, so the cartridge is looked for by its title among the joined servers' N64
     cartridges (N64_DD_CART: the code's game; a known copy by hash first, then any other copy whose name carries no
     [..] tag, so a bad, altered or hacked copy is never used), and each one's own header is read first (64 bytes, in
     any of the three byte orders): only a cartridge whose code is the one asked for is fetched, whole, as an N64 game
     is (n64Game). None found: no answer, and the disk starts alone and says what it needs (Settings, Boot programs,
     Choose a file), as before. TABLE-READ (26 Nov 2026, the codes of the library's 33 disks read): the one disk that
     expands a cartridge is the F-Zero X Expansion Kit (EFZJ), which asks for CFZJ, F-Zero X (Japan). */
  const N64_DD_CART = { CFZJ: { sha256: ['fa28ed5fd250ee7a948919a28720b8d02bd2b5dd59c5c629e04dde8875bd90d5'], title: /^f-?zero x\b/i } };
  function n64HeaderCode(h) {
    if (!h || h.length < 0x40) return null;
    const at = h[0] === 0x80 ? (i => h[i]) : h[0] === 0x37 ? (i => h[i ^ 1]) : h[0] === 0x40 ? (i => h[i ^ 3]) : null;   // big-endian, pairs swapped, words reversed
    if (!at) return null;
    let s = ''; for (let i = 0x3B; i < 0x3F; i++) s += String.fromCharCode(at(i));
    return /^[0-9A-Z]{4}$/.test(s) ? s : null;
  }
  async function n64DiskCart(role) {
    const m = /^cart:([0-9A-Z]{4})$/.exec(String(role || '')), want = m && N64_DD_CART[m[1]];
    if (!want || !window.CWS || typeof CWS.titles !== 'function' || typeof CWS.readRange !== 'function') return { bytes: null };
    const known = t => want.sha256.indexOf(t.sha256) >= 0;
    let list = [];
    try {
      list = CWS.titles().filter(t => t.system === 'n64' && String(t.format || '').toLowerCase() !== 'ndd' && t.available && /^n64-x[0-9a-f]{12}$/.test(t.id) &&
        (known(t) || (want.title.test(String(t.title || '')) && !/\[(?!!\])[^\]]*\]/.test(String(t.title || '')))));
    } catch (_) { list = []; }
    list.sort((a, b) => (known(b) ? 1 : 0) - (known(a) ? 1 : 0) || String(a.title).localeCompare(String(b.title)));
    for (const t of list.slice(0, 8)) {
      let code = null;
      try { code = n64HeaderCode(await within(CWS.readRange(t.id, 0, 64), 20000, null)); } catch (_) { code = null; }
      if (code !== m[1]) continue;
      const r = await n64Game(t.id);
      if (r && r.bytes) return { bytes: r.bytes, source: `${r.source}: ${t.title}` };
    }
    return { bytes: null };
  }

  /* Game & Watch (Phase 5, the G&W migration): a game id is the site's device id
     (silver-ball); the unit's key comes from GNW_EMULATED_GAMES. Its files are the old
     window's {key: {program, melody}} map, from the same three places in the same order: a
     content pack (content_pack.js programs()), the built file (firmware/output/gnw_games.json),
     then the game servers' zips by model number (cws.js gnwPrograms). The answer is one small
     container, UTF-8 JSON {format: 'cw-gnw/1', key, program, melody} (play/cores/gnw/core.mjs).
     A unit that runs another's program (gnw-host.js GAMES_HW_TWINS) takes its owner's
     files when it has none of its own. No boot firmware: the program is the game. */
  const GNW_TWIN = { smb: 'smbn', climber: 'climbern', bfight: 'bfightn', smbspecial: 'smbn', dkjrt: 'dkjrp', snoopyt: 'snoopyp', popeyet: 'popeyep' };
  let gnwBuilt = null;
  function gnwPick(files, key) {
    const prog = x => x && x.program;
    /* ANOTHER PROGRAM REVISION OF A DEVICE (8 Nov 2026): 'helmet~cn07' is Helmet's CN-07 program,
       picked in the drawer. Its own file only (never the usual program in its place); the unit,
       its artwork and its controls stay the device's, so the container names the device's key. */
    const vi = String(key).indexOf('~');
    if (vi > 0) {
      const v = files && files[key];
      if (!prog(v)) return null;
      return btoa(JSON.stringify({ format: 'cw-gnw/1', key: String(key).slice(0, vi), program: prog(v), melody: v.melody || null }));
    }
    const e = files && (prog(files[key]) ? files[key] : (GNW_TWIN[key] && files[GNW_TWIN[key]]));
    if (!prog(e)) return null;
    return btoa(JSON.stringify({ format: 'cw-gnw/1', key, program: prog(e), melody: e.melody || null }));
  }
  SOURCES.gnw = {
    key: (kind, id) => {
      if (kind !== 'game') return null;
      /* '<device>~<variant>' (8 Nov 2026): that device's other program revision, asked for as '<key>~<variant>'. */
      const s = String(id), vi = s.indexOf('~'), dev = vi > 0 ? s.slice(0, vi) : s, v = vi > 0 ? s.slice(vi + 1) : '';
      try { const e = typeof GNW_EMULATED_GAMES !== 'undefined' && GNW_EMULATED_GAMES[dev]; return e ? (v ? e.key + '~' + v : e.key) : null; } catch (_) { return null; }
    },
    pack: what => { const P = window.__GNW_PACK; const r = P && typeof P.programs === 'function' ? P.programs() : null; return gnwPick(r, what); },
    site: what => {
      gnwBuilt = gnwBuilt || fetch('firmware/output/gnw_games.json').then(r => (r.ok ? r.json() : null)).catch(() => null);
      return gnwBuilt.then(r => gnwPick(r, what));
    },
    server: what => (window.CWS && typeof CWS.gnwPrograms === 'function' ? Promise.resolve(CWS.gnwPrograms()).then(r => gnwPick(r, what)) : null),
    /* Art files: the site's own artwork gateway (index.html GnwArt.resolve: the archive, then a
       content pack), so the window shares the page's cache and a pack-only visit still draws. */
    art: path => (window.GnwArt && typeof GnwArt.resolve === 'function' ? GnwArt.resolve(path) : null),
  };

  /* The two colour units (Phase 5, 2026-10-14). A game id
     is the unit ('mario' / 'zelda'); the game is its external flash and firmware
     '<unit>:internal' its internal flash. Both come from one {internal, external} pair, from
     the same three places in the same order as every console: a content pack
     (content_pack.js tft()), the site's built firmware_<unit>.js (absent on a code-only
     build), then the unit's device zip on a game server (cws.js gnwTft: HXA-001 / HXB-001). */
  const TFT_UNITS = { mario: 1, zelda: 1 };
  const tftBuilt = {};
  function tftSite(unit) {
    if (window.__ARM_FW && window.__ARM_FW[unit]) return Promise.resolve(window.__ARM_FW[unit]);
    tftBuilt[unit] = tftBuilt[unit] || new Promise(res => {
      const sc = document.createElement('script');
      sc.src = 'play/' + unit + '/firmware_' + unit + '.js';
      sc.onload = () => res((window.__ARM_FW && window.__ARM_FW[unit]) || null);
      sc.onerror = () => res(null);
      document.head.appendChild(sc);
    });
    return tftBuilt[unit].then(fw => { if (!fw) tftBuilt[unit] = null; return fw; });
  }
  SOURCES.tft = {
    combined: async (kind, id) => {
      const unit = kind === 'game' ? id : String(id).replace(/:internal$/, '');
      if (!TFT_UNITS[unit] || (kind === 'firmware' && id !== unit + ':internal')) return null;
      const part = kind === 'game' ? 'external' : 'internal';
      try { if (window.__GNW_PACK && window.__GNW_PACK.ready) await window.__GNW_PACK.ready; } catch (_) {}
      try { const P = window.__GNW_PACK, fw = P && typeof P.tft === 'function' ? P.tft(unit) : null; if (fw && fw[part]) return { b64: fw[part], source: 'content pack' }; } catch (_) {}
      try { const fw = await tftSite(unit); if (fw && fw[part]) return { b64: fw[part], source: 'site files' }; } catch (_) {}
      try { const fw = window.CWS && typeof CWS.gnwTft === 'function' ? await CWS.gnwTft(unit) : null; if (fw && fw[part]) return { b64: fw[part], source: serverName(unit) }; } catch (_) {}
      return null;
    },
  };

  /* THE BOOT PROGRAM CHOICE (2026-10-19; the unified UI leftover "a firmware picker for
     any console"). The play window's Settings lists, for each boot program slot, every program the
     joined game servers hold for it ({ cwNeed: 'firmware-choices', sys, id, n } ->
     { cwFile: n, list: [{ sha256, size, name, auto, source }] }), and asks for one by its hash
     ({ cwNeed: 'firmware', sys, id, n, pick: <sha256> }). Without a pick the answer is the
     automatic one, as before (pack, site files, then the server's own choice by hash). */
  /* FW1 (2026-10-22): each slot names the server roles it takes and the role it needs by
     default ('want'; a game may need another, e.g. 'boot-pal'). The Atari slot's system is the server's
     id (a5200), not the site's long name: before this the 5200, 7800 and Lynx lists were always empty. */
  const FW_SLOT = { gb: { dmg: 'gb:bios', cgb: 'gb:biosCgb', sgb: 'sgb:snes' }, pm: { bios: 'pm:bios' }, nes: { fds: 'fds:bios' } };
  /* (14 Nov, GBFW2) the Game Boy slot holds four kinds, named system:role (the Super Game Boy's role "boot" is
     not the Game Boy's): every one is listed, the model's own first (FW_ROLE_LISTS) */
  const GB_DMG_KINDS = ['gb:boot', 'gb:dmg0', 'gb:mgb', 'sgb:boot', 'sgb:boot2'];
  const FW_ROLES = { 'gb:bios': GB_DMG_KINDS, 'gb:biosCgb': ['boot'], 'sgb:snes': ['snes', 'snes2'], 'pm:bios': ['boot'], 'fds:bios': ['disk'] };
  const ATARI_ROLES = { a5200: ['boot', 'boot-2port'], a7800: ['boot', 'boot-pal'], alynx: ['boot'] };
  /* (14 Nov) The Game Boy Advance's Color-mode program (server role 'agb', in the gbc boot folder) shares the
     Color slot. Only an Advance asks for it (play/cores/gb/core.mjs firmwareRole); its list then holds the Advance's
     programs first and Nintendo's Color programs as choices. A Color model's list never holds the Advance's. */
  const FW_ROLE_LISTS = { 'gb:biosCgb': { agb: { roles: ['agb', 'boot'], want: 'agb' } },
    'gb:bios': { dmg0: { roles: GB_DMG_KINDS, want: 'gb:dmg0' }, mgb: { roles: GB_DMG_KINDS, want: 'gb:mgb' }, sgb: { roles: GB_DMG_KINDS, want: 'sgb:boot' }, sgb2: { roles: GB_DMG_KINDS, want: 'sgb:boot2' } } };
  function fwSlot(sys, id, role) {
    if (FW_SLOT[sys]) {
      const slot = FW_SLOT[sys][id]; if (!slot) return null;
      const alt = role && FW_ROLE_LISTS[slot] && FW_ROLE_LISTS[slot][role];
      return alt ? { slot, roles: alt.roles, want: alt.want, named: true } : { slot, roles: FW_ROLES[slot], want: FW_ROLES[slot][0] };
    }
    if (ATARI_FW[sys] && id === 'bios') return { slot: 'atari-bios', system: sys, roles: ATARI_ROLES[sys] || ['boot'], want: 'boot' };
    if (sys === 'a2600' && (id === 'arfw' || id === 'arfwpal')) { const r = id === 'arfw' ? 'supercharger' : 'supercharger-pal'; return { slot: 'atari-bios', system: 'a2600', roles: [r], want: r }; }
    if (sys === 'a7800' && id === 'hsc') return { slot: 'atari-bios', system: 'a7800', roles: ['highscore'], want: 'highscore' };
    /* the Sega devices (20 Nov 2026): one slot per start-up firmware, the game server's role of that name */
    if (SEGA_FW_ROLE[sys] && SEGA_FW_ROLE[sys][id]) return { slot: 'atari-bios', system: sys, roles: [SEGA_FW_ROLE[sys][id]], want: SEGA_FW_ROLE[sys][id] };
    /* the Nintendo 64 (22 Nov 2026): one slot per start-up program, the game server's role of that name */
    if (sys === 'n64' && N64_FW_ROLE[id]) return { slot: 'atari-bios', system: 'n64', roles: [N64_FW_ROLE[id]], want: N64_FW_ROLE[id] };
    return null;
  }
  function firmwareChoices(sys, id, role) {
    const s = fwSlot(sys, id, role);
    if (!s || !window.CWS || typeof CWS.bootChoices !== 'function') return [];
    try {
      return CWS.bootChoices(s.slot, s.system, s.roles, s.named ? s.want : (role || s.want)).map(c => ({ sha256: c.sha256, size: c.size, name: c.name,
        role: c.role || '', roleName: c.roleName || '', generic: !!c.generic, auto: !!c.auto, source: serverName(s.slot) }));
    } catch (_) { return []; }
  }
  async function firmwareBySha(sys, id, sha) {
    const s = fwSlot(sys, id);
    if (!s || !/^[0-9a-f]{64}$/.test(String(sha)) || !window.CWS || typeof CWS.fetchBootSha !== 'function') return { b64: null, source: null };
    const u = await CWS.fetchBootSha(sha);
    return u ? { b64: b64of(u), source: serverName(s.slot) } : { b64: null, source: null };
  }

  async function resolve(sys, kind, id, role) {
    const S = SOURCES[sys];
    if (!S) return { b64: null, source: null, why: 'no sources for ' + sys };
    if (S.combined) { try { return (await S.combined(kind, id)) || { b64: null, source: null }; } catch (_) { return { b64: null, source: null }; } }
    const what = S.key(kind, id, role);
    if (!what) return { b64: null, source: null, why: 'unknown ' + kind + ' ' + id };
    /* (14 Nov) a role only a game server holds (the Advance's Color-mode program): its generic file, by hash,
       never the pack's or the site's file for the slot's usual role */
    if (kind === 'firmware' && S.serverRole && S.serverRole[id] && S.serverRole[id].indexOf(role) >= 0) {
      try { const g = await S.byRole(id, role); if (g) return g; } catch (_) {}
      return { b64: null, source: null };
    }
    try { if (window.__GNW_PACK && window.__GNW_PACK.ready) await window.__GNW_PACK.ready; } catch (_) {}
    try { const p = await S.pack(what); if (p) return { b64: p, source: 'content pack' }; } catch (_) {}
    try { const s = await S.site(what); if (s) return { b64: s, source: 'site files' }; } catch (_) {}
    try { const g = await S.server(what); if (g) return { b64: g, source: serverName(what) }; } catch (_) {}
    return { b64: null, source: null };
  }

  /* Only a play host window, in one of the site's play overlays, is answered. */
  function hostFrameOf(win) {
    // A play window's frame, or a tile's or the drawer's preview (the host's ?preview=1, 2026-10-15).
    for (const f of document.querySelectorAll('iframe')) {
      if (f.contentWindow !== win) continue;
      try { if (/\/play\/host\//.test(f.contentWindow.location.pathname)) return f; } catch (_) { return null; }
    }
    return null;
  }
  const stats = { asked: 0, answered: 0, bySource: {} };
  window.addEventListener('message', ev => {
    const d = ev.data;
    if (!d || (d.cwNeed !== 'game' && d.cwNeed !== 'firmware' && d.cwNeed !== 'art' && d.cwNeed !== 'firmware-choices' && d.cwNeed !== 'cassettes' && d.cwNeed !== 'cassette')) return;
    if (!hostFrameOf(ev.source)) return;
    /* A file opened from Settings > Play a file answers its own game ask, from memory (play-file.js). */
    if (window.CwPlayFile && window.CwPlayFile.answers(ev, d)) return;
    /* THE CASSETTE SHELF (2026-10-22): { cwNeed: 'cassettes', format } -> { cwFile, list }
       (each { id, name, folder, size, format }; format 'wav' or 'studybox' narrows it), and
       { cwNeed: 'cassette', id } -> { cwFile, b64, source }: one cassette, whole. */
    if (d.cwNeed === 'cassettes') {
      let list = []; try { list = window.CWS && typeof CWS.cassettes === 'function' ? CWS.cassettes() : []; } catch (_) {}
      const f = String(d.format || ''); if (f) list = list.filter(c => f === 'studybox' ? /^stud/.test(c.format) : c.format === f);
      try { ev.source.postMessage({ cwFile: d.n, list }, '*'); } catch (_) {}
      return;
    }
    if (d.cwNeed === 'cassette') {
      const id = String(d.id || ''), answer = b64 => { try { ev.source.postMessage({ cwFile: d.n, b64: b64 || null, source: b64 ? 'the cassette shelf' : null }, '*'); } catch (_) {} };
      Promise.resolve(/^cas-x[0-9a-f]{12}$/.test(id) && window.CWS && CWS.fetchB64 ? CWS.fetchB64(id) : null).then(answer, () => answer(null));
      return;
    }
    if (d.cwNeed === 'firmware-choices') {
      let list = []; try { list = firmwareChoices(String(d.sys || ''), String(d.id || ''), d.role ? String(d.role) : ''); } catch (_) {}
      /* the Supercharger's tape: this game's tapes on the shelf */
      if (d.sys === 'a2600' && d.id === 'artape') { try { list = scTapes(String(d.game || '')).map(c => ({ sha256: c.id, size: c.size, name: c.name, auto: true, source: 'the cassette shelf' })); } catch (_) { list = []; } }
      try { ev.source.postMessage({ cwFile: d.n, list }, '*'); } catch (_) {}
      return;
    }
    if (d.cwNeed === 'art') {
      const S = SOURCES[String(d.sys || '')];
      const answer = text => { try { ev.source.postMessage({ cwFile: d.n, text: typeof text === 'string' ? text : null, source: text ? 'site artwork' : null }, '*'); } catch (_) {} };
      Promise.resolve(S && S.art ? S.art(String(d.id || '')) : null).then(answer, () => answer(null));
      return;
    }
    if (d.cwNeed === 'firmware' && d.sys === 'a2600' && /^ar(fw|fwpal|tape)$/.test(String(d.id || ''))) {
      const answer = r => { try { ev.source.postMessage({ cwFile: d.n, b64: r.b64 || null, source: r.source || null }, '*'); } catch (_) {} };
      superchargerFile(String(d.id), String(d.game || '')).then(answer, () => answer({}));
      return;
    }
    /* THE XM MODULE'S HIGH SCORE CARTRIDGE PROGRAM (7800; 2026-10-24;
       play/cores/atari/core.mjs): the player's, from a game server only (role highscore, 4 KB),
       never from the site's files; a chosen one comes by its hash (firmwareBySha below). */
    if (d.cwNeed === 'firmware' && d.sys === 'a7800' && d.id === 'hsc' && !d.pick) {
      const answer = r => { try { ev.source.postMessage({ cwFile: d.n, b64: r.b64 || null, source: r.source || null }, '*'); } catch (_) {} };
      const g = window.CWS && typeof CWS.bootGeneric === 'function' ? CWS.bootGeneric('a7800', 'highscore') : null;
      Promise.resolve(g && g.size === 4096 ? CWS.fetchBootSha(g.sha256) : null)
        .then(u => answer(u ? { b64: b64of(u), source: serverName('a7800') } : {}), () => answer({}));
      return;
    }
    /* A Nintendo 64 game (22 Nov 2026): fetched in pieces (n64Game) and handed over whole as bytes, not
       text; `why` carries the fetch's own words when it could not come. */
    /* The cartridge a 64DD disk expands (26 Nov 2026): asked for as firmware dd-cart with its code as the role, found
       on a game server (n64DiskCart) and handed over whole as an N64 game is. */
    const n64DdCart = d.cwNeed === 'firmware' && d.sys === 'n64' && d.id === 'dd-cart' && !d.pick;
    if ((d.cwNeed === 'game' && d.sys === 'n64') || n64DdCart) {
      stats.asked++;
      const answer = r => {
        const u = r && r.bytes;
        if (u) { stats.answered++; const k = r.source || 'none'; stats.bySource[k] = (stats.bySource[k] || 0) + 1; }
        try {
          if (u) { const buf = u.byteOffset === 0 && u.byteLength === u.buffer.byteLength ? u.buffer : u.slice().buffer; ev.source.postMessage({ cwFile: d.n, bytes: buf, source: r.source || null }, '*', [buf]); }
          else ev.source.postMessage({ cwFile: d.n, b64: null, source: null, why: (r && r.why) || null }, '*');
        } catch (_) {}
      };
      (n64DdCart ? n64DiskCart(String(d.role || '')) : n64Game(String(d.id || ''))).then(answer, () => answer(null));
      return;
    }
    stats.asked++;
    const reply = r => { try { ev.source.postMessage({ cwFile: d.n, b64: r.b64 || null, source: r.source || null }, '*'); } catch (_) {} };
    /* FW1: a firmware ask is 'specific' (pick: <sha256>, a file the person or the game chose) or
       'generic' (the normal one for the slot, or for d.role when the game needs another). */
    const role = d.cwNeed === 'firmware' && /^[a-z][a-z0-9-]{0,23}$/.test(String(d.role || '')) ? String(d.role) : '';
    (d.cwNeed === 'firmware' && d.pick ? firmwareBySha(String(d.sys || ''), String(d.id || ''), String(d.pick)) : resolve(String(d.sys || ''), d.cwNeed, String(d.id || ''), role)).then(r => {
      stats.answered++;
      const k = r.source || 'none'; stats.bySource[k] = (stats.bySource[k] || 0) + 1;
      reply(r);
    }, () => reply({}));
  });

  window.CwSiteRelay = { BUILD, systems: () => Object.keys(SOURCES), resolve, stats, serverName, firmwareChoices };
})();

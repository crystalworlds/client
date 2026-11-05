/* nes-console.js -- THE THREE CONSOLES ON ONE NES EMULATOR (decided 2026-10-03).
 *
 *   'nes'      US and European cartridges        -- NesConsole.png
 *   'famicom'  Japanese cartridges               -- FamicomConsole.webp
 *   'fds'      Famicom Disk System disks         -- FdsConsole.webp
 *
 * One emulator shown as three consoles, as the Game Boy core is shown as Game Boy
 * and Game Boy Color. The console decides the picker section, the tile and drawer
 * art and the play window's television; the emulator is the same for all three.
 *
 * THE RULE, first answer wins. Fixed in this order after measuring it.
 *
 *   1. FILE TYPE. A disk is a disk: extension .fds or .qd, an fwNES header
 *      ("FDS" 1A), a raw side ("*NINTENDO-HVC*"), or a game server that says
 *      system "fds".                                               -> 'fds'
 *   1b. THE HASH (2026-10-15: a renamed file must not change shelf).
 *      The file's SHA-256, from its content id (nes-x<sha12>) or passed as
 *      `sha`, looked up in /nes-console-hash.js: a file whose hash matches a
 *      No-Intro (else libretro-db) entry is Famicom when that entry's region
 *      is Japan alone, NES for any other region. It comes before the
 *      manifest's `c`, because a folder does not decide the shelf (decided
 *      2026-10-14: the shelf follows the cartridge). Not for disks. A hash not
 *      in the table falls through to the steps below.         -> as listed
 *   2. AN EXPLICIT CONSOLE on the manifest entry (`c`).             -> as given
 *   3. THE NES 2.0 HEADER. Console type VS / PlayChoice / extended, or a region
 *      of PAL, multi-region or Dendy, is not a Japanese cartridge.  -> 'nes'
 *      An NTSC region decides nothing: Famicom and American carts share it.
 *   4. AN ARCADE BOARD BY NAME: a (VS) or (PC10) tag is a VS. System or
 *      PlayChoice-10 board, not a cartridge for either home console, and is
 *      shown with the NES (step 3's rule, for files with no NES 2.0 header;
 *      "Mighty Bomb Jack (J) (VS)" is the case that needs it).     -> 'nes'
 *   5. THE NAME'S COUNTRY TAGS, GoodNES (J) (U) (E) (JU) ... or No-Intro
 *      (Japan) (USA, Europe) ...    Japan alone                     -> 'famicom'
 *                                   any other country, with or without Japan -> 'nes'
 *   6. THE HEADER-CORRECTION TABLE'S REGION COLUMN (the core's hdr_table.js,
 *      passed in as `region`): PAL or Dendy                         -> 'nes'
 *   7. Otherwise                                                    -> 'nes'
 *
 * WHY THE TABLE NEVER SAYS "FAMICOM". The region column is NTSC / PAL / Dendy
 * and cannot tell a Famicom cartridge from an American one. The database it is
 * built from does have a "Famicom" System value, and it was measured and
 * rejected: it marks world releases whose content is byte-identical in both
 * markets (Super Mario Bros. (W), 1942 (JU), Donkey Kong (U)), which would have
 * moved three of the site's twelve baked NES titles onto the Famicom.
 *
 * The site often has only a name (a manifest lists titles before any bytes are
 * fetched), so classify() takes whatever is known and uses the steps it can.
 * `why` names the step that answered, so a misplaced title can be traced.
 */
(function (root) {
  'use strict';

  var GOOD = { J: 'jp', U: 'us', E: 'eu', W: 'world', A: 'au', B: 'br', C: 'cn', Ch: 'cn', F: 'eu',
               G: 'eu', H: 'eu', I: 'eu', K: 'kr', Nl: 'eu', R: 'ru', S: 'eu', Sw: 'eu' };
  var NOINTRO = { japan: 'jp', usa: 'us', europe: 'eu', world: 'world', australia: 'au', brazil: 'br',
                  china: 'cn', taiwan: 'cn', hong_kong: 'cn', korea: 'kr', russia: 'ru', france: 'eu',
                  germany: 'eu', spain: 'eu', italy: 'eu', sweden: 'eu', netherlands: 'eu', uk: 'eu',
                  canada: 'us', asia: 'cn' };

  /** The set of countries a filename's tags name; empty when it names none. */
  function nameCountries(name) {
    var out = new Set();
    var groups = String(name || '').match(/\(([^)]*)\)/g) || [];
    for (var gi = 0; gi < groups.length; gi++) {
      var g = groups[gi].slice(1, -1).trim();
      var parts = g.split(/\s*,\s*/), all = parts.length > 0, k;
      for (k = 0; k < parts.length; k++) if (!NOINTRO[parts[k].toLowerCase().replace(/ /g, '_')]) { all = false; break; }
      if (all) { for (k = 0; k < parts.length; k++) out.add(NOINTRO[parts[k].toLowerCase().replace(/ /g, '_')]); continue; }
      if (/^(?:J|U|E|W|A|B|Ch|C|F|G|H|I|K|Nl|R|Sw|S)+$/.test(g)) {
        var toks = g.match(/Ch|Nl|Sw|[JUEWABCFGHIKRS]/g) || [];
        for (k = 0; k < toks.length; k++) out.add(GOOD[toks[k]]);
      }
    }
    return out;
  }

  function isDiskName(name) { return /\.(fds|qd)$/i.test(String(name || '')); }
  function isDiskBytes(b) {
    if (!b || b.length < 16) return false;
    if (b[0] === 0x46 && b[1] === 0x44 && b[2] === 0x53 && b[3] === 0x1a) return true;   /* fwNES */
    var sig = '*NINTENDO-HVC*';
    if (b[0] !== 0x01) return false;
    for (var i = 0; i < sig.length; i++) if (b[1 + i] !== sig.charCodeAt(i)) return false;
    return true;                                                                         /* raw side */
  }

  var CRC_TAB = null;
  function crc32(b, off) {
    if (!CRC_TAB) {
      CRC_TAB = new Int32Array(256);
      for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); CRC_TAB[n] = c; }
    }
    var x = -1;
    for (var i = off; i < b.length; i++) x = (x >>> 8) ^ CRC_TAB[(x ^ b[i]) & 0xff];
    return ((x ^ -1) >>> 0).toString(16).toUpperCase();
  }
  function pad8(s) { while (s.length < 8) s = '0' + s; return s; }

  /** The content CRC (after header and trainer), or null for a file that is not iNES. */
  function contentCrc(b) {
    if (!b || b.length < 16 || b[0] !== 0x4e || b[1] !== 0x45 || b[2] !== 0x53 || b[3] !== 0x1a) return null;
    return pad8(crc32(b, 16 + ((b[6] & 4) ? 512 : 0)));
  }

  /* THE HASH TABLE (step 1b). /nes-console-hash.js is generated offline (its
     header says how) and sets self.NesConsoleHash; under Node it is required
     beside this file. Each console's string is base64 of sorted 6-byte SHA-256
     prefixes. Unpacked once, the first time a hash is asked; not cached while
     the table is absent, so a late load is still seen. */
  var HASH = null;
  function b64bytes(s) {
    if (typeof atob === 'function') {
      var bin = atob(s), u = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return u;
    }
    return new Uint8Array(Buffer.from(s, 'base64'));
  }
  function hashTable() {
    if (HASH) return HASH;
    var T = root && root.NesConsoleHash;
    if (!T && typeof module === 'object' && module.exports && typeof require === 'function') {
      try { T = require('./nes-console-hash.js'); } catch (e) { T = null; }
    }
    if (!T || typeof T.famicom !== 'string' || typeof T.nes !== 'string') return null;
    var m = new Map(), hex = '0123456789abcdef';
    [['famicom', T.famicom], ['nes', T.nes]].forEach(function (p) {
      var u = b64bytes(p[1]);
      for (var o = 0; o + 6 <= u.length; o += 6) {
        var k = '';
        for (var j = 0; j < 6; j++) k += hex[u[o + j] >> 4] + hex[u[o + j] & 15];
        m.set(k, p[0]);
      }
    });
    HASH = m;
    return m;
  }
  /** The 12 hex digits of a title's SHA-256: from `sha`, else from an id ending -x<sha12>. */
  function sha12Of(t) {
    var s = typeof t.sha === 'string' ? t.sha.toLowerCase() : '';
    if (/^[0-9a-f]{12}/.test(s)) return s.slice(0, 12);
    var m = /-x([0-9a-f]{12})$/.exec(String(t.id || ''));
    return m ? m[1] : null;
  }
  /** 'famicom' | 'nes' for a known hash, else null. */
  function byHash(t) {
    var k = sha12Of(t);
    if (!k) return null;
    var m = hashTable();
    return (m && m.get(k)) || null;
  }

  /**
   * @param {object} t  { name, id?, sha?, bytes?, system?, c?, region? }
   *   name    the file name (or the manifest's `n`)
   *   id      the title's content id (nes-x<sha12>), for the hash step
   *   sha     the file's SHA-256 (hex), when known; preferred over the id
   *   bytes   Uint8Array of the file, when it is in hand
   *   system  a game server's system string ('nes' / 'fds')
   *   c       an explicit console from the manifest entry
   *   region  the header-correction table's region column (0 NTSC, 1 PAL, 2 Dendy)
   * @returns {{console:'nes'|'famicom'|'fds', why:string}}
   */
  function classify(t) {
    t = t || {};
    var b = t.bytes || null;
    if (t.system === 'fds' || isDiskName(t.name) || isDiskBytes(b)) return { console: 'fds', why: 'file-type' };
    if (t.c !== 'fds') { var h = byHash(t); if (h) return { console: h, why: 'hash' }; }
    if (t.c === 'nes' || t.c === 'famicom' || t.c === 'fds') return { console: t.c, why: 'manifest' };
    if (b && b.length >= 16 && b[0] === 0x4e && b[1] === 0x45 && b[2] === 0x53 && b[3] === 0x1a
        && (b[7] & 0x0c) === 0x08) {
      if ((b[7] & 3) !== 0) return { console: 'nes', why: 'nes2-header' };
      if ((b[12] & 3) !== 0) return { console: 'nes', why: 'nes2-header' };
    }
    if (/\((?:VS|PC10)\)/i.test(String(t.name || ''))) return { console: 'nes', why: 'name' };
    var cs = nameCountries(t.name);
    if (cs.size) return { console: (cs.size === 1 && cs.has('jp')) ? 'famicom' : 'nes', why: 'name' };
    if (t.region === 1 || t.region === 2) return { console: 'nes', why: 'table' };
    return { console: 'nes', why: 'default' };
  }

  /* THE MICROPHONE TITLES, by name. The play page asks for the visitor's real
     microphone when one of these starts (2026-10-03: "request permission
     only when a title that uses the mic starts"); any other Famicom title can
     still turn it on from its Mic control, and the M key always works.
     NAME-MATCHED AND KNOWN TO BE INCOMPLETE: no header or table in the core
     records microphone use, so this is a list of well-known users of controller
     II's microphone, plus the HVC test cartridges. Extend it rather than
     guessing at a mechanism. */
  var MIC_TITLES = [
    /zelda no densetsu/i, /hyrule fantasy/i,               // Pols Voice
    /hikari shinwa/i, /palutena no kagami/i,                // Kid Icarus (J): haggling
    /takeshi no chou?senjou/i,                              // the karaoke stage
    /sanma no mei ?tantei/i,
    /karaoke studio/i,                                      // its own microphone, same path
    /\bhvc\b.*test|test.*\bhvc\b|controller test/i          // test cartridges
  ];
  function usesMicrophone(name) {
    var s = String(name || '');
    for (var i = 0; i < MIC_TITLES.length; i++) if (MIC_TITLES[i].test(s)) return true;
    return false;
  }

  var api = { classify: classify, usesMicrophone: usesMicrophone, nameCountries: nameCountries, contentCrc: contentCrc,
              isDiskName: isDiskName, isDiskBytes: isDiskBytes, byHash: byHash };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NesConsole = api;
})(typeof self !== 'undefined' ? self : this);

/*
 * variants.js -- one tile per game, its variants behind it (2026-10-05).
 *
 * The request: "I think its time we considered grouping variants rather than
 * having them as separate titles on separate tiles ... have a selection on the
 * play screen to select a different variant if two or more are loaded."
 * And: "we should hold a list of hashes so grouping is done by hash, not by
 * name." And: "i also dont want a setting to ungroup them. grouping is there
 * spot forever."
 *
 * GROUPING IS A LOOKUP, NEVER A GUESS. firmware/variants/<sys>.json.gz maps
 * every known file's SHA-256 to its group, its rank in the group and a label;
 * it is generated offline by WASM_Source/variants/build_variants.mjs (DAT
 * parent/clone data first, a name rule only where no DAT names the file). This
 * file parses no names. A title is found in the table by the hash its id
 * already carries (nes-x<sha12>, gb-x<sha12>, a2600-x<sha12> ...) or, for the
 * few hand-written ids (gb-tetris ...), by the table's `ids` list. A hash the
 * table does not hold stands alone until the table is regenerated.
 *
 * WHAT IT DOES:
 *   collapse(list)     a system's pool -> one entry per group: the best-ranked
 *                      member PRESENT AND PLAYABLE here (the representative when
 *                      the visitor has it). emby.js wraps every pool with it.
 *                      A group is split by system (tileKey, 3 Nov): each system
 *                      has its own tile and drawer of a game, never another's copies.
 *   the drawer         a "Variants" list (label, Default) under Facts; Play Now
 *                      plays the representative, the game on the box. Each row
 *                      plays its own variant, only when it is picked. Each list
 *                      runs A to Z after the default; a list of more than 20
 *                      versions has a filter box across all its groups.
 *   the play window    a "Variant" control in the header, only when 2+
 *                      variants are loaded; keyboard, remote and pad (also a
 *                      "Change variant" item in the Back pause menu). Switching
 *                      closes the window through closeOverlay() -- so the
 *                      Continue row keeps the outgoing variant's save, play time
 *                      is banked and the frame is discarded -- and opens the new
 *                      variant in the same turn.
 *   search             searchName(d): only a group's primary is matched by its
 *                      own name (23 Oct); searchAka(d): the game's other-region
 *                      release titles also find it (25 Oct); searchCollapse(hits)
 *                      returns the group's tile on each system it was found on.
 *   Continue row       cardLabel(id): the saved variant's label on its card.
 *                      Saves stay per file: every save store is keyed by the id.
 *   memory             localStorage 'gnw.variants.v1': group -> last-played id.
 *
 * TABLES LOAD LAZILY, ONE SYSTEM AT A TIME, the first time a pool holding that
 * system's titles is collapsed. Until then every title stands alone; when the
 * table lands the Media grid is repainted (Emby.reseedGameTiles).
 *
 * SOUND: none. Nothing here makes or starts audio; tiles stay silent.
 */
(function () {
  'use strict';
  if (window.Variants) return;

  const BASE = (function () {
    try { const s = document.currentScript && document.currentScript.src; if (s) return s.replace(/[^/]*$/, '') + 'firmware/variants/'; } catch (e) {}
    return 'firmware/variants/';
  })();
  const LS = 'gnw.variants.v1';
  /* The tables' own cache tag: bump it whenever build_variants.mjs is re-run. */
  const TABLES = '2.1.1';
  const T = {};           // sys -> { by12: Map(sha12 -> row), ids: {}, groups: [] }
  const loading = {};     // sys -> Promise
  let version = 0;        // bumps when a table lands
  const hit = new WeakMap();   // dev -> { v, row, sha }

  /* ---------------------------------------------------------------- tables */
  function sysOf(d) {
    const c = d && d.catalogue;
    if (c === 'nes') return 'nes';
    if (c === 'game-boy') return 'gb';
    if (c === 'atari2600' || c === 'atari5200' || c === 'atari7800' || c === 'atarilynx') return c;
    if (c === 'pokemon-mini') return 'pm';
    return null;
  }
  function gunzipJson(ab) {
    const u = new Uint8Array(ab);
    if (u.length > 2 && u[0] === 0x1f && u[1] === 0x8b) {
      const ds = new DecompressionStream('gzip');
      const w = ds.writable.getWriter(); w.write(u); w.close();
      return new Response(ds.readable).json();
    }
    return Promise.resolve(JSON.parse(new TextDecoder().decode(u)));
  }
  function load(sys) {
    if (loading[sys]) return loading[sys];
    loading[sys] = fetch(BASE + sys + '.json.gz?v=' + TABLES)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then(gunzipJson)
      .then(j => {
        const by12 = new Map();
        /* plain: the groups that hold at least one copy that is not a translation, hack, trainer or
           hacked copy (4 Nov: Yuefei Chuan is known only as a hacked dump, so that dump is the game) */
        const plain = new Set();
        for (const sha in j.files) { const row = j.files[sha]; by12.set(sha.slice(0, 12), { sha, row }); if (!/[THth]/.test(String(row[3]).replace('R', ''))) plain.add(row[0]); }
        T[sys] = { by12, ids: j.ids || {}, groups: j.groups || [], plain };
        version++;
        applyNames(sys);
        landed(sys);
        return T[sys];
      })
      .catch(err => { console.warn('[variants] no table for ' + sys + ' (' + (err && err.message || err) + '); its titles stand alone'); T[sys] = null; return null; });
    return loading[sys];
  }
  /** The table row for a title, or null (unknown hash, or table not here yet). */
  function info(d) {
    if (!d || !d.id) return null;
    const c = hit.get(d);
    if (c && c.v === version) return c.e;
    const sys = sysOf(d);
    let e = null;
    if (sys) {
      const t = T[sys];
      if (t === undefined) load(sys);
      else if (t) {
        const m = /-x([0-9a-f]{12})$/.exec(d.id);
        const sha = m ? m[1] : (t.ids[d.id] || '').slice(0, 12);
        const f = sha && t.by12.get(sha);
        if (f) e = { sys, sha: f.sha, g: f.row[0], rank: f.row[1], shelf: f.row[2], flags: f.row[3], label: f.row[6] || '', kind: (t.groups[f.row[0]] || [])[2] || '',
                     /* A HACK IS ALWAYS A VARIANT (3 Nov 2026: "hacks are clearly variants and need to always be
                        with the primary game ... No hack should have its own tile. The user should have the original
                        game to show a hack"). th: a fan translation (T), a named hack (H), a trainer copy (t) or a
                        hacked copy (h, the GoodTools [h] tag; 26 Oct: Picross 2 and Nettou KOF '96 on the Super Game
                        Boy shelf). Never a tile; a version of its original's tile (tileKey).
                        A REPAIR COPY IS THE GAME (4 Nov): a mapper or copier fix ([hM03], [hFFE]) only makes a bad
                        dump run and changes nothing in the game, so like a fixed dump [f] it is the game itself.
                        So is a hacked dump of a game known only from hacked dumps (4 Nov: Yuefei Chuan, an unlicensed
                        game whose one dump is marked [h1]): there is no other copy for it to be a version of. */
                     th: /[THt]/.test(String(f.row[3]).replace('R', '')) || (/h/.test(String(f.row[3])) && !repairOnly(f.row[6]) && t.plain.has(f.row[0])) };
      }
    }
    hit.set(d, { v: version, e });
    return e;
  }
  /** A copy whose only [h...] tags are repairs: a mapper fix [hM<n>] or a copier fix [hFFE] (4 Nov). */
  function repairOnly(label) {
    const h = String(label || '').match(/\[h[^\]]*\]/g);
    return !!h && h.every(x => /^\[h(M\d+|FFE)\]$/.test(x));
  }
  /** The game: its table group, on every system the table covers (NES, Famicom and Disk System
      share one table, as Game Boy, Color and Super Game Boy do). Used for what a game may share
      across systems: its manual, box, details and other names. */
  function keyOf(d) { const e = info(d); return e ? e.sys + ':' + e.g : null; }
  /** THE SAME GAME ON ANOTHER SYSTEM IS NOT A VARIANT (3 Nov 2026: "NES and Famicom are not the
      same even if their game files are byte for byte identical ... they are not variants. Variants
      are like the different versions of the same game under the same system: hacks, translations
      ... or regions of the same game"). A tile and its drawer hold one system's files only: the key
      is the game on the title's own system (shelfOf), so NES Super C and Famicom Super Contra are two
      tiles with two drawers. This reverses the 1 Nov reading (one drawer listing every system's copies).
      HACKS AND TRANSLATIONS ARE THE EXCEPTION (3 Nov, later): they always go with their original game,
      on their own system when the original is there, else on the system of its best copy (the hack
      "Super X-Wing 97", kept with the NES games, is a version in the Famicom Argus drawer). With no
      copy of the original present they belong to no tile: homeShelf is null and they are not shown. */
  function tileKey(d) { const e = info(d); return e ? e.sys + ':' + e.g + ':' + (e.th ? homeShelf(d) : shelfOf(d)) : null; }
  function homeShelf(d) {
    const c = catIndex().get(keyOf(d)); if (!c || !c.off) return null;
    const own = shelfOf(d);
    return c.by.has(own) ? own : shelfOf(c.off);
  }

  /** The sha256 of the REPRESENTATIVE (table flag R) of a file's group on that
      file's own shelf, for a content-addressed id (nes-x<sha12> ...). Used by
      nesvideo.js: the capture recorded representatives only, so a tile showing
      any variant plays its representative's clip (decided 2026-10-05). The R
      flag is taken as written, whatever the blacklists later promoted for
      display -- a clip only shows what the game looks like.
        undefined  the table has not landed yet (its load is started)
        null       no table, a hash it does not hold (standalone), or no R row
        sha256     the representative (the file's own sha when it IS one) */
  function repOf(sys, id) {
    const r = repRow(sys, id);
    return r ? r.sha : r;
  }
  /** repOf with the facts a caller may need: { sha, shelf, self } where
      `self` is true when the file IS its group's representative. Hand-written
      ids (gb-tetris ...) are found through the table's `ids` list. */
  function repRow(sys, id) {
    const t = T[sys];
    if (t === undefined) { load(sys); return undefined; }
    if (!t) return null;
    const m = /-x([0-9a-f]{12})$/.exec(id || '');
    const sha12 = m ? m[1] : (t.ids[id] || '').slice(0, 12);
    const f = sha12 && t.by12.get(sha12);
    if (!f) return null;
    if (String(f.row[3]).indexOf('R') >= 0) return { sha: f.sha, shelf: f.row[2], self: true };
    if (!t.rep) {
      t.rep = new Map();
      t.by12.forEach(x => { if (String(x.row[3]).indexOf('R') >= 0) t.rep.set(x.row[0] + '|' + x.row[2], x); });
    }
    /* A translation or hack on a shelf where its group has no representative
       (a Famicom game's hack classed NES) plays its group's official clip. */
    let r = t.rep.get(f.row[0] + '|' + f.row[2]);
    if (!r) for (const [k, x] of t.rep) if (k.slice(0, k.indexOf('|')) === String(f.row[0])) { r = x; break; }
    /* A representative on the unsupported list is never a tile (it is dropped
       before grouping), so its clip was never captured: the tile is the file
       itself and plays its own clip (2026-10-11: Banana (J) is listed, so the
       visitor's Banana [T-En] tile plays nes-xce0078c07008, captured for it). */
    if (r) { try { const U = window.CWSUnsupported; if (U && typeof U.lookup === 'function' && U.lookup(r.sha)) return { sha: f.sha, shelf: f.row[2], self: true }; } catch (e) {} }
    return r ? { sha: r.sha, shelf: r.row[2], self: false } : null;
  }
  /** SHA-1 (lowercase hex) of a file in a system's table, from its cross-
      reference <sys>.xref.json.gz -- loaded lazily, once, the first time it
      is asked (gbvideo.js asks only after a tile's own clip has missed: the
      Game Boy clips are published under SHA-1). Resolves null when unknown. */
  const xrefs = {};
  function sha1Of(sys, sha256) {
    if (!xrefs[sys]) {
      xrefs[sys] = fetch(BASE + sys + '.xref.json.gz?v=' + TABLES)
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
        .then(gunzipJson)
        .then(j => (j && j.files) || null)
        .catch(() => null);
    }
    return xrefs[sys].then(f => { const e = f && sha256 && f[sha256]; return e && e[1] ? String(e[1]).toLowerCase() : null; });
  }

  /* A STANDALONE fan-translation group's tile says so (kind T: no parent game
     could be looked up for it, so it keeps a group of its own): its members'
     names were tidied of the [T+...] tag, so without this it reads as a second
     copy of the game. A translation whose parent was found is a variant of that
     game (2026-10-10) and its group is not kind T, so nothing is renamed. */
  function applyNames(sys) {
    const t = T[sys]; if (!t || typeof ALL_DEVICES === 'undefined') return;
    for (const d of ALL_DEVICES) {
      if (sysOf(d) !== sys) continue;
      const e = info(d);
      if (e && e.kind === 'T' && t.groups[e.g] && !d.__vrNamed) { d.__vrNamed = d.name; d.name = t.groups[e.g][0]; }
    }
  }

  /* ---------------------------------------------------------------- pools */
  function shelfOf(d) {
    if (d.catalogue === 'nes') return d.nesConsole || 'nes';
    /* The Media grid's own split (emby.js gbSystem: system 'gbc' or not). The
       hand-written DMG entries carry no `system` while pack and game-server
       titles carry 'gb', so `d.system || 'dmg'` put gb-sml2 and its gb-x<sha12>
       siblings on different shelves and no Game Boy group ever had 2 members. */
    if (d.catalogue === 'game-boy') return d.sgb ? 'sgb' : d.system === 'gbc' ? 'gbc' : 'gb';   // sgb: the Super Game Boy shelf
    return d.catalogue;
  }
  const isTH = d => { const e = info(d); return !!(e && e.th); };
  function playable(d) {
    try {
      const c = d.catalogue;
      if (c === 'nes') return typeof nesPlayable === 'function' ? !!nesPlayable(d) : true;
      if (c === 'game-boy') return typeof gbPlayable === 'function' ? !!gbPlayable(d) : true;
      if (c && c.indexOf('atari') === 0) return typeof atariPlayable === 'function' ? !!atariPlayable(d) : true;
      if (c === 'pokemon-mini') return typeof pmPlayable === 'function' ? !!pmPlayable(d) : true;
    } catch (e) {}
    return false;
  }
  const better = (a, b) => { const ea = info(a), eb = info(b); return ea.rank < eb.rank || (ea.rank === eb.rank && a.id < b.id); };

  /* THE UNSUPPORTED LIST (firmware/site/unsupported.js, 2026-10-05). A listed file
     is dropped from every pool BEFORE grouping, so it is never a group's
     representative, never counted as a variant and never a search hit. A group
     whose files are all listed therefore has no tile: hidden rather than shown
     "Not supported yet", because a tile that can only refuse is a dead end for a
     remote, and the public count in Settings keeps the number visible (see
     tools/unsupported/README.md). */
  function blocked(d) {
    try { return !!(d && window.CWSUnsupported && window.CWSUnsupported.forDevice(d)); } catch (e) { return false; }
  }
  const supported = list => (Array.isArray(list) ? list.filter(d => !blocked(d)) : list);

  /* FAN TRANSLATIONS AND HACKS ARE VARIANTS OF THEIR GAME (decided 2026-10-10;
     3 Nov: "No hack should have its own tile. The user should have the original
     game to show a hack"). The index holds, per game (keyOf, every system), the
     best official copy present and playable and the best one on each system; a
     translation or hack is listed with that (homeShelf), and with no official copy
     anywhere it is not shown at all (it used to stand in as the game's tile).
     Built once per turn from ALL_DEVICES (playable and supported only). */
  let cat = null;
  /* KEPT PAST THE TURN WHILE A SEARCH IS TYPED (4 Nov 2026). This index and groupOf's below are
     dropped at the end of each turn, so each letter typed on the All Consoles wall built both
     again (about 0.1 s). emby.js keeps its own look-up of the shelves while a search is typed
     and hands its key here (keepIndexWith); while that key is the same object, nothing on the
     shelves has changed and the index stands. A new or dropped key builds it again as before. */
  let keepKeyOf = null;
  const keepKey = () => { try { return keepKeyOf ? keepKeyOf() || null : null; } catch (e) { return null; } };
  function catIndex() {
    if (cat && cat.v === version && cat.n === ALL_DEVICES.length && (cat.turn || (cat.k && cat.k === keepKey()))) return cat.m;
    const m = new Map();
    for (const x of ALL_DEVICES) {
      if (!x || !sysOf(x)) continue;
      const e = info(x); if (!e || e.th) continue;
      if (!playable(x) || blocked(x)) continue;
      const k = keyOf(x), s = shelfOf(x);
      let c = m.get(k); if (!c) m.set(k, c = { off: null, by: new Map() });
      if (!c.off || better(x, c.off)) c.off = x;
      const b = c.by.get(s); if (!b || better(x, b)) c.by.set(s, x);
    }
    const c = cat = { v: version, n: ALL_DEVICES.length, m, turn: true, k: keepKey() };
    setTimeout(() => { c.turn = false; if (cat === c && !c.k) cat = null; }, 0);
    return m;
  }

  /** One entry per group, in the pool's own order: the best-ranked member present. */
  function collapse(list) {
    list = supported(list);
    if (!Array.isArray(list) || !list.length || typeof ALL_DEVICES === 'undefined') return list;
    const best = new Map();
    let any = false;
    for (const d of list) {
      const k = tileKey(d); if (!k) continue;
      any = true;
      if (isTH(d)) continue;   // a translation or hack is never a tile (3 Nov)
      const b = best.get(k);
      if (!b || better(d, b)) best.set(k, d);
    }
    if (!any) return list;
    return list.filter(d => {
      const k = tileKey(d);
      if (!k) return true;
      return best.get(k) === d;
    });
  }

  /* THE TITLES OF ONE GROUP, from an index built once per turn (2026-10-24). members()
     walked every loaded title (about 27,000 with a big library) for each tile it was asked about,
     and every tile asks (its version count): a rebuild of a 1,680-tile wall spent 2.7 s here of a
     5.1 s freeze, and each new page of 80 tiles about 130 ms. The index holds, per catalogue, the
     titles of each group in ALL_DEVICES order, built only for a catalogue that is asked about (as
     the old walk only asked those titles), and dropped at the end of the turn like catIndex(), so
     the answers are the old walk's exactly. */
  let grp = null;
  function groupOf(catalogue, k) {
    if (!grp || grp.v !== version || grp.n !== ALL_DEVICES.length || !(grp.turn || (grp.k && grp.k === keepKey()))) { grp = { v: version, n: ALL_DEVICES.length, by: new Map(), turn: true, k: keepKey() }; const g = grp; setTimeout(() => { g.turn = false; if (grp === g && !g.k) grp = null; }, 0); }   // kept while a search is typed (keepKeyOf)
    let m = grp.by.get(catalogue);
    if (!m) {
      m = new Map();
      for (const x of ALL_DEVICES) {
        if (!x || x.catalogue !== catalogue) continue;
        const kx = tileKey(x); if (!kx) continue;
        let a = m.get(kx); if (!a) m.set(kx, a = []);
        a.push(x);
      }
      grp.by.set(catalogue, m);
    }
    return m.get(k) || [];
  }

  /** Every variant of a title that is loaded here and playable, best first: the
   *  members of its game on the title's own system (tileKey), releases, translations
   *  and hacks alike. A title outside any group is its own one-entry list.
   *  ONLY THE TITLE'S OWN SYSTEM (3 Nov 2026, reversing 1 Nov): the game's copies on
   *  another system (NES beside Famicom and Disk System; Game Boy beside Color and Super
   *  Game Boy) are that system's own tile and drawer, never versions here, even when the
   *  files are byte for byte the same. The exception is a translation or hack: it is
   *  listed with its original (homeShelf), whatever system it is kept with. */
  function members(idOrDev) {
    const d = typeof idOrDev === 'string' ? find(idOrDev) : idOrDev;
    if (!d) return [];
    const k = tileKey(d);
    if (!k || typeof ALL_DEVICES === 'undefined') return [d];
    const out = [];
    for (const x of groupOf(d.catalogue, k)) if (playable(x) && !blocked(x)) out.push(x);
    if (!out.includes(d)) out.push(d);
    out.sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : 0));
    /* ONE FILE, ONE MEMBERSHIP (2026-10-14). One file can reach the page under
       two ids: a catalogue id the table maps to it (pm-pokemon-breeder-mini)
       and a game server's pm-x<sha12>. It is one variant: the first id in rank
       order stands for it, so counts and the version menus list it once. The
       title asked about keeps its own id when it is one of the pair. */
    const seen = new Map();
    for (const x of out) { const e = info(x), h = e ? e.sha : 'id:' + x.id; if (!seen.has(h) || x === d) seen.set(h, x); }
    const keep = new Set(seen.values());
    return out.filter(x => keep.has(x));
  }
  function find(id) { try { return (typeof ALL_DEVICES !== 'undefined' && ALL_DEVICES.find(x => x.id === id)) || null; } catch (e) { return null; } }

  /** Search: hits on any variant -> that group's tile in the (collapsed) pool.
   *  ONE TILE PER GAME AND SYSTEM IN A SEARCH (22 Oct:"search results must not
   *  include variants ... the list gets huge"; 3 Nov: a copy on another system is not a
   *  variant). A game is answered once on each system its hits are on, by that system's
   *  tile (tileKey): "Super Contra" finds the Famicom Super Contra tile and the NES Super C
   *  tile. `systems` (optional, every asked-for game system) is where the tile is looked
   *  for. `shown` (optional) is the type boxes' test: a game whose tile they hide is not
   *  answered (3 Nov: Super Contra 8 is an unlicensed game, so with only Commercial ticked
   *  it is not on the wall and its trainer copy, filed with the hacks, must not bring its
   *  tile into a search either).
   *  THE TILE NAMED WHAT WAS TYPED (2 Nov:"Super Contra" under All Consoles showed Super C
   *  and not the Famicom Super Contra tile). `pref` (optional, d -> number, lower first) is
   *  asked before the rank: emby.js gives 0 to a tile whose own name is the search, 1 to one
   *  whose name starts with it, 2 to the rest, so the game's one tile is the copy whose name
   *  was typed (Famicom Super Contra, Akumajou Dracula, Rockman) and otherwise the best-ranked
   *  as before. Still one tile per game and system. */
  function searchCollapse(hits, systems, shown, pref) {
    const reps = new Map(), out = [], seen = new Set();
    const repsOf = s => {
      let m = reps.get(s.id);
      if (!m) { m = new Map(); try { for (const d of s.pool()) { const kk = tileKey(d); if (kk) m.set(kk, d); } } catch (e) {} reps.set(s.id, m); }
      return m;
    };
    const ok = d => { try { return !shown || !!shown(d); } catch (e) { return true; } };
    const pf = d => { if (typeof pref !== 'function') return 0; try { return +pref(d) || 0; } catch (e) { return 0; } };
    const beats = (r, b) => { const a = pf(r), c = pf(b); return a < c || (a === c && better(r, b)); };
    for (const h of hits) {
      if (blocked(h.dev)) continue;
      const k = tileKey(h.dev);
      if (!k) { if (!seen.has('id|' + h.dev.id)) { seen.add('id|' + h.dev.id); out.push(h); } continue; }
      if (seen.has(k)) continue;
      seen.add(k);
      let best = null, bestOk = null;
      const shelves = [h.sys].concat(Array.isArray(systems) ? systems : []);
      for (const s of shelves) {
        if (!s || typeof s.pool !== 'function') continue;
        const r = repsOf(s).get(k); if (!r) continue;
        if (!best || beats(r, best.dev)) best = { sys: s, dev: r };
        if (ok(r) && (!bestOk || beats(r, bestOk.dev))) bestOk = { sys: s, dev: r };
      }
      if (shown && best && !bestOk) continue;   // its tile is hidden by the type boxes, as on the wall
      out.push(bestOk || best || h);
    }
    return out;
  }
  /** ONLY THE PRIMARY IS SEARCHABLE (23 Oct:"Hacks, translations, other regions
   *  and all variants should not be included in the search"). The name a search may
   *  match a title by: null when the title is its group's primary (rank 0) or in no
   *  group, so its own fields are searched; otherwise its group's display title (the
   *  primary's title), so a version is found only by the primary's name. '' (never
   *  matched by name) for a group of fan translations or a named hack whose original
   *  could not be found (kind T / H): hacks and translations are not searchable, even
   *  as their own group (decided 23 Oct). '' for every translation and hack (3 Nov): it
   *  is never a tile, and its original is found by its own name. */
  const thAlone = d => { const e = info(d); return !!(e && e.th); };
  function searchName(d) {
    const e = info(d);
    if (e && (e.kind === 'T' || e.kind === 'H')) return '';
    if (thAlone(d)) return '';
    if (!e || e.rank === 0) return null;
    /* A TILE IS FOUND BY ITS OWN NAME (5 Nov): each system has its own tile, and a tile's main copy is the primary of
       that system. Asked by the group's title alone, the NES Lost Levels tile "Super Mario Bros. 2" answered only to
       the disk's "Super Mario Brothers 2", and the search missed it. The group's other copies still answer to that title. */
    if (/R/.test(String(e.flags))) return null;
    const t = T[e.sys], g = t && t.groups[e.g];
    return g && g[0] ? String(g[0]) : null;
  }
  /** OTHER-REGION NAMES FIND THE GAME (decided 25 Oct:"Rockman" finds Mega
   *  Man, "Akumajou Dracula" finds Castlevania). The other titles the game's official
   *  releases carry, from the table's 5th group field (build_variants.mjs: commercial
   *  releases only, never a pirate relabel, a hack or a translation), or null. Any member
   *  of the group answers the same list, so a visitor holding only the US file still finds
   *  it by its Japanese name; the result is the game's tile on the file's own system
   *  (searchCollapse), with its "Also called" line. '' from
   *  searchName (standalone hacks and translations) is never asked. */
  function searchAka(d) {
    const e = info(d);
    if (!e || e.kind === 'T' || e.kind === 'H' || thAlone(d)) return null;
    const t = T[e.sys], g = t && t.groups[e.g];
    const more = g && Array.isArray(g[4]) && g[4].length ? g[4] : [];
    /* A system's main copy that answers to its own name (searchName) still answers to the group's title too (5 Nov). */
    if (g && g[0] && e.rank !== 0 && /R/.test(String(e.flags))) return more.concat([String(g[0])]);
    return more.length ? more : null;
  }
  /** False while the variants table for this title's system has not landed (and starts
   *  its load): a search holds such titles back rather than list every file of every
   *  game (22 Oct: "super mario bros" was 491 tiles until the NES table
   *  landed, 13 after). A missing table settles too: its titles stand alone. */
  function settled(d) {
    const sys = sysOf(d);
    if (!sys) return true;
    if (T[sys] === undefined) { load(sys); return false; }
    return true;
  }

  /* ---------------------------------------------------------------- memory */
  const LS2 = 'gnw.variants.v2';
  /* NO VERSION IS REMEMBERED (5 Nov 2026). Play on a tile or in a drawer always opens the game on
     the box; a variant plays only when it is picked. What an older visit stored is dropped here. */
  try { localStorage.removeItem(LS2); localStorage.removeItem(LS); } catch (e) {}
  function remember() {}
  function lastUsed() { return null; }
  /** A group's id that survives a rebuild while its representative stays: the
      table's 4th group field (the representative's sha256, 16 hex), else null. */
  function groupId(d) { const e = info(d); if (!e) return null; const g = T[e.sys] && T[e.sys].groups[e.g]; return g && g[3] ? e.sys + ':' + g[3] : null; }
  /** What Play means for a group: the game on the box, its representative; with a preferred
      region set (9 Nov 2026), that region's release when the game has one here (regionPick). */
  function preferred(id) {
    const ms = members(id);
    if (ms.length < 2) return id;
    const r = region ? regionPick(ms) : null;
    return (r || ms[0]).id;
  }

  /* ---------------------------------------------------------------- preferred region
     9 Nov 2026: "the preferred version just changes the order of the Variants list. Basically opens the
     default or specific region file if its available as a variant." Settings > Screen and tiles sets it:
     Default (no preference), USA, Europe or Japan, kept in this browser (gnw.region.v1). With a region set,
     that region's versions come first in every Variants list (split, so the drawer, the play window's
     Variant menu and the Control Bar alike), then the rest in the usual order; Play opens that region's
     release when the game has one, else the game on the box. Tiles, search, box art and where hacks and
     translations sit do not change, and saves stay per file. Nothing is remembered about what was played.
     A VERSION'S REGION is read from its label in the table, the part build_variants.mjs writes from the
     file's No-Intro or GoodTools region tags ("USA", "USA, Europe", "Japan", "Germany"); a label with no
     such part falls back to the table's region field, which reads an untagged Atari file as the NTSC
     original (USA). "World" names no one region, so it counts for none. A country counts for its region
     after the region's own name (Canada for USA; the European countries and Australia for Europe).
     Play takes a release only: never a translation, hack, changed or bad copy, pirate, prototype or demo,
     or an arcade board's file. */
  const LS_REGION = 'gnw.region.v1';
  const REGION_KEYS = ['usa', 'europe', 'japan'];
  let region = '';
  try { const r = localStorage.getItem(LS_REGION); if (REGION_KEYS.indexOf(r) >= 0) region = r; } catch (e) {}
  const REGION_WORDS = new Set(['japan', 'usa', 'europe', 'world', 'australia', 'brazil', 'china', 'taiwan', 'hong kong', 'korea', 'russia',
    'france', 'germany', 'spain', 'italy', 'sweden', 'netherlands', 'uk', 'canada', 'asia', 'denmark', 'norway', 'finland', 'portugal', 'greece', 'poland', 'scandinavia']);
  const REGION_OWN = { usa: ['usa'], europe: ['europe'], japan: ['japan'] };
  const REGION_ALSO = { usa: ['canada'], europe: ['france', 'germany', 'spain', 'italy', 'sweden', 'netherlands', 'uk', 'denmark', 'norway', 'finland', 'portugal', 'greece', 'poland', 'scandinavia', 'australia'], japan: [] };
  const RANK_WORD = { 1: 'usa', 2: 'europe', 3: 'japan' };   // the table's region field: 0 World, 1 USA, 2 Europe/Australia/PAL, 3 Japan
  /** The region words of a title's version ('usa', 'europe', ...), or null when none can be read. */
  function regionWords(d) {
    const e = info(d); if (!e) return null;
    for (const seg of String(e.label || '').split(' · ')) {
      const ps = seg.split(/\s*,\s*/).map(s => s.trim().toLowerCase()).filter(Boolean);
      if (ps.length && ps.every(p => REGION_WORDS.has(p))) return ps;
    }
    const t = T[e.sys], f = t && t.by12.get(e.sha.slice(0, 12)), w = f && RANK_WORD[f.row[4]];
    return w ? [w] : null;
  }
  /** 1 the version names the preferred region, 2 one of its countries, 0 neither (or no region set). */
  function regionTier(d) {
    if (!region) return 0;
    const w = regionWords(d); if (!w) return 0;
    if (w.some(x => REGION_OWN[region].indexOf(x) >= 0)) return 1;
    if (w.some(x => REGION_ALSO[region].indexOf(x) >= 0)) return 2;
    return 0;
  }
  /** The release Play opens for the preferred region, from a members() list (best first), or null. */
  function regionPick(ms) {
    let best = null, bt = 9;
    for (const x of ms) {
      const k = classOf(x); if (k.c !== 'r' || k.bad) continue;
      const e = info(x); if (e && /[pdAx]/.test(String(e.flags || ''))) continue;
      const t = regionTier(x);
      if (t && t < bt) { best = x; bt = t; }
    }
    return best;
  }
  function getRegion() { return region; }
  function setRegion(r) {
    region = REGION_KEYS.indexOf(r) >= 0 ? r : '';
    try { if (region) localStorage.setItem(LS_REGION, region); else localStorage.removeItem(LS_REGION); } catch (e) {}
    /* An open drawer and play window list their versions again in the new order. */
    try { const dm = document.getElementById('device-modal'), s = dm && dm.querySelector('.vr-sect'); if (s) { s.remove(); decorateDrawer(); } } catch (e) {}
    try { PLAY_OVS.forEach(renderPicker); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('gnw-region', { detail: { region } })); } catch (e) {}
    return region;
  }

  /* ---------------------------------------------------------------- files no table knows
     9 Nov 2026: a game file whose fingerprint is in no table is shown as homebrew, with a notice asking for
     what it is and where it was found (drawer-unified.js fillUnknown; emby.js gameTypeKey). True only for a
     content-addressed id (<prefix>-x<12 hex>) whose system's table has landed and holds no such file; a
     table still loading, or missing, answers false (nothing is claimed about a file not yet looked up).
     The site's types table is asked by emby.js (cwUnknownGame) as well. */
  const ID_SYS = { nes: 'nes', gb: 'gb', pm: 'pm', a2600: 'atari2600', a5200: 'atari5200', a7800: 'atari7800', alynx: 'atarilynx' };
  function unknown(x) {
    const id = typeof x === 'string' ? x : x && x.id;
    const m = /^([a-z0-9]+)-x([0-9a-f]{12})$/.exec(id || '');
    const sys = m && ID_SYS[m[1]]; if (!sys) return false;
    const t = T[sys];
    if (t === undefined) { load(sys); return false; }
    return !!t && !t.by12.has(m[2]);
  }
  function labelOf(d) { const e = info(d); return (e && e.label) || (d && (d.fullName || d.name)) || ''; }
  function cardLabel(id) { const d = find(id); return d && members(d).length > 1 ? labelOf(d) : ''; }

  /* ---------------------------------------------------------------- releases, hacks, translations
     Reported 2026-10-13: "Super Mario Bros. shows 1,099 variations: 17 are real
     releases and 1,082 are fan hacks and translations." Counts show releases
     apart from the rest, and the version menus (play window, Control Bar,
     drawer) list only releases at the top level; the rest sit in submenus.

     THE RULE. A file's class comes from the table's FLAGS (legend in
     firmware/variants/<sys>.json.gz), never from its source letter D|I|N|S:
       't'  Translations   flag T. Checked first, so a translated hack is a translation.
       'h'  Hacks          flag H; also a release's GoodTools modifications:
                           t trainer, f fixed, h modified dump. Changed files, not releases.
       'o'  Other copies   a release's bad (b) or overdumped (o) dump.
       'r'  release        everything else: verified, plain, alternate (a), pirate (p),
                           unlicensed (u), arcade board (A), prototype/demo (d),
                           homebrew (m). An alternate is another dump of a real cartridge
                           and a pirate was a real cartridge on sale, so both are versions.
     Bad and overdumped files are never at the top level: a bad translation or hack
     goes to the END of its own submenu (bad = true), a bad release to Other copies.
     A title the table does not hold is a release. The table's own grouping is
     not touched here (that is build_variants.mjs's job). */
  function classOf(d) {
    const e = info(d);
    if (!e) return { c: 'r', bad: false };
    const f = String(e.flags || '');
    const bad = /[bo]/.test(f);
    if (f.indexOf('T') >= 0) return { c: 't', bad };
    if (f.indexOf('H') >= 0) return { c: 'h', bad };
    if (bad) return { c: 'o', bad: true };
    if (/[tfh]/.test(f)) return { c: 'h', bad: false, mod: true };
    return { c: 'r', bad: false };
  }
  /** A member list split by class, each part in the list's own order with bad
      and overdumped files moved to its end: { r, t, h, o }.
      Hacks open on the NAMED hacks (decided 2026-10-13): a release's trainer,
      fixed or modified-dump copy ([t1], [f1], [h1], classOf's `mod`) comes
      after them, then the bad dumps as before. Order within each part is the
      list's own. Counts use this one: every tile asks, and a count needs no order. */
  function splitAsListed(list) {
    const p = { r: [], t: [], h: [], o: [] }, late = { r: [], t: [], h: [], o: [] }, mods = [];
    for (const x of list || []) { const k = classOf(x); if (k.mod) mods.push(x); else (k.bad ? late : p)[k.c].push(x); }
    p.h = p.h.concat(mods);
    for (const c of 'rtho') p[c] = p[c].concat(late[c]);
    return p;
  }
  /* A TO Z (7 Nov 2026). The sort looks past case, accents, the "Hack:" every named hack's label
     opens with, and leading punctuation or an English article; the labels themselves are not
     changed. Numbers run in number order (Bros. 2 before Bros. 10). */
  const fold = s => String(s == null ? '' : s).normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase()
    .replace(/[\u00df\u00e6\u00f8\u0111\u0142]/g, c => ({ '\u00df': 'ss', '\u00e6': 'ae', '\u00f8': 'o', '\u0111': 'd', '\u0142': 'l' }[c]));
  const shownName = x => labelOf(x) || x.fullName || x.name || '';
  const sortKeys = new WeakMap();
  function sortKey(x) {
    const c = sortKeys.get(x);
    if (c && c.v === version) return c.k;
    const whole = fold(shownName(x));
    let k = whole, was;
    do { was = k; k = k.replace(/^[^\p{L}\p{N}]+/u, '').replace(/^hack\s*:\s*/, '').replace(/^(?:the|an?)\s+/, ''); } while (k !== was);
    k = k || whole;
    sortKeys.set(x, { v: version, k });
    return k;
  }
  const collate = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
  /** The menus' split: each run of a part A to Z, the same parts and runs as splitAsListed
      (named hacks, then changed copies, then bad dumps: the rulings above). `list` is a
      members() list, so list[0] is the default, and it stays first in its part. */
  function split(list) {
    if (!Array.isArray(list) || !list.length) return splitAsListed(list);
    const def = list[0];
    const rest = list.slice(1).map(x => ({ x, k: sortKey(x) })).sort((a, b) => collate.compare(a.k, b.k)).map(a => a.x);
    let order = [def].concat(rest), lead = def;
    /* A PREFERRED REGION (9 Nov 2026): its versions first, the region's own name before its countries, each in the
       usual order, the release Play opens leading; then the rest as before. */
    if (region) {
      const t = new Map(order.map(x => [x, regionTier(x)]));
      if (order.some(x => t.get(x))) {
        order = order.filter(x => t.get(x) === 1).concat(order.filter(x => t.get(x) === 2), order.filter(x => !t.get(x)));
        lead = regionPick(list);   // null: no release of the region to lead; its other versions still come first
      }
    }
    const p = splitAsListed(order);
    if (lead) { const part = p[classOf(lead).c], at = part.indexOf(lead); if (at > 0) { part.splice(at, 1); part.unshift(lead); } }
    return p;
  }
  /** { versions, translations, hacks, other, total } for a title's loaded variants. */
  function counts(idOrDev) {
    const ms = members(idOrDev), p = splitAsListed(ms);
    return { versions: p.r.length, translations: p.t.length, hacks: p.h.length, other: p.o.length, total: ms.length };
  }
  const fmt = n => Number(n).toLocaleString('en-AU');
  const plural = (n, one, many) => fmt(n) + ' ' + (n === 1 ? one : many);
  /** "14 versions", and the rest apart: "54 translations · 1,028 hacks · 17 other copies". */
  function countParts(c) {
    const rest = [];
    if (c.translations) rest.push(plural(c.translations, 'translation', 'translations'));
    if (c.hacks) rest.push(plural(c.hacks, 'hack', 'hacks'));
    if (c.other) rest.push(plural(c.other, 'other copy', 'other copies'));
    return { versions: plural(c.versions, 'version', 'versions'), rest: rest.join(' · ') };
  }
  function countText(c) { const p = countParts(c); return p.rest ? p.versions + ', ' + p.rest.replace(/ · /g, ', ') : p.versions; }
  /* The submenus, in the order they are listed under the releases. */
  const SUBS = [['t', 'Translations'], ['h', 'Hacks'], ['o', 'Other copies']];
  const SUB_NAME = { t: 'Translations', h: 'Hacks', o: 'Other copies' };
  /* A submenu shows this many at a time, then "Show more": a 1,000-entry list
     stays light for a phone and short for a remote. */
  const PAGE = 50;
  /* The drawer's list has a filter box above this many versions, counting every group. */
  const FIND_OVER = 20;

  /* ---------------------------------------------------------------- play */
  const OVERLAYS = { 'nes': 'nes-play-overlay', 'game-boy': 'gb-play-overlay', 'pokemon-mini': 'pm-play-overlay' };
  const overlayFor = d => OVERLAYS[d.catalogue] || (d.catalogue.indexOf('atari') === 0 ? 'atari-play-overlay' : null);
  function playId(id, ev) {
    const d = find(id); if (!d) return;
    if (d.catalogue === 'nes' && window.openNesPlay) return window.openNesPlay(id, ev);
    if (d.catalogue === 'game-boy' && window.openGbPlay) return window.openGbPlay(id, ev);
    if (d.catalogue.indexOf('atari') === 0 && window.openAtariPlay) return window.openAtariPlay(id, ev);
    if (d.catalogue === 'pokemon-mini' && window.openPmPlay) return window.openPmPlay(id, ev);
  }
  function play(id, ev) { return playId(preferred(id), ev); }
  /** Swap the cartridge in an open play window: the full close (Continue save,
      play time, frame discarded) and the open, in one turn -- so the overlay
      history entry is never given back in between. */
  function switchTo(id) {
    const d = find(id); if (!d) return;
    const ov = overlayFor(d);
    const el = ov && document.getElementById(ov);
    if (el && el.classList.contains('open') && typeof closeOverlay === 'function') closeOverlay(ov);
    playId(id);
  }

  /* ---------------------------------------------------------------- styles */
  function styles() {
    if (document.getElementById('vr-styles')) return;
    const s = document.createElement('style');
    s.id = 'vr-styles';
    /* The picker button and menu copy play/nes/index.html's .play-pbtn and
       #devMenu (the NES bar's accessory menu) value for value, so the control
       reads as the same kind of thing. */
    s.textContent = `
      .vr-pick-wrap { position:relative; display:inline-flex; margin-left:auto; margin-right:8px; }
      .vr-pbtn { display:inline-flex; align-items:center; gap:5px; margin:0; white-space:nowrap; max-width:38ch;
        background:transparent; border:0; border-radius:999px; cursor:pointer; color:var(--text,#d7dce6);
        font:inherit; font-size:12px; font-weight:600; line-height:1; padding:6px 11px; -webkit-tap-highlight-color:transparent; }
      .vr-pbtn > span { overflow:hidden; text-overflow:ellipsis; }
      .vr-pbtn:hover, .vr-pbtn:focus-visible { background:rgba(127,127,127,.16); outline:none; }
      .vr-pbtn:focus-visible { box-shadow:0 0 0 2px var(--accent,#9be15d); }
      .vr-pbtn[aria-expanded="true"] { background:rgba(155,225,93,.20); }
      .vr-pbtn svg { display:block; flex:0 0 auto; }
      .vr-menu { position:absolute; top:calc(100% + 6px); right:0; z-index:420; min-width:240px; max-width:min(92vw,420px);
        max-height:min(60vh,420px); overflow:auto; padding:6px; box-sizing:border-box; display:flex; flex-direction:column; gap:2px;
        background:rgba(16,18,22,.94); border:1px solid rgba(255,255,255,.14); border-radius:14px;
        box-shadow:0 12px 30px -12px rgba(0,0,0,.8); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); }
      .vr-menu[hidden] { display:none; }
      .vr-menu .vr-pbtn { justify-content:flex-start; border-radius:10px; padding:8px 10px; color:#d7dce6; max-width:none; width:100%; text-align:left; }
      .vr-menu .vr-pbtn:hover, .vr-menu .vr-pbtn:focus-visible { background:rgba(255,255,255,.10); }
      .vr-menu .tick { width:12px; text-align:center; flex:0 0 auto; }
      .vr-menu .own { margin-left:auto; padding-left:12px; font-weight:500; color:#9ba3ae; flex:0 0 auto; }
      body.gnw-tv .vr-pbtn { font-size:15px; padding:9px 14px; }
      body.gnw-tv .vr-menu .vr-pbtn { padding:12px 14px; }
      .vr-sect .vr-list { display:flex; flex-direction:column; gap:4px; }
      .vr-item { display:flex; align-items:center; gap:8px; width:100%; text-align:left; cursor:pointer; font:inherit; font-size:13px;
        color:var(--text,#e7ecf2); background:rgba(127,127,127,.08); border:1px solid rgba(127,127,127,.18); border-radius:8px; padding:7px 9px; }
      .vr-item:hover, .vr-item:focus-visible { border-color:var(--c, var(--accent,#9be15d)); outline:none; }
      .vr-item .vr-l { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .vr-item .vr-b { flex:0 0 auto; font-size:10px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted,#9aa4b2); }
      .vr-count { font-weight:500; color:var(--muted,#9aa4b2); }
      .vr-menu .vr-mh { padding:6px 10px 4px; font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:#9ba3ae; }
      .vr-menu .vr-sep { height:1px; margin:4px 6px; background:rgba(255,255,255,.12); flex:0 0 auto; }
      .vr-menu .vr-more, .vr-menu .vr-up { color:#c9e7a9; }
      .vr-sum { margin:-4px 0 8px; font-size:12px; color:var(--muted,#9aa4b2); }
      .vr-item.vr-disc { margin-top:4px; }
      .vr-item.vr-disc .vr-arrow { width:12px; flex:0 0 auto; transition:transform .15s; }
      .vr-item.vr-disc[aria-expanded="true"] .vr-arrow { transform:rotate(90deg); }
      .vr-list.vr-subl { padding-left:12px; }
      .vr-list.vr-subl[hidden] { display:none; }
      .vr-sect .vr-list[hidden] { display:none; }
      .vr-find { display:flex; align-items:center; gap:6px; margin:0 0 8px; padding:0 4px 0 9px; box-sizing:border-box;
        background:rgba(127,127,127,.08); border:1px solid var(--line,rgba(127,127,127,.35)); border-radius:8px; }
      .vr-find:focus-within { outline:var(--focus-width,2px) solid var(--focus-ring,var(--accent,#9be15d)); outline-offset:var(--focus-offset,2px); border-color:var(--focus-ring,var(--accent,#9be15d)); }
      .vr-find-in { flex:1 1 auto; min-width:0; margin:0; padding:7px 0; background:transparent; border:0; outline:0; box-shadow:none;
        color:var(--text,#e7ecf2); font:inherit; font-size:13px; }
      .vr-find-in::placeholder { color:var(--muted,#9aa4b2); opacity:1; }
      .vr-find-x { flex:0 0 auto; width:28px; height:28px; padding:0; display:inline-flex; align-items:center; justify-content:center; cursor:pointer;
        background:transparent; border:0; border-radius:6px; color:var(--muted,#9aa4b2); font:inherit; font-size:16px; line-height:1; }
      .vr-find-x[hidden] { display:none; }
      .vr-find-x:hover, .vr-find-x:focus-visible { color:var(--text,#e7ecf2); background:rgba(127,127,127,.18); outline:none; box-shadow:inset 0 0 0 2px var(--focus-ring,var(--accent,#9be15d)); }
      .vr-find-n { margin:0 0 8px; font-size:12px; color:var(--muted,#9aa4b2); overflow-wrap:anywhere; }
      .vr-find-n[hidden] { display:none; }
      .vr-gh { margin:6px 0 0; font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted,#9aa4b2); }
      .vr-gh:first-child { margin-top:0; }
      /* 16 px on a touch screen: a phone zooms the page into a smaller box. */
      @media (pointer:coarse), (max-width:860px) { .vr-find-in { font-size:16px; padding:9px 0; } .vr-find-x { width:36px; height:36px; } }
      body.gnw-tv .vr-find-in { font-size:18px; padding:12px 0; }
      body.gnw-tv .vr-find-x { width:44px; height:44px; font-size:20px; }
    `;
    document.head.appendChild(s);
  }
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const PLAY_SVG = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  const CHEV = '<svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  const STACK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="13" height="13" rx="2"/><path d="M8 8V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-3"/></svg>';

  /* ---------------------------------------------------------------- drawer */
  function openDrawerId() { try { return typeof _openDeviceId !== 'undefined' ? _openDeviceId : null; } catch (e) { return null; } }
  function decorateDrawer() {
    const dm = document.getElementById('device-modal');
    const id = openDrawerId();
    if (!dm || !id || dm.querySelector('.vr-sect')) return;
    const d = find(id); if (!d || !sysOf(d)) return;
    const ms = members(d);
    if (ms.length < 2) return;
    styles();
    const pref = preferred(id), last = lastUsed(id);
    const host = dm.querySelector('.drawer-sidebar .sidebar-inner');
    if (!host) return;
    const sec = document.createElement('section');
    sec.className = 'sect vr-sect';
    /* Releases first; translations, hacks and other copies each behind a
       disclosure row with its count, opened PAGE at a time (2026-10-13). */
    const parts = split(ms), cp = countParts(counts(d));
    const row = (x) => `<button type="button" class="vr-item" data-vr-play="${esc(x.id)}" title="${esc('Play ' + (x.fullName || x.name))}">${PLAY_SVG}` +
        `<span class="vr-l">${esc(labelOf(x) || x.fullName || x.name)}</span>` +
        (x === ms[0] ? '<span class="vr-b">Default</span>' : '') + (x.id === pref && x !== ms[0] ? '<span class="vr-b">Preferred</span>' : '') + (x.id === last ? '<span class="vr-b">Last played</span>' : '') + '</button>';
    const more = (left) => `<button type="button" class="vr-item vr-more-d" data-vr-dmore><span class="vr-l">Show ${fmt(Math.min(PAGE, left))} more (${fmt(left)} left)</span></button>`;
    const long = ms.length > FIND_OVER;
    sec.innerHTML = `<h3 class="sect-h">Variants <span class="vr-count">${esc(cp.versions)}</span></h3>` +
      (cp.rest ? `<p class="vr-sum">${esc(cp.rest)}</p>` : '') +
      (long ? findHTML(ms.length) : '') +
      `<div class="vr-list vr-main">` + parts.r.map(row).join('') +
      SUBS.filter(([c]) => parts[c].length).map(([c, name]) => {
        const hasLast = parts[c].some(x => x.id === last);
        return `<button type="button" class="vr-item vr-disc" data-vr-disc="${c}" aria-expanded="false" aria-controls="vr-subl-${c}">` +
          `<span class="vr-arrow" aria-hidden="true">›</span><span class="vr-l">${esc(name)}</span>` +
          (hasLast ? '<span class="vr-b">Last played</span>' : '') + `<span class="vr-b">${fmt(parts[c].length)}</span></button>` +
          `<div class="vr-list vr-subl" id="vr-subl-${c}" data-vr-subl="${c}" hidden></div>`;
      }).join('') + '</div>';
    const shownN = {};
    const fill = (c) => {
      const box = sec.querySelector('[data-vr-subl="' + c + '"]'), list = parts[c], n = shownN[c] || 0;
      box.innerHTML = list.slice(0, n).map(row).join('') + (list.length > n ? more(list.length - n) : '');
    };
    sec.addEventListener('click', e => {
      const b = e.target.closest('[data-vr-play], [data-vr-disc], [data-vr-dmore]'); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      if (b.dataset.vrPlay) { playId(b.dataset.vrPlay, e); return; }
      if (b.dataset.vrDisc) {
        const c = b.dataset.vrDisc, box = sec.querySelector('[data-vr-subl="' + c + '"]');
        const open = b.getAttribute('aria-expanded') !== 'true';
        b.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open && !shownN[c]) { const li = parts[c].findIndex(x => x.id === last); shownN[c] = Math.max(PAGE, Math.ceil((li + 1) / PAGE) * PAGE); fill(c); }
        box.hidden = !open;
        return;
      }
      // Show more: the next page, focus on its first new row (a remote keeps its place).
      const box = b.closest('[data-vr-subl]'), c = box.dataset.vrSubl, from = shownN[c];
      shownN[c] = from + PAGE; fill(c);
      const nb = box.querySelectorAll('.vr-item')[from]; if (nb) nb.focus({ preventScroll: false });
    });
    if (long) wireFind(sec, id, parts, row);
    host.insertBefore(sec, host.firstChild);
    if (long) restoreFind(sec, id);
    // Play Now plays the representative, the game on the box.
    const pn = dm.querySelector('.play-now');
    if (pn) {
      pn.removeAttribute('onclick');
      pn.onclick = e => { e.stopPropagation(); e.preventDefault(); playId(preferred(id), e); };
      pn.dataset.vrPlays = pref;
      const pd = find(pref);
      pn.title = 'Play ' + (labelOf(pd) || 'this game');
    }
  }

  /* THE FILTER BOX, on a list of more than FIND_OVER versions. It narrows across all the groups, whatever
     is opened or closed below it, and shows at most PAGE rows at a time so a 1,000-entry list stays light.
     It has the two states of the search bar (emby.js, "PASSING THE SEARCH BOX IS NOT TYPING IN IT"):
       AT REST: readonly + inputmode none, so a remote or pad passes through it like a button and no
       on-screen keyboard opens. TYPING: by Enter or a pad's A, or a tap or click.
     Enter or Back while typing ends it and keeps the words, with the list still narrowed; Down goes on
     to the first row. At rest, Back empties the box, and an empty box lets Back through to close the
     drawer. Back on a filtered row returns to the box. findKeys below takes these keys. */
  function findHTML(n) {
    return `<div class="vr-find" role="search"><input type="text" class="vr-find-in" aria-label="Filter versions" placeholder="Filter ${esc(fmt(n))} versions"` +
      ` readonly inputmode="none" enterkeyhint="done" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">` +
      `<button type="button" class="vr-find-x" aria-label="Clear filter" title="Clear filter" hidden>\u00d7</button></div>` +
      `<p class="vr-find-n" role="status" hidden></p><div class="vr-list vr-res" hidden></div>`;
  }
  /* What was typed stays when the drawer repaints itself (a content probe re-opens an open drawer); closing it forgets. */
  let findMemo = null;   // { id, q, focus: null | 'rest' | 'typing' }
  const loose = s => s.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();   // "bros 2" also finds "Bros. 2"; "[t1]" finds "[t1]"
  function wireFind(sec, id, parts, row) {
    const inp = sec.querySelector('.vr-find-in'), clr = sec.querySelector('.vr-find-x'), note = sec.querySelector('.vr-find-n'),
          res = sec.querySelector('.vr-res'), main = sec.querySelector('.vr-main');
    const GROUPS = [['r', 'Versions']].concat(SUBS), all = [];
    for (const [c] of GROUPS) for (const x of parts[c]) all.push({ x, c });
    const base = inp.placeholder;
    let hay = null, hits = [], shown = 0, refocusing = false;
    /* Only while the drawer is open: the box loses its focus just after a close, and must not write the words back. */
    const memo = () => { const o = document.getElementById('device-overlay'); if (!o || !o.classList.contains('open')) return; findMemo = { id, q: inp.value, focus: document.activeElement === inp ? (inp.readOnly ? 'rest' : 'typing') : null }; };
    const hint = () => { inp.placeholder = inp.readOnly && document.activeElement === inp ? 'Press OK or Enter to type\u2026' : base; };
    const paint = () => {
      let html = '', cur = '';
      for (const h of hits.slice(0, shown)) {
        if (h.c !== cur) { cur = h.c; const g = GROUPS.find(([c]) => c === cur); html += `<div class="vr-gh">${esc(g[1])} \u00b7 ${fmt(hits.filter(a => a.c === cur).length)}</div>`; }
        html += row(h.x);
      }
      const left = hits.length - shown;
      res.innerHTML = html + (left > 0 ? `<button type="button" class="vr-item vr-more-d" data-vr-fmore><span class="vr-l">Show ${fmt(Math.min(PAGE, left))} more (${fmt(left)} left)</span></button>` : '');
    };
    const apply = () => {
      clr.hidden = !inp.value;
      const q = fold(inp.value).trim();
      if (!q) { hits = []; res.hidden = true; res.innerHTML = ''; note.hidden = true; note.textContent = ''; main.hidden = false; return; }
      if (!hay) hay = all.map(a => { const f = fold(shownName(a.x)); return f + '\n' + loose(f); });
      const ql = loose(q);
      hits = all.filter((a, i) => hay[i].includes(q) || (ql && hay[i].includes(ql)));
      shown = PAGE;
      main.hidden = true;
      note.hidden = false;
      note.textContent = hits.length ? fmt(hits.length) + ' of ' + fmt(all.length) + ' versions' : 'No versions match "' + inp.value.trim() + '".';
      res.hidden = !hits.length;
      paint();
    };
    const rest = () => { inp.readOnly = true; inp.setAttribute('inputmode', 'none'); hint(); };
    /* Blur and focus again: a phone shows or hides its keyboard on focus, not on an attribute change. */
    const refocus = () => { refocusing = true; try { inp.blur(); inp.focus({ preventScroll: true }); } catch (e) {} refocusing = false; };
    const edit = how => {
      inp.readOnly = false; inp.setAttribute('inputmode', 'search'); hint();
      if (how === 'pointer') return;      // the press itself puts the focus and caret there
      refocus();
      try { const n = inp.value.length; inp.setSelectionRange(n, n); } catch (e) {}
    };
    const leave = () => { rest(); if (document.activeElement === inp) refocus(); hint(); memo(); };
    const clear = () => { inp.value = ''; apply(); rest(); try { inp.focus({ preventScroll: true }); } catch (e) {} hint(); memo(); };
    inp.addEventListener('pointerdown', () => { if (inp.readOnly) edit('pointer'); });
    inp.addEventListener('input', () => { apply(); memo(); });
    inp.addEventListener('focus', () => { hint(); memo(); });
    inp.addEventListener('blur', () => {
      if (refocusing) return;
      hint();
      /* Later: a repaint removing the box must not forget that it was being typed in. */
      setTimeout(() => { if (inp.isConnected && document.activeElement !== inp) { rest(); hint(); memo(); } }, 0);
    });
    clr.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); clear(); });
    sec.addEventListener('click', e => {
      const b = e.target.closest('[data-vr-fmore]'); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      const from = shown;
      shown = from + PAGE; paint();
      const nb = res.querySelectorAll('.vr-item')[from]; if (nb) nb.focus({ preventScroll: false });
    });
    sec.__vrFind = { inp, leave, edit, clear, rest, apply };
  }
  function restoreFind(sec, id) {
    const F = sec.__vrFind, m = findMemo;
    if (!F || !m || m.id !== id || (!m.q && !m.focus)) return;
    F.inp.value = m.q; F.apply();
    if (m.focus === 'typing') F.edit('key');
    else if (m.focus === 'rest') { try { F.inp.focus({ preventScroll: true }); } catch (e) {} }
  }
  /* ON WINDOW IN THE CAPTURE PHASE AT LOAD, ahead of keys.js, nav.js and shortcuts.js, so that nothing typed
     here reaches them. A key the box does not use still does what it does in any text box (no preventDefault). */
  function findKeys(e) {
    const t = e.target, sec = t && t.closest && t.closest('.vr-sect'), F = sec && sec.__vrFind;
    if (!F) return;
    const back = (BACKS.has(e.key) && e.key !== 'Backspace') || e.keyCode === 10009 || e.keyCode === 461 || e.keyCode === 4;
    const take = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    if (t !== F.inp) {
      /* A filtered row: Back returns to the box. A pad and a remote keep the rows otherwise. */
      if (back && t.closest('.vr-res')) { take(); if (!e.repeat) { F.rest(); try { F.inp.focus({ preventScroll: false }); } catch (x) {} } }
      return;
    }
    const nav = dir => { const N = window.GnwNav; return !!(N && N.move && N.move(dir)); };
    if (F.inp.readOnly) {             // at rest
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key === 'Enter' || e.key === ' ') { take(); if (!e.repeat) F.edit('key'); return; }
      if (back) { if (F.inp.value) { take(); if (!e.repeat) F.clear(); } return; }   // an empty box: Back closes the drawer
      const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key];
      if (dir) { take(); nav(dir); }
      return;
    }
    if (e.key === 'Tab') return;      // typing: Tab moves on as it does from any box
    if (e.key === 'Enter' || back) { take(); if (!e.repeat) F.leave(); return; }
    if (e.key === 'ArrowDown' || (e.key === 'ArrowUp' && F.inp.selectionStart === 0 && F.inp.selectionEnd === 0)) {
      take(); F.rest(); nav(e.key === 'ArrowDown' ? 'down' : 'up'); return;
    }
    e.stopImmediatePropagation();     // the letter goes in the box; no shortcut hears it
  }

  /* ---------------------------------------------------------------- play window picker */
  // The Pokemon mini joins (2026-10-14): in the one play host it is a framed window like the others,
  // and the Guide menu's "Change variant" opens the host's Variant menu there too.
  const PLAY_OVS = ['nes-play-overlay', 'gb-play-overlay', 'atari-play-overlay', 'pm-play-overlay'];
  function playingId() { try { return typeof _openPlayDeviceId !== 'undefined' ? _openPlayDeviceId : null; } catch (e) { return null; } }
  /* CLOSING (2026-10-13: on a phone the menu could not be closed
     without picking). It closes, the version unchanged, on: a tap or click
     anywhere outside it (the pointerdown below), Escape and a remote's Back
     (the keydown below; in a submenu Back first steps up to the releases), the
     phone's back gesture (keys.js historyBack asks closeMenu() first), and the
     menu's own button pressed again. Focus goes back to that button. */
  /* The play window's game is a same-origin frame: a finger on it is a pointer
     in THAT document, never this one, and on a phone it moves no focus either.
     While the menu is open, the frame's window is listened to as well. */
  let frameWin = null;
  const onFramePointer = () => closeMenu(false);
  function watchFrame(wrap) {
    unwatchFrame();
    try {
      const ov = wrap.closest('.overlay'), f = ov && ov.querySelector('iframe'), w = f && f.contentWindow;
      if (w) { w.addEventListener('pointerdown', onFramePointer, true); frameWin = w; }
    } catch (e) { frameWin = null; }
  }
  function unwatchFrame() { try { if (frameWin) frameWin.removeEventListener('pointerdown', onFramePointer, true); } catch (e) {} frameWin = null; }
  function closeMenu(focusBtn) {
    const m = document.querySelector('.vr-menu:not([hidden])');
    if (!m) return false;
    unwatchFrame();
    m.hidden = true;
    const wrap = m.parentNode;
    if (wrap && wrap.__vr) { wrap.__vr.level = null; }
    const b = wrap.querySelector('[data-vr-toggle]');
    if (b) { b.setAttribute('aria-expanded', 'false'); if (focusBtn) b.focus({ preventScroll: true }); }
    return true;
  }
  /* The menu is painted from wrap.__vr = { parts, cur, def, level, shown }:
     level null is the top (the releases, then one row per submenu); 't', 'h'
     or 'o' is that submenu, `shown` entries of it, then "Show more". */
  function paintMenu(wrap) {
    const st = wrap.__vr, m = wrap.querySelector('.vr-menu');
    const item = x => `<button type="button" class="vr-pbtn" role="menuitemradio" aria-checked="${x.id === st.cur}" data-vr-id="${esc(x.id)}" title="${esc(x.fullName || x.name)}">` +
      `<span class="tick">${x.id === st.cur ? '✓' : ''}</span><span>${esc(labelOf(x) || x.fullName || x.name)}</span>${x.id === st.def ? '<span class="own">default</span>' : ''}</button>`;
    if (!st.level) {
      const subs = SUBS.filter(([c]) => st.parts[c].length);
      m.innerHTML = st.parts.r.map(item).join('') + (st.parts.r.length && subs.length ? '<div class="vr-sep" role="separator"></div>' : '') +
        subs.map(([c, name]) => { const has = st.parts[c].some(x => x.id === st.cur);
          return `<button type="button" class="vr-pbtn" role="menuitem" data-vr-sub="${c}" aria-label="${esc(name + ', ' + fmt(st.parts[c].length))}">` +
            `<span class="tick">${has ? '✓' : ''}</span><span>${esc(name)}</span><span class="own">${fmt(st.parts[c].length)} ›</span></button>`; }).join('');
    } else {
      const list = st.parts[st.level], left = list.length - st.shown;
      m.innerHTML = `<button type="button" class="vr-pbtn vr-up" role="menuitem" data-vr-up aria-label="Back to all versions"><span class="tick">‹</span><span>All versions</span></button>` +
        `<div class="vr-mh" role="presentation">${esc(SUB_NAME[st.level])} · ${fmt(list.length)}</div>` +
        list.slice(0, st.shown).map(item).join('') +
        (left > 0 ? `<button type="button" class="vr-pbtn vr-more" role="menuitem" data-vr-more><span class="tick">+</span><span>Show ${fmt(Math.min(PAGE, left))} more (${fmt(left)} left)</span></button>` : '');
    }
  }
  function enterSub(wrap, c) {
    const st = wrap.__vr, list = st.parts[c], i = list.findIndex(x => x.id === st.cur);
    st.level = c; st.shown = Math.min(list.length, Math.max(PAGE, Math.ceil((i + 1) / PAGE) * PAGE));
    paintMenu(wrap);
    const m = wrap.querySelector('.vr-menu');
    const f = m.querySelector('[aria-checked="true"]') || m.querySelector('[data-vr-id]');
    if (f) f.focus({ preventScroll: false });
    m.scrollTop = f ? Math.max(0, f.offsetTop - 48) : 0;
  }
  function leaveSub(wrap) {
    const st = wrap.__vr, c = st.level; if (!c) return false;
    st.level = null; paintMenu(wrap);
    const m = wrap.querySelector('.vr-menu'), f = m.querySelector('[data-vr-sub="' + c + '"]');
    if (f) f.focus({ preventScroll: false });
    return true;
  }
  function moreSub(wrap) {
    const st = wrap.__vr, from = st.shown;
    st.shown = Math.min(st.parts[st.level].length, from + PAGE); paintMenu(wrap);
    const f = wrap.querySelectorAll('.vr-menu [data-vr-id]')[from]; if (f) f.focus({ preventScroll: false });
  }
  function openMenu(wrap) {
    const m = wrap.querySelector('.vr-menu'), b = wrap.querySelector('[data-vr-toggle]');
    if (wrap.__vr) { wrap.__vr.level = null; paintMenu(wrap); }
    m.hidden = false; b.setAttribute('aria-expanded', 'true');
    watchFrame(wrap);
    const cur =m.querySelector('[aria-checked="true"]') || m.querySelector('[data-vr-sub] .tick:not(:empty)') && m.querySelector('[data-vr-sub] .tick:not(:empty)').parentNode || m.querySelector('button');
    if (cur) cur.focus({ preventScroll: true });
  }
  /* One press inside the menu, by tap, click, Enter or a remote's OK. */
  function menuAct(wrap, b) {
    if (b.dataset.vrSub) { enterSub(wrap, b.dataset.vrSub); return; }
    if (b.hasAttribute('data-vr-up')) { leaveSub(wrap); return; }
    if (b.hasAttribute('data-vr-more')) { moreSub(wrap); return; }
    if (b.dataset.vrId) { closeMenu(false); if (b.dataset.vrId !== playingId()) switchTo(b.dataset.vrId); }
  }
  function renderPicker(ovId) {
    const ov = document.getElementById(ovId); if (!ov) return;
    const head = ov.querySelector('.modal-head'); if (!head) return;
    let wrap = head.querySelector('.vr-pick-wrap');
    const id = playingId(), d = id && find(id);
    const ms = d && sysOf(d) ? members(d) : [];
    if (!d || ms.length < 2 || !ov.classList.contains('open')) { if (wrap) wrap.hidden = true; return; }
    styles();
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'vr-pick-wrap';
      const close = head.querySelector('.modal-close');
      const at = close ? close.parentNode : head;
      at.insertBefore(wrap, close && close.parentNode === at ? close : null);
      wrap.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        e.stopPropagation();
        if (b.hasAttribute('data-vr-toggle')) { const m = wrap.querySelector('.vr-menu'); if (m.hidden) openMenu(wrap); else closeMenu(true); return; }
        menuAct(wrap, b);
      });
      // Focus leaving the picker (to the game, by a tap or the window's own hand-off) closes its menu.
      wrap.addEventListener('focusout', e => { if (!e.relatedTarget || !wrap.contains(e.relatedTarget)) setTimeout(() => { if (!wrap.contains(document.activeElement)) closeMenu(false); }, 0); });
    }
    wrap.hidden = false;
    wrap.innerHTML = `<button type="button" class="vr-pbtn" data-vr-toggle aria-haspopup="menu" aria-expanded="false" title="Variant: ${esc(labelOf(d))} (choose another version of this game)">` +
      `${STACK}<span>${esc(labelOf(d) || 'Variant')}</span>${CHEV}</button>` +
      `<div class="vr-menu" role="menu" aria-label="Variant" hidden></div>`;
    wrap.__vr = { parts: split(ms), cur: id, def: ms[0].id, level: null, shown: 0 };
    paintMenu(wrap);
  }
  function onPlayOverlay(ovId) {
    const ov = document.getElementById(ovId);
    if (ov && ov.classList.contains('open')) { const id = playingId(); if (id) remember(id); }
    renderPicker(ovId);
  }

  /* THE PICKER'S KEYS, taken on window in the capture phase at load -- before
     keys.js and nav.js, which load later and treat a play window's keys as the
     game's. Only while focus is on the picker (or its menu is open):
       Enter / Space   open the menu, or choose the focused variant
       Up / Down       open the menu; move within it (Home / End too)
       Back            close the menu only, never the game
     Everything else passes through untouched. */
  const BACKS = new Set(['Escape', 'Esc', 'Backspace', 'GoBack', 'BrowserBack', 'XF86Back']);
  window.addEventListener('keydown', e => {
    const wrap = document.activeElement && document.activeElement.closest && document.activeElement.closest('.vr-pick-wrap');
    const openM = document.querySelector('.vr-menu:not([hidden])');
    if (!wrap && !openM) return;
    const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    if (openM && (BACKS.has(e.key) || e.keyCode === 10009 || e.keyCode === 461 || e.keyCode === 4)) {
      stop();
      if (e.repeat) return;
      if (!(openM.parentNode.__vr && leaveSub(openM.parentNode))) closeMenu(true);
      return;
    }
    if (!wrap) return;
    const m = wrap.querySelector('.vr-menu'), t = document.activeElement;
    if (m.hidden) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') { stop(); openMenu(wrap); }
      return;
    }
    const list = Array.from(m.querySelectorAll('button')), i = list.indexOf(t);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { stop(); const n = list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]; if (n) n.focus(); }
    else if (e.key === 'Home' || e.key === 'End') { stop(); (e.key === 'Home' ? list[0] : list[list.length - 1]).focus(); }
    else if (e.key === 'Enter' || e.key === ' ') { stop(); if (t && m.contains(t)) menuAct(wrap, t); else closeMenu(true); }
    else if (e.key === 'ArrowRight' && t && t.dataset.vrSub) { stop(); enterSub(wrap, t.dataset.vrSub); }
    else if (e.key === 'ArrowLeft' && wrap.__vr && wrap.__vr.level) { stop(); leaveSub(wrap); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Tab') stop();
  }, true);
  window.addEventListener('keydown', findKeys, true);
  /* A tap or click outside closes it, the version unchanged. Touch included:
     pointerdown fires for a finger too, and this listens on window in the
     capture phase, ahead of anything that stops a touch on its way down. */
  window.addEventListener('pointerdown', e => {
    if (!document.querySelector('.vr-menu:not([hidden])')) return;
    const w = e.target && e.target.closest && e.target.closest('.vr-pick-wrap');
    if (!w) closeMenu(false);
  }, true);
  /* A tap on the game itself lands in the play window's frame, which this
     document never hears as a pointer: the page losing focus to it closes the menu. */
  window.addEventListener('blur', () => { setTimeout(() => { const a = document.activeElement; if (a && a.tagName === 'IFRAME') closeMenu(false); }, 0); });

  /* THE PAUSE MENU (keys.js, Back in a game) gets a "Change variant" item, so a
     remote or a pad -- whose keys belong to the game while it runs -- can reach
     the choice. It resumes the game and opens the header menu, focused. */
  function decoratePause(el) {
    if (!el || el.querySelector('[data-vr-pause]')) return;
    const ovId = PLAY_OVS.find(o => { const x = document.getElementById(o); return x && x.classList.contains('open'); });
    if (!ovId) return;
    const id = playingId(), d = id && find(id);
    if (!d || members(d).length < 2) return;
    const list = el.querySelector('.gk-list'), quit = el.querySelector('[data-gk="quit"]');
    if (!list) return;
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.vrPause = '1'; b.textContent = 'Change variant';
    list.insertBefore(b, quit || null);
    b.addEventListener('click', e => {
      e.stopPropagation();
      const resume = el.querySelector('[data-gk="resume"]');
      if (resume) resume.click();
      // A window running the Control Bar has its Variant item in the bar, not the header (A14).
      if (window.CwUnifiedHost && CwUnifiedHost.openVariant(ovId)) return;
      const wrap = document.querySelector('#' + ovId + ' .vr-pick-wrap');
      if (wrap && !wrap.hidden) setTimeout(() => openMenu(wrap), 0);
    });
  }

  /* ---------------------------------------------------------------- wiring */
  function landed(sys) {
    if (window.Emby && typeof Emby.reseedGameTiles === 'function') { try { Emby.reseedGameTiles(); } catch (e) {} }
    const dm = document.getElementById('device-modal');
    if (dm && openDrawerId()) decorateDrawer();
    PLAY_OVS.forEach(renderPicker);
    /* The Continue row is redrawn only when it holds a game of this system: its
       card may now name a variant. Redrawing it for nothing would move focus and
       cards under the viewer's pointer as each table lands. */
    const cards = Array.from(document.querySelectorAll('#video-continue [data-cr-open^="g:"]'));
    if (cards.some(b => { const d = find(b.dataset.crOpen.slice(2)); return d && sysOf(d) === sys; })
        && window.ContinueRow && typeof ContinueRow.refresh === 'function') { try { ContinueRow.refresh(); } catch (e) {} }
    try { window.dispatchEvent(new CustomEvent('gnw-variants', { detail: { system: sys } })); } catch (e) {}
  }
  function wire() {
    const dm = document.getElementById('device-modal');
    if (dm) new MutationObserver(() => decorateDrawer()).observe(dm, { childList: true });
    const dov = document.getElementById('device-overlay');
    if (dov) new MutationObserver(() => { if (!dov.classList.contains('open')) findMemo = null; }).observe(dov, { attributes: true, attributeFilter: ['class'] });
    for (const id of PLAY_OVS) {
      const ov = document.getElementById(id);
      if (ov) new MutationObserver(() => onPlayOverlay(id)).observe(ov, { attributes: true, attributeFilter: ['class'] });
    }
    new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.id === 'gk-pause') decoratePause(n); })
      .observe(document.body, { childList: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
  /* When the unsupported lists land, every cached answer is stale: repaint. */
  window.addEventListener('cws-unsupported-ready', () => {
    version++;
    landed('*');
    if (window.ContinueRow && typeof ContinueRow.refresh === 'function') { try { ContinueRow.refresh(); } catch (e) {} }
  });

  window.Variants = {
    titleOf: d => { const e = info(d), t = e && T[e.sys], g = t && t.groups[e.g]; return (g && g[0]) || ''; },   // the group's title in the table
    collapse, members, searchCollapse, searchName, searchAka, settled, keyOf, info, repOf, repRow, sha1Of, preferred, lastUsed, remember, labelOf, cardLabel,
    groupId, classOf, split, counts, countParts, countText, closeMenu: () => closeMenu(true), menuOpen: () => !!document.querySelector(".vr-menu:not([hidden])"),
    play, playId, switchTo, load, ready: sys => load(sys), get version() { return version; },
    region: getRegion, setRegion, regionOf: d => regionWords(typeof d === 'string' ? find(d) : d), unknown,   // 9 Nov 2026: preferred region; files no table knows
    keepIndexWith: fn => { keepKeyOf = typeof fn === 'function' ? fn : null; },   // emby.js: its search's shelf look-up (see catIndex)
  };
})();

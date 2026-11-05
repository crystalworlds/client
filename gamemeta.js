/* gamemeta.js -- built-in game details for the drawer, and a second place to
 * find box art when ours has none.
 *
 * THE DATA. metadata/*.json.gz, built by WASM_Source/metadata/build.mjs from
 * No-Intro (names), libretro-database (genre, developer, publisher, players,
 * franchise, rating, year) and OpenVGDB (descriptions, full release dates).
 * Packed per shelf like the art files; a big shelf is cut into 16 shards by the
 * first hex digit of the key, so opening one drawer fetches one small file.
 * Nothing is fetched until a drawer opens or a box-art tile needs a name.
 *
 * THE KEY is the site's own: the 12 hex digits of SHA-256 already in every
 * pack-supplied id ('nes-x…', 'gb-x…', 'a2600-x…'). Built-in titles (gb-tetris,
 * pm-…) are mapped to the same key by metadata/index.json. A title whose file
 * is not one the build saw (a different header, a visitor's own dump) is hashed
 * once, from the bytes the open content pack already holds, header removed, and
 * looked up by SHA-1 instead.
 *
 * BOX ART. thumbnails.libretro.com, named by the No-Intro name. One request per
 * title; a miss is remembered for the session. Plain <img> only: that host sends
 * no CORS header, so the picture is never read back into a canvas.
 *
 * Licences and sources: WASM_Source/metadata/sources.json.
 */
(function () {
  'use strict';
  var BASE = (function () {
    try { var s = document.currentScript && document.currentScript.src; if (s) return s.replace(/[^/]*$/, '') + 'metadata/'; } catch (e) {}
    return 'metadata/';
  })();
  var THUMBS = 'https://thumbnails.libretro.com/';
  var LICENCE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';
  var ART_MISS_KEY = 'gnw.meta.artMiss.v1';
  // Bumped with every pack rebuild so a cached index.json or shard is never mixed with new ones.
  var DATA_TAG = '?v=2.0.0-p4g';   // 4 Nov: LaunchBox descriptions where no other source has one; one game, one group (p4g)
  // LaunchBox user ratings. Turned off 2026-10-14 when testing found the links opened wrong games; back on after the audit (every scored record: name, platform, rating, votes and linked page match). false hides them.
  var SHOW_LB = true;

  // ------------------------------------------------------------ loading
  function gunzipJson(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.arrayBuffer().then(function (ab) {
      var u = new Uint8Array(ab);
      // A host that sends Content-Encoding: gzip has already inflated it.
      if (u.length > 2 && u[0] === 0x1f && u[1] === 0x8b) {
        var ds = new DecompressionStream('gzip');
        var w = ds.writable.getWriter(); w.write(u); w.close();
        return new Response(ds.readable).json();
      }
      return JSON.parse(new TextDecoder().decode(u));
    });
  }
  var _index = null;
  function index() {
    if (!_index) _index = fetch(BASE + 'index.json' + DATA_TAG).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(function (e) { console.warn('[gamemeta] index unavailable:', e && e.message || e); _index = null; return null; });
    return _index;
  }
  var _files = {};
  function shardFor(shelf, key) {
    return index().then(function (ix) {
      if (!ix || !ix.shelves[shelf]) return null;
      var n = ix.shelves[shelf].n;
      var f = n > 1 ? shelf + '-' + key.slice(0, n === 256 ? 2 : 1) + '.json.gz' : shelf + '.json.gz';
      if (!_files[f]) _files[f] = fetch(BASE + f + DATA_TAG).then(gunzipJson).catch(function (e) {
        console.warn('[gamemeta] ' + f + ' unavailable:', e && e.message || e); delete _files[f]; return null;
      });
      return _files[f];
    });
  }

  // ------------------------------------------------------------ which shelf
  var ATARI_SHELF = { atari2600: 'a2600', atari5200: 'a5200', atari7800: 'a7800', atarilynx: 'alynx' };
  function shelvesOf(d) {
    if (!d) return [];
    if (d.catalogue === 'game-boy') return d.system === 'gbc' ? ['gbc', 'gb'] : ['gb', 'gbc'];
    if (d.catalogue === 'nes') return d.nesConsole === 'fds' ? ['fds'] : ['nes'];
    if (ATARI_SHELF[d.catalogue]) return [ATARI_SHELF[d.catalogue]];
    if (d.catalogue === 'pokemon-mini') return ['pm'];
    return [];
  }
  // Game & Watch units: no cartridge, so only a review score, keyed by the
  // device id (metadata/index.json `a` maps it to the gnw shelf).
  function isGnw(d) { return !!(d && !d.catalogue && d.series); }
  function keyOf(d) {
    var m = /-x([0-9a-f]{12})$/.exec(String(d.id || ''));
    return m ? m[1] : null;
  }

  function findById(d) {
    var shelves = shelvesOf(d);
    if (!shelves.length && !isGnw(d)) return Promise.resolve(null);
    return index().then(function (ix) {
      if (!ix) return null;
      var alias = ix.a && ix.a[d.id];
      if (alias) { var p = alias.split(':'); shelves = [p[0]]; var key = p[1]; }
      else key = keyOf(d);
      if (!key) return null;
      var i = 0;
      function next() {
        if (i >= shelves.length) return null;
        var shelf = shelves[i++];
        return shardFor(shelf, key).then(function (pk) {
          var n = pk && pk.ids[key];
          return (n != null) ? { rec: pk.recs[n], shelf: shelf } : next();
        });
      }
      return next();
    });
  }

  // The pack's bytes for a title, or null. Only the open content pack is asked:
  // a drawer is no reason to download a cartridge from anywhere.
  function packBytes(d) {
    var P = window.__GNW_PACK; if (!P) return null;
    var v = null;
    try {
      if (d.catalogue === 'nes' && P.nes) v = P.nes(d.id);
      else if (ATARI_SHELF[d.catalogue] && P.atari) v = P.atari(d.id);
      else if (d.catalogue === 'game-boy' && P.gameboy) v = P.gameboy(d.id);
    } catch (e) { v = null; }
    if (!v) return null;
    if (typeof v === 'string') { var s = atob(v), u = new Uint8Array(s.length); for (var k = 0; k < s.length; k++) u[k] = s.charCodeAt(k); return u; }
    return v instanceof Uint8Array ? v : new Uint8Array(v);
  }
  // build.mjs/scan.mjs headerless() exactly.
  function stripHeader(shelf, u) {
    var n = u.length;
    if (shelf === 'nes' && n > 16 && u[0] === 0x4e && u[1] === 0x45 && u[2] === 0x53 && u[3] === 0x1a) return u.subarray((u[6] & 4) ? 528 : 16);
    if (shelf === 'fds' && n > 16 && u[0] === 0x46 && u[1] === 0x44 && u[2] === 0x53 && u[3] === 0x1a) return u.subarray(16);
    if (shelf === 'a7800' && n > 128 && String.fromCharCode.apply(null, u.subarray(1, 10)) === 'ATARI7800') return u.subarray(128);
    if (shelf === 'alynx' && n > 64 && String.fromCharCode.apply(null, u.subarray(0, 4)) === 'LYNX') return u.subarray(64);
    return u;
  }
  function findByBytes(d) {
    var u = packBytes(d);
    var shelves = shelvesOf(d);
    if (!u || !shelves.length || !(window.crypto && crypto.subtle)) return Promise.resolve(null);
    var shelf = shelves[0];
    return crypto.subtle.digest('SHA-1', stripHeader(shelf, u)).then(function (buf) {
      var hex = Array.from(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, '0'); }).join('').slice(0, 12);
      return shardFor(shelf, hex).then(function (pk) {
        if (!pk) return null;
        var n = pk.h[hex] != null ? pk.h[hex] : pk.s[hex];
        return n != null ? { rec: pk.recs[n], shelf: shelf } : null;
      });
    }).catch(function () { return null; });
  }

  var _memo = {};
  function lookup(d) {
    if (!d || !d.id) return Promise.resolve(null);
    if (d.unreleased) return Promise.resolve(null);   // never sold (Tetris Jr.): nothing to look up, nothing fetched
    if (_memo[d.id]) return _memo[d.id];
    var p = findById(d).then(function (hit) { return hit || findByBytes(d); }).catch(function () { return null; });
    _memo[d.id] = p;
    return p;
  }

  // ------------------------------------------------------------ tile years
  /* A title the visitor supplies (game server, content pack, built payload) is
     adopted with `released: ''` because its file carries no date. The packs
     know the release date of every dump they match by hash, and
     metadata/years-<shelf>.json.gz (WASM_Source/metadata/years.mjs, run by
     build.mjs) is that date alone, hash matches only. fillYears() writes it
     into `released` on every adopted title still without one, so the tile,
     the year sort and the Games menu's year range all read a real date.
     Called by index.html's notifyMediaGameContent() whenever titles arrive;
     a shelf's file is fetched once, and only when a title on it is present. */
  var _years = {}, _yearsLoading = {};
  function yearsShelf(shelf) {
    if (_years[shelf]) return Promise.resolve(_years[shelf]);
    if (!_yearsLoading[shelf]) _yearsLoading[shelf] = fetch(BASE + 'years-' + shelf + '.json.gz' + DATA_TAG).then(gunzipJson)
      .then(function (j) { _years[shelf] = (j && j.y) || {}; return _years[shelf]; })
      .catch(function (e) { console.warn('[gamemeta] years-' + shelf + ' unavailable:', e && e.message || e); _years[shelf] = {}; return _years[shelf]; });
    return _yearsLoading[shelf];
  }
  function allDevices() { try { return (typeof ALL_DEVICES !== 'undefined') ? ALL_DEVICES : []; } catch (e) { return []; } }
  function undated(d) { return d && d.fromPack && !have(d.released) && shelvesOf(d).length && keyOf(d); }
  // Fill from the shelves already loaded; returns how many titles gained a date.
  function fillFromLoaded(list) {
    var n = 0;
    list.forEach(function (d) {
      if (!undated(d)) return;
      var k = keyOf(d), sh = shelvesOf(d);
      for (var i = 0; i < sh.length; i++) {
        var m = _years[sh[i]], v = m && m[k];
        if (v) { d.released = v; d.releasedFrom = 'metadata'; n++; return; }
      }
    });
    return n;
  }
  var _yearsRepaint = 0;
  function fillYears() {
    // The tile ratings ride the same call (every content change reaches here); never awaited.
    try { fillScores(); } catch (e) {}
    var list = allDevices().filter(undated);
    if (!list.length) return Promise.resolve(0);
    var now = fillFromLoaded(list);
    var need = {};
    list.forEach(function (d) { if (undated(d)) shelvesOf(d).forEach(function (s) { if (!_years[s]) need[s] = 1; }); });
    var shelves = Object.keys(need);
    if (!shelves.length) return Promise.resolve(now);
    return Promise.all(shelves.map(yearsShelf)).then(function () {
      var later = fillFromLoaded(allDevices().filter(undated));
      /* The grid was drawn before these dates arrived: redraw it once (the same
         call a content change makes; the reader's place is kept). */
      if (later && window.Emby && typeof Emby.reseedGameTiles === 'function') {
        clearTimeout(_yearsRepaint);
        _yearsRepaint = setTimeout(function () { try { Emby.reseedGameTiles({ force: true }); } catch (e) {} }, 0);
      }
      return now + later;
    });
  }

  // ------------------------------------------------------------ tile ratings
  /* 2026-10-18, the request: "add ratings to the game tiles like we have ratings on
     movie tiles. Make them look the same." A movie tile's meta line is
     "<year>  ·  ★ 7.4" (emby.js videoCardHTML: Emby's CommunityRating, out of
     10, one decimal, the star coloured by the `.device-card .meta .star` rule
     in emby.js, which now covers both tiles so the two cannot drift).
     metadata/scores-<shelf>.json.gz (WASM_Source/metadata/scores.mjs) is the
     drawer's LaunchBox score converted to that scale: the drawer's one-decimal
     "x/5" doubled, so a drawer reading 3.7/5 is a tile reading 7.4. Hash
     matches with 5 or more ratings only (scores.mjs says why); a title without
     one shows nothing. Same loading as the years: one small file per shelf,
     fetched once, only for shelves with titles present; never blocks a paint.
     d.score10 is read by index.html's cardHTML through ratingHTML(); tiles
     painted before the file arrived are patched in place (no repaint, so a
     running clip or preview is left alone). */
  var _scores = {}, _scoresLoading = {};
  function scoresShelf(shelf) {
    if (_scores[shelf]) return Promise.resolve(_scores[shelf]);
    if (!_scoresLoading[shelf]) _scoresLoading[shelf] = fetch(BASE + 'scores-' + shelf + '.json.gz' + DATA_TAG).then(gunzipJson)
      .then(function (j) { _scores[shelf] = (j && j.s) || {}; return _scores[shelf]; })
      .catch(function (e) { console.warn('[gamemeta] scores-' + shelf + ' unavailable:', e && e.message || e); _scores[shelf] = {}; return _scores[shelf]; });
    return _scoresLoading[shelf];
  }
  // [[shelf, key], ...] to try for a title: the alias (built-in Pokemon mini
  // titles, Game & Watch units) or the id's hash on each of its shelves.
  function scoreKeys(d, ix) {
    if (d && d.unreleased) return [];
    var alias = ix && ix.a && ix.a[d.id];
    if (alias) { var p = alias.split(':'); return [[p[0], p[1]]]; }
    var k = keyOf(d);
    return k ? shelvesOf(d).map(function (s) { return [s, k]; }) : [];
  }
  function ratingHTML(d, after) {
    if (!d || !(d.score10 > 0)) return '';
    return (after ? '&nbsp;&nbsp;·&nbsp;&nbsp;' : '') + '<span class="star">★</span> ' + d.score10.toFixed(1);
  }
  function patchTiles() {
    var cards = document.querySelectorAll('#video-grid .device-card[data-id]:not(.video-card)');
    for (var i = 0; i < cards.length; i++) {
      var meta = cards[i].querySelector(':scope > .body > .meta');
      if (!meta || meta.querySelector('.star')) continue;
      var d = deviceFor(cards[i].dataset.id);
      if (!d || !(d.score10 > 0)) continue;
      var empty = !meta.textContent.replace(/ /g, '').trim();
      if (empty) meta.innerHTML = ratingHTML(d, false); else meta.insertAdjacentHTML('beforeend', ratingHTML(d, true));
    }
  }
  function fillScoresFromLoaded(list, ix) {
    var n = 0;
    list.forEach(function (d) {
      if (d.score10 !== undefined) return;
      var ks = scoreKeys(d, ix), pending = false;
      for (var i = 0; i < ks.length; i++) {
        var m = _scores[ks[i][0]];
        if (!m) { pending = true; continue; }
        if (m[ks[i][1]] > 0) { d.score10 = m[ks[i][1]]; n++; return; }
      }
      if (!pending) d.score10 = 0;   // looked everywhere: no rating, never asked again
    });
    return n;
  }
  function fillScores() {
    return index().then(function (ix) {
      var list = allDevices().filter(function (d) { return d && d.score10 === undefined && (shelvesOf(d).length || isGnw(d)); });
      if (!list.length) return 0;
      var now = fillScoresFromLoaded(list, ix);
      var need = {};
      list.forEach(function (d) { scoreKeys(d, ix).forEach(function (sk) { if (!_scores[sk[0]]) need[sk[0]] = 1; }); });
      var shelves = Object.keys(need);
      if (now) patchTiles();
      if (!shelves.length) return now;
      return Promise.all(shelves.map(scoresShelf)).then(function () {
        var later = fillScoresFromLoaded(allDevices().filter(function (d) { return d && d.score10 === undefined; }), ix);
        if (later) patchTiles();
        return now + later;
      });
    }).catch(function () { return 0; });
  }

  // ------------------------------------------------------------ drawer
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function released(r) {
    if (!r.y) return null;
    if (r.mo && r.dd) return r.dd + ' ' + MONTHS[r.mo - 1] + ' ' + r.y;
    if (r.mo) return MONTHS[r.mo - 1] + ' ' + r.y;
    return String(r.y);
  }
  function have(v) { return v != null && v !== '' && v !== '\u2014' && v !== '-'; }
  function players(p) { return p > 1 ? '1 to ' + p : '1'; }

  /* The drawer builders print a dash where they know nothing (a pack-supplied
     Game Boy title: Developer, Genre, Players, the genre and date pills, the
     status panel). Those exact placeholders, and only those, are filled in
     place; anything filled here is not repeated in the section below.
     Returns the set of labels filled. */
  function fillPlaceholders(modal, r) {
    var done = {};
    var DASH = /^\s*[\u2014-]\s*$/;
    var vals = { Developer: r.dv, Genre: r.g, Players: r.p ? players(r.p) : null };
    modal.querySelectorAll('.drawer-sidebar .factbox .row').forEach(function (row) {
      var k = row.querySelector('.k'), v = row.querySelector('.v');
      if (!k || !v || !DASH.test(v.textContent)) return;
      var key = k.textContent.trim();
      if (have(vals[key])) { v.textContent = vals[key]; done[key] = 1; }
    });
    // GB drawer pill order: genre, then release date.
    var pills = [].filter.call(modal.querySelectorAll('[data-tab-content="device"] .pill-row .pill:not(.series-pill)'), function (p) { return DASH.test(p.textContent); });
    var pv = [r.g, released(r)];
    pills.forEach(function (p, i) { if (have(pv[i])) p.textContent = pv[i]; else p.style.display = 'none'; });
    modal.querySelectorAll('.status-panel .status-row').forEach(function (row) {
      var k = row.querySelector('.status-k'), v = row.querySelector('.status-v');
      if (!k || !v || v.children.length || !(DASH.test(v.textContent) || !v.textContent.trim())) return;
      var key = k.textContent.replace(/[>:\s]/g, '');
      var val = key === 'GENRE' ? r.g : key === 'RELEASE' ? released(r) : null;
      if (have(val)) v.textContent = String(val).toUpperCase();
    });
    // An empty Releases table (a pack-supplied title has no regional dates) is
    // hidden rather than shown as a blank box.
    modal.querySelectorAll('[data-tab-content="device"] .device-modal-body .sect').forEach(function (s) {
      var fb = s.querySelector(':scope > .factbox');
      if (fb && !fb.children.length) s.style.display = 'none';
    });
    var sub = modal.querySelector('.modal-head .modal-sub');
    if (sub && /\u00b7\s*[\u2014-]\s*$/.test(sub.textContent) && have(released(r))) sub.textContent = sub.textContent.replace(/[\u2014-]\s*$/, released(r));
    return done;
  }

  /* Review scores, shown beside the age rating. rs = [mean of 1 to 5 stars,
     number of ratings, LaunchBox id]; rc = [[reviewer, score as printed], ...]
     from Wikidata, rq its item. A title with neither says so plainly. */
  function scoreRows(r) {
    var out = [];
    // rs[2] is the LaunchBox website's page number (not Metadata.xml's DatabaseID,
    // which numbers pages differently); a pack built before 2026-10-14's fix has
    // only three fields and is not trusted. 0 = no verified page: count unlinked.
    var rs = SHOW_LB && r.rs && r.rs.length > 3 ? r.rs : null;
    function line(k, html, cls) { out.push('<div class="row' + (cls ? ' ' + cls : '') + '"><span class="k">' + k + '</span><span class="v">' + html + '</span></div>'); }
    if (rs) {
      var n = rs[1];
      var cnt = n.toLocaleString('en-AU') + (n === 1 ? ' rating' : ' ratings');
      if (rs[2] > 0) cnt = '<a href="https://gamesdb.launchbox-app.com/games/details/' + encodeURIComponent(rs[2]) + '" target="_blank" rel="noopener">' + cnt + '</a>';
      line('Review score', '<b class="gm-score-num">' + (Math.round(rs[0] * 10) / 10).toFixed(1) + '/5</b> (' + cnt + (n < 5 ? ', too few to rely on' : '') + ')', 'gm-score');   // source named in the credit line below (2026-10-14)
    }
    if (r.rc && r.rc.length) {
      line(rs ? 'Critics' : 'Review score', r.rc.map(function (c) { return esc(c[0]) + ' ' + esc(c[1]); }).join(', ') +
        ' (<a href="https://www.wikidata.org/wiki/' + encodeURIComponent(r.rq || '') + '" target="_blank" rel="noopener">via Wikidata</a>)', 'gm-score');
    }
    if (!out.length) line('Review score', 'No review score found for this game yet', 'gm-score gm-score-none');
    return out;
  }

  function sectionHTML(d, hit, filled) {
    var r = hit.rec, rows = [];
    filled = filled || {};
    function row(k, v) { if (have(v)) rows.push('<div class="row"><span class="k">' + k + '</span><span class="v">' + esc(v) + '</span></div>'); }
    // Facts the drawer already states are not repeated.
    // A date fillYears() wrote (month and year on the tile) is still given in full here.
    if (!have(d.released) || d.releasedFrom === 'metadata') row('Released', released(r));
    if (!have(d.developer) && !filled.Developer) row('Developer', r.dv);
    row('Publisher', r.pb);
    if (!have(d.genre) && !filled.Genre) row('Genre', r.g);
    if ((!have(d.players) || /^Up to 2/.test(String(d.players))) && !filled.Players) row('Players', r.p ? players(r.p) : null);
    if (!(d.regions && d.regions.length)) row('Region', r.r);
    row('Series', r.f);
    row('ESRB rating', r.e);
    rows.push.apply(rows, scoreRows(r));
    if (r.c !== 't') row('Identified as', r.n + (r.c === 'n' ? ' (matched by file name, not by hash)' : ''));
    var html = '';
    var ownDesc = have(d.description) && !d.fromPack;
    if (r.d && !ownDesc) {
      html += '<section class="sect gm-about"><h3 class="sect-h">About the game</h3>' +
        r.d.split(/\n{2,}/).map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join('') + '</section>';
    }
    if (rows.length) html += '<section class="sect gm-facts"><h3 class="sect-h">Game details</h3><div class="factbox">' + rows.join('') + '</div></section>';
    if (!html) return '';
    var notes = [];
    if (r.x || r.dx) notes.push('Some details are taken from another release of the same game.');
    if ((SHOW_LB && r.rs) || r.rc) notes.push('Review scores from ' + [(SHOW_LB && r.rs) ? '<a href="https://gamesdb.launchbox-app.com/" target="_blank" rel="noopener">LaunchBox Games Database</a> (its users&#39; 1 to 5 star ratings)' : null,
      r.rc ? '<a href="https://www.wikidata.org/" target="_blank" rel="noopener">Wikidata</a> (published reviews, CC0)' : null].filter(Boolean).join(' and ') +
      ', matched by title, so every release of the game shares them.');
    if (hit.shelf !== 'gnw') notes.push('Details from <a href="https://datomatic.no-intro.org/" target="_blank" rel="noopener">No-Intro</a>, ' +
      '<a href="https://github.com/libretro/libretro-database" target="_blank" rel="noopener">libretro-database</a> ' +
      '(<a href="' + LICENCE_URL + '" target="_blank" rel="noopener">CC BY-SA 4.0</a>) and ' +
      '<a href="https://github.com/OpenVGDB/OpenVGDB" target="_blank" rel="noopener">OpenVGDB</a>.');
    // 4 Nov 2026: a text no other source has comes from the LaunchBox Games Database (pack field ds:'lb')
    if (r.d && !ownDesc && r.ds === 'lb') notes.push('The description is from the <a href="https://gamesdb.launchbox-app.com/" target="_blank" rel="noopener">LaunchBox Games Database</a>.');
    return notes.length ? html + '<p class="gm-credit">' + notes.join(' ') + '</p>' : html;
  }

  /* Called by openDevice() once a drawer is on screen. The section lands under
     the title row; if the drawer has been replaced by the time the data comes
     back (another game opened), nothing is written. */
  function decorateDrawer(d) {
    var modal = document.getElementById('device-modal');
    if (!modal || !(shelvesOf(d).length || isGnw(d))) return;
    if (d.unreleased) return;   // a device never released has no reviews: no section at all
    var body = modal.querySelector('[data-tab-content="device"] .device-modal-body');
    if (!body) return;
    var slot = document.createElement('div');
    slot.className = 'gm-slot';
    slot.setAttribute('data-gm-id', d.id);
    var anchor = body.querySelector('.drawer-title-row');
    if (anchor && anchor.nextSibling) body.insertBefore(slot, anchor.nextSibling); else body.appendChild(slot);
    lookup(d).then(function (hit) {
      if (!slot.isConnected) return;
      // No record at all: the drawer still says plainly that no score was found.
      if (!hit) { slot.innerHTML = '<section class="sect gm-facts"><h3 class="sect-h">Reviews</h3><div class="factbox">' + scoreRows({}).join('') + '</div></section>'; return; }
      var filled = {};
      if (hit.shelf !== 'gnw') try { filled = fillPlaceholders(modal, hit.rec); } catch (e) {}
      var h = sectionHTML(d, hit, filled);
      if (h) slot.innerHTML = h; else slot.remove();
    });
  }

  // ------------------------------------------------------------ box art
  var _miss = null;
  function missSet() {
    if (_miss) return _miss;
    try { _miss = JSON.parse(sessionStorage.getItem(ART_MISS_KEY) || '{}') || {}; } catch (e) { _miss = {}; }
    return _miss;
  }
  function markMiss(u) { missSet()[u] = 1; try { sessionStorage.setItem(ART_MISS_KEY, JSON.stringify(_miss)); } catch (e) {} }
  // libretro's thumbnail naming: these characters become '_'.
  function thumbUrl(lr, name) {
    return THUMBS + encodeURIComponent(lr) + '/Named_Boxarts/' + encodeURIComponent(String(name).replace(/[&*\/:`<>?\\|"]/g, '_')) + '.png';
  }
  /* Thumbnails checked by eye and refused (2026-10-22): the thumbnail
     server answers these names with another game's box, so the tile skips it and shows
     the generic cover. Keyed by thumbnail shelf + record name. */
  var REFUSED_ART = {
    'Atari - 2600|Extra Terrestrials (USA)': 'Atari E.T. box, a different game',
    'Atari - 5200|5200 Menu (USA) (Proto)': 'the Atari 5200 console box',
    'Atari - 5200|Atari PAM System Test (USA) (v1.02)': 'the Diagnostics cartridge picture',
    'Nintendo - Game Boy|Mani 4 in 1 - R-Type II + Saigo no Nindou + Ganso!! Yancha Maru + Shisenshou - Match-Mania (China) (Ja)': 'a Tetris 4 in 1 box'
  };
  function refusedArt(lr, name) { return Object.prototype.hasOwnProperty.call(REFUSED_ART, lr + '|' + name); }
  function deviceFor(id) {
    try { return (typeof ALL_DEVICES !== 'undefined') ? ALL_DEVICES.find(function (x) { return x.id === id; }) : null; } catch (e) { return null; }
  }

  /* Paint the secondary box art into a tile's art box. `isCurrent` says whether
     the tile still wants it (the mode may have changed meanwhile). Used for a
     tile our own buckets missed, and for tiles of shelves we have no bucket for. */
  /* `onMiss` (2026-10-21): called when this source has nothing for the tile either
     (no record, no thumbnail shelf, a known or fresh miss), so the caller can paint
     its last source, the system's generic cover (emby.js paintGenericArt). */
  function fallbackArt(card, box, isCurrent, onMiss) {
    if (!card || !box) return;
    var miss = function () { try { if (typeof onMiss === 'function') onMiss(); } catch (e) {} };
    var d = deviceFor(card.dataset.id);
    if (!d) return miss();
    lookup(d).then(function (hit) {
      if (!card.isConnected || (isCurrent && !isCurrent())) return;
      if (!hit) return miss();
      return index().then(function (ix) {
        var lr = ix && ix.shelves[hit.shelf] && ix.shelves[hit.shelf].lr;
        if (!lr || refusedArt(lr, hit.rec.n)) return miss();
        var url = thumbUrl(lr, hit.rec.n);
        if (missSet()[url]) return miss();
        var img = new Image();
        img.decoding = 'async';
        img.alt = '';
        img.className = 'gb-art-img gm-art-img';
        img.referrerPolicy = 'no-referrer';
        img.onload = function () {
          if (!card.isConnected || (isCurrent && !isCurrent())) return;
          box.appendChild(img);
          markCoverSource(box, img);
          requestAnimationFrame(function () { box.classList.add('gb-art-loaded'); });
        };
        img.onerror = function () { markMiss(url); miss(); };
        img.src = url;
      });
    }).catch(function () { miss(); });
  }

  /* The Media grid's box-art modes for the shelves that have no bucket of ours
     (Game Boy Color, the Atari machines, a Pokemon mini title with no box, and
     the NES family until its buckets exist). Same shape as emby.js's
     mountGbBoxArt(): the name is the floor, the cover fades in over it, and the
     tile's live mount is removed in the same tick, before anything arms it.
     A tile some other mount already claimed (data-gbart) is left alone. */
  var _obs = null;
  function observer() {
    if (_obs) return _obs;
    _obs = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        obs.unobserve(e.target);
        var card = e.target, mode = card.dataset.gmart;
        var bx = card.querySelector(':scope > .img');
        // no cover anywhere: the name stays, and the load blur stops waiting (index.html _tileRevealCheck)
        fallbackArt(card, bx, function () { return card.dataset.gmart === mode; }, function () { if (bx && card.dataset.gmart === mode) bx.setAttribute('data-art-done', '1'); });
      });
    }, { rootMargin: '400px 300px' });
    return _obs;
  }
  function mountBoxArt(mode) {
    var cards = document.querySelectorAll('#video-grid .device-card:not([data-gbart]):not([data-gmart])');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var d = deviceFor(card.dataset.id);
      if (!d || !shelvesOf(d).length) continue;
      card.dataset.gmart = mode || 'hardware';
      if (!mode || mode === 'hardware') continue;
      // A title with box art of its own keeps it.
      try { if (typeof _artModeForDevice === 'function' && _artModeForDevice(mode, d) !== 'hardware') continue; } catch (e) {}
      var box = card.querySelector(':scope > .img');
      if (!box) continue;
      var tag = box.querySelector('.tag');
      var name = card.querySelector(':scope > .body > .name');
      box.classList.remove('missing', 'has-gb-emu', 'has-nes-emu');
      [].slice.call(box.classList).forEach(function (c) { if (/^has-.*-emu$/.test(c)) box.classList.remove(c); });
      box.classList.add('gb-art-box');
      box.style.removeProperty('--hero');
      box.removeAttribute('data-hero-src');
      box.innerHTML = '<span class="gb-art-name">' + esc(name ? name.textContent : '') + '</span>';
      if (tag) box.appendChild(tag);
      observer().observe(card);
    }
  }

  // ------------------------------------------------------------ cover source
  /* TESTING AID (2026-10-11): "I need to see where the cover art comes
     from." Colours swapped 2026-10-12: GREEN = R2 library,
     RED = secondary sites. Every box-art tile that
     shows a cover gets a corner dot and an inset edge in the colour of the host
     the <img> actually loaded from (its final src, after any 404 fallback).
     TO REMOVE: set COVER_SOURCE_MARKERS to false (or delete it, this function,
     its three callers -- here and paintGbArt/paintNesArt in emby.js -- and the
     .cover-src CSS below). */
  var COVER_SOURCE_MARKERS = false;   // off (22 Oct: diagnostic, no longer needed)
  function markCoverSource(box, img) {
    if (!COVER_SOURCE_MARKERS || !box || !img) return;
    var host = '';
    try { host = new URL(img.currentSrc || img.src, location.href).hostname; } catch (e) {}
    var src = /\.r2\.dev$/i.test(host) ? 'r2' : 'alt';
    box.setAttribute('data-cover-src', src);
    var dot = box.querySelector(':scope > .cover-src');
    if (!dot) { dot = document.createElement('span'); box.appendChild(dot); }
    dot.className = 'cover-src cover-src-' + src;
    dot.setAttribute('aria-hidden', 'true');
    dot.title = src === 'r2' ? 'Cover: our R2 library (' + host + ')' : 'Cover: secondary site (' + host + ')';
  }

  // ------------------------------------------------------------ styles
  try {
    var st = document.createElement('style');
    st.textContent =
      '.device-modal-body .gm-facts .factbox .v{overflow-wrap:anywhere}' +
      '.device-modal-body .gm-about p{white-space:normal}' +
      '.device-modal-body .gm-credit{margin:10px 0 0;font-size:11.5px;line-height:1.5;color:var(--muted)}' +
      '.device-modal-body .gm-credit a{color:inherit;text-decoration:underline;text-underline-offset:2px}' +
      '.device-modal-body .gm-score .v a{color:inherit;text-decoration:underline;text-underline-offset:2px}' +
      '.device-modal-body .gm-score .gm-score-num{font-weight:700;color:var(--text)}' +
      '.device-modal-body .gm-score-none .v{color:var(--muted);font-style:italic}' +
      // cover source markers (testing aid, see COVER_SOURCE_MARKERS)
      '.device-card .img > .cover-src{position:absolute;right:10px;bottom:10px;width:16px;height:16px;border-radius:50%;z-index:4;pointer-events:none;box-shadow:0 0 0 2px #fff,0 1px 4px rgba(0,0,0,.6)}' +
      '.device-card .img > .cover-src-r2{background:#22c55e}' +
      '.device-card .img > .cover-src-alt{background:#e5372b}' +
      '.device-card .img[data-cover-src="r2"] > .gb-art-img{outline:3px solid #22c55e;outline-offset:-3px}' +
      '.device-card .img[data-cover-src="alt"] > .gb-art-img{outline:3px solid #e5372b;outline-offset:-3px}';
    document.head.appendChild(st);
  } catch (e) {}

  /* Game & Watch drawers are built by openDevice() without a GameMeta call, so
     the score is added when #device-modal is refilled for a G&W unit. */
  try {
    var gnwHook = function () {
      var dm = document.getElementById('device-modal');
      if (!dm) return false;
      new MutationObserver(function () {
        var id = null;
        try { id = typeof _openDeviceId !== 'undefined' ? _openDeviceId : null; } catch (e) {}
        var d = id && deviceFor(id);
        if (!isGnw(d) || dm.querySelector('.gm-slot')) return;
        decorateDrawer(d);
      }).observe(dm, { childList: true });
      return true;
    };
    if (!gnwHook()) document.addEventListener('DOMContentLoaded', gnwHook, { once: true });
  } catch (e) {}

  window.GameMeta = { fillYears: fillYears, fillScores: fillScores, ratingHTML: ratingHTML, markCoverSource: markCoverSource, lookup: lookup, decorateDrawer: decorateDrawer, fallbackArt: fallbackArt, mountBoxArt: mountBoxArt, thumbUrl: thumbUrl, refusedArt: refusedArt };
  // A far tile put back on the page (index.html) gets the ratings that came while it was away.
  // Only those tiles, looked up by index (patchTiles' whole-list search per tile cost 0.6 s per 14 swipes at 3,200 tiles).
  document.addEventListener('cw-wall-restored', function (ev) {
    try {
      var cards = (ev.detail && ev.detail.cards) || [];
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i];
        if (!c.matches || !c.matches('.device-card[data-id]:not(.video-card)')) continue;
        var meta = c.querySelector(':scope > .body > .meta');
        if (!meta || meta.querySelector('.star')) continue;
        var d = window._deviceById ? window._deviceById(c.dataset.id) : deviceFor(c.dataset.id);
        if (!d || !(d.score10 > 0)) continue;
        var empty = !meta.textContent.replace(/ /g, '').trim();
        if (empty) meta.innerHTML = ratingHTML(d, false); else meta.insertAdjacentHTML('beforeend', ratingHTML(d, true));
      }
    } catch (e) {}
  });
})();

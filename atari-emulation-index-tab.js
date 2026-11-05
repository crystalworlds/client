/* ===========================================================================
 * Atari Emulation tab: the dispatcher, keyed by catalogue (ATARI_SYSTEMS in index.html)
 *
 * GENERATED. DO NOT EDIT. Source: the Atari build guides (the docs/emulation
 * folders) and the docs/INTERFACE files in the Atari emulator's source tree, rendered by
 * tools/build_emulation_tabs.mjs there. Edit the markdown and regenerate;
 * `--check` reds on any drift. Loaded by a plain <script src> tag (the site
 * must open over file://); no fetch.
 * =========================================================================== */

/* Per catalogue key: the console's own guide, and the chapters it reads from
 * another Atari guide (declared in its README, plus every chapter its own
 * text links to, one level), as [console, unit] pairs in reading order. */
var ATARI_EMU_TABS = {"atari2600":{"key":"2600","label":"Atari 2600","fn":"atari2600EmulationTabHTML","data":"ATARI_EMU_2600","borrows":[]},"atari7800":{"key":"7800","label":"Atari 7800","fn":"atari7800EmulationTabHTML","data":"ATARI_EMU_7800","borrows":[["2600","02-cpu"],["2600","03-riot"],["2600","04-cartridges"],["2600","05-tia-video"],["2600","06-tia-audio"],["2600","07-controllers"],["2600","08-regions"],["2600","10-interface"],["2600","12-arm-cartridges"],["2600","opcodes-py"],["2600","palette-py"],["2600","interface"]]},"atari5200":{"key":"5200","label":"Atari 5200","fn":"atari5200EmulationTabHTML","data":"ATARI_EMU_5200","borrows":[["2600","02-cpu"],["2600","opcodes-py"],["7800","06-pokey"],["7800","07-sound"]]},"atarilynx":{"key":"lynx","label":"Atari Lynx","fn":"atarilynxEmulationTabHTML","data":"ATARI_EMU_LYNX","borrows":[["2600","interface"]]}};

/* The Emulation tab for an Atari drawer: the console's own guide, then the
 * chapters it reads from other guides, copied from their files. In the copied
 * chapters and in every link, an id from another console's namespace
 * (atari2600emu-...) is re-prefixed for this drawer (atari7800emu-x2600-...),
 * so each drawer's ids are its own and every link lands inside it. A lender
 * whose file is not loaded is named as plain text. '' for a key not here. */
function atariEmulationTabHTML(d) {
  var t = d && ATARI_EMU_TABS[d.catalogue];
  var g = typeof window !== "undefined" ? window : globalThis;
  if (!t || typeof g[t.fn] !== "function") return "";
  var html = g[t.fn](d);
  if (t.borrows.length) {
    var body = "", toc = "", missing = [], have = {}, last = null, navs = "";
    for (var j = 0; j < t.borrows.length; j++) have[t.borrows[j][0] + "|" + t.borrows[j][1]] = 1;
    for (var i = 0; i < t.borrows.length; i++) {
      var k = t.borrows[i][0], u = t.borrows[i][1];
      var lender = null;
      for (var c in ATARI_EMU_TABS) if (ATARI_EMU_TABS[c].key === k) lender = ATARI_EMU_TABS[c];
      var data = lender && typeof g[lender.data] === "object" ? g[lender.data] : null;
      /* this guide's own copy first (`lent`), so the tab is complete with only its own file loaded */
      var own = g[t.data], copy = own && own.lent && own.lent[k + "|" + u];
      if (copy) { data = { label: copy.label, titles: {}, units: {} }; data.titles[u] = copy.title; data.units[u] = copy.html; }
      if (!data) { missing.push("Atari " + k + ": " + u); continue; }
      if (k !== last) {
        if (toc) navs += toc + '</nav>';
        toc = '<nav class="gbemu-toc"><b>From the ' + data.label + ' guide</b> ';
      }
      toc += '<a href="#atari' + k + 'emu-' + u + '">' + data.titles[u].replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</a> ';
      if (k !== last) { body += '\n<h4 class="gbemu-sub" id="atari' + k + 'emu-guide">From the ' + data.label + ' guide</h4>'; last = k; have[k + "|guide"] = 1; }
      /* a link from a borrowed chapter to one this drawer does not carry is shown as its text */
      body += "\n" + data.units[u].replace(/<a href="#atari(2600|7800|5200|lynx)emu-([a-z0-9]+(?:-[a-z0-9]+)*)(?:--[^"]*)?">([\s\S]*?)<\/a>/g,
        function (m, k2, u2, txt) { return k2 === t.key || have[k2 + "|" + u2] ? m : txt; });
    }
    html += '<div class="gbemu atariemu atariemu-borrowed"><section class="sect"><h3 class="sect-h" id="atari' + t.key + 'emu-borrowed">Chapters this guide reads from another Atari guide</h3>' +
      '<p>The ' + t.label + ' guide builds on these chapters rather than repeating them. They are the same text as on the other console\'s tab.</p>' +
      navs + (toc ? toc + '</nav>' : '') +
      (missing.length ? '<p>Not loaded on this page: ' + missing.join(", ") + '.</p>' : '') + '</section>' + body + '</div>';
  }
  return html.replace(/(id="|href="#)atari(2600|7800|5200|lynx)emu-/g, function (m, a, k) {
    return k === t.key ? m : a + "atari" + t.key + "emu-x" + k + "-";
  });
}

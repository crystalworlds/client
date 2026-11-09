/*
 * checked-rebuilding.js -- "Checked by rebuilding", the clean-room table (1 Nov 2026).
 *
 * Each system's Emulation tab goes to a builder who has never seen our code; they build the
 * emulator from the tab alone and their build is tested against ours. One row per system.
 * First drawn on the Features page; moved to the Home window, directly above "Why it matters",
 * the same day (1 Nov 2026). index.html holds the empty <div id="home-checked"> where it
 * is drawn; the styles are the .ft-cr* rules in features.css (loaded on every page).
 *
 * Later rounds change only the CHECKED rows (rounds continue until the tabs are exact; NES joined
 * on 2 Nov 2026). Fields: sys (the key deeplinks.js cwSysDocHTML opens), name, date, at (the
 * first characters of the served emulator file's SHA-256), time (how long the builder
 * took to build the emulator from the tab: the Build time column, after Date), built (from the documents alone: the
 * line under the table is drawn only while every row is 'Yes'), pass (true when the build matched
 * ours on everything scored: a green row with "Matches", else red with "Not yet"), score.
 *
 * A real table at every size (rows stay rows): on a narrow screen the date moves under the system
 * name and the type gets smaller. Colour is never the only sign (tick or cross, and the words).
 * Each system name is a button that opens its Emulation tab in the documentation window (the
 * same window as #/<system>/emulation); Escape or Back closes it and leaves Home as it was.
 * One focus stop per row for a keyboard, controller or remote. No narration: nothing is recorded
 * for it, so no Listen button.
 */
(function () {
  'use strict';
  if (window.CwChecked) return;

  const CHECKED = [
    { sys: 'gnw', name: 'Game &amp; Watch', date: '1 Nov 2026', at: 'f07b89cb', time: '15 min', built: 'Yes', pass: true, score: 'All 6 test sections pass on all 61 games' },
    { sys: 'pokemon-mini', name: 'Pokémon mini', date: '1 Nov 2026', at: '69b5e9c4', time: '25 min', built: 'Yes', pass: true, score: '54 of 54 games identical in picture and sound' },
    { sys: 'gb', name: 'Game Boy', date: '10 Nov 2026', at: 'ca5a2a32f97e', time: '2 h 6 min', built: 'Yes', pass: true, score: 'Identical to ours: 170 of 170 tests, every AGE and mealybug test' },
    { sys: 'gbc', name: 'Game Boy Color', date: '10 Nov 2026', at: 'ca5a2a32f97e', time: '3 h 47 min', built: 'Yes', pass: true, score: 'Identical to ours: 94 of 94 Color tests (73 sound), 167 of 167 Game Boy tests, every AGE and mealybug test' },
    { sys: 'nes', name: 'NES', date: '9 Nov 2026', at: '11bdfbfa1e99', time: '3 h 53 min', built: 'Yes', pass: true, score: 'Identical to ours on all 9 test sections: 202 of 202 cartridge types, 208 of 208 library games' },
    { sys: 'atari2600', name: 'Atari 2600', date: '2 Nov 2026', at: '2624d06e085f', time: '68 min', built: 'Yes', pass: true, score: 'Identical to ours: 167 of 167 runs in picture, every processor step, sound and memory' },
    { sys: 'atari7800', name: 'Atari 7800', date: '2 Nov 2026', at: '9fcf64924bbd', time: '38 min', built: 'Yes', pass: true, score: '332 of 332 runs identical in picture, sound and every processor step' },
    { sys: 'atari5200', name: 'Atari 5200', date: '2 Nov 2026', at: '7fc3ff99d1fa', time: '39 min', built: 'Yes', pass: true, score: 'Identical to ours: 68 of 68 runs in picture, sound, every processor step and memory' },
    { sys: 'atarilynx', name: 'Atari Lynx', date: '2 Nov 2026', at: 'b516021267aa', time: '32 min', built: 'Yes', pass: true, score: '40 of 40 runs identical in picture, sound and every processor step' },
  ];
  /* "Built from the documents alone" is not a column (1 Nov: every row is Yes): the line
     under the table says it once. */
  const COLS = ['System', 'Date', 'Build time', 'Checked against', 'Score against our emulator'];

  const row = r => '<tr class="' + (r.pass ? 'ft-cr-ok' : 'ft-cr-no') + '"><th scope="row">'
    + '<button type="button" class="ft-cr-sys" data-cr-emu="' + r.sys + '" data-cr-title="' + r.name + '">' + r.name + '</button>'
    + '<span class="ft-cr-date">' + r.date + '</span>'
    + '<span class="ft-cr-date">Build time <span style="white-space:nowrap">' + r.time + '</span></span>'
    + '<span class="ft-cr-mark">' + (r.pass ? '<span aria-hidden="true">✓ </span>Matches' : '<span aria-hidden="true">✗ </span>Not yet') + '</span></th>'
    + '<td class="ft-cr-dcol">' + r.date + '</td>'
    + '<td class="ft-cr-dcol">' + r.time + '</td>'
    + '<td><code>' + r.at + '</code></td>'
    + '<td>' + r.score + '</td></tr>';

  /* The section's inside (the outer <div class="section"> is index.html's #home-checked). */
  function html() {
    return '<div class="section-head"><div>'
      + '<h2 class="section-title">Checked by rebuilding</h2>'
      + '</div></div>'
      + '<p class="section-desc">To prove our documentation is accurate, we hand each system\'s Emulation tab to a builder who has never seen our code. They build the emulator from the tab alone, and we test their build against ours.</p>'
      + '<div class="ft-tablewrap ft-crwrap"><table class="ft-table ft-crtable"><thead><tr>'
      + COLS.map((c, i) => '<th scope="col"' + (i === 1 || i === 2 ? ' class="ft-cr-dcol"' : '') + '>' + c + '</th>').join('')
      + '</tr></thead><tbody>'
      + CHECKED.map(row).join('')
      + '</tbody></table></div>'
      + (CHECKED.every(r => r.built === 'Yes') ? '<p class="ft-cr-note">Every build in this table was made from the documents alone.</p>' : '')
      + '<p class="ft-cr-note ft-cr-note2">Checked against: the first characters of the fingerprint (SHA-256) of the exact emulator file the site serves, so anyone can confirm which build was tested.</p>';
  }

  function render() {
    const host = document.getElementById('home-checked');
    if (host && !host.querySelector('.ft-crtable')) host.innerHTML = html();
  }

  /* A system name opens its Emulation tab (emulators-table.js openDoc, the window the Home cards'
     proofs use), over Home; closing it comes back to the same place. */
  document.addEventListener('click', ev => {
    const b = ev.target && ev.target.closest ? ev.target.closest('[data-cr-emu]') : null;
    if (!b) return;
    const key = b.getAttribute('data-cr-emu'), E = window.CwEmuCards;
    if (E && E.openDoc && typeof window.cwSysDocHTML === 'function') {
      const tmp = document.createElement('div'); tmp.innerHTML = b.getAttribute('data-cr-title') || '';
      E.openDoc({ fn: 'cwSysDocHTML', args: [key, 'emulation'], anchor: '', title: tmp.textContent, sub: 'Emulation' });
    } else if (typeof window.route === 'function') window.route('/' + key + '/emulation');
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
  window.CwChecked = { rows: CHECKED, html, render };
})();

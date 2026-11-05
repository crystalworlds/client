/* ===========================================================================
 * Game Boy Color Emulation tab — gbcEmulationTabHTML(d): the composer of the four area files
 *
 * Moved verbatim out of index.html (no edits to the code itself) so that
 * documentation work on this tab is independent of work on the main page.
 * Loaded by a plain <script src> tag — deliberately NOT fetch(), because the
 * site must also open from disk over file://, where fetch is blocked.
 * Defines its builder as a top-level function declaration, exactly as before,
 * so it remains a window global and index.html calls it unchanged.
 * =========================================================================== */

/* === Game Boy Color Emulation tab =========================================
 * Same signature and same call convention as gbEmulationTabHTML(d) above, and
 * it reuses that tab's CSS wholesale -- no new classes, no new rules. It is
 * selected in openGBDevice() on d.system === 'gbc'.
 *
 * NO SCREENSHOTS. There is no CGB render in images_gb_emu_b64.json, and a
 * broken image is worse than an absent one, so this tab carries tables and
 * denominators where the DMG tab carries a grid of frames. If colour renders
 * are ever bundled, add them as a new gbemu-grid at the end of section 17 and
 * nowhere else -- every figure in that section is scored against a stored
 * emulator render, not against silicon, and the section says so.
 *
 * EVERY CLAIM CARRIES ITS LABEL INLINE: DERIVED / MEASURED / CONVERGENCE /
 * NOT SETTLED. That is the whole point of the page. Do not tidy the labels
 * out, and do not promote one without moving the evidence with it.        */
/* ===========================================================================
 * The areas (2 November 2026): four area files, composed here in
 * order. Every anchor of the single-file tab (#gbce-...) still resolves.
 * =========================================================================== */
const GBC_EMU_AREAS = [
  { key: 'machine', title: 'Overview, checklist, and what differs from the Game Boy', file: 'gbc-machine-emulation-tab.js', fn: 'gbcMachineEmulationTabHTML', sections: [['gbce-glossary', 'Glossary'], ['gbce-1', '1. What changes, and what does not'], ['gbce-2', '2. Where the Color starts'], ['gbce-15', '15. Revisions, and why one core cannot be both'], ['gbce-16', '16. What to test with'], ['gbce-17', '17. What the evidence here is worth'], ['gbce-18', '18. What is not settled']] },
  { key: 'timing', title: 'Processor-visible timing, double speed, transfers, registers', file: 'gbc-timing-emulation-tab.js', fn: 'gbcTimingEmulationTabHTML', sections: [['gbce-3', '3. Double speed'], ['gbce-4', '4. Work RAM, and the two questions every register asks'], ['gbce-11', '11. The block transfer'], ['gbce-12', '12. Sprite-memory transfer on the Color'], ['gbce-14', '14. The undocumented registers'], ['gbce-regs', 'Appendix A. The Color&rsquo;s registers, bit by bit']] },
  { key: 'ppu', title: 'The Color picture', file: 'gbc-ppu-emulation-tab.js', fn: 'gbcPpuEmulationTabHTML', sections: [['gbce-5', '5. Video memory banking and the attribute byte'], ['gbce-6', '6. Palette memory and the colour pipeline'], ['gbce-7', '7. Priority: the bit that means two things'], ['gbce-8', '8. Objects'], ['gbce-9', '9. Compatibility mode'], ['gbce-10', '10. Where the picture processor departs']] },
  { key: 'apu', title: 'The Color sound', file: 'gbc-apu-emulation-tab.js', fn: 'gbcApuEmulationTabHTML', sections: [['gbce-13', '13. Sound']] }
];

function gbcEmuGlobal() { return typeof window !== 'undefined' ? window : globalThis; }

function gbcEmuAreaIndexHTML() {
  const g = gbcEmuGlobal();
  let h = '<div class="gbemu-toc"><b>This page in four areas, one file each</b>';
  for (let i = 0; i < GBC_EMU_AREAS.length; i++) {
    const a = GBC_EMU_AREAS[i];
    h += '<a href="#gbcemu-area-' + a.key + '">' + (i + 1) + '. ' + a.title + '</a>';
  }
  h += '</div>';
  for (let i = 0; i < GBC_EMU_AREAS.length; i++) {
    const a = GBC_EMU_AREAS[i];
    const loaded = typeof g[a.fn] === 'function';
    h += '<div class="gbemu-toc"><b>' + (i + 1) + '. ' + a.title + ' <span style="font-weight:400">(' + a.file + (loaded ? '' : ', not loaded') + ')</span></b>';
    for (const s of a.sections) h += '<a href="#' + s[0] + '">' + s[1] + '</a>';
    h += '</div>';
  }
  return h;
}

function gbcEmulationAreaHTML(d, key) {
  const a = GBC_EMU_AREAS.find(function (x) { return x.key === key; });
  const f = a && gbcEmuGlobal()[a.fn];
  return typeof f === 'function' ? f(d) : '';
}

function gbcEmulationTabHTML(d) {
  const g = gbcEmuGlobal();
  let h = '<div class="gbemu">';
  for (const a of GBC_EMU_AREAS) {
    const f = g[a.fn];
    h += typeof f === 'function' ? f(d)
      : '<div class="gbemu-area" id="gbcemu-area-' + a.key + '"><p class="hw-readable">' + a.title + ': its file, <code>' + a.file + '</code>, is not loaded.</p></div>';
  }
  return h + '</div>';
}

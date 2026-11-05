/* ===========================================================================
 * Emulation tab dispatcher — emulationTabHTML(d)
 *
 * The drawer calls gnwChipEmulationTabHTML(d) first (the per-chip Game &
 * Watch tabs, gnw-*-emulation-tab.js), which covers every Sharp SM5xx title,
 * and falls back to this function for everything else. The only devices that
 * reach here with a tab of their own are the two TFT units (Mario, Zelda),
 * whose tab lives in tft-emulation-tab.js.
 *
 * Loaded by a plain <script src> tag — deliberately NOT fetch(), because the
 * site must also open from disk over file://, where fetch is blocked.
 * Defines its builder as a top-level function declaration so it remains a
 * window global and index.html calls it unchanged.
 * =========================================================================== */

function emulationTabHTML(d) {
  if (typeof TFT_TWIN_UNITS !== 'undefined' && TFT_TWIN_UNITS[d.id]) return tftEmulationTabHTML(d);
  return '';
}

/*
 * play/cores/artfile.mjs -- the address of one device picture, for the play windows' art.mjs.
 *
 * Since 2026-10-24 every console photograph is its own
 * file under images/art/, listed in images/art/art-index.json (built by
 * WASM_Source/art-files/build.py): picture key -> [file, bytes, hash]. A play window fetches
 * the small index once and then only the one picture it draws, instead of a whole archive.
 * The hash goes in the address, so a changed picture is a new address and a browser never
 * pairs an old picture with new screen-window numbers.
 *
 * artFileUrl(key) answers the picture's full address, or null when the index has no such key
 * (or could not be read), which the art modules already treat as "no art: the plain screen".
 */
const SITE_ROOT = new URL('../../', import.meta.url);
const INDEX_URL = new URL('images/art/art-index.json', SITE_ROOT);
let index = null;

function loadIndex() {
  if (!index) {
    /* The page that opened this window may already hold the same index (index.html loads it
       as window.GNW_ART_INDEX); use it when it is there, same origin, to save the request. */
    let j = null;
    try { const P = window.parent !== window ? window.parent : window.opener; j = P && P.GNW_ART_INDEX; } catch (_) { j = null; }
    index = j && j.keys ? Promise.resolve(j)
      : fetch(INDEX_URL).then(r => (r.ok ? r.json() : null)).catch(() => null);
  }
  return index;
}

export async function artFileUrl(key) {
  const j = await loadIndex();
  const row = j && j.keys && j.keys[key];
  if (!row) return null;
  return new URL(j.base + row[0] + '?h=' + row[2], SITE_ROOT).href;
}

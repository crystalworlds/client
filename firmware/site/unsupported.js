/* firmware/site/unsupported.js -- the unsupported list, on every page that loads a game.
 * ===========================================================================
 *
 * The aim (2026-10-05): "we need a way across all emulators to warn and not
 * play unsupported games and firmware ... when we load it it should just warn
 * there and refuse to accept the game. like a hash black list of what we dont
 * support and a reason for each."
 *
 * THE LISTS are firmware/unsupported/<list>.json, one per system, generated
 * from sweep evidence by tools/unsupported/build.mjs (see its README for the
 * rules and the fix -> re-test -> remove loop). Each entry is keyed by
 * the file's full SHA-256 and carries a reason code, a one-line reason for the
 * viewer, and the date added. index.json names the
 * lists. The game server enforces the same lists (CrystalWorldsServer
 * internal/unsupported).
 *
 * WHERE IT IS ENFORCED
 *   - every play page, at the moment bytes are mounted (play/nes, play/gameboy,
 *     play/atari*), by FULL hash -- so the baked set, a content pack, a game
 *     server, the file picker and drag-and-drop all meet the same check;
 *   - the host page, before a play window opens (by the 12-hex hash every
 *     content-addressed id carries), so a refusal never costs a window;
 *   - the tiles: variants.js drops listed files from every pool, so they are
 *     never a group's representative and never counted as a variant, and a
 *     group whose files are ALL listed has no tile (HIDDEN, not marked: see
 *     tools/unsupported/README.md for why);
 *   - the Continue row: continuerow.js skips listed entries.
 *
 * FAIL-OPEN, LOUDLY. A list that does not load is logged and treated as empty:
 * a missing file must not take every game on the site with it.
 *
 * window.CWSUnsupported
 *   .ready            Promise, settled when every list has loaded (or failed)
 *   .lookup(sha256)   entry or null (sync; null until ready)
 *   .forId(id)        entry for a content-addressed id (<prefix>-x<sha12>)
 *   .forDevice(d)     the same for a catalogue entry (also d.sha256)
 *   .check(bytes)     Promise<entry|null>: hash the bytes, look them up
 *   .message(entry)   "This game isn't supported yet: <reason>"
 *   .refuse(entry, {onClose})  the warning, with Close; resolves on close
 *
 * No cartridge bytes leave the page and none are logged. Silent: no sound.
 */
(function () {
  'use strict';
  if (window.CWSUnsupported) return;

  const BASE = (function () {
    try { const s = document.currentScript && document.currentScript.src; if (s) return s.replace(/[^/]*$/, '') + '../unsupported/'; } catch (e) {}
    return 'firmware/unsupported/';
  })();
  const bySha = new Map();    // sha256 -> entry
  const by12 = new Map();     // sha256[0..12) -> entry
  const lists = {};           // list -> { label, count, guards }
  let isReady = false;

  const ready = fetch(BASE + 'index.json', { cache: 'no-cache' })
    .then(r => { if (!r.ok) throw new Error('index.json HTTP ' + r.status); return r.json(); })
    .then(ix => Promise.all(Object.keys(ix.lists || {}).map(L =>
      fetch(BASE + ix.lists[L].file, { cache: 'no-cache' })
        .then(r => { if (!r.ok) throw new Error(L + ' HTTP ' + r.status); return r.json(); })
        .then(doc => {
          lists[L] = { label: doc.label || ix.lists[L].label || L, count: 0, guards: doc.guards || [] };
          for (const sha in (doc.entries || {})) {
            if (!/^[0-9a-f]{64}$/.test(sha)) continue;
            const e = Object.assign({ list: L, sha256: sha }, doc.entries[sha]);
            bySha.set(sha, e);
            by12.set(sha.slice(0, 12), e);
            lists[L].count++;
          }
        })
        .catch(err => console.warn('[unsupported] list ' + L + ' did not load; treated as empty:', err && err.message || err)))))
    .catch(err => console.warn('[unsupported] no lists (' + (err && err.message || err) + '); nothing is refused'))
    .then(() => {
      isReady = true;
      try { window.dispatchEvent(new CustomEvent('cws-unsupported-ready')); } catch (e) {}
    });

  function lookup(sha) { return (sha && bySha.get(String(sha).toLowerCase())) || null; }
  function forId(id) {
    const m = /-x([0-9a-f]{12})$/.exec(String(id || ''));
    return m ? (by12.get(m[1]) || null) : null;
  }
  function forDevice(d) {
    if (!d) return null;
    return forId(d.id) || lookup(d.sha256) || null;
  }

  function hex(buf) { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i++) s += (u[i] < 16 ? '0' : '') + u[i].toString(16); return s; }
  function view(b) {
    if (b instanceof Uint8Array) return b;
    if (b instanceof ArrayBuffer) return new Uint8Array(b);
    if (ArrayBuffer.isView(b)) return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    return null;
  }
  /* The site's own digest when sha.js is loaded (it works on plain-http LAN
     origins where crypto.subtle is absent), else crypto.subtle. */
  function digest(u8) {
    if (window.cwsDigest) return window.cwsDigest('SHA-256', u8);
    if (window.crypto && crypto.subtle) return crypto.subtle.digest('SHA-256', u8);
    if (window.cwsSha) return Promise.resolve(window.cwsSha.sha256(u8).buffer);
    return Promise.reject(new Error('no SHA-256 on this page'));
  }
  async function shaOf(bytes) {
    const u8 = view(bytes);
    if (!u8) return null;
    return hex(await digest(u8));
  }
  async function check(bytes) {
    await ready;
    if (!bySha.size) return null;
    try { return lookup(await shaOf(bytes)); }
    catch (e) { console.warn('[unsupported] could not hash a file; not checked:', e && e.message || e); return null; }
  }

  function message(e) {
    if (!e) return '';
    const what = e.kind === 'firmware' ? 'This firmware isn’t supported yet' : 'This game isn’t supported yet';
    return what + ': ' + String(e.reason || 'it does not run correctly here yet.');
  }

  /* ---- the warning ---------------------------------------------------------
     One dialog, the same in the host and in every play page: the reason and a
     Close button, focused. Enter, Space, Escape and the remote's Back close it.
     In a play page inside the site, Close also closes the play window (the
     host listens for cwsUnsupportedClose). */
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const BACKS = new Set(['Escape', 'Esc', 'Backspace', 'GoBack', 'BrowserBack', 'XF86Back']);
  function refuse(e, opts) {
    opts = opts || {};
    const old = document.getElementById('cws-unsupported');
    if (old) old.remove();
    const el = document.createElement('div');
    el.id = 'cws-unsupported';
    el.setAttribute('role', 'alertdialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'cws-unsupported-h');
    el.setAttribute('aria-describedby', 'cws-unsupported-m');
    el.dataset.list = e && e.list || '';
    el.dataset.code = e && e.code || '';
    el.dataset.sha = e && e.sha256 || '';
    el.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;' +
      'padding:16px;box-sizing:border-box;background:rgba(6,8,12,.72);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;';
    el.innerHTML =
      '<div style="max-width:440px;width:100%;box-sizing:border-box;padding:22px 22px 18px;border-radius:16px;' +
      'background:var(--panel,#161a21);color:var(--text,#e7ecf2);border:1px solid rgba(255,255,255,.14);box-shadow:0 20px 50px -20px rgba(0,0,0,.9);">' +
      '<h2 id="cws-unsupported-h" style="margin:0 0 8px;font-size:18px;font-weight:700;">Not supported yet</h2>' +
      '<p id="cws-unsupported-m" style="margin:0 0 6px;font-size:14.5px;line-height:1.5;">' + esc(message(e)) + '</p>' +
      (e && e.title ? '<p style="margin:0 0 16px;font-size:12.5px;color:var(--muted,#9aa4b2);">' + esc(e.title) + '</p>' : '<div style="height:10px"></div>') +
      '<div style="display:flex;justify-content:flex-end;"><button type="button" data-cws-unsupported-close ' +
      'style="font:inherit;font-size:14px;font-weight:600;padding:9px 20px;border-radius:999px;border:0;cursor:pointer;' +
      'background:var(--accent,#9be15d);color:#0b0d10;">Close</button></div></div>';
    document.body.appendChild(el);
    const btn = el.querySelector('[data-cws-unsupported-close]');
    return new Promise(resolve => {
      let done = false;
      const close = () => {
        if (done) return; done = true;
        window.removeEventListener('keydown', onKey, true);
        el.remove();
        try { if (opts.onClose) opts.onClose(); } catch (err) {}
        if (opts.closeHost !== false && window.parent && window.parent !== window) {
          try { window.parent.postMessage({ cwsUnsupportedClose: true }, '*'); } catch (err) {}
        }
        resolve();
      };
      const onKey = ev => {
        if (BACKS.has(ev.key) || ev.keyCode === 10009 || ev.keyCode === 461 || ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault(); ev.stopImmediatePropagation(); close();
        } else if (ev.key === 'Tab') { ev.preventDefault(); btn.focus(); }
        else { ev.stopImmediatePropagation(); }   // a refused game takes no keys
      };
      window.addEventListener('keydown', onKey, true);
      btn.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); close(); });
      el.addEventListener('click', ev => { if (ev.target === el) close(); });
      setTimeout(() => { try { btn.focus({ preventScroll: true }); } catch (err) {} }, 0);
      window.__cwsLastRefusal = { list: e && e.list, sha256: e && e.sha256, code: e && e.code, message: message(e), at: Date.now() };
    });
  }

  window.CWSUnsupported = {
    ready, get isReady() { return isReady; },
    lookup, forId, forDevice, check, shaOf, message, refuse,
  };
})();

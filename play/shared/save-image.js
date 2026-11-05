/*
 * play/shared/save-image.js -- save a picture to the phone's photo library (2026-10-11).
 *
 * There is no web API that writes into a photo library. The supported route is
 * the Web Share API with a file: on an iPhone the share sheet offers "Save
 * Image" (into Photos), on Android it offers Photos, Gallery or Files. So on a
 * phone or tablet we hand the picture to the share sheet, and everywhere else
 * (desktop, TV, plain HTTP) we keep the ordinary file download.
 *
 * (Revised 2026-10-11: iOS/iPadOS only; Android downloads. See isAndroid() below.)
 *
 * WHO GETS THE SHARE SHEET. iOS/iPadOS, and a touch screen by capability, the site's Game Boy
 * rule: `(pointer: coarse)` AND `navigator.maxTouchPoints > 0`. The media query
 * alone is not enough: a desktop Chrome can read as a TV (coarse pointer, no
 * hover) and has navigator.share on Windows, so it would get a Windows share
 * dialog instead of a download. Screen size is NOT used for the same reason (a
 * narrow desktop window is not a phone). Anything the site classifies as a TV
 * (GNW_TV.isTV in this window or the host page, or the gnw-tv class) keeps the
 * download. navigator.share only exists in a secure context, so HTTP 8080
 * falls back to the download by itself.
 *
 * THE TAP. navigator.share() needs transient user activation. Chrome keeps it
 * for about 5 s after the tap; Safari's window is much shorter. Callers build
 * the PNG synchronously (toDataURL, then toBlob() below, no fetch) so the
 * share call normally lands inside the tap. If the activation has expired
 * anyway (userActivation says so, or share() rejects with NotAllowedError) we
 * return { how: 'gesture', retry } and the caller offers a button; a press on
 * it is a fresh tap and retry() opens the sheet straight away.
 *
 * Cancelling the sheet (AbortError) is quiet: { how: 'cancelled' }.
 *
 * API: window.CwSaveImage
 *   wantsShare()                  true when this device should get the share sheet
 *   toBlob(dataUrl)               synchronous data: URL -> Blob
 *   save(blob, name, { title })   Promise<{ how: 'shared'|'cancelled'|'downloaded'|'gesture', retry? }>
 *   download(blob, name)          the plain download
 */
(function () {
  'use strict';
  if (window.CwSaveImage) return;

  function isTV() {
    const wins = [window];
    try { if (window.parent && window.parent !== window) wins.push(window.parent); } catch (_) {}
    try { if (window.top && wins.indexOf(window.top) < 0) wins.push(window.top); } catch (_) {}
    for (const w of wins) {
      try {
        if (w.GNW_TV && w.GNW_TV.isTV) return true;
        if (w.document.body && w.document.body.classList.contains('gnw-tv')) return true;
      } catch (_) { /* another origin */ }
    }
    return false;
  }
  function touchScreen() {
    let coarse = false, touch = false;
    try { coarse = matchMedia('(pointer: coarse)').matches; } catch (_) {}
    try { touch = (navigator.maxTouchPoints || 0) > 0; } catch (_) {}
    return coarse && touch;
  }
  /* 2026-10-11, a Galaxy Z Fold 5 (Chrome): the Android share sheet offers
     apps, contacts and "Copy image", with no Save or Gallery, so it cannot reach
     Photos. A plain download already shows in Gallery (Download album) on Samsung
     and most Android phones, so Android downloads. Only iOS/iPadOS gets the sheet,
     where "Save Image" goes to Photos (Safari and iOS Chrome; an iPad reports as
     a Mac, so a Mac UA with a touch screen counts). */
  function isAndroid() { return /Android/i.test(navigator.userAgent || ''); }
  function isIOS() {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/.test(ua)) return true;
    return /Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1;
  }
  function wantsShare() {
    return !!(window.isSecureContext && navigator.share && navigator.canShare) && isIOS() && !isAndroid() && touchScreen() && !isTV();
  }
  /* The Android download names where the file went. The bar's own toast says only
     "Screenshot saved", so this file shows the toast itself (how: 'downloaded-gallery',
     which the bar does not toast over). */
  function androidToast() {
    try { if (window.ControlBar && ControlBar.toast) ControlBar.toast('Screenshot saved to Downloads (shows in Gallery)'); } catch (_) {}
  }

  function toBlob(dataUrl) {
    const i = dataUrl.indexOf(',');
    const head = dataUrl.slice(0, i), body = dataUrl.slice(i + 1);
    const type = (head.match(/^data:([^;,]+)/) || [])[1] || 'application/octet-stream';
    if (!/;base64$/.test(head)) return new Blob([decodeURIComponent(body)], { type });
    const bin = atob(body), n = bin.length, u = new Uint8Array(n);
    for (let k = 0; k < n; k++) u[k] = bin.charCodeAt(k);
    return new Blob([u], { type });
  }

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  function share(file, title, blob, name) {
    const data = { files: [file] };
    if (title) data.title = title;          // no `text`: it hides "Save Image" on some iOS versions
    return navigator.share(data).then(
      () => ({ how: 'shared' }),
      e => {
        if (e && e.name === 'AbortError') return { how: 'cancelled' };
        if (e && e.name === 'NotAllowedError') return { how: 'gesture', retry: () => share(file, title, blob, name) };
        download(blob, name);
        return { how: 'downloaded' };
      });
  }

  function save(blob, name, opts) {
    const title = (opts && opts.title) || '';
    if (wantsShare()) {
      let file = null;
      try { file = new File([blob], name, { type: blob.type || 'image/png' }); } catch (_) {}
      let ok = false;
      try { ok = !!file && navigator.canShare({ files: [file] }); } catch (_) {}
      if (ok) {
        const ua = navigator.userActivation;
        if (ua && ua.isActive === false) return Promise.resolve({ how: 'gesture', retry: () => share(file, title, blob, name) });
        return share(file, title, blob, name);
      }
    }
    download(blob, name);
    if (isAndroid()) { androidToast(); return Promise.resolve({ how: 'downloaded-gallery' }); }
    return Promise.resolve({ how: 'downloaded' });
  }

  window.CwSaveImage = { wantsShare, toBlob, save, download };
})();

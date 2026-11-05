/*
 * install-app.js -- "Add Crystal Worlds to your home screen" in Settings (2026-10-17).
 *
 * WHY. The request: "Can we place a button in settings somewhere that installs the page as an
 * icon on the phone. This option should be only shown on phones. I see the installation
 * pop-up sometimes but I don't know what triggers it."
 *
 * WHAT TRIGGERS THE BROWSER'S OWN POP-UP. Chrome on Android offers to install a site
 * (the mini bar or the "Install app" prompt) only when the site is installable (served
 * over HTTPS, a manifest with a name, 192 and 512 px icons, a start_url and a standalone
 * display mode, not already installed) AND its engagement rules are met: the visitor
 * has tapped the page at least once and spent about 30 seconds on it. After the prompt
 * is dismissed, Chrome waits (months) before showing it again. That is why it appears
 * "sometimes". Chrome hands the same prompt to the page as a `beforeinstallprompt`
 * event; this file keeps it and fires it from the Settings button instead.
 *
 * WHERE IT SHOWS. Only on a phone or tablet operating system (the same test as
 * index.html's _playLockWanted, without its width and height rules, so a narrow desktop
 * window or a desktop Chrome that reads as a TV never sees it), and only when
 * the page is not already running as an installed app. Then:
 *   - Chrome / Edge / Samsung Internet on Android: an "Add to home screen" button,
 *     shown once the browser has said the site can be installed;
 *   - Safari on iPhone and iPad (no install event exists there): the Share, then
 *     "Add to Home Screen" steps instead of a button;
 *   - any other phone browser: the same section with the browser-menu instructions.
 * It goes at the top of the "Look and feel" page of Settings. Sound: none.
 */
(function () {
  'use strict';
  if (window.GnwInstallApp) return;

  let deferred = null;     // the kept beforeinstallprompt event
  let installed = false;

  function isPhoneOs() {
    try {
      const ua = navigator.userAgent || '', uad = navigator.userAgentData, touch = (navigator.maxTouchPoints || 0) > 0;
      if (/Tizen|SMART-TV|Web0S|SmartTV|CrKey|AFT/i.test(ua)) return false;   // televisions are not phones
      if (uad && (uad.mobile || /Android|iOS/i.test(uad.platform || ''))) return true;
      if (/Android|iPhone|iPad|iPod/i.test(ua)) return true;
      if (touch && /Macintosh/.test(ua)) return true;              // iPadOS asks for the desktop site
      return touch && /X11; Linux/.test(ua);                       // a big Android screen asking for desktop sites
    } catch (_) { return false; }
  }
  function isIos() {
    const ua = navigator.userAgent || '';
    return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
  }
  function isStandalone() {
    try {
      if (window.matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)').matches) return true;
    } catch (_) {}
    return navigator.standalone === true;   // Safari's own flag
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();      // keep it for the Settings button; the browser may still show its own bar
    deferred = e;
    render();
  });
  window.addEventListener('appinstalled', function () { installed = true; deferred = null; render(); });

  const ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M12 7v7M9 11l3 3 3-3"/></svg>';
  const SHARE = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Share" style="vertical-align:-2px"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v8h14v-8"/></svg>';
  const P = 'color:var(--muted); font-size:12.5px; margin:0 0 12px; line-height:1.55;';
  const B = 'color:var(--text); font-weight:700;';

  function body() {
    if (installed) return '<p style="' + P + '">Added. Open Crystal Worlds from its icon on your home screen.</p>';
    if (deferred) {
      return '<p style="' + P + '">Put a <strong style="' + B + '">Crystal Worlds</strong> icon on your home screen. It opens full screen, without the address bar, like an app.</p>' +
        '<button type="button" id="gnw-install-btn" style="display:inline-flex; gap:8px; align-items:center; background:var(--accent); color:var(--on-accent,#0a0e14); border:0; padding:10px 16px; border-radius:9px; font-weight:700; cursor:pointer; font-size:13px;">' + ICON + 'Add to home screen</button>';
    }
    if (isIos()) {
      return '<p style="' + P + '">Put a <strong style="' + B + '">Crystal Worlds</strong> icon on your home screen: tap ' + SHARE +
        ' <strong style="' + B + '">Share</strong>, then <strong style="' + B + '">Add to Home Screen</strong>, then <strong style="' + B + '">Add</strong>. It opens full screen, like an app.</p>';
    }
    return '<p style="' + P + '">Put a <strong style="' + B + '">Crystal Worlds</strong> icon on your home screen: open the browser menu (&#8942;) and choose <strong style="' + B + '">Add to home screen</strong> or <strong style="' + B + '">Install app</strong>. A button appears here as well once the browser is ready to add it.</p>';
  }

  function render() {
    const host = document.querySelector('#vault-overlay .settings-panel[data-panel="appearance"]');
    let sec = document.getElementById('gnw-install-section');
    const want = !!host && isPhoneOs() && (!isStandalone() || installed);
    if (!want) { if (sec) sec.remove(); return; }
    if (!sec) {
      sec = document.createElement('section');
      sec.className = 'vault-section';
      sec.id = 'gnw-install-section';
      /* A STOP FOR THE D-PAD (4 Nov: "the Home Screen note at the bottom of Configurations must be
         reachable with the D-pad, so it is seen"). Without a button in it (most phones, until the
         browser is ready) it held nothing to move to, so Down stopped at the last setting above it
         and the note stayed below the screen. It is a stop of its own now: Down moves onto it and
         the window scrolls it into view. Its name is its heading. */
      sec.tabIndex = 0;
      sec.setAttribute('aria-labelledby', 'gnw-install-h');
      host.insertBefore(sec, host.firstChild);
    }
    sec.innerHTML = '<label id="gnw-install-h" style="display:block; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--muted); margin-bottom:6px;">Home screen</label>' + body();
    const btn = document.getElementById('gnw-install-btn');
    if (btn) btn.addEventListener('click', function () {
      const ev = deferred;
      if (!ev) return;
      deferred = null;       // a prompt can be used once
      ev.prompt();
      Promise.resolve(ev.userChoice).then(function (c) {
        if (c && c.outcome === 'accepted') installed = true;
        render();
      }, render);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
  window.GnwInstallApp = { render: render, state: function () { return { phone: isPhoneOs(), ios: isIos(), standalone: isStandalone(), canPrompt: !!deferred, installed: installed }; } };
})();

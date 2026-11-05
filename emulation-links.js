/* ===========================================================================
 * In-page links on the drawer tabs (the Emulation tabs above all).
 *
 * The site routes on the URL hash ("#/device/<id>", "#/play/<key>"), so a plain
 * table-of-contents link such as <a href="#gbe-score"> changed the route: the
 * router read "gbe-score" as a page it did not know and showed the home page,
 * closing the drawer. This catches every same-page link ("#name", never
 * "#/route") before the browser follows it, and instead scrolls the target
 * into view inside the tab that is open. The route, the open drawer and the
 * open tab are left exactly as they were.
 *
 *   - the target is looked up in the same tab first, then the same drawer,
 *     then the page;
 *   - a target inside a closed <details> is opened; a target on another tab of
 *     the same drawer switches to that tab first;
 *   - the target takes focus (without a second scroll), so a TV remote or a
 *     keyboard continues from where the link went.
 * A link whose target does not exist does nothing, rather than navigating.
 *
 * Loaded by a plain <script src> tag (the site must also open over file://).
 * Reported 2026-10-10: "21. The score, and what a score is worth" went to
 * the home page with no content.
 * =========================================================================== */
(function () {
  'use strict';

  function byId(scope, id) {
    if (!scope || !scope.querySelector) return null;
    try { return scope.querySelector('#' + (window.CSS && CSS.escape ? CSS.escape(id) : id)); }
    catch (e) { return null; }
  }

  function findTarget(link, id) {
    return byId(link.closest('.drawer-tab-content'), id) ||
           byId(link.closest('#device-modal'), id) ||
           document.getElementById(id);
  }

  function reveal(target) {
    for (var p = target.parentElement; p; p = p.parentElement) {
      if (p.tagName === 'DETAILS' && !p.open) p.open = true;
    }
    var pane = target.closest('.drawer-tab-content');
    if (pane && !pane.classList.contains('active')) {
      var modal = pane.closest('#device-modal');
      var name = pane.getAttribute('data-tab-content');
      var btn = modal && name && modal.querySelector('.drawer-tab[data-tab="' + name + '"]');
      if (btn) btn.click();
    }
  }

  function goTo(target) {
    reveal(target);
    target.scrollIntoView({ block: 'start', inline: 'nearest' });
    // the drawer's header stays pinned over its scrolling body: move the
    // target down out from under it (and a little clear of it)
    var modal = target.closest('#device-modal');
    // (2026-10-17: the unified drawer has no title bar; its sticky top is the tab row)
    var head = modal && (modal.querySelector('.modal-head') || modal.querySelector('.drawer-tabs.ud-tabs'));
    if (head) {
      var cover = head.getBoundingClientRect().bottom + 8 - target.getBoundingClientRect().top;
      if (cover > 0) {
        for (var s = target.parentElement; s; s = s.parentElement) {
          var oy = getComputedStyle(s).overflowY;
          if ((oy === 'auto' || oy === 'scroll') && s.scrollHeight > s.clientHeight) { s.scrollTop -= cover; break; }
        }
      }
    }
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    try { target.focus({ preventScroll: true }); } catch (e) { /* older browsers */ }
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var link = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!link) return;
    var href = link.getAttribute('href');
    if (!href || href.length < 2 || href.charAt(1) === '/') return;   // "#/..." is a route
    var id;
    try { id = decodeURIComponent(href.slice(1)); } catch (err) { id = href.slice(1); }
    e.preventDefault();   // an in-page anchor never changes the route
    var target = findTarget(link, id);
    if (target) goTo(target);
  }, true);

  window.emulationGoToAnchor = function (id, from) {
    var t = from ? findTarget(from, id) : document.getElementById(id);
    if (t) goTo(t);
    return !!t;
  };
})();

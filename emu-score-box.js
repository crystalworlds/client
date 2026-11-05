/* ===========================================================================
 * The score box on every Emulation page (the Emulation window and a game
 * drawer's Emulation tab): ".gbemu-hero-num" beside the opening text.
 *
 * 3 Nov 2026: "It needs to load 2 of its sizes down and scroll with the page.
 * That is all. It shouldn't stay on the screen when scrolling and all other
 * systems should be the same." So the box's top sits two of its own heights
 * below the top of its section (the space above it is its height times two),
 * and it scrolls with the page like the text beside it. A section too short
 * for that (4 Nov 2026) has the box centred beside its text, so it never sits
 * hard at the bottom. On a phone the box stands above the heading
 * (the section is a column there) and gets no offset.
 *
 * CSS cannot name an element's own height in a margin, so the margin is set
 * here: once a box has a size (an Emulation tab that is not shown has none),
 * again when its section changes width (the text wraps differently), and
 * nothing else. Silent; reads only the page it is in. Plain script tag.
 * =========================================================================== */
(function () {
  'use strict';
  if (window.__cwScoreBox) return;
  window.__cwScoreBox = true;

  function place(box) {
    var hero = box.parentElement;
    if (!hero || !box.isConnected) return;
    var h = box.offsetHeight;
    if (!h) return;                                     // not shown yet: placed when it gets a size
    var cs = getComputedStyle(hero);
    var want = 0;
    if (cs.flexDirection.indexOf('column') < 0) {
      var room = 0;                                     // the tallest thing beside it
      for (var i = 0; i < hero.children.length; i++) {
        var c = hero.children[i];
        if (c !== box) room = Math.max(room, c.offsetHeight);
      }
      /* 4 Nov 2026: a section too short for the two-heights gap with as much room again under
         the box (the Famicom, NES and Disk System pages had 3 px) gets the box in its middle,
         not hard at its bottom. */
      want = Math.max(0, Math.min(2 * h, (room - h) / 2));
    }
    var px = Math.round(want) + 'px';
    if (box.style.marginTop !== px) box.style.marginTop = px;
  }

  var ro = typeof ResizeObserver === 'function' ? new ResizeObserver(function (list) {
    for (var i = 0; i < list.length; i++) {
      var t = list[i].target;
      var box = t.classList.contains('gbemu-hero-num') ? t : t.querySelector(':scope > .gbemu-hero-num');
      if (box) place(box);
    }
  }) : null;

  function watch(root) {
    var boxes = root.querySelectorAll ? root.querySelectorAll('.gbemu-hero > .gbemu-hero-num') : [];
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      if (b.__cwPlaced) continue;
      b.__cwPlaced = true;
      if (ro) { ro.observe(b); ro.observe(b.parentElement); }
      place(b);
    }
  }

  function start() {
    watch(document);
    new MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) {
        var add = recs[i].addedNodes;
        for (var j = 0; j < add.length; j++) {
          var n = add[j];
          if (n.nodeType !== 1) continue;
          if (n.matches('.gbemu-hero-num, .gbemu-hero')) watch(n.parentElement || n);
          else if (n.getElementsByClassName('gbemu-hero-num').length) watch(n);   // only the nodes added, never the whole page
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
    if (!ro) addEventListener('resize', function () {
      var boxes = document.querySelectorAll('.gbemu-hero > .gbemu-hero-num');
      for (var i = 0; i < boxes.length; i++) place(boxes[i]);
    });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();

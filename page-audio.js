/* Home-page narration (2026-10-12).
 *
 * The home-page text is recorded; the MP3s live in the R2 bucket
 * "site-audio" and window.PAGE_AUDIO_TIMINGS (page-audio-timings.js, generated)
 * holds the page words and per-word [start, end] times in milliseconds.
 *
 * Markup hooks in index.html (attributes only, the text is untouched):
 *   data-narrate="<key>"       every paragraph the recording reads, in order
 *   data-narrate-host="<key>"  the section's heading; the controls go right after it
 *
 * Behaviour:
 *   - Nothing is fetched until the button is pressed (Audio is created then,
 *     preload "metadata"). No autoplay.
 *   - Idle: one Listen button. Playing or paused: Pause/Resume and Stop.
 *     Focus moves to Pause on Listen, and back to Listen on Stop or at the end.
 *   - One narration at a time; pausing keeps the position; Stop and the end
 *     clear the highlight and rewind, so the next Listen starts from the top.
 *   - Words are wrapped in spans the first time a narration plays. If the live
 *     words no longer match the timings (the text was edited), the audio still
 *     plays but nothing is highlighted, and a console warning says to
 *     regenerate the timings.
 *   - A marker inside the paragraph follows the current word, driven by
 *     requestAnimationFrame on audio.currentTime. Reduced motion: it jumps.
 *   - While playing, pressing a word seeks to it.
 *   - Each narration pauses when its own view (home, about) is left, or when
 *     another media element starts playing.
 */
(function () {
  'use strict';

  var TIMINGS = window.PAGE_AUDIO_TIMINGS || {};
  var ICON_PLAY = '<svg class="pa-ico-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2v13.6a.8.8 0 0 0 1.22.68l10.6-6.8a.8.8 0 0 0 0-1.36L9.22 4.52A.8.8 0 0 0 8 5.2z"/></svg>';
  var ICON_STOP = '<svg class="pa-ico-stop" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>';
  var ICON_PAUSE = '<svg class="pa-ico-pause" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4.2" height="14" rx="1"/><rect x="13.8" y="5" width="4.2" height="14" rx="1"/></svg>';

  var items = {};
  var current = null;
  var rafId = 0;

  function warn(msg) { try { console.warn('[page-audio] ' + msg); } catch (e) {} }

  // Same tokenisation as the generator: every text node, split on whitespace.
  function wrapWords(els) {
    var spans = [];
    els.forEach(function (el) {
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
      var nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(function (node) {
        var text = node.nodeValue;
        if (!/\S/.test(text)) return;
        var frag = document.createDocumentFragment();
        text.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          var s = document.createElement('span');
          s.className = 'pa-w';
          s.textContent = part;
          s._paPara = el;
          spans.push(s);
          frag.appendChild(s);
        });
        node.parentNode.replaceChild(frag, node);
      });
    });
    return spans;
  }

  function prepare(it) {
    if (it.prepared) return;
    it.prepared = true;
    it.spans = wrapWords(it.paras);
    var live = it.spans.map(function (s) { return s.textContent; }).join(' ');
    var t = it.data.t || [];
    it.ok = live === it.data.words && t.length === it.spans.length * 2;
    if (!it.ok) {
      warn(it.key + ': page text no longer matches the timings (' + it.spans.length +
           ' live words); audio plays without highlighting. Regenerate page-audio-timings.js.');
      return;
    }
    it.starts = [];
    for (var i = 0; i < it.spans.length; i++) {
      it.starts.push(t[2 * i] / 1000);
      it.spans[i]._paIndex = i;
    }
    it.lastEnd = t[t.length - 1] / 1000;
    // A token with no letters or digits (a comma after </b>, a dash) is never a marker target.
    it.show = [];
    for (var j = 0; j < it.spans.length; j++) {
      it.show.push(/[\p{L}\p{N}]/u.test(it.spans[j].textContent) ? j : (j ? it.show[j - 1] : -1));
    }
    it.paras.forEach(function (p) {
      var m = document.createElement('span');
      m.className = 'pa-marker';
      m.setAttribute('aria-hidden', 'true');
      p.insertBefore(m, p.firstChild);
      p._paMarker = m;
      p.addEventListener('click', function (ev) {
        var w = ev.target && ev.target.closest ? ev.target.closest('.pa-w') : null;
        if (!w || current !== it || !it.audio || it.audio.paused) return;
        if (typeof w._paIndex !== 'number') return;
        it.audio.currentTime = it.starts[w._paIndex] + 0.01;
        it.idx = -2; // force a redraw
      });
    });
  }

  function ensureAudio(it) {
    if (it.audio) return it.audio;
    var a = new Audio();
    a.preload = 'metadata';
    a.src = it.data.audio;
    a._paOwn = true;
    a.addEventListener('play', function () { it.state = 'playing'; render(it); startLoop(); });
    // Paused from anywhere (Pause, another narration, leaving the home view): keep the position.
    a.addEventListener('pause', function () { if (it.state === 'playing') { it.state = 'paused'; render(it); } });
    a.addEventListener('ended', function () { stop(it); });
    a.addEventListener('error', function () {
      it.failed = true;
      it.state = 'idle';
      render(it);
      warn(it.key + ': audio failed to load (' + it.data.audio + ')');
    });
    it.audio = a;
    return a;
  }

  // One state per narration: idle (Listen shown), playing or paused (Pause/Resume + Stop shown).
  function render(it) {
    var idle = it.state === 'idle', playing = it.state === 'playing';
    var hadFocus = it.ctl.contains(document.activeElement);
    it.listen.hidden = !idle;
    it.pause.hidden = idle;
    it.stop.hidden = idle;
    it.listen.classList.toggle('is-error', !!it.failed);
    it.pause.querySelector('.pa-btn-t').textContent = playing ? 'Pause' : 'Resume';
    it.pause.setAttribute('aria-label', playing ? 'Pause' : 'Resume');
    it.ctl.setAttribute('data-state', it.state);
    it.ctl.setAttribute('aria-label', idle ? 'Narration' : playing ? 'Narration, playing' : 'Narration, paused');
    it.paras.forEach(function (p) { p.classList.toggle('is-current', playing); });
    // Never strand keyboard focus on a button that has just been hidden.
    if (hadFocus && (document.activeElement === document.body || (document.activeElement && document.activeElement.hidden))) {
      (idle ? it.listen : it.pause).focus();
    }
  }

  function stop(it) {
    if (it.audio) {
      if (!it.audio.paused) { it.state = 'idle'; it.audio.pause(); }
      try { it.audio.currentTime = 0; } catch (e) {}
    }
    clearHighlight(it);
    it.state = 'idle';
    render(it);
  }

  function clearHighlight(it) {
    it.idx = -1;
    if (it.activeSpan) it.activeSpan.classList.remove('is-word');
    it.activeSpan = null;
    it.paras.forEach(function (p) {
      if (p._paMarker) { p._paMarker.classList.remove('is-on'); p._paMarker._paTop = null; }
    });
  }

  function indexAt(it, t) {
    var s = it.starts;
    if (!s.length || t < s[0] || t > it.lastEnd + 0.6) return -1;
    var lo = 0, hi = s.length - 1;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (s[mid] <= t) lo = mid; else hi = mid - 1;
    }
    return lo;
  }

  function placeMarker(it, span) {
    var p = span._paPara, m = p._paMarker;
    if (!m) return;
    var rects = span.getClientRects();
    if (!rects.length) return;
    var r = rects[0], pr = p.getBoundingClientRect();
    var padX = 3, padY = 1;
    var x = r.left - pr.left - p.clientLeft - padX;
    var y = r.top - pr.top - p.clientTop - padY;
    var w = r.width + padX * 2, h = r.height + padY * 2;
    var key = Math.round(x) + ',' + Math.round(y) + ',' + Math.round(w) + ',' + Math.round(h);
    if (m._paKey === key && m.classList.contains('is-on')) return;
    // A new line, or a new paragraph: jump rather than sweep diagonally.
    var snap = m._paTop == null || Math.abs(m._paTop - y) > 2;
    if (snap) m.classList.add('pa-snap');
    m.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
    m.style.width = w.toFixed(1) + 'px';
    m.style.height = h.toFixed(1) + 'px';
    m._paKey = key; m._paTop = y;
    if (snap) { void m.offsetWidth; m.classList.remove('pa-snap'); }
    m.classList.add('is-on');
    it.paras.forEach(function (q) {
      if (q !== p && q._paMarker) { q._paMarker.classList.remove('is-on'); q._paMarker._paTop = null; }
    });
  }

  // Each narration belongs to the view (.view section) its heading is in: home,
  // about, ... It pauses when that view is left, and only that one.
  function viewVisible(it) {
    var v = it.view;
    return !v || (v.isConnected && getComputedStyle(v).display !== 'none');
  }

  function tick() {
    rafId = 0;
    var it = current;
    if (!it || !it.audio || it.audio.paused) return;
    if (!viewVisible(it)) { it.audio.pause(); return; }
    if (it.ok) {
      var i = indexAt(it, it.audio.currentTime);
      if (i >= 0) i = it.show[i]; // punctuation-only tokens hand the marker back to their word
      if (i < 0) {
        if (it.idx !== -1) clearHighlight(it);
      } else {
        var span = it.spans[i];
        if (i !== it.idx) {
          if (it.activeSpan) it.activeSpan.classList.remove('is-word');
          span.classList.add('is-word');
          it.activeSpan = span;
          it.idx = i;
        }
        placeMarker(it, span); // every frame, so a reflow or resize is followed
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  function startLoop() { if (!rafId) rafId = requestAnimationFrame(tick); }

  function start(it) {
    if (it.failed) return;
    prepare(it);
    var a = ensureAudio(it);
    if (current && current !== it) {
      if (current.audio && !current.audio.paused) current.audio.pause();
      clearHighlight(current); // its position is kept; the marker returns on resume
    }
    current = it;
    it.state = 'playing';
    render(it);
    var p = a.play();
    if (p && p.catch) p.catch(function (e) { warn(it.key + ': play() refused: ' + (e && e.name)); stop(it); it.listen.focus(); });
  }

  function makeButton(cls, label, icons) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pa-btn ' + cls;
    b.setAttribute('aria-label', label);
    b.innerHTML = icons + '<span class="pa-btn-t">' + label + '</span>';
    return b;
  }

  function makeControls(it) {
    var ctl = document.createElement('div');
    ctl.className = 'pa-ctl';
    ctl.setAttribute('role', 'group');
    it.ctl = ctl;
    it.listen = makeButton('pa-listen', 'Listen', ICON_PLAY);
    it.pause = makeButton('pa-pause', 'Pause', ICON_PLAY + ICON_PAUSE);
    it.stop = makeButton('pa-stop', 'Stop', ICON_STOP);
    it.listen.addEventListener('click', function () { start(it); it.pause.focus(); });
    it.pause.addEventListener('click', function () {
      if (it.state === 'playing') it.audio.pause();
      else start(it);
    });
    it.stop.addEventListener('click', function () { stop(it); it.listen.focus(); });
    ctl.appendChild(it.listen); ctl.appendChild(it.pause); ctl.appendChild(it.stop);
    it.state = 'idle';
    render(it);
    return ctl;
  }

  function init() {
    Object.keys(TIMINGS).forEach(function (key) {
      var data = TIMINGS[key];
      var paras = Array.prototype.slice.call(document.querySelectorAll('[data-narrate="' + key + '"]'));
      var host = document.querySelector('[data-narrate-host="' + key + '"]');
      if (!paras.length || !host || !data || !data.audio) return;
      var it = { key: key, data: data, paras: paras, host: host, idx: -1, view: host.closest('.view') };
      paras.forEach(function (p) { p.classList.add('pa-p'); });
      // The controls sit directly after the section's heading (the host).
      host.insertAdjacentElement('afterend', makeControls(it));
      items[key] = it;
    });
    // Another player starting (media player, previews) stops the narration.
    document.addEventListener('play', function (ev) {
      var t = ev.target;
      if (!t || t._paOwn) return;
      if (current && current.audio && !current.audio.paused) current.audio.pause();
    }, true);
  }

  /* A COPY ELSEWHERE ON THE PAGE (2026-10-19): the Media page's About window
     copies the About section in after init() has run. attach() gives a copy
     its own controls and its own item (its own audio and highlight), belonging
     to `view` (it pauses when that is hidden, like leaving a page). Copies whose
     heading has left the page are dropped first. */
  var attachN = 0;
  function attach(root, view) {
    if (!root || !root.querySelectorAll) return 0;
    Object.keys(items).forEach(function (id) {
      if (id.indexOf('@') > 0 && !items[id].host.isConnected) {
        if (items[id] === current && items[id].audio) items[id].audio.pause();
        delete items[id];
      }
    });
    var n = 0;
    Array.prototype.forEach.call(root.querySelectorAll('[data-narrate-host]'), function (host) {
      var key = host.getAttribute('data-narrate-host'), data = TIMINGS[key];
      var paras = Array.prototype.slice.call(root.querySelectorAll('[data-narrate="' + key + '"]'));
      if (!paras.length || !data || !data.audio) return;
      var old = host.nextElementSibling;
      if (old && old.classList.contains('pa-ctl')) old.parentNode.removeChild(old);
      var it = { key: key, data: data, paras: paras, host: host, idx: -1, view: view || root };
      paras.forEach(function (p) { p.classList.add('pa-p'); });
      host.insertAdjacentElement('afterend', makeControls(it));
      items[key + '@' + (++attachN)] = it;
      n++;
    });
    return n;
  }

  window.pageAudio = { items: items, current: function () { return current; }, attach: attach };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

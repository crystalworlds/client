/*
 * rob-shelf.js -- R.O.B. on the Media page (2026-10-21; the R.O.B. rebuild plan
 * section 9 and 9a).
 *
 *   THE SYSTEMS MENU. Since 22 Oct R.O.B. is a system of the menu like any other
 *   (emby.js ROB_SYSTEM and VG_MENU, picture images/consoles/rob.webp): his games are the NES and
 *   Famicom games isRobGame() names, plus R.O.B. Play Time. This file no longer draws or handles it.
 *
 *   R.O.B. PLAY TIME. A built-in title of the R.O.B. system, as Tetris Jr. is of Game & Watch
 *   (25 Oct: emby.js ROB_SYSTEM's pool holds it, so it is on the wall, in the counts
 *   and in a search like any title, with or without game files): an NES-style box made from a render of
 *   R.O.B. (images/rob-playtime-box.webp, our own picture, plain type). It opens the Play Time
 *   window: play/rob/index.html?ui=pill, R.O.B. with the rob-test page's controls in a control
 *   centre styled as the site's Control Bar. A controller's presses, which the site makes into keys
 *   at the window, are passed on into the page. Back, Escape or the x closes it.
 *
 *   window.CwRob: isRobGame(d), playTimePick(), cardHTML(), playTime(), select().
 */
(function () {
  'use strict';
  const V = '2.0.0-q5a';   // picture tag (PIC, BOX, HERO)
  const PIC = 'images/consoles/rob.webp?v=' + V;
  const BOX = 'images/rob-playtime-box.webp?v=' + V;
  const HERO = 'images/rob-hero.webp?v=' + V;   // a large render for his drawer (from play/rob/index.html)
  /* His four games, by the catalogue's tidied name: Gyromite and Stack-Up (NES), Robot Gyro and
     Robot Block (Famicom). Cartridges only (the Disk System has none). */
  const ROB_RE = /^(gyromite|robot gyro|stack[ -]?up|robot block)\b/i;
  const isRobGame = d => !!d && d.catalogue === 'nes' && (d.nesConsole || 'nes') !== 'fds' && ROB_RE.test(String(d.name || ''));
  const PT = { id: 'rob-playtime', name: 'R.O.B. Play Time', robPlayTime: true, catalogue: 'rob', series: 'nes', released: '', features: [], regions: [] };

  function css() {
    if (document.getElementById('rob-shelf-css')) return;
    const s = document.createElement('style'); s.id = 'rob-shelf-css';
    s.textContent = `
#rob-play-overlay{padding:0;overflow:hidden}
#rob-play-overlay .modal{max-width:100%;width:100%;height:100vh;height:100svh;margin:0;border:0;border-radius:0;display:flex;flex-direction:column}
#rob-play-overlay .modal-head{flex:0 0 auto;padding-top:8px;padding-bottom:8px}
#rob-play-overlay iframe{flex:1 1 auto;min-height:0;width:100%;border:0;display:block;background:#1b1e22}
#rob-play-overlay .modal-head{gap:8px}
#rob-play-overlay .modal-head > div:first-child{flex:1 1 auto;min-width:0}
#rob-play-overlay .rob-tools{display:flex;gap:6px;flex:none}
#rob-play-overlay .rob-tool{appearance:none;background:rgba(255,255,255,.05);border:1px solid var(--line);color:var(--text);width:36px;height:36px;border-radius:10px;cursor:pointer;padding:0;
  display:inline-flex;align-items:center;justify-content:center;transition:background .15s}
#rob-play-overlay .rob-tool:hover,#rob-play-overlay .rob-tool:focus-visible{background:rgba(255,255,255,.10)}
#rob-play-overlay .rob-tool svg{display:block;width:18px;height:18px}
#rob-play-overlay .rob-tool[aria-pressed=true]{background:rgba(var(--accent-rgb,155,225,93),.20);border-color:var(--accent)}
#rob-play-overlay .rob-tool[data-t=led].lit{color:#ff3b2f;border-color:#ff3b2f;background:rgba(255,59,47,.14)}
#rob-play-overlay .rob-tool[data-t=led].lit svg circle{fill:#ff3b2f}
@media (max-width:420px){#rob-play-overlay .modal-sub{display:none}#rob-play-overlay .modal-title{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#rob-play-overlay .modal-head{padding-left:12px;padding-right:12px}#rob-play-overlay .rob-tools{gap:4px}#rob-play-overlay .rob-tool{width:34px;height:34px}}
@media (max-width:360px){#rob-play-overlay .modal-head{gap:5px;padding-left:10px;padding-right:10px}#rob-play-overlay .rob-tools{gap:3px}#rob-play-overlay .rob-tool,#rob-play-overlay .modal-close{width:31px;height:31px}#rob-play-overlay .modal-title{font-size:14px}}
.device-card[data-id="rob-playtime"] .img::after{background-size:contain}
.device-card[data-id="rob-playtime"] .img video.rob-clip{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;opacity:0;transition:opacity .3s ease;pointer-events:none}
.device-card[data-id="rob-playtime"] .img.rob-clip-on video.rob-clip{opacity:1}`;
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------ the Systems menu */
  /* R.O.B. IS A SYSTEM OF THE MENU NOW (22 Oct; emby.js ROB_SYSTEM and VG_MENU). This file
     used to draw his tile into the menu, store 'rob' as a series over the NES and Famicom shelves and
     catch his clicks itself, so none of the other buttons' behaviour reached him (Ctrl +
     Famicom after R.O.B. selected NES). That code is gone; what is left
     here arms Play Time's clip as its tile appears. */
  let sweepQueued = false;
  const sweep = () => { if (sweepQueued) return; sweepQueued = true;
    setTimeout(() => { sweepQueued = false;
      document.querySelectorAll('.device-card[data-id="rob-playtime"] video.rob-clip:not([data-armed])').forEach(armClip); }, 50); };
  new MutationObserver(() => sweep()).observe(document.documentElement, { childList: true, subtree: true });

  /* His drawer's R.O.B. pill: the wall picks the R.O.B. system, through the same route as every
     system pill (index.html routeToMediaSystems; 25 Oct; was selectGameSeries('rob')). */
  function select() {
    try {
      if (typeof routeToMediaSystems === 'function') routeToMediaSystems(['rob']);
      else if (window.Emby && window.Emby.selectGameSystems) window.Emby.selectGameSystems(['rob']);
    } catch (e) { console.warn('[R.O.B.] pick failed:', e); }
  }

  /* ------------------------------------------------------------ R.O.B. Play Time's tile */
  /* THE TILE'S CLIP (22 Oct): in the Hardware view the tile plays one full slow
     turn of R.O.B. (rob-playtime.webm in the NES clips bucket, made by play/rob/index.html?clip=1),
     silent, looping, filling the tile; the box art is for the Box Art views only. The same manners
     as the other tile clips (nesvideo.js): none on a TV or a low-power box, started only near the
     screen, paused while a play window is in front, and a missing clip (404) falls back to the box. */
  const CLIP = () => { let b = null; try { b = window.NESVIDEO && NESVIDEO.stats().base; } catch (_) {}
    return (b || 'https://pub-476344a7e9a34219a007a6563f3a74d3.r2.dev/') + 'rob-playtime.webm'; };
  const clipSuppressed = () => { try { return !!(window.GNW_TV && (window.GNW_TV.isTV || window.GNW_TV.lowPower)); } catch (_) { return false; } };
  const artMode = () => { try { return (window.Emby && window.Emby.artMode && window.Emby.artMode()) || 'hardware'; } catch (_) { return 'hardware'; } };
  const clipMissing = { v: false };    // this page load only; a clip uploaded later is asked for again next load
  let clipIO = null;
  function armClip(v) {
    if (v.dataset.armed) return; v.dataset.armed = '1';
    const box = v.parentElement;
    const fallback = () => { clipMissing.v = true; try { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); } catch (_) {}
      if (box) { box.style.setProperty('--hero', "url('" + BOX + "')"); box.setAttribute('data-hero-src', BOX); box.classList.remove('rob-clip-on'); } };
    v.addEventListener('error', fallback);
    v.addEventListener('loadeddata', () => { if (box) box.classList.add('rob-clip-on'); });
    v.addEventListener('volumechange', () => { if (!v.muted) v.muted = true; });
    const held = () => { try { return typeof window.gnwForegroundActive === 'function' && window.gnwForegroundActive(); } catch (_) { return false; } };
    const play = () => { if (held() || !v.isConnected) return; v.muted = true; if (!v.getAttribute('src')) v.src = CLIP(); try { const p = v.play(); if (p && p.catch) p.catch(() => {}); } catch (_) {} };
    v._robPlay = play;
    if (!clipIO) clipIO = new IntersectionObserver(es => es.forEach(en => { const t = en.target; if (en.isIntersecting) t._robPlay && t._robPlay(); else try { t.pause(); } catch (_) {} }), { rootMargin: '300px 0px' });
    clipIO.observe(v);
  }
  document.addEventListener('gnw:foreground', e => {
    document.querySelectorAll('.device-card[data-id="rob-playtime"] video.rob-clip').forEach(v => {
      if (e.detail && e.detail.active) { if (!v.paused) { v._fgHeld = 1; try { v.pause(); } catch (_) {} } }
      else if (v._fgHeld) { v._fgHeld = 0; v._robPlay && v._robPlay(); }
    });
  });

  function cardHTML() {
    css();
    /* Its own box in the Box Art views, the clip in the Hardware view. data-gbart / data-gmart are
       set from the start so the wall's cover painters (emby.js mountGbBoxArt, gamemeta.js) pass it
       by: in Box Art they took it for an NES cartridge, cleared --hero and looked for a cover named
       rob-playtime, which does not exist, so the tile went blank (22 Oct). */
    const mode = artMode();
    const clip = mode === 'hardware' && !clipSuppressed() && !clipMissing.v;
    const img = clip
      ? '<div class="img"><video class="rob-clip" muted playsinline loop preload="none" aria-hidden="true" tabindex="-1" disablepictureinpicture></video></div>'
      : '<div class="img" style="--hero: url(\'' + BOX + '\');" data-hero-src="' + BOX + '"></div>';
    /* tile-tall (22 Oct): the same box as the NES tiles beside it, which are one
       column wide and tile-tall since that day. */
    /* The tile opens his drawer, as every game tile opens its drawer; the play badge in its corner
       (the wall's own badge, the same mark and place) opens Play Time straight away (22 Oct). */
    return '<div class="device-card tile-tall" data-series="nes" data-artmode="' + (mode === 'hardware' ? 'hardware' : 'boxart') + '" data-gbart="own" data-gmart="own" data-id="rob-playtime" role="button" tabindex="0" data-key-activate aria-label="R.O.B. Play Time" onclick="window.CwRob.openDrawer()">' +
      img +
      '<div class="body"><div class="name">R.O.B. Play Time</div><div class="meta">Accessory \u00b7 3D model</div></div>' +
      '<div class="play-badge" onclick="event.stopPropagation();window.CwRob.playTime()" role="button" tabindex="0" data-key-activate title="Open R.O.B. Play Time" aria-label="Play">' + PLAY_SVG + '</div></div>';
  }

  /* ------------------------------------------------------------ his drawer (22 Oct) */
  /* The same drawer as every game's (drawer-unified.js's shape and classes, the same #device-overlay,
     the same openOverlay / closeOverlay, tabs, pills, picture strip and lightbox, sidebar and status
     panel), built here because he is not a catalogue entry (the menu counts him as a built-in title).
     Text: what he is, why Nintendo made him, how he reads the screen, his two games and their sets,
     his release and what became of him, and that here he is a 3D model. Plain words, checked facts. */
  const PLAY_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="11" x2="10" y2="11"/><line x1="8" y1="9" x2="8" y2="13"/><line x1="15" y1="12" x2="15.01" y2="12"/><line x1="18" y1="10" x2="18.01" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258C21.166 6.83 19.51 5 17.32 5z"/></svg>';
  const sect = (title, html) => '<section class="sect"><h3 class="sect-h">' + title + '</h3>' + html + '</section>';
  const frow = (k, v) => '<div class="row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
  const srow = (k, v) => '<div class="status-row"><span class="status-k">&gt; ' + k + ':</span><span class="status-v">' + v + '</span></div>';
  const STORY = [
    ['About', '<p>R.O.B. is the Robotic Operating Buddy, the small grey robot Nintendo sold with the Nintendo Entertainment System in 1985. He is not a controller and not a game. He is a toy that stands beside the television, watches the screen, and plays along with the two games made for him. In Japan he was the Family Computer Robot, white with red trim to match the Famicom; the Western one wears the NES\u2019s grey and black.</p>'],
    ['Why Nintendo made him', '<p>In 1983 the American home video game market collapsed, and by 1985 shops wanted nothing to do with game consoles. Nintendo of America needed a way past that. The NES was presented not as a games console but as an entertainment system, and R.O.B. was its proof: a robot on the box put it on the toy shelf rather than the video game shelf. He shipped in the Deluxe Set with the Zapper light gun, Gyromite and Duck Hunt. He was designed by Gunpei Yokoi\u2019s R&amp;D1 team, the people behind the Game &amp; Watch.</p>'],
    ['How he works', '<p>R.O.B. has no wire to the console. He watches the television. When a game wants him to move it flashes the screen in a short pattern, and a light sensor behind his eyes reads the flashes and turns them into one of six commands: up, down, left, right, open and close. The light on his head blinks as a signal comes in, and the Test setting sends a steady flash so you can check he is listening. He runs on four AA cells in his base. The reading relies on the fast, bright flash of a tube television; most flat screens are too slow or too dim for him to follow.</p>'],
    ['His two games', '<p><b>Gyromite</b> (Robot Gyro in Japan) comes with the gyro set: two spinning tops, a battery powered spinner to get them going, a holder to park them in, and two trays that sit on a second NES controller. When R.O.B. lowers a spinning gyro onto a tray, its weight presses that controller\u2019s A or B button, and in the game a red or blue pillar drops so Professor Hector can get past. You play Hector on the first controller and keep R.O.B. busy at the same time.</p><p><b>Stack-Up</b> (Robot Block in Japan) comes with five coloured blocks and five stands. The screen shows a pattern of blocks and R.O.B. moves them one stand at a time to match it. The console cannot see the blocks, so Stack-Up is played on trust. Nintendo never made a third game for him.</p>'],
    ['Release and what became of him', '<p>Japan first, in July 1985, then North America in October 1985 with the NES itself, and Europe in 1986. He did what he was built for: toy buyers took the NES in, and within a year the console was on sale across the United States. As a toy he was slow, each command taking a few seconds, and after his two games Nintendo let him go. He came back as a character instead: a racer in Mario Kart DS, a fighter in Super Smash Bros. from Brawl on, and an amiibo figure in 2015.</p>'],
    ['Here on this site', '<p>R.O.B. is built in as a 3D model. Play Gyromite or Stack-Up and he stands beside the game, where the NES emulator reads the flashes in every picture it draws and sends him the same commands the real robot would get. Play Time lets you drive him yourself: his moves, his hands, his speed and his light, with a controller, a remote, a keyboard or a touch. The model is \u201cR.O.B. (Robotic Operating Buddy)\u201d by Wrld_Bld, used under the Creative Commons Attribution 4.0 licence.</p>'],
  ];
  const HW = [
    ['The parts', '<p>From the top: the head, with the eye lens and the light sensor behind it, and the small light that blinks as a command arrives. The head sits on a short neck and can be tilted by hand to aim at a television above or below him. Below it the body, with an arm on each side; the arms carry the hands, which the two games\u2019 sets swap for gyro hands or block hands. The body rides up and down a toothed column. The base holds the motors, the switches and four AA cells, and the games\u2019 stands clip to it.</p>'],
    ['What he can do', '<p>Six moves. The body rises and falls on the column, swings left and right across a row of stops, and the arms open and close. Every move is driven by small motors through gears, which is why he takes his time: a full trip up the column or across the stops is a few seconds. Play Time\u2019s controls are those six moves, with the test signal and a reset to his starting pose.</p>'],
    ['The signal', '<p>A command is a short run of screen flashes, the whole picture going light and dark in a fixed pattern, with a different pattern for each of the six moves and one more for Test. The sensor behind his eyes sees only brightness, so the games flash the whole screen rather than draw anything for him. Our NES emulator decodes the same patterns from the pictures it draws, frame by frame, and the 3D model moves on the same commands.</p>'],
    ['Power', '<p>Four AA cells in the base. Nothing connects him to the console: no cable, no port. The gyro set\u2019s spinner has its own batteries.</p>'],
  ];
  function drawerHTML() {
    const color = 'var(--accent)';
    const story = STORY.map(([t, h]) => sect(t, h)).join('');
    const hw = '<div class="hw-tab"><div class="hw-chip-header"><h2>R.O.B. (NES-012)</h2><p class="hw-chip-tag">Robotic Operating Buddy \u00b7 Nintendo, 1985 \u00b7 HVC-012 in Japan</p></div>' + HW.map(([t, h]) => sect(t, h)).join('') + '</div>';
    const facts = frow('Full name', 'Robotic Operating Buddy') + frow('In Japan', 'Family Computer Robot') + frow('Maker', 'Nintendo') + frow('Designed by', 'Nintendo R&amp;D1 (Gunpei Yokoi)') +
      frow('Released, Japan', 'Jul 1985') + frow('Released, North America', 'Oct 1985') + frow('Released, Europe', '1986') + frow('Games', 'Gyromite, Stack-Up') + frow('Reads', 'Light flashes from the screen') + frow('Power', 'Four AA cells');
    const status = '<div class="status-panel">' + srow('GAME', 'R.O.B. PLAY TIME') + srow('SYSTEM', 'NES ACCESSORY') + srow('GENRE', 'ROBOT') + srow('RELEASE', 'OCT 1985') +
      '<div class="status-row"><span class="status-k">&gt; STATUS:</span><span class="status-v">READY TO PLAY<span class="status-cursor">_</span></span></div></div>';
    return '<div class="drawer-tabs ud-tabs" style="--c:' + color + '">' +
      '<button type="button" class="drawer-tab active" data-tab="device" onclick="switchDrawerTab(this,\'device\')">R.O.B. Play Time</button>' +
      '<button type="button" class="drawer-tab" data-tab="hardware" onclick="switchDrawerTab(this,\'hardware\')">Hardware</button>' +
      '<button type="button" class="modal-close ud-tabs-close" onclick="closeOverlay(\'device-overlay\')" aria-label="Close" title="Close">\u00d7</button></div>' +
      '<div class="drawer-tab-content active" data-tab-content="device"><div class="device-modal-grid"><div class="drawer-left">' +
      '<div class="device-modal-img rob-hero" data-hero-key="rob-hero" style="background-image:url(\'' + HERO + '\');background-color:transparent;background-size:contain;background-position:center;background-repeat:no-repeat;cursor:zoom-in" onclick="window.CwRob.zoom(0)" role="button" tabindex="0" data-key-activate aria-label="R.O.B., larger"></div>' +
      '<div class="gallery-strip ud-gallery" data-ud-strip style="--c:' + color + '">' +
      '<button type="button" class="gallery-thumb ud-thumb ud-contain" data-ud-i="0" style="background-image:url(\'' + HERO + '\')" aria-label="R.O.B., 1 of 2" title="R.O.B."><span class="thumb-idx">1</span></button>' +
      '<button type="button" class="gallery-thumb ud-thumb ud-contain" data-ud-i="1" style="background-image:url(\'' + BOX + '\')" aria-label="Box, 2 of 2" title="Box"><span class="thumb-idx">2</span></button></div>' +
      '<div class="device-modal-body" style="--c:' + color + '"><div class="pill-row">' +
      '<span class="pill series-pill" role="link" tabindex="0" onclick="closeOverlay(\'device-overlay\');window.CwRob.select()" onkeydown="if(event.key===\'Enter\'){event.preventDefault();this.click()}" style="cursor:pointer">R.O.B.</span>' +
      '<span class="pill">Accessory</span><span class="pill">Oct 1985</span>' +
      '<button class="play-now" data-ud-play="rob-playtime" onclick="window.CwRob.playTime()" title="Open R.O.B. Play Time" aria-label="Play">' + PLAY_SVG + '<span>Play Now!</span></button></div>' +
      '<div class="drawer-title-row"><h2>R.O.B. Play Time</h2></div>' + story + '</div></div>' +
      '<aside class="drawer-sidebar" style="--c:' + color + '"><div class="sidebar-inner">' + sect('Facts', '<div class="factbox">' + facts + '</div>') + status + '</div></aside></div></div>' +
      '<div class="drawer-tab-content" data-tab-content="hardware">' + hw + '</div>';
  }
  function openDrawer() {
    css();
    const modal = document.getElementById('device-modal'); if (!modal) return;
    try { if (typeof pauseCollectionTiles === 'function') pauseCollectionTiles(); } catch (_) {}   // the drawer buries the wall: its live tiles rest
    document.body.classList.add('no-demo-device');   // no console on the left, so the drawer closes with the quick slide
    modal.innerHTML = drawerHTML();
    modal.dataset.udId = 'rob-playtime';
    modal.setAttribute('aria-label', 'R.O.B. Play Time');
    modal.classList.add('ud-drawer'); modal.classList.remove('leaving');
    void modal.offsetWidth;
    const strip = modal.querySelector('[data-ud-strip]'); if (strip) strip.__ud = [{ url: abs(HERO), label: 'R.O.B.' }, { url: abs(BOX), label: 'Box' }];   // the unified drawer's own thumb click opens the lightbox on these
    if (typeof openOverlay === 'function') openOverlay('device-overlay'); else document.getElementById('device-overlay').classList.add('open');
    try { if (window.gnwDrawerToTop) window.gnwDrawerToTop(document.getElementById('device-overlay')); else modal.scrollTop = 0; } catch (_) {}
  }
  /* The lightbox (index.html showLightbox / imgSrc) takes archive keys or absolute https URLs, not a site-relative path. */
  const abs = u => { try { return new URL(u, location.href).href; } catch (_) { return u; } };
  const zoom = i => { try { showLightbox([abs(HERO), abs(BOX)], i || 0); } catch (_) {} };

  /* ------------------------------------------------------------ the Play Time window */
  function close() {
    const el = document.getElementById('rob-play-overlay'); if (!el) return;
    if (typeof closeOverlay === 'function') closeOverlay('rob-play-overlay'); else el.classList.remove('open');
    const f = el.querySelector('iframe'); if (f) f.remove();          // R.O.B.'s 3D page stops with its window
    document.querySelectorAll('.device-card[data-id="rob-playtime"] video.rob-clip').forEach(v => { if (v._fgHeld) { v._fgHeld = 0; v._robPlay && v._robPlay(); } });   // the tile's clip goes on
    /* Focus back on his tile. Now, and again after keys.js's own close pass: while a window is in
       front the page behind is inert, and keys.js lifts that only in its pass after the class change,
       so a focus made now can be refused (measured after Play from the drawer). */
    const refocus = () => { const t = document.querySelector('.device-card[data-id="rob-playtime"]'); if (t) try { t.focus({ preventScroll: true }); } catch (_) {} };
    refocus(); setTimeout(refocus, 0); setTimeout(refocus, 120);
  }
  function playTime() {
    css();
    /* Play closes the drawer before the window opens, as every system's Play does. */
    try { const dv = document.getElementById('device-overlay'); if (dv && dv.classList.contains('open') && typeof closeOverlay === 'function') closeOverlay('device-overlay'); } catch (_) {}
    let el = document.getElementById('rob-play-overlay');
    if (!el) {
      el = document.createElement('div'); el.className = 'overlay'; el.id = 'rob-play-overlay';
      el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'R.O.B. Play Time');
      document.body.appendChild(el);
      /* Closed by any path (Back through keys.js, the x, Escape in the page): the 3D page goes too. */
      new MutationObserver(() => { if (!el.classList.contains('open')) { const f = el.querySelector('iframe'); if (f) f.remove(); } }).observe(el, { attributes: true, attributeFilter: ['class'] });
    }
    /* THE TITLE BAR'S BUTTONS (4 Nov 2026), left of the x: Reset pose, LED (red, with rays, while
       his light is lit), Auto rotate (turns the view by itself) and Information (the model's credit).
       Icons only, each with its name as a tooltip and for screen readers; they work the page through
       its window.robTop, and the page tells them what is lit (topPaint). */
    const tool = (t, label, svg) => '<button class="rob-tool" type="button" data-t="' + t + '" aria-label="' + label + '" title="' + label + '"' + (t === 'led' || t === 'spin' ? ' aria-pressed="false"' : t === 'info' ? ' aria-expanded="false"' : '') + '>' + svg + '</button>';
    el.innerHTML = '<div class="modal"><div class="modal-head"><div><div class="modal-sub">Robotic Operating Buddy</div><div class="modal-title">R.O.B. Play Time</div></div>' +
      '<div class="rob-tools" role="toolbar" aria-label="R.O.B. view">' + tool('reset', 'Reset pose', ICON.reset) + tool('led', 'LED', ICON.led) + tool('spin', 'Auto rotate', ICON.spin) + tool('info', 'Information', ICON.info) + '</div>' +
      '<button class="modal-close" type="button" aria-label="Close">&times;</button></div>' +
      '<iframe title="R.O.B. Play Time" src="play/rob/index.html?v=2.1.1&ui=pill"></iframe></div>';
    el.querySelector('.modal-close').addEventListener('click', close);
    el.querySelectorAll('.rob-tool').forEach(b => b.addEventListener('click', e => {
      const w = pageWin(); if (!w || !w.robTop) return;
      const t = b.dataset.t;
      if (t === 'reset') w.robTop.reset(); else if (t === 'led') w.robTop.led(); else if (t === 'spin') w.robTop.spin();
      else if (t === 'info') w.robTop.info(e.detail === 0);   // from a key or a controller: the focus goes into the credit, for its links
    }));
    const f = el.querySelector('iframe');
    f.addEventListener('load', () => { try { f.focus(); f.contentWindow.focus(); } catch (_) {} });
    if (typeof openOverlay === 'function') openOverlay('rob-play-overlay'); else el.classList.add('open');
    /* The tile's clip pauses behind the window (the window is R.O.B. himself), and goes on when it closes. */
    document.querySelectorAll('.device-card[data-id="rob-playtime"] video.rob-clip').forEach(v => { if (!v.paused) { v._fgHeld = 1; try { v.pause(); } catch (_) {} } });
  }
  window.cwRobPlayClose = close;
  const ic = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const ICON = {
    reset: ic('<path d="M3 12a9 9 0 1 0 2.6-6.4"/><polyline points="3 4 3 10 9 10"/><circle cx="12" cy="12" r="2"/>'),
    led: ic('<circle cx="12" cy="13" r="4.5"/><line x1="12" y1="18" x2="12" y2="21"/>'),
    ledOn: ic('<circle cx="12" cy="13" r="4.5"/><line x1="12" y1="18" x2="12" y2="21"/><line x1="12" y1="2.5" x2="12" y2="5"/><line x1="4.6" y1="5.6" x2="6.4" y2="7.4"/><line x1="19.4" y1="5.6" x2="17.6" y2="7.4"/><line x1="2.5" y1="13" x2="5" y2="13"/><line x1="19" y1="13" x2="21.5" y2="13"/>'),
    spin: ic('<ellipse cx="12" cy="13" rx="9" ry="4"/><polyline points="15.5 6.5 18.5 9 15.5 11.5"/><line x1="12" y1="4" x2="12" y2="13"/>'),
    info: ic('<circle cx="12" cy="12" r="9.5"/><line x1="12" y1="16.5" x2="12" y2="11"/><line x1="12" y1="7.5" x2="12.01" y2="7.5"/>'),
  };
  const pageWin = () => { const f = document.querySelector('#rob-play-overlay iframe'); try { return f && f.contentWindow; } catch (_) { return null; } };
  /* What is lit, from the page: lit (his light shows now), led (the LED is switched on), spin, info. */
  function topPaint(st) {
    const ov = document.getElementById('rob-play-overlay'); if (!ov || !st) return;
    const led = ov.querySelector('.rob-tool[data-t=led]'), spin = ov.querySelector('.rob-tool[data-t=spin]'), info = ov.querySelector('.rob-tool[data-t=info]');
    if (led) {
      led.classList.toggle('lit', !!st.lit); led.setAttribute('aria-pressed', String(!!st.led));
      const want = st.lit ? 'on' : 'off'; if (led.dataset.icon !== want) { led.dataset.icon = want; led.innerHTML = st.lit ? ICON.ledOn : ICON.led; }
      const t = 'LED: ' + (st.led ? 'on' : 'off'); if (led.title !== t) { led.title = t; led.setAttribute('aria-label', t); }
    }
    if (spin) spin.setAttribute('aria-pressed', String(!!st.spin));
    if (info) info.setAttribute('aria-expanded', String(!!st.info));
  }
  /* The keys on the title bar's buttons and the x: Left / Right walk along them, Down goes back into
     R.O.B.'s controls; Escape closes the credit first. */
  window.addEventListener('keydown', e => {
    const ov = document.getElementById('rob-play-overlay'); if (!ov || !ov.classList.contains('open')) return;
    const a = document.activeElement; if (!a || !ov.contains(a) || !a.closest('.modal-head')) return;
    const row = [...ov.querySelectorAll('.modal-head .rob-tool, .modal-head .modal-close')], i = row.indexOf(a); if (i < 0) return;
    const w = pageWin();
    if (e.key === 'Escape' && w && w.robTop && w.robTop.infoOpen()) { e.preventDefault(); e.stopImmediatePropagation(); w.robTop.infoClose(); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); const to = row[Math.max(0, Math.min(row.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))]; if (to) to.focus(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); e.stopImmediatePropagation(); const f = ov.querySelector('iframe'); try { f.focus(); } catch (_) {} if (w && w.robTop) w.robTop.focusIn(); }
  }, true);

  /* A controller's presses arrive as keys at the window's iframe (gamepad.js presses at the focus):
     the arrows, OK and Back go on into the page, which walks its own controls and menus. */
  window.addEventListener('keydown', e => {
    const ov = document.getElementById('rob-play-overlay');
    if (!ov || !ov.classList.contains('open') || !e.__gnwPad) return;
    const f = ov.querySelector('iframe'); if (!f || e.target !== f) return;
    let w = null; try { w = f.contentWindow; } catch (_) {}
    if (!w || !w.document) return;
    const t = w.document.activeElement || w.document.body;
    if (/^Arrow/.test(e.key) || e.key === 'Escape' || e.key === 'GoBack' || e.key === 'BrowserBack' || e.key === 'Backspace') {
      e.preventDefault(); e.stopImmediatePropagation();
      t.dispatchEvent(new w.KeyboardEvent('keydown', { key: e.key, code: e.code, bubbles: true, cancelable: true }));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (t.dataset && t.dataset.menu) t.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
      else if (t !== w.document.body && typeof t.click === 'function') t.click();
    }
  }, true);

  window.CwRob = { isRobGame, playTimePick: () => ({ sys: { id: 'rob', label: 'R.O.B.' }, dev: PT }), cardHTML, playTime, select, openDrawer, zoom, topPaint };
})();

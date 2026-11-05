/*
 * features.js -- the Features window (31 Oct 2026).
 *
 * "Create a features page that on the search bar has a button that sits to the right of the Home
 * button ... exhaustive and long, of everything here that the page does." It opens like Home,
 * Timeline and About: emby.js aboutSet(true, 'features') puts CwFeatures.html() inside the same
 * Game & Watch frame, deeplinks.js gives it the address /features (Back and Escape close it).
 *
 * NARRATION HOOKS (page-audio.js): every section's heading carries data-narrate-host="feat-..."
 * and the words the recording reads carry data-narrate="feat-...". With no entry for a key in
 * page-audio-timings.js nothing is drawn; once a recording and its timings are added, the Listen
 * button appears after the heading by itself. The write-up moved here from Home's
 * "What lives here" (recorded as home-media) had its last sentence changed on 1 Nov 2026, so it
 * now carries the key feat-media-story, with no recording yet: no Listen button until the new
 * recording and its timings arrive (the Features audio script). (The other three, home-gnw, home-gameboy and home-pokemon-mini, went with the
 * "Every machine, rebuilt." section on 1 Nov 2026; their timings stay in page-audio-timings.js.)
 * The 3D box art wording follows window.CW_BOX_ART_3D (index.html), off until the next release.
 *
 * Every claim is checked against the code of 31 Oct 2026. Plain words, no long dashes,
 * no collection counts. Silent: nothing here plays sound by itself.
 * Layout rhythm after moonfin.io (see features.css); text, artwork and icons are our own.
 */
(function () {
  'use strict';
  if (window.CwFeatures) return;

  const ic = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const IC = {
    rewind: '<polygon points="11 19 2 12 11 5 11 19"/><polygon points="22 19 13 12 22 5 22 19"/>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    save: '<path d="M5 3.5h11l3.5 3.5v13.5h-14.5z"/><path d="M8 3.5v5h7v-5"/><rect x="8" y="13" width="8" height="5.5" rx="1"/>',
    speed: '<polygon points="4 6 11 12 4 18 4 6"/><polygon points="12 6 19 12 12 18 12 6"/><line x1="21" y1="6" x2="21" y2="18"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    cheat: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>',
    variant: '<rect x="3" y="4" width="8" height="8" rx="1.5"/><rect x="13" y="12" width="8" height="8" rx="1.5"/><path d="M11 8h4a2 2 0 0 1 2 2v2M13 16H9a2 2 0 0 1-2-2v-2"/>',
    book: '<path d="M12 5C10 3.6 7 3.4 4 4v14c3-.6 6-.4 8 1"/><path d="M12 5c2-1.4 5-1.6 8-1v14c-3-.6-6-.4-8 1"/><path d="M12 5v15"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    pad: '<rect x="2" y="7" width="20" height="11" rx="4"/><line x1="7" y1="10" x2="7" y2="14"/><line x1="5" y1="12" x2="9" y2="12"/><circle cx="16" cy="11.2" r="1.1"/><circle cx="18.4" cy="13.4" r="1.1"/>',
    touch: '<path d="M9 11V5a1.5 1.5 0 0 1 3 0v6"/><path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2"/><path d="M15 11a1.5 1.5 0 0 1 3 0v3a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.6-2.2L4 15a1.5 1.5 0 0 1 2.3-1.9L9 15"/>',
    remote: '<rect x="8" y="2.5" width="8" height="19" rx="3"/><circle cx="12" cy="8" r="1.8"/><path d="M10.5 13h.01M13.5 13h.01M10.5 16h.01M13.5 16h.01"/>',
    tv: '<rect x="2.5" y="7" width="19" height="13" rx="2"/><polyline points="7.5 3 12 7 16.5 3"/>',
    desk: '<rect x="2.5" y="4" width="19" height="13" rx="2"/><line x1="8.5" y1="21" x2="15.5" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><line x1="11" y1="18.5" x2="13" y2="18.5"/>',
    search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16" y2="16"/>',
    cont: '<path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"/><polyline points="20.5 3.5 20.5 8 16 8"/><polygon points="10 8.6 15.2 12 10 15.4"/>',
    box: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><line x1="5" y1="8.2" x2="19" y2="8.2"/>',
    box3d: '<path d="M4 9v10l9 2.5v-10z"/><path d="M4 9l5.5-3.5L19 8l-6 3.5z"/><path d="M13 11.5L19 8v8.5l-6 5z"/>',
    device: '<rect x="4" y="3" width="16" height="18" rx="2"/><rect x="7" y="6" width="10" height="6.5" rx=".5"/><circle cx="8" cy="17.3" r="1"/><circle cx="12" cy="17.3" r="1"/><circle cx="16" cy="17.3" r="1"/>',
    switcher: '<rect x="8" y="5" width="8" height="14" rx="2"/><path d="M5 8v8M19 8v8M2 10v4M22 10v4"/>',
    list: '<line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/><polyline points="3.5 6 5 7.5 7.5 4.5"/><polyline points="3.5 12 5 13.5 7.5 10.5"/><polyline points="3.5 18 5 19.5 7.5 16.5"/>',
    timeline: '<line x1="12" y1="2.5" x2="12" y2="21.5"/><circle cx="12" cy="6" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="18" r="2.2"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    install: '<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M12 7v7M9 11l3 3 3-3"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.4-1.3-1.6-1.3-2.8 0-1 .8-1.6 1.8-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.1"/><circle cx="10" cy="7" r="1.1"/><circle cx="14.5" cy="7" r="1.1"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .8c0 1.8-2.5 2.2-2.5 4"/><path d="M12 17h.01"/>',
    focus: '<path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7.5 12 12 15 14"/>',
    film: '<rect x="2.5" y="4" width="19" height="16" rx="2"/><line x1="7" y1="4" x2="7" y2="20"/><line x1="17" y1="4" x2="17" y2="20"/><line x1="2.5" y1="12" x2="21.5" y2="12"/>',
    subs: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M6 14h5M13 14h5M6 10.5h8"/>',
    next: '<path d="M5 5l9 7-9 7z"/><path d="M18 5v14"/>',
    sound: '<polygon points="4 9 8 9 13 5 13 19 8 15 4 15 4 9"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/>',
    server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M6.5 7.5h.01M6.5 16.5h.01"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.2a5 5 0 0 1 5.5 5"/>',
    file: '<path d="M6 2.5h8l4 4v15H6z"/><path d="M14 2.5v4h4"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    printer: '<path d="M6 9V3.5h12V9"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v6.5H6z"/>',
    cable: '<path d="M4 20v-5a3 3 0 0 1 3-3h10a3 3 0 0 0 3-3V4"/><rect x="2" y="18" width="4" height="4" rx="1"/><rect x="18" y="2" width="4" height="4" rx="1"/>',
    rumble: '<rect x="7" y="4" width="10" height="16" rx="2"/><path d="M3 8v8M21 8v8M5 6v12M19 6v12"/>',
    tilt: '<rect x="6" y="3" width="12" height="18" rx="2" transform="rotate(-15 12 12)"/><path d="M3 20a12 12 0 0 1 4-4"/>',
    disk: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M7 3v5h9V3"/>',
    tape: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="8" cy="11.5" r="2.2"/><circle cx="16" cy="11.5" r="2.2"/><path d="M8 13.7h8M6 19l2-3h8l2 3"/>',
    gun: '<path d="M3 9h15l2 3h-6l-1.5 2H10l-1 5H5.5l1-5H3z"/><path d="M12 12v2"/>',
    mat: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.6"/><circle cx="16" cy="8" r="1.6"/><circle cx="8" cy="16" r="1.6"/><circle cx="16" cy="16" r="1.6"/><circle cx="12" cy="12" r="1.6"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.5 9.5h4a1.8 1.8 0 0 1 0 3.6h-3a1.8 1.8 0 0 0 0 3.6h4"/>',
    paddle: '<circle cx="12" cy="9" r="6"/><path d="M12 9l3-3M12 15v6"/>',
    keypad: '<rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M8.5 7h.01M12 7h.01M15.5 7h.01M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 15h.01M12 15h.01M15.5 15h.01M12 18.5h.01"/>',
    rotate: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><polyline points="20 4 20 8.5 15.5 8.5"/>',
    ir: '<path d="M5 12h3M16 12h3"/><path d="M9.5 8.5a5 5 0 0 1 0 7M14.5 8.5a5 5 0 0 0 0 7"/>',
    robot: '<rect x="7" y="3" width="10" height="7" rx="2"/><path d="M12 10v4M5 14h14M7 14v5M17 14v5M4 21h16"/><circle cx="10" cy="6.5" r="1"/><circle cx="14" cy="6.5" r="1"/>',
    piano: '<rect x="2.5" y="5" width="19" height="14" rx="1.5"/><path d="M7 5v9M12 5v9M17 5v9M7 14v5M12 14v5M17 14v5"/>',
    barcode: '<path d="M4 5v14M7 5v14M9 5v14M12 5v14M15 5v14M17 5v14M20 5v14"/>',
    battery: '<rect x="2.5" y="7" width="17" height="10" rx="2"/><path d="M21.5 10.5v3"/><path d="M6 10v4M9 10v4"/>',
    tile: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>',
    gem: '<path d="M7 3.5h10l4 5.5-9 11.5L3 9z"/><path d="M3 9h18"/>',
  };
  const icon = k => '<div class="ft-ic">' + ic(IC[k]) + '</div>';
  const pic = (src, alt) => '<div class="ft-pic"><img src="' + src + '" alt="' + (alt || '') + '"></div>';

  /* A tile: icon (or picture), title, an optional small label, then paragraphs. */
  function tile(o) {
    const head = o.img ? '' : '<div class="ft-th">' + icon(o.ic) + '<div><h4>' + o.t + '</h4>' + (o.sys ? '<div class="ft-sys">' + o.sys + '</div>' : '') + '</div></div>';
    const body = (o.p || []).map(x => '<p>' + x + '</p>').join('') + (o.ul ? '<ul>' + o.ul.map(x => '<li>' + x + '</li>').join('') + '</ul>' : '') + (o.keys ? '<div class="ft-keys">' + o.keys.map(k => '<span class="ft-key">' + k + '</span>').join('') + '</div>' : '');
    if (o.img) return '<article class="ft-tile ft-machine" tabindex="0">' + pic(o.img, '') + '<div><h4>' + o.t + '</h4>' + (o.sys ? '<div class="ft-sys">' + o.sys + '</div>' : '') + body + '</div></article>';
    return '<article class="ft-tile" tabindex="0">' + head + body + '</article>';
  }
  const tiles = (list, cls) => '<div class="ft-tiles' + (cls ? ' ' + cls : '') + '">' + list.map(tile).join('') + '</div>';

  /* A section: kicker, heading (the narration host) and the narrated introduction. */
  function head(id, kicker, title, paras) {
    /* No title (1 Nov 2026, Playing): the label itself is the section's jump target, kept as a heading for screen readers. */
    if (!title) return '<div class="section-head"><div>'
      + '<h2 class="section-kicker" tabindex="-1" data-ft-sec="' + id + '" style="margin:0;display:inline-block;padding:2px 2px 2px 4px">' + kicker + '</h2>'
      + '</div></div>';
    return '<div class="section-head"><div>'
      + '<div class="section-kicker">' + kicker + '</div>'
      + '<h2 class="section-title" tabindex="-1" data-ft-sec="' + id + '" data-narrate-host="' + id + '">' + title + '</h2>'
      + paras.map(p => '<p class="section-desc" data-narrate="' + id + '">' + p + '</p>').join('')
      + '</div></div>';
  }
  const go = (route, label, sub) => '<button type="button" data-ft-go="' + route + '"><b>' + label + '</b><span>' + sub + '</span><span class="go">Open</span></button>';

  /* "Checked by rebuilding" was on this page for a few hours on 1 Nov 2026; it moved to the Home
     window (checked-rebuilding.js, above "Why it matters"). */

  /* ======================================================================= the page */
  function html() {
    const out = [];
    const box3d = window.CW_BOX_ART_3D === true;   // the 3D box art view (index.html switch, 1 Nov 2026)
    out.push('<div class="ft-page">');

    /* ---------------------------------------------------------------- hero */
    out.push('<div class="section" style="padding-top:0">'
      + '<div class="ft-hero">'
      + '<span class="eyebrow"><span class="dot"></span> Features</span>'
      + '<h1 tabindex="-1" data-ft-sec="feat-intro" data-narrate-host="feat-intro">Everything here, <em>and how it works</em>.</h1>'
      + '<p class="ft-lede" data-narrate="feat-intro">Fourteen consoles and handhelds, the accessories that made them special, your own films and shows, and one play window that works the same on every one of them. This page is the whole tour: the accessories we rebuilt, what you can do while you play, every way to control it, where your library can live, and every screen it runs on.</p>'
      + '<div class="ft-stats">'
      + '<div class="ft-stat"><div class="v">14</div><div class="l">Consoles and handhelds</div></div>'
      + '<div class="ft-stat"><div class="v">11</div><div class="l">Emulators built from nothing</div></div>'
      + '<div class="ft-stat"><div class="v">2</div><div class="l">Media servers for your films: Emby and Jellyfin</div></div>'
      + '<div class="ft-stat"><div class="v ft-word">No installs</div><div class="l">It runs in the browser you already have</div></div>'
      + '</div>'
      + '<nav class="ft-jump" aria-label="Jump to a section">'
      + [['feat-accessories', 'Accessories'], ['feat-play', 'Playing'], ['feat-controls', 'Controls'], ['feat-library', 'The library'], ['feat-media', 'Films and shows'], ['feat-widgets', 'Widgets'], ['feat-connect', 'Where it lives'], ['feat-servers', 'Game servers'], ['feat-screens', 'Your screen'], ['feat-more', 'And more']]
        .map(([id, l]) => '<button type="button" data-ft-jump="' + id + '">' + l + '</button>').join('')
      + '</nav>'
      + '</div></div>');

    /* ---------------------------------------------------------------- what sets it apart */
    out.push('<div class="section">' + head('feat-apart', 'What sets it apart', 'Built for the way you actually <em style="font-style:normal;color:var(--accent-2)">use it</em>.', [
      'Open a handheld and it boots to a live, playable screen. Connect your media server and every film and show streams into the same console-style wall. Three ideas run through all of it.'])
      + '<div class="ft-big">'
      + '<article tabindex="0">' + icon('gem') + '<h3>Our own emulators, every one</h3><p>Every console here runs on an emulator we wrote ourselves, from the chip makers\' documentation and measurements of real hardware. How they score against everyone else, chip by chip, is on the Home page.</p><p><button type="button" class="ft-inline-link" data-ft-go="/home">See the scoreboard on Home</button></p></article>'
      + '<article tabindex="0">' + icon('film') + '<h3>Games and films on one wall</h3><p>Your films, your shows and the games share one wall of tiles, one search box and one Continue row. Pick up the episode you were watching or the game you closed last night from the same place.</p></article>'
      /* "One play window for every console" removed (1 Nov 2026); the third card spans the row. */
      + '<article tabindex="0" style="grid-column:1 / -1">' + icon('shield') + '<h3>Your library stays yours</h3><p>We host the site and the emulators, never your games or your media. Your files stay on your own device, your own game server or your own media server, and your saves stay on the screen you played on.</p></article>'
      + '</div></div>');

    /* "Every machine, rebuilt." (feat-machines) was removed on 1 Nov 2026: it repeated the Home
       page. The page goes from "What sets it apart" straight to Accessories. */

    /* ---------------------------------------------------------------- accessories */
    out.push('<div class="section">' + head('feat-accessories', 'Accessories', 'The add-ons, not just the consoles.', [
      'A console was never only the box under the television. It was a robot on the carpet, a printer spitting out stickers, a camera, a light gun, a keyboard and a tape deck. We rebuilt those too, so the games that needed them can be played the way they were meant to be.'])
            + '<div class="ft-row"><div><span class="eyebrow"><span class="dot"></span> NES and Famicom</span><h3>R.O.B., the Robotic Operating Buddy.</h3>'
      + '<p>R.O.B. has his own place on the wall. Start Gyromite or Stack-Up and he stands beside the game, watching the screen exactly as the real robot did: the game flashes its orders, and he reads every flash and moves his arms and hands at the real robot\'s speed.</p>'
      + '<p>Set up his gyros, trays and blocks yourself by dragging them with a mouse, a finger or a controller. A gyro spinning on its tray really presses the button the game is waiting for, and in Stack-Up the blocks you stacked are checked against the picture the game asked for. Or open his Play Time and drive him yourself: arms, hands, speed and his light.</p>'
      + '<p><button type="button" class="ft-cta" data-ft-rob>' + ic(IC.robot) + 'Play with R.O.B.</button></p></div>'
      + '<div class="ft-art"><img src="images/consoles/rob.webp" alt="R.O.B., the Robotic Operating Buddy" loading="lazy" style="position:relative;max-width:78%;max-height:300px;object-fit:contain"></div></div>'
      + tiles([
        { ic: 'printer', t: 'Game Boy Printer', sys: 'Game Boy', p: ['Print from any game that can. The paper builds up line by line as it would from the real printer, and you can print it on sticker-sized paper, save it as a picture, or throw it away.'] },
        { ic: 'camera', t: 'Game Boy Camera', sys: 'Game Boy', p: ['Your own webcam becomes the camera, switched on only when you pick it. Or give it a picture from your device instead.'] },
        { ic: 'cable', t: 'Link cable', sys: 'Game Boy', p: ['A second Game Boy, side by side, for two players on one screen. Each one keeps its own save.'] },
        { ic: 'rumble', t: 'Rumble and tilt', sys: 'Game Boy', p: ['Rumble cartridges shake the console on screen and buzz your controller or phone. Tilt games follow the arrow keys, a stick, a drag, or the phone in your hand.'] },
        { ic: 'barcode', t: 'Barcode Boy', sys: 'Game Boy', p: ['Swipe its cards by name, the way the barcode reader fed the games.'] },
        { ic: 'ir', t: 'Infrared link', sys: 'Pokémon mini', p: ['Two consoles side by side, talking by infrared, for the five games with a two-player mode.'] },
        { ic: 'disk', t: 'Disk System', sys: 'Famicom', p: ['Flip the disk with D, load every disk of a game as one set, or let the disk change by itself.'] },
        { ic: 'tape', t: 'Study Box', sys: 'Famicom', p: ['The cassette learning system: its tape deck plays the lesson tapes, and Y ejects or puts the tape back in.'] },
        { ic: 'keyboard', t: 'Family BASIC', sys: 'Famicom', p: ['Type on the Family BASIC keyboard with your own keyboard, and switch back to the controller with Scroll Lock. The Data Recorder loads and saves programs as sound files, just like cassette tapes.'] },
        { ic: 'gun', t: 'Zapper and VS. light gun', sys: 'NES', p: ['Point and shoot with a mouse or a finger, or aim with the arrows and fire with X.'] },
        { ic: 'mat', t: 'Power Pad and Family Trainer', sys: 'NES and Famicom', p: ['The floor mat as twelve pads on screen to tap, or as keys on your keyboard.'] },
        { ic: 'mic', t: 'The Famicom microphone', sys: 'Famicom', p: ['Shout into your own microphone (nothing is recorded), or hold M.'] },
        { ic: 'piano', t: 'Miracle Piano', sys: 'NES', p: ['The piano teaching system, played from a real MIDI keyboard plugged into your computer.'] },
        { ic: 'pad', t: 'The rest of the shelf', sys: 'NES and Famicom', ul: ['Four Score and four-player adapters', 'Arkanoid paddles, on the mouse', 'Hyper Shot, Party Tap and the pachinko dial', 'Punching bag, mole mat and Top Rider bike', 'Mahjong keypad and Oeka Kids drawing tablet', 'Barcode World and Datach barcode cards', 'Subor keyboard and mouse', 'Turbo File and Battle Box, saving to your browser'] },
        { ic: 'paddle', t: 'Paddles, wheels and keypads', sys: 'Atari 2600 and 7800', p: ['Paddles follow the mouse or a finger, driving controllers turn, and keypads sit on your number keys. A SaveKey keeps high scores.'] },
        { ic: 'tape', t: 'Supercharger and Kid Vid', sys: 'Atari 2600', p: ['Games that loaded from cassette tape, and the Kid Vid story tapes that played along with the game.'] },
        { ic: 'keypad', t: 'Keypad and Trak-ball', sys: 'Atari 5200', p: ['The twelve-key keypad on the number keys or on screen, and the Trak-ball for the games that loved it.'] },
        { ic: 'battery', t: 'High Score Cartridge', sys: 'Atari 7800', p: ['High scores kept between sessions, as the add-on cartridge kept them.'] },
      ])
      + '</div>');

    /* ---------------------------------------------------------------- playing */
    /* Heading "One Control Bar, every console." and its paragraph removed (1 Nov 2026): the section
       opens with its "Playing" label, which is the jump button's target. */
    out.push('<div class="section">' + head('feat-play', 'Playing', null, [])
      + '<div class="ft-row"><div><span class="eyebrow"><span class="dot"></span> Rewind</span><h3>Roll the last few seconds back.</h3><p>Missed a jump? Hold Rewind and the game runs backward, frame by frame, until you let go. Pick up right where it went wrong.</p><div class="ft-keys"><span class="ft-key">Hold Rewind</span><span class="ft-key">Ctrl + Left</span><span class="ft-key">LB on a controller</span></div></div><div class="ft-art">' + '<svg viewBox="0 0 460 250" fill="none" role="img" aria-label="A filmstrip scrubbing a frame backward"> <rect x="20" y="66" width="420" height="112" rx="12" stroke="currentColor" stroke-opacity=".26" stroke-width="2"/> <line x1="38" y1="80" x2="422" y2="80" stroke="currentColor" stroke-opacity=".22" stroke-width="7" stroke-dasharray="9 15"/> <line x1="38" y1="164" x2="422" y2="164" stroke="currentColor" stroke-opacity=".22" stroke-width="7" stroke-dasharray="9 15"/> <g stroke="currentColor" stroke-opacity=".18" stroke-width="2"> <line x1="106" y1="96" x2="106" y2="148"/> <line x1="163" y1="96" x2="163" y2="148"/> <line x1="220" y1="96" x2="220" y2="148"/> <line x1="277" y1="96" x2="277" y2="148"/> <line x1="334" y1="96" x2="334" y2="148"/> <line x1="391" y1="96" x2="391" y2="148"/> </g> <rect x="108" y="97" width="53" height="50" rx="4" fill="var(--accent)" fill-opacity=".16" stroke="var(--accent)" stroke-width="2.5"/> <path d="M134 46 v20 M134 178 v20" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/> <g fill="var(--accent)"> <path d="M96 214 l-18 11 l18 11 z"/> <path d="M122 214 l-18 11 l18 11 z"/> </g> <path d="M150 225 h150" stroke="currentColor" stroke-opacity=".3" stroke-width="2" stroke-linecap="round" stroke-dasharray="1 9"/> </svg>' + '</div></div>'
      + '<div class="ft-row rev"><div><span class="eyebrow"><span class="dot"></span> Pause</span><h3>Freeze the moment. Walk away.</h3><p>Pause any game mid-play and the whole machine stops. Come back later and carry on from the exact frame you left.</p><div class="ft-keys"><span class="ft-key">Ctrl + P</span><span class="ft-key">Back opens the pause menu</span></div></div><div class="ft-art">' + '<svg viewBox="0 0 460 250" fill="none" role="img" aria-label="A game screen frozen with a pause symbol"> <rect x="50" y="26" width="360" height="198" rx="16" stroke="currentColor" stroke-opacity=".3" stroke-width="2" fill="currentColor" fill-opacity=".03"/> <g stroke="currentColor" stroke-opacity=".22" stroke-width="2" fill="none"> <rect x="82" y="158" width="44" height="30" rx="3"/> <circle cx="150" cy="92" r="14"/> <path d="M318 176 l20 -34 l20 34 z"/> </g> <text x="72" y="56" font-family="ui-monospace, monospace" font-size="16" font-weight="700" fill="currentColor" fill-opacity=".5">12:00</text> <circle cx="230" cy="125" r="48" stroke="var(--accent)" stroke-opacity=".35" stroke-width="2"/> <g fill="var(--accent)"> <rect x="206" y="99" width="16" height="52" rx="3"/> <rect x="238" y="99" width="16" height="52" rx="3"/> </g> </svg>' + '</div></div>'
      + '<div class="ft-row"><div><span class="eyebrow"><span class="dot"></span> Saves</span><h3>Bookmark any run, snapshot and all.</h3><p>Eight save slots for every game, each with a picture of the screen, the date, how long you had played and a note of your own. Save a slot to a file and load it back on another device. A deleted slot can be undone, and the last game you closed waits at the end of the list.</p><div class="ft-keys"><span class="ft-key">Ctrl + S save</span><span class="ft-key">Ctrl + L load</span><span class="ft-key">Ctrl + [ and ] change slot</span></div></div><div class="ft-art">' + '<svg viewBox="0 0 460 250" fill="none" role="img" aria-label="Three save slots, one selected, each showing a screen thumbnail"> <!-- slot 1 --> <g> <rect x="34" y="46" width="118" height="158" rx="13" stroke="currentColor" stroke-opacity=".28" stroke-width="2" fill="currentColor" fill-opacity=".03"/> <rect x="48" y="62" width="90" height="64" rx="6" fill="currentColor" fill-opacity=".07" stroke="currentColor" stroke-opacity=".2"/> <text x="48" y="154" font-family="ui-monospace, monospace" font-size="12.5" font-weight="700" fill="currentColor" fill-opacity=".45">SLOT 1</text> <rect x="48" y="166" width="70" height="7" rx="3.5" fill="currentColor" fill-opacity=".16"/> <rect x="48" y="180" width="50" height="7" rx="3.5" fill="currentColor" fill-opacity=".11"/> </g> <!-- slot 2 (selected) --> <g> <rect x="171" y="38" width="118" height="174" rx="13" fill="var(--accent)" fill-opacity=".08" stroke="var(--accent)" stroke-width="2.5"/> <rect x="185" y="56" width="90" height="64" rx="6" fill="var(--accent)" fill-opacity=".14" stroke="var(--accent)" stroke-opacity=".5"/> <text x="185" y="154" font-family="ui-monospace, monospace" font-size="12.5" font-weight="700" fill="var(--accent)">SLOT 2</text> <rect x="185" y="166" width="70" height="7" rx="3.5" fill="var(--accent)" fill-opacity=".42"/> <rect x="185" y="180" width="50" height="7" rx="3.5" fill="var(--accent)" fill-opacity=".28"/> <circle cx="266" cy="54" r="14" fill="var(--accent)"/> <path d="M259 54 l5 5 l9 -10" stroke="var(--bg-1)" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/> </g> <!-- slot 3 --> <g> <rect x="308" y="46" width="118" height="158" rx="13" stroke="currentColor" stroke-opacity=".28" stroke-width="2" fill="currentColor" fill-opacity=".03"/> <rect x="322" y="62" width="90" height="64" rx="6" fill="currentColor" fill-opacity=".07" stroke="currentColor" stroke-opacity=".2"/> <text x="322" y="154" font-family="ui-monospace, monospace" font-size="12.5" font-weight="700" fill="currentColor" fill-opacity=".45">SLOT 3</text> <rect x="322" y="166" width="70" height="7" rx="3.5" fill="currentColor" fill-opacity=".16"/> <rect x="322" y="180" width="50" height="7" rx="3.5" fill="currentColor" fill-opacity=".11"/> </g> </svg>' + '</div></div>'
      + tiles([
        { ic: 'speed', t: 'Speed', p: ['Play at normal speed, twice as fast or four times as fast. Hold RB on a controller for a burst of double speed.'] },
        { ic: 'sound', t: 'Mute and sound', p: ['Mute with one press. Sound starts the moment a game opens; if a browser holds it back, one tap on the start screen brings it in.'], keys: ['Ctrl + M'] },
        { ic: 'focus', t: 'Full screen', p: ['Just the game screen, edge to edge, with nothing around it. Back returns you to the device.'], keys: ['Ctrl + Shift + F'] },
        { ic: 'camera', t: 'Screenshots', p: ['Take a picture of the game at its own size. On a phone it goes to your photos; on a computer it downloads.'] },
        { ic: 'cheat', t: 'Cheats', p: ['Games with a cheat list show a Cheats menu: switch each one on or off. Game Genie, GameShark, Pro Action Replay and memory codes are all understood. Cheats start switched off, and a cheated session does not count towards play time.'] },
        { ic: 'variant', t: 'Variants', p: ['One tile per game, however many versions exist. Play always opens the game on the box. Pick a region, a revision, a translation or another release from the Variant menu to play that one.'] },
        { ic: 'book', t: 'Original manuals', p: ['Flip through the real instruction booklets page by page in a 3D page-turn viewer, at normal or large size, with the arrows, a click or a controller.'] },
        { ic: 'keyboard', t: 'Keys and help', p: ['The Keys panel shows every key and button for the game in front of you, and help is one press of ? away, with your own keys in it.'], keys: ['Ctrl + /', '?'] },
      ])
      + '</div>');

    /* ---------------------------------------------------------------- controls */
    out.push('<div class="section">' + head('feat-controls', 'Controls', 'Play it with whatever is in your hands.', [
      'A keyboard, a game controller, a touch screen or a TV remote: every one of them works across the whole site, not just inside a game. The letters on your controller are the letters the game sees, and every key and button can be changed.'])
      + tiles([
        { ic: 'keyboard', t: 'Keyboard', p: ['Every page has keys: arrows to move, Enter to choose, one Back key everywhere. Press ? for the full list of the screen you are on, / or Ctrl + K to jump anywhere, and g then a letter to go straight to a page.'], keys: ['?', '/', 'Ctrl + K', 'G then H, E, M, T, A, S'] },
        { ic: 'pad', t: 'Game controllers', p: ['Plug in a controller and it just works, on the wall and in every game. A is A: Nintendo-style pads and Xbox-style pads are told apart, and you can set it per controller. Players two to four join on their own pads where a game allows it.'], ul: ['LB and RB step through the systems', 'X and Y switch Movies and Widgets on the wall', 'LT jumps to the Home button, RT opens the Systems menu', 'In a game: LB rewinds, RB speeds up, Home opens the pause menu, R3 opens help'] },
        { ic: 'touch', t: 'Touch', p: ['On a phone or tablet the buttons drawn on each device are the buttons you press. Games that need more get a see-through pad, and the Atari switches sit in a strip along the bottom. Turn them on, off or leave them on Auto.'], keys: ['Ctrl + O'] },
        { ic: 'remote', t: 'TV remote', p: ['On a smart TV the remote drives everything: the arrows move, OK chooses, Back goes back. The four colour keys open the menu, the details, quick jump and the key list. The TV is recognised by itself, and TV mode can also be set by hand in Settings.'] },
        { ic: 'settings', t: 'Change any key', p: ['Settings, Keyboard and controllers: change the keys and buttons for the site and for each console, with a warning and a swap when two would clash, and a reset back to the start.'] },
        { ic: 'focus', t: 'Focus mode', p: ['Press Z to hide the toolbar and library strip and leave just the wall. Up past the top row, or Back, brings them back.'], keys: ['Z'] },
      ].map(t => (t.ic === 'settings' ? Object.assign(t, { ic: 'key' }) : t)))
      + '</div>');

    /* ---------------------------------------------------------------- the library */
    out.push('<div class="section">' + head('feat-library', 'The library', 'A wall that knows what you want next.', [
      'Games, films and shows sit together on one wall of tiles. Show them as the real devices' + (box3d ? ', as box art or as 3D boxes' : ' or as box art') + ', sort them, filter them, and step from system to system without ever leaving the page.'])
      + tiles([
        { ic: 'device', t: box3d ? 'Live devices, box art or 3D boxes' : 'Live devices or box art', p: [(box3d ? 'See the games as the hardware they ran on, as their original box art, or as boxes standing on a shelf.' : 'See the games as the hardware they ran on, or as their original box art.') + ' A game with no box art gets a clean box of its own system rather than an empty space.'] },
        { ic: 'search', t: 'Search as you type', p: ['The search box finds games, films and shows instantly, and finds a game by its name in other regions too. Start typing and your recent picks appear under it.'] },
        { ic: 'cont', t: 'The Continue row', p: ['Films you are part way through, the next episode of a show, and the games you played: a game is kept automatically when you close it after real play, so it is one press to carry on.'] },
        { ic: 'switcher', t: 'The System Switcher', p: ['Press LB or RB, or , or ., and a carousel of systems slides in over the wall. Keep pressing to move, and it switches a moment after you stop.'], keys: ['LB / RB', ', .'] },
        { ic: 'list', t: 'The Systems menu', p: ['Pick one system or several, narrow the Game &amp; Watch series, and sort by name, release date, rating, recently played or shuffle. Filter by commercial games, homebrew, demos and diagnostic cartridges.'] },
        { ic: 'clock', t: 'Play time', p: ['Each game counts how long you have really played it, only while it is actually running, and each save slot shows its own time.'] },
        { ic: 'box', t: 'Marquees and details', p: ['Open any game for its details: the game\'s own logo, the box, the release facts, its variants, its manual, its cheats and its play time, with the Hardware and Emulation pages of its system a tab away.'] },
        { ic: 'timeline', t: 'Timeline', p: ['Every console on the site in the order it really arrived, from 1977 onwards. Pick one to drop straight into its games.'] },
        { ic: 'list', t: 'Compatibility list', p: ['Every game on every system with how it runs here: Plays, Boots or Nothing, the reason when it does not play, and the date it was last tested.'] },
      ])
      + '</div>');

    /* ---------------------------------------------------------------- films and shows */
    out.push('<div class="section">' + head('feat-media', 'Films and shows', 'Plays the formats browsers give up on.', [
      'Sign in to your Emby or Jellyfin server and your films and shows join the games on the same wall. The player does the hard work in your browser, so most of the time your server just sends the file.'])
      /* Narration key home-media -> feat-media-story (1 Nov 2026): the last sentence changed, and the
         home-media recording reads the old words. With no timings for the new key there is no Listen
         button here until the new recording and its timings are added. */
      + '<div class="ft-story"><div class="section-kicker" data-narrate-host="feat-media-story">Movies and Shows</div>'
      + '<p class="desc" data-narrate="feat-media-story">Your own films and shows stream in beside the games. MKV, 10-bit HEVC and AV1, even old DivX and Xvid, are repackaged or converted live in the browser, so the formats browsers give up on simply play, and by default your server is asked to convert only when nothing else will do. Dolby Digital, Dolby Digital Plus and DTS are decoded here too and folded down to clean stereo, so tracks that would have been silent come through with their sound intact. The whole catalogue is indexed on your own device, so searching tens of thousands of titles stays instant as you type. Emby and Jellyfin both work today. Plex is next, built the same way. Whichever server your library lives on, it meets your games on the same page.</p></div>'
      + '<div class="ft-row"><div><span class="eyebrow"><span class="dot"></span> Any format</span><h3>Repackaged in the browser.</h3><p>MKV is rewrapped on the fly with nothing re-encoded. Old DivX and Xvid files are converted live. By default, only when nothing else will do does the player ask your server to convert, and Settings lets you choose Auto, Always or Never.</p></div><div class="ft-art">' + '<svg viewBox="0 0 460 250" fill="none" role="img" aria-label="Unusual video formats converting into a playable screen"> <g font-family="ui-monospace, monospace" font-size="13" font-weight="700"> <rect x="28" y="58" width="86" height="34" rx="8" stroke="currentColor" stroke-opacity=".3" stroke-width="2"/> <text x="47" y="80" fill="currentColor" fill-opacity=".55">MKV</text> <rect x="28" y="104" width="86" height="34" rx="8" stroke="currentColor" stroke-opacity=".3" stroke-width="2"/> <text x="43" y="126" fill="currentColor" fill-opacity=".55">HEVC</text> <rect x="28" y="150" width="86" height="34" rx="8" stroke="currentColor" stroke-opacity=".3" stroke-width="2"/> <text x="49" y="172" fill="currentColor" fill-opacity=".55">AV1</text> </g> <path d="M126 121 h60" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/> <path d="M180 112 l12 9 l-12 9" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/> <rect x="212" y="52" width="220" height="146" rx="14" stroke="var(--accent)" stroke-opacity=".5" stroke-width="2.5" fill="var(--accent)" fill-opacity=".06"/> <path d="M302 96 l44 29 l-44 29 z" fill="var(--accent)"/> </svg>' + '</div></div>'
      + '<div class="ft-row rev"><div><span class="eyebrow"><span class="dot"></span> Full sound</span><h3>Sound that would have been silent.</h3><p>Dolby Digital, Dolby Digital Plus and DTS soundtracks are decoded right here and folded down to clean stereo.</p></div><div class="ft-art">' + '<svg viewBox="0 0 460 250" fill="none" role="img" aria-label="A Dolby or DTS track decoded into stereo sound"> <g font-family="ui-monospace, monospace" font-weight="700"> <rect x="34" y="90" width="112" height="70" rx="12" stroke="currentColor" stroke-opacity=".3" stroke-width="2"/> <text x="52" y="120" font-size="15" fill="currentColor" fill-opacity=".55">DOLBY</text> <text x="66" y="144" font-size="13" fill="currentColor" fill-opacity=".4">/ DTS</text> </g> <path d="M158 125 h52" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/> <path d="M204 116 l12 9 l-12 9" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/> <path d="M250 112 h20 l26 -22 v90 l-26 -22 h-20 z" fill="var(--accent)" fill-opacity=".14" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/> <g stroke="var(--accent)" stroke-width="2.5" fill="none" stroke-linecap="round"> <path d="M312 106 q16 19 0 38"/> <path d="M330 92 q30 33 0 66"/> <path d="M348 78 q44 47 0 94"/> </g> </svg>' + '</div></div>'
      + '<div class="ft-row"><div><span class="eyebrow"><span class="dot"></span> Instant search</span><h3>A whole library, searched as you type.</h3><p>The catalogue is indexed on your own device, so searching and filtering never waits on the server.</p></div><div class="ft-art">' + '<svg viewBox="0 0 460 250" fill="none" role="img" aria-label="A search box with an instant result highlighted"> <rect x="40" y="40" width="380" height="46" rx="23" stroke="currentColor" stroke-opacity=".3" stroke-width="2"/> <circle cx="70" cy="63" r="9" stroke="var(--accent)" stroke-width="2.5"/> <path d="M77 70 l10 10" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/> <rect x="100" y="57" width="120" height="12" rx="6" fill="currentColor" fill-opacity=".18"/> <rect x="226" y="51" width="2.6" height="24" rx="1.3" fill="var(--accent)"/> <rect x="40" y="104" width="380" height="36" rx="10" fill="var(--accent)" fill-opacity=".08" stroke="var(--accent)" stroke-opacity=".45" stroke-width="2"/> <rect x="58" y="117" width="150" height="10" rx="5" fill="var(--accent)" fill-opacity=".55"/> <rect x="360" y="117" width="44" height="10" rx="5" fill="var(--accent)" fill-opacity=".3"/> <rect x="40" y="150" width="380" height="36" rx="10" stroke="currentColor" stroke-opacity=".2" stroke-width="2"/> <rect x="58" y="163" width="120" height="10" rx="5" fill="currentColor" fill-opacity=".15"/> <rect x="40" y="196" width="380" height="36" rx="10" stroke="currentColor" stroke-opacity=".2" stroke-width="2"/> <rect x="58" y="209" width="184" height="10" rx="5" fill="currentColor" fill-opacity=".15"/> </svg>' + '</div></div>'
      + tiles([
        { ic: 'subs', t: 'Subtitles', p: ['Subtitles drawn by the page with your own size and timing, found for you when a file has none, matched to the speech automatically, and broken ones replaced.'] },
        { ic: 'next', t: 'Up Next', p: ['A countdown card for the next episode, with autoplay on or off, and intros skipped for you when your server knows where they are.'] },
        { ic: 'film', t: 'Preview while you seek', p: ['Pictures of the scene above the seek bar and the film\'s chapters, from your server\'s own preview images.'] },
        { ic: 'cont', t: 'Picks up where you left off', p: ['Progress goes back to your server, so a film you stopped here carries on in any other app, and the other way round.'] },
        { ic: 'users', t: 'Cast on the wall', p: ['The people in your library can sit on the wall as their own tiles. Pick one to see everything they appear in.'] },
        { ic: 'next', t: 'Skip anywhere', p: ['Jump to any point, even in a file that is being converted, and picture and sound pick up together.'] },
      ])
      + '</div>');

    /* ---------------------------------------------------------------- widgets (31 Oct) */
    out.push('<div class="section">' + head('feat-widgets', 'Widgets', 'Live tiles woven into the wall.', [
      'With your media server signed in, little live tiles appear between your films, shows and games: a clock, the weather, trailers, film facts, famous lines, your collection in numbers and the stars of your own library. They are all silent, and each one can be switched on or off.'])
      + tiles([
        { ic: 'clock', t: 'Clock', p: ['An analogue clock with a sweeping second hand and the date, in your own time zone or any city you choose.'] },
        { ic: 'globe', t: 'Weather', p: ['Where you are, the temperature, the high and low for the day and an animated sky: sun, rain, snow, storms, fog or stars. Found for you, or set a city of your own.'] },
        { ic: 'film', t: 'Trailers', p: ['A film tile grows to double width and plays its trailer, muted and looping, while it is on screen. Choose how many play at once. On a TV, and when your device asks for less motion, the tile stays a still poster.'] },
        { ic: 'book', t: 'Film facts', p: ['Moments from cinema history, and films from your own library that came out on this day.'] },
        { ic: 'subs', t: 'Movie quotes', p: ['Famous lines with their film and year, on a strip of film.'] },
        { ic: 'list', t: 'Collection stats', p: ['Your library in numbers, one at a time: films, shows and episodes, the highest rated, the oldest and newest, films by decade, and what you watched this month. Pick the ones you like.'] },
        { ic: 'users', t: 'Cast', p: ['The leading actors of your own library, each with how many of your titles they are in. Press one to see everything they appear in.'] },
        { ic: 'tile', t: 'One switch, or one at a time', p: ['The Widgets tile in the Systems menu turns them all on or off with one press. In Settings, Widgets, each one has its own switch and how often it appears, from every few tiles to one in two hundred.'] },
      ])
      + '</div>');

    /* ---------------------------------------------------------------- where it lives */
    out.push('<div class="section">' + head('feat-connect', 'Where it lives', 'Four ways into your library.', [
      'The site and its emulators come from us. Your games, films and shows never do: they come from your own device or your own servers, and meet in the browser on whatever screen you are holding.'])
      + '<figure class="ft-diagram" style="margin:0 0 var(--ft-gap)">' + '<svg class="ft-wide" viewBox="0 0 960 470" role="img" aria-labelledby="ftDgT ftDgD"><title id="ftDgT">How a library reaches your screen</title><desc id="ftDgD">Four ways in. A game file on this device is held in memory. Your own game server at home is reached over the home network. The same server away from home is found by your vault code over the internet. Emby or Jellyfin stream films and shows. All of them meet in the browser on your desk, phone or TV, where our emulators run, and the site itself comes from crystalworlds.media.</desc><defs><marker id="ftArrowW" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="currentColor" style="color:var(--muted)"/></marker></defs><rect class="d-box" x="16" y="40" width="262" height="106" rx="14"/><g class="d-ic" transform="translate(30 52) scale(0.85)"><path d="M6 2.5h8l4 4v15H6z"/><path d="M14 2.5v4h4"/><path d="M9 13h6M9 16.5h6"/></g><text class="d-k" x="58" y="67">ON THIS DEVICE</text><text class="d-t" x="32" y="88">A game file</text><text class="d-s" x="32" y="111">Picked or dropped in Settings.</text><text class="d-s" x="32" y="130">Held in memory, never uploaded.</text><rect class="d-box" x="16" y="182" width="262" height="106" rx="14"/><g class="d-ic2" transform="translate(30 194) scale(0.85)"><rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M6.5 7.5h.01M6.5 16.5h.01"/></g><text class="d-k" x="58" y="209">AT HOME</text><text class="d-t" x="32" y="230">Your game server</text><text class="d-s" x="32" y="253">On your own computer, over</text><text class="d-s" x="32" y="272">your home network (HTTPS).</text><rect class="d-box" x="16" y="324" width="262" height="106" rx="14"/><g class="d-ic3" transform="translate(30 336) scale(0.85)"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></g><text class="d-k" x="58" y="351">AWAY FROM HOME</text><text class="d-t" x="32" y="372">The same game server</text><text class="d-s" x="32" y="395">Found by your vault code,</text><text class="d-s" x="32" y="414">over the internet.</text><rect class="d-box" x="682" y="110" width="262" height="106" rx="14"/><g class="d-ic" transform="translate(696 122) scale(0.85)"><rect x="2.5" y="4" width="19" height="16" rx="2"/><line x1="7" y1="4" x2="7" y2="20"/><line x1="17" y1="4" x2="17" y2="20"/><line x1="2.5" y1="12" x2="21.5" y2="12"/></g><text class="d-k" x="724" y="137">FILMS AND SHOWS</text><text class="d-t" x="698" y="158">Emby or Jellyfin</text><text class="d-s" x="698" y="181">Your own media server,</text><text class="d-s" x="698" y="200">streamed to the page.</text><rect class="d-box" x="682" y="262" width="262" height="106" rx="14"/><g class="d-ic2" transform="translate(696 274) scale(0.85)"><rect x="2" y="7" width="20" height="11" rx="4"/><line x1="7" y1="10" x2="7" y2="14"/><line x1="5" y1="12" x2="9" y2="12"/><circle cx="16" cy="11.2" r="1.1"/><circle cx="18.4" cy="13.4" r="1.1"/></g><text class="d-k" x="724" y="289">YOUR HANDS</text><text class="d-t" x="698" y="310">Every way to play</text><text class="d-s" x="698" y="333">Keyboard, controller,</text><text class="d-s" x="698" y="352">touch or TV remote.</text><rect class="d-box" x="349" y="14" width="262" height="106" rx="14"/><g class="d-ic" transform="translate(363 26) scale(0.85)"><path d="M7 3.5h10l4 5.5-9 11.5L3 9z"/><path d="M3 9h18M10 3.5 8 9l4 11.5L16 9l-2-5.5"/></g><text class="d-k" x="391" y="41">CRYSTALWORLDS.MEDIA</text><text class="d-t" x="365" y="62">The site and its emulators</text><text class="d-s" x="365" y="85">The page, emulators, box art</text><text class="d-s" x="365" y="104">and manuals.</text><rect class="d-hub" x="349" y="170" width="262" height="280" rx="18"/><text class="d-k" x="480.0" y="198" text-anchor="middle">YOUR SCREEN</text><text class="d-t" x="480.0" y="222" text-anchor="middle">Any modern browser</text><g class="d-ic" transform="translate(378 248) scale(1.75)"><rect x="2.5" y="4" width="19" height="13" rx="2"/><line x1="8.5" y1="21" x2="15.5" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></g><text class="d-s" x="399" y="312" text-anchor="middle">Desk</text><g class="d-ic" transform="translate(459 248) scale(1.75)"><rect x="7" y="2.5" width="10" height="19" rx="2.2"/><line x1="11" y1="18.5" x2="13" y2="18.5"/></g><text class="d-s" x="480" y="312" text-anchor="middle">Phone</text><g class="d-ic" transform="translate(540 248) scale(1.75)"><rect x="2.5" y="7" width="19" height="13" rx="2"/><polyline points="7.5 3 12 7 16.5 3"/></g><text class="d-s" x="561" y="312" text-anchor="middle">TV</text><text class="d-s" x="480.0" y="356" text-anchor="middle">Our emulators run right here.</text><text class="d-s" x="480.0" y="376" text-anchor="middle">Saves and settings stay</text><text class="d-s" x="480.0" y="396" text-anchor="middle">on this device.</text><path class="d-line d-local" d="M278 93 C 315 93 315 230 347 230" marker-end="url(#ftArrowW)"/><path class="d-line d-lan" d="M278 235 C 312 235 312 300 347 300" marker-end="url(#ftArrowW)"/><path class="d-line d-net" d="M278 377 C 315 377 315 370 347 370" marker-end="url(#ftArrowW)"/><path class="d-line d-media" d="M682 163 C 645 163 645 250 613 250" marker-end="url(#ftArrowW)"/><path class="d-line " d="M682 315 C 648 315 648 340 613 340" marker-end="url(#ftArrowW)"/><path class="d-line " d="M480 120 L480 168" marker-end="url(#ftArrowW)"/></svg>' + '' + '<svg class="ft-tall" viewBox="0 0 360 880" role="img" aria-labelledby="ftDgT2 ftDgD2"><title id="ftDgT2">How a library reaches your screen</title><desc id="ftDgD2">Four ways in, from the top: a game file on this device, your game server at home, the same server away from home by vault code, and Emby or Jellyfin for films and shows. Each line runs down into your screen, the browser on your desk, phone or TV, where our emulators run. The site itself comes from crystalworlds.media, at the bottom.</desc><defs><marker id="ftArrowT" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="currentColor" style="color:var(--muted)"/></marker></defs><rect class="d-box" x="40" y="12" width="308" height="106" rx="14"/><g class="d-ic" transform="translate(54 24) scale(0.85)"><path d="M6 2.5h8l4 4v15H6z"/><path d="M14 2.5v4h4"/><path d="M9 13h6M9 16.5h6"/></g><text class="d-k" x="82" y="39">ON THIS DEVICE</text><text class="d-t" x="56" y="60">A game file</text><text class="d-s" x="56" y="83">Picked or dropped in Settings.</text><text class="d-s" x="56" y="102">Held in memory, never uploaded.</text><rect class="d-box" x="40" y="132" width="308" height="106" rx="14"/><g class="d-ic2" transform="translate(54 144) scale(0.85)"><rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M6.5 7.5h.01M6.5 16.5h.01"/></g><text class="d-k" x="82" y="159">AT HOME</text><text class="d-t" x="56" y="180">Your game server</text><text class="d-s" x="56" y="203">On your own computer, over</text><text class="d-s" x="56" y="222">your home network (HTTPS).</text><rect class="d-box" x="40" y="252" width="308" height="106" rx="14"/><g class="d-ic3" transform="translate(54 264) scale(0.85)"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></g><text class="d-k" x="82" y="279">AWAY FROM HOME</text><text class="d-t" x="56" y="300">The same game server</text><text class="d-s" x="56" y="323">Found by your vault code,</text><text class="d-s" x="56" y="342">over the internet.</text><rect class="d-box" x="40" y="372" width="308" height="106" rx="14"/><g class="d-ic" transform="translate(54 384) scale(0.85)"><rect x="2.5" y="4" width="19" height="16" rx="2"/><line x1="7" y1="4" x2="7" y2="20"/><line x1="17" y1="4" x2="17" y2="20"/><line x1="2.5" y1="12" x2="21.5" y2="12"/></g><text class="d-k" x="82" y="399">FILMS AND SHOWS</text><text class="d-t" x="56" y="420">Emby or Jellyfin</text><text class="d-s" x="56" y="443">Your own media server,</text><text class="d-s" x="56" y="462">streamed to the page.</text><path class="d-line d-local" d="M40 65 H10 V650 H38" marker-end="url(#ftArrowT)"/><path class="d-line d-lan" d="M40 185 H18 V630 H38" marker-end="url(#ftArrowT)"/><path class="d-line d-net" d="M40 305 H26 V610 H38" marker-end="url(#ftArrowT)"/><path class="d-line d-media" d="M40 425 H34 V590 H38" marker-end="url(#ftArrowT)"/><rect class="d-hub" x="40" y="560" width="308" height="200" rx="18"/><text class="d-k" x="194" y="586" text-anchor="middle">YOUR SCREEN</text><text class="d-t" x="194" y="610" text-anchor="middle">Any modern browser</text><g class="d-ic" transform="translate(86 626) scale(1.5)"><rect x="2.5" y="4" width="19" height="13" rx="2"/><line x1="8.5" y1="21" x2="15.5" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></g><text class="d-s" x="104" y="680" text-anchor="middle">Desk</text><g class="d-ic" transform="translate(176 626) scale(1.5)"><rect x="7" y="2.5" width="10" height="19" rx="2.2"/><line x1="11" y1="18.5" x2="13" y2="18.5"/></g><text class="d-s" x="194" y="680" text-anchor="middle">Phone</text><g class="d-ic" transform="translate(266 626) scale(1.5)"><rect x="2.5" y="7" width="19" height="13" rx="2"/><polyline points="7.5 3 12 7 16.5 3"/></g><text class="d-s" x="284" y="680" text-anchor="middle">TV</text><text class="d-s" x="194" y="708" text-anchor="middle">Our emulators run right here.</text><text class="d-s" x="194" y="727" text-anchor="middle">Keyboard, controller, touch or remote.</text><text class="d-s" x="194" y="746" text-anchor="middle">Saves and settings stay on this device.</text><rect class="d-box" x="40" y="772" width="308" height="100" rx="14"/><g class="d-ic" transform="translate(54 784) scale(0.85)"><path d="M7 3.5h10l4 5.5-9 11.5L3 9z"/><path d="M3 9h18M10 3.5 8 9l4 11.5L16 9l-2-5.5"/></g><text class="d-k" x="82" y="799">CRYSTALWORLDS.MEDIA</text><text class="d-t" x="56" y="820">The site and its emulators</text><text class="d-s" x="56" y="843">The page, emulators, box art</text><text class="d-s" x="56" y="862">and manuals.</text><path class="d-line " d="M194 772 L194 763" marker-end="url(#ftArrowT)"/></svg>' + ''
      + '<figcaption class="ft-legend"><span><i class="l-local"></i>On this device</span><span><i class="l-lan"></i>Home network</span><span><i class="l-net"></i>Internet, by vault code</span><span><i class="l-media"></i>Media server</span></figcaption></figure>'
      + '<div class="ft-tablewrap"><table class="ft-table"><caption>The ways in, side by side</caption>'
      + '<thead><tr><th scope="col">Way in</th><th scope="col">Where the files are</th><th scope="col">What you need</th><th scope="col">What it brings</th></tr></thead><tbody>'
      + '<tr><th scope="row">Play a file</th><td>On the device in your hand</td><td>Nothing: pick or drop a game file in Settings, Media and content</td><td>One game, held in memory and let go when the window closes. Its battery save stays on the device.</td></tr>'
      + '<tr><th scope="row">Game server at home</th><td>A folder on your own computer</td><td>The game server running there, and its address entered once in Settings</td><td>Your whole library on every screen in the house, with box art and the right start-up firmware for each game</td></tr>'
      + '<tr><th scope="row">Game server away from home</th><td>The same folder, at home</td><td>Your vault code</td><td>The same library anywhere online, on any screen you sign in to with your vault code</td></tr>'
      + '<tr><th scope="row">Emby or Jellyfin</th><td>Your own media server</td><td>Its address, your user name and password, or Quick Connect on Jellyfin</td><td>Your films and shows on the same wall as the games</td></tr>'
      + '</tbody></table></div>'
      + '</div>');

    /* ---------------------------------------------------------------- game servers and vault codes */
    out.push('<div class="section">' + head('feat-servers', 'Game servers and vault codes', 'One small server that is yours.', [
      'The game server is a small program you run on your own computer. Point it at your games folder and that is the whole setup. It only ever reads that folder, and it decides which screens may see which games.'])
      + tiles([
        { ic: 'server', t: 'Point it at a folder', p: ['Set a name and a PIN, choose your library folder, and press Rescan when you add games. Every game is recognised by its fingerprint, not its file name.'] },
        { ic: 'users', t: 'Profiles and permissions', p: ['Make a profile for each person in the house and share systems or kinds of games with each one. A new profile sees nothing until you share something with it.'] },
        { ic: 'shield', t: 'Every screen asks first', p: ['A new screen asks to join and you approve it with a six-character match code. Each profile has its own PIN, and a screen can be removed at any time.'] },
        { ic: 'key', t: 'Your vault code', p: ['Your vault code is made by your browser, with no account and no password. It lives in Settings, Access Code, where you can copy it, switch it, change it or add a recovery email. Approve a vault code on your server and that browser\'s screens can join by themselves, with a PIN.'] },
        { ic: 'globe', t: 'Away from home', p: ['Your vault code brings your library to you anywhere online, by itself, with no address to type.'] },
        { ic: 'link', t: 'More than one server', p: ['Join several servers and their libraries become one. The nearest and fastest answers first, and a download that is cut off carries on from another server where it stopped.'] },
      ])
      + '</div>');

    /* ---------------------------------------------------------------- which screen are you on */
    const scr = (id, k, t, p, items, sel) => '<section class="ft-screen" id="ft-scr-' + id + '" role="tabpanel" aria-labelledby="ft-tab-' + id + '"' + (sel ? '' : ' hidden') + '><h3>' + t + '</h3><p>' + p + '</p><ul>' + items.map(x => '<li>' + x + '</li>').join('') + '</ul></section>';
    out.push('<div class="section">' + head('feat-screens', 'Which screen are you on?', 'The same place, on every screen.', [
      'There is nothing to install. Open the site in a modern browser and everything here is there, laid out for the screen you are using.'])
      + '<div class="ft-tabs" role="tablist" aria-label="Choose your screen">'
      + [['desk', 'desk', 'Desk'], ['phone', 'phone', 'Phone and tablet'], ['tv', 'tv', 'TV']].map(([id, k, l], i) => '<button type="button" role="tab" id="ft-tab-' + id + '" aria-controls="ft-scr-' + id + '" aria-selected="' + (i === 0) + '" data-ft-tab="' + id + '">' + ic(IC[k]) + l + '</button>').join('')
      + '</div>'
      + scr('desk', 'desk', 'At your desk', 'A computer gets everything at once: the full wall, the play window beside its device art, and every shortcut on the keyboard.', [
        'Keyboard shortcuts on every page, with ? to list them', 'Any game controller, plugged in or wireless', 'Mouse aiming for the Zapper, paddles and the Arkanoid controller', 'Webcam for the Game Boy Camera, microphone for the Famicom', 'Save files and screenshots straight to your downloads', 'Game Boy Printer pages printed or saved as pictures'], true)
      + scr('phone', 'phone', 'On a phone or tablet', 'A phone is a handheld again: the buttons on the device art are the buttons you press, and the whole site fits in your hand.', [
        'Touch controls drawn on each device, plus a see-through pad when a game needs one', 'Rumble cartridges and the Pokémon mini buzz the phone', 'Tilt the phone for tilt games', 'Add it to your home screen like an app', 'Screenshots saved to your photos'])
      + scr('tv', 'tv', 'On the TV', 'From the sofa, the remote or a controller drives everything, with large text and a clear focus ring on whatever is selected.', [
        'Recognised as a TV by itself, or set TV mode in Settings', 'Arrows, OK and Back on the remote, plus the four colour keys', 'Controllers on the wall, in menus and in every game', 'The System Switcher on LB and RB', 'Quick jump without typing: recent places and pages are listed', 'Settings, menus and every window reachable from the remote'])
      + '</div>');

    /* ---------------------------------------------------------------- comparison table */
    const Y = '<span class="ft-yes">Yes</span>', N = '<span class="ft-no">No</span>';
    const row = (t, a, b, c) => '<tr><th scope="row">' + t + '</th><td>' + a + '</td><td>' + b + '</td><td>' + c + '</td></tr>';
    out.push('<div class="section">' + head('feat-table', 'Side by side', 'Every feature, on every screen.', [
      'The same site runs everywhere, and the differences are only the ones your screen brings with it.'])
      + '<div class="ft-tablewrap"><table class="ft-table"><thead><tr><th scope="col">Feature</th><th scope="col">Desk</th><th scope="col">Phone and tablet</th><th scope="col">TV</th></tr></thead><tbody>'
      + row('Every console and handheld', Y, Y, Y)
      + row('Saves, rewind, speed, screenshots', Y, Y, Y)
      + row('Game controllers', Y, Y, Y)
      + row('Keyboard shortcuts', Y, 'With a keyboard', 'With a keyboard')
      + row('Touch controls', 'On a touch screen', Y, N)
      + row('TV remote', N, N, Y)
      + row('Camera and microphone accessories', Y, Y, 'Where the browser allows')
      + row('Rumble and tilt', 'Rumble on a controller', Y, 'Rumble on a controller')
      + row('Films and shows from Emby or Jellyfin', Y, Y, Y)
      + row('Game servers', 'Over HTTPS', 'Over HTTPS', 'Over HTTPS')
      + row('Add to the home screen', N, Y, N)
      + '</tbody></table></div>'
      + '</div>');

    /* ---------------------------------------------------------------- and more */
    const mini = (k, t, p) => '<div tabindex="0">' + icon(k) + '<h4>' + t + '</h4><p>' + p + '</p></div>';
    out.push('<div class="section">' + head('feat-more', 'And more', 'Everything you asked for, and more.', [
      'The small things that make it feel finished.'])
      + '<div class="ft-more">'
      + mini('palette', 'Light and dark', 'A dark or light theme, and ten accent colours to choose from.')
      + mini('search', 'Quick jump', 'Search games, films, systems, pages, settings and actions from anywhere.')
      + mini('help', 'Help on every screen', 'Press ? for the keys of the screen you are on, in a game too.')
      + mini('link', 'Links that open the right thing', 'Every window, system page and game has its own address to share.')
      + mini('install', 'Add to home screen', 'Keep it on your phone\'s home screen like any other app.')
      + mini('bell', 'Quiet notices', 'Messages slide in, wait while you read them, and close with Back.')
      + mini('save', 'Saves you can carry', 'Export any save to a file and load it on another device.')
      + mini('sound', 'Silence until you play', 'Tiles and previews never make a sound. Only the game you open does.')
      + mini('variant', 'One tile per game', 'Every region and revision folded into one tile. Play opens the game on the box, and a variant plays only when you pick it.')
      + mini('clock', 'Real clocks', 'Game &amp; Watch units and the Pokémon mini start with the right time of day.')
      + mini('book', 'Manuals in the drawer', 'An open-book badge marks the games whose manual you can read.')
      + mini('shield', 'Nothing uploaded', 'A game file you play from your device never leaves it.')
      + '</div></div>');

    /* ---------------------------------------------------------------- go deeper */
    out.push('<div class="section">' + head('feat-links', 'Go deeper', 'The rest of the story.', [
      'How the emulators compare, which games run, and why we build them the way we do each have their own page.'])
      + '<div class="ft-links">'
      + go('/home', 'Home', 'Our emulators against the rest, chip by chip, with the proof.')
      + go('/compatibility', 'Compatibility', 'Every game on every system, and how it runs.')
      + go('/about', 'About', 'Why we build these machines from nothing, and who helped.')
      + '</div></div>');

    out.push('</div>');
    return out.join('');
  }

  /* ======================================================================= behaviour
     Delegated from the document, since the window's contents are drawn fresh each time it opens. */
  const inFeatures = el => el && el.closest && el.closest('#video-about .ft-page');
  function pickTab(btn, focus) {
    const page = inFeatures(btn); if (!page) return;
    page.querySelectorAll('[data-ft-tab]').forEach(b => {
      const on = b === btn;
      b.setAttribute('aria-selected', String(on));
      const pnl = page.querySelector('#' + b.getAttribute('aria-controls'));
      if (pnl) pnl.hidden = !on;
    });
    if (focus) { try { btn.focus({ preventScroll: true }); } catch (_) {} }
  }
  document.addEventListener('click', ev => {
    const t = ev.target; if (!t || !t.closest || !inFeatures(t)) return;
    const tab = t.closest('[data-ft-tab]');
    if (tab) { pickTab(tab, false); return; }
    const j = t.closest('[data-ft-jump]');
    if (j) {
      const h = inFeatures(j).querySelector('[data-ft-sec="' + j.getAttribute('data-ft-jump') + '"]');
      /* Focus first (the page's own focus handling scrolls to the nearest edge), then the heading goes to the top. */
      if (h) { try { h.focus({ preventScroll: true }); h.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); } catch (_) {} }
      return;
    }
    /* Play with R.O.B. (31 Oct): the window closes and the wall shows his system, the
       same pick as his row in the Systems menu (emby.js pickGameSystems); the focus then lands
       on his first tile for a keyboard, pad or remote (shortcuts.js landOnWall). */
    if (t.closest('[data-ft-rob]')) {
      const a = document.activeElement;
      try { if (window.CwAboutWindow) window.CwAboutWindow.close(); } catch (_) {}
      try {
        if (window.Emby && typeof window.Emby.pickGameSystems === 'function') window.Emby.pickGameSystems(['rob']);
        else if (typeof window.routeToMediaSystems === 'function') window.routeToMediaSystems(['rob']);
      } catch (e) { console.warn('[features] R.O.B. pick failed:', e); }
      try { if (window.GnwShortcuts && window.GnwShortcuts.landOnWall) window.GnwShortcuts.landOnWall(a); } catch (_) {}
      return;
    }
    const g = t.closest('[data-ft-go]');
    if (!g) return;
    ev.preventDefault();
    const to = g.getAttribute('data-ft-go');
    /* A window (Home, Compatibility, About) opens through its own button in the search bar, the
       same path as pressing that button (1 Nov 2026). route() placed the window under the
       bar and then scrolled the page to the top, which moved the bar down over the window on a
       phone ("See the scoreboard on Home" opened Home partly over the search bar). The press waits
       for this click to finish, so the click is not read as one outside the new window. "/home"
       then shows the scoreboard (#home-emulators) at the top of the window, under the bar. */
    const btn = document.getElementById(WIN_BTN[to] || '');
    if (btn && window.CwAboutWindow) {
      setTimeout(() => {
        if (!(window.CwAboutWindow.isOpen() && window.CwAboutWindow.kind() === WIN_KIND[to])) btn.click();
        if (to === '/home') requestAnimationFrame(() => showInWindow(document.getElementById('home-emulators')));
      }, 0);
      return;
    }
    if (typeof window.route === 'function') window.route(to);
  });
  const WIN_BTN = { '/home': 'video-home-btn', '/compatibility': 'video-compat-btn', '/about': 'video-about-btn' };
  const WIN_KIND = { '/home': 'home', '/compatibility': 'compat', '/about': 'about' };
  /* Scroll the window (not the page, which stays still under an open window) so el's top sits a
     little below the window's top edge. */
  function showInWindow(el) {
    if (!el) return;
    const win = document.getElementById('video-about');
    for (let p = el.parentElement; p; p = p.parentElement) {
      const oy = getComputedStyle(p).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 1) {
        p.scrollTop += el.getBoundingClientRect().top - p.getBoundingClientRect().top - 12;
        return;
      }
      if (p === win) return;
    }
  }
  /* A screen tab is chosen as soon as it is focused (arrows, Tab, a controller or a remote walk
     onto it), so the page's own arrow keys need nothing extra here. */
  document.addEventListener('focusin', ev => {
    const tab = ev.target && ev.target.closest ? ev.target.closest('[data-ft-tab]') : null;
    if (tab && inFeatures(tab) && tab.getAttribute('aria-selected') !== 'true') pickTab(tab, false);
  });

  window.CwFeatures = { html };
})();

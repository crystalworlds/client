/* ===========================================================================
 * emulation-test-carts.js: the "Test cartridges that don't start a game"
 * section of each system's Emulation tab (2026-10-22; asked for 19 Oct:
 * name the test and diagnostic cartridges that won't boot and say why).
 *
 * Plain words for visitors only (publish compatibility, never developer notes).
 * The 2600 reasons come from the Atari test report of
 * 2026-10-19; the others come from the reasons on
 * each system's not-supported list (firmware/unsupported/<system>.json).
 * drawer-unified.js puts the section after the tab's opening panel.
 * A system with no such cartridge has no entry and shows no section.
 * =========================================================================== */
var CW_TEST_CARTS = {
  atari2600: [
    ['Diagnostic Test Cartridge 2.0', "A factory test cartridge. It needs Atari's test plugs in both joystick ports. Without them it stops at its Error 6 screen, as a real console does."],
    ['Diagnostic Test Cartridge 4.2', "A factory test cartridge for Atari's own test machine, which connects to both joystick ports. Without that machine the screen stays black, on a real console too."],
    ['Video Cartridge Bicycle Trainer', "It needs ExerVision's exercise bike in the left joystick port. Without the bike it waits and shows nothing, on a real console too."],
    ['FM2 Sound Tool Demo', 'A sound tool for the keyboard controllers. It plays sound and never draws a picture.'],
    ['Zoo Keeper Sounds', 'A sound-effects test from an unfinished game. The screen stays black until you press fire, then it plays an animal sound.'],
    ['Euro Gen', 'A colour test chart for PAL TVs, not a game: one still chart of colours.'],
    ["McDonald's - Golden Arches Adventure", 'An unfinished prototype. It is only a title screen, and that still picture is all a real console shows too.'],
    ['Dungeon', 'An early build of Dark Chambers that is only a title screen. The finished Dark Chambers plays.'],
    ['Racer', 'An unfinished development build that never started on a real console. The finished Racer plays.'],
  ],
  atari7800: [
    ['Galaxian sound tests, Kung-Fu Master sound tests, Arkanoid music tests, Bubble Bobble Theme Sound Demo', 'Programs made while these games were written, to try out their sound and music. They draw no picture.'],
    ['Mario Bros test programs', 'Programs made while the game was written, to try out parts of it. They draw no picture.'],
  ],
  atari5200: [
    ['altfirmware-2.50-test26', 'A test build of replacement console firmware, not a cartridge. No 5200 cartridge board has its size, so it will not load.'],
  ],
  atarilynx: [
    ['flappy_test', 'A test build made for an SD-card cartridge, which the emulator does not have yet. It shows nothing.'],
  ],
  gb: [
    ['CGB Test Cartridge', 'This copy of the file is damaged (the [b] in its name marks a bad copy), so it shows nothing.'],
    ['Peugeot - Orbital Diagnostic System', "A garage tool for Peugeot cars, not a game. It was made to be plugged into a car's diagnostic socket, and without one it goes no further than its first screen."],
  ],
  nes: [
    ['Sounds, Testing 1 Buzzing Demo, Testing 2 Buzzing Demo', 'Sound programs. They draw no picture.'],
  ],
};
CW_TEST_CARTS.gbc = CW_TEST_CARTS.gb;

/* The section for one drawer, or '' when its system has none. */
function testCartsSectionHTML(d) {
  var k = !d ? '' : d.catalogue === 'game-boy' ? 'gb' : d.catalogue === 'nes' ? 'nes' : d.catalogue || '';
  var rows = CW_TEST_CARTS[k];
  if (!rows || !rows.length) return '';
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var li = rows.map(function (r) { return '<li><b>' + esc(r[0]) + '</b>: ' + esc(r[1]) + '</li>'; }).join('');
  return '<section class="sect" id="testcarts-' + k + '"><h3 class="sect-h">Test cartridges that don’t start a game</h3>' +
    '<p>These cartridges are in the library, but they are not games, or they need equipment a player doesn’t have. This is why each one won’t start a game:</p>' +
    '<ul>' + li + '</ul></section>';
}

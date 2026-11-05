/* play/atarilynx/turned.js — WHICH LYNX CARTRIDGES ARE PLAYED ON THEIR SIDE.
 *
 * ONE LIST, TWO READERS. index.html reads it to give a turned title the one-
 * column portrait tile and the turned photograph (2026-10-07: "two
 * different tiles for the Atari Lynx dependent on how their games run");
 * play/atarilynx/app.js reads it as step 3 of its rotation order (a visitor's
 * own choice, then the cartridge header, then this list, then upright). A plain
 * script setting a global, so the host page — a classic script — and the play
 * page — a module — load the same file and cannot disagree.
 *
 * KEYED BY CONTENT, NEVER BY NAME: the first 12 hex of the cartridge file's
 * SHA-256, the same 12 every Lynx id carries ('alynx-x' + 12), so a tile is
 * looked up from its id with no hashing. 1 = turned left (-90deg), 2 = turned
 * right (+90deg), lynx_rotation's numbering. The name after each entry is the
 * file it was measured from, a comment only.
 *
 * TWO SOURCES, and each entry says which:
 *   list    the development tree's own TURNED table (web/shelllynx.js: from
 *           the ladder runs, the dumps carry no header, so nothing
 *           else says so). Raw dumps: there is no header byte to read.
 *   header  the .lnx header's rotation byte (offset 58; the core's
 *           lynx_rotation, cart.c) read from the file itself. The play page
 *           reads that byte at load anyway; it is listed here only because a
 *           TILE is drawn before any cartridge bytes are fetched.
 * Scanned 2026-10-07: every .lnx/.lyx/.o/.bin inside the zips under
 * a local Lynx collection: 1,621 files, 983 distinct by SHA-256,
 * 499 of those headered; 23 distinct files turn (2 list, 21 header; 20 left,
 * 3 right). A dump of a turned game that is headerless and not in that
 * list is NOT here and draws upright until its turn is measured; no title is
 * guessed from its name.
 *   twin    added 2026-10-11: a dump with no header,
 *           or a header whose rotation byte is 0, whose cartridge image is
 *           byte for byte the body of a headered file that says turned. Raiden:
 *           the raw dump 388b9f0619716f97 and the body of Raiden (NA, Rev 3)
 *           (header rotation 0) both equal the body of Raiden (1997)(Atari
 *           Corp).lnx (header rotation 2). Each checked by a picture on the
 *           play page, and the picture overrules that header: turned right
 *           (2) the title screen is upside down, turned left (1) it is
 *           upright (Gauntlet and Klax, 2, are upright). So both are 1. The
 *           headered 1997 file still turns by its header (2) and shows
 *           upside down (checked by picture).
 *
 * A manifest entry may also carry `r` (1|2) for a title built after this list;
 * index.html takes that first. */
(function (g) {
  'use strict';
  g.LYNX_TURNED = Object.freeze({
    '35fa4af0100f': 2,   // list   Gauntlet - The Third Encounter (USA, Europe), 131,072 B
    '3bcadd8ef0f1': 2,   // list   Klax (USA, Europe), 262,144 B
    '55097a6558eb': 1,   // header Raiden (1997)(Atari Corp).lnx, 262,208 B; its header says 2, which is wrong (LYNX_HEADER_WRONG)
    '388b9f061971': 1,   // twin   Raiden (USA) (v3.0) raw (also its Proto and CES Release 3 .lyx), 262,144 B
    '27f458ad8933': 1,   // twin   Raiden (NA, Rev 3).lnx (header rotation 0), 262,208 B
    '3d0f26bed126': 1,   // header Fishing for Atari (2019)(Dr Ludos), 262,208 B
    'f6a9ff9985d1': 2,   // PICTURE 2026-10-15: turns 2, not 1; was: header Flappy Bird (2017)(Tonma), 32,111 B
    '32aacfeac12f': 2,   // PICTURE 2026-10-15: turns 2, not 1; was: header flappy.lnx, 31,985 B
    'dcd0fb21d5e7': 2,   // SIBLINGS 2026-10-17: turns 2 like every other Flappy build of the same header (all say 1, all turn 2 by picture); its own picture is blank (SD-card cartridge not emulated), so no picture can decide; was: header flappy_test.lnx, 33,426 B
    '990d89bb0613': 2,   // PICTURE 2026-10-15: turns 2, not 1; was: header flappyee.lnx, 31,260 B
    'eb2a7f6e05e2': 2,   // PICTURE 2026-10-15: turns 2, not 1; was: header flappylynx.lnx, 22,096 B
    'af15857b90bf': 2,   // PICTURE 2026-10-15: turns 2, not 1; was: header flappyv002.lnx, 23,844 B
    'be147d6f1c58': 2,   // PICTURE 2026-10-15: turns 2, not 1; was: header flapsfx.lnx, 22,375 B
    'cf42d2a40bc0': 2,   // PICTURE 2026-10-15: turns 2, not 1; was: header flapsfx2.lnx, 22,276 B
    '48c2562fba7e': 2,   // PICTURE 2026-10-15: turns 2, not 1; was: header flapvert.lnx, 18,295 B
    '16d61942d67f': 1,   // header flapvert2.lnx, 31,695 B
    '251804db2e2c': 1,   // header flapvert3.lnx, 21,409 B
    '80fe9ebb95a0': 2,   // PICTURE 2026-10-15: turns 2, not 1; was: header flapvert5b.lnx, 21,319 B
    'a1e3f0943eb5': 1,   // header flayy bird demo vertical bad.lnx, 29,720 B
    'eba41a4ebb3b': 1,   // header game.lnx, 31,360 B
    'e89f45516ca0': 2,   // PICTURE 2026-10-15: turns 2, not 1; was: header Gift Catcher (2020)(Dr Ludos), 26,615 B
    'bf1af6d73cf4': 2,   // PICTURE 2026-10-15: turns 2, not 1; was: header GiftCatcher.lnx, 262,208 B
    '073ee1d9fc77': 2,   // PICTURE 2026-10-15: turns 2, not 1; was: header pong.lnx, 31,985 B
    '63982f709fe5': 1,   // header SLIDE256.lnx, 262,208 B
    '15d5f6e4727a': 2,   // PICTURE 2026-10-15: turns 2, not 1; was: header soundtest.lnx, 21,891 B
    /* ADDED 2026-10-15 BY PICTURE: each file run on the served core and its first
     * screens drawn turned left and turned right; the value is the way that reads upright. The .lnx
     * header's rotation byte disagreed with the picture in 23 of 25 headered files checked, both ways
     * (1 for 2 and 2 for 1), so neither the header nor the variants group (whose name-rule groups
     * also join unrelated homebrews, e.g. 'pong') can derive a turn: pictures made by
     * tools/turnpics.mjs. */
    'c5acb2ca6415': 2,   // picture  Gift Catcher (representative)
    '155ee3d735ab': 2,   // picture  Gauntlet: The Third Encounter (representative, headered)
    '92e391bb0394': 2,   // picture  Klax (headered)
    'f30d037a2bc7': 2,   // picture  Gauntlet 4-6-90 (prototype, its own group representative)
    '21a83624a636': 2,   // picture  Gauntlet: The Third Encounter
    '0a22e195438c': 2,   // picture  Gauntlet: The Third Encounter
    'd72773874e48': 2,   // picture  Gauntlet: The Third Encounter
    'ab61cf96743f': 2,   // picture  Klax
    'd2293958e763': 2,   // picture  KLAX prototype
    'eb933ccad571': 2,   // picture  Klax
    'f1a09d561cb2': 1,   // picture  Raiden (representative)
    'c2b2c4d41032': 1,   // picture  Centipede
    'fdc4bfc903c4': 1,   // picture  Lexis
    '429df78a4ea8': 1,   // picture  NFL Football
    '93a3d97144ba': 1,   // picture  CSS - Traffic Regulation (representative)
    '75884f6287dc': 1,   // picture  Silly Archery (representative)
    '400c2dbd6468': 1,   // picture  Raiden
    '485ac3ffec01': 1,   // picture  Centipede (header 1, correct)
    'a664f33bb3ec': 1,   // picture  Centipede
    '83ed32144e92': 1,   // picture  Centipede
    '1698e32c4be2': 1,   // picture  Centipede
    'f306cdccd5b1': 1,   // picture  Lexis (header 1, correct)
    '2adfd5b62f63': 1,   // picture  Lexis
    '90b84ce6afb6': 1,   // picture  Lexis
    'b7db00a13fd8': 1,   // picture  Lexis
    '04ae8952ed05': 1,   // picture  NFL Football
    'e8104cd0f46d': 1,   // picture  NFL Football
    'ffde9698b3f6': 1,   // picture  Fishing for Atari (representative; header 1 kept, a face-to-face two-player picture with no single upright)
  });
  /* HEADERS THAT ARE WRONG: cartridges whose .lnx header carries a rotation that
   * shows the game turned the wrong way. The page takes this BEFORE the header
   * (and the visitor's own choice still first). Raiden (1997): the header says 2,
   * the game's own picture needs 1, the same as its raw and Rev 3 twins (checked
   * by picture, 2026-10-11). */
  g.LYNX_HEADER_WRONG = Object.freeze({
    '55097a6558eb': 1,
    '073ee1d9fc77': 2,   // PICTURE 2026-10-15: header says 1  
    '15d5f6e4727a': 2,   // PICTURE 2026-10-15: header says 1  
    '32aacfeac12f': 2,   // PICTURE 2026-10-15: header says 1  
    '80fe9ebb95a0': 2,   // PICTURE 2026-10-15: header says 1  
    '990d89bb0613': 2,   // PICTURE 2026-10-15: header says 1  
    'af15857b90bf': 2,   // PICTURE 2026-10-15: header says 1  
    'be147d6f1c58': 2,   // PICTURE 2026-10-15: header says 1  
    'dcd0fb21d5e7': 2,   // SIBLINGS 2026-10-17: header says 1, like its Flappy siblings, which all turn 2
    'bf1af6d73cf4': 2,   // PICTURE 2026-10-15: header says 1  
    'cf42d2a40bc0': 2,   // PICTURE 2026-10-15: header says 1  
    'e89f45516ca0': 2,   // PICTURE 2026-10-15: header says 1  
    'eb2a7f6e05e2': 2,   // PICTURE 2026-10-15: header says 1  
    'f6a9ff9985d1': 2,   // PICTURE 2026-10-15: header says 1  
    '48c2562fba7e': 2,   // PICTURE 2026-10-15: header says 1  
    'c5acb2ca6415': 2,   // PICTURE 2026-10-15: header says 1  Gift Catcher (representative)
    '155ee3d735ab': 2,   // PICTURE 2026-10-15: header says 1  Gauntlet: The Third Encounter (representative, headered)
    '92e391bb0394': 2,   // PICTURE 2026-10-15: header says 1  Klax (headered)
    'f1a09d561cb2': 1,   // PICTURE 2026-10-15: header says 2  Raiden (representative)
    'c2b2c4d41032': 1,   // PICTURE 2026-10-15: header says 2  Centipede
    'fdc4bfc903c4': 1,   // PICTURE 2026-10-15: header says 2  Lexis
    '429df78a4ea8': 1,   // PICTURE 2026-10-15: header says 2  NFL Football
    '93a3d97144ba': 1,   // PICTURE 2026-10-15: header says 2  CSS - Traffic Regulation (representative)
    '75884f6287dc': 1,   // PICTURE 2026-10-15: header says 2  Silly Archery (representative)
  });
  /* The turn for a site id ('alynx-x' + 12 hex), or 0. */
  g.lynxTurnOf = function (id) {
    const m = /^alynx-x([0-9a-f]{12})$/.exec(String(id || ''));
    return (m && g.LYNX_TURNED[m[1]]) || 0;
  };
})(typeof window !== 'undefined' ? window : self);

/*
 * compat.js -- the compatibility list (2026-10-21).
 *
 * WHAT. Every game we have run on our emulators, every system, in one sortable list: cover, clip,
 * title (its versions as sub-items), game ID, region flags, system, kind of game, status (Plays /
 * Boots / Nothing, the reason when it does not play), the date it was last tested, and the file's
 * SHA-256. Filters: name (also a game ID or the start of a hash), status, system and kind. Above the
 * list, the same bar as the home page's emulator cards, with the share of each status.
 *
 * WHERE. It opens in the Media page's window under the search bar, like About and Timeline (emby.js
 * aboutSet, kind 'compat'): emby.js asks CompatList.html() for the window's markup and calls
 * CompatList.mount(window) once it is in the page. The page behind is inert while it is open, a click
 * outside closes it, Back closes it (emby.js). Nothing here is reached any other way.
 *
 * DATA. firmware/compat/list-index.json and list-<card>.json.gz, written by
 * tools/compat-ladder/build.mjs (lists.mjs) from the same games and rungs as the home cards, so the
 * bar here and the cards there always agree; the builder refuses when they would not. Tests ("Testing
 * and diagnostics") are listed and can be filtered, but are not counted (decided 21 Oct 2026).
 *
 * IDEAS TAKEN (from the RPCS3, shadPS4, PCSX2 and Dolphin lists, and rpcs4.com; ideas only,
 * the look is the site's own): RPCS3's status bar with the share of each status, which also filters
 * when pressed (it answers "how much works" before any reading); the Game ID / serial column of RPCS3
 * and PCSX2 (how players identify a release); PCSX2's region column; the "last tested" date of RPCS3
 * and shadPS4 (how old the verdict is); shadPS4's cover art per row. Versions as sub-rows are ours
 * (the site groups versions the same way on its tiles).
 *
 * SPEED. Big lists (the NES family has about 3,000 games) are drawn as a window of rows: only the rows
 * on screen (plus a margin) exist in the page; covers load as their rows appear; a clip plays only
 * for the focused row (focus, never hover: a TV browser has no hover), muted. Sound: none, ever.
 *
 * KEYS. Up/Down move through the rows (PageUp/PageDown, Home/End), Right opens a game's versions,
 * Left closes them or goes to the game's row; Enter/OK (or the clip) shows the clip larger. The list never opens
 * a drawer or starts a game (24 Oct). In the controls above, the
 * arrows move by position. The list is role="treegrid", which nav.js leaves to us.
 */
(function () {
  'use strict';
  if (window.CompatList) return;

  const VERSION = '2.1.1';
  const BASE = 'firmware/compat/';
  /* Status 4 (28 Oct 2026): a known release (No-Intro) that has not been found, so it has never been
     tested. Listed and filterable, never counted: not in the bar, its percentages or "games tested". */
  const STATUS = ['Plays', 'Boots', 'Nothing', 'Not yet tested', 'Untested / not found'];
  const STATUS_KEY = ['plays', 'boots', 'nothing', 'untested', 'notfound'];
  const STATUS_TEXT = [
    'The game plays on our emulator.',
    'The game starts on our emulator but does not play: the screen stays blank, freezes, or stops at its title.',
    'The game does not start on our emulator.',
    '',
    'A known release that has not been found, so it has not been tested. Listed, not counted.',
  ];
  const KIND = { commercial: 'Commercial', unl: 'Unlicensed and pirate', homebrew: 'Homebrew and public domain', hack: 'Hacks and translations', proto: 'Prototypes and betas', demo: 'Demos and samples', test: 'Testing and diagnostics' };
  const KIND_SHORT = { commercial: 'Commercial', unl: 'Unlicensed', homebrew: 'Homebrew', hack: 'Hack', proto: 'Prototype', demo: 'Demo', test: 'Test' };
  const KIND_ORDER = ['commercial', 'unl', 'homebrew', 'hack', 'proto', 'demo', 'test'];
  /* The home cards (emulators-table.js CARDS): the system filter picks one card, so the bar shows
     exactly that card's numbers. */
  const CARDS = [
    ['gnw', 'Game & Watch', ['gnw']], ['tft', 'Game & Watch colour', ['tft']], ['gb', 'Game Boy, Color and Super Game Boy', ['gb', 'gbc', 'sgb']],
    ['nes', 'NES, Famicom and Disk System', ['nes', 'famicom', 'fds']], ['pm', 'Pokémon mini', ['pm']], ['tj', 'Tetris Jr.', ['tj']],
    ['a2600', 'Atari 2600', ['atari2600']], ['a5200', 'Atari 5200', ['atari5200']], ['a7800', 'Atari 7800', ['atari7800']], ['alynx', 'Atari Lynx', ['atarilynx']],
  ];
  const SHELF_LABEL = { gnw: 'Game & Watch', tft: 'Game & Watch colour', tj: 'Tetris Jr.', gb: 'Game Boy', gbc: 'Game Boy Color', sgb: 'Super Game Boy', nes: 'NES', famicom: 'Famicom', fds: 'Disk System', pm: 'Pokémon mini', atari2600: 'Atari 2600', atari5200: 'Atari 5200', atari7800: 'Atari 7800', atarilynx: 'Atari Lynx' };

  /* ART AND CLIPS: the buckets and names the tiles use (emby.js GB_ART_BASE, GBC_ART_BASE,
     NES_ART_SHELVES, PM_ART_BASE, ATARI_ART_BASES; gbvideo.js BASE; nesvideo.js BASE / FDS_BASE;
     atarivideo.js BASES). The file's `art` is the object name: SHA-1 (Game Boy), the clip id of the
     group's representative (NES family, Atari), the catalogue id (Pokemon mini), the device art key
     (Game & Watch, through the page's own imgSrc). A miss is remembered for this page load only. */
  const R2 = s => 'https://pub-' + s + '.r2.dev/';
  const COVER = {
    /* gb-covers-2d (28 Oct: was the gone gameboy-covers-2d, cb974..., which answers 401), gbc-covers-2d */
    gb: [R2('7bac68f21888416fb5ee42bfaf371e77'), R2('ab3708bbc6714c41a7e8d73418133064')],
    gbc: [R2('ab3708bbc6714c41a7e8d73418133064'), R2('7bac68f21888416fb5ee42bfaf371e77')],
    /* Super Game Boy: the same cartridge's Game Boy / Color covers (sgb-covers-2d no longer read, 28 Oct) */
    sgb: [R2('7bac68f21888416fb5ee42bfaf371e77'), R2('ab3708bbc6714c41a7e8d73418133064')],
    nes: [R2('fa0fac80b3c14d358007e922389cdcd0'), R2('ddbcec209bb34b41807958a690510c73'), R2('e2f49984356242a2a8d1093ec71767ce')],
    famicom: [R2('ddbcec209bb34b41807958a690510c73'), R2('fa0fac80b3c14d358007e922389cdcd0'), R2('e2f49984356242a2a8d1093ec71767ce')],
    fds: [R2('e2f49984356242a2a8d1093ec71767ce'), R2('fa0fac80b3c14d358007e922389cdcd0'), R2('ddbcec209bb34b41807958a690510c73')],
    pm: [R2('eee982432b794252aea6267b28610d68')],
    atari2600: [R2('5a6bb80d82784ad39e3c174bef3c277f')], atari5200: [R2('c75c6bbea160407d91b051774522eb4c')],
    atari7800: [R2('0e40e9ded6d040ffb50e8e6c90a7c6f4')], atarilynx: [R2('6a52666460d64b4a8b732cfc2d1ca0ee')],
  };
  const CLIP = {
    gb: [R2('b1cac080319747d4a79d4d5607505a33'), R2('38743c0e5f494a10ae96bd434893fa89')],
    gbc: [R2('38743c0e5f494a10ae96bd434893fa89'), R2('b1cac080319747d4a79d4d5607505a33')],
    sgb: [R2('0b705276a1924b02b00ff5cd10042fc8')],   // sgb-clips, the Super Game Boy picture
    nes: [R2('476344a7e9a34219a007a6563f3a74d3')], famicom: [R2('476344a7e9a34219a007a6563f3a74d3')], fds: [R2('dc08459511ce4d21bffd471892e52459')],
    atari2600: [R2('b06c91c6666e4da3ae82bd1fa1d3e503')], atari5200: [R2('91771962e9ff4dc5b2447e994aa567d3')],
    atari7800: [R2('c86bedebfec5473681f448fb09f7bec4')], atarilynx: [R2('69281f85c5894f8aa71dd2225e83c8e5')],
    /* Game & Watch, the colour units, Tetris Jr. (gnw-clips) and Pokemon mini (pm-clips): made for this
       list only (21 Oct); the Media tiles keep their live clocks. A Pokemon mini file with no
       catalogue id is named pm-x<first 12 hex of its SHA-256>. */
    gnw: [R2('308330d7708446e8b69648ea73fe08f6')], tft: [R2('308330d7708446e8b69648ea73fe08f6')], tj: [R2('308330d7708446e8b69648ea73fe08f6')],
    pm: [R2('96ab6a6c9d1a49bbbb00cb86709f5cb6')],
  };
  const DEVICE_ART = new Set(['gnw', 'tft', 'tj']);
  const urlOk = new Map();   // url -> true (loaded) | false (missed), this page load
  /* The tiles' chain: our bucket(s) first, then the second source (gamemeta.js: libretro's thumbnails,
     named by the file's No-Intro name). Game & Watch, the colour units and Tetris Jr.: the site's own box
     art (index.html BOX_ART_IMAGES, the Box Art mode's pictures), keyed by the device id. */
  const LR = { gb: 'Nintendo - Game Boy', gbc: 'Nintendo - Game Boy Color', sgb: 'Nintendo - Game Boy', nes: 'Nintendo - Nintendo Entertainment System', famicom: 'Nintendo - Nintendo Entertainment System',
    fds: 'Nintendo - Family Computer Disk System', pm: 'Nintendo - Pokemon Mini', atari2600: 'Atari - 2600', atari5200: 'Atari - 5200', atari7800: 'Atari - 7800', atarilynx: 'Atari - Lynx' };
  function coverUrls(shelf, art, name) {
    if (DEVICE_ART.has(shelf)) {
      try {
        const key = (typeof BOX_ART_IMAGES !== 'undefined' && BOX_ART_IMAGES[art]) || '';   // eslint-disable-line no-undef
        const u = key && typeof window.imgSrc === 'function' ? window.imgSrc(key) : '';
        return u ? [u] : [];
      } catch (_) { return []; }
    }
    const out = art ? (COVER[shelf] || []).map(b => b + art + '.png') : [];
    try { if (name && LR[shelf] && window.GameMeta && GameMeta.thumbUrl && !(GameMeta.refusedArt && GameMeta.refusedArt(LR[shelf], name))) out.push(GameMeta.thumbUrl(LR[shelf], name)); } catch (_) {}
    return out;
  }
  const clipUrls = (shelf, art, sha) => {
    const id = art || (shelf === 'pm' && sha ? 'pm-x' + sha.slice(0, 12) : '');
    return id && CLIP[shelf] ? CLIP[shelf].map(b => b + id + '.webm') : [];
  };

  /* REGION FLAGS: small inline drawings (Windows shows no flag emoji), the name beside or in the tip. */
  const REGION = { WO: 'World', US: 'USA', EU: 'Europe', JP: 'Japan', AU: 'Australia', DE: 'Germany', FR: 'France', ES: 'Spain', IT: 'Italy', NL: 'Netherlands', SE: 'Sweden', KR: 'Korea', CN: 'China', TW: 'Taiwan', HK: 'Hong Kong', AS: 'Asia', BR: 'Brazil', CA: 'Canada', GB: 'United Kingdom', RU: 'Russia', SC: 'Scandinavia', DK: 'Denmark', FI: 'Finland', NO: 'Norway', PT: 'Portugal', GR: 'Greece', PL: 'Poland', MX: 'Mexico', AR: 'Argentina', BE: 'Belgium', AT: 'Austria', CH: 'Switzerland', NZ: 'New Zealand' };
  const H3 = (a, b, c) => `<rect width="18" height="4" fill="${a}"/><rect y="4" width="18" height="4" fill="${b}"/><rect y="8" width="18" height="4" fill="${c}"/>`;
  const V3 = (a, b, c) => `<rect width="6" height="12" fill="${a}"/><rect x="6" width="6" height="12" fill="${b}"/><rect x="12" width="6" height="12" fill="${c}"/>`;
  const NORDIC = (bg, c1, c2) => `<rect width="18" height="12" fill="${bg}"/><rect x="5" width="3" height="12" fill="${c1}"/><rect y="4.5" width="18" height="3" fill="${c1}"/>${c2 ? `<rect x="5.8" width="1.4" height="12" fill="${c2}"/><rect y="5.3" width="18" height="1.4" fill="${c2}"/>` : ''}`;
  const UNION = (w, h) => `<g transform="scale(${w / 18} ${h / 12})"><rect width="18" height="12" fill="#012169"/><path d="M0 0L18 12M18 0L0 12" stroke="#fff" stroke-width="2.4"/><path d="M0 0L18 12M18 0L0 12" stroke="#c8102e" stroke-width="0.9"/><path d="M9 0V12M0 6H18" stroke="#fff" stroke-width="3.6"/><path d="M9 0V12M0 6H18" stroke="#c8102e" stroke-width="2"/></g>`;
  const STARS = (pts, c) => pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join('');
  const GLOBE = c => `<rect width="18" height="12" fill="#1d4f7a"/><circle cx="9" cy="6" r="4.6" fill="none" stroke="${c}" stroke-width="0.9"/><ellipse cx="9" cy="6" rx="2" ry="4.6" fill="none" stroke="${c}" stroke-width="0.8"/><path d="M4.4 6H13.6M5.2 3.6H12.8M5.2 8.4H12.8" stroke="${c}" stroke-width="0.7"/>`;
  const FLAG = {
    WO: GLOBE('#cfe8ff'), AS: GLOBE('#ffe08a'),
    US: `<rect width="18" height="12" fill="#fff"/>${[0, 2, 4, 6, 8, 10].map(i => `<rect y="${i * 12 / 13 * 1.0833}" width="18" height="0.95" fill="#b22234"/>`).join('')}<rect width="8" height="6.4" fill="#3c3b6e"/>${STARS([[2, 1.6, .45], [4, 1.6, .45], [6, 1.6, .45], [3, 3.2, .45], [5, 3.2, .45], [2, 4.8, .45], [4, 4.8, .45], [6, 4.8, .45]], '#fff')}`,
    EU: `<rect width="18" height="12" fill="#003399"/>${Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<circle cx="${(9 + 3.6 * Math.sin(a)).toFixed(2)}" cy="${(6 - 3.6 * Math.cos(a)).toFixed(2)}" r="0.55" fill="#ffcc00"/>`; }).join('')}`,
    JP: `<rect width="18" height="12" fill="#fff"/><circle cx="9" cy="6" r="3.4" fill="#bc002d"/>`,
    AU: `<rect width="18" height="12" fill="#012169"/>${UNION(9, 6)}${STARS([[4.5, 9.2, 1.1], [13.5, 2.6, .6], [11.6, 5.6, .6], [15.4, 5, .6], [13.5, 9.6, .7]], '#fff')}`,
    NZ: `<rect width="18" height="12" fill="#012169"/>${UNION(9, 6)}${STARS([[13.5, 2.6, .7], [11.8, 5.8, .7], [15, 5.4, .6], [13.5, 9.4, .8]], '#c8102e')}`,
    GB: UNION(18, 12),
    DE: H3('#000', '#dd0000', '#ffce00'), RU: H3('#fff', '#0039a6', '#d52b1e'), NL: H3('#ae1c28', '#fff', '#21468b'), AT: H3('#ed2939', '#fff', '#ed2939'), AR: H3('#74acdf', '#fff', '#74acdf'),
    FR: V3('#002395', '#fff', '#ed2939'), IT: V3('#009246', '#fff', '#ce2b37'), BE: V3('#000', '#fae042', '#ed2939'), MX: V3('#006847', '#fff', '#ce1126'),
    ES: `<rect width="18" height="12" fill="#aa151b"/><rect y="3" width="18" height="6" fill="#f1bf00"/>`,
    PL: `<rect width="18" height="6" fill="#fff"/><rect y="6" width="18" height="6" fill="#dc143c"/>`,
    SE: NORDIC('#006aa7', '#fecc00'), DK: NORDIC('#c8102e', '#fff'), FI: NORDIC('#fff', '#002f6c'), NO: NORDIC('#ba0c2f', '#fff', '#00205b'), SC: NORDIC('#5b6b7c', '#e8e8e8'),
    CH: `<rect width="18" height="12" fill="#da291c"/><rect x="7.8" y="2.5" width="2.4" height="7" fill="#fff"/><rect x="5.5" y="4.8" width="7" height="2.4" fill="#fff"/>`,
    KR: `<rect width="18" height="12" fill="#fff"/><path d="M9 3a3 3 0 0 1 0 6z" fill="#0047a0"/><path d="M9 3a3 3 0 0 0 0 6z" fill="#cd2e3a"/><circle cx="9" cy="4.5" r="1.5" fill="#cd2e3a"/><circle cx="9" cy="7.5" r="1.5" fill="#0047a0"/>`,
    CN: `<rect width="18" height="12" fill="#de2910"/>${STARS([[3.4, 3.2, 1.3], [6.2, 1.4, .45], [7.2, 2.8, .45], [7.2, 4.4, .45], [6.2, 5.6, .45]], '#ffde00')}`,
    TW: `<rect width="18" height="12" fill="#fe0000"/><rect width="9" height="6" fill="#000095"/><circle cx="4.5" cy="3" r="1.7" fill="#fff"/>`,
    HK: `<rect width="18" height="12" fill="#de2910"/><circle cx="9" cy="6" r="2.6" fill="#fff"/><circle cx="9" cy="6" r="1.1" fill="#de2910"/>`,
    BR: `<rect width="18" height="12" fill="#009c3b"/><path d="M9 1.4L16.4 6 9 10.6 1.6 6z" fill="#ffdf00"/><circle cx="9" cy="6" r="2.5" fill="#002776"/>`,
    CA: `<rect width="18" height="12" fill="#fff"/><rect width="4.5" height="12" fill="#d52b1e"/><rect x="13.5" width="4.5" height="12" fill="#d52b1e"/><path d="M9 2.6l1 1.9 1.4-.4-.5 2.3 1.3.1-2.6 2.2.2 1.1H8.2l.2-1.1-2.6-2.2 1.3-.1-.5-2.3 1.4.4z" fill="#d52b1e"/>`,
    PT: `<rect width="18" height="12" fill="#ff0000"/><rect width="7" height="12" fill="#006600"/><circle cx="7" cy="6" r="2.2" fill="#ffcc00"/>`,
    GR: `<rect width="18" height="12" fill="#0d5eaf"/>${[1, 3, 5, 7].map(i => `<rect y="${i * 12 / 9}" width="18" height="${12 / 9}" fill="#fff"/>`).join('')}<rect width="6.7" height="6.7" fill="#0d5eaf"/><rect x="2.7" width="1.3" height="6.7" fill="#fff"/><rect y="2.7" width="6.7" height="1.3" fill="#fff"/>`,
  };
  const flagSvg = c => `<svg class="cl-flag" viewBox="0 0 18 12" width="18" height="12" aria-hidden="true" focusable="false">${FLAG[c] || `<rect width="18" height="12" fill="#3a4250"/><text x="9" y="8.6" font-size="6" text-anchor="middle" fill="#e7ecf2" font-family="sans-serif">${c}</text>`}</svg>`;
  function regionHTML(codes) {
    if (!codes) return '';
    const cs = codes.split(',').filter(Boolean);
    const names = cs.map(c => REGION[c] || c);
    const label = names.join(', ');
    return `<span class="cl-reg" title="${esc(label)}">${cs.slice(0, 4).map(flagSvg).join('')}<span class="${cs.length === 1 ? 'cl-reg-t' : 'cl-sr'}">${esc(cs.length === 1 ? names[0] : label)}</span></span>`;
  }

  /* ------------------------------------------------------------------ helpers */
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const n = x => Number(x).toLocaleString('en-AU');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = s => { const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(s || ''); return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : ''; };
  const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  /* Quote marks and punctuation (28 Oct), the same rule as the Media search in
     emby.js (see _QUOTES there): quote marks and apostrophes, straight or curly, are dropped and
     other punctuation is read as a space, as nothing inside a word ("pacman", "qbert"), and with
     the apostrophes as spaces. A game matches when one reading of the search is found, from the
     start of a word, in one reading of its title or file name; the old rule still matches all it did. */
  const _QUOTES = /['"`´‘-‟′-‷ʻʼ«»‹›]/g;
  const _punctForms = s => { const f = fold(s), a = f.replace(_QUOTES, ''); return [a.replace(/[^a-z0-9]+/g, ' ').trim(), a.replace(/([a-z0-9])[^a-z0-9\s]+(?=[a-z0-9])/g, '$1').replace(/[^a-z0-9]+/g, ' ').trim(), f.replace(/[^a-z0-9]+/g, ' ').trim()]; };
  const _punctHay = s => ' ' + _punctForms(s).join(' | ');
  let _qp = [];   // the current search's readings, set by rebuild()
  const _punctHit = h => _qp.some(x => h.includes(' ' + x));
  /* THE SAME ORDER AND "ALSO CALLED" AS THE MEDIA SEARCH (2 Nov; emby.js gameSearchMatches,
     _nameTier and _searchCue). Words: a game also matches when every typed word is found in its
     title's words ("zelda dx"), or in a file's name without its brackets. Order: names that are
     the search (spaces and punctuation not counted: "Mega Man" is "Megaman"), then names that
     start with it, then the rest in the list's own order. A game found only by a file named
     another way (its other-region title: Super Contra, Rockman, Akumajou Dracula), or with a file
     whose name is closer to the search (Famicom "Galaga" under "Galaga - Demons of Death"), says
     so under its title, "Also called ...", and ranks by that name. Only files of the game's own
     kind give it another name: a hack or pirate copy's name is not one (as Variants.searchAka). */
  const _wordsOf = t => String(t == null ? '' : t).replace(_QUOTES, '').replace(/[^a-z0-9]+/g, ' ').trim();
  let _qw = [], _q0 = [];   // the search's words and its readings without spaces, set by rebuild()
  const _wordHit = w => _qw.length > 0 && _qw.every(x => w.includes(x));
  const _tierForms = s => _punctForms(s).map(x => x.replace(/ /g, ''));
  function nameTier(r) {   // r: a name's _tierForms
    if (!_q0.length) return 2;
    if (r.some(x => _q0.includes(x))) return 0;
    if (r.some(x => _q0.some(q => x.startsWith(q)))) return 1;
    return 2;
  }
  /* A file's name without its (region) and [dump] tags, folded once per file when first searched. */
  function fileBase(x) {
    if (!x.b) { const b = String(x.name || '').replace(/\s*[([].*$/, '').trim(); x.b = { t: b, q: fold(b), p: _punctHay(b), w: ' ' + _wordsOf(fold(b)) + ' ', r: _tierForms(b) }; }
    return x.b;
  }
  const baseHit = (b, q) => b.q.includes(q) || _punctHit(b.p) || _wordHit(b.w);
  /* The game's other release titles (3 Nov, the list's 7th game field; as Variants.searchAka): "Super
     Contra" finds the NES row Super C. Folded once per game when first searched. */
  function akaForms(g) {
    if (!g.ak) g.ak = (g.a || []).map(t => { const b = fold(t); return { t, q: b, p: _punctHay(t), w: ' ' + _wordsOf(b) + ' ', r: _tierForms(t) }; });
    return g.ak;
  }
  const akaHit = (g, q) => !!g.a && akaForms(g).some(b => baseHit(b, q));
  /* -> { t: tier, aka: '' or the other name } for a game the search found. */
  function searchRank(g, q) {
    if (!g.tr) g.tr = _tierForms(g.t);
    const own = nameTier(g.tr), self = g.q.includes(q) || _punctHit(g.p) || _wordHit(gWords(g));
    if (self && own === 0) return { t: 0, aka: '' };
    let best = null;
    for (const x of g.f) {
      if (x.k !== g.k) continue;
      const b = fileBase(x);
      if (!b.t || b.r[0] === g.tr[0] || !baseHit(b, q)) continue;
      const t = nameTier(b.r);
      if (!best || t < best.t) best = { t, aka: b.t };
    }
    for (const b of akaForms(g)) {
      if (b.r[0] === g.tr[0] || !baseHit(b, q)) continue;
      const t = nameTier(b.r);
      if (!best || t < best.t) best = { t, aka: b.t };
    }
    if (best && (!self || best.t < own)) return { t: Math.min(own, best.t), aka: best.aka };
    return { t: own, aka: '' };
  }
  const cap =s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
  function gunzipJson(ab) {
    const u = new Uint8Array(ab);
    if (u.length > 2 && u[0] === 0x1f && u[1] === 0x8b) {
      const ds = new DecompressionStream('gzip');
      const w = ds.writable.getWriter(); w.write(u); w.close();
      return new Response(ds.readable).json();
    }
    return Promise.resolve(JSON.parse(new TextDecoder().decode(u)));
  }

  /* ------------------------------------------------------------------ data */
  let index = null, indexP = null;
  const cardData = {};    // file -> Promise
  const games = [];       // every loaded game: { t, sh, st, k, c, f: files[], card, key, q }
  const loadedFiles = new Set();
  const failedFiles = new Set();   // this load's misses: the list shows what came, the loading screen does not wait for them
  function loadIndex() {
    return indexP || (indexP = fetch(BASE + 'list-index.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).catch(() => null).then(j => (index = j)));
  }
  function loadFile(file) {
    if (cardData[file]) return cardData[file];
    return (cardData[file] = fetch(BASE + file, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then(gunzipJson).then(j => {
        for (const g of j.games) {
          const files = g[5].map(f => ({ name: f[0], label: f[1], reg: f[2], sha: f[3], id: f[4], st: f[5], why: f[6], date: f[7], art: f[8], k: f[9] }));
          const G = { t: g[0], sh: g[1], st: g[2], k: g[3], c: g[4], f: files, a: Array.isArray(g[6]) ? g[6] : null, key: g[1] + ':' + games.length };
          G.date = files.reduce((a, x) => (x.date > a ? x.date : a), '');
          G.why = G.st === 0 ? '' : (files.find(x => x.why && x.st === G.st) || files.find(x => x.why) || {}).why || '';
          G.card = (CARDS.find(c => c[2].includes(G.sh)) || [''])[0];
          G.q = fold(G.t); G.p = _punctHay(G.t);
          for (const x of files) { x.q = fold(x.name) + ' ' + fold(x.id); x.p = _punctHay(x.name); }
          games.push(G);
        }
        loadedFiles.add(file);
        return true;
      }).catch(err => { console.warn('[compat] ' + file + ': ' + (err && err.message || err)); delete cardData[file]; failedFiles.add(file); return false; }));
  }

  /* ------------------------------------------------------------------ state */
  const S = { card: '', status: -1, kind: '', q: '', sort: 'title', dir: 1, open: new Set(), shut: new Set(), all: false };
  let filtSig = '';     // the filters last drawn: a change clears S.shut (a new search shows its matching versions again)
  let root = null, scroller = null, rowsEl = null, headEl = null;
  let rows = [];          // [{ g, f (file index, 0 = the game row), kids }]
  let cur = 0;            // the focused row index
  let rowH = 56;
  /* ROW HEIGHTS (23 Oct: a long status wraps in its cell and the row grows). Each row
     is rowH tall until it is drawn; a drawn row that wraps is measured and the rows below it move down.
     tops[i] = the row's top, tops[rows.length] = the list's height. Measured heights are kept by row key
     until the list's width changes. */
  let hts = [], tops = [0], htW = 0;
  const htOf = new Map();  // row key -> measured height
  const live = new Map(); // row key -> element
  let raf = 0, clipEl = null, clipRow = null;

  function filesFor(card) {
    if (!index) return [];
    const want = card ? CARDS.find(c => c[0] === card)[2] : null;
    return [...new Set(index.systems.filter(s => !want || want.includes(s.key)).map(s => s.file))];
  }

  /* ------------------------------------------------------------------ markup */
  function html() {
    return '<div class="gw-frame-outer about-pop cl-pop"><div class="gw-frame-bezel"><div class="gw-screen-wrap"><div class="gw-frame-screen">'
      + '<div class="section cl-root" data-cl-root>'
      + '<div class="section-head"><div><div class="section-kicker">Compatibility</div><h2 class="section-title">Every game, on every system</h2></div>'
      + '<p class="cl-sweep" data-cl-sweep></p></div>'
      + '<div class="loading-card cl-loading" data-cl-loading role="status" hidden><div class="loading-spinner" aria-hidden="true"></div><div class="loading-title">COMPATIBILITY</div>'
      + '<div class="loading-sub">Loading the list…</div><div class="loading-bar" aria-hidden="true"><div class="loading-bar-fill" data-cl-load-fill></div></div><div class="loading-stat" data-cl-load-stat>Connecting…</div></div>'
      + '<p class="cl-lede">How each game runs on our emulators. A game&rsquo;s versions (regions, revisions, translations) are grouped under it; open a game to see them. Each game is counted once.</p>'
      + '<p class="cl-lede">Each clip on this page is a pre-recorded video that proves how the game booted at the time of recording. Choose a clip to see it larger.</p>'
      + '<div class="cl-bar-wrap" data-cl-bar></div>'
      + '<div class="cl-controls" data-cl-controls>'
      + '<div class="cl-search"><span aria-hidden="true">⌕</span><input type="text" data-cl-q placeholder="Search by name, game ID or hash" autocomplete="off" readonly inputmode="none" enterkeyhint="search" aria-label="Search the compatibility list"></div>'
      + '<div class="cl-chips" role="group" aria-label="System" data-cl-sysbox></div>'
      + '<div class="cl-chips" role="group" aria-label="Kind of game" data-cl-kindbox></div>'
      + '<p class="cl-shown" data-cl-shown aria-live="polite"></p>'
      + '</div>'
      + '<div class="cl-table" role="treegrid" aria-label="Compatibility list" data-cl-grid>'
      + '<div class="cl-head" role="row" data-cl-head></div>'
      + '<div class="cl-rows" data-cl-rows></div>'
      + '</div>'
      + '<p class="cl-empty" data-cl-empty hidden>No game matches.</p>'
      + '<p class="cl-foot">Plays: the game plays on our emulator. Boots: it starts but does not play (the screen stays blank, freezes, or stops at its title). Nothing: it does not start. Enter or OK (or the clip) shows the clip larger. Right and Left open and close a game&rsquo;s versions. Hash: the start of the file&rsquo;s SHA-256 (search takes six characters or more). Testing and diagnostics cartridges are listed but are not games, so they are not counted. Untested / not found: a known release that has not been found, so it has not been tested; these are listed but not counted.</p>'
      + '</div></div></div></div></div>';
  }

  const COLS = [
    ['x', '', null], ['cover', 'Cover', 'cover'], ['clip', 'Clip', 'clip'], ['title', 'Title', 'title'], ['id', 'Game ID', 'id'],
    ['reg', 'Region', 'reg'], ['sys', 'System', 'sys'], ['kind', 'Kind', 'kind'], ['st', 'Status', 'st'], ['date', 'Tested', 'date'], ['hash', 'Hash', 'hash'],
  ];
  function headHTML() {
    return COLS.map(([k, label, sort]) => {
      if (!sort) return `<span class="cl-c cl-c-${k}" role="columnheader"></span>`;
      const on = S.sort === sort;
      return `<span class="cl-c cl-c-${k}" role="columnheader" aria-sort="${on ? (S.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" class="cl-sort${on ? ' on' : ''}" data-cl-sort="${sort}">${esc(label)}<i aria-hidden="true">${on ? (S.dir > 0 ? '▲' : '▼') : ''}</i></button></span>`;
    }).join('');
  }

  /* THE BAR (the home cards' ladder, emulators-table.js ladderHTML): the counted games of the chosen
     system and kind; Plays' share rounded down, as there. Each part is a button that filters. */
  function counts() {
    /* Every kind: the builder's own counts (instant, and the cards' numbers). One kind: counted from
       the loaded rows (the same games, so the same rule). */
    const c = [0, 0, 0, 0];
    if (S.kind === 'test' || !index) return c;
    const want = S.card ? CARDS.find(x => x[0] === S.card)[2] : null;
    if (!S.kind) { for (const s of index.systems) if (!want || want.includes(s.key)) s.counts.forEach((v, i) => { c[i] += v; }); return c; }
    for (const g of games) if (g.c && (!want || want.includes(g.sh)) && g.k === S.kind) c[g.st]++;
    return c;
  }
  /* The "Untested / not found" key, shown with no figure, when the chosen system lists any */
  function notFoundHere() {
    const want = S.card ? CARDS.find(x => x[0] === S.card)[2] : null;
    return games.some(g => g.st === 4 && (!want || want.includes(g.sh)) && (!S.kind || g.k === S.kind));
  }
  function barHTML() {
    const c = counts(), total = c[0] + c[1] + c[2];
    if (S.kind === 'test') return '<p class="cl-line">Testing and diagnostics cartridges are not games, so they are not counted. They are listed below.</p>';
    if (!total) return '<p class="cl-line">Loading…</p>';
    const pct = i => (total ? (c[i] * 100 / total) : 0);
    const segs = [0, 1, 2].filter(i => c[i] > 0).map(i => `<span class="cl-seg lad-${STATUS_KEY[i]}" style="flex-grow:${c[i]}"></span>`).join('');
    const keys = [0, 1, 2].map(i => `<button type="button" class="cl-key${S.status === i ? ' on' : ''}" data-cl-status="${i}" aria-pressed="${S.status === i}" title="${esc(STATUS_TEXT[i])}"><i class="lad-${STATUS_KEY[i]}"></i>${STATUS[i]} <b>${n(c[i])}</b> <span>${pct(i) < 1 && c[i] ? '<1' : Math.floor(pct(i))}%</span></button>`).join('')
      + (c[3] ? `<button type="button" class="cl-key${S.status === 3 ? ' on' : ''}" data-cl-status="3" aria-pressed="${S.status === 3}"><i class="lad-untested"></i>Not yet tested <b>${n(c[3])}</b></button>` : '')
      + (notFoundHere() ? `<button type="button" class="cl-key${S.status === 4 ? ' on' : ''}" data-cl-status="4" aria-pressed="${S.status === 4}" title="${esc(STATUS_TEXT[4])}"><i class="lad-notfound"></i>${STATUS[4]}</button>` : '')
      + `<button type="button" class="cl-key cl-key-all${S.status < 0 ? ' on' : ''}" data-cl-status="-1" aria-pressed="${S.status < 0}">All</button>`;
    const said = [0, 1, 2].map(i => `${STATUS[i]} ${n(c[i])}`).join(', ');
    return `<p class="cl-line"><b>${n(total)} ${total === 1 ? 'game' : 'games'} tested (${Math.floor(c[0] * 100 / total)}%)</b>${c[3] ? `, ${n(c[3])} not yet` : ''}</p>
      <div class="cl-bar" role="img" aria-label="${esc('Compatibility: ' + said)}">${segs}</div>
      <div class="cl-keys" role="group" aria-label="Status">${keys}</div>`;
  }
  function chipsHTML() {
    const sys = [['', 'All systems'], ...CARDS.map(c => [c[0], c[1]])].map(([k, l]) => `<button type="button" class="cl-chip${S.card === k ? ' on' : ''}" data-cl-card="${k}" aria-pressed="${S.card === k}">${esc(l)}</button>`).join('');
    const kinds = [['', 'All kinds'], ...KIND_ORDER.map(k => [k, KIND[k]])].map(([k, l]) => `<button type="button" class="cl-chip${S.kind === k ? ' on' : ''}" data-cl-kind="${k}" aria-pressed="${S.kind === k}">${esc(l)}</button>`).join('');
    return [sys, kinds];
  }
  function sweepText() {
    if (!index) return '';
    const want = S.card ? CARDS.find(x => x[0] === S.card)[2] : null;
    const ds = index.systems.filter(s => (!want || want.includes(s.key)) && s.tested).map(s => s.tested).sort();
    return ds.length ? `Last sweep: ${day(ds[ds.length - 1])}` : '';
  }

  /* ------------------------------------------------------------------ the rows */
  const qHex = q => (/^[0-9a-f]{6,64}$/.test(q) ? q : '');
  function matches(x, q, hex) { return !q || x.q.includes(q) || (x.p && _punctHit(x.p)) || (hex && x.sha && x.sha.startsWith(hex)) || _wordHit(fileBase(x).w); }
  const gWords = g => g.w || (g.w = ' ' + _wordsOf(g.q) + ' ');
  const SORTERS = {
    title: g => g.q, id: g => (g.f[0].id || '￿').toLowerCase(), reg: g => (g.f[0].reg ? (REGION[g.f[0].reg.split(',')[0]] || '') : '￿'),
    sys: g => SHELF_LABEL[g.sh] || g.sh, kind: g => KIND_ORDER.indexOf(g.k), st: g => g.st, date: g => g.date || '0', hash: g => g.f[0].sha || '￿',
    cover: g => artState(coverUrls(g.sh, g.f[0].art, g.f[0].name)), clip: g => (artState(clipUrls(g.sh, g.f[0].art, g.f[0].sha))),
  };
  /* Cover and Clip sort by what this visit has seen: found first, then not looked at yet, then none
     (no list of clips or covers is kept; the tiles ask the buckets directly). */
  function artState(urls) { if (!urls.length) return 3; if (urls.some(u => urlOk.get(u) === true)) return 0; if (urls.every(u => urlOk.get(u) === false)) return 2; return 1; }
  function rebuild(keepKey) {
    const q = fold(S.q).trim(), hex = qHex(q.replace(/\s+/g, ''));
    _qp = q ? [...new Set(_punctForms(S.q))].filter(Boolean) : [];
    _qw = q ? _wordsOf(q).split(' ').filter(Boolean) : [];
    _q0 = _qp.map(x => x.replace(/ /g, '')).filter(Boolean);
    const want = S.card ? CARDS.find(x => x[0] === S.card)[2] : null;
    const filt = S.status >= 0 || S.kind || q;
    const sig = [S.card, S.status, S.kind, q].join('|'); if (sig !== filtSig) { filtSig = sig; S.shut.clear(); }
    const okF = x => (S.status < 0 || x.st === S.status) && (!S.kind || x.k === S.kind) && matches(x, q, hex);
    const list = [];
    for (const g of games) {
      if (want && !want.includes(g.sh)) continue;
      const self = (S.status < 0 || g.st === S.status) && (!S.kind || g.k === S.kind) && (!q || g.q.includes(q) || _punctHit(g.p) || _wordHit(gWords(g)) || matches(g.f[0], q, hex) || akaHit(g, q));
      const kids = filt ? g.f.slice(1).filter(okF) : [];
      if (!self && !kids.length) continue;
      const sr = q ? searchRank(g, q) : null;   // the name order and "Also called" (searchRank above)
      list.push({ g, kids: self && !q ? [] : kids, self, t: sr ? sr.t : 2, aka: sr ? sr.aka : '' });
    }
    const key = SORTERS[S.sort] || SORTERS.title;
    list.sort((a, b) => { if (a.t !== b.t) return a.t - b.t; const x = key(a.g), y = key(b.g); const c = x < y ? -1 : x > y ? 1 : 0; if (c) return c * S.dir; return a.g.q < b.g.q ? -1 : a.g.q > b.g.q ? 1 : 0; });
    rows = [];
    for (const it of list) {
      /* Versions shown: opened (S.open), or the ones a filter hit ("matching shown") unless this game was
         closed (S.shut: before, closing such a game drew the same matching versions again). */
      const g = it.g, open = S.all || S.open.has(g.key), auto = !open && it.kids.length > 0 && !S.shut.has(g.key);
      rows.push({ g, f: 0, n: g.f.length - 1, auto, shown: open || auto, aka: it.aka });
      if (open) for (let i = 1; i < g.f.length; i++) rows.push({ g, f: i, child: true });
      else if (auto) for (const x of it.kids) rows.push({ g, f: g.f.indexOf(x), child: true });
    }
    if (keepKey) { const i = rows.findIndex(r => rKey(r) === keepKey); cur = i >= 0 ? i : Math.min(cur, Math.max(0, rows.length - 1)); }
    else cur = Math.min(cur, Math.max(0, rows.length - 1));
    const shown = list.length;
    const el = root.querySelector('[data-cl-shown]');
    const loading = filesFor(S.card).some(f => !loadedFiles.has(f));
    /* 28 Oct: the "Untested / not found" filter shows no count; it would say how many
       games the library lacks, and the site publishes compatibility only. */
    if (el) el.textContent = loading ? 'Loading the list…' : S.status === 4 ? '' : `${n(shown)} ${shown === 1 ? 'game' : 'games'} shown`;
    const em = root.querySelector('[data-cl-empty]'); if (em) em.hidden = loading || shown > 0;
    showLoading();
    hts = rows.map(r => htOf.get(rKey(r)) || rowH);
    layTops();
    try { if (window.CwDeepLink) window.CwDeepLink.compatChanged(queryOf()); } catch (_) {}   // the link in the address bar follows the filters
    rowsEl.setAttribute('aria-rowcount', S.status === 4 ? '-1' : String(rows.length));   // -1: not told (as the shown count)
    for (const [, e] of live) e.remove();
    live.clear();
    stopClip();
    paint();
  }
  const rKey = r => r.g.key + '/' + r.f;
  function layTops() {
    tops = new Array(hts.length + 1); tops[0] = 0;
    for (let i = 0; i < hts.length; i++) tops[i + 1] = tops[i] + hts[i];
    rowsEl.style.height = tops[hts.length] + 'px';
  }
  /* the row at height y (binary search on tops) */
  function rowAt(y) {
    let lo = 0, hi = Math.max(0, rows.length - 1);
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (tops[m] <= y) lo = m; else hi = m - 1; }
    return lo;
  }

  function rowHTML(r, i) {
    const g = r.g, x = g.f[r.f], game = !r.child;
    const st = game ? g.st : x.st, why = game ? g.why : x.why;
    const kind = game ? g.k : x.k;
    const title = game ? g.t : x.name;
    const sub = game ? (x.label || '') : (x.label && x.label !== x.name ? '' : '');
    const exp = game && r.n > 0 ? `<span class="cl-exp${r.shown ? ' open' : ''}" aria-hidden="true">▸</span>` : '';
    const vers = game && r.n > 0 ? `<span class="cl-vers" data-cl-toggle>${r.n + 1} versions</span>` : '';
    const id = x.id ? x.id.split(/\s*,\s*/) : [];
    const date = game ? g.date : x.date;
    return `<span class="cl-c cl-c-x" role="gridcell"${exp ? ' data-cl-toggle' : ''}>${exp}</span>`
      + `<span class="cl-c cl-c-cover" role="gridcell"><span class="cl-art" data-cl-cover></span></span>`
      + `<span class="cl-c cl-c-clip" role="gridcell"><span class="cl-clip" data-cl-clip></span></span>`
      + `<span class="cl-c cl-c-title" role="gridcell"><span class="cl-t">${esc(title)}</span>${game && r.aka ? `<span class="cl-aka" title="Also called ${esc(r.aka)}">Also called ${esc(r.aka)}</span>` : ''}<span class="cl-sub">${vers}${sub ?`<span>${esc(sub)}</span>` : ''}</span></span>`
      + `<span class="cl-c cl-c-id" role="gridcell"${id.length > 1 ? ` title="${esc(x.id)}"` : ''}>${id.length ? `${esc(id[0])}${id.length > 1 ? ` <small>+${id.length - 1}</small>` : ''}` : '<span class="cl-none" aria-label="none">–</span>'}</span>`
      + `<span class="cl-c cl-c-reg" role="gridcell">${regionHTML(x.reg) || '<span class="cl-none" aria-label="none">–</span>'}</span>`
      + `<span class="cl-c cl-c-sys" role="gridcell">${esc(SHELF_LABEL[g.sh] || g.sh)}</span>`
      + `<span class="cl-c cl-c-kind" role="gridcell" title="${esc(KIND[kind] || '')}">${esc(KIND_SHORT[kind] || '')}</span>`
      + `<span class="cl-c cl-c-st" role="gridcell"><span class="cl-st lad-${STATUS_KEY[st]}">${STATUS[st]}</span>${why ? `<span class="cl-why">${esc(cap(why))}</span>` : ''}</span>`
      + `<span class="cl-c cl-c-date" role="gridcell">${date ? esc(day(date)) : '<span class="cl-none" aria-label="none">–</span>'}</span>`
      + `<span class="cl-c cl-c-hash" role="gridcell">${x.sha ? `<code title="${esc(x.sha)}">${esc(x.sha.slice(0, 12))}</code>` : '<span class="cl-none" aria-label="none">–</span>'}</span>`;
  }
  function makeRow(r, i) {
    const e = document.createElement('div');
    /* a version's last row ends the tree line drawn down from its game (compat.css .cl-kid) */
    const lastKid = r.child && !(rows[i + 1] && rows[i + 1].child && rows[i + 1].g === r.g);
    e.className = 'cl-row' + (r.child ? ' cl-kid' : '') + (lastKid ? ' cl-kid-last' : '') + (r.auto ? ' cl-auto' : '');
    e.setAttribute('role', 'row');
    e.setAttribute('aria-rowindex', String(i + 1));
    e.setAttribute('aria-level', r.child ? '2' : '1');
    if (!r.child && r.n > 0) e.setAttribute('aria-expanded', String(!!r.shown));
    e.tabIndex = i === cur ? 0 : -1;
    e.dataset.i = String(i);
    e.innerHTML = rowHTML(r, i);
    const x = r.g.f[r.f];
    paintCover(e.querySelector('[data-cl-cover]'), coverUrls(r.g.sh, x.art || r.g.f[0].art, x.name), r.g.sh, 'cl-x' + (x.sha || r.g.f[0].sha || ''));
    return e;
  }
  /* The shelf's generic cover (2026-10-21): one real box of the system with the game
     painted out, generic.png in the shelf's own 2D bucket; the last thing tried, after the
     named covers and the second source, and not counted by the Cover sort (artState reads
     coverUrls' list only). */
  const genericUrl = shelf => (!DEVICE_ART.has(shelf) && COVER[shelf] && COVER[shelf][0]) ? COVER[shelf][0] + 'generic.png' : '';
  /* tileKey: "cl-x" + the file's hash, for the type word on the generic (emby.js window.cwGenericLabel). */
  function paintCover(box, urls, shelf, tileKey) {
    if (!box) return;
    const gen = genericUrl(shelf);
    const todo = urls.filter(u => urlOk.get(u) !== false).concat(gen && urlOk.get(gen) !== false ? [gen] : []);
    const next = k => {
      if (k >= todo.length) { box.classList.add('cl-art-none'); return; }
      const u = todo[k];
      const img = new Image(); img.decoding = 'async'; img.alt = ''; img.referrerPolicy = 'no-referrer';   // not loading=lazy: a detached image would never load
      if (u === gen) img.className = 'cl-art-generic';
      img.onload = () => {
        urlOk.set(u, true);
        if (!box.isConnected) return;
        box.innerHTML = ''; box.appendChild(img);
        if (u === gen && typeof window.cwGenericLabel === 'function') requestAnimationFrame(() => { try { window.cwGenericLabel(box, shelf, tileKey, 0); } catch (_) {} });
      };
      img.onerror = () => { urlOk.set(u, false); next(k + 1); };
      img.src = u;
    };
    next(0);
  }
  function rowsTop() {
    const a = rowsEl.getBoundingClientRect(), b = scroller.getBoundingClientRect();
    return a.top - b.top + scroller.scrollTop;
  }
  function paint() {
    raf = 0;
    if (!root || !root.isConnected) return;
    const top = scroller.scrollTop - rowsTop(), vh = scroller.clientHeight;
    const first = Math.max(0, rowAt(top) - 8), last = Math.min(rows.length - 1, rowAt(top + vh) + 8);
    const keep = new Set();
    for (let i = first; i <= last; i++) keep.add(i);
    if (rows.length) keep.add(cur);
    for (const [k, e] of live) { const i = +e.dataset.i; if (!keep.has(i) || rKey(rows[i] || {}) !== k) { if (e === clipRow) stopClip(); e.remove(); live.delete(k); } }
    const fresh = [];
    for (const i of keep) {
      const r = rows[i]; if (!r) continue;
      const k = rKey(r);
      if (live.has(k)) continue;
      const e = makeRow(r, i);
      e.style.transform = `translateY(${tops[i]}px)`;
      rowsEl.appendChild(e);
      live.set(k, e);
      fresh.push([i, k, e]);
    }
    /* measure the rows just drawn; a row that wrapped moves the rows below it (and, when it is above the
       view, the scroll position, so what is on screen stays put) */
    let moved = false, above = 0;
    for (const [i, k, e] of fresh) {
      const h = e.offsetHeight;
      if (!h || h === hts[i]) continue;
      if (tops[i] < top) above += h - hts[i];
      hts[i] = h; htOf.set(k, h); moved = true;
    }
    if (!moved) return;
    layTops();
    for (const [, e] of live) e.style.transform = `translateY(${tops[+e.dataset.i]}px)`;
    if (above) scroller.scrollTop += above;
    schedule();
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(paint); setTimeout(() => { if (raf) { cancelAnimationFrame(raf); paint(); } }, 120); };

  /* ------------------------------------------------------------------ the clip (focus only, muted) */
  /* GAME & WATCH: the screen only (21 Oct). The unit's live LCD (gnw-host.js gnwMountTilePreview,
     the tiles' own preview) with its printed screen background, without the device art: the layer stack
     of index.html tileEmuLayersHTML minus Unit.png, scaled so the screen box (both screens on a dual-screen
     unit) fills the cell. Muted (the previews make no sound). */
  const GNW_SLOT = 'cl-compat';
  const gnwAspect = {};
  function gnwClip(box, id, slot = GNW_SLOT) {
    let G = null;
    try { G = typeof GNW_EMULATED_GAMES !== 'undefined' ? GNW_EMULATED_GAMES[id] : null; } catch (_) {}   // eslint-disable-line no-undef
    if (!G || typeof window.gnwMountTilePreview !== 'function' || typeof window.tileEmuLayersHTML !== 'function') return null;
    const art = window.gnwTileArtUrl || (u => u);
    const wrap = document.createElement('div'); wrap.className = 'cl-gnw';
    if (/^crystal-/.test(id)) wrap.style.background = '#dbe0e8';   // see-through Crystal Screen: the light backing it is seen against, like its clip (21 Oct)
    const emu = document.createElement('div'); emu.className = 'cl-gnw-emu';
    emu.innerHTML = window.tileEmuLayersHTML(G).replace(/<img class="tile-emu-unit"[^>]*>/, '');
    emu.querySelectorAll('img[data-src]').forEach(i => { i.src = art(i.dataset.src); i.removeAttribute('data-src'); });
    wrap.appendChild(emu); box.appendChild(wrap);
    try { window.gnwMountTilePreview(emu, G.key, slot); } catch (_) { wrap.remove(); return null; }
    const fit = aspect => {
      if (!wrap.isConnected) return;
      const rects = ['.tile-emu-svg', '.tile-emu-svg-2'].map(q => emu.querySelector(q)).filter(el => el && el.style.width && el.style.display !== 'none' && (el.classList.contains('tile-emu-svg') || el.style.display === 'block'))
        .map(el => ({ l: parseFloat(el.style.left), t: parseFloat(el.style.top), w: parseFloat(el.style.width), h: parseFloat(el.style.height) }));
      if (!rects.length) return;
      const L = Math.min(...rects.map(r => r.l)), T = Math.min(...rects.map(r => r.t));
      const W = Math.max(...rects.map(r => r.l + r.w)) - L, H = Math.max(...rects.map(r => r.t + r.h)) - T;
      const cw = wrap.clientWidth, ch = wrap.clientHeight;
      const ew = Math.min(cw * 100 / W, ch * aspect * 100 / H), eh = ew / aspect;
      Object.assign(emu.style, { width: ew + 'px', height: eh + 'px', left: (-L / 100 * ew + (cw - W / 100 * ew) / 2) + 'px', top: (-T / 100 * eh + (ch - H / 100 * eh) / 2) + 'px' });
    };
    if (gnwAspect[id]) fit(gnwAspect[id]);
    else { const u = new Image(); u.onload = () => { gnwAspect[id] = u.naturalWidth / u.naturalHeight; fit(gnwAspect[id]); }; u.src = art((G.previewFolder || G.folder) + '/Unit.png'); }
    return wrap;
  }
  let gnwWrap = null;
  function stopClip() {
    if (gnwWrap) { try { window.gnwStopTilePreview(GNW_SLOT); } catch (_) {} gnwWrap.remove(); gnwWrap = null; }
    if (clipEl) { try { clipEl.pause(); clipEl.removeAttribute('src'); clipEl.load(); } catch (_) {} clipEl.remove(); }
    if (clipRow) clipRow.classList.remove('cl-playing');
    clipEl = null; clipRow = null;
  }
  function playClip(e) {
    if (clipRow === e) return;
    stopClip();
    const r = rows[+e.dataset.i]; if (!r) return;
    const x = r.g.f[r.f];
    const urls = [...new Set([...clipUrls(r.g.sh, x.art, x.sha), ...clipUrls(r.g.sh, r.g.f[0].art, r.g.f[0].sha)])].filter(u => urlOk.get(u) !== false);
    let box = e.querySelector('[data-cl-clip]');
    if (!box || !box.offsetParent) box = e.querySelector('[data-cl-cover]');   // a narrow screen shows the clip over the cover
    if (!box) return;
    /* Game & Watch: the clip first (it needs no game file); the unit's live LCD only when the clip is
       missing (21 Oct). */
    const live = () => { if (r.g.sh !== 'gnw') return false; gnwWrap = gnwClip(box, x.art); if (!gnwWrap) return false; clipRow = e; e.classList.add('cl-playing'); return true; };
    if (!urls.length) { if (live()) return; const c = e.querySelector('[data-cl-clip]'); if (c) c.classList.add('cl-clip-none'); return; }
    const v = document.createElement('video');
    v.muted = true; v.defaultMuted = true; v.volume = 0; v.loop = true; v.playsInline = true; v.autoplay = true;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true'); v.tabIndex = -1;
    v.preload = 'auto'; v.className = 'cl-video';
    let k = 0;
    v.onerror = () => { urlOk.set(urls[k], false); k++; if (k < urls.length && clipEl === v) { v.src = urls[k]; v.play().catch(() => {}); } else if (clipEl === v) { stopClip(); if (live()) return; const c = e.querySelector('[data-cl-clip]'); if (c) c.classList.add('cl-clip-none'); } };
    v.onloadeddata = () => { urlOk.set(urls[k], true); e.classList.add('cl-playing'); };
    v.src = urls[0];
    box.appendChild(v);
    clipEl = v; clipRow = e;
    v.play().catch(() => {});
  }

  /* ------------------------------------------------------------------ the clip, larger (21 Oct) */
  /* Clicking the clip opens it in a larger window; OK on a row does the same (a pad has no
     second button for it). A site layer (.overlay, index.html openOverlay), so Back, Escape and the
     pad's B close it and focus returns to the row (keys.js). Muted, like every clip here. The game opens
     from its button (or the title in the row). */
  let lbVideo = null, lbGnw = false, lbRow = null;
  function lightbox() {
    let ov = document.getElementById('cl-lightbox');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.className = 'overlay cl-lb-ov'; ov.id = 'cl-lightbox';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'cl-lb-title');
    ov.innerHTML = '<div class="modal cl-lb"><div class="modal-head"><div><div class="modal-sub">Clip</div><div class="modal-title" id="cl-lb-title"></div></div>'
      + '<button class="modal-close" type="button" aria-label="Close">×</button></div>'
      + '<div class="cl-lb-stage" data-cl-lb-stage></div><p class="cl-lb-note" data-cl-lb-note></p>'
      + '<div class="cl-lb-acts"><button type="button" class="cl-chip on" data-cl-lb-close>Close</button></div></div>';
    ov.addEventListener('click', e => {
      if (e.target === ov || e.target.closest('.modal-close, [data-cl-lb-close]')) { closeLb(); return; }
    });
    new MutationObserver(() => { if (!ov.classList.contains('open')) stopLb(); }).observe(ov, { attributes: true, attributeFilter: ['class'] });
    document.body.appendChild(ov);
    return ov;
  }
  function stopLb() {
    if (lbVideo) { try { lbVideo.pause(); lbVideo.removeAttribute('src'); lbVideo.load(); } catch (_) {} lbVideo.remove(); lbVideo = null; }
    if (lbGnw) { try { window.gnwStopTilePreview(GNW_SLOT + '-lb'); } catch (_) {} lbGnw = false; }
  }
  function closeLb() { if (typeof window.closeOverlay === 'function') window.closeOverlay('cl-lightbox'); else { const ov = document.getElementById('cl-lightbox'); if (ov) ov.classList.remove('open'); } }
  function openLightbox(r) {
    if (!r) return;
    stopClip();
    const ov = lightbox(), x = r.g.f[r.f];
    stopLb();
    lbRow = r;
    ov.querySelector('#cl-lb-title').textContent = r.child ? x.name : r.g.t;
    const stage = ov.querySelector('[data-cl-lb-stage]'), note = ov.querySelector('[data-cl-lb-note]');
    stage.innerHTML = ''; note.textContent = '';
    const st = r.child ? x.st : r.g.st;
    const meta = `${SHELF_LABEL[r.g.sh] || r.g.sh} · ${STATUS[st]}`;
    /* Game & Watch: the clip first, the unit's live LCD when the clip is missing (21 Oct). */
    const live = () => {
      if (r.g.sh !== 'gnw' || lbRow !== r) return false;
      stage.classList.add('cl-lb-gnw');
      const w = gnwClip(stage, x.art, GNW_SLOT + '-lb');
      lbGnw = !!w;
      note.textContent = w ? meta : meta + ' · no clip';
      return true;
    };
    {
      stage.classList.remove('cl-lb-gnw');
      const urls = [...new Set([...clipUrls(r.g.sh, x.art, x.sha), ...clipUrls(r.g.sh, r.g.f[0].art, r.g.f[0].sha)])].filter(u => urlOk.get(u) !== false);
      if (!urls.length) { if (!live()) note.textContent = meta + ' · no clip'; }
      else {
        const v = document.createElement('video');
        v.muted = true; v.defaultMuted = true; v.volume = 0; v.loop = true; v.playsInline = true; v.autoplay = true;
        v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.tabIndex = -1; v.className = 'cl-lb-video';
        let k = 0;
        v.onerror = () => { urlOk.set(urls[k], false); k++; if (k < urls.length && lbVideo === v) { v.src = urls[k]; v.play().catch(() => {}); } else if (lbVideo === v) { v.remove(); lbVideo = null; if (!live()) note.textContent = meta + ' · no clip'; } };
        v.onloadeddata = () => { urlOk.set(urls[k], true); };
        v.src = urls[0];
        stage.appendChild(v); lbVideo = v; note.textContent = meta;
        v.play().catch(() => {});
      }
    }
    if (typeof window.openOverlay === 'function') window.openOverlay('cl-lightbox'); else ov.classList.add('open');
    requestAnimationFrame(() => { const b = ov.querySelector('[data-cl-lb-close]'); if (b) try { b.focus({ preventScroll: true }); } catch (_) {} });
  }

  /* ------------------------------------------------------------------ moving */
  function focusRow(i, how) {
    if (!rows.length) return;
    i = Math.max(0, Math.min(rows.length - 1, i));
    cur = i;
    const head = headEl.getBoundingClientRect().height;
    /* Keys and the pad (31 Oct: a held Down stepped the list a row at a time, standing still
       between rows): the rows scroll by nav.js's steady scroll, measured from where it is going. */
    const N = window.GnwNav, smooth = how !== 'pointer' && N && typeof N.scrollBox === 'function';
    const y = rowsTop() + tops[i], h = hts[i] || rowH, top = smooth && N.scrollGoal ? N.scrollGoal(scroller) : scroller.scrollTop, vh = scroller.clientHeight;
    let to = null;
    if (y - head < top) to = y - head - 4;
    else if (y + h > top + vh) to = y + h - vh + 4;
    if (to != null) { if (smooth) N.scrollBox(scroller, to); else scroller.scrollTop = to; }
    paint();
    for (const [, e] of live) e.tabIndex = +e.dataset.i === cur ? 0 : -1;
    const e = [...live.values()].find(x => +x.dataset.i === cur);
    if (e) { try { e.focus({ preventScroll: true, focusVisible: how !== 'pointer' }); } catch (_) { e.focus(); } }
  }
  function toggle(r, open) {
    if (!r || r.child || !r.n) return false;
    const now = !!r.shown;   // what the row shows, opened or "matching shown"
    const want = open == null ? !now : open;
    if (want === now) return false;
    if (S.all) { S.all = false; for (const x of rows) if (!x.child && x.n) S.open.add(x.g.key); }
    if (want) { S.open.add(r.g.key); S.shut.delete(r.g.key); } else { S.open.delete(r.g.key); S.shut.add(r.g.key); }
    rebuild(rKey(r));
    focusRow(cur);
    return true;
  }
  /* Arrows in the controls above the list: the nearest focusable in that direction, by position. */
  function ctrlItems() { return Array.from(root.querySelectorAll('[data-cl-controls] input, [data-cl-controls] button, [data-cl-bar] button, [data-cl-head] button')).filter(b => b.offsetParent); }
  function nearest(from, dir) {
    const a = from.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bd = Infinity;
    for (const el of ctrlItems()) {
      if (el === from) continue;
      const b = el.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
      const dx = bx - ax, dy = by - ay;
      if (dir === 'down' && b.top < a.bottom - 2) continue;
      if (dir === 'up' && b.bottom > a.top + 2) continue;
      if (dir === 'right' && (b.left < a.right - 2 || Math.abs(dy) > a.height)) continue;
      if (dir === 'left' && (b.right > a.left + 2 || Math.abs(dy) > a.height)) continue;
      /* Up and down (4 Nov: "the controller (D-pad) cannot reach its search box"): measured edge to
         edge, a control that spans across the one we are on counting as straight below or above it.
         Centre to centre, the wide search box lost to the small chip under it, so Down from the keys
         jumped over the box and Up from the chips jumped back over it. Left and right are unchanged. */
      const gapY = dir === 'down' ? Math.max(0, b.top - a.bottom) : Math.max(0, a.top - b.bottom);
      const cross = Math.max(0, b.left - a.right, a.left - b.right);
      const d = (dir === 'up' || dir === 'down') ? (gapY + cross * 2 + Math.abs(dx) * 0.1) ** 2 : dx * dx + dy * dy * 4;
      if (d < bd) { bd = d; best = el; }
    }
    return best;
  }
  const DIRS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  /* Focus without the browser's own jump; the window brings it into view by nav.js's steady scroll
     (31 Oct: on a phone a held Down over the filter chips jumped the window 425 px at once). */
  function glide(el) {
    try { el.focus({ preventScroll: true }); } catch (_) { el.focus(); }
    const N = window.GnwNav;
    if (N && typeof N.revealEl === 'function') N.revealEl(el); else try { el.scrollIntoView({ block: 'nearest' }); } catch (_) {}
  }
  function onKey(e) {
    if (!root || !root.isConnected || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    const inRoot = t && t.nodeType === 1 && root.contains(t);
    const q = root.querySelector('[data-cl-q]');
    /* Into the window from the bar above it: Down from the list's own button or the search bar. */
    if (!inRoot) {
      /* Any of the bar's buttons (4 Nov), not only the list's own: Down from them steps over the search
         box into the list, as nav.js does for the other pages, so the list is not closed by the box. */
      if (e.key === 'ArrowDown' && t && t.closest && (t.id === 'video-compat-btn' || t.closest('#video-body .collection-toolbar .view-mode-row') || (t.closest('#video-body .collection-toolbar .filter-bar') && !(t.id === 'video-search' && !t.readOnly)))) {
        const first = ctrlItems()[0];   // none while the window is shut (its copy stays in the page, hidden)
        if (first) { e.preventDefault(); e.stopImmediatePropagation(); first.focus(); }
      }
      return;
    }
    if (t === q && !q.readOnly) {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); e.stopImmediatePropagation(); endTyping(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); e.stopImmediatePropagation(); endTyping(); const nx = nearest(q, 'down'); if (nx) glide(nx); }
      return;
    }
    if (t === q && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopImmediatePropagation(); startTyping(); return; }
    const row = t.closest && t.closest('.cl-row');
    if (row) {
      const i = +row.dataset.i, r = rows[i];
      let done = true;
      switch (e.key) {
        case 'ArrowDown': focusRow(i + 1); break;
        case 'ArrowUp': if (i === 0) { const h = headEl.querySelector('.cl-sort.on') || headEl.querySelector('.cl-sort'); if (h) glide(h); } else focusRow(i - 1); break;
        case 'PageDown': focusRow(i + Math.max(1, Math.floor(scroller.clientHeight / rowH) - 2)); break;
        case 'PageUp': focusRow(i - Math.max(1, Math.floor(scroller.clientHeight / rowH) - 2)); break;
        case 'Home': focusRow(0); break;
        case 'End': focusRow(rows.length - 1); break;
        case 'ArrowRight': toggle(r, true); break;
        case 'ArrowLeft': if (r && r.child) { const p = rows.findIndex(x => x.g === r.g && !x.child); if (p >= 0) focusRow(p); } else toggle(r, false); break;
        case 'Enter': case ' ': openLightbox(r); break;
        default: done = false;
      }
      if (done) { e.preventDefault(); e.stopImmediatePropagation(); }
      return;
    }
    const dir = DIRS[e.key];
    if (!dir) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (dir === 'down' && t.closest && t.closest('[data-cl-head]')) { focusRow(cur); return; }
    const nx = nearest(t, dir);
    if (nx) { glide(nx); return; }
    if (dir === 'down' && rows.length) { focusRow(cur); return; }
    if (dir === 'up') { const b = document.getElementById('video-compat-btn'); if (b) b.focus(); }
  }
  function startTyping() { const q = root.querySelector('[data-cl-q]'); q.readOnly = false; q.removeAttribute('inputmode'); try { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } catch (_) {} }
  function endTyping() { const q = root.querySelector('[data-cl-q]'); q.readOnly = true; q.setAttribute('inputmode', 'none'); }

  /* ------------------------------------------------------------------ mount */
  let typingT = 0;
  function refreshTop() {
    /* Redrawing the chips and keys drops the focus: keep it on the same control. */
    const fa = document.activeElement, fd = fa && root.contains(fa) && fa.dataset ? fa.dataset : null;
    const fsel = fd ? ['clCard', 'clKind', 'clStatus', 'clSort'].filter(k => fd[k] != null).map(k => `[data-${k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}="${fd[k]}"]`)[0] : '';
    const bar = root.querySelector('[data-cl-bar]'); if (bar) bar.innerHTML = barHTML();
    const [sys, kinds] = chipsHTML();
    root.querySelector('[data-cl-sysbox]').innerHTML = sys;
    root.querySelector('[data-cl-kindbox]').innerHTML = kinds;
    headEl.innerHTML = headHTML();
    const sw = root.querySelector('[data-cl-sweep]'); if (sw) sw.textContent = sweepText();
    if (fsel && !root.contains(document.activeElement)) keepFocus(fsel);
  }
  function keepFocus(sel) { const f = sel && root.querySelector(sel); if (f) { try { f.focus({ preventScroll: true }); } catch (_) {} } }
  /* THE LOADING SCREEN (21 Oct): the site's own loading card (index.html .loading-card,
     spinner, bar) in the window while the list comes in, then the list. The first time the window
     fills, the card stands in for everything under the heading; later loads (another system chosen
     before its list came) replace only the table, so the chip just pressed keeps the focus. */
  let everShown = false, indexTried = false;
  function showLoading() {
    if (!root) return;
    const need = filesFor(S.card), done = need.filter(f => loadedFiles.has(f) || failedFiles.has(f)).length;
    const broken = indexTried && !index;
    const loading = broken || !index || done < need.length;
    if (!loading) everShown = true;
    root.dataset.loading = !loading ? '' : (everShown ? 'list' : 'full');
    const card = root.querySelector('[data-cl-loading]'); if (!card) return;
    card.hidden = !loading;
    card.classList.toggle('cl-load-broken', broken);
    const fill = card.querySelector('[data-cl-load-fill]'), stat = card.querySelector('[data-cl-load-stat]');
    if (fill) fill.style.width = (index && need.length ? Math.max(6, Math.round(done * 100 / need.length)) : 3) + '%';
    if (stat) stat.textContent = broken ? 'The list could not be loaded. Close the window and try again.' : !index ? 'Connecting…' : `${done} of ${need.length} ${need.length === 1 ? 'system' : 'systems'}`;
  }
  function ensureData() {
    if (!index) indexTried = false;
    showLoading();
    return loadIndex().then(() => {
      indexTried = true; failedFiles.clear();
      if (!index) { indexP = null; showLoading(); return; }   // the next opening asks again
      refreshTop();
      const need = filesFor(S.card).filter(f => !loadedFiles.has(f));
      if (!need.length) { rebuild(); return; }
      rebuild();
      return Promise.all(need.map(f => loadFile(f).then(() => { if (root && root.isConnected) { refreshTop(); rebuild(); } })));
    });
  }
  function measure() {
    const w = root.getBoundingClientRect().width;
    const size = w < 700 ? 's' : w < 1060 ? 'm' : 'l';
    const wide = Math.round(w) !== htW;   // a new width wraps the status text differently: measure again
    if (wide) { htW = Math.round(w); htOf.clear(); }
    if (root.dataset.size !== size) {
      root.dataset.size = size;
      rowH = size === 's' ? 76 : 58;
    } else if (!wide) return;
    if (rows.length) rebuild(rows[cur] ? rKey(rows[cur]) : null);
  }
  function mount(win) {
    root = win.querySelector('[data-cl-root]');
    if (!root) return;
    scroller = win;
    rowsEl = root.querySelector('[data-cl-rows]');
    headEl = root.querySelector('[data-cl-head]');
    const q = root.querySelector('[data-cl-q]');
    q.value = S.q;
    measure();
    try { new ResizeObserver(() => { if (root && root.isConnected) measure(); }).observe(root); } catch (_) {}
    if (!win.__clWired) { win.__clWired = true; win.addEventListener('scroll', schedule, { passive: true }); window.addEventListener('resize', schedule); }
    q.addEventListener('pointerdown', () => { if (q.readOnly) startTyping(); });
    q.addEventListener('blur', () => endTyping());
    q.addEventListener('input', () => { clearTimeout(typingT); typingT = setTimeout(() => { S.q = q.value; rebuild(); }, 160); });
    root.addEventListener('click', ev => {
      const t = ev.target; if (!t || !t.closest) return;
      const st = t.closest('[data-cl-status]');
      if (st) { const v = +st.dataset.clStatus; S.status = (v === S.status && v >= 0) ? -1 : v; refreshTop(); rebuild(); keepFocus(`[data-cl-status="${S.status}"]`); return; }
      const cd = t.closest('[data-cl-card]');
      if (cd) { S.card = cd.dataset.clCard; cur = 0; scroller.scrollTop = 0; ensureData().then(() => keepFocus(`[data-cl-card="${S.card}"]`)); keepFocus(`[data-cl-card="${S.card}"]`); return; }
      const kd = t.closest('[data-cl-kind]');
      if (kd) { S.kind = kd.dataset.clKind; cur = 0; refreshTop(); rebuild(); keepFocus(`[data-cl-kind="${S.kind}"]`); return; }
      const so = t.closest('[data-cl-sort]');
      if (so) { const k = so.dataset.clSort; if (S.sort === k) S.dir = -S.dir; else { S.sort = k; S.dir = (k === 'date') ? -1 : 1; } refreshTop(); rebuild(); keepFocus(`[data-cl-sort="${k}"]`); return; }
      const row = t.closest('.cl-row');
      if (row) {
        const i = +row.dataset.i;
        if (t.closest('[data-cl-toggle]')) { toggle(rows[i]); return; }
        if (t.closest('.cl-c-clip') || (t.closest('.cl-c-cover') && t.closest('.cl-row').classList.contains('cl-playing') && !t.closest('.cl-row').querySelector('.cl-c-clip').offsetParent)) { focusRow(i, 'pointer'); openLightbox(rows[i]); return; }
        focusRow(i, 'pointer');
      }
    });
    root.addEventListener('focusin', ev => {
      const row = ev.target.closest && ev.target.closest('.cl-row');
      if (row) { cur = +row.dataset.i; playClip(row); } else stopClip();
    });
    root.addEventListener('focusout', ev => { if (!ev.relatedTarget || !root.contains(ev.relatedTarget)) stopClip(); });
    ensureData();
  }
  function unmount() { stopClip(); }
  window.addEventListener('keydown', onKey, true);
  (function css() {
    if (document.getElementById('cl-css')) return;
    const l = document.createElement('link'); l.id = 'cl-css'; l.rel = 'stylesheet'; l.href = 'compat.css?v=' + VERSION;
    document.head.appendChild(l);
  })();
  /* THE LINK (deeplinks.js, #/compatibility?system=nes&status=nothing&kind=hack&q=mario). */
  function queryOf() {
    const p = [];
    if (S.card) p.push('system=' + encodeURIComponent(S.card));
    if (S.status >= 0) p.push('status=' + STATUS_KEY[S.status]);
    if (S.kind) p.push('kind=' + encodeURIComponent(S.kind));
    if (S.q) p.push('q=' + encodeURIComponent(S.q));
    return p.join('&');
  }
  function setQuery(q) {
    const u = new URLSearchParams(q || '');
    const sys = u.get('system') || '', st = STATUS_KEY.indexOf(u.get('status') || ''), kind = u.get('kind') || '';
    S.card = CARDS.some(c => c[0] === sys) ? sys : '';
    S.status = st;
    S.kind = KIND[kind] ? kind : '';
    S.q = u.get('q') || '';
    cur = 0;
    if (root && root.isConnected) { const qi = root.querySelector('[data-cl-q]'); if (qi) qi.value = S.q; ensureData(); }
  }
  window.CompatList = { html, mount, unmount, setQuery, version: VERSION };
})();

/*
 * settings-sources.js -- Settings > Media and content: one tile per source (2026-10-24).
 *
 * WHY (24 Oct): "At the top we have tiles for each source type ... all sources grouped
 * together as we recognised they all perform the same task of providing data. When a user wants
 * to set up a data source they get a unified UI and fill out the options. Once set up, the data
 * source button is marked as configured and now instead of the setup UI, clicking on the tile
 * modifies its settings." Design and inventory: docs/SETTINGS-REDESIGN.md section 9.
 *
 * WHAT. The page now reads, top to bottom:
 *     Sources: a tile per source (icon, name, content, source location, Configured / Not set up)
 *     Media page and subtitles: Grid layout, Ambient widgets, Subtitles (not sources)
 * Choosing a tile opens ONE panel layout, the same for every source: title, what it provides,
 * its fields (or, once configured, its current settings and its own actions), one primary action
 * and Cancel (none on the content pack, and no Done once configured: the back button leaves). Back, Escape, a remote's Back and the pad's B close it first.
 *
 * HOW, WITHOUT REWRITING ANYONE. Nothing here signs in, connects or opens a file itself: the
 * panels hold the very nodes the other files draw, MOVED, with their ids, handlers and storage
 * keys unchanged.
 *   - Media server (emby.js): emby.js writes its whole Settings part into ONE node,
 *     .settings-panel[data-panel="videologin"], with one innerHTML, and its handlers look things
 *     up inside that node at the time of the event. So the node is never split: it moves whole
 *     into the media server panel while that panel is open, and back under "Media page and
 *     subtitles" when it closes. Its sections are marked by their heading (data-src-part): the
 *     panel shows the media server's own (Media Login, Playback, Server conversion), the page
 *     shows the rest. The primary "Sign in" submits emby.js's own form.
 *   - Game server (cws.js): #cws-section (its rows and per-server actions) moves into the game
 *     server panel. Set up is an address box that calls CWS.directConnect(), the same call the
 *     Direct connect dialog makes; pairing and the PIN then use cws.js's own dialogs.
 *   - Content pack (index.html): #content-pack-section moves into its panel; the primary calls
 *     gnwContentPackToggle(), the section's own button.
 * Configured is read from what those files show: emby.js's session (Emby.session.active), a
 * server row in cws.js's list, the content pack's has(). Each tile redraws when its source's
 * nodes change (a MutationObserver), so a sign-in, a pairing or a close shows at once.
 * switchSettingsTab('videologin') (the Media page's "Connect a media server") opens the media
 * server panel; every other name shows the tiles. Sound: none.
 */
(function () {
  'use strict';
  if (window.GnwSources) return;
  const BUILD = '20261104-q1a';

  const ICON = {
    emby: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><path d="m10 8 5 2.5-5 2.5z"/></svg>',
    jellyfin: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M12 7.5 8.5 13.5h7z"/></svg>',
    cws:  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="7" rx="1.5"/><rect x="3" y="14" width="18" height="7" rx="1.5"/><path d="M7 6.5h.01M7 17.5h.01M11 6.5h6M11 17.5h6"/></svg>',
    stories: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 6.5C10.2 5 7.2 4.5 3.5 5v13.5c3.7-.5 6.7 0 8.5 1.5 1.8-1.5 4.8-2 8.5-1.5V5c-3.7-.5-6.7 0-8.5 1.5z"/><path d="M12 6.5V20"/></svg>',
    pack: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M10 9h1M10 12h1M10 15h1M10 18h1"/></svg>',
    file: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m10 11.5 5 3-5 3z"/></svg>',
    host: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M7 20h10M12 16v4"/><path d="m9 8-2 2 2 2M15 8l2 2-2 2"/></svg>',
  };
  /* The site's source on GitHub, for "Host it yourself" (28 Oct). README names no
     address yet: fill it in here and the step links to it. Empty, the step reads without a link. */
  const HOST_REPO = 'https://github.com/crystalworlds/client';
  const SOURCES = [
    { id: 'emby', name: 'Media server', kind: 'Emby', content: 'Films and series', where: 'Server',
      provides: 'Your own films and series from your Emby server, shown on the content page and played in the site\'s player.' },
    /* Jellyfin (26 Oct): the same panel and the same emby.js node as Emby, drawn for
       Jellyfin. Both can be signed in; one is in use at a time, the one switched on (31 Oct). */
    { id: 'jellyfin', name: 'Media server', kind: 'Jellyfin', content: 'Films and series', where: 'Server',
      provides: 'Your own films and series from your Jellyfin server, shown on the content page and played in the site\'s player. Sign in with the server\'s address and your Jellyfin user name and password, or with Quick Connect when the server has it switched on.' },
    { id: 'cws', name: 'Game server', kind: 'Crystal Worlds Game Server', content: 'Games and firmware', where: 'Local or Server',
      provides: 'Your own games from a Crystal Worlds Game Server.' },
    { id: 'pack', name: 'Content pack', kind: '.zip file', content: 'Games, firmware and artwork', where: 'File',
      provides: 'One .zip of your own firmware, game files, segment artwork and colour-unit flash, opened from this device. The site identifies everything by its content. It is kept in this browser.' },
    /* Stories (7 Nov): for 16-Bit sponsors, read from GitHub with their own sign-in (stories.js). This tile holds no story content. */
    { id: 'stories', name: 'Stories', kind: 'Sign in with GitHub', content: 'Stories', where: 'GitHub',
      provides: 'Stories for 16-Bit sponsors, to read and listen to here. They stay on GitHub, and this site reads them with your own sign-in.' },
    /* 28 Oct ("bridging the gap between what we support and what's in the
       interface"): a game file played at once from memory (play-file.js), and how to run a copy
       of the site with the firmware folder (instructions only, from README "Setting it up"). */
    { id: 'file', name: 'Play a file', kind: 'Game file or .zip', content: 'One game', where: 'This device', plain: true,
      provides: 'Play one game file from this device straight away. The file is read into this page\'s memory, played, and let go when the game closes. The file itself is not kept. The game\'s own save is kept on this device, so the same file picks up where you left off.' },
    { id: 'host', name: 'Host it yourself', kind: 'Instructions', content: 'Games and firmware', where: 'Your computer', plain: true,
      provides: 'Run your own copy of the site on your computer, with your games and firmware built into it. These are the steps; nothing is set up from here.' },
  ];
  const byId = id => SOURCES.find(s => s.id === id);
  /* The media server tiles, and which kind the signed-in one is ('emby' when none). */
  const isMedia = id => id === 'emby' || id === 'jellyfin';
  const mediaType = () => { try { return (window.Emby && window.Emby.serverType && window.Emby.serverType()) || 'emby'; } catch (_) { return 'emby'; } };
  /* The media server's own sections in emby.js's node, by their heading. Anything else in that
     node (Grid layout, Ambient widgets, Subtitles, and anything added later) is general. */
  const EMBY_OWN = /^(media login|playback|server conversion)$/i;

  const $ = s => document.querySelector(s);
  const contentPanel = () => $('#vault-overlay .settings-panel[data-panel="content"]');
  const embyMount = () => $('#vault-overlay .settings-panel[data-panel="videologin"]');
  let openId = null;       // the source whose panel is open, or null (the tiles)
  let built = false;
  let cwsBusy = false;

  /* ------------------------------------------------------------ styles */
  function styles() {
    if (document.getElementById('src-style')) return;
    const st = document.createElement('style');
    st.id = 'src-style';
    st.textContent = `
      #src-top, #src-general { display: flex; flex-direction: column; gap: 14px; }
      #vault-overlay .src-h { margin: 2px 0 0; font-size: 11px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; color: var(--muted); }
      /* #vault-overlay: index.html's .article p (15.5px, a fixed light grey) outranks a bare class. */
      #vault-overlay .src-intro { margin: -6px 0 0; font-size: 12.5px; line-height: 1.55; color: var(--muted); }
      .src-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 228px), 1fr)); gap: 10px; }
      .src-tile {
        display: grid; grid-template-columns: auto 1fr; column-gap: 12px; row-gap: 8px; align-items: start;
        width: 100%; min-height: 44px; padding: 14px; text-align: left; cursor: pointer;
        border: 1px solid var(--line); border-radius: 14px; background: rgba(127,127,127,.05);
        color: var(--text); font: inherit; transition: border-color .15s, background .15s;
      }
      .src-tile[data-on="1"] { border-color: rgba(var(--accent-rgb),.45); background: rgba(var(--accent-rgb),.07); }
      .src-tile:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-color: var(--accent); }
      .src-ico { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 10px;
        background: rgba(var(--accent-rgb),.12); color: var(--accent); flex: 0 0 auto; }
      .src-tile .src-main { min-width: 0; }
      .src-name { display: block; font-size: 14px; font-weight: 800; color: var(--text); line-height: 1.25; }
      .src-kind { display: block; font-size: 12px; color: var(--muted); margin-top: 2px; }
      .src-facts { grid-column: 1 / -1; display: grid; grid-template-columns: auto 1fr; gap: 3px 10px; margin: 0; font-size: 12px; line-height: 1.4; }
      .src-facts dt { color: var(--muted); }
      .src-facts dd { margin: 0; color: var(--text); font-weight: 600; }
      .src-state { grid-column: 1 / -1; justify-self: start; display: inline-flex; align-items: center; gap: 6px;
        padding: 4px 10px; border-radius: 20px; font-size: 11.5px; font-weight: 700; letter-spacing: .02em;
        border: 1px solid var(--line); color: var(--muted); }
      .src-state[data-on="1"] { color: var(--accent); border-color: rgba(var(--accent-rgb),.5); background: rgba(var(--accent-rgb),.12); }
      .src-state .src-dot { width: 7px; height: 7px; border-radius: 50%; border: 1.5px solid currentColor; }
      .src-state small { font-weight: 600; color: var(--muted); font-size: 11.5px; }

      #src-sheet { display: flex; flex-direction: column; gap: 14px; }
      #src-sheet[hidden], .src-body[hidden], #src-top[hidden], #src-general[hidden] { display: none !important; }
      .src-sheet-head { display: grid; grid-template-columns: auto 1fr; gap: 12px 12px; align-items: start; }
      .src-sheet-back { grid-column: 1 / -1; justify-self: start; }
      .src-sheet-id { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; min-width: 0; }
      #vault-overlay .src-sheet-title { margin: 0; font-size: 17px; font-weight: 800; color: var(--text); line-height: 1.25; }
      .src-sheet-head .src-facts { margin: 0; }
      #vault-overlay .src-provides { margin: 0; font-size: 12.5px; line-height: 1.55; color: var(--muted); }
      .src-body { display: flex; flex-direction: column; gap: 14px; }
      .src-foot { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; padding-top: 2px; }
      #vault-overlay .src-foot[hidden], #vault-overlay #src-cancel[hidden], #vault-overlay #src-primary[hidden] { display: none !important; }
      .src-primary { background: var(--accent); color: var(--on-accent, #0a0e14); border: 0; padding: 10px 18px; border-radius: 9px;
        font-weight: 700; cursor: pointer; font-size: 13px; font-family: inherit; min-height: 40px; }
      .src-primary:disabled { opacity: .6; cursor: default; }
      .src-primary:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
      .src-field label { display: block; font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
      .src-field input { width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 10px; background: rgba(127,127,127,.06);
        border: 1px solid var(--line); color: var(--text); font-size: 13px; font-family: ui-monospace, Consolas, monospace; }
      .src-msg { margin-top: 8px; font-size: 12px; color: var(--muted); min-height: 18px; line-height: 1.5; }
      #vault-overlay .src-note { margin: 0; font-size: 12.5px; line-height: 1.55; color: var(--muted); }
      #vault-overlay .src-note small { font-size: 11.5px; font-style: italic; }

      /* The moved sections: their own heading (and lead paragraph) is the panel's title now. */
      #src-sheet [data-src-lead] > label:first-child,
      #src-sheet [data-src-lead] > label:first-child + p { display: none !important; }
      #src-sheet [data-src-lead] { border: 0; padding: 0; background: none; }
      #src-sheet .src-body > .settings-panel { display: flex; flex-direction: column; gap: 14px; margin-top: 0; }
      #src-sheet .vault-section[style*="margin-top"] { margin-top: 0 !important; }
      /* emby.js's one node shows the media server's parts in its panel and the rest on the page. */
      #src-sheet .settings-panel[data-panel="videologin"] > [data-src-part="general"] { display: none; }
      #src-general .settings-panel[data-panel="videologin"] > [data-src-part="emby"] { display: none; }
      #src-general .settings-panel[data-panel="videologin"] { display: flex; flex-direction: column; gap: 14px; margin-top: 0; }
      #src-general .vault-section[style*="margin-top"] { margin-top: 0 !important; }
      /* Set up: the panel's primary stands for the source's own button. */
      #src-sheet[data-mode="setup"] #emby-submit,
      #src-sheet[data-mode="setup"] #content-pack-btn { display: none; }
      #src-sheet[data-mode="setup"] #content-pack-btn + * { margin: 0; }
      /* The on/off switch of a set-up source (28 Oct): the look of the Systems strip's
         Movies and Widgets switches (emby.js .vgsw), a button of its own in the tile's top right. */
      .src-grid > div { position: relative; }
      .src-tile[data-src="emby"], .src-tile[data-src="jellyfin"], .src-tile[data-src="cws"], .src-tile[data-src="pack"] { padding-right: 60px; }
      .src-tile[data-off="1"] .src-ico, .src-tile[data-off="1"] .src-main, .src-tile[data-off="1"] .src-facts { opacity: .55; }
      .src-tile[data-off="1"] { border-color: var(--line); background: rgba(127,127,127,.05); }
      .src-tile[data-off="1"] .src-state { color: var(--muted); border-color: var(--line); background: none; }
      .src-sw { position: absolute; top: 10px; right: 10px; width: 44px; height: 28px; padding: 4px; margin: 0; border: 0; border-radius: 14px;
        background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; }
      .src-sw[hidden] { display: none !important; }
      .src-sw::before { content: ''; position: absolute; left: 4px; top: 4px; width: 36px; height: 20px; box-sizing: border-box; border-radius: 10px;
        background: rgba(127,127,127,.28); border: 1.5px solid var(--muted); transition: background .15s, border-color .15s; }
      .src-sw .src-sw-knob { position: absolute; top: 8px; left: 8px; width: 13px; height: 13px; border-radius: 50%; background: var(--muted); transition: left .15s, background .15s; }
      .src-sw[aria-checked="true"]::before { background: var(--accent); border-color: var(--accent); }
      .src-sw[aria-checked="true"] .src-sw-knob { left: 24px; background: var(--on-accent, #0d0f0a); }
      .src-sw:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
      body.gnw-tv .src-sw { width: 56px; height: 34px; top: 8px; right: 8px; }
      body.gnw-tv .src-sw::before { width: 46px; height: 26px; left: 5px; border-radius: 13px; }
      body.gnw-tv .src-sw .src-sw-knob { width: 18px; height: 18px; top: 8px; left: 9px; }
      body.gnw-tv .src-sw[aria-checked="true"] .src-sw-knob { left: 29px; }
      body.gnw-tv .src-tile[data-src="emby"], body.gnw-tv .src-tile[data-src="jellyfin"], body.gnw-tv .src-tile[data-src="cws"], body.gnw-tv .src-tile[data-src="pack"] { padding-right: 72px; }
      @media (prefers-reduced-motion: reduce) { .src-sw::before, .src-sw .src-sw-knob { transition: none; } }
      /* Play a file, Host it yourself (28 Oct). */
      .src-drop { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; text-align: center;
        min-height: 150px; padding: 22px 16px; border: 2px dashed rgba(var(--accent-rgb),.45); border-radius: 14px;
        background: rgba(var(--accent-rgb),.05); transition: border-color .15s, background .15s; }
      .src-drop.src-drop-over { border-color: var(--accent); background: rgba(var(--accent-rgb),.14); }
      #vault-overlay .src-drop-big { margin: 0; font-size: 15px; font-weight: 700; color: var(--text); }
      #vault-overlay .src-drop .src-note { margin: 0; }
      .src-file-choose { display: flex; flex-wrap: wrap; gap: 8px; }
      .src-file-choose[hidden] { display: none !important; }
      .src-file-choose .btn-tiny { min-height: 40px; text-align: left; }
      #vault-overlay .src-steps { margin: 0; padding-left: 1.4em; display: flex; flex-direction: column; gap: 12px;
        font-size: 13px; line-height: 1.6; color: var(--text); }
      #vault-overlay .src-steps li { padding-left: 2px; }
      #vault-overlay .src-steps.src-limits { gap: 4px; }
      #vault-overlay .src-steps code, #vault-overlay .src-note code { font-family: ui-monospace, Consolas, monospace; font-size: 12px;
        padding: 1px 5px; border-radius: 5px; background: rgba(127,127,127,.12); overflow-wrap: anywhere; }
      .src-table-wrap { margin-top: 8px; overflow-x: auto; max-width: 100%; }
      #vault-overlay .src-table { border-collapse: collapse; font-size: 12.5px; line-height: 1.45; width: 100%; }
      #vault-overlay .src-table th, #vault-overlay .src-table td { text-align: left; padding: 5px 10px 5px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
      #vault-overlay .src-table th { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); font-weight: 700; }
      #vault-overlay .src-steps a { color: var(--accent); }
    `;
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------ Play a file, Host it yourself */
  function fileBodyHTML() {
    const accept = (window.CwPlayFile && window.CwPlayFile.ACCEPT) || '.gb,.gbc,.sgb,.nes,.unf,.unif,.fds,.min,.a26,.a52,.car,.a78,.lnx,.lyx,.o,.zip,.bin';
    return '<div class="src-drop" id="src-file-drop">' +
        '<p class="src-drop-big">Drop a game file or a .zip here</p>' +
        '<p class="src-note">or</p>' +
        '<button type="button" class="src-primary src-file-pick" id="src-file-pick">Choose a file…</button>' +
        '<input type="file" id="src-file-input" accept="' + esc(accept) + '" hidden>' +
      '</div>' +
      '<div class="src-msg" id="src-file-msg" role="status" aria-live="polite"></div>' +
      '<div class="src-file-choose" id="src-file-choose" hidden></div>' +
      '<p class="src-note">Game Boy and Game Boy Color (.gb, .gbc), NES and Famicom (.nes, .unf, .fds), Pokémon mini (.min), Atari 2600, 5200, 7800 and Lynx (.a26, .a52, .a78, .lnx), or a .zip holding one or more of them. Disk System and Pokémon mini games also need their console\'s firmware from a content pack or a game server.</p>';
  }
  function hostBodyHTML() {
    const repo = HOST_REPO ? '<a href="' + esc(HOST_REPO) + '" target="_blank" rel="noopener">its GitHub page</a>' : 'its GitHub page';
    const row = (f, s) => '<tr><td><code>' + f + '</code></td><td>' + s + '</td></tr>';
    return '<ol class="src-steps">' +
      '<li><b>Get the site.</b> Download the site\'s files from ' + repo + ' (<b>Code</b>, then <b>Download ZIP</b>) and unpack them into a folder on a Windows computer, or clone it with git.</li>' +
      '<li><b>Add your files.</b> Put your own game files and console firmware (BIOS) in <code>firmware\\games\\&lt;system&gt;\\</code>, one folder per system. Loose files, .zip files and sub-folders all work, and a system\'s firmware goes in the same folder as its games. After adding files, build again and reload the page.' +
        '<div class="src-table-wrap"><table class="src-table"><thead><tr><th>Folder</th><th>System</th></tr></thead><tbody>' +
        row('gb', 'Game Boy (.gb, plus its boot firmware if you have it)') + row('gbc', 'Game Boy Color (.gbc)') +
        row('nes', 'NES (.nes, .unf)') + row('famicom', 'Famicom (.nes)') + row('fds', 'Famicom Disk System (.fds, plus the Disk System firmware)') +
        row('gnw', 'Game &amp; Watch firmware, LCD artwork (.svg) and colour-unit flash') + row('pm', 'Pokémon mini (.min, plus bios.min)') +
        row('atari2600', 'Atari 2600 (.a26, .bin)') + row('atari5200', 'Atari 5200 (.a52, .bin, plus the 5200 BIOS)') +
        row('atari7800', 'Atari 7800 (.a78, .bin, plus the 7800 BIOS if you have it)') + row('lynx', 'Atari Lynx (.lnx, .lyx, .o, plus its boot program if you have it)') +
        '</tbody></table></div></li>' +
      '<li><b>Build the lists.</b> Double-click <code>firmware\\scripts\\build-&lt;system&gt;.cmd</code> (for example <code>build-gb.cmd</code>), or <code>build-all.cmd</code> for every system. Each one runs the PowerShell build, <code>build.ps1</code>, which identifies every file by its contents and writes the JSON lists the site reads into <code>firmware\\output\\</code>. <code>dry-run-all.cmd</code> shows what each build would read without writing anything.</li>' +
      '<li><b>Start the site.</b> Open PowerShell in the site\'s folder, run <code>.\\server.ps1</code> and open <code>http://localhost:8080/</code>. Always open the site through this address: double-clicking <code>index.html</code> to open it straight from the folder does not work.</li>' +
      '</ol>' +
      /* The limits the build scripts enforce (firmware\scripts\lib\build_nintendo.ps1 and
         build_atari.ps1, 4 Nov 2026). Keep in step with those files. */
      '<p class="src-note"><b>Limits.</b> A system with more games than its total is not built, and its lists stay as they were. A single file over its size is left out and named in the build\'s report.</p>' +
      '<ul class="src-steps src-limits">' +
        '<li>NES and Famicom: at most 64 games and 48 MB in all; one game at most 64 MB.</li>' +
        '<li>Game Boy and Game Boy Color together: at most 64 games and 32 MB in all; one game at most 8 MB.</li>' +
        '<li>Each Atari system: at most 256 MB in all; one game at most 512 KB on the 2600 and 5200, 1 MB on the 7800 and 2 MB on the Lynx.</li>' +
        '<li>Game &amp; Watch: one firmware file at most 256 KB, one LCD artwork file (.svg) at most 2 MB.</li>' +
        '<li>A .zip inside a .zip is opened up to 8 levels deep, 3 for the Atari systems.</li>' +
      '</ul>' +
      '<p class="src-note">Everything stays on your computer: the build only writes lists into your own copy of the site. The steps in full are in the README file that comes with the site, under "Setting it up", and in <code>firmware\\README.md</code>.</p>';
  }
  function wireFile(sheet) {
    const drop = sheet.querySelector('#src-file-drop'), pick = sheet.querySelector('#src-file-pick'), inp = sheet.querySelector('#src-file-input');
    const msg = sheet.querySelector('#src-file-msg'), list = sheet.querySelector('#src-file-choose');
    if (!drop || !pick || !inp) return;
    if (window.CwPlayFile) inp.accept = window.CwPlayFile.ACCEPT;
    const say = (t, bad) => { msg.textContent = t || ''; msg.style.color = bad ? '#f08a5d' : 'var(--muted)'; };
    const done = r => {
      if (r && r.choose) {
        say('This .zip holds ' + r.choose.length + ' games. Choose one:');
        list.innerHTML = r.choose.map((n, i) => '<button type="button" class="btn-tiny src-file-one" data-i="' + i + '">' + esc(n) + '</button>').join('');
        list.hidden = false;
        const f = list.querySelector('button'); if (f) { try { f.focus({ preventScroll: true }); } catch (_) {} }
        return;
      }
      list.hidden = true; list.innerHTML = '';
      if (r && r.ok) say('Playing ' + r.title + ' (' + r.label + ').');
      else say((r && r.msg) || 'That file could not be played.', true);
    };
    const go = file => {
      list.hidden = true; list.innerHTML = '';
      if (!window.CwPlayFile) { say('The player has not loaded. Reload the page and try again.', true); return; }
      say('Opening ' + (file && file.name ? file.name : 'the file') + '…');
      Promise.resolve(window.CwPlayFile.open(file)).then(done, e => say((e && e.message) || 'That file could not be played.', true));
    };
    pick.addEventListener('click', () => { inp.value = ''; inp.click(); });
    inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; inp.value = ''; if (f) go(f); });
    list.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('.src-file-one'); if (!b) return;
      list.hidden = true; list.innerHTML = '';
      say('Opening…');
      Promise.resolve(window.CwPlayFile.choose(+b.dataset.i)).then(done, () => say('That file could not be played.', true));
    });
    const over = on => drop.classList.toggle('src-drop-over', on);
    drop.addEventListener('dragenter', e => { e.preventDefault(); over(true); });
    drop.addEventListener('dragover', e => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; over(true); });
    drop.addEventListener('dragleave', e => { if (!drop.contains(e.relatedTarget)) over(false); });
    drop.addEventListener('drop', e => {
      e.preventDefault(); over(false);
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) go(f); else say('Drop a file from this device here.', true);
    });
  }

  /* ------------------------------------------------------------ building */
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function factsHTML(s) {
    return '<dl class="src-facts"><dt>Content</dt><dd>' + esc(s.content) + '</dd><dt>Source</dt><dd class="src-where">' + esc(s.where) + '</dd></dl>';
  }

  function build() {
    const cp = contentPanel();
    if (!cp) return false;
    styles();
    let top = document.getElementById('src-top');
    if (!top) {
      top = document.createElement('div');
      top.id = 'src-top';
      top.innerHTML = '<h3 class="src-h" id="src-h-sources">Sources</h3>' +
        '<p class="src-intro">Where the site gets your films, series and games. Choose one to set it up, or to change it once it is set up.</p>' +
        '<div class="src-grid" role="list" aria-labelledby="src-h-sources">' + SOURCES.map(s =>
          '<div role="listitem"><button type="button" class="src-tile" data-src="' + s.id + '" id="src-tile-' + s.id + '">' +
            '<span class="src-ico">' + ICON[s.id] + '</span>' +
            '<span class="src-main"><span class="src-name">' + esc(s.name) + '</span><span class="src-kind">' + esc(s.kind) + '</span></span>' +
            factsHTML(s) +
            '<span class="src-state" data-on="0"><span class="src-dot" aria-hidden="true"></span><span class="src-state-text">Not set up</span></span>' +
          '</button>' +
          (SWITCHABLE[s.id] ? '<button type="button" class="src-sw" id="src-sw-' + s.id + '" data-src-sw="' + s.id + '" role="switch" aria-checked="true" hidden><span class="src-sw-knob" aria-hidden="true"></span></button>' : '') +
          '</div>').join('') + '</div>';
      top.addEventListener('click', e => {
        // The switch is its own button beside the tile: pressing it never opens the panel.
        const w = e.target.closest && e.target.closest('.src-sw');
        if (w) { e.preventDefault(); e.stopPropagation(); flip(w.dataset.srcSw); return; }
        const t = e.target.closest && e.target.closest('.src-tile'); if (t) open(t.dataset.src, true);
      });
    }
    let sheet = document.getElementById('src-sheet');
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.id = 'src-sheet'; sheet.hidden = true;
      sheet.setAttribute('role', 'region'); sheet.setAttribute('aria-labelledby', 'src-sheet-title');
      sheet.innerHTML =
        '<div class="src-sheet-head">' +
          '<button type="button" class="btn-tiny src-sheet-back" data-src-act="close">&lsaquo; All sources</button>' +
          '<span class="src-ico" id="src-sheet-ico"></span>' +
          '<div class="src-sheet-id">' +
            '<h3 class="src-sheet-title" id="src-sheet-title"></h3>' +
            '<div id="src-sheet-facts"></div>' +
            '<span class="src-state" id="src-sheet-state" data-on="0"><span class="src-dot" aria-hidden="true"></span><span class="src-state-text"></span></span>' +
          '</div>' +
        '</div>' +
        '<p class="src-provides" id="src-sheet-provides"></p>' +
        '<div class="src-body" data-for="emby" hidden></div>' +
        '<div class="src-body" data-for="jellyfin" hidden></div>' +
        '<div class="src-body" data-for="cws" hidden>' +
          '<form class="src-cws-setup" autocomplete="off" novalidate>' +
            '<div class="src-field"><label for="src-cws-addr">Server address</label>' +
            '<input id="src-cws-addr" type="text" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="192.168.1.20:34580"></div>' +
            '<div class="src-msg" id="src-cws-msg" role="status"></div>' +
            '<p class="src-note">Type the address of a game server on your home network, or one whose owner gave you its address. The server\'s owner finds it on the server\'s Dashboard, under <b style="color:var(--text)">Connecting devices</b>.<br><small>The server\'s owner still decides: your vault code must be approved on the server, and you will need your profile\'s PIN.</small></p>' +
          '</form>' +
        '</div>' +
        '<div class="src-body" data-for="pack" hidden></div>' +
        '<div class="src-body" data-for="stories" hidden><p class="src-note">Stories are for <a href="https://github.com/sponsors/crystalworlds" target="_blank" rel="noopener noreferrer">16-Bit sponsors</a>.</p></div>' +
        '<div class="src-body" data-for="file" hidden>' + fileBodyHTML() + '</div>' +
        '<div class="src-body" data-for="host" hidden>' + hostBodyHTML() + '</div>' +
        '<div class="src-foot">' +
          '<button type="button" class="src-primary" id="src-primary" data-src-act="primary"></button>' +
          '<button type="button" class="btn-tiny" id="src-cancel" data-src-act="close">Cancel</button>' +
        '</div>';
      sheet.addEventListener('click', e => {
        const b = e.target.closest && e.target.closest('[data-src-act]');
        if (!b || !sheet.contains(b)) return;
        if (b.dataset.srcAct === 'close') close(true);
        else if (b.dataset.srcAct === 'primary') primary();
      });
      sheet.querySelector('.src-cws-setup').addEventListener('submit', e => { e.preventDefault(); primary(); });
      wireFile(sheet);
    }
    let gen = document.getElementById('src-general');
    if (!gen) {
      gen = document.createElement('div');
      gen.id = 'src-general';
      /* No heading and no "appears once set up" note (24 Oct: that reads as a developer
         note). The general settings left here (Subtitles) carry their own heading, and the whole
         area hides when nothing is in it. */
      gen.innerHTML = '';
    }
    if (top.parentNode !== cp) cp.insertBefore(top, cp.firstChild);
    if (sheet.parentNode !== cp) cp.insertBefore(sheet, top.nextSibling);
    if (gen.parentNode !== cp) cp.insertBefore(gen, sheet.nextSibling);
    if (!built) {
      built = true;
      const mo = new MutationObserver(schedule);
      mo.observe(cp, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
    }
    gather();
    return true;
  }

  /* Put each source's nodes where they belong now: into the open panel, or home. */
  function gather() {
    const cp = contentPanel(); if (!cp) return;
    const sheet = document.getElementById('src-sheet'), gen = document.getElementById('src-general');
    if (!sheet || !gen) return;
    const slot = id => sheet.querySelector('.src-body[data-for="' + id + '"]');
    const pack = document.getElementById('content-pack-section');
    if (pack && pack.parentNode !== slot('pack')) slot('pack').appendChild(pack);
    const cws = document.getElementById('cws-section');
    if (cws && cws.parentNode !== slot('cws')) slot('cws').appendChild(cws);
    const m = embyMount();
    if (m) {
      const want = isMedia(openId) ? slot(openId) : gen;
      if (m.parentNode !== want) {
        want.appendChild(m);
      }
      let any = false;
      Array.from(m.children).forEach((c, i) => {
        const l = c.querySelector(':scope > label');
        const part = l && EMBY_OWN.test((l.textContent || '').trim()) ? 'emby' : 'general';
        if (c.dataset.srcPart !== part) c.dataset.srcPart = part;
        if (part === 'general' && !c.hidden) any = true;
        if (i === 0) { if (!c.hasAttribute('data-src-lead')) c.setAttribute('data-src-lead', ''); }
        else if (c.hasAttribute('data-src-lead')) c.removeAttribute('data-src-lead');
      });
      gen.hidden = !any;
    }
    if (pack && !pack.hasAttribute('data-src-lead')) pack.setAttribute('data-src-lead', '');
    if (cws && !cws.hasAttribute('data-src-lead')) cws.setAttribute('data-src-lead', '');
  }

  /* ------------------------------------------------------------ state of each source */
  /* THE ON/OFF SWITCH (28 Oct: "turn data sources on and off ... I don't need
     to log out or disconnect a source I want but don't want right now"). A set-up source shows a
     switch in its tile's top right corner; off, it stays set up (sign-in, addresses, vault code,
     pack all kept) and the site reads it as not set up (source-switch.js). */
  const SWITCHABLE = { emby: 1, jellyfin: 1, cws: 1, pack: 1 };
  const switchOn = id => { try { return !window.CwSources || window.CwSources.on(id); } catch (_) { return true; } };
  function flip(id) {
    if (!window.CwSources || !SWITCHABLE[id]) return;
    window.CwSources.set(id, !window.CwSources.on(id));   // the sources and the wall answer the event
    /* A media server switched (31 Oct): both kinds can be signed in, and the switch decides which one is
       in use, so emby.js's part of Settings is drawn again for the panel open, or the one now in use. */
    if (isMedia(id) && window.Emby && typeof window.Emby.renderLoginPanel === 'function') { try { window.Emby.renderLoginPanel(isMedia(openId) ? openId : mediaType()); } catch (_) {} }
    render();
  }
  function state(id) {
    if (isMedia(id)) {
      const S = window.Emby && window.Emby.session;
      // Each kind is signed in on its own (31 Oct: Emby and Jellyfin both signed in, one switched on).
      const on = window.Emby && typeof window.Emby.signedInAs === 'function' ? window.Emby.signedInAs(id)
        : !!(S && ('signedIn' in S ? S.signedIn : S.active)) && mediaType() === id;
      const off = on && !switchOn(id);
      return { on, off, detail: off ? 'Switched off' : on ? 'Signed in' : '' };
    }
    if (id === 'cws') {
      const rows = Array.from(document.querySelectorAll('#cws-list .cws-row'));
      if (!rows.length) return { on: false, detail: '' };
      if (!switchOn('cws')) return { on: true, off: true, detail: 'Switched off' };
      const ready = rows.filter(r => r.dataset.state === 'ready').length;
      let detail;
      if (ready) detail = ready === rows.length ? (rows.length === 1 ? 'Connected' : rows.length + ' servers connected') : ready + ' of ' + rows.length + ' connected';
      else { const s = rows[0].querySelector('.cws-state'); detail = s ? s.textContent.trim() : ''; }
      return { on: true, detail };
    }
    if (id === 'pack') {
      const P = window.__GNW_PACK;
      const on = !!(P && (typeof P.kept === 'function' ? P.kept() : P.has()));
      const off = on && !switchOn('pack');
      return { on, off, detail: off ? 'Switched off' : on ? 'Open' : '' };
    }
    if (id === 'stories') return window.CwStories ? window.CwStories.tileState() : { on: false, detail: '' };
    // Nothing to set up on these two: they say what they are instead.
    if (id === 'file') return { on: false, text: (window.CwPlayFile && window.CwPlayFile.playing()) ? 'Playing' : 'Ready' };
    if (id === 'host') return { on: false, text: 'Steps to follow' };
    return { on: false, detail: '' };
  }
  function paintState(el, st) {
    if (!el) return;
    el.dataset.on = st.on ? '1' : '0';
    const t = el.querySelector('.src-state-text');
    const html = st.text ? esc(st.text) : (st.on ? 'Configured' : 'Not set up') + (st.on && st.detail ? ' <small>&middot; ' + esc(st.detail) + '</small>' : '');
    if (t && t.innerHTML !== html) t.innerHTML = html;
    const dot = el.querySelector('.src-dot');
    if (dot) dot.style.background = st.on ? 'currentColor' : 'transparent';
  }

  let pending = 0;
  // A timer, not an animation frame: a hidden tab runs no frames and the redraw would wait.
  function schedule() { if (pending) return; pending = setTimeout(() => { pending = 0; render(); }, 20); }
  let soonT = 0;   // one second paint for a burst of events (28 Oct: one per game file the wall's tiles load)
  function scheduleSoon() { schedule(); if (!soonT) soonT = setTimeout(() => { soonT = 0; render(); }, 120); }

  function render() {
    if (!build()) return;
    for (const s of SOURCES) {
      const st = state(s.id);
      const tile = document.getElementById('src-tile-' + s.id);
      if (tile) {
        if (tile.dataset.on !== (st.on ? '1' : '0')) tile.dataset.on = st.on ? '1' : '0';
        paintState(tile.querySelector('.src-state'), st);
        const label = s.name + ', ' + s.content + ', source ' + s.where + ', ' + (st.text ? st.text.toLowerCase() : st.on ? 'configured' + (st.off ? ', switched off' : '') : 'not set up');
        if (tile.getAttribute('aria-label') !== label) tile.setAttribute('aria-label', label);
        const offAttr = st.off ? '1' : '0';
        if (tile.dataset.off !== offAttr) tile.dataset.off = offAttr;
      }
      const sw = document.getElementById('src-sw-' + s.id);
      if (sw) {
        const hide = !st.on;                      // nothing set up: nothing to switch
        if (sw.hidden !== hide) sw.hidden = hide;
        const v = String(!st.off);
        if (sw.getAttribute('aria-checked') !== v) sw.setAttribute('aria-checked', v);
        const sl = s.name + (isMedia(s.id) ? ' (' + s.kind + ')' : '') + ': ' + (st.off ? 'off' : 'on');
        if (sw.getAttribute('aria-label') !== sl) { sw.setAttribute('aria-label', sl); sw.title = sl; }
      }
    }
    const sheet = document.getElementById('src-sheet');
    const cp = contentPanel();
    const top = document.getElementById('src-top'), gen = document.getElementById('src-general');
    if (!openId) {
      if (!sheet.hidden) sheet.hidden = true;
      if (top.hidden) top.hidden = false;
      if (gen.hidden) gen.hidden = false;
      if (cp) cp.classList.remove('src-open');
      return;
    }
    const s = byId(openId), st = state(openId);
    const mode = st.on ? 'edit' : 'setup';
    if (sheet.dataset.mode !== mode) sheet.dataset.mode = mode;
    if (sheet.dataset.src !== openId) sheet.dataset.src = openId;
    const set = (id, prop, v) => { const el = document.getElementById(id); if (el && el[prop] !== v) el[prop] = v; };
    set('src-sheet-ico', 'innerHTML', ICON[openId]);
    // Two media server tiles share the name: the panel says which (Emby or Jellyfin).
    set('src-sheet-title', 'textContent', (st.on || s.plain ? '' : 'Set up: ') + s.name + (isMedia(openId) ? ' (' + s.kind + ')' : ''));
    set('src-sheet-facts', 'innerHTML', factsHTML(s));
    set('src-sheet-provides', 'textContent', s.provides + (st.off ? ' It is switched off: it stays set up here, and the site does not use it until it is switched on again with the switch on its tile.' : ''));
    paintState(document.getElementById('src-sheet-state'), st);
    sheet.querySelectorAll('.src-body').forEach(b => { const want = b.dataset.for !== openId; if (b.hidden !== want) b.hidden = want; });
    // Game server: the address box to set up; the server rows (cws.js) once one is there.
    const cwsForm = sheet.querySelector('.src-cws-setup'), cwsSec = document.getElementById('cws-section');
    if (cwsForm) { const h = openId === 'cws' && st.on; if (cwsForm.hidden !== h) cwsForm.hidden = h; cwsForm.style.display = h ? 'none' : ''; }
    if (cwsSec) { const h = !st.on; cwsSec.style.display = h ? 'none' : ''; }
    // The footer: one primary while setting up, then Done.
    const prim = document.getElementById('src-primary'), cancel = document.getElementById('src-cancel');
    let label = '', disabled = false;
    if (mode === 'setup') {
      if (isMedia(openId)) { const b = document.getElementById('emby-submit'); label = b ? b.textContent.trim() : 'Sign in'; disabled = !b || b.disabled; }
      else if (openId === 'cws') { label = cwsBusy ? 'Connecting…' : 'Connect'; disabled = cwsBusy; }
      else if (openId === 'pack') { const b = document.getElementById('content-pack-btn'); label = b ? b.textContent.trim() : 'Open content pack (.zip)…'; disabled = !window.__GNW_PACK; }
      else if (openId === 'stories') label = 'Sign in with GitHub';
    }
    if (prim) {
      // The other media server's tile while one is signed in shows its own Sign out, no form.
      const hide = mode !== 'setup' || s.plain || (isMedia(openId) && !document.getElementById('emby-login-form'));
      if (prim.hidden !== hide) prim.hidden = hide;
      if (prim.textContent !== label) prim.textContent = label;
      if (prim.disabled !== disabled) prim.disabled = disabled;
    }
    /* No Done, and no Cancel on the content pack (24 Oct): the "All sources" back button
       already leaves the panel. Cancel stays only beside a set-up form you can type into. */
    if (cancel) {
      const hide = mode !== 'setup' || openId === 'pack' || s.plain || (isMedia(openId) && !document.getElementById('emby-login-form'));
      if (cancel.hidden !== hide) cancel.hidden = hide;
      if (cancel.textContent !== 'Cancel') cancel.textContent = 'Cancel';
    }
    const foot = sheet.querySelector('.src-foot');
    if (foot) { const none = (!prim || prim.hidden) && (!cancel || cancel.hidden); if (foot.hidden !== none) foot.hidden = none; }
    if (sheet.hidden) sheet.hidden = false;
    if (!top.hidden) top.hidden = true;
    if (!gen.hidden) gen.hidden = true;
    if (cp) cp.classList.add('src-open');
  }

  /* ------------------------------------------------------------ open, close, act */
  function scrollTop() {
    const art = $('#vault-overlay .article'); if (art) art.scrollTop = 0;
    const o = document.getElementById('vault-overlay'); if (o) o.scrollTop = 0;
  }
  function focusFirst() {
    const sheet = document.getElementById('src-sheet'); if (!sheet || sheet.hidden) return;
    const body = sheet.querySelector('.src-body[data-for="' + openId + '"]');
    const vis = el => el && el.getClientRects().length > 0 && !el.disabled;
    let t = null;
    if (sheet.dataset.mode === 'setup') {
      t = Array.from(body.querySelectorAll('input:not([type="hidden"]):not([type="file"]), select, .src-file-pick')).find(vis) || document.getElementById('src-primary');
      if (openId === 'host') t = sheet.querySelector('.src-sheet-back');   // instructions: start at the top
    } else {
      t = sheet.querySelector('.src-sheet-back');
    }
    if (vis(t)) { try { t.focus({ preventScroll: true }); } catch (_) {} }
  }
  function open(id, focus) {
    if (!byId(id)) return;
    if (!build()) return;
    openId = id;
    if (id !== 'cws') cwsBusy = false;
    if (id === 'stories' && window.cwStoriesLoad) window.cwStoriesLoad(m => m.drawPanel());
    gather();
    render();
    if (id === 'pack' && window.__GNW_PACK && typeof window.gnwRenderContentStatus === 'function') { try { window.gnwRenderContentStatus(); } catch (_) {} }
    // The one emby.js node is drawn for the tile chosen, Emby or Jellyfin.
    if (isMedia(id) && window.Emby && typeof window.Emby.renderLoginPanel === 'function' &&
        (!embyMount().children.length || (window.Emby.formType && window.Emby.formType() !== id))) { try { window.Emby.renderLoginPanel(id); } catch (_) {} }
    scrollTop();
    if (focus) focusFirst();
  }
  function close(focus) {
    const was = openId;
    if (!was) return;
    openId = null;
    // Leaving the other media server's tile: the node goes back to the signed-in server's view.
    if (isMedia(was) && window.Emby && window.Emby.formType && window.Emby.formType() !== mediaType()) { try { window.Emby.renderLoginPanel(mediaType()); } catch (_) {} }
    gather();
    render();
    scrollTop();
    if (focus) {
      const t = document.getElementById('src-tile-' + was);
      if (t) { try { t.focus({ preventScroll: true }); } catch (_) {} try { t.scrollIntoView({ block: 'nearest' }); } catch (_) {} }
    }
  }
  function primary() {
    if (!openId) return;
    if (isMedia(openId)) {
      const f = document.getElementById('emby-login-form');
      if (!f) return;
      if (typeof f.requestSubmit === 'function') f.requestSubmit(); else { const b = document.getElementById('emby-submit'); if (b) b.click(); }
      return;
    }
    if (openId === 'pack') { if (typeof window.gnwContentPackToggle === 'function') window.gnwContentPackToggle(); return; }
    if (openId === 'stories') { if (window.cwStoriesLoad) window.cwStoriesLoad(m => m.signIn()); return; }
    if (openId === 'cws') {
      const inp = document.getElementById('src-cws-addr'), msg = document.getElementById('src-cws-msg');
      if (!window.CWS || typeof window.CWS.directConnect !== 'function') { msg.textContent = 'The game server part of the site has not loaded. Reload the page and try again.'; msg.style.color = '#f08a5d'; return; }
      if (cwsBusy) return;
      cwsBusy = true; render();
      msg.textContent = 'Connecting…'; msg.style.color = 'var(--muted)';
      Promise.resolve(window.CWS.directConnect(inp.value)).then(r => {
        cwsBusy = false;
        if (r && r.ok) { msg.textContent = ''; inp.value = ''; }
        else { msg.textContent = (r && r.msg) || 'Could not connect.'; msg.style.color = '#f08a5d'; try { inp.focus(); } catch (_) {} }
        render();
        if (r && r.ok) focusFirst();
      }, e => { cwsBusy = false; msg.textContent = (e && e.message) || 'Could not connect.'; msg.style.color = '#f08a5d'; render(); });
    }
  }

  /* Back, Escape, a remote's Back or the pad's B (it presses Escape) close the panel first,
     before nav.js sends the focus to the page list and keys.js closes Settings. Only while
     Settings is the top layer: a cws.js dialog over it keeps its own Back. */
  document.addEventListener('keydown', e => {
    if (!openId || e.defaultPrevented) return;
    const K = window.GnwKeys;
    const back = K && typeof K.isBack === 'function' ? K.isBack(e) : (e.key === 'Escape');
    if (!back) return;
    const ov = document.getElementById('vault-overlay');
    if (!ov || !ov.classList.contains('open')) return;
    const top = K && typeof K.topLayer === 'function' ? K.topLayer() : ov;
    if (top && top !== ov) return;
    const sheet = document.getElementById('src-sheet');
    if (!sheet || sheet.hidden) return;
    e.preventDefault(); e.stopPropagation();
    if (e.repeat) return;
    close(true);
  }, true);

  /* settings-ui.js calls this whenever the Media and content page is shown. */
  function onShow(name) {
    if (!build()) return;
    if (name === 'videologin') {
      open(window.Emby && window.Emby.session && window.Emby.session.active ? mediaType() : 'emby', false);
      // Asked for from the Media page's "Connect a media server": the focus goes into the panel
      // once Settings has placed its own (a remote has no pointer to get there).
      setTimeout(() => {
        const a = document.activeElement, ov = document.getElementById('vault-overlay');
        if (isMedia(openId) && ov && ov.classList.contains('open') && (!a || a === document.body || !ov.contains(a) || (a.classList && a.classList.contains('settings-tab')))) focusFirst();
      }, 120);
      return;
    }
    if (openId) close(false); else render();
  }

  function install() {
    if (!build()) return false;
    render();
    const ov = document.getElementById('vault-overlay');
    if (ov) new MutationObserver(() => { if (!ov.classList.contains('open') && openId) { close(false); } else if (ov.classList.contains('open')) scheduleSoon(); })
      .observe(ov, { attributes: true, attributeFilter: ['class'] });
    if (window.__GNW_PACK && window.__GNW_PACK.ready) window.__GNW_PACK.ready.then(scheduleSoon, () => {});
    ['cws:ready', 'cws:direct-added'].forEach(n => window.addEventListener(n, scheduleSoon));
    return true;
  }

  window.GnwSources = { BUILD, sources: () => SOURCES.map(s => Object.assign({}, s, state(s.id))), open: id => open(id, true), close: () => close(true), current: () => openId, onShow, render };

  const boot = () => { if (!install()) setTimeout(boot, 1000); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

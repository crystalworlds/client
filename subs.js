/*
 * subs.js -- the video player's own subtitles (2026-10-04).
 *
 * WHY THIS EXISTS. The player is a plain <video controls>. Subtitles handed to
 * the browser as <track> elements, or drawn by Emby's own players, had four
 * problems in real use:
 *   1. they drift at fast play (the timing goes out of step at 1.5x / 2x);
 *   2. every film or episode needs its own sync fix;
 *   3. there is no "always on" mode;
 *   4. the text size and font controls are hidden away.
 * So the cues are fetched as text from Emby and drawn here, in an overlay, from
 * video.currentTime on every animation frame. currentTime is the media clock
 * itself, so the text cannot drift at any speed and is right again the moment a
 * seek lands. Nothing is handed to the browser's own caption renderer.
 *
 * WHAT IS HERE.
 *   - fetching text subtitles (external files and embedded text streams) as
 *     WebVTT, falling back to SRT, through Emby's subtitle stream endpoint
 *       GET /Videos/{Id}/{MediaSourceId}/Subtitles/{Index}/Stream.{vtt|srt}
 *   - the overlay renderer, with per-file offset + scale
 *   - the player's ONE control bar (player fixes, 2026-10-04: it replaces the
 *     browser's <video controls>): seek bar (embytrick.js), play/pause, the
 *     -0.1 s / +0.1 s nudges with hold-to-accelerate next to it, back/forward
 *     10 s, Subtitles (one menu: Off + every track), Auto-sync, Chapters
 *     (embytrick.js), Speed (a menu), mute, full screen. It hides after 3 s
 *     idle (4 s on a TV) and returns on any mouse move, touch, key or remote
 *     press. Every control is a real <button>, reachable with arrow keys,
 *     pressed with Enter/OK; every popup closes on an outside click, on Back,
 *     and when the controls hide.
 *   - Settings -> Subtitles (mode, languages, style, live preview)
 *   - "Find subtitles..." (Part 2) and "Auto-sync" (Part 3, lazy-loads subsync.js)
 *
 * PICTURE-BASED SUBTITLES (PGS, VobSub, DVB). They are images, so they cannot be
 * drawn as text. They are listed in the picker, marked as not available here,
 * and never picked automatically; if they are all a file has in the preferred
 * language the bar says so once and points at "Find subtitles...". Emby's
 * burn-in was considered and NOT used: it makes the server re-encode the whole
 * picture into a progressive stream that starts at the requested time, which
 * breaks seeking, Resume and Skip Intro on this player, and could not be tested
 * without a real server.
 *   SUPERSEDED 2026-10-04 (Emby A): when embytranscode.js is loaded it registers
 * setPictureHandler(), and a picture track chosen in the menu, marked
 * "(picture, server)", is burned in by the server. That path is HLS, whose
 * playlist covers the whole title, so the <video> clock stays the title's own
 * and seeking, Resume and Skip Intro keep working; it was tested against a local
 * stand-in server with a VobSub track. Picture tracks are still never picked
 * automatically.
 *
 * WHERE OFFSETS LIVE. Browser localStorage, key 'gnw.subs.offsets.v1', one
 * record per item id + media source id + subtitle stream. The vault could not
 * take it: its only per-row store is device_data, whose writes are gated on a
 * fixed whitelist of 73 device ids (valid_device_ids, migration_011/056), so a
 * film id would need a new table or migration -- ruled out. Trade-off: an offset
 * saved on the TV is not seen by the laptop. Records are tiny (~80 bytes); the
 * store keeps the newest 4000.
 *
 * SOUND. Nothing here makes a sound. The only audio this file ever touches is
 * the analysis in subsync.js, which reads decoded samples and never plays them.
 *
 * Hooks into emby.js are deliberately small: attach()/detach() from the three
 * play paths and closePlayer(), settingsHTML()/wireSettings() from the Settings
 * panel, and window.Emby.subsApi for authenticated requests.
 */
(function () {
  'use strict';

  const BUILD = '20261026-jelly1-subsync';
  /* Version of the automatic sync. A track whose saved automatic result is
     older is synced again once (2: the clock check, subsync-mando 2026-10-07:
     results saved before it can be off by an audio track's start delay;
     3: the whole-film model -- any rate, and sections for a different cut;
     4: the simple model, 2026-10-10 -- applied as it goes, five known speeds,
     segments for advert breaks; a result saved before it is finished
     (autoFinal false) carries on next time). */
  const AUTO_V = 5;   // 5 (2026-10-10, tag i): the acceptance test; older automatic results are not trusted (purgeOldAuto)

  /* ------------------------------------------------------------ settings */

  const SET_KEY = 'gnw.subs.settings.v1';
  const OFF_KEY = 'gnw.subs.offsets.v1';
  const PICK_KEY = 'gnw.subs.picks.v1';
  const DEFAULTS = {
    mode: 'always',          // 'always' | 'foreign' | 'off'
    langs: ['eng'],          // preferred subtitle languages, in order (ISO 639-2/B)
    size: 'l',               // see SIZES
    font: 'sans',            // see FONTS
    color: '#ffffff',
    edge: 'outline',         // 'outline' | 'shadow' | 'none'
    box: false,              // background box behind each line
    boxOpacity: 0.6,
    position: 6,             // % of the picture height above its bottom edge
    autoFetch: false,        // Part 2: fetch from Emby's providers when none in the preferred language
    autoSync: true,          // (always on since 2026-10-04: every track is synced in the background; − / + switch a track to manual)
    fixBroken: true,         // 2026-10-04: subtitles on + only an incomplete track -> download the best complete one by itself
  };
  // Text height as a % of the 16:9 frame height. The two TV sizes are for a
  // screen read from across a room.
  const SIZES = [
    { id: 's',   label: 'Small',               pct: 3.6 },
    { id: 'm',   label: 'Medium',              pct: 4.4 },
    { id: 'l',   label: 'Large',               pct: 5.2 },
    { id: 'xl',  label: 'Extra large',         pct: 6.2 },
    { id: 'tv',  label: 'TV large',            pct: 7.4 },
    { id: 'tvx', label: 'TV extra large',      pct: 8.8 },
  ];
  const FONTS = [
    { id: 'sans',    label: 'Sans serif (site)', css: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
    { id: 'serif',   label: 'Serif',             css: 'Georgia, "Times New Roman", Times, serif' },
    { id: 'rounded', label: 'Rounded',           css: '"Arial Rounded MT Bold", "Nunito", "Varela Round", "Segoe UI", sans-serif' },
    { id: 'narrow',  label: 'Condensed',         css: '"Arial Narrow", "Roboto Condensed", "Segoe UI", sans-serif' },
    { id: 'mono',    label: 'Typewriter',        css: 'ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace' },
  ];
  const COLOURS = [
    { id: '#ffffff', label: 'White' }, { id: '#ffe14d', label: 'Yellow' },
    { id: '#7fe7ff', label: 'Cyan' },  { id: '#a6f08a', label: 'Green' },
  ];
  const EDGES = [
    { id: 'outline', label: 'Outline' }, { id: 'shadow', label: 'Drop shadow' }, { id: 'none', label: 'None' },
  ];
  const LANGS = [
    ['eng', 'English'], ['fre', 'French'], ['ger', 'German'], ['spa', 'Spanish'], ['ita', 'Italian'],
    ['por', 'Portuguese'], ['dut', 'Dutch'], ['swe', 'Swedish'], ['nor', 'Norwegian'], ['dan', 'Danish'],
    ['fin', 'Finnish'], ['pol', 'Polish'], ['cze', 'Czech'], ['hun', 'Hungarian'], ['rum', 'Romanian'],
    ['gre', 'Greek'], ['tur', 'Turkish'], ['rus', 'Russian'], ['ukr', 'Ukrainian'], ['ara', 'Arabic'],
    ['heb', 'Hebrew'], ['hin', 'Hindi'], ['tha', 'Thai'], ['vie', 'Vietnamese'], ['ind', 'Indonesian'],
    ['may', 'Malay'], ['fil', 'Filipino'], ['chi', 'Chinese'], ['jpn', 'Japanese'], ['kor', 'Korean'],
  ];
  const LANG_NAME = Object.fromEntries(LANGS);
  /* Emby reports ISO 639-2 codes, usually the /B form; files and providers mix
     /T and two-letter codes. Everything is compared after this. */
  const LANG_ALIAS = {
    fra: 'fre', deu: 'ger', zho: 'chi', nld: 'dut', ces: 'cze', ell: 'gre', fas: 'per', ron: 'rum', slk: 'slo',
    sqi: 'alb', hye: 'arm', eus: 'baq', mya: 'bur', kat: 'geo', isl: 'ice', mkd: 'mac', mri: 'mao', msa: 'may',
    bod: 'tib', cym: 'wel', nob: 'nor', nno: 'nor', tgl: 'fil',
    en: 'eng', fr: 'fre', de: 'ger', es: 'spa', it: 'ita', pt: 'por', nl: 'dut', sv: 'swe', no: 'nor', nb: 'nor',
    da: 'dan', fi: 'fin', pl: 'pol', cs: 'cze', hu: 'hun', ro: 'rum', el: 'gre', tr: 'tur', ru: 'rus', uk: 'ukr',
    ar: 'ara', he: 'heb', hi: 'hin', th: 'tha', vi: 'vie', id: 'ind', ms: 'may', tl: 'fil', zh: 'chi', ja: 'jpn', ko: 'kor',
  };
  const normLang = c => { const s = String(c || '').toLowerCase().split(/[-_]/)[0]; return LANG_ALIAS[s] || s; };
  const langLabel = c => LANG_NAME[normLang(c)] || (c ? String(c).toUpperCase() : 'Unknown language');

  function lsGet(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }

  function loadSettings() {
    const s = Object.assign({}, DEFAULTS, lsGet(SET_KEY, {}) || {});
    if (!Array.isArray(s.langs) || !s.langs.length) s.langs = DEFAULTS.langs.slice();
    s.langs = s.langs.map(normLang).filter(Boolean).slice(0, 3);
    if (!['always', 'foreign', 'off'].includes(s.mode)) s.mode = DEFAULTS.mode;
    return s;
  }
  function saveSettings(patch) {
    const s = Object.assign(loadSettings(), patch || {});
    lsSet(SET_KEY, s);
    if (_live) { applyStyle(_live); layout(_live); }
    return s;
  }

  /* ----------------------------------------------------- per-file offsets */

  /* Key: item id | media source id | subtitle stream. An external file is
     named by its path (its Index can shift when another file is added next to
     it); an embedded stream by its index, which is fixed by the container. */
  function streamKey(st) {
    if (!st) return 'none';
    if (st.IsExternal) {
      const p = String(st.Path || '').split(/[\\/]/).pop();
      return 'x:' + (p || ((st.Title || st.DisplayTitle || '') + ':' + (st.Language || '') + ':' + st.Index));
    }
    return 'e:' + st.Index;
  }
  const offKey = (item, src, st) => [item && item.Id, src && src.Id, streamKey(st)].join('|');
  function getOffset(key) {
    const all = lsGet(OFF_KEY, {}) || {};
    return all[key] || null;
  }
  function setOffset(key, rec) {
    const all = lsGet(OFF_KEY, {}) || {};
    all[key] = Object.assign({}, rec, { at: Date.now() });
    const keys = Object.keys(all);
    if (keys.length > 4000) {
      keys.sort((a, b) => (all[a].at || 0) - (all[b].at || 0));
      for (const k of keys.slice(0, keys.length - 4000)) delete all[k];
    }
    lsSet(OFF_KEY, all);
  }
  /* The track the viewer picked by hand for a file ('off' or a streamKey). */
  function getPick(itemId) { const p = lsGet(PICK_KEY, {}) || {}; return p[itemId] || null; }
  function setPick(itemId, v) {
    const p = lsGet(PICK_KEY, {}) || {};
    if (v == null) delete p[itemId]; else p[itemId] = v;
    const keys = Object.keys(p);
    if (keys.length > 2000) delete p[keys[0]];
    lsSet(PICK_KEY, p);
  }

  /* -------------------------------------------------------------- tracks */

  const IMAGE_CODECS = new Set(['pgssub', 'pgs', 'hdmv_pgs_subtitle', 'dvdsub', 'dvd_subtitle', 'vobsub', 'dvbsub',
    'dvb_subtitle', 'xsub', 'dvb_teletext', 'sup']);
  /* CLOSED CAPTIONS CARRIED INSIDE THE PICTURE (EIA-608/708, 2026-10-15, Emby
     formats census: 5,026 files). Emby lists them as a text track, but asked
     for them it returns an empty file every time, so they were offered, chosen
     and failed. They are listed as unavailable here instead, never chosen
     automatically, and choosing one says why. */
  const CAPTION_CODECS = new Set(['eia_608', 'eia_708', 'cc_dec', 'c608', 'c708', 'closed_caption', 'closedcaption']);
  function isCaption(st) { return CAPTION_CODECS.has(String((st && st.Codec) || '').toLowerCase()); }
  function isTextStream(st) {
    if (isCaption(st)) return false;
    if (typeof st.IsTextSubtitleStream === 'boolean') return st.IsTextSubtitleStream;
    return !IMAGE_CODECS.has(String(st.Codec || '').toLowerCase());
  }
  function subStreams(src) {
    return ((src && src.MediaStreams) || []).filter(s => s.Type === 'Subtitle');
  }
  function trackLabel(st) {
    const bits = [langLabel(st.Language)];
    if (st.IsForced) bits.push('forced');
    if (st.IsHearingImpaired) bits.push('SDH');
    const t = st.Title && !/^(und|unknown)$/i.test(st.Title) ? st.Title : '';
    if (t && !bits.some(b => t.toLowerCase().includes(b.toLowerCase()))) bits.push(t);
    return bits.join(' · ');
  }
  /* The small grey note beside a track in the Subtitles menu. */
  function trackNote(st, picHandler) {
    if (isCaption(st)) return '(closed captions, can’t show here)';
    if (!isTextStream(st)) return picHandler ? '(picture, server)' : '(picture, can’t show here)';
    return [String(st.Codec || '').toUpperCase(), st.IsExternal ? 'separate file' : ''].filter(Boolean).join(' · ');
  }
  /* Which track to show at start, from the settings and the playing audio.
     Returns { stream, reason } -- stream null for "none". */
  function chooseTrack(src, audioStream, item) {
    const s = loadSettings();
    const all = subStreams(src).filter(st => !isCaption(st));
    const pick = item && getPick(item.Id);
    if (pick === 'off') return { stream: null, reason: 'off-by-choice' };
    if (pick) {
      const st = all.find(x => streamKey(x) === pick && isTextStream(x));
      if (st) return { stream: st, reason: 'remembered' };
    }
    if (s.mode === 'off') return { stream: null, reason: 'mode-off' };
    const prefs = s.langs.map(normLang);
    const audioLang = audioStream ? normLang(audioStream.Language) : '';
    const audioKnown = audioLang && audioLang !== 'und' && audioLang !== 'mis' && audioLang !== 'zxx';
    const audioIsMine = audioKnown && prefs.includes(audioLang);
    const rank = (st) => {
      const li = prefs.indexOf(normLang(st.Language));
      return (li < 0 ? 100 : li * 10) + (st.IsForced ? 3 : 0) + (st.IsHearingImpaired ? 1 : 0) + (st.IsDefault ? -0.5 : 0);
    };
    const inPref = all.filter(st => prefs.includes(normLang(st.Language)));
    const text = inPref.filter(isTextStream).sort((a, b) => rank(a) - rank(b));
    if (s.mode === 'foreign' && (audioIsMine || !audioKnown)) {
      // The film is in a language the viewer reads: only forced subtitles
      // (the bits of dialogue in another language), if the file has them.
      const forced = text.filter(st => st.IsForced);
      return { stream: forced[0] || null, reason: forced[0] ? 'forced-only' : 'audio-is-preferred' };
    }
    const full = text.filter(st => !st.IsForced);
    if (full[0] || text[0]) return { stream: full[0] || text[0], reason: 'preferred' };
    if (inPref.length) return { stream: null, reason: 'image-only', image: inPref[0] };
    return { stream: null, reason: 'none-in-language' };
  }

  /* ------------------------------------------------------------- parsing */

  function parseTime(s) {
    const m = /^\s*(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?\s*$/.exec(s);
    if (!m) return NaN;
    return (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) + (m[4] ? +(m[4].padEnd(3, '0')) / 1000 : 0);
  }
  const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  /* Cue text to safe HTML: everything escaped, then only <i> <b> <u> given
     back. ASS override blocks ({\an8} etc.) and other tags are dropped. */
  function cueHtml(text) {
    let t = String(text).replace(/\{\\[^}]*\}/g, '').replace(/\\N/g, '\n');
    t = t.replace(/<(\/?)(i|b|u)(?:\s[^>]*)?>/gi, '\u0001$1$2\u0002').replace(/<[^>]*>/g, '');
    t = escHtml(t).replace(/\u0001(\/?)(i|b|u)\u0002/gi, '<$1$2>');
    t = t.replace(/&amp;(nbsp|amp|lt|gt);/g, '&$1;');
    return t.split(/\r?\n/).map(l => l.trim()).filter(Boolean).join('<br>');
  }
  /* One parser for both WebVTT and SRT: blocks separated by blank lines, a
     timing line with "-->", text after it. NOTE/STYLE/REGION blocks and the
     WEBVTT header have no timing line and fall out. */
  function parseCues(text) {
    const out = [];
    // An ASS/SSA file handed back as-is (a server that did not convert it):
    // read its Dialogue lines. Override tags are dropped by cueHtml.
    if (/^\s*\[Events\]/m.test(String(text || ''))) {
      let fmt = ['Layer', 'Start', 'End', 'Style', 'Name', 'MarginL', 'MarginR', 'MarginV', 'Effect', 'Text'];
      for (const line of String(text).replace(/\r\n?/g, '\n').split('\n')) {
        const f = /^Format:\s*(.*)$/i.exec(line);
        if (f) { fmt = f[1].split(',').map(x => x.trim()); continue; }
        const m = /^Dialogue:\s*(.*)$/i.exec(line);
        if (!m) continue;
        const parts = m[1].split(','), n = fmt.length;
        const rec = {};
        fmt.forEach((k, i) => { rec[k] = i === n - 1 ? parts.slice(i).join(',') : parts[i]; });
        const start = parseTime(rec.Start || ''), end = parseTime(rec.End || '');
        if (!(end > start) || !isFinite(start)) continue;
        const html = cueHtml(rec.Text || '');
        if (html) out.push({ start, end, html });
      }
      out.sort((x, y) => x.start - y.start || x.end - y.end);
      return out;
    }
    const blocks = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').split(/\n{2,}/);
    for (const b of blocks) {
      const lines = b.split('\n');
      const ti = lines.findIndex(l => l.includes('-->'));
      if (ti < 0) continue;
      const [a, z] = lines[ti].split('-->');
      const start = parseTime(a), end = parseTime(String(z).trim().split(/\s+/)[0]);
      if (!(end > start) || !isFinite(start)) continue;
      const html = cueHtml(lines.slice(ti + 1).join('\n'));
      if (html) out.push({ start, end, html });
    }
    out.sort((x, y) => x.start - y.start || x.end - y.end);
    return out;
  }

  /* ------------------------------------------------------------- fetching */

  function api() { return (window.Emby && window.Emby.subsApi) || null; }
  /* WHERE THE TEXT COMES FROM (player fixes, 2026-10-04). Emby's SubtitleService
     answers the same stream on four routes (betadev.emby.media/reference/RestAPI/
     SubtitleService.html):
       /Videos/{Id}/{MediaSourceId}/Subtitles/{Index}/Stream.{Format}
       /Videos/{Id}/{MediaSourceId}/Subtitles/{Index}/{StartPositionTicks}/Stream.{Format}
       /Items/{Id}/{MediaSourceId}/Subtitles/{Index}/Stream.{Format}   (and its ticks form)
     and when PlaybackInfo was asked with a device profile, the stream itself
     carries a ready DeliveryUrl. They are tried in that order, WebVTT then SRT,
     until one gives cues; a 401/403 stops at once (it will not get better).
     The token goes in api_key only, as for every <img> and <video> here: a
     custom X-Emby-Token header turns the request into a CORS preflight, one
     more thing a server or proxy in between can refuse. */
  function subtitleUrls(item, src, st) {
    const a = api(), tok = encodeURIComponent(a.token());
    const tp = a.tokenParam ? a.tokenParam() : 'api_key';   // Jellyfin: ApiKey (26 Oct)
    const id = encodeURIComponent(item.Id), ms = encodeURIComponent(src.Id);
    const out = [];
    const du = typeof st.DeliveryUrl === 'string' && /\/Subtitles\//i.test(st.DeliveryUrl) ? st.DeliveryUrl : '';
    if (du) {
      let u = /^https?:\/\//i.test(du) ? du : /^\/emby\//i.test(du) ? a.base().replace(/\/emby$/i, '') + du : a.base() + (du[0] === '/' ? du : '/' + du);
      if (!/[?&](api_key|ApiKey)=/i.test(u)) u += (u.includes('?') ? '&' : '?') + tp + '=' + tok;
      out.push(u);
    }
    for (const fmt of ['vtt', 'srt']) {
      out.push(a.base() + `/Videos/${id}/${ms}/Subtitles/${st.Index}/Stream.${fmt}?${tp}=${tok}`);
      out.push(a.base() + `/Videos/${id}/${ms}/Subtitles/${st.Index}/0/Stream.${fmt}?${tp}=${tok}`);
      out.push(a.base() + `/Items/${id}/${ms}/Subtitles/${st.Index}/Stream.${fmt}?${tp}=${tok}`);
    }
    return out;
  }
  /* Subtitle files come in whatever encoding they were saved in, and a server
     may hand an .srt back as it is on disk: UTF-8 (with or without a BOM),
     UTF-16 (LE/BE, BOM or not) or a Windows code page. Decoded here by the
     bytes, not by fetch's always-UTF-8 text(). */
  function decodeSubtitle(buf, ctype) {
    const td = (enc, b) => { try { return new TextDecoder(enc, { fatal: enc === 'utf-8' }).decode(b); } catch { return null; } };
    if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) return { text: td('utf-8', buf.subarray(3)) || '', enc: 'utf-8' };
    if (buf[0] === 0xFF && buf[1] === 0xFE) return { text: td('utf-16le', buf.subarray(2)) || '', enc: 'utf-16le' };
    if (buf[0] === 0xFE && buf[1] === 0xFF) return { text: td('utf-16be', buf.subarray(2)) || '', enc: 'utf-16be' };
    // No BOM: UTF-16 shows as a zero in every other byte of plain text.
    let z0 = 0, z1 = 0; const n = Math.min(buf.length, 400);
    for (let i = 0; i < n; i++) if (!buf[i]) (i & 1 ? z1++ : z0++);
    if (n > 20 && z1 > n / 5) return { text: td('utf-16le', buf) || '', enc: 'utf-16le' };
    if (n > 20 && z0 > n / 5) return { text: td('utf-16be', buf) || '', enc: 'utf-16be' };
    const m = /charset=([\w-]+)/i.exec(ctype || '');
    if (m && !/utf-?8/i.test(m[1])) { const t = td(m[1].toLowerCase(), buf); if (t != null) return { text: t, enc: m[1].toLowerCase() }; }
    const u = td('utf-8', buf);
    if (u != null) return { text: u, enc: 'utf-8' };
    return { text: td('windows-1252', buf) || '', enc: 'windows-1252' };
  }
  const _cueCache = new Map();   // url-ish key -> Promise<cues>
  /* What each fetch did, for Subtitles -> Subtitle info: every URL tried (token
     redacted), its status, content type, size and how many cues it parsed. */
  const _diag = new Map();       // same key -> { attempts: [...], started, finished, ok }
  const _stats = new Map();      // same key -> { n, first, last, text, bytes, ads, texts, starts } once loaded

  /* ADVERT LINES (player fixes, 2026-10-04). Release groups and subtitle sites
     put their own lines into files ("Downloaded from YTS.BZ", "Support us and
     become VIP member", "Advertise your product or brand here"). They are not
     the film's dialogue: dropped at load, counted in Subtitle info. The list is
     deliberately short and specific -- a line is dropped only when it names one
     of these sources, never for merely containing a web address. */
  const AD_RE = /(downloaded\s+from|\bYTS\b|\bYIFY\b|opensubtitles|open\s*subtitles|advertise\s+your\s+product|become\s+vip\s+member|subscene|addic7ed|www\.osdb|subtitles\s+by\s+explosiveskull|sync(ed)?\s+(and|&)\s+correct(ed|ions)\s+by)/i;
  const isAdLine = t => AD_RE.test(String(t || '')) && String(t || '').length < 160;
  const normText = h => plainText(h).toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, '').replace(/\s+/g, ' ').trim();
  function plainText(h) { return String(h || '').replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); }

  /* INCOMPLETE TRACKS (player fixes, 2026-10-04: Supergirl). A real
     "English" file was the forced lines again plus two adverts: 105 cues that
     end at 1:21:13 of a 2 h film. A track is
       - INCOMPLETE when its last line ends before 60% of the runtime, or more
         than 15 minutes before the end (forced tracks are short by nature and
         are never called incomplete);
       - SAME AS FORCED when 90% or more of its lines (by text, or by start
         time to 0.5 s) are also in a forced track of the same language.
     Computed from the loaded cues; other tracks are loaded quietly to compare. */
  function runtimeOf(L) { return (((L.src && L.src.RunTimeTicks) || (L.item && L.item.RunTimeTicks) || 0) / 1e7) || (isFinite(L.v.duration) ? L.v.duration : 0); }
  function quality(L, st) {
    const stt = _stats.get(cueKey(L.item, L.src, st));
    if (!stt || !isTextStream(st)) return null;
    const R = runtimeOf(L);
    const q = { n: stt.n, last: stt.last, ads: stt.ads || 0, runtime: R, incomplete: false, sameAsForced: null };
    /* THRESHOLDS, conservative on purpose (2026-10-04: "don't download or
       play incomplete tracks"; a COMPLETE track must never be refused):
       - only titles over 10 min are judged (shorts and clips are not);
       - the last line must end before 60% of the runtime, OR more than 25 min
         before the end. A full film track ends with the last spoken line,
         before the end credits; modern credits run 8-15 min, long ones (with
         a post-credits scene) up to about 20, so 25 min leaves a margin.
       That Supergirl "English" track ends at 1:21:13 of 2:04:00: 43 min
       before the end -- refused by the second rule (and by "same as forced").
       Forced tracks are never judged: they are partial by design. */
    if (!st.IsForced && R > 600 && (stt.last < 0.6 * R || R - stt.last > 1500)) q.incomplete = true;
    if (!st.IsForced) {
      for (const f of subStreams(L.src)) {
        if (f === st || !f.IsForced || normLang(f.Language) !== normLang(st.Language)) continue;
        const fs = _stats.get(cueKey(L.item, L.src, f)); if (!fs) continue;
        let byText = 0, byTime = 0;
        stt.texts.forEach(x => { if (fs.texts.has(x)) byText++; });
        stt.starts.forEach(x => { if (fs.starts.has(x)) byTime++; });
        if (byText >= 0.9 * stt.texts.size || byTime >= 0.9 * stt.starts.size) { q.sameAsForced = f; break; }
      }
    }
    return q;
  }
  /* "this track is incomplete (same lines as the forced track); English · SDH or
     English · 1 are complete." -- the complete alternatives are the loaded,
     unflagged, non-forced tracks in the same language. */
  function qualitySentence(L, st, q) {
    const parts = [];
    if (q.incomplete) parts.push('ends at ' + fmtHM(q.last) + ' of ' + fmtHM(q.runtime));
    if (q.sameAsForced) parts.push('same lines as the forced track');
    const good = subStreams(L.src).filter(x => x !== st && !x.IsForced && isTextStream(x) && normLang(x.Language) === normLang(st.Language))
      .filter(x => { const g = quality(L, x); return g && !g.incomplete && !g.sameAsForced; }).map(trackLabel);
    return 'this track is ' + (q.incomplete ? 'incomplete' : 'not a full track') + ' (' + parts.join('; ') + ')' +
      (good.length ? '; ' + good.join(' or ') + (good.length > 1 ? ' are' : ' is') + ' complete.' : '. No complete track is loaded: try Check every track, or Find subtitles.');
  }
  const refused = q => !!(q && (q.incomplete || q.sameAsForced));
  const refuseText = (L, st, q, dl) => (dl ? 'This download is ' : 'This ' + langLabel(st.Language) + ' track is ') +
    (q.incomplete ? 'incomplete (ends at ' + fmtHM(q.last) + ' of ' + fmtHM(q.runtime) + ')' : 'the forced lines only') + ', not ' + (dl ? 'used' : 'played') + '.';
  const qualityNote = q => !q ? '' : q.sameAsForced ? 'same as forced' + (q.incomplete ? ', incomplete' : '') : q.incomplete ? 'incomplete (ends ' + fmtHM(q.last) + ' of ' + fmtHM(q.runtime) + ')' : '';
  function fmtHM(t) { t = Math.max(0, Math.round(t || 0)); const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60; return h + ':' + String(m).padStart(2, '0'); }
  /* Load (quietly) every text track in this language, so they can be compared. */
  async function loadLanguage(L, lang) {
    const list = subStreams(L.src).filter(x => isTextStream(x) && normLang(x.Language) === lang);
    await Promise.all(list.map(x => fetchCues(L.item, L.src, x).catch(() => null)));
    return list;
  }
  const KEEP_KEY = 'gnw.subs.keepincomplete.v1';
  // Keep lasts for this browser session only (2026-10-04): the note comes
  // back each time the film is opened again while its track is still incomplete.
  const kept = (L) => { try { return !!(JSON.parse(sessionStorage.getItem(KEEP_KEY) || '{}') || {})[L.item.Id]; } catch { return false; } };
  function setKept(L) { try { const k = JSON.parse(sessionStorage.getItem(KEEP_KEY) || '{}') || {}; k[L.item.Id] = Date.now(); sessionStorage.setItem(KEEP_KEY, JSON.stringify(k)); } catch {} }
  const redact = u => String(u).replace(/([?&](?:api_key|ApiKey|X-Emby-Token|AccessToken)=)[^&]*/gi, '$1(hidden)');
  const cueKey = (item, src, st) => offKey(item, src, st) + '#' + st.Index;
  async function fetchCues(item, src, st) {
    const key = cueKey(item, src, st);
    if (_cueCache.has(key)) return _cueCache.get(key);
    const d = { attempts: [], started: Date.now(), finished: 0, ok: false };
    _diag.set(key, d);
    const p = (async () => {
      const tried = [];
      let first = true;
      for (const url of subtitleUrls(item, src, st)) {
        const a = { url: redact(url), status: null, type: '', bytes: null, cues: null, note: '' };
        d.attempts.push(a);
        const ctrl = new AbortController();
        // The first extraction of an embedded stream can be slow; later tries are quick refusals.
        const timer = setTimeout(() => ctrl.abort(), first ? 60000 : 20000);
        first = false;
        let res;
        try { res = await fetch(url, { signal: ctrl.signal }); }
        catch (e) { a.note = e && e.name === 'AbortError' ? 'timed out' : 'no answer (network, CORS or mixed content: ' + ((e && e.message) || e) + ')'; tried.push(e && e.name === 'AbortError' ? 'timed out' : 'no answer (network or CORS)'); continue; }
        finally { clearTimeout(timer); }
        a.status = res.status; a.type = res.headers.get('content-type') || '';
        if (!res.ok) {
          tried.push('HTTP ' + res.status);
          if (res.status === 401 || res.status === 403) break;
          continue;
        }
        const buf = new Uint8Array(await res.arrayBuffer().catch(() => new ArrayBuffer(0)));
        a.bytes = buf.length;
        const dec = decodeSubtitle(buf, a.type);
        const text = dec.text;
        if (dec.enc !== 'utf-8') a.note = 'decoded as ' + dec.enc;
        if (!text.trim()) { a.note = 'empty'; tried.push('an empty file'); continue; }
        const all = parseCues(text);
        const cues = all.filter(c => !isAdLine(plain(c.html)));
        a.cues = all.length;
        if (cues.length) {
          d.ok = true; d.finished = Date.now();
          _stats.set(key, { n: cues.length, first: cues[0].start, last: cues[cues.length - 1].end, text: plain(cues[0].html).slice(0, 60), bytes: a.bytes,
            ads: all.length - cues.length,
            texts: new Set(cues.map(c => normText(c.html))), starts: new Set(cues.map(c => Math.round(c.start * 2))) });
          return cues;
        }
        if (all.length) { a.note = 'only advert lines'; tried.push('only advert lines in the file'); continue; }
        a.note = 'no timed lines'; a.head = text.slice(0, 80);
        tried.push('no timed lines in the file');
      }
      d.finished = Date.now();
      const uniq = [...new Set(tried)];
      const err = new Error(uniq.length ? uniq.join(', ') : 'nothing was tried');
      err.tried = tried;
      throw err;
    })();
    _cueCache.set(key, p);
    p.catch(() => _cueCache.delete(key));
    return p;
  }

  /* --------------------------------------------------------------- styles */

  function ensureStyles() {
    if (document.getElementById('gnw-subs-styles')) return;
    const s = document.createElement('style');
    s.id = 'gnw-subs-styles';
    s.textContent = `
      /* z-index 5 (player fixes 2026-10-04): ABOVE the control bar (4), whose top fade
         reaches up into the picture -- measured at a 2560x945 window, it covered
         the lowest part of a line. The layer takes no clicks, and the text is placed
         clear of the buttons, so it never hides a control. Popups stay above (6). */
      .gsub-layer { position:absolute; inset:0; pointer-events:none; z-index:5; overflow:hidden; }
      .gsub-cues { position:absolute; left:0; width:100%; display:flex; flex-direction:column; align-items:center;
        gap:.12em; text-align:center; line-height:1.22; padding:0 4%; box-sizing:border-box; }
      .gsub-cue { max-width:100%; }
      .gsub-line { display:inline; white-space:pre-wrap; overflow-wrap:anywhere;
        color:var(--gsub-color,#fff); font-family:var(--gsub-font); font-size:var(--gsub-size,32px); font-weight:600;
        -webkit-box-decoration-break:clone; box-decoration-break:clone; border-radius:.14em; }
      .gsub-edge-outline .gsub-line { -webkit-text-stroke:calc(var(--gsub-size,32px) * .075) #000; paint-order:stroke fill;
        text-shadow:0 0 .12em rgba(0,0,0,.65); }
      .gsub-edge-shadow .gsub-line { text-shadow:.04em .06em .1em rgba(0,0,0,.95), 0 0 .3em rgba(0,0,0,.5); }
      .gsub-box .gsub-line { background:rgba(0,0,0,var(--gsub-box,.6)); padding:.04em .38em; }

      /* THE PLAYER'S CONTROLS (2026-10-04, player fixes). One set, at the
         bottom: the seek bar (embytrick.js puts it in .gsub-seekrow) over one
         row of buttons. It replaces the browser's own <video controls>, and it
         behaves like them: it hides when the mouse and keys have been idle for
         3 s (4 s on a TV) and comes back on any mouse move, touch, key or
         remote press. It stays up while paused, while a menu is open, and
         while the pointer is over it. Nothing appears on hover alone. */
      .gsub-bar { position:absolute; left:0; right:0; bottom:0; z-index:4; box-sizing:border-box;
        display:flex; flex-direction:column; gap:4px; padding:34px clamp(14px,3vw,40px) 12px;
        background:linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,.55) 45%, rgba(0,0,0,.78));
        color:var(--text,#e7ecf2); transition:opacity .3s ease; font-size:13px; }
      .gsub-bar[hidden] { display:none; }
      .gsub-bar.gsub-quiet { opacity:0; pointer-events:none; }
      .gsub-idle, .gsub-idle video { cursor:none; }
      .gsub-seekrow:empty { display:none; }
      #video-player-overlay .gsub-seekrow .gtr-wrap { position:static; left:auto; right:auto; bottom:auto; width:100%; }
      #video-player-overlay .gsub-seekrow .gtr-wrap.gtr-quiet { opacity:1; pointer-events:auto; }
      .gsub-row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
      .gsub-row .gsub-grow { flex:1 1 auto; min-width:8px; }
      .gsub-chslot { display:contents; }
      .gsub-sep { width:1px; align-self:stretch; background:rgba(255,255,255,.18); margin:4px 3px; }
      .gsub-btn small { font-weight:600; color:var(--muted,#8a94a6); }
      .gsub-btn[aria-pressed="true"] small { color:var(--accent,#9be15d); }
      .gsub-btn { appearance:none; border:1px solid transparent; background:rgba(255,255,255,.06); color:var(--text,#e7ecf2);
        font:inherit; font-weight:700; padding:8px 12px; border-radius:10px; cursor:pointer; min-height:38px; white-space:nowrap;
        display:inline-flex; align-items:center; gap:6px; letter-spacing:.01em; }
      .gsub-btn:focus-visible { outline:var(--focus-width,3px) solid var(--focus-ring,#5dc8f0); outline-offset:2px; }
      .gsub-btn[aria-pressed="true"] { background:rgba(var(--accent-rgb,155,225,93),.2); border-color:rgba(var(--accent-rgb,155,225,93),.55); }
      .gsub-btn[disabled] { opacity:.45; cursor:default; }
      .gsub-btn svg { width:18px; height:18px; flex:0 0 auto; }
      .gsub-off { font-variant-numeric:tabular-nums; min-width:5.4em; text-align:center; font-weight:700; color:var(--accent,#9be15d); }
      .gsub-off small { display:block; font-size:10px; font-weight:600; color:var(--muted,#8a94a6); letter-spacing:.08em; text-transform:uppercase; }
      .gsub-sync[hidden], .gsub-nudge-wrap[hidden] { display:none; }
      .gsub-nudge-wrap { display:flex; align-items:center; gap:6px; }
      /* Status messages (loading, sync results, errors) float just above the bar. */
      .gsub-status { position:absolute; left:clamp(14px,3vw,40px); bottom:100%; margin-bottom:-22px; max-width:min(70ch, calc(100% - 28px));
        font-size:13px; font-weight:600; color:var(--text,#e7ecf2); line-height:1.35; padding:7px 12px; border-radius:10px;
        background:rgba(10,14,20,.88); border:1px solid var(--line,#2a3242); }
      .gsub-status:empty { display:none; }
      .gsub-cues { transition:bottom .25s ease; }
      .gsub-notice { font-size:max(15px, calc(var(--gsub-size,32px) * .55)); font-weight:600; color:#ffd479; background:rgba(0,0,0,.72);
        padding:.3em .8em; border-radius:.5em; font-family:var(--gsub-font); }

      /* Menus open just above the button that opened them (placed by placePopup). */
      .gsub-menu { position:absolute; z-index:6; left:16px; width:max-content;
        min-width:200px; max-width:calc(100% - 32px);
        max-height:min(60vh, 520px); overflow:auto; padding:8px; border-radius:14px; background:var(--bg-2,#1a212e);
        border:1px solid var(--line,#2a3242); box-shadow:0 24px 70px rgba(0,0,0,.6); color:var(--text,#e7ecf2); font-size:14px; }
      .gsub-menu[hidden] { display:none; }
      .gsub-menu h3 { margin:6px 10px 8px; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--muted,#8a94a6); font-weight:700; }
      .gsub-item { display:flex; width:100%; text-align:left; align-items:center; gap:10px; appearance:none; border:0; background:none;
        color:inherit; font:inherit; padding:11px 12px; border-radius:10px; cursor:pointer; }
      .gsub-item:focus-visible { outline:var(--focus-width,3px) solid var(--focus-ring,#5dc8f0); outline-offset:-3px; background:rgba(255,255,255,.05); }
      .gsub-item[aria-checked="true"]::before { content:'\\2713'; color:var(--accent,#9be15d); font-weight:800; }
      .gsub-item[aria-checked="false"]::before { content:''; display:inline-block; width:.8em; }
      .gsub-item[aria-disabled="true"] { opacity:.55; cursor:default; }
      .gsub-item .gsub-note { margin-left:auto; font-size:11.5px; color:var(--muted,#8a94a6); text-align:right; }
      .gsub-item .gsub-badge { font-size:10.5px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; padding:2px 7px;
        border-radius:20px; background:rgba(var(--accent-rgb,155,225,93),.18); color:var(--accent,#9be15d); white-space:nowrap; }
      .gsub-item .gsub-main { display:flex; flex-direction:column; gap:3px; min-width:0; }
      .gsub-item .gsub-main span:last-child { font-size:12px; color:var(--muted,#8a94a6); overflow:hidden; text-overflow:ellipsis; }
      .gsub-hr { height:1px; background:var(--line,#2a3242); margin:6px 4px; }
      .gsub-notecard { position:absolute; z-index:6; left:clamp(14px,3vw,40px); bottom:calc(var(--gsub-chrome, 90px) + 14px); max-width:min(520px, calc(100% - 28px));
        padding:12px 14px; border-radius:14px; background:var(--bg-2,#1a212e); border:1px solid rgba(255,212,121,.45); color:var(--text,#e7ecf2);
        box-shadow:0 24px 70px rgba(0,0,0,.6); font-size:14px; transition:bottom .25s ease; }
      .gsub-notecard p { margin:0 0 10px; line-height:1.45; }
      .gsub-toast { position:absolute; z-index:6; top:clamp(14px,3vh,32px); left:50%; transform:translateX(-50%); padding:8px 14px; border-radius:10px;
        background:rgba(10,14,20,.86); border:1px solid var(--line,#2a3242); color:var(--text,#e7ecf2); font-size:13px; font-weight:600;
        pointer-events:none; transition:opacity .5s ease; max-width:calc(100% - 40px); }
      .gsub-toast.gone { opacity:0; }
      body.gnw-tv .gsub-toast { font-size:16px; }
      .gsub-notecard-btns { display:flex; gap:8px; }
      body.gnw-tv .gsub-notecard { font-size:17px; left:max(6vw, env(safe-area-inset-left,0px)); }
      .gsub-info { margin:4px 6px 8px; padding:10px 12px; border-radius:10px; background:rgba(0,0,0,.35); white-space:pre-wrap; overflow-wrap:anywhere;
        font:12px/1.5 ui-monospace,"Cascadia Mono",Consolas,monospace; color:var(--text,#e7ecf2); max-width:min(760px, calc(100vw - 80px)); outline:none; }
      .gsub-info:focus-visible { outline:var(--focus-width,3px) solid var(--focus-ring,#5dc8f0); }
      .gsub-info b { color:var(--accent,#9be15d); font-weight:700; }
      .gsub-info .bad { color:#ff8f8f; font-weight:700; }
      body.gnw-tv .gsub-info { font-size:15px; }

      body.gnw-tv .gsub-bar { font-size:16px; gap:8px; padding:40px max(6vw, env(safe-area-inset-right,0px)) max(6vh, env(safe-area-inset-bottom,0px)) max(6vw, env(safe-area-inset-left,0px)); }
      body.gnw-tv .gsub-row { gap:9px; }
      body.gnw-tv .gsub-btn { min-height:50px; padding:10px 16px; }
      body.gnw-tv .gsub-menu { font-size:17px; }
      body.gnw-tv .gsub-status { font-size:16px; left:max(6vw, env(safe-area-inset-left,0px)); }

      /* Settings -> Subtitles */
      .gsub-set-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:14px 18px; margin-top:13px; }
      .gsub-set-grid label.gsub-l { display:block; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--muted); margin-bottom:6px; }
      .gsub-set-grid select, .gsub-set-grid input[type=range] { width:100%; }
      #gsub-settings input[type=range] { accent-color:var(--accent); }
      .gsub-set-grid select { padding:9px 10px; border-radius:10px; background:rgba(255,255,255,.04); border:1px solid var(--line); color:var(--text); font-size:13px; }
      .gsub-seg { display:flex; flex-wrap:wrap; gap:7px; }
      .gsub-seg button { appearance:none; padding:8px 13px; border-radius:20px; border:1px solid var(--line); background:rgba(255,255,255,.03);
        font:inherit; font-size:12.5px; color:var(--muted); cursor:pointer; }
      .gsub-seg button[aria-checked="true"] { background:rgba(var(--accent-rgb),.16); border-color:rgba(var(--accent-rgb),.5); color:var(--text); font-weight:700; }
      .gsub-swatch { width:30px; height:30px; border-radius:50%; border:2px solid var(--line); cursor:pointer; padding:0; }
      .gsub-swatch[aria-checked="true"] { border-color:var(--text); box-shadow:0 0 0 2px var(--bg-1), 0 0 0 4px rgba(var(--accent-rgb),.8); }
      .gsub-preview { position:relative; margin-top:14px; aspect-ratio:16/9; width:100%; max-width:560px; border-radius:12px; overflow:hidden;
        background:linear-gradient(160deg,#4d6c8a 0%,#29374a 45%,#c9a874 46%,#7d5b35 100%); border:1px solid var(--line); }
      .gsub-preview::after { content:''; position:absolute; inset:0; background:radial-gradient(60% 50% at 70% 30%, rgba(255,240,200,.45), transparent 70%); }
      .gsub-preview .gsub-layer { z-index:1; }`;
    document.head.appendChild(s);
  }

  /* Style variables onto a container. `frameH` = height of the 16:9 frame the
     text is sized against, so a 2.39:1 film does not get smaller text. */
  function styleInto(el, s, frameH) {
    const size = (SIZES.find(x => x.id === s.size) || SIZES[2]).pct;
    const font = (FONTS.find(x => x.id === s.font) || FONTS[0]).css;
    el.style.setProperty('--gsub-size', Math.max(12, Math.round(frameH * size / 100)) + 'px');
    el.style.setProperty('--gsub-font', font);
    el.style.setProperty('--gsub-color', s.color || '#fff');
    el.style.setProperty('--gsub-box', String(Math.max(0, Math.min(1, +s.boxOpacity || 0))));
    el.classList.toggle('gsub-edge-outline', s.edge === 'outline');
    el.classList.toggle('gsub-edge-shadow', s.edge === 'shadow');
    el.classList.toggle('gsub-box', !!s.box);
  }

  /* ------------------------------------------------------------- the live */

  let _live = null;   // one player at a time
  /* Picture-based subtitle tracks (PGS/VobSub) cannot be drawn as text. Another
     module that can have the server burn them in registers here; with none
     registered they are listed but cannot be chosen. fn receives
     { item, source, stream, video, stage, currentTime, path }. */
  let _pictureHandler = null;
  function setPictureHandler(fn) { _pictureHandler = typeof fn === 'function' ? fn : null; }

  const ICON = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 17 6 12l5-5M18 17l-5-5 5-5"/></svg>',
    fwd: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m13 17 5-5-5-5M6 17l5-5-5-5"/></svg>',
    cc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M10.5 10.2a2.4 2.4 0 1 0 0 3.6M17.5 10.2a2.4 2.4 0 1 0 0 3.6"/></svg>',
    fs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    vol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="m17 9 5 6M22 9l-5 6"/></svg>',
    speed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14l4-4"/><path d="M3.5 17a9 9 0 1 1 17 0"/></svg>',
  };

  /* ---------------------------------------------------------------- popups
     Every popup in the player (the Subtitles menu, the Speed menu, the
     Chapters panel from embytrick.js) follows one rule: it closes on a click
     or tap anywhere outside it, on Escape / Back (one popup per press, and the
     player stays open), and when the controls hide. Only one is open at a
     time. Other modules register theirs here. */
  const _popups = new Map();   // name -> { isOpen(), close(refocus) }
  function registerPopup(name, p) { if (p) _popups.set(name, p); else _popups.delete(name); }
  function openPopupName(L) {
    if (L && L.menu && !L.menu.hidden) return 'menu';
    for (const [n, p] of _popups) { try { if (p.isOpen()) return n; } catch {} }
    return null;
  }
  function popupEls(L) {
    const out = [];
    if (L && L.menu && !L.menu.hidden) out.push(L.menu);
    for (const p of _popups.values()) { try { if (p.isOpen() && p.el) out.push(p.el()); } catch {} }
    return out.filter(Boolean);
  }
  /* quiet: closed by the controls hiding, which is not input -- no wake. */
  function closePopups(L, refocus, except, quiet) {
    if (L && except !== 'menu' && L.menu && !L.menu.hidden) closeMenu(L, refocus, quiet);
    for (const [n, p] of _popups) { if (n === except) continue; try { if (p.isOpen()) p.close(refocus); } catch {} }
  }
  /* Put a popup just above the button that opened it, kept inside the stage. */
  function placePopup(stage, el, anchor) {
    if (!stage || !el || !anchor) return;
    const sr = stage.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
    el.style.right = 'auto'; el.style.margin = '0';
    const w = el.offsetWidth || 260;
    const left = Math.max(12, Math.min(sr.width - w - 12, ar.left - sr.left + ar.width / 2 - w / 2));
    el.style.left = left + 'px';
    el.style.bottom = Math.max(12, sr.bottom - ar.top + 10) + 'px';
    el.style.maxHeight = Math.max(160, ar.top - sr.top - 24) + 'px';
  }
  const isBackKey = e => (e.key === 'Escape' || e.key === 'GoBack' || e.key === 'BrowserBack' ||
    (e.key === 'Backspace' && !(e.target && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)))));

  function attach(ctx) {
    detach();
    if (!ctx || !ctx.video || !ctx.stage || !ctx.item || !api()) return null;
    ensureStyles();
    const L = {
      v: ctx.video, stage: ctx.stage, item: ctx.item, src: ctx.source || null, path: ctx.path || 'direct',
      audio: ctx.audioStream || null, timeShift: +ctx.timeShift || 0,
      burnedIndex: ctx.burnedIndex != null ? +ctx.burnedIndex : null,   // a picture track the server burned in (embytranscode.js)
      track: null, cues: [], adj: null, offset: 0, scale: 1, rec: null, key: null,
      shownKey: '', dead: false, raf: 0, lastInput: Date.now(), quietTimer: 0, status: '', statusTimer: 0,
      on: false, menu: null, hold: null, saveTimer: 0, listeners: [],
    };
    _live = L;
    const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); L.listeners.push([el, ev, fn, opt]); };

    // ONE SET OF CONTROLS. The browser's own <video controls> go: this bar
    // replaces them (play, seek, time, volume, full screen are all here), so
    // there is never a second bar, and nothing can put the bare <video> into
    // full screen, which would leave the subtitles and every control behind
    // (full screen shows only the element that asked for it). If this file
    // fails to load, the play paths keep their `controls` attribute.
    try { L.v.controls = false; L.v.removeAttribute('controls'); } catch {}
    try { L.v.controlsList && L.v.controlsList.add('nofullscreen'); } catch {}

    L.layer = document.createElement('div');
    L.layer.className = 'gsub-layer';
    L.layer.innerHTML = '<div class="gsub-cues" aria-live="off"></div>';
    L.cueBox = L.layer.firstChild;
    L.stage.appendChild(L.layer);
    buildBar(L, on);
    if (L.item.cwPlain) L.btn.pick.remove();   // a plain film (emby.js playPlainFilm) has no subtitles and no server to ask
    applyStyle(L);

    // Draw from the media clock, every frame. Also on the events that move the
    // clock while no frames are painted (a paused seek, a background tab).
    const tick = () => { if (L.dead) return; render(L); L.raf = requestAnimationFrame(tick); };
    L.raf = requestAnimationFrame(tick);
    for (const ev of ['timeupdate', 'seeked', 'seeking', 'ratechange', 'loadedmetadata']) on(L.v, ev, () => render(L));
    for (const ev of ['play', 'pause', 'playing']) on(L.v, ev, () => { updateBar(L); wake(L, false); });
    on(L.v, 'loadedmetadata', () => layout(L));
    for (const ev of ['ratechange', 'volumechange']) on(L.v, ev, () => updateBar(L));
    on(window, 'resize', () => layout(L));
    on(document, 'fullscreenchange', () => {
      // Full screen must hold the whole player, never the bare <video>: on a
      // video element, the overlay (subtitles, controls) is not drawn at all.
      const fe = document.fullscreenElement;
      if (fe && fe.tagName === 'VIDEO' && L.stage.contains(fe)) {
        const ov = L.stage.closest('#video-player-overlay') || L.stage;
        Promise.resolve(document.exitFullscreen()).catch(() => {}).then(() => {
          try { const p = ov.requestFullscreen(); if (p && p.catch) p.catch(() => {}); } catch {}
        });
      }
      layout(L); updateBar(L);
    });
    on(document, 'keydown', e => onKey(L, e), true);
    // Mouse: any move brings the controls up (moving the mouse is not hover:
    // the controls answer the movement, as the browser's own did).
    on(L.stage, 'pointermove', e => {
      if (e.pointerType === 'mouse' && L.lastXY && Math.abs(e.clientX - L.lastXY[0]) + Math.abs(e.clientY - L.lastXY[1]) < 3) return;
      L.lastXY = [e.clientX, e.clientY];
      wake(L, false);
    });
    on(L.bar, 'pointerenter', e => { if (e.pointerType === 'mouse') { L.overBar = true; wake(L, false); } });
    on(L.bar, 'pointerleave', () => { L.overBar = false; wake(L, false); });
    // A press anywhere outside an open popup closes it (and does nothing else).
    on(document, 'pointerdown', e => onOutside(L, e), true);
    // The picture: a click plays/pauses (a tap with the controls hidden only
    // shows them), a double-click toggles full screen of the whole player.
    on(L.stage, 'click', e => onPictureClick(L, e));
    on(L.stage, 'dblclick', e => { if (isPicture(L, e.target) && !L.v.classList.contains('prepping')) { toggleFullscreen(L); } });
    if (window.ResizeObserver) { L.ro = new ResizeObserver(() => layout(L)); L.ro.observe(L.stage); }

    startTrack(L);
    layout(L);
    wake(L, false);
    return L;
  }

  function detach() {
    const L = _live; if (!L) return;
    _live = null;
    L.dead = true;
    cancelAnimationFrame(L.raf);
    clearTimeout(L.quietTimer); clearTimeout(L.statusTimer); clearTimeout(L.saveTimer); clearTimeout(L.clickTimer);
    try { L.menuRo && L.menuRo.disconnect(); } catch {}
    try { L.stage.classList.remove("gsub-idle"); L.stage.style.removeProperty("--gsub-chrome"); } catch {}
    stopHold(L);
    flushSave(L);
    for (const [el, ev, fn, opt] of L.listeners) { try { el.removeEventListener(ev, fn, opt); } catch {} }
    try { L.ro && L.ro.disconnect(); } catch {}
    for (const n of [L.layer, L.bar, L.menu]) { try { n && n.remove(); } catch {} }
    if (L.sync && L.sync.abort) { try { L.sync.abort(); } catch {} }
    if (document.fullscreenElement && L.stage.closest && document.fullscreenElement.contains(L.stage)) {
      try { document.exitFullscreen(); } catch {}
    }
  }

  /* -------------------------------------------------------------- layout */

  function pictureRect(L) {
    const v = L.v, sr = L.stage.getBoundingClientRect(), r = v.getBoundingClientRect();
    let x = r.left - sr.left, y = r.top - sr.top, w = r.width, h = r.height;
    if (v.videoWidth && v.videoHeight && w && h) {
      const k = Math.min(w / v.videoWidth, h / v.videoHeight);
      const pw = v.videoWidth * k, ph = v.videoHeight * k;
      x += (w - pw) / 2; y += (h - ph) / 2; w = pw; h = ph;
    }
    return { x, y, w, h, sw: sr.width, sh: sr.height };
  }
  function applyStyle(L) {
    const s = loadSettings();
    const p = pictureRect(L);
    const frameH = Math.min(p.sh || p.h, (p.sw || p.w) * 9 / 16) || 540;
    styleInto(L.layer, s, frameH);
  }
  function layout(L) {
    if (!L || L.dead) return;
    const s = loadSettings();
    const p = pictureRect(L);
    applyStyle(L);
    let bottom = (p.sh - (p.y + p.h)) + p.h * (Math.max(0, Math.min(40, +s.position || 0)) / 100);
    // Never under the controls while they are up: the text moves up above
    // them, and back down when they hide. --gsub-chrome tells Skip Intro and
    // Up Next how much room the controls take (0 while hidden).
    let chrome = 0;
    if (L.bar && !L.bar.hidden && !L.bar.classList.contains('gsub-quiet')) {
      const sr = L.stage.getBoundingClientRect();
      // The top of what is actually drawn: the seek bar, or the button row.
      const top = L.bar.querySelector('.gsub-seekrow:not(:empty)') || L.bar.querySelector('.gsub-row');
      const br = (top || L.bar).getBoundingClientRect();
      if (br.height) { chrome = Math.max(0, sr.bottom - br.top); bottom = Math.max(bottom, chrome + 12); }
    }
    L.stage.style.setProperty('--gsub-chrome', Math.round(chrome) + 'px');
    L.cueBox.style.left = p.x + 'px';
    L.cueBox.style.width = p.w + 'px';
    L.cueBox.style.bottom = bottom + 'px';
  }

  /* -------------------------------------------------------------- render */

  /* Cue i is on screen when  start*scale + offset <= t < end*scale + offset,
     t = the media clock (minus any path shift). Adjusted times are rebuilt
     only when offset/scale change; lookup is a binary search plus a short walk
     back for overlapping cues. */
  /* SECTIONS (2026-10-07): subtitles for a different
     cut need a different offset per part of the film. L.sections =
     [[fromSubtitleTime, delta], ...] (delta added to L.offset from that
     subtitle time on; the first is 0), or null. − / + move every section
     together. A section that starts EARLIER than the line before it ends
     (scenes removed) is clamped so the lines stay in order for the search. */
  function secDelta(L, t) {
    const S = L.sections; if (!S) return 0;
    let d = 0; for (const x of S) if (t >= x[0]) d = x[1];
    return d;
  }
  function rebuildAdj(L) {
    const n = L.cues.length, st = new Float64Array(n), en = new Float64Array(n);
    let maxDur = 0;
    for (let i = 0; i < n; i++) {
      const d = secDelta(L, L.cues[i].start);
      st[i] = L.cues[i].start * L.scale + L.offset + d;
      en[i] = L.cues[i].end * L.scale + L.offset + d;
      if (i && st[i] < st[i - 1]) { st[i] = st[i - 1]; if (en[i] < st[i]) en[i] = st[i]; }
      maxDur = Math.max(maxDur, en[i] - st[i]);
    }
    L.adj = { st, en, maxDur };
  }
  function activeAt(L, t) {
    const a = L.adj; if (!a || !a.st.length) return [];
    let lo = 0, hi = a.st.length - 1, last = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (a.st[m] <= t) { last = m; lo = m + 1; } else hi = m - 1; }
    const out = [];
    for (let i = last; i >= 0 && a.st[i] > t - a.maxDur - 0.001; i--) if (t < a.en[i]) out.push(i);
    return out.reverse();
  }
  function render(L) {
    if (L.dead) return;
    let key = '';
    let idx = [];
    if (L.on && L.adj) {
      const t = (L.v.currentTime || 0) - L.timeShift;
      idx = activeAt(L, t);
      key = idx.join(',');
    }
    // A failure is said where the subtitles would have been, for a while.
    const test = L.testLine && Date.now() < L.testLine.until;
    const notice = test ? 'TEST LINE: if you can read this, subtitles can draw here.' : (L.notice && Date.now() < L.notice.until ? L.notice.text : '');
    if (notice) key = 'notice:' + notice;
    if (key === L.shownKey) return;
    L.shownKey = key;
    if (notice) { L.cueBox.innerHTML = `<div class="gsub-cue"><span class="gsub-notice">${escHtml(notice)}</span></div>`; L.cueBox.dataset.cue = ''; return; }
    L.cueBox.innerHTML = idx.map(i => `<div class="gsub-cue"><span class="gsub-line">${L.cues[i].html}</span></div>`).join('');
    L.cueBox.dataset.cue = key;   // read by the test harness; harmless otherwise
  }

  /* -------------------------------------------------------------- tracks */

  function audioStreamOf(L) {
    if (L.audio) return L.audio;
    const auds = ((L.src && L.src.MediaStreams) || []).filter(s => s.Type === 'Audio');
    return auds.find(a => a.IsDefault) || auds[0] || null;
  }
  async function startTrack(L) {
    if (L.item.cwPlain) { updateBar(L); return; }
    if (L.burnedIndex != null) {
      // Burned into the picture by the server: nothing to draw, but it is the chosen track.
      const b = subStreams(L.src).find(x => x.Index === L.burnedIndex);
      if (b) {
        L.track = b; L.cues = []; L.adj = null; L.key = null; L.on = true;
        setStatus(L, trackLabel(b) + ' subtitles are burned into the picture by your server.', 6000);
        updateBar(L);
        return;
      }
    }
    const c = chooseTrack(L.src, audioStreamOf(L), L.item);
    if (c.stream && !c.stream.IsForced && (c.reason === 'preferred' || c.reason === 'remembered')) {
      setStatus(L, 'Loading subtitles…');
      const lang = normLang(c.stream.Language);
      const list = await loadLanguage(L, lang);
      if (L.dead) return;
      let pick = c.stream;
      const usable = x => { const q = quality(L, x); return !!q && !refused(q); };
      if (!usable(pick)) pick = list.filter(x => !x.IsForced && usable(x)).sort((a, b) => quality(L, b).last - quality(L, a).last)[0] || null;
      if (pick) { await selectTrack(L, pick, { auto: true }); closeNoteCard(L); return; }
      // Nothing complete in this language: subtitles stay off; with "Replace
      // broken subtitles automatically" (on by default) the best complete track is
      // downloaded and used; the note is kept only for when that fails.
      setOn(L, false); L.track = null; setStatus(L, '');
      updateBar(L);
      if (loadSettings().fixBroken) { fixBroken(L, c.stream); return; }
      offerBetter(L, c.stream);
      return;
    }
    if (c.stream) return selectTrack(L, c.stream, { auto: true });
    setOn(L, false);
    if (c.reason === 'image-only') {
      setStatus(L, langLabel(c.image.Language) + ' subtitles here are pictures (' + String(c.image.Codec || 'image').toUpperCase() + '). ' +
        (_pictureHandler ? 'Choose them under Subtitles to have your server burn them in, or try Find subtitles…'
                         : 'They can’t be drawn here. Try Subtitles ▸ Find subtitles…'), 9000);
    }
    const s = loadSettings();
    if (s.autoFetch && s.mode !== 'off' && (c.reason === 'none-in-language' || c.reason === 'image-only') && window.GnwSubs.autoFind) {
      window.GnwSubs.autoFind(L);
    }
    updateBar(L);
  }
  /* "These English subtitles look incomplete (end at 1:21 of 2:04). Find
     better subtitles?" -- once per file, unless Keep was chosen for it. */
  function offerBetter(L, st, again) {
    if (L.dead || !st) return;
    const q = quality(L, st);
    if (!q || !refused(q)) { closeNoteCard(L); return; }
    if (kept(L) && !again) return;
    closeNoteCard(L);
    const lang = langLabel(st.Language);
    const why = q.incomplete ? 'are incomplete (they end at ' + fmtHM(q.last) + ' of ' + fmtHM(q.runtime) + ')' : 'are only the forced lines';
    const card = document.createElement('div');
    card.className = 'gsub-notecard';
    card.setAttribute('role', 'alertdialog');
    card.setAttribute('aria-label', 'Subtitles look incomplete');
    card.innerHTML = '<p>' + escHtml((again ? 'The downloaded ' : 'This film\u2019s ') + lang + ' subtitles ' + why + ', so they are not played. Find complete subtitles?') + '</p>' +
      '<div class="gsub-notecard-btns"><button type="button" class="gsub-btn" data-n="find">Find subtitles</button><button type="button" class="gsub-btn" data-n="keep">Not now</button></div>';
    card.addEventListener('click', e => {
      e.stopPropagation();
      const b = e.target.closest('[data-n]'); if (!b) return;
      if (b.dataset.n === 'keep') { setKept(L); closeNoteCard(L, true); return; }
      closeNoteCard(L);
      L.findAfter = st;
      openMenu(L, 'find');
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); const bs = [...card.querySelectorAll('button')]; (bs[bs.indexOf(document.activeElement) === 0 ? 1 : 0]).focus(); }
    });
    L.stage.appendChild(card);
    L.noteCard = card;
    registerPopup('incomplete', { isOpen: () => !!(L.noteCard && L.noteCard.isConnected), close: () => closeNoteCard(L), el: () => L.noteCard, anchor: () => null });
    const a = document.activeElement, ov = L.stage.closest('#video-player-overlay');
    if (!a || a === document.body || a === L.v || a === ov || document.body.classList.contains('gnw-tv')) { try { card.querySelector('[data-n="find"]').focus({ preventScroll: true }); } catch {} }
    wake(L, false);
  }
  /* "If the subtitles are set to auto on, and the default is broken, just
     download the one that has the most and start the auto sync" (design note). Up to
     3 results, best first (hash match, then downloads); each is checked like any
     track and the first complete one is used. One short toast either way. Once
     per film per browser session, so a failing provider is not asked again and
     again. */
  async function fixBroken(L, st) {
    const lang = normLang(st.Language);
    const sk = 'gnw.subs.fixbroken:' + L.item.Id + ':' + lang;
    try { if (sessionStorage.getItem(sk)) { offerBetter(L, st); return; } sessionStorage.setItem(sk, '1'); } catch {}
    L.fixing = true;
    let why = '';
    try {
      const list = (await searchRemote(L, lang)).filter(r => !r.IsForced);
      if (L.dead) return;
      if (!list.length) why = 'No complete ' + langLabel(lang) + ' subtitles were found by your server’s providers.';
      for (const r of list.slice(0, 3)) {
        let nst;
        try { nst = await downloadRemote(L, r); } catch (e) { why = remoteError(e); break; }
        if (L.dead) return;
        if (!nst) { why = 'Your server downloaded subtitles but has not listed them yet.'; continue; }
        const res = await selectTrack(L, nst, { auto: true, quietRefuse: true, download: true });
        if (L.dead) return;
        if (res !== 'refused' && L.track === nst) {
          toast(L, 'Downloaded ' + langLabel(lang) + ' subtitles');
          L.fixedBy = r.Name || r.Id;
          return;
        }
        why = 'The ' + langLabel(lang) + ' subtitles found were incomplete too.';
      }
    } catch (e) { why = remoteError(e); }
    finally { L.fixing = false; }
    if (L.dead) return;
    L.fixFailed = why;
    toast(L, why || 'Couldn’t replace the broken subtitles.');
    offerBetter(L, st);
  }
  function toast(L, msg) {
    try { if (L.toastEl) L.toastEl.remove(); } catch {}
    const t = document.createElement('div');
    t.className = 'gsub-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    L.stage.appendChild(t); L.toastEl = t;
    setTimeout(() => { try { t.classList.add('gone'); } catch {} }, 4000);
    setTimeout(() => { try { t.remove(); } catch {} if (L.toastEl === t) L.toastEl = null; }, 4600);
  }
  function closeNoteCard(L, refocus) {
    if (!L.noteCard) return;
    const had = L.noteCard.contains(document.activeElement);
    try { L.noteCard.remove(); } catch {}
    L.noteCard = null;
    registerPopup('incomplete', null);
    if ((had || refocus) && !L.dead) { try { L.btn.pick.focus({ preventScroll: true }); } catch {} }
  }
  async function selectTrack(L, st, opts = {}) {
    if (L.dead) return;
    flushSave(L);
    if (L.burnedIndex != null && _pictureHandler) {
      // A picture track is burned in by the server: the same choice is a no-op,
      // anything else means converting again without it (or with the other one).
      if (st === L.track) return;
      if (!opts.auto) setPick(L.item.Id, st ? streamKey(st) : 'off');
      try { _pictureHandler({ item: L.item, source: L.src, stream: st || null, video: L.v, stage: L.stage, currentTime: L.v.currentTime || 0, path: L.path, unburn: true }); }
      catch (e) { setStatus(L, 'Couldn’t change the subtitles (' + ((e && e.message) || 'error') + ').', 7000); }
      return;
    }
    if (!st) {
      L.track = null; L.cues = []; L.adj = null; L.key = null;
      setOn(L, false);
      if (!opts.auto) setPick(L.item.Id, 'off');
      updateBar(L); render(L);
      return;
    }
    if (isCaption(st)) {
      setStatus(L, 'These closed captions are carried inside the picture and can’t be shown here. Use Find subtitles… for a text version.', 7000);
      return;
    }
    if (!isTextStream(st)) {
      // Picture-based: not drawn here. Handed to the server burn-in path
      // (embytranscode.js registers itself with setPictureHandler) when there is one.
      if (_pictureHandler) {
        L.track = null; L.cues = []; L.adj = null; L.key = null; setOn(L, false); updateBar(L);
        try { document.dispatchEvent(new CustomEvent('gnw:subs-picture', { detail: { item: L.item, source: L.src, stream: st } })); } catch {}
        try { _pictureHandler({ item: L.item, source: L.src, stream: st, video: L.v, stage: L.stage, currentTime: L.v.currentTime || 0, path: L.path }); }
        catch (e) { setStatus(L, 'Couldn’t hand those subtitles to the server (' + ((e && e.message) || 'error') + ').', 7000); }
        return;
      }
      setStatus(L, 'Picture-based subtitles (' + String(st.Codec || '').toUpperCase() + ') can’t be drawn here. Use Find subtitles… for a text version.', 7000);
      return;
    }
    L.track = st; L.cues = []; L.adj = null;
    L.lastTrack = st;   // for Subtitle info, even after a failure
    L.key = offKey(L.item, L.src, st);
    L.rec = purgeOldAuto(L.key, getOffset(L.key));
    L.offset = L.rec ? (+L.rec.o || 0) : 0;
    L.scale = L.rec ? (+L.rec.s || 1) : 1;
    L.sections = (L.rec && Array.isArray(L.rec.sec) && L.rec.sec.length > 1) ? L.rec.sec : null;
    L.autoPending = null;
    if (!opts.auto) setPick(L.item.Id, streamKey(st));
    setOn(L, true);
    setStatus(L, 'Loading subtitles…');
    updateBar(L);
    try {
      const cues = await fetchCues(L.item, L.src, st);
      if (L.dead || L.track !== st) return;
      // Never play an incomplete track (decided 2026-10-04). Its forced sibling(s)
      // are loaded first so "same as forced" can be judged.
      if (!st.IsForced) {
        await loadLanguage(L, normLang(st.Language));
        if (L.dead || L.track !== st) return;
        const q = quality(L, st);
        if (refused(q)) {
          L.track = null; L.cues = []; L.adj = null; L.key = null;
          setOn(L, false);
          if (!opts.auto && !opts.quietRefuse) {
            L.notice = { text: refuseText(L, st, q, opts.download), until: Date.now() + 6000 };
            setStatus(L, refuseText(L, st, q, opts.download), 7000);
          }
          if (!opts.auto) setPick(L.item.Id, 'off');
          updateBar(L);
          L.lastRefused = st;
          return 'refused';
        }
      }
      L.cues = cues;
      rebuildAdj(L);
      L.notice = null;
      L.shownKey = '-';   // a new track whose line due now has the same index as the old one must still repaint
      if (L.failed) delete L.failed[streamKey(st)];
      setStatus(L, '');
      render(L);
      const s = loadSettings();
      // Each track keeps its own sync (offKey is per stream). A track the viewer
      // picked, with no sync saved for it yet, is auto-synced straight away and the
      // result shown (reported: "Auto Sync does not seem to update when I change
      // subtitles"); "always on" picks follow the Settings switch as before.
      // Every track is synced by itself, once (the result is kept per track);
      // not a track set by hand, nor forced tracks / a handful of lines.
      if (!autoSettled(L.rec)) startAutoSync(L);
    } catch (e) {
      if (L.dead || L.track !== st) return;
      // Never silent: said in the bar, where the text would be, and beside
      // the track in the Subtitles menu, with what the server answered.
      const why = (e && e.message) || 'error';
      console.warn('[subs] subtitle stream failed:', trackLabel(st), why, e && e.tried);
      (L.failed || (L.failed = {}))[streamKey(st)] = why;
      L.track = null; setOn(L, false);
      L.notice = { text: 'Subtitles couldn’t load: ' + why + '.', until: Date.now() + 8000 };
      setStatus(L, 'Couldn’t load ' + trackLabel(st) + ' subtitles (' + why + '). Choose another track under Subtitles.', 10000);
    }
    updateBar(L);
  }
  function setOn(L, on) { L.on = !!on; if (!on) { L.shownKey = '-'; render(L); } }

  /* -------------------------------------------------------------- offset */

  function setOffsetLive(L, o, scale, meta) {
    L.offset = Math.round(o * 1000) / 1000;
    if (scale != null) L.scale = scale;
    rebuildAdj(L);
    L.shownKey = '-';
    render(L);
    clearTimeout(L.saveTimer);
    L.pendingMeta = Object.assign({}, L.pendingMeta || {}, meta || {});   // before the bar reads manual/auto
    updateBar(L);
    L.saveTimer = setTimeout(() => flushSave(L), 400);
  }
  function flushSave(L) {
    if (!L || !L.key || !L.track) return;
    clearTimeout(L.saveTimer);
    if (L.pendingMeta == null) return;
    const rec = Object.assign({}, L.rec || {}, L.pendingMeta, { o: L.offset, s: L.scale, sec: L.sections || null });
    L.rec = rec;
    L.pendingMeta = null;
    setOffset(L.key, rec);
  }
  /* SYNC IS AUTOMATIC (2026-10-04: "it should always do auto sync unless
     the user changes it by - or +. Auto sync is like an option in the middle").
     Each track's record keeps the automatic result (autoO/autoS) apart from what
     is applied (o/s). − / + switch the track to manual, starting from wherever
     the automatic result put it; the middle button puts it back on the
     automatic result (and works one out if there is none yet). */
  /* THE NUDGE STAYS ON TOP (2026-10-08: "The user's manual nudge still
     adds on top"). − / + keep their sum as u; every automatic result that
     arrives later is applied as its own offset + u, so a nudge is never lost
     and never stops the automatic sync from improving. A track set by hand
     before this (manual, no u kept): u is what it was set to beyond the
     automatic result, or the whole offset when there was none. */
  function userNudge(L) {
    const R0 = Object.assign({}, L.rec || {}, L.pendingMeta || {});
    if (!R0.manual) return 0;
    if (R0.u != null && isFinite(+R0.u)) return +R0.u;
    return Math.round((L.offset - (R0.autoO != null ? +R0.autoO : 0)) * 1000) / 1000;
  }
  function nudge(L, d) {
    if (!L.on || !L.track) return;
    const u = Math.round((userNudge(L) + d) * 1000) / 1000;
    setOffsetLive(L, L.offset + d, null, { manual: true, u });
  }
  /* Sync again unless this track has a finished result of the current version,
     or was set by hand with no automatic result at all from before nudges were
     kept apart (no u, no autoO: its offset is the viewer's whole correction,
     and adding a new result to it would count twice). */
  function autoSettled(rec) {
    if (!rec) return false;
    if (rec.manual && rec.u == null && rec.autoO == null) return true;
    return rec.autoO != null && (+rec.autoV || 1) >= AUTO_V && rec.autoFinal !== false;
  }
  /* A saved automatic result from an older model is not trusted (2026-10-10: S26E07 kept
     a +325.7 s, 8-segment result saved under tag f and showed it again, never re-checked). It is
     taken off: the timing goes back to none (plus the viewer's own nudge, if one was kept apart),
     and auto-sync runs again. A record set wholly by hand is left alone. */
  function purgeOldAuto(key, rec) {
    if (!rec || rec.autoO == null) return rec;
    const old = (+rec.autoV || 1) < AUTO_V, tooMany = Array.isArray(rec.autoSec) && rec.autoSec.length > 3;
    if (!old && !tooMany) return rec;
    if (rec.manual && rec.u == null) return rec;   // set by hand before nudges were kept apart: the viewer's own
    const u = rec.manual && rec.u != null ? +rec.u : 0;
    const out = Object.assign({}, rec, { o: u, s: 1, sec: null, autoO: null, autoS: null, autoV: null, autoSec: null, autoFinal: null, clk: null, purged: { o: rec.autoO, v: rec.autoV || 1, at: Date.now() } });
    setOffset(key, out);
    return out;
  }
  function isManual(L) {
    if (L.pendingMeta && 'manual' in L.pendingMeta) return !!L.pendingMeta.manual;
    return !!(L.rec && L.rec.manual);
  }
  function setAutoMode(L) {
    if (!L.on || !L.track) return;
    const r = L.rec || {};
    L.sections = (r.autoO != null && Array.isArray(r.autoSec) && r.autoSec.length > 1) ? r.autoSec : null;
    setOffsetLive(L, r.autoO != null ? +r.autoO : 0, r.autoS != null ? +r.autoS : 1, { manual: false, u: null });
    if (!autoSettled(Object.assign({}, r, { manual: false }))) startAutoSync(L);
  }
  /* A confident automatic result: kept for the track, applied unless it is manual. */
  /* Applied only between two lines (never while a line is on screen, so the
     timing never visibly jerks); after 20 s without a gap it is applied anyway. */
  function applyAuto(L, o, sc, meta) {
    if (!L || L.dead || !L.track) return;
    const manual = isManual(L);
    const sec = meta && Array.isArray(meta.autoSec) && meta.autoSec.length > 1 ? meta.autoSec : null;
    const m = Object.assign({}, meta || {}, { autoO: Math.round(o * 1000) / 1000, autoS: sc, auto: true, autoV: AUTO_V, autoSec: sec });
    // a track set by hand before nudges were kept apart: the result is saved, not applied
    { const R0 = Object.assign({}, L.rec || {}, L.pendingMeta || {});
      if (manual && R0.u == null && R0.autoO == null) { L.pendingMeta = Object.assign({}, L.pendingMeta || {}, m); flushSave(L); updateBar(L); return; } }
    const track = L.track, since = Date.now();
    L.autoPending = { o, sc, m, sec, track };
    clearInterval(L.autoTimer);
    const tryApply = () => {
      const p = L.autoPending;
      if (L.dead || !p || L.track !== p.track) { clearInterval(L.autoTimer); return false; }
      const t = (L.v.currentTime || 0) - L.timeShift;
      if (L.on && L.adj && activeAt(L, t).length && Date.now() - since < 20000) return false;
      clearInterval(L.autoTimer); L.autoPending = null;
      L.sections = p.sec;
      setOffsetLive(L, p.o + userNudge(L), p.sc, p.m);   // the viewer's nudge, if any, on top
      return true;
    };
    if (!tryApply()) L.autoTimer = setInterval(tryApply, 100);
  }
  /* Run silently: no bar messages, no buttons. Details go to Subtitle info. */
  function startAutoSync(L, extra) {
    if (!L || L.dead || !L.on || !L.track || L.track.IsForced || L.cues.length < 20 || !window.GnwSubs.autoSync) return;
    if (L.sync && L.sync.running && L.sync.track === L.track) return;
    window.GnwSubs.autoSync(L, Object.assign({ quiet: true, background: true }, extra || {}));
  }
  /* Re-sync (Subtitle info): forget this track's automatic result and the
     measured clock lag, go back to automatic, and match again from scratch.
     The applied timing stays as it is until the new result arrives. */
  function resync(L) {
    if (!L.on || !L.track) return 'no track is showing';
    if (L.track.IsForced || L.cues.length < 20) return 'this track is too short to match (forced or under 20 lines)';
    if (L.sync && L.sync.running && L.sync.track === L.track) return 'already matching';
    L.pendingMeta = Object.assign({}, L.pendingMeta || {}, { manual: false, u: null, autoO: null, autoS: null, autoV: null, clk: null, autoSec: null, autoFinal: null });
    flushSave(L);
    L.lastSync = null; L.clockCheck = null;
    updateBar(L);
    startAutoSync(L, { fresh: true });
    return 'started';
  }
  const fmtOff = o => (o >= 0 ? '+' : '−') + Math.abs(o).toFixed(Math.abs(o) >= 10 ? 1 : 1) + ' s';

  /* ----------------------------------------------------------------- bar */

  /* WHY THE BAR WAS PERMANENT, AND WHY IT IS NOT NOW. The first version kept
     this bar up for as long as subtitles were on, from the TV rule "nothing
     appears on hover" -- and the browser's own <video controls> sat under it,
     so there were two bars, one of them never going away. Hiding after a few
     seconds without input is not hover: the controls answer a mouse move, a
     touch, a key or a remote press, exactly as the browser's own controls
     did. So this is now the player's only control set and it auto-hides. */
  function buildBar(L, on) {
    const bar = document.createElement('div');
    bar.className = 'gsub-bar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Player controls');
    bar.innerHTML = `
      <span class="gsub-status" role="status"></span>
      <div class="gsub-seekrow"></div>
      <div class="gsub-row">
        <button type="button" class="gsub-btn" data-act="play" aria-label="Pause">${ICON.pause}</button>
        <span class="gsub-nudge-wrap" hidden>
          <button type="button" class="gsub-btn" data-act="minus" aria-label="Subtitles earlier by 0.1 seconds. Hold for bigger steps.">−0.1 s</button>
          <button type="button" class="gsub-btn gsub-off" data-act="auto" aria-live="polite"><span data-off>Auto</span></button>
          <button type="button" class="gsub-btn" data-act="plus" aria-label="Subtitles later by 0.1 seconds. Hold for bigger steps.">+0.1 s</button>
        </span>
        <span class="gsub-sep"></span>
        <button type="button" class="gsub-btn" data-act="back" aria-label="Back 10 seconds">${ICON.back}10</button>
        <button type="button" class="gsub-btn" data-act="fwd" aria-label="Forward 10 seconds">10${ICON.fwd}</button>
        <span class="gsub-grow"></span>
        <button type="button" class="gsub-btn" data-act="pick" aria-haspopup="menu" aria-expanded="false" aria-pressed="false">${ICON.cc}<span>Subtitles</span><small data-subval>Off</small></button>
        <span class="gsub-chslot"></span>
        <button type="button" class="gsub-btn" data-act="speed" aria-haspopup="menu" aria-expanded="false" aria-label="Playback speed">${ICON.speed}<span data-speedval>1×</span></button>
        <button type="button" class="gsub-btn" data-act="mute" aria-pressed="false" aria-label="Mute">${ICON.vol}</button>
        <button type="button" class="gsub-btn" data-act="fs" aria-label="Full screen">${ICON.fs}</button>
      </div>`;
    L.stage.appendChild(bar);
    L.bar = bar;
    L.btn = {};
    bar.querySelectorAll('[data-act]').forEach(b => { L.btn[b.dataset.act] = b; });
    L.btn.cc = L.btn.pick;   // one Subtitles control now (older callers knew two)
    L.offEl = bar.querySelector('[data-off]');
    L.statusEl = bar.querySelector('.gsub-status');
    L.nudgeWrap = bar.querySelector('.gsub-nudge-wrap');
    L.seekRow = bar.querySelector('.gsub-seekrow');
    L.chSlot = bar.querySelector('.gsub-chslot');

    on(bar, 'click', e => {
      e.stopPropagation();   // never reaches the picture's play/pause
      const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
      wake(L, false);
      const act = b.dataset.act;
      if (act === 'minus' || act === 'plus') { if (L.suppressClick) { L.suppressClick = false; return; } nudge(L, act === 'plus' ? 0.1 : -0.1); return; }
      if (act === 'play') { togglePlay(L); return; }
      if (act === 'back') { seekBy(L, -10); return; }
      if (act === 'fwd') { seekBy(L, 10); return; }
      if (act === 'pick') { toggleMenu(L, 'subs'); return; }
      if (act === 'speed') { toggleMenu(L, 'speed'); return; }
      if (act === 'mute') { L.v.muted = !L.v.muted; updateBar(L); return; }
      if (act === 'fs') { toggleFullscreen(L); return; }
      if (act === 'auto') { setAutoMode(L); return; }
    });
    on(bar, 'dblclick', e => e.stopPropagation());
    // Hold to nudge faster: pointer and remote (a held OK repeats keydown).
    for (const act of ['minus', 'plus']) {
      const b = L.btn[act], sign = act === 'plus' ? 1 : -1;
      on(b, 'pointerdown', e => {
        if (e.button !== 0) return;
        startHold(L, sign);
      });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) on(b, ev, () => stopHold(L));
      on(b, 'keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ' && e.keyCode !== 13) return;
        if (chromeHidden(L)) return;   // the first press only shows the controls
        e.preventDefault(); e.stopPropagation();
        wake(L, false);
        L.keyRepeat = e.repeat ? (L.keyRepeat || 0) + 1 : 0;
        nudge(L, sign * holdStep(L.keyRepeat));
      });
      on(b, 'keyup', () => { L.keyRepeat = 0; });
    }
    updateBar(L);
  }
  /* 0.1 s for a tap; holding grows the step: 0.5 s after ~0.6 s, 1 s after ~2 s. */
  function holdStep(n) { return n >= 18 ? 1 : n >= 5 ? 0.5 : 0.1; }
  function startHold(L, sign) {
    stopHold(L);
    const h = { sign, n: 0, timer: 0 };
    L.hold = h;
    const fire = () => {
      if (L.hold !== h) return;
      h.n++;
      L.suppressClick = true;   // the click that follows pointerup must not add another step
      nudge(L, sign * holdStep(h.n));
      wake(L, false);
      h.timer = setTimeout(fire, 110);
    };
    h.timer = setTimeout(fire, 450);   // a tap never reaches this: its click does the 0.1 s
  }
  function stopHold(L) { if (L.hold) { clearTimeout(L.hold.timer); L.hold = null; } }

  function togglePlay(L) {
    if (L.v.paused) { const p = L.v.play(); if (p && p.catch) p.catch(() => {}); } else L.v.pause();
  }
  function seekBy(L, d) {
    const v = L.v;
    const t = Math.max(0, Math.min((isFinite(v.duration) ? v.duration : Infinity) - 0.5, (v.currentTime || 0) + d));
    try { v.currentTime = t; } catch {}
  }
  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  function setSpeed(L, r) { L.v.playbackRate = r; updateBar(L); }
  function cycleSpeed(L) {
    const i = SPEEDS.indexOf(L.v.playbackRate);
    setSpeed(L, SPEEDS[(i + 1) % SPEEDS.length] || 1);
  }
  function toggleFullscreen(L) {
    const target = L.stage.closest('#video-player-overlay') || L.stage;
    if (document.fullscreenElement) { try { const p = document.exitFullscreen(); if (p && p.catch) p.catch(() => {}); } catch {} return; }
    try { const p = target.requestFullscreen && target.requestFullscreen(); if (p && p.catch) p.catch(() => {}); } catch {}
  }
  function toggleSubs(L) {
    if (L.on && L.track) { selectTrack(L, null); return; }
    // Turning on: the remembered/preferred text track, else the first text track.
    const all = subStreams(L.src).filter(isTextStream);
    if (!all.length) { openMenu(L); return; }
    const s = loadSettings();
    const prefs = s.langs.map(normLang);
    const best = all.slice().sort((a, b) => {
      const ra = prefs.indexOf(normLang(a.Language)), rb = prefs.indexOf(normLang(b.Language));
      return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb) || (a.IsForced ? 1 : 0) - (b.IsForced ? 1 : 0);
    })[0];
    selectTrack(L, best);
  }
  /* Auto-sync needs subtitles on screen; say so instead of doing nothing. */
  function runAutoSync(L) {
    if (true) { setAutoMode(L); return; }   // (2026-10-04: there is no Auto-sync button; the middle "Auto" does this)
    if (L.sync && L.sync.running && L.sync.background) {   // already running by itself: show it, do not restart it
      L.sync.background = false;
      setStatus(L, 'Auto-sync: listening…');
      return;
    }
    if (L.sync && L.sync.running) { window.GnwSubs.autoSync(L, { quiet: false }); return; }   // a second press cancels
    if (!L.on || !L.track || !L.cues.length) {
      setStatus(L, L.on && L.track ? 'Auto-sync: the subtitles are still loading. Try again in a moment.'
        : 'Auto-sync: no subtitles are showing. Choose a track under Subtitles first.', 6000);
      return;
    }
    if (window.GnwSubs.autoSync) window.GnwSubs.autoSync(L, { quiet: false });
  }

  function updateBar(L) {
    if (!L || L.dead || !L.bar) return;
    const b = L.btn;
    b.play.innerHTML = L.v.paused ? ICON.play : ICON.pause;
    b.play.setAttribute('aria-label', L.v.paused ? 'Play' : 'Pause');
    const shown = !!(L.on && L.track);
    b.pick.setAttribute('aria-pressed', shown ? 'true' : 'false');
    const val = shown ? trackLabel(L.track) : 'Off';
    const sv = b.pick.querySelector('[data-subval]'); if (sv) sv.textContent = val;
    b.pick.setAttribute('aria-label', 'Subtitles: ' + val + '. Press to choose.');
    L.nudgeWrap.hidden = !shown;
    const manual = isManual(L);
    L.offEl.textContent = manual ? fmtOff(L.offset) : 'Auto';
    L.btn.auto.setAttribute('aria-pressed', manual ? 'false' : 'true');
    L.btn.auto.setAttribute('aria-label', manual ? 'Subtitle timing set by hand: ' + fmtOff(L.offset) + '. Press to go back to automatic.' : 'Subtitle timing is automatic' + (L.offset ? ' (' + fmtOff(L.offset) + ')' : ''));
    L.btn.auto.title = manual ? 'By hand. Press for automatic timing.' : 'Automatic timing' + (L.offset ? ': ' + fmtOff(L.offset) : '');
    const rate = L.v.playbackRate || 1;
    const spv = b.speed.querySelector('[data-speedval]'); if (spv) spv.textContent = rate + '×';
    b.speed.setAttribute('aria-label', 'Playback speed ' + rate + '×. Press to choose.');
    b.mute.innerHTML = L.v.muted ? ICON.mute : ICON.vol;
    b.mute.setAttribute('aria-pressed', L.v.muted ? 'true' : 'false');
    b.mute.setAttribute('aria-label', L.v.muted ? 'Unmute' : 'Mute');
    const fs = !!document.fullscreenElement;
    b.fs.setAttribute('aria-label', fs ? 'Leave full screen' : 'Full screen');
    L.bar.hidden = L.v.classList.contains('prepping');
    layout(L);
  }
  /* soft: shown while the controls are up, but does not bring them up or hold
     them (an Auto-sync running by itself in the background). */
  function setStatus(L, msg, ms, soft) {
    if (!L || L.dead) return;
    clearTimeout(L.statusTimer);
    L.statusEl.textContent = msg || '';
    L.statusSoft = !!(msg && soft);
    if (msg && !soft) wake(L, false);
    if (msg && ms) L.statusTimer = setTimeout(() => { if (L.statusEl.textContent === msg) { L.statusEl.textContent = ''; wake(L, false); } }, ms);
    layout(L);
  }

  /* Up for 3 s (4 s on a TV) after any input; held up while paused, while a
     popup is open, while the pointer is over the controls, while a message is
     showing and while the seek bar is being dragged or scrubbed. A popup left
     open for 20 s with no input closes, so the controls are never stuck up. */
  const idleMs = () => (document.body.classList.contains('gnw-tv') ? 4000 : 3000);
  function trickBusy() {
    try { const T = window.GnwTrick && window.GnwTrick._live(); return !!(T && (T.dragging || T.pending != null)); } catch { return false; }
  }
  function chromeHidden(L) { return L.bar.classList.contains('gsub-quiet'); }
  function showChrome(L) {
    if (!chromeHidden(L) && !L.stage.classList.contains('gsub-idle')) return;
    L.bar.classList.remove('gsub-quiet');
    L.stage.classList.remove('gsub-idle');
    layout(L);
  }
  function hideChrome(L) {
    closePopups(L, false, null, true);
    L.bar.classList.add('gsub-quiet');
    L.stage.classList.add('gsub-idle');
    layout(L);
  }
  function wake(L, focusIt) {
    if (!L || L.dead) return;
    L.lastInput = Date.now();
    showChrome(L);
    clearTimeout(L.quietTimer);
    const check = () => {
      if (L.dead) return;
      const idle = Date.now() - L.lastInput;
      if (openPopupName(L) && idle >= 20000) closePopups(L, false, null, true);
      const keep = L.v.paused || !!openPopupName(L) || L.overBar || (!!L.statusEl.textContent && !L.statusSoft) || trickBusy() || L.v.classList.contains('prepping');
      if (!keep && idle >= idleMs()) hideChrome(L);
      else L.quietTimer = setTimeout(check, 500);
    };
    L.quietTimer = setTimeout(check, 500);
    if (focusIt && !L.bar.contains(document.activeElement)) focusFirst(L);
  }
  function barButtons(L) { return Array.from(L.bar.querySelectorAll('.gsub-row .gsub-btn')).filter(b => !b.disabled && b.offsetParent !== null); }
  function focusFirst(L) {
    const bs = barButtons(L);
    const pref = (L.lastFocus && bs.includes(L.lastFocus)) ? L.lastFocus : (L.on && L.track ? L.btn.plus : L.btn.play);
    try { (pref && pref.offsetParent !== null ? pref : bs[0]).focus({ preventScroll: true }); } catch {}
  }

  /* The picture itself (not a control, not a popup). */
  function isPicture(L, t) {
    if (!t || !t.closest) return false;
    if (t.closest('.gsub-bar, .gsub-menu, .gtr-panel, .gun-card, .vp-skip, .vp-skip-toast, .vp-close, .vp-error')) return false;
    return t === L.v || t === L.stage || (L.layer && L.layer.contains(t));
  }
  function onOutside(L, e) {
    if (L.dead) return;
    L.downType = e.pointerType || 'mouse';
    L.downHidden = chromeHidden(L);
    const els = popupEls(L);
    if (!els.length) { if (L.stage.contains(e.target)) wake(L, false); return; }
    const t = e.target;
    if (els.some(el => el.contains(t))) { wake(L, false); return; }
    // Its own button toggles it: that click does the closing.
    const anchors = [L.menu && !L.menu.hidden ? L.menuAnchor : null];
    for (const p of _popups.values()) { try { if (p.isOpen() && p.anchor) anchors.push(p.anchor()); } catch {} }
    if (anchors.some(x => x && x.contains(t))) return;
    closePopups(L, false);
    wake(L, false);
    if (isPicture(L, t)) L.swallowClick = Date.now();   // this press only closed the popup
  }
  function onPictureClick(L, e) {
    if (L.dead || !isPicture(L, e.target) || L.v.classList.contains('prepping')) return;
    if (L.swallowClick && Date.now() - L.swallowClick < 800) { L.swallowClick = 0; return; }
    if (L.downType === 'touch' || L.downType === 'pen') {
      // A tap shows the controls; a tap while they are up hides them again.
      if (!L.downHidden && !L.v.paused) hideChrome(L); else wake(L, false);
      return;
    }
    if (e.detail > 1) { clearTimeout(L.clickTimer); return; }   // the second click of a double-click
    clearTimeout(L.clickTimer);
    L.clickTimer = setTimeout(() => { if (!L.dead) { togglePlay(L); wake(L, false); } }, 250);
  }
  function closeTopPopup(L) {
    if (L.menu && !L.menu.hidden) { closeMenu(L, true); return; }
    for (const p of _popups.values()) { try { if (p.isOpen()) { p.close(true); return; } } catch {} }
  }

  /* Remote / keyboard.
     - Back (Escape, Backspace, GoBack, BrowserBack, a TV's Back code) with a
       popup open closes that popup only; the player stays.
     - Any key brings the controls back. With them hidden, an arrow or OK that
       would have gone to a control only shows them (no invisible presses).
     - Along the button row: Left/Right move, Up goes to the seek bar
       (embytrick.js takes it), Enter/OK presses. Keys aimed at something
       else (Skip Intro, Up Next, a form field) are left alone. */
  function onKey(L, e) {
    if (L.dead) return;
    const ov = document.getElementById('video-player-overlay');
    if (ov && !ov.classList.contains('open')) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (isBackKey(e) && openPopupName(L)) {
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat) closeTopPopup(L);
      wake(L, false);
      return;
    }
    const a = document.activeElement;
    if (L.menu && !L.menu.hidden && L.menu.contains(a)) { L.lastInput = Date.now(); return; }   // the menu handles its own
    const k = e.key;
    const arrow = k === 'ArrowDown' || k === 'ArrowUp' || k === 'ArrowLeft' || k === 'ArrowRight';
    const ok = k === 'Enter' || e.keyCode === 13 || k === ' ';
    const hidden = chromeHidden(L);
    const inBar = L.bar.contains(a);
    const inRow = inBar && !!a.closest('.gsub-row');
    // "Free" = focus is not on anything of the player's except the picture
    // itself (it may still sit on the grid tile behind the overlay).
    const free = !a || a === document.body || a === L.v || a === ov || !(ov && ov.contains(a));
    const skipUp = !!L.stage.querySelector('.vp-skip:not([hidden])');   // Enter belongs to Skip Intro then
    if (hidden && inBar && (arrow || ok)) { e.preventDefault(); e.stopPropagation(); wake(L, false); return; }
    if (inRow) {
      if (k === 'ArrowLeft' || k === 'ArrowRight') {
        e.preventDefault(); e.stopPropagation();
        const bs = barButtons(L), i = bs.indexOf(a);
        const n = bs[Math.max(0, Math.min(bs.length - 1, i + (k === 'ArrowRight' ? 1 : -1)))];
        if (n) { n.focus({ preventScroll: true }); L.lastFocus = n; }
        wake(L, false);
        return;
      }
      if (k === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation();
        L.lastFocus = a;
        try { L.v.focus({ preventScroll: true }); } catch {}
        wake(L, false);
        return;
      }
      if (k === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); wake(L, false); return; }
      wake(L, false);
      return;
    }
    if (inBar) { wake(L, false); return; }   // the seek bar handles its own keys
    if (free && (arrow || ((k === 'Enter' || e.keyCode === 13) && !skipUp && hidden))) {
      e.preventDefault(); e.stopPropagation();
      wake(L, true);
      return;
    }
    wake(L, false);
  }

  /* ---------------------------------------------------------------- menu */

  function menuItem(label, opts = {}) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gsub-item';
    b.setAttribute('role', opts.checkable ? 'menuitemradio' : 'menuitem');
    if (opts.checkable) b.setAttribute('aria-checked', opts.checked ? 'true' : 'false');
    if (opts.disabled) b.setAttribute('aria-disabled', 'true');
    b.innerHTML = opts.html || `<span>${escHtml(label)}</span>${opts.note ? `<span class="gsub-note">${escHtml(opts.note)}</span>` : ''}`;
    if (opts.onPress) b.addEventListener('click', e => { e.stopPropagation(); if (!opts.disabled) opts.onPress(); });
    return b;
  }
  function ensureMenu(L) {
    if (L.menu) return L.menu;
    const m = document.createElement('div');
    m.className = 'gsub-menu';
    m.setAttribute('role', 'menu');
    m.hidden = true;
    L.stage.appendChild(m);
    L.menu = m;
    m.addEventListener('keydown', e => {
      const items = Array.from(m.querySelectorAll('.gsub-item, .gsub-menu-focusable')).filter(x => x.offsetParent !== null);
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation();
        const n = items[Math.max(0, Math.min(items.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
        if (n) n.focus({ preventScroll: false });
      } else if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack' || e.key === 'BrowserBack') {
        e.preventDefault(); e.stopPropagation();
        closeMenu(L, true);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault(); e.stopPropagation();   // stay in the menu; nothing sideways here
      }
      L.lastInput = Date.now();
    });
    m.addEventListener('click', e => e.stopPropagation());
    m.addEventListener('dblclick', e => e.stopPropagation());
    // Re-placed whenever its contents change size (Find subtitles results arriving).
    if (window.ResizeObserver) { L.menuRo = new ResizeObserver(() => { if (!m.hidden) placePopup(L.stage, m, L.menuAnchor); }); L.menuRo.observe(m); }
    return m;
  }
  function toggleMenu(L, kind) {
    if (L.menu && !L.menu.hidden && L.menuKind === kind) { closeMenu(L, true); return; }
    openMenu(L, kind === 'speed' ? 'speed' : undefined);
  }
  /* view: undefined (the Subtitles menu), 'find', or 'speed'. */
  function openMenu(L, view) {
    if (L.item.cwPlain && view !== 'speed') return;
    closePopups(L, false, 'menu');
    const m = ensureMenu(L);
    m.innerHTML = '';
    m.hidden = false;
    const kind = view === 'speed' ? 'speed' : 'subs';
    const anchor = kind === 'speed' ? L.btn.speed : L.btn.pick;
    if (L.menuAnchor && L.menuAnchor !== anchor) L.menuAnchor.setAttribute('aria-expanded', 'false');
    L.menuKind = kind;
    L.menuAnchor = anchor;
    anchor.setAttribute('aria-expanded', 'true');
    m.setAttribute('aria-label', kind === 'speed' ? 'Playback speed' : 'Subtitles');
    wake(L, false);
    if (view === 'find' && window.GnwSubs.renderFind) { window.GnwSubs.renderFind(L, m); placePopup(L.stage, m, anchor); return; }
    if (view === 'info') { renderInfo(L, m); placePopup(L.stage, m, anchor); return; }
    if (kind === 'speed') {
      const head = document.createElement('h3'); head.textContent = 'Speed'; m.appendChild(head);
      const cur = L.v.playbackRate || 1;
      for (const r of SPEEDS) {
        const it = menuItem(r === 1 ? '1× (normal)' : r + '×', { checkable: true, checked: Math.abs(cur - r) < 1e-6,
          onPress: () => { setSpeed(L, r); closeMenu(L, true); } });
        it.dataset.speed = String(r);
        m.appendChild(it);
      }
      placePopup(L.stage, m, anchor);
      focusMenu(L);
      return;
    }
    const head = document.createElement('h3'); head.textContent = 'Subtitles'; m.appendChild(head);
    const shownTrack = L.on ? L.track : null;
    m.appendChild(menuItem('Off', { checkable: true, checked: !shownTrack, onPress: () => { closeMenu(L, true); selectTrack(L, null); } }));
    for (const st of subStreams(L.src)) {
      const text = isTextStream(st);
      const failed = L.failed && L.failed[streamKey(st)];
      const qq = quality(L, st), no = refused(qq);
      const mi = menuItem(trackLabel(st), {
        checkable: true, checked: shownTrack === st, disabled: (!text && !_pictureHandler) || isCaption(st),
        note: failed ? 'didn’t load last time' : no ? (qq.incomplete ? 'incomplete' : 'forced lines only') + ', not played' : trackNote(st, !!_pictureHandler),
        onPress: () => {
          if (no) { closeMenu(L, true); L.notice = { text: refuseText(L, st, qq), until: Date.now() + 5000 }; L.shownKey = '-'; setStatus(L, refuseText(L, st, qq), 6000); return; }
          closeMenu(L, true); selectTrack(L, st);
        },
      });
      if (no) { mi.setAttribute('aria-disabled', 'true'); mi.dataset.refused = '1'; }
      m.appendChild(mi);
    }
    const hr = document.createElement('div'); hr.className = 'gsub-hr'; m.appendChild(hr);
    m.appendChild(menuItem('Find subtitles…', { note: 'search your server’s providers', onPress: () => openMenu(L, 'find') }));
    const info = menuItem('Subtitle info', { note: 'what loaded, and what is on screen', onPress: () => openMenu(L, 'info') });
    info.dataset.info = '1';
    m.appendChild(info);
    placePopup(L.stage, m, anchor);
    focusMenu(L);
  }
  function focusMenu(L) {
    const m = L.menu; if (!m) return;
    const first = m.querySelector('.gsub-item[aria-checked="true"]') || m.querySelector('.gsub-item, .gsub-menu-focusable');
    if (first) try { first.focus({ preventScroll: true }); } catch {}
  }
  /* SUBTITLE INFO (player fixes, 2026-10-04). A media server is the one
     place the subtitles fail, so the player says what it did there: the
     track and how it is delivered, the play method, every URL tried (token
     hidden) with status, type, size and cues parsed, the first cue, what is
     due now, and whether the overlay is attached, visible and inside the full
     screen. Live while open (1 s); Copy puts the same text on the clipboard. */
  const fmtT = t => { if (!isFinite(t)) return '?'; const a = Math.abs(t), h = Math.floor(a / 3600), mi = Math.floor(a / 60) % 60, se = (a % 60).toFixed(2).padStart(5, '0');
    return (t < 0 ? '-' : '') + (h ? h + ':' + String(mi).padStart(2, '0') : mi) + ':' + se; };
  const plain = h => String(h || '').replace(/<br>/g, ' / ').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const PATH_NAME = { direct: 'direct play (the file plays as it is)', remux: 'remux (repackaged on this device)',
    server: 'server stream (chosen audio track)', transcode: 'server conversion (HLS)' };
  function diagnose(L) {
    const v = L.v, st = (L.on && L.track) || L.lastTrack || null, out = [];
    const line = (k, val, bad) => out.push({ k, v: String(val), bad: !!bad });
    line('Player', BUILD + (document.body.classList.contains('gnw-tv') ? ', TV mode' : ', desktop mode'));
    line('Title', (L.item.Name || '?') + '  (item ' + L.item.Id + ', source ' + (L.src && L.src.Id) + ', ' + ((L.src && L.src.Container) || '?') + ')');
    { const b = api() ? api().base() : '?'; const via = b.indexOf('/emby-proxy/') >= 0;
      line('Server base', redact(b) + (via ? '  (through this site’s /emby-proxy/, same origin)' : '  (direct, ' + (new URL(b, location.href).origin === location.origin ? 'same origin' : 'cross-origin, needs CORS') + ')') + '; page ' + location.protocol.replace(':', ''),
        location.protocol === 'https:' && /^http:/i.test(b)); }
    line('Play method', (PATH_NAME[L.path] || L.path) + (/^blob:/.test(v.currentSrc || '') ? ', MSE' : ''));
    if (v.currentSrc && !/^blob:/.test(v.currentSrc)) line('Video URL', redact(v.currentSrc).slice(0, 160));
    line('Clock', 'video ' + fmtT(v.currentTime) + (L.timeShift ? ', shift ' + L.timeShift + ' s' : '') + ', rate ' + v.playbackRate + (v.paused ? ', paused' : ''));
    if (!st) {
      line('Track', 'none chosen' + (subStreams(L.src).length ? '' : ' (this file lists no subtitle streams)'), true);
    } else {
      const delivery = L.burnedIndex === st.Index ? 'burned into the picture by the server' : st.IsExternal ? 'external file beside the video' : 'embedded in the video file';
      line('Track', trackLabel(st) + '  (stream Index ' + st.Index + ', codec ' + (st.Codec || '?') + ', IsForced ' + !!st.IsForced + (st.IsHearingImpaired ? ', SDH' : '') + ')');
      line('File', (st.Path ? String(st.Path).split(/[\\/]/).pop() : '(inside the video file)') + (st.DisplayTitle ? '  -- server calls it "' + st.DisplayTitle + '"' : ''));
      line('Delivery', delivery + (isTextStream(st) ? ', text' : ', picture') + (st.DeliveryMethod ? ', server says ' + st.DeliveryMethod : ''));
      if (st.DeliveryUrl) line('DeliveryUrl', redact(st.DeliveryUrl));
      const d = _diag.get(cueKey(L.item, L.src, st));
      if (!d) line('Fetch', L.burnedIndex === st.Index ? 'not needed (burned in)' : isTextStream(st) ? 'not started' : 'not possible (picture track)', !isTextStream(st) && L.burnedIndex !== st.Index);
      else {
        line('Fetch', d.ok ? 'loaded in ' + ((d.finished - d.started) / 1000).toFixed(1) + ' s' : d.finished ? 'FAILED' : 'still loading (' + Math.round((Date.now() - d.started) / 1000) + ' s)', d.finished && !d.ok);
        d.attempts.forEach((a, i) => line('  try ' + (i + 1), (a.status != null ? 'HTTP ' + a.status : a.note || '...') + (a.type ? '  ' + a.type : '') +
          (a.bytes != null ? '  ' + a.bytes + ' B' : '') + (a.cues != null ? '  ' + a.cues + ' cues' : '') + (a.note && a.status != null ? '  ' + a.note : '') +
          (a.head ? '  starts "' + a.head.replace(/\s+/g, ' ').slice(0, 50) + '"' : '') + '\n         ' + a.url, a.status != null && (a.status >= 400 || a.cues === 0)));
      }
    }
    line('Showing', L.on ? 'on' : 'off', !L.on && !!st);
    line('Cues', L.cues.length + (L.cues.length ? ', first ' + fmtT(L.cues[0].start) + ' "' + plain(L.cues[0].html).slice(0, 60) + '", last ends ' + fmtT(L.cues[L.cues.length - 1].end) : ''), !!(L.on && st && !L.cues.length));
    { const q0 = st ? quality(L, st) : null; if (q0 && q0.ads) line('Adverts', q0.ads + ' advert line' + (q0.ads === 1 ? '' : 's') + ' hidden'); if (q0 && qualityNote(q0)) line('Note', qualitySentence(L, st, q0)); }
    if (L.lastSync) { const r = L.lastSync; const ap = r.applied != null ? r.applied : r.offset;
      // 2026-10-10: the simple model -- what is applied now, how sure each part is, and what it is still listening for
      const spd = r.scale != null && Math.abs(r.scale - 1) > 1e-6 ? ', speed x' + (+r.scale).toFixed(4) : ', speed x1';
      const still = r.need && r.need.length ? '; still listening for: ' + r.need.map(x => ({ more: 'more evidence', speed: 'a clearer speed', gap: 'where a segment changes', stray: 'a part that fits no offset yet', cover: 'parts of the film with no match yet' })[x] || x).join(', ') : r.ok ? '; settled' : '';
      line('Last sync', (r.ok ? (r.inSync && r.applied == null ? 'in sync already, no change needed (' + (ap >= 0 ? '+' : '') + ap + ' s)' : 'applied ' + (ap >= 0 ? '+' : '') + ap + ' s') + (r.applied != null ? ' (speech match ' + (r.offset >= 0 ? '+' : '') + r.offset + ' s, clock-corrected)' : '') + spd + (r.sections ? ', ' + r.sections.length + ' segments' : '') + still
          : 'nothing applied yet: ' + (r.reason || r.error || '?') + (r.failed && r.failed.length ? ' -- ' + r.failed.join('; ') : '')) + (r.track != null ? ' (track Index ' + r.track + ')' : '') +
        (r.method ? ', ' + r.method : '') + (r.heard != null ? ', heard ' + r.heard + ' s' + (r.regions != null ? ' in ' + r.regions + ' stretches, ' + r.matched + ' matched' : '') : '') + (r.at ? ', at ' + new Date(r.at).toLocaleTimeString() : ''), !r.ok);
      if (r.scales) line('Speeds', r.scales.map(x => 'x' + (+x.scale).toFixed(4) + ' ' + x.score + (x.segs > 1 ? ' (' + x.segs + ' segs)' : '')).join(', ') + (r.scaleClear === false ? '  -- ' + (r.failed || []).join('; ') : ''));
      if (r.history && r.history.length) line('Updates', r.history.map(h => (h.windows ? h.windows + ' win' : Math.round(h.heard) + ' s') + ': ' + (h.offset >= 0 ? '+' : '') + h.offset + ' s' + (Math.abs(h.scale - 1) > 1e-6 ? ' x' + (+h.scale).toFixed(4) : '') + (h.sections > 1 ? ' ' + h.sections + ' segs' : '')).join(' > ')); }
    else if (L.sync && L.sync.running) line('Last sync', 'matching now…');
    else if (st && L.on && (st.IsForced || L.cues.length < 20)) line('Last sync', 'not run: ' + (st.IsForced ? 'forced tracks are not auto-synced' : 'under 20 lines'));
    else if (L.rec && L.rec.autoO != null) line('Last sync', 'saved earlier: ' + fmtOff(+L.rec.autoO) + (L.rec.clk ? ' (clock-corrected by ' + (-L.rec.clk >= 0 ? '+' : '') + (-L.rec.clk).toFixed(2) + ' s)' : '') + (L.rec.autoAt ? ', ' + new Date(L.rec.autoAt).toLocaleString() : '') + '; Re-sync to match again');
    { const c = L.clockCheck || (L.lastSync && L.lastSync.clock), MIN = (window.GnwSubSync && window.GnwSubSync.CLOCK_MIN) || 0.4;
      if (c) line('Clock check', c.state === 'listening' || c.state === 'comparing'
        ? 'listening to the player to confirm the server soundtrack lines up: ' + Math.round(c.heard || 0) + ' s heard (first look at 40 s; only counts at normal speed)' + (c.last ? '; last look: ' + (c.last.reason || '') + ', z ' + c.last.peakZ : '')
        : c.ok ? (Math.abs(c.lag) < MIN ? 'the server soundtrack lines up with the player (lag ' + (c.lag >= 0 ? '+' : '') + c.lag.toFixed(2) + ' s, z ' + c.peakZ + '): nothing to correct'
          : 'the server soundtrack runs ' + Math.abs(c.lag).toFixed(2) + ' s ' + (c.lag < 0 ? 'early' : 'late') + ' against the player (an audio start delay in the file?), z ' + c.peakZ + ': corrected')
        : c.reason === 'stopped' ? 'stopped before it finished (the track changed or the player closed); it runs again with the next match'
        : 'couldn’t confirm: ' + (c.reason || '?') + (c.heard != null ? ' (' + c.heard + ' s heard)' : ''), !!(c.ok === false && c.state !== 'listening' && c.reason !== 'stopped'));
      if (c && c.track) line('Clock track', 'checked again every 2 min of playback: ' + c.track.checks + ' checks' + (c.track.history.length ? ', lags ' + c.track.history.map(h => fmtT(h.at).replace(/\.\d+$/, '') + ' ' + (h.lag == null ? '?' : (h.lag >= 0 ? '+' : '') + h.lag.toFixed(2))).join(', ') : '') + '; applied ' + (c.track.applied >= 0 ? '+' : '') + (+c.track.applied).toFixed(2) + ' s'); }
    // Where the soundtrack for auto-sync came from, every source tried, and why one failed.
    if (L.soundSources && L.soundSources.length) line('Soundtrack', L.soundSources.map(x => x.name + ': ' + (x.ok ? 'used' : x.ok === false ? 'failed -- ' + x.error : 'reading…') +
      (x.codec ? ' [' + x.codec + (x.channels ? ' ' + x.channels + ' ch' : '') + (x.rate ? ' ' + x.rate + ' Hz' : '') + (x.fileStart ? ', file starts at ' + x.fileStart + ' s' : '') + ']' : '') + (x.net ? ' {' + (x.net.stored && !x.net.bytes ? 'already read on this device, nothing fetched' : Math.round(x.net.bytes / 1e6) + ' MB' + (x.net.size ? ' of ' + Math.round(x.net.size / 1e6) + ' MB' : '') + ' in ' + x.net.requests + ' requests') + (x.net.windows ? ', ' + x.net.windows + ' windows' + (x.net.refined ? ' (' + x.net.refined + ' around a cut)' : '') : '') + (x.net.waitedMs ? ', waited ' + Math.round(x.net.waitedMs / 1000) + ' s for playback' : '') + '}' : '') + (x.tried && x.ok !== false ? ' [' + x.tried.join('; ') + ']' : '') + (x.ms != null ? ' (' + (x.ms / 1000).toFixed(1) + ' s)' : '')).join(' | '),
      L.soundSources.every(x => x.ok === false));
    if (L.fitCheck) line('Fit check', L.fitCheck.track + ': ' + L.fitCheck.result + (L.fitCheck.tried.length ? '. Tried: ' + L.fitCheck.tried.join('; ') : '') + (L.fitCheck.search ? '. Search: ' + L.fitCheck.search : ''), /don’t match/.test(L.fitCheck.result) && !/switched|downloaded/.test(L.fitCheck.result));
    if (L.fixedBy) line('Replaced', 'the broken track by downloading "' + L.fixedBy + '"');
    if (L.fixFailed) line('Replace', 'tried, failed: ' + L.fixFailed, true);
    { const r = L.lastSync, MIN = (window.GnwSubSync && window.GnwSubSync.CLOCK_MIN) || 0.4;
      const R0 = Object.assign({}, L.rec || {}, L.pendingMeta || {});   // the record as it will be saved
      const mine = r && r.ok && st && r.track === st.Index && (r.applied != null ? r.applied : r.offset) === (R0.autoO != null ? +R0.autoO : NaN);   // this track's result, and still the one in force
      const src = mine ? r : (R0.autoO != null ? { scale: +R0.autoS || 1, offset: +R0.autoO, sections: (R0.autoSec || null) && R0.autoSec.map(x => ({ from: x[0], o: +R0.autoO + x[1] })), saved: true } : null);
      if (src) {
        const sc = +src.scale || 1, ppm = (sc - 1) * 3600;
        const KNOWN = [[25 / 23.976, '23.976→25 fps'], [23.976 / 25, '25→23.976 fps'], [24 / 23.976, '23.976→24 fps'], [23.976 / 24, '24→23.976 fps'], [25 / 24, '24→25 fps'], [24 / 25, '25→24 fps']];
        const kn = KNOWN.find(k => Math.abs(k[0] - sc) < 1e-6);
        const rate = Math.abs(sc - 1) < 1e-6 ? 'rate x1 (no drift)' : 'rate x' + sc.toFixed(5) + ' (' + (kn ? kn[1] : 'not a frame-rate ratio') + '; without it the subtitles would drift ' + Math.abs(ppm).toFixed(1) + ' s per hour)';
        const ap = mine && r.applied != null ? r.applied : src.offset;
        let txt = (src.sections && src.sections.length > 1)
          ? src.sections.length + ' sections (a different cut): ' + src.sections.map(x => 'from ' + fmtT(x.from).replace(/\.\d+$/, '') + ' ' + fmtOff(x.o + (ap - src.offset))).join(', ') + '; ' + rate
          : 'offset ' + fmtOff(ap) + ', ' + rate;
        if (src.saved) txt += ' (saved earlier)';
        line('Model', txt);
        if (mine && r.runs && r.runs.length) line('Runs', r.runs.map(g => fmtT(g.from).replace(/\.\d+$/, '') + ' ' + (g.seg < 0 ? 'no fit (z ' + g.z + ')' : (r.sections ? 'seg ' + (g.seg + 1) + ' ' : '') + (g.res >= 0 ? '+' : '') + g.res.toFixed(2) + ' s (z ' + g.z + ')')).join('; '));
        void MIN;
      }
    }
    { const R1 = Object.assign({}, L.rec || {}, L.pendingMeta || {}), u = userNudge(L);
      if (R1.purged) line('Old result', 'an automatic result saved by an older version (' + fmtOff(+R1.purged.o) + ', model ' + R1.purged.v + ') was taken off and matched again');
      line('Sync mode', 'automatic' + (R1.autoO != null ? ' (result ' + fmtOff(+R1.autoO) + (R1.autoFinal === false ? ', still improving' : '') + ')' : '') + (R1.manual ? (R1.u == null && R1.autoO == null ? '; set by hand earlier, kept as it is' : '; your nudge ' + (u >= 0 ? '+' : '−') + Math.abs(u).toFixed(1) + ' s on top') : '')); }
    line('Sync', fmtOff(L.offset) + (Math.abs(L.scale - 1) > 1e-6 ? ' x' + L.scale.toFixed(4) : ''));
    if (L.cues.length && L.adj) {
      const t = (v.currentTime || 0) - L.timeShift, now = activeAt(L, t);
      const nx = L.adj.st.findIndex(x => x > t);
      line('Due now', now.length ? now.map(i => '"' + plain(L.cues[i].html).slice(0, 50) + '"').join(' + ') : 'nothing (between lines)');
      if (now.length) { const pc = paintCheck(L); line('Painted?', pc.text, !pc.ok); }
      if (nx >= 0) line('Next line', 'at ' + fmtT(L.adj.st[nx]) + ' (in ' + (L.adj.st[nx] - t).toFixed(1) + ' s)');
      if (t > L.adj.en[L.adj.en.length - 1] + 1) line('Clock check', 'the video clock is past the last subtitle line', true);
      if (L.adj.st[0] > t + 600 && t > 60) line('Clock check', 'the first line is far ahead of the video clock: a clock offset?', true);
    }
    const cs = el => getComputedStyle(el);
    const attached = !!(L.layer && L.layer.isConnected && L.stage.contains(L.layer));
    let hiddenBy = '';
    for (let el = L.layer; el && el !== document.documentElement; el = el.parentElement) {
      const c = cs(el);
      if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0) { hiddenBy = (el.id ? '#' + el.id : '.' + String(el.className).split(' ')[0]) + ' (' + (c.display === 'none' ? 'display none' : c.visibility === 'hidden' ? 'visibility hidden' : 'opacity 0') + ')'; break; }
    }
    const lr = L.layer.getBoundingClientRect(), br = L.cueBox.getBoundingClientRect();
    line('Overlay', (attached ? 'attached' : 'NOT attached') + ', ' + (hiddenBy ? 'hidden by ' + hiddenBy : 'visible') + ', layer ' + Math.round(lr.width) + 'x' + Math.round(lr.height) + ', z-index ' + cs(L.layer).zIndex, !attached || !!hiddenBy || !lr.width || !lr.height);
    const line0 = L.cueBox.querySelector('.gsub-line');
    line('Text box', 'bottom ' + L.cueBox.style.bottom + ', width ' + Math.round(br.width) + (line0 ? ', font ' + cs(line0).fontSize + ' ' + cs(line0).color : ', nothing drawn right now'));
    const fe = document.fullscreenElement;
    if (L.testResult) line('Test line', L.testResult.text, !L.testResult.ok);
    line('Window', innerWidth + 'x' + innerHeight + ' (screen ' + screen.width + 'x' + screen.height + ', zoom ' + (devicePixelRatio || 1) + ')');
    line('Full screen', fe ? (fe.tagName.toLowerCase() + (fe.id ? '#' + fe.id : '') + (fe.contains(L.layer) ? ', overlay inside it (drawn)' : ', overlay OUTSIDE it (not drawn)')) : 'no', !!(fe && !fe.contains(L.layer)));
    const s = loadSettings();
    line('Settings', 'mode ' + s.mode + ', languages ' + s.langs.join('/') + ', size ' + s.size + ', colour ' + s.color);
    // Every subtitle stream the server listed, with what each one loaded (once
    // fetched -- "Check every track" fetches them all). Two tracks that load the
    // same lines are flagged: the menu and the files do not match.
    const all = subStreams(L.src), seen = [];
    line('All tracks', all.length + ' listed by the server for source ' + (L.src && L.src.Id));
    for (const x of all) {
      const k = cueKey(L.item, L.src, x), stt = _stats.get(k), dd = _diag.get(k);
      const file = x.Path ? String(x.Path).split(/[\\/]/).pop() : 'embedded';
      let what = !isTextStream(x) ? 'picture track' : stt ? stt.n + ' cues, ' + fmtT(stt.first) + ' to ' + fmtT(stt.last) + ', ' + stt.bytes + ' B, first "' + stt.text + '"'
        : dd ? (dd.finished ? 'did not load' : 'loading...') : 'not loaded yet';
      let bad = false;
      if (stt) {
        const twin = seen.find(o => o.stt.n === stt.n && Math.abs(o.stt.first - stt.first) < 0.01 && Math.abs(o.stt.last - stt.last) < 0.01);
        // (a track already explained by a quality note -- forced lines only -- is not an error)
        if (twin && !(quality(L, x) && quality(L, x).sameAsForced)) { what += '  SAME LINES AS Index ' + twin.x.Index; bad = true; }
        seen.push({ x, stt });
      }
      const q = quality(L, x), qn = qualityNote(q);
      if (q && q.ads) what += ', ' + q.ads + ' advert line' + (q.ads === 1 ? '' : 's') + ' hidden';
      if (qn) what += '\n         Note: ' + qualitySentence(L, x, q);
      line('  Index ' + x.Index, trackLabel(x) + (x.IsForced ? ' [forced]' : '') + (x === st ? ' (chosen)' : '') + ', ' + file + ': ' + what, bad);
    }
    return out;
  }
  /* Did the line on screen really paint? Its box must be on screen and inside
     the stage, nothing may be on top of it (checked with elementFromPoint at
     its centre, the layer briefly made hit-testable), and its colour, opacity
     (through every ancestor), visibility and size must let it show. */
  function paintCheck(L) {
    const el = L.cueBox.querySelector('.gsub-line, .gsub-notice');
    if (!el) return { ok: false, text: 'nothing in the text box right now' };
    const r = el.getBoundingClientRect(), sr = L.stage.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const on = r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && cy >= sr.top && cy <= sr.bottom;
    const prev = [L.layer.style.pointerEvents, L.cueBox.style.pointerEvents];
    L.layer.style.pointerEvents = 'auto'; L.cueBox.style.pointerEvents = 'auto';
    let hit = null;
    try { hit = document.elementFromPoint(cx, cy); } catch {}
    L.layer.style.pointerEvents = prev[0]; L.cueBox.style.pointerEvents = prev[1];
    const onTop = !!(hit && (L.cueBox.contains(hit) || hit === L.cueBox));
    const c = getComputedStyle(el);
    let op = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) op *= +getComputedStyle(e).opacity;
    const hidden = c.visibility !== 'visible' || c.display === 'none' || op < 0.05 || parseFloat(c.fontSize) < 6;
    const ok = on && onTop && !hidden;
    const who = hit ? (hit.tagName.toLowerCase() + (hit.id ? '#' + hit.id : '') + (hit.className && typeof hit.className === 'string' ? '.' + hit.className.split(' ')[0] : '')) : 'nothing';
    return { ok, on, onTop, hit: who, color: c.color, opacity: +op.toFixed(2), visibility: c.visibility, fontSize: c.fontSize,
      rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
      text: (ok ? 'YES' : 'NO') + ': box ' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + (on ? ' on screen' : ' OFF SCREEN') +
        ', top element at its centre: ' + who + (onTop ? ' (the text itself)' : ' (COVERING IT)') + ', colour ' + c.color + ', opacity ' + op.toFixed(2) + ', ' + c.visibility + ', ' + c.fontSize };
  }
  function diagText(L) { return diagnose(L).map(r => (r.bad ? '! ' : '  ') + r.k.padEnd(12) + r.v).join('\n'); }
  function renderInfo(L, m) {
    m.innerHTML = '';
    const head = document.createElement('h3'); head.textContent = 'Subtitle info'; m.appendChild(head);
    m.appendChild(menuItem('‹ Back', { onPress: () => openMenu(L) }));
    const copy = menuItem('Copy this text', { note: 'to paste into a message', onPress: () => {
      const t = diagText(L);
      const done = ok => { const sp = copy.querySelector('.gsub-note'); if (sp) sp.textContent = ok ? 'copied' : 'couldn’t copy: select it instead'; };
      try { navigator.clipboard.writeText(t).then(() => done(true), () => done(false)); } catch { done(false); }
    } });
    m.appendChild(copy);
    m.appendChild(menuItem('Show a test line', { note: '5 seconds, then says whether it painted', onPress: () => {
      L.testLine = { until: Date.now() + 5000 };
      L.shownKey = '-'; render(L);
      setTimeout(() => { if (!L.dead) { const pc = paintCheck(L); L.testResult = pc; console.info('[subs] test line: ' + pc.text); } }, 300);
    } }));
    const rs = menuItem('Re-sync this track', { note: 'match the timing to the speech again', onPress: () => {
      const why = resync(L);
      const sp = rs.querySelector('.gsub-note'); if (sp) sp.textContent = why === 'started' ? 'matching… (see Last sync below)' : why;
    } });
    m.appendChild(rs);
    m.appendChild(menuItem('Check every track', { note: 'load each one and compare', onPress: () => {
      for (const x of subStreams(L.src).filter(isTextStream)) fetchCues(L.item, L.src, x).catch(() => {});
    } }));
    const pre = document.createElement('div');
    pre.className = 'gsub-info gsub-menu-focusable';
    pre.tabIndex = 0;
    pre.setAttribute('role', 'document');
    m.appendChild(pre);
    const paint = () => {
      if (L.dead || m.hidden || !pre.isConnected) { clearInterval(L.infoTimer); return; }
      pre.innerHTML = diagnose(L).map(r => '<span' + (r.bad ? ' class="bad"' : '') + '>' + (r.bad ? '! ' : '') + '<b>' + escHtml(r.k.trim()) + '</b>  ' + escHtml(r.v) + '</span>').join('\n');
      L.lastInput = Date.now();   // reading it is using it: the controls stay up
    };
    clearInterval(L.infoTimer);
    paint();
    L.infoTimer = setInterval(paint, 1000);
    try { console.info('[subs] Subtitle info\n' + diagText(L)); } catch {}
    focusMenu(L);
  }
  function closeMenu(L, refocus, quiet) {
    clearInterval(L.infoTimer);
    if (!L.menu || L.menu.hidden) return;
    L.menu.hidden = true;
    L.menu.innerHTML = '';
    L.findTicket = null;
    const a = L.menuAnchor || L.btn.pick;
    try { a.setAttribute('aria-expanded', 'false'); } catch {}
    if (refocus && !L.dead) { try { a.focus({ preventScroll: true }); } catch {} }
    if (!quiet) wake(L, false);
  }

  /* ------------------------------------------------------------ settings */

  function settingsHTML() {
    ensureStyles();
    const s = loadSettings();
    const lbl = 'display:block; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--muted); margin-bottom:6px;';
    const seg = (name, opts, cur) => `<div class="gsub-seg" role="radiogroup" data-seg="${name}">${opts.map(o =>
      `<button type="button" role="radio" data-v="${o[0]}" aria-checked="${o[0] === cur}">${o[1]}</button>`).join('')}</div>`;
    const sel = (id, opts, cur) => `<select id="${id}">${opts.map(o => `<option value="${o[0]}" ${o[0] === cur ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`;
    const langOpts = (cur, allowNone) => (allowNone ? [['', 'None']] : []).concat(LANGS);
    const sw = (id, on) => `<label class="aw-switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span class="aw-slider"></span></label>`;
    return `
      <section class="vault-section" id="gsub-settings" style="margin-top:22px;">
        <label style="${lbl}">Subtitles</label>
        <p style="color:var(--muted); font-size:12.5px; margin:0 0 14px; line-height:1.55;">
          Drawn by this site, so they keep time at any playback speed. Sync buttons sit on the player’s
          own control bar whenever subtitles are on, and each file remembers its own sync. Saved only in this browser.
        </p>
        <div class="aw-card">
          <div class="aw-name" style="margin-bottom:9px;">Show subtitles</div>
          ${seg('mode', [['always', 'Always on'], ['foreign', 'Only when the audio is a foreign language'], ['off', 'Off']], s.mode)}
          <div class="gsub-set-grid">
            <div><label class="gsub-l" for="gsub-lang0">First language</label>${sel('gsub-lang0', langOpts(s.langs[0], false), s.langs[0] || 'eng')}</div>
            <div><label class="gsub-l" for="gsub-lang1">Second language</label>${sel('gsub-lang1', langOpts(s.langs[1], true), s.langs[1] || '')}</div>
            <div><label class="gsub-l" for="gsub-lang2">Third language</label>${sel('gsub-lang2', langOpts(s.langs[2], true), s.langs[2] || '')}</div>
          </div>
        </div>
        <div class="aw-card" style="margin-top:12px;">
          <div class="aw-name">Style</div>
          <div class="gsub-set-grid">
            <div><label class="gsub-l" for="gsub-size">Text size</label>${sel('gsub-size', SIZES.map(x => [x.id, x.label]), s.size)}</div>
            <div><label class="gsub-l" for="gsub-font">Font</label>${sel('gsub-font', FONTS.map(x => [x.id, x.label]), s.font)}</div>
            <div><label class="gsub-l" for="gsub-edge">Edge</label>${sel('gsub-edge', EDGES.map(x => [x.id, x.label]), s.edge)}</div>
            <div><label class="gsub-l">Colour</label><div class="gsub-seg" role="radiogroup" data-seg="color">${COLOURS.map(c =>
              `<button type="button" class="gsub-swatch" role="radio" data-v="${c.id}" aria-checked="${c.id === s.color}" aria-label="${c.label}" style="background:${c.id}"></button>`).join('')}</div></div>
            <div><label class="gsub-l" for="gsub-pos">Height above the bottom</label><input type="range" id="gsub-pos" min="0" max="30" step="1" value="${s.position}"></div>
            <div><label class="gsub-l" for="gsub-boxop">Background box</label>
              <div style="display:flex; align-items:center; gap:10px;">${sw('gsub-box', s.box)}<input type="range" id="gsub-boxop" min="0.2" max="1" step="0.05" value="${s.boxOpacity}" aria-label="Box opacity"></div></div>
          </div>
          <div class="gsub-preview" id="gsub-preview" aria-label="Preview"><div class="gsub-layer"><div class="gsub-cues"><div class="gsub-cue"><span class="gsub-line">The keeper climbed the stairs<br>with a lantern in one hand.</span></div></div></div></div>
        </div>
        <div class="aw-card" style="margin-top:12px;">
          <div class="aw-head"><span class="aw-name">Find subtitles automatically</span>${sw('gsub-autofetch', s.autoFetch)}</div>
          <p style="margin:9px 0 0; font-size:11.5px; color:var(--muted); line-height:1.5;">
            When a file has none in your languages, ask your server’s subtitle providers and use the best match.
            Off by default: each search uses your provider’s daily download allowance, and a download is saved
            next to the file on the server for everyone. With it off, Subtitles ▸ Find subtitles… does the same on request.
          </p>
        </div>
        <div class="aw-card" style="margin-top:12px;">
          <div class="aw-head"><span class="aw-name">Replace broken subtitles automatically</span>${sw('gsub-fixbroken', s.fixBroken)}</div>
          <p style="margin:9px 0 0; font-size:11.5px; color:var(--muted); line-height:1.5;">
            On by default. When subtitles are on and the only track in your language is incomplete, your server’s
            providers are asked and the best complete match (this file’s own first, then the most downloaded) is
            downloaded and used. Every track is lined up with the speech by itself; − / + on the player take over by hand.
          </p>
        </div>
      </section>`;
  }
  function wireSettings(mount) {
    ensureStyles();
    const root = mount.querySelector('#gsub-settings'); if (!root) return;
    const $ = id => root.querySelector('#' + id);
    const preview = () => {
      const pv = $('gsub-preview'); if (!pv) return;
      const s = loadSettings();
      const layer = pv.querySelector('.gsub-layer');
      styleInto(layer, s, pv.clientHeight || 300);
      const cues = layer.querySelector('.gsub-cues');
      cues.style.left = '0'; cues.style.width = '100%';
      cues.style.bottom = ((pv.clientHeight || 300) * (s.position / 100)) + 'px';
    };
    root.querySelectorAll('[data-seg]').forEach(g => {
      g.addEventListener('click', e => {
        const b = e.target.closest('button[data-v]'); if (!b) return;
        g.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', x === b ? 'true' : 'false'));
        saveSettings({ [g.dataset.seg]: b.dataset.v });
        preview();
      });
      // Arrow keys inside a radio group move the choice, like native radios.
      g.addEventListener('keydown', e => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const bs = Array.from(g.querySelectorAll('button')), i = bs.indexOf(document.activeElement);
        if (i < 0) return;
        e.preventDefault();
        const n = bs[Math.max(0, Math.min(bs.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))];
        n.focus(); n.click();
      });
    });
    const langs = () => [0, 1, 2].map(i => $('gsub-lang' + i).value).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
    for (const i of [0, 1, 2]) $('gsub-lang' + i).addEventListener('change', () => saveSettings({ langs: langs() }));
    $('gsub-size').addEventListener('change', e => { saveSettings({ size: e.target.value }); preview(); });
    $('gsub-font').addEventListener('change', e => { saveSettings({ font: e.target.value }); preview(); });
    $('gsub-edge').addEventListener('change', e => { saveSettings({ edge: e.target.value }); preview(); });
    $('gsub-pos').addEventListener('input', e => { saveSettings({ position: +e.target.value }); preview(); });
    $('gsub-box').addEventListener('change', e => { saveSettings({ box: e.target.checked }); preview(); });
    $('gsub-boxop').addEventListener('input', e => { saveSettings({ boxOpacity: +e.target.value }); preview(); });
    $('gsub-autofetch').addEventListener('change', e => saveSettings({ autoFetch: e.target.checked }));
    $('gsub-fixbroken').addEventListener('change', e => saveSettings({ fixBroken: e.target.checked }));
    preview();
    if (window.ResizeObserver) new ResizeObserver(preview).observe($('gsub-preview'));
  }

  /* ------------------------------------------- Part 2: find by fingerprint */
  /*
   * Emby's own remote subtitle search, through the signed-in session -- no
   * provider account details ever pass through this page:
   *   GET  /Items/{Id}/RemoteSearch/Subtitles/{Language}?MediaSourceId=...
   *        -> RemoteSubtitleInfo[] (Id, Name, ProviderName, Format, CommunityRating,
   *           DownloadCount, IsHashMatch, IsForced, IsHearingImpaired, ...)
   *   POST /Items/{Id}/RemoteSearch/Subtitles/{SubtitleId}?MediaSourceId=...
   *        -> { NewIndex }   (the file is saved next to the video by the server)
   * The server's providers do the matching. OpenSubtitles hashes the file's
   * content on the server, so a renamed file still matches: IsHashMatch.
   * Order shown: hash matches first, then rating, then downloads.
   */
  // (2026-10-04: "download the one that has the most"): hash matches, then
  // the most downloaded, then rating.
  function rankRemote(list) {
    return (Array.isArray(list) ? list : []).slice().sort((a, b) =>
      ((b.IsHashMatch ? 1 : 0) - (a.IsHashMatch ? 1 : 0)) ||
      ((+b.DownloadCount || 0) - (+a.DownloadCount || 0)) ||
      ((+b.CommunityRating || 0) - (+a.CommunityRating || 0)));
  }
  async function searchRemote(L, lang) {
    const a = api();
    const res = await a.get(`/Items/${encodeURIComponent(L.item.Id)}/RemoteSearch/Subtitles/${encodeURIComponent(lang)}`,
      { MediaSourceId: L.src && L.src.Id });
    return rankRemote(res);
  }
  function remoteError(e) {
    const st = e && e.status;
    if (st === 401 || st === 403) return 'Your media server account isn’t allowed to download subtitles. An administrator can allow it under the user’s Subtitles permission.';
    const jf = !!(api() && api().serverType && api().serverType() === 'jellyfin');
    if (st === 404) return 'Your media server has no subtitle search here (HTTP 404). ' + (jf ? 'In Jellyfin, install a subtitle provider plugin (such as OpenSubtitles) under Dashboard ▸ Plugins and set it up there.' : 'In Emby, install a subtitle provider plugin (such as OpenSubtitles) and set it up under Settings ▸ Subtitles.');
    if (st >= 500) return 'The subtitle provider on your server refused or failed (HTTP ' + st + '). This is often its login not being set, or its daily download limit being reached. ' + (jf ? 'Check Jellyfin ▸ Dashboard ▸ Plugins.' : 'Check Emby ▸ Settings ▸ Subtitles.');
    if (st === 0) return 'Couldn’t reach your media server to search for subtitles.';
    return 'The search didn’t work (' + ((e && e.message) || 'error') + ').';
  }
  /* Download one result into the item, re-read the item's streams and switch to it. */
  async function downloadRemote(L, r) {
    const a = api();
    const out = await a.post(`/Items/${encodeURIComponent(L.item.Id)}/RemoteSearch/Subtitles/${encodeURIComponent(r.Id)}`,
      { MediaSourceId: L.src && L.src.Id });
    const info = await a.getPlaybackInfo(L.item.Id);
    if (L.dead) return null;
    const srcs = (info && info.MediaSources) || [];
    const fresh = srcs.find(x => L.src && x.Id === L.src.Id) || srcs[0];
    if (fresh) L.src = fresh;
    const subs = subStreams(L.src);
    const lang = normLang(r.ThreeLetterISOLanguageName || r.Language);
    let st = (out && out.NewIndex != null) ? subs.find(x => x.Index === out.NewIndex) : null;
    if (!st) st = subs.filter(x => x.IsExternal && normLang(x.Language) === lang).pop() || null;
    return st;
  }
  function renderFind(L, m, langIdx = 0) {
    const s = loadSettings();
    const langs = s.langs.length ? s.langs : ['eng'];
    const lang = langs[Math.min(langIdx, langs.length - 1)];
    m.innerHTML = '';
    const head = document.createElement('h3'); head.textContent = 'Find subtitles'; m.appendChild(head);
    m.appendChild(menuItem('‹ Back', { onPress: () => openMenu(L) }));
    if (langs.length > 1) {
      for (let i = 0; i < langs.length; i++) {
        m.appendChild(menuItem(langLabel(langs[i]), { checkable: true, checked: i === langIdx, onPress: () => renderFind(L, m, i) }));
      }
    }
    const hr = document.createElement('div'); hr.className = 'gsub-hr'; m.appendChild(hr);
    const note = document.createElement('div');
    note.className = 'gsub-item'; note.setAttribute('aria-disabled', 'true'); note.setAttribute('role', 'status');
    note.textContent = 'Searching ' + langLabel(lang) + ' on your server’s subtitle providers…';
    m.appendChild(note);
    focusMenu(L);
    const ticket = L.findTicket = {};
    searchRemote(L, lang).then(list => {
      if (L.dead || L.findTicket !== ticket || m.hidden) return;
      note.remove();
      if (!list.length) {
        const n = document.createElement('div'); n.className = 'gsub-item'; n.setAttribute('aria-disabled', 'true'); n.setAttribute('role', 'status');
        n.textContent = 'Nothing found in ' + langLabel(lang) + '. Your server needs a subtitle provider (such as OpenSubtitles) set up in its dashboard.';
        m.appendChild(n);
        return;
      }
      for (const r of list.slice(0, 25)) {
        const meta = [r.ProviderName, r.Format && String(r.Format).toUpperCase(),
          r.CommunityRating ? '★ ' + (+r.CommunityRating).toFixed(1) : '',
          r.DownloadCount ? (+r.DownloadCount).toLocaleString('en-AU') + ' downloads' : ''].filter(Boolean).join(' · ');
        const badges = [r.IsHashMatch ? 'Matches this file' : '', r.IsForced ? 'Forced' : '', r.IsHearingImpaired ? 'SDH' : '']
          .filter(Boolean).map(b => `<span class="gsub-badge">${escHtml(b)}</span>`).join(' ');
        const it = menuItem('', {
          html: `<span class="gsub-main"><span>${escHtml(r.Name || r.Id)}</span><span>${escHtml(meta)}</span></span><span class="gsub-note">${badges}</span>`,
          onPress: async () => {
            if (it.getAttribute('aria-disabled') === 'true') return;
            const noteEl = it.querySelector('.gsub-note');
            const was = noteEl ? noteEl.innerHTML : '';
            if (noteEl) noteEl.innerHTML = '<span class="gsub-badge">Downloading…</span>';
            setStatus(L, 'Downloading “' + (r.Name || 'subtitles') + '” to your server…');
            it.setAttribute('aria-disabled', 'true');
            try {
              const st = await downloadRemote(L, r);
              if (L.dead) return;
              closeMenu(L, true);
              if (!st) { setStatus(L, 'Downloaded, but the server hasn’t listed it yet. Try again in a moment.', 7000); return; }
              setStatus(L, 'Added: ' + (r.Name || trackLabel(st)) + '. Checking it…');
              const res = await selectTrack(L, st, { download: true });
              if (L.dead) return;
              const nq = quality(L, st);
              if (res === 'refused' || refused(nq)) { offerBetter(L, st, true); }
              else {
                closeNoteCard(L);
                if (!(L.sync && L.sync.running)) setStatus(L, 'Added: ' + (r.Name || trackLabel(st)) + ' (' + (nq ? nq.n + ' lines, to ' + fmtHM(nq.last) : 'loaded') + ').', 7000);
              }
            } catch (e) {
              if (noteEl) noteEl.innerHTML = was;
              it.removeAttribute('aria-disabled');
              setStatus(L, remoteError(e), 9000);
            }
          },
        });
        it.dataset.remoteId = r.Id;
        m.appendChild(it);
      }
      const firstResult = m.querySelector('[data-remote-id]');
      if (firstResult) try { firstResult.focus({ preventScroll: true }); } catch {}
    }).catch(e => {
      if (L.dead || L.findTicket !== ticket) return;
      note.textContent = remoteError(e);
    });
  }
  /* Settings -> "Find subtitles automatically" (off by default). Once per file
     per browser session, the best result in the first preferred language. */
  async function autoFind(L) {
    const lang = loadSettings().langs[0] || 'eng';
    const k = 'gnw.subs.autofind:' + L.item.Id + ':' + lang;
    try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch {}
    setStatus(L, 'Looking for ' + langLabel(lang) + ' subtitles…');
    try {
      const list = await searchRemote(L, lang);
      if (L.dead) return;
      if (!list.length) { setStatus(L, 'No ' + langLabel(lang) + ' subtitles found for this file.', 6000); return; }
      const st = await downloadRemote(L, list[0]);
      if (L.dead || !st) return;
      setStatus(L, 'Found ' + langLabel(lang) + ' subtitles' + (list[0].IsHashMatch ? ' that match this file.' : '.'), 6000);
      await selectTrack(L, st, { auto: true });
    } catch (e) { if (!L.dead) setStatus(L, remoteError(e), 8000); }
  }

  /* ---------------------------------- the wrong subtitle file (2026-10-10) */
  /* WHEN THE SUBTITLES ARE FOR ANOTHER VIDEO (a real-file test on
     a real server: three Mayday episodes carried another episode's subtitles).
     Auto-sync says so (solve(): mismatch, after 15+ stretches heard with nothing
     fitting at any speed). Then, using only the soundtrack already heard:
       1. the other text files of the same language on this video are each scored
          against it; one that fits is switched to (and remembered for the video);
       2. if none fits, the player says plainly that these subtitles do not match;
       3. the server's subtitle search is asked, and each result's text is read
          WITHOUT saving it (GET /Providers/Subtitles/Subtitles/{Id}) and scored;
          only one that fits is downloaded and used. One that does not fit is
          never applied; when nothing fits, the viewer is told and Find
          subtitles... still lists what the server offers.
     Everything it tried is listed in Subtitle info (Fit check). */
  const fileName = st => { const p = String((st && st.Path) || '').split(/[\\/]/).pop(); return p || (st ? trackLabel(st) : ''); };
  const fitsLine = r => r && r.ok && r.fits ? 'fits' + (Math.abs(r.scale - 1) > 1e-6 ? ' at speed x' + (+r.scale).toFixed(4) : '') + (r.sections ? ', ' + r.sections.length + ' segments' : '') + ' (' + r.matched + ' of ' + r.regions + ' stretches)'
    : r && r.ok ? 'fits only loosely, not used (' + r.matched + ' of ' + r.regions + ' stretches' + (r.sections ? ', ' + r.sections.length + ' segments' : '') + ')'
    : 'doesn’t fit' + (r && r.regions != null ? ' (0 of ' + r.regions + ' stretches)' : r && r.reason ? ' (' + r.reason + ')' : '');
  async function previewRemote(r) {
    const a = api();
    const res = await fetch(a.base() + '/Providers/Subtitles/Subtitles/' + encodeURIComponent(r.Id), { headers: a.authHeaders ? a.authHeaders() : { 'X-Emby-Token': a.token() } });
    if (!res.ok) { const e = new Error('HTTP ' + res.status); e.status = res.status; throw e; }
    return res.text();
  }
  /* HELD BACK (2026-10-10): on real files the matcher scored 0 even
     for a file that is almost certainly right (S26E09), while the stand-ins pass. Until it is
     proven on real audio, a "mismatch" is only reported as "couldn't confirm the timing yet":
     the other files are scored for Subtitle info, but nothing is switched, searched or
     downloaded, and the player never says the subtitles don't match. Set true once proven. */
  const FIT_ACTIONS = true;   // turned on 2026-10-10: control S26E09 solved on the real file (diag v3, tag f)
  async function onMismatch(L, track, r, ck) {
    if (!L || L.dead || L.track !== track || !window.GnwSubSync || !window.GnwSubSync.scoreCues) return;
    if (L.fitBusy) return;
    L.fitBusy = true;
    const fc = L.fitCheck = { at: Date.now(), track: fileName(track), result: FIT_ACTIONS ? 'these subtitles don’t match this video' : 'couldn’t confirm the timing yet (nothing switched or downloaded while the matcher is checked on real audio)', tried: [] };
    const still = () => !L.dead && L.track === track;
    try {
      const lang = normLang(track.Language);
      // 1. the other files of this language on the video
      const others = subStreams(L.src).filter(st => st !== track && isTextStream(st) && !st.IsForced && normLang(st.Language) === lang);
      const scored = [];
      for (const st of others) {
        let cues;
        try { cues = await fetchCues(L.item, L.src, st); } catch (e) { fc.tried.push(fileName(st) + ': didn’t load'); continue; }
        if (!still()) return;
        if (!cues || cues.length < 20) { fc.tried.push(fileName(st) + ': too short'); continue; }
        const res = await window.GnwSubSync.scoreCues(ck, cues);
        if (!still()) return;
        fc.tried.push(fileName(st) + ': ' + fitsLine(res));
        scored.push({ st, res });
      }
      const best = scored.filter(x => x.res && x.res.ok && x.res.fits).sort((x, y) => (y.res.matched / y.res.regions) - (x.res.matched / x.res.regions))[0];
      if (!FIT_ACTIONS) { if (best) fc.result += '; ' + fileName(best.st) + ' would fit'; setStatus(L, 'Couldn’t confirm the subtitle timing yet. The −0.1 / +0.1 buttons still work.', 8000); return; }
      if (best) {
        fc.result = 'switched to ' + fileName(best.st) + ' (it fits the soundtrack)';
        setPick(L.item.Id, streamKey(best.st));
        await selectTrack(L, best.st, { auto: true });
        setStatus(L, 'Using subtitle file ' + fileName(best.st) + ' (fits the soundtrack).', 9000);
        return;
      }
      // 2. say it plainly
      setStatus(L, 'These subtitles don’t match this video (probably another episode or cut). Looking for ones that fit…', 12000);
      // 3. the server's search, each result scored before anything is saved
      // keyed by search kind and version: a new kind of search is never blocked by an older flag
      const once = 'gnw.subs.fitsearch.v3:server:' + L.item.Id + ':' + lang;
      let again = false;
      try { again = !!sessionStorage.getItem(once); if (!again) sessionStorage.setItem(once, '1'); } catch {}
      if (again) { fc.result += '; the server’s search was already tried this session'; setStatus(L, 'These subtitles don’t match this video (probably another episode or cut). Find subtitles… lists others.', 10000); return; }
      let list = [];
      try { list = await searchRemote(L, lang); } catch (e) { fc.search = remoteError(e); }
      if (!still()) return;
      fc.searched = list.length;
      let found = null;
      for (const cand of list.slice(0, 8)) {
        let cues = null;
        try { cues = parseCues(await previewRemote(cand)); }
        catch (e) { fc.tried.push((cand.Name || cand.Id) + ': couldn’t read it before saving (' + ((e && e.message) || 'error') + ')'); if (e && e.status === 404) { fc.noPreview = true; break; } continue; }
        if (!still()) return;
        if (!cues || cues.length < 20) { fc.tried.push((cand.Name || cand.Id) + ': too short'); continue; }
        const res = await window.GnwSubSync.scoreCues(ck, cues);
        if (!still()) return;
        fc.tried.push((cand.Name || cand.Id) + ' (search): ' + fitsLine(res));
        if (res && res.ok && res.fits) { found = cand; break; }
      }
      if (found) {
        const st = await downloadRemote(L, found);
        if (!still() || !st) return;
        fc.result = 'downloaded ' + (found.Name || found.Id) + ' from the server’s search (it fits the soundtrack)';
        setPick(L.item.Id, streamKey(st));
        await selectTrack(L, st, { auto: true });
        setStatus(L, 'Found subtitles that fit this video: ' + (found.Name || 'from the server’s search') + '.', 9000);
        return;
      }
      fc.result += fc.noPreview ? '; the server can’t hand over a search result without saving it, so nothing was downloaded' : list.length ? '; none of the server’s ' + Math.min(8, list.length) + ' search results fits' : '; the server’s search found nothing';
      setStatus(L, 'These subtitles don’t match this video (probably another episode or cut). No subtitles that fit were found.', 12000);
    } finally { L.fitBusy = false; updateBar(L); }
  }

  /* ------------------------------------------------ Part 3: Auto-sync */
  /* The work is in subsync.js, loaded the first time it is needed. */
  let _ssLoad = null;
  function loadSubSync() {
    if (window.GnwSubSync) return Promise.resolve();
    if (!_ssLoad) _ssLoad = new Promise((res, rej) => {
      const sc = document.createElement('script');
      sc.src = 'subsync.js?v=' + BUILD;
      sc.onload = () => res();
      sc.onerror = () => { _ssLoad = null; rej(new Error('subsync.js did not load')); };
      document.head.appendChild(sc);
    });
    return _ssLoad;
  }
  async function autoSync(L, opts) {
    if (!L || L.dead) return;
    try { await loadSubSync(); }
    catch (e) { setStatus(L, 'Auto-sync isn’t available (' + e.message + ').', 6000); return; }
    if (L.dead) return;
    const I = window.GnwSubs._internal;
    // Always silent now: nothing in the bar; the result is applied by applyAuto.
    const I2 = Object.assign({}, I, { setStatus: () => {}, setOffsetLive: (L2, o, sc, meta) => applyAuto(L2, o, sc, meta), onMismatch });
    return window.GnwSubSync.autoSync(L, opts || {}, I2);
  }

  /* -------------------------------------------------------------- expose */

  window.GnwSubs = {
    BUILD, attach, detach, settingsHTML, wireSettings, renderFind, autoFind, autoSync, setPictureHandler,
    // shared with the Part 2 / Part 3 code below and in subsync.js
    _internal: {
      loadSettings, saveSettings, getOffset, setOffset, offKey, streamKey, subStreams, isTextStream, trackLabel,
      chooseTrack, parseCues, fetchCues, rankRemote, selectTrack, setOffsetLive, resync, applyAuto, setAutoMode, nudge, setStatus, openMenu, closeMenu, menuItem,
      focusMenu, normLang, langLabel, escHtml, api, updateBar, wake, LANGS,
      toggleSubs: () => { if (_live && !_live.dead) toggleSubs(_live); }, diagnose, diagText, offerBetter: (st, again) => { if (_live) offerBetter(_live, st, again); }, paintCheck: () => _live ? paintCheck(_live) : null, quality: (st) => _live ? quality(_live, st) : null, isAdLine, loadLanguage, openInfo: () => { if (_live && !_live.dead) openMenu(_live, 'info'); }, registerPopup, closePopups: (r) => closePopups(_live, r),
      placePopup, chromeHidden: () => !!(_live && chromeHidden(_live)), runAutoSync, cycleSpeed, togglePlay,
      live: () => _live,
    },
  };
})();

/*
 * embytranscode.js -- server conversion (Emby's own transcoder) for the video
 * player, and picture subtitles burned in by the server (2026-10-04, Emby A).
 *
 * WHY. The player plays what the browser can decode, remuxes what it can
 * repackage, and converts DivX and Dolby/DTS audio in WASM (emby.js, remux.js).
 * Everything else used to stop at "It'll play in a media server app": HEVC
 * with no GPU decoder, MPEG-2, VC-1, 10-bit H.264, and any file whose browser
 * path failed part-way. Emby's server can convert all of those, so they are
 * handed to it here:
 *   1. POST /Items/{id}/PlaybackInfo with a DeviceProfile describing what THIS
 *      browser really decodes (probed with MediaSource/canPlayType, not
 *      assumed) and only an HLS transcoding profile (H.264 + AAC in MPEG-TS).
 *   2. Play the TranscodingUrl it returns: hls.js (stored on the site in
 *      vendor/hls.js-1.6.13/, pinned and SRI-checked), or the native player
 *      where HLS is built in (Safari, Tizen).
 *   3. Report the session: /Sessions/Playing at start, /Progress every 10 s and
 *      on pause/resume/seek, /Stopped at the end, all with the PlaySessionId.
 *      Without the Stopped report the server never ends its conversion job, so
 *      the job is also deleted outright (DELETE /Videos/ActiveEncodings) on
 *      close, on episode change (Up Next, through the player's onStop hook),
 *      and on pagehide (a beacon, which survives the page going away).
 *
 * SEEKING. The server's HLS playlist always lists the WHOLE title in short
 * segments, and a jump asks for the segment there; Emby restarts its encoder
 * at that segment. So the <video> clock is the title's own clock, and Resume,
 * Skip Intro, the subtitle overlay and the seek bar all work unchanged. A resume
 * also passes StartTimeTicks, so the first segment the server makes is the one
 * the viewer starts on.
 *
 * WHEN. Settings -> Server conversion: Auto (default: only when the browser
 * can't play a file, or its browser path fails part-way), Always, Never.
 *
 * PICTURE SUBTITLES (PGS, VobSub, DVB). Chosen in the subtitle menu, they make
 * the server convert with that track burned into the picture (SubtitleStreamIndex
 * + a profile that offers only "Encode" for picture formats). Choosing a text
 * track or Off afterwards converts again without it. subs.js hands those
 * choices over through GnwSubs.setPictureHandler().
 *
 * Hooks into emby.js are small: Emby.transcodeHost (what this file may use),
 * a decision in openVideoPlayer(), a mid-play fallback in showPlayerError(), and
 * the settings section. Sound: only the player's own <video> ever plays.
 */
(function () {
  'use strict';

  const BUILD = '20261015-embyformats';
  const MODE_KEY = 'gnw.emby.serverConversion';     // 'auto' | 'always' | 'never'
  /* hls.js 1.6.13 is stored on the site (vendor/hls.js-1.6.13/, dist/hls.min.js
     from the npm package, unmodified, with its Apache-2.0 LICENSE) and loaded
     only when a stream needs it. The path is made absolute from this script's
     own address; the fingerprint below is still checked by the browser. */
  const HLS_URL = new URL('vendor/hls.js-1.6.13/hls.min.js',
    (document.currentScript && document.currentScript.src) || document.baseURI).href;
  const HLS_SRI ='sha384-z+tuLqMWl1/cPv7O+39RO0EURSNvorimpcCaMgeNwU+qFBx+AlUIl7jaAwg0cYil';
  const PROGRESS_MS = 10000;
  const IMAGE_SUB = new Set(['pgssub', 'pgs', 'hdmv_pgs_subtitle', 'dvdsub', 'dvd_subtitle', 'vobsub', 'dvbsub', 'dvb_subtitle', 'xsub', 'sup']);

  let host = null;        // Emby.transcodeHost, set on first use
  let cur = null;         // the live server-converted session
  let launch = null;      // { item, src, audioIndex, resumeTicks, tried } for the title being played

  const H = () => host || (host = (window.Emby && window.Emby.transcodeHost) || null);

  /* --------------------------------------------------------------- settings */

  function mode() {
    try { const m = localStorage.getItem(MODE_KEY); return m === 'always' || m === 'never' ? m : 'auto'; } catch { return 'auto'; }
  }
  function setMode(m) { try { localStorage.setItem(MODE_KEY, m); } catch {} }
  const allowed = () => mode() !== 'never' && !!H();

  function settingsHTML() {
    const m = mode();
    const lbl = 'display:block; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--muted); margin-bottom:6px;';
    const opt = (v, t) => `<option value="${v}"${m === v ? ' selected' : ''}>${t}</option>`;
    return `
      <section class="vault-section" style="margin-top:22px;">
        <label style="${lbl}" for="w-srvconv">Server conversion</label>
        <div class="aw-card">
          <select id="w-srvconv" style="padding:9px 12px; border-radius:10px; background:var(--bg-2, #12151c); border:1px solid var(--line); color:var(--text); font-size:13px;">
            ${opt('auto', 'Auto')}${opt('always', 'Always')}${opt('never', 'Never')}
          </select>
          <p style="margin:9px 0 0; font-size:11.5px; color:var(--muted); line-height:1.5;">
            When this device can't play a file itself, your media server converts it while you watch.
            <strong style="color:var(--text);">Auto</strong> uses the server only for files this device can't play, or that fail part-way.
            <strong style="color:var(--text);">Always</strong> converts every title (uses the server's processor).
            <strong style="color:var(--text);">Never</strong> plays only what this device can play itself.
            Picture subtitles (Blu-ray and DVD) are burned in by the server unless this is Never. Saved only on this device.
          </p>
        </div>
      </section>`;
  }
  function wireSettings(mount) {
    const s = mount && mount.querySelector('#w-srvconv');
    if (s) s.addEventListener('change', () => setMode(s.value));
  }

  /* ------------------------------------------------- what this browser decodes */

  function mse(mime) { try { return !!(window.MediaSource && MediaSource.isTypeSupported(mime)); } catch { return false; } }
  let _probeEl = null;
  function native(mime) {
    try { _probeEl = _probeEl || document.createElement('video'); return !!_probeEl.canPlayType(mime); } catch { return false; }
  }
  const can = mime => mse(mime) || native(mime);
  /* PICTURE BUT NO SOUND (2026-10-10: two HEVC MP4 episodes played
     silent). Every audio codec is probed at run time, never assumed, so Emby
     is told the truth: Chrome on Windows decodes HEVC on the graphics card but
     has no Dolby (AC3 / E-AC3) decoder; Edge may have one. The HLS target
     never lists E-AC3: hls.js cannot read E-AC3 inside MPEG-TS ("Unsupported
     EC-3 in M2TS"), so a copied E-AC3 track would play silent again. HEVC is
     listed for HLS when the browser decodes it (hls.js 1.6 reads HEVC in
     MPEG-TS), so an HEVC file with undecodable sound is converted AUDIO ONLY:
     the picture is copied and the server encodes only AAC. Keep the audio
     probe in step with audioCodecOk() in emby.js. */
  function decodes() {
    const v = ['h264'];
    const hevc8 = ['hvc1.1.6.L153.B0', 'hev1.1.6.L153.B0'].some(c => can(`video/mp4; codecs="${c}"`));
    const hevc10 = ['hvc1.2.4.L153.B0', 'hev1.2.4.L153.B0'].some(c => can(`video/mp4; codecs="${c}"`));
    if (hevc8 || hevc10) v.push('hevc');
    if (can('video/mp4; codecs="vp09.00.10.08"') || can('video/webm; codecs="vp9"')) v.push('vp9');
    if (can('video/mp4; codecs="av01.0.08M.08"')) v.push('av1');
    const a = [];
    if (can('audio/mp4; codecs="mp4a.40.2"')) a.push('aac');
    if (can('audio/mpeg') || can('audio/mp4; codecs="mp4a.6B"') || can('audio/mp4; codecs="mp3"')) a.push('mp3');
    if (!a.includes('aac')) a.unshift('aac');     // a browser that plays video at all plays AAC; the probe can only be wrong here
    if (can('audio/mp4; codecs="opus"') || can('audio/webm; codecs="opus"')) a.push('opus');
    if (can('audio/mp4; codecs="flac"')) a.push('flac');
    if (can('audio/webm; codecs="vorbis"')) a.push('vorbis');
    const ac3 = can('audio/mp4; codecs="ac-3"'), eac3 = can('audio/mp4; codecs="ec-3"');
    if (ac3) a.push('ac3');
    if (eac3) a.push('eac3');
    const hlsAudio = a.filter(c => c === 'aac' || c === 'mp3' || c === 'ac3');   // AAC first: the encoder's target
    return { video: v, audio: a, hlsAudio, hevc8, hevc10 };
  }
  /* The device profile. Direct play lists what really decodes here; the only
     transcoding target is HLS H.264 + AAC (MPEG-TS), which hls.js and every
     native HLS player handle. Text subtitles are "External": the player draws
     them itself (subs.js), so the server must never burn them. Picture formats
     are offered only as "Encode" (burn in) when the viewer chose one. */
  function deviceProfile(burn, opt) {
    const d = decodes();
    const noHevc = !!(opt && opt.noHevcCopy);
    const hlsVideo = ['h264'].concat(!noHevc && d.video.includes('hevc') ? ['hevc'] : []);
    const textSubs = ['vtt', 'srt', 'subrip', 'ass', 'ssa', 'smi', 'sub', 'ttml', 'mov_text'];
    const picSubs = ['pgssub', 'pgs', 'dvdsub', 'vobsub', 'dvbsub', 'sup'];
    return {
      Name: 'Crystal Worlds browser',
      MaxStreamingBitrate: 120000000, MaxStaticBitrate: 120000000, MusicStreamingTranscodingBitrate: 192000,
      DirectPlayProfiles: [
        { Container: 'mp4,m4v,mov', Type: 'Video', VideoCodec: d.video.join(','), AudioCodec: d.audio.join(',') },
        { Container: 'webm', Type: 'Video', VideoCodec: d.video.filter(c => c === 'vp9' || c === 'av1').concat(['vp8']).join(','), AudioCodec: 'opus,vorbis' },
      ],
      TranscodingProfiles: [
        { Container: 'ts', Type: 'Video', VideoCodec: hlsVideo.join(','), AudioCodec: d.hlsAudio.join(','), Context: 'Streaming',
          Protocol: 'hls', MaxAudioChannels: '2', MinSegments: '1', BreakOnNonKeyFrames: true },
      ],
      ContainerProfiles: [],
      CodecProfiles: [
        { Type: 'Video', Codec: 'h264', Conditions: [
          { Condition: 'LessThanEqual', Property: 'VideoBitDepth', Value: '8', IsRequired: false },
          { Condition: 'LessThanEqual', Property: 'VideoLevel', Value: '52', IsRequired: false },
        ] },
      ].concat(d.video.includes('hevc') && !d.hevc10 ? [{ Type: 'Video', Codec: 'hevc', Conditions: [
        { Condition: 'LessThanEqual', Property: 'VideoBitDepth', Value: '8', IsRequired: false },
      ] }] : []),
      SubtitleProfiles: textSubs.map(f => ({ Format: f, Method: 'External' }))
        .concat(burn ? picSubs.map(f => ({ Format: f, Method: 'Encode' })) : []),
      ResponseProfiles: [{ Type: 'Video', Container: 'm4v', MimeType: 'video/mp4' }],
    };
  }

  /* ------------------------------------------------------------------ hls.js */

  let _hlsPromise = null;
  function loadHls() {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (_hlsPromise) return _hlsPromise;
    _hlsPromise = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = HLS_URL; s.integrity = HLS_SRI; s.crossOrigin = 'anonymous'; s.async = true;
      s.onload = () => (window.Hls ? res(window.Hls) : rej(new Error('hls.js did not load')));
      s.onerror = () => { _hlsPromise = null; rej(new Error('Couldn’t load the HLS player (hls.js)')); };
      document.head.appendChild(s);
    });
    return _hlsPromise;
  }
  function preferNativeHls(v) {
    const ok = !!(v.canPlayType('application/vnd.apple.mpegurl') || v.canPlayType('application/x-mpegURL'));
    if (!ok) return false;
    const ua = navigator.userAgent || '';
    const safari = /Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\//.test(ua);
    return safari || /Tizen|Web0S|webOS/i.test(ua) || !window.MediaSource;
  }

  /* -------------------------------------------------------------- the server */

  function absUrl(u) {
    const h = H();
    if (/^https?:\/\//i.test(u)) return u;
    if (/^\/emby\//i.test(u)) return h.serverRoot() + u;
    return h.base() + (u.charAt(0) === '/' ? u : '/' + u);
  }
  function withParams(url, add) {
    const [p, q = ''] = url.split('?');
    const sp = new URLSearchParams(q);
    for (const [k, v] of Object.entries(add)) {
      if (v === undefined) continue;
      const has = [...sp.keys()].find(x => x.toLowerCase() === k.toLowerCase());
      if (v === null) { if (has) sp.delete(has); continue; }
      if (!has) sp.set(k, String(v));
    }
    return p + '?' + sp.toString();
  }
  // Like withParams, but replaces a value the server already put there.
  function setParams(url, set) {
    const [p, q = ''] = url.split('?');
    const sp = new URLSearchParams(q);
    for (const [k, v] of Object.entries(set)) {
      const has = [...sp.keys()].find(x => x.toLowerCase() === k.toLowerCase());
      if (has) sp.delete(has);
      sp.set(k, String(v));
    }
    return p + '?' + sp.toString();
  }

  /* BLACK PICTURE, SOUND PLAYING (Emby formats census, 2026-10-15). The
     playlist asked for VideoCodec=h264,hevc but Emby, given leave to copy and
     seeing only a container problem, COPIED the original picture into the
     MPEG-TS: MPEG-1/2 (stream type 0x02), MPEG-4 Part 2 (0x10), WMV3/FLV1
     (0x06). No browser decodes those, so the clock ran with no frames. The picture may be copied only when the copy is H.264, or HEVC
     this browser decodes, and never out of an AVI (its timestamps do not
     survive a stream copy into HLS). AV1 and VP9 keep their direct and remux
     paths; MPEG-TS HLS cannot carry them, so through the server they are
     re-encoded too. Everything else is re-encoded to H.264. */
  function videoCopyOk(src, o) {
    if (o && (o.forceEncode || o.subtitleIndex != null)) return false;
    const vs = ((src && src.MediaStreams) || []).find(s => s.Type === 'Video');
    if (!vs) return true;                       // no picture at all: nothing to copy or encode
    const c = String(vs.Codec || '').toLowerCase();
    const ext = ((/\.([a-z0-9]+)$/i.exec((src && src.Path) || '') || [])[1] || String((src && src.Container) || '')).toLowerCase();
    if (ext === 'avi' || ext === 'divx') return false;
    if (c === 'h264' || c === 'avc') return true;
    if (c === 'hevc' || c === 'h265') {
      if (o && o.noHevcCopy) return false;
      const d = decodes();
      return d.video.includes('hevc') && ((Number(vs.BitDepth) || 8) < 10 || d.hevc10);
    }
    return false;
  }

  /* THE ACCOUNT MAY NOT BE ALLOWED TO CONVERT PICTURES (2026-10-15). Emby's
     user policy "Allow video playback that requires transcoding"
     (EnableVideoPlaybackTranscoding) was found OFF for a test account:
     with it off the server only repackages, copying the picture whatever was
     asked (VideoCodec=h264 and AllowVideoStreamCopy=false were both ignored,
     and the segments still carried MPEG-2). Nothing in the browser can change
     that, so the player asks once and, when a file's picture would need
     converting, says so plainly instead of playing sound over black. The
     setting itself is the server owner's to change. Null: not known. */
  let _policy = null, _policyAt = 0;
  async function videoConversionAllowed() {
    const h = H(); if (!h) return null;
    if (_policy && Date.now() - _policyAt < 10 * 60 * 1000) return _policy.video;
    try {
      const r = await fetch(h.base() + '/Users/' + h.userId(), { headers: h.authHeaders() });
      if (!r.ok) return null;
      const u = await r.json();
      const p = (u && u.Policy) || {};
      _policy = { video: p.EnableVideoPlaybackTranscoding !== false, name: (u && u.Name) || '' };
      _policyAt = Date.now();
      return _policy.video;
    } catch { return null; }
  }
  const NO_VIDEO_CONVERSION = () => 'This file’s picture has to be converted to play here, and your media server account isn’t allowed to convert video. '
    + whereUsers() + (_policy && _policy.name ? ', ' + _policy.name : '') + ', turn on “Allow video playback that requires transcoding”.';
  /* Where the setting is, on the server signed in to (26 Oct): Emby's Users, Jellyfin's Dashboard > Users. */
  const whereUsers = () => { const h = H(); const n = (h && h.serverName && h.serverName()) || 'Emby'; return n === 'Jellyfin' ? 'In Jellyfin, under Dashboard, Users' : 'In ' + n + ', under Users'; };

  async function requestTranscode(item, src, o) {
    const h = H();
    const burn = o.subtitleIndex != null;
    const copyOk = videoCopyOk(src, o);
    const params = {
      UserId: h.userId(), MediaSourceId: src && src.Id, StartTimeTicks: Math.max(0, Math.round(o.startTicks || 0)) || undefined,
      IsPlayback: true, AutoOpenLiveStream: true, MaxStreamingBitrate: 120000000,
      AudioStreamIndex: o.audioIndex != null ? o.audioIndex : undefined,
      SubtitleStreamIndex: burn ? o.subtitleIndex : -1,
      EnableDirectPlay: false, EnableDirectStream: false, EnableTranscoding: true, AllowVideoStreamCopy: copyOk, AllowAudioStreamCopy: true,
    };
    const info = await h.post(`/Items/${item.Id}/PlaybackInfo`, params, { DeviceProfile: deviceProfile(burn, { noHevcCopy: o.noHevcCopy || !copyOk }) });
    if (info && info.ErrorCode) throw new Error(info.ErrorCode === 'NotAllowed'
      ? 'Your account on the media server isn’t allowed to convert video. An administrator can turn that on.'
      : 'The server refused (' + info.ErrorCode + ').');
    const ms = ((info && info.MediaSources) || []).find(s => src && s.Id === src.Id) || ((info && info.MediaSources) || [])[0];
    if (!ms || !ms.TranscodingUrl) throw new Error('The server did not offer a converted stream for this file.');
    let url = absUrl(ms.TranscodingUrl);
    url = withParams(url, {
      [h.tokenParam ? h.tokenParam() : 'api_key']: h.token(), DeviceId: h.deviceId(), PlaySessionId: info.PlaySessionId || undefined,
      SubtitleStreamIndex: burn ? o.subtitleIndex : undefined, SubtitleMethod: burn ? 'Encode' : undefined,
    });
    if (!burn) url = withParams(url, { SubtitleMethod: null }).replace(/([?&])SubtitleStreamIndex=\d+/i, '$1SubtitleStreamIndex=-1');
    // Said again on the stream URL itself: the PlaybackInfo flag alone did not
    // stop the copy (see videoCopyOk).
    if (!copyOk) url = setParams(url, { VideoCodec: 'h264', AllowVideoStreamCopy: 'false' });
    const pss = info.PlaySessionId || new URLSearchParams(url.split('?')[1] || '').get('PlaySessionId') || ('gnw-' + Date.now().toString(36));
    const reasons = (new URLSearchParams(url.split('?')[1] || '').get('TranscodeReasons') || '').split(',').filter(Boolean);
    // Was the HEVC picture kept (copied)? Then a stream that fails here is asked
    // for again once with H.264 only (see play()).
    const vcodec = (new URLSearchParams(url.split('?')[1] || '').get('VideoCodec') || '').toLowerCase();
    const hevcCopy = !o.noHevcCopy && /hevc|h265/.test(vcodec);
    return { url, playSessionId: pss, source: ms, hls: (ms.TranscodingSubProtocol || 'hls').toLowerCase() === 'hls' || /\.m3u8/i.test(url), reasons, hevcCopy, copyOk };
  }

  function sessionBody(s, extra) {
    return Object.assign({
      ItemId: s.item.Id, MediaSourceId: s.src && s.src.Id, PlaySessionId: s.playSessionId,
      PositionTicks: Math.round(Math.max(0, posOf(s)) * 1e7), IsPaused: !!(s.v && s.v.paused), IsMuted: !!(s.v && s.v.muted),
      VolumeLevel: s.v ? Math.round((s.v.volume || 0) * 100) : 100, PlayMethod: 'Transcode', CanSeek: true,
      AudioStreamIndex: s.audioIndex != null ? s.audioIndex : undefined,
      SubtitleStreamIndex: s.subtitleIndex != null ? s.subtitleIndex : -1,
      RunTimeTicks: (s.src && s.src.RunTimeTicks) || s.item.RunTimeTicks || undefined,
      PlaylistIndex: 0, PlaylistLength: 1, QueueableMediaTypes: ['Video'],
    }, extra || {});
  }
  function report(path, body, opts = {}) {
    const h = H(); if (!h) return Promise.resolve();
    try {
      return fetch(h.base() + path, {
        method: opts.method || 'POST', keepalive: true,
        headers: Object.assign(h.authHeaders(), body ? { 'Content-Type': 'application/json' } : {}),
        body: body ? JSON.stringify(body) : undefined,
      }).catch(() => {});
    } catch { return Promise.resolve(); }
  }
  const posOf = s => {
    const t = s.v && !s.v.seeking && s.v.currentTime > 0 ? s.v.currentTime : s.lastPos;
    return isFinite(t) ? t : 0;
  };

  /* ------------------------------------------------------------- the session */

  function stopSession(s, how) {
    if (!s || s.stopped) return;
    s.stopped = true;
    if (cur === s) cur = null;
    clearInterval(s.timer);
    for (const [el, ev, fn] of s.listeners) { try { el.removeEventListener(ev, fn); } catch {} }
    if (s.hls) { try { s.hls.destroy(); } catch {} s.hls = null; }
    const h = H();
    const pos = Math.round(Math.max(0, s.lastPos) * 1e7);
    if (!s.playSessionId || !h) { if (s.v) { try { s.v.pause(); } catch {} } return; }   // the server was never asked: nothing to end
    if (how === 'pagehide' && h.leavingPost && h.leavingPost('/Sessions/Playing/Stopped', Object.assign(sessionBody(s), { PositionTicks: pos }))) {
      // Jellyfin: sent by emby.js as a keepalive fetch (it reads the body only).
    } else if (how === 'pagehide' && navigator.sendBeacon) {
      // The page is going away: a beacon is the request that still gets sent.
      // Emby reads the report's fields from the query string as well as a body.
      const q = new URLSearchParams({ ItemId: s.item.Id, MediaSourceId: (s.src && s.src.Id) || '', PlaySessionId: s.playSessionId,
        PositionTicks: String(pos), PlayMethod: 'Transcode', api_key: h.token() });
      try { navigator.sendBeacon(h.base() + '/Sessions/Playing/Stopped?' + q.toString()); } catch {}
    } else {
      report('/Sessions/Playing/Stopped', Object.assign(sessionBody(s), { PositionTicks: pos }));
    }
    // End the conversion job itself, whether or not the report lands.
    report('/Videos/ActiveEncodings?' + new URLSearchParams({ DeviceId: h.deviceId(), PlaySessionId: s.playSessionId }).toString(), null, { method: 'DELETE' });
    if (s.v) { try { s.v.pause(); } catch {} try { s.v.removeAttribute('src'); s.v.load(); } catch {} }
  }
  function stop() { if (cur) stopSession(cur, 'stop'); }
  window.addEventListener('pagehide', () => { if (cur) stopSession(cur, 'pagehide'); });

  function reasonText(reasons, given) {
    if (given) return given;
    const map = { VideoCodecNotSupported: 'video format', AudioCodecNotSupported: 'audio format', ContainerNotSupported: 'file type',
      SubtitleCodecNotSupported: 'picture subtitles', VideoLevelNotSupported: 'video profile', VideoBitDepthNotSupported: 'video bit depth' };
    const bits = [...new Set(reasons.map(r => map[r]).filter(Boolean))];
    return bits.length ? 'this device can’t play its ' + bits.join(' or ') : '';
  }

  /* Start server conversion for `item` in the open player.
     o = { audioIndex, subtitleIndex, resumeTicks, reason } */
  async function play(item, src, o = {}) {
    const h = H(); if (!h || !item) return false;
    stop();
    const burn = o.subtitleIndex != null;
    const { stage } = h.openStage(`
      <video class="vp-video prepping" controls autoplay playsinline crossorigin="anonymous"></video>
      ${h.playerLoadingHTML(item, 'Server converting…', burn
        ? 'Your media server is converting this file with the chosen subtitles burned into the picture. This can take a few seconds.'
        : 'Your media server is converting this file so it can play here. This can take a few seconds.')}`);
    const v = stage.querySelector('video');
    const s = { item, src, v, stage, audioIndex: o.audioIndex != null ? o.audioIndex : null, subtitleIndex: burn ? o.subtitleIndex : null,
      forceEncode: !!o.forceEncode,
      playSessionId: null, hls: null, timer: 0, listeners: [], started: false, stopped: false, lastPos: (o.resumeTicks || 0) / 1e7 };
    cur = s;
    if (launch) launch.tried = true;
    const resumeTicks = o.resumeTicks || 0;
    h.startPlaybackTracking(v, item, resumeTicks);
    h.attachIntroSkip(v, stage, item);
    h.attachSubs(v, stage, item, 'transcode', { burnedIndex: s.subtitleIndex });
    h.attachAddons(v, stage, item, 'transcode');
    h.onStop(() => stopSession(s, 'stop'));
    const on = (el, ev, fn) => { el.addEventListener(ev, fn); s.listeners.push([el, ev, fn]); };
    const fail = (msg) => {
      if (s.stopped) return;
      console.warn('[Emby] server conversion failed:', msg);
      if (t && t.hevcCopy && !o.noHevcCopy) {
        // The copied HEVC picture did not play here: ask again with H.264 only.
        const at = Math.round(Math.max(0, s.lastPos) * 1e7);
        stopSession(s, 'stop'); h.teardown();
        play(item, src, Object.assign({}, o, { noHevcCopy: true, resumeTicks: at }));
        return;
      }
      stopSession(s, 'stop');
      h.showPlayerError(stage, src, 'Your media server couldn’t convert this file for this device. ' + (msg || ''));
    };
    // A picture that must be converted, on an account that may not convert
    // video: say so now rather than after a black wait (see videoConversionAllowed).
    if (!videoCopyOk(src, { forceEncode: !!o.forceEncode, subtitleIndex: s.subtitleIndex, noHevcCopy: !!o.noHevcCopy })
        && ((src && src.MediaStreams) || []).some(x => x.Type === 'Video')
        && (await videoConversionAllowed()) === false) {
      if (s.stopped) return true;
      console.warn('[Emby] this account may not convert video (EnableVideoPlaybackTranscoding is off)');
      stopSession(s, 'stop');
      // Over plain http the site's own converter is switched off by the browser (emby.js remuxSupport
      // says so in o.why, from decide()); name that first, since https:// would play it here (25 Oct).
      const httpOnly = window.isSecureContext === false && /https:\/\//.test(o.why || '');
      h.showPlayerError(stage, src, (httpOnly ? o.why + ' ' : '') + NO_VIDEO_CONVERSION());
      return true;
    }
    let t;
    try {
      t = await requestTranscode(item, src, { audioIndex: s.audioIndex, subtitleIndex: s.subtitleIndex, startTicks: resumeTicks, noHevcCopy: !!o.noHevcCopy, forceEncode: !!o.forceEncode });
    } catch (e) { fail(e && e.message); return true; }
    if (s.stopped) { s.playSessionId = t.playSessionId; s.stopped = false; stopSession(s, 'stop'); return true; }   // closed while asking: end the job just made
    s.playSessionId = t.playSessionId;
    if (t.source && t.source.MediaStreams && !(src && src.MediaStreams)) s.src = t.source;

    on(v, 'timeupdate', () => { if (!v.seeking && v.currentTime > 0) s.lastPos = v.currentTime; });
    on(v, 'pause', () => { if (s.started && !v.ended) report('/Sessions/Playing/Progress', sessionBody(s, { EventName: 'pause', IsPaused: true })); });
    on(v, 'play', () => { if (s.started) report('/Sessions/Playing/Progress', sessionBody(s, { EventName: 'unpause', IsPaused: false })); });
    on(v, 'seeked', () => { s.lastPos = v.currentTime; if (s.started) report('/Sessions/Playing/Progress', sessionBody(s, { EventName: 'timeupdate' })); });
    const started = () => {
      if (s.started || s.stopped) return;
      s.started = true;
      h.revealPlayer(stage);
      report('/Sessions/Playing', sessionBody(s));
      s.timer = setInterval(() => report('/Sessions/Playing/Progress', sessionBody(s, { EventName: 'timeupdate' })), PROGRESS_MS);
      const why = reasonText(t.reasons, o.reason);
      h.videoToast(burn ? 'Your media server is converting this file to burn in the picture subtitles.'
        : 'Your media server is converting this file to play here' + (why ? ' (' + why.replace(/\.$/, '') + ')' : '') + '.', false);
    };
    on(v, 'playing', started);
    on(v, 'loadeddata', () => h.revealPlayer(stage));
    /* NO PICTURE (2026-10-15): the clock runs and sound plays, but no frame
       is ever decoded. Converted again once with the picture re-encoded to
       H.264 from where it got to; if that still has no picture, a plain
       error, never a silent black screen. */
    if (h.watchForPicture) h.watchForPicture(v, s.src || src, () => {
      if (s.stopped) return;
      const at = Math.round(Math.max(0, posOf(s)) * 1e7);
      if (!s.forceEncode) {
        console.warn('[Emby] server conversion has sound but no picture; converting again with the picture re-encoded');
        stopSession(s, 'stop'); h.teardown();
        play(item, src, Object.assign({}, o, { forceEncode: true, resumeTicks: at, reason: o.reason }));
        return;
      }
      stopSession(s, 'stop');
      h.showPlayerError(stage, src, 'The picture in this file can’t be shown on this device, and your media server couldn’t convert it.');
    });

    if (!t.hls || preferNativeHls(v)) {
      on(v, 'error', () => fail('The converted stream couldn’t be played here.'));
      v.src = t.url;
      if (resumeTicks > 0 && t.hls) on(v, 'loadedmetadata', () => { try { if (v.currentTime < 1) v.currentTime = resumeTicks / 1e7; } catch {} });
    } else {
      let Hls;
      try { Hls = await loadHls(); } catch (e) { fail(e && e.message); return true; }
      if (s.stopped) return true;
      if (!Hls.isSupported()) { fail('This device can’t play HLS streams.'); return true; }
      const hls = new Hls({ startPosition: resumeTicks > 0 ? resumeTicks / 1e7 : -1, maxBufferLength: 30, backBufferLength: 60, enableWorker: true });
      s.hls = hls;
      let recovered = { net: 0, media: 0 };
      hls.on(Hls.Events.ERROR, (_e, d) => {
        if (!d || !d.fatal || s.stopped) return;
        if (d.type === Hls.ErrorTypes.NETWORK_ERROR && recovered.net++ < 2) { hls.startLoad(); return; }
        if (d.type === Hls.ErrorTypes.MEDIA_ERROR && recovered.media++ < 2) { hls.recoverMediaError(); return; }
        fail((d.details || 'stream error') + (d.response && d.response.code ? ' (' + d.response.code + ')' : '') + '.');
      });
      hls.loadSource(t.url);
      hls.attachMedia(v);
    }
    const p = v.play(); if (p && p.catch) p.catch(() => {});
    return true;
  }

  /* Restart the current title through the server from where it is now, with a
     different audio track or picture subtitle. Works from any play path. */
  function restart(o) {
    const h = H(); if (!h || !launch) return false;
    const v = document.querySelector('#video-player-overlay video');
    const at = (cur && cur.v === v) ? posOf(cur) : (v && v.currentTime > 0 ? v.currentTime : (launch.resumeTicks || 0) / 1e7);
    const audioIndex = o.audioIndex !== undefined ? o.audioIndex : (cur ? cur.audioIndex : launch.audioIndex);
    const subtitleIndex = o.subtitleIndex !== undefined ? o.subtitleIndex : (cur ? cur.subtitleIndex : null);
    const forceEncode = !!(cur && cur.forceEncode);
    h.teardown();          // trackers, subtitle overlay, add-ons, onStop (ends any live conversion), remux engine
    launch.audioIndex = audioIndex;
    play(launch.item, launch.src, { audioIndex, subtitleIndex, resumeTicks: Math.round(at * 1e7), forceEncode });
    return true;
  }
  function switchAudio(audioIndex) { return restart({ audioIndex }); }

  /* --------------------------------------------------------- hooks for emby.js */

  /* openVideoPlayer() tells us what it is about to play; returns the launch
     function to use instead of its own when the server should convert. */
  function decide(ctx) {
    stop();
    launch = { item: ctx.item, src: ctx.src, audioIndex: ctx.audioIndex != null ? ctx.audioIndex : null, resumeTicks: ctx.resumeTicks || 0, tried: false };
    if (!allowed()) return null;
    const m = mode();
    if (m !== 'always' && ctx.browserCanPlay) return null;
    const reason = m === 'always' ? 'server conversion is set to Always' : '';
    return () => play(ctx.item, ctx.src, { audioIndex: launch.audioIndex, resumeTicks: launch.resumeTicks, reason, why: ctx.reason || '' });
  }
  /* WHERE THE VIEWER WAS (2026-10-10). A browser path that fails on a seek has
     often reset the <video> to 0 by the time it reports (a test episode: a seek to
     20 min failed, and the server then started the episode from the top). So
     the player's last real position, or the target of the seek in progress,
     is kept here and the hand-over starts there. Media events do not bubble;
     a capturing listener on the document still sees them. */
  let wantEl = null, wantPos = null;
  const inPlayer = el => el && el.tagName === 'VIDEO' && el.closest && el.closest('#video-player-overlay');
  document.addEventListener('seeking', e => { if (inPlayer(e.target)) { wantEl = e.target; wantPos = e.target.currentTime; } }, true);
  document.addEventListener('timeupdate', e => {
    const v = e.target;
    if (inPlayer(v) && !v.seeking && v.currentTime > 1) { wantEl = v; wantPos = v.currentTime; }
  }, true);
  function handoverTicks(v) {
    if (wantEl === v && wantPos != null) return wantPos > 1 ? Math.round(wantPos * 1e7) : 0;
    return v.currentTime > 1 ? Math.round(v.currentTime * 1e7) : launch.resumeTicks;
  }

  /* showPlayerError() asks first: a browser path that failed part-way is handed
     to the server once, from where it got to. False = show the error. */
  function fallback(stage, src, reason, opts) {
    // The stage already belongs to a live conversion: an error from the <video>
    // or remux engine it replaced is stale, and must not paint over it.
    if (cur && !cur.stopped) return true;
    if (!allowed() || !launch || launch.tried) return false;
    const v = stage && stage.querySelector('video');
    if (!v) return false;
    const at = handoverTicks(v);
    launch.tried = true;
    H().teardown();
    // opts.forceEncode: the browser path ran with no picture, so the server
    // must not hand the same picture back copied (emby.js watchForPicture).
    play(launch.item, launch.src || src, { audioIndex: launch.audioIndex, resumeTicks: at, reason: 'it couldn’t be played here',
      forceEncode: !!(opts && opts.forceEncode) });
    return true;
  }

  /* emby.js: a direct-played file whose picture runs but whose sound never
     decodes (no audio bytes after several seconds of playback, 2026-10-10).
     Handed to the server once, from where it got to: the sound converted to
     AAC, the picture copied where this browser decodes it. False = the server
     may not be used (Never, no session) or was already tried. */
  function audioFallback(stage, src, codecLabel) {
    if (cur && !cur.stopped) return true;
    if (!allowed() || !launch || launch.tried) return false;
    const v = stage && stage.querySelector('video');
    if (!v) return false;
    const at = handoverTicks(v);
    launch.tried = true;
    H().teardown();
    play(launch.item, launch.src || src, { audioIndex: launch.audioIndex, resumeTicks: at,
      reason: 'this device can’t decode its ' + (codecLabel ? codecLabel + ' ' : '') + 'sound' });
    return true;
  }

  /* subs.js: a picture track was chosen (burn it in), or a text track / Off
     was chosen while one is burned in (convert again without it). */
  function onPictureSubtitle(p) {
    if (!p) return;
    const st = p.stream;
    const picture = st && (st.IsTextSubtitleStream === false || IMAGE_SUB.has(String(st.Codec || '').toLowerCase()));
    if (picture && !allowed()) {
      const h = H(); if (h) h.videoToast('Picture subtitles need server conversion, which is set to Never in Settings.', true);
      return;
    }
    if (!launch || (p.item && launch.item && p.item.Id !== launch.item.Id)) return;
    // Burning in converts the picture; an account that may not convert video
    // would get the picture back copied with no subtitles in it (2026-10-15).
    if (picture) {
      videoConversionAllowed().then(okv => {
        if (okv === false) {
          const h = H(); if (h) h.videoToast('Picture subtitles have to be burned in by your media server, and your account isn’t allowed to convert video. ' + whereUsers() + ', turn on “Allow video playback that requires transcoding”.', true);
          return;
        }
        restart({ subtitleIndex: st.Index });
      });
      return;
    }
    setTimeout(() => restart({ subtitleIndex: null }), 0);
  }
  function hookSubs() {
    try { if (window.GnwSubs && window.GnwSubs.setPictureHandler) window.GnwSubs.setPictureHandler(onPictureSubtitle); } catch {}
  }
  hookSubs();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hookSubs);

  window.EmbyTranscode = {
    BUILD, mode, setMode, settingsHTML, wireSettings, decide, fallback, audioFallback, play, restart, switchAudio, stop,
    allowed, decodes, videoConversionAllowed,
    deviceProfile, onPictureSubtitle,
    active: () => !!cur,
    burnedIndex: () => (cur ? cur.subtitleIndex : null),
    session: () => (cur ? { playSessionId: cur.playSessionId, itemId: cur.item.Id, audioIndex: cur.audioIndex, subtitleIndex: cur.subtitleIndex } : null),
  };
})();

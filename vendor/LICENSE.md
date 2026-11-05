# Licence notice: vendored runtime binaries

## FFmpeg / libav.js (`libav-6.9.9.0-*`)

Third-party FFmpeg compiled to WebAssembly by
[libav.js](https://github.com/Yahweasel/libav.js), pinned at 6.9.9.0. FFmpeg's
core libraries are licensed under the **GNU Lesser General Public License,
version 2.1 or later**: full text in `COPYING.LGPLv2.1` in this folder, beside
the binaries, and the About page's Licences block cites it. See
`licenses/THIRD-PARTY-NOTICES` section 3.

Corresponding source: FFmpeg 6.9.9.0 plus the libav.js build scripts at the
matching tag, <https://github.com/Yahweasel/libav.js>.

## mediabunny (`mediabunny.mjs`)

Third-party, redistributed unmodified. **Mozilla Public License 2.0**, per the
file's own header: *"Copyright (c) 2026-present, Vanilagy and contributors. This
Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0."*
MPL-2.0 is file-level copyleft; the header travels with the file and the full
text is at <https://mozilla.org/MPL/2.0/>. Upstream:
<https://github.com/Vanilagy/mediabunny>. See `licenses/THIRD-PARTY-NOTICES`
section 4.

## MP2 decoder (`mp2dec.mjs`)

Added 2026-10-10. **MIT**, "Copyright (c) 2017 Dominic Szablewski": derived from
`src/mp2.js` of [JSMpeg](https://github.com/phoboslab/jsmpeg), which is itself
based on kjmp2 by Martin J. Fiedler. The full MIT text is in the file's own
header. Our changes (ES module wrapper, MPEG-2 low-sample-rate frames, polarity
and level matched to FFmpeg, packet-level `decode()`) are listed there too. See
`licenses/THIRD-PARTY-NOTICES` §7.

/* firmware/site/sha.js -- SHA-1 and SHA-256 for pages without crypto.subtle.

   crypto.subtle exists only on secure origins (https, or http://localhost).
   The TV loads the site over plain http at the LAN address, where it is
   undefined, so a content-pack import there could not identify a single file.
   cwsDigest() uses crypto.subtle when it is present and these pure-JS
   digests when it is not (or when it rejects), so ids are the same bytes on
   every origin. Written for this site from FIPS 180-4; no third-party code.

   window.cwsDigest(alg, data) -> Promise<ArrayBuffer>   alg 'SHA-1' | 'SHA-256'
   window.cwsSha.sha1(u8) / .sha256(u8) -> Uint8Array    synchronous            */
(function () {
  'use strict';

  function view(data) {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    throw new TypeError('cwsDigest: expected bytes');
  }

  /* Feed whole 64-byte blocks straight from the input (no copy of the
     message), then the padded tail: one or two blocks built on the side. */
  function blocks(u8, compress) {
    var len = u8.length, full = len & ~63;
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    for (var i = 0; i < full; i += 64) compress(dv, i);
    var rest = len - full, tl = rest < 56 ? 64 : 128;
    var tail = new Uint8Array(tl);
    tail.set(u8.subarray(full));
    tail[rest] = 0x80;
    var tv = new DataView(tail.buffer);
    tv.setUint32(tl - 8, Math.floor(len / 0x20000000));  // bit length, high word
    tv.setUint32(tl - 4, (len << 3) >>> 0);               // bit length, low word
    for (i = 0; i < tl; i += 64) compress(tv, i);
  }

  function out(h) {
    var r = new Uint8Array(h.length * 4), dv = new DataView(r.buffer);
    for (var i = 0; i < h.length; i++) dv.setUint32(i * 4, h[i] >>> 0);
    return r;
  }

  var K256 = new Int32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);

  function sha256(data) {
    var u8 = view(data), w = new Int32Array(64);
    var h = new Int32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
    blocks(u8, function (dv, p) {
      var t, x, y;
      for (t = 0; t < 16; t++) w[t] = dv.getInt32(p + t * 4);
      for (t = 16; t < 64; t++) {
        x = w[t - 15]; y = w[t - 2];
        w[t] = (w[t - 16] + (((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)) + w[t - 7] +
                (((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10))) | 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], k = h[7], t1, t2;
      for (t = 0; t < 64; t++) {
        t1 = (k + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) +
              ((e & f) ^ (~e & g)) + K256[t] + w[t]) | 0;
        t2 = ((((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) +
              ((a & b) ^ (a & c) ^ (b & c))) | 0;
        k = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += k;
    });
    return out(h);
  }

  function sha1(data) {
    var u8 = view(data), w = new Int32Array(80);
    var h = new Int32Array([0x67452301,0xefcdab89,0x98badcfe,0x10325476,0xc3d2e1f0]);
    blocks(u8, function (dv, p) {
      var t, x;
      for (t = 0; t < 16; t++) w[t] = dv.getInt32(p + t * 4);
      for (t = 16; t < 80; t++) { x = w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16]; w[t] = (x << 1) | (x >>> 31); }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f;
      for (t = 0; t < 80; t++) {
        if (t < 20)      f = ((b & c) | (~b & d)) + 0x5a827999;
        else if (t < 40) f = (b ^ c ^ d) + 0x6ed9eba1;
        else if (t < 60) f = ((b & c) | (b & d) | (c & d)) + 0x8f1bbcdc;
        else             f = (b ^ c ^ d) + 0xca62c1d6;
        f = (((a << 5) | (a >>> 27)) + f + e + w[t]) | 0;
        e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = f;
      }
      h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e;
    });
    return out(h);
  }

  var JS = { 'SHA-1': sha1, 'SHA-256': sha256 };
  function jsDigest(alg, data) {
    try { return Promise.resolve(JS[alg](data).buffer); } catch (e) { return Promise.reject(e); }
  }
  function cwsDigest(alg, data) {
    if (!JS[alg]) return Promise.reject(new Error('cwsDigest: unsupported ' + alg));
    var s = window.crypto && window.crypto.subtle;
    if (s && s.digest) return s.digest(alg, data).catch(function () { return jsDigest(alg, data); });
    return jsDigest(alg, data);
  }

  window.cwsSha = { sha1: sha1, sha256: sha256 };
  window.cwsDigest = cwsDigest;
})();

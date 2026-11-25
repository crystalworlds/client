// SHA-256, worked out at once in this thread, for the modules that run both under Node and in a
// browser (the browser's own is asynchronous, and the shared modules ask for a hash and use it on
// the next line). It imports nothing.
//
//   sha256(bytes)                         the hash as 64 hex digits
//   createHash("sha256").update(b).digest("hex")   the same, in pieces, as Node's call is written
//
// Written from the standard that defines it (FIPS 180-4, sections 4.1.2, 4.2.2, 5.1.1, 5.3.3 and
// 6.2). The standard's constants are the first 32 bits of the fractional parts of the square roots
// of the first 8 primes and of the cube roots of the first 64; they are worked out here with whole
// numbers, so no table is typed in and no floating-point rounding can move a bit. The module checks
// itself against the standard's own first example before it answers anything.

const primes = (count) => { const out = []; for (let n = 2; out.length < count; n++) if (out.every((p) => n % p)) out.push(n); return out; };
// The whole part of the k-th root of a whole number, by Newton's steps from above.
function root(n, k) {
  if (n < 2n) return n;
  let x = 1n << BigInt(Math.ceil(n.toString(2).length / Number(k)));
  for (;;) { const y = ((k - 1n) * x + n / x ** (k - 1n)) / k; if (y >= x) return x; x = y; }
}
const fraction32 = (p, k) => Number(root(BigInt(p) << (32n * k), k) & 0xFFFFFFFFn);
const K = Uint32Array.from(primes(64), (p) => fraction32(p, 3n));
const H0 = Uint32Array.from(primes(8), (p) => fraction32(p, 2n));

class Sha256 {
  constructor() { this.h = Uint32Array.from(H0); this.block = new Uint8Array(64); this.fill = 0; this.bytes = 0; this.w = new Int32Array(64); this.done = false; }
  compress(b, at) {
    const w = this.w, h = this.h;
    for (let i = 0; i < 16; i++, at += 4) w[i] = (b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3];
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15], y = w[i - 2];
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = h[0] | 0, bb = h[1] | 0, c = h[2] | 0, d = h[3] | 0, e = h[4] | 0, f = h[5] | 0, g = h[6] | 0, hh = h[7] | 0;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const t1 = (hh + S1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const t2 = (S0 + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
    }
    h[0] += a; h[1] += bb; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  update(data) {
    if (this.done) throw new Error("this hash has given its answer already");
    const b = typeof data === "string" ? new TextEncoder().encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    let at = 0;
    this.bytes += b.length;
    if (this.fill) { const take = Math.min(64 - this.fill, b.length); this.block.set(b.subarray(0, take), this.fill); this.fill += take; at = take; if (this.fill === 64) { this.compress(this.block, 0); this.fill = 0; } }
    for (; at + 64 <= b.length; at += 64) this.compress(b, at);
    if (at < b.length) { this.block.set(b.subarray(at), 0); this.fill = b.length - at; }
    return this;
  }
  digest(encoding) {
    if (this.done) throw new Error("this hash has given its answer already");
    this.done = true;
    const bits = BigInt(this.bytes) * 8n, tail = new Uint8Array(this.fill < 56 ? 64 : 128);
    tail.set(this.block.subarray(0, this.fill));
    tail[this.fill] = 0x80;
    new DataView(tail.buffer).setBigUint64(tail.length - 8, bits, false);
    for (let at = 0; at < tail.length; at += 64) this.compress(tail, at);
    const out = new Uint8Array(32), v = new DataView(out.buffer);
    for (let i = 0; i < 8; i++) v.setUint32(i * 4, this.h[i], false);
    if (!encoding) return out;
    if (encoding !== "hex") throw new Error(`this hash is given as bytes or as hex, not as ${encoding}`);
    let s = ""; for (const b of out) s += b.toString(16).padStart(2, "0");
    return s;
  }
}

export function createHash(name) {
  if (String(name).toLowerCase() !== "sha256") throw new Error(`this hash maker knows SHA-256 only, not ${name}`);
  return new Sha256();
}
// Under Node a tool hands in Node's own maker, which is quicker on a 64 MiB game file and gives the same
// answer (the play page's check holds the two equal); where none is handed in, this file's own is used.
let faster = null;
export const useFasterHash = (make) => { faster = make; };
export const ownSha256 = (bytes) => new Sha256().update(bytes).digest("hex");
export const sha256 = (bytes) => (faster ? faster(bytes) : ownSha256(bytes));

// The standard's first example (FIPS 180-4's examples: the three letters "abc").
if (ownSha256(new TextEncoder().encode("abc")) !== "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad") throw new Error("this SHA-256 does not give the standard's own example");

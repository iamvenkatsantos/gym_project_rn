import { create } from 'qrcode';

/** The blank border scanners look for, in modules. */
const QUIET_ZONE = 4;

let crcTable: Uint32Array | undefined;

function crc32(bytes: Uint8Array) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of bytes) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array) {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function u32(n: number) {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function chunk(type: string, data: Uint8Array) {
  const body = new Uint8Array(4 + data.length);
  for (let i = 0; i < 4; i++) body[i] = type.charCodeAt(i);
  body.set(data, 4);
  return [...u32(data.length), ...body, ...u32(crc32(body))];
}

/** zlib with stored (uncompressed) blocks: no deflate library needed, and a 1-bit image is small anyway. */
function zlibStored(data: Uint8Array) {
  const out: number[] = [0x78, 0x01];
  for (let i = 0; i < data.length || i === 0; i += 0xffff) {
    const block = data.subarray(i, i + 0xffff);
    const last = i + 0xffff >= data.length;
    out.push(last ? 1 : 0, block.length & 0xff, block.length >>> 8);
    out.push(~block.length & 0xff, (~block.length >>> 8) & 0xff);
    for (const b of block) out.push(b);
  }
  out.push(...u32(adler32(data)));
  return new Uint8Array(out);
}

/**
 * The QR as a black-on-white PNG, `scale` pixels per module, built in plain
 * JavaScript so it needs no native module. Sent like a UPI QR on WhatsApp.
 */
export function qrPng(text: string, scale = 20): Uint8Array {
  const { modules } = create(text, { errorCorrectionLevel: 'M' });
  const count = modules.size + QUIET_ZONE * 2;
  const side = count * scale;
  const rowBytes = Math.ceil(side / 8);
  // Each row: a filter byte (0, none), then 1-bit pixels where 1 is white.
  const raw = new Uint8Array((rowBytes + 1) * side);
  for (let y = 0; y < side; y++) {
    const row = y * (rowBytes + 1);
    raw.fill(0xff, row + 1, row + 1 + rowBytes);
    raw[row] = 0;
    const my = Math.floor(y / scale) - QUIET_ZONE;
    if (my < 0 || my >= modules.size) continue;
    for (let x = 0; x < side; x++) {
      const mx = Math.floor(x / scale) - QUIET_ZONE;
      if (mx >= 0 && mx < modules.size && modules.get(my, mx)) {
        raw[row + 1 + (x >> 3)] &= ~(0x80 >> (x & 7));
      }
    }
  }
  const header = new Uint8Array([...u32(side), ...u32(side), 1, 0, 0, 0, 0]);
  return new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...chunk('IHDR', header),
    ...chunk('IDAT', zlibStored(raw)),
    ...chunk('IEND', new Uint8Array()),
  ]);
}

/**
 * Generate placeholder extension icons — a rounded violet square with a white
 * bookmark ribbon — at the four sizes Chrome needs. Zero dependencies: PNG is
 * written by hand (zlib deflate + a CRC32 table), so no image library enters
 * the tree.
 *
 * These are functional placeholders so the manifest loads from Phase 0.
 * Replace with the designed icon before a store release (docs/00 §10 item 3,
 * docs/13 §2). Run: `npm run icons`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ACCENT = [0x6d, 0x4a, 0xff, 255]; // --accent, docs/06 §1
const WHITE = [255, 255, 255, 255];
const TRANSPARENT = [0, 0, 0, 0];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function insideRounded(x, y, size, radius) {
  const px = x + 0.5;
  const py = y + 0.5;
  const dx = Math.max(radius - px, px - (size - radius), 0);
  const dy = Math.max(radius - py, py - (size - radius), 0);
  return dx * dx + dy * dy <= radius * radius;
}

/** Bookmark ribbon: a tall rectangle with a triangular notch cut from the bottom. */
function insideBookmark(x, y, size) {
  const u = (x + 0.5) / size;
  const v = (y + 0.5) / size;
  if (u < 0.32 || u > 0.68 || v < 0.22 || v > 0.78) return false;
  // Notch: from the bottom edge, cut a V rising to the ribbon's middle.
  const notchDepth = 0.22;
  if (v > 0.78 - notchDepth) {
    const fromBottom = (0.78 - v) / notchDepth; // 0 at bottom edge, 1 at notch apex
    if (Math.abs(u - 0.5) < (1 - fromBottom) * 0.18) return false;
  }
  return true;
}

function colorAt(x, y, size) {
  if (!insideRounded(x, y, size, size * 0.2)) return TRANSPARENT;
  if (insideBookmark(x, y, size)) return WHITE;
  return ACCENT;
}

function makePng(size) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    let off = y * (stride + 1) + 1; // skip filter byte (0 = None)
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = colorAt(x, y, size);
      raw[off++] = r;
      raw[off++] = g;
      raw[off++] = b;
      raw[off++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'public', 'icon');
mkdirSync(outDir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  writeFileSync(join(outDir, `${size}.png`), makePng(size));
  console.warn(`wrote src/public/icon/${size}.png`);
}

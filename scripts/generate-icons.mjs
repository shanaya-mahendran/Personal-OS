/**
 * Generates the PWA icons (Grove Green square with a light "S" mark)
 * using only Node's built-in zlib — no image dependencies required.
 * Run: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Simple bitmap font: 5x7 glyphs for S, H, A, N, A, Y, A drawn as blocks. */
function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const GREEN = [0x16, 0x65, 0x34, 0xff];
  const LIGHT = [0xfa, 0xfa, 0xf9, 0xff];

  const put = (x, y, color) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = color[0];
    px[i + 1] = color[1];
    px[i + 2] = color[2];
    px[i + 3] = color[3];
  };

  // Background
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) put(x, y, GREEN);

  // Rounded-ish lighter plate
  const margin = Math.floor(size * 0.14);
  for (let y = margin; y < size - margin; y++) {
    for (let x = margin; x < size - margin; x++) put(x, y, LIGHT);
  }

  // "S" glyph as blocks (7x9 grid scaled)
  const glyph = [
    '0111110',
    '1100000',
    '1100000',
    '0111110',
    '0000011',
    '0000011',
    '1100011',
    '1100011',
    '0111110',
  ];
  const scale = Math.floor((size - margin * 4) / 7);
  const gw = 7 * scale;
  const gh = 9 * scale;
  const ox = Math.floor((size - gw) / 2);
  const oy = Math.floor((size - gh) / 2);

  glyph.forEach((row, gy) => {
    [...row].forEach((cell, gx) => {
      if (cell !== '1') return;
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) {
          put(ox + gx * scale + x, oy + gy * scale + y, GREEN);
        }
      }
    });
  });

  return px;
}

function encodePng(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const pixels = drawIcon(size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const file = join(outDir, `icon-${size}.png`);
  writeFileSync(file, encodePng(size));
  console.log(`wrote ${file}`);
}

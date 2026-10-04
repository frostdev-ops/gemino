/**
 * Generates placeholder PNG icons (no image dependencies, only node:zlib).
 * The glyph is a rounded tile with a "collapsed card" mark: a bar above a dimmed block.
 * Output is committed; re-run with `npx tsx scripts/generate-icons.ts` if the design changes.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/icons');

type RGBA = [number, number, number, number];

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = (CRC_TABLE[(c ^ b) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePng(size: number, pixel: (x: number, y: number) => RGBA): Buffer {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const i = row + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function inRoundRect(
  x: number,
  y: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
): boolean {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
  const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/** One sample in 0..1 space: a blue tile, a white bar, and a dimmed block under it. */
function sample(x: number, y: number): RGBA {
  if (!inRoundRect(x, y, 0.04, 0.04, 0.96, 0.96, 0.22)) return [0, 0, 0, 0];
  if (inRoundRect(x, y, 0.2, 0.24, 0.8, 0.4, 0.06)) return [255, 255, 255, 255];
  if (inRoundRect(x, y, 0.2, 0.5, 0.8, 0.78, 0.06)) return [255, 255, 255, 110];
  return [67, 97, 238, 255];
}

function pixelFor(size: number) {
  // 4x4 samples per pixel so the corners stay smooth at the store's 128px icon.
  const samples = 4;
  return (px: number, py: number): RGBA => {
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    for (let sy = 0; sy < samples; sy++) {
      for (let sx = 0; sx < samples; sx++) {
        const [sr, sg, sb, sa] = sample(
          (px + (sx + 0.5) / samples) / size,
          (py + (sy + 0.5) / samples) / size,
        );
        r += sr;
        g += sg;
        b += sb;
        a += sa;
      }
    }
    const n = samples * samples;
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n), Math.round(a / n)];
  };
}

mkdirSync(outDir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  writeFileSync(resolve(outDir, `icon-${size}.png`), encodePng(size, pixelFor(size)));
  console.log(`wrote public/icons/icon-${size}.png`);
}

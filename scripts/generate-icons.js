#!/usr/bin/env node
/**
 * Generates the app icon set from code.
 *
 * Everything is drawn mathematically at 4x and box-downsampled, which is where
 * the anti-aliasing comes from — there's no image library involved. Re-running
 * regenerates every size identically, so the icon is reproducible rather than a
 * binary someone has to keep around.
 *
 *   node scripts/generate-icons.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SS = 4; // supersample factor

// ---------------------------------------------------------------- palette
const BG_FROM = [255, 122, 89]; // coral
const BG_TO = [255, 180, 87]; // amber
const BUBBLE = [255, 247, 237]; // cream
const HEART = [244, 85, 47]; // deep coral

// ------------------------------------------------------------------ shapes
function roundedRectContains(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function triangleContains(px, py, ax, ay, bx, by, cx, cy) {
  const sign = (x1, y1, x2, y2, x3, y3) => (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
  const d1 = sign(px, py, ax, ay, bx, by);
  const d2 = sign(px, py, bx, by, cx, cy);
  const d3 = sign(px, py, cx, cy, ax, ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

/**
 * Classic implicit heart: (x² + y² − 1)³ − x²y³ ≤ 0.
 * Cheaper and smoother than assembling one from circles and a triangle.
 */
function heartContains(x, y, cx, cy, scale) {
  const u = (x - cx) / scale;
  const v = -(y - cy) / scale;
  const a = u * u + v * v - 1;
  return a * a * a - u * u * v * v * v <= 0;
}

/**
 * @param size    output edge length in px
 * @param inset   fraction of the canvas left as padding around the artwork.
 *                Maskable icons need it so Android's safe-zone crop can't clip.
 */
function drawIcon(size, inset = 0) {
  const S = size * SS;
  const hi = new Uint8ClampedArray(S * S * 4);

  const pad = inset * S;
  const artX0 = pad;
  const artY0 = pad;
  const artSize = S - pad * 2;
  const n = (v) => artX0 + v * artSize; // normalised 0..1 → canvas px

  // Bubble body, and a tail that hangs below its lower-left corner.
  const bx0 = n(0.17);
  const by0 = n(0.2);
  const bx1 = n(0.83);
  const by1 = n(0.64);
  const br = artSize * 0.11;

  const tail = [n(0.3), by1 - 1, n(0.45), by1 - 1, n(0.27), n(0.82)];

  const heartCx = (bx0 + bx1) / 2;
  const heartCy = n(0.4);
  const heartScale = artSize * 0.15;

  for (let py = 0; py < S; py += 1) {
    for (let px = 0; px < S; px += 1) {
      const i = (py * S + px) * 4;

      // Background: rounded square with a diagonal gradient.
      const bgR = S * 0.235;
      if (!roundedRectContains(px, py, 0, 0, S - 1, S - 1, bgR)) {
        hi[i + 3] = 0; // transparent outside the squircle
        continue;
      }

      const t = (px / S + py / S) / 2;
      let r = BG_FROM[0] + (BG_TO[0] - BG_FROM[0]) * t;
      let g = BG_FROM[1] + (BG_TO[1] - BG_FROM[1]) * t;
      let b = BG_FROM[2] + (BG_TO[2] - BG_FROM[2]) * t;

      const inBubble =
        roundedRectContains(px, py, bx0, by0, bx1, by1, br) ||
        triangleContains(px, py, tail[0], tail[1], tail[2], tail[3], tail[4], tail[5]);

      if (inBubble) {
        [r, g, b] = BUBBLE;
        if (heartContains(px, py, heartCx, heartCy, heartScale)) {
          [r, g, b] = HEART;
        }
      }

      hi[i] = r;
      hi[i + 1] = g;
      hi[i + 2] = b;
      hi[i + 3] = 255;
    }
  }

  // Box-downsample: this is what produces the smooth edges.
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let dy = 0; dy < SS; dy += 1) {
        for (let dx = 0; dx < SS; dx += 1) {
          const i = ((y * SS + dy) * S + (x * SS + dx)) * 4;
          const alpha = hi[i + 3] / 255;
          r += hi[i] * alpha;
          g += hi[i + 1] * alpha;
          b += hi[i + 2] * alpha;
          a += alpha;
        }
      }
      const count = SS * SS;
      const o = (y * size + x) * 4;
      // Un-premultiply so edge pixels keep their colour instead of darkening.
      out[o] = a > 0 ? r / a : 0;
      out[o + 1] = a > 0 ? g / a : 0;
      out[o + 2] = a > 0 ? b / a : 0;
      out[o + 3] = (a / count) * 255;
    }
  }
  return out;
}

/** Flattens transparency onto a solid colour, for icons that must be opaque. */
function flatten(rgba, size, bg) {
  const out = Buffer.from(rgba);
  for (let i = 0; i < size * size * 4; i += 4) {
    const a = out[i + 3] / 255;
    out[i] = out[i] * a + bg[0] * (1 - a);
    out[i + 1] = out[i + 1] * a + bg[1] * (1 - a);
    out[i + 2] = out[i + 2] * a + bg[2] * (1 - a);
    out[i + 3] = 255;
  }
  return out;
}

// -------------------------------------------------------------- png writer
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
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

function encodePng(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // 10-12: compression, filter, interlace — all 0

  // Filter byte 0 (None) prefixes every scanline.
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------- main
const root = path.resolve(__dirname, '..');
const targets = [
  { file: 'assets/icon.png', size: 1024, inset: 0, opaque: true },
  { file: 'assets/adaptive-icon.png', size: 1024, inset: 0.16, opaque: false },
  { file: 'assets/favicon.png', size: 48, inset: 0, opaque: true },
  { file: 'public/icons/icon-192.png', size: 192, inset: 0, opaque: true },
  { file: 'public/icons/icon-512.png', size: 512, inset: 0, opaque: true },
  { file: 'public/icons/icon-180.png', size: 180, inset: 0, opaque: true },
  // Android crops maskable icons to a circle, so the artwork is inset.
  { file: 'public/icons/maskable-512.png', size: 512, inset: 0.16, opaque: true },
];

for (const target of targets) {
  let pixels = drawIcon(target.size, target.inset);
  if (target.opaque) pixels = flatten(pixels, target.size, BG_FROM);
  const out = path.join(root, target.file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, encodePng(pixels, target.size));
  console.log(`  ${target.file}  ${target.size}x${target.size}`);
}
console.log('done');

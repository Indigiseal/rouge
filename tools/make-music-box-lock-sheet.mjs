// Pixel-art spritesheet for Music Box lock wafers: 10 frames x 58x72.
// 0 back, 1-2 pin, 3-4 ward, 5-6 cog, 7-8 comb, 9 charge.

import { deflateSync } from 'zlib';
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const TILE_W = 58;
const TILE_H = 72;
const FRAMES = 10;

const C = {
  void: [0, 0, 0, 0],
  ink: [18, 12, 8, 255],
  brassDk: [74, 48, 22, 255],
  brass: [122, 86, 40, 255],
  brassMd: [168, 124, 58, 255],
  brassLt: [212, 176, 92, 255],
  brassHi: [240, 216, 150, 255],
  copper: [176, 96, 42, 255],
  copperLt: [224, 154, 78, 255],
  copperHi: [244, 196, 130, 255],
  olive: [90, 108, 46, 255],
  oliveLt: [150, 168, 72, 255],
  oliveHi: [196, 212, 120, 255],
  gold: [186, 148, 36, 255],
  goldLt: [228, 196, 78, 255],
  goldHi: [248, 226, 140, 255],
  teal: [58, 96, 92, 255],
  tealLt: [110, 156, 148, 255],
  tealHi: [168, 204, 196, 255],
  soot: [22, 14, 10, 255],
  ember: [176, 48, 28, 255],
  spark: [232, 120, 40, 255],
  fuse: [92, 64, 40, 255],
  hole: [22, 18, 14, 255],
};

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[(w * 4 + 1) * y] = 0;
    rgba.copy(raw, (w * 4 + 1) * y + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function makeTile() {
  const data = Buffer.alloc(TILE_W * TILE_H * 4);
  const px = (x, y, col) => {
    if (x < 0 || y < 0 || x >= TILE_W || y >= TILE_H) return;
    const i = (y * TILE_W + x) * 4;
    data[i] = col[0];
    data[i + 1] = col[1];
    data[i + 2] = col[2];
    data[i + 3] = col[3];
  };
  const inCircle = (x, y, cx, cy, r) => {
    const dx = x - cx + 0.5;
    const dy = y - cy + 0.5;
    return dx * dx + dy * dy <= r * r;
  };
  const inRoundRect = (x, y, rx, ry, rw, rh, r) => {
    if (x < rx || y < ry || x >= rx + rw || y >= ry + rh) return false;
    const lx = x - rx;
    const ly = y - ry;
    if (lx >= r && lx < rw - r) return true;
    if (ly >= r && ly < rh - r) return true;
    const cx = lx < r ? r : rw - 1 - r;
    const cy = ly < r ? r : rh - 1 - r;
    return inCircle(lx, ly, cx, cy, r);
  };
  const fillRound = (rx, ry, rw, rh, r, col) => {
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) {
        if (inRoundRect(x, y, rx, ry, rw, rh, r)) px(x, y, col);
      }
    }
  };
  const fillRect = (rx, ry, rw, rh, col) => {
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) px(x, y, col);
    }
  };
  const fillCircle = (cx, cy, r, col) => {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (inCircle(x, y, cx, cy, r)) px(x, y, col);
      }
    }
  };
  const hline = (x, y, w, col) => fillRect(x, y, w, 1, col);
  const vline = (x, y, h, col) => fillRect(x, y, 1, h, col);

  const wafer = (accent) => {
    fillRound(0, 0, TILE_W, TILE_H, 6, C.ink);
    fillRound(1, 1, TILE_W - 2, TILE_H - 2, 5, C.brassDk);
    fillRound(3, 3, TILE_W - 6, TILE_H - 6, 4, C.brassMd);
    fillRound(4, 4, TILE_W - 8, 12, 3, C.brassLt);
    hline(6, 5, TILE_W - 12, C.brassHi);
    const rivet = (x, y) => {
      fillCircle(x, y, 2, C.ink);
      fillCircle(x, y, 1, accent);
      px(x, y - 1, C.brassHi);
    };
    rivet(8, 8);
    rivet(TILE_W - 9, 8);
    rivet(8, TILE_H - 9);
    rivet(TILE_W - 9, TILE_H - 9);
  };

  return { data, px, fillRound, fillRect, fillCircle, hline, vline, wafer };
}

function drawBack() {
  const t = makeTile();
  t.wafer(C.brassLt);
  t.fillRound(16, 24, 26, 26, 3, C.brassDk);
  t.fillRound(18, 26, 22, 22, 2, C.hole);
  t.fillRound(24, 32, 10, 10, 2, C.brassDk);
  t.hline(20, 36, 18, C.brass);
  t.vline(29, 28, 18, C.brass);
  return t.data;
}

function drawPinA() {
  const t = makeTile();
  t.wafer(C.copperLt);
  // Tall driver pin.
  t.fillRound(23, 14, 12, 44, 3, C.ink);
  t.fillRound(24, 15, 10, 42, 3, C.copper);
  t.fillRound(25, 16, 4, 40, 2, C.copperLt);
  t.px(27, 17, C.copperHi);
  t.fillRect(24, 14, 10, 4, C.copperLt);
  t.fillRect(26, 12, 6, 3, C.copper);
  t.fillRect(27, 11, 4, 2, C.copperLt);
  for (const y of [24, 34, 44]) {
    t.hline(24, y, 10, C.ink);
    t.hline(25, y + 1, 8, C.copperHi);
  }
  t.fillRound(24, 52, 10, 6, 2, C.copperLt);
  return t.data;
}

function drawPinB() {
  const t = makeTile();
  t.wafer(C.copperLt);
  // Short wide key pin.
  t.fillRound(14, 34, 30, 18, 4, C.ink);
  t.fillRound(15, 35, 28, 16, 3, C.copper);
  t.fillRound(16, 36, 26, 6, 2, C.copperLt);
  t.hline(16, 38, 26, C.copperHi);
  for (const x of [22, 29, 36]) {
    t.vline(x, 35, 16, C.ink);
    t.vline(x + 1, 36, 14, C.copperHi);
  }
  t.fillRound(24, 30, 10, 6, 2, C.copper);
  t.fillRect(26, 28, 6, 3, C.copperLt);
  return t.data;
}

function drawWardA() {
  const t = makeTile();
  t.wafer(C.oliveLt);
  t.fillRound(12, 18, 34, 38, 3, C.ink);
  t.fillRound(13, 19, 32, 36, 3, C.olive);
  t.fillRound(14, 20, 30, 8, 2, C.oliveLt);
  t.hline(15, 22, 28, C.oliveHi);
  // Keyhole.
  t.fillCircle(29, 36, 7, C.ink);
  t.fillCircle(29, 36, 5, C.hole);
  t.fillRect(26, 40, 7, 12, C.ink);
  t.fillRect(27, 39, 5, 12, C.hole);
  t.px(29, 34, C.oliveHi);
  return t.data;
}

function drawWardB() {
  const t = makeTile();
  t.wafer(C.oliveLt);
  // Key bit that seats in the hole.
  t.fillRound(26, 14, 6, 18, 2, C.ink);
  t.fillRound(27, 15, 4, 16, 1, C.oliveLt);
  t.fillRound(16, 30, 26, 24, 3, C.ink);
  t.fillRound(17, 31, 24, 22, 3, C.olive);
  t.fillRound(18, 32, 22, 6, 2, C.oliveLt);
  t.fillRect(20, 38, 4, 10, C.hole);
  t.fillRect(28, 36, 4, 12, C.hole);
  t.fillRect(35, 40, 4, 8, C.hole);
  t.hline(18, 33, 22, C.oliveHi);
  return t.data;
}

function drawCogHalf(side) {
  const t = makeTile();
  t.wafer(C.goldLt);
  const cx = side === 'a' ? 26 : 31;
  const cy = 38;
  const keep = (x) => (side === 'a' ? x <= cx : x >= cx);
  for (let y = 0; y < TILE_H; y++) {
    for (let x = 0; x < TILE_W; x++) {
      if (!keep(x)) continue;
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const d2 = dx * dx + dy * dy;
      let onTooth = false;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const tx = cx + Math.cos(a) * 17;
        const ty = cy + Math.sin(a) * 17;
        const tdx = x - tx + 0.5;
        const tdy = y - ty + 0.5;
        if (tdx * tdx + tdy * tdy <= 3.2 * 3.2) onTooth = true;
      }
      if (d2 <= 6 * 6) t.px(x, y, d2 <= 3.4 * 3.4 ? C.hole : C.ink);
      else if (d2 <= 15.5 * 15.5) t.px(x, y, dy < -4 ? C.goldLt : C.gold);
      else if (onTooth) t.px(x, y, C.goldLt);
    }
  }
  if (side === 'a') t.vline(cx, cy - 16, 32, C.goldHi);
  else t.vline(cx, cy - 16, 32, C.goldHi);
  t.px(side === 'a' ? cx - 7 : cx + 6, cy - 5, C.brassHi);
  return t.data;
}

function drawCogA() {
  return drawCogHalf('a');
}

function drawCogB() {
  return drawCogHalf('b');
}

function drawCombA() {
  const t = makeTile();
  t.wafer(C.tealLt);
  t.fillRound(12, 16, 34, 8, 2, C.ink);
  t.fillRound(13, 17, 32, 6, 2, C.teal);
  t.hline(14, 18, 30, C.tealHi);
  const lengths = [28, 22, 32, 18, 26];
  lengths.forEach((len, i) => {
    const x = 16 + i * 6;
    t.fillRect(x, 22, 4, len, C.ink);
    t.fillRect(x + 1, 22, 2, len - 1, C.tealLt);
    t.px(x + 1, 23, C.tealHi);
  });
  return t.data;
}

function drawCombB() {
  const t = makeTile();
  t.wafer(C.tealLt);
  t.fillRound(14, 22, 30, 30, 8, C.ink);
  t.fillRound(15, 23, 28, 28, 7, C.teal);
  t.fillRound(17, 25, 24, 10, 4, C.tealLt);
  t.hline(18, 28, 22, C.tealHi);
  const pins = [32, 38, 28, 42, 34];
  pins.forEach((y, i) => {
    const x = 18 + i * 5;
    t.fillRect(x, y, 3, 6, C.ink);
    t.fillRect(x, y, 3, 4, C.tealHi);
  });
  t.fillCircle(29, 37, 3, C.hole);
  return t.data;
}

function drawCharge() {
  const t = makeTile();
  t.wafer(C.ember);
  t.fillCircle(29, 40, 18, C.ink);
  t.fillCircle(29, 40, 16, C.soot);
  t.fillCircle(29, 40, 10, C.ember);
  t.fillCircle(29, 40, 5, C.spark);
  t.fillCircle(29, 40, 2, C.brassHi);
  t.fillRect(28, 16, 3, 10, C.fuse);
  t.fillRect(30, 12, 6, 3, C.fuse);
  t.fillCircle(36, 12, 2, C.spark);
  t.px(28, 38, C.copperHi);
  return t.data;
}

const drawers = [
  drawBack,
  drawPinA,
  drawPinB,
  drawWardA,
  drawWardB,
  drawCogA,
  drawCogB,
  drawCombA,
  drawCombB,
  drawCharge,
];

const sheet = Buffer.alloc(TILE_W * FRAMES * TILE_H * 4);
drawers.forEach((draw, frame) => {
  const tile = draw();
  for (let y = 0; y < TILE_H; y++) {
    const src = y * TILE_W * 4;
    const dst = (y * TILE_W * FRAMES + frame * TILE_W) * 4;
    tile.copy(sheet, dst, src, src + TILE_W * 4);
  }
});

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'art', 'musicBoxLockWafers.png');
writeFileSync(out, encodePNG(TILE_W * FRAMES, TILE_H, sheet));
console.log(`wrote ${out} (${TILE_W * FRAMES}x${TILE_H}, ${FRAMES} frames)`);

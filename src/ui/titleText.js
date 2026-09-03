// Shared helper for screen/room titles.
//
// Renders a title in EB Garamond (see the @font-face in index.html) so every
// screen heading shares one typeface.
//
// This used to draw from "title-font", a 16px bitmap rasterized from Able5.ttf.
// That existed because the canvas was only 640x360 real pixels and a scaled TTF
// came out soft, so the font had to be pre-baked to stay sharp. The canvas now
// renders at full resolution with the camera doing the scaling, so a real
// typeface is sharp on its own — and unlike the bitmap, which was Latin-only and
// dropped Cyrillic headings onto a different face mid-screen, this draws every
// language the game ships.

import { FONT_SIZE, serifStyle, UI_SERIF_FAMILY } from './uiFont.js';

// Matches the bitmap it replaces closely enough that no screen's layout moved:
// the widest existing heading grew from 167px to 206px, against ~360px of room.
const TITLE_SIZE = FONT_SIZE.heading;

// Falls back to the old bitmap only if the webfont never arrived, so a failed
// font load degrades to a readable heading instead of a blank one.
const FALLBACK_BITMAP_KEY = 'title-font';
const FALLBACK_BITMAP_SIZE = 16;

function parseColor(color) {
  if (typeof color === 'number') return color;
  if (typeof color === 'string' && color.startsWith('#')) return parseInt(color.slice(1), 16);
  if (typeof color === 'string' && color.startsWith('0x')) return parseInt(color.slice(2), 16);
  return 0xffffff;
}

function fontReady() {
  try {
    return document?.fonts?.check?.(`${TITLE_SIZE} "${UI_SERIF_FAMILY}"`) ?? false;
  } catch {
    return false;
  }
}

function bitmapCanDraw(scene, text) {
  const chars = scene.cache?.bitmapFont?.get?.(FALLBACK_BITMAP_KEY)?.data?.chars;
  if (!chars) return false;
  for (const ch of String(text)) {
    if (ch.charCodeAt(0) === 32) continue;
    if (!chars[ch.charCodeAt(0)]) return false;
  }
  return true;
}

// createTitle(scene, x, y, text, { color, fallbackSize, fontFamily, depth })
// Returns the created game object (Text or BitmapText), origin centered.
export function createTitle(scene, x, y, text, options = {}) {
  const { color = '#ffffff', depth } = options;
  const value = String(text ?? '');
  let obj;

  if (!fontReady() && bitmapCanDraw(scene, value)) {
    obj = scene.add
      .bitmapText(Math.round(x), Math.round(y), FALLBACK_BITMAP_KEY, value, FALLBACK_BITMAP_SIZE)
      .setOrigin(0.5)
      .setTint(parseColor(color));
  } else {
    obj = scene.add
      .text(x, y, value, serifStyle(TITLE_SIZE, color))
      .setOrigin(0.5);
  }

  if (depth !== undefined) obj.setDepth(depth);
  return obj;
}

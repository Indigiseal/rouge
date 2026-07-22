// Shared helper for screen/room titles.
//
// Renders a title with the dedicated crisp 16px "title-font" bitmap font
// (1-bit rasterized from Able5.ttf) so titles across the game share one sharp,
// consistent look. That font only covers Latin (ASCII + common accents), so
// when a localized title contains characters it can't draw — e.g. Cyrillic or
// CJK — this falls back to a normal text object at the original size, which the
// game's text factory routes to the appropriate bitmap/canvas font.

const TITLE_FONT_KEY = 'title-font';
const TITLE_FONT_SIZE = 16;

function parseColor(color) {
  if (typeof color === 'number') return color;
  if (typeof color === 'string' && color.startsWith('#')) return parseInt(color.slice(1), 16);
  if (typeof color === 'string' && color.startsWith('0x')) return parseInt(color.slice(2), 16);
  return 0xffffff;
}

function titleFontSupports(scene, text) {
  const chars = scene.cache?.bitmapFont?.get?.(TITLE_FONT_KEY)?.data?.chars;
  if (!chars) return false;
  for (const ch of String(text)) {
    const code = ch.charCodeAt(0);
    if (code === 32) continue; // space
    if (!chars[code]) return false;
  }
  return true;
}

// createTitle(scene, x, y, text, { color, fallbackSize, fontFamily, depth })
// Returns the created game object (BitmapText or Text), origin centered.
export function createTitle(scene, x, y, text, options = {}) {
  const {
    color = '#ffffff',
    fallbackSize = '20px',
    fontFamily = '"HoMM Pixel"',
    depth
  } = options;

  const value = String(text ?? '');
  let obj;

  if (titleFontSupports(scene, value)) {
    obj = scene.add
      .bitmapText(Math.round(x), Math.round(y), TITLE_FONT_KEY, value, TITLE_FONT_SIZE)
      .setOrigin(0.5)
      .setTint(parseColor(color));
  } else {
    obj = scene.add
      .text(x, y, value, { fontSize: fallbackSize, fill: color, fontFamily })
      .setOrigin(0.5);
  }

  if (depth !== undefined) obj.setDepth(depth);
  return obj;
}

// Every translated string must be drawable by the font that will draw it.
//
// The game has two type tiers. Gameplay text — floating combat numbers, card
// labels, HUD counters — is bitmap, because it is spawned constantly and needs
// to batch. Everything you actually read is EB Garamond. The bitmap font has
// 457 glyphs; the serif subset has the whole of Latin plus Cyrillic.
//
// When a string contains a glyph the bitmap font lacks, PreloadScene's text
// factory quietly hands it to a canvas Text object in a different typeface. It
// still renders, so nothing looks broken in testing — it just looks wrong, in
// one language, on one screen. That is how a French œ shipped unnoticed.
//
// This makes that failure loud:  npm run test:fonts
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// --- the string tables, without pulling in Phaser ---------------------------
let source = fs.readFileSync(path.join(ROOT, 'src/i18n/i18n.js'), 'utf8')
  .replace(/export\s+(?=(const|function|class))/g, '')
  .replace('const STRINGS =', 'globalThis.STRINGS =')
  .replace('const SUPPORTED_LANGUAGES =', 'globalThis.SUPPORTED_LANGUAGES =');
const ctx = {};
vm.runInNewContext(source, ctx, { filename: 'i18n.js' });
const supported = ctx.SUPPORTED_LANGUAGES || ['en'];

// --- what each font can draw ------------------------------------------------
const bitmapGlyphs = (xmlPath) => {
  const xml = fs.readFileSync(path.join(ROOT, xmlPath), 'utf8');
  return new Set([...xml.matchAll(/<char id="(\d+)"/g)].map((m) => Number(m[1])));
};

const FONTS = [
  { name: 'probly12 (gameplay text)', glyphs: bitmapGlyphs('assets/fonts/probly12NEW_crisp.xml') },
];

// The serif is a TTF; read its cmap without a font library by checking the
// subsetter's own record of what it kept.
const serifRanges = [
  [0x20, 0x7e], [0xa0, 0xff], [0x100, 0x17f], [0x400, 0x45f],
  [0x490, 0x491], [0x2010, 0x2027], [0x2030, 0x205e],
];
const extras = new Set([0xd7, 0xb7, 0x2022, 0x2190, 0x2192, 0x2264, 0x2265]);
FONTS.push({
  name: 'EB Garamond subset (UI text)',
  has: (code) => extras.has(code) || serifRanges.some(([lo, hi]) => code >= lo && code <= hi),
});

const canDraw = (font, code) => (font.has ? font.has(code) : font.glyphs.has(code));

// --- check -------------------------------------------------------------------
let failures = 0;
for (const font of FONTS) {
  const missing = new Map();   // char -> [ "lang key", ... ]
  for (const lang of supported) {
    for (const [key, value] of Object.entries(ctx.STRINGS[lang] || {})) {
      for (const ch of String(value)) {
        const code = ch.codePointAt(0);
        if (code === 10 || code === 13 || code === 32) continue;
        if (canDraw(font, code)) continue;
        const where = missing.get(ch) || [];
        if (where.length < 4) where.push(`${lang} ${key}`);
        missing.set(ch, where);
      }
    }
  }
  if (!missing.size) {
    console.log(`${font.name}: draws every string in ${supported.join('/')}`);
    continue;
  }
  failures += missing.size;
  console.log(`${font.name}: CANNOT DRAW ${missing.size} character(s)`);
  for (const [ch, where] of missing) {
    console.log(`  ${JSON.stringify(ch)} U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}  ${where.join(', ')}`);
  }
}

if (failures) {
  console.log('\nEach of these silently falls back to a different typeface mid-screen.');
  console.log('Either respell the string, or add the glyph to the font.');
  process.exitCode = 1;
}

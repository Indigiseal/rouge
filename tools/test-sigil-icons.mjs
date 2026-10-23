import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ASSET_MANIFEST } from '../src/content/assets/AssetManifest.js';
import {
    SIGILS, SIGIL_ICONS_KEY, SIGIL_ICONS_NEW_KEY, SIGIL_ICONS_NEW_SHEET, SIGIL_ICONS_NEW_COLUMNS,
    NEW_SIGIL_ICON_ORDER, sigilIconArt,
} from '../src/content/sigils/sigils.js';

// The sheet is preloaded and has a 16x16 frame for every sigil on the list.
const entry = ASSET_MANIFEST.find((asset) => asset.key === SIGIL_ICONS_NEW_KEY);
assert.ok(entry && entry.type === 'spritesheet' && entry.path === SIGIL_ICONS_NEW_SHEET.path, 'the sheet is preloaded');
assert.deepEqual([entry.frameWidth, entry.frameHeight], [16, 16]);
const png = readFileSync(new URL('../' + entry.path, import.meta.url));
assert.equal(png.subarray(1, 4).toString(), 'PNG');
const [width, height] = [png.readUInt32BE(16), png.readUInt32BE(20)];
assert.equal(width, SIGIL_ICONS_NEW_COLUMNS * 16);
assert.ok(height >= Math.ceil(NEW_SIGIL_ICON_ORDER.length / SIGIL_ICONS_NEW_COLUMNS) * 16, 'one frame per listed sigil');

// Every listed sigil exists and is listed once.
assert.equal(new Set(NEW_SIGIL_ICON_ORDER).size, NEW_SIGIL_ICON_ORDER.length);
for (const id of NEW_SIGIL_ICON_ORDER) assert.ok(SIGILS[id], `${id} is a sigil`);

// Lookup: the new frame when the sheet loaded, the old one otherwise.
const loaded = { exists: (key) => key === SIGIL_ICONS_NEW_KEY };
const missing = { exists: () => false };
NEW_SIGIL_ICON_ORDER.forEach((id, frame) => {
    assert.deepEqual(sigilIconArt(id, loaded), { key: SIGIL_ICONS_NEW_KEY, frame });
    assert.deepEqual(sigilIconArt(SIGILS[id], loaded), { key: SIGIL_ICONS_NEW_KEY, frame }, 'a def resolves the same as its id');
    assert.deepEqual(sigilIconArt(id, missing), { key: SIGIL_ICONS_KEY, frame: SIGILS[id].frame }, `${id} falls back to its old frame`);
});
assert.deepEqual(sigilIconArt('venom', loaded), { key: SIGIL_ICONS_KEY, frame: SIGILS.venom.frame }, 'sigils with their own old icon keep it');

console.log('Sigil icon checks passed: preload, sheet size, listed sigils, new frames and fallbacks.');

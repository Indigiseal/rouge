import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ASSET_MANIFEST } from '../src/content/assets/AssetManifest.js';
import {
    LOCATION_CARD_BACK_IDS, LOCATION_CARD_BACK_SHEET, buildLocationCardArt, locationCardBackKey, locationHoverAnimKey,
} from '../src/content/assets/locationCardArt.js';
import { cardBackKey, cardHoverAnimKey, isCardBackTexture, DEFAULT_CARD_BACK, DEFAULT_HOVER_ANIM } from '../src/systems/board/BoardVariant.js';
import { PLAYABLE_LOCATION_IDS } from '../src/content/locations/catalog.js';

// Every playable location has a frame on the strip: ten 52x70 frames, preloaded.
for (const id of PLAYABLE_LOCATION_IDS) assert.ok(LOCATION_CARD_BACK_IDS.includes(id), `${id} has a card back`);
const entry = ASSET_MANIFEST.find((asset) => asset.key === LOCATION_CARD_BACK_SHEET.key);
assert.ok(entry && entry.type === 'spritesheet' && entry.path === LOCATION_CARD_BACK_SHEET.path, 'the strip is preloaded');
assert.deepEqual([entry.frameWidth, entry.frameHeight], [52, 70]);
const png = readFileSync(new URL('../' + entry.path, import.meta.url));
assert.equal(png.subarray(1, 4).toString(), 'PNG');
assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [52 * LOCATION_CARD_BACK_IDS.length, 70], 'one 52x70 frame per back');

// The key follows the location, the shared original is everything else.
for (const id of LOCATION_CARD_BACK_IDS) {
    assert.equal(cardBackKey(null, id), locationCardBackKey(id));
    assert.equal(cardHoverAnimKey(null, id), locationHoverAnimKey(id));
    assert.ok(isCardBackTexture(locationCardBackKey(id), null), 'a location back reads as face down');
}
assert.equal(cardBackKey(null, null), DEFAULT_CARD_BACK);
assert.equal(cardBackKey(null, 'starfold'), DEFAULT_CARD_BACK);
assert.equal(cardHoverAnimKey(null, 'starfold'), DEFAULT_HOVER_ANIM);
assert.equal(cardBackKey({ cardBack: 'cocoon' }, 'thornwake'), 'cocoon', 'a variant still wins');

// Building: each frame becomes its location's key, and hover holds still.
const textures = new Map([[LOCATION_CARD_BACK_SHEET.key, {}]]);
const anims = new Map();
const draws = [];
const scene = {
    textures: { exists: (key) => textures.has(key) },
    make: { renderTexture: () => ({ drawFrame: (...args) => draws.push(args), saveTexture: (key) => textures.set(key, {}) }) },
    anims: { exists: (key) => anims.has(key), create: (cfg) => anims.set(cfg.key, cfg) },
};
buildLocationCardArt(scene);
LOCATION_CARD_BACK_IDS.forEach((id, frame) => {
    assert.ok(textures.has(locationCardBackKey(id)), `${id}'s back is registered under its location key`);
    assert.ok(draws.some(([sheet, f]) => sheet === LOCATION_CARD_BACK_SHEET.key && f === frame), `${id} is cut from frame ${frame}`);
    assert.deepEqual(anims.get(locationHoverAnimKey(id)).frames, [{ key: locationCardBackKey(id) }]);
});
// A strip that did not load leaves the original.
const bare = { textures: { exists: () => false }, make: scene.make, anims: { exists: () => false, create() { throw new Error('no anim without a back'); } } };
buildLocationCardArt(bare);

console.log('Card back checks passed: ten drawn backs, preload, location keys, hover, fallbacks.');

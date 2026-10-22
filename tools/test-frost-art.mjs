import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ASSET_MANIFEST } from '../src/content/assets/AssetManifest.js';
import { FROSTHOLLOW_ENEMY_DEFS, FROSTHOLLOW_LOCATION_PACK } from '../src/content/location-packs/frosthollow/index.js';
import { buildEnemyCardTextures, sheetRowFor } from '../src/content/assets/enemyCards.js';
import { locationCardRow } from '../src/content/assets/locationCardArt.js';
import { applyEnemyTier } from '../src/content/balance/EnemyTiers.js';
import { BOSSES } from '../src/content/cards/bosses.js';
import { BOSS_ATTACK_FRAMES, showBossAttackFrame } from '../src/content/cards/bossAttackFrames.js';
import { PATH_LOCATIONS } from '../src/content/locations/catalog.js';

const manifest = new Map(ASSET_MANIFEST.map(asset => [asset.key, asset]));
const pngSize = key => {
    const entry = manifest.get(key);
    assert.ok(entry, `${key} must be preloaded`);
    const png = readFileSync(new URL('../' + entry.path, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    return [png.readUInt32BE(16), png.readUInt32BE(20)];
};
const keys = new Set();
const artOrder = ['snowBrute', 'snowArcher', 'iceOrb', 'iceGolem', 'frozenKnight'];
const sheetSize = pngSize('enemyCards');
assert.equal(sheetSize[0], 416);
assert.ok(sheetSize[1] >= 630 && sheetSize[1] % 70 === 0, 'the sheet contains the complete Frost row');
assert.equal(sheetRowFor('frosthollow'), 8);
assert.equal(locationCardRow('frosthollow'), undefined, 'enemy row must not invent missing card-flip/hover frames');
const renders = new Map();
const scene = { textures: { exists: key => ['enemyCards', 'enemyIcons'].includes(key) || renders.has(key) },
    make: { renderTexture: dimensions => {
        const draws = [];
        return { drawFrame(...args) { draws.push(args); }, saveTexture(key) { renders.set(key, { dimensions, draws }); } };
    } } };
assert.equal(buildEnemyCardTextures(scene, [FROSTHOLLOW_LOCATION_PACK]), 15);
assert.equal(buildEnemyCardTextures(scene, [FROSTHOLLOW_LOCATION_PACK]), 0);
for (const [id, def] of Object.entries(FROSTHOLLOW_ENEMY_DEFS)) {
    const column = artOrder.indexOf(id);
    assert.equal(def.sheetColumn, column);
    assert.equal(def.sprite, `enemyCard_frosthollow_${column}_normal`);
    assert.equal(def.placeholderArt, false);
    for (const [tier, faceColumn] of Object.entries({ normal: 5, veteran: 6, elite: 7 })) {
        const key = `enemyCard_frosthollow_${column}_${tier}`;
        const rendered = renders.get(key);
        assert.deepEqual([rendered.dimensions.width, rendered.dimensions.height], [52, 70]);
        assert.deepEqual(rendered.draws.slice(0, 2), [['enemyCards', 64 + faceColumn, 0, 0], ['enemyCards', 64 + column, 0, 0]]);
        assert.deepEqual(rendered.draws[3], ['enemyIcons', def.role === 'RANGED' ? 2 : 1, 36, 54]);
        const promoted = { ...def, health: 10, maxHealth: 10, attack: 5 };
        applyEnemyTier(promoted, tier);
        assert.equal(promoted.sprite, key, `${id} keeps its own art after promotion`);
    }
    keys.add(def.sprite);
}
assert.equal(keys.size, 5, 'every Frost creature has its own artwork');
assert.equal(BOSSES.frostGiant.sprite, 'frostGiant');
assert.equal(PATH_LOCATIONS.frosthollow.portrait, 'frostGiant');
const idle = pngSize('frostGiant');
const attack = BOSS_ATTACK_FRAMES.frostGiant;
assert.ok(attack);
assert.deepEqual(pngSize(attack.key), [idle[0] + attack.padX * 2, idle[1] + attack.padTop]);

let restore;
const sprite = { active: true, texture: { key: 'frostGiant' }, displayOriginX: 64, displayOriginY: 72,
    setTexture(key) { this.texture.key = key; },
    setDisplayOrigin(x, y) { this.displayOriginX = x; this.displayOriginY = y; } };
showBossAttackFrame({ textures: { exists: () => true }, time: { delayedCall(_ms, callback) { restore = callback; } } },
    { sprite, data: { sprite: 'frostGiant' } });
assert.equal(sprite.texture.key, attack.key);
assert.deepEqual([sprite.displayOriginX, sprite.displayOriginY], [80, 96]);
restore();
assert.equal(sprite.texture.key, 'frostGiant');
assert.deepEqual([sprite.displayOriginX, sprite.displayOriginY], [64, 72], 'pose swapping preserves the boss anchor');
console.log('Frost art checks passed: correct row/painted columns, all 15 tier cards, ranged/melee icons, promotion, flip/hover fallback, boss portrait and stable attack anchors.');

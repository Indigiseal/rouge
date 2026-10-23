import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ASSET_MANIFEST } from '../src/content/assets/AssetManifest.js';
import { STORMHATCH_ENEMY_DEFS, STORMHATCH_LOCATION_PACK, STORMHATCH_ENEMY_ALIASES, refreshStormCardArt } from '../src/content/location-packs/stormhatch/index.js';
import { buildEnemyCardTextures, sheetRowFor } from '../src/content/assets/enemyCards.js';
import { locationCardRow } from '../src/content/assets/locationCardArt.js';
import { applyEnemyTier } from '../src/content/balance/EnemyTiers.js';
import { buildEnemyCardFromDef, getEnemy } from '../src/content/cards/enemies.js';
import { enemyDeathSoundKeys } from '../src/content/audio/enemyDeathSounds.js';
import { BOSSES } from '../src/content/cards/bosses.js';
import { PATH_LOCATIONS } from '../src/content/locations/catalog.js';

const bossArt = ASSET_MANIFEST.find(asset => asset.key === BOSSES.tempestRoc.sprite);
assert.equal(bossArt.path, 'assets/art/lightningBoss.png');
assert.equal(bossArt.type, 'image', 'the supplied PNG is a single pose');
const bossPng = readFileSync(new URL('../' + bossArt.path, import.meta.url));
assert.deepEqual([bossPng.readUInt32BE(16), bossPng.readUInt32BE(20)], [230, 218]);
assert.equal(PATH_LOCATIONS.stormhatch.portrait, bossArt.key);
const oldBoss = { type: 'boss', name: 'Tempest Roc', sprite: 'enemyPlaceholder',
    health: 19, maxHealth: 167, attack: 17, shockedTurns: 1 };
assert.deepEqual(refreshStormCardArt(oldBoss), { ...oldBoss, name: 'Storm Archon',
    sprite: 'lightningBoss', spriteScale: 0.5, placeholderArt: false });
assert.equal(BOSSES.tempestRoc.spriteScale, 0.5);
const customBoss = { ...oldBoss, sprite: 'customBoss' };
assert.equal(refreshStormCardArt(customBoss), customBoss);

const sheet = ASSET_MANIFEST.find(asset => asset.key === 'enemyCards');
const png = readFileSync(new URL('../' + sheet.path, import.meta.url));
assert.equal(png.readUInt32BE(16), 416);
assert.ok(png.readUInt32BE(20) >= 700, 'the sheet contains the complete Storm row');
assert.equal(sheetRowFor('stormhatch'), 9);
assert.equal(locationCardRow('stormhatch'), undefined, 'enemy row must not invent missing card-flip/hover frames');

const renders = new Map();
const scene = { textures: { exists: key => ['enemyCards', 'enemyIcons'].includes(key) || renders.has(key) },
    make: { renderTexture: dimensions => {
        const draws = [];
        return { drawFrame(...args) { draws.push(args); }, saveTexture(key) { renders.set(key, { dimensions, draws }); } };
    } } };
assert.equal(buildEnemyCardTextures(scene, [STORMHATCH_LOCATION_PACK]), 15);

const artOrder = ['cloudbornGuard', 'lightningBee', 'stormGolem', 'lightningEye', 'cloudbornArcher'];
for (const [id, def] of Object.entries(STORMHATCH_ENEMY_DEFS)) {
    const column = artOrder.indexOf(id);
    assert.equal(def.sheetColumn, column);
    assert.equal(def.sprite, `enemyCard_stormhatch_${column}_normal`);
    assert.equal(def.placeholderArt, false);
    assert.equal(enemyDeathSoundKeys({ enemyType: id })[0], `death_enemy_${id}`, `${id} has its own death sound`);
    for (const [tier, faceColumn] of Object.entries({ normal: 5, veteran: 6, elite: 7 })) {
        const key = `enemyCard_stormhatch_${column}_${tier}`;
        const rendered = renders.get(key);
        assert.deepEqual([rendered.dimensions.width, rendered.dimensions.height], [52, 70]);
        assert.deepEqual(rendered.draws.slice(0, 2), [['enemyCards', 72 + faceColumn, 0, 0], ['enemyCards', 72 + column, 0, 0]]);
        assert.deepEqual(rendered.draws[3], ['enemyIcons', def.role === 'RANGED' ? 2 : 1, 36, 54]);
        const promoted = { ...def, health: 10, maxHealth: 10, attack: 5 };
        applyEnemyTier(promoted, tier);
        assert.equal(promoted.sprite, key, `${id} keeps its own art after promotion`);
    }
}

// Old saves and queued summons resolve to the creature that replaced them.
for (const [oldId, id] of Object.entries(STORMHATCH_ENEMY_ALIASES)) {
    assert.equal(getEnemy(oldId), STORMHATCH_ENEMY_DEFS[id]);
    assert.equal(buildEnemyCardFromDef(oldId, 1).enemyType, id);
}
const saved = { type: 'eliteEnemy', enemyType: 'thunderCrow', sprite: 'enemyPlaceholder',
    placeholderArt: true, health: 7, maxHealth: 40, shockedTurns: 1, sigils: [{ id: 'shock' }] };
const refreshed = refreshStormCardArt(saved);
assert.equal(refreshed.enemyType, 'lightningEye');
assert.equal(refreshed.name, 'Lightning Eye');
assert.equal(refreshed.role, 'RANGED');
assert.equal(refreshed.sprite, 'enemyCard_stormhatch_3_elite');
assert.equal(refreshed.health, 7);
assert.equal(refreshed.shockedTurns, 1);
const custom = { ...saved, sprite: 'customEnemy' };
assert.equal(refreshStormCardArt(custom), custom, 'only the generic placeholder is refreshed');
const other = { type: 'enemy', enemyType: 'goblin', sprite: 'enemyPlaceholder' };
assert.equal(refreshStormCardArt(other), other);

console.log('Storm art checks passed: sheet row 9, 15 card textures, tier promotion, death sounds and old-save upgrades.');

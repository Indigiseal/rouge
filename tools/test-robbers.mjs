import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ASSET_MANIFEST } from '../src/content/assets/AssetManifest.js';
import { buildEnemyCardTextures, sheetRowFor } from '../src/content/assets/enemyCards.js';
import { ROBBERS_ROSTER, ROBBERS_SHEET, ROBBER_DEFS } from '../src/content/cards/robbers.js';
import { buildEnemyCardFromDef, ENEMIES } from '../src/content/cards/enemies.js';
import { LOCATION_PACK_LIST } from '../src/content/location-packs/registry.js';
import { enemySigils } from '../src/content/sigils/sigils.js';

// The sheet carries their row.
const sheet = ASSET_MANIFEST.find((asset) => asset.key === 'enemyCards');
const png = readFileSync(new URL('../' + sheet.path, import.meta.url));
assert.equal(png.readUInt32BE(16), 416);
assert.ok(png.readUInt32BE(20) >= (sheetRowFor('robbers') + 1) * 70, 'the sheet is tall enough for the robbers row');
assert.equal(sheetRowFor('robbers'), 11);

// Three robbers, three tiers each, drawn from row 11 in roster order.
const renders = new Map();
const scene = { textures: { exists: (key) => ['enemyCards', 'enemyIcons'].includes(key) || renders.has(key) },
    make: { renderTexture: () => { const draws = []; return { drawFrame: (...a) => draws.push(a), saveTexture: (key) => renders.set(key, draws) }; } } };
assert.equal(buildEnemyCardTextures(scene, [ROBBERS_SHEET]), 9);
const order = ['robberCook', 'robberMuscle', 'robberLookout'];
order.forEach((id, column) => {
    const def = ROBBER_DEFS[id];
    assert.equal(def.sheetColumn, column);
    assert.equal(def.sprite, `enemyCard_robbers_${column}_normal`);
    assert.equal(def.placeholderArt, false);
    assert.deepEqual(renders.get(`enemyCard_robbers_${column}_normal`).slice(0, 2),
        [['enemyCards', 88 + 5, 0, 0], ['enemyCards', 88 + column, 0, 0]]);
});

// They are real enemies, and never on a location roster.
assert.deepEqual(Object.keys(ROBBER_DEFS), order);
for (const id of order) {
    assert.ok(ENEMIES[id], `${id} is in the enemy catalog`);
    const card = buildEnemyCardFromDef(id, 5);
    assert.ok(card.health > 0 && card.attack > 0, `${id} has stats`);
    assert.equal(card.role, ROBBER_DEFS[id].role);
    for (const pack of LOCATION_PACK_LIST) {
        assert.ok(![...(pack.enemies?.MELEE || []), ...(pack.enemies?.RANGED || [])].includes(id), `${id} is not on ${pack.id}'s roster`);
    }
}
assert.deepEqual(enemySigils(buildEnemyCardFromDef('robberCook', 5)).map((s) => s.id), ['cutpurse']);
assert.deepEqual(enemySigils(buildEnemyCardFromDef('robberMuscle', 5)).map((s) => s.id), ['crushing']);
assert.equal(buildEnemyCardFromDef('robberLookout', 5).role, 'RANGED');
console.log('Robber checks passed: sheet row 11, nine card textures, three robbers, never on a roster.');

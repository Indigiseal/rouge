import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MockScene } from '../sim/mock.js';
import { ASSET_MANIFEST } from '../src/content/assets/AssetManifest.js';
import { SANDREACH_ENEMY_DEFS, SANDREACH_LOCATION_PACK, refreshSandreachCardArt } from '../src/content/location-packs/sandreach/index.js';
import { buildEnemyCardTextures, sheetRowFor } from '../src/content/assets/enemyCards.js';
import { locationCardRow } from '../src/content/assets/locationCardArt.js';
import { BOSS_ATTACK_FRAMES, showBossAttackFrame } from '../src/content/cards/bossAttackFrames.js';
import { BOSSES } from '../src/content/cards/bosses.js';
import { PATH_LOCATIONS } from '../src/content/locations/catalog.js';
import { buildEnemyCardFromDef } from '../src/content/cards/enemies.js';
import { applyEnemyTier } from '../src/content/balance/EnemyTiers.js';
import { GameState } from '../src/systems/GameState.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { SaveManager } from '../src/managers/SaveManager.js';

const pngSize = path => {
    const png = readFileSync(new URL('../' + path, import.meta.url));
    return [png.readUInt32BE(16), png.readUInt32BE(20)];
};
const sheet = ASSET_MANIFEST.find(asset => asset.key === 'enemyCards');
const [sheetWidth, sheetHeight] = pngSize(sheet.path);
assert.equal(sheetWidth, 416);
assert.ok(sheetHeight >= 770 && sheetHeight % 70 === 0, 'sheet includes the full Sandreach row');
assert.equal(sheetRowFor('sandreach'), 10);
assert.equal(locationCardRow('sandreach'), undefined, 'enemy row does not invent absent flip or hover animation rows');

const renders = new Map();
const renderScene = { textures: { exists: key => ['enemyCards', 'enemyIcons'].includes(key) || renders.has(key) },
    make: { renderTexture: dimensions => {
        const draws = [];
        return { drawFrame(...args) { draws.push(args); }, saveTexture(key) { renders.set(key, { dimensions, draws }); } };
    } } };
assert.equal(buildEnemyCardTextures(renderScene, [SANDREACH_LOCATION_PACK]), 15);
assert.equal(buildEnemyCardTextures(renderScene, [SANDREACH_LOCATION_PACK]), 0);
const order = ['glassScarab', 'duneForager', 'sandSkirmisher', 'lizardArcher', 'sandcaller'];
for (const [column, id] of order.entries()) {
    const def = SANDREACH_ENEMY_DEFS[id];
    assert.equal(def.sheetColumn, column);
    assert.equal(def.placeholderArt, false);
    assert.equal(buildEnemyCardFromDef(id, 1).sprite, `enemyCard_sandreach_${column}_normal`);
    for (const [tier, face] of Object.entries({ normal: 5, veteran: 6, elite: 7 })) {
        const key = `enemyCard_sandreach_${column}_${tier}`, rendered = renders.get(key);
        assert.deepEqual(rendered.draws.slice(0, 2), [['enemyCards', 80 + face, 0, 0], ['enemyCards', 80 + column, 0, 0]]);
        assert.deepEqual(rendered.draws[3], ['enemyIcons', def.role === 'RANGED' ? 2 : 1, 36, 54]);
        const promoted = buildEnemyCardFromDef(id, 1);
        applyEnemyTier(promoted, tier);
        assert.equal(promoted.sprite, key);
    }
}

// The Chieftain is one idle-first strip: idle, then the swing, all on one 112x144 canvas.
const idleKey = BOSSES.sandscaleChieftain.sprite;
const poses = BOSS_ATTACK_FRAMES[idleKey];
assert.ok(poses?.sheet, 'the Chieftain attacks with a sheet');
assert.equal(PATH_LOCATIONS.sandreach.portrait, idleKey);
const [chieftainW, chieftainH] = pngSize(poses.path);
assert.equal(chieftainH, poses.frameHeight);
assert.equal(chieftainW % poses.frameWidth, 0, 'whole frames only');
assert.ok(chieftainW / poses.frameWidth >= 2, 'idle frame, then the swing');
assert.deepEqual([poses.padX, poses.padTop], [0, 0], 'idle and swing share one canvas');
const loaded = ASSET_MANIFEST.find(asset => asset.key === poses.key);
assert.equal(loaded.type, 'spritesheet');
assert.deepEqual([loaded.frameWidth, loaded.frameHeight], [112, 144]);
assert.ok(ASSET_MANIFEST.every(asset => asset.path), 'derived pose keys must not create undefined asset URLs');
assert.ok(!ASSET_MANIFEST.some(asset => asset.key === idleKey), 'the idle pose comes from the sheet, not a file of its own');
let restore, canceled = 0;
const sprite = { active: true, texture: { key: idleKey }, displayOriginX: 56, displayOriginY: 72,
    setTexture(key) { this.texture.key = key; },
    setDisplayOrigin(x, y) { this.displayOriginX = x; this.displayOriginY = y; } };
const card = { sprite, data: { sprite: idleKey } };
const scene = { textures: { exists: key => key === poses.key }, time: { delayedCall(_ms, callback) {
    restore = callback; return { remove() { canceled++; } };
} } };
showBossAttackFrame(scene, card);
assert.equal(sprite.texture.key, poses.key);
assert.deepEqual([sprite.displayOriginX, sprite.displayOriginY], [56, 72]);
showBossAttackFrame(scene, card);
assert.equal(canceled, 1, 'an extra boss attack replaces its restore timer');
assert.deepEqual([sprite.displayOriginX, sprite.displayOriginY], [56, 72]);
restore();
assert.equal(sprite.texture.key, idleKey);
assert.deepEqual([sprite.displayOriginX, sprite.displayOriginY], [56, 72], 'idle/attack keep the same anchor');

const oldEnemy = { type: 'eliteEnemy', enemyType: 'sandcaller', name: 'Sandcaller', sprite: 'enemyPlaceholder',
    health: 9, maxHealth: 37, attack: 7, frozenTurns: 1, sigils: [{ id: 'daze' }] };
const oldBoss = { type: 'boss', bossId: 'sandscaleChieftain', name: 'Sandscale Chieftain',
    sprite: 'enemyPlaceholder', health: 27, maxHealth: 167, attack: 17, shockedTurns: 1 };
assert.equal(refreshSandreachCardArt(oldEnemy).sprite, 'enemyCard_sandreach_4_elite');
assert.equal(refreshSandreachCardArt({ ...oldEnemy, enemyTier: 'veteran' }).sprite, 'enemyCard_sandreach_4_veteran');
assert.equal(refreshSandreachCardArt(oldBoss).sprite, idleKey);
const custom = { ...oldEnemy, sprite: 'customArt' };
assert.equal(refreshSandreachCardArt(custom), custom);
const otherBoss = { ...oldBoss, bossId: 'tempestRoc', name: 'Tempest Roc' };
assert.equal(refreshSandreachCardArt(otherBoss), otherBoss);
const runScene = new MockScene();
runScene.gameState = new GameState(runScene);
runScene.cardSystem = new CardSystem(runScene);
runScene.cardSystem.boardCards = [oldEnemy, oldBoss].map(data => ({ data, revealed: true }));
const saves = new SaveManager();
saves.saveCurrentRun(runScene.gameState, { slots: [] }, runScene.cardSystem);
const run = saves.loadCurrentRun();
assert.ok(run);
assert.equal(run.board.cards[0].data.sprite, 'enemyCard_sandreach_4_elite');
assert.equal(run.board.cards[1].data.sprite, idleKey);
for (const [i, source] of [oldEnemy, oldBoss].entries()) {
    for (const prop of ['health', 'maxHealth', 'attack', 'frozenTurns', 'shockedTurns', 'sigils']) {
        assert.deepEqual(run.board.cards[i].data[prop], source[prop], `Continue preserves ${prop}`);
    }
}
console.log('Sandreach art checks passed: row 10, all 15 tier cards, boss sheet pose extraction, stable attack anchor, portrait and Continue refresh.');

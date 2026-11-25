import assert from 'node:assert/strict';
import { phoenixAwake, costForVillageRank, resolveVillageEffects, PHOENIX_COST,
    normalizeVillageBuildings } from '../src/content/village/index.js';
import { SANCTUARY_STATUES } from '../src/content/sanctuary/preview.js';

// Every statue stands for a village building, one each.
assert.deepEqual(SANCTUARY_STATUES.map(s => s.building).sort(), ['armory', 'cottage', 'forge', 'healer', 'temple']);

// The Phoenix needs all four guardians.
const b = { forge: 1, armory: 1, cottage: 1, healer: 0, temple: 0 };
assert.equal(phoenixAwake(b), false);
assert.equal(phoenixAwake({ ...b, healer: 1 }), true);
assert.equal(phoenixAwake({ ...b, healer: 1, forge: 0 }), false);
assert.equal(phoenixAwake(undefined), false);

// Costs: the guardians keep the ladder, the Phoenix is one restoration at its own price.
assert.equal(costForVillageRank(0, 'forge'), 2);
assert.equal(costForVillageRank(4, 'forge'), 12);
assert.equal(costForVillageRank(0, 'temple'), PHOENIX_COST);
assert.equal(costForVillageRank(1, 'temple'), null);

// Effects: +1 DEF per armory rank for any hero, and the Phoenix revives once at half health.
for (const hero of ['rogue', 'warrior']) {
    const fx = resolveVillageEffects({ armory: 3, temple: 1 }, hero);
    assert.equal(fx.villageArmoryDef, 3);
    assert.equal(fx.villageDodge, 0);
    assert.equal(fx.templeRevive, true);
    assert.equal(fx.secondWindHealPct, 0.5);
}
assert.equal(resolveVillageEffects({ cottage: 5 }, 'rogue').villageMaxHp, 75);
assert.equal(normalizeVillageBuildings({ temple: 9 }).temple, 1);
console.log('Sanctuary checks passed: statue-to-building map, Phoenix gate, costs, DEF and revival effects.');

// The Keeper's delivery belongs only to a fresh run's opening Act 1 battle.
globalThis.Phaser = { Scene: class {} };
const { GameScene } = await import('../src/scenes/GameScene.js');
function scheduledKeeperDeliveries({ floor = 1, act = 1, roomType = 'COMBAT', rank = 1, ...flags } = {}) {
    let scheduled = 0;
    const scene = {
        ...flags,
        gameState: { currentFloor: floor, mapCursor: { act }, roomType, talentEffects: { healerRank: rank } },
        cardSystem: { cardDataGenerator: { createAmuletChoice: () => [{ id: 'testAmulet' }] } },
        time: { delayedCall: () => { scheduled++; } },
    };
    GameScene.prototype.offerHealerAmuletIfNeeded.call(scene);
    return scheduled;
}
assert.equal(scheduledKeeperDeliveries(), 1);
for (const context of [
    { floor: 2 }, { floor: 16, act: 2 }, { act: 2 }, { roomType: 'MAP' },
    { roomType: 'EVENT' }, { rank: 0 }, { shouldLoadSave: true },
    { tutorialMode: true }, { sandboxMode: true },
]) {
    assert.equal(scheduledKeeperDeliveries(context), 0, JSON.stringify(context));
}
console.log('Keeper delivery checks passed: fresh Act 1 opening combat only.');

import assert from 'node:assert/strict';
import {
  PLAYABLE_LOCATION_IDS, PATH_LOCATIONS, allRoadsForAct, roadsForAct,
  getLocationOffer, normalizeLocationOffers, applyLocationChoice,
  resolveActBossId, getLocationIdForFloor,
} from '../src/content/locations/index.js';
import { CardDataGenerator } from '../src/systems/loot/CardDataGenerator.js';
import { BOSSES, BOSS_TIERS } from '../src/content/cards/bosses.js';
import { getLocationPack } from '../src/content/location-packs/registry.js';
import { MapGenerator } from '../src/map/MapGenerator.js';
import { SaveManager } from '../src/managers/SaveManager.js';

const originalRandom = Math.random;
let seed = 87;
Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const memory = new Map();
const originalStorage = globalThis.localStorage;
globalThis.localStorage = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: key => memory.delete(key),
};
try {
  const gen = new CardDataGenerator();
  const mapGen = new MapGenerator();
  const originalBosses = JSON.stringify(BOSSES);
  for (const act of [1, 2, 3]) {
    const floor = (act - 1) * 15 + 1;
    assert.deepEqual(allRoadsForAct(act), PLAYABLE_LOCATION_IDS);
    const seen = new Set();
    for (let i = 0; i < 150; i++) {
      const offer = roadsForAct(act);
      assert.equal(offer.length, 3);
      assert.equal(new Set(offer).size, 3);
      offer.forEach(id => seen.add(id));
    }
    assert.equal(seen.size, PLAYABLE_LOCATION_IDS.length, 'every location can appear in every act');

    for (const id of PLAYABLE_LOCATION_IDS) {
      const state = { currentFloor: floor, actLocationIds: [null, null, null], dungeonMap: {} };
      state.dungeonMap[`act${act}`] = mapGen.generateAct(act, id);
      const routes = JSON.stringify(state.dungeonMap[`act${act}`].floors);
      assert.ok(applyLocationChoice(state, id, act));
      assert.equal(state.actLocationIds[act - 1], id);
      assert.equal(state.actLocationIds.filter(Boolean).length, 1, 'write only the selected act');
      assert.equal(getLocationIdForFloor(state, floor), id);
      assert.equal(state.dungeonMap[`act${act}`].bossId, PATH_LOCATIONS[id].bossId);
      assert.equal(JSON.stringify(state.dungeonMap[`act${act}`].floors), routes, 'choice must not reroll routes');
      const pack = getLocationPack(id);
      for (const role of ['MELEE', 'RANGED']) {
        assert.deepEqual(new Set(gen.getLocationEnemyPool(floor, role, state)), new Set(pack.enemies[role]));
        const enemy = gen.createEnemyCard(floor, false, role, state);
        assert.ok(pack.enemies[role].includes(enemy.enemyType));
        assert.ok(enemy.health > 0 && enemy.attack > 0);
      }
      const boss = gen.createBossCard(act * 15, state);
      const base = BOSSES[resolveActBossId(act, id)];
      assert.equal(boss.name, base.name);
      assert.equal(boss.tier, act);
      assert.ok(boss.health > 0 && boss.attack > 0);
      if (act === base.tier) {
        assert.equal(boss.health, base.health);
        assert.equal(boss.attack, base.attack);
      }
      boss.abilities[0].chance = -1;
    }
  }
  assert.equal(JSON.stringify(BOSSES), originalBosses, 'runtime bosses must not mutate templates');

  const state = { currentFloor: 1, actLocationIds: [null, null, null] };
  for (const act of [1, 2, 3]) {
    const offer = getLocationOffer(state, act);
    assert.equal(offer.length, 3);
    assert.ok(offer.every(id => !state.actLocationIds.slice(0, act - 1).includes(id)));
    assert.deepEqual(getLocationOffer(state, act), offer);
    const selected = offer[0];
    assert.ok(applyLocationChoice(state, selected, act));
    if (act < 3) {
      assert.equal(applyLocationChoice(state, selected, act + 1), false);
      assert.equal(state.actLocationIds[act], null);
    }
  }
  assert.equal(new Set(state.actLocationIds).size, 3);
  assert.equal(applyLocationChoice(state, 'missing', 1), false);
  assert.equal(applyLocationChoice(state, 'thornwake', 4), false);

  // Visited means chosen, not every door previously offered.
  const unused = getLocationOffer({ actLocationIds: ['thornwake', null, null] }, 2);
  assert.ok(!unused.includes('thornwake'));
  assert.ok(unused.every(id => PLAYABLE_LOCATION_IDS.includes(id)));
  const damagedOffers = normalizeLocationOffers([['thornwake', 'thornwake', 'silkdeep'], ['brassfair', 'duskhold', 'starfold']]);
  assert.deepEqual(damagedOffers, [null, null, null]);

  const saving = { currentFloor: 16, roomType: 'COMBAT', actLocationIds: ['thornwake', null, null] };
  const doors = getLocationOffer(saving, 2);
  const saves = new SaveManager();
  saves.saveCurrentRun(saving, null, null);
  const loaded = saves.loadCurrentRun();
  assert.ok(loaded);
  assert.deepEqual(loaded.player.locationOffers[1], doors);
  assert.deepEqual(getLocationOffer(loaded.player, 2), doors, 'Continue preserves door ids and order');
  const old = saves.migrateRun({ ...structuredClone(loaded), saveVersion: '1.0.7', player: {
    ...loaded.player, actLocationIds: ['tollroad', 'brassfair', 'starfold'], locationOffers: undefined,
  } });
  assert.deepEqual(old.player.actLocationIds, ['tollroad', 'brassfair', 'starfold']);
  assert.deepEqual(old.player.locationOffers, [null, null, null]);

  const legacy = { actLocationIds: ['thornwake', null, null], dungeonMap: { act1: { bossId: 'goblinKing' } } };
  assert.equal(gen.createBossCard(15, legacy).name, BOSSES.goblinKing.name, 'preserve legacy planned identity');
  const randomLegacyBoss = gen.createBossCard(30);
  assert.ok(BOSS_TIERS[2].some(id => BOSSES[id].name === randomLegacyBoss.name), 'no-state legacy callers retain tier rolls');
  const early = gen.createBossCard(15, { actLocationIds: ['boneflood'] });
  const late = gen.createBossCard(45, { actLocationIds: [null, null, 'boneflood'] });
  assert.ok(late.health > early.health && late.attack > early.attack);
  console.log(`Any-act location checks passed: ${PLAYABLE_LOCATION_IDS.length * 3} location/act combinations, local enemies and bosses, no repeats, fixed offers, saved doors, and legacy maps.`);
} finally {
  Math.random = originalRandom;
  globalThis.localStorage = originalStorage;
}

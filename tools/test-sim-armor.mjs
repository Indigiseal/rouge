import assert from 'node:assert/strict';
import { MockScene } from '../sim/mock.js';
import { GameState } from '../src/systems/GameState.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { createArmorCardData, ARMORS, ARMOR_RARITIES, armorDurability } from '../src/content/cards/armor.js';
import { compareArmor } from '../sim/armor-selection.js';
import { parseSimFlags } from '../sim/parse-sim-flags.js';
import { installSeededRandom, restoreNativeRandom } from '../sim/rng.js';

for (const type of Object.keys(ARMORS)) {
  assert.deepEqual(parseSimFlags([`--armor-pool=${type}`]).armorPool, [type]);
}
assert.deepEqual(parseSimFlags(['--armor-pool=both']).armorPool, ['chain', 'plate']);
assert.deepEqual(parseSimFlags(['--armor-pool=all']).armorPool, Object.keys(ARMORS));
assert.equal(parseSimFlags([]).armorPool, null, 'default uses the live class pool');

const mock = new MockScene();
const gs = new GameState(mock);
mock.gameState = gs;
mock.cardSystem = new CardSystem(mock);
const gen = mock.cardSystem.cardDataGenerator;
installSeededRandom(777);
try {
  // Sample the real generator through the same scene used by simulated runs.
  const early = {};
  for (let i = 0; i < 2000; i++) {
    const card = gen.createCardData('armor', 1, false, gs);
    early[card.armorType] = (early[card.armorType] || 0) + 1;
  }
  assert.deepEqual(Object.keys(early).sort(), ['leather', 'padded']);
  assert.ok(early.padded > 1250 && early.padded < 1550, 'early drops follow the 70% padded weight');
  const later = new Set();
  for (let i = 0; i < 500; i++) later.add(gen.createCardData('armor', 35, false, gs).armorType);
  assert.deepEqual([...later].sort(), Object.keys(ARMORS).sort());

  gs.armorPool = parseSimFlags(['--armor-pool=padded']).armorPool;
  for (const rarity of ARMOR_RARITIES) {
    const armor = createArmorCardData('padded', rarity);
    assert.equal(armor.protection, ARMORS.padded[rarity].protection);
    assert.equal(armor.durability, armorDurability('padded', rarity));
    assert.ok(!armor.dodgeChance && !armor.meleeCounterChance && !armor.rangedIgnoreChance);
  }
  for (let i = 0; i < 50; i++) assert.equal(gen.createCardData('armor', 35, false, gs).armorType, 'padded');

  // Stable input order must never keep padded ahead of equal-DEF special armor.
  for (const type of ['chain', 'plate']) {
    const padded = createArmorCardData('padded', 'common');
    const upgrade = createArmorCardData(type, 'common');
    assert.equal([padded, upgrade].sort(compareArmor)[0], upgrade);
    assert.equal([upgrade, padded].sort(compareArmor)[0], upgrade);
    upgrade.durability = 0;
    assert.equal([upgrade, padded].sort(compareArmor)[0], padded);
  }
  const fresh = createArmorCardData('padded', 'common');
  const worn = { ...fresh, durability: 1 };
  assert.equal([worn, fresh].sort(compareArmor)[0], fresh);

  // Padded actually blocks and wears down in the sim's shared damage resolver.
  gs.armorPool = null;
  gs.equippedArmor = createArmorCardData('padded', 'common');
  gs.playerHealth = gs.maxHealth = 50;
  const pips = gs.equippedArmor.durability;
  Math.random = () => 0.99; // no base dodge/block proc
  gs.takeDamage(5, -1, 'enemy');
  assert.equal(gs.playerHealth, 46);
  assert.equal(gs.equippedArmor.durability, pips - 1);
} finally {
  restoreNativeRandom();
}
console.log('Sim armor checks passed: pools, weighted drops, padded stats/combat and equipment ranking.');

const { projectedArmorStats } = await import('../sim/projected-armor.js');
for (const protection of [1, 2, 4, 6]) {
    const defense = { armor: { protection }, magicShieldTurns: 1, magicShieldMultiplier: 1.2 };
    assert.equal(projectedArmorStats(defense).protection, Math.max(protection + 1, Math.ceil(protection * 1.2)));
    defense.magicShieldTurns = 0;
    assert.equal(projectedArmorStats(defense).protection, protection);
}
const dodgeDefense = { armor: { protection: 0, dodgeChance: 0.1 }, magicShieldTurns: 1, magicShieldMultiplier: 1.2 };
assert.equal(projectedArmorStats(dodgeDefense).dodge, 0.4);
dodgeDefense.magicShieldTurns = 0;
assert.equal(projectedArmorStats(dodgeDefense).dodge, 0.1, 'expired forecast shield must not keep the live dodge buff');
console.log('Forecast armor uses live shield rounding and consumes its own shield duration.');

// Mace joins the shared loot pool in Act 3, alongside the axe.
installSeededRandom(777);
try {
    gs.armorPool = null;
    const types = new Set();
    for (let i = 0; i < 1200; i++) {
        assert.notEqual(gen.createCardData('weapon', 30, false, gs).weaponType, 'mace');
        types.add(gen.createCardData('weapon', 31, false, gs).weaponType);
    }
    assert(types.has('mace'), 'mace is available to simulated Act 3 loot');
} finally { restoreNativeRandom(); }
console.log('Mace availability checked across the Act 3 spawn boundary.');

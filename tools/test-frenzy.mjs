// The Cerberus frenzy (content/combat/frenzy.js): now and then all three heads
// bite, each harder; every bite is a whole hit, so armor spends a pip on each.
import assert from 'node:assert/strict';
import { MockScene } from '../sim/mock.js';
import { GameState } from '../src/systems/GameState.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { AmuletManager } from '../src/managers/AmuletManager.js';
import { BOSSES } from '../src/content/cards/bosses.js';
import { frenzyAbility, frenzyBiteDamage, rollFrenzy } from '../src/content/combat/frenzy.js';

// Both Cerberus bosses have it, a surprise rather than every turn.
for (const id of ['cerberus', 'ancientCerberus']) {
    const ability = frenzyAbility(BOSSES[id]);
    assert.ok(ability, `${id} can frenzy`);
    assert.ok(ability.chance > 0 && ability.chance < 1, `${id}: a frenzy is a surprise, not every turn`);
    assert.equal(ability.bites.length, 3, `${id}: one bite per head`);
    assert.ok(ability.bites[0] < ability.bites[1] && ability.bites[1] < ability.bites[2], `${id}: each bite harder`);
}
const bites = (id) => frenzyAbility(BOSSES[id]).bites.map((share) => frenzyBiteDamage(BOSSES[id].attack, share));
assert.deepEqual(bites('cerberus'), [5, 7, 9]);
assert.deepEqual(bites('ancientCerberus'), [8, 10, 12]);

// The roll: never while frozen or dead, never for a boss without it.
assert.equal(rollFrenzy({ ...BOSSES.cerberus, frozen: 1 }, () => 0), null);
assert.equal(rollFrenzy({ ...BOSSES.cerberus, health: 0 }, () => 0), null);
assert.equal(rollFrenzy(BOSSES.giantSkeleton, () => 0), null);
assert.deepEqual(rollFrenzy(BOSSES.cerberus, () => 0), frenzyAbility(BOSSES.cerberus).bites);
assert.equal(rollFrenzy(BOSSES.cerberus, () => 0.99), null);

// In a fight (the sim's enemy turn, which mirrors CombatTurnController): a frenzy
// turn lands three hits, so armor loses three pips in one enemy turn.
function fight() {
    const mock = new MockScene();
    const gs = new GameState(mock);
    mock.gameState = gs;
    mock.amuletManager = new AmuletManager(mock);
    mock.cardSystem = new CardSystem(mock);
    gs.currentFloor = 30;
    gs.playerHealth = gs.maxHealth = 200;
    gs.equippedArmor = { type: 'armor', name: 'Test Armor', protection: 2, durability: 10, maxDurability: 10 };
    const boss = { ...BOSSES.cerberus, abilities: [frenzyAbility(BOSSES.cerberus)], sigils: [], maxHealth: BOSSES.cerberus.health };
    mock.cardSystem.boardCards = [{ revealed: true, data: boss, sprite: mock.add.image(320, 120, 'Cerberus') }];
    return { mock, gs };
}
const realRandom = Math.random;
try {
    Math.random = () => 0.2; // frenzies (< 1/3), no crit, no dodge, no burn
    const { mock, gs } = fight();
    const hp = gs.playerHealth;
    mock.runEnemyTurn();
    assert.equal(gs.equippedArmor?.durability, 7, 'three bites, three armor pips');
    assert.equal(hp - gs.playerHealth, (5 - 2) + (7 - 2) + (9 - 2), 'each bite blocked by the armor on its own');

    Math.random = () => 0.9; // no frenzy: one ordinary hit
    const plain = fight();
    plain.mock.runEnemyTurn();
    assert.equal(plain.gs.equippedArmor?.durability, 9, 'an ordinary turn is one hit, one pip');
} finally {
    Math.random = realRandom;
}
console.log('Frenzy: both Cerberus bosses bite 3x (5/7/9, 8/10/12) on a surprise turn; armor blocks and wears per bite.');

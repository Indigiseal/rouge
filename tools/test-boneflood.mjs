import assert from 'node:assert/strict';
import { MockScene } from '../sim/mock.js';
import { GameState } from '../src/systems/GameState.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { CombatTurnController } from '../src/systems/combat/CombatTurnController.js';
import { enterBonePile, advanceBonePile, repairBoneArmor, summonAtHealthThresholds } from '../src/content/combat/boneflood.js';
import { buildEnemyCardFromDef } from '../src/content/cards/enemies.js';
import { getEnemyHitAttack } from '../src/content/combat/enemyAttack.js';
import { BOSSES } from '../src/content/cards/bosses.js';
import { SaveManager } from '../src/managers/SaveManager.js';

const card = data => ({ data, revealed: true });
const warden = card(buildEnemyCardFromDef('cryptWarden', 1));
assert.equal(warden.data.armor, 2);
assert.equal(getEnemyHitAttack(warden, [warden]), warden.data.attack + 2);
warden.data.armor = 0;
assert.equal(getEnemyHitAttack(warden, [warden]), warden.data.attack);
const mender = card(buildEnemyCardFromDef('skullLobber', 1));
const beforeHP = warden.data.health;
assert.equal(repairBoneArmor(mender, [mender, warden], () => 0)[0].card, warden);
assert.equal(warden.data.armor, 1);
repairBoneArmor(mender, [mender, warden], () => 0);
assert.equal(warden.data.armor, 2);
assert.equal(warden.data.health, beforeHP, 'repair must not become bog-style healing');
assert.deepEqual(repairBoneArmor(mender, [mender, warden]), []);
warden.data.armor = 0; warden.revealed = false;
assert.deepEqual(repairBoneArmor(mender, [mender, warden]), []);
warden.revealed = true; warden.data.health = 0;
assert.deepEqual(repairBoneArmor(mender, [mender, warden]), []);

const boss = structuredClone(BOSSES.giantSkeleton);
boss.maxHealth = boss.health;
const bossCard = card(boss);
boss.armor = 0;
repairBoneArmor(bossCard, [bossCard]);
assert.equal(boss.armor, 1);
repairBoneArmor(bossCard, [bossCard]);
repairBoneArmor(bossCard, [bossCard]);
assert.equal(boss.armor, 2, 'boss cannot grow armor indefinitely');
const summon = boss.abilities.find(ability => ability.type === 'summon');
assert.deepEqual(summon.thresholds, [0.7, 0.35]);
let spawned = 0;
boss.health = boss.maxHealth;
assert.equal(summonAtHealthThresholds(boss, summon, () => { spawned++; return true; }), 0);
boss.health = Math.floor(boss.maxHealth * 0.65);
assert.equal(summonAtHealthThresholds(boss, summon, () => false), 0);
assert.deepEqual(boss.summonThresholdsSpent, [], 'full board must not consume a threshold');
assert.equal(summonAtHealthThresholds(boss, summon, () => { spawned++; return true; }), 1);
const loadedBoss = JSON.parse(JSON.stringify(boss));
assert.equal(summonAtHealthThresholds(loadedBoss, summon, () => { throw new Error('duplicate summon'); }), 0);
loadedBoss.health = Math.floor(boss.maxHealth * 0.3);
assert.equal(summonAtHealthThresholds(loadedBoss, summon, () => { spawned++; return true; }), 1);
assert.equal(summonAtHealthThresholds(loadedBoss, summon, () => { throw new Error('third summon'); }), 0);
assert.equal(spawned, 2);
const crossedBoth = { ...structuredClone(BOSSES.giantSkeleton), health: 1, maxHealth: 89 };
assert.equal(summonAtHealthThresholds(crossedBoth, summon, () => true), 2);

const heap = buildEnemyCardFromDef('boneHeap', 1);
const fullHP = heap.maxHealth;
heap.health = 0;
assert.equal(enterBonePile(heap), true);
assert.equal(heap.health, 1);
assert.equal(heap.attack, 0);
assert.equal(enterBonePile(heap), false, 'pile cannot collapse again');
assert.equal(advanceBonePile(heap), false, 'killing action leaves a chance to finish the pile');
const restoredPile = JSON.parse(JSON.stringify(heap));
assert.equal(advanceBonePile(restoredPile), true);
assert.equal(restoredPile.health, Math.ceil(fullHP / 2));
restoredPile.health = 0;
assert.equal(enterBonePile(restoredPile), false, 'reassembly is once only');
heap.health = 0;
assert.equal(advanceBonePile(heap), false, 'destroyed piles cannot return');

// Exercise real death handling: first defeat does not pay kills or clear the
// room. Final destruction does, and serializing the pile preserves its state.
const scene = new MockScene();
scene.gameState = new GameState(scene);
scene.cardSystem = new CardSystem(scene);
scene.gameState.currentFloor = 1;
let kills = 0, clears = 0;
scene.amuletManager = { processEnemyKill() { kills++; } };
scene.onEnemiesCleared = () => { clears++; scene.enemiesCleared = true; };
const target = { data: buildEnemyCardFromDef('boneHeap', 1), revealed: true,
    sprite: scene.add.image(200, 100, 'enemy'), restX: 200, restY: 100 };
scene.cardSystem.boardCards = [target];
target.data.health = 0;
scene.cardSystem.removeDefeatedEnemy(0, target);
assert.equal(kills, 0);
assert.equal(clears, 0);
assert.equal(scene.cardSystem.boardCards[0], target);
const saved = new SaveManager().serializeBoardCards([target]);
assert.equal(saved[0].data.isBonePile, true);
assert.equal(saved[0].data.reassemblyTurns, 1);
assert.ok(saved[0].data.reassemblyBody.attack > 0);
target.data.health = 0;
scene.cardSystem.removeDefeatedEnemy(0, target);
assert.equal(kills, 1);
assert.equal(clears, 1);
assert.equal(scene.cardSystem.boardCards[0], null);

// Return timing through the actual enemy queue: no immediate attack on return.
const timing = new MockScene();
timing.gameState = new GameState(timing);
timing.cardSystem = new CardSystem(timing);
const pile = { data: buildEnemyCardFromDef('boneHeap', 1), revealed: true, sprite: timing.add.image(0, 0, 'heap') };
pile.data.health = 0;
enterBonePile(pile.data);
timing.cardSystem.boardCards = [pile];
const controller = new CombatTurnController(timing);
controller.tickHandWebs = () => {};
controller.finishEnemyTurnEffects = () => {};
let attacks = 0;
controller.processEnemyAttack = () => { attacks++; };
controller.revealedEnemiesAttack();
assert.equal(pile.data.isBonePile, true);
controller.revealedEnemiesAttack();
assert.equal(pile.data.isBonePile, false);
assert.equal(attacks, 0);
controller.revealedEnemiesAttack();
assert.equal(attacks, 1);

// Verify that the real queue dispatches threshold summons rather than the
// old random/pity path, including when a boss is frozen.
const thresholdBoss = { data: { ...structuredClone(BOSSES.giantSkeleton), maxHealth: 89, health: 60, frozen: 1 },
    revealed: true, sprite: timing.add.image(0, 0, 'boss') };
timing.cardSystem.boardCards = [thresholdBoss];
let queuedSummons = 0;
timing.cardSystem.summonEnemy = () => { queuedSummons++; return true; };
controller.revealedEnemiesAttack();
controller.revealedEnemiesAttack();
assert.equal(queuedSummons, 1);
thresholdBoss.data.health = 20;
controller.revealedEnemiesAttack();
controller.revealedEnemiesAttack();
assert.equal(queuedSummons, 2);

for (const id of ['skeleton', 'skeleton_archer']) {
    const data = buildEnemyCardFromDef(id, 1);
    assert.deepEqual(data.features, []);
    assert.equal(data.sigils, undefined);
}
console.log('Boneflood checks passed: armor/attack synergy, capped mending, finite threshold summons, save state, bone-pile timing, exactly-once kills and floor clear.');

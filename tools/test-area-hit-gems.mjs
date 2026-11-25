// A weapon's gem goes off once per swing, on the enemy aimed at. The blow's
// extra hits (sword cleave here, through the live InventoryCombatUse code) are
// plain half-damage hits. They used to set the gem off again each: one
// lightning swing at three enemies in a row landed nine zaps, three on each.
import assert from 'node:assert/strict';
import { MockScene } from '../sim/mock.js';
import { GameState } from '../src/systems/GameState.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { InventoryCombatUse } from '../src/systems/inventory/InventoryCombatUse.js';

const randomBefore = Math.random;
const scene = new MockScene();
scene.gameState = new GameState(scene);
const cs = new CardSystem(scene);
scene.cardSystem = cs;
const faceUp = () => Object.assign(scene.add.image(), { texture: { key: 'enemyCard' } });
const row = () => [0, 1, 2].map((c) => ({
  revealed: true, sprite: faceUp(),
  data: { type: 'enemy', name: `E${c}`, role: 'MELEE', health: 60, maxHealth: 60, armor: 0, features: [], brick: { r: 0, c } },
}));
const gemHits = [];
const realGemTarget = cs.damageGemTarget.bind(cs);
cs.damageGemTarget = (i, ...rest) => { gemHits.push(i); return realGemTarget(i, ...rest); };
const sword = { type: 'weapon', weaponType: 'sword', name: 'Sword', damage: 6, durability: 9, maxDurability: 9, special: 'cleave', gemEffect: 'lightning', gemCount: 1, sigils: [] };

try {
  // No evade, block, crit or enchant: the numbers are the rule's own.
  Math.random = () => 0.999;
  cs.boardCards = row();
  cs.attackEnemy(1, 6, false, sword, false);
  InventoryCombatUse.applySwordCleave.call({ scene, applyAssassinateTalent() {} }, 1, 6, sword);
  // The lightning hops land on a timer.
  await new Promise((resolve) => setTimeout(resolve, 2500));
  assert.equal(gemHits.length, 3, `one zap per enemy, got ${gemHits.length}`);
  assert.deepEqual([...gemHits].sort(), [0, 1, 2]);
  // The cleave still lands its half on both neighbours.
  assert.ok(cs.boardCards[0].data.health < 60 && cs.boardCards[2].data.health < 60, 'cleave hits the sides');

  // A fire gem: one Fire on the target, not one per cleave hit.
  gemHits.length = 0;
  cs.boardCards = row();
  const fireSword = { ...sword, gemEffect: 'fire' };
  cs.attackEnemy(1, 6, false, fireSword, false);
  InventoryCombatUse.applySwordCleave.call({ scene, applyAssassinateTalent() {} }, 1, 6, fireSword);
  await new Promise((resolve) => setTimeout(resolve, 1500));
  assert.ok(gemHits.filter((i) => i === 0).length <= 1 && gemHits.filter((i) => i === 2).length <= 1, `fire splashed once: ${gemHits}`);

  console.log('area hit gems: ok');
} finally {
  Math.random = randomBefore;
}

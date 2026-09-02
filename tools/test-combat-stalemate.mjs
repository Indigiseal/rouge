// A weapon in the pack is not a way out of the floor. Locks the rule that
// attackEnemy and the stalemate detector share one answer to "can this weapon
// hurt anything here" — when they disagreed, a bow-only rogue meeting a Thorn
// Sprite froze the board: no damage possible, no Next button, no enemy turns.
import assert from 'node:assert/strict';
import { weaponCanDamageEnemy } from '../src/systems/board/BoardCombat.js';
import { CombatTurnController } from '../src/systems/combat/CombatTurnController.js';

const bow = { type: 'weapon', weaponType: 'bow', range: 'ranged', durability: 5 };
const dagger = { type: 'weapon', weaponType: 'dagger', range: 'melee', durability: 4 };
const sprite = (revealed = true) => ({
  revealed,
  data: { type: 'enemy', enemyType: 'thornSprite', health: 6, features: ['ranged_immune'] },
});
const wolf = (revealed = true) => ({
  revealed,
  data: { type: 'enemy', enemyType: 'wolf', health: 8, features: [] },
});

// --- the shared predicate
assert.equal(weaponCanDamageEnemy(bow, sprite()), false, 'bows must not hurt a ranged-immune enemy');
assert.equal(weaponCanDamageEnemy(dagger, sprite()), true, 'melee still connects with a ranged-immune enemy');
assert.equal(weaponCanDamageEnemy(bow, wolf()), true, 'bows hurt ordinary enemies');

// --- the detector
function stalemate({ board, inventory, equippedWeapon = null }) {
  const scene = {
    _transitioning: false,
    enemiesCleared: false,
    gameState: { playerHealth: 100, equippedWeapon, inventory },
    cardSystem: { boardCards: board },
    inventorySystem: { slots: inventory },
    isEnemyCard: (card) => card?.data?.type === 'enemy' || card?.data?.type === 'boss',
  };
  return new CombatTurnController(scene).hasCombatStalemate();
}

assert.equal(
  stalemate({ board: [sprite()], inventory: [bow, bow] }),
  true,
  'a quiver of bows against a lone ranged-immune enemy is a dead position',
);
assert.equal(
  stalemate({ board: [sprite()], inventory: [bow, dagger] }),
  false,
  'one melee weapon is a way out',
);
assert.equal(
  stalemate({ board: [sprite(), wolf()], inventory: [bow] }),
  false,
  'another hittable enemy on the board is a way out',
);
assert.equal(
  stalemate({ board: [sprite()], inventory: [bow, { type: 'magic', magicType: 'fireball' }] }),
  false,
  'magic is a way out',
);
assert.equal(
  stalemate({ board: [sprite(), { revealed: true, data: { type: 'weapon' } }], inventory: [bow] }),
  false,
  'a non-enemy card still on the board can hand over a way out',
);
assert.equal(
  stalemate({ board: [sprite(), sprite(false)], inventory: [bow] }),
  false,
  'a face-down card can still be flipped for free',
);
assert.equal(
  stalemate({ board: [wolf()], inventory: [bow] }),
  false,
  'an ordinary board with a usable bow is not a stalemate',
);
assert.equal(
  stalemate({ board: [sprite()], inventory: [], equippedWeapon: dagger }),
  false,
  'the equipped weapon counts even when the pack is empty',
);

console.log('Combat stalemate and weapon-immunity checks passed.');

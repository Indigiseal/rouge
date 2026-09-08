// A weapon in the pack is not a way out of the floor. Locks the rule that
// attackEnemy and the stalemate detector share one answer to "can this weapon
// hurt anything here" — when they disagreed, a bow-only rogue meeting a Thorn
// Sprite froze the board: no damage possible, no Next button, no enemy turns.
import assert from 'node:assert/strict';
import { CardSystem } from '../src/systems/CardSystem.js';
import { BoardCombat, weaponCanDamageEnemy } from '../src/systems/board/BoardCombat.js';
import { CombatTurnController } from '../src/systems/combat/CombatTurnController.js';
import {
  CHARACTER_IDS,
  normalizeCharacterId,
  resolveArmorSpawnTypes,
} from '../src/content/characters/CharacterClasses.js';
import {
  createWeaponCardData,
  axeHeavyCleaveTargetIndices,
  isWeaponSpawnableAtFloor,
  spearPierceTargetIndices,
  swordCleaveTargetIndices,
  weaponIgnoresFrontline,
} from '../src/content/cards/weapons.js';

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

// --- single unrestricted hero and legacy save migration
assert.deepEqual(CHARACTER_IDS, ['rogue']);
assert.equal(normalizeCharacterId('warrior'), 'rogue');
assert.deepEqual(resolveArmorSpawnTypes('rogue'), ['leather', 'chain', 'plate']);

// BoardCombat's functions are bound to the CardSystem facade. Every internal
// helper called through `this` therefore needs a facade method too; without
// these two, a normal hit mutated HP/durability and then threw before either
// value could be redrawn.
assert.equal(typeof CardSystem.prototype.applyPoisonGemStacks, 'function');
assert.equal(typeof CardSystem.prototype.splashPoisonGem, 'function');
assert.equal(typeof CardSystem.prototype.isActiveBoardTaunter, 'function');

const tauntProbe = new BoardCombat({
  isEnemyType: (type) => type === 'enemy' || type === 'boss',
  _isCardBackTexture: (texture) => texture === 'cardBack' || String(texture).startsWith('cardFlip'),
});
const taunter = {
  revealed: true,
  sprite: { scene: {}, texture: { key: 'silkHusk' } },
  data: { type: 'enemy', health: 5, features: ['taunt'] },
};
assert.equal(tauntProbe.isActiveBoardTaunter(taunter), true, 'a live face-up taunter constrains primary targeting');
assert.equal(
  tauntProbe.isActiveBoardTaunter({ ...taunter, data: { ...taunter.data, isCocoon: true } }),
  false,
  'an unopened cocoon shell does not provoke',
);

// --- the shared predicate
assert.equal(weaponCanDamageEnemy(bow, sprite()), false, 'bows must not hurt a ranged-immune enemy');
assert.equal(weaponCanDamageEnemy(dagger, sprite()), true, 'melee still connects with a ranged-immune enemy');
assert.equal(weaponCanDamageEnemy(bow, wolf()), true, 'bows hurt ordinary enemies');

// --- spear spawn and column piercing
const spear = createWeaponCardData('spear', 'common');
assert.equal(isWeaponSpawnableAtFloor('spear', 'common', 11), false, 'common spears stay locked before floor 12');
assert.equal(isWeaponSpawnableAtFloor('spear', 'common', 12), true, 'common spears spawn from floor 12');
assert.equal(spear.special, 'pierce');
assert.equal(weaponIgnoresFrontline(spear), true, 'piercing spears can select the back line');
const columnEnemy = (r, c = 2, revealed = true) => ({
  revealed,
  data: { type: 'enemy', health: 10, brick: { r, c } },
});
assert.deepEqual(
  spearPierceTargetIndices([
    columnEnemy(2),       // selected front enemy
    columnEnemy(0),       // furthest enemy in the same column
    columnEnemy(1),       // next enemy in the same column
    columnEnemy(1, 3),    // another column
    columnEnemy(-1, 2, false), // hidden enemy
    columnEnemy(3),       // closer to the player, not behind the target
  ], 0),
  [2, 1],
  'piercing continues through revealed enemies behind the target, nearest first',
);

// --- sword cleave adjacency
assert.deepEqual(
  swordCleaveTargetIndices([
    columnEnemy(1, 2), // selected target
    columnEnemy(1, 1), // immediate left
    columnEnemy(1, 3), // immediate right
    columnEnemy(1, 4), // two cells away
    columnEnemy(0, 2), // above
    columnEnemy(1, 3, false), // hidden duplicate position
  ], 0),
  [1, 2],
  'cleave hits only revealed enemies immediately left and right of its target',
);

assert.deepEqual(
  axeHeavyCleaveTargetIndices([
    columnEnemy(3, 2), // selected target
    columnEnemy(1, 2), // two cells above: outside the cross
    columnEnemy(2, 2), // immediately above: 50%
    columnEnemy(4, 2), // immediately below: 50%
    columnEnemy(3, 1), // immediately left: 50%
    columnEnemy(3, 3), // immediately right: 50%
    columnEnemy(3, 4), // two cells right: outside the cross
  ], 0),
  { vertical: [2, 3], sides: [4, 5] },
  'heavy cleave hits the four adjacent cells in a cross around its target',
);

const bossFormationEnemy = (x, y, type = 'enemy') => ({
  revealed: true,
  restX: x,
  restY: y,
  data: { type, health: 10 },
});
const bossFormation = [
  bossFormationEnemy(280, 145), // selected summon
  bossFormationEnemy(220, 145), // summon to the left
  bossFormationEnemy(340, 145), // summon to the right
  bossFormationEnemy(300, 80, 'boss'), // boss behind the selected summon
  bossFormationEnemy(300, 20, 'boss'), // farther target in the same column
];
assert.deepEqual(
  spearPierceTargetIndices(bossFormation, 0),
  [3, 4],
  'spear passes through the full boss column behind a summon',
);
assert.deepEqual(
  swordCleaveTargetIndices(bossFormation, 0),
  [1, 2],
  'sword cleaves into adjacent summons in a boss row',
);
assert.deepEqual(
  axeHeavyCleaveTargetIndices(bossFormation, 0),
  { vertical: [3], sides: [1, 2] },
  'axe cross includes adjacent summons and the boss behind them',
);

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

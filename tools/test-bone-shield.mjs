import assert from 'node:assert/strict';
import { consumeBoneShield } from '../src/content/combat/boneShield.js';
import { CombatTurnController } from '../src/systems/combat/CombatTurnController.js';
import { getMagic } from '../src/content/cards/magic.js';
import { cardSigils } from '../src/content/sigils/sigils.js';
import { getWeaponEnchant } from '../src/content/balance/WeaponEnchants.js';
import { SaveManager } from '../src/managers/SaveManager.js';

const state = { boneWall: 2 };
assert.equal(consumeBoneShield(state, 0), false);
assert.equal(state.boneWall, 2);
assert.equal(consumeBoneShield(state, 5), true);
assert.equal(state.riposteReady, true);
assert.equal(consumeBoneShield(state, 5), true);
assert.equal(consumeBoneShield(state, 5), false);

const effects = [], reflected = [];
const scene = {
    tutorialMode: true,
    game: {}, cache: { audio: { exists: () => false } },
    gameState: { playerHealth: 50, maxHealth: 50, boneWall: 2, coins: 20,
        addPlayerEffect(effect) { effects.push(effect); },
        takeDamage(amount) { this.playerHealth -= amount; return { actualDamage: amount, tookDamage: false, dodged: false }; },
    },
    playerAvatar: { x: 30, y: 50 },
    cardSystem: { boardCards: [], updateEnemyInfoText() {}, attackEnemy(...args) { reflected.push(args); }, removeFrozenFrame() {} },
    createFloatingText() {}, createDamageEffect() {}, updateUI() {},
};
const controller = new CombatTurnController(scene);
controller.applyThornsDamage = () => {};
const attacker = (extra = {}) => ({ revealed: true, sprite: { x: 100, y: 100, clearTint() {} },
    data: { type: 'enemy', health: 20, maxHealth: 20, attack: 5, features: [], ...extra },
});
const originalRandom = Math.random;
Math.random = () => 0.99;
try {
    const frozen = attacker({ frozen: 1 });
    controller.processEnemyAttack(frozen, 0);
    assert.equal(scene.gameState.boneWall, 2, 'frozen creatures do not spend charges');
    controller.processEnemyAttack(attacker({ dazed: true }), 0);
    assert.equal(scene.gameState.boneWall, 2, 'a missed attack does not spend a charge');
    const poisoner = attacker({ abilities: [{ type: 'poison', damage: 2, turns: 3 }], features: ['coin_steal'] });
    controller.processEnemyAttack(poisoner, 0);
    controller.processEnemyAttack(attacker(), 1);
    assert.equal(scene.gameState.boneWall, 0);
    assert.equal(scene.gameState.playerHealth, 50);
    assert.equal(scene.gameState.coins, 20, 'blocked attacks do not steal coins');
    assert.equal(effects.length, 0, 'blocked attacks do not apply poison');
    assert.equal(reflected.length, 0, 'blocking must not hurt the attacker');
    controller.processEnemyAttack(attacker(), 2);
    assert.equal(scene.gameState.playerHealth, 45, 'the third individual attack gets through');
} finally { Math.random = originalRandom; }

assert.match(getMagic('boneWall').description, /Blocks the next 2/);
assert.match(getWeaponEnchant('boneWall').summary, /^block/);
const oldSpell = { type: 'magic', magicType: 'boneWall', description: 'Reflects the next 2 enemy attacks', sprite: 'boneWall' };
const refreshed = new SaveManager().refreshMagicCard(oldSpell);
assert.match(refreshed.description, /^Blocks/);
assert.equal(oldSpell.description, 'Reflects the next 2 enemy attacks', 'migration must not mutate the source record');
assert.equal(refreshed.sprite, oldSpell.sprite);
assert.ok(cardSigils({ type: 'weapon', enchant: 'boneWall' }).some(s => s.id === 'bulwark'));
assert.ok(!cardSigils({ type: 'weapon', enchant: 'boneWall' }).some(s => s.id === 'mirror'));
console.log('Bone Shield checks passed: two individual blocks, no reflection/riders, frozen/missed attacks, third attack, Riposte, and enchant descriptions.');

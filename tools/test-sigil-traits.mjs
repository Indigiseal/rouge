// Sigils that stand for a rule the game already had:
// - Bulwark and Briar Guard, stamped on a weapon, roll the Bone Wall and
//   Briar Shield enchants at those spells' chance (one roll a swing; the
//   weapon's own enchant comes first);
// - Taunt, Veil, Barkskin and Rally on an enemy act as the old traits
//   (taunt, veil_flip, ranged_immune, goblin_rally) do.
import assert from 'node:assert/strict';
import { MockScene } from '../sim/mock.js';
import { GameState } from '../src/systems/GameState.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { getSigil, hasEnemyTrait, WORKING_PLAYER_SIGILS } from '../src/content/sigils/sigils.js';
import { getEnchantChance } from '../src/content/balance/WeaponEnchants.js';
import { weaponCanDamageEnemy } from '../src/systems/board/BoardCombat.js';

const randomBefore = Math.random;
const scene = new MockScene();
scene.gameState = new GameState(scene);
const cs = new CardSystem(scene);
scene.cardSystem = cs;

const sword = (extra = {}) => ({ type: 'weapon', weaponType: 'sword', name: 'Sword', damage: 5, durability: 5, maxDurability: 5, sigils: [], ...extra });
const bow = { type: 'weapon', weaponType: 'bow', name: 'Bow', damage: 3, durability: 5, maxDurability: 5, range: 'ranged', sigils: [] };
const faceUp = () => Object.assign(scene.add.image(), { texture: { key: 'enemyCard' } });
const enemy = (extra = {}) => ({ revealed: true, sprite: faceUp(), data: { type: 'enemy', role: 'MELEE', health: 10, maxHealth: 10, attack: 3, features: [], ...extra } });

try {
    // Bulwark and Briar Guard roll their spell.
    for (const [sigil, magicType, flag] of [['bulwark', 'boneWall', 'boneWall'], ['briarGuard', 'briarShield', 'briarShield']]) {
        assert.ok(getSigil(sigil).works && WORKING_PLAYER_SIGILS.includes(sigil), `${sigil} can be handed out`);
        const weapon = sword({ sigils: [{ id: sigil }] });
        const chance = getEnchantChance(magicType);
        Math.random = () => chance - 0.001;
        assert.equal(cs.rollWeaponEnchant(weapon), magicType, `${sigil} procs under its chance`);
        Math.random = () => chance + 0.001;
        assert.equal(cs.rollWeaponEnchant(weapon), null, `${sigil} misses over its chance`);
        scene.gameState[flag] = 0;
        cs.boardCards = [enemy()];
        cs.applyWeaponEnchantOnHit(0, magicType, 5);
        assert.equal(scene.gameState[flag], 1, `${sigil} readies one ${flag}`);
    }
    // One roll a swing: the weapon's own enchant wins.
    Math.random = () => 0;
    assert.equal(cs.rollWeaponEnchant(sword({ enchant: 'frostRing', sigils: [{ id: 'bulwark' }] })), 'frostRing');
    assert.equal(cs.rollWeaponEnchant(sword()), null, 'a plain weapon rolls nothing');

    // Enemy sigils read as their old traits.
    for (const [sigil, feature] of [['taunt', 'taunt'], ['veil', 'veil_flip'], ['barkskin', 'ranged_immune'], ['rally', 'goblin_rally']]) {
        assert.ok(getSigil(sigil).works, `${sigil} works`);
        assert.equal(hasEnemyTrait({ features: [feature] }, feature), true, `${feature} as a feature`);
        assert.equal(hasEnemyTrait({ sigils: [{ id: sigil }] }, feature), true, `${feature} as the ${sigil} sigil`);
        assert.equal(hasEnemyTrait({ features: [], sigils: [] }, feature), false);
    }
    // Barkskin: bows bounce off, swords connect.
    const bark = enemy({ sigils: [{ id: 'barkskin' }] });
    assert.equal(weaponCanDamageEnemy(bow, bark), false);
    assert.equal(weaponCanDamageEnemy(sword(), bark), true);
    // Taunt: while a face-up taunter stands, others cannot be targeted.
    const taunter = enemy({ sigils: [{ id: 'taunt' }] });
    const other = enemy();
    cs.boardCards = [taunter, other];
    assert.equal(cs.isTauntBlockingTarget(other), true, 'the other enemy is shielded');
    assert.equal(cs.isTauntBlockingTarget(taunter), false, 'the taunter can be hit');
} finally {
    Math.random = randomBefore;
}
console.log('Sigil trait checks passed: Bulwark and Briar Guard roll their spells; Taunt, Veil, Barkskin and Rally act as their traits.');

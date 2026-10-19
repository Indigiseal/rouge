import assert from 'node:assert/strict';
import { applyWeaponSigils, onWeaponSigilHit } from '../src/systems/combat/SigilEffects.js';
import { getSigil } from '../src/content/sigils/sigils.js';

const target = { data: { type: 'enemy', health: 100, maxHealth: 100 } };
const weapon = (weaponType, combo = false) => ({
    type: 'weapon', weaponType, sigils: combo ? [{ id: 'combo', level: 1 }] : [],
});
const remember = (scene, item) => onWeaponSigilHit(scene, item, target, { damageDealt: 10, swingDamage: 10 });
const damage = (scene, item) => applyWeaponSigils(scene, item, target, 10);

for (const type of ['bow', 'dagger', 'spear', 'sword', 'axe']) {
    const scene = { gameState: {} };
    const first = weapon(type);
    const second = weapon(type, true);
    assert.equal(damage(scene, second).damage, 10, 'no bonus on the first attack');
    remember(scene, first);
    assert.equal(damage(scene, second).damage, 15, 'another weapon of the same type enables Combo without needing the sigil');
    assert.ok(damage(scene, second).triggered.includes('combo'));
    assert.equal(damage(scene, first).damage, 10, 'the attacking weapon needs Combo');
    remember(scene, second);
    assert.equal(damage(scene, second).damage, 10, 'reusing the same card does not enable Combo');
    assert.equal(damage(scene, weapon(type, true)).damage, 15, 'a third matching card can continue the chain');
    remember(scene, weapon('other', true));
    assert.equal(damage(scene, second).damage, 10, 'a different weapon type breaks the chain even with Combo');
}
{
    const scene = { gameState: {} };
    remember(scene, weapon(undefined));
    assert.equal(damage(scene, weapon(undefined, true)).damage, 10, 'missing types do not count as a match');
}
assert.match(getSigil('combo').player, /different weapon of the same type/);
console.log('Combo checks passed: same type, different card, sigil ownership, interrupted chains, and tooltip rule.');

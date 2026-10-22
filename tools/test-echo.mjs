import assert from 'node:assert/strict';
import { MockScene } from '../sim/mock.js';
import { GameState } from '../src/systems/GameState.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { InventoryCombatUse } from '../src/systems/inventory/InventoryCombatUse.js';
import { onWeaponSigilHit } from '../src/systems/combat/SigilEffects.js';
import { addSigil, cardSigils, sigilFitsCardType } from '../src/content/sigils/sigils.js';
import { SaveManager } from '../src/managers/SaveManager.js';

const weapon = (...ids) => ({ type: 'weapon', weaponType: 'sword', name: 'Sword', damage: 5,
    durability: 5, maxDurability: 5, sigils: ids.map(id => ({ id })) });
function fixture(extra = {}) {
    const scene = new MockScene();
    scene.gameState = new GameState(scene);
    scene.gameState.currentFloor = 1;
    scene.gameState.playerHealth = scene.gameState.maxHealth = 100;
    scene.cardSystem = new CardSystem(scene);
    scene.inventorySystem = { slots: [], slotSprites: [] };
    scene.tutorialMode = true;
    scene.createDamageEffect = () => {};
    const sprite = scene.add.image(0, 0, 'enemy');
    Object.assign(sprite, { x: 200, y: 80 });
    const target = { revealed: true, sprite, restX: 200, restY: 80, data: {
        type: 'enemy', health: 100, maxHealth: 100, attack: 5, role: 'MELEE', features: [], ...extra } };
    scene.cardSystem.boardCards = [target];
    return { scene, target };
}
function attack(scene, wp) {
    scene.inventorySystem.slots = [wp];
    const inv = { ...InventoryCombatUse, scene, slots: scene.inventorySystem.slots,
        playWeaponStrikeEffect() {}, updateWeaponInfoText() {}, returnWeaponToSlotDelayed() {},
        returnWeaponToSlot() {}, handleWeaponBreak() {}, applyAssassinateTalent() {} };
    const sprite = scene.add.image(0, 0, 'weapon');
    Object.assign(sprite, { x: 200, y: 80 });
    inv.useWeapon(0, sprite);
}
const originalRandom = Math.random;
try {
    Math.random = () => 0;
    const { scene, target } = fixture();
    const wp = weapon('echo', 'cutpurse');
    attack(scene, wp);
    assert.equal(target.data.health, 93, '5 damage echoes for 2, rounding down');
    assert.equal(wp.durability, 4);
    assert.equal(scene.gameState.actionsLeft, 14);
    assert.equal(scene.gameState.coins, 2, 'the echo runs normal on-hit effects once');

    const mixed = fixture();
    attack(mixed.scene, weapon('echo', 'quickStrike'));
    assert.equal(mixed.target.data.health, 88, 'each primary proc may occur once; neither extra hit can chain');
    const armored = fixture({ armor: 2 });
    attack(armored.scene, { ...weapon('echo'), damage: 9 });
    assert.equal(armored.target.data.health, 91, 'armor applies separately to the primary and half-damage echo');
    const boss = fixture({ type: 'boss' });
    attack(boss.scene, weapon('echo'));
    assert.equal(boss.target.data.health, 93, 'bosses receive the extra hit');
    const lastPip = fixture();
    const spent = { ...weapon('echo'), durability: 1 };
    attack(lastPip.scene, spent);
    assert.equal(lastPip.target.data.health, 93);
    assert.equal(spent.durability, 0, 'last-pip hits can echo without spending a second pip');

    const guard = fixture();
    let calls = 0;
    guard.scene.cardSystem.attackEnemy = () => { calls++; };
    for (const data of [{ health: 0 }, { isBonePile: true }, { isCocoon: true }, { features: ['cocoon_shell'] }]) {
        const before = { ...guard.target.data };
        Object.assign(guard.target.data, data);
        onWeaponSigilHit(guard.scene, weapon('echo'), guard.target, { damageDealt: 5, repeatDamage: 5 });
        guard.target.data = before;
    }
    guard.target.revealed = false;
    onWeaponSigilHit(guard.scene, weapon('echo'), guard.target, { damageDealt: 5, repeatDamage: 5 });
    guard.target.revealed = true;
    guard.scene.cardSystem.boardCards = [];
    onWeaponSigilHit(guard.scene, weapon('echo'), guard.target, { damageDealt: 5, repeatDamage: 5 });
    guard.scene.cardSystem.boardCards = [guard.target];
    onWeaponSigilHit(guard.scene, weapon('echo'), guard.target, { damageDealt: 0, repeatDamage: 5 });
    onWeaponSigilHit(guard.scene, weapon('echo'), guard.target, { damageDealt: 5, repeatDamage: 5, allowExtraStrike: false });
    onWeaponSigilHit(guard.scene, weapon('echo'), guard.target, { damageDealt: 1, repeatDamage: 1 });
    Math.random = () => 0.1;
    onWeaponSigilHit(guard.scene, weapon('echo'), guard.target, { damageDealt: 5, repeatDamage: 5 });
    assert.equal(calls, 0, 'invalid targets, misses, extra hits, zero rounded damage and exact 10% do not echo');
    Math.random = () => 0.099;
    onWeaponSigilHit(guard.scene, weapon('echo'), guard.target, { damageDealt: 5, repeatDamage: 5 });
    assert.equal(calls, 1);

    const saved = fixture();
    const marked = weapon();
    assert.equal(addSigil(marked, 'echo'), true);
    assert.equal(sigilFitsCardType('echo', { type: 'armor' }), false);
    saved.scene.inventorySystem.slots = [marked];
    const saves = new SaveManager();
    saves.saveCurrentRun(saved.scene.gameState, saved.scene.inventorySystem, saved.scene.cardSystem);
    assert.equal(cardSigils(saves.loadCurrentRun().equipment.inventory[0])[0].id, 'echo');
} finally { Math.random = originalRandom; }
console.log('Echo checks passed: half-damage hits, rounding, armor, bosses, AP/pip costs, last pip, on-hit effects, no cross-chaining, invalid targets, chance boundaries and saves.');

import assert from 'node:assert/strict';
import { MockScene } from '../sim/mock.js';
import { GameState } from '../src/systems/GameState.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { AmuletManager } from '../src/managers/AmuletManager.js';
import { CombatTurnController } from '../src/systems/combat/CombatTurnController.js';
import { buildEnemyCardFromDef } from '../src/content/cards/enemies.js';
import { BOSSES } from '../src/content/cards/bosses.js';
import { AMULETS } from '../src/content/cards/amulets.js';
import { enemySigils, cardSigils, canTakeSigil, addSigil, WORKING_PLAYER_SIGILS } from '../src/content/sigils/sigils.js';
import { onWeaponSigilHit, applyWeaponSigils, weaponFlatSigilBonus, fleetfootDodgeChance } from '../src/systems/combat/SigilEffects.js';
import { getEnemyHitAttack } from '../src/content/combat/enemyAttack.js';
import { offerableSigils } from '../src/ui/SigilOffer.js';
import { SaveManager } from '../src/managers/SaveManager.js';

function fixture() {
    const scene = new MockScene();
    scene.gameState = new GameState(scene);
    scene.cardSystem = new CardSystem(scene);
    scene.gameState.currentFloor = 1;
    scene.gameState.actLocationIds = ['veilbleed', null, null];
    scene.gameState.playerHealth = scene.gameState.maxHealth = 100;
    scene.createDamageEffect = () => {};
    scene.tutorialMode = true;
    scene.inventorySystem = { slots: [{ type: 'weapon', damage: 5, durability: 5, maxDurability: 5 },
        { type: 'armor', protection: 2, durability: 5, maxDurability: 5 }], slotSprites: [] };
    return scene;
}
function enemy(scene, data = {}) {
    return { revealed: true, sprite: scene.add.image(200, 100, 'enemy'), data: {
        type: 'enemy', health: 50, maxHealth: 50, attack: 10, role: 'MELEE', features: [], ...data } };
}
const weapon = id => ({ type: 'weapon', weaponType: 'sword', damage: 5, durability: 5, maxDurability: 5, sigils: [{ id }] });
const armor = protection => ({ type: 'armor', protection, durability: 5, maxDurability: 5 });
for (const act of [1, 2, 3]) {
    const scene = fixture();
    scene.gameState.currentFloor = (act - 1) * 15 + 1;
    scene.gameState.actLocationIds = [null, null, null];
    scene.gameState.actLocationIds[act - 1] = 'veilbleed';
    assert.deepEqual(offerableSigils(scene), ['leech', 'sapping', 'devouring', 'fleetfoot', 'bloodlust']);
    scene.inventorySystem.slots = [];
    scene.gameState.equippedArmor = armor(2);
    assert.deepEqual(offerableSigils(scene), ['fleetfoot']);
}
assert.ok(!WORKING_PLAYER_SIGILS.includes('charm'));
assert.equal(canTakeSigil(weapon('leech'), 'charm'), false);
assert.equal(addSigil(weapon('leech'), 'charm'), false);
assert.ok(cardSigils(weapon('charm')).some(sigil => sigil.id === 'charm'), 'existing Charm weapons retain their ability');
const soul = buildEnemyCardFromDef('lostSoul', 1);
assert.deepEqual(enemySigils(soul).map(s => s.id), ['fleetfoot']);
assert.deepEqual(enemySigils(buildEnemyCardFromDef('veilRipper', 1)).map(s => s.id), ['leech']);
assert.deepEqual(enemySigils(buildEnemyCardFromDef('graveCantor', 1)).map(s => s.id), ['sapping']);
assert.deepEqual(enemySigils(buildEnemyCardFromDef('hollowMourner', 1)), []);
assert.deepEqual(enemySigils(buildEnemyCardFromDef('inkWraith', 1), { lockKind: 'ink' }).map(s => s.id), ['ink']);
assert.deepEqual(enemySigils(BOSSES.soulEater).map(s => s.id), ['fleetfoot', 'leech', 'summon']);
assert.equal(BOSSES.soulEater.abilities.length, 3);

const originalRandom = Math.random;
try {
    const scene = fixture(), cs = scene.cardSystem, gs = scene.gameState;
    const target = enemy(scene), controller = new CombatTurnController(scene);
    cs.boardCards = [target];
    Math.random = () => 0.199;
    assert.ok(!onWeaponSigilHit(scene, weapon('sapping'), target, { damageDealt: 0 }).includes('sapping'));
    assert.ok(onWeaponSigilHit(scene, weapon('sapping'), target, { damageDealt: 1 }).includes('sapping'));
    assert.equal(getEnemyHitAttack(target, cs.boardCards), 7);
    Math.random = () => 0.99;
    controller.processEnemyAttack(target, 0);
    assert.equal(gs.playerHealth, 93);
    assert.equal(target.data.sapped, false);
    controller.processEnemyAttack(target, 0);
    assert.equal(gs.playerHealth, 83, 'Sapping weakens one attack only');
    target.data.sigils = [{ id: 'sapping' }];
    Math.random = () => 0.1;
    controller.processEnemyAttack(target, 0);
    assert.equal(gs.playerSapped, true);
    Math.random = () => 0.99;
    cs.attackEnemy(0, 10, false, weapon('leech'), true);
    assert.equal(target.data.health, 43, 'enemy Sapping weakens the next connecting weapon hit');
    assert.equal(gs.playerSapped, false);
    gs.equippedArmor = armor(20);
    Math.random = () => 0.1;
    controller.processEnemyAttack(target, 0);
    assert.equal(gs.playerSapped, false, 'a fully blocked attack cannot apply Sapping');

    // Lifesteal is shared by ordinary Veil Rippers and Soul Eater. Armor can
    // reduce or stop it, and it never heals beyond maximum health.
    Math.random = () => 0.99;
    for (const definition of [buildEnemyCardFromDef('veilRipper', 1), BOSSES.soulEater]) {
        const draining = enemy(scene, { ...structuredClone(definition), health: 50, maxHealth: 100, attack: 20 });
        cs.boardCards = [draining];
        gs.equippedArmor = armor(15);
        controller.processEnemyAttack(draining, 0);
        assert.equal(draining.data.health, 51, 'five actual damage heals one');
        gs.equippedArmor = null;
        controller.processEnemyAttack(draining, 0);
        assert.equal(draining.data.health, 54, 'twenty actual damage heals three');
        gs.equippedArmor = armor(30);
        controller.processEnemyAttack(draining, 0);
        assert.equal(draining.data.health, 54, 'a blocked hit gives no lifesteal');
        draining.data.health = 99;
        gs.equippedArmor = null;
        gs.playerHealth = 100;
        controller.processEnemyAttack(draining, 0);
        assert.equal(draining.data.health, 100);
        gs.playerHealth = 100;
    }

    const evasive = enemy(scene, soul);
    Math.random = () => 0.099;
    assert.equal(cs.rollEvade(evasive), true);
    Math.random = () => 0.1;
    assert.equal(cs.rollEvade(evasive), false);
    gs.equippedArmor = { ...armor(0), sigils: [{ id: 'fleetfoot' }] };
    assert.equal(fleetfootDodgeChance(gs), 0.1);
    Math.random = () => 0.05;
    const beforeDodge = gs.playerHealth;
    assert.equal(gs.takeDamage(10, 0, 'enemy').dodged, true);
    assert.equal(gs.playerHealth, beforeDodge);

    gs.equippedArmor = null;
    gs.playerHealth = 70;
    onWeaponSigilHit(scene, weapon('leech'), target, { damageDealt: 10 });
    assert.equal(gs.playerHealth, 72);
    Math.random = () => 0;
    const ordinary = enemy(scene, { health: 20, armor: 2 });
    assert.equal(applyWeaponSigils(scene, weapon('devouring'), ordinary, 5).damage, 22);
    assert.equal(applyWeaponSigils(scene, weapon('devouring'), enemy(scene, { type: 'boss' }), 5).damage, 5);
    const blood = weapon('bloodlust');
    const killed = enemy(scene, { health: 0 });
    onWeaponSigilHit(scene, blood, killed, { damageDealt: 1 });
    onWeaponSigilHit(scene, blood, killed, { damageDealt: 1 });
    assert.equal(weaponFlatSigilBonus(scene, blood).bonus, 2);
    onWeaponSigilHit(scene, blood, ordinary, { damageDealt: 1 });
    assert.equal(weaponFlatSigilBonus(scene, blood).bonus, 0);
    const legacyCharmTarget = enemy(scene);
    assert.ok(onWeaponSigilHit(scene, weapon('charm'), legacyCharmTarget, { damageDealt: 1 }).includes('charm'));

    const perfumeScene = fixture();
    perfumeScene.amuletManager = new AmuletManager(perfumeScene);
    perfumeScene.gameState.activeAmulets = [{ id: 'sirensPendant' }];
    const attacker = enemy(perfumeScene, { sapped: true }), victim = enemy(perfumeScene);
    const dead = enemy(perfumeScene, { health: 0 });
    perfumeScene.cardSystem.boardCards = [attacker, victim, dead];
    const perfumeController = new CombatTurnController(perfumeScene);
    Math.random = () => 0.01;
    perfumeController.processEnemyAttack(attacker, 0);
    assert.equal(perfumeScene.gameState.playerHealth, 100);
    assert.equal(victim.data.health, 43);
    assert.equal(attacker.data.sapped, false);
    perfumeScene.cardSystem.boardCards = [attacker, dead];
    perfumeController.processEnemyAttack(attacker, 0);
    assert.equal(perfumeScene.gameState.playerHealth, 90, 'no living ally means the normal attack lands');
} finally { Math.random = originalRandom; }

const perfume = AMULETS.filter(amulet => amulet.id === 'sirensPendant');
assert.equal(perfume.length, 1);
assert.equal(perfume[0].rarity, 'rare');
assert.equal(perfume[0].spriteFrame, 60, 'reuse existing Siren\'s Perfume art');
const saving = fixture();
saving.gameState.playerSapped = true;
saving.inventorySystem.slots = [weapon('charm')];
const manager = new SaveManager();
manager.saveCurrentRun(saving.gameState, saving.inventorySystem, null);
const continued = manager.loadCurrentRun();
assert.equal(continued.effects.playerSapped, true);
assert.equal(continued.equipment.inventory[0].sigils[0].id, 'charm');
delete continued.effects.playerSapped;
manager.safeSet(manager.RUN_SAVE_KEY, JSON.stringify(continued));
assert.equal(manager.loadCurrentRun().effects.playerSapped, false);
console.log('Veilbleed checks passed: all-act local rewards, shared creature icons, three-ability boss, Leech, one-hit Sapping, blocked hits, evasion, Devouring, Bloodlust, restored Perfume, legacy Charm and save state.');

import assert from 'node:assert/strict';
import { MockScene } from '../sim/mock.js';
import { GameState } from '../src/systems/GameState.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { CombatTurnController } from '../src/systems/combat/CombatTurnController.js';
import { InventoryCombatUse } from '../src/systems/inventory/InventoryCombatUse.js';
import { applyWeaponSigils, onWeaponSigilHit } from '../src/systems/combat/SigilEffects.js';
import { freezeEnemy, isFrostFrozen, freezePlayer, freezeCompanion, tryEnemyFrost } from '../src/content/combat/frost.js';
import { getSigil, cardSigils, enemySigils } from '../src/content/sigils/sigils.js';
import { offerableSigils } from '../src/ui/SigilOffer.js';
import { stampForSigil } from '../src/content/sigils/sigilStamps.js';
import { SaveManager } from '../src/managers/SaveManager.js';
import { getMagic } from '../src/content/cards/magic.js';
import { PLAYABLE_LOCATION_IDS } from '../src/content/locations/catalog.js';
import { buildEnemyCardFromDef } from '../src/content/cards/enemies.js';
import { BOSSES } from '../src/content/cards/bosses.js';
import { CombatHud } from '../src/ui/CombatHud.js';
import { getTooltipLines } from '../src/ui/ItemTooltip.js';
import { refreshFrostCardArt } from '../src/content/location-packs/frosthollow/index.js';

const weapon = (...ids) => ({ type: 'weapon', weaponType: 'sword', name: 'Sword', damage: 5,
    durability: 5, maxDurability: 5, sigils: ids.map(id => ({ id })) });
function fixture() {
    const scene = new MockScene();
    scene.gameState = new GameState(scene);
    scene.cardSystem = new CardSystem(scene);
    scene.gameState.currentFloor = 1;
    scene.gameState.actLocationIds = ['frosthollow', null, null];
    scene.gameState.playerHealth = scene.gameState.maxHealth = 100;
    scene.inventorySystem = { slots: [weapon()], slotSprites: [], playSlotStrikeAnimation() {} };
    scene.markCompanionParticipated = () => {};
    scene.tutorialMode = true;
    scene.createDamageEffect = () => {};
    return scene;
}
function enemy(scene, extra = {}, revealed = true) {
    return { revealed, sprite: scene.add.image(0, 0, 'enemy'), data: {
        type: 'enemy', health: 50, maxHealth: 50, attack: 5, role: 'MELEE', features: [], ...extra } };
}
for (const act of [1, 2, 3]) {
    const scene = fixture();
    scene.gameState.currentFloor = (act - 1) * 15 + 1;
    scene.gameState.actLocationIds = [null, null, null];
    scene.gameState.actLocationIds[act - 1] = 'frosthollow';
    assert.deepEqual(offerableSigils(scene), ['frost', 'shatter', 'merciless', 'echo']);
    for (const [id, sigils] of Object.entries({ snowBrute: [], snowArcher: [], iceOrb: ['frost'], iceGolem: ['shatter'], frozenKnight: ['merciless'] })) {
        const data = buildEnemyCardFromDef(id, scene.gameState.currentFloor);
        assert.deepEqual(enemySigils(data).map(sigil => sigil.id), sigils);
        assert.equal(data.placeholderArt, false);
        assert.equal(data.sprite, `enemyCard_frosthollow_${data.sheetColumn}_normal`);
        assert.deepEqual(data.features, []);
    }
    const boss = scene.cardSystem.cardDataGenerator.createBossCard(act * 15, scene.gameState);
    assert.equal(boss.name, 'Frost Giant');
    assert.equal(boss.tier, act);
    assert.deepEqual(enemySigils(boss).map(sigil => sigil.id), ['frost', 'shatter', 'summon']);
    scene.inventorySystem.slots = [];
    scene.gameState.equippedArmor = { type: 'armor', durability: 5 };
    assert.deepEqual(offerableSigils(scene), []);
}
assert.ok(PLAYABLE_LOCATION_IDS.includes('frosthollow'), 'approved complete Frost roster enters the door pool');
for (const id of ['frost', 'shatter', 'merciless', 'echo']) assert.equal(stampForSigil(id).id, 'turtle');
assert.equal(getSigil('merciless').name, 'Frozen Hammer');
const savedFrostEnemy = { type: 'eliteEnemy', enemyType: 'iceWolf', sprite: 'enemyPlaceholder',
    placeholderArt: true, health: 7, maxHealth: 40, frozen: 2, sigils: [{ id: 'shatter' }] };
const refreshedEnemy = refreshFrostCardArt(savedFrostEnemy);
assert.equal(refreshedEnemy.enemyType, 'iceGolem');
assert.equal(refreshedEnemy.name, 'Ice Golem');
assert.equal(refreshedEnemy.sprite, 'enemyCard_frosthollow_3_elite');
assert.equal(refreshedEnemy.health, 7);
assert.equal(refreshedEnemy.maxHealth, 40);
assert.equal(refreshedEnemy.frozen, 2);
assert.deepEqual(refreshedEnemy.sigils, savedFrostEnemy.sigils);
assert.equal(buildEnemyCardFromDef('iceWolf', 1).enemyType, 'iceGolem', 'old queued summons resolve to a current monster');
const oldKnight = refreshFrostCardArt({ type: 'enemy', enemyType: 'snowOwl', sprite: 'snowOwl',
    role: 'RANGED', enemyTier: 'veteran', health: 9, attack: 4, dazed: true });
assert.equal(oldKnight.name, 'Frozen Knight');
assert.equal(oldKnight.role, 'MELEE');
assert.equal(oldKnight.sprite, 'enemyCard_frosthollow_4_veteran');
assert.equal(oldKnight.health, 9);
assert.equal(oldKnight.attack, 4);
assert.equal(oldKnight.dazed, true);
const legacyScene = fixture();
legacyScene.cardSystem.boardCards = [enemy(legacyScene, savedFrostEnemy)];
const legacyManager = new SaveManager();
legacyManager.saveCurrentRun(legacyScene.gameState, legacyScene.inventorySystem, legacyScene.cardSystem);
assert.equal(legacyManager.loadCurrentRun().board.cards[0].data.sprite, 'enemyCard_frosthollow_3_elite');
const savedFrostBoss = { type: 'boss', name: 'Frost Giant', sprite: 'enemyPlaceholder', health: 33, frozen: 1 };
assert.deepEqual(refreshFrostCardArt(savedFrostBoss), { ...savedFrostBoss, sprite: 'frostGiant', placeholderArt: false });
const customArt = { ...savedFrostEnemy, sprite: 'customEnemy' };
assert.equal(refreshFrostCardArt(customArt), customArt, 'only the generic placeholder is refreshed');
const otherLocation = { type: 'enemy', enemyType: 'rainMite', sprite: 'enemyPlaceholder' };
assert.equal(refreshFrostCardArt(otherLocation), otherLocation);

const scene = fixture(), cs = scene.cardSystem;
const target = enemy(scene), controller = new CombatTurnController(scene);
cs.boardCards = [target];
freezeEnemy(cs, target, 3);
assert.ok(isFrostFrozen(target.data));
assert.equal(applyWeaponSigils(scene, weapon('shatter'), target, 5).damage, 7);
assert.equal(applyWeaponSigils(scene, weapon('merciless'), target, 5).damage, 5);
target.data.health = 25;
assert.equal(applyWeaponSigils(scene, weapon('merciless'), target, 5).damage, 7);
assert.equal(applyWeaponSigils(scene, weapon('merciless', 'shatter'), target, 5).damage, 10, 'separate conditions stack with normal rounding');
target.data.health = 26;
assert.equal(applyWeaponSigils(scene, weapon('merciless'), target, 5).damage, 5);
target.data.shockedTurns = 1;
assert.equal(applyWeaponSigils(scene, weapon('shatter'), target, 5).damage, 5);
target.data.shockedTurns = 0;
target.data.webbedTurns = 1;
assert.equal(applyWeaponSigils(scene, weapon('shatter'), target, 5).damage, 5);
freezeEnemy(cs, target, 1);
assert.equal(target.data.frozen, 3, 'Frost never shortens an existing hold');
assert.equal(target.data.webbedTurns, 0);
assert.ok(isFrostFrozen(target.data));

const originalRandom = Math.random;
try {
    Math.random = () => 0.99;
    const shattering = weapon('shatter');
    scene.inventorySystem.slots = [shattering];
    const attacker = { ...InventoryCombatUse, scene, slots: [shattering],
        playWeaponStrikeEffect() {}, updateWeaponInfoText() {}, returnWeaponToSlotDelayed() {}, returnWeaponToSlot() {} };
    attacker.useWeapon(0, scene.add.image(0, 0, 'weapon'));
    assert.equal(target.data.health, 19, 'real inventory attacks apply Shatter');
    controller.processEnemyAttack(target, 0);
    assert.equal(scene.gameState.playerHealth, 100);
    assert.equal(target.data.frozen, 2);
    target.data.frozen = 0;
    Math.random = () => 0.249;
    onWeaponSigilHit(scene, weapon('frost'), target, { damageDealt: 0 });
    assert.equal(target.data.frozen, 0, 'a missed hit cannot freeze');
    assert.ok(onWeaponSigilHit(scene, weapon('frost'), target, { damageDealt: 1 }).includes('frost'));
    assert.equal(target.data.frozen, 1);
    target.data.frozen = 0;
    Math.random = () => 0.25;
    onWeaponSigilHit(scene, weapon('frost'), target, { damageDealt: 1 });
    assert.equal(target.data.frozen, 0);
    const boss = enemy(scene, { type: 'boss', frozen: 0 });
    Math.random = () => 0;
    onWeaponSigilHit(scene, weapon('frost'), boss, { damageDealt: 1 });
    assert.equal(boss.data.frozen, 0, 'the existing Frost sigil still excludes bosses');
    const spell = { type: 'magic', ...getMagic('frostRing') };
    const hidden = enemy(scene, {}, false), shell = enemy(scene, { isCocoon: true });
    const shocked = enemy(scene, { frozen: 1, shockedTurns: 1 });
    cs.boardCards = [boss, hidden, shell, shocked];
    const caster = { ...InventoryCombatUse, scene, slots: [spell], stationMode: true,
        cleanupCardSprites() {}, removeCard(index) { this.slots[index] = null; }, returnCardToSlot() {} };
    caster.useMagicCard(0, scene.add.image(0, 0, 'frozenRing'));
    assert.equal(boss.data.frozen, 3, 'Frost Ring retains its boss freeze');
    assert.equal(hidden.data.frozen || 0, 0);
    assert.equal(shell.data.frozen || 0, 0);
    assert.ok(isFrostFrozen(shocked.data));
    assert.equal(shocked.data.shockedTurns, 0);
    assert.equal(applyWeaponSigils(scene, weapon('shatter'), boss, 5).damage, 7);
    cs.boardCards = [hidden, shell];
    caster.slots = [spell];
    assert.equal(caster.canMagicCardSucceed(spell), false);
    cs.boardCards = [shocked];
    shocked.data.frozen = 1;
    shocked.data.shockedTurns = 1;
    cs.applyWeaponEnchantOnHit(0, 'frostRing', 5);
    assert.ok(isFrostFrozen(shocked.data), 'the Frost enchant also establishes Frost status');
    const manager = new SaveManager();
    scene.inventorySystem.slots = [weapon('merciless', 'shatter')];
    manager.saveCurrentRun(scene.gameState, scene.inventorySystem, cs);
    const saved = manager.loadCurrentRun();
    assert.equal(cardSigils(saved.equipment.inventory[0])[0].id, 'merciless', 'old saves retain the stable sigil ID');
    assert.equal(saved.board.cards[0].data.frozen, 1);
    assert.equal(saved.board.cards[0].data.shockedTurns, 0);

    Math.random = () => 0.99;
    const playerScene = fixture(), playerTarget = enemy(playerScene), playerWeapon = weapon();
    playerScene.cardSystem.boardCards = [playerTarget];
    playerScene.inventorySystem.slots = [playerWeapon];
    const playerCaster = { ...InventoryCombatUse, scene: playerScene, slots: [playerWeapon],
        playWeaponStrikeEffect() {}, updateWeaponInfoText() {}, returnWeaponToSlotDelayed() {}, returnWeaponToSlot() {} };
    freezePlayer(playerScene.gameState);
    freezePlayer(playerScene.gameState);
    assert.equal(playerScene.gameState.playerFrozenAttacks, 2, 'repeated Frost refreshes rather than adding misses');
    playerScene.gameState.playerShocked = true;
    const ap = playerScene.gameState.actionsLeft;
    playerCaster.useWeapon(0, Object.assign(playerScene.add.image(600, 300, 'weapon'), { x: 600, y: 300 }));
    assert.equal(playerScene.gameState.playerFrozenAttacks, 2);
    assert.equal(playerScene.gameState.actionsLeft, ap);
    for (const remaining of [1, 0]) {
        playerCaster.useWeapon(0, playerScene.add.image(0, 0, 'weapon'));
        assert.equal(playerScene.gameState.playerFrozenAttacks, remaining);
        assert.equal(playerScene.gameState.playerShocked, false, 'one attempted attack advances overlapping Shock and Frost');
        assert.equal(playerTarget.data.health, 50);
        assert.equal(playerWeapon.durability, 5);
    }
    assert.equal(playerScene.gameState.actionsLeft, ap - 2);
    playerCaster.useWeapon(0, playerScene.add.image(0, 0, 'weapon'));
    assert.equal(playerTarget.data.health, 45);
    assert.equal(playerWeapon.durability, 4);

    const companionScene = fixture(), companionTarget = enemy(companionScene);
    const companion = { type: 'companion', attack: 3, attackStyle: 'melee' };
    companionScene.cardSystem.boardCards = [companionTarget];
    companionScene.inventorySystem.slots = [companion];
    freezeCompanion(companion);
    assert.match(getTooltipLines(companionScene, companion).body, /Frozen: 2/);
    const companionController = new CombatTurnController(companionScene);
    for (const remaining of [1, 0]) {
        companionController.runCompanionTurn({ companion, index: 0 });
        assert.equal(companion.frozenAttacks, remaining);
        assert.equal(companionTarget.data.health, 50);
    }
    companionController.runCompanionTurn({ companion, index: 0 });
    assert.equal(companionTarget.data.health, 47);
    freezeCompanion(companion);
    companionScene.cardSystem.boardCards = [];
    companionController.runCompanionTurn({ companion, index: 0 });
    assert.equal(companion.frozenAttacks, 2, 'no target does not thaw a companion');
    companionScene.cardSystem.boardCards = [companionTarget];
    companionScene._simInventory = [companion];
    companionScene._runCompanionTurns();
    companionScene._runCompanionTurns();
    assert.equal(companionTarget.data.health, 47);
    companionScene._runCompanionTurns();
    assert.equal(companionTarget.data.health, 44);

    const encounter = fixture(), hare = enemy(encounter, { ...buildEnemyCardFromDef('iceOrb', 1), attack: 5 });
    const wolf = enemy(encounter, { ...buildEnemyCardFromDef('iceGolem', 1), attack: 11 });
    encounter.cardSystem.boardCards = [hare, wolf];
    const choice = (...rolls) => () => rolls.shift();
    assert.equal(tryEnemyFrost(encounter, hare.data, 5, choice(0.1)), null);
    assert.equal(tryEnemyFrost(encounter, hare.data, 0, choice(0)), null);
    encounter.inventorySystem.slots.push(companion);
    assert.equal(tryEnemyFrost(encounter, hare.data, 5, choice(0.09, 0.99)).companion, companion);
    assert.equal(companion.frozenAttacks, 2);
    Math.random = () => 0;
    const encounterController = new CombatTurnController(encounter);
    encounterController.processEnemyAttack(hare, 0);
    assert.equal(encounter.gameState.playerFrozenAttacks, 2);
    encounterController.processEnemyAttack(wolf, 1);
    assert.equal(encounter.gameState.playerHealth, 79, 'Frost Hare enables an Ice Wolf to Shatter');
    assert.ok(CombatHud.collectPlayerEffectEntries.call({ gameState: encounter.gameState, scene: encounter }).some(entry => /Frozen: 2/.test(entry.text)));
    encounter.gameState.playerFrozenAttacks = 1;
    freezePlayer(encounter.gameState);
    assert.equal(encounter.gameState.playerFrozenAttacks, 2);
    encounter.gameState.playerFrozenAttacks = 0;
    encounter.gameState.equippedArmor = { type: 'armor', protection: 20, durability: 10, maxDurability: 10 };
    encounterController.processEnemyAttack(hare, 0);
    assert.equal(encounter.gameState.playerFrozenAttacks, 0);
    encounter.gameState.equippedArmor.sigils = [{ id: 'fleetfoot' }];
    encounterController.processEnemyAttack(hare, 0);
    assert.equal(encounter.gameState.playerFrozenAttacks, 0);
    const simulation = fixture();
    simulation.cardSystem.boardCards = [enemy(simulation, { ...hare.data }), enemy(simulation, { ...wolf.data })];
    simulation.runEnemyTurn();
    assert.equal(simulation.gameState.playerHealth, 79);
    assert.equal(simulation.gameState.playerFrozenAttacks, 2);
    const summoning = fixture(), giant = enemy(summoning, { ...structuredClone(BOSSES.frostGiant), frozen: 1 });
    summoning.cardSystem.boardCards = [giant];
    const summons = [];
    summoning.cardSystem.summonEnemy = id => { summons.push(id); return true; };
    const queue = new CombatTurnController(summoning);
    queue.tickHandWebs = () => {};
    queue.finishEnemyTurnEffects = () => {};
    queue.revealedEnemiesAttack();
    assert.deepEqual(summons, ['iceGolem']);
    freezePlayer(playerScene.gameState);
    freezeCompanion(companion);
    playerScene.inventorySystem.slots = [companion];
    manager.saveCurrentRun(playerScene.gameState, playerScene.inventorySystem, playerScene.cardSystem);
    const continued = manager.loadCurrentRun();
    assert.equal(continued.effects.playerFrozenAttacks, 2);
    assert.equal(continued.equipment.inventory[0].frozenAttacks, 2);
    delete continued.effects.playerFrozenAttacks;
    manager.safeSet(manager.RUN_SAVE_KEY, JSON.stringify(continued));
    assert.equal(manager.loadCurrentRun().effects.playerFrozenAttacks, 0);
} finally { Math.random = originalRandom; }
console.log('Frost checks passed: new monster roster across all acts, freeze/overlap/defenses, Orb/Golem synergy, summons, Frozen Hammer/Shatter, magic/enchant, HUD, legacy art/identity migration and headless parity.');

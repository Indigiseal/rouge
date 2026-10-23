import assert from 'node:assert/strict';
import { MockScene } from '../sim/mock.js';
import { GameState } from '../src/systems/GameState.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { InventoryCombatUse } from '../src/systems/inventory/InventoryCombatUse.js';
import { CombatTurnController } from '../src/systems/combat/CombatTurnController.js';
import { applyWeaponSigils, onWeaponSigilHit } from '../src/systems/combat/SigilEffects.js';
import { spawnForagedFood } from '../src/systems/board/FoodForage.js';
import { offerableSigils } from '../src/ui/SigilOffer.js';
import { stampForSigil } from '../src/content/sigils/sigilStamps.js';
import { cardSigils, getSigil } from '../src/content/sigils/sigils.js';
import { PLAYABLE_LOCATION_IDS } from '../src/content/locations/catalog.js';
import { SaveManager } from '../src/managers/SaveManager.js';
import { buildEnemyCardFromDef } from '../src/content/cards/enemies.js';
import { enemySigils } from '../src/content/sigils/sigils.js';
import { tryEnemySandstorm, tryEnemyQuickStrike, restoreDesertFeastAP } from '../src/content/combat/sandreach.js';
import { CombatHud } from '../src/ui/CombatHud.js';
import { BOSSES } from '../src/content/cards/bosses.js';
import { AmuletManager } from '../src/managers/AmuletManager.js';
import { GLUTTON_MAX_AP } from '../src/content/amulets/currentCatalog.js';
import { grantMealMaxActions } from '../src/content/amulets/foodEndurance.js';
import { getMagic } from '../src/content/cards/magic.js';
import { applyEnchantToWeapon, describeWeaponEnchant, getEnchantChance, getGlowCardFrame, enchantableMagicTypes } from '../src/content/balance/WeaponEnchants.js';
import { InventoryView } from '../src/systems/inventory/InventoryView.js';
import { AMULETS } from '../src/content/cards/amulets.js';

const ids = ['secondWind', 'daze', 'archerBane', 'wellFed', 'forage', 'quickStrike'];
const weapon = (...sigils) => ({ type: 'weapon', weaponType: 'sword', name: 'Sword', damage: 5,
    durability: 5, maxDurability: 5, sigils: sigils.map(id => ({ id })) });
function fixture() {
    const scene = new MockScene();
    scene.gameState = new GameState(scene);
    scene.cardSystem = new CardSystem(scene);
    scene.gameState.currentFloor = 1;
    scene.gameState.actLocationIds = ['sandreach', null, null];
    scene.gameState.playerHealth = scene.gameState.maxHealth = 100;
    scene.inventorySystem = { slots: [weapon()] };
    scene.createDamageEffect = () => {};
    scene.tutorialMode = true;
    const cs = scene.cardSystem;
    cs._boardCells = [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }];
    cs._boardPlace = { cardScale: 1 };
    cs.brickToPixel = (r, c) => ({ x: 200 + c * 70, y: 80 + r * 80 });
    cs.boardCards = new Array(3).fill(null);
    return scene;
}
function enemy(scene, extra = {}) {
    const sprite = scene.add.image(0, 0, 'enemy');
    Object.assign(sprite, { x: 200, y: 80 });
    return { revealed: true, sprite, restX: 200, restY: 80, data: {
        type: 'enemy', health: 100, maxHealth: 100, attack: 5, role: 'MELEE', features: [],
        brick: { r: 0, c: 0 }, ...extra } };
}
function attack(scene, wp) {
    scene.inventorySystem.slots = [wp];
    const attacker = { ...InventoryCombatUse, scene, slots: scene.inventorySystem.slots,
        playWeaponStrikeEffect() {}, updateWeaponInfoText() {}, returnWeaponToSlotDelayed() {},
        returnWeaponToSlot() {}, handleWeaponBreak() {}, applyAssassinateTalent() {} };
    const sprite = scene.add.image(0, 0, 'weapon');
    Object.assign(sprite, { x: 200, y: 80 });
    attacker.useWeapon(0, sprite);
}

assert.ok(PLAYABLE_LOCATION_IDS.includes('sandreach'));
for (const act of [1, 2, 3]) {
    const scene = fixture();
    scene.gameState.currentFloor = (act - 1) * 15 + 1;
    scene.gameState.actLocationIds = [null, null, null];
    scene.gameState.actLocationIds[act - 1] = 'sandreach';
    assert.deepEqual(offerableSigils(scene), ids);
    for (const [id, expected] of Object.entries({ glassScarab: [], duneForager: ['forage'],
        sandSkirmisher: ['quickStrike'], lizardArcher: [], sandcaller: ['daze'] })) {
        const data = buildEnemyCardFromDef(id, scene.gameState.currentFloor);
        assert.deepEqual(enemySigils(data).map(sigil => sigil.id), expected);
        assert.equal(data.placeholderArt, false);
        assert.deepEqual(data.features, []);
    }
    const boss = scene.cardSystem.cardDataGenerator.createBossCard(act * 15, scene.gameState);
    assert.equal(boss.name, 'Sandscale Chieftain');
    assert.equal(boss.sprite, 'lizardBoss');
    assert.equal(boss.tier, act);
    assert.deepEqual(enemySigils(boss).map(sigil => sigil.id), ['quickStrike', 'daze', 'summon']);
    scene.gameState.storyRun = { sigilsTaken: ['secondWind', 'daze'] };
    assert.deepEqual(offerableSigils(scene), ids.slice(2));
    scene.inventorySystem.slots = [];
    scene.gameState.equippedArmor = { type: 'armor', durability: 5 };
    assert.deepEqual(offerableSigils(scene), [], 'these six rules belong on weapons');
}
for (const id of ids) assert.equal(stampForSigil(id).id, 'deer');
assert.equal(getSigil('daze').name, 'Sandstorm');
assert.deepEqual(cardSigils(weapon('daze')).map(sigil => sigil.id), ['daze'], 'existing save IDs survive the rename');

const scene = fixture(), cs = scene.cardSystem, target = enemy(scene);
cs.boardCards[0] = target;
assert.equal(applyWeaponSigils(scene, weapon('archerBane'), target, 5).damage, 5);
target.data.role = 'RANGED';
assert.equal(applyWeaponSigils(scene, weapon('archerBane'), target, 5).damage, 7);
assert.equal(applyWeaponSigils(scene, weapon('archerBane', 'wellFed'), target, 5).damage, 10);
scene.gameState.actionsLeft--;
assert.equal(applyWeaponSigils(scene, weapon('wellFed'), target, 5).damage, 5);
assert.equal(applyWeaponSigils(scene, weapon('wellFed'), target, 5, { actionsBefore: 15 }).damage, 7);

const originalRandom = Math.random;
try {
    Math.random = () => 0.99;
    scene.gameState.actionsLeft = 15;
    attack(scene, weapon('wellFed'));
    assert.equal(target.data.health, 93, 'full-AP bonus sees AP before paying for the actual attack');
    assert.equal(scene.gameState.actionsLeft, 14);
    attack(scene, weapon('wellFed'));
    assert.equal(target.data.health, 88, 'the following attack is no longer full-AP');

    const quick = fixture(), quickTarget = enemy(quick), wp = weapon('quickStrike');
    quick.cardSystem.boardCards[0] = quickTarget;
    Math.random = () => 0;
    attack(quick, wp);
    assert.equal(quickTarget.data.health, 90, 'exactly two five-damage hits, even when every repeat roll would pass');
    assert.equal(wp.durability, 4, 'one pip for both hits');
    assert.equal(quick.gameState.actionsLeft, 14, 'one AP for both hits');

    // Repeated attacks use ordinary armor and normal on-hit effects.
    const armored = fixture(), armoredTarget = enemy(armored, { armor: 2 });
    armored.cardSystem.boardCards[0] = armoredTarget;
    const purse = weapon('quickStrike', 'cutpurse');
    attack(armored, purse);
    assert.equal(armoredTarget.data.health, 94);
    assert.equal(armored.gameState.coins, 2, 'both connecting hits get ordinary on-hit rewards');

    let repeats = 0;
    const guard = fixture(), guardTarget = enemy(guard);
    guard.cardSystem.boardCards[0] = guardTarget;
    guard.cardSystem.attackEnemy = () => { repeats++; };
    for (const extra of [{ health: 0 }, { isBonePile: true }, { isCocoon: true }]) {
        const saved = { ...guardTarget.data };
        Object.assign(guardTarget.data, extra);
        onWeaponSigilHit(guard, weapon('quickStrike'), guardTarget, { damageDealt: 5, repeatDamage: 5 });
        guardTarget.data = saved;
    }
    onWeaponSigilHit(guard, weapon('quickStrike'), guardTarget, { damageDealt: 0, repeatDamage: 5 });
    Math.random = () => 0.1;
    onWeaponSigilHit(guard, weapon('quickStrike'), guardTarget, { damageDealt: 5, repeatDamage: 5 });
    assert.equal(repeats, 0, 'dead/pile/cocoon/miss and the exact 10% boundary cannot repeat');
    guardTarget.data.type = 'boss';
    Math.random = () => 0.099;
    onWeaponSigilHit(guard, weapon('quickStrike'), guardTarget, { damageDealt: 5, repeatDamage: 5 });
    assert.equal(repeats, 1, 'bosses can receive the extra hit');

    Math.random = () => 0;
    const daze = weapon('daze');
    onWeaponSigilHit(scene, daze, target, { damageDealt: 0 });
    assert.ok(!target.data.dazed);
    onWeaponSigilHit(scene, daze, target, { damageDealt: 1 });
    assert.equal(target.data.dazed, true);
    const beforeHp = scene.gameState.playerHealth;
    new CombatTurnController(scene).processEnemyAttack(target, 0);
    assert.equal(scene.gameState.playerHealth, beforeHp);
    assert.equal(target.data.dazed, false);
    target.data.type = 'boss';
    onWeaponSigilHit(scene, daze, target, { damageDealt: 1 });
    assert.equal(target.data.dazed, false, 'Sandstorm retains its non-boss restriction');
    target.data.type = 'enemy';
    Math.random = () => 0.2;
    onWeaponSigilHit(scene, daze, target, { damageDealt: 1 });
    assert.equal(target.data.dazed, false);

    Math.random = () => 0.099;
    scene.gameState.actionsLeft = 3;
    onWeaponSigilHit(scene, weapon('secondWind'), target, { damageDealt: 1 });
    assert.equal(scene.gameState.actionsLeft, 5);
    scene.gameState.actionsLeft = 14;
    onWeaponSigilHit(scene, weapon('secondWind'), target, { damageDealt: 1 });
    assert.equal(scene.gameState.actionsLeft, 15);
    onWeaponSigilHit(scene, weapon('secondWind'), target, { damageDealt: 0 });
    assert.equal(scene.gameState.actionsLeft, 15);

    const food = fixture(), foodTarget = enemy(food);
    food.cardSystem.boardCards[0] = foodTarget;
    Math.random = () => 0.1;
    assert.ok(!onWeaponSigilHit(food, weapon('forage'), foodTarget, { damageDealt: 5 }).includes('forage'));
    Math.random = () => 0.099;
    assert.ok(!onWeaponSigilHit(food, weapon('forage'), foodTarget, { damageDealt: 0 }).includes('forage'));
    assert.ok(onWeaponSigilHit(food, weapon('forage'), foodTarget, { damageDealt: 5 }).includes('forage'));
    const spawned = food.cardSystem.boardCards.find(card => card?.data?.type === 'food');
    const ordinary = food.cardSystem.cardDataGenerator.createFoodCard(1);
    for (const key of ['type', 'name', 'actionAmount', 'rarity', 'sprite']) assert.equal(spawned.data[key], ordinary[key]);
    assert.equal(spawned.revealed, true);
    assert.equal(food.cardSystem.boardCards[0], foodTarget);
    assert.equal(food.inventorySystem.slots.length, 1, 'food is on the board, not inserted into inventory');
    assert.ok(new SaveManager().serializeBoardCards(food.cardSystem.boardCards).some(card => card?.data?.type === 'food'));
    food.cardSystem.boardCards.fill(foodTarget);
    assert.equal(spawnForagedFood(food.cardSystem), false, 'full board is untouched');
    food.cardSystem.boardCards = new Array(3).fill(null);
    food.enemiesCleared = true;
    assert.equal(spawnForagedFood(food.cardSystem), false);
    food.enemiesCleared = false;
    food.gameState.roomType = 'SHOP';
    assert.equal(spawnForagedFood(food.cardSystem), false);

    const bossFood = fixture();
    bossFood.gameState.roomType = 'BOSS';
    bossFood.cardSystem.boardCards = new Array(9).fill(null);
    bossFood.cardSystem.boardCards[4] = enemy(bossFood, { type: 'boss' });
    assert.equal(spawnForagedFood(bossFood.cardSystem), true, 'boss rooms use empty summon lanes');
    assert.equal(bossFood.cardSystem.boardCards[4].data.type, 'boss');

    // Enemy Quick Strike resolves a full second attack, with no recursion.
    const skirmish = fixture(), skirmisher = enemy(skirmish, { sigils: [{ id: 'quickStrike' }] });
    skirmish.cardSystem.boardCards[0] = skirmisher;
    Math.random = () => 0;
    new CombatTurnController(skirmish).processEnemyAttack(skirmisher, 0);
    assert.equal(skirmish.gameState.playerHealth, 90);
    const sim = fixture();
    sim.cardSystem.boardCards[0] = enemy(sim, { sigils: [{ id: 'quickStrike' }] });
    sim.runEnemyTurn();
    assert.equal(sim.gameState.playerHealth, 90, 'live and headless extra attacks agree');
    const frozen = fixture(), frozenSkirmisher = enemy(frozen, { frozen: 1, sigils: [{ id: 'quickStrike' }] });
    frozen.cardSystem.boardCards[0] = frozenSkirmisher;
    new CombatTurnController(frozen).processEnemyAttack(frozenSkirmisher, 0);
    assert.equal(frozen.gameState.playerHealth, 100, 'thawing does not trigger an extra attack');
    const shielded = fixture(), shieldTarget = enemy(shielded, { sigils: [{ id: 'quickStrike' }, { id: 'daze' }] });
    shielded.cardSystem.boardCards[0] = shieldTarget;
    shielded.gameState.boneWall = 2;
    new CombatTurnController(shielded).processEnemyAttack(shieldTarget, 0);
    assert.equal(shielded.gameState.playerHealth, 100);
    assert.equal(shielded.gameState.boneWall, 1, 'a blocked hit does not trigger a second attack');
    assert.equal(shielded.gameState.playerSandstormed, false);

    const summoning = fixture(), chief = enemy(summoning, { ...structuredClone(BOSSES.sandscaleChieftain), frozen: 1 });
    summoning.cardSystem.boardCards = [chief];
    const summons = [];
    summoning.cardSystem.summonEnemy = id => { summons.push(id); return true; };
    const queue = new CombatTurnController(summoning);
    queue.tickHandWebs = () => {};
    queue.finishEnemyTurnEffects = () => {};
    queue.revealedEnemiesAttack();
    assert.deepEqual(summons, ['lizardArcher']);
    const caller = fixture(), sandcaller = enemy(caller, { sigils: [{ id: 'daze' }] });
    caller.cardSystem.boardCards[0] = sandcaller;
    new CombatTurnController(caller).processEnemyAttack(sandcaller, 0);
    assert.equal(caller.gameState.playerSandstormed, true);
    const held = weapon();
    const targetHp = sandcaller.data.health;
    attack(caller, held);
    assert.equal(sandcaller.data.health, targetHp);
    assert.equal(held.durability, 5);
    assert.equal(caller.gameState.actionsLeft, 14);
    assert.equal(caller.gameState.playerSandstormed, false);
    Math.random = () => 0.99;
    attack(caller, held);
    assert.equal(sandcaller.data.health, targetHp - 5);
    assert.equal(held.durability, 4);
    assert.equal(tryEnemySandstorm(caller.gameState, sandcaller.data, 5, () => 0.2), false);
    assert.equal(tryEnemySandstorm(caller.gameState, sandcaller.data, 0, () => 0), false);
    assert.equal(tryEnemyQuickStrike(caller.gameState, skirmisher.data, 5, () => 0.1), false);
    assert.equal(tryEnemyQuickStrike(caller.gameState, skirmisher.data, 0, () => 0), false);

    const foodDeath = fixture();
    const forager = enemy(foodDeath, { ...buildEnemyCardFromDef('duneForager', 1), health: 5, maxHealth: 5 });
    foodDeath.cardSystem.boardCards[0] = forager;
    foodDeath.cardSystem.boardCards[1] = enemy(foodDeath);
    foodDeath.gameState.equippedWeapon = weapon();
    foodDeath.cardSystem.attackEnemy(0, 5, false, foodDeath.gameState.equippedWeapon);
    assert.equal(foodDeath.cardSystem.boardCards[0].data.type, 'food');
    assert.equal(forager.data.type, 'enemy', 'on-hit accounting retains the original defeated enemy');
    assert.equal(forager.data.health, 0);
    const foodDrop = foodDeath.cardSystem.boardCards[0];
    foodDeath.cardSystem.removeDefeatedEnemy(0, forager);
    assert.equal(foodDeath.cardSystem.boardCards[0], foodDrop, 'stale defeat callbacks cannot replace the food again');
    let pickupCount = 0;
    foodDeath.inventorySystem.addCard = () => { pickupCount++; return false; };
    foodDeath.cardSystem.interactWithCard(0);
    assert.equal(foodDeath.cardSystem.boardCards[0], foodDrop, 'a full inventory leaves food on the board');
    foodDeath.inventorySystem.addCard = () => { pickupCount++; return true; };
    foodDeath.cardSystem.interactWithCard(0);
    assert.equal(foodDeath.cardSystem.boardCards[0], null);
    foodDeath.cardSystem.interactWithCard(0);
    assert.equal(pickupCount, 2, 'successful pickup happens once, after the earlier full-bag refusal');

    caller.gameState.playerSandstormed = true;
    caller.gameState.gluttonMaxApGained = 4;
    assert.ok(CombatHud.collectPlayerEffectEntries.call({ gameState: caller.gameState, scene: caller })
        .some(entry => entry.text.includes('Sandstorm')));
    const manager = new SaveManager();
    manager.saveCurrentRun(caller.gameState, caller.inventorySystem, caller.cardSystem);
    const saved = manager.loadCurrentRun();
    assert.equal(saved.effects.playerSandstormed, true);
    assert.equal(saved.player.gluttonMaxApGained, 4, 'food-growth cap usage survives saving');
    delete saved.effects.playerSandstormed;
    delete saved.player.gluttonMaxApGained;
    manager.safeSet(manager.RUN_SAVE_KEY, JSON.stringify(saved));
    assert.equal(manager.loadCurrentRun().effects.playerSandstormed, false);
    assert.equal(manager.loadCurrentRun().player.gluttonMaxApGained, 0);

    const meals = fixture();
    meals.amuletManager = new AmuletManager(meals);
    assert.equal(GLUTTON_MAX_AP, 10);
    assert.equal(meals.amuletManager.amuletDefinitions.gluttonsCharm.name, 'Sandglass Scarab');
    assert.equal(meals.amuletManager.amuletDefinitions.gluttonsCharm.originLocationId, 'sandreach');
    assert.equal(AMULETS.filter(amulet => amulet.id === 'gluttonsCharm').length, 1, 'reuse the existing global drop, without a duplicate');
    meals.gameState.activeAmulets = [{ id: 'gluttonsCharm' }];
    meals.gameState.actionsLeft = 0;
    const eater = { ...InventoryCombatUse, scene: meals, slots: [],
        removeCard(index) { this.slots[index] = null; }, cleanupCardSprites() {} };
    for (let count = 0; count < GLUTTON_MAX_AP + 2; count++) {
        eater.slots[0] = meals.cardSystem.cardDataGenerator.createFoodCard(1);
        assert.equal(eater.useFood(0, null), true);
        assert.equal(eater.slots[0], null);
    }
    assert.equal(meals.gameState.gluttonMaxApGained, GLUTTON_MAX_AP);
    assert.equal(meals.gameState.maxActions, 15 + GLUTTON_MAX_AP);
    assert.equal(meals.gameState.actionsLeft, meals.gameState.maxActions, 'food fills the raised maximum');
    meals.gameState.activeAmulets = [];
    assert.equal(grantMealMaxActions(meals.gameState, meals.amuletManager), 0);
    assert.equal(meals.gameState.maxActions, 15 + GLUTTON_MAX_AP, 'earned AP remains after removing the amulet');
    meals.gameState.activeAmulets = [{ id: 'gluttonsCharm' }];
    assert.equal(grantMealMaxActions(meals.gameState, meals.amuletManager), 0, 're-equipping cannot reset the cap');
    manager.saveCurrentRun(meals.gameState, meals.inventorySystem, meals.cardSystem);
    const mealSave = manager.loadCurrentRun();
    assert.equal(mealSave.player.gluttonMaxApGained, GLUTTON_MAX_AP);
    assert.equal(mealSave.player.maxActions, 15 + GLUTTON_MAX_AP);
    mealSave.effects.activeAmulets = [{ id: 'gluttonsCharm', name: "Glutton's Charm", level: 1 }];
    manager.safeSet(manager.RUN_SAVE_KEY, JSON.stringify(mealSave));
    const legacyScarab = manager.loadCurrentRun();
    assert.equal(legacyScarab.effects.activeAmulets[0].name, 'Sandglass Scarab');
    assert.match(legacyScarab.effects.activeAmulets[0].description, /\+10/);
    assert.equal(legacyScarab.player.maxActions, 25, 'renaming a saved amulet cannot replay AP gains');

    const feast = fixture();
    const spell = { type: 'magic', ...getMagic('desertFeast') };
    const caster = { ...InventoryCombatUse, scene: feast, slots: [spell], stationMode: false,
        returnCardToSlot() {}, cleanupCardSprites() {}, removeCard(index) { this.slots[index] = null; } };
    feast.gameState.playerHealth = 42;
    feast.gameState.actionsLeft = 3;
    feast.gameState.gluttonMaxApGained = 4;
    caster.useMagicCard(0, feast.add.image(200, 80, spell.sprite));
    assert.equal(caster.slots[0], null);
    assert.equal(feast.gameState.actionsLeft, 15);
    assert.equal(feast.gameState.playerHealth, 42, 'Desert Feast never heals HP');
    assert.equal(feast.gameState.maxActions, 15);
    assert.equal(feast.gameState.gluttonMaxApGained, 4, 'a spell does not count as eating food');
    caster.slots[0] = spell;
    let wastedActions = 0;
    const useAction = feast.useAction.bind(feast);
    feast.useAction = () => { wastedActions++; return useAction(); };
    caster.useMagicCard(0, feast.add.image(200, 80, spell.sprite));
    assert.equal(caster.slots[0], spell);
    assert.equal(wastedActions, 0, 'full AP returns the spell before charging an action');
    assert.equal(InventoryView.describeMagicCard.call({ scene: feast }, spell), 'Restore Action Points');
    assert.equal(getGlowCardFrame('desertFeast'), 9);
    assert.ok(enchantableMagicTypes(1).includes('desertFeast'));
    feast.gameState.actionsLeft = 1;
    assert.equal(restoreDesertFeastAP(feast.gameState), 14);
    feast.gameState.playerHealth = 0;
    feast.gameState.actionsLeft = 0;
    assert.equal(restoreDesertFeastAP(feast.gameState), 0, 'the spell cannot revive a defeated player');

    const enchanted = weapon();
    assert.equal(applyEnchantToWeapon(enchanted, 'desertFeast'), true);
    assert.equal(getEnchantChance('desertFeast'), 0.1);
    assert.match(describeWeaponEnchant(scene, enchanted), /Second Wind 10%.*2 action points/);
    enchanted.sigils = [{ id: 'secondWind' }];
    assert.equal(cardSigils(enchanted).filter(sigil => sigil.id === 'secondWind').length, 1);
    scene.gameState.actionsLeft = 2;
    let rolls = 0;
    Math.random = () => { rolls++; return 0.099; };
    assert.equal(cs.rollWeaponEnchant(enchanted), null);
    onWeaponSigilHit(scene, enchanted, target, { damageDealt: 5 });
    assert.equal(scene.gameState.actionsLeft, 4);
    assert.equal(rolls, 1, 'enchant plus stored sigil is exactly one 10% roll');
    rolls = 0;
    onWeaponSigilHit(scene, enchanted, target, { damageDealt: 0 });
    assert.equal(rolls, 0);
    Math.random = () => 0.1;
    onWeaponSigilHit(scene, enchanted, target, { damageDealt: 5 });
    assert.equal(scene.gameState.actionsLeft, 4, 'the exact 10% boundary does not proc');
} finally { Math.random = originalRandom; }

console.log('Sandreach checks passed: all-act roster/boss/pool, Sandstorm, ranged/full-AP bonuses, food, two-hit costs/no chaining, enemy parity, Desert Feast, single-roll Second Wind, Sandglass Scarab +10 cap and save compatibility.');

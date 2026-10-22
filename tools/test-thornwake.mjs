import assert from 'node:assert/strict';
import { MockScene } from '../sim/mock.js';
import { GameState } from '../src/systems/GameState.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { CombatTurnController } from '../src/systems/combat/CombatTurnController.js';
import { armorThornsDamage, companionStrengthBonus, weaponFlatSigilBonus, consumeMirrorSigil, playerWarcryChance } from '../src/systems/combat/SigilEffects.js';
import { buildEnemyCardFromDef } from '../src/content/cards/enemies.js';
import { getEnemyHitAttack } from '../src/content/combat/enemyAttack.js';
import { addSigil, cardSigils, canTakeSigil, WORKING_PLAYER_SIGILS } from '../src/content/sigils/sigils.js';
import { LOCATION_SIGIL_POOLS } from '../src/content/sigils/locationSigils.js';
import { stampForSigil } from '../src/content/sigils/sigilStamps.js';
import { offerableSigils } from '../src/ui/SigilOffer.js';
import { BOSSES } from '../src/content/cards/bosses.js';
import { consumeBriarShield } from '../src/content/combat/briarShield.js';
import { getMagic } from '../src/content/cards/magic.js';
import { getGlowCardFrame, applyEnchantToWeapon, describeWeaponEnchant } from '../src/content/balance/WeaponEnchants.js';
import { SaveManager } from '../src/managers/SaveManager.js';
import { InventoryCombatUse } from '../src/systems/inventory/InventoryCombatUse.js';
import { showBossTooltip } from '../src/ui/ItemTooltip.js';
import { AmuletManager } from '../src/managers/AmuletManager.js';
import { AMULETS } from '../src/content/cards/amulets.js';

function fixture() {
    const scene = new MockScene();
    scene.gameState = new GameState(scene);
    scene.cardSystem = new CardSystem(scene);
    scene.tutorialMode = true;
    scene.createDamageEffect = () => {};
    scene.markCompanionParticipated = () => {};
    scene.inventorySystem = { slots: [], slotSprites: [], playSlotStrikeAnimation() {} };
    scene.gameState.actLocationIds = ['thornwake', null, null];
    scene.gameState.currentFloor = 1;
    scene.gameState.playerHealth = scene.gameState.maxHealth = 100;
    return scene;
}
function enemy(scene, type, extra = {}) {
    return { data: { ...buildEnemyCardFromDef(type, 1), ...extra }, revealed: true,
        sprite: scene.add.image(200, 100, 'enemy') };
}
const equipment = type => ({ type, durability: 3, maxDurability: 3, sigils: [] });

assert.ok(!WORKING_PLAYER_SIGILS.includes('warcry'));
assert.ok(!WORKING_PLAYER_SIGILS.includes('tandem'));
for (const pool of Object.values(LOCATION_SIGIL_POOLS)) {
    assert.ok(!pool.includes('warcry') && !pool.includes('tandem'));
}
assert.ok(AMULETS.some(amulet => amulet.id === 'leadershipBanner'));
const banner = fixture();
banner.amuletManager = new AmuletManager(banner);
banner.gameState.activeAmulets = [{ id: 'leadershipBanner' }];
const bannerCompanion = { type: 'companion', name: 'Companion', attack: 2, attackStyle: 'melee' };
banner.inventorySystem.slots = [bannerCompanion];
banner._simInventory = banner.inventorySystem.slots;
banner.getCompanionEntries = () => [{ companion: bannerCompanion, index: 0 }];
const bannerTarget = enemy(banner, 'skeleton', { health: 100, maxHealth: 100, features: [] });
banner.cardSystem.boardCards = [bannerTarget];
assert.equal(playerWarcryChance(banner), 0.1);
const savedRandom = Math.random;
try {
    Math.random = () => 0;
    let completed = 0;
    const controller = new CombatTurnController(banner);
    controller.runCompanionTurns(() => completed++);
    assert.equal(bannerTarget.data.health, 96, 'one ordinary attack and exactly one free extra action');
    assert.equal(completed, 1, 'completion works with immediate as well as delayed timers');
    banner._runCompanionTurns();
    assert.equal(bannerTarget.data.health, 92, 'headless companions get the same two strikes');
    Math.random = () => 0.1;
    controller.runCompanionTurns();
    assert.equal(bannerTarget.data.health, 90, 'the exact 10% boundary does not trigger');
    Math.random = () => 0;
    for (const hold of ['webbedTurns', 'frozenAttacks', 'shockedTurns']) {
        bannerCompanion[hold] = 1;
        controller.runCompanionTurns();
        assert.equal(bannerTarget.data.health, 90, `${hold} cannot grant a bonus action`);
        bannerCompanion[hold] = 0;
    }
    banner.cardSystem.boardCards = [];
    controller.runCompanionTurns();
    banner.cardSystem.boardCards = [bannerTarget];
    banner.gameState.activeAmulets = [];
    assert.equal(playerWarcryChance(banner), 0);
    controller.runCompanionTurns();
    assert.equal(bannerTarget.data.health, 88, 'removing the Banner removes its extra-action chance');
    const oldWarcry = { ...equipment('weapon'), sigils: [{ id: 'warcry' }] };
    banner.inventorySystem.slots.push(oldWarcry);
    assert.equal(playerWarcryChance(banner), 0.1, 'legacy Warcry keeps working');
    const oldTandem = { ...equipment('weapon'), sigils: [{ id: 'tandem' }] };
    assert.equal(cardSigils(oldTandem)[0].id, 'tandem', 'retirement preserves old cards');
    banner.gameState.activeAmulets = [{ id: 'leadershipBanner', name: 'Leadership Banner' }];
    const saves = new SaveManager();
    saves.saveCurrentRun(banner.gameState, banner.inventorySystem, banner.cardSystem);
    assert.equal(saves.loadCurrentRun().effects.activeAmulets[0].id, 'leadershipBanner');
} finally { Math.random = savedRandom; }
const armor = equipment('armor'), weapon = { ...equipment('weapon'), damage: 5 };
assert.equal(addSigil(weapon, 'thorns'), false);
assert.equal(addSigil(armor, 'thorns'), true);
assert.equal(armor.thornDamage, undefined, 'new sigil must not also award the legacy Briar bonus');
assert.equal(armorThornsDamage(armor), 1);
assert.equal(addSigil(armor, 'mirror'), true);
assert.equal(canTakeSigil(armor, 'kinship'), false, 'Thorns consumes a normal sigil slot');
assert.equal(armorThornsDamage({ ...armor, durability: 0 }), 0);

const scene = fixture();
const packWeapon = { ...equipment('weapon'), sigils: [{ id: 'packStrength' }] };
const bannerWeapon = { ...equipment('weapon'), sigils: [{ id: 'companionStrength' }] };
const kinship = { ...equipment('armor'), sigils: [{ id: 'kinship' }] };
const companions = [{ type: 'companion', attack: 2 }, { type: 'companion', attack: 3, webbedTurns: 1 }];
scene.inventorySystem.slots = [kinship, packWeapon, bannerWeapon, ...companions];
assert.equal(weaponFlatSigilBonus(scene, packWeapon).bonus, 3, 'two companions + unchanged adjacent Kinship');
assert.equal(companionStrengthBonus(scene), 1);
scene.gameState.equippedArmor = bannerWeapon; // A repeated reference is counted only once.
assert.equal(companionStrengthBonus(scene), 1);
scene.gameState.equippedArmor = { ...equipment('armor'), sigils: [{ id: 'companionStrength' }] };
assert.equal(companionStrengthBonus(scene), 2);
bannerWeapon.durability = 0;
assert.equal(companionStrengthBonus(scene), 1);
scene.inventorySystem.slots = [weapon, equipment('armor')];
scene.gameState.equippedArmor = null;
assert.deepEqual(offerableSigils(scene), LOCATION_SIGIL_POOLS.thornwake);
for (const id of LOCATION_SIGIL_POOLS.thornwake) assert.equal(stampForSigil(id).id, 'deer');

const wolf = enemy(scene, 'wolf'), fairy = enemy(scene, 'thornFairy'), ent = enemy(scene, 'thornEnt');
const hiddenFairy = { ...enemy(scene, 'thornFairy'), revealed: false };
const deadFairy = enemy(scene, 'thornFairy', { health: 0 });
const board = [wolf, fairy, ent, hiddenFairy, deadFairy];
assert.equal(getEnemyHitAttack(wolf, board), wolf.data.attack + 3, 'two allies plus fairy aura, applied once');
assert.equal(getEnemyHitAttack(ent, board), ent.data.attack + 1);
assert.equal(getEnemyHitAttack(fairy, board), fairy.data.attack, 'fairy does not buff itself');
fairy.revealed = false;
assert.equal(getEnemyHitAttack(wolf, board), wolf.data.attack + 1, 'hidden/dead allies do not contribute');
assert.equal(getEnemyHitAttack(ent, board), ent.data.attack);
assert.deepEqual(BOSSES.greenWarden.sigils, [{ id: 'thorns' }]);
assert.equal(BOSSES.greenWarden.abilities[0].enemyType, 'wolf');
for (const id of ['thornSprite', 'sporeArcher']) {
    const data = buildEnemyCardFromDef(id, 1);
    assert.deepEqual(data.features, []);
    assert.equal(data.sigils, undefined);
}

// Real enemy attack path: defenses do not swallow armor retaliation, ranged
// attacks trigger it too, and the last armor pip still retaliates once.
const originalRandom = Math.random;
Math.random = () => 0.99;
try {
    const fight = fixture();
    const controller = new CombatTurnController(fight);
    const attacker = enemy(fight, 'sporeArcher', { health: 50, maxHealth: 50, attack: 5, role: 'RANGED', isRangedType: true });
    fight.cardSystem.boardCards = [attacker];
    fight.gameState.equippedArmor = { ...equipment('armor'), protection: 2, durability: 1, sigils: [{ id: 'thorns' }] };
    controller.processEnemyAttack(attacker, 0);
    assert.equal(attacker.data.health, 49);
    assert.equal(fight.gameState.equippedArmor, null);
    fight.gameState.equippedArmor = structuredClone(armor);
    fight.gameState.boneWall = 1;
    fight.gameState.briarShield = 2;
    const hp = fight.gameState.playerHealth;
    controller.processEnemyAttack(attacker, 0);
    assert.equal(attacker.data.health, 48);
    assert.equal(fight.gameState.briarShield, 2, 'blocking preserves reflection charges');
    assert.equal(fight.gameState.playerHealth, hp);
    attacker.data.abilities = [{ type: 'poison', damage: 2, turns: 3 }];
    controller.processEnemyAttack(attacker, 0);
    controller.processEnemyAttack(attacker, 0);
    assert.equal(attacker.data.health, 36, 'each reflected hit deals 5 plus one armor retaliation');
    assert.equal(fight.gameState.briarShield, 0);
    assert.equal(fight.gameState.playerEffects.length, 0, 'reflected hits do not poison the player');
    assert.equal(fight.gameState.playerHealth, hp);
    assert.equal(fight.gameState.mirrorSigilUses || 0, 0, 'Briar Shield preserves the armor Mirror');
    attacker.data.frozen = 1;
    fight.gameState.briarShield = 2;
    controller.processEnemyAttack(attacker, 0);
    assert.equal(fight.gameState.briarShield, 2);
    // Enemy Thorns uses the same visible sigil, including on the boss.
    const thornBoss = enemy(fight, 'thornEnt', { ...structuredClone(BOSSES.greenWarden), maxHealth: 86 });
    fight.cardSystem.boardCards = [thornBoss];
    fight.gameState.equippedArmor = null;
    const before = fight.gameState.playerHealth;
    fight.cardSystem.attackEnemy(0, 2, false, weapon, true);
    assert.equal(fight.gameState.playerHealth, before - 1);
    fight.cardSystem.attackEnemy(0, 2, true);
    assert.equal(fight.gameState.playerHealth, before - 1, 'retaliation never reflects itself');
    // Companion Strength is applied by the actual companion attack loop.
    fight.inventorySystem.slots = [{ ...equipment('weapon'), sigils: [{ id: 'companionStrength' }] }, companions[0]];
    controller.selectCompanionTarget = () => ({ card: thornBoss, index: 0 });
    const bossHP = thornBoss.data.health;
    controller.runCompanionTurn({ companion: companions[0], index: 1 });
    assert.equal(thornBoss.data.health, bossHP - 3);
} finally { Math.random = originalRandom; }

const shield = { briarShield: 2 };
assert.equal(consumeBriarShield(shield, 0), false);
assert.equal(consumeBriarShield(shield, 4), true);
assert.equal(shield.briarShield, 1);
assert.equal(consumeBriarShield(shield, 4), true);
assert.equal(consumeBriarShield(shield, 4), false);
assert.match(getMagic('briarShield').description, /next 2/);
assert.equal(getGlowCardFrame('briarShield'), 2);
assert.equal(applyEnchantToWeapon(weapon, 'briarShield'), true);
assert.ok(cardSigils(weapon).some(s => s.id === 'briarGuard'));
assert.match(describeWeaponEnchant(scene, weapon), /Briar Guard 15%: reflect/);
scene.cardSystem.applyWeaponEnchantOnHit(0, 'briarShield', 3);
assert.equal(scene.gameState.briarShield, 1, 'enchantment readies one reflected attack');
scene.cardSystem.applyWeaponEnchantOnHit(0, 'briarShield', 3);
assert.equal(scene.gameState.briarShield, 1, 'repeated procs do not accumulate charges');
const castSprite = scene.add.image(0, 0, 'briarShield');
const caster = { ...InventoryCombatUse, scene, slots: [{ type: 'magic', ...getMagic('briarShield') }],
    stationMode: true, cleanupCardSprites() {}, removeCard(index) { this.slots[index] = null; } };
caster.useMagicCard(0, castSprite);
assert.equal(scene.gameState.briarShield, 2, 'casting the spell readies two reflections');
assert.equal(caster.slots[0], null, 'casting consumes the magic card');
scene.gameState.briarShield = 1;
const saves = new SaveManager();
saves.saveCurrentRun(scene.gameState, null, null);
const savedRun = saves.loadCurrentRun();
assert.equal(savedRun.effects.briarShield, 1);
delete savedRun.effects.briarShield;
saves.safeSet(saves.RUN_SAVE_KEY, JSON.stringify(savedRun));
assert.equal(saves.loadCurrentRun().effects.briarShield, 0);

// A save must not recharge Mirror in the middle of its fight or erase a
// readied Riposte. The next floor still starts with a fresh reflection.
scene.gameState.equippedArmor = { ...equipment('armor'), sigils: [{ id: 'mirror' }] };
assert.equal(consumeMirrorSigil(scene), true);
scene.gameState.riposteReady = true;
saves.saveCurrentRun(scene.gameState, null, null);
const continued = saves.loadCurrentRun();
const resumed = fixture();
resumed.gameState.equippedArmor = continued.equipment.equippedArmor;
resumed.gameState.currentFloor = continued.player.currentFloor;
Object.assign(resumed.gameState, continued.effects);
assert.equal(consumeMirrorSigil(resumed), false, 'Continue does not grant an extra Mirror reflection');
assert.equal(resumed.gameState.riposteReady, true);
resumed.gameState.currentFloor++;
assert.equal(consumeMirrorSigil(resumed), true, 'a new fight refreshes Mirror');
delete continued.effects.mirrorSigilFloor;
delete continued.effects.mirrorSigilUses;
delete continued.effects.riposteReady;
saves.safeSet(saves.RUN_SAVE_KEY, JSON.stringify(continued));
const legacyEffects = saves.loadCurrentRun().effects;
assert.equal(legacyEffects.mirrorSigilFloor, null);
assert.equal(legacyEffects.mirrorSigilUses, 0);
assert.equal(legacyEffects.riposteReady, false);

// The boss hover must agree with its visible ATK and its actual attack, with
// both ally buffs and weakening. Capture text through the real renderer.
const tooltipScene = fixture();
const tooltipTexts = [];
const originalAdd = tooltipScene.add;
tooltipScene.add = {
    text(x, y, value, style) { tooltipTexts.push(value); return originalAdd.text(x, y, value, style); },
    container: originalAdd.container, rectangle: originalAdd.rectangle, image: originalAdd.image,
};
const tooltipBoss = enemy(tooltipScene, 'thornEnt', { ...structuredClone(BOSSES.greenWarden), maxHealth: 86 });
const tooltipFairy = enemy(tooltipScene, 'thornFairy');
tooltipScene.cardSystem.boardCards = [tooltipBoss, tooltipFairy];
showBossTooltip(tooltipScene, tooltipBoss.data, 100, 100);
assert.match(tooltipTexts[1], /12/);
tooltipBoss.data.sapped = true;
tooltipTexts.length = 0;
showBossTooltip(tooltipScene, tooltipBoss.data, 100, 100);
assert.match(tooltipTexts[1], /8/);
console.log('Thornwake checks passed: local sigils/stamp, companion and pack bonuses, plain creatures, boss retaliation, last-pip and ranged armor Thorns, shield priority/riders, enchant, and saves.');

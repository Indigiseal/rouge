import assert from 'node:assert/strict';
import { MockScene } from '../sim/mock.js';
import { GameState } from '../src/systems/GameState.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { CombatTurnController } from '../src/systems/combat/CombatTurnController.js';
import { regenerateAmount, onWeaponSigilHit, applyWeaponSigils } from '../src/systems/combat/SigilEffects.js';
import { growEnemy, regenerateAllies } from '../src/content/combat/mireturn.js';
import { offerableSigils } from '../src/ui/SigilOffer.js';
import { stampForSigil } from '../src/content/sigils/sigilStamps.js';
import { InventoryCombatUse } from '../src/systems/inventory/InventoryCombatUse.js';
import { getMagic } from '../src/content/cards/magic.js';
import { applyEnchantToWeapon, describeWeaponEnchant } from '../src/content/balance/WeaponEnchants.js';
import { SaveManager } from '../src/managers/SaveManager.js';
import { buildEnemyCardFromDef } from '../src/content/cards/enemies.js';
import { BOSSES } from '../src/content/cards/bosses.js';
import { enemySigils } from '../src/content/sigils/sigils.js';
import { getBossAbilityLines } from '../src/ui/ItemTooltip.js';

const weapon = id => ({ type: 'weapon', weaponType: 'sword', name: 'Sword', damage: 5,
    durability: 5, maxDurability: 5, sigils: id ? [{ id }] : [] });
function fixture() {
    const scene = new MockScene();
    scene.gameState = new GameState(scene);
    scene.cardSystem = new CardSystem(scene);
    scene.gameState.currentFloor = 1;
    scene.gameState.actLocationIds = ['mireturn', null, null];
    scene.gameState.playerHealth = scene.gameState.maxHealth = 100;
    scene.inventorySystem = { slots: [weapon()], slotSprites: [] };
    scene.tutorialMode = true;
    scene.createDamageEffect = () => {};
    return scene;
}
function enemy(scene, extra = {}, revealed = true) {
    return { revealed, sprite: scene.add.image(200, 100, 'enemy'), data: {
        type: 'enemy', health: 10, maxHealth: 20, attack: 5, role: 'MELEE', features: [], ...extra } };
}
for (const act of [1, 2, 3]) {
    const scene = fixture();
    scene.gameState.currentFloor = (act - 1) * 15 + 1;
    scene.gameState.actLocationIds = [null, null, null];
    scene.gameState.actLocationIds[act - 1] = 'mireturn';
    assert.deepEqual(offerableSigils(scene), ['regenerate', 'unscathed', 'growth']);
    scene.inventorySystem.slots = [];
    scene.gameState.equippedArmor = { type: 'armor', durability: 5 };
    assert.deepEqual(offerableSigils(scene), ['regenerate']);
}
for (const id of ['regenerate', 'unscathed', 'growth']) assert.equal(stampForSigil(id).id, 'toad');
for (const floor of [1, 16, 31]) {
    for (const [id, sigils] of Object.entries({ bogSlug: [], fenSpitter: [], mireBrute: ['growth'],
        drowned: ['regenerate'], mireToad: ['regenerate'] })) {
        const data = buildEnemyCardFromDef(id, floor);
        assert.deepEqual(data.features, []);
        assert.deepEqual(enemySigils(data).map(sigil => sigil.id), sigils);
    }
    const scene = fixture();
    scene.gameState.actLocationIds = ['mireturn', 'mireturn', 'mireturn'];
    const boss = scene.cardSystem.cardDataGenerator.createBossCard(floor + 14, scene.gameState);
    assert.equal(boss.name, 'Bog Mermaid');
    assert.equal(boss.sprite, 'MireBride', 'keep temporary art and stable asset keys');
    assert.equal(boss.growthPerAttack, 3);
    assert.deepEqual(enemySigils(boss).map(sigil => sigil.id), ['growth', 'summon']);
    assert.deepEqual(boss.abilities, [{ type: 'summon', enemyType: 'drowned', chance: 0.25, count: 1 }]);
}
assert.match(getBossAbilityLines(fixture(), BOSSES.mireBride).join('\n'), /Growth: \+3 maximum HP/);

// Exercise inventory attacks rather than only the helper. In particular,
// eliteEnemy is a valid target throughout selection and execution.
for (const type of ['enemy', 'eliteEnemy', 'boss']) {
    const attackScene = fixture(), growthWeapon = weapon('growth');
    const target = enemy(attackScene, { type, health: 1 });
    attackScene.cardSystem.boardCards = [target];
    attackScene.inventorySystem.slots = [growthWeapon];
    const attacker = { ...InventoryCombatUse, scene: attackScene, slots: [growthWeapon],
        playWeaponStrikeEffect() {}, updateWeaponInfoText() {}, returnWeaponToSlotDelayed() {},
        returnWeaponToSlot() {} };
    attacker.useWeapon(0, attackScene.add.image(200, 100, 'weapon'));
    assert.equal(attackScene.gameState.maxHealth, 101, `${type}: killing weapon hit grants Growth once`);
    assert.equal(attackScene.gameState.playerHealth, 100);
    assert.equal(growthWeapon.durability, 4, 'the attack spends its normal pip');
}

const scene = fixture(), gs = scene.gameState, cs = scene.cardSystem;
const regen = weapon('regenerate'), companion = { type: 'companion', attack: 1 };
scene.inventorySystem.slots = [regen];
assert.equal(regenerateAmount(scene), 0, 'no companions means no regeneration');
scene.inventorySystem.slots.push(companion, { type: 'companion', attack: 1, webbedTurns: 1 });
assert.equal(regenerateAmount(scene), 2, 'temporarily locked companions still count');
gs.equippedArmor = { type: 'armor', durability: 1, sigils: [{ id: 'regenerate' }] };
assert.equal(regenerateAmount(scene), 4, 'each intact source contributes');
scene.inventorySystem.slots.push(gs.equippedArmor);
assert.equal(regenerateAmount(scene), 4, 'worn/bag references cannot double count');
regen.durability = 0;
assert.equal(regenerateAmount(scene), 2, 'broken gear cannot regenerate');
gs.playerHealth = 99;
new CombatTurnController(scene).finishEnemyTurnEffects({ runCompanions: false });
assert.equal(gs.playerHealth, 100, 'live regeneration caps at maximum HP');
gs.playerHealth = 90;
scene._finishEnemyTurnEffects({ runCompanions: false });
assert.equal(gs.playerHealth, 92, 'headless regeneration follows the same rule');

const target = enemy(scene), growth = weapon('growth');
onWeaponSigilHit(scene, growth, target, { damageDealt: 0 });
assert.equal(gs.maxHealth, 100);
assert.ok(onWeaponSigilHit(scene, growth, target, { damageDealt: 1 }).includes('growth'));
assert.equal(gs.maxHealth, 101);
assert.equal(gs.playerHealth, 92, 'Growth does not heal current HP');
cs.boardCards = [target];
scene.inventorySystem.slots = [growth];
gs.equippedArmor = null;
const attacker = { ...InventoryCombatUse, scene, slots: [growth],
    playWeaponStrikeEffect() {}, updateWeaponInfoText() {}, returnWeaponToSlotDelayed() {},
    returnWeaponToSlot() {} };
attacker.useWeapon(0, scene.add.image(200, 100, 'weapon'));
assert.equal(gs.maxHealth, 102, 'real weapon attacks trigger Growth once');
assert.equal(gs.playerHealth, 92);
gs.playerHealth = gs.maxHealth;
assert.equal(applyWeaponSigils(scene, weapon('unscathed'), target, 5).damage, 7);
gs.playerHealth--;
assert.equal(applyWeaponSigils(scene, weapon('unscathed'), target, 5).damage, 5);

const healer = enemy(scene, { sigils: [{ id: 'regenerate' }] });
const secondHealer = enemy(scene, { sigils: [{ id: 'regenerate' }] });
const ally = enemy(scene), hidden = enemy(scene, {}, false);
const dead = enemy(scene, { health: 0 }), pile = enemy(scene, { isBonePile: true, health: 1 });
const shell = enemy(scene, { features: ['cocoon_shell'] });
const loot = enemy(scene, { type: 'weapon' });
let board = [healer, ally, hidden, dead, pile, shell, loot, healer];
assert.equal(regenerateAllies(board, card => scene.isEnemyCard(card)).length, 1);
assert.equal(healer.data.health, 10, 'a lone healer cannot heal itself');
assert.equal(ally.data.health, 11);
for (const card of [hidden, shell, loot]) assert.equal(card.data.health, 10);
assert.equal(dead.data.health, 0);
board = [healer, secondHealer, ally];
regenerateAllies(board, card => scene.isEnemyCard(card));
assert.equal(healer.data.health, 11);
assert.equal(secondHealer.data.health, 11, 'healers can sustain one another');
assert.equal(ally.data.health, 13, 'multiple healers add their healing');
ally.data.health = 19;
regenerateAllies(board, card => scene.isEnemyCard(card));
assert.equal(ally.data.health, 20);
cs.boardCards = [healer, ally];
ally.data.health = 10;
new CombatTurnController(scene).finishEnemyTurnEffects({ runCompanions: false });
assert.equal(ally.data.health, 11);
scene._finishEnemyTurnEffects({ runCompanions: false });
assert.equal(ally.data.health, 12);

const growing = enemy(scene, { sigils: [{ id: 'growth' }] });
cs.boardCards = [growing];
const controller = new CombatTurnController(scene);
gs.boneWall = 1;
controller.processEnemyAttack(growing, 0);
assert.equal(growing.data.maxHealth, 21, 'an attack grows even if blocked');
assert.equal(growing.data.health, 10);
growing.data.frozen = 1;
controller.processEnemyAttack(growing, 0);
assert.equal(growing.data.maxHealth, 21, 'skipping an attack does not grow');
growing.data.growthPerAttack = 3;
assert.equal(growEnemy(growing), 3);
assert.equal(growing.data.maxHealth, 24);
scene.runEnemyTurn();
assert.equal(growing.data.maxHealth, 27, 'headless attacks grow too');

const spell = { type: 'magic', ...getMagic('restoration') };
gs.playerHealth = 1;
gs.actionsLeft = 0;
const caster = { ...InventoryCombatUse, scene, slots: [spell], stationMode: true,
    cleanupCardSprites() {}, removeCard(index) { this.slots[index] = null; } };
caster.useMagicCard(0, scene.add.image(0, 0, 'recovery'));
assert.equal(gs.playerHealth, gs.maxHealth);
assert.equal(gs.actionsLeft, gs.maxActions);
assert.equal(caster.slots[0], null);
const renewed = weapon();
assert.equal(applyEnchantToWeapon(renewed, 'restoration'), true);
assert.match(renewed.name, /^Renewal /);
assert.match(describeWeaponEnchant(renewed), /Renewal.*heal 3 HP/);
gs.playerHealth = gs.maxHealth - 2;
cs.applyWeaponEnchantOnHit(0, 'restoration', 5);
assert.equal(gs.playerHealth, gs.maxHealth, 'Renewal still heals 3, capped at maximum');

const manager = new SaveManager();
scene.inventorySystem.slots = [growth];
manager.saveCurrentRun(gs, scene.inventorySystem, cs);
const continued = manager.loadCurrentRun();
assert.equal(continued.player.maxHealth, 102);
assert.equal(continued.board.cards[0].data.maxHealth, 27);
assert.equal(continued.board.cards[0].data.health, 10);
assert.equal(continued.equipment.inventory[0].sigils[0].id, 'growth');
const oldHealingWeapon = { ...weapon(), enchant: 'restoration', name: 'Mending Sword', enchantChance: 0.27 };
const refreshed = manager.refreshMagicCard(oldHealingWeapon);
assert.equal(refreshed.name, 'Renewal Sword');
assert.equal(refreshed.enchantChance, 0.27);
assert.equal(oldHealingWeapon.name, 'Mending Sword', 'save metadata refresh does not mutate the original');

// The actual boss and its healer work together: growth opens capacity, then
// a living minion fills it. Removing that minion cuts off the boss's healing.
const encounter = fixture(), encounterGs = encounter.gameState;
encounterGs.playerHealth = encounterGs.maxHealth = 1000;
const mermaid = enemy(encounter, { ...structuredClone(BOSSES.mireBride), health: 158, maxHealth: 158 });
const minion = enemy(encounter, buildEnemyCardFromDef('drowned', 1));
encounter.cardSystem.boardCards = [mermaid, minion];
const encounterController = new CombatTurnController(encounter);
encounterController.processEnemyAttack(mermaid, 0);
assert.equal(mermaid.data.maxHealth, 161);
assert.equal(mermaid.data.health, 158);
encounterController.finishEnemyTurnEffects({ runCompanions: false });
assert.equal(mermaid.data.health, 159);
minion.data.health = 0;
encounterController.processEnemyAttack(mermaid, 0);
encounterController.finishEnemyTurnEffects({ runCompanions: false });
assert.equal(mermaid.data.maxHealth, 164);
assert.equal(mermaid.data.health, 159, 'a defeated healer no longer sustains the boss');
const savedMermaid = new SaveManager().serializeBoardCards([mermaid])[0].data;
assert.equal(savedMermaid.growthPerAttack, 3);
assert.equal(savedMermaid.maxHealth, 164);
assert.equal(savedMermaid.health, 159);
assert.equal(BOSSES.mireBride.health, 158, 'fight changes do not mutate the shared boss definition');

// The real queue requests healing Drowned rather than the old poisoned cast.
const summons = fixture(), queuedBoss = enemy(summons, { ...structuredClone(BOSSES.mireBride), frozen: 1 });
summons.cardSystem.boardCards = [queuedBoss];
const summoned = [];
summons.cardSystem.summonEnemy = id => { summoned.push(id); return true; };
const summonController = new CombatTurnController(summons);
summonController.tickHandWebs = () => {};
summonController.finishEnemyTurnEffects = () => {};
const previousRandom = Math.random;
try {
    Math.random = () => 0;
    summonController.revealedEnemiesAttack();
    assert.deepEqual(summoned, ['drowned']);
} finally { Math.random = previousRandom; }
console.log('Mireturn checks passed: all-act roster/boss, local rewards, toad stamps, companion regeneration, ally healing, growth, elite/killing attacks, mermaid/healer synergy, summons, live/headless parity, Restoration, Renewal, Unscathed and saves.');

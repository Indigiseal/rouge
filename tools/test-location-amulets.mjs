import assert from 'node:assert/strict';
import { MockScene } from '../sim/mock.js';
import { GameState } from '../src/systems/GameState.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { AmuletManager } from '../src/managers/AmuletManager.js';
import { AMULETS } from '../src/content/cards/amulets.js';
import { onWeaponSigilHit } from '../src/systems/combat/SigilEffects.js';
import { WORKING_PLAYER_SIGILS, cardSigils } from '../src/content/sigils/sigils.js';
import { LOCATION_SIGIL_POOLS } from '../src/content/sigils/locationSigils.js';
import { SaveManager } from '../src/managers/SaveManager.js';
import { InventorySystem } from '../src/systems/InventorySystem.js';
import { refreshWeaponValueText } from '../src/systems/board/BoardCardFx.js';

globalThis.Phaser.Scene = class {};
const { GameScene } = await import('../src/scenes/GameScene.js');

function fixture(...amulets) {
    const scene = new MockScene();
    scene.gameState = new GameState(scene);
    scene.cardSystem = new CardSystem(scene);
    scene.amuletManager = new AmuletManager(scene);
    scene.gameState.currentFloor = 1;
    scene.gameState.playerHealth = scene.gameState.maxHealth = 100;
    scene.gameState.activeAmulets = amulets.map(id => ({ id }));
    scene.inventorySystem = { slots: [], slotSprites: [] };
    scene.createDamageEffect = () => {};
    scene.tutorialMode = true;
    return scene;
}
const weapon = (...ids) => ({ type: 'weapon', weaponType: 'sword', damage: 5,
    durability: 5, maxDurability: 5, sigils: ids.map(id => ({ id })) });
const card = (scene, type = 'enemy', extra = {}) => ({ revealed: type === 'enemy',
    sprite: scene.add.image(200, 100, 'enemy'), data: {
        type, name: type, health: 50, maxHealth: 50, role: 'MELEE', features: [], ...extra } });
const scene = fixture('goblinSpyglass'), cs = scene.cardSystem;
const target = card(scene), safe = card(scene, 'food'), trap = card(scene, 'trap');
const hidden = card(scene); hidden.revealed = false;
const boss = card(scene, 'boss'); boss.revealed = false;
const mimic = card(scene, 'enemy', { isMimic: true }); mimic.revealed = false;
const dormant = card(scene, 'food', { tutorialDormant: true });
cs.boardCards = [target, safe, trap, hidden, boss, mimic, dormant];
const reveals = [];
cs.revealCard = (index, free) => { reveals.push({ index, free }); cs.boardCards[index].revealed = true; };

for (const id of ['scout', 'ransom']) {
    assert.ok(!WORKING_PLAYER_SIGILS.includes(id));
    assert.equal(cardSigils(weapon(id))[0].id, id, 'old sigils remain readable');
    for (const pool of Object.values(LOCATION_SIGIL_POOLS)) assert.ok(!pool.includes(id));
}
for (const id of ['monocle', 'goblinSpyglass', 'vacancyStep', 'boneSpool', 'duneQuiver']) {
    assert.equal(AMULETS.filter(item => item.id === id).length, 1);
}
assert.equal(scene.amuletManager.amuletDefinitions.monocle.crystalOnKillChance, 0.03);
assert.equal(scene.amuletManager.amuletDefinitions.vacancyStep.name, 'Bone Hook');
assert.equal(scene.amuletManager.amuletDefinitions.vacancyStep.strategyCluster, true);
assert.equal(scene.amuletManager.amuletDefinitions.vacancyStep.originLocationId, 'boneflood');
assert.equal(scene.amuletManager.getScoutOnHitChance(), 0.15);
const originalRandom = Math.random;
try {
    Math.random = () => 0.149;
    assert.ok(!onWeaponSigilHit(scene, weapon(), target, { damageDealt: 0 }).includes('scout'));
    assert.ok(onWeaponSigilHit(scene, weapon(), target, { damageDealt: 5 }).includes('scout'));
    assert.deepEqual(reveals, [{ index: 1, free: true }]);
    onWeaponSigilHit(scene, weapon(), target, { damageDealt: 5 });
    assert.equal(reveals.length, 1, 'enemies, bosses, mimics, traps and tutorial cards stay closed');
    safe.revealed = false;
    Math.random = () => 0.15;
    onWeaponSigilHit(scene, weapon(), target, { damageDealt: 5 });
    assert.equal(reveals.length, 1, 'exact 15% does not proc');
    Math.random = () => 0.149;
    onWeaponSigilHit(scene, weapon('scout'), target, { damageDealt: 5 });
    assert.equal(reveals.length, 2, 'amulet and legacy Scout reveal only one card');
    scene.gameState.activeAmulets = [];
    safe.revealed = false;
    onWeaponSigilHit(scene, weapon(), target, { damageDealt: 5 });
    assert.equal(reveals.length, 2);
    onWeaponSigilHit(scene, weapon('scout'), target, { damageDealt: 5 });
    assert.equal(reveals.length, 3, 'legacy Scout works without the amulet');

    const ransom = fixture('monocle');
    Math.random = () => 0.0299;
    assert.deepEqual(ransom.amuletManager.rollMonocleCrystalReward(), { kind: 'crystal', amount: 1 });
    Math.random = () => 0.03;
    assert.equal(ransom.amuletManager.rollMonocleCrystalReward(), null);
    const victim = card(ransom, 'enemy', { health: 1 });
    ransom.cardSystem.boardCards = [victim, card(ransom)];
    Math.random = () => 0.0299;
    ransom.cardSystem.attackEnemy(0, 10, true);
    assert.equal(ransom.gameState.crystals, 1, 'normal kill handling grants the crystal exactly once');
    ransom.cardSystem.removeDefeatedEnemy(0, victim);
    assert.equal(ransom.gameState.crystals, 1);
    ransom.gameState.activeAmulets = [];
    assert.equal(ransom.amuletManager.rollMonocleCrystalReward(), null);
    const legacy = fixture();
    const dead = card(legacy, 'enemy', { health: 0 });
    Math.random = () => 0.099;
    onWeaponSigilHit(legacy, weapon('ransom'), dead, { damageDealt: 1 });
    assert.equal(legacy.gameState.crystals, 1, 'old Ransom weapons preserve their 10% rule');

    const old = fixture();
    old.gameState.activeAmulets = [{ id: 'monocle', name: 'Monocle' }, { id: 'vacancyStep', name: 'Close Order' },
        { id: 'goblinSpyglass', name: "Goblin's Spyglass" }];
    const saves = new SaveManager();
    saves.saveCurrentRun(old.gameState, old.inventorySystem, old.cardSystem);
    const continued = saves.loadCurrentRun();
    assert.deepEqual(continued.effects.activeAmulets.map(item => item.name), ["Goblin's Ransom", 'Bone Hook', "Goblin's Spyglass"]);
    assert.deepEqual(continued.effects.activeAmulets.map(item => item.id), ['monocle', 'vacancyStep', 'goblinSpyglass']);
    assert.equal(old.gameState.maxActions, 15);
} finally { Math.random = originalRandom; }

// Exercise the actual discard drag and scene reward hook. The source is still
// in the bag while the hook runs, and must never become the repair target.
{
    const scene = fixture('boneSpool');
    const discarded = weapon(), damaged = weapon(), full = weapon(), broken = weapon();
    discarded.durability = damaged.durability = 2;
    broken.durability = 0;
    const armor = { type: 'armor', durability: 1, maxDurability: 3 };
    const inventory = Object.create(InventorySystem.prototype);
    const sprite = scene.add.image(100, 100, 'card');
    Object.assign(inventory, {
        scene, slots: [discarded, damaged, full, broken, armor], slotSprites: [],
        discardArea: scene.add.image(100, 100, 'discard'),
        cleanupCardSprites() {},
        removeCard(index) { this.slots[index] = null; },
    });
    scene.inventorySystem = inventory;
    scene.gameState.equippedArmor = armor; // Also in bag: one candidate, not two.
    scene.recordCardDiscarded = GameScene.prototype.recordCardDiscarded.bind(scene);
    scene.updateRelicsUI = () => {};
    const intersect = Phaser.Geom.Intersects.RectangleToRectangle;
    try {
        Phaser.Geom.Intersects.RectangleToRectangle = () => true;
        Math.random = () => 0.49;
        inventory.handleCardDrop(0, sprite);
        assert.equal(inventory.slots[0], null);
        assert.equal(discarded.durability, 2, 'discarded source cannot consume its repair');
        assert.equal(damaged.durability, 3, 'one random remaining item gains exactly one pip');
        assert.equal(armor.durability, 1, 'worn bag armor is deduplicated');
        assert.equal(full.durability, 5);
        assert.equal(broken.durability, 0);
        assert.equal(scene.gameState.actionsLeft, 15, 'discarding remains free');
        assert.equal(scene.gameState.discardedCardsThisRun, 1);
        Math.random = () => 0.99;
        scene.recordCardDiscarded({ type: 'gem' });
        assert.equal(armor.durability, 2, 'discarded gems can repair worn armor');
        damaged.durability = 5;
        scene.amuletManager.processCardDiscard({ type: 'food' });
        assert.equal(armor.durability, 3);
        assert.equal(scene.amuletManager.processCardDiscard({ type: 'food' }), null, 'no damaged item is a no-op');
        armor.durability = 2;
        scene.gameState.activeAmulets = [];
        assert.equal(scene.amuletManager.processCardDiscard({ type: 'food' }), null);
        assert.equal(armor.durability, 2, 'unequipping stops repairs');
    } finally {
        Math.random = originalRandom;
        Phaser.Geom.Intersects.RectangleToRectangle = intersect;
    }
}

try {
    const scene = fixture('duneQuiver');
    Math.random = () => 0.99;
    const bow = { ...weapon(), weaponType: 'bow', range: 'ranged' };
    const sword = weapon();
    const spear = { ...weapon(), weaponType: 'spear', special: 'pierce' };
    assert.equal(scene.amuletManager.modifyWeaponDamage(5, bow), 6);
    assert.equal(scene.amuletManager.modifyWeaponDamage(5, sword), 5);
    assert.equal(scene.amuletManager.modifyWeaponDamage(5, spear), 5, 'spears receive no quiver bonus');
    assert.equal(scene.amuletManager.modifyWeaponDamage(5, { ...spear, range: 'ranged' }), 5, 'even a thrown spear is not a bow');
    assert.equal(scene.amuletManager.modifyWeaponDamage(5, { ...sword, weaponType: 'wand', range: 'ranged' }), 5, 'other ranged weapons receive no quiver bonus');
    assert.equal(scene.amuletManager.modifyWeaponDamage(5, { ...bow, range: undefined }), 6, 'the bonus follows bow identity');
    assert.equal(scene.amuletManager.modifyWeaponDamage(5), 5, 'spells and companion damage receive no quiver bonus');
    const target = card(scene);
    scene.cardSystem.boardCards = [target, card(scene)];
    scene.cardSystem.rollEvade = () => false;
    scene.cardSystem.attackEnemy(0, 5, false, bow, true);
    assert.equal(target.data.health, 44, 'the real combat path applies the bonus once');
    scene.cardSystem.attackEnemy(0, 5, false, sword, true);
    assert.equal(target.data.health, 39);
    scene.inventorySystem.slots = [bow];
    const label = { scene, text: '5', setText(value) { this.text = value; }, setColor() {} };
    refreshWeaponValueText(scene, { _weaponDamageText: label, _weaponData: bow });
    assert.equal(label.text, '6', 'carried weapon number matches its boosted hit');
    scene.gameState.activeAmulets = [{ id: 'duneQuiver', name: 'Old Quiver' }, { id: 'boneSpool', name: 'Old Spool' }];
    const saves = new SaveManager();
    saves.saveCurrentRun(scene.gameState, scene.inventorySystem, scene.cardSystem);
    const run = saves.loadCurrentRun();
    assert.deepEqual(run.effects.activeAmulets.map(item => item.name), ['Dune Quiver', 'Bone Spool']);
    scene.gameState.activeAmulets = run.effects.activeAmulets;
    assert.equal(scene.amuletManager.modifyWeaponDamage(5, bow), 6, 'continue does not double the bonus');
    scene.gameState.activeAmulets = [];
    refreshWeaponValueText(scene, { _weaponDamageText: label, _weaponData: bow });
    assert.equal(label.text, '5', 'removing the quiver updates the printed number');
    assert.equal(bow.damage, 5, 'base stats are never rewritten');
} finally { Math.random = originalRandom; }

{
    const identities = [
        ['runeOfFire', 'Emberstone', 'ashhowl'], ['greaterRuneOfFire', 'Molten Heart', 'ashhowl'],
        ['runeOfZap', 'Storm Shard', 'stormhatch'], ['greaterRuneOfZap', 'Tempest Heart', 'stormhatch'],
        ['runeOfPoison', 'Spider Fang', 'silkdeep'], ['greaterRuneOfPoison', "Broodmother's Fang", 'silkdeep'],
    ];
    const scene = fixture(...identities.map(([id]) => id));
    for (const [id, name, origin] of identities) {
        const def = scene.amuletManager.amuletDefinitions[id];
        assert.equal(def.name, name);
        assert.equal(def.originLocationId, origin);
        assert.equal(AMULETS.filter(item => item.id === id && item.name === name).length, 1);
    }
    assert.equal(scene.amuletManager.getFireSplashRadiusMultiplier(), 1.5);
    assert.equal(scene.amuletManager.getLightningExtraBounces(), 1);
    assert.equal(scene.amuletManager.getPoisonGemSplashTargets(), 1);
    assert.equal(scene.amuletManager.modifyGemDamage(6, 'fire'), 8);
    assert.equal(scene.amuletManager.modifyGemDamage(6, 'lightning'), 8);
    assert.equal(scene.amuletManager.modifyPoisonGemTickDamage(1), 3);
    // Old names are refreshed without changing the IDs that hooks/offers use.
    scene.gameState.activeAmulets = identities.map(([id]) => ({ id, name: 'Old Rune Name', level: 1 }));
    const saves = new SaveManager();
    saves.saveCurrentRun(scene.gameState, scene.inventorySystem, scene.cardSystem);
    const run = saves.loadCurrentRun();
    assert.deepEqual(run.effects.activeAmulets.map(item => item.name), identities.map(([, name]) => name));
    assert.deepEqual(run.effects.activeAmulets.map(item => item.id), identities.map(([id]) => id));
    assert.equal(scene.amuletManager.amuletDefinitions.glovesOfHermitWizard.replaces.includes('runeOfZap'), true);
}

{
    const scene = fixture('travelKitchen');
    const mgr = scene.amuletManager;
    assert.equal(mgr.amuletDefinitions.travelKitchen.name, 'Sandspice Pouch');
    assert.equal(mgr.amuletDefinitions.travelKitchen.originLocationId, 'sandreach');
    assert.equal(mgr.amuletDefinitions.travelKitchen.rarity, 'uncommon');
    assert.equal(AMULETS.filter(item => item.id === 'travelKitchen').length, 1);
    assert.equal(mgr.modifyFoodAP(5), 7, 'the original food effect rounds down');
    assert.equal(mgr.modifyFoodAP(15), 22);
    const gen = scene.cardSystem.cardDataGenerator;
    assert.ok(!gen.getAmuletsOfRarity('uncommon', 9).some(item => item.id === 'travelKitchen'));
    assert.ok(gen.getAmuletsOfRarity('uncommon', 10).some(item => item.id === 'travelKitchen'));
    assert.ok(!gen.getAmuletsOfRarity('uncommon', 10, scene.gameState).some(item => item.id === 'travelKitchen'),
        'old owners cannot roll a second copy under the new name');
    const inv = Object.create(InventorySystem.prototype);
    Object.assign(inv, { scene, slots: [null], slotSprites: [],
        hideCardTooltip() {}, updateTwinkleEffects() {},
    });
    scene.inventorySystem = inv;
    const consume = (amount) => {
        const food = { type: 'food', name: 'Food', actionAmount: amount };
        inv.slots[0] = food;
        assert.equal(inv.useFood(0, null), true);
        assert.equal(inv.slots[0], null);
        assert.equal(food.actionAmount, amount, 'food base stats stay unchanged');
    };
    scene.gameState.maxActions = 40;
    scene.gameState.actionsLeft = 0;
    consume(15);
    assert.equal(scene.gameState.actionsLeft, 22, 'real food consumption uses the bonus');
    scene.gameState.actionsLeft = 39;
    consume(5);
    assert.equal(scene.gameState.actionsLeft, 40, 'food still respects the AP maximum');
    scene.gameState.activeAmulets = [{ id: 'travelKitchen' }, { id: 'gluttonsCharm' }, { id: 'mossyStone' }];
    scene.gameState.maxActions = 15;
    scene.gameState.actionsLeft = 0;
    consume(5);
    assert.equal(scene.gameState.actionsLeft, 7);
    assert.equal(scene.gameState.maxActions, 16, 'Sandglass Scarab still grants exactly one maximum AP per meal');
    assert.equal(scene.gameState.gluttonMaxApGained, 1);
    assert.equal(scene.gameState.mossyMaxHpGained, 0, 'food use is not a merge');
    assert.equal(scene.gameState.playerHealth, 100);
    scene.gameState.activeAmulets = [{ id: 'travelKitchen', name: 'Travel Kitchen', level: 1 }];
    const saves = new SaveManager();
    saves.saveCurrentRun(scene.gameState, inv, scene.cardSystem);
    const run = saves.loadCurrentRun();
    assert.equal(run.effects.activeAmulets[0].name, 'Sandspice Pouch');
    scene.gameState.activeAmulets = run.effects.activeAmulets;
    assert.equal(mgr.modifyFoodAP(15), 22, 'continue preserves one effect, without replaying it');
    scene.gameState.activeAmulets = [];
    assert.equal(mgr.modifyFoodAP(15), 15);
    for (const [id, origin] of [
        ['keepersWard', 'boneflood'], ['vampireFang', 'veilbleed'], ['sirensPendant', 'veilbleed'],
        ['plagueHeart', 'silkdeep'], ['leadershipBanner', 'thornwake'], ['maskOfEmbers', 'ashhowl'],
    ]) {
        assert.equal(mgr.amuletDefinitions[id].originLocationId, origin);
        assert.equal(AMULETS.find(item => item.id === id).originLocationId, origin);
    }
}
console.log('Location amulet checks passed: goblin effects, discard repair, ranged damage/display, elemental identities, Sandspice food/Scarab synergy, global drops and save continuity.');

import assert from 'node:assert/strict';
import { MockScene } from '../sim/mock.js';
import { GameState } from '../src/systems/GameState.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { applyScorched, takeBurnTick, addPlayerBurn, takePlayerBurnTick } from '../src/content/combat/ashhowl.js';
import { onWeaponSigilHit } from '../src/systems/combat/SigilEffects.js';
import { CombatTurnController } from '../src/systems/combat/CombatTurnController.js';
import { cardSigils, takenSigils, WORKING_PLAYER_SIGILS } from '../src/content/sigils/sigils.js';
import { offerableSigils } from '../src/ui/SigilOffer.js';
import { InventoryCombatUse } from '../src/systems/inventory/InventoryCombatUse.js';
import { getMagic } from '../src/content/cards/magic.js';
import { applyEnchantToWeapon, getEnchantChance, describeWeaponEnchant } from '../src/content/balance/WeaponEnchants.js';
import { SaveManager } from '../src/managers/SaveManager.js';
import { buildEnemyCardFromDef } from '../src/content/cards/enemies.js';
import { getBossAbilityLines } from '../src/ui/ItemTooltip.js';
import { BOSSES } from '../src/content/cards/bosses.js';
import { enemySigils } from '../src/content/sigils/sigils.js';
import { CombatHud } from '../src/ui/CombatHud.js';

function fixture() {
    const scene = new MockScene();
    scene.gameState = new GameState(scene);
    scene.cardSystem = new CardSystem(scene);
    scene.gameState.currentFloor = 1;
    scene.gameState.actLocationIds = ['ashhowl', null, null];
    scene.gameState.playerHealth = scene.gameState.maxHealth = 100;
    scene.inventorySystem = { slots: [{ type: 'weapon', damage: 5, durability: 4, maxDurability: 4 }] };
    scene.createDamageEffect = () => {};
    scene.tutorialMode = true;
    return scene;
}
function enemy(scene, revealed = true, extra = {}) {
    return { revealed, data: { type: 'enemy', name: 'Skeleton', health: 50, maxHealth: 50,
        attack: 5, features: [], ...extra }, sprite: scene.add.image(200, 100, 'enemy') };
}

for (const act of [1, 2, 3]) {
    const scene = fixture();
    scene.gameState.currentFloor = (act - 1) * 15 + 1;
    scene.gameState.actLocationIds = [null, null, null];
    scene.gameState.actLocationIds[act - 1] = 'ashhowl';
    assert.deepEqual(offerableSigils(scene), ['fireball', 'scorched', 'smoke']);
    scene.gameState.storyRun = { sigilsTaken: ['tsunami'] };
    assert.deepEqual(offerableSigils(scene), ['fireball', 'smoke'], 'old Tsunami rewards cannot be taken again as Scorched');
}
assert.ok(!WORKING_PLAYER_SIGILS.includes('tsunami'));
assert.ok(!WORKING_PLAYER_SIGILS.includes('heatproof'));
assert.deepEqual(cardSigils({ sigils: [{ id: 'tsunami' }] }), [{ id: 'scorched', level: 1 }]);
assert.deepEqual(takenSigils({ storyRun: { sigilsTaken: ['tsunami', 'scorched'] } }), ['scorched']);
const scene = fixture(), cs = scene.cardSystem;
const open = enemy(scene), hidden = enemy(scene, false), boss = enemy(scene, true, { type: 'boss' });
const loot = { revealed: false, data: { type: 'weapon', health: 50 } };
const dead = enemy(scene, false, { health: 0 });
cs.boardCards = [open, hidden, boss, loot, dead];
assert.equal(applyScorched(cs), 3);
assert.equal(loot.data.burn, undefined);
assert.equal(dead.data.burn, undefined);
assert.equal(open.data.health, 50, 'application does not deal an instant hit');
for (const [health, counter] of [[47, 2], [45, 1], [44, 0]]) {
    cs.processEnemyBurnEffects();
    for (const card of [open, hidden, boss]) {
        assert.equal(card.data.health, health);
        assert.equal(card.data.burn, counter);
    }
    assert.equal(hidden.revealed, false);
}
applyScorched(cs);
applyScorched(cs);
assert.equal(open.data.burn, 6);
cs.processEnemyBurnEffects();
assert.equal(open.data.burn, 5);
assert.equal(open.data.health, 38, 'two applications combine to 6, not two separate 3-point effects');
applyScorched(cs);
assert.equal(open.data.burn, 8, 'reapplication adds 3 to remaining burn');
assert.match(getBossAbilityLines(scene, open.data).join('\n'), /Burn 8/);
const bare = { burn: 3 };
assert.deepEqual([takeBurnTick(bare), takeBurnTick(bare), takeBurnTick(bare), takeBurnTick(bare)], [3, 2, 1, 0]);

const heat = fixture();
const resistant = enemy(heat, false, { features: ['heatproof'] });
heat.cardSystem.boardCards = [resistant];
applyScorched(heat.cardSystem);
for (let turn = 0; turn < 3; turn++) heat.cardSystem.processEnemyBurnEffects();
assert.equal(resistant.data.health, 46, 'existing Heatproof makes 3/2/1 fire become 2/1/1');
const saved = new SaveManager().serializeBoardCards(cs.boardCards);
assert.equal(saved[1].data.burn, 8);
assert.equal(saved[1].revealed, false);

const originalRandom = Math.random;
try {
    const proc = fixture();
    const target = enemy(proc), other = enemy(proc, false);
    proc.cardSystem.boardCards = [target, other];
    const weapon = { type: 'weapon', sigils: [{ id: 'scorched' }] };
    Math.random = () => 0.1;
    assert.ok(!onWeaponSigilHit(proc, weapon, target, { damageDealt: 1 }).includes('scorched'));
    Math.random = () => 0.099;
    assert.ok(onWeaponSigilHit(proc, weapon, target, { damageDealt: 1 }).includes('scorched'));
    assert.equal(other.data.burn, 3);
    onWeaponSigilHit(proc, weapon, target, { damageDealt: 0 });
    assert.equal(other.data.burn, 3, 'misses cannot trigger Scorched');
    const legacyWeapon = { type: 'weapon', sigils: [{ id: 'tsunami' }] };
    assert.ok(onWeaponSigilHit(proc, legacyWeapon, target, { damageDealt: 1 }).includes('scorched'));
    assert.equal(other.data.burn, 6);
    const enchanted = { type: 'weapon', name: 'Sword' };
    applyEnchantToWeapon(enchanted, 'scorched');
    assert.equal(getEnchantChance('scorched'), 0.1);
    assert.match(describeWeaponEnchant(proc, enchanted), /10%/);
    assert.ok(onWeaponSigilHit(proc, enchanted, target, { damageDealt: 1 }).includes('scorched'));
    assert.equal(other.data.burn, 9, 'one enchant proc adds exactly 3');

    // Real turn completion ticks hidden burn even without an attacker.
    const ticking = fixture();
    const concealed = enemy(ticking, false);
    ticking.cardSystem.boardCards = [concealed];
    applyScorched(ticking.cardSystem);
    const controller = new CombatTurnController(ticking);
    controller.finishEnemyTurnEffects({ runCompanions: false });
    assert.equal(concealed.data.health, 47);

    const bones = fixture();
    const heap = enemy(bones, true, { ...buildEnemyCardFromDef('boneHeap', 1), health: 2, burn: 3 });
    bones.cardSystem.boardCards = [heap];
    bones.cardSystem.processEnemyBurnEffects();
    assert.equal(heap.data.isBonePile, true);
    assert.equal(heap.data.burn, 0, 'reassembly clears burn just like poison and frozen statuses');
} finally { Math.random = originalRandom; }

const casting = fixture(), concealed = enemy(casting, false);
casting.cardSystem.boardCards = [concealed];
const spell = { type: 'magic', ...getMagic('scorched') };
const sprite = casting.add.image(0, 0, 'scorchedLand');
const caster = { ...InventoryCombatUse, scene: casting, slots: [spell], stationMode: true,
    cleanupCardSprites() {}, removeCard(index) { this.slots[index] = null; } };
assert.equal(caster.canMagicCardSucceed(spell, sprite), true, 'hidden enemies are valid spell targets');
caster.useMagicCard(0, sprite);
assert.equal(concealed.data.burn, 3);
assert.equal(caster.slots[0], null);
casting.cardSystem.boardCards = [loot];
assert.equal(caster.canMagicCardSucceed(spell, sprite), false);

assert.equal(getMagic('smokeScreen').name, 'Ash Cloud');
const oldCloud = { type: 'magic', magicType: 'smokeScreen', name: 'Smoke Screen', description: 'old', sprite: 'smokeBomb' };
const updated = new SaveManager().refreshMagicCard(oldCloud);
assert.equal(updated.name, 'Ash Cloud');
assert.equal(updated.sprite, 'smokeBomb');
assert.equal(oldCloud.name, 'Smoke Screen');

// The intended hide-and-burn combination: Ash Cloud closes enemies but
// neither clears their heat nor protects them from the following tick.
const cloudScene = fixture();
const cloudEnemy = enemy(cloudScene), cloudBoss = enemy(cloudScene, true, { type: 'boss' });
cloudScene.cardSystem.boardCards = [cloudEnemy, cloudBoss];
applyScorched(cloudScene.cardSystem);
const cloudCaster = { ...InventoryCombatUse, scene: cloudScene,
    slots: [{ type: 'magic', ...getMagic('smokeScreen') }], stationMode: true,
    cleanupCardSprites() {}, removeCard(index) { this.slots[index] = null; }, createSmokeEffect() {} };
cloudCaster.useMagicCard(0, cloudScene.add.image(0, 0, 'smokeBomb'));
assert.equal(cloudEnemy.revealed, false);
assert.equal(cloudBoss.revealed, true);
assert.equal(cloudEnemy.data.burn, 3);
cloudScene.cardSystem.processEnemyBurnEffects();
assert.equal(cloudEnemy.data.health, 47);
assert.equal(cloudBoss.data.health, 47);

const saveScene = fixture();
saveScene.inventorySystem.slots = [oldCloud];
const manager = new SaveManager();
manager.saveCurrentRun(saveScene.gameState, saveScene.inventorySystem, cs);
const continued = manager.loadCurrentRun();
assert.equal(continued.equipment.inventory[0].name, 'Ash Cloud');
assert.equal(continued.board.cards[1].data.burn, 8);
for (const floor of [1, 16, 31]) {
    for (const id of ['emberMaw', 'cinderLizard', 'cinderBrute', 'lavaSlime', 'slagSpitter']) {
        const data = buildEnemyCardFromDef(id, floor);
        assert.deepEqual(data.features, ['heatproof']);
        assert.deepEqual(enemySigils(data).map(sigil => sigil.id), ['cinderLizard', 'lavaSlime'].includes(id) ? ['scorched'] : []);
    }
    const spawning = fixture();
    spawning.gameState.actLocationIds = ['ashhowl', 'ashhowl', 'ashhowl'];
    const boss = spawning.cardSystem.cardDataGenerator.createBossCard(floor + 14, spawning.gameState);
    assert.equal(boss.name, 'Cerberus');
    assert.deepEqual(enemySigils(boss).map(sigil => sigil.id), ['scorched', 'summon']);
}
for (const id of ['cerberus', 'ancientCerberus']) {
    assert.deepEqual(enemySigils(BOSSES[id]).map(sigil => sigil.id), ['scorched', 'summon']);
    assert.deepEqual(BOSSES[id].abilities.map(ability => ability.type), ['summon']);
    assert.equal(BOSSES[id].abilities[0].enemyType, 'cerberusHead');
}
const burning = fixture(), burnGs = burning.gameState;
burnGs.equippedArmor = { type: 'armor', protection: 100, durability: 20, maxDurability: 20,
    dodge: 100, sigils: [{ id: 'fleetfoot' }] };
addPlayerBurn(burnGs);
addPlayerBurn(burnGs);
assert.equal(burnGs.playerEffects.filter(effect => effect.type === 'burn').length, 1);
assert.equal(burnGs.playerEffects[0].burn, 6);
const hudEntries = CombatHud.collectPlayerEffectEntries.call({ gameState: burnGs, scene: burning });
assert.ok(hudEntries.some(entry => /Burn 6/.test(entry.text)));
const burnController = new CombatTurnController(burning);
for (const [health, counter] of [[94, 5], [89, 4], [85, 3], [82, 2], [80, 1], [79, 0]]) {
    burnController.finishEnemyTurnEffects({ runCompanions: false });
    assert.equal(burnGs.playerHealth, health);
    assert.equal(burnGs.playerEffects.find(effect => effect.type === 'burn')?.burn || 0, counter);
    assert.equal(burnGs.equippedArmor.durability, 20, 'burn ignores armor without wearing it');
}
addPlayerBurn(burnGs);
burnController.finishEnemyTurnEffects({ runCompanions: false, skipPlayerPoison: true });
assert.equal(burnGs.playerEffects[0].burn, 3, 'revival skips the rest of the damage-over-time phase');
const burnSave = new SaveManager();
burnSave.saveCurrentRun(burnGs, burning.inventorySystem, burning.cardSystem);
assert.equal(burnSave.loadCurrentRun().effects.playerEffects[0].burn, 3);
assert.deepEqual([takePlayerBurnTick(burnGs), takePlayerBurnTick(burnGs), takePlayerBurnTick(burnGs)], [3, 2, 1]);

const procScene = fixture(), attacker = enemy(procScene, true, { ...buildEnemyCardFromDef('cinderLizard', 1), attack: 5 });
procScene.cardSystem.boardCards = [attacker];
const procController = new CombatTurnController(procScene);
const burnRandom = Math.random;
try {
    Math.random = () => 0.1;
    procController.processEnemyAttack(attacker, 0);
    assert.equal(procScene.gameState.playerEffects.length, 0);
    Math.random = () => 0.099;
    procController.processEnemyAttack(attacker, 0);
    assert.equal(procScene.gameState.playerEffects[0].burn, 3);
    procScene.gameState.playerEffects = [];
    procScene.gameState.boneWall = 1;
    procController.processEnemyAttack(attacker, 0);
    assert.equal(procScene.gameState.playerEffects.length, 0);
    procScene.gameState.equippedArmor = { type: 'armor', protection: 20, durability: 20, maxDurability: 20 };
    procController.processEnemyAttack(attacker, 0);
    assert.equal(procScene.gameState.playerEffects.length, 0, 'a fully absorbed hit cannot apply burn');
    procScene.gameState.equippedArmor.sigils = [{ id: 'fleetfoot' }];
    Math.random = () => 0;
    procController.processEnemyAttack(attacker, 0);
    assert.equal(procScene.gameState.playerEffects.length, 0, 'a dodged hit cannot apply burn');
    const fireAttack = fixture();
    fireAttack.cardSystem.boardCards = [enemy(fireAttack, true,
        { ...buildEnemyCardFromDef('cinderLizard', 1), attack: 5 })];
    fireAttack.runEnemyTurn();
    assert.equal(fireAttack.gameState.playerHealth, 92, 'headless damaging hits proc and tick Scorched');
    assert.equal(fireAttack.gameState.playerEffects[0].burn, 2);
    const simBurn = fixture();
    addPlayerBurn(simBurn.gameState);
    simBurn._finishEnemyTurnEffects({ runCompanions: false });
    assert.equal(simBurn.gameState.playerHealth, 97);
    assert.equal(simBurn.gameState.playerEffects[0].burn, 2);
    simBurn.gameState.revivedThisHit = true;
    simBurn._finishEnemyTurnEffects({ runCompanions: false });
    assert.equal(simBurn.gameState.playerHealth, 95, 'an old revival flag cannot stop later burn ticks');
    const liveBurn = fixture();
    liveBurn.gameState.revivedThisHit = true;
    addPlayerBurn(liveBurn.gameState);
    new CombatTurnController(liveBurn).finishEnemyTurnEffects({ runCompanions: false });
    assert.equal(liveBurn.gameState.playerHealth, 97);
    const both = fixture();
    both.gameState.playerHealth = 1;
    both.gameState.villageEffects = { templeRevive: true };
    both.gameState.playerEffects = [{ type: 'poison', damage: 2, turns: 3 }];
    addPlayerBurn(both.gameState);
    new CombatTurnController(both).finishEnemyTurnEffects({ runCompanions: false });
    assert.equal(both.gameState.secondWindUsed, 1);
    assert.equal(both.gameState.playerHealth, 50, 'poison revival prevents burn from immediately hitting the revived player');
    assert.equal(both.gameState.playerEffects.find(effect => effect.type === 'burn').burn, 3);
    const fatal = fixture();
    fatal.gameState.playerHealth = 2;
    fatal.inventorySystem.slots = [{ type: 'companion' }, { type: 'weapon', durability: 5, sigils: [{ id: 'regenerate' }] }];
    addPlayerBurn(fatal.gameState);
    new CombatTurnController(fatal).finishEnemyTurnEffects({ runCompanions: false });
    assert.equal(fatal.gameState.playerHealth, 0, 'regeneration cannot rescue a player killed by burn');
    assert.equal(fatal.gameState.damageTracking.deathCause, 'burn');
} finally { Math.random = burnRandom; }
console.log('Ashhowl checks passed: all-act fire roster/bosses, player burn counter/armor/HUD/saves, proc boundaries/defenses/death, headless timing, local rewards, hidden burn, Heatproof, magic and Ash Cloud.');

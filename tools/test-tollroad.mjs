import assert from 'node:assert/strict';
import { MockScene } from '../sim/mock.js';
import { GameState } from '../src/systems/GameState.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { CombatTurnController } from '../src/systems/combat/CombatTurnController.js';
import { mimicSummonSpot, summonMimic } from '../src/systems/board/MimicSummon.js';
import { InventoryCombatUse } from '../src/systems/inventory/InventoryCombatUse.js';
import { offerableSigils } from '../src/ui/SigilOffer.js';
import { getMagic } from '../src/content/cards/magic.js';
import { SaveManager } from '../src/managers/SaveManager.js';
import { scaleGoldReward } from '../src/content/economy/gold.js';
import { EventRunHelpers } from '../src/systems/events/EventRunHelpers.js';
import goblinEngineer from '../src/content/events/goblin_engineer.js';
import { canStartMusicBox } from '../src/content/events/broken_music_box.js';
import { applyEnemyStrikeSigils, getEnemyHitAttack } from '../src/content/combat/enemyAttack.js';
import { buildEnemyCardFromDef } from '../src/content/cards/enemies.js';
import { BOSSES } from '../src/content/cards/bosses.js';
import { enemySigils } from '../src/content/sigils/sigils.js';

function fixture() {
    const scene = new MockScene();
    scene.gameState = new GameState(scene);
    scene.cardSystem = new CardSystem(scene);
    scene.gameState.currentFloor = 1;
    scene.gameState.actLocationIds = ['tollroad', null, null];
    scene.gameState.playerHealth = scene.gameState.maxHealth = 100;
    scene.gameState.coins = scene.gameState.crystals = 0;
    scene.inventorySystem = { slots: [{ type: 'weapon', damage: 5, durability: 5, maxDurability: 5 }] };
    scene.createDamageEffect = () => {};
    scene.tutorialMode = true;
    const cs = scene.cardSystem;
    cs._boardCells = [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }];
    cs._boardPlace = { cardScale: 1 };
    cs.brickToPixel = (r, c) => ({ x: 200 + c * 70, y: 80 + r * 80 });
    cs.boardCards = new Array(3).fill(null);
    return scene;
}

for (const act of [1, 2, 3]) {
    const scene = fixture();
    scene.gameState.currentFloor = (act - 1) * 15 + 1;
    scene.gameState.actLocationIds = [null, null, null];
    scene.gameState.actLocationIds[act - 1] = 'tollroad';
    assert.deepEqual(offerableSigils(scene), ['cutpurse', 'bounty', 'packrat', 'ambush']);
    scene.gameState.storyRun = { sigilsTaken: ['cutpurse', 'ambush'] };
    assert.deepEqual(offerableSigils(scene), ['bounty', 'packrat']);
    const floor = (act - 1) * 15 + 1;
    for (const [id, sigils] of Object.entries({ goblin: [], goblin_archer: [], tollBrute: [],
        highwayCutpurse: ['cutpurse'], roadSniper: ['ambush'] })) {
        const data = buildEnemyCardFromDef(id, floor);
        assert.deepEqual(enemySigils(data).map(sigil => sigil.id), sigils);
        assert.deepEqual(data.features, id === 'highwayCutpurse' ? ['coin_steal'] : []);
    }
    const king = scene.cardSystem.cardDataGenerator.createBossCard(act * 15, scene.gameState);
    assert.equal(king.name, 'Goblin King');
    assert.deepEqual(enemySigils(king).map(sigil => sigil.id), ['ambush', 'cutpurse', 'summon']);
    assert.deepEqual(king.abilities, [
        { type: 'coin_steal', chance: 0.5, amount: 3 },
        { type: 'summon', enemyType: 'goblin', chance: 0.35, count: 1 },
    ]);
}

const scene = fixture(), cs = scene.cardSystem;
// Slot indices drift when an amulet moves cards: the occupied seat wins.
cs.boardCards[0] = { data: { type: 'coin', brick: { r: 0, c: 1 } }, restX: 270, restY: 80 };
const spot = mimicSummonSpot(cs);
assert.notDeepEqual(spot.cell, { r: 0, c: 1 });
assert.equal(summonMimic(cs), true);
const mimic = cs.boardCards[spot.slot];
const ordinary = cs.cardDataGenerator.createMimicCard(1);
for (const key of ['name', 'attack', 'health', 'escapeTurns', 'role', 'sprite', 'isMimic']) {
    assert.equal(mimic.data[key], ordinary[key]);
}
assert.equal(mimic.revealed, true);
assert.equal(mimic.justRevealed, true);
assert.equal(mimic.data.summonedByBoss, undefined, 'the spell must not weaken a normal Mimic');
assert.equal(scene.gameState.coins, 0, 'summoning alone gives no loot');
assert.equal(scene.gameState.crystals, 0);
assert.equal(cs.boardCards[0].data.type, 'coin', 'existing loot is never replaced');
assert.equal(cs._roomMimicSpawned, true);
const saves = new SaveManager();
const saved = saves.serializeBoardCards(cs.boardCards).find(card => card?.data?.isMimic);
assert.equal(saved.data.escapeTurns, 3);

const originalRandom = Math.random;
Math.random = () => 0.99;
try {
    const controller = new CombatTurnController(scene);
    // The existing normal Mimic countdown is used without a special spell path.
    controller.processEnemyAttack(mimic, spot.slot);
    controller.processEnemyAttack(mimic, spot.slot);
    assert.equal(mimic.data.escapeTurnsLeft, 1);
    assert.equal(saves.serializeBoardCards(cs.boardCards).find(card => card?.data?.isMimic).data.escapeTurnsLeft, 1);
    controller.processEnemyAttack(mimic, spot.slot);
    assert.equal(cs.boardCards[spot.slot], null);
    assert.equal(scene.gameState.coins, 0, 'an escaped Mimic pays nothing');
    assert.equal(scene.gameState.crystals, 0);
} finally { Math.random = originalRandom; }

const full = fixture();
full.cardSystem.boardCards.fill({ data: { type: 'coin' }, restX: 0, restY: 0 });
assert.equal(mimicSummonSpot(full.cardSystem), null);
assert.equal(summonMimic(full.cardSystem), false);
const spell = { type: 'magic', ...getMagic('summonMimic') };
const sprite = full.add.image(0, 0, 'summonMimic');
let actions = 0, returned = 0;
full.useAction = () => { actions++; return true; };
const caster = { ...InventoryCombatUse, scene: full, slots: [spell], stationMode: false,
    returnCardToSlot() { returned++; }, cleanupCardSprites() {}, removeCard(index) { this.slots[index] = null; } };
caster.useMagicCard(0, sprite);
assert.equal(actions, 0, 'no free space means no spent action or card');
assert.equal(returned, 1);
assert.equal(caster.slots[0], spell);
full.cardSystem.boardCards = new Array(3).fill(null);
caster.useMagicCard(0, sprite);
assert.equal(actions, 1);
assert.equal(caster.slots[0], null);
assert.equal(full.cardSystem.boardCards.filter(card => card?.data?.isMimic).length, 1);
full.enemiesCleared = true;
assert.ok(mimicSummonSpot(full.cardSystem), 'a cleared ordinary board can host a Mimic');
let queued = 0, closed = 0;
full.scheduleEnemyTurn = () => queued++;
full.hideExitUnderStation = () => closed++;
caster.slots[0] = spell;
caster.useMagicCard(0, sprite);
assert.equal(actions, 2);
assert.equal(queued, 1, 'the cast owes an enemy response even though the room started cleared');
assert.equal(closed, 1);
assert.equal(full.enemiesCleared, false);
assert.equal(full._roomClearRewarded, true);
saves.saveCurrentRun(full.gameState, caster, full.cardSystem);
const reopenedSave = saves.loadCurrentRun();
assert.equal(reopenedSave.board.enemiesCleared, false);
assert.equal(reopenedSave.board.clearRewardsGranted, true, 'Continue must remember the first room payout');
full.enemiesCleared = true;
full.gameState.roomType = 'BOSS';
assert.equal(mimicSummonSpot(full.cardSystem), null, 'boss victory handoffs cannot be reopened');
full.enemiesCleared = false;
full.gameState.roomType = 'SHOP';
assert.equal(mimicSummonSpot(full.cardSystem), null, 'the spell cannot populate a hidden board from a station');

// Boss rooms have summon lanes, not regular board cells. Loot in a lane is
// occupied space too, so a spell must never cover it with a Mimic.
const bossScene = fixture(), bossCS = bossScene.cardSystem;
bossCS.boardCards = new Array(9).fill(null);
bossCS.boardCards[4] = { data: { type: 'boss', health: 50, brick: { r: 0, c: 0 } }, sprite: { x: 331, y: 175 } };
const bossSpot = mimicSummonSpot(bossCS);
assert.ok(bossSpot);
bossCS.boardCards[1] = { data: { type: 'coin' }, restX: bossSpot.x, restY: bossSpot.y };
const alternative = mimicSummonSpot(bossCS);
assert.notEqual(alternative.x, bossSpot.x);
assert.equal(summonMimic(bossCS), true);
assert.equal(bossCS.boardCards[alternative.slot].data.attack, 2);

const killScene = fixture();
assert.equal(summonMimic(killScene.cardSystem), true);
const killIndex = killScene.cardSystem.boardCards.findIndex(card => card?.data?.isMimic);
killScene.cardSystem.attackEnemy(killIndex, 100, true);
assert.equal(killScene.gameState.coins, scaleGoldReward(22), 'killing the summoned Mimic grants ordinary loot');
assert.equal(killScene.gameState.crystals, 5);

// A Mimic summoned after clearing pays its normal loot, but cannot repeat the
// room's currency, egg progress or companion-history rewards.
globalThis.Phaser.Scene ??= class {};
const { GameScene } = await import('../src/scenes/GameScene.js');
const clearedScene = fixture();
clearedScene.tutorialMode = false;
let eggTicks = 0, histories = 0, exits = 0;
clearedScene.clearEnemyTurnTimers = () => {};
clearedScene.tickEggHatching = () => eggTicks++;
clearedScene.finalizeCompanionCombatHistory = () => histories++;
clearedScene.showNextFloorButton = () => exits++;
clearedScene.onEnemiesCleared = GameScene.prototype.onEnemiesCleared.bind(clearedScene);
clearedScene.onEnemiesCleared();
const firstRoomCoins = clearedScene.gameState.coins;
assert.ok(firstRoomCoins > 0);
assert.equal(summonMimic(clearedScene.cardSystem), true);
const extraIndex = clearedScene.cardSystem.boardCards.findIndex(card => card?.data?.isMimic);
clearedScene.cardSystem.attackEnemy(extraIndex, 100, true);
assert.equal(clearedScene.gameState.coins, firstRoomCoins + scaleGoldReward(22));
assert.equal(clearedScene.gameState.crystals, 5);
assert.equal(eggTicks, 1);
assert.equal(histories, 1);
assert.equal(exits, 2, 'the exit returns after the Mimic is defeated');

// Normal Mimic loot: the animation callback and its fallback must pay once,
// even when the animation is unavailable or completion arrives late.
for (const animationFirst of [true, false]) {
    const lootScene = fixture();
    lootScene.gameState.currentFloor = 16;
    const callbacks = [];
    lootScene.time.delayedCall = (ms, callback) => { callbacks.push(callback); return { remove() {} }; };
    lootScene.anims.exists = () => false;
    const originalAdd = lootScene.add;
    let splash;
    lootScene.add = { sprite(...args) { splash = originalAdd.sprite(...args); return splash; } };
    lootScene.cardSystem.mimicTreasureExplosion(200, 100);
    const animation = splash._once.animationcomplete;
    const fallback = callbacks[0];
    if (animationFirst) { animation(); fallback(); } else { fallback(); animation(); }
    assert.equal(lootScene.gameState.coins, scaleGoldReward(52));
    assert.equal(lootScene.gameState.crystals, 8);
}

// The inventory upgrade belongs to the goblin story, independently of egg
// theft. Existing nest queues are preserved, but new box choices skip them.
function storyFixture() {
    const gameState = { coins: 30, crystals: 0, playerHealth: 100, inventory: [null, null],
        storyRun: { boxState: 'unknown', boxHasCog: false, pendingEvents: [] } };
    return {
        ...EventRunHelpers, gameState,
        ensureStoryState() {}, markHeroMemory() {}, _reward() {},
        clearPendingEvent(id) { gameState.storyRun.pendingEvents = gameState.storyRun.pendingEvents.filter(value => value !== id); },
        addPendingEvent(id) { if (!gameState.storyRun.pendingEvents.includes(id)) gameState.storyRun.pendingEvents.push(id); },
        gainCrystals(amount) { gameState.crystals += amount; },
        gainCoins(amount) { gameState.coins += amount; },
        damagePlayer(amount) { gameState.playerHealth -= amount; },
        getStoryInventorySlots() { return gameState.inventory; },
        hasSacrificeCard: () => true,
        sacrificeFirstNonEssentialCard() {},
    };
}
assert.equal(canStartMusicBox({ storyRun: { boxState: 'unknown' } }, 'tollroad'), true);
for (const id of ['thornwake', 'boneflood', 'silkdeep', 'mireturn', 'ashhowl', 'veilbleed']) {
    assert.equal(canStartMusicBox({ storyRun: { boxState: 'unknown' } }, id), false);
}
for (const action of ['opened', 'left', 'exploded']) {
    const storyScene = storyFixture();
    if (action === 'opened') storyScene.resolveMusicBoxOpened('force');
    else if (action === 'left') storyScene.resolveMusicBoxLeft();
    else storyScene.resolveMusicBoxExploded();
    assert.deepEqual(storyScene.gameState.storyRun.pendingEvents, ['goblin_engineer']);
}
const legacyStory = storyFixture();
legacyStory.gameState.storyRun.pendingEvents = ['monster_bird_nest'];
legacyStory.resolveMusicBoxLeft();
assert.ok(legacyStory.gameState.storyRun.pendingEvents.includes('monster_bird_nest'));
const paid = storyFixture();
paid.resolveMusicBoxOpened('force');
const paidChoice = goblinEngineer.choices.find(choice => choice.text === 'Pay 30 coins for full repair');
assert.equal(paidChoice.condition(paid.gameState), true, 'full repair no longer needs a cog from the nest');
Math.random = () => 0.999;
try {
    paidChoice.action(paid.gameState, paid);
    assert.equal(paid.gameState.coins, 0);
    assert.equal(paid.gameState.inventory.length, 3);
    assert.equal(paid.gameState.bonusInventorySlots, 1);
    assert.equal(paid.gameState.storyRun.boxRepairChance, 100);
    assert.equal(paid.gameState.storyRun.latchboxRewardClaimed, true);
    assert.equal(paid.resolveBoxRepair('Repeat'), false);
    assert.equal(paid.gameState.inventory.length, 3, 'the upgrade cannot be claimed twice');
    const free = storyFixture();
    Math.random = () => 0.5;
    goblinEngineer.choices.find(choice => choice.text === 'Refuse to pay').action(free.gameState, free);
    assert.equal(free.gameState.storyRun.boxRepairChance, 50);
    assert.equal(free.gameState.inventory.length, 2);
    const parts = storyFixture();
    const partsChoice = goblinEngineer.choices.find(choice => choice.text === 'Give him an unwanted card for spare parts');
    assert.equal(partsChoice.condition(parts.gameState, parts), true);
    Math.random = () => 0.79;
    partsChoice.action(parts.gameState, parts);
    assert.equal(parts.gameState.storyRun.boxRepairChance, 80);
    assert.equal(parts.gameState.inventory.length, 3);
} finally { Math.random = originalRandom; }
function ambusher(scene) {
    return { revealed: true, sprite: scene.add.image(200, 100, 'enemy'), data: {
        type: 'enemy', role: 'RANGED', health: 20, maxHealth: 20, attack: 11,
        features: [], sigils: [{ id: 'ambush' }] } };
}
const ambushScene = fixture(), sniper = ambusher(ambushScene);
ambushScene.cardSystem.boardCards = [sniper];
assert.equal(applyEnemyStrikeSigils(sniper, ambushScene.gameState, getEnemyHitAttack(sniper, [sniper])), 16);
const attackController = new CombatTurnController(ambushScene);
Math.random = () => 0.99;
try {
    attackController.processEnemyAttack(sniper, 0);
    assert.equal(ambushScene.gameState.playerHealth, 84, 'Ambush deals x1.5 against a full-health player');
    attackController.processEnemyAttack(sniper, 0);
    assert.equal(ambushScene.gameState.playerHealth, 73, 'Ambush stops once the player is hurt');
    ambushScene.gameState.playerHealth = 100;
    sniper.data.sapped = true;
    attackController.processEnemyAttack(sniper, 0);
    assert.equal(ambushScene.gameState.playerHealth, 90, 'Sapping rounds before the conditional multiplier');
    assert.equal(sniper.data.sapped, false);
    const simulated = fixture(), simulatedSniper = ambusher(simulated);
    simulated.cardSystem.boardCards = [simulatedSniper];
    simulated.runEnemyTurn();
    assert.equal(simulated.gameState.playerHealth, 84);
    simulated.runEnemyTurn();
    assert.equal(simulated.gameState.playerHealth, 73, 'headless Ambush follows the same two attacks');
    const conditional = ambusher(ambushScene);
    conditional.data.sigils = [{ id: 'unscathed' }];
    assert.equal(applyEnemyStrikeSigils(conditional, ambushScene.gameState, 11), 16);
    conditional.data.health--;
    assert.equal(applyEnemyStrikeSigils(conditional, ambushScene.gameState, 11), 11);
    conditional.data.sigils = [{ id: 'merciless' }];
    assert.equal(applyEnemyStrikeSigils(conditional, { playerHealth: 50, maxHealth: 100 }, 11), 16);
    assert.equal(applyEnemyStrikeSigils(conditional, { playerHealth: 51, maxHealth: 100 }, 11), 11);
} finally { Math.random = originalRandom; }

const theftScene = fixture(), theftGs = theftScene.gameState;
const thief = { revealed: true, sprite: theftScene.add.image(200, 100, 'enemy'),
    data: buildEnemyCardFromDef('highwayCutpurse', 1) };
const king = { revealed: true, sprite: theftScene.add.image(200, 100, 'boss'),
    data: { ...structuredClone(BOSSES.goblinKing), maxHealth: BOSSES.goblinKing.health } };
theftScene.cardSystem.boardCards = [thief];
const theftController = new CombatTurnController(theftScene);
try {
    Math.random = () => 0.99;
    for (const [wallet, after] of [[25, 15], [6, 0], [0, 0]]) {
        theftGs.coins = wallet;
        theftGs.playerHealth = 100;
        theftController.processEnemyAttack(thief, 0);
        assert.equal(theftGs.coins, after, 'Cutpurse theft is capped by the available purse');
    }
    theftScene.cardSystem.boardCards = [king];
    theftGs.playerHealth = 100;
    theftGs.coins = 5;
    Math.random = () => 0.49;
    theftController.processEnemyAttack(king, 0);
    assert.equal(theftGs.coins, 2);
    assert.equal(theftGs.playerHealth, 82, 'the King opens with Ambush');
    Math.random = () => 0.5;
    theftController.processEnemyAttack(king, 0);
    assert.equal(theftGs.coins, 2, 'the 50% theft chance respects its boundary');
    assert.equal(theftGs.playerHealth, 70, 'the next hit is ordinary damage');
    const minion = { revealed: true, sprite: theftScene.add.image(200, 100, 'enemy'),
        data: buildEnemyCardFromDef('goblin', 1) };
    assert.equal(getEnemyHitAttack(king, [king, minion]), 12, 'summons no longer add Outnumbered damage');
    assert.equal(BOSSES.goblinKing.health, 84);
    assert.equal(BOSSES.goblinKing.attack, 12);

    const summoning = fixture();
    const queuedKing = { ...king, data: { ...structuredClone(BOSSES.goblinKing), frozen: 1 } };
    summoning.cardSystem.boardCards = [queuedKing];
    const calls = [];
    summoning.cardSystem.summonEnemy = id => { calls.push(id); return true; };
    const queue = new CombatTurnController(summoning);
    queue.tickHandWebs = () => {};
    queue.finishEnemyTurnEffects = () => {};
    Math.random = () => 0;
    queue.revealedEnemiesAttack();
    assert.deepEqual(calls, ['goblin']);
} finally { Math.random = originalRandom; }
console.log('Tollroad checks passed: all-act roster/boss and local rewards, theft/ambush/summons, normal Mimic behavior and saves, music-box upgrade, conditional damage and live/headless parity.');

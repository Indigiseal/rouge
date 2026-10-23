import assert from 'node:assert/strict';
import { SaveManager } from '../src/managers/SaveManager.js';
import { GameState } from '../src/systems/GameState.js';
import { MockScene } from '../sim/mock.js';
import { CardSystem } from '../src/systems/CardSystem.js';
globalThis.Phaser.Scene ??= class {};
const { GameScene } = await import('../src/scenes/GameScene.js');

const scene = new MockScene();
scene.gameState = new GameState(scene);
scene.cardSystem = new CardSystem(scene);
const gs = scene.gameState;
gs.currentFloor = 15;
gs.playerHealth = 27;
gs.actionsLeft = 3;
gs.roomType = scene.roomType = 'MAP'; // Regression: stale navigation + clear flag.
scene.enemiesCleared = true;
const boss = { type: 'boss', name: 'Giant Skeleton', sprite: 'giantSkeleton',
  health: 21, maxHealth: 89, attack: 11, armor: 1, frozen: 2,
  sigils: [{ id: 'warding' }], abilities: [{ type: 'summon', enemyType: 'skeleton', thresholdsTriggered: [0.7] }] };
const minion = { type: 'enemy', enemyType: 'skeleton', health: 3, maxHealth: 12, attack: 4, poisonTurns: 2 };
scene.cardSystem.boardCards = [boss, minion].map((data, i) => ({ data, revealed: true, sprite: { x: 311 + i * 70, y: 175 } }));
const item = { type: 'weapon', weaponType: 'sword', name: 'Sword', damage: 5, durability: 2, maxDurability: 6 };
const saves = new SaveManager();
assert.equal(saves.saveCurrentRun(gs, { slots: [item] }, scene.cardSystem), true);
let saved = saves.loadCurrentRun();
assert.equal(saved.navigation.roomType, 'BOSS');
assert.equal(saved.board.enemiesCleared, false);
assert.equal(saved.player.health, 27);
assert.equal(saved.player.actionsLeft, 3);
assert.deepEqual(saved.equipment.inventory[0], item);
assert.deepEqual(saved.board.cards[0].data, boss);
assert.deepEqual(saved.board.cards[1].data, minion);
assert.deepEqual(saved.board.cards[0].position, { x: 311, y: 175 });
assert.deepEqual(saves.serializeBoardCards([{ data: minion, restX: 300, restY: 160,
    sprite: { x: 300, y: -120 } }])[0].position, { x: 300, y: 160 },
    'autosaving an entrance/drop animation restores the settled seat');
// Repair already-written saves, not only future saves.
const raw = JSON.parse(saves.safeGet(saves.RUN_SAVE_KEY));
raw.navigation.roomType = 'MAP'; raw.board.enemiesCleared = true;
saves.safeSet(saves.RUN_SAVE_KEY, JSON.stringify(raw));
saved = saves.loadCurrentRun();
assert.equal(saved.navigation.roomType, 'BOSS');
assert.equal(saved.board.enemiesCleared, false);
for (const roomType of ['MAP', 'SHOP', 'REST', 'BOSS_REWARD']) {
  const board = roomType === 'MAP' ? [] : [{ data: boss }];
  assert.equal(saves.resolveRoomTypeForSave({ roomType }, board, true), roomType,
    'completed map checkpoints and station/reward saves retain their destination');
}

// A pause requested after the player acts must let the owed enemy response
// complete, then freeze the scene. Repeated requests must not enqueue pauses.
let scheduled = [], pauses = 0, launches = 0;
const pause = {
  gameState: { playerHealth: 27 }, input: { enabled: true },
  combatTurns: { pendingEnemyTurns: 1, isEnemyTurn: false, enemyTurnQueued: true },
  hasUnsettledCombat: GameScene.prototype.hasUnsettledCombat,
  pauseGame: GameScene.prototype.pauseGame,
  time: { delayedCall(_delay, callback) { scheduled.push(callback); return {}; } },
  scene: { pause() { pauses++; }, launch(key) { assert.equal(key, 'PauseMenuScene'); launches++; }, get() { return {}; } },
};
pause.pauseGame(); pause.pauseGame();
assert.equal(pauses, 0); assert.equal(pause.input.enabled, false); assert.equal(scheduled.length, 1);
scheduled.shift()();
assert.equal(pauses, 0); // Still waiting: queued attack hasn't run.
pause.combatTurns = { pendingEnemyTurns: 0, isEnemyTurn: true, enemyTurnQueued: false };
scheduled.shift()();
assert.equal(pauses, 0); // An attack is in progress, including companions.
pause.combatTurns.isEnemyTurn = false;
scheduled.shift()();
assert.equal(pauses, 1); assert.equal(launches, 1); assert.equal(pause.input.enabled, true);
assert.equal(pause._pauseRequested, false);

let checkpoints = 0;
const checkpoint = { ...pause, gameState: { roomType: 'BOSS', playerHealth: 27 },
  saveManager: { saveCurrentRun() { checkpoints++; } } };
GameScene.prototype.checkpointCombat.call(checkpoint);
assert.equal(checkpoints, 1);
checkpoint.combatTurns.pendingEnemyTurns = 1;
GameScene.prototype.checkpointCombat.call(checkpoint);
assert.equal(checkpoints, 1, 'never replace a completed snapshot with a partially resolved exchange');
checkpoint.combatTurns.pendingEnemyTurns = 0; checkpoint.gameState.playerHealth = 0;
GameScene.prototype.checkpointCombat.call(checkpoint);
assert.equal(checkpoints, 1, 'death never becomes a resumable checkpoint');

// The floor-start cards are dealt and flipped open for free (no enemy turn to
// checkpoint after). Until that cascade ends the board is still face-down, so
// it must not be saved then: it would restore with every card turned over.
const opening = { time: { now: 1000 } };
const dealing = {
  ...checkpoint, gameState: { roomType: 'COMBAT', playerHealth: 27 },
  combatTurns: { pendingEnemyTurns: 0, isEnemyTurn: false, enemyTurnQueued: false },
  cardSystem: { scene: opening, _openingRevealUntil: 1900, openingRevealsPending() { return this.scene.time.now < (this._openingRevealUntil || 0); } },
};
checkpoints = 0;
GameScene.prototype.checkpointCombat.call(dealing);
assert.equal(checkpoints, 0, 'a face-down floor-start board is not saved while the opening cards are still turning');
assert.equal(GameScene.prototype.hasUnsettledCombat.call(dealing), true, 'pausing waits for the opening cards too');
opening.time.now = 2000;
GameScene.prototype.checkpointCombat.call(dealing);
assert.equal(checkpoints, 1, 'once the opening cards are open the room is saved');
assert.equal(GameScene.prototype.hasUnsettledCombat.call(dealing), false);

console.log('Save/resume checks passed: unfinished boss routing, legacy flags, fight state, safe pause and combat checkpoints.');

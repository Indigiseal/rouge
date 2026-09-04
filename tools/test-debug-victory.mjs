import assert from 'node:assert/strict';

globalThis.Phaser = { Scene: class {} };
const { GameScene } = await import('../src/scenes/GameScene.js');
const {
  completeTollroadAftermath,
  shouldShowTollroadAftermath,
} = await import('../src/content/story/TollroadAftermath.js');

function makeScene(roomType = 'BOSS') {
  const hiddenEnemy = { revealed: false, data: { type: 'enemy', health: 8 }, sprite: { disableInteractive() {} } };
  const boss = { revealed: true, data: { type: 'boss', health: 80 }, sprite: { disableInteractive() {} } };
  const loot = { revealed: false, data: { type: 'coin', value: 2 } };
  const boardCards = [hiddenEnemy, loot, boss];
  let clearChecks = 0;
  let refreshes = 0;

  const scene = {
    roomType,
    enemiesCleared: false,
    _transitioning: false,
    gameState: { roomType, playerHealth: 50 },
    clearEnemyTurnTimers() { this.timersCleared = true; },
    refreshDebugVictoryButton() { refreshes++; },
    isEnemyCard: GameScene.prototype.isEnemyCard,
    cardSystem: {
      boardCards,
      _waveState: { wavesLeft: 2, cardsPending: 7, dropping: true },
      isEnemyType(type) { return type === 'enemy' || type === 'boss'; },
      removeDefeatedEnemy(index, card) {
        assert.equal(card.data.health, 0, 'debug victory must use the defeated-enemy path');
        assert.equal(boardCards[index], card);
        boardCards[index] = null;
      },
      checkFloorClear() { clearChecks++; },
    },
  };

  return {
    scene,
    hiddenEnemy,
    boss,
    loot,
    get clearChecks() { return clearChecks; },
    get refreshes() { return refreshes; },
  };
}

const bossFight = makeScene();
const defeated = GameScene.prototype.debugDefeatAllEnemies.call(bossFight.scene);
assert.equal(defeated, 2, 'both hidden enemies and bosses must be defeated');
assert.equal(bossFight.scene.cardSystem.boardCards[0], null);
assert.equal(bossFight.scene.cardSystem.boardCards[2], null);
assert.equal(bossFight.scene.cardSystem.boardCards[1], bossFight.loot, 'non-enemy cards must stay on the board');
assert.deepEqual(
  bossFight.scene.cardSystem._waveState,
  { wavesLeft: 0, cardsPending: 0, dropping: false },
  'future reinforcements must be cancelled',
);
assert.equal(bossFight.scene.timersCleared, true);
assert.equal(bossFight.clearChecks, 1, 'normal floor-clear resolution must still run');
assert.equal(bossFight.refreshes, 1);

const eventRoom = makeScene('EVENT');
assert.equal(GameScene.prototype.debugDefeatAllEnemies.call(eventRoom.scene), 0);
assert.equal(eventRoom.scene.cardSystem.boardCards[0], eventRoom.hiddenEnemy);
assert.equal(eventRoom.clearChecks, 0, 'the shortcut must be inert outside combat');

assert.equal(
  shouldShowTollroadAftermath({
    currentFloor: 15,
    actLocationIds: ['tollroad', null, null],
    storyRun: { tollroadAftermathSeen: true },
  }),
  true,
  'a prior viewing must not skip the Tollroad boss scene on a later victory',
);
assert.equal(
  shouldShowTollroadAftermath({
    currentFloor: 15,
    actLocationIds: ['thornwake', null, null],
    storyRun: { tollroadAftermathSeen: false },
  }),
  false,
  'other act-one bosses must still go straight to their reward',
);

const completedTollroadRun = {
  currentFloor: 15,
  actLocationIds: ['tollroad', null, null],
  storyRun: {},
};
completeTollroadAftermath(completedTollroadRun);
assert.equal(shouldShowTollroadAftermath(completedTollroadRun), false,
  'Continue must not replay a scene already completed in this run');
assert.equal(completedTollroadRun.storyRun.magusPendantObtained, true);

console.log('Debug victory clears hidden enemies, bosses, and reinforcements through the normal win path.');

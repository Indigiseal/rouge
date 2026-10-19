import assert from 'node:assert/strict';
globalThis.Phaser = { Scene: class {} };
const { FloorSpawner } = await import('../src/systems/board/FloorSpawner.js');
const { BoardLayout } = await import('../src/systems/board/BoardLayout.js');

const cs = {
    scene: { gameState: { currentFloor: 25 } },
    boardCards: [],
    clearBoard() { this.boardCards = []; },
    spawnAmbushBoard() {},
    cardDataGenerator: {
        getCardWeights: () => ({ mimic: 100, enemy: 1 }),
        createCardData: type => ({ type: 'enemy', isMimic: type === 'mimic' }),
    },
};
const spawner = new FloorSpawner(cs);
cs.createCardData = spawner.createCardData;
cs.pickCardType = spawner.pickCardType;
const random = Math.random;
try {
    Math.random = () => 0;
    assert.equal(cs.pickCardType(25), 'mimic');
    assert.equal(cs.createCardData('mimic', 25).isMimic, true);
    // Removing the first mimic must not allow another in the room's waves.
    cs.boardCards = [];
    for (let i = 0; i < 30; i++) {
        assert.equal(cs.pickCardType(25), 'enemy');
        assert.equal(cs.createCardData('mimic', 25).isMimic, false);
    }
    cs._boardCells = [{ r: 0, c: 0 }];
    cs._boardPlace = {};
    const layout = new BoardLayout(cs).getSerializableBoardLayout();
    assert.equal(layout.mimicSpawned, true);
    cs._roomMimicSpawned = false;
    // A save after the mimic has died still remembers that it was spawned.
    spawner.restoreSavedBoard([], { ...layout, cells: [] });
    assert.equal(cs.pickCardType(25), 'enemy');
    spawner.restoreSavedBoard([], { cells: [], place: {} });
    assert.equal(cs.pickCardType(25), 'mimic', 'old saves without mimics remain compatible');
    cs._roomMimicSpawned = true;
    cs.scene.gameState.pendingAmbush = {};
    spawner.spawnFloorCards();
    assert.equal(cs.pickCardType(25), 'mimic', 'entering the next room resets the allowance');
} finally {
    Math.random = random;
}
console.log('Room mimic cap checks passed: rolls, explicit creation, waves, saves, and room reset.');

import assert from 'node:assert/strict';

globalThis.Phaser = { Scene: class {} };
const { MapViewScene } = await import('../src/scenes/MapViewScene.js');
const { setDevToolsEnabled } = await import('../src/config/DevTools.js');

const gameState = { currentFloor: 1, mapCursor: { floor: 0, node: 0 }, activeAmulets: [] };
const nodes = [{ __x: 0, __y: 0, visited: true }, { __x: 0, __y: 60, visited: false }];
const snapshot = JSON.stringify({ gameState, nodes });
const scene = {
    gameState,
    actMap: { floors: nodes.map(node => [node]) },
    mapContainer: { add() {} },
    add: {
        container() {
            return { visible: true, setVisible(value) { this.visible = value; return this; } };
        },
        rectangle() { throw new Error('player mode must not create a developer button'); },
    },
    textures: { exists: () => false },
    getNodeVisualState: () => 'locked',
    _fogToggleLabel: { setText(value) { this.text = value; } },
};

setDevToolsEnabled(false);
MapViewScene.prototype._addFogToggleButton.call(scene);
MapViewScene.prototype.drawFog.call(scene);
MapViewScene.prototype._toggleMapFog.call(scene);
assert.equal(scene.mapFogContainer.visible, true);
assert.equal(scene._devFogLifted, undefined, 'player mode refuses the action too');

setDevToolsEnabled(true);
MapViewScene.prototype._toggleMapFog.call(scene);
assert.equal(scene.mapFogContainer.visible, false);
assert.equal(scene._fogToggleLabel.text, 'Restore fog');
MapViewScene.prototype.drawFog.call(scene);
assert.equal(scene.mapFogContainer.visible, false, 'a map redraw retains the developer choice');
MapViewScene.prototype._toggleMapFog.call(scene);
assert.equal(scene.mapFogContainer.visible, true);
assert.equal(scene._fogToggleLabel.text, 'Lift fog');
scene._leavingMap = true;
MapViewScene.prototype._toggleMapFog.call(scene);
assert.equal(scene.mapFogContainer.visible, true, 'cannot toggle while leaving the map');
scene._leavingMap = false;
scene._devFogLifted = true;
setDevToolsEnabled(false);
MapViewScene.prototype.drawFog.call(scene);
assert.equal(scene.mapFogContainer.visible, true, 'developer choice cannot remove player-mode fog');
assert.equal(JSON.stringify({ gameState, nodes }), snapshot, 'lifting fog never changes progress or routes');

scene.gameState = { ...gameState, activeAmulets: [{ id: 'oraclesFishbowl' }] };
MapViewScene.prototype.drawFog.call(scene);
assert.equal(scene.mapFogContainer, null, 'naturally fog-free maps have no fog layer');
console.log('Map fog toggle passed: developer guards, lift/restore, redraws, player mode, and unchanged progression.');

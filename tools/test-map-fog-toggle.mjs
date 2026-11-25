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
    // The real secret-room step drawFog ends on; no secret rooms wait here.
    _scheduleSecretAppear: MapViewScene.prototype._scheduleSecretAppear,
    time: { delayedCall() {} },
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

// A newly available secret is visible and clickable before any reveal timer fires.
const { SoundHelper } = await import('../src/audio/SoundHelper.js');
const originalSound = SoundHelper.playSound;
SoundHelper.playSound = () => {};
try {
    const timers = [], tweens = [];
    const sprite = { scene: {}, alpha: 0, input: { enabled: false },
        setAlpha(value) { this.alpha = value; return this; },
        setScale(value) { this.scale = value; return this; } };
    const available = { __sprite: sprite, __restAlpha: 1 };
    const distant = { __sprite: { scene: {} } };
    const reveal = {
        _appearing: new Set([distant, available]),
        textures: { exists: () => false },
        time: { delayedCall(delay, callback) { timers.push({ delay, callback }); } },
        tweens: { add(config) { tweens.push(config); } },
        _appearSecretNode: MapViewScene.prototype._appearSecretNode,
        _revealSecretPath() {},
    };
    MapViewScene.prototype._scheduleSecretAppear.call(reveal);
    assert.equal(sprite.alpha, 1, 'available secret is visible synchronously');
    assert.equal(sprite.input.enabled, true, 'player can choose it immediately');
    assert.equal(tweens[0].delay || 0, 0, 'pop has no invisible lead-in');
    assert(tweens[0].duration <= 160, 'pop finishes promptly');
    assert(timers.some(timer => timer.delay === 60), 'path starts revealing promptly');
    assert(timers.some(timer => timer.delay === 80), 'distant discoveries follow available choices');
} finally { SoundHelper.playSound = originalSound; }
console.log('Secret reveal passed: available route visible and selectable on the opening frame, with a brief pop and faster path.');

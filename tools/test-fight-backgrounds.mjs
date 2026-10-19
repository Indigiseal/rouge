import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fightBackgroundKey, fightBackdropKey } from '../src/content/locations/fightBackgrounds.js';
import { ASSET_MANIFEST } from '../src/content/assets/AssetManifest.js';

globalThis.Phaser = { Scene: class {}, Renderer: { WebGL: { Pipelines: { PostFXPipeline: class {} } } } };
const { BoardLayout } = await import('../src/systems/board/BoardLayout.js');
const state = { currentFloor: 1, actLocationIds: ['tollroad', 'boneflood', 'starfold'] };
for (const room of ['COMBAT', 'ELITE', 'BOSS']) {
    assert.equal(fightBackgroundKey(state, room), 'goblinCaveBackground');
    assert.equal(fightBackgroundKey({ ...state, currentFloor: 16 }, room), 'bonefloodBackground');
    assert.equal(fightBackgroundKey({ ...state, currentFloor: 31 }, room), 'stoneFloor');
}
for (const room of ['SHOP', 'RARE_SHOP', 'REST', 'EVENT', 'TREASURE', 'BOSS_REWARD', 'MAP']) {
    assert.equal(fightBackgroundKey(state, room), 'stoneFloor');
}
assert.equal(fightBackgroundKey({ currentFloor: 1, calendarMonthIndex: 2 }, 'COMBAT'), 'goblinCaveBackground');
assert.equal(fightBackgroundKey({ ...state, actLocationIds: ['silkdeep'] }, 'COMBAT'), 'silkdeepBackground');

function fixture(gameState, roomType) {
    const objects = [];
    const scene = { gameState, roomType, cameras: { main: { width: 640, height: 360 } },
        tweens: { add() {}, killTweensOf() {} },
        textures: { exists: () => true, get: () => ({ getSourceImage: () => ({ width: 366, height: 304 }) }) },
    };
    const object = (x, y, key, list = []) => {
        const obj = { x, y, key, list, scene, width: key === 'gamingBoard' ? 366 : 320,
            height: key === 'gamingBoard' ? 304 : 180, scaleX: 1, scaleY: 1,
            setPosition(x, y) { this.x = x; this.y = y; return this; },
            setOrigin() { return this; }, setDepth(d) { this.depth = d; return this; },
            setData() { return this; }, setSize(w, h) { this.width = w; this.height = h; return this; },
            destroy() { this.list.forEach(child => child.destroy()); this.scene = null; },
        };
        objects.push(obj); return obj;
    };
    scene.add = { image: (x, y, key) => object(x, y, key), container: (x, y, list) => object(x, y, null, list) };
    const cs = { scene, clearFloorBoardPanel() {}, brickToPixel: () => ({ x: 320, y: 170 }) };
    const layout = new BoardLayout(cs);
    return { cs, layout, objects };
}
{
    const { cs, layout } = fixture({ ...state, currentFloor: 16 }, 'COMBAT');
    layout.createFloorBoardPanel([{ r: 0, c: 0 }], {}, false);
    const panel = cs.floorBoardPanel;
    assert.equal(panel.depth, 0);
    assert.equal(panel.key, 'gamingBoard', 'the room picture is not wrapped onto the gaming board');
    assert.equal(panel.list.length, 0);
    layout.clearFloorBoardPanel();
    assert.equal(panel.scene, null, 'board teardown still works');
}
// Boss fights have no gaming board (Taya): only the room picture, if any.
{
    const { cs, layout } = fixture({ ...state, currentFloor: 16 }, 'BOSS');
    layout.createBossBoardPanel();
    assert.equal(cs.floorBoardPanel ?? null, null, 'boss room art is a backdrop, not a board overlay');
    const goblinBoss = fixture(state, 'BOSS');
    goblinBoss.layout.createBossBoardPanel();
    assert.equal(goblinBoss.cs.floorBoardPanel ?? null, null, 'no board under the goblin king');
}
const missing = fixture(state, 'COMBAT');
missing.cs.scene.textures.exists = key => key === 'gamingBoard';
missing.layout.createFloorBoardPanel([{ r: 0, c: 0 }], {}, false);
assert.equal(missing.cs.floorBoardPanel.key, 'gamingBoard', 'missing picture leaves the board intact');
for (const key of ['goblinCaveBackground', 'bonefloodBackground']) {
    const asset = ASSET_MANIFEST.find(asset => asset.key === key);
    assert.ok(asset && existsSync(asset.path), `${key} is registered and saved in the game assets`);
}
console.log('Fight board art passed: location selection, native size, child layering, boss boards, cleanup, and fallback.');

const goblin = fixture(state, 'COMBAT');
goblin.layout.createFloorBoardPanel([{ r: 0, c: 0 }], {}, false);
// The Tollroad fights on its own goblin plank board (content/locations/boardArt.js),
// with no room picture laid over it.
assert.equal(goblin.cs.floorBoardPanel.key, 'gamingBoardTollroad', 'the Tollroad uses its goblin board, with no room art above it');
assert.equal(fightBackdropKey(state, 'COMBAT'), 'goblinCaveBackground');
assert.equal(fightBackdropKey(state, 'SHOP'), 'goblinCaveBackground');
assert.equal(fightBackdropKey({ ...state, currentFloor: 16 }, 'COMBAT'), 'bonefloodBackground');
const { GameScene } = await import('../src/scenes/GameScene.js');
const host = { gameState: state, roomType: 'COMBAT', textures: { exists: () => true },
    backgroundImage: { scene: {}, depth: -10,
        setTexture(key) { this.key = key; }, setVisible(value) { this.visible = value; } },
    add: { image(x, y, key) { return { scene: {}, x, y, key,
        setOrigin() { return this; }, setScale(scale) { this.scale = scale; return this; },
        setDepth(depth) { this.depth = depth; return this; },
        setTexture(key) { this.key = key; return this; },
        setVisible(visible) { this.visible = visible; return this; } }; } },
};
GameScene.prototype.refreshFightBackground.call(host);
assert.equal(host.backgroundImage.key, 'stoneFloor', 'dungeon.png remains the foreground frame');
assert.equal(host.fightBackgroundImage.key, 'goblinCaveBackground');
assert.equal(host.fightBackgroundImage.scale, 1, 'location illustration keeps its native pixels');
assert.ok(host.fightBackgroundImage.depth < host.backgroundImage.depth);
assert.ok(host.backgroundImage.depth < goblin.cs.floorBoardPanel.depth);
GameScene.prototype.refreshFightBackground.call(host, 'SHOP');
assert.equal(host.fightBackgroundImage.visible, true, 'shops keep the location art');
host._eventBackdropOn = true;
GameScene.prototype.refreshFightBackground.call(host);
assert.equal(host.fightBackgroundImage.visible, true, 'events retain the location art');
host._eventBackdropOn = false;
GameScene.prototype.refreshFightBackground.call(host);
assert.equal(host.fightBackgroundImage.visible, true);
host.gameState = { ...state, currentFloor: 16 };
GameScene.prototype.refreshFightBackground.call(host);
assert.equal(host.fightBackgroundImage.visible, true);
assert.equal(host.fightBackgroundImage.key, 'bonefloodBackground');
console.log('Native goblin background passed: no scaling under dungeon.png, board layering, events, and room transitions.');

for (const roomType of ['COMBAT', 'ELITE', 'BOSS', 'SHOP', 'RARE_SHOP', 'TREASURE', 'TREASURE_GOOD', 'BOSS_REWARD', 'EVENT']) {
    assert.equal(fightBackdropKey(state, roomType), 'goblinCaveBackground', roomType);
}
host.gameState = state;
host.roomType = 'EVENT';
host.refreshFightBackground = () => GameScene.prototype.refreshFightBackground.call(host);
GameScene.prototype.setEventBackdrop.call(host, true);
assert.equal(host.backgroundImage.visible, true, 'dungeon frame remains visible during goblin events');
assert.equal(host.fightBackgroundImage.visible, true, 'goblin event reveals its shared illustration');
assert.equal(host.eventBackdrop, undefined, 'an opaque flat background must not cover location art');
GameScene.prototype.setEventBackdrop.call(host, false);
assert.equal(host.fightBackgroundImage.visible, true, 'leaving an event retains the location illustration');
host.gameState = { ...state, actLocationIds: ['mirrorwane'] };
host.add.rectangle = () => ({ scene: {}, setDepth() { return this; }, setVisible(value) { this.visible = value; } });
GameScene.prototype.setEventBackdrop.call(host, true);
assert.equal(host.eventBackdrop.visible, true, 'locations awaiting art keep their existing event backdrop');
assert.equal(host.backgroundImage.visible, false);
assert.equal(host.fightBackgroundImage.visible, false);
GameScene.prototype.setEventBackdrop.call(host, false);
assert.equal(host.eventBackdrop.visible, false);
assert.equal(host.backgroundImage.visible, true);
console.log('Shared location backdrop passed: shops, treasure, sigils, events, event cleanup, and fallback.');

const biomes = [
    [{ ...state, currentFloor: 16, actLocationIds: ['tollroad', 'veilbleed', 'starfold'] }, 'veilbleedBackground'],
    [{ ...state, actLocationIds: ['silkdeep', 'boneflood', 'starfold'] }, 'silkdeepBackground'],
    [{ ...state, currentFloor: 16, actLocationIds: ['tollroad', 'boneflood', 'starfold'] }, 'bonefloodBackground'],
    [{ ...state, currentFloor: 16, actLocationIds: ['tollroad', 'ashhowl', 'starfold'] }, 'ashhowlLavaBackground'],
    [{ ...state, actLocationIds: ['thornwake', 'boneflood', 'starfold'] }, 'thornwakeBackground'],
    [{ ...state, currentFloor: 16, actLocationIds: ['tollroad', 'mireturn', 'starfold'] }, 'mireturnBogBackground'],
];
for (const [gameState, key] of biomes) {
    for (const roomType of ['COMBAT', 'ELITE', 'BOSS', 'SHOP', 'RARE_SHOP', 'TREASURE', 'TREASURE_GOOD', 'BOSS_REWARD', 'EVENT']) {
        assert.equal(fightBackdropKey(gameState, roomType), key);
        host.gameState = gameState;
        host.roomType = roomType;
        host.refreshFightBackground();
        assert.equal(host.fightBackgroundImage.key, key);
        assert.equal(host.fightBackgroundImage.scale, 1);
        assert.equal(host.fightBackgroundImage.visible, true);
    }
    host.roomType = 'EVENT';
    GameScene.prototype.setEventBackdrop.call(host, true);
    assert.equal(host.fightBackgroundImage.visible, true);
    assert.equal(host.eventBackdrop.visible, false, 'new biome art replaces the flat event backdrop');
    GameScene.prototype.setEventBackdrop.call(host, false);
    const asset = ASSET_MANIFEST.find(asset => asset.key === key);
    assert.ok(asset && existsSync(asset.path));
    const png = readFileSync(asset.path);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [512, 288]);
}
host.gameState = state;
host.refreshFightBackground();
assert.equal(host.fightBackgroundImage.key, 'goblinCaveBackground', 'switching biomes restores goblin art');
console.log('Veilbleed, Silkdeep, Thornwake, Mireturn, Boneflood and Ashhowl passed: native size, all station rooms, events, and biome transitions.');

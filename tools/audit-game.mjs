// Read-only structural audit plus headless reproductions of suspect behavior.
// Browser storage and Phaser are replaced with process-local fakes.
// Run: node tools/audit-game.mjs [--skip-syntax]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const moduleAt = rel => import(pathToFileURL(path.join(root, rel)).href);
const { ASSET_MANIFEST, LATE_AUDIO, DEFERRED_AUDIO } = await moduleAt('src/content/assets/AssetManifest.js');
const all = [...ASSET_MANIFEST, ...LATE_AUDIO, ...DEFERRED_AUDIO];
const report = {
    sourceFiles: 0, syntaxErrors: [], missingImports: [],
    assets: all.length, missingAssets: all.filter(a => typeof a.path === 'string' && !fs.existsSync(a.path)),
    sameCacheDuplicateAssetKeys: all.filter((a, i) => all.findIndex(b => b.key === a.key && (b.type === 'audio') === (a.type === 'audio')) !== i).map(a => a.key),
    assetBytes: Object.fromEntries([...new Set(all.map(a => a.type))].map(type => [type,
        all.filter(a => a.type === type).reduce((n, a) => n + (typeof a.path === 'string' && fs.existsSync(a.path) ? fs.statSync(a.path).size : 0), 0)])),
};
for (const file of fs.readdirSync('src', { recursive: true }).filter(f => f.endsWith('.js')).map(f => path.join('src', f))) {
    report.sourceFiles++;
    if (!process.argv.includes('--skip-syntax')) {
        const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
        if (check.status !== 0) report.syntaxErrors.push({ file, error: check.stderr });
    }
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
        if (!fs.existsSync(path.resolve(path.dirname(file), m[1]))) report.missingImports.push({ file, import: m[1] });
    }
}
const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
globalThis.Phaser = { Scene: class {}, Renderer: { WebGL: { Pipelines: { PostFXPipeline: class {} } } } };
const { SaveManager } = await moduleAt('src/managers/SaveManager.js');
const { GameState } = await moduleAt('src/systems/GameState.js');
const { PauseMenuScene } = await moduleAt('src/scenes/PauseMenuScene.js');
const manager = new SaveManager();
const game = new GameState({});
game.scene = { enemiesCleared: false, roomType: 'COMBAT' };
game.playerSpored = true;
game.playerStunnedTurns = 1;
manager.saveCurrentRun(game, { slots: [] }, { boardCards: [] });
const run = manager.loadCurrentRun();
report.combatStatusSave = { before: { spored: game.playerSpored, stunned: game.playerStunnedTurns }, saved: run.effects };
const stopped = [];
let saveCount = 0;
const station = { gameState: game };
const gameScene = { gameState: game, saveCurrentRun: () => saveCount++ };
const pause = { pausedScene: 'RestScene', scene: {
    get: key => key === 'GameScene' ? gameScene : station,
    stop: key => stopped.push(key ?? 'PauseMenuScene'), start: () => {},
} };
PauseMenuScene.prototype.quitToMainMenu.call(pause);
report.stationSaveQuit = { saveCount, stopsGameScene: stopped.includes('GameScene'), stopped };

const { MusicManager } = await moduleAt('src/audio/MusicManager.js');
const { SoundHelper } = await moduleAt('src/audio/SoundHelper.js');
const originalFade = SoundHelper.fadeInMusic;
const plays = [];
SoundHelper.fadeInMusic = (_, key) => { plays.push(key); return { setVolume() {} }; };
SoundHelper.fadeOutMusic = () => {};
MusicManager.current = null; MusicManager.wanted = null; MusicManager.pending.clear();
const loaded = new Set();
const loaderA = new EventEmitter(); loaderA.audio = () => {}; loaderA.isLoading = () => false; loaderA.start = () => {};
const a = { sound: {}, cache: { audio: { exists: key => loaded.has(key) } }, load: loaderA, scene: { isActive: () => false } };
const b = { ...a, scene: { isActive: () => true } };
MusicManager.play(a, 'menu_music');
MusicManager.stopIfPlaying(a, 'menu_music');
MusicManager.play(b, 'menu_music');
loaded.add('menu_music'); loaderA.emit('filecomplete-audio-menu_music');
report.deferredMusicTransition = { plays, wanted: MusicManager.wanted, pending: [...MusicManager.pending] };
MusicManager.current = null; MusicManager.wanted = null; MusicManager.pending.clear(); loaded.clear();
MusicManager.play(a, 'menu_music');
MusicManager.play(b, 'menu_music');
loaded.add('menu_music'); loaderA.emit('filecomplete-audio-menu_music');
report.deferredMusicWithoutStop = { plays: [...plays], wanted: MusicManager.wanted };
SoundHelper.fadeInMusic = originalFade;
const { CombatTurnController } = await moduleAt('src/systems/combat/CombatTurnController.js');
const turnScene = { gameState: game, events: new EventEmitter(), time: { delayedCall: (_, fn) => ({ fn, remove() {} }) } };
const turn = new CombatTurnController(turnScene);
turnScene.combatTurns = turn;
turn.scheduleEnemyTurn(); turn.scheduleEnemyTurn();
manager.saveCurrentRun(game, { slots: [] }, { boardCards: [] });
report.pendingTurnsSave = { queuedBeforeSave: turn.pendingEnemyTurns, serializedHasTurnState: /pendingEnemyTurns|enemyTurnQueued|isEnemyTurn/.test(storage.get('currentRun')) };
turn.clearEnemyTurnTimers();
for (let i = 0; i < 100; i++) { turn.scheduleEnemyTurn(); turn.enemyTurnTimers.at(-1).fn(); }
report.completedTimerRetention = turn.enemyTurnTimers.length;

const { resolvePlayerDamage } = await moduleAt('src/systems/combat/PlayerDamageResolver.js');
const realRandom = Math.random;
Math.random = () => 0.01;
SoundHelper.playSound = () => {}; SoundHelper.playVariant = () => {};
function armorCounter(durability) {
    const reflected = [];
    const scene = { playerAvatar: { x: 0, y: 0 }, createFloatingText() {}, updateUI() {},
        amuletManager: { checkDodge: () => false, modifyDamageTaken: n => n, checkLethalPrevention: () => false },
        cardSystem: { boardCards: [{ data: { type: 'enemy', role: 'MELEE', health: 20 }, sprite: { x: 0, y: 0 } }],
            attackEnemy: (_, damage) => reflected.push(damage) } };
    const state = new GameState(scene);
    state.equippedArmor = { name: 'Chain', protection: 2, durability, meleeCounterChance: 1 };
    const result = resolvePlayerDamage(state, 5, 0);
    return { durabilityBefore: durability, blockedDamage: result.blockedDamage, counterHits: reflected };
}
report.lastArmorPipCounter = [armorCounter(2), armorCounter(1)];
Math.random = realRandom;
const { MetaProgressionManager } = await moduleAt('src/managers/MetaProgressionManager.js');
const normalStorage = globalThis.localStorage;
globalThis.localStorage = { getItem() { throw new Error('SecurityError: storage denied'); } };
try { new MetaProgressionManager({}); report.storageDenied = 'no failure'; }
catch (error) { report.storageDenied = error.message; }
globalThis.localStorage = normalStorage;
const { MapGenerator } = await moduleAt('src/map/MapGenerator.js');
const { ACT_ROADS } = await moduleAt('src/content/locations/catalog.js');
const { CardDataGenerator } = await moduleAt('src/systems/loot/CardDataGenerator.js');
report.procedural = { mapsChecked: 0, cardsChecked: 0, errors: [] };
let randomState = 20261014;
Math.random = () => ((randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0) / 4294967296);
const mapGen = new MapGenerator();
const cardGen = new CardDataGenerator();
for (const [actString, roads] of Object.entries(ACT_ROADS)) {
    const act = Number(actString);
    for (const road of roads) {
        for (let sample = 0; sample < 100; sample++) {
            const map = mapGen.generateAct(act, road);
            report.procedural.mapsChecked++;
            let reachable = new Set([0]);
            for (let row = 0; row < map.floors.length; row++) {
                if (reachable.size !== map.floors[row].length) report.procedural.errors.push({ act, road, row, reason: 'unreachable node' });
                const next = new Set();
                for (const index of reachable) {
                    const node = map.floors[row][index];
                    for (const link of node?.connections || []) {
                        if (!map.floors[row + 1]?.[link]) report.procedural.errors.push({ act, road, row, reason: 'invalid connection' });
                        next.add(link);
                    }
                    if (row < map.floors.length - 1 && !node?.connections?.length) report.procedural.errors.push({ act, road, row, reason: 'dead end' });
                }
                reachable = next;
            }
        }
        const actLocationIds = [null, null, null]; actLocationIds[act - 1] = road;
        for (let floor = (act - 1) * 15 + 1; floor <= act * 15; floor++) {
            for (let sample = 0; sample < 10; sample++) {
                for (const elite of [false, true]) {
                    const card = cardGen.createEnemyCard(floor, elite, null, { actLocationIds });
                    report.procedural.cardsChecked++;
                    if (!(Number.isFinite(card.health) && card.health > 0 && Number.isFinite(card.attack) && card.attack >= 0 && card.sprite)) {
                        report.procedural.errors.push({ act, road, floor, reason: 'invalid generated enemy', card });
                    }
                }
            }
        }
    }
}
Math.random = realRandom;
report.moduleImportErrors = [];
for (const rel of fs.readdirSync('src', { recursive: true }).filter(f => f.endsWith('.js') && f !== 'main.js')) {
    try { await moduleAt(path.join('src', rel)); }
    catch (error) { report.moduleImportErrors.push({ file: rel, error: error.message }); }
}
console.log(JSON.stringify(report, null, 2));

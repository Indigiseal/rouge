import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
globalThis.Phaser ??= { Scene: class {}, Math: {}, Geom: {}, Display: {}, GameObjects: {} };
import { ASSET_MANIFEST } from '../src/content/assets/AssetManifest.js';
import {
    LOCATION_ASSETS, ALL_LOCATION_ASSETS, missingLocationAssets, queueLocationAssets, ensureLocationAssets, locationIdsForRunStart,
} from '../src/content/assets/locationAssets.js';
import { PLAYABLE_LOCATION_IDS } from '../src/content/locations/catalog.js';
import { LOCATION_BOARD_ART } from '../src/content/locations/boardArt.js';
import { locationBackdropKey } from '../src/content/locations/fightBackgrounds.js';
import { getLocationIdForFloor } from '../src/content/locations/index.js';

// Every playable location has a painting and three boards, all real PNGs, none in the boot manifest.
for (const id of PLAYABLE_LOCATION_IDS) {
    const assets = LOCATION_ASSETS[id];
    assert.equal(assets?.length, 4, `${id}: a painting and three boards`);
    for (const { key, path } of assets) {
        assert.ok(readFileSync(new URL('../' + path, import.meta.url)).subarray(1, 4).toString() === 'PNG', `${path} exists`);
        assert.ok(!ASSET_MANIFEST.some((asset) => asset.key === key), `${key} is not loaded at boot`);
    }
    // The keys match what the game asks for.
    assert.ok(assets.some(({ key }) => key === locationBackdropKey({ actLocationIds: [id, id, id], currentFloor: 1 })), `${id}'s painting key`);
    const board = LOCATION_BOARD_ART[id];
    if (board) for (const key of [board.main, board.sideSmall, board.sideExtra]) assert.ok(assets.some((a) => a.key === key), `${id}: ${key}`);
}
assert.equal(new Set(ALL_LOCATION_ASSETS.map((a) => a.key)).size, ALL_LOCATION_ASSETS.length, 'no key twice');

// Only what is missing is queued, once.
const loaded = new Set(['thornwakeBackground']);
const queued = [];
const loader = { handlers: {}, image: (k, p) => queued.push([k, p]),
    once(ev, fn) { this.handlers[ev] = fn; }, start() { setTimeout(() => this.handlers.complete?.(), 0); }, isLoading: () => false };
const scene = { textures: { exists: (k) => loaded.has(k) }, load: loader };
assert.equal(missingLocationAssets(scene, ['thornwake', 'thornwake']).length, 3, 'the loaded painting is skipped');
assert.equal(queueLocationAssets(scene, ['sandreach']), 4);
assert.deepEqual(queued.map(([k]) => k).sort(), LOCATION_ASSETS.sandreach.map((a) => a.key).sort());
assert.equal(queueLocationAssets(scene, ['nowhere']), 0, 'an unknown location queues nothing');

// ensure resolves once the loader completes, and at once when nothing is missing.
queued.length = 0;
await ensureLocationAssets(scene, ['frosthollow']);
assert.equal(queued.length, 4);
for (const { key } of LOCATION_ASSETS.frosthollow) loaded.add(key);
queued.length = 0;
await ensureLocationAssets(scene, ['frosthollow']);
assert.equal(queued.length, 0);

// Which locations a start needs.
const forFloor = (gs) => getLocationIdForFloor(gs);
assert.deepEqual(locationIdsForRunStart({ tutorial: true }), ['thornwake']);
assert.deepEqual(locationIdsForRunStart({ sandbox: true }), ['thornwake']);
assert.deepEqual(locationIdsForRunStart({ sandbox: true, sandboxLocation: 'ashhowl' }), ['ashhowl'], 'a Test Site boss loads its own location');
assert.deepEqual(locationIdsForRunStart({ locationId: 'sandreach' }), ['sandreach']);
assert.deepEqual(locationIdsForRunStart({}), ['thornwake']);
const savedRun = { player: { currentFloor: 20, actLocationIds: ['tollroad', 'stormhatch', null], calendarMonthIndex: 0 } };
assert.deepEqual(locationIdsForRunStart({ loadSave: true }, savedRun, forFloor), ['stormhatch'], 'a continued run loads the road it was saved on');
assert.deepEqual(locationIdsForRunStart({ loadSave: true }, null, forFloor), []);

console.log('Location asset checks passed: ten sets of four, none at boot, only missing queued, run starts load their road.');

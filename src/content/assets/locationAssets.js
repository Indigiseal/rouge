// Art that only one location needs: its room painting and its three boards.
// None of it is in the boot manifest. A run loads the current location's set
// when it starts or continues (GameScene.preload) and when the player walks into
// a new act (LocationPickScene), so a player who never reaches the Sandreach
// never downloads its art. A set that fails to load leaves the shared fallbacks
// in place: stoneFloor behind the cards, the standard boards (boardArtFor).
import { LOCATION_BOARD_FILES } from '../locations/boardArt.js';

const BACKGROUNDS = Object.freeze({
    tollroad: { key: 'goblinCaveBackground', path: 'assets/art/backgrounds/goblinCave.png' },
    silkdeep: { key: 'silkdeepBackground', path: 'assets/art/backgrounds/silkdeep.png' },
    veilbleed: { key: 'veilbleedBackground', path: 'assets/art/backgrounds/veilbleed.png' },
    thornwake: { key: 'thornwakeBackground', path: 'assets/art/backgrounds/thornwake.png' },
    mireturn: { key: 'mireturnBogBackground', path: 'assets/art/backgrounds/mireturnBog.png' },
    boneflood: { key: 'bonefloodBackground', path: 'assets/art/backgrounds/bonefloodOssuary.png' },
    ashhowl: { key: 'ashhowlLavaBackground', path: 'assets/art/backgrounds/ashhowlLava.png' },
    stormhatch: { key: 'stormhatchBackground', path: 'assets/art/backgrounds/stormhatch.png' },
    frosthollow: { key: 'frosthollowBackground', path: 'assets/art/backgrounds/frosthollow.png' },
    sandreach: { key: 'sandreachBackground', path: 'assets/art/backgrounds/sandreach.png' },
});

// assets/art/boards/<location>Board.png, <location>SideSmall.png, <location>SideExtra.png
const boardLocation = (path) => path.split('/').pop().replace(/(Board|SideSmall|SideExtra)\.png$/, '');

/** Every location's assets, `{ key, path, type: 'image' }` each. */
export const LOCATION_ASSETS = Object.freeze(Object.fromEntries(
    [...new Set([...Object.keys(BACKGROUNDS), ...LOCATION_BOARD_FILES.map(({ path }) => boardLocation(path))])]
        .map((id) => [id, Object.freeze([
            ...(BACKGROUNDS[id] ? [{ ...BACKGROUNDS[id], type: 'image' }] : []),
            ...LOCATION_BOARD_FILES.filter(({ path }) => boardLocation(path) === id).map(({ key, path }) => ({ key, path, type: 'image' })),
        ])]),
));

/** All of them in one list, for tests and the asset audit. */
export const ALL_LOCATION_ASSETS = Object.freeze(Object.values(LOCATION_ASSETS).flat());

/** The assets of these locations that are not loaded yet. */
export function missingLocationAssets(scene, locationIds) {
    const seen = new Set();
    return [...new Set(locationIds)].flatMap((id) => LOCATION_ASSETS[id] || [])
        .filter(({ key }) => !scene.textures.exists(key) && !seen.has(key) && seen.add(key));
}

/** Queue them on `scene.load`. Returns how many were queued. */
export function queueLocationAssets(scene, locationIds) {
    const todo = missingLocationAssets(scene, locationIds);
    for (const { key, path } of todo) scene.load.image(key, path);
    return todo.length;
}

/**
 * Load a location's art now and resolve when it is in (or has failed: a missing
 * file only costs the fallback art). Safe to call while the loader is busy.
 */
export function ensureLocationAssets(scene, locationIds) {
    return new Promise((resolve) => {
        const start = () => {
            if (!queueLocationAssets(scene, locationIds)) { resolve(); return; }
            scene.load.once('complete', resolve);
            scene.load.start();
        };
        if (scene.load.isLoading?.()) scene.load.once('complete', start); else start();
    });
}

/**
 * The locations a GameScene start needs: the tutorial and Test Site fight in
 * Thornwake, a new run in the road it picked, a continued run in the road of the
 * floor it was saved on.
 */
export function locationIdsForRunStart(data = {}, savedRun = null, locationForFloor = () => null) {
    if (data.tutorial || data.sandbox) return ['thornwake'];
    if (data.loadSave) {
        const player = savedRun?.player;
        const id = player ? locationForFloor({ actLocationIds: player.actLocationIds, currentFloor: player.currentFloor,
            calendarMonthIndex: player.calendarMonthIndex }) : null;
        return id ? [id] : [];
    }
    return data.locationId ? [data.locationId] : ['thornwake'];
}

import { getLocationIdForFloor } from './index.js';

// Native room illustrations, shared by combat and every station/event in a
// location. Add future biome backgrounds here once their art is ready.
const LOCATION_ROOM_BACKGROUNDS = Object.freeze({
    tollroad: 'goblinCaveBackground',
    silkdeep: 'silkdeepBackground',
    veilbleed: 'veilbleedBackground',
    thornwake: 'thornwakeBackground',
    mireturn: 'mireturnBogBackground',
    ashhowl: 'ashhowlLavaBackground',
    boneflood: 'bonefloodBackground',
    stormhatch: 'stormhatchBackground',
    frosthollow: 'frosthollowBackground',
    sandreach: 'sandreachBackground',
});

// Paintings drawn taller than the screen on purpose (Taya): their top row sits
// at the top of the screen and the extra height hangs below, instead of being
// centred. Every other painting stays centred.
export const TOP_PINNED_BACKGROUNDS = Object.freeze(new Set([
    'thornwakeBackground',
    'bonefloodBackground',
    'mireturnBogBackground',
    'veilbleedBackground',
]));

export function locationBackdropKey(gameState) {
    return LOCATION_ROOM_BACKGROUNDS[getLocationIdForFloor(gameState)] || 'stoneFloor';
}

export function fightBackgroundKey(gameState, roomType) {
    if (!['COMBAT', 'ELITE', 'BOSS'].includes(roomType)) return 'stoneFloor';
    return locationBackdropKey(gameState);
}

export function fightBackdropKey(gameState, roomType) {
    return locationBackdropKey(gameState);
}


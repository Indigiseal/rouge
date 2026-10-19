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
});

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


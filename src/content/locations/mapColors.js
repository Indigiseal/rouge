// The map's background colour for each location: the same darkness as the old
// khaki, shifted toward the location's look so the act reads at a glance.
// The fog over it is pale grey, so every colour here stays under it.

import { getLocationIdForFloor } from './index.js';

export const DEFAULT_MAP_COLOR = 0x776c4f;

export const LOCATION_MAP_COLORS = Object.freeze({
    thornwake:   0x5e6b4a, // briar green
    silkdeep:    0x5f4e6e, // spider purple
    tollroad:    0x776c4f, // dusty road (the old khaki)
    boneflood:   0x5d6a6a, // cold bone grey-teal
    mireturn:    0x4f5f4f, // bog olive
    veilbleed:   0x6a6375, // grey purple
    ashhowl:     0x7a4f45, // ash red
    frosthollow: 0x5c6f7c, // ice blue
    stormhatch:  0x55607a, // storm slate
    sandreach:   0x8a7550, // sand
});

/** The background colour for the map of the act `gameState` is in. */
export function mapColorFor(gameState) {
    return LOCATION_MAP_COLORS[getLocationIdForFloor(gameState)] ?? DEFAULT_MAP_COLOR;
}

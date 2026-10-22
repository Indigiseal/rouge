import { WORKING_PLAYER_SIGILS } from './sigils.js';

// Introduce approved location pools one at a time. Other locations retain the
// current catalog until their new sigils and rules have been implemented.
export const LOCATION_SIGIL_POOLS = Object.freeze({
    thornwake: Object.freeze(['thorns', 'mirror', 'kinship', 'companionStrength', 'packStrength', 'hunter', 'outnumbered']),
    silkdeep: Object.freeze(['venomStack', 'venomSplash', 'venomousBomb', 'web', 'crystalBrood']),
    tollroad: Object.freeze(['cutpurse', 'bounty', 'packrat', 'ambush']),
    boneflood: Object.freeze(['ironclad', 'warding', 'tempered', 'mending', 'riposte', 'sunder']),
    ashhowl: Object.freeze(['fireball', 'scorched', 'smoke']),
    veilbleed: Object.freeze(['leech', 'sapping', 'devouring', 'fleetfoot', 'bloodlust']),
    mireturn: Object.freeze(['regenerate', 'unscathed', 'growth']),
    stormhatch: Object.freeze(['conductive', 'shock', 'charged', 'twinSocket']),
    frosthollow: Object.freeze(['frost', 'shatter', 'merciless']),
    sandreach: Object.freeze(['secondWind', 'daze', 'archerBane', 'wellFed', 'forage', 'quickStrike']),
});

export function sigilPoolForLocation(locationId) {
    return LOCATION_SIGIL_POOLS[locationId] || WORKING_PLAYER_SIGILS;
}

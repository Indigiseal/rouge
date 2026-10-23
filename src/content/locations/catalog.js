// Complete roster packs can be dealt in every act. Other records remain for
// old saves and asset lookups, but unfinished roads are not newly offered.
export const PLAYABLE_LOCATION_IDS = Object.freeze([
  'thornwake', 'silkdeep', 'tollroad', 'boneflood', 'mireturn', 'veilbleed', 'ashhowl', 'stormhatch', 'frosthollow', 'sandreach',
]);
export const ACT_ROADS = Object.freeze({
  1: PLAYABLE_LOCATION_IDS, 2: PLAYABLE_LOCATION_IDS, 3: PLAYABLE_LOCATION_IDS,
});
export function allRoadsForAct(act) {
  return [...(ACT_ROADS[act] || [])];
}

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   place: string,
 *   bossId: string|null,
 *   portrait: string,
 * }} PathLocation
 */

/** @type {Record<string, PathLocation>} */
export const PATH_LOCATIONS = Object.freeze({
  sandreach: Object.freeze({
    id: 'sandreach', name: 'Sandreach', place: 'The Sand Lizardfolk Desert',
    bossId: 'sandscaleChieftain', portrait: 'lizardBoss',
  }),
  frosthollow: Object.freeze({
    id: 'frosthollow', name: 'Frosthollow', place: 'The Frosthollow Tundra',
    bossId: 'frostGiant', portrait: 'frostGiant',
  }),
  stormhatch: Object.freeze({
    id: 'stormhatch', name: 'Stormhatch', place: 'The Storm Cliffs',
    bossId: 'tempestRoc', portrait: 'lightningBoss',
  }),
  thornwake: Object.freeze({
    id: 'thornwake',
    name: 'Thornwake',
    place: 'The Briar March',
    bossId: 'greenWarden',
    portrait: 'greenWarden',
  }),
  silkdeep: Object.freeze({
    id: 'silkdeep',
    name: 'Silkdeep',
    place: 'The Silkdeep Caves',
    bossId: 'spiderQueen',
    portrait: 'SpiderQween',
  }),
  tollroad: Object.freeze({
    id: 'tollroad',
    name: 'Tollroad',
    place: '', // Taya's wording pending; Petr's "King's Mile" was removed.
    bossId: 'goblinKing',
    portrait: 'GoblinKingSprite',
  }),
  boneflood: Object.freeze({
    id: 'boneflood',
    name: 'Boneflood',
    place: 'The Ossuary Fields',
    bossId: 'giantSkeleton',
    portrait: 'giantSkeleton',
  }),
  // Restored from the twelve-month calendar. Each has a written cast in
  // docs/narrative and now a coded roster; Mireturn and Veilbleed wear real
  // art from rows 4 and 5 of the enemy sheet, Ashhowl waits on a row 6.
  //
  mireturn: Object.freeze({
    id: 'mireturn',
    name: 'Mireturn',
    place: 'The Mireturn Fens',
    bossId: 'mireBride',
    portrait: 'MireBride',
  }),
  veilbleed: Object.freeze({
    id: 'veilbleed',
    name: 'Veilbleed',
    place: 'The Bleeding Veil',
    bossId: 'soulEater',
    portrait: 'SoulEater',
  }),
  ashhowl: Object.freeze({
    id: 'ashhowl',
    name: 'Ashhowl',
    place: 'The Ashhowl Wastes',
    bossId: 'cerberus',
    portrait: 'Cerberus',
  }),
  brassfair: Object.freeze({
    id: 'brassfair',
    name: 'Brassfair',
    place: 'The Night Fair',
    bossId: null,
    portrait: 'carnivalPipe',
  }),
  duskhold: Object.freeze({
    id: 'duskhold',
    name: 'Duskhold',
    place: 'Castle Duskhold',
    bossId: null,
    portrait: 'Lich',
  }),
  mirrorwane: Object.freeze({
    id: 'mirrorwane',
    name: 'Mirrorwane',
    place: 'The Mirror Palace',
    bossId: null,
    portrait: 'lostSoul',
  }),
  spherefall: Object.freeze({
    id: 'spherefall',
    name: 'Spherefall',
    place: 'The Glass Craters',
    bossId: null,
    portrait: 'statueHead',
  }),
  starfold: Object.freeze({
    id: 'starfold',
    name: 'Starfold',
    place: 'The Inner Sky',
    bossId: null,
    portrait: 'holographicOmen',
  }),
});

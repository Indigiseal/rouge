// Nine Path locations. Roster packs still live under content/months/<id>/;
// this file is the run-structure SoT: which three roads an act offers, which
// one is true, and which portrait sits on the card back at the pick screen.

export const TRUE_PATH = Object.freeze(['tollroad', 'brassfair', 'starfold']);

export const ACT_ROADS = Object.freeze({
  1: Object.freeze(['thornwake', 'silkdeep', 'tollroad']),
  2: Object.freeze(['boneflood', 'brassfair', 'duskhold']),
  3: Object.freeze(['mirrorwane', 'spherefall', 'starfold']),
});

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   place: string,
 *   act: 1|2|3,
 *   truePath: boolean,
 *   bossId: string|null,
 *   portrait: string,
 * }} PathLocation
 */

/** @type {Record<string, PathLocation>} */
export const PATH_LOCATIONS = Object.freeze({
  thornwake: Object.freeze({
    id: 'thornwake',
    name: 'Thornwake',
    place: 'The Briar March',
    act: 1,
    truePath: false,
    bossId: 'greenWarden',
    portrait: 'greenWarden',
  }),
  silkdeep: Object.freeze({
    id: 'silkdeep',
    name: 'Silkdeep',
    place: 'The Silkdeep Caves',
    act: 1,
    truePath: false,
    bossId: 'spiderQueen',
    portrait: 'SpiderQween',
  }),
  tollroad: Object.freeze({
    id: 'tollroad',
    name: 'Tollroad',
    place: "The King's Mile",
    act: 1,
    truePath: true,
    bossId: 'goblinKing',
    portrait: 'GoblinKingSprite',
  }),
  boneflood: Object.freeze({
    id: 'boneflood',
    name: 'Boneflood',
    place: 'The Ossuary Fields',
    act: 2,
    truePath: false,
    // Giant Skeleton exists as an act-1-tuned fight; do not pin it here until
    // it has act-2 stats. Map gen rolls from the act-2 pool until then.
    bossId: null,
    portrait: 'giantSkeleton',
  }),
  brassfair: Object.freeze({
    id: 'brassfair',
    name: 'Brassfair',
    place: 'The Night Fair',
    act: 2,
    truePath: true,
    bossId: null,
    portrait: 'carnivalPipe',
  }),
  duskhold: Object.freeze({
    id: 'duskhold',
    name: 'Duskhold',
    place: 'Castle Duskhold',
    act: 2,
    truePath: false,
    bossId: null,
    portrait: 'Lich',
  }),
  mirrorwane: Object.freeze({
    id: 'mirrorwane',
    name: 'Mirrorwane',
    place: 'The Mirror Palace',
    act: 3,
    truePath: false,
    bossId: null,
    portrait: 'lostSoul',
  }),
  spherefall: Object.freeze({
    id: 'spherefall',
    name: 'Spherefall',
    place: 'The Glass Craters',
    act: 3,
    truePath: false,
    bossId: null,
    portrait: 'statueHead',
  }),
  starfold: Object.freeze({
    id: 'starfold',
    name: 'Starfold',
    place: 'The Inner Sky',
    act: 3,
    truePath: true,
    bossId: null,
    portrait: 'holographicOmen',
  }),
});

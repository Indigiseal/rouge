// Nine Path locations. Roster packs still live under content/location-packs/<id>/;
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
  // Restored from the twelve-month calendar. Each has a written cast in
  // docs/narrative and now a coded roster; Mireturn and Veilbleed wear real
  // art from rows 4 and 5 of the enemy sheet, Ashhowl waits on a row 6.
  //
  // They are deliberately absent from ACT_ROADS: the pick screen deals exactly
  // three cards (LocationPickScene's CARD_XS), so a fourth road in an act
  // would be dealt to an undefined x. Choosing which three an act offers — or
  // rolling three of the five — is a design call, not a wiring one.
  mireturn: Object.freeze({
    id: 'mireturn',
    name: 'Mireturn',
    place: 'The Mireturn Fens',
    act: 2,
    truePath: false,
    bossId: 'mireBride',
    portrait: 'MireBride',
  }),
  veilbleed: Object.freeze({
    id: 'veilbleed',
    name: 'Veilbleed',
    place: 'The Bleeding Veil',
    act: 2,
    truePath: false,
    bossId: 'soulEater',
    portrait: 'SoulEater',
  }),
  ashhowl: Object.freeze({
    id: 'ashhowl',
    name: 'Ashhowl',
    place: 'The Ashhowl Wastes',
    act: 2,
    truePath: false,
    bossId: 'cerberus',
    portrait: 'Cerberus',
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

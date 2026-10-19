// The crystal spiders: a mother and her brood, found only in the Crystal Lair
// (a secret room, map/HiddenPaths.js). Never on a location roster, so they
// never turn up on an ordinary board. In runs where the player fell down the
// Old Chute and squashed the mother, the lair stays shut.
//
// Art: row 7 of enemiesSpriteSheet (PixelLab, picked by Taya), on Silkdeep's
// card faces. The mother wears the elite face.
import { enemyCardPresentation } from '../assets/enemyCards.js';

export const CRYSTAL_LAIR_ROSTER = Object.freeze({
  MELEE: Object.freeze(['crystalMother', 'crystalHatchling']),
  RANGED: Object.freeze([]),
});

/** What PreloadScene composites the two cards from, like a location pack. */
export const CRYSTAL_LAIR_SHEET = Object.freeze({ id: 'crystalLair', enemies: CRYSTAL_LAIR_ROSTER });

const art = (id) => enemyCardPresentation('crystalLair', CRYSTAL_LAIR_ROSTER, id);

export const CRYSTAL_SPIDER_DEFS = Object.freeze({
  crystalMother: Object.freeze({
    name: 'Crystal Mother',
    ...art('crystalMother'),
    role: 'MELEE',
    archetype: 'bruiser',
    abilities: [{ type: 'poison', damage: 3, turns: 3, stackable: true }],
    // She grows angrier with every bite (enemy Honed works today).
    sigils: [{ id: 'honed' }],
    crystalSpider: true,
  }),
  crystalHatchling: Object.freeze({
    name: 'Crystal Hatchling',
    ...art('crystalHatchling'),
    role: 'MELEE',
    archetype: 'swarm',
    abilities: [{ type: 'poison', damage: 1, turns: 2, stackable: true }],
    crystalSpider: true,
  }),
});

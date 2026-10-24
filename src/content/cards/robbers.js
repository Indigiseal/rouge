// The robbers: a generic gang of human thieves for stories to send at the
// player (the Soup Stand's ambush is the first). Never on a location roster, so
// they never turn up on an ordinary board; a story deals them with
// buildEnemyCardFromDef. They all wear the gang's green scarf.
//
// Art: row 11 of enemiesSpriteSheet (PixelLab Create Object, picked by Taya), on
// Tollroad's card faces.
import { enemyCardPresentation } from '../assets/enemyCards.js';

// Column order is MELEE first, then RANGED: Cook, Muscle, Lookout.
export const ROBBERS_ROSTER = Object.freeze({
  MELEE: Object.freeze(['robberCook', 'robberMuscle']),
  RANGED: Object.freeze(['robberLookout']),
});

/** What PreloadScene composites the cards from, like a location pack. */
export const ROBBERS_SHEET = Object.freeze({ id: 'robbers', enemies: ROBBERS_ROSTER });

const art = (id) => enemyCardPresentation('robbers', ROBBERS_ROSTER, id);

// The amulet the gang's cook was carrying: +1 bag slot, given for beating the robbers the
// Soup Stand's "wait out of sight" brings (GameScene.rewardRobberSatchel). Not a drop.
export const ROBBER_SATCHEL_AMULET = 'robberSatchel';

export const ROBBER_DEFS = Object.freeze({
  // Fast hands: takes a coin when it hits.
  robberCook: Object.freeze({
    name: 'Robber Cook',
    ...art('robberCook'),
    role: 'MELEE',
    archetype: 'skirmisher',
    sigils: [{ id: 'cutpurse' }],
    robber: true,
  }),
  robberMuscle: Object.freeze({
    name: 'Robber Muscle',
    ...art('robberMuscle'),
    role: 'MELEE',
    archetype: 'bruiser',
    sigils: [{ id: 'crushing' }],
    robber: true,
  }),
  robberLookout: Object.freeze({
    name: 'Robber Lookout',
    ...art('robberLookout'),
    role: 'RANGED',
    archetype: 'artillery',
    robber: true,
  }),
});

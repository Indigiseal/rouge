import { enemyCardPresentation } from '../../../assets/enemyCards.js';
import emberMaw from './emberMaw.js';
import cinderLizard from './cinderLizard.js';
import cinderBrute from './cinderBrute.js';
import lavaSlime from './lavaSlime.js';
import slagSpitter from './slagSpitter.js';

// Declared before the defs: a creature's place here IS its sheet column.
//
// The only rule the code enforces is MELEE first, then RANGED — that is what
// rosterOrder flattens to. Within each group the order is free, and the three
// months drawn before this one each chose their own, so there is no archetype
// convention to follow. These five are ordered to match the art as drawn on
// row 6, so the sheet and this list agree.
//
// Reorder this list and the five faces on row 6 swap creatures without a
// word of warning. It changes only when the sheet changes with it.
export const ASHHOWL_ROSTER = Object.freeze({
  MELEE: Object.freeze(['emberMaw', 'cinderLizard', 'cinderBrute']),
  RANGED: Object.freeze(['lavaSlime', 'slagSpitter']),
});

function asDef({ id, placeholderArt: _p, sprite: _s, spriteFrame: _f, ...rest }) {
  return Object.freeze({
    ...rest,
    ...enemyCardPresentation('ashhowl', ASHHOWL_ROSTER, id),
  });
}

/** Ashhowl enemy catalog entries (no `id` on values — key is the id). */
export const ASHHOWL_ENEMY_DEFS = Object.freeze({
  emberMaw: asDef(emberMaw),
  cinderLizard: asDef(cinderLizard),
  cinderBrute: asDef(cinderBrute),
  lavaSlime: asDef(lavaSlime),
  slagSpitter: asDef(slagSpitter),
});

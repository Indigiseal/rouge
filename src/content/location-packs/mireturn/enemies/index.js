import { enemyCardPresentation } from '../../../assets/enemyCards.js';
import bogSlug from './bogSlug.js';
import drowned from './drowned.js';
import mireBrute from './mireBrute.js';
import fenSpitter from './fenSpitter.js';
import mireToad from './mireToad.js';

// Declared before the defs: a creature's place here IS its sheet column.
//
// The only rule the code enforces is MELEE first, then RANGED — that is what
// rosterOrder flattens to. Within each group the order is free, and the three
// months drawn before this one each chose their own, so there is no archetype
// convention to follow. These five are ordered to match the art as drawn on
// row 4, so the sheet and this list agree.
//
// Reorder this list and the five faces on row 4 swap creatures without a
// word of warning. It changes only when the sheet changes with it.
export const MIRETURN_ROSTER = Object.freeze({
  MELEE: Object.freeze(['bogSlug', 'drowned', 'mireBrute']),
  RANGED: Object.freeze(['fenSpitter', 'mireToad']),
});

function asDef({ id, placeholderArt: _p, sprite: _s, spriteFrame: _f, ...rest }) {
  return Object.freeze({
    ...rest,
    ...enemyCardPresentation('mireturn', MIRETURN_ROSTER, id),
  });
}

/** Mireturn enemy catalog entries (no `id` on values — key is the id). */
export const MIRETURN_ENEMY_DEFS = Object.freeze({
  bogSlug: asDef(bogSlug),
  drowned: asDef(drowned),
  mireBrute: asDef(mireBrute),
  fenSpitter: asDef(fenSpitter),
  mireToad: asDef(mireToad),
});

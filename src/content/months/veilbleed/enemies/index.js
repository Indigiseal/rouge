import { enemyCardPresentation } from '../../../assets/enemyCards.js';
import lostSoul from './lostSoul.js';
import hollowMourner from './hollowMourner.js';
import veilRipper from './veilRipper.js';
import inkWraith from './inkWraith.js';
import graveCantor from './graveCantor.js';

// Declared before the defs: a creature's place here IS its sheet column.
//
// The only rule the code enforces is MELEE first, then RANGED — that is what
// rosterOrder flattens to. Within each group the order is free, and the three
// months drawn before this one each chose their own, so there is no archetype
// convention to follow. These five are ordered to match the art as drawn on
// row 5, so the sheet and this list agree.
//
// Reorder this list and the five faces on row 5 swap creatures without a
// word of warning. It changes only when the sheet changes with it.
export const VEILBLEED_ROSTER = Object.freeze({
  MELEE: Object.freeze(['lostSoul', 'hollowMourner', 'veilRipper']),
  RANGED: Object.freeze(['inkWraith', 'graveCantor']),
});

function asDef({ id, placeholderArt: _p, sprite: _s, spriteFrame: _f, ...rest }) {
  return Object.freeze({
    ...rest,
    ...enemyCardPresentation('veilbleed', VEILBLEED_ROSTER, id),
  });
}

/** Veilbleed enemy catalog entries (no `id` on values — key is the id). */
export const VEILBLEED_ENEMY_DEFS = Object.freeze({
  lostSoul: asDef(lostSoul),
  hollowMourner: asDef(hollowMourner),
  veilRipper: asDef(veilRipper),
  inkWraith: asDef(inkWraith),
  graveCantor: asDef(graveCantor),
});

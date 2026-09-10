import { enemyCardPresentation } from '../../../assets/enemyCards.js';
import wolf from './wolf.js';
import thornEnt from './thornEnt.js';
import thornSprite from './thornSprite.js';
import sporeArcher from './sporeArcher.js';
import thornFairy from './thornFairy.js';

// Declared before the defs: a creature's place here IS its sheet column.
export const THORNWAKE_ROSTER = Object.freeze({
  MELEE: Object.freeze(['wolf', 'thornEnt', 'thornSprite']),
  RANGED: Object.freeze(['sporeArcher', 'thornFairy']),
});

function asDef({ id, placeholderArt: _p, sprite: _s, spriteFrame: _f, ...rest }) {
  return Object.freeze({
    ...rest,
    ...enemyCardPresentation('thornwake', THORNWAKE_ROSTER, id),
  });
}

/** Thornwake enemy catalog entries (no `id` on values — key is the id). */
export const THORNWAKE_ENEMY_DEFS = Object.freeze({
  wolf: asDef(wolf),
  thornEnt: asDef(thornEnt),
  thornSprite: asDef(thornSprite),
  sporeArcher: asDef(sporeArcher),
  thornFairy: asDef(thornFairy),
});

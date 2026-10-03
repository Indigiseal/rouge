import { enemyCardPresentation } from '../../../assets/enemyCards.js';
import skeleton from './skeleton.js';
import boneHeap from './boneHeap.js';
import cryptWarden from './cryptWarden.js';
import skeletonArcher from './skeleton_archer.js';
import skullLobber from './skullLobber.js';

// Declared before the defs: a creature's place here IS its sheet column.
//
// MELEE first, then RANGED — the one rule the code enforces. This order is what
// row 3 already has drawn on it, left to right: the sword skeleton, the heap of
// bones, the shield warden, the archer, the robed lobber. Nothing needed
// rearranging for Boneflood; the art was already in roster order.
export const BONEFLOOD_ROSTER = Object.freeze({
  MELEE: Object.freeze(['skeleton', 'boneHeap', 'cryptWarden']),
  RANGED: Object.freeze(['skeleton_archer', 'skullLobber']),
});

function asDef({ id, placeholderArt: _p, sprite: _s, spriteFrame: _f, ...rest }) {
  return Object.freeze({
    ...rest,
    ...enemyCardPresentation('boneflood', BONEFLOOD_ROSTER, id),
  });
}

/** Boneflood enemy catalog entries (no `id` on values — key is the id). */
export const BONEFLOOD_ENEMY_DEFS = Object.freeze({
  skeleton: asDef(skeleton),
  boneHeap: asDef(boneHeap),
  cryptWarden: asDef(cryptWarden),
  skeleton_archer: asDef(skeletonArcher),
  skullLobber: asDef(skullLobber),
});

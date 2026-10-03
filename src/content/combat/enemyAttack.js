/**
 * Situational enemy hit damage = passport ATK + per-enemy hooks.
 * Enemy defs may export `modifyHitAttack(card, boardCards, baseAttack)`.
 * Example: Thornwake Wolf pack bonus lives next to the wolf def.
 */

import { getEnemy } from '../cards/enemies.js';

export function getEnemyHitAttack(card, boardCards) {
  const base = Math.max(0, Number(card?.data?.attack) || 0);
  const def = getEnemy(card?.data?.enemyType);
  if (typeof def?.modifyHitAttack === 'function') {
    const next = def.modifyHitAttack(card, boardCards, base);
    return Math.max(0, Number(next) || 0);
  }
  return base;
}

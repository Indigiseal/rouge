/**
 * Pack bonus: +1 ATK per other revealed living Wolf on the board.
 * Situational — not stamped on the passport; UI refreshes via refreshEnemyAttackLabels.
 */
export function modifyHitAttack(card, boardCards, baseAttack) {
  const base = Math.max(0, Number(baseAttack) || 0);
  if (!Array.isArray(boardCards)) return base;
  let others = 0;
  for (const other of boardCards) {
    if (!other || other === card) continue;
    if (!other.revealed) continue;
    if (other.data?.enemyType !== 'wolf') continue;
    if ((other.data.health ?? 0) <= 0) continue;
    others += 1;
  }
  return base + others;
}

export default {
  id: 'wolf',
  name: 'Wolf',
  role: 'MELEE',
  minFloor: 1,
  archetype: 'skirmisher',
  features: ['wolf_pack'],
  modifyHitAttack,
};

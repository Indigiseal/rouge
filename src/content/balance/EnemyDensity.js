/** Minimum enemy share of board cards by act (combat density floor). */
export function minEnemyRatioForFloor(floor) {
  if (floor <= 15) return 0.19;
  if (floor <= 30) return 0.24;
  return 0.28;
}

// Meta / character XP formulas (legacy meta-points schedule).

export const META_XP_BASE = 2;
export const META_XP_FLOOR_DIVISOR = 5;
export const META_XP_PER_BOSS = 3;

/** Same formula as legacy meta points. */
export function xpForRun(floor, bossesKilled = 0) {
  return META_XP_BASE + Math.floor(floor / META_XP_FLOOR_DIVISOR) + bossesKilled * META_XP_PER_BOSS;
}

export function estimateBossesKilled(floor) {
  return floor > 30 ? 2 : floor > 15 ? 1 : 0;
}

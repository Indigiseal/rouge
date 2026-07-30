/** Phaser texture key for assets/art/thornwakeSheet.png (52×70, one row). */
export const THORNWAKE_ENEMY_SHEET = 'thornwakeEnemies';

/**
 * Frame order left → right on the sheet.
 * Melee 0–2, ranged 3–4 (matches THORNWAKE_ROSTER order).
 */
export const THORNWAKE_ENEMY_FRAMES = Object.freeze({
  wolf: 0,
  thornEnt: 1,
  thornSprite: 2,
  sporeArcher: 3,
  thornFairy: 4,
});

export function getThornwakeEnemyPresentation(id) {
  const frame = THORNWAKE_ENEMY_FRAMES[id];
  if (!Number.isInteger(frame)) {
    throw new Error(`Missing Thornwake enemy atlas frame for "${id}"`);
  }
  return Object.freeze({
    sprite: THORNWAKE_ENEMY_SHEET,
    spriteFrame: frame,
  });
}

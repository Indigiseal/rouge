/** Phaser texture key for assets/art/thornwakeSheet.png (52×70, one row). */
export const THORNWAKE_ENEMY_SHEET = 'thornwakeEnemies';

/**
 * Frame order left → right on the sheet.
 * Melee: wolf, thornEnt, thornFairy (frames 0–2); ranged: sporeArcher, thornSprite (3–4).
 * Fairy/Sprite art frames were swapped vs roster naming — Fairy uses sheet index 2, Sprite 4.
 */
export const THORNWAKE_ENEMY_FRAMES = Object.freeze({
  wolf: 0,
  thornEnt: 1,
  thornFairy: 2,
  sporeArcher: 3,
  thornSprite: 4,
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

// The Heart of the Briars' fight: the heart (elite) and the thorn sprites
// that guard it. Kept apart from the definition, which enemies.js imports,
// so the two files never import each other (as crystalLair.js does).
import { buildEnemyCardFromDef } from './enemies.js';
import { applyEnemyTier } from '../balance/EnemyTiers.js';

// How many thorn sprites stand guard when the room opens.
export const BRIAR_HEART_GUARDS = 2;

/** The heart's board: the heart (elite) and its guards. */
export function createBriarHeartEnemies(floor) {
  const heart = buildEnemyCardFromDef('briarHeart', floor);
  if (heart) applyEnemyTier(heart, 'elite');
  const guards = Array.from({ length: BRIAR_HEART_GUARDS }, () => buildEnemyCardFromDef('thornSprite', floor));
  return [heart, ...guards].filter(Boolean);
}

// The Crystal Lair's fight: the crystal spider mother and her brood
// (content/cards/crystalSpiders.js). Kept apart from the definitions, which
// enemies.js imports, so the two files never import each other.
import { buildEnemyCardFromDef } from './enemies.js';
import { applyEnemyTier } from '../balance/EnemyTiers.js';

// How many hatchlings guard the mother.
export const CRYSTAL_LAIR_HATCHLINGS = 3;

/** The lair's board: the mother (elite) and her hatchlings. */
export function createCrystalLairEnemies(floor) {
  const mother = buildEnemyCardFromDef('crystalMother', floor);
  if (mother) applyEnemyTier(mother, 'elite');
  const brood = Array.from({ length: CRYSTAL_LAIR_HATCHLINGS }, () => buildEnemyCardFromDef('crystalHatchling', floor));
  return [mother, ...brood].filter(Boolean);
}

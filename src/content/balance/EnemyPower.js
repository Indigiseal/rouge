import { tuned } from './Tuning.js';

// Shared enemy power: floor bands × archetype multipliers.
// Design SoT: docs/BALANCE.md (Enemy power: bands + archetypes).

// Keep Act 1's pacing. Spread Act 2's health growth across the whole act,
// then continue small increases every two floors through Act 3. This softens
// floors 20–25 while making late Act 2 and the endgame grow beyond the old
// 34 / 44 HP plateaus. Attack thresholds remain on their existing schedule.
export const POWER_BANDS = Object.freeze([
  { id: 'A', minFloor: 1, health: 8, attack: 4 },
  { id: 'B', minFloor: 5, health: 10, attack: 5 },
  { id: 'C', minFloor: 10, health: 12, attack: 7 },
  { id: 'C2', minFloor: 13, health: 13, attack: 7 },
  { id: 'C3', minFloor: 14, health: 14, attack: 8 },
  { id: 'D', minFloor: 16, health: 16, attack: 9 },
  { id: 'D2', minFloor: 18, health: 18, attack: 9 },
  { id: 'D3', minFloor: 20, health: 21, attack: 10 },
  { id: 'D4', minFloor: 22, health: 24, attack: 10 },
  { id: 'E', minFloor: 23, health: 24, attack: 11 },
  { id: 'E2', minFloor: 24, health: 27, attack: 11 },
  { id: 'E3', minFloor: 26, health: 31, attack: 11 },
  { id: 'E4', minFloor: 28, health: 35, attack: 11 },
  { id: 'F', minFloor: 31, health: 38, attack: 12 },
  { id: 'F2', minFloor: 33, health: 40, attack: 12 },
  { id: 'F3', minFloor: 35, health: 42, attack: 12 },
  { id: 'F4', minFloor: 37, health: 44, attack: 12 },
  { id: 'G', minFloor: 38, health: 44, attack: 13 },
  { id: 'G2', minFloor: 39, health: 46, attack: 13 },
  { id: 'G3', minFloor: 41, health: 48, attack: 13 },
  { id: 'G4', minFloor: 43, health: 50, attack: 13 },
]);

export const ARCHETYPES = Object.freeze({
  skirmisher: Object.freeze({ health: 1.0, attack: 1.0 }),
  bruiser: Object.freeze({ health: 1.25, attack: 0.95 }),
  swarm: Object.freeze({ health: 0.75, attack: 0.9 }),
  artillery: Object.freeze({ health: 0.7, attack: 1.15 }),
});

export function getPowerBand(floor) {
  const f = Math.max(1, Math.floor(Number(floor) || 1));
  // Sweeps replace 'enemy.powerBands' rather than rewriting this table.
  const bands = tuned('enemy.powerBands', POWER_BANDS);
  let selected = bands[0];
  for (let i = bands.length - 1; i >= 0; i--) {
    if (f >= bands[i].minFloor) {
      selected = bands[i];
      break;
    }
  }
  return selected;
}

/**
 * @param {number} floor
 * @param {string} archetype
 * @returns {{ health: number, attack: number, bandId: string }}
 */
export function resolveEnemyStats(floor, archetype = 'skirmisher') {
  const band = getPowerBand(floor);
  const bias = ARCHETYPES[archetype] || ARCHETYPES.skirmisher;
  return {
    health: Math.max(1, Math.ceil(band.health * bias.health)),
    attack: Math.max(1, Math.ceil(band.attack * bias.attack)),
    bandId: band.id,
  };
}

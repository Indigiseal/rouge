import { tuned } from './Tuning.js';

// Shared enemy power: floor bands × archetype multipliers.
// Design SoT: docs/BALANCE.md (Enemy power: bands + archetypes).

// Bands A-C are calibrated to the act-1 targets in docs/BALANCE.md and are left
// alone. D-G were lifted straight off the old Skeleton table and never revisited
// while the meta tree grew tenfold; a fully invested player was finishing 83% of
// runs against them. HP roughly doubled, ATK +10%.
//
// Raising the deep bands rather than trimming the tree is deliberate: the deep
// floors are where an invested player actually spends the run, while a fresh
// account passes the act-1 gate 14% of the time and barely sees them. The same
// change is therefore heavy on the over-powered end and nearly free on the
// under-powered one — which a flat nerf to the tree would not be.
export const POWER_BANDS = Object.freeze([
  { id: 'A', minFloor: 1, health: 8, attack: 4 },
  { id: 'B', minFloor: 5, health: 10, attack: 5 },
  { id: 'C', minFloor: 10, health: 12, attack: 7 },
  { id: 'D', minFloor: 16, health: 34, attack: 9 },
  { id: 'E', minFloor: 23, health: 34, attack: 11 },
  { id: 'F', minFloor: 31, health: 40, attack: 12 },
  { id: 'G', minFloor: 38, health: 44, attack: 13 },
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

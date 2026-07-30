// Shared enemy power: floor bands × archetype multipliers.
// Design SoT: docs/BALANCE.md (Enemy power: bands + archetypes).

export const POWER_BANDS = Object.freeze([
  { id: 'A', minFloor: 1, health: 8, attack: 5 },
  { id: 'B', minFloor: 5, health: 11, attack: 7 },
  { id: 'C', minFloor: 10, health: 12, attack: 8 },
  { id: 'D', minFloor: 16, health: 17, attack: 8 },
  { id: 'E', minFloor: 23, health: 17, attack: 10 },
  { id: 'F', minFloor: 31, health: 20, attack: 11 },
  { id: 'G', minFloor: 38, health: 22, attack: 12 },
]);

export const ARCHETYPES = Object.freeze({
  skirmisher: Object.freeze({ health: 1.0, attack: 1.0 }),
  bruiser: Object.freeze({ health: 1.25, attack: 0.95 }),
  swarm: Object.freeze({ health: 0.75, attack: 0.9 }),
  artillery: Object.freeze({ health: 0.7, attack: 1.15 }),
});

export function getPowerBand(floor) {
  const f = Math.max(1, Math.floor(Number(floor) || 1));
  let selected = POWER_BANDS[0];
  for (let i = POWER_BANDS.length - 1; i >= 0; i--) {
    if (f >= POWER_BANDS[i].minFloor) {
      selected = POWER_BANDS[i];
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

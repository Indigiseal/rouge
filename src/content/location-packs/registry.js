import { THORNWAKE_LOCATION_PACK } from './thornwake/index.js';
import { SILKDEEP_LOCATION_PACK } from './silkdeep/index.js';
import { TOLLROAD_LOCATION_PACK } from './tollroad/index.js';
import { BONEFLOOD_LOCATION_PACK } from './boneflood/index.js';
import { MIRETURN_LOCATION_PACK } from './mireturn/index.js';
import { VEILBLEED_LOCATION_PACK } from './veilbleed/index.js';
import { ASHHOWL_LOCATION_PACK } from './ashhowl/index.js';

const PACKS = [
  THORNWAKE_LOCATION_PACK,
  SILKDEEP_LOCATION_PACK,
  TOLLROAD_LOCATION_PACK,
  BONEFLOOD_LOCATION_PACK,
  MIRETURN_LOCATION_PACK,
  VEILBLEED_LOCATION_PACK,
  ASHHOWL_LOCATION_PACK,
  Object.freeze({ id: 'brassfair', name: 'Brassfair', enemies: null }),
  Object.freeze({ id: 'duskhold', name: 'Duskhold', enemies: null }),
  Object.freeze({ id: 'mirrorwane', name: 'Mirrorwane', enemies: null }),
  Object.freeze({ id: 'spherefall', name: 'Spherefall', enemies: null }),
  Object.freeze({ id: 'starfold', name: 'Starfold', enemies: null }),
  // Shelved ids remain resolvable for simulator flags and imported old saves.
  Object.freeze({ id: 'frosthollow', name: 'Frosthollow', enemies: null }),
  Object.freeze({ id: 'stormhatch', name: 'Stormhatch', enemies: null }),
];

export const LOCATION_PACK_LIST = Object.freeze(PACKS);
export const LOCATION_PACKS = Object.freeze(Object.assign(
  Object.fromEntries(PACKS.map(pack => [pack.id, pack])),
  // Compatibility only for old saves and sandbox fixtures that store an index.
  { __legacyOrder: Object.freeze(['thornwake', 'silkdeep', 'tollroad']) },
));

export function getLocationPack(locationId) {
  return LOCATION_PACKS[locationId] || null;
}

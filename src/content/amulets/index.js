// Amulet content pack registry.
import { buildLegacyAmuletDefinitions } from './legacyCatalog.js';
import { buildCurrentAmuletDefinitions } from './currentCatalog.js';

export { AMULET_RARITY_RATES, AMULET_SOURCE_MIN_FLOOR, AMULET_UPGRADE_REPLACES } from './rarityRates.js';
export { getAmuletAtlasPresentation } from './RelicsOthersAtlas.js';
export { buildLegacyAmuletDefinitions } from './legacyCatalog.js';
export { buildCurrentAmuletDefinitions } from './currentCatalog.js';

/**
 * Build the full runtime definitions map for an AmuletManager.
 * Legacy entries are marked rarity "old" then current catalog is merged on top.
 * @param {object} mgr AmuletManager instance
 * @returns {Record<string, object>}
 */
export function createAmuletDefinitions(mgr) {
  const definitions = buildLegacyAmuletDefinitions(mgr);

  // Retire the previous catalog from shops/floor/boss offers. Event grants
  // that still reference these ids keep working; their combat logic stays.
  for (const def of Object.values(definitions)) {
    def.rarity = 'old';
  }

  Object.assign(definitions, buildCurrentAmuletDefinitions(mgr));
  return definitions;
}

/**
 * Registry view over definitions. Hooks close over the manager, so this must
 * be built per AmuletManager instance (not a module-level constant).
 * @param {object} mgr AmuletManager instance
 * @returns {{ ALL_AMULETS: object[], byId: Record<string, object>, definitions: Record<string, object> }}
 */
export function getAmuletRegistry(mgr) {
  const definitions = createAmuletDefinitions(mgr);
  const byId = definitions;
  const ALL_AMULETS = Object.entries(definitions).map(([id, def]) => ({ id, ...def }));
  return { ALL_AMULETS, byId, definitions };
}

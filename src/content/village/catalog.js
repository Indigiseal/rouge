// Village buildings. Shared settlement; Support is a shared pool.
// Rank costs reuse the talent ladder (2/3/5/8/12). Numbers are the design.

import { TALENT_RANK_COSTS } from '../talents/branches.js';

export const VILLAGE_RANK_COSTS = TALENT_RANK_COSTS;

export const HEALER_RARITIES = Object.freeze([
  'common',
  'uncommon',
  'rare',
  'legendary',
]);

export const COTTAGE_HP_PER_RANK = 15;

/** @typedef {'forge'|'temple'|'armory'|'healer'|'cottage'} VillageBuildingId */

/**
 * @type {Record<VillageBuildingId, {
 *   id: VillageBuildingId,
 *   maxRank: number,
 * }>}
 */
export const VILLAGE_BUILDINGS = Object.freeze({
  forge: Object.freeze({ id: 'forge', maxRank: 5 }),
  temple: Object.freeze({ id: 'temple', maxRank: 1 }),
  armory: Object.freeze({ id: 'armory', maxRank: 5 }),
  healer: Object.freeze({ id: 'healer', maxRank: HEALER_RARITIES.length }),
  cottage: Object.freeze({ id: 'cottage', maxRank: 4 }),
});

export const VILLAGE_BUILDING_IDS = Object.freeze(Object.keys(VILLAGE_BUILDINGS));

/** Dedicated lots on the 640x360 map. Null id = future empty lot. */
export const VILLAGE_PLOTS = Object.freeze([
  Object.freeze({ id: 'forge', x: 128, y: 126, w: 124, h: 80 }),
  Object.freeze({ id: 'temple', x: 320, y: 116, w: 124, h: 80 }),
  Object.freeze({ id: 'armory', x: 512, y: 126, w: 124, h: 80 }),
  Object.freeze({ id: 'healer', x: 320, y: 226, w: 124, h: 80 }),
  Object.freeze({ id: 'cottage', x: 128, y: 226, w: 124, h: 80 }),
  Object.freeze({ id: null, x: 512, y: 226, w: 108, h: 68 }),
]);

export function getVillageBuilding(id) {
  return VILLAGE_BUILDINGS[id] || null;
}

export function emptyVillageBuildings() {
  return { forge: 0, temple: 0, armory: 0, healer: 0, cottage: 0 };
}

export function maxVillageBuildings() {
  const out = emptyVillageBuildings();
  for (const id of VILLAGE_BUILDING_IDS) {
    out[id] = VILLAGE_BUILDINGS[id].maxRank;
  }
  return out;
}

export function normalizeVillageBuildings(src) {
  const out = emptyVillageBuildings();
  if (!src || typeof src !== 'object') return out;
  for (const id of VILLAGE_BUILDING_IDS) {
    const max = VILLAGE_BUILDINGS[id].maxRank;
    out[id] = Math.max(0, Math.min(max, Math.floor(Number(src[id]) || 0)));
  }
  return out;
}

export function costForVillageRank(currentRank) {
  if (currentRank < 0) return VILLAGE_RANK_COSTS[0];
  if (currentRank >= VILLAGE_RANK_COSTS.length) return null;
  return VILLAGE_RANK_COSTS[currentRank];
}

export function healerRarityForRank(rank) {
  const n = Math.max(0, Math.floor(Number(rank) || 0));
  return HEALER_RARITIES[n - 1] || null;
}

/** Runtime bag merged onto talentEffects so existing combat/UI paths read it. */
export function resolveVillageEffects(buildings, characterId) {
  const b = normalizeVillageBuildings(buildings);
  const fx = {
    villageWeaponFlat: 0,
    villageArmoryDef: 0,
    villageDodge: 0,
    templeRevive: false,
    healerRank: 0,
    villageMaxHp: 0,
    secondWindCharges: 0,
    secondWindHealPct: 0,
  };
  const forge = b.forge || 0;
  if (forge > 0) fx.villageWeaponFlat = forge;

  if ((b.temple || 0) >= 1) {
    fx.templeRevive = true;
    fx.secondWindCharges = 1;
    fx.secondWindHealPct = 0.5;
  }

  const armory = b.armory || 0;
  if (armory > 0) {
    if (characterId === 'warrior') fx.villageArmoryDef = armory;
    if (characterId === 'rogue') fx.villageDodge = Math.min(0.5, armory * 0.1);
  }

  fx.healerRank = b.healer || 0;
  fx.villageMaxHp = cottageHpForRank(b.cottage || 0);
  return fx;
}

export function cottageHpForRank(rank) {
  const n = Math.max(0, Math.floor(Number(rank) || 0));
  const max = VILLAGE_BUILDINGS.cottage.maxRank;
  return Math.min(max, n) * COTTAGE_HP_PER_RANK;
}

/** Merge village bag onto talentEffects without wiping talent keys. */
export function mergeVillageIntoTalentEffects(talentEffects, villageFx) {
  const bag = talentEffects || {};
  if (!villageFx) return bag;
  bag.villageWeaponFlat = villageFx.villageWeaponFlat || 0;
  bag.villageArmoryDef = villageFx.villageArmoryDef || 0;
  bag.villageDodge = villageFx.villageDodge || 0;
  bag.templeRevive = Boolean(villageFx.templeRevive);
  bag.healerRank = villageFx.healerRank || 0;
  bag.villageMaxHp = villageFx.villageMaxHp || 0;
  if (villageFx.templeRevive) {
    bag.secondWindCharges = Math.max(bag.secondWindCharges || 0, villageFx.secondWindCharges || 0);
    bag.secondWindHealPct = Math.max(bag.secondWindHealPct || 0, villageFx.secondWindHealPct || 0);
  }
  return bag;
}

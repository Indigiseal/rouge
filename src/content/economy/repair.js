// Anvil repair cost tables.

/** Coins per durability point by weapon type and rarity tier (1–4). */
export const WEAPON_REPAIR_COSTS = Object.freeze({
  dagger: Object.freeze({ 1: 1, 2: 2, 3: 2, 4: 2 }),
  bow: Object.freeze({ 1: 2, 2: 2, 3: 2, 4: 3 }),
  sword: Object.freeze({ 1: 2, 2: 2, 3: 2, 4: 2 }),
  axe: Object.freeze({ 1: 4, 2: 4, 3: 4, 4: 4 }),
});

/** Armor: coins charged per REPAIR_ARMOR_CHUNK durability points. */
export const ARMOR_REPAIR_COST = 2;
export const REPAIR_ARMOR_CHUNK = 5;

export const THORNS_REPAIR_COST = 2;
export const DEFAULT_REPAIR_COST = 2;

export const RARITY_TO_TIER = Object.freeze({
  common: 1,
  uncommon: 2,
  rare: 3,
  legendary: 4,
});

export function repairTierForRarity(rarity) {
  return RARITY_TO_TIER[rarity] || 1;
}

export function weaponRepairCostPerPoint(weaponType, tier) {
  return WEAPON_REPAIR_COSTS[weaponType]?.[tier] || DEFAULT_REPAIR_COST;
}

export function repairCostPerUnit(item, weaponType) {
  if (item.type === 'weapon') {
    const tier = repairTierForRarity(item.rarity);
    return weaponRepairCostPerPoint(weaponType, tier);
  }
  if (item.type === 'armor') return ARMOR_REPAIR_COST;
  if (item.type === 'thorns') return THORNS_REPAIR_COST;
  return DEFAULT_REPAIR_COST;
}

/** Total coin cost to restore `amount` durability on `item`. */
export function totalRepairCost(item, amount, weaponType) {
  const costPerUnit = repairCostPerUnit(item, weaponType);
  if (item.type === 'armor') {
    return Math.ceil(amount / REPAIR_ARMOR_CHUNK) * costPerUnit;
  }
  return amount * costPerUnit;
}

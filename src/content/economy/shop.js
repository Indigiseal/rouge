// Shop pricing constants and formulas (regular + rare shop).

/** Crystal price multipliers by amulet rarity (regular shop). */
export const SHOP_AMULET_CRYSTAL_RARITY_MULT = Object.freeze({
  common: 1,
  uncommon: 1.5,
  rare: 2,
  legendary: 3,
  cursed: 1.5,
});

export const SHOP_AMULET_CRYSTAL_BASE = 2;
export const SHOP_AMULET_CRYSTAL_MIN = 1;
/** Every N owned amulets adds +1 crystal to the next offer. */
export const SHOP_AMULET_STACK_STEP = 3;

/** Coin price multipliers by item rarity (regular shop). */
export const SHOP_ITEM_RARITY_MULT = Object.freeze({
  common: 1,
  uncommon: 1.5,
  rare: 2,
  epic: 2.5,
  legendary: 3,
});

export const SHOP_ITEM_BASE = 5;
export const SHOP_ITEM_FLOOR_MULT = 2;
export const SHOP_MAGIC_MULT = 1.2;
export const SHOP_ARTIFACT_MULT = 2;
export const SHOP_SELL_RATIO = 0.4;
export const SHOP_ARMOR_PROTECTION_MULT = 2;
export const SHOP_THORNS_DAMAGE_MULT = 3;

/** Rare-shop amulet crystal rarity multipliers. */
export const RARE_SHOP_AMULET_RARITY_MULT = Object.freeze({
  uncommon: 1.5,
  rare: 2,
  legendary: 3,
});

export const RARE_SHOP_AMULET_MIN = 2;
export const RARE_SHOP_WEAPON_BASE = 20;
export const RARE_SHOP_WEAPON_FLOOR_MULT = 5;
export const RARE_SHOP_ARMOR_BASE = 25;
export const RARE_SHOP_ARMOR_FLOOR_MULT = 5;
export const RARE_SHOP_THORNS_BASE = 15;
export const RARE_SHOP_THORNS_FLOOR_MULT = 4;
export const RARE_SHOP_GEM_BASE = 18;
export const RARE_SHOP_GEM_FLOOR_MULT = 4;
export const RARE_SHOP_BONUS_BASE = 30;
export const RARE_SHOP_BONUS_FLOOR_MULT = 5;
export const RARE_SHOP_COMPANION_CRYSTAL_EXTRA = 1;
export const RARE_SHOP_COMPANION_CHANCE = 0.35;

export function shopAmuletCrystalPrice(amulet, ownedAmuletCount = 0) {
  let basePrice = SHOP_AMULET_CRYSTAL_BASE;
  basePrice = Math.floor(basePrice * (SHOP_AMULET_CRYSTAL_RARITY_MULT[amulet.rarity] || 1));
  basePrice += Math.floor(ownedAmuletCount / SHOP_AMULET_STACK_STEP);
  return Math.max(SHOP_AMULET_CRYSTAL_MIN, basePrice);
}

export function shopItemBuyPrice(item, floor, { isArtifact = false } = {}) {
  let basePrice = SHOP_ITEM_BASE + floor * SHOP_ITEM_FLOOR_MULT;
  basePrice *= (SHOP_ITEM_RARITY_MULT[item.rarity] || 1);

  if (item.type === 'weapon') {
    basePrice += item.damage || 0;
  } else if (item.type === 'armor') {
    basePrice += (item.protection || 0) * SHOP_ARMOR_PROTECTION_MULT;
  } else if (item.type === 'thorns') {
    basePrice += (item.thornDamage || 0) * SHOP_THORNS_DAMAGE_MULT;
  } else if (item.type === 'magic') {
    basePrice *= SHOP_MAGIC_MULT;
  }

  if (isArtifact) {
    basePrice *= SHOP_ARTIFACT_MULT;
  }

  return Math.floor(basePrice);
}

export function shopItemSellPrice(item, floor) {
  return Math.floor(shopItemBuyPrice(item, floor) * SHOP_SELL_RATIO);
}

export function rareShopAmuletCrystalPrice(amulet, floor) {
  const rarityMult = RARE_SHOP_AMULET_RARITY_MULT[amulet.rarity] || 2;
  return Math.max(
    RARE_SHOP_AMULET_MIN,
    Math.floor((Math.floor(floor / 10) + 2) * rarityMult)
  );
}

export function rareShopWeaponPrice(floor) {
  return RARE_SHOP_WEAPON_BASE + floor * RARE_SHOP_WEAPON_FLOOR_MULT;
}

export function rareShopArmorPrice(floor) {
  return RARE_SHOP_ARMOR_BASE + floor * RARE_SHOP_ARMOR_FLOOR_MULT;
}

export function rareShopThornsPrice(floor) {
  return RARE_SHOP_THORNS_BASE + floor * RARE_SHOP_THORNS_FLOOR_MULT;
}

export function rareShopGemPrice(floor) {
  return RARE_SHOP_GEM_BASE + floor * RARE_SHOP_GEM_FLOOR_MULT;
}

export function rareShopBonusItemPrice(floor) {
  return RARE_SHOP_BONUS_BASE + floor * RARE_SHOP_BONUS_FLOOR_MULT;
}

// Armor identity (stats) and loot spawn schedule are separate tables.
// Talent starters / merge / shops build cards via createArmorCardData.

export const ARMOR_RARITIES = Object.freeze([
  'common', 'uncommon', 'rare', 'epic', 'legendary',
]);

/** Intrinsic armor stats by type × rarity. No spawn floors here. */
export const ARMORS = Object.freeze({
  leather: Object.freeze({
    // Dodge-only armor: no protection. Durability ticks on successful dodge.
    common: Object.freeze({ protection: 0, dodgeChance: 0.10, sprite: 'leather_C' }),
    uncommon: Object.freeze({ protection: 0, dodgeChance: 0.15, sprite: 'leather_U' }),
    rare: Object.freeze({ protection: 0, dodgeChance: 0.20, sprite: 'leather_R' }),
    epic: Object.freeze({ protection: 0, dodgeChance: 0.25, sprite: 'leather_E' }),
    legendary: Object.freeze({ protection: 0, dodgeChance: 0.30, sprite: 'leather_L' }),
  }),
  chain: Object.freeze({
    // Flat DEF + chance to counter melee for ceil(50% of blocked), no weapon pip.
    common: Object.freeze({ protection: 1, meleeCounterChance: 0.10, sprite: 'chain_C' }),
    uncommon: Object.freeze({ protection: 2, meleeCounterChance: 0.15, sprite: 'chain_U' }),
    rare: Object.freeze({ protection: 3, meleeCounterChance: 0.20, sprite: 'chain_R' }),
    epic: Object.freeze({ protection: 4, meleeCounterChance: 0.25, sprite: 'chain_E' }),
    legendary: Object.freeze({ protection: 4, meleeCounterChance: 0.25, sprite: 'chain_L' }),
  }),
  plate: Object.freeze({
    // Flat DEF + chance to fully ignore a ranged hit.
    common: Object.freeze({ protection: 1, rangedIgnoreChance: 0.50, sprite: 'plate_C' }),
    uncommon: Object.freeze({ protection: 2, rangedIgnoreChance: 0.75, sprite: 'plate_U' }),
    rare: Object.freeze({ protection: 3, rangedIgnoreChance: 1.00, sprite: 'plate_R' }),
    epic: Object.freeze({ protection: 4, rangedIgnoreChance: 1.00, sprite: 'plate_E' }),
    legendary: Object.freeze({ protection: 4, rangedIgnoreChance: 1.00, sprite: 'plate_L' }),
  }),
});

/** Earliest floor this type×rarity may appear as loot. Starters ignore this. */
export const ARMOR_SPAWN_MIN_FLOOR = Object.freeze({
  leather: Object.freeze({
    common: 1, uncommon: 10, rare: 18, epic: 26, legendary: 34,
  }),
  chain: Object.freeze({
    common: 1, uncommon: 1, rare: 1, epic: 1, legendary: 1,
  }),
  plate: Object.freeze({
    common: 1, uncommon: 1, rare: 1, epic: 1, legendary: 1,
  }),
});

export const ARMOR_DURABILITY_BY_TYPE = Object.freeze({
  leather: Object.freeze({ common: 15, uncommon: 20, rare: 25, epic: 28, legendary: 30 }),
  chain: Object.freeze({ common: 15, uncommon: 20, rare: 25, epic: 28, legendary: 30 }),
  plate: Object.freeze({ common: 15, uncommon: 20, rare: 25, epic: 28, legendary: 30 }),
});

export function armorDurability(armorType, rarity) {
  const byType = ARMOR_DURABILITY_BY_TYPE[armorType]
    || ARMOR_DURABILITY_BY_TYPE.leather;
  return byType[rarity] || byType.common || 15;
}

export function getArmorStats(armorType, rarity) {
  return ARMORS[armorType]?.[rarity] || null;
}

export function armorSpawnMinFloor(armorType, rarity) {
  const floor = ARMOR_SPAWN_MIN_FLOOR[armorType]?.[rarity];
  return Number.isFinite(floor) ? floor : Infinity;
}

export function isArmorSpawnableAtFloor(armorType, rarity, floor) {
  return floor >= armorSpawnMinFloor(armorType, rarity);
}

function titleCase(value) {
  const s = String(value || '');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

/** Build a runtime armor card from the catalog. */
export function createArmorCardData(armorType, rarity, extras = null) {
  const data = getArmorStats(armorType, rarity);
  if (!data) return null;
  const dur = armorDurability(armorType, rarity);
  const card = {
    type: 'armor',
    name: `${titleCase(rarity)} ${titleCase(armorType)} Armor`,
    armorType,
    protection: data.protection || 0,
    rarity,
    sprite: data.sprite,
    durability: dur,
    maxDurability: dur,
  };
  if (armorType === 'leather' && data.dodgeChance != null) {
    card.dodgeChance = data.dodgeChance;
  }
  if (armorType === 'chain' && data.meleeCounterChance != null) {
    card.meleeCounterChance = data.meleeCounterChance;
  }
  if (armorType === 'plate' && data.rangedIgnoreChance != null) {
    card.rangedIgnoreChance = data.rangedIgnoreChance;
  }
  if (extras && typeof extras === 'object') Object.assign(card, extras);
  return card;
}

/**
 * @deprecated Prefer ARMORS + ARMOR_SPAWN_MIN_FLOOR.
 * Merged view for older call sites during migration.
 */
export const ARMOR_UNLOCKS = Object.freeze(
  Object.fromEntries(
    Object.keys(ARMORS).map((armorType) => [
      armorType,
      Object.freeze(
        Object.fromEntries(
          ARMOR_RARITIES.filter((r) => ARMORS[armorType][r]).map((rarity) => [
            rarity,
            Object.freeze({
              ...ARMORS[armorType][rarity],
              floor: armorSpawnMinFloor(armorType, rarity),
            }),
          ])
        )
      ),
    ])
  )
);

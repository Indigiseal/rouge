
// Armor identity (stats) and loot spawn schedule are separate tables.
// Talent starters / merge / shops build cards via createArmorCardData.

/** The most a plate armor can ignore of ranged hits, talents included. */
export const PLATE_RANGED_IGNORE_MAX = 0.7;

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
    // Ranged ignore tops out at PLATE_RANGED_IGNORE_MAX (Taya): at 100% a
    // plate wearer could not be shot at all.
    common: Object.freeze({ protection: 1, rangedIgnoreChance: 0.40, sprite: 'plate_C' }),
    uncommon: Object.freeze({ protection: 2, rangedIgnoreChance: 0.50, sprite: 'plate_U' }),
    rare: Object.freeze({ protection: 3, rangedIgnoreChance: 0.60, sprite: 'plate_R' }),
    epic: Object.freeze({ protection: 4, rangedIgnoreChance: 0.65, sprite: 'plate_E' }),
    legendary: Object.freeze({ protection: 4, rangedIgnoreChance: 0.70, sprite: 'plate_L' }),
  }),
  padded: Object.freeze({
    // The weakest armour (Taya): plain DEF and nothing else, no dodge, counter
    // or ranged ignore. A step behind chain and plate from uncommon up, and it
    // wears out as fast as leather.
    common: Object.freeze({ protection: 1, sprite: 'padded_C' }),
    uncommon: Object.freeze({ protection: 1, sprite: 'padded_U' }),
    rare: Object.freeze({ protection: 2, sprite: 'padded_R' }),
    epic: Object.freeze({ protection: 3, sprite: 'padded_E' }),
    legendary: Object.freeze({ protection: 3, sprite: 'padded_L' }),
  }),
});

/** Earliest floor this type×rarity may appear as loot. Starters ignore this. */
export const ARMOR_SPAWN_MIN_FLOOR = Object.freeze({
  leather: Object.freeze({
    common: 1, uncommon: 10, rare: 25, epic: 35, legendary: 35,
  }),
  chain: Object.freeze({
    common: 1, uncommon: 10, rare: 25, epic: 35, legendary: 35,
  }),
  plate: Object.freeze({
    common: 1, uncommon: 10, rare: 25, epic: 35, legendary: 35,
  }),
  padded: Object.freeze({
    common: 1, uncommon: 10, rare: 25, epic: 35, legendary: 35,
  }),
});

// How likely each armour family is to drop, by floor (Taya). Padded, the
// weakest, is the everyday armour of the first floors; chain comes in from
// floor 4 and plate from floor 9, and they take over as the run goes on.
// A weight of 0 means the family does not drop yet. The rarity floors above
// still apply on top of this.
export const ARMOR_TYPE_WEIGHT_BANDS = Object.freeze([
  Object.freeze({ upToFloor: 3, weights: Object.freeze({ padded: 7, leather: 3, chain: 0, plate: 0 }) }),
  Object.freeze({ upToFloor: 8, weights: Object.freeze({ padded: 5, leather: 3, chain: 2, plate: 0 }) }),
  Object.freeze({ upToFloor: 15, weights: Object.freeze({ padded: 3, leather: 3, chain: 3, plate: 1 }) }),
  Object.freeze({ upToFloor: 30, weights: Object.freeze({ padded: 2, leather: 3, chain: 3, plate: 2 }) }),
  Object.freeze({ upToFloor: Infinity, weights: Object.freeze({ padded: 1, leather: 2, chain: 3, plate: 4 }) }),
]);

/** Drop weight of an armour family on `floor` (0: not dropping yet). */
export function armorTypeWeight(armorType, floor) {
  const band = ARMOR_TYPE_WEIGHT_BANDS.find((b) => floor <= b.upToFloor) || ARMOR_TYPE_WEIGHT_BANDS.at(-1);
  return band.weights[armorType] ?? 0;
}

// Leather and the DEF armours spend durability under DIFFERENT rules, so equal
// numbers here were not equal armour. Leather ticks only on a successful dodge
// (10-30% of hits), while chain/plate tick on every hit their protection
// absorbs. At 15 durability that is a ~150-hit lifetime against a 15-hit one,
// and ~60 damage prevented against ~15 — leather was roughly 4x the armour at
// every tier, and the warrior wore the worse half.
//
// Doubling the DEF armours closed it for the old warrior: reach F15 43.3% ->
// 52.6%, level with the rogue's 52.9%.
//
// With one hero who wears every family, the doubling no longer earned its
// keep: armour broke 0.06 times a run and died with 70% of its pips left.
// Trimmed to ~1.33x leather (fresh, no amulets, 3000 runs, seed 777): reach
// 29.7% -> 29.1%, within noise, while armour breaks ~3x as often (0.16 a
// run) so the anvil and merges have something to do.
//
// Lowered across the board (Taya): no armour should reach 40, and the weakest,
// a common padded, sits at 12. Chain and plate stay ~1.3x leather (the reason
// above still holds); padded, which ticks on every hit, is shorter-lived still.
export const ARMOR_DURABILITY_BY_TYPE = Object.freeze({
  leather: Object.freeze({ common: 12, uncommon: 15, rare: 18, epic: 20, legendary: 22 }),
  chain: Object.freeze({ common: 16, uncommon: 19, rare: 22, epic: 25, legendary: 28 }),
  plate: Object.freeze({ common: 16, uncommon: 19, rare: 22, epic: 25, legendary: 28 }),
  padded: Object.freeze({ common: 12, uncommon: 14, rare: 16, epic: 18, legendary: 20 }),
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

// Weapon identity (stats) and loot spawn schedule are separate tables.
// Starting loadouts / merge / shops all build cards via createWeaponCardData —
// never copy damage/sprite/special into CharacterClasses or scenes.

import { gemSlotsForRarity } from './gems.js';

export const WEAPON_RARITIES = Object.freeze([
  'common', 'uncommon', 'rare', 'epic', 'legendary',
]);

/** Intrinsic weapon stats by type × rarity. No spawn floors here. */
export const WEAPONS = Object.freeze({
  dagger: Object.freeze({
    common: Object.freeze({ damage: 3, sprite: 'dagger_C', special: 'dualWield' }),
    uncommon: Object.freeze({ damage: 4, sprite: 'dagger_U', special: 'dualWield' }),
    rare: Object.freeze({ damage: 5, sprite: 'dagger_R', special: 'dualWield' }),
    epic: Object.freeze({ damage: 6, sprite: 'dagger_E', special: 'dualWield' }),
    legendary: Object.freeze({ damage: 7, sprite: 'dagger_L', special: 'dualWield' }),
  }),
  bow: Object.freeze({
    common: Object.freeze({ damage: 4, sprite: 'bow_c', special: 'block', range: 'ranged' }),
    uncommon: Object.freeze({ damage: 5, sprite: 'bow_U', special: 'block', range: 'ranged' }),
    rare: Object.freeze({ damage: 6, sprite: 'bow_R', special: 'block', range: 'ranged' }),
    epic: Object.freeze({ damage: 7, sprite: 'bow_E', special: 'block', range: 'ranged' }),
    legendary: Object.freeze({ damage: 9, sprite: 'bow_L', special: 'block', range: 'ranged' }),
  }),
  sword: Object.freeze({
    common: Object.freeze({ damage: 5, sprite: 'sword_C', special: null }),
    uncommon: Object.freeze({ damage: 6, sprite: 'sword_U', special: null }),
    rare: Object.freeze({ damage: 7, sprite: 'sword_R', special: null }),
    epic: Object.freeze({ damage: 8, sprite: 'sword_E', special: null }),
    legendary: Object.freeze({ damage: 9, sprite: 'sword_L', special: null }),
  }),
  axe: Object.freeze({
    common: Object.freeze({ damage: 7, sprite: 'axe_C', special: 'specialAttack' }),
    uncommon: Object.freeze({ damage: 9, sprite: 'axe_U', special: 'specialAttack' }),
    rare: Object.freeze({ damage: 11, sprite: 'axe_R', special: 'specialAttack' }),
    epic: Object.freeze({ damage: 13, sprite: 'axe_E', special: 'specialAttack' }),
    legendary: Object.freeze({ damage: 16, sprite: 'axe_L', special: 'specialAttack' }),
  }),
});

/**
 * Earliest floor this type×rarity may appear as loot / shop stock.
 * Starting loadouts ignore this table (warrior can start with swords before
 * sword commons enter the floor pool).
 */
export const WEAPON_SPAWN_MIN_FLOOR = Object.freeze({
  dagger: Object.freeze({
    common: 1, uncommon: 8, rare: 18, epic: 26, legendary: 34,
  }),
  // Bow commons from F1 — half of the rogue starting kit needs resupply early.
  bow: Object.freeze({
    common: 1, uncommon: 12, rare: 24, epic: 30, legendary: 38,
  }),
  // Act 2 weapon — not in the act-1 floor pool (dagger+bow lane).
  sword: Object.freeze({
    common: 16, uncommon: 19, rare: 22, epic: 25, legendary: 28,
  }),
  // Act 3 only.
  axe: Object.freeze({
    common: 31, uncommon: 34, rare: 37, epic: 40, legendary: 43,
  }),
});

export const WEAPON_DURABILITY_BY_TYPE = Object.freeze({
  dagger: Object.freeze({ common: 4, uncommon: 5, rare: 6, epic: 7, legendary: 8 }),
  bow: Object.freeze({ common: 5, uncommon: 6, rare: 7, epic: 8, legendary: 9 }),
  sword: Object.freeze({ common: 6, uncommon: 8, rare: 10, epic: 11, legendary: 13 }),
  axe: Object.freeze({ common: 6, uncommon: 8, rare: 10, epic: 12, legendary: 14 }),
});

export function weaponDurability(weaponType, rarity) {
  return WEAPON_DURABILITY_BY_TYPE[weaponType]?.[rarity] || 5;
}

export function getWeaponStats(weaponType, rarity) {
  return WEAPONS[weaponType]?.[rarity] || null;
}

export function weaponSpawnMinFloor(weaponType, rarity) {
  const floor = WEAPON_SPAWN_MIN_FLOOR[weaponType]?.[rarity];
  return Number.isFinite(floor) ? floor : Infinity;
}

export function isWeaponSpawnableAtFloor(weaponType, rarity, floor) {
  return floor >= weaponSpawnMinFloor(weaponType, rarity);
}

function titleCase(value) {
  const s = String(value || '');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

/**
 * Build a runtime weapon card from the catalog.
 * Spawn eligibility is the caller's job (loot/shop); starters skip that check.
 */
export function createWeaponCardData(weaponType, rarity, extras = null) {
  const data = getWeaponStats(weaponType, rarity);
  if (!data) return null;
  const dur = weaponDurability(weaponType, rarity);
  const card = {
    type: 'weapon',
    name: `${titleCase(rarity)} ${titleCase(weaponType)}`,
    weaponType,
    damage: data.damage,
    rarity,
    sprite: data.sprite,
    special: data.special ?? null,
    range: data.range || 'melee',
    poisonDamage: data.poisonDamage || 0,
    poisonTurns: data.poisonTurns || 0,
    poisonStackable: data.poisonStackable || false,
    durability: dur,
    maxDurability: dur,
    gemSlots: gemSlotsForRarity(rarity),
  };
  if (extras && typeof extras === 'object') Object.assign(card, extras);
  return card;
}

/**
 * @deprecated Prefer WEAPONS + WEAPON_SPAWN_MIN_FLOOR.
 * Merged view kept only for older call sites during migration.
 */
export const WEAPON_UNLOCKS = Object.freeze(
  Object.fromEntries(
    Object.keys(WEAPONS).map((weaponType) => [
      weaponType,
      Object.freeze(
        Object.fromEntries(
          WEAPON_RARITIES.filter((r) => WEAPONS[weaponType][r]).map((rarity) => [
            rarity,
            Object.freeze({
              ...WEAPONS[weaponType][rarity],
              floor: weaponSpawnMinFloor(weaponType, rarity),
            }),
          ])
        )
      ),
    ])
  )
);

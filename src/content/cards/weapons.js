// Weapon identity (stats) and loot spawn schedule are separate tables.
// Starting loadouts / merge / shops all build cards via createWeaponCardData —
// never copy damage/sprite/special into CharacterClasses or scenes.

import { gemSlotsForRarity } from './gems.js';

// Sword identity. The sword used to carry `special: null` — a bigger number and
// nothing else, against a dagger whose off-hand pip is free (effectively double
// output) and a bow that reaches past the frontline gate. Measured consequence:
// the warrior abandoned his own weapon — 50.9% of act-1 floors on an
// off-identity weapon against the rogue's 100% — and handing him MORE swords
// made him worse, because he traded away the bow's reach for nothing.
//
// Cleave carries the blow into one other front enemy. Picked over a defensive
// ability because its value grows with how many enemies share the board, and
// enemy density rises by act (0.19 -> 0.28, EnemyDensity.js) — so the sword
// scales with depth on its own, the same principle as DepthScaling.js.
export const SWORD_CLEAVE_FRACTION = 0.5;

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
    common: Object.freeze({ damage: 4, sprite: 'bow_c', range: 'ranged' }),
    uncommon: Object.freeze({ damage: 5, sprite: 'bow_U', range: 'ranged' }),
    rare: Object.freeze({ damage: 6, sprite: 'bow_R', range: 'ranged' }),
    epic: Object.freeze({ damage: 7, sprite: 'bow_E', range: 'ranged' }),
    legendary: Object.freeze({ damage: 9, sprite: 'bow_L', range: 'ranged' }),
  }),
  sword: Object.freeze({
    common: Object.freeze({ damage: 5, sprite: 'sword_C', special: 'cleave' }),
    uncommon: Object.freeze({ damage: 6, sprite: 'sword_U', special: 'cleave' }),
    rare: Object.freeze({ damage: 7, sprite: 'sword_R', special: 'cleave' }),
    epic: Object.freeze({ damage: 8, sprite: 'sword_E', special: 'cleave' }),
    legendary: Object.freeze({ damage: 9, sprite: 'sword_L', special: 'cleave' }),
  }),
  // Spear: the warrior's answer to the back row. He had none — the frontline
  // gate holds melee to MELEE-role targets, so the only way to touch an archer
  // was a bow, which carries neither his crit nor any Iron synergy. Measured, he
  // spent about half of act 1 on borrowed ranged weapons. Reach keeps him on his
  // own ladder instead. Damage sits under the sword: the sword trades reach for
  // cleave, the spear trades cleave for reach.
  spear: Object.freeze({
    common: Object.freeze({ damage: 4, sprite: 'spear_C', special: 'reach' }),
    uncommon: Object.freeze({ damage: 5, sprite: 'spear_U', special: 'reach' }),
    rare: Object.freeze({ damage: 6, sprite: 'spear_R', special: 'reach' }),
    epic: Object.freeze({ damage: 7, sprite: 'spear_E', special: 'reach' }),
    legendary: Object.freeze({ damage: 8, sprite: 'spear_L', special: 'reach' }),
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
  spear: Object.freeze({ common: 5, uncommon: 6, rare: 8, epic: 9, legendary: 11 }),
  sword: Object.freeze({ common: 6, uncommon: 8, rare: 10, epic: 11, legendary: 13 }),
  axe: Object.freeze({ common: 6, uncommon: 8, rare: 10, epic: 12, legendary: 14 }),
});

export function weaponDurability(weaponType, rarity) {
  return WEAPON_DURABILITY_BY_TYPE[weaponType]?.[rarity] || 5;
}

export function getWeaponStats(weaponType, rarity) {
  return WEAPONS[weaponType]?.[rarity] || null;
}

/**
 * Per-class overrides of the shared schedule above.
 *
 * The shared table is an act ladder by weapon TYPE: dagger/bow in act 1, sword
 * in act 2, axe in act 3. That fits the rogue exactly — his class bonus and the
 * whole Shadow tree are dagger/bow — but it left the warrior with no sword in
 * the act-1 loot pool at all. He starts with two common swords, they break, and
 * he spends the rest of the act on borrowed daggers with his sword/axe crit
 * switched off: measured 50.9% of act-1 floors on an off-identity weapon
 * against the rogue's 100% on-identity.
 *
 * So the ladder is per class. Nothing is removed from anyone's pool — the
 * warrior's own weapon simply exists when his identity says it should.
 */
// EMPTY ON PURPOSE. Handing the warrior swords from F1 was measured and made
// him WORSE (act-1 pass 3.9% -> 2.8%) even though his on-identity share rose
// 50.9% -> 69.7%: he traded bows for swords and lost by the trade. A common
// sword is 5 damage with `special: null`, against two daggers at an effective 6
// (the off-hand pip is free) and a bow that reaches past the frontline gate.
// The warrior's problem is not that his weapon is missing, it is that his
// weapon does nothing. Fill this table once the sword has an ability worth its
// slot (docs/OPEN-QUESTIONS.md).
export const WEAPON_SPAWN_MIN_FLOOR_BY_CLASS = Object.freeze({});

/**
 * Does this weapon reach past the frontline gate?
 *
 * The gate holds melee attacks to MELEE-role targets while any melee enemy
 * lives. Bows bypass it because reach is their whole point; the spear bypasses
 * it while staying a melee weapon, which is the whole point of the spear. One
 * predicate, so the combat gate and the bot's target planner cannot drift apart
 * on the answer the way the stalemate detector once did.
 */
export function weaponIgnoresFrontline(weapon) {
  if (!weapon) return false;
  if (weapon.special === 'reach') return true;
  return weapon.range === 'ranged' || weapon.isRanged === true;
}

export function weaponSpawnMinFloor(weaponType, rarity, characterId = null) {
  const override = characterId
    ? WEAPON_SPAWN_MIN_FLOOR_BY_CLASS[characterId]?.[weaponType]?.[rarity]
    : undefined;
  const floor = Number.isFinite(override)
    ? override
    : WEAPON_SPAWN_MIN_FLOOR[weaponType]?.[rarity];
  return Number.isFinite(floor) ? floor : Infinity;
}

export function isWeaponSpawnableAtFloor(weaponType, rarity, floor, characterId = null) {
  return floor >= weaponSpawnMinFloor(weaponType, rarity, characterId);
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
  // Blocking is retained as a generic weapon hook, but it is no longer a bow
  // ability. Keep the catalog/factory invariant even if a legacy caller passes
  // the old special through `extras`.
  if (weaponType === 'bow' && card.special === 'block') card.special = null;
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

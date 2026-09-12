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
// Cleave carries the blow into the enemies immediately to either side of the
// selected target. Picked over a defensive
// ability because its value grows with how many enemies share the board, and
// enemy density rises by act (0.19 -> 0.28, EnemyDensity.js) — so the sword
// scales with depth on its own, the same principle as DepthScaling.js.
export const SWORD_CLEAVE_FRACTION = 0.5;
export const SPEAR_PIERCE_FRACTION = 0.5;

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
  // spent about half of act 1 on borrowed ranged weapons. Piercing keeps him on
  // his own ladder instead. Damage sits under the sword: the sword trades range
  // for cleave, while the spear drives half damage through the rest of a column.
  spear: Object.freeze({
    common: Object.freeze({ damage: 4, sprite: 'spear_C', special: 'pierce' }),
    uncommon: Object.freeze({ damage: 5, sprite: 'spear_U', special: 'pierce' }),
    rare: Object.freeze({ damage: 6, sprite: 'spear_R', special: 'pierce' }),
    epic: Object.freeze({ damage: 7, sprite: 'spear_E', special: 'pierce' }),
    legendary: Object.freeze({ damage: 8, sprite: 'spear_L', special: 'pierce' }),
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
  // Melee counterpart to the bow: the same availability curve, but its thrust
  // continues through enemies in one board column.
  spear: Object.freeze({
    common: 12, uncommon: 20, rare: 30, epic: 40, legendary: 40,
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

function inferWeaponType(weapon) {
  if (WEAPONS[weapon?.weaponType]) return weapon.weaponType;
  const identity = `${weapon?.name || ''} ${weapon?.sprite || ''} ${weapon?.id || ''}`.toLowerCase();
  return Object.keys(WEAPONS).find(type => identity.includes(type)) || '';
}

/** Restore intrinsic weapon identity on cards persisted before abilities changed. */
export function normalizeWeaponIdentity(weapon) {
  if (weapon?.type !== 'weapon') return weapon;
  const weaponType = inferWeaponType(weapon);
  const stats = getWeaponStats(weaponType, weapon.rarity);
  if (!stats) return weapon;

  const normalized = { ...weapon, weaponType };
  // Damage, durability, gems and enchants are run state and must survive. These
  // fields describe the weapon type itself and therefore follow the catalogue.
  normalized.special = stats.special ?? null;
  if (stats.range !== undefined) normalized.range = stats.range;
  else delete normalized.range;
  return normalized;
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
 * Does this weapon bypass the frontline gate?
 *
 * The gate holds melee attacks to MELEE-role targets while any melee enemy
 * lives. Bows bypass it because range is their whole point; the spear bypasses
 * it while staying a melee weapon, as part of its piercing identity. One
 * predicate, so the combat gate and the bot's target planner cannot drift apart
 * on the answer the way the stalemate detector once did.
 */
export function weaponIgnoresFrontline(weapon) {
  if (!weapon) return false;
  // `reach` remains valid for cards loaded from older saves.
  if (weapon.special === 'pierce' || weapon.special === 'reach') return true;
  return weapon.range === 'ranged' || weapon.isRanged === true;
}

/** Enemies behind the selected target in the spear's logical board column. */
export function spearPierceTargetIndices(board, primaryIndex, primaryCard = null) {
  const primary = board?.[primaryIndex] || primaryCard;
  const column = primary?.data?.brick?.c;
  const row = primary?.data?.brick?.r;
  if (!Number.isFinite(column) || !Number.isFinite(row)) {
    const px = primary?.restX ?? primary?.sprite?.x;
    const py = primary?.restY ?? primary?.sprite?.y;
    if (!Number.isFinite(px) || !Number.isFinite(py)) return [];
    return board
      .map((card, index) => ({ card, index }))
      .filter(({ card, index }) => {
        const x = card?.restX ?? card?.sprite?.x;
        const y = card?.restY ?? card?.sprite?.y;
        return index !== primaryIndex && card?.revealed
          && (card.data?.type === 'enemy' || card.data?.type === 'boss')
          && (card.data?.health ?? 0) > 0 && Number.isFinite(x) && Number.isFinite(y)
          && y < py && Math.abs(x - px) <= 35;
      })
      .sort((a, b) => (b.card.restY ?? b.card.sprite?.y) - (a.card.restY ?? a.card.sprite?.y))
      .map(({ index }) => index);
  }

  return board
    .map((card, index) => ({ card, index }))
    .filter(({ card, index }) => (
      index !== primaryIndex
      && card?.revealed
      && (card.data?.type === 'enemy' || card.data?.type === 'boss')
      && (card.data?.health ?? 0) > 0
      // A large boss owns the whole far row, so a spear driven through a
      // summon reaches it regardless of which foreground column was chosen.
      && (card.data?.brick?.c === column || card.data?.alwaysBackline)
      // Larger r is closer to the player; piercing continues away from them.
      && card.data?.brick?.r < row
    ))
    .sort((a, b) => b.card.data.brick.r - a.card.data.brick.r)
    .map(({ index }) => index);
}

/** Revealed enemies immediately left and right of the selected board cell. */
export function swordCleaveTargetIndices(board, primaryIndex, primaryCard = null) {
  const primary = board?.[primaryIndex] || primaryCard;
  const column = primary?.data?.brick?.c;
  const row = primary?.data?.brick?.r;
  if (!Number.isFinite(column) || !Number.isFinite(row)) {
    return spatialCrossTargets(board, primaryIndex, primary, { horizontalOnly: true }).sides;
  }

  return board
    .map((card, index) => ({ card, index }))
    .filter(({ card, index }) => (
      index !== primaryIndex
      && card?.revealed
      && (card.data?.type === 'enemy' || card.data?.type === 'boss')
      && (card.data?.health ?? 0) > 0
      && !card.data?.alwaysBackline
      && card.data?.brick?.r === row
      && Math.abs(card.data?.brick?.c - column) === 1
    ))
    .sort((a, b) => a.card.data.brick.c - b.card.data.brick.c)
    .map(({ index }) => index);
}

/** Heavy Cleave geometry: a cross centred on the selected target. */
export function axeHeavyCleaveTargetIndices(board, primaryIndex, primaryCard = null) {
  const primary = board?.[primaryIndex] || primaryCard;
  const column = primary?.data?.brick?.c;
  const row = primary?.data?.brick?.r;
  if (!Number.isFinite(column) || !Number.isFinite(row)) {
    return spatialCrossTargets(board, primaryIndex, primary);
  }

  const enemies = board
    .map((card, index) => ({ card, index }))
    .filter(({ card, index }) => (
      index !== primaryIndex
      && card?.revealed
      && (card.data?.type === 'enemy' || card.data?.type === 'boss')
      && (card.data?.health ?? 0) > 0
      && !card.data?.alwaysBackline
    ));
  const vertical = enemies
    .filter(({ card }) => (
      card.data?.brick?.c === column
      && Math.abs(card.data?.brick?.r - row) === 1
    ))
    .sort((a, b) => a.card.data.brick.r - b.card.data.brick.r)
    .map(({ index }) => index);
  const sides = enemies
    .filter(({ card }) => (
      card.data?.brick?.r === row
      && Math.abs(card.data?.brick?.c - column) === 1
    ))
    .sort((a, b) => a.card.data.brick.c - b.card.data.brick.c)
    .map(({ index }) => index);
  return { vertical, sides };
}

function spatialCrossTargets(board, primaryIndex, primary, { horizontalOnly = false } = {}) {
  const px = primary?.restX ?? primary?.sprite?.x;
  const py = primary?.restY ?? primary?.sprite?.y;
  if (!Number.isFinite(px) || !Number.isFinite(py)) return { vertical: [], sides: [] };
  const enemies = board
    .map((card, index) => ({ card, index, x: card?.restX ?? card?.sprite?.x, y: card?.restY ?? card?.sprite?.y }))
    .filter(({ card, index, x, y }) => index !== primaryIndex && card?.revealed
      && (card.data?.type === 'enemy' || card.data?.type === 'boss')
      && !card.data?.alwaysBackline
      && (card.data?.health ?? 0) > 0 && Number.isFinite(x) && Number.isFinite(y));
  const nearest = (items, distance) => items.sort((a, b) => distance(a) - distance(b))[0]?.index;
  const left = nearest(enemies.filter(e => Math.abs(e.y - py) <= 20 && e.x < px), e => px - e.x);
  const right = nearest(enemies.filter(e => Math.abs(e.y - py) <= 20 && e.x > px), e => e.x - px);
  const sides = [left, right].filter(Number.isInteger);
  if (horizontalOnly) return { vertical: [], sides };
  const upper = nearest(enemies.filter(e => Math.abs(e.x - px) <= 35 && e.y < py), e => py - e.y);
  const lower = nearest(enemies.filter(e => Math.abs(e.x - px) <= 35 && e.y > py), e => e.y - py);
  return { vertical: [upper, lower].filter(Number.isInteger), sides };
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

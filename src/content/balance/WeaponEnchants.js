// Weapon enchants — a magic card fused into a weapon at the Reliquary.
//
// Design rule: the proc is a WEAKER, REPEATABLE version of the spell it came
// from. A one-shot magic card trades its magnitude for a chance to fire on
// every swing (Frost Ring freezes every enemy for 3 turns; the enchant freezes
// the struck enemy for 1). Never trade both.
//
// Proc chance is derived from the spell's own rarity, so these tables stay in
// sync with content/cards/magic.js on their own — add a spell there and it
// only needs a row in WEAPON_ENCHANTS to become enchantable.
import { getMagic } from '../cards/magic.js';

export const ENCHANT_CHANCE_BY_RARITY = Object.freeze({
  common: 0.25,
  uncommon: 0.20,
  rare: 0.15,
  legendary: 0.05,
});

// How often each rarity shows up in a Reliquary's three lit cases. Legendary
// is deliberately near-absent: a Reliquary offering Soul Drain should be a run
// the player remembers, not a Tuesday.
export const ENCHANT_OFFER_WEIGHT = Object.freeze({
  common: 30,
  uncommon: 24,
  rare: 10,
  legendary: 2,
});

// A fire GEM splashes 65px (BoardCombat.getFireSplashRadius). The Fireball
// enchant is a one-off event reward rather than something you can buy, so its
// splash reaches much further — and it stacks with a fire gem on the same
// weapon rather than replacing it.
export const ENCHANT_FIRE_SPLASH_RADIUS = 120;

// Splash damage is a fraction of the swing that triggered it, so the enchant
// keeps scaling with the weapon instead of going stale like a flat gem value.
export const ENCHANT_FIRE_SPLASH_FRACTION = 0.5;
export const ENCHANT_FIRE_SPLASH_MINIMUM = 3;

export const ENCHANT_HEAL_AMOUNT = 3;
export const ENCHANT_SHADOW_MULTIPLIER = 1.5;
export const ENCHANT_WEAKNESS_MULTIPLIER = 0.7;
export const ENCHANT_FREEZE_TURNS = 1;
export const ENCHANT_SHIELD_TURNS = 1;
export const ENCHANT_SHIELD_MULTIPLIER = 1.2;

// `timing` tells BoardCombat when the proc resolves:
//   preDamage — changes the swing itself (must land before damage is applied)
//   onHit     — fires on the struck enemy / the player, before damage lands so
//               a killing blow cannot swallow the effect (same reason gems do)
//   onKill    — only meaningful once the target is actually dead
export const WEAPON_ENCHANTS = Object.freeze({
  fireball: { title: 'Ember', summary: 'fire splash to nearby enemies', timing: 'onHit' },
  frostRing: { title: 'Frostbound', summary: 'freeze the enemy for 1 turn', timing: 'onHit' },
  restoration: { title: 'Mending', summary: `heal ${ENCHANT_HEAL_AMOUNT} HP on hit`, timing: 'onHit' },
  soulDrain: { title: 'Devouring', summary: 'slay a non-boss enemy outright', timing: 'preDamage' },
  shadowBlade: { title: 'Shadowed', summary: '+50% damage on the hit', timing: 'preDamage' },
  weakness: { title: 'Sapping', summary: 'the enemy deals 30% less damage', timing: 'onHit' },
  boneWall: { title: 'Bulwark', summary: 'reflect the next attack', timing: 'onHit' },
  magicShield: { title: 'Warding', summary: '+20% armor for 1 turn', timing: 'onHit' },
  smokeScreen: { title: 'Shrouding', summary: 'hide an enemy on a kill', timing: 'onKill' },
});

// Frame index of each spell's glowing card face in the `glowingMagicCards`
// sheet (one row of 52x70 frames), used by the Reliquary's display cases.
// Sheet order, left to right.
export const GLOW_CARD_FRAMES = Object.freeze({
  boneWall: 0,
  frostRing: 1,
  fireball: 3,
  soulDrain: 4,
  magicShield: 5,
  weakness: 6,
  shadowBlade: 7,
  smokeScreen: 8,
  restoration: 9,
});

export function getGlowCardFrame(magicType) {
  const frame = GLOW_CARD_FRAMES[magicType];
  return Number.isInteger(frame) ? frame : null;
}

export function getWeaponEnchant(magicType) {
  return WEAPON_ENCHANTS[magicType] || null;
}

export function getEnchantChance(magicType) {
  const rarity = getMagic(magicType)?.rarity;
  return ENCHANT_CHANCE_BY_RARITY[rarity] ?? 0.15;
}

/** Spells that may be offered at `floor`, honouring each spell's own minFloor. */
export function enchantableMagicTypes(floor = 1) {
  return Object.keys(WEAPON_ENCHANTS).filter((magicType) => {
    const magic = getMagic(magicType);
    return Boolean(magic) && (magic.minFloor || 1) <= floor;
  });
}

/**
 * Pick the spells lit up in one Reliquary: a weighted sample without
 * replacement, so the same wall never shows the same spell twice.
 */
export function rollEnchantOffer(floor = 1, count = 3) {
  const pool = enchantableMagicTypes(floor).map((magicType) => ({
    magicType,
    weight: ENCHANT_OFFER_WEIGHT[getMagic(magicType)?.rarity] ?? 10,
  }));

  const picked = [];
  while (picked.length < count && pool.length > 0) {
    const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * total;
    let index = pool.findIndex((entry) => (roll -= entry.weight) <= 0);
    if (index < 0) index = pool.length - 1;
    picked.push(pool[index].magicType);
    pool.splice(index, 1);
  }
  return picked;
}

/**
 * Fuse `magicType` into `weapon`, in place. One enchant per weapon — a weapon
 * that already carries one is refused so a second Reliquary cannot overwrite
 * the thing the player has been nursing since floor 4.
 */
export function applyEnchantToWeapon(weapon, magicType) {
  const enchant = getWeaponEnchant(magicType);
  if (!weapon || weapon.type !== 'weapon' || !enchant || weapon.enchant) return false;

  weapon.enchant = magicType;
  weapon.enchantChance = getEnchantChance(magicType);
  weapon.enchantTitle = enchant.title;
  // Keep the printed name so merging can rebuild "Frostbound <upgraded name>"
  // instead of stacking prefixes into "Frostbound Frostbound Axe".
  weapon.enchantBaseName = weapon.enchantBaseName || weapon.name || 'Weapon';
  weapon.name = `${enchant.title} ${weapon.enchantBaseName}`;
  // Marks it as a story item: protects it from the Screaming Head's maw and
  // from being picked as a throwaway sacrifice card.
  weapon.unique = true;
  return true;
}

/** Re-apply an enchant onto a freshly generated card (used when merging). */
export function carryEnchantToWeapon(weapon, magicType) {
  if (!weapon || !magicType) return false;
  weapon.enchant = null;
  weapon.enchantBaseName = weapon.name || 'Weapon';
  return applyEnchantToWeapon(weapon, magicType);
}

export function describeWeaponEnchant(weapon) {
  const enchant = getWeaponEnchant(weapon?.enchant);
  if (!enchant) return null;
  const chance = Number.isFinite(weapon.enchantChance)
    ? weapon.enchantChance
    : getEnchantChance(weapon.enchant);
  // "Warding 20%: +20% armor for 1 turn" — the proc chance stays attached to
  // the name so it never collides with a percentage inside the summary.
  return `${enchant.title} ${Math.round(chance * 100)}%: ${enchant.summary}`;
}

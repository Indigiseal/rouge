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
import { t } from '../../i18n/i18n.js';
import { VENOMOUS_BOMB_CHANCE } from '../combat/silkdeep.js';
import { SCORCHED_CHANCE } from '../combat/ashhowl.js';
import { SHOCK_CHANCE } from '../combat/storm.js';

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

// Enchants that are sigils (timing 'sigil'): SigilEffects rolls them at a
// fixed chance instead of the spell's rarity's. Fireball throws a fireball at
// another enemy; Sapping weakens the enemy hit for its next attack only.
export const ENCHANT_FIREBALL_CHANCE = 0.1;
export const ENCHANT_SAPPING_CHANCE = 0.2;
const SIGIL_ENCHANT_CHANCE = Object.freeze({ desertFeast: 0.1, fireball: ENCHANT_FIREBALL_CHANCE, weakness: ENCHANT_SAPPING_CHANCE, venomousBomb: VENOMOUS_BOMB_CHANCE, scorched: SCORCHED_CHANCE, thunderclap: SHOCK_CHANCE });

export const ENCHANT_HEAL_AMOUNT = 3;
export const ENCHANT_SHADOW_MULTIPLIER = 1.5;
export const ENCHANT_SAPPING_MULTIPLIER = 0.7; // its next attack, rounded down
export const ENCHANT_FREEZE_TURNS = 1;
export const ENCHANT_SHIELD_TURNS = 1;
export const ENCHANT_SHIELD_MULTIPLIER = 1.2;

// `timing` tells BoardCombat when the proc resolves:
//   preDamage — changes the swing itself (must land before damage is applied)
//   onHit     — fires on the struck enemy / the player, before damage lands so
//               a killing blow cannot swallow the effect (same reason gems do)
//   onKill    — only meaningful once the target is actually dead
export const WEAPON_ENCHANTS = Object.freeze({
  desertFeast: { title: 'Second Wind', titleKey: 'enchant.desertFeast.title', summary: 'restores 2 action points after a damaging hit', summaryKey: 'enchant.desertFeast.summary', timing: 'sigil' },
  thunderclap: { title: 'Shock', titleKey: 'enchant.thunderclap.title', summary: 'the struck enemy misses its next attack, including bosses', summaryKey: 'enchant.thunderclap.summary', timing: 'sigil' },
  scorched: { title: 'Scorched', titleKey: 'enchant.scorched.title', summary: 'adds 3 burn to every enemy, including hidden ones', summaryKey: 'enchant.scorched.summary', timing: 'sigil' },
  venomousBomb: { title: 'Venomous Bomb', titleKey: 'enchant.venomousBomb.title', summary: 'all revealed enemies take 3 poison damage for 3 turns', summaryKey: 'enchant.venomousBomb.summary', timing: 'sigil' },
  briarShield: { title: 'Briar Guard', titleKey: 'enchant.briarShield.title', summary: 'reflect the next enemy attack', summaryKey: 'enchant.briarShield.summary', timing: 'onHit' },
  fireball: { title: 'Fireball', titleKey: 'enchant.fireball.title', summary: 'throws a fireball at another random face-up enemy', summaryKey: 'enchant.fireball.summary', timing: 'sigil' },
  frostRing: { title: 'Frostbound', titleKey: 'enchant.frostRing.title', summary: 'freeze the enemy for 1 turn', summaryKey: 'enchant.frostRing.summary', timing: 'onHit' },
  restoration: { title: 'Renewal', titleKey: 'enchant.restoration.title', summary: `heal ${ENCHANT_HEAL_AMOUNT} HP on hit`, summaryKey: 'enchant.restoration.summary', timing: 'onHit' },
  soulDrain: { title: 'Devouring', titleKey: 'enchant.soulDrain.title', summary: 'slay a non-boss enemy outright', summaryKey: 'enchant.soulDrain.summary', timing: 'preDamage' },
  shadowBlade: { title: 'Shadowed', titleKey: 'enchant.shadowBlade.title', summary: '+50% damage on the hit', summaryKey: 'enchant.shadowBlade.summary', timing: 'preDamage' },
  weakness: { title: 'Sapping', titleKey: 'enchant.weakness.title', summary: 'the enemy hit deals 30% less on its next attack', summaryKey: 'enchant.weakness.summary', timing: 'sigil' },
  boneWall: { title: 'Bulwark', titleKey: 'enchant.boneWall.title', summary: 'block the next enemy attack', summaryKey: 'enchant.boneWall.summary', timing: 'onHit' },
  magicShield: { title: 'Warding', titleKey: 'enchant.magicShield.title', summary: '+20% armor for 1 turn', summaryKey: 'enchant.magicShield.summary', timing: 'onHit' },
  smokeScreen: { title: 'Ash Cloud', titleKey: 'enchant.smokeScreen.title', summary: 'hide an enemy on a kill', summaryKey: 'enchant.smokeScreen.summary', timing: 'onKill' },
});

// Frame index of each spell's card face in the `magicCards` sheet and in the `glowingMagicCards`
// sheet the Reliquary's display cases use. Both are 572x138: two rows of eleven 52x69 frames,
// laid out the same way, so one table serves both. Frame 2 is the original shield, kept
// unused; 16-18 are blank faces.
export const MAGIC_CARD_FRAMES = Object.freeze({
  boneWall: 0,
  frostRing: 1,
  fireball: 3,
  soulDrain: 4,
  magicShield: 5,
  weakness: 6,
  shadowBlade: 7,
  smokeScreen: 8,
  restoration: 9,
  desertFeast: 10,
  thunderclap: 11,
  scorched: 12,
  summonMimic: 13,
  venomousBomb: 14,
  briarShield: 15,
});
export const GLOW_CARD_FRAMES = MAGIC_CARD_FRAMES;

export function getGlowCardFrame(magicType) {
  const frame = GLOW_CARD_FRAMES[magicType];
  return Number.isInteger(frame) ? frame : null;
}

export function getMagicCardFrame(magicType) {
  const frame = MAGIC_CARD_FRAMES[magicType];
  return Number.isInteger(frame) ? frame : null;
}

export function getWeaponEnchant(magicType) {
  return WEAPON_ENCHANTS[magicType] || null;
}

export function getEnchantChance(magicType) {
  if (SIGIL_ENCHANT_CHANCE[magicType]) return SIGIL_ENCHANT_CHANCE[magicType];
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
export function rollEnchantOffer(floor = 1, count = 3, { ignoreMinFloor = false } = {}) {
  const pool = enchantableMagicTypes(ignoreMinFloor ? Infinity : floor).map((magicType) => ({
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
  weapon.enchantTitleKey = enchant.titleKey;
  // Keep the printed name so merging can rebuild "Frostbound <upgraded name>"
  // instead of stacking prefixes into "Frostbound Frostbound Axe".
  weapon.enchantBaseName = weapon.enchantBaseName || weapon.name || 'Weapon';
  weapon.name = `${enchant.title} ${weapon.enchantBaseName}`;
  // NOTE: deliberately does NOT set `unique`. That flag is what the Copying
  // Mirror checks (_isMirrorCopyable), so marking an enchanted weapon unique
  // made the mirror refuse it — you could not duplicate the best weapon in your
  // bag, which is precisely what players try to do with it. Protection from the
  // Screaming Head and the sacrifice picker is done by checking `enchant`
  // directly in EventRunHelpers instead.
  return true;
}

/** Re-apply an enchant onto a freshly generated card (used when merging). */
export function carryEnchantToWeapon(weapon, magicType) {
  if (!weapon || !magicType) return false;
  weapon.enchant = null;
  weapon.enchantBaseName = weapon.name || 'Weapon';
  return applyEnchantToWeapon(weapon, magicType);
}

/**
 * A weapon's proc chance: the one stored when it was fused, except the
 * sigil enchants, whose chance is fixed (weapons fused before kept the old one).
 */
export function enchantChanceOf(weapon) {
  if (SIGIL_ENCHANT_CHANCE[weapon?.enchant]) return SIGIL_ENCHANT_CHANCE[weapon.enchant];
  return Number.isFinite(weapon?.enchantChance)
    ? weapon.enchantChance
    : getEnchantChance(weapon?.enchant);
}

// Sigils whose rule is a Reliquary enchant's: stamped in a Sigil Room, they
// roll that spell's effect at that spell's chance, as the enchant would.
export const SIGIL_AS_ENCHANT = Object.freeze({ bulwark: 'boneWall', briarGuard: 'briarShield' });

export function describeWeaponEnchant(sceneOrWeapon, maybeWeapon) {
  const scene = maybeWeapon ? sceneOrWeapon : null;
  const weapon = maybeWeapon || sceneOrWeapon;
  const enchant = getWeaponEnchant(weapon?.enchant);
  if (!enchant) return null;
  const chance = enchantChanceOf(weapon);
  // "Warding 20%: +20% armor for 1 turn" — the proc chance stays attached to
  // the name so it never collides with a percentage inside the summary.
  const title = scene ? t(scene, enchant.titleKey) : enchant.title;
  const summary = scene ? t(scene, enchant.summaryKey) : enchant.summary;
  return `${title} ${Math.round(chance * 100)}%: ${summary}`;
}

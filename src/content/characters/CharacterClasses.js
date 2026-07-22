// Playable characters for a new run. Chosen once on New Game before floor 1.
// Starting weapons are type+rarity refs — cards come from createWeaponCardData.

import { createWeaponCardData } from '../cards/weapons.js';

export const CHARACTER_IDS = Object.freeze(['rogue', 'warrior']);

export const CHARACTER_CLASSES = Object.freeze({
  rogue: {
    id: 'rogue',
    name: 'Rogue',
    nameRu: 'Разбойник',
    blurb: 'Leather only. Starts with dagger and bow. Dagger and bow deal +10% damage (shown on the card).',
    blurbRu: 'Только кожаная броня. Старт: кинжал и лук. Кинжал и лук наносят +10% урона (цифра на карте уже с бонусом).',
    armorTypes: ['leather'],
    // Refs only — stats live in content/cards/weapons.js (spawn floors ignored).
    startingWeapons: Object.freeze([
      Object.freeze({ weaponType: 'dagger', rarity: 'common' }),
      Object.freeze({ weaponType: 'bow', rarity: 'common' }),
    ]),
    // Printed dagger/bow damage on cards uses getDisplayedWeaponDamage (base × 1.1, ceil).
    weaponDamageBonusTypes: ['dagger', 'bow'],
    weaponDamageBonus: 0.1,
    critChance: 0,
    critWeaponTypes: [],
  },
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    nameRu: 'Воин',
    blurb: 'No leather. Starts with two swords. Chain counters melee; plate ignores ranged. 10% crit on swords/axes.',
    blurbRu: 'Без кожи. Старт: два меча. Chain — контратака в ближнем; plate — ignore дальних. 10% крит мечи/топоры.',
    armorTypes: ['chain', 'plate'],
    startingWeapons: Object.freeze([
      Object.freeze({ weaponType: 'sword', rarity: 'common' }),
      Object.freeze({ weaponType: 'sword', rarity: 'common' }),
    ]),
    weaponDamageBonusTypes: [],
    weaponDamageBonus: 0,
    // Crit replaces the normal hit: damage = weapon * (1 + 0.05 * rarityTier).
    // rarityTier: common 1 / uncommon 2 / rare 3 / legendary 4 (epic counts as 3).
    critChance: 0.1,
    critWeaponTypes: ['sword', 'axe'],
  },
});

/** Build starter weapon cards from the weapon catalog (ignores spawn floors). */
export function buildStartingWeaponCards(characterId) {
  const refs = getCharacter(characterId).startingWeapons || [];
  return refs
    .map((ref) => createWeaponCardData(ref.weaponType, ref.rarity))
    .filter(Boolean)
    .map((card) => ({ ...card }));
}

const RARITY_CRIT_TIER = Object.freeze({
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 3,
  legendary: 4,
});

export function getCharacter(characterId) {
  return CHARACTER_CLASSES[characterId] || CHARACTER_CLASSES.rogue;
}

export function normalizeCharacterId(characterId) {
  return CHARACTER_CLASSES[characterId] ? characterId : 'rogue';
}

export function characterAllowsArmorType(characterId, armorType) {
  const allowed = getCharacter(characterId).armorTypes || [];
  return allowed.includes(armorType);
}

/**
 * Which armor families may spawn this run.
 * armorPoolOverride (sim): ['chain'] | ['plate'] | ['chain','plate'].
 * Otherwise uses the character's armorTypes.
 */
export function resolveArmorSpawnTypes(characterId, armorPoolOverride = null) {
  const classTypes = getCharacter(characterId).armorTypes || ['leather'];
  if (Array.isArray(armorPoolOverride) && armorPoolOverride.length) {
    return armorPoolOverride.filter((t) => classTypes.includes(t));
  }
  return classTypes.slice();
}

export function weaponHasClassDamageMark(characterId, weaponType) {
  const def = getCharacter(characterId);
  return (def.weaponDamageBonusTypes || []).includes(weaponType)
    && (def.weaponDamageBonus || 0) > 0;
}

/** Permanent % for class dagger/bow lane (class passive only). */
export function getClassWeaponDamageBonusPct(characterId, weapon, talentEffects = null) {
  if (!weapon) return 0;
  const def = getCharacter(characterId);
  if (!(def.weaponDamageBonusTypes || []).includes(weapon.weaponType)) return 0;
  return def.weaponDamageBonus || 0;
}

/**
 * Permanent hit damage for UI / combat before situational mods
 * (Keen Edge first-strike, First Blood, weakness, warrior crit).
 * Order: class % → Twin Fang %.
 */
export function applyPermanentWeaponDamageBonuses(characterId, weapon, damage, talentEffects = null) {
  if (!weapon || damage == null) return damage;
  let result = damage;
  const classPct = getClassWeaponDamageBonusPct(characterId, weapon, talentEffects);
  if (classPct > 0) result = Math.ceil(result * (1 + classPct));

  const twin = talentEffects?.twinFangPct || 0;
  if (twin > 0) {
    if (weapon.weaponType === 'dagger') {
      result = Math.ceil(result * (1 + twin));
    } else if (weapon.weaponType === 'bow') {
      result = Math.ceil(result * (1 + twin * 0.5));
    }
  }
  return result;
}

/**
 * Keen Edge: flat bonus on the first dagger/bow attack each floor.
 * Mutates gameState.keenEdgeUsedThisFloor when applied.
 */
export function applyKeenEdgeFirstStrike(characterId, weapon, damage, talentEffects, gameState) {
  if (!weapon || damage == null || !gameState) {
    return { damage, applied: false, bonus: 0 };
  }
  const bonus = talentEffects?.keenEdgeBonus || 0;
  if (bonus <= 0 || gameState.keenEdgeUsedThisFloor) {
    return { damage, applied: false, bonus: 0 };
  }
  const types = getCharacter(characterId).weaponDamageBonusTypes || [];
  if (!types.includes(weapon.weaponType)) {
    return { damage, applied: false, bonus: 0 };
  }
  gameState.keenEdgeUsedThisFloor = true;
  return { damage: damage + bonus, applied: true, bonus };
}

/** @deprecated Prefer applyPermanentWeaponDamageBonuses for full permanent stack. */
export function applyClassWeaponDamageBonus(characterId, weapon, damage, talentEffects = null) {
  if (!weapon || damage == null) return damage;
  const bonus = getClassWeaponDamageBonusPct(characterId, weapon, talentEffects);
  if (bonus <= 0) return damage;
  return Math.ceil(damage * (1 + bonus));
}

/** Number printed on weapon cards for this character (catalog base stays untouched). */
export function getDisplayedWeaponDamage(characterId, weapon, talentEffects = null) {
  if (!weapon) return 0;
  const base = Math.max(0, Number(weapon.damage) || 0);
  return applyPermanentWeaponDamageBonuses(characterId, weapon, base, talentEffects);
}

/**
 * Warrior crit roll. Returns { crit, damage } where damage is the hit to use
 * (crit multiplies printed weapon damage by 1 + 0.05 * rarityTier).
 */
export function rollClassWeaponCrit(characterId, weapon, baseDamage) {
  const def = getCharacter(characterId);
  if (!weapon || !(def.critChance > 0)) {
    return { crit: false, damage: baseDamage };
  }
  if (!(def.critWeaponTypes || []).includes(weapon.weaponType)) {
    return { crit: false, damage: baseDamage };
  }
  if (Math.random() >= def.critChance) {
    return { crit: false, damage: baseDamage };
  }
  const tier = RARITY_CRIT_TIER[weapon.rarity] || 1;
  const printed = Math.max(0, Number(weapon.damage) || 0);
  const critDamage = Math.ceil(printed * (1 + 0.05 * tier));
  return { crit: true, damage: critDamage };
}

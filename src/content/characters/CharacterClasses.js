// Playable characters for a new run. Chosen once on New Game before floor 1.
// Starting weapons are type+rarity refs — cards come from createWeaponCardData.

import { createWeaponCardData } from '../cards/weapons.js';

export const CHARACTER_IDS = Object.freeze(['rogue', 'warrior']);

export const CHARACTER_CLASSES = Object.freeze({
  rogue: {
    id: 'rogue',
    name: 'Rogue',
    nameRu: 'Разбойник',
    // Frame in the 'characterPortraits' sheet (assets/art/portraits.png).
    portraitFrame: 0,
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
    portraitFrame: 1,
    blurb: 'No leather. Starts with two swords. Two stances: Sweep (swords cleave) and Focus (20% crit for double damage, any weapon). Chain counters melee; plate ignores ranged.',
    blurbRu: 'Без кожи. Старт: два меча. Две стойки: Размах (меч рубит соседа) и Сосредоточение (20% крит в двойной урон, любым оружием). Chain — контратака в ближнем; plate — ignore дальних.',
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
    critWeaponTypes: ['sword', 'spear', 'axe', 'bow', 'dagger'],
  },
});

/** Build starter weapon cards from the weapon catalog (ignores spawn floors). */
export function buildStartingWeaponCards(characterId, { rarity } = {}) {
  const refs = getCharacter(characterId).startingWeapons || [];
  return refs
    .map((ref) => createWeaponCardData(ref.weaponType, rarity || ref.rarity))
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

  // Whole points, added. As a percentage this was invisible: ceil(5 * 1.03)
  // and ceil(5 * 1.12) are both 6, so every rank of the node produced exactly
  // the same damage on every weapon in the game.
  const twin = talentEffects?.twinFangFlat || 0;
  if (twin > 0) {
    if (weapon.weaponType === 'dagger') {
      result += twin;
    } else if (weapon.weaponType === 'bow') {
      result += Math.floor(twin / 2);
    }
  }

  // Heavy Edge is the warrior's mirror of Twin Fang, over his own weapons.
  const heavy = talentEffects?.heavyEdgeFlat || 0;
  if (heavy > 0 && (weapon.weaponType === 'sword'
    || weapon.weaponType === 'spear' || weapon.weaponType === 'axe')) {
    result += heavy;
  }

  // Village forge: flat on any weapon, printed on the card.
  const villageFlat = talentEffects?.villageWeaponFlat || 0;
  if (villageFlat > 0) result += villageFlat;
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
/**
 * Warrior stances.
 *
 * The warrior had no in-combat decision, and his two abilities each sat idle
 * half the time. Cleave is worth nothing against a lone boss — measured clear
 * F15 of 9.9% against the rogue's 21.2%, unmoved by armour or damage — while
 * the crit it displaced was worth about +2% expected damage against the rogue's
 * +29% class passive. Making them one switch turns two dead halves into a
 * choice: sweep a crowd, or focus the one thing in front of you.
 *
 * Switching costs AP, so the stance is a read of the board rather than a
 * free toggle flipped every swing.
 */
// The warrior's crit covers EVERY weapon type, not just sword/spear/axe.
// Measured cause: the frontline gate plus boss summons push both classes onto a
// bow for every act finale — the warrior entered the F15 boss with a bow 72% of
// the time. The rogue's passive covers bows, so his identity followed him there
// and the warrior's did not: 59.3 damage against 73.1 on the same AP, and clear
// F15 of 9.7% against 21.2%. Six fixes aimed at his weapons (cleave, stances,
// crit size, spear, early swords, armour type) all measured neutral, because
// they hung off weapons he was not holding when it mattered. Widening the crit
// closed it: 71.9 damage, 21.1% clear.
//
// His identity now lives in the STANCE rather than the weapon type, which is
// what stances were for.
export const WARRIOR_STANCES = Object.freeze({
  sweep: Object.freeze({
    id: 'sweep',
    name: 'Sweep',
    nameRu: 'Размах',
    cleave: true,
    critChance: 0,
    critMultiplier: 1,
  }),
  focus: Object.freeze({
    id: 'focus',
    name: 'Focus',
    nameRu: 'Сосредоточение',
    cleave: false,
    critChance: 0.2,
    critMultiplier: 2,
  }),
});

export const DEFAULT_WARRIOR_STANCE = 'sweep';
export const WARRIOR_STANCE_AP_COST = 1;

export function getWarriorStance(stanceId) {
  return WARRIOR_STANCES[stanceId] || WARRIOR_STANCES[DEFAULT_WARRIOR_STANCE];
}

/** Does this character/stance combination cleave with swords right now? */
export function stanceCleaves(characterId, stanceId) {
  if (characterId !== 'warrior') return false;
  return Boolean(getWarriorStance(stanceId).cleave);
}

export function rollClassWeaponCrit(characterId, weapon, baseDamage, stanceId = null) {
  const def = getCharacter(characterId);
  if (!weapon) return { crit: false, damage: baseDamage };
  if (!(def.critWeaponTypes || []).includes(weapon.weaponType)) {
    return { crit: false, damage: baseDamage };
  }
  const { chance, multiplier } = classCritProfile(characterId, weapon, stanceId);
  if (!(chance > 0)) return { crit: false, damage: baseDamage };
  if (Math.random() >= chance) {
    return { crit: false, damage: baseDamage };
  }
  const printed = Math.max(0, Number(weapon.damage) || 0);
  return { crit: true, damage: Math.ceil(printed * multiplier) };
}

/**
 * Crit chance and multiplier in one place so the combat roll and the bot's
 * expected-damage estimate cannot drift apart.
 */
export function classCritProfile(characterId, weapon, stanceId = null) {
  const def = getCharacter(characterId);
  if (!weapon || !(def.critWeaponTypes || []).includes(weapon.weaponType)) {
    return { chance: 0, multiplier: 1 };
  }
  if (characterId === 'warrior') {
    const stance = getWarriorStance(stanceId);
    return { chance: stance.critChance || 0, multiplier: stance.critMultiplier || 1 };
  }
  const tier = RARITY_CRIT_TIER[weapon.rarity] || 1;
  return { chance: def.critChance || 0, multiplier: 1 + 0.05 * tier };
}

// Playable characters for a new run. Chosen once on New Game before floor 1.

export const CHARACTER_IDS = Object.freeze(['rogue', 'warrior']);

export const CHARACTER_CLASSES = Object.freeze({
  rogue: {
    id: 'rogue',
    name: 'Rogue',
    nameRu: 'Разбойник',
    blurb: 'Leather only. Starts with dagger and bow. Dagger and bow deal +10% damage.',
    blurbRu: 'Только кожаная броня. Старт: кинжал и лук. Кинжал и лук наносят +10% урона.',
    armorTypes: ['leather'],
    startingWeapons: [
      {
        type: 'weapon',
        name: 'Common Dagger',
        weaponType: 'dagger',
        damage: 3,
        rarity: 'common',
        sprite: 'dagger_C',
        durability: 4,
        maxDurability: 4,
        special: 'dualWield',
        range: 'melee',
        gemSlots: 1,
      },
      {
        type: 'weapon',
        name: 'Common Bow',
        weaponType: 'bow',
        damage: 4,
        rarity: 'common',
        sprite: 'bow_c',
        durability: 5,
        maxDurability: 5,
        special: 'block',
        range: 'ranged',
        gemSlots: 1,
      },
    ],
    // Printed damage on dagger/bow shows "+*"; combat applies +10%.
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
    startingWeapons: [
      {
        type: 'weapon',
        name: 'Common Sword',
        weaponType: 'sword',
        damage: 5,
        rarity: 'common',
        sprite: 'sword_C',
        durability: 6,
        maxDurability: 6,
        special: null,
        range: 'melee',
        gemSlots: 1,
      },
      {
        type: 'weapon',
        name: 'Common Sword',
        weaponType: 'sword',
        damage: 5,
        rarity: 'common',
        sprite: 'sword_C',
        durability: 6,
        maxDurability: 6,
        special: null,
        range: 'melee',
        gemSlots: 1,
      },
    ],
    weaponDamageBonusTypes: [],
    weaponDamageBonus: 0,
    // Crit replaces the normal hit: damage = weapon * (1 + 0.05 * rarityTier).
    // rarityTier: common 1 / uncommon 2 / rare 3 / legendary 4 (epic counts as 3).
    critChance: 0.1,
    critWeaponTypes: ['sword', 'axe'],
  },
});

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

/** Apply rogue-style flat weapon-type bonus (ceil). */
export function applyClassWeaponDamageBonus(characterId, weapon, damage, talentEffects = null) {
  if (!weapon || damage == null) return damage;
  const def = getCharacter(characterId);
  let bonus = 0;
  if ((def.weaponDamageBonusTypes || []).includes(weapon.weaponType)) {
    bonus += def.weaponDamageBonus || 0;
  }
  // Keen Edge: extra % on the same weapon types as the class mark.
  if (
    talentEffects?.keenEdgePct > 0
    && (def.weaponDamageBonusTypes || []).includes(weapon.weaponType)
  ) {
    bonus += talentEffects.keenEdgePct;
  }
  if (bonus <= 0) return damage;
  return Math.ceil(damage * (1 + bonus));
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

// Character content pack — re-export class definitions and helpers.
export {
  CHARACTER_IDS,
  CHARACTER_CLASSES,
  getCharacter,
  normalizeCharacterId,
  characterAllowsArmorType,
  resolveArmorSpawnTypes,
  weaponHasClassDamageMark,
  getClassWeaponDamageBonusPct,
  applyClassWeaponDamageBonus,
  applyPermanentWeaponDamageBonuses,
  applyKeenEdgeFirstStrike,
  getDisplayedWeaponDamage,
  rollClassWeaponCrit,
} from './CharacterClasses.js';

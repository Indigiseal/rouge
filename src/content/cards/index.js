export { ENEMIES, SUMMON_ONLY_ENEMY_TYPES, getEnemy } from './enemies.js';
export { BOSSES, BOSS_TIERS, getBoss } from './bosses.js';
export {
  WEAPONS,
  WEAPON_SPAWN_MIN_FLOOR,
  WEAPON_DURABILITY_BY_TYPE,
  WEAPON_UNLOCKS,
  weaponDurability,
  getWeaponStats,
  weaponSpawnMinFloor,
  isWeaponSpawnableAtFloor,
  createWeaponCardData,
} from './weapons.js';
export {
  ARMORS,
  ARMOR_SPAWN_MIN_FLOOR,
  ARMOR_DURABILITY_BY_TYPE,
  ARMOR_UNLOCKS,
  armorDurability,
  getArmorStats,
  armorSpawnMinFloor,
  isArmorSpawnableAtFloor,
  createArmorCardData,
} from './armor.js';
export { TRAPS } from './traps.js';
export { POTIONS, potionNameForHealAmount } from './potions.js';
export { FOOD, foodNameForActionAmount } from './food.js';
export { MAGIC, getMagic } from './magic.js';
export { GEMS, GEM_SLOTS_BY_RARITY, gemSlotsForRarity } from './gems.js';
export { AMULETS, AMULET_DROP_DATA, getAmulet } from './amulets.js';
export { THORN_STATS_BY_RARITY, THORNS_SPRITE_BY_RARITY, getThornStats } from './thorns.js';

import { ENEMIES } from './enemies.js';
import { BOSSES } from './bosses.js';
import { WEAPONS } from './weapons.js';
import { ARMORS } from './armor.js';
import { AMULETS } from './amulets.js';
import { MAGIC } from './magic.js';
import { GEMS } from './gems.js';

/** By-id lookup maps for registry consumers. */
export const ENEMY_BY_ID = ENEMIES;
export const BOSS_BY_ID = BOSSES;
export const WEAPON_BY_ID = WEAPONS;
export const ARMOR_BY_ID = ARMORS;

export const AMULET_BY_ID = Object.fromEntries(
  AMULETS.map((a) => [a.id, a])
);

export const MAGIC_BY_ID = Object.fromEntries(
  MAGIC.map((m) => [m.magicType, m])
);

export const GEM_BY_EFFECT = Object.fromEntries(
  GEMS.map((g) => [g.effect, g])
);

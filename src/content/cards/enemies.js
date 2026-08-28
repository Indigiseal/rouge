import { resolveEnemyStats } from '../balance/EnemyPower.js';
import { THORNWAKE_ENEMY_DEFS } from '../months/thornwake/index.js';
import { SILKDEEP_ENEMY_DEFS } from '../months/silkdeep/index.js';
import { TOLLROAD_ENEMY_DEFS } from '../months/tollroad/index.js';

// Enemy catalog.
// - Month packs (band + archetype): content/months/<id>/enemies/
// - Legacy types keep per-type `tiers[]` (fallback when month has no roster).
// - HP/ATK for band types: resolveEnemyStats(floor, archetype). See docs/BALANCE.md.
// Month defs win over legacy on the same id (e.g. Silkdeep spider / Tollroad goblin).

/** Legacy global pool — used when the active month has enemies: null. */
export const LEGACY_ENEMIES = {
  skeleton: {
    name: 'Skeleton',
    sprite: 'skeleton_c',
    role: 'MELEE',
    minFloor: 1,
    tiers: [
      { minFloor: 1,  damage: 5,  health: 8  },
      { minFloor: 5,  damage: 7,  health: 11 },
      { minFloor: 10, damage: 8,  health: 12 },
      { minFloor: 15, damage: 8,  health: 14 },
      { minFloor: 16, damage: 8,  health: 17 },
      { minFloor: 31, damage: 11, health: 20 }
    ]
  },
  goblin: {
    name: 'Goblin',
    sprite: 'goblin_c',
    role: 'MELEE',
    minFloor: 4,
    tiers: [
      { minFloor: 4,  damage: 5,  health: 9  },
      { minFloor: 11, damage: 8,  health: 11 },
      { minFloor: 16, damage: 10, health: 17 },
      { minFloor: 20, damage: 10, health: 17 },
      { minFloor: 31, damage: 12, health: 20 }
    ],
    abilities: [{ type: 'coin_steal', chance: 0.5, amount: 1 }]
  },
  goblin_archer: {
    name: 'Goblin Archer',
    sprite: 'goblin_archer',
    role: 'RANGED',
    minFloor: 2,
    tiers: [
      { minFloor: 2,  damage: 3,  health: 5  },
      { minFloor: 7,  damage: 3,  health: 7  },
      { minFloor: 12, damage: 4,  health: 7  },
      { minFloor: 16, damage: 6,  health: 9  },
      { minFloor: 22, damage: 8,  health: 12 },
      { minFloor: 31, damage: 9,  health: 13 }
    ],
    abilities: []
  },
  skeleton_archer: {
    name: 'Skeleton Archer',
    sprite: 'skeleton_archer',
    role: 'RANGED',
    minFloor: 6,
    tiers: [
      { minFloor: 6,  damage: 3,  health: 5  },
      { minFloor: 11, damage: 4,  health: 7  },
      { minFloor: 16, damage: 6,  health: 10 },
      { minFloor: 17, damage: 6,  health: 10 },
      { minFloor: 25, damage: 8,  health: 12 },
      { minFloor: 31, damage: 9,  health: 13 }
    ],
    abilities: []
  },
  lostSoul: {
    name: 'Lost Soul',
    sprite: 'lostSoul',
    role: 'MELEE',
    minFloor: 16,
    tiers: [
      { minFloor: 16, damage: 7, health: 10 },
      { minFloor: 24, damage: 8, health: 12 },
      { minFloor: 31, damage: 11, health: 13 }
    ],
    abilities: [{ type: 'evade', chance: 0.3 }]
  },
  cerberusHead: {
    name: 'Cerberus Head',
    sprite: 'cerberusHead',
    role: 'MELEE',
    minFloor: 16,
    tiers: [
      { minFloor: 16, damage: 8, health: 11 },
      { minFloor: 31, damage: 10, health: 12 }
    ]
  }
};

export const ENEMIES = {
  ...LEGACY_ENEMIES,
  ...THORNWAKE_ENEMY_DEFS,
  ...SILKDEEP_ENEMY_DEFS,
  ...TOLLROAD_ENEMY_DEFS,
};

export const SUMMON_ONLY_ENEMY_TYPES = new Set(['cerberusHead']);

/** Types that use band×archetype instead of legacy tiers. */
export function usesBandStats(enemyOrType) {
  const enemy = typeof enemyOrType === 'string' ? ENEMIES[enemyOrType] : enemyOrType;
  return !!(enemy && enemy.archetype && !enemy.tiers);
}

export function getEnemy(id) {
  return ENEMIES[id] || null;
}

export function buildEnemyCardFromDef(enemyType, floor, isElite = false) {
  const enemy = ENEMIES[enemyType];
  if (!enemy) return null;

  let health;
  let attack;
  let bandId = null;

  if (usesBandStats(enemy)) {
    const resolved = resolveEnemyStats(floor, enemy.archetype);
    health = resolved.health;
    attack = resolved.attack;
    bandId = resolved.bandId;
  } else {
    let selectedTier = enemy.tiers[0];
    for (let i = enemy.tiers.length - 1; i >= 0; i--) {
      if (floor >= enemy.tiers[i].minFloor) {
        selectedTier = enemy.tiers[i];
        break;
      }
    }
    health = selectedTier.health;
    attack = selectedTier.damage;
  }

  const enemyCard = {
    type: 'enemy',
    enemyType,
    name: enemy.name,
    health,
    maxHealth: health,
    attack,
    sprite: enemy.sprite,
    role: enemy.role || 'MELEE',
    isRangedType: enemy.role === 'RANGED',
    archetype: enemy.archetype || null,
    bandId,
    placeholderArt: !!enemy.placeholderArt,
    features: enemy.features ? [...enemy.features] : undefined,
  };

  if (Number.isInteger(enemy.spriteFrame)) {
    enemyCard.spriteFrame = enemy.spriteFrame;
  }

  if (enemy.abilities) {
    enemyCard.abilities = [...enemy.abilities];
  }

  // isElite reserved for callers (elite mini-boss is applied in FloorSpawner).
  void isElite;
  return enemyCard;
}

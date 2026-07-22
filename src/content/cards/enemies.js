export const ENEMIES = {
  skeleton: {
    name: 'Skeleton',
    sprite: 'skeleton_c',
    role: 'MELEE',
    minFloor: 1,
    tiers: [
      // Act 1 softened for dagger+bow start (reach-F15 target ~50%).
      { minFloor: 1,  damage: 5,  health: 8  },
      { minFloor: 5,  damage: 7,  health: 11 },
      { minFloor: 10, damage: 8,  health: 12 },
      { minFloor: 15, damage: 8,  health: 14 },
      // Act 2: +20% HP vs F15 tier (steepen reach curve).
      { minFloor: 16, damage: 8,  health: 17 },
      { minFloor: 31, damage: 11, health: 20 }
    ]
  },
  spider: {
    name: 'Spider',
    sprite: 'spider_c',
    role: 'MELEE',
    minFloor: 3,
    tiers: [
      { minFloor: 3,  damage: 4,  health: 7  },
      { minFloor: 8,  damage: 5,  health: 9  },
      { minFloor: 13, damage: 5,  health: 9  },
      // Act 2+ tiers: +20% HP.
      { minFloor: 16, damage: 6,  health: 11 },
      { minFloor: 18, damage: 7,  health: 16 },
      { minFloor: 31, damage: 10, health: 18 }
    ],
    abilities: [{ type: 'poison', damage: 2, turns: 3, stackable: true }]
  },
  goblin: {
    name: 'Goblin',
    sprite: 'goblin_c',
    role: 'MELEE',
    minFloor: 4,
    tiers: [
      { minFloor: 4,  damage: 5,  health: 9  },
      { minFloor: 11, damage: 8,  health: 11 },
      // Act 2+ tiers: +20% HP.
      { minFloor: 16, damage: 10,  health: 17 },
      { minFloor: 20, damage: 10,  health: 17 },
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
      // Act 2+ tiers: +20% HP.
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
      // Act 2+ tiers: +20% HP.
      { minFloor: 16, damage: 6,  health: 10 },
      { minFloor: 17, damage: 6,  health: 10 },
      { minFloor: 25, damage: 8,  health: 12 },
      { minFloor: 31, damage: 9,  health: 13 }
    ],
    abilities: []
  },
  lostSoul: {
    // A shrouded, floating figure — the Soul Eater's lesser dead.
    // Its whole gimmick is the 'evade' ability: attacks (from the
    // player OR a companion) have a chance to phase right through it,
    // so it's kept deliberately low-HP to balance the dodging.
    // First appears in act 2 (the Soul Eater's act).
    name: 'Lost Soul',
    sprite: 'lostSoul',
    role: 'MELEE',
    minFloor: 16,
    tiers: [
      // Act 2 exclusive (+20% HP pass).
      { minFloor: 16, damage: 7, health: 10 },
      { minFloor: 24, damage: 8, health: 12 },
      { minFloor: 31, damage: 11, health: 13 }
    ],
    abilities: [{ type: 'evade', chance: 0.3 }]
  },
  cerberusHead: {
    // A disembodied Cerberus head, conjured mid-fight by Cerberus and
    // its ancient form — floats in and bites. Summoned minions get the
    // standard summon nerf (weaker than the tier below), so these are
    // light board pressure that splits the player's focus rather than
    // a heavy threat. Boss-summon EXCLUSIVE — unlike Lost Soul, this
    // never appears as a regular floor enemy; createEnemyCard's random
    // pool explicitly excludes it (see SUMMON_ONLY_ENEMY_TYPES).
    // Only reachable via createTieredEnemy('cerberusHead', ...), which
    // the boss's 'summon' ability calls directly.
    name: 'Cerberus Head',
    sprite: 'cerberusHead',
    role: 'MELEE',
    minFloor: 16,
    tiers: [
      // Boss-summon only; act 2 tier +20% HP.
      { minFloor: 16, damage: 8, health: 11 },
      { minFloor: 31, damage: 10, health: 12 }
    ]
  }
};

// Enemy types that only ever appear via a boss's 'summon' ability
// and must never be picked for a regular floor's random enemy roll.
export const SUMMON_ONLY_ENEMY_TYPES = new Set(['cerberusHead']);

export function getEnemy(id) {
  return ENEMIES[id] || null;
}

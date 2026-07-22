// Bosses trimmed -1 to -3 attack and ~10% HP across the board so the
// act gates feel hard but beatable. Cerberus took the biggest dmg cut
// (20→17) because its 20-attack spike was the single deadliest moment
// in the sim, far above the Lich at floor 25.
// Bosses are keyed by id and grouped into three tiers. Each act rolls ONE
// boss at random from its tier pool (tier 1 -> act 1 @ floor 15, tier 2 ->
// act 2 @ floor 30, tier 3 -> act 3 @ floor 45), so every run's finales vary.
// Stats are normalized within a tier so difficulty stays consistent no matter
// which boss is rolled. Poison is intentionally exclusive to the Spider Queen.
export const BOSSES = {
  // ---- Tier 1 (Act 1 finale, floor 15) ----
  giantSkeleton: {
    type: 'boss', tier: 1,
    name: 'Giant Skeleton',
    health: 66,
    attack: 10,
    armor: 2,
    sprite: 'giantSkeleton',
    abilities: [
      { type: 'summon', enemyType: 'skeleton', chance: 0.35, count: 1 }
    ]
  },
  goblinKing: {
    type: 'boss', tier: 1,
    name: 'Goblin King',
    health: 62,
    attack: 11,
    sprite: 'GoblinKingSprite',
    abilities: [
      { type: 'coin_steal', chance: 0.5, amount: 3 },
      { type: 'summon', enemyType: 'goblin', chance: 0.35, count: 1 }
    ]
  },
  spiderQueen: {
    type: 'boss', tier: 1,
    name: 'Spider Queen',
    health: 60,
    attack: 10,
    sprite: 'SpiderQween',
    abilities: [
      // Poison 3 -> 2 dmg: power-budget put her fight cost 43%
      // above the tier median — the DoT stacked on top of median
      // stats made her the unlucky roll of tier 1.
      { type: 'poison', damage: 2, turns: 3, stackable: true, maxStacks: 3 },
      { type: 'summon', enemyType: 'spider', chance: 0.35, count: 1 }
    ]
  },

  // ---- Tier 2 (Act 2 finale, floor 30) ----
  soulEater: {
    type: 'boss', tier: 2,
    name: 'Soul Eater',
    health: 120,
    attack: 15,
    sprite: 'SoulEater',
    // A slippery bruiser, NOT a healer (that's the Lich's profile).
    // Like the Lost Souls it commands, attacks have a 15% chance to
    // phase right through it — so it out-lasts you by dodging, not
    // by leeching. Rounds out with armor-break + a late rage spike.
    abilities: [
      { type: 'evade', chance: 0.12 },
      { type: 'summon', enemyType: 'lostSoul', chance: 0.15, count: 1 },
      { type: 'armor_break', amount: 2 },
      { type: 'rage', threshold: 0.35, damageBoost: 1.5 }
    ]
  },
  lich: {
    type: 'boss', tier: 2,
    name: 'Lich',
    // +20% HP vs prior 110 (act-2 boss HP pass).
    health: 132,
    attack: 15,
    sprite: 'Lich',
    abilities: [
      { type: 'lifesteal', percentage: 0.55 },
      { type: 'summon', enemyType: 'skeleton', chance: 0.22, count: 1 }
    ]
  },
  cerberus: {
    type: 'boss', tier: 2,
    name: 'Cerberus',
    // +20% HP vs prior 105 (act-2 boss HP pass).
    health: 126,
    attack: 15,
    sprite: 'Cerberus',
    abilities: [
      { type: 'rage', threshold: 0.4, damageBoost: 1.5 },
      { type: 'armor_break', amount: 4 },
      { type: 'summon', enemyType: 'cerberusHead', chance: 0.18, count: 1 }
    ]
  },

  // ---- Tier 3 (Act 3 finale, floor 45) ----
  ancientCerberus: {
    type: 'boss', tier: 3,
    name: 'Ancient Cerberus',
    health: 136,
    attack: 22,
    sprite: 'AncientCerberus',
    abilities: [
      { type: 'rage', threshold: 0.3, damageBoost: 2 },
      { type: 'armor_break', amount: 6 },
      { type: 'summon', enemyType: 'cerberusHead', chance: 0.3, count: 1 }
    ]
  }
};

// Which bosses can appear as each act's finale.
export const BOSS_TIERS = {
  1: ['giantSkeleton', 'goblinKing', 'spiderQueen'],
  2: ['soulEater', 'lich', 'cerberus'],
  3: ['ancientCerberus']
};

export function getBoss(id) {
  return BOSSES[id] || null;
}

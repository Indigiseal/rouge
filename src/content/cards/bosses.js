import { tuned } from '../balance/Tuning.js';

// Bosses trimmed -1 to -3 attack and ~10% HP across the board so the
// act gates feel hard but beatable. Cerberus took the biggest dmg cut
// (20→17) because its 20-attack spike was the single deadliest moment
// in the sim, far above the Lich at floor 25.
// Act gates. Each tier is tuned so the finale is the real wall of its act:
// with a full meta + amulet kit the gates kill roughly 39% / 28% / 22% of the
// players who reach them (F15 / F30 / F45). Tier 1 was raised x1.35 HP / +1 ATK
// when act-1 bands were recalibrated down; tiers 2-3 followed when depth-scaled
// gems and regen landed (see docs/BALANCE.md). Ancient Cerberus needed the most:
// at 136 HP it killed 1.2% of the players who reached it, making the finale the
// softest moment in the game.
// Bosses are keyed by id and grouped into three tiers. Each act rolls ONE
// boss at random from its tier pool (tier 1 -> act 1 @ floor 15, tier 2 ->
// act 2 @ floor 30, tier 3 -> act 3 @ floor 45), so every run's finales vary.
// Stats are normalized within a tier so difficulty stays consistent no matter
// which boss is rolled. Poison is intentionally exclusive to the Spider Queen.
export const BOSSES = {
  sandscaleChieftain: {
    type: 'boss', tier: 2, name: 'Sandscale Chieftain', health: 167, attack: 17,
    sprite: 'lizardBoss', sigils: [{ id: 'quickStrike' }, { id: 'daze' }],
    abilities: [{ type: 'summon', enemyType: 'lizardArcher', chance: 0.25, count: 1 }],
  },
  frostGiant: {
    type: 'boss', tier: 2, name: 'Frost Giant', health: 167, attack: 17,
    sprite: 'frostGiant', sigils: [{ id: 'frost' }, { id: 'shatter' }],
    abilities: [{ type: 'summon', enemyType: 'iceGolem', chance: 0.25, count: 1 }],
  },
  // Selected by Storm's location; keep legacy tier averages unchanged.
  tempestRoc: {
    type: 'boss', tier: 2, name: 'Storm Archon', health: 167, attack: 17,
    sprite: 'lightningBoss', spriteScale: 0.5, sigils: [{ id: 'shock' }],
    abilities: [{ type: 'summon', enemyType: 'lightningEye', chance: 0.25, count: 1 }],
  },
  // ---- Tier 1 (Act 1 finale, floor 15) ----
  giantSkeleton: {
    // Its own sigils (docs/SIGILS.md), on top of its abilities.
    sigils: [{ id: 'warding' }],
    type: 'boss', tier: 1,
    name: 'Giant Skeleton',
    health: 89,
    attack: 11,
    armor: 2,
    maxArmor: 2,
    sprite: 'giantSkeleton',
    abilities: [
      { type: 'summon', enemyType: 'skeleton', thresholds: [0.7, 0.35], count: 1 }
    ]
  },
  goblinKing: {
    // Tollroad: ambush, steal coins, and call ordinary goblins.
    sigils: [{ id: 'ambush' }],
    type: 'boss', tier: 1,
    name: 'Goblin King',
    health: 84,
    attack: 12,
    sprite: 'GoblinKingSprite',
    abilities: [
      { type: 'coin_steal', chance: 0.5, amount: 3 },
      { type: 'summon', enemyType: 'goblin', chance: 0.35, count: 1 }
    ]
  },
  greenWarden: {
    // Its own sigils (docs/SIGILS.md), on top of its abilities.
    sigils: [{ id: 'thorns' }],
    type: 'boss', tier: 1,
    name: 'The Green Warden',
    health: 86,
    attack: 11,
    sprite: 'greenWarden',
    abilities: [
      { type: 'summon', enemyType: 'wolf', chance: 0.35, count: 1 }
    ]
  },
  spiderQueen: {
    // Silkdeep: poison and spider summons. Ambush belongs to Tollroad.
    sigils: [],
    type: 'boss', tier: 1,
    name: 'Spider Queen',
    health: 81,
    attack: 11,
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
    // Its three abilities supply the Fleetfoot, Leech and Summon icons.
    sigils: [],
    type: 'boss', tier: 2,
    name: 'Soul Eater',
    health: 162,
    attack: 17,
    sprite: 'SoulEater',
    // Veilbleed: evade, drain actual damage, and call Lost Souls.
    abilities: [
      { type: 'evade', chance: 0.12 },
      { type: 'lifesteal', percentage: 0.15 },
      { type: 'summon', enemyType: 'lostSoul', chance: 0.15, count: 1 },
    ]
  },
  mireBride: {
    // Stable ID/art until the living Bog mermaid is drawn.
    sigils: [{ id: 'growth' }],
    growthPerAttack: 3,
    type: 'boss', tier: 2,
    name: 'Bog Mermaid',
    // Preserve the initial HP/ATK for testing the new healing/growth pairing.
    health: 158,
    attack: 16,
    sprite: 'MireBride',
    abilities: [
      // Healing minions fill the capacity earned by the mermaid's attacks.
      { type: 'summon', enemyType: 'drowned', chance: 0.25, count: 1 },
    ]
  },
  lich: {
    // Its own sigils (docs/SIGILS.md), on top of its abilities.
    sigils: [{ id: 'unscathed' }],
    type: 'boss', tier: 2,
    name: 'Lich',
    // +20% HP vs prior 110 (act-2 boss HP pass).
    health: 178,
    attack: 17,
    sprite: 'Lich',
    abilities: [
      { type: 'lifesteal', percentage: 0.2 },
      { type: 'summon', enemyType: 'skeleton', chance: 0.22, count: 1 }
    ]
  },
  cerberus: {
    // Its own sigils (docs/SIGILS.md), on top of its abilities.
    sigils: [{ id: 'scorched' }],
    type: 'boss', tier: 2,
    name: 'Cerberus',
    // +20% HP vs prior 105 (act-2 boss HP pass).
    health: 170,
    attack: 17,
    sprite: 'Cerberus',
    abilities: [
      { type: 'summon', enemyType: 'cerberusHead', chance: 0.18, count: 1 },
      // Frenzy (CombatTurnController): now and then all three heads bite, each
      // harder than the last. Shares of its attack: 17 → 5, 7, 9. Each bite is
      // its own hit, so it chews three armor pips (Taya).
      { type: 'frenzy', chance: 1 / 3, bites: [0.3, 0.4, 0.55] },
    ]
  },

  // ---- Tier 3 (Act 3 finale, floor 45) ----
  ancientCerberus: {
    // Its own sigils (docs/SIGILS.md), on top of its abilities.
    sigils: [{ id: 'scorched' }],
    type: 'boss', tier: 3,
    name: 'Ancient Cerberus',
    health: 272,
    attack: 28,
    sprite: 'AncientCerberus',
    abilities: [
      { type: 'summon', enemyType: 'cerberusHead', chance: 0.3, count: 1 },
      // The same frenzy, older and meaner: 28 → 8, 10, 12.
      { type: 'frenzy', chance: 1 / 3, bites: [0.29, 0.36, 0.43] },
    ]
  }
};

// Which bosses can appear as each act's finale.
export const BOSS_TIERS = {
  1: ['giantSkeleton', 'goblinKing', 'spiderQueen', 'greenWarden'],
  2: ['soulEater', 'lich', 'cerberus', 'mireBride'],
  3: ['ancientCerberus']
};

export function getBoss(id) {
  const boss = BOSSES[id];
  if (!boss) return boss;
  // Sweeps replace 'boss.<id>.health' / '.attack' instead of editing the table.
  const health = tuned(`boss.${id}.health`, boss.health);
  const attack = tuned(`boss.${id}.attack`, boss.attack);
  if (health === boss.health && attack === boss.attack) return boss;
  return { ...boss, health, attack };
}

// Preserve each boss's relative HP/attack against the existing act boss bands.
// These are initial scaling values for playtesting, not new ability multipliers:
// armor, status durations, summons and proc chances retain their own rules.
export function scaleBossForAct(boss, act) {
  if (!boss || boss.tier === act || !BOSS_TIERS[act]) return boss;
  const average = tier => {
    const entries = (BOSS_TIERS[tier] || []).map(id => BOSSES[id]).filter(Boolean);
    if (!entries.length) return null;
    return {
      health: entries.reduce((sum, item) => sum + item.health, 0) / entries.length,
      attack: entries.reduce((sum, item) => sum + item.attack, 0) / entries.length,
    };
  };
  const source = average(boss.tier), target = average(act);
  if (!source || !target) return boss;
  return {
    ...boss,
    tier: act,
    health: Math.max(1, Math.round(boss.health * target.health / source.health)),
    attack: Math.max(1, Math.round(boss.attack * target.attack / source.attack)),
  };
}


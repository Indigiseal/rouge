import { areAmuletsDisabled } from '../../config/TestOptions.js';

export function postBossWeaponFloor(floor) {
  return (floor >= 16 && floor <= 19) || (floor >= 31 && floor <= 34);
}

// Weight progression for the early/mid run. Later floors use calculateFormulaWeights.
// Act bosses are floors 15, 30, and 45.
export const FLOOR_WEIGHTS = {
  // Floors 1-4: Early game
  1: { enemy: 30, coin: 30, crystal: 5, trap: 5, weapon: 10, armor: 10, amulet: 2, potion: 8, food: 15, magic: 3, thorns: 2, key: 1 },
  2: { enemy: 35, coin: 25, crystal: 5, trap: 8, weapon: 10, armor: 10, amulet: 2, potion: 8, food: 15, magic: 3, thorns: 2, key: 1 },
  3: { enemy: 40, coin: 20, crystal: 8, trap: 10, weapon: 10, armor: 10, amulet: 3, potion: 10, food: 15, magic: 4, thorns: 2, key: 2 },
  4: { enemy: 40, coin: 20, crystal: 8, trap: 10, weapon: 10, armor: 10, amulet: 3, potion: 10, food: 12, magic: 4, thorns: 3, key: 2 },
  5: { enemy: 43, coin: 19, crystal: 9, trap: 11, weapon: 9, armor: 9, amulet: 4, potion: 10, food: 11, magic: 5, thorns: 3, key: 3 },

  // Floors 6-9
  6: { enemy: 45, coin: 18, crystal: 10, trap: 12, weapon: 8, armor: 8, amulet: 4, potion: 10, food: 10, magic: 5, thorns: 3, key: 3 },
  7: { enemy: 48, coin: 15, crystal: 10, trap: 14, weapon: 8, armor: 8, amulet: 5, potion: 10, food: 10, magic: 5, thorns: 3, key: 3 },
  8: { enemy: 50, coin: 15, crystal: 12, trap: 14, weapon: 7, armor: 7, amulet: 5, potion: 10, food: 10, magic: 6, thorns: 3, key: 3 },
  9: { enemy: 50, coin: 12, crystal: 12, trap: 15, weapon: 7, armor: 7, amulet: 5, potion: 10, food: 8, magic: 6, thorns: 3, key: 4 },
  10: { enemy: 51, coin: 12, crystal: 12, trap: 16, weapon: 7, armor: 7, amulet: 6, potion: 10, food: 8, magic: 7, thorns: 3, key: 4 },

  // Floors 11-14
  11: { enemy: 52, coin: 12, crystal: 12, trap: 16, weapon: 6, armor: 6, amulet: 6, potion: 10, food: 8, magic: 7, thorns: 3, key: 4 },
  12: { enemy: 55, coin: 10, crystal: 12, trap: 18, weapon: 6, armor: 6, amulet: 6, potion: 10, food: 8, magic: 7, thorns: 3, key: 4 },
  13: { enemy: 55, coin: 10, crystal: 14, trap: 18, weapon: 5, armor: 5, amulet: 7, potion: 10, food: 7, magic: 8, thorns: 3, key: 4 },
  14: { enemy: 58, coin: 8, crystal: 14, trap: 20, weapon: 5, armor: 5, amulet: 7, potion: 10, food: 7, magic: 8, thorns: 3, key: 5 },
  15: { boss: 100 }, // Spider Queen or Phantom Knight

  // Floors 16-19
  16: { enemy: 60, coin: 8, crystal: 15, trap: 22, weapon: 4, armor: 4, amulet: 8, potion: 10, food: 6, magic: 9, thorns: 3, key: 5 },
  17: { enemy: 62, coin: 6, crystal: 15, trap: 22, weapon: 4, armor: 4, amulet: 8, potion: 10, food: 6, magic: 9, thorns: 3, key: 5 },
  18: { enemy: 65, coin: 6, crystal: 15, trap: 24, weapon: 4, armor: 4, amulet: 9, potion: 10, food: 5, magic: 10, thorns: 3, key: 5 },
  19: { enemy: 65, coin: 5, crystal: 18, trap: 24, weapon: 3, armor: 3, amulet: 9, potion: 10, food: 5, magic: 10, thorns: 3, key: 6 },
  20: { enemy: 67, coin: 5, crystal: 18, trap: 25, weapon: 3, armor: 3, amulet: 10, potion: 10, food: 4, magic: 11, thorns: 3, key: 6 },

  // Floors 21-24
  21: { enemy: 68, coin: 5, crystal: 18, trap: 26, weapon: 3, armor: 3, amulet: 10, potion: 10, food: 4, magic: 11, thorns: 3, key: 6 },
  22: { enemy: 70, coin: 4, crystal: 18, trap: 28, weapon: 3, armor: 3, amulet: 10, potion: 10, food: 4, magic: 11, thorns: 3, key: 6 },
  23: { enemy: 70, coin: 4, crystal: 20, trap: 28, weapon: 2, armor: 2, amulet: 10, potion: 10, food: 3, magic: 12, thorns: 3, key: 6 },
  24: { enemy: 72, coin: 3, crystal: 20, trap: 30, weapon: 2, armor: 2, amulet: 11, potion: 10, food: 3, magic: 12, thorns: 3, key: 7 },
  25: { enemy: 74, coin: 3, crystal: 21, trap: 31, weapon: 2, armor: 2, amulet: 12, potion: 10, food: 2, magic: 13, thorns: 3, key: 8 },

  // Floors 26-29: End game
  26: { enemy: 75, coin: 2, crystal: 22, trap: 32, weapon: 2, armor: 2, amulet: 12, potion: 10, food: 2, magic: 13, thorns: 3, key: 8 },
  27: { enemy: 78, coin: 2, crystal: 22, trap: 32, weapon: 1, armor: 1, amulet: 12, potion: 10, food: 2, magic: 13, thorns: 3, key: 8 },
  28: { enemy: 80, coin: 2, crystal: 25, trap: 35, weapon: 1, armor: 1, amulet: 13, potion: 10, food: 1, magic: 14, thorns: 3, key: 8 },
  29: { enemy: 82, coin: 1, crystal: 25, trap: 35, weapon: 1, armor: 1, amulet: 14, potion: 10, food: 1, magic: 14, thorns: 3, key: 10 },
  30: { boss: 100 } // Act 2 boss
};

export function balanceCardWeights(weights, floor = 1) {
  if (weights.boss) return weights;

  const balanced = { ...weights };
  // All values below are REAL spawn numbers (rebalance "pure-runs-v1"):
  // no knob multipliers. Weapon supply is the main survival faucet for
  // the dagger+bow starting loadout, so its minimums are the first lever
  // to touch when moving the reach-F15 target.
  const weaponMinimum = floor >= 31 ? 12 : floor >= 16 ? 11 : 9;
  const weaponBoost = floor >= 31 ? 4 : floor >= 16 ? 3 : 1;
  // Post-boss recovery windows (F16-19, F31-34): fresh act weapons.
  const postBossMin = postBossWeaponFloor(floor) ? 2 : 0;
  const postBossBoost = postBossWeaponFloor(floor) ? 8 : 0;

  const enemyMultiplier = floor <= 14 ? 0.68 : floor <= 23 ? 0.78 : floor <= 30 ? 0.70 : 0.78;
  balanced.enemy = Math.max(20, Math.floor((balanced.enemy || 0) * enemyMultiplier));
  balanced.coin = Math.max(1, Math.floor((balanced.coin || 0) * 0.25));
  balanced.trap = Math.max(3, Math.floor((balanced.trap || 0) * 0.75));
  balanced.weapon = Math.max(
    weaponMinimum + postBossMin,
    Math.floor((balanced.weapon || 0) * 0.95) + weaponBoost + postBossBoost
  );
  balanced.armor = Math.max(
    floor >= 18 ? 12 : 10,
    Math.ceil((balanced.armor || 0) * 1.15)
  );
  // Amulets were flooding the late game (~22% of cards, 4-5 per floor),
  // which trivialized runs once you stacked a dozen+. Cut the weight hard
  // (~2-3% of cards) so floor drops are a rare bonus; amulets should
  // mostly come from curated events instead.
  balanced.amulet = Math.min(floor >= 15 ? 6 : 4, Math.max(1, Math.floor((balanced.amulet || 0) * 0.4)));
  if (areAmuletsDisabled()) balanced.amulet = 0;

  balanced.potion = Math.max(8, Math.floor((balanced.potion || 0) * 1.2));
  balanced.food = Math.max(19, Math.floor((balanced.food || 0) * 1.7));  // Bumped — players were starving for AP (~43% of actions while hungry); tuned for ~30% hunger
  balanced.magic = Math.max(5, Math.floor((balanced.magic || 0) * 1.25));
  balanced.thorns = Math.max(3, balanced.thorns || 0);
  balanced.crystal = Math.max(3, Math.floor((balanced.crystal || 0) * (floor >= 15 ? 0.5 : 0.8))); // Cut hard in late game
  // Socket gems begin late in act 1 and ramp through the acts without
  // flooding the three available weapon sockets.
  balanced.gem = floor < 12 ? 0
    : floor <= 15 ? 3
    : floor <= 30 ? 8
    : 10;
  balanced.key = Math.max(2, balanced.key || 0);
  balanced.mimic = Math.max(0, balanced.mimic || 0); // keep mimic chance from formula
  balanced.empty = floor <= 15 ? 0 : Math.max(12, balanced.empty || 0); // no empty cards in Act 1 (floors 1-15)
  return balanced;
}

export function calculateFormulaWeights(floor) {
  const bossFloors = [15, 30, 45];
  if (bossFloors.includes(floor)) {
    return { boss: 100 };
  }

  const weights = {
    enemy: Math.min(30 + floor * 2, 82),
    coin: Math.max(30 - floor, 2),
    crystal: Math.min(5 + Math.floor(floor * 0.4), 18), // Capped lower — was flooding later floors
    trap: Math.min(5 + floor, 35),
    weapon: Math.max(10 - Math.floor(floor / 4), 1),
    armor: Math.min(6 + Math.floor(floor / 3), 18),     // Grows with floor instead of shrinking
    amulet: Math.min(4 + Math.floor(floor * 0.8), 35),  // Grows faster as floors increase
    potion: 10,
    food: Math.max(12, 18 - Math.floor(floor / 3)),     // Decays slowly, floors at 12 minimum (10 left a third of all actions exhausted)
    magic: Math.min(3 + Math.floor(floor / 2), 15),
    gem: 9,
    key: Math.min(1 + Math.floor(floor / 4), 2),
    mimic: floor >= 3 ? 3 : 0  // rare treasure-trap, only from floor 3+
  };

  return weights;
}

export function getCardWeights(floor, floorWeights = FLOOR_WEIGHTS) {
  if (floorWeights[floor]) {
    return balanceCardWeights(floorWeights[floor], floor);
  }
  return balanceCardWeights(calculateFormulaWeights(floor), floor);
}

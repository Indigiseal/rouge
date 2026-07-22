// Healing Potions. Shop price lives in content/economy/shop.js — not here.
export const POTIONS = [
  {
    tier: 1,
    name: 'Minor Healing Potion',
    healAmount: 35,
    minFloor: 1,
    sprite: 'potionCardCommon',
    rarity: 'common'
  },
  {
    tier: 2,
    name: 'Healing Potion',
    healAmount: 70,
    minFloor: 5,
    sprite: 'potionCardCommon',
    rarity: 'common'
  },
  {
    tier: 3,
    name: 'Strong Healing Potion',
    healAmount: 110,
    minFloor: 10,
    sprite: 'potionCardUncommon',
    rarity: 'uncommon'
  },
  {
    tier: 4,
    name: 'Greater Healing Potion',
    healAmount: 200,
    minFloor: 15,
    sprite: 'potionCardUncommon',
    rarity: 'uncommon'
  }
];

/** Resolve display name from heal amount using the potion catalog. */
export function potionNameForHealAmount(healAmount = 0) {
  let best = POTIONS[0];
  for (const p of POTIONS) {
    if (healAmount >= p.healAmount) best = p;
  }
  // Exact match preferred; otherwise nearest tier at or below amount.
  const exact = POTIONS.find((p) => p.healAmount === healAmount);
  return (exact || best)?.name || 'Minor Healing Potion';
}

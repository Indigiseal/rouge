// Healing Potions. Shop price lives in content/economy/shop.js — not here.
//
// Exactly three tiers, one per card png, climbed by merging: two commons make
// the uncommon, two uncommons make the rare. That is four commons (140 healing)
// for a 200-heal rare, so merging pays a deliberate bonus. Only tier 1 ever
// drops or is sold — every stronger potion is merged for.
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
    sprite: 'potionCardUncommon',
    rarity: 'uncommon'
  },
  {
    tier: 3,
    name: 'Greater Healing Potion',
    healAmount: 200,
    minFloor: 15,
    sprite: 'potionCardRare',
    rarity: 'rare'
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

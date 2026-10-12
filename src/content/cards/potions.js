import { resourceCardKey } from '../assets/resourceCards.js';

// Healing Potions. Shop price lives in content/economy/shop.js — not here.
//
// Exactly three tiers, one per card png, climbed by merging: two commons make
// the uncommon, two uncommons make the rare. That is four commons (140 healing)
// for a 200-heal rare, so merging pays a deliberate bonus. Only tier 1 ever
// drops on the board; the regular shop sells two tiers (shopPotionCards).
export const POTIONS = [
  {
    tier: 1,
    name: 'Minor Healing Potion',
    healAmount: 35,
    minFloor: 1,
    sprite: resourceCardKey('potion', 'common'),
    rarity: 'common'
  },
  {
    tier: 2,
    name: 'Healing Potion',
    healAmount: 70,
    minFloor: 5,
    sprite: resourceCardKey('potion', 'uncommon'),
    rarity: 'uncommon'
  },
  {
    tier: 3,
    name: 'Greater Healing Potion',
    healAmount: 200,
    minFloor: 15,
    sprite: resourceCardKey('potion', 'rare'),
    rarity: 'rare'
  }
];

// The regular shop's two potions: a cheaper one and a better one, a tier
// apart. Act 1 (floors 1-15) sells Minor and Healing; from act 2 on, Healing
// and Greater, so the full heal only reaches the shelf once floors hit hard.
// It used to sell one Minor potion on every floor — a 35 heal for 65 coins on
// floor 30, which read as the shop selling no healing at all.
const SHOP_POTION_TIERS_BY_ACT = Object.freeze([
  Object.freeze([1, 2]),
  Object.freeze([2, 3]),
]);

/** A potion card's data for a catalog tier (1-3). */
export function potionCardForTier(tier) {
  const p = POTIONS.find((entry) => entry.tier === tier) || POTIONS[0];
  return {
    type: 'potion',
    name: p.name,
    healAmount: p.healAmount,
    sprite: p.sprite,
    rarity: p.rarity,
  };
}

/** The two potion cards the regular shop stocks on `floor`, cheaper first. */
export function shopPotionCards(floor = 1) {
  const act = Math.max(0, Math.floor((Math.max(1, floor) - 1) / 15));
  const tiers = SHOP_POTION_TIERS_BY_ACT[Math.min(act, SHOP_POTION_TIERS_BY_ACT.length - 1)];
  return tiers.map(potionCardForTier);
}

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

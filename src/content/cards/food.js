// Food (Energy = Actions). Shop price lives in content/economy/shop.js — not here.
//
// Three tiers, one per card face on the resource sheet, climbed by merging —
// the same shape as the potion ladder. There used to be a fourth (Hearty Meal)
// and all four drew the same 'bread' art, so merging produced a card identical
// to its inputs.
//
// Each name is what its card face shows: berries, a loaf, a steak. The tiers
// were once Bread / Rations / Feast, a step off the art, so eating the berries
// was logged as Bread.
import { resourceCardKey } from '../assets/resourceCards.js';

export const FOOD = [
  {
    tier: 1,
    name: 'Berries',
    actionAmount: 10,
    minFloor: 1,
    sprite: resourceCardKey('food', 'common'),
    rarity: 'common'
  },
  {
    tier: 2,
    name: 'Bread',
    actionAmount: 15,
    minFloor: 3,
    sprite: resourceCardKey('food', 'uncommon'),
    rarity: 'uncommon'
  },
  {
    tier: 3,
    name: 'Steak',
    actionAmount: 25,
    minFloor: 8,
    sprite: resourceCardKey('food', 'rare'),
    rarity: 'rare'
  }
];

/** Resolve display name from action amount using the food catalog. */
export function foodNameForActionAmount(actionAmount = 0) {
  let best = FOOD[0];
  for (const f of FOOD) {
    if (actionAmount >= f.actionAmount) best = f;
  }
  const exact = FOOD.find((f) => f.actionAmount === actionAmount);
  return (exact || best)?.name || 'Berries';
}

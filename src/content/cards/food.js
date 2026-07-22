// Food (Energy = Actions). Shop price lives in content/economy/shop.js — not here.
export const FOOD = [
  {
    tier: 1,
    name: 'Bread',
    actionAmount: 25,
    minFloor: 1,
    sprite: 'bread',
    rarity: 'common'
  },
  {
    tier: 2,
    name: 'Rations',
    actionAmount: 30,
    minFloor: 3,
    sprite: 'bread',
    rarity: 'common'
  },
  {
    tier: 3,
    name: 'Hearty Meal',
    actionAmount: 35,
    minFloor: 6,
    sprite: 'bread',
    rarity: 'uncommon'
  },
  {
    tier: 4,
    name: 'Feast',
    actionAmount: 40,
    minFloor: 8,
    sprite: 'bread',
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
  return (exact || best)?.name || 'Bread';
}

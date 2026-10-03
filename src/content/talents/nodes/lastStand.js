export default {
    id: 'lastStand',
    characterId: 'warrior',
    branchId: 'iron',
    name: "Last Stand",
    maxRank: 5,
    descriptionRanks: [
      'Survive a lethal hit at 7% max HP, once per run.',
      'Survive a lethal hit at 9% max HP, once per run.',
      'Survive a lethal hit at 11% max HP, once per run.',
      'Survive a lethal hit at 13% max HP, once per run.',
      'Survive a lethal hit at 15% max HP, once per run.',
    ],
    values: [
      { charges: 1, heal: 0.07 },
      { charges: 1, heal: 0.09 },
      { charges: 1, heal: 0.11 },
      { charges: 1, heal: 0.13 },
      { charges: 1, heal: 0.15 },
    ],
  };

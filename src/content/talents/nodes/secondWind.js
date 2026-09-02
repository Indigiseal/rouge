export default {
    id: 'secondWind',
    characterId: 'rogue',
    branchId: 'shadow',
    name: 'Second Wind',
    maxRank: 5,
    descriptionRanks: [
      'Survive a lethal hit at 6.5% max HP, once per run.',
      'Survive a lethal hit at 8.5% max HP, once per run.',
      'Survive a lethal hit at 10.4% max HP, once per run.',
      'Survive a lethal hit at 12.4% max HP, once per run.',
      'Survive a lethal hit at 14.3% max HP, once per run.',
    ],
    values: [
      { charges: 1, heal: 0.065 },
      { charges: 1, heal: 0.085 },
      { charges: 1, heal: 0.104 },
      { charges: 1, heal: 0.124 },
      { charges: 1, heal: 0.143 },
    ],
  };

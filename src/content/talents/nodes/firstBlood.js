export default {
    id: 'firstBlood',
    characterId: 'rogue',
    branchId: 'shadow',
    name: 'First Blood',
    maxRank: 5,
    descriptionRanks: [
      'First attack each floor: +1 damage per 12 floors cleared, up to +2.',
      'First attack each floor: +1 damage per 9 floors cleared, up to +3.',
      'First attack each floor: +1 damage per 7 floors cleared, up to +5.',
      'First attack each floor: +1 damage per 5 floors cleared, up to +6.',
      'First attack each floor: +1 damage per 4 floors cleared, up to +8.',
    ],
    values: [
      { perFloors: 12, cap: 2 },
      { perFloors: 9, cap: 3 },
      { perFloors: 7, cap: 5 },
      { perFloors: 5, cap: 6 },
      { perFloors: 4, cap: 8 },
    ],
  };

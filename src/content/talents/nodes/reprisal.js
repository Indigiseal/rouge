export default {
    id: 'reprisal',
    characterId: 'warrior',
    branchId: 'iron',
    name: "Reprisal",
    maxRank: 5,
    descriptionRanks: [
      'When DEF absorbs a hit, reflect +1 damage per 16 floors cleared, up to 2.',
      'When DEF absorbs a hit, reflect +1 damage per 12 floors cleared, up to 3.',
      'When DEF absorbs a hit, reflect +1 damage per 9 floors cleared, up to 4.',
      'When DEF absorbs a hit, reflect +1 damage per 7 floors cleared, up to 6.',
      'When DEF absorbs a hit, reflect +1 damage per 5 floors cleared, up to 8.',
    ],
    values: [
      { perFloors: 16, cap: 2 },
      { perFloors: 12, cap: 3 },
      { perFloors: 9, cap: 4 },
      { perFloors: 7, cap: 6 },
      { perFloors: 5, cap: 8 },
    ],
  };

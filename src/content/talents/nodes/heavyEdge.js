export default {
    id: 'heavyEdge',
    characterId: 'warrior',
    branchId: 'iron',
    name: "Heavy Edge",
    maxRank: 5,
    descriptionRanks: [
      'Sword, spear and axe hits: +1 damage per 25 floors cleared, up to +1.',
      'Sword, spear and axe hits: +1 damage per 18 floors cleared, up to +1.',
      'Sword, spear and axe hits: +1 damage per 14 floors cleared, up to +2.',
      'Sword, spear and axe hits: +1 damage per 11 floors cleared, up to +2.',
      'Sword, spear and axe hits: +1 damage per 8 floors cleared, up to +3.',
    ],
    values: [
      { perFloors: 25, cap: 1 },
      { perFloors: 18, cap: 1 },
      { perFloors: 14, cap: 2 },
      { perFloors: 11, cap: 2 },
      { perFloors: 8, cap: 3 },
    ],
  };

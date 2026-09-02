export default {
    id: 'hardened',
    characterId: 'warrior',
    branchId: 'iron',
    name: "Hardened",
    maxRank: 5,
    descriptionRanks: [
      'Chain and plate: +1 DEF per 14 floors cleared, up to +1.',
      'Chain and plate: +1 DEF per 10 floors cleared, up to +2.',
      'Chain and plate: +1 DEF per 8 floors cleared, up to +2.',
      'Chain and plate: +1 DEF per 6 floors cleared, up to +3.',
      'Chain and plate: +1 DEF per 5 floors cleared, up to +3.',
    ],
    values: [
      { perFloors: 14, cap: 1 },
      { perFloors: 10, cap: 2 },
      { perFloors: 8, cap: 2 },
      { perFloors: 6, cap: 3 },
      { perFloors: 5, cap: 3 },
    ],
  };

export default {
    id: 'keenEdge',
    characterId: 'rogue',
    branchId: 'shadow',
    name: 'Keen Edge',
    maxRank: 5,
    descriptionRanks: [
      'First dagger or bow attack each floor: +1 to +1.65 damage (+1 more per 30 floors cleared).',
      'First dagger or bow attack each floor: +1 to +2 damage (+1 more per 18 floors cleared).',
      'First dagger or bow attack each floor: +1 to +2 damage (+1 more per 16 floors cleared).',
      'First dagger or bow attack each floor: +1 to +3 damage (+1 more per 12 floors cleared).',
      'First dagger or bow attack each floor: +2 to +4 damage (+1 more per 10 floors cleared).',
    ],
    values: [
      { base: 1, perFloors: 30, cap: 0.65 },
      { base: 1, perFloors: 18, cap: 1 },
      { base: 1, perFloors: 16, cap: 1 },
      { base: 1, perFloors: 12, cap: 2 },
      { base: 2, perFloors: 10, cap: 2 },
    ],
  };

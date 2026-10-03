export default {
    id: 'twinFang',
    characterId: 'rogue',
    branchId: 'shadow',
    name: 'Twin Fang',
    maxRank: 5,
    descriptionRanks: [
      'Dagger hits: +1 damage per 25 floors cleared, up to +0.65 (bows half).',
      'Dagger hits: +1 damage per 18 floors cleared, up to +0.65 (bows half).',
      'Dagger hits: +1 damage per 14 floors cleared, up to +1 (bows half).',
      'Dagger hits: +1 damage per 11 floors cleared, up to +2 (bows half).',
      'Dagger hits: +1 damage per 8 floors cleared, up to +2 (bows half).',
    ],
    values: [
      { perFloors: 25, cap: 0.65 },
      { perFloors: 18, cap: 0.65 },
      { perFloors: 14, cap: 1 },
      { perFloors: 11, cap: 2 },
      { perFloors: 8, cap: 2 },
    ],
  };

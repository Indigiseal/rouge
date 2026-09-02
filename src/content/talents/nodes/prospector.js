export default {
    id: 'prospector',
    characterId: 'rogue',
    branchId: 'shadow',
    name: "Prospector",
    maxRank: 5,
    descriptionRanks: [
      '+1 crystal per 9 floors cleared, up to +3 per run.',
      '+1 crystal per 7 floors cleared, up to +4 per run.',
      '+1 crystal per 5 floors cleared, up to +6 per run.',
      '+1 crystal per 4 floors cleared, up to +8 per run.',
      '+1 crystal per 3 floors cleared, up to +10 per run.',
    ],
    values: [
      { perFloors: 9, cap: 3 },
      { perFloors: 7, cap: 4 },
      { perFloors: 5, cap: 6 },
      { perFloors: 4, cap: 8 },
      { perFloors: 3, cap: 10 },
    ],
  };

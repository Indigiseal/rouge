export default {
    id: 'shadowStep',
    characterId: 'rogue',
    branchId: 'shadow',
    name: 'Shadow Step',
    maxRank: 5,
    descriptionRanks: [
      'Dodge: +0.2% per floor cleared, up to 3.2%.',
      'Dodge: +0.3% per floor cleared, up to 5.2%.',
      'Dodge: +0.4% per floor cleared, up to 7.8%.',
      'Dodge: +0.6% per floor cleared, up to 10.4%.',
      'Dodge: +0.8% per floor cleared, up to 13%.',
    ],
    values: [
      { perFloor: 0.002, cap: 0.0325 },
      { perFloor: 0.0032, cap: 0.052 },
      { perFloor: 0.0045, cap: 0.078 },
      { perFloor: 0.006, cap: 0.104 },
      { perFloor: 0.0075, cap: 0.13 },
    ],
  };

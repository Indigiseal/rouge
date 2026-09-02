export default {
    id: 'grindstone',
    characterId: 'warrior',
    branchId: 'iron',
    name: "Grindstone",
    maxRank: 5,
    descriptionRanks: [
      'Weapon hits: 0.3% chance per floor cleared to spend no durability, up to 7%.',
      'Weapon hits: 0.5% chance per floor cleared to spend no durability, up to 11%.',
      'Weapon hits: 0.7% chance per floor cleared to spend no durability, up to 16%.',
      'Weapon hits: 0.9% chance per floor cleared to spend no durability, up to 21%.',
      'Weapon hits: 1.1% chance per floor cleared to spend no durability, up to 26%.',
    ],
    values: [
      { perFloor: 0.003, cap: 0.07 },
      { perFloor: 0.005, cap: 0.11 },
      { perFloor: 0.007, cap: 0.16 },
      { perFloor: 0.009, cap: 0.21 },
      { perFloor: 0.011, cap: 0.26 },
    ],
  };

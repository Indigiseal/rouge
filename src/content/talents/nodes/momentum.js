export default {
    id: 'momentum',
    characterId: 'rogue',
    branchId: 'shadow',
    name: 'Whetstone',
    maxRank: 5,
    descriptionRanks: [
      'Weapon hits: 0.4% chance per floor cleared to spend no durability, up to 6.5%.',
      'Weapon hits: 0.6% chance per floor cleared to spend no durability, up to 10.4%.',
      'Weapon hits: 0.9% chance per floor cleared to spend no durability, up to 15.6%.',
      'Weapon hits: 1.2% chance per floor cleared to spend no durability, up to 20.8%.',
      'Weapon hits: 1.5% chance per floor cleared to spend no durability, up to 26%.',
    ],
    values: [
      { perFloor: 0.004, cap: 0.065 },
      { perFloor: 0.006, cap: 0.104 },
      { perFloor: 0.009, cap: 0.156 },
      { perFloor: 0.012, cap: 0.208 },
      { perFloor: 0.015, cap: 0.26 },
    ],
  };

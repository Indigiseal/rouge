export default {
    id: 'ironHide',
    characterId: 'warrior',
    branchId: 'iron',
    name: "Iron Hide",
    maxRank: 5,
    descriptionRanks: [
      '+1 max HP per 3 floors cleared, up to +5 HP.',
      '+1 max HP per 2 floors cleared, up to +9 HP.',
      '+1 max HP per 2 floors cleared, up to +13 HP.',
      '+1 max HP per 1 floor cleared, up to +19 HP.',
      '+1 max HP per 1 floor cleared, up to +26 HP.',
    ],
    values: [
      { perFloors: 3, cap: 5 },
      { perFloors: 2, cap: 9 },
      { perFloors: 2, cap: 13 },
      { perFloors: 1, cap: 19 },
      { perFloors: 1, cap: 26 },
    ],
  };

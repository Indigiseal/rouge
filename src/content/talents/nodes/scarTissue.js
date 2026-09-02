export default {
    id: 'scarTissue',
    characterId: 'rogue',
    branchId: 'shadow',
    name: 'Scar Tissue',
    maxRank: 5,
    descriptionRanks: [
      '+1 max HP per 3 floors cleared, up to +5 HP.',
      '+1 max HP per 2 floors cleared, up to +9 HP.',
      '+1 max HP per 2 floors cleared, up to +13 HP.',
      '+1 max HP per 1 floor cleared, up to +20 HP.',
      '+1 max HP per 1 floor cleared, up to +26 HP.',
    ],
    values: [
      { perFloors: 3, cap: 5 },
      { perFloors: 2, cap: 9 },
      { perFloors: 2, cap: 13 },
      { perFloors: 1, cap: 20 },
      { perFloors: 1, cap: 26 },
    ],
  };

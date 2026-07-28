// Weapon socket capacity by rarity. Merges (including mirror copies) can grow
// a same-type gem stack up to the resulting weapon's rarity limit.
export const GEM_SLOTS_BY_RARITY = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5
};

export const GEMS = [
  { effect: 'fire', name: 'Fire Gem', frame: 0, color: 0xff7040 },
  { effect: 'poison', name: 'Poison Gem', frame: 6, color: 0x66ff66 },
  { effect: 'lightning', name: 'Lightning Gem', frame: 12, color: 0xffe066 }
];

export function gemSlotsForRarity(rarity) {
  return GEM_SLOTS_BY_RARITY[rarity] || 1;
}

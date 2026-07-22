// Amulet rarity is rolled FIRST by source, then the player picks 1 of 3
// amulets of that rarity. Weights are relative (need not sum to 100).
export const AMULET_RARITY_RATES = {
  floor:     { common: 50, uncommon: 30, rare: 20 },
  shop:      { common: 50, uncommon: 30, rare: 20 },
  rare_shop: { uncommon: 25, rare: 60, legendary: 15 },
  // Boss: rare or legendary (boss ignores minFloor so act-1 boss can roll rare).
  boss:      { rare: 30, legendary: 70 },
};

// Earliest floor a source may sell/offer amulets (floor/boss have no gate).
export const AMULET_SOURCE_MIN_FLOOR = {
  shop: 5,
  rare_shop: 20,
};

// When an upgrade is owned, its weaker forms are excluded from offers.
export const AMULET_UPGRADE_REPLACES = {
  amuletOfGreaterEvasion: ['amuletOfEvasion'],
  ringOfGreaterHealth: ['ringOfHealth'],
  amuletOfGreaterProtection: ['amuletOfProtection'],
  ringOfGreaterRegeneration: ['ringOfRegeneration'],
  earringOfGreaterArmorDurability: ['earringOfArmorDurability'],
  earringOfGreaterWeaponDurability: ['earringOfWeaponDurability'],
  philosophersStone: [
    'ringOfHealth', 'ringOfGreaterHealth',
    'ringOfRegeneration', 'ringOfGreaterRegeneration',
  ],
  legendaryWhetstone: [
    'earringOfWeaponDurability', 'earringOfGreaterWeaponDurability',
  ],
  glovesOfHermitWizard: ['runeOfFire', 'runeOfZap', 'runeOfPoison'],
};

import { getAmuletAtlasPresentation } from '../amulets/RelicsOthersAtlas.js';

// Every droppable amulet belongs to a group — the seed of the future
// class system (see docs/BALANCE-AMULETS.md):
//   offense  — damage / weapon synergy (warrior-rogue leaning)
//   survival — HP, regen, dodge, healing (tank leaning)
//   magic    — AP economy, spells, gems (mage leaning)
//   utility  — economy/exploration, no class identity
// The first amulet of a run steers toward a class group (see
// createAmuletCard); weights of sweep-proven outliers (dragonClaw,
// bottomlessBag, evasionBoots) are trimmed so no single pickup
// dominates the run.
export const AMULET_DROP_DATA = [
  // Common (from floor 0 / start of run)
  { id: 'amuletOfEvasion', minFloor: 0, weight: 10, rarity: 'common', group: 'survival' },
  { id: 'ringOfHealth', minFloor: 0, weight: 10, rarity: 'common', group: 'survival' },
  { id: 'amuletOfProtection', minFloor: 0, weight: 10, rarity: 'common', group: 'survival' },
  { id: 'ringOfRegeneration', minFloor: 0, weight: 10, rarity: 'common', group: 'survival' },
  { id: 'earringOfArmorDurability', minFloor: 0, weight: 8, rarity: 'common', group: 'survival' },
  { id: 'earringOfWeaponDurability', minFloor: 0, weight: 8, rarity: 'common', group: 'offense' },

  // Uncommon (from floor 10)
  { id: 'amuletOfGreaterEvasion', minFloor: 10, weight: 7, rarity: 'uncommon', group: 'survival' },
  { id: 'ringOfGreaterHealth', minFloor: 10, weight: 7, rarity: 'uncommon', group: 'survival' },
  { id: 'amuletOfGreaterProtection', minFloor: 10, weight: 7, rarity: 'uncommon', group: 'survival' },
  { id: 'ringOfGreaterRegeneration', minFloor: 10, weight: 7, rarity: 'uncommon', group: 'survival' },
  { id: 'earringOfGreaterArmorDurability', minFloor: 10, weight: 6, rarity: 'uncommon', group: 'survival' },
  { id: 'earringOfGreaterWeaponDurability', minFloor: 10, weight: 6, rarity: 'uncommon', group: 'offense' },
  { id: 'alchemistBag', minFloor: 10, weight: 6, rarity: 'uncommon', group: 'survival' },
  { id: 'monocle', minFloor: 10, weight: 6, rarity: 'uncommon', group: 'utility' },
  { id: 'pouchOfGreed', minFloor: 10, weight: 8, rarity: 'uncommon', group: 'utility' },

  // Rare (from floor 20; boss can still roll rare earlier — see createAmuletOffer)
  { id: 'vampireFang', minFloor: 20, weight: 4, rarity: 'rare', group: 'offense' },
  { id: 'newDragonClaw', minFloor: 20, weight: 4, rarity: 'rare', group: 'offense' },
  { id: 'runeOfFire', minFloor: 20, weight: 4, rarity: 'rare', group: 'magic' },
  { id: 'runeOfZap', minFloor: 20, weight: 4, rarity: 'rare', group: 'magic' },
  { id: 'runeOfPoison', minFloor: 20, weight: 4, rarity: 'rare', group: 'magic' },
  { id: 'maskOfHollowWhispers', minFloor: 20, weight: 4, rarity: 'rare', group: 'utility' },

  // Legendary (shops / boss until boss-only set exists)
  { id: 'philosophersStone', minFloor: 0, weight: 2, rarity: 'legendary', group: 'survival' },
  { id: 'legendaryWhetstone', minFloor: 0, weight: 2, rarity: 'legendary', group: 'offense' },
  { id: 'lostNobleDiadem', minFloor: 0, weight: 2, rarity: 'legendary', group: 'survival' },
  { id: 'glovesOfHermitWizard', minFloor: 0, weight: 2, rarity: 'legendary', group: 'magic' },
];

/** Drop catalog with atlas presentation merged in. */
export const AMULETS = AMULET_DROP_DATA.map((amulet) => ({
  ...amulet,
  ...getAmuletAtlasPresentation(amulet.id)
}));

export function getAmulet(id) {
  return AMULETS.find((a) => a.id === id) || null;
}

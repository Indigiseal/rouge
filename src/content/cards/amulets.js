import { getAmuletAtlasPresentation } from '../amulets/RelicsOthersAtlas.js';

// Every droppable amulet belongs to a group — the seed of the future
// class system (see docs/BALANCE-AMULETS.md):
//   offense  — damage / weapon synergy (warrior-rogue leaning)
//   survival — regen, durability, potions
//   magic    — AP economy, spells, gems (mage leaning)
//   utility  — economy/exploration, no class identity
//   strategy — scout, pull a ranged fighter forward, cluster revealed enemies,
//              or (legendary) pick any room on the next map floor once per act
//   control  — retired from drop; mark/bind code remains for old saves
// The first amulet of a run steers toward a class group (see
// createAmuletCard); weights of sweep-proven outliers (dragonClaw,
// bottomlessBag, evasionBoots) are trimmed so no single pickup
// dominates the run.
export const AMULET_DROP_DATA = [
  // Common (from floor 0 / start of run)
  { id: 'ringOfRegeneration', minFloor: 0, weight: 10, rarity: 'common', group: 'survival' },
  { id: 'earringOfArmorDurability', minFloor: 0, weight: 8, rarity: 'common', group: 'survival' },
  { id: 'earringOfWeaponDurability', minFloor: 0, weight: 8, rarity: 'common', group: 'offense' },
  { id: 'tacticiansPin', minFloor: 0, weight: 8, rarity: 'common', group: 'strategy' },

  // Uncommon (from floor 10)
  { id: 'ringOfGreaterRegeneration', minFloor: 10, weight: 7, rarity: 'uncommon', group: 'survival' },
  { id: 'earringOfGreaterArmorDurability', minFloor: 10, weight: 6, rarity: 'uncommon', group: 'survival' },
  { id: 'earringOfGreaterWeaponDurability', minFloor: 10, weight: 6, rarity: 'uncommon', group: 'offense' },
  { id: 'alchemistBag', minFloor: 10, weight: 6, rarity: 'uncommon', group: 'survival' },
  { id: 'monocle', minFloor: 10, weight: 6, rarity: 'uncommon', group: 'utility' },
  { id: 'pouchOfGreed', minFloor: 10, weight: 8, rarity: 'uncommon', group: 'utility' },
  { id: 'forcedMarch', minFloor: 10, weight: 6, rarity: 'uncommon', group: 'strategy' },
  { id: 'runeOfFire', minFloor: 10, weight: 6, rarity: 'uncommon', group: 'magic' },
  { id: 'runeOfZap', minFloor: 10, weight: 6, rarity: 'uncommon', group: 'magic' },
  { id: 'runeOfPoison', minFloor: 10, weight: 6, rarity: 'uncommon', group: 'magic' },

  // Rare (from floor 16 = act 2 start; boss can still roll rare earlier — see createAmuletOffer)
  { id: 'vampireFang', minFloor: 16, weight: 4, rarity: 'rare', group: 'offense' },
  { id: 'newDragonClaw', minFloor: 16, weight: 4, rarity: 'rare', group: 'offense' },
  { id: 'greaterRuneOfFire', minFloor: 16, weight: 4, rarity: 'rare', group: 'magic' },
  { id: 'greaterRuneOfZap', minFloor: 16, weight: 4, rarity: 'rare', group: 'magic' },
  { id: 'greaterRuneOfPoison', minFloor: 16, weight: 4, rarity: 'rare', group: 'magic' },
  { id: 'maskOfHollowWhispers', minFloor: 16, weight: 4, rarity: 'rare', group: 'utility' },
  { id: 'vacancyStep', minFloor: 16, weight: 4, rarity: 'rare', group: 'strategy' },

  // Legendary (shops / boss until boss-only set exists)
  { id: 'legendaryWhetstone', minFloor: 0, weight: 2, rarity: 'legendary', group: 'offense' },
  { id: 'glovesOfHermitWizard', minFloor: 0, weight: 2, rarity: 'legendary', group: 'magic' },
  { id: 'generalsTable', minFloor: 0, weight: 2, rarity: 'legendary', group: 'strategy' },
];

/** Drop catalog with atlas presentation merged in. */
export const AMULETS = AMULET_DROP_DATA.map((amulet) => ({
  ...amulet,
  ...getAmuletAtlasPresentation(amulet.id)
}));

export function getAmulet(id) {
  return AMULETS.find((a) => a.id === id) || null;
}

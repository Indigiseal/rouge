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
  { id: 'tacticiansPin', minFloor: 0, weight: 8, rarity: 'common', group: 'strategy' },
  { id: 'forcedMarch', minFloor: 0, weight: 6, rarity: 'common', group: 'strategy' },
  { id: 'handMirror', minFloor: 0, weight: 6, rarity: 'common', group: 'survival' },

  // Uncommon (from floor 10)
  { id: 'ringOfGreaterRegeneration', minFloor: 10, weight: 7, rarity: 'uncommon', group: 'survival' },
  { id: 'alchemistBag', minFloor: 10, weight: 6, rarity: 'uncommon', group: 'survival' },
  { id: 'pouchOfGreed', minFloor: 10, weight: 8, rarity: 'uncommon', group: 'utility' },
  { id: 'runeOfFire', minFloor: 10, weight: 6, rarity: 'uncommon', group: 'magic' },
  { id: 'runeOfZap', minFloor: 10, weight: 6, rarity: 'uncommon', group: 'magic' },
  { id: 'runeOfPoison', minFloor: 10, weight: 6, rarity: 'uncommon', group: 'magic' },
  { id: 'cartographersInk', minFloor: 0, weight: 6, rarity: 'uncommon', group: 'utility' },
  { id: 'quickstepCharm', minFloor: 0, weight: 6, rarity: 'uncommon', group: 'magic' },

  // Rare (from floor 16 = act 2 start; boss can still roll rare earlier — see createAmuletOffer)
  { id: 'vampireFang', minFloor: 16, weight: 4, rarity: 'rare', group: 'offense' },
  { id: 'newDragonClaw', minFloor: 16, weight: 4, rarity: 'rare', group: 'offense' },
  { id: 'greaterRuneOfFire', minFloor: 16, weight: 4, rarity: 'rare', group: 'magic' },
  { id: 'greaterRuneOfZap', minFloor: 16, weight: 4, rarity: 'rare', group: 'magic' },
  { id: 'greaterRuneOfPoison', minFloor: 16, weight: 4, rarity: 'rare', group: 'magic' },
  { id: 'maskOfHollowWhispers', minFloor: 16, weight: 4, rarity: 'rare', group: 'utility' },
  { id: 'vacancyStep', minFloor: 16, weight: 4, rarity: 'rare', group: 'strategy' },
  { id: 'provisionersBell', minFloor: 16, weight: 4, rarity: 'rare', group: 'utility' },
  { id: 'shiftingMedallion', minFloor: 16, weight: 4, rarity: 'rare', group: 'strategy' },
  { id: 'keepersWard', minFloor: 16, weight: 5, rarity: 'rare', group: 'survival' },
  { id: 'armsfindersCharm', minFloor: 16, weight: 4, rarity: 'rare', group: 'utility' },
  { id: 'apothecarysEye', minFloor: 16, weight: 4, rarity: 'rare', group: 'utility' },
  { id: 'gemseekersLens', minFloor: 16, weight: 4, rarity: 'rare', group: 'magic' },
  { id: 'oraclesFishbowl', minFloor: 16, weight: 3, rarity: 'rare', group: 'utility' },
  { id: 'heartOfHours', minFloor: 16, weight: 3, rarity: 'rare', group: 'magic' },
  { id: 'gluttonsCharm', minFloor: 16, weight: 3, rarity: 'rare', group: 'survival' },
  { id: 'veteransCarryall', minFloor: 16, weight: 3, rarity: 'rare', group: 'utility' },

  // Legendary (shops / boss until boss-only set exists)
  { id: 'glovesOfHermitWizard', minFloor: 0, weight: 2, rarity: 'legendary', group: 'magic' },
  { id: 'generalsTable', minFloor: 0, weight: 2, rarity: 'legendary', group: 'strategy' },
  { id: 'plagueHeart', minFloor: 0, weight: 2, rarity: 'legendary', group: 'magic' },
];

// One amulet, no choice (sigils branch): wherever an amulet is found — a board
// card, a boss, a shop, the healer — the player gets the amulet the offer
// shows (its first option, already a weighted random pick), straight away.
// False brings back the pick-one-of-three window (AmuletChoiceOverlay).
export const SINGLE_AMULET = true;

/** The one amulet an offer stands for: what it shows, and what it gives. */
export function offerFaceAmulet(offer) {
  return Array.isArray(offer?.options) && offer.options.length ? offer.options[0] : null;
}

// No active amulets on the sigils branch: the five "Active: ..." ones (click
// to use, with a cooldown) are never handed out — not by the board, a boss, a
// shop, the healer or a story. An old save that already holds one keeps it.
export const RETIRED_ACTIVE_AMULETS = new Set([
  'provisionersBell', 'shiftingMedallion', 'armsfindersCharm', 'apothecarysEye', 'gemseekersLens',
]);

const ALL_DROP_AMULETS = AMULET_DROP_DATA.map((amulet) => ({
  ...amulet,
  ...getAmuletAtlasPresentation(amulet.id)
}));

/** Drop catalog with atlas presentation merged in. */
export const AMULETS = ALL_DROP_AMULETS.filter((amulet) => !RETIRED_ACTIVE_AMULETS.has(amulet.id));

export function getAmulet(id) {
  return ALL_DROP_AMULETS.find((a) => a.id === id) || null;
}

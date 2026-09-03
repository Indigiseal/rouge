import { depthScaled } from '../balance/DepthScaling.js';

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

// Fire/lightning damage by gem stack. Used to be an inline [3,4,5,6,7] in
// BoardCombat and mirrored three times in the sim — the table lives here now.
// Stacks 4-5 stay provisional until gem merge power is decided
// (docs/OPEN-QUESTIONS.md).
export const GEM_STACK_DAMAGE = Object.freeze([3, 4, 5, 6, 7]);

// Fire gem splash, measured centre-to-nearest-sprite-edge. Uncommon Rune of
// Fire multiplies this; the old event rune still adds flat pixels on top.
export const FIRE_GEM_SPLASH_RADIUS = 65;

/**
 * @param {number} [multiplier=1]
 * @param {number} [flatBonus=0]
 */
export function resolveFireGemSplashRadius(multiplier = 1, flatBonus = 0) {
  const scale = Number(multiplier);
  const bonus = Number(flatBonus);
  return Math.round(FIRE_GEM_SPLASH_RADIUS * (Number.isFinite(scale) && scale > 0 ? scale : 1))
    + (Number.isFinite(bonus) ? bonus : 0);
}

// The stack ladder alone tracked enemy HP x2.33 against their x2.75 over a run,
// so the same gem that stripped 37% of a floor-1 enemy stripped 14% on floor 45.
// The depth term closes that gap from the act-2 boundary onward: act 1 is tuned
// to its reach/clear targets and must not drift, so growth starts at F15
// (+0 through act 1, +2 by F30, +4 by F45). Scaled by depth and not by how much
// the player has stacked — see DepthScaling.js for why.
export const GEM_DEPTH_PER_FLOOR = 0.13;
export const GEM_DEPTH_FROM_FLOOR = 15;

/**
 * @param {number} stack gem stack size (1-5)
 * @param {number} floor current floor
 */
export function gemStackDamage(stack, floor = 1) {
  const index = Math.max(1, Math.min(GEM_STACK_DAMAGE.length, Math.floor(stack) || 1)) - 1;
  return depthScaled({
    base: GEM_STACK_DAMAGE[index],
    perFloor: GEM_DEPTH_PER_FLOOR,
    fromFloor: GEM_DEPTH_FROM_FLOOR,
  }, floor);
}

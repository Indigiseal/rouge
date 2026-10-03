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

// --- Tiered gem art ---------------------------------------------------------
// gemsTiered.png is 5 columns by 3 rows of 18x18: the columns are the five
// sizes, the rows are the three colours. A gem used to be drawn as a little
// stack of identical icons — one per level — and is now drawn once, at the size
// its level earns.
//
// The row order is the SHEET's, which is not the order GEMS is declared in:
// red, yellow, green against fire, poison, lightning. Mapping by colour rather
// than by position is the whole reason this table is written out.
export const GEM_TIER_NAMES = Object.freeze([
  'smallShard', 'shard', 'smallGem', 'mediumGem', 'bigGem',
]);
export const GEM_TIER_COUNT = GEM_TIER_NAMES.length;
const GEM_SHEET_COLUMNS = GEM_TIER_COUNT;
const GEM_SHEET_ROW = Object.freeze({
  fire: 0,       // red
  lightning: 1,  // yellow
  poison: 2,     // green
});

/**
 * Frame on gemsTiered for an effect at a given level.
 *
 * @param {string} effect 'fire' | 'poison' | 'lightning'
 * @param {number} tier 1..5; anything outside is clamped rather than dropped,
 *   because a legendary weapon can carry 5 and a bug should show a gem, not a
 *   missing texture.
 */
// A gem found in the world — a shop, a chest, a board drop — is always the
// smallest of the five: a small shard. It grows by being socketed, not by being
// found. One helper so the six places that hand out gems cannot disagree about
// which art a loose one wears.
export const LOOSE_GEM_TIER = 1;

/**
 * Card data for a loose gem of `effect`, or of a whole GEMS entry.
 * @param {{effect: string, name: string, color: number}|string} gemOrEffect
 */
export function looseGemCard(gemOrEffect) {
  const gem = typeof gemOrEffect === 'string'
    ? GEMS.find((g) => g.effect === gemOrEffect) || GEMS[0]
    : gemOrEffect;
  return {
    type: 'gem',
    gemEffect: gem.effect,
    name: gem.name,
    sprite: 'gemsTiered',
    spriteFrame: gemTierFrame(gem.effect, LOOSE_GEM_TIER),
    color: gem.color,
    rarity: 'common',
  };
}

export function gemTierFrame(effect, tier = 1) {
  const row = GEM_SHEET_ROW[effect] ?? GEM_SHEET_ROW.fire;
  const level = Math.max(1, Math.min(GEM_TIER_COUNT, Math.floor(tier) || 1));
  return row * GEM_SHEET_COLUMNS + (level - 1);
}

// Fire/lightning damage by gem stack. Used to be an inline [3,4,5,6,7] in
// BoardCombat and mirrored three times in the sim — the table lives here now.
// Stacks 4-5 stay provisional until gem merge power is decided
// (docs/OPEN-QUESTIONS.md).
export const GEM_STACK_DAMAGE = Object.freeze([3, 4, 5, 6, 7]);

// Fire gem splash, measured centre-to-nearest-sprite-edge. Uncommon Rune of
// Fire multiplies this; the old event rune still adds flat pixels on top.
export const FIRE_GEM_SPLASH_RADIUS = 59;

// Rune of Poison currently reaches as far as the base Fire Gem, but owns its
// balance value so future Fire Gem radius changes do not alter the rune.
export const POISON_RUNE_SPLASH_RADIUS = 59;

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

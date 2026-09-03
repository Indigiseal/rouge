// Amulet rarity is rolled FIRST by source, then the player picks 1 of 3
// amulets of that rarity. Weights are relative (need not sum to 100).
//
// `floor` / `shop` are the act-1 shelf; past F15 they hand off to
// AMULET_RARITY_DEPTH_TIERS below. Read them through amuletRarityRates(),
// not directly — this map stays the registry of valid source keys and the
// fixed table for sources that ignore depth.
export const AMULET_RARITY_RATES = {
  floor:     { common: 70, uncommon: 30 },
  shop:      { common: 70, uncommon: 30 },
  rare_shop: { uncommon: 25, rare: 60, legendary: 15 },
  // Boss: rare or legendary (boss ignores minFloor so act-1 boss can roll rare).
  boss:      { rare: 30, legendary: 70 },
};

// One fixed table for the whole run meant a floor-45 offer rolled the same
// 50% common as a floor-1 offer, so by act 2 half of every roll landed in a
// six-item common pool the player had already exhausted — the offer rate
// stayed flat while enemy power kept climbing. Depth tiers move the weight
// upward as the run goes on so the *rate* of power gain survives act 1.
export const AMULET_RARITY_DEPTH_TIERS = Object.freeze([
  { minFloor: 1,  rates: Object.freeze({ common: 70, uncommon: 30 }) },
  { minFloor: 16, rates: Object.freeze({ common: 20, uncommon: 45, rare: 30, legendary: 5 }) },
  { minFloor: 31, rates: Object.freeze({ common: 5, uncommon: 25, rare: 45, legendary: 25 }) },
]);

// Sources whose whole point is a fixed high-rarity band ignore depth.
const DEPTH_SCALED_SOURCES = new Set(['floor', 'shop']);

/**
 * Rarity weights for a source at a given depth.
 * @param {string} source floor | shop | rare_shop | boss
 * @param {number} floor
 */
export function amuletRarityRates(source = 'floor', floor = 1) {
  const key = AMULET_RARITY_RATES[source] ? source : 'floor';
  if (!DEPTH_SCALED_SOURCES.has(key)) return AMULET_RARITY_RATES[key];
  const f = Math.max(1, Math.floor(Number(floor) || 1));
  let selected = AMULET_RARITY_DEPTH_TIERS[0];
  for (let i = AMULET_RARITY_DEPTH_TIERS.length - 1; i >= 0; i--) {
    if (f >= AMULET_RARITY_DEPTH_TIERS[i].minFloor) {
      selected = AMULET_RARITY_DEPTH_TIERS[i];
      break;
    }
  }
  return selected.rates;
}

// Earliest floor a source may sell/offer amulets (floor/boss have no gate).
export const AMULET_SOURCE_MIN_FLOOR = {
  shop: 5,
  rare_shop: 20,
};

// When an upgrade is owned, its weaker forms are excluded from offers.
export const AMULET_UPGRADE_REPLACES = {
  ringOfGreaterRegeneration: ['ringOfRegeneration'],
  earringOfGreaterArmorDurability: ['earringOfArmorDurability'],
  earringOfGreaterWeaponDurability: ['earringOfWeaponDurability'],
  legendaryWhetstone: [
    'earringOfWeaponDurability', 'earringOfGreaterWeaponDurability',
  ],
  glovesOfHermitWizard: [
    'runeOfFire', 'runeOfZap', 'runeOfPoison',
    'greaterRuneOfFire', 'greaterRuneOfZap', 'greaterRuneOfPoison',
  ],
  markOfTreachery: ['markOfHesitation'],
  twinMarks: ['markOfHesitation', 'markOfTreachery'],
  collarOfBinding: ['markOfHesitation', 'markOfTreachery', 'twinMarks'],
};

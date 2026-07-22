// Canonical thorns stats per rarity — the single source of truth for both
// freshly generated thorns and merge results, so a rare is always 3 damage.
export const THORN_STATS_BY_RARITY = {
  common:    { thornDamage: 1, durability: 6 },
  uncommon:  { thornDamage: 2, durability: 7 },
  rare:      { thornDamage: 3, durability: 9 },
  epic:      { thornDamage: 4, durability: 10 },
  legendary: { thornDamage: 5, durability: 11 }
};

// Per-rarity art. No legendary asset yet, so legendary borrows the
// epic sprite (closest tier visually).
export const THORNS_SPRITE_BY_RARITY = {
  common:    'thornsCard',
  uncommon:  'thornsCard_U',
  rare:      'thornsCard_R',
  epic:      'thornsCard_E',
  legendary: 'thornsCard_E',
};

export function getThornStats(rarity) {
  return THORN_STATS_BY_RARITY[rarity] || THORN_STATS_BY_RARITY.common;
}

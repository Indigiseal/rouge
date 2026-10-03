// Anvil repair pricing.

import { shopItemBuyPrice } from './shop.js';

// A full repair costs this share of what the item would cost new in the shop
// on the current floor, and a partial one the same share in proportion to the
// pips it restores.
//
// The old flat tables (1-4 coins a pip, armor 2 coins per 5) never moved with
// depth, so a repair cost the same on floor 40 as on floor 1 while income and
// every shop price grew. The sim had runs reaching the floor 15 boss with ~90
// coins unspent and the anvil taking ~10 coins a run. Pricing off the shop
// value grows with depth the way income does, and covers rarity, item type
// and damage/protection without a table — the old one had no epic tier (epic
// was billed as common) and no spear row.
//
// Measured (fresh, no amulets, 3000 runs): 0.6 doubles anvil spend (9 -> 21
// coins a run) and leaves ~70 coins at the boss, with F15 reach unchanged
// within noise.
export const REPAIR_VALUE_RATIO = 0.6;

/** Total coin cost to restore `amount` durability on `item` on `floor`. */
export function totalRepairCost(item, amount, floor = 1) {
  if (!item || amount <= 0) return 0;
  const maxDurability = Math.max(amount, item.maxDurability || amount);
  const value = shopItemBuyPrice(item, Math.max(1, floor || 1));
  return Math.max(1, Math.ceil(value * REPAIR_VALUE_RATIO * (amount / maxDurability)));
}

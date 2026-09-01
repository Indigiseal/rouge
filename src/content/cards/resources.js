// Coin and crystal tiers. Shop price lives in content/economy/shop.js.
//
// Coins and crystals had no rarity at all — one coin card, one crystal card,
// and an amount rolled behind them. Now that the art carries three sizes of
// pile (see content/assets/resourceCards.js) the amount and the picture move
// together: a big pile looks like a big pile before you pick it up.
//
// Food and potions keep their own catalogs (food.js, potions.js) because their
// tiers carry names and effects; these two only carry a number.

import { resourceCardKey } from '../assets/resourceCards.js';

/**
 * How often each size turns up. Weighted so a common pile is the norm and the
 * big one stays a small thrill rather than the expected outcome.
 */
export const RESOURCE_RARITY_WEIGHTS = Object.freeze([
    Object.freeze({ rarity: 'common', weight: 60 }),
    Object.freeze({ rarity: 'uncommon', weight: 30 }),
    Object.freeze({ rarity: 'rare', weight: 10 }),
]);

/** Picks a size for a dropped resource. */
export function rollResourceRarity() {
    const total = RESOURCE_RARITY_WEIGHTS.reduce((sum, r) => sum + r.weight, 0);
    let roll = Math.random() * total;
    for (const entry of RESOURCE_RARITY_WEIGHTS) {
        roll -= entry.weight;
        if (roll <= 0) return entry.rarity;
    }
    return 'common';
}

/**
 * Coins scale with depth so a purse stays meaningful as shop prices rise; the
 * size band then scales that. Uncommon is the old flat payout, so the average
 * drop is close to what it was before sizes existed.
 */
export const COIN_AMOUNT_MULTIPLIER = Object.freeze({
    common: 0.5,
    uncommon: 1,
    rare: 2,
});

/** Base coin payout for a floor, before the size band. */
export function baseCoinAmount(floor) {
    const f = Math.max(1, Math.floor(Number(floor) || 1));
    return 3 + Math.floor(f / 8) + Math.floor(Math.random() * 4);
}

/** Coin payout for a floor at a given size. */
export function coinAmountFor(floor, rarity) {
    const mult = COIN_AMOUNT_MULTIPLIER[rarity] ?? 1;
    return Math.max(1, Math.round(baseCoinAmount(floor) * mult));
}

/**
 * Crystals are flat per size — they buy meta upgrades rather than floor goods,
 * so depth should not inflate them. One stays the common case; the comment on
 * the old flat-1 roll noted crystals were piling up unspent, so the bigger
 * bands are deliberately rare.
 */
export const CRYSTAL_AMOUNT_BY_RARITY = Object.freeze({
    common: 1,
    uncommon: 3,
    rare: 4,
});

/** Crystal payout at a given size. */
export function crystalAmountFor(rarity) {
    return CRYSTAL_AMOUNT_BY_RARITY[rarity] ?? 1;
}

/** Display name for a coin pile — the amount already tells the size. */
export function coinCardName() {
    return 'Coins';
}

/** Card art for a resource at a size. */
export function resourceSprite(resource, rarity) {
    return resourceCardKey(resource, rarity);
}

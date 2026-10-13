// Global economy tuning for gold rewards. Keep spending, losses, and shop
// resale values outside this helper: it only scales gold the player receives.
//
// 0.96 (was 0.8): +20% gold. Anvil repairs became priced off the shop (see
// repair.js) and play felt coin-starved. Measured (fresh, no amulets, 3000
// runs, seed 777): coins held at the F15 boss 70 -> 93, purchases 1.52 ->
// 1.84 a run, rare-shop items affordable 0.6 -> 1.0 of 4 a visit, F15 reach
// 35% -> 36% (noise).
export const GOLD_REWARD_MULTIPLIER = 0.96;

export function scaleGoldReward(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return amount;
    return Math.max(1, Math.floor(amount * GOLD_REWARD_MULTIPLIER));
}

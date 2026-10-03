// Global economy tuning for gold rewards. Keep spending, losses, and shop
// resale values outside this helper: it only scales gold the player receives.
export const GOLD_REWARD_MULTIPLIER = 0.8;

export function scaleGoldReward(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return amount;
    return Math.max(1, Math.floor(amount * GOLD_REWARD_MULTIPLIER));
}

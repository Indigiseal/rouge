export const MOSSY_STONE = Object.freeze({
    name: 'Mossy Stone',
    description: 'Each successful card merge gives +1 maximum HP, up to +50 per run. Does not heal you.',
    originLocationId: 'mireturn',
    maxHp: 50,
});

// Earned health and cap usage belong to the run, surviving removal/re-equipping.
// Only committed merges call this; creating a merge preview has no side effects.
export function grantMergeMaxHealth(gameState, amuletManager) {
    if (!gameState || !(gameState.playerHealth > 0)) return 0;
    const amount = Math.max(0, Math.floor(amuletManager?.sumAmuletProperty?.('maxHpPerMerge') || 0));
    const earned = Math.max(0, gameState.mossyMaxHpGained || 0);
    const gain = Math.min(amount, Math.max(0, MOSSY_STONE.maxHp - earned));
    if (gain <= 0) return 0;
    gameState.maxHealth += gain;
    gameState.mossyMaxHpGained = earned + gain;
    return gain;
}

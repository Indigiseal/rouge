import { GLUTTON_MAX_AP } from './currentCatalog.js';

/** Apply earned meal growth before refilling AP; the run counter survives removal. */
export function grantMealMaxActions(gameState, amuletManager) {
    if (!gameState || !(gameState.playerHealth > 0)) return 0;
    const amount = Math.max(0, Math.floor(amuletManager?.getFoodMaxActionGain?.() || 0));
    const earned = Math.max(0, gameState.gluttonMaxApGained || 0);
    const gain = Math.min(amount, Math.max(0, GLUTTON_MAX_AP - earned));
    if (gain <= 0) return 0;
    gameState.maxActions += gain;
    gameState.gluttonMaxApGained = earned + gain;
    return gain;
}

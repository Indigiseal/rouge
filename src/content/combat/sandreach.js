import { sigilLevel } from '../sigils/sigils.js';

export const FORAGE_CHANCE = 0.1;
export const QUICK_STRIKE_CHANCE = 0.1;
export const SANDSTORM_CHANCE = 0.2;

export function restoreDesertFeastAP(gameState) {
    if (!(gameState?.playerHealth > 0) || !(gameState.maxActions > gameState.actionsLeft)) return 0;
    const gained = gameState.maxActions - gameState.actionsLeft;
    gameState.actionsLeft = gameState.maxActions;
    return gained;
}

export function tryEnemySandstorm(gameState, data, damage, random = Math.random) {
    if (!(damage > 0) || !(gameState?.playerHealth > 0) || sigilLevel(data, 'daze') <= 0
        || random() >= SANDSTORM_CHANCE) return false;
    gameState.playerSandstormed = true;
    return true;
}

export function tryEnemyQuickStrike(gameState, data, damage, random = Math.random) {
    return damage > 0 && gameState?.playerHealth > 0 && data?.health > 0
        && !data.isBonePile && sigilLevel(data, 'quickStrike') > 0 && random() < QUICK_STRIKE_CHANCE;
}

// Snapshot before AP is spent; the same snapshot covers a free off-hand swing.
export function sandAttackConditions(weapon, target, gameState, actionsBefore = gameState?.actionsLeft) {
    const ids = [];
    if (sigilLevel(weapon, 'archerBane') > 0 && target?.data?.role === 'RANGED') ids.push('archerBane');
    if (sigilLevel(weapon, 'wellFed') > 0 && gameState?.maxActions > 0
        && actionsBefore >= gameState.maxActions) ids.push('wellFed');
    return ids;
}

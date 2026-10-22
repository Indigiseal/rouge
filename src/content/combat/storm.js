import { sigilLevel } from '../sigils/sigils.js';

export const SHOCK_CHANCE = 0.1;
export const THUNDERCLAP_DAMAGE = 3;

export function isStormSpellTarget(card) {
    return !!card?.revealed && ['enemy', 'eliteEnemy', 'boss'].includes(card.data?.type)
        && card.data.health > 0 && !card.data.isBonePile && !card.data.isCocoon
        && !card.data.features?.includes('cocoon_shell');
}

export function applyThunderclap(cardSystem) {
    const targets = (cardSystem?.boardCards || []).map((card, index) => ({ card, index }))
        .filter(({ card }) => isStormSpellTarget(card));
    for (const { card, index } of targets) {
        if (cardSystem.boardCards[index] !== card || !isStormSpellTarget(card)) continue;
        cardSystem.damageGemTarget(index, THUNDERCLAP_DAMAGE, 'Lightning', 0xffcf7f, 'lightning', 'gem', { bypassTargeting: true });
        if (cardSystem.boardCards[index] === card && isStormSpellTarget(card)) cardSystem.applyShockStatus(card, 1);
    }
    return targets.length;
}

/** A non-stacking hit rider: choose equally among the player and companions. */
export function tryEnemyShock(scene, data, damage, random = Math.random) {
    const gs = scene?.gameState;
    if (!(damage > 0) || !(gs?.playerHealth > 0) || sigilLevel(data, 'shock') <= 0
        || random() >= SHOCK_CHANCE) return null;
    const slots = scene.inventorySystem?.slots || scene._simInventory || gs.inventory || [];
    const companions = [...new Set(slots.filter(card => card?.type === 'companion'))];
    const index = Math.min(companions.length, Math.floor(random() * (companions.length + 1)));
    if (index === 0) return shockPlayer(gs) ? { player: true } : null;
    const companion = companions[index - 1];
    return shockCompanion(companion) ? { companion, index: slots.indexOf(companion) } : null;
}

export function shockPlayer(gameState) {
    if (!(gameState?.playerHealth > 0) || gameState.playerShocked) return false;
    gameState.playerShocked = true;
    return true;
}

export function consumePlayerShock(gameState) {
    if (!gameState?.playerShocked) return false;
    gameState.playerShocked = false;
    return true;
}

export function shockCompanion(companion) {
    if (companion?.type !== 'companion' || companion.shockedTurns > 0) return false;
    companion.shockedTurns = 1;
    return true;
}

export function consumeCompanionShock(companion) {
    if (!(companion?.shockedTurns > 0)) return false;
    companion.shockedTurns = 0;
    return true;
}

import { sigilLevel } from '../sigils/sigils.js';
import { consumePlayerShock, consumeCompanionShock } from './storm.js';

export const ENEMY_FROST_CHANCE = 0.1;
export const ENEMY_FROST_ATTACKS = 2;

export function freezePlayer(gameState) {
    if (!(gameState?.playerHealth > 0)) return false;
    gameState.playerFrozenAttacks = Math.max(gameState.playerFrozenAttacks || 0, ENEMY_FROST_ATTACKS);
    return true;
}

export function freezeCompanion(companion) {
    if (companion?.type !== 'companion') return false;
    companion.frozenAttacks = Math.max(companion.frozenAttacks || 0, ENEMY_FROST_ATTACKS);
    return true;
}

export function tryEnemyFrost(scene, data, damage, random = Math.random) {
    const gs = scene?.gameState;
    if (!(damage > 0) || !(gs?.playerHealth > 0) || sigilLevel(data, 'frost') <= 0
        || random() >= ENEMY_FROST_CHANCE) return null;
    const slots = scene.inventorySystem?.slots || scene._simInventory || gs.inventory || [];
    const companions = [...new Set(slots.filter(card => card?.type === 'companion'))];
    const index = Math.min(companions.length, Math.floor(random() * (companions.length + 1)));
    if (index === 0) { freezePlayer(gs); return { player: true }; }
    const companion = companions[index - 1];
    freezeCompanion(companion);
    return { companion, index: slots.indexOf(companion) };
}

/** One attempted attack advances every overlapping attack hold. */
export function consumePlayerAttackHold(gameState) {
    const frozen = (gameState?.playerFrozenAttacks || 0) > 0;
    if (frozen) gameState.playerFrozenAttacks--;
    const shocked = consumePlayerShock(gameState);
    const sandstormed = !!gameState?.playerSandstormed;
    if (sandstormed) gameState.playerSandstormed = false;
    return frozen ? 'frost' : shocked ? 'shock' : sandstormed ? 'sandstorm' : null;
}

export function consumeCompanionAttackHold(companion) {
    const frozen = (companion?.frozenAttacks || 0) > 0;
    if (frozen) companion.frozenAttacks--;
    const shocked = consumeCompanionShock(companion);
    return frozen ? 'frost' : shocked ? 'shock' : null;
}

export function isFrostTarget(card) {
    return !!card?.revealed && ['enemy', 'eliteEnemy', 'boss'].includes(card.data?.type)
        && card.data.health > 0 && !card.data.isBonePile && !card.data.isCocoon
        && !card.data.features?.includes('cocoon_shell');
}

export function isFrostFrozen(data) {
    return (data?.frozen || 0) > 0 && !(data.shockedTurns > 0) && !(data.webbedTurns > 0);
}

/** Frost owns the visual/status kind; another hold's longer duration survives. */
export function freezeEnemy(cardSystem, card, turns = 1) {
    if (!isFrostTarget(card)) return false;
    card.data.frozen = Math.max(card.data.frozen || 0, turns);
    card.data.shockedTurns = 0;
    card.data.webbedTurns = 0;
    card.shockMarker?.destroy?.();
    card.shockMarker = null;
    cardSystem?.attachFrozenFrame?.(card);
    return true;
}

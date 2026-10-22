export const WEB_CHANCE = 0.15;
export const VENOMOUS_BOMB_CHANCE = 0.1;
export const VENOMOUS_BOMB_DAMAGE = 3;
export const VENOMOUS_BOMB_TURNS = 3;

/** A Scorpion strengthens an active poison; it cannot create or extend one. */
export function strengthenPlayerPoison(gameState) {
    const poison = gameState?.playerEffects?.find(effect => effect.type === 'poison' && effect.turns > 0);
    if (!poison) return null;
    poison.damage = (poison.damage || 0) + 1;
    return poison;
}

export function isSilkdeepPoisonTarget(card) {
    return !!card?.revealed && ['enemy', 'eliteEnemy', 'boss'].includes(card.data?.type)
        && card.data.health > 0 && !card.data.isBonePile && !card.data.isCocoon
        && !card.data.features?.includes('cocoon_shell');
}

export function applyVenomousBomb(cardSystem) {
    const targets = (cardSystem?.boardCards || []).filter(isSilkdeepPoisonTarget);
    for (const card of targets) cardSystem.applyEnemyPoison(card, VENOMOUS_BOMB_DAMAGE, VENOMOUS_BOMB_TURNS);
    return targets.length;
}

export function entangleEnemy(cardSystem, card) {
    if (!isSilkdeepPoisonTarget(card) || card.data.type === 'boss' || card.data.frozen > 0) return false;
    card.data.frozen = 1;
    card.data.webbedTurns = 1;
    cardSystem.attachFrozenFrame?.(card);
    return true;
}

export const SCORCHED_CHANCE = 0.25;
export const SCORCHED_BURN = 3;
export const FIRE_COLUMN_BURN = 5;

export function addPlayerBurn(gameState, killedBy = 'Burn', amount = SCORCHED_BURN) {
    if (!(gameState?.playerHealth > 0)) return false;
    const effects = gameState.playerEffects ||= [];
    let effect = effects.find(entry => entry.type === 'burn');
    if (!effect) { effect = { type: 'burn', burn: 0 }; effects.push(effect); }
    effect.burn = Math.max(0, Number(effect.burn) || 0) + amount;
    effect.turns = effect.burn;
    effect.killedBy = killedBy;
    return true;
}

export function takePlayerBurnTick(gameState) {
    const effect = gameState?.playerEffects?.find(entry => entry.type === 'burn');
    if (!effect) return 0;
    const amount = takeBurnTick(effect);
    effect.turns = effect.burn;
    if (effect.burn <= 0) gameState.playerEffects = gameState.playerEffects.filter(entry => entry !== effect);
    return amount;
}

export function canBurnCard(card) {
    return !!card?.data && ['enemy', 'eliteEnemy', 'boss'].includes(card.data.type) && card.data.health > 0;
}

// One shared counter, not independent effects. Reapplying adds to the
// remaining heat; each enemy phase deals the counter then lowers it by one.
export function applyScorched(cardSystem, amount = SCORCHED_BURN) {
    const targets = (cardSystem?.boardCards || []).filter(canBurnCard);
    for (const card of targets) {
        card.data.burn = Math.max(0, Number(card.data.burn) || 0) + amount;
        if (amount === FIRE_COLUMN_BURN) card.data.burnVisual = 'fireColumn';
    }
    return targets.length;
}

export function takeBurnTick(data) {
    const amount = Math.max(0, Number(data?.burn) || 0);
    if (data) data.burn = Math.max(0, amount - 1);
    return amount;
}

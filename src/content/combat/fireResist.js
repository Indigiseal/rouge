// content/combat/fireResist.js
// Heatproof (Taya): the lava creatures of Ashhowl shrug off part of any fire
// that reaches them. The Fireball spell, a fire gem's burn and splash, the
// Fireball sigil and Embers all do HEATPROOF_RESIST less to an enemy with the
// 'heatproof' feature. A hit never drops below 1.

export const HEATPROOF_RESIST = 0.4;

export function isHeatproof(data) {
    return Array.isArray(data?.features) && data.features.includes('heatproof');
}

/** The fire damage `amount` does to an enemy with `data`. */
export function fireDamageAgainst(data, amount) {
    if (!isHeatproof(data) || !(amount > 0)) return amount;
    return Math.max(1, Math.round(amount * (1 - HEATPROOF_RESIST)));
}

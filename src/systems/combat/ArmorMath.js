// Single source of truth for "how much protection is the worn armor giving
// right now". The damage maths and the number drawn on the armor card both read
// from here, so what the player sees is always what actually gets subtracted.

/** True while a Magic Shield / Warding buff is boosting the worn armor. */
export function isArmorWarded(gameState, armor) {
    const shield = gameState?.magicShield;
    return Boolean(shield && shield.turns > 0 && (armor?.protection || 0) > 0);
}

/**
 * Protection the armor actually provides, including any Magic Shield boost.
 *
 * Rounds UP, and guarantees at least +1. The previous Math.floor meant a 20%
 * boost did nothing whatsoever unless protection happened to be a multiple of
 * 5 (protection 4 -> 4.8 -> back to 4), so both the Magic Shield spell and the
 * Warding enchant were silently dead most of the time — and the buffed number
 * on the card would not have changed either.
 */
export function effectiveArmorProtection(gameState, armor) {
    const base = armor?.protection || 0;
    if (!isArmorWarded(gameState, armor)) return base;
    const multiplier = gameState.magicShield.multiplier || 1;
    return Math.max(base + 1, Math.ceil(base * multiplier));
}

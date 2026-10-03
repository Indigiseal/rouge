// Single source of truth for "how much protection is the worn armor giving
// right now". The damage maths and the number drawn on the armor card both read
// from here, so what the player sees is always what actually gets subtracted.

// Magic Shield multiplies DEF, which is worth exactly nothing on leather —
// leather has no DEF at all, it dodges. The spell was therefore dead for the
// rogue, the only class that wears it. Dodge armour gets a flat dodge bonus
// instead, so the same card is worth casting whoever picked it up.
export const MAGIC_SHIELD_DODGE_BONUS = 0.30;

/** True while a Magic Shield / Warding buff is running at all. */
export function isShieldActive(gameState) {
    const shield = gameState?.magicShield;
    return Boolean(shield && shield.turns > 0);
}

/** True while the buff is boosting DEF specifically (armour that has DEF). */
export function isArmorWarded(gameState, armor) {
    return isShieldActive(gameState) && (armor?.protection || 0) > 0;
}

/** True while the buff is boosting dodge instead (armour that has no DEF). */
export function isDodgeWarded(gameState, armor) {
    return isShieldActive(gameState)
        && (armor?.protection || 0) <= 0
        && (armor?.dodgeChance || 0) > 0;
}

/** Dodge the worn armour actually provides, including any Magic Shield boost. */
export function effectiveArmorDodge(gameState, armor) {
    const base = armor?.dodgeChance || 0;
    if (!isDodgeWarded(gameState, armor)) return base;
    return Math.min(0.95, Math.round((base + MAGIC_SHIELD_DODGE_BONUS) * 100) / 100);
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

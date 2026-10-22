// A reflection charge is spent only by a damaging enemy attack, never a
// skipped turn or poison tick. Bone Shield resolves first and preserves it.
export function consumeBriarShield(gameState, damage) {
    if (!(damage > 0) || !((gameState?.briarShield || 0) > 0)) return false;
    gameState.briarShield--;
    gameState.riposteReady = true;
    return true;
}

// Shared by gameplay and headless combat: a charge stops one actual attack,
// never an entire volley. Damage-over-time callers do not use this helper.
export function consumeBoneShield(gameState, damage) {
    if (!(damage > 0) || !((gameState?.boneWall || 0) > 0)) return false;
    gameState.boneWall--;
    gameState.riposteReady = true;
    return true;
}

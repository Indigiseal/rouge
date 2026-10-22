import { sigilLevel } from '../sigils/sigils.js';

// Free weapon strikes stay on the surviving target; never retarget a death
// replacement, bone pile or cocoon. Callers guard their shared no-chain flag.
export function canRepeatStrike(scene, weapon, target, damageDealt, sigilId) {
    return damageDealt > 0 && scene?.gameState?.playerHealth > 0
        && sigilLevel(weapon, sigilId) > 0 && target?.revealed
        && ['enemy', 'eliteEnemy', 'boss'].includes(target.data?.type)
        && target.data.health > 0 && !target.data.isBonePile && !target.data.isCocoon
        && !target.data.features?.includes('cocoon_shell')
        && (scene.cardSystem?.boardCards || []).includes(target);
}

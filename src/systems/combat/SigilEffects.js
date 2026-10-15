// systems/combat/SigilEffects.js
// What the player's sigils do in a fight (first pass: Merciless, Hunter,
// Honed, Regenerate; Thorns is the Briar Room bonus, already in the card's
// damage). The catalog — names, icons, rule texts — is content/sigils/sigils.js.
//
// Multipliers are x1.5 and round down (docs/SIGILS.md). Several sigils on one
// swing multiply in turn: Merciless and Hunter together are x1.5 x1.5.

import { SIGIL_MULTIPLIER, sigilLevel } from '../../content/sigils/sigils.js';

// Honed: +1 damage per earlier use of this card in the same fight, per level.
const HONED_PER_USE = 1;
// Regenerate: HP healed at the end of each enemy turn, per level.
const REGENERATE_PER_LEVEL = 1;

const multiply = (damage) => Math.floor(damage * SIGIL_MULTIPLIER);

// Honed counts uses per fight; a new floor is a new fight.
function honedUses(scene, weapon) {
    const floor = scene?.gameState?.currentFloor ?? 0;
    if (weapon.honedFloor !== floor) return 0;
    return weapon.honedUses || 0;
}

/**
 * The swing's damage after the weapon's sigils, against `targetCard` (a board
 * card). Returns { damage, triggered: ['merciless', ...] } — the sigils that
 * changed it, for feedback.
 */
export function applyWeaponSigils(scene, weapon, targetCard, damage) {
    const triggered = [];
    if (!weapon || !targetCard?.data) return { damage, triggered };
    let out = damage;

    if (sigilLevel(weapon, 'merciless') > 0) {
        const hp = targetCard.data.health ?? 0;
        const max = Math.max(1, targetCard.data.maxHealth || hp || 1);
        if (hp <= max / 2) {
            out = multiply(out);
            triggered.push('merciless');
        }
    }
    if (sigilLevel(weapon, 'hunter') > 0 && scene?._sigilLastTarget && scene._sigilLastTarget === targetCard) {
        out = multiply(out);
        triggered.push('hunter');
    }
    const honed = sigilLevel(weapon, 'honed');
    if (honed > 0) {
        const bonus = honedUses(scene, weapon) * HONED_PER_USE * honed;
        if (bonus > 0) {
            out += bonus;
            triggered.push('honed');
        }
    }
    return { damage: out, triggered };
}

/** After a swing lands: Hunter remembers the target, Honed counts the use. */
export function recordWeaponSigilUse(scene, weapon, targetCard) {
    if (!scene || !weapon) return;
    scene._sigilLastTarget = targetCard || null;
    if (sigilLevel(weapon, 'honed') > 0) {
        const floor = scene.gameState?.currentFloor ?? 0;
        weapon.honedUses = honedUses(scene, weapon) + 1;
        weapon.honedFloor = floor;
    }
}

/** HP Regenerate gives at the end of an enemy turn: every carried card plus worn armor. */
export function regenerateAmount(scene) {
    const gs = scene?.gameState;
    if (!gs) return 0;
    const cards = [...(scene.inventorySystem?.slots || gs.inventory || []), gs.equippedArmor];
    return cards.reduce((sum, card) => sum + sigilLevel(card, 'regenerate') * REGENERATE_PER_LEVEL, 0);
}

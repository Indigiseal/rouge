// systems/combat/SigilEffects.js
// What the player's sigils do in a fight. The catalog — names, icons, rule
// texts — is content/sigils/sigils.js; Thorns is the Briar Room bonus, already
// in the card's damage.
//
// Multipliers are x1.5 and round down (docs/SIGILS.md). Several sigils on one
// swing multiply in turn: Merciless and Hunter together are x1.5 x1.5. Flat
// bonuses (Honed, Outnumbered, Ironclad, Packrat) are added before the
// multipliers, so a multiplier also lifts them.

import { SIGIL_MULTIPLIER, sigilLevel } from '../../content/sigils/sigils.js';

// Tuning, all per sigil level unless noted.
const HONED_PER_USE = 1;          // +damage per earlier use this fight
const OUTNUMBERED_PER_ENEMY = 1;  // +damage per open enemy on the board
const PACKRAT_PER_SLOT = 1;       // +damage per empty bag slot
const DESPERATE_BELOW = 0.25;     // share of max HP
const REGENERATE_PER_LEVEL = 1;   // HP at the end of each enemy turn
const LEECH_SHARE = 0.15;         // of the damage dealt, rounded up
const VENOM_DAMAGE = 1;           // poison per tick
const VENOM_TURNS = 3;
const CUTPURSE_COINS = 1;         // coins per hit
const ARREST_CHANCE = 0.25;       // flat; levels add 0.1 each
const DEVOURING_CHANCE = 0.08;    // per level, non-bosses only
const TEMPERED_SAVE = 0.3;        // per level, chance a pip is kept (max 0.9)

const multiply = (damage) => Math.floor(damage * SIGIL_MULTIPLIER);

// Honed counts uses per fight; a new floor is a new fight.
function honedUses(scene, weapon) {
    const floor = scene?.gameState?.currentFloor ?? 0;
    if (weapon.honedFloor !== floor) return 0;
    return weapon.honedUses || 0;
}

function openEnemyCount(scene) {
    const cs = scene?.cardSystem;
    return (cs?.boardCards || []).filter((card) => cs.isOpenEnemyCard?.(card) && (card.data?.health || 0) > 0).length;
}

function emptyBagSlots(scene) {
    const slots = scene?.inventorySystem?.slots || scene?.gameState?.inventory || [];
    return slots.filter((card) => !card).length;
}

function wornArmorProtection(scene) {
    const armor = scene?.gameState?.equippedArmor;
    return Math.max(0, Number(armor?.protection) || 0);
}

/**
 * The swing's damage after the weapon's sigils, against `targetCard` (a board
 * card). Returns { damage, baseDamage, triggered: ['merciless', ...] } —
 * baseDamage is the swing before sigils (what Tandem compares next time),
 * triggered the sigils that changed it, for feedback.
 */
export function applyWeaponSigils(scene, weapon, targetCard, damage) {
    const triggered = [];
    if (!weapon || !targetCard?.data) return { damage, triggered };
    const gs = scene?.gameState;
    const hp = targetCard.data.health ?? 0;
    const maxHp = Math.max(1, targetCard.data.maxHealth || hp || 1);
    const heroHp = gs?.playerHealth ?? 0;
    const heroMax = Math.max(1, gs?.maxHealth || 1);
    let out = damage;

    // Flat bonuses first.
    const honed = sigilLevel(weapon, 'honed');
    if (honed > 0) {
        const bonus = honedUses(scene, weapon) * HONED_PER_USE * honed;
        if (bonus > 0) { out += bonus; triggered.push('honed'); }
    }
    const outnumbered = sigilLevel(weapon, 'outnumbered');
    if (outnumbered > 0) {
        const bonus = openEnemyCount(scene) * OUTNUMBERED_PER_ENEMY * outnumbered;
        if (bonus > 0) { out += bonus; triggered.push('outnumbered'); }
    }
    const ironclad = sigilLevel(weapon, 'ironclad');
    if (ironclad > 0) {
        const bonus = wornArmorProtection(scene) * ironclad;
        if (bonus > 0) { out += bonus; triggered.push('ironclad'); }
    }
    const packrat = sigilLevel(weapon, 'packrat');
    if (packrat > 0) {
        const bonus = emptyBagSlots(scene) * PACKRAT_PER_SLOT * packrat;
        if (bonus > 0) { out += bonus; triggered.push('packrat'); }
    }

    // Devouring: a chance to end a non-boss outright. HP + armor guarantees
    // the kill while it still goes through the normal hit and death pipeline.
    const devouring = sigilLevel(weapon, 'devouring');
    if (devouring > 0 && targetCard.data.type !== 'boss' && Math.random() < DEVOURING_CHANCE * devouring) {
        out = Math.max(out, hp + Math.max(0, targetCard.data.armor || 0));
        triggered.push('devouring');
        return { damage: out, baseDamage: damage, triggered };
    }

    // Then the x1.5 conditions.
    const conditions = [
        ['merciless', () => hp <= maxHp / 2],
        ['ambush', () => hp >= maxHp],
        ['unscathed', () => heroHp >= heroMax],
        ['desperate', () => heroHp < heroMax * DESPERATE_BELOW],
        ['hunter', () => !!scene?._sigilLastTarget && scene._sigilLastTarget === targetCard],
        ['combo', () => !!scene?._sigilLastWeaponHadCombo],
        // Tandem compares the swing before any sigil touched it, so the order
        // sigils apply in never changes whether it fires.
        ['tandem', () => Number.isFinite(scene?._sigilLastDamage) && scene._sigilLastDamage === damage],
    ];
    for (const [id, test] of conditions) {
        if (sigilLevel(weapon, id) > 0 && test()) {
            out = multiply(out);
            triggered.push(id);
        }
    }
    return { damage: out, baseDamage: damage, triggered };
}

/**
 * After a swing lands: the on-hit sigils (Leech, Venom, Cutpurse, Arrest)
 * act on the struck enemy, then Hunter, Combo, Tandem and Honed remember the
 * swing. `damageDealt` is the HP it actually took; `swingDamage` the swing
 * before sigils (applyWeaponSigils' baseDamage), which Tandem compares. Returns the on-hit sigils that fired, for feedback.
 */
export function onWeaponSigilHit(scene, weapon, targetCard, { damageDealt = 0, swingDamage = 0 } = {}) {
    const fired = [];
    if (!scene || !weapon) return fired;
    const gs = scene.gameState;
    const cs = scene.cardSystem;
    const alive = targetCard?.data && (targetCard.data.health || 0) > 0 && targetCard.sprite?.scene;

    const leech = sigilLevel(weapon, 'leech');
    if (leech > 0 && damageDealt > 0 && gs && gs.playerHealth < gs.maxHealth) {
        const heal = Math.ceil(damageDealt * LEECH_SHARE * leech);
        const before = gs.playerHealth;
        gs.heal?.(heal);
        if (gs.playerHealth > before) {
            scene.createFloatingText?.(scene.playerAvatar.x, scene.playerAvatar.y - 14, `+${gs.playerHealth - before} Leech`, 0x4a884f);
            fired.push('leech');
        }
    }
    const venom = sigilLevel(weapon, 'venom');
    if (venom > 0 && alive) {
        cs?.applyWeaponPoison?.(targetCard, { poisonDamage: VENOM_DAMAGE * venom, poisonTurns: VENOM_TURNS });
        fired.push('venom');
    }
    const cutpurse = sigilLevel(weapon, 'cutpurse');
    if (cutpurse > 0 && gs) {
        const coins = CUTPURSE_COINS * cutpurse;
        gs.coins = (gs.coins || 0) + coins;
        if (targetCard?.sprite) scene.playCurrencyGainFlight?.(targetCard.sprite.x, targetCard.sprite.y, 'coins');
        scene.updateUI?.();
        fired.push('cutpurse');
    }
    const arrest = sigilLevel(weapon, 'arrest');
    if (arrest > 0 && alive && targetCard.data.type !== 'boss'
        && Math.random() < ARREST_CHANCE + 0.1 * (arrest - 1)) {
        targetCard.data.frozen = Math.max(targetCard.data.frozen || 0, 1);
        cs?.attachFrozenFrame?.(targetCard);
        scene.createFloatingText?.(targetCard.sprite.x, targetCard.sprite.y - 18, 'Arrested!', 0x71b1ae);
        fired.push('arrest');
    }

    // Smoke: a kill hides another standing enemy (the Smoke Screen enchant's move).
    if (sigilLevel(weapon, 'smoke') > 0 && targetCard?.data && (targetCard.data.health || 0) <= 0) {
        cs?.applyWeaponEnchantOnKill?.('smokeScreen');
        fired.push('smoke');
    }

    // Remember this swing for the sequencing sigils.
    scene._sigilLastTarget = targetCard || null;
    scene._sigilLastWeaponHadCombo = sigilLevel(weapon, 'combo') > 0;
    scene._sigilLastDamage = swingDamage;
    if (sigilLevel(weapon, 'honed') > 0) {
        weapon.honedUses = honedUses(scene, weapon) + 1;
        weapon.honedFloor = gs?.currentFloor ?? 0;
    }
    return fired;
}

/** Chance, from Tempered, that `card` keeps the pip it would spend. */
export function temperedSaveChance(card) {
    return Math.min(0.9, sigilLevel(card, 'tempered') * TEMPERED_SAVE);
}

/**
 * Mirror on the worn armor: reflects the first enemy attack each fight, one
 * more per level. Returns true (and uses a charge) when this attack bounces.
 */
export function consumeMirrorSigil(scene) {
    const gs = scene?.gameState;
    const level = sigilLevel(gs?.equippedArmor, 'mirror');
    if (!gs || level <= 0) return false;
    const floor = gs.currentFloor ?? 0;
    if (gs.mirrorSigilFloor !== floor) {
        gs.mirrorSigilFloor = floor;
        gs.mirrorSigilUses = 0;
    }
    if ((gs.mirrorSigilUses || 0) >= level) return false;
    gs.mirrorSigilUses = (gs.mirrorSigilUses || 0) + 1;
    return true;
}

/** HP Regenerate gives at the end of an enemy turn: every carried card plus worn armor. */
export function regenerateAmount(scene) {
    const gs = scene?.gameState;
    if (!gs) return 0;
    const cards = [...(scene.inventorySystem?.slots || gs.inventory || []), gs.equippedArmor];
    return cards.reduce((sum, card) => sum + sigilLevel(card, 'regenerate') * REGENERATE_PER_LEVEL, 0);
}

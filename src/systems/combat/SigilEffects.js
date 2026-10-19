// systems/combat/SigilEffects.js
// What the player's sigils do in a fight. The catalog — names, icons, rule
// texts — is content/sigils/sigils.js; Thorns is the Briar Room bonus, already
// in the card's damage.
//
// Multipliers are x1.5 and round down (docs/SIGILS.md). Several sigils on one
// swing multiply in turn: Merciless and Hunter together are x1.5 x1.5. Flat
// bonuses (Honed, Outnumbered, Ironclad, Packrat) are added before the
// multipliers, so a multiplier also lifts them.

import { SoundHelper } from '../../audio/SoundHelper.js';
import { SIGIL_MULTIPLIER, hasStoredSigil, sigilLevel } from '../../content/sigils/sigils.js';
import { ENCHANT_FIREBALL_CHANCE, ENCHANT_SAPPING_CHANCE } from '../../content/balance/WeaponEnchants.js';

// Tuning, all per sigil level unless noted.
const HONED_PER_USE = 1;          // +damage per earlier use this fight
const BLOODLUST_PER_KILL = 1;     // +damage per kill this weapon made this fight
const OUTNUMBERED_PER_ENEMY = 1;  // +damage per open enemy on the board
const PACKRAT_PER_SLOT = 1;       // +damage per empty bag slot
const KINSHIP_BONUS = 1;          // +damage from each Kinship card beside the weapon
const DESPERATE_BELOW = 0.25;     // share of max HP
const REGENERATE_PER_LEVEL = 1;   // HP at the end of each enemy turn
const LEECH_SHARE = 0.15;         // of the damage dealt, rounded up
const VENOM_DAMAGE = 1;           // poison per tick
const VENOM_TURNS = 3;
const CUTPURSE_COINS = 1;         // coins per hit
const FROST_CHANCE = 0.25;        // non-bosses
const KEEN_CRIT = 0.05;           // added to the crit roll (a crit is x1.5)
const RANSOM_CHANCE = 0.1;        // a crystal on a kill
const CRYSTAL_BROOD_CRYSTAL_CHANCE = 0.15; // Crystal Brood: a crystal on a kill
const BOUNTY_COINS = 2;           // coins on a kill
const FIREBALL_SHARE = 0.5;       // of the swing, rounded down
const FIREBALL_MINIMUM = 3;
const FIREBALL_FLIGHT_MS = 320;
const TSUNAMI_CHANCE = 0.1;       // on hit
const TSUNAMI_DAMAGE = 3;         // to every face-up enemy
const DEVOURING_CHANCE = 0.08;    // per level, non-bosses only
const TEMPERED_SAVE = 0.3;        // per level, chance a pip is kept (max 0.9)
const WARCRY_CHANCE = 0.1;        // per level, an ally acts twice (max 0.5)
const RIPOSTE_BONUS = 2;          // next hit after a block
const MENDING_CHANCE = 0.1;       // on hit
const MENDING_PIPS = 2;           // after the swing's own pip, so it reads +2
const SECOND_WIND_CHANCE = 0.1;   // on hit
const SECOND_WIND_AP = 2;         // after the swing's own AP, so it reads +2
const SCOUT_CHANCE = 0.15;        // on hit
const CHARM_CHANCE = 0.15;        // on hit, non-bosses
const SUNDER_ARMOR = 1;           // armor off the enemy hit, every hit
const DAZE_CHANCE = 0.2;          // on hit, non-bosses: misses its next attack
const CRUSHING_CHANCE = 0.15;     // x1.5 and through armor
const FLEETFOOT_DODGE = 0.1;      // on the worn armor
const WARDING_CHANCE = 0.2;       // on hit: the Magic Shield buff

const multiply = (damage) => Math.floor(damage * SIGIL_MULTIPLIER);

// Honed counts uses per fight; a new floor is a new fight.
// Bloodlust counts this weapon's kills per fight, the same way.
function bloodlustKills(scene, weapon) {
    const floor = scene?.gameState?.currentFloor ?? 0;
    if (weapon.bloodlustFloor !== floor) return 0;
    return weapon.bloodlustKills || 0;
}

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

// Kinship: the cards in the bag slots right beside `weapon` that carry it.
function kinshipNeighbours(scene, weapon) {
    const slots = scene?.inventorySystem?.slots || scene?.gameState?.inventory || [];
    const at = slots.indexOf(weapon);
    if (at < 0) return 0;
    return [slots[at - 1], slots[at + 1]].filter((card) => card && sigilLevel(card, 'kinship') > 0).length;
}

function wornArmorProtection(scene) {
    const armor = scene?.gameState?.equippedArmor;
    return Math.max(0, Number(armor?.protection) || 0);
}

/**
 * The weapon's flat sigil bonuses right now, which don't depend on the enemy
 * hit: Bloodlust, Honed, Outnumbered, Kinship, Ironclad, Packrat. The swing
 * adds them, and the card's damage number shows them, so the two agree.
 * Returns { bonus, ids }.
 */
export function weaponFlatSigilBonus(scene, weapon) {
    const ids = [];
    let bonus = 0;
    if (!weapon) return { bonus, ids };
    const add = (id, amount) => { if (amount > 0) { bonus += amount; ids.push(id); } };
    if (sigilLevel(weapon, 'bloodlust') > 0) add('bloodlust', bloodlustKills(scene, weapon) * BLOODLUST_PER_KILL);
    const honed = sigilLevel(weapon, 'honed');
    if (honed > 0) add('honed', honedUses(scene, weapon) * HONED_PER_USE * honed);
    const outnumbered = sigilLevel(weapon, 'outnumbered');
    if (outnumbered > 0) add('outnumbered', openEnemyCount(scene) * OUTNUMBERED_PER_ENEMY * outnumbered);
    add('kinship', kinshipNeighbours(scene, weapon) * KINSHIP_BONUS);
    const ironclad = sigilLevel(weapon, 'ironclad');
    if (ironclad > 0) add('ironclad', wornArmorProtection(scene) * ironclad);
    const packrat = sigilLevel(weapon, 'packrat');
    if (packrat > 0) add('packrat', emptyBagSlots(scene) * PACKRAT_PER_SLOT * packrat);
    if (sigilLevel(weapon, 'riposte') > 0 && scene?.gameState?.riposteReady) add('riposte', RIPOSTE_BONUS);
    return { bonus, ids };
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

    // Flat bonuses first (the same ones the card's number shows).
    const flat = weaponFlatSigilBonus(scene, weapon);
    out += flat.bonus;
    triggered.push(...flat.ids);

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

    // Crushing: a chance of a heavy hit, x1.5 and straight through armor
    // (adding the armor back, as Devouring does, keeps the normal hit
    // pipeline). Only the sigil put on the card: a Shadow Blade enchant
    // shows Crushing but hits by its own rule.
    if (hasStoredSigil(weapon, 'crushing') && Math.random() < CRUSHING_CHANCE) {
        out = multiply(out) + Math.max(0, targetCard.data.armor || 0);
        triggered.push('crushing');
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
    // Frost: a chance to freeze the enemy hit for its next turn. Only the
    // sigil put on the card — a Frost Ring enchant freezes by its own rule.
    if (hasStoredSigil(weapon, 'frost') && alive && targetCard.data.type !== 'boss'
        && !(targetCard.data.frozen > 0) && Math.random() < FROST_CHANCE) {
        targetCard.data.frozen = 1;
        cs?.attachFrozenFrame?.(targetCard);
        scene.createFloatingText?.(targetCard.sprite.x, targetCard.sprite.y - 18, 'Frozen!', 0x71b1ae);
        fired.push('frost');
    }

    // Sapping: a chance the enemy hit is weaker for its next attack only
    // (enemyAttack.js applies it, the turn controller spends it). The sigil
    // and the Reliquary's Weakness enchant are the same rule.
    if (sigilLevel(weapon, 'sapping') > 0 && alive && !targetCard.data.sapped
        && Math.random() < ENCHANT_SAPPING_CHANCE) {
        targetCard.data.sapped = true;
        cs?.updateEnemyInfoText?.(targetCard);
        scene.createFloatingText?.(targetCard.sprite.x, targetCard.sprite.y - 30, 'Sapped!', 0x712a65);
        fired.push('sapping');
    }

    // Sunder: every hit that lands takes armor off the enemy hit, for good.
    if (sigilLevel(weapon, 'sunder') > 0 && alive && damageDealt > 0 && (targetCard.data.armor || 0) > 0) {
        targetCard.data.armor = Math.max(0, targetCard.data.armor - SUNDER_ARMOR);
        cs?.updateEnemyInfoText?.(targetCard);
        scene.createFloatingText?.(targetCard.sprite.x, targetCard.sprite.y - 42, `-${SUNDER_ARMOR} armor`, 0xafafa2);
        fired.push('sunder');
    }
    // Daze: a chance the enemy hit (not a boss) misses its next attack
    // (CombatTurnController spends it). Shown grey until then.
    if (sigilLevel(weapon, 'daze') > 0 && alive && targetCard.data.type !== 'boss'
        && !targetCard.data.dazed && Math.random() < DAZE_CHANCE) {
        targetCard.data.dazed = true;
        scene.createFloatingText?.(targetCard.sprite.x, targetCard.sprite.y - 30, 'Dazed!', 0xafafa2);
        fired.push('daze');
    }
    // Warding: a chance to raise the hero's armor for a turn, the Magic
    // Shield enchant's buff. Only the sigil put on the card: the enchant
    // rolls its own.
    if (hasStoredSigil(weapon, 'warding') && damageDealt > 0 && cs?.applyWeaponEnchantOnHit
        && Math.random() < WARDING_CHANCE) {
        cs.applyWeaponEnchantOnHit(Math.max(0, (cs.boardCards || []).indexOf(targetCard)), 'magicShield', swingDamage);
        fired.push('warding');
    }

    // Charm: a chance the enemy hit (not a boss) turns on its own side for
    // its next attack (CombatTurnController spends it). StatusOverlay
    // shows it pink until then.
    if (sigilLevel(weapon, 'charm') > 0 && alive && targetCard.data.type !== 'boss'
        && !targetCard.data.charmed && Math.random() < CHARM_CHANCE) {
        targetCard.data.charmed = true;
        scene.createFloatingText?.(targetCard.sprite.x, targetCard.sprite.y - 30, 'Charmed!', 0xa83c69);
        fired.push('charm');
    }

    // Kill rewards: Ransom (a chance of a crystal), Bounty (coins), and
    // Bloodlust's streak: each kill in a row adds one; a hit that doesn't
    // kill breaks it.
    const killed = targetCard?.data && (targetCard.data.health || 0) <= 0;
    if (sigilLevel(weapon, 'bloodlust') > 0) {
        const before = bloodlustKills(scene, weapon);
        weapon.bloodlustKills = killed ? before + 1 : 0;
        weapon.bloodlustFloor = gs?.currentFloor ?? 0;
        if (killed) {
            if (targetCard.sprite) scene.createFloatingText?.(targetCard.sprite.x, targetCard.sprite.y - 42, `Bloodlust +${weapon.bloodlustKills}`, 0xb51f1e);
            fired.push('bloodlust');
        } else if (before > 0) {
            streakBroken(scene, targetCard, 'Bloodlust');
        }
    }
    if (killed && gs && sigilLevel(weapon, 'ransom') > 0 && Math.random() < RANSOM_CHANCE) {
        gs.crystals = (gs.crystals || 0) + 1;
        if (targetCard.sprite) scene.playCurrencyGainFlight?.(targetCard.sprite.x, targetCard.sprite.y, 'crystals');
        scene.updateUI?.();
        fired.push('ransom');
    }
    // Crystal Brood (the Crystal Lair's sigil): a kill opens a hidden card,
    // and sometimes leaves a crystal.
    if (killed && gs && sigilLevel(weapon, 'crystalBrood') > 0) {
        const opened = scoutOneCard(scene);
        let crystal = false;
        if (Math.random() < CRYSTAL_BROOD_CRYSTAL_CHANCE) {
            gs.crystals = (gs.crystals || 0) + 1;
            if (targetCard.sprite) scene.playCurrencyGainFlight?.(targetCard.sprite.x, targetCard.sprite.y, 'crystals');
            scene.updateUI?.();
            crystal = true;
        }
        if (opened || crystal) fired.push('crystalBrood');
    }
    if (killed && gs && sigilLevel(weapon, 'bounty') > 0) {
        gs.coins = (gs.coins || 0) + BOUNTY_COINS;
        if (targetCard.sprite) scene.playCurrencyGainFlight?.(targetCard.sprite.x, targetCard.sprite.y, 'coins');
        scene.updateUI?.();
        fired.push('bounty');
    }

    // Fireball: a chance to throw one at another random face-up enemy
    // (bosses too). The sigil and the Reliquary's Fireball enchant are the
    // same rule, rolled here once.
    if (sigilLevel(weapon, 'fireball') > 0 && Math.random() < ENCHANT_FIREBALL_CHANCE
        && throwFireball(scene, targetCard, swingDamage)) {
        fired.push('fireball');
    }

    // Tsunami: a chance that a wave crashes over the whole board.
    if (sigilLevel(weapon, 'tsunami') > 0 && Math.random() < TSUNAMI_CHANCE) {
        crashTsunami(scene);
        fired.push('tsunami');
    }

    // Smoke: a kill hides another standing enemy (the Smoke Screen enchant's
    // move). Only the sigil put on the card: a Smoke Screen enchant already
    // does this itself, and counting it here hid two enemies per kill.
    if (hasStoredSigil(weapon, 'smoke') && targetCard?.data && (targetCard.data.health || 0) <= 0) {
        cs?.applyWeaponEnchantOnKill?.('smokeScreen');
        fired.push('smoke');
    }

    // Mending and Second Wind: the swing has already spent its pip and its
    // AP, so +2 shows as +2 and leaves the hero one up. Neither goes past
    // the cap, and a weapon that just broke stays broken.
    if (damageDealt > 0 && sigilLevel(weapon, 'mending') > 0 && weapon.durability > 0
        && Math.random() < MENDING_CHANCE) {
        const max = weapon.maxDurability || weapon.durability;
        const gained = Math.max(0, Math.min(max, weapon.durability + MENDING_PIPS) - weapon.durability);
        if (gained > 0) {
            weapon.durability += gained;
            scene.createFloatingText?.(scene.playerAvatar.x, scene.playerAvatar.y + 18, `+${gained} pips (Mending)`, 0xd6c2c1);
            scene.updateUI?.();
            fired.push('mending');
        }
    }
    if (damageDealt > 0 && gs && sigilLevel(weapon, 'secondWind') > 0 && Math.random() < SECOND_WIND_CHANCE) {
        const before = gs.actionsLeft || 0;
        gs.actionsLeft = Math.min(gs.maxActions, before + SECOND_WIND_AP);
        if (gs.actionsLeft > before) {
            scene.createFloatingText?.(scene.playerAvatar.x, scene.playerAvatar.y - 28, `+${gs.actionsLeft - before} AP (Second Wind)`, 0x71b1ae);
            scene.updateUI?.();
            fired.push('secondWind');
        }
    }
    // Scout: opens one face-down card that is neither an enemy nor a trap.
    if (damageDealt > 0 && sigilLevel(weapon, 'scout') > 0 && Math.random() < SCOUT_CHANCE && scoutOneCard(scene)) {
        fired.push('scout');
    }
    // Riposte: the block's +2 is spent on this swing, hit or miss.
    if (gs?.riposteReady && sigilLevel(weapon, 'riposte') > 0) gs.riposteReady = false;

    // Remember this swing for the sequencing sigils.
    scene._sigilLastTarget = targetCard || null;
    scene._sigilLastWeaponHadCombo = sigilLevel(weapon, 'combo') > 0;
    scene._sigilLastDamage = swingDamage;
    // Honed's streak: each hit that lands adds one; a miss (evaded, immune,
    // or no damage through) breaks it.
    if (sigilLevel(weapon, 'honed') > 0) {
        const before = honedUses(scene, weapon);
        weapon.honedUses = damageDealt > 0 ? before + 1 : 0;
        weapon.honedFloor = gs?.currentFloor ?? 0;
        if (damageDealt <= 0 && before > 0) streakBroken(scene, targetCard, 'Honed');
    }
    return fired;
}

// A Honed or Bloodlust streak just ended: say so over the enemy.
function streakBroken(scene, targetCard, name) {
    const sprite = targetCard?.sprite;
    if (!sprite) return;
    scene.createFloatingText?.(sprite.x, sprite.y - 54, `${name} lost`, 0xafafa2);
}

// Scout: turns over one random face-down card that is not an enemy, a boss,
// a trap or a mimic, as a free reveal (no enemy turn, nothing sprung).
// Returns false when there is none left to open.
function scoutOneCard(scene) {
    const cs = scene?.cardSystem;
    if (!cs?.revealCard) return false;
    const hidden = (cs.boardCards || [])
        .map((card, index) => ({ card, index }))
        .filter(({ card }) => card && !card.revealed && card.data && !card.data.isMimic
            && !card.data.tutorialDormant && card.data.type !== 'trap'
            && !cs.isEnemyType?.(card.data.type));
    if (hidden.length === 0) return false;
    const { card, index } = hidden[Math.floor(Math.random() * hidden.length)];
    cs.revealCard(index, true);
    if (card.sprite) scene.createFloatingText?.(card.sprite.x, card.sprite.y - 30, 'Scout!', 0xffcf7f);
    return true;
}

/** Fleetfoot on the worn armor: the chance it dodges a hit outright. */
export function fleetfootDodgeChance(gameState) {
    return sigilLevel(gameState?.equippedArmor, 'fleetfoot') > 0 ? FLEETFOOT_DODGE : 0;
}

/** Keen: the crit chance a weapon adds to the shared crit roll. */
export function keenCritChance(weapon) {
    return sigilLevel(weapon, 'keen') > 0 ? KEEN_CRIT : 0;
}

// Fireball: picks a random face-up enemy other than the one just hit (a
// taunting enemy, while one stands, is the only fair pick), flies there and
// bursts for half the swing. Returns false when there is no one to throw at.
function throwFireball(scene, struckCard, swingDamage) {
    const cs = scene?.cardSystem;
    if (!cs || !scene.add) return false;
    const targets = (cs.boardCards || [])
        .map((card, index) => ({ card, index }))
        .filter(({ card }) => card !== struckCard && cs.isOpenEnemyCard?.(card)
            && (card.data?.health || 0) > 0 && card.sprite?.scene
            && !cs.isTauntBlockingTarget?.(card));
    if (targets.length === 0) return false;
    const { card, index } = targets[Math.floor(Math.random() * targets.length)];
    const damage = Math.max(FIREBALL_MINIMUM, Math.floor((swingDamage || 0) * FIREBALL_SHARE));
    const fromX = struckCard?.sprite?.x ?? scene.playerAvatar?.x ?? 320;
    const fromY = struckCard?.sprite?.y ?? scene.playerAvatar?.y ?? 300;
    SoundHelper.playSound(scene, 'fireball_whoosh', 0.5);
    const land = () => {
        if (cs.boardCards[index] !== card || (card.data?.health || 0) <= 0 || !card.sprite?.scene) return;
        scene.inventorySystem?.createFireballEffect?.(card.sprite);
        cs.damageGemTarget(index, damage, 'Fireball', 0xef7c4b, null, 'hit');
    };
    if (!scene.textures?.exists?.('fireBall1')) {
        scene.time.delayedCall(FIREBALL_FLIGHT_MS, land);
        return true;
    }
    const ball = scene.add.image(fromX, fromY, 'fireBall1').setDepth(2400);
    scene.tweens.add({
        targets: ball, x: card.sprite.x, y: card.sprite.y, duration: FIREBALL_FLIGHT_MS, ease: 'Quad.easeIn',
        onComplete: () => { ball.destroy(); land(); },
    });
    return true;
}

// Tsunami: a wave sweeps the board left to right (placeholder look: a
// see-through band of water until its art exists), hitting every face-up
// enemy as it passes.
function crashTsunami(scene) {
    const cs = scene?.cardSystem;
    if (!cs || !scene.add) return;
    SoundHelper.playSound(scene, 'magic_cast', 0.5);
    scene.createFloatingText?.(320, 70, 'Tsunami!', 0x71b1ae);
    const wave = scene.add.rectangle(-80, 150, 120, 250, 0x71b1ae, 0.35).setDepth(2400);
    scene.tweens.add({ targets: wave, x: 720, duration: 650, ease: 'Sine.easeIn', onComplete: () => wave.destroy() });
    (cs.boardCards || []).forEach((card, i) => {
        if (!cs.isOpenEnemyCard?.(card) || (card.data?.health || 0) <= 0 || !card.sprite) return;
        // Each enemy is hit as the wave reaches it.
        const delay = Math.max(0, ((card.sprite.x + 80) / 800) * 650);
        scene.time.delayedCall(delay, () => {
            if (cs.boardCards[i] === card && (card.data?.health || 0) > 0) {
                cs.damageGemTarget(i, TSUNAMI_DAMAGE, 'Wave', 0x71b1ae, null, 'hit');
            }
        });
    });
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

/**
 * Warcry on the player's side: carried in the bag or worn, it gives each
 * companion that attacked this chance to attack again.
 */
export function playerWarcryChance(scene) {
    const gs = scene?.gameState;
    if (!gs) return 0;
    const cards = [...(scene.inventorySystem?.slots || gs.inventory || []), gs.equippedArmor];
    const level = cards.reduce((sum, card) => sum + sigilLevel(card, 'warcry'), 0);
    return Math.min(0.5, level * WARCRY_CHANCE);
}

/**
 * Warcry on the enemy side: every other living, face-up enemy carrying it adds
 * to the chance that `card` acts twice. Returns { chance, source } — source is
 * a carrier, for the shout's float.
 */
export function enemyWarcryChance(boardCards, card, isEnemyCard) {
    let level = 0;
    let source = null;
    (boardCards || []).forEach((other) => {
        if (!other || other === card || !other.revealed || (other.data?.health || 0) <= 0) return;
        if (isEnemyCard && !isEnemyCard(other)) return;
        const l = sigilLevel(other.data, 'warcry');
        if (l > 0) { level += l; source = source || other; }
    });
    return { chance: Math.min(0.5, level * WARCRY_CHANCE), source };
}

/** HP Regenerate gives at the end of an enemy turn: every carried card plus worn armor. */
export function regenerateAmount(scene) {
    const gs = scene?.gameState;
    if (!gs) return 0;
    const cards = [...(scene.inventorySystem?.slots || gs.inventory || []), gs.equippedArmor];
    return cards.reduce((sum, card) => sum + sigilLevel(card, 'regenerate') * REGENERATE_PER_LEVEL, 0);
}

import { CombatSequencer } from './CombatSequencer.js';
import { effectiveArmorDodge, effectiveArmorProtection } from './ArmorMath.js';

/** Ranged enemy hits (archers). Bosses count as melee, same as thorns. */
export function isEnemyRangedAttack(card) {
    const data = card?.data;
    if (!data) return false;
    if (data.type === 'boss') return false;
    return data.role === 'RANGED' || data.isRangedType === true;
}

/**
 * Resolve damage dealt to the player (dodge, armor, reflection, lethal prevention).
 * Mutates gameState; VFX goes through scene callbacks already on GameState.scene.
 * Does not change save-field shapes.
 *
 * @param {object} [options]
 * @param {boolean} [options.ignoreArmor] Force-skip equipped armor DEF + durability.
 * @param {number} [options.ignoreArmorChance] After hit/miss resolved, chance to ignore armor.
 */
export function resolvePlayerDamage(gameState, amount, enemyIndex = -1, source = 'enemy', armorPierce = 0, options = {}) {
    const scene = gameState.scene;
    // Poison is internal — armor plating doesn't stop it and doesn't wear out
    // blocking it. Dodge still applies (you can shrug off a tick), but it must
    // not cost durability either, or leather bleeds a pip every poison turn.
    const isPoison = source === 'poison';

    if (source === 'poison' && (
        gameState.relicEffects?.poisonImmunity
        || scene?.amuletManager?.isPoisonImmune?.()
    )) {
        if (scene?.playerAvatar) {
            scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y, 'Poison Immune!', 0x66ff66);
        }
        return {
            actualDamage: 0,
            tookDamage: false,
            blockedDamage: 0,
            dodgedDamage: 0,
            dodged: false
        };
    }

    // Shadow Step: a depth accumulator, so it is small early and real deep.
    // Rolled alongside the amulet dodge rather than folded into it so the
    // floating text can tell the player which one saved them.
    const talentDodge = gameState.talentEffects?.shadowStepDodge || 0;
    if (!isPoison && talentDodge > 0 && Math.random() < talentDodge) {
        if (gameState.equippedArmor) gameState.tickEquippedArmorDurability();
        scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y, 'Shadow Step!', 0x88ffcc);
        return {
            actualDamage: 0, tookDamage: false, blockedDamage: 0,
            dodgedDamage: Math.max(0, amount || 0), dodged: true,
        };
    }

    // Check for dodge (from amulets)
    if (scene.amuletManager && scene.amuletManager.checkDodge()) {
        if (gameState.equippedArmor && !isPoison) gameState.tickEquippedArmorDurability();
        scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y, 'Dodged!', 0x00ff00);
        return {
            actualDamage: 0,
            tookDamage: false,
            blockedDamage: 0,
            dodgedDamage: Math.max(0, amount || 0),
            dodged: true
        };
    }

    // Modify damage taken (cursed amulets, protection amulets, …)
    if (scene.amuletManager) {
        amount = scene.amuletManager.modifyDamageTaken(amount);
    }

    const attacker = enemyIndex >= 0 ? scene.cardSystem?.boardCards?.[enemyIndex] : null;
    const attackIsRanged = isEnemyRangedAttack(attacker);
    const attackIsMelee = attacker?.data && !attackIsRanged;

    let protection = 0;
    let reflectedDamage = 0;
    let ignoreArmor = Boolean(options?.ignoreArmor);
    const ignoreArmorChance = Math.max(0, Number(options?.ignoreArmorChance) || 0);

    if (gameState.equippedArmor) {
        // Handle Dodge from equipped armor — durability ticks on dodge.
        const armorDodge = effectiveArmorDodge(gameState, gameState.equippedArmor);
        if (armorDodge > 0 && Math.random() < armorDodge) {
            scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y, 'Dodge!', 0x00ff00);
            if (!isPoison) gameState.tickEquippedArmorDurability();
            return {
                actualDamage: 0,
                tookDamage: false,
                blockedDamage: 0,
                dodgedDamage: Math.max(0, amount || 0),
                dodged: true
            };
        }

        // Plate: chance to fully ignore a ranged attack (costs 1 armor pip).
        const rangedIgnore = gameState.equippedArmor.rangedIgnoreChance || 0;
        if (rangedIgnore > 0 && attackIsRanged && amount > 0 && Math.random() < rangedIgnore) {
            scene.createFloatingText(
                scene.playerAvatar.x, scene.playerAvatar.y, 'Deflect!', 0x88ccff
            );
            gameState.tickEquippedArmorDurability();
            return {
                actualDamage: 0,
                tookDamage: false,
                blockedDamage: 0,
                dodgedDamage: Math.max(0, amount || 0),
                dodged: true
            };
        }
    }

    // Hit confirmed (dodge / plate miss already resolved). Optional armor ignore
    // (Goblin Archer): DEF does not apply and durability does not tick.
    if (
        !ignoreArmor
        && !isPoison
        && ignoreArmorChance > 0
        && amount > 0
        && Math.random() < ignoreArmorChance
    ) {
        ignoreArmor = true;
        if (scene?.playerAvatar) {
            scene.createFloatingText(
                scene.playerAvatar.x,
                scene.playerAvatar.y - 16,
                'Armor ignored!',
                0xffaa66
            );
        }
    }

    if (gameState.equippedArmor && !ignoreArmor) {
        // Add protection from equipped armor (leather is dodge-only: protection 0),
        // including any Magic Shield / Warding boost. Shared with the armor card's
        // displayed number so the two can never disagree.
        protection += effectiveArmorProtection(gameState, gameState.equippedArmor);

        // Handle reflection
        if (gameState.equippedArmor.reflection > 0 && enemyIndex !== -1) {
            reflectedDamage = Math.floor(amount * (gameState.equippedArmor.reflection / 100));

            // Reflection cannot kill bosses
            const enemyCard = scene.cardSystem.boardCards[enemyIndex];
            if (enemyCard && enemyCard.data.type === 'boss') {
                const enemyHealth = enemyCard.data.health;
                reflectedDamage = Math.min(reflectedDamage, enemyHealth - 1);
            }

            if (reflectedDamage > 0) {
                const enemySprite = scene.cardSystem.boardCards[enemyIndex]?.sprite;
                scene.cardSystem.attackEnemy(enemyIndex, reflectedDamage, true);
                if (enemySprite) {
                    CombatSequencer.floatingText(scene, 'reflect',
                        enemySprite.x, enemySprite.y - 20, `-${reflectedDamage} (Reflect)`, 0x00ffff);
                }
            }
        }

        // Durability tick when armor's protection actually absorbs a hit.
        // (Dodge-only leather never enters here — it ticks on dodge above.)
        // Rivets save chance lives inside tickEquippedArmorDurability.
        if (protection > 0 && amount > 0 && !isPoison) {
            gameState.tickEquippedArmorDurability();
        }
    }

    // Trained guard companions provide passive protection while carried.
    protection += scene?.getCompanionProtectionBonus?.() || 0;

    // armor_break (boss ability) pierces some of the player's protection so the
    // hit lands harder. Never turns armor into a damage bonus — just reduces it.
    // Poison bypasses protection outright — plate is no defence against venom.
    const effectiveProtection = isPoison
        ? 0
        : Math.max(0, protection - Math.max(0, armorPierce));
    const actualDamage = Math.max(0, amount - effectiveProtection);
    const blockedDamage = Math.max(0, amount - actualDamage);

    // Reprisal (Iron): always reflect a % of DEF-blocked damage; can kill.
    const reprisalFlat = gameState.talentEffects?.reprisalFlat || 0;
    if (
        reprisalFlat > 0
        && blockedDamage > 0
        && enemyIndex >= 0
        && gameState.equippedArmor
        && (gameState.equippedArmor.protection || 0) > 0
    ) {
        const reprisalDmg = Math.min(reprisalFlat, Math.max(1, blockedDamage));
        if (reprisalDmg > 0) {
            const enemySprite = scene.cardSystem?.boardCards?.[enemyIndex]?.sprite;
            scene.createFloatingText(
                scene.playerAvatar?.x || 0,
                (scene.playerAvatar?.y || 0) - 18,
                'Reprisal!',
                0xaaccff
            );
            scene.cardSystem?.attackEnemy?.(enemyIndex, reprisalDmg, true);
            if (enemySprite) {
                CombatSequencer.floatingText(scene, 'reflect',
                    enemySprite.x, enemySprite.y - 20, `-${reprisalDmg} (Reprisal)`, 0xaaccff);
            }
        }
    }

    // Chain: chance to counter a melee hit for ceil(50% of blocked), no weapon pip.
    const counterChance = gameState.equippedArmor?.meleeCounterChance || 0;
    if (
        counterChance > 0
        && attackIsMelee
        && blockedDamage > 0
        && enemyIndex >= 0
        && Math.random() < counterChance
    ) {
        const counterDmg = Math.ceil(blockedDamage * 0.5);
        if (counterDmg > 0) {
            const enemySprite = scene.cardSystem?.boardCards?.[enemyIndex]?.sprite;
            scene.createFloatingText(
                scene.playerAvatar?.x || 0,
                (scene.playerAvatar?.y || 0) - 12,
                'Counter!',
                0xffaa44
            );
            scene.cardSystem?.attackEnemy?.(enemyIndex, counterDmg, true);
            if (enemySprite) {
                CombatSequencer.floatingText(scene, 'reflect',
                    enemySprite.x, enemySprite.y - 20, `-${counterDmg} (Counter)`, 0xffaa44);
            }
        }
    }

    const wouldKill = gameState.playerHealth - actualDamage <= 0;

    // Check for invulnerability amulet
    if (wouldKill && scene.amuletManager && scene.amuletManager.checkLethalPrevention()) {
        // Cancel all damage this turn
        return {
            actualDamage: 0,
            tookDamage: false,
            blockedDamage: 0,
            dodgedDamage: Math.max(0, amount || 0),
            dodged: true
        };
    }

    gameState.playerHealth = Math.max(0, gameState.playerHealth - actualDamage);
    const tookDamage = actualDamage > 0;

    // Track damage for meta progression
    if (actualDamage > 0) {
        gameState.trackDamage(actualDamage, source, enemyIndex);
    }

    // SINGLE authority for combat death: every lethal hit schedules
    // gameOver() here, so callers must not schedule their own duplicate.
    // (EventScene damage bypasses takeDamage and invokes gameOver()
    // directly on wake — see EventScene.continueAdventure.)
    if (gameState.playerHealth <= 0) {
        // Second Wind: failure currency. Deliberately NOT an accumulator — the
        // worth of not dying does not decay with depth the way a stat bonus
        // does, which is exactly why the branch ends on it.
        const charges = gameState.talentEffects?.secondWindCharges || 0;
        const used = gameState.secondWindUsed || 0;
        if (charges > used) {
            gameState.secondWindUsed = used + 1;
            const healPct = gameState.talentEffects?.secondWindHealPct || 0.25;
            gameState.playerHealth = Math.max(1, Math.ceil(gameState.maxHealth * healPct));
            scene.createFloatingText?.(
                scene.playerAvatar?.x ?? 0, scene.playerAvatar?.y ?? 0,
                'Second Wind!', 0xffdd55
            );
        } else {
            gameState.setDeathCause(source, enemyIndex);
            scene.time.delayedCall(100, () => scene.gameOver());
        }
    }

    return {
        actualDamage,
        tookDamage,
        blockedDamage,
        dodgedDamage: 0,
        dodged: false
    };
}

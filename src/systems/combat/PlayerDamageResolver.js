import { CombatSequencer } from './CombatSequencer.js';

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
 */
export function resolvePlayerDamage(gameState, amount, enemyIndex = -1, source = 'enemy', armorPierce = 0) {
    const scene = gameState.scene;

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

    // Check for dodge (from amulets)
    if (scene.amuletManager && scene.amuletManager.checkDodge()) {
        if (gameState.equippedArmor) gameState.tickEquippedArmorDurability();
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

    if (gameState.equippedArmor) {
        // Handle Dodge from equipped armor — durability ticks on dodge.
        if (gameState.equippedArmor.dodgeChance && Math.random() < gameState.equippedArmor.dodgeChance) {
            scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y, 'Dodge!', 0x00ff00);
            gameState.tickEquippedArmorDurability();
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

        // Add protection from equipped armor (leather is dodge-only: protection 0)
        let baseProtection = gameState.equippedArmor.protection || 0;

        // Apply magic shield bonus (20% increase)
        if (gameState.magicShield && gameState.magicShield.turns > 0 && baseProtection > 0) {
            baseProtection = Math.floor(baseProtection * gameState.magicShield.multiplier);
        }

        protection += baseProtection;

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
        if (protection > 0 && amount > 0) {
            gameState.tickEquippedArmorDurability();
        }
    }

    // Trained guard companions provide passive protection while carried.
    protection += scene?.getCompanionProtectionBonus?.() || 0;

    // armor_break (boss ability) pierces some of the player's protection so the
    // hit lands harder. Never turns armor into a damage bonus — just reduces it.
    const effectiveProtection = Math.max(0, protection - Math.max(0, armorPierce));
    const actualDamage = Math.max(0, amount - effectiveProtection);
    const blockedDamage = Math.max(0, amount - actualDamage);

    // Reprisal (Iron): always reflect a % of DEF-blocked damage; can kill.
    const reprisalPct = gameState.talentEffects?.reprisalReflectPct || 0;
    if (
        reprisalPct > 0
        && blockedDamage > 0
        && enemyIndex >= 0
        && gameState.equippedArmor
        && (gameState.equippedArmor.protection || 0) > 0
    ) {
        const reprisalDmg = Math.floor(blockedDamage * reprisalPct);
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
        gameState.setDeathCause(source, enemyIndex);
        scene.time.delayedCall(100, () => scene.gameOver());
    }

    return {
        actualDamage,
        tookDamage,
        blockedDamage,
        dodgedDamage: 0,
        dodged: false
    };
}

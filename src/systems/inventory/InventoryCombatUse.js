import { SoundHelper } from '../../audio/SoundHelper.js';
import { CombatSequencer } from '../combat/CombatSequencer.js';
import {
    applyPermanentWeaponDamageBonuses,
    applyKeenEdgeFirstStrike,
    rollClassWeaponCrit,
} from '../../content/characters/CharacterClasses.js';
import { getMagic } from '../../content/cards/index.js';

export const InventoryCombatUse = {
    isEnemyBoardCard(card, includeBoss = true) {
        const type = card?.data?.type;
        if (!this.scene.cardSystem?.isEnemyType(type)) return false;
        return includeBoss || type !== 'boss';
    },
    canMagicCardSucceed(magicCard, cardSprite) {
        if (!magicCard) return false;
        const board = this.scene.cardSystem?.boardCards || [];
        const revealedEnemies = board.filter(c => c?.revealed && this.isEnemyBoardCard(c));

        switch (magicCard.magicType) {
            case 'fireball': {
                // Needs a revealed enemy within 150px of where the card was dropped
                let closest = Infinity;
                board.forEach(c => {
                    if (c?.revealed && this.isEnemyBoardCard(c)) {
                        const d = Phaser.Math.Distance.Between(cardSprite.x, cardSprite.y, c.sprite.x, c.sprite.y);
                        if (d < closest) closest = d;
                    }
                });
                return closest < 150;
            }
            case 'soulDrain': {
                // Validation must match execution: the card is targeted by where
                // it is dropped, not merely by having some enemy elsewhere.
                return board.some(c => c?.revealed && this.isEnemyBoardCard(c, false)
                    && Phaser.Math.Distance.Between(cardSprite.x, cardSprite.y, c.sprite.x, c.sprite.y) < 150);
            }
            case 'frostRing':
            case 'weakness':
                // Needs at least one revealed enemy/boss to do anything
                return revealedEnemies.length > 0;
            case 'smokeScreen':
                // Needs at least one revealed non-boss enemy (boss is not hideable)
                return board.some(c => c?.revealed && this.isEnemyBoardCard(c, false));
            // Self-targeted / persistent buffs — always succeed
            case 'restoration':
            case 'shadowBlade':
            case 'magicShield':
            case 'mirrorShield':
            case 'boneWall':
                return true;
            default:
                return true; // Unknown types: don't block, let the switch handle it
        }
    },
    useMagicCard(slotIndex, cardSprite) {
        const magicCard = this.slots[slotIndex];
        if (!magicCard) return;

        // Pre-flight check: confirm there's a valid target before spending an action.
        if (!this.canMagicCardSucceed(magicCard, cardSprite)) {
            this.scene.createFloatingText(cardSprite.x, cardSprite.y, 'No valid target!', 0xff8844);
            this.returnCardToSlot(slotIndex, cardSprite);
            return;
        }

        if (!this.stationMode && !this.scene.useAction()) {
            this.scene.createFloatingText(cardSprite.x, cardSprite.y, 'Wait for the enemy turn!', 0xffaa66);
            this.returnCardToSlot(slotIndex, cardSprite);
            return;
        }

        let used = false;
        
        switch(magicCard.magicType) {
            case 'fireball':
                // Find closest enemy to where card was dropped
                let closestEnemy = -1;
                let closestDistance = Infinity;
                
                this.scene.cardSystem.boardCards.forEach((card, index) => {
                    if (card?.revealed && this.isEnemyBoardCard(card)) {
                        const distance = Phaser.Math.Distance.Between(
                            cardSprite.x, cardSprite.y,
                            card.sprite.x, card.sprite.y
                        );
                        if (distance < closestDistance) {
                            closestDistance = distance;
                            closestEnemy = index;
                        }
                    }
                });
                
                if (closestEnemy !== -1 && closestDistance < 150) {
                    SoundHelper.playSound(this.scene, 'fireball_whoosh', 0.5);
                    
                    // Get enemy reference before attacking (in case it gets destroyed)
                    const enemyCard = this.scene.cardSystem.boardCards[closestEnemy];
                    if (enemyCard && enemyCard.sprite) {
                        this.createFireballEffect(enemyCard.sprite);
                    }
                    
                    this.scene.cardSystem.attackEnemy(closestEnemy, magicCard.damage);
                    this.scene.createFloatingText(cardSprite.x, cardSprite.y, 'Fireball!', 0xff6600);
                    used = true;
                }
                break;
                
            case 'frostRing':
                // Freeze all revealed enemies
                let frozeAny = false;
                this.scene.cardSystem.boardCards.forEach((card) => {
                    if (card?.revealed && this.isEnemyBoardCard(card)) {
                        card.data.frozen = 3; // Frozen for 3 turns
                        this.scene.cardSystem.attachFrozenFrame(card); // Ice frame overlay
                        frozeAny = true;
                    }
                });
                if (frozeAny) {
                    SoundHelper.playSound(this.scene, 'frozenRing', 0.5);
                    this.scene.createFloatingText(320, 180, 'Enemies Frozen!', 0x00ccff);
                    used = true;
                }
                break;
                
            case 'restoration':
                this.scene.gameState.playerHealth = this.scene.gameState.maxHealth;
                this.scene.gameState.actionsLeft = this.scene.gameState.maxActions;
                SoundHelper.playSound(this.scene, 'recovery', 0.5);
                this.scene.createFloatingText(this.scene.playerAvatar.x, this.scene.playerAvatar.y, `Full Restore!`, 0x00ff00);
                this.scene.updateUI();
                used = true;
                break;
                
            case 'soulDrain':
                // Find closest non-boss enemy
                let drainTarget = -1;
                let drainDistance = Infinity;
                
                this.scene.cardSystem.boardCards.forEach((card, index) => {
                    if (card?.revealed && this.isEnemyBoardCard(card, false)) { // Only non-boss
                        const distance = Phaser.Math.Distance.Between(
                            cardSprite.x, cardSprite.y,
                            card.sprite.x, card.sprite.y
                        );
                        if (distance < drainDistance) {
                            drainDistance = distance;
                            drainTarget = index;
                        }
                    }
                });
                
                if (drainTarget !== -1 && drainDistance < 150) {
                    const enemy = this.scene.cardSystem.boardCards[drainTarget];
                    
                    // Check if enemy sprite exists before using it
                    if (enemy && enemy.sprite) {
                        enemy.data.health = 0;
                        
                        // Apply healing modifiers from amulets
                        let healAmount = getMagic('soulDrain')?.healAmount ?? 30;
                        if (this.scene.amuletManager) {
                            healAmount = this.scene.amuletManager.modifySpellHealing(healAmount);
                        }
                        
                        this.scene.gameState.playerHealth = Math.min(
                            this.scene.gameState.maxHealth,
                            this.scene.gameState.playerHealth + healAmount
                        );
                        SoundHelper.playSound(this.scene, 'soulSucking', 0.5);
                        this.createSoulDrainEffect(enemy.sprite, this.scene.playerAvatar);
                        this.scene.createFloatingText(this.scene.playerAvatar.x, this.scene.playerAvatar.y, `+${healAmount} HP`, 0x9932cc);

                        // Route the kill through the standard defeat handler (not a
                        // bare removeCard) so every on-kill reward fires — normal
                        // coins, amulet kill effects, death drops, and crucially the
                        // Mimic's coin + crystal treasure burst. A soul-drained Mimic
                        // now pays out exactly like one killed in melee.
                        this.scene.cardSystem.removeDefeatedEnemy(drainTarget, enemy);
                        this.scene.updateUI();
                        used = true;
                    }
                }
                break;
                
            case 'shadowBlade':
                this.scene.gameState.shadowBlade = { turns: 10, multiplier: 1.5 };
                SoundHelper.playSound(this.scene, 'magic_cast', 0.5);
                this.scene.createFloatingText(this.scene.playerAvatar.x, this.scene.playerAvatar.y, 'Shadow Blade Active!', 0x4b0082);
                used = true;
                break;
                
            case 'weakness':
                // Reduce all enemies' damage
                this.scene.cardSystem.boardCards.forEach((card) => {
                    if (this.isEnemyBoardCard(card)) {
                        card.data.attack = Math.ceil(card.data.attack * 0.7);
                        if (card.revealed) {
                            this.scene.createFloatingText(card.sprite.x, card.sprite.y, 'Weakened!', 0x9932cc);
                        }
                    }
                });
                SoundHelper.playSound(this.scene, 'magic_cast', 0.5);
                used = true;
                break;
                
            case 'boneWall':
                this.scene.gameState.boneWall = 2; // Reflects next 2 attacks
                SoundHelper.playSound(this.scene, 'boneWall', 0.5);
                this.scene.createFloatingText(this.scene.playerAvatar.x, this.scene.playerAvatar.y, 'Bone Wall Active!', 0xffffff);
                used = true;
                break;
                
            case 'magicShield':
                this.scene.gameState.magicShield = { turns: 10, multiplier: 1.2 };
                SoundHelper.playSound(this.scene, 'magicShield', 0.5);
                this.scene.createFloatingText(this.scene.playerAvatar.x, this.scene.playerAvatar.y, 'Magic Shield Active!', 0x00aaff);
                used = true;
                break;
                
            case 'mirrorShield':
                this.scene.gameState.mirrorShield = true;
                SoundHelper.playSound(this.scene, 'mirrorShield', 0.5);
                this.scene.createFloatingText(this.scene.playerAvatar.x, this.scene.playerAvatar.y, 'Mirror Shield Active!', 0xc0c0c0);
                used = true;
                break;
                
            case 'smokeScreen':
                // Flip all face-up non-boss enemy cards back down.
                // Boss is intentionally excluded — it cannot be hidden.
                let flippedAny = false;
                this.scene.cardSystem.boardCards.forEach((card, idx) => {
                    if (card?.revealed && this.isEnemyBoardCard(card, false)) {
                        card.revealed = false;
                        card.sprite.setTexture('cardBack');
                        // Rebind click so the player can re-reveal this card normally.
                        // (After reveal the handler was swapped to interactWithCard,
                        // which silently returns when card.revealed is false.)
                        card.sprite.off('pointerdown');
                        card.sprite.on('pointerdown', () => this.scene.cardSystem.revealCard(idx));
                        // Destroy role/poison markers — they will be recreated on re-reveal.
                        if (card.roleMarker) { card.roleMarker.destroy(); card.roleMarker = null; }
                        if (card.poisonMarker) { card.poisonMarker.destroy(); card.poisonMarker = null; }
                        if (card.shockMarker) { card.shockMarker.destroy(); card.shockMarker = null; }
                        if (card.infoText) {
                            if (card.infoText.list) {
                                card.infoText.destroy(true);
                            } else {
                                card.infoText.destroy();
                            }
                            card.infoText = null;
                        }
                        flippedAny = true;
                    }
                });
                if (flippedAny) {
                    SoundHelper.playSound(this.scene, 'smoke_bomb', 0.5);
                    this.createSmokeEffect();
                    used = true;
                }
                break;
        }
        
        if (used) {
            if (this.scene.amuletManager?.shouldReturnMagicCard?.()) {
                this.scene.createFloatingText(cardSprite.x, cardSprite.y, 'Moth-Wing Dust returned it!', 0xd8d8ff);
                this.returnCardToSlot(slotIndex, cardSprite, () => {
                    this.playMothWingReturnAnimation(slotIndex, cardSprite);
                });
                this.scene.updateUI();
                return;
            }
            // Clean up ALL sprites properly
            this.cleanupCardSprites(slotIndex, cardSprite);
            cardSprite.destroy();
            this.removeCard(slotIndex);
            // Refresh the HUD so any buff the spell just applied (Bone Wall,
            // Shadow Blade, Magic Shield, Mirror Shield, etc.) shows up in the
            // player-effects panel right away instead of only after the next turn.
            this.scene.updateUI();
        } else {
            // Return card to slot if not used
            this.returnCardToSlot(slotIndex, cardSprite);
        }
    },
    // Visual effects for magic cards
    createFireballEffect(targetSprite) {
        const fireball = this.scene.add.circle(targetSprite.x, targetSprite.y, 20, 0xff6600);
        this.scene.tweens.add({
            targets: fireball,
            scale: 2,
            alpha: 0,
            duration: 500,
            onComplete: () => fireball.destroy()
        });
    },
    createSoulDrainEffect(fromSprite, toSprite) {
        const soul = this.scene.add.circle(fromSprite.x, fromSprite.y, 10, 0x9932cc);
        this.scene.tweens.add({
            targets: soul,
            x: toSprite.x,
            y: toSprite.y,
            scale: 0.5,
            duration: 1000,
            ease: 'Cubic.easeIn',
            onComplete: () => soul.destroy()
        });
    },
    createSmokeEffect() {
        const smoke = this.scene.add.rectangle(320, 180, 640, 360, 0x666666, 0.8);
        this.scene.tweens.add({
            targets: smoke,
            alpha: 0,
            duration: 1500,
            onComplete: () => smoke.destroy()
        });
    },
    useWeapon(slotIndex, cardSprite) {
        const weapon = this.slots[slotIndex];
        if (!weapon) return;
        
        // Handle BOW BLOCK ability separately (defensive use, doesn't need enemy)
        if (weapon.special === 'block') {
            // Check if dropped on player avatar for blocking
            const playerAvatarBounds = this.scene.playerAvatar.getBounds();
            if (Phaser.Geom.Intersects.RectangleToRectangle(cardSprite.getBounds(), playerAvatarBounds)) {
                if (this.scene.isEnemyTurn) {
                    this.returnWeaponToSlot(slotIndex, cardSprite);
                    return;
                }

                // Bow block does not spend AP; it still wakes the enemy response.
                this.scene.gameState.blockNextAttack = true;
                this.scene.scheduleEnemyTurn?.();
                SoundHelper.playSound(this.scene, 'armor_equip', 0.5);
                this.scene.createFloatingText(
                    this.scene.playerAvatar.x, 
                    this.scene.playerAvatar.y, 
                    'Blocking next attack!', 
                    0x00aaff
                );
                
                // Reduce bow durability for blocking (with amulet modifier)
                const durabilityLoss = this.scene.amuletManager ? 
                    Math.random() < this.scene.amuletManager.getWeaponDurabilityRate() ? 1 : 0 
                    : 1;
                weapon.durability -= durabilityLoss;
                
                // Check if weapon breaks
                if (weapon.durability <= 0) {
                    this.handleWeaponBreak(weapon, cardSprite, slotIndex);
                    return;
                }
                
                // Update info text and return to slot
                this.updateWeaponInfoText(cardSprite, weapon);
                this.returnWeaponToSlotDelayed(slotIndex, cardSprite);
                return;
            }
        }
        
        // Regular attack logic for all weapons
        const wasExhausted = this.scene.gameState.actionsLeft <= 0;
        if (!this.scene.useAction()) {
            this.returnWeaponToSlot(slotIndex, cardSprite);
            return;
        }
        
        // Find closest enemy
        let closestEnemy = -1;
        let closestDistance = Infinity;
        
        this.scene.cardSystem.boardCards.forEach((card, index) => {
            if (card && card.revealed && this.isEnemyBoardCard(card)) {
                const distance = Phaser.Math.Distance.Between(
                    cardSprite.x, cardSprite.y,
                    card.sprite.x, card.sprite.y
                );
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestEnemy = index;
                }
            }
        });

        if (closestEnemy !== -1 && closestDistance < 150) {
            // Equip weapon before attacking
            this.scene.gameState.equippedWeapon = weapon;
            // Weapon-appropriate swing sound from the new SFX batch. Routed
            // through the CombatSequencer 'attack' beat so it claims a slot on
            // the shared timeline — for a single swing this still fires now, but
            // it lets a dual-wield's off-hand swing slot in cleanly below.
            const swingKey = this.scene.cardSystem?.isRangedWeapon?.(weapon) ? 'bow_shot' : 'heavy_swing';
            CombatSequencer.playSound(this.scene, 'attack', swingKey, 0.5);
            let attackDamage = weapon.damage;
            const characterId = this.scene.gameState.characterId;
            
            // Apply weakness penalty when exhausted (out of action points)
            if (wasExhausted) {
                attackDamage = Math.ceil(attackDamage * 0.8); // 20% weaker
                this.scene.createFloatingText(this.scene.playerAvatar.x, this.scene.playerAvatar.y, 'Weakened Attack!', 0xffa500);
            }

            // Permanent class/talent damage (rogue +10%, Twin Fang).
            // Keen Edge / First Blood / weakness / crit stay situational.
            const talentFx = this.scene.gameState.talentEffects || null;
            attackDamage = applyPermanentWeaponDamageBonuses(characterId, weapon, attackDamage, talentFx);

            // Keen Edge: first dagger/bow attack each floor gets flat +N.
            const keen = applyKeenEdgeFirstStrike(
              characterId, weapon, attackDamage, talentFx, this.scene.gameState
            );
            attackDamage = keen.damage;
            if (keen.applied) {
              this.scene.createFloatingText(
                cardSprite.x, cardSprite.y - 36, `Keen Edge +${keen.bonus}!`, 0xa8e870
              );
            }

            // First Blood: first attack each floor deals bonus %.
            if (talentFx?.firstBloodPct > 0 && !this.scene.gameState.firstAttackThisFloorUsed) {
                attackDamage = Math.ceil(attackDamage * (1 + talentFx.firstBloodPct));
                this.scene.gameState.firstAttackThisFloorUsed = true;
                this.scene.createFloatingText(cardSprite.x, cardSprite.y - 48, 'First Blood!', 0xff88aa);
            }

            // Class passive: warrior crit replaces the hit (sword/axe only).
            const critRoll = rollClassWeaponCrit(characterId, weapon, attackDamage);
            let didCrit = false;
            if (critRoll.crit) {
                // Crit uses printed weapon damage * (1 + 0.05 * rarityTier), then weakness.
                attackDamage = critRoll.damage;
                if (wasExhausted) attackDamage = Math.ceil(attackDamage * 0.8);
                didCrit = true;
                this.scene.createFloatingText(cardSprite.x, cardSprite.y - 20, 'Critical!', 0xff4444);
            }
            
            // Handle special abilities
            let attackCount = 1;
            
            // DAGGER: Dual Wield - Attack twice. The SECOND hit uses the OTHER
            // dagger's stats (damage AND gem), so two socketed daggers contribute
            // both gems on a dual-wield swing — matching what players intuitively
            // expect when they see two daggers in their hands.
            let secondaryDagger = null;
            let secondaryIndex = -1;
            if (weapon.special === 'dualWield') {
                // Find a different dual-wield dagger in inventory (skip the equipped one)
                for (let s = 0; s < this.slots.length; s++) {
                    const item = this.slots[s];
                    if (!item || item === weapon || item.special !== 'dualWield') continue;
                    if (item.durability <= 0) continue;
                    secondaryDagger = item;
                    secondaryIndex = s;
                    break;
                }
                if (secondaryDagger) {
                    attackCount = 2;
                    this.scene.createFloatingText(cardSprite.x, cardSprite.y - 20, 'Dual Wield!', 0xffff00);
                }
            }
            // AXE: Heavy Strike — 150% damage for +1 durability, but only fires
            // when it would actually finish the enemy. Keeps axes from burning
            // their pips on every swing. Skipped on a critical hit.
            else if (!didCrit && weapon.special === 'specialAttack') {
                if (weapon.durability >= 2) {
                    const targetCard = this.scene.cardSystem.boardCards[closestEnemy];
                    const targetHP = targetCard?.data?.health ?? 0;
                    const boostedDamage = Math.floor(attackDamage * 1.5);
                    const regularWouldKill = targetHP <= attackDamage;
                    const heavyWouldKill = targetHP <= boostedDamage;

                    if (!regularWouldKill && heavyWouldKill) {
                        attackDamage = boostedDamage;
                        weapon.durability--; // Extra durability cost — finisher only
                        this.scene.createFloatingText(cardSprite.x, cardSprite.y - 20, 'Heavy Strike!', 0xff6600);
                    }
                }
            }
            
            // Perform attacks
            for (let i = 0; i < attackCount; i++) {
                // Check if enemy still exists for subsequent attacks
                const currentEnemy = this.scene.cardSystem.boardCards[closestEnemy];
                if (!currentEnemy || !currentEnemy.revealed ||
                    (currentEnemy.data.type !== 'enemy' && currentEnemy.data.type !== 'boss')) {
                    break;
                }

                if (i === 0) {
                    // First hit: the dragged weapon. skipDurability=false so its
                    // pip is spent normally inside attackEnemy.
                    this.scene.cardSystem.attackEnemy(closestEnemy, attackDamage, false, weapon, false);
                    this.applyAssassinateTalent(closestEnemy);
                } else {
                    // Second dual-wield hit: use the OTHER dagger's stats — its
                    // damage AND its gem — but only the dragged dagger spends a
                    // pip (already ticked on the first hit). The off-hand dagger
                    // swings for free, so we pass skipDurability=true and never
                    // touch its durability.
                    let secondaryDamage = secondaryDagger.damage || 1;
                    if (wasExhausted) secondaryDamage = Math.ceil(secondaryDamage * 0.8);
                    secondaryDamage = applyPermanentWeaponDamageBonuses(
                        characterId, secondaryDagger, secondaryDamage, talentFx
                    );
                    this.scene.cardSystem.attackEnemy(closestEnemy, secondaryDamage, false, secondaryDagger, true);
                    this.applyAssassinateTalent(closestEnemy);
                    this.scene.updateUI?.();
                }
                if (i < attackCount - 1) {
                    // The off-hand dagger joins the swing. Lift its inventory
                    // card the same way a companion does when it attacks, and
                    // give it its own swing on the sequencer. Scheduled here —
                    // before the second attackEnemy() claims its impact slot —
                    // so the two blades read as swing → hit → swing → hit rather
                    // than a single doubled-up frame.
                    this.playSlotStrikeAnimation(secondaryIndex);
                    CombatSequencer.playSound(this.scene, 'attack', swingKey, 0.4);
                }
            }

            // Front Volley: bow also hits a random front (MELEE) enemy.
            if (
                talentFx?.frontVolleyPct > 0
                && this.scene.cardSystem?.isRangedWeapon?.(weapon)
            ) {
                this.applyFrontVolleyTalent(closestEnemy, attackDamage, weapon, talentFx.frontVolleyPct);
            }
            
            // Un-equip the weapon after the attack sequence
            this.scene.gameState.equippedWeapon = null;
            
            // Durability is now reduced inside attackEnemy, so we don't need to do it here.
            // We just need to check if the weapon broke.
            if (weapon.durability <= 0) {
                this.handleWeaponBreak(weapon, cardSprite, slotIndex);
                return;
            }
            
            // Update weapon info text
            this.updateWeaponInfoText(cardSprite, weapon);
        }
        
        // Return weapon to slot after use
        this.returnWeaponToSlotDelayed(slotIndex, cardSprite);
    },
    // Shared "this card is acting" flourish for an inventory slot — the little
    // hop a companion (Chick / Slimebone), a dual-wield off-hand dagger, or a
    // retaliating thorns card plays to show it joined the turn. Lifts the card
    // art AND everything pinned to it (the value/pip container, gem overlay,
    // briar frame, twinkle), pops the drop-shadow at the resting spot, and runs
    // the hover shine, then settles it all back. Purely cosmetic; callers apply
    // their own damage/sound. Round y each frame so pips never sit on a
    // fractional pixel and jitter.
    playSlotStrikeAnimation(index) {
        const slot = this.slotSprites?.[index];
        const cardSprite = slot?.card;
        if (!cardSprite?.scene) return;

        const restY = Number.isFinite(slot?.originalY) ? slot.originalY : cardSprite.y;
        const hoverSprite = slot?.hoverSprite;
        const shadow = slot?.shadow;

        if (hoverSprite && this.scene.anims?.exists?.('hover_cards_anim')) {
            hoverSprite.setVisible(true);
            hoverSprite.play('hover_cards_anim');
        }

        // Drop-shadow stays put at the resting spot so the card reads as lifting
        // up off it (same as the hover lift). Faded back out when the hop ends.
        if (shadow?.scene) {
            shadow.x = cardSprite.x;
            shadow.y = restY + 28;
            shadow.setAlpha(0.6);
        }

        const lift = (target, baseY, round = false) => {
            if (!target?.scene) return;
            this.scene.tweens.add({
                targets: target,
                y: baseY - 5,
                duration: 120,
                ease: 'Power2',
                yoyo: true,
                onUpdate: round ? () => { target.y = Math.round(target.y); } : undefined,
                onComplete: () => { if (target?.scene) target.y = baseY; }
            });
        };

        lift(cardSprite, restY, true);
        lift(cardSprite.getData?.('infoText'), restY, true);
        if (slot.gemEffectSprite?.visible) lift(slot.gemEffectSprite, restY);
        lift(slot.briarFrame, restY);
        lift(slot.twinkleSprite, restY);
        if (slot.gemIndicator) lift(slot.gemIndicator, slot.gemIndicator.restY ?? restY);

        const hideShadow = () => { if (shadow?.scene) shadow.setAlpha(0); };
        if (hoverSprite) {
            this.scene.tweens.add({
                targets: hoverSprite,
                y: restY - 5,
                duration: 120,
                ease: 'Power2',
                yoyo: true,
                onComplete: () => {
                    if (hoverSprite?.scene) {
                        hoverSprite.stop();
                        hoverSprite.setVisible(false);
                        hoverSprite.y = restY;
                    }
                    hideShadow();
                }
            });
        } else if (shadow?.scene) {
            // No shine to hang the shadow fade off — drop it with the hop.
            this.scene.tweens.add({ targets: shadow, alpha: 0, duration: 120, delay: 120, onComplete: hideShadow });
        }
    },
    // Helper method to handle weapon breaking
    applyAssassinateTalent(enemyIndex) {
        const threshold = this.scene.gameState?.talentEffects?.assassinateThreshold || 0;
        if (threshold <= 0) return;
        const card = this.scene.cardSystem?.boardCards?.[enemyIndex];
        if (!card?.revealed || !card.data) return;
        if (card.data.type !== 'enemy' && card.data.type !== 'boss') return;
        const hp = card.data.health ?? 0;
        if (hp <= 0 || hp > threshold) return;
        this.scene.cardSystem.attackEnemy(enemyIndex, hp, false, null, true);
        if (card.sprite) {
            this.scene.createFloatingText(card.sprite.x, card.sprite.y - 28, 'Assassinate!', 0xaa66ff);
        }
    },
    applyFrontVolleyTalent(primaryIndex, bowDamage, weapon, pct) {
        const boards = this.scene.cardSystem?.boardCards || [];
        const candidates = [];
        boards.forEach((card, index) => {
            if (index === primaryIndex) return;
            if (!card?.revealed || !card.data) return;
            if (card.data.type !== 'enemy' && card.data.type !== 'boss') return;
            if ((card.data.health ?? 0) <= 0) return;
            // Front row ≈ MELEE role (bow already ignores them for primary shot).
            if (card.data.role !== 'MELEE') return;
            candidates.push(index);
        });
        if (!candidates.length) return;
        const target = candidates[Math.floor(Math.random() * candidates.length)];
        const volleyDmg = Math.max(1, Math.ceil(bowDamage * pct));
        this.scene.cardSystem.attackEnemy(target, volleyDmg, false, weapon, true);
        const sprite = boards[target]?.sprite;
        if (sprite) {
            this.scene.createFloatingText(sprite.x, sprite.y - 24, 'Volley!', 0x88ccff);
        }
        this.applyAssassinateTalent(target);
    },
    handleWeaponBreak(weapon, cardSprite, slotIndex) {
        // Clean up board artifacts before destroying
        this.cleanupBoardArtifacts(cardSprite);
        
        SoundHelper.playSound(this.scene, 'item_discard', 0.7);
        this.scene.createFloatingText(cardSprite.x, cardSprite.y, `${weapon.name} broke!`, 0xff0000);
        this.scene.grantCardSpentRelicBonus?.(weapon, cardSprite.x, cardSprite.y);
        
        // Dissolve flourish on the spent weapon card before it's removed.
        this.scene.cardSystem?.playCardDisappearEffect?.(cardSprite);

        // Clean up ALL sprites properly
        this.cleanupCardSprites(slotIndex, cardSprite);
        cardSprite.destroy();
        this.removeCard(slotIndex);
    },
    // Helper method to update weapon info text
    updateWeaponInfoText(cardSprite, weapon) {
        const oldInfoText = cardSprite.getData('infoText');
        if (oldInfoText) {
            if (oldInfoText.list) {
                oldInfoText.destroy(true);
            } else {
                oldInfoText.destroy();
            }
        }
        
        const cardWithSprite = { sprite: cardSprite, data: weapon, infoText: null };
        this.scene.cardSystem.createCardInfoText(cardWithSprite);
        if (cardWithSprite.infoText) {
            this.uiGroup.add(cardWithSprite.infoText);
            cardSprite.setData('infoText', cardWithSprite.infoText);
        }
    },
    // Helper method to return weapon to slot immediately
    returnWeaponToSlot(slotIndex, cardSprite) {
        const slotSprite = this.slotSprites[slotIndex];
        if (slotSprite && cardSprite && cardSprite.scene) {
            cardSprite.x = slotSprite.background.x;
            cardSprite.y = slotSprite.background.y;
            const infoText = cardSprite.getData('infoText');
            if (infoText && infoText.scene) {
                infoText.x = cardSprite.x;
                infoText.y = cardSprite.y;
            }
            if (slotSprite.shadow && slotSprite.shadow.scene) {
                slotSprite.shadow.x = cardSprite.x;
                slotSprite.shadow.y = cardSprite.y + 28;
                slotSprite.shadow.setAlpha(0);
                slotSprite.shadow.setDepth(11);
            }
            if (slotSprite.hoverSprite && slotSprite.hoverSprite.scene) {
                slotSprite.hoverSprite.x = cardSprite.x;
                slotSprite.hoverSprite.y = cardSprite.y;
                slotSprite.hoverSprite.setVisible(false);
                slotSprite.hoverSprite.stop();
            }
            if (slotSprite.gemEffectSprite && slotSprite.gemEffectSprite.scene) {
                slotSprite.gemEffectSprite.x = cardSprite.x;
                slotSprite.gemEffectSprite.y = cardSprite.y;
                slotSprite.gemEffectSprite.setVisible(false);
                slotSprite.gemEffectSprite.stop();
            }
            if (slotSprite.gemIndicator && slotSprite.gemIndicator.scene) {
                const indicator = slotSprite.gemIndicator;
                const halfW = (cardSprite.displayWidth || 45) / 2;
                const halfH = (cardSprite.displayHeight || 65) / 2;
                indicator.x = cardSprite.x + halfW - 1;
                indicator.y = cardSprite.y - halfH + 1;
                indicator.restX = indicator.x;
                indicator.restY = indicator.y;
                indicator.setVisible(true);
            }
            // Snap the thorn frame back onto the card — it's centered on the card
            // like the art, so it tracks the card position (not a corner offset).
            if (slotSprite.briarFrame && slotSprite.briarFrame.scene) {
                slotSprite.briarFrame.x = cardSprite.x;
                slotSprite.briarFrame.y = cardSprite.y;
                slotSprite.briarFrame.setVisible(true);
                slotSprite.briarFrame.setDepth(this.getInventoryDepths().briarFrame);
            }
            // Move twinkle sprite back too
            if (slotSprite.twinkleSprite && slotSprite.twinkleSprite.scene) {
                slotSprite.twinkleSprite.x = cardSprite.x;
                slotSprite.twinkleSprite.y = cardSprite.y;
            }
        }
    },
    // Helper method to return weapon to slot with delay
    returnWeaponToSlotDelayed(slotIndex, cardSprite) {
        const originalSlot = this.slotSprites[slotIndex];
        const weaponStillExists = () => this.slots[slotIndex] && originalSlot && originalSlot.card;
        
        // Clean up any board artifacts immediately
        this.cleanupBoardArtifacts(cardSprite);
        
        // Use a small delay to ensure the attack animation completes
        this.scene.time.delayedCall(300, () => {
            // Only return card if it still exists and wasn't destroyed
            if (weaponStillExists() && cardSprite && cardSprite.scene) {
                cardSprite.x = originalSlot.background.x;
                cardSprite.y = originalSlot.background.y;
                
                const infoText = cardSprite.getData('infoText');
                if (infoText && infoText.scene) {
                    infoText.x = cardSprite.x;
                    infoText.y = cardSprite.y;
                }
                cardSprite.setScale(1);

                if (originalSlot.shadow && originalSlot.shadow.scene) {
                    originalSlot.shadow.x = cardSprite.x;
                    originalSlot.shadow.y = cardSprite.y + 28;
                    originalSlot.shadow.setAlpha(0);
                    originalSlot.shadow.setDepth(11);
                }

                if (originalSlot.hoverSprite && originalSlot.hoverSprite.scene) {
                    originalSlot.hoverSprite.x = cardSprite.x;
                    originalSlot.hoverSprite.y = cardSprite.y;
                    originalSlot.hoverSprite.setVisible(false);
                    originalSlot.hoverSprite.stop();
                }
                
                // Move twinkle sprite back too
                if (originalSlot.twinkleSprite && originalSlot.twinkleSprite.scene) {
                    originalSlot.twinkleSprite.x = cardSprite.x;
                    originalSlot.twinkleSprite.y = cardSprite.y;
                }

                // Restore gem indicator — dragstart hid it when attacking
                if (originalSlot.gemIndicator && originalSlot.gemIndicator.scene) {
                    const indicator = originalSlot.gemIndicator;
                    const halfW = (cardSprite.displayWidth || 45) / 2;
                    const halfH = (cardSprite.displayHeight || 65) / 2;
                    indicator.x = cardSprite.x + halfW - 1;
                    indicator.y = cardSprite.y - halfH + 1;
                    indicator.restX = indicator.x;
                    indicator.restY = indicator.y;
                    indicator.setVisible(true);
                }

                // Snap the thorn frame back onto the card too, or it stays orphaned
                // on the board where the weapon was dropped to attack.
                if (originalSlot.briarFrame && originalSlot.briarFrame.scene) {
                    originalSlot.briarFrame.x = cardSprite.x;
                    originalSlot.briarFrame.y = cardSprite.y;
                    originalSlot.briarFrame.setVisible(true);
                    originalSlot.briarFrame.setDepth(this.getInventoryDepths().briarFrame);
                }

                // The merge twinkle followed the weapon onto the board, where
                // cleanupBoardArtifacts (run at the top of this method) destroyed
                // it as a stray board sprite. Re-derive twinkles from the slots so
                // a still-mergeable weapon gets its sparkle back on return.
                this.updateTwinkleEffects();
            }
        });
    },
    usePotion(slotIndex, cardSprite) {
        // In a shop (station mode) there are no enemy turns or action economy,
        // so healing shouldn't spend an action or schedule an enemy turn.
        if (!this.stationMode && !this.scene.useAction()) return false;
        const potionData = this.slots[slotIndex];
        if (!potionData) return false;

        // Below both guards above: the gulp should only sound once the hero is
        // actually drinking, not on an attempt that bounced off the action check.
        SoundHelper.playSound(this.scene, 'potion_drink', 0.5);

        // Apply healing modifiers from amulets
        let healAmount = potionData.healAmount;
        if (this.scene.amuletManager) {
            healAmount = this.scene.amuletManager.modifyPotionHealing(healAmount);
        }
        
        // Potions are the ONLY heal source subject to amulet caps (e.g. the
        // Berserker's Warbelt's 50% ceiling). Rest/events/spells use heal().
        this.scene.gameState.healCapped(healAmount);

        this.scene.createFloatingText(
            this.scene.playerAvatar.x,
            this.scene.playerAvatar.y,
            `+${healAmount} HP`,
            0x00ff00
        );

        // Fire potion-use amulet hooks (e.g. Carrion Oath's poison purge).
        this.scene.amuletManager?.processPotionUse?.();

        // Properly clean up all sprites
        if (cardSprite) {
            this.cleanupCardSprites(slotIndex, cardSprite);
            cardSprite.destroy();
        }
        
        this.removeCard(slotIndex);
        this.scene.updateUI();
        
    return true;
    },
    useFood(slotIndex, cardSprite) {
        const foodData = this.slots[slotIndex];
        if (!foodData) return false;

        SoundHelper.playVariant(this.scene, 'bread_eaten', 0.5);

        // Apply food AP modifiers from amulets
        let actionGain = foodData.actionAmount;
        if (this.scene.amuletManager) {
            actionGain = this.scene.amuletManager.modifyFoodAP(actionGain);
        }
        
        this.scene.gameState.actionsLeft = Math.min(
            this.scene.gameState.maxActions, 
            this.scene.gameState.actionsLeft + actionGain
        );
        
        this.scene.createFloatingText(
            this.scene.playerAvatar.x,
            this.scene.playerAvatar.y,
            `+${actionGain} Actions`,
            0x00ff00
        );
        
        // Properly clean up all sprites
        if (cardSprite) {
            this.cleanupCardSprites(slotIndex, cardSprite);
            cardSprite.destroy();
        }
        
        this.removeCard(slotIndex);
        this.scene.updateUI();
        return true;
    },
};

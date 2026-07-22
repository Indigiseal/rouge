import { SoundHelper } from '../audio/SoundHelper.js';
import { buildStartingWeaponCards } from '../content/characters/CharacterClasses.js';
import { CardDataGenerator } from './loot/CardDataGenerator.js';
import { CardMergeRules } from './inventory/CardMergeRules.js';
import { InventoryCombatUse } from './inventory/InventoryCombatUse.js';
import { InventoryView } from './inventory/InventoryView.js';
import { InventorySlotRenderer } from './inventory/InventorySlotRenderer.js';

export class InventorySystem {
    constructor(scene, existingInventory = null) {
        this.scene = scene;
        
        // Check for Bottomless Bag bonus slots
        const baseSlots = 5;
        const bonusSlots = this.scene.gameState.bonusInventorySlots || 0;
        const totalSlots = baseSlots + bonusSlots;
        
        // Initialize slots array with proper size
        this.slots = new Array(totalSlots).fill(null);
        
        // If we have existing inventory, copy it properly
        if (existingInventory && Array.isArray(existingInventory)) {
            existingInventory.forEach((item, i) => {
                if (i < totalSlots && item) {
                    this.slots[i] = item;
                }
            });
        }
        
        this.slotSprites = [];
        this.discardArea = null;
        this.armorPanel = null;
        this.armorTwinkleSprite = null;   // sparkle on the worn-armor slot when a bag armor can merge into it
        this.uiGroup = this.scene.add.group();
        this.inventoryPanelPieces = [];
        this.stationMode = false;
        this.cardTooltip = null;
        this.createInventoryUI();
        this.rebuildInventorySprites();
    }

    getCurrentWeapon() {
        return this.scene.gameState?.equippedWeapon || null;
    }

    // Gems and relics/amulets are standalone trinkets, not cards. They don't
    // get the rectangular card drop-shadow or the hover "shine" animation.
    isCardItem(item) {
        const t = item?.type;
        return t !== 'gem' && t !== 'amulet' && t !== 'relic' && t !== 'amuletPickup';
    }

    syncGameStateInventory() {
        if (this.scene.gameState) {
            this.scene.gameState.inventory = this.slots;
        }
    }

    addStartingCards() {
        // Grant the starter swords exactly once per run. Without this guard,
        // every startNewFloor() on floor 1 (scene create, Continue/resume,
        // restart) re-added them, stacking up 2 → 4 → 6 swords.
        if (this.scene.gameState.startingCardsGranted) return;
        if (this.scene.gameState.currentFloor > 1) return;
        this.scene.gameState.startingCardsGranted = true;

        const characterId = this.scene.gameState.characterId;
        for (const weapon of buildStartingWeaponCards(characterId)) {
            this.addCard(weapon);
        }

        // Carry-over egg: a past hero who died still clutching an unhatched egg
        // passes it to this new run. consumePendingEgg() clears the flag so the
        // egg isn't re-granted on later floor-1 re-entries (it's guarded above
        // by startingCardsGranted anyway, but the consume keeps meta clean).
        if (this.scene.metaManager?.consumePendingEgg?.()) {
            const egg = this.scene.cardSystem.cardDataGenerator.createEggCard();
            this.addCard(egg);
        }
    }

    applyGemToWeapon(gem, weaponSlotIndex, rebuild = true) {
        const weapon = this.slots[weaponSlotIndex];
        if (!gem || gem.type !== 'gem' || !weapon || weapon.type !== 'weapon') return false;

        const maxSlots = CardDataGenerator.weaponGemSlots(weapon);
        const currentCount = weapon.gemEffect ? (weapon.gemCount || 1) : 0;

        // Reject mismatched gem types
        if (weapon.gemEffect && weapon.gemEffect !== gem.gemEffect) {
            SoundHelper.playVariant(this.scene, 'invalid_action', 0.5);
            this.scene.createFloatingText(512, 380, 'Different gem already socketed!', 0xff4444);
            return false;
        }

        // Reject if already at max
        if (currentCount >= maxSlots) {
            SoundHelper.playVariant(this.scene, 'invalid_action', 0.5);
            this.scene.createFloatingText(512, 380, 'Gem slots full!', 0xff4444);
            return false;
        }

        weapon.gemEffect = gem.gemEffect;
        weapon.gemName = gem.name;
        weapon.gemColor = gem.color;
        weapon.gemCount = currentCount + 1;
        this.syncGameStateInventory();
        if (rebuild) this.rebuildInventorySprites();
        const stackLabel = weapon.gemCount > 1 ? ` (x${weapon.gemCount})` : '';
        this.scene.createFloatingText(512, 380, `${gem.name} socketed${stackLabel}`, gem.color || 0xffe066);
        SoundHelper.playSound(this.scene, 'gem_socket', 0.5);
        return true;
    }

    // ─── Amulet pickups (equipable amulet cards that live in a slot) ─────────

    // Moves an amulet pickup card out of its slot and into the active amulet
    // collection. Bounces back if the amulet is already worn (and non-stackable).
    equipAmuletFromSlot(slotIndex, cardData, cardSprite) {
        const mgr = this.scene.amuletManager;
        const amuletId = cardData?.amuletId;
        if (!mgr?.addAmulet || !amuletId) {
            this.returnCardToSlot(slotIndex, cardSprite);
            return false;
        }

        const def = mgr.amuletDefinitions?.[amuletId];
        if (mgr.hasAmulet(amuletId) && !def?.stackable) {
            this.scene.createFloatingText(cardSprite.x, cardSprite.y, 'Already equipped!', 0xffa500);
            this.returnCardToSlot(slotIndex, cardSprite);
            return false;
        }

        if (!mgr.addAmulet(amuletId)) {
            this.returnCardToSlot(slotIndex, cardSprite);
            return false;
        }

        this.scene.createFloatingText(cardSprite.x, cardSprite.y - 8, `${def?.name || 'Amulet'} equipped!`, 0x88ff88);
        SoundHelper.playSound(this.scene, 'crystal_collect', 0.5);
        this.cleanupCardSprites(slotIndex, cardSprite);
        this.removeCard(slotIndex, false);
        cardSprite.destroy();
        this.scene.updateUI?.();
        return true;
    }

    // Drops the carnival clover into the bag as an equipable amulet card, then
    // plays the "card morphs into a little amulet" reveal. Returns the slot index,
    // or -1 if the bag was full.
    deliverCloverAmulet() {
        const slotIndex = this.slots.findIndex(slot => slot === null);
        if (slotIndex < 0) return -1;

        this.addCardDirect({
            type: 'amuletPickup',
            id: 'luckyCloverPickup',
            amuletId: 'luckyClover',
            name: 'Lucky Clover',
            sprite: 'relicsOthers',
            spriteFrame: 69,
            rarity: 'rare',
            description: '+3% crit chance'
        }, slotIndex);
        this.playCloverMorph(slotIndex);
        return slotIndex;
    }

    // Covers the freshly-placed amulet icon with the full clover card art, waits a
    // beat, then jumps + shrinks the card away to reveal the small amulet beneath.
    playCloverMorph(slotIndex, delay = 650) {
        const slot = this.slotSprites[slotIndex];
        if (!slot?.background || !this.scene.textures.exists('luckyClover')) return;

        const x = slot.background.x;
        const y = slot.background.y;
        const cardDepth = (this.getInventoryDepths().card || 12) + 3;

        const revealIcon = () => {
            const live = this.slotSprites[slotIndex];
            if (live?.card?.scene) live.card.setAlpha(1);
        };

        if (slot.card?.scene) slot.card.setAlpha(0);
        const cardImg = snapOriginToPixelGrid(this.scene.add.image(x, y, 'luckyClover')).setDepth(cardDepth);
        this.uiGroup.add(cardImg);

        // If the player leaves before the morph plays, drop the overlay and just
        // show the amulet — the slot already holds the correct, equipable card.
        const cleanup = () => { if (cardImg.scene) cardImg.destroy(); revealIcon(); };
        this.scene.events.once('sleep', cleanup);
        this.scene.events.once('shutdown', cleanup);

        this.scene.time.delayedCall(delay, () => {
            if (!cardImg.scene) return;
            this.scene.tweens.add({
                targets: cardImg,
                y: y - 18,
                duration: 170,
                ease: 'Cubic.easeOut',
                yoyo: true,
                onUpdate: () => { cardImg.y = Math.round(cardImg.y); },
                onComplete: () => {
                    if (!cardImg.scene) return;
                    revealIcon();
                    const live = this.slotSprites[slotIndex];
                    if (live?.card?.scene) {
                        live.card.setScale(0.35);
                        this.scene.tweens.add({ targets: live.card, scale: 1, duration: 220, ease: 'Back.easeOut' });
                    }
                    this.scene.tweens.add({
                        targets: cardImg,
                        scale: 0.35,
                        alpha: 0,
                        duration: 200,
                        ease: 'Cubic.easeIn',
                        onComplete: () => {
                            if (cardImg.scene) cardImg.destroy();
                            this.sparkleAtSlot(slotIndex);
                        }
                    });
                }
            });
        });
    }

    sparkleAtSlot(slotIndex) {
        const slot = this.slotSprites[slotIndex];
        if (!slot?.card?.scene) return;
        slot.card.setTint(0xaaffaa);
        this.scene.time.delayedCall(170, () => { if (slot.card?.scene) slot.card.clearTint(); });
    }

    // Modified addCard to use addCardDirect when appropriate
    addCard(cardData, preferredSlot = -1) {
        let emptySlot = preferredSlot !== -1 && this.slots[preferredSlot] === null 
            ? preferredSlot 
            : this.slots.findIndex(slot => slot === null);
        if (emptySlot === -1) {
            this.scene.createFloatingText(512, 400, 'Inventory Full!', 0xff0000);
            return false;
        }

        this.addCardDirect(cardData, emptySlot);
        this.scene.amuletManager?.processCardReward?.(cardData);
        if (cardData?.tutorialTag) {
            this.scene.events.emit('tutorialProgress', `inventory:${cardData.tutorialTag}`);
            this.scene.tutorialManager?._handleProgress?.(`inventory:${cardData.tutorialTag}`);
        }
        this.updateTwinkleEffects();
        return true;
    }

    handleCardDrop(slotIndex, cardSprite) {
        const cardData = this.slots[slotIndex];
        if (!cardData) return;
        
        // Check for drop on discard area FIRST to prevent conflicts with other drop zones
        // (allowed inside shop stations too, so players can free inventory space)
        if (this.discardArea && Phaser.Geom.Intersects.RectangleToRectangle(cardSprite.getBounds(), this.discardArea.getBounds())) {
            SoundHelper.playSound(this.scene, 'item_discard', 0.7);
            this.scene.createFloatingText(cardSprite.x, cardSprite.y, 'Discarded!', 0xff0000);
            this.scene.recordCardDiscarded?.(cardData, cardSprite.x, cardSprite.y);

            // Properly clean up ALL sprites and effects
            this.cleanupCardSprites(slotIndex, cardSprite);
            this.removeCard(slotIndex, false); // Don't destroy the sprite in removeCard
            cardSprite.destroy(); // Destroy the dragged sprite here
            // Inventory discard does not spend AP.
            return;
        }

        // Amulet pickups (e.g. the carnival clover) equip on any interaction that
        // isn't a discard — a plain tap or a drag anywhere onto the hero. Handled
        // before the merge/station checks so it works in combat and stations alike.
        if (cardData.type === 'amuletPickup') {
            this.equipAmuletFromSlot(slotIndex, cardData, cardSprite);
            return;
        }

        // Check for drop on another inventory item for merging
        for (let i = 0; i < this.slotSprites.length; i++) {
            if (i === slotIndex) continue;
            const targetSlotSprite = this.slotSprites[i];
            const targetCardData = this.slots[i];
            if (targetCardData && Phaser.Geom.Intersects.RectangleToRectangle(cardSprite.getBounds(), targetSlotSprite.background.getBounds())) {
                if (cardData.type === 'gem' && targetCardData.type === 'weapon') {
                    if (this.applyGemToWeapon(cardData, i, false)) {
                        this.cleanupCardSprites(slotIndex, cardSprite);
                        this.removeCard(slotIndex, false);
                        cardSprite.destroy();
                        this.rebuildInventorySprites();
                        // Socketing a gem costs an action point and wakes the enemies.
                        if (!this.stationMode) this.scene.useAction?.();
                        return;
                    }
                }

                // Check if cross-tier merge is allowed (Golden Hammer)
                const canCrossTier = this.scene.amuletManager && 
                    this.scene.amuletManager.canCrossTierMerge();
                
                if (this.canCardsMerge(cardData, targetCardData, canCrossTier)) {
                    // Magic cards cannot be merged
                    if (cardData.type === 'magic') {
                        this.scene.createFloatingText(512, 400, 'Magic cards cannot be merged!', 0xff0000);
                        this.returnCardToSlot(slotIndex, cardSprite);
                        return;
                    }

                    // Only weapon merges spend AP (armor/potion/food/thorns are free).
                    if (cardData.type === 'weapon' && !this.stationMode && !this.scene.useAction()) {
                        this.scene.createFloatingText(512, 400, 'Not enough actions!', 0xff0000);
                        this.returnCardToSlot(slotIndex, cardSprite);
                        return;
                    }
                    this.mergeCards(slotIndex, i, cardSprite);
                    return; // Merge complete, exit function
                }
            }
        }

        // Armor can be equipped even while in a shop (station mode). Check this BEFORE
        // the stationMode early-return below so the player isn't locked out.
        if (
            cardData.type === 'armor' &&
            this.armorPanel &&
            Phaser.Geom.Intersects.RectangleToRectangle(cardSprite.getBounds(), this.armorPanel.getBounds())
        ) {
            // Same-tier armor as what's worn merges in place; otherwise swap.
            if (this.tryMergeWithEquippedArmor(slotIndex, cardSprite)) return;
            if (this.equipArmor(slotIndex, cardSprite)) return;
        }

        // Potions, food and self-targeted magic (e.g. Restoration) can be used on
        // the hero even while in a shop, just like armor can be equipped — check
        // BEFORE the stationMode early-return, otherwise dropping them on the avatar
        // just bounces back to the inventory.
        if (this.scene.playerAvatar) {
            const avatarBounds = this.scene.playerAvatar.getBounds();
            if (Phaser.Geom.Intersects.RectangleToRectangle(cardSprite.getBounds(), avatarBounds)) {
                if (cardData.type === 'potion') {
                    if (this.usePotion(slotIndex, cardSprite)) return;
                } else if (cardData.type === 'food') {
                    if (this.useFood(slotIndex, cardSprite)) return;
                } else if (cardData.type === 'magic') {
                    const selfTarget = ['restoration', 'shadowBlade', 'magicShield', 'boneWall', 'mirrorShield'];
                    if (selfTarget.includes(cardData.magicType)) {
                        this.useMagicCard(slotIndex, cardSprite);
                        return;
                    }
                }
            }
        }

        // Custom event drop zones (e.g. the copying mirror). Checked before the
        // station-mode bounce-back so events can react to a card dropped on them.
        // A handler returning true owns the dragged sprite from here on.
        for (const entry of (this.dropZones || [])) {
            const zone = entry?.zone;
            if (!zone || !zone.scene || typeof zone.getBounds !== 'function') continue;
            const bounds = zone.getBounds();
            if (bounds && Phaser.Geom.Intersects.RectangleToRectangle(cardSprite.getBounds(), bounds)) {
                if (entry.handler(slotIndex, cardData, cardSprite)) return;
            }
        }

        // Magic has historically been cast by dropping it on the gaming board.
        // Keep that interaction in stations/events too; their special drop zones
        // were checked above and therefore still take priority.
        const onBoard = cardSprite.y < 280;
        if (onBoard && cardData.type === 'magic') {
            this.useMagicCard(slotIndex, cardSprite);
            return;
        }

        if (this.stationMode) {
            this.returnCardToSlot(slotIndex, cardSprite);
            return;
        }

        // Check if dropped on board to use a weapon. Magic was handled above so
        // its board-cast behavior is identical in combat and station scenes.
        if (onBoard) {
            if (cardData.type === 'weapon') {
                this.useWeapon(slotIndex, cardSprite);
                return;
            }
        }

        // Check if dropped on the player avatar for equipping/consuming
        const playerAvatarBounds = this.scene.playerAvatar.getBounds();
        if (Phaser.Geom.Intersects.RectangleToRectangle(cardSprite.getBounds(), playerAvatarBounds)) {
            if (cardData.type === 'armor') {
                if (this.tryMergeWithEquippedArmor(slotIndex, cardSprite)) return; // Merge into worn armor
                if (this.equipArmor(slotIndex, cardSprite)) return; // Success - pass cardSprite for cleanup
            } else if (cardData.type === 'potion') {
                if (this.usePotion(slotIndex, cardSprite)) return; // Success - pass cardSprite for cleanup
            } else if (cardData.type === 'food') {
                if (this.useFood(slotIndex, cardSprite)) return; // Success
            } else if (cardData.type === 'magic') {
                // Some magic cards can be used on player
                if (cardData.magicType === 'restoration' || cardData.magicType === 'shadowBlade' || 
                    cardData.magicType === 'magicShield' || cardData.magicType === 'boneWall' || 
                    cardData.magicType === 'mirrorShield') {
                    this.useMagicCard(slotIndex, cardSprite);
                    return;
                }
            }
        }
        
        // If drop was not on a valid target, or action failed, return to slot
        this.returnCardToSlot(slotIndex, cardSprite);
    }

    // Helper method to properly clean up all card-related sprites
    cleanupCardSprites(slotIndex, cardSprite) {
        this.hideCardTooltip();
        const slot = this.slotSprites[slotIndex];
        
        // Clean up info text
        const infoText = cardSprite.getData('infoText');
        if (infoText) {
            if (infoText.list) {
                infoText.destroy(true);
            } else {
                infoText.destroy();
            }
        }
        
        // Clean up slot sprites
        if (slot) {
            if (slot.twinkleSprite) {
                slot.twinkleSprite.destroy();
                slot.twinkleSprite = null;
            }
            
            if (slot.hoverSprite) {
                slot.hoverSprite.destroy();
                slot.hoverSprite = null;
            }

            if (slot.gemEffectSprite) {
                slot.gemEffectSprite.destroy();
                slot.gemEffectSprite = null;
            }

            if (slot.gemIndicator) {
                slot.gemIndicator.destroy();
                slot.gemIndicator = null;
            }
            
            if (slot.shadow) {
                slot.shadow.destroy();
                slot.shadow = null;
            }
        }
    }

    returnCardToSlot(slotIndex, cardSprite, onComplete = null) {
        const slotSprite = this.slotSprites[slotIndex];
        if (!slotSprite || !slotSprite.background) return;

        // A key card can't be merged, equipped or used, so dropping it anywhere
        // just settles it back into the bag — give that its own clink.
        if (this.slots[slotIndex]?.type === 'key') {
            SoundHelper.playSound(this.scene, 'key_drop', 0.5);
        }

        // Use the slot background position as the authoritative position
        const targetX = slotSprite.background.x;
        const targetY = slotSprite.background.y;
        
        // Animate return to slot
        this.scene.tweens.add({
            targets: cardSprite,
            x: targetX,
            y: targetY,
            duration: 200,
            ease: 'Power2',
            onComplete: () => {
                // Ensure final position is exact
                cardSprite.x = targetX;
                cardSprite.y = targetY;
                this.applySlotVisualDepths(slotIndex);
                
                // Update stored position data
                cardSprite.setData('originalX', targetX);
                cardSprite.setData('originalY', targetY);
                onComplete?.();
            }
        });
        
        // Also move the info text
        const infoText = cardSprite.getData('infoText');
        if (infoText && infoText.scene) {
            this.scene.tweens.add({
                targets: infoText,
                x: targetX,
                y: targetY,
                duration: 200,
                ease: 'Power2'
            });
        }
        
        // Move shadow back
        if (slotSprite.shadow && slotSprite.shadow.scene) {
            slotSprite.shadow.x = targetX;
            slotSprite.shadow.y = targetY + 28;
            slotSprite.shadow.setAlpha(0);
        }
        
        // Move hover sprite back
        if (slotSprite.hoverSprite && slotSprite.hoverSprite.scene) {
            slotSprite.hoverSprite.x = targetX;
            slotSprite.hoverSprite.y = targetY;
        }

        // Move gem effect sprite back
        if (slotSprite.gemEffectSprite && slotSprite.gemEffectSprite.scene) {
            slotSprite.gemEffectSprite.x = targetX;
            slotSprite.gemEffectSprite.y = targetY;
        }

        // Return gem indicator to its corner
        if (slotSprite.gemIndicator && slotSprite.gemIndicator.scene) {
            const indicator = slotSprite.gemIndicator;
            indicator.x = indicator.restX;
            indicator.y = indicator.restY;
            indicator.setVisible(true);
        }

        if (slotSprite.briarFrame?.scene) {
            slotSprite.briarFrame.x = targetX;
            slotSprite.briarFrame.y = targetY;
            slotSprite.briarFrame.setVisible(true);
            slotSprite.briarFrame.setDepth(this.getInventoryDepths().briarFrame);
        }
        
        // Move twinkle sprite back
        if (slotSprite.twinkleSprite && slotSprite.twinkleSprite.scene) {
            slotSprite.twinkleSprite.x = targetX;
            slotSprite.twinkleSprite.y = targetY;
        }
    }

    playMothWingReturnAnimation(slotIndex, cardSprite) {
        const slotSprite = this.slotSprites?.[slotIndex];
        if (!slotSprite || !cardSprite?.scene) return;

        const infoText = cardSprite.getData?.('infoText');
        const hoverSprite = slotSprite.hoverSprite;
        const parts = [cardSprite, infoText, hoverSprite]
            .filter(part => part?.scene)
            .map(part => ({ part, homeY: part.y }));

        if (hoverSprite?.scene) {
            hoverSprite.setVisible(true);
            if (this.scene.anims?.exists?.('hover_cards_anim')) hoverSprite.play('hover_cards_anim');
        }

        this.scene.tweens.add({
            targets: parts.map(({ part }) => part),
            y: '-=8',
            duration: 120,
            ease: 'Sine.easeOut',
            yoyo: true,
            hold: 30,
            onComplete: () => {
                parts.forEach(({ part, homeY }) => {
                    if (part?.scene) part.y = homeY;
                });
                if (hoverSprite?.scene) {
                    hoverSprite.stop();
                    hoverSprite.setVisible(false);
                }
            }
        });
        this.scene.tweens.add({
            targets: cardSprite,
            scaleX: 1.08,
            scaleY: 1.08,
            duration: 120,
            ease: 'Back.easeOut',
            yoyo: true
        });
    }

    // Add a new method to clean up board artifacts
    cleanupBoardArtifacts(cardSprite) {
        // Clean up any stray visual elements that might be on the board
        const boardArea = { x1: 220, x2: 460, y1: 145, y2: 240 };
        
        // Check all sprites in the scene for orphaned elements
        this.scene.children.list.forEach(child => {
            // Check if it's a durability dot or twinkle animation in the board area
            if (child && child.texture) {
                const isInBoardArea = child.x >= boardArea.x1 && child.x <= boardArea.x2 && 
                                      child.y >= boardArea.y1 && child.y <= boardArea.y2;
                
                if (isInBoardArea) {
                // Check if it's an orphaned durability dot or twinkle
                if (child.texture.key && (
                    child.texture.key === 'durability_dot' || 
                    child.texture.key === 'ten_durability' ||
                    child.texture.key.includes('twinkle'))) {
                        // Check if this sprite is orphaned (not attached to any card)
                        let isOrphaned = true;
                        
                        // Check inventory slots
                        this.slotSprites.forEach(slot => {
                            if (slot.card && slot.card.getData('infoText')) {
                                const infoText = slot.card.getData('infoText');
                                if (infoText.list && infoText.list.includes(child)) {
                                    isOrphaned = false;
                                }
                            }
                        });
                        
                        // If orphaned, destroy it
                        if (isOrphaned) {
                            child.destroy();
                        }
                    }
                }
            }
        });
    }

    // Merge an inventory armor card into the armor the hero is already wearing,
    // without either card sitting in the inventory. Triggered when an armor card
    // is dropped on the worn-armor slot (or the hero) and the two are mergeable.
    // The upgraded armor stays equipped. Returns true when it handled the drop
    // (merged, or bounced for lack of actions); false means "not mergeable —
    // fall through to the normal equip/swap".
    tryMergeWithEquippedArmor(slotIndex, draggedSprite = null) {
        const cardData = this.slots[slotIndex];
        const worn = this.scene.gameState.equippedArmor;
        if (!cardData || cardData.type !== 'armor' || !worn) return false;

        const canCrossTier = this.scene.amuletManager &&
            this.scene.amuletManager.canCrossTierMerge();
        if (!this.canCardsMerge(cardData, worn, canCrossTier)) return false;

        // Armor merge does not spend AP (only weapon merges do).

        // Upgrade off the higher-tier card, exactly like mergeCards().
        const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        let baseCard = cardData;
        let secondCard = worn;
        if (canCrossTier &&
            rarityOrder.indexOf(worn.rarity) > rarityOrder.indexOf(cardData.rarity)) {
            baseCard = worn;
            secondCard = cardData;
        }
        const upgradedArmor = this.createMergedCard(baseCard, secondCard);

        // Consume the dragged inventory card and swap the worn armor for the
        // upgrade (it stays equipped — no free inventory slot required).
        if (draggedSprite) {
            this.cleanupCardSprites(slotIndex, draggedSprite);
            draggedSprite.destroy();
        }
        this.removeCard(slotIndex, true);
        this.scene.gameState.equippedArmor = upgradedArmor;

        SoundHelper.playSound(this.scene, 'armor_equip', 0.6);
        this.scene.createFloatingText(
            this.scene.playerAvatar.x,
            this.scene.playerAvatar.y,
            `Merged → ${upgradedArmor.name}`,
            0x00ff00
        );

        // Merge flicker on the worn-armor slot (legendary variant when applicable).
        if (this.armorPanel && typeof this.armorPanel.getBounds === 'function') {
            const b = this.armorPanel.getBounds();
            this.scene.cardSystem?.playMergeEffect?.(
                b.centerX, b.centerY,
                upgradedArmor.rarity === 'legendary'
            );
        }

        // Webweaver's Thread relic: same small echo-respawn chance as a normal merge.
        const echoChance = this.scene.gameState?.relicEffects?.mergeRespawnChance || 0;
        if (echoChance > 0 && Math.random() < echoChance) {
            const sourceCard = Math.random() < 0.5 ? cardData : worn;
            this.scene.cardSystem?.respawnCardOnBoard?.(sourceCard);
        }

        this.scene.updateUI();
        // The upgraded armor may still merge with another matching bag copy
        // (cross-tier), so re-evaluate sparkles against the new worn armor.
        this.updateTwinkleEffects();
        return true;
    }

    equipArmor(slotIndex, draggedSprite = null) {
        // Equipping inside a shop / station is free — there's no enemy turn to spend AP on.
        if (!this.stationMode && !this.scene.useAction()) return false;

        const armorData = this.slots[slotIndex];
        if (!armorData) return false;
        
        // Clean up the dragged sprite and ALL its associated sprites immediately
        if (draggedSprite) {
            this.cleanupCardSprites(slotIndex, draggedSprite);
            draggedSprite.destroy();
        }
        
        // If there's already armor equipped, swap it back to inventory
        if (this.scene.gameState.equippedArmor) {
            const oldArmor = this.scene.gameState.equippedArmor;
            this.slots[slotIndex] = oldArmor;
            this.syncGameStateInventory();
            this.scene.gameState.equippedArmor = null;
            this.rebuildInventorySprites();
        } else {
            this.removeCard(slotIndex);
        }
        
        // Equip the new armor
        this.scene.gameState.equippedArmor = armorData;
        SoundHelper.playSound(this.scene, 'armor_equip', 0.6);
        
        this.scene.createFloatingText(
            this.scene.playerAvatar.x, 
            this.scene.playerAvatar.y, 
            `Equipped ${armorData.name}`,
            0xaaaaaa
        );
        this.scene.updateUI();
        // Refresh AFTER equippedArmor is set and the armor-panel sprite is
        // rebuilt (by updateUI) so a matching bag armor + the worn slot sparkle.
        this.updateTwinkleEffects();
        return true;
    }

    unequipArmor() {
        const armor = this.scene.gameState.equippedArmor;
        if (!armor) return false;

        const emptySlot = this.slots.findIndex(slot => slot === null);
        if (emptySlot === -1) {
            this.scene.createFloatingText(this.scene.playerAvatar.x, this.scene.playerAvatar.y, 'Inventory Full!', 0xff0000);
            return false;
        }

        this.scene.gameState.equippedArmor = null;
        this.addCardDirect(armor, emptySlot);
        this.updateTwinkleEffects();
        this.syncGameStateInventory();

        SoundHelper.playSound(this.scene, 'armor_equip', 0.5);
        this.scene.createFloatingText(
            this.scene.playerAvatar.x,
            this.scene.playerAvatar.y,
            `Unequipped ${armor.name}`,
            0xaaaaaa
        );
        this.scene.updateUI();
        return true;
    }

    mergeCards(indexA, indexB, draggedSprite) {
        const cardA = this.slots[indexA];
        const cardB = this.slots[indexB];
        
        // Check if cross-tier merge is allowed (Golden Hammer)
        const canCrossTier = this.scene.amuletManager && 
            this.scene.amuletManager.canCrossTierMerge();
        
        if (!canCrossTier) {
            // Normal merge - must be same rarity
            if (cardA.rarity !== cardB.rarity) {
                this.scene.createFloatingText(512, 400, 'Items must be same tier!', 0xff0000);
                this.returnCardToSlot(indexA, draggedSprite);
                return;
            }
        }
        
        // Determine which card is higher tier for upgrade
        const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        const indexA_tier = rarityOrder.indexOf(cardA.rarity);
        const indexB_tier = rarityOrder.indexOf(cardB.rarity);
        
        let baseCard = cardA;
        let secondCard = cardB;
        if (canCrossTier && indexA_tier !== indexB_tier) {
            // Use the higher tier card as base
            if (indexA_tier > indexB_tier) {
                baseCard = cardA;
                secondCard = cardB;
            } else {
                baseCard = cardB;
                secondCard = cardA;
            }
        }

        // Create upgraded card using CardDataGenerator and handle durability combining
        const upgradedCard = this.createMergedCard(baseCard, secondCard);
        
        // Clean up dragged sprite and its info text
        if (draggedSprite) {
            this.cleanupCardSprites(indexA, draggedSprite);
            draggedSprite.destroy();
        }
        
        // Remove cards (higher index first to avoid index shifting)
        const firstIndex = Math.max(indexA, indexB);
        const secondIndex = Math.min(indexA, indexB);
        this.removeCard(firstIndex, true);
        this.removeCard(secondIndex, true);
        
        // Add upgraded card. Target the slot it will land in (first free one)
        // up front so we can play the merge flicker on top of it afterward.
        const mergedSlot = this.slots.findIndex(slot => slot === null);
        this.addCard(upgradedCard, mergedSlot);
        const mergedWeaponType = this.getWeaponTypeFromCard(upgradedCard);
        if (upgradedCard?.type === 'weapon' && mergedWeaponType) {
            this.scene.events.emit('tutorialProgress', `merged:${mergedWeaponType}`);
            this.scene.tutorialManager?._handleProgress?.(`merged:${mergedWeaponType}`);
        }

        // Merge flicker on top of the freshly merged card (legendary variant for
        // legendary results).
        const mergedSlotSprite = mergedSlot !== -1 ? this.slotSprites[mergedSlot] : null;
        if (mergedSlotSprite?.background) {
            this.scene.cardSystem?.playMergeEffect?.(
                mergedSlotSprite.background.x,
                mergedSlotSprite.background.y,
                upgradedCard.rarity === 'legendary'
            );
        }

        this.scene.createFloatingText(512, 400, 'Cards Merged!', 0x00ff00);
        SoundHelper.playSound(this.scene, 'card_merge', 0.55);

        // Webweaver's Thread relic: small chance one of the two consumed cards reappears
        // on the floor board face-down. Picks one of the source cards at random
        // so the player can't predict which copy comes back.
        const echoChance = this.scene.gameState?.relicEffects?.mergeRespawnChance || 0;
        if (echoChance > 0 && Math.random() < echoChance) {
            const sourceCard = Math.random() < 0.5 ? cardA : cardB;
            this.scene.cardSystem?.respawnCardOnBoard?.(sourceCard);
        }
    }

    removeCard(slotIndex, destroySprite = true) {
        this.hideCardTooltip();
        const removedCard = this.slots?.[slotIndex];
        if (removedCard?.tutorialTag) {
            this.scene.events.emit('tutorialProgress', `inventoryRemoved:${removedCard.tutorialTag}`);
            this.scene.tutorialManager?._handleProgress?.(`inventoryRemoved:${removedCard.tutorialTag}`);
        }
        const slotSprite = this.slotSprites[slotIndex];
        if (destroySprite && slotSprite) {
            // Clean up all associated sprites
            if (slotSprite.card) {
                const infoText = slotSprite.card.getData('infoText');
                if (infoText) {
                    if (infoText.list) {
                        infoText.destroy(true);
                    } else {
                        infoText.destroy();
                    }
                }
                slotSprite.card.destroy();
            }
            
            if (slotSprite.twinkleSprite) {
                slotSprite.twinkleSprite.destroy();
                slotSprite.twinkleSprite = null;
            }
            
            if (slotSprite.hoverSprite) {
                slotSprite.hoverSprite.destroy();
                slotSprite.hoverSprite = null;
            }

            if (slotSprite.gemEffectSprite) {
                slotSprite.gemEffectSprite.destroy();
                slotSprite.gemEffectSprite = null;
            }

            if (slotSprite.gemIndicator) {
                slotSprite.gemIndicator.destroy();
                slotSprite.gemIndicator = null;
            }
            
            if (slotSprite.shadow) {
                slotSprite.shadow.destroy();
                slotSprite.shadow = null;
            }
            
            slotSprite.card = null;
        }
        
        this.slots[slotIndex] = null;
        this.syncGameStateInventory();
        this.updateTwinkleEffects();
    }
}

Object.assign(
    InventorySystem.prototype,
    CardMergeRules,
    InventoryCombatUse,
    InventoryView,
    InventorySlotRenderer
);

import { SoundHelper } from '../../audio/SoundHelper.js';
import { snapOriginToPixelGrid } from '../../ui/PixelSnap.js';
import { CardDataGenerator } from '../loot/CardDataGenerator.js';

export const InventorySlotRenderer = {
    // New method that doesn't trigger rebuilds
    addCardDirect(cardData, slotIndex) {
        // Ensure the slot index is valid
        if (slotIndex >= this.slots.length || slotIndex < 0) return;

        cardData = this.normalizeCardIdentity(cardData);
        cardData = this.canonicalizeCardStats(cardData);

        this.slots[slotIndex] = cardData;
        this.syncGameStateInventory();
        
        const slotSprite = this.slotSprites[slotIndex];
        if (!slotSprite || !slotSprite.background) return;
        
        const x = slotSprite.background.x;
        const y = slotSprite.background.y;
        
        let cardSprite;
        if (cardData.sprite) {
            cardSprite = snapOriginToPixelGrid(this.scene.add.image(x, y, cardData.sprite, cardData.spriteFrame));
        } else {
            const colors = {
                armor: 0x888888,
                magic: 0x9932cc,
                gem: cardData.color || 0xffe066
            };
            cardSprite = this.scene.add.rectangle(x, y, 45, 65, colors[cardData.type] || 0x666666);
        }
        
        this.uiGroup.add(cardSprite);
        cardSprite.setScale(1);
        cardSprite.setDepth(12);

        // Use the gameplay property as the single source of truth: saved and
        // merged Briar Room cards automatically regain their authored border.
        if ((cardData.briarDamageBonus || 0) > 0 && this.scene.textures.exists('thornFrame')) {
            const briarFrame = snapOriginToPixelGrid(this.scene.add.image(x, y, 'thornFrame'));
            briarFrame.setDisplaySize(cardSprite.displayWidth || 54, cardSprite.displayHeight || 70);
            briarFrame.setDepth(16);
            this.uiGroup.add(briarFrame);
            slotSprite.briarFrame = briarFrame;
            cardSprite.setData('briarFrame', briarFrame);
            cardSprite.once('destroy', () => {
                briarFrame.destroy();
                if (slotSprite.briarFrame === briarFrame) slotSprite.briarFrame = null;
            });
        }
        
        // IMPORTANT: Set the initial position data
        cardSprite.setData('originalX', x);
        cardSprite.setData('originalY', y);
        cardSprite.setData('slotIndex', slotIndex);
        
        // Make interactive AFTER setting position data
        cardSprite.setInteractive({ draggable: true });
        
        // Cards get a drop-shadow and the hover shine; gems/relics do not.
        const isCard = this.isCardItem(cardData);

        // Create shadow for hover effect (initially hidden) — cards only
        if (isCard) {
            const shadow = this.scene.add.rectangle(x, y + 28, 52, 15, 0x000000, 0.6);
            shadow.setAlpha(0);
            shadow.setDepth(11);
            this.uiGroup.add(shadow);
            slotSprite.shadow = shadow;
        }

        // Create hover "shine" animation sprite (initially hidden) — cards only
        if (isCard) {
            const hoverSprite = snapOriginToPixelGrid(this.scene.add.sprite(x, y, 'hoverCardsUpSheet', 0));
            hoverSprite.setVisible(false);
            hoverSprite.setBlendMode(Phaser.BlendModes.SCREEN);
            hoverSprite.setDepth(13);
            this.uiGroup.add(hoverSprite);
            slotSprite.hoverSprite = hoverSprite;
        }

        // Create gem effect overlay sprite for weapons with a socketed gem
        if (cardData.type === 'weapon' && cardData.gemEffect &&
            this.scene.anims?.exists?.(`gem_card_${cardData.gemEffect}_loop`)) {
            const gemEffectSprite = this.scene.add.sprite(x, y, 'gemEffectsOnCards', 0);
            gemEffectSprite.setVisible(false);
            gemEffectSprite.setDepth(14);
            this.uiGroup.add(gemEffectSprite);
            slotSprite.gemEffectSprite = gemEffectSprite;
            cardSprite.setData('gemEffectSprite', gemEffectSprite);

            // Static gem indicator(s) in top-right corner of card — one per stacked gem
            const gemFrameByEffect = { fire: 0, poison: 6, lightning: 12 };
            const gemFrame = gemFrameByEffect[cardData.gemEffect] ?? 0;
            const stackCount = CardDataGenerator.weaponGemStack(cardData);

            // Compute top-right corner of card with a 1px inset.
            // Round to integers so the gem indicator doesn't jitter a pixel
            // when a neighbouring card's blend-mode hover sprite forces a
            // render-batch flush.
            const halfW = (cardSprite.displayWidth || 45) / 2;
            const halfH = (cardSprite.displayHeight || 65) / 2;
            const gemX = Math.round(x + halfW - 1);
            const gemY = Math.round(y - halfH + 1);

            // Container holds one sprite per stack. Each gem is fully visible —
            // 16px tall, spaced 16px apart so they sit directly under each other.
            const GEM_SPACING = 16;
            const gemContainer = this.scene.add.container(gemX, gemY);
            for (let s = 0; s < stackCount; s++) {
                const child = this.scene.add.sprite(0, s * GEM_SPACING, 'gemsRGY', gemFrame);
                child.setOrigin(1, 0);
                gemContainer.add(child);
            }
            gemContainer.setDepth(15);
            this.uiGroup.add(gemContainer);
            gemContainer.restX = gemX;
            gemContainer.restY = gemY;
            slotSprite.gemIndicator = gemContainer;
            cardSprite.setData('gemIndicator', gemContainer);
        }

        // Store original Y position for floating effect
        slotSprite.originalY = y;
        
        // Add hover events
        cardSprite.on('pointerover', (pointer) => {
            if (!cardSprite.scene) return;
            
            // Get the current slot sprite reference
            const currentSlot = this.slotSprites[slotIndex];
            if (!currentSlot) return;
            
            // Show and animate hover sprite
            if (currentSlot.hoverSprite) {
                currentSlot.hoverSprite.setVisible(true);
                currentSlot.hoverSprite.play('hover_cards_anim');
            }

            // Play looped gem effect animation on hover (weapon with socketed gem)
            const hoveredCard = this.slots[slotIndex];
            if (currentSlot.gemEffectSprite && hoveredCard?.gemEffect) {
                currentSlot.gemEffectSprite.x = cardSprite.x;
                currentSlot.gemEffectSprite.y = cardSprite.y;
                currentSlot.gemEffectSprite.setVisible(true);
                currentSlot.gemEffectSprite.play(`gem_card_${hoveredCard.gemEffect}_loop`);
            }
            
            // Show shadow
            if (currentSlot.shadow) {
                currentSlot.shadow.x = cardSprite.x;
                currentSlot.shadow.y = cardSprite.y + 28;
                currentSlot.shadow.setDepth(11);
                currentSlot.shadow.setAlpha(1);
            }
            
            // Float card up (round each frame so the card art and its pips lift
            // together on whole pixels — keeps the pips locked to the card)
            this.scene.tweens.add({
                targets: cardSprite,
                y: currentSlot.originalY - 5,
                duration: 150,
                ease: 'Power2',
                onUpdate: () => { cardSprite.y = Math.round(cardSprite.y); }
            });

            // Move hover sprite with card
            if (currentSlot.hoverSprite) {
                this.scene.tweens.add({
                    targets: currentSlot.hoverSprite,
                    y: currentSlot.originalY - 5,
                    duration: 150,
                    ease: 'Power2'
                });
            }

            // Move gem effect sprite with card
            if (currentSlot.gemEffectSprite && currentSlot.gemEffectSprite.visible) {
                this.scene.tweens.add({
                    targets: currentSlot.gemEffectSprite,
                    y: currentSlot.originalY - 5,
                    duration: 150,
                    ease: 'Power2'
                });
            }

            // Move gem indicator (and its colored shadow) with card
            if (currentSlot.gemIndicator) {
                const indicator = currentSlot.gemIndicator;
                this.scene.tweens.add({
                    targets: indicator,
                    y: indicator.restY - 5,
                    duration: 150,
                    ease: 'Power2'
                });
            }

            if (currentSlot.briarFrame?.scene) {
                this.scene.tweens.add({
                    targets: currentSlot.briarFrame,
                    y: currentSlot.originalY - 5,
                    duration: 150,
                    ease: 'Power2'
                });
            }

            // Move info text if it exists. Round y each frame so the pip
            // container never sits on a fractional pixel during the lift —
            // otherwise the pips visibly jitter as it animates.
            const infoText = cardSprite.getData('infoText');
            if (infoText && infoText.scene) {
                this.scene.tweens.add({
                    targets: infoText,
                    y: currentSlot.originalY - 5,
                    duration: 150,
                    ease: 'Power2',
                    onUpdate: () => { infoText.y = Math.round(infoText.y); }
                });
            }
            
            // Move twinkle sprite if it exists
            if (currentSlot.twinkleSprite && currentSlot.twinkleSprite.scene) {
                this.scene.tweens.add({
                    targets: currentSlot.twinkleSprite,
                    y: currentSlot.originalY - 5,
                    duration: 150,
                    ease: 'Power2'
                });
            }

            this.showCardTooltip(cardData, slotIndex, pointer.x, pointer.y);
        });
        
        cardSprite.on('pointerout', () => {
            if (!cardSprite.scene) return;

            this.hideCardTooltip();
            
            const currentSlot = this.slotSprites[slotIndex];
            if (!currentSlot) return;
            
            // Hide hover sprite
            if (currentSlot.hoverSprite) {
                currentSlot.hoverSprite.setVisible(false);
                currentSlot.hoverSprite.stop();
            }

            // Stop gem effect animation
            if (currentSlot.gemEffectSprite) {
                currentSlot.gemEffectSprite.stop();
                currentSlot.gemEffectSprite.setVisible(false);
                currentSlot.gemEffectSprite.y = currentSlot.originalY;
            }

            // Return gem indicator (and shadow) to resting position
            if (currentSlot.gemIndicator) {
                const indicator = currentSlot.gemIndicator;
                this.scene.tweens.add({
                    targets: indicator,
                    y: indicator.restY,
                    duration: 150,
                    ease: 'Power2'
                });
            }

            if (currentSlot.briarFrame?.scene) {
                this.scene.tweens.add({
                    targets: currentSlot.briarFrame,
                    y: currentSlot.originalY,
                    duration: 150,
                    ease: 'Power2'
                });
            }

            // Hide shadow
            if (currentSlot.shadow) {
                currentSlot.shadow.x = cardSprite.x;
                currentSlot.shadow.y = cardSprite.y + 28;
                currentSlot.shadow.setDepth(11);
                currentSlot.shadow.setAlpha(0);
            }
            
            // Return card to original position (round each frame to keep the
            // card and its pips on whole pixels during the drop)
            this.scene.tweens.add({
                targets: cardSprite,
                y: currentSlot.originalY,
                duration: 150,
                ease: 'Power2',
                onUpdate: () => { cardSprite.y = Math.round(cardSprite.y); }
            });

            // Return hover sprite to original position
            if (currentSlot.hoverSprite) {
                this.scene.tweens.add({
                    targets: currentSlot.hoverSprite,
                    y: currentSlot.originalY,
                    duration: 150,
                    ease: 'Power2'
                });
            }
            
            // Return info text to original position (round each frame so the
            // pips stay on whole pixels during the drop).
            const infoText = cardSprite.getData('infoText');
            if (infoText && infoText.scene) {
                this.scene.tweens.add({
                    targets: infoText,
                    y: currentSlot.originalY,
                    duration: 150,
                    ease: 'Power2',
                    onUpdate: () => { infoText.y = Math.round(infoText.y); }
                });
            }
            
            // Return twinkle sprite to original position
            if (currentSlot.twinkleSprite && currentSlot.twinkleSprite.scene) {
                this.scene.tweens.add({
                    targets: currentSlot.twinkleSprite,
                    y: currentSlot.originalY,
                    duration: 150,
                    ease: 'Power2'
                });
            }
        });
        
        // Add drag events with proper position tracking
        cardSprite.on('dragstart', () => {
            if (!cardSprite.scene) return;
            this.hideCardTooltip();
            SoundHelper.playVariant(this.scene, 'card_place', 0.4);

            // Store the starting position
            cardSprite.setData('dragStartX', cardSprite.x);
            cardSprite.setData('dragStartY', cardSprite.y);
            
            if (typeof cardSprite.setTint === 'function') {
                cardSprite.setTint(0xffff00);
            }
            // Float the dragged card above every other slot's pips/info, which sit
            // at depth 1001 — otherwise other cards' durability dots draw on top of it.
            const dragBaseDepth = this.scene.tutorialManager?.overlay?.RAISE_DEPTH
                ? this.scene.tutorialManager.overlay.RAISE_DEPTH + 5
                : 1002;
            cardSprite.setDepth(dragBaseDepth);
            const draggedInfo = cardSprite.getData('infoText');
            draggedInfo?.setDepth?.(dragBaseDepth + 1);

            const currentSlot = this.slotSprites[slotIndex];
            if (!currentSlot) return;
            
            // Hide hover animation when dragging
            if (currentSlot.hoverSprite) {
                currentSlot.hoverSprite.setVisible(false);
                currentSlot.hoverSprite.stop();
            }

            // Hide gem effect animation when dragging
            if (currentSlot.gemEffectSprite) {
                currentSlot.gemEffectSprite.stop();
                currentSlot.gemEffectSprite.setVisible(false);
            }

            // Keep the gem indicator visible while dragging and bring it above the
            // card so the socketed gem travels with the card instead of vanishing.
            if (currentSlot.gemIndicator) {
                currentSlot.gemIndicator.setVisible(true);
                currentSlot.gemIndicator.setDepth(dragBaseDepth + 2);
                if (currentSlot.gemIndicator.shadow) {
                    currentSlot.gemIndicator.shadow.setVisible(true);
                    currentSlot.gemIndicator.shadow.setDepth(dragBaseDepth + 1);
                }
            }

            if (currentSlot.briarFrame?.scene) {
                currentSlot.briarFrame.setVisible(true).setDepth(dragBaseDepth + 3);
            }

            // Keep shadow visible while dragging
            if (currentSlot.shadow) {
                currentSlot.shadow.setAlpha(1);
                currentSlot.shadow.setDepth(999);
            }
            
            // Bring twinkle sprite to front if it exists (above the dragged card)
            if (currentSlot.twinkleSprite) {
                currentSlot.twinkleSprite.setDepth(dragBaseDepth + 2);
            }

            this.createDragOverlay(cardSprite, slotIndex);
        });
        
        cardSprite.on('drag', (pointer, dragX, dragY) => {
            if (!cardSprite.scene) return;
            
            // Round to whole pixels: the pip container's children are pixel-art
            // sprites, and at fractional positions roundPixels rounds each pip
            // independently, making their spacing jitter (pips appear to shift /
            // shrink and grow). Integer positions keep them rock-steady.
            cardSprite.x = Math.round(Phaser.Math.Clamp(dragX, 0, 640));
            cardSprite.y = Math.round(Phaser.Math.Clamp(dragY, 0, 360));

            const infoText = cardSprite.getData('infoText');
            if (infoText && infoText.scene) {
                infoText.x = cardSprite.x;
                infoText.y = cardSprite.y;
            }
            
            const currentSlot = this.slotSprites[slotIndex];
            if (!currentSlot) return;
            
            // Move shadow with card while dragging
            if (currentSlot.shadow && currentSlot.shadow.scene) {
                currentSlot.shadow.x = cardSprite.x;
                currentSlot.shadow.y = cardSprite.y + 28;
            }
            
            // Move twinkle sprite with the card
            if (currentSlot.twinkleSprite && currentSlot.twinkleSprite.scene) {
                currentSlot.twinkleSprite.x = cardSprite.x;
                currentSlot.twinkleSprite.y = cardSprite.y;
            }

            // Move the gem indicator with the card, preserving its corner offset.
            if (currentSlot.gemIndicator && currentSlot.gemIndicator.scene) {
                const indicator = currentSlot.gemIndicator;
                const ox = cardSprite.getData('originalX');
                const oy = cardSprite.getData('originalY');
                indicator.x = cardSprite.x + (indicator.restX - ox);
                indicator.y = cardSprite.y + (indicator.restY - oy);
                if (indicator.shadow && indicator.shadow.scene) {
                    indicator.shadow.x = indicator.x;
                    indicator.shadow.y = indicator.y;
                }
            }

            if (currentSlot.briarFrame?.scene) {
                currentSlot.briarFrame.x = cardSprite.x;
                currentSlot.briarFrame.y = cardSprite.y;
            }


            this.updateDragOverlay(cardSprite);
            this.updateFireReachIndicator(cardSprite, slotIndex);
        });

        cardSprite.on('dragend', () => {
            // Ahead of the scene guard below: if the card was destroyed mid-drag
            // the ring has no owner left to clear it and would sit on the board.
            this.destroyFireReachIndicator();
            if (!cardSprite.scene) return;

            if (typeof cardSprite.clearTint === 'function') {
                cardSprite.clearTint();
            }
            this.destroyDragOverlay();
            this.applySlotVisualDepths(slotIndex);
            
            const currentSlot = this.slotSprites[slotIndex];
            if (currentSlot) {
                // Hide shadow after drag
                if (currentSlot.shadow) {
                    currentSlot.shadow.setAlpha(0);
                }
                
                // Reset twinkle depth
                if (currentSlot.twinkleSprite) {
                    currentSlot.twinkleSprite.setDepth(this.getInventoryDepths().twinkle);
                }
            }
            
            // Validate the drop position
            this.handleCardDrop(slotIndex, cardSprite);
        });
        
        slotSprite.card = cardSprite;
        
        // Add info text
        const cardWithSprite = { sprite: cardSprite, data: cardData, infoText: null };
        this.scene.cardSystem.createCardInfoText(cardWithSprite);
        if (cardWithSprite.infoText) {
            this.uiGroup.add(cardWithSprite.infoText);
            cardSprite.setData('infoText', cardWithSprite.infoText);
        }
        this.applySlotVisualDepths(slotIndex);
    },
};

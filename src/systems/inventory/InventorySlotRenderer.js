import { SoundHelper } from '../../audio/SoundHelper.js';
import { snapOriginToPixelGrid } from '../../ui/PixelSnap.js';
import { CardDataGenerator } from '../loot/CardDataGenerator.js';
import { gemTierFrame } from '../../content/cards/gems.js';
import { attachGemShine } from '../../ui/GemShine.js';
import { GEM_SPOT_KEY, gemSpotPosition } from '../../ui/GemSockets.js';

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

        // A Reliquary-enchanted weapon renders brighter than an ordinary card.
        // This rides on the sprite itself rather than being a separate overlay
        // (like briarFrame), so it follows the card through drags, hovers and
        // rebuilds for free — and unlike a tint it survives the clearTint()
        // that the drag handler runs on dragend. WebGL-only; on the Canvas
        // renderer the optional chaining just leaves the card as it was.
        if (cardData.enchant) {
            cardSprite.preFX?.addColorMatrix()?.brightness(1.35);
        }
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

            // One gem in the card's top-right corner, drawn at the size its
            // level earns: small shard, shard, small gem, medium gem, big gem.
            // It used to be a column of identical 16px icons, one per level,
            // which said the same thing in more pixels.
            const gemTier = CardDataGenerator.weaponGemStack(cardData);
            const gemFrame = gemTierFrame(cardData.gemEffect, gemTier);

            // Top middle, tucked inside the card's top edge — the gem sets
            // into a socket there rather than perching on the corner. Rounded
            // to whole pixels so it cannot jitter when a neighbouring card's
            // blend-mode hover sprite forces a render-batch flush.
            const spotAt = gemSpotPosition(cardSprite);
            const gemX = spotAt.x;
            const gemY = spotAt.y;

            const gemContainer = this.scene.add.container(gemX, gemY);
            // The socket first, then the stone on top of it: set in, not stuck on.
            if (this.scene.textures.exists(GEM_SPOT_KEY)) {
                gemContainer.add(this.scene.add.image(0, 0, GEM_SPOT_KEY));
            }
            const gemSprite = this.scene.add.sprite(0, 0, 'gemsTiered', gemFrame);
            gemContainer.add(gemSprite);
            attachGemShine(this.scene, gemSprite, { container: gemContainer });
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

            SoundHelper.playSound(this.scene, 'ui_card_hover', 0.35);

            // The socketed gem catches the light while the card is under the
            // pointer. Masked to the stone, so it never spills onto the card.
            currentSlot.gemIndicator?.startGemShine?.();

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

            if (currentSlot.webOverlay?.scene) {
                this.scene.tweens.add({
                    targets: currentSlot.webOverlay,
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

            this.showCardTooltip(cardData, slotIndex, pointer.worldX, pointer.worldY);
        });
        
        cardSprite.on('pointerout', () => {
            if (!cardSprite.scene) return;

            this.hideCardTooltip();
            
            const currentSlot = this.slotSprites[slotIndex];
            if (!currentSlot) return;

            currentSlot.gemIndicator?.stopGemShine?.();

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

            if (currentSlot.webOverlay?.scene) {
                this.scene.tweens.add({
                    targets: currentSlot.webOverlay,
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
            // Silkslinger web: card cannot be dragged while locked.
            if (cardSprite.getData('webbedLocked') || (this.slots[slotIndex]?.webbedTurns > 0)) {
                this.scene.input?.setDraggable?.(cardSprite, false);
                this.scene.createFloatingText?.(cardSprite.x, cardSprite.y - 18, 'Webbed!', 0xddeeff);
                return;
            }
            this.hideCardTooltip();
            SoundHelper.playVariant(this.scene, 'card_place', 0.4);

            // Kill the hover lift before the drag starts writing positions.
            //
            // Hovering a card starts a 150ms tween on each thing that rides it —
            // the gem and its socket, the thorn frame, the web. The drag handler
            // then sets those positions directly every frame, so for the first
            // 150ms of a drag the tween and the drag were both writing y, and
            // the tween won often enough that the gem visibly trailed the card.
            // The card's own value never lagged because it is set directly and
            // never tweened, which is the tell.
            const currentSlotAtDragStart = this.slotSprites[slotIndex];
            if (currentSlotAtDragStart) {
                this.scene.tweens.killTweensOf([
                    currentSlotAtDragStart.gemIndicator,
                    currentSlotAtDragStart.briarFrame,
                    currentSlotAtDragStart.webOverlay,
                    currentSlotAtDragStart.shadow,
                    currentSlotAtDragStart.twinkleSprite,
                    currentSlotAtDragStart.gemEffectSprite,
                ].filter((target) => target?.scene));
            }

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
            if (currentSlot.webOverlay?.scene) {
                currentSlot.webOverlay.setVisible(true).setDepth(dragBaseDepth + 4);
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
            this.beginInventoryCardDrag(slotIndex, cardSprite);
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
            if (currentSlot.webOverlay?.scene) {
                currentSlot.webOverlay.x = cardSprite.x;
                currentSlot.webOverlay.y = cardSprite.y;
            }


            this.updateDragOverlay(cardSprite);
            this.updateWeaponAttackIndicator(cardSprite, slotIndex);
            this.updateFireReachIndicator(cardSprite, slotIndex);
        });

        cardSprite.on('dragend', () => {
            this.finishInventoryCardDrag(slotIndex, cardSprite);
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
        if ((cardData.webbedTurns || 0) > 0) {
            this.applyWebOverlay(slotIndex);
        }
    },
};

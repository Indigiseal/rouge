import { SoundHelper } from '../../audio/SoundHelper.js';
import { snapOriginToPixelGrid } from '../../ui/PixelSnap.js';
import { showGemSockets } from '../../ui/GemSockets.js';
import { buildCardDecorations } from '../../ui/CardDecorations.js';
import { handLockOf } from '../../content/combat/handLock.js';
import { bindCardRiders, cardRiders, pinRider } from '../../ui/CardRiders.js';

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
                armor: 0x869089,
                magic: 0x712a65,
                gem: cardData.color || 0xffcf7f
            };
            cardSprite = this.scene.add.rectangle(x, y, 45, 65, colors[cardData.type] || 0x6e7470);
        }
        
        this.uiGroup.add(cardSprite);
        cardSprite.setScale(1);

        cardSprite.setDepth(12);

        // Enchant glow, Briar Room thorn frame and socketed gem: shared with
        // the anvil (ui/CardDecorations.js). Read off the card's own data, so
        // saved and merged cards regain them automatically.
        const decor = buildCardDecorations(this.scene, cardSprite, cardData);
        if (decor.briarFrame) {
            const briarFrame = decor.briarFrame;
            briarFrame.setDepth(16);
            this.uiGroup.add(briarFrame);
            slotSprite.briarFrame = briarFrame;
            cardSprite.setData('briarFrame', briarFrame);
            pinRider(cardSprite, 'briarFrame', briarFrame);
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
            pinRider(cardSprite, 'hoverShine', hoverSprite);
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
            pinRider(cardSprite, 'gemEffect', gemEffectSprite);
        }

        // The stone in its socket at the top (from buildCardDecorations above),
        // sized by gem level: small shard up to big gem.
        if (decor.gemIndicator) {
            const gemContainer = decor.gemIndicator;
            gemContainer.setDepth(15);
            this.uiGroup.add(gemContainer);
            slotSprite.gemIndicator = gemContainer;
            cardSprite.setData('gemIndicator', gemContainer);
            pinRider(cardSprite, 'gem', gemContainer, { dx: gemContainer.restX - x, dy: gemContainer.restY - y });
        }

        // Store original Y position for floating effect
        slotSprite.originalY = y;
        
        // Add hover events
        cardSprite.on('pointerover', (pointer) => {
            if (!cardSprite.scene) return;

            // A card already in hand is not being hovered. Without this the
            // lift tween restarts mid-drag and fights the drag handler, which
            // is writing the same positions directly, for another 150ms.
            // Tested against _liveDrag rather than the inventoryDragging flag:
            // _liveDrag is cleared the moment a drop is claimed, so this can
            // never latch a card out of its hover.
            if (this._liveDrag?.cardSprite === cardSprite) return;

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
            
            // Float card up. Everything drawn on it rides along (CardRiders),
            // so the card is the only thing that needs moving.
            this.scene.tweens.add({
                targets: cardSprite,
                y: currentSlot.originalY - 5,
                duration: 150,
                ease: 'Power2',
                onUpdate: () => { cardSprite.y = Math.round(cardSprite.y); }
            });

            this.showCardTooltip(cardData, slotIndex, pointer.worldX, pointer.worldY);
        });
        
        cardSprite.on('pointerout', () => {
            if (!cardSprite.scene) return;

            this.hideCardTooltip();

            // Drag fast enough for the pointer to outrun the card and Phaser
            // fires pointerout mid-drag. Everything below returns the card and
            // its riders to their resting slot positions, which would tween
            // them home while the drag is still writing them — that fight is
            // the "sometimes" in the trailing pips. The drop path is what puts
            // the card back, so there is nothing to restore here anyway.
            if (this._liveDrag?.cardSprite === cardSprite) return;

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
            }

            // Hide shadow
            if (currentSlot.shadow) {
                currentSlot.shadow.x = cardSprite.x;
                currentSlot.shadow.y = cardSprite.y + 28;
                currentSlot.shadow.setDepth(11);
                currentSlot.shadow.setAlpha(0);
            }
            
            // Return card to original position; its riders come with it.
            this.scene.tweens.add({
                targets: cardSprite,
                y: currentSlot.originalY,
                duration: 150,
                ease: 'Power2',
                onUpdate: () => { cardSprite.y = Math.round(cardSprite.y); }
            });
        });
        
        // Add drag events with proper position tracking
        cardSprite.on('dragstart', () => {
            if (!cardSprite.scene) return;
            // Silkslinger web: card cannot be dragged while locked.
            if (cardSprite.getData('webbedLocked') || (this.slots[slotIndex]?.webbedTurns > 0)) {
                this.scene.input?.setDraggable?.(cardSprite, false);
                this.scene.createFloatingText?.(cardSprite.x, cardSprite.y - 18, handLockOf(this.slots[slotIndex]).text, 0xd6c2c1);
                return;
            }
            this.hideCardTooltip();
            SoundHelper.playVariant(this.scene, 'card_place', 0.4);

            // Kill the hover lift before the drag starts writing positions:
            // for the first 150ms of a drag the tween and the drag were both
            // writing y, and the tween won often enough that the card stuttered.
            // The riders are pinned to the card, so the card's own tween is the
            // only one that matters; theirs are killed in case anything else
            // started one.
            this.scene.tweens.killTweensOf([cardSprite, ...cardRiders(cardSprite)]);

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

            // A carried gem lights the empty sockets on the weapons it can go
            // into, the same hint a gem dragged off the board or the shelf
            // shows. Taken down in finishInventoryCardDrag.
            if (this.slots[slotIndex]?.type === 'gem') {
                showGemSockets(this.scene, this.slots[slotIndex]);
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

            // Everything drawn on the card rides it (CardRiders). The shadow
            // is not a rider — on hover it stays on the slot — so it follows
            // the drag by hand.
            const currentSlot = this.slotSprites[slotIndex];
            if (currentSlot?.shadow?.scene) {
                currentSlot.shadow.x = cardSprite.x;
                currentSlot.shadow.y = cardSprite.y + 28;
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
        this.bindInfoTextFollow(cardSprite);
        this.applySlotVisualDepths(slotIndex);
        if ((cardData.webbedTurns || 0) > 0) {
            this.applyWebOverlay(slotIndex);
        }
    },

    // Pin everything drawn on the card to it, once per frame (see CardRiders).
    bindInfoTextFollow(cardSprite) {
        bindCardRiders(this.scene, cardSprite);
    },
};

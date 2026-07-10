import { SoundHelper } from './utils/SoundHelper.js';
import { snapOriginToPixelGrid } from './utils/PixelSnap.js';
import { t, translateCardType, translateDescription, translateGemEffect, translateItemName, translateRarity } from './utils/i18n.js';
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
    
    setVisibility(isVisible) {
        if (this.uiGroup) {
            this.uiGroup.setVisible(isVisible);
            if (isVisible) {
                this.rebuildInventorySprites(); // Force redraw on show
            }
        }
    }
    getCurrentWeapon() {
        return this.scene.gameState?.equippedWeapon || null;
    }

    // Gems and relics/amulets are standalone trinkets, not cards. They don't
    // get the rectangular card drop-shadow or the hover "shine" animation.
    isCardItem(item) {
        const t = item?.type;
        return t !== 'gem' && t !== 'amulet' && t !== 'relic';
    }

    setStationMode(isStationMode) {
        this.stationMode = isStationMode;
        this.applyInventoryVisualDepths();
    }

    getInventoryDepths() {
        return this.stationMode
            ? {
                panel: 200,
                background: 201,
                shadow: 202,
                card: 203,
                info: 204,
                hover: 205,
                gemEffect: 206,
                gemIndicator: 207,
                briarFrame: 208,
                twinkle: 208
            }
            : {
                panel: 10,
                background: 11,
                shadow: 11,
                card: 12,
                info: 1001,
                hover: 13,
                gemEffect: 14,
                gemIndicator: 15,
                briarFrame: 16,
                twinkle: 100
            };
    }

    applyInventoryVisualDepths() {
        const depths = this.getInventoryDepths();
        this.inventoryPanelPieces?.forEach(piece => piece?.setDepth?.(depths.panel));
        this.slotSprites?.forEach((slot, index) => this.applySlotVisualDepths(index));
    }

    applySlotVisualDepths(slotIndex) {
        const slot = this.slotSprites?.[slotIndex];
        if (!slot) return;
        const depths = this.getInventoryDepths();

        slot.background?.setDepth?.(depths.background);
        slot.shadow?.setDepth?.(depths.shadow);
        slot.card?.setDepth?.(depths.card);

        const infoText = slot.card?.getData?.('infoText');
        infoText?.setDepth?.(depths.info);

        slot.hoverSprite?.setDepth?.(depths.hover);
        slot.gemEffectSprite?.setDepth?.(depths.gemEffect);
        slot.gemIndicator?.setDepth?.(depths.gemIndicator);
        slot.briarFrame?.setDepth?.(depths.briarFrame);
        slot.twinkleSprite?.setDepth?.(depths.twinkle);
    }
    
    setDiscardArea(discardArea) {
        this.discardArea = discardArea;
    }

    setArmorPanel(armorPanel) {
        this.armorPanel = armorPanel;
    }

    // Custom drop targets a scene can register for the duration of an
    // interaction (e.g. the copying-mirror event). Each handler is called with
    // (slotIndex, cardData, cardSprite) when a dragged card is released over the
    // zone, and returns true if it consumed the drop (taking responsibility for
    // the dragged sprite). Cleared when the interaction ends.
    addDropZone(zone, handler) {
        if (!zone || typeof handler !== 'function') return;
        (this.dropZones ||= []).push({ zone, handler });
    }

    clearDropZones() {
        this.dropZones = [];
    }

    // A station may render above GameScene (EventScene does this for the mirror
    // and well). Depth values cannot cross Phaser scene boundaries, so a card
    // dragged out of the inventory needs a synchronized visual in that upper
    // scene. The real card still moves and performs all drop detection.
    setDragOverlayScene(scene = null) {
        if (this.dragOverlayScene === scene) return;
        this.destroyDragOverlay();
        this.dragOverlayScene = scene;
    }

    createDragOverlay(cardSprite, slotIndex) {
        this.destroyDragOverlay();
        const overlayScene = this.dragOverlayScene;
        if (!overlayScene?.add || !cardSprite?.texture?.key) return;

        const slot = this.slotSprites?.[slotIndex];
        const parts = [];
        const cloneImage = (source, depth) => {
            if (!source?.texture?.key) return null;
            const clone = overlayScene.add.image(
                source.x,
                source.y,
                source.texture.key,
                source.frame?.name
            )
                .setOrigin(source.originX ?? 0.5, source.originY ?? 0.5)
                .setScale(source.scaleX ?? 1, source.scaleY ?? 1)
                .setRotation(source.rotation || 0)
                .setAlpha(source.alpha ?? 1)
                .setDepth(depth);
            clone.setFlip?.(Boolean(source.flipX), Boolean(source.flipY));
            if (source.isTinted) {
                clone.setTint?.(
                    source.tintTopLeft,
                    source.tintTopRight,
                    source.tintBottomLeft,
                    source.tintBottomRight
                );
            }
            parts.push({
                clone,
                offsetX: source.x - cardSprite.x,
                offsetY: source.y - cardSprite.y
            });
            return clone;
        };

        // Clone in visual order. The real objects remain visible so Phaser's
        // drag input cannot be interrupted by hiding its active game object.
        cloneImage(slot?.shadow, 9998);
        cloneImage(cardSprite, 10000);
        cloneImage(slot?.gemIndicator?.shadow, 10001);
        cloneImage(slot?.gemIndicator, 10002);
        cloneImage(slot?.briarFrame, 10003);
        cloneImage(slot?.twinkleSprite, 10003);

        this.dragOverlay = { cardSprite, parts };
    }

    updateDragOverlay(cardSprite) {
        const overlay = this.dragOverlay;
        if (!overlay || overlay.cardSprite !== cardSprite) return;
        overlay.parts.forEach(({ clone, offsetX, offsetY }) => {
            if (!clone?.scene) return;
            clone.x = cardSprite.x + offsetX;
            clone.y = cardSprite.y + offsetY;
        });
    }

    destroyDragOverlay() {
        const overlay = this.dragOverlay;
        if (!overlay) return;
        overlay.parts?.forEach(({ clone }) => clone?.destroy?.());
        this.dragOverlay = null;
    }

    syncGameStateInventory() {
        if (this.scene.gameState) {
            this.scene.gameState.inventory = this.slots;
        }
    }
    
    createInventoryUI() {
        this.hideCardTooltip();

        // COMPLETE cleanup of existing UI sprites
        this.inventoryPanelPieces.forEach(piece => piece?.destroy());
        this.inventoryPanelPieces = [];

        this.slotSprites.forEach(slot => {
            // Clean up background
            if (slot.background) {
                slot.background.destroy();
                slot.background = null;
            }
            
            // Clean up shadow
            if (slot.shadow) {
                slot.shadow.destroy();
                slot.shadow = null;
            }
            
            // Clean up hover sprite
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
            
            // Clean up twinkle sprite
            if (slot.twinkleSprite) {
                slot.twinkleSprite.destroy();
                slot.twinkleSprite = null;
            }
            
            // Clean up card and its info if it exists
            if (slot.card) {
                const infoText = slot.card.getData('infoText');
                if (infoText) {
                    if (infoText.list) {
                        // Container with children (durability dots, etc.)
                        infoText.list.forEach(child => {
                            if (child && child.destroy) {
                                child.destroy();
                            }
                        });
                        infoText.destroy(true);
                    } else {
                        infoText.destroy();
                    }
                }
                slot.card.destroy();
                slot.card = null;
            }
        });
        
        // Clear the array
        this.slotSprites = [];
        
        // Create inventory slots based on current count
        const slotCount = this.slots.length;
        
        // Layout configuration
        const slotWidth = 50;
        const slotHeight = 70;
        const spacing = 5;
        const totalWidth = slotCount * slotWidth + (slotCount - 1) * spacing;
        const inventoryCenterX = 340;
        // Round to a whole pixel: with bonus slots totalWidth can be odd, leaving
        // the slots on a half-pixel. Fractional positions re-round (and shift 1px)
        // whenever a board card's blend-mode hover sprite forces a render-batch flush.
        const startX = Math.round(inventoryCenterX - (totalWidth / 2) + (slotWidth / 2));
        const y = 309;
        this.createInventoryPanel(inventoryCenterX, y, Math.max(368, totalWidth + 90));
        
        for (let i = 0; i < slotCount; i++) {
            const x = startX + i * (slotWidth + spacing);
            
            // Slot background
            const slotBg = this.scene.add.rectangle(x, y, slotWidth, slotHeight, 0x333333, 0.12);
            slotBg.setDepth(11);
            
            // Bonus slots have different color (yellow border for slots 5+)
            if (i >= 5) {
                slotBg.setStrokeStyle(2, 0xffd700); // Gold border for bonus slots
            } else {
                slotBg.setStrokeStyle(2, 0x666666); // Normal border
            }
            
            this.uiGroup.add(slotBg);
            
            this.slotSprites[i] = {
                background: slotBg,
                card: null,
                index: i,
                twinkleSprite: null,
                shadow: null,
                hoverSprite: null,
                gemEffectSprite: null,
                gemIndicator: null,
                briarFrame: null,
                originalY: y
            };
        }
    }

    createInventoryPanel(centerX, centerY, width) {
        if (!this.scene.textures.exists('panelCards')) return;

        const texture = this.scene.textures.get('panelCards');
        const source = texture.getSourceImage();
        const sourceWidth = source.width || 362;
        const sourceHeight = source.height || 102;
        const leftWidth = Math.floor(sourceWidth / 2);
        const rightStart = leftWidth;
        const rightWidth = sourceWidth - rightStart;
        const tileX = Math.max(0, leftWidth - 1);

        // Keep the complete artwork at native 1:1 scale. Only a plain 1px
        // center column repeats when extra horizontal room is needed.
        if (!texture.has('panelLeftHalf')) {
            texture.add('panelLeftHalf', 0, 0, 0, leftWidth, sourceHeight);
            texture.add('panelMiddleTile', 0, tileX, 0, 1, sourceHeight);
            texture.add('panelRightHalf', 0, rightStart, 0, rightWidth, sourceHeight);
        }

        const panelWidth = Math.max(sourceWidth, Math.ceil(width));
        const extraWidth = panelWidth - sourceWidth;
        // Keep the outside edge on a whole pixel even when bonus-slot widths are odd.
        const leftX = Math.round(centerX - panelWidth / 2);
        const rightX = leftX + leftWidth + extraWidth;

        // Whole-pixel edges and native-size pieces keep the pixel art crisp.
        const left = this.scene.add.image(leftX, centerY, 'panelCards', 'panelLeftHalf').setOrigin(0, 0.5);
        const middle = this.scene.add.tileSprite(
            leftX + leftWidth,
            centerY,
            extraWidth,
            sourceHeight,
            'panelCards',
            'panelMiddleTile'
        ).setOrigin(0, 0.5);
        const right = this.scene.add.image(rightX, centerY, 'panelCards', 'panelRightHalf').setOrigin(0, 0.5);

        this.inventoryPanelPieces = [left, middle, right];
        this.inventoryPanelPieces.forEach(piece => piece.setDepth(10));
        this.inventoryPanelPieces.forEach(piece => this.uiGroup.add(piece));
    }
    
    // Add method to handle Bottomless Bag acquisition
    expandInventory(additionalSlots) {
        // Store current inventory items before expanding
        const currentItems = [];
        this.slots.forEach((item, index) => {
            if (item) {
                currentItems.push({ data: item, index: index });
            }
        });
        
        // Clean up ALL existing sprites before rebuilding
        this.slotSprites.forEach(slot => {
            if (slot.card) {
                // Clean up info text completely
                const infoText = slot.card.getData('infoText');
                if (infoText) {
                    if (infoText.list) {
                        infoText.list.forEach(child => {
                            if (child && child.destroy) {
                                child.destroy();
                            }
                        });
                        infoText.destroy(true);
                    } else {
                        infoText.destroy();
                    }
                }
                slot.card.destroy();
                slot.card = null;
            }
            
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
            
            if (slot.background) {
                slot.background.destroy();
                slot.background = null;
            }
        });
        
        // Expand slots array
        const oldSize = this.slots.length;
        const newSize = oldSize + additionalSlots;
        
        // Create new slots array
        this.slots = new Array(newSize).fill(null);
        
        // Store the bonus slots count
        this.scene.gameState.bonusInventorySlots = 
            (this.scene.gameState.bonusInventorySlots || 0) + additionalSlots;
        
        // Rebuild the UI completely
        this.createInventoryUI();
        
        // Re-add items to their original positions
        currentItems.forEach(item => {
            if (item.index < newSize) {
                this.addCardDirect(item.data, item.index);
            }
        });
        
        // Update twinkle effects
        this.updateTwinkleEffects();
        
        this.scene.createFloatingText(320, 300, `+${additionalSlots} Inventory Slots!`, 0xffd700);
    }
    
    // Special rebuild method that doesn't double-preserve items
    rebuildSpritesAfterExpansion() {
        // Clear existing sprites only (don't touch slots data)
        this.slotSprites.forEach(slot => {
            if (slot.card) {
                const infoText = slot.card.getData('infoText');
                if (infoText) {
                    if (infoText.list) {
                        infoText.destroy(true);
                    } else {
                        infoText.destroy();
                    }
                }
                
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
                    if (slot.gemIndicator.shadow) slot.gemIndicator.shadow.destroy();
                    slot.gemIndicator.destroy();
                    slot.gemIndicator = null;
                }
                
                if (slot.shadow) {
                    slot.shadow.destroy();
                    slot.shadow = null;
                }
                
                slot.card.destroy();
                slot.card = null;
            }
        });
        
        // Re-add sprites for existing items (slots data unchanged)
        this.slots.forEach((cardData, index) => {
            if (cardData) {
                this.addCardDirect(cardData, index);
            }
        });
        
        // Update twinkle effects
        this.updateTwinkleEffects();
    }
    
    rebuildInventorySprites() {
        // Store the current data before clearing sprites
        const currentData = [...this.slots];
        
        // THOROUGHLY clear ALL existing sprites
        this.slotSprites.forEach(slot => {
            if (slot.card) {
                // Clean up info text (including durability dots)
                const infoText = slot.card.getData('infoText');
                if (infoText) {
                    // Check if it's a container (for weapon/armor durability display)
                    if (infoText.list) {
                        // Destroy all children in the container
                        infoText.list.forEach(child => {
                            if (child && child.destroy) {
                                child.destroy();
                            }
                        });
                        infoText.destroy(true); // Destroy container with children
                    } else {
                        infoText.destroy(); // Regular text
                    }
                }
                
                // Destroy the card sprite itself
                slot.card.destroy();
                slot.card = null;
            }
            
            // Clean up twinkle sprite
            if (slot.twinkleSprite) {
                slot.twinkleSprite.destroy();
                slot.twinkleSprite = null;
            }
            
            // Clean up hover sprite
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
            
            // Clean up shadow
            if (slot.shadow) {
                slot.shadow.destroy();
                slot.shadow = null;
            }
        });
        
        // Clear slots data
        this.slots.fill(null);
        
        // Re-add cards without triggering rebuilds
        currentData.forEach((cardData, index) => {
            if (cardData && index < this.slots.length) {
                this.addCardDirect(cardData, index);
            }
        });
        
        // Update twinkle effects only once at the end
        this.updateTwinkleEffects();
    }

    // New method that doesn't trigger rebuilds
    addCardDirect(cardData, slotIndex) {
        // Ensure the slot index is valid
        if (slotIndex >= this.slots.length || slotIndex < 0) return;

        cardData = this.normalizeCardIdentity(cardData);
        
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

            // Static gem indicator(s) in top-right corner of card — one per stacked gem
            const gemFrameByEffect = { fire: 0, poison: 6, lightning: 12 };
            const gemFrame = gemFrameByEffect[cardData.gemEffect] ?? 0;
            const stackCount = Math.max(1, Math.min(3, cardData.gemCount || 1));

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
            
            // Store the starting position
            cardSprite.setData('dragStartX', cardSprite.x);
            cardSprite.setData('dragStartY', cardSprite.y);
            
            if (typeof cardSprite.setTint === 'function') {
                cardSprite.setTint(0xffff00);
            }
            // Float the dragged card above every other slot's pips/info, which sit
            // at depth 1001 — otherwise other cards' durability dots draw on top of it.
            cardSprite.setDepth(1002);
            const draggedInfo = cardSprite.getData('infoText');
            draggedInfo?.setDepth?.(1003);

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
                currentSlot.gemIndicator.setDepth(1004);
                if (currentSlot.gemIndicator.shadow) {
                    currentSlot.gemIndicator.shadow.setVisible(true);
                    currentSlot.gemIndicator.shadow.setDepth(1003);
                }
            }

            if (currentSlot.briarFrame?.scene) {
                currentSlot.briarFrame.setVisible(true).setDepth(1005);
            }

            // Keep shadow visible while dragging
            if (currentSlot.shadow) {
                currentSlot.shadow.setAlpha(1);
                currentSlot.shadow.setDepth(999);
            }
            
            // Bring twinkle sprite to front if it exists (above the dragged card)
            if (currentSlot.twinkleSprite) {
                currentSlot.twinkleSprite.setDepth(1004);
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
        });
        
        cardSprite.on('dragend', () => {
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
    }

    addStartingCards() {
        // Grant the starter swords exactly once per run. Without this guard,
        // every startNewFloor() on floor 1 (scene create, Continue/resume,
        // restart) re-added them, stacking up 2 → 4 → 6 swords.
        if (this.scene.gameState.startingCardsGranted) return;
        if (this.scene.gameState.currentFloor > 1) return;
        this.scene.gameState.startingCardsGranted = true;
        // Add starting sword with durability
        const swordData = {
            type: 'weapon',
            name: 'Common Sword',
            weaponType: 'sword',
            damage: 6,
            rarity: 'common',
            sprite: 'sword_C',  // Fixed sprite name consistency
            durability: 6,
            maxDurability: 6,
            special: null,  // Sword has no special ability
            range: 'melee'
        };
        this.addCard(swordData);
        // Add starting uncommon sword
        const uncommonSwordData = {
            type: 'weapon',
            name: 'Uncommon Sword',
            weaponType: 'sword',
            damage: 7,
            rarity: 'uncommon',
            sprite: 'sword_U',
            durability: 8,
            maxDurability: 8,
            special: null,  // Sword has no special ability
            range: 'melee'
        };
        this.addCard(uncommonSwordData);

        // Carry-over egg: a past hero who died still clutching an unhatched egg
        // passes it to this new run. consumePendingEgg() clears the flag so the
        // egg isn't re-granted on later floor-1 re-entries (it's guarded above
        // by startingCardsGranted anyway, but the consume keeps meta clean).
        if (this.scene.metaManager?.consumePendingEgg?.()) {
            const egg = this.scene.cardSystem.cardDataGenerator.createEggCard();
            this.addCard(egg);
        }
    }

    showCardTooltip(cardData, slotIndex, pointerX, pointerY) {
        this.hideCardTooltip();
        if (!cardData) return;

        const lines = this.getCardTooltipLines(cardData, slotIndex);
        const tooltipText = this.scene.add.text(0, 0, lines.join('\n'), {
            fontSize: '8px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel", Arial, sans-serif',
            lineSpacing: 1,
            wordWrap: { width: 138 }
        }).setOrigin(0, 0);

        const width = Math.ceil(Math.min(154, Math.max(92, tooltipText.width + 10)));
        const height = Math.ceil(tooltipText.height + 10);
        const bg = this.scene.add.rectangle(0, 0, width, height, 0x111122, 0.94)
            .setOrigin(0, 0)
            .setStrokeStyle(1, 0xf2d3aa);

        const pointerPixelX = Math.round(pointerX);
        const pointerPixelY = Math.round(pointerY);
        const preferLeft = pointerPixelX + width + 14 > 640;
        const targetX = preferLeft ? pointerPixelX - width - 10 : pointerPixelX + 10;
        const targetY = pointerPixelY - Math.round(Math.min(24, height / 2));
        const clampedX = Math.round(Phaser.Math.Clamp(targetX, 6, 640 - width - 6));
        const clampedY = Math.round(Phaser.Math.Clamp(targetY, 6, 360 - height - 6));
        tooltipText.setPosition(5, 5);

        this.cardTooltip = this.scene.add.container(clampedX, clampedY, [bg, tooltipText]);
        this.cardTooltip.setDepth(3000);
        this.uiGroup.add(this.cardTooltip);
    }

    hideCardTooltip() {
        if (this.cardTooltip?.scene) {
            this.cardTooltip.destroy(true);
        }
        this.cardTooltip = null;
    }

    getCardTooltipLines(card, slotIndex) {
        card = this.normalizeCardIdentity(card);
        if (slotIndex >= 0 && this.slots[slotIndex] === card) this.syncGameStateInventory();

        const rarity = card.rarity ? translateRarity(this.scene, card.rarity) : t(this.scene, 'tooltip.noRarity');
        const type = this.getDisplayCardType(card);
        const lines = [
            translateItemName(this.scene, card) || type,
            `${type} - ${rarity}`
        ];

        if (card.type === 'weapon') {
            const weaponType = translateItemName(this.scene, { type: 'weapon', weaponType: this.getWeaponTypeFromCard(card) }).replace(translateRarity(this.scene, undefined), '').trim();
            lines.push(t(this.scene, 'tooltip.family', { value: weaponType }));
            lines.push(t(this.scene, 'tooltip.damageShort', { amount: card.damage || 0 }));
            const critChance = (this.scene?.gameState?.discardCritChance || 0)
                + (this.scene?.amuletManager?.getCriticalChanceBonus?.() || 0);
            if (critChance > 0) lines.push(`Crit: ${Math.round(critChance * 100)}%`);
            lines.push(t(this.scene, 'tooltip.range', {
                value: t(this.scene, (card.range || 'melee') === 'ranged' ? 'tooltip.ranged' : 'tooltip.melee')
            }));
            if (card.gemEffect) {
                const stack = Math.max(1, Math.min(3, card.gemCount || 1));
                lines.push(t(this.scene, 'tooltip.gemLine', {
                    effect: translateGemEffect(this.scene, card.gemEffect),
                    stack: stack > 1 ? ` x${stack}` : ''
                }));
                const baseDmg = card.damage || 0;
                if (card.gemEffect === 'fire') {
                    const splashPct = [50, 75, 100][stack - 1];
                    const splashDmg = Math.max(1, Math.floor(baseDmg * splashPct / 100));
                    lines.push(t(this.scene, 'tooltip.fireSplash', { amount: splashDmg }));
                } else if (card.gemEffect === 'lightning') {
                    const zapPct = [40, 55, 70][stack - 1];
                    const zapDmg = Math.max(1, Math.floor(baseDmg * zapPct / 100));
                    lines.push(t(this.scene, 'tooltip.lightningZap', { amount: zapDmg }));
                } else if (card.gemEffect === 'poison') {
                    lines.push(t(this.scene, 'tooltip.poisonStacks', { stack, plural: stack > 1 ? 's' : '' }));
                }
            }
            if (card.special) lines.push(t(this.scene, 'tooltip.special', { value: this.describeWeaponSpecial(card) }));
            if (card.poisonDamage) lines.push(t(this.scene, 'tooltip.poisonTurns', { amount: card.poisonDamage, turns: card.poisonTurns || 0 }));
            if (card.durability !== undefined) lines.push(t(this.scene, 'tooltip.pips', { value: `${card.durability}/${card.maxDurability || card.durability}` }));
            this.addCanonicalDiffLines(lines, card, 'weapon');
        } else if (card.type === 'armor') {
            const armorType = translateItemName(this.scene, { type: 'armor', armorType: this.getArmorTypeFromCard(card) });
            lines.push(t(this.scene, 'tooltip.family', { value: armorType }));
            lines.push(t(this.scene, 'tooltip.protectionShort', { amount: card.protection || 0 }));
            if (card.dodgeChance) lines.push(t(this.scene, 'tooltip.dodge', { percent: Math.round(card.dodgeChance * 100) }));
            if (card.reflection) lines.push(t(this.scene, 'tooltip.reflect', { value: card.reflection }));
            if (card.thornDamage) lines.push(t(this.scene, 'tooltip.thornDamage', { amount: card.thornDamage }));
            if (card.durability !== undefined) lines.push(t(this.scene, 'tooltip.pips', { value: `${card.durability}/${card.maxDurability || card.durability}` }));
            this.addCanonicalDiffLines(lines, card, 'armor');
        } else if (card.type === 'thorns') {
            lines.push(t(this.scene, 'tooltip.thornDamage', { amount: card.thornDamage || 0 }));
            lines.push(t(this.scene, 'tooltip.pips', { value: `${card.durability || 0}/${card.maxDurability || card.durability || 0}` }));
            lines.push(t(this.scene, 'tooltip.meleeAttackers'));
        } else if (card.type === 'potion') {
            lines.push(t(this.scene, 'tooltip.healsColon', { amount: card.healAmount || 0 }));
        } else if (card.type === 'food') {
            lines.push(t(this.scene, 'tooltip.restoresColon', { amount: card.actionAmount || 0 }));
        } else if (card.type === 'companion') {
            const damageType = card.damageType === 'physical' ? 'Physical' : 'Lightning';
            const attackStyle = card.attackStyle === 'melee' || card.range === 'melee' ? 'Melee' : 'Ranged';
            lines.push(`${damageType} damage: ${card.attack || 2}`);
            lines.push(`${attackStyle} companion`);
            lines.push('Acts after enemies');
            if (card.shockChance) lines.push(`Shock chance: ${Math.round(card.shockChance * 100)}%`);
            if (card.guardProtection) lines.push(`Guard: +${card.guardProtection} protection`);
        } else if (card.type === 'magic') {
            lines.push(card.description ? translateDescription(this.scene, card.description) : this.describeMagicCard(card));
        } else if (card.type === 'passive') {
            lines.push(card.description ? translateDescription(this.scene, card.description) : 'Passive effect while carried.');
            if (card.flavor) lines.push(translateDescription(this.scene, card.flavor));
        } else if (card.type === 'amulet') {
            lines.push(this.describeAmuletCard(card));
        } else if (card.type === 'key') {
            lines.push(t(this.scene, 'tooltip.keySafe'));
        } else if (card.type === 'gem') {
            lines.push(t(this.scene, 'tooltip.effect', { effect: this.describeGemEffect(card.gemEffect) }));
        } else if (card.type === 'junk') {
            lines.push(card.description ? translateDescription(this.scene, card.description) : 'No effect.');
            if (card.carnivalToken) lines.push('A carnival token.');
        }

        return lines;
    }

    addCanonicalDiffLines(lines, card, category) {
        const canonical = category === 'weapon'
            ? this.getCanonicalWeaponStats(card)
            : this.getCanonicalArmorStats(card);
        if (!canonical) return;

        const differences = [];
        if (category === 'weapon' && card.damage !== undefined && card.damage !== canonical.damage) {
            differences.push(t(this.scene, 'tooltip.baseDamage', { amount: canonical.damage }));
        }
        if (category === 'armor' && card.protection !== undefined && card.protection !== canonical.protection) {
            differences.push(t(this.scene, 'tooltip.baseProtection', { amount: canonical.protection }));
        }
        if (differences.length > 0) {
            lines.push(t(this.scene, 'tooltip.noteUnusual', { details: differences.join(', ') }));
        }
    }

    getMergeTooltipLine(card, slotIndex) {
        if (card.type === 'magic' || card.type === 'coin' || card.type === 'crystal' || card.type === 'key') {
            return t(this.scene, 'tooltip.noMerge');
        }

        const canCrossTier = !!(this.scene.amuletManager && this.scene.amuletManager.canCrossTierMerge());
        const mergeableSlots = [];
        const blockedReasons = new Set();
        this.slots.forEach((otherCard, otherIndex) => {
            if (!otherCard || otherIndex === slotIndex) return;
            if (this.canCardsMerge(card, otherCard, canCrossTier)) {
                mergeableSlots.push(otherIndex + 1);
                return;
            }

            const reason = this.getMergeBlockReason(card, otherCard);
            if (reason) blockedReasons.add(reason);
        });

        if (mergeableSlots.length > 0) {
            return t(this.scene, 'tooltip.merges', { slots: mergeableSlots.join(', ') });
        }
        if (blockedReasons.size > 0) {
            return t(this.scene, 'tooltip.noMergeReasons', { reasons: Array.from(blockedReasons).slice(0, 2).join('; ') });
        }
        return '';
    }

    getMergeBlockReason(cardA, cardB) {
        if (!cardA || !cardB) return '';
        if (cardA.type !== cardB.type) return '';
        if (cardA.type === 'magic' || cardB.type === 'magic') return translateDescription(this.scene, 'magic cards cannot merge');
        if (cardA.type === 'gem' || cardB.type === 'gem') return translateDescription(this.scene, 'gems socket into weapons');
        if (this.getMergeKey(cardA) !== this.getMergeKey(cardB)) return translateDescription(this.scene, 'different family');
        if (cardA.rarity !== cardB.rarity) return `rarity ${cardA.rarity || '?'} vs ${cardB.rarity || '?'}`;
        if (this.getMergeStatsKey(cardA) !== this.getMergeStatsKey(cardB)) return translateDescription(this.scene, 'stats/effect differ');
        return '';
    }

    getDisplayCardType(card) {
        if (!card?.type) return 'Card';
        const names = {
            weapon: 'tooltip.weapon',
            armor: 'tooltip.armor',
            thorns: 'tooltip.thorns',
            potion: 'tooltip.potion',
            food: 'tooltip.food',
            magic: 'tooltip.magic',
            gem: 'tooltip.gem',
            amulet: 'tooltip.relic',
            key: 'tooltip.key',
            coin: 'tooltip.coins',
            crystal: 'tooltip.ruby'
        };
        return names[card.type] ? t(this.scene, names[card.type]) : this.capitalize(card.type);
    }

    describeWeaponSpecial(card) {
        const special = card.special || '';
        if (special === 'dualWield') return translateDescription(this.scene, 'dual wield');
        if (special === 'throwing') return translateDescription(this.scene, 'hits any enemy');
        if (special === 'block') return translateDescription(this.scene, 'can block');
        if (special === 'specialAttack') return translateDescription(this.scene, 'heavy strike');
        return special;
    }

    describeMagicCard(card) {
        if (card.magicType === 'fireball') return translateDescription(this.scene, 'Deals damage to one enemy.');
        if (card.magicType === 'frostRing') return translateDescription(this.scene, 'Freezes all enemies.');
        if (card.magicType === 'restoration') return translateDescription(this.scene, 'Fully restores HP and AP.');
        if (card.magicType === 'soulDrain') return translateDescription(this.scene, 'Kills a non-boss enemy and heals.');
        if (card.magicType === 'shadowBlade') return translateDescription(this.scene, 'Boosts weapon damage.');
        if (card.magicType === 'weakness') return translateDescription(this.scene, 'Weakens enemies.');
        if (card.magicType === 'boneWall') return translateDescription(this.scene, 'Reflects the next attacks.');
        if (card.magicType === 'magicShield') return translateDescription(this.scene, 'Boosts armor.');
        if (card.magicType === 'mirrorShield') return translateDescription(this.scene, 'Reflects one attack.');
        if (card.magicType === 'smokeScreen') return translateDescription(this.scene, 'Hides revealed enemies.');
        return translateDescription(this.scene, 'Single-use magic.');
    }

    describeAmuletCard(card) {
        const definitions = this.scene?.amuletManager?.amuletDefinitions;
        if (card.id && definitions?.[card.id]) return translateDescription(this.scene, definitions[card.id].description);
        if (card.description) return translateDescription(this.scene, card.description);
        return translateDescription(this.scene, 'A passive relic effect.');
    }

    describeGemEffect(effect) {
        if (effect === 'fire') return translateDescription(this.scene, 'splash adjacent enemies');
        if (effect === 'poison') return translateDescription(this.scene, 'stacking poison on hit');
        if (effect === 'lightning') return translateDescription(this.scene, 'zaps up to 3 open enemies');
        return translateDescription(this.scene, 'adds an effect to a weapon');
    }

    capitalize(value) {
        const text = (value || '').toString();
        return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
    }

    applyGemToWeapon(gem, weaponSlotIndex, rebuild = true) {
        const weapon = this.slots[weaponSlotIndex];
        if (!gem || gem.type !== 'gem' || !weapon || weapon.type !== 'weapon') return false;

        const MAX_GEM_STACK = 3;
        const currentCount = weapon.gemEffect ? (weapon.gemCount || 1) : 0;

        // Reject mismatched gem types
        if (weapon.gemEffect && weapon.gemEffect !== gem.gemEffect) {
            this.scene.createFloatingText(512, 380, 'Different gem already socketed!', 0xff4444);
            return false;
        }

        // Reject if already at max
        if (currentCount >= MAX_GEM_STACK) {
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
        SoundHelper.playSound(this.scene, 'crystal_collect', 0.45);
        return true;
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
            // Discarding costs an action point and wakes the enemies (free inside stations).
            if (!this.stationMode) this.scene.useAction?.();
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
                    
                    if (!this.stationMode && !this.scene.useAction()) {
                        this.scene.createFloatingText(512, 400, 'Not enough actions!', 0xff0000);
                        // Return card to original slot if merge fails
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

    canCardsMerge(cardA, cardB, canCrossTier = false) {
        cardA = this.normalizeCardIdentity(cardA);
        cardB = this.normalizeCardIdentity(cardB);
        if (!cardA || !cardB) return false;
        if (cardA.type === 'companion' || cardB.type === 'companion') return false;
        if (cardA.type === 'magic' || cardB.type === 'magic') return false;
        if (cardA.type === 'gem' || cardB.type === 'gem') return false;
        if (cardA.type !== cardB.type) return false;
        if (!canCrossTier && cardA.rarity !== cardB.rarity) return false;
        if (this.getMergeKey(cardA) !== this.getMergeKey(cardB)) return false;
        if (!canCrossTier && this.getMergeStatsKey(cardA) !== this.getMergeStatsKey(cardB)) return false;
        return true;
    }

    getMergeKey(card) {
        card = this.normalizeCardIdentity(card);
        if (!card) return '';
        if (card.type === 'weapon') return `weapon:${this.getWeaponTypeFromCard(card)}`;
        if (card.type === 'armor') return `armor:${this.getArmorTypeFromCard(card)}`;
        if (card.type === 'thorns') return 'thorns';
        if (card.type === 'potion') return `potion:${card.healAmount ? 'healing' : card.name || card.sprite}`;
        if (card.type === 'food') return `food:${card.actionAmount ? 'action' : card.name || card.sprite}`;
        return `${card.type}:${card.id || card.sprite || card.name}`;
    }

    getMergeStatsKey(card) {
        card = this.normalizeCardIdentity(card);
        if (!card) return '';
        if (card.type === 'weapon') {
            const canonical = this.getCanonicalWeaponStats(card);
            if (canonical) {
                return [
                    canonical.damage || 0,
                    canonical.special || '',
                    canonical.range || 'melee',
                    canonical.poisonDamage || 0,
                    canonical.poisonTurns || 0,
                    canonical.poisonStackable ? 1 : 0
                ].join('|');
            }
            return [
                card.damage || 0,
                card.special || '',
                card.range || 'melee',
                card.poisonDamage || 0,
                card.poisonTurns || 0,
                card.poisonStackable ? 1 : 0
            ].join('|');
        }
        if (card.type === 'armor') {
            const canonical = this.getCanonicalArmorStats(card);
            if (canonical) {
                return [
                    canonical.protection || 0,
                    canonical.dodgeChance || 0,
                    canonical.reflection || 0
                ].join('|');
            }
            return [
                card.protection || 0,
                card.dodgeChance || 0,
                card.reflection || 0
            ].join('|');
        }
        if (card.type === 'thorns') return `${card.thornDamage || 0}`;
        if (card.type === 'potion') return `${card.healAmount || 0}`;
        if (card.type === 'food') return `${card.actionAmount || 0}`;
        return '';
    }

    getCanonicalWeaponStats(card) {
        const weaponType = this.getWeaponTypeFromCard(card);
        const rarity = card?.rarity;
        const unlocks = this.scene?.cardSystem?.cardDataGenerator?.weaponUnlocks;
        return unlocks?.[weaponType]?.[rarity] || null;
    }

    getCanonicalArmorStats(card) {
        const armorType = this.getArmorTypeFromCard(card);
        const rarity = card?.rarity;
        const unlocks = this.scene?.cardSystem?.cardDataGenerator?.armorUnlocks;
        return unlocks?.[armorType]?.[rarity] || null;
    }

    normalizeCardIdentity(card) {
        if (!card || (card.type !== 'armor' && card.type !== 'weapon')) return card;

        const unlocks = card.type === 'armor'
            ? this.scene?.cardSystem?.cardDataGenerator?.armorUnlocks
            : this.scene?.cardSystem?.cardDataGenerator?.weaponUnlocks;
        if (!unlocks) return card;

        const family = card.type === 'armor'
            ? this.getArmorTypeFromCard(card)
            : this.getWeaponTypeFromCard(card);
        const tiers = unlocks[family];
        if (!tiers) return card;

        const nameRarity = this.getRarityFromName(card.name);
        const statRarity = Object.entries(tiers).find(([, data]) => (
            card.type === 'armor'
                ? data.protection === card.protection
                : data.damage === card.damage
        ))?.[0];
        const fixedRarity = nameRarity && tiers[nameRarity] ? nameRarity : statRarity;
        if (!fixedRarity || card.rarity === fixedRarity) return card;

        card.rarity = fixedRarity;
        return card;
    }

    getRarityFromName(name = '') {
        const text = name.toString().toLowerCase();
        if (text.includes('legendary')) return 'legendary';
        if (text.includes('epic')) return 'epic';
        if (text.includes('uncommon')) return 'uncommon';
        if (text.includes('common')) return 'common';
        if (text.includes('rare')) return 'rare';
        return '';
    }

    normalizeCardText(value) {
        return (value || '').toString().toLowerCase().replace(/[_\-\s]+/g, '');
    }

    getWeaponTypeFromCard(card) {
        if (!card) return '';
        if (card.weaponType) return card.weaponType;

        const text = this.normalizeCardText(`${card.name || ''} ${card.sprite || ''} ${card.id || ''}`);
        if (text.includes('dagger')) return 'dagger';
        if (text.includes('bow')) return 'bow';
        if (text.includes('sword')) return 'sword';
        if (text.includes('axe')) return 'axe';

        return card.sprite || card.name || '';
    }

    getArmorTypeFromCard(card) {
        if (!card) return '';
        if (card.armorType) return card.armorType;

        const text = this.normalizeCardText(`${card.name || ''} ${card.sprite || ''} ${card.id || ''}`);
        if (text.includes('leather')) return 'leather';
        if (text.includes('chain')) return 'chain';
        if (text.includes('plate')) return 'plate';

        return card.sprite || card.name || '';
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
    
    isEnemyBoardCard(card, includeBoss = true) {
        const type = card?.data?.type;
        if (!this.scene.cardSystem?.isEnemyType(type)) return false;
        return includeBoss || type !== 'boss';
    }

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
    }

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
                    SoundHelper.playSound(this.scene, 'magic_cast', 0.5);
                    
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
                    SoundHelper.playSound(this.scene, 'magic_cast', 0.5);
                    this.scene.createFloatingText(320, 180, 'Enemies Frozen!', 0x00ccff);
                    used = true;
                }
                break;
                
            case 'restoration':
                this.scene.gameState.playerHealth = this.scene.gameState.maxHealth;
                this.scene.gameState.actionsLeft = this.scene.gameState.maxActions;
                SoundHelper.playSound(this.scene, 'magic_cast', 0.5);
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
                        let healAmount = 30;
                        if (this.scene.amuletManager) {
                            healAmount = this.scene.amuletManager.modifySpellHealing(healAmount);
                        }
                        
                        this.scene.gameState.playerHealth = Math.min(
                            this.scene.gameState.maxHealth,
                            this.scene.gameState.playerHealth + healAmount
                        );
                        SoundHelper.playSound(this.scene, 'magic_cast', 0.5);
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
                SoundHelper.playSound(this.scene, 'magic_cast', 0.5);
                this.scene.createFloatingText(this.scene.playerAvatar.x, this.scene.playerAvatar.y, 'Bone Wall Active!', 0xffffff);
                used = true;
                break;
                
            case 'magicShield':
                this.scene.gameState.magicShield = { turns: 10, multiplier: 1.2 };
                SoundHelper.playSound(this.scene, 'magic_cast', 0.5);
                this.scene.createFloatingText(this.scene.playerAvatar.x, this.scene.playerAvatar.y, 'Magic Shield Active!', 0x00aaff);
                used = true;
                break;
                
            case 'mirrorShield':
                this.scene.gameState.mirrorShield = true;
                SoundHelper.playSound(this.scene, 'magic_cast', 0.5);
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
                    this.scene.sound.play('magic_cast', { volume: 0.5 });
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
    }
    
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
    }
    
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
    }
    
    createSmokeEffect() {
        const smoke = this.scene.add.rectangle(320, 180, 640, 360, 0x666666, 0.8);
        this.scene.tweens.add({
            targets: smoke,
            alpha: 0,
            duration: 1500,
            onComplete: () => smoke.destroy()
        });
    }

    useWeapon(slotIndex, cardSprite) {
        const weapon = this.slots[slotIndex];
        if (!weapon) return;
        
        // Handle BOW BLOCK ability separately (defensive use, doesn't need enemy)
        if (weapon.special === 'block') {
            // Check if dropped on player avatar for blocking
            const playerAvatarBounds = this.scene.playerAvatar.getBounds();
            if (Phaser.Geom.Intersects.RectangleToRectangle(cardSprite.getBounds(), playerAvatarBounds)) {
                if (!this.scene.useAction()) {
                    this.returnWeaponToSlot(slotIndex, cardSprite);
                    return;
                }
                
                // Activate block for next enemy attack
                this.scene.gameState.blockNextAttack = true;
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
            SoundHelper.playSound(this.scene, 'sword_swoosh', 0.5);
            let attackDamage = weapon.damage;
            
            // Apply weakness penalty when exhausted (out of action points)
            if (wasExhausted) {
                attackDamage = Math.ceil(attackDamage * 0.8); // 20% weaker
                this.scene.createFloatingText(this.scene.playerAvatar.x, this.scene.playerAvatar.y, 'Weakened Attack!', 0xffa500);
            }
            
            // Handle special abilities
            let attackCount = 1;
            
            // DAGGER: Dual Wield - Attack twice. The SECOND hit uses the OTHER
            // dagger's stats (damage AND gem), so two socketed daggers contribute
            // both gems on a dual-wield swing — matching what players intuitively
            // expect when they see two daggers in their hands.
            let secondaryDagger = null;
            if (weapon.special === 'dualWield') {
                // Find a different dual-wield dagger in inventory (skip the equipped one)
                for (let s = 0; s < this.slots.length; s++) {
                    const item = this.slots[s];
                    if (!item || item === weapon || item.special !== 'dualWield') continue;
                    if (item.durability <= 0) continue;
                    secondaryDagger = item;
                    break;
                }
                if (secondaryDagger) {
                    attackCount = 2;
                    this.scene.createFloatingText(cardSprite.x, cardSprite.y - 20, 'Dual Wield!', 0xffff00);
                }
            }
            // AXE: Heavy Strike — 150% damage for +1 durability, but only fires
            // when it would actually finish the enemy. Keeps axes from burning
            // their pips on every swing.
            else if (weapon.special === 'specialAttack') {
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
                } else {
                    // Second dual-wield hit: use the OTHER dagger's stats — its
                    // damage AND its gem — but only the dragged dagger spends a
                    // pip (already ticked on the first hit). The off-hand dagger
                    // swings for free, so we pass skipDurability=true and never
                    // touch its durability.
                    let secondaryDamage = secondaryDagger.damage || 1;
                    if (wasExhausted) secondaryDamage = Math.ceil(secondaryDamage * 0.8);
                    this.scene.cardSystem.attackEnemy(closestEnemy, secondaryDamage, false, secondaryDagger, true);
                    this.scene.updateUI?.();
                }
                if (i < attackCount - 1) {
                    this.scene.time.delayedCall(150, () => {
                        SoundHelper.playSound(this.scene, 'sword_swoosh', 0.3);
                    });
                }
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
    }
    
    // Helper method to handle weapon breaking
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
    }
    
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
    }
    
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
    }

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

        // Same action cost as a normal merge (free inside shops/stations).
        if (!this.stationMode && !this.scene.useAction()) {
            this.scene.createFloatingText(512, 400, 'Not enough actions!', 0xff0000);
            this.returnCardToSlot(slotIndex, draggedSprite);
            return true;
        }

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
    
    usePotion(slotIndex, cardSprite) {
        // In a shop (station mode) there are no enemy turns or action economy,
        // so healing shouldn't spend an action or schedule an enemy turn.
        if (!this.stationMode && !this.scene.useAction()) return false;
        const potionData = this.slots[slotIndex];
        if (!potionData) return false;
        
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
    }
    
    useFood(slotIndex, cardSprite) {
        const foodData = this.slots[slotIndex];
        if (!foodData) return false;
        
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

        // Webweaver's Thread relic: small chance one of the two consumed cards reappears
        // on the floor board face-down. Picks one of the source cards at random
        // so the player can't predict which copy comes back.
        const echoChance = this.scene.gameState?.relicEffects?.mergeRespawnChance || 0;
        if (echoChance > 0 && Math.random() < echoChance) {
            const sourceCard = Math.random() < 0.5 ? cardA : cardB;
            this.scene.cardSystem?.respawnCardOnBoard?.(sourceCard);
        }
    }
    
    createMergedCard(baseCard, secondCard) {
        // Get the next rarity tier
        const rarityMap = {
            common: 'uncommon',
            uncommon: 'rare',
            rare: 'epic',
            epic: 'legendary'
        };
        const newRarity = rarityMap[baseCard.rarity] || 'legendary';
        
        // Use CardDataGenerator to create the proper upgraded card
        let upgradedCard;
        
        if (baseCard.type === 'weapon') {
            upgradedCard = this.scene.cardSystem.createCardData('weapon', this.scene.gameState.currentFloor);
            // Override with specific weapon type and rarity
            upgradedCard = this.forceWeaponTypeAndRarity(upgradedCard, baseCard, newRarity);
        } else if (baseCard.type === 'armor') {
            upgradedCard = this.scene.cardSystem.createCardData('armor', this.scene.gameState.currentFloor);
            // Override with specific armor type and rarity  
            upgradedCard = this.forceArmorTypeAndRarity(upgradedCard, baseCard, newRarity);
        } else if (baseCard.type === 'thorns') {
            const multiplier = newRarity === 'uncommon' ? 1.5
                : newRarity === 'rare' ? 2
                : newRarity === 'epic' ? 2.25
                : 2.5;
            const maxDurability = newRarity === 'uncommon' ? 7
                : newRarity === 'rare' ? 9
                : newRarity === 'epic' ? 10
                : 11;
            // Swap to the rarity-appropriate thorns art (was keeping the common
            // sprite after a merge). Mirrors CardDataGenerator's thornsSpriteByRarity.
            const thornsSpriteByRarity = {
                common: 'thornsCard',
                uncommon: 'thornsCard_U',
                rare: 'thornsCard_R',
                epic: 'thornsCard_E',
                legendary: 'thornsCard_E'
            };
            upgradedCard = {
                ...baseCard,
                name: 'Thorns Card',
                rarity: newRarity,
                sprite: thornsSpriteByRarity[newRarity] || 'thornsCard',
                thornDamage: Math.max(baseCard.thornDamage + 1, Math.floor(baseCard.thornDamage * multiplier)),
                durability: maxDurability,
                maxDurability,
                cost: Math.floor((baseCard.cost || 8) * multiplier)
            };
        } else {
            // For other items (potions, food), use simple upgrade logic
            const multiplier = newRarity === 'uncommon' ? 1.8 : newRarity === 'rare' ? 2.5 : 3;
            const healAmount = baseCard.healAmount ? Math.floor(baseCard.healAmount * multiplier) : undefined;
            const actionAmount = baseCard.actionAmount ? Math.floor(baseCard.actionAmount * multiplier) : undefined;
            upgradedCard = {
                ...baseCard,
                name: baseCard.type === 'potion' ? this.getPotionNameForHealAmount(healAmount) :
                    baseCard.type === 'food' ? this.getFoodNameForActionAmount(actionAmount) :
                    baseCard.name.replace(/Common|Uncommon|Rare/, newRarity.charAt(0).toUpperCase() + newRarity.slice(1)),
                rarity: newRarity,
                healAmount,
                actionAmount,
                sprite: baseCard.type === 'potion' && newRarity === 'uncommon' ? 'potionCardUncommon' : baseCard.sprite
            };
        }
        
        // Merging fully refreshes durability — the upgraded card already
        // comes out at maxDurability from forceWeaponTypeAndRarity/forceArmor...
        // (Previous behavior summed the two worn-down cards' remaining pips,
        // which meant two beat-up daggers gave a weak uncommon dagger.)
        if (baseCard.type === 'weapon' || baseCard.type === 'armor' || baseCard.type === 'thorns') {
            upgradedCard.durability = upgradedCard.maxDurability;
            this.scene.createFloatingText(512, 380, `Refreshed: ${upgradedCard.maxDurability} pips`, 0x00ff00);
        }

        // Briar upgrades belong to the card, not its current rarity. Carry the
        // permanent bonus through merging, combining it when both inputs were blessed.
        if (baseCard.type === 'weapon' || baseCard.type === 'armor') {
            const briarBonus = (baseCard.briarDamageBonus || 0) + (secondCard.briarDamageBonus || 0);
            if (briarBonus > 0) {
                upgradedCard.briarDamageBonus = briarBonus;
                if (baseCard.type === 'weapon') {
                    upgradedCard.damage = (upgradedCard.damage || 0) + briarBonus;
                } else {
                    upgradedCard.thornDamage = briarBonus;
                }
            }
        }

        if (baseCard.type === 'weapon') {
            const baseGem = baseCard.gemEffect ? baseCard : null;
            const secondGem = secondCard.gemEffect ? secondCard : null;

            if (baseGem && secondGem && baseGem.gemEffect === secondGem.gemEffect) {
                // Same gem type on both — combine stacks (capped at 3)
                upgradedCard.gemEffect = baseGem.gemEffect;
                upgradedCard.gemName = baseGem.gemName;
                upgradedCard.gemColor = baseGem.gemColor;
                upgradedCard.gemCount = Math.min(3, (baseGem.gemCount || 1) + (secondGem.gemCount || 1));
            } else {
                // Different (or only one) — take whichever has a gem
                const gemSource = baseGem || secondGem;
                if (gemSource) {
                    upgradedCard.gemEffect = gemSource.gemEffect;
                    upgradedCard.gemName = gemSource.gemName;
                    upgradedCard.gemColor = gemSource.gemColor;
                    upgradedCard.gemCount = gemSource.gemCount || 1;
                }
            }
        }
        
        return upgradedCard;
    }

    getPotionNameForHealAmount(healAmount = 0) {
        if (healAmount >= 100) return 'Greater Healing Potion';
        if (healAmount >= 50) return 'Strong Healing Potion';
        if (healAmount >= 30) return 'Healing Potion';
        return 'Minor Healing Potion';
    }

    getFoodNameForActionAmount(actionAmount = 0) {
        if (actionAmount >= 25) return 'Feast';
        if (actionAmount >= 18) return 'Hearty Meal';
        if (actionAmount >= 12) return 'Rations';
        return 'Bread';
    }
    
    forceWeaponTypeAndRarity(generatedCard, originalCard, targetRarity) {
        const weaponType = this.getWeaponTypeFromCard(originalCard);
        const cardGenerator = this.scene.cardSystem.cardDataGenerator;
        
        if (cardGenerator.weaponUnlocks[weaponType] && cardGenerator.weaponUnlocks[weaponType][targetRarity]) {
            const weaponData = cardGenerator.weaponUnlocks[weaponType][targetRarity];
            const rarityName = targetRarity.charAt(0).toUpperCase() + targetRarity.slice(1);
            const weaponName = weaponType.charAt(0).toUpperCase() + weaponType.slice(1);

            // Get proper durability
            const durabilityMap = {
                dagger: { common: 4, uncommon: 5, rare: 6, epic: 7, legendary: 8 },
                bow: { common: 5, uncommon: 6, rare: 7, epic: 8, legendary: 9 },
                sword: { common: 6, uncommon: 8, rare: 10, epic: 11, legendary: 13 },
                axe: { common: 6, uncommon: 8, rare: 10, epic: 12, legendary: 14 }
            };
            const maxDurability = durabilityMap[weaponType][targetRarity] || 6;
            
            return {
                type: 'weapon',
                name: `${rarityName} ${weaponName}`,
                weaponType: weaponType,
                damage: weaponData.damage,
                rarity: targetRarity,
                sprite: weaponData.sprite,
                special: weaponData.special,
                range: weaponData.range || 'melee',
                poisonDamage: weaponData.poisonDamage || 0,
                poisonTurns: weaponData.poisonTurns || 0,
                poisonStackable: weaponData.poisonStackable || false,
                durability: maxDurability,
                maxDurability: maxDurability
            };
        }
        
        // Fallback to generated card
        return generatedCard;
    }
    
    forceArmorTypeAndRarity(generatedCard, originalCard, targetRarity) {
        const armorType = this.getArmorTypeFromCard(originalCard);
        const cardGenerator = this.scene.cardSystem.cardDataGenerator;
        
        if (cardGenerator.armorUnlocks[armorType] && cardGenerator.armorUnlocks[armorType][targetRarity]) {
            const armorData = cardGenerator.armorUnlocks[armorType][targetRarity];
            const rarityName = targetRarity.charAt(0).toUpperCase() + targetRarity.slice(1);
            const armorName = armorType.charAt(0).toUpperCase() + armorType.slice(1);
            
            const durabilityBonus = { uncommon: 5, rare: 10, epic: 13, legendary: 15 };
            const maxDurability = 20 + (durabilityBonus[targetRarity] || 0);
            
            return {
                type: 'armor',
                name: `${rarityName} ${armorName} Armor`,
                armorType: armorType,
                protection: armorData.protection,
                dodgeChance: armorData.dodgeChance,
                rarity: targetRarity,
                sprite: armorData.sprite,
                durability: maxDurability,
                maxDurability: maxDurability
            };
        }
        
        // Fallback to generated card
        return generatedCard;
    }
    
    getWeaponTypeFromName(name) {
        return this.getWeaponTypeFromCard({ name });
    }
    
    getArmorTypeFromName(name) {
        return this.getArmorTypeFromCard({ name });
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
    
    updateTwinkleEffects() {
        // First, clear all existing twinkle sprites (bag slots + worn armor)
        this.slotSprites.forEach(slot => {
            if (slot.twinkleSprite) {
                slot.twinkleSprite.destroy();
                slot.twinkleSprite = null;
            }
        });
        if (this.armorTwinkleSprite) {
            this.armorTwinkleSprite.destroy();
            this.armorTwinkleSprite = null;
        }

        // Cross-tier merging (Golden Hammer) lets cards of different rarities
        // combine, so the twinkle detection must use the same rule the real
        // merge does — otherwise a freshly-merged higher-tier card that can
        // still merge down with a lower-tier copy wouldn't sparkle.
        const canCrossTier = !!(this.scene.amuletManager && this.scene.amuletManager.canCrossTierMerge());

        // The worn armor takes part in merge detection too: a bag armor can be
        // dragged onto the equipped armor to upgrade it (tryMergeWithEquippedArmor),
        // so that pairing should sparkle just like two bag cards would — on the
        // bag armor AND on the armor slot itself.
        const equippedArmor = this.scene.gameState?.equippedArmor || null;
        const mergesWithWornArmor = (card) => (
            !!equippedArmor
            && card.type === 'armor'
            && this.canCardsMerge(card, equippedArmor, canCrossTier)
        );
        let wornArmorHasMatch = false;

        // Find items that can be merged and apply twinkle animation.
        this.slots.forEach((card, index) => {
            if (card && card.type !== 'magic' && card.type !== 'gem') {
                let hasMatch = this.slots.some((otherCard, otherIndex) => (
                    otherIndex !== index && this.canCardsMerge(card, otherCard, canCrossTier)
                ));

                // A bag armor that can merge into the worn armor also sparkles,
                // and flags the armor slot to sparkle in return.
                if (mergesWithWornArmor(card)) {
                    hasMatch = true;
                    wornArmorHasMatch = true;
                }

                if (hasMatch) {
                    const slotSprite = this.slotSprites[index];
                    const cardSprite = slotSprite?.card;
                    const slotBackground = slotSprite?.background;
                    if (cardSprite?.scene && slotBackground?.scene) {
                        // The slot is authoritative. During mirror copying the
                        // original card is still tweening home when addCard()
                        // refreshes twinkles; using cardSprite.x/y captures its
                        // temporary mirror position and leaves a stray sparkle.
                        // Use the mode-aware twinkle depth: in a shop (station mode)
                        // the inventory sits at depths 200+, so a hardcoded 100 would
                        // hide the twinkle behind the shop panel after a merge.
                        const twinkleDepth = this.getInventoryDepths().twinkle;
                        const twinkleSprite = snapOriginToPixelGrid(this.scene.add.sprite(
                            slotBackground.x,
                            slotBackground.y,
                            'twinkle',
                            0
                        ));
                        twinkleSprite.setScale(1.0);
                        twinkleSprite.setDepth(twinkleDepth);
                        twinkleSprite.play('twinkle_anim');
                        
                        // Make sure it's visible
                        twinkleSprite.setVisible(true);
                        twinkleSprite.setAlpha(1);
                        
                        this.uiGroup.add(twinkleSprite);
                        slotSprite.twinkleSprite = twinkleSprite;
                    }
                }
            }
        });

        // Sparkle the worn-armor slot when a bag armor can merge into it, so the
        // pairing reads at a glance from either side.
        if (wornArmorHasMatch && this.armorPanel?.scene) {
            const anchor = this.scene.armorPanelEquippedSprite?.scene
                ? this.scene.armorPanelEquippedSprite
                : this.armorPanel;
            const twinkleDepth = this.getInventoryDepths().twinkle;
            const twinkleSprite = snapOriginToPixelGrid(this.scene.add.sprite(
                anchor.x,
                anchor.y,
                'twinkle',
                0
            ));
            twinkleSprite.setScale(1.0);
            twinkleSprite.setDepth(twinkleDepth);
            twinkleSprite.setVisible(true);
            twinkleSprite.setAlpha(1);
            twinkleSprite.play('twinkle_anim');
            this.uiGroup.add(twinkleSprite);
            this.armorTwinkleSprite = twinkleSprite;
        }
    }
}

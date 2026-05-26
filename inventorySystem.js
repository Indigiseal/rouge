import { SoundHelper } from './utils/SoundHelper.js';
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
        this.uiGroup = this.scene.add.group();
        this.inventoryPanelPieces = [];
        this.stationMode = false;
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

    setStationMode(isStationMode) {
        this.stationMode = isStationMode;
    }
    
    setDiscardArea(discardArea) {
        this.discardArea = discardArea;
    }

    setArmorPanel(armorPanel) {
        this.armorPanel = armorPanel;
    }

    syncGameStateInventory() {
        if (this.scene.gameState) {
            this.scene.gameState.inventory = this.slots;
        }
    }
    
    createInventoryUI() {
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
        const startX = inventoryCenterX - (totalWidth / 2) + (slotWidth / 2);
        const y = 304;
        this.createInventoryPanel(inventoryCenterX, y, Math.max(368, totalWidth + 90), 112);
        
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
                originalY: y
            };
        }
    }

    createInventoryPanel(centerX, centerY, width, height) {
        if (!this.scene.textures.exists('panelCards')) return;

        const texture = this.scene.textures.get('panelCards');
        const source = texture.getSourceImage();
        const sourceWidth = source.width || 368;
        const sourceHeight = source.height || 112;
        const capWidth = 56;
        const middleWidth = Math.max(1, sourceWidth - capWidth * 2);

        if (!texture.has('leftCap')) {
            texture.add('leftCap', 0, 0, 0, capWidth, sourceHeight);
            texture.add('middleStretch', 0, capWidth, 0, middleWidth, sourceHeight);
            texture.add('rightCap', 0, sourceWidth - capWidth, 0, capWidth, sourceHeight);
        }

        const panelWidth = Math.max(capWidth * 2 + 1, width);
        const stretchWidth = panelWidth - capWidth * 2;
        const scaleY = height / sourceHeight;
        const scaledCapWidth = capWidth * scaleY;
        const leftX = centerX - panelWidth / 2 + scaledCapWidth / 2;
        const rightX = centerX + panelWidth / 2 - scaledCapWidth / 2;

        const left = this.scene.add.image(leftX, centerY, 'panelCards', 'leftCap').setScale(scaleY);
        const middle = this.scene.add.image(centerX, centerY, 'panelCards', 'middleStretch').setDisplaySize(stretchWidth, height);
        const right = this.scene.add.image(rightX, centerY, 'panelCards', 'rightCap').setScale(scaleY);

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
        
        this.slots[slotIndex] = cardData;
        this.syncGameStateInventory();
        
        const slotSprite = this.slotSprites[slotIndex];
        if (!slotSprite || !slotSprite.background) return;
        
        const x = slotSprite.background.x;
        const y = slotSprite.background.y;
        
        let cardSprite;
        if (cardData.sprite) {
            cardSprite = this.scene.add.image(x, y, cardData.sprite, cardData.spriteFrame);
        } else {
            const colors = {
                armor: 0x888888,
                magic: 0x9932cc
            };
            cardSprite = this.scene.add.rectangle(x, y, 45, 65, colors[cardData.type] || 0x666666);
        }
        
        this.uiGroup.add(cardSprite);
        cardSprite.setScale(1);
        cardSprite.setDepth(12);
        
        // IMPORTANT: Set the initial position data
        cardSprite.setData('originalX', x);
        cardSprite.setData('originalY', y);
        cardSprite.setData('slotIndex', slotIndex);
        
        // Make interactive AFTER setting position data
        cardSprite.setInteractive({ draggable: true });
        
        // Create shadow for hover effect (initially hidden)
        const shadow = this.scene.add.rectangle(x, y + 28, 52, 15, 0x000000, 0.6);
        shadow.setAlpha(0);
        shadow.setDepth(11);
        this.uiGroup.add(shadow);
        slotSprite.shadow = shadow;
        
        // Create hover animation sprite (initially hidden)
        const hoverSprite = this.scene.add.sprite(x, y, 'hoverCardsUp1');
        hoverSprite.setVisible(false);
        hoverSprite.setBlendMode(Phaser.BlendModes.SCREEN);
        hoverSprite.setDepth(13);
        this.uiGroup.add(hoverSprite);
        slotSprite.hoverSprite = hoverSprite;
        
        // Store original Y position for floating effect
        slotSprite.originalY = y;
        
        // Add hover events
        cardSprite.on('pointerover', () => {
            if (!cardSprite.scene) return;
            
            // Get the current slot sprite reference
            const currentSlot = this.slotSprites[slotIndex];
            if (!currentSlot) return;
            
            // Show and animate hover sprite
            if (currentSlot.hoverSprite) {
                currentSlot.hoverSprite.setVisible(true);
                currentSlot.hoverSprite.play('hover_cards_anim');
            }
            
            // Show shadow
            if (currentSlot.shadow) {
                currentSlot.shadow.setAlpha(1);
            }
            
            // Float card up
            this.scene.tweens.add({
                targets: cardSprite,
                y: currentSlot.originalY - 5,
                duration: 150,
                ease: 'Power2'
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
            
            // Move info text if it exists
            const infoText = cardSprite.getData('infoText');
            if (infoText && infoText.scene) {
                this.scene.tweens.add({
                    targets: infoText,
                    y: currentSlot.originalY - 5,
                    duration: 150,
                    ease: 'Power2'
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
        });
        
        cardSprite.on('pointerout', () => {
            if (!cardSprite.scene) return;
            
            const currentSlot = this.slotSprites[slotIndex];
            if (!currentSlot) return;
            
            // Hide hover sprite
            if (currentSlot.hoverSprite) {
                currentSlot.hoverSprite.setVisible(false);
                currentSlot.hoverSprite.stop();
            }
            
            // Hide shadow
            if (currentSlot.shadow) {
                currentSlot.shadow.setAlpha(0);
            }
            
            // Return card to original position
            this.scene.tweens.add({
                targets: cardSprite,
                y: currentSlot.originalY,
                duration: 150,
                ease: 'Power2'
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
            
            // Return info text to original position
            const infoText = cardSprite.getData('infoText');
            if (infoText && infoText.scene) {
                this.scene.tweens.add({
                    targets: infoText,
                    y: currentSlot.originalY,
                    duration: 150,
                    ease: 'Power2'
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
            
            // Store the starting position
            cardSprite.setData('dragStartX', cardSprite.x);
            cardSprite.setData('dragStartY', cardSprite.y);
            
            if (typeof cardSprite.setTint === 'function') {
                cardSprite.setTint(0xffff00);
            }
            cardSprite.setDepth(1000); // High depth while dragging
            
            const currentSlot = this.slotSprites[slotIndex];
            if (!currentSlot) return;
            
            // Hide hover animation when dragging
            if (currentSlot.hoverSprite) {
                currentSlot.hoverSprite.setVisible(false);
                currentSlot.hoverSprite.stop();
            }
            
            // Keep shadow visible while dragging
            if (currentSlot.shadow) {
                currentSlot.shadow.setAlpha(1);
                currentSlot.shadow.setDepth(999);
            }
            
            // Bring twinkle sprite to front if it exists
            if (currentSlot.twinkleSprite) {
                currentSlot.twinkleSprite.setDepth(1001);
            }
        });
        
        cardSprite.on('drag', (pointer, dragX, dragY) => {
            if (!cardSprite.scene) return;
            
            // Ensure positions are valid numbers
            cardSprite.x = Phaser.Math.Clamp(dragX, 0, 640);
            cardSprite.y = Phaser.Math.Clamp(dragY, 0, 360);
            
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
        });
        
        cardSprite.on('dragend', () => {
            if (!cardSprite.scene) return;
            
            if (typeof cardSprite.clearTint === 'function') {
                cardSprite.clearTint();
            }
            cardSprite.setDepth(12);
            
            const currentSlot = this.slotSprites[slotIndex];
            if (currentSlot) {
                // Hide shadow after drag
                if (currentSlot.shadow) {
                    currentSlot.shadow.setAlpha(0);
                    currentSlot.shadow.setDepth(11);
                }
                
                // Reset twinkle depth
                if (currentSlot.twinkleSprite) {
                    currentSlot.twinkleSprite.setDepth(100);
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
    }

    addStartingCards() {
        if (this.scene.gameState.currentFloor > 1) return;
        // Add starting sword with durability
        const swordData = {
            type: 'weapon',
            name: 'Common Sword',
            damage: 4,
            rarity: 'common',
            sprite: 'sword_C',  // Fixed sprite name consistency
            durability: 6,
            maxDurability: 6,
            special: null  // Sword has no special ability
        };
        this.addCard(swordData);
        // Add starting uncommon sword
        const uncommonSwordData = {
            type: 'weapon',
            name: 'Uncommon Sword',
            damage: 7,
            rarity: 'uncommon',
            sprite: 'sword_U',
            durability: 8,
            maxDurability: 8,
            special: null  // Sword has no special ability
        };
        this.addCard(uncommonSwordData);
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
        this.updateTwinkleEffects();
        return true;
    }

    handleCardDrop(slotIndex, cardSprite) {
        const cardData = this.slots[slotIndex];
        if (!cardData) return;
        
        // Check for drop on discard area FIRST to prevent conflicts with other drop zones
        if (!this.stationMode && this.discardArea && Phaser.Geom.Intersects.RectangleToRectangle(cardSprite.getBounds(), this.discardArea.getBounds())) {
            SoundHelper.playSound(this.scene, 'item_discard', 0.7);
            this.scene.createFloatingText(cardSprite.x, cardSprite.y, 'Discarded!', 0xff0000);
            
            // Properly clean up ALL sprites and effects
            this.cleanupCardSprites(slotIndex, cardSprite);
            this.removeCard(slotIndex, false); // Don't destroy the sprite in removeCard
            cardSprite.destroy(); // Destroy the dragged sprite here
            return;
        }
        
        // Check for drop on another inventory item for merging
        for (let i = 0; i < this.slotSprites.length; i++) {
            if (i === slotIndex) continue;
            const targetSlotSprite = this.slotSprites[i];
            const targetCardData = this.slots[i];
            if (targetCardData && Phaser.Geom.Intersects.RectangleToRectangle(cardSprite.getBounds(), targetSlotSprite.background.getBounds())) {
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

        if (this.stationMode) {
            this.returnCardToSlot(slotIndex, cardSprite);
            return;
        }
        
        // Check if dropped on board to use a weapon or magic card
        const onBoard = cardSprite.y < 280;
        if (onBoard) {
            if (cardData.type === 'weapon') {
                this.useWeapon(slotIndex, cardSprite);
                return;
            } else if (cardData.type === 'magic') {
                this.useMagicCard(slotIndex, cardSprite);
                return;
            }
        }
        
        // Check if armor was dropped on the dedicated armor panel
        if (
            cardData.type === 'armor' &&
            this.armorPanel &&
            Phaser.Geom.Intersects.RectangleToRectangle(cardSprite.getBounds(), this.armorPanel.getBounds())
        ) {
            if (this.equipArmor(slotIndex, cardSprite)) return;
        }

        // Check if dropped on the player avatar for equipping/consuming
        const playerAvatarBounds = this.scene.playerAvatar.getBounds();
        if (Phaser.Geom.Intersects.RectangleToRectangle(cardSprite.getBounds(), playerAvatarBounds)) {
            if (cardData.type === 'armor') {
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
        if (!cardA || !cardB) return false;
        if (cardA.type === 'magic' || cardB.type === 'magic') return false;
        if (cardA.type !== cardB.type) return false;
        if (!canCrossTier && cardA.rarity !== cardB.rarity) return false;
        if (this.getMergeKey(cardA) !== this.getMergeKey(cardB)) return false;
        if (!canCrossTier && this.getMergeStatsKey(cardA) !== this.getMergeStatsKey(cardB)) return false;
        return true;
    }

    getMergeKey(card) {
        if (!card) return '';
        if (card.type === 'weapon') return `weapon:${this.getWeaponTypeFromCard(card)}`;
        if (card.type === 'armor') return `armor:${this.getArmorTypeFromCard(card)}`;
        if (card.type === 'thorns') return 'thorns';
        if (card.type === 'potion') return `potion:${card.healAmount ? 'healing' : card.name || card.sprite}`;
        if (card.type === 'food') return `food:${card.actionAmount ? 'action' : card.name || card.sprite}`;
        return `${card.type}:${card.id || card.sprite || card.name}`;
    }

    getMergeStatsKey(card) {
        if (!card) return '';
        if (card.type === 'weapon') {
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

    normalizeCardText(value) {
        return (value || '').toString().toLowerCase().replace(/[_\-\s]+/g, '');
    }

    getWeaponTypeFromCard(card) {
        if (!card) return '';
        if (card.weaponType) return card.weaponType;

        const text = this.normalizeCardText(`${card.name || ''} ${card.sprite || ''} ${card.id || ''}`);
        if (text.includes('venomousdagger')) return 'venomousDagger';
        if (text.includes('dagger')) return 'dagger';
        if (text.includes('spear')) return 'spear';
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
            
            if (slot.shadow) {
                slot.shadow.destroy();
                slot.shadow = null;
            }
        }
    }
    
    returnCardToSlot(slotIndex, cardSprite) {
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
                
                // Update stored position data
                cardSprite.setData('originalX', targetX);
                cardSprite.setData('originalY', targetY);
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
        
        // Move twinkle sprite back
        if (slotSprite.twinkleSprite && slotSprite.twinkleSprite.scene) {
            slotSprite.twinkleSprite.x = targetX;
            slotSprite.twinkleSprite.y = targetY;
        }
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
    
    useMagicCard(slotIndex, cardSprite) {
        if (!this.scene.useAction()) {
            this.returnCardToSlot(slotIndex, cardSprite);
            return;
        }
        
        const magicCard = this.slots[slotIndex];
        if (!magicCard) return;
        
        let used = false;
        
        switch(magicCard.magicType) {
            case 'fireball':
                // Find closest enemy to where card was dropped
                let closestEnemy = -1;
                let closestDistance = Infinity;
                
                this.scene.cardSystem.boardCards.forEach((card, index) => {
                    if (card && card.revealed && (card.data.type === 'enemy' || card.data.type === 'boss')) {
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
                    if (card && card.revealed && (card.data.type === 'enemy' || card.data.type === 'boss')) {
                        card.data.frozen = 3; // Frozen for 3 turns
                        card.sprite.setTint(0x00ccff); // Ice blue tint
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
                // Apply healing modifiers from amulets
                let healAmount = 15;
                if (this.scene.amuletManager) {
                    healAmount = this.scene.amuletManager.modifySpellHealing(healAmount);
                }
                
                this.scene.gameState.playerHealth = Math.min(
                    this.scene.gameState.maxHealth,
                    this.scene.gameState.playerHealth + healAmount
                );
                this.scene.gameState.actionsLeft = Math.min(
                    this.scene.gameState.maxActions,
                    this.scene.gameState.actionsLeft + 3
                );
                SoundHelper.playSound(this.scene, 'magic_cast', 0.5);
                this.scene.createFloatingText(this.scene.playerAvatar.x, this.scene.playerAvatar.y, `+${healAmount} HP, +3 AP`, 0x00ff00);
                this.scene.updateUI();
                used = true;
                break;
                
            case 'soulDrain':
                // Find closest non-boss enemy
                let drainTarget = -1;
                let drainDistance = Infinity;
                
                this.scene.cardSystem.boardCards.forEach((card, index) => {
                    if (card && card.revealed && card.data.type === 'enemy') { // Only non-boss
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
                        
                        // Remove the enemy card AFTER creating the effect
                        this.scene.cardSystem.removeCard(drainTarget);
                        this.scene.updateUI();
                        this.scene.cardSystem.checkFloorClear();
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
                    if (card && card.data && (card.data.type === 'enemy' || card.data.type === 'boss')) {
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
                // Flip all face-up enemy cards back down
                let flippedAny = false;
                this.scene.cardSystem.boardCards.forEach((card) => {
                    if (card && card.revealed && (card.data.type === 'enemy' || card.data.type === 'boss')) {
                        card.revealed = false;
                        card.sprite.setTexture('cardBack');
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
            // Clean up ALL sprites properly
            this.cleanupCardSprites(slotIndex, cardSprite);
            cardSprite.destroy();
            this.removeCard(slotIndex);
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
        
        // Handle SPEAR BLOCK ability separately (defensive use, doesn't need enemy)
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
                
                // Reduce spear durability for blocking (with amulet modifier)
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
        if (!this.scene.useAction()) {
            this.returnWeaponToSlot(slotIndex, cardSprite);
            return;
        }
        
        // Find closest enemy
        let closestEnemy = -1;
        let closestDistance = Infinity;
        
        this.scene.cardSystem.boardCards.forEach((card, index) => {
            if (card && card.revealed && (card.data.type === 'enemy' || card.data.type === 'boss')) {
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
            
            // Apply shadow blade multiplier if active
            if (this.scene.gameState.shadowBlade && this.scene.gameState.shadowBlade.turns > 0) {
                attackDamage = Math.floor(attackDamage * this.scene.gameState.shadowBlade.multiplier);
            }
            
            // UPDATED: Check if player is exhausted BEFORE the action is consumed
            // The action was not consumed yet when we're calculating damage
            const isExhausted = this.scene.gameState.actionsLeft <= 0;
            
            // Apply weakness penalty when exhausted (out of action points)
            if (isExhausted) {
                attackDamage = Math.ceil(attackDamage * 0.8); // 20% weaker
                this.scene.createFloatingText(this.scene.playerAvatar.x, this.scene.playerAvatar.y, 'Weakened Attack!', 0xffa500);
            }
            
            // Handle special abilities
            let attackCount = 1;
            
            // DAGGER: Dual Wield - Attack twice
            if (weapon.special === 'dualWield') {
                // Check if player has 2 daggers of the same type
                const daggerCount = this.slots.filter(item => 
                    item && item.name === weapon.name && item.special === 'dualWield'
                ).length;
                
                if (daggerCount >= 2) {
                    attackCount = 2;
                    this.scene.createFloatingText(cardSprite.x, cardSprite.y - 20, 'Dual Wield!', 0xffff00);
                }
            }
            // AXE: Special Attack - 150% damage but costs 2 durability
            else if (weapon.special === 'specialAttack') {
                // Only use special if weapon has at least 2 durability
                if (weapon.durability >= 2) {
                    attackDamage = Math.floor(attackDamage * 1.5);
                    weapon.durability--; // Extra durability cost (not affected by amulet)
                    this.scene.createFloatingText(cardSprite.x, cardSprite.y - 20, 'Heavy Strike!', 0xff6600);
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
                
                this.scene.cardSystem.attackEnemy(closestEnemy, attackDamage, false, weapon);
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
                
                // Move twinkle sprite back too
                if (originalSlot.twinkleSprite && originalSlot.twinkleSprite.scene) {
                    originalSlot.twinkleSprite.x = cardSprite.x;
                    originalSlot.twinkleSprite.y = cardSprite.y;
                }
            }
        });
    }
    
    equipArmor(slotIndex, draggedSprite = null) {
        if (!this.scene.useAction()) return false;
        
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
        if (!this.scene.useAction()) return false;
        const potionData = this.slots[slotIndex];
        if (!potionData) return false;
        
        // Apply healing modifiers from amulets
        let healAmount = potionData.healAmount;
        if (this.scene.amuletManager) {
            healAmount = this.scene.amuletManager.modifyPotionHealing(healAmount);
        }
        
        // Use the GameState heal method to respect health caps
        this.scene.gameState.heal(healAmount);
        
        this.scene.createFloatingText(
            this.scene.playerAvatar.x,
            this.scene.playerAvatar.y,
            `+${healAmount} HP`,
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
        const rarityOrder = ['common', 'uncommon', 'rare', 'legendary'];
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
        
        // Add upgraded card
        this.addCard(upgradedCard);
        
        this.scene.createFloatingText(512, 400, 'Cards Merged!', 0x00ff00);
    }
    
    createMergedCard(baseCard, secondCard) {
        // Get the next rarity tier
        const rarityMap = {
            common: 'uncommon',
            uncommon: 'rare',
            rare: 'legendary'
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
            const multiplier = newRarity === 'uncommon' ? 1.5 : newRarity === 'rare' ? 2 : 2.5;
            const maxDurability = newRarity === 'uncommon' ? 7 : newRarity === 'rare' ? 8 : 10;
            upgradedCard = {
                ...baseCard,
                name: 'Thorns Card',
                rarity: newRarity,
                thornDamage: Math.max(baseCard.thornDamage + 1, Math.floor(baseCard.thornDamage * multiplier)),
                durability: maxDurability,
                maxDurability,
                cost: Math.floor((baseCard.cost || 8) * multiplier)
            };
        } else {
            // For other items (potions, food), use simple upgrade logic
            const multiplier = newRarity === 'uncommon' ? 1.8 : newRarity === 'rare' ? 2.5 : 3;
            const healAmount = baseCard.healAmount ? Math.floor(baseCard.healAmount * multiplier) : undefined;
            upgradedCard = {
                ...baseCard,
                name: baseCard.type === 'potion' ? this.getPotionNameForHealAmount(healAmount) :
                    baseCard.name.replace(/Common|Uncommon|Rare/, newRarity.charAt(0).toUpperCase() + newRarity.slice(1)),
                rarity: newRarity,
                healAmount,
                actionAmount: baseCard.actionAmount ? Math.floor(baseCard.actionAmount * multiplier) : undefined,
                sprite: baseCard.type === 'potion' && newRarity === 'uncommon' ? 'potionCardUncommon' : baseCard.sprite
            };
        }
        
        // Handle durability combining for weapons and armor
        if (baseCard.type === 'weapon' || baseCard.type === 'armor' || baseCard.type === 'thorns') {
            const combinedDurability = (baseCard.durability || 0) + (secondCard.durability || 0);
            const maxDurability = upgradedCard.maxDurability;
            
            upgradedCard.durability = Math.min(combinedDurability, maxDurability);
            
            // Show durability feedback
            const addedDur = Math.min(secondCard.durability || 0, maxDurability - baseCard.durability);
            if (combinedDurability > maxDurability) {
                this.scene.createFloatingText(512, 380, `Durability capped at ${maxDurability}`, 0xffa500);
            } else {
                this.scene.createFloatingText(512, 380, `+${addedDur} durability`, 0x00ff00);
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
    
    forceWeaponTypeAndRarity(generatedCard, originalCard, targetRarity) {
        const weaponType = this.getWeaponTypeFromCard(originalCard);
        const cardGenerator = this.scene.cardSystem.cardDataGenerator;
        
        if (cardGenerator.weaponUnlocks[weaponType] && cardGenerator.weaponUnlocks[weaponType][targetRarity]) {
            const weaponData = cardGenerator.weaponUnlocks[weaponType][targetRarity];
            const rarityName = targetRarity.charAt(0).toUpperCase() + targetRarity.slice(1);
            const weaponNames = {
                venomousDagger: 'Venomous Dagger'
            };
            const weaponName = weaponNames[weaponType] || weaponType.charAt(0).toUpperCase() + weaponType.slice(1);
            
            // Get proper durability
            const durabilityMap = {
                dagger: { common: 4, uncommon: 5, rare: 6, legendary: 7 },
                venomousDagger: { common: 5, uncommon: 5, rare: 5, legendary: 5 },
                spear: { common: 5, uncommon: 6, rare: 7, legendary: 8 },
                sword: { common: 6, uncommon: 8, rare: 10, legendary: 13 },
                axe: { common: 3, uncommon: 4, rare: 5, legendary: 7 }
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
            
            const durabilityBonus = { uncommon: 5, rare: 10, legendary: 15 };
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
        // First, clear all existing twinkle sprites
        this.slotSprites.forEach(slot => {
            if (slot.twinkleSprite) {
                slot.twinkleSprite.destroy();
                slot.twinkleSprite = null;
            }
        });
        
        // Find items that can be merged and apply twinkle animation.
        this.slots.forEach((card, index) => {
            if (card && card.type !== 'magic') {
                const hasMatch = this.slots.some((otherCard, otherIndex) => (
                    otherIndex !== index && this.canCardsMerge(card, otherCard, false)
                ));

                if (hasMatch) {
                    const cardSprite = this.slotSprites[index].card;
                    if (cardSprite && cardSprite.scene) {
                        // Create twinkle sprite at the same position as the card
                        const twinkleSprite = this.scene.add.sprite(cardSprite.x, cardSprite.y, 'twinkle1');
                        twinkleSprite.setScale(1.0);
                        twinkleSprite.setDepth(100); // High depth to ensure visibility
                        twinkleSprite.play('twinkle_anim');
                        
                        // Make sure it's visible
                        twinkleSprite.setVisible(true);
                        twinkleSprite.setAlpha(1);
                        
                        this.uiGroup.add(twinkleSprite);
                        this.slotSprites[index].twinkleSprite = twinkleSprite;
                    }
                }
            }
        });
    }
}

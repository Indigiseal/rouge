import { snapOriginToPixelGrid } from '../../ui/PixelSnap.js';
import { CardDataGenerator } from '../loot/CardDataGenerator.js';
import { getDisplayedWeaponDamage } from '../../content/characters/CharacterClasses.js';
import { t, translateDescription, translateGemEffect, translateItemName, translateRarity } from '../../i18n/i18n.js';

export const InventoryView = {
    setVisibility(isVisible) {
        if (this.uiGroup) {
            this.uiGroup.setVisible(isVisible);
            if (isVisible) {
                this.rebuildInventorySprites(); // Force redraw on show
            }
        }
    },
    setStationMode(isStationMode) {
        this.stationMode = isStationMode;
        this.applyInventoryVisualDepths();
    },
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
    },
    applyInventoryVisualDepths() {
        const depths = this.getInventoryDepths();
        this.inventoryPanelPieces?.forEach(piece => piece?.setDepth?.(depths.panel));
        this.slotSprites?.forEach((slot, index) => this.applySlotVisualDepths(index));
    },
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
    },
    setDiscardArea(discardArea) {
        this.discardArea = discardArea;
    },
    setArmorPanel(armorPanel) {
        this.armorPanel = armorPanel;
    },
    // Custom drop targets a scene can register for the duration of an
    // interaction (e.g. the copying-mirror event). Each handler is called with
    // (slotIndex, cardData, cardSprite) when a dragged card is released over the
    // zone, and returns true if it consumed the drop (taking responsibility for
    // the dragged sprite). Cleared when the interaction ends.
    addDropZone(zone, handler) {
        if (!zone || typeof handler !== 'function') return;
        (this.dropZones ||= []).push({ zone, handler });
    },
    clearDropZones() {
        this.dropZones = [];
    },
    // A station may render above GameScene (EventScene does this for the mirror
    // and well). Depth values cannot cross Phaser scene boundaries, so a card
    // dragged out of the inventory needs a synchronized visual in that upper
    // scene. The real card still moves and performs all drop detection.
    setDragOverlayScene(scene = null) {
        if (this.dragOverlayScene === scene) return;
        this.destroyDragOverlay();
        this.dragOverlayScene = scene;
    },
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
    },
    updateDragOverlay(cardSprite) {
        const overlay = this.dragOverlay;
        if (!overlay || overlay.cardSprite !== cardSprite) return;
        overlay.parts.forEach(({ clone, offsetX, offsetY }) => {
            if (!clone?.scene) return;
            clone.x = cardSprite.x + offsetX;
            clone.y = cardSprite.y + offsetY;
        });
    },
    destroyDragOverlay() {
        const overlay = this.dragOverlay;
        if (!overlay) return;
        overlay.parts?.forEach(({ clone }) => clone?.destroy?.());
        this.dragOverlay = null;
    },
    // The enemy a swing would land on: closest revealed enemy within 150px of
    // the dragged card. Mirrors the pick in useWeapon() so the ring previews the
    // same target the drop will actually hit.
    findWeaponTargetSprite(cardSprite) {
        let closest = null;
        let closestDistance = Infinity;
        this.scene.cardSystem?.boardCards?.forEach(card => {
            if (!card?.revealed || !card.sprite || !this.isEnemyBoardCard(card)) return;
            const distance = Phaser.Math.Distance.Between(
                cardSprite.x, cardSprite.y, card.sprite.x, card.sprite.y
            );
            if (distance < closestDistance) {
                closestDistance = distance;
                closest = card.sprite;
            }
        });
        return closestDistance < 150 ? closest : null;
    },
    // Translucent red ring showing how far a fire gem's splash would reach from
    // the enemy this swing would strike. Because the splash tests centre-to-
    // nearest-edge, the rule reads straight off the picture: any enemy card the
    // ring touches burns. Drawn at depth 1 — above the board panel (0), below
    // the cards (2) — so it looks like scorched ground, not an overlay.
    updateFireReachIndicator(cardSprite, slotIndex) {
        const weapon = this.slots[slotIndex];
        if (this.stationMode || weapon?.type !== 'weapon' || weapon.gemEffect !== 'fire') {
            this.destroyFireReachIndicator();
            return;
        }

        const target = this.findWeaponTargetSprite(cardSprite);
        if (!target?.scene) {
            this.destroyFireReachIndicator();
            return;
        }

        if (!this.fireReachIndicator?.scene) {
            this.fireReachIndicator = this.scene.add.graphics().setDepth(1);
        }

        const radius = this.scene.cardSystem.getFireSplashRadius();
        const g = this.fireReachIndicator;
        g.clear();
        g.fillStyle(0xff4020, 0.16);
        g.fillCircle(target.x, target.y, radius);
        g.lineStyle(1, 0xff6040, 0.5);
        g.strokeCircle(target.x, target.y, radius);
    },
    destroyFireReachIndicator() {
        if (this.fireReachIndicator?.scene) this.fireReachIndicator.destroy();
        this.fireReachIndicator = null;
    },
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
        // The panel wraps the slots with generous padding, but is capped so its
        // right edge never reaches the discard bin (~x 567) once the bag grows to
        // many slots. The panel is centered on inventoryCenterX, so the cap is
        // symmetric. 5–7 slots keep the roomy framing; only a near-full 8-slot bag
        // tightens up (its slots already run close to the bin either way).
        const desiredPanelWidth = Math.max(368, totalWidth + 90);
        const discardClearWidth = 2 * (562 - inventoryCenterX);
        this.createInventoryPanel(inventoryCenterX, y, Math.min(desiredPanelWidth, discardClearWidth));
        
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
    hideCardTooltip() {
        if (this.cardTooltip?.scene) {
            this.cardTooltip.destroy(true);
        }
        this.cardTooltip = null;
    },
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
            const characterId = this.scene?.gameState?.characterId;
            const talentFx = this.scene?.gameState?.talentEffects || null;
            const shownDmg = getDisplayedWeaponDamage(characterId, card, talentFx);
            const baseDmg = card.damage || 0;
            lines.push(t(this.scene, 'tooltip.damageShort', { amount: shownDmg }));
            if (shownDmg !== baseDmg) {
                lines.push(`Base ${baseDmg} + class/talents`);
            }
            const critChance = (this.scene?.gameState?.discardCritChance || 0)
                + (this.scene?.amuletManager?.getCriticalChanceBonus?.() || 0);
            if (critChance > 0) lines.push(`Crit: ${Math.round(critChance * 100)}%`);
            lines.push(t(this.scene, 'tooltip.range', {
                value: t(this.scene, (card.range || 'melee') === 'ranged' ? 'tooltip.ranged' : 'tooltip.melee')
            }));
            if (card.gemEffect) {
                const stack = CardDataGenerator.weaponGemStack(card);
                lines.push(t(this.scene, 'tooltip.gemLine', {
                    effect: translateGemEffect(this.scene, card.gemEffect),
                    stack: stack > 1 ? ` x${stack}` : ''
                }));
                if (card.gemEffect === 'fire') {
                    const splashPct = [50, 75, 100, 110, 120][stack - 1] ?? 100;
                    const splashDmg = Math.max(1, Math.floor(shownDmg * splashPct / 100));
                    lines.push(t(this.scene, 'tooltip.fireSplash', { amount: splashDmg }));
                } else if (card.gemEffect === 'lightning') {
                    const zapPct = [40, 55, 70, 80, 90][stack - 1] ?? 70;
                    const zapDmg = Math.max(1, Math.floor(shownDmg * zapPct / 100));
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
            if ((card.protection || 0) > 0) {
                lines.push(t(this.scene, 'tooltip.protectionShort', { amount: card.protection || 0 }));
            }
            if (card.dodgeChance) lines.push(t(this.scene, 'tooltip.dodge', { percent: Math.round(card.dodgeChance * 100) }));
            if (card.meleeCounterChance) {
                lines.push(`Melee counter: ${Math.round(card.meleeCounterChance * 100)}% (50% blocked)`);
            }
            if (card.rangedIgnoreChance) {
                lines.push(`Ignore ranged: ${Math.round(card.rangedIgnoreChance * 100)}%`);
            }
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
        } else if (card.type === 'amulet' || card.type === 'amuletPickup') {
            lines.push(this.describeAmuletCard(card));
            if (card.type === 'amuletPickup') lines.push('Tap to equip · drag to bag to discard');
        } else if (card.type === 'key') {
            lines.push(t(this.scene, 'tooltip.keySafe'));
        } else if (card.type === 'gem') {
            lines.push(t(this.scene, 'tooltip.effect', { effect: this.describeGemEffect(card.gemEffect) }));
        } else if (card.type === 'junk') {
            lines.push(card.description ? translateDescription(this.scene, card.description) : 'No effect.');
            if (card.carnivalToken) lines.push('A carnival token.');
        }

        return lines;
    },
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
    },
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
    },
    getMergeBlockReason(cardA, cardB) {
        if (!cardA || !cardB) return '';
        if (cardA.type !== cardB.type) return '';
        if (cardA.type === 'magic' || cardB.type === 'magic') return translateDescription(this.scene, 'magic cards cannot merge');
        if (cardA.type === 'gem' || cardB.type === 'gem') return translateDescription(this.scene, 'gems socket into weapons');
        if (this.getMergeKey(cardA) !== this.getMergeKey(cardB)) return translateDescription(this.scene, 'different family');
        if (cardA.rarity !== cardB.rarity) return `rarity ${cardA.rarity || '?'} vs ${cardB.rarity || '?'}`;
        if (this.getMergeStatsKey(cardA) !== this.getMergeStatsKey(cardB)) return translateDescription(this.scene, 'stats/effect differ');
        return '';
    },
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
            amuletPickup: 'tooltip.relic',
            key: 'tooltip.key',
            coin: 'tooltip.coins',
            crystal: 'tooltip.ruby'
        };
        return names[card.type] ? t(this.scene, names[card.type]) : this.capitalize(card.type);
    },
    describeWeaponSpecial(card) {
        const special = card.special || '';
        if (special === 'dualWield') return translateDescription(this.scene, 'dual wield');
        if (special === 'throwing') return translateDescription(this.scene, 'hits any enemy');
        if (special === 'block') return translateDescription(this.scene, 'can block');
        if (special === 'specialAttack') return translateDescription(this.scene, 'heavy strike');
        return special;
    },
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
    },
    describeAmuletCard(card) {
        const definitions = this.scene?.amuletManager?.amuletDefinitions;
        const defId = card.amuletId || card.id;
        if (defId && definitions?.[defId]) return translateDescription(this.scene, definitions[defId].description);
        if (card.description) return translateDescription(this.scene, card.description);
        return translateDescription(this.scene, 'A passive relic effect.');
    },
    describeGemEffect(effect) {
        if (effect === 'fire') return translateDescription(this.scene, 'splash adjacent enemies');
        if (effect === 'poison') return translateDescription(this.scene, 'stacking poison on hit');
        if (effect === 'lightning') return translateDescription(this.scene, 'zaps up to 3 open enemies');
        return translateDescription(this.scene, 'adds an effect to a weapon');
    },
    capitalize(value) {
        const text = (value || '').toString();
        return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
    },
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
    },
};

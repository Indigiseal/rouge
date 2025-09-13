import { CardSystem } from '../cardSystem.js';
import { SoundHelper } from '../utils/SoundHelper.js';

export class ShopScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ShopScene' });
    }
    
    create(data) {
        this.gameState = data.gameState;
        this.shopItems = [];
        this.sellingMode = false;
        this.selectedInventorySlot = -1;
        
        // Get reference to GameScene for inventory access
        this.gameScene = this.scene.get('GameScene');
        
        // Title
        this.add.text(320, 20, 'Shop', { 
            fontSize: '28px', 
            fill: '#ffffff', 
            fontFamily: '"Roboto Condensed"' 
        }).setOrigin(0.5);
        
        // Coins and Crystals display
        this.coinsText = this.add.text(270, 45, `Coins: ${this.gameState.coins}`, { 
            fontSize: '16px', 
            fill: '#ffd700', 
            fontFamily: '"Roboto Condensed"' 
        }).setOrigin(0.5);
        
        this.crystalsText = this.add.text(370, 45, `Crystals: ${this.gameState.crystals}`, { 
            fontSize: '16px', 
            fill: '#00ffff', 
            fontFamily: '"Roboto Condensed"' 
        }).setOrigin(0.5);
        
        // Mode toggle button
        this.modeButton = this.add.text(480, 45, 'Sell Items', {
            fontSize: '14px',
            fill: '#ffffff',
            backgroundColor: '#444444',
            padding: { x: 8, y: 4 },
            fontFamily: '"Roboto Condensed"'
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.toggleMode());
        
        // Generate and display shop items
        this.generateShopItems();
        this.displayShopItems();
        
        // Create inventory display (initially hidden)
        this.createInventoryDisplay();
        
        // Continue button
        const continueButton = this.add.text(320, 340, 'Continue to Next Floor', { 
            fontSize: '18px', 
            fill: '#00ff00', 
            fontFamily: '"Roboto Condensed"' 
        })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            // NO nextFloor() here—map already did it
            this.scene.stop(); // Close shop
            this.scene.wake('MapViewScene'); // Back to map
            console.log('Woke MapViewScene after shop');
        });
        continueButton.setOrigin(0.5);
    }
    
    // Helper method to get current inventory
    getCurrentInventory() {
        if (this.gameScene && this.gameScene.inventorySystem) {
            return this.gameScene.inventorySystem.slots;
        }
        // Fallback to gameState inventory for backward compatibility
        return this.gameState.inventory || [];
    }
    
    // Helper method to get inventory size
    getInventorySize() {
        if (this.gameScene && this.gameScene.inventorySystem) {
            return this.gameScene.inventorySystem.slots.length;
        }
        return 5; // Default size
    }
    
    generateShopItems() {
        // Hide game scene UI
        if (this.gameScene && this.gameScene.inventorySystem) {
            this.gameScene.inventorySystem.setVisibility(false);
        }
        
        // Use a temporary CardSystem to generate card data
        const cardGenerator = new CardSystem(this);
        const floor = this.gameState.currentFloor;
        
        // Clear existing items
        this.shopItems = [];
        
        // Slot 1: Healing Potion (guaranteed)
        const potionData = cardGenerator.createCardData('potion', floor);
        if (potionData) {
            this.shopItems.push({ 
                data: potionData, 
                price: potionData.cost || this.calculateItemPrice(potionData),
                currency: 'coins',
                purchased: false 
            });
        }
        
        // Slot 2: Food (guaranteed)
        const foodData = cardGenerator.createCardData('food', floor);
        if (foodData) {
            this.shopItems.push({ 
                data: foodData, 
                price: foodData.cost || this.calculateItemPrice(foodData),
                currency: 'coins',
                purchased: false 
            });
        }
        
        // Slot 3: Weapon (guaranteed) - FIXED to use CardDataGenerator
        const weaponData = cardGenerator.createCardData('weapon', floor);
        if (weaponData) {
            const weaponPrice = this.calculateItemPrice(weaponData);
            this.shopItems.push({ 
                data: weaponData, 
                price: weaponPrice,
                currency: 'coins',
                purchased: false 
            });
        }
        
        // Slot 4: Armor (guaranteed) - FIXED to use CardDataGenerator
        const armorData = cardGenerator.createCardData('armor', floor);
        if (armorData) {
            const armorPrice = this.calculateItemPrice(armorData);
            this.shopItems.push({ 
                data: armorData, 
                price: armorPrice,
                currency: 'coins',
                purchased: false 
            });
        }
        
        // Slot 5: Magic Spell (guaranteed)
        const magicData = cardGenerator.createCardData('magic', floor);
        if (magicData) {
            const magicPrice = magicData.cost || this.calculateItemPrice(magicData);
            this.shopItems.push({ 
                data: magicData, 
                price: magicPrice,
                currency: 'coins',
                purchased: false 
            });
        }
        
        // Slots 6-7: Random duplicates from available types (NO AMULETS HERE)
        const duplicateTypes = ['weapon', 'armor', 'magic', 'potion', 'food'];
        for (let i = 0; i < 2; i++) {
            const randomType = duplicateTypes[Math.floor(Math.random() * duplicateTypes.length)];
            const itemData = cardGenerator.createCardData(randomType, floor);
            
            if (itemData) {
                const itemPrice = itemData.cost || this.calculateItemPrice(itemData);
                this.shopItems.push({ 
                    data: itemData, 
                    price: itemPrice,
                    currency: 'coins',
                    purchased: false 
                });
            }
        }
        
        // Slot 8: Amulet (costs CRYSTALS)
        const amuletData = cardGenerator.createCardData('amulet', floor);
        if (amuletData) {
            // Amulets cost crystals, price based on rarity
            const crystalPrice = this.calculateAmuletCrystalPrice(amuletData);
            this.shopItems.push({ 
                data: amuletData, 
                price: crystalPrice,
                currency: 'crystals', // IMPORTANT: Amulets use crystals
                purchased: false 
            });
        }
    }
    
    calculateAmuletCrystalPrice(amulet) {
        // Base crystal price for amulets
        let basePrice = 2;
        
        // Adjust based on rarity
        const rarityMultiplier = {
            common: 1,
            uncommon: 1.5,
            rare: 2,
            legendary: 3,
            cursed: 1.5 // Cursed amulets are slightly cheaper
        };
        
        basePrice = Math.floor(basePrice * (rarityMultiplier[amulet.rarity] || 1));
        
        // Minimum price is 1 crystal
        return Math.max(1, basePrice);
    }
    
    calculateItemPrice(item, isArtifact = false) {
        const floor = this.gameState.currentFloor;
        let basePrice = 5 + floor * 2;
        
        // Rarity multipliers
        const rarityMultiplier = {
            common: 1,
            uncommon: 1.5,
            rare: 2,
            legendary: 3
        };
        
        basePrice *= (rarityMultiplier[item.rarity] || 1);
        
        // Type adjustments
        if (item.type === 'weapon') {
            basePrice += item.damage || 0;
        } else if (item.type === 'armor') {
            basePrice += (item.protection || 0) * 2;
        } else if (item.type === 'magic') {
            basePrice *= 1.2; // Magic cards are slightly more expensive
        }
        
        // Artifacts are more expensive
        if (isArtifact) {
            basePrice *= 2;
        }
        
        return Math.floor(basePrice);
    }
    
    calculateSellPrice(item) {
        // Sell price is 40% of buy price
        const buyPrice = this.calculateItemPrice(item);
        return Math.floor(buyPrice * 0.4);
    }
    
    displayShopItems() {
        // Clear existing shop display
        if (this.shopContainer) {
            this.shopContainer.destroy(true);
        }
        
        this.shopContainer = this.add.container(0, 0);
        
        // Display 8 shop items in a 4x2 grid
        this.shopItems.forEach((item, i) => {
            const x = 110 + (i % 4) * 110;
            const y = 120 + Math.floor(i / 4) * 110;
            const card = this.add.container(x, y);
            
            const background = this.add.rectangle(0, 0, 100, 100, 0x222222)
                .setStrokeStyle(2, item.currency === 'crystals' ? 0x00ffff : 0xeeeeee);
            
            // Slot number
            const slotText = this.add.text(-40, -40, `${i + 1}`, {
                fontSize: '10px',
                fill: '#666666',
                fontFamily: '"Roboto Condensed"'
            });
            
            const name = this.add.text(0, -35, item.data.name, { 
                fontSize: '10px', 
                fill: '#ffffff', 
                fontFamily: '"Roboto Condensed"', 
                wordWrap: { width: 90 }, 
                align: 'center' 
            }).setOrigin(0.5);
            
            let statsText = '';
            if (item.data.type === 'weapon') {
                statsText = `DMG: ${item.data.damage}`;
            } else if (item.data.type === 'armor') {
                statsText = `DEF: ${item.data.protection}`;
            } else if (item.data.type === 'potion') {
                statsText = `+${item.data.healAmount} HP`;
            } else if (item.data.type === 'food') {
                statsText = `+${item.data.actionAmount} AP`;
            } else if (item.data.type === 'magic') {
                // Short description for magic
                switch(item.data.magicType) {
                    case 'fireball': statsText = '15 DMG'; break;
                    case 'frostRing': statsText = 'Freeze'; break;
                    case 'restoration': statsText = 'Heal+AP'; break;
                    default: statsText = 'Magic'; break;
                }
            } else if (item.data.type === 'amulet') {
                statsText = 'Artifact';
            }
            
            const stats = this.add.text(0, -10, statsText, { 
                fontSize: '9px', 
                fill: '#cccccc', 
                fontFamily: '"Roboto Condensed"',
                align: 'center'
            }).setOrigin(0.5);
            
            // Show price with appropriate currency color
            const priceColor = item.currency === 'crystals' ? '#00ffff' : '#ffd700';
            const currencyText = item.currency === 'crystals' ? 'crystals' : 'coins';
            const priceText = this.add.text(0, 10, `${item.price} ${currencyText}`, { 
                fontSize: '10px', 
                fill: priceColor, 
                fontFamily: '"Roboto Condensed"' 
            }).setOrigin(0.5);
            
            const buyButton = this.add.text(0, 30, item.purchased ? 'Sold' : 'Buy', { 
                fontSize: '12px', 
                fill: item.purchased ? '#888888' : '#00ff00', 
                backgroundColor: '#333333', 
                padding: { x: 4, y: 2 }, 
                fontFamily: '"Roboto Condensed"' 
            })
            .setOrigin(0.5);
            
            if (!item.purchased) {
                buyButton.setInteractive({ useHandCursor: true })
                    .on('pointerdown', () => this.buyItem(item, buyButton));
            }
            
            card.add([background, slotText, name, stats, priceText, buyButton]);
            this.shopContainer.add(card);
        });
    }
    
    createInventoryDisplay() {
        this.inventoryContainer = this.add.container(0, 0);
        this.inventoryContainer.setVisible(false);
        
        // Title for sell mode
        this.sellTitle = this.add.text(320, 70, 'Select an item to sell:', {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: '"Roboto Condensed"'
        }).setOrigin(0.5);
        this.inventoryContainer.add(this.sellTitle);
        
        this.inventorySlots = [];
        
        // Get the current inventory size (supports dynamic sizes from Bottomless Bag)
        const inventorySize = this.getInventorySize();
        const slotsPerRow = Math.min(inventorySize, 5);
        const rows = Math.ceil(inventorySize / slotsPerRow);
        
        // Display player's inventory with dynamic sizing
        for (let i = 0; i < inventorySize; i++) {
            const row = Math.floor(i / slotsPerRow);
            const col = i % slotsPerRow;
            
            // Calculate position based on row and column
            const totalWidth = slotsPerRow * 90;
            const startX = 320 - (totalWidth / 2) + 45; // Center the inventory
            const x = startX + col * 90;
            const y = 180 + row * 120;
            
            const slot = this.add.container(x, y);
            const bg = this.add.rectangle(0, 0, 80, 100, 0x333333)
                .setStrokeStyle(2, i >= 5 ? 0xffd700 : 0x666666) // Gold border for bonus slots
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.selectInventoryItem(i));
            
            const itemNameText = this.add.text(0, -35, '', {
                fontSize: '10px',
                fill: '#ffffff',
                fontFamily: '"Roboto Condensed"',
                wordWrap: { width: 70 },
                align: 'center'
            }).setOrigin(0.5);
            
            const itemStatsText = this.add.text(0, -10, '', {
                fontSize: '9px',
                fill: '#cccccc',
                fontFamily: '"Roboto Condensed"',
                align: 'center'
            }).setOrigin(0.5);
            
            const sellPriceText = this.add.text(0, 15, '', {
                fontSize: '10px',
                fill: '#ffd700',
                fontFamily: '"Roboto Condensed"'
            }).setOrigin(0.5);
            
            const sellButton = this.add.text(0, 35, 'Sell', {
                fontSize: '12px',
                fill: '#ff6666',
                backgroundColor: '#333333',
                padding: { x: 4, y: 2 },
                fontFamily: '"Roboto Condensed"'
            })
            .setOrigin(0.5)
            .setVisible(false);
            
            slot.add([bg, itemNameText, itemStatsText, sellPriceText, sellButton]);
            this.inventorySlots.push({
                container: slot,
                bg: bg,
                nameText: itemNameText,
                statsText: itemStatsText,
                priceText: sellPriceText,
                sellButton: sellButton
            });
            
            this.inventoryContainer.add(slot);
        }
        
        this.updateInventoryDisplay();
    }
    
    updateInventoryDisplay() {
        const currentInventory = this.getCurrentInventory();
        const inventorySize = this.getInventorySize();
        
        // Make sure we have enough slots
        if (this.inventorySlots.length < inventorySize) {
            // Recreate inventory display if size changed
            this.inventoryContainer.destroy(true);
            this.createInventoryDisplay();
            return;
        }
        
        for (let i = 0; i < inventorySize; i++) {
            const item = currentInventory[i];
            const slot = this.inventorySlots[i];
            
            if (!slot) continue; // Safety check
            
            if (item) {
                slot.nameText.setText(item.name || 'Item');
                
                // Show item stats
                let statsText = '';
                if (item.type === 'weapon') {
                    statsText = `DMG: ${item.damage}`;
                } else if (item.type === 'armor') {
                    statsText = `DEF: ${item.protection}`;
                } else if (item.type === 'potion') {
                    statsText = `+${item.healAmount} HP`;
                } else if (item.type === 'food') {
                    statsText = `+${item.actionAmount} AP`;
                } else if (item.type === 'magic') {
                    statsText = 'Magic';
                }
                slot.statsText.setText(statsText);
                
                // Show sell price
                const sellPrice = this.calculateSellPrice(item);
                slot.priceText.setText(`Sell: ${sellPrice} coins`);
                
                // Show sell button
                slot.sellButton.setVisible(true)
                    .removeAllListeners()
                    .setInteractive({ useHandCursor: true })
                    .on('pointerdown', () => this.sellItem(i));
            } else {
                slot.nameText.setText('Empty');
                slot.statsText.setText('');
                slot.priceText.setText('');
                slot.sellButton.setVisible(false);
            }
        }
    }
    
    toggleMode() {
        this.sellingMode = !this.sellingMode;
        
        if (this.sellingMode) {
            this.modeButton.setText('Buy Items');
            this.shopContainer.setVisible(false);
            this.inventoryContainer.setVisible(true);
            this.updateInventoryDisplay();
        } else {
            this.modeButton.setText('Sell Items');
            this.shopContainer.setVisible(true);
            this.inventoryContainer.setVisible(false);
        }
    }
    
    selectInventoryItem(index) {
        this.selectedInventorySlot = index;
        const currentInventory = this.getCurrentInventory();
        
        // Update visual selection
        this.inventorySlots.forEach((slot, i) => {
            if (i === index && currentInventory[i]) {
                slot.bg.setStrokeStyle(3, 0xffff00);
            } else {
                slot.bg.setStrokeStyle(2, i >= 5 ? 0xffd700 : 0x666666);
            }
        });
    }
    
    sellItem(index) {
        const currentInventory = this.getCurrentInventory();
        const item = currentInventory[index];
        if (!item) return;
        
        const sellPrice = this.calculateSellPrice(item);
        this.gameState.coins += sellPrice;
        
        // PROPERLY remove item from the inventory system
        if (this.gameScene && this.gameScene.inventorySystem) {
            // First clean up any sprites associated with this slot
            const slot = this.gameScene.inventorySystem.slotSprites[index];
            if (slot) {
                // Clean up all associated sprites
                if (slot.card) {
                    const infoText = slot.card.getData('infoText');
                    if (infoText) {
                        if (infoText.list) {
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
            }
            
            // Now remove the item data
            this.gameScene.inventorySystem.slots[index] = null;
        } else {
            // Fallback for old system
            this.gameState.inventory[index] = null;
        }
        
        SoundHelper.playSound(this, 'coin_collect', 0.4);
        this.showFeedback(`Sold for ${sellPrice} coins!`, 0xffd700);
        
        this.coinsText.setText(`Coins: ${this.gameState.coins}`);
        this.updateInventoryDisplay();
        
        // Update GameScene UI if it exists
        if (this.gameScene && this.gameScene.updateUI) {
            this.gameScene.updateUI();
        }
    }
    
    buyItem(item, button) {
        if (item.purchased) return;
        
        // Check currency type
        const hasEnoughCurrency = item.currency === 'crystals' 
            ? this.gameState.crystals >= item.price
            : this.gameState.coins >= item.price;
            
        if (!hasEnoughCurrency) {
            this.showFeedback(`Not enough ${item.currency}!`, 0xff0000);
            return;
        }
        
        // Check if it's an amulet - use the new amulet manager system
        if (item.data.type === 'amulet') {
            // Purchase and consume amulet immediately using AmuletManager
            if (this.gameScene && this.gameScene.amuletManager && item.data.id) {
                const success = this.gameScene.amuletManager.addAmulet(item.data.id);
                if (success) {
                    SoundHelper.playSound(this, 'shop_buy', 0.5);
                    
                    // Deduct crystals for amulets
                    if (item.currency === 'crystals') {
                        this.gameState.crystals -= item.price;
                        this.crystalsText.setText(`Crystals: ${this.gameState.crystals}`);
                    } else {
                        this.gameState.coins -= item.price;
                        this.coinsText.setText(`Coins: ${this.gameState.coins}`);
                    }
                    
                    this.showFeedback(`${item.data.name} equipped!`, 0x9932cc);
                    
                    item.purchased = true;
                    button.setText('Sold').setStyle({ fill: '#888888' }).removeInteractive();
                    
                    // Update GameScene UI
                    if (this.gameScene.updateUI) {
                        this.gameScene.updateUI();
                    }
                } else {
                    this.showFeedback('Already owned!', 0xff0000);
                }
            } else {
                // Fallback to old system for legacy amulets
                SoundHelper.playSound(this, 'shop_buy', 0.5);
                
                if (item.currency === 'crystals') {
                    this.gameState.crystals -= item.price;
                    this.crystalsText.setText(`Crystals: ${this.gameState.crystals}`);
                } else {
                    this.gameState.coins -= item.price;
                    this.coinsText.setText(`Coins: ${this.gameState.coins}`);
                }
                
                if (item.data.effect === 'health') {
                    this.gameState.maxHealth += item.data.value;
                    this.gameState.playerHealth += item.data.value;
                    this.showFeedback(`+${item.data.value} Max HP!`, 0x00ff00);
                } else if (item.data.effect === 'max_actions') {
                    this.gameState.maxActions += item.data.value;
                    this.showFeedback(`+${item.data.value} Max Actions!`, 0x00ff00);
                } else {
                    this.showFeedback(`${item.data.name} equipped!`, 0x9932cc);
                }
                
                this.gameState.activeAmulets.push(item.data);
                
                item.purchased = true;
                button.setText('Sold').setStyle({ fill: '#888888' }).removeInteractive();
                
                if (this.gameScene && this.gameScene.updateUI) {
                    this.gameScene.updateUI();
                }
            }
            return;
        }
        
        // For non-amulet items, add to inventory system
        if (this.gameScene && this.gameScene.inventorySystem) {
            if (!this.gameScene.inventorySystem.addCard(item.data)) {
                this.showFeedback('Inventory Full!', 0xff0000);
                return;
            }
        } else {
            // Fallback for old system
            const emptySlot = this.gameState.inventory.findIndex(slot => slot === null);
            if (emptySlot === -1) {
                this.showFeedback('Inventory Full!', 0xff0000);
                return;
            }
            this.gameState.inventory[emptySlot] = item.data;
        }
        
        SoundHelper.playSound(this, 'shop_buy', 0.5);
        
        // Deduct appropriate currency
        if (item.currency === 'crystals') {
            this.gameState.crystals -= item.price;
            this.crystalsText.setText(`Crystals: ${this.gameState.crystals}`);
        } else {
            this.gameState.coins -= item.price;
            this.coinsText.setText(`Coins: ${this.gameState.coins}`);
        }
        
        item.purchased = true;
        button.setText('Sold').setStyle({ fill: '#888888' }).removeInteractive();
        this.showFeedback('Purchased!', 0x00ff00);
        
        // Update GameScene UI
        if (this.gameScene && this.gameScene.updateUI) {
            this.gameScene.updateUI();
        }
    }
    
    showFeedback(message, color) {
        const feedBackText = this.add.text(320, 300, message, { 
            fontSize: '16px', 
            fill: Phaser.Display.Color.IntegerToColor(color).rgba, 
            fontFamily: '"Roboto Condensed"' 
        }).setOrigin(0.5);
        
        this.tweens.add({
            targets: feedBackText,
            alpha: 0,
            y: 280,
            duration: 1500,
            onComplete: () => feedBackText.destroy()
        });
    }
}
import { CardSystem } from '../cardSystem.js';
import { SoundHelper } from '../utils/SoundHelper.js';
import { StationRoomBase } from './StationRoomBase.js';

export class ShopScene extends StationRoomBase {
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
        this.enableShopStation();
        
        // Title
        this.add.text(320, 20, 'Shop', { 
            fontSize: '28px', 
            fill: '#ffffff', 
            fontFamily: '"HoMM Pixel"' 
        }).setOrigin(0.5);
        
        // Coins and Crystals display
        this.coinsText = this.add.text(270, 45, `Coins: ${this.gameState.coins}`, { 
            fontSize: '16px', 
            fill: '#ffd700', 
            fontFamily: '"HoMM Pixel"' 
        }).setOrigin(0.5);
        
        this.crystalsText = this.add.text(370, 45, `Crystals: ${this.gameState.crystals}`, {
            fontSize: '16px',
            fill: '#00ffff',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);

        const _shopAct = Math.floor((this.gameState.currentFloor - 1) / 15) + 1;
        this.add.text(580, 12, `Act ${_shopAct}  Floor ${this.gameState.currentFloor}`, {
            fontSize: '11px',
            fill: '#a78f70',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);

        // Mode toggle button
        this.modeButton = this.add.text(480, 45, 'Sell Items', {
            fontSize: '14px',
            fill: '#ffffff',
            backgroundColor: '#444444',
            padding: { x: 8, y: 4 },
            fontFamily: '"HoMM Pixel"'
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
            fontFamily: '"HoMM Pixel"' 
        })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.closeStation());
        continueButton.setOrigin(0.5);
    }

    // enableShopStation / closeStation now live on StationRoomBase

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
        /*
        // Hide game scene UI
        if (this.gameScene && this.gameScene.inventorySystem) {
            this.gameScene.inventorySystem.setVisibility(false);
        }
        */
        
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
                price: this.calculateItemPrice(potionData),
                currency: 'coins',
                purchased: false 
            });
        }
        
        // Slot 2: Regular weapon (guaranteed)
        const weaponData = cardGenerator.createCardData('weapon', floor);
        if (weaponData) {
            this.shopItems.push({
                data: weaponData,
                price: this.calculateItemPrice(weaponData),
                currency: 'coins',
                purchased: false 
            });
        }
        
        // Slot 3: Armor (guaranteed) - FIXED to use CardDataGenerator
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

        // Slot 5: Thorns Card (guaranteed)
        const thornsData = cardGenerator.createCardData('thorns', floor);
        if (thornsData) {
            const thornsPrice = this.calculateItemPrice(thornsData);
            this.shopItems.push({
                data: thornsData,
                price: thornsPrice,
                currency: 'coins',
                purchased: false
            });
        }

        // Slot 6: Magic Spell (guaranteed)
        const magicData = cardGenerator.createCardData('magic', floor);
        if (magicData) {
            const magicPrice = this.calculateItemPrice(magicData);
            this.shopItems.push({ 
                data: magicData, 
                price: magicPrice,
                currency: 'coins',
                purchased: false 
            });
        }
        
        // Slot 7: Random duplicate from available types (weighted toward weapons)
        const duplicateTypes = ['weapon', 'weapon', 'weapon', 'magic', 'potion', 'thorns', 'armor', 'food'];
        for (let i = 0; i < 1; i++) {
            const randomType = duplicateTypes[Math.floor(Math.random() * duplicateTypes.length)];
            const itemData = cardGenerator.createCardData(randomType, floor);
            
            if (itemData) {
                const itemPrice = this.calculateItemPrice(itemData);
                this.shopItems.push({ 
                    data: itemData, 
                    price: itemPrice,
                    currency: 'coins',
                    purchased: false 
                });
            }
        }
        
        // Slot 8: Amulet (costs CRYSTALS)
        const amuletData = cardGenerator.createCardData('amulet', floor, false, this.gameState);
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

        // Bonus slots from Merchant's Pact — one higher-quality item per amulet stack
        const bonusSlots = this.gameScene?.amuletManager?.getBonusShopSlots?.() || 0;
        for (let i = 0; i < bonusSlots; i++) {
            const bonusItem = this.createMerchantBonusItem(cardGenerator, floor);
            if (bonusItem) this.shopItems.push(bonusItem);
        }
    }

    // Creates a higher-rarity weapon or armor that appears as the Merchant's Pact
    // bonus slot. Toned down — epics/legendaries should be scarce, so the
    // regular shop tops out at epic only very late, rare otherwise.
    createMerchantBonusItem(cardGenerator, floor) {
        let quality = floor >= 30 ? 'epic' : floor >= 15 ? 'rare' : 'uncommon';
        const type = Math.random() < 0.5 ? 'weapon' : 'armor';
        let item = cardGenerator.createCardData(type, floor, false, null, quality);
        if (!item) return null;
        // Axe & plate are act-3 endgame gear: shops may stock them but never at
        // epic/legendary. Re-roll those types down to rare at most.
        if ((item.weaponType === 'axe' || item.armorType === 'plate') &&
            (item.rarity === 'epic' || item.rarity === 'legendary')) {
            item = cardGenerator.createCardData(type, floor, false, null, 'rare');
            if (!item) return null;
        }
        const price = this.calculateItemPrice(item);
        return { data: item, price, currency: 'coins', purchased: false };
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
            epic: 2.5,
            legendary: 3
        };
        
        basePrice *= (rarityMultiplier[item.rarity] || 1);
        
        // Type adjustments
        if (item.type === 'weapon') {
            basePrice += item.damage || 0;
        } else if (item.type === 'armor') {
            basePrice += (item.protection || 0) * 2;
        } else if (item.type === 'thorns') {
            basePrice += (item.thornDamage || 0) * 3;
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

    getItemDisplayName(item) {
        if (!item) return 'Item';
        if (item.type === 'potion') {
            return this.getPotionDisplayName(item);
        }
        return item.name || 'Item';
    }

    getPotionDisplayName(item) {
        const healAmount = item.healAmount || 0;
        if (healAmount >= 100) return 'Greater Healing Potion';
        if (healAmount >= 50) return 'Strong Healing Potion';
        if (healAmount >= 30) return 'Healing Potion';
        return 'Minor Healing Potion';
    }
    
    displayShopItems() {
        // Combat-style board: cards fly in face-down, then flip open one by one.
        this.displayItemsAsBoard();
    }

    // buildItemCard / createItemSprite / getRarityColor live on StationRoomBase

    capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

    createInventoryDisplay() {
        this.inventoryContainer = this.add.container(0, 0);
        this.inventoryContainer.setVisible(false);
        
        // Title for sell mode
        this.sellTitle = this.add.text(320, 70, 'Select an item to sell:', {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel"'
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
                fontFamily: '"HoMM Pixel"',
                wordWrap: { width: 70 },
                align: 'center'
            }).setOrigin(0.5);
            
            const itemStatsText = this.add.text(0, -10, '', {
                fontSize: '9px',
                fill: '#cccccc',
                fontFamily: '"HoMM Pixel"',
                align: 'center'
            }).setOrigin(0.5);
            
            const sellPriceText = this.add.text(0, 15, '', {
                fontSize: '10px',
                fill: '#ffd700',
                fontFamily: '"HoMM Pixel"'
            }).setOrigin(0.5);
            
            const sellButton = this.add.text(0, 35, 'Sell', {
                fontSize: '12px',
                fill: '#ff6666',
                backgroundColor: '#333333',
                padding: { x: 4, y: 2 },
                fontFamily: '"HoMM Pixel"'
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
                slot.nameText.setText(this.getItemDisplayName(item));
                
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
            this.setShopBoardVisible(false);
            this.inventoryContainer.setVisible(true);
            this.updateInventoryDisplay();
        } else {
            this.modeButton.setText('Sell Items');
            this.setShopBoardVisible(true);
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
        const coinsBefore = this.gameState.coins;
        this.gameState.coins += sellPrice;
        
        if (this.gameScene && this.gameScene.inventorySystem) {
            this.gameScene.inventorySystem.removeCard(index);
        } else {
            // Fallback for old system
            this.gameState.inventory[index] = null;
        }
        
        SoundHelper.playSound(this, 'coin_collect', 0.4);
        this.showFeedback(`Sold ${this.getItemDisplayName(item)} for ${sellPrice} coins (${coinsBefore}->${this.gameState.coins})`, 0xffd700);
        
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
                    this.markButtonDone(button, 'Sold');
                    
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
        this.markButtonDone(button, 'Sold');
        this.showFeedback('Purchased!', 0x00ff00);
        
        // Update GameScene UI
        if (this.gameScene && this.gameScene.updateUI) {
            this.gameScene.updateUI();
        }
    }
    
    // showFeedback lives on StationRoomBase
}

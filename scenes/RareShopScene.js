import { CardSystem } from '../cardSystem.js';
import { InventorySystem } from '../inventorySystem.js';
import { SoundHelper } from '../utils/SoundHelper.js';

export class RareShopScene extends Phaser.Scene {
    constructor() {
        super({ key: 'RareShopScene' });
    }

    create(data) {
        this.gameState = data.gameState;
        this.shopItems = [];
        
        // Get reference to GameScene for inventory and amulet manager access
        this.gameScene = this.scene.get('GameScene');
        this.enableShopStation();
        
        /*
        // Hide game scene UI
        if (this.gameScene && this.gameScene.inventorySystem) {
            this.gameScene.inventorySystem.setVisibility(false);
        }
        */

        this.add.text(320, 30, 'Rare Goods', { 
            fontSize: '28px', 
            fill: '#DA70D6', 
            fontFamily: '"HoMM Pixel"' 
        }).setOrigin(0.5);
        
        this.coinsText = this.add.text(450, 60, `Coins: ${this.gameState.coins}`, { 
            fontSize: '16px', 
            fill: '#ffd700', 
            fontFamily: '"HoMM Pixel"' 
        }).setOrigin(0.5);
        
        this.crystalsText = this.add.text(190, 60, `Crystals: ${this.gameState.crystals}`, { 
            fontSize: '16px', 
            fill: '#00ffff', 
            fontFamily: '"HoMM Pixel"' 
        }).setOrigin(0.5);
        
        this.generateShopItems();
        this.displayShopItems();
        
        const continueButton = this.add.text(320, 330, 'Continue to Next Floor', { 
            fontSize: '18px', 
            fill: '#00ff00', 
            fontFamily: '"HoMM Pixel"' 
        })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            this.closeShop();
            return;
            // NO nextFloor() here—map already did it
            this.scene.stop(); // Close rare shop
            this.scene.wake('MapViewScene'); // Back to map
            console.log('Woke MapViewScene after rare shop');
        });
        continueButton.setOrigin(0.5);
    }

    enableShopStation() {
        if (!this.gameScene?.inventorySystem) return;
        this.scene.wake('GameScene', { shopStation: true });
        this.gameScene.inventorySystem.setStationMode(true);
        this.gameScene.inventorySystem.setVisibility(true);
    }

    closeShop() {
        if (this.gameScene?.inventorySystem) {
            this.gameScene.inventorySystem.setStationMode(false);
            this.gameScene.inventorySystem.setVisibility(false);
            this.scene.sleep('GameScene');
        }
        this.scene.stop();
        this.scene.wake('MapViewScene');
        console.log('Woke MapViewScene after rare shop');
    }
    
    generateShopItems() {
        const cardGenerator = new CardSystem(this);
        
        // 1. Generate an amulet (costs crystals)
        const amuletData = cardGenerator.createCardData('amulet');
        this.shopItems.push({ 
            data: amuletData, 
            price: 2 + Math.floor(this.gameState.currentFloor / 3), 
            currency: 'crystals', 
            purchased: false 
        });
        
        // 2. Generate an uncommon weapon (costs coins) - Force uncommon rarity
        const uncommonWeapon = this.createUpgradedWeapon();
        const weaponPrice = (15 + this.gameState.currentFloor * 5);
        this.shopItems.push({ 
            data: uncommonWeapon, 
            price: weaponPrice, 
            currency: 'coins', 
            purchased: false 
        });
        
        // 3. Generate an uncommon armor (costs coins) - Force uncommon rarity
        const uncommonArmor = this.createUpgradedArmor();
        const armorPrice = (12 + this.gameState.currentFloor * 5);
        this.shopItems.push({ 
            data: uncommonArmor, 
            price: armorPrice, 
            currency: 'coins', 
            purchased: false 
        });

        // 4. Generate an upgraded thorns card
        const thornsCard = cardGenerator.createCardData('thorns');
        thornsCard.rarity = 'uncommon';
        thornsCard.thornDamage = Math.max(thornsCard.thornDamage + 1, Math.floor(thornsCard.thornDamage * 1.5));
        thornsCard.maxDurability = 7;
        thornsCard.durability = 7;
        this.shopItems.push({
            data: thornsCard,
            price: 14 + this.gameState.currentFloor * 3,
            currency: 'coins',
            purchased: false
        });
        
        // Shuffle items
        this.shopItems.sort(() => Math.random() - 0.5);
    }
    
    createUpgradedWeapon() {
        const cardGenerator = new CardSystem(this);
        const floor = this.gameState.currentFloor;
        
        // Get available weapon types for this floor
        const weaponTypes = ['dagger', 'venomousDagger', 'spear', 'sword', 'axe'];
        const availableWeapons = [];
        
        weaponTypes.forEach(weaponType => {
            const weaponUnlocks = cardGenerator.cardDataGenerator.weaponUnlocks[weaponType];
            if (weaponUnlocks && weaponUnlocks.uncommon && floor >= weaponUnlocks.uncommon.floor) {
                availableWeapons.push({
                    type: weaponType,
                    data: weaponUnlocks.uncommon
                });
            }
        });
        
        if (availableWeapons.length === 0) {
            // Fallback - create a basic uncommon weapon
            return {
                type: 'weapon',
                name: 'Uncommon Sword',
                weaponType: 'sword',
                damage: 7 + Math.floor(floor / 3),
                rarity: 'uncommon',
                sprite: 'sword_U',
                special: null,
                durability: 8,
                maxDurability: 8
            };
        }
        
        const selected = availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
        const weaponData = selected.data;
        const rarityName = 'Uncommon';
        const weaponNames = {
            venomousDagger: 'Venomous Dagger'
        };
        const weaponName = weaponNames[selected.type] || selected.type.charAt(0).toUpperCase() + selected.type.slice(1);
        
        // Get proper durability
        const durabilityMap = {
            dagger: { uncommon: 5 },
            venomousDagger: { uncommon: 5 },
            spear: { uncommon: 6 },
            sword: { uncommon: 8 },
            axe: { uncommon: 4 }
        };
        const maxDurability = durabilityMap[selected.type].uncommon;
        
        return {
            type: 'weapon',
            name: `${rarityName} ${weaponName}`,
            weaponType: selected.type,
            damage: weaponData.damage + Math.floor(floor / 3),
            rarity: 'uncommon',
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
    
    createUpgradedArmor() {
        const cardGenerator = new CardSystem(this);
        const floor = this.gameState.currentFloor;
        
        // Get available armor types for this floor
        const armorTypes = ['leather', 'chain', 'plate'];
        const availableArmors = [];
        
        armorTypes.forEach(armorType => {
            const armorUnlocks = cardGenerator.cardDataGenerator.armorUnlocks[armorType];
            if (armorUnlocks && armorUnlocks.uncommon && floor >= armorUnlocks.uncommon.floor) {
                availableArmors.push({
                    type: armorType,
                    data: armorUnlocks.uncommon
                });
            }
        });
        
        if (availableArmors.length === 0) {
            // Fallback - create a basic uncommon armor
            return {
                type: 'armor',
                name: 'Uncommon Leather Armor',
                armorType: 'leather',
                protection: 4 + Math.floor(floor / 4),
                reflection: 15,
                rarity: 'uncommon',
                sprite: 'leather_C',
                durability: 25,
                maxDurability: 25
            };
        }
        
        const selected = availableArmors[Math.floor(Math.random() * availableArmors.length)];
        const armorData = selected.data;
        const rarityName = 'Uncommon';
        const armorName = selected.type.charAt(0).toUpperCase() + selected.type.slice(1);
        
        return {
            type: 'armor',
            name: `${rarityName} ${armorName} Armor`,
            armorType: selected.type,
            protection: armorData.protection + Math.floor(floor / 4),
            reflection: armorData.reflection,
            dodgeChance: armorData.dodgeChance,
            rarity: 'uncommon',
            sprite: armorData.sprite,
            durability: 25, // Uncommon armor base durability
            maxDurability: 25
        };
    }
    
    displayShopItems() {
        this.shopItems.forEach((item, i) => {
            const x = 120 + i * 200;
            const y = 180;
            const container = this.add.container(x, y);
            
            const background = this.add.rectangle(0, 0, 180, 190, 0x2c1f2b)
                .setStrokeStyle(2, 0xDA70D6);
            
            const name = this.add.text(0, -75, item.data.name, { 
                fontSize: '14px', 
                fill: '#ffffff', 
                fontFamily: '"HoMM Pixel"', 
                wordWrap: { width: 170 }, 
                align: 'center' 
            }).setOrigin(0.5);
            
            let statsText = '';
            if (item.data.type === 'weapon') {
                statsText = `Damage: ${item.data.damage}`;
                if (item.data.durability) {
                    statsText += `\nDurability: ${item.data.durability}`;
                }
            } else if (item.data.type === 'armor') {
                let armorStats = [`Protection: ${item.data.protection}`];
                if (item.data.dodgeChance) {
                    armorStats.push(`Dodge: ${item.data.dodgeChance * 100}%`);
                }
                if (item.data.reflection) {
                    armorStats.push(`Reflect: ${item.data.reflection}%`);
                }
                if (item.data.durability) {
                    armorStats.push(`Durability: ${item.data.durability}`);
                }
                statsText = armorStats.join('\n');
            } else if (item.data.type === 'amulet') {
                // Use the new amulet system for descriptions
                if (this.gameScene && this.gameScene.amuletManager && item.data.id) {
                    const definition = this.gameScene.amuletManager.amuletDefinitions[item.data.id];
                    if (definition) {
                        statsText = definition.description;
                        if (definition.cursed) {
                            statsText = `[CURSED] ${statsText}`;
                        }
                    }
                } else {
                    // Fallback for legacy amulets
                    if (item.data.effect === 'health') {
                        statsText = `+${item.data.value} Max HP`;
                    } else if (item.data.abilities) {
                        const regen = item.data.abilities.find(a => a.type === 'regeneration');
                        if (regen) statsText = `Regen +${regen.amount}/turn`;
                    } else if (item.data.effect === 'max_actions') {
                        statsText = `+${item.data.value} Max Actions`;
                    }
                }
            }
            
            const stats = this.add.text(0, -35, statsText, { 
                fontSize: '12px', 
                fill: item.data.type === 'amulet' && 
                      this.gameScene && 
                      this.gameScene.amuletManager && 
                      item.data.id && 
                      this.gameScene.amuletManager.amuletDefinitions[item.data.id]?.cursed 
                      ? '#ff6666' : '#cccccc', 
                fontFamily: '"HoMM Pixel"',
                wordWrap: { width: 170 },
                align: 'center'
            }).setOrigin(0.5);
            
            const priceColor = item.currency === 'crystals' ? '#00ffff' : '#ffd700';
            const priceText = this.add.text(0, 20, `Cost: ${item.price} ${item.currency}`, { 
                fontSize: '12px', 
                fill: priceColor, 
                fontFamily: '"HoMM Pixel"' 
            }).setOrigin(0.5);
            
            const buyButton = this.add.text(0, 60, item.purchased ? 'Sold' : 'Buy', { 
                fontSize: '16px', 
                fill: item.purchased ? '#888888' : '#00ff00', 
                backgroundColor: '#333333', 
                padding: { x: 8, y: 4 }, 
                fontFamily: '"HoMM Pixel"' 
            })
            .setOrigin(0.5);
            
            if (!item.purchased) {
                buyButton.setInteractive({ useHandCursor: true })
                    .on('pointerdown', () => this.buyItem(item, buyButton));
            }
                
            container.add([background, name, stats, priceText, buyButton]);
        });
    }
    
    buyItem(item, button) {
        if (item.purchased) return;
        
        // Check currency
        const hasEnoughCurrency = item.currency === 'coins' 
            ? this.gameState.coins >= item.price 
            : this.gameState.crystals >= item.price;
            
        if (!hasEnoughCurrency) {
            this.showFeedback(`Not enough ${item.currency}!`, 0xff0000);
            return;
        }
        
        // Handle item type
        if (item.data.type === 'amulet') {
            // Use the new amulet manager system
            if (this.gameScene && this.gameScene.amuletManager && item.data.id) {
                const success = this.gameScene.amuletManager.addAmulet(item.data.id);
                if (!success) {
                    this.showFeedback('Already owned!', 0xff0000);
                    return;
                }
                this.showFeedback(`${item.data.name} equipped!`, 0x9932cc);
            } else {
                // Fallback to old system for legacy amulets
                this.consumeAmulet(item.data);
            }
        } else {
            // For weapons and armor, use the inventory system
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
            this.showFeedback('Purchased!', 0x00ff00);
        }
        
        // Deduct currency
        if (item.currency === 'coins') {
            this.gameState.coins -= item.price;
        } else {
            this.gameState.crystals -= item.price;
        }
        
        SoundHelper.playSound(this, 'shop_buy', 0.5);
        item.purchased = true;
        
        // Update UI
        this.coinsText.setText(`Coins: ${this.gameState.coins}`);
        this.crystalsText.setText(`Crystals: ${this.gameState.crystals}`);
        button.setText('Sold').setStyle({ fill: '#888888' }).removeInteractive();
        
        // Update GameScene UI if it exists
        if (this.gameScene && this.gameScene.updateUI) {
            this.gameScene.updateUI();
        }
    }
    
    consumeAmulet(amulet) {
        if (amulet.effect === 'health') {
            this.gameState.maxHealth += amulet.value;
            this.gameState.playerHealth += amulet.value;
            this.showFeedback(`+${amulet.value} Max HP!`, 0x00ff00);
        } else if (amulet.effect === 'max_actions') {
            this.gameState.maxActions += amulet.value;
            this.showFeedback(`+${amulet.value} Max Actions!`, 0x00ff00);
        } else {
            this.showFeedback(`${amulet.name} equipped!`, 0x9932cc);
        }
        
        this.gameState.activeAmulets.push(amulet);
    }
    
    showFeedback(message, color) {
        const feedBackText = this.add.text(320, 100, message, { 
            fontSize: '18px', 
            fill: Phaser.Display.Color.IntegerToColor(color).rgba, 
            fontFamily: '"HoMM Pixel"' 
        }).setOrigin(0.5);
        
        this.tweens.add({
            targets: feedBackText,
            alpha: 0,
            y: 80,
            duration: 1500,
            onComplete: () => feedBackText.destroy()
        });
    }
}

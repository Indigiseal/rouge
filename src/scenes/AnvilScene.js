//AnvilScene.js
import { SoundHelper } from '../audio/SoundHelper.js';
import { createTitle } from '../ui/titleText.js';
import { exitToSandboxHub, isSandboxMode } from '../sandbox/SandboxMode.js';
import {
    REPAIR_ARMOR_CHUNK,
    repairCostPerUnit,
    totalRepairCost,
} from '../content/economy/repair.js';
export class AnvilScene extends Phaser.Scene {
    constructor() {
        super({ key: 'AnvilScene' });
    }
    
    create(data) {
        this.gameState = data.gameState;
        this.itemSlotsUI = [];

        this.add.image(540, 78, 'restRooms', 3).setOrigin(0.5);
        
        // Title and coins display
        createTitle(this, 320, 30, 'Anvil - Repair Station', {
            color: '#ffffff',
            fallbackSize: '28px'
        });
        
        this.coinsText = this.add.text(320, 60, `Coins: ${this.gameState.coins}`, { 
            fontSize: '16px', 
            fill: '#ffd700', 
            fontFamily: '"HoMM Pixel"' 
        }).setOrigin(0.5);
        
        // Display repairable items
        this.displayRepairableItems();
        
        // Continue button
        const continueButton = this.add.text(320, 330, 'Continue to Next Floor', { 
            fontSize: '18px', 
            fill: '#00ff00', 
            fontFamily: '"HoMM Pixel"' 
        })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            // NO nextFloor() here—map already did it
            if (isSandboxMode(this)) {
                exitToSandboxHub(this);
                return;
            }
            this.scene.stop(); // Close anvil
            this.scene.wake('MapViewScene'); // Back to map
            console.log('Woke MapViewScene after anvil');
        });
        continueButton.setOrigin(0.5);
    }
    
    displayRepairableItems() {
        console.log('=== ANVIL DEBUG ===');
        
        // Clear existing UI
        this.itemSlotsUI.forEach(slot => slot.destroy());
        this.itemSlotsUI = [];
        
        const repairableItems = [];
        
        // Get the REAL inventory from GameScene (don't redeclare gameScene)
        const gameScene = this.scene.get('GameScene');
        const inventoryToCheck = (gameScene && gameScene.inventorySystem) 
            ? gameScene.inventorySystem.slots 
            : this.gameState.inventory;
        
        console.log('gameState.inventory:', this.gameState.inventory);
        if (gameScene && gameScene.inventorySystem) {
            console.log('GameScene inventorySystem.slots:', gameScene.inventorySystem.slots);
        }
        
        // Add items from the ACTUAL inventory
        inventoryToCheck.forEach((item, index) => {
            if (item && (item.type === 'weapon' || item.type === 'armor' || item.type === 'thorns')) {
                console.log(`Checking ${item.name}: dur=${item.durability}, max=${item.maxDurability}`);
                
                if (item.maxDurability && item.durability < item.maxDurability) {
                    repairableItems.push({ 
                        item, 
                        index, 
                        isEquipped: false 
                    });
                    console.log(`  -> Needs repair!`);
                }
            }
        });
        
        // Check equipped armor
        if (this.gameState.equippedArmor) {
            const armor = this.gameState.equippedArmor;
            console.log(`Equipped armor: ${armor.name}, dur: ${armor.durability}, max: ${armor.maxDurability}`);
            
            if (armor.maxDurability && armor.durability < armor.maxDurability) {
                repairableItems.push({ 
                    item: armor, 
                    index: -1,
                    isEquipped: true 
                });
                console.log(`  -> Equipped armor needs repair!`);
            }
        }
        
        console.log(`Total repairable items: ${repairableItems.length}`);
        console.log('===================');
        
        // If no items need repair, show message
        if (repairableItems.length === 0) {
            this.add.text(320, 180, 'No items need repair.', { 
                fontSize: '14px', 
                fill: '#cccccc', 
                fontFamily: '"HoMM Pixel"' 
            }).setOrigin(0.5);
            return;
        }
        
        // Display each repairable item
        repairableItems.forEach((data, i) => {
            const x = 160 + (i % 3) * 160;
            const y = 140 + Math.floor(i / 3) * 140;
            this.createRepairItemUI(data, x, y);
        });
    }
    
    createRepairItemUI(data, x, y) {
        const { item, index, isEquipped } = data;
        const container = this.add.container(x, y);
        this.itemSlotsUI.push(container);
        
        // Background
        const background = this.add.rectangle(0, 0, 150, 120, 0x222222)
            .setStrokeStyle(2, 0xeeeeee);
        
        // Item name
        const nameText = isEquipped ? `${item.name} (E)` : item.name;
        const name = this.add.text(0, -45, nameText, { 
            fontSize: '12px', 
            fill: '#ffffff', 
            wordWrap: { width: 140 }, 
            align: 'center', 
            fontFamily: '"HoMM Pixel"' 
        }).setOrigin(0.5);
        
        // Durability display
        const durabilityText = `${item.durability}/${item.maxDurability}`;
        const durability = this.add.text(0, -25, durabilityText, { 
            fontSize: '11px', 
            fill: item.durability <= item.maxDurability * 0.3 ? '#ff6666' : '#cccccc', 
            fontFamily: '"HoMM Pixel"' 
        }).setOrigin(0.5);
        
        // Calculate repair cost
        const repairCost = this.calculateRepairCost(item);
        const missingDurability = item.maxDurability - item.durability;
        const totalCost = totalRepairCost(item, missingDurability, this.getWeaponType(item.name));
        
        // Cost display
        const costText = this.add.text(0, -5, `Cost: ${totalCost} coins`, { 
            fontSize: '11px', 
            fill: '#ffd700', 
            fontFamily: '"HoMM Pixel"' 
        }).setOrigin(0.5);
        
        // Repair info
        const repairInfo = this.add.text(0, 10, 
            item.type === 'armor' 
                ? `(${repairCost} per ${REPAIR_ARMOR_CHUNK} pts)` 
                : `(${repairCost} per pt)`, 
            { 
                fontSize: '9px', 
                fill: '#888888', 
                fontFamily: '"HoMM Pixel"' 
            }
        ).setOrigin(0.5);
        
        // Repair buttons
        const buttonY = 35;
        
        // Full repair button
        const fullRepairButton = this.add.text(-35, buttonY, 'Full', { 
            fontSize: '12px', 
            fill: totalCost <= this.gameState.coins ? '#00ff00' : '#666666', 
            backgroundColor: '#333333', 
            padding: { x: 4, y: 2 }, 
            fontFamily: '"HoMM Pixel"' 
        }).setOrigin(0.5);
        
        if (totalCost <= this.gameState.coins) {
            fullRepairButton.setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.repairItem(data, missingDurability));
        }
        
        // Partial repair button (repair 5 points for armor, 1 point for other durable cards)
        const partialAmount = item.type === 'armor' ? REPAIR_ARMOR_CHUNK : 1;
        const partialCost = item.type === 'armor' ? repairCost : repairCost;
        const canPartialRepair = partialCost <= this.gameState.coins && missingDurability > 0;
        
        const partialRepairButton = this.add.text(35, buttonY, 
            item.type === 'armor' ? `+${REPAIR_ARMOR_CHUNK}` : '+1', 
            { 
                fontSize: '12px', 
                fill: canPartialRepair ? '#0088ff' : '#666666', 
                backgroundColor: '#333333', 
                padding: { x: 4, y: 2 }, 
                fontFamily: '"HoMM Pixel"' 
            }
        ).setOrigin(0.5);
        
        if (canPartialRepair) {
            partialRepairButton.setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.repairItem(data, Math.min(partialAmount, missingDurability)));
        }
        
        container.add([
            background, 
            name, 
            durability, 
            costText, 
            repairInfo,
            fullRepairButton, 
            partialRepairButton
        ]);
    }
    
    calculateRepairCost(item) {
        return repairCostPerUnit(item, this.getWeaponType(item.name));
    }
    
    getWeaponType(itemName) {
        const name = itemName.toLowerCase();
        if (name.includes('dagger')) return 'dagger';
        if (name.includes('bow')) return 'bow';
        if (name.includes('sword')) return 'sword';
        if (name.includes('axe')) return 'axe';
        return 'sword'; // Default
    }
    
    repairItem(data, repairAmount) {
        const { item, index, isEquipped } = data;
        
        // Calculate actual cost
        const totalCost = totalRepairCost(item, repairAmount, this.getWeaponType(item.name));
        
        if (this.gameState.coins < totalCost) {
            this.showFeedback('Not enough coins!', 0xff0000);
            return;
        }
        
        // Deduct coins and repair item
        this.gameState.coins -= totalCost;
        item.durability = Math.min(item.maxDurability, item.durability + repairAmount);
        
        // Play repair sound
        SoundHelper.playSound(this, 'anvil_upgrade', 0.6);
        
        // Show feedback
        const message = repairAmount === (item.maxDurability - (item.durability - repairAmount))
            ? `${item.name} fully repaired!`
            : `${item.name} +${repairAmount} durability`;
        this.showFeedback(message, 0x00ff00);
        
        // Update UI
        this.coinsText.setText(`Coins: ${this.gameState.coins}`);
        this.displayRepairableItems();
        
        // Update GameScene UI if needed
        const gameScene = this.scene.get('GameScene');
        if (gameScene && gameScene.updateUI) {
            gameScene.updateUI();
        }
    }
    
    showFeedback(message, color) {
        const feedBackText = this.add.text(320, 90, message, { 
            fontSize: '16px', 
            fill: Phaser.Display.Color.IntegerToColor(color).rgba, 
            fontFamily: '"HoMM Pixel"' 
        }).setOrigin(0.5);
        
        this.tweens.add({
            targets: feedBackText,
            alpha: 0,
            y: 70,
            duration: 1500,
            onComplete: () => feedBackText.destroy()
        });
    }
}

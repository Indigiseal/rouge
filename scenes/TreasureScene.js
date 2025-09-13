import { SoundHelper } from '../utils/SoundHelper.js';

export class TreasureScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TreasureScene' });
  }

  create(data) {
    this.gameState = data.gameState;
    this.add.rectangle(320, 180, 640, 360, 0x1a1a2e);
    
    this.add.text(320, 50, 'TREASURE CHEST', { fontSize: '24px', fill: '#ffd700' }).setOrigin(0.5);
    
    // Instructions
    this.add.text(320, 100, 'Drag key here to open fully, or click to break (risky).', { fontSize: '16px', fill: '#ffffff' }).setOrigin(0.5);
    
    // Chest sprite (drop target)
    const chest = this.add.sprite(320, 180, 'chest').setScale(2).setInteractive({ useHandCursor: true });
    // Make hit area larger (full sprite + padding)
    const paddedWidth = chest.width * chest.scaleX + 20; // +20 padding
    const paddedHeight = chest.height * chest.scaleY + 20;
    chest.input.hitArea.setTo(-paddedWidth / 2, -paddedHeight / 2, paddedWidth, paddedHeight);
    console.log('Chest hit area set:', chest.input.hitArea); // Test log
    // Hover feedback (tint yellow)
    chest.on('pointerover', () => {
      chest.setTint(0xffff00); // Yellow tint on hover
    });
    chest.on('pointerout', () => {
      chest.clearTint(); // Remove tint
    });
    // Click to break (log on down)
    chest.on('pointerdown', () => {
      console.log('Chest clicked!'); // Test if detects click
      this.breakChest(chest);
    });
    
    // Enable drag/drop for keys in inventory
    this.gameState.inventory.forEach((item, index) => {
      if (item && item.type === 'key') {
        // Assume inventory cards are draggable; if not, add in inventorySystem.js: cardSprite.setInteractive(); this.scene.input.setDraggable(cardSprite);
        const cardSprite = this.scene.manager.getScene('GameScene').inventorySystem.slotSprites[index].card; // Safe access
        if (cardSprite) {
          this.input.setDraggable(cardSprite);
          cardSprite.on('dragend', (pointer) => {
            if (Phaser.Geom.Rectangle.Contains(chest.getBounds(), pointer.x, pointer.y)) {
              this.openWithKey(index, chest);
            }
          });
        }
      }
    });
    
    // Leave button
    this.add.text(320, 320, 'Leave', { fontSize: '18px', fill: '#ff0000', fontFamily: '"Roboto Condensed"' })
      .setInteractive({ useHandCursor: true })
      .setOrigin(0.5)
      .on('pointerdown', () => {
        this.scene.stop();
        this.scene.wake('MapViewScene');
      });
  }
  
  openWithKey(keyIndex, chest) {
    // Consume key
    this.gameState.inventory[keyIndex] = null;
    
    // Full loot
    this.gameState.coins += 50;
    const gen = new CardDataGenerator();
    const rareItem = gen.createCardData('weapon', this.gameState.currentFloor);
    rareItem.rarity = 'rare';
    const emptySlot = this.gameState.inventory.findIndex(slot => slot === null);
    if (emptySlot === -1) {
      this.add.text(320, 250, 'Inventory full—coins only!', { fontSize: '14px', fill: '#ff0000' }).setOrigin(0.5);
    } else {
      this.gameState.inventory[emptySlot] = rareItem;
    }
    this.add.text(320, 250, '+50 Coins + Rare Item!', { fontSize: '14px', fill: '#00ff00' }).setOrigin(0.5);
    
    SoundHelper.playSound(this, 'chest_open', 0.5);
    chest.destroy(); // Optional: Remove chest after open
  }
  
  breakChest(chest) {
    // Spawn trap visually
    const trapX = chest.x + Math.random() * 50 - 25; // Random offset near chest
    const trapY = chest.y + Math.random() * 50 - 25;
    const trapSprite = this.add.sprite(trapX, trapY, 'trap').setScale(1.5); // Assume 'trap' sprite preloaded
    trapSprite.setAlpha(0); // Start invisible
    
    // Animate spawn (fade in + scale up)
    this.tweens.add({
      targets: trapSprite,
      alpha: 1,
      scale: 2,
      duration: 500,
      ease: 'Power2',
      onComplete: () => {
        SoundHelper.playSound(this, 'trap_spring1', 0.5);
        // Apply damage after anim
        this.gameState.takeDamage(5, -1, 'trap');
        this.add.text(320, 220, 'Trap Spawned! -5 HP', { fontSize: '14px', fill: '#ff0000' }).setOrigin(0.5);
        
        // Half loot
        this.gameState.coins += 25;
        this.add.text(320, 250, '+25 Coins (Half)', { fontSize: '14px', fill: '#ffff00' }).setOrigin(0.5);
        
        // Destroy trap after delay
        this.time.delayedCall(1000, () => trapSprite.destroy());
      }
    });
    
    chest.destroy(); // Remove chest after break
  }
}
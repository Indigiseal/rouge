import { CardSystem } from '../cardSystem.js';
import { SoundHelper } from '../utils/SoundHelper.js';

const WEAPON_TRAP_CHANCE = 0.35;
const LOOT_DESTROY_CHANCE = 0.25;
const LOOT_PENALTY_MULTS = [0.75, 0.5];
const TRAP_DAMAGE = 5;
const WEAPON_DURABILITY_LOSS = 1;

export class TreasureScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TreasureScene' });
    this.dropHandler = null;
    this.chestResolved = false;
    this._fallbackCardSystem = null;
  }

  create(data = {}) {
    this.gameScene = this.scene.get('GameScene');
    this.gameState = data.gameState || this.gameScene?.gameState;
    this.inventorySystem = this.gameScene?.inventorySystem;
    this.cardSystem = this.gameScene?.cardSystem || null;
    this.chestResolved = false;

    this.add.rectangle(320, 180, 640, 360, 0x1a1a2e).setAlpha(0.95);
    this.add.text(320, 40, 'Treasure Room', {
      fontSize: '26px',
      fontFamily: '"Roboto Condensed"',
      color: '#ffd700'
    }).setOrigin(0.5);
    this.add.text(320, 85, 'Drag a Key for a safe unlock. Drag a Weapon to smash it (risky).', {
      fontSize: '16px',
      fontFamily: '"Roboto Condensed"',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: 520 }
    }).setOrigin(0.5);

    if (this.inventorySystem) {
      this.inventorySystem.setVisibility(true);
      if (typeof this.inventorySystem.rebuildInventorySprites === 'function') {
        this.inventorySystem.rebuildInventorySprites();
      }
    }

    this.chestSprite = this.add.sprite(320, 190, 'chest').setScale(2);
    const dzW = this.chestSprite.displayWidth + 20;
    const dzH = this.chestSprite.displayHeight + 20;
    this.chestZone = this.add.zone(this.chestSprite.x, this.chestSprite.y, dzW, dzH)
      .setRectangleDropZone(dzW, dzH)
      .setName('CHEST_ZONE');

    this.chestSprite.setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        if (!this.chestResolved) {
          this.chestSprite.setTint(0xffffaa);
        }
      })
      .on('pointerout', () => this.chestSprite.clearTint())
      .on('pointerdown', () => {
        if (this.chestResolved) return;
        this.showToast('Drag a Key (safe) or a Weapon (risky) onto the chest');
      });

    this.dropHandler = this.handleDrop.bind(this);
    this.input.on('drop', this.dropHandler);

    this.add.text(320, 350, 'Leave', {
      fontSize: '18px',
      fontFamily: '"Roboto Condensed"',
      color: '#ff7777'
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.leaveRoom());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.onShutdown, this);
  }

  onShutdown() {
    if (this.dropHandler) {
      this.input?.off('drop', this.dropHandler);
      this.dropHandler = null;
    }
    if (this.inventorySystem) {
      this.inventorySystem.setVisibility(false);
    }
  }

  handleDrop(pointer, gameObject, dropZone) {
    if (!dropZone || dropZone.name !== 'CHEST_ZONE') return;
    const inv = this.inventorySystem;
    if (!inv) return;

    const slotIndexRaw = gameObject?.getData?.('slotIndex');
    const slotIndex = Number(slotIndexRaw);
    if (!Number.isInteger(slotIndex)) return;

    const cardData = inv.slots?.[slotIndex];
    if (!cardData) {
      if (typeof inv.returnCardToSlot === 'function') {
        inv.returnCardToSlot(slotIndex, gameObject);
      }
      return;
    }

    if (this.chestResolved) {
      if (typeof inv.returnCardToSlot === 'function') {
        inv.returnCardToSlot(slotIndex, gameObject);
      }
      return;
    }

    if (cardData.type === 'key') {
      this.openChestWithKey(slotIndex);
    } else if (cardData.type === 'weapon') {
      this.breakChestWithWeapon(slotIndex, cardData, gameObject);
    } else {
      if (typeof inv.returnCardToSlot === 'function') {
        inv.returnCardToSlot(slotIndex, gameObject);
      }
      this.showToast('Only keys or weapons can open this chest');
    }
  }

  openChestWithKey(slotIndex) {
    const inv = this.inventorySystem;
    if (!inv || this.chestResolved) return;

    if (typeof inv.removeCard === 'function') {
      inv.removeCard(slotIndex);
    } else {
      inv.slots[slotIndex] = null;
      inv.rebuildInventorySprites?.();
    }

    const reward = this.grantTreasure({ safe: true });
    this.finishChest();

    const lootText = reward.itemGiven ? ' +loot' : '';
    this.showToast(`Unlocked! +${reward.coins} coins${lootText}`);
    SoundHelper?.playSound?.(this, 'chest_open', 0.7);
  }

  breakChestWithWeapon(slotIndex, weaponData, gameObject) {
    const inv = this.inventorySystem;
    const gs = this.gameScene?.gameState || this.gameState;
    if (!inv || !gs || this.chestResolved) {
      if (inv && typeof inv.returnCardToSlot === 'function') {
        inv.returnCardToSlot(slotIndex, gameObject);
      }
      return;
    }

    const trap = Math.random() < WEAPON_TRAP_CHANCE;
    if (trap) {
      gs.takeDamage?.(TRAP_DAMAGE, -1, 'trap');
      this.showToast(`Trap sprung! -${TRAP_DAMAGE} HP`);
      SoundHelper?.playSound?.(this, 'trap_spring', 0.6);
    }

    let destroyed = Math.random() < LOOT_DESTROY_CHANCE;
    let mult = 1.0;
    if (!destroyed) {
      mult = LOOT_PENALTY_MULTS[Math.floor(Math.random() * LOOT_PENALTY_MULTS.length)];
    }

    let weaponDestroyed = false;
    if (typeof weaponData?.durability === 'number') {
      weaponData.durability -= WEAPON_DURABILITY_LOSS;
      if (weaponData.durability <= 0) {
        weaponDestroyed = true;
        if (typeof inv.removeCard === 'function') {
          inv.removeCard(slotIndex);
        } else {
          inv.slots[slotIndex] = null;
        }
        this.showToast('Your weapon broke!');
      }
    }

    const reward = this.grantTreasure({ safe: false, destroyed, mult });
    this.finishChest();

    this.showToast(`+${reward.coins} coins`);
    if (destroyed) {
      this.showToast('Loot destroyed! (coins only or nothing)');
    } else if (mult < 1) {
      this.showToast(`Loot reduced (${Math.round(mult * 100)}%)`);
    } else {
      this.showToast('You smashed it! Full loot');
    }

    if (!weaponDestroyed && typeof inv.returnCardToSlot === 'function') {
      inv.returnCardToSlot(slotIndex, gameObject);
    } else if (weaponDestroyed && gameObject?.destroy) {
      gameObject.destroy();
    }

    if (typeof inv.rebuildInventorySprites === 'function') {
      inv.rebuildInventorySprites();
    }
  }

  grantTreasure({ safe, destroyed = false, mult = 1.0 } = {}) {
    const gs = this.gameScene?.gameState || this.gameState;
    const inv = this.inventorySystem;
    if (!gs) return { coins: 0, itemGiven: false };

    const currentFloor = Math.max(1, gs.currentFloor || 1);
    const baseCoins = 30 + (currentFloor - 1) * 5;
    let coins = Math.max(0, Math.floor(baseCoins * (destroyed ? 0.5 : mult)));
    gs.coins = (gs.coins || 0) + coins;

    let itemGiven = false;
    if (!destroyed && inv) {
      let generator = this.cardSystem;
      if (!generator && this.gameScene) {
        this._fallbackCardSystem = this._fallbackCardSystem || new CardSystem(this.gameScene);
        generator = this._fallbackCardSystem;
      }

      const fallbackTypes = ['weapon', 'armor', 'potion', 'food', 'magic', 'amulet'];
      let card = generator?.createCardData?.('treasure', currentFloor);
      if (!card) {
        const type = fallbackTypes[Math.floor(Math.random() * fallbackTypes.length)];
        card = generator?.createCardData?.(type, currentFloor);
      }

      if (card && mult < 1) {
        if (card.rarity === 'legendary') card.rarity = 'rare';
        else if (card.rarity === 'rare') card.rarity = 'common';
        else if (card.rarity === 'uncommon') card.rarity = 'common';
      }

      if (card && typeof inv.addCard === 'function') {
        itemGiven = inv.addCard(card);
        if (!itemGiven && inv.scene?.createFloatingText) {
          inv.scene.createFloatingText(320, 260, 'Inventory full!', 0xff5555);
        }
      }
    }

    if (coins > 0) {
      SoundHelper?.playSound?.(this, 'coin_collect', 0.6);
    }

    return { coins, itemGiven, destroyed, mult, safe };
  }

  finishChest() {
    if (this.chestResolved) return;
    this.chestResolved = true;
    if (this.chestZone) {
      this.chestZone.input.dropZone = false;
      this.chestZone.setActive(false);
    }
    if (this.chestSprite) {
      this.chestSprite.disableInteractive();
      this.chestSprite.clearTint();
      this.chestSprite.setAlpha(0.9);
    }
  }

  showToast(message) {
    const toast = this.add.text(320, 320, message, {
      fontSize: '14px',
      fontFamily: '"Roboto Condensed"',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.tweens.add({
      targets: toast,
      alpha: 0,
      y: toast.y - 20,
      duration: 1400,
      delay: 600,
      onComplete: () => toast.destroy()
    });
  }

  leaveRoom() {
    this.scene.stop();
    this.scene.wake('MapViewScene');
  }
}
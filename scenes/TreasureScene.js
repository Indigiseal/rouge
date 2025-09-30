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
    this.dragStartHandler = null;
    this.dragHandler = null;
    this.dragEndHandler = null;

    this.chestResolved = false;
    this.finishing = false;

    this._fallbackCardSystem = null;
  }

  create(data = {}) {
    this.gameScene = this.scene.get('GameScene');
    this.gs = data.gameState || this.gameScene?.gameState || null;
    this.inv = this.gameScene?.inventorySystem || null;
    this.cardSystem = this.gameScene?.cardSystem || null;

    this.chestResolved = false;
    this.finishing = false;

    this.pendingRewards = [];
    this.treasureSlots = (this.inv?.slots || []).map(slot => (slot ? { ...slot } : null));
    this.miniSlotSprites = [];
    this.miniCardSprites = [];

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

    this.createChest();
    this.buildMiniInventory();
    this.setupInputHandlers();

    this.add.text(320, 355, 'Leave', {
      fontSize: '16px',
      fontFamily: '"Roboto Condensed"',
      color: '#ff7777'
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.finishTreasure());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.onShutdown, this);
  }

  createChest() {
    this.chestSprite = this.add.sprite(320, 190, 'chest').setScale(2);
    const dzW = this.chestSprite.displayWidth + 20;
    const dzH = this.chestSprite.displayHeight + 20;
    this.chestZone = this.add
      .zone(this.chestSprite.x, this.chestSprite.y, dzW, dzH)
      .setRectangleDropZone(dzW, dzH)
      .setName('CHEST_ZONE');

    this.chestSprite
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        if (!this.chestResolved) {
          this.chestSprite.setTint(0xffffaa);
        }
      })
      .on('pointerout', () => this.chestSprite.clearTint())
      .on('pointerdown', () => {
        if (this.chestResolved) return;
        this.showToast('Drag a Key (safe) or a Weapon (risky) onto the chest.');
      });
  }

  buildMiniInventory() {
    if (!this.treasureSlots.length) return;

    const slotCount = this.treasureSlots.length;
    const slotWidth = 60;
    const slotHeight = 82;
    const spacing = 8;
    const totalWidth = slotCount * slotWidth + (slotCount - 1) * spacing;
    const startX = 320 - totalWidth / 2 + slotWidth / 2;
    const y = 340;

    for (let i = 0; i < slotCount; i++) {
      const x = startX + i * (slotWidth + spacing);
      const background = this.add.rectangle(x, y, slotWidth, slotHeight, 0x262637, 0.9);
      background.setStrokeStyle(2, i >= 5 ? 0xffd700 : 0x4c4c6a, 0.9);

      this.miniSlotSprites[i] = {
        x,
        y,
        width: slotWidth,
        height: slotHeight,
        background,
        card: null
      };

      if (this.treasureSlots[i]) {
        this.createMiniCardSprite(i);
      }
    }
  }

  setupInputHandlers() {
    this.input.setTopOnly(true);

    this.dropHandler = this.handleDrop.bind(this);
    this.dragStartHandler = (pointer, gameObject) => {
      if (!gameObject) return;
      gameObject.setDepth(1000);
    };
    this.dragHandler = (pointer, gameObject, dragX, dragY) => {
      if (!gameObject) return;
      gameObject.x = dragX;
      gameObject.y = dragY;
    };
    this.dragEndHandler = (pointer, gameObject) => {
      if (!gameObject || gameObject.getData?.('removed')) return;
      const slotIndex = gameObject.getData?.('slotIndex');
      if (!Number.isInteger(slotIndex)) return;
      this.snapMiniCardBack(gameObject, slotIndex);
    };

    this.input.on('drop', this.dropHandler);
    this.input.on('dragstart', this.dragStartHandler);
    this.input.on('drag', this.dragHandler);
    this.input.on('dragend', this.dragEndHandler);
  }

  createMiniCardSprite(slotIndex) {
    const slot = this.miniSlotSprites[slotIndex];
    const cardData = this.treasureSlots[slotIndex];
    if (!slot || !cardData) return;

    const container = this.add.container(slot.x, slot.y);
    const cardWidth = slot.width - 10;
    const cardHeight = slot.height - 10;
    const color = this.getMiniCardColor(cardData.type);
    const rect = this.add.rectangle(0, 0, cardWidth, cardHeight, color, 0.95);
    rect.setStrokeStyle(2, 0xffffff, 0.8);

    const label = this.add.text(0, 0, this.getMiniCardLabel(cardData), {
      fontSize: '12px',
      fontFamily: '"Roboto Condensed"',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: cardWidth - 8 }
    }).setOrigin(0.5);

    container.add([rect, label]);
    container.setSize(slot.width, slot.height);
    container.setDataEnabled();
    container.setData('slotIndex', slotIndex);
    container.setData('homeX', slot.x);
    container.setData('homeY', slot.y);
    container.label = label;
    container.background = rect;

    container.setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(container, true);

    this.miniCardSprites[slotIndex] = container;
    slot.card = container;
  }

  getMiniCardColor(type) {
    switch (type) {
      case 'weapon':
        return 0x8b3a3a;
      case 'key':
        return 0x8c7b32;
      case 'armor':
        return 0x35526b;
      case 'potion':
        return 0x3a6b4f;
      case 'food':
        return 0x6b4f3a;
      case 'magic':
        return 0x5b3a8b;
      case 'amulet':
        return 0x8b5b3a;
      default:
        return 0x44465a;
    }
  }

  getMiniCardLabel(cardData) {
    if (!cardData) return '';
    const base = cardData.shortName || cardData.name || cardData.type || 'Item';
    if (typeof cardData.durability === 'number') {
      return `${base}\nDurability: ${Math.max(0, cardData.durability)}`;
    }
    return base;
  }

  handleDrop(pointer, gameObject, dropZone) {
    if (!dropZone || dropZone.name !== 'CHEST_ZONE') return;
    const slotIndex = gameObject?.getData?.('slotIndex');
    if (!Number.isInteger(slotIndex)) {
      return;
    }

    if (this.chestResolved) {
      this.showToast('The chest has already been opened.');
      this.snapMiniCardBack(gameObject, slotIndex);
      return;
    }

    const cardData = this.treasureSlots[slotIndex];
    if (!cardData) {
      this.snapMiniCardBack(gameObject, slotIndex);
      return;
    }

    if (cardData.type === 'key') {
      this.openWithKey(slotIndex, gameObject);
    } else if (cardData.type === 'weapon') {
      this.breakWithWeapon(slotIndex, cardData, gameObject);
    } else {
      this.showToast('Only a Key (safe) or Weapon (risky) can be used on the chest.');
      this.snapMiniCardBack(gameObject, slotIndex);
    }
  }

  openWithKey(slotIndex, gameObject) {
    if (this.chestResolved) return;

    this.treasureSlots[slotIndex] = null;
    this.removeMiniCardSprite(slotIndex, gameObject);

    const reward = this.grantTreasure({ safe: true });
    this.finishChest();

    const lootNote = reward.card ? ' +loot' : '';
    this.showToast(`Unlocked! +${reward.coins} coins${lootNote}`);
    SoundHelper?.playSound?.(this, 'chest_open', 0.7);
  }

  breakWithWeapon(slotIndex, weaponCard, gameObject) {
    if (this.chestResolved) {
      this.snapMiniCardBack(gameObject, slotIndex);
      return;
    }

    const trap = Math.random() < WEAPON_TRAP_CHANCE;
    if (trap) {
      this.gs?.takeDamage?.(TRAP_DAMAGE, -1, 'trap');
      this.showToast(`Trap sprung! -${TRAP_DAMAGE} HP`);
      SoundHelper?.playSound?.(this, 'trap_spring', 0.6);
    }

    let destroyed = Math.random() < LOOT_DESTROY_CHANCE;
    let mult = 1;
    if (!destroyed) {
      mult = LOOT_PENALTY_MULTS[Math.floor(Math.random() * LOOT_PENALTY_MULTS.length)];
    }

    if (typeof weaponCard.durability === 'number') {
      weaponCard.durability -= WEAPON_DURABILITY_LOSS;
      if (weaponCard.durability <= 0) {
        this.treasureSlots[slotIndex] = null;
        this.removeMiniCardSprite(slotIndex, gameObject);
        this.showToast('Your weapon broke!');
      } else {
        this.updateMiniCardSprite(slotIndex);
      }
    }

    const reward = this.grantTreasure({ safe: false, destroyed, mult });
    this.finishChest();

    this.showToast(`+${reward.coins} coins`);
    if (destroyed) {
      this.showToast('Loot destroyed!');
    } else if (mult < 1) {
      this.showToast(`Loot reduced to ${Math.round(mult * 100)}%`);
    } else {
      this.showToast('You smashed it! Full loot.');
    }

    if (this.treasureSlots[slotIndex] && gameObject) {
      this.snapMiniCardBack(gameObject, slotIndex);
    }
  }

  grantTreasure({ safe, destroyed = false, mult = 1.0 } = {}) {
    const gs = this.gs;
    const currentFloor = Math.max(1, gs?.currentFloor || 1);
    const baseCoins = 30 + (currentFloor - 1) * 5;
    const coins = Math.max(0, Math.floor(baseCoins * (destroyed ? 0.5 : mult)));

    if (gs) {
      gs.coins = (gs.coins || 0) + coins;
    }

    let card = null;
    if (!destroyed) {
      let generator = this.cardSystem;
      if (!generator && this.gameScene) {
        this._fallbackCardSystem = this._fallbackCardSystem || new CardSystem(this.gameScene);
        generator = this._fallbackCardSystem;
      }

      const fallbackTypes = ['weapon', 'armor', 'potion', 'food', 'magic', 'amulet'];
      card = generator?.createCardData?.('treasure', currentFloor);
      if (!card) {
        const type = fallbackTypes[Math.floor(Math.random() * fallbackTypes.length)];
        card = generator?.createCardData?.(type, currentFloor);
      }

      if (card && mult < 1) {
        if (card.rarity === 'legendary') card.rarity = 'rare';
        else if (card.rarity === 'rare') card.rarity = 'common';
        else if (card.rarity === 'uncommon') card.rarity = 'common';
      }

      if (card) {
        this.pendingRewards.push(card);
      }
    }

    if (coins > 0) {
      SoundHelper?.playSound?.(this, 'coin_collect', 0.6);
    }

    return { coins, card, destroyed, mult, safe };
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

  snapMiniCardBack(gameObject, slotIndex) {
    const slot = this.miniSlotSprites[slotIndex];
    if (!slot || !gameObject || gameObject.getData?.('removed')) return;

    this.tweens.add({
      targets: gameObject,
      x: slot.x,
      y: slot.y,
      duration: 200,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        gameObject.setData?.('homeX', slot.x);
        gameObject.setData?.('homeY', slot.y);
        gameObject.setDepth(1);
      }
    });
  }

  removeMiniCardSprite(slotIndex, gameObject) {
    const card = gameObject || this.miniCardSprites[slotIndex];
    if (card) {
      card.setData?.('removed', true);
      if (Array.isArray(card.list)) {
        card.list.forEach(child => child?.destroy?.());
      }
      card.destroy();
    }
    this.miniCardSprites[slotIndex] = null;
    if (this.miniSlotSprites[slotIndex]) {
      this.miniSlotSprites[slotIndex].card = null;
    }
  }

  updateMiniCardSprite(slotIndex) {
    const card = this.miniCardSprites[slotIndex];
    const data = this.treasureSlots[slotIndex];
    if (!card || !data) return;

    if (card.label) {
      card.label.setText(this.getMiniCardLabel(data));
    }
  }

  finishTreasure() {
    if (this.finishing) return;
    this.finishing = true;

    const inv = this.inv;
    let exitDelay = 0;

    if (inv) {
      const slotCount = Math.min(inv.slots?.length || 0, this.treasureSlots.length);
      if (typeof inv.setSlot === 'function') {
        for (let i = 0; i < slotCount; i++) {
          inv.setSlot(i, this.treasureSlots[i], false);
        }
        inv.rebuildInventorySprites?.();
      } else {
        for (let i = 0; i < slotCount; i++) {
          inv.slots[i] = this.treasureSlots[i];
        }
        inv.rebuildInventorySprites?.();
      }

      const leftovers = [];
      if (this.pendingRewards.length && typeof inv.addCard === 'function') {
        this.pendingRewards.forEach(card => {
          const added = inv.addCard(card);
          if (!added) {
            leftovers.push(card);
          }
        });
      }

      this.pendingRewards = [];

      if (leftovers.length) {
        exitDelay = 1200;
        this.showToast('Inventory full! Extra loot lost.');
      }
    }

    this.gameScene?.updateUI?.();

    this.time.delayedCall(300 + exitDelay, () => {
      this.scene.stop();
      this.scene.wake('MapViewScene');
    });
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

  onShutdown() {
    if (this.dropHandler) {
      this.input?.off('drop', this.dropHandler);
      this.dropHandler = null;
    }
    if (this.dragStartHandler) {
      this.input?.off('dragstart', this.dragStartHandler);
      this.dragStartHandler = null;
    }
    if (this.dragHandler) {
      this.input?.off('drag', this.dragHandler);
      this.dragHandler = null;
    }
    if (this.dragEndHandler) {
      this.input?.off('dragend', this.dragEndHandler);
      this.dragEndHandler = null;
    }

    this.miniCardSprites.forEach(card => {
      if (!card) return;
      if (Array.isArray(card.list)) {
        card.list.forEach(child => child?.destroy?.());
      }
      card.destroy();
    });
    this.miniSlotSprites.forEach(slot => {
      slot?.background?.destroy();
    });
    this.miniCardSprites = [];
    this.miniSlotSprites = [];
  }
}

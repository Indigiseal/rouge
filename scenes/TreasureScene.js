import { SoundHelper } from '../utils/SoundHelper.js';
import { CardDataGenerator } from '../CardDataGenerator.js';

export class TreasureScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TreasureScene' });
  }

  create(data) {
    this.gameState = data.gameState;
    this.rewardMode = data.rewardMode || 'treasure';
    this.requiresKey = this.rewardMode === 'treasure';
    this.gameScene = this.scene.get('GameScene');
    this.opened = false;

    this.add.rectangle(320, 180, 640, 360, 0x1a1a2e);

    const title = this.rewardMode === 'boss' ? 'BOSS CHEST' :
      this.rewardMode === 'elite' ? 'ELITE CHEST' : 'TREASURE CHEST';
    this.add.text(320, 50, title, {
      fontSize: '24px',
      fill: '#ffd700',
      fontFamily: '"HoMM Pixel"'
    }).setOrigin(0.5);

    const instruction = this.requiresKey ?
      'Use a key to open safely, or click the chest to force it open.' :
      'Open your reward chest.';
    this.add.text(320, 100, instruction, {
      fontSize: '16px',
      fill: '#ffffff',
      fontFamily: '"HoMM Pixel"'
    }).setOrigin(0.5);

    const chestTexture = this.textures.exists('bigChestAnimation') ? 'bigChestAnimation' : 'chest';
    const chest = this.add.sprite(320, 180, chestTexture, 0).setInteractive({ useHandCursor: true });
    const paddedWidth = chest.width + 20;
    const paddedHeight = chest.height + 20;
    chest.input.hitArea.setTo(-paddedWidth / 2, -paddedHeight / 2, paddedWidth, paddedHeight);
    chest.on('pointerover', () => chest.setTint(0xffff00));
    chest.on('pointerout', () => chest.clearTint());
    chest.on('pointerdown', () => {
      if (this.requiresKey) {
        this.forceOpenTreasureChest(chest);
      } else {
        this.openRewardChest(chest);
      }
    });

    const keyIndex = this.findKeyIndex();
    const keyButton = this.add.rectangle(320, 255, 140, 28, !this.requiresKey || keyIndex !== -1 ? 0x5f4420 : 0x333333)
      .setStrokeStyle(2, !this.requiresKey || keyIndex !== -1 ? 0xffd700 : 0x777777);
    const keyButtonText = this.add.text(320, 255, !this.requiresKey ? 'Open' : keyIndex === -1 ? 'No Key' : 'Use Key', {
      fontSize: '14px',
      fill: !this.requiresKey || keyIndex !== -1 ? '#ffd700' : '#888888',
      fontFamily: '"HoMM Pixel"'
    }).setOrigin(0.5);

    if (!this.requiresKey) {
      keyButton.setInteractive({ useHandCursor: true });
      keyButton.on('pointerdown', () => {
        keyButton.disableInteractive();
        keyButtonText.setText('Opened');
        this.openRewardChest(chest);
      });
    } else if (keyIndex !== -1) {
      keyButton.setInteractive({ useHandCursor: true });
      keyButton.on('pointerdown', () => {
        keyButton.disableInteractive();
        keyButtonText.setText('Opened');
        this.openWithKey(keyIndex, chest);
      });
    }

    this.add.text(320, 320, 'Leave', {
      fontSize: '18px',
      fill: '#ff0000',
      fontFamily: '"HoMM Pixel"'
    })
      .setInteractive({ useHandCursor: true })
      .setOrigin(0.5)
      .on('pointerdown', () => this.returnToMap());
  }

  findKeyIndex() {
    return this.gameState.inventory.findIndex(item => item && item.type === 'key');
  }

  openWithKey(keyIndex, chest) {
    if (this.opened || !chest.active) return;
    this.opened = true;
    this.setInventorySlot(keyIndex, null);
    this.playChestOpen(chest, () => this.grantChestRewards(chest, true, false));
  }

  openRewardChest(chest) {
    if (this.opened || !chest.active) return;
    this.opened = true;
    this.playChestOpen(chest, () => this.grantChestRewards(chest, true, false));
  }

  playChestOpen(chest, onComplete) {
    chest.disableInteractive();
    chest.clearTint();
    SoundHelper.playSound(this, 'chest_open', 0.5);

    if (chest.texture?.key === 'bigChestAnimation' && this.anims.exists('big_chest_open')) {
      chest.once('animationcomplete-big_chest_open', onComplete);
      chest.play('big_chest_open');
    } else {
      this.time.delayedCall(200, onComplete);
    }
  }

  grantChestRewards(chest, fullReward, trapped) {
    const reward = this.getRewardValues(true);
    this.gameState.coins += reward.coins;
    this.gameState.crystals += reward.crystals;

    const item = this.createRewardItem(reward.rarity);
    this.playLootScatter(chest.x, chest.y, reward.coins, reward.crystals);
    this.showRewardCard(item);
    const emptySlot = this.gameState.inventory.findIndex(slot => slot === null);
    if (emptySlot === -1) {
      this.add.text(320, 285, 'Inventory full - currency only!', {
        fontSize: '14px',
        fill: '#ff0000',
        fontFamily: '"HoMM Pixel"'
      }).setOrigin(0.5);
    } else {
      this.setInventorySlot(emptySlot, item);
    }

    const trapText = trapped ? ' Trap!' : '';
    this.add.text(320, 285, `+${reward.coins} Coins +${reward.crystals} Crystals + ${reward.rarity} Item!${trapText}`, {
      fontSize: '14px',
      fill: trapped ? '#ffff00' : '#00ff00',
      fontFamily: '"HoMM Pixel"'
    }).setOrigin(0.5);

    this.gameScene?.updateUI?.();
    chest.destroy();
  }

  getRewardValues(openedWithKey) {
    const values = {
      treasure: { coins: 25, crystals: 2, rarity: 'uncommon' },
      elite: { coins: 35, crystals: 3, rarity: 'rare' },
      boss: { coins: 70, crystals: 6, rarity: 'rare' }
    };
    const reward = values[this.rewardMode] || values.treasure;
    if (openedWithKey) return reward;

    return {
      coins: Math.floor(reward.coins * 0.75),
      crystals: Math.max(1, Math.floor(reward.crystals * 0.5)),
      rarity: 'common'
    };
  }

  createRewardItem(rarity) {
    const gen = new CardDataGenerator();
    const roll = Math.random();
    const type = roll < 0.45 ? 'weapon' : roll < 0.85 ? 'armor' : 'magic';
    const item = gen.createCardData(type, this.gameState.currentFloor);
    item.rarity = rarity;
    return item;
  }

  showRewardCard(item) {
    if (this.rewardCardContainer) {
      this.rewardCardContainer.destroy(true);
    }

    const x = 500;
    const y = 190;
    const bg = this.add.rectangle(0, 0, 112, 132, 0x24180f, 0.95)
      .setStrokeStyle(2, this.getRarityColor(item.rarity));
    const sprite = this.add.image(0, -26, item.sprite || 'cardBack', item.spriteFrame ?? undefined)
      .setScale(1);
    const name = this.add.text(0, 36, item.name || 'Reward', {
      fontSize: '10px',
      fill: '#ffffff',
      fontFamily: '"HoMM Pixel"',
      wordWrap: { width: 96 },
      align: 'center'
    }).setOrigin(0.5);
    const stats = this.add.text(0, 58, this.getRewardStats(item), {
      fontSize: '9px',
      fill: '#f2d3aa',
      fontFamily: '"HoMM Pixel"',
      align: 'center'
    }).setOrigin(0.5);

    this.rewardCardContainer = this.add.container(x, y, [bg, sprite, name, stats]);
    this.rewardCardContainer.setScale(0.7).setAlpha(0);
    this.tweens.add({
      targets: this.rewardCardContainer,
      scale: 1,
      alpha: 1,
      y: y - 8,
      duration: 250,
      ease: 'Back.Out'
    });
  }

  getRewardStats(item) {
    if (item.type === 'weapon') return `${item.rarity}  ${item.damage || 0} DMG`;
    if (item.type === 'armor') return `${item.rarity}  ${item.protection || 0} DEF`;
    if (item.type === 'magic') return `${item.rarity} Magic`;
    if (item.type === 'thorns') return `${item.rarity} ${item.thornDamage || 0} Thorns`;
    return item.rarity || '';
  }

  getRarityColor(rarity) {
    const colors = {
      common: 0xb8b8b8,
      uncommon: 0x66dd66,
      rare: 0x66aaff,
      legendary: 0xffcc33
    };
    return colors[rarity] || 0xffffff;
  }

  playLootScatter(x, y, coins, crystals) {
    const splash = this.add.sprite(x, y, 'splash1');
    splash.setScale(1.2);
    if (this.anims.exists('splash_anim')) splash.play('splash_anim');
    splash.once('animationcomplete', () => splash.destroy());
    this.time.delayedCall(700, () => splash.active && splash.destroy());

    const coinCount = Math.min(6, Math.max(2, Math.ceil(coins / 15)));
    const crystalCount = Math.min(4, Math.max(1, crystals));
    for (let i = 0; i < coinCount; i++) {
      this.scatterLootSprite(x, y, 'coinUI', 0xffd36b);
    }
    for (let i = 0; i < crystalCount; i++) {
      this.scatterLootSprite(x, y, 'CrystalUI', 0x66ffff);
    }
  }

  scatterLootSprite(x, y, texture, tint) {
    const sprite = this.add.sprite(x, y, texture).setScale(1);
    sprite.setTint(tint);
    const angle = Phaser.Math.FloatBetween(-Math.PI, 0);
    const distance = Phaser.Math.Between(35, 95);
    const targetX = x + Math.cos(angle) * distance;
    const targetY = y + Math.sin(angle) * distance;
    this.tweens.add({
      targets: sprite,
      x: targetX,
      y: targetY,
      alpha: 0,
      duration: 700,
      ease: 'Cubic.Out',
      onComplete: () => sprite.destroy()
    });
  }

  setInventorySlot(index, value) {
    this.gameState.inventory[index] = value;
    if (this.gameScene?.inventorySystem?.slots) {
      if (value === null) {
        this.gameScene.inventorySystem.removeCard(index);
      } else {
        this.gameScene.inventorySystem.addCardDirect(value, index);
        this.gameScene.inventorySystem.updateTwinkleEffects();
      }
    }
  }

  forceOpenTreasureChest(chest) {
    if (this.opened || !chest.active) return;
    this.opened = true;

    const trapTriggered = Math.random() < 0.45;
    if (!trapTriggered) {
      this.playChestOpen(chest, () => this.grantForcedChestRewards(chest, false));
      return;
    }

    this.playChestOpen(chest, () => {
      const trapX = chest.x + Math.random() * 50 - 25;
      const trapY = chest.y + Math.random() * 50 - 25;
      const trapSprite = this.add.sprite(trapX, trapY, 'trap');
      trapSprite.setAlpha(0);

      this.tweens.add({
        targets: trapSprite,
        alpha: 1,
        duration: 500,
        ease: 'Power2',
        onComplete: () => {
          SoundHelper.playSound(this, 'trap_spring1', 0.5);
          this.gameState.takeDamage(5, -1, 'trap');
          this.add.text(320, 220, 'Trap Spawned! -5 HP', {
            fontSize: '14px',
            fill: '#ff0000',
            fontFamily: '"HoMM Pixel"'
          }).setOrigin(0.5);

          this.grantForcedChestRewards(chest, true);

          this.time.delayedCall(1000, () => trapSprite.destroy());
        }
      });
    });
  }

  grantForcedChestRewards(chest, trapped) {
    const reward = this.getRewardValues(false);
    this.gameState.coins += reward.coins;
    this.gameState.crystals += reward.crystals;

    const item = this.createRewardItem(reward.rarity);
    this.playLootScatter(chest.x, chest.y, reward.coins, reward.crystals);
    this.showRewardCard(item);
    const emptySlot = this.gameState.inventory.findIndex(slot => slot === null);
    if (emptySlot !== -1) {
      this.setInventorySlot(emptySlot, item);
    }

    this.add.text(320, trapped ? 250 : 285, `+${reward.coins} Coins +${reward.crystals} Crystals + ${reward.rarity} Item${trapped ? ' (Trap)' : ''}`, {
      fontSize: '14px',
      fill: trapped ? '#ffff00' : '#00ff00',
      fontFamily: '"HoMM Pixel"'
    }).setOrigin(0.5);
    this.gameScene?.updateUI?.();
    if (!trapped) {
      chest.destroy();
    } else {
      chest.destroy();
    }
  }

  returnToMap() {
    this.scene.stop();
    this.scene.stop('MapViewScene');
    this.scene.launch('MapViewScene', { gameState: this.gameState });
  }
}

import { SoundHelper } from '../utils/SoundHelper.js';
import { CardDataGenerator } from '../CardDataGenerator.js';
import { createTitle } from '../utils/titleText.js';
import { StationRoomBase } from './StationRoomBase.js';

export class TreasureScene extends StationRoomBase {
  constructor() {
    super({ key: 'TreasureScene' });
  }

  create(data) {
    this.gameState = data.gameState;
    // Boss rewards now happen inside GameScene; this scene handles treasure
    // and elite chests only.
    this.rewardMode = data.rewardMode === 'boss' ? 'elite' : (data.rewardMode || 'treasure');
    this.gameScene = this.scene.get('GameScene');
    // Skeleton's Lockpicks bypass the key requirement on treasure chests
    const bypassKey = this.gameScene?.amuletManager?.canBypassChestKey?.();
    this.requiresKey = (this.rewardMode === 'treasure' || this.rewardMode === 'good') && !bypassKey;
    this.opened = false;
    this.lootTaken = false;

    // Show the player's real inventory on top (same station the shops use) so
    // they can discard / merge / use bread & potions to free a slot before
    // picking up the chest loot. Without this the reward was auto-dumped into
    // the first empty slot — or lost entirely when the bag was full.
    this.enableShopStation();

    this.createChestRoom();
  }

  // ─── STANDARD TREASURE / ELITE CHEST ─────────────────────────────────────

  createChestRoom() {
    // NOTE: no full-screen background here — that would cover the GameScene
    // inventory station underneath. The dungeon backdrop shows through instead.
    const title = this.rewardMode === 'elite' ? 'ELITE CHEST' : 'TREASURE CHEST';
    createTitle(this, 320, 20, title, {
      color: '#ffd700',
      fallbackSize: '24px'
    });

    const instruction = this.requiresKey ?
      'Use a key to open safely, or click the chest to force it open.' :
      'Open your reward chest.';
    this.instructionText = this.add.text(320, 46, instruction, {
      fontSize: '14px',
      fill: '#ffffff',
      fontFamily: '"HoMM Pixel"'
    }).setOrigin(0.5);

    const chestTexture = this.textures.exists('bigChestAnimation') ? 'bigChestAnimation' : 'cardBack';
    const chest = this.add.sprite(220, 130, chestTexture, 0).setInteractive({ useHandCursor: true });
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
    this.chest = chest;

    // Open / Use Key button under the chest, clear of the inventory bar (which
    // sits centred around y≈309).
    this.keyButton = this.add.rectangle(220, 205, 140, 28, 0x5f4420).setStrokeStyle(2, 0xffd700);
    this.keyButtonText = this.add.text(220, 205, '', {
      fontSize: '14px',
      fill: '#ffd700',
      fontFamily: '"HoMM Pixel"'
    }).setOrigin(0.5);
    this.refreshKeyButton();

    // Leave button, top-right — matches the shops' Next button.
    this.createStationContinueButton(595, 50, 'Leave', () => this.returnToMap());
  }

  // Re-evaluates the key button against the LIVE inventory each time it matters,
  // so discarding/merging in the station can't leave it pointing at a stale slot.
  refreshKeyButton() {
    if (!this.keyButton || this.opened) return;
    const keyIndex = this.findKeyIndex();
    const enabled = !this.requiresKey || keyIndex !== -1;

    this.keyButton.setFillStyle(enabled ? 0x5f4420 : 0x333333);
    this.keyButton.setStrokeStyle(2, enabled ? 0xffd700 : 0x777777);
    this.keyButtonText
      .setText(!this.requiresKey ? 'Open' : keyIndex === -1 ? 'No Key' : 'Use Key')
      .setColor(enabled ? '#ffd700' : '#888888');

    this.keyButton.removeInteractive();
    if (!enabled) return;

    this.keyButton.setInteractive({ useHandCursor: true });
    this.keyButton.removeAllListeners();
    this.keyButton.on('pointerdown', () => {
      if (this.opened) return;
      if (!this.requiresKey) {
        this.openRewardChest(this.chest);
      } else {
        // Re-find the key at click time in case the bag was rearranged.
        const liveKeyIndex = this.findKeyIndex();
        if (liveKeyIndex === -1) { this.refreshKeyButton(); return; }
        this.openWithKey(liveKeyIndex, this.chest);
      }
    });
  }

  // ─── STANDARD CHEST FLOW ─────────────────────────────────────────────────

  findKeyIndex() {
    return this.gameState.inventory.findIndex(item => item && item.type === 'key');
  }

  openWithKey(keyIndex, chest) {
    if (this.opened || !chest.active) return;
    this.opened = true;
    this.setKeyButtonOpened();
    this.setInventorySlot(keyIndex, null);
    this.playChestOpen(chest, () => this.grantChestRewards(chest, true, false));
  }

  openRewardChest(chest) {
    if (this.opened || !chest.active) return;
    this.opened = true;
    this.setKeyButtonOpened();
    this.playChestOpen(chest, () => this.grantChestRewards(chest, true, false));
  }

  setKeyButtonOpened() {
    this.keyButton?.removeInteractive();
    this.keyButton?.setFillStyle(0x333333).setStrokeStyle(2, 0x777777);
    this.keyButtonText?.setText('Opened').setColor('#888888');
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

    this.add.text(320, 235, `+${reward.coins} Coins +${reward.crystals} Crystals`, {
      fontSize: '14px',
      fill: '#00ff00',
      fontFamily: '"HoMM Pixel"'
    }).setOrigin(0.5);

    // Present the item as a takeable card instead of force-inserting it. The
    // player can free a slot in the station inventory first if the bag is full.
    this.presentLoot(item);

    this.gameScene?.updateUI?.();
    chest.destroy();
  }

  // Reward values bumped — they now scale with floor depth so deeper chests feel meaningful.
  // Rarity is also capped per act via capRewardRarity so chests don't hand out
  // epics/legendaries in act 1-2 (the player's run-end goal is 1-2 legendaries
  // in act 3; chests handing them out by floor 12 trivialized that).
  getRewardValues(openedWithKey) {
    const floor = this.gameState.currentFloor;
    const gen = new CardDataGenerator();
    const values = {
      treasure: {
        coins: 8 + Math.floor(floor / 3),
        crystals: 1 + Math.floor(floor / 14),
        rarity: gen.capRewardRarity('uncommon', floor)
      },
      good: {
        coins: 12 + Math.floor(floor / 2),
        crystals: 1 + Math.floor(floor / 12),
        // Threshold pushed from floor 20 → 38: epic chests are now late-act-3
        // only. Earlier "good" chests still pay out rare-tier loot via the
        // capRewardRarity ladder (uncommon in act 1, rare from act 2 onward).
        rarity: gen.capRewardRarity(floor >= 38 ? 'epic' : 'rare', floor)
      },
      elite: {
        coins: 15 + Math.floor(floor / 2),
        crystals: 2 + Math.floor(floor / 10),
        rarity: gen.capRewardRarity('rare', floor)
      }
    };
    const reward = values[this.rewardMode] || values.treasure;
    if (openedWithKey) return reward;

    // Forcing a chest without a key is a gamble: fewer coins/crystals and the
    // loot drops ONE rarity tier. Previously this hard-reset to 'common', which
    // made a force-opened elite chest on floor 44 spit out a worthless common
    // dagger — a full three tiers below its keyed 'rare'. One tier keeps the
    // "bring a key" incentive without gutting deep chests. (Trap risk is
    // handled separately in forceOpenTreasureChest.)
    return {
      coins: Math.floor(reward.coins * 0.75),
      crystals: Math.max(1, Math.floor(reward.crystals * 0.5)),
      rarity: this.downgradeRarity(reward.rarity)
    };
  }

  downgradeRarity(rarity) {
    const order = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const idx = order.indexOf(rarity);
    if (idx <= 0) return 'common';
    return order[idx - 1];
  }

  createRewardItem(rarity) {
    const gen = new CardDataGenerator();
    const roll = Math.random();
    const type = roll < 0.45 ? 'weapon' : roll < 0.85 ? 'armor' : 'magic';
    const item = gen.createCardData(type, this.gameState.currentFloor, false, null, rarity);
    item.rarity = rarity;
    return item;
  }

  // Shows the chest loot as a card the player clicks to take. Respects a full
  // inventory: taking simply fails with feedback until a slot is freed, so the
  // reward is never silently lost.
  presentLoot(item) {
    this.pendingLoot = item;
    this.showRewardCard(item);

    this.takeHint = this.add.text(470, 205, 'Click the card to take it', {
      fontSize: '11px',
      fill: '#f2d3aa',
      fontFamily: '"HoMM Pixel"',
      wordWrap: { width: 120 },
      align: 'center'
    }).setOrigin(0.5);
  }

  takeLoot() {
    if (this.lootTaken || !this.pendingLoot) return;
    const item = this.pendingLoot;

    const added = this.gameScene?.inventorySystem
      ? this.gameScene.inventorySystem.addCard(item)
      : (() => {
          const slot = this.gameState.inventory.findIndex(s => s === null);
          if (slot === -1) return false;
          this.setInventorySlot(slot, item);
          return true;
        })();

    if (!added) {
      this.showFeedback('Inventory full — free a slot first', 0xff4444, 250);
      return;
    }

    this.lootTaken = true;
    this.pendingLoot = null;
    SoundHelper.playSound(this, 'shop_buy', 0.5);
    this.showFeedback('Taken!', 0x00ff00, 250);

    if (this.rewardCardContainer) {
      this.tweens.add({
        targets: this.rewardCardContainer,
        alpha: 0,
        scale: 0.6,
        duration: 200,
        onComplete: () => { this.rewardCardContainer?.destroy(true); this.rewardCardContainer = null; }
      });
    }
    this.takeHint?.setText('');
    this.hideItemTooltip();
    this.refreshStationInventoryDisplay();
    this.gameScene?.updateUI?.();
  }

  getRewardStats(item) {
    if (item.type === 'weapon') return `${item.rarity}  ${item.damage || 0} DMG`;
    if (item.type === 'armor') return `${item.rarity}  ${item.protection || 0} DEF`;
    if (item.type === 'magic') return `${item.rarity} Magic`;
    if (item.type === 'thorns') return `${item.rarity} ${item.thornDamage || 0} Thorns`;
    return item.rarity || '';
  }

  // getRarityColor / playLootScatter / scatterLootSprite / createItemSprite all
  // inherited from StationRoomBase.

  showRewardCard(item) {
    if (this.rewardCardContainer) {
      this.rewardCardContainer.destroy(true);
    }

    const x = 470;
    const y = 130;
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

    // The card is the take target; hovering also shows the shared tooltip.
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => this.showItemTooltip(item, x, y - 8));
    bg.on('pointerout', () => this.hideItemTooltip());
    bg.on('pointerdown', () => this.takeLoot());
  }

  setInventorySlot(index, value) {
    // Write to gameState first — this must stick regardless of what happens below.
    this.gameState.inventory[index] = value;

    const inv = this.gameScene?.inventorySystem;
    if (!inv?.slots) return;

    // Pre-sync the slots array directly so any subsequent syncGameStateInventory()
    // call (inside removeCard / addCardDirect) cannot overwrite our change.
    // This prevents the key-restore bug that occurs when GameScene is sleeping
    // and the two arrays have drifted out of sync.
    if (index < inv.slots.length) inv.slots[index] = value;

    if (value === null) {
      // Destroy the sprite now. The deferred rebuildInventorySprites only fires on
      // setVisibility(true), which isn't guaranteed after the chest closes — relying
      // on it left the consumed key's sprite stuck in the slot.
      inv.removeCard(index, true);
    } else {
      inv.addCardDirect(value, index);
      inv.updateTwinkleEffects();
    }
    this.refreshStationInventoryDisplay?.();
  }

  forceOpenTreasureChest(chest) {
    if (this.opened || !chest.active) return;
    this.opened = true;
    this.setKeyButtonOpened();

    const trapTriggered = Math.random() < 0.45;
    if (!trapTriggered) {
      this.playChestOpen(chest, () => this.grantForcedChestRewards(chest, false));
      return;
    }

    this.playChestOpen(chest, () => {
      const trapX = chest.x + Math.random() * 50 - 25;
      const trapY = chest.y + Math.random() * 50 - 25;
      const TRAP_DAMAGE = 5;

      // Wrap the trap art and its damage value in one container so the value
      // reads like a real trap card (board traps show their damage at the same
      // 17,22 value-slot offset) AND stays pinned to the card — it fades and is
      // destroyed together with the art instead of floating loose.
      const trapSprite = this.add.image(0, 0, 'trap');
      const trapValue = this.add.text(17, 22, `${TRAP_DAMAGE}`, {
        fontSize: '11px',
        fill: '#ffcf7f',
        fontFamily: '"HoMM Pixel"'
      }).setOrigin(0.5);
      const trapCard = this.add.container(trapX, trapY, [trapSprite, trapValue]);
      trapCard.setAlpha(0);

      this.tweens.add({
        targets: trapCard,
        alpha: 1,
        duration: 500,
        ease: 'Power2',
        onComplete: () => {
          SoundHelper.playSound(this, 'trap_spring1', 0.5);
          this.gameState.takeDamage(TRAP_DAMAGE, -1, 'trap');
          this.add.text(320, 250, `Trap Spawned! -${TRAP_DAMAGE} HP`, {
            fontSize: '14px',
            fill: '#ff0000',
            fontFamily: '"HoMM Pixel"'
          }).setOrigin(0.5);
          this.gameScene?.updateUI?.();

          this.grantForcedChestRewards(chest, true);

          this.time.delayedCall(1000, () => trapCard.destroy(true));
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

    this.add.text(320, 235, `+${reward.coins} Coins +${reward.crystals} Crystals${trapped ? ' (Trap)' : ''}`, {
      fontSize: '14px',
      fill: trapped ? '#ffff00' : '#00ff00',
      fontFamily: '"HoMM Pixel"'
    }).setOrigin(0.5);

    this.presentLoot(item);
    this.gameScene?.updateUI?.();
    chest.destroy();
  }

  returnToMap() {
    // Tear down the inventory station we opened, then hard-relaunch the map.
    // A relaunch (stop + launch) is robust whether the map was slept (regular
    // chest reached from the map) or stopped (elite chest reached via combat).
    this.stationInventoryLayerActive = false;
    const inv = this.gameScene?.inventorySystem;
    if (inv) {
      inv.setStationMode(false);
      this.restoreGameInventoryLayering();
      inv.setVisibility(false);
      this.scene.sleep('GameScene');
    }
    this.hideItemTooltip?.();
    this.scene.stop();
    this.scene.stop('MapViewScene');
    this.scene.launch('MapViewScene', { gameState: this.gameState });
  }
}

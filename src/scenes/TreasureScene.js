import { SoundHelper } from '../audio/SoundHelper.js';
import { bagArrivalSoundKey } from '../content/audio/armorSounds.js';
import { CardDataGenerator } from '../systems/loot/CardDataGenerator.js';
import { createArmorCardData } from '../content/cards/armor.js';
import { createWeaponCardData } from '../content/cards/weapons.js';
import { applyArmorTalentMods } from '../content/talents/index.js';
import { createTitle } from '../ui/titleText.js';
import { StationRoomBase } from './StationRoomBase.js';
import { exitToSandboxHub, isSandboxMode } from '../sandbox/SandboxMode.js';
import { recordHumanRunEvent, snapshotHumanRunCard } from '../systems/HumanRunRecorder.js';
import { CARD_VALUE_SIZE, CARD_VALUE_SLOT } from '../systems/board/BoardCardFx.js';
import { t, translateItemName, translateRarity } from '../i18n/i18n.js';
import { scaleGoldReward } from '../content/economy/gold.js';
import { createSelectionCorners } from '../ui/NineSlicePanel.js';
import { setHoverLight } from '../ui/HoverLight.js';
import { playCardDissolve } from '../ui/CardDissolve.js';

// Chance an elite's chest also holds a sigil (a secret room's always does).
const ELITE_CHEST_SIGIL_CHANCE = 0.3;
import { openSigilOffer, rollOfferableSigil } from '../ui/SigilOffer.js';

// The chest stands in the middle of the room and is opened by clicking it;
// what it gives sits on top of it, with the take hint underneath.
const CHEST_X = 320;
const CHEST_Y = 130;
const UNDER_CHEST_Y = 205;
// Selection corners on hover hug the chest art (98x98 frame, the chest
// itself about 95x88 in it).
const CHEST_CORNER_OFFSET = { x: 41, y: 38 };
const CHEST_CORNER_DY = 1;
// How dark an opened chest goes: each colour channel multiplied by this /255.
const OPENED_CHEST_SHADE = 110;

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
    this.addOptionsCog();

    this.createChestRoom();
  }

  // ─── STANDARD TREASURE / ELITE CHEST ─────────────────────────────────────

  createChestRoom() {
    // NOTE: no full-screen background here — that would cover the GameScene
    // inventory station underneath. The dungeon backdrop shows through instead.
    const title = this.rewardMode === 'elite' ? t(this, 'ui.treasure.eliteTitle') : t(this, 'ui.treasure.title');
    // (A secret room's chest reads as a treasure; what sets it apart is the
    // sigil it also holds, offered once it opens.)
    createTitle(this, 320, 20, title, {
      color: '#fbad19',
      fallbackSize: '24px'
    });

    const instruction = this.requiresKey ?
      t(this, 'ui.treasure.forceHint') :
      t(this, 'ui.treasure.hint');
    this.instructionText = this.add.text(320, 46, instruction, {
      fontSize: '14px',
      fill: '#fef0cf',
      fontFamily: '"HoMM Pixel"'
    }).setOrigin(0.5);

    const chestTexture = this.textures.exists('bigChestAnimation') ? 'bigChestAnimation' : 'cardBack';
    const chest = this.add.sprite(CHEST_X, CHEST_Y, chestTexture, 0).setInteractive({ useHandCursor: true });
    // A sprite's hit area is measured from its frame's top-left corner, not
    // its centre: the old padded box was set from the centre, so it sat up and
    // left and only covered part of the chest. This is the chest art itself.
    if (chestTexture === 'bigChestAnimation') chest.input.hitArea.setTo(1, 6, 95, 88);
    // Hover: the selection corners every pickable thing uses (map nodes,
    // village buildings), and the hover light every button has.
    this.chestCorners = createSelectionCorners(
      this, CHEST_X, CHEST_Y + CHEST_CORNER_DY, CHEST_CORNER_OFFSET, { depth: (chest.depth || 0) + 1 }
    );
    this.setChestCornersVisible(false);
    chest.on('pointerover', () => {
      SoundHelper.playVariant(this, 'chest_hover', 0.4);
      this.setChestCornersVisible(true);
      setHoverLight(chest, true);
    });
    chest.on('pointerout', () => {
      this.setChestCornersVisible(false);
      setHoverLight(chest, false);
    });
    // One click opens it: with a key in the bag the key is used, a locked
    // chest without one is forced (and may be trapped), and an unlocked chest
    // simply opens.
    chest.on('pointerdown', () => {
      if (!this.requiresKey) {
        this.openRewardChest(chest);
        return;
      }
      const keyIndex = this.findKeyIndex();
      if (keyIndex !== -1) this.openWithKey(keyIndex, chest);
      else this.forceOpenTreasureChest(chest);
    });
    this.chest = chest;

    // Leave button, top-right — matches the shops' Next button.
    this.createStationContinueButton(595, 50, t(this, 'ui.hud.leave'), () => this.returnToMap());
  }

  // An opened chest stays where it stood, open and dimmed: it is spent, and
  // the item it gave sits on top of it until taken.
  darkenOpenedChest(chest) {
    if (!chest?.scene) return;
    this.tweens.addCounter({
      from: 255,
      to: OPENED_CHEST_SHADE,
      duration: 300,
      ease: 'Sine.easeOut',
      onUpdate: (tween) => {
        if (!chest.scene) return;
        const v = Math.round(tween.getValue());
        chest.setTint(Phaser.Display.Color.GetColor(v, v, v));
      },
    });
  }

  setChestCornersVisible(visible) {
    (this.chestCorners || []).forEach((corner) => corner?.scene && corner.setVisible(visible));
  }

  // ─── STANDARD CHEST FLOW ─────────────────────────────────────────────────

  // Read from the bag on screen (the inventory system's slots) when there is
  // one: that is what the key is removed from, so the index found here is
  // always the slot the key really sits in.
  findKeyIndex() {
    const slots = this.gameScene?.inventorySystem?.slots || this.gameState.inventory || [];
    return slots.findIndex(item => item && item.type === 'key');
  }

  openWithKey(keyIndex, chest) {
    if (this.opened || !chest.active) return;
    this.opened = true;
    // The key is spent: it dissolves out of its bag slot (drawn here, above
    // the bag) as the chest opens.
    const inv = this.gameScene?.inventorySystem;
    const keySprite = inv?.slotSprites?.[keyIndex]?.card;
    if (keySprite?.scene) playCardDissolve(this, keySprite);
    this.removeKeyCard(keyIndex);
    this.playChestOpen(chest, () => this.grantChestRewards(chest, true, false));
  }

  openRewardChest(chest) {
    if (this.opened || !chest.active) return;
    this.opened = true;
    this.playChestOpen(chest, () => this.grantChestRewards(chest, true, false));
  }

  playChestOpen(chest, onComplete) {
    chest.disableInteractive();
    this.setChestCornersVisible(false);
    setHoverLight(chest, false);
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
    reward.coins = scaleGoldReward(reward.coins);
    this.gameState.coins += reward.coins;
    this.gameState.crystals += reward.crystals;

    const item = this.createRewardItem(reward.rarity);
    this.playLootScatter(chest.x, chest.y, reward.coins, reward.crystals);


    // Present the item as a takeable card instead of force-inserting it. The
    // player can free a slot in the station inventory first if the bag is full.
    this.presentLoot(item);

    this.gameScene?.updateUI?.();
    this.darkenOpenedChest(chest);

    // A secret room's chest always holds a sigil; an elite's only sometimes —
    // gaining one is meant to be rare. Put on a card the player picks now.
    const brooch = this.gameScene?.amuletManager?.hasEliteChestSigil?.();
    const sigilHere = this.rewardMode === 'secret'
      || (this.rewardMode === 'elite' && (brooch || Math.random() < ELITE_CHEST_SIGIL_CHANCE));
    if (sigilHere) this.time.delayedCall(450, () => this.offerChestSigil());
  }

  offerChestSigil() {
    const sigilId = rollOfferableSigil(this.gameScene);
    if (!sigilId) return;
    openSigilOffer(this, this.gameScene, sigilId, (card) => {
      recordHumanRunEvent(this, 'sigil_taken', {
        source: this.rewardMode === 'secret' ? 'secret_room' : 'elite_chest',
        sigil: sigilId,
        card: card ? snapshotHumanRunCard(card) : null,
      });
    });
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
      // A secret room's chest: as rich as a good chest, no key, plus a sigil.
      secret: {
        coins: 12 + Math.floor(floor / 2),
        crystals: 1 + Math.floor(floor / 12),
        rarity: gen.capRewardRarity(floor >= 38 ? 'epic' : 'rare', floor)
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
    let item = gen.createCardData(type, this.gameState.currentFloor, false, this.gameState, rarity);

    // The generator honours spawn floors, so it can hand back a lower rarity
    // than the chest asked for: an act-1 elite chest asks for uncommon, but
    // uncommon armor does not spawn before floor 10, so floors 1-9 got common
    // armor. This used to just overwrite `rarity` on that card, leaving common
    // art, stats and durability under an uncommon label — which merging then
    // trusted. A chest is a reward, not a floor drop, so build the item at the
    // rarity it promised instead.
    if (item && item.rarity !== rarity) {
      const rebuilt = item.type === 'armor'
        ? createArmorCardData(item.armorType, rarity)
        : item.type === 'weapon'
          ? createWeaponCardData(item.weaponType, rarity)
          : null;
      if (rebuilt) {
        if (rebuilt.type === 'armor' && this.gameState?.talentEffects) {
          applyArmorTalentMods(rebuilt, this.gameState.talentEffects);
        }
        item = rebuilt;
      } else if (item.type === 'magic') {
        // Spells have no rarity tiers to build from; the label is all there is.
        item.rarity = rarity;
      }
    }
    return item;
  }

  // Shows the chest loot as a card the player clicks to take. Respects a full
  // inventory: taking simply fails with feedback until a slot is freed, so the
  // reward is never silently lost.
  presentLoot(item) {
    this.pendingLoot = item;
    this.showRewardCard(item);

    this.takeHint = this.add.text(CHEST_X, UNDER_CHEST_Y, t(this, 'ui.treasure.takeHint'), {
      fontSize: '11px',
      fill: '#f2d3aa',
      fontFamily: '"HoMM Pixel"',
      wordWrap: { width: 200 },
      align: 'center'
    }).setOrigin(0.5);
  }

  takeLoot() {
    if (this.lootTaken || !this.pendingLoot) return;
    const item = this.pendingLoot;
    let destinationSlot = null;

    const added = this.gameScene?.inventorySystem
      ? (() => {
          const success = this.gameScene.inventorySystem.addCard(item);
          if (success) destinationSlot = this.gameScene.inventorySystem.lastAddedSlot;
          return success;
        })()
      : (() => {
          const slot = this.gameState.inventory.findIndex(s => s === null);
          if (slot === -1) return false;
          this.setInventorySlot(slot, item);
          destinationSlot = slot;
          return true;
        })();

    if (!added) {
      recordHumanRunEvent(this, 'treasure_pickup_blocked', {
        reason: 'inventory_full',
        item: snapshotHumanRunCard(item),
      });
      this.showFeedback(t(this, 'ui.treasure.inventoryFull'), 0xb51f1e, 250);
      return;
    }

    this.lootTaken = true;
    this.pendingLoot = null;
    SoundHelper.playSound(this, bagArrivalSoundKey(this, item, 'shop_buy'), 0.5);

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
    recordHumanRunEvent(this, 'treasure_collected', {
      source: this.rewardMode,
      destinationSlot,
      item: snapshotHumanRunCard(item),
    });
  }

  getRewardStats(item) {
    const rarity = translateRarity(this, item.rarity);
    if (item.type === 'weapon') return t(this, 'ui.treasure.weaponStats', { rarity, amount: item.damage || 0 });
    if (item.type === 'armor') return t(this, 'ui.treasure.armorStats', { rarity, amount: item.protection || 0 });
    if (item.type === 'magic') return t(this, 'ui.treasure.magicStats', { rarity });
    if (item.type === 'thorns') return t(this, 'ui.treasure.thornsStats', { rarity, amount: item.thornDamage || 0 });
    return rarity;
  }

  // getRarityColor / playLootScatter / scatterLootSprite / createItemSprite all
  // inherited from StationRoomBase.

  showRewardCard(item) {
    if (this.rewardCardContainer) {
      this.rewardCardContainer.destroy(true);
    }

    // Where the chest stood.
    const x = CHEST_X;
    const y = CHEST_Y;
    const bg = this.add.rectangle(0, 0, 112, 132, 0x1c130a, 0.95)
      .setStrokeStyle(2, this.getRarityColor(item.rarity));
    const sprite = this.add.image(0, -26, item.sprite || 'cardBack', item.spriteFrame ?? undefined)
      .setScale(1);
    const name = this.add.text(0, 36, translateItemName(this, item) || t(this, 'ui.treasure.rewardItem'), {
      fontSize: '10px',
      fill: '#fef0cf',
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

    this.rewardCardContainer = this.add.container(x, y, [bg, sprite, name, stats])
      .setDepth((this.chest?.depth || 0) + 5);
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

  // Takes the key out of the bag. keyIndex is a slot in the bag on screen
  // (findKeyIndex reads inventorySystem.slots); removing it there also syncs
  // GameScene's saved inventory to that array. A different inventory array
  // held by this scene's gameState loses the same key by identity, never by
  // index, so a drifted copy can't lose some other card instead.
  removeKeyCard(keyIndex) {
    const inv = this.gameScene?.inventorySystem;
    if (!inv?.slots) {
      this.setInventorySlot(keyIndex, null);
      return;
    }
    const keyItem = inv.slots[keyIndex];
    inv.removeCard(keyIndex, true, 'chest_key_used');
    const own = this.gameState?.inventory;
    if (Array.isArray(own) && own !== inv.slots) {
      const j = own.indexOf(keyItem);
      if (j !== -1) own[j] = null;
    }
    this.refreshStationInventoryDisplay?.();
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
      // reads like a real trap card (shared CARD_VALUE_SLOT offset, same as the
      // board) AND stays pinned to the card — it fades and is destroyed together
      // with the art instead of floating loose.
      const trapSprite = this.add.image(0, 0, 'trap');
      const trapValue = this.add.text(CARD_VALUE_SLOT.x, CARD_VALUE_SLOT.y, `${TRAP_DAMAGE}`, {
        fontSize: CARD_VALUE_SIZE,
        fill: '#ffcf7f',
        fontFamily: '"HoMM Pixel"'
      }).setOrigin(0.5);
      // Above the reward card, which appears over the chest in this same
      // callback: the trap is what just hurt the player, so it is not hidden.
      const trapCard = this.add.container(trapX, trapY, [trapSprite, trapValue])
        .setDepth((this.chest?.depth || 0) + 10);
      trapCard.setAlpha(0);

      this.tweens.add({
        targets: trapCard,
        alpha: 1,
        duration: 500,
        ease: 'Power2',
        onComplete: () => {
          SoundHelper.playSound(this, 'trap_spring1', 0.5);
          const trapHit = this.gameState.takeDamage(TRAP_DAMAGE, -1, 'trap');
          if (trapHit?.tookDamage) SoundHelper.playVariant(this, 'player_hurt', 0.5);
          this.gameScene?.updateUI?.();

          this.grantForcedChestRewards(chest, true);

          // A sprung trap dissolves after a beat, as one on the board does.
          // The dissolve copies the card art at the container's place (the
          // art sits at the container's 0,0), and the real card goes at once.
          this.time.delayedCall(1000, () => {
            if (!trapCard.scene) return;
            playCardDissolve(this, {
              x: trapCard.x,
              y: trapCard.y,
              texture: trapSprite.texture,
              frame: trapSprite.frame,
            }, 'enemy');
            trapCard.destroy(true);
          });
        }
      });
    });
  }

  grantForcedChestRewards(chest, trapped) {
    const reward = this.getRewardValues(false);
    reward.coins = scaleGoldReward(reward.coins);
    this.gameState.coins += reward.coins;
    this.gameState.crystals += reward.crystals;

    const item = this.createRewardItem(reward.rarity);
    this.playLootScatter(chest.x, chest.y, reward.coins, reward.crystals);


    this.presentLoot(item);
    this.gameScene?.updateUI?.();
    this.darkenOpenedChest(chest);
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
    if (isSandboxMode(this) || isSandboxMode(this.gameScene)) {
      exitToSandboxHub(this);
      return;
    }
    this.scene.stop();
    this.scene.stop('MapViewScene');
    this.scene.launch('MapViewScene', { gameState: this.gameState });
  }
}

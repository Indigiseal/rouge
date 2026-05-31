// EventScene.js
// Unknown encounter events. Each event has a title, description, and a list of choices.
// Choices can have a condition (function returning bool) that disables them if not met.
// After a choice is made, an optional outcome message is shown before returning to the map.
// To add new events, add objects to the EVENTS array below.

import { CardDataGenerator } from '../CardDataGenerator.js';

const EVENTS = [
  {
    id: 'burning_caravan',
    title: 'Burning Caravan',
    description: 'A spice caravan is half-stuck, half-burning, and fully chaotic. A little donkey is tangled in the reins. Bandits are running away with supplies.',
    choices: [
      {
        text: 'Save the donkey',
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.storyRun.caravanSeen = true;
          gs.storyRun.donkeySaved = true;
          gs.storyRun.banditsEscaped = true;
          scene.addPendingEvent('robbed_hermit');
          scene.markHeroMemory('learnedDonkeyCanBeSaved');
          scene.heal(5);
          // The donkey carried a saddlebag of mining gear — you find a gem.
          scene.addGemToInventory();
        },
        outcome: 'You cut the donkey free. It bumps your shoulder, drops a glittering stone from its saddlebag, then trots away. In the distance, the bandits vanish with the supply sack...'
      },
      {
        text: 'Chase the bandits',
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.storyRun.caravanSeen = true;
          gs.storyRun.banditsStopped = true;
          gs.storyRun.donkeyLost = true;
          gs.storyRun.hermitState = 'safe';
          scene.gainCoins(15);
          scene.gainCrystals(1);
          // Recovered stolen goods include a socket gem.
          scene.addGemToInventory();
        },
        outcome: 'You sprint after the bandits and scatter them before they cause more trouble. Among the dropped loot is a glinting gem. When you return, the donkey is gone.'
      },
      {
        text: 'Save the merchant crates',
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.storyRun.caravanSeen = true;
          gs.storyRun.merchantGrateful = true;
          gs.storyRun.banditsEscaped = true;
          gs.storyRun.donkeyLost = true;
          scene.addPendingEvent('robbed_hermit');
          scene.gainCoins(25);
        },
        outcome: 'You drag the spice crates away from the flames. The merchant pays you with shaking hands. The donkey and bandits are both gone.'
      },
      {
        text: 'Use what you know: free the donkey, then cut off the bandits',
        condition: (gs, scene) => {
          scene.ensureStoryState();
          return gs.heroMemory.learnedBanditsThreatenHermit || scene.hasPotion();
        },
        action: (gs, scene) => {
          scene.ensureStoryState();
          if (scene.hasPotion()) scene.consumePotion();
          gs.storyRun.caravanSeen = true;
          gs.storyRun.donkeySaved = true;
          gs.storyRun.banditsStopped = true;
          gs.storyRun.merchantGrateful = true;
          gs.storyRun.hermitState = 'safe';
          scene.clearPendingEvent('robbed_hermit');
          scene.markHeroMemory('solvedCaravanPerfectly');
          scene.gainCoins(10);
          scene.gainCrystals(1);
          scene.heal(5);
          // Perfect-solve bonus: two gems for handling everything cleanly.
          scene.addGemToInventory();
          scene.addGemToInventory();
        },
        outcome: 'You move before the chaos spreads: donkey freed, bandits blocked, crates dragged clear. The merchant presses two glittering gems into your palm. He stares like you already lived this day once.'
      }
    ]
  },
  {
    id: 'robbed_hermit',
    title: 'The Robbed Hermit',
    description: 'You find the old hermit beside an overturned soup pot. Bandits stole his medicine shelf and spilled something he insists was structurally important soup.',
    choices: [
      {
        text: 'Help clean up',
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.storyRun.hermitState = 'robbed';
          scene.markHeroMemory('learnedBanditsThreatenHermit');
          if (!scene.repairRandomDamagedItem(1)) scene.heal(5);
          // Among the spilled junk you find a stray socket gem.
          scene.addGemToInventory();
          scene.clearPendingEvent('robbed_hermit');
        },
        outcome: 'The hermit grumbles, but fixes what he can. While sweeping you spot a glinting stone in the soup ash. "Next time," he mutters, "stop the soup criminals first."'
      },
      {
        text: 'Offer 10 coins for supplies',
        condition: (gs) => gs.coins >= 10,
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.coins -= 10;
          gs.storyRun.hermitState = 'robbed';
          scene.markHeroMemory('learnedBanditsThreatenHermit');
          if (!scene.addPotionToInventory()) scene.heal(15);
          // The hermit throws in a gem he's been hoarding "for emergencies."
          scene.addGemToInventory();
          scene.clearPendingEvent('robbed_hermit');
        },
        outcome: 'He accepts the coins with wounded dignity and gives you a spare bottle from under his hat — and a polished gem from a tin labeled "for emergencies."'
      },
      {
        text: 'Leave quietly',
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.storyRun.hermitState = 'robbed';
          scene.markHeroMemory('learnedBanditsThreatenHermit');
          scene.clearPendingEvent('robbed_hermit');
        },
        outcome: 'You leave the hermit arguing with his soup pot. You will remember what the escaped bandits did.'
      }
    ]
  },
  {
    id: 'cheerful_hermit',
    title: 'The Cheerful Hermit',
    description: 'The hermit is peacefully stirring soup in a dented helmet. He says fewer bandits means better soup weather.',
    choices: [
      {
        text: 'Listen to advice',
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.storyRun.hermitState = 'safe';
          gs.storyRun.cheerfulHermitVisited = true;
          if (!scene.repairRandomDamagedItem(1)) scene.heal(10);
          // His "advice" includes pressing a gem into your hand for some reason.
          scene.addGemToInventory();
        },
        outcome: 'He explains three impossible things about soup, pushes a small gem into your palm "to balance the metaphor," and somehow your gear feels better.'
      },
      {
        text: 'Ask for medicine',
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.storyRun.hermitState = 'safe';
          gs.storyRun.cheerfulHermitVisited = true;
          if (!scene.addPotionToInventory()) scene.heal(10);
        },
        outcome: 'He hands you a healing potion labeled "probably safe."'
      },
      {
        text: 'Compliment the soup',
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.storyRun.hermitState = 'safe';
          gs.storyRun.cheerfulHermitVisited = true;
          scene.heal(5);
        },
        outcome: 'The hermit beams. The soup bubbles approvingly.'
      }
    ]
  },
  {
    id: 'placeholder_a',
    title: 'Quiet Crossroads',
    description: 'For once, the road is only strange in the normal dungeon way. A glittering stone catches your eye in the dirt.',
    choices: [
      {
        text: 'Gain 10 coins',
        action: (gs, scene) => { scene.gainCoins(10); },
        outcome: 'You pocket the coins and move on.'
      },
      {
        text: 'Heal 5 HP',
        action: (gs, scene) => scene.heal(5),
        outcome: 'You rest briefly and feel a little better.'
      },
      {
        text: 'Pick up the gem',
        action: (gs, scene) => { scene.addGemToInventory(); },
        outcome: 'You pry the stone loose. It pulses faintly in your hand.'
      },
      {
        text: 'Leave',
        action: () => {},
        outcome: 'You decide not to linger.'
      }
    ]
  }
  // More events will be added here
];

export class EventScene extends Phaser.Scene {
  constructor() {
    super({ key: 'EventScene' });
  }

  init(data) {
    this.gameState = data.gameState;
    this.ensureStoryState();
    this.event = this._pickEvent();
    this.resolved = false;
  }

  _pickEvent() {
    this.ensureStoryState();
    const story = this.gameState.storyRun;

    if (story.pendingEvents.includes('robbed_hermit')) return this.getEventById('robbed_hermit');
    if (story.banditsStopped && story.hermitState !== 'robbed' && !story.cheerfulHermitVisited) return this.getEventById('cheerful_hermit');
    if (!story.caravanSeen) return this.getEventById('burning_caravan');
    return this.getEventById('placeholder_a');
  }

  getEventById(id) {
    return EVENTS.find(event => event.id === id) || EVENTS[0];
  }

  ensureStoryState() {
    if (!this.gameState) return;

    const defaultStoryRun = {
      caravanSeen: false,
      donkeySaved: false,
      donkeyLost: false,
      banditsStopped: false,
      banditsEscaped: false,
      merchantGrateful: false,
      hermitState: 'unknown',
      pendingEvents: [],
      cheerfulHermitVisited: false
    };

    const defaultHeroMemory = {
      learnedBanditsThreatenHermit: false,
      learnedDonkeyCanBeSaved: false,
      solvedCaravanPerfectly: false
    };

    let savedMemory = {};
    try {
      savedMemory = JSON.parse(localStorage.getItem('heroMemory') || '{}');
    } catch {
      savedMemory = {};
    }

    this.gameState.storyRun = {
      ...defaultStoryRun,
      ...(this.gameState.storyRun || {}),
      pendingEvents: Array.isArray(this.gameState.storyRun?.pendingEvents)
        ? this.gameState.storyRun.pendingEvents
        : []
    };
    this.gameState.heroMemory = {
      ...defaultHeroMemory,
      ...savedMemory,
      ...(this.gameState.heroMemory || {})
    };
  }

  hasPotion() {
    const slots = this.getInventorySlots();
    return slots.some(item => item?.type === 'potion');
  }

  consumePotion() {
    const slots = this.getInventorySlots();
    const index = slots.findIndex(item => item?.type === 'potion');
    if (index < 0) return false;

    if (this.gameScene?.inventorySystem) {
      this.gameScene.inventorySystem.removeCard(index);
    } else {
      slots[index] = null;
      this.gameState.inventory = slots;
    }
    return true;
  }

  addPotionToInventory() {
    const potion = new CardDataGenerator().createPotionCard(this.gameState.currentFloor || 1);
    if (this.gameScene?.inventorySystem) {
      return this.gameScene.inventorySystem.addCard(potion);
    }

    const slots = this.getInventorySlots();
    const emptyIndex = slots.findIndex(item => !item);
    if (emptyIndex < 0) return false;
    slots[emptyIndex] = potion;
    this.gameState.inventory = slots;
    return true;
  }

  // Drop a random socket gem (fire/poison/lightning) into inventory. If the
  // inventory is full, falls back to coins so the reward never silently vanishes.
  // Used as the main "tangible loot" for story events — gems are precious for
  // socketing into the equipped weapon and beating bosses.
  addGemToInventory() {
    const gem = new CardDataGenerator().createGemCard(this.gameState.currentFloor || 1);
    if (this.gameScene?.inventorySystem) {
      const added = this.gameScene.inventorySystem.addCard(gem);
      if (added) return true;
    } else {
      const slots = this.getInventorySlots();
      const emptyIndex = slots.findIndex(item => !item);
      if (emptyIndex >= 0) {
        slots[emptyIndex] = gem;
        this.gameState.inventory = slots;
        return true;
      }
    }
    // Inventory full — give a small coin consolation so the choice isn't wasted.
    this.gainCoins(8);
    return false;
  }

  heal(amount) {
    if (this.gameState?.heal) {
      this.gameState.heal(amount);
      return;
    }
    this.gameState.playerHealth = Math.min(this.gameState.maxHealth, this.gameState.playerHealth + amount);
  }

  gainCoins(amount) {
    this.gameState.coins = (this.gameState.coins || 0) + amount;
  }

  gainCrystals(amount) {
    this.gameState.crystals = (this.gameState.crystals || 0) + amount;
  }

  repairRandomDamagedItem(amount) {
    const candidates = [];
    const addCandidate = (item) => {
      if (item?.maxDurability && item.durability < item.maxDurability) candidates.push(item);
    };

    this.getInventorySlots().forEach(addCandidate);
    addCandidate(this.gameState.equippedWeapon);
    addCandidate(this.gameState.equippedArmor);

    if (candidates.length === 0) return false;
    const item = candidates[Math.floor(Math.random() * candidates.length)];
    item.durability = Math.min(item.maxDurability, item.durability + amount);
    this.gameScene?.inventorySystem?.rebuildInventorySprites?.();
    this.gameScene?.updateEquippedArmorPanel?.();
    return true;
  }

  addPendingEvent(id) {
    this.ensureStoryState();
    if (!this.gameState.storyRun.pendingEvents.includes(id)) {
      this.gameState.storyRun.pendingEvents.push(id);
    }
  }

  clearPendingEvent(id) {
    this.ensureStoryState();
    this.gameState.storyRun.pendingEvents = this.gameState.storyRun.pendingEvents.filter(eventId => eventId !== id);
  }

  markHeroMemory(key) {
    this.ensureStoryState();
    if (!(key in this.gameState.heroMemory)) return;
    this.gameState.heroMemory[key] = true;
    try {
      localStorage.setItem('heroMemory', JSON.stringify(this.gameState.heroMemory));
    } catch {
      // Memory still survives on gameState even if storage is unavailable.
    }
  }

  getInventorySlots() {
    if (this.gameScene?.inventorySystem?.slots) return this.gameScene.inventorySystem.slots;
    if (!Array.isArray(this.gameState.inventory)) this.gameState.inventory = new Array(5).fill(null);
    return this.gameState.inventory;
  }

  create() {
    const W = 640, H = 360;
    const PURPLE = '#9370db';
    const GOLD   = '#f2d3aa';
    const WHITE  = '#ffffff';
    const MUTED  = '#aaaaaa';

    // Background
    this.add.rectangle(W / 2, H / 2, W, H, 0x1a1a2e);
    this.add.rectangle(W / 2, 35, W, 70, 0x12122a);

    // Title
    this.add.text(W / 2, 35, this.event.title, {
      fontSize: '22px', fill: PURPLE, fontFamily: '"HoMM Pixel"'
    }).setOrigin(0.5);

    // Description
    this.descText = this.add.text(W / 2, 110, this.event.description, {
      fontSize: '14px', fill: GOLD, fontFamily: '"HoMM Pixel"',
      align: 'center', wordWrap: { width: 520 }
    }).setOrigin(0.5);

    // Divider
    this.add.rectangle(W / 2, 155, 480, 1, 0x3a2a5a);

    // Choice buttons
    this._choiceBtns = [];
    this.gameScene = this.scene.get('GameScene');
    this._buildChoices();

    // Outcome text (hidden until a choice is made)
    this.outcomeText = this.add.text(W / 2, 310, '', {
      fontSize: '13px', fill: '#88ff88', fontFamily: '"HoMM Pixel"',
      align: 'center', wordWrap: { width: 500 }
    }).setOrigin(0.5).setAlpha(0);

    // Continue button (hidden until resolved)
    this.continueBtn = this.add.rectangle(W / 2, 340, 180, 32, 0x2a1a4a)
      .setStrokeStyle(2, 0x9370db)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0);
    this.continueBtnText = this.add.text(W / 2, 340, 'Continue', {
      fontSize: '14px', fill: WHITE, fontFamily: '"HoMM Pixel"'
    }).setOrigin(0.5).setAlpha(0);

    this.continueBtn.on('pointerdown', () => this.continueAdventure());
    this.continueBtn.on('pointerover', () => this.continueBtn.setFillStyle(0x3a2a5a));
    this.continueBtn.on('pointerout',  () => this.continueBtn.setFillStyle(0x2a1a4a));
  }

  _buildChoices() {
    const startY = 185;
    const gap    = this.event.choices.length > 3 ? 36 : 42;

    this.event.choices.forEach((choice, i) => {
      const y = startY + i * gap;
      const disabled = choice.condition && !choice.condition(this.gameState, this);

      const bg = this.add.rectangle(320, y, 460, 34, disabled ? 0x222222 : 0x2a1a3a)
        .setStrokeStyle(1, disabled ? 0x444444 : 0x9370db);

      const label = this.add.text(320, y, choice.text, {
        fontSize: choice.text.length > 44 ? '11px' : '13px',
        fill: disabled ? '#555555' : '#ffffff',
        fontFamily: '"HoMM Pixel"',
        align: 'center',
        wordWrap: { width: 430 }
      }).setOrigin(0.5);

      if (!disabled) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => { bg.setFillStyle(0x3d2060); });
        bg.on('pointerout',  () => { bg.setFillStyle(0x2a1a3a); });
        bg.on('pointerdown', () => this._resolve(choice, bg, label, i));
      }

      this._choiceBtns.push({ bg, label });
    });
  }

  _resolve(choice, activeBg, activeLabel, choiceIdx) {
    if (this.resolved) return;
    this.resolved = true;

    // Apply the effect
    choice.action(this.gameState, this);

    // Highlight chosen, fade the rest
    this._choiceBtns.forEach(({ bg, label }, i) => {
      if (i === choiceIdx) {
        bg.setFillStyle(0x4a2a7a).setStrokeStyle(2, 0xf2d3aa);
        bg.removeInteractive();
      } else {
        bg.setAlpha(0.3);
        label.setAlpha(0.3);
        bg.removeInteractive();
      }
    });

    // Show outcome and continue button
    if (choice.outcome) {
      this.outcomeText.setText(choice.outcome);
      this.tweens.add({ targets: this.outcomeText, alpha: 1, duration: 300 });
    }
    this.tweens.add({
      targets: [this.continueBtn, this.continueBtnText],
      alpha: 1, duration: 300, delay: choice.outcome ? 400 : 0
    });
  }

  continueAdventure() {
    this.scene.stop();
    this.scene.wake('MapViewScene');
  }
}

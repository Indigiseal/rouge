// Event run helpers — carnival / brass / egg / inventory logic used by EventScene.
// Methods are assigned onto EventScene.prototype and keep `this` as the scene.

import { CardDataGenerator } from '../loot/CardDataGenerator.js';

export const EventRunHelpers = {
  hasGem(effect) {
    return this._findInventoryIndex(item => (
      item?.type === 'gem' && item?.gemEffect === effect
    )) >= 0;
  },

  consumeGem(effect) {
    const index = this._findInventoryIndex(item => (
      item?.type === 'gem' && item?.gemEffect === effect
    ));
    if (index < 0) return false;
    return this._removeInventoryCard(index);
  },

  hasKeyCard() {
    return this._findInventoryIndex(item => this._isKeyCard(item)) >= 0;
  },

  consumeKeyCard() {
    const index = this._findInventoryIndex(item => this._isKeyCard(item));
    if (index < 0) return false;
    return this._removeInventoryCard(index);
  },

  hasPotion() {
    return this._findInventoryIndex(item => this._isPotionCard(item)) >= 0;
  },

  consumePotion() {
    const index = this._findInventoryIndex(item => this._isPotionCard(item));
    if (index < 0) return false;
    return this._removeInventoryCard(index);
  },

  hasFoodCard() {
    return this._findInventoryIndex(item => item?.type === 'food') >= 0;
  },

  consumeFoodCard() {
    const index = this._findInventoryIndex(item => item?.type === 'food');
    if (index < 0) return false;
    return this._removeInventoryCard(index);
  },

  hasMagicCard() {
    return this._findInventoryIndex(item => item?.type === 'magic') >= 0;
  },

  consumeMagicCard() {
    const index = this._findInventoryIndex(item => item?.type === 'magic');
    if (index < 0) return false;
    const card = this.getInventorySlots()[index];
    const removed = this._removeInventoryCard(index);
    if (removed) this._reward(`Fed magic card: ${card?.name || 'Magic Card'}`);
    return removed;
  },

  hasFireballCard() {
    return this._findInventoryIndex(item => (
      item?.type === 'magic' && item?.magicType === 'fireball'
    )) >= 0;
  },

  consumeFireballCard() {
    const index = this._findInventoryIndex(item => (
      item?.type === 'magic' && item?.magicType === 'fireball'
    ));
    if (index < 0) return false;
    const removed = this._removeInventoryCard(index);
    if (removed) this._reward('Consumed magic card: Fireball');
    return removed;
  },

  gainRareThornsCard() {
    const thorns = new CardDataGenerator().createThornsCard(
      this.gameState?.currentFloor || 1,
      'rare'
    );
    return this._deliverCardReward(thorns, 'Rare Thorns', 'Gained card: Rare Thorns');
  },

  hasSacrificeCard() {
    return this.getStoryInventorySlots().some(item => this._isSacrificeCard(item));
  },

  sacrificeFirstNonEssentialCard() {
    const slots = this.getStoryInventorySlots();
    const preferredTypes = new Set(['magic', 'food', 'thorns', 'weapon', 'armor']);
    const commonPreferredIndex = slots.findIndex(item => (
      this._isSacrificeCard(item)
      && item?.rarity === 'common'
      && preferredTypes.has(item?.type)
    ));
    const preferredIndex = slots.findIndex(item => (
      this._isSacrificeCard(item)
      && preferredTypes.has(item?.type)
    ));
    const commonIndex = slots.findIndex(item => (
      this._isSacrificeCard(item)
      && item?.rarity === 'common'
    ));
    const index = commonPreferredIndex >= 0
      ? commonPreferredIndex
      : preferredIndex >= 0
        ? preferredIndex
        : commonIndex >= 0
          ? commonIndex
          : slots.findIndex(item => this._isSacrificeCard(item));

    if (index < 0) return false;
    return this._removeStoryInventoryCard(index);
  },

  addEggOrFallback() {
    const egg = new CardDataGenerator().createEggCard();
    if (this._addCardToInventory(egg)) {
      this._reward(`Gained: ${egg?.name || 'Egg'}`);
      return true;
    }
    this.heal(5);
    return false;
  },

  hasEggCard() {
    return this.getInventorySlots().some(item => item?.id === 'monsterEgg' || item?.name === 'Egg');
  },

  hasChickCompanion() {
    return this.getInventorySlots().some(item => item?.id === 'chickCompanion');
  },

  canShowEggHatchingEvent() {
    this.ensureStoryState();
    const story = this.gameState.storyRun;
    return Boolean(
      story.goblinEngineerResolved
      && !story.chickHatched
      && !this.hasChickCompanion()
      && this.hasEggCard()
    );
  },

  queueEggHatchingEvent() {
    this.ensureStoryState();
    if (!this.canShowEggHatchingEvent()) return false;
    this.addPendingEvent('hatching_egg');
    return true;
  },

  hatchEggIntoCompanion() {
    this.ensureStoryState();
    if (!this.canShowEggHatchingEvent()) return false;
    const slots = this.getInventorySlots();

    const eggIndex = slots.findIndex(item => item?.id === 'monsterEgg' || item?.name === 'Egg');
    if (eggIndex < 0) return false;

    slots[eggIndex] = new CardDataGenerator().createChickCompanionCard();
    this.gameState.inventory = slots;
    this.gameState.storyRun.chickHatched = true;
    this.gameScene?.inventorySystem?.rebuildInventorySprites?.();
    return true;
  },

  damageEquippedArmor(amount = 1) {
    const armor = this.gameState?.equippedArmor;
    if (!armor || !Number.isFinite(amount) || amount <= 0) return false;
    const durability = Number(armor.durability);
    if (!Number.isFinite(durability)) return false;

    armor.durability = Math.max(0, durability - amount);
    if (armor.durability <= 0) this.gameState.equippedArmor = null;
    this.gameScene?.updateEquippedArmorPanel?.();
    this.gameScene?.updateUI?.();
    return true;
  },

  expandInventorySlots(additionalSlots = 1) {
    if (!this.gameState || !Number.isFinite(additionalSlots) || additionalSlots <= 0) return false;
    this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
    const inventorySystem = this.gameScene?.inventorySystem;

    if (inventorySystem?.expandInventory) {
      inventorySystem.expandInventory(additionalSlots);
      this.gameState.inventory = inventorySystem.slots;
      return true;
    }

    const slots = this.getStoryInventorySlots();
    for (let i = 0; i < additionalSlots; i++) slots.push(null);
    this.gameState.inventory = slots;
    this.gameState.bonusInventorySlots = (this.gameState.bonusInventorySlots || 0) + additionalSlots;
    // TODO: promote Loyal Latchbox to a true cross-run meta upgrade if desired.
    return true;
  },

  resolveBoxRepair(prelude) {
    this.ensureStoryState();
    this.clearPendingEvent('goblin_engineer');
    const story = this.gameState.storyRun;
    story.goblinEngineerResolved = true;

    const requestedChance = Number.isFinite(story.boxRepairChance) ? story.boxRepairChance : 50;
    const chance = story.boxHasCog ? Math.max(0, Math.min(100, requestedChance)) : 50;
    story.boxRepairChance = chance;
    const succeeded = Math.random() * 100 < chance;

    if (succeeded) {
      story.boxState = 'repaired';
      story.latchboxRewardClaimed = true;
      story.boxFollowing = false;
      this.expandInventorySlots(1);
      this.boxRepairOutcome = `${prelude}\n\nThe music box snatches the cog, clicks once, then unfolds a hidden drawer from a place where no drawer should fit. Then another drawer opens. Then a third. It climbs into your pack like it has always belonged there.\n\nLoyal Latchbox: +1 inventory slot`;
      this.queueEggHatchingEvent();
      return true;
    }

    story.boxState = 'failed_repair';
    story.latchboxRewardClaimed = true;
    story.boxFollowing = false;
    this.gainCoins(12);
    this.gainCrystals(1);
    this.boxRepairOutcome = `${prelude}\n\nThe music box swallows the cog. It clicks. It coughs. A puff of sleepy smoke leaks out, followed by three embarrassed notes. Then it spits out a few valuables and refuses to discuss what happened.`;
    this.queueEggHatchingEvent();
    return false;
  },

  addPotionToInventory() {
    const potion = new CardDataGenerator().createPotionCard(this.gameState?.currentFloor || 1);
    const added = this._addCardToInventory(potion);
    if (added) this._reward(`Gained: ${potion?.name || 'Potion'}`);
    return added;
  },

  markCarnivalHagMet() {
    this.ensureStoryState();
    this.gameState.storyRun.carnivalVisited = true;
    this.gameState.storyRun.carnivalHagMet = true;
  },

  spendCoins(amount) {
    if (!this.gameState || !Number.isFinite(amount) || amount <= 0) return false;
    const before = Number.isFinite(this.gameState.coins) ? this.gameState.coins : 0;
    if (before < amount) return false;
    this.gameState.coins = before - amount;
    this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
    this.gameScene?.updateUI?.();
    this._reward(`-${amount} coin${amount === 1 ? '' : 's'}`);
    return true;
  },

  buyCarnivalJunk(junkId) {
    this.markCarnivalHagMet();
    if (!this.spendCoins(1)) return false;
    const junk = this.createCarnivalJunkCard(junkId);
    const added = this._deliverCardReward(junk, junk.name || 'Carnival Junk', `Gained junk card: ${junk.name || 'Carnival Junk'}`);
    this.addPendingEvent('brass_wizard');
    return added;
  },

  buyLuckyClover() {
    this.markCarnivalHagMet();
    if (!this.spendCoins(1)) return false;
    this.addPendingEvent('brass_wizard');

    // The clover lands in the bag as an equipable amulet card (with a little
    // card→amulet morph), rather than auto-equipping. The player taps it in a
    // later battle to actually wear it. If the bag is full, fall back to
    // equipping it outright so the coin is never wasted.
    const inv = this.gameScene?.inventorySystem;
    const slot = inv?.deliverCloverAmulet?.();
    if (Number.isInteger(slot) && slot >= 0) {
      this.gameScene?.updateUI?.();
      this._reward('Gained: Lucky Clover — tap it in battle to equip');
      this._pushRewardIcon('relicsOthers', 69, 'luckyClover');
      return true;
    }
    return this.gainAmulet('luckyClover');
  },

  refuseCarnivalHag() {
    this.markCarnivalHagMet();
    this.loseHealthCapped(3);
    this.addPendingEvent('brass_wizard');
  },

  createCarnivalJunkCard(junkId) {
    const data = {
      dustyPipe: {
        id: 'carnivalDustyPipe',
        name: 'Dusty Pipe',
        sprite: 'carnivalPipe',
        description: 'Cold ash clings to the bowl. The stem points toward bad ideas.'
      },
      rubberDuck: {
        id: 'carnivalRubberDuck',
        name: 'Rubber Duck',
        sprite: 'carnivalDucky',
        description: 'Its painted eyes are almost gone. It still seems amused.'
      },
      brokenRing: {
        id: 'carnivalBrokenRing',
        name: 'Broken Ring',
        sprite: 'carnivalRing',
        description: 'A cracked gem catches no light, but it remembers being expensive.'
      }
    }[junkId] || {
      id: 'carnivalJunk',
      name: 'Carnival Junk',
      description: 'A cheap prize from a carnival that should not fit inside the dungeon.'
    };

    return {
      ...data,
      type: 'junk',
      rarity: 'common',
      carnivalToken: true,
      noEffect: true,
      cost: 1
    };
  },

  hasCarnivalJunk() {
    return Boolean(this.getFirstCarnivalJunk());
  },

  getFirstCarnivalJunk() {
    const slots = this.getInventorySlots();
    if (!Array.isArray(slots)) return null;
    return slots.find(item => this.isCarnivalJunk(item)) || null;
  },

  isCarnivalJunk(item) {
    return Boolean(item?.type === 'junk' && item?.carnivalToken);
  },

  createRespectableCarnivalCard() {
    const generator = new CardDataGenerator();
    const floor = this.gameState?.currentFloor || 1;
    const types = ['weapon', 'armor', 'thorns', 'potion', 'food', 'magic'];
    let type = types[Math.floor(Math.random() * types.length)];
    const rarityRoll = Math.random();
    const rarity = rarityRoll < 0.12 ? 'rare' : rarityRoll < 0.42 ? 'uncommon' : 'common';

    for (let tries = 0; tries < 8; tries++) {
      const targetRarity = ['weapon', 'armor', 'thorns'].includes(type) ? rarity : null;
      const card = generator.createCardData(type, floor, false, this.gameState, targetRarity);
      if (card) {
        card.carnivalTouched = true;
        return card;
      }
      type = types[Math.floor(Math.random() * types.length)];
    }

    const fallback = generator.createPotionCard(floor);
    fallback.carnivalTouched = true;
    return fallback;
  },

  insertBrassWizardCoin() {
    this.ensureStoryState();
    this.clearPendingEvent('brass_wizard');
    this.gameState.storyRun.carnivalVisited = true;
    this.gameState.storyRun.brassWizardSeen = true;
    if (!this.spendCoins(1)) return false;

    const roll = Math.random();
    if (roll < 0.25) {
      this.brassWizardOutcome = 'The brass wizard\'s hand jerks toward the deck inside its chest.\n\nThen it stops.\n\nIts painted mouth snaps open.\n\nClick.\n\nClick-click.\n\nClick-click-click.\n\nThe sound grows louder, sharp and metallic, echoing from inside the booth.\n\nThe wizard\'s pale eyes stare past you while its puppet mouth keeps clacking faster and faster.\n\nFor a moment, you are sure you broke something.\n\nOr woke something.\n\nYou step back, then turn and push your way into the carnival crowd, just to get away from that awful clicking.';
      this._reward('No reward');
      return true;
    }

    if (roll < 0.55) {
      const card = this.createRespectableCarnivalCard();
      this._deliverCardReward(card, card?.name || 'fortune card', `Gained card: ${card?.name || 'Fortune Card'}`);
      this.brassWizardOutcome = 'The brass wizard\'s hand moves stiffly behind the glass.\n\nIts fingers scrape across the deck inside its chest.\n\nAfter a long pause, one card slides out through the slot.\n\nThe card is warm, as if the machine had been holding it for years.';
      return true;
    }

    if (roll < 0.80) {
      this.brassWizardOutcome = 'The brass wizard\'s hand lifts behind the glass.\n\nIt cannot reach you.\n\nInstead, a narrow tray snaps out from the booth with a hard wooden clack.\n\nThe tray is exactly the size of a card.\n\nThe wizard\'s pale eyes lower toward your inventory.\n\nIts puppet mouth clicks once.\n\nThen it waits.';
      this._brassWizardTrayOpen = true;
      return true;
    }

    this.gainAmulet('fortuneCard');
    this.brassWizardOutcome = 'The brass wizard\'s pale eyes roll upward.\n\nFor a moment, they are blank.\n\nThen they settle into a color they should not have.\n\nHuman eyes.\n\nThe machine goes still.\n\nIt looks at you for a little too long.\n\nNo music reaches this booth now.\n\nThe puppet mouth opens.\n\nClick.\n\nClick.\n\nIts brass hand opens slowly behind the glass.\n\nA single fortune card slides out.';
    return true;
  },

  getBrassWizardTrayChoices() {
    return [{
      text: 'Pull your hand back',
      trayDecline: true,
      action: () => {},
      outcome: 'You step away from the waiting tray.\n\nThe brass wizard does not move.\n\nAfter a few seconds, the tray slides back into the booth by itself.'
    }];
  },

  isBrassWizardRerollable(item) {
    return Boolean(
      item
      && !this.isCarnivalJunk(item)
      && item.type !== 'junk'
      && item.type !== 'companion'
      && item.id !== 'monsterEgg'
    );
  },

  createHolographicOmenCard() {
    return {
      id: 'holographicOmen',
      type: 'passive',
      name: 'Holographic Omen',
      rarity: 'rare',
      sprite: 'holographicOmen',
      passiveEffect: 'holographicOmen',
      description: 'At the start of combat, revealed enemies receive random status effects. Sometimes backfires.',
      flavor: 'A shiny carnival card that makes every fight begin wrong.',
      unique: true
    };
  },

  createSameTypeRerollCard(oldCard) {
    const generator = new CardDataGenerator();
    const floor = this.gameState?.currentFloor || 1;
    const rarity = oldCard?.rarity || 'common';
    const type = oldCard?.type;
    const targetRarity = ['weapon', 'armor', 'thorns'].includes(type) ? rarity : null;

    for (let tries = 0; tries < 12; tries++) {
      const card = generator.createCardData(type, floor, false, this.gameState, targetRarity);
      if (!card) continue;
      if (oldCard?.rarity && card.rarity && card.rarity !== oldCard.rarity) continue;
      if ((card.name || card.id) === (oldCard.name || oldCard.id) && tries < 8) continue;
      card.carnivalTouched = true;
      return card;
    }
    return this.createRespectableCarnivalCard();
  },

  repairRandomDamagedItem(amount) {
    if (!Number.isFinite(amount)) return false;

    const candidates = [];
    const addCandidate = (item) => {
      const durability = Number(item?.durability);
      const maxDurability = Number(item?.maxDurability);
      if (Number.isFinite(durability) && Number.isFinite(maxDurability) && durability < maxDurability) {
        candidates.push(item);
      }
    };

    this.getInventorySlots().forEach(addCandidate);
    addCandidate(this.gameState?.equippedWeapon);
    addCandidate(this.gameState?.equippedArmor);

    if (candidates.length === 0) return false;
    const item = candidates[Math.floor(Math.random() * candidates.length)];
    const before = Number(item.durability);
    item.durability = Math.min(Number(item.maxDurability), before + amount);
    const repaired = item.durability - before;
    this.gameScene?.inventorySystem?.rebuildInventorySprites?.();
    this.gameScene?.updateEquippedArmorPanel?.();
    this.gameScene?.updateUI?.();
    if (repaired > 0) this._reward(`Repaired: ${item.name || 'item'} (+${repaired} durability)`);
    return true;
  },

  getInventorySlots() {
    this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
    const liveSlots = this.gameScene?.inventorySystem?.slots;
    if (Array.isArray(liveSlots)) return liveSlots;

    if (!this.gameState) return [];
    if (!Array.isArray(this.gameState.inventory)) {
      this.gameState.inventory = new Array(5).fill(null);
    }
    return this.gameState.inventory;
  },

  getStoryInventorySlots() {
    if (!this.gameState) return [];
    if (!Array.isArray(this.gameState.inventory)) {
      this.gameState.inventory = new Array(5).fill(null);
    }
    return this.gameState.inventory;
  },

  _addCardToInventory(card) {
    if (!card) return false;

    this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
    if (this.gameScene?.inventorySystem?.addCard) {
      return this.gameScene.inventorySystem.addCard(card);
    }

    const slots = this.getInventorySlots();
    const emptyIndex = slots.findIndex(item => item == null);
    if (emptyIndex < 0) return false;
    slots[emptyIndex] = card;
    this.gameState.inventory = slots;
    return true;
  },

  _removeInventoryCard(index) {
    const slots = this.getInventorySlots();
    if (!Array.isArray(slots) || index < 0 || index >= slots.length || !slots[index]) return false;

    this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
    if (this.gameScene?.inventorySystem?.removeCard) {
      this.gameScene.inventorySystem.removeCard(index);
      return true;
    }

    slots[index] = null;
    if (this.gameState) this.gameState.inventory = slots;
    return true;
  },

  _removeStoryInventoryCard(index) {
    const slots = this.getStoryInventorySlots();
    if (!Array.isArray(slots) || index < 0 || index >= slots.length || !slots[index]) return false;

    slots[index] = null;
    this.gameState.inventory = slots;
    if (this.gameScene?.inventorySystem?.slots === slots) {
      this.gameScene.inventorySystem.removeCard?.(index);
    }
    return true;
  },

  _findInventoryIndex(predicate) {
    const slots = this.getInventorySlots();
    if (!Array.isArray(slots)) return -1;

    for (let i = 0; i < slots.length; i++) {
      const item = slots[i];
      if (!item) continue;
      if (predicate(item, i)) return i;
    }
    return -1;
  },

  _isKeyCard(item) {
    if (!item) return false;
    return item.type === 'key'
      || item.cardType === 'key'
      || item.id === 'key'
      || item.keyType === 'key'
      || item.sprite === 'keyCard';
  },

  _isPotionCard(item) {
    return item?.type === 'potion';
  },

  _isSacrificeCard(item) {
    return Boolean(
      item
      && item.type !== 'companion'
      && item.id !== 'monsterEgg'
      && !this._isKeyCard(item)
      && !this._isPotionCard(item)
    );
  },

  _isScreamingHeadOfferCard(item) {
    // Keys, companions, and one-off story items are protected. Everything else
    // in the inventory is a fair offering, including potions and gems.
    return Boolean(
      item
      && item.type !== 'companion'
      && item.id !== 'monsterEgg'
      && !item.unique
      && !this._isKeyCard(item)
    );
  },

  hasScreamingHeadOfferCard() {
    return this.getInventorySlots().some(item => this._isScreamingHeadOfferCard(item));
  },
};

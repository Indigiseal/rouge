// Event run helpers — carnival / brass / egg / inventory logic used by EventScene.
// Methods are assigned onto EventScene.prototype and keep `this` as the scene.

import { CardDataGenerator } from '../loot/CardDataGenerator.js';
import { SoundHelper } from '../../audio/SoundHelper.js';
import { playCardDissolve } from '../../ui/CardDissolve.js';
import { isGauntlet } from '../../content/balance/Gauntlet.js';
import { resourceCardKey } from '../../content/assets/resourceCards.js';
import { t, translateItemName } from '../../i18n/i18n.js';
import { WEAPONS, createWeaponCardData } from '../../content/cards/weapons.js';
import { ARMORS, createArmorCardData } from '../../content/cards/armor.js';
import { applyArmorTalentMods } from '../../content/talents/index.js';
import { revealHiddenPaths } from '../../map/HiddenPaths.js';
import { SOUP_ROBBERY_SHARE, SOUP_STAND_PURSE } from '../../content/events/soup_stand.js';
import { ROBBED_TRAVELLER_AMULET } from '../../content/events/robbed_traveller.js';
import { EGG_HATCH_FIGHTS } from '../../content/cards/eggHatching.js';
import { legacyNestHasCog, legacyNestNeedsEngineer } from '../../content/story/StormStories.js';
import { actOffsetForFloor } from '../../content/location-packs/calendar.js';
import { CORRIDOR_FED_CRYSTALS, CORRIDOR_ROUND_CRYSTALS, CORRIDOR_ROUND_HP } from '../../content/events/webbed_corridor.js';


// The card types a reroll (Screaming Head, brass wizard tray) can hand back.
const REROLL_CARD_TYPES = ['weapon', 'armor', 'thorns', 'potion', 'food', 'magic'];

// Types that carry a rarity of their own, so a reroll can match the offering.
const RARITY_TYPES = ['weapon', 'armor', 'thorns'];

export const EventRunHelpers = {
  hasGem(effect) {
    if (this._findInventoryIndex(item => (
      item?.type === 'gem' && item?.gemEffect === effect
    )) >= 0) return true;
    return this._findInventoryIndex(item => (
      item?.type === 'weapon' && item?.gemEffect === effect && (item.gemCount || 1) > 0
    )) >= 0;
  },

  consumeGem(effect) {
    const looseIndex = this._findInventoryIndex(item => (
      item?.type === 'gem' && item?.gemEffect === effect
    ));
    if (looseIndex >= 0) return this._removeInventoryCard(looseIndex);

    const weaponIndex = this._findInventoryIndex(item => (
      item?.type === 'weapon' && item?.gemEffect === effect && (item.gemCount || 1) > 0
    ));
    if (weaponIndex < 0) return false;
    const weapon = this.getInventorySlots()[weaponIndex];
    weapon.gemCount = (weapon.gemCount || 1) - 1;
    if (weapon.gemCount <= 0) {
      weapon.gemEffect = null;
      weapon.gemName = null;
      weapon.gemColor = null;
      weapon.gemCount = 0;
    }
    this.gameScene?.inventorySystem?.rebuildInventorySprites?.();
    return true;
  },

  hasKeyCard() {
    return this._findInventoryIndex(item => this._isKeyCard(item)) >= 0;
  },

  consumeKeyCard() {
    const index = this._findInventoryIndex(item => this._isKeyCard(item));
    if (index < 0) return false;
    return this._removeInventoryCard(index);
  },

  isMusicBoxExploded() {
    this.ensureStoryState();
    return this.gameState.storyRun.boxState === 'exploded';
  },

  resolveMusicBoxOpened(source = 'key') {
    this.ensureStoryState();
    this.clearPendingEvent('broken_music_box');
    if (source === 'key') {
      const usesSkeletonKey = this.hasAmulet('skeletonKey');
      this.logStoryKeyChoice(usesSkeletonKey ? 'skeletonKey_broken_music_box' : 'key_card_broken_music_box');
      if (!usesSkeletonKey) this.consumeKeyCard();
    }
    const story = this.gameState.storyRun;
    story.boxState = 'opened';
    story.boxFollowing = true;
    this.gainCrystals(1);
    this.addPendingEvent('goblin_engineer');
  },

  resolveMusicBoxLeft() {
    this.ensureStoryState();
    this.clearPendingEvent('broken_music_box');
    const story = this.gameState.storyRun;
    story.boxState = 'following';
    story.boxFollowing = true;
    this.addPendingEvent('goblin_engineer');
  },

  resolveMusicBoxExploded() {
    this.ensureStoryState();
    this.clearPendingEvent('broken_music_box');
    const story = this.gameState.storyRun;
    story.boxState = 'exploded';
    story.boxFollowing = false;
    this.markHeroMemory('learnedMusicBoxExplodes');
    const before = Number.isFinite(this.gameState.playerHealth) ? this.gameState.playerHealth : 0;
    this.damagePlayer(35, 'music_box_explosion', 'Exploding Music Box');
    const lost = before - (Number.isFinite(this.gameState.playerHealth) ? this.gameState.playerHealth : 0);
    if (lost > 0) this._reward({ key: 'event.reward.hp', vars: { amount: `-${lost}` } });
    this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
    this.gameScene?.updateUI?.();
    this.addPendingEvent('goblin_engineer');
  },

  beginMusicBoxForceOpen() {
    this._musicBoxForceAwaiting = true;
    this._openMusicBoxLockMinigame();
  },

  beginBirdNestSearch() {
    this._birdNestAwaiting = true;
    this._openBirdNestMinigame();
  },

  resolveBirdNestRaid(result = {}) {
    this.ensureStoryState();
    const hasLegacyBox = legacyNestHasCog(this.gameState);
    const needsEngineer = legacyNestNeedsEngineer(this.gameState);
    this._birdNestLegacyCog = hasLegacyBox;
    this.clearPendingEvent('monster_bird_nest');
    const story = this.gameState.storyRun;
    story.birdNestSeen = true;
    const timedOut = Boolean(result.timedOut);
    story.nestRaidTimedOut = timedOut;
    if (hasLegacyBox) this.markHeroMemory('learnedBirdNestHasCog');

    const canTakeCog = hasLegacyBox && Boolean(result.tookCog) && !timedOut;
    const canTakeEgg = Boolean(result.tookEgg) && !timedOut;

    if (hasLegacyBox) {
      story.boxHasCog = canTakeCog;
      if (canTakeCog) story.boxState = 'has_cog';
    }

    if (timedOut) story.birdAngry = true;

    if (canTakeEgg) {
      story.stoleBirdEgg = true;
      story.birdAngry = true;
      this.addEgg();
    }
    if (canTakeCog) this._reward('event.reward.brassCog');
    if (needsEngineer) this.addPendingEvent('goblin_engineer');
    return { tookCog: canTakeCog, tookEgg: canTakeEgg, timedOut };
  },

  hasPotion() {
    return this._findInventoryIndex(item => this._isPotionCard(item)) >= 0;
  },

  consumePotion() {
    const index = this._findInventoryIndex(item => this._isPotionCard(item));
    if (index < 0) return false;
    return this._removeInventoryCard(index);
  },

  // --- The Lost Porter (Silkdeep) -----------------------------------------
  // Armor only counts when it is a spare card in the bag: the porter asks for
  // what you can do without, never the armor on your back.
  hasSpareArmorCard() {
    return this._findInventoryIndex(item => item?.type === 'armor') >= 0;
  },

  hasWeaponCard() {
    return this._findInventoryIndex(item => item?.type === 'weapon') >= 0;
  },

  // Hands over the weakest card of a type: lowest rarity, then lowest value.
  giveAwayWeakestCard(type) {
    const order = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const value = (item) => Number(item?.damage ?? item?.protection ?? 0) || 0;
    const slots = this.getInventorySlots();
    let best = -1;
    slots.forEach((item, i) => {
      if (item?.type !== type) return;
      if (best < 0) { best = i; return; }
      const a = slots[best];
      const ra = order.indexOf(a.rarity || 'common');
      const ri = order.indexOf(item.rarity || 'common');
      if (ri < ra || (ri === ra && value(item) < value(a))) best = i;
    });
    if (best < 0) return false;
    const card = slots[best];
    const removed = this._removeInventoryCard(best);
    if (removed) {
      this._reward({ key: 'event.reward.lost', vars: { name: translateItemName(this, card) || type } });
      this.markPorterMet(true);
    }
    return removed;
  },

  giveAwayPotion() {
    const index = this._findInventoryIndex(item => this._isPotionCard(item));
    if (index < 0) return false;
    const card = this.getInventorySlots()[index];
    const removed = this._removeInventoryCard(index);
    if (removed) {
      this._reward({ key: 'event.reward.lost', vars: { name: translateItemName(this, card) || 'Potion' } });
      this.markPorterMet(true);
    }
    return removed;
  },

  markPorterMet(helped) {
    this.ensureStoryState();
    const story = this.gameState.storyRun;
    story.lostPorterSeen = true;
    if (helped) story.porterHelped = true;
  },

  // The map is an amulet. Taking it queues the party's argument a few floors on
  // and opens the passage it marks: a secret room in this act and every act
  // after, drawn in purple on the run map while the map is held.
  givePorterMap() {
    this.ensureStoryState();
    const story = this.gameState.storyRun;
    const ok = this.gainAmulet('porterMap');
    if (ok) {
      story.porterMapFloor = this.gameState.currentFloor || 1;
      this.addPendingEvent('porter_party_argument');
      revealHiddenPaths(this.gameState, 'porterMap');
    }
    return ok;
  },

  resolvePorterParty(choice) {
    this.ensureStoryState();
    const story = this.gameState.storyRun;
    story.porterPartySeen = true;
    story.porterPartyChoice = choice;
    this.clearPendingEvent('porter_party_argument');
    if (choice !== 'return') return;
    this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
    const mgr = this.gameScene?.amuletManager;
    const def = mgr?.amuletDefinitions?.porterMap;
    if (mgr?.removeAmulet?.('porterMap', { silent: true })) {
      this._reward({ key: 'event.reward.lost', vars: { name: translateItemName(this, def) || "Porter's Map" } });
      this.gameScene.updateUI?.();
    }
  },

  // --- The Mirror Twin ------------------------------------------------------
  hasLooseGem() {
    return this._findInventoryIndex(item => item?.type === 'gem') >= 0;
  },

  giveLooseGem() {
    const index = this._findInventoryIndex(item => item?.type === 'gem');
    if (index < 0) return false;
    const card = this.getInventorySlots()[index];
    const removed = this._removeInventoryCard(index);
    if (removed) {
      this._reward({ key: 'event.reward.lost', vars: { name: translateItemName(this, card) || 'Shard' } });
      this.markMirrorTwinSeen();
    }
    return removed;
  },

  giveAwayAmulet(id) {
    this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
    const mgr = this.gameScene?.amuletManager;
    const def = mgr?.amuletDefinitions?.[id];
    if (!mgr?.removeAmulet?.(id, { silent: true })) return false;
    this._reward({ key: 'event.reward.lost', vars: { name: translateItemName(this, def) || id } });
    this.gameScene.updateUI?.();
    this.markMirrorTwinSeen();
    return true;
  },

  // The pit under the twin's corner: an old adventurer's amulet of at least
  // the given rarities. Falls back to any amulet if that pool is exhausted.
  mirrorTwinPitReward(rarities) {
    const ok = this.gainRandomAmuletFromPool(amulet => rarities.includes(amulet.rarity));
    return ok || this.gainRandomAmulet();
  },

  // The twin gets sucked into the Hand Mirror, which becomes the Twinned
  // Mirror (it replaces the Hand Mirror on pickup).
  absorbMirrorTwin() {
    this.markMirrorTwinSeen();
    return this.gainAmulet('twinnedMirror');
  },

  markMirrorTwinSeen() {
    this.ensureStoryState();
    this.gameState.storyRun.mirrorTwinSeen = true;
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
    if (removed) this._reward({ key: 'event.reward.fedMagic', vars: { name: translateItemName(this, card) || t(this, 'tooltip.magic') } });
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
    if (removed) this._reward({ key: 'event.reward.consumedMagic', vars: { name: translateItemName(this, 'Fireball') } });
    return removed;
  },

  gainRareThornsCard() {
    const thorns = new CardDataGenerator().createThornsCard(
      this.gameState?.currentFloor || 1,
      'rare'
    );
    return this._deliverCardReward(thorns, 'Rare Thorns', {
      key: 'event.reward.gainedCard', vars: { name: translateItemName(this, thorns) },
    });
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

  // The stolen egg goes in the bag like any event card: with a full bag it is
  // held, the outcome says to discard a card for it, and it arrives the moment
  // a slot frees (EventScene._deliverCardReward). It floats from the nest's
  // picture into its slot either way.
  addEgg() {
    const egg = new CardDataGenerator().createEggCard();
    return this._deliverCardReward(egg, egg);
  },

  hasEggCard() {
    return this.getInventorySlots().some(item => item?.id === 'monsterEgg' || item?.name === 'Egg');
  },

  hasChickCompanion() {
    return this.getInventorySlots().some(item => item?.id === 'chickCompanion');
  },

  damageEquippedArmor(amount = 1) {
    const armor = this.gameState?.equippedArmor;
    if (!armor || !Number.isFinite(amount) || amount <= 0) return false;
    const durability = Number(armor.durability);
    if (!Number.isFinite(durability)) return false;

    armor.durability = Math.max(0, durability - amount);
    // The fight's sounds: a pip knocked off is the "Armor Broken!" crack an
    // armor-piercing hit makes; armor worn through is the break.
    if (armor.durability <= 0) {
      SoundHelper.playVariant(this, 'armor_break', 0.55);
      this.gameState.equippedArmor = null;
    } else {
      SoundHelper.playSound(this, 'armor_broken', 0.5);
    }
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
    if (story.latchboxRewardClaimed) return false;
    story.goblinEngineerResolved = true;

    const requestedChance = Number.isFinite(story.boxRepairChance) ? story.boxRepairChance : 50;
    // The engineer supplies a missing cog; the nest is no longer required.
    const chance = Math.max(0, Math.min(100, requestedChance));
    story.boxRepairChance = chance;
    const succeeded = Math.random() * 100 < chance;

    if (succeeded) {
      story.boxState = 'repaired';
      story.latchboxRewardClaimed = true;
      story.boxFollowing = false;
      this.expandInventorySlots(1);
      this.boxRepairOutcome = `${prelude}\n\nThe box takes the cog, clicks once, and unfolds a drawer from somewhere no drawer should fit. Then a second. Then a third.\n\nIt climbs into your pack and settles in like it has always been there.\n\nLoyal Latchbox: +1 inventory slot`;
      return true;
    }

    story.boxState = 'failed_repair';
    story.latchboxRewardClaimed = true;
    story.boxFollowing = false;
    this.gainCoins(12);
    this.gainCrystals(1);
    this.boxRepairOutcome = `${prelude}\n\nThe box swallows the cog. It clicks. It coughs smoke.\n\nThen it plays three flat notes, spits a handful of valuables at your feet, and refuses to look at you.`;
    return false;
  },

  addPotionToInventory() {
    const potion = new CardDataGenerator().createPotionCard(this.gameState?.currentFloor || 1);
    const added = this._addCardToInventory(potion);
    if (added) this._reward({ key: 'event.reward.gained', vars: { name: translateItemName(this, potion) || t(this, 'tooltip.potion') } });
    return added;
  },

  // ─── The Abandoned Camp ───────────────────────────────────────────────────

  /** The dead man's gear: one tier above what the floor usually deals. */
  campGearRarity() {
    const floor = this.gameState?.currentFloor || 1;
    if (floor >= 30) return 'epic';
    if (floor >= 15) return 'rare';
    return 'uncommon';
  },

  /** A hidden roll: with chance `fightChance` the player ends up in a fight. */
  rollCampFight(fightChance) {
    this.campFight = Math.random() < fightChance;
    if (this.campFight) {
      // No enemy list: the room deals whatever lives in this location.
      this.gameState.pendingAmbush = { id: 'abandoned_camp', normalCombatBoard: true };
    }
  },

  takeCampBackpack() {
    this.gainCoins(25);
    this.addPotionToInventory();
  },

  takeCampSword() {
    const sword = createWeaponCardData('sword', this.campGearRarity());
    return this._deliverCardReward(sword, sword?.name || 'Sword');
  },

  takeCampArmor() {
    const kinds = Object.keys(ARMORS);
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const armor = createArmorCardData(kind, this.campGearRarity());
    if (armor) applyArmorTalentMods(armor, this.gameState?.talentEffects);
    return this._deliverCardReward(armor, armor?.name || 'Armor');
  },

  // ─── The Soup Stand and the Robbed Traveller ─────────────────────────────

  /** The trap is still set: the traveller after you will fall for it. */
  queueRobbedTraveller() {
    this.ensureStoryState();
    this.gameState.storyRun.soupStandFloor = this.gameState.currentFloor || 1;
    this.addPendingEvent('robbed_traveller');
  },

  eatPoisonedSoup() {
    this.loseHealthCapped(12);
    this.gameState.addPlayerEffect?.({ type: 'poison', damage: 2, turns: 3, killedBy: 'Poisoned Soup' });
    const coins = Number.isFinite(this.gameState.coins) ? this.gameState.coins : 0;
    const stolen = Math.floor(coins * SOUP_ROBBERY_SHARE);
    if (stolen > 0) {
      this.gameState.coins = coins - stolen;
      this.gameScene?.updateUI?.();
      this._reward({ key: 'event.reward.coins', vars: { amount: `-${stolen}` } });
    }
    this.queueRobbedTraveller();
  },

  passSoupStand() {
    this.queueRobbedTraveller();
  },

  kickSoupPot() {
    this.ensureStoryState();
    this.gameState.storyRun.soupPotKicked = true;
    this.gainCoins?.(SOUP_STAND_PURSE);
  },

  hasAntidote() {
    return this._findInventoryIndex((item) => item?.id === 'antidote') >= 0;
  },

  /** The Antidote for the amulet sewn in his collar (any amulet if that one is owned). */
  saveRobbedTraveller() {
    this.ensureStoryState();
    this.clearPendingEvent('robbed_traveller');
    const index = this._findInventoryIndex((item) => item?.id === 'antidote');
    if (index >= 0) this._removeInventoryCard(index);
    this.gameState.storyRun.travellerSaved = true;
    const mgr = (this.gameScene || this.scene?.get?.('GameScene'))?.amuletManager;
    this.travellerPaid = mgr?.canAddAmulet?.(ROBBED_TRAVELLER_AMULET)
      ? Boolean(this.gainAmulet(ROBBED_TRAVELLER_AMULET))
      : Boolean(this.gainRandomAmulet());
  },

  leaveRobbedTraveller() {
    this.clearPendingEvent('robbed_traveller');
  },

  // ─── The Old Chute (the crystal spider you land on) ──────────────────────

  takeCrystalSpiderLeg() {
    return this.gainAmulet('spiderCrystalShard');
  },

  burnCrystalEggs() {
    this.consumeFireballCard();
    this.gainCrystals(1);
  },

  /** Crystals either way; with chance `fightChance` it wakes the hatchlings. */
  smashCrystalEggs(fightChance) {
    this.gainCrystals(3);
    this.chuteFight = Math.random() < fightChance;
    if (this.chuteFight) {
      this.gameState.pendingAmbush = { id: 'old_chute_hatchlings', normalCombatBoard: true, enemyTypes: ['spider'] };
    }
  },

  /** The nest is left to hatch: hatchlings turn up in fights for the rest of this act. */
  leaveCrystalBrood() {
    this.ensureStoryState();
    this.gameState.storyRun.crystalBroodAct = actOffsetForFloor(this.gameState.currentFloor || 1);
    this.gameState.storyRun.crystalBroodFloor = this.gameState.currentFloor || 1;
  },

  // The Webbed Corridor (webbed_corridor.js).
  hasSpareFood() {
    return this._findInventoryIndex((item) => item?.type === 'food' && item.id !== 'monsterEgg') >= 0;
  },

  cutWebbedCorridor() {
    this.gameState.pendingAmbush = { id: 'webbed_corridor', normalCombatBoard: true, enemyTypes: ['crystalHatchling'] };
  },

  climbRoundWebbedCorridor() {
    this.loseHealthCapped(CORRIDOR_ROUND_HP);
    this.gainCrystals(CORRIDOR_ROUND_CRYSTALS);
  },

  feedWebbedCorridor() {
    const index = this._findInventoryIndex((item) => item?.type === 'food' && item.id !== 'monsterEgg');
    if (index < 0) return;
    this._removeInventoryCard(index);
    this.gainCrystals(CORRIDOR_FED_CRYSTALS);
  },

  /** Hatches into the Crystal Spiderling companion after a few fights (eggHatching.js). */
  takeCrystalSpiderEgg() {
    const egg = {
      id: 'crystalSpiderEgg',
      type: 'junk',
      name: 'Crystal Spider Egg',
      sprite: 'crystalSpiderEgg',
      rarity: 'rare',
      description: 'Cold, and heavier than it looks. Something inside taps back.',
      noEffect: true,
      hatchFightsLeft: EGG_HATCH_FIGHTS,
    };
    return this._deliverCardReward(egg, egg.name);
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
    this._reward({ key: 'event.reward.spentCoins', vars: { amount } });
    return true;
  },

  buyCarnivalJunk(junkId) {
    this.markCarnivalHagMet();
    if (!this.spendCoins(1)) return false;
    const junk = this.createCarnivalJunkCard(junkId);
    const added = this._deliverCardReward(junk, junk.name || 'Carnival Junk', {
      key: 'event.reward.gainedJunk', vars: { name: translateItemName(this, junk) },
    });
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
      this._reward({ key: 'event.reward.cloverHint', vars: { name: translateItemName(this, 'Lucky Clover') } });
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
    const types = REROLL_CARD_TYPES;
    let type = types[Math.floor(Math.random() * types.length)];
    const rarityRoll = Math.random();
    const rarity = rarityRoll < 0.12 ? 'rare' : rarityRoll < 0.42 ? 'uncommon' : 'common';

    for (let tries = 0; tries < 8; tries++) {
      const targetRarity = RARITY_TYPES.includes(type) ? rarity : null;
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
      this.brassWizardOutcome = 'The brass hand jerks toward the deck — and stops.\n\nThen the mouth starts clicking. Slow at first. Then faster, louder, echoing in the booth like it is counting down to something.\n\nYou do not wait to find out what.';
      this._reward('event.reward.noReward');
      return true;
    }

    if (roll < 0.55) {
      const card = this.createRespectableCarnivalCard();
      this._deliverCardReward(card, card?.name || 'fortune card', {
        key: 'event.reward.gainedCard', vars: { name: translateItemName(this, card) || t(this, 'tooltip.card') },
      });
      this.brassWizardOutcome = 'The hand drags across the deck inside its chest. One card drops through the slot.\n\nIt is warm, as if the machine had been holding it for years.';
      return true;
    }

    if (roll < 0.80) {
      this.brassWizardOutcome = 'A wooden tray snaps out of the booth — exactly the size of a card.\n\nThe wizard\'s eyes tilt down toward your bag. It waits.';
      this._brassWizardTrayOpen = true;
      return true;
    }

    this.gainAmulet('fortuneCard');
    this.brassWizardOutcome = 'The eyes roll white. When they settle, they are a color no machine should have.\n\nHuman eyes. They hold on you a moment too long.\n\nThen the hand opens, and a single fortune card slides out.';
    return true;
  },

  getBrassWizardTrayChoices() {
    return [{
      text: 'Pull your hand back',
      textKey: 'ui.event.choice.pullBack',
      trayDecline: true,
      action: () => {},
      outcome: 'You step back. After a few seconds, the tray slides in by itself.'
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

    // Thorns have no variants — every thorns card is the same "Thorns Card" and
    // only the rarity moves — so a same-type reroll can only hand back what was
    // offered. Reroll the type instead and keep the rarity.
    if (type === 'thorns') return this.createOtherTypeRerollCard(oldCard);

    // Weapons and armor: another kind at exactly the offered rarity. Built
    // straight from the tables, the way a merge builds its card — the floor's
    // rarity caps used to refuse an epic, and after twelve misses the reroll
    // fell back to a healing potion.
    if (type === 'weapon' || type === 'armor') {
        const sameRarity = this.createOtherKindSameRarity(oldCard);
        if (sameRarity) return sameRarity;
    }

    const targetRarity = RARITY_TYPES.includes(type) ? rarity : null;

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

  // A weapon or armor of a different kind (sword for a dagger, plate for
  // leather) at the offered card's rarity; null if none exists at it.
  createOtherKindSameRarity(oldCard) {
    const isWeapon = oldCard?.type === 'weapon';
    const table = isWeapon ? WEAPONS : ARMORS;
    const rarity = oldCard?.rarity || 'common';
    const inv = this.gameScene?.inventorySystem;
    const oldKind = isWeapon
      ? (oldCard.weaponType || inv?.getWeaponTypeFromCard?.(oldCard))
      : (oldCard.armorType || inv?.getArmorTypeFromCard?.(oldCard));
    const kinds = Object.keys(table).filter((kind) => kind !== oldKind && table[kind]?.[rarity]);
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
    }
    for (const kind of kinds) {
      const card = isWeapon ? createWeaponCardData(kind, rarity) : createArmorCardData(kind, rarity);
      if (!card) continue;
      if (!isWeapon) applyArmorTalentMods(card, this.gameState?.talentEffects);
      card.carnivalTouched = true;
      return card;
    }
    return null;
  },

  // Reroll into a card of a *different* type, keeping the offering's rarity
  // where the target type has one. Used for types that can't reroll into a
  // meaningfully different card of their own kind.
  createOtherTypeRerollCard(oldCard) {
    const generator = new CardDataGenerator();
    const floor = this.gameState?.currentFloor || 1;
    const rarity = oldCard?.rarity || 'common';
    const types = REROLL_CARD_TYPES.filter(type => type !== oldCard?.type);

    for (let tries = 0; tries < 12; tries++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const targetRarity = RARITY_TYPES.includes(type) ? rarity : null;
      const card = generator.createCardData(type, floor, false, this.gameState, targetRarity);
      if (!card) continue;
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
    if (repaired > 0) this._reward({ key: 'event.reward.repaired', vars: { name: translateItemName(this, item) || t(this, 'tooltip.item'), amount: repaired } });
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

  // An event taking a card from the bag: it dissolves where it sits, the way a
  // spent weapon does, drawn on the event screen so it shows above the bag.
  _dissolveBagCard(index) {
    const card = this.gameScene?.inventorySystem?.slotSprites?.[index]?.card;
    if (card?.scene) playCardDissolve(this, card);
  },

  _removeInventoryCard(index) {
    const slots = this.getInventorySlots();
    if (!Array.isArray(slots) || index < 0 || index >= slots.length || !slots[index]) return false;

    this.gameScene = this.gameScene || this.scene?.get?.('GameScene');
    if (this.gameScene?.inventorySystem?.removeCard) {
      this._dissolveBagCard(index);
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

    if (this.gameScene?.inventorySystem?.slots === slots) this._dissolveBagCard(index);
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
      || item.sprite === resourceCardKey('key', 'rare');
  },

  _isPotionCard(item) {
    return item?.type === 'potion';
  },

  _isSacrificeCard(item) {
    return Boolean(
      item
      && item.type !== 'companion'
      && item.id !== 'monsterEgg'
      && !item.enchant // a Reliquary weapon is never "an unwanted spare card"
      && !isGauntlet(item) // nor is the thing you beat an ogre twice for
      && !this._isKeyCard(item)
      && !this._isPotionCard(item)
    );
  },

  _isScreamingHeadOfferCard(item) {
    // Keys, companions, one-off story items and Reliquary-enchanted weapons are
    // protected. Everything else in the bag is a fair offering, potions and gems
    // included. (Enchanted weapons are checked by `enchant` rather than by the
    // `unique` flag, because `unique` also blocks the Copying Mirror.)
    return Boolean(
      item
      && item.type !== 'companion'
      && item.id !== 'monsterEgg'
      && !item.unique
      && !item.enchant
      && !isGauntlet(item)
      && !this._isKeyCard(item)
    );
  },

  hasScreamingHeadOfferCard() {
    return this.getInventorySlots().some(item => this._isScreamingHeadOfferCard(item));
  },
};

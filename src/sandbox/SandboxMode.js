// Test Site helpers: pick any encounter from a hub, then return there when done.

import { EVENTS } from '../content/events/index.js';
import { getMagic } from '../content/cards/magic.js';
import { resolveMonthIndex } from '../content/months/calendar.js';

export const SANDBOX_HUB_KEY = 'SandboxHubScene';
export const SANDBOX_STORY_KEY = 'SandboxStoryScene';

// `label` is the English source and the fallback; `labelKey` is what the hub
// actually renders, so the Test Site translates like the rest of the game.
export const SANDBOX_ENCOUNTERS = [
  { id: 'COMBAT', label: 'Combat', labelKey: 'ui.sandbox.encounter.combat', kind: 'combat' },
  { id: 'ELITE', label: 'Elite Combat', labelKey: 'ui.sandbox.encounter.elite', kind: 'combat' },
  { id: 'BOSS', label: 'Boss', labelKey: 'ui.sandbox.encounter.boss', kind: 'combat' },
  { id: 'BOSS_REWARD', label: 'Boss Reward', labelKey: 'ui.sandbox.encounter.bossReward', kind: 'combat' },
  { id: 'SHOP', label: 'Shop', labelKey: 'ui.sandbox.encounter.shop', kind: 'station', sceneKey: 'ShopScene' },
  { id: 'RARE_SHOP', label: 'Rare Shop', labelKey: 'ui.sandbox.encounter.rareShop', kind: 'station', sceneKey: 'RareShopScene' },
  { id: 'REST', label: 'Rest', labelKey: 'ui.sandbox.encounter.rest', kind: 'station', sceneKey: 'RestScene' },
  { id: 'ANVIL', label: 'Anvil', labelKey: 'ui.sandbox.encounter.anvil', kind: 'station', sceneKey: 'AnvilScene' },
  { id: 'EVENT', label: 'Event (random)', labelKey: 'ui.sandbox.encounter.event', kind: 'station', sceneKey: 'EventScene' },
  { id: 'TREASURE', label: 'Treasure', labelKey: 'ui.sandbox.encounter.treasure', kind: 'station', sceneKey: 'TreasureScene', rewardMode: 'treasure' },
  { id: 'TREASURE_GOOD', label: 'Treasure (Good)', labelKey: 'ui.sandbox.encounter.treasureGood', kind: 'station', sceneKey: 'TreasureScene', rewardMode: 'good' },
  { id: 'TREASURE_ELITE', label: 'Elite Chest', labelKey: 'ui.sandbox.encounter.eliteChest', kind: 'station', sceneKey: 'TreasureScene', rewardMode: 'elite' },
];

const SANDBOX_FLOORS = {
  COMBAT: 8,
  ELITE: 12,
  BOSS: 15,
  BOSS_REWARD: 15,
  SHOP: 10,
  RARE_SHOP: 20,
  REST: 8,
  ANVIL: 10,
  EVENT: 6,
  TREASURE: 8,
  TREASURE_GOOD: 12,
  TREASURE_ELITE: 12,
};

const SCENE_KEYS_TO_STOP = [
  'GameScene',
  'MapViewScene',
  'ShopScene',
  'RareShopScene',
  'RestScene',
  'AnvilScene',
  'TreasureScene',
  'EventScene',
  'PauseMenuScene',
  SANDBOX_HUB_KEY,
  SANDBOX_STORY_KEY,
];

export function isSandboxMode(ref) {
  if (!ref) return false;
  if (ref.sandboxMode) return true;
  if (ref.gameState?.sandboxMode) return true;
  const gameScene = typeof ref.scene?.get === 'function' ? ref.scene.get('GameScene') : null;
  return Boolean(gameScene?.sandboxMode || gameScene?.gameState?.sandboxMode);
}

export function getSandboxEncounter(id) {
  return SANDBOX_ENCOUNTERS.find((entry) => entry.id === id) || null;
}

// Every story, straight from the content pack, so a newly written event shows
// up in the Test Site without anyone remembering to register it twice.
export function getSandboxStories() {
  return EVENTS.map((event) => ({
    id: event.id,
    label: event.title || event.id,
  }));
}

// The Test Site forces a story regardless of what has been seen, but forcing
// alone is not always enough: several events only have anything to show once
// their prerequisites exist. Without this, opening the Goblin Engineer from the
// menu would render a room where every choice is hidden by its condition.
//
// `story` is merged into storyRun; `grant` names inventory the event looks for.
// Anything not listed here needs no setup — the sandbox loadout already hands
// out unenchanted rare weapons and 999 coins, which is all most events check.
const SANDBOX_STORY_SETUP = {
  // Third choice (Open it carefully) needs a key card in the bag.
  broken_music_box: {
    grant: ['key'],
  },
  // Nest copy and cog prize assume the box survived the opener.
  monster_bird_nest: {
    story: { boxState: 'opened', boxFollowing: true },
  },
  // Needs the cog recovered from the bird nest, or both repair choices hide.
  goblin_engineer: {
    story: { boxState: 'has_cog', boxHasCog: true, boxFollowing: true },
  },
  // Only fires with the engineer behind you and an egg still uneaten.
  hatching_egg: {
    story: { goblinEngineerResolved: true, chickHatched: false },
    grant: ['egg'],
  },
  // The wizard is the carnival's follow-up, so the carnival must have happened.
  brass_wizard: {
    story: { carnivalVisited: true, carnivalHagMet: true },
  },
  // Offers to promote a companion that has fought beside you a while.
  old_drill_room: {
    grant: ['veteranCompanion'],
  },
  // Burn choice needs a Fireball scroll; pin Silkdeep so hatched enemies match.
  silk_cocoon_cache: {
    grant: ['fireball'],
    monthId: 'silkdeep',
  },
};

// Give the story a clean slate: nothing seen, nothing pending. This is what
// makes a story testable more than once — the live run never consults saved
// progress in the Test Site, so a story you finished months ago still opens.
export function applySandboxStorySetup(gameScene, eventId) {
  const gs = gameScene?.gameState;
  if (!gs?.storyRun) return;

  gs.sandboxEventId = eventId;

  const setup = SANDBOX_STORY_SETUP[eventId];
  if (!setup) return;

  if (setup.story) Object.assign(gs.storyRun, setup.story);
  if (setup.monthId) {
    gs.calendarMonthIndex = resolveMonthIndex(setup.monthId);
    gs.pinCalendarMonth = true;
  }
  for (const grant of setup.grant || []) {
    grantSandboxStoryItem(gameScene, grant);
  }

  gameScene.inventorySystem?.rebuildInventorySprites?.();
  gameScene.updateUI?.();
}

function grantSandboxStoryItem(gameScene, grant) {
  const gs = gameScene.gameState;
  const inv = gameScene.inventorySystem;
  const gen = gameScene.cardSystem?.cardDataGenerator;
  if (!inv || !gen) return;

  if (grant === 'key') {
    const key = gen.createKeyCard?.(gs.currentFloor || 1);
    if (key) inv.addCard(key);
    return;
  }

  if (grant === 'egg') {
    const egg = gen.createEggCard?.();
    if (egg) inv.addCard(egg);
    return;
  }

  if (grant === 'fireball') {
    const def = getMagic('fireball');
    inv.addCard({
      type: 'magic',
      magicType: 'fireball',
      name: def?.name || 'Fireball',
      description: def?.description || 'Deals 15 damage to a single enemy',
      rarity: def?.rarity || 'uncommon',
      sprite: def?.sprite || 'fireBall',
      damage: def?.damage ?? 15,
    });
    return;
  }

  if (grant === 'veteranCompanion') {
    const companion = gen.createChickCompanionCard?.();
    if (!companion) return;
    inv.addCard(companion);
    // The drill room only offers companions with real service behind them:
    // three rooms fought and not already upgraded.
    if (!gs.companionHistory || typeof gs.companionHistory !== 'object') {
      gs.companionHistory = {};
    }
    gs.companionHistory[companion.id] = { roomsFought: 3, upgraded: false };
  }
}

export function applySandboxLoadout(gameScene, roomId) {
  const gs = gameScene?.gameState;
  const inv = gameScene?.inventorySystem;
  const gen = gameScene?.cardSystem?.cardDataGenerator;
  if (!gs || !inv || !gen) return;

  gs.sandboxMode = true;
  gs.currentFloor = SANDBOX_FLOORS[roomId] || 10;
  gs.coins = Math.max(gs.coins || 0, 999);
  gs.crystals = Math.max(gs.crystals || 0, 99);
  gs.playerHealth = gs.maxHealth;
  gs.actionsLeft = gs.maxActions;
  gs.startingCardsGranted = true;
  gs.pendingActShop = null;

  // Clear bag so each encounter starts from a known kit.
  for (let i = 0; i < inv.slots.length; i++) inv.slots[i] = null;
  gs.inventory = inv.slots;
  gs.equippedWeapon = null;
  gs.equippedArmor = null;

  const floor = gs.currentFloor;
  const weapon = gen.createCardData('weapon', floor, false, null, 'rare');
  const armor = gen.createCardData('armor', floor, false, null, 'rare');
  const spare = gen.createCardData('weapon', floor, false, null, 'uncommon');

  if (weapon) {
    weapon.durability = Math.max(3, Math.floor((weapon.maxDurability || 12) * 0.45));
    weapon.maxDurability = weapon.maxDurability || weapon.durability;
    inv.addCard(weapon);
  }
  if (spare) {
    spare.durability = spare.maxDurability || 12;
    inv.addCard(spare);
  }
  if (armor) {
    armor.durability = Math.max(3, Math.floor((armor.maxDurability || 12) * 0.55));
    armor.maxDurability = armor.maxDurability || armor.durability;
    gs.equippedArmor = armor;
  }

  inv.rebuildInventorySprites?.();
  gameScene.updateEquippedArmorPanel?.();
  gameScene.updateUI?.();
}

export function exitToSandboxHub(fromScene) {
  if (!fromScene?.scene) return;
  const manager = fromScene.scene;

  // Read this before the teardown below drops the scenes holding it: a story
  // launched from the picker returns to the picker, so testing the same story
  // twice in a row is two clicks instead of four.
  const gameScene = typeof manager.get === 'function' ? manager.get('GameScene') : null;
  const storyId = fromScene.gameState?.sandboxEventId || gameScene?.gameState?.sandboxEventId || null;

  for (const key of SCENE_KEYS_TO_STOP) {
    try {
      if (manager.get(key)) manager.stop(key);
    } catch (_) { /* scene may already be gone */ }
  }

  if (storyId) {
    manager.start(SANDBOX_STORY_KEY);
    return;
  }
  manager.start(SANDBOX_HUB_KEY);
}

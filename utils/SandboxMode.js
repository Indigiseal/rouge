// Test-polygon helpers: pick any encounter from a hub, then return there when done.

export const SANDBOX_HUB_KEY = 'SandboxHubScene';

export const SANDBOX_ENCOUNTERS = [
  { id: 'COMBAT', label: 'Combat', kind: 'combat' },
  { id: 'ELITE', label: 'Elite Combat', kind: 'combat' },
  { id: 'BOSS', label: 'Boss', kind: 'combat' },
  { id: 'BOSS_REWARD', label: 'Boss Reward', kind: 'combat' },
  { id: 'SHOP', label: 'Shop', kind: 'station', sceneKey: 'ShopScene' },
  { id: 'RARE_SHOP', label: 'Rare Shop', kind: 'station', sceneKey: 'RareShopScene' },
  { id: 'REST', label: 'Rest', kind: 'station', sceneKey: 'RestScene' },
  { id: 'ANVIL', label: 'Anvil', kind: 'station', sceneKey: 'AnvilScene' },
  { id: 'EVENT', label: 'Event', kind: 'station', sceneKey: 'EventScene' },
  { id: 'TREASURE', label: 'Treasure', kind: 'station', sceneKey: 'TreasureScene', rewardMode: 'treasure' },
  { id: 'TREASURE_GOOD', label: 'Treasure (Good)', kind: 'station', sceneKey: 'TreasureScene', rewardMode: 'good' },
  { id: 'TREASURE_ELITE', label: 'Elite Chest', kind: 'station', sceneKey: 'TreasureScene', rewardMode: 'elite' },
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
  for (const key of SCENE_KEYS_TO_STOP) {
    try {
      if (manager.get(key)) manager.stop(key);
    } catch (_) { /* scene may already be gone */ }
  }
  manager.start(SANDBOX_HUB_KEY);
}

import assert from 'node:assert/strict';
import { MockScene } from '../sim/mock.js';
import { GameState } from '../src/systems/GameState.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { InventorySystem } from '../src/systems/InventorySystem.js';
import { AmuletManager } from '../src/managers/AmuletManager.js';
import { SaveManager } from '../src/managers/SaveManager.js';
import { AMULETS, createWeaponCardData, createArmorCardData, POTIONS, FOOD } from '../src/content/cards/index.js';

globalThis.Phaser.Scene = class {};
const { GameScene } = await import('../src/scenes/GameScene.js');

function fixture(cards = [], owned = true) {
    const scene = new MockScene();
    scene.gameState = new GameState(scene);
    scene.gameState.playerHealth = 37;
    scene.gameState.maxHealth = 100;
    scene.gameState.activeAmulets = owned ? [{ id: 'mossyStone', level: 1 }] : [];
    scene.cardSystem = new CardSystem(scene);
    scene.amuletManager = new AmuletManager(scene);
    const inv = Object.create(InventorySystem.prototype);
    Object.assign(inv, {
        scene, slots: [...cards, null, null, null], slotSprites: [], stationMode: false,
        cleanupCardSprites() {}, hideCardTooltip() {}, rebuildInventorySprites() {},
        updateTwinkleEffects() {}, returnCardToSlot() {}, createInventoryUI() {},
    });
    scene.inventorySystem = inv;
    inv.syncGameStateInventory();
    return scene;
}
const sword = () => createWeaponCardData('sword', 'common');
const armor = () => createArmorCardData('leather', 'common');
const entry = AMULETS.find(item => item.id === 'mossyStone');
assert.equal(entry.name, 'Mossy Stone');
assert.equal(entry.originLocationId, 'mireturn');
assert.equal(entry.rarity, 'uncommon');

// All actual merge families share the reward. Preview construction is pure.
for (const source of [sword(), armor(), { ...POTIONS[0], type: 'potion' },
    { ...FOOD[0], type: 'food' },
    { type: 'thorns', name: 'Thorns Card', rarity: 'common', thornDamage: 1, durability: 6, maxDurability: 6 }]) {
    const scene = fixture([{ ...source }, { ...source }]);
    const inv = scene.inventorySystem;
    assert.ok(inv.canCardsMerge(inv.slots[0], inv.slots[1]), source.type);
    inv.createMergedCard(inv.slots[0], inv.slots[1]);
    assert.equal(scene.gameState.maxHealth, 100, 'previews never grant health');
    inv.mergeCards(0, 1, null);
    assert.equal(scene.gameState.maxHealth, 101, `${source.type} merge rewards exactly once`);
    assert.equal(scene.gameState.playerHealth, 37, 'merging does not heal');
    assert.equal(scene.gameState.mossyMaxHpGained, 1);
    assert.equal(inv.slots.filter(Boolean).length, 1);
}

{
    const scene = fixture([armor()]);
    scene.gameState.equippedArmor = armor();
    assert.equal(scene.inventorySystem.tryMergeWithEquippedArmor(0), true);
    assert.equal(scene.gameState.maxHealth, 101);
    assert.equal(scene.gameState.playerHealth, 37);
    assert.equal(scene.gameState.mossyMaxHpGained, 1);
    assert.equal(scene.gameState.equippedArmor.rarity, 'uncommon');
    assert.equal(scene.inventorySystem.tryMergeWithEquippedArmor(0), false);
    assert.equal(scene.gameState.maxHealth, 101, 'repeated callback cannot reward an emptied slot');
}

{
    const scene = fixture([sword(), createWeaponCardData('sword', 'uncommon')]);
    scene.inventorySystem.mergeCards(0, 1, null);
    assert.equal(scene.gameState.maxHealth, 100, 'failed merge awards nothing');
    assert.equal(scene.gameState.mossyMaxHpGained, 0);
    const other = fixture([sword(), sword()], false);
    other.inventorySystem.mergeCards(0, 1, null);
    assert.equal(other.gameState.maxHealth, 100, 'merging without the amulet grants nothing');
}

{
    const scene = fixture();
    const gs = scene.gameState;
    // The shared committed-merge hook is also used by the simulator.
    for (let i = 0; i < 60; i++) scene.amuletManager.processCardMerge();
    assert.equal(gs.maxHealth, 150);
    assert.equal(gs.mossyMaxHpGained, 50);
    assert.equal(gs.playerHealth, 37);
    scene.amuletManager.removeAmulet('mossyStone', { silent: true });
    assert.equal(gs.maxHealth, 150, 'earned maximum HP remains after removal');
    assert.equal(scene.amuletManager.processCardMerge(), 0);
    scene.amuletManager.addAmulet('mossyStone', { force: true });
    assert.equal(gs.maxHealth, 150, 'equipping never replays earned growth');
    assert.equal(scene.amuletManager.processCardMerge(), 0, 're-equipping does not reset the cap');
}

{
    const scene = fixture();
    const gs = scene.gameState;
    for (let i = 0; i < 49; i++) scene.amuletManager.processCardMerge();
    scene.saveManager = new SaveManager();
    scene.saveManager.saveCurrentRun(gs, scene.inventorySystem, scene.cardSystem);
    gs.maxHealth = 1;
    gs.mossyMaxHpGained = 0;
    assert.equal(GameScene.prototype.loadCurrentRun.call(scene), true);
    assert.equal(gs.maxHealth, 149);
    assert.equal(gs.mossyMaxHpGained, 49, 'actual Continue restores cap usage');
    assert.equal(gs.playerHealth, 37);
    assert.equal(scene.amuletManager.processCardMerge(), 1);
    assert.equal(gs.maxHealth, 150);
    assert.equal(scene.amuletManager.processCardMerge(), 0);
    assert.equal(gs.playerHealth, 37);
    delete gs.mossyMaxHpGained;
    scene.saveManager.saveCurrentRun(gs, scene.inventorySystem, scene.cardSystem);
    assert.equal(scene.saveManager.loadCurrentRun().player.mossyMaxHpGained, 0, 'older runs default safely to zero');
    gs.playerHealth = 0;
    assert.equal(scene.amuletManager.processCardMerge(), 0, 'merging cannot revive a dead player');
}
console.log('Mossy Stone checks passed: every merge family, worn armor, preview/failure exclusions, no healing, +50 run cap, removal, re-equip and actual Continue.');

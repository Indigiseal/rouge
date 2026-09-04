import assert from 'node:assert/strict';

import { humanRunRecorder } from '../src/systems/HumanRunRecorder.js';
import { InventorySystem } from '../src/systems/InventorySystem.js';
import { CombatTurnController } from '../src/systems/combat/CombatTurnController.js';
import { CardMergeRules } from '../src/systems/inventory/CardMergeRules.js';
import { InventoryView } from '../src/systems/inventory/InventoryView.js';

function makeHarness(cards) {
    const gameState = {
        actionsLeft: 10,
        bonusInventorySlots: 0,
        characterId: 'rogue',
        coins: 0,
        crystals: 0,
        currentFloor: 1,
        equippedArmor: null,
        inventory: cards,
        maxActions: 15,
        maxHealth: 100,
        playerHealth: 100,
        roomType: 'COMBAT',
    };
    const scene = {
        amuletManager: {
            canCrossTierMerge: () => false,
            processCardReward: () => {},
        },
        cardSystem: {
            playMergeEffect: () => {},
            respawnCardOnBoard: () => {},
        },
        createFloatingText: () => {},
        events: { emit: () => {} },
        game: { globalVolume: { master: 1, music: 1, sfx: 1 } },
        gameState,
        playerAvatar: { x: 0, y: 0 },
        scene: { key: 'GameScene', get: () => scene },
        sound: null,
        updateUI: () => {},
        useAction: () => true,
    };
    const inventory = Object.create(InventorySystem.prototype);
    Object.assign(inventory, {
        scene,
        slots: cards,
        slotSprites: cards.map(() => null),
        stationMode: false,
        cleanupCardSprites: () => {},
        hideCardTooltip: () => {},
        rebuildInventorySprites: () => {},
        updateTwinkleEffects: () => {},
    });
    scene.inventorySystem = inventory;
    inventory.syncGameStateInventory();
    return { gameState, inventory, scene };
}

function eventTypes() {
    return JSON.parse(humanRunRecorder.exportJson()).events.map((event) => event.type);
}

{
    const stackedGemWeapon = {
        type: 'weapon',
        name: 'Rare Dagger',
        rarity: 'rare',
        weaponType: 'dagger',
        gemEffect: 'poison',
        gemCount: 2,
    };
    const legacyGemWeapon = {
        type: 'weapon',
        name: 'Common Bow',
        rarity: 'common',
        weaponType: 'bow',
        gemEffect: 'fire',
    };

    assert.equal(humanRunRecorder.snapshotCard(stackedGemWeapon).gemCount, 2);
    assert.equal(humanRunRecorder.snapshotCard(legacyGemWeapon).gemCount, 1);
}

{
    const scene = {
        cardSystem: { createCardData: () => null },
        createFloatingText: () => {},
        gameState: { currentFloor: 20 },
    };
    const rules = Object.create(CardMergeRules);
    rules.scene = scene;
    const mirrorWeapon = {
        type: 'weapon',
        name: 'Rare Dagger',
        rarity: 'rare',
        weaponType: 'dagger',
        gemEffect: 'fire',
        gemName: 'Fire Gem',
        gemColor: 0xff7040,
        gemCount: 2,
    };

    // A mirror duplicates this exact card; merging the pair creates an Epic.
    // Its four combined gems fit the Epic weapon's four sockets.
    const merged = rules.createMergedCard(mirrorWeapon, { ...mirrorWeapon });
    assert.equal(merged.rarity, 'epic');
    assert.equal(merged.gemCount, 4);
}

{
    const armor = {
        type: 'armor',
        name: 'Common Leather Armor',
        rarity: 'common',
        armorType: 'leather',
        durability: 15,
        maxDurability: 15,
    };
    const { gameState, inventory, scene } = makeHarness([armor, null, null, null, null]);
    humanRunRecorder.start(scene);

    assert.equal(inventory.equipArmor(0), true);
    assert.equal(inventory.slots[0], null);
    assert.equal(gameState.equippedArmor, armor);
    assert.deepEqual(
        eventTypes().filter((type) => type !== 'recording_started'),
        ['inventory_slot_emptied', 'armor_equipped'],
    );
}

{
    const daggerA = {
        type: 'weapon',
        name: 'Common Dagger',
        rarity: 'common',
        weaponType: 'dagger',
        damage: 3,
        durability: 1,
        maxDurability: 4,
    };
    const daggerB = {
        ...daggerA,
        durability: 4,
    };
    const { inventory, scene } = makeHarness([daggerA, daggerB, null, null, null]);
    inventory.createMergedCard = () => ({
        ...daggerA,
        name: 'Uncommon Dagger',
        rarity: 'uncommon',
        damage: 5,
        durability: 6,
        maxDurability: 6,
    });
    humanRunRecorder.start(scene);

    inventory.mergeCards(0, 1, null);
    assert.equal(inventory.slots.filter(Boolean).length, 1);
    assert.equal(inventory.slots[0].name, 'Uncommon Dagger');
    assert.deepEqual(
        eventTypes().filter((type) => type !== 'recording_started'),
        [
            'inventory_slot_emptied',
            'inventory_slot_emptied',
            'inventory_slot_filled',
            'cards_merged',
        ],
    );
}

{
    const scene = {
        cache: { audio: { exists: () => false } },
        cardSystem: { processEnemyPoisonEffects: () => {} },
        createFloatingText: () => {},
        game: { globalVolume: { master: 1, sfx: 1 } },
        gameState: {
            magicShield: null,
            playerEffects: [{ type: 'poison', damage: 2, turns: 2, killedBy: 'Spider' }],
            playerHealth: 1,
            shadowBlade: null,
            takeDamage(amount) {
                this.playerHealth = Math.max(0, this.playerHealth - amount);
                return { actualDamage: amount };
            },
        },
        playerAvatar: { x: 0, y: 0 },
        sound: { play: () => {} },
        updateUI: () => {},
    };

    const turns = new CombatTurnController(scene);
    turns.finishEnemyTurnEffects({ runCompanions: false });
    assert.equal(scene.gameState.playerHealth, 0);
    assert.equal(scene.killedBy, 'Poison');
}

{
    const listeners = new Map();
    let queuedRelease = null;
    const releaseTarget = {
        addEventListener(type, handler) { listeners.set(type, handler); },
        queueMicrotask(handler) { queuedRelease = handler; },
        removeEventListener(type, handler) {
            if (listeners.get(type) === handler) listeners.delete(type);
        },
    };
    let onShutdown = null;
    let drops = 0;
    let lastDropOutcome = null;
    let forcedDragResets = 0;
    const boardSprite = { input: { enabled: true } };
    const cardSprite = {
        scene: {},
        x: 230,
        y: 309,
        input: { dragState: 2 },
        clearTint() {},
        getData(key) {
            if (key === 'originalX') return 230;
            if (key === 'originalY') return 309;
            return undefined;
        },
        setData() {},
    };
    const inventory = Object.create(InventoryView);
    Object.assign(inventory, {
        scene: {
            cardSystem: { boardCards: [{ sprite: boardSprite }] },
            cameras: {
                main: { getWorldPoint: (canvasX, canvasY) => ({ x: canvasX / 2, y: canvasY / 2 }) },
            },
            events: { once(type, handler) { if (type === 'shutdown') onShutdown = handler; } },
            game: { canvas: { ownerDocument: { defaultView: releaseTarget } } },
            scale: {
                transformX: (clientX) => clientX,
                transformY: (clientY) => clientY,
            },
            input: {
                activePointer: { id: 0 },
                _drag: { 0: [cardSprite] },
                getDragState: () => 2,
                setDragState: () => { forcedDragResets++; },
            },
        },
        slotSprites: [{
            shadow: { setAlpha() {} },
            twinkleSprite: { setDepth() {} },
        }],
        applySlotVisualDepths() {},
        destroyDragOverlay() {},
        destroyFireReachIndicator() {},
        getInventoryDepths: () => ({ twinkle: 16 }),
        handleCardDrop: (_slotIndex, sprite) => {
            drops++;
            if (sprite.x >= 560 && sprite.y >= 270) lastDropOutcome = 'discard';
            else if (sprite.y < 280) lastDropOutcome = 'attack';
            else lastDropOutcome = 'return';
        },
        returnCardToSlot() {},
    });

    inventory.bindInventoryDragRelease();
    assert.equal(typeof listeners.get('pointerup'), 'function');

    inventory.beginInventoryCardDrag(0, cardSprite);
    assert.equal(boardSprite.input.enabled, false);
    listeners.get('pointerup')({ type: 'pointerup', clientX: 700, clientY: 290 });
    assert.equal(drops, 0);
    queuedRelease();
    assert.equal(drops, 1);
    assert.equal(cardSprite.x, 350);
    assert.equal(cardSprite.y, 145);
    assert.equal(lastDropOutcome, 'attack');
    assert.equal(boardSprite.input.enabled, true);
    assert.equal(forcedDragResets, 1);
    assert.equal(cardSprite.input.dragState, 0);
    assert.equal(inventory.scene.input._drag[0].length, 0);

    // A late Phaser dragend for a fallback-completed release is harmless.
    assert.equal(inventory.finishInventoryCardDrag(0, cardSprite), false);
    assert.equal(drops, 1);

    // On the normal path, Phaser wins before the queued fallback and owns its
    // bookkeeping. The queued callback then observes no live drag.
    inventory.beginInventoryCardDrag(0, cardSprite);
    listeners.get('pointerup')({ type: 'pointerup', clientX: 1000, clientY: 600 });
    cardSprite.x = 123;
    cardSprite.y = 45;
    assert.equal(inventory.finishInventoryCardDrag(0, cardSprite), true);
    queuedRelease();
    assert.equal(drops, 2);
    assert.equal(cardSprite.x, 123);
    assert.equal(cardSprite.y, 45);
    assert.equal(forcedDragResets, 1);

    // A cancelled pointer must never resolve a drop at a stale position.
    inventory.beginInventoryCardDrag(0, cardSprite);
    cardSprite.x = 600;
    cardSprite.y = 310;
    listeners.get('pointercancel')({ type: 'pointercancel', clientX: 1200, clientY: 620 });
    queuedRelease();
    assert.equal(drops, 3);
    assert.equal(cardSprite.x, 230);
    assert.equal(cardSprite.y, 309);
    assert.equal(lastDropOutcome, 'return');
    assert.equal(forcedDragResets, 2);

    onShutdown();
    assert.equal(listeners.size, 0);
}

console.log('Inventory, trace fidelity, and delayed poison death checks passed.');

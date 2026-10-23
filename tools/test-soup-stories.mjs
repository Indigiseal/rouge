import assert from 'node:assert/strict';
globalThis.Phaser ??= { Scene: class {}, Math: {}, Geom: {}, Display: {}, GameObjects: {} };
const { EventRunHelpers } = await import('../src/systems/events/EventRunHelpers.js');
const { default: soupStand } = await import('../src/content/events/soup_stand.js');
const { default: traveller } = await import('../src/content/events/robbed_traveller.js');
const { default: crossroads } = await import('../src/content/events/quiet_crossroads.js');
const { default: mirrorTwin } = await import('../src/content/events/mirror_twin.js');
const { HIDDEN_PATH_SOURCES } = await import('../src/map/HiddenPaths.js');
const { AMULET_DROP_DATA } = await import('../src/content/cards/amulets.js');
const { enemyDeathSoundKeys } = await import('../src/content/audio/enemyDeathSounds.js');
const { buildEnemyCardFromDef } = await import('../src/content/cards/enemies.js');

const ids = (event) => event.choices.map((c) => c.id || c.text);
const fakeScene = (extra = {}) => {
    const scene = {
        ...EventRunHelpers,
        gameState: { currentFloor: 5, coins: 10, storyRun: {}, pendingEvents: [] },
        ensureStoryState() {}, addPendingEvent(id) { this.queued = id; }, clearPendingEvent(id) { this.cleared = id; },
        gainCoins(n) { this.coins = (this.coins || 0) + n; },
        _findInventoryIndex: () => 0, _removeInventoryCard() { this.removed = true; },
        ...extra,
    };
    return scene;
};

// Soup Stand: waiting hides, queues the traveller, and deals the gang.
assert.ok(ids(soupStand).includes('soup_wait'));
assert.ok(!ids(soupStand).includes('soup_taste'), 'no taste-a-spoonful choice');
const wait = fakeScene();
soupStand.choices.find((c) => c.id === 'soup_wait').action({}, wait);
assert.equal(wait.queued, 'robbed_traveller');
const ambush = wait.gameState.pendingAmbush;
assert.equal(ambush.normalCombatBoard, true);
assert.deepEqual(ambush.enemyTypes, ['robberCook', 'robberMuscle', 'robberLookout']);
for (const type of ambush.enemyTypes) assert.ok(buildEnemyCardFromDef(type, 5), `${type} can be built`);
for (const type of ambush.enemyTypes) assert.ok(enemyDeathSoundKeys({ enemyType: type }).length, `${type} has a death sound`);

// Robbed Traveller: the new ways out, and the old ones kept.
for (const id of ['traveller_antidote', 'traveller_restoration', 'traveller_ask', 'traveller_food', 'traveller_search', 'traveller_leave']) {
    assert.ok(ids(traveller).includes(id), id);
}
const search = fakeScene();
traveller.choices.find((c) => c.id === 'traveller_search').action({}, search);
assert.equal(search.coins, 20);
assert.equal(search.cleared, 'robbed_traveller');
const food = fakeScene();
traveller.choices.find((c) => c.id === 'traveller_food').action({}, food);
assert.equal(food.coins, 15); assert.equal(food.removed, true);
assert.equal(traveller.choices.find((c) => c.id === 'traveller_food').condition({}, { hasSpareFood: () => false }), false);
assert.ok(HIDDEN_PATH_SOURCES.robberStash && HIDDEN_PATH_SOURCES.crossroadsWall, 'the stash and the wall map are hidden path sources');

// The Alchemist's Bag is his alone.
assert.ok(!AMULET_DROP_DATA.some((a) => a.id === 'alchemistBag'), 'not a random drop');

// Short stories, no wet noises, the whoosh.
const all = JSON.stringify([soupStand.choices, traveller.choices, crossroads.choices, mirrorTwin.choices, mirrorTwin.description]);
assert.ok(!/Shlup|slurp/i.test(all));
assert.ok(mirrorTwin.choices.find((c) => c.id === 'mirror_twin_hand_mirror').outcome.includes('Whoosh.'));
assert.deepEqual(crossroads.choices.map((c) => c.text), ['Pick up the coins', 'Rest in the alcove', 'Read the scratches on the wall', 'Leave']);

// On a real map, both new sources add a secret room in each act still to come.
const { MapGenerator } = await import('../src/map/MapGenerator.js');
const { revealHiddenPaths } = await import('../src/map/HiddenPaths.js');
for (const source of ['robberStash', 'crossroadsWall']) {
    const gs = { currentFloor: 3, storyRun: {}, activeAmulets: [], mapCursor: { act: 1, floor: 2, node: 3 },
        dungeonMap: new MapGenerator().generateFullMap(['tollroad', 'thornwake', 'silkdeep']) };
    const added = revealHiddenPaths(gs, source);
    assert.ok(added >= 1, `${source} adds a secret room`);
    const rooms = Object.values(gs.dungeonMap).flatMap((act) => (act?.floors || []).flat())
        .filter((node) => node?.secret && node.secretSource === source);
    assert.ok(rooms.length >= 1 && rooms.every((node) => node.type === 'TREASURE_GOOD' || node.roomType === 'TREASURE_GOOD'), `${source} leads to a good chest`);
}

console.log('Soup stories checks passed: ambush, traveller choices, hidden paths, bag exclusive, Mirror Twin, Crossroads.');

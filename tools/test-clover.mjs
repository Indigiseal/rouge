import assert from 'node:assert/strict';
globalThis.Phaser ??= { Scene: class {}, Math: {}, Geom: {}, Display: {}, GameObjects: {} };
const { InventorySystem } = await import('../src/systems/InventorySystem.js');
const { EventRunHelpers } = await import('../src/systems/events/EventRunHelpers.js');
const { SoundHelper } = await import('../src/audio/SoundHelper.js');

const pickup = { type: 'amuletPickup', id: 'luckyCloverPickup', amuletId: 'luckyClover', name: 'Lucky Clover' };
const makeInventory = ({ worn = false } = {}) => {
    const log = [];
    const worn_ = new Set(worn ? ['luckyClover'] : []);
    const card = { destroyed: false, destroy() { this.destroyed = true; } };
    const inv = Object.create(InventorySystem.prototype);
    Object.assign(inv, {
        slots: [null, { ...pickup }], slotSprites: [{}, { background: { x: 120, y: 300 }, card }],
        scene: { updateUI: () => log.push('updateUI'), amuletManager: {
            amuletDefinitions: { luckyClover: {} }, hasAmulet: (id) => worn_.has(id), addAmulet: (id) => { worn_.add(id); log.push(`worn ${id}`); return true; } } },
        cleanupCardSprites: () => log.push('cleanup'),
        removeCard(i, destroy, why) { this.slots[i] = null; log.push(`remove ${i} ${destroy} ${why}`); },
    });
    return { inv, log, card };
};

// The clover leaves the bag for the amulet bar, once, with the slot's position to fly from.
{
    const { inv, log, card } = makeInventory();
    const taken = inv.takeAmuletPickupFromBag(1);
    assert.deepEqual(taken, { id: 'luckyClover', x: 120, y: 300 });
    assert.ok(log.includes('worn luckyClover') && log.includes('remove 1 false amulet_equipped') && log.includes('updateUI'));
    assert.equal(inv.slots[1], null);
    assert.equal(card.destroyed, true);
    assert.equal(inv.takeAmuletPickupFromBag(1), null, 'nothing left to take');
}
// Already worn: it stays in the bag as a card, untouched.
{
    const { inv } = makeInventory({ worn: true });
    assert.equal(inv.takeAmuletPickupFromBag(1), null);
    assert.equal(inv.slots[1].type, 'amuletPickup');
}
// A card that is not an amulet pickup is left alone.
{
    const { inv } = makeInventory();
    inv.slots[1] = { type: 'weapon' };
    assert.equal(inv.takeAmuletPickupFromBag(1), null);
}

// The morph hands over when it is skipped (no clover art), so the amulet is never stranded.
{
    const inv = Object.create(InventorySystem.prototype);
    inv.slotSprites = [{}]; inv.scene = { textures: { exists: () => false } };
    let done = 0;
    inv.playCloverMorph(0, 650, (slot) => { done += slot + 1; });
    assert.equal(done, 1);
}

// Buying it: delivered to the bag with a hand-over, no "tap it later" hint, and the regular amulet sound on its way out.
{
    const played = [];
    const realPlay = SoundHelper.playSound;
    SoundHelper.playSound = (_scene, key) => played.push(key);
    try {
        let handover = null, iconAsked = null, delayed = [];
        const { inv } = makeInventory();
        inv.deliverCloverAmulet = (cb) => { handover = cb; return 1; };
        inv.takeAmuletPickupFromBag = (i) => ({ id: 'luckyClover', x: 120, y: 300, from: i });
        const rewards = [];
        const scene = Object.assign(Object.create(EventRunHelpers), {
            gameScene: { inventorySystem: inv, updateUI() {}, findAmuletIcon: (id) => { iconAsked = id; return null; } },
            markCarnivalHagMet() {}, spendCoins: () => true, addPendingEvent() {}, _pushRewardIcon() {},
            _reward: (r) => rewards.push(r.key), time: { delayedCall: (_ms, fn) => delayed.push(fn) },
            scene: { isActive: () => true, get: () => ({ findAmuletIcon: (id) => { iconAsked = id; return null; } }) },
        });
        assert.equal(scene.buyLuckyClover(), true);
        assert.deepEqual(rewards, ['event.reward.gainedAmulet'], 'the same "gained" line as every amulet');
        assert.equal(typeof handover, 'function');
        handover(1);
        delayed.forEach((fn) => fn());
        assert.deepEqual(played, ['shop_buy'], 'the sound the shop and the boss reward use, not the crystal one');
        assert.equal(iconAsked, 'luckyClover', 'it flies to the clover icon on the bar');
        // If the event has already closed, it is still worn but nothing plays.
        played.length = 0; iconAsked = null; delayed.length = 0;
        scene.scene.isActive = () => false;
        handover(1); delayed.forEach((fn) => fn());
        assert.deepEqual(played, []);
    } finally { SoundHelper.playSound = realPlay; }
}
console.log('Clover checks passed: equips itself after the morph, hops to the bar with the shop sound, stays put if already worn.');

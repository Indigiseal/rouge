import assert from 'node:assert/strict';
import { repairRandomDamagedItem } from '../src/systems/inventory/ItemRepair.js';
import { onWeaponSigilHit } from '../src/systems/combat/SigilEffects.js';
import { getSigil } from '../src/content/sigils/sigils.js';

const weapon = (durability = 2, maxDurability = 5) => ({ type: 'weapon', name: 'Sword', durability, maxDurability });
const armor = (durability = 2, maxDurability = 5) => ({ type: 'armor', name: 'Armor', durability, maxDurability });

// Missing, full, broken, and non-equipment cards cannot absorb a repair proc.
{
    const full = weapon(5), broken = weapon(0), potion = { type: 'potion', durability: 1, maxDurability: 4 };
    const damaged = weapon();
    assert.equal(repairRandomDamagedItem([null, full, broken, potion, damaged], () => 0).item, damaged);
    assert.equal(repairRandomDamagedItem([full, broken, potion, { type: 'weapon', durability: 2 }], () => { throw new Error('no target should roll'); }), null);
    assert.equal(full.durability, 5);
    assert.equal(broken.durability, 0);
}

// Duplicate references do not change an item's selection weight; carried and
// worn armor have the same chance as any other eligible item.
for (const [roll, expected] of [[0, 0], [0.34, 1], [0.67, 2], [0.999, 2]]) {
    const items = [weapon(), armor(), armor()];
    const result = repairRandomDamagedItem([...items, items[2]], () => roll);
    assert.equal(result.item, items[expected]);
    assert.equal(result.gained, 1);
    assert.deepEqual(items.map(item => item.durability), items.map((_, i) => i === expected ? 3 : 2));
}

{
    const item = weapon(4);
    item.gemEffect = 'lightning';
    item.sigils = [{ id: 'mending' }];
    const sigils = item.sigils;
    repairRandomDamagedItem([item], () => 0);
    assert.equal(item.durability, 5);
    assert.equal(item.gemEffect, 'lightning');
    assert.equal(item.sigils, sigils);
    assert.equal(repairRandomDamagedItem([item]), null);
}

function fixture({ brokenSource = false, fallbackInventory = false } = {}) {
    const source = { ...weapon(brokenSource ? 0 : 2), sigils: [{ id: 'mending' }] };
    const carried = armor(4), worn = armor(3);
    const slots = [source, carried];
    const feedback = [], refreshed = [];
    let uiUpdates = 0;
    const sprite = { scene: {}, x: 120, y: 300 };
    const scene = {
        gameState: { inventory: slots, equippedArmor: worn, currentFloor: 1 },
        playerAvatar: { x: 30, y: 50 },
        createFloatingText(...args) { feedback.push(args); },
        updateUI() { uiUpdates++; },
    };
    if (!fallbackInventory) scene.inventorySystem = {
        slots, slotSprites: [null, { card: sprite }],
        updateWeaponInfoText(...args) { refreshed.push(args); },
    };
    return { scene, source, carried, worn, feedback, refreshed, get uiUpdates() { return uiUpdates; } };
}

function hit(f, damageDealt, rolls) {
    const original = Math.random;
    let calls = 0;
    Math.random = () => {
        assert.ok(calls < rolls.length, 'Mending must not make extra rolls per hit');
        return rolls[calls++];
    };
    try {
        // A killing blow must still repair equipment.
        const fired = onWeaponSigilHit(f.scene, f.source, { data: { health: 0 } }, { damageDealt, swingDamage: 5 });
        assert.equal(calls, rolls.length);
        return fired;
    } finally { Math.random = original; }
}

{
    const f = fixture();
    assert.ok(hit(f, 5, [0.09, 0.4]).includes('mending'));
    assert.equal(f.carried.durability, 5);
    assert.equal(f.source.durability, 2);
    assert.equal(f.worn.durability, 3);
    assert.equal(f.refreshed.length, 1, 'refresh the repaired card without rebuilding the bag');
    assert.equal(f.refreshed[0][1], f.carried);
    assert.equal(f.feedback[0][2].vars.amount, 1);
    assert.equal(f.feedback[0][0], 120, 'feedback is anchored to the repaired card');
    assert.equal(f.uiUpdates, 1);
}

{
    const f = fixture({ brokenSource: true });
    assert.ok(hit(f, 5, [0, 0.99]).includes('mending'));
    assert.equal(f.worn.durability, 4, 'a broken source can repair worn armor');
    assert.equal(f.source.durability, 0, 'ordinary Mending never revives broken equipment');
}

{
    const f = fixture({ fallbackInventory: true });
    assert.ok(hit(f, 1, [0, 0.4]).includes('mending'));
    assert.equal(f.carried.durability, 5, 'shared gameplay helper works without rendered inventory');
}

for (const damage of [0, -1]) {
    const f = fixture();
    assert.ok(!hit(f, damage, []).includes('mending'));
    assert.equal(f.uiUpdates, 0);
}

{
    const f = fixture();
    assert.ok(!hit(f, 5, [0.1]).includes('mending'), '10% boundary must not repair');
    assert.equal(f.uiUpdates, 0);
    f.source.sigils = [];
    assert.ok(!hit(f, 5, []).includes('mending'));
}

{
    const f = fixture();
    for (const item of f.scene.gameState.inventory.concat(f.worn)) item.durability = item.maxDurability;
    assert.ok(!hit(f, 5, [0]).includes('mending'));
    assert.equal(f.feedback.length, 0, 'no misleading repair text when no item is damaged');
}

assert.match(getSigil('mending').player, /1 pip.*random damaged weapon or armor/);
console.log('Mending checks passed: random equipment, worn armor, deduplication, caps, breaks, kills, misses, proc boundary, and visible target refresh.');

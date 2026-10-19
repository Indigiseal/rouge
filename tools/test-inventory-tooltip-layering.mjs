import assert from 'node:assert/strict';

globalThis.Phaser = {
    Scene: class {},
    Math: { Clamp: (value, min, max) => Math.max(min, Math.min(max, value)) },
};
const { InventoryView } = await import('../src/systems/inventory/InventoryView.js');

function scene() {
    const host = { textures: { get: () => null }, objects: [] };
    const object = (type, children = []) => {
        const obj = {
            type, scene: host, list: children, width: 100, height: 40,
            setOrigin() { return this; },
            setStrokeStyle() { return this; },
            setPosition() { return this; },
            setDepth(value) { this.depth = value; return this; },
            destroy() { this.list.forEach(child => child.destroy()); this.scene = null; },
        };
        host.objects.push(obj);
        return obj;
    };
    host.add = {
        text: () => object('Text'),
        rectangle: () => object('Rectangle'),
        container: (x, y, children) => object('Container', children),
    };
    return host;
}

const game = scene();
const room = scene();
const inv = {
    ...InventoryView, scene: game, uiGroup: { add() {} },
    getCardTooltipLines: () => ['Armor', 'Protection: 5'],
    destroyDragOverlay() {},
};
const armor = { type: 'armor' };
inv.showCardTooltip(armor, 0, 170, 280);
const oldTooltip = inv.cardTooltip;
assert.equal(oldTooltip.scene, game);
inv.setDragOverlayScene(room);
assert.equal(oldTooltip.scene, null, 'entering the room clears an existing lower-scene tooltip');
inv.showCardTooltip(armor, 0, 170, 280);
const roomTooltip = inv.cardTooltip;
assert.equal(roomTooltip.scene, room);
assert.ok(roomTooltip.depth > 5, 'tooltip appears above the sigil room artwork');
assert.ok(roomTooltip.list.every(part => part.scene === room), 'panel and text share the upper scene');
inv.setDragOverlayScene(null);
assert.equal(roomTooltip.scene, null, 'leaving the room clears the upper-scene tooltip');
assert.ok(roomTooltip.list.every(part => part.scene === null), 'tooltip children are cleaned up');
inv.showCardTooltip(armor, 0, 170, 280);
assert.equal(inv.cardTooltip.scene, game, 'normal inventory tooltips return to GameScene');
console.log('Inventory tooltip layering and room transition checks passed.');

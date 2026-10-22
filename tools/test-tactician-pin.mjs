import assert from 'node:assert/strict';
import { MockScene } from '../sim/mock.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { AMULETS } from '../src/content/cards/amulets.js';
import { getAmuletAtlasPresentation, applyAmuletAtlasPresentation, hudAmuletTexture } from '../src/content/amulets/RelicsOthersAtlas.js';

function fixture(dealing = false) {
    const scene = new MockScene(), queue = [], killed = [], textures = [];
    scene.gameState = { currentFloor: 1 };
    scene.textures.exists = key => key === 'tacticianPin';
    scene.tweens.add = cfg => { queue.push(cfg); return {}; };
    scene.tweens.killTweensOf = target => killed.push(target);
    const sprite = { scene, x: 200, y: 100, displayWidth: 52, displayHeight: 70, depth: 10, on() {} };
    scene.add = {
        image(x, y, key) {
            textures.push(key);
            return { scene, x, y, visible: true,
                setOrigin() { return this; }, setDepth(value) { this.depth = value; return this; },
                setVisible(value) { this.visible = value; return this; },
                destroy() { this.scene = null; },
            };
        },
    };
    const cs = new CardSystem(scene);
    const card = { sprite, revealed: false, _openingDeal: dealing, data: { strategyScout: true } };
    return { scene, cs, card, queue, killed, textures };
}

const offer = AMULETS.find(item => item.id === 'tacticiansPin');
assert.equal(offer.sprite, 'tacticianPin');
assert.equal(offer.name, "Tactician's Pin");
assert.equal(getAmuletAtlasPresentation('tacticiansPin').spriteFrame, 0);
assert.equal(applyAmuletAtlasPresentation({ id: 'tacticiansPin', sprite: 'relicsOthers', spriteFrame: 8 }).sprite, 'tacticianPin', 'old saved compasses refresh to the pin');
assert.equal(hudAmuletTexture({ textures: { exists: () => false } }, offer.sprite), 'tacticianPin');

{
    const { cs, card, queue, textures } = fixture(true);
    cs.syncControlMarkers(card);
    const pin = card.strategyScoutMarker;
    assert.deepEqual(textures, ['tacticianPin']);
    assert.equal(pin.visible, false, 'wait until the marked card lands');
    assert.equal(queue.length, 0);
    card._openingDeal = false;
    cs.syncControlMarkers(card);
    assert.equal(pin.visible, true);
    assert.equal(queue.length, 1);
    const restingY = pin.y;
    // The card can move during the lift without snapping its animated offset.
    queue[0].targets.offsetY = -11;
    queue[0].onUpdate();
    assert.equal(pin.y, restingY - 11);
    card.sprite.x += 20;
    card.sprite.y += 8;
    cs.syncControlMarkers(card);
    assert.equal(pin.x, 211);
    assert.equal(pin.y, restingY + 8 - 11);
    assert.equal(queue.length, 1, 'position refresh does not replay the animation');
    const endpoints = [];
    while (queue.length) {
        const cfg = queue.shift();
        cfg.targets.offsetY = cfg.offsetY;
        cfg.onUpdate();
        endpoints.push(pin.y - (restingY + 8));
        cfg.onComplete();
    }
    assert.deepEqual(endpoints, [-22, 4, -2, 0], 'lift, plunge past the card, rebound and settle');
    assert.equal(pin.y, restingY + 8);
    assert.equal(pin._tacticianPinMotion, undefined);
    cs.syncControlMarkers(card);
    assert.equal(queue.length, 0, 'settled pin stays planted');
}

for (const remove of ['reveal', 'clear']) {
    const { cs, card, queue, killed } = fixture();
    cs.syncControlMarkers(card);
    const pin = card.strategyScoutMarker, motion = pin._tacticianPinMotion;
    if (remove === 'reveal') {
        card.revealed = true;
        cs.syncControlMarkers(card);
    } else {
        card.sprite.scene = null;
        cs.destroyControlMarkers(card);
    }
    assert.equal(card.strategyScoutMarker, null);
    assert.equal(pin.scene, null);
    assert.deepEqual(killed, [motion], `${remove} cancels the in-flight animation`);
    queue.shift().onComplete();
    assert.equal(queue.length, 0, 'late callbacks cannot bring back a removed pin');
}
console.log('Tactician pin checks passed: shared battle art in offers/saves/HUD, landing delay, lift/plunge/overshoot/settle, moving-card anchors, no replay and reveal/clear cleanup.');

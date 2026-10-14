// ui/RewardFlight.js
// Something the player is given — a card, an amulet — floats from where it
// came from (an event's picture) to where it now lives: its bag slot, or its
// spot on the amulet bar. The same arc as the coins (ui/CurrencyFlight.js),
// a little slower because a card is a bigger thing to carry.
//
// The real card or icon is already in place when this starts (the reward is
// granted first, so it can never be lost to an animation); it is hidden while
// its copy is in the air and shown again the moment the copy lands.
//
// Drawn in the scene given — the event screen, which sits above the bag and
// the HUD — aimed at GameScene objects at the same world coordinates.

import { tweenAlongArc } from './ArcFlight.js';

const FLIGHT_MS = 650;
const FLIGHT_ARC = 50;
const DEPTH = 1000;

/** A copy of a texture flying from one point to another along an arc. */
export function flyRewardIcon(scene, { texture, frame, fromX, fromY, toX, toY, onArrive = null }) {
    if (!scene?.add || !scene.textures?.exists?.(texture)) { onArrive?.(); return; }
    const icon = scene.add.image(0, 0, texture, frame).setDepth(DEPTH).setAlpha(0);
    tweenAlongArc(scene, icon, {
        fromX, fromY, toX, toY,
        arc: FLIGHT_ARC,
        duration: FLIGHT_MS,
        // Fades in as it leaves the picture; lands fully visible.
        onProgress: (p) => icon.setAlpha(Math.min(1, p * 5)),
        onComplete: () => {
            icon.destroy();
            onArrive?.();
        },
    });
}

/** Hide `objects` until a flight lands, then put each one's alpha back. */
function hideUntil(objects) {
    const kept = objects.filter((o) => o?.scene).map((o) => [o, o.alpha]);
    kept.forEach(([o]) => o.setAlpha(0));
    return () => kept.forEach(([o, alpha]) => { if (o.scene) o.setAlpha(alpha); });
}

/**
 * The card now in bag slot `slotIndex` floats in from (fromX, fromY). The card
 * in the slot, and everything riding it (pips, gem...), stays hidden until it
 * lands. Call after the bag has been redrawn.
 */
export function flyCardToBag(scene, slotIndex, fromX, fromY) {
    const inv = scene?.scene?.get?.('GameScene')?.inventorySystem;
    const slot = inv?.slotSprites?.[slotIndex];
    const card = slot?.card;
    if (!card?.scene || !card.texture?.key) return;
    const info = card.getData?.('infoText');
    const riders = card.getData?.('cardRiders');
    const parts = [card, info, ...(riders ? [...riders.values()].map((r) => r.object) : [])];
    const show = hideUntil(parts);
    flyRewardIcon(scene, {
        texture: card.texture.key,
        frame: card.frame?.name,
        fromX,
        fromY,
        toX: card.x,
        toY: card.y,
        onArrive: show,
    });
}

/**
 * Amulet `id`, just added to the bar, floats in from (fromX, fromY) to its
 * icon there, hidden until it lands. Skipped if its icon is scrolled off.
 */
export function flyAmuletToBar(scene, id, fromX, fromY) {
    const hud = scene?.scene?.get?.('GameScene');
    const icon = hud?.findAmuletIcon?.(id);
    if (!icon?.texture?.key) return;
    const show = hideUntil([icon]);
    flyRewardIcon(scene, {
        texture: icon.texture.key,
        frame: icon.frame?.name,
        fromX,
        fromY,
        toX: icon.x,
        toY: icon.y,
        onArrive: show,
    });
}

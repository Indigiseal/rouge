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
import { cardRiders, syncCardRiders } from './CardRiders.js';

const FLIGHT_MS = 560;
const FLIGHT_ARC = 50;
const DEPTH = 1000;
// The landing: it carries on a few pixels past its spot, then settles back.
const OVERSHOOT_PX = 5;
const OVERSHOOT_MS = 70;
const SETTLE_MS = 170;

/**
 * A copy of a texture flying from one point to another along an arc. It
 * speeds up as it goes, overshoots its spot a little in the direction it was
 * travelling, and settles back with a small bounce. Whole pixels throughout.
 */
export function flyRewardIcon(scene, { texture, frame, visual = null, fromX, fromY, toX, toY, onArrive = null, hop = false }) {
    if (!scene?.add || (!visual && !scene.textures?.exists?.(texture))) { onArrive?.(); return; }
    const icon = (visual || scene.add.image(0, 0, texture, frame)).setDepth(DEPTH).setAlpha(0);
    const endX = Math.round(toX);
    const endY = Math.round(toY);
    let lastX = Math.round(fromX);
    let lastY = Math.round(fromY);
    let dirX = 0;
    let dirY = 1;
    const startFlight = () => tweenAlongArc(scene, icon, {
        fromX, fromY, toX, toY,
        arc: FLIGHT_ARC,
        duration: FLIGHT_MS,
        ease: 'Quad.easeIn',
        // Fades in as it leaves the picture; lands fully visible. Remembers
        // which way it is heading, for the overshoot.
        onProgress: (p) => {
            icon.setAlpha(hop ? 1 : Math.min(1, p * 5));
            const dx = icon.x - lastX;
            const dy = icon.y - lastY;
            const len = Math.hypot(dx, dy);
            if (len > 0) { dirX = dx / len; dirY = dy / len; }
            lastX = icon.x;
            lastY = icon.y;
        },
        onComplete: () => {
            if (!icon.scene) { onArrive?.(); return; }
            scene.tweens.add({
                targets: icon,
                x: Math.round(endX + dirX * OVERSHOOT_PX),
                y: Math.round(endY + dirY * OVERSHOOT_PX),
                duration: OVERSHOOT_MS,
                ease: 'Quad.easeOut',
                onComplete: () => scene.tweens.add({
                    targets: icon,
                    x: endX,
                    y: endY,
                    duration: SETTLE_MS,
                    ease: 'Back.easeOut',
                    onUpdate: () => icon.setPosition(Math.round(icon.x), Math.round(icon.y)),
                    onComplete: () => {
                        icon.destroy();
                        onArrive?.();
                    },
                }),
            });
        },
    });
    if (hop) {
        icon.setPosition(Math.round(fromX), Math.round(fromY)).setAlpha(1);
        scene.tweens.add({
            targets: icon, y: Math.round(fromY) - 12,
            duration: 110, ease: 'Quad.easeOut', yoyo: true,
            onUpdate: () => { icon.y = Math.round(icon.y); },
            onComplete: startFlight,
        });
    } else startFlight();
}

/** One small, temporary bitmap of the card as actually drawn, including its
 * labels, pips, gems and sigils. No card state is copied or changed. */
export function createCardFlightVisual(scene, card) {
    if (!card?.scene) return null;
    // A card that was only just moved (a drag ending) has its pips and numbers a
    // frame behind it, and a copy taken then has them all misplaced.
    syncCardRiders(card);
    const overlays = [...new Set(cardRiders(card))]
        .filter(part => part?.scene && part.visible && part.alpha > 0)
        .sort((a, b) => a.depth - b.depth);
    // A dragged card may have been raised above its original decoration depths.
    const parts = [card, ...overlays];
    let halfWidth = 1;
    let halfHeight = 1;
    for (const part of parts) {
        const bounds = part.getBounds();
        halfWidth = Math.max(halfWidth, Math.abs(bounds.left - card.x), Math.abs(bounds.right - card.x));
        halfHeight = Math.max(halfHeight, Math.abs(bounds.top - card.y), Math.abs(bounds.bottom - card.y));
    }
    halfWidth = Math.ceil(halfWidth);
    halfHeight = Math.ceil(halfHeight);
    const visual = scene.add.renderTexture(card.x, card.y, halfWidth * 2, halfHeight * 2).setOrigin(0.5);
    visual.camera.setScroll(card.x - halfWidth, card.y - halfHeight);
    visual.draw(parts);
    return visual;
}

/**
 * The card now in bag slot `slotIndex` floats in from (fromX, fromY). The card
 * in the slot, and everything riding it (pips, gem...), stays hidden until it
 * lands. Slot -1 targets worn armor. Call after the inventory/HUD is redrawn.
 */
export function flyCardToBag(scene, slotIndex, fromX, fromY) {
    const hud = scene?.scene?.get?.('GameScene');
    const inv = hud?.inventorySystem;
    const destination = () => slotIndex === -1 ? hud?.armorPanelEquippedSprite : inv?.slotSprites?.[slotIndex]?.card;
    const itemAtDestination = () => slotIndex === -1 ? hud?.gameState?.equippedArmor : inv?.slots?.[slotIndex];
    const card = destination();
    if (!card?.scene) return;
    const visual = createCardFlightVisual(scene, card);
    const item = itemAtDestination();
    const kept = new Map();
    // Inventory refreshes may replace the destination objects mid-flight.
    // Conceal the current rendering, without hiding a different replacement item.
    const conceal = () => {
        if (itemAtDestination() !== item) return;
        const current = destination();
        for (const part of [current, ...cardRiders(current)]) {
            if (!part?.scene) continue;
            if (!kept.has(part)) kept.set(part, part.alpha);
            part.setAlpha(0);
        }
    };
    const show = () => {
        scene.events.off('postupdate', conceal);
        scene.events.off('shutdown', show);
        kept.forEach((alpha, part) => { if (part.scene) part.setAlpha(alpha); });
        kept.clear();
    };
    scene.events.on('postupdate', conceal);
    scene.events.once('shutdown', show);
    conceal();
    flyRewardIcon(scene, {
        visual,
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
export function flyAmuletToBar(scene, id, fromX, fromY, { hop = false } = {}) {
    const hud = scene?.scene?.get?.('GameScene');
    const icon = hud?.findAmuletIcon?.(id);
    if (!icon?.texture?.key) return;
    const restingAlpha = icon.alpha;
    // HUD refreshes rebuild the icons, including when another item is bought
    // during this flight. Hide the current icon until the copy has landed.
    const conceal = () => hud.findAmuletIcon?.(id)?.setAlpha(0);
    const show = () => {
        scene.events.off('postupdate', conceal);
        scene.events.off('shutdown', show);
        hud.findAmuletIcon?.(id)?.setAlpha(restingAlpha);
    };
    scene.events.on('postupdate', conceal);
    scene.events.once('shutdown', show);
    conceal();
    flyRewardIcon(scene, {
        texture: icon.texture.key,
        frame: icon.frame?.name,
        fromX,
        fromY,
        toX: icon.x,
        toY: icon.y,
        onArrive: show,
        hop,
    });
}

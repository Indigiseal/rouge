// The empty socket that appears on a card while a gem is looking for a home.
//
// gemSpot.png is 18x18, the same cell as gemsTiered, so a socketed gem lands on
// its spot exactly. It sits at the TOP MIDDLE of a card, touching the top edge.
//
// Two lives, one piece of art:
//
//   1. A hint. Hover or drag a loose gem — on the board or in a shop — and
//      every card that could actually take it shows an empty socket. That
//      answers "where can this go?" before the player has dragged anything
//      across the screen to find out.
//   2. A setting. Once a gem is socketed, the same spot is drawn under it, so
//      the stone reads as set INTO the card rather than stuck on top of it.
//
// The hint is deliberately built from the eligibility rule the drop itself
// uses (canSocketGem below, which mirrors InventorySystem.applyGemToWeapon).
// A hint that lit up cards the drop would refuse would be worse than none.

import { CardDataGenerator } from '../systems/loot/CardDataGenerator.js';

export const GEM_SPOT_KEY = 'gemSpot';
export const GEM_SPOT_SIZE = 18;
// Tucked just inside the card's top edge.
const SPOT_INSET_Y = GEM_SPOT_SIZE / 2;
// Fallback only. The real depth comes from the inventory, because it renumbers
// itself: a card sits at 12 in a fight and at 203 in a station room, so a fixed
// 14 put the hint above the card in combat and UNDER it in every shop — which
// is exactly where it was invisible.
const SPOT_DEPTH_FALLBACK = 14;

/**
 * Would this weapon accept this gem? The same three rules the socketing itself
 * applies: it must be a weapon, it must not already hold a different gem, and
 * it must have a free slot.
 */
export function canSocketGem(weapon, gem) {
    if (!gem || gem.type !== 'gem') return false;
    if (!weapon || weapon.type !== 'weapon') return false;
    if (weapon.gemEffect && weapon.gemEffect !== gem.gemEffect) return false;
    const maxSlots = CardDataGenerator.weaponGemSlots(weapon);
    const currentCount = weapon.gemEffect ? (weapon.gemCount || 1) : 0;
    return currentCount < maxSlots;
}

/** Where the spot sits on a card: centred across, just inside the top edge. */
export function gemSpotPosition(cardSprite) {
    const halfH = (cardSprite.displayHeight || 65) / 2;
    return {
        x: Math.round(cardSprite.x),
        y: Math.round(cardSprite.y - halfH + SPOT_INSET_Y),
    };
}

/** Draws the spot on one card. Used for both the hint and the socketed gem. */
export function createGemSpot(scene, cardSprite, depth = null) {
    if (!scene.textures?.exists?.(GEM_SPOT_KEY)) return null;
    const { x, y } = gemSpotPosition(cardSprite);
    return scene.add.image(x, y, GEM_SPOT_KEY).setDepth(depth ?? spotDepth(scene));
}

/** Just under where a socketed gem would sit, whichever numbering is in use. */
function spotDepth(scene) {
    const depths = scene?.inventorySystem?.getInventoryDepths?.();
    return depths ? depths.gemIndicator - 1 : SPOT_DEPTH_FALLBACK;
}

/**
 * Show an empty socket on every inventory card that could take `gem`.
 *
 * Safe to call repeatedly with the same gem — it clears first, so a hover that
 * follows a drag does not stack two sets of spots on the same cards.
 */
export function showGemSockets(scene, gem) {
    const host = inventoryHost(scene);
    hideGemSockets(scene);
    if (!host) return;

    const inventory = host.inventorySystem;
    if (!canSocketGemAnywhere(inventory, gem)) return;

    const spots = [];
    (inventory.slotSprites || []).forEach((slot, index) => {
        const cardSprite = slot?.card;
        if (!cardSprite?.scene) return;
        if (!canSocketGem(inventory.slots?.[index], gem)) return;
        // Drawn in the scene that OWNS the cards, not the one that asked. A
        // shop draws on top of GameScene and reaches the bag through
        // this.gameScene, so a spot added to the shop would float above its own
        // art instead of sitting on the card it belongs to.
        const spot = createGemSpot(host, cardSprite);
        if (spot) spots.push({ spot, cardSprite });
    });
    host._gemSocketHints = spots;

    // A card is not still while the hint is up: passing a gem over one lifts it
    // 5px, and the spot was placed once and left behind. Follow the card every
    // frame instead — it also covers the bag being rearranged mid-drag, which
    // no one-shot placement could.
    if (spots.length) {
        host._gemSocketSync = () => syncGemSockets(host);
        host.events?.on?.('update', host._gemSocketSync);
    }
}

/** Keeps every hint sitting on its card, wherever the card has got to. */
function syncGemSockets(host) {
    const spots = host?._gemSocketHints;
    if (!spots) return;
    for (const { spot, cardSprite } of spots) {
        if (!spot?.scene) continue;
        if (!cardSprite?.scene) { spot.setVisible(false); continue; }
        const at = gemSpotPosition(cardSprite);
        spot.setPosition(at.x, at.y);
        spot.setVisible(true);
    }
}

/** Takes the hint down. Safe to call when nothing is showing. */
export function hideGemSockets(scene) {
    const host = inventoryHost(scene) || scene;
    if (!host) return;
    if (host._gemSocketSync) {
        host.events?.off?.('update', host._gemSocketSync);
        host._gemSocketSync = null;
    }
    (host._gemSocketHints || []).forEach(({ spot }) => spot?.destroy?.());
    host._gemSocketHints = null;
}

/**
 * The scene holding the inventory: a fight owns it directly, a station room
 * borrows GameScene's. Resolving it here means a caller can pass either scene
 * and still get the right one — the shop passed itself, found no inventory,
 * and silently drew nothing.
 */
function inventoryHost(scene) {
    if (scene?.inventorySystem) return scene;
    if (scene?.gameScene?.inventorySystem) return scene.gameScene;
    return null;
}

function canSocketGemAnywhere(inventory, gem) {
    return (inventory.slots || []).some((item) => canSocketGem(item, gem));
}

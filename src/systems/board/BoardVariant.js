// Board variants — how one fight room differs from the standard one.
//
// The standard combat room is the default variant. An event-triggered fight
// declares only what it changes, and inherits everything else: layout, item
// weights, card caps, opening reveals, weapon supply, hover, shadows, flips.
//
// This is the pattern Toll Collectors already used by passing
// `normalCombatBoard: true` and an enemy pool. A variant generalises that from
// "which enemies" to "how the room looks and opens", so a new event fight is a
// config rather than another copy of the placement code.
//
//   {
//     cardBack: 'cocoon',        // face-down art for this room
//     revealAnim: 'cocoonOpen',  // played instead of the paper card flip
//     openBy: 'damage',          // 'click' (default) | 'damage'
//   }

import {
    locationCardBackKey,
    locationCardRow,
    locationFlipAnimKey,
    locationHoverAnimKey,
} from '../../content/assets/locationCardArt.js';

export const DEFAULT_CARD_BACK = 'cardBack';
export const DEFAULT_REVEAL_ANIM = 'card_flip_anim';
export const DEFAULT_HOVER_ANIM = 'card_hover_anim';

/** Face-down cards are opened by clicking them. */
export const OPEN_BY_CLICK = 'click';
/** Face-down cards must be damaged; a click alone will not turn them. */
export const OPEN_BY_DAMAGE = 'damage';

export const DEFAULT_BOARD_VARIANT = Object.freeze({
    cardBack: DEFAULT_CARD_BACK,
    revealAnim: DEFAULT_REVEAL_ANIM,
    openBy: OPEN_BY_CLICK,
});

/**
 * Builds a variant from an ambush spec, falling back to the standard room for
 * anything it does not mention. Returns null for a spec that changes nothing,
 * so the common path stays on the frozen default.
 */
export function boardVariantFromAmbush(ambush) {
    if (!ambush) return null;
    const cardBack = typeof ambush.cardBack === 'string' ? ambush.cardBack : null;
    const revealAnim = typeof ambush.revealAnim === 'string' ? ambush.revealAnim : null;
    const openBy = ambush.openBy === OPEN_BY_DAMAGE ? OPEN_BY_DAMAGE : null;
    if (!cardBack && !revealAnim && !openBy) return null;
    return Object.freeze({
        cardBack: cardBack || DEFAULT_CARD_BACK,
        revealAnim: revealAnim || DEFAULT_REVEAL_ANIM,
        openBy: openBy || OPEN_BY_CLICK,
    });
}

// Where a room gets its face-down look when the variant does not name one:
// the location being walked. A variant still wins — a cocoon cache is cocoons
// whichever road it sits on — and a location with no art drawn yet falls back
// to the single-colour originals.
//
// Each of these takes the location id rather than reading it from anywhere, so
// this module stays free of game state and remains straightforward to test.
function locationOr(fallback, locationId, keyFor) {
    if (locationCardRow(locationId) === undefined) return fallback;
    return keyFor(locationId);
}

/** The face-down texture for `variant`, else the location's, else standard. */
export function cardBackKey(variant, locationId = null) {
    return variant?.cardBack || locationOr(DEFAULT_CARD_BACK, locationId, locationCardBackKey);
}

/** The reveal animation for `variant`, else the location's, else standard. */
export function revealAnimKey(variant, locationId = null) {
    return variant?.revealAnim || locationOr(DEFAULT_REVEAL_ANIM, locationId, locationFlipAnimKey);
}

/**
 * The animation a face-down card plays under the pointer.
 *
 * Not a variant field: a variant that replaces the back with something that is
 * not a card at all (a cocoon) has its own hover handling, and nothing in the
 * variant spec has ever named a hover.
 */
export function cardHoverAnimKey(variant, locationId = null) {
    if (variant?.cardBack) return DEFAULT_HOVER_ANIM;
    return locationOr(DEFAULT_HOVER_ANIM, locationId, locationHoverAnimKey);
}

/** True when this room's face-down cards need damage rather than a click. */
export function opensByDamage(variant) {
    return (variant?.openBy || OPEN_BY_CLICK) === OPEN_BY_DAMAGE;
}

/**
 * True when `textureKey` is a face-down or mid-flip card in this room.
 *
 * Checks the standard back as well as the variant's, because a board can hold
 * cards from both — and because callers use this to refuse to act on a card
 * whose art says it has not been turned over yet.
 */
export function isCardBackTexture(textureKey, variant) {
    if (!textureKey) return true;
    const key = String(textureKey);
    return key === DEFAULT_CARD_BACK
        || key === cardBackKey(variant)
        // Any location's back, not just the one this room is using: a board can
        // outlive a location change, and a card whose art says "face down" must
        // read as face down wherever that art came from.
        || key.startsWith('cardBack_')
        || key.startsWith('cardFlip');
}

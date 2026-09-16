// Per-location card backs, flips and hovers.
//
// Every location turns its cards in its own colours: Thornwake green, Silkdeep
// blue, Tollroad brown, Boneflood red, Mireturn olive, Veilbleed violet,
// Ashhowl ember.
//
// Both sheets are 5 columns by 7 rows, one row per location, in the SAME row
// order as enemiesSpriteSheet — so the row is MONTH_SHEET_ROWS and is never
// written down twice. Add a row to the art and a location to that table and
// everything here follows.
//
//   cardFlipSheet   54x86, columns: 0 at rest, 1 shimmer, 2 turning,
//                   3 edge-on, 4 turned. The same five beats, and the same
//                   geometry, as the old cardFlip1-5 images it replaces.
//   cardHoverSheet  52x72, columns: 0 at rest, 1-3 the light sweeping over
//                   the back, 4 settling. Drop-in for the old cardHover1-5.
//
// The card BACK is not a third sheet. Column 0 of the flip row is the card at
// rest, and its drawn pixels are exactly 52x70 — the size of the old shared
// cardBack.png — sitting at (2, 14) inside the larger flip cell, which has room
// around it for the turn. So each back is cut from that corner at boot rather
// than shipped again as its own file, which also means a back can never drift
// out of step with the flip that starts from it.

import { MONTH_SHEET_ROWS } from './enemyCards.js';

export const CARD_FLIP_SHEET_KEY = 'cardFlipSheet';
export const CARD_HOVER_SHEET_KEY = 'cardHoverSheet';

/** Columns per row, shared by both sheets. */
const SHEET_COLUMNS = 5;

/** Where the resting card sits inside a 54x86 flip cell, and how big it is. */
const BACK_INSET_X = 2;
const BACK_INSET_Y = 14;
export const CARD_BACK_WIDTH = 52;
export const CARD_BACK_HEIGHT = 70;

/** The locations that have a row of card art drawn. */
export const CARD_ART_LOCATIONS = Object.freeze(Object.keys(MONTH_SHEET_ROWS));

/** Sheet row for a location, or undefined when its art is not drawn yet. */
export function locationCardRow(locationId) {
    return MONTH_SHEET_ROWS[locationId];
}

export function locationCardBackKey(locationId) {
    return `cardBack_${locationId}`;
}

export function locationFlipAnimKey(locationId) {
    return `card_flip_${locationId}`;
}

export function locationHoverAnimKey(locationId) {
    return `card_hover_${locationId}`;
}

/**
 * Cut every location's back out of its flip row and register its two
 * animations. Safe to call more than once; anything already built is skipped.
 *
 * Returns how many locations were built, so boot can log or ignore it.
 */
export function buildLocationCardArt(scene) {
    if (!scene?.textures?.exists?.(CARD_FLIP_SHEET_KEY)) return 0;
    const hasHover = scene.textures.exists(CARD_HOVER_SHEET_KEY);
    let built = 0;

    for (const locationId of CARD_ART_LOCATIONS) {
        const row = locationCardRow(locationId);
        if (row === undefined) continue;
        const first = row * SHEET_COLUMNS;
        const frames = (count = SHEET_COLUMNS) =>
            Array.from({ length: count }, (_, column) => first + column);

        const backKey = locationCardBackKey(locationId);
        if (!scene.textures.exists(backKey)) {
            const rt = scene.make.renderTexture({
                width: CARD_BACK_WIDTH,
                height: CARD_BACK_HEIGHT,
                add: false,
            });
            // Negative offsets pull the cell's drawn corner to the texture's
            // origin, leaving the flip's surrounding margin outside it.
            rt.drawFrame(CARD_FLIP_SHEET_KEY, first, -BACK_INSET_X, -BACK_INSET_Y);
            // saveTexture hands the RenderTexture to the texture manager as this
            // key's source, so it must NOT be destroyed afterwards — same as
            // enemyCards.js and resourceCards.js.
            rt.saveTexture(backKey);
        }

        const flipKey = locationFlipAnimKey(locationId);
        if (!scene.anims.exists(flipKey)) {
            scene.anims.create({
                key: flipKey,
                frames: frames().map((frame) => ({ key: CARD_FLIP_SHEET_KEY, frame })),
                frameRate: 24,
                repeat: 0,
            });
        }

        const hoverKey = locationHoverAnimKey(locationId);
        if (hasHover && !scene.anims.exists(hoverKey)) {
            scene.anims.create({
                key: hoverKey,
                frames: frames().map((frame) => ({ key: CARD_HOVER_SHEET_KEY, frame })),
                frameRate: 24,
                repeat: 0,
            });
        }

        built += 1;
    }

    return built;
}

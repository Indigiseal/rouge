// Resource cards — coins, potions, food, the key and crystals, each in three
// rarities, composited from assets/art/resourcesSpriteSheet.png.
//
// The sheet is a 3x6 grid of 52x70 card cells:
//
//        common     uncommon   rare        <- columns are rarity / amount
//   0    coins      coins      coins
//   1    potion     potion     potion
//   2    food       food       food
//   3    key        -          -           <- one key only; it has no tiers
//   4    crystal    crystal    crystal
//   5    backing    backing    backing     <- the empty card face, per rarity
//
// Rows 0-4 are loose icons on transparent backgrounds. Row 5 is the card face
// they sit on. A finished card is the backing for a rarity with that rarity's
// icon drawn over it — medium coins means row 0 column 1 on top of row 5
// column 1.
//
// We composite the pair ONCE into a single texture per resource+rarity rather
// than carrying two sprites per card, so everything downstream — board hover,
// the lift, shadows, inventory slots, shop rows, drag — keeps working with the
// one sprite it already expects.

export const RESOURCE_SHEET_KEY = 'resourceCards';
export const RESOURCE_CARD_WIDTH = 52;
export const RESOURCE_CARD_HEIGHT = 70;
const SHEET_COLUMNS = 3;

/** Rarity order, left to right on the sheet. */
export const RESOURCE_RARITIES = Object.freeze(['common', 'uncommon', 'rare']);

/** Sheet row per resource. */
export const RESOURCE_ROWS = Object.freeze({
    coin: 0,
    potion: 1,
    food: 2,
    key: 3,
    crystal: 4,
});

const BACKING_ROW = 5;

/** Resources whose icon changes with rarity. The key has a single face. */
const TIERED_RESOURCES = Object.freeze(['coin', 'potion', 'food', 'crystal']);

/** Column index for a rarity, defaulting to common. */
export function rarityColumn(rarity) {
    const i = RESOURCE_RARITIES.indexOf(rarity);
    return i === -1 ? 0 : i;
}

/** Sheet frame index for a row/column pair. */
export function sheetFrame(row, column) {
    return row * SHEET_COLUMNS + column;
}

/**
 * Texture key for a finished resource card.
 * Stable across runs so saved boards can name one.
 */
export function resourceCardKey(resource, rarity) {
    return `resCard_${resource}_${RESOURCE_RARITIES[rarityColumn(rarity)]}`;
}

/**
 * Composites every resource card into the texture manager. Safe to call more
 * than once; a no-op if the sheet has not loaded, so a missing file leaves the
 * old single-image cards rather than crashing the boot.
 *
 * @param {Phaser.Scene} scene any scene — the texture manager is game-wide.
 */
export function buildResourceCardTextures(scene) {
    if (!scene?.textures?.exists?.(RESOURCE_SHEET_KEY)) return false;

    const draw = (resource, rarity, iconRow, iconColumn) => {
        const key = resourceCardKey(resource, rarity);
        if (scene.textures.exists(key)) return;
        const rt = scene.make.renderTexture({
            width: RESOURCE_CARD_WIDTH,
            height: RESOURCE_CARD_HEIGHT,
            add: false,
        });
        // Backing first, then the icon over it.
        rt.drawFrame(RESOURCE_SHEET_KEY, sheetFrame(BACKING_ROW, rarityColumn(rarity)), 0, 0);
        rt.drawFrame(RESOURCE_SHEET_KEY, sheetFrame(iconRow, iconColumn), 0, 0);
        // saveTexture hands ownership to the texture manager — the RenderTexture
        // stays alive as that texture's source, so it must not be destroyed.
        rt.saveTexture(key);
    };

    for (const resource of TIERED_RESOURCES) {
        const row = RESOURCE_ROWS[resource];
        for (const rarity of RESOURCE_RARITIES) {
            draw(resource, rarity, row, rarityColumn(rarity));
        }
    }

    // The key has one icon but still wants a card face behind it. It is loot
    // worth a locked door, so it takes the rare backing.
    draw('key', 'rare', RESOURCE_ROWS.key, 0);

    return true;
}

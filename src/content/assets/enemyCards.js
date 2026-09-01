// Enemy cards — every month's roster in three tiers, composited from
// assets/art/enemiesSpriteSheet.png plus the icon strip.
//
// The sheet is an 8x6 grid of 52x70 cells. One row per month:
//
//        0..4  the five enemies, in roster order
//        5..7  the card face for normal / veteran / elite
//
//   row 0  Thornwake      row 3  Boneflood
//   row 1  Silkdeep       row 4  Mireturn
//   row 2  Tollroad       row 5  Veilbleed
//
// A column is NEVER written down by hand. It is the enemy's position in its
// month's roster — MELEE first, then RANGED, which is the order the rosters
// already declare and the order the art was drawn in. The old Thornwake atlas
// kept a separate hand-maintained frame table, it drifted from the roster, and
// the Fairy and the Sprite ended up wearing each other's faces. Deriving the
// column removes that failure mode: there is nothing left to disagree.
//
// A finished card stacks four things, bottom to top:
//
//   1. the card face for the tier      (sheet, columns 5-7)
//   2. the enemy                       (sheet, columns 0-4)
//   3. the heart and weapon icons      (enemyIcons, frames 0-2)
//   4. the HP and ATK numbers          drawn live, NOT baked in
//
// The first three are static per enemy+tier, so they are composited once into a
// single texture. The numbers change as an enemy takes damage, so they stay as
// live text that _buildEnemyCornerStats draws on top.

export const ENEMY_SHEET_KEY = 'enemyCards';
export const ENEMY_ICONS_KEY = 'enemyIcons';
export const ENEMY_CARD_WIDTH = 52;
export const ENEMY_CARD_HEIGHT = 70;
const SHEET_COLUMNS = 8;

/** Sheet row per month. Rows exist for months whose art is drawn. */
export const MONTH_SHEET_ROWS = Object.freeze({
    thornwake: 0,
    silkdeep: 1,
    tollroad: 2,
    boneflood: 3,
    mireturn: 4,
    veilbleed: 5,
});

/** Card-face column per tier — the three faces to the right of each roster. */
export const TIER_FACE_COLUMNS = Object.freeze({
    normal: 5,
    veteran: 6,
    elite: 7,
});

/** Icon strip frames. Only the top row is used; the second row is unrelated. */
const ICON_HEART = 0;
const ICON_SWORD = 1;
const ICON_BOW = 2;

// Where the icons sit, as the top-left corner of a 16x16 frame. These centre
// the icons under the HP and ATK numbers, which _buildEnemyCornerStats draws
// 18px either side of centre and 27px down.
const ICON_HP_X = 0;
const ICON_ATK_X = 36;
const ICON_Y = 54;

/** Texture key for a finished enemy card. */
export function enemyCardKey(monthId, column, tier = 'normal') {
    const face = TIER_FACE_COLUMNS[tier] !== undefined ? tier : 'normal';
    return `enemyCard_${monthId}_${column}_${face}`;
}

/**
 * The roster's flat draw order: melee first, then ranged. A creature's index
 * here IS its column on the sheet.
 */
export function rosterOrder(roster) {
    return [
        ...(roster?.MELEE || []),
        ...(roster?.RANGED || []),
    ];
}

/** Column for an enemy id within its month, or -1 if it is not on the roster. */
export function rosterColumn(roster, enemyId) {
    return rosterOrder(roster).indexOf(enemyId);
}

/**
 * What a month pack stamps onto each of its enemy definitions.
 *
 * `sheetColumn` travels with the card so applyEnemyTier can swap to the right
 * card face when an enemy is promoted, without another lookup table.
 *
 * @param {string} monthId
 * @param {object} roster the month's { MELEE, RANGED }
 * @param {string} enemyId
 */
export function enemyCardPresentation(monthId, roster, enemyId) {
    const column = rosterColumn(roster, enemyId);
    if (column === -1) {
        throw new Error(`"${enemyId}" is not on the ${monthId} roster — no sheet column`);
    }
    return Object.freeze({
        monthId,
        sheetColumn: column,
        sprite: enemyCardKey(monthId, column, 'normal'),
    });
}

/**
 * Composites every enemy card for every month that has both a roster and a row
 * of art. Safe to call twice, and a no-op if the sheet has not loaded — a
 * missing file leaves the old per-enemy art rather than crashing the boot.
 *
 * @param {Phaser.Scene} scene any scene; the texture manager is game-wide
 * @param {Array<{id: string, enemies: object|null}>} months usually MONTHS
 * @returns {number} how many textures were built
 */
export function buildEnemyCardTextures(scene, months = []) {
    if (!scene?.textures?.exists?.(ENEMY_SHEET_KEY)) return 0;
    const hasIcons = scene.textures.exists(ENEMY_ICONS_KEY);
    let built = 0;

    for (const month of months) {
        const row = MONTH_SHEET_ROWS[month?.id];
        // Months Petr has not written a roster for yet have art on the sheet
        // but nothing to hang it on. Skip them rather than guess.
        if (row === undefined || !month?.enemies) continue;

        const order = rosterOrder(month.enemies);
        const ranged = new Set(month.enemies.RANGED || []);

        order.forEach((enemyId, column) => {
            if (column >= TIER_FACE_COLUMNS.normal) return; // past the roster
            for (const tier of Object.keys(TIER_FACE_COLUMNS)) {
                const key = enemyCardKey(month.id, column, tier);
                if (scene.textures.exists(key)) continue;

                const rt = scene.make.renderTexture({
                    width: ENEMY_CARD_WIDTH,
                    height: ENEMY_CARD_HEIGHT,
                    add: false,
                });
                const cell = (col) => row * SHEET_COLUMNS + col;
                rt.drawFrame(ENEMY_SHEET_KEY, cell(TIER_FACE_COLUMNS[tier]), 0, 0);
                rt.drawFrame(ENEMY_SHEET_KEY, cell(column), 0, 0);
                if (hasIcons) {
                    rt.drawFrame(ENEMY_ICONS_KEY, ICON_HEART, ICON_HP_X, ICON_Y);
                    rt.drawFrame(
                        ENEMY_ICONS_KEY,
                        ranged.has(enemyId) ? ICON_BOW : ICON_SWORD,
                        ICON_ATK_X,
                        ICON_Y,
                    );
                }
                // saveTexture hands the RenderTexture to the texture manager as
                // that key's source, so it must not be destroyed afterwards.
                rt.saveTexture(key);
                built++;
            }
        });
    }
    return built;
}

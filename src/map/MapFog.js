// map/MapFog.js
// Fog of war over the run map, the way HoMM in Pixel Art does it (its fog
// atlas, assets/art/mapFog.png, and its FogOfWarSystem): a grid of 32x32 fog
// tiles, cleared in a circle of sight around every room the player has stood
// in this act — the explored road stays clear behind them — and around every
// room they can pick next. Each fogged tile picks its art from which of its
// four neighbours are fogged too, so the edge follows the circles in cloud.
// Each time the map opens, the fog draws back in a cascade of cloud puffs
// rippling out from the player.
//
// The fog is baked into one RenderTexture inside the map container, so it pans
// with the map and costs one draw. Fogged rooms never take the pointer: only
// the rooms the player can pick next do, and those are always cleared.
//
// Amulets: Cartographer's Ink widens the sight; Oracle's Eye lifts the fog.

export const MAP_FOG_KEY = 'mapFog';
const TILE = 32;
// Atlas frames, 4-neighbour autotile (N=1 E=2 S=4 W=8, set when that
// neighbour is fogged): frames 0-14 are the edge pieces by that mask; a tile
// fogged all round (15) takes the big interior texture, a 6x4 block from
// frame 32 (16 frames to a row). Frames 16-27 are loose cloud puffs.
const interiorFrame = (col, row) => 32 + (row % 4) * 16 + (col % 6);
const PUFF_FIRST = 16;
const PUFF_FRAMES = 12;

// Sight around a visited room, in map pixels. Floors are 60 apart and lanes
// 80, so this clears the next floor or two ahead and a lane or two aside.
export const BASE_SIGHT = 130;
// Cartographer's Ink: this much further.
export const INK_SIGHT = 150;
// Around a room the player can pick next, so it is never picked blind.
export const CHOICE_SIGHT = 40;

/** The player's sight radius on the map; Infinity: no fog (Oracle's Eye). */
export function mapSightRadius(gameState) {
    const owned = (id) => (gameState?.activeAmulets || []).some((a) => a?.id === id);
    if (owned('oraclesFishbowl')) return Infinity;
    return BASE_SIGHT + (owned('cartographersInk') ? INK_SIGHT : 0);
}

/**
 * The fog grid: which tiles are clear, for these sight points
 * ([{ x, y, r }] in map space) over the area `bounds` covers.
 */
export function computeFogGrid(points, { left, top, right, bottom }) {
    const cols = Math.ceil((right - left) / TILE);
    const rows = Math.ceil((bottom - top) / TILE);
    const clear = new Uint8Array(cols * rows);
    for (let row = 0; row < rows; row++) {
        const cy = top + row * TILE + TILE / 2;
        for (let col = 0; col < cols; col++) {
            const cx = left + col * TILE + TILE / 2;
            for (const p of points) {
                const dx = cx - p.x;
                const dy = cy - p.y;
                if (dx * dx + dy * dy <= p.r * p.r) { clear[row * cols + col] = 1; break; }
            }
        }
    }
    return { cols, rows, left: Math.round(left), top: Math.round(top), clear };
}

const isFogged = (grid, col, row) => (
    col < 0 || row < 0 || col >= grid.cols || row >= grid.rows   // past the edge counts as fog
        ? true
        : !grid.clear[row * grid.cols + col]
);

/** Draw the fog for `grid` into `container`. Returns the RenderTexture. */
export function drawMapFog(scene, container, grid) {
    if (!grid || !scene.textures.exists(MAP_FOG_KEY)) return null;
    const rt = scene.add.renderTexture(grid.left, grid.top, grid.cols * TILE, grid.rows * TILE).setOrigin(0, 0);
    for (let row = 0; row < grid.rows; row++) {
        for (let col = 0; col < grid.cols; col++) {
            if (!isFogged(grid, col, row)) continue;
            let mask = 0;
            if (isFogged(grid, col, row - 1)) mask |= 1;
            if (isFogged(grid, col + 1, row)) mask |= 2;
            if (isFogged(grid, col, row + 1)) mask |= 4;
            if (isFogged(grid, col - 1, row)) mask |= 8;
            const frame = mask === 15 ? interiorFrame(col, row) : mask;
            rt.drawFrame(MAP_FOG_KEY, frame, col * TILE, row * TILE);
        }
    }
    container.add(rt);
    return rt;
}

/**
 * The fog drawing back as the map opens: cloud puffs over the cleared area,
 * thick along the fog's edge and scattered inside, cascading out from `from`
 * (the player's room, map space). A puff drifts up and fades.
 */
export function puffFogCascade(scene, container, grid, from) {
    if (!grid || !scene.textures.exists(MAP_FOG_KEY)) return;
    const MS_PER_TILE = 60;   // how fast the cascade ripples outward
    for (let row = 0; row < grid.rows; row++) {
        for (let col = 0; col < grid.cols; col++) {
            if (isFogged(grid, col, row)) continue;
            const edge = isFogged(grid, col, row - 1) || isFogged(grid, col + 1, row)
                || isFogged(grid, col, row + 1) || isFogged(grid, col - 1, row);
            const count = edge ? 3 : (Math.random() < 0.5 ? 1 : 0);
            if (!count) continue;
            const cx = grid.left + col * TILE + TILE / 2;
            const cy = grid.top + row * TILE + TILE / 2;
            const wave = from ? (Math.hypot(cx - from.x, cy - from.y) / TILE) * MS_PER_TILE : 0;
            for (let k = 0; k < count; k++) {
                const puff = scene.add.image(
                    cx + (Math.random() - 0.5) * TILE,
                    cy + (Math.random() - 0.5) * TILE,
                    MAP_FOG_KEY, PUFF_FIRST + Math.floor(Math.random() * PUFF_FRAMES),
                );
                const scale = 0.7 + Math.random() * 0.5;
                puff.setScale(scale).setAlpha(0);
                container.add(puff);
                // Pops in on its beat, then drifts up and fades.
                scene.tweens.add({
                    targets: puff,
                    alpha: { from: 0.9, to: 0 },
                    y: puff.y - (4 + Math.random() * 6),
                    scale: { from: scale, to: scale * 0.6 },
                    duration: 360 + Math.random() * 220,
                    delay: wave + Math.random() * 90,
                    onComplete: () => puff.destroy(),
                });
            }
        }
    }
}

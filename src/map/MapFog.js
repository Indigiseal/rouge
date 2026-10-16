// map/MapFog.js
// Fog of war over the run map, in the HoMM in Pixel Art style (its fog atlas,
// assets/art/mapFog.png: 32x32 tiles). The player sees the floor they choose
// from and a little past it; every floor below that is under cloud. When the
// line moves down after a room, the cleared band dissolves in cloud puffs.
//
// The fog is baked into one RenderTexture inside the map container, so it pans
// with the map and costs one draw. Fogged rooms are never hoverable anyway:
// only the next floor's rooms take the pointer, and they are always in sight.
//
// Amulets: Cartographer's Ink sees further ahead; Oracle's Eye lifts the
// fog entirely.

export const MAP_FOG_KEY = 'mapFog';
const TILE = 32;
// Atlas frames (4-neighbour autotile, N=1 E=2 S=4 W=8): the fog's top edge is
// frame 14 (fog to the east, south and west, open to the north). The inside of
// the fog is a 6x4 block of big texture starting at frame 32 (16 per row).
// Frames 16-27 are loose cloud puffs.
const EDGE_FRAME = 14;
const interiorFrame = (col, row) => 32 + (row % 4) * 16 + (col % 6);
const PUFF_FRAMES = 12;

// Floors in sight past the one the player stands on: the floor they choose
// from, and one more.
export const BASE_FOG_AHEAD = 2;
// Cartographer's Ink: this many more.
export const INK_FOG_AHEAD = 3;

/** How many floors past the current one the player can see; Infinity: no fog. */
export function fogFloorsAhead(gameState) {
    const owned = (id) => (gameState?.activeAmulets || []).some((a) => a?.id === id);
    if (owned('oraclesFishbowl')) return Infinity;
    return BASE_FOG_AHEAD + (owned('cartographersInk') ? INK_FOG_AHEAD : 0);
}

/**
 * The map-space y below which the fog lies, for an act's floors (each node
 * carries __y), or null when nothing is fogged.
 */
export function fogLineY(floors, cursorFloor, ahead) {
    if (!Number.isFinite(ahead)) return null;
    const last = cursorFloor + ahead;
    const rowY = (f) => floors[f]?.find((n) => typeof n?.__y === 'number')?.__y;
    const lastY = rowY(last);
    const nextY = rowY(last + 1);
    if (typeof nextY !== 'number') return null;          // the end of the act is in sight
    if (typeof lastY !== 'number') return null;
    return Math.round((lastY + nextY) / 2);
}

/**
 * Draw the fog into `container` (the map container): solid from `lineY` down
 * to `bottomY`, `left`..`right` wide (map space). Returns the RenderTexture.
 */
export function drawMapFog(scene, container, { lineY, bottomY, left, right }) {
    if (lineY == null || !scene.textures.exists(MAP_FOG_KEY)) return null;
    const cols = Math.ceil((right - left) / TILE);
    const rows = Math.max(1, Math.ceil((bottomY - lineY) / TILE));
    const x0 = Math.round(left);
    // The edge tile's cloud tops stand a little above the tile's centre; the
    // first row starts half a tile above the line so the line sits in it.
    const y0 = Math.round(lineY - TILE / 2);
    const rt = scene.add.renderTexture(x0, y0, cols * TILE, rows * TILE).setOrigin(0, 0);
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            rt.drawFrame(MAP_FOG_KEY, r === 0 ? EDGE_FRAME : interiorFrame(c, r), c * TILE, r * TILE);
        }
    }
    container.add(rt);
    return rt;
}

/**
 * Cloud puffs over a band that just came out of the fog (map space, inside
 * `container`), drifting up and fading: the fog lifting.
 */
export function puffFogBand(scene, container, { fromY, toY, left, right }) {
    if (!scene.textures.exists(MAP_FOG_KEY) || !(toY > fromY)) return;
    const MS_PER_ROW = 70;
    for (let y = fromY; y < toY + TILE / 2; y += TILE * 0.75) {
        const rowDelay = ((y - fromY) / TILE) * MS_PER_ROW;
        for (let x = left; x < right; x += TILE * 0.8) {
            const puff = scene.add.image(
                x + (Math.random() - 0.5) * TILE,
                y + (Math.random() - 0.5) * TILE,
                MAP_FOG_KEY, 16 + Math.floor(Math.random() * PUFF_FRAMES),
            );
            const scale = 0.7 + Math.random() * 0.5;
            puff.setScale(scale).setAlpha(0.75 + Math.random() * 0.25);
            container.add(puff);
            scene.tweens.add({
                targets: puff,
                alpha: 0,
                y: puff.y - (6 + Math.random() * 8),
                scale: scale * 0.6,
                duration: 420 + Math.random() * 260,
                delay: rowDelay + Math.random() * 120,
                onComplete: () => puff.destroy(),
            });
        }
    }
}

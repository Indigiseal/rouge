// The road the player has walked this act, laid under the map's lines and nodes.
//
// Art: assets/art/road.png (a location may have its own: LOCATION_ROAD_SHEETS), 32x32 tiles, the 16-tile autotile from Taya's HoMM
// game (OverlayLayerSystem): frame = which sides the road opens to, N=1 E=2
// S=4 W=8, so 5 is the vertical straight, 10 the horizontal one and 3/6/9/12
// the corners. Row two holds extra straights (16-23 vertical, 24-31
// horizontal), mixed in so a long road does not repeat.
//
// Rooms sit at free positions, not on a 32px grid, so each walked step is laid
// as a HoMM road would be: down from the room, a corner, across to the next
// room's lane, a corner, and down into it. Straight runs overlap a little to
// fit their length exactly. Baked into one texture like the map's lines, so it
// snaps to whole pixels and never jitters.

export const ROAD_KEY = 'mapRoad';
const TILE = 32;
const N = 1, E = 2, S = 4, W = 8;
const VERTICAL = [5, 16, 17, 18, 19, 20, 21, 22, 23];
const HORIZONTAL = [10, 24, 25, 26, 27, 28, 29, 30, 31];

// A location with a road of its own (same 16-tile layout; the extra straights
// of row two are optional). Every other location walks road.png.
const LOCATION_ROAD_SHEETS = Object.freeze({
    ashhowl: 'mapRoadAsh', // roadAsh.png: the fire location's road (Taya)
});

/** The road sheet for a location id: its own when loaded, else the usual road. */
export function roadSheetFor(scene, locationId) {
    const own = LOCATION_ROAD_SHEETS[locationId];
    return own && scene.textures.exists(own) ? own : ROAD_KEY;
}

// A sheet without row two has no extra straights: they fall back to the plain one.
function drawableFrame(scene, sheet, frame) {
    if (frame < 16 || scene.textures.get(sheet).has(frame)) return frame;
    return frame < 24 ? 5 : 10;
}

// The corner tiles fill their whole square with dirt shoulder outside the bend,
// which read as square patches on the map (Taya). Each is cut round once, from
// the tile itself: anything farther from the bend's inner corner than the road's
// outer rim (31.5px) is cleared. road.png stays as drawn.
const CORNER_RADIUS = 31.5;
const CORNER_PIVOT = { [N | E]: [TILE, 0], [E | S]: [TILE, TILE], [N | W]: [0, 0], [S | W]: [0, TILE] };
const cornerKey = (sheet, mask) => `${sheet}Corner${mask}`;

function ensureRoundCorners(scene, sheetKey) {
    const sheet = scene.textures.get(sheetKey);
    for (const [mask, [cx, cy]] of Object.entries(CORNER_PIVOT)) {
        const key = cornerKey(sheetKey, mask);
        if (scene.textures.exists(key)) continue;
        const frame = sheet.get(Number(mask));
        const texture = scene.textures.createCanvas(key, TILE, TILE);
        const ctx = texture.getContext();
        ctx.drawImage(frame.source.image, frame.cutX, frame.cutY, TILE, TILE, 0, 0, TILE, TILE);
        const image = ctx.getImageData(0, 0, TILE, TILE);
        for (let y = 0; y < TILE; y++) {
            for (let x = 0; x < TILE; x++) {
                if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > CORNER_RADIUS) image.data[(y * TILE + x) * 4 + 3] = 0;
            }
        }
        ctx.putImageData(image, 0, 0);
        texture.refresh();
    }
}

// The same straight for the same spot every time the map is drawn.
function variant(list, x, y) {
    const h = Math.abs(((x * 73856093) ^ (y * 19349663)) | 0);
    return list[h % list.length];
}

// Centres from a to b (inclusive) no more than a tile apart.
function steps(a, b) {
    const count = Math.max(1, Math.ceil(Math.abs(b - a) / TILE));
    return Array.from({ length: count + 1 }, (_, k) => Math.round(a + ((b - a) * k) / count));
}

/**
 * The tiles for one walked step from room `a` down to room `b`, in the order a
 * walker meets them, each marked `corner` or not.
 */
function legTiles(a, b) {
    const path = [];
    // `skip`: centres a corner takes. A straight there would fill in the square
    // the round corner leaves clear.
    const down = (x, y1, y2, skip = []) => steps(y1, y2).filter((y) => !skip.includes(y))
        .forEach((y) => path.push({ x, y, frame: variant(VERTICAL, x, y), corner: false }));
    if (a.x === b.x) {
        down(a.x, a.y, b.y);
        return path;
    }
    const mid = Math.round((a.y + b.y) / 2);
    const right = b.x > a.x;
    down(a.x, a.y, mid, [mid]);
    // Turn out of the first lane, across, then into the second.
    path.push({ x: a.x, y: mid, frame: right ? N | E : N | W, corner: true });
    const across = steps(a.x, b.x).filter((x) => x !== a.x && x !== b.x);
    across.forEach((x) => path.push({ x, y: mid, frame: variant(HORIZONTAL, x, mid), corner: false }));
    path.push({ x: b.x, y: mid, frame: right ? S | W : S | E, corner: true });
    down(b.x, mid, b.y, [mid]);
    return path;
}

/** The same tiles split for baking: straights, then corners (drawn last, on top). */
function tilesBetween(a, b) {
    const path = legTiles(a, b);
    return { straights: path.filter((t) => !t.corner), corners: path.filter((t) => t.corner) };
}

/**
 * The rooms walked in order, top to bottom: one per row (the room stood in
 * counts), with a story stop between two rows when there is one.
 */
export function walkedRoute(floors, cursor, checkpointAfterRow = () => null) {
    const route = [];
    let previous = null;
    floors.forEach((row, f) => {
        const here = cursor && cursor.floor === f ? row[cursor.node] : null;
        const walked = row
            .map((n, index) => ({ n, index }))
            .filter(({ n }) => n && typeof n.__x === 'number' && (n.visited || n === here));
        if (!walked.length) return;
        // A row can hold two visited rooms (a secret room beside its row's
        // room): take the one the last room leads to, by road or secret door.
        const leadsHere = ({ index }) => (previous?.connections || []).includes(index)
            || (previous?.secretLinks || []).includes(index);
        const node = (walked.find(leadsHere) || walked.find(({ n }) => n === here) || walked[0]).n;
        previous = node;
        const last = route[route.length - 1];
        const stop = last && checkpointAfterRow(last.row);
        if (stop && typeof stop.__y === 'number') route.push({ x: stop.__x, y: stop.__y, row: last.row });
        route.push({ x: node.__x, y: node.__y, row: f });
    });
    return route;
}

/** Lay the walked road into `container`, under everything already in it, in `sheet`'s art. */
export function drawWalkedRoad(scene, container, route, sheet = ROAD_KEY) {
    if (!scene.textures.exists(sheet) || route.length < 2) return null;
    const straights = [];
    const corners = [];
    for (let i = 1; i < route.length; i++) {
        const part = tilesBetween(route[i - 1], route[i]);
        straights.push(...part.straights);
        corners.push(...part.corners);
    }
    const tiles = [...straights, ...corners];
    const half = TILE / 2;
    const minX = Math.min(...tiles.map((t) => t.x)) - half;
    const minY = Math.min(...tiles.map((t) => t.y)) - half;
    const maxX = Math.max(...tiles.map((t) => t.x)) + half;
    const maxY = Math.max(...tiles.map((t) => t.y)) + half;
    ensureRoundCorners(scene, sheet);
    const rt = scene.add.renderTexture(minX, minY, maxX - minX, maxY - minY).setOrigin(0, 0);
    // Corners last, so they sit cleanly on the straights that meet them, cut round.
    for (const t of straights) rt.drawFrame(sheet, drawableFrame(scene, sheet, t.frame), t.x - half - minX, t.y - half - minY);
    for (const t of corners) rt.drawFrame(cornerKey(sheet, t.frame), '__BASE', t.x - half - minX, t.y - half - minY);
    container.add(rt);
    container.sendToBack(rt);
    return rt;
}

// The road laid as the player picks a room: one tile after another, each
// popping into place, from where they stand to where they are going (Taya).
const LAY_STEP_MS = 45;
const LAY_TILE_MS = 110;

/**
 * Lay the road between the walked route `before` a pick and `after` it, tile by
 * tile, just over the baked road (`roadTexture`, or at the very back when there
 * is none yet). Returns how long it takes, in ms (0 when there is nothing new).
 */
export function layNewRoad(scene, container, before, after, roadTexture = null, sheet = ROAD_KEY) {
    if (!scene.textures.exists(sheet)) return 0;
    const fresh = after.slice(Math.max(0, before.length - 1));
    const path = [];
    for (let i = 1; i < fresh.length; i++) path.push(...legTiles(fresh[i - 1], fresh[i]));
    if (!path.length) return 0;
    ensureRoundCorners(scene, sheet);
    const images = path.map((t, order) => ({
        order,
        corner: t.corner,
        image: (t.corner
            ? scene.add.image(t.x, t.y, cornerKey(sheet, t.frame))
            : scene.add.image(t.x, t.y, sheet, drawableFrame(scene, sheet, t.frame)))
            .setAlpha(0).setScale(0.5),
    }));
    // Under the map's lines, like the baked road; corners over the straights.
    let at = roadTexture?.scene ? container.getIndex(roadTexture) + 1 : 0;
    for (const { image } of [...images.filter((t) => !t.corner), ...images.filter((t) => t.corner)]) {
        container.addAt(image, at++);
    }
    for (const { image, order } of images) {
        scene.tweens.add({
            targets: image, alpha: 1, scale: 1, delay: order * LAY_STEP_MS, duration: LAY_TILE_MS, ease: 'Back.easeOut',
            onComplete: () => image.setPosition(Math.round(image.x), Math.round(image.y)),
        });
    }
    return (path.length - 1) * LAY_STEP_MS + LAY_TILE_MS;
}

// The road the player has walked this act, laid under the map's lines and nodes.
//
// Art: assets/art/road.png, 32x32 tiles, the 16-tile autotile from Taya's HoMM
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

// The corner tiles fill their whole square with dirt shoulder outside the bend,
// which read as square patches on the map (Taya). Each is cut round once, from
// the tile itself: anything farther from the bend's inner corner than the road's
// outer rim (31.5px) is cleared. road.png stays as drawn.
const CORNER_RADIUS = 31.5;
const CORNER_PIVOT = { [N | E]: [TILE, 0], [E | S]: [TILE, TILE], [N | W]: [0, 0], [S | W]: [0, TILE] };
const cornerKey = (mask) => `${ROAD_KEY}Corner${mask}`;

function ensureRoundCorners(scene) {
    const sheet = scene.textures.get(ROAD_KEY);
    for (const [mask, [cx, cy]] of Object.entries(CORNER_PIVOT)) {
        const key = cornerKey(mask);
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

/** The tiles for one walked step from room `a` down to room `b`: straights, then corners. */
function tilesBetween(a, b) {
    const straights = [];
    const corners = [];
    // `skip`: centres a corner takes. A straight there would fill in the square
    // the round corner leaves clear.
    const down = (x, y1, y2, skip = []) => steps(y1, y2).filter((y) => !skip.includes(y))
        .forEach((y) => straights.push({ x, y, frame: variant(VERTICAL, x, y) }));
    if (a.x === b.x) {
        down(a.x, a.y, b.y);
        return { straights, corners };
    }
    const mid = Math.round((a.y + b.y) / 2);
    const right = b.x > a.x;
    down(a.x, a.y, mid, [mid]);
    steps(a.x, b.x).filter((x) => x !== a.x && x !== b.x)
        .forEach((x) => straights.push({ x, y: mid, frame: variant(HORIZONTAL, x, mid) }));
    down(b.x, mid, b.y, [mid]);
    // Turn out of the first lane, then into the second.
    corners.push({ x: a.x, y: mid, frame: right ? N | E : N | W });
    corners.push({ x: b.x, y: mid, frame: right ? S | W : S | E });
    return { straights, corners };
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

/** Lay the walked road into `container`, under everything already in it. */
export function drawWalkedRoad(scene, container, route) {
    if (!scene.textures.exists(ROAD_KEY) || route.length < 2) return null;
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
    ensureRoundCorners(scene);
    const rt = scene.add.renderTexture(minX, minY, maxX - minX, maxY - minY).setOrigin(0, 0);
    // Corners last, so they sit cleanly on the straights that meet them, cut round.
    for (const t of straights) rt.drawFrame(ROAD_KEY, t.frame, t.x - half - minX, t.y - half - minY);
    for (const t of corners) rt.drawFrame(cornerKey(t.frame), '__BASE', t.x - half - minX, t.y - half - minY);
    container.add(rt);
    container.sendToBack(rt);
    return rt;
}

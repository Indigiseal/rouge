// ui/NineSlicePanel.js
// Shared nine-slice frame for hover tooltips, plus the four-corner "pick this
// one" bracket used on the map.
//
// The frame TILES rather than stretches. Phaser's built-in NineSlice scales its
// edge strips, which smears any drawn detail along them; the panel art carries
// decoration on its top and bottom edges, so instead we lay out nine pieces by
// hand and let TileSprite repeat the edges and centre at their native size.
//
// Both helpers degrade gracefully: if the texture hasn't loaded, callers still
// get a plain rectangle back, so nothing disappears from the screen.

// Slice insets for panelText9Slice.png, measured off the source pixels. The art
// is 48x48: a 5px border on the top/left/right, and a 7px bottom edge carrying
// the drawn shadow.
export const TOOLTIP_PANEL_KEY = 'panelText9Slice';
export const TOOLTIP_PANEL_SLICE = { left: 5, right: 5, top: 5, bottom: 7 };

// Body/label ink for anything drawn on the panel. The frame's fill is light, so
// tooltip text reads dark rather than the pale colours used before it existed.
export const TOOLTIP_TEXT_COLOR = '#383348';

// Colours for the fallback rectangle — the previous hand-drawn tooltip look.
const FALLBACK_FILL = 0x1a120a;
const FALLBACK_STROKE = 0xb89968;

// Frame names registered on the source texture, in layout order.
const PIECES = ['tl', 'tm', 'tr', 'ml', 'mm', 'mr', 'bl', 'bm', 'br'];
const framePrefix = key => `__panel9_${key}_`;

/**
 * Carves the source texture into the nine regions once and caches them as
 * named frames. Returns false if the texture is missing or too small to slice.
 */
function ensureFrames(scene, key, slice) {
    const tex = scene.textures?.get?.(key);
    if (!tex || !tex.source?.[0]) return false;

    const W = tex.source[0].width;
    const H = tex.source[0].height;
    const innerW = W - slice.left - slice.right;
    const innerH = H - slice.top - slice.bottom;
    if (innerW <= 0 || innerH <= 0) return false;

    const p = framePrefix(key);
    if (tex.has(`${p}mm`)) return true;

    const cols = [
        { x: 0, w: slice.left },
        { x: slice.left, w: innerW },
        { x: W - slice.right, w: slice.right },
    ];
    const rows = [
        { y: 0, h: slice.top },
        { y: slice.top, h: innerH },
        { y: H - slice.bottom, h: slice.bottom },
    ];

    PIECES.forEach((name, i) => {
        const c = cols[i % 3];
        const r = rows[Math.floor(i / 3)];
        tex.add(`${p}${name}`, 0, c.x, r.y, c.w, r.h);
    });
    return true;
}

/**
 * Tooltip background sized to `width` x `height`, anchored top-left so it drops
 * straight into the existing container-relative layouts.
 *
 * Returns a Container of tiled pieces when the art is available, and a
 * Rectangle otherwise. Callers only use setPosition/destroy, which both support.
 */
export function createTooltipPanel(scene, width, height, opts = {}) {
    const {
        fillColor = FALLBACK_FILL,
        strokeColor = FALLBACK_STROKE,
        key = TOOLTIP_PANEL_KEY,
        slice = TOOLTIP_PANEL_SLICE,
    } = opts;

    const w = Math.ceil(width);
    const h = Math.ceil(height);

    // Below the combined border the edges would overlap, so fall back instead.
    const minW = slice.left + slice.right + 1;
    const minH = slice.top + slice.bottom + 1;

    if (!scene.add?.tileSprite || w < minW || h < minH || !ensureFrames(scene, key, slice)) {
        return scene.add.rectangle(0, 0, w, h, fillColor, 0.95)
            .setStrokeStyle(1, strokeColor)
            .setOrigin(0, 0);
    }

    const p = framePrefix(key);
    const innerW = w - slice.left - slice.right;
    const innerH = h - slice.top - slice.bottom;

    const xs = [0, slice.left, w - slice.right];
    const ys = [0, slice.top, h - slice.bottom];
    const ws = [slice.left, innerW, slice.right];
    const hs = [slice.top, innerH, slice.bottom];

    // Corners keep their exact pixels; edges and centre repeat theirs.
    const pieces = PIECES.map((name, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const isCorner = col !== 1 && row !== 1;
        const frame = `${p}${name}`;

        if (isCorner) {
            return scene.add.image(xs[col], ys[row], key, frame).setOrigin(0, 0);
        }
        return scene.add
            .tileSprite(xs[col], ys[row], ws[col], hs[row], key, frame)
            .setOrigin(0, 0);
    });

    return scene.add.container(0, 0, pieces);
}

export const CORNER_SELECT_KEY = 'cornerSelect';

/**
 * Four selection brackets framing a point, built by mirroring the single
 * top-left corner sprite on each axis.
 *
 * `offset` is the distance from the centre to each corner's centre — pass a bit
 * under half the node's width so the brackets hug the art instead of floating.
 * Returns the sprites (empty array if the texture is missing) so the caller can
 * add them to a container and tween them as a group.
 */
export function createSelectionCorners(scene, x, y, offset, opts = {}) {
    const { key = CORNER_SELECT_KEY, tint = null, alpha = 1, depth = null } = opts;
    if (!scene?.add || !scene.textures?.exists(key)) return [];

    // flipX/flipY around the centred origin turn the one drawn corner into all
    // four: TL as authored, TR mirrored, BL flipped, BR both.
    const corners = [
        { dx: -1, dy: -1, flipX: false, flipY: false },
        { dx:  1, dy: -1, flipX: true,  flipY: false },
        { dx: -1, dy:  1, flipX: false, flipY: true  },
        { dx:  1, dy:  1, flipX: true,  flipY: true  },
    ];

    return corners.map(c => {
        const sprite = scene.add.image(
            Math.round(x + c.dx * offset),
            Math.round(y + c.dy * offset),
            key
        )
            .setOrigin(0.5)
            .setFlip(c.flipX, c.flipY)
            .setAlpha(alpha);
        if (tint !== null && sprite.setTint) sprite.setTint(tint);
        if (depth !== null) sprite.setDepth(depth);
        return sprite;
    });
}

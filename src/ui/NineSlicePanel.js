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

// Text inset that clears the drawn frame. Top and bottom differ because the
// art's bottom edge carries the shadow and is 2px taller. Every tooltip in the
// game lays its text out inside these, so a change to the frame art moves all
// of them together.
export const TOOLTIP_PAD = { x: 8, top: 7, bottom: 9 };

// Body type for tooltip text, so the bag, the HUD panels and the board all
// answer a hover in the same size.
export const TOOLTIP_BODY_PX = '10px';

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

// The gaming board, sliced so it can grow with the formation standing on it.
// Measured off gamingBoard.png (366x304): rows 181-287 are 107 byte-identical
// rows and cols 194-238 are 45 byte-identical columns, so those two bands are
// the ones that repeat. Everything outside them — the branch ornaments over the
// top corners and the bottom lip — rides in the caps at its authored size.
//
// The bands are off-centre (the left cap is 194px against the right's 127) and
// that is fine: they are flat fill, so the seam lands where there is no drawn
// detail to interrupt. The numbers must keep summing to the source dimensions.
export const BOARD_PANEL_KEY = 'gamingBoard';
export const BOARD_PANEL_SLICE = { left: 194, right: 127, top: 181, bottom: 16 };

/**
 * Nine-slice panel centred on its own origin, sized to `width` x `height`.
 *
 * Unlike createTooltipPanel this anchors at the centre, because the things that
 * want it (the board) are positioned by their middle. Returns null rather than
 * a fallback shape when it cannot build — the caller already has a plain image
 * to fall back to, and a stand-in rectangle behind the cards would read as a
 * bug rather than as degraded art.
 */
export function createNineSlicePanel(scene, width, height, opts = {}) {
    const { key, slice } = opts;
    if (!scene?.add?.tileSprite || !key || !slice) return null;

    // Even dimensions only: the pieces are laid out from -w/2, and an odd size
    // would put every one of them on a half pixel.
    const w = Math.ceil(width / 2) * 2;
    const h = Math.ceil(height / 2) * 2;
    if (w < slice.left + slice.right + 1) return null;
    if (h < slice.top + slice.bottom + 1) return null;
    if (!ensureFrames(scene, key, slice)) return null;

    const p = framePrefix(key);
    const ws = [slice.left, w - slice.left - slice.right, slice.right];
    const hs = [slice.top, h - slice.top - slice.bottom, slice.bottom];
    const xs = [-w / 2, -w / 2 + ws[0], w / 2 - ws[2]];
    const ys = [-h / 2, -h / 2 + hs[0], h / 2 - hs[2]];

    const pieces = PIECES.map((name, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const frame = `${p}${name}`;
        // Corners keep their exact pixels; edges and centre repeat theirs.
        // Tiling rather than stretching is the house habit (see the note at the
        // top of this file) and costs nothing here, because both bands are a
        // single repeated row/column of flat colour either way.
        if (col !== 1 && row !== 1) {
            return scene.add.image(xs[col], ys[row], key, frame).setOrigin(0, 0);
        }
        return scene.add
            .tileSprite(xs[col], ys[row], ws[col], hs[row], key, frame)
            .setOrigin(0, 0);
    });

    const container = scene.add.container(0, 0, pieces);
    // Without this the container reports zero size and callers reading
    // displayWidth (the board's overflow check) would size their wings to it.
    container.setSize(w, h);
    return container;
}

// ---------------------------------------------------------------------------
// Minigame window chrome (assets/ui/)
// ---------------------------------------------------------------------------

// paneDarkl9x9.png is 48x48 authored as a nine-slice on a 16x16 grid: three
// cells across, three down. The drawn border only occupies the outer 2px of
// each edge cell — bright orange across the top, mid brown down the sides, a
// dark red lip along the bottom — but the SLICE is the full 16px cell.
//
// Slicing on the drawn border instead (2px) looks identical on a flat panel
// and is still wrong: it drops everything from x2..x45 into the tiling centre
// cell, including the faint speck the art carries near its top-right corner.
// That speck is corner decoration meant to appear once; in the centre cell it
// repeats with every tile — 77 copies at this window's size. On the 16px grid
// it stays in the top-right corner where it was drawn.
export const UI_PANEL_KEY = 'uiPanelDark';
export const UI_PANEL_CELL = 16;
export const UI_PANEL_SLICE = { left: 16, right: 16, top: 16, bottom: 16 };

// barSlice.png is 48x64 holding the SAME lozenge twice: the empty track at
// rows 9-22 and the filled state at rows 42-55, 14px tall each. Both have a
// 7px chamfered cap at each end and 34 identical columns between them, so the
// caps ride at native size and only the middle repeats.
// bannerEvents.png is 256x48 and is NOT sliced: the ribbon body carries
// painted highlights and the tails are drawn, so it rides at its authored
// width and whatever sits on it is centred by the caller.
export const UI_BANNER_KEY = 'uiBanner';

export const UI_BAR_KEY = 'uiBar';
export const UI_BAR = { h: 14, cap: 7, emptyY: 9, fillY: 42, srcW: 48 };

const barFrame = (state, part) => `__uibar_${state}_${part}`;

// Carve the two states into caps and middles once per texture.
function ensureBarFrames(scene, key) {
    const tex = scene.textures?.get?.(key);
    if (!tex || !tex.source?.[0]) return false;
    if (tex.has(barFrame('fill', 'm'))) return true;

    const { h, cap, emptyY, fillY, srcW } = UI_BAR;
    const midW = srcW - cap * 2;
    [['empty', emptyY], ['fill', fillY]].forEach(([state, y]) => {
        tex.add(barFrame(state, 'l'), 0, 0, y, cap, h);
        tex.add(barFrame(state, 'm'), 0, cap, y, midW, h);
        tex.add(barFrame(state, 'r'), 0, srcW - cap, y, cap, h);
    });
    return true;
}

// One state of the bar, sliced to `width`: two caps at their authored pixels
// and a repeating middle. Pieces are returned with their local x ranges so the
// fill can be cropped against them.
function buildBarState(scene, key, state, width) {
    const { h, cap } = UI_BAR;
    const midW = width - cap * 2;
    const left = scene.add.image(-width / 2, -h / 2, key, barFrame(state, 'l')).setOrigin(0, 0);
    const mid = scene.add
        .tileSprite(-width / 2 + cap, -h / 2, midW, h, key, barFrame(state, 'm'))
        .setOrigin(0, 0);
    const right = scene.add.image(width / 2 - cap, -h / 2, key, barFrame(state, 'r')).setOrigin(0, 0);
    return [
        { obj: left, x: 0, w: cap },
        { obj: mid, x: cap, w: midW },
        { obj: right, x: cap + midW, w: cap },
    ];
}

/**
 * Timer/progress bar built from the two states in barSlice.png.
 *
 * Returns { container, setFraction, destroy }, or null when the art is missing
 * or the requested width cannot hold both caps — callers fall back to the plain
 * rectangles they drew before.
 *
 * setFraction crops the filled pieces rather than resizing them, so the fill
 * ends on a straight vertical edge and the track's chamfered right cap stays
 * put as it drains. Resizing the fill instead would drag a second chamfer
 * leftwards across the bar, which is not what the art draws.
 */
export function createUiBar(scene, width, opts = {}) {
    const { key = UI_BAR_KEY } = opts;
    const { h, cap } = UI_BAR;
    // Even width, for the same half-pixel reason as createNineSlicePanel.
    const w = Math.ceil(width / 2) * 2;
    if (!scene?.add?.tileSprite || w < cap * 2 + 2) return null;
    if (!ensureBarFrames(scene, key)) return null;

    const track = buildBarState(scene, key, 'empty', w);
    const fill = buildBarState(scene, key, 'fill', w);
    const container = scene.add.container(0, 0, [...track, ...fill].map((p) => p.obj));
    container.setSize(w, h);

    const setFraction = (value) => {
        const f = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
        const edge = w * f;
        fill.forEach(({ obj, x, w: pw }) => {
            if (!obj.scene) return;
            const visible = Math.round(Math.max(0, Math.min(pw, edge - x)));
            if (visible <= 0) { obj.setVisible(false); return; }
            obj.setVisible(true);
            // A piece showing all of itself must carry no crop at all: a crop
            // the exact width of a TileSprite still clips its last column on
            // some drivers, which reads as a one-pixel gap mid-bar.
            if (visible >= pw) obj.setCrop?.();
            else obj.setCrop(0, 0, visible, h);
        });
    };
    setFraction(1);

    // Recolour the filled state only. The track underneath keeps its own
    // colour, so a warning tint reads against it instead of staining the
    // whole bar.
    const setFillTint = (color) => {
        fill.forEach(({ obj }) => {
            if (!obj.scene) return;
            if (color == null) obj.clearTint?.();
            else obj.setTint?.(color);
        });
    };

    return {
        container,
        setFraction,
        setFillTint,
        destroy: () => { try { container.destroy(); } catch (_) { /* gone */ } },
    };
}

export const CORNER_SELECT_KEY = 'cornerSelect';

/**
 * Four selection brackets framing a point, built by mirroring the single
 * top-left corner sprite on each axis.
 *
 * `offset` is the distance from the centre to each corner's centre — pass a bit
 * under half the node's width so the brackets hug the art instead of floating.
 * A non-square target (a card) passes `{ x, y }` to set each axis separately.
 * Returns the sprites (empty array if the texture is missing) so the caller can
 * add them to a container and tween them as a group.
 */
export function createSelectionCorners(scene, x, y, offset, opts = {}) {
    const { key = CORNER_SELECT_KEY, tint = null, alpha = 1, depth = null } = opts;
    if (!scene?.add || !scene.textures?.exists(key)) return [];
    const offX = typeof offset === 'number' ? offset : offset.x;
    const offY = typeof offset === 'number' ? offset : offset.y;

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
            Math.round(x + c.dx * offX),
            Math.round(y + c.dy * offY),
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

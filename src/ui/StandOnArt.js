// Stand an image on the bottom of its own drawing, not on the bottom of its
// frame. The Sanctuary's statues sit in cells taller than some of them (Taya
// grew the sheet to 128x144 for a bigger Phoenix): anchored on the frame's
// bottom edge, the shorter ones floated above their spots. The lowest opaque
// row of each frame is found once and cached.

const bottoms = new Map();

/** One past the lowest opaque row of `key`/`frame`, in the frame's pixels. */
function artBottom(scene, key, frame) {
    const id = `${key}|${frame ?? ''}`;
    if (bottoms.has(id)) return bottoms.get(id);
    const f = scene.textures.getFrame(key, frame);
    const w = f?.cutWidth || 0;
    const h = f?.cutHeight || 0;
    let bottom = h;
    try {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(f.source.image, f.cutX, f.cutY, w, h, 0, 0, w, h);
        const alpha = ctx.getImageData(0, 0, w, h).data;
        bottom = 0;
        for (let y = h - 1; y >= 0 && !bottom; y--) {
            for (let x = 0; x < w; x++) {
                if (alpha[(y * w + x) * 4 + 3] > 0) { bottom = y + 1; break; }
            }
        }
        if (!bottom) bottom = h;
    } catch { /* no pixels to read: the frame's own bottom */ }
    bottoms.set(id, bottom);
    return bottom;
}

/** Anchor `image` (centred across) on the bottom of what is drawn in its current frame. */
export function standOnArt(image) {
    if (!image?.frame || !image.scene) return image;
    const h = image.frame.cutHeight || image.height;
    if (!h) return image;
    return image.setOrigin(0.5, artBottom(image.scene, image.texture.key, image.frame.name) / h);
}

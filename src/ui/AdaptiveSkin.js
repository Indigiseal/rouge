// Resize horizontal UI art while preserving its ends and optional central ornament.
// Cache assembled skins so normal Phaser Images retain tint, input and texture swaps.
export function horizontalSkin(scene, key, width, { cap = 16, center = 0 } = {}) {
    const texture = scene.textures.get(key);
    const frame = texture.get();
    const w = frame.cutWidth, h = frame.cutHeight;
    const target = Math.max(w, Math.ceil(width / 2) * 2);
    if (target === w) return key;
    cap = Math.min(cap, Math.floor((w - center - 2) / 2));
    const cacheKey = `__horizontal_${key}_${target}_${cap}_${center}`;
    if (scene.textures.exists(cacheKey)) return cacheKey;
    const canvas = scene.textures.createCanvas(cacheKey, target, h);
    const ctx = canvas.context;
    ctx.imageSmoothingEnabled = false;
    const source = texture.getSourceImage(frame.sourceIndex);
    const draw = (sx, sw, dx, dw) => ctx.drawImage(source,
        frame.cutX + sx, frame.cutY, sw, h, dx, 0, dw, h);
    draw(0, cap, 0, cap);
    draw(w - cap, cap, target - cap, cap);
    if (center) {
        const middle = Math.floor((w - center) / 2);
        const dest = Math.floor((target - center) / 2);
        draw(cap, middle - cap, cap, dest - cap);
        draw(middle, center, dest, center);
        draw(middle + center, w - middle - center - cap, dest + center, target - dest - center - cap);
    } else {
        draw(cap, w - 2 * cap, cap, target - 2 * cap);
    }
    canvas.refresh();
    return cacheKey;
}

// Shrink by whole pixels, then wrap if a future translation still exceeds its box.
export function fitTextBox(text, width, height = Infinity, minSize = 11) {
    const start = parseInt(text.style.fontSize, 10);
    for (let size = start; size >= minSize; size--) {
        text.setFontSize(size);
        if (text.width <= width && text.height <= height) return;
    }
    text.setWordWrapWidth(width, true);
    for (let size = minSize; size > 8 && text.height > height; size--) text.setFontSize(size - 1);
}

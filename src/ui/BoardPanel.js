// Expanded combat boards are composed once into a single texture. Repeat the
// edge/interior pixels at native scale; keep all four corner regions intact.
// This avoids both stretching location ornaments and drawing separately
// animated pieces (or legacy wings) over an otherwise complete board.
export function createBoardPanel(scene, width, height, { key, slice } = {}) {
    if (!key || !slice || !scene.textures?.exists?.(key)) return null;
    const source = scene.textures.get(key).getSourceImage();
    const sw = source?.width, sh = source?.height;
    const w = Math.ceil(width / 2) * 2, h = Math.ceil(height / 2) * 2;
    if (!sw || !sh || w < sw || h < sh) return null;
    if (w === sw && h === sh) return scene.add.image(0, 0, key);

    const { left, right, top, bottom } = slice;
    if (left + right >= sw || top + bottom >= sh) return null;
    const textureKey = `__board_${key}_${w}x${h}_${left}_${right}_${top}_${bottom}`;
    if (!scene.textures.exists(textureKey)) {
        if (!scene.textures.createCanvas) return null;
        const texture = scene.textures.createCanvas(textureKey, w, h);
        const ctx = texture.context;
        ctx.imageSmoothingEnabled = false;
        const sx = [0, left, sw - right], sy = [0, top, sh - bottom];
        const widths = [left, sw - left - right, right];
        const heights = [top, sh - top - bottom, bottom];
        const dx = [0, left, w - right], dy = [0, top, h - bottom];
        const outWidths = [left, w - left - right, right];
        const outHeights = [top, h - top - bottom, bottom];
        for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
            const sourceW = widths[col], sourceH = heights[row];
            for (let y = 0; y < outHeights[row]; y += sourceH) {
                for (let x = 0; x < outWidths[col]; x += sourceW) {
                    const copyW = Math.min(sourceW, outWidths[col] - x);
                    const copyH = Math.min(sourceH, outHeights[row] - y);
                    ctx.drawImage(source, sx[col], sy[row], copyW, copyH,
                        dx[col] + x, dy[row] + y, copyW, copyH);
                }
            }
        }
        texture.refresh();
    }
    return scene.add.image(0, 0, textureKey);
}

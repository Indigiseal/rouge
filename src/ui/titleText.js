// Screen and room headings share the reading face, including locale fallbacks.
import { FONT_SIZE, serifStyle } from './uiFont.js';

export function createTitle(scene, x, y, text, options = {}) {
    const object = scene.add.text(x, y, String(text ?? ''),
        serifStyle(FONT_SIZE.heading, options.color || '#ffffff')).setOrigin(0.5);
    if (options.depth !== undefined) object.setDepth(options.depth);
    return object;
}

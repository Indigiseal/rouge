// Screen and room headings share the reading face, including locale fallbacks.
import { FONT_SIZE, serifStyle } from './uiFont.js';
import { fitTextBox, horizontalSkin } from './AdaptiveSkin.js';

export function createTitle(scene, x, y, text, options = {}) {
    const object = scene.add.text(x, y, String(text ?? ''),
        serifStyle(FONT_SIZE.heading, options.color || '#fef0cf')).setOrigin(0.5);
    if (options.bannerKey && scene.textures.exists(options.bannerKey)) {
        const nativeWidth = scene.textures.get(options.bannerKey).get().cutWidth;
        const padding = options.padding ?? 56;
        const limit = options.maxWidth ?? 360;
        // A small font adjustment comes before extending the ribbon.
        if (object.width > nativeWidth - padding) object.setFontSize(18);
        const width = Math.min(limit, Math.max(nativeWidth, object.width + padding));
        const key = horizontalSkin(scene, options.bannerKey, width, { cap: 64, center: 80 });
        object.banner = scene.add.image(x, options.bannerY ?? y + 2, key);
        object.banner.setDepth(options.depth !== undefined ? options.depth - 1 : 0);
        fitTextBox(object, object.banner.width - padding, 28, 14);
        object.setDepth(options.depth ?? 1);
    } else {
        fitTextBox(object, options.maxWidth ?? 480, 44, 14);
        if (options.depth !== undefined) object.setDepth(options.depth);
    }
    return object;
}

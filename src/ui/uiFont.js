// The UI type scale, in one place.
//
// Sizes were drifting — screen headings at 20px, the options heading at 24px,
// the reset plate on a different font entirely — so every size the interface
// uses is named here and imported rather than written out at the call site.
//
// These are world units. The canvas renders at PIXEL_SCALE times this size
// (see config/renderScale.js), so 11px is drawn with 22 real pixels of detail.
// That is why small sizes are legible now when they were not before.

import { PIXEL_SCALE } from '../config/renderScale.js';

export const UI_SERIF = '"Garamond UI", Georgia, serif';

export const FONT_SIZE = {
    /** Screen and panel headings: "Options", "Rare Goods", event titles. */
    heading: '20px',
    /** Everything else — field labels, button labels, readouts. */
    body: '16px',
    /**
     * Floor for labels that had to shrink. Nothing sets this directly — see
     * fitLabel, which steps a label down until it fits the art it sits on.
     */
    small: '11px',
};

/**
 * Text style for the UI serif.
 *
 * `resolution` is what keeps it sharp: the camera magnifies by PIXEL_SCALE, so
 * text rasterized at 1x would be blown up and go soft. Rasterizing at the same
 * factor lands one texture pixel on one screen pixel.
 *
 * `useCanvasText` gets past the text factory PreloadScene installs, which
 * otherwise returns bitmap text that cannot use a TTF at all.
 */
export function serifStyle(size, color) {
    return {
        fontSize: size,
        fill: color,
        fontFamily: UI_SERIF,
        resolution: PIXEL_SCALE,
        useCanvasText: true,
    };
}

/**
 * Add a line of serif text to a scene.
 *
 * The game runs two type tiers on purpose:
 *
 *   serif  — text you read: menus, options, headings, story prose, the talent
 *            tree. Real typeface, rendered at PIXEL_SCALE so it is sharp.
 *   bitmap — text you glance at: floating combat numbers, card labels, HUD
 *            counters. Drawn by the text factory PreloadScene installs.
 *
 * The split is not only taste. Bitmap text batches on the GPU while every
 * canvas Text object carries its own texture, and combat spawns floating
 * numbers constantly. The serif is also 25-90% wider at the same nominal size,
 * so it does not fit layouts that were spaced for the pixel font.
 *
 * Use this for the first tier; leave scene.add.text alone for the second.
 */
export function serifText(scene, x, y, text, { size = FONT_SIZE.body, color = '#ffffff', origin = 0.5 } = {}) {
    const obj = scene.add.text(x, y, text, serifStyle(size, color));
    return Array.isArray(origin) ? obj.setOrigin(origin[0], origin[1]) : obj.setOrigin(origin);
}

/** Sizes a label may shrink through, largest first. */
const FIT_STEPS = ['16px', '15px', '14px', '13px', '12px', '11px', '10px'];

/**
 * Shrink a label until it fits the width available, and report the size used.
 *
 * The button plates were drawn for the old pixel font, which is much narrower
 * than a serif — "Sitio de pruebas" needs 85px on a 90px plate where "Test
 * Site" needed 47. Rather than shorten copy to suit the art, or leave one
 * language overflowing, a label that will not fit steps down a size at a time.
 *
 * Only shrinks. A label that already fits is left alone, so nothing that looks
 * right today changes.
 *
 * @param {Phaser.GameObjects.Text} text
 * @param {number} maxWidth  room available, in world units
 * @param {string} [startSize]  size it was created at
 */
export function fitLabel(text, maxWidth, startSize = FONT_SIZE.body) {
    if (!text?.setFontSize || text.width <= maxWidth) return startSize;
    const from = FIT_STEPS.indexOf(startSize);
    for (const size of FIT_STEPS.slice(from < 0 ? 0 : from + 1)) {
        text.setFontSize(size);
        if (text.width <= maxWidth) return size;
    }
    return FIT_STEPS[FIT_STEPS.length - 1];
}

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
     * Only for labels their art is too small to hold at body size. Right now
     * that is the reset plate alone: it is 128px wide and its warning badge
     * takes 27 of them, leaving ~90px, while "Сбросить прогресс" needs 129px at
     * body size. Widen that plate to ~160px and this size can retire.
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

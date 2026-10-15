// ui/SigilIcons.js
// A card's sigils drawn in its top-right corner: one 16x16 icon per sigil,
// stacked downward, with a small level number when a sigil is above level 1
// (Thorns 2). The same look on the player's cards and on enemies.
//
// Returns the objects, positioned and unparented: the caller adds them to its
// own container (enemy stats, an anvil card face) or pins them to the card
// (the bag), so they move with it.

import { SIGIL_ICONS_KEY, getSigil } from '../content/sigils/sigils.js';

const ICON = 16;
const STEP = 14;      // icons overlap a little so two fit beside the art
const INSET = 1;      // from the card's top and right edges

/**
 * Where the first icon's centre sits for a card of this size, relative to the
 * card's centre: tucked into the top-right corner.
 */
export function sigilCornerOffset(cardWidth = 52, cardHeight = 70) {
    return {
        x: Math.round(cardWidth / 2 - ICON / 2 - INSET),
        y: Math.round(-cardHeight / 2 + ICON / 2 + INSET),
    };
}

// Art whose top is only a thin line — the Spider Queen hangs from a thread —
// would put the corner icons out on that line. The body starts at the first
// row at least this share of the art's width; measured once per frame.
const BODY_MIN_SPAN = 0.1;
// A few thin rows (horn tips, a crown point) don't count — only a long line.
const BODY_MIN_SKIP = 12;
const bodyTopCache = new Map();

/**
 * How far down a texture frame (in its own pixels) the art's body starts,
 * skipping a thin thread or antenna on top. 0 when there is none, or when the
 * pixels can't be read.
 */
export function artBodyTop(scene, key, frame) {
    const cacheKey = `${key}|${frame ?? ''}`;
    if (bodyTopCache.has(cacheKey)) return bodyTopCache.get(cacheKey);
    let top = 0;
    try {
        const f = scene.textures.getFrame(key, frame);
        const img = f?.source?.image;
        const w = f?.cutWidth || 0;
        const h = f?.cutHeight || 0;
        if (img && w && h && typeof document !== 'undefined') {
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, f.cutX, f.cutY, w, h, 0, 0, w, h);
            const alpha = ctx.getImageData(0, 0, w, h).data;
            const minSpan = w * BODY_MIN_SPAN;
            for (let y = 0; y < h; y++) {
                let left = -1;
                let right = -1;
                for (let x = 0; x < w; x++) {
                    if (alpha[(y * w + x) * 4 + 3] > 0) {
                        if (left < 0) left = x;
                        right = x;
                    }
                }
                if (left >= 0 && right - left + 1 >= minSpan) { top = y >= BODY_MIN_SKIP ? y : 0; break; }
            }
        }
    } catch {
        top = 0;
    }
    bodyTopCache.set(cacheKey, top);
    return top;
}

/**
 * Build the icons for `sigils` ([{ id, level }]) with the first one centred at
 * (x, y). Missing icon sheet → nothing.
 */
export function buildSigilIcons(scene, sigils, x, y) {
    if (!scene?.add || !Array.isArray(sigils) || !sigils.length) return [];
    if (!scene.textures?.exists?.(SIGIL_ICONS_KEY)) return [];
    const out = [];
    sigils.forEach((s, i) => {
        const def = getSigil(s.id);
        if (!def) return;
        const iy = Math.round(y + i * STEP);
        out.push(scene.add.image(Math.round(x), iy, SIGIL_ICONS_KEY, def.frame));
        if ((s.level || 1) > 1) {
            out.push(scene.add.text(Math.round(x) + 5, iy + 4, String(s.level), {
                fontSize: '8px',
                fill: '#fef0cf',
                fontFamily: '"HoMM Pixel"',
                stroke: '#1b0b09',
                strokeThickness: 2,
            }).setOrigin(0.5));
        }
    });
    return out;
}

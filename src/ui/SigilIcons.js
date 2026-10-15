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

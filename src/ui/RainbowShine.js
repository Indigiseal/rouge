// ui/RainbowShine.js
// A starred Legendary's hover shine (legendaryStars.js) is the rainbow one
// Taya drew: the second row of hoverCardsUp54x70Sheet.png, the same sweep as
// the plain shine in the first row, in rainbow stripes. A bag card's shine
// sprite is marked once when the card is built; every place that plays the
// shine asks hoverShineAnim() which sweep to play.

export const HOVER_SHINE_ANIM = 'hover_cards_anim';
export const RAINBOW_SHINE_ANIM = 'hover_cards_rainbow_anim';

/**
 * Mark `sprite` (a card's hover shine) as the rainbow one. It draws normally,
 * not in SCREEN like the plain shine: the stripes are pastel at ~44% opacity,
 * and SCREEN washed them toward white on the gold Legendary card.
 */
export function attachRainbowShine(scene, sprite) {
    sprite?.setData?.('rainbowShine', true);
    sprite?.setBlendMode?.(0); // Phaser.BlendModes.NORMAL
}

export function hasRainbowShine(sprite) {
    return Boolean(sprite?.getData?.('rainbowShine'));
}

/** The sweep `sprite` plays: the rainbow for a starred card, else the plain one. */
export function hoverShineAnim(scene, sprite) {
    return hasRainbowShine(sprite) && scene?.anims?.exists?.(RAINBOW_SHINE_ANIM)
        ? RAINBOW_SHINE_ANIM
        : HOVER_SHINE_ANIM;
}

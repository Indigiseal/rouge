// ui/HoverLight.js
// The one hover highlight every button shares: the art gets lighter.
//
// A tint cannot do this. setTint multiplies the art by the colour, so even a
// pale tint like 0xdddddd can only darken — which is what every button used to
// do on hover. Brightening needs a colour matrix, the same preFX the enchanted
// cards already use, so it works on the painted art without a second sprite
// that would have to follow the button through presses and frame swaps.
//
// WebGL only. On the Canvas renderer there is no preFX and the hover simply
// does nothing, which beats darkening.

// 1 is the art as painted. Enough to read as lit, not enough to bleach the
// highlights.
const HOVER_BRIGHTNESS = 1.2;

/**
 * Light a button up on hover, or put it back.
 *
 * The matrix is made once per object and switched on and off after that, so
 * repeated hovers do not stack effects.
 *
 * @param {Phaser.GameObjects.GameObject} obj
 * @param {boolean} on
 */
export function setHoverLight(obj, on) {
    if (!obj?.preFX || !obj.scene) return;
    if (!obj._hoverLight) {
        if (!on) return;
        obj._hoverLight = obj.preFX.addColorMatrix();
        obj._hoverLight.brightness(HOVER_BRIGHTNESS);
    }
    obj._hoverLight.active = on;
}

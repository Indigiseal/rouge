// Render scale constants, in their own module with no imports of their own.
//
// gameConfig.js imports every scene, and scenes (and the UI helpers they use)
// need these values — importing them from gameConfig would make a cycle. Keeping
// them here means anything can read them without pulling in the scene graph.

/**
 * The coordinate space every scene is written in. Scenes place things at
 * 320,180 for screen centre; that has not changed and must not.
 */
export const WORLD_WIDTH = 640;
export const WORLD_HEIGHT = 360;

/**
 * Real pixels per world unit.
 *
 * The canvas is WORLD * PIXEL_SCALE and each scene's camera zooms by the same
 * factor. It used to be done the other way round — a 640x360 canvas stretched
 * by CSS — which left the game with only 640x360 real pixels: fine for pixel
 * art, but any TTF came out fuzzy because its soft edges were magnified too.
 *
 * Sprites still land on exact 2x boundaries with nearest-neighbour filtering, so
 * the pixel art is unchanged. Text passes this as its `resolution` so it is
 * rasterized at the size it will actually be drawn at.
 */
export const PIXEL_SCALE = 2;

/**
 * A camera's viewport measured in world units.
 *
 * `camera.width` is the viewport in real pixels — 1280 now, not 640. Layout code
 * that asks "how wide is the screen?" wants the answer in the coordinate space
 * it places things in, which is the viewport divided by the zoom. Reading
 * `camera.width` directly is what pushed the game board off to one corner.
 *
 * @param {Phaser.Cameras.Scene2D.Camera} camera
 * @returns {{ width: number, height: number }}
 */
export function cameraWorldSize(camera) {
    const zoom = camera?.zoom || 1;
    return {
        width: (camera?.width ?? WORLD_WIDTH * PIXEL_SCALE) / zoom,
        height: (camera?.height ?? WORLD_HEIGHT * PIXEL_SCALE) / zoom,
    };
}

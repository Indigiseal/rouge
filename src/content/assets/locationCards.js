// Location pick cards. The BACK of the card is the country: cardBack with the
// location's portrait drawn on top. Faces stay generic until the pick scene
// flips them.

import { PATH_LOCATIONS } from '../locations/catalog.js';

export const LOCATION_CARD_WIDTH = 52;
export const LOCATION_CARD_HEIGHT = 70;
const INNER_W = 44;
const INNER_H = 56;

export function locationCardBackKey(id) {
  return `locBack_${id}`;
}

/**
 * Composite one 52x70 back per Path location. Safe to call twice; a missing
 * portrait leaves a plain cardBack rather than crashing boot.
 *
 * @param {Phaser.Scene} scene
 * @returns {number}
 */
export function buildLocationCardTextures(scene) {
  if (!scene?.textures?.exists?.('cardBack')) return 0;
  let built = 0;

  for (const loc of Object.values(PATH_LOCATIONS)) {
    const key = locationCardBackKey(loc.id);
    if (scene.textures.exists(key)) continue;

    const rt = scene.make.renderTexture({
      width: LOCATION_CARD_WIDTH,
      height: LOCATION_CARD_HEIGHT,
      add: false,
    });
    rt.draw('cardBack', 0, 0);

    const portrait = loc.portrait;
    if (portrait && scene.textures.exists(portrait)) {
      const src = scene.textures.get(portrait).getSourceImage();
      const scale = Math.min(INNER_W / src.width, INNER_H / src.height, 1);
      const img = scene.add.image(0, 0, portrait).setVisible(false).setOrigin(0.5);
      img.setDisplaySize(src.width * scale, src.height * scale);
      rt.draw(img, LOCATION_CARD_WIDTH / 2, LOCATION_CARD_HEIGHT / 2);
      img.destroy();
    }

    rt.saveTexture(key);
    rt.destroy();
    built += 1;
  }

  return built;
}

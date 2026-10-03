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

/**
 * The door art for each road, as frames of assets/art/paths.png.
 *
 * Taya drew these in a fixed order and they are 64x64, not the 52x70 of a card,
 * so the frame index is written down here rather than derived from anything.
 * The eleventh frame is a runic portal with no location behind it yet — it is
 * deliberately unlisted, so nothing can pick it by accident.
 *
 * Four roads have no door drawn (Duskhold, Frosthollow, Stormhatch, Starfold);
 * they fall back to the boss-portrait card back above.
 */
export const LOCATION_DOORS_KEY = 'locationDoors';
export const LOCATION_DOOR_SIZE = 64;
export const LOCATION_DOOR_FRAMES = Object.freeze({
  thornwake: 0,
  silkdeep: 1,
  tollroad: 2,
  boneflood: 3,
  mireturn: 4,
  veilbleed: 5,
  ashhowl: 6,
  brassfair: 7,
  mirrorwane: 8,
  spherefall: 9,
});

/** Door frame for a location, or null if none is drawn for it. */
export function locationDoorFrame(id) {
  const frame = LOCATION_DOOR_FRAMES[id];
  return frame === undefined ? null : frame;
}

// paths.png carries two rows of the same doors: row 0 shut, row 1 open. The
// sheet is 11 columns wide, so a location's open door is its closed frame plus
// one row. The floor-clear reveal in combat swaps to this rather than drawing a
// Next button — the road you chose visibly opens.
export const LOCATION_DOOR_COLUMNS = 11;

/** Open-door frame for a location, or null if no door is drawn for it. */
export function locationOpenDoorFrame(id) {
  const shut = locationDoorFrame(id);
  return shut === null ? null : shut + LOCATION_DOOR_COLUMNS;
}

/**
 * Roads whose door is animated instead of a pair of frames on paths.png.
 * assets/ui/doorAnim68x70.png holds one road per row, six 68x70 frames each,
 * shut on the left to open on the right; the frames between are the door
 * swinging, played when a fight's door opens. A new row is a new line here.
 */
const LOCATION_DOOR_ANIMS_KEY = 'locationDoorAnims';
const DOOR_ANIM_FRAMES_PER_ROW = 6;
const doorAnimRow = (row) => Object.freeze({
  key: LOCATION_DOOR_ANIMS_KEY,
  shut: row * DOOR_ANIM_FRAMES_PER_ROW,
  open: row * DOOR_ANIM_FRAMES_PER_ROW + DOOR_ANIM_FRAMES_PER_ROW - 1,
});
export const LOCATION_DOOR_SHEETS = Object.freeze({
  boneflood: doorAnimRow(0), // the Ossuary Fields: skull-framed door
  mireturn: doorAnimRow(1),  // the Mireturn Fens: moss-hung bog door
  thornwake: doorAnimRow(2), // the Briar March: briar-wrapped door
  silkdeep: doorAnimRow(3),  // the Silkdeep Caves: web-hung door
  tollroad: doorAnimRow(4),  // the King's Mile: iron-banded goblin door
});
const DOOR_OPEN_FPS = 12;

/**
 * Everything needed to draw a road's door, from whichever sheet it lives on:
 * `{ key, shut, open, openAnim }`. `openAnim` is the animation key for a door
 * that swings open, or null for a paths.png door, which just swaps frames.
 * Null when no door is drawn for the road (or its sheet is not loaded).
 */
export function locationDoorArt(scene, id) {
  const sheet = LOCATION_DOOR_SHEETS[id];
  if (sheet && scene?.textures?.exists(sheet.key)) {
    return { key: sheet.key, shut: sheet.shut, open: sheet.open, openAnim: `door_open_${id}` };
  }
  const shut = locationDoorFrame(id);
  if (shut === null || !scene?.textures?.exists(LOCATION_DOORS_KEY)) return null;
  return { key: LOCATION_DOORS_KEY, shut, open: shut + LOCATION_DOOR_COLUMNS, openAnim: null };
}

/** True for any texture a door is drawn from, paths.png or a door's own sheet. */
export function isLocationDoorTexture(key) {
  return key === LOCATION_DOORS_KEY
    || Object.values(LOCATION_DOOR_SHEETS).some((sheet) => sheet.key === key);
}

/** Register a door's opening animation once, so a sprite can play it. */
export function ensureDoorOpenAnim(scene, art) {
  if (!art?.openAnim || !scene?.anims) return null;
  if (!scene.anims.exists(art.openAnim)) {
    scene.anims.create({
      key: art.openAnim,
      frames: scene.anims.generateFrameNumbers(art.key, { start: art.shut, end: art.open }),
      frameRate: DOOR_OPEN_FPS,
      repeat: 0,
    });
  }
  return art.openAnim;
}

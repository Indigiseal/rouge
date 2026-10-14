// content/assets/itemSheets.js
// The weapon and armor card art lives on two sprite sheets instead of forty
// separate files (built by tools/build-item-sheets.py from the single images,
// which stay the place to draw):
//
//   assets/art/weaponsSheet.png/.json   dagger, bow, sword, spear, axe x 5 rarities
//   assets/art/armorSheet.png/.json     leather, chain, plate x 5 rarities
//
// Every frame is named by the texture key the card data already carries
// (sword_C, chain_L...). At boot splitItemSheets() gives each frame a texture
// of its own under that key, so the rest of the game — cards, tooltips, the
// shop, saved runs — keeps asking for 'sword_C' and never knows the sheets
// exist. Two downloads instead of forty.

export const ITEM_SHEETS = Object.freeze([
    { key: 'weaponsSheet', path: 'assets/art/weaponsSheet.png', jsonPath: 'assets/art/weaponsSheet.json' },
    { key: 'armorSheet', path: 'assets/art/armorSheet.png', jsonPath: 'assets/art/armorSheet.json' },
]);

/**
 * Copy every frame of the item sheets into a texture of its own, keyed by the
 * frame's name. Safe to call more than once; a missing sheet is skipped, so a
 * failed download leaves those cards on their fallback art instead of
 * crashing the boot.
 *
 * @param {Phaser.Scene} scene any scene — the texture manager is game-wide.
 * @returns {number} how many textures were made
 */
export function splitItemSheets(scene) {
    const textures = scene?.textures;
    if (!textures) return 0;
    let made = 0;
    ITEM_SHEETS.forEach(({ key }) => {
        if (!textures.exists(key)) return;
        textures.get(key).getFrameNames().forEach((name) => {
            if (textures.exists(name)) return;
            const frame = textures.getFrame(key, name);
            const canvas = textures.createCanvas(name, frame.width, frame.height);
            if (!canvas) return;
            canvas.drawFrame(key, name, 0, 0);
            canvas.refresh();
            made += 1;
        });
    });
    return made;
}

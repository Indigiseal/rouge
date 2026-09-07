// The options cog, in the one corner it lives in.
//
// Every screen that offers options puts it at COG_X/COG_Y — 6px in from the
// top-right, which is where the main menu has always had it. Importing the
// position rather than typing 618, 22 into each scene is the point: a cog that
// sits 4px lower in the anvil than in the shop is the kind of thing nobody
// reports and everybody feels.

import { SoundHelper } from '../audio/SoundHelper.js';

export const COG_X = 618;
export const COG_Y = 22;
const SHEET = 'optionsButton';
// Frame 0 rests, frame 1 is the pressed art.
const FRAME_UP = 0;
const FRAME_DOWN = 1;

/**
 * @param {Phaser.Scene} scene
 * @param {() => void} onOpen
 * @param {{ depth?: number }} [opts]
 * @returns {Phaser.GameObjects.Image | null} null when the art is missing
 */
export function createOptionsCog(scene, onOpen, opts = {}) {
    const { depth = 9000 } = opts;
    if (!scene.textures?.exists?.(SHEET)) return null;

    const shadow = scene.add.image(COG_X, COG_Y + 3, SHEET, FRAME_UP)
        .setOrigin(0.5).setTint(0x000000).setAlpha(0.6).setDepth(depth);
    const cog = scene.add.image(COG_X, COG_Y, SHEET, FRAME_UP)
        .setOrigin(0.5)
        .setDepth(depth + 1)
        .setInteractive({ useHandCursor: true });

    cog.on('pointerover', () => {
        SoundHelper.playVariant(scene, 'hover_button', 0.4);
        cog.setTint(0xdddddd);
    });
    cog.on('pointerout', () => {
        cog.clearTint();
        cog.setFrame(FRAME_UP);
    });
    cog.on('pointerdown', () => {
        SoundHelper.playVariant(scene, 'button_click', 0.5);
        cog.setFrame(FRAME_DOWN);
    });
    cog.on('pointerup', () => {
        cog.clearTint();
        cog.setFrame(FRAME_UP);
        onOpen();
    });

    cog.once('destroy', () => shadow.destroy());
    return cog;
}

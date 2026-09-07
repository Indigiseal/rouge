// The painted plate button: nextTurnUp art, a serif label fitted to it, and the
// press it has had since the anvil got its skin — hover lightens and sounds,
// pointerdown swaps to the pressed plate, clicks, and nudges the label a pixel
// down, pointerup restores and fires.
//
// It lives here rather than on AnvilScene because the rest room wears the same
// button, and two copies of a feel like this drift: one gains a sound, the
// other keeps the old tint, and the rooms stop feeling like one game.

import { SoundHelper } from '../audio/SoundHelper.js';
import { fitLabel, serifStyle } from './uiFont.js';

const PLATE_UP = 'nextTurnUp';
const PLATE_DOWN = 'nextTurnDown';
const LABEL_INK = '#fff0cc';
const LABEL_INK_DISABLED = '#b6a994';
const HOVER_TINT = 0xffe0a3;
const DISABLED_TINT = 0x777777;
// The label sits a hair above the plate's centre line at rest, and drops to
// centre while held — that 1px is the whole press.
const LABEL_Y = -3;
const LABEL_Y_PRESSED = -2;

/**
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y
 * @param {string} text
 * @param {() => void} action fired on release, not on press
 * @param {{ enabled?: boolean, size?: string }} [opts]
 * @returns {Phaser.GameObjects.Container} the plate and its label
 */
export function createPaintedButton(scene, x, y, text, action, opts = {}) {
    const { enabled = true, size = '14px' } = opts;

    const plate = scene.add.image(0, 0, PLATE_UP);
    const label = scene.add
        .text(0, LABEL_Y, text, serifStyle(size, enabled ? LABEL_INK : LABEL_INK_DISABLED))
        .setOrigin(0.5);
    fitLabel(label, plate.width - 8, size);

    const button = scene.add.container(x, y, [plate, label]);
    if (!enabled) {
        plate.setTint(DISABLED_TINT);
        return button;
    }

    plate.setInteractive({ useHandCursor: true });
    plate.on('pointerover', () => {
        SoundHelper.playVariant(scene, 'hover_button', 0.4);
        plate.setTint(HOVER_TINT);
    });
    plate.on('pointerout', () => {
        plate.setTexture(PLATE_UP);
        plate.clearTint();
        label.y = LABEL_Y;
    });
    plate.on('pointerdown', () => {
        SoundHelper.playVariant(scene, 'button_click', 0.5);
        plate.setTexture(PLATE_DOWN);
        label.y = LABEL_Y_PRESSED;
    });
    plate.on('pointerup', () => {
        plate.setTexture(PLATE_UP);
        plate.clearTint();
        label.y = LABEL_Y;
        action();
    });

    return button;
}

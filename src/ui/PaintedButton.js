// The painted plate button: nextTurnUp art, a serif label fitted to it, and the
// press it has had since the anvil got its skin — hover lightens and sounds,
// pointerdown swaps to the pressed plate, clicks, and nudges the label a pixel
// down, pointerup restores and fires.
//
// It lives here rather than on AnvilScene because the rest room wears the same
// button, and two copies of a feel like this drift: one gains a sound, the
// other keeps the old tint, and the rooms stop feeling like one game.

import { SoundHelper } from '../audio/SoundHelper.js';
import { serifStyle } from './uiFont.js';
import { setHoverLight } from './HoverLight.js';
import { fitTextBox, horizontalSkin } from './AdaptiveSkin.js';

const PLATE_UP = 'nextTurnUp';
const PLATE_DOWN = 'nextTurnDown';
const LABEL_INK = '#fef0cf';
const LABEL_INK_DISABLED = '#aba592';
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

    const label = scene.add
        .text(0, LABEL_Y, text, serifStyle(size, enabled ? LABEL_INK : LABEL_INK_DISABLED))
        .setOrigin(0.5);
    const nativeWidth = scene.textures.get(PLATE_UP).get().cutWidth;
    const maxWidth = opts.maxWidth ?? Math.min(200, 2 * Math.min(x - 8, 632 - x));
    const width = Math.max(nativeWidth, Math.min(maxWidth, label.width + 24));
    let up = horizontalSkin(scene, PLATE_UP, width);
    let down = horizontalSkin(scene, PLATE_DOWN, width);
    const plate = scene.add.image(0, 0, up);
    fitTextBox(label, plate.width - 24, 26, Math.min(11, parseInt(size, 10)));

    const button = scene.add.container(x, y, [plate, label]);
    button.skinUp = up;
    button.skinDown = down;
    button.refit = () => {
        label.setWordWrapWidth(0).setFontSize(size);
        const nextWidth = Math.max(nativeWidth, Math.min(maxWidth, label.width + 24));
        up = horizontalSkin(scene, PLATE_UP, nextWidth);
        down = horizontalSkin(scene, PLATE_DOWN, nextWidth);
        button.skinUp = up;
        button.skinDown = down;
        plate.setTexture(up);
        fitTextBox(label, plate.width - 24, 26, Math.min(11, parseInt(size, 10)));
        if (plate.input) plate.input.hitArea.setTo(0, 0, plate.width, plate.height);
    };
    if (!enabled) {
        plate.setTint(DISABLED_TINT);
        return button;
    }

    plate.setInteractive({ useHandCursor: true });
    plate.on('pointerover', () => {
        SoundHelper.playVariant(scene, 'hover_button', 0.4);
        setHoverLight(plate, true);
    });
    plate.on('pointerout', () => {
        plate.setTexture(up);
        plate.clearTint();
        setHoverLight(plate, false);
        label.y = LABEL_Y;
    });
    plate.on('pointerdown', () => {
        SoundHelper.playVariant(scene, 'button_click', 0.5);
        plate.setTexture(down);
        label.y = LABEL_Y_PRESSED;
    });
    plate.on('pointerup', () => {
        plate.setTexture(up);
        plate.clearTint();
        setHoverLight(plate, false);
        label.y = LABEL_Y;
        action();
    });

    return button;
}

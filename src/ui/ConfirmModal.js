// Reusable yes/no confirm dialog for Phaser scenes.
//
// openConfirmModal(scene, { title, body, onConfirm, onCancel, confirmLabel, cancelLabel })
// Blocks behind a full-screen dimmer so clicks cannot fall through to hidden UI.
// Only one modal at a time per scene (uses scene.activeModal).

import { SoundHelper } from '../audio/SoundHelper.js';

function createModalButton(scene, x, y, width, height, text, color, callback) {
    const button = scene.add.rectangle(x, y, width, height, color, 0.3)
        .setStrokeStyle(2, color)
        .setDepth(1002);

    const buttonText = scene.add.text(x, y, text, {
        fontSize: '18px',
        fill: '#ffffff',
        fontFamily: '"HoMM Pixel", Arial, sans-serif'
    }).setOrigin(0.5).setDepth(1002);

    button.setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
            SoundHelper.playVariant(scene, 'hover_button', 0.4);
            button.setFillStyle(color, 0.5);
        })
        .on('pointerout', () => button.setFillStyle(color, 0.3))
        .on('pointerdown', callback);

    return { button, text: buttonText };
}

/**
 * @param {Phaser.Scene} scene
 * @param {{
 *   title: string,
 *   body: string,
 *   onConfirm?: () => void,
 *   onCancel?: () => void,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 * }} options
 * @returns {{ cleanup: () => void } | null}
 */
export function openConfirmModal(scene, {
    title,
    body,
    onConfirm,
    onCancel,
    confirmLabel = 'OK',
    cancelLabel = 'Cancel',
} = {}) {
    if (scene.activeModal) return null;

    // The full-screen interactive dimmer consumes input outside the dialog,
    // preventing clicks from falling through to hidden menu controls.
    const dimmer = scene.add.rectangle(320, 180, 640, 360, 0x000000, 0.75)
        .setDepth(1000)
        .setInteractive();
    const box = scene.add.rectangle(320, 180, 380, 170, 0x2c1810)
        .setStrokeStyle(2, 0xff4444)
        .setDepth(1001);
    const titleText = scene.add.text(320, 130, title, {
        fontSize: '20px', fill: '#ff8888', fontFamily: '"HoMM Pixel", Arial, sans-serif'
    }).setOrigin(0.5).setDepth(1002);
    const bodyText = scene.add.text(320, 170, body, {
        fontSize: '13px', fill: '#ffffff', fontFamily: '"HoMM Pixel", Arial, sans-serif', align: 'center'
    }).setOrigin(0.5).setDepth(1002);

    let closed = false;
    const cleanup = () => {
        if (closed) return;
        closed = true;
        [dimmer, box, titleText, bodyText, yes.button, yes.text, no.button, no.text]
            .forEach(o => o?.destroy());
        scene.activeModal = null;
    };

    const yes = createModalButton(scene, 265, 230, 90, 30, confirmLabel, 0xff4444, () => {
        cleanup();
        onConfirm?.();
    });
    const no = createModalButton(scene, 375, 230, 90, 30, cancelLabel, 0x888888, () => {
        cleanup();
        onCancel?.();
    });

    const modal = { type: 'confirm', cleanup };
    scene.activeModal = modal;
    return modal;
}

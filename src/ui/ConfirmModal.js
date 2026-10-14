// Reusable yes/no confirm dialog for Phaser scenes.
//
// openConfirmModal(scene, { title, body, onConfirm, onCancel, confirmLabel, cancelLabel })
// Blocks behind a full-screen dimmer so clicks cannot fall through to hidden UI.
// Only one modal at a time per scene (uses scene.activeModal).

import { SoundHelper } from '../audio/SoundHelper.js';
import { t } from '../i18n/i18n.js';

function createModalButton(scene, x, y, width, height, text, color, callback) {
    const button = scene.add.rectangle(x, y, width, height, color, 0.3)
        .setStrokeStyle(2, color)
        .setDepth(1002);

    const buttonText = scene.add.text(x, y, text, {
        fontSize: '18px',
        fill: '#fef0cf',
        fontFamily: '"HoMM Pixel", Arial, sans-serif'
    }).setOrigin(0.5).setDepth(1002);

    button.setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
            SoundHelper.playVariant(scene, 'hover_button', 0.4);
            button.setFillStyle(color, 0.5);
        })
        .on('pointerout', () => button.setFillStyle(color, 0.3))
        .on('pointerdown', () => {
            SoundHelper.playVariant(scene, 'button_click', 0.5);
            callback();
        });

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
    confirmLabel,
    cancelLabel,
} = {}) {
    if (scene.activeModal) return null;

    // The full-screen interactive dimmer consumes input outside the dialog,
    // preventing clicks from falling through to hidden menu controls.
    const dimmer = scene.add.rectangle(320, 180, 640, 360, 0x000000, 0.75)
        .setDepth(1000)
        .setInteractive();
    const box = scene.add.rectangle(320, 180, 380, 170, 0x28150c)
        .setStrokeStyle(2, 0xb51f1e)
        .setDepth(1001);
    const titleText = scene.add.text(320, 130, title, {
        fontSize: '20px', fill: '#c45c45', fontFamily: '"HoMM Pixel", Arial, sans-serif'
    }).setOrigin(0.5).setDepth(1002);
    const bodyText = scene.add.text(320, 170, body, {
        fontSize: '13px', fill: '#fef0cf', fontFamily: '"HoMM Pixel", Arial, sans-serif', align: 'center'
    }).setOrigin(0.5).setDepth(1002);

    let closed = false;
    const cleanup = () => {
        if (closed) return;
        closed = true;
        [dimmer, box, titleText, bodyText, yes.button, yes.text, no.button, no.text]
            .forEach(o => o?.destroy());
        scene.activeModal = null;
    };

    const yes = createModalButton(scene, 265, 230, 90, 30, confirmLabel || t(scene, 'ui.common.ok'), 0xb51f1e, () => {
        cleanup();
        onConfirm?.();
    });
    const no = createModalButton(scene, 375, 230, 90, 30, cancelLabel || t(scene, 'ui.options.cancel'), 0x869089, () => {
        cleanup();
        onCancel?.();
    });

    const modal = { type: 'confirm', cleanup };
    scene.activeModal = modal;
    return modal;
}

// One-button story notice. Kept alongside confirmations so both use the same
// modal depth and input blocker, without implying that the player has a choice.
export function openNoticeModal(scene, {
    title,
    body,
    confirmLabel,
    onConfirm,
} = {}) {
    if (scene.activeModal) return null;

    const dimmer = scene.add.rectangle(320, 180, 640, 360, 0x000000, 0.75)
        .setDepth(1000)
        .setInteractive();
    const box = scene.add.rectangle(320, 180, 420, 180, 0x28150c)
        .setStrokeStyle(2, 0xef9629)
        .setDepth(1001);
    const titleText = scene.add.text(320, 125, title, {
        fontSize: '20px', fill: '#ffcf7f', fontFamily: '"HoMM Pixel", Arial, sans-serif'
    }).setOrigin(0.5).setDepth(1002);
    const bodyText = scene.add.text(320, 170, body, {
        fontSize: '13px', fill: '#fef0cf', fontFamily: '"HoMM Pixel", Arial, sans-serif', align: 'center',
        wordWrap: { width: 360, useAdvancedWrap: true }
    }).setOrigin(0.5).setDepth(1002);

    let closed = false;
    const cleanup = () => {
        if (closed) return;
        closed = true;
        [dimmer, box, titleText, bodyText, button.button, button.text].forEach(o => o?.destroy());
        scene.activeModal = null;
    };
    const button = createModalButton(scene, 320, 245, 110, 30, confirmLabel || t(scene, 'ui.common.continue'), 0xef9629, () => {
        cleanup();
        onConfirm?.();
    });

    const modal = { type: 'notice', cleanup };
    scene.activeModal = modal;
    return modal;
}

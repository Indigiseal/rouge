// Reusable yes/no confirm dialog for Phaser scenes.
//
// openConfirmModal(scene, { title, body, onConfirm, onCancel, confirmLabel, cancelLabel })
// Blocks behind a full-screen dimmer so clicks cannot fall through to hidden UI.
// Only one modal at a time per scene (uses scene.activeModal).

import { SoundHelper } from '../audio/SoundHelper.js';
import { t } from '../i18n/i18n.js';
import { serifStyle } from './uiFont.js';

// The confirm window's look, matched to the main menu: the menu's serif in its
// cream for the question, its grey-beige for the line under it, all on one
// plain dark see-through panel (the bag slots' ink) instead of a framed box.
const CONFIRM_INK = 0x0e0b10;
const CONFIRM_TITLE = { size: '14px', color: '#fef0cf' };
const CONFIRM_BODY = { size: '12px', color: '#afafa2' };
const CONFIRM_BUTTON = { w: 88, h: 22, size: '12px', color: '#fef0cf', line: 0x6e7470, hover: 0xffcf7f };

// A small plain button in the confirm window's style: a dark see-through
// plate with a thin line that warms on hover.
function createConfirmButton(scene, x, y, text, callback) {
    const button = scene.add.rectangle(x, y, CONFIRM_BUTTON.w, CONFIRM_BUTTON.h, CONFIRM_INK, 0.6)
        .setStrokeStyle(1, CONFIRM_BUTTON.line)
        .setDepth(1002);
    const buttonText = scene.add.text(x, y, text, serifStyle(CONFIRM_BUTTON.size, CONFIRM_BUTTON.color))
        .setOrigin(0.5).setDepth(1003);
    button.setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
            SoundHelper.playVariant(scene, 'hover_button', 0.4);
            button.setFillStyle(CONFIRM_INK, 0.9).setStrokeStyle(1, CONFIRM_BUTTON.hover);
        })
        .on('pointerout', () => button.setFillStyle(CONFIRM_INK, 0.6).setStrokeStyle(1, CONFIRM_BUTTON.line))
        .on('pointerdown', () => {
            SoundHelper.playVariant(scene, 'button_click', 0.5);
            callback();
        });
    return { button, text: buttonText };
}

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
    const dimmer = scene.add.rectangle(320, 180, 640, 360, 0x000000, 0.45)
        .setDepth(1000)
        .setInteractive();
    const titleText = scene.add.text(320, 156, title, serifStyle(CONFIRM_TITLE.size, CONFIRM_TITLE.color))
        .setOrigin(0.5).setDepth(1002);
    const bodyText = scene.add.text(320, 178, body, {
        ...serifStyle(CONFIRM_BODY.size, CONFIRM_BODY.color), align: 'center', wordWrap: { width: 300, useAdvancedWrap: true },
    }).setOrigin(0.5).setDepth(1002);
    // The panel fits the words, with room for the two buttons under them.
    const boxW = Math.round(Math.max(titleText.width, bodyText.width, CONFIRM_BUTTON.w * 2 + 16) + 32);
    const boxTop = 156 - titleText.height / 2 - 12;
    const boxBottom = 210 + CONFIRM_BUTTON.h / 2 + 12;
    const box = scene.add.rectangle(320, Math.round((boxTop + boxBottom) / 2), boxW, Math.round(boxBottom - boxTop), CONFIRM_INK, 0.8)
        .setDepth(1001);

    let closed = false;
    const cleanup = () => {
        if (closed) return;
        closed = true;
        [dimmer, box, titleText, bodyText, yes.button, yes.text, no.button, no.text]
            .forEach(o => o?.destroy());
        scene.activeModal = null;
    };

    const yes = createConfirmButton(scene, 272, 210, confirmLabel || t(scene, 'ui.common.ok'), () => {
        cleanup();
        onConfirm?.();
    });
    const no = createConfirmButton(scene, 368, 210, cancelLabel || t(scene, 'ui.options.cancel'), () => {
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

// A companion growing stronger as a new act begins (GameScene.upgradeCompanionsForNextAct):
// golden motes swirl round its card and close in, the card flashes gold, a
// chime plays and "+1 ATK" rises over it. Plays in the boss reward room, before
// the reward is offered, one card after another, and in the drill room when a
// companion is trained (EventScene.trainCompanion).

import { SoundHelper } from '../audio/SoundHelper.js';
import { t } from '../i18n/i18n.js';

const GOLDS = [0xffcf7f, 0xfbad19, 0xfff3c4, 0xe0a33a];
const MOTES = 20;
const SWIRL_MS = 900;
// From one companion's swirl to the next.
export const COMPANION_POWER_UP_STAGGER_MS = 260;
// How long the whole thing takes for `count` companions, so the reward can wait for it.
export function companionPowerUpDuration(count) {
    return count > 0 ? SWIRL_MS + (count - 1) * COMPANION_POWER_UP_STAGGER_MS + 250 : 0;
}

/**
 * The swirl round one card sprite, `delay` ms from now, with its "+N ATK", or
 * `label` instead (a training that changes something other than attack).
 */
export function playCompanionPowerUp(scene, cardSprite, { delay = 0, gain = 1, label = null } = {}) {
    if (!scene?.add || !cardSprite?.scene) return;
    scene.time.delayedCall(delay, () => {
        if (!cardSprite.scene) return;
        const cx = cardSprite.x;
        const cy = cardSprite.y;
        const rx = (cardSprite.displayWidth || 52) / 2 + 8;
        const ry = (cardSprite.displayHeight || 70) / 2 + 8;
        const depth = (cardSprite.depth || 10) + 6;
        if (scene.cache?.audio?.exists?.('bag_slot_unlock')) SoundHelper.playSound(scene, 'bag_slot_unlock', 0.5);

        // Motes on an ellipse round the card, spinning a turn and a half and
        // closing in, whole pixels so they stay crisp.
        for (let m = 0; m < MOTES; m++) {
            const size = m % 3 === 0 ? 4 : 3;
            const mote = scene.add.rectangle(cx, cy, size, size, GOLDS[m % GOLDS.length]).setDepth(depth).setAlpha(0);
            const start = (m / MOTES) * Math.PI * 2;
            const state = { t: 0 };
            scene.tweens.add({
                targets: state, t: 1, duration: SWIRL_MS, ease: 'Sine.easeIn',
                onUpdate: () => {
                    const angle = start + state.t * Math.PI * 3;
                    const shrink = 1 - 0.75 * state.t;
                    mote.x = Math.round(cx + Math.cos(angle) * rx * shrink);
                    mote.y = Math.round(cy + Math.sin(angle) * ry * shrink);
                    mote.setAlpha(state.t < 0.15 ? state.t / 0.15 : 1 - Math.max(0, state.t - 0.75) / 0.25);
                },
                onComplete: () => mote.destroy(),
            });
        }

        // A gold flash on the card as the motes arrive.
        scene.time.delayedCall(SWIRL_MS - 180, () => {
            if (!cardSprite.scene) return;
            cardSprite.setTint?.(0xffe2a0);
            scene.time.delayedCall(160, () => cardSprite.scene && cardSprite.clearTint?.());
            const words = label ?? t(scene, 'float.atkGain', { amount: gain });
            const text = scene.add.text(Math.round(cx), Math.round(cy - ry - 2), words, {
                fontSize: '12px', fill: '#ffcf7f', fontFamily: '"HoMM Pixel", Arial, sans-serif',
                stroke: '#3a2208', strokeThickness: 3,
            }).setOrigin(0.5).setDepth(depth + 1);
            scene.tweens.add({ targets: text, y: text.y - 14, alpha: 0, delay: 500, duration: 600, onComplete: () => text.destroy() });
        });
    });
}

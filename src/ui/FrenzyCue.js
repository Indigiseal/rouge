// The look of a boss's frenzy (content/combat/frenzy.js), so a surprise flurry
// reads as one: a big "Frenzy!" rising over the boss, a red flicker on its art
// and its growl, then a screen shake on every bite that grows bite by bite.

import { SoundHelper } from '../audio/SoundHelper.js';
import { t } from '../i18n/i18n.js';

// From the cue to the first bite, and between bites (within one enemy turn).
export const FRENZY_CUE_MS = 520;
export const FRENZY_BITE_GAP_MS = 430;

const FRENZY_RED = 0xe0402a;

export function playFrenzyCue(scene, card) {
    const sprite = card?.sprite;
    if (!scene?.add || !sprite?.active) return;
    const top = sprite.y - (sprite.displayHeight || 100) / 2;
    const word = scene.add.text(Math.round(sprite.x), Math.round(top + 8), t(scene, 'float.frenzy'), {
        fontSize: '22px',
        fill: '#ff5a3c',
        fontFamily: '"HoMM Pixel", Arial, sans-serif',
        stroke: '#2a0a06',
        strokeThickness: 4,
    }).setOrigin(0.5).setDepth((sprite.depth || 1) + 12).setScale(0.6).setAlpha(0);
    scene.tweens.add({ targets: word, scale: 1, alpha: 1, duration: 160, ease: 'Back.easeOut' });
    scene.tweens.add({
        targets: word, y: word.y - 18, alpha: 0, delay: 650, duration: 450,
        onComplete: () => word.destroy(),
    });
    // Two red flickers on the art.
    const flick = (on) => { if (sprite.active) { if (on) sprite.setTint(FRENZY_RED); else sprite.clearTint(); } };
    [0, 120, 240, 360].forEach((ms, i) => scene.time.delayedCall(ms, () => flick(i % 2 === 0)));
    scene.time.delayedCall(480, () => flick(false));
    const growl = scene.cache?.audio?.exists?.('cerberus_frenzy_growl') ? 'cerberus_frenzy_growl' : 'boss_enraged';
    if (scene.cache?.audio?.exists?.(growl)) SoundHelper.playSound(scene, growl, 0.6);
}

/** Bite `n` (0, 1, 2): the chomp, and a screen shake that grows each bite. */
export function shakeForFrenzyBite(scene, n) {
    if (scene?.cache?.audio?.exists?.('cerberus_frenzy_chomp')) SoundHelper.playSound(scene, 'cerberus_frenzy_chomp', 0.55);
    scene?.cameras?.main?.shake?.(140, 0.0018 + 0.0014 * n);
}

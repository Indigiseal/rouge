// ui/CurrencyFlight.js
// A small coin or crystal flying in an arc between two points: a thief's take
// leaving the coin counter, or coins and crystals gained arriving at theirs.
// Spins on its own sheet (coinAnimation20x24 / crystalAnimation14x24), travels
// on whole pixels, fades over the last quarter, and calls onArrive on landing.
//
// It is drawn in the scene it is given, not necessarily the HUD's: a chest,
// event or shop is a screen above GameScene, and an icon drawn in GameScene
// would pass underneath it. The counters it flies to are GameScene's, at the
// same world coordinates every screen uses.

import { tweenAlongArc } from './ArcFlight.js';

const FLIGHT_MS = 340;
const FLIGHT_ARC = 40;
const DEPTH = 1000;

export function flyCurrencyIcon(scene, { currency = 'coins', fromX, fromY, toX, toY, onArrive = null }) {
    const isCrystal = currency === 'crystals';
    const sheet = isCrystal ? 'crystalAnimSheet' : 'coinAnimSheet';
    if (!scene?.add || !scene.textures?.exists?.(sheet)) { onArrive?.(); return; }
    const spin = isCrystal ? 'crystal_fly_spin' : 'coin_steal_spin';
    if (!scene.anims.exists(spin)) {
        scene.anims.create({
            key: spin,
            frames: scene.anims.generateFrameNumbers(sheet),
            frameRate: 14,
            repeat: -1,
        });
    }
    const icon = scene.add.sprite(0, 0, sheet, 0).setDepth(DEPTH);
    icon.play(spin);
    tweenAlongArc(scene, icon, {
        fromX, fromY, toX, toY,
        arc: FLIGHT_ARC,
        duration: FLIGHT_MS,
        ease: 'Sine.easeIn',
        // Fades over the last quarter, into the counter.
        onProgress: (p) => icon.setAlpha(p < 0.75 ? 1 : (1 - p) * 4),
        onComplete: () => {
            icon.destroy();
            onArrive?.();
        },
    });
}

/**
 * Coins or crystals gained at (x, y) on `drawScene` fly to their counter on
 * the HUD (GameScene), which spins or glows as the icon lands. Does nothing
 * if the HUD is not up.
 */
export function flyCurrencyGain(drawScene, x, y, currency = 'coins') {
    const hud = drawScene?.scene?.get?.('GameScene');
    const isCrystal = currency === 'crystals';
    const target = isCrystal ? hud?.crystalSprite : hud?.coinSprite;
    if (!target?.scene || !Number.isFinite(x) || !Number.isFinite(y)) return;
    flyCurrencyIcon(drawScene, {
        currency,
        fromX: x,
        fromY: y,
        toX: target.x,
        toY: target.y,
        onArrive: () => {
            if (!target.scene) return;
            if (isCrystal) hud.playCrystalAnimation?.();
            else hud.playCoinAnimation?.();
        },
    });
}

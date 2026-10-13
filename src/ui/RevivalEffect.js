// ui/RevivalEffect.js
// The hero rising again (Temple / Second Wind, the Invulnerable amulet), shown
// softly, in the warm gold of its chime: a faint golden wash over the screen,
// two rings of light opening out from the portrait, and a very light jolt —
// a third of the trap's shake, felt rather than seen.

const GOLD = 0xffdd88;
const WASH_PEAK_ALPHA = 0.22;
const WASH_MS = 520;
const RING_MS = 700;
const SHAKE_MS = 140;
const SHAKE_INTENSITY = 0.002;  // the trap's is 0.006
const DEPTH = 10500;            // over the board and bag, under result screens

export function playRevivalEffect(scene) {
    if (!scene?.add || !scene.tweens) return;
    const camera = scene.cameras?.main;
    const avatar = scene.playerAvatar;

    // The wash rises and falls rather than flashing on: Phaser's camera flash
    // starts at full strength, which read as a hit.
    const wash = scene.add.rectangle(320, 180, 640, 360, GOLD, 0)
        .setDepth(DEPTH)
        .setScrollFactor?.(0);
    scene.tweens.add({
        targets: wash,
        alpha: WASH_PEAK_ALPHA,
        duration: WASH_MS * 0.35,
        ease: 'Sine.easeOut',
        yoyo: true,
        hold: WASH_MS * 0.1,
        onComplete: () => wash.destroy(),
    });

    if (avatar?.scene) {
        [0, 160].forEach((delay) => {
            const ring = scene.add.circle(Math.round(avatar.x), Math.round(avatar.y), 18)
                .setStrokeStyle(2, GOLD, 0.9)
                .setDepth(DEPTH + 1)
                .setAlpha(0);
            scene.tweens.add({
                targets: ring,
                delay,
                scale: { from: 0.6, to: 2.6 },
                alpha: { from: 0.9, to: 0 },
                duration: RING_MS,
                ease: 'Cubic.easeOut',
                onComplete: () => ring.destroy(),
            });
        });
    }

    camera?.shake?.(SHAKE_MS, SHAKE_INTENSITY);
}

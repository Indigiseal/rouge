// A crow passing over the top of the screen: its caw, and its shadow crossing from left to
// right (the nest minigame's bird shadow, turned to face its flight). `onDrop` runs as the
// shadow passes `dropAtX`, which is when the crow lets go of what it brought: the Sanctuary's
// sample amulet, a run's starting amulet. Without the shadow art the drop comes after a beat.
import { SoundHelper } from '../audio/SoundHelper.js';

const FLY_FROM = -70;
const FLY_TO = 710;
const FLY_MS = 1500;
export const CROW_TOP_Y = 58;
const DEPTH = 9000;

/** Returns the ms until the crow lets go. */
export function playCrowFlyby(scene, { dropAtX = 320, onDrop = null } = {}) {
    if (!scene?.add) { onDrop?.(); return 0; }
    SoundHelper.playSound(scene, 'sanctuary_crow', 0.6);
    const hasShadow = scene.textures?.exists?.('shadowBird');
    if (hasShadow) {
        // Head up in the art, so a quarter turn points it along the flight.
        const shadow = scene.add.image(FLY_FROM, CROW_TOP_Y, 'shadowBird')
            .setScale(0.34).setRotation(Math.PI / 2).setTint(0x000000).setAlpha(0.4).setDepth(DEPTH);
        scene.events.once('shutdown', () => shadow.scene && shadow.destroy());
        scene.tweens.add({
            targets: shadow, x: FLY_TO, duration: FLY_MS, ease: 'Sine.easeInOut',
            onUpdate: () => { shadow.x = Math.round(shadow.x); shadow.y = Math.round(CROW_TOP_Y + Math.sin(shadow.x / 40) * 3); },
            onComplete: () => shadow.destroy(),
        });
    }
    const dropDelay = hasShadow ? Math.round(FLY_MS * (dropAtX - FLY_FROM) / (FLY_TO - FLY_FROM)) : 400;
    if (onDrop) scene.time.delayedCall(dropDelay, onDrop);
    return dropDelay;
}

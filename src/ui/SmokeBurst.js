// Smoke burst VFX. The Smoke Screen spell and the toll goblins' escape are the
// same trick performed by different people, so the sprite, sound and timing
// live here rather than being written twice.
import { SoundHelper } from '../audio/SoundHelper.js';

const SHEET_KEY = 'smokeBombAnim';
const ANIM_KEY = 'smoke_bomb_anim';
// Above the board cards and their info text (~1001) so the smoke reads as
// happening in front of the fight, not behind it.
const SMOKE_DEPTH = 2000;

/** One puff. Returns the sprite, or null if the art never loaded. */
export function playSmokePuff(scene, x = 320, y = 180, opts = {}) {
    const { scale = 1, depth = SMOKE_DEPTH, alpha = 1 } = opts;
    if (!scene?.add || !scene.textures?.exists(SHEET_KEY)) return null;

    const puff = scene.add.sprite(x, y, SHEET_KEY, 0)
        .setDepth(depth)
        .setScale(scale)
        .setAlpha(alpha);

    if (scene.anims?.exists(ANIM_KEY)) {
        puff.play(ANIM_KEY);
        puff.once('animationcomplete', () => puff.destroy());
    }
    // Safety net: if the animation never completes (missing anim, scene torn
    // down mid-play) the sprite would otherwise sit on the board forever.
    scene.time?.delayedCall?.(1400, () => { if (puff.active) puff.destroy(); });
    return puff;
}

/**
 * A room-filling screen of smoke: several overlapping puffs at staggered
 * delays, so it reads as a thrown bomb rather than one small pop.
 * Used by the Smoke Screen spell and by anyone escaping in a hurry.
 */
export function playSmokeBurst(scene, opts = {}) {
    const {
        x = 320,
        y = 180,
        sound = true,
        volume = 0.5,
        puffs = [
            { dx: 0, dy: 0, scale: 2.2, delay: 0 },
            { dx: -86, dy: 22, scale: 1.7, delay: 90 },
            { dx: 92, dy: 14, scale: 1.8, delay: 150 },
            { dx: -34, dy: -40, scale: 1.4, delay: 220 },
            { dx: 52, dy: -34, scale: 1.5, delay: 280 },
        ],
    } = opts;

    if (sound) SoundHelper.playSound(scene, 'smoke_bomb', volume);
    if (!scene?.textures?.exists(SHEET_KEY)) return false;

    puffs.forEach(({ dx = 0, dy = 0, scale = 1.5, delay = 0 }) => {
        if (delay > 0) {
            scene.time?.delayedCall?.(delay, () => playSmokePuff(scene, x + dx, y + dy, { scale }));
        } else {
            playSmokePuff(scene, x + dx, y + dy, { scale });
        }
    });
    return true;
}

/** Roughly how long a full burst takes, for sequencing what comes after it. */
export const SMOKE_BURST_MS = 700;

// The heat Scorched Land throws across the board: the fire gem's reach (ui/FireReach.js, the
// red and magenta swirl with its drifting embers) grows from the middle of the cards until it
// has passed the farthest one, then fades. Drawn under the cards, on the board.
import { createFireReach } from './FireReach.js';

const GROW_MS = 1000;
const FADE_MS = 500;
// How far past the farthest card the wave goes, so the cards at the edge are well inside it.
const OVERSHOOT_PX = 46;

/**
 * @param {Phaser.Scene} scene the fight scene (its cardSystem holds the board)
 * @param {{ x?: number, y?: number, reach?: number }} [opts] centre and final radius; by default the
 *        middle of the board's cards and just past the farthest one
 * @returns {number} ms until the wave is gone
 */
export function playHeatWave(scene, { x = null, y = null, reach = null } = {}) {
    const cards = (scene?.cardSystem?.boardCards || []).filter((card) => card?.sprite?.scene);
    if (!scene?.add || !cards.length) return 0;
    const xs = cards.map((card) => card.sprite.x);
    const ys = cards.map((card) => card.sprite.y);
    const cx = Math.round(x ?? (Math.min(...xs) + Math.max(...xs)) / 2);
    const cy = Math.round(y ?? (Math.min(...ys) + Math.max(...ys)) / 2);
    const radius = reach ?? Math.max(...cards.map((card) => Math.hypot(card.sprite.x - cx, card.sprite.y - cy))) + OVERSHOOT_PX;

    const fx = createFireReach(scene, 1);
    const grow = { r: 0 };
    let gone = false;
    const destroy = () => { if (gone) return; gone = true; fx.destroy(); };
    scene.events.once('shutdown', destroy);
    scene.tweens.add({
        targets: grow, r: radius, duration: GROW_MS, ease: 'Sine.easeOut',
        onUpdate: () => { if (!gone) fx.setTarget(cx, cy, Math.max(1, Math.round(grow.r))); },
        onComplete: () => {
            if (gone) return;
            scene.tweens.add({
                targets: fx.graphics, alpha: 0, duration: FADE_MS, ease: 'Sine.easeIn',
                onComplete: destroy,
            });
        },
    });
    return GROW_MS + FADE_MS;
}

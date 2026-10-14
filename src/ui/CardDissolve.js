// ui/CardDissolve.js
// A card dissolving away: it lifts a few pixels, holds a beat, then the
// dissolve sheet plays over it. The one implementation of the effect — the
// board's enemy deaths and broken items (BoardCardFx.playCardDisappearEffect /
// playCardBreakEffect) call this too.
//
// Drawn in whichever scene is given: an event screen sits above the bag, and a
// dissolve drawn in GameScene would play underneath it, unseen.
//
// kind 'break' is the player-card dissolve (a spent weapon, a used potion, a
// card an event takes); 'enemy' is the enemy death dissolve.

import { snapOriginToPixelGrid } from './PixelSnap.js';

const SHEETS = {
    break: { sheet: 'cardBreakSheet', anim: 'card_break_anim' },
    enemy: { sheet: 'cardDisappearSheet', anim: 'card_disappear_anim' },
};
const LIFT = 4;
const LIFT_MS = 220;
const HOLD_MS = 100;
const DEPTH = 1000;

/**
 * Dissolve a copy of `sprite` (a card on screen, possibly in another scene)
 * in `scene`, at the card's position. The caller removes the real card.
 * `depth` defaults to above everything (1000); the board passes the card's
 * own depth + 5 so the dissolve stays under its overlays.
 */
export function playCardDissolve(scene, sprite, kind = 'break', { depth = DEPTH } = {}) {
    if (!scene?.add || !sprite) return null;
    let { sheet, anim } = SHEETS[kind] || SHEETS.break;
    if (!scene.textures.exists(sheet)) ({ sheet, anim } = SHEETS.enemy);
    if (!scene.textures.exists(sheet)) return null;

    const x = Math.round(sprite.x);
    const y = Math.round(sprite.y);
    // Ghost of the real card that lifts with the dissolve. Skipped for
    // placeholder textures, which have nothing meaningful to copy.
    const texKey = sprite.texture?.key;
    let ghost = null;
    if (texKey && texKey !== '__MISSING' && texKey !== '__DEFAULT') {
        ghost = scene.add.image(x, y, texKey, sprite.frame?.name)
            .setOrigin(sprite.originX ?? 0.5, sprite.originY ?? 0.5)
            .setScale(sprite.scaleX ?? 1, sprite.scaleY ?? 1)
            .setDepth(depth);
        scene.tweens.add({ targets: ghost, y: y - LIFT, duration: LIFT_MS, ease: 'Sine.easeOut' });
    }
    const fx = snapOriginToPixelGrid(scene.add.sprite(x, y, sheet, 0)).setDepth(depth + 1);
    scene.tweens.add({ targets: fx, y: y - LIFT, duration: LIFT_MS, ease: 'Sine.easeOut' });

    const cleanup = () => {
        if (fx.active) fx.destroy();
        if (ghost?.active) ghost.destroy();
    };
    // Hover a beat, then dissolve. The ghost goes the instant the dissolve
    // starts: the frames draw the card vanishing on their own, and the intact
    // card showing through the late, near-transparent frames flickers back in.
    scene.time.delayedCall(HOLD_MS, () => {
        if (!fx.active) return;
        if (ghost?.active) ghost.destroy();
        if (scene.anims.exists(anim)) {
            fx.play(anim);
            fx.once('animationcomplete', cleanup);
        } else {
            cleanup();
        }
    });
    // Safety net in case the animation event is missed.
    scene.time.delayedCall(HOLD_MS + 1000, cleanup);
    return fx;
}

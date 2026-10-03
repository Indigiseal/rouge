// The highlight that sweeps across a gem while the pointer is on it.
//
// gemLightAnim.png is a 7-frame diagonal streak on an 18x18 cell — the same
// cell as gemsTiered and gemSpot, so the streak lines up with the stone without
// any offset arithmetic.
//
// The streak is a rectangle of light and a gem is a faceted diamond, so drawn
// plainly it would spill past the stone onto whatever is behind it. A BITMAP
// mask fixes that: the gem sprite itself is the mask, so the shine is only
// drawn where the gem has opaque pixels. It therefore follows the silhouette of
// whichever tier is showing — a small shard clips the sweep to a sliver, a big
// gem lets nearly all of it through — with nothing to keep in sync.
//
// A geometry mask would NOT do: those clip to a shape you draw, not to the
// artwork's own alpha, which would put the rectangle back.
//
// Two ways to wear it:
//
//   container — a socketed gem, whose spot and stone live in one container.
//               The shine joins them and moves when they move.
//   loose     — a gem lying on a board or a shop shelf, which is dragged
//               around. Nothing parents it, so call sync() when it moves.

const SHEET = 'gemLightAnim';
const ANIM_KEY = 'gem_shine_sweep';
const FRAME_COUNT = 7;
const FRAME_RATE = 14;

/** Registers the sweep once per game; safe to call for every gem drawn. */
function ensureAnimation(scene) {
    if (scene.anims.exists(ANIM_KEY)) return true;
    if (!scene.textures.exists(SHEET)) return false;
    scene.anims.create({
        key: ANIM_KEY,
        frames: scene.anims.generateFrameNumbers(SHEET, { start: 0, end: FRAME_COUNT - 1 }),
        frameRate: FRAME_RATE,
        repeat: -1,
    });
    return true;
}

/**
 * @param {Phaser.Scene} scene
 * @param {Phaser.GameObjects.Sprite} gemSprite the gem, and the mask
 * @param {{ container?: Phaser.GameObjects.Container, depth?: number }} [opts]
 * @returns {{ shine, start, stop, sync } | null} null when the art is missing,
 *   in which case the gem simply does not shine.
 */
export function attachGemShine(scene, gemSprite, opts = {}) {
    if (!ensureAnimation(scene)) return null;
    const { container = null, depth = null } = opts;

    const shine = scene.add.sprite(gemSprite.x, gemSprite.y, SHEET, 0)
        .setOrigin(gemSprite.originX, gemSprite.originY)
        .setVisible(false);
    // SCREEN keeps the streak reading as light on the stone rather than paint.
    shine.setBlendMode(Phaser.BlendModes.SCREEN);
    shine.setMask(gemSprite.createBitmapMask());

    if (container) {
        // Inside the container the gem sits at the origin, so the shine does too.
        shine.setPosition(gemSprite.x, gemSprite.y);
        container.add(shine);
    } else {
        shine.setDepth(depth ?? ((gemSprite.depth || 0) + 1));
    }

    const sync = () => {
        if (!shine.scene || container) return;
        shine.setPosition(gemSprite.x, gemSprite.y);
        shine.setScale(gemSprite.scaleX, gemSprite.scaleY);
    };
    const start = () => {
        if (!shine.scene) return;
        sync();
        shine.setVisible(true).play(ANIM_KEY);
    };
    const stop = () => {
        if (!shine.scene) return;
        shine.stop();
        shine.setVisible(false);
    };

    const api = { shine, start, stop, sync };
    // The mask holds a reference to the gem, so the shine must not outlive it.
    gemSprite.once('destroy', () => {
        shine.clearMask(true);
        shine.destroy();
    });
    gemSprite.gemShine = api;
    if (container) {
        container.gemShine = shine;
        container.startGemShine = start;
        container.stopGemShine = stop;
    }
    return api;
}

// ui/StrikeSlash.js
// The slash arc (playerAttackAnim.png, 4 frames of 54x70) played over a card
// as it strikes. The player's weapons, off-hand dagger and companions swing it
// downward at the board; an enemy plays it flipped upside down, so it reads
// as a blow coming back at the player.

const STRIKE_FPS = 14;
// The slash sits this many pixels off the card's centre, toward where the
// blow is going: up for the player's cards, down for an enemy's.
const STRIKE_LIFT_PX = 6;
const ANIM_KEY = 'player_attack_anim';

/**
 * Play the slash over `sprite` (at its position, or at x/y if given), drawn
 * in `scene` just above the card. `flipY` turns it upside down.
 */
export function playStrikeSlash(scene, sprite, { x = sprite?.x, y = sprite?.y, flipY = false } = {}) {
    if (!scene?.add || !sprite?.scene || !scene.textures?.exists?.('playerAttackAnim')) return null;
    if (!scene.anims.exists(ANIM_KEY)) {
        scene.anims.create({
            key: ANIM_KEY,
            frames: scene.anims.generateFrameNumbers('playerAttackAnim', { start: 0, end: 3 }),
            frameRate: STRIKE_FPS,
            repeat: 0,
        });
    }
    const lift = flipY ? STRIKE_LIFT_PX : -STRIKE_LIFT_PX;
    const slash = scene.add.sprite(Math.round(x), Math.round(y) + lift, 'playerAttackAnim', 0)
        .setFlipY(flipY)
        .setDepth((sprite.depth || 0) + 3);
    slash.play(ANIM_KEY);
    slash.once('animationcomplete', () => slash.destroy());
    scene.time?.delayedCall?.(800, () => slash.active && slash.destroy());
    return slash;
}

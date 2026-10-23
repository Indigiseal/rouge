import { HOVER_SHINE_ANIM } from './RainbowShine.js';

const activeShines = new WeakMap();

// Use the face-up card's light-only sweep over the actual back art. Old hover
// sheets contain the back itself, so playing them would replace location art.
export function showCardBackHover(scene, sprite) {
    hideCardBackHover(sprite);
    if (!scene.textures.exists('hoverCardsUpSheet') || !scene.anims.exists(HOVER_SHINE_ANIM)) return;

    const shine = scene.add.sprite(sprite.x, sprite.y, 'hoverCardsUpSheet', 0)
        .setBlendMode('SCREEN');
    const follow = () => {
        shine.setPosition(Math.round(sprite.x), Math.round(sprite.y));
        shine.setOrigin(sprite.originX, sprite.originY);
        shine.setDisplaySize(sprite.displayWidth, sprite.displayHeight);
        shine.setDepth(sprite.depth + 1);
        shine.setAlpha(sprite.alpha);
        shine.setVisible(sprite.visible);
    };
    const cleanup = () => hideCardBackHover(sprite);
    activeShines.set(sprite, { scene, shine, follow, cleanup });
    scene.events.on('postupdate', follow);
    sprite.once('destroy', cleanup);
    follow();
    shine.play(HOVER_SHINE_ANIM);
}

export function hideCardBackHover(sprite) {
    const active = activeShines.get(sprite);
    if (!active) return;
    activeShines.delete(sprite);
    active.scene.events.off('postupdate', active.follow);
    sprite.off('destroy', active.cleanup);
    active.shine.destroy();
}

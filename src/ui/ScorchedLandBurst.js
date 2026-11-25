import { playBoardImpactRipple } from './BoardImpactRipple.js';

// Eight 194x156 cells, played quickly on the board beneath the card faces.
export function playScorchedLandBurst(scene, { x, y }) {
    if (!scene?.sys?.game || !scene.textures?.exists('scorchedLandBurst') || !scene.anims) return;
    const key = 'scorched_land_burst';
    if (!scene.anims.exists(key)) scene.anims.create({ key,
        frames: scene.anims.generateFrameNumbers('scorchedLandBurst', { start: 0, end: 7 }), frameRate: 16, repeat: 0 });
    const wave = scene.add.sprite(Math.round(x), Math.round(y), 'scorchedLandBurst', 0).setScale(1);
    // Fresh cards can be depth 0; restored ones use depth 2. Share the lowest
    // card layer and insert below it, keeping the wave above the board panel.
    const cards = (scene.cardSystem?.boardCards || []).map(card => card?.sprite).filter(sprite => sprite?.scene);
    wave.setDepth(cards.length ? Math.min(...cards.map(sprite => sprite.depth)) : 0);
    scene.children.depthSort();
    const lowest = cards.reduce((min, sprite) => !min || scene.children.getIndex(sprite) < scene.children.getIndex(min) ? sprite : min, null);
    if (lowest) scene.children.moveBelow(wave, lowest);
    let impacted = false;
    wave.on('animationupdate', (animation, frame) => {
        if (!impacted && frame.textureFrame === 1) {
            impacted = true;
            playBoardImpactRipple(scene, { x: wave.x, y: wave.y });
        }
    });
    wave.once('animationcomplete', () => wave.destroy());
    wave.play(key);
}

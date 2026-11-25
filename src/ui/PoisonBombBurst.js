import { playBoardImpactRipple } from './BoardImpactRipple.js';

// Ten 126x78 cells, played at native size with a quicker burst.
export function playPoisonBombBurst(scene, { x, y }) {
    if (!scene?.sys?.game || !scene.textures?.exists('poisonBombBurst') || !scene.anims) return;
    const key = 'poison_bomb_burst';
    if (!scene.anims.exists(key)) {
        scene.anims.create({ key, frames: scene.anims.generateFrameNumbers('poisonBombBurst', { start: 0, end: 9 }), frameRate: 16, repeat: 0 });
    }
    const burst = scene.add.sprite(Math.round(x), Math.round(y), 'poisonBombBurst', 0).setScale(1).setDepth(1100);
    let impacted = false;
    burst.on('animationupdate', (animation, frame) => {
        if (!impacted && frame.textureFrame === 2) {
            impacted = true;
            playBoardImpactRipple(scene, { x: burst.x, y: burst.y });
        }
    });
    burst.once('animationcomplete', () => burst.destroy());
    burst.play(key);
}

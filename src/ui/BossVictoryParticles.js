// Small pixel confetti bursts from both sides and the screen's center. Scene-owned
// emitters expire naturally and are also cleaned up when the scene shuts down.
export function playBossVictoryParticles(scene) {
    const texture = 'boss_victory_confetti';
    if (!scene.textures.exists(texture)) {
        const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0xffffff).fillRect(0, 0, 3, 5);
        graphics.generateTexture(texture, 3, 5);
        graphics.destroy();
    }

    const bursts = [
        [150, 240, -80, -25],
        [490, 240, -155, -100],
        [320, 180, -155, -25],
    ];
    for (const [x, y, minAngle, maxAngle] of bursts) {
        const emitter = scene.add.particles(x, y, texture, {
            emitting: false,
            lifespan: { min: 1400, max: 2200 },
            speed: { min: 180, max: 320 },
            angle: { min: minAngle, max: maxAngle },
            gravityY: 180,
            rotate: { min: 0, max: 360 },
            tint: [0xffd166, 0xfff0b0, 0xe77755, 0x83c9a3, 0xc5a3e8],
            alpha: { start: 1, end: 0 },
            scale: { start: 1, end: 0.5 },
        }).setDepth(500);
        emitter.once('complete', () => emitter.destroy());
        emitter.explode(45);
    }
}

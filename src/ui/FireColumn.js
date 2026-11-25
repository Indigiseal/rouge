// Fire Column: nine native-size frames, anchored to the target's feet.
export function playFireColumn(scene, target) {
    if (!scene?.sys?.game || !target?.scene) return;
    if (!scene.textures?.exists('fireColumnBurst')) {
        // A running game may predate this asset's addition to the boot manifest.
        // Queue every target, but fetch the sheet just once.
        (scene._pendingFireColumns ||= []).push(target);
        if (scene._loadingFireColumn) return;
        scene._loadingFireColumn = true;
        const loaded = () => {
            scene.load.off('loaderror', failed);
            scene._loadingFireColumn = false;
            const targets = scene._pendingFireColumns || [];
            scene._pendingFireColumns = [];
            for (const sprite of new Set(targets)) if (sprite?.scene) playFireColumn(scene, sprite);
        };
        const failed = file => {
            if (file?.key !== 'fireColumnBurst') return;
            scene.load.off('filecomplete-spritesheet-fireColumnBurst', loaded);
            scene.load.off('loaderror', failed);
            scene._loadingFireColumn = false;
            scene._pendingFireColumns = [];
        };
        scene.load.once('filecomplete-spritesheet-fireColumnBurst', loaded);
        scene.load.on('loaderror', failed);
        scene.load.spritesheet('fireColumnBurst', 'assets/art/fireColumnAnim.png', { frameWidth: 134, frameHeight: 192 });
        if (!scene.load.isLoading()) scene.load.start();
        return;
    }
    const key = 'fire_column_burst';
    if (!scene.anims.exists(key)) scene.anims.create({ key,
        frames: scene.anims.generateFrameNumbers('fireColumnBurst', { start: 0, end: 8 }), frameRate: 16, repeat: 0 });
    const bottom = target.y + (target.displayHeight || 70) * (1 - (target.originY ?? 0.5));
    const column = scene.add.sprite(Math.round(target.x), Math.round(bottom), 'fireColumnBurst', 0)
        .setOrigin(0.5, 1).setDepth((target.depth || 0) + 10);
    column.once('animationcomplete', () => column.destroy());
    column.play(key);
}

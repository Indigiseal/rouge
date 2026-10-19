import assert from 'node:assert/strict';
globalThis.Phaser = { Scene: class {}, Renderer: { WebGL: { Pipelines: { PostFXPipeline: class {} } } } };
const { GameScene } = await import('../src/scenes/GameScene.js');

for (const original of [null, { fill: false, color: 0x71b1ae }, { fill: true, color: 0x712a65 }]) {
    for (const soft of [false, true]) {
        const timers = [];
        const scene = {
            tweens: { killTweensOf() {}, add() {} },
            time: { delayedCall(delay, callback) {
                const timer = { callback, removed: false, remove() { this.removed = true; } };
                timers.push(timer); return timer;
            } },
        };
        const sprite = {
            scene, x: 100, y: 100, isTinted: Boolean(original),
            tintFill: original?.fill || false, tintTopLeft: original?.color || 0xffffff,
            setPosition(x, y) { this.x = x; this.y = y; },
            setTintFill(color) { this.isTinted = true; this.tintFill = true; this.tintTopLeft = color; },
            setTint(color) { this.isTinted = true; this.tintFill = false; this.tintTopLeft = color; },
            clearTint() { this.isTinted = false; this.tintFill = false; this.tintTopLeft = 0xffffff; },
        };
        GameScene.prototype.shakeCard.call(scene, sprite);
        assert.equal(sprite.tintFill, true);
        GameScene.prototype.shakeCard.call(scene, sprite, { soft });
        assert.equal(timers[0].removed, true);
        timers.filter(timer => !timer.removed).forEach(timer => timer.callback());
        assert.equal(sprite.isTinted, Boolean(original), 'overlapping impacts restore the original tint state');
        assert.equal(sprite.tintFill, original?.fill || false);
        assert.equal(sprite.tintTopLeft, original?.color || 0xffffff);
        assert.equal(scene._hitStackRestoreTint.size, 0);
    }
}
console.log('Hit flash checks passed: overlapping hits and poison nudges restore all original tint modes.');

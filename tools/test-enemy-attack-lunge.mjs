import assert from 'node:assert/strict';
import { playEnemyAttackLunge } from '../src/ui/EnemyAttackLunge.js';
const part = y => ({ scene: {}, y, setY(value) { this.y = value; return this; } });
for (const restY of [undefined, 100]) for (const crit of [false, true]) {
    const sprite = part(100), info = part(122), shadow = part(128);
    const card = { sprite, infoText: info, shadow, ...(restY === undefined ? {} : { restY }) };
    const queue = [];
    const scene = { tweens: { isTweening: () => false, add(config) { const tween = { config, stop() { config.onStop?.(); } }; queue.push(tween); return tween; } } };
    for (let attack = 0; attack < 10; attack++) {
        playEnemyAttackLunge(scene, card, { crit });
        while (queue.length) {
            const { config } = queue.shift();
            const start = config.targets.dy;
            for (let i = 1; i <= 5; i++) {
                config.targets.dy = start + (config.dy - start) * i / 5;
                config.onUpdate();
                assert.equal(info.y - sprite.y, 22, 'stats stay at their original offset');
                assert.equal(shadow.y, 128, 'shadow remains on the ground');
            }
            config.onComplete();
        }
        assert.equal(sprite.y, 100, 'card returns to its original position after each attack');
        assert.equal(info.y, 122, 'text returns to its original position after each attack');
    }
}
console.log('Repeated normal and critical enemy attacks keep card and text anchored, with or without a saved rest position.');

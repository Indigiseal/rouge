import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

// Exercise the real button handlers without a browser renderer or audio.
globalThis.Phaser = { Scene: class {} };
const { MainMenuScene } = await import('../src/scenes/MainMenuScene.js');
const { SoundHelper } = await import('../src/audio/SoundHelper.js');
SoundHelper.playVariant = () => {};

function gameObject() {
    const object = new EventEmitter();
    object.width = 20;
    for (const method of ['setOrigin', 'setTint', 'clearTint', 'setAlpha',
        'setStrokeStyle', 'setInteractive', 'setTexture', 'setFrame', 'setY',
        'setFontSize']) {
        object[method] = () => object;
    }
    return object;
}

for (const hasSprite of [true, false]) {
    for (const kind of ['sprite', 'icon', 'ui']) {
        const scene = new MainMenuScene();
        scene.textures = { exists: () => hasSprite };
        scene.add = { image: gameObject, rectangle: gameObject, text: gameObject };
        let activations = 0;
        const callback = () => activations++;
        const { button } = kind === 'sprite'
            ? scene.createSpriteButton(320, 22, 'Options', callback)
            : kind === 'icon'
                ? scene.createIconButton(618, 22, 'optionsButton', callback)
                : scene.createUiButton(320, 22, 0, 'Back', { callback });
        const pointer = { id: 0 };
        const otherPointer = { id: 1 };

        // Back closes the tutorial on press; only its release reaches the menu.
        button.emit('pointerup', pointer);
        assert.equal(activations, 0, `${kind}: tutorial release must be ignored`);

        button.emit('pointerdown', pointer);
        button.emit('pointerup', pointer);
        assert.equal(activations, 1, `${kind}: a fresh click must work`);
        button.emit('pointerup', pointer);
        assert.equal(activations, 1, `${kind}: duplicate release must be ignored`);

        button.emit('pointerdown', pointer);
        button.emit('pointerout', pointer);
        button.emit('pointerover', pointer);
        button.emit('pointerup', pointer);
        assert.equal(activations, 1, `${kind}: leaving the button cancels the press`);

        button.emit('pointerdown', pointer);
        button.emit('pointerup', otherPointer);
        assert.equal(activations, 1, `${kind}: another finger cannot activate it`);

        button.emit('pointerdown', pointer);
        button.emit('pointerup', pointer);
        assert.equal(activations, 2, `${kind}: clicks still work after cancellation`);
    }
}

console.log('Menu click regression checks passed (all three button types, with and without sprites).');

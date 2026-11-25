// Scene-local loading feedback for downloads after the initial boot overlay.
import { t } from '../i18n/i18n.js';
import { serifStyle } from './uiFont.js';

export function showSceneLoading(scene) {
    if (!scene.add?.container) return;
    const shade = scene.add.rectangle(320, 180, 640, 360, 0x21191c);
    const label = scene.add.text(320, 168, t(scene, 'ui.loading.progress', { pct: 0 }),
        serifStyle('18px', '#fef0cf')).setOrigin(0.5);
    const track = scene.add.rectangle(220, 199, 200, 4, 0x51484b).setOrigin(0, 0.5);
    const fill = scene.add.rectangle(220, 199, 0, 4, 0xc8ab78).setOrigin(0, 0.5);
    const overlay = scene.add.container(0, 0, [shade, label, track, fill])
        .setDepth(10000).setName('scene-loading');
    const progress = value => {
        label.setText(t(scene, 'ui.loading.progress', { pct: Math.round(value * 100) }));
        fill.width = Math.round(200 * value);
    };
    const cleanup = () => {
        scene.load.off('progress', progress);
        scene.load.off('complete', cleanup);
        scene.events.off('shutdown', cleanup);
        overlay.destroy();
    };
    scene.load.on('progress', progress);
    scene.load.once('complete', cleanup);
    scene.events.once('shutdown', cleanup);
}

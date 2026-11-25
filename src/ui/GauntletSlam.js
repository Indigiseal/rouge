import { SoundHelper } from '../audio/SoundHelper.js';
import { playBoardImpactRipple } from './BoardImpactRipple.js';

// The ogre's hand, six 148x116 frames in assets/art/packed/handANim.png,
// shown at the size it is drawn (Taya; it was doubled).
export function playGauntletSlam(scene, { x = 320, y = 150 } = {}) {
    if (!scene?.sys?.game || !scene.textures?.exists('gauntletHandSlam') || !scene.anims) return;
    const key = 'gauntlet_hand_slam';
    if (!scene.anims.exists(key)) {
        scene.anims.create({ key, frames: scene.anims.generateFrameNumbers('gauntletHandSlam', { start: 0, end: 5 }), frameRate: 12, repeat: 0 });
    }
    const hand = scene.add.sprite(Math.round(x), Math.round(y), 'gauntletHandSlam', 0).setDepth(1100);
    hand.once('animationcomplete', () => hand.destroy());
    let impacted = false;
    hand.on('animationupdate', (animation, frame) => {
        if (!impacted && frame.textureFrame === 3) {
            impacted = true;
            playBoardImpactRipple(scene, { x: hand.x, y: hand.y, height: 9 });
        }
    });
    SoundHelper.playSound(scene, 'gauntlet_slam', 0.65);
    hand.play(key);
}

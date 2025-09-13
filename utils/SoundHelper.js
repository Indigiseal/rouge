export class SoundHelper {
    static playSound(scene, soundKey, baseVolume = 1.0) {
        if (!scene.game.globalVolume) {
            scene.game.globalVolume = {
                master: 1.0,
                sfx: 1.0,
                music: 0.5
            };
        }
        
        const finalVolume = baseVolume * 
            scene.game.globalVolume.master * 
            scene.game.globalVolume.sfx;
        
        scene.sound.play(soundKey, { volume: finalVolume });
    }
    
    static playMusic(scene, musicKey, baseVolume = 1.0) {
        if (!scene.game.globalVolume) {
            scene.game.globalVolume = {
                master: 1.0,
                sfx: 1.0,
                music: 0.5
            };
        }
        
        const finalVolume = baseVolume * 
            scene.game.globalVolume.master * 
            scene.game.globalVolume.music;
        
        // Stop any existing music
        scene.sound.stopAll();
        
        // Play new music on loop
        const music = scene.sound.add(musicKey, {
            volume: finalVolume,
            loop: true
        });
        music.play();
        
        return music;
    }
}

// Example of how to update existing sound calls in your game:
// Instead of: this.sound.play('coin_collect', { volume: 0.4 });
// Use: SoundHelper.playSound(this, 'coin_collect', 0.4);
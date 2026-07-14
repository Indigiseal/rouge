import { SoundHelper } from './SoundHelper.js';

export class MusicManager {
    static current = null;

    static play(scene, musicKey, baseVolume = 0.6, fadeMs = 800, loop = true) {
        if (!scene?.sound) return null;
        if (scene.cache?.audio && !scene.cache.audio.exists(musicKey)) return null;

        if (this.current?.key === musicKey && this.current.sound && !this.current.sound._rogueCancelled) {
            this.current.baseVolume = baseVolume;
            this.updateCurrentVolume(scene);
            return this.current.sound;
        }

        this.stop(scene, fadeMs);

        const sound = SoundHelper.fadeInMusic(scene, musicKey, baseVolume, fadeMs, loop);
        this.current = sound ? { key: musicKey, sound, baseVolume } : null;
        return sound;
    }

    static stop(scene, fadeMs = 600) {
        const current = this.current;
        if (!current?.sound) {
            this.current = null;
            return;
        }

        SoundHelper.fadeOutMusic(scene, current.sound, fadeMs);
        this.current = null;
    }

    static stopIfPlaying(scene, musicKey, fadeMs = 600) {
        if (this.current?.key !== musicKey) return;
        this.stop(scene, fadeMs);
    }

    static updateCurrentVolume(scene) {
        const current = this.current;
        if (!current?.sound || current.sound._rogueCancelled) return;

        const gv = SoundHelper.ensureGlobalVolume(scene);
        const volume = (current.baseVolume ?? 0.6) * gv.master * gv.music;
        current.sound.setVolume?.(volume);
    }
}

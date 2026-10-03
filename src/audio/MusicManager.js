import { SoundHelper } from './SoundHelper.js';
import { deferredAudioPath } from '../content/assets/AssetManifest.js';

export class MusicManager {
    static current = null;
    // The track the game most recently asked for. A deferred download can land
    // after the player has moved on, so the request that finishes must check it
    // is still the one wanted before it starts anything.
    static wanted = null;
    // Deferred tracks already in flight, so asking twice can't queue the same
    // download twice.
    static pending = new Set();

    static play(scene, musicKey, baseVolume = 0.6, fadeMs = 800, loop = true) {
        if (!scene?.sound) return null;

        if (scene.cache?.audio && !scene.cache.audio.exists(musicKey)) {
            // The long music tracks are not in the boot manifest — fetch on
            // first use and start when it lands. A key that is genuinely
            // missing still no-ops, the way this always behaved.
            this.loadThenPlay(scene, musicKey, baseVolume, fadeMs, loop);
            return null;
        }

        if (this.current?.key === musicKey && this.current.sound && !this.current.sound._rogueCancelled) {
            this.wanted = musicKey;
            this.current.baseVolume = baseVolume;
            this.updateCurrentVolume(scene);
            return this.current.sound;
        }

        // stop() clears `wanted`, so claim it afterwards, not before.
        this.stop(scene, fadeMs);
        this.wanted = musicKey;

        const sound = SoundHelper.fadeInMusic(scene, musicKey, baseVolume, fadeMs, loop);
        this.current = sound ? { key: musicKey, sound, baseVolume } : null;
        return sound;
    }

    // Fetch a deferred track in the background and start it once it arrives.
    // The screen is silent until then — a second or two of quiet on entry,
    // instead of decoding minutes of audio before the game will draw at all.
    static loadThenPlay(scene, musicKey, baseVolume, fadeMs, loop) {
        const path = deferredAudioPath(musicKey);
        if (!path || this.pending.has(musicKey)) return;
        if (!scene.load || !scene.cache?.audio) return;

        this.pending.add(musicKey);
        this.wanted = musicKey;

        // Listen for this file specifically. The loader's generic 'complete'
        // fires for whatever else a scene happens to be loading, which would
        // start the music off the back of an unrelated download.
        scene.load.once(`filecomplete-audio-${musicKey}`, () => {
            this.pending.delete(musicKey);
            if (this.wanted !== musicKey) return;             // something newer won
            if (!scene.scene?.isActive?.()) return;            // player already left
            if (!scene.cache.audio.exists(musicKey)) return;   // arrived unusable
            this.play(scene, musicKey, baseVolume, fadeMs, loop);
        });
        scene.load.once('loaderror', (file) => {
            if (file?.key === musicKey) this.pending.delete(musicKey);
        });

        scene.load.audio(musicKey, path);
        if (!scene.load.isLoading()) scene.load.start();
    }

    static stop(scene, fadeMs = 600) {
        // Also abandons any pending deferred track, so leaving a screen before
        // its music has downloaded doesn't start it playing on the way out.
        this.wanted = null;

        const current = this.current;
        if (!current?.sound) {
            this.current = null;
            return;
        }

        SoundHelper.fadeOutMusic(scene, current.sound, fadeMs);
        this.current = null;
    }

    static stopIfPlaying(scene, musicKey, fadeMs = 600) {
        // Cancel it even if it is still downloading rather than playing —
        // otherwise it starts up moments after the scene that wanted it ends.
        if (this.wanted === musicKey) this.wanted = null;
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

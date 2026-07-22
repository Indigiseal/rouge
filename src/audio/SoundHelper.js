import { normalizeVolumeSettings } from './VolumeSettings.js';

export class SoundHelper {
    // Named groups of interchangeable SFX variants. playVariant() picks one at
    // random so frequently repeated sounds do not get grating.
    static SFX_VARIANTS = {
        enemy_hit: ['enemy_hit_1', 'enemy_hit_2', 'enemy_hit_3', 'enemy_hit_4'],
        card_place: ['card_place_1', 'card_place_2', 'card_place_3', 'card_place_4'],
        lightning_zap: ['lightning_zap_1', 'lightning_zap_2', 'lightning_zap_3'],
        enemy_death: ['enemy_death_1', 'enemy_death_2'],
        hover_button: ['hover_button_1'],
        dodge_miss: ['dodge_miss_1', 'dodge_miss_2', 'dodge_miss_3'],
        map_select: ['map_select_3'],
        armor_break: ['armor_break_1', 'armor_break_2', 'armor_break_3'],
        button_click: ['button_click_1', 'button_click_2'],
        invalid_action: ['invalid_action_1', 'invalid_action_2'],
        legendary_reveal: ['legendary_reveal_1', 'legendary_reveal_2'],
        player_hurt: ['player_hurt_1', 'player_hurt_2', 'player_hurt_3'],
        bread_eaten: ['bread_eaten_1', 'bread_eaten_2', 'bread_eaten_3'],
        empty_stomach: ['empty_stomach_1', 'empty_stomach_2'],
        new_level: ['new_level_1', 'new_level_3'],
        hero_death: ['hero_death_1', 'hero_death_2', 'hero_death_3'],

        // New SFX drop (2026-07). These groups are named after the SINGLE
        // canonical key existing call sites already pass to playSound(), so the
        // redirect in playSound() rotates a random take behind that same key —
        // no call-site changes needed. Single-take sounds from the same drop
        // are just swapped in place in PreloadScene, so they aren't listed here.
        card_flip: ['card_flip_v1', 'card_flip_v2', 'card_flip_v3', 'card_flip_v4'],
        coin_collect: ['coin_collect_v1', 'coin_collect_v2'],
        shop_buy: ['shop_buy_v1', 'shop_buy_v2'],
        chest_open: ['chest_open_v1', 'chest_open_v2'],
        anvil_upgrade: ['anvil_upgrade_v1', 'anvil_upgrade_v2'],
        fireball_whoosh: ['fireball_whoosh_v1', 'fireball_whoosh_v2'],
        recovery: ['recovery_v1', 'recovery_v2'],
        gem_pickup: ['gem_pickup_v1', 'gem_pickup_v2', 'gem_pickup_v3', 'gem_pickup_v4']
    };

    static ensureGlobalVolume(scene) {
        scene.game.globalVolume = normalizeVolumeSettings(scene?.game.globalVolume);
        return scene.game.globalVolume;
    }

    static getAudioContext(scene) {
        return scene?.sound?.context || scene?.game?.sound?.context || null;
    }

    static audioNeedsGesture(scene) {
        const ctx = this.getAudioContext(scene);
        return !!scene?.sound?.locked || (ctx && ctx.state !== 'running');
    }

    static resumeAudio(scene) {
        try { scene?.sound?.unlock?.(); } catch (_) {}

        const ctx = this.getAudioContext(scene);
        if (ctx?.resume && ctx.state !== 'running' && ctx.state !== 'closed') {
            try { return ctx.resume(); } catch (_) {}
        }

        return Promise.resolve();
    }

    static flushPendingAudio(game) {
        const pending = game?._roguePendingAudioCallbacks;
        if (!pending?.length) return;

        game._roguePendingAudioCallbacks = [];
        pending.forEach(callback => {
            try {
                callback();
            } catch (err) {
                console.warn('Deferred audio callback failed:', err);
            }
        });
    }

    static installUnlockListeners(scene) {
        const game = scene?.game;
        if (!game || game._rogueAudioUnlockListenersInstalled) return;

        game._rogueAudioUnlockListenersInstalled = true;
        const target = game.canvas || window;

        const unlock = () => {
            this.resumeAudio(scene).finally(() => {
                if (!this.audioNeedsGesture(scene)) {
                    this.flushPendingAudio(game);
                    target.removeEventListener?.('pointerdown', unlock);
                    target.removeEventListener?.('touchstart', unlock);
                    window.removeEventListener?.('keydown', unlock);
                    game._rogueAudioUnlockListenersInstalled = false;
                }
            });
        };

        target.addEventListener?.('pointerdown', unlock, { passive: true });
        target.addEventListener?.('touchstart', unlock, { passive: true });
        window.addEventListener?.('keydown', unlock, { passive: true });
    }

    static runWhenAudioReady(scene, callback) {
        if (!scene?.sound) return false;

        if (!this.audioNeedsGesture(scene)) {
            callback();
            return true;
        }

        const game = scene.game;
        game._roguePendingAudioCallbacks ||= [];

        let didRun = false;
        const runOnce = () => {
            if (didRun || this.audioNeedsGesture(scene)) return;
            didRun = true;
            callback();
        };

        game._roguePendingAudioCallbacks.push(runOnce);
        this.installUnlockListeners(scene);
        this.resumeAudio(scene).then(() => {
            if (!this.audioNeedsGesture(scene)) this.flushPendingAudio(game);
        }).catch(() => {});

        return false;
    }

    // Two copies of one sample started this close together don't read as two
    // hits — they phase into a single louder, muddier hit. Well under the gap
    // CombatSequencer puts between beats, so only genuine same-instant repeats
    // collapse.
    static DEDUPE_MS = 40;
    static _lastPlayedAt = new Map();
    static PENDING_AUDIO_TTL_MS = 900;
    static MAX_ACTIVE_SFX = 32;
    static _activeSfx = [];

    // Only cap genuinely oversized one-shot clips. Most gameplay SFX are meant
    // to keep their full tail; cutting those makes deaths/impacts feel wrong.
    static SFX_MAX_DURATION_MS = {
        recovery: 1200,
        magicShield: 1200,
        weakening: 1200
    };

    static SFX_PROTECTED = new Set([
        'boss_defeated',
        'enemy_death_1',
        'enemy_death_2',
        'hero_death_1',
        'hero_death_2',
        'hero_death_3'
    ]);

    static getMaxDurationMs(soundKey) {
        if (this.SFX_MAX_DURATION_MS[soundKey] !== undefined) return this.SFX_MAX_DURATION_MS[soundKey];
        return null;
    }

    static pruneActiveSfx() {
        this._activeSfx = this._activeSfx.filter(entry => entry.sound?.isPlaying);
    }

    static makeRoomForSfx() {
        this.pruneActiveSfx();
        if (this._activeSfx.length < this.MAX_ACTIVE_SFX) return;

        const index = this._activeSfx.findIndex(entry => !entry.protected);
        if (index === -1) return;

        const [entry] = this._activeSfx.splice(index, 1);
        try { entry.sound.stop(); } catch (_) {}
        try { entry.sound.destroy(); } catch (_) {}
    }

    static playSound(scene, soundKey, baseVolume = 1.0) {
        // If this key names a variant group, play a random member instead so a
        // canonical key (e.g. 'card_flip') transparently rotates its takes.
        // Variant keys ('card_flip_v1', …) aren't group names, so no recursion.
        const variants = this.SFX_VARIANTS[soundKey];
        if (variants) return this.playRandom(scene, variants, baseVolume);

        const gv = this.ensureGlobalVolume(scene);

        // Skip unloaded keys quietly instead of spamming Phaser warnings.
        if (scene.cache?.audio && !scene.cache.audio.exists(soundKey)) return;

        const now = scene.time?.now ?? performance.now();
        const last = this._lastPlayedAt.get(soundKey);
        if (last !== undefined && now - last < this.DEDUPE_MS) return;
        this._lastPlayedAt.set(soundKey, now);

        const finalVolume = baseVolume * gv.master * gv.sfx;
        const requestedAt = now;
        this.runWhenAudioReady(scene, () => {
            const currentTime = scene.time?.now ?? performance.now();
            if (currentTime - requestedAt > this.PENDING_AUDIO_TTL_MS) return;

            this.makeRoomForSfx();

            const sound = scene.sound.add(soundKey, { volume: finalVolume });
            let cleanedUp = false;
            const cleanup = () => {
                if (cleanedUp) return;
                cleanedUp = true;
                this._activeSfx = this._activeSfx.filter(entry => entry.sound !== sound);
                try { sound.destroy(); } catch (_) {}
            };

            this._activeSfx.push({
                sound,
                key: soundKey,
                protected: this.SFX_PROTECTED.has(soundKey)
            });

            sound.once?.('complete', cleanup);
            sound.once?.('stop', cleanup);
            if (sound.play() === false) {
                cleanup();
                return;
            }

            const maxDuration = this.getMaxDurationMs(soundKey);
            if (maxDuration && scene.time?.delayedCall) {
                scene.time.delayedCall(maxDuration, () => {
                    if (!sound.isPlaying) return;
                    try { sound.stop(); } catch (_) {}
                    cleanup();
                });
            }
        });
    }

    static playRandom(scene, keys, baseVolume = 1.0) {
        if (!keys || !keys.length) return;
        const key = keys[Math.floor(Math.random() * keys.length)];
        this.playSound(scene, key, baseVolume);
    }

    static playVariant(scene, group, baseVolume = 1.0) {
        this.playRandom(scene, this.SFX_VARIANTS[group], baseVolume);
    }

    // Stop whatever fade is currently animating this track's volume.
    // The tween handle lives on the sound rather than being looked up via
    // scene.tweens.killTweensOf(): a track started by one scene is often faded
    // out by another, and each scene owns a separate tween manager, so the
    // stopping scene can't find (or kill) the starting scene's tween.
    static cancelFade(music) {
        const tween = music?._rogueFadeTween;
        if (!tween) return;
        music._rogueFadeTween = null;
        try { tween.stop(); } catch (_) {}
        try { tween.remove(); } catch (_) {}
    }

    // Start a looping track from silence and tween up to its target volume.
    // Returns the sound so the caller can fade it back out later.
    static fadeInMusic(scene, musicKey, baseVolume = 0.6, fadeMs = 800, loop = true) {
        if (!scene?.sound) return null;
        if (scene.cache?.audio && !scene.cache.audio.exists(musicKey)) return null;

        const gv = this.ensureGlobalVolume(scene);
        const target = baseVolume * (gv.master ?? 1) * (gv.music ?? 1);
        const music = scene.sound.add(musicKey, { volume: 0, loop });

        this.runWhenAudioReady(scene, () => {
            if (music._rogueCancelled) return;

            music.play();
            if (scene.tweens && target > 0) {
                this.cancelFade(music);
                music._rogueFadeTween = scene.tweens.add({
                    targets: music,
                    volume: target,
                    duration: fadeMs,
                    ease: 'Linear',
                    onComplete: () => { music._rogueFadeTween = null; }
                });
            } else {
                music.setVolume?.(target);
            }
        });

        return music;
    }

    // Tween a track down to silence, then stop and free it.
    static fadeOutMusic(scene, music, fadeMs = 600) {
        if (!music) return;

        music._rogueCancelled = true;
        // Kill the fade-in before touching this track. Fades overlap whenever a
        // scene swaps music mid-fade (menu fades in over 900ms but is faded out
        // in 450ms), and the fade-in tween would otherwise keep writing volume
        // to a sound this fade-out has already destroyed — Phaser's volume
        // setter then throws on the null gain node.
        this.cancelFade(music);

        let fallbackTimer = null;
        const hardStop = () => {
            if (fallbackTimer !== null) {
                clearTimeout(fallbackTimer);
                fallbackTimer = null;
            }
            music._rogueFadeTween = null;
            try { music.stop(); } catch (_) {}
            try { music.destroy(); } catch (_) {}
        };

        fallbackTimer = setTimeout(hardStop, Math.max(0, fadeMs) + 120);

        if (scene?.tweens && music.isPlaying) {
            music._rogueFadeTween = scene.tweens.add({
                targets: music,
                volume: 0,
                duration: fadeMs,
                ease: 'Linear',
                onComplete: hardStop
            });
        } else {
            hardStop();
        }
    }
}

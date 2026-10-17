import { normalizeVolumeSettings } from './VolumeSettings.js';
import { isEnemyDeathSoundKey } from '../content/audio/enemyDeathSounds.js';

export class SoundHelper {
    // Named groups of interchangeable SFX variants. playVariant() picks one at
    // random so frequently repeated sounds do not get grating.
    static SFX_VARIANTS = {
        enemy_hit: ['enemy_hit_1', 'enemy_hit_2', 'enemy_hit_3', 'enemy_hit_4'],
        card_place: ['card_place_1', 'card_place_2', 'card_place_3', 'card_place_4'],
        lightning_zap: ['lightning_zap_1', 'lightning_zap_2', 'lightning_zap_3'],
        enemy_death: ['enemy_death_1', 'enemy_death_2'],
        block_hit: ['block_hit_1', 'block_hit_2'],
        block_ready: ['block_ready_1', 'block_ready_2'],
        thorns_retaliate: ['thorns_retaliate_1', 'thorns_retaliate_2'],
        hover_button: ['hover_button_1', 'hover_button_2', 'hover_button_3', 'hover_button_4', 'hover_button_5'],
        dodge_miss: ['dodge_miss_1', 'dodge_miss_2', 'dodge_miss_3'],
        // A quill tap on the parchment map (ElevenLabs events map_select 1, 2).
        map_select: ['map_select_1', 'map_select_2'],
        // A card whooshing down the discard chute (ElevenLabs events chute_whoosh 4, 6).
        item_discard: ['item_discard_1', 'item_discard_2'],
        fog_poof: ['fog_poof_1', 'fog_poof_2'],
        // Any door, hovered or landing on the path screen: the four knuckle
        // taps on wood (ElevenLabs events door_tap 3, 1, 2, 4) and the two
        // soft creaks it used before (events door_hover 2, 3).
        door_hover: ['door_hover_1', 'door_hover_2', 'door_hover_3', 'door_hover_4', 'door_hover_5', 'door_hover_6'],
        chest_hover: ['chest_hover_1'],
        poison_tick: ['poison_tick_1', 'poison_tick_2'],
        nest_screech: ['nest_screech_1', 'nest_screech_2'],
        mbox_tick: ['mbox_tick_1', 'mbox_tick_2'],
        nest_rummage: ['nest_rummage_1', 'nest_rummage_2'],
        armor_break: ['armor_break_1', 'armor_break_2', 'armor_break_3'],
        // One click for every button in the game, in three pitches.
        button_click: ['ui_click', 'ui_click_hi', 'ui_click_lo'],
        // Two takes for a card answering the pointer, picked at random per
        // hover. Sweeping across a board fires this far more often than any
        // other UI sound, and one sample repeating that fast reads as a stutter.
        ui_card_hover: ['ui_card_hover_1', 'ui_card_hover_2'],
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

    // Has the player touched the page yet? Until they have, the browser refuses
    // to start audio at all, and every resume() we attempt is both futile and
    // logged as "The AudioContext was not allowed to start".
    //
    // hasBeenActive, not isActive: the autoplay policy unlocks on the FIRST
    // interaction and stays unlocked (sticky activation), so once the player has
    // clicked anything we may resume freely — including from a timer or a scene
    // change, where the transient isActive would already have expired. Browsers
    // that don't expose the flag (Safari) fall through to trying, as before.
    static pageIsSilentUntilGesture() {
        const activation = typeof navigator !== 'undefined' ? navigator.userActivation : null;
        if (!activation || typeof activation.hasBeenActive !== 'boolean') return false;
        return !activation.hasBeenActive;
    }

    static resumeAudio(scene) {
        try { scene?.sound?.unlock?.(); } catch (_) {}

        // Nothing to resume into yet. The unlock listeners are already waiting
        // on the first click or keypress and will come back here then.
        if (this.pageIsSilentUntilGesture()) return Promise.resolve();

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
    // Last take played per variant group, so a group never repeats itself.
    static _lastVariant = new Map();
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
        if (variants) return this.playVariant(scene, soundKey, baseVolume);

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
                // Every enemy death sound (death_*, see enemyDeathSounds) keeps
                // its full tail, like the shared pair above.
                protected: this.SFX_PROTECTED.has(soundKey) || isEnemyDeathSoundKey(soundKey)
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

    // A random take from a group, never the same take twice in a row. Two
    // plays of a group in the same instant (a sweep hitting two enemies) get
    // two different takes and both sound; only an identical take repeated
    // within DEDUPE_MS is swallowed, by playSound.
    static playVariant(scene, group, baseVolume = 1.0) {
        const keys = this.SFX_VARIANTS[group];
        if (!keys || !keys.length) return;

        const previous = this._lastVariant.get(group);
        const choices = keys.length > 1 ? keys.filter((k) => k !== previous) : keys;
        const key = choices[Math.floor(Math.random() * choices.length)];
        this._lastVariant.set(group, key);
        this.playSound(scene, key, baseVolume);
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
        const hardStop = (fromTimer = false) => {
            if (fallbackTimer !== null) {
                clearTimeout(fallbackTimer);
                fallbackTimer = null;
            }
            // From the timer, the fade may still be alive: a scene that sleeps
            // right after starting it (a fight handing over to the map) pauses
            // its tweens, so the fade freezes mid-way while this timer, which
            // is not a tween, still fires. Left alone, the frozen fade resumes
            // when the scene wakes and writes volume to the sound destroyed
            // below, and Phaser's volume setter throws on the null gain node.
            // So it is killed first. From the fade's own onComplete it has
            // already finished, and is left for the tween manager to retire.
            if (fromTimer) {
                this.cancelFade(music);
                try { scene?.tweens?.killTweensOf?.(music); } catch (_) {}
            }
            music._rogueFadeTween = null;
            try { music.stop(); } catch (_) {}
            try { music.destroy(); } catch (_) {}
        };

        fallbackTimer = setTimeout(() => hardStop(true), Math.max(0, fadeMs) + 120);

        if (scene?.tweens && music.isPlaying) {
            music._rogueFadeTween = scene.tweens.add({
                targets: music,
                volume: 0,
                duration: fadeMs,
                ease: 'Linear',
                onComplete: () => hardStop(false)
            });
        } else {
            hardStop(false);
        }
    }
}

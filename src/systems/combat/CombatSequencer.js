import { SoundHelper } from '../../audio/SoundHelper.js';

// Spreads combat FEEDBACK across a short timeline so a single exchange reads as
// a sequence of events instead of one frame where four sounds and three
// floating texts land together and mask each other.
//
// This schedules presentation only — sound, floating text, shakes, hit FX.
// Combat STATE stays resolved synchronously by the caller, because the order in
// which damage/gems/durability apply carries real rules (see attackEnemy). We
// are re-timing how the fight is narrated, not when it is decided.
export class CombatSequencer {
    // Offsets in ms from the start of a moment. Tuned tight: a full exchange
    // (swing → hit → number → zap → thorns → break → death) resolves in under
    // half a second, so combat still feels fast while each event gets its own
    // slice of silence to be heard in.
    static BEATS = {
        attack: 0,           // the swing/cast leaves the player's hand
        enemy_attack: 0,     // an enemy lunges
        hit: 0,              // it connects: impact sound, slash, shake
        hurt: 0,             // the player takes it
        damage: 45,          // the number comes off the target
        gem: 95,             // a socketed gem discharges
        reflect: 145,        // thorns and armor bite back at the attacker
        reflect_damage: 175, // the number that reflection knocks off
        break: 205,          // armor or a weapon gives out
        death: 245           // the target drops
    };

    // Two SOUNDS never land closer than this. Only audio needs the protection —
    // it's the one channel where simultaneous events mask each other. A beat's
    // sound, floating text, and shake are one event and should land together.
    static MIN_GAP = 35;
    static DEFAULT_BEAT = 'hit';

    static _moment = null;

    // A "moment" is one synchronous burst of resolution — a single swing, or a
    // single enemy's attack plus everything it cascades into (thorns, armor
    // break, a kill). Everything that resolves in the same frame belongs to the
    // same moment and is laid out on one shared timeline. Phaser's time.now is
    // fixed for the duration of a frame, which makes it an exact identity for
    // "this all happened at once" — the very thing we're pulling apart.
    static _momentFor(scene) {
        const frame = scene.time.now;
        if (this._moment?.frame !== frame) {
            this._moment = { frame, sounds: new Set() };
        }
        return this._moment;
    }

    // Claim a free instant at or after `offset` for a SOUND. Two sounds landing
    // on one beat (a dual-wield's two hits, thorns firing twice) walk forward
    // to the next free slot instead of phasing into each other.
    static _claimSound(scene, offset) {
        if (typeof scene?.time?.now !== 'number') return offset;
        const moment = this._momentFor(scene);
        let at = offset;
        while (moment.sounds.has(at)) at += this.MIN_GAP;
        moment.sounds.add(at);
        return at;
    }

    static _offsetOf(beat) {
        return this.BEATS[beat] ?? this.BEATS[this.DEFAULT_BEAT];
    }

    static schedule(scene, beat, fn) {
        return this._at(scene, this._offsetOf(beat), fn);
    }

    static _at(scene, delay, fn) {
        // A missing clock means there's nothing to lay a timeline against — the
        // headless balance sim resolves combat in one synchronous call and has
        // no frames. Pacing is meaningless there, so run the beat now.
        if (delay <= 0 || typeof scene?.time?.now !== 'number') {
            try { fn(); } catch (err) { console.warn('Combat beat failed:', err); }
            return null;
        }

        const pending = this._pending(scene);
        const entry = { at: scene.time.now + delay, timer: null };
        entry.timer = scene.time.delayedCall(delay, () => {
            const i = pending.indexOf(entry);
            if (i !== -1) pending.splice(i, 1);
            // A scene that stopped mid-timeline (a lethal hit triggers
            // gameOver) belongs to a fight that is over, so drop the beat
            // rather than narrate into the next scene.
            if (!scene.scene?.isActive?.()) return;
            try { fn(); } catch (err) { console.warn('Combat beat failed:', err); }
        });
        pending.push(entry);
        return entry.timer;
    }

    // Beats this scene still has to play. Kept here rather than in the turn
    // controller's timer list: clearing the room cancels that list on the
    // killing blow, and the killing blow's own narration must still play.
    static _pending(scene) {
        if (!scene._combatBeats) scene._combatBeats = [];
        return scene._combatBeats;
    }

    /** Run `fn` after `delay` ms on the narration timeline, tracked like a beat. */
    static after(scene, delay, fn) {
        return this._at(scene, delay, fn);
    }

    /** Ms until the last beat already scheduled has played; 0 when none are left. */
    static remainingMs(scene) {
        const pending = scene?._combatBeats;
        if (!pending?.length || typeof scene.time?.now !== 'number') return 0;
        const last = Math.max(...pending.map((entry) => entry.at));
        return Math.max(0, last - scene.time.now);
    }

    /** Drop every beat still waiting, for leaving the room or the run. */
    static cancelAll(scene) {
        const pending = scene?._combatBeats;
        if (!pending) return;
        pending.forEach((entry) => entry.timer?.remove?.(false));
        pending.length = 0;
    }

    static playVariant(scene, beat, group, volume = 1.0) {
        const at = this._claimSound(scene, this._offsetOf(beat));
        this._at(scene, at, () => SoundHelper.playVariant(scene, group, volume));
    }

    static playSound(scene, beat, key, volume = 1.0) {
        const at = this._claimSound(scene, this._offsetOf(beat));
        this._at(scene, at, () => SoundHelper.playSound(scene, key, volume));
    }

    // Coordinates are captured now, not read at fire time — the sprite they came
    // from is often destroyed by the time a later beat runs.
    static floatingText(scene, beat, x, y, text, color, size, options) {
        // Log now, draw later. createFloatingText writes its own log line when
        // it runs, which for a delayed beat is up to 245ms after the event
        // resolved — long enough for a synchronous "All enemies defeated!" to
        // be written first and leave the killing blow recorded beneath it.
        const opts = { ...(options || {}) };
        if (!opts.skipLog) {
            scene.logCombatEvent?.(text, x, y);
            opts.skipLog = true;
        }
        // Capture the target before a lethal hit swaps its card for loot.
        // The feedback manager owns visual spacing and transition cleanup.
        scene.createFloatingText?.(x, y, text, color, size, { ...opts, delayMs: this._offsetOf(beat) });
    }

    static shakeCard(scene, beat, sprite) {
        this.schedule(scene, beat, () => {
            if (sprite?.scene) scene.shakeCard?.(sprite);
        });
    }
}

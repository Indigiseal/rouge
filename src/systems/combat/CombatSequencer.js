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

        const timer = scene.time.delayedCall(delay, () => {
            // The room can end mid-timeline (a kill clears the board, a lethal
            // hit triggers gameOver). Pending beats belong to a fight that is
            // over, so drop them rather than narrate into the next scene.
            if (!scene.scene?.isActive?.()) return;
            try { fn(); } catch (err) { console.warn('Combat beat failed:', err); }
        });
        // Ride the existing teardown: clearEnemyTurnTimers() already cancels
        // these on room transition, death, and shutdown.
        scene.enemyTurnTimers?.push(timer);
        return timer;
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
        this.schedule(scene, beat, () => scene.createFloatingText?.(x, y, text, color, size, options));
    }

    static shakeCard(scene, beat, sprite) {
        this.schedule(scene, beat, () => {
            if (sprite?.scene) scene.shakeCard?.(sprite);
        });
    }
}

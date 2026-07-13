// TutorialManager — drives the guided, hard-locked tutorial floor.
//
// It owns a TutorialOverlay and an ordered list of steps. Each step exposes:
//   target(): the GameObject the player must touch (also the un-dimmed hole),
//   done():   predicate polled every frame; true → advance,
//   text:     the instruction copy,
//   enter():  optional one-shot setup when the step begins.
//
// Completion is detected by polling live game state (a card revealed, an item
// in the bag, an enemy removed) plus one event — 'frontlineBlocked' — for the
// transient "your swing was blocked" moment. Interactions themselves run
// through the real game code untouched; the overlay just gates which object is
// reachable and points at it.
import { TutorialOverlay } from './utils/TutorialOverlay.js';

export class TutorialManager {
    constructor(scene) {
        this.scene = scene;
        this.overlay = new TutorialOverlay(scene);
        this.overlay.onSkip(() => this.end());
        this.stepIndex = 0;
        this.active = false;
        this._blocked = false;        // frontlineBlocked one-shot flag
        this._enteredStep = -1;       // guards enter() to fire once per step
        this._lastTarget = null;      // last object handed to overlay.show
        this._lastHintTarget = null;
        this._lastInteractiveTarget = null;
        this._lastRenderedStep = -1;
        this._lastBoundsList = null;  // last rendered target/hint bounds
        this._pendingAdvanceKey = null;
        this._pendingAdvanceTimer = null;
        this._actionPointArea = null;
        this._tickInterval = null;

        this._onBlocked = () => { this._blocked = true; };
        this._onProgress = (key) => this._handleProgress(key);

        this.steps = this._buildSteps();
    }

    // ---- accessors into live game state --------------------------------
    get cs() { return this.scene.cardSystem; }
    get inv() { return this.scene.inventorySystem; }

    boardCard(tag) { return this.cs?.findTutorialCard?.(tag) || null; }
    boardSprite(tag) { return this.boardCard(tag)?.card?.sprite || null; }
    boardRevealed(tag) { return !!this.boardCard(tag)?.card?.revealed; }

    invSlot(tag) {
        const slots = this.inv?.slots || [];
        return slots.findIndex(s => s && s.tutorialTag === tag);
    }
    invSprite(tag) {
        const i = this.invSlot(tag);
        return i >= 0 ? (this.inv.slotSprites[i]?.card || null) : null;
    }
    actionPointArea() {
        const sprites = (this.scene.actionPointSprites || []).filter(sprite => sprite?.active);
        if (!sprites.length) return null;

        const bounds = sprites.map(sprite => sprite.getBounds());
        const left = Math.min(...bounds.map(b => b.x));
        const top = Math.min(...bounds.map(b => b.y));
        const right = Math.max(...bounds.map(b => b.x + b.width));
        const bottom = Math.max(...bounds.map(b => b.y + b.height));

        if (!this._actionPointArea) this._actionPointArea = { x: 0, y: 0, width: 0, height: 0 };
        this._actionPointArea.x = left;
        this._actionPointArea.y = top;
        this._actionPointArea.width = right - left;
        this._actionPointArea.height = bottom - top;
        return this._actionPointArea;
    }
    hasUncommonSword() {
        return (this.inv?.slots || []).some(s => s && s.weaponType === 'sword' && s.rarity === 'uncommon');
    }
    // ---- lifecycle ------------------------------------------------------
    start() {
        this.active = true;
        this.stepIndex = 0;
        this.scene.events.on('frontlineBlocked', this._onBlocked);
        this.scene.events.on('tutorialProgress', this._onProgress);
        this._tickInterval = setInterval(() => this.tick(), 100);
        this._enterStep();
    }

    end() {
        if (!this.active) return;
        this.destroy();
        this.scene.clearEnemyTurnTimers?.();
        this.scene.scene.start('MainMenuScene');
    }

    destroy() {
        if (!this.active && !this.overlay) return;
        this.active = false;
        this.scene.events.off('frontlineBlocked', this._onBlocked);
        this.scene.events.off('tutorialProgress', this._onProgress);
        if (this._tickInterval) {
            clearInterval(this._tickInterval);
            this._tickInterval = null;
        }
        if (this._pendingAdvanceTimer) {
            clearTimeout(this._pendingAdvanceTimer);
            this._pendingAdvanceTimer = null;
        }
        this._pendingAdvanceKey = null;
        this.overlay?.destroy();
        this.overlay = null;
    }

    _enterStep() {
        const step = this.steps[this.stepIndex];
        if (!step) { this.end(); return; }
        this._blocked = false;
        this._lastTarget = null;
        this._lastHintTarget = null;
        this._lastInteractiveTarget = null;
        this._lastRenderedStep = -1;
        this._lastBoundsList = null;
        if (this._enteredStep !== this.stepIndex) {
            this._enteredStep = this.stepIndex;
            step.enter?.();
        }
        this.overlay.setSkipLabel?.(this.stepIndex === this.steps.length - 1 ? 'Finish' : 'Skip');
        this._refresh(step);
    }

    _advance() {
        this._pendingAdvanceKey = null;
        this.stepIndex++;
        if (this.stepIndex >= this.steps.length) { this.end(); return; }
        this._enterStep();
    }

    _handleProgress(key) {
        if (!this.active) return;
        const step = this.steps[this.stepIndex];
        if (this._matchesProgress(step, key)) {
            this._queueAdvance(key);
            return;
        }
        this.tick();
    }

    _matchesProgress(step, key) {
        if (!step?.eventKey || !key) return false;
        const keys = Array.isArray(step.eventKey) ? step.eventKey : [step.eventKey];
        return keys.includes(key);
    }

    _queueAdvance(key) {
        if (this._pendingAdvanceKey === key) return;
        if (this._pendingAdvanceTimer) clearTimeout(this._pendingAdvanceTimer);
        this._pendingAdvanceKey = key;
        this._pendingAdvanceTimer = setTimeout(() => {
            this._pendingAdvanceTimer = null;
            const pendingKey = this._pendingAdvanceKey;
            if (!this.active || pendingKey !== key) return;
            const step = this.steps[this.stepIndex];
            if (this._matchesProgress(step, pendingKey) || step?.done?.()) {
                this._advance();
            }
        }, 0);
    }

    // A snapshot of every highlighted object's screen bounds. Same object
    // identity is NOT enough to skip a re-render: a card that is tweening
    // home after a drop (e.g. the sword returning to the bag after a kill) keeps
    // its identity while its position changes every frame. Without folding
    // position into the cache key the pointer/hole freeze wherever the object
    // sat on the first render — e.g. stuck on the enemy we just dropped onto.
    _targetBoundsList(...objs) {
        return objs.map(o => this.overlay?._bounds?.(o) || null);
    }

    // Bounds comparison with a small tolerance. getBounds() on a stationary
    // sprite can return sub-pixel-noisy values frame to frame (Phaser transform
    // math), and Math.round() flapping between two adjacent pixels used to
    // retrigger a full re-show — restarting the pointer's bob tween every tick
    // and making the coach-mark arrow visibly jitter. A tolerance absorbs that
    // noise while still catching real movement.
    _boundsListChanged(prev, next, tolerance = 1.5) {
        if (prev.length !== next.length) return true;
        for (let i = 0; i < next.length; i++) {
            const a = prev[i];
            const b = next[i];
            if (!a || !b) { if (a !== b) return true; continue; }
            if (Math.abs(a.x - b.x) >= tolerance
                || Math.abs(a.y - b.y) >= tolerance
                || Math.abs(a.width - b.width) >= tolerance
                || Math.abs(a.height - b.height) >= tolerance) return true;
        }
        return false;
    }

    // Re-point the overlay if the target object changed (sprites are destroyed
    // and rebuilt as cards flip, get collected, and return to slots) or moved.
    _refresh(step) {
        const target = step.target ? step.target() : null;
        const hintTarget = step.hintTarget ? step.hintTarget() : null;
        const interactiveTarget = step.interactiveTarget ? step.interactiveTarget() : target;
        const boundsList = this._targetBoundsList(target, hintTarget, interactiveTarget);
        const alreadyRendered = (
            this._lastRenderedStep === this.stepIndex
            && target === this._lastTarget
            && hintTarget === this._lastHintTarget
            && interactiveTarget === this._lastInteractiveTarget
            && !this._boundsListChanged(this._lastBoundsList || [], boundsList)
        );
        const interactiveIsUnderBlocker = (
            interactiveTarget
            && typeof interactiveTarget.depth === 'number'
            && interactiveTarget.depth <= this.overlay.DIM_DEPTH
        );
        if (alreadyRendered && (target || step.noHole)) {
            if (interactiveIsUnderBlocker) {
                this.overlay.refreshInteractive?.(interactiveTarget);
            }
            return;
        }
        this._lastTarget = target;
        this._lastHintTarget = hintTarget;
        this._lastInteractiveTarget = interactiveTarget;
        this._lastRenderedStep = this.stepIndex;
        this._lastBoundsList = boundsList;
        if (!target && !step.noHole) {
            // Target not ready yet (e.g. inventory sprite still rebuilding) —
            // dim fully and wait; the bubble still guides.
            this.overlay.show({ target: null, interactive: null, text: step.text, noHole: true });
            return;
        }
        const holeTargets = hintTarget ? [target, hintTarget].filter(Boolean) : null;
        this.overlay.show({
            target,
            interactive: interactiveTarget,
            text: step.text,
            noHole: step.noHole || false,
            pointerOffset: step.pointerOffset,
            hintTarget,
            holeTargets
        });
    }

    tick() {
        if (!this.active) return;
        const step = this.steps[this.stepIndex];
        if (!step) return;
        // Keep the coach mark glued to the (possibly rebuilt) target.
        this._refresh(step);
        if (!this._pendingAdvanceKey && step.done && step.done()) this._advance();
    }

    // ---- the script -----------------------------------------------------
    _buildSteps() {
        const avatar = () => this.scene.playerAvatar;
        return [
            // 1 — flip the sword
            {
                text: 'Tap a card to flip it.',
                target: () => this.boardSprite('sword1'),
                eventKey: 'revealed:sword1',
                done: () => this.boardRevealed('sword1'),
            },
            // 2 — collect the sword (tap = an action = wakes the skeleton)
            {
                text: 'Tap the sword to stash it in your inventory.',
                target: () => this.boardSprite('sword1'),
                eventKey: 'inventory:sword1',
                done: () => this.invSlot('sword1') >= 0,
            },
            // 3 — attack the skeleton (drag from bag onto the enemy)
            {
                text: 'Drag your sword onto the skeleton to strike it.',
                target: () => this.invSprite('sword1'),
                hintTarget: () => this.boardSprite('skeleton'),
                eventKey: 'removed:skeleton',
                done: () => !this.boardCard('skeleton'),
            },
            // 4 — flip the food
            {
                text: 'Flip another card.',
                target: () => this.boardSprite('food'),
                eventKey: 'revealed:food',
                done: () => this.boardRevealed('food'),
            },
            // 5 — explain hunger/AP, then eat the food
            {
                text: "These diamonds are Action Points. At 0 AP, you are hungry: weapon damage is reduced by 20%. Tap food to refill AP.",
                target: () => this.actionPointArea(),
                hintTarget: () => this.boardSprite('food'),
                interactiveTarget: () => this.boardSprite('food'),
                eventKey: 'removed:food',
                done: () => !this.boardCard('food'),
            },
            // 6 — attack the archer; it's blocked by the hidden guard
            {
                text: 'An archer slips in behind. Attack it with your sword.',
                enter: () => {
                    const a = this.boardCard('archer');
                    if (a && !a.card.revealed) this.cs.revealCard(a.index, true);
                },
                target: () => this.invSprite('sword1'),
                hintTarget: () => this.boardSprite('archer'),
                eventKey: 'blocked',
                done: () => this._blocked,
            },
            // 7 — reveal the hidden melee guard
            {
                text: 'Nothing landed — a hidden enemy guards the back row. Flip cards to find it.',
                target: () => this.boardSprite('guard'),
                eventKey: 'revealed:guard',
                done: () => this.boardRevealed('guard'),
            },
            // 8 — kill the guard first
            {
                text: "There it is. Kill the front melee before you can reach past it.",
                target: () => this.invSprite('sword1'),
                hintTarget: () => this.boardSprite('guard'),
                eventKey: 'removed:guard',
                done: () => !this.boardCard('guard'),
            },
            // 9 — now the archer is reachable
            {
                text: 'Front cleared — now your sword reaches the archer. Finish it.',
                target: () => this.invSprite('sword1'),
                hintTarget: () => this.boardSprite('archer'),
                eventKey: 'removed:archer',
                done: () => !this.boardCard('archer'),
            },
            // 10 — flip the second sword
            {
                text: 'Another sword — flip it.',
                target: () => this.boardSprite('sword2'),
                eventKey: 'revealed:sword2',
                done: () => this.boardRevealed('sword2'),
            },
            // 11 — collect the second sword
            {
                text: 'Tap to add it to your bag.',
                target: () => this.boardSprite('sword2'),
                eventKey: 'inventory:sword2',
                done: () => this.invSlot('sword2') >= 0,
            },
            // 12 — merge the two swords
            {
                text: 'Drag one sword onto the other to merge them. Merging refills every pip; each hit spends one, and at zero pips a weapon breaks.',
                target: () => this.invSprite('sword2'),
                hintTarget: () => this.invSprite('sword1'),
                eventKey: 'merged:sword',
                done: () => this.hasUncommonSword(),
            },
            // 13 — flip the potion
            {
                text: 'One more card — a healing potion.',
                target: () => this.boardSprite('potion'),
                eventKey: 'revealed:potion',
                done: () => this.boardRevealed('potion'),
            },
            // 14 — collect the potion
            {
                text: 'Tap to pick up the potion.',
                target: () => this.boardSprite('potion'),
                eventKey: 'inventory:potion',
                done: () => this.invSlot('potion') >= 0,
            },
            // 15 — drink it on the portrait
            {
                text: 'Drag the potion onto your portrait to drink it.',
                target: () => this.invSprite('potion'),
                hintTarget: () => avatar(),
                eventKey: 'inventoryRemoved:potion',
                done: () => this.invSlot('potion') < 0,
            },
            {
                text: 'Coins buy cards in shops. Flip the coin card.',
                target: () => this.boardSprite('coin'),
                eventKey: 'revealed:coin',
                done: () => this.boardRevealed('coin'),
            },
            {
                text: 'Tap coins to collect them.',
                target: () => this.boardSprite('coin'),
                eventKey: 'removed:coin',
                done: () => !this.boardCard('coin'),
            },
            // 16 — done
            {
                text: "That's the whole loop: flip, fight, collect, and grow stronger. Press Finish when you're ready.",
                target: () => avatar(),
                noHole: true,
                done: () => false, // ends only via the Finish (skip) button
            },
        ];
    }
}

// TutorialOverlay — the coach-mark layer used by the guided tutorial.
//
// Input model (the "hard lock"):
//   * A single full-screen transparent BLOCKER rect sits at DIM_DEPTH and
//     swallows every pointer event — so by default nothing in the game reacts.
//   * The ONE element the player is allowed to touch this step is raised above
//     the blocker (setDepth) so its own input fires normally. We restore its
//     depth when the step changes.
//   * Drops (drag a card onto an enemy / the portrait) are detected
//     geometrically by the inventory system, so drop targets do NOT need to be
//     raised — only the object that receives the initial pointer/drag-start.
//
// Visuals:
//   * Four non-interactive dim rectangles frame a "hole" around the target so
//     the highlighted element stays bright.
//   * The 16x16 `tutorialPointer` arrow bobs at the target; a bubble shows copy.
//   * A persistent Skip button lives above the blocker.
export class TutorialOverlay {
    constructor(scene) {
        this.scene = scene;
        // Sit above everything (nextFloorButton is 5000, tooltips lower).
        this.DIM_DEPTH = 9000;      // blocker + visual dim
        this.RAISE_DEPTH = 9050;    // exposed target rides here
        this.ART_DEPTH = 9100;      // pointer / bubble / skip
        this.dimAlpha = 0.6;
        // Single padding for both the bright cut-out hole and the hint frame so
        // highlighted targets are the same size whether or not they get a frame.
        this.HOLE_PAD = 4;

        this.blocker = null;
        this.dimRects = [];
        this.pointer = null;
        // The arrow's bob runs on ONE persistent tween that animates a scalar
        // (_bobState.v, 0→4→0). Every frame we position the pointer at the live
        // target's center plus that bob offset. Re-pointing at a new/moved
        // target only updates the stored target — it never restarts the tween —
        // so a target that shifts (e.g. an inventory card lifting on hover) is
        // followed smoothly instead of snapping the pointer and stuttering.
        this._bobTween = null;
        this._bobState = null;
        this._pointerTarget = null;
        this._pointerOffset = { x: 0, y: 0 };
        this.pointerBaseX = null;
        this.pointerBaseY = null;
        this.bubbleBg = null;
        this.bubbleBorder = null;
        this.bubbleText = null;
        this.bubbleValue = null;
        this.hintBox = null;
        this.skipBg = null;
        this.skipText = null;
        this._onSkip = null;

        this._raised = null;        // [{ obj, depth }] currently lifted target + attached visuals

        this._buildBlocker();
        this._buildDim();
        this._buildSkip();

        // The inventory's own dragstart drops the dragged card to depth ~1002,
        // which would slide it *under* our dim frame and make it disappear
        // mid-drag. Globally float any dragged object above the dim so the
        // player can always see the card they're moving.
        this._onDragRaise = (pointer, obj) => {
            if (!obj?.setDepth) return;
            [
                obj,
                obj.getData?.('infoText'),
                obj.getData?.('gemIndicator'),
                obj.getData?.('briarFrame'),
            ].forEach((item, index) => item?.setDepth?.(this.RAISE_DEPTH + 5 + index));
        };
        this.scene.input.on('dragstart', this._onDragRaise);
        this.scene.input.on('drag', this._onDragRaise);

        // Glue the pointer to its live target every frame (see _bobTween note).
        this._onUpdate = () => this._applyPointerPosition();
        this.scene.events.on('update', this._onUpdate);
    }

    // ---- construction ---------------------------------------------------
    _buildBlocker() {
        const W = this.scene.scale.width, H = this.scene.scale.height;
        this.blocker = this.scene.add.rectangle(0, 0, W, H, 0x000000, 0)
            .setOrigin(0, 0)
            .setDepth(this.DIM_DEPTH)
            .setInteractive();
        // Eat every pointer event that reaches the blocker.
        this.blocker.on('pointerdown', (p, x, y, event) => event?.stopPropagation?.());
    }

    _buildDim() {
        // Purely visual frame (non-interactive) — the blocker handles input.
        for (let i = 0; i < 4; i++) {
            const r = this.scene.add.rectangle(0, 0, 1, 1, 0x000000, this.dimAlpha)
                .setOrigin(0, 0)
                .setDepth(this.DIM_DEPTH - 1);
            this.dimRects.push(r);
        }
    }

    _buildSkip() {
        const W = this.scene.scale.width;
        this.skipBg = this.scene.add.rectangle(W - 6, 6, 54, 16, 0x1a1a1a, 0.85)
            .setOrigin(1, 0)
            .setDepth(this.ART_DEPTH)
            .setStrokeStyle(1, 0x888888)
            .setInteractive({ useHandCursor: true });
        this.skipText = this.scene.add.text(W - 33, 14, 'Skip', {
            fontSize: '9px', fill: '#dddddd', fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5).setDepth(this.ART_DEPTH + 1);
        this.skipBg.on('pointerdown', (p, x, y, event) => {
            event?.stopPropagation?.();
            if (this._onSkip) this._onSkip();
        });
    }

    onSkip(cb) { this._onSkip = cb; }

    setSkipLabel(text) { this.skipText?.setText(text); }

    // ---- helpers --------------------------------------------------------
    // Normalize a target (Phaser GameObject with getBounds, or a plain
    // {x,y,width,height} top-left rect) into a bounds object.
    _bounds(target) {
        if (!target) return null;
        if (typeof target.getBounds === 'function') {
            const b = target.getBounds();
            return { x: b.x, y: b.y, width: b.width, height: b.height,
                     cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
        }
        return { x: target.x, y: target.y, width: target.width, height: target.height,
                 cx: target.x + target.width / 2, cy: target.y + target.height / 2 };
    }

    _normalizeHole(hole, pad = this.HOLE_PAD) {
        if (!hole) return null;
        const W = this.scene.scale.width;
        const H = this.scene.scale.height;
        const x = Math.max(0, hole.x - pad);
        const y = Math.max(0, hole.y - pad);
        const right = Math.min(W, hole.x + hole.width + pad);
        const bottom = Math.min(H, hole.y + hole.height + pad);
        return {
            x,
            y,
            width: Math.max(0, right - x),
            height: Math.max(0, bottom - y)
        };
    }

    _ensureDimRect(index) {
        if (!this.dimRects[index]) {
            this.dimRects[index] = this.scene.add.rectangle(0, 0, 1, 1, 0x000000, this.dimAlpha)
                .setOrigin(0, 0)
                .setDepth(this.DIM_DEPTH - 1);
        }
        return this.dimRects[index];
    }

    _clearStepVisuals() {
        this.dimRects.forEach(rect => rect.setVisible(false));
        this.hintBox?.setVisible(false);
    }

    // Build the shadow as a grid around one or more separate bright holes.
    // This avoids making one large lit rectangle between drag source and target.
    _setHoles(holes = []) {
        const W = this.scene.scale.width;
        const H = this.scene.scale.height;
        const normalized = holes
            .map(hole => this._normalizeHole(hole))
            .filter(hole => hole && hole.width > 0 && hole.height > 0);

        const xs = [0, W];
        const ys = [0, H];
        normalized.forEach(hole => {
            xs.push(hole.x, hole.x + hole.width);
            ys.push(hole.y, hole.y + hole.height);
        });
        xs.sort((a, b) => a - b);
        ys.sort((a, b) => a - b);

        const uniqueXs = xs.filter((x, i) => i === 0 || x !== xs[i - 1]);
        const uniqueYs = ys.filter((y, i) => i === 0 || y !== ys[i - 1]);
        let rectIndex = 0;

        for (let yi = 0; yi < uniqueYs.length - 1; yi++) {
            for (let xi = 0; xi < uniqueXs.length - 1; xi++) {
                const x = uniqueXs[xi];
                const y = uniqueYs[yi];
                const width = uniqueXs[xi + 1] - x;
                const height = uniqueYs[yi + 1] - y;
                if (width <= 0 || height <= 0) continue;

                const cx = x + width / 2;
                const cy = y + height / 2;
                const insideHole = normalized.some(hole => (
                    cx >= hole.x
                    && cx <= hole.x + hole.width
                    && cy >= hole.y
                    && cy <= hole.y + hole.height
                ));
                if (insideHole) continue;

                this._ensureDimRect(rectIndex++)
                    .setPosition(x, y)
                    .setSize(width, height)
                    .setVisible(true);
            }
        }

        for (let i = rectIndex; i < this.dimRects.length; i++) {
            this.dimRects[i].setVisible(false);
        }
    }

    // Lift the interactive target above the blocker so its own input fires.
    _raise(obj) {
        this._restore();
        if (!obj || typeof obj.setDepth !== 'function') return;

        const attached = [
            obj,
            obj.getData?.('infoText'),
            obj.getData?.('gemIndicator'),
            obj.getData?.('briarFrame'),
        ].filter((item, index, arr) => (
            item
            && typeof item.setDepth === 'function'
            && arr.indexOf(item) === index
        ));

        this._raised = attached.map((item, index) => {
            const depth = item.depth;
            item.setDepth(this.RAISE_DEPTH + index);
            return { obj: item, depth };
        });
    }

    _restore() {
        if (this._raised) {
            this._raised.forEach(({ obj, depth }) => {
                if (obj && obj.active && typeof obj.setDepth === 'function') obj.setDepth(depth);
            });
            this._raised = null;
        }
    }

    // ---- public API -----------------------------------------------------
    // Show a coach mark.
    //   target       : object to point at.
    //   interactive  : the GameObject that should receive input this step
    //                  (raised above the blocker). Defaults to target.
    //   text         : instruction copy (optional).
    //   pointerOffset: nudge the arrow tip {x,y} from the target center.
    //   noHole       : true → dim the whole screen (waiting on an auto event).
    show({ target, interactive, text, pointerOffset, hintTarget, holeTargets, noHole } = {}) {
        const raiseObj = interactive !== undefined ? interactive : target;
        this._raise(raiseObj || null);
        this._clearStepVisuals();

        const holeBounds = noHole
            ? []
            : (holeTargets?.length ? holeTargets : [target]).map(item => this._bounds(item));
        this._setHoles(holeBounds);

        const tb = this._bounds(target);
        this._showPointer(noHole ? null : target, pointerOffset);
        this._showHintBox(noHole ? null : this._bounds(hintTarget));
        this._showBubble(text, tb);
    }

    refreshInteractive(interactive) {
        this._raise(interactive || null);
    }

    _showPointer(target, offset = { x: 0, y: 0 }) {
        if (!target) {
            this._pointerTarget = null;
            this.pointerBaseX = null;
            this.pointerBaseY = null;
            if (this.pointer) this.pointer.setVisible(false);
            return;
        }
        this._pointerTarget = target;
        this._pointerOffset = offset || { x: 0, y: 0 };
        this._updatePointerBase();
        if (!this.pointer) {
            this.pointer = this.scene.add.image(this.pointerBaseX, this.pointerBaseY, 'tutorialPointer')
                .setOrigin(0, 0)          // arrow tip is the top-left corner
                .setDepth(this.ART_DEPTH + 2);
        } else {
            this.pointer.setTexture('tutorialPointer').setVisible(true);
        }
        this._ensureBobTween();
    }

    // Recompute the arrow's anchor from the target's *current* bounds so a
    // moving target (hover-lifted inventory card, a card tweening home) is
    // tracked live rather than frozen at first-render position.
    _updatePointerBase() {
        if (!this._pointerTarget) return;
        if (this._pointerTarget.active === false) return; // destroyed sprite mid-transition
        const b = this._bounds(this._pointerTarget);
        if (!b) return;
        this.pointerBaseX = b.cx + (this._pointerOffset?.x || 0);
        this.pointerBaseY = b.cy + (this._pointerOffset?.y || 0);
    }

    _ensureBobTween() {
        if (this._bobTween) return;
        this._bobState = { v: 0 };
        this._bobTween = this.scene.tweens.add({
            targets: this._bobState,
            v: 4,
            duration: 520, yoyo: true, repeat: -1, ease: 'Sine.inOut'
        });
    }

    // Per-frame: keep the pointer at (live target center + bob offset).
    _applyPointerPosition() {
        if (!this.pointer || !this.pointer.visible || !this._pointerTarget) return;
        this._updatePointerBase();
        if (this.pointerBaseX === null || this.pointerBaseX === undefined) return;
        const bob = this._bobState ? this._bobState.v : 0;
        this.pointer.setPosition(this.pointerBaseX + bob, this.pointerBaseY + bob);
    }

    _showHintBox(tb) {
        if (!tb) {
            this.hintBox?.setVisible(false);
            return;
        }
        const pad = this.HOLE_PAD;
        if (!this.hintBox) {
            this.hintBox = this.scene.add.rectangle(0, 0, 1, 1)
                .setOrigin(0, 0)
                .setDepth(this.ART_DEPTH + 1)
                .setStrokeStyle(2, 0xe5bca4, 0.95);
        }
        this.hintBox
            .setPosition(tb.x - pad, tb.y - pad)
            .setSize(tb.width + pad * 2, tb.height + pad * 2)
            .setVisible(true);
    }

    _showBubble(text, tb) {
        if (!text) {
            this.bubbleBg?.setVisible(false);
            this.bubbleBorder?.setVisible(false);
            this.bubbleText?.setVisible(false);
            this.bubbleValue = null;
            return;
        }
        const W = this.scene.scale.width;
        const H = this.scene.scale.height;
        const maxW = 180;
        if (this.bubbleText && this.bubbleValue !== text) {
            this.bubbleText.destroy();
            this.bubbleText = null;
        }
        this.bubbleValue = text;
        if (!this.bubbleText) {
            this.bubbleText = this.scene.add.text(0, 0, text, {
                fontSize: '9px', fill: '#ffffff', fontFamily: '"HoMM Pixel"',
                align: 'left', wordWrap: { width: maxW }
            }).setOrigin(0, 0).setDepth(this.ART_DEPTH + 4);
        } else {
            this.bubbleText.setText(text).setVisible(true);
        }
        const padX = 8, padY = 6;
        const bw = this.bubbleText.width + padX * 2;
        const bh = this.bubbleText.height + padY * 2;

        // Prefer below the target; flip above if it would run off the bottom.
        let bx = (tb ? tb.cx : W / 2) - bw / 2;
        let by = tb ? tb.y + tb.height + 12 : H / 2 - bh / 2;
        if (tb && by + bh > H - 4) by = tb.y - bh - 12;
        bx = Math.max(4, Math.min(W - bw - 4, bx));
        by = Math.max(4, Math.min(H - bh - 4, by));

        if (!this.bubbleBg) {
            this.bubbleBg = this.scene.add.rectangle(0, 0, bw, bh, 0x101018, 0.94)
                .setOrigin(0, 0).setDepth(this.ART_DEPTH + 3);
            this.bubbleBorder = this.scene.add.rectangle(0, 0, bw, bh)
                .setOrigin(0, 0).setDepth(this.ART_DEPTH + 3)
                .setStrokeStyle(1, 0xe5bca4);
        }
        this.bubbleBg.setPosition(bx, by).setSize(bw, bh).setVisible(true);
        this.bubbleBorder.setPosition(bx, by).setSize(bw, bh).setVisible(true);
        this.bubbleText.setPosition(bx + padX, by + padY);
    }

    _killPointerTween() {
        if (this._bobTween) { this._bobTween.stop(); this._bobTween = null; }
        this._bobState = null;
    }

    // Hide pointer + bubble and drop the input lock (used between micro-steps).
    hideMarks() {
        this._killPointerTween();
        this._restore();
        this._pointerTarget = null;
        this.pointerBaseX = null;
        this.pointerBaseY = null;
        this.pointer?.setVisible(false);
        this.hintBox?.setVisible(false);
        this.bubbleBg?.setVisible(false);
        this.bubbleBorder?.setVisible(false);
        this.bubbleText?.setVisible(false);
    }

    destroy() {
        this._killPointerTween();
        this._restore();
        this.scene.events.off('update', this._onUpdate);
        this.scene.input.off('dragstart', this._onDragRaise);
        this.scene.input.off('drag', this._onDragRaise);
        this.blocker?.destroy();
        this.dimRects.forEach(r => r.destroy());
        this.dimRects = [];
        this.pointer?.destroy();
        this.hintBox?.destroy();
        this.bubbleBg?.destroy();
        this.bubbleBorder?.destroy();
        this.bubbleText?.destroy();
        this.skipBg?.destroy();
        this.skipText?.destroy();
        this.blocker = this.pointer = this.hintBox = this.bubbleBg = this.bubbleBorder = this.bubbleText = null;
        this.skipBg = this.skipText = null;
    }
}

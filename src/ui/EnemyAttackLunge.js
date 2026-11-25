// An enemy card's attack: a quick lunge forward, down toward the hero and the
// bag, then back to its seat. A crit lunges further (Taya; it replaced a red
// circle flashed over the card, then a hop that read as a jump, not a blow).
// Called by CombatTurnController.processEnemyAttack for every swing, blocked or
// not. A boss has its own attack frames instead.
//
// Three beats, snappy: a short draw back (up), the strike (down, speeding into
// it), and the return (slowing into the seat).
//
// A board card is several objects: the art, its numbers and sigils, the frost
// frame, the poison and shock markers. They all move together, by the same
// amount; the shadow stays on the board.

const LUNGE = Object.freeze({ back: 2, forward: 6, backMs: 35, strikeMs: 45, returnMs: 70 });
const CRIT_LUNGE = Object.freeze({ back: 3, forward: 12, backMs: 40, strikeMs: 55, returnMs: 90 });

// Everything drawn on the card that sits at the card's position.
function lungeParts(card) {
    const parts = new Set([card.sprite]);
    for (const value of Object.values(card)) {
        if (value && value !== card.shadow && value.scene && typeof value.setY === 'function') parts.add(value);
    }
    return [...parts];
}

export function playEnemyAttackLunge(scene, card, { crit = false } = {}) {
    if (!card?.sprite?.scene || !scene?.tweens) return;
    card._impactHopSettle?.();
    // Swinging again mid-lunge (a frenzy, a Quick Strike): settle the last one first.
    card._attackLunge?.stop?.();
    card._attackLungeSettle?.();
    // A card still sliding to a new seat (the Bone Hook's pull, Forced March)
    // strikes without a lunge: the lunge would fight the slide, and used to
    // leave the card stranded where the slide was when the lunge began (Taya).
    if (scene.tweens.isTweening?.(card.sprite)) return;
    const move = crit ? CRIT_LUNGE : LUNGE;
    // Everything is placed from the card's seat, not from where it happens to
    // stand, so the lunge always lands the card back on its seat. The other
    // parts keep their offset from the art.
    const seatY = Number.isFinite(card.restY) ? card.restY : card.sprite.y;
    const parts = lungeParts(card).map((object) => ({ object, offset: object.y - card.sprite.y }));
    // A slide that starts mid-lunge owns the card from then on: the lunge
    // lets go without placing anything, and the slide lands it on its seat.
    const sliding = () => scene.tweens.isTweening?.(card.sprite);
    const place = (dy) => {
        if (sliding()) return;
        parts.forEach(({ object, offset }) => {
            if (object.scene) object.setY(Math.round(seatY + offset + dy));
        });
    };
    card._attackLungeSettle = () => {
        place(0);
        card._attackLunge = null;
        card._attackLungeSettle = null;
    };
    const state = { dy: 0 };
    // Each beat runs on from the last; stopping any one settles the card.
    const beat = (to, duration, ease, next) => {
        card._attackLunge = scene.tweens.add({
            targets: state,
            dy: to,
            duration,
            ease,
            onUpdate: () => place(state.dy),
            onComplete: next,
            onStop: () => card._attackLungeSettle?.(),
        });
    };
    beat(-move.back, move.backMs, 'Quad.easeOut',
        () => beat(move.forward, move.strikeMs, 'Quad.easeIn',
            () => beat(0, move.returnMs, 'Quad.easeOut',
                () => card._attackLungeSettle?.())));
}

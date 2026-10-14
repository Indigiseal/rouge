// ui/ArcFlight.js
// The arc every flying icon travels: coins and crystals to their counters
// (CurrencyFlight), cards and amulets to the bag and bar (RewardFlight). A
// curve whose high point sits `arc` pixels above the higher end, halfway
// across, moved on whole pixels so pixel art never smears.

/**
 * Move `object` from (fromX, fromY) to (toX, toY) along the arc.
 * `onProgress(p)` runs every frame with progress 0..1 (for fades);
 * `onComplete` runs on landing.
 */
export function tweenAlongArc(scene, object, {
    fromX, fromY, toX, toY, arc, duration, ease = 'Sine.easeInOut', onProgress = null, onComplete = null,
}) {
    const start = { x: Math.round(fromX), y: Math.round(fromY) };
    const end = { x: Math.round(toX), y: Math.round(toY) };
    const peak = { x: (start.x + end.x) / 2, y: Math.min(start.y, end.y) - arc };
    object.setPosition(start.x, start.y);
    return scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration,
        ease,
        onUpdate: (tween) => {
            const p = tween.getValue();
            const q = 1 - p;
            object.x = Math.round(q * q * start.x + 2 * q * p * peak.x + p * p * end.x);
            object.y = Math.round(q * q * start.y + 2 * q * p * peak.y + p * p * end.y);
            onProgress?.(p);
        },
        onComplete: () => onComplete?.(),
    });
}

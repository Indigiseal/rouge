// A small distance-delayed hop. All overlays ride with their card; shadows stay put.
export function playBoardImpactRipple(scene, { x = 320, y = 150, height = 7, radius = Infinity } = {}) {
    if (!scene?.sys?.game || !scene.time || !scene.tweens) return;
    for (const card of scene.cardSystem?.boardCards || []) {
        const sprite = card?.sprite;
        if (!sprite?.scene) continue;
        const distance = Math.hypot(sprite.x - x, sprite.y - y);
        if (distance > radius) continue;
        // Fast wave travel, separate from each card's response. Distance also
        // weakens the impulse; the near cards react harder and settle sooner.
        const delay = Math.round(distance * 0.95);
        const amplitude = height / (1 + distance / 180);
        const duration = Math.round(145 + Math.min(60, distance * 0.2));
        scene.time.delayedCall(delay, () => {
            if (!sprite.scene || !(scene.cardSystem?.boardCards || []).includes(card)
                || card._attackLunge || scene.tweens.isTweening(sprite)) return;
            card._impactHopSettle?.();
            const parts = [...new Set([sprite, ...Object.values(card).filter(value =>
                value !== card.shadow && value?.scene && typeof value.setY === 'function')])]
                .map(object => ({ object, y: object.y }));
            const state = { progress: 0 };
            let tween;
            // Ballistic arc: a sharp launch, slowing into the apex, then
            // accelerating into the landing. No frozen pause at the top.
            const place = () => {
                const lift = amplitude * 4 * state.progress * (1 - state.progress);
                parts.forEach(({ object, y }) => { if (object.scene) object.y = Math.round(y - lift); });
            };
            const settle = () => {
                card._impactHopSettle = null;
                tween?.stop();
                state.progress = 1; place();
            };
            card._impactHopSettle = settle;
            tween = scene.tweens.add({ targets: state, progress: 1, duration,
                ease: 'Linear', onUpdate: place, onComplete: settle });
        });
    }
}

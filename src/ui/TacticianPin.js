// Animate an offset from the marker's current card anchor. Board movement can
// update that anchor without snapping the pin out of its planting animation.
export function positionTacticianPin(pin, x, y) {
    const motion = pin._tacticianPinMotion;
    if (motion) {
        motion.x = x;
        motion.y = y;
    }
    pin.x = Math.round(x);
    pin.y = Math.round(y + (motion?.offsetY || 0));
}

export function cancelTacticianPinDrop(scene, pin) {
    if (!pin?._tacticianPinMotion) return;
    (scene || pin.scene)?.tweens?.killTweensOf?.(pin._tacticianPinMotion);
    delete pin._tacticianPinMotion;
}

export function playTacticianPinDrop(scene, pin) {
    if (!pin?.scene || pin._tacticianPinPlanted) return;
    pin._tacticianPinPlanted = true;
    const motion = { x: pin.x, y: pin.y, offsetY: 0 };
    pin._tacticianPinMotion = motion;
    const steps = [
        { offsetY: -22, duration: 160, ease: 'Sine.easeOut' },
        { offsetY: 4, duration: 100, ease: 'Cubic.easeIn' },
        { offsetY: -2, duration: 65, ease: 'Sine.easeOut' },
        { offsetY: 0, duration: 85, ease: 'Sine.easeInOut' },
    ];
    const playStep = index => {
        if (!pin.scene || pin._tacticianPinMotion !== motion) return;
        if (index === steps.length) {
            positionTacticianPin(pin, motion.x, motion.y);
            delete pin._tacticianPinMotion;
            return;
        }
        scene.tweens.add({
            targets: motion,
            ...steps[index],
            onUpdate: () => {
                if (pin.scene && pin._tacticianPinMotion === motion) {
                    positionTacticianPin(pin, motion.x, motion.y);
                }
            },
            onComplete: () => {
                if (!pin.scene || pin._tacticianPinMotion !== motion) return;
                // Set explicitly as well, so the endpoint is exact on every renderer.
                motion.offsetY = steps[index].offsetY;
                positionTacticianPin(pin, motion.x, motion.y);
                playStep(index + 1);
            },
        });
    };
    playStep(0);
}

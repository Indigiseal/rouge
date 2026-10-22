// Reuses the retired Travel Kitchen's effect and stable ID.
export const SANDSPICE_POUCH = Object.freeze({
    name: 'Sandspice Pouch',
    description: 'Food restores 50% more Action Points, rounded down.',
    originLocationId: 'sandreach',
});

export function spiceFoodActions(amount) {
    return Math.floor(amount * 1.5);
}

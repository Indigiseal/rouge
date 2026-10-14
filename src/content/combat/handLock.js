// content/combat/handLock.js
// Enemies that lock a card in the player's bag for a turn ('web_hand'): the
// Silkslinger throws a web, the Ink Wraith a blob of ink. Same rule either
// way; each has its own art and its own word for it.
//
// The locked card remembers which it was (item.webbedKind), so its overlay,
// and the text when it refuses to move, match what hit it.

export const HAND_LOCKS = Object.freeze({
    web: Object.freeze({
        // web.png: frame 0 the silk over the card, frame 1 the web in flight.
        overlayKey: 'webCardOverlay', overlayFrame: 0,
        thrownKey: 'webCardOverlay', thrownFrame: 1,
        // Where the thrown drawing's middle sits from its 60x78 frame's middle.
        thrownDrawingDX: 2, thrownDrawingDY: -10,
        spins: true,
        text: 'Webbed!',
        tooltipKey: 'tooltip.webHand',
    }),
    ink: Object.freeze({
        // inkBlob.png: frame 0 the ink over the card, frame 1 the blob in
        // flight (48x32 frames; the flying blob sits a pixel left of centre).
        overlayKey: 'inkBlob', overlayFrame: 0,
        thrownKey: 'inkBlob', thrownFrame: 1,
        thrownDrawingDX: -1, thrownDrawingDY: 0,
        spins: true,
        text: 'Inked!',
        tooltipKey: 'tooltip.inkHand',
    }),
});

/** Which lock an enemy throws: ink for the Ink Wraith, web for the rest. */
export function handLockKindOf(enemyData) {
    return enemyData?.enemyType === 'inkWraith' ? 'ink' : 'web';
}

/** The lock on a bag card (web if it never said). */
export function handLockOf(item) {
    return HAND_LOCKS[item?.webbedKind] || HAND_LOCKS.web;
}

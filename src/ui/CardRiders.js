// ui/CardRiders.js
// Everything drawn on a card that is not the card art itself — its pips and
// value, the socketed gem, the gem's glow, the briar frame, the web, the hover
// shine, the merge sparkle — rides on the card at a fixed offset.
//
// These used to be separate objects that every path moving a card had to move
// one by one: hover lift, hover drop, drag, return to slot, the attack swing,
// the moth-wing hop. Each path kept its own list, the lists drifted apart, and
// whatever a list forgot was left behind — pips trailing a hover, a gem snapping
// home while its card was still sliding back. Here a rider is pinned once, and
// from then on it is wherever its card is, every frame, whatever moved the card.
//
// The pin runs on the scene's postupdate, after tweens and drag handlers have
// written the card's position for the frame. Both card and riders land on whole
// pixels: the pips are pixel art, and roundPixels rounds each object on its own,
// so a fractional position spreads them.
//
// The drop shadow is deliberately not a rider: on hover it stays on the slot
// while the card lifts off it.

/** Data key holding a card's riders: Map(name -> { object, dx, dy }). */
const RIDERS = 'cardRiders';

function ridersOf(card) {
    let riders = card.getData(RIDERS);
    if (!riders) {
        riders = new Map();
        card.setData(RIDERS, riders);
    }
    return riders;
}

/**
 * Pin `object` to `card` under `name`, replacing whatever was pinned there.
 * The offset is where it sits relative to the card's rest spot; it defaults to
 * dead centre, which is right for anything drawn the size of the card.
 */
export function pinRider(card, name, object, { dx = 0, dy = 0 } = {}) {
    if (!card?.setData || !object) return object;
    ridersOf(card).set(name, { object, dx: Math.round(dx), dy: Math.round(dy) });
    placeRider(card, object, dx, dy);
    return object;
}

export function unpinRider(card, name) {
    card?.getData?.(RIDERS)?.delete(name);
}

/** The live objects riding `card`, for code that must touch all of them. */
export function cardRiders(card) {
    const out = [];
    const info = card?.getData?.('infoText');
    if (info?.scene) out.push(info);
    card?.getData?.(RIDERS)?.forEach(({ object }) => {
        if (object?.scene) out.push(object);
    });
    return out;
}

function placeRider(card, object, dx, dy) {
    if (!object?.scene) return;
    object.x = Math.round(card.x) + dx;
    object.y = Math.round(card.y) + dy;
}

/**
 * Put every rider where it belongs on `card` right now. The per-frame pin below runs
 * this; call it before copying or measuring a card that was just moved (a drag
 * ending), when the riders have not had their frame yet.
 *
 * The pips-and-value container is read from the card's 'infoText' data each
 * frame rather than pinned, because several paths rebuild it (a weapon after a
 * swing, a merge) and set the new one there. Its offset is read the first frame
 * it is seen — the frame it was built in, at the card — so a gem's label keeps
 * its place below the art.
 */
export function syncCardRiders(card) {
    if (!card?.scene) return;
    card.x = Math.round(card.x);
    card.y = Math.round(card.y);

    const info = card.getData('infoText');
    if (info?.scene) {
        if (!info._followOffset) {
            info._followOffset = {
                x: Math.round(info.x - card.x),
                y: Math.round(info.y - card.y),
            };
        }
        info.x = card.x + info._followOffset.x;
        info.y = card.y + info._followOffset.y;
    }

    const riders = card.getData(RIDERS);
    if (!riders) return;
    riders.forEach(({ object, dx, dy }, name) => {
        if (!object?.scene) {
            riders.delete(name);
            return;
        }
        placeRider(card, object, dx, dy);
    });
}

/** Start pinning `card`'s riders every frame, until the card is destroyed. */
export function bindCardRiders(scene, card) {
    const follow = () => syncCardRiders(card);
    scene.events.on('postupdate', follow);
    card.once('destroy', () => {
        scene.events.off('postupdate', follow);
        // The card is gone, so its value and pips, its sigil icons and its gem go
        // with it. Some paths destroy the card and only some of what rode on it, and
        // what is left would sit on the board with nothing to follow.
        const info = card.getData?.('infoText');
        if (info?.scene) info.destroy();
        card.getData?.(RIDERS)?.forEach(({ object }, name) => {
            if ((name === 'gem' || name.startsWith('sigil')) && object?.scene) object.destroy();
        });
    });
}

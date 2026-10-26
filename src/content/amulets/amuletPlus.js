// "+" amulets: finding an amulet you already wear upgrades it to its "+" version.
//
// Each "+" is its own definition (currentCatalog.js) with the stronger numbers,
// shown under the plain amulet's name with a "+" and on the plain amulet's art.
// It is never dropped or sold: the only way to get one is to find the plain
// amulet again while wearing it. The "+" then takes the plain one's place.
//
// To give another amulet a "+": add its pair here, and a definition for the
// "+" id in currentCatalog.js (name 'Its Name+', the stronger numbers).

export const AMULET_PLUS = Object.freeze({
    ringOfRegeneration: 'ringOfGreaterRegeneration', // Ring of Regeneration+: 12 HP, +1 every 2 floors
    cartographersInk: 'oraclesFishbowl',             // Cartographer's Ink+: no fog at all
});

const PLUS_BASE = Object.freeze(Object.fromEntries(Object.entries(AMULET_PLUS).map(([base, plus]) => [plus, base])));

/** The "+" id for a plain amulet, or null when it has none. */
export function plusIdFor(amuletId) {
    return AMULET_PLUS[amuletId] || null;
}

/** The plain amulet a "+" upgrades, or null when `amuletId` is not a "+". */
export function plusBaseOf(amuletId) {
    return PLUS_BASE[amuletId] || null;
}

export function isPlusAmulet(amuletId) {
    return Boolean(PLUS_BASE[amuletId]);
}

/** Would taking `amuletId` now upgrade one the player wears? */
export function wouldUpgradeToPlus(amuletId, ownedIds) {
    const plusId = AMULET_PLUS[amuletId];
    return Boolean(plusId && ownedIds.has(amuletId) && !ownedIds.has(plusId));
}

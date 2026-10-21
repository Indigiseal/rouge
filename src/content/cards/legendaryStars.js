// content/cards/legendaryStars.js
// Stars above Legendary (Taya): there is no tier past gold, so merging two
// Legendary weapons or armors with the same number of stars gives one with a
// star more, up to MAX_LEGENDARY_STARS. Each star adds to the card's own
// numbers: +1 damage on a weapon, +1 protection on chain or plate, +5% dodge
// on leather (which has no protection). Two cards at the top only refresh.
// The card keeps its Legendary art; the stars are drawn along its bottom
// edge (BoardCardFx) and counted in its tooltip.

export const MAX_LEGENDARY_STARS = 3;

/**
 * Legendary weapons and armor never drop (Taya): no loot, chest, shop or
 * reward hands one out; the only way to one is merging two Epics. Asked for a
 * Legendary, these hand out an Epic instead.
 */
export function lootRarity(rarity) {
    return rarity === 'legendary' ? 'epic' : rarity;
}

export const STAR_LEATHER_DODGE = 0.05;

/** How many stars `card` wears (0 when none). */
export function cardStars(card) {
    return Math.max(0, Math.min(MAX_LEGENDARY_STARS, Math.floor(Number(card?.stars) || 0)));
}

/** True for the cards that can carry stars: Legendary weapons and armor. */
export function canWearStars(card) {
    return card?.rarity === 'legendary' && (card.type === 'weapon' || card.type === 'armor');
}

/** The stars a merge of `a` and `b` gives (they must wear the same number). */
export function starsAfterMerge(a, b) {
    return Math.min(MAX_LEGENDARY_STARS, Math.max(cardStars(a), cardStars(b)) + 1);
}

/** What one star adds to `card`, for the canonical-stats check. */
export function starBonus(card) {
    const stars = cardStars(card);
    if (!stars) return { damage: 0, protection: 0, dodge: 0 };
    if (card.type === 'weapon') return { damage: stars, protection: 0, dodge: 0 };
    const leather = !(card.protection > 0) && card.dodgeChance > 0;
    return leather
        ? { damage: 0, protection: 0, dodge: STAR_LEATHER_DODGE * stars }
        : { damage: 0, protection: stars, dodge: 0 };
}

/**
 * Put `stars` on a freshly built Legendary card (its table numbers), adding
 * what they give. Call once, on a card that has none yet.
 */
export function applyStars(card, stars) {
    const n = Math.max(0, Math.min(MAX_LEGENDARY_STARS, stars));
    if (!n || !canWearStars(card)) return card;
    card.stars = n;
    if (card.type === 'weapon') {
        card.damage = (Number(card.damage) || 0) + n;
    } else if (card.protection > 0) {
        card.protection += n;
    } else if (card.dodgeChance > 0) {
        card.dodgeChance = Math.round((card.dodgeChance + STAR_LEATHER_DODGE * n) * 100) / 100;
    }
    return card;
}

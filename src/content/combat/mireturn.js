import { sigilLevel } from '../sigils/sigils.js';

/** Capacity grows without restoring current HP. Serialized maxHealth is authoritative. */
export function growEnemy(card) {
    const data = card?.data;
    if (!card?.revealed || !(data?.health > 0) || data.isBonePile) return 0;
    if (sigilLevel(data, 'growth') <= 0) return 0;
    const amount = Math.max(1, Math.floor(data.growthPerAttack || 1));
    data.maxHealth = Math.max(data.health, data.maxHealth || data.health) + amount;
    return amount;
}

/** Each healer sustains every other revealed living ally, never itself. */
export function regenerateAllies(board, isEnemyCard) {
    const allies = [...new Set(board || [])].filter(card => card?.revealed
        && isEnemyCard(card) && card.data?.health > 0 && !card.data.isBonePile
        && !card.data.isCocoon && !card.data.features?.includes('cocoon_shell'));
    const total = allies.reduce((sum, card) => sum + sigilLevel(card.data, 'regenerate'), 0);
    const changes = [];
    for (const card of allies) {
        const amount = Math.max(0, Math.min(total - sigilLevel(card.data, 'regenerate'),
            (card.data.maxHealth || card.data.health) - card.data.health));
        if (amount <= 0) continue;
        card.data.health += amount;
        changes.push({ card, amount });
    }
    return changes;
}

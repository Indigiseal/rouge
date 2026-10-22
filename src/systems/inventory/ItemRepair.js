// Only living equipment can be mended. Deduplicate references so worn armor
// is not twice as likely to be chosen when it also appears in the bag.
export function repairRandomDamagedItem(items, random = Math.random) {
    const candidates = [...new Set(items)].filter(item => item
        && (item.type === 'weapon' || item.type === 'armor')
        && Number.isFinite(item.durability) && item.durability > 0
        && Number.isFinite(item.maxDurability) && item.durability < item.maxDurability);
    if (!candidates.length) return null;

    const item = candidates[Math.floor(random() * candidates.length)];
    const gained = Math.min(1, item.maxDurability - item.durability);
    item.durability += gained;
    return { item, gained };
}

// Frenzy: a boss with this ability (the Cerberus, the Ancient Cerberus) now and
// then bites once per head instead of attacking once, each bite harder than the
// last. Each bite is a whole attack of its own (CombatTurnController), so armor
// blocks each one and spends a pip on each one: a frenzy eats armor fast.
//
// A boss ability: { type: 'frenzy', chance, bites: [share, share, share] }, the
// shares being fractions of the boss's attack (so act scaling carries over).

export function frenzyAbility(data) {
    return (data?.abilities || []).find((ability) => ability?.type === 'frenzy') || null;
}

/** The bites' shares if this turn is a frenzy, else null. */
export function rollFrenzy(data, random = Math.random) {
    const ability = frenzyAbility(data);
    if (!ability || !Array.isArray(ability.bites) || ability.bites.length < 2) return null;
    if ((data.frozen || 0) > 0 || (data.health ?? 0) <= 0) return null;
    return random() < (ability.chance ?? 0) ? ability.bites.slice() : null;
}

/** One bite's damage from the boss's usual hit. Never less than 1. */
export function frenzyBiteDamage(baseDamage, share) {
    return Math.max(1, Math.round((Number(baseDamage) || 0) * (Number(share) || 1)));
}

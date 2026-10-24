// The statues' art, places and short rules. The Test Site preview below keeps its own
// in-memory state; the real Sanctuary (scenes/SanctuaryScene.js) uses the same statues,
// each standing for one village building (`building`), and keeps progress in meta.
// Nothing in the preview itself touches the meta manager or save data.
export const SANCTUARY_GUARDIANS = Object.freeze([
    { id: 'lion', name: 'Fanged Guardian', texture: 'sanctuaryLion',
        building: 'forge', x: 97, bottom: 295, rule: '+1 weapon damage' },
    { id: 'turtle', name: 'Shelled Sentinel', texture: 'sanctuaryTurtle',
        building: 'armory', x: 200, bottom: 275, rule: '+1 DEF' },
    { id: 'toad', name: 'Deep Toad', texture: 'sanctuaryToad',
        building: 'cottage', x: 434, bottom: 274, rule: '+15 max HP' },
    { id: 'bird', name: 'Trinket Keeper', texture: 'sanctuaryBird',
        building: 'healer', x: 562, bottom: 296, rule: 'Starting amulet · better quality' },
]);
export const SANCTUARY_PHOENIX = Object.freeze({
    id: 'phoenix', name: 'The Phoenix', texture: 'sanctuaryPhoenix',
    building: 'temple', x: 316, bottom: 233, rule: 'Revive once · 50% HP',
});
export const SANCTUARY_STATUES = Object.freeze([...SANCTUARY_GUARDIANS, SANCTUARY_PHOENIX]);
export const RESTORATION_COSTS = Object.freeze([2, 3, 5, 8, 12]);
export const PHOENIX_RESTORATION_COST = 7;

export function restorationCost(id, rank = 0) {
    if (id === 'phoenix') return rank === 0 ? PHOENIX_RESTORATION_COST : null;
    return RESTORATION_COSTS[rank] ?? null;
}

export function freshSanctuaryPreview() {
    return { points: 60, ranks: Object.fromEntries(SANCTUARY_STATUES.map(statue => [statue.id, 0])) };
}
export function phoenixUnlocked(ranks) {
    return SANCTUARY_GUARDIANS.every(statue => (ranks?.[statue.id] || 0) >= 1);
}
export function previewRestoration(state, id) {
    if (!SANCTUARY_STATUES.some(statue => statue.id === id)) return { ok: false };
    if (id === 'phoenix' && !phoenixUnlocked(state.ranks)) return { ok: false, locked: true };
    const rank = state.ranks[id] || 0;
    const max = id === 'phoenix' ? 1 : RESTORATION_COSTS.length;
    if (rank >= max) return { ok: false, maxed: true };
    const cost = restorationCost(id, rank);
    if (state.points < cost) return { ok: false, cost };
    state.points -= cost;
    state.ranks[id] = rank + 1;
    return { ok: true, cost, awakened: phoenixUnlocked(state.ranks) };
}

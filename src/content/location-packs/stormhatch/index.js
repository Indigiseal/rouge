// Provisional names and shared placeholder art for the first Storm playtest.
const creature = (name, role, archetype, sigils = []) => Object.freeze({
    name, role, archetype, minFloor: 1, sprite: 'enemyPlaceholder', placeholderArt: true,
    features: [], sigils: sigils.map(id => ({ id })),
});

export const STORMHATCH_ROSTER = Object.freeze({
    MELEE: Object.freeze(['rainMite', 'stormBoar', 'stormRam']),
    RANGED: Object.freeze(['cliffGull', 'thunderCrow']),
});

export const STORMHATCH_ENEMY_DEFS = Object.freeze({
    rainMite: creature('Rain Mite', 'MELEE', 'swarm'),
    stormBoar: creature('Storm Boar', 'MELEE', 'bruiser'),
    stormRam: creature('Storm Ram', 'MELEE', 'skirmisher', ['charged']),
    cliffGull: creature('Cliff Gull', 'RANGED', 'artillery'),
    thunderCrow: creature('Thunder Crow', 'RANGED', 'artillery', ['shock']),
});

export const STORMHATCH_LOCATION_PACK = Object.freeze({
    id: 'stormhatch', name: 'Stormhatch', enemies: STORMHATCH_ROSTER,
});

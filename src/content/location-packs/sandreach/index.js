// Provisional names and art for the approved sand lizardfolk playtest.
const creature = (name, role, archetype, sigils = []) => Object.freeze({
    name, role, archetype, minFloor: 1, sprite: 'enemyPlaceholder', placeholderArt: true,
    features: [], sigils: sigils.map(id => ({ id })),
});
export const SANDREACH_ROSTER = Object.freeze({
    MELEE: Object.freeze(['glassScarab', 'duneForager', 'sandSkirmisher']),
    RANGED: Object.freeze(['lizardArcher', 'sandcaller']),
});
export const SANDREACH_ENEMY_DEFS = Object.freeze({
    glassScarab: creature('Glass Scarab', 'MELEE', 'swarm'),
    duneForager: creature('Dune Forager', 'MELEE', 'bruiser', ['forage']),
    sandSkirmisher: creature('Sand Skirmisher', 'MELEE', 'skirmisher', ['quickStrike']),
    lizardArcher: creature('Lizard Archer', 'RANGED', 'artillery'),
    sandcaller: creature('Sandcaller', 'RANGED', 'artillery', ['daze']),
});
export const SANDREACH_LOCATION_PACK = Object.freeze({
    id: 'sandreach', name: 'Sandreach', enemies: SANDREACH_ROSTER,
});

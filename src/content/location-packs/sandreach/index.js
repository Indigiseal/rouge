import { enemyCardPresentation, enemyCardKey } from '../../assets/enemyCards.js';

// Taya's painted row 10: Scarab, Forager, Skirmisher, Archer, Sandcaller.
export const SANDREACH_ROSTER = Object.freeze({
    MELEE: Object.freeze(['glassScarab', 'duneForager', 'sandSkirmisher']),
    RANGED: Object.freeze(['lizardArcher', 'sandcaller']),
});
const creature = (id, name, role, archetype, sigils = []) => Object.freeze({
    name, role, archetype, minFloor: 1,
    ...enemyCardPresentation('sandreach', SANDREACH_ROSTER, id),
    features: [], sigils: sigils.map(id => ({ id })),
});
export const SANDREACH_ENEMY_DEFS = Object.freeze({
    glassScarab: creature('glassScarab', 'Glass Scarab', 'MELEE', 'swarm'),
    duneForager: creature('duneForager', 'Dune Forager', 'MELEE', 'bruiser', ['forage']),
    sandSkirmisher: creature('sandSkirmisher', 'Sand Skirmisher', 'MELEE', 'skirmisher', ['quickStrike']),
    lizardArcher: creature('lizardArcher', 'Lizard Archer', 'RANGED', 'artillery'),
    sandcaller: creature('sandcaller', 'Sandcaller', 'RANGED', 'artillery', ['daze']),
});

/** Upgrade saved placeholders without changing combat state or custom artwork. */
export function refreshSandreachCardArt(data) {
    if (data?.type === 'boss' && data.sprite === 'enemyPlaceholder'
        && (data.bossId === 'sandscaleChieftain' || data.name === 'Sandscale Chieftain')) {
        return { ...data, sprite: 'lizardBoss', placeholderArt: false };
    }
    if (!['enemy', 'eliteEnemy'].includes(data?.type)) return data;
    const def = SANDREACH_ENEMY_DEFS[data.enemyType];
    if (!def || !(data.sprite === 'enemyPlaceholder' || data.sprite === data.enemyType
        || data.sprite?.startsWith('enemyCard_sandreach_'))) return data;
    const tier = data.enemyTier || (data.isEliteMiniBoss || data.type === 'eliteEnemy' ? 'elite' : 'normal');
    return { ...data, monthId: def.monthId, sheetColumn: def.sheetColumn,
        sprite: enemyCardKey(def.monthId, def.sheetColumn, tier), placeholderArt: false };
}
export const SANDREACH_LOCATION_PACK = Object.freeze({
    id: 'sandreach', name: 'Sandreach', enemies: SANDREACH_ROSTER,
});

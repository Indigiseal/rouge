import { enemyCardPresentation, enemyCardKey } from '../../assets/enemyCards.js';

// Taya's painted order interleaves melee and ranged creatures on row 8.
export const FROSTHOLLOW_ROSTER = Object.freeze({
    MELEE: Object.freeze(['snowBrute', 'iceGolem', 'frozenKnight']),
    RANGED: Object.freeze(['snowArcher', 'iceOrb']),
    SHEET_ORDER: Object.freeze(['snowBrute', 'snowArcher', 'iceOrb', 'iceGolem', 'frozenKnight']),
});
const creature = (id, name, role, archetype, sigils = []) => Object.freeze({
    name, role, archetype, minFloor: 1,
    ...enemyCardPresentation('frosthollow', FROSTHOLLOW_ROSTER, id),
    features: [], sigils: sigils.map(id => ({ id })),
});
export const FROSTHOLLOW_ENEMY_DEFS = Object.freeze({
    snowBrute: creature('snowBrute', 'Snow Brute', 'MELEE', 'bruiser'),
    snowArcher: creature('snowArcher', 'Snow Archer', 'RANGED', 'artillery'),
    iceOrb: creature('iceOrb', 'Ice Orb', 'RANGED', 'artillery', ['frost']),
    iceGolem: creature('iceGolem', 'Ice Golem', 'MELEE', 'bruiser', ['shatter']),
    frozenKnight: creature('frozenKnight', 'Frozen Knight', 'MELEE', 'skirmisher', ['merciless']),
});
export const FROSTHOLLOW_LOCATION_PACK = Object.freeze({
    id: 'frosthollow', name: 'Frosthollow', enemies: FROSTHOLLOW_ROSTER,
});

// Resolve old queued summons without keeping animals in the new spawn pool.
export const FROSTHOLLOW_ENEMY_ALIASES = Object.freeze({
    snowMite: 'snowArcher', tuskBoar: 'snowBrute', frostHare: 'iceOrb',
    iceWolf: 'iceGolem', snowOwl: 'frozenKnight',
});

/** Refresh identity/presentation while retaining saved HP, attack and statuses. */
export function refreshFrostCardArt(data) {
    if (data?.type === 'boss' && data.name === 'Frost Giant' && data.sprite === 'enemyPlaceholder') {
        return { ...data, sprite: 'frostGiant', placeholderArt: false };
    }
    if (!['enemy', 'eliteEnemy'].includes(data?.type)) return data;
    const oldId = data.enemyType;
    const id = FROSTHOLLOW_ENEMY_ALIASES[oldId] || oldId;
    const def = FROSTHOLLOW_ENEMY_DEFS[id];
    if (!def) return data;
    const knownArt = data.sprite === 'enemyPlaceholder' || data.sprite === oldId
        || data.sprite?.startsWith('enemyCard_frosthollow_');
    if (!knownArt) return data;
    const tier = data.enemyTier || (data.isEliteMiniBoss || data.type === 'eliteEnemy' ? 'elite' : 'normal');
    return { ...data, enemyType: id, name: def.name, role: def.role, isRangedType: def.role === 'RANGED',
        monthId: def.monthId, sheetColumn: def.sheetColumn,
        sprite: enemyCardKey(def.monthId, def.sheetColumn, tier), placeholderArt: false };
}

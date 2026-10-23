import { enemyCardPresentation, enemyCardKey } from '../../assets/enemyCards.js';

// The Cloudborn, painted on row 9 of the enemy sheet in this order: three
// melee, then two ranged.
export const STORMHATCH_ROSTER = Object.freeze({
    MELEE: Object.freeze(['cloudbornGuard', 'lightningBee', 'stormGolem']),
    RANGED: Object.freeze(['lightningEye', 'cloudbornArcher']),
});
const creature = (id, name, role, archetype, sigils = []) => Object.freeze({
    name, role, archetype, minFloor: 1,
    ...enemyCardPresentation('stormhatch', STORMHATCH_ROSTER, id),
    features: [], sigils: sigils.map(id => ({ id })),
});

// Each Cloudborn keeps the stats and sigil of the placeholder it replaced.
export const STORMHATCH_ENEMY_DEFS = Object.freeze({
    cloudbornGuard: creature('cloudbornGuard', 'Cloudborn Guard', 'MELEE', 'bruiser'),
    lightningBee: creature('lightningBee', 'Lightning Bee', 'MELEE', 'swarm'),
    stormGolem: creature('stormGolem', 'Storm Golem', 'MELEE', 'skirmisher', ['charged']),
    lightningEye: creature('lightningEye', 'Lightning Eye', 'RANGED', 'artillery', ['shock']),
    cloudbornArcher: creature('cloudbornArcher', 'Cloudborn Archer', 'RANGED', 'artillery'),
});

export const STORMHATCH_LOCATION_PACK = Object.freeze({
    id: 'stormhatch', name: 'Stormhatch', enemies: STORMHATCH_ROSTER,
});

// Resolve old queued summons and saved cards without keeping the placeholders
// in the spawn pool.
export const STORMHATCH_ENEMY_ALIASES = Object.freeze({
    stormBoar: 'cloudbornGuard', rainMite: 'lightningBee', stormRam: 'stormGolem',
    thunderCrow: 'lightningEye', cliffGull: 'cloudbornArcher',
});

/** Refresh identity/presentation while retaining saved HP, attack and statuses. */
export function refreshStormCardArt(data) {
    // Keep the stable boss id and saved combat state when replacing the Roc placeholder.
    if (data?.type === 'boss' && data.sprite === 'enemyPlaceholder'
        && (data.bossId === 'tempestRoc' || data.name === 'Tempest Roc')) {
        return { ...data, name: 'Storm Archon', sprite: 'lightningBoss', spriteScale: 0.5, placeholderArt: false };
    }
    if (!['enemy', 'eliteEnemy'].includes(data?.type)) return data;
    const oldId = data.enemyType;
    const id = STORMHATCH_ENEMY_ALIASES[oldId] || oldId;
    const def = STORMHATCH_ENEMY_DEFS[id];
    if (!def) return data;
    const knownArt = data.sprite === 'enemyPlaceholder' || data.sprite === oldId
        || data.sprite?.startsWith('enemyCard_stormhatch_');
    if (!knownArt) return data;
    const tier = data.enemyTier || (data.isEliteMiniBoss || data.type === 'eliteEnemy' ? 'elite' : 'normal');
    return { ...data, enemyType: id, name: def.name, role: def.role, isRangedType: def.role === 'RANGED',
        monthId: def.monthId, sheetColumn: def.sheetColumn,
        sprite: enemyCardKey(def.monthId, def.sheetColumn, tier), placeholderArt: false };
}

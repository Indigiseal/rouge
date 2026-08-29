// Enemy tiers — the danger step above a plain enemy, below a boss.
// Design SoT: docs/BALANCE.md (Enemy power: bands + archetypes).
//
// Tiers are a PROMOTION, not an identity: any enemy can spawn at any tier, the
// same way the elite mini-boss already worked. They sit on top of the floor
// band and archetype, which decide an enemy's baseline:
//
//   band (depth)  ×  archetype (shape)  ×  tier (danger)
//
//   normal   the baseline every enemy spawns at
//   veteran  a tougher-than-usual specimen; several can share a board
//   elite    the mini-boss, exactly one per elite room
//
// Boss enemies are outside this ladder entirely and are never promoted.

export const ENEMY_TIERS = Object.freeze({
    normal: Object.freeze({ health: 1.0, attack: 1.0 }),
    veteran: Object.freeze({ health: 1.15, attack: 1.15 }),
    elite: Object.freeze({ health: 1.3, attack: 1.3 }),
});

export const DEFAULT_ENEMY_TIER = 'normal';

// Chance that any one eligible enemy on a board spawns as a veteran, by floor.
// Read like POWER_BANDS: the last entry whose minFloor you have reached wins.
// Floors 1-3 are deliberately flat so a new run teaches the baseline fight
// before it starts throwing tougher specimens at the player.
export const VETERAN_CHANCE_BANDS = Object.freeze([
    { minFloor: 1, chance: 0 },
    { minFloor: 4, chance: 0.1 },
    { minFloor: 10, chance: 0.15 },
    { minFloor: 20, chance: 0.2 },
]);

// Elite rooms are already the dangerous ones, so their non-mini-boss enemies
// are likelier to be veterans too. Added to the floor chance, then capped.
export const ELITE_ROOM_VETERAN_BONUS = 0.1;

// No board should be mostly veterans — past this the tier stops reading as
// "this one is unusual" and just becomes the new baseline.
export const MAX_VETERAN_CHANCE = 0.35;

/** Veteran spawn chance for `floor`, before the elite-room bonus. */
export function veteranChanceForFloor(floor) {
    const f = Math.max(1, Math.floor(Number(floor) || 1));
    let chance = VETERAN_CHANCE_BANDS[0].chance;
    for (let i = VETERAN_CHANCE_BANDS.length - 1; i >= 0; i--) {
        if (f >= VETERAN_CHANCE_BANDS[i].minFloor) {
            chance = VETERAN_CHANCE_BANDS[i].chance;
            break;
        }
    }
    return chance;
}

/** Veteran spawn chance for `floor`, including the elite-room bonus. */
export function veteranChanceFor(floor, roomType) {
    const base = veteranChanceForFloor(floor);
    if (base <= 0) return 0;
    const withBonus = roomType === 'ELITE' ? base + ELITE_ROOM_VETERAN_BONUS : base;
    return Math.min(MAX_VETERAN_CHANCE, withBonus);
}

/**
 * Stamps `tier` onto an enemy's card data and rewrites its stats to match.
 *
 * Stats are always recomputed from the untiered numbers cached on first call,
 * never from the current ones, so promoting a veteran to elite gives 1.3x and
 * not 1.15 x 1.3. That also makes this safe to call twice with the same tier.
 *
 * @param {object} data enemy card data, mutated in place
 * @param {'normal'|'veteran'|'elite'} tier
 * @returns {object} the same data
 */
export function applyEnemyTier(data, tier) {
    if (!data) return data;
    const mult = ENEMY_TIERS[tier] || ENEMY_TIERS[DEFAULT_ENEMY_TIER];

    // Cache the untiered stats the first time we touch this card.
    if (!Number.isFinite(data.tierBaseHealth)) {
        data.tierBaseHealth = Math.max(1, Math.ceil(Number(data.maxHealth ?? data.health) || 1));
    }
    if (!Number.isFinite(data.tierBaseAttack)) {
        data.tierBaseAttack = Math.max(1, Math.ceil(Number(data.attack) || 1));
    }

    const health = Math.max(1, Math.ceil(data.tierBaseHealth * mult.health));
    const attack = Math.max(1, Math.ceil(data.tierBaseAttack * mult.attack));

    data.enemyTier = tier;
    data.health = health;
    // maxHealth has to move with health or the card spawns "damaged" — its bar
    // would read over 100% and heals would clamp it back down to the base.
    data.maxHealth = health;
    data.attack = attack;
    // Kept in step for the existing elite art, tint and tooltip checks.
    data.isEliteMiniBoss = tier === 'elite';
    return data;
}

/** True when this card may be promoted. Bosses and scripted spawns may not. */
export function canTierEnemy(data) {
    if (!data) return false;
    if (data.type === 'boss') return false;
    // The Nestmother is placed by its own event and balanced as written.
    if (data.name === 'Angry Nestmother') return false;
    return true;
}

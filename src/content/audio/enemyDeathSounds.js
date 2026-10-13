// Enemy death sounds. Every enemy kind (card.data.enemyType) has its own:
// assets/music/Death_<Kind>.mp3, loaded as death_enemy_<kind> behind the main
// menu (LATE_AUDIO). Until it lands, the shared enemy_death pair plays. The
// family sounds (death_<family>) were a fallback for kinds without their own;
// every kind has one now, so their files moved to assets/_archive/audio/ and
// are no longer loaded. The family lookup stays, harmlessly, for a new kind
// added without a sound.
//
// The sounds were generated with ElevenLabs from the prompts in
// tools/death-sounds.json (tools/generate-death-sounds.mjs).

export const ENEMY_DEATH_FAMILIES = Object.freeze({
    bones: ['skeleton', 'skeleton_archer', 'boneHeap', 'cryptWarden', 'skullLobber'],
    goblins: ['goblin', 'goblin_archer', 'tollBrute', 'highwayCutpurse', 'roadSniper'],
    beasts: ['wolf', 'cerberusHead', 'mireToad'],
    bugs: ['spider', 'caveCrawler', 'stingerScorpion', 'silkslinger', 'silkHusk'],
    plants: ['thornEnt', 'thornSprite', 'thornFairy', 'sporeArcher'],
    bog: ['bogSlug', 'drowned', 'mireBrute', 'fenSpitter', 'lavaSlime'],
    ghosts: ['lostSoul', 'hollowMourner', 'veilRipper', 'inkWraith', 'graveCantor'],
    fire: ['emberMaw', 'cinderLizard', 'cinderBrute', 'slagSpitter'],
});

/** Every enemy kind with a death sound of its own. */
export const ENEMY_DEATH_KINDS = Object.freeze(Object.values(ENEMY_DEATH_FAMILIES).flat());

const pascal = (kind) => kind.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join('');

/** Manifest entries for every enemy's own death sound. */
export const ENEMY_DEATH_SOUND_ASSETS = Object.freeze(ENEMY_DEATH_KINDS.map((kind) => ({
    key: `death_enemy_${kind}`,
    path: `assets/music/Death_${pascal(kind)}.mp3`,
    type: 'audio',
})));

const FAMILY_OF = new Map(
    Object.entries(ENEMY_DEATH_FAMILIES)
        .flatMap(([family, kinds]) => kinds.map((kind) => [kind, family]))
);

/**
 * The audio keys to try for this enemy's death, most specific first: its own,
 * then its family's. The caller plays the first one loaded, else the shared
 * enemy_death pair.
 */
export function enemyDeathSoundKeys(enemyData) {
    const kind = enemyData?.enemyType;
    if (!kind) return [];
    const family = FAMILY_OF.get(kind);
    return [`death_enemy_${kind}`, ...(family ? [`death_${family}`] : [])];
}

/** True for every enemy death sound, own or family (none get cut short). */
export function isEnemyDeathSoundKey(key) {
    return typeof key === 'string' && key.startsWith('death_');
}

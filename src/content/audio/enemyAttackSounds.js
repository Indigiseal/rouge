// Ordinary enemies' own attack sounds, played as the enemy lunges (bosses
// have theirs in bossSounds.js). A kind may have more than one take; each
// attack picks one at random, never the same one twice running.
// assets/music/Attack_<Kind>_<n>.mp3, loaded behind the main menu (LATE_AUDIO);
// until one lands, the attack is silent as before.
//
// Generated with ElevenLabs from tools/death-sounds.json "veil_attacks",
// "sand_attacks", "bone_attacks" and "mimic_attack"
// (tools/generate-death-sounds.mjs). Taya kept both takes of each, except the
// Lost Soul's second. The Glass Scarab was redone as a buzzing, zooming flier;
// Taya chose take 1 of the new set. The Mimic's attack is take 1, made from the
// prompt of its cry (mimic_cry_a) so the two sound like one creature.

export const ENEMY_ATTACK_TAKES = Object.freeze({
    // Veilbleed
    lostSoul: [1],
    hollowMourner: [1, 2],
    veilRipper: [1, 2],
    inkWraith: [1, 2],
    graveCantor: [1, 2],
    // Sandreach
    glassScarab: [1],
    duneForager: [1, 2],
    sandSkirmisher: [1, 2],
    lizardArcher: [1, 2],
    sandcaller: [1, 2],
    // The bones family
    skeleton: [1, 2],
    skeleton_archer: [1, 2],
    boneHeap: [1, 2],
    cryptWarden: [1, 2],
    skullLobber: [1, 2],
    // The Mimic (no enemyType; see enemyAttackSoundKey), from its cry's prompt.
    mimic: [1],
});

const pascal = (kind) => kind.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join('');
const keyOf = (kind, take) => `attack_enemy_${kind}_${take}`;

/** Manifest entries for every enemy attack take. */
export const ENEMY_ATTACK_SOUND_ASSETS = Object.freeze(
    Object.entries(ENEMY_ATTACK_TAKES).flatMap(([kind, takes]) => takes.map((take) => ({
        key: keyOf(kind, take),
        path: `assets/music/Attack_${pascal(kind)}_${take}.mp3`,
        type: 'audio',
    })))
);

const lastTake = new Map();

/**
 * The audio key to play for this enemy's attack, or null when it has none
 * (or none has loaded yet). `exists` tells whether a key is loaded.
 */
export function enemyAttackSoundKey(enemyData, exists = () => true) {
    // A Mimic is built apart from the enemy catalog and has no enemyType.
    const kind = enemyData?.isMimic ? 'mimic' : enemyData?.enemyType;
    const keys = (ENEMY_ATTACK_TAKES[kind] || []).map((take) => keyOf(kind, take)).filter(exists);
    if (!keys.length) return null;
    const choices = keys.length > 1 ? keys.filter((k) => k !== lastTake.get(kind)) : keys;
    const key = choices[Math.floor(Math.random() * choices.length)];
    lastTake.set(kind, key);
    return key;
}

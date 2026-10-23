// Boss attack and death sounds, by boss catalog id (content/cards/bosses.js).
// Bosses carry no `enemyType`, so enemyDeathSounds cannot find them; this is
// the boss counterpart. Only the location bosses have their own so far, every
// other boss keeps the shared hit and death sounds.
//
// Generated with ElevenLabs from the boss_sounds set in tools/death-sounds.json
// (tools/generate-death-sounds.mjs). Loaded behind the main menu (LATE_AUDIO).
// Death keys start with `death_` so they are never cut short, like every
// enemy death.
//
// The Storm boss keeps the id `tempestRoc` and is the Storm Archon, so its
// death is the Archon's own sound already loaded as death_enemy_stormArchon.
import { BOSSES } from '../cards/bosses.js';

export const BOSS_SOUNDS = Object.freeze({
    sandscaleChieftain: Object.freeze({
        attack: 'boss_attack_sandscaleChieftain', death: 'death_boss_sandscaleChieftain',
    }),
    frostGiant: Object.freeze({
        attack: 'boss_attack_frostGiant', death: 'death_boss_frostGiant',
    }),
    tempestRoc: Object.freeze({
        attack: 'boss_attack_stormArchon', death: 'death_enemy_stormArchon',
    }),
});

/** Files that are not already loaded under another key. */
export const BOSS_SOUND_ASSETS = Object.freeze([
    { key: 'boss_attack_sandscaleChieftain', path: 'assets/music/Boss_Attack_SandscaleChieftain.mp3', type: 'audio' },
    { key: 'death_boss_sandscaleChieftain', path: 'assets/music/Death_Boss_SandscaleChieftain.mp3', type: 'audio' },
    { key: 'boss_attack_frostGiant', path: 'assets/music/Boss_Attack_FrostGiant.mp3', type: 'audio' },
    { key: 'death_boss_frostGiant', path: 'assets/music/Death_Boss_FrostGiant.mp3', type: 'audio' },
    { key: 'boss_attack_stormArchon', path: 'assets/music/Boss_Attack_StormArchon.mp3', type: 'audio' },
]);

function bossIdOf(data) {
    if (!data) return null;
    if (data.bossId && BOSS_SOUNDS[data.bossId]) return data.bossId;
    const match = Object.entries(BOSSES).find(([, boss]) => (
        boss.name === data.name || (data.sprite && boss.sprite === data.sprite)
    ));
    return match ? match[0] : null;
}

/** `{ attack, death }` audio keys for a boss card, or null for one without its own. */
export function bossSoundKeys(data) {
    return BOSS_SOUNDS[bossIdOf(data)] || null;
}

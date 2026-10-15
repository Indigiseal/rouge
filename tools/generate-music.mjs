// tools/generate-music.mjs
// Generates a music track with the ElevenLabs Music API into assets/_sfx_takes/
// (ignored by git) to audition. The chosen take is copied into assets/music/.
//
//   node tools/generate-music.mjs battle            one take of the (dark) battle loop
//   node tools/generate-music.mjs battle_light      the lighter, casual battle loop
//   node tools/generate-music.mjs battle_mellow     calm retro-fantasy battle loop
//   node tools/generate-music.mjs battle --takes 2  two takes
//
// Tracks and their prompts are in TRACKS below. The key is read the same way
// as generate-death-sounds.mjs: ELEVENLABS_API_KEY, or
// %USERPROFILE%\.elevenlabs\key.txt. It is never printed. Music spends far
// more credits than a sound effect.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'assets', '_sfx_takes');
const API = 'https://api.elevenlabs.io/v1/music';

const TRACKS = {
    // Classic dungeon synth (Taya named the genre, 2026-10): the raw early-90s
    // tape sound rather than the polished 16-bit RPG take of the battle_ds_*
    // tries below. Cheap keyboard presets, hiss, simple repeating melodies,
    // little or no percussion.
    ds_classic_map: {
        lengthMs: 60000,
        prompt: 'Classic dungeon synth instrumental in the raw early 1990s home-recorded style. Lo-fi cassette '
            + 'tape sound with soft hiss and slight warble. A cheap vintage keyboard organ and a soft synth choir '
            + 'preset playing a slow, simple, repeating medieval melody in a minor mode over a long low drone, '
            + 'with an occasional plucked synth harpsichord answer. Lonely, wistful, ancient and atmospheric, '
            + 'like wandering forgotten castle halls by candlelight. Minimal and hypnotic, no drums, no guitars, '
            + 'no vocals. Seamless loop with no fade out.',
    },
    ds_classic_battle: {
        lengthMs: 60000,
        prompt: 'Classic dungeon synth instrumental for a turn-based battle, raw early 1990s home-recorded style. '
            + 'Lo-fi cassette tape hiss. A cheap vintage keyboard playing a repeating minor-mode ostinato on synth '
            + 'harpsichord, a stern synth brass melody, a soft synth choir pad and a deep drone, with a slow, '
            + 'quiet, steady timpani-like pulse. Grim, determined and medieval but restrained and hypnotic, '
            + 'never epic or loud, sitting under game sound effects. No guitars, no vocals. '
            + 'Seamless loop with no fade out.',
    },
    ds_classic_battle_drive: {
        lengthMs: 60000,
        prompt: 'Classic dungeon synth battle instrumental with more forward drive, raw early 1990s home-recorded '
            + 'style. Lo-fi cassette tape hiss. A brisk repeating synth harpsichord arpeggio in a minor mode, a '
            + 'bold but low-volume synth brass and organ melody, a soft synth choir pad, a deep drone and a steady '
            + 'mid tempo marching timpani-like pulse with light synth war drums. Determined, medieval and '
            + 'adventurous, focused rather than epic, hypnotic and repetitive. No guitars, no vocals. '
            + 'Seamless loop with no fade out.',
    },
    ds_classic_battle_grim: {
        lengthMs: 60000,
        prompt: 'Grim, dark classic dungeon synth battle instrumental, raw early 1990s home-recorded style. Lo-fi '
            + 'cassette tape hiss and warble. A slow heavy repeating minor-mode figure on a cheap keyboard organ '
            + 'and synth harpsichord, a menacing low synth brass line, a cold synth choir pad, a deep rumbling '
            + 'drone and a slow, quiet, heartbeat-like timpani pulse. Ominous and brooding like facing a monster '
            + 'deep in a crypt, but restrained and hypnotic, never loud or epic. No guitars, no vocals. '
            + 'Seamless loop with no fade out.',
    },
    // Taya liked ds_classic_menu best of the first three and wants it as the
    // fight music: its sound kept, a fight's pulse added, in three steps.
    ds_menu_battle_pulse: {
        lengthMs: 60000,
        prompt: 'Classic dungeon synth instrumental, raw early 1990s home-recorded style with lo-fi cassette tape '
            + 'hiss and warmth. A solemn melody on a vintage keyboard flute preset over a warm organ and a soft '
            + 'synth choir, a deep drone and a gentle bell-like synth note now and then, mysterious and nostalgic. '
            + 'Add a slow, steady, quiet timpani-like pulse underneath so it works as calm turn-based battle '
            + 'music, focused and a little tense. Simple and hypnotic. No guitars, no vocals. '
            + 'Seamless loop with no fade out.',
    },
    ds_menu_battle_motion: {
        lengthMs: 60000,
        prompt: 'Classic dungeon synth battle instrumental, raw early 1990s home-recorded style with lo-fi '
            + 'cassette tape hiss. A solemn vintage keyboard flute melody over a warm organ and a soft synth '
            + 'choir, with a repeating synth harpsichord arpeggio underneath giving steady forward motion, a deep '
            + 'drone, occasional bell-like synth notes and a quiet steady drum-like pulse. Mysterious, nostalgic '
            + 'and quietly determined, like an old fantasy tale turning into a fight. Hypnotic, never epic. '
            + 'No guitars, no vocals. Seamless loop with no fade out.',
    },
    ds_menu_battle_tense: {
        lengthMs: 60000,
        prompt: 'Tense classic dungeon synth battle instrumental, raw early 1990s home-recorded style with lo-fi '
            + 'cassette tape hiss. A minor-mode vintage keyboard flute melody over a warm organ and a soft synth '
            + 'choir, a repeating low synth harpsichord figure, a deep drone, bell-like synth notes, and a steady '
            + 'marching timpani-like pulse at a moderate tempo. Mysterious and nostalgic but with clear danger and '
            + 'resolve, restrained and hypnotic, never loud or epic, sitting under game sound effects. '
            + 'No guitars, no vocals. Seamless loop with no fade out.',
    },
    ds_classic_menu: {
        lengthMs: 60000,
        prompt: 'Classic dungeon synth instrumental title theme, raw early 1990s home-recorded style. Lo-fi '
            + 'cassette tape hiss and warmth. A slow solemn melody on a vintage keyboard flute preset over a '
            + 'warm organ and a soft synth choir, with a deep drone and a gentle bell-like synth note now and '
            + 'then. Mysterious, nostalgic and inviting, like an old fantasy tale about to begin. Very simple, '
            + 'spacious and hypnotic. No drums, no guitars, no vocals. Seamless loop with no fade out.',
    },
    // Fight loop, dungeon synth: the genre behind Slice & Dice's soundtrack
    // (its credited artists include the dungeon synth act Ziggurath). Lo-fi,
    // minimal, medieval-fantasy keyboards; earnest and calm with a little
    // tension. Not "casual" or "playful" - those words made it cartoony.
    battle_dungeon_synth: {
        lengthMs: 60000,
        prompt: 'Dungeon synth instrumental. Lo-fi, minimalist medieval fantasy atmosphere played on warm vintage '
            + 'synthesizers: soft analog pads, a slow modal melody on synth harp and mellow synth flute, a quiet '
            + 'synth choir and a low steady drone, like a 1990s fantasy role-playing game. Calm, earnest and a '
            + 'little mysterious, with a hint of quiet tension. No drums, no guitars, no vocals. '
            + 'Seamless loop with no fade out.',
    },
    battle_ds_motion: {
        lengthMs: 60000,
        prompt: 'Dungeon synth instrumental with gentle forward motion. Warm 16-bit fantasy role-playing game '
            + 'sound: a soft harpsichord-like synth arpeggio over warm string pads, a slow modal synth flute melody, '
            + 'a low drone and a light soft hand drum keeping a steady mid tempo. Earnest, medieval and a little '
            + 'mysterious, quietly focused. No guitars, no vocals. Seamless loop with no fade out.',
    },
    battle_ds_motion_dark: {
        lengthMs: 60000,
        prompt: 'Dark, suspenseful dungeon synth instrumental with steady forward motion. Warm 16-bit fantasy '
            + 'role-playing game sound in a low register: a repeating harpsichord-like synth arpeggio in a minor '
            + 'Phrygian mode that slowly builds unease, deep dark string pads, a low ominous drone, a soft '
            + 'heartbeat-like hand drum, and occasional quiet dissonant synth swells. Tense, brooding and focused, '
            + 'like creeping through a dangerous dungeon. No guitars, no vocals. Seamless loop with no fade out.',
    },
    battle_ds_motion_harp: {
        lengthMs: 60000,
        prompt: 'Dungeon synth instrumental with gentle forward motion. Warm 16-bit fantasy role-playing game '
            + 'sound: a soft harpsichord-like synth arpeggio over warm string pads, a slow modal synth harp '
            + 'melody, a low drone and a light soft hand drum keeping a steady mid tempo. Earnest, medieval and a '
            + 'little mysterious, quietly focused. No guitars, no vocals. Seamless loop with no fade out.',
    },
    battle_ds_motion_slow: {
        lengthMs: 60000,
        prompt: 'Dungeon synth instrumental with gentle, unhurried motion. Warm 16-bit fantasy role-playing game '
            + 'sound: a slow soft harpsichord-like synth arpeggio over warm string pads, a calm modal synth flute '
            + 'melody, a low drone and a very light hand drum at a relaxed slow tempo. Earnest, medieval and a '
            + 'little mysterious. No guitars, no vocals. Seamless loop with no fade out.',
    },
    battle_ds_dark: {
        lengthMs: 60000,
        prompt: 'Atmospheric dungeon synth instrumental leaning into dark ambient. Slow and spacious: deep warm '
            + 'analog pads, a distant low choir, a sparse modal synth bell melody and a long low drone, like '
            + 'exploring a candlelit stone crypt in a 1990s fantasy role-playing game. Calm with an undercurrent of '
            + 'quiet tension. No drums, no guitars, no vocals. Seamless loop with no fade out.',
    },
    battle_ds_melodic: {
        lengthMs: 60000,
        prompt: 'Melodic dungeon synth instrumental. A lute-like synth pluck pattern and a soft medieval recorder '
            + 'melody in a minor mode over warm vintage synth pads and a low drone, lo-fi and sincere, like a '
            + 'wandering theme in a 1990s fantasy role-playing game. Thoughtful and a little wistful, never '
            + 'cheerful or comic. No drums, no vocals. Seamless loop with no fade out.',
    },
    battle_dungeon_synth_pulse: {
        lengthMs: 60000,
        prompt: 'Dungeon synth instrumental with a slow pulse. Lo-fi, minimalist medieval fantasy music on warm '
            + 'vintage synthesizers: soft analog pads, a modal synth harp and synth brass melody, a low drone, and '
            + 'a soft slow timpani-like pulse underneath giving gentle tension, like a 1990s fantasy role-playing '
            + 'game battle theme played quietly. Earnest and atmospheric. No guitars, no vocals. '
            + 'Seamless loop with no fade out.',
    },
    // The fight loop, third direction: calm, light retro-fantasy for a relaxed
    // dice-and-card puzzle crawler (Taya's reference: Slice & Dice).
    battle_mellow: {
        lengthMs: 60000,
        prompt: 'Calm, light retro fantasy background music for a relaxed turn-based dice and card puzzle game. '
            + 'Mellow and gently upbeat: soft chiptune-inspired synth plucks, warm analog pads, a relaxed bouncy '
            + 'bassline and light soft percussion, a simple friendly melody in a major-leaning mode with a touch of '
            + 'fantasy mystery. Unobtrusive and easy to think over, pleasant on repeat for long sessions, sitting '
            + 'under game sound effects. Around 100 BPM. Instrumental, no vocals. Seamless loop, no fade out.',
    },
    battle_mystery: {
        lengthMs: 60000,
        prompt: 'Instrumental fantasy dungeon card battle underscore, 100 BPM. Hand drawn pixel art of mossy stone, muted purple shadows and flickering amber torchlight. Mysterious, alert, quietly adventurous with subtle tension. An interlocking muted lute and low cello ostinato, dry soft frame drum, warm bass, sparse breathy low wooden flute phrases, occasional delicate dulcimer notes with a little room reverb. Modal minor harmony, suspended notes and unresolved question-and-answer motifs; restrained melody, no bright major-key resolution. Measured forward momentum suitable for thoughtful turn-based combat. Intimate small ensemble, atmospheric but clearly rhythmic, moderate energy, spacious enough for game effects. Avoid bouncy folk dances, cheerful tavern tunes, comic pizzicato, tambourine jingles, horror, heavy percussion, bombastic orchestra, rock, EDM, vocals and choir. Begin directly in the groove, subtle variation throughout, loop-minded ending returning to opening harmony, no finale or fade out.',
    },
    boss_mystery: {
        lengthMs: 60000,
        prompt: 'Instrumental fantasy boss encounter game underscore, 110 BPM. A mysterious ancient guardian emerges in a torchlit mossy stone dungeon, stylized pixel art rather than realistic horror. Quiet resolve, lurking magic, controlled suspense and adventure. Insistent low cello and muted plucked-string ostinato, rounded bass, measured soft toms and frame drum, short low woodwind motifs, faint bowed viola harmonics and scattered dulcimer sparks. Minor modal harmony with suspended intervals and unresolved phrases, a memorable enigmatic motif. Slightly stronger pulse than normal combat but restrained dynamics and a small chamber ensemble. Keep room for card clicks and combat sound effects, steady intensity without a cinematic crescendo. Avoid jaunty folk dance, cheerful flute, comic pizzicato, triumphant brass, giant war drums, horror stingers, heavy metal, EDM, vocals and choir. Direct rhythmic opening, repeatable game loop, ending returns to opening pulse without fade out or closing cadence.',
    },
    menu_mystery: {
        lengthMs: 60000,
        prompt: 'Instrumental main menu theme for a fantasy dungeon card game, 76 BPM. Hand drawn pixel art of a moss-covered stone tunnel in muted purple and olive shadows, a small golden light beckoning at the far end. Enigmatic, contemplative, quietly inviting, a sense of hidden rooms and old magic. Sparse muted lute or harp motif, resonant dulcimer single notes, warm low bowed strings, breathy low wooden flute answering in short phrases, subtle soft bass pulse with almost no percussion. Modal minor harmony with suspended chords, gentle unresolved melodic questions, delicate spacious reverb. Balance mystery with warmth; restrained and magical, neither cheerful tavern music nor bleak horror. No bouncy rhythm, bright recorder melody, sentimental ballad, epic orchestral swells, heavy drums, vocals or choir. Establish mood immediately, maintain gentle even energy, loop-minded ending returning to the opening texture and harmony without a finale or fade out.',
    },
    battle_casual: {
        lengthMs: 60000,
        prompt: 'Instrumental background loop for a casual turn-based fantasy card dungeon game with hand drawn pixel art, mossy purple stone and warm torchlight. Small acoustic medieval ensemble: plucked lute, nimble pizzicato strings, mellow wooden flute, warm bass and light frame drum. 104 BPM, gently adventurous, curious and lightly mischievous, minor modal harmony with warm hopeful turns. A restrained repeating rhythmic motif gives card battles momentum while leaving plenty of space for clicks, sword hits and spells. Not a tavern party, not horror, not epic cinema. No heavy drums, aggressive brass, choir, vocals, rock or electronic beat. Consistent moderate energy throughout; no dramatic build, no silence, no introduction or closing flourish. Loopable game underscore, ending on the same groove and harmony as the opening without fade out.',
    },
    boss_casual: {
        lengthMs: 60000,
        prompt: 'Instrumental boss encounter loop for a light casual fantasy card dungeon game. Stylized skeleton kings and goblins in a mossy purple stone dungeon with warm light, charming danger rather than horror. Small medieval chamber ensemble: rhythmic plucked lute and pizzicato strings, mellow cello pulse, wooden flute with a memorable short adventurous motif, soft frame drums and restrained tambourine. 116 BPM. A little more urgent and determined than ordinary combat, playful courage, minor modal harmony with optimistic lifts. Stay light, clear, moderate in dynamics and comfortable during thoughtful turn-based play. No thunderous percussion, epic orchestra, heavy brass, dread drones, metal, vocals or choir. Steady energy with subtle variation, no huge climax, no opening fanfare or ending cadence. Repeatable background loop with end returning naturally to the opening groove, no fade out.',
    },
    menu_casual: {
        lengthMs: 60000,
        prompt: 'Instrumental main menu loop for a cozy casual fantasy card dungeon adventure. Visual setting is a hand drawn pixel art mossy stone tunnel in muted purple and olive, with a welcoming golden light at the far end. Warm intimate acoustic medieval chamber music: gentle fingerpicked lute, soft wooden flute, lightly bowed viola and warm bass, very sparse soft frame drum. 82 BPM. Quiet curiosity, a welcoming invitation to explore, a little fairy tale mystery but reassuring and hopeful. Memorable simple melody related to a plucked-string woodland adventure theme. Never gloomy, mournful, spooky, grandiose or overly cheerful. No vocals, choir, heavy drums, rock or electronic beat. Consistent gentle dynamics, no dramatic intro or finale. Loopable underscore; end flows naturally back to opening harmony and rhythm without fade out.',
    },
    // Second take on the fight loop: lighter, for a casual card-puzzle crawler
    // that is dark fantasy in look but not punishing to play.
    battle_light: {
        lengthMs: 60000,
        prompt: 'Light-hearted dark fantasy adventure music for a cozy, casual card puzzle dungeon crawler. '
            + 'Playful and adventurous with a gentle hint of minor-key mystery, never tense or heavy: a bouncy '
            + 'plucked lute and pizzicato strings, soft frame drum and tambourine, a cheerful recorder or wooden flute '
            + 'melody, warm low bass, medieval folk tavern feel, mid tempo around 105 BPM. Relaxed and pleasant to '
            + 'hear on repeat for long play sessions, sitting under game sound effects. Instrumental, no vocals. '
            + 'Built as a seamless loop: the ending flows straight back into the opening with no fade out.',
    },
    battle: {
        lengthMs: 60000,
        prompt: 'Dark fantasy dungeon battle music for a card-based roguelike. Tense, dark and steady: '
            + 'a low cello and double bass ostinato, soft war drums and a slow heartbeat pulse, sparse dark '
            + 'brass swells, minor key, about 90 BPM. It sits underneath combat sound effects without '
            + 'competing with them. Instrumental, no vocals, no choir. Built as a seamless loop: the ending '
            + 'flows straight back into the opening with no fade out and no final cadence.',
    },
};

async function readKey() {
    const fromEnv = process.env.ELEVENLABS_API_KEY?.trim();
    if (fromEnv) return fromEnv;
    try {
        const fromFile = (await readFile(path.join(homedir(), '.elevenlabs', 'key.txt'), 'utf8')).trim();
        if (fromFile) return fromFile;
    } catch { /* no file */ }
    throw new Error('No ElevenLabs key: set ELEVENLABS_API_KEY or save it to %USERPROFILE%\\.elevenlabs\\key.txt');
}

async function main() {
    const [name, ...rest] = process.argv.slice(2);
    const track = TRACKS[name];
    if (!track) throw new Error(`Name a track: ${Object.keys(TRACKS).join(', ')}`);
    const takesAt = rest.indexOf('--takes');
    const takes = takesAt >= 0 ? Math.max(1, Number(rest[takesAt + 1]) || 1) : 1;

    const key = await readKey();
    await mkdir(OUT_DIR, { recursive: true });
    for (let take = 1; take <= takes; take++) {
        // ElevenLabs answers 429 ("system busy") under heavy traffic; that
        // request costs nothing, so wait and try again a few times.
        let response;
        for (let attempt = 1; ; attempt++) {
            response = await fetch(API, {
                method: 'POST',
                headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
                body: JSON.stringify({ prompt: track.prompt, music_length_ms: track.lengthMs, force_instrumental: true }),
            });
            if (response.status !== 429 || attempt >= 6) break;
            const waitS = 15 * attempt;
            console.log(`busy   ElevenLabs is busy, retrying in ${waitS}s (attempt ${attempt + 1} of 6)`);
            await new Promise((resolve) => setTimeout(resolve, waitS * 1000));
        }
        if (!response.ok) {
            const detail = (await response.text()).slice(0, 400);
            throw new Error(`ElevenLabs answered ${response.status}: ${detail}`);
        }
        const audio = Buffer.from(await response.arrayBuffer());
        // Never over an earlier take: asking for more takes of a track used to
        // restart at _1 and replace the one already auditioned.
        let number = take;
        while (existsSync(path.join(OUT_DIR, `music_${name}_${number}.mp3`))) number += 1;
        const file = path.join(OUT_DIR, `music_${name}_${number}.mp3`);
        await writeFile(file, audio);
        console.log(`saved  ${path.basename(file)}  (${Math.round(audio.length / 1024)} KB)`);
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});

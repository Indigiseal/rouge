// tools/generate-death-sounds.mjs
// Generates enemy death sound takes with the ElevenLabs Sound Effects API from
// the prompts in tools/death-sounds.json, into assets/_sfx_takes/ (ignored by
// git) to be auditioned. The chosen take is copied into assets/music/ by hand,
// or by asking Claude.
//
//   node tools/generate-death-sounds.mjs                 every enemy, 1 take
//   node tools/generate-death-sounds.mjs --enemy goblin  just one enemy
//   node tools/generate-death-sounds.mjs --families      the shared family sounds
//   node tools/generate-death-sounds.mjs --family bones  just one family
//   node tools/generate-death-sounds.mjs --set armor     armor equip sounds
//   node tools/generate-death-sounds.mjs --set pickups   pick-up sounds (crystal...)
//   node tools/generate-death-sounds.mjs --takes 3       more takes each
//   node tools/generate-death-sounds.mjs --force         redo existing takes
//   node tools/generate-death-sounds.mjs --set armor --reprocess
//                         redo tone/reverb/loudness from the kept originals (free)
//
// The API key is read from the ELEVENLABS_API_KEY environment variable, or
// else from %USERPROFILE%\.elevenlabs\key.txt. It is never printed, logged or
// written anywhere else. Each take spends ElevenLabs credits.

import { readFile, writeFile, mkdir, access, rename, unlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = path.join(ROOT, 'tools', 'death-sounds.json');
const OUT_DIR = path.join(ROOT, 'assets', '_sfx_takes');
const API = 'https://api.elevenlabs.io/v1/sound-generation';

// Every take is evened out to sit with the game's hand-made effects: mono, and
// at the loudness of the old enemy_death pair (measured: about -23 LUFS), with
// a limiter so nothing clips. ElevenLabs output ranged from -25 to -2 LUFS,
// up to 20 dB louder than everything else. Needs ffmpeg on the PATH; without
// it the raw take is kept and a warning printed.
const TARGET_LUFS = -23;
const PEAK_LIMIT = 0.794; // -2 dBFS

// Optional room reverb, the tail the hand-made effects have (they ring out
// ~0.8-0.9s; dry ElevenLabs takes stop in ~0.1s and read as flat). The take is
// convolved with tools/audio/stone_room_ir.wav, a small stone room, and the
// reverb mixed under the dry sound at the set's `reverb` amount (0 = off).
const ROOM_IR = path.join(ROOT, 'tools', 'audio', 'stone_room_ir.wav');
const REVERB_TAIL_S = 0.9;

function ffmpeg(args) {
    return spawnSync('ffmpeg', ['-hide_banner', ...args], { encoding: 'utf8' });
}

function measureLufs(file) {
    const run = ffmpeg(['-nostats', '-i', file, '-af', 'ebur128', '-f', 'null', '-']);
    const all = [...String(run.stderr || '').matchAll(/I:\s+(-?[\d.]+) LUFS/g)];
    return all.length ? Number(all[all.length - 1][1]) : null;
}

// A set's tone fix, an ffmpeg filter applied before the reverb: ElevenLabs
// takes of small metal and glass come out almost all treble (centred near
// 10 kHz) and read as hiss; a high shelf brings them back down.
async function applyTone(file, filter) {
    const tmp = `${file}.tone.mp3`;
    const run = ffmpeg(['-v', 'error', '-y', '-i', file, '-af', filter, '-ar', '44100', '-b:a', '128k', tmp]);
    if (run.status !== 0) {
        await unlink(tmp).catch(() => {});
        console.warn('       (could not apply tone: take left as is)');
        return;
    }
    await rename(tmp, file);
}

async function addReverb(file, wet) {
    const tmp = `${file}.rev.mp3`;
    const graph = `[0:a]aformat=channel_layouts=mono,apad=pad_dur=${REVERB_TAIL_S},asplit[dry][send];`
        + `[send][1:a]afir=dry=10:wet=10[room];`
        + `[dry][room]amix=inputs=2:weights='1 ${wet}':normalize=0`;
    const run = ffmpeg(['-v', 'error', '-y', '-i', file, '-i', ROOM_IR, '-filter_complex', graph,
        '-ar', '44100', '-b:a', '128k', tmp]);
    if (run.status !== 0) {
        await unlink(tmp).catch(() => {});
        console.warn('       (could not add reverb: take left dry)');
        return;
    }
    await rename(tmp, file);
}

async function evenOut(file, reverb = 0, tone = null) {
    if (tone) await applyTone(file, tone);
    if (reverb > 0) await addReverb(file, reverb);
    const lufs = measureLufs(file);
    if (lufs === null) {
        console.warn('       (ffmpeg not found or failed: take left as generated)');
        return;
    }
    const tmp = `${file}.tmp.mp3`;
    const run = ffmpeg(['-v', 'error', '-y', '-i', file, '-ac', '1', '-ar', '44100', '-b:a', '128k',
        '-af', `volume=${(TARGET_LUFS - lufs).toFixed(2)}dB,alimiter=limit=${PEAK_LIMIT}:level=disabled`, tmp]);
    if (run.status !== 0) {
        await unlink(tmp).catch(() => {});
        console.warn('       (could not even out loudness: take left as generated)');
        return;
    }
    await rename(tmp, file);
}

function parseArgs(argv) {
    const args = { family: null, enemy: null, families: false, set: null, takes: 1, force: false };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--family') { args.family = argv[++i]; args.families = true; }
        else if (argv[i] === '--families') args.families = true;
        else if (argv[i] === '--enemy') args.enemy = argv[++i];
        else if (argv[i] === '--set') args.set = argv[++i];
        else if (argv[i] === '--takes') args.takes = Math.max(1, Number(argv[++i]) || 1);
        else if (argv[i] === '--force') args.force = true;
        else if (argv[i] === '--reprocess') args.reprocess = true;
    }
    return args;
}

async function readKey() {
    const fromEnv = process.env.ELEVENLABS_API_KEY?.trim();
    if (fromEnv) return fromEnv;
    try {
        const fromFile = (await readFile(path.join(homedir(), '.elevenlabs', 'key.txt'), 'utf8')).trim();
        if (fromFile) return fromFile;
    } catch { /* no file */ }
    throw new Error('No ElevenLabs key: set ELEVENLABS_API_KEY or save it to %USERPROFILE%\\.elevenlabs\\key.txt');
}

const exists = (file) => access(file).then(() => true, () => false);
const rawFile = (file) => file.replace(/\.mp3$/, '.raw.mp3');

async function generate(key, text, durationSeconds, promptInfluence) {
    const response = await fetch(API, {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({
            text,
            duration_seconds: durationSeconds,
            prompt_influence: promptInfluence,
        }),
    });
    if (!response.ok) {
        // The body explains quota and wording problems; it never holds the key.
        const detail = (await response.text()).slice(0, 300);
        throw new Error(`ElevenLabs answered ${response.status}: ${detail}`);
    }
    return Buffer.from(await response.arrayBuffer());
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const config = JSON.parse(await readFile(CONFIG, 'utf8'));
    // Per-enemy sounds by default; the shared family sounds with --families;
    // another set (armor) by name with --set, its takes named <set>_<name>.
    const pool = args.set ? config[args.set] : (args.families ? config.families : config.enemies);
    if (!pool) throw new Error(`No set named "${args.set}" in death-sounds.json`);
    const prefix = args.set || 'death';
    const reverbFor = Number(config.reverb?.[prefix]) || 0;
    const toneFor = config.tone?.[prefix] || null;
    const pick = args.families ? args.family : args.enemy;
    const jobs = Object.entries(pool).filter(([name]) => !pick || name === pick);
    if (!jobs.length) throw new Error(`Nothing named "${pick}" in death-sounds.json`);

    const key = await readKey();
    await mkdir(OUT_DIR, { recursive: true });

    let made = 0;
    for (const [name, entry] of jobs) {
        const prompt = typeof entry === 'string' ? entry : entry.prompt;
        const text = `${prompt}. ${config.style}`;
        // ElevenLabs refuses anything over 450 characters, prompt and style
        // together; say so plainly instead of spending a failed request.
        if (text.length > 450) {
            console.error(`skip   ${name}: description is ${text.length} characters, the limit is 450 - shorten it`);
            continue;
        }
        for (let take = 1; take <= args.takes; take++) {
            const file = path.join(OUT_DIR, `${prefix}_${name}_${take}.mp3`);
            if (args.reprocess) {
                // Redo tone, reverb and loudness from the kept original; no API call.
                if (!await exists(rawFile(file))) { console.log(`skip   ${path.basename(file)} (no original kept)`); continue; }
                await writeFile(file, await readFile(rawFile(file)));
                await evenOut(file, reverbFor, toneFor);
                made++;
                console.log(`redone ${path.basename(file)}`);
                continue;
            }
            if (!args.force && await exists(file)) {
                console.log(`skip   ${path.basename(file)} (exists; --force to redo)`);
                continue;
            }
            // A set can ask the model to follow its wording more closely.
            const influence = config.setInfluence?.[prefix] ?? config.promptInfluence;
            // An entry written as { prompt, durationSeconds } gets its own
            // length (a wolf's howl needs longer than a crunch); a plain string
            // uses the shared one.
            const seconds = (typeof entry === 'object' && entry.durationSeconds) || config.durationSeconds;
            const audio = await generate(key, text, seconds, influence);
            // The untouched take is kept beside the finished one, so the tone,
            // reverb or loudness can be redone later with --reprocess, free.
            await writeFile(rawFile(file), audio);
            await writeFile(file, audio);
            await evenOut(file, reverbFor, toneFor);
            made++;
            console.log(`saved  ${path.basename(file)}  (${Math.round(audio.length / 1024)} KB)`);
        }
    }
    console.log(`\nDone: ${made} new take(s) in assets/_sfx_takes/`);
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});

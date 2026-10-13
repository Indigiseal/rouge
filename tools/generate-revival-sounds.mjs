// Generate short revival auditions; does not register sounds in the game.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const takes = path.join(root, 'assets', '_sfx_takes');
const variants = [
    { name: 'chime', seconds: 3.5, prompt: 'A single mystical revival sound for a fantasy dungeon game. A soft warm bell blooms into three ascending crystal chime notes, resolving gently with a shimmering stone-room reverb tail. Life returning, ancient healing magic, reassuring but mysterious. Clear immediate onset, delicate rounded tone, brief natural decay. Isolated sound, no background music, no voices, no harsh treble, no triumphant fanfare.' },
    { name: 'tune', seconds: 4, prompt: 'Short instrumental resurrection cue for a fantasy dungeon game. A delicate four-note ascending harp phrase answered by a warm celesta note and a very soft bowed-string swell. An intimate little mystical tune suggesting breath and life returning, gently hopeful with a hint of ancient mystery. Starts immediately and ends with a natural reverberant decay. No vocals, no drums, no full song, no grand victory fanfare.' },
    { name: 'shimmer', seconds: 3.5, prompt: 'Isolated magical revival sound in an atmospheric fantasy game. A low soft resonant pulse rises through a smooth airy shimmer, opening into one clear warm singing-bowl chime with faint sparkling overtones and a gentle room-reverb decay. A soul returning to the body, mystical and reassuring, subtle power. Immediate soft onset, natural fading tail. No voices, no choir, no music bed, no sci-fi laser, no harsh impact.' },
];

async function main() {
    const key = process.env.ELEVENLABS_API_KEY?.trim()
        || (await readFile(path.join(homedir(), '.elevenlabs', 'key.txt'), 'utf8')).trim();
    await mkdir(takes, { recursive: true });
    for (const variant of variants) {
        const output = path.join(takes, `revival_${variant.name}_1.mp3`);
        if (await access(output).then(() => true, () => false)) {
            console.log(`Already exists: ${path.basename(output)}`);
            continue;
        }
        const request = { text: variant.prompt, duration_seconds: variant.seconds,
            prompt_influence: 0.5, model_id: 'eleven_text_to_sound_v2' };
        const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
            method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
            body: JSON.stringify(request),
        });
        if (!response.ok) throw new Error(`ElevenLabs ${response.status}: ${(await response.text()).slice(0, 600)}`);
        const raw = output.replace('.mp3', '.raw.mp3');
        await writeFile(raw, Buffer.from(await response.arrayBuffer()));
        await writeFile(output.replace('.mp3', '.request.json'), JSON.stringify(request, null, 2));
        const exportAudio = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
            '-i', raw, '-af', 'loudnorm=I=-23:TP=-2:LRA=7', '-ar', '44100', '-b:a', '192k', output], { encoding: 'utf8' });
        if (exportAudio.status !== 0) throw new Error(`Export failed; raw audio retained: ${exportAudio.stderr}`);
        console.log(`Saved ${path.basename(output)}`);
    }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

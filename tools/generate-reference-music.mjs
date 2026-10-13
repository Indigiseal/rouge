// Audition new music conditioned on uploaded original game recordings.
// Upload responses with extracted v2 plans live in the ignored takes directory.
// Usage: node tools/generate-reference-music.mjs menu|boss|battle|elite
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function main() {
    const name = process.argv[2];
    if (!['menu', 'boss', 'battle', 'elite'].includes(name)) throw new Error('Choose menu, boss, battle or elite.');
    const takes = path.join(root, 'assets', '_sfx_takes');
    const referenceName = ['battle', 'elite'].includes(name) ? 'boss' : name;
    const reference = JSON.parse(await readFile(path.join(takes, `reference_original_${referenceName}.plan.json`), 'utf8'));
    const key = process.env.ELEVENLABS_API_KEY?.trim()
        || (await readFile(path.join(homedir(), '.elevenlabs', 'key.txt'), 'utf8')).trim();
    const chunks = reference.composition_plan.chunks.map((chunk, index) => ({
        ...chunk,
        text: `[Instrumental ${index + 1}]`,
        duration_ms: name === 'menu' ? 30000 : 20000,
        conditioning_ref: { song_id: reference.song_id, range: { start_ms: 0, end_ms: 29000 } },
        condition_strength: 'high',
        context_adherence: 'high',
        positive_styles: [...chunk.positive_styles, 'instrumental fantasy game background music',
            'match the reference instrumentation, mood, pace and production',
            'restrained dynamics suitable for repeated game listening'],
        negative_styles: [...new Set([...(chunk.negative_styles || []), 'vocals', 'cheerful tavern dance'])],
    }));
    if (name === 'battle' || name === 'elite') {
        const elite = name === 'elite';
        const positive = ['instrumental', 'cinematic fantasy dungeon game underscore',
            'match the reference orchestral timbre, spacious production and mysterious mood',
            'warm low strings', 'subtle low drone', 'measured rhythmic percussion',
            'suspended minor harmony', 'short restrained melodic phrases',
            'steady repeatable groove with subtle variation',
            elite ? 'controlled tension, firmer drums and cello ostinato, restrained string swells' : 'moderate low intensity, soft rounded drums and gently pulsing strings',
            elite ? 'a dangerous encounter, more urgent than regular combat but below boss intensity' : 'thoughtful regular turn-based battles, alert but not overwhelming',
            'begin directly in the groove and return to opening texture without a finale or fade'];
        const negative = ['vocals', 'choir', 'cheerful tavern dance', 'bouncy lute',
            'bright playful flute', 'epic climax', 'booming war drums', 'blaring brass',
            'horror stingers', 'rock', 'EDM', 'dramatic intro', 'final cadence'];
        chunks.splice(0, chunks.length, ...[0, 1].map(index => ({
            text: `[Instrumental ${index + 1}]`, duration_ms: 30000,
            positive_styles: positive, negative_styles: negative,
            context_adherence: 'high', condition_strength: 'high',
            // Use the restrained opening/build rather than the boss climax.
            conditioning_ref: { song_id: reference.song_id, range: { start_ms: 0, end_ms: elite ? 20000 : 10000 } },
        })));
    }
    const request = { model_id: 'music_v2_5', composition_plan: { chunks } };
    await writeFile(path.join(takes, `music_${name}_original_reference.request.json`), JSON.stringify(request, null, 2));
    const response = await fetch('https://api.elevenlabs.io/v1/music', {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`ElevenLabs ${response.status}: ${(await response.text()).slice(0, 1200)}`);
    const audio = Buffer.from(await response.arrayBuffer());
    const output = path.join(takes, `music_${name}_original_reference_1.mp3`);
    await writeFile(output, audio);
    console.log(`Saved ${path.basename(output)} (${Math.round(audio.length / 1024)} KB)`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

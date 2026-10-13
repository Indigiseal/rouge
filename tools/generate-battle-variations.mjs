// Four distinct audition directions. No changes to game asset mappings.
// node tools/generate-battle-variations.mjs battle_lantern|battle_clockwork|elite_warden|elite_arcane
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const originalStyle = ['instrumental cinematic orchestral fantasy game music',
    'preserve the reference sound palette, tempo feel, drum timbres, orchestral balance and spacious production',
    'suspenseful and mysterious with restrained dynamics', 'low orchestral drone',
    'bowed low strings, subtle rhythmic percussion and restrained string swells',
    'same musical genre and production style as the reference, a newly composed piece',
    'new lead melody and new ostinato pitches, do not quote or reuse the reference tune',
    'steady combat underscore, no large climax'];
const directions = {
    battle_theme_rising: {
        reference: true, strength: 'medium', referenceEnd: 12000,
        styles: [...originalStyle, 'regular battle, moderate low intensity',
            'a fresh four-bar lower-string melody, rising a minor third then stepping down with a held suspended note',
            'a quiet independent bass counterline, soft steady drums underneath',
            'develop the new motif gently over changing minor chords'],
    },
    battle_theme_falling: {
        reference: true, strength: 'medium', referenceEnd: 12000,
        styles: [...originalStyle, 'regular battle, moderate low intensity',
            'a fresh descending six-note viola motif with space at the end of each phrase',
            'a new repeated low string figure using different pitches and accents from the reference',
            'soft measured percussion, an understated answering melody in the strings'],
    },
    elite_theme_resolve: {
        reference: true, strength: 'medium', referenceEnd: 20000,
        styles: [...originalStyle, 'elite battle, firmer percussion and medium intensity below the boss',
            'a fresh assertive short string melody opening with a rising fourth and a stepwise answering phrase',
            'a new propulsive low-string ostinato beneath the independent melody',
            'controlled tension and resolve, restrained orchestral swells'],
    },
    elite_theme_shadow: {
        reference: true, strength: 'medium', referenceEnd: 20000,
        styles: [...originalStyle, 'elite battle, firmer percussion and medium intensity below the boss',
            'a fresh winding minor string melody that descends, pauses, then rises in a contrasting answering phrase',
            'a newly composed low-register counter-melody and measured orchestral drum pulse',
            'watchful mysterious tension, subtle harmonic movement and restrained string swells'],
    },
    battle_lantern: {
        reference: true,
        styles: ['instrumental atmospheric fantasy game combat', '92 BPM, flowing six-eight meter',
            'muted viola and cello weaving a new rolling arpeggio',
            'sparse bass clarinet melody with a distinct falling then rising five-note motif',
            'soft brushed frame drum and warm rounded bass',
            'minor modal harmony moving between different chords every two bars',
            'quiet mystery, alert exploration, measured momentum',
            'intimate acoustic chamber production, warm room ambience',
            'regular turn-based battle, comfortable moderate intensity',
            'use the reference only for broad acoustic warmth and spaciousness',
            'a completely fresh melody, meter, rhythm and chord progression'],
    },
    battle_clockwork: {
        styles: ['instrumental mysterious fantasy puzzle combat', '102 BPM, four-four meter',
            'a dry interlocking hammered dulcimer and marimba pattern with subtle syncopation',
            'short new alto flute phrases, shaded and thoughtful rather than cheerful',
            'warm sustained viola behind a lightly plucked double bass',
            'small soft hand drum and restrained woodblock accents',
            'suspended minor chords with gentle harmonic movement',
            'curious ancient mechanisms and torchlit stone rooms',
            'understated rhythm, moderate dynamics, roomy natural acoustic production',
            'distinctive sparse chamber arrangement, not folk dance',
            'regular turn-based card battle, measured forward motion'],
    },
    elite_warden: {
        reference: true,
        styles: ['instrumental suspenseful fantasy elite encounter', '108 BPM, asymmetrical five-four meter',
            'a new repeating cello figure with a three-plus-two rhythmic grouping',
            'muted low horn answering low woodwinds in a short independent melody',
            'restrained hand drums and dry rim accents supporting the irregular pulse',
            'viola harmonics and soft bass sustaining mysterious modal harmony',
            'controlled urgency and resolve, stronger than regular combat',
            'warm acoustic chamber-orchestral sound with spacious reverb',
            'use the reference only for broad atmospheric texture and low orchestral warmth',
            'completely fresh melody, rhythm, meter and harmonic sequence',
            'steady medium intensity, below a boss finale'],
    },
    elite_arcane: {
        styles: ['instrumental magical fantasy elite battle', '114 BPM, four-four meter',
            'a distinct syncopated low string ostinato with deliberate rests',
            'soft glassy celesta and dulcimer playing an enigmatic three-note motif',
            'rounded deep hand drums with a restrained offbeat pulse',
            'bass clarinet and bowed viola answering the motif',
            'changing minor harmony, suspended chords and restrained dissonance resolving gently',
            'ancient magic, watchful tension, courage, measured momentum',
            'intimate acoustic soundtrack with shimmering texture and natural room depth',
            'steady medium intensity, distinct from cinematic battle drums',
            'clear space between phrases for game sound effects'],
    },
};

async function main() {
    const name = process.argv[2];
    const direction = directions[name];
    if (!direction) throw new Error(`Choose ${Object.keys(directions).join(', ')}`);
    const out = path.join(root, 'assets', '_sfx_takes');
    await mkdir(out, { recursive: true });
    const key = process.env.ELEVENLABS_API_KEY?.trim()
        || (await readFile(path.join(homedir(), '.elevenlabs', 'key.txt'), 'utf8')).trim();
    const negative = ['vocals', 'choir', 'cheerful tavern dance', 'bouncy folk music',
        'epic climax', 'thunderous war drums', 'blaring brass', 'horror stingers',
        'heavy rock', 'EDM', 'long intro', 'final cadence', 'fade out'];
    const chunks = [0, 1].map(index => ({
        text: `[Instrumental ${index + 1}]`, duration_ms: 30000,
        positive_styles: [...direction.styles,
            'establish the pulse immediately, vary subtly, end on the opening groove for looping'],
        negative_styles: negative, context_adherence: 'high',
    }));
    if (direction.reference) {
        const reference = JSON.parse(await readFile(path.join(out, 'reference_original_boss.plan.json'), 'utf8'));
        // Medium guidance retains the original sound while requesting new motifs.
        chunks[0].conditioning_ref = { song_id: reference.song_id, range: { start_ms: 0, end_ms: direction.referenceEnd ?? 6000 } };
        chunks[0].condition_strength = direction.strength ?? 'low';
    }
    const request = { model_id: 'music_v2_5', composition_plan: { chunks } };
    await writeFile(path.join(out, `music_${name}.request.json`), JSON.stringify(request, null, 2));
    const response = await fetch('https://api.elevenlabs.io/v1/music', {
        method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`ElevenLabs ${response.status}: ${(await response.text()).slice(0, 1000)}`);
    const audio = Buffer.from(await response.arrayBuffer());
    await writeFile(path.join(out, `music_${name}_1.mp3`), audio);
    console.log(`Saved music_${name}_1.mp3 (${Math.round(audio.length / 1024)} KB)`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

// Verify actual generated cmaps AND their font hashes, for every locale and
// every reading/feedback weight. No guessed Unicode ranges or bitmap fallback.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fontCorpus } from './font-corpus.mjs';
import { SCRIPT_FAMILIES } from '../src/ui/fontFamilies.js';

const root = new URL('../assets/fonts/ui/', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('coverage.json', root)));
const { corpus, supported } = fontCorpus();
const requested = process.argv.slice(2);
const locales = requested.length ? [...new Set([...supported, ...requested])] : Object.keys(corpus);
let failures = 0;
for (const [name, entry] of Object.entries(manifest.fonts)) {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(new URL(entry.file, root))).digest('hex');
    if (hash !== entry.sha256) { console.error(name + ': stale coverage manifest'); failures++; }
    entry.glyphs = new Set(entry.codepoints);
}
for (const locale of locales) {
    if (!corpus[locale]) { console.error('No corpus for ' + locale); failures++; continue; }
    for (const [role, weight] of [['reading', 500], ['feedback', 600], ['feedback', 700]]) {
        const script = SCRIPT_FAMILIES[locale];
        const names = [role + '-' + weight, ...(script ? [role + '-' + script + '-' + weight] : []), 'symbols', 'icons', 'reading-500'];
        const glyphs = new Set(names.flatMap(name => manifest.fonts[name]?.codepoints || []));
        const content = (corpus[locale] || []).join('') + corpus.en.join('');
        const missing = [...new Set([...content].filter(ch => !/\s/u.test(ch) && !glyphs.has(ch.codePointAt(0))))];
        if (missing.length) {
            failures++;
            console.error(locale + ' ' + role + ' ' + weight + ': missing ' + missing.join(' '));
        }
    }
}
if (failures) {
    console.error('Rebuild fonts with python tools/build-ui-fonts.py after extending translations or font sources.');
    process.exitCode = 1;
} else console.log('Font coverage passed: ' + locales.join(', ') + ' (both roles and all weights; font hashes verified).');

// Finds player-facing English text that has no translation yet.
//
//   node tools/audit-localization.mjs                   summary per language and per source
//   node tools/audit-localization.mjs --list            every missing string, grouped by source
//   node tools/audit-localization.mjs --json out.json   the same, as JSON, for handing to a translator
//
// The game translates by exact English text: STRINGS holds keyed UI text (npm run test:i18n checks
// it), and the side tables (EVENT_NARRATIVE_TRANSLATIONS, EXACT_NAME_TRANSLATIONS,
// DESCRIPTION_TRANSLATIONS, EVENT_TITLE_TRANSLATIONS) map a whole English sentence to its
// translation. Content that is written straight into files, such as stories, sigil rules, amulet
// names and enemy names, only shows in another language if its exact text is in one of them.
// This reads that content and reports what no table has for es, fr and ru (the shipped languages).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['es', 'fr', 'ru'];

// The translation tables, read the way tools/validate-i18n.mjs reads them.
let source = fs.readFileSync(path.join(root, 'src/i18n/i18n.js'), 'utf8');
const HOIST = ['STRINGS', 'EVENT_NARRATIVE_TRANSLATIONS', 'EXACT_NAME_TRANSLATIONS', 'DESCRIPTION_TRANSLATIONS',
    'EVENT_TITLE_TRANSLATIONS', 'TEXT_ALIASES'];
source = source.replace(/export\s+(?=(const|function|class))/g, '');
for (const name of HOIST) source = source.replace(`const ${name} =`, `globalThis.${name} =`);
const ctx = {};
vm.runInNewContext(source, ctx, { filename: 'i18n.js' });
const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
const known = Object.fromEntries(LANGS.map((lang) => {
    const set = new Set();
    for (const table of ['EVENT_NARRATIVE_TRANSLATIONS', 'EXACT_NAME_TRANSLATIONS', 'DESCRIPTION_TRANSLATIONS', 'EVENT_TITLE_TRANSLATIONS']) {
        for (const key of Object.keys(ctx[table]?.[lang] || {})) set.add(norm(key));
    }
    // Keyed UI text: its English value counts as known when the language has that key.
    for (const [key, value] of Object.entries(ctx.STRINGS?.en || {})) if (key in (ctx.STRINGS[lang] || {})) set.add(norm(value));
    for (const [text, key] of Object.entries(ctx.TEXT_ALIASES || {})) if (key in (ctx.STRINGS[lang] || {})) set.add(norm(text));
    return [lang, set];
}));

// What to read.
const found = new Map();   // normalized text -> { text, sources: Set }
function add(text, from) {
    if (typeof text !== 'string') return;
    const clean = norm(text);
    if (clean.length < 3 || !/[A-Za-z]{3}/.test(clean) || /^[a-z_]+$/.test(clean) || /^[\w./-]+\.(png|mp3|json)$/.test(clean)) return;
    if (!found.has(clean)) found.set(clean, { text, sources: new Set() });
    found.get(clean).sources.add(from);
}
function walk(value, from, keys, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 8) return;
    for (const [key, inner] of Object.entries(value)) {
        if (typeof inner === 'string' && keys.has(key)) add(inner, from);
        else if (typeof inner === 'function' && keys.has(key)) {
            // outcome(): its English sentences are quoted inside the function
            for (const m of inner.toString().matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
                const lit = m[2].replace(/\\n/g, '\n').replace(/\\'/g, "'");
                if (/[a-z]{3,} [a-z]{2,}/i.test(lit) && !lit.includes('${')) add(lit, from);
            }
        } else if (typeof inner === 'object') walk(inner, from, keys, depth + 1);
    }
}
const TEXT_KEYS = new Set(['title', 'description', 'text', 'outcome', 'name', 'desc', 'summary', 'rule', 'enemy', 'player', 'label', 'flavor', 'body']);
async function load(file) {
    try { return await import(pathToFileURL(path.join(root, file)).href); } catch (err) { return { __error: err.message }; }
}
const skipped = [];
async function readModule(file, keys = TEXT_KEYS) {
    const mod = await load(file);
    if (mod.__error) { skipped.push(`${file}: ${mod.__error.split('\n')[0]}`); return; }
    for (const value of Object.values(mod)) walk(value, file, keys);
}

globalThis.Phaser ??= { Scene: class {}, Math: {}, BlendModes: {}, Display: { Color: {} } };
const dir = (rel) => fs.readdirSync(path.join(root, rel)).filter((f) => f.endsWith('.js')).map((f) => `${rel}/${f}`);

for (const f of dir('src/content/events')) await readModule(f);
for (const f of ['src/content/sigils/sigils.js', 'src/content/cards/magic.js', 'src/content/cards/bosses.js',
    'src/content/cards/enemies.js', 'src/content/cards/companions.js', 'src/content/cards/robbers.js',
    'src/content/cards/crystalSpiders.js', 'src/content/cards/potions.js', 'src/content/cards/food.js',
    'src/content/story/StormStories.js', 'src/content/amulets/sandspicePouch.js', 'src/content/amulets/mossyStone.js',
    'src/content/amulets/sandglassScarab.js', 'src/content/amulets/locationIdentities.js', 'src/content/amulets/RelicsOthersAtlas.js',
    'src/content/balance/WeaponEnchants.js']) {
    if (fs.existsSync(path.join(root, f))) await readModule(f);
}
for (const base of ['src/content/location-packs']) {
    for (const pack of fs.readdirSync(path.join(root, base))) {
        const index = `${base}/${pack}/index.js`;
        if (fs.existsSync(path.join(root, index))) await readModule(index);
        const enemies = `${base}/${pack}/enemies`;
        if (fs.existsSync(path.join(root, enemies))) for (const f of dir(enemies)) await readModule(f);
    }
}
// Amulet catalogs are class bodies, not data: read their name and description literals.
for (const f of ['src/content/amulets/currentCatalog.js', 'src/content/amulets/legacyCatalog.js']) {
    const text = fs.readFileSync(path.join(root, f), 'utf8');
    for (const m of text.matchAll(/\b(?:name|description)\s*:\s*(['"])((?:\\.|(?!\1)[^\\\n])*)\1/g)) add(m[2].replace(/\\'/g, "'"), f);
}

// Report.
const missing = Object.fromEntries(LANGS.map((lang) => [lang, []]));
// "Name+" (an upgraded amulet) translates as "Name" plus the "+" (translateItemName).
const isKnown = (lang, key) => known[lang].has(key) || (key.endsWith('+') && known[lang].has(key.slice(0, -1)));
for (const [key, entry] of found) {
    for (const lang of LANGS) if (!isKnown(lang, key)) missing[lang].push(entry);
}
const bySource = (list) => {
    const out = {};
    for (const entry of list) for (const s of entry.sources) (out[s] ||= []).push(entry.text);
    return out;
};
if (process.argv.includes('--json')) {
    const file = process.argv[process.argv.indexOf('--json') + 1];
    fs.writeFileSync(file, JSON.stringify(Object.fromEntries(LANGS.map((l) => [l, bySource(missing[l])])), null, 2));
    console.log(`wrote ${file}`);
}
console.log(`${found.size} English strings read from content.`);
for (const lang of LANGS) {
    console.log(`\n${lang}: ${missing[lang].length} without a translation`);
    const groups = bySource(missing[lang]);
    for (const [src, list] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length)) {
        console.log(`  ${String(list.length).padStart(4)}  ${src}`);
        if (process.argv.includes('--list')) list.forEach((text) => console.log(`        ${text.replace(/\n/g, ' / ').slice(0, 140)}`));
    }
}
if (skipped.length) console.log(`\nCould not read (${skipped.length}):\n  ${skipped.join('\n  ')}`);

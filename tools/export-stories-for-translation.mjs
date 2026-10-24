// Writes the stories that still have no translation into one JSON file for a translator.
//
//   node tools/export-stories-for-translation.mjs [out.json]
//
// Each entry keeps its place in the story (the event, then its title, description and each choice's
// text and outcome, in play order), so a translator sees what the sentence is part of. The text is
// the exact English the game matches on: a translation is stored against it, so it must come back
// character for character in the "en" field.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || path.join(root, 'docs/localization/stories-to-translate.json');
const LANGS = ['es', 'fr', 'ru'];

let source = fs.readFileSync(path.join(root, 'src/i18n/i18n.js'), 'utf8');
source = source.replace(/export\s+(?=(const|function|class))/g, '');
for (const name of ['STRINGS', 'EVENT_NARRATIVE_TRANSLATIONS', 'EXACT_NAME_TRANSLATIONS', 'DESCRIPTION_TRANSLATIONS', 'EVENT_TITLE_TRANSLATIONS']) {
    source = source.replace(`const ${name} =`, `globalThis.${name} =`);
}
const ctx = {};
vm.runInNewContext(source, ctx, { filename: 'i18n.js' });
const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
const known = Object.fromEntries(LANGS.map((lang) => {
    const set = new Set();
    for (const table of ['EVENT_NARRATIVE_TRANSLATIONS', 'EXACT_NAME_TRANSLATIONS', 'DESCRIPTION_TRANSLATIONS', 'EVENT_TITLE_TRANSLATIONS']) {
        for (const key of Object.keys(ctx[table]?.[lang] || {})) set.add(norm(key));
    }
    return [lang, set];
}));
const needed = (text) => LANGS.some((lang) => !known[lang].has(norm(text)));

globalThis.Phaser ??= { Scene: class {}, Math: {}, BlendModes: {}, Display: { Color: {} } };
const seen = new Set();
const entries = [];
function push(file, where, kind, text, extra = {}) {
    if (typeof text !== 'string' || !/[A-Za-z]{3}/.test(text) || !needed(text)) return;
    const key = norm(text);
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ id: entries.length + 1, story: path.basename(file, '.js'), where, kind, en: text, ...extra });
}
function literalsOf(fn) {
    const found = [];
    for (const m of fn.toString().matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
        const lit = m[2].replace(/\\n/g, '\n').replace(/\\'/g, "'");
        if (/[a-z]{3,} [a-z]{2,}/i.test(lit) && !lit.includes('${')) found.push(lit);
    }
    return found;
}
function readChoices(file, choices, trail) {
    (choices || []).forEach((choice, i) => {
        const where = `${trail} > choice ${i + 1}`;
        push(file, where, 'choice button', choice.text);
        if (typeof choice.outcome === 'string') push(file, where, 'outcome', choice.outcome);
        else if (typeof choice.outcome === 'function') literalsOf(choice.outcome).forEach((lit) => push(file, where, 'outcome (one of several, chosen by the game)', lit));
        if (typeof choice.text === 'function') literalsOf(choice.text).forEach((lit) => push(file, where, 'choice button (varies)', lit));
        if (choice.next?.choices) readChoices(file, choice.next.choices, `${where} > then`);
    });
}
function readEvent(file, event) {
    if (!event || typeof event !== 'object' || !Array.isArray(event.choices)) return;
    push(file, event.id || 'event', 'title', event.title);
    if (typeof event.description === 'string') push(file, event.id || 'event', 'description', event.description);
    else if (typeof event.description === 'function') literalsOf(event.description).forEach((lit) => push(file, event.id || 'event', 'description (varies)', lit));
    readChoices(file, event.choices, event.id || 'event');
}
async function load(file) {
    try { return await import(pathToFileURL(path.join(root, file)).href); } catch { return {}; }
}
const files = fs.readdirSync(path.join(root, 'src/content/events')).filter((f) => f.endsWith('.js') && f !== 'index.js')
    .map((f) => `src/content/events/${f}`);
for (const pack of fs.readdirSync(path.join(root, 'src/content/location-packs'))) {
    const index = `src/content/location-packs/${pack}/index.js`;
    if (fs.existsSync(path.join(root, index))) files.push(index);
}
for (const file of files) {
    const mod = await load(file);
    for (const value of Object.values(mod)) {
        if (value?.choices) readEvent(file, value);
        else if (value && typeof value === 'object') {
            for (const inner of Object.values(value)) if (inner?.choices) readEvent(file, inner);
            for (const inner of Array.isArray(value.events) ? value.events : []) readEvent(file, inner);
        }
    }
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(entries, null, 2));
console.log(`${entries.length} story strings with no translation yet -> ${path.relative(root, out)}`);
const byStory = {};
for (const e of entries) byStory[e.story] = (byStory[e.story] || 0) + 1;
console.log(Object.entries(byStory).map(([s, n]) => `  ${String(n).padStart(3)}  ${s}`).join('\n'));

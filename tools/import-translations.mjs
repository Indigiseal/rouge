// Puts finished translations into src/i18n/i18n.js.
//
//   node tools/import-translations.mjs <source.json> <translations.json> [--table narrative|names|descriptions]
//
// <source.json> is what tools/export-stories-for-translation.mjs wrote (entries with an id and the
// exact English in "en"). <translations.json> is the translator's answer: a list of
// { "id": 12, "es": "...", "fr": "...", "ru": "..." }. The English is taken from the source file by
// id, never from the answer, so a translator cannot change what the game matches on.
//
// The result is a generated block inside i18n.js, between the two marker comments, one block per
// import, so an import can be redone. It checks that every id is present in all three languages, that
// the {placeholders} and the line breaks match the English, and refuses to write otherwise.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [sourceFile, answerFile] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const tableFlag = process.argv.indexOf('--table');
const TABLES = { narrative: 'EVENT_NARRATIVE_TRANSLATIONS', names: 'EXACT_NAME_TRANSLATIONS', descriptions: 'DESCRIPTION_TRANSLATIONS' };
const table = TABLES[tableFlag > 0 ? process.argv[tableFlag + 1] : 'narrative'];
if (!sourceFile || !answerFile || !table) {
    console.error('usage: node tools/import-translations.mjs <source.json> <translations.json> [--table narrative|names|descriptions]');
    process.exit(1);
}
const LANGS = ['es', 'fr', 'ru'];
const source = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
const answer = JSON.parse(fs.readFileSync(answerFile, 'utf8'));
const byId = new Map(source.map((entry) => [entry.id, entry]));
const placeholders = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const breaks = (text) => (String(text).match(/\n/g) || []).length;

const problems = [];
const done = new Map();
for (const row of answer) {
    const entry = byId.get(row.id);
    if (!entry) { problems.push(`id ${row.id}: not in the source file`); continue; }
    for (const lang of LANGS) {
        const text = row[lang];
        if (typeof text !== 'string' || !text.trim()) { problems.push(`id ${row.id}: no ${lang} translation`); continue; }
        if (placeholders(text) !== placeholders(entry.en)) problems.push(`id ${row.id} ${lang}: {placeholders} differ from the English`);
        if (breaks(text) !== breaks(entry.en)) problems.push(`id ${row.id} ${lang}: ${breaks(text)} line breaks, the English has ${breaks(entry.en)}`);
    }
    done.set(entry.en, row);
}
const missing = source.filter((entry) => !done.has(entry.en)).map((entry) => entry.id);
if (missing.length) problems.push(`not translated yet: ids ${missing.join(', ')}`);
if (problems.length) {
    console.error(`Nothing written. ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
    process.exit(1);
}

const lit = (text) => JSON.stringify(text).split(String.fromCharCode(0x2028)).join('\u2028').split(String.fromCharCode(0x2029)).join('\u2029');
const stamp = path.basename(answerFile);
let block = `// >>> imported ${stamp} (tools/import-translations.mjs)\n`;
for (const lang of LANGS) {
    block += `Object.assign(${table}.${lang}, {\n`;
    for (const [en, row] of done) block += `    ${lit(en)}: ${lit(row[lang])},\n`;
    block += '});\n';
}
block += `// <<< imported ${stamp}\n`;

const file = path.join(root, 'src/i18n/i18n.js');
let text = fs.readFileSync(file, 'utf8');
const eol = text.includes('\r\n') ? '\r\n' : '\n';
text = text.replace(/\r\n/g, '\n');
const open = `// >>> imported ${stamp} `;
const start = text.indexOf(open);
if (start >= 0) {
    const end = text.indexOf(`// <<< imported ${stamp}\n`, start);
    text = text.slice(0, start) + block + text.slice(end + `// <<< imported ${stamp}\n`.length);
} else {
    // Before the next table that follows the narrative translations.
    const anchor = text.indexOf('const TOLLROAD_STORY_STRINGS');
    if (anchor < 0) { console.error('could not find where to put the block in i18n.js'); process.exit(1); }
    text = text.slice(0, anchor) + block + '\n' + text.slice(anchor);
}
fs.writeFileSync(file, text.replace(/\n/g, eol));
console.log(`Wrote ${done.size} translations x ${LANGS.length} languages into ${table} (src/i18n/i18n.js).`);

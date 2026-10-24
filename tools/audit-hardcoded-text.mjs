// Finds English written straight into code that the player sees, with no way to be translated.
//
//   node tools/audit-hardcoded-text.mjs            summary, then every hit by file and line
//   node tools/audit-hardcoded-text.mjs --summary  counts only
//
// Two kinds of hit:
//   "float"   a floating text / feedback / combat-log line whose English t() does not know. t() looks
//             the exact English up in STRINGS and TEXT_ALIASES (and a few number patterns), so a
//             literal that is in none of them is shown in English in every language.
//   "raw"     English handed straight to a text object, button or title: nothing translates it
//             unless the call is wrapped in t().
// It reads source text, so it sees the calls whether or not they run in a given session.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let source = fs.readFileSync(path.join(root, 'src/i18n/i18n.js'), 'utf8');
source = source.replace(/export\s+(?=(const|function|class))/g, '');
for (const name of ['STRINGS', 'TEXT_ALIASES', 'TEXT_PATTERNS']) source = source.replace(`const ${name} =`, `globalThis.${name} =`);
const ctx = {};
vm.runInNewContext(source, ctx, { filename: 'i18n.js' });
const known = (text) => {
    if (ctx.STRINGS.en[text] || ctx.TEXT_ALIASES[text]) return true;
    return (ctx.TEXT_PATTERNS || []).some(([pattern]) => pattern.test(text));
};

const files = [];
(function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { if (entry.name !== 'i18n') walk(full); }
        else if (entry.name.endsWith('.js')) files.push(full);
    }
})(path.join(root, 'src'));

// A string literal, single-line, as the argument right after `argsBefore` commas.
const LIT = String.raw`(['"\`])((?:\\.|(?!\1)[^\\\n])*)\1`;
const arg = (n) => String.raw`(?:[^,()]|\([^()]*\))*,\s*`.repeat(n);
const SINKS = [
    { kind: 'float', re: new RegExp(String.raw`\b(?:createFloatingText|showFeedback|showFloating)\(\s*${arg(2)}${LIT}`, 'g') },
    { kind: 'float', re: new RegExp(String.raw`\baddCombatLog\(\s*${LIT}`, 'g') },
    { kind: 'raw', re: new RegExp(String.raw`\badd\.text\(\s*${arg(2)}${LIT}`, 'g') },
    { kind: 'raw', re: new RegExp(String.raw`\.setText\(\s*${LIT}\s*\)`, 'g') },
    { kind: 'raw', re: new RegExp(String.raw`\b(?:createPaintedButton|createFooterButton|makeFooterButton|createTitle)\(\s*${arg(3)}${LIT}`, 'g') },
    { kind: 'raw', re: new RegExp(String.raw`\b(?:label|title|body|confirmLabel|cancelLabel|message)\s*:\s*${LIT}`, 'g') },
    // tooltip and description lines pushed as plain English
    { kind: 'raw', re: new RegExp(String.raw`\blines\.push\(\s*${LIT}`, 'g') },
    { kind: 'raw', re: new RegExp(String.raw`\bentries\.push\(\s*\{\s*text:\s*${LIT}`, 'g') },
];
const looksEnglish = (text) => /[A-Za-z]{3,}/.test(text.replace(/\$\{[^}]*\}/g, '')) && /\s|^[A-Z]/.test(text.trim()) && !/^[\w.-]+$/.test(text)
    && !/^#?[0-9a-fA-F]{6}$/.test(text) && !/\.(png|mp3|ogg|json|js)$/.test(text);
// A template such as `+${n} coins` is checked as a sample sentence, the way t() would see it.
const sample = (text) => text.replace(/\$\{[^}]*\}/g, '5');

const hits = [];
for (const file of files) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    if (/\/(sandbox|debug)/i.test(rel) || rel.endsWith('DevTools.js') || /Sandbox|DevPanel|TestOptions/.test(rel)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const lineOf = (index) => text.slice(0, index).split('\n').length;
    for (const { kind, re } of SINKS) {
        for (const m of text.matchAll(re)) {
            const literal = m[2];
            if (!looksEnglish(literal)) continue;
            // wrapped in t(...) already? look back a short way on the same line
            const before = text.slice(Math.max(0, m.index - 40), m.index + m[0].length - literal.length - 1);
            if (/\bt\(\s*[^,()]*,\s*$/.test(before) || /translate\w*\(\s*[^,()]*,\s*$/.test(before)) continue;
            if (kind === 'float' && known(sample(literal).replace(/\\'/g, "'"))) continue;
            hits.push({ kind, rel, line: lineOf(m.index), literal });
        }
    }
}

const byFile = {};
for (const hit of hits) (byFile[hit.rel] ||= []).push(hit);
console.log(`${hits.length} hits in ${Object.keys(byFile).length} files (${hits.filter((h) => h.kind === 'float').length} float, ${hits.filter((h) => h.kind === 'raw').length} raw)\n`);
for (const [rel, list] of Object.entries(byFile).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`${String(list.length).padStart(4)}  ${rel}`);
    if (!process.argv.includes('--summary')) {
        for (const h of list) console.log(`        ${String(h.line).padStart(5)} ${h.kind.padEnd(5)} ${h.literal.slice(0, 100)}`);
    }
}

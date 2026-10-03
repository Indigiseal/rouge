import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'src', 'i18n', 'i18n.js');
let source = fs.readFileSync(sourcePath, 'utf8');

// Load the static registry without importing Phaser-dependent game modules.
// Everything this script inspects has to be hoisted onto the sandbox global —
// a plain `const` inside the vm script stays lexically scoped and comes back
// undefined, which is how the side tables were silently skipped when they were
// first checked here.
const HOISTED = [
  'LANGUAGE_OPTIONS', 'STRINGS', 'SUPPORTED_LANGUAGES',
  'RARITY_TRANSLATIONS', 'WEAPON_TRANSLATIONS', 'ARMOR_TRANSLATIONS',
  'GEM_EFFECT_TRANSLATIONS', 'DESCRIPTION_TRANSLATIONS', 'EXACT_NAME_TRANSLATIONS',
];

source = source.replace(/export\s+(?=(const|function|class))/g, '');
for (const name of HOISTED) {
  const declaration = `const ${name} =`;
  if (!source.includes(declaration)) throw new Error(`${name} is no longer declared as a const in i18n.js`);
  source = source.replace(declaration, `globalThis.${name} =`);
}

const context = {};
vm.runInNewContext(source, context, { filename: sourcePath });

const strings = context.STRINGS;
const supported = context.SUPPORTED_LANGUAGES || ['en'];

// A language still being written is not in SUPPORTED_LANGUAGES — the player must
// not be offered a half-translated game. Name it on the command line to see how
// far along it is:  node tools/validate-i18n.mjs de
// Its gaps are reported but do not fail the run, so an unfinished locale cannot
// break the build the way a regression in a shipped one should.
const inProgress = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));

// The tables outside STRINGS that a locale also has to fill before it can ship.
// They are keyed by English source text rather than by dotted key, and nothing
// validated them until German went in half-done and the gap was invisible.
const SIDE_TABLES = {
  RARITY_TRANSLATIONS: context.RARITY_TRANSLATIONS,
  WEAPON_TRANSLATIONS: context.WEAPON_TRANSLATIONS,
  ARMOR_TRANSLATIONS: context.ARMOR_TRANSLATIONS,
  GEM_EFFECT_TRANSLATIONS: context.GEM_EFFECT_TRANSLATIONS,
  DESCRIPTION_TRANSLATIONS: context.DESCRIPTION_TRANSLATIONS,
  EXACT_NAME_TRANSLATIONS: context.EXACT_NAME_TRANSLATIONS,
};

// These tables have no English column — English IS the key — so completeness is
// measured against the language that has the most entries, which is whichever
// one was filled in most recently.
function sideTableReport(language) {
  const rows = [];
  for (const [name, table] of Object.entries(SIDE_TABLES)) {
    if (!table) continue;
    const reference = Object.values(table)
      .reduce((best, locale) => (Object.keys(locale || {}).length > Object.keys(best || {}).length ? locale : best), {});
    const total = Object.keys(reference).length;
    const have = Object.keys(table[language] || {}).length;
    if (have < total) rows.push(`${name}: ${have}/${total}`);
  }
  return rows;
}
const placeholderPattern = /\{([\w]+)\}/g;
const placeholders = (value) => [...String(value).matchAll(placeholderPattern)]
  .map((match) => match[1])
  .sort()
  .join(',');

const english = strings?.en;
if (!english) throw new Error('English locale was not found.');

// Placeholders a translation is allowed to drop, per language. {plural} carries
// an English "s"/"" suffix, which only works for languages that pluralize by
// appending to the stem — Russian picks one of three case forms by number, so it
// has to write the count-agnostic wording and leave the suffix out.
const OPTIONAL_PLACEHOLDERS = {
  ru: new Set(['tooltip.poisonStacks']),
};

let failures = 0;
for (const language of supported) {
  if (language === 'en') continue;
  const locale = strings[language] || {};
  const missing = Object.keys(english).filter((key) => !(key in locale));
  const extra = Object.keys(locale).filter((key) => !(key in english));
  const exempt = OPTIONAL_PLACEHOLDERS[language] || new Set();
  const badPlaceholders = Object.keys(english).filter((key) => (
    key in locale && !exempt.has(key)
      && placeholders(english[key]) !== placeholders(locale[key])
  ));

  if (missing.length || extra.length || badPlaceholders.length) {
    failures += 1;
    console.error(`\n${language}: localization validation failed`);
    if (missing.length) console.error(`  Missing keys (${missing.length}): ${missing.join(', ')}`);
    if (extra.length) console.error(`  Extra keys (${extra.length}): ${extra.join(', ')}`);
    if (badPlaceholders.length) console.error(`  Placeholder mismatches (${badPlaceholders.length}): ${badPlaceholders.join(', ')}`);
  } else {
    const gaps = sideTableReport(language);
    if (gaps.length) {
      failures += 1;
      console.error(`\n${language}: UI strings valid, but shipped tables are short`);
      console.error(`  ${gaps.join('\n  ')}`);
    } else {
      console.log(`${language}: ${Object.keys(locale).length} keys, valid`);
    }
  }
}

for (const language of inProgress) {
  if (supported.includes(language)) continue;   // already covered above
  const locale = strings[language] || {};
  const missing = Object.keys(english).filter((key) => !(key in locale));
  const badPlaceholders = Object.keys(english).filter((key) => (
    key in locale && placeholders(english[key]) !== placeholders(locale[key])
  ));
  const done = Object.keys(english).length - missing.length;

  console.log(`\n${language}: in progress — not in SUPPORTED_LANGUAGES`);
  console.log(`  UI strings: ${done}/${Object.keys(english).length}`);
  if (missing.length) console.log(`  Missing (${missing.length}): ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ', …' : ''}`);
  if (badPlaceholders.length) console.log(`  Placeholder mismatches (${badPlaceholders.length}): ${badPlaceholders.join(', ')}`);
  const gaps = sideTableReport(language);
  console.log(gaps.length ? `  Tables still to fill:\n    ${gaps.join('\n    ')}` : '  Tables: complete');
  if (!missing.length && !badPlaceholders.length && !gaps.length) {
    console.log(`  Ready — add '${language}' to SUPPORTED_LANGUAGES to offer it in the language button.`);
  }
}

if (failures) process.exitCode = 1;

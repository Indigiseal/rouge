import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'src', 'i18n', 'i18n.js');
let source = fs.readFileSync(sourcePath, 'utf8');

// Load the static registry without importing Phaser-dependent game modules.
source = source
  .replace(/export\s+(?=(const|function|class))/g, '')
  .replace('const LANGUAGE_OPTIONS =', 'globalThis.LANGUAGE_OPTIONS =')
  .replace('const STRINGS =', 'globalThis.STRINGS =')
  .replace('const SUPPORTED_LANGUAGES =', 'globalThis.SUPPORTED_LANGUAGES =');

const context = {};
vm.runInNewContext(source, context, { filename: sourcePath });

const strings = context.STRINGS;
const supported = context.SUPPORTED_LANGUAGES || ['en'];
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
    console.log(`${language}: ${Object.keys(locale).length} keys, valid`);
  }
}

if (failures) process.exitCode = 1;

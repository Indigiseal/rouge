# Localization

English (`STRINGS.en` in `i18n.js`) is the canonical source of UI keys. New
player-facing text must be added as an English key and accessed with `t()`;
do not embed new English UI copy in scenes.

When adding a supported locale, it must contain every English key and use the
same placeholders (for example, `{amount}` or `{floor}`). Run:

```sh
npm run test:i18n
```

Incomplete locales may exist while translation is in progress, but must not be
added to `SUPPORTED_LANGUAGES` until the validator passes. Content registries,
such as talent display copy, should accept a language and fall back to English.

## Text written straight into content (stories, sigils, amulets, enemies)

Keyed UI text lives in `STRINGS`. Text that is written into content files, such as story outcomes, sigil
names and rules, amulet names and descriptions, and enemy and boss names, is translated by its **exact
English wording**: the side tables in `i18n.js` map the English sentence to its translation
(`EXACT_NAME_TRANSLATIONS` for names, `DESCRIPTION_TRANSLATIONS` for rules and descriptions,
`EVENT_NARRATIVE_TRANSLATIONS` for stories). Change an English sentence and its translation stops
matching, so retranslate it.

```sh
npm run audit:l10n                       # what has no translation yet (es, fr, ru)
node tools/audit-localization.mjs --list # every missing string, by source file
node tools/export-stories-for-translation.mjs   # stories still missing -> docs/localization/stories-to-translate.json
node tools/import-translations.mjs <source.json> <translations.json> [--table narrative|names|descriptions]
```

`docs/localization/CHATGPT-BRIEF.md` is the brief to give a translator for the stories. The import tool
checks ids, `{placeholders}` and line breaks before it writes anything, and keeps each import in its own
generated block in `i18n.js`.

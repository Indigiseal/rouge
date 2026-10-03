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

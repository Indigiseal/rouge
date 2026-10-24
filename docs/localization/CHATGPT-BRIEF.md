# Translation job for ChatGPT: the game's stories

Paste this whole file into ChatGPT, then attach `stories-to-translate.json`.
It asks for the story text in **Spanish (es), French (fr) and Russian (ru)**.

There is also a second batch, `stories-runtime-to-translate.json`. It contains outcomes written in
`EventScene.js` and `EventRunHelpers.js`, goblin repair preludes, and assembled story descriptions.
Use the same voice and rules below, and save that batch as `stories-runtime-translated.json`.
Placeholders such as `{card}`, `{magic}`, `{weapon}`, `{crowd}`, `{lit}` and `{dragLine}` are filled by
the game. Keep each one exactly; write around names without assuming their grammatical gender.

---

## What the game is

*Dungeon Card Crawler* is a dark-fantasy dungeon crawler played with cards on a board: you fight
with weapons, wear armor, find amulets and gems, and between fights you meet small stories ("events"):
a soup stand nobody is minding, a robbed traveller, a mirror that copies you, a bird's nest. Choices
have a short button text, then an outcome paragraph.

## The voice (this matters most)

The English is **dry, short and situation-first**: it says what is in the room, then what happens.
Understatement and small jokes, never flowery. Sentences are short. It does not explain the joke and it
does not sound like a fantasy-novel narrator ("a symphony of", "little did you know").

Translate the **voice**, not just the words. If a sentence in English is three flat words, the
translation should also be flat and short. Do not add adjectives, atmosphere or moral lessons.
Keep the jokes working in the target language, even if that means changing the wording.

## How the player is addressed

Match the translations already in the game:

| Language | Address | Example already in the game |
|---|---|---|
| es | informal **tú** | "Te sientas unos minutos. Nada te ataca." |
| fr | formal **vous** | "Vous vous asseyez quelques minutes." |
| ru | formal **вы** | "Вы садитесь на несколько минут." |

## Fixed words (use exactly these, they match the rest of the game)

| English | es | fr | ru |
|---|---|---|---|
| coins | monedas | pièces | монеты |
| crystals | cristales | cristaux | кристаллы |
| gem | gema | gemme | камень |
| amulet | amuleto | amulette | амулет |
| relic | reliquia | relique | реликвия |
| sigil | sigilo | sigil | печать |
| armor | armadura | armure | броня |
| weapon | arma | arme | оружие |
| bag (inventory) | bolsa / mochila | sac | сумка |
| HP | PV | PV | ОЗ |
| DEF | DEF | DEF | DEF |
| actions | acciones | actions | действия |
| Support (menu currency) | Apoyo | Soutien | Поддержка |
| Restoration (a spell) | Restauración | Restauration | Восстановление |
| Antidote | Antídoto | Antidote | Противоядие |
| poison / poisoned | veneno / envenenado | poison / empoisonné | яд / отравлен |
| Weakened | Debilitado | Affaibli | Слабость |

Names of characters and places that appear in stories (the Lost Porter, the Soup Stand, the Robbed
Traveller, the Mirror Twin, the Quiet Crossroads, the Old Chute, the Crystal Mother) are translated
the way a short title would be: natural, short, capitalised like a title in that language.

## Rules for every string

1. **Keep every line break exactly.** `\n\n` means a blank line between paragraphs. The same number of
   breaks must come back. (The import tool checks this and refuses to continue if they differ.)
2. **Keep `{placeholders}` exactly** (for example `{amount}`) and numbers as they are.
3. **Keep the "Name: effect" shape** where a string ends with a reward line such as
   `Loyal Latchbox: +1 inventory slot` or `Chick Companion: 2 lightning damage after enemy turns.`
   Translate both parts, keep the colon and the shape.
4. **Buttons** (`kind: "choice button"`) are small. Keep them short, ideally no longer than the English
   and never more than about 30 characters. A verb phrase, like the English.
5. **Quotes** inside a sentence stay quotes (use the language's normal quote marks; Spanish and
   Russian «…» or "…" are both fine, but be consistent within one story). Apostrophes: use `’` in French.
6. Strings marked "outcome (one of several, chosen by the game)" are alternatives: any one of them can
   appear after the same choice. Each must read well on its own.
7. Do not merge, split or reorder strings, and do not skip any. One answer for every `id`.
8. Do not translate or change anything in `en`. It is only there for you to read.

## What to send back

Reply with **only one JSON array** (no commentary), one object per `id` in the file:

```json
[
  { "id": 1, "es": "...", "fr": "...", "ru": "..." },
  { "id": 2, "es": "...", "fr": "...", "ru": "..." }
]
```

Save it as `stories-translated.json` next to the source file. If the answer is too long for one message,
send it in parts of about 40 ids (each its own JSON array); they can be joined afterwards.

## How it goes into the game

```sh
node tools/import-translations.mjs docs/localization/stories-to-translate.json docs/localization/stories-translated.json
npm run test:i18n
```

For the second batch:

```sh
node tools/export-stories-for-translation.mjs --runtime
node tools/import-translations.mjs docs/localization/stories-runtime-to-translate.json docs/localization/stories-runtime-translated.json
```

The import refuses to write anything if an id is missing, a language is empty, a `{placeholder}`
differs or the line breaks do not match, and says which. It can be run again with a corrected file.

# Новые амулеты

Каталог дропа/магазинов после переработки. Старые определения живут в
`AmuletManager` с `rarity: old` (не в офферах); ивентовые id по-прежнему
выдаются событиями.

Редкости офферов пола/магазина **зависят от этажа** (`AMULET_RARITY_DEPTH_TIERS`
в `src/content/amulets/rarityRates.js`, читать через `amuletRarityRates(source, floor)`):

| Этажи | common | uncommon | rare | legendary |
|---|---|---|---|---|
| 1–15 | 70 | 30 | — | — |
| 16–30 | 20 | 45 | 30 | 5 |
| 31–45 | 5 | 25 | 45 | 25 |

Раньше таблица была одна на весь ран (`common 50 / uncommon 30 / rare 20`), из-за чего
на F40 половина роллов уходила в выдоенный пул из 6 коммонов: скорость набора силы
падала до нуля, пока враги продолжали расти.

rare shop `uncommon 25 / rare 60 / legendary 15`; босс `rare 30 / legendary 70`
(набор boss-only ещё не сделан; босс игнорирует `minFloor`) — эти два источника
от глубины не зависят.

`minFloor` по редкости: **common 0 / uncommon 10 / rare 16**. Legendary без порога
(на пол/магазин попадает только с F16 через веса выше).

Оффер выбирает редкость, у которой в пуле **≥2 кандидата**; редкость с единственным
остатком берётся только если других нет.

Магазины: обычный shop продаёт амулеты с **F5**, rare shop — с **F20**.

Всего в новом каталоге: **24**.

Уклонение, запас жизней, снижение входящего урона и второй ревайв убраны:
это уже делают оружейная, хижина лекаря и храм. Камень философа убран вместе
с кольцами здоровья.

| # | Название | id | Редкость | Описание | Заменяет | group |
|---|---|---|---|---|---|---|
| 1 | Ring of Regeneration | `ringOfRegeneration` | common | +8 HP в начале боевого этажа, +1 каждые 3 этажа (8 → 21) | | survival |
| 2 | Earring of Armor Durability | `earringOfArmorDurability` | common | 25% не тратить прочность брони при блоке/увороте | | survival |
| 3 | Earring of Weapon Durability | `earringOfWeaponDurability` | common | 30% не тратить прочность оружия при атаке | | offense |
| 4 | Tactician's Pin | `tacticiansPin` | common | В начале боя булавка на одной закрытой карте врага | | strategy |
| 5 | Ring of Greater Regeneration | `ringOfGreaterRegeneration` | uncommon | +12 HP в начале боевого этажа, +1 каждые 2 этажа (12 → 32) | `ringOfRegeneration` | survival |
| 6 | Earring of Greater Armor Durability | `earringOfGreaterArmorDurability` | uncommon | 35% не тратить прочность брони | `earringOfArmorDurability` | survival |
| 7 | Earring of Greater Weapon Durability | `earringOfGreaterWeaponDurability` | uncommon | 40% не тратить прочность оружия | `earringOfWeaponDurability` | offense |
| 8 | Alchemist Bag | `alchemistBag` | uncommon | Зелья +15% хила и снимают яд | | survival |
| 9 | Monocle | `monocle` | uncommon | 10% кристалл при убийстве | | utility |
| 10 | Pouch of Greed | `pouchOfGreed` | uncommon | +20% золота | | utility |
| 11 | Forced March | `forcedMarch` | uncommon | Первый открытый враг дальнего боя не на переднем ряде меняется со случайной картой переднего ряда | | strategy |
| 12 | Rune of Fire | `runeOfFire` | uncommon | Радиус сплэша огненного камня ×1.5 | | magic |
| 13 | Rune of Zap | `runeOfZap` | uncommon | Молния отскакивает ещё на 1 цель | | magic |
| 14 | Rune of Poison | `runeOfPoison` | uncommon | Яд камня ещё на 1 соседа в радиусе обычного огненного камня | | magic |
| 15 | Vampire Fang | `vampireFang` | rare | 15% нанесённого урона в хил (ceil) | | offense |
| 16 | Dragon Claw | `newDragonClaw` | rare | +15% урона (ceil) | | offense |
| 17 | Greater Rune of Fire | `greaterRuneOfFire` | rare | +20% урона огненных камней (ceil) | | magic |
| 18 | Greater Rune of Zap | `greaterRuneOfZap` | rare | +20% урона Zap камней (ceil) | | magic |
| 19 | Greater Rune of Poison | `greaterRuneOfPoison` | rare | +2 урон тика poison камней | | magic |
| 20 | Mask of Hollow Whispers | `maskOfHollowWhispers` | rare | 25% карта после убийства (не ловушка/враг/empty) | | utility |
| 21 | Close Order | `vacancyStep` | rare | Когда впервые открыты двое+ врагов, они встают рядом (свап с рубашками по ряду или столбцу) | | strategy |
| 22 | Legendary Whetstone | `legendaryWhetstone` | legendary | 40% не тратить прочность оружия, +10% урона оружия | Weapon Durability earrings | offense |
| 23 | Gloves of the Hermit Wizard | `glovesOfHermitWizard` | legendary | +35% урона всех камней (ceil) | Fire/Zap/Poison runes (включая Greater) | magic |
| 24 | General's Table | `generalsTable` | legendary | Раз за акт на карте можно выбрать любой узел следующей линии, не только по веткам | | strategy |

## Старые амулеты, привязанные к ивентам / боссу

Фиксированные выдачи ивентов (id остаётся `old`, логика пока старая):

| Event | id | Бывшее имя |
|---|---|---|
| `too_nice_room` (fight fairy) | `teaRoomBell` | Tea Room Bell |
| `book_worm` | `mothWingDust` / `wormVenomCharm` / `stolenInkPen` | Moth-Wing Dust / Worm Venom Charm / Stolen Ink Pen |
| `something_wicked` | `luckyClover` | Lucky Clover |
| `brass_wizard` | `fortuneCard` | Fortune Card |
| `screaming_head` (gem in eye) | `fireRuneStone` / `lightningRune` / `poisonRune` | Fire / Lightning / Poison Rune |

Случайные выдачи ивентов (теперь из **нового** пула, кроме cursed):

| Event | Было |
|---|---|
| `too_nice_room` confront, `almost_you_well`, `screaming_head` reach | random из дроп-пула |
| `slimy_prison` grab | random non-cursed |
| `slimy_prison` end suffering | random **old cursed** (`bloodyHarvest`, `eternalRage`, `berserkerBelt`) |

Босс: раньше оффер legendary/cursed из старого пула; сейчас legendary из нового каталога. Отдельного boss-only набора ещё нет.

## Запланировано (event-only / boss-only)

См. `docs/OPEN-QUESTIONS.md` — в т.ч. **Kaelen's Untouchable Tools**.

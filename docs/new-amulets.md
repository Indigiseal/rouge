# Новые амулеты

Каталог дропа/магазинов после переработки. Старые определения живут в
`AmuletManager` с `rarity: old` (не в офферах); ивентовые id по-прежнему
выдаются событиями.

Редкости офферов: пол/магазин `common 50 / uncommon 30 / rare 20`;
rare shop `uncommon 25 / rare 60 / legendary 15`; босс `rare 30 / legendary 70`
(набор boss-only ещё не сделан; босс игнорирует `minFloor`).

`minFloor` по редкости: **common 0 / uncommon 10 / rare 20**. Legendary без порога.

Магазины: обычный shop продаёт амулеты с **F5**, rare shop — с **F20**.

Всего в новом каталоге: **25**.

| # | Название | id | Редкость | Описание | Заменяет | group |
|---|---|---|---|---|---|---|
| 1 | Amulet of Evasion | `amuletOfEvasion` | common | 10% dodge | | survival |
| 2 | Ring of Health | `ringOfHealth` | common | +15 max HP | | survival |
| 3 | Amulet of Protection | `amuletOfProtection` | common | −20% входящего урона (ceil) | | survival |
| 4 | Ring of Regeneration | `ringOfRegeneration` | common | +10 HP в начале боевого этажа | | survival |
| 5 | Earring of Armor Durability | `earringOfArmorDurability` | common | 25% не тратить прочность брони при блоке/увороте | | survival |
| 6 | Earring of Weapon Durability | `earringOfWeaponDurability` | common | 30% не тратить прочность оружия при атаке | | offense |
| 7 | Amulet of Greater Evasion | `amuletOfGreaterEvasion` | uncommon | 20% dodge | `amuletOfEvasion` | survival |
| 8 | Ring of Greater Health | `ringOfGreaterHealth` | uncommon | +20 max HP | `ringOfHealth` | survival |
| 9 | Amulet of Greater Protection | `amuletOfGreaterProtection` | uncommon | −30% входящего урона (ceil) | `amuletOfProtection` | survival |
| 10 | Ring of Greater Regeneration | `ringOfGreaterRegeneration` | uncommon | +15 HP в начале боевого этажа | `ringOfRegeneration` | survival |
| 11 | Earring of Greater Armor Durability | `earringOfGreaterArmorDurability` | uncommon | 35% не тратить прочность брони | `earringOfArmorDurability` | survival |
| 12 | Earring of Greater Weapon Durability | `earringOfGreaterWeaponDurability` | uncommon | 40% не тратить прочность оружия | `earringOfWeaponDurability` | offense |
| 13 | Alchemist Bag | `alchemistBag` | uncommon | Зелья +15% хила и снимают яд | | survival |
| 14 | Monocle | `monocle` | uncommon | 10% кристалл при убийстве | | utility |
| 15 | Pouch of Greed | `pouchOfGreed` | uncommon | +20% золота | | utility |
| 16 | Vampire Fang | `vampireFang` | rare | 15% нанесённого урона в хил (ceil) | | offense |
| 17 | Dragon Claw | `newDragonClaw` | rare | +15% урона (ceil) | | offense |
| 18 | Rune of Fire | `runeOfFire` | rare | +20% урона огненных камней (ceil) | | magic |
| 19 | Rune of Zap | `runeOfZap` | rare | +20% урона Zap камней (ceil) | | magic |
| 20 | Rune of Poison | `runeOfPoison` | rare | +2 урон тика poison камней | | magic |
| 21 | Mask of Hollow Whispers | `maskOfHollowWhispers` | rare | 25% карта после убийства (не ловушка/враг/empty) | | utility |
| 22 | Philosopher's Stone | `philosophersStone` | legendary | +20 max HP, +8 HP в начале боевого этажа | Health + Regen rings (все тиры) | survival |
| 23 | Legendary Whetstone | `legendaryWhetstone` | legendary | 40% не тратить прочность оружия, +10% урона оружия | Weapon Durability earrings | offense |
| 24 | Lost Noble Diadem | `lostNobleDiadem` | legendary | Prevents death once per run + хил 50% max HP | | survival |
| 25 | Gloves of the Hermit Wizard | `glovesOfHermitWizard` | legendary | +35% урона всех камней (ceil) | Fire/Zap/Poison runes | magic |

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

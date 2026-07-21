# Амулеты

> Актуальный дроп/магазины: **`docs/new-amulets.md`**.
> Ниже — архив старого каталога (все с `rarity: old`, не в офферах).

Сгенерировано из `AmuletManager.amuletDefinitions` + пул дропа `CardDataGenerator.amuletTypes`.

## Дроп: сначала редкость, потом выбор из 3

На полу / в магазинах / с босса амулет — это **оффер**: сначала роллится редкость по источнику, затем открывается экран выбора до 3 случайных амулетов этой редкости.

| Источник | Редкости и веса |
|---|---|
| Пол / обычный магазин | common 50 / uncommon 30 / rare 20 |
| Rare shop | uncommon 25 / rare 60 / legendary 15 |
| Босс | legendary 100 (временно, до boss-only) |

Фиксированные награды ивентов по-прежнему выдают старые id (`rarity: old`).

Всего (архив): **42**. В новом дропе: см. `new-amulets.md`.

| # | Название | id | Редкость | Описание | В дропе | minFloor | weight | group |
|---|---|---|---|---|---|---|---|---|
| 1 | Bottomless Bag | `bottomlessBag` | common | +2 inventory slots | да | 1 | 5 | utility |
| 2 | Amulet of Regeneration | `regeneration` | uncommon | Restores 1 HP per stack at end of each floor | да | 1 | 10 | survival |
| 3 | Blood Signet | `vampiricRing` | uncommon | Heal 2 HP per enemy kill | да | 4 | 7 | survival |
| 4 | Boots of Evasion | `evasionBoots` | uncommon | 10% dodge chance | да | 3 | 6 | survival |
| 5 | Diviner's Spade | `diviners_spade` | uncommon | +5 max action points | да | 2 | 7 | magic |
| 6 | Golden Seed | `goldenSeed` | uncommon | +1 max HP whenever you discard a card | да | 2 | 7 | survival |
| 7 | Greasewing's Feast | `greasewingFeast` | uncommon | One card per floor becomes food (except boss rooms) | да | 5 | 6 | magic |
| 8 | Harvest Crown | `travelKitchen` | uncommon | Food restores 50% more AP | да | 2 | 8 | magic |
| 9 | Healing Ring | `healingRing` | uncommon | Potions heal 20% more | да | 2 | 10 | survival |
| 10 | Lute of First Light | `charmingTune` | uncommon | First melee enemy on each floor skips its first attack | да | 3 | 6 | survival |
| 11 | Moonwell Phial | `abyssHourglass` | uncommon | +2 AP after completing floor | да | 3 | 8 | magic |
| 12 | Pouch of Greed | `greedPouch` | uncommon | +30% gold found | да | 1 | 10 | utility |
| 13 | Prospector's Pick | `prospectorsPick` | uncommon | 10% chance to find 1-2 coins or a crystal per kill | да | 3 | 7 | utility |
| 14 | Stoneheart Medallion | `golemHeart` | uncommon | +10 max health | да | 2 | 8 | survival |
| 15 | Carrion Oath | `hungryDagger` | rare | Drinking a healing potion cures all poison and heals +2 HP per poison stack removed | да | 10 | 4 | survival |
| 16 | Chronos Heart | `chronosHeart` | rare | +3 max action points | да | 5 | 5 | magic |
| 17 | Dragon Claw | `dragonClaw` | rare | +1 weapon damage | да | 8 | 3 | offense |
| 18 | Fire Rune | `fireRuneStone` | rare | Fire gems burn farther. | да | 10 | 5 | magic |
| 19 | Fortune Card | `fortuneCard` | rare | +8% crit chance; critical hits sometimes drop a coin or crystal | нет |  |  |  |
| 20 | Lightning Rune | `lightningRune` | rare | Zap hits one extra enemy. | нет |  |  |  |
| 21 | Lucky Clover | `luckyClover` | rare | +3% crit chance | нет |  |  |  |
| 22 | Mask of Hollow Whispers | `reapersMask` | rare | 15% chance an enemy leaves a random card behind on death | да | 5 | 5 | utility |
| 23 | Merchant's Seal | `merchantPact` | rare | +1 bonus item slot in shops with better quality | да | 3 | 5 | utility |
| 24 | Moth-Wing Dust | `mothWingDust` | rare | Magic cards have a 25% chance to return after use | нет |  |  |  |
| 25 | Poison Rune | `poisonRune` | rare | Poison gems stack more poison. | нет |  |  |  |
| 26 | Quickhand Gloves | `speedBoots` | rare | 15% chance for free actions | да | 4 | 6 | magic |
| 27 | Siren's Perfume | `sirensPendant` | rare | 15% chance enemies attack their own kind instead of you | да | 6 | 4 | survival |
| 28 | Skeleton's Lockpicks | `skeletonKey` | rare | Treasure chests open without needing a key card | да | 3 | 5 | utility |
| 29 | Soul Harvester | `soulHarvester` | rare | Heal 1 HP per kill, +3 AP every 3 kills | да | 10 | 4 | survival |
| 30 | Stolen Ink Pen | `stolenInkPen` | rare | Gain 1 coin whenever you discard a card | нет |  |  |  |
| 31 | Sunstone | `sunstone` | rare | +1 Max HP for every card left behind when the floor clears | да | 6 | 5 | survival |
| 32 | Tea Room Bell | `teaRoomBell` | rare | Restores 4 AP whenever you enter a non-battle room | нет |  |  |  |
| 33 | Tempered Ingot | `temperedSteel` | rare | Weapons lose half durability | да | 6 | 6 | offense |
| 34 | Traveler's Journal | `travelersJournal` | rare | +2 max HP for each unique amulet you carry | да | 6 | 4 | survival |
| 35 | Watcher's Lamp | `watchersLamp` | rare | Briefly reveals one trap at floor start — memorize it! | да | 4 | 5 | utility |
| 36 | Wayfarer's Map | `wayfarersMap` | rare | +1 max AP every other floor (max +15) | да | 4 | 5 | magic |
| 37 | Wayfinder's Compass | `wayfinder` | rare | Reveals one extra non-enemy card at the start of each floor | да | 4 | 5 | utility |
| 38 | Worm Venom Charm | `wormVenomCharm` | rare | Poison attacks are nullified and poison cannot be applied | нет |  |  |  |
| 39 | Lost Princess's Diadem | `invulnerability` | legendary | Prevents death once per run | да | 15 | 2 | survival |
| 40 | Berserker's Warbelt | `berserkerBelt` | cursed | +50% damage below 50% HP, potions cannot heal above 50% | да | 14 | 3 | offense |
| 41 | Ember of Defiance | `eternalRage` | cursed | +20% damage below 30% HP, +10% damage taken | да | 8 | 4 | offense |
| 42 | Rune of Balance | `bloodyHarvest` | cursed | +3 HP per kill, -30% max health | да | 10 | 4 | survival |

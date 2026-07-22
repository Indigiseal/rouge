# Agent guide — rouge

Cursor подхватывает краткую версию из `.cursor/rules/project-architecture.mdc` (`alwaysApply`). Этот файл — расширенная шпаргалка.

Смежные docs:

- `docs/MECHANICS.md` — source of truth механик
- `docs/BALANCE.md` — цели баланса и куда крутить числа
- `docs/OPEN-QUESTIONS.md` — открытые дизайны + freeze save-контракта

---

## Слои `src/`

| Слой | Путь | Роль |
|------|------|------|
| content | `src/content/` | Данные и чистые хелперы: карты, таланты, классы, economy, events, balance |
| systems | `src/systems/` | Рантайм: доска, инвентарь, бой, лут, `GameState` |
| scenes | `src/scenes/` | Phaser-сцены (флоу комнат / UI) |
| managers | `src/managers/` | Persist, meta, amulets, tutorial |
| ui | `src/ui/` | Оверлеи, тултипы, HUD |
| config / audio / map / i18n | соответствующие папки | Узкие домены |

Отдельного `src/utils/` нет — хелперы рядом с доменом.

**Facades** (публичный API не ломать без нужды):

- `CardSystem` → `board/BoardLayout`, `FloorSpawner`, `BoardCombat`, `BoardCardFx`
- `InventorySystem` → `inventory/CardMergeRules`, `InventoryCombatUse`, `InventoryView`, `InventorySlotRenderer`
- Лут: `systems/loot/CardDataGenerator.js` читает таблицы из `content/`

Do: данные/формулы → `content/`; оркестрация → `systems/`; клики/флоу → `scenes/`.  
Don't: хардкодить статы/цены/XP в scenes; пихать бизнес-логику в фасад.

---

## Content packs

### Cards

- Каталоги: `content/cards/{weapons,armor,enemies,bosses,...}.js`
- Barrel: `content/cards/index.js`
- Фабрики — единственный способ собрать runtime-карту: `createWeaponCardData`, `createArmorCardData`

Оружие (`weapons.js`):

```
WEAPONS                 → intrinsic stats (damage, sprite, special)
WEAPON_SPAWN_MIN_FLOOR  → только eligibility лута
createWeaponCardData    → runtime card
```

То же для брони. Стартовый кит **игнорирует** spawn floors.

### Characters

- `content/characters/CharacterClasses.js`
- `startingWeapons`: только `{ weaponType, rarity }` → `buildStartingWeaponCards()`

### Talents

- `nodes/*.js` — id, `values`, `maxRank` (числа)
- `displayCopy.js` — **авторитетные** name / descriptionRanks (English ASCII, pixel-font safe)
- `branches.js` — layout ветки, `purchasable` / `wip`
- `index.js` — `TALENT_NODES`, `resolveTalentEffects()`, `applyArmorTalentMods()`

Нельзя править только `descriptionRanks` в node и считать UI обновлённым — UI берёт copy из `displayCopy.js`.

### Economy / balance / events

- Economy: `content/economy/{shop,repair,rest,metaXp}.js`
- Balance knobs: `content/balance/` + `docs/BALANCE.md`
- Events: один файл = один default-export → `events/index.js`

---

## Permanent vs situational урон

Код: `CharacterClasses.js`, применение: `InventoryCombatUse.js`, зеркало: `sim/balance-sim.js` → `simWeaponHitDamage`.

**Permanent** (на карте / `getDisplayedWeaponDamage`):

1. Class % (rogue dagger/bow ×1.10, ceil)
2. Twin Fang % (dagger full, bow half)

**Situational** (не печатать на карте):

- Weakness (exhausted ×0.8)
- Keen Edge — flat +N, первая атака dagger/bow за этаж (`keenEdgeUsedThisFloor`)
- First Blood — % первая атака за этаж (`firstAttackThisFloorUsed`)
- Warrior crit — от printed base × rarity tier

Порядок в бою: base → weakness → permanent → Keen → First Blood → crit.

Do: once-per-floor — отдельный флаг + сброс в `FloorSpawner`.  
Don't: запекать Keen / First Blood в `weapon.damage` или в displayed number.

---

## Saves (beta freeze)

Заморожено (см. `OPEN-QUESTIONS.md`):

- Ключи localStorage: `currentRun`, `metaProgression`, `gameSettings`
- Shape JSON run/meta + совместимый load/migrate

Можно менять внутренние API и раскладку файлов SaveManager.

Практика: `SaveManager.SAVE_VERSION` + `migrateRun` / `migrateMeta` при смене полей.  
Не переименовывать storage keys и не ломать shape без миграции.

---

## Sim ↔ игра

`sim/balance-sim.js` импортирует реальные `CardSystem`, `GameState`, content-хелперы.  
Combat/spawn — реальные; station economy может быть приближённой.

Do: тюнить таблицы в `src/content`, гонять sim (`talentcompare`, balance batch).  
Don't: держать combat math только в sim без зеркала в `InventoryCombatUse`.

---

## Naming / copy

- IDs: camelCase (`keenEdge`, `weaponType: 'dagger'`)
- Talent UI copy: English ASCII в `displayCopy.js`
- UI-строки игрока: `src/i18n/i18n.js`
- Документация дизайна часто на русском; код-идентификаторы — English
- Ответы пользователю — на русском

---

## Чеклист перед сдачей изменения

1. Числа баланса только в content / economy / class passives; сверить `BALANCE.md`.
2. Новые карты — фабрика + registry; starters — refs.
3. Новый талант — node + displayCopy + branches + `resolveTalentEffects`.
4. Permanent / situational не смешаны; UI показывает только permanent.
5. Combat/loot/talent — при необходимости прогнан sim.
6. Save keys/schema — migrate, не break.
7. Дизайн-решение отражено в `MECHANICS.md` / `OPEN-QUESTIONS.md`.
8. Минимальный патч; без README/тестов без запроса; без эмодзи в коде.

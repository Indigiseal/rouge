# Balance Simulator

Headless Monte-Carlo симулятор на **реальном** боевом коде (`CardSystem`, `GameState`, `AmuletManager`, `MetaProgressionManager`).

Запуск из корня репозитория:

```bash
npm install   # better-sqlite3 для stats-db
```

---

## Быстрый старт

| Задача | Команда |
|--------|---------|
| Баланс без меты/амулетов, 1000 runs → SQLite | `npm run sim:stats-db-balance -- 1000 my-batch` |
| Grafana | `npm run sim:grafana:build && npm run sim:grafana` |
| UI дашборд | `npm run sim:dashboard` |

БД: `sim/db/stats.sqlite`  
Цели и рычаги тюнинга: `docs/BALANCE.md`. Открытые вопросы: `docs/OPEN-QUESTIONS.md`.

---

## Режимы `balance-sim.js`

Общий формат:

```bash
node sim/balance-sim.js <режим> [аргументы...]
```

### Консольный отчёт (без SQLite)

| Режим | Команда | Описание |
|-------|---------|----------|
| **default** | `npm run sim -- 2000` | Все релики + Bottomless Bag, отчёт в консоль |
| **fresh** | `node sim/balance-sim.js fresh 500` | Без реликов, без сумки |
| **geared** | `node sim/balance-sim.js geared 500` | Все релики + сильный набор амулетов |
| **career** | `node sim/balance-sim.js career 2000` | «Карьера»: смерть → релик → retry до победы; deaths-to-win |
| **reliccompare** | `node sim/balance-sim.js reliccompare 500` | Сравнение подмножеств реликов |
| **sweep** | `node sim/balance-sim.js sweep 100` | Каждый амулет solo vs baseline (без дропов; чистая сила) |
| **loadout** | `node sim/balance-sim.js loadout golemHeart,regeneration 500` | Фиксированный набор амулетов |
| **loadout auto** | `node sim/balance-sim.js loadout auto 500` | Предустановленный strong loadout |
| **weapontest** | `node sim/balance-sim.js weapontest 500` | Изоляция: легендарный топор + все релики |

Поведение бота можно переключать пресетом:

```bash
node sim/balance-sim.js fresh 500 --behavior balanced
node sim/balance-sim.js sweep 100 temperedSteel --behavior safe
```

Доступные пресеты: `balanced`, `safe`, `combat`, `magicHeavy`.

### Loot-stats (кривые урона/HP)

```bash
node sim/balance-sim.js loot-stats [runs] [preset] [флаги] [--json]
```

Примеры:

```bash
npm run sim:loot-stats
npm run sim:loot-stats-balance
node sim/balance-sim.js loot-stats 200 fresh --json
node sim/balance-sim.js loot-stats 100 geared --no-amulets
```

JSON (генерируется в `sim/output/`, в git не коммитится): `loot-stats.json` / `loot-stats-balance.json`

### Stats-db (SQLite + Grafana)

```bash
node sim/balance-sim.js stats-db [runs] [preset] [label] [флаги]
```

**Presets** (базовые дефолты meta/amulets):

| Preset | Meta | Amulets | Смысл |
|--------|------|---------|-------|
| `balance` | off | off | Чистый баланс (основной для тюнинга) |
| `fresh` | off | on | Без реликов; амулеты с пола/шопа |
| `geared` | on | on | Полный аккаунт (все релики на старт) |
| `accumulate` | on | on | Один аккаунт: смерть → релик → следующий run |

Примеры:

```bash
# 1000 runs, label для Grafana
npm run sim:stats-db-balance -- 1000 origin

npm run sim:stats-db-fresh -- 1000 fresh-run
npm run sim:stats-db-geared -- 500 geared-run

# Другая БД / явное имя
node sim/balance-sim.js stats-db 1000 balance my-run --db sim/db/stats.sqlite
node sim/balance-sim.js stats-db 100 --name custom-label balance

# Другой preset поведения бота
node sim/balance-sim.js stats-db 1000 balance behavior-run --behavior magicHeavy
```

---

## Флаги meta / amulets / month / act

Работают с **`stats-db`**, **`loot-stats`** и **`fresh`**. Перебивают preset.

| Флаг | Эффект |
|------|--------|
| `--character rogue\|warrior` | Класс персонажа (default: rogue) |
| `--armor-pool chain\|plate\|both` | Фильтр спавна брони воина |
| `--talents none\|max\|id:rank,...` | Пустое дерево / max live-ветки / кастомные ранги (включает meta) |
| `--month thornwake\|silkdeep\|0\|1` | Пин ростера месяца (без ротации по актам) |
| `--act 1\|2\|3` | Только этот акт (F1–15 / 16–30 / 31–45). Стартеры: common / uncommon / rare. Act 2/3 сидят 3/6 random амулетов |
| `--meta` / `--no-meta` | Вкл/выкл meta (таланты); preset `geared` ещё тянет relic-пул (сейчас пустой) |
| `--amulets` / `--no-amulets` | Дроп/ивенты/шоп амулетов |
| `--amulet-loadout none` | Старт без амулетов (дефолт; перебивает act-seed) |
| `--amulet-loadout bag` | Bottomless Bag с старта (перебивает act-seed) |
| `--amulet-loadout strong` | 8 сильных амулетов с старта (перебивает act-seed) |
| `--amulet-start id,id` | Явный стартовый набор (перебивает act-seed) |
| `--behavior <preset>` | Preset поведения бота (`balanced`, `safe`, `combat`, `magicHeavy`) |

Mid-act kit (`--act 2\|3`): оружие повышенной редкости + random амулеты — это **стартовый loadout**, не дроп; сид работает даже с `--no-amulets`.

### Готовые npm-скрипты (4 квадранта)

```bash
npm run sim:stats-db-balance -- 1000 balance-run      # no meta, no amulets
npm run sim:stats-db-meta-only -- 1000 meta-run       # all relics, no amulets
npm run sim:stats-db-amulets-only -- 1000 amulet-run  # amulets on, no relics
npm run sim:stats-db-full -- 1000 full-run            # relics + strong amulets
```

### Произвольные комбинации

```bash
# Мета без амулетов
node sim/balance-sim.js stats-db 1000 fresh meta-run --meta --no-amulets

# Амулеты + сумка, без меты
node sim/balance-sim.js stats-db 1000 fresh bag-run --amulets --no-meta --amulet-loadout bag

# Silkdeep, только act 2 (bands D/E), uncommon starters + 3 random amulets
node sim/balance-sim.js stats-db 200 balance silk-a2 \
  --month silkdeep --act 2 --character rogue --talents max

# Thornwake act 3, rare starters + 6 random amulets, точечные таланты
node sim/balance-sim.js loot-stats 100 balance \
  --month thornwake --act 3 --character warrior \
  --talents armorerStart:1,rivets:2 --armor-pool plate

# Настоящая мета-прогрессия (XP за смерть между runs)
node sim/balance-sim.js stats-db 500 accumulate career --meta
```

**Важно:**

- `--meta` включает применение талантов; relic-пул в симе сейчас пустой (relics retired).
- `accumulate` — единственный режим, где прогрессия **растёт от run к run** через `handlePlayerDeath` (XP; таланты не автопокупаются).
- `amulets-only` (`fresh --amulets --no-meta`) — **без стартовых** амулетов на act 1; набор только с пола/шопа.
- `--act 2\|3` без явного `--amulet-loadout` / `--amulet-start` всегда сидит 3/6 random амулетов.

---

## Метрики

Каталог метрик: `sim/METRICS-CATALOG.md`. Цели pure-runs: `docs/BALANCE.md`.

---

## Grafana

```bash
npm run sim:grafana:build    # пересобрать JSON дашбордов
npm run sim:grafana          # docker compose up (SQLite + Grafana)
npm run sim:grafana:down
npm run sim:grafana:logs
```

Дашборды:

- **Sim Balance** — один batch (selector по label/id)
- **Sim Balance Compare** — batch A vs batch B

URL по умолчанию: http://localhost:3000 (см. `sim/db/docker-compose.yml`)

В селекторе batch видно: `label (preset, meta/no-meta, amulets/no-amulets, N runs)`.

---

## Dashboard launcher

```bash
npm run sim:dashboard
```

Открой `http://localhost:3040`.

Dashboard теперь умеет:

- запускать `stats-db` прогоны;
- запускать `sweep`;
- выбирать `behavior` preset;
- показывать статус и лог текущего запуска;
- автоматически обновлять batches после завершения прогона.

---

## SQLite напрямую

```bash
sqlite3 sim/db/stats.sqlite

SELECT id, label, mode, runs_completed, config_json
FROM sim_batches ORDER BY id DESC LIMIT 10;
```

---

## Сводка: что выбрать

| Цель | Режим |
|------|-------|
| Pure-runs KPI (reach/clear) | `stats-db balance` |
| Влияние только реликов | `--meta --no-amulets` |
| Влияние только амулетов | `--amulets --no-meta` |
| Полный прокачанный аккаунт | `geared` или `--meta` + `--amulet-loadout strong` |
| Реальная петля смерть → релик | `accumulate --meta` или `career` |
| Сравнение амулетов по одному | `sweep` |
| Сравнение реликов | `reliccompare` |

---

## Ограничения sim (vs игра)

- Инвентарь ограничен реальными слотами, bot policy эвристическая
- Упрощённые shop/treasure/event/rest/anvil
- `RARE_SHOP`, ELITE chest и др. — см. комментарии в `sim/balance-sim.js`

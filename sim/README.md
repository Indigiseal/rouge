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
| Анализ batch | `npm run sim:balance-analyze -- my-batch` |
| Grafana | `npm run sim:grafana:build && npm run sim:grafana` |

БД: `sim/db/stats.sqlite`  
Knobs баланса: `sim/balance-knobs.js` (влияют на sim и игру)

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

JSON: `sim/output/loot-stats.json` или `loot-stats-balance.json`

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

## Флаги meta / amulets

Работают с **`stats-db`** и **`loot-stats`**. Перебивают preset.

| Флаг | Эффект |
|------|--------|
| `--meta` / `--no-meta` | Все релики (`ALL_RELICS`) на старт каждого run |
| `--amulets` / `--no-amulets` | Дроп/ивенты/шоп амулетов |
| `--amulet-loadout none` | Старт без амулетов (дефолт) |
| `--amulet-loadout bag` | Bottomless Bag с F1 |
| `--amulet-loadout strong` | 8 сильных амулетов с F1 |
| `--behavior <preset>` | Preset поведения бота (`balanced`, `safe`, `combat`, `magicHeavy`) |

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

# Настоящая мета-прогрессия (релик за смерть между runs)
node sim/balance-sim.js stats-db 500 accumulate career --meta
```

**Важно:**

- `--meta` ≠ accumulate. Это **мгновенно все релики** на каждый run.
- `accumulate` — единственный режим, где релики **растут от run к run** через `handlePlayerDeath`.
- `amulets-only` (`fresh --amulets --no-meta`) — **без стартовых** амулетов; набор только с пола/шопа.

---

## Анализ и автотюнинг

```bash
# Per-floor clear%, воронка, avg floor
npm run sim:balance-analyze -- origin
npm run sim:balance-analyze -- tune-act2-clear

# 3 итерации × 1000 runs (пишет knobs + batches tune-iter-N)
npm run sim:balance-tune -- origin 3 1000
```

Knobs: `sim/balance-knobs.js` — HP/ATK сегменты, веса оружия/брони, боссы, `minEnemyRatio`.

Каталог метрик: `sim/METRICS-CATALOG.md`

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
| Тюнинг knobs, «хватит урона», воронка | `stats-db balance` |
| Влияние только реликов | `--meta --no-amulets` |
| Влияние только амулетов | `--amulets --no-meta` |
| Полный прокачанный аккаунт | `geared` или `--meta` + `--amulet-loadout strong` |
| Реальная петля смерть → релик | `accumulate --meta` или `career` |
| Сравнение амулетов по одному | `sweep` |
| Сравнение реликов | `reliccompare` |

---

## Ограничения sim (vs игра)

- Инвентарь теперь ограничен реальными слотами, но bot policy всё ещё эвристическая, а не player-perfect
- Упрощённые shop/treasure/event/rest/anvil
- `RARE_SHOP`, ELITE chest и др. — см. комментарии в `sim/balance-sim.js`
- Баланс-knobs общие для sim и клиента

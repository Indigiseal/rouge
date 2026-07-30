# Balance (pure runs)

Базовый баланс строится на **чистых забегах**: без амулетов и без мета-прогрессии
(sim preset `balance`). Амулеты и мета — поверх этой базы, отдельными документами,
когда дойдём до них. Открытые дизайны — `OPEN-QUESTIONS.md`. Механики — `MECHANICS.md`.

## Цели акта 1

| Метрика | Цель |
|---------|------|
| Дошли до F15 | **~50%** |
| Победа над боссом F15 (от дошедших) | **~20%** |
| Прошли акт 1 (F16+) | **~10%** |

Act 2/3 gates — TBD после стабилизации акта 1 / кривой reach.

Последняя сверка (3000 runs, `act1-retune-v1b`): reach **53.8%**, clear **19.5%**,
act1 pass **10.5%**.

## Где крутить (только реальные числа)

1. Враги / боссы — `CardDataGenerator.enemyData` / `bossData`
2. Веса лута на этаже — `floorWeights` + `balanceCardWeights`
3. Оружие — `src/content/cards/weapons.js` (`WEAPONS` статы, `WEAPON_SPAWN_MIN_FLOOR` лут)
   Броня — `src/content/cards/armor.js` (`ARMORS` + `ARMOR_SPAWN_MIN_FLOOR`)
4. Плотность врагов — `minEnemyRatioForFloor` в board systems
5. Старт — `CharacterClasses.startingWeapons` (только type+rarity), HP `PLAYER_START_HP` в `GameState.js`
   Карточки стартового оружия собираются через `createWeaponCardData` / `buildStartingWeaponCards`

Множителей-knobs нет.

## Как мерить

```bash
npm run sim:stats-db-balance -- 2000 my-label
```

Gate SQL:

```bash
node --input-type=module -e "
import Database from 'better-sqlite3';
const db = new Database('sim/db/stats.sqlite');
const b = db.prepare('SELECT id FROM sim_batches WHERE label=?').get('my-label');
const r = db.prepare('SELECT COUNT(*) n FROM sim_runs WHERE batch_id=?').get(b.id);
for (const f of [15, 30, 45]) {
  const reach = db.prepare('SELECT COUNT(*) n FROM sim_runs WHERE batch_id=? AND reached_floor>=?').get(b.id, f);
  const died = db.prepare('SELECT COUNT(*) n FROM sim_runs WHERE batch_id=? AND reached_floor=? AND won=0').get(b.id, f);
  console.log('F'+f, 'reach', (100*reach.n/r.n).toFixed(1)+'%',
    'clear', (100*(1-died.n/reach.n)).toFixed(1)+'%');
}
"
```

Дашборд / Grafana: `npm run sim:dashboard`, `npm run sim:grafana`.

## Enemy power: bands + archetypes (design SoT)

Целевая модель статов обычных врагов.

**Статус кода:** bands + archetypes; ростеры **Thornwake** и **Silkdeep**
(`src/content/months/<id>/enemies/`). Ротация ран/актов: первые
`MONTH_ROTATION_LENGTH` месяцев (`calendar.js`). Остальные месяцы в календаре
пока без ростера → legacy `tiers[]` если когда-то выпадут.

### Принцип

| Слой | Что задаёт | Где числа |
|------|------------|-----------|
| **Identity** | имя, спрайт, role, feature (без цифр силы) | контент месяца / тип врага |
| **Band** | полка HP/ATK от этажа (дня) | таблица ниже |
| **Archetype** | множители формы (skirmisher / bruiser / …) | таблица ниже |

Месяц выбирает *кого* спаунить. Этаж выбирает *насколько сильный* бэнд.
Один и тот же Wolf в акте 1 и акте 3 отличается бэндом, не отдельной таблицей.

Боссы месяца — **отдельный boss-band по акту** (не эта таблица). Elite mini-boss
как сейчас: ×1.3 HP/ATK поверх обычных статов.

### Power bands (skirmisher = ×1.0)

Эталон — текущий Skeleton акта 1 (A–C / стык D). F15 **не** отдельный моб-бамп:
полка C до конца акта, финал у босса. Mid-act 2 даёт ATK-ступень (E). Mid-act 3 — лёгкий хвост (G).

| Band | Floors | HP | ATK | Заметка |
|------|--------|----|-----|---------|
| A | 1–4 | 8 | 5 | старт; ≈ skeleton F1 |
| B | 5–9 | 11 | 7 | ≈ skeleton F5 |
| C | 10–15 | 12 | 8 | полка до босса акта 1; ≈ skeleton F10 |
| D | 16–22 | 17 | 8 | стык акта 2; ≈ skeleton F16 HP |
| E | 23–30 | 17 | 10 | mid-act 2: рост ATK |
| F | 31–37 | 20 | 11 | стык акта 3; ≈ skeleton F31 |
| G | 38–45 | 22 | 12 | хвост акта 3 |

Спайки осознанные: **F16** (A→D по смыслу акта) и **F31**. Внутри акта — плоские полки.

`stats = band(floor) × archetypeBias` (округление при имплементации: `ceil` для HP/ATK после множителя, clamp ≥1).

### Archetypes

| Archetype | HP | ATK | Типичные роли |
|-----------|----|-----|----------------|
| skirmisher | ×1.0 | ×1.0 | обычный melee (Wolf, Skeleton) |
| bruiser | ×1.25 | ×0.95 | толстые ближники |
| swarm | ×0.75 | ×0.9 | мелкие / кучи |
| artillery | ×0.7 | ×1.15 | ranged (лучники) |

Враги с сильной feature (poison, evade): можно чуть снизить bias (например HP ×0.9),
сила в правиле, не в голых цифрах паспорта.

### Locked feature (exception)

- **Wolf:** +1 ATK per other revealed living Wolf on the board (situational; not on the passport band).

### Feature без цифр силы

В описании/identity — правило («рядом с союзником-волком бьёт дважды»), не «+3 ATK».
Если правилу нужны числа — из бэнда или фиксированных дизайн-констант (1 DEF, 1 hit),
не из уникальной HP-таблицы типа.

### Имплементация (когда дойдём)

1. Один `POWER_BANDS` + `ARCHETYPES` в content.
2. Тип врага: `archetype` + abilities/feature; без своих `tiers[]` HP/ATK.
3. `createTieredEnemy` читает band(floor) × archetype.
4. Прогнать act1 sim против текущих целей reach/clear.

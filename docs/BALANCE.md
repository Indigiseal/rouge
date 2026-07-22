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

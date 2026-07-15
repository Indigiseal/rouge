# Balance Simulation Metrics Catalog

> **Document type:** *Metrics Catalog* (also called *Metrics Dictionary*, *Data Dictionary*, or *Telemetry Specification*).
>
> In game development this sits between **game design metrics** (what you want to measure about player experience) and **analytics instrumentation** (how events are sent from a live client). Our tool is offline Monte Carlo simulation, so this catalog describes **what the balance sim records**, **how each field is defined**, and **which derived KPIs Grafana computes** on top of raw data.

**Scope:** headless runs via `stats-db` mode → SQLite (`sim/db/stats.sqlite`) → Grafana dashboard *Sim Balance*.

**Last updated:** 2026-07-15

---

## How to run & view

```bash
# Record a batch (name is optional; mode defaults to balance in npm script)
npm run sim:stats-db-balance -- 500 my-experiment-v1

# Grafana dashboards (Sim folder)
npm run sim:grafana          # http://localhost:3030  admin/admin
#   Sim Balance         — single batch
#   Sim Balance Compare — Batch A vs B (B optional)

# Lightweight local dashboard (no Docker)
npm run sim:dashboard        # http://localhost:3040
```

**Batch label** (`sim_batches.label`) — human-readable run name, shown in Grafana batch selector.

**Sim modes** (`sim_batches.mode`):

| Mode | Meaning |
|------|---------|
| `balance` | No meta progression, no amulets — baseline balance slice |
| `fresh` | Clean start, default relic loadout |
| `geared` | All relics unlocked |
| `accumulate` | Career loop: deaths unlock meta between runs |

---

## Architecture

```
CLI batch (sim_batches)
  └── run (sim_runs) — one full map playthrough
        └── floor visit (sim_floor_visits) — one map node
              ├── weapon snapshots (sim_weapon_snapshots) — start/end of visit
              ├── enemy spawns (sim_enemy_spawns) — combat board at spawn
              └── combat damage totals — per combat visit only
```

**Granularity:**

- **Batch** — one CLI invocation, N Monte Carlo runs, shared config.
- **Run** — single playthrough from act 1 to win or death.
- **Floor visit** — one entered room/node (combat, shop, rest, event, …).
- **Weapon snapshot** — one weapon row in inventory or equipped at visit boundary.
- **Enemy spawn** — one enemy/boss card on the board at combat start.

**Fidelity notes (sim ≠ live game 1:1):**

- Combat uses the **real** `CardSystem` / `attackEnemy` path via mock scene.
- Station rooms (SHOP, EVENT, REST, …) use **approximate** handlers in `balance-sim.js`.
- `RARE_SHOP` is modeled like a normal shop.
- ELITE post-fight chest is not modeled.
- Inventory is effectively unlimited in sim (Bottomless Bag is a no-op).

---

## Raw metrics (database fields)

### `sim_batches` — experiment metadata

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Auto-increment batch id |
| `created_at` | text | UTC timestamp when batch started |
| `label` | text | User-provided run name (e.g. `baseline-v2`) |
| `mode` | text | Sim mode: `balance`, `fresh`, `geared`, `accumulate` |
| `runs_planned` | int | Requested number of runs |
| `runs_completed` | int | Actually finished runs |
| `config_json` | text | JSON snapshot: `{ noBag, metaMode, runLabel }` |

---

### `sim_runs` — run-level outcomes

| Field | Type | Description |
|-------|------|-------------|
| `batch_id` | int | Parent batch |
| `run_number` | int | 1-based index within batch |
| `won` | 0/1 | Reached floor 45 alive |
| `reached_floor` | int | Last floor number visited (1–45) |
| `died` | 0/1 | Run ended in death |
| `end_reason` | text | Why the run ended — see enum below |
| `death_encounter_type` | text | Room type where death occurred (null if won) |

**`end_reason` enum:**

| Value | Meaning |
|-------|---------|
| `win` | Cleared final boss floor |
| `hp` | Player HP reached 0 (normal combat/event damage death) |
| `weapon` | Combat stalemate: enemies remain, no weapon durability left, no magic cards — mirrors `gameScene.hasCombatStalemate` logic |

---

### `sim_floor_visits` — per-room visit

| Field | Type | Description |
|-------|------|-------------|
| `floor_number` | int | Global floor index (act 1: 1–15, act 2: 16–30, act 3: 31–45) |
| `visit_order` | int | Sequential step within the run (1, 2, 3, …) |
| `encounter_type` | text | Map node type: `COMBAT`, `ELITE`, `BOSS`, `SHOP`, `REST`, `EVENT`, … |
| `player_hp_start` | int | Player HP at visit start (after regear) |
| `player_hp_end` | int | Player HP at visit end |
| `player_max_hp_start` | int | Max HP at visit start |
| `player_max_hp_end` | int | Max HP at visit end |
| `combat_damage_dealt` | int | Sum of damage values on all weapon hits this combat (null for non-combat) |
| `combat_damage_wasted` | int | Sum of overkill per hit: `max(0, hit_damage − target_hp_before_hit)` |

**Derived per visit (not stored, computed in queries):**

- `hp_lost = max(0, player_hp_start − player_hp_end)`

**Capture timing:**

- `start` snapshot: after `regear`, before room handler.
- `end` snapshot: after room handler, before next node.
- Combat damage: accumulated inside `runCombat()` only for `COMBAT` / `ELITE` / `BOSS`.

---

### `sim_weapon_snapshots` — inventory weapon state

One row per unique weapon object at `phase = 'start'` or `'end'` of a floor visit.

| Field | Type | Description |
|-------|------|-------------|
| `phase` | text | `start` or `end` |
| `is_equipped` | 0/1 | Currently equipped weapon |
| `inv_index` | int | Inventory slot (null if equipped) |
| `name` | text | Weapon display name |
| `weapon_type` | text | `sword`, `axe`, `bow`, `dagger`, … |
| `damage` | int | Base damage per hit |
| `durability` | int | Remaining pips |
| `max_durability` | int | Max pips |
| `rarity` | text | `common`, `uncommon`, `rare`, `epic`, `legendary` |
| `weapon_range` | text | `melee` or `ranged` |
| `gem_effect` | text | Socketed gem type (e.g. `poison`) |
| `gem_count` | int | Number of gems |
| `pip_output` | int | **Theoretical total damage capacity:** `damage × durability` |

**Key derived aggregate:**

- `Σ pip_output` per visit = sum of `pip_output` across all carried weapons at that phase.
- Used as a proxy for “how much damage the player *could* deal if every pip hit perfectly”.

---

### `sim_enemy_spawns` — combat board at spawn

Recorded once per combat visit, **before any hits**, from `boardCards` after `spawnFloorCards()`.

| Field | Type | Description |
|-------|------|-------------|
| `spawn_order` | int | Order on board (1-based) |
| `name` | text | Enemy name |
| `enemy_type` | text | `enemy` or `boss` |
| `role` | text | `MELEE` or `RANGED` |
| `health` | int | HP at spawn |
| `max_health` | int | Max HP |
| `attack` | int | Attack value |
| `is_boss` | 0/1 | Boss flag |
| `is_ranged_type` | 0/1 | Ranged archetype flag |
| `board_index` | int | Index on combat board |

**Key derived aggregate:**

- `Σ health` per visit = total enemy HP pool at combat start.

---

## Derived KPIs (Grafana dashboard)

These are **not stored**; computed via SQL at query time. Dashboard: `sim/db/grafana/dashboards/sim-balance.json` (generated by `build-dashboard.mjs`).

### Overview

| KPI | Formula / source | Purpose |
|-----|------------------|---------|
| **Runs** | `COUNT(sim_runs)` | Batch size |
| **Win rate** | `SUM(won) / COUNT(*)` | Primary balance health indicator |
| **Avg floor** | `AVG(reached_floor)` | Progression depth |
| **Deaths** | `COUNT(*) WHERE died=1` | Death count |
| **Encounter types** | `GROUP BY encounter_type` on floor visits | Room mix in sampled paths (donut) |

### 1 · Deaths & progression

| KPI | Description |
|-----|-------------|
| **Run end reason** | Distribution of `win` / `hp` / `weapon` |
| **Last floor reached** | Histogram of `reached_floor` — where runs end |
| **Deaths by room type** | `death_encounter_type` for died runs |
| **Deaths: floor × room type** | Cross-tab: which floor + room kills players |
| **Funnel: runs reaching floor** | For each floor F: count of runs with `reached_floor ≥ F` |
| **Avg player HP lost per visit** | Mean HP drop per floor visit, by floor |
| **Run outcomes** | Table of end reasons with counts and % |

### 2 · Weapons & damage

| KPI | Description |
|-----|-------------|
| **Weapon pips vs enemy HP (combat start)** | Per floor: avg `Σ pip_output` (start) vs avg `Σ enemy health` at spawn |
| **Weapon pips: floor start vs end** | How much damage capacity remains after each visit |
| **Can clear room (pips ≥ HP) %** | % of combats where start pips ≥ spawn enemy HP — optimistic upper bound |
| **Combat damage: effective vs overkill** | Avg `(dealt − wasted)` vs avg `wasted` per floor |
| **Overkill % of damage dealt** | `SUM(wasted) / SUM(dealt) × 100` — “damage into the void” |
| **Combats detail table** | Per-combat: start/end pips, enemy HP, dealt, wasted, overkill % |

**Overkill intuition:** hitting a 5 HP enemy for 7 damage wastes 2. High overkill % means players carry oversized weapons or finishers are inefficient — durability is spent without reducing enemy HP pool.

**Pips vs HP caveat:** pips assume every hit connects at full damage; real fights lose efficiency to blocks, misses, melee frontline, hidden cards, and AP starvation (20% penalty).

### 3 · Monsters

| KPI | Description |
|-----|-------------|
| **Enemy types at spawn** | `enemy` vs `boss` share |
| **Total enemy HP at spawn by floor** | min / max / avg of `Σ health` per combat |
| **Summary: floor × enemy name** | Spawn count, avg HP, avg attack per enemy per floor |
| **All spawns (detail)** | Raw row-level spawn log |

---

## Core design metrics glossary

Terms we use when discussing balance from this data:

| Term | Definition |
|------|------------|
| **Floor** | Global dungeon index 1–45 (not “room within act”) |
| **Pip** | One weapon durability charge = one attack |
| **Pip output** | `damage × durability` — total damage budget on a weapon |
| **Carried weapons** | Equipped + all weapons in inventory (deduped by object ref) |
| **Clearability** | Whether start pips ≥ spawn enemy HP (necessary but not sufficient to win) |
| **Overkill / wasted damage** | Damage exceeding enemy HP on the killing hit |
| **Funnel** | Retention curve: how many runs survive to each floor |
| **Stalemate death** | `end_reason = weapon` — out of damage resources mid-combat |
| **Encounter type** | Map generator room category |

---

## Related systems (not in stats-db SQLite)

These exist in other sim modes and are **not** persisted to `stats.sqlite` unless noted:

| System | Mode | Notes |
|--------|------|-------|
| `loot-stats` | `npm run sim:loot-stats` | In-memory weapon/enemy/clearability aggregates; JSON export |
| Console `report()` | default sim modes | Win rate, durability breaks, shop affordability, merge milestones |
| `newMetrics()` floors | all sim runs | Per-floor hpStart/hpEnd/coins/combats in RAM only |

When adding a new persisted metric, update: `schema.sql` → `stats-db.js` migration → `stats-recorder.js` capture → `build-dashboard.mjs` panel → this catalog.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-15 | Compare dashboard `Sim Balance Compare` (Batch A vs optional Batch B) |
| 2026-07-15 | Initial catalog: stats-db schema, overkill metrics, Grafana sections (Overview / Deaths / Weapons / Monsters), batch labels |

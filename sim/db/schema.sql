-- Dungeon balance sim — normalized stats storage (3NF).
-- SQLite dialect; portable to PostgreSQL with minor type tweaks.

PRAGMA foreign_keys = ON;

-- Batch of Monte-Carlo runs (one CLI invocation = one batch).
CREATE TABLE IF NOT EXISTS sim_batches (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  label           TEXT,
  mode            TEXT NOT NULL,
  runs_planned    INTEGER NOT NULL,
  runs_completed  INTEGER NOT NULL DEFAULT 0,
  config_json     TEXT
);

-- Single playthrough inside a batch.
CREATE TABLE IF NOT EXISTS sim_runs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id        INTEGER NOT NULL REFERENCES sim_batches(id) ON DELETE CASCADE,
  run_number      INTEGER NOT NULL,
  won             INTEGER NOT NULL DEFAULT 0,
  reached_floor   INTEGER,
  died            INTEGER NOT NULL DEFAULT 0,
  end_reason      TEXT,
  death_encounter_type TEXT,
  UNIQUE (batch_id, run_number)
);

CREATE INDEX IF NOT EXISTS idx_sim_runs_batch ON sim_runs(batch_id);

-- One map node visit (floor step) inside a run.
CREATE TABLE IF NOT EXISTS sim_floor_visits (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id          INTEGER NOT NULL REFERENCES sim_runs(id) ON DELETE CASCADE,
  floor_number    INTEGER NOT NULL,
  visit_order     INTEGER NOT NULL,
  encounter_type  TEXT NOT NULL,
  player_hp_start INTEGER,
  player_hp_end   INTEGER,
  player_max_hp_start INTEGER,
  player_max_hp_end   INTEGER,
  combat_damage_dealt  INTEGER,
  combat_damage_wasted INTEGER,
  combat_damage_taken INTEGER,
  combat_damage_blocked_armor INTEGER,
  combat_damage_dodged INTEGER,
  combat_specialization_dual_wield INTEGER,
  combat_specialization_gem INTEGER,
  ap_spent INTEGER,
  hungry_actions INTEGER,
  UNIQUE (run_id, visit_order)
);

CREATE INDEX IF NOT EXISTS idx_floor_visits_run ON sim_floor_visits(run_id);
CREATE INDEX IF NOT EXISTS idx_floor_visits_floor ON sim_floor_visits(floor_number);

-- Weapon rows at floor start or end (inventory + equipped, deduped by object ref at capture time).
CREATE TABLE IF NOT EXISTS sim_weapon_snapshots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  floor_visit_id  INTEGER NOT NULL REFERENCES sim_floor_visits(id) ON DELETE CASCADE,
  phase           TEXT NOT NULL CHECK (phase IN ('start', 'end')),
  is_equipped     INTEGER NOT NULL DEFAULT 0,
  inv_index       INTEGER,
  name            TEXT,
  weapon_type     TEXT,
  damage          INTEGER NOT NULL DEFAULT 0,
  durability      INTEGER NOT NULL DEFAULT 0,
  max_durability  INTEGER NOT NULL DEFAULT 0,
  rarity          TEXT,
  weapon_range    TEXT,
  gem_effect      TEXT,
  gem_count       INTEGER NOT NULL DEFAULT 0,
  pip_output      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_weapon_snapshots_visit ON sim_weapon_snapshots(floor_visit_id, phase);

-- Enemies on the board at combat spawn (before any hits).
CREATE TABLE IF NOT EXISTS sim_enemy_spawns (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  floor_visit_id  INTEGER NOT NULL REFERENCES sim_floor_visits(id) ON DELETE CASCADE,
  spawn_order     INTEGER NOT NULL,
  name            TEXT,
  enemy_type      TEXT NOT NULL,
  role            TEXT,
  health          INTEGER NOT NULL DEFAULT 0,
  max_health      INTEGER,
  attack          INTEGER NOT NULL DEFAULT 0,
  is_boss         INTEGER NOT NULL DEFAULT 0,
  is_ranged_type  INTEGER NOT NULL DEFAULT 0,
  board_index     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_enemy_spawns_visit ON sim_enemy_spawns(floor_visit_id);

-- Amulet equipped during a floor visit (shop/floor/boss/event — not starting loadout).
CREATE TABLE IF NOT EXISTS sim_amulet_gains (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  floor_visit_id  INTEGER NOT NULL REFERENCES sim_floor_visits(id) ON DELETE CASCADE,
  amulet_id       TEXT NOT NULL,
  rarity          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_amulet_gains_visit ON sim_amulet_gains(floor_visit_id);
CREATE INDEX IF NOT EXISTS idx_amulet_gains_rarity ON sim_amulet_gains(rarity);

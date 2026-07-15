// sim/db/stats-db.js — SQLite persistence for floor-level sim statistics.

import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = join(__dirname, 'stats.sqlite');
const SCHEMA_PATH = join(__dirname, 'schema.sql');

export class StatsDatabase {
  constructor(dbPath = DEFAULT_DB_PATH) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this._migrate();
    this._prepareStatements();
    this.dbPath = dbPath;
  }

  _migrate() {
    this.db.exec(readFileSync(SCHEMA_PATH, 'utf8'));
    this._ensureColumns();
  }

  _ensureColumns() {
    const tableCols = (table) => new Set(
      this.db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name),
    );
    const addCol = (table, col, type) => {
      if (!tableCols(table).has(col)) {
        this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
      }
    };
    addCol('sim_runs', 'end_reason', 'TEXT');
    addCol('sim_runs', 'death_encounter_type', 'TEXT');
    addCol('sim_floor_visits', 'player_max_hp_start', 'INTEGER');
    addCol('sim_floor_visits', 'player_max_hp_end', 'INTEGER');
    addCol('sim_floor_visits', 'combat_damage_dealt', 'INTEGER');
    addCol('sim_floor_visits', 'combat_damage_wasted', 'INTEGER');
  }

  _prepareStatements() {
    this.stmtInsertBatch = this.db.prepare(`
      INSERT INTO sim_batches (label, mode, runs_planned, config_json)
      VALUES (@label, @mode, @runs_planned, @config_json)
    `);
    this.stmtFinishBatch = this.db.prepare(`
      UPDATE sim_batches SET runs_completed = @runs_completed WHERE id = @id
    `);
    this.stmtInsertRun = this.db.prepare(`
      INSERT INTO sim_runs (batch_id, run_number) VALUES (@batch_id, @run_number)
    `);
    this.stmtFinishRun = this.db.prepare(`
      UPDATE sim_runs
      SET won = @won,
          reached_floor = @reached_floor,
          died = @died,
          end_reason = @end_reason,
          death_encounter_type = @death_encounter_type
      WHERE id = @id
    `);
    this.stmtInsertFloorVisit = this.db.prepare(`
      INSERT INTO sim_floor_visits (
        run_id, floor_number, visit_order, encounter_type,
        player_hp_start, player_max_hp_start
      ) VALUES (
        @run_id, @floor_number, @visit_order, @encounter_type,
        @player_hp_start, @player_max_hp_start
      )
    `);
    this.stmtFinishFloorVisit = this.db.prepare(`
      UPDATE sim_floor_visits
      SET player_hp_end = @player_hp_end,
          player_max_hp_end = @player_max_hp_end,
          combat_damage_dealt = @combat_damage_dealt,
          combat_damage_wasted = @combat_damage_wasted
      WHERE id = @id
    `);
    this.stmtInsertWeapon = this.db.prepare(`
      INSERT INTO sim_weapon_snapshots (
        floor_visit_id, phase, is_equipped, inv_index, name, weapon_type,
        damage, durability, max_durability, rarity, weapon_range,
        gem_effect, gem_count, pip_output
      ) VALUES (
        @floor_visit_id, @phase, @is_equipped, @inv_index, @name, @weapon_type,
        @damage, @durability, @max_durability, @rarity, @weapon_range,
        @gem_effect, @gem_count, @pip_output
      )
    `);
    this.stmtInsertEnemy = this.db.prepare(`
      INSERT INTO sim_enemy_spawns (
        floor_visit_id, spawn_order, name, enemy_type, role,
        health, max_health, attack, is_boss, is_ranged_type, board_index
      ) VALUES (
        @floor_visit_id, @spawn_order, @name, @enemy_type, @role,
        @health, @max_health, @attack, @is_boss, @is_ranged_type, @board_index
      )
    `);
  }

  beginBatch({ label = null, mode, runsPlanned, config = null }) {
    const info = this.stmtInsertBatch.run({
      label,
      mode,
      runs_planned: runsPlanned,
      config_json: config ? JSON.stringify(config) : null,
    });
    return info.lastInsertRowid;
  }

  finishBatch(batchId, runsCompleted) {
    this.stmtFinishBatch.run({ id: batchId, runs_completed: runsCompleted });
  }

  beginRun(batchId, runNumber) {
    const info = this.stmtInsertRun.run({ batch_id: batchId, run_number: runNumber });
    return info.lastInsertRowid;
  }

  finishRun(runId, { won, reachedFloor, died, endReason, deathEncounterType }) {
    this.stmtFinishRun.run({
      id: runId,
      won: won ? 1 : 0,
      reached_floor: reachedFloor ?? null,
      died: died ? 1 : 0,
      end_reason: endReason ?? null,
      death_encounter_type: deathEncounterType ?? null,
    });
  }

  beginFloorVisit(runId, { floorNumber, visitOrder, encounterType, playerHpStart, playerMaxHpStart }) {
    const info = this.stmtInsertFloorVisit.run({
      run_id: runId,
      floor_number: floorNumber,
      visit_order: visitOrder,
      encounter_type: encounterType,
      player_hp_start: playerHpStart ?? null,
      player_max_hp_start: playerMaxHpStart ?? null,
    });
    return info.lastInsertRowid;
  }

  finishFloorVisit(floorVisitId, playerHpEnd, playerMaxHpEnd, combat = {}) {
    this.stmtFinishFloorVisit.run({
      id: floorVisitId,
      player_hp_end: playerHpEnd ?? null,
      player_max_hp_end: playerMaxHpEnd ?? null,
      combat_damage_dealt: combat.damageDealt ?? null,
      combat_damage_wasted: combat.damageWasted ?? null,
    });
  }

  insertWeaponSnapshot(floorVisitId, phase, weaponRow) {
    this.stmtInsertWeapon.run({ floor_visit_id: floorVisitId, phase, ...weaponRow });
  }

  insertEnemySpawn(floorVisitId, enemyRow) {
    this.stmtInsertEnemy.run({ floor_visit_id: floorVisitId, ...enemyRow });
  }

  /** Wrap a full batch in one transaction (all runs). */
  runInTransaction(fn) {
    return this.db.transaction(fn)();
  }

  query(sql, params = {}) {
    return this.db.prepare(sql).all(params);
  }

  close() {
    this.db.close();
  }
}

export { DEFAULT_DB_PATH };

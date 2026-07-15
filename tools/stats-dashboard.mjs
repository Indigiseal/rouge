// tools/stats-dashboard.mjs — local charts over sim/db/stats.sqlite (no Docker needed).

import http from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DB_PATH = join(ROOT, 'sim/db/stats.sqlite');
const PORT = parseInt(process.env.STATS_DASHBOARD_PORT || '3040', 10);

function openDb() {
  return new Database(DB_PATH, { readonly: true, fileMustExist: true });
}

function latestBatchId(db) {
  return db.prepare('SELECT id FROM sim_batches ORDER BY id DESC LIMIT 1').get()?.id ?? null;
}

function q(db, sql, params = {}) {
  return db.prepare(sql).all(params);
}

function buildPayload(batchId) {
  const db = openDb();
  try {
    const overview = q(db, `
      SELECT
        COUNT(*) AS runs,
        SUM(won) AS wins,
        ROUND(100.0 * SUM(won) / COUNT(*), 1) AS win_pct,
        ROUND(AVG(reached_floor), 1) AS avg_floor
      FROM sim_runs WHERE batch_id = @batchId
    `, { batchId })[0] || {};

    const encounters = q(db, `
      SELECT fv.encounter_type AS label, COUNT(*) AS value
      FROM sim_floor_visits fv
      JOIN sim_runs r ON r.id = fv.run_id
      WHERE r.batch_id = @batchId
      GROUP BY fv.encounter_type ORDER BY value DESC
    `, { batchId });

    const floorReach = q(db, `
      WITH floors AS (
        SELECT DISTINCT floor_number AS floor
        FROM sim_floor_visits fv
        JOIN sim_runs r ON r.id = fv.run_id
        WHERE r.batch_id = @batchId
        UNION
        SELECT DISTINCT reached_floor AS floor FROM sim_runs WHERE batch_id = @batchId
      )
      SELECT f.floor,
        (SELECT COUNT(*) FROM sim_runs r
         WHERE r.batch_id = @batchId AND r.reached_floor >= f.floor) AS runs_reached
      FROM floors f
      ORDER BY f.floor
    `, { batchId });

    const pipStart = q(db, `
      SELECT fv.floor_number AS floor,
             MIN(tot.pips) AS min_pips,
             MAX(tot.pips) AS max_pips,
             ROUND(AVG(tot.pips), 1) AS avg_pips
      FROM (
        SELECT floor_visit_id, SUM(pip_output) AS pips
        FROM sim_weapon_snapshots WHERE phase = 'start'
        GROUP BY floor_visit_id
      ) tot
      JOIN sim_floor_visits fv ON fv.id = tot.floor_visit_id
      JOIN sim_runs r ON r.id = fv.run_id
      WHERE r.batch_id = @batchId
        AND fv.encounter_type IN ('COMBAT','ELITE','BOSS')
      GROUP BY fv.floor_number ORDER BY fv.floor_number
    `, { batchId });

    const enemyHp = q(db, `
      SELECT fv.floor_number AS floor,
             MIN(tot.hp) AS min_hp,
             MAX(tot.hp) AS max_hp,
             ROUND(AVG(tot.hp), 1) AS avg_hp
      FROM (
        SELECT floor_visit_id, SUM(health) AS hp
        FROM sim_enemy_spawns GROUP BY floor_visit_id
      ) tot
      JOIN sim_floor_visits fv ON fv.id = tot.floor_visit_id
      JOIN sim_runs r ON r.id = fv.run_id
      WHERE r.batch_id = @batchId
      GROUP BY fv.floor_number ORDER BY fv.floor_number
    `, { batchId });

    const clearPct = q(db, `
      SELECT fv.floor_number AS floor,
             ROUND(100.0 * SUM(CASE WHEN ws.start_pips >= es.enemy_hp THEN 1 ELSE 0 END) / COUNT(*), 1) AS clear_pct
      FROM sim_floor_visits fv
      JOIN sim_runs r ON r.id = fv.run_id
      JOIN (
        SELECT floor_visit_id, SUM(pip_output) AS start_pips
        FROM sim_weapon_snapshots WHERE phase = 'start'
        GROUP BY floor_visit_id
      ) ws ON ws.floor_visit_id = fv.id
      JOIN (
        SELECT floor_visit_id, SUM(health) AS enemy_hp
        FROM sim_enemy_spawns GROUP BY floor_visit_id
      ) es ON es.floor_visit_id = fv.id
      WHERE r.batch_id = @batchId
        AND fv.encounter_type IN ('COMBAT','ELITE','BOSS')
      GROUP BY fv.floor_number ORDER BY fv.floor_number
    `, { batchId });

    const pipEnd = q(db, `
      SELECT fv.floor_number AS floor,
             MIN(tot.pips) AS min_end,
             MAX(tot.pips) AS max_end,
             ROUND(AVG(tot.pips), 1) AS avg_end
      FROM (
        SELECT floor_visit_id, SUM(pip_output) AS pips
        FROM sim_weapon_snapshots WHERE phase = 'end'
        GROUP BY floor_visit_id
      ) tot
      JOIN sim_floor_visits fv ON fv.id = tot.floor_visit_id
      JOIN sim_runs r ON r.id = fv.run_id
      WHERE r.batch_id = @batchId
      GROUP BY fv.floor_number ORDER BY fv.floor_number
    `, { batchId });

    const batches = q(db, `
      SELECT id, label, mode, runs_completed, created_at
      FROM sim_batches ORDER BY id DESC
    `);

    return { batchId, batches, overview, encounters, floorReach, pipStart, enemyHp, clearPct, pipEnd };
  } finally {
    db.close();
  }
}

const HTML = readFileSync(join(__dirname, 'stats-dashboard.html'), 'utf8');

const server = http.createServer((req, res) => {
  try {
    if (req.url?.startsWith('/api/data')) {
      const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
      const db = openDb();
      let batchId = parseInt(url.searchParams.get('batch_id') || '', 10);
      if (!batchId) batchId = latestBatchId(db);
      db.close();
      if (!batchId) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No batches in database. Run: npm run sim:stats-db-balance' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(buildPayload(batchId)));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(String(err.message || err));
  }
});

server.listen(PORT, () => {
  console.log(`Stats dashboard: http://localhost:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
  console.log('Refresh after new sim runs (auto every 30s in browser).');
});

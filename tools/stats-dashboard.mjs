// tools/stats-dashboard.mjs — local charts over sim/db/stats.sqlite (no Docker needed).

import http from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import Database from 'better-sqlite3';
import { getBehaviorPresetNames, getBehaviorCatalog } from '../sim/behavior-knobs.js';
import { getAmuletCatalog, getRelicCatalog } from '../sim/sim-catalog.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DB_PATH = join(ROOT, 'sim/db/stats.sqlite');
const PORT = parseInt(process.env.STATS_DASHBOARD_PORT || '3040', 10);
const BEHAVIOR_PRESETS = getBehaviorPresetNames();
const BEHAVIOR_CATALOG = getBehaviorCatalog();
const RELIC_CATALOG = getRelicCatalog();
const AMULET_CATALOG = getAmuletCatalog();
const RELIC_IDS = new Set(RELIC_CATALOG.map((r) => r.id));
const AMULET_IDS = new Set(AMULET_CATALOG.map((a) => a.id));
let currentRun = null;

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

function sendJson(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function getRunStatus() {
  if (!currentRun) return { running: false, presets: BEHAVIOR_PRESETS };
  return {
    running: currentRun.running,
    startedAt: currentRun.startedAt,
    finishedAt: currentRun.finishedAt,
    mode: currentRun.mode,
    args: currentRun.args,
    exitCode: currentRun.exitCode,
    output: currentRun.output.slice(-20000),
    presets: BEHAVIOR_PRESETS,
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) reject(new Error('Body too large'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function filterKnownIds(list, known) {
  if (!Array.isArray(list)) return null;
  return [...new Set(list.map(String).filter((id) => known.has(id)))];
}

function pushListFlag(args, flag, ids) {
  // Prefer --flag=a,b so empty lists stay attached as --flag=
  args.push(`${flag}=${ids.join(',')}`);
}

function startRun(config) {
  if (currentRun?.running) throw new Error('Sim run already in progress');
  const mode = config.mode === 'sweep' ? 'sweep' : 'stats-db';
  const args = ['sim/balance-sim.js', mode];
  const runs = Math.max(1, parseInt(config.runs, 10) || 100);
  const behavior = config.behavior && BEHAVIOR_PRESETS.includes(config.behavior) ? config.behavior : 'balanced';

  if (mode === 'stats-db') {
    const preset = config.preset || 'balance';
    const label = (config.label || '').trim() || `ui-${preset}-${Date.now()}`;
    args.push(String(runs), preset, label, '--behavior', behavior);

    const metaOn = config.meta === true || (config.meta !== false && ['geared', 'accumulate'].includes(preset));
    const amuletsOn = config.amulets === true || (config.amulets !== false && preset !== 'balance');

    if (config.meta === true) args.push('--meta');
    else if (config.meta === false) args.push('--no-meta');
    if (config.amulets === true) args.push('--amulets');
    else if (config.amulets === false) args.push('--no-amulets');

    if (metaOn && config.meta !== false) {
      const metaPool = filterKnownIds(config.metaPool, RELIC_IDS);
      const metaStart = filterKnownIds(config.metaStart, RELIC_IDS);
      if (metaPool) pushListFlag(args, '--meta-pool', metaPool);
      if (metaStart) pushListFlag(args, '--meta-start', metaStart);
    }

    if (amuletsOn && config.amulets !== false) {
      const amuletPool = filterKnownIds(config.amuletPool, AMULET_IDS);
      const amuletStart = filterKnownIds(config.amuletStart, AMULET_IDS);
      if (amuletPool) pushListFlag(args, '--amulet-pool', amuletPool);
      if (amuletStart) pushListFlag(args, '--amulet-start', amuletStart);
      else if (!amuletStart && config.amuletLoadout && config.amuletLoadout !== 'none') {
        args.push('--amulet-loadout', config.amuletLoadout);
      }
    }
  } else {
    args.push(String(runs));
    const subset = (config.amuletSubset || '').trim();
    if (subset) args.push(subset);
    args.push('--behavior', behavior);
  }

  const child = spawn('node', args, {
    cwd: ROOT,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  currentRun = {
    running: true,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    mode,
    args,
    output: '',
  };
  const append = (chunk) => {
    currentRun.output += chunk.toString();
    if (currentRun.output.length > 50000) currentRun.output = currentRun.output.slice(-50000);
  };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  child.on('close', (code) => {
    currentRun.running = false;
    currentRun.exitCode = code;
    currentRun.finishedAt = new Date().toISOString();
  });
}

const server = http.createServer((req, res) => {
  try {
    if (req.method === 'GET' && req.url?.startsWith('/api/meta')) {
      sendJson(res, 200, {
        presets: BEHAVIOR_PRESETS,
        behaviors: BEHAVIOR_CATALOG,
        relics: RELIC_CATALOG,
        amulets: AMULET_CATALOG,
        hints: {
          meta: 'Метапрогрессия: релики с аккаунта. Выкл = как fresh без призов.',
          amulets: 'Амулеты: дроп/шоп/ивенты. Выкл = полностью без амулетов.',
          metaPool: 'Доступен: может быть в эксперименте (старт и/или unlock в accumulate).',
          metaStart: 'Сначала: уже разблокирован на старте каждого run (в accumulate — начальный набор).',
          amuletPool: 'Доступен: может выпасть/купиться/выдаться в run.',
          amuletStart: 'Сначала: экипирован с F1.',
          preset: 'balance=без меты/амулетов; fresh=амулеты; geared=все релики+амулеты; accumulate=карьера смертей.',
          behavior: 'Политика бота: лут, магия, риск. См. расшифровку у поля Behavior.',
        },
        runStatus: getRunStatus(),
      });
      return;
    }
    if (req.method === 'GET' && req.url?.startsWith('/api/run-status')) {
      sendJson(res, 200, getRunStatus());
      return;
    }
    if (req.method === 'POST' && req.url === '/api/run') {
      readBody(req).then((body) => {
        const config = body ? JSON.parse(body) : {};
        startRun(config);
        sendJson(res, 202, getRunStatus());
      }).catch((err) => {
        sendJson(res, 400, { error: String(err.message || err), runStatus: getRunStatus() });
      });
      return;
    }
    if (req.url?.startsWith('/api/data')) {
      const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
      const db = openDb();
      let batchId = parseInt(url.searchParams.get('batch_id') || '', 10);
      if (!batchId) batchId = latestBatchId(db);
      db.close();
      if (!batchId) {
        sendJson(res, 404, { error: 'No batches in database. Run: npm run sim:stats-db-balance' });
        return;
      }
      sendJson(res, 200, buildPayload(batchId));
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

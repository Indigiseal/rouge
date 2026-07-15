#!/usr/bin/env node
// Analyze a stats batch and iteratively tune balance-knobs.js, then run validation sims.
//
//   node sim/balance-tune.mjs analyze origin
//   node sim/balance-tune.mjs tune origin 3 1000
//     → 3 iterations × 1000 runs, writes tuned knobs + sim batches tune-iter-N

import Database from 'better-sqlite3';
import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { KNOBS, actForFloor, hpActKey } from './balance-knobs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DB_PATH = join(__dirname, 'db/stats.sqlite');
const KNOBS_PATH = join(__dirname, 'balance-knobs.js');
const TARGET_CLEAR = 85;
const CLEAR_BAND = 5;

function findBatch(db, name) {
  const row = db.prepare(`
    SELECT id, label, runs_completed FROM sim_batches
    WHERE label = ? OR CAST(id AS TEXT) = ?
    ORDER BY id DESC LIMIT 1
  `).get(name, name);
  if (!row) throw new Error(`Batch not found: ${name}`);
  return row;
}

function analyzeBatch(db, batchId) {
  const overview = db.prepare(`
    SELECT COUNT(*) runs, ROUND(100.0*SUM(won)/COUNT(*),1) win_pct,
      ROUND(AVG(reached_floor),1) avg_floor,
      SUM(CASE WHEN end_reason='weapon' THEN 1 ELSE 0 END) weapon_deaths,
      SUM(CASE WHEN end_reason='hp' THEN 1 ELSE 0 END) hp_deaths
    FROM sim_runs WHERE batch_id = ?
  `).get(batchId);

  const perFloor = db.prepare(`
    WITH combat AS (
      SELECT fv.floor_number AS floor,
        ws.start_pips, es.enemy_hp,
        CASE WHEN ws.start_pips >= es.enemy_hp THEN 1 ELSE 0 END AS can_clear,
        MAX(0, fv.player_hp_start - fv.player_hp_end) AS hp_lost
      FROM sim_floor_visits fv
      JOIN sim_runs r ON r.id = fv.run_id
      JOIN (SELECT floor_visit_id, SUM(pip_output) AS start_pips FROM sim_weapon_snapshots WHERE phase='start' GROUP BY floor_visit_id) ws ON ws.floor_visit_id=fv.id
      JOIN (SELECT floor_visit_id, SUM(health) AS enemy_hp FROM sim_enemy_spawns GROUP BY floor_visit_id) es ON es.floor_visit_id=fv.id
      WHERE r.batch_id=? AND fv.encounter_type IN ('COMBAT','ELITE','BOSS')
    )
    SELECT floor,
      ROUND(AVG(start_pips),1) pips,
      ROUND(AVG(enemy_hp),1) ehp,
      ROUND(100.0*AVG(can_clear),1) clear_pct,
      ROUND(AVG(hp_lost),1) hp_lost,
      COUNT(*) n
    FROM combat GROUP BY floor ORDER BY floor
  `).all(batchId);

  const funnel = db.prepare(`
    WITH floors AS (
      SELECT DISTINCT floor_number AS floor FROM sim_floor_visits fv
      JOIN sim_runs r ON r.id=fv.run_id WHERE r.batch_id=?
      UNION SELECT DISTINCT reached_floor FROM sim_runs WHERE batch_id=?
    )
    SELECT f.floor,
      (SELECT COUNT(*) FROM sim_runs r WHERE r.batch_id=? AND r.reached_floor >= f.floor) AS reached
    FROM floors f ORDER BY f.floor
  `).all(batchId, batchId, batchId);

  const runs = overview.runs || 1;
  const funnelPct = funnel.map((f) => ({ floor: f.floor, pct: 100 * f.reached / runs }));

  let funnelR2 = 0;
  if (funnelPct.length >= 3) {
    const xs = funnelPct.map((f) => f.floor);
    const ys = funnelPct.map((f) => f.pct);
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0; let dx = 0; let dy = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - mx) * (ys[i] - my);
      dx += (xs[i] - mx) ** 2;
      dy += (ys[i] - my) ** 2;
    }
    const r = dx && dy ? num / Math.sqrt(dx * dy) : 0;
    funnelR2 = r * r;
  }

  const clearErr = perFloor.length
    ? perFloor.reduce((s, f) => s + Math.abs(f.clear_pct - TARGET_CLEAR), 0) / perFloor.length
    : 999;

  const byAct = {};
  for (const f of perFloor) {
    const key = hpActKey(f.floor);
    if (!byAct[key]) byAct[key] = [];
    byAct[key].push(f);
  }

  return { overview, perFloor, funnelPct, funnelR2, clearErr, byAct, runs };
}

function printReport(label, metrics) {
  const { overview, perFloor, funnelPct, funnelR2, clearErr } = metrics;
  console.log(`\n=== Batch: ${label} ===`);
  console.log(`Runs: ${overview.runs}  Win: ${overview.win_pct}%  Avg floor: ${overview.avg_floor}`);
  console.log(`Deaths: weapon=${overview.weapon_deaths} hp=${overview.hp_deaths}`);
  console.log(`Funnel linearity R²=${funnelR2.toFixed(3)}  Clear error (|pct-${TARGET_CLEAR}| avg)=${clearErr.toFixed(1)}`);
  console.log('\nFloor | pips | eHP | clear% | hpLost');
  for (const f of perFloor) {
    const flag = f.clear_pct < TARGET_CLEAR - CLEAR_BAND ? ' LOW'
      : f.clear_pct > TARGET_CLEAR + CLEAR_BAND ? ' HIGH' : '';
    console.log(`  F${String(f.floor).padStart(2)} | ${String(f.pips).padStart(5)} | ${String(f.ehp).padStart(4)} | ${String(f.clear_pct).padStart(5)}% | ${f.hp_lost}${flag}`);
  }
  console.log('\nFunnel cliff (Δ pct between floors):');
  for (let i = 1; i < funnelPct.length; i++) {
    const d = funnelPct[i].pct - funnelPct[i - 1].pct;
    if (d < -8) console.log(`  F${funnelPct[i - 1].floor}→F${funnelPct[i].floor}: ${d.toFixed(1)}%  *** cliff`);
  }
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function tuneKnobs(metrics, iter, base = KNOBS) {
  const k = {
    ...base,
    enemyHp: { ...base.enemyHp },
    enemyAtk: { ...base.enemyAtk },
    minEnemyRatio: { ...base.minEnemyRatio },
  };
  k.label = `tune-iter-${iter}`;

  for (const act of Object.keys(k.enemyHp)) {
    const floors = metrics.byAct[act] || [];
    if (!floors.length) continue;
    const avgClear = floors.reduce((s, f) => s + f.clear_pct, 0) / floors.length;
    const avgHpLost = floors.reduce((s, f) => s + f.hp_lost, 0) / floors.length;
    const delta = TARGET_CLEAR - avgClear;

    if (delta > CLEAR_BAND) {
      k.enemyHp[act] = clamp(k.enemyHp[act] - delta * 0.002, 0.68, 1.25);
      if (act === 'act1late' || act === 'act2early') {
        k.weaponWeightMult = clamp(k.weaponWeightMult + delta * 0.003, 0.9, 1.4);
        if (act === 'act2early') k.postBossWeaponBoost = clamp((k.postBossWeaponBoost ?? 0) + 1, 0, 12);
      }
    } else if (delta < -CLEAR_BAND) {
      k.enemyHp[act] = clamp(k.enemyHp[act] - delta * 0.0015, 0.68, 1.25);
    }

    if (avgHpLost > 28) k.enemyAtk[act] = clamp((k.enemyAtk[act] ?? 1) - 0.04, 0.78, 1.1);
    else if (avgHpLost > 22) k.enemyAtk[act] = clamp((k.enemyAtk[act] ?? 1) - 0.02, 0.78, 1.1);
    else if (avgHpLost < 12 && act === 'act1early') k.enemyAtk[act] = clamp((k.enemyAtk[act] ?? 1) + 0.015, 0.78, 1.1);
  }

  const midAct1 = metrics.perFloor.filter((f) => f.floor >= 8 && f.floor <= 13);
  if (midAct1.length) {
    const avg = midAct1.reduce((s, f) => s + f.clear_pct, 0) / midAct1.length;
    if (avg < TARGET_CLEAR - CLEAR_BAND) {
      k.enemyHp.act1late = clamp(k.enemyHp.act1late - 0.03, 0.68, 1.25);
      k.weaponWeightMult = clamp(k.weaponWeightMult + 0.04, 0.9, 1.4);
      k.weaponMinBonus = clamp(k.weaponMinBonus + 1, 0, 6);
    }
  }

  const f15 = metrics.perFloor.find((f) => f.floor === 15);
  if (f15 && f15.clear_pct < TARGET_CLEAR - CLEAR_BAND) {
    k.bossHp = clamp(k.bossHp - 0.04, 0.68, 1.0);
    k.bossAtk = clamp(k.bossAtk - 0.02, 0.85, 1.0);
  }

  const f16 = metrics.perFloor.find((f) => f.floor === 16);
  if (f16 && f16.clear_pct < TARGET_CLEAR - CLEAR_BAND) {
    k.minEnemyRatio.act2 = clamp(k.minEnemyRatio.act2 - 0.015, 0.12, 0.28);
    k.enemyHp.act2early = clamp(k.enemyHp.act2early - 0.04, 0.68, 1.25);
    k.enemyAtk.act2early = clamp((k.enemyAtk.act2early ?? 1) - 0.03, 0.78, 1.1);
    k.postBossWeaponBoost = clamp((k.postBossWeaponBoost ?? 0) + 2, 0, 12);
    k.postBossWeaponMin = clamp((k.postBossWeaponMin ?? 0) + 1, 0, 6);
  }

  const cliff = metrics.funnelPct.find((f, i) => i > 0 && f.floor === 16);
  if (cliff) {
    const prev = metrics.funnelPct.find((f) => f.floor === 15);
    if (prev && cliff.pct - prev.pct < -20) {
      k.playerStartHp = clamp(k.playerStartHp + 2, 100, 130);
      k.bossHp = clamp(k.bossHp - 0.02, 0.68, 1.0);
    }
  }

  const weaponRate = (metrics.overview.weapon_deaths || 0) / (metrics.overview.runs || 1);
  if (weaponRate > 0.50) {
    k.weaponWeightMult = clamp(k.weaponWeightMult + 0.03, 0.9, 1.4);
    k.weaponMinBonus = clamp(k.weaponMinBonus + 1, 0, 6);
    k.postBossWeaponBoost = clamp((k.postBossWeaponBoost ?? 0) + 1, 0, 12);
  }

  const hpRate = (metrics.overview.hp_deaths || 0) / (metrics.overview.runs || 1);
  if (hpRate > 0.35) {
    k.armorWeightMult = clamp(k.armorWeightMult + 0.04, 0.9, 1.35);
    k.armorProtectionBonus = clamp(k.armorProtectionBonus + 0.2, 0, 2.5);
  }

  return k;
}

function writeKnobs(k) {
  const src = readFileSync(KNOBS_PATH, 'utf8');
  const block = `export const KNOBS = ${JSON.stringify(k, null, 2).replace(/"([^"]+)":/g, '$1:')};\n`;
  const next = src.replace(/export const KNOBS = \{[\s\S]*?\};/, block.trim());
  writeFileSync(KNOBS_PATH, next);
}

function runSim(label, runs) {
  console.log(`\nRunning ${runs} balance sims → ${label}...`);
  const r = spawnSync('node', ['sim/balance-sim.js', 'stats-db', String(runs), 'balance', label], {
    cwd: ROOT, stdio: 'inherit', env: process.env,
  });
  if (r.status !== 0) throw new Error('sim failed');
}

function main() {
  const [cmd, batchName, iterStr, runsStr] = process.argv.slice(2);
  const db = new Database(DB_PATH, { readonly: true });

  if (cmd === 'analyze' || !cmd) {
    const batch = findBatch(db, batchName || 'origin');
    const m = analyzeBatch(db, batch.id);
    printReport(batch.label, m);
    db.close();
    return;
  }

  if (cmd === 'tune') {
    const iterations = parseInt(iterStr, 10) || 3;
    const runs = parseInt(runsStr, 10) || 1000;
    let refBatch = findBatch(db, batchName || 'origin');
    db.close();

    let m = analyzeBatch(new Database(DB_PATH, { readonly: true }), refBatch.id);
    printReport(refBatch.label, m);
    new Database(DB_PATH).close();

    let currentKnobs = { ...KNOBS, enemyHp: { ...KNOBS.enemyHp }, enemyAtk: { ...KNOBS.enemyAtk }, minEnemyRatio: { ...KNOBS.minEnemyRatio } };

    for (let i = 1; i <= iterations; i++) {
      const tuned = tuneKnobs(m, i, currentKnobs);
      console.log(`\n--- Tune iteration ${i} knobs ---`);
      console.log(JSON.stringify(tuned, null, 2));
      writeKnobs(tuned);
      currentKnobs = tuned;

      const simLabel = `tune-iter-${i}`;
      runSim(simLabel, runs);

      const db2 = new Database(DB_PATH, { readonly: true });
      refBatch = findBatch(db2, simLabel);
      m = analyzeBatch(db2, refBatch.id);
      printReport(simLabel, m);
      db2.close();
    }
    console.log('\nDone. Compare batches in Grafana: origin vs tune-iter-N');
    return;
  }

  console.error('Usage: node sim/balance-tune.mjs analyze [batch]');
  console.error('       node sim/balance-tune.mjs tune [batch] [iterations] [runs]');
  process.exit(1);
}

main();

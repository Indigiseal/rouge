#!/usr/bin/env node
// Generates sim-balance-compare.json — node sim/db/grafana/build-compare-dashboard.mjs
//
// Batch A = $batch_id (primary, vivid colors)
// Batch B = $batch_id_b (optional, 0 = single-batch mode, muted colors)

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DS = { type: 'frser-sqlite-datasource', uid: 'sim-sqlite' };

const BATCH_LABEL = `COALESCE(NULLIF(TRIM(b.label), ''), 'run #' || b.id)
  || ' ('
  || CASE b.mode
       WHEN 'balance' THEN 'balance: no meta/amulets'
       WHEN 'fresh' THEN 'fresh: clean start'
       WHEN 'geared' THEN 'geared: all relics'
       WHEN 'accumulate' THEN 'accumulate: career meta'
       ELSE b.mode
     END
  || ', ' || b.runs_completed || ' runs)'`;

const BATCH_VAR_SQL = `SELECT b.id AS __value, ${BATCH_LABEL} AS __text FROM sim_batches b ORDER BY b.id DESC`;

const BATCH_B_VAR_SQL = `SELECT * FROM (
  SELECT 0 AS __value, '— none (single batch) —' AS __text
  UNION ALL
  SELECT b.id AS __value, ${BATCH_LABEL} AS __text FROM sim_batches b
) ORDER BY __value DESC`;

/** Runs filter: batch A always; batch B only when selected. */
const RUN_FILTER = `(batch_id = $batch_id OR ($batch_id_b > 0 AND batch_id = $batch_id_b))`;
const R_FILTER = `(r.batch_id = $batch_id OR ($batch_id_b > 0 AND r.batch_id = $batch_id_b))`;

const H = {
  blue:   { a: '#5794F2', b: '#3D5A80' },
  green:  { a: '#73BF69', b: '#4A7346' },
  orange: { a: '#FF9830', b: '#996026' },
  red:    { a: '#F2495C', b: '#992D3A' },
  yellow: { a: '#FADE2A', b: '#96901A' },
  purple: { a: '#B877D9', b: '#6E4782' },
};

let nextId = 1;
const uid = () => nextId++;

function sqlTarget(query) {
  return [{ datasource: DS, format: 'table', queryText: query, rawQueryText: query, refId: 'A' }];
}

function colorFixed(hex) {
  return { id: 'color', value: { fixedColor: hex, mode: 'fixed' } };
}

function fillOpacity(v) {
  return { id: 'custom.fillOpacity', value: v };
}

function pair(nameA, nameB, hue) {
  return [
    { matcher: { id: 'byName', options: nameA }, properties: [colorFixed(H[hue].a), fillOpacity(85)] },
    { matcher: { id: 'byName', options: nameB }, properties: [colorFixed(H[hue].b), fillOpacity(55)] },
  ];
}

function abPair(hue = 'blue') {
  return pair('batch_a', 'batch_b', hue);
}

function hideFromLegend(name) {
  return { matcher: { id: 'byName', options: name }, properties: [{ id: 'custom.hideFrom', value: { legend: true, tooltip: false, viz: true } }] };
}

/** Single-batch stacked effective + overkill (green/red). */
function effectiveOverkillSingleOverrides(muted = false) {
  const g = muted ? H.green.b : H.green.a;
  const r = muted ? H.red.b : H.red.a;
  const op = muted ? 55 : 85;
  return [
    { matcher: { id: 'byName', options: 'damage_effective' }, properties: [colorFixed(g), fillOpacity(op)] },
    { matcher: { id: 'byName', options: 'damage_wasted' }, properties: [colorFixed(r), fillOpacity(op)] },
  ];
}

/** AVG metric split by batch. */
function avgAB(expr, dec = 1) {
  const d = dec;
  return `ROUND(AVG(CASE WHEN r.batch_id = $batch_id THEN (${expr}) END), ${d}) AS batch_a,
    CASE WHEN $batch_id_b > 0 THEN ROUND(AVG(CASE WHEN r.batch_id = $batch_id_b THEN (${expr}) END), ${d}) END AS batch_b`;
}

function avgABRuns(expr, dec = 1) {
  return `ROUND(AVG(CASE WHEN batch_id = $batch_id THEN (${expr}) END), ${dec}) AS batch_a,
    CASE WHEN $batch_id_b > 0 THEN ROUND(AVG(CASE WHEN batch_id = $batch_id_b THEN (${expr}) END), ${dec}) END AS batch_b`;
}

function countAB(expr = '1') {
  return `SUM(CASE WHEN batch_id = $batch_id THEN (${expr}) END) AS batch_a,
    CASE WHEN $batch_id_b > 0 THEN SUM(CASE WHEN batch_id = $batch_id_b THEN (${expr}) END) END AS batch_b`;
}

function pctWinAB() {
  return `ROUND(100.0 * SUM(CASE WHEN batch_id = $batch_id THEN won END) / NULLIF(COUNT(CASE WHEN batch_id = $batch_id THEN 1 END), 0), 1) AS batch_a,
    CASE WHEN $batch_id_b > 0 THEN ROUND(100.0 * SUM(CASE WHEN batch_id = $batch_id_b THEN won END) / NULLIF(COUNT(CASE WHEN batch_id = $batch_id_b THEN 1 END), 0), 1) END AS batch_b`;
}

function stat(title, query, y, x, w, opts = {}) {
  return {
    datasource: DS,
    fieldConfig: {
      defaults: {
        color: { mode: 'palette-classic' },
        mappings: [],
        thresholds: opts.thresholds || { mode: 'absolute', steps: [{ color: 'green', value: null }] },
        unit: opts.unit || 'none',
        max: opts.max,
        min: opts.min,
        decimals: opts.decimals,
      },
      overrides: [...abPair(opts.hue || 'blue'), ...(opts.overrides || [])],
    },
    gridPos: { h: 4, w, x, y },
    id: uid(),
    options: {
      colorMode: 'value',
      graphMode: 'none',
      justifyMode: 'auto',
      orientation: 'horizontal',
      reduceOptions: { calcs: ['lastNotNull'], fields: '', values: true },
      showPercentChange: false,
      textMode: 'value_and_name',
      wideLayout: true,
    },
    targets: sqlTarget(query),
    title,
    type: 'stat',
  };
}

function bar(title, query, y, x, w, h, opts = {}) {
  const xField = opts.xField || 'floor';
  return {
    datasource: DS,
    fieldConfig: {
      defaults: {
        color: { mode: opts.colorMode || 'palette-classic' },
        custom: {
          axisBorderShow: false,
          axisCenteredZero: false,
          axisColorMode: 'text',
          axisLabel: opts.axisLabel || '',
          axisPlacement: 'auto',
          fillOpacity: opts.fillOpacity ?? 75,
          gradientMode: opts.gradientMode || 'none',
          hideFrom: { legend: false, tooltip: false, viz: false },
          lineWidth: 1,
          scaleDistribution: { type: 'linear' },
          thresholdsStyle: { mode: 'off' },
        },
        mappings: [],
        max: opts.max,
        min: opts.min,
        thresholds: opts.thresholds || { mode: 'absolute', steps: [{ color: 'green', value: null }] },
        unit: opts.unit,
      },
      overrides: [
        ...(opts.overrides || []),
        ...(opts.skipAbPair ? [] : abPair(opts.hue || 'blue')),
        hideFromLegend(xField),
      ],
    },
    gridPos: { h, w, x, y },
    id: uid(),
    options: {
      barRadius: 0.05,
      barWidth: 0.85,
      fullHighlight: false,
      groupWidth: 0.72,
      legend: { calcs: opts.legendCalcs || [], displayMode: 'table', placement: 'bottom', showLegend: opts.showLegend !== false },
      orientation: opts.orientation || 'auto',
      showValue: opts.showValue || 'never',
      stacking: opts.stacking || 'none',
      tooltip: { mode: opts.tooltipMode || 'multi', sort: 'none' },
      xField: opts.xField || 'floor',
      xTickLabelRotation: -45,
      xTickLabelSpacing: 100,
    },
    targets: sqlTarget(query),
    title,
    type: 'barchart',
  };
}

function table(title, query, y, x, w, h) {
  return {
    datasource: DS,
    fieldConfig: { defaults: { custom: { align: 'auto', cellOptions: { type: 'auto' }, inspect: false }, mappings: [], thresholds: { mode: 'absolute', steps: [{ color: 'green', value: null }] } }, overrides: [] },
    gridPos: { h, w, x, y },
    id: uid(),
    options: { cellHeight: 'sm', footer: { countRows: false, fields: '', reducer: ['sum'], show: false }, showHeader: true, sortBy: [] },
    targets: sqlTarget(query),
    title,
    type: 'table',
  };
}

function buildOverview(baseY) {
  const y = baseY;
  return {
    panels: [
      stat('Runs', `SELECT ${countAB()} FROM sim_runs WHERE ${RUN_FILTER}`, y, 0, 4),
      stat('Win rate', `SELECT ${pctWinAB()} FROM sim_runs WHERE ${RUN_FILTER}`, y, 4, 4, {
        unit: 'percent', max: 100, min: 0, hue: 'green',
        thresholds: { mode: 'absolute', steps: [{ color: 'red', value: null }, { color: 'yellow', value: 5 }, { color: 'green', value: 15 }] },
      }),
      stat('Avg floor', `SELECT ${avgABRuns('reached_floor')} FROM sim_runs WHERE ${RUN_FILTER}`, y, 8, 4, { decimals: 1 }),
      stat('Deaths', `SELECT ${countAB('CASE WHEN died = 1 THEN 1 END')} FROM sim_runs WHERE ${RUN_FILTER}`, y, 12, 4, { hue: 'red' }),
      bar('Encounter types',
        `SELECT fv.encounter_type AS label,
           SUM(CASE WHEN r.batch_id = $batch_id THEN 1 END) AS batch_a,
           CASE WHEN $batch_id_b > 0 THEN SUM(CASE WHEN r.batch_id = $batch_id_b THEN 1 END) END AS batch_b
         FROM sim_floor_visits fv JOIN sim_runs r ON r.id = fv.run_id
         WHERE ${R_FILTER}
         GROUP BY fv.encounter_type ORDER BY batch_a DESC`,
        y, 16, 8, 8, { xField: 'label', orientation: 'horizontal' }),
    ],
    nextY: y + 8,
  };
}

function buildDeaths(baseY) {
  const y1 = baseY;
  const y2 = y1 + 8;
  const y3 = y2 + 9;
  return {
    panels: [
      bar('Run end reason',
        `SELECT end_reason AS label,
           SUM(CASE WHEN batch_id = $batch_id THEN 1 END) AS batch_a,
           CASE WHEN $batch_id_b > 0 THEN SUM(CASE WHEN batch_id = $batch_id_b THEN 1 END) END AS batch_b
         FROM sim_runs WHERE ${RUN_FILTER} AND end_reason IS NOT NULL
         GROUP BY end_reason ORDER BY batch_a DESC`,
        y1, 0, 8, 8, { xField: 'label', orientation: 'horizontal' }),
      bar('Last floor reached',
        `SELECT 'F' || reached_floor AS floor,
           SUM(CASE WHEN batch_id = $batch_id THEN 1 END) AS batch_a,
           CASE WHEN $batch_id_b > 0 THEN SUM(CASE WHEN batch_id = $batch_id_b THEN 1 END) END AS batch_b
         FROM sim_runs WHERE ${RUN_FILTER}
         GROUP BY reached_floor ORDER BY reached_floor`,
        y1, 8, 8, 8, { legendCalcs: ['sum'] }),
      bar('Deaths by room type',
        `SELECT COALESCE(death_encounter_type, 'unknown') AS encounter,
           SUM(CASE WHEN batch_id = $batch_id THEN 1 END) AS batch_a,
           CASE WHEN $batch_id_b > 0 THEN SUM(CASE WHEN batch_id = $batch_id_b THEN 1 END) END AS batch_b
         FROM sim_runs WHERE ${RUN_FILTER} AND died = 1
         GROUP BY death_encounter_type ORDER BY batch_a DESC`,
        y1, 16, 8, 8, { xField: 'encounter', orientation: 'horizontal', showLegend: false }),
      table('Deaths: floor × room (batch A / B / delta)',
        `WITH a AS (
           SELECT reached_floor AS floor, COALESCE(death_encounter_type, 'unknown') AS encounter, COUNT(*) AS n
           FROM sim_runs WHERE batch_id = $batch_id AND died = 1
           GROUP BY reached_floor, death_encounter_type
         ), b AS (
           SELECT reached_floor AS floor, COALESCE(death_encounter_type, 'unknown') AS encounter, COUNT(*) AS n
           FROM sim_runs WHERE $batch_id_b > 0 AND batch_id = $batch_id_b AND died = 1
           GROUP BY reached_floor, death_encounter_type
         )
         SELECT 'F' || COALESCE(a.floor, b.floor) AS floor, COALESCE(a.encounter, b.encounter) AS encounter,
           COALESCE(a.n, 0) AS batch_a,
           CASE WHEN $batch_id_b > 0 THEN COALESCE(b.n, 0) END AS batch_b,
           CASE WHEN $batch_id_b > 0 THEN COALESCE(b.n, 0) - COALESCE(a.n, 0) END AS delta
         FROM a LEFT JOIN b ON a.floor = b.floor AND a.encounter = b.encounter
         ORDER BY floor, batch_a DESC LIMIT 200`,
        y2, 0, 12, 9),
      bar('Funnel: runs reaching floor',
        `WITH floors AS (
           SELECT DISTINCT floor_number AS floor FROM sim_floor_visits fv JOIN sim_runs r ON r.id = fv.run_id WHERE ${R_FILTER}
           UNION SELECT DISTINCT reached_floor AS floor FROM sim_runs WHERE ${RUN_FILTER}
         )
         SELECT 'F' || f.floor AS floor,
           (SELECT COUNT(*) FROM sim_runs r WHERE r.batch_id = $batch_id AND r.reached_floor >= f.floor) AS batch_a,
           CASE WHEN $batch_id_b > 0 THEN (SELECT COUNT(*) FROM sim_runs r WHERE r.batch_id = $batch_id_b AND r.reached_floor >= f.floor) END AS batch_b
         FROM floors f ORDER BY f.floor`,
        y2, 12, 12, 9, { showLegend: false, tooltipMode: 'single' }),
      bar('Avg player HP lost per visit',
        `SELECT 'F' || fv.floor_number AS floor, ${avgAB('MAX(0, fv.player_hp_start - fv.player_hp_end)')}
         FROM sim_floor_visits fv JOIN sim_runs r ON r.id = fv.run_id
         WHERE ${R_FILTER}
         GROUP BY fv.floor_number ORDER BY fv.floor_number`,
        y3, 0, 12, 8),
      table('Run outcomes (A / B / delta %)',
        `WITH a AS (SELECT end_reason, COUNT(*) AS n FROM sim_runs WHERE batch_id = $batch_id GROUP BY end_reason),
         b AS (SELECT end_reason, COUNT(*) AS n FROM sim_runs WHERE $batch_id_b > 0 AND batch_id = $batch_id_b GROUP BY end_reason),
         ta AS (SELECT COUNT(*) AS t FROM sim_runs WHERE batch_id = $batch_id),
         tb AS (SELECT COUNT(*) AS t FROM sim_runs WHERE $batch_id_b > 0 AND batch_id = $batch_id_b)
         SELECT COALESCE(a.end_reason, b.end_reason) AS end_reason,
           COALESCE(a.n, 0) AS batch_a,
           ROUND(100.0 * COALESCE(a.n, 0) / ta.t, 1) AS pct_a,
           CASE WHEN $batch_id_b > 0 THEN COALESCE(b.n, 0) END AS batch_b,
           CASE WHEN $batch_id_b > 0 THEN ROUND(100.0 * COALESCE(b.n, 0) / tb.t, 1) END AS pct_b,
           CASE WHEN $batch_id_b > 0 THEN ROUND(100.0 * COALESCE(b.n, 0) / tb.t, 1) - ROUND(100.0 * COALESCE(a.n, 0) / ta.t, 1) END AS delta_pct
         FROM a LEFT JOIN b ON a.end_reason = b.end_reason, ta, tb
         ORDER BY batch_a DESC`,
        y3, 12, 12, 8),
    ],
    nextY: y3 + 8,
  };
}

function buildWeapons(baseY) {
  const y1 = baseY;
  const y2 = y1 + 9;
  const y3 = y2 + 8;
  const combatJoin = `
         FROM sim_floor_visits fv JOIN sim_runs r ON r.id = fv.run_id
         JOIN (SELECT floor_visit_id, SUM(pip_output) AS start_pips FROM sim_weapon_snapshots WHERE phase = 'start' GROUP BY floor_visit_id) ws ON ws.floor_visit_id = fv.id
         JOIN (SELECT floor_visit_id, SUM(health) AS enemy_hp FROM sim_enemy_spawns GROUP BY floor_visit_id) es ON es.floor_visit_id = fv.id
         WHERE ${R_FILTER} AND fv.encounter_type IN ('COMBAT','ELITE','BOSS')`;
  return {
    panels: [
      bar('Weapon pips vs enemy HP (combat start)',
        `SELECT 'F' || fv.floor_number AS floor,
           ROUND(AVG(CASE WHEN r.batch_id = $batch_id THEN ws.start_pips END), 1) AS weapon_pips_start,
           ROUND(AVG(CASE WHEN r.batch_id = $batch_id THEN es.enemy_hp END), 1) AS enemy_hp_spawn,
           CASE WHEN $batch_id_b > 0 THEN ROUND(AVG(CASE WHEN r.batch_id = $batch_id_b THEN ws.start_pips END), 1) END AS b_weapon_pips_start,
           CASE WHEN $batch_id_b > 0 THEN ROUND(AVG(CASE WHEN r.batch_id = $batch_id_b THEN es.enemy_hp END), 1) END AS b_enemy_hp_spawn
         ${combatJoin}
         GROUP BY fv.floor_number ORDER BY fv.floor_number`,
        y1, 0, 12, 9, {
        skipAbPair: true,
        overrides: [
          ...pair('weapon_pips_start', 'b_weapon_pips_start', 'blue'),
          ...pair('enemy_hp_spawn', 'b_enemy_hp_spawn', 'orange'),
        ],
      }),
      bar('Weapon pips: floor start vs end',
        `SELECT 'F' || fv.floor_number AS floor,
           ROUND(AVG(CASE WHEN r.batch_id = $batch_id THEN ws.start_pips END), 1) AS pips_start,
           ROUND(AVG(CASE WHEN r.batch_id = $batch_id THEN we.end_pips END), 1) AS pips_end,
           CASE WHEN $batch_id_b > 0 THEN ROUND(AVG(CASE WHEN r.batch_id = $batch_id_b THEN ws.start_pips END), 1) END AS b_pips_start,
           CASE WHEN $batch_id_b > 0 THEN ROUND(AVG(CASE WHEN r.batch_id = $batch_id_b THEN we.end_pips END), 1) END AS b_pips_end
         FROM sim_floor_visits fv JOIN sim_runs r ON r.id = fv.run_id
         JOIN (SELECT floor_visit_id, SUM(pip_output) AS start_pips FROM sim_weapon_snapshots WHERE phase = 'start' GROUP BY floor_visit_id) ws ON ws.floor_visit_id = fv.id
         JOIN (SELECT floor_visit_id, SUM(pip_output) AS end_pips FROM sim_weapon_snapshots WHERE phase = 'end' GROUP BY floor_visit_id) we ON we.floor_visit_id = fv.id
         WHERE ${R_FILTER} AND fv.encounter_type IN ('COMBAT','ELITE','BOSS')
         GROUP BY fv.floor_number ORDER BY fv.floor_number`,
        y1, 12, 12, 9, {
        skipAbPair: true,
        overrides: [
          ...pair('pips_start', 'b_pips_start', 'green'),
          ...pair('pips_end', 'b_pips_end', 'yellow'),
        ],
      }),
      bar('Can clear room (pips ≥ HP) %',
        `SELECT 'F' || fv.floor_number AS floor,
           ROUND(100.0 * SUM(CASE WHEN r.batch_id = $batch_id AND ws.start_pips >= es.enemy_hp THEN 1 ELSE 0 END)
             / NULLIF(SUM(CASE WHEN r.batch_id = $batch_id THEN 1 END), 0), 1) AS batch_a,
           CASE WHEN $batch_id_b > 0 THEN ROUND(100.0 * SUM(CASE WHEN r.batch_id = $batch_id_b AND ws.start_pips >= es.enemy_hp THEN 1 ELSE 0 END)
             / NULLIF(SUM(CASE WHEN r.batch_id = $batch_id_b THEN 1 END), 0), 1) END AS batch_b
         ${combatJoin}
         GROUP BY fv.floor_number ORDER BY fv.floor_number`,
        y2, 0, 8, 8, { unit: 'percent', max: 100, min: 0, showValue: 'always', hue: 'green' }),
      bar('Combat damage A: effective vs overkill',
        `SELECT 'F' || fv.floor_number AS floor,
           ROUND(AVG(fv.combat_damage_dealt - fv.combat_damage_wasted), 1) AS damage_effective,
           ROUND(AVG(fv.combat_damage_wasted), 1) AS damage_wasted
         FROM sim_floor_visits fv JOIN sim_runs r ON r.id = fv.run_id
         WHERE r.batch_id = $batch_id AND fv.combat_damage_dealt IS NOT NULL
         GROUP BY fv.floor_number ORDER BY fv.floor_number`,
        y2, 8, 6, 8, {
        skipAbPair: true,
        stacking: 'normal',
        overrides: effectiveOverkillSingleOverrides(false),
      }),
      bar('Combat damage B: effective vs overkill',
        `SELECT 'F' || fv.floor_number AS floor,
           ROUND(AVG(fv.combat_damage_dealt - fv.combat_damage_wasted), 1) AS damage_effective,
           ROUND(AVG(fv.combat_damage_wasted), 1) AS damage_wasted
         FROM sim_floor_visits fv JOIN sim_runs r ON r.id = fv.run_id
         WHERE $batch_id_b > 0 AND r.batch_id = $batch_id_b AND fv.combat_damage_dealt IS NOT NULL
         GROUP BY fv.floor_number ORDER BY fv.floor_number`,
        y2, 14, 6, 8, {
        skipAbPair: true,
        stacking: 'normal',
        overrides: effectiveOverkillSingleOverrides(true),
      }),
      bar('Overkill % of damage dealt',
        `SELECT 'F' || fv.floor_number AS floor,
           ROUND(100.0 * SUM(CASE WHEN r.batch_id = $batch_id THEN fv.combat_damage_wasted END)
             / NULLIF(SUM(CASE WHEN r.batch_id = $batch_id THEN fv.combat_damage_dealt END), 0), 1) AS batch_a,
           CASE WHEN $batch_id_b > 0 THEN ROUND(100.0 * SUM(CASE WHEN r.batch_id = $batch_id_b THEN fv.combat_damage_wasted END)
             / NULLIF(SUM(CASE WHEN r.batch_id = $batch_id_b THEN fv.combat_damage_dealt END), 0), 1) END AS batch_b
         FROM sim_floor_visits fv JOIN sim_runs r ON r.id = fv.run_id
         WHERE ${R_FILTER} AND fv.combat_damage_dealt IS NOT NULL
         GROUP BY fv.floor_number ORDER BY fv.floor_number`,
        y2, 16, 8, 8, { unit: 'percent', max: 100, min: 0, showValue: 'always', hue: 'red' }),
      table('Combats by floor (A / B / delta)',
        `WITH a AS (
           SELECT fv.floor_number AS floor,
             ROUND(AVG(ws.start_pips), 1) AS start_pips, ROUND(AVG(es.enemy_hp), 1) AS enemy_hp,
             ROUND(AVG(fv.combat_damage_wasted), 1) AS overkill
           FROM sim_floor_visits fv JOIN sim_runs r ON r.id = fv.run_id
           LEFT JOIN (SELECT floor_visit_id, SUM(pip_output) AS start_pips FROM sim_weapon_snapshots WHERE phase = 'start' GROUP BY floor_visit_id) ws ON ws.floor_visit_id = fv.id
           LEFT JOIN (SELECT floor_visit_id, SUM(health) AS enemy_hp FROM sim_enemy_spawns GROUP BY floor_visit_id) es ON es.floor_visit_id = fv.id
           WHERE r.batch_id = $batch_id AND fv.encounter_type IN ('COMBAT','ELITE','BOSS')
           GROUP BY fv.floor_number
         ), b AS (
           SELECT fv.floor_number AS floor,
             ROUND(AVG(ws.start_pips), 1) AS start_pips, ROUND(AVG(es.enemy_hp), 1) AS enemy_hp,
             ROUND(AVG(fv.combat_damage_wasted), 1) AS overkill
           FROM sim_floor_visits fv JOIN sim_runs r ON r.id = fv.run_id
           LEFT JOIN (SELECT floor_visit_id, SUM(pip_output) AS start_pips FROM sim_weapon_snapshots WHERE phase = 'start' GROUP BY floor_visit_id) ws ON ws.floor_visit_id = fv.id
           LEFT JOIN (SELECT floor_visit_id, SUM(health) AS enemy_hp FROM sim_enemy_spawns GROUP BY floor_visit_id) es ON es.floor_visit_id = fv.id
           WHERE $batch_id_b > 0 AND r.batch_id = $batch_id_b AND fv.encounter_type IN ('COMBAT','ELITE','BOSS')
           GROUP BY fv.floor_number
         )
         SELECT 'F' || COALESCE(a.floor, b.floor) AS floor,
           a.start_pips AS a_pips, CASE WHEN $batch_id_b > 0 THEN b.start_pips END AS b_pips,
           CASE WHEN $batch_id_b > 0 THEN ROUND(b.start_pips - a.start_pips, 1) END AS d_pips,
           a.enemy_hp AS a_hp, CASE WHEN $batch_id_b > 0 THEN b.enemy_hp END AS b_hp,
           a.overkill AS a_overkill, CASE WHEN $batch_id_b > 0 THEN b.overkill END AS b_overkill
         FROM a LEFT JOIN b ON a.floor = b.floor ORDER BY floor LIMIT 45`,
        y3, 0, 24, 10),
    ],
    nextY: y3 + 10,
  };
}

function buildMonsters(baseY) {
  const y1 = baseY;
  const y2 = y1 + 8;
  return {
    panels: [
      bar('Enemy types at spawn',
        `SELECT COALESCE(e.enemy_type, 'unknown') AS label,
           SUM(CASE WHEN r.batch_id = $batch_id THEN 1 END) AS batch_a,
           CASE WHEN $batch_id_b > 0 THEN SUM(CASE WHEN r.batch_id = $batch_id_b THEN 1 END) END AS batch_b
         FROM sim_enemy_spawns e
         JOIN sim_floor_visits fv ON fv.id = e.floor_visit_id
         JOIN sim_runs r ON r.id = fv.run_id
         WHERE ${R_FILTER}
         GROUP BY e.enemy_type ORDER BY batch_a DESC`,
        y1, 0, 8, 8, { xField: 'label', orientation: 'horizontal' }),
      bar('Avg enemy HP at spawn by floor',
        `SELECT 'F' || fv.floor_number AS floor, ${avgAB('tot.hp')}
         FROM (SELECT e.floor_visit_id, SUM(e.health) AS hp FROM sim_enemy_spawns e GROUP BY e.floor_visit_id) tot
         JOIN sim_floor_visits fv ON fv.id = tot.floor_visit_id
         JOIN sim_runs r ON r.id = fv.run_id
         WHERE ${R_FILTER}
         GROUP BY fv.floor_number ORDER BY fv.floor_number`,
        y1, 8, 16, 8, { hue: 'orange' }),
      table('Summary: floor × enemy (A / B avg HP / delta)',
        `WITH a AS (
           SELECT fv.floor_number AS floor, COALESCE(e.name, e.enemy_type) AS enemy,
             COUNT(*) AS spawns, ROUND(AVG(e.health), 1) AS avg_hp, ROUND(AVG(e.attack), 1) AS avg_atk
           FROM sim_enemy_spawns e JOIN sim_floor_visits fv ON fv.id = e.floor_visit_id JOIN sim_runs r ON r.id = fv.run_id
           WHERE r.batch_id = $batch_id
           GROUP BY fv.floor_number, COALESCE(e.name, e.enemy_type)
         ), b AS (
           SELECT fv.floor_number AS floor, COALESCE(e.name, e.enemy_type) AS enemy,
             COUNT(*) AS spawns, ROUND(AVG(e.health), 1) AS avg_hp, ROUND(AVG(e.attack), 1) AS avg_atk
           FROM sim_enemy_spawns e JOIN sim_floor_visits fv ON fv.id = e.floor_visit_id JOIN sim_runs r ON r.id = fv.run_id
           WHERE $batch_id_b > 0 AND r.batch_id = $batch_id_b
           GROUP BY fv.floor_number, COALESCE(e.name, e.enemy_type)
         )
         SELECT 'F' || COALESCE(a.floor, b.floor) AS floor, COALESCE(a.enemy, b.enemy) AS enemy,
           a.spawns AS a_spawns, CASE WHEN $batch_id_b > 0 THEN b.spawns END AS b_spawns,
           a.avg_hp AS a_hp, CASE WHEN $batch_id_b > 0 THEN b.avg_hp END AS b_hp,
           CASE WHEN $batch_id_b > 0 THEN ROUND(b.avg_hp - a.avg_hp, 1) END AS d_hp,
           a.avg_atk AS a_atk, CASE WHEN $batch_id_b > 0 THEN b.avg_atk END AS b_atk
         FROM a LEFT JOIN b ON a.floor = b.floor AND a.enemy = b.enemy
         ORDER BY floor, a_spawns DESC LIMIT 200`,
        y2, 0, 24, 11),
    ],
    nextY: y2 + 11,
  };
}

function toNestedY(panels) {
  const minY = Math.min(...panels.map((p) => p.gridPos.y));
  return panels.map((p) => ({ ...p, gridPos: { ...p.gridPos, y: p.gridPos.y - minY + 1 } }));
}

function addSection(panels, title, collapsed, buildFn, y) {
  const { panels: children, nextY } = buildFn(y + 1);
  const row = { collapsed, gridPos: { h: 1, w: 24, x: 0, y }, id: uid(), panels: collapsed ? toNestedY(children) : [], title, type: 'row' };
  panels.push(row);
  if (!collapsed) for (const p of children) panels.push(p);
  return collapsed ? y + 1 : nextY;
}

const panels = [];
let y = 0;

panels.push({
  gridPos: { h: 3, w: 24, x: 0, y: y++ },
  id: uid(),
  options: { code: { language: 'plaintext', showLineNumbers: false, showMiniMap: false },
    content: `**Batch A** — baseline run (vivid bars). **Batch B** — comparison run (muted bars). Leave Batch B as *none* for single-batch view.\n\nColors: Batch A uses standard palette; Batch B uses desaturated shades of the same hues.` },
  title: '',
  type: 'text',
});

y = addSection(panels, 'Overview', false, buildOverview, y);
y = addSection(panels, '1 · Deaths & progression', true, buildDeaths, y);
y = addSection(panels, '2 · Weapons & damage', true, buildWeapons, y);
addSection(panels, '3 · Monsters', true, buildMonsters, y);

const dashboard = {
  annotations: { list: [] },
  editable: true,
  fiscalYearStartMonth: 0,
  graphTooltip: 1,
  id: null,
  links: [
    { asDropdown: false, icon: 'dashboard', includeVars: true, keepTime: true, tags: [], targetBlank: false, title: 'Sim Balance (single)', tooltip: '', type: 'link', url: '/d/sim-balance/sim-balance' },
  ],
  panels,
  refresh: '30s',
  schemaVersion: 39,
  tags: ['sim', 'balance', 'compare'],
  templating: {
    list: [
      {
        current: {},
        datasource: DS,
        definition: BATCH_VAR_SQL,
        hide: 0,
        includeAll: false,
        label: 'Batch A',
        multi: false,
        name: 'batch_id',
        options: [],
        query: BATCH_VAR_SQL,
        refresh: 1,
        regex: '',
        skipUrlSync: false,
        sort: 0,
        type: 'query',
      },
      {
        current: { selected: true, text: '— none (single batch) —', value: '0' },
        datasource: DS,
        definition: BATCH_B_VAR_SQL,
        hide: 0,
        includeAll: false,
        label: 'Batch B',
        multi: false,
        name: 'batch_id_b',
        options: [],
        query: BATCH_B_VAR_SQL,
        refresh: 1,
        regex: '',
        skipUrlSync: false,
        sort: 0,
        type: 'query',
      },
    ],
  },
  time: { from: 'now-6h', to: 'now' },
  timepicker: { hidden: true },
  timezone: 'browser',
  title: 'Sim Balance Compare',
  uid: 'sim-balance-compare',
  version: 3,
  weekStart: '',
};

writeFileSync(join(__dirname, 'dashboards', 'sim-balance-compare.json'), `${JSON.stringify(dashboard, null, 2)}\n`);
console.log('Wrote sim-balance-compare.json');

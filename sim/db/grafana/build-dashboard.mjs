#!/usr/bin/env node
// Generates sim-balance.json — node sim/db/grafana/build-dashboard.mjs
//
// Grafana row quirk (see grafana#50855):
//   collapsed=false → child panels live in the TOP-LEVEL panels[] (row.panels must be [])
//   collapsed=true  → child panels live INSIDE row.panels

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DS = { type: 'frser-sqlite-datasource', uid: 'sim-sqlite' };

const BATCH_VAR_SQL = `SELECT b.id AS __value,
  COALESCE(NULLIF(TRIM(b.label), ''), 'run #' || b.id)
  || ' ('
  || CASE b.mode
       WHEN 'balance' THEN 'balance: no meta/amulets'
       WHEN 'fresh' THEN 'fresh: clean start'
       WHEN 'geared' THEN 'geared: all relics'
       WHEN 'accumulate' THEN 'accumulate: career meta'
       ELSE b.mode
     END
  || ', ' || b.runs_completed || ' runs)'
  AS __text
FROM sim_batches b
ORDER BY b.id DESC`;

let nextId = 1;
const uid = () => nextId++;

function sqlTarget(query) {
  return [{ datasource: DS, format: 'table', queryText: query, rawQueryText: query, refId: 'A' }];
}

function stat(title, query, y, x, w = 6, opts = {}) {
  return {
    datasource: DS,
    fieldConfig: {
      defaults: {
        color: { mode: opts.colorMode || 'palette-classic' },
        mappings: [],
        thresholds: opts.thresholds || { mode: 'absolute', steps: [{ color: 'green', value: null }] },
        unit: opts.unit || 'none',
        max: opts.max,
        min: opts.min,
        decimals: opts.decimals,
      },
      overrides: opts.overrides || [],
    },
    gridPos: { h: 4, w, x, y },
    id: uid(),
    options: {
      colorMode: 'value',
      graphMode: opts.graphMode || 'none',
      justifyMode: 'auto',
      orientation: 'auto',
      reduceOptions: { calcs: ['lastNotNull'], fields: '', values: false },
      showPercentChange: false,
      textMode: 'auto',
      wideLayout: true,
    },
    targets: sqlTarget(query),
    title,
    type: 'stat',
  };
}

function pie(title, query, y, x, w, h, overrides = []) {
  return {
    datasource: DS,
    fieldConfig: {
      defaults: { color: { mode: 'palette-classic' }, custom: { hideFrom: { legend: false, tooltip: false, viz: false } }, mappings: [] },
      overrides,
    },
    gridPos: { h, w, x, y },
    id: uid(),
    options: {
      legend: { displayMode: 'table', placement: 'right', showLegend: true, values: ['value', 'percent'] },
      pieType: 'donut',
      reduceOptions: { calcs: ['lastNotNull'], fields: '', values: true },
      tooltip: { mode: 'single', sort: 'none' },
    },
    targets: sqlTarget(query),
    title,
    type: 'piechart',
  };
}

function bar(title, query, y, x, w, h, opts = {}) {
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
          fillOpacity: opts.fillOpacity ?? 70,
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
      overrides: opts.overrides || [],
    },
    gridPos: { h, w, x, y },
    id: uid(),
    options: {
      barRadius: 0.05,
      barWidth: 0.85,
      fullHighlight: false,
      groupWidth: 0.7,
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
    options: {
      cellHeight: 'sm',
      footer: { countRows: false, fields: '', reducer: ['sum'], show: false },
      showHeader: true,
      sortBy: [],
    },
    targets: sqlTarget(query),
    title,
    type: 'table',
  };
}

const endReasonColors = [
  { matcher: { id: 'byName', options: 'win' }, properties: [{ id: 'color', value: { fixedColor: 'green', mode: 'fixed' } }] },
  { matcher: { id: 'byName', options: 'hp' }, properties: [{ id: 'color', value: { fixedColor: 'red', mode: 'fixed' } }] },
  { matcher: { id: 'byName', options: 'weapon' }, properties: [{ id: 'color', value: { fixedColor: 'orange', mode: 'fixed' } }] },
];

/** Build child panels with y starting at `baseY`. Returns panels and next free y. */
function buildOverview(baseY) {
  const y = baseY;
  return {
    panels: [
      stat('Runs', 'SELECT COUNT(*) AS runs FROM sim_runs WHERE batch_id = $batch_id', y, 0, 4),
      stat('Win rate', 'SELECT ROUND(100.0 * SUM(won) / COUNT(*), 1) AS win_pct FROM sim_runs WHERE batch_id = $batch_id', y, 4, 4, {
        unit: 'percent', max: 100, min: 0,
        thresholds: { mode: 'absolute', steps: [{ color: 'red', value: null }, { color: 'yellow', value: 5 }, { color: 'green', value: 15 }] },
      }),
      stat('Avg floor', 'SELECT ROUND(AVG(reached_floor), 1) AS avg_floor FROM sim_runs WHERE batch_id = $batch_id', y, 8, 4, { decimals: 1 }),
      stat('Deaths', 'SELECT COUNT(*) AS deaths FROM sim_runs WHERE batch_id = $batch_id AND died = 1', y, 12, 4),
      pie('Encounter types',
        `SELECT fv.encounter_type AS label, COUNT(*) AS value
         FROM sim_floor_visits fv JOIN sim_runs r ON r.id = fv.run_id
         WHERE r.batch_id = $batch_id
         GROUP BY fv.encounter_type ORDER BY value DESC`,
        y, 16, 8, 8),
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
      pie('Run end reason',
        `SELECT end_reason AS label, COUNT(*) AS value FROM sim_runs WHERE batch_id = $batch_id AND end_reason IS NOT NULL GROUP BY end_reason ORDER BY value DESC`,
        y1, 0, 8, 8, endReasonColors),
      bar('Last floor reached (distribution)',
        `SELECT 'F' || reached_floor AS floor, COUNT(*) AS runs FROM sim_runs WHERE batch_id = $batch_id GROUP BY reached_floor ORDER BY reached_floor`,
        y1, 8, 8, 8, { xField: 'floor', legendCalcs: ['sum'] }),
      bar('Deaths by room type',
        `SELECT COALESCE(death_encounter_type, 'unknown') AS encounter, COUNT(*) AS deaths FROM sim_runs WHERE batch_id = $batch_id AND died = 1 GROUP BY death_encounter_type ORDER BY deaths DESC`,
        y1, 16, 8, 8, { xField: 'encounter', orientation: 'horizontal', showLegend: false }),
      table('Deaths: floor × room type',
        `SELECT 'F' || reached_floor AS floor, COALESCE(death_encounter_type, 'unknown') AS encounter, COUNT(*) AS deaths,
          ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM sim_runs WHERE batch_id = $batch_id AND died = 1), 1) AS pct_of_deaths
         FROM sim_runs WHERE batch_id = $batch_id AND died = 1
         GROUP BY reached_floor, death_encounter_type ORDER BY reached_floor, deaths DESC`,
        y2, 0, 12, 9),
      bar('Funnel: runs reaching floor',
        `WITH floors AS (
           SELECT DISTINCT floor_number AS floor FROM sim_floor_visits fv JOIN sim_runs r ON r.id = fv.run_id WHERE r.batch_id = $batch_id
           UNION SELECT DISTINCT reached_floor AS floor FROM sim_runs WHERE batch_id = $batch_id
         )
         SELECT 'F' || f.floor AS floor,
           (SELECT COUNT(*) FROM sim_runs r WHERE r.batch_id = $batch_id AND r.reached_floor >= f.floor) AS runs_reached
         FROM floors f ORDER BY f.floor`,
        y2, 12, 12, 9, { showLegend: false, tooltipMode: 'single' }),
      bar('Avg player HP lost per visit',
        `SELECT 'F' || fv.floor_number AS floor, ROUND(AVG(MAX(0, fv.player_hp_start - fv.player_hp_end)), 1) AS hp_lost_avg
         FROM sim_floor_visits fv JOIN sim_runs r ON r.id = fv.run_id
         WHERE r.batch_id = $batch_id GROUP BY fv.floor_number ORDER BY fv.floor_number`,
        y3, 0, 12, 8),
      table('Run outcomes',
        `SELECT end_reason, COUNT(*) AS runs, ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM sim_runs WHERE batch_id = $batch_id), 1) AS pct
         FROM sim_runs WHERE batch_id = $batch_id GROUP BY end_reason ORDER BY runs DESC`,
        y3, 12, 12, 8),
    ],
    nextY: y3 + 8,
  };
}

function buildWeapons(baseY) {
  const y1 = baseY;
  const y2 = y1 + 9;
  const y3 = y2 + 8;
  return {
    panels: [
      bar('Weapon pips vs enemy HP (combat start)',
        `SELECT 'F' || fv.floor_number AS floor,
           ROUND(AVG(ws.start_pips), 1) AS weapon_pips_start,
           ROUND(AVG(es.enemy_hp), 1) AS enemy_hp_spawn
         FROM sim_floor_visits fv
         JOIN sim_runs r ON r.id = fv.run_id
         JOIN (SELECT floor_visit_id, SUM(pip_output) AS start_pips FROM sim_weapon_snapshots WHERE phase = 'start' GROUP BY floor_visit_id) ws ON ws.floor_visit_id = fv.id
         JOIN (SELECT floor_visit_id, SUM(health) AS enemy_hp FROM sim_enemy_spawns GROUP BY floor_visit_id) es ON es.floor_visit_id = fv.id
         WHERE r.batch_id = $batch_id AND fv.encounter_type IN ('COMBAT','ELITE','BOSS')
         GROUP BY fv.floor_number ORDER BY fv.floor_number`,
        y1, 0, 12, 9, {
        overrides: [
          { matcher: { id: 'byName', options: 'weapon_pips_start' }, properties: [{ id: 'color', value: { fixedColor: 'blue', mode: 'fixed' } }] },
          { matcher: { id: 'byName', options: 'enemy_hp_spawn' }, properties: [{ id: 'color', value: { fixedColor: 'orange', mode: 'fixed' } }] },
        ],
      }),
      bar('Weapon pips: floor start vs end',
        `SELECT 'F' || fv.floor_number AS floor,
           ROUND(AVG(ws.start_pips), 1) AS pips_start,
           ROUND(AVG(we.end_pips), 1) AS pips_end
         FROM sim_floor_visits fv
         JOIN sim_runs r ON r.id = fv.run_id
         JOIN (SELECT floor_visit_id, SUM(pip_output) AS start_pips FROM sim_weapon_snapshots WHERE phase = 'start' GROUP BY floor_visit_id) ws ON ws.floor_visit_id = fv.id
         JOIN (SELECT floor_visit_id, SUM(pip_output) AS end_pips FROM sim_weapon_snapshots WHERE phase = 'end' GROUP BY floor_visit_id) we ON we.floor_visit_id = fv.id
         WHERE r.batch_id = $batch_id AND fv.encounter_type IN ('COMBAT','ELITE','BOSS')
         GROUP BY fv.floor_number ORDER BY fv.floor_number`,
        y1, 12, 12, 9),
      bar('Can clear room (pips ≥ HP) %',
        `SELECT 'F' || fv.floor_number AS floor,
           ROUND(100.0 * SUM(CASE WHEN ws.start_pips >= es.enemy_hp THEN 1 ELSE 0 END) / COUNT(*), 1) AS clear_pct
         FROM sim_floor_visits fv JOIN sim_runs r ON r.id = fv.run_id
         JOIN (SELECT floor_visit_id, SUM(pip_output) AS start_pips FROM sim_weapon_snapshots WHERE phase = 'start' GROUP BY floor_visit_id) ws ON ws.floor_visit_id = fv.id
         JOIN (SELECT floor_visit_id, SUM(health) AS enemy_hp FROM sim_enemy_spawns GROUP BY floor_visit_id) es ON es.floor_visit_id = fv.id
         WHERE r.batch_id = $batch_id AND fv.encounter_type IN ('COMBAT','ELITE','BOSS')
         GROUP BY fv.floor_number ORDER BY fv.floor_number`,
        y2, 0, 8, 8, { unit: 'percent', max: 100, min: 0, showValue: 'always', colorMode: 'continuous-GrYlRd', gradientMode: 'scheme', fillOpacity: 80 }),
      bar('Combat damage: effective vs overkill',
        `SELECT 'F' || fv.floor_number AS floor,
           ROUND(AVG(fv.combat_damage_dealt - fv.combat_damage_wasted), 1) AS damage_effective,
           ROUND(AVG(fv.combat_damage_wasted), 1) AS damage_wasted
         FROM sim_floor_visits fv JOIN sim_runs r ON r.id = fv.run_id
         WHERE r.batch_id = $batch_id AND fv.combat_damage_dealt IS NOT NULL
         GROUP BY fv.floor_number ORDER BY fv.floor_number`,
        y2, 8, 8, 8, {
        stacking: 'normal',
        overrides: [
          { matcher: { id: 'byName', options: 'damage_effective' }, properties: [{ id: 'color', value: { fixedColor: 'green', mode: 'fixed' } }] },
          { matcher: { id: 'byName', options: 'damage_wasted' }, properties: [{ id: 'color', value: { fixedColor: 'red', mode: 'fixed' } }] },
        ],
      }),
      bar('Overkill % of damage dealt',
        `SELECT 'F' || fv.floor_number AS floor,
           ROUND(100.0 * SUM(fv.combat_damage_wasted) / NULLIF(SUM(fv.combat_damage_dealt), 0), 1) AS overkill_pct
         FROM sim_floor_visits fv JOIN sim_runs r ON r.id = fv.run_id
         WHERE r.batch_id = $batch_id AND fv.combat_damage_dealt IS NOT NULL
         GROUP BY fv.floor_number ORDER BY fv.floor_number`,
        y2, 16, 8, 8, { unit: 'percent', max: 100, min: 0, showValue: 'always' }),
      table('Combats: pips, enemy HP, overkill',
        `SELECT 'F' || fv.floor_number AS floor, fv.encounter_type,
           ws.start_pips, we.end_pips, es.enemy_hp,
           fv.combat_damage_dealt, fv.combat_damage_wasted,
           ROUND(100.0 * fv.combat_damage_wasted / NULLIF(fv.combat_damage_dealt, 0), 1) AS overkill_pct
         FROM sim_floor_visits fv
         JOIN sim_runs r ON r.id = fv.run_id
         LEFT JOIN (SELECT floor_visit_id, SUM(pip_output) AS start_pips FROM sim_weapon_snapshots WHERE phase = 'start' GROUP BY floor_visit_id) ws ON ws.floor_visit_id = fv.id
         LEFT JOIN (SELECT floor_visit_id, SUM(pip_output) AS end_pips FROM sim_weapon_snapshots WHERE phase = 'end' GROUP BY floor_visit_id) we ON we.floor_visit_id = fv.id
         LEFT JOIN (SELECT floor_visit_id, SUM(health) AS enemy_hp FROM sim_enemy_spawns GROUP BY floor_visit_id) es ON es.floor_visit_id = fv.id
         WHERE r.batch_id = $batch_id AND fv.encounter_type IN ('COMBAT','ELITE','BOSS')
         ORDER BY fv.floor_number, fv.visit_order LIMIT 300`,
        y3, 0, 24, 10),
    ],
    nextY: y3 + 10,
  };
}

function buildMonsters(baseY) {
  const y1 = baseY;
  const y2 = y1 + 8;
  const y3 = y2 + 11;
  return {
    panels: [
      pie('Enemy types at spawn',
        `SELECT COALESCE(e.enemy_type, 'unknown') AS label, COUNT(*) AS value
         FROM sim_enemy_spawns e
         JOIN sim_floor_visits fv ON fv.id = e.floor_visit_id
         JOIN sim_runs r ON r.id = fv.run_id
         WHERE r.batch_id = $batch_id GROUP BY e.enemy_type ORDER BY value DESC`,
        y1, 0, 8, 8),
      bar('Total enemy HP at spawn by floor',
        `SELECT 'F' || fv.floor_number AS floor, MIN(tot.hp) AS min_hp, MAX(tot.hp) AS max_hp, ROUND(AVG(tot.hp), 1) AS avg_hp
         FROM (SELECT e.floor_visit_id, SUM(e.health) AS hp FROM sim_enemy_spawns e GROUP BY e.floor_visit_id) tot
         JOIN sim_floor_visits fv ON fv.id = tot.floor_visit_id
         JOIN sim_runs r ON r.id = fv.run_id
         WHERE r.batch_id = $batch_id GROUP BY fv.floor_number ORDER BY fv.floor_number`,
        y1, 8, 16, 8),
      table('Summary: floor × enemy name',
        `SELECT 'F' || fv.floor_number AS floor, COALESCE(e.name, e.enemy_type) AS enemy,
           COUNT(*) AS spawns, ROUND(AVG(e.health), 1) AS avg_hp, ROUND(AVG(e.attack), 1) AS avg_atk,
           ROUND(AVG(e.max_health), 1) AS avg_max_hp
         FROM sim_enemy_spawns e
         JOIN sim_floor_visits fv ON fv.id = e.floor_visit_id
         JOIN sim_runs r ON r.id = fv.run_id
         WHERE r.batch_id = $batch_id
         GROUP BY fv.floor_number, COALESCE(e.name, e.enemy_type)
         ORDER BY fv.floor_number, spawns DESC LIMIT 200`,
        y2, 0, 24, 11),
      table('All spawns (detail)',
        `SELECT r.run_number, 'F' || fv.floor_number AS floor, fv.encounter_type,
           e.spawn_order, COALESCE(e.name, e.enemy_type) AS enemy, e.role,
           e.health, e.max_health, e.attack, e.is_boss, e.is_ranged_type
         FROM sim_enemy_spawns e
         JOIN sim_floor_visits fv ON fv.id = e.floor_visit_id
         JOIN sim_runs r ON r.id = fv.run_id
         WHERE r.batch_id = $batch_id
         ORDER BY r.run_number, fv.visit_order, e.spawn_order LIMIT 500`,
        y3, 0, 24, 12),
    ],
    nextY: y3 + 12,
  };
}

/** Remap panel y coords to start at 1 (for nested collapsed rows). */
function toNestedY(panels, baseY) {
  const minY = Math.min(...panels.map((p) => p.gridPos.y));
  return panels.map((p) => ({
    ...p,
    gridPos: { ...p.gridPos, y: p.gridPos.y - minY + 1 },
  }));
}

function addSection(panels, title, collapsed, buildFn, y) {
  const { panels: children, nextY } = buildFn(y + 1);

  const row = {
    collapsed,
    gridPos: { h: 1, w: 24, x: 0, y },
    id: uid(),
    panels: collapsed ? toNestedY(children, y + 1) : [],
    title,
    type: 'row',
  };
  panels.push(row);

  if (!collapsed) {
    for (const p of children) panels.push(p);
    return nextY;
  }
  return y + 1;
}

const panels = [];
let y = 0;

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
    { asDropdown: false, icon: 'dashboard', includeVars: false, keepTime: true, tags: [], targetBlank: false, title: 'Compare A vs B', tooltip: '', type: 'link', url: '/d/sim-balance-compare/sim-balance-compare' },
  ],
  panels,
  refresh: '30s',
  schemaVersion: 39,
  tags: ['sim', 'balance'],
  templating: {
    list: [{
      current: {},
      datasource: DS,
      definition: BATCH_VAR_SQL,
      hide: 0,
      includeAll: false,
      label: 'Batch',
      multi: false,
      name: 'batch_id',
      options: [],
      query: BATCH_VAR_SQL,
      refresh: 1,
      regex: '',
      skipUrlSync: false,
      sort: 0,
      type: 'query',
    }],
  },
  time: { from: 'now-6h', to: 'now' },
  timepicker: { hidden: true },
  timezone: 'browser',
  title: 'Sim Balance',
  uid: 'sim-balance',
  version: 9,
  weekStart: '',
};

writeFileSync(join(__dirname, 'dashboards', 'sim-balance.json'), `${JSON.stringify(dashboard, null, 2)}\n`);
const rows = panels.filter((p) => p.type === 'row').length;
const flat = panels.filter((p) => p.type !== 'row').length;
const nested = panels.filter((p) => p.type === 'row').reduce((n, r) => n + (r.panels?.length || 0), 0);
console.log(`Wrote sim-balance.json — ${rows} rows, ${flat} flat panels, ${nested} nested panels`);

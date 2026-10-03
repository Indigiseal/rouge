-- Example queries for sim/db/stats.sqlite
-- Replace :batch_id with the batch id printed after a run.

-- Batch overview
SELECT id, created_at, mode, runs_planned, runs_completed FROM sim_batches ORDER BY id DESC LIMIT 5;

-- Win rate for a batch
SELECT
  COUNT(*) AS runs,
  SUM(won) AS wins,
  ROUND(100.0 * SUM(won) / COUNT(*), 1) AS win_pct,
  ROUND(AVG(reached_floor), 1) AS avg_floor
FROM sim_runs WHERE batch_id = :batch_id;

-- Floor visits by encounter type
SELECT encounter_type, COUNT(*) AS n
FROM sim_floor_visits fv
JOIN sim_runs r ON r.id = fv.run_id
WHERE r.batch_id = :batch_id
GROUP BY encounter_type ORDER BY n DESC;

-- Weapon pip budget at floor start (combat floors only)
SELECT
  fv.floor_number,
  MIN(w.pip_output) AS min_pip_per_weapon,
  MAX(w.pip_output) AS max_pip_per_weapon,
  ROUND(AVG(w.pip_output), 1) AS avg_pip
FROM sim_weapon_snapshots w
JOIN sim_floor_visits fv ON fv.id = w.floor_visit_id
JOIN sim_runs r ON r.id = fv.run_id
WHERE r.batch_id = :batch_id
  AND w.phase = 'start'
  AND fv.encounter_type IN ('COMBAT', 'ELITE', 'BOSS')
GROUP BY fv.floor_number
ORDER BY fv.floor_number;

-- Total carried pip output at floor start (sum per visit)
SELECT
  fv.floor_number,
  MIN(tot.pips) AS min_total_pips,
  MAX(tot.pips) AS max_total_pips,
  ROUND(AVG(tot.pips), 1) AS avg_total_pips
FROM (
  SELECT floor_visit_id, SUM(pip_output) AS pips
  FROM sim_weapon_snapshots WHERE phase = 'start'
  GROUP BY floor_visit_id
) tot
JOIN sim_floor_visits fv ON fv.id = tot.floor_visit_id
JOIN sim_runs r ON r.id = fv.run_id
WHERE r.batch_id = :batch_id
  AND fv.encounter_type IN ('COMBAT', 'ELITE', 'BOSS')
GROUP BY fv.floor_number
ORDER BY fv.floor_number;

-- Enemies per combat floor
SELECT
  fv.floor_number,
  e.name,
  COUNT(*) AS spawns,
  ROUND(AVG(e.health), 1) AS avg_hp,
  ROUND(AVG(e.attack), 1) AS avg_atk
FROM sim_enemy_spawns e
JOIN sim_floor_visits fv ON fv.id = e.floor_visit_id
JOIN sim_runs r ON r.id = fv.run_id
WHERE r.batch_id = :batch_id
GROUP BY fv.floor_number, e.name
ORDER BY fv.floor_number, spawns DESC;

-- End reasons for a batch
SELECT end_reason, COUNT(*) AS runs
FROM sim_runs
WHERE batch_id = :batch_id
GROUP BY end_reason;

-- HP per floor visit
SELECT floor_number, encounter_type,
       player_hp_start, player_hp_end,
       player_max_hp_start, player_max_hp_end
FROM sim_floor_visits fv
JOIN sim_runs r ON r.id = fv.run_id
WHERE r.batch_id = :batch_id
ORDER BY fv.run_id, fv.visit_order
LIMIT 50;

SELECT fv.visit_order, fv.floor_number, fv.encounter_type,
       fv.player_hp_start, fv.player_hp_end
FROM sim_floor_visits fv
WHERE fv.run_id = :run_id
ORDER BY fv.visit_order;

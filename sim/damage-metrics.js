export function captureEnemyHealth(board) {
  return board.filter(c => ['enemy', 'eliteEnemy', 'boss'].includes(c?.data?.type) && c.data.health > 0)
    .map(card => ({ card, data: card.data, hp: card.data.health, hidden: !card.revealed }));
}

export function recordDamageAction(floors, floor, before, weapon, printed, primary) {
  const row = { total: 0, primary: 0, hidden: 0, hits: 0, printed,
    gem: weapon?.gemEffect || weapon?.gem2Effect || 'none', weapon: weapon?.weaponType || 'unknown' };
  for (const entry of before) {
    const removed = Math.max(0, entry.hp - Math.max(0, entry.data.health || 0));
    row.total += removed;
    if (entry.card === primary) row.primary += removed;
    if (entry.hidden) row.hidden += removed;
    if (removed > 0) row.hits++;
  }
  (floors[floor] ||= []).push(row);
}

function summary(rows) {
  if (!rows.length) return null;
  const sorted = rows.map(r => r.total).sort((a, b) => a - b);
  const mean = key => rows.reduce((sum, r) => sum + r[key], 0) / rows.length;
  return { actions: rows.length, mean: mean('total'), median: sorted[Math.floor(sorted.length / 2)],
    p10: sorted[Math.floor((sorted.length - 1) * .1)], p90: sorted[Math.floor((sorted.length - 1) * .9)],
    primary: mean('primary'), hidden: mean('hidden'), targets: mean('hits'), preparedMainHit: mean('printed') };
}

export function summarizeDamageActions(floors) {
  if (!floors) return null;
  return Object.entries(floors).map(([floor, rows]) => ({ floor: Number(floor), all: summary(rows),
    plain: summary(rows.filter(r => r.gem === 'none')), gemmed: summary(rows.filter(r => r.gem !== 'none')),
    byGem: Object.fromEntries(['fire', 'lightning', 'poison'].map(id => [id, summary(rows.filter(r => r.gem === id))])),
  }));
}

// sim/loot-stats.js — aggregation helpers for the loot-stats playtest mode.

const MAX_FLOOR = 45;

function bump(map, key, delta = 1) {
  map[key] = (map[key] || 0) + delta;
}

function blankFloorBucket() {
  return {
    count: 0,
    damageSum: 0,
    byDamage: {},
    byType: {},
    byRarity: {},
    bySource: {},
  };
}

function blankEnemyFloorBucket() {
  return {
    count: 0,
    healthSum: 0,
    healthMin: null,
    healthMax: 0,
    byName: {},
    bossCount: 0,
  };
}

function blankFloorTableEntry() {
  return {
    runs: 0,
    weaponAvgSum: 0,
    weaponRunsWithCards: 0,
  };
}

export function sumCarriedWeaponPips(gs, inv) {
  let total = 0;
  forEachCarriedWeapon(gs, inv, (weapon) => {
    total += weaponPipOutput(weapon);
  });
  return total;
}

function blankClearabilityEntry() {
  return {
    floorVisits: 0,
    combatRuns: 0,
    enemyHpSumMin: null,
    enemyHpSumMax: null,
    startWeaponMin: null,
    startWeaponMax: null,
    endWeaponMin: null,
    endWeaponMax: null,
    clearsFloor: 0,
  };
}

function weaponPipOutput(weapon) {
  const dmg = Math.max(0, weapon.damage || 0);
  const pips = Math.max(0, weapon.durability ?? weapon.maxDurability ?? 0);
  return dmg * pips;
}

function forEachCarriedWeapon(gs, inv, fn) {
  const seen = new Set();
  const note = (weapon) => {
    if (!weapon || weapon.type !== 'weapon' || seen.has(weapon)) return;
    seen.add(weapon);
    fn(weapon);
  };
  note(gs.equippedWeapon);
  for (const card of inv) note(card);
}

function forEachAccessibleWeapon(gs, inv, board, fn) {
  forEachCarriedWeapon(gs, inv, fn);
  for (const card of board || []) {
    const weapon = card?.data;
    if (weapon?.type === 'weapon') fn(weapon);
  }
}

export function newLootStats() {
  const weaponsByFloor = {};
  const enemiesByFloor = {};
  const floorTable = {};
  const clearability = {};
  for (let f = 1; f <= MAX_FLOOR; f++) {
    weaponsByFloor[f] = blankFloorBucket();
    enemiesByFloor[f] = blankEnemyFloorBucket();
    floorTable[f] = blankFloorTableEntry();
    clearability[f] = blankClearabilityEntry();
  }
  return {
    runs: 0,
    weapons: {
      total: 0,
      byDamage: {},
      byType: {},
      byRarity: {},
      bySource: {},
      byFloor: weaponsByFloor,
    },
    enemies: { byFloor: enemiesByFloor },
    floorTable,
    clearability,
    runEndBonuses: [],
    amuletPickCounts: {},
    relicEffectTotals: {},
  };
}

export function recordWeapon(stats, floor, weapon, source = 'spawn') {
  if (!stats || !weapon || weapon.type !== 'weapon') return;
  const dmg = weapon.damage || 0;
  const wt = weapon.weaponType || 'unknown';
  const rarity = weapon.rarity || 'unknown';

  stats.weapons.total++;
  bump(stats.weapons.byDamage, dmg);
  bump(stats.weapons.byType, wt);
  bump(stats.weapons.byRarity, rarity);
  bump(stats.weapons.bySource, source);

  const bucket = stats.weapons.byFloor[floor] || blankFloorBucket();
  stats.weapons.byFloor[floor] = bucket;
  bucket.count++;
  bucket.damageSum += dmg;
  bump(bucket.byDamage, dmg);
  bump(bucket.byType, wt);
  bump(bucket.byRarity, rarity);
  bump(bucket.bySource, source);
}

export function recordEnemy(stats, floor, enemy) {
  if (!stats || !enemy) return;
  const hp = enemy.health || 0;
  if (hp <= 0) return;
  const name = enemy.name || enemy.type || 'unknown';
  const isBoss = enemy.type === 'boss';

  const bucket = stats.enemies.byFloor[floor] || blankEnemyFloorBucket();
  stats.enemies.byFloor[floor] = bucket;
  bucket.count++;
  bucket.healthSum += hp;
  bucket.healthMin = bucket.healthMin === null ? hp : Math.min(bucket.healthMin, hp);
  bucket.healthMax = Math.max(bucket.healthMax, hp);
  if (isBoss) bucket.bossCount++;

  if (!bucket.byName[name]) bucket.byName[name] = { count: 0, healthSum: 0 };
  bucket.byName[name].count++;
  bucket.byName[name].healthSum += hp;
}

export function recordBoard(stats, floor, board) {
  if (!stats || !board) return;
  for (const card of board) {
    if (!card?.data) continue;
    if (card.data.type === 'weapon') recordWeapon(stats, floor, card.data, 'spawn');
    if (card.data.type === 'enemy' || card.data.type === 'boss') recordEnemy(stats, floor, card.data);
  }
}

// Snapshot at floor end: equipped weapon + inventory + weapons still on the board.
// Dedupes by object reference so a picked-up card is not counted twice.
export function recordFloorSnapshot(stats, floor, gs, inv, board) {
  if (!stats) return;
  const seen = new Set();
  const damages = [];
  const note = (weapon) => {
    if (!weapon || weapon.type !== 'weapon') return;
    if (seen.has(weapon)) return;
    seen.add(weapon);
    damages.push(weapon.damage || 0);
  };

  note(gs.equippedWeapon);
  for (const card of inv) note(card);
  for (const card of board || []) note(card?.data);

  const row = stats.floorTable[floor] || blankFloorTableEntry();
  stats.floorTable[floor] = row;
  row.runs++;
  if (damages.length) {
    row.weaponAvgSum += damages.reduce((sum, dmg) => sum + dmg, 0) / damages.length;
    row.weaponRunsWithCards++;
  }
}

// Start of floor: inventory + equipped weapon pip budget (before room action).
export function recordFloorInventoryStart(stats, floor, gs, inv) {
  if (!stats) return;
  const pips = sumCarriedWeaponPips(gs, inv);
  const row = stats.clearability[floor] || blankClearabilityEntry();
  row.floorVisits++;
  row.startWeaponMin = row.startWeaponMin === null ? pips : Math.min(row.startWeaponMin, pips);
  row.startWeaponMax = row.startWeaponMax === null ? pips : Math.max(row.startWeaponMax, pips);
  stats.clearability[floor] = row;
}

// End of floor: inventory after room (combat cleared + loot collected, shop done, etc.).
export function recordFloorInventoryEnd(stats, floor, gs, inv) {
  if (!stats) return;
  const pips = sumCarriedWeaponPips(gs, inv);
  const row = stats.clearability[floor] || blankClearabilityEntry();
  row.endWeaponMin = row.endWeaponMin === null ? pips : Math.min(row.endWeaponMin, pips);
  row.endWeaponMax = row.endWeaponMax === null ? pips : Math.max(row.endWeaponMax, pips);
  stats.clearability[floor] = row;
}

// Combat spawn: enemy HP total vs weapon pips brought into the fight.
export function recordCombatEnemySnapshot(stats, floor, board, startWeaponPips) {
  if (!stats) return;

  let enemyHpSum = 0;
  for (const card of board || []) {
    const data = card?.data;
    if (data?.type === 'enemy' || data?.type === 'boss') enemyHpSum += data.health || 0;
  }
  if (enemyHpSum <= 0) return;

  const row = stats.clearability[floor] || blankClearabilityEntry();
  stats.clearability[floor] = row;
  row.combatRuns++;
  row.enemyHpSumMin = row.enemyHpSumMin === null ? enemyHpSum : Math.min(row.enemyHpSumMin, enemyHpSum);
  row.enemyHpSumMax = row.enemyHpSumMax === null ? enemyHpSum : Math.max(row.enemyHpSumMax, enemyHpSum);
  if (startWeaponPips >= enemyHpSum) row.clearsFloor++;
}

export function recordRunBonuses(stats, gs, mock, config, runResult) {
  if (!stats) return;
  const amuletIds = (gs.activeAmulets || []).map((a) => a.id || a).filter(Boolean);
  for (const id of amuletIds) bump(stats.amuletPickCounts, id);

  const sampleBase = 10;
  const amuletWeaponBonus = mock.amuletManager
    ? mock.amuletManager.modifyWeaponDamage(sampleBase) - sampleBase
    : 0;
  const relicWeaponBonus = gs.relicEffects?.weaponDamageBonus || 0;

  const relicEffects = { ...(gs.relicEffects || {}) };
  for (const [key, value] of Object.entries(relicEffects)) {
    if (typeof value === 'number') {
      stats.relicEffectTotals[key] = (stats.relicEffectTotals[key] || 0) + value;
    } else if (value === true) {
      stats.relicEffectTotals[key] = (stats.relicEffectTotals[key] || 0) + 1;
    }
  }

  stats.runEndBonuses.push({
    reachedFloor: runResult.reached,
    won: runResult.won,
    killer: runResult.killer,
    amulets: amuletIds,
    amuletCount: amuletIds.length,
    amuletWeaponDmgBonus: amuletWeaponBonus,
    relicWeaponDmgBonus: relicWeaponBonus,
    veteranHp: config.veteranHp || 0,
    maxHealth: gs.maxHealth,
    maxActions: gs.maxActions,
    bonusInventorySlots: gs.bonusInventorySlots || 0,
    relicCount: (config.relics || []).length,
    relicEffects,
  });
  stats.runs++;
}

function pct(n, d) { return d ? ((100 * n) / d).toFixed(1) : '0.0'; }
function avg(sum, n) { return n ? (sum / n) : 0; }

function formatTableCell(value, width, empty = '   —') {
  if (value === null || value === undefined) return empty.padStart(width);
  return value.toFixed(1).padStart(width);
}

function formatIntCell(value, width, empty = '  —') {
  if (value === null || value === undefined) return empty.padStart(width);
  return String(Math.round(value)).padStart(width);
}

export function reportFloorTable(stats) {
  const N = stats.runs || 0;
  const floorCol = 5;
  const wpnCol = 17;
  const hpCol = 14;

  console.log(`${'Этаж'.padEnd(floorCol)} | ${'Ср. урон оружия'.padStart(wpnCol)} | ${'Ср. HP врагов'.padStart(hpCol)}`);
  console.log(`${'-'.repeat(floorCol)}-+-${'-'.repeat(wpnCol)}-+-${'-'.repeat(hpCol)}`);

  for (let f = 1; f <= MAX_FLOOR; f++) {
    const row = stats.floorTable[f];
    const enemies = stats.enemies.byFloor[f];
    if (!row?.runs && !enemies?.count) continue;

    const weaponAvg = row?.weaponRunsWithCards
      ? avg(row.weaponAvgSum, row.weaponRunsWithCards)
      : null;
    const enemyAvg = enemies?.count ? avg(enemies.healthSum, enemies.count) : null;

    console.log(
      `${String(f).padStart(floorCol)} | ${formatTableCell(weaponAvg, wpnCol)} | ${formatTableCell(enemyAvg, hpCol)}`
    );
  }

  console.log(`\n(Ср. урон оружия: инвентарь + экипировка + карты на поле, усреднено по ${N} забегам на этаж.)`);
  console.log(`(Ср. HP врагов: все враги/боссы при спавне боевой сцены, усреднено по всем экземплярам.)`);
}

export function reportClearabilityTable(stats) {
  const floorCol = 5;
  const hpMinCol = 8;
  const hpMaxCol = 8;
  const startMinCol = 10;
  const startMaxCol = 10;
  const endMinCol = 10;
  const endMaxCol = 10;
  const okCol = 8;

  console.log(`\n=== Зачистка этажа (Σ HP врагов vs Σ урон×pip инвентаря) ===\n`);
  console.log(
    `${'Этаж'.padEnd(floorCol)} | ${'min HP'.padStart(hpMinCol)} | ${'max HP'.padStart(hpMaxCol)} | ` +
    `${'pip↓нач'.padStart(startMinCol)} | ${'pip↑нач'.padStart(startMaxCol)} | ` +
    `${'pip↓кон'.padStart(endMinCol)} | ${'pip↑кон'.padStart(endMaxCol)} | ${'хватает'.padStart(okCol)}`
  );
  console.log(
    `${'-'.repeat(floorCol)}-+-${'-'.repeat(hpMinCol)}-+-${'-'.repeat(hpMaxCol)}-+-` +
    `${'-'.repeat(startMinCol)}-+-${'-'.repeat(startMaxCol)}-+-` +
    `${'-'.repeat(endMinCol)}-+-${'-'.repeat(endMaxCol)}-+-${'-'.repeat(okCol)}`
  );

  for (let f = 1; f <= MAX_FLOOR; f++) {
    const row = stats.clearability[f];
    if (!row?.floorVisits && !row?.combatRuns) continue;

    const okPct = row.combatRuns ? `${pct(row.clearsFloor, row.combatRuns)}%` : '  —';
    console.log(
      `${String(f).padStart(floorCol)} | ${formatIntCell(row.enemyHpSumMin, hpMinCol)} | ` +
      `${formatIntCell(row.enemyHpSumMax, hpMaxCol)} | ` +
      `${formatIntCell(row.startWeaponMin, startMinCol)} | ${formatIntCell(row.startWeaponMax, startMaxCol)} | ` +
      `${formatIntCell(row.endWeaponMin, endMinCol)} | ${formatIntCell(row.endWeaponMax, endMaxCol)} | ` +
      `${okPct.padStart(okCol)}`
    );
  }

  console.log(`\n(pip↓/↑ нач — min/max Σ(урон×pip) в инвентаре+экип на СТАРТЕ этажа, по ${stats.runs || 0} забегам.)`);
  console.log(`(pip↓/↑ кон — min/max после комнаты: бой зачищен, лут подобран / магазин и т.д.)`);
  console.log(`(min/max HP — враги на поле в момент спавна боя. «хватает» = pip на старте боя ≥ Σ HP.)`);
}

export function reportLootStats(stats) {
  const N = stats.runs || 0;
  console.log(`\n=== Loot Stats Playtest ===`);
  console.log(`runs=${N}\n`);

  reportFloorTable(stats);
  reportClearabilityTable(stats);

  console.log(`\n--- Детали ---\n`);
  console.log(`Weapon cards (all sources, per run avg=${N ? (stats.weapons.total / N).toFixed(1) : '0'}):`);
  console.log(`  by source: ${Object.entries(stats.weapons.bySource).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join('  ') || '(none)'}`);
  console.log(`  by damage:`);
  Object.keys(stats.weapons.byDamage).map(Number).sort((a, b) => a - b).forEach((dmg) => {
    const c = stats.weapons.byDamage[dmg];
    console.log(`    ${String(dmg).padStart(2)} dmg: ${c} (${pct(c, stats.weapons.total)}%)`);
  });

  console.log(`\nWeapon damage by floor (spawn + shop + treasure + boss reward):`);
  console.log(`fl   count/run  avgDmg  distribution (damage:count)`);
  for (let f = 1; f <= MAX_FLOOR; f++) {
    const b = stats.weapons.byFloor[f];
    if (!b.count) continue;
    const perRun = b.count / N;
    const meanDmg = avg(b.damageSum, b.count);
    const dist = Object.keys(b.byDamage).map(Number).sort((a, b) => a - b)
      .map((d) => `${d}:${b.byDamage[d]}`).join(' ');
    console.log(`${String(f).padStart(2)}   ${perRun.toFixed(2).padStart(8)}  ${meanDmg.toFixed(1).padStart(6)}  ${dist}`);
  }

  console.log(`\nEnemy HP by floor (at spawn, averaged over runs that saw combat there):`);
  console.log(`fl   enemies/run  avgHP  minHP  maxHP  bosses/run`);
  for (let f = 1; f <= MAX_FLOOR; f++) {
    const b = stats.enemies.byFloor[f];
    if (!b.count) continue;
    const perRun = b.count / N;
    const meanHp = avg(b.healthSum, b.count);
    console.log(
      `${String(f).padStart(2)}   ${perRun.toFixed(2).padStart(11)}  ${meanHp.toFixed(1).padStart(5)}  ` +
      `${String(b.healthMin).padStart(5)}  ${String(b.healthMax).padStart(5)}  ${(b.bossCount / N).toFixed(2)}`
    );
  }

  if (stats.runEndBonuses.length) {
    const mean = (fn) => avg(stats.runEndBonuses.reduce((s, r) => s + fn(r), 0), stats.runEndBonuses.length);
    console.log(`\nRun-end bonuses (mean over ${N} runs):`);
    console.log(`  max HP: ${mean((r) => r.maxHealth).toFixed(1)}  max AP: ${mean((r) => r.maxActions).toFixed(1)}`);
    console.log(`  veteran HP bonus: ${mean((r) => r.veteranHp).toFixed(1)}`);
    console.log(`  amulets equipped: ${mean((r) => r.amuletCount).toFixed(1)}`);
    console.log(`  amulet weapon dmg bonus (on base 10): +${mean((r) => r.amuletWeaponDmgBonus).toFixed(2)}`);
    console.log(`  relic weapon dmg bonus: +${mean((r) => r.relicWeaponDmgBonus).toFixed(2)}`);
    console.log(`  relics active: ${mean((r) => r.relicCount).toFixed(1)}`);

    const topAmulets = Object.entries(stats.amuletPickCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 12);
    if (topAmulets.length) {
      console.log(`\n  Top amulets held at run end (times across all runs):`);
      for (const [id, count] of topAmulets) {
        console.log(`    ${id.padEnd(22)} ${count} (${pct(count, N)}% of runs)`);
      }
    }

    const relicKeys = Object.keys(stats.relicEffectTotals).sort();
    if (relicKeys.length) {
      console.log(`\n  Relic effect presence (sum of numeric values / count of boolean trues across runs):`);
      for (const key of relicKeys) {
        const total = stats.relicEffectTotals[key];
        console.log(`    ${key.padEnd(28)} ${typeof total === 'number' ? total.toFixed(1) : total}`);
      }
    }
  }
}

export function lootStatsToJson(stats) {
  return JSON.stringify(stats, null, 2);
}

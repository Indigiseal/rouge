// sim/stats-recorder.js — capture floor snapshots during headless runs.

function weaponPipOutput(weapon) {
  const dmg = Math.max(0, weapon?.damage || 0);
  const pips = Math.max(0, weapon?.durability ?? weapon?.maxDurability ?? 0);
  return dmg * pips;
}

function collectWeaponRows(gs, inv) {
  const rows = [];
  const seen = new Set();

  const push = (weapon, { isEquipped, invIndex }) => {
    if (!weapon || weapon.type !== 'weapon' || seen.has(weapon)) return;
    seen.add(weapon);
    rows.push({
      is_equipped: isEquipped ? 1 : 0,
      inv_index: invIndex ?? null,
      name: weapon.name ?? null,
      weapon_type: weapon.weaponType ?? null,
      damage: weapon.damage ?? 0,
      durability: weapon.durability ?? 0,
      max_durability: weapon.maxDurability ?? weapon.durability ?? 0,
      rarity: weapon.rarity ?? null,
      weapon_range: weapon.range ?? null,
      gem_effect: weapon.gemEffect ?? null,
      gem_count: weapon.gemCount ?? 0,
      pip_output: weaponPipOutput(weapon),
    });
  };

  push(gs.equippedWeapon, { isEquipped: true, invIndex: null });
  for (let i = 0; i < inv.length; i++) {
    if (inv[i]?.type === 'weapon') push(inv[i], { isEquipped: false, invIndex: i });
  }
  return rows;
}

function collectEnemyRows(board) {
  const rows = [];
  for (let i = 0; i < (board || []).length; i++) {
    const data = board[i]?.data;
    if (!data || (data.type !== 'enemy' && data.type !== 'boss')) continue;
    rows.push({
      spawn_order: rows.length + 1,
      name: data.name ?? null,
      enemy_type: data.type,
      role: data.role ?? null,
      health: data.health ?? 0,
      max_health: data.maxHealth ?? data.health ?? null,
      attack: data.attack ?? 0,
      is_boss: data.type === 'boss' ? 1 : 0,
      is_ranged_type: data.isRangedType ? 1 : 0,
      board_index: i,
    });
  }
  return rows;
}

export class StatsRecorder {
  constructor(db) {
    this.db = db;
    this.batchId = null;
    this.runId = null;
    this.floorVisitId = null;
    this.visitOrder = 0;
    this.runNumber = 0;
    this.combatDamageDealt = null;
    this.combatDamageWasted = null;
    this.combatDamageTaken = null;
    this.combatDamageBlockedArmor = null;
    this.combatDamageDodged = null;
    this.combatSpecializationDualWield = null;
    this.combatSpecializationGem = null;
  }

  beginBatch({ label, mode, runsPlanned, config }) {
    this.batchId = this.db.beginBatch({ label, mode, runsPlanned, config });
    return this.batchId;
  }

  finishBatch(runsCompleted) {
    if (this.batchId != null) this.db.finishBatch(this.batchId, runsCompleted);
  }

  beginRun() {
    this.runNumber += 1;
    this.visitOrder = 0;
    this.runId = this.db.beginRun(this.batchId, this.runNumber);
    this.floorVisitId = null;
    return this.runId;
  }

  finishRun({ won, reachedFloor, died, endReason, deathEncounterType }) {
    if (this.runId != null) {
      this.db.finishRun(this.runId, {
        won,
        reachedFloor,
        died,
        endReason,
        deathEncounterType,
      });
    }
    this.runId = null;
    this.floorVisitId = null;
  }

  beginFloorVisit(floorNumber, encounterType, playerHpStart, playerMaxHpStart) {
    this.visitOrder += 1;
    this.combatDamageDealt = null;
    this.combatDamageWasted = null;
    this.combatDamageTaken = null;
    this.combatDamageBlockedArmor = null;
    this.combatDamageDodged = null;
    this.combatSpecializationDualWield = null;
    this.combatSpecializationGem = null;
    this.floorVisitId = this.db.beginFloorVisit(this.runId, {
      floorNumber,
      visitOrder: this.visitOrder,
      encounterType,
      playerHpStart,
      playerMaxHpStart,
    });
    return this.floorVisitId;
  }

  recordWeapons(phase, gs, inv) {
    if (this.floorVisitId == null) return;
    for (const row of collectWeaponRows(gs, inv)) {
      this.db.insertWeaponSnapshot(this.floorVisitId, phase, row);
    }
  }

  recordEnemies(board) {
    if (this.floorVisitId == null) return;
    for (const row of collectEnemyRows(board)) {
      this.db.insertEnemySpawn(this.floorVisitId, row);
    }
  }

  /** Mid-run amulet equip (shop/floor/boss/event). Skipped when no active floor visit. */
  recordAmuletGain(amuletId, rarity = 'unknown') {
    if (this.floorVisitId == null || !amuletId) return;
    this.db.insertAmuletGain(this.floorVisitId, { amuletId, rarity });
  }

  recordCombatStats(statsOrDamageDealt, damageWasted = null) {
    // Backward-compatible shape:
    // - recordCombatStats(damageDealt, damageWasted)
    // - recordCombatStats({ damageDealt, damageWasted, ... })
    if (typeof statsOrDamageDealt === 'object' && statsOrDamageDealt !== null) {
      const stats = statsOrDamageDealt;
      this.combatDamageDealt = stats.damageDealt ?? null;
      this.combatDamageWasted = stats.damageWasted ?? null;
      this.combatDamageTaken = stats.damageTaken ?? null;
      this.combatDamageBlockedArmor = stats.damageBlockedArmor ?? null;
      this.combatDamageDodged = stats.damageDodged ?? null;
      this.combatSpecializationDualWield = stats.specializationDualWield ?? null;
      this.combatSpecializationGem = stats.specializationGem ?? null;
      return;
    }
    this.combatDamageDealt = statsOrDamageDealt;
    this.combatDamageWasted = damageWasted;
  }

  finishFloorVisit(playerHpEnd, playerMaxHpEnd, extras = {}) {
    if (this.floorVisitId != null) {
      const combat = {};
      if (this.combatDamageDealt != null) combat.damageDealt = this.combatDamageDealt;
      if (this.combatDamageWasted != null) combat.damageWasted = this.combatDamageWasted;
      if (this.combatDamageTaken != null) combat.damageTaken = this.combatDamageTaken;
      if (this.combatDamageBlockedArmor != null) combat.damageBlockedArmor = this.combatDamageBlockedArmor;
      if (this.combatDamageDodged != null) combat.damageDodged = this.combatDamageDodged;
      if (this.combatSpecializationDualWield != null) combat.specializationDualWield = this.combatSpecializationDualWield;
      if (this.combatSpecializationGem != null) combat.specializationGem = this.combatSpecializationGem;
      this.db.finishFloorVisit(this.floorVisitId, playerHpEnd, playerMaxHpEnd, combat, extras);
    }
    this.floorVisitId = null;
    this.combatDamageDealt = null;
    this.combatDamageWasted = null;
    this.combatDamageTaken = null;
    this.combatDamageBlockedArmor = null;
    this.combatDamageDodged = null;
    this.combatSpecializationDualWield = null;
    this.combatSpecializationGem = null;
  }
}

export { collectWeaponRows, collectEnemyRows, weaponPipOutput };

// MetaProgressionManager.js — shared Support + village buildings.
// Death/win grant Support into one pool. Talents remain in the save for sim.

import { isMetaProgressionDisabled } from '../config/TestOptions.js';
import {
  TALENT_NODES,
  costForNextRank,
  getTalentNode,
  getPreviousTalentId,
  isBranchPurchasable,
  resolveTalentEffects,
  createStartingTalentArmor,
} from '../content/talents/index.js';
import {
  estimateBossesKilled as estimateBossesKilledFormula,
  xpForRun as xpForRunFormula,
} from '../content/economy/metaXp.js';
import { normalizeMonthIndex, nextMonthIndex } from '../content/months/index.js';
import {
  getVillageBuilding,
  costForVillageRank,
  emptyVillageBuildings,
  normalizeVillageBuildings,
  resolveVillageEffects,
  mergeVillageIntoTalentEffects,
} from '../content/village/index.js';

function emptyCharacterProgress() {
  return { xp: 0, talents: {}, choices: {} };
}

/** Shared Support. Root `xp` wins; otherwise merge per-hero leftovers. */
export function migrateSharedXp(data, characters) {
  if (data && Number.isFinite(Number(data.xp))) {
    return Math.max(0, Math.floor(Number(data.xp)));
  }
  const rogue = Math.max(0, Number(characters?.rogue?.xp) || 0);
  const warrior = Math.max(0, Number(characters?.warrior?.xp) || 0);
  // Old migrate copied the same metaPoints onto both heroes — do not double.
  if (rogue === warrior) return rogue;
  return rogue + warrior;
}

export class MetaProgressionManager {
  constructor(scene) {
    this.scene = scene;
    this.loadMetaProgression();
  }

  loadMetaProgression() {
    const saved = localStorage.getItem('metaProgression');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.totalDeaths = data.totalDeaths || 0;
        this.totalRuns = Number.isFinite(data.totalRuns) ? data.totalRuns : 0;
        this.bestFloor = data.bestFloor || 1;
        this.enemyKillStats = data.enemyKillStats || {};
        this.pendingEgg = data.pendingEgg || false;
        this.nextCalendarMonthIndex = normalizeMonthIndex(
          data.nextCalendarMonthIndex ?? 0
        );
        this.characters = this.migrateCharacters(data);
        this.xp = migrateSharedXp(data, this.characters);
        this.syncSharedXpToCharacters();
        this.buildings = normalizeVillageBuildings(data.buildings);
        // Legacy fields kept empty so old UI paths don't crash.
        this.unlockedRelics = [];
        this.veteranHp = 0;
        this.metaPoints = 0;
        return;
      } catch (e) {
        console.warn('Failed to parse metaProgression:', e);
      }
    }
    this.characters = {
      rogue: emptyCharacterProgress(),
      warrior: emptyCharacterProgress(),
    };
    this.buildings = emptyVillageBuildings();
    this.xp = 0;
    this.totalDeaths = 0;
    this.totalRuns = 0;
    this.bestFloor = 1;
    this.enemyKillStats = {};
    this.pendingEgg = false;
    this.nextCalendarMonthIndex = 0;
    this.unlockedRelics = [];
    this.veteranHp = 0;
    this.metaPoints = 0;
  }

  migrateCharacters(data) {
    const out = {
      rogue: emptyCharacterProgress(),
      warrior: emptyCharacterProgress(),
    };
    if (data.characters && typeof data.characters === 'object') {
      for (const id of ['rogue', 'warrior']) {
        const src = data.characters[id] || {};
        out[id] = {
          xp: Math.max(0, Number(src.xp) || 0),
          talents: src.talents && typeof src.talents === 'object' ? { ...src.talents } : {},
          choices: src.choices && typeof src.choices === 'object' ? { ...src.choices } : {},
        };
      }
      return out;
    }
    // One-time: old shared metaPoints become starting XP for both heroes.
    const legacy = Math.max(0, Number(data.metaPoints) || 0);
    if (legacy > 0) {
      out.rogue.xp = legacy;
      out.warrior.xp = legacy;
    }
    return out;
  }

  saveMetaProgression() {
    this.syncSharedXpToCharacters();
    const data = {
      xp: Math.max(0, Math.floor(Number(this.xp) || 0)),
      characters: this.characters,
      buildings: normalizeVillageBuildings(this.buildings),
      totalDeaths: this.totalDeaths,
      totalRuns: this.totalRuns,
      bestFloor: this.bestFloor,
      enemyKillStats: this.enemyKillStats,
      pendingEgg: this.pendingEgg,
      nextCalendarMonthIndex: normalizeMonthIndex(this.nextCalendarMonthIndex ?? 0),
      // Cleared legacy keys so old readers don't assume active relics.
      unlockedRelics: [],
      veteranHp: 0,
      metaPoints: 0,
    };
    localStorage.setItem('metaProgression', JSON.stringify(data));
  }

  setPendingEgg(hasEgg) {
    this.pendingEgg = Boolean(hasEgg);
    this.saveMetaProgression();
  }

  /** Month index the next new run should open on (rotation of active months). */
  getNextCalendarMonthIndex() {
    return normalizeMonthIndex(this.nextCalendarMonthIndex ?? 0);
  }

  setNextCalendarMonthIndex(index) {
    this.nextCalendarMonthIndex = normalizeMonthIndex(index);
    this.saveMetaProgression();
  }

  /** After a run ends in `monthIndex`, queue the following month for the next run. */
  advanceCalendarMonthAfterRun(monthIndex) {
    this.setNextCalendarMonthIndex(nextMonthIndex(monthIndex));
  }

  consumePendingEgg() {
    if (!this.pendingEgg) return false;
    this.pendingEgg = false;
    this.saveMetaProgression();
    return true;
  }

  ensureCharacter(characterId) {
    const id = characterId === 'warrior' ? 'warrior' : 'rogue';
    if (!this.characters[id]) this.characters[id] = emptyCharacterProgress();
    if (!this.characters[id].talents) this.characters[id].talents = {};
    if (!this.characters[id].choices) this.characters[id].choices = {};
    return this.characters[id];
  }

  getCharacterProgress(characterId) {
    return this.ensureCharacter(characterId);
  }

  getTalentRank(characterId, talentId) {
    return Math.max(0, Number(this.ensureCharacter(characterId).talents[talentId]) || 0);
  }

  syncSharedXpToCharacters() {
    const xp = Math.max(0, Math.floor(Number(this.xp) || 0));
    this.xp = xp;
    this.ensureCharacter('rogue').xp = xp;
    this.ensureCharacter('warrior').xp = xp;
  }

  getCharacterXp(_characterId) {
    return Math.max(0, Math.floor(Number(this.xp) || 0));
  }

  getBuildingRank(buildingId) {
    const buildings = this.buildings || emptyVillageBuildings();
    return Math.max(0, Number(buildings[buildingId]) || 0);
  }

  canUpgradeBuilding(characterId, buildingId) {
    const def = getVillageBuilding(buildingId);
    if (!def) return { ok: false, reason: 'invalid' };
    if (!this.buildings) this.buildings = emptyVillageBuildings();
    const rank = this.getBuildingRank(buildingId);
    if (rank >= def.maxRank) return { ok: false, reason: 'max' };
    const cost = costForVillageRank(rank);
    if (cost == null) return { ok: false, reason: 'max' };
    if (this.getCharacterXp() < cost) {
      return { ok: false, reason: 'support', cost };
    }
    return { ok: true, cost, nextRank: rank + 1 };
  }

  /** Spend shared Support on a village building. */
  upgradeBuilding(_characterId, buildingId) {
    const check = this.canUpgradeBuilding(_characterId, buildingId);
    if (!check.ok) return check;
    this.xp = this.getCharacterXp() - check.cost;
    this.buildings[buildingId] = check.nextRank;
    this.saveMetaProgression();
    return { ok: true, rank: check.nextRank, xpLeft: this.xp };
  }

  applyVillageEffects(gameState, applyStartingBonuses = false) {
    if (!gameState) return;
    const fx = resolveVillageEffects(this.buildings, gameState.characterId || 'rogue');
    gameState.villageEffects = fx;
    gameState.talentEffects = mergeVillageIntoTalentEffects(
      gameState.talentEffects || {},
      fx,
    );
    // HP is baked into maxHealth at run start and saved with the run.
    // Continue must not add it again.
    if (applyStartingBonuses && fx.villageMaxHp > 0 && !gameState._villageMaxHpApplied) {
      gameState.maxHealth += fx.villageMaxHp;
      gameState.playerHealth += fx.villageMaxHp;
      gameState._villageMaxHpApplied = true;
    }
  }

  /** Same formula as legacy meta points. */
  /** Test build only: hand a character XP from the talent screen. */
  grantDebugXp(_characterId, amount = 25) {
    this.xp = this.getCharacterXp() + amount;
    this.saveMetaProgression();
    return this.xp;
  }

  xpForRun(floor, bossesKilled = 0) {
    return xpForRunFormula(floor, bossesKilled);
  }

  // Back-compat alias for sim / old callers.
  metaPointsForRun(floor, bossesKilled = 0) {
    return this.xpForRun(floor, bossesKilled);
  }

  estimateBossesKilled(floor) {
    return estimateBossesKilledFormula(floor);
  }

  /**
   * Grant XP for a finished run. Returns { xpGained, totalXp, characterId }.
   * No relics are unlocked.
   */
  grantRunXp(characterId, floor, bossesKilled = null) {
    const bosses = bossesKilled == null ? this.estimateBossesKilled(floor) : bossesKilled;
    const xpGained = this.xpForRun(floor, bosses);
    this.xp = this.getCharacterXp() + xpGained;
    if (floor > this.bestFloor) this.bestFloor = floor;
    this.saveMetaProgression();
    return { xpGained, totalXp: this.xp, characterId };
  }

  /**
   * End-of-run bookkeeping on death. XP only — no relic / veteranHp / talents.
   * Returns xp result for defeat UI.
   */
  handlePlayerDeath(killedBy, floor, characterId = 'rogue') {
    this.totalDeaths++;
    this.enemyKillStats[killedBy] = (this.enemyKillStats[killedBy] || 0) + 1;
    return this.grantRunXp(characterId, floor);
  }

  canPurchaseTalent(characterId, talentId) {
    if (isMetaProgressionDisabled()) return { ok: false, reason: 'disabled' };
    const node = getTalentNode(talentId);
    if (!node || node.characterId !== characterId) return { ok: false, reason: 'invalid' };
    if (node.wip || !isBranchPurchasable(characterId, node.branchId)) {
      return { ok: false, reason: 'wip' };
    }
    const ch = this.ensureCharacter(characterId);
    const prevId = getPreviousTalentId(characterId, talentId);
    if (prevId) {
      // Two ranks, not one: with five ranks per node a single-rank gate would
      // let the player walk the whole branch buying only rank 1s, which is the
      // cheapest path and also the least interesting one. Two makes every
      // purchase a real choice between deepening and broadening.
      const prevRank = Math.max(0, Number(ch.talents[prevId]) || 0);
      if (prevRank < 2) return { ok: false, reason: 'prereq', prereqId: prevId };
    }
    const rank = Math.max(0, Number(ch.talents[talentId]) || 0);
    if (rank >= (node.maxRank || 1)) return { ok: false, reason: 'max' };
    const cost = costForNextRank(rank);
    if (cost == null) return { ok: false, reason: 'max' };
    if (this.getCharacterXp() < cost) return { ok: false, reason: 'xp' };
    return { ok: true, cost, nextRank: rank + 1 };
  }

  /** Spend XP to raise a talent by one rank. */
  purchaseTalent(characterId, talentId) {
    const node = getTalentNode(talentId);
    if (!node) return { ok: false, reason: 'invalid' };

    const check = this.canPurchaseTalent(characterId, talentId);
    if (!check.ok) return check;

    const ch = this.ensureCharacter(characterId);
    this.xp = this.getCharacterXp() - check.cost;
    ch.talents[talentId] = check.nextRank;
    this.saveMetaProgression();
    return { ok: true, rank: check.nextRank, xpLeft: this.xp };
  }

  /** Apply permanent talents at run start. Relics are no longer applied.
   *  opts.armorerArmorType — run-start pick for Armorer's Start. */
  applyTalentEffects(gameState, applyStartingBonuses = true, opts = {}) {
    gameState.relicEffects = {};
    gameState.talentEffects = resolveTalentEffects('rogue', {}, {});
    if (!isMetaProgressionDisabled()) {
      const characterId = gameState.characterId || 'rogue';
      const ch = this.ensureCharacter(characterId);
      const runChoices = { ...ch.choices };
      if (opts.armorerArmorType === 'chain' || opts.armorerArmorType === 'plate') {
        runChoices.runArmorerArmorType = opts.armorerArmorType;
      }
      // Depth accumulators have to be rebuilt as the run goes deeper, so keep the
      // inputs on the run state — GameState refreshes from them on floor change.
      gameState.talentSource = { characterId, talents: { ...ch.talents }, choices: runChoices };
      const effects = resolveTalentEffects(characterId, ch.talents, runChoices, {
        floorsCleared: Math.max(0, (gameState.currentFloor || 1) - 1),
      });
      gameState.talentEffects = effects;
    }
    this.applyVillageEffects(gameState, applyStartingBonuses);

    if (applyStartingBonuses && gameState.talentEffects?.armorerArmorType && !gameState.equippedArmor) {
      gameState.equippedArmor = createStartingTalentArmor(
        gameState.talentEffects.armorerArmorType,
        gameState.talentEffects,
      );
    }
  }

  // Back-compat: former relic apply path now only wires talents.
  applyRelicEffects(gameState, applyStartingBonuses = true, opts = {}) {
    this.applyTalentEffects(gameState, applyStartingBonuses, opts);
  }

  getUnlockedRelics() {
    return [];
  }

  hasRelic() {
    return false;
  }

  unlockRelic() {
    // no-op — relics removed from meta
  }

  getRelicDefinitions() {
    return {};
  }

  resetProgression() {
    this.characters = {
      rogue: emptyCharacterProgress(),
      warrior: emptyCharacterProgress(),
    };
    this.buildings = emptyVillageBuildings();
    this.xp = 0;
    this.totalDeaths = 0;
    this.totalRuns = 0;
    this.bestFloor = 1;
    this.enemyKillStats = {};
    this.pendingEgg = false;
    this.unlockedRelics = [];
    this.veteranHp = 0;
    this.metaPoints = 0;
    this.saveMetaProgression();
  }
}

export { TALENT_NODES };

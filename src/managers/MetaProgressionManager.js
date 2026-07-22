// MetaProgressionManager.js — per-character XP + permanent talents.
// Death/win grant character XP only (no relic unlocks).

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

function emptyCharacterProgress() {
  return { xp: 0, talents: {}, choices: {} };
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
        this.characters = this.migrateCharacters(data);
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
    this.totalDeaths = 0;
    this.totalRuns = 0;
    this.bestFloor = 1;
    this.enemyKillStats = {};
    this.pendingEgg = false;
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
    const data = {
      characters: this.characters,
      totalDeaths: this.totalDeaths,
      totalRuns: this.totalRuns,
      bestFloor: this.bestFloor,
      enemyKillStats: this.enemyKillStats,
      pendingEgg: this.pendingEgg,
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

  getCharacterXp(characterId) {
    return this.ensureCharacter(characterId).xp;
  }

  /** Same formula as legacy meta points. */
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
    if (isMetaProgressionDisabled()) {
      return { xpGained: 0, totalXp: this.getCharacterXp(characterId), characterId };
    }
    const bosses = bossesKilled == null ? this.estimateBossesKilled(floor) : bossesKilled;
    const xpGained = this.xpForRun(floor, bosses);
    const ch = this.ensureCharacter(characterId);
    ch.xp += xpGained;
    if (floor > this.bestFloor) this.bestFloor = floor;
    this.saveMetaProgression();
    return { xpGained, totalXp: ch.xp, characterId };
  }

  /**
   * End-of-run bookkeeping on death. XP only — no relic / veteranHp.
   * Returns xp result (or null when meta disabled) for defeat UI.
   */
  handlePlayerDeath(killedBy, floor, characterId = 'rogue') {
    if (isMetaProgressionDisabled()) return null;

    this.totalDeaths++;
    this.enemyKillStats[killedBy] = (this.enemyKillStats[killedBy] || 0) + 1;
    const result = this.grantRunXp(characterId, floor);
    return result;
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
      const prevRank = Math.max(0, Number(ch.talents[prevId]) || 0);
      if (prevRank < 1) return { ok: false, reason: 'prereq', prereqId: prevId };
    }
    const rank = Math.max(0, Number(ch.talents[talentId]) || 0);
    if (rank >= (node.maxRank || 1)) return { ok: false, reason: 'max' };
    const cost = costForNextRank(rank);
    if (cost == null) return { ok: false, reason: 'max' };
    if (ch.xp < cost) return { ok: false, reason: 'xp' };
    return { ok: true, cost, nextRank: rank + 1 };
  }

  /** Spend XP to raise a talent by one rank. */
  purchaseTalent(characterId, talentId) {
    const node = getTalentNode(talentId);
    if (!node) return { ok: false, reason: 'invalid' };

    const check = this.canPurchaseTalent(characterId, talentId);
    if (!check.ok) return check;

    const ch = this.ensureCharacter(characterId);
    ch.xp -= check.cost;
    ch.talents[talentId] = check.nextRank;
    this.saveMetaProgression();
    return { ok: true, rank: check.nextRank, xpLeft: ch.xp };
  }

  /** Apply permanent talents at run start. Relics are no longer applied.
   *  opts.armorerArmorType — run-start pick for Armorer's Start. */
  applyTalentEffects(gameState, applyStartingBonuses = true, opts = {}) {
    gameState.relicEffects = {};
    gameState.talentEffects = resolveTalentEffects('rogue', {}, {});
    if (isMetaProgressionDisabled()) return;

    const characterId = gameState.characterId || 'rogue';
    const ch = this.ensureCharacter(characterId);
    const runChoices = { ...ch.choices };
    if (opts.armorerArmorType === 'chain' || opts.armorerArmorType === 'plate') {
      runChoices.runArmorerArmorType = opts.armorerArmorType;
    }
    const effects = resolveTalentEffects(characterId, ch.talents, runChoices);
    gameState.talentEffects = effects;

    if (applyStartingBonuses && effects.armorerArmorType && !gameState.equippedArmor) {
      gameState.equippedArmor = createStartingTalentArmor(effects.armorerArmorType, effects);
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

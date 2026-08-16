// sim/balance-sim.js
// Headless Monte-Carlo balance simulator.
//
// Reuses the REAL combat code (CardSystem.spawnFloorCards / revealCard /
// attackEnemy, GameState.takeDamage, AmuletManager modifiers) via a mock
// scene, and reimplements only the turn loop, a bot policy, and the
// station-room economy. Run with:  node sim/balance-sim.js  [runs]
//
// NOTE on fidelity:
//  - Combat resolution (damage as printed, melee frontline gating, weapon
//    durability, enemy attack vs armor) is the REAL game code.
//  - Floor composition (card counts, enemy/loot mix, roles) is REAL
//    (spawnFloorCards).
//  - Station rooms (shop/treasure/rest/anvil) use approximate economy models
//    documented inline — refine these as needed.
//  - Baseline carries NO meta relics and buys NO amulets.
//  - Use --seed=N for reproducible batches; --no-lookahead is an ablation
//    switch for measuring the survival planner against the same configuration.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { MockScene } from './mock.js'; // also installs globalThis.Phaser + localStorage
import { GameState } from '../src/systems/GameState.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { CardDataGenerator } from '../src/systems/loot/CardDataGenerator.js';
import { AmuletManager } from '../src/managers/AmuletManager.js';
import { MetaProgressionManager } from '../src/managers/MetaProgressionManager.js';
import { MapGenerator } from '../src/map/MapGenerator.js';
import {
  newLootStats, recordBoard, recordWeapon, recordFloorSnapshot,
  recordFloorInventoryStart, recordFloorInventoryEnd, recordCombatEnemySnapshot,
  sumCarriedWeaponPips,
  recordRunBonuses,
  reportLootStats, lootStatsToJson,
} from './loot-stats.js';
import { StatsDatabase, DEFAULT_DB_PATH } from './db/stats-db.js';
import { StatsRecorder } from './stats-recorder.js';
import {
  areAmuletsDisabled,
  isMetaProgressionDisabled,
  clearSimTestOptionsOverride,
  setSimTestOptionsOverride,
  TEST_OPTION_IDS,
} from '../src/config/TestOptions.js';
import {
  SIM_META_MODES,
  splitSimArgv,
  parseSimFlags,
  applySimFlags,
  formatSimFlagsLabel,
  buildSimRunExtras,
  normalizeSimPools,
  simFlagsUsage,
  actStartWeaponRarity,
  actStartAmuletCount,
  sampleAmuletIds,
} from './parse-sim-flags.js';
import { getDefaultAmuletIds } from './sim-catalog.js';
import { getBehaviorProfile, getBehaviorPresetNames } from './behavior-knobs.js';
import {
  chooseWeaponPreservingAttack,
  effectiveExpendableWeaponPips,
  weaponMergeCapitalUnits,
} from './weapon-preservation.js';
import { killEfficiencyAdjustment } from './attack-priority.js';
import {
  applyPermanentWeaponDamageBonuses,
  applyKeenEdgeFirstStrike,
  buildStartingWeaponCards,
  getCharacter,
  normalizeCharacterId,
  rollClassWeaponCrit,
} from '../src/content/characters/CharacterClasses.js';
import { applyArmorTalentMods, getBranchesForCharacter, getTalentNode } from '../src/content/talents/index.js';
import {
  createWeaponCardData,
  createArmorCardData,
  getMagic,
  weaponDurability,
} from '../src/content/cards/index.js';
import {
  shopItemBuyPrice,
  shopItemSellPrice,
} from '../src/content/economy/shop.js';

// ── Config ────────────────────────────────────────────────────────────────
const RUNS = parseInt(process.argv[2], 10) || 2000;
const MAX_FLOOR = 45;
const BOSS_FLOORS = new Set([15, 30, 45]);
const BOSS_PREP_FLOORS = new Set([12, 13, 14, 27, 28, 29, 42, 43, 44]);
const IMMEDIATE_PRE_BOSS_FLOORS = new Set([14, 29, 44]);
const BOSS_PREP_MAGIC_TYPES = new Set(['frostRing', 'boneWall', 'restoration']);
const DEFAULT_BEHAVIOR_PRESET = parseBehaviorPresetArg(process.argv);
const DEFAULT_CHARACTER_ID = parseCharacterArg(process.argv);
const SURVIVAL_LOOKAHEAD_ENABLED = !process.argv.includes('--no-lookahead');
const MERGE_FIRST_PLANNER_ENABLED = !process.argv.includes('--no-merge-first');
const SUMMARY_JSON_PATH = (() => {
  const token = process.argv.find((arg) => arg.startsWith('--summary-json='));
  return token ? token.slice('--summary-json='.length) : null;
})();
let LAST_REPORTED_METRICS = null;
const SIM_SEED = (() => {
  const token = process.argv.find((arg) => arg.startsWith('--seed='));
  const value = token ? Number.parseInt(token.slice('--seed='.length), 10) : NaN;
  return Number.isFinite(value) ? value >>> 0 : null;
})();
let CURRENT_BEHAVIOR = getBehaviorProfile('balanced');

if (SIM_SEED !== null) {
  let seedState = SIM_SEED;
  Math.random = () => {
    seedState = (seedState + 0x6D2B79F5) >>> 0;
    let t = seedState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Room-type mix for non-boss floors (approximates the map generator's feel).
function roomTypeForFloor(floor) {
  if (BOSS_FLOORS.has(floor)) return 'BOSS';
  if (floor === 1) return 'COMBAT';
  if (floor % 5 === 0) return 'REST';
  if (floor % 5 === 3) return 'SHOP';
  if (floor % 6 === 2) return 'ANVIL'; // blacksmith — repair durability
  if (floor % 7 === 0) return 'TREASURE';
  if (Math.random() < 0.18) return 'ELITE';
  return 'COMBAT';
}

const COMBAT_ROOMS = new Set(['COMBAT', 'ELITE', 'BOSS']);

function parseBehaviorPresetArg(argv = process.argv) {
  const eq = argv.find((arg) => arg.startsWith('--behavior='));
  if (eq) return eq.split('=')[1] || 'balanced';
  const idx = argv.indexOf('--behavior');
  if (idx >= 0 && argv[idx + 1] && !argv[idx + 1].startsWith('--')) return argv[idx + 1];
  return 'balanced';
}

function parseCharacterArg(argv = process.argv) {
  const eq = argv.find((arg) => arg.startsWith('--character='));
  if (eq) return normalizeCharacterId(eq.split('=')[1] || 'rogue');
  const idx = argv.indexOf('--character');
  if (idx >= 0 && argv[idx + 1] && !argv[idx + 1].startsWith('--')) {
    return normalizeCharacterId(argv[idx + 1]);
  }
  return 'rogue';
}

function stripBehaviorArgs(argv) {
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--behavior') {
      if (argv[i + 1] && !argv[i + 1].startsWith('--')) i++;
      continue;
    }
    if (arg.startsWith('--behavior=')) continue;
    out.push(arg);
  }
  return out;
}

/** Printed hit damage including class passives. Planner uses expected crit EV. */
function simWeaponHitDamage(gs, weapon, wasExhausted, {
  expectedCrit = false,
  applyFirstBlood = false,
  applyKeenEdge = false,
} = {}) {
  let dmg = weapon ? (weapon.damage || 1) : 1;
  if (wasExhausted) dmg = Math.ceil(dmg * 0.8);
  dmg = applyPermanentWeaponDamageBonuses(gs?.characterId, weapon, dmg, gs?.talentEffects);

  // Keen Edge: first dagger/bow attack each floor (mutates gs when applied).
  if (applyKeenEdge) {
    dmg = applyKeenEdgeFirstStrike(gs?.characterId, weapon, dmg, gs?.talentEffects, gs).damage;
  }

  if (applyFirstBlood && gs?.talentEffects?.firstBloodPct > 0 && !gs.firstAttackThisFloorUsed) {
    dmg = Math.ceil(dmg * (1 + gs.talentEffects.firstBloodPct));
  }

  const def = getCharacter(gs?.characterId);
  const canCrit = weapon
    && (def.critChance || 0) > 0
    && (def.critWeaponTypes || []).includes(weapon.weaponType);
  if (!canCrit) return dmg;

  const printed = Math.max(0, Number(weapon.damage) || 0);
  const tier = ({ common: 1, uncommon: 2, rare: 3, epic: 3, legendary: 4 })[weapon.rarity] || 1;
  let critDmg = Math.ceil(printed * (1 + 0.05 * tier));
  if (wasExhausted) critDmg = Math.ceil(critDmg * 0.8);

  if (expectedCrit) {
    return dmg * (1 - def.critChance) + critDmg * def.critChance;
  }

  const crit = rollClassWeaponCrit(gs.characterId, weapon, dmg);
  return crit.crit ? critDmg : dmg;
}

function simOffhandDamage(gs, offhand, wasExhausted) {
  // Twin Fang is applied inside simWeaponHitDamage for all dagger hits.
  return simWeaponHitDamage(gs, offhand, wasExhausted);
}

function applyAssassinateSim(mock, gs, enemyIndex) {
  const threshold = gs?.talentEffects?.assassinateThreshold || 0;
  if (threshold <= 0) return 0;
  const card = mock.cardSystem.boardCards[enemyIndex];
  if (!card?.revealed || !card.data) return 0;
  if (card.data.type !== 'enemy' && card.data.type !== 'boss') return 0;
  const hp = card.data.health ?? 0;
  if (hp <= 0 || hp > threshold) return 0;
  mock.cardSystem.attackEnemy(enemyIndex, hp, false, null, true);
  return hp;
}

function applyFrontVolleySim(mock, gs, primaryIndex, bowDamage, weapon) {
  const pct = gs?.talentEffects?.frontVolleyPct || 0;
  if (pct <= 0 || !weapon) return 0;
  if (!mock.cardSystem.isRangedWeapon?.(weapon)) return 0;
  const board = mock.cardSystem.boardCards || [];
  const candidates = [];
  for (let i = 0; i < board.length; i++) {
    if (i === primaryIndex) continue;
    const card = board[i];
    if (!card?.revealed || !card.data) continue;
    if (card.data.type !== 'enemy' && card.data.type !== 'boss') continue;
    if ((card.data.health ?? 0) <= 0) continue;
    if (card.data.role !== 'MELEE') continue;
    candidates.push(i);
  }
  if (!candidates.length) return 0;
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  const volleyDmg = Math.max(1, Math.ceil(bowDamage * pct));
  mock.cardSystem.attackEnemy(target, volleyDmg, false, weapon, true);
  applyAssassinateSim(mock, gs, target);
  return volleyDmg;
}

function cloneCard(card) {
  return card ? { ...card } : null;
}

class SimInventorySystem {
  constructor(gs) {
    this.gameState = gs;
    this.slots = new Array(5 + Math.max(0, gs.bonusInventorySlots || 0)).fill(null);
    this.slotSprites = [];
    this.discardArea = null;
  }

  getCurrentWeapon() {
    return this.gameState?.equippedWeapon || null;
  }

  syncGameStateInventory() {
    if (this.gameState) this.gameState.inventory = this.slots;
  }

  expandInventory(n = 0) {
    if (n <= 0) return;
    this.gameState.bonusInventorySlots = (this.gameState.bonusInventorySlots || 0) + n;
    for (let i = 0; i < n; i++) this.slots.push(null);
    this.syncGameStateInventory();
  }

  addInventorySlots(n = 0) {
    this.expandInventory(n);
  }

  rebuildInventorySprites() {}

  updateTwinkleEffects() {}

  addCard(card) {
    const idx = this.slots.findIndex((slot) => slot == null);
    if (idx < 0) return false;
    this.slots[idx] = card;
    this.syncGameStateInventory();
    return true;
  }

  addCardDirect(card, idx) {
    if (idx < 0 || idx >= this.slots.length) return false;
    this.slots[idx] = card;
    this.syncGameStateInventory();
    return true;
  }

  removeCard(idx) {
    if (idx < 0 || idx >= this.slots.length) return;
    this.slots[idx] = null;
    this.syncGameStateInventory();
  }
}

// ── One game ────────────────────────────────────────────────────────────
function setupRun() {
  const mock = new MockScene();
  const gs = new GameState(mock);
  mock.gameState = gs;
  mock.amuletManager = new AmuletManager(mock);
  mock.cardSystem = new CardSystem(mock);
  mock.inventorySystem = new SimInventorySystem(gs);
  mock.inventorySystem.syncGameStateInventory();
  return { mock, gs };
}

/** Limit drop/shop amulet RNG to the experiment pool. */
function applyAmuletPool(mock, poolIds) {
  if (!poolIds) return;
  const allow = new Set(poolIds);
  const gen = mock.cardSystem?.cardDataGenerator;
  if (gen?.amuletTypes) {
    gen.amuletTypes = gen.amuletTypes.filter((a) => allow.has(a.id));
  }
  const orig = mock.amuletManager.addAmulet.bind(mock.amuletManager);
  mock.amuletManager.addAmulet = (id, opts = {}) => {
    if (!allow.has(id) && !opts.force) return false;
    return orig(id, opts);
  };
}

/** Restrict MetaProgressionManager definitions so accumulate unlocks stay in-pool. */
function restrictMetaPool(meta, poolIds) {
  if (!poolIds) return meta;
  const allow = new Set(poolIds);
  const orig = meta.getRelicDefinitions.bind(meta);
  meta.getRelicDefinitions = () => {
    const all = orig();
    return Object.fromEntries(Object.entries(all).filter(([id]) => allow.has(id)));
  };
  return meta;
}

function startingInventory(inv, characterId = 'rogue', { rarity } = {}) {
  // Mirrors InventorySystem.addStartingCards — class refs → catalog cards.
  const start = buildStartingWeaponCards(characterId, { rarity });
  for (let i = 0; i < start.length && i < inv.length; i++) inv[i] = cloneCard(start[i]);
}

function invItems(inv) {
  return (inv || []).filter(Boolean);
}

function firstEmptySlot(inv) {
  return inv.findIndex((slot) => slot == null);
}

function countInventoryItems(inv) {
  return invItems(inv).length;
}

function syncInventoryState(gs, inv) {
  gs.inventory = inv;
  if (gs.scene?.inventorySystem) gs.scene.inventorySystem.slots = inv;
}

// Leather is dodge-only (protection 0); score expected damage avoided + flat DEF.
const armorScore = (a) => {
  if (!a || !(a.durability > 0)) return -1;
  return (a.protection || 0) + (a.dodgeChance || 0) * 20;
};

function inventoryCapacity(gs) {
  return 5 + Math.max(0, gs.bonusInventorySlots || 0);
}

function reservedEventSlots(gs) {
  const story = gs._simStory;
  return story?.reserveRewardSlot ? 1 : 0;
}

function carriedCount(gs, inv) {
  return countInventoryItems(inv);
}

function isBossPrepCard(card) {
  return card?.type === 'potion'
    || (card?.type === 'magic' && BOSS_PREP_MAGIC_TYPES.has(card.magicType));
}

function bossPrepItems(inv) {
  return invItems(inv).filter(isBossPrepCard);
}

function isBossPrepObjectiveActive(gs) {
  return BOSS_PREP_FLOORS.has(gs?.currentFloor);
}

function hasUsableBow(gs, inv) {
  return [gs?.equippedWeapon, ...invItems(inv)].some((card) => (
    card?.type === 'weapon'
    && card.weaponType === 'bow'
    && (card.durability || 0) > 0
  ));
}

function bestUsableBowDamage(gs, inv) {
  return [gs?.equippedWeapon, ...invItems(inv)].reduce((best, card) => (
    card?.type === 'weapon'
    && card.weaponType === 'bow'
    && (card.durability || 0) > 0
      ? Math.max(best, card.damage || 0)
      : best
  ), -1);
}

function uniqueUsableWeapons(gs, inv) {
  const seen = new Set();
  return [gs?.equippedWeapon, ...invItems(inv)]
    .filter((card) => {
      if (card?.type !== 'weapon' || (card.durability || 0) <= 0 || seen.has(card)) return false;
      seen.add(card);
      return true;
    });
}

function totalUsableWeaponPips(gs, inv) {
  return uniqueUsableWeapons(gs, inv)
    .reduce((sum, weapon) => sum + Math.max(0, weapon.durability || 0), 0);
}

function usableDaggers(gs, inv) {
  return uniqueUsableWeapons(gs, inv)
    .filter((weapon) => weapon.weaponType === 'dagger');
}

function hasDaggerPair(gs, inv) {
  return usableDaggers(gs, inv).length >= 2;
}

function hasDaggerPartner(weapon, gs, inv) {
  return weapon?.weaponType === 'dagger'
    && usableDaggers(gs, inv).some((dagger) => dagger !== weapon);
}

function effectiveWeaponPipsForList(weapons) {
  return effectiveExpendableWeaponPips(weapons);
}

function effectiveWeaponReservePips(gs, inv, { exclude = null, include = null } = {}) {
  const weapons = uniqueUsableWeapons(gs, inv).filter((weapon) => weapon !== exclude);
  if (
    include?.type === 'weapon'
    && (include.durability || 0) > 0
    && include !== exclude
    && !weapons.includes(include)
  ) {
    weapons.push(include);
  }
  return effectiveWeaponPipsForList(weapons);
}

function isUsefulDaggerPickup(gs, inv, dagger) {
  if (dagger?.type !== 'weapon' || dagger.weaponType !== 'dagger') return false;
  if ((gs.currentFloor || 1) >= 31) {
    const hasLateWeapon = uniqueUsableWeapons(gs, inv).some((weapon) => (
      weapon.weaponType === 'axe' || weapon.weaponType === 'sword'
    ));
    return !hasLateWeapon
      && effectiveWeaponReservePips(gs, inv) < Math.ceil(weaponPipReserveTarget(gs.currentFloor) / 2);
  }
  const current = usableDaggers(gs, inv);
  if (current.length < 2) return true;
  if (effectiveWeaponReservePips(gs, inv) < weaponPipReserveTarget(gs.currentFloor || 1)) return true;
  if (current.some((held) => held.rarity === dagger.rarity)) return true;
  const weakest = current
    .slice()
    .sort((a, b) => (a.damage || 0) - (b.damage || 0) || (a.durability || 0) - (b.durability || 0))[0];
  return (dagger.damage || 0) > (weakest?.damage || 0);
}

function weaponPipReserveTarget(floor) {
  // A boss-ready loadout needs more than one fresh weapon. In particular,
  // common act-1 bows only deal 2 damage through the Giant Skeleton's armor,
  // so the old 12-pip target could never cover a realistic boss damage budget.
  // These targets normally occupy about three inventory slots, leaving room
  // for a potion/defensive spell and a gem or armor card.
  if (floor <= 15) return 17;
  if (floor <= 30) return 20;
  return 22;
}

function bestUsableBow(gs, inv) {
  return uniqueUsableWeapons(gs, inv)
    .filter((weapon) => weapon.weaponType === 'bow')
    .sort((a, b) => (
      (b.damage || 0) - (a.damage || 0)
      || (b.durability || 0) - (a.durability || 0)
      || (b.gemCount || 0) - (a.gemCount || 0)
    ))[0] || null;
}

function expectedGemBossDamagePerHit(gs, weapon) {
  if (!weapon?.gemEffect) return 0;
  const stack = CardDataGenerator.weaponGemStack(weapon);
  if (weapon.gemEffect === 'poison') {
    const tick = gs.scene?.amuletManager?.modifyPoisonGemTickDamage?.(1) ?? 1;
    return stack * tick * 3;
  }
  if (weapon.gemEffect === 'fire' || weapon.gemEffect === 'lightning') {
    let damage = [3, 4, 5, 6, 7][stack - 1] || 3;
    damage = gs.scene?.amuletManager?.modifyGemDamage?.(damage, weapon.gemEffect) ?? damage;
    return damage;
  }
  return 0;
}

function expectedWeaponBossDamagePerHit(gs, weapon, boss) {
  if (!weapon || !boss) return 0;
  let direct = simWeaponHitDamage(gs, weapon, false, { expectedCrit: true });
  direct = gs.scene?.amuletManager?.modifyWeaponDamage?.(direct) ?? direct;
  direct += gs.relicEffects?.weaponDamageBonus || 0;
  direct = Math.max(1, direct - Math.max(0, boss.armor || 0));
  const evade = Math.max(
    0,
    Math.min(1, boss.abilities?.find((ability) => ability.type === 'evade')?.chance || 0),
  );
  return (direct + expectedGemBossDamagePerHit(gs, weapon)) * (1 - evade);
}

function bossWeaponReadiness(gs, inv, boss) {
  const weapons = uniqueUsableWeapons(gs, inv);
  const capacityFor = (weapon) => (
    expectedWeaponBossDamagePerHit(gs, weapon, boss) * Math.max(0, weapon.durability || 0)
  );
  const bow = bestUsableBow(gs, inv);
  const daggers = weapons
    .filter((weapon) => weapon.weaponType === 'dagger')
    .sort((a, b) => (
      expectedWeaponBossDamagePerHit(gs, b, boss) - expectedWeaponBossDamagePerHit(gs, a, boss)
    ));
  const daggerPair = daggers.length >= 2 ? daggers.slice(0, 2) : [];
  let totalCapacity = weapons.reduce((sum, weapon) => sum + capacityFor(weapon), 0);
  let daggerPairCapacity = 0;
  if (daggerPair.length === 2) {
    const [stronger, other] = daggerPair;
    const strongerHit = expectedWeaponBossDamagePerHit(gs, stronger, boss);
    const otherHit = expectedWeaponBossDamagePerHit(gs, other, boss);
    const totalPips = Math.max(0, stronger.durability || 0) + Math.max(0, other.durability || 0);
    // With smart primary switching, every pip except the final one receives
    // both dagger hits; preserve the stronger blade for the last single hit.
    daggerPairCapacity = Math.max(0, totalPips - 1) * (strongerHit + otherHit) + strongerHit;
    totalCapacity += daggerPairCapacity - capacityFor(stronger) - capacityFor(other);
  }
  return {
    bow,
    bowPips: bow?.durability || 0,
    bowSockets: bow?.gemEffect ? CardDataGenerator.weaponGemStack(bow) : 0,
    bowCapacity: bow ? capacityFor(bow) : 0,
    daggerPair,
    daggerPairPips: daggerPair.reduce((sum, dagger) => sum + Math.max(0, dagger.durability || 0), 0),
    daggerPairDamage: daggerPair.reduce((sum, dagger) => sum + Math.max(0, dagger.damage || 0), 0),
    daggerPairCapacity,
    totalCapacity,
    enoughCapacity: totalCapacity >= Math.max(0, boss?.health || 0),
  };
}

function isUsefulBowUpgrade(gs, inv, weapon) {
  if (weapon?.type !== 'weapon' || weapon.weaponType !== 'bow') return false;
  const current = bestUsableBowDamage(gs, inv);
  return current < 0 || (weapon.damage || 0) > current;
}

function cardKeepScore(card, behavior = CURRENT_BEHAVIOR, gs = null) {
  const k = behavior.keepScore;
  if (!card) return -Infinity;
  if (card.id === 'monsterEgg') return k.monsterEgg;
  if (card.type === 'companion') return k.companion;
  if (card.type === 'amuletPickup') return k.amuletPickup;
  if (card.type === 'magic') {
    const base = k.magicByType[card.magicType] ?? k.magicBase;
    if (!isBossPrepObjectiveActive(gs)) return base;
    return isBossPrepCard(card)
      ? base + (k.bossPrepTargetBonus || 0)
      : (k.bossPrepOtherMagicScore ?? base);
  }
  if (card.type === 'gem') return k.gemBase + (k.gemByEffect[card.gemEffect] ?? 0);
  if (card.type === 'weapon') {
    const bowUtility = card.weaponType === 'bow' ? (k.bowUtilityBonus || 0) : 0;
    return k.weaponBase + bowUtility
      + (card.damage || 0) * k.weaponDamageWeight
      + (card.gemEffect ? k.weaponGemBonus : 0);
  }
  if (card.type === 'armor') {
    return k.armorBase
      + (card.protection || 0) * k.armorProtectionWeight
      + (card.dodgeChance || 0) * 20 * k.armorProtectionWeight;
  }
  if (card.type === 'thorns') return k.thornsBase + (card.thornDamage || 0) * k.thornsDamageWeight;
  if (card.type === 'potion') {
    const prepBonus = isBossPrepObjectiveActive(gs) ? (k.bossPrepTargetBonus || 0) : 0;
    return k.potionBase + (card.healAmount || 0) * k.potionHealWeight + prepBonus;
  }
  if (card.type === 'key') return k.key;
  return k.default;
}

function mergeFamilyKey(card) {
  if (!card) return null;
  if (card.type === 'weapon') return `weapon:${card.weaponType || card.name || 'unknown'}`;
  if (card.type === 'armor') return `armor:${card.armorType || card.name || 'unknown'}`;
  if (card.type === 'thorns') return 'thorns';
  if (card.type === 'potion') return 'potion:healing';
  return null;
}

function mergeProjection(cards, familyKey) {
  const counts = new Array(RARITY_ORDER.length).fill(0);
  for (const card of cards || []) {
    if (mergeFamilyKey(card) !== familyKey) continue;
    const tier = RARITY_ORDER.indexOf(card.rarity || 'common');
    if (tier >= 0) counts[tier]++;
  }
  let merges = 0;
  for (let tier = 0; tier < counts.length - 1; tier++) {
    const pairs = Math.floor(counts[tier] / 2);
    counts[tier] %= 2;
    counts[tier + 1] += pairs;
    merges += pairs;
  }
  let highestTier = -1;
  for (let tier = counts.length - 1; tier >= 0; tier--) {
    if (counts[tier] > 0) {
      highestTier = tier;
      break;
    }
  }
  return {
    counts,
    highestTier,
    merges,
    finalCards: counts.reduce((sum, count) => sum + count, 0),
  };
}

function revealedMergeMaterials(board, familyKey) {
  return (board || [])
    .filter((entry) => (
      entry?.revealed
      && entry.data
      && entry.data.type !== 'enemy'
      && entry.data.type !== 'boss'
      && mergeFamilyKey(entry.data) === familyKey
    ))
    .map((entry) => entry.data);
}

function mergeOpportunity(card, gs, inv, visibleBoard = null) {
  if (!MERGE_FIRST_PLANNER_ENABLED) return { bonus: 0, tierGain: 0, extraMerges: 0 };
  const familyKey = mergeFamilyKey(card);
  if (!familyKey) return { bonus: 0, tierGain: 0, extraMerges: 0 };

  const held = invItems(inv);
  if (gs?.equippedArmor && !held.includes(gs.equippedArmor)) held.push(gs.equippedArmor);
  if (gs?.equippedWeapon && !held.includes(gs.equippedWeapon)) held.push(gs.equippedWeapon);

  const visible = revealedMergeMaterials(visibleBoard, familyKey);
  if (!held.includes(card) && !visible.includes(card)) visible.push(card);

  const before = mergeProjection(held, familyKey);
  const after = mergeProjection([...held, ...visible], familyKey);
  const tierGain = Math.max(0, after.highestTier - before.highestTier);
  const extraMerges = Math.max(0, after.merges - before.merges);
  if (extraMerges <= 0) return { bonus: 0, tierGain: 0, extraMerges: 0 };

  // Tier advancement is the main objective. Extra merges still matter because
  // they refresh pips and compress the inventory even when a higher tier is
  // already carried in the same family.
  return {
    bonus: tierGain * 760 + extraMerges * 190,
    tierGain,
    extraMerges,
  };
}

function strategicInventoryScore(card, gs, inv, { incoming = false, visibleBoard = null } = {}) {
  let score = cardKeepScore(card, CURRENT_BEHAVIOR, gs);
  if (!gs) return score;

  score += mergeOpportunity(card, gs, inv, visibleBoard).bonus;
  if (card?.type !== 'weapon') return score;
  if (card.weaponType === 'dagger') {
    const daggers = usableDaggers(gs, inv);
    const partners = daggers.filter((dagger) => dagger !== card);
    // The first dagger is ordinary; the second unlocks a free off-hand hit
    // and should be valued as a build component, not as low-damage clutter.
    if (
      (gs.currentFloor || 1) < 31
      && ((incoming && partners.length >= 1) || (!incoming && daggers.length === 2))
    ) {
      score += 420;
    }
  }
  const reserve = weaponPipReserveTarget(gs.currentFloor || 1);
  const pipsAfterChoice = effectiveWeaponReservePips(gs, inv, incoming
    ? { include: card }
    : { exclude: card });
  if (pipsAfterChoice < reserve) {
    score += MERGE_FIRST_PLANNER_ENABLED
      ? (reserve - pipsAfterChoice) * 260
      : 10000;
  }
  if (MERGE_FIRST_PLANNER_ENABLED && !incoming) {
    const remainingWeapons = uniqueUsableWeapons(gs, inv).filter((weapon) => weapon !== card);
    // Merge-first is aggressive, but never trade down to a single weapon or
    // throw away the only bow that can shoot through a boss's summons.
    if (remainingWeapons.length < 2) score += 3200;
    if (
      card.weaponType === 'bow'
      && !remainingWeapons.some((weapon) => weapon.weaponType === 'bow')
    ) {
      score += 2600;
    }
  }
  return score;
}

function shouldDisposeDaggerFor(gs, inv, incoming, { eventReward = false } = {}) {
  if (!incoming || usableDaggers(gs, inv).length === 0) return false;
  if (incoming.type === 'companion') return true;
  if (incoming.type !== 'weapon') return false;
  if (incoming.weaponType !== 'axe' && incoming.weaponType !== 'sword') return false;
  if ((gs.currentFloor || 1) >= 31) return true;
  const strongestDagger = usableDaggers(gs, inv)
    .reduce((best, dagger) => Math.max(best, dagger.damage || 0), 0);
  return eventReward && (incoming.damage || 0) >= strongestDagger + 3;
}

function bestEventWeapon(gs, inv) {
  const weapons = uniqueUsableWeapons(gs, inv);
  return weapons
    .filter((card) => (
      card.weaponType === 'sword'
      || card.weaponType === 'bow'
      || (card.weaponType === 'dagger' && hasDaggerPartner(card, gs, inv))
    ))
    .sort((a, b) => {
      const value = (weapon) => (
        (weapon.damage || 0)
        + (weapon.weaponType === 'dagger'
          ? (findOffhandDagger(weapon, gs, inv)?.damage || 0)
          : 0)
      );
      return value(b) - value(a);
    })[0] || null;
}

function hasUsableWeaponDurability(gs, inv) {
  return [gs.equippedWeapon, ...inv].some((item) => (
    item?.type === 'weapon' && (item.durability ?? 0) > 0
  ));
}

function hasCombatStalemate(board, gs, inv) {
  const enemiesRemain = (board || []).some((card) => (
    card?.revealed
    && (card.data?.type === 'enemy' || card.data?.type === 'boss')
    && (card.data?.health ?? 0) > 0
  ));
  if (!enemiesRemain) return false;
  if ((board || []).some((card) => card && card.data?.type !== 'enemy' && card.data?.type !== 'boss')) {
    return false;
  }
  if (hasUsableWeaponDurability(gs, inv)) return false;
  return !inv.some((card) => card?.type === 'magic');
}

function computeRunEndReason(gs, inv, { won, dead, lastEncounterType, stalemateDeath }) {
  if (won) return 'win';
  if (!dead) return null;
  if (stalemateDeath || (
    COMBAT_ROOMS.has(lastEncounterType)
    && !hasUsableWeaponDurability(gs, inv)
    && !inv.some((card) => card?.type === 'magic')
  )) {
    return 'weapon';
  }
  return 'hp';
}

// Real inventory pressure matters most at events. Keep one empty slot when the
// story is about to offer an egg, then discard the least valuable carried card
// only when the incoming event reward is better.

// Rarity-first amulet offer: score all three options for the current
// class/build, then try the strongest takeable choice first.
// Floor/shop never equip cursed; boss may.
const AMULET_CHOICE_BASE_SCORE = Object.freeze({
  lostNobleDiadem: 1200,
  philosophersStone: 900,
  vampireFang: 760,
  legendaryWhetstone: 700,
  newDragonClaw: 680,
  amuletOfGreaterProtection: 620,
  ringOfGreaterRegeneration: 580,
  amuletOfGreaterEvasion: 550,
  ringOfGreaterHealth: 520,
  glovesOfHermitWizard: 500,
  maskOfHollowWhispers: 440,
  earringOfGreaterWeaponDurability: 430,
  alchemistBag: 410,
  earringOfGreaterArmorDurability: 390,
  runeOfPoison: 370,
  runeOfZap: 350,
  runeOfFire: 330,
  pouchOfGreed: 300,
  monocle: 280,
  amuletOfProtection: 270,
  ringOfRegeneration: 260,
  amuletOfEvasion: 245,
  ringOfHealth: 235,
  earringOfWeaponDurability: 225,
  earringOfArmorDurability: 205,
});

function amuletChoiceScore(mock, pick) {
  if (!pick?.id) return -Infinity;
  const gs = mock.gameState;
  const inv = mock._simInventory || [];
  const def = mock.amuletManager?.amuletDefinitions?.[pick.id] || {};
  const floor = Math.max(1, Number(gs.currentFloor) || 1);
  const hpPct = gs.maxHealth > 0 ? gs.playerHealth / gs.maxHealth : 1;
  let score = AMULET_CHOICE_BASE_SCORE[pick.id] || 100;

  if (pick.group === 'survival') {
    score += (1 - hpPct) * 180;
    if (BOSS_PREP_FLOORS.has(floor) || BOSS_FLOORS.has(floor)) score += 70;
  }
  if (pick.group === 'utility') score += Math.max(0, 22 - floor) * 4;
  if (pick.group === 'offense' && gs.characterId === 'rogue') score += 35;
  if (def.armorDurabilitySaveChance) {
    score += gs.characterId === 'warrior' ? 90 : 20;
    if (!gs.equippedArmor) score -= 100;
  }
  if (def.weaponDurabilitySaveChance && hasUsableBow(gs, inv)) score += 70;

  const weapons = [gs.equippedWeapon, ...invItems(inv)]
    .filter((card) => card?.type === 'weapon');
  const gemEffects = new Set(weapons.map((weapon) => weapon.gemEffect).filter(Boolean));
  if (def.fireGemDamageBonus) score += gemEffects.has('fire') ? 160 : 20;
  if (def.zapGemDamageBonus) score += gemEffects.has('lightning') ? 160 : 20;
  if (def.poisonGemTickBonus) score += gemEffects.has('poison') ? 180 : 30;
  if (def.allGemDamageBonus) score += gemEffects.size ? 220 : 60;
  if (def.modifyPotionHealing && invItems(inv).some((card) => card.type === 'potion')) score += 90;
  if (Array.isArray(def.replaces) && def.replaces.some((id) => mock.amuletManager.hasAmulet(id))) {
    score += 140;
  }
  return score;
}

function grantAmuletFromOffer(mock, offer, { allowCursed = false } = {}) {
  if (!offer || !mock?.amuletManager) return false;

  const tryPick = (pick) => {
    if (!pick?.id) return false;
    if (!allowCursed && (pick.rarity === 'cursed' || pick.cursed)) return false;
    const added = !!mock.amuletManager.addAmulet(pick.id);
    if (added && mock.gameState?._simMetrics) {
      const metrics = mock.gameState._simMetrics;
      metrics.amuletPicks++;
      metrics.amuletPicksById[pick.id] = (metrics.amuletPicksById[pick.id] || 0) + 1;
    }
    return added;
  };

  if (offer.pendingChoice && offer.options?.length) {
    const metrics = mock.gameState?._simMetrics;
    if (metrics) metrics.amuletOffers++;
    const order = offer.options
      .map((pick) => ({ pick, score: amuletChoiceScore(mock, pick) }))
      .sort((a, b) => b.score - a.score || String(a.pick.name).localeCompare(String(b.pick.name)));
    for (const { pick } of order) {
      if (tryPick(pick)) return true;
    }
    return false;
  }

  return tryPick(offer);
}

function tryCarry(gs, inv, card, { eventReward = false, visibleBoard = null } = {}) {
  if (!card) return false;
  const plannedMerge = mergeOpportunity(card, gs, inv, visibleBoard);
  if (
    card.type === 'weapon'
    && card.weaponType === 'dagger'
    && !isUsefulDaggerPickup(gs, inv, card)
    && plannedMerge.bonus <= 0
  ) {
    return false;
  }
  const grantCardRewardBonus = () => {
    if (card.type === 'coin' || card.type === 'crystal') return;
    const bonus = (gs.activeAmulets || []).reduce((sum, amulet) => (
      sum + (amulet?.id === 'fortuneCard' ? 1 : 0)
    ), 0);
    if (bonus <= 0) return;
    const floor = gs.currentFloor || 1;
    if (gs.fortuneCardRewardFloor === floor) return;
    gs.fortuneCardRewardFloor = floor;
    gs.crystals = (gs.crystals || 0) + bonus;
  };
  // A newly found matching dagger can merge directly into the more worn half
  // of an existing pair. This preserves the second blade and needs no
  // temporary empty slot, matching how a player drops loot onto a card.
  if (card.type === 'weapon' && card.weaponType === 'dagger') {
    const daggers = usableDaggers(gs, inv);
    const mergeTarget = daggers.length >= 2
      ? daggers
        .filter((dagger) => dagger.rarity === card.rarity)
        .sort((a, b) => (a.durability || 0) - (b.durability || 0))[0]
      : null;
    if (mergeTarget) {
      const merged = mergeWeapons(
        gs.scene?.cardSystem?.cardDataGenerator,
        mergeTarget,
        card,
        gs.currentFloor || 1,
      );
      const targetIndex = inv.indexOf(mergeTarget);
      if (targetIndex >= 0) inv[targetIndex] = merged;
      if (gs.equippedWeapon === mergeTarget) gs.equippedWeapon = merged;
      const tracker = gs._mergeTracker;
      if (tracker) {
        tracker.recordMerge('weapon', merged.rarity, gs.currentFloor || 1);
        tracker.mergeCounts.weapon++;
      }
      syncInventoryState(gs, inv);
      grantCardRewardBonus();
      return true;
    }
  }
  const reserve = eventReward ? 0 : reservedEventSlots(gs);
  if (carriedCount(gs, inv) < inventoryCapacity(gs) - reserve) {
    const slot = firstEmptySlot(inv);
    if (slot >= 0) inv[slot] = card;
    syncInventoryState(gs, inv);
    grantCardRewardBonus();
    return true;
  }
  if (shouldDisposeDaggerFor(gs, inv, card, { eventReward })) {
    const disposable = usableDaggers(gs, inv)
      .slice()
      .sort((a, b) => (
        (a.damage || 0) - (b.damage || 0)
        || (a.durability || 0) - (b.durability || 0)
      ))[0];
    const disposableIndex = inv.indexOf(disposable);
    if (disposableIndex >= 0) {
      inv[disposableIndex] = card;
      if (gs.equippedWeapon === disposable) gs.equippedWeapon = card.type === 'weapon' ? card : null;
      syncInventoryState(gs, inv);
      grantCardRewardBonus();
      return true;
    }
  }
  let lowestIndex = -1;
  let lowestScore = Infinity;
  for (let i = 0; i < inv.length; i++) {
    if (!inv[i]) continue;
    const score = strategicInventoryScore(inv[i], gs, inv, { visibleBoard });
    if (score < lowestScore) { lowestScore = score; lowestIndex = i; }
  }
  if (
    lowestIndex >= 0
    && strategicInventoryScore(card, gs, inv, { incoming: true, visibleBoard }) > lowestScore
  ) {
    inv[lowestIndex] = card;
    if (plannedMerge.bonus > 0 && gs._simMetrics?.mergeFirst) {
      gs._simMetrics.mergeFirst.cascadeReplacements++;
    }
    syncInventoryState(gs, inv);
    grantCardRewardBonus();
    return true;
  }
  return false;
}

// ── Merging (mirrors inventorySystem: same type+rarity → next rarity, refreshed
// durability, gems carried). Damage/durability pulled from the REAL tables. ──
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const nextRarity = (r) => RARITY_ORDER[Math.min(RARITY_ORDER.length - 1, RARITY_ORDER.indexOf(r) + 1)];
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

function mergeWeapons(gen, a, b, floor = 0) {
  const type = a.weaponType;
  const r = nextRarity(a.rarity);
  const merged = createWeaponCardData(type, r) || {
    type: 'weapon', name: `${cap(r)} ${cap(type)}`, weaponType: type,
    damage: (a.damage || 1) + 1, rarity: r,
    durability: weaponDurability(type, r), maxDurability: weaponDurability(type, r),
    range: a.range ?? 'melee', special: a.special ?? b.special ?? null,
    gemSlots: CardDataGenerator.gemSlotsForRarity(r),
  };
  const slots = merged.gemSlots || CardDataGenerator.gemSlotsForRarity(r);
  merged.gemSlots = slots;
  if (a.gemEffect && b.gemEffect && a.gemEffect === b.gemEffect) {
    merged.gemEffect = a.gemEffect;
    merged.gemName = a.gemName;
    merged.gemColor = a.gemColor;
    merged.gemCount = Math.min(slots, (a.gemCount || 1) + (b.gemCount || 1));
  } else {
    const g = a.gemEffect ? a : (b.gemEffect ? b : null);
    if (g) {
      merged.gemEffect = g.gemEffect;
      merged.gemCount = Math.min(slots, g.gemCount || 1);
      merged.gemName = g.gemName;
      merged.gemColor = g.gemColor;
    }
  }
  return merged;
}

function mergeArmor(gen, a, b, floor = 0) {
  const type = a.armorType || 'leather';
  const r = nextRarity(a.rarity);
  const merged = createArmorCardData(type, r) || {
    type: 'armor', name: `${cap(r)} ${cap(type)} Armor`, armorType: type,
    protection: (a.protection || 1) + 1, rarity: r,
    durability: CardDataGenerator.armorDurability(type, r),
    maxDurability: CardDataGenerator.armorDurability(type, r),
  };
  merged.reflection = a.reflection || 0;
  // Re-apply Iron talents — merge rebuilt from catalog and would otherwise
  // strip Hardened / Counter Drill / Bulwark.
  applyArmorTalentMods(merged, gsTalentEffectsRef.current);
  return merged;
}
// Mutable ref so mergeArmor (no gs arg historically) still sees run talents.
const gsTalentEffectsRef = { current: null };
function mergeArmorList(gen, list, echoChance = 0, tracker = null, floor = 0, talentEffects = null) {
  gsTalentEffectsRef.current = talentEffects || null;
  let changed = true, guard = 0;
  while (changed && guard++ < 60) {
    changed = false;
    outer:
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.armorType && a.armorType === b.armorType && a.rarity === b.rarity &&
            RARITY_ORDER.indexOf(a.rarity) < RARITY_ORDER.length - 1) {
          const m = mergeArmor(gen, a, b, floor);
          list.splice(j, 1); list.splice(i, 1); list.push(m);
          if (tracker) {
            tracker.recordMerge('armor', m.rarity, floor);
            tracker.mergeCounts.armor++;
          }
          // Webweaver's Thread: 10% chance one source armor respawns (refreshed durability)
          if (echoChance > 0 && Math.random() < echoChance) {
            const echo = Math.random() < 0.5 ? { ...a } : { ...b };
            echo.durability = echo.maxDurability;
            list.push(echo);
          }
          changed = true; break outer;
        }
      }
    }
  }
}

// Greedily merge every same-type/same-rarity weapon pair (cascades upward).
// echoChance: Webweaver's Thread relic — 10% chance one source card respawns after merge.
function mergeWeaponList(gen, list, echoChance = 0, tracker = null, floor = 0, gs = null) {
  let changed = true, guard = 0;
  while (changed && guard++ < 60) {
    changed = false;
    outer:
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.weaponType && a.weaponType === b.weaponType && a.rarity === b.rarity &&
            RARITY_ORDER.indexOf(a.rarity) < RARITY_ORDER.length - 1) {
          // Two daggers are a complete dual-wield build. Do not automatically
          // collapse the final pair into one upgraded dagger. With three or
          // more, merging two still leaves an off-hand blade.
          const usableDaggerCards = list.filter((weapon) => (
            weapon?.weaponType === 'dagger' && (weapon.durability || 0) > 0
          ));
          const refreshingLastLowPair = a.weaponType === 'dagger'
            && usableDaggerCards.length === 2
            && usableDaggerCards.every((dagger) => (dagger.durability || 0) <= 2);
          const visibleReplacementDagger = (gs?.scene?.cardSystem?.boardCards || []).some((entry) => (
            entry?.revealed
            && entry.data?.type === 'weapon'
            && entry.data.weaponType === 'dagger'
            && (entry.data.durability || 0) > 0
          ));
          const aggressivelyAdvanceDagger = MERGE_FIRST_PLANNER_ENABLED
            && usableDaggerCards.length === 2
            && visibleReplacementDagger;
          if (
            a.weaponType === 'dagger'
            && usableDaggerCards.length <= 2
            && !refreshingLastLowPair
            && !aggressivelyAdvanceDagger
          ) {
            continue;
          }
          const merged = mergeWeapons(gen, a, b, floor);
          list.splice(j, 1); list.splice(i, 1); list.push(merged);
          if (tracker) {
            tracker.recordMerge('weapon', merged.rarity, floor);
            tracker.mergeCounts.weapon++;
            if (refreshingLastLowPair) tracker.mergeCounts.daggerRefresh++;
          }
          if (
            aggressivelyAdvanceDagger
            && !refreshingLastLowPair
            && gs?._simMetrics?.mergeFirst
          ) {
            gs._simMetrics.mergeFirst.healthyDaggerPairMerges++;
          }
          // Webweaver's Thread: 10% chance one source card respawns (refreshed at its original rarity)
          if (echoChance > 0 && Math.random() < echoChance) {
            const echo = Math.random() < 0.5 ? { ...a } : { ...b };
            echo.durability = echo.maxDurability; // respawned fresh
            list.push(echo);
          }
          changed = true; break outer;
        }
      }
    }
  }
}

// Weapon desirability: prefer raw damage. Mild dagger bias only — dual-wield
// pairs are valuable and must stay in the bag.
function wpnValue(w) {
  if (!w || w.durability <= 0) return -1;
  return (w.damage || 0) + (w.gemEffect ? 1 : 0);
}

function findOffhandDagger(primary, gs, inv) {
  if (!primary || primary.special !== 'dualWield') return null;
  const pool = [gs.equippedWeapon, ...invItems(inv)];
  return pool
    .filter((w) => (
      w
      && w !== primary
      && w.special === 'dualWield'
      && (w.durability || 0) > 0
    ))
    .sort((a, b) => (
      wpnValue(b) - wpnValue(a)
      || (b.durability || 0) - (a.durability || 0)
    ))[0] || null;
}

// Thorns merging: two equal-damage thorns → stronger thorns with refreshed
// durability (mirrors inventorySystem merge for thorns). The bot "always
// carries and merges thorns," so we accumulate and fuse them.
function mergeThornsList(list, tracker = null) {
  let changed = true, guard = 0;
  while (changed && guard++ < 40) {
    changed = false;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if ((list[i].thornDamage || 0) === (list[j].thornDamage || 0)) {
          const a = list[i], b = list[j];
          const dmg = Math.max(a.thornDamage || 1, b.thornDamage || 1) + 2;
          const dur = Math.max(a.maxDurability || 3, b.maxDurability || 3) + 1;
          list.splice(j, 1); list.splice(i, 1);
          list.push({ type: 'thorns', name: 'Thorns Card', thornDamage: dmg, durability: dur, maxDurability: dur, rarity: nextRarity(a.rarity || 'common') });
          if (tracker) tracker.mergeCounts.thorns++;
          changed = true; break;
        }
      }
      if (changed) break;
    }
  }
}

// Potions follow the real canonical ladder (35 -> 70 -> 110 -> 200).
function mergePotionList(gen, list, tracker = null) {
  let changed = true, guard = 0;
  while (changed && guard++ < 40) {
    changed = false;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.rarity !== b.rarity || (a.healAmount || 0) !== (b.healAmount || 0)) continue;
        const upgraded = gen.getUpgradedPotion(a.healAmount || 0);
        if (!upgraded || (upgraded.healAmount || 0) <= (a.healAmount || 0)) continue;
        list.splice(j, 1);
        list.splice(i, 1);
        list.push(upgraded);
        if (tracker) tracker.mergeCounts.potion++;
        changed = true;
        break;
      }
      if (changed) break;
    }
  }
}

// Merge what we can, then equip the best weapon (dagger-averse), armor, and
// carry the strongest thorns card (passively reflects to melee attackers).
function regear(gen, gs, inv) {
  const tracker = gs._mergeTracker || null;
  void tracker; // used implicitly via mergeWeaponList/mergeArmorList args below
  // Live inventory removes equipment cards when they break. Purge spent
  // references before merging so destroyed cards cannot become fresh upgrades.
  for (let i = 0; i < inv.length; i++) {
    const item = inv[i];
    if (
      item
      && (item.type === 'weapon' || item.type === 'armor' || item.type === 'thorns')
      && (item.durability ?? 0) <= 0
    ) {
      inv[i] = null;
    }
  }
  const items = invItems(inv);
  const weapons = items.filter((c) => c.type === 'weapon');
  const armors = items.filter((c) => c.type === 'armor');
  const thorns = items.filter((c) => c.type === 'thorns');
  const potions = items.filter((c) => c.type === 'potion');
  const rest = items.filter((c) => (
    c.type !== 'weapon' && c.type !== 'armor' && c.type !== 'thorns' && c.type !== 'potion'
  ));
  if (gs.equippedArmor) armors.push(gs.equippedArmor);

  const echoChance = gs.relicEffects?.mergeRespawnChance || 0;
  mergeWeaponList(
    gen,
    weapons,
    echoChance,
    gs._mergeTracker || null,
    gs.currentFloor || 0,
    gs,
  );
  mergeArmorList(gen, armors, echoChance, gs._mergeTracker || null, gs.currentFloor || 0, gs.talentEffects);
  mergeThornsList(thorns, gs._mergeTracker || null);
  mergePotionList(gen, potions, gs._mergeTracker || null);

  weapons.sort((a, b) => wpnValue(b) - wpnValue(a));
  // Protect a strong weapon on its LAST pip: if the best weapon is at 1
  // durability and a backup with spare pips exists, wield the backup and keep
  // the strong (likely gemmed) weapon in reserve to repair/merge — never let
  // it break and vanish.
  let pickIdx = 0;
  if (weapons[0] && weapons[0].durability === 1) {
    const backup = weapons.findIndex((w, i) => i > 0 && w.durability > 1);
    if (backup >= 0) pickIdx = backup;
  } else if (!(weapons[0] && weapons[0].durability > 0)) {
    pickIdx = weapons.findIndex((w) => w.durability > 0);
    if (pickIdx < 0) pickIdx = 0;
  }
  const pickedWeapon = weapons[pickIdx] || null;
  gs.equippedWeapon = pickedWeapon && pickedWeapon.durability > 0 ? pickedWeapon : null;
  if (gs._superWeapon) gs.equippedWeapon = gs._superWeapon; // isolation test: never swap it out
  // Equip the best armor that still has durability (DEF + dodge EV).
  armors.sort((a, b) => armorScore(b) - armorScore(a));
  const usableArmor = armors.findIndex((a) => a.durability > 0);
  gs.equippedArmor = usableArmor >= 0 ? armors.splice(usableArmor, 1)[0] : (armors.shift() || null);
  // Carry the strongest thorns that still has durability.
  thorns.sort((a, b) => (b.thornDamage || 0) - (a.thornDamage || 0));
  const usableThorns = thorns.findIndex((t) => (t.durability ?? 0) > 0);
  gs.activeThorns = usableThorns >= 0 ? thorns[usableThorns] : null;

  const mergedInventory = [...weapons, ...armors, ...thorns, ...potions, ...rest];
  while (mergedInventory.length > inventoryCapacity(gs)) {
    let lowestIndex = -1;
    let lowestScore = Infinity;
    const heldWeapons = mergedInventory.filter((item) => (
      item?.type === 'weapon' && (item.durability || 0) > 0
    ));
    const heldDaggerCount = heldWeapons.filter((weapon) => weapon.weaponType === 'dagger').length;
    const reserveTarget = weaponPipReserveTarget(gs.currentFloor || 1);
    for (let i = 0; i < mergedInventory.length; i++) {
      const item = mergedInventory[i];
      let score = cardKeepScore(item, CURRENT_BEHAVIOR, gs);
      if (
        item?.weaponType === 'dagger'
        && heldDaggerCount === 2
        && (gs.currentFloor || 1) < 31
      ) {
        score += 420;
      }
      if (
        item?.type === 'weapon'
        && effectiveWeaponPipsForList(heldWeapons.filter((weapon) => weapon !== item)) < reserveTarget
      ) {
        score += 10000;
      }
      if (score < lowestScore) { lowestScore = score; lowestIndex = i; }
    }
    if (lowestIndex < 0) break;
    mergedInventory.splice(lowestIndex, 1);
  }
  inv.fill(null);
  for (let i = 0; i < Math.min(inv.length, mergedInventory.length); i++) inv[i] = mergedInventory[i];
  syncInventoryState(gs, inv);
}

function isMelee(w) { return !w || w.range !== 'ranged'; }

// Collect a freshly revealed non-enemy card: apply its effect, drop from board.
function usePotionCard(mock, gs, potion, force = false) {
  let heal = potion?.healAmount || 20;
  const missing = gs.maxHealth - gs.playerHealth;
  const t = CURRENT_BEHAVIOR.thresholds;
  if (missing <= 0) return false;
  if (
    !force
    && BOSS_PREP_FLOORS.has(gs.currentFloor)
    && gs.playerHealth > gs.maxHealth * t.bossPrepReserveEmergencyHpPct
  ) {
    return false;
  }
  if (!force && gs.playerHealth > gs.maxHealth * t.potionUseHpPct && missing < Math.ceil(heal * t.potionUseMissingHealPct)) return false;
  if (mock?.amuletManager) heal = mock.amuletManager.modifyPotionHealing(heal);
  gs.healCapped(heal);
  mock?.amuletManager?.processPotionUse?.();
  return true;
}

function useRestorationCard(mock, gs, card, force = false) {
  if (card?.type !== 'magic' || card.magicType !== 'restoration') return false;
  const missingHp = gs.maxHealth - gs.playerHealth;
  const missingAp = gs.maxActions - gs.actionsLeft;
  const t = CURRENT_BEHAVIOR.thresholds;
  if (
    !force
    && BOSS_PREP_FLOORS.has(gs.currentFloor)
    && gs.playerHealth > gs.maxHealth * t.bossPrepReserveEmergencyHpPct
  ) {
    return false;
  }
  if (!force && gs.playerHealth > gs.maxHealth * t.restorationSafeHpPct && gs.actionsLeft > 0 && missingAp < t.restorationMinMissingAp) return false;
  if (missingHp <= 0 && missingAp <= 0) return false;
  gs.playerHealth = gs.maxHealth;
  gs.actionsLeft = gs.maxActions;
  mock._restorationUses = (mock._restorationUses || 0) + 1;
  return true;
}

function gemFitsWeapon(weapon, gem) {
  if (!weapon || weapon.type !== 'weapon' || !gem || gem.type !== 'gem') return false;
  const count = weapon.gemEffect ? (weapon.gemCount || 1) : 0;
  const slots = CardDataGenerator.weaponGemSlots(weapon);
  return count < slots && (!weapon.gemEffect || weapon.gemEffect === gem.gemEffect);
}

function socketGemIntoWeapon(weapon, gem) {
  const count = weapon.gemEffect ? (weapon.gemCount || 1) : 0;
  const slots = CardDataGenerator.weaponGemSlots(weapon);
  if (count >= slots) return false;
  weapon.gemEffect = gem.gemEffect;
  weapon.gemName = gem.name;
  weapon.gemColor = gem.color;
  weapon.gemCount = count + 1;
  return true;
}

function bestGemTarget(gs, inv, gem) {
  const weapons = uniqueUsableWeapons(gs, inv)
    .filter((weapon) => gemFitsWeapon(weapon, gem));
  if (!weapons.length) return null;
  weapons.sort((a, b) => {
    const score = (weapon) => {
      const emptySocket = weapon.gemEffect ? 0 : 2;
      const bow = weapon.weaponType === 'bow';
      const bossPrepBow = bow && (
        isBossPrepObjectiveActive(gs) || BOSS_FLOORS.has(gs.currentFloor)
      ) ? 100 : 0;
      const dualWieldValue = hasDaggerPartner(weapon, gs, inv) ? 55 : 0;
      // Gems trigger once per swing, so remaining pips matter in addition to
      // printed weapon damage. This also prefers a healthy bow over one that
      // will break before its sockets can pay off.
      const triggerCapacity = Math.min(15, weapon.durability || 0) * 2;
      return wpnValue(weapon) * 10 + triggerCapacity + emptySocket + bossPrepBow + dualWieldValue;
    };
    return score(b) - score(a);
  });
  return weapons[0];
}

function trySocketGemNow(gs, inv, gem) {
  const target = bestGemTarget(gs, inv, gem);
  return target ? socketGemIntoWeapon(target, gem) : false;
}

function collectLoot(mock, gs, inv, idx, ctx = null) {
  const card = mock.cardSystem.boardCards[idx];
  if (!card || !card.data) return;
  const d = card.data;
  switch (d.type) {
    case 'coin':
      gs.coins += mock.amuletManager?.modifyGoldFound?.(d.amount || 0) ?? (d.amount || 0);
      break;
    case 'crystal':
      gs.crystals += mock.amuletManager?.modifyCrystalFound?.(d.amount || 0) ?? (d.amount || 0);
      break;
    case 'food': {
      const gain = mock.amuletManager?.modifyFoodAP?.(d.actionAmount || 0) ?? (d.actionAmount || 0);
      gs.actionsLeft = Math.min(gs.maxActions, gs.actionsLeft + gain);
      mock.scheduleEnemyTurn();
      break;
    }
    case 'potion':
      tryCarry(gs, inv, d, { visibleBoard: mock.cardSystem.boardCards });
      break; // Board pickup is free; drinking it later is a separate action.
    case 'trap':
      gs.takeDamage(d.damage || d.attack || 5, -1, 'trap');
      if (gs.playerHealth <= 0) mock._lastKiller = 'trap';
      break;
    case 'weapon':
      tryCarry(gs, inv, d, { visibleBoard: mock.cardSystem.boardCards });
      break;
    case 'armor': tryCarry(gs, inv, d, { visibleBoard: mock.cardSystem.boardCards }); break;
    case 'key': tryCarry(gs, inv, d, { visibleBoard: mock.cardSystem.boardCards }); break;
    case 'gem':
      if (
        trySocketGemNow(gs, inv, d)
        || tryCarry(gs, inv, d, { visibleBoard: mock.cardSystem.boardCards })
      ) {
        mock._gemsSeen = (mock._gemsSeen || 0) + 1;
        (mock._gemFloors || (mock._gemFloors = [])).push(gs.currentFloor);
        socketGems(gs, inv, ctx || computeContext(mock.cardSystem.boardCards || [], gs.currentFloor || 1));
      }
      break; // socket immediately when possible; otherwise keep for later
    case 'thorns':
      tryCarry(gs, inv, d, { visibleBoard: mock.cardSystem.boardCards });
      break; // always carried + merged
    case 'amulet': // rarity offer → pick 1 of options (skip cursed on floor)
      grantAmuletFromOffer(mock, d, { allowCursed: false });
      break;
    case 'magic':
      tryCarry(gs, inv, d, { visibleBoard: mock.cardSystem.boardCards });
      break;
    default: break; // empty/key — nothing
  }
  mock.cardSystem.removeCard(idx);
}

function visibleLootPriority(card, gs) {
  if (isBossPrepObjectiveActive(gs) && isBossPrepCard(card?.data)) return -1;
  const type = card?.data?.type;
  if (isBossPrepObjectiveActive(gs) && type === 'magic') {
    return CURRENT_BEHAVIOR.visibleLootPriority.default + 10;
  }
  return CURRENT_BEHAVIOR.visibleLootPriority[type] ?? CURRENT_BEHAVIOR.visibleLootPriority.default;
}

function wouldCarryVisibleCard(gs, inv, data, visibleBoard = null) {
  if (!data) return false;
  const reserve = reservedEventSlots(gs);
  if (carriedCount(gs, inv) < inventoryCapacity(gs) - reserve) return true;
  const incoming = strategicInventoryScore(data, gs, inv, { incoming: true, visibleBoard });
  const lowest = invItems(inv).reduce(
    (score, item) => Math.min(
      score,
      strategicInventoryScore(item, gs, inv, { visibleBoard }),
    ),
    Infinity,
  );
  return incoming > lowest;
}

function shouldTakeVisibleLootNow(gs, inv, card, mode, visibleBoard = null) {
  const data = card?.data;
  if (!data || data.type === 'trap') return false;
  if (mode === 'all') return data.type !== 'empty' && data.type !== 'key';
  if (mode === 'prep') return isBossPrepCard(data);
  if (data.type === 'coin' || data.type === 'crystal') return true;
  if (data.type === 'food') {
    const gain = gs.scene?.amuletManager?.modifyFoodAP?.(data.actionAmount || 0)
      ?? (data.actionAmount || 0);
    const incoming = estimateImmediateEnemyPhaseDamage(
      gs.scene?.cardSystem?.boardCards || [],
      gs,
    );
    return gain > 0
      && gs.actionsLeft < gs.maxActions
      && gs.playerHealth - incoming > 0;
  }
  if (data.type === 'amulet' || data.type === 'amuletPickup') return true;
  if (data.type === 'gem') return Boolean(bestGemTarget(gs, inv, data) || firstEmptySlot(inv) >= 0);
  if (data.type === 'potion' || data.type === 'magic') {
    return wouldCarryVisibleCard(gs, inv, data, visibleBoard);
  }
  if (data.type === 'weapon' || data.type === 'armor' || data.type === 'thorns') {
    return wouldCarryVisibleCard(gs, inv, data, visibleBoard);
  }
  return false;
}

function maybeConsumePotionForMergeSpace(mock, gs, inv, board, mode) {
  if (!MERGE_FIRST_PLANNER_ENABLED || mode === 'prep') return false;
  if (carriedCount(gs, inv) < inventoryCapacity(gs) - reservedEventSlots(gs)) return false;
  if (gs.playerHealth >= gs.maxHealth) return false;
  if ((board || []).some((entry) => (
    entry?.data
    && (entry.data.type === 'enemy' || entry.data.type === 'boss')
    && (entry.data.health || 0) > 0
  ))) {
    return false;
  }

  const candidates = (board || [])
    .filter((entry) => (
      entry?.revealed
      && entry.data
      && entry.data.type !== 'enemy'
      && entry.data.type !== 'boss'
    ))
    .map((entry) => ({
      card: entry.data,
      opportunity: mergeOpportunity(entry.data, gs, inv, board),
    }))
    .filter(({ opportunity }) => (
      opportunity.tierGain > 0 || opportunity.extraMerges >= 2
    ))
    .sort((a, b) => b.opportunity.bonus - a.opportunity.bonus);
  if (!candidates.length) return false;

  const potionEntries = inv
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card?.type === 'potion')
    .sort((a, b) => (a.card.healAmount || 0) - (b.card.healAmount || 0));
  if (!potionEntries.length) return false;

  const hpPct = gs.maxHealth > 0 ? gs.playerHealth / gs.maxHealth : 1;
  if (
    isBossPrepObjectiveActive(gs)
    && bossPrepItems(inv).length <= 1
    && hpPct > CURRENT_BEHAVIOR.thresholds.bossPrepReserveEmergencyHpPct
  ) {
    return false;
  }

  const pick = potionEntries[0];
  const hpBefore = gs.playerHealth;
  mock.useAction();
  if (!usePotionCard(mock, gs, pick.card, true)) {
    mock.resolvePendingEnemyTurn();
    return false;
  }
  removeInventoryCard(gs, inv, pick.index);
  if (gs._simMetrics?.mergeFirst) gs._simMetrics.mergeFirst.spacePotions++;
  traceCombat(
    gs,
    `drink ${pick.card.name || 'potion'} for merge space; `
      + `HP ${Math.ceil(hpBefore)}→${Math.ceil(gs.playerHealth)}, AP ${gs.actionsLeft}`,
  );
  mock.resolvePendingEnemyTurn();
  return true;
}

function traceCombat(gs, message) {
  if (!Array.isArray(gs?._combatTrace)) return;
  gs._combatTrace.push(message);
  if (gs._combatTrace.length > 12) gs._combatTrace.shift();
}

function collectVisibleLootSmart(mock, gs, inv, floor, mode = 'all') {
  const board = mock.cardSystem.boardCards || [];
  let collected = false;
  let guard = 0;
  while (guard++ < 40) {
    if (maybeConsumePotionForMergeSpace(mock, gs, inv, board, mode)) {
      collected = true;
      continue;
    }
    const ctx = computeContext(board, floor);
    const visible = board
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => card?.revealed && card.data?.type !== 'enemy' && card.data?.type !== 'boss')
      .filter(({ card }) => shouldTakeVisibleLootNow(gs, inv, card, mode, board))
      .map((entry) => ({
        ...entry,
        mergePlan: mergeOpportunity(entry.card.data, gs, inv, board),
      }))
      .sort((a, b) => {
        const aPrep = isBossPrepObjectiveActive(gs) && isBossPrepCard(a.card.data);
        const bPrep = isBossPrepObjectiveActive(gs) && isBossPrepCard(b.card.data);
        if (aPrep !== bPrep) return aPrep ? -1 : 1;
        if (a.mergePlan.bonus !== b.mergePlan.bonus) {
          return b.mergePlan.bonus - a.mergePlan.bonus;
        }
        return visibleLootPriority(a.card, gs) - visibleLootPriority(b.card, gs);
      });
    if (!visible.length) break;
    const collectedType = visible[0].card.data?.type || 'unknown';
    const collectedName = visible[0].card.data?.name || collectedType;
    if (visible[0].mergePlan.bonus > 0 && gs._simMetrics?.mergeFirst) {
      gs._simMetrics.mergeFirst.plannedPickups++;
    }
    collectLoot(mock, gs, inv, visible[0].index, ctx);
    traceCombat(
      gs,
      `loot ${collectedName} (${collectedType}); HP ${Math.ceil(gs.playerHealth)}, AP ${gs.actionsLeft}`,
    );
    if (mode === 'combat' && gs._simMetrics?.combatLoot) {
      gs._simMetrics.combatLoot.pickups++;
      gs._simMetrics.combatLoot.byType[collectedType] =
        (gs._simMetrics.combatLoot.byType[collectedType] || 0) + 1;
    }
    // Most pickups are free, while board food explicitly wakes enemies.
    mock.resolvePendingEnemyTurn();
    socketGems(gs, inv, ctx);
    maybeHeal(mock, gs, inv);
    regear(mock.cardSystem.cardDataGenerator, gs, inv);
    collected = true;
    if (gs.playerHealth <= 0) break;
  }
  return collected;
}

function removeInventoryCard(gs, inv, idx) {
  if (idx < 0 || idx >= inv.length) return;
  inv[idx] = null;
  syncInventoryState(gs, inv);
}

function maybeReturnMagicToInventory(mock, gs, inv, card) {
  if (!card || !mock.amuletManager?.shouldReturnMagicCard?.()) return;
  tryCarry(gs, inv, { ...card });
}

function castMagicCard(mock, gs, inv, slotIndex, board, floor) {
  const magicCard = inv[slotIndex];
  if (!magicCard || magicCard.type !== 'magic') return false;
  const hpBefore = gs.playerHealth;
  const apBefore = gs.actionsLeft;
  const revealedEnemies = board
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card?.revealed && (card.data?.type === 'enemy' || card.data?.type === 'boss') && card.data.health > 0);
  const nonBossEnemies = revealedEnemies.filter(({ card }) => card.data?.type !== 'boss');
  let used = false;

  switch (magicCard.magicType) {
    case 'restoration':
      mock.useAction();
      used = useRestorationCard(mock, gs, magicCard, true);
      break;
    case 'fireball': {
      const target = revealedEnemies
        .slice()
        .sort((a, b) => (b.card.data.attack || 0) - (a.card.data.attack || 0) || (a.card.data.health || 0) - (b.card.data.health || 0))[0];
      if (target) {
        mock.useAction();
        mock.cardSystem.attackEnemy(target.index, magicCard.damage || 15);
        used = true;
      }
      break;
    }
    case 'soulDrain': {
      const target = nonBossEnemies
        .slice()
        .sort((a, b) => (b.card.data.attack || 0) - (a.card.data.attack || 0) || (b.card.data.health || 0) - (a.card.data.health || 0))[0];
      if (target) {
        target.card.data.health = 0;
        let healAmount = getMagic('soulDrain')?.healAmount ?? 30;
        if (mock.amuletManager) healAmount = mock.amuletManager.modifySpellHealing(healAmount);
        gs.playerHealth = Math.min(gs.maxHealth, gs.playerHealth + healAmount);
        mock.cardSystem.removeDefeatedEnemy(target.index, target.card);
        mock.useAction();
        used = true;
      }
      break;
    }
    case 'frostRing': {
      if (revealedEnemies.length) {
        for (const { card } of revealedEnemies) {
          card.data.frozen = 3;
          mock.cardSystem.attachFrozenFrame?.(card);
        }
        mock.useAction();
        used = true;
      }
      break;
    }
    case 'weakness': {
      if (revealedEnemies.length) {
        for (const { card } of revealedEnemies) card.data.attack = Math.ceil((card.data.attack || 0) * 0.7);
        mock.useAction();
        used = true;
      }
      break;
    }
    case 'shadowBlade':
      if (!gs.shadowBlade || (gs.shadowBlade.turns || 0) <= CURRENT_BEHAVIOR.thresholds.shadowBladeMinTurns) {
        gs.shadowBlade = { turns: 10, multiplier: 1.5 };
        mock.useAction();
        used = true;
      }
      break;
    case 'boneWall':
      if ((gs.boneWall || 0) <= 0) {
        gs.boneWall = 2;
        mock.useAction();
        used = true;
      }
      break;
    case 'magicShield':
      if (!gs.magicShield || (gs.magicShield.turns || 0) <= 0) {
        gs.magicShield = { turns: 10, multiplier: 1.2 };
        mock.useAction();
        used = true;
      }
      break;
    case 'smokeScreen': {
      // Headless: flip face-up non-boss enemies face-down. No pointer rebinding —
      // mock sprites aren't Phaser Input objects, and runCombat re-reveals via
      // revealCard which already works on makeGameObject stubs.
      const revealable = nonBossEnemies.filter(({ card }) => card.revealed);
      if (revealable.length) {
        for (const { card } of revealable) {
          card.revealed = false;
          card.sprite?.setTexture?.('cardBack');
          if (card.roleMarker) { card.roleMarker.destroy(); card.roleMarker = null; }
          if (card.poisonMarker) { card.poisonMarker.destroy(); card.poisonMarker = null; }
          if (card.shockMarker) { card.shockMarker.destroy(); card.shockMarker = null; }
          if (card.infoText) {
            if (card.infoText.list) card.infoText.destroy(true);
            else card.infoText.destroy();
            card.infoText = null;
          }
        }
        mock.useAction();
        used = true;
      }
      break;
    }
    default:
      break;
  }

  if (!used) return false;
  traceCombat(
    gs,
    `cast ${magicCard.name || magicCard.magicType}; HP ${Math.ceil(hpBefore)}→${Math.ceil(gs.playerHealth)}, AP ${apBefore}→${gs.actionsLeft}`,
  );
  removeInventoryCard(gs, inv, slotIndex);
  maybeReturnMagicToInventory(mock, gs, inv, magicCard);
  return true;
}

function scoreMagicUse(mock, gs, inv, board, slotIndex, floor) {
  const magicCard = inv[slotIndex];
  if (!magicCard || magicCard.type !== 'magic') return -Infinity;
  const t = CURRENT_BEHAVIOR.thresholds;
  const base = CURRENT_BEHAVIOR.magicPriority[magicCard.magicType] ?? CURRENT_BEHAVIOR.keepScore.magicBase;
  const revealedEnemies = board.filter((card) => card?.revealed && (card.data?.type === 'enemy' || card.data?.type === 'boss') && card.data.health > 0);
  const nonBossEnemies = revealedEnemies.filter((card) => card.data?.type !== 'boss');
  const hpPct = gs.maxHealth > 0 ? gs.playerHealth / gs.maxHealth : 1;
  const immediateIncoming = estimateImmediateEnemyPhaseDamage(board, gs);
  const reservingLastBossPrep = BOSS_PREP_FLOORS.has(floor)
    && isBossPrepCard(magicCard)
    && bossPrepItems(inv).length <= 1
    && hpPct > t.bossPrepReserveEmergencyHpPct
    && immediateIncoming < gs.playerHealth
    && immediateIncoming < gs.maxHealth * 0.22;
  if (reservingLastBossPrep) return -Infinity;

  // Frost Ring and Bone Wall are scarce boss openers, not routine tempo cards.
  // Keep the last copy through ordinary safe fights no matter how early it was
  // found. Spend it only when the projected next response is dangerous, or
  // when a duplicate means the boss copy remains in the bag.
  if (
    !BOSS_FLOORS.has(floor)
    && (magicCard.magicType === 'frostRing' || magicCard.magicType === 'boneWall')
  ) {
    const copies = invItems(inv).filter((card) => (
      card.type === 'magic' && card.magicType === magicCard.magicType
    )).length;
    const dangerous = immediateIncoming >= gs.playerHealth
      || immediateIncoming >= gs.maxHealth * 0.22
      || hpPct <= t.magicLowHpPct;
    if (copies <= 1 && !dangerous) return -Infinity;
  }

  switch (magicCard.magicType) {
    case 'restoration':
      if (BOSS_FLOORS.has(floor) && gs.actionsLeft > 0 && hpPct >= 0.3) return -Infinity;
      if (gs.actionsLeft > 0 && hpPct > t.restorationEmergencyHpPct) return -Infinity;
      return base + (1 - hpPct) * 120 + (gs.actionsLeft <= 0 ? 100 : 0);
    case 'fireball': {
      if (!revealedEnemies.length) return -Infinity;
      const killable = revealedEnemies.some((card) => (card.data.health || 0) <= (magicCard.damage || 15));
      return base + (killable ? 70 : 0) + revealedEnemies.length * 5;
    }
    case 'soulDrain':
      if (!nonBossEnemies.length) return -Infinity;
      return base + (hpPct < t.magicLowHpPct ? 80 : 0);
    case 'frostRing':
      if (!revealedEnemies.length) return -Infinity;
      return base + revealedEnemies.length * 16 + (hpPct < t.defensiveMagicHpPct ? 40 : 0);
    case 'weakness':
      if (!revealedEnemies.length) return -Infinity;
      return base + revealedEnemies.reduce((sum, card) => sum + (card.data.attack || 0), 0) * 2;
    case 'shadowBlade':
      if (!gs.equippedWeapon || (gs.shadowBlade?.turns || 0) > t.shadowBladeMinTurns) return -Infinity;
      return base + (gs.equippedWeapon.damage || 0) * 8;
    case 'boneWall':
      if (revealedEnemies.length === 0 || (gs.boneWall || 0) > 0) return -Infinity;
      return base + revealedEnemies.length * 12 + (hpPct < t.defensiveMagicHpPct ? 60 : 0);
    case 'magicShield':
      if (revealedEnemies.length === 0 || (gs.magicShield?.turns || 0) > 0) return -Infinity;
      return base + ((gs.equippedArmor?.protection || 0) * 10) + (hpPct < t.defensiveMagicHpPct ? 40 : 0);
    case 'smokeScreen':
      return nonBossEnemies.length >= 2 ? base + nonBossEnemies.length * 14 : -Infinity;
    default:
      return -Infinity;
  }
}

function maybeUseCombatMagic(mock, gs, inv, floor) {
  const board = mock.cardSystem.boardCards || [];
  let best = null;
  for (let i = 0; i < inv.length; i++) {
    const card = inv[i];
    if (card?.type !== 'magic') continue;
    const score = scoreMagicUse(mock, gs, inv, board, i, floor);
    if (score > -Infinity && (!best || score > best.score)) best = { index: i, score };
  }
  if (!best) return false;
  return castMagicCard(mock, gs, inv, best.index, board, floor);
}

function useBossOpeningDefense(mock, gs, inv, floor) {
  if (!BOSS_FLOORS.has(floor)) return false;
  if ((gs.boneWall || 0) > 0) {
    gs._simMetrics.bossTactics.activeBoneWallAtEntry++;
    return false;
  }
  const frostIndex = inv.findIndex((card) => (
    card?.type === 'magic' && card.magicType === 'frostRing'
  ));
  const boneWallIndex = inv.findIndex((card) => (
    card?.type === 'magic' && card.magicType === 'boneWall'
  ));
  for (const index of [frostIndex, boneWallIndex]) {
    if (index < 0 || !inv[index]) continue;
    const magicType = inv[index].magicType;
    const used = castMagicCard(
      mock,
      gs,
      inv,
      index,
      mock.cardSystem.boardCards || [],
      floor,
    );
    if (!used) continue;
    if (magicType === 'frostRing') gs._simMetrics.bossTactics.frostOpeners++;
    else gs._simMetrics.bossTactics.boneWallOpeners++;
    return true;
  }
  gs._simMetrics.bossTactics.noDefensiveOpener++;
  return false;
}

// Use a Restoration magic card (full HP + AP) when starving for AP or low HP.
function maybeRestore(mock, gs, inv) {
  const t = CURRENT_BEHAVIOR.thresholds;
  const hpThreshold = BOSS_FLOORS.has(gs.currentFloor) ? 0.3 : t.restorationEmergencyHpPct;
  if (gs.actionsLeft > 0 && gs.playerHealth >= gs.maxHealth * hpThreshold) return false;
  const ri = inv.findIndex((c) => c?.type === 'magic' && c.magicType === 'restoration');
  if (ri < 0) return false;
  const hpPct = gs.maxHealth > 0 ? gs.playerHealth / gs.maxHealth : 1;
  if (
    BOSS_PREP_FLOORS.has(gs.currentFloor)
    && bossPrepItems(inv).length <= 1
    && hpPct > t.bossPrepReserveEmergencyHpPct
  ) {
    return false;
  }
  return castMagicCard(mock, gs, inv, ri, mock.cardSystem.boardCards || [], gs.currentFloor);
}

// Socket available gems into the equipped weapon (rules mirror
// inventorySystem.applyGemToWeapon: weapons only, rarity gemSlots, same type only).
// Strategy: poison for bosses/high-HP, lightning when back-row enemies exist,
// fire when there's a face-down cluster to burn; otherwise poison.
function socketGems(gs, inv, ctx) {
  const gemEntries = inv
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card?.type === 'gem');
  if (!gemEntries.length) return;
  const prefBias = CURRENT_BEHAVIOR.gemPreference;

  const gemPriority = (gem) => {
    let score = (prefBias[`${gem.gemEffect}Base`] ?? 0) + prefBias.emptySocketBias;
    if ((ctx.boss || isBossPrepObjectiveActive(gs)) && gem.gemEffect === 'poison') {
      score += prefBias.bossPoisonBias;
    }
    if (ctx.ranged && gem.gemEffect === 'lightning') score += prefBias.rangedLightningBias;
    if (ctx.hiddenCluster && gem.gemEffect === 'fire') score += prefBias.hiddenFireBias;
    return score;
  };
  gemEntries.sort((a, b) => gemPriority(b.card) - gemPriority(a.card));

  for (const { card: gem, index } of gemEntries) {
    if (inv[index] !== gem) continue;
    const target = bestGemTarget(gs, inv, gem);
    if (!target || !socketGemIntoWeapon(target, gem)) continue;
    inv[index] = null;
  }
  syncInventoryState(gs, inv);
}

function maybeHeal(mock, gs, inv) {
  // Boss-room healing is handled as an explicit action at the top of the
  // combat loop by maybeBossEmergencyHeal().
  if (BOSS_FLOORS.has(gs.currentFloor)) return false;
  const hpThreshold = CURRENT_BEHAVIOR.thresholds.emergencyHealHpPct;
  if (gs.playerHealth >= gs.maxHealth * hpThreshold) return false;
  const pi = inv.findIndex((c) => c?.type === 'potion');
  if (pi >= 0) {
    const hpPct = gs.maxHealth > 0 ? gs.playerHealth / gs.maxHealth : 1;
    if (
      BOSS_PREP_FLOORS.has(gs.currentFloor)
      && bossPrepItems(inv).length <= 1
      && hpPct > CURRENT_BEHAVIOR.thresholds.bossPrepReserveEmergencyHpPct
    ) {
      return false;
    }
    const potion = inv[pi];
    const hpBefore = gs.playerHealth;
    mock.useAction();
    if (usePotionCard(mock, gs, potion, true)) {
      traceCombat(
        gs,
        `drink ${potion.name || 'potion'}; HP ${Math.ceil(hpBefore)}→${Math.ceil(gs.playerHealth)}, AP ${gs.actionsLeft}`,
      );
      inv[pi] = null;
      syncInventoryState(gs, inv);
      mock.resolvePendingEnemyTurn();
      return true;
    }
    mock.resolvePendingEnemyTurn();
  }
  return false;
}

function maybeBossEmergencyHeal(mock, gs, inv, floor) {
  if (!BOSS_FLOORS.has(floor) || gs.playerHealth >= gs.maxHealth * 0.3) return false;
  const potions = inv
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card?.type === 'potion')
    .sort((a, b) => (a.card.healAmount || 0) - (b.card.healAmount || 0));
  if (potions.length) {
    const needed = Math.max(1, Math.ceil(gs.maxHealth * 0.3) - gs.playerHealth);
    const pick = potions.find(({ card }) => (card.healAmount || 0) >= needed)
      || potions[potions.length - 1];
    const hpBefore = gs.playerHealth;
    mock.useAction();
    if (usePotionCard(mock, gs, pick.card, true)) {
      traceCombat(
        gs,
        `boss heal ${pick.card.name || 'potion'}; HP ${Math.ceil(hpBefore)}→${Math.ceil(gs.playerHealth)}, AP ${gs.actionsLeft}`,
      );
      removeInventoryCard(gs, inv, pick.index);
      gs._simMetrics.bossTactics.emergencyPotion++;
      return true;
    }
  }

  const restorationIndex = inv.findIndex((card) => (
    card?.type === 'magic' && card.magicType === 'restoration'
  ));
  if (restorationIndex >= 0) {
    const card = inv[restorationIndex];
    if (castMagicCard(mock, gs, inv, restorationIndex, mock.cardSystem.boardCards || [], floor)) {
      gs._simMetrics.bossTactics.emergencyRestoration++;
      return true;
    }
  }
  return false;
}

function finalizeBossPreparation(mock, gs, inv, floor) {
  if (!IMMEDIATE_PRE_BOSS_FLOORS.has(floor) || gs.playerHealth <= 0) return false;
  const hpPct = gs.maxHealth > 0 ? gs.playerHealth / gs.maxHealth : 1;
  const apPct = gs.maxActions > 0 ? gs.actionsLeft / gs.maxActions : 1;
  if (hpPct >= 0.78 && apPct > 0.4) return false;

  const restorationIndex = inv.findIndex((card) => (
    card?.type === 'magic' && card.magicType === 'restoration'
  ));
  const potionCandidates = inv
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card?.type === 'potion')
    .sort((a, b) => (a.card.healAmount || 0) - (b.card.healAmount || 0));

  // Restoration is most valuable here when it refills AP as well as HP, or
  // when health is genuinely dangerous. Otherwise use the smallest potion
  // that prepares the hero and preserve tactical magic for the boss.
  if (restorationIndex >= 0 && (apPct <= 0.4 || hpPct <= 0.45)) {
    const card = inv[restorationIndex];
    if (useRestorationCard(mock, gs, card, true)) {
      removeInventoryCard(gs, inv, restorationIndex);
      maybeReturnMagicToInventory(mock, gs, inv, card);
      return true;
    }
  }

  if (potionCandidates.length) {
    const missing = Math.max(0, gs.maxHealth - gs.playerHealth);
    const pick = potionCandidates.find(({ card }) => (card.healAmount || 0) >= missing)
      || potionCandidates[potionCandidates.length - 1];
    if (usePotionCard(mock, gs, pick.card, true)) {
      removeInventoryCard(gs, inv, pick.index);
      return true;
    }
  }

  if (restorationIndex >= 0) {
    const card = inv[restorationIndex];
    if (useRestorationCard(mock, gs, card, true)) {
      removeInventoryCard(gs, inv, restorationIndex);
      maybeReturnMagicToInventory(mock, gs, inv, card);
      return true;
    }
  }
  return false;
}

function aliveEnemies(board, revealedOnly) {
  const out = [];
  for (let i = 0; i < board.length; i++) {
    const c = board[i];
    if (c && (c.data?.type === 'enemy' || c.data?.type === 'boss') && c.data.health > 0) {
      if (!revealedOnly || c.revealed) out.push(i);
    }
  }
  return out;
}

// Is any MELEE-role enemy still alive (revealed and/or hidden)? Mirrors
// CardSystem._anyMeleeAlive — used to know a melee weapon's hits on archers
// are blocked by the frontline.
function anyMeleeAlive(board, includeHidden) {
  for (const c of board) {
    if (!c || !(c.data?.type === 'enemy' || c.data?.type === 'boss')) continue;
    if (c.data.health <= 0 || c.data.role !== 'MELEE') continue;
    if (includeHidden || c.revealed) return true;
  }
  return false;
}

function computeContext(board, floor) {
  let boss = BOSS_FLOORS.has(floor), ranged = false, hidden = 0;
  for (const c of board) {
    if (!c) continue;
    if (!c.revealed) hidden++;
    if (c.data?.type === 'boss') boss = true;
    if ((c.data?.type === 'enemy' || c.data?.type === 'boss') && c.data.role === 'RANGED') ranged = true;
  }
  return { boss, ranged, hiddenCluster: hidden >= 4 };
}

function estimateGemSplash(board, targetIndex, weapon, baseDamage) {
  const stack = CardDataGenerator.weaponGemStack(weapon);
  const armor = Math.max(0, board[targetIndex]?.data?.armor || 0);
  const directDamage = Math.max(1, baseDamage - armor);
  const affected = new Map([[targetIndex, directDamage]]);
  if (!weapon?.gemEffect) return affected;

  if (weapon.gemEffect === 'fire') {
    const splashDamage = [3, 4, 5, 6, 7][stack - 1];
    affected.set(targetIndex, (affected.get(targetIndex) || 0) + splashDamage);
    const target = board[targetIndex];
    const radius = 70;
    const tx = target?.sprite?.x ?? 0;
    const ty = target?.sprite?.y ?? 0;
    for (let i = 0; i < board.length; i++) {
      if (i === targetIndex) continue;
      const card = board[i];
      if (!card?.revealed || !(card.data?.type === 'enemy' || card.data?.type === 'boss') || card.data.health <= 0) continue;
      const b = card.sprite?.getBounds?.();
      const nearestX = b ? Math.max(b.x, Math.min(tx, b.x + b.width)) : (card.sprite?.x ?? 0);
      const nearestY = b ? Math.max(b.y, Math.min(ty, b.y + b.height)) : (card.sprite?.y ?? 0);
      if (Math.hypot(nearestX - tx, nearestY - ty) <= radius) {
        affected.set(i, (affected.get(i) || 0) + splashDamage);
      }
    }
  } else if (weapon.gemEffect === 'lightning') {
    const zapDamage = [3, 4, 5, 6, 7][stack - 1];
    affected.set(targetIndex, (affected.get(targetIndex) || 0) + zapDamage);
    const candidates = board
      .map((card, index) => ({ card, index }))
      .filter(({ card, index }) => (
        index !== targetIndex
        && card?.revealed
        && (card.data?.type === 'enemy' || card.data?.type === 'boss')
        && card.data.health > 0
      ));
    candidates.sort((a, b) => {
      const ar = a.card.data.role === 'RANGED' ? 1 : 0;
      const br = b.card.data.role === 'RANGED' ? 1 : 0;
      if (br !== ar) return br - ar;
      return a.card.data.health - b.card.data.health;
    });
    for (const { index } of candidates.slice(0, 2)) {
      affected.set(index, (affected.get(index) || 0) + zapDamage);
    }
  } else if (weapon.gemEffect === 'poison') {
    const poison = stack * 3; // 1 damage for 3 turns per socket.
    affected.set(targetIndex, (affected.get(targetIndex) || 0) + poison);
  }
  return affected;
}

function expectedAmuletDodgeChance(gs) {
  const manager = gs.scene?.amuletManager;
  if (!manager) return 0;
  return Math.min(1, (gs.activeAmulets || []).reduce((sum, amulet) => {
    const definition = manager.amuletDefinitions?.[amulet.id];
    return sum + (definition?.dodgeChance || 0);
  }, 0));
}

function createProjectedDefense(gs) {
  return {
    blockNextAttack: Boolean(gs.blockNextAttack),
    boneWall: Math.max(0, gs.boneWall || 0),
    armor: gs.equippedArmor ? { ...gs.equippedArmor } : null,
    armorDurabilitySaveChance: Math.min(
      0.95,
      (gs.relicEffects?.armorDurabilitySave || 0)
        + (gs.scene?.amuletManager?.getArmorDurabilitySaveChance?.() || 0)
        + (gs.talentEffects?.rivetsChance || 0),
    ),
    activeThorns: gs.activeThorns ? { ...gs.activeThorns } : null,
    magicShieldTurns: Math.max(0, gs.magicShield?.turns || 0),
    magicShieldMultiplier: gs.magicShield?.multiplier || 1.2,
    poisonEffects: (gs.playerEffects || [])
      .filter((effect) => effect?.type === 'poison' && (effect.turns || 0) > 0)
      .map((effect) => ({ ...effect })),
  };
}

function addProjectedPoison(defense, ability) {
  if (!ability || (ability.turns || 0) <= 0) return;
  const existing = defense.poisonEffects.find((effect) => effect.type === 'poison');
  if (existing) {
    existing.turns = Math.max(0, existing.turns || 0) + Math.max(0, ability.turns || 0);
    existing.damage = Math.max(existing.damage || 0, ability.damage || 0);
    return;
  }
  defense.poisonEffects.push({ ...ability, type: 'poison' });
}

function expectedEnemyHitOutcome(gs, enemy, defense) {
  if (!enemy || enemy.health <= 0) return { incoming: 0, retaliation: 0 };
  let amount = enemy.attack || 0;
  const rage = enemy.abilities?.find((ability) => ability.type === 'rage');
  const maxHealth = enemy.maxHealth || enemy.health;
  if (rage && maxHealth > 0 && enemy.health / maxHealth <= (rage.threshold ?? 0.3)) {
    amount = Math.ceil(amount * (rage.damageBoost || 1.5));
  }

  const manager = gs.scene?.amuletManager;
  if (manager) amount = manager.modifyDamageTaken(amount);

  const armor = defense.armor;
  let protection = armor?.protection || 0;
  if (defense.magicShieldTurns > 0 && protection > 0) {
    protection = Math.floor(protection * defense.magicShieldMultiplier);
  }
  const armorProtection = protection;
  protection += gs.scene?.getCompanionProtectionBonus?.() || 0;
  const armorPierce = enemy.abilities?.find((ability) => ability.type === 'armor_break')?.amount || 0;
  const landedDamage = Math.max(0, amount - Math.max(0, protection - armorPierce));
  const blockedDamage = Math.max(0, amount - landedDamage);

  const amuletDodge = expectedAmuletDodgeChance(gs);
  const armorDodge = Math.max(0, Math.min(1, armor?.dodgeChance || 0));
  const isRanged = enemy.type !== 'boss' && (enemy.role === 'RANGED' || enemy.isRangedType === true);
  const isMelee = enemy.type === 'boss' || (enemy.role === 'MELEE' && !enemy.isRangedType);
  const rangedIgnore = isRanged
    ? Math.max(0, Math.min(1, armor?.rangedIgnoreChance || 0))
    : 0;
  const hitChance = (1 - amuletDodge) * (1 - armorDodge) * (1 - rangedIgnore);

  let retaliation = 0;
  if (armor && hitChance > 0) {
    let reflected = Math.floor(amount * ((armor.reflection || 0) / 100));
    if (enemy.type === 'boss') reflected = Math.min(reflected, Math.max(0, enemy.health - 1));
    retaliation += Math.max(0, reflected) * hitChance;
  }

  // The live resolver spends one armor pip on every protected hit. Dodge-only
  // leather spends a pip only when either amulet or armor dodge actually fires.
  if (armor) {
    const dodgeOrDeflectChance = 1 - hitChance;
    const durabilityTickChance = armorProtection > 0 ? 1 : dodgeOrDeflectChance;
    armor.durability = Math.max(
      0,
      (armor.durability || 0)
        - durabilityTickChance * (1 - defense.armorDurabilitySaveChance),
    );
    if (armor.durability <= 0) defense.armor = null;
  }

  // Reprisal and chain counter are checked after the armor durability tick, so
  // the breaking hit does not receive either bonus in the live resolver.
  if (defense.armor && hitChance > 0 && blockedDamage > 0) {
    const reprisalPct = gs.talentEffects?.reprisalReflectPct || 0;
    if ((defense.armor.protection || 0) > 0 && reprisalPct > 0) {
      retaliation += Math.floor(blockedDamage * reprisalPct) * hitChance;
    }
    if (isMelee && (defense.armor.meleeCounterChance || 0) > 0) {
      retaliation += Math.ceil(blockedDamage * 0.5)
        * Math.min(1, defense.armor.meleeCounterChance)
        * hitChance;
    }
    if (isMelee && landedDamage > 0 && (defense.armor.thornDamage || 0) > 0) {
      retaliation += defense.armor.thornDamage * hitChance;
    }
  }

  // Carried thorns bite melee attackers even when the player dodges. They lose
  // exactly one pip per eligible attacker, matching the real combat controller.
  if (
    isMelee
    && defense.activeThorns
    && defense.activeThorns.durability > 0
  ) {
    retaliation += defense.activeThorns.thornDamage || 2;
    defense.activeThorns.durability--;
    if (defense.activeThorns.durability <= 0) defense.activeThorns = null;
  }

  return {
    incoming: landedDamage * hitChance,
    retaliation,
  };
}

function expectedPlayerPoisonTick(gs, defense) {
  if (
    gs.relicEffects?.poisonImmunity
    || gs.scene?.amuletManager?.isPoisonImmune?.()
  ) {
    defense.poisonEffects = [];
    return 0;
  }
  let damage = defense.poisonEffects.reduce(
    (sum, effect) => sum + (effect.damage || 0),
    0,
  );
  defense.poisonEffects = defense.poisonEffects
    .map((effect) => ({ ...effect, turns: (effect.turns || 0) - 1 }))
    .filter((effect) => effect.turns > 0);
  if (gs.scene?.amuletManager) damage = gs.scene.amuletManager.modifyDamageTaken(damage);
  return damage * (1 - expectedAmuletDodgeChance(gs));
}

function cloneLookaheadBoard(board) {
  return board.map((card) => {
    if (!card?.data || (card.data.type !== 'enemy' && card.data.type !== 'boss')) return null;
    return {
      revealed: Boolean(card.revealed),
      justRevealed: Boolean(card.justRevealed),
      data: {
        ...card.data,
        abilities: Array.isArray(card.data.abilities)
          ? card.data.abilities.map((ability) => ({ ...ability }))
          : [],
      },
    };
  });
}

function applyProjectedDamage(state, affected) {
  for (const [index, damage] of affected.entries()) {
    const enemy = state[index]?.data;
    if (enemy && enemy.health > 0) enemy.health -= damage;
  }
}

function applyProjectedCompanionTurns(state, gs) {
  for (const companion of companionsIn(gs.scene?._simInventory || [])) {
    const targets = state
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => card?.revealed && card.data.health > 0);
    if (!targets.length) break;
    const meleeTargets = companion.attackStyle === 'melee'
      ? targets.filter(({ card }) => card.data.role === 'MELEE' || card.data.type === 'boss')
      : targets;
    const pool = meleeTargets.length ? meleeTargets : targets;
    pool.sort((a, b) => a.card.data.health - b.card.data.health);
    pool[0].card.data.health -= companion.attack || 2;
  }
}

function simulateExpectedEnemyPhase(state, gs, defense) {
  const eligible = state.filter((card) => (
    card?.revealed && card.data.health > 0 && !card.justRevealed
  ));
  for (const card of state) {
    if (card?.justRevealed) card.justRevealed = false;
  }
  if (!eligible.length) {
    if (defense.magicShieldTurns > 0) defense.magicShieldTurns--;
    return expectedPlayerPoisonTick(gs, defense);
  }

  if (defense.blockNextAttack) {
    defense.blockNextAttack = false;
    applyProjectedCompanionTurns(state, gs);
    return 0;
  }
  const firstAttacker = eligible.find((card) => !(card.data.frozen > 0));
  if (defense.boneWall > 0 && firstAttacker) {
    defense.boneWall--;
    firstAttacker.data.health -= firstAttacker.data.attack || 0;
    applyProjectedCompanionTurns(state, gs);
    return 0;
  }
  let incoming = 0;
  for (const card of eligible) {
    const enemy = card.data;
    if (enemy.health <= 0) continue;
    if (enemy.frozen > 0) {
      enemy.frozen--;
      continue;
    }
    for (const ability of (enemy.abilities || [])) {
      if (ability.type === 'poison') addProjectedPoison(defense, ability);
    }
    const outcome = expectedEnemyHitOutcome(gs, enemy, defense);
    incoming += outcome.incoming;
    enemy.health -= outcome.retaliation;
    const lifesteal = enemy.abilities?.find((ability) => ability.type === 'lifesteal');
    if (lifesteal && outcome.incoming > 0 && enemy.health > 0) {
      const heal = Math.max(1, Math.ceil(outcome.incoming * (lifesteal.percentage || 0.3)));
      enemy.health = Math.min(enemy.maxHealth || enemy.health, enemy.health + heal);
    }
  }
  if (defense.magicShieldTurns > 0) defense.magicShieldTurns--;
  incoming += expectedPlayerPoisonTick(gs, defense);

  // Companions act after poison and choose the weakest valid target.
  applyProjectedCompanionTurns(state, gs);
  return incoming;
}

function projectSurvivalToTargetKill(board, gs, targetIndex, affected) {
  const state = cloneLookaheadBoard(board);
  const defense = createProjectedDefense(gs);
  let margin = gs.playerHealth;
  let projectedIncoming = 0;
  let firstMargin = gs.playerHealth;
  let turns = 1;
  const maxTurns = 10;
  applyProjectedDamage(state, affected);

  while (turns <= maxTurns) {
    const phaseDamage = simulateExpectedEnemyPhase(state, gs, defense);
    projectedIncoming += phaseDamage;
    margin -= phaseDamage;
    if (turns === 1) firstMargin = margin;
    const targetAlive = (state[targetIndex]?.data?.health || 0) > 0;
    if (!targetAlive) {
      return {
        lethal: margin <= 0,
        resolved: true,
        margin,
        immediateLethal: firstMargin <= 0,
        projectedIncoming,
        turns,
      };
    }
    if (margin <= 0) {
      return {
        lethal: true,
        resolved: false,
        margin,
        immediateLethal: firstMargin <= 0,
        projectedIncoming,
        turns,
      };
    }
    applyProjectedDamage(state, affected);
    turns++;
  }

  return {
    lethal: true,
    resolved: false,
    margin,
    immediateLethal: firstMargin <= 0,
    projectedIncoming,
    turns: maxTurns,
  };
}

function estimateImmediateEnemyPhaseDamage(board, gs) {
  const state = cloneLookaheadBoard(board);
  return simulateExpectedEnemyPhase(state, gs, createProjectedDefense(gs));
}

function chooseEfficientAttack(board, gs, inv, wasExhausted) {
  const revealed = aliveEnemies(board, true);
  if (!revealed.length) return null;
  const roster = [];
  if (gs.equippedWeapon && gs.equippedWeapon.durability > 0) roster.push(gs.equippedWeapon);
  for (const card of inv) if (card?.type === 'weapon' && card.durability > 0) roster.push(card);
  if (!roster.length) return null;

  const anyRevealedMelee = anyMeleeAlive(board, true);
  const effDmg = (wp) => simWeaponHitDamage(gs, wp, wasExhausted, { expectedCrit: true });

  const bossIndex = revealed.find((index) => board[index]?.data?.type === 'boss');
  const hasBossSummons = bossIndex !== undefined && board.some((card) => (
    card?.data?.type === 'enemy' && card.data.health > 0
  ));
  if (!SURVIVAL_LOOKAHEAD_ENABLED && hasBossSummons) {
    const bestBow = roster
      .filter((weapon) => weapon?.weaponType === 'bow')
      .sort((a, b) => effDmg(b) - effDmg(a) || (b.durability || 0) - (a.durability || 0))[0];
    if (bestBow) {
      return {
        index: bossIndex,
        weapon: bestBow,
        score: Number.MAX_SAFE_INTEGER,
        bossBowFocus: true,
      };
    }
  }

  const aw = CURRENT_BEHAVIOR.attackWeights;
  const attackCandidates = [];
  let greedyBest = null;
  for (const weapon of roster) {
    const validTargets = revealed.filter((index) => {
      const target = board[index];
      return !anyRevealedMelee || !isMelee(weapon) || target.data.role === 'MELEE';
    });
    for (const index of validTargets) {
      const baseDamage = effDmg(weapon);
      const targetHp = board[index]?.data?.health || 0;
      const affected = estimateGemSplash(board, index, weapon, baseDamage);
      const offhand = findOffhandDagger(weapon, gs, inv);
      // The real second dagger only swings if the primary weapon (including
      // its gem) did not already remove the selected target.
      if (offhand && (affected.get(index) || 0) < targetHp) {
        const offDmg = simOffhandDamage(gs, offhand, wasExhausted);
        const offAffected = estimateGemSplash(board, index, offhand, offDmg);
        for (const [hitIndex, damage] of offAffected.entries()) {
          affected.set(hitIndex, (affected.get(hitIndex) || 0) + damage);
        }
      }
      let kills = 0;
      let totalDamage = 0;
      let overkill = 0;
      for (const [hitIndex, damage] of affected.entries()) {
        const hp = board[hitIndex]?.data?.health || 0;
        totalDamage += Math.min(hp, damage);
        if (damage >= hp) {
          kills++;
          overkill += damage - hp;
        }
      }
      const targetKill = (affected.get(index) || 0) >= targetHp ? 1 : 0;
      const killEfficiency = killEfficiencyAdjustment({
        targetHp,
        targetDamage: affected.get(index) || 0,
        targetKill: targetKill === 1,
        weakTargetWeight: aw.weakKillTarget || 0,
        finisherWastePenalty: aw.finisherWastePenalty || 0,
      });
      const gemBonus = weapon?.gemEffect
        ? aw.elementalBonus * Math.max(1, weapon.gemCount || 1)
        : 0;
      const bossBowFocus = hasBossSummons
        && weapon?.weaponType === 'bow'
        && board[index]?.data?.type === 'boss'
        && !isMelee(weapon);
      const rangedBossBypass = bossBowFocus ? (aw.rangedBossBypass || 0) : 0;
      const durabilityConserve = weapon ? Math.max(0, 20 - effDmg(weapon)) * aw.durabilityConserve : 0;
      // Do not spend a boss bow to secure a routine kill that a melee backup
      // can finish in the same action. This preserves ranged/gem triggers
      // without accepting an extra enemy response merely to save durability.
      const equivalentMeleeFinisher = weapon?.weaponType === 'bow'
        && !BOSS_FLOORS.has(gs.currentFloor)
        && roster.some((other) => (
          other !== weapon
          && other.weaponType !== 'bow'
          && (!anyRevealedMelee || board[index]?.data?.role === 'MELEE')
          && effDmg(other) >= targetHp
        ));
      const bossBowReserve = equivalentMeleeFinisher
        ? (
          isBossPrepObjectiveActive(gs)
            ? 600
            : (weapon.gemEffect ? 140 : 30)
        )
        : 0;
      // Prefer spending the healthier dagger as primary. This keeps both
      // blades above zero for as many dual attacks as possible instead of
      // breaking one while its partner still has several unused pips.
      const daggerPrimaryValue = offhand
        ? Math.max(0, weapon.durability || 0) * 3
          - ((weapon.durability || 0) === 1 && (offhand.durability || 0) > 1 ? 500 : 0)
        : 0;
      const baseScore = kills * aw.kills + targetKill * aw.targetKill
        + totalDamage * aw.totalDamage + gemBonus + rangedBossBypass
        - overkill * aw.overkillPenalty + durabilityConserve - bossBowReserve
        + daggerPrimaryValue + killEfficiency;
      const survival = projectSurvivalToTargetKill(board, gs, index, affected);
      // Preserve the requested bow-through-summons boss plan unless the next
      // enemy response itself is lethal. Longer-horizon fear should not make
      // the bot repeatedly reset progress by clearing an endless summon wave.
      const unsafe = survival.lethal && (
        survival.immediateLethal
        || !bossBowFocus
      );
      const boundedMargin = Math.max(-gs.maxHealth, Math.min(gs.maxHealth, survival.margin));
      const survivalScore = SURVIVAL_LOOKAHEAD_ENABLED
        ? boundedMargin * (aw.survivalMargin || 0)
          - survival.projectedIncoming * (aw.projectedDamage || 0)
          - survival.turns * (aw.turnsToKill || 0)
          - (unsafe ? (aw.lethalPlanPenalty || 0) : 0)
        : 0;
      const score = baseScore + survivalScore;
      const candidate = {
        index,
        weapon,
        score,
        baseScore,
        survival,
        unsafe,
        bossBowFocus,
        spendsLastPip: (weapon?.durability || 0) === 1,
        endsBossFight: board[index]?.data?.type === 'boss' && targetKill === 1,
      };
      if (!greedyBest || baseScore > greedyBest.baseScore) greedyBest = candidate;
      attackCandidates.push(candidate);
    }
  }

  const metrics = gs._simMetrics?.lookahead;
  const preservation = chooseWeaponPreservingAttack(attackCandidates);
  const best = preservation.candidate;
  if (best) best.preservationReason = preservation.reason;
  if (metrics && preservation.avoidedLastPip) metrics.lastPipPreservations++;
  if (
    metrics
    && best?.spendsLastPip
    && (preservation.reason === 'survival_emergency' || preservation.reason === 'boss_finisher')
  ) {
    metrics.lastPipEmergencyUses++;
  }
  if (SURVIVAL_LOOKAHEAD_ENABLED && metrics && best && greedyBest) {
    metrics.evaluations++;
    if (best.index !== greedyBest.index || best.weapon !== greedyBest.weapon) {
      metrics.overrides++;
    }
    if (greedyBest.unsafe && !best.unsafe) {
      metrics.lethalPlansAvoided++;
    }
    if (best.unsafe) metrics.noSafePlan++;
  }
  return best;
}

function runCombat(mock, gs, inv, floor, floorStartWeaponPips) {
  // Grace is now per-enemy (card.justRevealed, set in the real revealCard) — no
  // global first-turn skip. A freshly revealed enemy sits out only its reveal action.
  mock.isEnemyTurn = false;
  mock._enemyTurnPending = false;
  mock.enemiesCleared = false;
  mock.dead = false;
  let combatDamageDealt = 0;
  let combatDamageWasted = 0;
  let combatDamageTaken = 0;
  let combatDamageBlockedArmor = 0;
  let combatDamageDodged = 0;
  let combatSpecializationDualWield = 0;
  let combatSpecializationGem = 0;
  gs._combatTrace = [];
  mock._lastCombatTrace = [];
  traceCombat(
    gs,
    `enter floor ${floor} ${gs.roomType || 'COMBAT'}; HP ${Math.ceil(gs.playerHealth)}/${gs.maxHealth}, AP ${gs.actionsLeft}`,
  );

  // Effective weapon-hit HP removed from one target, excluding gem contribution
  // that already landed in the same swing (gems fire before weapon damage).
  const measureTargetWeaponHit = (targetIndex, attackFn) => {
    const target = mock.cardSystem.boardCards[targetIndex];
    const hpBefore = target?.data?.health || 0;
    const gemBefore = combatSpecializationGem;
    attackFn();
    const hpAfter = target?.data?.health || 0;
    const gemDelta = Math.max(0, combatSpecializationGem - gemBefore);
    return Math.max(0, hpBefore - hpAfter - gemDelta);
  };

  const sumEnemyHp = () => mock.cardSystem.boardCards.reduce((sum, c) => (
    sum + ((c?.data && (c.data.type === 'enemy' || c.data.type === 'boss') && c.data.health > 0)
      ? c.data.health
      : 0)
  ), 0);

  const originalTakeDamage = gs.takeDamage?.bind(gs);
  if (originalTakeDamage) {
    gs.takeDamage = (...args) => {
      const hpBefore = gs.playerHealth;
      const out = originalTakeDamage(...args);
      combatDamageTaken += Math.max(0, Number(out?.actualDamage) || 0);
      combatDamageBlockedArmor += Math.max(0, Number(out?.blockedDamage) || 0);
      combatDamageDodged += Math.max(0, Number(out?.dodgedDamage) || 0);
      const source = args[2] || 'enemy';
      traceCombat(
        gs,
        `${source} response: ${out?.dodged ? 'dodged' : `${Math.ceil(out?.actualDamage || 0)} damage`}`
          + `, blocked ${Math.ceil(out?.blockedDamage || 0)}; HP ${Math.ceil(hpBefore)}→${Math.ceil(gs.playerHealth)}`
          + `, armor ${gs.equippedArmor ? Math.max(0, Math.ceil(gs.equippedArmor.durability || 0)) : 0}`,
      );
      return out;
    };
  }

  const originalDamageGemTarget = mock.cardSystem.damageGemTarget?.bind(mock.cardSystem);
  if (originalDamageGemTarget) {
    mock.cardSystem.damageGemTarget = (...args) => {
      const hpBefore = sumEnemyHp();
      const out = originalDamageGemTarget(...args);
      const hpAfter = sumEnemyHp();
      combatSpecializationGem += Math.max(0, hpBefore - hpAfter);
      return out;
    };
  }
  mock.cardSystem.spawnFloorCards();
  mock.amuletManager.processFloorStart();
  const bossCard = mock.cardSystem.boardCards.find((c) => c?.data?.type === 'boss') || null;
  const bossName = bossCard?.data?.name || null;
  // Station-bought or previously carried gems must be socketed before boss
  // readiness is measured. A human prepares the weapon before opening attack.
  socketGems(gs, inv, computeContext(mock.cardSystem.boardCards, floor));
  if (bossName && gs._simMetrics?.bossReadiness) {
    const readiness = gs._simMetrics.bossReadiness;
    const prep = bossPrepItems(inv);
    const offense = bossWeaponReadiness(gs, inv, bossCard.data);
    readiness.encounters++;
    readiness.withBow += offense.bow ? 1 : 0;
    readiness.bowDamage += offense.bow?.damage || 0;
    readiness.bowPips += offense.bowPips;
    readiness.bowCapacity += offense.bowCapacity;
    readiness.withDaggerPair += offense.daggerPair.length === 2 ? 1 : 0;
    readiness.daggerPairDamage += offense.daggerPairDamage;
    readiness.daggerPairPips += offense.daggerPairPips;
    readiness.daggerPairCapacity += offense.daggerPairCapacity;
    if (floor >= 31) {
      readiness.act3Encounters++;
      readiness.act3WithDaggerPair += offense.daggerPair.length === 2 ? 1 : 0;
      readiness.act3WithAxeOrSword += uniqueUsableWeapons(gs, inv).some((weapon) => (
        weapon.weaponType === 'axe' || weapon.weaponType === 'sword'
      )) ? 1 : 0;
    }
    readiness.totalWeaponCapacity += offense.totalCapacity;
    readiness.withEnoughWeaponCapacity += offense.enoughCapacity ? 1 : 0;
    readiness.withGemmedBow += offense.bow?.gemEffect ? 1 : 0;
    readiness.bowGemSockets += offense.bowSockets;
    if (offense.bow?.gemEffect) {
      readiness.bowGemByType[offense.bow.gemEffect] =
        (readiness.bowGemByType[offense.bow.gemEffect] || 0) + 1;
    }
    readiness.withPrep += prep.length > 0 ? 1 : 0;
    readiness.withPotion += prep.some((card) => card.type === 'potion') ? 1 : 0;
    readiness.withMergedPotion += prep.some((card) => (
      card.type === 'potion' && (card.healAmount || 0) > 35
    )) ? 1 : 0;
    readiness.withFrostRing += prep.some((card) => card.magicType === 'frostRing') ? 1 : 0;
    readiness.withBoneWall += prep.some((card) => card.magicType === 'boneWall') ? 1 : 0;
    readiness.withRestoration += prep.some((card) => card.magicType === 'restoration') ? 1 : 0;
    const hpPct = gs.maxHealth > 0 ? gs.playerHealth / gs.maxHealth : 0;
    readiness.hpPct += hpPct;
    readiness.combatReady += prep.length > 0 || hpPct >= 0.78 ? 1 : 0;
  }
  // The real rollEvade() bails on a scene-less sprite (a destroyed-sprite guard).
  // Mock board sprites have scene=null, so give any evade-carrying card (Lost
  // Soul, dodging Soul Eater) a scene ref so its dodge is actually simulated.
  for (const c of mock.cardSystem.boardCards) {
    if (c?.sprite && c.data?.abilities?.some((a) => a.type === 'evade')) c.sprite.scene = mock;
  }
  equipAmuletPickups(mock, inv);
  regear(mock.cardSystem.cardDataGenerator, gs, inv);
  applyHolographicOmenStartEffect(mock, gs, inv);
  if (gs._lootStats) {
    recordBoard(gs._lootStats, floor, mock.cardSystem.boardCards);
    recordCombatEnemySnapshot(
      gs._lootStats,
      floor,
      mock.cardSystem.boardCards,
      floorStartWeaponPips,
    );
  }
  if (gs._statsRecorder?.floorVisitId) {
    gs._statsRecorder.recordEnemies(mock.cardSystem.boardCards);
  }

  let bossMustAttackNext = Boolean(bossName);
  if (bossName) {
    gs._simMetrics.bossTactics.encounters++;
    if (useBossOpeningDefense(mock, gs, inv, floor)) {
      mock.resolvePendingEnemyTurn();
    }
  }

  let guard = 0;
  while (guard++ < 500) {
    if (gs.playerHealth <= 0) break;
    const board = mock.cardSystem.boardCards;

    // In the final three nodes, grab a revealed preparation card immediately
    // instead of leaving it on the board until every enemy is dead.
    if (
      isBossPrepObjectiveActive(gs)
      && collectVisibleLootSmart(mock, gs, inv, floor, 'prep')
    ) {
      continue;
    }

    // Human players pick up useful face-up cards immediately. Most board
    // pickups are free, so leaving an upgrade, gem, potion, or currency under
    // active enemies only makes the policy artificially weaker.
    if (collectVisibleLootSmart(mock, gs, inv, floor, 'combat')) {
      continue;
    }

    // Re-evaluate context and socket any collected gems (no-op when none).
    socketGems(gs, inv, computeContext(board, floor));

    // Boss emergency rule: below 30% HP, spend a healing potion first and use
    // Restoration when no potion is available.
    if (maybeBossEmergencyHeal(mock, gs, inv, floor)) {
      mock.resolvePendingEnemyTurn();
      regear(mock.cardSystem.cardDataGenerator, gs, inv);
      continue;
    }

    // After the defensive boss opener (or when none was available), the next
    // action must be the best weapon attack rather than unrelated magic.
    if (!bossMustAttackNext) {
      // Pop a Restoration card if starving for AP or low on HP.
      if (maybeRestore(mock, gs, inv)) {
        mock.resolvePendingEnemyTurn();
        regear(mock.cardSystem.cardDataGenerator, gs, inv);
        continue;
      }
      if (maybeUseCombatMagic(mock, gs, inv, floor)) {
        mock.resolvePendingEnemyTurn();
        maybeHeal(mock, gs, inv);
        regear(mock.cardSystem.cardDataGenerator, gs, inv);
        continue;
      }
    }
    // If armor broke mid-fight, swap to a spare so we're not eating full hits.
    if ((!gs.equippedArmor || gs.equippedArmor.durability <= 0) &&
        inv.some((c) => c?.type === 'armor' && c.durability > 0)) {
      regear(mock.cardSystem.cardDataGenerator, gs, inv);
    }
    // Select/merge a usable weapon before planning. Planning first could retain
    // a stale reference while regear replaced it, which previously allowed a
    // broken weapon to be attacked with at negative durability.
    if (!gs.equippedWeapon || gs.equippedWeapon.durability <= 0) {
      regear(mock.cardSystem.cardDataGenerator, gs, inv);
    }
    // 1) Pick an attack target (best weapon for board state), respecting melee gate.
    const revealed = aliveEnemies(board, true);
    if (revealed.length && hasCombatStalemate(board, gs, inv)) {
      mock._stalemateDeath = true;
      mock._lastKiller = 'No usable weapon';
      gs.playerHealth = 0;
      traceCombat(gs, 'weapon stalemate: no usable weapon or combat magic remains');
      break;
    }
    let attackIdx = -1;
    const attackPlan = chooseEfficientAttack(board, gs, inv, gs.actionsLeft <= 0);
    if (attackPlan) {
      // Exhaustion penalty: attacks while out of AP deal 20% less (real game rule).
      const wasExhausted = gs.actionsLeft <= 0;
      const effDmg = (wp) => simWeaponHitDamage(gs, wp, wasExhausted);

      // Attack the target/weapon pair chosen by the efficiency planner.
      attackIdx = attackPlan.index;
      const chosen = attackPlan.weapon;
      if (attackPlan.bossBowFocus) gs._simMetrics.bossTactics.bowFocusAttacks++;
      // Swap the chosen weapon into the equipped slot so the REAL attackEnemy
      // (which decrements gameState.equippedWeapon) spends ITS durability.
      if (chosen && chosen !== gs.equippedWeapon) {
        const idx = inv.indexOf(chosen);
        if (idx >= 0) {
          gs.equippedWeapon = chosen;
          syncInventoryState(gs, inv);
        }
      }

      // Keen Edge / First Blood apply to the primary swing only (not off-hand).
      const useFirstBlood = gs?.talentEffects?.firstBloodPct > 0 && !gs.firstAttackThisFloorUsed;
      const dmg = simWeaponHitDamage(gs, gs.equippedWeapon, wasExhausted, {
        applyFirstBlood: useFirstBlood,
        applyKeenEdge: true,
      });
      if (useFirstBlood) gs.firstAttackThisFloorUsed = true;
      const weaponBeforeAttack = gs.equippedWeapon;
      if ((weaponBeforeAttack?.durability || 0) === 1) {
        mock._lastPipWeaponAttacks = (mock._lastPipWeaponAttacks || 0) + 1;
        const preservationReason = attackPlan.preservationReason || 'unknown';
        const reasonCounts = gs._simMetrics?.lookahead?.lastPipAttackReasons;
        if (reasonCounts) {
          reasonCounts[preservationReason] = (reasonCounts[preservationReason] || 0) + 1;
        }
        if (preservationReason === 'forced_last_pip' && gs._simMetrics?.lookahead) {
          const lookahead = gs._simMetrics.lookahead;
          const floorKey = String(gs.currentFloor || floor || 1);
          const roomKey = gs.roomType || 'UNKNOWN';
          lookahead.forcedLastPipByFloor[floorKey] =
            (lookahead.forcedLastPipByFloor[floorKey] || 0) + 1;
          lookahead.forcedLastPipByRoom[roomKey] =
            (lookahead.forcedLastPipByRoom[roomKey] || 0) + 1;
        }
        if (weaponBeforeAttack.rarity && weaponBeforeAttack.rarity !== 'common') {
          mock._mergedLastPipWeaponAttacks = (mock._mergedLastPipWeaponAttacks || 0) + 1;
        }
        const hadAlternative = uniqueUsableWeapons(gs, inv).some((candidate) => (
          candidate !== weaponBeforeAttack
          && (
            (candidate.durability || 0) > 1
            || (
              candidate.weaponType === weaponBeforeAttack.weaponType
              && candidate.rarity === weaponBeforeAttack.rarity
            )
          )
        ));
        if (hadAlternative) {
          mock._avoidableLastPipWeaponAttacks = (mock._avoidableLastPipWeaponAttacks || 0) + 1;
        }
      }
      const targetHP = board[attackIdx]?.data?.health || 0;
      const targetName = board[attackIdx]?.data?.name || board[attackIdx]?.data?.type || 'enemy';
      traceCombat(
        gs,
        `attack ${targetName} ${Math.ceil(targetHP)}HP with ${weaponBeforeAttack?.name || 'unarmed'}`
          + ` for ${Math.ceil(dmg)}; AP ${gs.actionsLeft}, weapon ${weaponBeforeAttack?.durability ?? 0} pips`
          + `${attackPlan.preservationReason && attackPlan.preservationReason !== 'ordinary'
            ? `, ${attackPlan.preservationReason.replaceAll('_', ' ')}`
            : ''}`
          + `${attackPlan.unsafe ? ', projected unsafe' : ''}`,
      );
      combatDamageDealt += dmg;
      combatDamageWasted += Math.max(0, dmg - targetHP);
      if (!mock.useAction()) {
        // Stunned (or blocked): action cancelled, enemy turn still pending.
        mock.resolvePendingEnemyTurn();
        maybeHeal(mock, gs, inv);
        bossMustAttackNext = false;
        continue;
      }
      // Main hit always lands first.
      mock.cardSystem.attackEnemy(attackIdx, dmg, false, gs.equippedWeapon || null, false);
      combatDamageDealt += applyAssassinateSim(mock, gs, attackIdx);
      // Dual wield = free OFFHAND dagger swing only. Main-hand damage is
      // baseline weapon damage and must not inflate this specialization bucket.
      const offhand = findOffhandDagger(weaponBeforeAttack, gs, inv);
      if (offhand && board[attackIdx]?.data?.health > 0) {
        const dmg2 = simOffhandDamage(gs, offhand, wasExhausted);
        combatDamageDealt += dmg2;
        combatSpecializationDualWield += measureTargetWeaponHit(attackIdx, () => {
          mock.cardSystem.attackEnemy(attackIdx, dmg2, false, offhand, true);
        });
        combatDamageDealt += applyAssassinateSim(mock, gs, attackIdx);
      }
      // Front Volley: bow also clips a random front (MELEE) enemy.
      if (weaponBeforeAttack) {
        combatDamageDealt += applyFrontVolleySim(mock, gs, attackIdx, dmg, weaponBeforeAttack);
      }
      if (weaponBeforeAttack && !gs.equippedWeapon) mock._weaponBreaks = (mock._weaponBreaks || 0) + 1;
      if (!gs.equippedWeapon || gs.equippedWeapon.durability <= 0) regear(mock.cardSystem.cardDataGenerator, gs, inv);
      mock.resolvePendingEnemyTurn();
      maybeHeal(mock, gs, inv);
      bossMustAttackNext = false;
      continue;
    }

    // 2) No revealed enemies → flip the next face-down card.
    let nextUnrevealed = -1;
    for (let i = 0; i < board.length; i++) {
      if (board[i] && board[i].data && !board[i].revealed) { nextUnrevealed = i; break; }
    }
    if (nextUnrevealed >= 0) {
      traceCombat(
        gs,
        `reveal slot ${nextUnrevealed}; HP ${Math.ceil(gs.playerHealth)}, AP ${gs.actionsLeft}`,
      );
      mock.cardSystem.revealCard(nextUnrevealed); // free AP; schedules enemy turn
      mock.resolvePendingEnemyTurn();
      maybeHeal(mock, gs, inv);
      continue;
    }

    // 3) Nothing left to reveal and no revealed enemies: solve the visible loot
    // pile as an inventory puzzle, then clear the floor.
    if (collectVisibleLootSmart(mock, gs, inv, floor, 'all')) continue;
    break;
  }
  finalizeBossPreparation(mock, gs, inv, floor);

  if (gs._statsRecorder?.floorVisitId) {
    gs._statsRecorder.recordCombatStats({
      damageDealt: combatDamageDealt,
      damageWasted: combatDamageWasted,
      damageTaken: combatDamageTaken,
      damageBlockedArmor: combatDamageBlockedArmor,
      damageDodged: combatDamageDodged,
      specializationDualWield: combatSpecializationDualWield,
      specializationGem: combatSpecializationGem,
    });
  }

  if (originalTakeDamage) gs.takeDamage = originalTakeDamage;
  if (originalDamageGemTarget) mock.cardSystem.damageGemTarget = originalDamageGemTarget;
  traceCombat(
    gs,
    `${gs.playerHealth > 0 ? 'cleared' : 'died'} floor ${floor}; HP ${Math.ceil(gs.playerHealth)}, AP ${gs.actionsLeft}`,
  );
  mock._lastCombatTrace = gs._combatTrace.slice();
  gs._combatTrace = null;

  // Floor-clear reward (mirrors GameScene.onEnemiesCleared): coins are paid once
  // per non-boss floor on clear, NOT per enemy kill (that faucet was removed).
  // Boss floors pay nothing here — they have their own reward room (see
  // runBossReward). Formula flattened from 20+floor*3 (act 1 was coin-starved
  // while acts 2-3 hoarded 500-750 unspent) — keep in sync with GameScene.
  const isBossFloor = floor === 15 || floor === 30 || floor === 45;
  if (gs.playerHealth > 0 && !isBossFloor) {
    gs.coins += mock.amuletManager.modifyGoldFound(Math.floor(24 + floor * 1.2));
  }
  if (gs.playerHealth > 0) markCompanionCombatSurvived(inv);
  return { bossName, cleared: gs.playerHealth > 0 };
}

function companionsIn(inv) {
  return (inv || []).filter((card) => card?.type === 'companion');
}

function upgradeCompanionsForNextAct(inv, nextAct) {
  if (nextAct < 2 || nextAct > 3) return 0;
  const companions = companionsIn(inv);
  for (const companion of companions) {
    companion.attack = Math.max(0, Number(companion.attack) || 0) + 1;
    companion.actUpgrades = (Number(companion.actUpgrades) || 0) + 1;
  }
  return companions.length;
}

function markCompanionCombatSurvived(inv) {
  for (const companion of companionsIn(inv)) {
    companion._simRoomsFought = (Number(companion._simRoomsFought) || 0) + 1;
  }
}

function trainCompanion(companion) {
  if (!companion || companion.trained) return false;
  if (companion.id === 'chickCompanion') {
    companion.name = 'Storm Hatchling';
    companion.shockChance = 0.20;
    companion.upgradedForm = 'stormHatchling';
  } else if (companion.id === 'skeletonWarriorCompanion') {
    companion.name = 'Slimebone Guard';
    companion.guardProtection = Math.max(1, Number(companion.guardProtection) || 0);
    companion.upgradedForm = 'slimeboneGuard';
  } else {
    companion.attack = Math.max(0, Number(companion.attack) || 0) + 1;
    companion.upgradedForm = 'trained';
  }
  companion.trained = true;
  return true;
}

function createLuckyCloverPickup() {
  return {
    type: 'amuletPickup',
    id: 'luckyCloverPickup',
    amuletId: 'luckyClover',
    name: 'Lucky Clover',
    rarity: 'rare',
    sprite: 'relicsOthers',
    spriteFrame: 69,
    description: '+3% crit chance',
  };
}

function equipAmuletPickups(mock, inv) {
  for (let i = inv.length - 1; i >= 0; i--) {
    const card = inv[i];
    if (card?.type !== 'amuletPickup' || !card.amuletId) continue;
    if (mock.amuletManager.addAmulet(card.amuletId)) {
      inv[i] = null;
      syncInventoryState(mock.gameState, inv);
    }
  }
}

function buyLuckyClover(mock, gs, inv) {
  if (gs.coins < 1) return false;
  gs.coins -= 1;
  const pickup = createLuckyCloverPickup();
  if (tryCarry(gs, inv, pickup, { eventReward: true })) {
    equipAmuletPickups(mock, inv);
  } else {
    // Live game falls back to direct equip when the bag is full, so the coin is
    // never wasted.
    mock.amuletManager.addAmulet('luckyClover');
  }
  return true;
}

function hasHolographicOmen(inv) {
  return (inv || []).some((item) => item?.id === 'holographicOmen' || item?.passiveEffect === 'holographicOmen');
}

function applyHolographicOmenStartEffect(mock, gs, inv) {
  if (!hasHolographicOmen(inv)) return;
  const board = mock.cardSystem.boardCards || [];
  const revealedEnemies = board
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card?.revealed && mock.isEnemyCard(card) && card.data.health > 0);
  if (!revealedEnemies.length) return;

  for (const { card, index } of revealedEnemies) {
    const roll = Math.floor(Math.random() * 4);
    if (roll === 0) {
      card.data.frozen = Math.max(card.data.frozen || 0, 1);
    } else if (roll === 1) {
      mock.cardSystem.applyWeaponPoison?.(card, { poisonDamage: 1, poisonTurns: 3 });
    } else if (roll === 2) {
      mock.cardSystem.burnEnemy?.(index, 1);
    } else {
      mock.cardSystem.applyShockStatus?.(card, 1);
    }
  }

  if (Math.random() < 0.10) {
    gs.actionsLeft = Math.max(0, (gs.actionsLeft || 0) - 2);
  }
}

// Mirrors GameScene.setupBossRewardRoom (previously unmodeled, which made the
// sim pessimistic right after each act boss): full HP/AP restore, a scaling
// currency payout, and three reward cards — an amulet, a boss-quality
// weapon/armor (rarity capped per act), and a socket gem.
function runBossReward(mock, gs, inv, floor) {
  const gen = mock.cardSystem.cardDataGenerator;
  gs.playerHealth = gs.maxHealth;
  gs.actionsLeft = gs.maxActions;
  gs.coins += 25 + floor;
  gs.crystals += 4 + Math.floor(floor / 6);

  const amulet = mock.cardSystem.createCardData('amulet', floor, false, gs, 'boss');
  grantAmuletFromOffer(mock, amulet, { allowCursed: true });
  const rawQuality = floor >= 31 ? 'legendary' : floor >= 16 ? 'epic' : 'rare';
  const quality = gen.capRewardRarity ? gen.capRewardRarity(rawQuality, floor) : rawQuality;
  const item = mock.cardSystem.createCardData(Math.random() < 0.5 ? 'weapon' : 'armor', floor, false, null, quality);
  if (item?.type === 'weapon' && gs._lootStats) recordWeapon(gs._lootStats, floor, item, 'boss_reward');
  if (item) tryCarry(gs, inv, item, { eventReward: true });
  // (Not counted in _gemsSeen — that metric tracks floor drops only.)
  const gem = mock.cardSystem.createCardData('gem', floor);
  if (gem) tryCarry(gs, inv, gem, { eventReward: true });
  regear(gen, gs, inv);
}

// ── Station rooms (approximate economy) ───────────────────────────────────
function runRest(gs) {
  // Mirrors RestScene exactly: flat +20 HP (NOT a % of max — the sim used to
  // heal ~30% of maxHP here, which overstated rests by ~50%) + full AP refill.
  gs.playerHealth = Math.min(gs.maxHealth, gs.playerHealth + 20);
  gs.actionsLeft = gs.maxActions;
}

// Calibrated against the REAL EventScene story webs (audited choice-by-choice):
// a run's event visits walk the early story chain first (music box -> bird nest
// -> goblin engineer, ~4 visits of small coins/heal/one slot), then draw from a
// pool of ONE-TIME bonus rooms (the
// amulet rooms, book worm, briar enhancement, the well, the mirror), and once
// those are exhausted every further visit is the quiet_crossroads fallback
// (+10 coins OR +5 HP). Events do NOT grant floor-scaled gear, and amulets
// only come from the finite bonus rooms — the old model's perpetual 45%
// amulet / 25% epic-gear rolls badly overstated event power.
function runEventLegacy(mock, gs, inv, floor) {
  const cs = mock.cardSystem;
  const st = mock._eventState || (mock._eventState = { story: 0, bonus: [] });

  // 1) Early story chain (music box → bird nest → goblin engineer).
  if (st.story === 0) { st.story++; gs.coins += 18; gs.crystals += 1; return; }
  if (st.story === 1) {
    st.story++;
    // Bird nest raid: sim keeps a small heal stand-in (live game is a timed
    // overlay; timeout punishment is still TBD).
    gs.playerHealth = Math.min(gs.maxHealth, gs.playerHealth + 8);
    return;
  }
  if (st.story === 2) {
    st.story++;
    gs.coins += 12;
    gs.playerHealth = Math.min(gs.maxHealth, gs.playerHealth + 6);
    return;
  }
  if (st.story === 3) {
    st.story++;
    // Goblin engineer: 50% music-box repair → +1 inventory slot, else consolation.
    if (Math.random() < 0.5) gs.bonusInventorySlots = (gs.bonusInventorySlots || 0) + 1;
    else { gs.coins += 12; gs.crystals += 1; }
    return;
  }

  // 2) One-time bonus rooms, drawn in random order until the pool is dry.
  const POOL = ['fairy_room', 'slimy_prison', 'book_worm', 'briar_room', 'well', 'mirror'];
  const remaining = POOL.filter((id) => !st.bonus.includes(id));
  if (remaining.length) {
    const id = remaining[Math.floor(Math.random() * remaining.length)];
    st.bonus.push(id);
    const gainAmulet = () => {
      grantAmuletFromOffer(mock, cs.createCardData('amulet', floor, false, gs), { allowCursed: false });
    };
    switch (id) {
      case 'fairy_room': // too_nice_room: confront the fairy → random amulet
        gainAmulet();
        break;
      case 'slimy_prison': // grab the floating amulet: -8 HP for it
        gs.takeDamage(8, -1, 'event');
        if (gs.playerHealth > 0) gainAmulet();
        break;
      case 'book_worm': // free (specific) amulet
        gainAmulet();
        break;
      case 'briar_room': // enhance a carried weapon: +1 damage
        if (gs.equippedWeapon) gs.equippedWeapon.damage += 1;
        break;
      case 'well': // drop a crystal in → net +3 crystals
        gs.crystals += 3;
        break;
      case 'mirror': // copy one card — merge fodder for the equipped weapon
        if (gs.equippedWeapon) tryCarry(gs, inv, { ...gs.equippedWeapon }, { eventReward: true });
        break;
    }
    return;
  }

  // 3) quiet_crossroads fallback, repeatable: +10 coins, or +5 HP when hurting.
  if (gs.playerHealth < gs.maxHealth * 0.6) {
    gs.playerHealth = Math.min(gs.maxHealth, gs.playerHealth + 5);
  } else {
    gs.coins += 10;
  }
}

function createHolographicOmenCard() {
  return {
    id: 'holographicOmen',
    type: 'passive',
    name: 'Holographic Omen',
    rarity: 'rare',
    passiveEffect: 'holographicOmen',
  };
}

function createRespectableCarnivalCard(gen, gs, floor) {
  const types = ['weapon', 'armor', 'thorns', 'potion', 'food', 'magic'];
  let type = types[Math.floor(Math.random() * types.length)];
  const rarityRoll = Math.random();
  const rarity = rarityRoll < 0.12 ? 'rare' : rarityRoll < 0.42 ? 'uncommon' : 'common';
  for (let tries = 0; tries < 8; tries++) {
    const targetRarity = ['weapon', 'armor', 'thorns'].includes(type) ? rarity : null;
    const card = gen.createCardData(type, floor, false, gs, targetRarity);
    if (card) {
      card.carnivalTouched = true;
      return card;
    }
    type = types[Math.floor(Math.random() * types.length)];
  }
  const fallback = gen.createCardData('potion', floor);
  if (fallback) fallback.carnivalTouched = true;
  return fallback;
}

function createSameTypeRerollCard(gen, gs, oldCard, floor) {
  const type = oldCard?.type;
  const rarity = oldCard?.rarity || 'common';
  const targetRarity = ['weapon', 'armor', 'thorns'].includes(type) ? rarity : null;
  for (let tries = 0; tries < 12; tries++) {
    const card = gen.createCardData(type, floor, false, gs, targetRarity);
    if (!card) continue;
    if (oldCard?.rarity && card.rarity && card.rarity !== oldCard.rarity) continue;
    if ((card.name || card.id) === (oldCard.name || oldCard.id) && tries < 8) continue;
    card.carnivalTouched = true;
    return card;
  }
  return createRespectableCarnivalCard(gen, gs, floor);
}

function isBrassWizardRerollable(card) {
  return Boolean(
    card
    && card.type !== 'junk'
    && card.type !== 'companion'
    && card.id !== 'monsterEgg'
    && card.type !== 'amuletPickup'
  );
}

function runBrassWizard(mock, gs, inv, floor, story) {
  story.pendingBrassWizard = false;
  story.brassWizardSeen = true;
  story.carnivalVisited = true;
  story.seen.add('brass_wizard');
  if (gs.coins < 1) return; // live player can leave the booth.
  gs.coins -= 1;

  const gen = mock.cardSystem.cardDataGenerator;
  const roll = Math.random();
  if (roll < 0.25) return; // no reward

  if (roll < 0.55) {
    tryCarry(gs, inv, createRespectableCarnivalCard(gen, gs, floor), { eventReward: true });
    return;
  }

  if (roll < 0.80) {
    const junkIndex = inv.findIndex((card) => card?.type === 'junk' && card.carnivalToken);
    if (junkIndex >= 0) {
      inv[junkIndex] = null;
      syncInventoryState(gs, inv);
      tryCarry(gs, inv, createHolographicOmenCard(), { eventReward: true });
      return;
    }
    const reroll = inv
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => isBrassWizardRerollable(card))
      .sort((a, b) => cardKeepScore(a.card) - cardKeepScore(b.card))[0];
    if (reroll) {
      const replacement = createSameTypeRerollCard(gen, gs, reroll.card, floor);
      if (replacement) {
        inv[reroll.index] = replacement;
        syncInventoryState(gs, inv);
      }
    }
    return;
  }

  mock.amuletManager.addAmulet('fortuneCard');
}

// Mirrors the current EventScene selection order and makes the strongest
// available choice. Story rewards that require a card slot reserve that slot
// before ordinary loot can fill it.
function runEvent(mock, gs, inv, floor) {
  const gen = mock.cardSystem.cardDataGenerator;
  const story = gs._simStory || (gs._simStory = {
    stage: 'music_box', seen: new Set(), reserveRewardSlot: false,
    hasEgg: false, hasChick: false, carnivalVisited: false, brassWizardSeen: false,
    pendingBrassWizard: false,
  });
  const gainAmulet = (id = null) => {
    if (id) {
      mock.amuletManager.addAmulet(id);
      return;
    }
    grantAmuletFromOffer(mock, gen.createCardData('amulet', floor, false, gs), { allowCursed: false });
  };

  if (story.stage === 'music_box') {
    // Leaving is still the safe opener: no HP, no crystal, the box follows.
    // Force-open is a lock-wafer minigame (charge pair detonates).
    story.stage = 'bird_nest';
    story.reserveRewardSlot = true;
    return;
  }
  if (story.stage === 'bird_nest') {
    // The egg becomes a companion later, so reserve and use one real bag slot.
    const egg = { type: 'quest', id: 'monsterEgg', name: 'Egg' };
    const healthyEnough = gs.playerHealth >= gs.maxHealth * 0.8
      && (!gs.equippedArmor || gs.equippedArmor.durability > 2);
    if (healthyEnough && tryCarry(gs, inv, egg, { eventReward: true })) {
      story.hasEgg = true;
      gs.playerHealth = Math.max(0, gs.playerHealth - 20);
      if (gs.equippedArmor) gs.equippedArmor.durability = Math.max(0, gs.equippedArmor.durability - 1);
    }
    story.reserveRewardSlot = false;
    story.stage = 'engineer';
    return;
  }
  if (story.stage === 'engineer') {
    // A guaranteed Latchbox is worth its 30 coins: it pays back a permanent
    // slot and enables the egg to hatch. If poor, use a spare card for 80%.
    let repaired = false;
    if (gs.coins >= 30) {
      gs.coins -= 30;
      repaired = true;
    } else {
      const sacrifice = inv
        .map((card, index) => ({ card, index }))
        .filter(({ card }) => card && cardKeepScore(card) < 220)
        .sort((a, b) => cardKeepScore(a.card) - cardKeepScore(b.card))[0];
      if (sacrifice) {
        inv[sacrifice.index] = null;
        syncInventoryState(gs, inv);
        repaired = Math.random() < 0.8;
      }
    }
    if (repaired) gs.scene.inventorySystem.expandInventory(1);
    else { gs.coins += 12; gs.crystals += 1; }
    story.stage = story.hasEgg && repaired ? 'hatch_egg' : 'bonus';
    return;
  }
  if (story.stage === 'hatch_egg') {
    const eggIndex = inv.findIndex((card) => card?.id === 'monsterEgg');
    if (eggIndex >= 0) {
      inv[eggIndex] = gen.createChickCompanionCard();
      story.hasChick = true;
      gs.heroMemory = gs.heroMemory || {};
      gs.heroMemory.chickRareShopUnlocked = true;
    }
    story.stage = 'bonus';
    return;
  }

  if (story.pendingBrassWizard && !story.brassWizardSeen) {
    runBrassWizard(mock, gs, inv, floor, story);
    return;
  }

  const choices = ['too_nice_room', 'almost_you_well', 'slimy_prison', 'book_worm', 'briar_room', 'mirror'];
  if (!story.carnivalVisited) choices.push('something_wicked');
  if (story.carnivalVisited && !story.brassWizardSeen) choices.push('brass_wizard');
  if (companionsIn(inv).some((c) => (Number(c._simRoomsFought) || 0) >= 3 && !c.trained)) choices.push('old_drill_room');
  const remaining = choices.filter((id) => !story.seen.has(id));
  if (!remaining.length) {
    if (gs.playerHealth < gs.maxHealth * 0.6) gs.playerHealth = Math.min(gs.maxHealth, gs.playerHealth + 5);
    else gs.coins += 10;
    return;
  }
  const id = remaining[Math.floor(Math.random() * remaining.length)];
  story.seen.add(id);
  switch (id) {
    case 'too_nice_room': gainAmulet(); break; // inspect, then confront the fairy
    case 'almost_you_well':
      if (gs.crystals >= 1) gs.crystals += 3; // spend 1, receive 4
      else gainAmulet();
      break;
    case 'slimy_prison': {
      const companion = gen.createSkeletonWarriorCompanionCard();
      gs.playerHealth = Math.max(0, gs.playerHealth - 10);
      if (tryCarry(gs, inv, companion, { eventReward: true })) {
        gs.heroMemory = gs.heroMemory || {};
        gs.heroMemory.skeletonRareShopUnlocked = true;
      }
      break;
    }
    case 'book_worm': {
      const magicIndex = inv.findIndex((card) => card?.type === 'magic');
      if (magicIndex >= 0) { inv[magicIndex] = null; syncInventoryState(gs, inv); gainAmulet('mothWingDust'); }
      else gainAmulet('wormVenomCharm');
      break;
    }
    case 'briar_room': {
      const fireball = inv.findIndex((card) => card?.type === 'magic' && card.magicType === 'fireball');
      if (fireball >= 0) { inv[fireball] = null; syncInventoryState(gs, inv); gainAmulet(); }
      else {
        const weapon = bestEventWeapon(gs, inv);
        if (weapon) {
          weapon.damage = (weapon.damage || 0) + 1;
          weapon.briarDamageBonus = (weapon.briarDamageBonus || 0) + 1;
        }
      }
      break;
    }
    case 'mirror': {
      const copy = bestEventWeapon(gs, inv);
      if (copy && tryCarry(gs, inv, { ...copy }, { eventReward: true })) regear(gen, gs, inv);
      break;
    }
    case 'something_wicked':
      story.carnivalVisited = true;
      story.pendingBrassWizard = true;
      if (gs.coins >= 1) buyLuckyClover(mock, gs, inv);
      else gs.playerHealth = Math.max(1, gs.playerHealth - 3);
      break;
    case 'brass_wizard': {
      runBrassWizard(mock, gs, inv, floor, story);
      break;
    }
    case 'old_drill_room': {
      const companion = companionsIn(inv)
        .filter((card) => (Number(card._simRoomsFought) || 0) >= 3 && !card.trained)
        .sort((a, b) => (b.attack || 0) - (a.attack || 0))[0];
      if (companion) trainCompanion(companion);
      break;
    }
  }
}

function shopPrice(item, floor) {
  return shopItemBuyPrice(item, floor);
}

// ShopScene.calculateItemPrice mirror used by the affordability probe.
function realRegularShopPrice(item) {
  return shopPrice(item, item._priceFloor);
}

// Exact mirror of RareShopScene's fixed per-slot price formulas.
function realRareShopPrices(floor) {
  return [20 + floor * 5, 25 + floor * 5, 15 + floor * 4, 18 + floor * 4];
}

// Probe: "if the player walked into this shop RIGHT NOW with their current
// coins, how many of the coin-priced items could they afford?" (cheapest-first,
// i.e. best case). Uses REAL pricing formulas, independent of the bot's own
// buying heuristics in runShop, so it measures the economy, not the bot's taste.
function probeShopAffordability(mock, gs, floor, roomType, metrics) {
  const cs = mock.cardSystem;
  let prices;
  if (roomType === 'RARE_SHOP') {
    prices = realRareShopPrices(floor);
  } else {
    const offers = [
      cs.createCardData('potion', floor),
      cs.createCardData('weapon', floor),
      cs.createCardData('armor', floor),
      cs.createCardData('thorns', floor),
      cs.createCardData('magic', floor),
      cs.createCardData(['weapon', 'weapon', 'weapon', 'magic', 'potion', 'thorns', 'armor', 'food'][Math.floor(Math.random() * 8)], floor),
    ].filter(Boolean);
    prices = offers.map((item) => { item._priceFloor = floor; return realRegularShopPrice(item); });
  }
  prices.sort((a, b) => a - b);
  let affordable = 0, spend = gs.coins;
  for (const p of prices) { if (spend >= p) { affordable++; spend -= p; } }
  const act = floor <= 15 ? 1 : floor <= 30 ? 2 : 3;
  const bucket = roomType === 'RARE_SHOP' ? metrics.rareShopAfford : metrics.shopAfford;
  bucket.count++;
  bucket.affordable += affordable;
  bucket.total += prices.length;
  bucket.byAct[act].count++;
  bucket.byAct[act].affordable += affordable;
}

function totalRecordedMerges(gs) {
  const counts = gs._mergeTracker?.mergeCounts;
  if (!counts) return 0;
  return Object.values(counts).reduce((sum, count) => sum + (Number(count) || 0), 0);
}

function shopPlanningMetrics(gs) {
  return gs._simMetrics?.shopPlanning || null;
}

// A live shop is a safe inventory station. Players can drink/eat, socket gems,
// and merge repeatedly without spending an action or waking enemies. Do those
// space-making operations before evaluating shelves, and again after each buy.
function prepareShopInventory(mock, gs, inv, { mergeFirst = false } = {}) {
  const metrics = shopPlanningMetrics(gs);
  const occupiedBefore = countInventoryItems(inv);
  const mergesBefore = totalRecordedMerges(gs);
  const gen = mock.cardSystem.cardDataGenerator;

  if (metrics) metrics.prepPasses++;
  if (mergeFirst) regear(gen, gs, inv);

  while (gs.playerHealth < gs.maxHealth) {
    const potions = inv
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => card?.type === 'potion');
    if (!potions.length) break;

    const hpPct = gs.maxHealth > 0 ? gs.playerHealth / gs.maxHealth : 1;
    const preserveLastPrep = isBossPrepObjectiveActive(gs)
      && bossPrepItems(inv).length <= 1
      && hpPct > CURRENT_BEHAVIOR.thresholds.bossPrepReserveEmergencyHpPct;
    if (preserveLastPrep) break;

    const missing = gs.maxHealth - gs.playerHealth;
    potions.sort((a, b) => (a.card.healAmount || 0) - (b.card.healAmount || 0));
    const pick = potions.find(({ card }) => (card.healAmount || 0) >= missing)
      || potions[potions.length - 1];
    if (!usePotionCard(mock, gs, pick.card, true)) break;
    removeInventoryCard(gs, inv, pick.index);
    if (metrics) metrics.potionsUsed++;
  }

  while (gs.actionsLeft < gs.maxActions) {
    const foods = inv
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => card?.type === 'food' && card.id !== 'monsterEgg');
    if (!foods.length) break;
    const missing = gs.maxActions - gs.actionsLeft;
    const modifiedGain = ({ card }) => (
      mock.amuletManager?.modifyFoodAP?.(card.actionAmount || 0) ?? (card.actionAmount || 0)
    );
    foods.sort((a, b) => modifiedGain(a) - modifiedGain(b));
    const pick = foods.find((entry) => modifiedGain(entry) >= missing)
      || foods[foods.length - 1];
    gs.actionsLeft = Math.min(gs.maxActions, gs.actionsLeft + modifiedGain(pick));
    removeInventoryCard(gs, inv, pick.index);
    if (metrics) metrics.foodUsed++;
  }

  const gemsBefore = invItems(inv).filter((card) => card.type === 'gem').length;
  socketGems(gs, inv, {
    boss: isBossPrepObjectiveActive(gs),
    ranged: false,
    hiddenCluster: false,
  });
  const gemsAfter = invItems(inv).filter((card) => card.type === 'gem').length;
  if (metrics) metrics.gemsSocketed += Math.max(0, gemsBefore - gemsAfter);

  regear(gen, gs, inv);
  const mergesAfter = totalRecordedMerges(gs);
  const occupiedAfter = countInventoryItems(inv);
  if (metrics) {
    metrics.prepMerges += Math.max(0, mergesAfter - mergesBefore);
    metrics.slotsFreed += Math.max(0, occupiedBefore - occupiedAfter);
  }
}

function shopOfferBoard(offers) {
  return offers
    .filter((offer) => !offer.purchased && offer.data)
    .map((offer) => ({ revealed: true, data: offer.data }));
}

function shopOfferIntent(gs, inv, offer, offers) {
  const item = offer.data;
  const board = shopOfferBoard(offers);
  const mergePlan = mergeOpportunity(item, gs, inv, board);
  const value = strategicInventoryScore(item, gs, inv, {
    incoming: true,
    visibleBoard: board,
  });
  const prepActive = isBossPrepObjectiveActive(gs);
  const matchingHeld = invItems(inv).some((card) => (
    mergeFamilyKey(card)
    && mergeFamilyKey(card) === mergeFamilyKey(item)
    && card.rarity === item.rarity
  ));
  const armorLow = !gs.equippedArmor
    || gs.equippedArmor.durability < (gs.equippedArmor.maxDurability || 1) * 0.5;
  let wanted = mergePlan.bonus > 0;

  if (item.type === 'weapon') {
    wanted ||= (
      (item.weaponType !== 'dagger' || isUsefulDaggerPickup(gs, inv, item))
      && (
        matchingHeld
        || (item.damage || 0) > (gs.equippedWeapon?.damage || 0)
        || isUsefulBowUpgrade(gs, inv, item)
        || effectiveWeaponReservePips(gs, inv) < weaponPipReserveTarget(gs.currentFloor || 1)
      )
    );
  } else if (item.type === 'armor') {
    wanted ||= matchingHeld
      || armorScore(item) > armorScore(gs.equippedArmor)
      || armorLow
      || gs.coins > offer.price * 3;
  } else if (item.type === 'thorns') {
    wanted ||= matchingHeld || !gs.activeThorns;
  } else if (item.type === 'potion') {
    wanted ||= gs.playerHealth < gs.maxHealth || prepActive;
  } else if (item.type === 'food') {
    wanted ||= gs.actionsLeft < gs.maxActions;
  } else if (item.type === 'magic') {
    // Outside boss preparation, useful combat spells are valid purchases when
    // there is natural room. Other magic stays intentionally low priority.
    wanted ||= (prepActive && isBossPrepCard(item))
      || (
        firstEmptySlot(inv) >= 0
        && ['restoration', 'soulDrain', 'frostRing', 'fireball'].includes(item.magicType)
      );
  } else if (item.type === 'gem' || item.type === 'companion') {
    wanted = true;
  }

  if (prepActive && isBossPrepCard(item)) {
    const alreadyPrepared = bossPrepItems(inv).some((card) => (
      (item.type === 'potion' && card.type === 'potion')
      || (item.type === 'magic' && card.magicType === item.magicType)
    ));
    if (!alreadyPrepared || matchingHeld) wanted = true;
  }

  return { wanted, value, mergePlan };
}

function shopSaleCandidate(gs, inv, incoming, offers) {
  const board = shopOfferBoard(offers);
  const incomingFamily = mergeFamilyKey(incoming);
  const candidates = [];
  for (let index = 0; index < inv.length; index++) {
    const card = inv[index];
    if (!card || card.type === 'companion' || card.id === 'monsterEgg') continue;
    if (
      incomingFamily
      && mergeFamilyKey(card) === incomingFamily
      && card.rarity === incoming.rarity
    ) {
      continue;
    }
    if (
      isBossPrepObjectiveActive(gs)
      && isBossPrepCard(card)
      && bossPrepItems(inv).length <= 1
    ) {
      continue;
    }
    if (card.type === 'weapon') {
      const remaining = uniqueUsableWeapons(gs, inv).filter((weapon) => weapon !== card);
      if (!remaining.length) continue;
      if (
        card.weaponType === 'bow'
        && !remaining.some((weapon) => weapon.weaponType === 'bow')
      ) {
        continue;
      }
      if (
        incoming.type !== 'weapon'
        && effectiveWeaponPipsForList(remaining) < weaponPipReserveTarget(gs.currentFloor || 1)
      ) {
        continue;
      }
    }
    candidates.push({
      card,
      index,
      score: strategicInventoryScore(card, gs, inv, { visibleBoard: board }),
    });
  }
  candidates.sort((a, b) => a.score - b.score);
  return candidates[0] || null;
}

function sellShopCard(gs, inv, candidate, floor) {
  if (!candidate) return 0;
  const value = shopItemSellPrice(candidate.card, floor);
  if (gs.equippedWeapon === candidate.card) gs.equippedWeapon = null;
  if (gs.equippedArmor === candidate.card) gs.equippedArmor = null;
  if (gs.activeThorns === candidate.card) gs.activeThorns = null;
  inv[candidate.index] = null;
  gs.coins += value;
  syncInventoryState(gs, inv);
  const metrics = shopPlanningMetrics(gs);
  if (metrics) {
    metrics.sales++;
    metrics.saleCoins += value;
  }
  return value;
}

function isMaterialShopReplacement(gs, inv, item, mergePlan) {
  if (mergePlan.tierGain > 0 || mergePlan.extraMerges > 1) return true;
  if (item.type === 'companion') return true;
  if (item.type === 'weapon') {
    if (isUsefulBowUpgrade(gs, inv, item) && !hasUsableBow(gs, inv)) return true;
    return (item.damage || 0) >= (gs.equippedWeapon?.damage || 0) + 2;
  }
  if (item.type === 'armor') {
    return armorScore(item) >= armorScore(gs.equippedArmor) + 2;
  }
  if (isBossPrepObjectiveActive(gs) && isBossPrepCard(item)) {
    return !bossPrepItems(inv).some((card) => (
      (item.type === 'potion' && card.type === 'potion')
      || (item.type === 'magic' && card.magicType === item.magicType)
    ));
  }
  if (item.type === 'potion') return gs.playerHealth < gs.maxHealth * 0.5;
  if (item.type === 'food') return gs.actionsLeft <= 0;
  return false;
}

function runCoinShopPlanner(mock, gs, inv, floor, offers, { allowSelling = false } = {}) {
  prepareShopInventory(mock, gs, inv);
  let guard = 0;
  while (guard++ < offers.length + 2) {
    const remaining = offers.filter((offer) => !offer.purchased && offer.currency === 'coins');
    if (!remaining.length) break;

    const ranked = remaining
      .map((offer) => ({ offer, ...shopOfferIntent(gs, inv, offer, remaining) }))
      .filter((entry) => entry.wanted)
      .sort((a, b) => (
        b.mergePlan.tierGain - a.mergePlan.tierGain
        || b.mergePlan.extraMerges - a.mergePlan.extraMerges
        || b.value - a.value
        || a.offer.price - b.offer.price
      ));
    let acted = false;

    for (const entry of ranked) {
      const { offer, value, mergePlan } = entry;
      let sale = null;
      if (firstEmptySlot(inv) < 0 || gs.coins < offer.price) {
        if (!allowSelling) continue;
        sale = shopSaleCandidate(gs, inv, offer.data, remaining);
        if (!sale || gs.coins + shopItemSellPrice(sale.card, floor) < offer.price) continue;
        const clearUpgrade = value >= sale.score + 180
          || mergePlan.tierGain > 0
          || mergePlan.extraMerges > 1;
        if (!clearUpgrade || !isMaterialShopReplacement(gs, inv, offer.data, mergePlan)) {
          continue;
        }
      }

      if (sale) sellShopCard(gs, inv, sale, floor);
      const slot = firstEmptySlot(inv);
      if (slot < 0 || gs.coins < offer.price) continue;

      const mergesBefore = totalRecordedMerges(gs);
      inv[slot] = offer.data;
      syncInventoryState(gs, inv);
      mock.amuletManager?.processCardReward?.(offer.data);
      gs.coins -= offer.price;
      offer.purchased = true;
      const metrics = shopPlanningMetrics(gs);
      if (metrics) {
        metrics.purchases++;
        metrics.purchasesByType[offer.data.type] =
          (metrics.purchasesByType[offer.data.type] || 0) + 1;
      }

      // A bought card is first merged into the current line, then any resulting
      // potion/food/gem can be consumed/socketed to free the slot for another buy.
      prepareShopInventory(mock, gs, inv, { mergeFirst: true });
      if (metrics && totalRecordedMerges(gs) > mergesBefore) metrics.cascadePurchases++;
      acted = true;
      break;
    }
    if (!acted) break;
  }
}

function runShop(mock, gs, inv, floor) {
  const cs = mock.cardSystem;
  const metrics = shopPlanningMetrics(gs);
  if (metrics) metrics.regularVisits++;
  // Match ShopScene's six coin-priced shelves.
  const duplicateTypes = ['weapon', 'weapon', 'weapon', 'magic', 'potion', 'thorns', 'armor', 'food'];
  const duplicateType = duplicateTypes[Math.floor(Math.random() * duplicateTypes.length)];
  const offers = [
    cs.createCardData('potion', floor),
    cs.createCardData('weapon', floor),
    cs.createCardData('armor', floor, false, gs),
    cs.createCardData('thorns', floor),
    cs.createCardData('magic', floor),
    cs.createCardData(duplicateType, floor),
  ].filter(Boolean).map((data) => ({
    data,
    price: shopPrice(data, floor),
    currency: 'coins',
    purchased: false,
  }));
  // Generate these in the same order as ShopScene: the amulet shelf is rolled
  // before Merchant's Seal adds its upgraded weapon/armor shelves.
  const amulet = cs.createCardData('amulet', floor, false, gs, 'shop');
  const bonusSlots = mock.amuletManager?.getBonusShopSlots?.() || 0;
  for (let i = 0; i < bonusSlots; i++) {
    const quality = floor >= 15 ? 'rare' : 'uncommon';
    const type = Math.random() < 0.5 ? 'weapon' : 'armor';
    let data = cs.createCardData(type, floor, false, null, quality);
    if (
      data
      && (data.weaponType === 'axe' || data.armorType === 'plate')
      && (data.rarity === 'epic' || data.rarity === 'legendary')
    ) {
      data = cs.createCardData(type, floor, false, null, 'rare');
    }
    if (data) {
      offers.push({
        data,
        price: shopPrice(data, floor),
        currency: 'coins',
        purchased: false,
      });
    }
  }
  if (gs._lootStats) {
    for (const { data: item } of offers) {
      if (item?.type === 'weapon') recordWeapon(gs._lootStats, floor, item, 'shop');
    }
  }

  runCoinShopPlanner(mock, gs, inv, floor, offers, { allowSelling: true });

  // Always buy an amulet offer if we can afford the rolled rarity.
  if (amulet) {
    const price = Math.max(1, ({ common: 2, uncommon: 3, rare: 4, legendary: 6 }[amulet.rarity] || 2)
      + Math.floor((gs.activeAmulets?.length || 0) / 3));
    if (gs.crystals >= price && grantAmuletFromOffer(mock, amulet, { allowCursed: false })) {
      gs.crystals -= price;
    }
  }

  regear(mock.cardSystem.cardDataGenerator, gs, inv);
}

function alreadyHasCompanion(inv, id) {
  return (inv || []).some((item) => item?.id === id);
}

function createRareShopOffers(mock, gs, inv, floor) {
  const cs = mock.cardSystem;
  const gen = cs.cardDataGenerator;
  const offers = [];
  const amulet = cs.createCardData('amulet', floor, false, gs, 'rare_shop');
  const baseAmuletPrice = Math.max(2, Math.floor(floor / 10) + 2);
  let amuletPrice = baseAmuletPrice;
  if (amulet) {
    const rarityMult = { uncommon: 1.5, rare: 2, legendary: 3 }[amulet.rarity] || 2;
    amuletPrice = Math.max(2, Math.floor(baseAmuletPrice * rarityMult));
    offers.push({ data: amulet, price: amuletPrice, currency: 'crystals' });
  }

  offers.push({ data: cs.createCardData('weapon', floor, false, null, gen.capRewardRarity('uncommon', floor)), price: 20 + floor * 5, currency: 'coins' });
  offers.push({ data: cs.createCardData('armor', floor, false, null, gen.capRewardRarity('uncommon', floor)), price: 25 + floor * 5, currency: 'coins' });
  offers.push({ data: cs.createCardData('thorns', floor, false, null, gen.capRewardRarity('rare', floor)), price: 15 + floor * 4, currency: 'coins' });
  offers.push({ data: cs.createCardData('gem', floor), price: 18 + floor * 4, currency: 'coins' });

  const heroMemory = gs.heroMemory || {};
  if (heroMemory.chickRareShopUnlocked && !alreadyHasCompanion(inv, 'chickCompanion') && Math.random() < 0.35) {
    offers.push({ data: gen.createChickCompanionCard(), price: amuletPrice + 1, currency: 'crystals' });
  }
  if (heroMemory.skeletonRareShopUnlocked && !alreadyHasCompanion(inv, 'skeletonWarriorCompanion') && Math.random() < 0.35) {
    offers.push({ data: gen.createSkeletonWarriorCompanionCard(), price: amuletPrice + 1, currency: 'crystals' });
  }

  return offers.filter((offer) => offer.data);
}

function runPostActShop(mock, gs, inv, floor, metrics) {
  const roomType = Math.random() < 0.35 ? 'RARE_SHOP' : 'SHOP';
  gs.currentFloor = floor;
  gs.roomType = roomType;
  const hpStart = gs.playerHealth;
  if (gs._lootStats) recordFloorInventoryStart(gs._lootStats, floor, gs, inv);
  if (gs._statsRecorder) {
    gs._statsRecorder.beginFloorVisit(floor, roomType, hpStart, gs.maxHealth);
    gs._statsRecorder.recordWeapons('start', gs, inv);
  }
  probeShopAffordability(mock, gs, floor, roomType, metrics);
  if (roomType === 'RARE_SHOP') runRareShop(mock, gs, inv, floor);
  else runShop(mock, gs, inv, floor);
  regear(mock.cardSystem.cardDataGenerator, gs, inv);
  if (gs._lootStats) {
    recordFloorInventoryEnd(gs._lootStats, floor, gs, inv);
    recordFloorSnapshot(gs._lootStats, floor, gs, inv, mock.cardSystem.boardCards);
  }
  if (gs._statsRecorder) {
    gs._statsRecorder.recordWeapons('end', gs, inv);
    gs._statsRecorder.finishFloorVisit(gs.playerHealth, gs.maxHealth, {
      apSpent: 0,
      hungryActions: 0,
    });
  }
  const m = metrics.floors[floor];
  m.reached++;
  m.hpStart += hpStart;
  m.hpEnd += Math.max(0, gs.playerHealth);
  m.hpLost += Math.max(0, hpStart - gs.playerHealth);
  m.coins += gs.coins;
  m.crystals += gs.crystals;
  m.weaponDmg += gs.equippedWeapon ? gs.equippedWeapon.damage : 0;
  m.armor += gs.equippedArmor ? gs.equippedArmor.protection : 0;
  m.maxHp += gs.maxHealth;
  return roomType;
}

function runRareShop(mock, gs, inv, floor) {
  const offers = createRareShopOffers(mock, gs, inv, floor);
  const metrics = shopPlanningMetrics(gs);
  if (metrics) metrics.rareVisits++;

  // RareShopScene has the same safe station inventory, but unlike ShopScene it
  // does not expose the sell-items mode.
  runCoinShopPlanner(mock, gs, inv, floor, offers, { allowSelling: false });

  for (const offer of offers.filter((entry) => entry.currency === 'crystals')) {
    const item = offer.data;
    if (gs.crystals < offer.price) continue;
    if (item.type === 'amulet') {
      if (grantAmuletFromOffer(mock, item, { allowCursed: false })) {
        gs.crystals -= offer.price;
      }
    } else if (item.type === 'companion') {
      prepareShopInventory(mock, gs, inv);
      const slot = firstEmptySlot(inv);
      if (slot < 0) continue;
      inv[slot] = item;
      syncInventoryState(gs, inv);
      mock.amuletManager?.processCardReward?.(item);
      gs.crystals -= offer.price;
      if (metrics) {
        metrics.purchases++;
        metrics.purchasesByType.companion =
          (metrics.purchasesByType.companion || 0) + 1;
      }
    }
  }
  regear(mock.cardSystem.cardDataGenerator, gs, inv);
}

function runTreasure(mock, gs, inv, floor, good) {
  // Mirrors TreasureScene.getRewardValues (opened-with-key tier, cut hard).
  if (good) { gs.coins += 12 + Math.floor(floor / 2); gs.crystals += 1 + Math.floor(floor / 12); }
  else { gs.coins += 8 + Math.floor(floor / 3); gs.crystals += 1 + Math.floor(floor / 14); }
  const item = mock.cardSystem.createCardData(Math.random() < 0.55 ? 'weapon' : 'armor', floor, false, null, good && floor >= 20 ? 'epic' : 'rare');
  if (item?.type === 'weapon' && gs._lootStats) recordWeapon(gs._lootStats, floor, item, 'treasure');
  if (item) tryCarry(gs, inv, item);
  regear(mock.cardSystem.cardDataGenerator, gs, inv);
}

// Blacksmith: repair every affordable damaged inventory/equipment card.
function runAnvil(gs, inv, metrics) {
  // Use the live station's partial increments: weapons/thorns repair one pip
  // per click (axes cost 4, others 2), while armor repairs five points for 2.
  const repairedItems = new Set();
  const repairOneStep = (item) => {
    const missing = Math.max(0, (item.maxDurability || 0) - (item.durability || 0));
    if (missing <= 0) return false;
    const amount = item.type === 'armor' ? Math.min(5, missing) : 1;
    const cost = item.type === 'armor'
      ? 2
      : (item.type === 'weapon' && item.weaponType === 'axe' ? 4 : 2);
    if (gs.coins < cost) return false;
    gs.coins -= cost;
    item.durability = Math.min(item.maxDurability, (item.durability || 0) + amount);
    metrics.repairCoins += cost;
    metrics.repairPips += amount;
    repairedItems.add(item);
    return true;
  };
  // Round-robin every damaged item so one expensive card cannot consume the
  // entire purse before the rest of the inventory receives repairs.
  const repairWeapons = uniqueUsableWeapons(gs, inv)
    .sort((a, b) => (
      Number((b.durability || 0) === 1) - Number((a.durability || 0) === 1)
      || weaponMergeCapitalUnits(b) - weaponMergeCapitalUnits(a)
      || ((b.maxDurability || 0) - (b.durability || 0))
        - ((a.maxDurability || 0) - (a.durability || 0))
    ));
  const repairables = [
    ...repairWeapons,
    ...invItems(inv).filter((item) => item?.type === 'armor' || item?.type === 'thorns'),
    gs.equippedArmor,
    gs.activeThorns,
  ].filter((item, index, all) => (
    item
    && item.maxDurability
    && (item.durability || 0) < item.maxDurability
    && all.indexOf(item) === index
  ));
  let repairedThisRound = true;
  while (repairedThisRound && gs.coins > 0) {
    repairedThisRound = false;
    for (const item of repairables) {
      if (repairOneStep(item)) repairedThisRound = true;
    }
  }
  metrics.repairActions += repairedItems.size;
}

// Choose the next map node, strongly preferring branches that lead to a
// blacksmith (ANVIL) — a must for keeping your strong weapon repaired —
// then shops/rests, while avoiding elites. (Mirrors "always pick the
// branch with a blacksmith.")
function reachesType(floors, f, idx, type, memo) {
  const node = floors[f]?.[idx];
  if (!node) return false;
  if (node.type === type) return true;
  if (f >= floors.length - 1) return false;
  const key = f + ':' + idx;
  if (memo.has(key)) return memo.get(key);
  memo.set(key, false);
  let res = false;
  for (const j of (node.connections || [])) { if (reachesType(floors, f + 1, j, type, memo)) { res = true; break; } }
  memo.set(key, res);
  return res;
}

function nodeRouteValue(type) {
  return CURRENT_BEHAVIOR.routeValue[type] ?? CURRENT_BEHAVIOR.routeValue.default ?? 0;
}

function bestFutureNodeValue(floors, f, idx, memo) {
  const key = `route:${f}:${idx}`;
  if (memo.has(key)) return memo.get(key);
  const node = floors[f]?.[idx];
  if (!node) return -Infinity;
  const next = node.connections || [];
  const future = next.length
    ? Math.max(...next.map((nextIdx) => bestFutureNodeValue(floors, f + 1, nextIdx, memo)))
    : 0;
  const value = nodeRouteValue(node.type) + future;
  memo.set(key, value);
  return value;
}

function latestReachableTypeFloor(floors, f, idx, type, memo) {
  const key = `latest:${type}:${f}:${idx}`;
  if (memo.has(key)) return memo.get(key);
  const node = floors[f]?.[idx];
  if (!node) return -1;
  let latest = node.type === type ? f : -1;
  for (const nextIdx of (node.connections || [])) {
    latest = Math.max(
      latest,
      latestReachableTypeFloor(floors, f + 1, nextIdx, type, memo),
    );
  }
  memo.set(key, latest);
  return latest;
}

function bossPreparationNodeBonus(type, gs, inv, floor) {
  if (!BOSS_PREP_FLOORS.has(floor)) return 0;
  const missingPrep = bossPrepItems(inv).length === 0;
  const shortOnWeapons = effectiveWeaponReservePips(gs, inv) < weaponPipReserveTarget(floor);
  const lowHealth = gs.maxHealth > 0 && gs.playerHealth / gs.maxHealth < 0.65;
  let bonus = 0;

  // A shop is the most reliable safe source because it always rolls a potion,
  // a weapon, and a magic card. Fights/treasure are worthwhile visible-loot
  // opportunities when the preparation slot or damage budget is still empty.
  if (missingPrep) {
    if (type === 'SHOP') bonus += 320;
    else if (type === 'RARE_SHOP') bonus += 220;
    else if (type === 'COMBAT') bonus += 135;
    else if (type === 'ELITE') bonus += 45;
    else if (type === 'TREASURE' || type === 'TREASURE_GOOD') bonus += 90;
    else if (type === 'EVENT') bonus += 55;
  }
  if (shortOnWeapons) {
    if (type === 'ANVIL') bonus += 340;
    else if (type === 'SHOP' || type === 'RARE_SHOP') bonus += 210;
    else if (type === 'COMBAT') bonus += 90;
    else if (type === 'TREASURE' || type === 'TREASURE_GOOD') bonus += 110;
  }
  if (lowHealth && type === 'REST') bonus += 380;
  return bonus;
}

function chooseNextNode(floors, f, cur, memo, gs, inv, absoluteFloor) {
  const conns = floors[f - 1][cur].connections || [];
  if (!conns.length) return -1;
  const latestAnvilByNode = new Map(conns.map((idx) => [
    idx,
    latestReachableTypeFloor(floors, f, idx, 'ANVIL', memo),
  ]));
  const latestReachableAnvil = Math.max(...latestAnvilByNode.values());
  let best = -1, bestScore = -Infinity;
  for (const idx of conns) {
    const t = floors[f][idx].type;
    // Prefer the branch whose reachable anvil is latest in the act. Repeating
    // this test at each fork keeps the selected route aimed at that anvil.
    if (latestReachableAnvil >= 0 && latestAnvilByNode.get(idx) !== latestReachableAnvil) continue;
    let s = bestFutureNodeValue(floors, f, idx, memo) + Math.random() * 0.1;
    if (t === 'EVENT') s += 25;
    if (t === 'ANVIL' && reachesType(floors, f, idx, 'SHOP', memo)) s += 10;
    s += bossPreparationNodeBonus(t, gs, inv, absoluteFloor);
    if (s > bestScore) { bestScore = s; best = idx; }
  }
  return best;
}

// ── Run one full game, recording per-floor metrics ────────────────────────
function runGame(metrics, config = {}) {
  const { mock, gs } = setupRun();
  gs._simMetrics = metrics;
  CURRENT_BEHAVIOR = getBehaviorProfile(config.behaviorPreset || DEFAULT_BEHAVIOR_PRESET || 'balanced');
  gs._behavior = CURRENT_BEHAVIOR;
  gs.characterId = normalizeCharacterId(config.characterId || DEFAULT_CHARACTER_ID);
  gs.armorPool = Array.isArray(config.armorPool) && config.armorPool.length
    ? config.armorPool.slice()
    : null;
  if (Number.isFinite(config.calendarMonthIndex)) {
    gs.calendarMonthIndex = config.calendarMonthIndex;
  }
  gs.pinCalendarMonth = Boolean(config.pinCalendarMonth);

  const startAct = (config.act === 1 || config.act === 2 || config.act === 3) ? config.act : 1;
  const endAct = (config.act === 1 || config.act === 2 || config.act === 3) ? config.act : 3;
  const winFloor = endAct * 15;
  const starterRarity = config.startingWeaponRarity || actStartWeaponRarity(startAct);

  // Per-run merge tracker: records the FIRST floor we reach each rarity tier,
  // for weapons and armor separately. The mergeWeapon/Armor list functions
  // call recordMerge() whenever a tier-up happens.
  const tracker = {
    firstFloor: { weapon: {}, armor: {} }, // {weapon: {uncommon: 7, rare: 12, ...}, armor: {...}}
    mergeCounts: { weapon: 0, daggerRefresh: 0, armor: 0, thorns: 0, potion: 0 },
    recordMerge(kind, rarity, floor) {
      const slot = this.firstFloor[kind];
      if (slot[rarity] === undefined || floor < slot[rarity]) slot[rarity] = floor;
    },
  };
  gs._mergeTracker = tracker;
  if (config.lootStats) gs._lootStats = config.lootStats;
  if (config.statsRecorder) gs._statsRecorder = config.statsRecorder;
  // Apply character talents (relics-on-death removed). Optional config.talents
  // injects ranks for experiments; otherwise the run starts with an empty tree.
  if (!isMetaProgressionDisabled()) {
    const meta = new MetaProgressionManager(mock);
    meta.characters = {
      rogue: { xp: 0, talents: {}, choices: {} },
      warrior: { xp: 0, talents: {}, choices: {} },
    };
    if (config.talents && typeof config.talents === 'object') {
      const id = gs.characterId || 'rogue';
      const ch = meta.ensureCharacter(id);
      ch.talents = { ...config.talents };
      if (config.talentChoices) ch.choices = { ...config.talentChoices };
    }
    const applyOpts = {};
    if (config.talentChoices?.armorerArmorType === 'chain'
      || config.talentChoices?.armorerArmorType === 'plate') {
      applyOpts.armorerArmorType = config.talentChoices.armorerArmorType;
    }
    meta.applyTalentEffects(gs, true, applyOpts);
  }
  // Limit mid-run amulet finds before equipping the starting loadout.
  if (config.amuletPool) applyAmuletPool(mock, config.amuletPool);
  // Record mid-run amulet gains into stats-db (only while a floor visit is open).
  if (gs._statsRecorder) {
    const origAddAmulet = mock.amuletManager.addAmulet.bind(mock.amuletManager);
    mock.amuletManager.addAmulet = (id, opts = {}) => {
      const ok = origAddAmulet(id, opts);
      if (ok) {
        const def = mock.amuletManager.amuletDefinitions[id];
        gs._statsRecorder.recordAmuletGain(id, def?.rarity || 'unknown');
      }
      return ok;
    };
  }
  // Equip the requested amulet loadout via the REAL AmuletManager so all
  // passive modifiers (damage, dodge, durability, gold, free-action, max HP/AP,
  // regen, sunstone, lethal-prevention, ...) apply exactly as in-game.
  // Bottomless Bag is granted by default (you noted it's a huge early crutch);
  // pass config.noBag to exclude it (the sweep does, for clean deltas).
  // Unlike the older sim model, inventory pressure is now real: 5 base slots
  // plus bonus slots from effects like Bottomless Bag / engineer reward.
  // forceStartingAmulets: equip config.amulets even when drops are disabled
  // (solo sweep / controlled loadout experiments).
  // Starting loadout is equipped before any floor visit → not counted as a floor gain.
  const forceStart = !!config.forceStartingAmulets;
  if (!areAmuletsDisabled() || forceStart) {
    const amulets = (config.noBag || forceStart ? [] : ['bottomlessBag']).concat(config.amulets || []);
    for (const id of amulets) mock.amuletManager.addAmulet(id, { force: forceStart });
  }
  const inv = mock.inventorySystem.slots;
  startingInventory(inv, gs.characterId, { rarity: starterRarity });
  syncInventoryState(gs, inv);
  mock._simInventory = inv;
  mock._stalemateDeath = false;
  gs.equippedWeapon = null;
  regear(mock.cardSystem.cardDataGenerator, gs, inv);
  // Isolation test: an unbreakable, fully-gemmed legendary axe to see if pure
  // weapon power (fast kills) is the bottleneck.
  if (config.superWeapon) {
    gs.equippedWeapon = { type: 'weapon', name: 'Test Axe', weaponType: 'axe', damage: 16, rarity: 'legendary', durability: 9999, maxDurability: 9999, range: 'melee', gemEffect: 'poison', gemCount: 3, gemName: 'Poison Gem' };
    gs._superWeapon = gs.equippedWeapon;
  }

  // Walk the REAL generated map. Optional --act N runs only that act's floors
  // (mid-act start with act-scaled starters).
  const map = new MapGenerator().generateFullMap();
  let reached = 0, dead = false;

  const playOpeningCombat = (floor) => {
    const roomType = 'COMBAT';
    gs.currentFloor = floor;
    gs.roomType = roomType;
    metrics.roomVisits[roomType] = (metrics.roomVisits[roomType] || 0) + 1;
    const hpStart = gs.playerHealth;
    const actionCountBeforeVisit = mock._actionCount || 0;
    const hungryActionCountBeforeVisit = mock._hungryActions || 0;
    regear(mock.cardSystem.cardDataGenerator, gs, inv);
    const floorStartWeaponPips = gs._lootStats ? sumCarriedWeaponPips(gs, inv) : 0;
    if (gs._lootStats) recordFloorInventoryStart(gs._lootStats, floor, gs, inv);
    if (gs._statsRecorder) {
      gs._statsRecorder.beginFloorVisit(floor, roomType, hpStart, gs.maxHealth);
      gs._statsRecorder.recordWeapons('start', gs, inv);
    }
    runCombat(mock, gs, inv, floor, floorStartWeaponPips);
    if (gs.playerHealth > 0) mock.amuletManager.processFloorEnd();
    regear(mock.cardSystem.cardDataGenerator, gs, inv);
    if (gs._lootStats) recordFloorInventoryEnd(gs._lootStats, floor, gs, inv);
    if (gs._statsRecorder) {
      gs._statsRecorder.recordWeapons('end', gs, inv);
      gs._statsRecorder.finishFloorVisit(gs.playerHealth, gs.maxHealth, {
        apSpent: Math.max(0, (mock._actionCount || 0) - actionCountBeforeVisit),
        hungryActions: Math.max(0, (mock._hungryActions || 0) - hungryActionCountBeforeVisit),
      });
    }
    reached = floor;
    const m = metrics.floors[floor];
    m.reached++;
    m.hpStart += hpStart;
    m.hpEnd += Math.max(0, gs.playerHealth);
    m.hpLost += Math.max(0, hpStart - gs.playerHealth);
    m.coins += gs.coins;
    m.crystals += gs.crystals;
    m.weaponDmg += gs.equippedWeapon ? gs.equippedWeapon.damage : 0;
    m.armor += gs.equippedArmor ? gs.equippedArmor.protection : 0;
    m.maxHp += gs.maxHealth;
    m.combats++;
    if (gs._lootStats) recordFloorSnapshot(gs._lootStats, floor, gs, inv, mock.cardSystem.boardCards);
    if (gs.playerHealth <= 0) {
      metrics.deaths[floor] = (metrics.deaths[floor] || 0) + 1;
      metrics.deathInfo.push({
        floor, roomType,
        wpnDmg: gs.equippedWeapon?.damage || 0,
        gem: gs.equippedWeapon?.gemEffect || 'none',
        thorn: gs.activeThorns?.thornDamage || 0,
        armor: gs.equippedArmor?.protection || 0,
        weaponDurability: gs.equippedWeapon?.durability || 0,
        weaponMaxDurability: gs.equippedWeapon?.maxDurability || 0,
        armorDurability: gs.equippedArmor?.durability || 0,
        armorMaxDurability: gs.equippedArmor?.maxDurability || 0,
        thornDurability: gs.activeThorns?.durability || 0,
        thornMaxDurability: gs.activeThorns?.maxDurability || 0,
        trace: (mock._lastCombatTrace || []).slice(),
      });
      dead = true;
    }
  };

  // Opening combat of the selected first act (floor 1 / 16 / 31). Map row 0 is
  // only the visited anchor after that fight.
  playOpeningCombat((startAct - 1) * 15 + 1);

  for (let act = startAct; act <= endAct && !dead; act++) {
    const floors = map['act' + act].floors;
    const memo = new Map();
    let cur = 0;
    for (let f = 1; f < floors.length; f++) {
      const floor = (act - 1) * 15 + f + 1;
      const next = chooseNextNode(floors, f, cur, memo, gs, inv, floor);
      if (next < 0) break;
      cur = next;
      const node = floors[f][cur];
      gs.currentFloor = floor;
      const roomType = node.type || 'COMBAT';
      gs.roomType = roomType;
      metrics.roomVisits[roomType] = (metrics.roomVisits[roomType] || 0) + 1;
      const hpStart = gs.playerHealth;
      const actionCountBeforeVisit = mock._actionCount || 0;
      const hungryActionCountBeforeVisit = mock._hungryActions || 0;

      regear(mock.cardSystem.cardDataGenerator, gs, inv);
      const floorStartWeaponPips = gs._lootStats ? sumCarriedWeaponPips(gs, inv) : 0;
      if (gs._lootStats) recordFloorInventoryStart(gs._lootStats, floor, gs, inv);
      if (gs._statsRecorder) {
        gs._statsRecorder.beginFloorVisit(floor, roomType, hpStart, gs.maxHealth);
        gs._statsRecorder.recordWeapons('start', gs, inv);
      }

      let combatResult = null;
      if (COMBAT_ROOMS.has(roomType)) {
        combatResult = runCombat(mock, gs, inv, floor, floorStartWeaponPips);
        if (combatResult?.bossName) {
          const bucket = metrics.bossStats[combatResult.bossName] || (metrics.bossStats[combatResult.bossName] = {
            encounters: 0, kills: 0, deaths: 0, hpStart: 0, hpEnd: 0,
          });
          bucket.encounters++;
          bucket.hpStart += hpStart;
          bucket.hpEnd += Math.max(0, gs.playerHealth);
          if (combatResult.cleared) bucket.kills++;
          else bucket.deaths++;
        }
        if (gs.playerHealth > 0) {
          mock.amuletManager.processFloorEnd();
          // Act-boss victory → reward room when another act follows in this run.
          if ((floor === 15 || floor === 30) && BOSS_FLOORS.has(floor) && act < endAct) {
            runBossReward(mock, gs, inv, floor);
            upgradeCompanionsForNextAct(inv, Math.floor(floor / 15) + 1);
          }
        }
      }
      else if (roomType === 'REST') runRest(gs);
      else if (roomType === 'SHOP' || roomType === 'RARE_SHOP') {
        probeShopAffordability(mock, gs, floor, roomType, metrics); // BEFORE any spend this visit
        if (roomType === 'RARE_SHOP') runRareShop(mock, gs, inv, floor);
        else runShop(mock, gs, inv, floor);
      }
      else if (roomType === 'TREASURE') runTreasure(mock, gs, inv, floor, false);
      else if (roomType === 'TREASURE_GOOD') runTreasure(mock, gs, inv, floor, true);
      else if (roomType === 'ANVIL') {
        metrics.anvilVisits++;
        const nextBoss = Math.ceil(floor / 15) * 15;
        const distance = Math.max(0, nextBoss - floor);
        metrics.anvilDistanceToBoss += distance;
        if (distance <= 3) metrics.lateAnvilVisits++;
        runAnvil(gs, inv, metrics);
      }
      else if (roomType === 'EVENT') runEvent(mock, gs, inv, floor);

      regear(mock.cardSystem.cardDataGenerator, gs, inv);
      if (gs._lootStats) recordFloorInventoryEnd(gs._lootStats, floor, gs, inv);
      if (gs._statsRecorder) {
        gs._statsRecorder.recordWeapons('end', gs, inv);
        gs._statsRecorder.finishFloorVisit(gs.playerHealth, gs.maxHealth, {
          apSpent: Math.max(0, (mock._actionCount || 0) - actionCountBeforeVisit),
          hungryActions: Math.max(0, (mock._hungryActions || 0) - hungryActionCountBeforeVisit),
        });
      }

      reached = floor;
      const m = metrics.floors[floor];
      m.reached++;
      m.hpStart += hpStart;
      m.hpEnd += Math.max(0, gs.playerHealth);
      m.hpLost += Math.max(0, hpStart - gs.playerHealth);
      m.coins += gs.coins;
      m.crystals += gs.crystals;
      m.weaponDmg += gs.equippedWeapon ? gs.equippedWeapon.damage : 0;
      m.armor += gs.equippedArmor ? gs.equippedArmor.protection : 0;
      m.maxHp += gs.maxHealth;
      if (COMBAT_ROOMS.has(roomType)) m.combats++;

      if (gs._lootStats) {
        recordFloorSnapshot(gs._lootStats, floor, gs, inv, mock.cardSystem.boardCards);
      }

      if (gs.playerHealth <= 0) {
        metrics.deaths[floor] = (metrics.deaths[floor] || 0) + 1;
        metrics.deathInfo.push({
          floor, roomType,
          wpnDmg: gs.equippedWeapon?.damage || 0,
          gem: gs.equippedWeapon?.gemEffect || 'none',
          thorn: gs.activeThorns?.thornDamage || 0,
          armor: gs.equippedArmor?.protection || 0,
          weaponDurability: gs.equippedWeapon?.durability || 0,
          weaponMaxDurability: gs.equippedWeapon?.maxDurability || 0,
          armorDurability: gs.equippedArmor?.durability || 0,
          armorMaxDurability: gs.equippedArmor?.maxDurability || 0,
          thornDurability: gs.activeThorns?.durability || 0,
          thornMaxDurability: gs.activeThorns?.maxDurability || 0,
          trace: (mock._lastCombatTrace || []).slice(),
        });
        dead = true; break;
      }
    }
    if (!dead && act < endAct && reached === act * 15) {
      reached++;
      runPostActShop(mock, gs, inv, reached, metrics);
    }
  }

  if (!dead && reached >= winFloor) metrics.wins++;
  const finalCompanions = companionsIn(inv);
  metrics.finalFloors.push(reached);
  metrics.finalAmulets.push((gs.activeAmulets || []).length);
  metrics.finalCompanions.push(finalCompanions.length);
  metrics.finalCompanionAttack.push(finalCompanions.reduce((sum, c) => sum + (Number(c.attack) || 0), 0));
  metrics.finalTrainedCompanions.push(finalCompanions.filter((c) => c.trained).length);
  metrics.finalGuardCompanions.push(finalCompanions.filter((c) => (Number(c.guardProtection) || 0) > 0).length);
  metrics.finalShockCompanions.push(finalCompanions.filter((c) => (Number(c.shockChance) || 0) > 0).length);
  metrics.totalActions += mock._actionCount || 0;
  metrics.hungryActions += mock._hungryActions || 0;
  metrics.restorationUses += mock._restorationUses || 0;
  metrics.weaponBreaks += mock._weaponBreaks || 0;
  metrics.lastPipWeaponAttacks += mock._lastPipWeaponAttacks || 0;
  metrics.mergedLastPipWeaponAttacks += mock._mergedLastPipWeaponAttacks || 0;
  metrics.avoidableLastPipWeaponAttacks += mock._avoidableLastPipWeaponAttacks || 0;
  metrics.armorBreaks += mock._armorBreaks || 0;
  metrics.thornBreaks += mock._thornBreaks || 0;
  metrics.weaponMerges += tracker.mergeCounts.weapon;
  metrics.daggerRefreshMerges += tracker.mergeCounts.daggerRefresh;
  metrics.armorMerges += tracker.mergeCounts.armor;
  metrics.thornMerges += tracker.mergeCounts.thorns;
  metrics.potionMerges += tracker.mergeCounts.potion;
  metrics.gemsSeen.push(mock._gemsSeen || 0);
  for (const f of (mock._gemFloors || [])) metrics.gemsByFloor[f] = (metrics.gemsByFloor[f] || 0) + 1;
  // Roll up the per-run merge milestones into the aggregate metrics.
  for (const kind of ['weapon', 'armor']) {
    const slot = tracker.firstFloor[kind];
    for (const r of ['uncommon', 'rare', 'epic', 'legendary']) {
      if (slot[r] !== undefined) {
        const bucket = metrics.mergeFirstFloor[kind][r] || (metrics.mergeFirstFloor[kind][r] = []);
        bucket.push(slot[r]);
      }
    }
  }
  metrics.runs++;
  const runResult = {
    reached,
    won: !dead && reached >= winFloor,
    died: dead,
    killer: mock._lastKiller || 'enemy',
    endReason: computeRunEndReason(gs, inv, {
      won: !dead && reached >= MAX_FLOOR,
      dead,
      lastEncounterType: gs.roomType,
      stalemateDeath: mock._stalemateDeath && dead,
    }),
    deathEncounterType: dead ? gs.roomType : null,
  };
  if (config.lootStats) recordRunBonuses(config.lootStats, gs, mock, config, runResult);
  return runResult;
}

// ── Monte Carlo ───────────────────────────────────────────────────────────
function blankFloor() { return { reached: 0, hpStart: 0, hpEnd: 0, hpLost: 0, coins: 0, crystals: 0, weaponDmg: 0, armor: 0, maxHp: 0, combats: 0 }; }
function blankShopAfford() {
  return {
    count: 0, affordable: 0, total: 0,
    byAct: { 1: { count: 0, affordable: 0 }, 2: { count: 0, affordable: 0 }, 3: { count: 0, affordable: 0 } },
  };
}
function newMetrics() {
  const floors = {}; for (let f = 1; f <= MAX_FLOOR; f++) floors[f] = blankFloor();
  return {
    runs: 0, wins: 0, deaths: {}, deathInfo: [], finalFloors: [], finalAmulets: [],
    finalCompanions: [], finalCompanionAttack: [], finalTrainedCompanions: [],
    finalGuardCompanions: [], finalShockCompanions: [],
    roomVisits: {},
    totalActions: 0, hungryActions: 0, restorationUses: 0, gemsSeen: [], gemsByFloor: {}, floors,
    weaponBreaks: 0, armorBreaks: 0, thornBreaks: 0,
    lastPipWeaponAttacks: 0, mergedLastPipWeaponAttacks: 0, avoidableLastPipWeaponAttacks: 0,
    repairActions: 0, repairPips: 0, repairCoins: 0,
    anvilVisits: 0, lateAnvilVisits: 0, anvilDistanceToBoss: 0,
    amuletOffers: 0, amuletPicks: 0, amuletPicksById: {},
    weaponMerges: 0, daggerRefreshMerges: 0, armorMerges: 0, thornMerges: 0, potionMerges: 0,
    combatLoot: { pickups: 0, byType: {} },
    lookahead: {
      evaluations: 0,
      overrides: 0,
      lethalPlansAvoided: 0,
      noSafePlan: 0,
      lastPipPreservations: 0,
      lastPipEmergencyUses: 0,
      lastPipAttackReasons: {},
      forcedLastPipByFloor: {},
      forcedLastPipByRoom: {},
    },
    mergeFirst: {
      plannedPickups: 0,
      cascadeReplacements: 0,
      spacePotions: 0,
      healthyDaggerPairMerges: 0,
    },
    shopPlanning: {
      regularVisits: 0,
      rareVisits: 0,
      prepPasses: 0,
      purchases: 0,
      purchasesByType: {},
      cascadePurchases: 0,
      prepMerges: 0,
      potionsUsed: 0,
      foodUsed: 0,
      gemsSocketed: 0,
      slotsFreed: 0,
      sales: 0,
      saleCoins: 0,
    },
    bossTactics: {
      encounters: 0,
      frostOpeners: 0,
      boneWallOpeners: 0,
      activeBoneWallAtEntry: 0,
      noDefensiveOpener: 0,
      bowFocusAttacks: 0,
      emergencyPotion: 0,
      emergencyRestoration: 0,
    },
    bossReadiness: {
      encounters: 0,
      withBow: 0,
      bowDamage: 0,
      bowPips: 0,
      withGemmedBow: 0,
      bowGemSockets: 0,
      bowGemByType: {},
      bowCapacity: 0,
      withDaggerPair: 0,
      daggerPairDamage: 0,
      daggerPairPips: 0,
      daggerPairCapacity: 0,
      act3Encounters: 0,
      act3WithDaggerPair: 0,
      act3WithAxeOrSword: 0,
      totalWeaponCapacity: 0,
      withEnoughWeaponCapacity: 0,
      withPrep: 0,
      withPotion: 0,
      withMergedPotion: 0,
      withFrostRing: 0,
      withBoneWall: 0,
      withRestoration: 0,
      hpPct: 0,
      combatReady: 0,
    },
    bossStats: {},
    // mergeFirstFloor[kind][rarity] = [floor, floor, ...] — one entry per run that reached that tier.
    mergeFirstFloor: { weapon: {}, armor: {} },
    // Shop affordability probe: "how many coin-priced items could you afford
    // walking in with your current coins?" using REAL shop pricing formulas.
    shopAfford: blankShopAfford(), rareShopAfford: blankShopAfford(),
  };
}

function pct(n, d) { return d ? ((100 * n) / d).toFixed(1) : '0.0'; }
function avg(sum, n) { return n ? (sum / n) : 0; }

function report(metrics) {
  LAST_REPORTED_METRICS = metrics;
  const N = metrics.runs || RUNS;
  const ff = metrics.finalFloors.slice().sort((a, b) => a - b);
  const median = ff[Math.floor(ff.length / 2)];
  const mean = ff.reduce((a, b) => a + b, 0) / ff.length;

  console.log(`\n=== Dungeon Card Crawler — Balance Sim ===`);
  console.log(`runs=${N}  (combat core = REAL engine; turn policy/stations = headless)\n`);
  if (SIM_SEED !== null) {
    console.log(
      `seed=${SIM_SEED}  survival-lookahead=${SURVIVAL_LOOKAHEAD_ENABLED ? 'on' : 'off'}\n`
    );
  }
  console.log(`merge-first planner=${MERGE_FIRST_PLANNER_ENABLED ? 'on' : 'off'}`);
  console.log(`Win rate (cleared floor ${MAX_FLOOR}): ${pct(metrics.wins, N)}%`);
  console.log(`Final floor: mean=${mean.toFixed(1)}  median=${median}  min=${ff[0]}  max=${ff[ff.length - 1]}`);
  const totalRoomVisits = Object.values(metrics.roomVisits || {})
    .reduce((sum, count) => sum + count, 0);
  const optionalFightVisits = (metrics.roomVisits?.COMBAT || 0) + (metrics.roomVisits?.ELITE || 0);
  if (totalRoomVisits) {
    console.log(
      `Route rooms: optional fights ${(optionalFightVisits / N).toFixed(1)}/run` +
      ` (${pct(optionalFightVisits, totalRoomVisits)}% of visited rooms),` +
      ` combat ${((metrics.roomVisits?.COMBAT || 0) / N).toFixed(1)},` +
      ` elite ${((metrics.roomVisits?.ELITE || 0) / N).toFixed(1)}`
    );
  }
  const fa = metrics.finalAmulets;
  if (fa.length) {
    const am = fa.reduce((a, b) => a + b, 0) / fa.length;
    console.log(`Amulets held at run end: mean=${am.toFixed(1)}  max=${Math.max(...fa)}`);
  }
  if (metrics.amuletOffers) {
    const topPicks = Object.entries(metrics.amuletPicksById)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, count]) => `${id} ${count}`)
      .join(', ');
    console.log(
      `Amulet choices: ${metrics.amuletPicks}/${metrics.amuletOffers} offers taken` +
      `${topPicks ? `; top picks: ${topPicks}` : ''}`
    );
  }
  const fc = metrics.finalCompanions || [];
  if (fc.length) {
    const compMean = fc.reduce((a, b) => a + b, 0) / fc.length;
    const attackMean = metrics.finalCompanionAttack.reduce((a, b) => a + b, 0) / fc.length;
    const trainedMean = metrics.finalTrainedCompanions.reduce((a, b) => a + b, 0) / fc.length;
    const guardMean = metrics.finalGuardCompanions.reduce((a, b) => a + b, 0) / fc.length;
    const shockMean = metrics.finalShockCompanions.reduce((a, b) => a + b, 0) / fc.length;
    console.log(`Companions at run end: mean=${compMean.toFixed(2)}  atkSum=${attackMean.toFixed(1)}  trained=${trainedMean.toFixed(2)}  guard=${guardMean.toFixed(2)}  shock=${shockMean.toFixed(2)}`);
  }
  // AP / food economy
  if (metrics.totalActions) {
    console.log(`AP starvation: ${pct(metrics.hungryActions, metrics.totalActions)}% of all actions taken while out of AP (weakened)`);
    console.log(`Restoration cards used: ${(metrics.restorationUses / N).toFixed(2)} per run`);
  }
  if (metrics.combatLoot?.pickups) {
    const byType = Object.entries(metrics.combatLoot.byType)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `${type}:${count}`)
      .join('  ');
    console.log(
      `Useful visible loot taken during combat: ${(metrics.combatLoot.pickups / N).toFixed(1)}/run` +
      `${byType ? ` (${byType})` : ''}`
    );
  }
  if (MERGE_FIRST_PLANNER_ENABLED && metrics.mergeFirst) {
    console.log(
      `Merge-first planning: ${(metrics.mergeFirst.plannedPickups / N).toFixed(2)} planned pickups/run,`
      + ` ${(metrics.mergeFirst.cascadeReplacements / N).toFixed(2)} cascade replacements/run,`
      + ` ${(metrics.mergeFirst.spacePotions / N).toFixed(2)} space-making potions/run,`
      + ` ${(metrics.mergeFirst.healthyDaggerPairMerges / N).toFixed(2)} healthy final-pair dagger merges/run`,
    );
  }
  if (metrics.lookahead?.evaluations) {
    console.log(
      `Survival lookahead: ${metrics.lookahead.overrides} attack choices changed,` +
      ` ${metrics.lookahead.lethalPlansAvoided} lethal plans avoided,` +
      ` ${metrics.lookahead.noSafePlan} turns had no projected safe kill plan`
    );
    console.log(
      `  Last-pip preservation: ${metrics.lookahead.lastPipPreservations} protected choices,` +
      ` ${metrics.lookahead.lastPipEmergencyUses} emergency/boss-finisher uses`
    );
    const lastPipReasons = Object.entries(metrics.lookahead.lastPipAttackReasons || {})
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => `${reason}=${count}`)
      .join(', ');
    if (lastPipReasons) console.log(`  Actual last-pip attacks by reason: ${lastPipReasons}`);
    const forcedRooms = Object.entries(metrics.lookahead.forcedLastPipByRoom || {})
      .sort((a, b) => b[1] - a[1])
      .map(([room, count]) => `${room}=${count}`)
      .join(', ');
    const forcedFloors = Object.entries(metrics.lookahead.forcedLastPipByFloor || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([floor, count]) => `F${floor}=${count}`)
      .join(', ');
    if (forcedRooms) console.log(`  Forced last-pip rooms: ${forcedRooms}`);
    if (forcedFloors) console.log(`  Most forced last-pip floors: ${forcedFloors}`);
  }

  console.log(`\nDurability per run:`);
  console.log(`  Breaks: weapons ${(metrics.weaponBreaks / N).toFixed(2)}, armor ${(metrics.armorBreaks / N).toFixed(2)}, thorns ${(metrics.thornBreaks / N).toFixed(2)}`);
  console.log(
    `  Last-pip weapon attacks: ${(metrics.lastPipWeaponAttacks / N).toFixed(2)}/run` +
    ` (${(metrics.mergedLastPipWeaponAttacks / N).toFixed(2)} with merged weapons,` +
    ` ${(metrics.avoidableLastPipWeaponAttacks / N).toFixed(2)} while another weapon was usable)`
  );
  console.log(`  Anvil: ${(metrics.repairActions / N).toFixed(2)} repairs, ${(metrics.repairPips / N).toFixed(1)} pips restored, ${(metrics.repairCoins / N).toFixed(1)} coins spent`);
  if (metrics.anvilVisits) {
    console.log(
      `  Anvil routing: ${(metrics.anvilVisits / N).toFixed(2)} visits/run,` +
      ` ${pct(metrics.lateAnvilVisits, metrics.anvilVisits)}% in final 3 nodes,` +
      ` avg ${(metrics.anvilDistanceToBoss / metrics.anvilVisits).toFixed(1)} nodes before boss`
    );
  }
  console.log(
    `  Refreshing merges: weapons ${(metrics.weaponMerges / N).toFixed(2)}` +
    ` (low-pip dagger ${(metrics.daggerRefreshMerges / N).toFixed(2)}),` +
    ` armor ${(metrics.armorMerges / N).toFixed(2)},` +
    ` thorns ${(metrics.thornMerges / N).toFixed(2)},` +
    ` potions ${(metrics.potionMerges / N).toFixed(2)}`
  );

  // Shop affordability: "walking in with your current coins, how many of the
  // coin-priced items could you afford?" (real pricing formulas, cheapest-first).
  const reportShopAfford = (label, bucket, outOf) => {
    if (!bucket.count) return;
    const avg = bucket.affordable / bucket.count;
    const byAct = [1, 2, 3].map((a) => {
      const b = bucket.byAct[a];
      return b.count ? (b.affordable / b.count).toFixed(1) : '-';
    });
    console.log(`${label}: avg ${avg.toFixed(1)}/${outOf} affordable per visit  (Act1=${byAct[0]} Act2=${byAct[1]} Act3=${byAct[2]}, visits=${bucket.count})`);
  };
  console.log(`\nShop affordability (real pricing, cheapest-first, per visit):`);
  reportShopAfford('  Regular shop', metrics.shopAfford, 6);
  reportShopAfford('  Rare shop   ', metrics.rareShopAfford, 4);
  const shop = metrics.shopPlanning;
  const shopVisits = (shop?.regularVisits || 0) + (shop?.rareVisits || 0);
  if (shopVisits) {
    const purchaseTypes = Object.entries(shop.purchasesByType || {})
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `${type}=${count}`)
      .join(', ');
    console.log(`Shop inventory planning:`);
    console.log(
      `  visits=${shopVisits} (regular ${shop.regularVisits}, rare ${shop.rareVisits}),` +
      ` purchases ${(shop.purchases / N).toFixed(2)}/run,` +
      ` merge-producing purchases ${(shop.cascadePurchases / N).toFixed(2)}/run`
    );
    console.log(
      `  safe station use/run: potions ${(shop.potionsUsed / N).toFixed(2)},` +
      ` food ${(shop.foodUsed / N).toFixed(2)}, gems ${(shop.gemsSocketed / N).toFixed(2)};` +
      ` slots freed ${(shop.slotsFreed / N).toFixed(2)}`
    );
    console.log(
      `  selling: ${(shop.sales / N).toFixed(2)}/run for ${(shop.saleCoins / N).toFixed(1)} coins/run`
    );
    if (purchaseTypes) console.log(`  purchases by type: ${purchaseTypes}`);
  }

  // Gem economy: how many socket gems the player encounters across a run.
  if (metrics.gemsSeen && metrics.gemsSeen.length) {
    const gs = metrics.gemsSeen.slice().sort((a, b) => a - b);
    const gMean = gs.reduce((a, b) => a + b, 0) / gs.length;
    const gMed = gs[Math.floor(gs.length / 2)];
    console.log(`\nGems seen per run (floor drops only): mean=${gMean.toFixed(1)}  median=${gMed}  min=${gs[0]}  max=${gs[gs.length - 1]}`);
    console.log(`Gem drops by floor (avg per run that reached it):`);
    let line = '  ';
    for (let f = 1; f <= MAX_FLOOR; f++) {
      const reached = metrics.floors[f]?.reached || 0;
      if (!reached) continue;
      const g = (metrics.gemsByFloor[f] || 0) / reached;
      if (g > 0.001) line += `f${f}:${g.toFixed(2)} `;
    }
    console.log(line || '  (none)');
  }

  console.log(`\nDeaths by act:`);
  const actDeaths = [0, 0, 0];
  for (const f in metrics.deaths) { const a = Math.floor((f - 1) / 15); actDeaths[a] += metrics.deaths[f]; }
  ['Act 1 (1-15)', 'Act 2 (16-30)', 'Act 3 (31-45)'].forEach((label, i) => console.log(`  ${label}: ${metrics.deaths ? actDeaths[i] : 0} (${pct(actDeaths[i], N)}%)`));

  const bossRows = Object.entries(metrics.bossStats || {}).sort((a, b) => b[1].encounters - a[1].encounters);
  if (bossRows.length) {
    console.log(`\nBoss outcomes:`);
    for (const [name, b] of bossRows) {
      console.log(
        `  ${name.padEnd(17)} encounters=${String(b.encounters).padStart(4)} ` +
        `kills=${pct(b.kills, b.encounters).padStart(5)}% ` +
        `deaths=${pct(b.deaths, b.encounters).padStart(5)}% ` +
        `playerHP ${avg(b.hpStart, b.encounters).toFixed(0)}→${avg(b.hpEnd, b.encounters).toFixed(0)}`
      );
    }
  }

  // ── Death diagnostics: what's actually killing the bot ──────────────────
  const readiness = metrics.bossReadiness;
  if (readiness?.encounters) {
    console.log(`\nBoss readiness at encounter:`);
    console.log(
      `  usable bow=${pct(readiness.withBow, readiness.encounters)}%` +
      ` (avg dmg ${avg(readiness.bowDamage, readiness.withBow).toFixed(1)},` +
      ` pips ${avg(readiness.bowPips, readiness.withBow).toFixed(1)} when held)`
    );
    console.log(
      `  gemmed bow=${pct(readiness.withGemmedBow, readiness.encounters)}%` +
      ` (avg sockets ${avg(readiness.bowGemSockets, readiness.withGemmedBow).toFixed(2)} when gemmed;` +
      ` poison ${pct(readiness.bowGemByType.poison || 0, readiness.encounters)}%,` +
      ` lightning ${pct(readiness.bowGemByType.lightning || 0, readiness.encounters)}%,` +
      ` fire ${pct(readiness.bowGemByType.fire || 0, readiness.encounters)}%)`
    );
    console.log(
      `  dual daggers=${pct(readiness.withDaggerPair, readiness.encounters)}%` +
      ` (combined dmg ${avg(readiness.daggerPairDamage, readiness.withDaggerPair).toFixed(1)},` +
      ` pips ${avg(readiness.daggerPairPips, readiness.withDaggerPair).toFixed(1)},` +
      ` capacity ${avg(readiness.daggerPairCapacity, readiness.withDaggerPair).toFixed(0)} when paired)`
    );
    if (readiness.act3Encounters) {
      console.log(
        `  Act 3 transition: axe/sword ${pct(readiness.act3WithAxeOrSword, readiness.act3Encounters)}%,` +
        ` dual daggers retained ${pct(readiness.act3WithDaggerPair, readiness.act3Encounters)}%`
      );
    }
    console.log(
      `  estimated weapon capacity: bow ${avg(readiness.bowCapacity, readiness.withBow).toFixed(0)},` +
      ` all weapons ${avg(readiness.totalWeaponCapacity, readiness.encounters).toFixed(0)};` +
      ` enough for boss HP ${pct(readiness.withEnoughWeaponCapacity, readiness.encounters)}%`
    );
    console.log(
      `  prep resource=${pct(readiness.withPrep, readiness.encounters)}%` +
      ` (potion ${pct(readiness.withPotion, readiness.encounters)}%,` +
      ` merged ${pct(readiness.withMergedPotion, readiness.encounters)}%,` +
      ` Frost Ring ${pct(readiness.withFrostRing, readiness.encounters)}%,` +
      ` Bone Wall ${pct(readiness.withBoneWall, readiness.encounters)}%,` +
      ` Restoration ${pct(readiness.withRestoration, readiness.encounters)}%)`
    );
    console.log(`  mean starting HP=${(100 * avg(readiness.hpPct, readiness.encounters)).toFixed(1)}%`);
    console.log(`  prepared by resource or HP=${pct(readiness.combatReady, readiness.encounters)}%`);
  }
  const tactics = metrics.bossTactics;
  if (tactics?.encounters) {
    console.log(
      `  boss opener: Frost Ring ${pct(tactics.frostOpeners, tactics.encounters)}%,` +
      ` Bone Wall ${pct(tactics.boneWallOpeners, tactics.encounters)}%,` +
      ` already protected ${pct(tactics.activeBoneWallAtEntry, tactics.encounters)}%,` +
      ` none ${pct(tactics.noDefensiveOpener, tactics.encounters)}%`
    );
    console.log(`  bow attacks focused through summons=${tactics.bowFocusAttacks}`);
    console.log(`  emergency healing below 30% HP: potion ${tactics.emergencyPotion}, Restoration ${tactics.emergencyRestoration}`);
  }

  const di = metrics.deathInfo;
  if (di.length) {
    const byRoom = {};
    for (const d of di) byRoom[d.roomType] = (byRoom[d.roomType] || 0) + 1;
    console.log(`\nWhat kills the bot (${di.length} deaths):`);
    Object.entries(byRoom).sort((a, b) => b[1] - a[1]).forEach(([room, n]) =>
      console.log(`  ${room.padEnd(8)}: ${pct(n, di.length)}% of deaths`));
    const mean = (f) => (di.reduce((s, d) => s + f(d), 0) / di.length);
    const share = (pred) => pct(di.filter(pred).length, di.length);
    console.log(`  at death: avg weaponDmg=${mean((d) => d.wpnDmg).toFixed(1)}, avg armor=${mean((d) => d.armor).toFixed(1)}, avg thorns=${mean((d) => d.thorn).toFixed(1)}`);
    const durabilityPercent = (current, max) => max > 0 ? (100 * current / max) : 0;
    console.log(`  durability at death: weapon ${mean((d) => durabilityPercent(d.weaponDurability, d.weaponMaxDurability)).toFixed(0)}%, armor ${mean((d) => durabilityPercent(d.armorDurability, d.armorMaxDurability)).toFixed(0)}%, thorns ${mean((d) => durabilityPercent(d.thornDurability, d.thornMaxDurability)).toFixed(0)}%`);
    console.log(`  had a gem socketed: ${share((d) => d.gem !== 'none')}%  (poison ${share((d) => d.gem === 'poison')}%, lightning ${share((d) => d.gem === 'lightning')}%, fire ${share((d) => d.gem === 'fire')}%)`);
    console.log(`  had thorns: ${share((d) => d.thorn > 0)}%`);
    console.log(`  representative final action traces:`);
    for (const [room] of Object.entries(byRoom).sort((a, b) => b[1] - a[1]).slice(0, 3)) {
      const roomDeaths = di.filter((death) => death.roomType === room)
        .sort((a, b) => a.floor - b.floor);
      const example = roomDeaths[Math.floor(roomDeaths.length / 2)];
      console.log(`    ${room} floor ${example.floor}:`);
      for (const event of (example.trace || []).slice(-6)) {
        console.log(`      - ${event}`);
      }
    }
  }

  // ── Merge tier-up timing: when do runs first reach each rarity? ────────
  const m = metrics.mergeFirstFloor;
  const hasMerges = ['weapon', 'armor'].some(k => Object.keys(m[k] || {}).length);
  if (hasMerges) {
    console.log(`\nFirst floor each rarity tier was reached (via merging):`);
    console.log(`             %runs reached  mean  median  min  max   distribution (acts: 1=floor 1-15, 2=16-30, 3=31-45)`);
    for (const kind of ['weapon', 'armor']) {
      for (const r of ['uncommon', 'rare', 'epic', 'legendary']) {
        const arr = (m[kind][r] || []).slice().sort((a, b) => a - b);
        if (!arr.length) { console.log(`  ${kind.padEnd(7)} ${r.padEnd(10)}: 0% never reached`); continue; }
        const sum = arr.reduce((s, x) => s + x, 0);
        const mean = sum / arr.length;
        const med = arr[Math.floor(arr.length / 2)];
        const act1 = arr.filter(f => f <= 15).length;
        const act2 = arr.filter(f => f > 15 && f <= 30).length;
        const act3 = arr.filter(f => f > 30).length;
        console.log(
          `  ${kind.padEnd(7)} ${r.padEnd(10)}: ${pct(arr.length, N).padStart(5)}%  ` +
          `${mean.toFixed(1).padStart(5)}  ${String(med).padStart(6)}  ${String(arr[0]).padStart(3)}  ${String(arr[arr.length-1]).padStart(3)}   ` +
          `Act1:${pct(act1, arr.length).padStart(5)}% Act2:${pct(act2, arr.length).padStart(5)}% Act3:${pct(act3, arr.length).padStart(5)}%`
        );
      }
    }
  }

  console.log(`\nDeath hot-spots (floors with >=1% of runs dying):`);
  Object.keys(metrics.deaths).map(Number).sort((a, b) => a - b).forEach((f) => {
    const d = metrics.deaths[f]; if (d / N >= 0.01) console.log(`  Floor ${String(f).padStart(2)}: ${pct(d, N)}% of runs`);
  });

  console.log(`\nPer-floor curve (averaged over runs that reached the floor):`);
  console.log(`fl  reach%  hpStart  hpEnd  hpLost  maxHP  wpnDmg  armor  coins  crys`);
  for (let f = 1; f <= MAX_FLOOR; f++) {
    const m = metrics.floors[f]; if (!m.reached) continue;
    const tag = BOSS_FLOORS.has(f) ? 'B' : '';
    console.log(
      `${String(f).padStart(2)}${tag.padEnd(1)} ${pct(m.reached, N).padStart(6)} ` +
      `${avg(m.hpStart, m.reached).toFixed(0).padStart(7)} ${avg(m.hpEnd, m.reached).toFixed(0).padStart(6)} ` +
      `${avg(m.hpLost, m.reached).toFixed(1).padStart(6)} ${avg(m.maxHp, m.reached).toFixed(0).padStart(6)} ` +
      `${avg(m.weaponDmg, m.reached).toFixed(1).padStart(6)} ${avg(m.armor, m.reached).toFixed(1).padStart(6)} ` +
      `${avg(m.coins, m.reached).toFixed(0).padStart(6)} ${avg(m.crystals, m.reached).toFixed(1).padStart(5)}`
    );
  }
  console.log(`\n(legend: 'B' = boss floor. hpLost = avg HP lost on that floor.)`);
}

// ── Per-amulet impact sweep ────────────────────────────────────────────────
// Runs the baseline, then re-runs with each amulet equipped solo, and reports
// the delta in win-rate and mean final floor. Reuses the REAL AmuletManager,
// so PASSIVE amulets (regen, dodge, max HP/AP, gold, damage, durability,
// free-action, lethal-prevention, sunstone) are measured accurately.
// ACTIVE / gem-synergy amulets are understated until the bot uses gems & magic.
//
// Clean solo: meta off, floor/shop/event amulet drops off; only the starting
// amulet is force-equipped. Usage:
//   node sim/balance-sim.js sweep 100
//   node sim/balance-sim.js sweep 100 regeneration,golemHeart   # subset
function quickStats(amulets, runs) {
  const m = newMetrics();
  let weaponDeaths = 0;
  let hpDeaths = 0;
  let deaths = 0;
  for (let i = 0; i < runs; i++) {
    const result = runGame(m, { amulets, noBag: true, forceStartingAmulets: true });
    if (result?.died) {
      deaths++;
      if (result.endReason === 'weapon') weaponDeaths++;
      else hpDeaths++;
    }
  }
  const floors = m.finalFloors;
  const mean = floors.reduce((a, b) => a + b, 0) / floors.length;
  const sorted = floors.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const reach15 = (100 * floors.filter((f) => f >= 15).length) / runs;
  const reach30 = (100 * floors.filter((f) => f >= 30).length) / runs;
  const deathN = Math.max(1, deaths);
  return {
    win: (100 * m.wins) / runs,
    mean,
    median,
    reach15,
    reach30,
    deaths,
    weaponDeathPct: (100 * weaponDeaths) / deathN,
    hpDeathPct: (100 * hpDeaths) / deathN,
  };
}

function runSweep() {
  const args = stripBehaviorArgs(process.argv.slice(3));
  const runs = parseInt(args[0], 10) || 100;
  const filterArg = args[1];
  const behaviorName = DEFAULT_BEHAVIOR_PRESET || 'balanced';
  const { mock: sweepMock } = setupRun();
  let ids = Object.keys(sweepMock.amuletManager.amuletDefinitions)
    .filter((id) => sweepMock.amuletManager.amuletDefinitions[id]?.rarity !== 'old');
  if (filterArg && filterArg !== 'all') {
    const wanted = new Set(filterArg.split(',').map((s) => s.trim()).filter(Boolean));
    ids = ids.filter((id) => wanted.has(id));
    if (!ids.length) {
      console.error(`No matching amulets in: ${filterArg}`);
      process.exit(1);
    }
  }

  // No meta, no mid-run amulet drops — only the forced starting loadout.
  setSimTestOptionsOverride({
    [TEST_OPTION_IDS.disableAmulets]: true,
    [TEST_OPTION_IDS.disableMetaProgression]: true,
  });

  try {
    console.log(`\n=== Per-Amulet Impact Sweep (clean solo) ===`);
    console.log(`runs/config=${runs}, amulets=${ids.length}, behavior=${behaviorName}`);
    console.log(`flags: no-meta, no amulet drops/shops, force starting amulet only`);
    console.log(`death reasons: weapon = нет pip/магии против врагов; hp = убило по здоровью\n`);

    const base = quickStats([], runs);
    console.log(
      `Baseline (no amulets):  win=${base.win.toFixed(1)}%  meanFloor=${base.mean.toFixed(1)}` +
      `  median=${base.median.toFixed(0)}  reachF15=${base.reach15.toFixed(0)}%  reachF30=${base.reach30.toFixed(0)}%` +
      `  death: weapon=${base.weaponDeathPct.toFixed(0)}% hp=${base.hpDeathPct.toFixed(0)}%\n`
    );

    const rows = ids.map((id) => {
      const s = quickStats([id], runs);
      return {
        id,
        win: s.win,
        mean: s.mean,
        median: s.median,
        reach15: s.reach15,
        reach30: s.reach30,
        weaponDeathPct: s.weaponDeathPct,
        hpDeathPct: s.hpDeathPct,
        dFloor: s.mean - base.mean,
        dWin: s.win - base.win,
        dReach15: s.reach15 - base.reach15,
      };
    });
    rows.sort((a, b) => b.dFloor - a.dFloor);

    console.log(
      `amulet                 win%   mean   med  rF15%  rF30%  wpn%   hp%   Δfloor   Δwin%  ΔrF15`
    );
    for (const r of rows) {
      console.log(
        `${r.id.padEnd(22)} ${r.win.toFixed(1).padStart(5)} ${r.mean.toFixed(1).padStart(6)}` +
        `${String(Math.round(r.median)).padStart(6)} ${r.reach15.toFixed(0).padStart(6)}` +
        `${r.reach30.toFixed(0).padStart(7)}` +
        `${r.weaponDeathPct.toFixed(0).padStart(6)}` +
        `${r.hpDeathPct.toFixed(0).padStart(6)}` +
        `${((r.dFloor >= 0 ? '+' : '') + r.dFloor.toFixed(1)).padStart(9)}` +
        `${((r.dWin >= 0 ? '+' : '') + r.dWin.toFixed(1)).padStart(8)}` +
        `${((r.dReach15 >= 0 ? '+' : '') + r.dReach15.toFixed(0)).padStart(7)}`
      );
    }
    console.log(`\nSorted by Δmean floor vs baseline. Positive = helps go deeper.`);
    console.log(`wpn% / hp% — доля смертей среди умерших (weapon = stalemate без оружия/магии).`);
    if (behaviorName === 'balanced') {
      console.log(`Note: на balanced гем-амулеты занижены — для них лучше --behavior magicHeavy.`);
    }
  } finally {
    clearSimTestOptionsOverride();
  }
}

// ── Loadout mode: run with a fixed amulet set equipped from the start ──────
// Usage: node sim/balance-sim.js loadout <id,id,...|auto> [runs]
function runLoadout() {
  const args = stripBehaviorArgs(process.argv.slice(3));
  const arg = args[0] || 'auto';
  const runs = parseInt(args[1], 10) || RUNS;
  let amulets;
  if (arg === 'auto') {
    // A representative "strong defensive + utility" stack.
    amulets = ['ringOfHealth', 'philosophersStone', 'amuletOfEvasion', 'amuletOfProtection', 'legendaryWhetstone', 'alchemistBag', 'pouchOfGreed'];
  } else {
    amulets = arg.split(',').map((s) => s.trim()).filter(Boolean);
  }
  console.log(`\nLoadout: ${amulets.join(', ')}\n`);
  const metrics = newMetrics();
  for (let i = 0; i < runs; i++) runGame(metrics, { amulets });
  report(metrics);
}

// ── Geared mode: strong amulet loadout (relic meta retired) ───────────────
// Usage: node sim/balance-sim.js geared [runs]
const ALL_RELICS = [];
const MAX_SHADOW_TALENTS = {
  keenEdge: 3, firstBlood: 3, twinFang: 3, frontVolley: 3, assassinate: 3,
};
const MAX_IRON_TALENTS = {
  hardened: 3, reprisal: 3, bulwark: 3, armorerStart: 1, rivets: 3,
};
const STRONG_AMULETS = ['ringOfHealth', 'philosophersStone', 'amuletOfGreaterEvasion', 'amuletOfGreaterProtection',
  'legendaryWhetstone', 'alchemistBag', 'pouchOfGreed', 'vampireFang'];

function runGeared() {
  const runs = parseInt(process.argv[3], 10) || RUNS;
  console.log(`\nGeared run — max Shadow talents + strong amulets: ${STRONG_AMULETS.length}`);
  const metrics = newMetrics();
  for (let i = 0; i < runs; i++) {
    runGame(metrics, {
      characterId: 'rogue',
      talents: MAX_SHADOW_TALENTS,
      amulets: STRONG_AMULETS,
    });
  }
  report(metrics);
}

// ── Career mode: XP accumulates; talents not auto-bought (manual meta) ─────
// Usage: node sim/balance-sim.js career [careers]
function runCareer() {
  const careers = parseInt(process.argv[3], 10) || 2000;
  const MAX_ATTEMPTS = 60;
  const throwaway = newMetrics();
  const deathsToWin = [], xpAtWin = [];
  let unwon = 0;

  for (let c = 0; c < careers; c++) {
    const meta = new MetaProgressionManager({});
    meta.characters = {
      rogue: { xp: 0, talents: {}, choices: {} },
      warrior: { xp: 0, talents: {}, choices: {} },
    };
    meta.totalDeaths = 0; meta.bestFloor = 1; meta.enemyKillStats = {};
    let deaths = 0, won = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const r = runGame(throwaway, {
        characterId: 'rogue',
        talents: { ...meta.ensureCharacter('rogue').talents },
        talentChoices: { ...meta.ensureCharacter('rogue').choices },
        noBag: true,
      });
      if (r.won) { won = true; break; }
      deaths++;
      meta.handlePlayerDeath(r.killer, r.reached, 'rogue');
    }
    if (won) {
      deathsToWin.push(deaths);
      xpAtWin.push(meta.getCharacterXp('rogue'));
    } else unwon++;
  }

  const n = deathsToWin.length;
  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
  console.log(`\nCareer (XP-only meta, no auto-talents): ${careers} careers`);
  console.log(`Careers that won within ${MAX_ATTEMPTS} attempts: ${((100 * n) / careers).toFixed(1)}%`);
  if (n) {
    console.log(`Mean deaths to win: ${mean(deathsToWin).toFixed(1)}`);
    console.log(`Mean XP at win: ${mean(xpAtWin).toFixed(1)}`);
  }
  if (unwon) console.log(`\n(${unwon} careers did not win within ${MAX_ATTEMPTS} attempts.)`);
}

// ── Talent-compare: class MVP trees vs baseline ───────────────────────────
// Usage:
//   node sim/balance-sim.js talentcompare [runs] [rogue|warrior]
//   node sim/balance-sim.js reliccompare [runs] [rogue|warrior]   (alias)
function runTalentCompare() {
  const args = stripBehaviorArgs(process.argv.slice(3));
  let runs = 100;
  let characterId = 'rogue';
  for (const a of args) {
    if (/^\d+$/.test(a)) runs = parseInt(a, 10);
    else if (a === 'rogue' || a === 'warrior') characterId = a;
  }

  const rogueConfigs = [
    { label: 'baseline (no talents)', talents: {} },
    { label: 'Keen Edge 1', talents: { keenEdge: 1 } },
    { label: 'Keen Edge 2', talents: { keenEdge: 2 } },
    { label: 'Keen Edge 3', talents: { keenEdge: 3 } },
    { label: 'First Blood 3', talents: { firstBlood: 3 } },
    { label: 'Twin Fang 3', talents: { twinFang: 3 } },
    { label: 'Front Volley 3', talents: { frontVolley: 3 } },
    { label: 'Assassinate 3', talents: { assassinate: 3 } },
    { label: 'Full Shadow', talents: { ...MAX_SHADOW_TALENTS } },
  ];
  const warriorConfigs = [
    { label: 'baseline (no talents)', talents: {} },
    { label: "Armorer's Start", talents: { armorerStart: 1 }, randomArmorer: true },
    { label: 'Rivets 3', talents: { rivets: 3 } },
    { label: 'Bulwark 3', talents: { bulwark: 3 } },
    { label: 'Hardened 3', talents: { hardened: 3 } },
    { label: 'Reprisal 3', talents: { reprisal: 3 } },
    {
      label: 'Full Iron',
      talents: { ...MAX_IRON_TALENTS },
      randomArmorer: true,
    },
  ];

  const configs = characterId === 'warrior' ? warriorConfigs : rogueConfigs;
  const treeName = characterId === 'warrior' ? 'Iron' : 'Shadow';

  console.log(`\n=== ${characterId} ${treeName} talent compare — ${runs} runs each ===`);
  console.log(
    characterId === 'warrior'
      ? `character=warrior  armorPool=chain+plate  Armorer Start / Full Iron: random chain|plate each run`
      : `character=rogue  noBag  amulets=on (fresh drops/shops)  meta talents forced via config`
  );
  console.log(`noBag  amulets=on (fresh drops/shops)  meta talents forced via config\n`);
  console.log(
    'loadout'.padEnd(24)
    + 'meanF'.padStart(7)
    + 'medF'.padStart(6)
    + 'F15%'.padStart(7)
    + 'F30%'.padStart(7)
    + 'F45%'.padStart(7)
    + 'win%'.padStart(7)
  );
  console.log('─'.repeat(65));

  const rows = [];
  for (const cfg of configs) {
    const m = newMetrics();
    for (let i = 0; i < runs; i++) {
      let talentChoices = cfg.talentChoices;
      if (cfg.randomArmorer) {
        talentChoices = {
          armorerArmorType: Math.random() < 0.5 ? 'chain' : 'plate',
        };
      }
      runGame(m, {
        characterId,
        talents: cfg.talents || {},
        talentChoices,
        noBag: true,
      });
    }
    const ff = m.finalFloors.slice().sort((a, b) => a - b);
    const n = ff.length || 1;
    const mean = ff.reduce((a, b) => a + b, 0) / n;
    const med = ff[Math.floor(ff.length / 2)] || 0;
    const reach = (floor) => (100 * ff.filter((f) => f >= floor).length) / n;
    const winPct = (100 * m.wins) / n;
    const row = {
      label: cfg.label,
      mean,
      med,
      f15: reach(15),
      f30: reach(30),
      f45: reach(45),
      win: winPct,
    };
    rows.push(row);
    console.log(
      row.label.padEnd(24)
      + row.mean.toFixed(1).padStart(7)
      + String(row.med).padStart(6)
      + row.f15.toFixed(0).padStart(6) + '%'
      + row.f30.toFixed(0).padStart(6) + '%'
      + row.f45.toFixed(0).padStart(6) + '%'
      + row.win.toFixed(0).padStart(6) + '%'
    );
  }

  const base = rows[0];
  console.log('\nDelta vs baseline (pp = percentage points):');
  for (const row of rows.slice(1)) {
    console.log(
      `  ${row.label.padEnd(22)}`
      + ` meanF ${((row.mean - base.mean) >= 0 ? '+' : '')}${(row.mean - base.mean).toFixed(1)}`
      + `  F15 ${(row.f15 - base.f15) >= 0 ? '+' : ''}${(row.f15 - base.f15).toFixed(0)}pp`
      + `  F30 ${(row.f30 - base.f30) >= 0 ? '+' : ''}${(row.f30 - base.f30).toFixed(0)}pp`
      + `  win ${(row.win - base.win) >= 0 ? '+' : ''}${(row.win - base.win).toFixed(0)}pp`
    );
  }
}

function runRelicCompare() {
  runTalentCompare();
}

// ── Talent ladder: cumulative max ranks along the live branch ─────────────
// Usage: node sim/balance-sim.js talentladder [runs]
// Builds: baseline → node1 max → node1+2 max → … → full tree for rogue & warrior.
function buildTalentLadderConfigs(characterId) {
  const branch = characterId === 'warrior'
    ? getBranchesForCharacter('warrior').find((b) => b.id === 'iron')
    : getBranchesForCharacter('rogue').find((b) => b.id === 'shadow');
  const nodes = branch?.nodes || [];
  const configs = [{ label: '0 baseline', step: 0, talents: {}, randomArmorer: false }];
  const talents = {};
  nodes.forEach((talentId, i) => {
    const node = getTalentNode(talentId);
    const maxRank = node?.maxRank || 1;
    talents[talentId] = maxRank;
    const needsArmorer = characterId === 'warrior' && Object.prototype.hasOwnProperty.call(talents, 'armorerStart');
    configs.push({
      label: `${i + 1} +${node?.name || talentId}`,
      step: i + 1,
      talents: { ...talents },
      randomArmorer: needsArmorer,
    });
  });
  return configs;
}

function runTalentLadder() {
  const args = stripBehaviorArgs(process.argv.slice(3));
  let runs = 1000;
  for (const a of args) {
    if (/^\d+$/.test(a)) runs = parseInt(a, 10);
  }

  const out = { runs, generatedAt: new Date().toISOString(), classes: {} };

  for (const characterId of ['rogue', 'warrior']) {
    const configs = buildTalentLadderConfigs(characterId);
    const treeName = characterId === 'warrior' ? 'Iron' : 'Shadow';
    console.log(`\n=== ${characterId} ${treeName} talent LADDER — ${runs} runs each ===`);
    console.log(
      'step'.padEnd(28)
      + 'meanF'.padStart(7)
      + 'medF'.padStart(6)
      + 'F15%'.padStart(7)
      + 'F30%'.padStart(7)
      + 'F45%'.padStart(7)
      + 'win%'.padStart(7)
    );
    console.log('─'.repeat(69));

    const rows = [];
    for (const cfg of configs) {
      const m = newMetrics();
      for (let i = 0; i < runs; i++) {
        let talentChoices = cfg.talentChoices;
        if (cfg.randomArmorer) {
          talentChoices = {
            armorerArmorType: Math.random() < 0.5 ? 'chain' : 'plate',
          };
        }
        runGame(m, {
          characterId,
          talents: cfg.talents || {},
          talentChoices,
          noBag: true,
        });
      }
      const ff = m.finalFloors.slice().sort((a, b) => a - b);
      const n = ff.length || 1;
      const mean = ff.reduce((a, b) => a + b, 0) / n;
      const med = ff[Math.floor(ff.length / 2)] || 0;
      const reach = (floor) => (100 * ff.filter((f) => f >= floor).length) / n;
      const winPct = (100 * m.wins) / n;
      const row = {
        label: cfg.label,
        step: cfg.step,
        talents: cfg.talents,
        mean: +mean.toFixed(2),
        med,
        f15: +reach(15).toFixed(1),
        f30: +reach(30).toFixed(1),
        f45: +reach(45).toFixed(1),
        win: +winPct.toFixed(1),
      };
      rows.push(row);
      console.log(
        row.label.padEnd(28)
        + row.mean.toFixed(1).padStart(7)
        + String(row.med).padStart(6)
        + row.f15.toFixed(0).padStart(6) + '%'
        + row.f30.toFixed(0).padStart(6) + '%'
        + row.f45.toFixed(0).padStart(6) + '%'
        + row.win.toFixed(0).padStart(6) + '%'
      );
    }
    out.classes[characterId] = { tree: treeName, rows };
  }

  const outPath = 'sim/output/talent-ladder.json';
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nJSON written to ${outPath}`);
  return out;
}

// ── Loot-stats playtest: weapon damage + enemy HP curves + run-end bonuses ─
// Usage:
//   node sim/balance-sim.js loot-stats [runs] [fresh|geared|accumulate|balance] [--json]
//   Flags: --meta --no-meta --amulets --no-amulets --amulet-loadout none|bag|strong
function runLootStats() {
  const raw = stripBehaviorArgs(process.argv.slice(3));
  const runs = parseInt(raw[0], 10) || 100;
  const { positional, flags } = splitSimArgv(raw.slice(1));
  const metaMode = positional.find((a) => SIM_META_MODES.has(a)) || 'fresh';
  const writeJson = flags.includes('--json') || positional.includes('--json');
  const simFlags = parseSimFlags(flags, metaMode);
  applySimFlags(simFlags);
  const lootStats = newLootStats();
  const throwaway = newMetrics();
  const allAmulets = getDefaultAmuletIds();

  const runOne = (overrides = {}) => {
    const extras = buildSimRunExtras(simFlags, {
      allRelics: ALL_RELICS,
      strongAmulets: STRONG_AMULETS,
      allAmulets,
      metaMode,
    });
    runGame(throwaway, {
      ...extras,
      ...overrides,
      lootStats,
      relics: simFlags.enableMeta ? (overrides.relics ?? extras.relics) : [],
      veteranHp: simFlags.enableMeta ? (overrides.veteranHp ?? 0) : 0,
      metaPool: extras.metaPool,
      amuletPool: extras.amuletPool,
    });
  };

  console.log(`\nLoot-stats: ${runs} runs (${metaMode}; ${formatSimFlagsLabel(normalizeSimPools(simFlags, { allRelics: ALL_RELICS, allAmulets, metaMode }))})\n`);

  try {
    if (metaMode === 'accumulate' && simFlags.enableMeta) {
      const extras = buildSimRunExtras(simFlags, {
        allRelics: ALL_RELICS, strongAmulets: STRONG_AMULETS, allAmulets, metaMode,
      });
      const meta = new MetaProgressionManager({});
      meta.characters = {
        rogue: { xp: 0, talents: {}, choices: {} },
        warrior: { xp: 0, talents: {}, choices: {} },
      };
      meta.totalDeaths = 0;
      meta.bestFloor = 1;
      const charId = simFlags.characterId || DEFAULT_CHARACTER_ID;
      for (let i = 0; i < runs; i++) {
        const r = runOne({
          characterId: charId,
          talents: { ...meta.ensureCharacter(charId).talents },
          talentChoices: { ...meta.ensureCharacter(charId).choices },
        });
        if (!r.won) meta.handlePlayerDeath(r.killer, r.reached, charId);
      }
    } else {
      for (let i = 0; i < runs; i++) runOne({});
    }

    reportLootStats(lootStats);
    if (writeJson) {
      const outPath = metaMode === 'balance'
        ? 'sim/output/loot-stats-balance.json'
        : 'sim/output/loot-stats.json';
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, lootStatsToJson(lootStats));
      console.log(`\nJSON written to ${outPath}`);
    }
  } finally {
    clearSimTestOptionsOverride();
  }
}

// ── DB-backed floor stats (3NF SQLite) ───────────────────────────────────
// Usage:
//   node sim/balance-sim.js stats-db [runs] [fresh|geared|accumulate|balance] [name]
//     [--name label] [--db path]
//     [--meta | --no-meta] [--amulets | --no-amulets] [--amulet-loadout none|bag|strong]
//   npm run sim:stats-db-balance -- 1000 my-run --meta --no-amulets
function parseStatsDbArgs() {
  const { positional, flags } = splitSimArgv(stripBehaviorArgs(process.argv.slice(3)));
  let runs = 100;
  let metaMode = 'fresh';
  let runLabel = null;
  let dbPath = DEFAULT_DB_PATH;

  for (const a of positional) {
    const n = parseInt(a, 10);
    if (!Number.isNaN(n) && String(n) === a) {
      runs = n;
      continue;
    }
    if (SIM_META_MODES.has(a)) {
      metaMode = a;
      continue;
    }
    if (!runLabel) runLabel = a;
  }

  const simFlags = parseSimFlags(flags, metaMode);
  const label = runLabel || `stats-db ${metaMode}`;
  return { runs, metaMode, dbPath, label, runLabel, simFlags };
}

function runStatsDb() {
  const { runs, metaMode, dbPath, label, runLabel, simFlags } = parseStatsDbArgs();
  const throwaway = newMetrics();
  const db = new StatsDatabase(dbPath);
  const recorder = new StatsRecorder(db);
  const allAmulets = getDefaultAmuletIds();
  const normFlags = normalizeSimPools(simFlags, { allRelics: ALL_RELICS, allAmulets, metaMode });

  applySimFlags(simFlags);

  const buildRunConfig = (overrides = {}) => {
    const extras = buildSimRunExtras(simFlags, {
      allRelics: ALL_RELICS,
      strongAmulets: STRONG_AMULETS,
      allAmulets,
      metaMode,
    });
    const cfg = {
      statsRecorder: recorder,
      ...extras,
      ...overrides,
      metaPool: extras.metaPool,
      amuletPool: extras.amuletPool,
    };
    if (!simFlags.enableMeta) {
      cfg.relics = [];
      cfg.veteranHp = 0;
    }
    return cfg;
  };

  console.log(`\nStats DB: ${runs} runs → ${dbPath}`);
  console.log(`  label: ${label}${runLabel ? '' : ' (default)'}`);
  console.log(`  preset: ${metaMode}`);
  console.log(`  flags: ${formatSimFlagsLabel(normFlags)}\n`);

  try {
    recorder.beginBatch({
      label,
      mode: metaMode,
      runsPlanned: runs,
      config: {
        noBag: true,
        metaMode,
        runLabel: runLabel || null,
        behaviorPreset: DEFAULT_BEHAVIOR_PRESET,
        characterId: normFlags.characterId || DEFAULT_CHARACTER_ID,
        armorPool: normFlags.armorPool || null,
        talentLoadout: normFlags.talentLoadout || 'none',
        enableMeta: normFlags.enableMeta,
        enableAmulets: normFlags.enableAmulets,
        amuletLoadout: normFlags.amuletLoadout,
        metaPool: normFlags.metaPool,
        metaStart: normFlags.metaStart,
        amuletPool: normFlags.amuletPool,
        amuletStart: normFlags.amuletStart,
      },
    });

    db.runInTransaction(() => {
      if (metaMode === 'accumulate' && simFlags.enableMeta) {
        const meta = new MetaProgressionManager({});
        meta.characters = {
          rogue: { xp: 0, talents: {}, choices: {} },
          warrior: { xp: 0, talents: {}, choices: {} },
        };
        meta.totalDeaths = 0;
        meta.bestFloor = 1;
        const charId = normFlags.characterId || DEFAULT_CHARACTER_ID;
        for (let i = 0; i < runs; i++) {
          recorder.beginRun();
          const r = runGame(throwaway, buildRunConfig({
            characterId: charId,
            talents: { ...meta.ensureCharacter(charId).talents },
            talentChoices: { ...meta.ensureCharacter(charId).choices },
          }));
          recorder.finishRun({
            won: r.won,
            reachedFloor: r.reached,
            died: r.died,
            endReason: r.endReason,
            deathEncounterType: r.deathEncounterType,
          });
          if (!r.won) meta.handlePlayerDeath(r.killer, r.reached, charId);
        }
      } else {
        for (let i = 0; i < runs; i++) {
          recorder.beginRun();
          const r = runGame(throwaway, buildRunConfig());
          recorder.finishRun({
            won: r.won,
            reachedFloor: r.reached,
            died: r.died,
            endReason: r.endReason,
            deathEncounterType: r.deathEncounterType,
          });
        }
      }
      recorder.finishBatch(runs);
    });

    const batchId = recorder.batchId;
    const summary = db.query(`
      SELECT
        b.id AS batch_id,
        b.runs_completed,
        COUNT(DISTINCT r.id) AS runs,
        COUNT(fv.id) AS floor_visits,
        COUNT(DISTINCT fv.floor_number) AS distinct_floors,
        SUM(CASE WHEN fv.encounter_type IN ('COMBAT','ELITE','BOSS') THEN 1 ELSE 0 END) AS combat_visits,
        (SELECT COUNT(*) FROM sim_weapon_snapshots w
         JOIN sim_floor_visits fv2 ON fv2.id = w.floor_visit_id
         JOIN sim_runs r2 ON r2.id = fv2.run_id WHERE r2.batch_id = b.id) AS weapon_rows,
        (SELECT COUNT(*) FROM sim_enemy_spawns e
         JOIN sim_floor_visits fv3 ON fv3.id = e.floor_visit_id
         JOIN sim_runs r3 ON r3.id = fv3.run_id WHERE r3.batch_id = b.id) AS enemy_rows
      FROM sim_batches b
      LEFT JOIN sim_runs r ON r.batch_id = b.id
      LEFT JOIN sim_floor_visits fv ON fv.run_id = r.id
      WHERE b.id = @batchId
      GROUP BY b.id
    `, { batchId });

    if (summary[0]) {
      const s = summary[0];
      console.log('Batch saved:');
      console.log(`  batch_id=${s.batch_id}  label=${label}`);
      console.log(`  runs=${s.runs}  floor_visits=${s.floor_visits}`);
      console.log(`  combat_visits=${s.combat_visits}  weapon_rows=${s.weapon_rows}  enemy_rows=${s.enemy_rows}`);
    }
  } finally {
    clearSimTestOptionsOverride();
    db.close();
  }
}

// ── main ──────────────────────────────────────────────────────────────────
function runFresh() {
  const { positional, flags } = splitSimArgv(stripBehaviorArgs(process.argv.slice(3)));
  let runs = 500;
  for (const a of positional) {
    const n = parseInt(a, 10);
    if (!Number.isNaN(n) && String(n) === a) {
      runs = n;
      break;
    }
  }
  const simFlags = parseSimFlags(flags, 'fresh');
  const allAmulets = getDefaultAmuletIds();
  const normFlags = normalizeSimPools(simFlags, {
    allRelics: ALL_RELICS,
    allAmulets,
    metaMode: 'fresh',
  });
  const extras = buildSimRunExtras(simFlags, {
    allRelics: ALL_RELICS,
    strongAmulets: STRONG_AMULETS,
    allAmulets,
    metaMode: 'fresh',
  });
  const characterId = extras.characterId || DEFAULT_CHARACTER_ID;
  const armorPool = extras.armorPool || null;
  const metrics = newMetrics();
  let weaponDeaths = 0;
  let hpDeaths = 0;
  const armorLabel = armorPool ? armorPool.join('+') : 'class-default';
  console.log(
    `\nFresh: ${runs} runs, character=${characterId}, armor=${armorLabel},` +
    ` talents=${normFlags.talentLoadout || 'none'}`
  );
  // 0 starting amulets; mid-run drops/shops/events use the full (non-old) pool.
  applySimFlags(simFlags);
  try {
    for (let i = 0; i < runs; i++) {
      const r = runGame(metrics, extras);
      if (r.endReason === 'weapon') weaponDeaths++;
      else if (r.endReason === 'hp') hpDeaths++;
    }
  } finally {
    clearSimTestOptionsOverride();
  }
  report(metrics);
  const deaths = Math.max(1, weaponDeaths + hpDeaths);
  const floors = metrics.finalFloors;
  const reach15 = (100 * floors.filter((f) => f >= 15).length) / floors.length;
  const reach30 = (100 * floors.filter((f) => f >= 30).length) / floors.length;
  console.log(`\nReach F15=${reach15.toFixed(0)}%  F30=${reach30.toFixed(0)}%`);
  console.log(
    `Death reasons among dead: weapon=${((100 * weaponDeaths) / deaths).toFixed(0)}%` +
    `  hp=${((100 * hpDeaths) / deaths).toFixed(0)}%` +
    `  (n=${weaponDeaths + hpDeaths})`
  );
}
function writeSimulatorSummary(metrics, outputPath) {
  if (!metrics || !outputPath) return;
  const runs = metrics.runs || 1;
  const finalFloorMean = metrics.finalFloors.length
    ? metrics.finalFloors.reduce((sum, floor) => sum + floor, 0) / metrics.finalFloors.length
    : 0;
  const summary = {
    schemaVersion: 1,
    source: 'simulator-summary',
    createdAt: new Date().toISOString(),
    seed: SIM_SEED,
    behaviorPreset: DEFAULT_BEHAVIOR_PRESET || 'balanced',
    characterId: DEFAULT_CHARACTER_ID,
    runs,
    outcome: {
      wins: metrics.wins,
      winRate: metrics.wins / runs,
      finalFloorMean,
    },
    durability: {
      weaponBreaksPerRun: metrics.weaponBreaks / runs,
      lastPipWeaponAttacksPerRun: metrics.lastPipWeaponAttacks / runs,
      mergedLastPipWeaponAttacksPerRun: metrics.mergedLastPipWeaponAttacks / runs,
      avoidableLastPipWeaponAttacksPerRun: metrics.avoidableLastPipWeaponAttacks / runs,
      lastPipPreservationsPerRun: (metrics.lookahead?.lastPipPreservations || 0) / runs,
      lastPipEmergencyUsesPerRun: (metrics.lookahead?.lastPipEmergencyUses || 0) / runs,
      lastPipAttackReasons: { ...(metrics.lookahead?.lastPipAttackReasons || {}) },
      forcedLastPipByFloor: { ...(metrics.lookahead?.forcedLastPipByFloor || {}) },
      forcedLastPipByRoom: { ...(metrics.lookahead?.forcedLastPipByRoom || {}) },
      weaponMergesPerRun: metrics.weaponMerges / runs,
      daggerRefreshMergesPerRun: metrics.daggerRefreshMerges / runs,
      anvilRepairsPerRun: metrics.repairActions / runs,
      repairedPipsPerRun: metrics.repairPips / runs,
    },
    resources: {
      restorationUsesPerRun: metrics.restorationUses / runs,
      usefulVisibleLootPerRun: (metrics.combatLoot?.pickups || 0) / runs,
      gemsSeenPerRun: metrics.gemsSeen.length
        ? metrics.gemsSeen.reduce((sum, count) => sum + count, 0) / metrics.gemsSeen.length
        : 0,
    },
    mergeFirst: {
      enabled: MERGE_FIRST_PLANNER_ENABLED,
      plannedPickupsPerRun: (metrics.mergeFirst?.plannedPickups || 0) / runs,
      cascadeReplacementsPerRun: (metrics.mergeFirst?.cascadeReplacements || 0) / runs,
      spacePotionsPerRun: (metrics.mergeFirst?.spacePotions || 0) / runs,
      healthyDaggerPairMergesPerRun:
        (metrics.mergeFirst?.healthyDaggerPairMerges || 0) / runs,
    },
    shopPlanning: {
      regularVisitsPerRun: (metrics.shopPlanning?.regularVisits || 0) / runs,
      rareVisitsPerRun: (metrics.shopPlanning?.rareVisits || 0) / runs,
      purchasesPerRun: (metrics.shopPlanning?.purchases || 0) / runs,
      cascadePurchasesPerRun: (metrics.shopPlanning?.cascadePurchases || 0) / runs,
      potionsUsedPerRun: (metrics.shopPlanning?.potionsUsed || 0) / runs,
      foodUsedPerRun: (metrics.shopPlanning?.foodUsed || 0) / runs,
      gemsSocketedPerRun: (metrics.shopPlanning?.gemsSocketed || 0) / runs,
      slotsFreedPerRun: (metrics.shopPlanning?.slotsFreed || 0) / runs,
      salesPerRun: (metrics.shopPlanning?.sales || 0) / runs,
      saleCoinsPerRun: (metrics.shopPlanning?.saleCoins || 0) / runs,
      purchasesByType: { ...(metrics.shopPlanning?.purchasesByType || {}) },
    },
    routing: {
      roomVisits: { ...(metrics.roomVisits || {}) },
      optionalFightVisitsPerRun:
        ((metrics.roomVisits?.COMBAT || 0) + (metrics.roomVisits?.ELITE || 0)) / runs,
      optionalFightShare: Object.values(metrics.roomVisits || {}).reduce(
        (sum, count) => sum + count,
        0,
      )
        ? ((metrics.roomVisits?.COMBAT || 0) + (metrics.roomVisits?.ELITE || 0))
          / Object.values(metrics.roomVisits || {}).reduce((sum, count) => sum + count, 0)
        : 0,
    },
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(summary, null, 2));
  console.log(`Simulator summary written to ${outputPath}`);
}

// ── Act × character × meta ladder matrix ───────────────────────────────────
// Usage: node sim/balance-sim.js actmatrix [runs]
// Pins Thornwake roster; --act slice; mid-act weapon rarity + random amulets.
// Win = cleared that act's boss floor. Writes sim/output/act-meta-matrix.json
function runActMetaMatrix() {
  const args = stripBehaviorArgs(process.argv.slice(3));
  let runs = 10000;
  for (const a of args) {
    if (/^\d+$/.test(a)) runs = parseInt(a, 10);
  }

  const allAmulets = getDefaultAmuletIds();
  const metaSteps = []; // shared column ids: none, step1..stepN, full
  const rogueConfigs = buildTalentLadderConfigs('rogue');
  const warriorConfigs = buildTalentLadderConfigs('warrior');
  const stepCount = Math.max(rogueConfigs.length, warriorConfigs.length);
  for (let s = 0; s < stepCount; s++) {
    const id = s === 0 ? 'none' : (s === stepCount - 1 ? 'full' : `step${s}`);
    metaSteps.push({
      id,
      index: s,
      rogueLabel: rogueConfigs[s]?.label || `step${s}`,
      warriorLabel: warriorConfigs[s]?.label || `step${s}`,
    });
  }

  const results = [];
  const characters = ['rogue', 'warrior'];
  const acts = [1, 2, 3];
  const totalCombos = characters.length * acts.length * stepCount;
  let done = 0;
  const tMatrix = Date.now();

  console.log(`\n=== Act × meta matrix — ${runs} runs × ${totalCombos} combos ===`);
  console.log('month=thornwake (pinned)  mid-act starters + amulet seed  noBag  amulet drops off\n');

  for (const characterId of characters) {
    const configs = characterId === 'rogue' ? rogueConfigs : warriorConfigs;
    for (const act of acts) {
      const rowWins = {};
      for (let s = 0; s < stepCount; s++) {
        const cfg = configs[s] || configs[configs.length - 1];
        const stepMeta = metaSteps[s];
        const hasTalents = cfg.talents && Object.keys(cfg.talents).length > 0;
        setSimTestOptionsOverride({
          [TEST_OPTION_IDS.disableMetaProgression]: !hasTalents,
          [TEST_OPTION_IDS.disableAmulets]: true,
        });

        const seedN = actStartAmuletCount(act);
        const amulets = seedN > 0 ? sampleAmuletIds(allAmulets, seedN) : [];
        // Re-sample amulets each run inside the loop for independence.
        const m = newMetrics();
        for (let i = 0; i < runs; i++) {
          let talentChoices = cfg.talentChoices;
          if (cfg.randomArmorer) {
            talentChoices = {
              armorerArmorType: Math.random() < 0.5 ? 'chain' : 'plate',
            };
          }
          const runAmulets = seedN > 0 ? sampleAmuletIds(allAmulets, seedN) : [];
          runGame(m, {
            characterId,
            act,
            calendarMonthIndex: 0,
            pinCalendarMonth: true,
            startingWeaponRarity: actStartWeaponRarity(act),
            talents: hasTalents ? { ...cfg.talents } : {},
            talentChoices,
            amulets: runAmulets,
            forceStartingAmulets: runAmulets.length > 0,
            noBag: true,
            amuletPool: [],
          });
        }
        clearSimTestOptionsOverride();

        const winPct = (100 * m.wins) / runs;
        rowWins[stepMeta.id] = {
          winPct,
          wins: m.wins,
          meanFloor: m.finalFloors.reduce((a, b) => a + b, 0) / Math.max(1, m.finalFloors.length),
          label: characterId === 'rogue' ? stepMeta.rogueLabel : stepMeta.warriorLabel,
        };
        done++;
        const elapsed = ((Date.now() - tMatrix) / 1000).toFixed(1);
        console.log(
          `[${done}/${totalCombos}] ${characterId} act${act} ${stepMeta.id.padEnd(6)}`
          + ` win=${winPct.toFixed(2)}%  (${elapsed}s)`
        );
      }
      results.push({
        characterId,
        act,
        rowKey: `Act ${act} / ${characterId}`,
        winsByMeta: rowWins,
      });
    }
  }

  const out = {
    runs,
    generatedAt: new Date().toISOString(),
    month: 'thornwake',
    pinCalendarMonth: true,
    winDefinition: 'cleared act boss floor (act*15)',
    metaSteps,
    results,
    elapsedSec: (Date.now() - tMatrix) / 1000,
  };

  const outputPath = 'sim/output/act-meta-matrix.json';
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${outputPath}`);

  // Console table: rows = Act/Character, columns = meta step ids
  const colIds = metaSteps.map((s) => s.id);
  console.log('\nWin% (act boss):');
  console.log('row'.padEnd(22) + colIds.map((id) => id.padStart(8)).join(''));
  for (const row of results) {
    const cells = colIds.map((id) => {
      const v = row.winsByMeta[id]?.winPct;
      return (v == null ? '—' : v.toFixed(1)).padStart(8);
    });
    console.log(row.rowKey.padEnd(22) + cells.join(''));
  }
}

const MODE = process.argv[2];
const t0 = Date.now();
if (MODE === 'reliccompare' || MODE === 'talentcompare') {
  runTalentCompare();
} else if (MODE === 'talentladder') {
  runTalentLadder();
} else if (MODE === 'actmatrix') {
  runActMetaMatrix();
} else if (MODE === 'fresh') {
  runFresh();
} else if (MODE === 'sweep') {
  runSweep();
} else if (MODE === 'career') {
  runCareer();
} else if (MODE === 'loadout') {
  runLoadout();
} else if (MODE === 'geared') {
  runGeared();
} else if (MODE === 'weapontest') {
  const runs = parseInt(process.argv[3], 10) || RUNS;
  console.log('\nIsolation test: bot wields an unbreakable legendary axe (16 dmg, 3 poison gems).');
  const metrics = newMetrics();
  for (let i = 0; i < runs; i++) runGame(metrics, { relics: ALL_RELICS, superWeapon: true });
  report(metrics);
} else if (MODE === 'loot-stats') {
  runLootStats();
} else if (MODE === 'stats-db') {
  runStatsDb();
} else {
  // Default run models a fully-progressed account: ALL relics + Bottomless Bag.
  const metrics = newMetrics();
  for (let i = 0; i < RUNS; i++) runGame(metrics, { relics: ALL_RELICS });
  report(metrics);
}
if (SUMMARY_JSON_PATH && LAST_REPORTED_METRICS) {
  writeSimulatorSummary(LAST_REPORTED_METRICS, SUMMARY_JSON_PATH);
}
console.log(`\nElapsed ${((Date.now() - t0) / 1000).toFixed(2)}s`);

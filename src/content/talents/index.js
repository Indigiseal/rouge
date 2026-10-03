// Talent content pack registry.

import { TALENT_BRANCHES, TALENT_RANK_COSTS } from './branches.js';
import { tuned } from '../balance/Tuning.js';
import { getTalentDisplay } from './displayCopy.js';
import { createArmorCardData } from '../cards/armor.js';
import keenEdge from './nodes/keenEdge.js';
import firstBlood from './nodes/firstBlood.js';
import twinFang from './nodes/twinFang.js';
import prospector from './nodes/prospector.js';
import momentum from './nodes/momentum.js';
import shadowStep from './nodes/shadowStep.js';
import scarTissue from './nodes/scarTissue.js';
import frontVolley from './nodes/frontVolley.js';
import assassinate from './nodes/assassinate.js';
import softSteps from './nodes/softSteps.js';
import secondSkin from './nodes/secondSkin.js';
import slippery from './nodes/slippery.js';
import shadowRest from './nodes/shadowRest.js';
import bloodthirst from './nodes/bloodthirst.js';
import toolKit from './nodes/toolKit.js';
import luckyDraw from './nodes/luckyDraw.js';
import poisonTip from './nodes/poisonTip.js';
import scavengerKit from './nodes/scavengerKit.js';
import quietKill from './nodes/quietKill.js';
import hardened from './nodes/hardened.js';
import lastStand from './nodes/lastStand.js';
import executioner from './nodes/executioner.js';
import heavyEdge from './nodes/heavyEdge.js';
import grindstone from './nodes/grindstone.js';
import ironHide from './nodes/ironHide.js';
import reprisal from './nodes/reprisal.js';
import counterDrill from './nodes/counterDrill.js';
import bulwark from './nodes/bulwark.js';
import armorerStart from './nodes/armorerStart.js';
import rivets from './nodes/rivets.js';
import veteranGrip from './nodes/veteranGrip.js';
import sharpened from './nodes/sharpened.js';
import heavyHands from './nodes/heavyHands.js';
import bloodPrice from './nodes/bloodPrice.js';
import executionersEye from './nodes/executionersEye.js';
import ironStomach from './nodes/ironStomach.js';
import fieldRations from './nodes/fieldRations.js';
import muster from './nodes/muster.js';
import smithyFavor from './nodes/smithyFavor.js';
import secondWind from './nodes/secondWind.js';

export { TALENT_BRANCHES, TALENT_RANK_COSTS };
export { TALENT_DISPLAY, getTalentDisplay } from './displayCopy.js';

function freezeTalentNode(node) {
  if (!node) return null;
  const copy = getTalentDisplay(node.id);
  return Object.freeze({
    ...node,
    name: copy?.name ?? node.name,
    // The node file wins. Descriptions are written FROM the values, so keeping a
    // second authored copy guarantees they drift apart the moment the numbers
    // change — and they did: displayCopy went on showing Twin Fang as a
    // percentage bonus for a build where it had already become flat damage.
    // displayCopy still supplies names (ASCII-safe for the pixel font).
    descriptionRanks: Object.freeze([...(node.descriptionRanks || copy?.descriptionRanks || [])]),
    values: Object.freeze([...(node.values || [])]),
  });
}

/** @type {Record<string, object>} */
export const TALENT_NODES = Object.freeze({
  keenEdge: freezeTalentNode(keenEdge),
  firstBlood: freezeTalentNode(firstBlood),
  twinFang: freezeTalentNode(twinFang),
  prospector: freezeTalentNode(prospector),
  momentum: freezeTalentNode(momentum),
  shadowStep: freezeTalentNode(shadowStep),
  scarTissue: freezeTalentNode(scarTissue),
  frontVolley: freezeTalentNode(frontVolley),
  assassinate: freezeTalentNode(assassinate),
  softSteps: freezeTalentNode(softSteps),
  secondSkin: freezeTalentNode(secondSkin),
  slippery: freezeTalentNode(slippery),
  shadowRest: freezeTalentNode(shadowRest),
  bloodthirst: freezeTalentNode(bloodthirst),
  toolKit: freezeTalentNode(toolKit),
  luckyDraw: freezeTalentNode(luckyDraw),
  poisonTip: freezeTalentNode(poisonTip),
  scavengerKit: freezeTalentNode(scavengerKit),
  quietKill: freezeTalentNode(quietKill),
  hardened: freezeTalentNode(hardened),
  lastStand: freezeTalentNode(lastStand),
  executioner: freezeTalentNode(executioner),
  heavyEdge: freezeTalentNode(heavyEdge),
  grindstone: freezeTalentNode(grindstone),
  ironHide: freezeTalentNode(ironHide),
  reprisal: freezeTalentNode(reprisal),
  counterDrill: freezeTalentNode(counterDrill),
  bulwark: freezeTalentNode(bulwark),
  armorerStart: freezeTalentNode(armorerStart),
  rivets: freezeTalentNode(rivets),
  veteranGrip: freezeTalentNode(veteranGrip),
  sharpened: freezeTalentNode(sharpened),
  heavyHands: freezeTalentNode(heavyHands),
  bloodPrice: freezeTalentNode(bloodPrice),
  executionersEye: freezeTalentNode(executionersEye),
  ironStomach: freezeTalentNode(ironStomach),
  fieldRations: freezeTalentNode(fieldRations),
  muster: freezeTalentNode(muster),
  smithyFavor: freezeTalentNode(smithyFavor),
  secondWind: freezeTalentNode(secondWind),
});

/**
 * Rank value for a talent, through the sim's tuning overlay.
 * Sweeps replace 'talent.<id>.values' instead of rewriting this file.
 */
export function talentValue(talentId, rank, fallback = 0) {
  const node = TALENT_NODES[talentId];
  if (!node || rank <= 0) return fallback;
  const values = tuned(`talent.${talentId}.values`, node.values);
  const value = Array.isArray(values) ? values[rank - 1] : undefined;
  return value === undefined ? fallback : value;
}

export function getTalentNode(talentId) {
  return TALENT_NODES[talentId] || null;
}

export function getBranchesForCharacter(characterId) {
  return TALENT_BRANCHES[characterId] || [];
}

/** Previous node in the same branch column, or null if this is the first. */
export function getPreviousTalentId(characterId, talentId) {
  for (const branch of getBranchesForCharacter(characterId)) {
    const idx = branch.nodes.indexOf(talentId);
    if (idx < 0) continue;
    if (idx === 0) return null;
    return branch.nodes[idx - 1];
  }
  return null;
}

export function isBranchPurchasable(characterId, branchId) {
  const branch = getBranchesForCharacter(characterId).find((b) => b.id === branchId);
  return Boolean(branch?.purchasable);
}

export function costForNextRank(currentRank) {
  if (currentRank < 0) return TALENT_RANK_COSTS[0];
  if (currentRank >= TALENT_RANK_COSTS.length) return null;
  return TALENT_RANK_COSTS[currentRank];
}

export function totalCostForRanks(fromRank, toRank) {
  let sum = 0;
  for (let r = fromRank; r < toRank; r++) {
    const c = costForNextRank(r);
    if (c == null) return null;
    sum += c;
  }
  return sum;
}

/**
 * Resolve owned talent ranks into a flat runtime bag for a run.
 * Only live (non-WIP / purchasable branch) effects are applied, even if
 * save data somehow contains WIP ranks.
 */
/**
 * Value of a rank that is a depth accumulator rather than a constant.
 *
 * A flat rank spends all of its worth in the first floors and has nothing left
 * deep in a run — measured, the whole tree bought 3.6x more chance of passing
 * the act-1 gate than of progressing past it. A rank here buys a RATE and a CAP
 * instead: rank 1 reaches a low ceiling almost immediately (so it still feels
 * like something early), high ranks keep climbing far deeper. The gap between
 * ranks therefore widens with depth on its own, with no notion of "act" in the
 * arithmetic.
 */
/**
 * Integer accumulator: +1 every `perFloors` floors cleared, never past `cap`.
 *
 * This game is played in whole numbers — enemies have 8 to 22 HP, weapons deal
 * 3 to 16. A percentage bonus on those does not survive contact with the
 * rounding: `ceil(5 * 1.03)` and `ceil(5 * 1.12)` are both 6, so a node whose
 * ranks read 3/5/7/9/12% produced the exact same damage at every rank, and four
 * of the five purchases changed nothing at all. Anything that lands on damage,
 * HP or AP is counted in whole points here.
 *
 * Percentages are still the right shape for things that are ROLLED rather than
 * rounded — dodge, crit chance, proc chance — because there the fraction is the
 * probability itself and nothing truncates it.
 */
export function accumulateSteps(spec, floorsCleared) {
  if (typeof spec === 'number') return spec;
  // `base` pays from the first floor, the rest accrues. A node that is meant to
  // feel like something at rank 1 needs a base; a node that is meant to be a
  // deep-run reward should not have one. Keen Edge at a flat +5 was the whole
  // reason a maxed tree walked through act 1 — five extra damage against a
  // starting weapon that deals three.
  const base = Number(spec?.base) || 0;
  const perFloors = Math.max(1, Number(spec?.perFloors) || 1);
  const cap = Number(spec?.cap);
  const steps = Math.floor(Math.max(0, Math.floor(floorsCleared) || 0) / perFloors);
  const grown = Number.isFinite(cap) ? Math.min(cap, steps) : steps;
  return base + grown;
}

export function accumulate(spec, floorsCleared) {
  if (typeof spec === 'number') return spec;
  const perFloor = Number(spec?.perFloor) || 0;
  const cap = Number(spec?.cap);
  const raw = perFloor * Math.max(0, Math.floor(floorsCleared) || 0);
  return Number.isFinite(cap) ? Math.min(cap, raw) : raw;
}

export function resolveTalentEffects(characterId, talents = {}, choices = {}, context = {}) {
  const floorsCleared = Math.max(0, Number(context.floorsCleared) || 0);
  const effects = {
    keenEdgeBonus: 0,
    firstBloodFlat: 0,
    twinFangFlat: 0,
    scarTissueHp: 0,
    shadowStepDodge: 0,
    weaponDurabilitySave: 0,
    prospectorCrystals: 0,
    secondWindCharges: 0,
    secondWindHealPct: 0,
    frontVolleyFlat: 0,
    assassinateThreshold: 0,
    hardenedMaxDur: 0,
    hardenedDef: 0,
    hardenedProcBonus: 0,
    counterDrillBonus: 0,
    bulwarkBonus: 0,
    rivetsChance: 0,
    reprisalFlat: 0,
    heavyEdgeFlat: 0,
    armorerArmorType: null,
    armorerArmorRarity: null,
  };

  const rankOf = (id) => Math.max(0, Number(talents[id]) || 0);

  const keen = rankOf('keenEdge');
  if (keen > 0 && characterId === 'rogue') {
    effects.keenEdgeBonus = accumulateSteps(talentValue('keenEdge', keen, 0), floorsCleared);
  }
  const fb = rankOf('firstBlood');
  if (fb > 0 && characterId === 'rogue') {
    effects.firstBloodFlat = accumulateSteps(talentValue('firstBlood', fb, 0), floorsCleared);
  }
  const twin = rankOf('twinFang');
  if (twin > 0 && characterId === 'rogue') {
    effects.twinFangFlat = accumulateSteps(talentValue('twinFang', twin, 0), floorsCleared);
  }
  const volley = rankOf('frontVolley');
  if (volley > 0 && characterId === 'rogue') {
    effects.frontVolleyFlat = accumulateSteps(talentValue('frontVolley', volley, 0), floorsCleared);
  }
  const scar = rankOf('scarTissue');
  if (scar > 0) {
    effects.scarTissueHp = accumulateSteps(talentValue('scarTissue', scar, 0), floorsCleared);
  }
  const step = rankOf('shadowStep');
  if (step > 0) {
    effects.shadowStepDodge = accumulate(talentValue('shadowStep', step, 0), floorsCleared);
  }
  const mom = rankOf('momentum');
  if (mom > 0) {
    effects.weaponDurabilitySave = accumulate(talentValue('momentum', mom, 0), floorsCleared);
  }
  const pros = rankOf('prospector');
  if (pros > 0) {
    effects.prospectorCrystals = accumulateSteps(talentValue('prospector', pros, 0), floorsCleared);
  }
  const wind = rankOf('secondWind');
  if (wind > 0) {
    const spec = talentValue('secondWind', wind, null);
    effects.secondWindCharges = spec?.charges || 0;
    effects.secondWindHealPct = spec?.heal || 0;
  }
  const ash = rankOf('assassinate');
  if (ash > 0 && characterId === 'rogue') {
    effects.assassinateThreshold = talentValue('assassinate', ash, 0);
  }

  const hard = rankOf('hardened');
  if (hard > 0 && characterId === 'warrior') {
    effects.hardenedMaxDur = 1;
    effects.hardenedDef = accumulateSteps(talentValue('hardened', hard, 0), floorsCleared);
    if (hard >= 4) effects.hardenedProcBonus = 0.05;
  }
  // Warrior nodes that reuse a mechanic the rogue branch already wires. Same
  // effect keys, different node ids, so nothing downstream needs to know which
  // class bought them.
  const hide = rankOf('ironHide');
  if (hide > 0 && characterId === 'warrior') {
    effects.scarTissueHp = accumulateSteps(talentValue('ironHide', hide, 0), floorsCleared);
  }
  const grind = rankOf('grindstone');
  if (grind > 0 && characterId === 'warrior') {
    effects.weaponDurabilitySave = accumulate(talentValue('grindstone', grind, 0), floorsCleared);
  }
  const exec = rankOf('executioner');
  if (exec > 0 && characterId === 'warrior') {
    effects.assassinateThreshold = talentValue('executioner', exec, 0);
  }
  const stand = rankOf('lastStand');
  if (stand > 0 && characterId === 'warrior') {
    const spec = talentValue('lastStand', stand, null);
    effects.secondWindCharges = spec?.charges || 0;
    effects.secondWindHealPct = spec?.heal || 0;
  }
  const heavy = rankOf('heavyEdge');
  if (heavy > 0 && characterId === 'warrior') {
    effects.heavyEdgeFlat = accumulateSteps(talentValue('heavyEdge', heavy, 0), floorsCleared);
  }
  const cd = rankOf('counterDrill');
  if (cd > 0 && characterId === 'warrior' && !TALENT_NODES.counterDrill.wip) {
    effects.counterDrillBonus = talentValue('counterDrill', cd, 0);
  }
  const rep = rankOf('reprisal');
  if (rep > 0 && characterId === 'warrior') {
    // Whole points. As a fraction of blocked damage this rounded to 0 or 1 on
    // any realistic DEF value, which is the same trap Twin Fang fell into.
    effects.reprisalFlat = accumulateSteps(talentValue('reprisal', rep, 0), floorsCleared);
  }
  const bw = rankOf('bulwark');
  if (bw > 0 && characterId === 'warrior') {
    effects.bulwarkBonus = talentValue('bulwark', bw, 0);
  }
  const riv = rankOf('rivets');
  if (riv > 0 && characterId === 'warrior') {
    effects.rivetsChance = talentValue('rivets', riv, 0);
  }
  if (rankOf('armorerStart') > 0 && characterId === 'warrior') {
    // Armor type is chosen on the run-start pick screen (or sim override),
    // not stored as a permanent purchase choice.
    const pick = choices.runArmorerArmorType || choices.armorerArmorType;
    if (pick === 'chain' || pick === 'plate') effects.armorerArmorType = pick;
    effects.armorerArmorRarity = talentValue('armorerStart', rankOf('armorerStart'), 'uncommon');
  }

  return effects;
}

/** Mutate an armor card in place with Hardened / Counter Drill / Bulwark. */
export function applyArmorTalentMods(armor, talentEffects) {
  if (!armor || !talentEffects) return armor;
  if (talentEffects.villageArmoryDef > 0) {
    armor.protection = (armor.protection || 0) + talentEffects.villageArmoryDef;
  }
  const type = armor.armorType;
  if (type !== 'chain' && type !== 'plate') return armor;

  if (talentEffects.hardenedMaxDur > 0) {
    armor.maxDurability = (armor.maxDurability || armor.durability || 0) + talentEffects.hardenedMaxDur;
    armor.durability = Math.min(
      armor.maxDurability,
      (armor.durability || 0) + talentEffects.hardenedMaxDur
    );
  }
  if (talentEffects.hardenedDef > 0) {
    armor.protection = (armor.protection || 0) + talentEffects.hardenedDef;
  }
  if (type === 'chain') {
    const bonus = (talentEffects.counterDrillBonus || 0)
      + (talentEffects.bulwarkBonus || 0)
      + (talentEffects.hardenedProcBonus || 0);
    if (bonus > 0 && armor.meleeCounterChance != null) {
      armor.meleeCounterChance = Math.min(1, armor.meleeCounterChance + bonus);
    }
  }
  if (type === 'plate') {
    const bonus = (talentEffects.bulwarkBonus || 0) + (talentEffects.hardenedProcBonus || 0);
    if (bonus > 0 && armor.rangedIgnoreChance != null) {
      armor.rangedIgnoreChance = Math.min(1, armor.rangedIgnoreChance + bonus);
    }
  }
  return armor;
}

export function createStartingTalentArmor(armorType, talentEffects) {
  if (armorType !== 'chain' && armorType !== 'plate') return null;
  // Rarity comes from the node's rank — that IS what the later ranks buy.
  // Spawn floor is ignored for talent starters.
  const rarity = talentEffects?.armorerArmorRarity || 'uncommon';
  const card = createArmorCardData(armorType, rarity);
  if (!card) return null;
  return applyArmorTalentMods(card, talentEffects);
}

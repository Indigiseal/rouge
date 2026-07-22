// Talent content pack registry.

import { TALENT_BRANCHES, TALENT_RANK_COSTS } from './branches.js';
import { getTalentDisplay } from './displayCopy.js';
import { createArmorCardData } from '../cards/armor.js';
import keenEdge from './nodes/keenEdge.js';
import firstBlood from './nodes/firstBlood.js';
import twinFang from './nodes/twinFang.js';
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
    descriptionRanks: Object.freeze([...(copy?.descriptionRanks || node.descriptionRanks || [])]),
    values: Object.freeze([...(node.values || [])]),
  });
}

/** @type {Record<string, object>} */
export const TALENT_NODES = Object.freeze({
  keenEdge: freezeTalentNode(keenEdge),
  firstBlood: freezeTalentNode(firstBlood),
  twinFang: freezeTalentNode(twinFang),
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
export function resolveTalentEffects(characterId, talents = {}, choices = {}) {
  const effects = {
    keenEdgeBonus: 0,
    firstBloodPct: 0,
    twinFangPct: 0,
    frontVolleyPct: 0,
    assassinateThreshold: 0,
    hardenedMaxDur: 0,
    hardenedDef: 0,
    hardenedProcBonus: 0,
    counterDrillBonus: 0,
    bulwarkBonus: 0,
    rivetsChance: 0,
    reprisalReflectPct: 0,
    armorerArmorType: null,
  };

  const rankOf = (id) => Math.max(0, Number(talents[id]) || 0);

  const keen = rankOf('keenEdge');
  if (keen > 0 && characterId === 'rogue') {
    effects.keenEdgeBonus = TALENT_NODES.keenEdge.values[keen - 1] || 0;
  }
  const fb = rankOf('firstBlood');
  if (fb > 0 && characterId === 'rogue') {
    effects.firstBloodPct = TALENT_NODES.firstBlood.values[fb - 1] || 0;
  }
  const twin = rankOf('twinFang');
  if (twin > 0 && characterId === 'rogue') {
    effects.twinFangPct = TALENT_NODES.twinFang.values[twin - 1] || 0;
  }
  const volley = rankOf('frontVolley');
  if (volley > 0 && characterId === 'rogue') {
    effects.frontVolleyPct = TALENT_NODES.frontVolley.values[volley - 1] || 0;
  }
  const ash = rankOf('assassinate');
  if (ash > 0 && characterId === 'rogue') {
    effects.assassinateThreshold = TALENT_NODES.assassinate.values[ash - 1] || 0;
  }

  const hard = rankOf('hardened');
  if (hard > 0 && characterId === 'warrior') {
    effects.hardenedMaxDur = 1;
    effects.hardenedDef = TALENT_NODES.hardened.values[hard - 1] || hard;
    if (hard >= 3) effects.hardenedProcBonus = 0.05;
  }
  const cd = rankOf('counterDrill');
  if (cd > 0 && characterId === 'warrior' && !TALENT_NODES.counterDrill.wip) {
    effects.counterDrillBonus = TALENT_NODES.counterDrill.values[cd - 1] || 0;
  }
  const rep = rankOf('reprisal');
  if (rep > 0 && characterId === 'warrior') {
    effects.reprisalReflectPct = TALENT_NODES.reprisal.values[rep - 1] || 0;
  }
  const bw = rankOf('bulwark');
  if (bw > 0 && characterId === 'warrior') {
    effects.bulwarkBonus = TALENT_NODES.bulwark.values[bw - 1] || 0;
  }
  const riv = rankOf('rivets');
  if (riv > 0 && characterId === 'warrior') {
    effects.rivetsChance = TALENT_NODES.rivets.values[riv - 1] || 0;
  }
  if (rankOf('armorerStart') > 0 && characterId === 'warrior') {
    // Armor type is chosen on the run-start pick screen (or sim override),
    // not stored as a permanent purchase choice.
    const pick = choices.runArmorerArmorType || choices.armorerArmorType;
    if (pick === 'chain' || pick === 'plate') effects.armorerArmorType = pick;
  }

  return effects;
}

/** Mutate an armor card in place with Hardened / Counter Drill / Bulwark. */
export function applyArmorTalentMods(armor, talentEffects) {
  if (!armor || !talentEffects) return armor;
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
  // Uncommon from the armor catalog — spawn floor ignored for talent starters.
  const card = createArmorCardData(armorType, 'uncommon');
  if (!card) return null;
  return applyArmorTalentMods(card, talentEffects);
}

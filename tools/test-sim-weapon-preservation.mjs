import assert from 'node:assert/strict';

import {
  chooseWeaponPreservingAttack,
  effectiveExpendableWeaponPips,
  weaponMergeCapitalUnits,
} from '../sim/weapon-preservation.js';

function candidate(name, {
  rarity = 'common',
  durability = 2,
  score = 0,
  unsafe = false,
  endsBossFight = false,
  gemEffect = null,
  gemCount = 0,
} = {}) {
  return {
    weapon: { name, rarity, durability, gemEffect, gemCount },
    spendsLastPip: durability === 1,
    score,
    unsafe,
    endsBossFight,
  };
}

assert.equal(weaponMergeCapitalUnits({ rarity: 'common' }), 1);
assert.equal(weaponMergeCapitalUnits({ rarity: 'rare' }), 4);
assert.equal(weaponMergeCapitalUnits({ rarity: 'legendary' }), 16);

assert.equal(effectiveExpendableWeaponPips([
  { type: 'weapon', weaponType: 'sword', durability: 5 },
]), 4);
assert.equal(effectiveExpendableWeaponPips([
  { type: 'weapon', weaponType: 'dagger', durability: 5 },
  { type: 'weapon', weaponType: 'dagger', durability: 3 },
]), 12);
assert.equal(effectiveExpendableWeaponPips([
  { type: 'weapon', weaponType: 'dagger', durability: 1 },
  { type: 'weapon', weaponType: 'dagger', durability: 1 },
]), 0);

{
  const rareLastPip = candidate('Rare Sword', {
    rarity: 'rare',
    durability: 1,
    score: 5000,
  });
  const healthyDagger = candidate('Common Dagger', {
    durability: 3,
    score: 100,
  });
  const result = chooseWeaponPreservingAttack([rareLastPip, healthyDagger]);
  assert.equal(result.candidate, healthyDagger);
  assert.equal(result.reason, 'preserved');
  assert.equal(result.avoidedLastPip, true);
}

{
  const unsafeBackup = candidate('Common Sword', {
    durability: 3,
    score: 300,
    unsafe: true,
  });
  const safeRareLastPip = candidate('Rare Bow', {
    rarity: 'rare',
    durability: 1,
    score: 100,
  });
  const result = chooseWeaponPreservingAttack([unsafeBackup, safeRareLastPip]);
  assert.equal(result.candidate, safeRareLastPip);
  assert.equal(result.reason, 'survival_emergency');
}

{
  const safeBackup = candidate('Common Sword', {
    durability: 3,
    score: 300,
  });
  const bossFinisher = candidate('Rare Bow', {
    rarity: 'rare',
    durability: 1,
    score: 10000,
    endsBossFight: true,
  });
  const result = chooseWeaponPreservingAttack([safeBackup, bossFinisher]);
  assert.equal(result.candidate, bossFinisher);
  assert.equal(result.reason, 'boss_finisher');
}

{
  const commonLastPip = candidate('Common Dagger', {
    durability: 1,
    score: 5000,
  });
  const epicGemmedLastPip = candidate('Epic Bow', {
    rarity: 'epic',
    durability: 1,
    score: 6000,
    gemEffect: 'poison',
    gemCount: 2,
  });
  const result = chooseWeaponPreservingAttack([epicGemmedLastPip, commonLastPip]);
  assert.equal(result.candidate, commonLastPip);
  assert.equal(result.reason, 'forced_last_pip');
}

console.log('Simulator weapon-preservation policy checks passed.');

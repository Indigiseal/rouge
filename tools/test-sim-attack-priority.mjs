import assert from 'node:assert/strict';
import { killEfficiencyAdjustment } from '../sim/attack-priority.js';

const weights = {
  weakTargetWeight: 12,
  finisherWastePenalty: 3,
};

function oneHitTieBreakScore(hp, damage) {
  return Math.min(hp, damage) * 8 + killEfficiencyAdjustment({
    targetHp: hp,
    targetDamage: damage,
    targetKill: damage >= hp,
    ...weights,
  });
}

const enemyHp = [5, 12, 11];
const scores = enemyHp.map((hp) => oneHitTieBreakScore(hp, 12));
assert.equal(
  enemyHp[scores.indexOf(Math.max(...scores))],
  5,
  'the weakest of several one-hit targets should win the tie-break',
);

assert.ok(
  oneHitTieBreakScore(5, 5) > oneHitTieBreakScore(5, 12),
  'the smallest sufficient weapon hit should beat an oversized finisher',
);

assert.equal(
  killEfficiencyAdjustment({
    targetHp: 12,
    targetDamage: 5,
    targetKill: false,
    ...weights,
  }),
  0,
  'non-lethal attacks should not receive the one-hit finisher adjustment',
);

console.log('Simulator weakest-kill and efficient-finisher checks passed.');

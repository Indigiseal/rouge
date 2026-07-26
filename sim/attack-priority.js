/**
 * Prefer the weakest reachable enemy when several targets can be removed in
 * one action, and prefer the smallest sufficient hit for that finisher.
 *
 * This is an adjustment rather than a hard rule: multi-kills, imminent lethal
 * danger, and the boss bow-through-summons plan can still override it.
 */
export function killEfficiencyAdjustment({
  targetHp = 0,
  targetDamage = 0,
  targetKill = false,
  weakTargetWeight = 0,
  finisherWastePenalty = 0,
} = {}) {
  if (!targetKill) return 0;
  const hp = Math.max(0, Number(targetHp) || 0);
  const damage = Math.max(0, Number(targetDamage) || 0);
  const overkill = Math.max(0, damage - hp);
  return -hp * weakTargetWeight - overkill * finisherWastePenalty;
}

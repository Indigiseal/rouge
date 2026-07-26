const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export function weaponMergeCapitalUnits(weapon) {
  const tier = Math.max(0, RARITY_ORDER.indexOf(weapon?.rarity || 'common'));
  return 2 ** tier;
}

export function effectiveExpendableWeaponPips(weapons) {
  const usable = (weapons || []).filter((weapon) => (
    weapon?.type === 'weapon' && (weapon.durability || 0) > 0
  ));
  const spendable = (weapon) => Math.max(0, (weapon.durability || 0) - 1);
  let effective = usable.reduce((sum, weapon) => sum + spendable(weapon), 0);

  const daggers = usable
    .filter((weapon) => weapon.weaponType === 'dagger')
    .sort((a, b) => (b.durability || 0) - (a.durability || 0))
    .slice(0, 2);
  if (daggers.length === 2) {
    // Each expendable primary dagger pip also produces a free off-hand hit.
    // The final pip on both blades remains reserved for repair or merging.
    effective += daggers.reduce((sum, dagger) => sum + spendable(dagger), 0);
  }
  return effective;
}

function lastPipPreservationPenalty(candidate) {
  if (!candidate?.spendsLastPip) return 0;
  const weapon = candidate.weapon || {};
  const mergeCapital = weaponMergeCapitalUnits(weapon);
  const gemStack = weapon.gemEffect ? Math.max(1, weapon.gemCount || 1) : 0;
  return mergeCapital * 1200 + gemStack * 450;
}

function bestCandidate(candidates) {
  return (candidates || []).reduce((best, candidate) => {
    const adjustedScore = candidate.score - lastPipPreservationPenalty(candidate);
    if (!best || adjustedScore > best.adjustedScore) {
      return { candidate, adjustedScore };
    }
    return best;
  }, null)?.candidate || null;
}

/**
 * Keep a weapon's final pip as merge capital whenever a non-lethal plan can
 * use a healthier weapon. Spending it remains legal when it immediately wins
 * a boss fight, is the only projected-safe attack, or every weapon is already
 * on its final pip. In the last case, the least accumulated merge value is
 * sacrificed first.
 */
export function chooseWeaponPreservingAttack(candidates) {
  const all = (candidates || []).filter(Boolean);
  if (!all.length) return { candidate: null, reason: 'none', avoidedLastPip: false };

  const healthy = all.filter((candidate) => !candidate.spendsLastPip);
  const lastPip = all.filter((candidate) => candidate.spendsLastPip);
  if (!lastPip.length) {
    return { candidate: bestCandidate(healthy), reason: 'ordinary', avoidedLastPip: false };
  }

  const bossFinishers = lastPip.filter((candidate) => candidate.endsBossFight);
  const safeHealthy = healthy.filter((candidate) => !candidate.unsafe);
  if (safeHealthy.length) {
    const candidate = bestCandidate([...safeHealthy, ...bossFinishers]);
    return {
      candidate,
      reason: candidate?.spendsLastPip ? 'boss_finisher' : 'preserved',
      avoidedLastPip: !candidate?.spendsLastPip,
    };
  }

  const safeLastPip = lastPip.filter((candidate) => !candidate.unsafe);
  if (healthy.length && safeLastPip.length) {
    return {
      candidate: bestCandidate([...safeLastPip, ...bossFinishers]),
      reason: 'survival_emergency',
      avoidedLastPip: false,
    };
  }

  if (healthy.length) {
    return {
      candidate: bestCandidate(healthy),
      reason: 'preserved_unsafe',
      avoidedLastPip: true,
    };
  }

  return {
    candidate: bestCandidate(all),
    reason: 'forced_last_pip',
    avoidedLastPip: false,
  };
}

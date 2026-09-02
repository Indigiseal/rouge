// Depth scaling for run-long bonuses.
//
// A flat bonus quietly dies as the run goes on: from F1 to F45 enemy ATK grows
// x2.4 and enemy density x1.5, while a "+15 HP at floor start" ring keeps
// paying the same 15. Measured retention of a flat regen ring in act 3 was 0%
// of its act-1 value, against 32% for a multiplicative -30% damage amulet.
//
// The payout is tied to how deep the run is, deliberately NOT to how much the
// player has stacked. Stack-scaled bonuses would compound with everything else
// already owned and feed the meta x amulet snowball (see docs/BALANCE.md);
// depth scaling keeps a late pickup relevant without that feedback loop.

/**
 * @param {number|{base:number, perFloor:number, fromFloor?:number}} spec flat
 *   amount, or a base + per-floor slope. Plain numbers stay flat (no scaling).
 *   `fromFloor` holds the payout at `base` until that floor, so a bonus can be
 *   grown for acts 2-3 without moving act-1 balance at all (act 1 is tuned to
 *   the reach/clear targets in docs/BALANCE.md and should not drift as a side
 *   effect of fixing late-run decay).
 * @param {number} floor current floor, 1-based
 * @returns {number} rounded amount, never negative
 */
export function depthScaled(spec, floor) {
  if (typeof spec === 'number') return Math.max(0, Math.round(spec));
  const base = Number(spec?.base) || 0;
  const perFloor = Number(spec?.perFloor) || 0;
  const fromFloor = Number(spec?.fromFloor) || 1;
  const f = Math.max(1, Math.floor(Number(floor) || 1));
  const depth = Math.max(0, f - fromFloor);
  return Math.max(0, Math.round(base + perFloor * depth));
}

/** Human-readable range for tooltips/docs: "8 → 21 HP". */
export function depthScaledRange(spec, minFloor = 1, maxFloor = 45) {
  return [depthScaled(spec, minFloor), depthScaled(spec, maxFloor)];
}

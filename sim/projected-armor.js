import { effectiveArmorProtection, effectiveArmorDodge } from '../src/systems/combat/ArmorMath.js';

// Forecasts consume shield turns and armor pips on their own snapshot. Use
// live armor math with that snapshot, not the run's still-active shield.
export function projectedArmorStats(defense) {
  const state = { magicShield: { turns: defense.magicShieldTurns, multiplier: defense.magicShieldMultiplier } };
  return {
    protection: effectiveArmorProtection(state, defense.armor),
    dodge: effectiveArmorDodge(state, defense.armor),
  };
}

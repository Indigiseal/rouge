import { InventoryCombatUse } from '../src/systems/inventory/InventoryCombatUse.js';
// Run the live inventory's special attacks (area hits: no gem or enchant, Nov 2) and
// taunt bypass. Measure capped HP removed from original enemy references.
function applySpecialSim(mock, gs, method, primaryIndex, damage, weapon, primaryCard = null, onAssassinate = () => {}) {
  const before = (mock.cardSystem.boardCards || []).filter(c => c?.data && mock.cardSystem.isEnemyType(c.data.type))
    .map(c => ({ data: c.data, hp: Math.max(0, c.data.health || 0) }));
  InventoryCombatUse[method].call({ scene: mock,
    applyAssassinateTalent: index => onAssassinate(index),
  }, primaryIndex, damage, weapon, primaryCard);
  return before.reduce((sum, c) => sum + Math.max(0, c.hp - Math.max(0, c.data.health || 0)), 0);
}
export function applySwordCleaveSim(mock, gs, index, damage, weapon, onAssassinate) {
  return weapon?.special === 'cleave' ? applySpecialSim(mock, gs, 'applySwordCleave', index, damage, weapon, null, onAssassinate) : 0;
}
export function applySpearPierceSim(mock, gs, index, damage, weapon, primary = null, onAssassinate) {
  return ['pierce', 'reach'].includes(weapon?.special) ? applySpecialSim(mock, gs, 'applySpearPierce', index, damage, weapon, primary, onAssassinate) : 0;
}
export function applyAxeHeavyCleaveSim(mock, gs, index, damage, weapon, primary = null, onAssassinate) {
  return weapon?.special === 'specialAttack' ? applySpecialSim(mock, gs, 'applyAxeHeavyCleave', index, damage, weapon, primary, onAssassinate) : 0;
}
export function applyMaceDiagonalSim(mock, gs, index, damage, weapon, primary = null, onAssassinate) {
  return weapon?.special === 'crush' ? applySpecialSim(mock, gs, 'applyMaceDiagonal', index, damage, weapon, primary, onAssassinate) : 0;
}
export function applyGauntletSlamSim(mock, gs, index, damage, weapon, onAssassinate) {
  return weapon?.id === 'ogreGauntlet' ? applySpecialSim(mock, gs, 'applyGauntletSlam', index, damage, weapon, null, onAssassinate) : 0;
}


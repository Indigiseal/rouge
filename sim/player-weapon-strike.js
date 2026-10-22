import {
  applyPermanentWeaponDamageBonuses,
  applyKeenEdgeFirstStrike,
  rollClassWeaponCrit,
} from '../src/content/characters/CharacterClasses.js';
import { applyWeaponSigils, onWeaponSigilHit } from '../src/systems/combat/SigilEffects.js';

// Called only after the action and player holds resolve. Follow the live
// inventory's order: exhaustion, permanent bonuses, sigils, primary talents,
// class crit. Off-hand daggers have their own sigils and no primary bonuses.
export function prepareSimWeaponSwing(scene, index, weapon, {
  wasExhausted = false, actionsBefore = scene.gameState.actionsLeft, primary = true,
} = {}) {
  const gs = scene.gameState;
  let damage = weapon?.damage || 1;
  if (wasExhausted) damage = Math.ceil(damage * 0.8);
  damage = applyPermanentWeaponDamageBonuses(gs.characterId, weapon, damage, gs.talentEffects);
  const sigilHit = applyWeaponSigils(scene, weapon, scene.cardSystem.boardCards[index], damage, { actionsBefore });
  damage = sigilHit.damage;
  let critical = false;
  if (primary) {
    damage = applyKeenEdgeFirstStrike(gs.characterId, weapon, damage, gs.talentEffects, gs).damage;
    if (gs.talentEffects?.firstBloodFlat > 0 && !gs.firstAttackThisFloorUsed) {
      damage += gs.talentEffects.firstBloodFlat;
      gs.firstAttackThisFloorUsed = true;
    }
    const crit = rollClassWeaponCrit(gs.characterId, weapon, damage, gs.warriorStance);
    if (crit.crit) {
      damage = wasExhausted ? Math.ceil(crit.damage * 0.8) : crit.damage;
      critical = true;
    }
  }
  return { damage, baseDamage: sigilHit.baseDamage ?? damage, critical };
}

// Keep the struck card reference: a kill can replace its board slot with loot.
// The shared on-hit hook also owns Echo/Quick Strike, repair, Growth and AP procs.
export function resolveSimWeaponSwing(scene, index, weapon, swing, {
  damage = swing.damage, skipDurability = false,
} = {}) {
  const cs = scene.cardSystem;
  const target = cs.boardCards[index];
  if (!target?.revealed || !cs.isEnemyType(target.data?.type) || !(target.data.health > 0)) return 0;
  const before = target.data.health;
  cs.attackEnemy(index, damage, false, weapon, skipDurability, { critical: swing.critical });
  const after = target.data?.isBonePile ? 0 : (target.data?.health ?? 0);
  const dealt = Math.max(0, before - Math.max(0, after));
  onWeaponSigilHit(scene, weapon, target, {
    damageDealt: dealt, swingDamage: swing.baseDamage, repeatDamage: damage,
  });
  return dealt;
}

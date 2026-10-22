/**
 * Situational enemy hit damage = passport ATK + per-enemy hooks.
 * Enemy defs may export `modifyHitAttack(card, boardCards, baseAttack)`.
 * Shared sigils apply after optional per-enemy hooks.
 */

import { sigilLevel, SIGIL_MULTIPLIER } from '../sigils/sigils.js';
import { getEnemy } from '../cards/enemies.js';
import { ENCHANT_SAPPING_MULTIPLIER } from '../balance/WeaponEnchants.js';

export function getEnemyHitAttack(card, boardCards) {
  const base = Math.max(0, Number(card?.data?.attack) || 0);
  const def = getEnemy(card?.data?.enemyType);
  let attack = base;
  if (typeof def?.modifyHitAttack === 'function') {
    attack = Math.max(0, Number(def.modifyHitAttack(card, boardCards, base)) || 0);
  }
  const total = attack + enemyFlatSigilBonus(card, boardCards);
  // Sapping (the hero's sigil): weaker for its next attack only.
  return card?.data?.sapped ? Math.floor(total * ENCHANT_SAPPING_MULTIPLIER) : total;
}

/** An enemy has made its attack: a Sapping it carried is spent. */
export function spendSapping(card) {
  if (card?.data?.sapped) card.data.sapped = false;
}

/** Conditional attack sigils, evaluated against the defender's current HP. */
export function enemyStrikeSigils(card, gameState) {
  const data = card?.data;
  if (!data || !gameState) return [];
  const hp = data.health ?? 0;
  const maxHp = Math.max(1, data.maxHealth || hp || 1);
  const heroHp = gameState.playerHealth ?? 0;
  const heroMax = Math.max(1, gameState.maxHealth || 1);
  const out = [];
  if (sigilLevel(data, 'merciless') > 0 && heroHp <= heroMax / 2) out.push('merciless');
  if (sigilLevel(data, 'ambush') > 0 && heroHp >= heroMax) out.push('ambush');
  if (sigilLevel(data, 'charged') > 0 && gameState.playerShocked) out.push('charged');
  if (sigilLevel(data, 'shatter') > 0 && gameState.playerFrozenAttacks > 0) out.push('shatter');
  if (sigilLevel(data, 'unscathed') > 0 && hp >= maxHp) out.push('unscathed');
  return out;
}

export function applyEnemyStrikeSigils(card, gameState, damage) {
  return enemyStrikeSigils(card, gameState).reduce(amount => Math.floor(amount * SIGIL_MULTIPLIER), damage);
}

// An enemy's flat sigils, part of its attack number so the card shows them:
// Honed (+1 per attack it has made this fight), Outnumbered (+1 per other
// living enemy in view), Ironclad (its armor). Per sigil level.
function enemyFlatSigilBonus(card, boardCards) {
  const data = card?.data;
  if (!data || data.isBonePile) return 0;
  let bonus = 0;
  const allies = (boardCards || []).filter(other => other && other !== card && other.revealed
    && !other.data?.isBonePile && (other.data?.health || 0) > 0
    && ['enemy', 'eliteEnemy', 'boss'].includes(other.data?.type));
  bonus += allies.reduce((sum, other) => sum + sigilLevel(other.data, 'companionStrength'), 0);
  if (sigilLevel(data, 'packStrength') > 0) bonus += allies.length;
  const honed = sigilLevel(data, 'honed');
  if (honed > 0) bonus += (data.honedUses || 0) * honed;
  const outnumbered = sigilLevel(data, 'outnumbered');
  if (outnumbered > 0) {
    const others = (boardCards || []).filter((other) => other && other !== card && other.revealed
      && (other.data?.type === 'enemy' || other.data?.type === 'eliteEnemy' || other.data?.type === 'boss')
      && (other.data.health || 0) > 0).length;
    bonus += others * outnumbered;
  }
  const ironclad = sigilLevel(data, 'ironclad');
  if (ironclad > 0) bonus += Math.max(0, Number(data.armor) || 0) * ironclad;
  return bonus;
}

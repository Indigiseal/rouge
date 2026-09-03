// Control-branch amulets: mark enemies, skip/redirect their swing, bind a kill.

export const CONTROL_HESITATION_CHANCE = 0.5;

function isMarkableEnemy(card) {
  const data = card?.data;
  if (!data) return false;
  if ((data.health ?? 0) <= 0) return false;
  if (data.type === 'boss' || data.isCocoon || data.isMimic) return false;
  const features = Array.isArray(data.features) ? data.features : [];
  if (features.includes('cocoon_shell')) return false;
  return data.type === 'enemy' || data.type === 'eliteEnemy';
}

function pickRandom(list) {
  if (!list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

/** Clear previous marks, then stamp this floor's marked enemies. */
export function applyControlMarksToBoard(boardCards, { hesitation = false, treachery = false } = {}) {
  const board = Array.isArray(boardCards) ? boardCards : [];
  for (const card of board) {
    if (!card?.data) continue;
    card.data.controlHesitation = false;
    card.data.controlTreachery = false;
  }
  if (!hesitation && !treachery) return;

  const candidates = board.filter(isMarkableEnemy);
  if (!candidates.length) return;

  if (hesitation) {
    const marked = pickRandom(candidates);
    if (marked) marked.data.controlHesitation = true;
  }
  if (treachery) {
    const leftover = candidates.filter((card) => !card.data.controlHesitation);
    const pool = leftover.length ? leftover : candidates;
    const marked = pickRandom(pool);
    if (marked) marked.data.controlTreachery = true;
  }
}

/** Another revealed living enemy, or null if this attacker has no ally to hit. */
export function pickControlTreacheryTarget(boardCards, attackerIndex, isEnemyCard) {
  const board = Array.isArray(boardCards) ? boardCards : [];
  const others = [];
  for (let index = 0; index < board.length; index++) {
    if (index === attackerIndex) continue;
    const card = board[index];
    if (!card?.revealed || !card.data) continue;
    if ((card.data.health ?? 0) <= 0) continue;
    if (typeof isEnemyCard === 'function' ? !isEnemyCard(card) : false) continue;
    others.push({ card, index });
  }
  return pickRandom(others);
}

export function createBoundThrallCard(deadCard, attack) {
  const data = deadCard?.data || {};
  const ranged = data.role === 'RANGED' || data.isRangedType === true;
  const hasSprite = Boolean(data.sprite);
  return {
    id: 'boundThrall',
    type: 'companion',
    name: `Bound ${data.name || 'Enemy'}`,
    attack: Math.max(1, Math.floor(Number(attack) || Number(data.attack) || 1)),
    attackStyle: ranged ? 'ranged' : 'melee',
    range: ranged ? 'ranged' : 'melee',
    damageType: 'physical',
    sprite: hasSprite ? data.sprite : 'relicsOthers',
    spriteFrame: hasSprite ? data.spriteFrame : 20,
    rarity: 'rare',
    boundThrall: true,
    companionId: `boundThrall-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
  };
}

/**
 * Reinforcement waves keep every visible combat card at native pixel size.
 * A room starts with its maximum comfortable board size, then drops held-back
 * cards once the player has cleared most of that board.
 */
export const REINFORCEMENT_RULES = [
  { floors: [1, 45], roomTypes: ['COMBAT'], maxBoardCards: 15, waveSize: 6, threshold: 3 },
];

/** Return fresh wave state only when a room exceeds its visible-card cap. */
export function reinforcementStateFor(floor, roomType, totalCards = 0) {
  const f = Number(floor);
  if (!Number.isFinite(f)) return null;

  const rule = REINFORCEMENT_RULES.find(r => (
    Array.isArray(r.floors)
    && f >= r.floors[0] && f <= r.floors[1]
    && (!Array.isArray(r.roomTypes) || r.roomTypes.includes(roomType))
  ));
  if (!rule) return null;

  const maxBoardCards = Math.max(1, Math.floor(rule.maxBoardCards ?? 0));
  const initialCards = Math.min(Math.max(0, Math.floor(totalCards)), maxBoardCards);
  const cardsPending = Math.max(0, Math.floor(totalCards) - initialCards);
  if (cardsPending <= 0) return null;

  const waveSize = Math.max(1, Math.floor(rule.waveSize ?? cardsPending));
  return {
    initialCards,
    cardsPending,
    waveSize,
    wavesLeft: Math.ceil(cardsPending / waveSize),
    threshold: Math.max(0, Math.floor(rule.threshold ?? 0)),
    dropping: false,
  };
}

/** Restore pending reinforcements from a save, including older wave saves. */
export function reinforcementStateFromSave(saved) {
  if (!saved || typeof saved !== 'object') return null;
  const wavesLeft = Number(saved.wavesLeft);
  const threshold = Number(saved.threshold);
  if (!Number.isFinite(wavesLeft) || wavesLeft <= 0) return null;

  const waveSize = Math.max(1, Math.floor(Number(saved.waveSize) || 6));
  const cardsPending = Math.max(0, Math.floor(Number(saved.cardsPending) || wavesLeft * waveSize));
  if (cardsPending <= 0) return null;

  return {
    cardsPending,
    waveSize,
    wavesLeft: Math.ceil(cardsPending / waveSize),
    threshold: Number.isFinite(threshold) ? Math.max(0, Math.floor(threshold)) : 0,
    dropping: false,
  };
}

/** The save-safe shape of live wave state, or null when there is nothing left. */
export function serializeReinforcementState(state) {
  if (!state || !(state.wavesLeft > 0) || !(state.cardsPending > 0)) return null;
  return {
    cardsPending: state.cardsPending,
    waveSize: state.waveSize,
    wavesLeft: state.wavesLeft,
    threshold: state.threshold ?? 0,
  };
}

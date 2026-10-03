export const TOLLROAD_NARRATIVE_CHECKPOINTS = Object.freeze([
  Object.freeze({ afterFloor: 5, eventId: 'goblin_mine', seenFlag: 'goblinMineSeen', label: 'The Crystal Mine' }),
  Object.freeze({ afterFloor: 10, eventId: 'royal_bridge', seenFlag: 'royalBridgeSeen', label: 'The Royal Procession' }),
  Object.freeze({ afterFloor: 12, eventId: 'toll_collectors', seenFlag: 'tollCollectorsSeen', label: 'Toll Collectors' }),
  Object.freeze({ afterFloor: 14, eventId: 'tollroad_throne_hall', seenFlag: 'tollroadThroneHallSeen', label: 'The Throne Hall' }),
]);

export function pendingTollroadCheckpoint(gameState) {
  const story = gameState?.storyRun || {};
  const floor = Math.max(1, Number(gameState?.currentFloor) || 1);
  return TOLLROAD_NARRATIVE_CHECKPOINTS.find((checkpoint) => (
    floor >= checkpoint.afterFloor && !story[checkpoint.seenFlag]
  )) || null;
}

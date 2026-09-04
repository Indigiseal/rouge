import { getLocationIdForFloor } from '../locations/index.js';

/**
 * The Tollroad vision is a durable story beat: once the hero has taken the
 * pendant, later runs keep that knowledge and key item without replaying the
 * scene after every Goblin King kill.
 */
export function shouldShowTollroadAftermath(gameState) {
  if (!gameState || gameState?.storyRun?.tollroadAftermathSeen) return false;
  return getLocationIdForFloor(gameState, gameState.currentFloor || 15) === 'tollroad';
}

export function completeTollroadAftermath(gameState) {
  if (!gameState) return false;
  if (!gameState.storyRun || typeof gameState.storyRun !== 'object') {
    gameState.storyRun = {};
  }
  gameState.storyRun.tollroadAftermathSeen = true;
  gameState.storyRun.magusPendantObtained = true;
  return true;
}

import { getLocationIdForFloor } from '../locations/index.js';

/** Show the vision after every Goblin King victory on the Tollroad. */
export function shouldShowTollroadAftermath(gameState) {
  if (!gameState || gameState?.storyRun?.tollroadAftermathCompleteThisRun) return false;
  return getLocationIdForFloor(gameState, gameState.currentFloor || 15) === 'tollroad';
}

export function completeTollroadAftermath(gameState) {
  if (!gameState) return false;
  if (!gameState.storyRun || typeof gameState.storyRun !== 'object') {
    gameState.storyRun = {};
  }
  gameState.storyRun.tollroadAftermathSeen = true;
  gameState.storyRun.magusPendantObtained = true;
  gameState.storyRun.tollroadAftermathCompleteThisRun = true;
  return true;
}

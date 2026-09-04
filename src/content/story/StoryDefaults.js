// Default storyRun / heroMemory seeds for a fresh GameState.

export const DEFAULT_STORY_RUN = Object.freeze({
  caravanSeen: false,
  donkeySaved: false,
  donkeyLost: false,
  banditsStopped: false,
  banditsEscaped: false,
  merchantGrateful: false,
  hermitState: 'unknown',
  banditTrailFound: false,
  cheerfulHermitVisited: false,
  caravanResolved: false,
  caravanEnding: 'unresolved',
  caravanEpilogueSeen: false,
  caravanEpilogueChoice: 'none',
  boxState: 'unknown',
  boxFollowing: false,
  boxHasCog: false,
  boxPrep: 'none',
  boxRepairChance: 50,
  birdAngry: false,
  stoleBirdEgg: false,
  nestRaidTimedOut: false,
  latchboxRewardClaimed: false,
  goblinEngineerResolved: false,
  chickHatched: false,
  skeletonCompanionObtained: false,
  angryNestmotherRollFloor: null,
  mirrorSeen: false,
  tooNiceRoomSeen: false,
  wellSeen: false,
  slimyPrisonSeen: false,
  bookWormSeen: false,
  briarRoomSeen: false,
  reliquarySeen: false,
  // Toll Collectors — the Goblin King's tax men. These outlive the event: the
  // boss fight reads tollFought, and the act's shop reads merchantRobbed.
  tollCollectorsSeen: false,
  // Arm Wrestling. armWrestleWon queues the rematch (the only route to the
  // gauntlet); losing either match sets armWrestleRematchDone and ends it.
  armWrestlingSeen: false,
  armWrestleWon: false,
  armWrestleLost: false,
  armWrestleRematchDone: false,
  gauntletWon: false,
  paidTheToll: false,
  tollIntimidated: false,
  tollFought: false,
  tollKiller: false,
  tollEscapeNoticeShown: false,
  merchantRobbed: false,
  // Durable Tollroad story progression. The pendant is a key item rather than
  // an inventory card, so it never consumes a slot and can be used by later
  // narrative beats.
  tollroadAftermathSeen: false,
  magusPendantObtained: false,
  pendingEvents: Object.freeze([]),
});

export const DEFAULT_HERO_MEMORY = Object.freeze({
  learnedBanditsThreatenHermit: false,
  learnedDonkeyCanBeSaved: false,
  solvedCaravanPerfectly: false,
  learnedMusicBoxExplodes: false,
  learnedBirdNestHasCog: false,
  learnedEngineerCanRepairBox: false,
  chickRareShopUnlocked: false,
  skeletonRareShopUnlocked: false,
});

/** Mutable clone for GameState (frozen defaults must not be mutated in-run). */
export function createDefaultStoryRun() {
  return {
    ...DEFAULT_STORY_RUN,
    pendingEvents: [...DEFAULT_STORY_RUN.pendingEvents],
  };
}

export function createDefaultHeroMemory() {
  return { ...DEFAULT_HERO_MEMORY };
}

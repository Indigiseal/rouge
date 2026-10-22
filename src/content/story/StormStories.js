// New starts belong to Storm. Existing pending follow-ups remain portable so
// moving to another act/location never strands a story already in progress.
export function stormStoryEventIds(gameState, locationId) {
    if (locationId !== 'stormhatch') return [];
    const story = gameState?.storyRun || {};
    const events = [];
    if (!story.birdNestSeen && !story.stoleBirdEgg && !story.nestRaidTimedOut) {
        events.push('monster_bird_nest');
    }
    if (!story.carnivalVisited) events.push('something_wicked');
    else if (!story.brassWizardSeen) events.push('brass_wizard');
    return events;
}

// Only old music-box chains queued the nest. New Tollroad chains go straight
// to the engineer, and fresh Storm nests have no music box or cog prize.
export function legacyNestNeedsEngineer(gameState) {
    const story = gameState?.storyRun;
    return Boolean(story?.pendingEvents?.includes('monster_bird_nest')
        && ['opened', 'following', 'has_cog', 'exploded'].includes(story.boxState)
        && !story.latchboxRewardClaimed && !story.goblinEngineerResolved);
}

export function legacyNestHasCog(gameState) {
    return legacyNestNeedsEngineer(gameState) && gameState.storyRun.boxState !== 'exploded';
}

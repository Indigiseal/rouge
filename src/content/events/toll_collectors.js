const INTACT_TOLL = 100;
const ALERT_TOLL = 200;
const BROKEN_BRIDGE_TOLL = 150;

function intactDescription(gs) {
  const toll = gs?.storyRun?.tollWatchFailed ? ALERT_TOLL : INTACT_TOLL;
  return `The King's road reaches the old stone bridge where you saw the royal procession. Beyond the span it climbs, straight and exposed, toward the Goblin King's castle.\n\nThree goblin tax collectors have raised a striped barrier across the near end. One wears a veteran's scarred mail. Another holds a tally board, and the third guards a strongbox.\n\nA fresh sign reads:\n\nBRIDGE TOLL. ${toll} COINS.\n\nThe clerk has already begun writing down your description.`;
}

function brokenDescription() {
  return `The King's road ends at the bridge where you saw the royal procession. The miners have left half of it in the river, but the three tax collectors are back beside the gap as though nothing has changed.\n\n"What exactly are you charging for?" you ask.\n\n"Bridge passage."\n\n"There is no bridge."\n\nThe clerk beams. "Goblin engineering!"\n\nHe points to a massive pack: a round wooden shield, slightly domed, with bundles of fireworks lashed to either side. Beside it lies a great folded sheet with a distinct canopy and rows of neatly coiled rope.\n\n"Don't worry. Very reliable. Only ${BROKEN_BRIDGE_TOLL} coins."`;
}

function attackChoice() {
  return { id: 'toll_attack', text: 'Rush them', action: (gs, s) => s.attackTollCollectors(), outcome: 'You vault the barrier before the tally board hits the ground. The veteran roars an order, and the other two draw their knives.' };
}

function jetpackChoice() {
  return {
    id: 'toll_jetpack', text: `Pay for the rocket pack (${BROKEN_BRIDGE_TOLL} coins)`,
    condition: (gs) => (gs?.coins || 0) >= BROKEN_BRIDGE_TOLL,
    action: (gs, s) => s.buyGoblinJetpack(BROKEN_BRIDGE_TOLL),
    outcome: 'The goblins buckle the wooden pack onto you and begin lighting fuses.\n\n[ROCKET-PACK FLIGHT — MINIGAME PLACEHOLDER]\n\nCanvas snaps open above you. Fireworks hammer the air below. By luck, engineering, or a temporary suspension of both, you land on the castle side of the ravine.',
  };
}

function detourChoice() {
  return { id: 'toll_detour', text: 'Take the swamp detour', action: (gs, s) => s.beginTollroadDetour(), outcome: 'You leave the ruined bridge behind and follow the river downstream. The marsh crossing is a long way off, and the collectors’ cheerful warnings about the things living there follow you into the reeds.' };
}

function brokenChoices() {
  return [jetpackChoice(), {
    id: 'toll_ask_detour', text: 'Ask about another way across', action: () => {},
    outcome: 'The clerk points downstream. "Marsh crossing. Long walk. Things in there."\n\nHe pats the rocket pack. "This is safer. Probably."',
    next: { choices: [jetpackChoice(), detourChoice(), attackChoice()] },
  }, attackChoice()];
}

function intactChoices(gs) {
  const toll = gs?.storyRun?.tollWatchFailed ? ALERT_TOLL : INTACT_TOLL;
  const choices = [{
    id: 'toll_pay', text: `Pay the toll (${toll} coins)`, condition: () => (gs?.coins || 0) >= toll,
    action: (state, s) => s.payTheToll(toll),
    outcome: 'You count out the coins. The clerk counts them again, slower, then raises the barrier with sudden courtesy. The road beyond leads directly toward the castle.',
  }, attackChoice()];
  if (!gs?.storyRun?.tollWatchFailed) {
    const wait = {
      id: 'toll_wait', text: 'Wait and watch',
      action: (state, s) => { if (!s.waitAtTheToll()) wait.next = { choices: intactChoices(state) }; },
      outcome: (state, s) => s.tollWaitOutcome,
    };
    choices.splice(1, 0, wait);
  }
  return choices;
}

export default {
  id: 'toll_collectors',
  title: 'Toll Collectors',
  description: (gs) => gs?.storyRun?.bridgeDestroyed ? brokenDescription() : intactDescription(gs),
  choices: (gs) => gs?.storyRun?.bridgeDestroyed ? brokenChoices() : intactChoices(gs),
};

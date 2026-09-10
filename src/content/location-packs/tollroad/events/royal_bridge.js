const MINER_SABOTAGE_OUTCOME = 'The bridge erupts. Stone folds into the ravine and most of the escort vanishes with it. The Goblin King claws his way out of the palanquin and runs for solid ground.\n\nA final miner turns, hurls a stick of dynamite, and dives behind the ridge. The blast catches the King before he clears the span. He survives—but he will carry the wound into your battle.';

export default {
  id: 'royal_bridge',
  title: 'The Royal Procession',
  description: (gs) => {
    if (gs?.storyRun?.goblinMinersAllied) {
      return 'Far ahead, a royal procession crosses an old stone bridge. Goblin soldiers surround a palanquin carrying a richly dressed goblin.\n\nMiners burst from beneath the bridge and sprint for cover. A fuse spits sparks between the foundation stones, trailing after them.';
    }
    if (gs?.storyRun?.goblinMinersKilled) {
      return 'Far ahead, a royal procession crosses an old stone bridge. Goblin soldiers surround a palanquin carrying the Goblin King.\n\nNo miners wait beneath the span. The dynamite wagons you left burning—or the workers who caught you near them—will set no charge today. The bridge is narrow, but the procession is intact.';
    }
    return 'Far ahead, a royal procession crosses an old stone bridge. Goblin soldiers surround a palanquin carrying a richly dressed goblin—the King, travelling behind a wall of hired steel.\n\nThe bridge is narrow. For a few moments, the whole procession is exposed.';
  },
  choices: (gs) => {
    if (gs?.storyRun?.goblinMinersAllied) {
      return [{
        id: 'bridge_watch_sabotage',
        text: 'Watch the fuse burn',
        action: (state, scene) => scene.resolveMinerBridgeSabotage(),
        outcome: MINER_SABOTAGE_OUTCOME,
      }];
    }

    return [
      {
        id: 'bridge_preview_sabotage',
        text: '[Test Site] Preview the miners’ sabotage',
        condition: (state) => Boolean(state?.sandboxMode),
        action: (state, scene) => {
          state.storyRun.goblinMinersAllied = true;
          scene.resolveMinerBridgeSabotage();
        },
        outcome: MINER_SABOTAGE_OUTCOME,
      },
      {
        id: 'bridge_fireball',
        text: 'Cast Fireball at the palanquin',
        condition: (state, scene) => scene.hasFireballCard(),
        action: (state, scene) => scene.fireballRoyalProcession(),
        outcome: 'Fire bursts against the palanquin. The bearers scatter and the King reaches cover, scorched and furious. You have wounded him—but without the miners\' charges, the bridge and most of his escort remain intact.',
      },
      {
        id: 'bridge_attack',
        text: 'Ambush the rearguard',
        action: (state, scene) => scene.attackRoyalProcession(),
        outcome: 'You strike the rear of the column before the alarm reaches the palanquin. The King\'s guards turn back as one, buying their master time to flee across the bridge.',
      },
      {
        id: 'bridge_hide',
        text: 'Stay hidden and let them pass',
        action: (state, scene) => scene.letRoyalProcessionPass(),
        outcome: 'You remain among the rocks until the last spear disappears down the road. The King reaches his fortress unwounded and unaware of how close you were.',
      },
    ];
  },
};

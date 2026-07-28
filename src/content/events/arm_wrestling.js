// Arm Wrestling. Two matches, and only winning earns the second one.
//
// The odds are hidden — never a percentage on screen. What the player reads is
// the CROWD: the more of them who fancy the ogre, the worse the player's arm
// looks. See EventScene.armWrestleChance / getArmWrestleCrowdLine.
//
// Match one is for coins or a card. Win, and he wants his money back — a
// rematch queues up, and that is the only time he stakes the gauntlet. Lose
// either match and he is finished with you.

export default {
    id: 'arm_wrestling',
    title: 'Arm Wrestling',
    description: (gs, scene) => {
      const crowd = scene.getArmWrestleCrowdLine();
      if (scene.isArmWrestleRematch()) {
        return `The ogre is at the same table. He has not put his coins back out.\n\nInstead he has unbuckled the stone guard from his forearm and laid it on the slab between you. It is scaled, heavy, and clearly not his originally.\n\nThe crowd is bigger this time, and much quieter.\n\n${crowd}`;
      }
      return `An ogre sits at a stone table with one elbow planted on it. Coins are stacked by his hand — more than a goblin toll, less than he seems to think.\n\nA stool waits on your side. It is too small.\n\nMonsters have gathered to watch: a few goblins, something with too many legs, and a skeleton that keeps losing its place in the crowd.\n\n${crowd}`;
    },
    choices: (gs, scene) => {
      const rematch = scene.isArmWrestleRematch();
      const stake = scene.getArmWrestleCoinStake();

      const cardBet = {
        id: 'arm_bet_card',
        text: rematch ? 'Put a card up against the guard' : 'Put a card up instead',
        condition: (state, s) => s.hasArmWrestleCard(),
        action: (state, s) => s.beginArmWrestleCardBet(),
        outcome: 'Drag a card onto the table. He will not play for junk.',
        next: {
          choices: [
            {
              text: 'Take your hand back',
              action: (state, s) => s.cancelArmWrestleCardBet(),
              outcome: 'You take the card back. The ogre does not move, and neither does his elbow.'
            }
          ]
        }
      };

      const decline = {
        id: 'arm_decline',
        text: 'Decline',
        action: (state, s) => s.declineArmWrestle(),
        outcome: rematch
          ? 'You leave the guard where it is.\n\nThe ogre says something in Ogrish that the crowd finds funnier than you do, and buckles it back onto his arm.'
          : 'He mutters something in Ogrish. The crowd loses interest in you immediately.\n\nThe stool stays empty.'
      };

      // He will not play for coin twice — the rematch is about the guard.
      if (rematch) return [cardBet, decline];

      return [
        {
          id: 'arm_bet_coins',
          text: `Bet ${stake} coins`,
          condition: () => (gs?.coins || 0) >= stake,
          action: (state, s) => s.betCoinsOnArmWrestle(),
          outcome: (state, s) => s.armWrestleOutcome
        },
        cardBet,
        decline,
      ];
    }
  };

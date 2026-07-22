export default {
    id: 'goblin_engineer',
    title: 'Goblin Engineer',
    description: (gs) => {
      const intro = 'A goblin engineer pops out from behind a broken machine and points at the music box.\n\n"Oh. Sleepy Snatch Box. Old robber model. Plays song, puffs smoke, hero sleeps, pockets empty. Very illegal. Very profitable."\n\nThe music box hides behind your boot. The goblin squints. "Yours is broken. Also emotionally confused."';
      const cogLine = gs?.storyRun?.boxHasCog
        ? '"Ah! You found its heart cog. I can prepare the casing. Maybe it becomes useful. Maybe it becomes smoke."'
        : '"No cog? Bad. I can still fake the repair. Goblin confidence: fifty percent."';
      return `${intro}\n\n${cogLine}`;
    },
    choices: [
      {
        text: 'Refuse to pay',
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.storyRun.boxPrep = 'none';
          gs.storyRun.boxRepairChance = 50;
          scene.markHeroMemory('learnedEngineerCanRepairBox');
          scene.resolveBoxRepair('You refuse to pay. The goblin shrugs. "Free repair is still repair. Just shorter."');
        },
        outcome: (gs, scene) => scene.boxRepairOutcome
      },
      {
        text: 'Give him an unwanted card for spare parts',
        condition: (gs, scene) => Boolean(gs?.storyRun?.boxHasCog && scene.hasSacrificeCard()),
        action: (gs, scene) => {
          scene.ensureStoryState();
          scene.sacrificeFirstNonEssentialCard();
          gs.storyRun.boxPrep = 'cheap';
          gs.storyRun.boxRepairChance = 80;
          scene.markHeroMemory('learnedEngineerCanRepairBox');
          scene.resolveBoxRepair('The goblin chews thoughtfully on your spare card, then bolts part of it into the music box. "Good enough for machines with low standards."');
        },
        outcome: (gs, scene) => scene.boxRepairOutcome
      },
      {
        text: 'Pay 30 coins for full repair',
        condition: (gs) => Boolean(gs?.storyRun?.boxHasCog && (gs?.coins || 0) >= 30),
        action: (gs, scene) => {
          scene.ensureStoryState();
          gs.coins = Math.max(0, (gs.coins || 0) - 30);
          gs.storyRun.boxPrep = 'full';
          gs.storyRun.boxRepairChance = 100;
          scene.markHeroMemory('learnedEngineerCanRepairBox');
          scene.resolveBoxRepair('You pay the goblin. He suddenly becomes professional, which is alarming. He opens the casing and prepares the perfect place for the cog.');
        },
        outcome: (gs, scene) => scene.boxRepairOutcome
      }
    ]
  };

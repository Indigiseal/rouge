const boxIntact = (gs) => gs?.storyRun?.boxState !== 'exploded';

export default {
  id: 'goblin_engineer',
  title: 'Goblin Engineer',
  description: (gs) => {
    if (!boxIntact(gs)) {
      return 'A goblin steps out from behind a broken machine, sniffs the air, and coughs.\n\n'
        + '"Snatch Box. Charge went first. I can smell the powder from here. Nothing left to seat a cog in."\n\n'
        + 'He looks at your boots as if a box might still be hiding there. It is not.';
    }
    const intro = 'A goblin steps out from behind a broken machine and points at the music box.\n\n"Sleepy Snatch Box. Old robber model. Plays a song, puffs smoke, hero sleeps, pockets empty. Very illegal. Very profitable."\n\nThe box hides behind your boot.';
    const cogLine = gs?.storyRun?.boxHasCog
      ? '"You found its heart cog. Give it here — I can seat it properly. Or improperly. Depends on payment."'
      : '"No cog? Then I\'m guessing at the insides. Goblin confidence: fifty percent."';
    return `${intro}\n\n${cogLine}`;
  },
  choices: [
    {
      text: 'Refuse to pay',
      condition: (gs) => boxIntact(gs),
      action: (gs, scene) => {
        scene.ensureStoryState();
        gs.storyRun.boxPrep = 'none';
        gs.storyRun.boxRepairChance = 50;
        scene.markHeroMemory('learnedEngineerCanRepairBox');
        scene.resolveBoxRepair('"Free repair is still repair," the goblin says. "Just shorter."');
      },
      outcome: (gs, scene) => scene.boxRepairOutcome,
    },
    {
      text: 'Give him an unwanted card for spare parts',
      condition: (gs, scene) => Boolean(boxIntact(gs) && gs?.storyRun?.boxHasCog && scene.hasSacrificeCard()),
      action: (gs, scene) => {
        scene.ensureStoryState();
        scene.sacrificeFirstNonEssentialCard();
        gs.storyRun.boxPrep = 'cheap';
        gs.storyRun.boxRepairChance = 80;
        scene.markHeroMemory('learnedEngineerCanRepairBox');
        scene.resolveBoxRepair('He chews the card thoughtfully, then bolts half of it into the casing. "Good enough for a machine with low standards."');
      },
      outcome: (gs, scene) => scene.boxRepairOutcome,
    },
    {
      text: 'Pay 30 coins for full repair',
      condition: (gs) => Boolean(boxIntact(gs) && gs?.storyRun?.boxHasCog && (gs?.coins || 0) >= 30),
      action: (gs, scene) => {
        scene.ensureStoryState();
        gs.coins = Math.max(0, (gs.coins || 0) - 30);
        gs.storyRun.boxPrep = 'full';
        gs.storyRun.boxRepairChance = 100;
        scene.markHeroMemory('learnedEngineerCanRepairBox');
        scene.resolveBoxRepair('He counts the coins twice. Then he becomes suddenly, completely professional, which is somehow worse.');
      },
      outcome: (gs, scene) => scene.boxRepairOutcome,
    },
    {
      text: 'Walk away',
      condition: (gs) => !boxIntact(gs),
      action: (gs, scene) => {
        scene.ensureStoryState();
        scene.clearPendingEvent('goblin_engineer');
        gs.storyRun.goblinEngineerResolved = true;
        scene.queueEggHatchingEvent();
      },
      outcome: 'He shrugs. "Ash is ash. I don\'t do funerals."\n\nHe is already back behind the machine before you turn away.',
    },
  ],
};

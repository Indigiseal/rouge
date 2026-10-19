// An old trap chute that no longer works, and the crystal spider the player
// lands on. Shared: appears once per run in any location.
//
// Two steps: what to do with the mother (her leg is the Spider Crystal Shard),
// then what to do with her nest. Smashing it is loud and can wake the
// hatchlings; a taken egg hatches into the Crystal Spiderling a few floors on
// (GameScene.hatchCrystalSpiderEggs).

// Chance that smashing the nest wakes the hatchlings, rolled out of sight.
export const CHUTE_FIGHT_ON_SMASH = 1 / 3;

const NEST =
  'Ahead of you, in the corner of the pit, is her nest: a heap of crystal eggs, each the size of a fist.';

function nestChoices() {
  return [
    {
      id: 'chute_burn',
      text: 'Burn the eggs',
      condition: (gs, scene) => scene.hasFireballCard(),
      action: (gs, scene) => scene.burnCrystalEggs(),
      outcome:
        'The fireball fills the pit. The eggs pop one by one.\n\n'
        + 'When the smoke clears, the heat has fused what is left into a single lump of crystal.',
    },
    {
      id: 'chute_smash',
      text: 'Smash the eggs',
      action: (gs, scene) => scene.smashCrystalEggs(CHUTE_FIGHT_ON_SMASH),
      outcome: (gs, scene) => (scene.chuteFight
        ? `The third egg is already open. So is the fourth.\n\nSmall crystal legs come out of the heap.`
        : `You crush them all. It is loud, and nothing answers.\n\nThe shards are worth something.`),
    },
    {
      id: 'chute_take_egg',
      text: 'Take one egg',
      action: (gs, scene) => scene.takeCrystalSpiderEgg(),
      outcome: 'You pick the smallest one. It is cold, and heavier than it looks.\n\nSomething inside taps back.',
    },
    {
      id: 'chute_leave_nest',
      text: 'Leave the nest',
      action: () => {},
      outcome: 'You leave the eggs where they are and climb out the long way.',
    },
  ];
}

export default {
  id: 'old_chute',
  title: 'The Old Chute',
  description:
    'A flagstone tips under your boot. You drop into an old trap chute and slide a long way down in the dark.\n\n'
    + 'Whatever was meant to be waiting at the bottom rotted away years ago. You land unhurt, on something that goes crack.\n\n'
    + 'Under you is a spider the size of a dog, made of clear crystal. Most of it is in pieces now.',
  choices: [
    {
      id: 'chute_take_leg',
      text: 'Take a crystal leg',
      action: (gs, scene) => scene.takeCrystalSpiderLeg(),
      outcome: `One leg came off clean. It is cold, and it still catches the light.\n\n${NEST}`,
      next: { choices: nestChoices() },
    },
    {
      id: 'chute_leave_mother',
      text: 'Leave her be',
      action: () => {},
      outcome: `You climb off her and leave her where she lies.\n\n${NEST}`,
      next: { choices: nestChoices() },
    },
  ],
};

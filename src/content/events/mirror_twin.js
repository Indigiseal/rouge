// The Mirror Twin (Silkdeep or Thornwake). A lost reflection from Mirrorwane
// copies everything you do and will not let you rest. Distract it with
// something shiny and sneak away (falling into an old pit with a long-dead
// adventurer's belongings), or hand it a Hand Mirror and watch it get sucked
// inside, which turns the mirror into the Twinned Mirror.

const TRAP_ENDING =
  'You lift your pack one strap at a time and back out of the corner. He doesn\'t look up.\n\n'
  + 'On the sixth step the floor stops.\n\n'
  + 'You land on old rugs beside a dead camp. A note under a stone: '
  + '"Day 4. Mirror man STILL here. Going to try sneaking. Don\'t look back."\n\n'
  + 'Under it, an amulet. You take it and climb out the far side. You don\'t look back.';

export default {
  id: 'mirror_twin',
  title: 'The Mirror Twin',
  description:
    'A dry corner. You sit down and shut your eyes.\n\n'
    + 'When you open them, someone is sitting across from you. Hooded, cross-legged, wearing your face. '
    + 'The scar on your chin is on his other side.\n\n'
    + 'You scratch your nose. He scratches his nose. His knees touch yours.',
  choices: [
    {
      id: 'mirror_twin_shard',
      text: 'Give him a shard',
      condition: (gs, scene) => scene.hasLooseGem(),
      action: (gs, scene) => scene.giveLooseGem(),
      outcome:
        'He holds the shard up. A face looks back from it, not yours. He turns to look closer.',
      next: {
        choices: [{
          id: 'mirror_twin_sneak_shard',
          text: 'Sneak away',
          action: (gs, scene) => scene.mirrorTwinPitReward(['uncommon', 'rare', 'epic', 'legendary']),
          outcome: TRAP_ENDING,
        }],
      },
    },
    {
      id: 'mirror_twin_lens',
      text: "Give him the Gemseeker's Lens",
      condition: (gs, scene) => scene.hasAmulet('gemseekersLens'),
      action: (gs, scene) => scene.giveAwayAmulet('gemseekersLens'),
      outcome:
        'Even better: his own face, enormous. He presses his nose to it and forgets you.',
      next: {
        choices: [{
          id: 'mirror_twin_sneak_lens',
          text: 'Sneak away',
          action: (gs, scene) => scene.mirrorTwinPitReward(['rare', 'epic', 'legendary']),
          outcome: TRAP_ENDING,
        }],
      },
    },
    {
      id: 'mirror_twin_hand_mirror',
      text: 'Give him the Hand Mirror',
      condition: (gs, scene) => scene.hasAmulet('handMirror'),
      action: (gs, scene) => scene.absorbMirrorTwin(),
      outcome:
        'He looks into the mirror. Another him looks back. He leans in. So does the other one.\n\n'
        + 'Whoosh.\n\n'
        + 'You pick up the mirror. Your reflection isn\'t in it. He is, pressed flat against the glass, '
        + 'looking pleased.',
    },
    {
      id: 'mirror_twin_stare',
      text: 'Try to out-stare him',
      action: (gs, scene) => scene.markMirrorTwinSeen(),
      outcome:
        'You blink first. He does a small victory dance and wanders off, still dancing. '
        + 'You do not get your rest.',
    },
  ],
};

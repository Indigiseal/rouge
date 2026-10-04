// The Mirror Twin (Silkdeep or Thornwake). A lost reflection from Mirrorwane
// copies everything you do and will not let you rest. Distract it with
// something shiny and sneak away (falling into an old pit with a long-dead
// adventurer's belongings), or hand it a Hand Mirror and watch it get sucked
// inside, which turns the mirror into the Twinned Mirror.

const TRAP_ENDING =
  'You don\'t breathe. You lift your pack one finger at a time and step backward. Then again.\n\n'
  + 'One more step. The floor isn\'t there.\n\n'
  + 'You land on old rugs and a pack gone grey with dust. Decades old, maybe. A note: '
  + '"Day 4. Mirror man STILL here. Going to try sneaking away. Don\'t look back."\n\n'
  + 'Under it lies an amulet. You take it, climb out the far side, and don\'t look back.';

export default {
  id: 'mirror_twin',
  title: 'The Mirror Twin',
  description:
    'At last, a quiet corner. You sit down and close your eyes.\n\n'
    + 'When you open them, someone is sitting across from you. You. Almost. His face is the wrong way round.\n\n'
    + 'You scratch your nose. He scratches his nose. You turn away. He is already there, '
    + 'two fingers from your face.\n\n'
    + '"..." you say.\n\n"..." he says, louder.',
  choices: [
    {
      id: 'mirror_twin_shard',
      text: 'Give him a shard',
      condition: (gs, scene) => scene.hasLooseGem(),
      action: (gs, scene) => scene.giveLooseGem(),
      outcome:
        'He holds the shard up to the light. Another face looks back at him, '
        + 'and he forgets you completely.',
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
        'A magnifying glass is even better: his face, but enormous. '
        + 'He presses his nose to it and is lost.',
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
        'He looks into the mirror. Another him looks back. He leans closer. So does the other one.\n\n'
        + 'Closer.\n\nShlup.\n\n'
        + 'You pick the mirror up. Your reflection isn\'t there. He is, pressed flat against the glass, '
        + 'looking delighted.',
    },
    {
      id: 'mirror_twin_stare',
      text: 'Try to out-stare him',
      action: (gs, scene) => scene.markMirrorTwinSeen(),
      outcome:
        'You lose. He wins so hard he does a little victory dance, which you also have to watch.\n\n'
        + 'Eventually he wanders off, still dancing. You do not get your rest.',
    },
  ],
};

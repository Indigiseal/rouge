export default {
    id: 'slimy_prison',
    title: 'The Slimy Prison',
    description: 'A gelatinous cube blocks the hallway.\n\nAt first, you think there is just an old skeleton floating inside it. Then the skeleton moves. Torn mage robes drift around him like weeds in water. A green glow crawls over his ribs, rebuilding the bones as fast as the cube eats them away.\n\nThe skeleton mage turns his skull toward you and opens his jaw. Green light burns in his empty eye sockets.',
    choices: [
      {
        text: 'Pull him free',
        outcomeFrame: 17,
        action: (gs, scene) => {
          scene.damagePlayer(10, 'gelatinous_cube', 'The Slimy Prison');
          scene.gainSkeletonWarriorCompanion();
        },
        outcome: 'You drag the skeleton mage out of the cube.\n\nSlime drips from his torn robes as he places a slimy card in your hand. A Skeleton Warrior is painted on it, holding a cracked sword.\n\nThe mage nods once. A dark portal opens behind him, and he vanishes.'
      },
      {
        text: 'End his suffering',
        outcomeFrame: 18,
        action: (gs, scene) => scene.gainRandomCursedAmulet(),
        outcome: 'You raise your weapon and strike through the cube.\n\nThe green spell inside the mage’s ribs cracks. For the first time, the bones stop healing. The skeleton mage sinks slowly into the slime.\n\nA dark amulet rises from what is left of him.'
      },
      {
        text: 'Grab the floating amulet',
        outcomeFrame: 16,
        action: (gs, scene) => {
          scene.damagePlayer(8, 'gelatinous_cube', 'The Slimy Prison');
          scene.gainRandomNonCursedAmulet();
        },
        outcome: 'There is an amulet floating near the mage’s ribs.\n\nYou ignore his reaching hand and shove your arm into the cube. The slime burns your skin as you pull the amulet free.\n\nThe skeleton mage watches you through the black-green glass. He remains trapped.'
      }
    ]
  };

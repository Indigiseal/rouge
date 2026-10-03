export default {
    id: 'slimy_prison',
    title: 'The Slimy Prison',
    description: 'A gelatinous cube fills the corridor. Inside it, a skeleton in torn mage robes, drifting.\n\nThen it moves. Green light crawls along its ribs, rebuilding bone as fast as the cube dissolves it.\n\nThe skull turns toward you.',
    choices: [
      {
        text: 'Pull him free',
        outcomeFrame: 17,
        action: (gs, scene) => {
          scene.damagePlayer(10, 'gelatinous_cube', 'The Slimy Prison');
          scene.gainSkeletonWarriorCompanion();
        },
        outcome: 'The cube fights you for him, and takes some skin.\n\nOn the far side he stands, drips, and presses a card into your hand: a skeleton warrior with a cracked sword.\n\nA portal opens behind him. He is gone before you can ask anything.'
      },
      {
        text: 'End his suffering',
        outcomeFrame: 18,
        action: (gs, scene) => scene.gainRandomCursedAmulet(),
        outcome: 'You drive your weapon through the cube. The green light gutters and goes out.\n\nFor the first time, the bones are allowed to stop. He sinks slowly through the slime.\n\nWhat is left of the spell condenses into a dark amulet.'
      },
      {
        text: 'Grab the floating amulet',
        outcomeFrame: 16,
        action: (gs, scene) => {
          scene.damagePlayer(8, 'gelatinous_cube', 'The Slimy Prison');
          scene.gainRandomNonCursedAmulet();
        },
        outcome: 'There is an amulet drifting near his ribs.\n\nYou push your arm in past his reaching hand and take it. The slime burns the whole way.\n\nHe watches you leave through the green glass. Still trapped.'
      }
    ]
  };

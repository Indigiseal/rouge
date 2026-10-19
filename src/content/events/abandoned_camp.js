// A camp its owners left in a hurry, and the one of them who did not get far.
// Shared: appears once per run in any location. Sleeping there or taking the
// dead man's things can end in a fight with whatever lives in this location
// (EventRunHelpers.rollCampFight), so the camp reads differently on every road.

// Chance of a fight when the player sleeps in the tent or loots the body.
// Rolled out of sight: the player only sees what happens.
export const CAMP_FIGHT_ON_SLEEP = 1 / 3;
export const CAMP_FIGHT_ON_LOOT = 1 / 3;

const lootChoice = (id, text, take) => ({
  id,
  text,
  action: (gs, scene) => {
    take(scene);
    scene.rollCampFight(CAMP_FIGHT_ON_LOOT);
  },
  outcome: (gs, scene) => (scene.campFight
    ? `You are still crouched over him when the tent flap moves behind you.\n\nThere is no wind down here.`
    : `Nothing moves. You leave him the rest.`),
});

export default {
  id: 'abandoned_camp',
  title: 'The Abandoned Camp',
  description:
    'A camp in a side chamber, left in a hurry. The fire is cold. The tent still stands, one pole leaning.\n\n'
    + 'Bedrolls, a cooking pot, a bag half unpacked. Nobody came back for any of it.',
  choices: [
    {
      id: 'camp_sleep',
      text: 'Sleep in the tent',
      action: (gs, scene) => {
        scene.heal(20);
        scene.rollCampFight(CAMP_FIGHT_ON_SLEEP);
      },
      outcome: (gs, scene) => (scene.campFight
        ? `In the night, something walks around the tent. Then it stops walking.`
        : `You sleep. Nobody comes.\n\nIn the morning the camp is exactly as they left it.`),
    },
    {
      id: 'camp_search',
      text: 'Look around the camp',
      action: () => {},
      outcome:
        'Behind the tent, half under the bedrolls, you find one of them.\n\n'
        + 'His sword is out of its sheath. The blade is clean. There is not a mark on him.\n\n'
        + 'He did not die fighting. His face looks as if he saw a ghost.',
      next: {
        choices: [
          lootChoice('camp_take_pack', 'Take his backpack', (scene) => scene.takeCampBackpack()),
          lootChoice('camp_take_sword', 'Take his sword', (scene) => scene.takeCampSword()),
          lootChoice('camp_take_armor', 'Take his armor', (scene) => scene.takeCampArmor()),
          {
            id: 'camp_bury',
            text: 'Bury him and pray',
            action: (gs, scene) => scene.heal(15),
            outcome:
              'You leave his things where they are. The ground is soft enough.\n\n'
              + 'When you finish the prayer, the chamber is very quiet. It feels like being let go.',
          },
          {
            id: 'camp_leave_body',
            text: 'Leave him',
            action: () => {},
            outcome: 'You leave him as you found him. You do not look at his face again.',
          },
        ],
      },
    },
    {
      id: 'camp_leave',
      text: 'Leave the camp',
      action: () => {},
      outcome: 'You leave the camp as it is. Whoever left it is not coming back.',
    },
  ],
};

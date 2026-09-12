export default {
  id: 'goblin_mine',
  title: 'The Crystal Mine',
  description: 'A mine mouth cuts into the rock beside the road. Goblins in dusty miners\' clothes crowd around wagons of dynamite and rough crystals. Their foreman stalks between them, waving a tally sheet and cursing everyone in reach.',
  choices: [
    {
      id: 'mine_fireball',
      text: 'Cast Fireball at the dynamite',
      condition: (gs, scene) => scene.hasFireballCard(),
      action: (gs, scene) => scene.burnGoblinMine(),
      outcome: 'The scroll crumbles and fire crosses the road in a single bright arc. The dynamite answers all at once.\n\nWhen stones finally stop falling, you search the smoking crater. Most of the crystal wagons are splinters, but three crystals survived beneath an overturned axle.',
    },
    {
      id: 'mine_sneak',
      text: 'Try to slip away unnoticed',
      action: (gs, scene) => scene.sneakPastGoblinMine(),
      outcome: (gs, scene) => scene.goblinMineSneakOutcome,
    },
    {
      id: 'mine_talk',
      text: 'Put away your weapon and approach',
      action: () => {},
      outcome: 'Every weapon in the work gang points at you. The foreman pushes through the line and demands to know your business.\n\n“Only a traveller,” you say. “I am exploring these lands.”\n\nThe foreman spits into the dust. Since the Goblin King took the road, he explains, ordinary workers have paid impossible tribute. Crystal miners now work three shifts and still fall behind. This shipment will be late because one fool abandoned the detonator inside the mine after seeing spiders.',
      next: {
        choices: [
          {
            id: 'mine_help',
            text: 'Offer to recover the detonator',
            action: (gs, scene) => scene.enterGoblinMine(),
            outcome: 'You follow twisting galleries deep beneath the road. In the next cavern the missing detonator lies beside a drilled charge.\n\nAs you reach for it, pale legs unfold from cracks in the walls. Spiders begin dropping onto the mine floor.',
          },
          {
            id: 'mine_refuse',
            text: 'Refuse and leave',
            action: (gs, scene) => scene.refuseGoblinMiners(),
            outcome: 'The foreman watches you back away. Behind him, the tally sheet flaps against an empty crystal wagon. Nobody lowers a weapon until the mine is out of sight.',
          },
        ],
      },
    },
  ],
};

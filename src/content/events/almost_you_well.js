export default {
    id: 'almost_you_well',
    title: 'The Well of Almost-You',
    description: 'A stone well, filled nearly to the lip with black water — more tar than water.\n\nYour reflection is wrong. Frizzled hair. Cracked armor. And in its hand, a card you have never owned.\n\n(Drag a weapon, armor or thorns card into the well — it sinks, and something else of the same rarity comes up.)',
    choices: [
      {
        text: 'Reach into the well',
        action: (gs, scene) => {
          scene.loseHealthCapped(15);
          if (scene.damageEquippedArmor(1)) scene._reward('Armor -1 pip');
          scene.gainRandomAmulet();
        },
        outcome: 'The water is cold. Then it grabs back.\n\nFor a second your arm is somewhere else — another room, another run. You pull free with something in your fist.\n\nYour reflection is smiling now.'
      },
      {
        text: 'Drop a crystal into the well',
        condition: (gs) => (gs?.crystals || 0) >= 1,
        action: (gs, scene) => {
          const before = gs.crystals || 0;
          gs.crystals = Math.max(0, before - 1) + 4;
          scene.gameScene?.updateUI?.();
          scene._reward(`+${gs.crystals - before} crystals`);
        },
        outcome: 'You drop a crystal in. It falls upward.\n\nYour reflection catches it, studies it, pockets it — and sends four back down.'
      },
      {
        text: 'Walk away',
        action: () => {},
        outcome: 'You step back from the edge.\n\nYour reflection stays a second longer than it should. Then it steps back too.'
      }
    ]
  };

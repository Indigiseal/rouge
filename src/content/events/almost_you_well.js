export default {
    id: 'almost_you_well',
    title: 'The Well of Almost-You',
    description: 'A stone well stands in the middle of the room, filled almost to the top with thick black water — more tar than water.\n\nYou lean over and see your reflection. But it is wrong: frizzled hair, cracked armor, and one card in its hand you have never seen.\n\n(Drag a weapon, armor or thorns card onto the well. It sinks — and a different item of the same rarity rises back in its place.)',
    choices: [
      {
        text: 'Reach into the well',
        action: (gs, scene) => {
          scene.loseHealthCapped(15);
          if (scene.damageEquippedArmor(1)) scene._reward('Armor -1 pip');
          scene.gainRandomAmulet();
        },
        outcome: 'You push your hand into the black water. It is cold — then it grabs back. For a moment your arm is somewhere else: another room, another run, another ending. You pull free with something clenched in your fist. Your reflection is smiling now.'
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
        outcome: 'You drop one crystal into the black water. It falls upward. Your reflection catches it, studies it, and drops something back. Four crystals rise from the well and clatter onto the stone.'
      },
      {
        text: 'Walk away',
        action: () => {},
        outcome: 'You step back from the well. Your reflection stays where it is. Then, one second too late, it also steps back.'
      }
    ]
  };

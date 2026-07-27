// The Goblin King's tax collectors. Only appears on runs where he is the act's
// boss (see EventScene._pickEvent), so whatever the player does here is waiting
// for them at floor 15.
//
// There is deliberately no "kill them" option: if the collectors could die, the
// thread to the boss would die with them. They always escape — the only
// question is how badly they were hurt on the way out.

/** What the goblins are asking for on this floor. */
export function tollForFloor(floor) {
  return (Math.max(1, Number(floor) || 1) * 2) + 20;
}

export default {
    id: 'toll_collectors',
    title: 'Toll Collectors',
    description: (gs) => {
      const toll = tollForFloor(gs?.currentFloor);
      return `The corridor ends at a pair of heavy wooden doors, barred with iron and shut.\n\nThree goblins stand in front of them. One has a sword and a shield much too big for him. One holds a tally board and a stub of chalk. The third is there to make three.\n\nA plank nailed across the doors reads, in fresh paint:\n\nTOLL. ${toll} COINS.\n\nThe one with the tally board looks you over and writes something down before you have said anything.`;
    },
    // Built as a function so the toll can be priced into the button label.
    choices: (gs, scene) => {
      const toll = tollForFloor(gs?.currentFloor);
      return [
        {
          id: 'toll_pay',
          text: `Pay the toll (${toll} coins)`,
          condition: () => (gs?.coins || 0) >= toll,
          action: (state, s) => s.payTheToll(toll),
          outcome: 'You count it out. The goblin with the tally board counts it again, slower, to be sure.\n\nThen all three put their shoulders to the bar and haul the doors open, suddenly polite.\n\n"Marked paid," he says, chalking a line onto the board. "They\'ll know you further down."'
        },
        {
          id: 'toll_intimidate',
          text: 'Intimidate them',
          // Goblins count coins, not steel — a properly frightening weapon is
          // the only argument they actually respect.
          condition: (state, s) => s.hasIntimidatingWeapon(),
          action: (state, s) => s.intimidateTollCollectors(),
          outcome: (state, s) => s.tollIntimidateOutcome
        },
        {
          id: 'toll_attack',
          text: 'Rush the doors',
          action: (state, s) => s.attackTollCollectors(),
          outcome: 'You are on them before the tally board hits the floor.\n\nThey are not soldiers. They are clerks with knives, and all three of them know it.'
        },
        {
          id: 'toll_wait',
          text: 'Wait and watch',
          action: (state, s) => s.waitAtTheToll(),
          outcome: 'You stay back in the dark and wait.\n\nA merchant comes up the corridor pushing a handcart, sees the barred doors, and starts arguing about the price. All three goblins close in around him, and one heaves a door open to get at the cart.\n\nYou go through the gap while they are busy. Behind you the arguing stops, which is worse than if it had not.'
        }
      ];
    }
  };

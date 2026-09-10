export default {
  id: 'goblin_mine_return',
  title: 'The Foreman’s Promise',
  description: 'You emerge from the mine with the detonator. The foreman takes it in both hands, checks the brass contacts, and finally lets himself breathe.\n\nThe miners can make their quota now—but instead of thanking the King, they gather close around their foreman.',
  choices: [
    {
      id: 'mine_accept_promise',
      text: 'Return the detonator',
      action: (gs, scene) => scene.completeGoblinMineAlliance(),
      outcome: 'The foreman hides the detonator beneath his coat.\n\n“You helped working goblins when you could have taken our carts,” he says. “When you go for the King, watch the old bridge. We know where its stones are weakest.”\n\nOne by one, the miners nod. The next explosion they set will not be for crystal.',
    },
  ],
};

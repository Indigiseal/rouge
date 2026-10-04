// Silkdeep follow-up to The Lost Porter. Only queued once the player holds the
// Porter's Map. The party argues about the map they "lost"; returning it costs
// the amulet and earns nothing but a pat on the shoulder.

export default {
  id: 'porter_party_argument',
  title: 'Voices Around the Corner',
  description:
    'Three voices, low and angry, just past the next turn.\n\n'
    + '"You had the map." "No, HE had the map. He carries everything." "So go back and get it." '
    + '"Past the spider? You go back."\n\n'
    + '"We didn\'t lose him. We left him. That\'s different."\n\n'
    + '"Not to the map, it isn\'t."',
  choices: [
    {
      id: 'porter_party_sneak',
      text: 'Sneak past',
      action: (gs, scene) => scene.resolvePorterParty('sneak'),
      outcome:
        'You keep to the far wall and step only on the silk, where it swallows the sound.\n\n'
        + 'They are still arguing when you reach the next room. They never look up.',
    },
    {
      id: 'porter_party_confront',
      text: 'Confront them',
      action: (gs, scene) => scene.resolvePorterParty('confront'),
      outcome:
        'Three hands go to three weapons, then relax when they see you are alone.\n\n'
        + '"Your porter is fine," you say. "He thinks he got lost."\n\n'
        + 'They look at their boots. "...Good," the leader mutters at last. "Good for him."',
    },
    {
      id: 'porter_party_return',
      text: 'Give them back the map',
      condition: (gs, scene) => scene.hasAmulet('porterMap'),
      action: (gs, scene) => scene.resolvePorterParty('return'),
      outcome:
        'The leader snatches the map and tucks it away as if it had never left.\n\n'
        + 'Then he pats you on the shoulder. Twice. The way you pat a dog that brought back a stick.\n\n'
        + '"Decent of you. Very decent. Off you go, then."',
    },
  ],
};

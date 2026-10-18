export default {
  id: 'drowned',
  name: 'Drowned',
  role: 'MELEE',
  minFloor: 16,
  archetype: 'skirmisher',
  // Slow risen from black pools — they take hold and will not let you past.
  features: ['taunt'],
  // The Bride's dead drain you as she does.
  sigils: [{ id: 'sapping' }],
};

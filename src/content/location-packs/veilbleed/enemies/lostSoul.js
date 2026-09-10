export default {
  id: 'lostSoul',
  name: 'Lost Soul',
  role: 'MELEE',
  minFloor: 16,
  archetype: 'swarm',
  // The thin veil pulls it back and forth: the card turns face-down again on
  // its own, so a soul you found is not a soul you have dealt with.
  features: ['veil_flip'],
};

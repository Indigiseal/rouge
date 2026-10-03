export default {
  id: 'bogSlug',
  name: 'Bog Slug',
  role: 'MELEE',
  minFloor: 16,
  archetype: 'swarm',
  // It attaches and rasps. gnaw is the closest implemented feature: it eats
  // armour durability rather than health, so the cost of being latched onto
  // shows up on your gear.
  features: ['gnaw'],
};

export default {
  id: 'spittingSpider',
  name: 'Spitting Spider',
  sprite: 'enemyPlaceholder',
  placeholderArt: true,
  role: 'RANGED',
  minFloor: 1,
  archetype: 'artillery',
  abilities: [{ type: 'poison', damage: 2, turns: 3, stackable: true }],
};

// Catalog of meta talents and amulets for sim CLI / dashboard pickers.
import './mock.js';
import { AmuletManager } from '../src/managers/AmuletManager.js';
import { CardDataGenerator } from '../src/systems/loot/CardDataGenerator.js';
import { TALENT_NODES } from '../src/content/talents/index.js';

/** Relic meta retired — kept for dashboard API compatibility. */
export function getRelicCatalog() {
  return [];
}

/** @returns {{ id: string, name: string, description: string, hint: string, characterId: string, branchId: string, wip: boolean }[]} */
export function getTalentCatalog() {
  return Object.values(TALENT_NODES).map((n) => ({
    id: n.id,
    name: n.name,
    description: (n.descriptionRanks && n.descriptionRanks[0]) || '',
    hint: n.wip ? 'WIP branch' : 'Purchasable',
    characterId: n.characterId,
    branchId: n.branchId,
    wip: !!n.wip,
  }));
}

/** @returns {{ id: string, name: string, description: string, hint: string, rarity: string, droppable: boolean }[]} */
export function getAmuletCatalog() {
  const stub = {
    gameState: { activeAmulets: [] },
    createFloatingText() {},
    updateUI() {},
    playerAvatar: { x: 0, y: 0 },
  };
  const defs = new AmuletManager(stub).amuletDefinitions;
  const dropIds = new Set(new CardDataGenerator().amuletTypes.map((a) => a.id));
  const rarityOrder = { common: 0, uncommon: 1, rare: 2, legendary: 3, cursed: 4 };

  return Object.entries(defs)
    .filter(([, a]) => a.rarity && a.rarity !== 'old')
    .map(([id, a]) => ({
      id,
      name: a.name || id,
      description: a.description || '',
      hint: [
        a.description || id,
        dropIds.has(id) ? 'В дропе/магазине (оффер: редкость → выбор из 3).' : 'Не в обычном дропе.',
        a.rarity ? `Редкость: ${a.rarity}.` : '',
      ].filter(Boolean).join(' '),
      rarity: a.rarity || 'common',
      droppable: dropIds.has(id),
      cursed: a.rarity === 'cursed' || !!a.cursed,
    }))
    .sort((a, b) => {
      const rd = (rarityOrder[a.rarity] ?? 9) - (rarityOrder[b.rarity] ?? 9);
      if (rd !== 0) return rd;
      return a.name.localeCompare(b.name);
    });
}

export function getDefaultRelicIds() {
  return getRelicCatalog().map((r) => r.id);
}

export function getDefaultAmuletIds() {
  return getAmuletCatalog().map((a) => a.id);
}

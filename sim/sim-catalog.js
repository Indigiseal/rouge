// Catalog of meta relics and amulets for sim CLI / dashboard pickers.
import './mock.js';
import { MetaProgressionManager } from '../MetaProgressionManager.js';
import { AmuletManager } from '../AmuletManager.js';
import { CardDataGenerator } from '../CardDataGenerator.js';

const RELIC_HINTS = {
  spiderVenom: 'Мета-приз: яд на оружии. Обычно с смерти от паука.',
  webWeaver: 'Мета-приз: шанс вернуть смерженную карту. Тир 2 паука.',
  boneArmor: 'Мета-приз: стартовая костяная броня. Скелет.',
  undeadResilience: 'Мета-приз: +HP в начале каждого этажа. Скелет.',
  greedyPockets: 'Мета-приз: первая атака этажа x2. Гоблин.',
  scavenger: 'Мета-приз: +20% монет. Гоблин.',
  giantStrength: 'Босс-релик: +1 урон оружия (Giant Skeleton).',
  queenBlessing: 'Босс-релик: иммунитет к яду (Spider Queen).',
  lichCurse: 'Босс-релик (проклятый): вампиризм с убийств, −max HP (Lich).',
  veteranExplorer: 'Майлстоун: +1 слот инвентаря (после нескольких смертей).',
  tent: 'Майлстоун: +max HP за износ durability-карт.',
  luckyScrap: 'Майлстоун: броня изнашивается вдвое медленнее.',
  dungeonMaster: 'Майлстоун: +1 открытая карта в начале этажа.',
};

/** @returns {{ id: string, name: string, description: string, hint: string, boss?: boolean, cursed?: boolean }[]} */
export function getRelicCatalog() {
  const defs = new MetaProgressionManager({}).getRelicDefinitions();
  return Object.values(defs).map((r) => ({
    id: r.id,
    name: r.name || r.id,
    description: r.description || '',
    hint: RELIC_HINTS[r.id] || r.description || r.id,
    boss: !!r.boss,
    cursed: !!r.cursed,
    killedBy: r.killedBy || null,
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

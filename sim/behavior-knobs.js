export const BEHAVIOR_PRESETS = {
  balanced: {
    keepScore: {
      companion: 1000,
      monsterEgg: 1000,
      amuletPickup: 180,
      magicBase: 115,
      magicByType: {
        restoration: 320,
        soulDrain: 260,
        frostRing: 220,
        fireball: 200,
        weakness: 180,
        magicShield: 175,
        boneWall: 170,
        mirrorShield: 160,
        shadowBlade: 155,
        smokeScreen: 145,
      },
      gemBase: 190,
      gemByEffect: {
        poison: 28,
        lightning: 20,
        fire: 16,
      },
      weaponBase: 120,
      daggerPenalty: 12,
      weaponDamageWeight: 8,
      weaponGemBonus: 18,
      armorBase: 110,
      armorProtectionWeight: 12,
      thornsBase: 100,
      thornsDamageWeight: 10,
      potionBase: 70,
      potionHealWeight: 1,
      key: 35,
      default: 10,
    },
    visibleLootPriority: {
      coin: 0,
      crystal: 0,
      food: 0,
      potion: 1,
      magic: 1,
      gem: 2,
      amulet: 3,
      amuletPickup: 3,
      weapon: 5,
      armor: 5,
      thorns: 5,
      default: 6,
    },
    thresholds: {
      potionUseHpPct: 0.72,
      potionUseMissingHealPct: 0.45,
      emergencyHealHpPct: 0.5,
      restorationSafeHpPct: 0.55,
      restorationEmergencyHpPct: 0.4,
      restorationMinMissingAp: 2,
      magicLowHpPct: 0.55,
      defensiveMagicHpPct: 0.6,
      shadowBladeMinTurns: 3,
    },
    gemPreference: {
      bossPoisonBias: 24,
      rangedLightningBias: 20,
      hiddenFireBias: 18,
      emptySocketBias: 6,
      poisonBase: 10,
      lightningBase: 8,
      fireBase: 7,
    },
    magicPriority: {
      restoration: 400,
      soulDrain: 290,
      frostRing: 225,
      fireball: 205,
      weakness: 180,
      magicShield: 170,
      boneWall: 165,
      mirrorShield: 150,
      shadowBlade: 145,
      smokeScreen: 130,
    },
    attackWeights: {
      kills: 1000,
      targetKill: 80,
      totalDamage: 8,
      elementalBonus: 3,
      overkillPenalty: 0.4,
      durabilityConserve: 0.02,
    },
    routeValue: {
      EVENT: 90,
      SHOP: 70,
      RARE_SHOP: 65,
      ANVIL: 60,
      REST: 45,
      TREASURE_GOOD: 40,
      TREASURE: 30,
      COMBAT: -45,
      ELITE: -80,
      BOSS: -30,
      default: 0,
    },
  },
  safe: {
    thresholds: {
      potionUseHpPct: 0.8,
      emergencyHealHpPct: 0.62,
      restorationSafeHpPct: 0.68,
      restorationEmergencyHpPct: 0.52,
      magicLowHpPct: 0.7,
      defensiveMagicHpPct: 0.72,
      shadowBladeMinTurns: 5,
    },
    magicPriority: {
      restoration: 460,
      frostRing: 260,
      weakness: 230,
      magicShield: 220,
      boneWall: 215,
      mirrorShield: 205,
      soulDrain: 250,
    },
    attackWeights: {
      overkillPenalty: 0.5,
      durabilityConserve: 0.03,
    },
  },
  combat: {
    keepScore: {
      gemBase: 210,
      weaponGemBonus: 24,
      potionBase: 60,
    },
    magicPriority: {
      fireball: 240,
      soulDrain: 320,
      shadowBlade: 210,
      restoration: 360,
    },
    attackWeights: {
      totalDamage: 9,
      elementalBonus: 5,
      durabilityConserve: 0.015,
    },
  },
  magicHeavy: {
    keepScore: {
      magicBase: 250,
      gemBase: 280,
      weaponBase: 70,
      weaponDamageWeight: 4,
      weaponGemBonus: 110,
      potionBase: 50,
      daggerPenalty: 20,
    },
    visibleLootPriority: {
      magic: 0,
      gem: 0,
      potion: 2,
      amulet: 3,
      amuletPickup: 3,
      armor: 6,
      thorns: 6,
      weapon: 7,
      default: 8,
    },
    thresholds: {
      magicLowHpPct: 0.95,
      defensiveMagicHpPct: 0.9,
      shadowBladeMinTurns: 2,
      potionUseHpPct: 0.68,
    },
    gemPreference: {
      emptySocketBias: 55,
      poisonBase: 28,
      lightningBase: 24,
      fireBase: 22,
      bossPoisonBias: 45,
      rangedLightningBias: 40,
      hiddenFireBias: 35,
    },
    attackWeights: {
      elementalBonus: 55,
      totalDamage: 7,
      durabilityConserve: 0.01,
    },
    magicPriority: {
      restoration: 420,
      soulDrain: 360,
      frostRing: 320,
      fireball: 310,
      weakness: 280,
      magicShield: 250,
      boneWall: 245,
      mirrorShield: 230,
      shadowBlade: 240,
      smokeScreen: 220,
    },
  },
};

function mergeNested(base, patch) {
  if (!patch) return structuredClone(base);
  const out = structuredClone(base);
  for (const [key, value] of Object.entries(patch)) {
    if (
      value
      && typeof value === 'object'
      && !Array.isArray(value)
      && out[key]
      && typeof out[key] === 'object'
      && !Array.isArray(out[key])
    ) {
      out[key] = mergeNested(out[key], value);
    } else {
      out[key] = structuredClone(value);
    }
  }
  return out;
}

export function getBehaviorProfile(name = 'balanced') {
  const base = BEHAVIOR_PRESETS.balanced;
  if (!name || name === 'balanced') return structuredClone(base);
  const preset = BEHAVIOR_PRESETS[name];
  return preset ? mergeNested(base, preset) : structuredClone(base);
}

export function getBehaviorPresetNames() {
  return Object.keys(BEHAVIOR_PRESETS);
}

/** Human-readable decode for dashboard / CLI help. */
export const BEHAVIOR_DESCRIPTIONS = {
  balanced: {
    title: 'Сбалансированный',
    summary: 'Базовая политика: умеренный риск, ценит оружие/броню, лечится не слишком рано.',
    details: [
      'Зелья: ~ниже 72% HP или если хил закрывает заметную дыру.',
      'Магия: restoration при низком HP/AP; offensive (fireball, soulDrain) когда есть цели.',
      'Лут: оружие/броня важнее гемов и магии; companion/яйца почти всегда берёт.',
      'Маршрут: EVENT/SHOP выше боя; элиты избегает сильнее обычного combat.',
    ],
  },
  safe: {
    title: 'Осторожный',
    summary: 'Танкует и лечится раньше; больше защитной магии, меньше агрессии.',
    details: [
      'Зелья и restoration срабатывают на более высоком % HP (~80% / ~62% emergency).',
      'Приоритет frostRing, weakness, magicShield, boneWall, mirrorShield выше.',
      'Атаки чуть бережнее по durability, меньше overkill ради «добить любой ценой».',
      'Подходит для оценки «насколько контент проходим осторожным игроком».',
    ],
  },
  combat: {
    title: 'Боевой',
    summary: 'Агрессия и урон: гемы, soulDrain/fireball, меньше запаса по зельям.',
    details: [
      'Гемы на оружии ценятся выше; elemental-бонус в выборе цели сильнее.',
      'soulDrain и fireball выше в очереди магии; restoration чуть ниже safe.',
      'Зелья держит реже (ниже keepScore potion) — больше слотов под бой.',
      'Полезен для потолка DPS / clear% при активном гемминге.',
    ],
  },
  magicHeavy: {
    title: 'Магический / гемы',
    summary: 'Свитки и камни важнее оружия: подбирает и тратит их в первую очередь.',
    details: [
      'Видимый лут: magic/gem раньше оружия и брони.',
      'Сильно предпочитает оружие с уже вставленным гемом; пустые сокеты заполняет агрессивно.',
      'Боевые свитки (fireball, soulDrain, shields) кастует охотнее даже на высоком HP.',
      'Нужен для оценки амулетов вроде рун камней / Gloves of the Hermit Wizard.',
    ],
  },
};

export function getBehaviorCatalog() {
  return getBehaviorPresetNames().map((id) => ({
    id,
    ...(BEHAVIOR_DESCRIPTIONS[id] || { title: id, summary: id, details: [] }),
  }));
}

// Central balance tuning knobs — adjusted by sim/balance-tune.mjs iterations.
// Applied in CardDataGenerator, cardSystem, GameState.

export const KNOBS = {
  label: 'tune-early-hard',
  playerStartHp: 121,
  enemyHp: {
    act1early: 1.40,
    act1late: 0.71,
    act2early: 1.05,
    act2mid: 1.48,
    act2late: 1.90,
    act3: 0.77,
  },
  enemyAtk: {
    act1early: 1.00,
    act1late: 0.96,
    act2early: 0.84,
    act2mid: 0.86,
    act2late: 0.88,
    act3: 0.82,
  },
  bossHp: 0.74,
  bossAtk: 0.92,
  bossHpAct2Mult: 1.8,
  globalScaleFloor: 20,
  globalHpMult: 1.06,
  globalAtkMult: 1.04,
  weaponWeightMult: 1.34,
  weaponMinBonus: 5,
  act2WeaponMult: 0.62,
  act2WeaponMinFactor: 0.4,
  act2EnemyWeightMult: 1.1,
  postBossWeaponBoost: 10,
  postBossWeaponMin: 2,
  armorWeightMult: 1.17,
  armorProtectionBonus: 1.085,
  minEnemyRatio: {
    act1: 0.195,
    act2: 0.24,
    act3: 0.28,
  },
};

export function actForFloor(floor) {
  if (floor <= 15) return 'act1';
  if (floor <= 30) return 'act2';
  return 'act3';
}

export function hpActKey(floor) {
  if (floor <= 7) return 'act1early';
  if (floor <= 15) return 'act1late';
  if (floor <= 18) return 'act2early';
  if (floor <= 25) return 'act2mid';
  if (floor <= 30) return 'act2late';
  return 'act3';
}

export function atkActKey(floor) {
  return hpActKey(floor);
}

export function enemyHpScale(floor) {
  return KNOBS.enemyHp[hpActKey(floor)] ?? 1;
}

export function enemyAtkScale(floor) {
  return KNOBS.enemyAtk[atkActKey(floor)] ?? 1;
}

export function minEnemyRatioForFloor(floor) {
  const k = KNOBS.minEnemyRatio;
  if (floor <= 15) return k.act1;
  if (floor <= 30) return k.act2;
  return k.act3;
}

export function globalCombatMult(floor) {
  if (floor < KNOBS.globalScaleFloor) return { hp: 1, atk: 1 };
  return { hp: KNOBS.globalHpMult, atk: KNOBS.globalAtkMult };
}

export function postBossWeaponFloor(floor) {
  return floor >= 16 && floor <= 19;
}

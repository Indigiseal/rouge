import { getAmuletAtlasPresentation } from './utils/RelicsOthersAtlas.js';
import { areAmuletsDisabled } from './utils/TestOptions.js';
import { KNOBS, enemyHpScale, enemyAtkScale, globalCombatMult, postBossWeaponFloor, actForFloor } from './sim/balance-knobs.js';

export class CardDataGenerator {
    constructor() {
        this.initializeWeaponUnlocks();
        this.initializeArmorUnlocks();
        this.initializeEnemyData();
        this.initializeBossData();
        this.initializeTrapData();
        this.initializeAmuletData();
        this.initializePotionData();
        this.initializeFoodData();
        this.initializeMagicCards();
        this.initializeFloorWeights();
    }

    initializeFloorWeights() {
        // Define weight progression for the early/mid run. Later floors use the formula below.
        // Act bosses are now floors 15, 30, and 45.
        this.floorWeights = {
            // Floors 1-4: Early game
            1: { enemy: 30, coin: 30, crystal: 5, trap: 5, weapon: 10, armor: 10, amulet: 2, potion: 8, food: 15, magic: 3, thorns: 2, key: 1 },
            2: { enemy: 35, coin: 25, crystal: 5, trap: 8, weapon: 10, armor: 10, amulet: 2, potion: 8, food: 15, magic: 3, thorns: 2, key: 1 },
            3: { enemy: 40, coin: 20, crystal: 8, trap: 10, weapon: 10, armor: 10, amulet: 3, potion: 10, food: 15, magic: 4, thorns: 2, key: 2 },
            4: { enemy: 40, coin: 20, crystal: 8, trap: 10, weapon: 10, armor: 10, amulet: 3, potion: 10, food: 12, magic: 4, thorns: 3, key: 2 },
            5: { enemy: 43, coin: 19, crystal: 9, trap: 11, weapon: 9, armor: 9, amulet: 4, potion: 10, food: 11, magic: 5, thorns: 3, key: 3 },
            
            // Floors 6-9
            6: { enemy: 45, coin: 18, crystal: 10, trap: 12, weapon: 8, armor: 8, amulet: 4, potion: 10, food: 10, magic: 5, thorns: 3, key: 3 },
            7: { enemy: 48, coin: 15, crystal: 10, trap: 14, weapon: 8, armor: 8, amulet: 5, potion: 10, food: 10, magic: 5, thorns: 3, key: 3 },
            8: { enemy: 50, coin: 15, crystal: 12, trap: 14, weapon: 7, armor: 7, amulet: 5, potion: 10, food: 10, magic: 6, thorns: 3, key: 3 },
            9: { enemy: 50, coin: 12, crystal: 12, trap: 15, weapon: 7, armor: 7, amulet: 5, potion: 10, food: 8, magic: 6, thorns: 3, key: 4 },
            10: { enemy: 51, coin: 12, crystal: 12, trap: 16, weapon: 7, armor: 7, amulet: 6, potion: 10, food: 8, magic: 7, thorns: 3, key: 4 },
            
            // Floors 11-14
            11: { enemy: 52, coin: 12, crystal: 12, trap: 16, weapon: 6, armor: 6, amulet: 6, potion: 10, food: 8, magic: 7, thorns: 3, key: 4 },
            12: { enemy: 55, coin: 10, crystal: 12, trap: 18, weapon: 6, armor: 6, amulet: 6, potion: 10, food: 8, magic: 7, thorns: 3, key: 4 },
            13: { enemy: 55, coin: 10, crystal: 14, trap: 18, weapon: 5, armor: 5, amulet: 7, potion: 10, food: 7, magic: 8, thorns: 3, key: 4 },
            14: { enemy: 58, coin: 8, crystal: 14, trap: 20, weapon: 5, armor: 5, amulet: 7, potion: 10, food: 7, magic: 8, thorns: 3, key: 5 },
            15: { boss: 100 }, // Spider Queen or Phantom Knight
            
            // Floors 16-19
            16: { enemy: 60, coin: 8, crystal: 15, trap: 22, weapon: 4, armor: 4, amulet: 8, potion: 10, food: 6, magic: 9, thorns: 3, key: 5 },
            17: { enemy: 62, coin: 6, crystal: 15, trap: 22, weapon: 4, armor: 4, amulet: 8, potion: 10, food: 6, magic: 9, thorns: 3, key: 5 },
            18: { enemy: 65, coin: 6, crystal: 15, trap: 24, weapon: 4, armor: 4, amulet: 9, potion: 10, food: 5, magic: 10, thorns: 3, key: 5 },
            19: { enemy: 65, coin: 5, crystal: 18, trap: 24, weapon: 3, armor: 3, amulet: 9, potion: 10, food: 5, magic: 10, thorns: 3, key: 6 },
            20: { enemy: 67, coin: 5, crystal: 18, trap: 25, weapon: 3, armor: 3, amulet: 10, potion: 10, food: 4, magic: 11, thorns: 3, key: 6 },
            
            // Floors 21-24
            21: { enemy: 68, coin: 5, crystal: 18, trap: 26, weapon: 3, armor: 3, amulet: 10, potion: 10, food: 4, magic: 11, thorns: 3, key: 6 },
            22: { enemy: 70, coin: 4, crystal: 18, trap: 28, weapon: 3, armor: 3, amulet: 10, potion: 10, food: 4, magic: 11, thorns: 3, key: 6 },
            23: { enemy: 70, coin: 4, crystal: 20, trap: 28, weapon: 2, armor: 2, amulet: 10, potion: 10, food: 3, magic: 12, thorns: 3, key: 6 },
            24: { enemy: 72, coin: 3, crystal: 20, trap: 30, weapon: 2, armor: 2, amulet: 11, potion: 10, food: 3, magic: 12, thorns: 3, key: 7 },
            25: { enemy: 74, coin: 3, crystal: 21, trap: 31, weapon: 2, armor: 2, amulet: 12, potion: 10, food: 2, magic: 13, thorns: 3, key: 8 },
            
            // Floors 26-29: End game
            26: { enemy: 75, coin: 2, crystal: 22, trap: 32, weapon: 2, armor: 2, amulet: 12, potion: 10, food: 2, magic: 13, thorns: 3, key: 8 },
            27: { enemy: 78, coin: 2, crystal: 22, trap: 32, weapon: 1, armor: 1, amulet: 12, potion: 10, food: 2, magic: 13, thorns: 3, key: 8 },
            28: { enemy: 80, coin: 2, crystal: 25, trap: 35, weapon: 1, armor: 1, amulet: 13, potion: 10, food: 1, magic: 14, thorns: 3, key: 8 },
            29: { enemy: 82, coin: 1, crystal: 25, trap: 35, weapon: 1, armor: 1, amulet: 14, potion: 10, food: 1, magic: 14, thorns: 3, key: 10 },
            30: { boss: 100 } // Act 2 boss
        };
        
        // Alternative: Formula-based weights for smoother progression
        this.useFormulaWeights = false; // Set to true to use formulas instead
    }

    getCardWeights(floor) {
        // Use predefined weights if they exist for this floor
        if (this.floorWeights[floor]) {
            return this.balanceCardWeights(this.floorWeights[floor], floor);
        }
        
        // Fallback: Use formula-based weights for any undefined floors
        return this.balanceCardWeights(this.calculateFormulaWeights(floor), floor);
    }

    balanceCardWeights(weights, floor = 1) {
        if (weights.boss) return weights;

        const balanced = { ...weights };
        const weaponMinimum = floor >= 31 ? 12 : floor >= 18 ? 11 : floor >= 11 ? 9 : 7;
        const weaponBoost = floor >= 31 ? 4 : floor >= 18 ? 3 : floor >= 11 ? 1 : 0;
        const postBossMin = postBossWeaponFloor(floor) ? KNOBS.postBossWeaponMin : 0;
        const postBossBoost = postBossWeaponFloor(floor) ? KNOBS.postBossWeaponBoost : 0;
        const inAct2 = actForFloor(floor) === 'act2';
        const act2WeaponScale = inAct2 ? (KNOBS.act2WeaponMult ?? 1) : 1;
        const weaponMinBonus = inAct2
            ? Math.max(0, Math.floor((KNOBS.weaponMinBonus ?? 0) * (KNOBS.act2WeaponMinFactor ?? 0.35)))
            : (KNOBS.weaponMinBonus ?? 0);

        const enemyMultiplier = floor <= 14 ? 0.68 : floor <= 23 ? 0.78 : floor <= 30 ? 0.70 : 0.78;
        balanced.enemy = Math.max(20, Math.floor((balanced.enemy || 0) * enemyMultiplier * (inAct2 ? (KNOBS.act2EnemyWeightMult ?? 1) : 1)));
        balanced.coin = Math.max(1, Math.floor((balanced.coin || 0) * 0.25));
        balanced.trap = Math.max(3, Math.floor((balanced.trap || 0) * 0.75));
        balanced.weapon = Math.max(
            weaponMinimum + weaponMinBonus + postBossMin,
            Math.floor((balanced.weapon || 0) * 0.95 * KNOBS.weaponWeightMult * act2WeaponScale) + weaponBoost + postBossBoost
        );
        balanced.armor = Math.max(
            floor >= 18 ? 12 : 10,
            Math.ceil((balanced.armor || 0) * 1.15 * KNOBS.armorWeightMult)
        );
        // Amulets were flooding the late game (~22% of cards, 4-5 per floor),
        // which trivialized runs once you stacked a dozen+. Cut the weight hard
        // (~2-3% of cards) so floor drops are a rare bonus; amulets should
        // mostly come from curated events instead.
        balanced.amulet = Math.min(floor >= 15 ? 6 : 4, Math.max(1, Math.floor((balanced.amulet || 0) * 0.4)));
        if (areAmuletsDisabled()) balanced.amulet = 0;
        balanced.potion = Math.max(8, Math.floor((balanced.potion || 0) * 1.2));
        balanced.food = Math.max(19, Math.floor((balanced.food || 0) * 1.7));  // Bumped — players were starving for AP (~43% of actions while hungry); tuned for ~30% hunger
        balanced.magic = Math.max(5, Math.floor((balanced.magic || 0) * 1.25));
        balanced.thorns = Math.max(3, balanced.thorns || 0);
        balanced.crystal = Math.max(3, Math.floor((balanced.crystal || 0) * (floor >= 15 ? 0.5 : 0.8))); // Cut hard in late game
        // Socket gems are gated to start in the MIDDLE of act 1 (floor 7) and
        // ramp gently so a full 45-floor clear nets ~12-15 gems total including
        // both shop offers. Previously gems dropped flat from floor 1 (weight 9)
        // and then flooded act 3 (weight 27), which both broke the intended
        // "no gems early" feel and over-supplied the end game (only 3 gems
        // socket per weapon anyway).
        balanced.gem = floor < 12 ? 0
            : floor <= 15 ? 3
            : floor <= 30 ? 9
            : 12;
        balanced.key = Math.max(2, balanced.key || 0);
        balanced.mimic = Math.max(0, balanced.mimic || 0); // keep mimic chance from formula
        balanced.empty = floor <= 15 ? 0 : Math.max(12, balanced.empty || 0); // no empty cards in Act 1 (floors 1-15)
        return balanced;
    }

    calculateFormulaWeights(floor) {
        // Check if it's a boss floor
        const bossFloors = [15, 30, 45];
        if (bossFloors.includes(floor)) {
            return { boss: 100 };
        }
        
        // Formula-based weight calculation for non-boss floors
        const weights = {
            enemy: Math.min(30 + floor * 2, 82),
            coin: Math.max(30 - floor, 2),
            crystal: Math.min(5 + Math.floor(floor * 0.4), 18), // Capped lower — was flooding later floors
            trap: Math.min(5 + floor, 35),
            weapon: Math.max(10 - Math.floor(floor / 4), 1),
            armor: Math.min(6 + Math.floor(floor / 3), 18),     // Grows with floor instead of shrinking
            amulet: Math.min(4 + Math.floor(floor * 0.8), 35),  // Grows faster as floors increase
            potion: 10,
            food: Math.max(12, 18 - Math.floor(floor / 3)),     // Decays slowly, floors at 12 minimum (10 left a third of all actions exhausted)
            magic: Math.min(3 + Math.floor(floor / 2), 15),
            gem: 9,
            key: Math.min(1 + Math.floor(floor / 4), 2),
            mimic: floor >= 3 ? 3 : 0  // rare treasure-trap, only from floor 3+
        };
        
        return weights;
    }

    initializeWeaponUnlocks() {
        this.weaponUnlocks = {
            dagger: {
                common: { floor: 1, damage: 3, sprite: 'dagger_C', special: 'dualWield' },
                uncommon: { floor: 10, damage: 4, sprite: 'dagger_U', special: 'dualWield' },
                rare: { floor: 18, damage: 5, sprite: 'dagger_R', special: 'dualWield' },
                epic: { floor: 26, damage: 6, sprite: 'dagger_E', special: 'dualWield' },
                legendary: { floor: 34, damage: 7, sprite: 'dagger_L', special: 'dualWield' }
            },
            bow: {
                common: { floor: 8, damage: 4, sprite: 'bow_c', special: 'block', range: 'ranged' },
                uncommon: { floor: 18, damage: 5, sprite: 'bow_U', special: 'block', range: 'ranged' },
                rare: { floor: 24, damage: 6, sprite: 'bow_R', special: 'block', range: 'ranged' },
                epic: { floor: 30, damage: 7, sprite: 'bow_E', special: 'block', range: 'ranged' },
                legendary: { floor: 38, damage: 9, sprite: 'bow_L', special: 'block', range: 'ranged' }
            },
            sword: {
                // Act 2 weapon — appears fresh at the act-2 start (floor 16) and merges
                // up through act 2 before the axe takes over in act 3. Deliberately
                // NOT available in act 1: the two starting swords are the whole act-1
                // sword budget, so weapon durability is the act-1 boss's real teeth.
                common: { floor: 16, damage: 6, sprite: 'sword_C', special: null },
                uncommon: { floor: 19, damage: 7, sprite: 'sword_U', special: null },
                rare: { floor: 22, damage: 8, sprite: 'sword_R', special: null },
                epic: { floor: 25, damage: 9, sprite: 'sword_E', special: null },
                legendary: { floor: 28, damage: 10, sprite: 'sword_L', special: null }
            },
            axe: {
                // Act 3 only — the endgame weapon. Spread across floors 31-45 so you
                // find it fresh in act 3 and merge it up over the final act.
                common: { floor: 31, damage: 7, sprite: 'axe_C', special: 'specialAttack' },
                uncommon: { floor: 34, damage: 9, sprite: 'axe_U', special: 'specialAttack' },
                rare: { floor: 37, damage: 11, sprite: 'axe_R', special: 'specialAttack' },
                epic: { floor: 40, damage: 13, sprite: 'axe_E', special: 'specialAttack' },
                legendary: { floor: 43, damage: 16, sprite: 'axe_L', special: 'specialAttack' }
            }
        };
    }

    initializeArmorUnlocks() {
        // REMOVED reflection property from all armor types
        this.armorUnlocks = {
            leather: {
                // Dodge ladder rebalanced — legendary caps at 15% (was 25%);
                // lower tiers scaled down so the gradient stays meaningful.
                common:    { floor: 1,  protection: 1, dodgeChance: 0.05, sprite: 'leather_C' },
                uncommon:  { floor: 10, protection: 2, dodgeChance: 0.08, sprite: 'leather_U' },
                rare:      { floor: 18, protection: 3, dodgeChance: 0.10, sprite: 'leather_R' },
                epic:      { floor: 26, protection: 4, dodgeChance: 0.12, sprite: 'leather_E' },
                legendary: { floor: 34, protection: 5, dodgeChance: 0.15, sprite: 'leather_L' }
            },
            chain: {
                // Act 2 armor — appears fresh at the act-2 start (floor 16) and merges
                // up through act 2 before plate takes over in act 3.
                common:    { floor: 16, protection: 2, sprite: 'chain_C' },
                uncommon:  { floor: 19, protection: 3, sprite: 'chain_U' },
                rare:      { floor: 22, protection: 4, sprite: 'chain_R' },
                epic:      { floor: 25, protection: 5, sprite: 'chain_E' },
                legendary: { floor: 28, protection: 7, sprite: 'chain_L' }
            },
            plate: {
                // Act 3 only — the endgame armor. Spread across floors 31-45 to mirror
                // the axe: found fresh in act 3, then merged up to legendary by the end.
                common:    { floor: 31, protection: 3,  sprite: 'plate_C' },
                uncommon:  { floor: 34, protection: 5,  sprite: 'plate_U' },
                rare:      { floor: 37, protection: 7,  sprite: 'plate_R' },
                epic:      { floor: 40, protection: 9,  sprite: 'plate_E' },
                legendary: { floor: 43, protection: 11, sprite: 'plate_L' }
            }
        };
    }

    initializeEnemyData() {
        this.enemyData = {
            skeleton: {
                name: 'Skeleton',
                sprite: 'skeleton_c',
                role: 'MELEE',
                minFloor: 1,
                tiers: [
                    // Act 1 softened by ~1 dmg (floors 1-14).
                    // Act 2 (floor 15+) and Act 3 (floor 31+) trimmed -1 dmg
                    // and ~10% HP for a gentler curve where the bot stalls.
                    { minFloor: 1,  damage: 6,  health: 9  },
                    { minFloor: 5,  damage: 8,  health: 12 },
                    { minFloor: 10, damage: 8,  health: 12 },
                    { minFloor: 15, damage: 8,  health: 14 },
                    { minFloor: 31, damage: 11, health: 20 }
                ]
            },
            spider: {
                name: 'Spider',
                sprite: 'spider_c',
                role: 'MELEE',
                minFloor: 3,
                tiers: [
                    // Act 2/3 trimmed -1 dmg and ~10% HP to ease the curve.
                    { minFloor: 3,  damage: 5,  health: 8  },
                    { minFloor: 8,  damage: 6,  health: 10 },
                    { minFloor: 13, damage: 5,  health: 9  },
                    { minFloor: 16, damage: 6,  health: 9  },
                    { minFloor: 18, damage: 7,  health: 13 },
                    { minFloor: 31, damage: 10, health: 18 }
                ],
                abilities: [{ type: 'poison', damage: 2, turns: 3, stackable: true }]
            },
            goblin: {
                name: 'Goblin',
                sprite: 'goblin_c',
                role: 'MELEE',
                minFloor: 4,
                tiers: [
                    // Act 2/3 trimmed -1 dmg and ~10% HP.
                    { minFloor: 4,  damage: 6,  health: 10 },
                    { minFloor: 11, damage: 8,  health: 12 },
                    { minFloor: 16, damage: 9,  health: 14 },
                    { minFloor: 20, damage: 9,  health: 14 },
                    { minFloor: 31, damage: 11, health: 20 }
                ],
                abilities: [{ type: 'coin_steal', chance: 0.5, amount: 1 }]
            },
            goblin_archer: {
                name: 'Goblin Archer',
                sprite: 'goblin_archer',
                role: 'RANGED',
                minFloor: 2,
                tiers: [
                    // Act 2/3 trimmed -1 dmg and ~15% HP.
                    { minFloor: 2,  damage: 3,  health: 5  },
                    { minFloor: 7,  damage: 4,  health: 8  },
                    { minFloor: 12, damage: 4,  health: 7  },
                    { minFloor: 16, damage: 5,  health: 7  },
                    { minFloor: 22, damage: 7,  health: 10 },
                    { minFloor: 31, damage: 8,  health: 13 }
                ],
                abilities: []
            },
            skeleton_archer: {
                name: 'Skeleton Archer',
                sprite: 'skeleton_archer',
                role: 'RANGED',
                minFloor: 6,
                tiers: [
                    // Act 2/3 trimmed -1 dmg and ~15% HP.
                    { minFloor: 6,  damage: 3,  health: 6  },
                    { minFloor: 11, damage: 4,  health: 8  },
                    { minFloor: 16, damage: 5,  health: 8  },
                    { minFloor: 17, damage: 5,  health: 8  },
                    { minFloor: 25, damage: 7,  health: 10 },
                    { minFloor: 31, damage: 8,  health: 13 }
                ],
                abilities: []
            },
            lostSoul: {
                // A shrouded, floating figure — the Soul Eater's lesser dead.
                // Its whole gimmick is the 'evade' ability: attacks (from the
                // player OR a companion) have a chance to phase right through it,
                // so it's kept deliberately low-HP to balance the dodging.
                // First appears in act 2 (the Soul Eater's act).
                name: 'Lost Soul',
                sprite: 'lostSoul',
                role: 'MELEE',
                minFloor: 16,
                tiers: [
                    { minFloor: 16, damage: 6, health: 8  },
                    { minFloor: 24, damage: 7, health: 10 },
                    { minFloor: 31, damage: 9, health: 13 }
                ],
                abilities: [{ type: 'evade', chance: 0.3 }]
            },
            cerberusHead: {
                // A disembodied Cerberus head, conjured mid-fight by Cerberus and
                // its ancient form — floats in and bites. Summoned minions get the
                // standard summon nerf (weaker than the tier below), so these are
                // light board pressure that splits the player's focus rather than
                // a heavy threat. Boss-summon EXCLUSIVE — unlike Lost Soul, this
                // never appears as a regular floor enemy; createEnemyCard's random
                // pool explicitly excludes it (see SUMMON_ONLY_ENEMY_TYPES below).
                // Only reachable via createTieredEnemy('cerberusHead', ...), which
                // the boss's 'summon' ability calls directly.
                name: 'Cerberus Head',
                sprite: 'cerberusHead',
                role: 'MELEE',
                minFloor: 16,
                tiers: [
                    { minFloor: 16, damage: 7, health: 9  },
                    { minFloor: 31, damage: 9, health: 12 }
                ]
            }
        };
    }

    initializeBossData() {
        // Bosses trimmed -1 to -3 attack and ~10% HP across the board so the
        // act gates feel hard but beatable. Cerberus took the biggest dmg cut
        // (20→17) because its 20-attack spike was the single deadliest moment
        // in the sim, far above the Lich at floor 25.
        // Bosses are keyed by id and grouped into three tiers. Each act rolls ONE
        // boss at random from its tier pool (tier 1 -> act 1 @ floor 15, tier 2 ->
        // act 2 @ floor 30, tier 3 -> act 3 @ floor 45), so every run's finales vary.
        // Stats are normalized within a tier so difficulty stays consistent no matter
        // which boss is rolled. Poison is intentionally exclusive to the Spider Queen.
        this.bossData = {
            // ---- Tier 1 (Act 1 finale, floor 15) ----
            giantSkeleton: {
                type: 'boss', tier: 1,
                name: 'Giant Skeleton',
                health: 44,
                attack: 6,
                armor: 2,
                sprite: 'giantSkeleton',
                abilities: [
                    { type: 'summon', enemyType: 'skeleton', chance: 0.35, count: 1 }
                ]
            },
            goblinKing: {
                type: 'boss', tier: 1,
                name: 'Goblin King',
                health: 62,
                attack: 11,
                sprite: 'GoblinKingSprite',
                abilities: [
                    { type: 'coin_steal', chance: 0.5, amount: 3 },
                    { type: 'summon', enemyType: 'goblin', chance: 0.35, count: 1 }
                ]
            },
            spiderQueen: {
                type: 'boss', tier: 1,
                name: 'Spider Queen',
                health: 64,
                attack: 12,
                sprite: 'SpiderQween',
                abilities: [
                    { type: 'poison', damage: 3, turns: 3, stackable: true, maxStacks: 3 },
                    { type: 'summon', enemyType: 'spider', chance: 0.35, count: 1 }
                ]
            },

            // ---- Tier 2 (Act 2 finale, floor 30) ----
            soulEater: {
                type: 'boss', tier: 2,
                name: 'Soul Eater',
                health: 100,
                attack: 15,
                sprite: 'SoulEater',
                // A slippery bruiser, NOT a healer (that's the Lich's profile).
                // Like the Lost Souls it commands, attacks have a 15% chance to
                // phase right through it — so it out-lasts you by dodging, not
                // by leeching. Rounds out with armor-break + a late rage spike.
                abilities: [
                    { type: 'evade', chance: 0.12 },
                    { type: 'summon', enemyType: 'lostSoul', chance: 0.15, count: 1 },
                    { type: 'armor_break', amount: 2 },
                    { type: 'rage', threshold: 0.35, damageBoost: 1.5 }
                ]
            },
            lich: {
                type: 'boss', tier: 2,
                name: 'Lich',
                health: 102,
                attack: 15,
                sprite: 'Lich',
                abilities: [
                    { type: 'lifesteal', percentage: 0.55 },
                    { type: 'summon', enemyType: 'skeleton', chance: 0.22, count: 1 }
                ]
            },
            cerberus: {
                type: 'boss', tier: 2,
                name: 'Cerberus',
                // Pulled toward the tier average (was 128 HP / rage x2 — an
                // 80%-more-HP luck swing vs rolling the Lich, and its raged
                // ~34-damage hits were the deadliest spike in the sim).
                health: 105,
                attack: 15,
                sprite: 'Cerberus',
                abilities: [
                    { type: 'rage', threshold: 0.4, damageBoost: 1.5 },
                    { type: 'armor_break', amount: 4 },
                    { type: 'summon', enemyType: 'cerberusHead', chance: 0.18, count: 1 }
                ]
            },

            // ---- Tier 3 (Act 3 finale, floor 45) ----
            ancientCerberus: {
                type: 'boss', tier: 3,
                name: 'Ancient Cerberus',
                health: 136,
                attack: 22,
                sprite: 'AncientCerberus',
                abilities: [
                    { type: 'rage', threshold: 0.3, damageBoost: 2 },
                    { type: 'armor_break', amount: 6 },
                    { type: 'summon', enemyType: 'cerberusHead', chance: 0.3, count: 1 }
                ]
            }
        };

        // Which bosses can appear as each act's finale.
        this.bossTiers = {
            1: ['giantSkeleton', 'goblinKing', 'spiderQueen'],
            2: ['soulEater', 'lich', 'cerberus'],
            3: ['ancientCerberus']
        };
    }

    initializeTrapData() {
        this.trapTypes = [
            {
                weight: 40,
                subType: 'spike',
                name: 'Spike Trap',
                sprite: 'trap',
                createData: (floor) => ({
                    damage: 3 + Math.floor(floor * 0.6)
                })
            },
            {
                weight: 30,
                subType: 'poison',
                name: 'Poison Trap',
                sprite: 'trap2',
                createData: (floor) => ({
                    // Immediate hit (lower than a spike trap, since it also
                    // poisons over the next few turns) plus the lingering poison.
                    damage: 2 + Math.floor(floor * 0.4),
                    abilities: [{ type: 'poison', damage: 1 + Math.floor(floor / 3), turns: 3 }]
                })
            },
            {
                weight: 30,
                subType: 'reveal',
                name: 'Pressure Plate',
                sprite: 'trapTriggers',
                // A light nick on top of its reveal effect — kept below the spike
                // (3 + 0.6·floor) and poison (2 + 0.4·floor) so it stays the
                // gentlest trap while still showing a number on the card.
                createData: (floor) => ({
                    damage: 1 + Math.floor(floor * 0.3)
                })
            }
            // Add more trap types here
        ];
    }

    initializeAmuletData() {
        const dropData = [
            // Regular amulets
            { id: 'regeneration',     minFloor: 1,  weight: 10, rarity: 'uncommon' },
            { id: 'healingRing',      minFloor: 2,  weight: 10, rarity: 'uncommon' },
            { id: 'invulnerability',  minFloor: 15, weight: 2,  rarity: 'legendary' },
            { id: 'evasionBoots',     minFloor: 3,  weight: 8,  rarity: 'uncommon' },
            { id: 'dragonClaw',       minFloor: 8,  weight: 5,  rarity: 'rare' },
            { id: 'greedPouch',       minFloor: 1,  weight: 10, rarity: 'uncommon' },
            { id: 'golemHeart',       minFloor: 2,  weight: 8,  rarity: 'uncommon' },
            { id: 'chronosHeart',     minFloor: 5,  weight: 5,  rarity: 'rare' },
            { id: 'speedBoots',       minFloor: 4,  weight: 6,  rarity: 'rare' },
            { id: 'abyssHourglass',   minFloor: 3,  weight: 8,  rarity: 'uncommon' },
            { id: 'temperedSteel',    minFloor: 6,  weight: 6,  rarity: 'rare' },
            { id: 'bottomlessBag',    minFloor: 1,  weight: 7,  rarity: 'common' },
            { id: 'travelKitchen',    minFloor: 2,  weight: 8,  rarity: 'uncommon' },
            { id: 'vampiricRing',     minFloor: 4,  weight: 7,  rarity: 'uncommon' },
            { id: 'soulHarvester',    minFloor: 10, weight: 4,  rarity: 'rare' },

            // Carrion Oath (hungryDagger) — reworked into a beneficial poison-cleanse
            // amulet, so it now sits with the regular rares instead of the cursed pool.
            { id: 'hungryDagger',     minFloor: 10, weight: 4,  rarity: 'rare' },

            // Cursed amulets
            { id: 'bloodyHarvest',    minFloor: 10, weight: 4,  rarity: 'cursed' },
            { id: 'eternalRage',      minFloor: 8,  weight: 4,  rarity: 'cursed' },
            { id: 'berserkerBelt',    minFloor: 14, weight: 3,  rarity: 'cursed' },

            // Exploration and utility amulets
            { id: 'diviners_spade',   minFloor: 2,  weight: 7,  rarity: 'uncommon' },
            { id: 'wayfinder',        minFloor: 4,  weight: 5,  rarity: 'rare' },
            { id: 'skeletonKey',      minFloor: 3,  weight: 5,  rarity: 'rare' },
            { id: 'greasewingFeast',  minFloor: 5,  weight: 6,  rarity: 'uncommon' },
            { id: 'sunstone',         minFloor: 6,  weight: 5,  rarity: 'rare' },
            { id: 'merchantPact',     minFloor: 3,  weight: 5,  rarity: 'rare' },
            { id: 'watchersLamp',     minFloor: 4,  weight: 5,  rarity: 'rare' },
            { id: 'reapersMask',      minFloor: 5,  weight: 5,  rarity: 'rare' },
            { id: 'travelersJournal', minFloor: 6,  weight: 4,  rarity: 'rare' },
            { id: 'charmingTune',     minFloor: 3,  weight: 6,  rarity: 'uncommon' },
            { id: 'wayfarersMap',     minFloor: 4,  weight: 5,  rarity: 'rare' },
            { id: 'sirensPendant',    minFloor: 6,  weight: 4,  rarity: 'rare' },

            { id: 'goldenSeed',       minFloor: 2,  weight: 7,  rarity: 'uncommon' },
            { id: 'fireRuneStone',    minFloor: 10, weight: 5,  rarity: 'uncommon' },
            { id: 'prospectorsPick',  minFloor: 3,  weight: 7,  rarity: 'uncommon' }
        ];

        this.amuletTypes = dropData.map(amulet => ({
            ...amulet,
            ...getAmuletAtlasPresentation(amulet.id)
        }));
    }

    initializePotionData() {
        // Healing Potions with exact specifications
        this.potionTiers = [
            {
                tier: 1,
                name: 'Minor Healing Potion',
                healAmount: 35,
                cost: 5,
                minFloor: 1,
                sprite: 'potionCardCommon',
                rarity: 'common'
            },
            {
                tier: 2,
                name: 'Healing Potion',
                healAmount: 70,
                cost: 7,
                minFloor: 5,
                sprite: 'potionCardCommon',
                rarity: 'common'
            },
            {
                tier: 3,
                name: 'Strong Healing Potion',
                healAmount: 110,
                cost: 10,
                minFloor: 10,
                sprite: 'potionCardUncommon',
                rarity: 'uncommon'
            },
            {
                tier: 4,
                name: 'Greater Healing Potion',
                healAmount: 200,
                cost: 18,
                minFloor: 15,
                sprite: 'potionCardUncommon',
                rarity: 'uncommon'
            }
        ];
    }

    initializeFoodData() {
        // Food with exact specifications (Energy = Actions)
        this.foodTiers = [
            {
                tier: 1,
                name: 'Bread',
                actionAmount: 25,
                cost: 2,
                minFloor: 1,
                sprite: 'bread',
                rarity: 'common'
            },
            {
                tier: 2,
                name: 'Rations',
                actionAmount: 30,
                cost: 4,
                minFloor: 3,
                sprite: 'bread',
                rarity: 'common'
            },
            {
                tier: 3,
                name: 'Hearty Meal',
                actionAmount: 35,
                cost: 7,
                minFloor: 6,
                sprite: 'bread',
                rarity: 'uncommon'
            },
            {
                tier: 4,
                name: 'Feast',
                actionAmount: 40,
                cost: 13,
                minFloor: 8,
                sprite: 'bread',
                rarity: 'rare'
            }
        ];
    }
    
    initializeMagicCards() {
        this.magicCards = [
            {
                magicType: 'fireball',
                name: 'Fireball',
                description: 'Deals 15 damage to a single enemy',
                damage: 15,
                minFloor: 1,
                rarity: 'uncommon',
                sprite: 'fireBall',
                cost: 8
            },
            {
                magicType: 'frostRing',
                name: 'Frost Ring',
                description: 'Freezes all enemies for 3 turns',
                minFloor: 3,
                rarity: 'rare',
                sprite: 'frozenRing',
                cost: 12
            },
            {
                magicType: 'restoration',
                name: 'Restoration',
                description: 'Fully restores HP and Action Points',
                minFloor: 2,
                rarity: 'uncommon',
                sprite: 'recovery',
                cost: 10
            },
            {
                magicType: 'soulDrain',
                name: 'Soul Drain',
                description: 'Instantly kills a non-boss enemy and heals 30 HP',
                minFloor: 8,
                rarity: 'legendary',
                sprite: 'soulSucking',
                cost: 25
            },
            {
                magicType: 'shadowBlade',
                name: 'Shadow Blade',
                description: 'Increases attack damage by 50% for 10 turns',
                minFloor: 5,
                rarity: 'rare',
                sprite: 'shadowDagger',
                cost: 15
            },
            {
                magicType: 'weakness',
                name: 'Weakness',
                description: 'Reduces all enemies damage by 30%',
                minFloor: 4,
                rarity: 'uncommon',
                sprite: 'weakening',
                cost: 10
            },
            {
                magicType: 'boneWall',
                name: 'Bone Wall',
                description: 'Reflects the next 2 enemy attacks',
                minFloor: 6,
                rarity: 'rare',
                sprite: 'boneWall',
                cost: 14
            },
            {
                magicType: 'magicShield',
                name: 'Magic Shield',
                description: 'Increases armor by 20% for 10 turns',
                minFloor: 3,
                rarity: 'uncommon',
                sprite: 'macigShield',
                cost: 8
            },
            {
                magicType: 'mirrorShield',
                name: 'Mirror Shield',
                description: 'Reflects the next enemy attack',
                minFloor: 2,
                rarity: 'common',
                sprite: 'mirrorShield',
                cost: 6
            },
            {
                magicType: 'smokeScreen',
                name: 'Smoke Screen',
                description: 'Flips all face-up enemy cards back down',
                minFloor: 7,
                rarity: 'rare',
                sprite: 'smokeBomb',
                cost: 16
            }
        ];
    }
    
    createCardData(type, floor, isElite = false, gameState = null, targetRarity = null, preferredRole = null) {
        switch (type) {
            case 'boss':
                return this.createBossCard(floor);
            case 'enemy':
                return this.createEnemyCard(floor, isElite, preferredRole);
            case 'mimic':
                return this.createMimicCard(floor);
            case 'coin':
                return this.createCoinCard(floor);
            case 'crystal':
                return this.createCrystalCard(floor);
            case 'trap':
                return this.createTrapCard(floor);
            case 'weapon':
                return this.createWeaponCard(floor, targetRarity);
            case 'armor':
                return this.createArmorCard(floor, targetRarity);
            case 'amulet':
                if (areAmuletsDisabled()) return null;
                return this.createAmuletCard(floor, gameState);
            case 'potion':
                return this.createPotionCard(floor);
            case 'food':
                return this.createFoodCard(floor);
            case 'magic':
                return this.createMagicCard(floor);
            case 'thorns':
                return this.createThornsCard(floor, targetRarity);
            case 'gem':
                return this.createGemCard(floor);
            case 'key':
                return this.createKeyCard(floor);
            case 'empty':
                return this.createEmptyCard(floor);
            default:
                return null;
        }
    }

    // An "empty" card — reveals to nothing. Adds reveal risk and thins out
    // reward density (you can waste an action flipping a blank).
    createEmptyCard() {
        return { type: 'empty', name: 'Nothing', sprite: null };
    }

    createBossCard(floor) {
        // The act determines the tier; roll one boss at random from that tier's pool.
        const act = Math.max(1, Math.min(3, Math.floor((floor - 1) / 15) + 1));
        const pool = this.bossTiers[act] || this.bossTiers[1];
        const id = pool[Math.floor(Math.random() * pool.length)];
        // Deep-copy so per-fight mutations (health dropping, rage flag) never corrupt
        // the shared template for the next spawn/run.
        const boss = JSON.parse(JSON.stringify(this.bossData[id]));
        const bossHpMult = act === 2 ? KNOBS.bossHp * (KNOBS.bossHpAct2Mult ?? 1)
            : act === 3 ? KNOBS.bossHp * (KNOBS.bossHpAct3Mult ?? 1)
            : KNOBS.bossHp;
        boss.health = Math.ceil(boss.health * bossHpMult);
        boss.attack = Math.ceil(boss.attack * KNOBS.bossAtk);
        return boss;
    }

    // Enemy types that only ever appear via a boss's 'summon' ability
    // (createTieredEnemy called directly with the type) and must never be
    // picked for a regular floor's random enemy roll.
    static SUMMON_ONLY_ENEMY_TYPES = new Set(['cerberusHead']);

    createEnemyCard(floor, isElite = false, preferredRole = null) {
        // Fallback in case no enemies are available
        let availableEnemies = Object.keys(this.enemyData).filter(key =>
            floor >= this.enemyData[key].minFloor
            && !CardDataGenerator.SUMMON_ONLY_ENEMY_TYPES.has(key)
        );
        if (availableEnemies.length === 0) {
            return this.createFallbackEnemy(floor);
        }
        // Position-based typing: front rows draw only MELEE-type enemies, back rows
        // only RANGED (archers), so the sprite always matches where it sits. Fall
        // back to the full pool if no enemy of the requested role is unlocked yet.
        if (preferredRole) {
            const byRole = availableEnemies.filter(key => (this.enemyData[key].role || 'MELEE') === preferredRole);
            if (byRole.length > 0) availableEnemies = byRole;
        }
        const enemyType = availableEnemies[Math.floor(Math.random() * availableEnemies.length)];
        return this.createTieredEnemy(enemyType, floor, isElite);
    }

    createTieredEnemy(enemyType, floor, isElite = false) {
        const enemy = this.enemyData[enemyType];
        if (!enemy) return this.createFallbackEnemy(floor);

        // Find appropriate tier
        let selectedTier = enemy.tiers[0];
        for (let i = enemy.tiers.length - 1; i >= 0; i--) {
            if (floor >= enemy.tiers[i].minFloor) {
                selectedTier = enemy.tiers[i];
                break;
            }
        }

        // Global difficulty scaling — the game was too soft (fresh, relic-less
        // runs could win, violating the "die ≥3 times to earn relics" design).
        // Enemies hit harder and are a bit tankier.
        const global = globalCombatMult(floor);
        const hpMult = global.hp * enemyHpScale(floor);
        const atkMult = global.atk * enemyAtkScale(floor);
        const enemyCard = {
            type: 'enemy',
            name: enemy.name,
            health: Math.ceil(selectedTier.health * hpMult),
            attack: Math.ceil(selectedTier.damage * atkMult),
            sprite: enemy.sprite,
            role: enemy.role || 'MELEE', // Default to MELEE if role is missing
            // Intrinsic ranged flag from the enemy TYPE (archers). The board later
            // overrides `role` by row position, but this flag is preserved so
            // thorns/melee-only effects can tell a real archer from a front-row melee.
            isRangedType: enemy.role === 'RANGED'
        };

        if (enemy.abilities) {
            enemyCard.abilities = [...enemy.abilities];
        }
        return enemyCard;
    }

    createFallbackEnemy(floor) {
        return {
            type: 'enemy',
            name: 'Unknown Enemy',
            health: 5 + floor,
            attack: 2 + Math.floor(floor / 2),
            sprite: 'goblin_c',
            role: 'MELEE'
        };
    }

    createAngryNestmotherCard(floor) {
        // She's a ranged ARCHER (attacks from the back row, so thorns can't
        // reflect her) but noticeably sturdier and harder-hitting than a normal
        // enemy. Base her off the baseline MELEE enemy (skeleton) at THIS floor,
        // then bump. Using a fixed reference type — instead of the old random
        // createEnemyCard roll — makes her stats scale smoothly with depth
        // instead of swinging with whichever enemy type happened to be rolled.
        const baseEnemy = this.createTieredEnemy('skeleton', floor);
        return {
            ...baseEnemy,
            type: 'enemy',
            name: 'Angry Nestmother',
            health: Math.max(1, Math.ceil((baseEnemy.health || 1) * 1.2)),
            attack: Math.max(1, (baseEnemy.attack || 1) + 2),
            sprite: 'angryNestmother',
            role: 'RANGED',
            isRangedType: true,
            storyEnemy: 'angry_nestmother'
        };
    }

    // Mimic — a treasure that bites back. Normal HP, small attack. The player
    // must kill it within 3 turns of revealing it; otherwise it escapes.
    // On a successful kill it bursts into coins and crystals.
    createMimicCard(floor) {
        return {
            type: 'enemy',
            name: 'Mimic',
            health: 8 + Math.floor(floor / 2),
            attack: 2,
            sprite: 'mimic',
            role: 'MELEE',
            isMimic: true,
            escapeTurns: 3
        };
    }
    // This method is no longer needed as role assignment is handled in cardSystem.js
    /*
    createEnemyWithPreferredRole(floor, isElite = false, preferredRole = null) {
        // ... implementation ...
    }
    */

    createCoinCard(floor) {
        return {
            type: 'coin',
            // Coin cards remain meaningful as store prices rise.
            amount: 3 + Math.floor(floor / 8) + Math.floor(Math.random() * 4),
            name: 'Coins',
            sprite: 'coin'
        };
    }

    createCrystalCard(floor) {
        return {
            type: 'crystal',
            amount: 1, // flat 1 (was 1-2) — crystals were piling up unspent
            name: 'Crystal',
            sprite: 'crystalCard'
        };
    }

    createTrapCard(floor) {
        const totalWeight = this.trapTypes.reduce((sum, trap) => sum + trap.weight, 0);
        let random = Math.random() * totalWeight;

        for (let trapType of this.trapTypes) {
            random -= trapType.weight;
            if (random <= 0) {
                return {
                    type: 'trap',
                    subType: trapType.subType,
                    name: trapType.name,
                    sprite: trapType.sprite,
                    ...trapType.createData(floor)
                };
            }
        }
    }

    // Reward-rarity cap: shops/chests/boss rooms used to hand out epics and
    // legendaries far too early — by mid-act-2 you already had a legendary
    // axe from a chest. The cap shifts each rarity DOWN one tier in earlier
    // acts so the reward chain is:
    //   Act 1 (floors 1-15):  max UNCOMMON (legendary → epic → rare → uncommon)
    //   Act 2 (floors 16-30): max RARE     (legendary → epic → rare)
    //   Act 3 (floors 31+):   max LEGENDARY (no cap)
    // Result: act-1 boss room gives uncommon (was rare), act-2 boss room
    // gives rare (was epic), act-3 boss room still gives legendary.
    capRewardRarity(rarity, floor) {
        const order = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        const idx = order.indexOf(rarity);
        if (idx < 0) return rarity;
        let maxIdx = 4; // legendary by default
        if (floor <= 15)      maxIdx = 1; // act 1: uncommon
        else if (floor <= 30) maxIdx = 2; // act 2: rare
        return order[Math.min(idx, maxIdx)];
    }

    // Floor-weighted rarity roll for ad-hoc loot drops (when no explicit
    // targetRarity is requested). Returns one of common/uncommon/rare/epic.
    // Tuned so that:
    //   - Act 1 (1-15) is mostly commons with a sprinkle of uncommons.
    //   - Act 2 (16-30) drops uncommons regularly and starts seeing rares —
    //     the player has epic gear at this point and needs merge fodder.
    //   - Act 3 (31-45) drops rares and the occasional epic so endgame loot
    //     keeps pace with the player's merged gear.
    pickFloorRarity(floor) {
        // [common, uncommon, rare, epic] weights — caller will downgrade if
        // the picked rarity has no unlocked tier yet at this floor.
        let weights;
        // Epics pushed to floor 26+ so battlefield drops don't let players
        // merge to legendary in mid-act-2. Replaces the old floor-35 legendary
        // merge gate with a softer rarity-pipeline approach: rares are still
        // common in act 2 (great merge fodder), but epics arrive in late act 2
        // / act 3 where they make sense.
        if (floor <= 10)       weights = [100, 0,  0,  0];
        else if (floor <= 17)  weights = [90,  10, 0,  0];
        else if (floor <= 22)  weights = [65,  30, 5,  0];
        else if (floor <= 27)  weights = [45,  40, 15, 0];
        else if (floor <= 30)  weights = [30,  45, 23, 2];
        // Act 3 (rebalance): playtest showed the old weights flooded act 3
        // with epics & rares. The new curve keeps uncommons + rares dominant
        // through act 3, with epics as a slow-arriving treat — boss room is
        // still where you reliably see a legendary.
        else if (floor <= 35)  weights = [25, 50, 22, 3];   // early act 3 — uncommons still dominant
        else if (floor <= 40)  weights = [15, 45, 33, 7];   // mid act 3   — balanced uncommon/rare
        else                   weights = [5,  35, 45, 15];  // late act 3  — rares lead, epics scarce
        const total = weights.reduce((s, w) => s + w, 0);
        let pick = Math.random() * total;
        const tiers = ['common', 'uncommon', 'rare', 'epic'];
        for (let i = 0; i < tiers.length; i++) {
            pick -= weights[i];
            if (pick <= 0) return tiers[i];
        }
        return 'common';
    }

    createWeaponCard(floor, targetRarity = null) {
        const rarityOrder = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
        // Determine which rarity tier to use, falling back to the best available
        const resolveRarity = (rarities) => {
            // No explicit rarity request → pick one weighted by floor so act 2/3
            // see uncommons/rares regularly instead of nothing but commons.
            const requested = targetRarity || this.pickFloorRarity(floor);
            const candidates = [requested, ...rarityOrder.slice(rarityOrder.indexOf(requested) + 1)];
            for (const r of candidates) {
                if (rarities[r] && floor >= rarities[r].floor) return r;
            }
            return 'common';
        };

        const availableWeapons = [];

        Object.entries(this.weaponUnlocks).forEach(([weaponType, rarities]) => {
            const rarity = resolveRarity(rarities);
            const data = rarities[rarity];
            if (data && floor >= data.floor) {
                // Weapons fade out as the player out-levels them.
                // Each floor past their unlock costs 0.07 weight; common-tier fades a bit faster.
                const floorsPast = floor - data.floor;
                const decay = rarity === 'common' ? 0.09 : 0.06;
                const weight = Math.max(0.08, 1 - floorsPast * decay);
                availableWeapons.push({
                    type: weaponType,
                    rarity,
                    weight,
                    ...data
                });
            }
        });

        if (availableWeapons.length === 0) {
            return {
                type: 'weapon',
                name: 'Makeshift Weapon',
                weaponType: 'dagger',
                damage: 2,
                rarity: 'common',
                sprite: 'dagger_C',
                special: null,
                range: 'melee',
                durability: 3,
                maxDurability: 3
            };
        }

        // Weighted random pick
        const totalWeight = availableWeapons.reduce((sum, w) => sum + w.weight, 0);
        let pick = Math.random() * totalWeight;
        let selected = availableWeapons[availableWeapons.length - 1];
        for (const candidate of availableWeapons) {
            pick -= candidate.weight;
            if (pick <= 0) {
                selected = candidate;
                break;
            }
        }
        const rarityName = selected.rarity.charAt(0).toUpperCase() + selected.rarity.slice(1);
        const weaponName = selected.type.charAt(0).toUpperCase() + selected.type.slice(1);

        const durabilityMap = {
            dagger: { common: 4, uncommon: 5, rare: 6, epic: 7, legendary: 8 },
            bow: { common: 5, uncommon: 6, rare: 7, epic: 8, legendary: 9 },
            sword: { common: 6, uncommon: 8, rare: 10, epic: 11, legendary: 13 },
            axe: { common: 6, uncommon: 8, rare: 10, epic: 12, legendary: 14 }
        };

        const baseDurability = durabilityMap[selected.type][selected.rarity] || 5;

        return {
            type: 'weapon',
            name: `${rarityName} ${weaponName}`,
            weaponType: selected.type,
            damage: selected.damage,
            rarity: selected.rarity,
            sprite: selected.sprite,
            special: selected.special,
            range: selected.range || 'melee',
            poisonDamage: selected.poisonDamage || 0,
            poisonTurns: selected.poisonTurns || 0,
            poisonStackable: selected.poisonStackable || false,
            durability: baseDurability,
            maxDurability: baseDurability
        };
    }

    createArmorCard(floor, targetRarity = null) {
        const rarityOrder = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
        const resolveRarity = (rarities) => {
            // Same floor-weighted rarity as weapons — see pickFloorRarity().
            const requested = targetRarity || this.pickFloorRarity(floor);
            const candidates = [requested, ...rarityOrder.slice(rarityOrder.indexOf(requested) + 1)];
            for (const r of candidates) {
                if (rarities[r] && floor >= rarities[r].floor) return r;
            }
            return 'common';
        };

        const availableArmors = [];

        Object.entries(this.armorUnlocks).forEach(([armorType, rarities]) => {
            const rarity = resolveRarity(rarities);
            const data = rarities[rarity];
            if (data && floor >= data.floor) {
                availableArmors.push({
                    type: armorType,
                    rarity,
                    ...data
                });
            }
        });

        if (availableArmors.length === 0) {
            return {
                type: 'armor',
                name: 'Makeshift Armor',
                armorType: 'leather',
                protection: 1,
                rarity: 'common',
                sprite: 'leather_C',
                durability: 10,
                maxDurability: 10
            };
        }

        const selected = availableArmors[Math.floor(Math.random() * availableArmors.length)];
        const rarityName = selected.rarity.charAt(0).toUpperCase() + selected.rarity.slice(1);
        const armorName = selected.type.charAt(0).toUpperCase() + selected.type.slice(1);

        const durabilityBonus = {
            uncommon: 5,
            rare: 10,
            epic: 13,
            legendary: 15
        };

        const baseDurability = 15 + (durabilityBonus[selected.rarity] || 0);
        // REMOVED reflection property from armor creation
        return {
            type: 'armor',
            name: `${rarityName} ${armorName} Armor`,
            armorType: selected.type,
            protection: selected.protection + KNOBS.armorProtectionBonus,
            dodgeChance: selected.dodgeChance,
            rarity: selected.rarity,
            sprite: selected.sprite,
            durability: baseDurability, // Use calculated value
            maxDurability: baseDurability // Use calculated value
        };
    }

    createAmuletCard(floor, gameState = null) {
        // Build list of amulet IDs the player already owns (from active amulets)
        const ownedIds = new Set(
            (gameState?.activeAmulets || []).map(a => a.id).filter(Boolean)
        );

        // Hide already-owned non-stackable amulets from drops/shops/chests so
        // the player never sees a useless duplicate. The only currently-
        // stackable amulet is 'regeneration' (multiple stacks → more healing);
        // everything else does nothing the second time you "equip" it.
        const stackableIds = new Set(['regeneration']);
        const availableAmulets = this.amuletTypes.filter(amulet =>
            floor >= amulet.minFloor &&
            !(ownedIds.has(amulet.id) && !stackableIds.has(amulet.id))
        );
        
        if (availableAmulets.length === 0) {
            // Player has every unique amulet already — fall back to the
            // stackable Regeneration amulet so the slot still gives something
            // useful (each extra stack = +1 HP regen per floor end).
            const regen = this.amuletTypes.find(a => a.id === 'regeneration')
                || this.amuletTypes[0];
            return {
                type: 'amulet',
                id: regen.id,
                name: regen.name,
                rarity: regen.rarity,
                sprite: regen.sprite,
                spriteFrame: regen.spriteFrame
            };
        }
        
        // Weighted random selection
        const totalWeight = availableAmulets.reduce((sum, a) => sum + a.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (let amulet of availableAmulets) {
            random -= amulet.weight;
            if (random <= 0) {
                return {
                    type: 'amulet',
                    id: amulet.id,
                    name: amulet.name,
                    rarity: amulet.rarity,
                    sprite: amulet.sprite,
                    spriteFrame: amulet.spriteFrame
                };
            }
        }
        
        // Fallback
        const chosen = availableAmulets[0];
        return {
            type: 'amulet',
            id: chosen.id,
            name: chosen.name,
            rarity: chosen.rarity,
            sprite: chosen.sprite,
            spriteFrame: chosen.spriteFrame
        };
    }

    createPotionCard(floor) {
        // Generated potions stay at base tier. Merging is what creates stronger versions.
        const selectedPotion = this.potionTiers[0];
        
        if (!selectedPotion) {
            // Fallback - should not happen if configured correctly
            return {
                type: 'potion',
                name: 'Minor Healing Potion',
                healAmount: 35,
                sprite: 'potionCardCommon',
                rarity: 'common',
                cost: 5
            };
        }
        return {
            type: 'potion',
            name: selectedPotion.name,
            healAmount: selectedPotion.healAmount,
            sprite: selectedPotion.sprite,
            rarity: selectedPotion.rarity,
            cost: selectedPotion.cost
        };
    }
    
    // Next canonical potion tier up from `baseHealAmount`. Merging two identical
    // potions climbs this ladder (35 -> 70 -> 110 -> 200) so a merged potion is
    // always a real shop-tier potion, never an off-ladder heal value. Tops out
    // at the strongest tier.
    getUpgradedPotion(baseHealAmount) {
        const idx = this.potionTiers.findIndex(p => p.healAmount === baseHealAmount);
        const next = idx === -1
            ? (this.potionTiers.find(p => p.healAmount > baseHealAmount)
                || this.potionTiers[this.potionTiers.length - 1])
            : (this.potionTiers[idx + 1] || this.potionTiers[idx]);
        return {
            type: 'potion',
            name: next.name,
            healAmount: next.healAmount,
            sprite: next.healAmount > this.potionTiers[0].healAmount ? 'potionCardUncommon' : next.sprite,
            rarity: next.rarity,
            cost: next.cost
        };
    }

    createFoodCard(floor) {
        // Generated food stays at base tier. Merging is what creates stronger versions.
        const selectedFood = this.foodTiers[0];
        
        if (!selectedFood) {
            // Fallback - should not happen if configured correctly
            return {
                type: 'food',
                name: 'Bread',
                actionAmount: 25,
                sprite: 'bread',
                rarity: 'common',
                cost: 2
            };
        }
        return {
            type: 'food',
            name: selectedFood.name,
            actionAmount: selectedFood.actionAmount,
            sprite: selectedFood.sprite,
            rarity: selectedFood.rarity,
            cost: selectedFood.cost
        };
    }

    createEggCard() {
        return {
            id: 'monsterEgg',
            type: 'food',
            name: 'Egg',
            actionAmount: 30,
            sprite: 'egg',
            rarity: 'uncommon',
            cost: 6
        };
    }

    createChickCompanionCard() {
        return {
            id: 'chickCompanion',
            type: 'companion',
            name: 'Chick Companion',
            // Tuned down from 3 → 2: at 3 it was too strong even into act 3.
            attack: 2,
            sprite: 'chickCompanion',
            rarity: 'rare',
            cost: 20,
            unique: true
        };
    }

    createSkeletonWarriorCompanionCard() {
        return {
            id: 'skeletonWarriorCompanion',
            type: 'companion',
            name: 'Skeleton Warrior',
            attack: 3,
            attackStyle: 'melee',
            damageType: 'physical',
            range: 'melee',
            sprite: 'skeletonCompanion',
            rarity: 'rare',
            cost: 20,
            unique: true
        };
    }
    
    createMagicCard(floor) {
        // Get available magic cards for current floor
        const availableCards = this.magicCards.filter(card => floor >= card.minFloor);
        
        if (availableCards.length === 0) {
            return null; // No magic cards available yet
        }
        
        // Randomly select a magic card
        const selectedCard = availableCards[Math.floor(Math.random() * availableCards.length)];
        
        return {
            type: 'magic',
            magicType: selectedCard.magicType,
            name: selectedCard.name,
            description: selectedCard.description,
            rarity: selectedCard.rarity,
            sprite: selectedCard.sprite,
            damage: selectedCard.damage, // For fireball
            cost: selectedCard.cost // For shop pricing
        };
    }

    // Canonical thorns stats per rarity — the single source of truth for both
    // freshly generated thorns and merge results, so a rare is always 3 damage.
    getThornStats(rarity) {
        const tiers = {
            common:    { thornDamage: 1, durability: 6,  cost: 8 },
            uncommon:  { thornDamage: 2, durability: 7,  cost: 12 },
            rare:      { thornDamage: 3, durability: 9,  cost: 18 },
            epic:      { thornDamage: 4, durability: 10, cost: 23 },
            legendary: { thornDamage: 5, durability: 11, cost: 28 }
        };
        return tiers[rarity] || tiers.common;
    }

    createThornsCard(floor, targetRarity = null) {
        const rarity = targetRarity || 'common';
        // Per-rarity art. No legendary asset yet, so legendary borrows the
        // epic sprite (closest tier visually).
        const thornsSpriteByRarity = {
            common:    'thornsCard',
            uncommon:  'thornsCard_U',
            rare:      'thornsCard_R',
            epic:      'thornsCard_E',
            legendary: 'thornsCard_E',
        };
        const thornsSprite = thornsSpriteByRarity[rarity] || 'thornsCard';
        const tier = this.getThornStats(rarity);
        return {
            type: 'thorns',
            name: 'Thorns Card',
            thornDamage: tier.thornDamage,
            rarity,
            sprite: thornsSprite,
            durability: tier.durability,
            maxDurability: tier.durability,
            cost: tier.cost
        };
    }
    
    createKeyCard(floor) {
        return {
            type: 'key',
            name: 'Mysterious Key',
            sprite: 'keyCard',
            rarity: 'rare'
        };
    }

    createGemCard(floor) {
        const gems = [
            { effect: 'fire', name: 'Fire Gem', frame: 0, color: 0xff7040 },
            { effect: 'poison', name: 'Poison Gem', frame: 6, color: 0x66ff66 },
            { effect: 'lightning', name: 'Lightning Gem', frame: 12, color: 0xffe066 }
        ];
        const gem = gems[Math.floor(Math.random() * gems.length)];
        return {
            type: 'gem',
            gemEffect: gem.effect,
            name: gem.name,
            sprite: 'gemsRGY',
            spriteFrame: gem.frame,
            color: gem.color,
            rarity: 'common'
        };
    }
}

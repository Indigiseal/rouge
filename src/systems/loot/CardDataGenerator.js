import { getAmuletAtlasPresentation } from './utils/RelicsOthersAtlas.js';
import { areAmuletsDisabled } from './utils/TestOptions.js';
import { resolveArmorSpawnTypes } from './utils/CharacterClasses.js';
import { applyArmorTalentMods } from './utils/TalentDefinitions.js';

function postBossWeaponFloor(floor) {
  return (floor >= 16 && floor <= 19) || (floor >= 31 && floor <= 34);
}

export class CardDataGenerator {
    // Gem socket capacity by weapon rarity. Overflow on merge / mixed gems:
    // see docs/OPEN-QUESTIONS.md.
    static GEM_SLOTS_BY_RARITY = {
        common: 1,
        uncommon: 2,
        rare: 3,
        epic: 4,
        legendary: 5
    };

    // Spawn/merge durability by armor family.
    static ARMOR_DURABILITY_BY_TYPE = {
        leather: { common: 15, uncommon: 20, rare: 25, epic: 28, legendary: 30 },
        chain:   { common: 15, uncommon: 20, rare: 25, epic: 28, legendary: 30 },
        plate:   { common: 15, uncommon: 20, rare: 25, epic: 28, legendary: 30 },
    };

    static armorDurability(armorType, rarity) {
        const byType = CardDataGenerator.ARMOR_DURABILITY_BY_TYPE[armorType]
            || CardDataGenerator.ARMOR_DURABILITY_BY_TYPE.leather;
        return byType[rarity] || byType.common || 15;
    }

    // Amulet rarity is rolled FIRST by source, then the player picks 1 of 3
    // amulets of that rarity. Weights are relative (need not sum to 100).
    static AMULET_RARITY_RATES = {
        floor:     { common: 50, uncommon: 30, rare: 20 },
        shop:      { common: 50, uncommon: 30, rare: 20 },
        rare_shop: { uncommon: 25, rare: 60, legendary: 15 },
        // Boss: rare or legendary (boss ignores minFloor so act-1 boss can roll rare).
        boss:      { rare: 30, legendary: 70 },
    };

    // Earliest floor a source may sell/offer amulets (floor/boss have no gate).
    static AMULET_SOURCE_MIN_FLOOR = {
        shop: 5,
        rare_shop: 20,
    };

    static gemSlotsForRarity(rarity) {
        return CardDataGenerator.GEM_SLOTS_BY_RARITY[rarity] || 1;
    }

    static weaponGemSlots(weapon) {
        if (!weapon) return 1;
        if (weapon.gemSlots != null) return weapon.gemSlots;
        return CardDataGenerator.gemSlotsForRarity(weapon.rarity);
    }

    static weaponGemStack(weapon) {
        const slots = CardDataGenerator.weaponGemSlots(weapon);
        return Math.max(1, Math.min(slots, weapon?.gemCount || 1));
    }

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
        // All values below are REAL spawn numbers (rebalance "pure-runs-v1"):
        // no knob multipliers. Weapon supply is the main survival faucet for
        // the dagger+bow starting loadout, so its minimums are the first lever
        // to touch when moving the reach-F15 target.
        const weaponMinimum = floor >= 31 ? 12 : floor >= 16 ? 11 : 9;
        const weaponBoost = floor >= 31 ? 4 : floor >= 16 ? 3 : 1;
        // Post-boss recovery windows (F16-19, F31-34): fresh act weapons.
        const postBossMin = postBossWeaponFloor(floor) ? 2 : 0;
        const postBossBoost = postBossWeaponFloor(floor) ? 8 : 0;

        const enemyMultiplier = floor <= 14 ? 0.68 : floor <= 23 ? 0.78 : floor <= 30 ? 0.70 : 0.78;
        balanced.enemy = Math.max(20, Math.floor((balanced.enemy || 0) * enemyMultiplier));
        balanced.coin = Math.max(1, Math.floor((balanced.coin || 0) * 0.25));
        balanced.trap = Math.max(3, Math.floor((balanced.trap || 0) * 0.75));
        balanced.weapon = Math.max(
            weaponMinimum + postBossMin,
            Math.floor((balanced.weapon || 0) * 0.95) + weaponBoost + postBossBoost
        );
        balanced.armor = Math.max(
            floor >= 18 ? 12 : 10,
            Math.ceil((balanced.armor || 0) * 1.15)
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
        // Socket gems begin late in act 1 and ramp through the acts without
        // flooding the three available weapon sockets.
        balanced.gem = floor < 12 ? 0
            : floor <= 15 ? 3
            : floor <= 30 ? 8
            : 10;
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
                uncommon: { floor: 8, damage: 4, sprite: 'dagger_U', special: 'dualWield' },
                rare: { floor: 18, damage: 5, sprite: 'dagger_R', special: 'dualWield' },
                epic: { floor: 26, damage: 6, sprite: 'dagger_E', special: 'dualWield' },
                legendary: { floor: 34, damage: 7, sprite: 'dagger_L', special: 'dualWield' }
            },
            bow: {
                // Common from F1: the bow is half of the starting loadout, so
                // its resupply must exist from the very first floors.
                common: { floor: 1, damage: 4, sprite: 'bow_c', special: 'block', range: 'ranged' },
                uncommon: { floor: 12, damage: 5, sprite: 'bow_U', special: 'block', range: 'ranged' },
                rare: { floor: 24, damage: 6, sprite: 'bow_R', special: 'block', range: 'ranged' },
                epic: { floor: 30, damage: 7, sprite: 'bow_E', special: 'block', range: 'ranged' },
                legendary: { floor: 38, damage: 9, sprite: 'bow_L', special: 'block', range: 'ranged' }
            },
            sword: {
                // Act 2 weapon — appears fresh at the act-2 start (floor 16) and merges
                // up through act 2 before the axe takes over in act 3. Deliberately
                // NOT available in act 1: act 1 belongs to the dagger+bow loadout,
                // and the sword is the act-2 power jump.
                common: { floor: 16, damage: 5, sprite: 'sword_C', special: null },
                uncommon: { floor: 19, damage: 6, sprite: 'sword_U', special: null },
                rare: { floor: 22, damage: 7, sprite: 'sword_R', special: null },
                epic: { floor: 25, damage: 8, sprite: 'sword_E', special: null },
                legendary: { floor: 28, damage: 9, sprite: 'sword_L', special: null }
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
        // Armor pool is filtered per character in createArmorCard:
        // rogue → leather only; warrior → chain and/or plate (sim can narrow).
        this.armorUnlocks = {
            leather: {
                // Dodge-only armor: no protection. Durability ticks on successful dodge.
                common:    { floor: 1,  protection: 0, dodgeChance: 0.10, sprite: 'leather_C' },
                uncommon:  { floor: 10, protection: 0, dodgeChance: 0.15, sprite: 'leather_U' },
                rare:      { floor: 18, protection: 0, dodgeChance: 0.20, sprite: 'leather_R' },
                epic:      { floor: 26, protection: 0, dodgeChance: 0.25, sprite: 'leather_E' },
                legendary: { floor: 34, protection: 0, dodgeChance: 0.30, sprite: 'leather_L' }
            },
            chain: {
                // Flat DEF + chance to counter melee for ceil(50% of blocked), no weapon pip.
                common:    { floor: 1, protection: 1, meleeCounterChance: 0.10, sprite: 'chain_C' },
                uncommon:  { floor: 1, protection: 2, meleeCounterChance: 0.15, sprite: 'chain_U' },
                rare:      { floor: 1, protection: 3, meleeCounterChance: 0.20, sprite: 'chain_R' },
                epic:      { floor: 1, protection: 4, meleeCounterChance: 0.25, sprite: 'chain_E' },
                legendary: { floor: 1, protection: 4, meleeCounterChance: 0.25, sprite: 'chain_L' }
            },
            plate: {
                // Flat DEF + chance to fully ignore a ranged hit.
                common:    { floor: 1, protection: 1, rangedIgnoreChance: 0.50, sprite: 'plate_C' },
                uncommon:  { floor: 1, protection: 2, rangedIgnoreChance: 0.75, sprite: 'plate_U' },
                rare:      { floor: 1, protection: 3, rangedIgnoreChance: 1.00, sprite: 'plate_R' },
                epic:      { floor: 1, protection: 4, rangedIgnoreChance: 1.00, sprite: 'plate_E' },
                legendary: { floor: 1, protection: 4, rangedIgnoreChance: 1.00, sprite: 'plate_L' }
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
                    // Act 1 softened for dagger+bow start (reach-F15 target ~50%).
                    { minFloor: 1,  damage: 5,  health: 8  },
                    { minFloor: 5,  damage: 7,  health: 11 },
                    { minFloor: 10, damage: 8,  health: 12 },
                    { minFloor: 15, damage: 8,  health: 14 },
                    // Act 2: +20% HP vs F15 tier (steepen reach curve).
                    { minFloor: 16, damage: 8,  health: 17 },
                    { minFloor: 31, damage: 11, health: 20 }
                ]
            },
            spider: {
                name: 'Spider',
                sprite: 'spider_c',
                role: 'MELEE',
                minFloor: 3,
                tiers: [
                    { minFloor: 3,  damage: 4,  health: 7  },
                    { minFloor: 8,  damage: 5,  health: 9  },
                    { minFloor: 13, damage: 5,  health: 9  },
                    // Act 2+ tiers: +20% HP.
                    { minFloor: 16, damage: 6,  health: 11 },
                    { minFloor: 18, damage: 7,  health: 16 },
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
                    { minFloor: 4,  damage: 5,  health: 9  },
                    { minFloor: 11, damage: 8,  health: 11 },
                    // Act 2+ tiers: +20% HP.
                    { minFloor: 16, damage: 10,  health: 17 },
                    { minFloor: 20, damage: 10,  health: 17 },
                    { minFloor: 31, damage: 12, health: 20 }
                ],
                abilities: [{ type: 'coin_steal', chance: 0.5, amount: 1 }]
            },
            goblin_archer: {
                name: 'Goblin Archer',
                sprite: 'goblin_archer',
                role: 'RANGED',
                minFloor: 2,
                tiers: [
                    { minFloor: 2,  damage: 3,  health: 5  },
                    { minFloor: 7,  damage: 3,  health: 7  },
                    { minFloor: 12, damage: 4,  health: 7  },
                    // Act 2+ tiers: +20% HP.
                    { minFloor: 16, damage: 6,  health: 9  },
                    { minFloor: 22, damage: 8,  health: 12 },
                    { minFloor: 31, damage: 9,  health: 13 }
                ],
                abilities: []
            },
            skeleton_archer: {
                name: 'Skeleton Archer',
                sprite: 'skeleton_archer',
                role: 'RANGED',
                minFloor: 6,
                tiers: [
                    { minFloor: 6,  damage: 3,  health: 5  },
                    { minFloor: 11, damage: 4,  health: 7  },
                    // Act 2+ tiers: +20% HP.
                    { minFloor: 16, damage: 6,  health: 10 },
                    { minFloor: 17, damage: 6,  health: 10 },
                    { minFloor: 25, damage: 8,  health: 12 },
                    { minFloor: 31, damage: 9,  health: 13 }
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
                    // Act 2 exclusive (+20% HP pass).
                    { minFloor: 16, damage: 7, health: 10 },
                    { minFloor: 24, damage: 8, health: 12 },
                    { minFloor: 31, damage: 11, health: 13 }
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
                    // Boss-summon only; act 2 tier +20% HP.
                    { minFloor: 16, damage: 8, health: 11 },
                    { minFloor: 31, damage: 10, health: 12 }
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
                health: 66,
                attack: 10,
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
                health: 60,
                attack: 10,
                sprite: 'SpiderQween',
                abilities: [
                    // Poison 3 -> 2 dmg: power-budget put her fight cost 43%
                    // above the tier median — the DoT stacked on top of median
                    // stats made her the unlucky roll of tier 1.
                    { type: 'poison', damage: 2, turns: 3, stackable: true, maxStacks: 3 },
                    { type: 'summon', enemyType: 'spider', chance: 0.35, count: 1 }
                ]
            },

            // ---- Tier 2 (Act 2 finale, floor 30) ----
            soulEater: {
                type: 'boss', tier: 2,
                name: 'Soul Eater',
                health: 120,
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
                // +20% HP vs prior 110 (act-2 boss HP pass).
                health: 132,
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
                // +20% HP vs prior 105 (act-2 boss HP pass).
                health: 126,
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
        // Every droppable amulet belongs to a group — the seed of the future
        // class system (see docs/BALANCE-AMULETS.md):
        //   offense  — damage / weapon synergy (warrior-rogue leaning)
        //   survival — HP, regen, dodge, healing (tank leaning)
        //   magic    — AP economy, spells, gems (mage leaning)
        //   utility  — economy/exploration, no class identity
        // The first amulet of a run steers toward a class group (see
        // createAmuletCard); weights of sweep-proven outliers (dragonClaw,
        // bottomlessBag, evasionBoots) are trimmed so no single pickup
        // dominates the run.
        const dropData = [
            // Common (from floor 0 / start of run)
            { id: 'amuletOfEvasion', minFloor: 0, weight: 10, rarity: 'common', group: 'survival' },
            { id: 'ringOfHealth', minFloor: 0, weight: 10, rarity: 'common', group: 'survival' },
            { id: 'amuletOfProtection', minFloor: 0, weight: 10, rarity: 'common', group: 'survival' },
            { id: 'ringOfRegeneration', minFloor: 0, weight: 10, rarity: 'common', group: 'survival' },
            { id: 'earringOfArmorDurability', minFloor: 0, weight: 8, rarity: 'common', group: 'survival' },
            { id: 'earringOfWeaponDurability', minFloor: 0, weight: 8, rarity: 'common', group: 'offense' },

            // Uncommon (from floor 10)
            { id: 'amuletOfGreaterEvasion', minFloor: 10, weight: 7, rarity: 'uncommon', group: 'survival' },
            { id: 'ringOfGreaterHealth', minFloor: 10, weight: 7, rarity: 'uncommon', group: 'survival' },
            { id: 'amuletOfGreaterProtection', minFloor: 10, weight: 7, rarity: 'uncommon', group: 'survival' },
            { id: 'ringOfGreaterRegeneration', minFloor: 10, weight: 7, rarity: 'uncommon', group: 'survival' },
            { id: 'earringOfGreaterArmorDurability', minFloor: 10, weight: 6, rarity: 'uncommon', group: 'survival' },
            { id: 'earringOfGreaterWeaponDurability', minFloor: 10, weight: 6, rarity: 'uncommon', group: 'offense' },
            { id: 'alchemistBag', minFloor: 10, weight: 6, rarity: 'uncommon', group: 'survival' },
            { id: 'monocle', minFloor: 10, weight: 6, rarity: 'uncommon', group: 'utility' },
            { id: 'pouchOfGreed', minFloor: 10, weight: 8, rarity: 'uncommon', group: 'utility' },

            // Rare (from floor 20; boss can still roll rare earlier — see createAmuletOffer)
            { id: 'vampireFang', minFloor: 20, weight: 4, rarity: 'rare', group: 'offense' },
            { id: 'newDragonClaw', minFloor: 20, weight: 4, rarity: 'rare', group: 'offense' },
            { id: 'runeOfFire', minFloor: 20, weight: 4, rarity: 'rare', group: 'magic' },
            { id: 'runeOfZap', minFloor: 20, weight: 4, rarity: 'rare', group: 'magic' },
            { id: 'runeOfPoison', minFloor: 20, weight: 4, rarity: 'rare', group: 'magic' },
            { id: 'maskOfHollowWhispers', minFloor: 20, weight: 4, rarity: 'rare', group: 'utility' },

            // Legendary (shops / boss until boss-only set exists)
            { id: 'philosophersStone', minFloor: 0, weight: 2, rarity: 'legendary', group: 'survival' },
            { id: 'legendaryWhetstone', minFloor: 0, weight: 2, rarity: 'legendary', group: 'offense' },
            { id: 'lostNobleDiadem', minFloor: 0, weight: 2, rarity: 'legendary', group: 'survival' },
            { id: 'glovesOfHermitWizard', minFloor: 0, weight: 2, rarity: 'legendary', group: 'magic' },
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
                return this.createArmorCard(floor, targetRarity, gameState);
            case 'amulet':
                if (areAmuletsDisabled()) return null;
                // targetRarity here is overloaded as the SOURCE key when it's one of
                // floor/shop/rare_shop/boss; otherwise treat as a literal rarity filter.
                if (targetRarity && CardDataGenerator.AMULET_RARITY_RATES[targetRarity]) {
                    return this.createAmuletOffer(targetRarity, floor, gameState);
                }
                if (targetRarity) {
                    return this.createAmuletOffer(null, floor, gameState, targetRarity);
                }
                return this.createAmuletOffer('floor', floor, gameState);
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
        // Boss stats are used verbatim from bossData (pure-runs-v1: no knob
        // multipliers) — tune the tier tables directly.
        const boss = JSON.parse(JSON.stringify(this.bossData[id]));
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

        // Tier stats are used verbatim (pure-runs-v1: no knob multipliers) —
        // difficulty is tuned directly in the enemyData tier tables above.
        const enemyCard = {
            type: 'enemy',
            name: enemy.name,
            health: selectedTier.health,
            attack: selectedTier.damage,
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
        // Slow rarity pipeline through act 2 so legendaries arrive closer to
        // act 3. High-tier weapons are the merge fodder for legendaries, so the
        // act-2 rare weights were cut (floors 23-30) and epic drops pushed fully
        // into act 3 (floor 31+). Rares are still present as merge fodder, just
        // scarcer, which stretches the rare→epic→legendary climb past act 2.
        // (Softer than a hard merge gate — see lever-1 tuning.)
        if (floor <= 10)       weights = [100, 0,  0,  0];
        else if (floor <= 17)  weights = [90,  10, 0,  0];
        else if (floor <= 22)  weights = [68,  29, 3,  0];
        else if (floor <= 27)  weights = [50,  40, 10, 0];
        else if (floor <= 30)  weights = [38,  47, 15, 0];
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
            maxDurability: baseDurability,
            gemSlots: CardDataGenerator.gemSlotsForRarity(selected.rarity)
        };
    }

    // Weapon CHOICE (docs/BALANCE-VISION.md, "Выбор геймплея при дропе"):
    // returns 2-3 weapons of DIFFERENT types but the same rolled rarity band,
    // so picking between them is a play-style decision (melee vs ranged vs
    // merge fodder), not a raw power decision. Intended consumers: the boss
    // reward room now, regular weapon drops once the pick-one UI exists.
    // Falls back to a single createWeaponCard when the floor only has one
    // weapon type unlocked.
    createWeaponChoice(floor, count = 3) {
        const rarity = this.pickFloorRarity(floor);
        const types = Object.keys(this.weaponUnlocks);
        const options = [];
        for (const type of types) {
            const card = this.createWeaponCardOfType(type, floor, rarity);
            if (card) options.push(card);
        }
        if (options.length <= 1) {
            return [this.createWeaponCard(floor, rarity)];
        }
        // Shuffle so the order carries no signal, then cap at `count`.
        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }
        return options.slice(0, count);
    }

    // Build a weapon card of a specific type at the requested rarity,
    // falling down to lower rarities the floor has unlocked. Returns null
    // if the type has no tier available at this floor.
    createWeaponCardOfType(weaponType, floor, targetRarity) {
        const rarities = this.weaponUnlocks[weaponType];
        if (!rarities) return null;
        const rarityOrder = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
        const start = Math.max(0, rarityOrder.indexOf(targetRarity));
        let picked = null;
        for (const r of rarityOrder.slice(start)) {
            if (rarities[r] && floor >= rarities[r].floor) { picked = r; break; }
        }
        if (!picked) return null;
        const data = rarities[picked];
        const durabilityMap = {
            dagger: { common: 4, uncommon: 5, rare: 6, epic: 7, legendary: 8 },
            bow: { common: 5, uncommon: 6, rare: 7, epic: 8, legendary: 9 },
            sword: { common: 6, uncommon: 8, rare: 10, epic: 11, legendary: 13 },
            axe: { common: 6, uncommon: 8, rare: 10, epic: 12, legendary: 14 }
        };
        const baseDurability = durabilityMap[weaponType]?.[picked] || 5;
        const rarityName = picked.charAt(0).toUpperCase() + picked.slice(1);
        const weaponName = weaponType.charAt(0).toUpperCase() + weaponType.slice(1);
        return {
            type: 'weapon',
            name: `${rarityName} ${weaponName}`,
            weaponType,
            damage: data.damage,
            rarity: picked,
            sprite: data.sprite,
            special: data.special,
            range: data.range || 'melee',
            poisonDamage: data.poisonDamage || 0,
            poisonTurns: data.poisonTurns || 0,
            poisonStackable: data.poisonStackable || false,
            durability: baseDurability,
            maxDurability: baseDurability,
            gemSlots: CardDataGenerator.gemSlotsForRarity(picked)
        };
    }

    createArmorCard(floor, targetRarity = null, gameState = null) {
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

        const characterId = gameState?.characterId || 'rogue';
        const allowedTypes = resolveArmorSpawnTypes(characterId, gameState?.armorPool);
        const availableArmors = [];

        Object.entries(this.armorUnlocks).forEach(([armorType, rarities]) => {
            if (!allowedTypes.includes(armorType)) return;
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

        // Empty armor slot is valid — never invent a Makeshift fallback.
        if (availableArmors.length === 0) return null;

        const selected = availableArmors[Math.floor(Math.random() * availableArmors.length)];
        const rarityName = selected.rarity.charAt(0).toUpperCase() + selected.rarity.slice(1);
        const armorName = selected.type.charAt(0).toUpperCase() + selected.type.slice(1);
        const baseDurability = CardDataGenerator.armorDurability(selected.type, selected.rarity);

        const card = {
            type: 'armor',
            name: `${rarityName} ${armorName} Armor`,
            armorType: selected.type,
            protection: selected.protection || 0,
            rarity: selected.rarity,
            sprite: selected.sprite,
            durability: baseDurability,
            maxDurability: baseDurability,
        };
        if (selected.type === 'leather' && selected.dodgeChance) {
            card.dodgeChance = selected.dodgeChance;
        }
        if (selected.type === 'chain' && selected.meleeCounterChance) {
            card.meleeCounterChance = selected.meleeCounterChance;
        }
        if (selected.type === 'plate' && selected.rangedIgnoreChance) {
            card.rangedIgnoreChance = selected.rangedIgnoreChance;
        }
        if (gameState?.talentEffects) {
            applyArmorTalentMods(card, gameState.talentEffects);
        }
        return card;
    }

    // ── Amulet rarity-first offers ────────────────────────────────────────
    // Flow: roll rarity by source → sample up to 3 amulets of that rarity →
    // UI lets the player pick one. Event-only amulets (teaRoomBell, runes, …)
    // are NOT in amuletTypes and never appear here.

    rollAmuletRarity(source = 'floor') {
        const rates = CardDataGenerator.AMULET_RARITY_RATES[source]
            || CardDataGenerator.AMULET_RARITY_RATES.floor;
        const entries = Object.entries(rates);
        const total = entries.reduce((sum, [, w]) => sum + w, 0);
        let roll = Math.random() * total;
        for (const [rarity, weight] of entries) {
            roll -= weight;
            if (roll <= 0) return rarity;
        }
        return entries[entries.length - 1][0];
    }

    // When an upgrade is owned, its weaker forms are excluded from offers.
    static AMULET_UPGRADE_REPLACES = {
        amuletOfGreaterEvasion: ['amuletOfEvasion'],
        ringOfGreaterHealth: ['ringOfHealth'],
        amuletOfGreaterProtection: ['amuletOfProtection'],
        ringOfGreaterRegeneration: ['ringOfRegeneration'],
        earringOfGreaterArmorDurability: ['earringOfArmorDurability'],
        earringOfGreaterWeaponDurability: ['earringOfWeaponDurability'],
        philosophersStone: [
            'ringOfHealth', 'ringOfGreaterHealth',
            'ringOfRegeneration', 'ringOfGreaterRegeneration',
        ],
        legendaryWhetstone: [
            'earringOfWeaponDurability', 'earringOfGreaterWeaponDurability',
        ],
        glovesOfHermitWizard: ['runeOfFire', 'runeOfZap', 'runeOfPoison'],
    };

    // Amulets of a given rarity the player can still usefully receive.
    // Boss offers ignore minFloor so act-1 boss can award rare/legendary.
    getAmuletsOfRarity(rarity, floor, gameState = null, { ignoreMinFloor = false } = {}) {
        if (rarity === 'old') return [];
        const ownedIds = new Set(
            (gameState?.activeAmulets || []).map((a) => a.id).filter(Boolean)
        );
        const replacedIds = new Set();
        for (const id of ownedIds) {
            const list = CardDataGenerator.AMULET_UPGRADE_REPLACES[id];
            if (list) list.forEach((r) => replacedIds.add(r));
        }

        return (this.amuletTypes || []).filter((amulet) =>
            amulet.rarity === rarity
            && (ignoreMinFloor || floor >= (amulet.minFloor ?? 0))
            && !ownedIds.has(amulet.id)
            && !replacedIds.has(amulet.id)
        );
    }

    // Weighted sample without replacement (uses drop weights + light group steer).
    sampleAmulets(pool, count, gameState = null) {
        if (!pool.length || count <= 0) return [];
        const groupOf = (id) => this.amuletTypes.find((a) => a.id === id)?.group;
        const ownedGroups = (gameState?.activeAmulets || [])
            .map((a) => groupOf(a.id))
            .filter((g) => g && g !== 'utility');
        let steer;
        if (ownedGroups.length === 0) {
            steer = (a) => (a.group === 'utility' ? 0.35 : 1.6);
        } else {
            const counts = {};
            ownedGroups.forEach((g) => { counts[g] = (counts[g] || 0) + 1; });
            const dominant = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
            steer = (a) => (a.group === dominant ? 1.5 : 1);
        }
        const weightOf = (a) => Math.max(0.01, (a.weight || 1) * steer(a));

        const remaining = pool.slice();
        const picked = [];
        while (picked.length < count && remaining.length) {
            const total = remaining.reduce((sum, a) => sum + weightOf(a), 0);
            let roll = Math.random() * total;
            let idx = 0;
            for (; idx < remaining.length; idx++) {
                roll -= weightOf(remaining[idx]);
                if (roll <= 0) break;
            }
            idx = Math.min(idx, remaining.length - 1);
            const [chosen] = remaining.splice(idx, 1);
            picked.push(chosen);
        }
        return picked;
    }

    amuletToCardData(amulet) {
        return {
            type: 'amulet',
            id: amulet.id,
            name: amulet.name,
            rarity: amulet.rarity,
            sprite: amulet.sprite,
            spriteFrame: amulet.spriteFrame,
            group: amulet.group || null,
        };
    }

    // Up to `count` concrete amulet cards of one rarity.
    createAmuletChoice(floor, rarity, count = 3, gameState = null, opts = {}) {
        const pool = this.getAmuletsOfRarity(rarity, floor, gameState, opts);
        return this.sampleAmulets(pool, count, gameState).map((a) => this.amuletToCardData(a));
    }

    // Mystery offer: rarity already rolled, options ready for the choice UI.
    // `forcedRarity` skips the source roll (used when caller already decided).
    createAmuletOffer(source, floor, gameState = null, forcedRarity = null) {
        if (areAmuletsDisabled()) return null;

        const sourceKey = source && CardDataGenerator.AMULET_RARITY_RATES[source] ? source : 'floor';
        const allowed = Object.keys(
            CardDataGenerator.AMULET_RARITY_RATES[sourceKey] || CardDataGenerator.AMULET_RARITY_RATES.floor
        );
        const poolOpts = { ignoreMinFloor: sourceKey === 'boss' };

        let rarity = forcedRarity;
        if (!rarity || !allowed.includes(rarity)) {
            // Prefer a rarity that still has candidates; fall back across the
            // source table if the first roll lands on an empty pool.
            const tried = new Set();
            for (let attempt = 0; attempt < allowed.length; attempt++) {
                const candidate = this.rollAmuletRarity(sourceKey);
                if (tried.has(candidate)) continue;
                tried.add(candidate);
                if (this.getAmuletsOfRarity(candidate, floor, gameState, poolOpts).length > 0) {
                    rarity = candidate;
                    break;
                }
            }
            if (!rarity) {
                for (const candidate of allowed) {
                    if (this.getAmuletsOfRarity(candidate, floor, gameState, poolOpts).length > 0) {
                        rarity = candidate;
                        break;
                    }
                }
            }
        }

        let options = rarity ? this.createAmuletChoice(floor, rarity, 3, gameState, poolOpts) : [];

        // No candidates for this floor/source.
        if (!options.length) return null;

        const label = `${rarity.charAt(0).toUpperCase()}${rarity.slice(1)} Amulet`;
        // Visual: show the first option's art as a stand-in on boards/shops;
        // the real pick happens in the choice overlay.
        const face = options[0];
        return {
            type: 'amulet',
            pendingChoice: true,
            source: sourceKey,
            rarity,
            options,
            id: null,
            name: label,
            sprite: face.sprite,
            spriteFrame: face.spriteFrame,
        };
    }

    // Legacy single-roll helper (events / random grants that still want one id).
    // Now: roll as floor source and return a random option from the choice set.
    createAmuletCard(floor, gameState = null) {
        const offer = this.createAmuletOffer('floor', floor, gameState);
        if (!offer?.options?.length) return null;
        const pick = offer.options[Math.floor(Math.random() * offer.options.length)];
        return pick;
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

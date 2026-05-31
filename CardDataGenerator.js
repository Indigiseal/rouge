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
        const weaponMinimum = floor >= 16 ? 16 : floor >= 11 ? 14 : 10;
        const weaponBoost = floor >= 16 ? 8 : floor >= 11 ? 5 : floor >= 6 ? 3 : 0;

        const enemyMultiplier = floor <= 14 ? 0.68 : 0.78; // back to original; enemy MINIMUM now guarantees fights
        balanced.enemy = Math.max(20, Math.floor((balanced.enemy || 0) * enemyMultiplier));
        balanced.coin = Math.max(1, Math.floor((balanced.coin || 0) * 0.25));
        balanced.trap = Math.max(3, Math.floor((balanced.trap || 0) * 0.75));
        balanced.weapon = Math.max(weaponMinimum, Math.floor((balanced.weapon || 0) * 1.2) + weaponBoost);
        balanced.armor = Math.max(14, Math.ceil((balanced.armor || 0) * 1.8));  // Bumped: armor needs to drop often enough to build a merge line
        // Amulets were flooding the late game (~22% of cards, 4-5 per floor),
        // which trivialized runs once you stacked a dozen+. Cap the weight so
        // they stay an occasional reward (~6% of cards). Bigger rewards now
        // come from curated events instead.
        balanced.amulet = Math.min(floor >= 15 ? 14 : 8, Math.max(3, balanced.amulet || 0));
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
        balanced.gem = floor < 7 ? 0
            : floor <= 15 ? 11  // rest of act 1: gems begin appearing
            : floor <= 30 ? 13  // act 2: steady trickle
            : 15;               // act 3: modest bump, not a flood
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
            food: Math.max(10, 18 - Math.floor(floor / 3)),     // Decays slowly, floors at 10 minimum
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
                uncommon: { floor: 4, damage: 4, sprite: 'dagger_U', special: 'dualWield' },
                rare: { floor: 8, damage: 5, sprite: 'dagger_R', special: 'dualWield' },
                epic: { floor: 10, damage: 6, sprite: 'dagger_E', special: 'dualWield' },
                legendary: { floor: 13, damage: 7, sprite: 'dagger_L', special: 'dualWield' }
            },
            spear: {
                common: { floor: 5, damage: 4, sprite: 'spear_c', special: 'block', range: 'ranged' },
                uncommon: { floor: 9, damage: 5, sprite: 'spear_u', special: 'block', range: 'ranged' },
                rare: { floor: 13, damage: 6, sprite: 'spear_R', special: 'block', range: 'ranged' },
                epic: { floor: 15, damage: 7, sprite: 'spear_E', special: 'block', range: 'ranged' },
                legendary: { floor: 18, damage: 9, sprite: 'spear_L', special: 'block', range: 'ranged' }
            },
            sword: {
                // Act 2 weapon — appears fresh at the act-2 start (floor 16) and merges
                // up through act 2 before the axe takes over in act 3.
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
                common:    { floor: 1,  protection: 1, dodgeChance: 0.1,  sprite: 'leather_C' },
                uncommon:  { floor: 4,  protection: 2, dodgeChance: 0.15, sprite: 'leather_U' },
                rare:      { floor: 8,  protection: 3, dodgeChance: 0.2,  sprite: 'leather_R' },
                epic:      { floor: 10, protection: 4, dodgeChance: 0.22, sprite: 'leather_E' },
                legendary: { floor: 13, protection: 5, dodgeChance: 0.25, sprite: 'leather_L' }
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
                    { minFloor: 1,  damage: 7,  health: 10 },
                    { minFloor: 5,  damage: 9,  health: 13 },
                    { minFloor: 10, damage: 9,  health: 13 },
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
                    { minFloor: 3,  damage: 6,  health: 9  },
                    { minFloor: 8,  damage: 7,  health: 11 },
                    { minFloor: 13, damage: 6,  health: 10 },
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
                    { minFloor: 4,  damage: 7,  health: 11 },
                    { minFloor: 11, damage: 9,  health: 13 },
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
                    { minFloor: 2,  damage: 3,  health: 6  },
                    { minFloor: 7,  damage: 5,  health: 9  },
                    { minFloor: 12, damage: 5,  health: 8  },
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
                    { minFloor: 6,  damage: 4,  health: 7  },
                    { minFloor: 11, damage: 5,  health: 9  },
                    { minFloor: 16, damage: 5,  health: 8  },
                    { minFloor: 17, damage: 5,  health: 8  },
                    { minFloor: 25, damage: 7,  health: 10 },
                    { minFloor: 31, damage: 8,  health: 13 }
                ],
                abilities: []
            }
        };
    }

    initializeBossData() {
        // Bosses trimmed -1 to -3 attack and ~10% HP across the board so the
        // act gates feel hard but beatable. Cerberus took the biggest dmg cut
        // (20→17) because its 20-attack spike was the single deadliest moment
        // in the sim, far above the Lich at floor 25.
        this.bossData = {
            5: { // Floor 5 mini boss
                type: 'boss',
                name: 'Giant Skeleton',
                health: 32,
                attack: 8,
                sprite: 'giantSkeleton',
                abilities: [
                    { type: 'poison', damage: 3, turns: 5 },
                    { type: 'summon', enemyType: 'skeleton', chance: 0.3, count: 1 }
                ]

            },
            10: { // Floor 10 boss
                type: 'boss',
                name: 'Goblin King',
                health: 46,
                attack: 9,
                sprite: 'GoblinKingSprite',
                abilities: [
                    { type: 'poison', damage: 5, turns: 5, stackable: true },
                    { type: 'summon', enemyType: 'goblin', chance: 0.3, count: 1 }

                ]
            },
            15: { // Floor 15 boss — Act 1 gate (was deadliest single floor)
                type: 'boss',
                name: 'Spider Queen',
                health: 40,
                attack: 7,
                sprite: 'SpiderQween',
                abilities: [
                    { type: 'poison', damage: 5, turns: 5, stackable: true },
                    { type: 'summon', enemyType: 'spider', chance: 0.3, count: 1 }
                ]
            },
            20: { // Floor 20 boss
                type: 'boss',
                name: 'Soul Eater',
                health: 54,
                attack: 11,
                sprite: 'SoulEater',
                abilities: [
                    { type: 'lifesteal', percentage: 0.6 },
                    { type: 'summon', enemyType: 'skeleton', chance: 0.3, count: 1 },
                    { type: 'armor_break', amount: 2 },
                    { type: 'rage', threshold: 0.5, damageBoost: 1.5 }
                ]
            },
            25: { // Floor 25 boss
                type: 'boss',
                name: 'Lich',
                health: 66,
                attack: 13,
                sprite: 'Lich',
                abilities: [
                    { type: 'poison', damage: 8, turns: 5, stackable: true },
                    { type: 'lifesteal', percentage: 0.8 }
                ]
            },
            30: { // Floor 30 final boss — Act 2 gate
                type: 'boss',
                name: 'Cerberus',
                health: 88,
                attack: 17,
                sprite: 'Cerberus',
                abilities: [
                    { type: 'rage', threshold: 0.3, damageBoost: 2 },
                    { type: 'armor_break', amount: 5 }
                ]
            },
            45: { // Floor 45 final boss — Act 3 gate
                type: 'boss',
                name: 'Ancient Cerberus',
                health: 124,
                attack: 22,
                sprite: 'Cerberus',
                abilities: [
                    { type: 'rage', threshold: 0.3, damageBoost: 2 },
                    { type: 'armor_break', amount: 6 }
                ]
            }
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
                    abilities: [{ type: 'poison', damage: 1 + Math.floor(floor / 3), turns: 3 }]
                })
            },
            {
                weight: 30,
                subType: 'reveal',
                name: 'Pressure Plate',
                sprite: 'trapTriggers',
                createData: (floor) => ({})
            }
            // Add more trap types here
        ];
    }

    initializeAmuletData() {
        this.amuletTypes = [
            // REGULAR AMULETS
            {
                id: 'regeneration',
                name: 'Amulet of Regeneration',
                minFloor: 1,
                weight: 10,
                rarity: 'uncommon',
                sprite: 'relicsOthers',
                spriteFrame: 2
            },
            {
                id: 'healingRing',
                name: 'Healing Ring',
                minFloor: 2,
                weight: 10,
                rarity: 'uncommon',
                sprite: 'relicsOthers',
                spriteFrame: 3
            },
            {
                id: 'invulnerability',
                name: 'Amulet of Invulnerability',
                minFloor: 15,
                weight: 2,
                rarity: 'legendary',
                sprite: 'amulet_invuln'
            },
            {
                id: 'evasionBoots',
                name: 'Boots of Evasion',
                minFloor: 3,
                weight: 8,
                rarity: 'uncommon',
                sprite: 'relicsOthers',
                spriteFrame: 1
            },
            {
                id: 'dragonClaw',
                name: 'Dragon Claw',
                minFloor: 8,
                weight: 5,
                rarity: 'rare',
                sprite: 'amulet_claw'
            },
            {
                id: 'greedPouch',
                name: 'Pouch of Greed',
                minFloor: 1,
                weight: 10,
                rarity: 'uncommon',
                sprite: 'amulet_pouch'
            },
            {
                id: 'golemHeart',
                name: "Golem's Heart",
                minFloor: 2,
                weight: 8,
                rarity: 'uncommon',
                sprite: 'amulet_golem'
            },
            {
                id: 'chronosHeart',
                name: 'Chronos Heart',
                minFloor: 5,
                weight: 5,
                rarity: 'rare',
                sprite: 'relicsOthers',
                spriteFrame: 4
            },
            {
                id: 'speedBoots',
                name: 'Speed Boots',
                minFloor: 4,
                weight: 6,
                rarity: 'rare',
                sprite: 'relicsOthers',
                spriteFrame: 1
            },
            {
                id: 'abyssHourglass',
                name: 'Abyss Hourglass',
                minFloor: 3,
                weight: 8,
                rarity: 'uncommon',
                sprite: 'amulet_hourglass'
            },
            {
                id: 'temperedSteel',
                name: 'Tempered Steel',
                minFloor: 6,
                weight: 6,
                rarity: 'rare',
                sprite: 'amulet_steel'
            },
            {
                id: 'bottomlessBag',
                name: 'Bottomless Bag',
                minFloor: 1,
                weight: 7,
                rarity: 'common',
                sprite: 'relicsOthers',
                spriteFrame: 0
            },
            {
                id: 'travelKitchen',
                name: 'Travel Kitchen',
                minFloor: 2,
                weight: 8,
                rarity: 'uncommon',
                sprite: 'amulet_kitchen'
            },
            {
                id: 'vampiricRing',
                name: 'Vampiric Ring',
                minFloor: 4,
                weight: 7,
                rarity: 'uncommon',
                sprite: 'amulet_vampiric'
            },
            {
                id: 'soulHarvester',
                name: 'Soul Harvester',
                minFloor: 10,
                weight: 4,
                rarity: 'rare',
                sprite: 'relicsOthers',
                spriteFrame: 6
            },
            
            // CURSED AMULETS (appear later, rarer)
            {
                id: 'hungryDagger',
                name: 'Dagger of the Hungry Spirit',
                minFloor: 12,
                weight: 4,
                rarity: 'cursed',
                sprite: 'amulet_hungry'
            },
            {
                id: 'bloodyHarvest',
                name: 'Rune of Balance',
                minFloor: 10,
                weight: 4,
                rarity: 'cursed',
                sprite: 'relicsOthers',
                spriteFrame: 5
            },
            {
                id: 'eternalRage',
                name: 'Amulet of Eternal Rage',
                minFloor: 8,
                weight: 4,
                rarity: 'cursed',
                sprite: 'amulet_rage'
            },
            {
                id: 'berserkerBelt',
                name: 'Berserker Belt',
                minFloor: 14,
                weight: 3,
                rarity: 'cursed',
                sprite: 'amulet_berserker'
            },
            {
                id: 'diviners_spade',
                name: "Diviner's Spade",
                minFloor: 2,
                weight: 7,
                rarity: 'uncommon',
                sprite: 'relicsOthers',
                spriteFrame: 7
            },
            {
                id: 'wayfinder',
                name: 'Wayfinder',
                minFloor: 4,
                weight: 5,
                rarity: 'rare',
                sprite: 'relicsOthers',
                spriteFrame: 8
            },
            {
                id: 'skeletonKey',
                name: 'Skeleton Key',
                minFloor: 3,
                weight: 5,
                rarity: 'rare',
                sprite: 'relicsOthers',
                spriteFrame: 9
            },
            {
                id: 'greasewingFeast',
                name: "Greasewing's Feast",
                minFloor: 5,
                weight: 6,
                rarity: 'uncommon',
                sprite: 'relicsOthers',
                spriteFrame: 10
            },
            {
                id: 'sunstone',
                name: 'Sunstone',
                minFloor: 6,
                weight: 5,
                rarity: 'rare',
                sprite: 'relicsOthers',
                spriteFrame: 11
            },
            {
                id: 'merchantPact',
                name: "Merchant's Pact",
                minFloor: 3,
                weight: 5,
                rarity: 'rare',
                sprite: 'relicsOthers',
                spriteFrame: 12
            },
            {
                id: 'watchersLamp',
                name: "Watcher's Lamp",
                minFloor: 4,
                weight: 5,
                rarity: 'rare',
                sprite: 'relicsOthers',
                spriteFrame: 24
            },
            {
                id: 'reapersMask',
                name: "Reaper's Mask",
                minFloor: 5,
                weight: 5,
                rarity: 'rare',
                sprite: 'relicsOthers',
                spriteFrame: 25
            },
            {
                id: 'travelersJournal',
                name: "Traveler's Journal",
                minFloor: 6,
                weight: 4,
                rarity: 'rare',
                sprite: 'relicsOthers',
                spriteFrame: 26
            },
            {
                id: 'charmingTune',
                name: 'Charming Tune',
                minFloor: 3,
                weight: 6,
                rarity: 'uncommon',
                sprite: 'relicsOthers',
                spriteFrame: 27
            },
            {
                id: 'wayfarersMap',
                name: "Wayfarer's Map",
                minFloor: 4,
                weight: 5,
                rarity: 'rare',
                sprite: 'relicsOthers',
                spriteFrame: 28
            },
            {
                id: 'sirensPendant',
                name: "Siren's Pendant",
                minFloor: 6,
                weight: 4,
                rarity: 'rare',
                sprite: 'relicsOthers',
                spriteFrame: 29
            }
        ];
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
    
    createCardData(type, floor, isElite = false, gameState = null, targetRarity = null) {
        switch (type) {
            case 'boss':
                return this.createBossCard(floor);
            case 'enemy':
                return this.createEnemyCard(floor, isElite);
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
        return this.bossData[floor] || this.bossData[30];
    }

    createEnemyCard(floor, isElite = false) {
        // Fallback in case no enemies are available
        const availableEnemies = Object.keys(this.enemyData).filter(key => floor >= this.enemyData[key].minFloor);
        if (availableEnemies.length === 0) {
            return this.createFallbackEnemy(floor);
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
        const ATK_MULT = 1.0, HP_MULT = 1.0; // global enemy buff off for now — difficulty comes from no-free-floors + bosses
        const enemyCard = {
            type: 'enemy',
            name: enemy.name,
            health: Math.ceil(selectedTier.health * HP_MULT),
            attack: Math.ceil(selectedTier.damage * ATK_MULT),
            sprite: enemy.sprite,
            role: enemy.role || 'MELEE' // Default to MELEE if role is missing
        };

        if (enemy.abilities) {
            enemyCard.abilities = [...enemy.abilities];
        }
        // Boost for elite
        if (isElite) {
            enemyCard.health = Math.floor(enemyCard.health * 1.2); // +20% health
            enemyCard.attack += 2; // +2 attack
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
            amount: 2 + Math.floor(Math.random() * 4), // 2-5 (was 5-14)
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
        if (floor <= 5)        weights = [95, 5,  0,  0];
        else if (floor <= 10)  weights = [85, 15, 0,  0];
        else if (floor <= 15)  weights = [70, 25, 5,  0];
        else if (floor <= 20)  weights = [55, 35, 10, 0];   // early act 2 — no epics yet
        else if (floor <= 25)  weights = [40, 40, 20, 0];   // mid act 2   — no epics yet
        else if (floor <= 30)  weights = [25, 40, 30, 5];   // late act 2  — epics begin
        else if (floor <= 35)  weights = [10, 35, 40, 15];  // early act 3
        else if (floor <= 40)  weights = [5,  25, 45, 25];  // mid act 3
        else                   weights = [0,  15, 45, 40];  // late act 3
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
            spear: { common: 5, uncommon: 6, rare: 7, epic: 8, legendary: 9 },
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
            protection: selected.protection,
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
        const tiers = {
            common:    { thornDamage: 1, durability: 6,  cost: 8 },
            uncommon:  { thornDamage: 2, durability: 7,  cost: 12 },
            rare:      { thornDamage: 3, durability: 9,  cost: 18 },
            epic:      { thornDamage: 4, durability: 10, cost: 23 },
            legendary: { thornDamage: 5, durability: 11, cost: 28 }
        };
        const tier = tiers[rarity] || tiers.common;
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

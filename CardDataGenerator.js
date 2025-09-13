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
        // Define weight progression for each card type across 30 floors
        // Boss floors are now: 5, 10, 15, 20, 25, 30
        this.floorWeights = {
            // Floors 1-4: Early game
            1: { enemy: 30, coin: 30, crystal: 5, trap: 5, weapon: 10, armor: 10, amulet: 2, potion: 8, food: 15, magic: 3, key: 1 },
            2: { enemy: 35, coin: 25, crystal: 5, trap: 8, weapon: 10, armor: 10, amulet: 2, potion: 8, food: 15, magic: 3, key: 1 },
            3: { enemy: 40, coin: 20, crystal: 8, trap: 10, weapon: 10, armor: 10, amulet: 3, potion: 10, food: 15, magic: 4, key: 2 },
            4: { enemy: 40, coin: 20, crystal: 8, trap: 10, weapon: 10, armor: 10, amulet: 3, potion: 10, food: 12, magic: 4, key: 2 },
            5: { boss: 100 }, // Giant Skeleton
            
            // Floors 6-9
            6: { enemy: 45, coin: 18, crystal: 10, trap: 12, weapon: 8, armor: 8, amulet: 4, potion: 10, food: 10, magic: 5, key: 3 },
            7: { enemy: 48, coin: 15, crystal: 10, trap: 14, weapon: 8, armor: 8, amulet: 5, potion: 10, food: 10, magic: 5, key: 3 },
            8: { enemy: 50, coin: 15, crystal: 12, trap: 14, weapon: 7, armor: 7, amulet: 5, potion: 10, food: 10, magic: 6, key: 3 },
            9: { enemy: 50, coin: 12, crystal: 12, trap: 15, weapon: 7, armor: 7, amulet: 5, potion: 10, food: 8, magic: 6, key: 4 },
            10: { boss: 100 }, // Goblin King
            
            // Floors 11-14
            11: { enemy: 52, coin: 12, crystal: 12, trap: 16, weapon: 6, armor: 6, amulet: 6, potion: 10, food: 8, magic: 7, key: 4 },
            12: { enemy: 55, coin: 10, crystal: 12, trap: 18, weapon: 6, armor: 6, amulet: 6, potion: 10, food: 8, magic: 7, key: 4 },
            13: { enemy: 55, coin: 10, crystal: 14, trap: 18, weapon: 5, armor: 5, amulet: 7, potion: 10, food: 7, magic: 8, key: 4 },
            14: { enemy: 58, coin: 8, crystal: 14, trap: 20, weapon: 5, armor: 5, amulet: 7, potion: 10, food: 7, magic: 8, key: 5 },
            15: { boss: 100 }, // Spider Queen or Phantom Knight
            
            // Floors 16-19
            16: { enemy: 60, coin: 8, crystal: 15, trap: 22, weapon: 4, armor: 4, amulet: 8, potion: 10, food: 6, magic: 9, key: 5 },
            17: { enemy: 62, coin: 6, crystal: 15, trap: 22, weapon: 4, armor: 4, amulet: 8, potion: 10, food: 6, magic: 9, key: 5 },
            18: { enemy: 65, coin: 6, crystal: 15, trap: 24, weapon: 4, armor: 4, amulet: 9, potion: 10, food: 5, magic: 10, key: 5 },
            19: { enemy: 65, coin: 5, crystal: 18, trap: 24, weapon: 3, armor: 3, amulet: 9, potion: 10, food: 5, magic: 10, key: 6 },
            20: { boss: 100 }, // Keeper of Time or Soul Eater
            
            // Floors 21-24
            21: { enemy: 68, coin: 5, crystal: 18, trap: 26, weapon: 3, armor: 3, amulet: 10, potion: 10, food: 4, magic: 11, key: 6 },
            22: { enemy: 70, coin: 4, crystal: 18, trap: 28, weapon: 3, armor: 3, amulet: 10, potion: 10, food: 4, magic: 11, key: 6 },
            23: { enemy: 70, coin: 4, crystal: 20, trap: 28, weapon: 2, armor: 2, amulet: 10, potion: 10, food: 3, magic: 12, key: 6 },
            24: { enemy: 72, coin: 3, crystal: 20, trap: 30, weapon: 2, armor: 2, amulet: 11, potion: 10, food: 3, magic: 12, key: 7 },
            25: { boss: 100 }, // Lich, Vampire, or Berserker
            
            // Floors 26-29: End game
            26: { enemy: 75, coin: 2, crystal: 22, trap: 32, weapon: 2, armor: 2, amulet: 12, potion: 10, food: 2, magic: 13, key: 8 },
            27: { enemy: 78, coin: 2, crystal: 22, trap: 32, weapon: 1, armor: 1, amulet: 12, potion: 10, food: 2, magic: 13, key: 8 },
            28: { enemy: 80, coin: 2, crystal: 25, trap: 35, weapon: 1, armor: 1, amulet: 13, potion: 10, food: 1, magic: 14, key: 8 },
            29: { enemy: 82, coin: 1, crystal: 25, trap: 35, weapon: 1, armor: 1, amulet: 14, potion: 10, food: 1, magic: 14, key: 10 },
            30: { boss: 100 } // Anti-Magic Golem, Jester Twin, or Cerberus
        };
        
        // Alternative: Formula-based weights for smoother progression
        this.useFormulaWeights = false; // Set to true to use formulas instead
    }

    getCardWeights(floor) {
        // Use predefined weights if they exist for this floor
        if (this.floorWeights[floor]) {
            return this.floorWeights[floor];
        }
        
        // Fallback: Use formula-based weights for any undefined floors
        return this.calculateFormulaWeights(floor);
    }

    calculateFormulaWeights(floor) {
        // Check if it's a boss floor
        const bossFloors = [5, 10, 15, 20, 25, 30];
        if (bossFloors.includes(floor)) {
            return { boss: 100 };
        }
        
        // Formula-based weight calculation for non-boss floors
        const weights = {
            enemy: Math.min(30 + floor * 2, 50),
            coin: Math.max(30 - floor, 2),
            crystal: Math.min(5 + Math.floor(floor * 0.9), 50),
            trap: Math.min(5 + floor, 35),
            weapon: Math.max(10 - Math.floor(floor / 4), 1),
            armor: Math.max(10 - Math.floor(floor / 4), 1),
            amulet: Math.min(45 + Math.floor(floor / 2), 30),
            potion: 10, // Consistent potion chance
            food: Math.max(15 - Math.floor(floor / 2), 1),
            magic: Math.min(3 + Math.floor(floor / 2), 15),
            key: Math.min(1 + Math.floor(floor / 4), 2)
        };
        
        return weights;
    }

    initializeWeaponUnlocks() {
        this.weaponUnlocks = {
            dagger: {
                common: { floor: 1, damage: 3, sprite: 'dagger_C', special: 'dualWield' },
                uncommon: { floor: 4, damage: 4, sprite: 'dagger_U', special: 'dualWield' },
                rare: { floor: 8, damage: 5, sprite: 'dagger_U', special: 'dualWield' },
                legendary: { floor: 12, damage: 6, sprite: 'dagger_U', special: 'dualWield' }
            },
            spear: {
                common: { floor: 5, damage: 4, sprite: 'spear_c', special: 'block' },
                uncommon: { floor: 9, damage: 5, sprite: 'spear_u', special: 'block' },
                rare: { floor: 13, damage: 6, sprite: 'spear_u', special: 'block' },
                legendary: { floor: 17, damage: 8, sprite: 'spear_u', special: 'block' }
            },
            sword: {
                common: { floor: 10, damage: 6, sprite: 'sword_C', special: null },
                uncommon: { floor: 14, damage: 7, sprite: 'sword_U', special: null },
                rare: { floor: 18, damage: 8, sprite: 'sword_U', special: null },
                legendary: { floor: 22, damage: 9, sprite: 'sword_U', special: null }
            },
            axe: {
                common: { floor: 15, damage: 7, sprite: 'axe_C', special: 'specialAttack' },
                uncommon: { floor: 19, damage: 9, sprite: 'axe_U', special: 'specialAttack' },
                rare: { floor: 23, damage: 11, sprite: 'axe_U', special: 'specialAttack' },
                legendary: { floor: 27, damage: 15, sprite: 'axe_U', special: 'specialAttack' }
            }
        };
    }

    initializeArmorUnlocks() {
        // REMOVED reflection property from all armor types
        this.armorUnlocks = {
            leather: {
                common: { floor: 1, protection: 2, dodgeChance: 0.1, sprite: 'leather_C' },
                uncommon: { floor: 4, protection: 4, dodgeChance: 0.15, sprite: 'leather_C' },
                rare: { floor: 8, protection: 6, dodgeChance: 0.2, sprite: 'leather_C' },
                legendary: { floor: 12, protection: 8, dodgeChance: 0.25, sprite: 'leather_C' }
            },
            chain: {
                common: { floor: 5, protection: 3, sprite: 'chain_C' },
                uncommon: { floor: 9, protection: 5, sprite: 'chain_U' },
                rare: { floor: 13, protection: 7, sprite: 'chain_U' },
                legendary: { floor: 17, protection: 10, sprite: 'chain_U' }
            },
            plate: {
                common: { floor: 10, protection: 4, sprite: 'plate_C' },
                uncommon: { floor: 14, protection: 6, sprite: 'plate_U' },
                rare: { floor: 18, protection: 8, sprite: 'plate_U' },
                legendary: { floor: 22, protection: 12, sprite: 'plate_U' }
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
                    { minFloor: 1, damage: 5, health: 6 },
                    { minFloor: 5, damage: 8, health: 10 },
                    { minFloor: 10, damage: 12, health: 14 },
                    { minFloor: 15, damage: 18, health: 24 }
                ]
            },
            spider: {
                name: 'Spider',
                sprite: 'spider_c',
                role: 'MELEE',
                minFloor: 3,
                tiers: [
                    { minFloor: 3, damage: 4, health: 5 },
                    { minFloor: 8, damage: 7, health: 9 },
                    { minFloor: 13, damage: 10, health: 13 },
                    { minFloor: 18, damage: 15, health: 22 }
                ],
                abilities: [{ type: 'poison', damage: 3, turns: 3, stackable: true }]
            },
            goblin: {
                name: 'Goblin',
                sprite: 'goblin_c',
                role: 'MELEE',
                minFloor: 4,
                tiers: [
                    { minFloor: 4, damage: 5, health: 7 },
                    { minFloor: 11, damage: 8, health: 11 },
                    { minFloor: 16, damage: 12, health: 17 },
                    { minFloor: 20, damage: 19, health: 26 }
                ],
                abilities: [{ type: 'coin_steal', chance: 0.5, amount: 1 }]
            },
            goblin_archer: {
                name: 'Goblin Archer',
                sprite: 'goblin_archer', // Note: Make sure this asset exists
                role: 'RANGED',
                minFloor: 2,
                tiers: [
                    { minFloor: 2, damage: 3, health: 4 },
                    { minFloor: 7, damage: 5, health: 7 },
                    { minFloor: 12, damage: 8, health: 11 },
                ],
                abilities: []
            },
            skeleton_archer: {
                name: 'Skeleton Archer',
                sprite: 'skeleton_archer', // Note: Make sure this asset exists
                role: 'RANGED',
                minFloor: 6,
                tiers: [
                    { minFloor: 6, damage: 4, health: 6 },
                    { minFloor: 11, damage: 7, health: 10 },
                    { minFloor: 17, damage: 11, health: 15 },
                ],
                abilities: []
            }
        };
    }

    initializeBossData() {
        this.bossData = {
            5: { // Floor 5 mini boss
                type: 'boss',
                name: 'Giant Skeleton',
                health: 36,
                attack: 9,
                sprite: 'giantSkeleton',
                abilities: [
                    { damage: 3, turns: 5 },
                    { type: 'summon', enemyType: 'skeleton', chance: 0.2 }
                ]

            },
            10: { // Floor 10 boss
                type: 'boss',
                name: 'Goblin King',
                health: 52,
                attack: 10,
                sprite: 'GoblinKingSprite',
                abilities: [
                    { damage: 5, turns: 5, stackable: true },
                    { type: 'summon', enemyType: 'goblin', chance: 0.2 }

                ]
            },
            15: { // Floor 15 boss
                type: 'boss',
                name: 'Spider Queen',
                health: 44,
                attack: 8,
                sprite: 'SpiderQween',
                abilities: [
                    { type: 'poison', damage: 5, turns: 5, stackable: true },
                    { type: 'summon', enemyType: 'spider', chance: 0.2 }
                ]
            },
            20: { // Floor 20 boss
                type: 'boss',
                name: 'Soul Eater',
                health: 60,
                attack: 12,
                sprite: 'SoulEater',
                abilities: [
                    { type: 'lifesteal', percentage: 0.3 },
                    { type: 'armor_break', amount: 2 },
                    { type: 'rage', threshold: 0.5, damageBoost: 1.5 }
                ]
            },
            25: { // Floor 25 boss
                type: 'boss',
                name: 'Lich',
                health: 75,
                attack: 15,
                sprite: 'Lich',
                abilities: [
                    { damage: 8, turns: 5, stackable: true },
                    { type: 'lifesteal', percentage: 0.5 }
                ]
            },
            30: { // Floor 30 final boss
                type: 'boss',
                name: 'Cerberus',
                health: 100,
                attack: 20,
                sprite: 'Cerberus',
                abilities: [
                    { type: 'rage', threshold: 0.3, damageBoost: 2 },
                    { type: 'armor_break', amount: 5 }
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
                    damage: 3 + floor
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
                sprite: 'amulet_regen'
            },
            {
                id: 'healingRing',
                name: 'Healing Ring',
                minFloor: 2,
                weight: 10,
                rarity: 'uncommon',
                sprite: 'amulet_healing'
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
                sprite: 'amulet_boots'
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
                id: 'goldenHammer',
                name: 'Golden Hammer',
                minFloor: 10,
                weight: 3,
                rarity: 'legendary',
                sprite: 'amulet_hammer'
            },
            {
                id: 'chronosHeart',
                name: 'Chronos Heart',
                minFloor: 5,
                weight: 5,
                rarity: 'rare',
                sprite: 'amulet_chronos'
            },
            {
                id: 'speedBoots',
                name: 'Speed Boots',
                minFloor: 4,
                weight: 6,
                rarity: 'rare',
                sprite: 'amulet_speed'
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
                weight: 30,
                rarity: 'common',
                sprite: 'Bottomless Bag'
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
                sprite: 'amulet_soul'
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
                name: 'Ring of the Bloody Harvest',
                minFloor: 10,
                weight: 4,
                rarity: 'cursed',
                sprite: 'amulet_blood'
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
            }
        ];
    }

    initializePotionData() {
        // Healing Potions with exact specifications
        this.potionTiers = [
            {
                tier: 1,
                name: 'Minor Healing Potion',
                healAmount: 20,
                cost: 5,
                minFloor: 1,
                sprite: 'potionCardCommon',
                rarity: 'common'
            },
            {
                tier: 2,
                name: 'Healing Potion',
                healAmount: 30,
                cost: 7,
                minFloor: 5,
                sprite: 'potionCardCommon',
                rarity: 'common'
            },
            {
                tier: 3,
                name: 'Strong Healing Potion',
                healAmount: 50,
                cost: 10,
                minFloor: 10,
                sprite: 'potionCardUncommon',
                rarity: 'uncommon'
            },
            {
                tier: 4,
                name: 'Greater Healing Potion',
                healAmount: 100,
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
                name: 'Berries',
                actionAmount: 10,
                cost: 2,
                minFloor: 1,
                sprite: 'berries',
                rarity: 'common'
            },
            {
                tier: 2,
                name: 'Rations',
                actionAmount: 12,
                cost: 4,
                minFloor: 3,
                sprite: 'bread',
                rarity: 'common'
            },
            {
                tier: 3,
                name: 'Hearty Meal',
                actionAmount: 14,
                cost: 7,
                minFloor: 6,
                sprite: 'bread',
                rarity: 'uncommon'
            },
            {
                tier: 4,
                name: 'Feast',
                actionAmount: 15,
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
                description: 'Restores 15 HP and 3 Action Points',
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
    
    createCardData(type, floor, isElite = false, gameState = null) {
        switch (type) {
            case 'boss':
                return this.createBossCard(floor);
            case 'enemy':
                return this.createEnemyCard(floor, isElite);
            case 'coin':
                return this.createCoinCard(floor);
            case 'crystal':
                return this.createCrystalCard(floor);
            case 'trap':
                return this.createTrapCard(floor);
            case 'weapon':
                return this.createWeaponCard(floor);
            case 'armor':
                return this.createArmorCard(floor);
            case 'amulet':
                return this.createAmuletCard(floor);
            case 'potion':
                return this.createPotionCard(floor);
            case 'food':
                return this.createFoodCard(floor);
            case 'magic':
                return this.createMagicCard(floor);
            case 'key':
                return this.createKeyCard(floor);
            default:
                return null;
        }
    }

    createBossCard(floor) {
        return this.bossData[floor] || this.bossData[10]; // Default to floor 10 boss
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

        const enemyCard = {
            type: 'enemy',
            name: enemy.name,
            health: selectedTier.health,
            attack: selectedTier.damage,
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
    // This method is no longer needed as role assignment is handled in cardSystem.js
    /*
    createEnemyWithPreferredRole(floor, isElite = false, preferredRole = null) {
        // ... implementation ...
    }
    */

    createCoinCard(floor) {
        return {
            type: 'coin',
            amount: 5 + Math.floor(Math.random() * 10) + floor,
            name: 'Coins',
            sprite: 'coin'
        };
    }

    createCrystalCard(floor) {
        return {
            type: 'crystal',
            amount: 1 + Math.floor(Math.random() * 2),
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

    createWeaponCard(floor) {
        const availableWeapons = [];

        Object.entries(this.weaponUnlocks).forEach(([weaponType, rarities]) => {
            Object.entries(rarities).forEach(([rarity, data]) => {
                if (floor >= data.floor) {
                    availableWeapons.push({
                        type: weaponType,
                        rarity: rarity,
                        ...data
                    });
                }
            });
        });

        if (availableWeapons.length === 0) {
            return {
                type: 'weapon',
                name: 'Makeshift Weapon',
                damage: 2,
                rarity: 'common',
                sprite: 'dagger_C',
                special: null,
                durability: 3,
                maxDurability: 3
            };
        }

        const selected = availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
        const rarityName = selected.rarity.charAt(0).toUpperCase() + selected.rarity.slice(1);
        const weaponName = selected.type.charAt(0).toUpperCase() + selected.type.slice(1);

        const durabilityMap = {
            dagger: { common: 4, uncommon: 5, rare: 6, legendary: 7 },
            spear: { common: 5, uncommon: 6, rare: 7, legendary: 8 },
            sword: { common: 6, uncommon: 8, rare: 10, legendary: 13 },
            axe: { common: 3, uncommon: 4, rare: 5, legendary: 7 }
        };

        const baseDurability = durabilityMap[selected.type][selected.rarity] || 5;

        return {
            type: 'weapon',
            name: `${rarityName} ${weaponName}`,
            damage: selected.damage,
            rarity: selected.rarity,
            sprite: selected.sprite,
            special: selected.special,
            durability: 20,
            maxDurability: 20
        };
    }

    createArmorCard(floor) {
        const availableArmors = [];

        Object.entries(this.armorUnlocks).forEach(([armorType, rarities]) => {
            Object.entries(rarities).forEach(([rarity, data]) => {
                if (floor >= data.floor) {
                    availableArmors.push({
                        type: armorType,
                        rarity: rarity,
                        ...data
                    });
                }
            });
        });

        if (availableArmors.length === 0) {
            return {
                type: 'armor',
                name: 'Makeshift Armor',
                protection: 1,
                rarity: 'common',
                sprite: 'leather_C',
                durability: 15,
                maxDurability: 15
            };
        }

        const selected = availableArmors[Math.floor(Math.random() * availableArmors.length)];
        const rarityName = selected.rarity.charAt(0).toUpperCase() + selected.rarity.slice(1);
        const armorName = selected.type.charAt(0).toUpperCase() + selected.type.slice(1);

        const durabilityBonus = {
            uncommon: 5,
            rare: 10,
            legendary: 15
        };

        const baseDurability = 20 + (durabilityBonus[selected.rarity] || 0);

        // REMOVED reflection property from armor creation
        return {
            type: 'armor',
            name: `${rarityName} ${armorName} Armor`,
            protection: selected.protection,
            dodgeChance: selected.dodgeChance,
            rarity: selected.rarity,
            sprite: selected.sprite,
            durability: 25,
            maxDurability: 25
        };
    }

    createAmuletCard(floor) {
        // Get available amulets for current floor
        const availableAmulets = this.amuletTypes.filter(amulet => floor >= amulet.minFloor);
        
        if (availableAmulets.length === 0) {
            // Fallback to first amulet if none available
            const chosen = this.amuletTypes[0];
            return {
                type: 'amulet',
                id: chosen.id,
                name: chosen.name,
                rarity: chosen.rarity,
                sprite: chosen.sprite
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
                    sprite: amulet.sprite
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
            sprite: chosen.sprite
        };
    }

    createPotionCard(floor) {
        // Get available potion tiers for current floor
        const availablePotions = this.potionTiers.filter(potion => floor >= potion.minFloor);
        
        if (availablePotions.length === 0) {
            // Fallback - should not happen if configured correctly
            return {
                type: 'potion',
                name: 'Minor Healing Potion',
                healAmount: 20,
                sprite: 'potionCardCommon',
                rarity: 'common',
                cost: 5
            };
        }
        
        // Select the highest tier available (most recent unlock)
        const selectedPotion = availablePotions[availablePotions.length - 1];
        
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
        // Get available food tiers for current floor
        const availableFoods = this.foodTiers.filter(food => floor >= food.minFloor);
        
        if (availableFoods.length === 0) {
            // Fallback - should not happen if configured correctly
            return {
                type: 'food',
                name: 'Bread',
                actionAmount: 2,
                sprite: 'bread',
                rarity: 'common',
                cost: 2
            };
        }
        
        // Select the highest tier available (most recent unlock)
        const selectedFood = availableFoods[availableFoods.length - 1];
        
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
    
    createKeyCard(floor) {
        return {
            type: 'key',
            name: 'Mysterious Key',
            sprite: 'keyCard',
            rarity: 'rare'
        };
    }
}
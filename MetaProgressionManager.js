// MetaProgressionManager.js

export class MetaProgressionManager {
    constructor(scene) {
        this.scene = scene;
        this.loadMetaProgression();
    }
    
    // Load saved meta progression data
    loadMetaProgression() {
        const saved = localStorage.getItem('metaProgression');
        if (saved) {
            const data = JSON.parse(saved);
            this.unlockedRelics = data.unlockedRelics || [];
            this.totalDeaths = data.totalDeaths || 0;
            this.bestFloor = data.bestFloor || 1;
            this.enemyKillStats = data.enemyKillStats || {};
        } else {
            this.unlockedRelics = [];
            this.totalDeaths = 0;
            this.bestFloor = 1;
            this.enemyKillStats = {};
        }
    }
    
    // Save meta progression data
    saveMetaProgression() {
        const data = {
            unlockedRelics: this.unlockedRelics,
            totalDeaths: this.totalDeaths,
            bestFloor: this.bestFloor,
            enemyKillStats: this.enemyKillStats
        };
        localStorage.setItem('metaProgression', JSON.stringify(data));
    }
    
    // Define all possible relics and their effects
    getRelicDefinitions() {
        return {
            // Spider relics
            spiderVenom: {
                id: 'spiderVenom',
                name: 'Spider Venom',
                description: 'Weapons have 20% chance to poison enemies',
                icon: 'relic_spider',
                iconSheet: 'relicsOthers',
                iconFrame: 11,
                killedBy: 'spider',
                effect: {
                    weaponPoisonChance: 0.2,
                    poisonDamage: 2,
                    poisonTurns: 3
                }
            },
            
            webWeaver: {
                id: 'webWeaver',
                name: 'Echo Stone',
                description: '10% chance a merged card respawns face-down on the board',
                icon: 'relic_web',
                iconSheet: 'relicsOthers',
                iconFrame: 12,
                killedBy: 'spider',
                tier: 2,
                effect: {
                    mergeRespawnChance: 0.10
                }
            },
            
            // Skeleton relics
            boneArmor: {
                id: 'boneArmor',
                name: 'Bone Armor',
                description: 'Start each run with bone armor',
                icon: 'relic_bone',
                iconSheet: 'relicsOthers',
                iconFrame: 13,
                killedBy: 'skeleton',
                effect: {
                    startingArmor: 2
                }
            },
            
            undeadResilience: {
                id: 'undeadResilience',
                name: 'Healing Pact',
                description: 'Heal 2 HP at the start of every floor',
                icon: 'relic_skull',
                iconSheet: 'relicsOthers',
                iconFrame: 14,
                killedBy: 'skeleton',
                effect: {
                    // Tuned 4 → 2 after the spear-bypass fix dropped the
                    // overall difficulty more than expected. 2 HP/floor still
                    // adds up to ~90 HP over a full run but you feel late-floor
                    // damage again instead of trivially regenerating it.
                    healPerFloor: 2
                }
            },

            // Goblin relics
            greedyPockets: {
                id: 'greedyPockets',
                name: 'Lucky Strike',
                description: 'First attack each floor deals double damage',
                icon: 'relic_coin_pouch',
                iconSheet: 'relicsOthers',
                iconFrame: 15,
                killedBy: 'goblin',
                effect: {
                    firstAttackDoubleDamage: true
                }
            },
            
            scavenger: {
                id: 'scavenger',
                name: 'Scavenger',
                description: '+20% coins from all sources',
                icon: 'relic_goblin',
                iconSheet: 'relicsOthers',
                iconFrame: 16,
                killedBy: 'goblin',
                effect: {
                    coinMultiplier: 1.2
                }
            },
            
            // Boss relics (more powerful)
            giantStrength: {
                id: 'giantStrength',
                name: "Giant's Strength",
                description: 'All weapons deal +1 damage',
                icon: 'relic_giant',
                iconSheet: 'relicsOthers',
                iconFrame: 17,
                killedBy: 'Giant Skeleton',
                boss: true,
                effect: {
                    weaponDamageBonus: 1
                }
            },
            
            queenBlessing: {
                id: 'queenBlessing',
                name: "Queen's Blessing",
                description: 'Immune to poison',
                icon: 'relic_crown',
                iconSheet: 'relicsOthers',
                iconFrame: 18,
                killedBy: 'Spider Queen',
                boss: true,
                effect: {
                    poisonImmunity: true
                }
            },
            
            lichCurse: {
                id: 'lichCurse',
                name: "Lich's Curse",
                description: 'Heal 1 HP per enemy killed, -10 max HP',
                icon: 'relic_lich',
                iconSheet: 'relicsOthers',
                iconFrame: 19,
                killedBy: 'Lich',
                boss: true,
                cursed: true,
                effect: {
                    lifestealOnKill: 1,
                    maxHPPenalty: -10
                }
            },
            
            // General progression relics
            veteranExplorer: {
                id: 'veteranExplorer',
                name: "Adventurer's Pack",
                description: '+1 permanent inventory slot',
                icon: 'relic_boots',
                iconSheet: 'relicsOthers',
                iconFrame: 20,
                unlockCondition: 'deaths_5',
                effect: {
                    bonusInventorySlot: 1
                }
            },

            tent: {
                id: 'tent',
                name: 'Tent',
                description: '+1 max HP whenever a durability card is fully used',
                icon: 'relic_tent',
                iconSheet: 'relicsOthers',
                iconFrame: 23,
                unlockCondition: 'floor_7',
                effect: {
                    cardSpentMaxHP: 1
                }
            },

            luckyScrap: {
                id: 'luckyScrap',
                name: 'Ironhide',
                description: 'Your armor loses durability half as often (lasts about twice as long)',
                icon: 'relic_scrap',
                iconSheet: 'relicsOthers',
                iconFrame: 22,
                unlockCondition: 'deaths_3',
                effect: {
                    armorDurabilitySave: 0.5
                }
            },
            
            dungeonMaster: {
                id: 'dungeonMaster',
                name: 'Dungeon Master',
                description: 'See one extra card at start',
                icon: 'relic_eye',
                iconSheet: 'relicsOthers',
                iconFrame: 21,
                unlockCondition: 'floor_10',
                effect: {
                    revealExtraCard: 1
                }
            }
        };
    }
    
    // Handle player death and grant appropriate relic
    handlePlayerDeath(killedBy, floor) {
        this.totalDeaths++;
        
        if (floor > this.bestFloor) {
            this.bestFloor = floor;
        }
        
        // Track enemy kill stats
        this.enemyKillStats[killedBy] = (this.enemyKillStats[killedBy] || 0) + 1;
        
        // Determine which relic to grant
        const newRelic = this.determineRelicReward(killedBy);
        
        if (newRelic && !this.hasRelic(newRelic.id)) {
            this.unlockRelic(newRelic.id);
            this.saveMetaProgression();
            return newRelic;
        }
        
        // Check for milestone relics
        const milestoneRelic = this.checkMilestoneUnlocks();
        if (milestoneRelic) {
            this.unlockRelic(milestoneRelic.id);
            this.saveMetaProgression();
            return milestoneRelic;
        }
        
        this.saveMetaProgression();
        return null;
    }
    
    // Determine which relic to grant based on death
    determineRelicReward(killedBy) {
        const relics = this.getRelicDefinitions();
        
        // Find relics that match the killer
        const matchingRelics = Object.values(relics).filter(relic => {
            // For regular enemies, match by type
            if (killedBy.toLowerCase().includes('spider')) {
                return relic.killedBy === 'spider' && !this.hasRelic(relic.id);
            }
            if (killedBy.toLowerCase().includes('skeleton')) {
                return relic.killedBy === 'skeleton' && !this.hasRelic(relic.id);
            }
            if (killedBy.toLowerCase().includes('goblin')) {
                return relic.killedBy === 'goblin' && !this.hasRelic(relic.id);
            }
            
            // For bosses, match exact name
            return relic.killedBy === killedBy && !this.hasRelic(relic.id);
        });
        
        // Return the first unowned matching relic
        return matchingRelics[0] || null;
    }
    
    // Check for milestone-based unlocks
    checkMilestoneUnlocks() {
        const relics = this.getRelicDefinitions();
        
        // Check death count milestones
        if (this.totalDeaths >= 3 && !this.hasRelic('luckyScrap')) {
            return relics.luckyScrap;
        }

        if (this.totalDeaths >= 5 && !this.hasRelic('veteranExplorer')) {
            return relics.veteranExplorer;
        }
        
        // Check floor milestones
        if (this.bestFloor >= 7 && !this.hasRelic('tent')) {
            return relics.tent;
        }

        if (this.bestFloor >= 10 && !this.hasRelic('dungeonMaster')) {
            return relics.dungeonMaster;
        }
        
        return null;
    }
    
    // Check if player has a specific relic
    hasRelic(relicId) {
        return this.unlockedRelics.includes(relicId);
    }
    
    // Unlock a new relic
    unlockRelic(relicId) {
        if (!this.hasRelic(relicId)) {
            this.unlockedRelics.push(relicId);
        }
    }
    
    // Apply all relic effects at the start of a run
    applyRelicEffects(gameState, applyStartingBonuses = true) {
        const relics = this.getRelicDefinitions();
        gameState.relicEffects = {};
        
        this.unlockedRelics.forEach(relicId => {
            const relic = relics[relicId];
            if (!relic || !relic.effect) return;
            
            const effect = relic.effect;
            
            // Apply starting bonuses
            if (applyStartingBonuses && effect.bonusStartingHP) {
                gameState.maxHealth += effect.bonusStartingHP;
                gameState.playerHealth += effect.bonusStartingHP;
            }
            
            if (applyStartingBonuses && effect.maxHPPenalty) {
                gameState.maxHealth += effect.maxHPPenalty; // Negative value
                gameState.playerHealth = Math.min(gameState.playerHealth, gameState.maxHealth);
            }
            
            if (applyStartingBonuses && effect.startingCoins) {
                gameState.coins += effect.startingCoins;
            }
            
            if (applyStartingBonuses && effect.bonusStartingAP) {
                gameState.actionsLeft += effect.bonusStartingAP;
                gameState.maxActions += effect.bonusStartingAP;
            }
            
            // Adventurer's Pack: permanent +1 inventory slot at run start.
            // Pads gameState.inventory to match so InventorySystem doesn't shrink
            // back to 5 slots when it later syncs to gameState.inventory.
            if (applyStartingBonuses && effect.bonusInventorySlot) {
                gameState.bonusInventorySlots = (gameState.bonusInventorySlots || 0) + effect.bonusInventorySlot;
                if (Array.isArray(gameState.inventory)) {
                    for (let i = 0; i < effect.bonusInventorySlot; i++) gameState.inventory.push(null);
                }
            }

            if (applyStartingBonuses && effect.startingArmor && !gameState.equippedArmor) {
                gameState.equippedArmor = {
                    type: 'armor',
                    name: 'Common Bone Armor',
                    armorType: 'bone',
                    protection: effect.startingArmor,
                    rarity: 'common',
                    sprite: 'boneArmor_U',
                    durability: 15,
                    maxDurability: 15
                };
            }
            
            // Copy all effects for runtime checks
            Object.assign(gameState.relicEffects, effect);
        });
    }
    
    // Get list of all unlocked relics for display
    getUnlockedRelics() {
        const relics = this.getRelicDefinitions();
        return this.unlockedRelics.map(id => relics[id]).filter(r => r);
    }
    
    // Reset meta progression (for testing or new game+)
    resetProgression() {
        this.unlockedRelics = [];
        this.totalDeaths = 0;
        this.bestFloor = 1;
        this.enemyKillStats = {};
        this.saveMetaProgression();
    }
}

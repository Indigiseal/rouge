// MetaProgressionManager.js

import { getRelicAtlasPresentation } from './utils/RelicsOthersAtlas.js';

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
                ...getRelicAtlasPresentation('spiderVenom'),
                description: 'Weapons have 20% chance to poison enemies',
                killedBy: 'spider',
                effect: {
                    weaponPoisonChance: 0.2,
                    poisonDamage: 2,
                    poisonTurns: 3
                }
            },
            
            webWeaver: {
                id: 'webWeaver',
                ...getRelicAtlasPresentation('webWeaver'),
                description: '10% chance a merged card respawns face-down on the board',
                killedBy: 'spider',
                tier: 2,
                effect: {
                    mergeRespawnChance: 0.10
                }
            },
            
            // Skeleton relics
            boneArmor: {
                id: 'boneArmor',
                ...getRelicAtlasPresentation('boneArmor'),
                description: 'Start each run with bone armor',
                killedBy: 'skeleton',
                effect: {
                    startingArmor: 2
                }
            },
            
            undeadResilience: {
                id: 'undeadResilience',
                ...getRelicAtlasPresentation('undeadResilience'),
                description: 'Heal 2 HP at the start of every floor',
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
                ...getRelicAtlasPresentation('greedyPockets'),
                description: 'First attack each floor deals double damage',
                killedBy: 'goblin',
                effect: {
                    firstAttackDoubleDamage: true
                }
            },
            
            scavenger: {
                id: 'scavenger',
                ...getRelicAtlasPresentation('scavenger'),
                description: '+20% coins from all sources',
                killedBy: 'goblin',
                effect: {
                    coinMultiplier: 1.2
                }
            },
            
            // Boss relics (more powerful)
            giantStrength: {
                id: 'giantStrength',
                ...getRelicAtlasPresentation('giantStrength'),
                description: 'All weapons deal +1 damage',
                killedBy: 'Giant Skeleton',
                boss: true,
                effect: {
                    weaponDamageBonus: 1
                }
            },
            
            queenBlessing: {
                id: 'queenBlessing',
                ...getRelicAtlasPresentation('queenBlessing'),
                description: 'Immune to poison',
                killedBy: 'Spider Queen',
                boss: true,
                effect: {
                    poisonImmunity: true
                }
            },
            
            lichCurse: {
                id: 'lichCurse',
                ...getRelicAtlasPresentation('lichCurse'),
                description: 'Heal 1 HP per enemy killed, -10 max HP',
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
                ...getRelicAtlasPresentation('veteranExplorer'),
                description: '+1 permanent inventory slot',
                unlockCondition: 'deaths_5',
                effect: {
                    bonusInventorySlot: 1
                }
            },

            tent: {
                id: 'tent',
                ...getRelicAtlasPresentation('tent'),
                description: '+1 max HP whenever a durability card is fully used',
                unlockCondition: 'floor_7',
                effect: {
                    cardSpentMaxHP: 1
                }
            },

            luckyScrap: {
                id: 'luckyScrap',
                ...getRelicAtlasPresentation('luckyScrap'),
                description: 'Your armor loses durability half as often (lasts about twice as long)',
                unlockCondition: 'deaths_3',
                effect: {
                    armorDurabilitySave: 0.5
                }
            },
            
            dungeonMaster: {
                id: 'dungeonMaster',
                ...getRelicAtlasPresentation('dungeonMaster'),
                description: 'See one extra card at start',
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
            
            // Veteran's Carryall: permanent +1 inventory slot at run start.
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

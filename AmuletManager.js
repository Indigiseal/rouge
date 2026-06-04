import { getAmuletAtlasPresentation } from './utils/RelicsOthersAtlas.js';

export class AmuletManager {
    constructor(scene) {
        this.scene = scene;
        this.gameState = scene.gameState;
        
        // Define all amulets and their effects
        this.amuletDefinitions = {
            // REGULAR AMULETS
            regeneration: {
                ...getAmuletAtlasPresentation('regeneration'),
                description: 'Restores 1 HP per stack at end of each floor',
                rarity: 'uncommon',
                stackable: true,
                maxLevel: Infinity,
                onFloorEnd: (level) => {
                    const healAmount = level;
                    this.gameState.playerHealth = Math.min(
                        this.gameState.maxHealth,
                        this.gameState.playerHealth + healAmount
                    );
                    this.scene.createFloatingText(
                        this.scene.playerAvatar.x,
                        this.scene.playerAvatar.y,
                        `+${healAmount} HP (Regen)`,
                        0x00ff00
                    );
                }
            },
            
            healingRing: {
                ...getAmuletAtlasPresentation('healingRing'),
                description: 'Potions heal 20% more',
                rarity: 'uncommon',
                modifyPotionHealing: (amount) => Math.floor(amount * 1.2)
            },
            
            invulnerability: {
                ...getAmuletAtlasPresentation('invulnerability'),
                description: 'Prevents death once per run',
                rarity: 'legendary',
                usesPerRun: 1,
                onLethalDamage: () => {
                    if (this.getAmuletData('invulnerability').usesLeft > 0) {
                        this.getAmuletData('invulnerability').usesLeft--;
                        this.scene.createFloatingText(
                            this.scene.playerAvatar.x,
                            this.scene.playerAvatar.y,
                            'INVULNERABLE!',
                            0xffd700
                        );
                        return true; // Prevent death
                    }
                    return false;
                }
            },
            
            evasionBoots: {
                ...getAmuletAtlasPresentation('evasionBoots'),
                description: '10% dodge chance',
                rarity: 'uncommon',
                dodgeChance: 0.1
            },
            
            dragonClaw: {
                ...getAmuletAtlasPresentation('dragonClaw'),
                description: '+1 weapon damage',
                rarity: 'rare',
                modifyWeaponDamage: (damage) => damage + 1
            },
            
            greedPouch: {
                ...getAmuletAtlasPresentation('greedPouch'),
                description: '+30% gold found',
                rarity: 'uncommon',
                modifyGoldFound: (amount) => Math.floor(amount * 1.3)
            },
            
            golemHeart: {
                ...getAmuletAtlasPresentation('golemHeart'),
                description: '+5 max health',
                rarity: 'uncommon',
                onEquip: function() {
                    this.gameState.maxHealth += 5;
                    this.gameState.playerHealth += 5;
                }
            },
            
            chronosHeart: {
                ...getAmuletAtlasPresentation('chronosHeart'),
                description: '+3 max action points',
                rarity: 'rare',
                onEquip: function() {
                    this.gameState.maxActions += 3;
                }
            },
            
            speedBoots: {
                ...getAmuletAtlasPresentation('speedBoots'),
                description: '15% chance for free actions',
                rarity: 'rare',
                freeActionChance: 0.15
            },
            
            abyssHourglass: {
                ...getAmuletAtlasPresentation('abyssHourglass'),
                description: '+2 AP after completing floor',
                rarity: 'uncommon',
                onFloorEnd: () => {
                    this.gameState.actionsLeft = Math.min(
                        this.gameState.maxActions,
                        this.gameState.actionsLeft + 1
                    );
                    this.scene.createFloatingText(
                        this.scene.playerAvatar.x,
                        this.scene.playerAvatar.y,
                        '+1 AP (Moonwell)',
                        0x00ffff
                    );
                }
            },
            
            temperedSteel: {
                ...getAmuletAtlasPresentation('temperedSteel'),
                description: 'Weapons lose half durability',
                rarity: 'rare',
                weaponDurabilityRate: 0.5
            },
            
            bottomlessBag: {
                ...getAmuletAtlasPresentation('bottomlessBag'),
                description: '+2 inventory slots',
                rarity: 'common',
                onEquip: function() {
                    // expandInventory grows the slots array AND bumps
                    // bonusInventorySlots, so don't increment it again here.
                    if (this.scene.inventorySystem) {
                        this.scene.inventorySystem.expandInventory(2);
                    } else {
                        this.gameState.bonusInventorySlots = (this.gameState.bonusInventorySlots || 0) + 2;
                    }
                }
            },
            
            travelKitchen: {
                ...getAmuletAtlasPresentation('travelKitchen'),
                description: 'Food restores 50% more AP',
                rarity: 'uncommon',
                modifyFoodAP: (amount) => Math.floor(amount * 1.5)
            },
            
            // CURSED AMULETS (with debuffs)
            hungryDagger: {
                ...getAmuletAtlasPresentation('hungryDagger'),
                description: 'Instant kill at 1 HP, but heals enemies otherwise',
                rarity: 'cursed',
                cursed: true,
                onEnemyDamage: (enemy, damage) => {
                    const newHealth = enemy.health - damage;
                    if (newHealth === 1) {
                        enemy.health = 0; // Instant kill
                        this.scene.createFloatingText(
                            enemy.sprite.x,
                            enemy.sprite.y,
                            'EXECUTED!',
                            0xff0000
                        );
                    } else if (newHealth > 1) {
                        enemy.health = newHealth + 1; // Heal enemy
                        this.scene.createFloatingText(
                            enemy.sprite.x,
                            enemy.sprite.y,
                            '+1 HP',
                            0x00ff00
                        );
                    }
                }
            },
            
            bloodyHarvest: {
                ...getAmuletAtlasPresentation('bloodyHarvest'),
                description: '+3 HP per kill, -30% max health',
                rarity: 'cursed',
                cursed: true,
                onEquip: function() {
                    this.gameState.maxHealth = Math.floor(this.gameState.maxHealth * 0.7);
                    this.gameState.playerHealth = Math.min(
                        this.gameState.playerHealth,
                        this.gameState.maxHealth
                    );
                },
                onEnemyKill: () => {
                    const healAmount = 3;
                    this.gameState.playerHealth = Math.min(
                        this.gameState.maxHealth,
                        this.gameState.playerHealth + healAmount
                    );
                    this.scene.createFloatingText(
                        this.scene.playerAvatar.x,
                        this.scene.playerAvatar.y,
                        `+${healAmount} HP (Blood)`,
                        0xff0000
                    );
                }
            },
            
            vampiricRing: {
                ...getAmuletAtlasPresentation('vampiricRing'),
                description: 'Heal 2 HP per enemy kill',
                rarity: 'uncommon',
                onEnemyKill: () => {
                    const healAmount = 2;
                    this.gameState.playerHealth = Math.min(
                        this.gameState.maxHealth,
                        this.gameState.playerHealth + healAmount
                    );
                    this.scene.createFloatingText(
                        this.scene.playerAvatar.x,
                        this.scene.playerAvatar.y,
                        `+${healAmount} HP (Vampiric)`,
                        0x8b0000
                    );
                }
            },
            
            soulHarvester: {
                ...getAmuletAtlasPresentation('soulHarvester'),
                description: 'Heal 1 HP per kill, +3 AP every 3 kills',
                rarity: 'rare',
                killCount: 0,
                onEnemyKill: () => {
                    // Heal 1 HP
                    this.gameState.playerHealth = Math.min(
                        this.gameState.maxHealth,
                        this.gameState.playerHealth + 1
                    );
                    
                    // Track kills for AP bonus
                    const amuletData = this.getAmuletData('soulHarvester');
                    if (amuletData) {
                        amuletData.killCount = (amuletData.killCount || 0) + 1;
                        
                        if (amuletData.killCount >= 3) {
                            amuletData.killCount = 0;
                            this.gameState.actionsLeft = Math.min(
                                this.gameState.maxActions,
                                this.gameState.actionsLeft + 1
                            );
                            this.scene.createFloatingText(
                                this.scene.playerAvatar.x,
                                this.scene.playerAvatar.y - 20,
                                '+1 AP (Soul)',
                                0x9932cc
                            );
                        }
                    }
                    
                    this.scene.createFloatingText(
                        this.scene.playerAvatar.x,
                        this.scene.playerAvatar.y,
                        '+1 HP (Soul)',
                        0x9932cc
                    );
                }
            },
            
            eternalRage: {
                ...getAmuletAtlasPresentation('eternalRage'),
                description: '+20% damage below 30% HP, +10% damage taken',
                rarity: 'cursed',
                cursed: true,
                modifyWeaponDamage: (damage) => {
                    const healthPercent = this.gameState.playerHealth / this.gameState.maxHealth;
                    return healthPercent < 0.3 ? Math.floor(damage * 1.2) : damage;
                },
                modifyDamageTaken: (damage) => Math.floor(damage * 1.1)
            },
            
            berserkerBelt: {
                ...getAmuletAtlasPresentation('berserkerBelt'),
                description: '+50% damage below 50% HP, cannot heal above 50%',
                rarity: 'cursed',
                cursed: true,
                modifyWeaponDamage: (damage) => {
                    const healthPercent = this.gameState.playerHealth / this.gameState.maxHealth;
                    return healthPercent < 0.5 ? Math.floor(damage * 1.5) : damage;
                },
                maxHealthCap: 0.5 // Can't heal above 50%
            },

            // Exploration and utility amulets
            diviners_spade: {
                ...getAmuletAtlasPresentation('diviners_spade'),
                description: '+5 max action points',
                rarity: 'uncommon',
                onEquip: function() {
                    // Permanent +5 AP: raises both the cap and the current pool so
                    // the player feels the boost immediately on pickup.
                    this.gameState.maxActions = (this.gameState.maxActions || 0) + 5;
                    this.gameState.actionsLeft = (this.gameState.actionsLeft || 0) + 5;
                    this.scene.updateActionPointUI?.();
                    this.scene.updateUI?.();
                }
            },

            wayfinder: {
                ...getAmuletAtlasPresentation('wayfinder'),
                description: 'Reveals one extra non-enemy card at the start of each floor',
                rarity: 'rare',
                extraStartNonEnemyReveals: 1
            },

            skeletonKey: {
                ...getAmuletAtlasPresentation('skeletonKey'),
                description: 'Treasure chests open without needing a key card',
                rarity: 'rare',
                bypassChestKey: true
            },

            greasewingFeast: {
                ...getAmuletAtlasPresentation('greasewingFeast'),
                description: 'One card per floor becomes food (except boss rooms)',
                rarity: 'uncommon',
                convertOneCardToFood: true
            },

            sunstone: {
                ...getAmuletAtlasPresentation('sunstone'),
                description: '+1 Max HP for every card left behind when the floor clears',
                rarity: 'rare',
                onFloorEnd: () => {
                    // Count any card still on the board — revealed or not.
                    // Reward the player for leaving stuff behind with a PERMANENT
                    // max-HP boost (current HP rises with it, like Stoneheart Medallion).
                    const remaining = this.scene.cardSystem?.boardCards?.filter(c => c).length || 0;
                    if (remaining > 0) {
                        this.gameState.maxHealth += remaining;
                        this.gameState.playerHealth += remaining;
                        this.scene.createFloatingText(
                            this.scene.playerAvatar.x,
                            this.scene.playerAvatar.y,
                            `+${remaining} Max HP (Sunstone)`,
                            0xffe066
                        );
                        // Refresh the HP bar immediately so the boost is visible
                        // (otherwise it only shows once the next floor renders).
                        this.scene.updateUI?.();
                    }
                }
            },

            merchantPact: {
                ...getAmuletAtlasPresentation('merchantPact'),
                description: '+1 bonus item slot in shops with better quality',
                rarity: 'rare',
                bonusShopSlots: 1
            },

            // Rare utility amulets
            watchersLamp: {
                ...getAmuletAtlasPresentation('watchersLamp'),
                description: 'Briefly reveals one trap at floor start — memorize it!',
                rarity: 'rare',
                previewOneTrap: true
            },

            reapersMask: {
                ...getAmuletAtlasPresentation('reapersMask'),
                description: '15% chance an enemy leaves a random card behind on death',
                rarity: 'rare',
                deathDropChance: 0.15
            },

            travelersJournal: {
                ...getAmuletAtlasPresentation('travelersJournal'),
                description: '+2 max HP for each unique amulet you carry',
                rarity: 'rare',
                onEquip: function() {
                    this.recalculateJournalBonus();
                }
            },

            charmingTune: {
                ...getAmuletAtlasPresentation('charmingTune'),
                description: 'First melee enemy on each floor skips its first attack',
                rarity: 'uncommon',
                charmingTune: true
            },

            wayfarersMap: {
                ...getAmuletAtlasPresentation('wayfarersMap'),
                description: '+1 max AP every other floor (max +15)',
                rarity: 'rare',
                onFloorEnd: () => {
                    if (!this.gameState.mapBonusAP) this.gameState.mapBonusAP = 0;
                    if (!this.gameState.mapFloorCount) this.gameState.mapFloorCount = 0;
                    this.gameState.mapFloorCount++;
                    if (this.gameState.mapFloorCount % 2 === 0 && this.gameState.mapBonusAP < 15) {
                        this.gameState.maxActions++;
                        this.gameState.mapBonusAP++;
                        this.scene.createFloatingText(
                            this.scene.playerAvatar.x,
                            this.scene.playerAvatar.y - 14,
                            '+1 Max AP (Map)',
                            0x66ddff
                        );
                    }
                }
            },

            sirensPendant: {
                ...getAmuletAtlasPresentation('sirensPendant'),
                description: '15% chance enemies attack their own kind instead of you',
                rarity: 'rare',
                charmChance: 0.15
            }
        };
    }
    
    // Check if player has a specific amulet
    hasAmulet(amuletId) {
        return this.gameState.activeAmulets.some(a => a.id === amuletId);
    }
    
    // Get amulet data (for tracking uses, etc.)
    getAmuletData(amuletId) {
        return this.gameState.activeAmulets.find(a => a.id === amuletId);
    }
    
    // Add an amulet to the player
    addAmulet(amuletId) {
        const definition = this.amuletDefinitions[amuletId];
        if (!definition) return false;
        
        // Check if stackable or already owned
        if (this.hasAmulet(amuletId) && !definition.stackable) {
            this.scene.createFloatingText(320, 180, 'Already owned!', 0xff0000);
            return false;
        }
        
        const amuletData = {
            id: amuletId,
            name: definition.name,
            sprite: definition.sprite,
            spriteFrame: definition.spriteFrame ?? 0,
            level: 1,
            usesLeft: definition.usesPerRun || 0
        };
        
        // Initialize special tracking properties for specific amulets
        if (amuletId === 'soulHarvester') {
            amuletData.killCount = 0;
        }
        
        // Handle stacking
        if (definition.stackable && this.hasAmulet(amuletId)) {
            const existing = this.getAmuletData(amuletId);
            if (existing.level < definition.maxLevel) {
                existing.level++;
                this.scene.createFloatingText(320, 180, `${definition.name} upgraded!`, 0x00ff00);
            } else {
                this.scene.createFloatingText(320, 180, 'Max level reached!', 0xffa500);
                return false;
            }
        } else {
            this.gameState.activeAmulets.push(amuletData);
            
            // Run onEquip effect if it exists
            if (definition.onEquip) {
                definition.onEquip.call(this);
            }
        }
        
        // Refresh Traveler's Journal bonus after any new amulet
        this.recalculateJournalBonus();

        this.scene.updateUI();
        return true;
    }

    // Process end of floor effects
    processFloorEnd() {
        this.gameState.activeAmulets.forEach(amulet => {
            const definition = this.amuletDefinitions[amulet.id];
            if (definition && definition.onFloorEnd) {
                definition.onFloorEnd(amulet.level || 1);
            }
        });
    }
    
    // Modify potion healing
    modifyPotionHealing(baseAmount) {
        let amount = baseAmount;
        this.gameState.activeAmulets.forEach(amulet => {
            const definition = this.amuletDefinitions[amulet.id];
            if (definition && definition.modifyPotionHealing) {
                amount = definition.modifyPotionHealing(amount);
            }
        });
        return amount;
    }
    
    // Modify weapon damage
    modifyWeaponDamage(baseDamage) {
        let damage = baseDamage;
        this.gameState.activeAmulets.forEach(amulet => {
            const definition = this.amuletDefinitions[amulet.id];
            if (definition && definition.modifyWeaponDamage) {
                damage = definition.modifyWeaponDamage(damage);
            }
        });
        const relicBonus = this.gameState.relicEffects?.weaponDamageBonus || 0;
        if (relicBonus) {
            damage += relicBonus;
        }
        return damage;
    }
    
    // Check dodge chance
    checkDodge() {
        let totalDodgeChance = 0;
        this.gameState.activeAmulets.forEach(amulet => {
            const definition = this.amuletDefinitions[amulet.id];
            if (definition && definition.dodgeChance) {
                totalDodgeChance += definition.dodgeChance;
            }
        });
        return Math.random() < totalDodgeChance;
    }
    
    // Modify damage taken
    modifyDamageTaken(baseDamage) {
        let damage = baseDamage;
        this.gameState.activeAmulets.forEach(amulet => {
            const definition = this.amuletDefinitions[amulet.id];
            if (definition && definition.modifyDamageTaken) {
                damage = definition.modifyDamageTaken(damage);
            }
        });
        return damage;
    }
    
    // Check for lethal damage prevention
    checkLethalPrevention() {
        for (let amulet of this.gameState.activeAmulets) {
            const definition = this.amuletDefinitions[amulet.id];
            if (definition && definition.onLethalDamage) {
                if (definition.onLethalDamage()) {
                    return true; // Prevent death
                }
            }
        }
        return false;
    }
    
    // Process enemy kill
    processEnemyKill() {
        this.gameState.activeAmulets.forEach(amulet => {
            const definition = this.amuletDefinitions[amulet.id];
            if (definition && definition.onEnemyKill) {
                definition.onEnemyKill();
            }
        });
    }
    
    // Cross-tier merging was granted by Golden Hammer, which has been removed
    // for being too powerful. Kept as a stub (always false) so existing callers
    // in inventorySystem keep working.
    canCrossTierMerge() {
        return false;
    }
    
    // Get weapon durability rate
    getWeaponDurabilityRate() {
        let rate = 1;
        this.gameState.activeAmulets.forEach(amulet => {
            const definition = this.amuletDefinitions[amulet.id];
            if (definition && definition.weaponDurabilityRate) {
                rate *= definition.weaponDurabilityRate;
            }
        });
        return rate;
    }
    
    // Modify gold found
    modifyGoldFound(baseAmount) {
        let amount = baseAmount;
        this.gameState.activeAmulets.forEach(amulet => {
            const definition = this.amuletDefinitions[amulet.id];
            if (definition && definition.modifyGoldFound) {
                amount = definition.modifyGoldFound(amount);
            }
        });
        const relicMultiplier = this.gameState.relicEffects?.coinMultiplier || 1;
        if (relicMultiplier !== 1) {
            amount = Math.floor(amount * relicMultiplier);
        }
        return amount;
    }
    
    // Modify food AP
    modifyFoodAP(baseAmount) {
        let amount = baseAmount;
        this.gameState.activeAmulets.forEach(amulet => {
            const definition = this.amuletDefinitions[amulet.id];
            if (definition && definition.modifyFoodAP) {
                amount = definition.modifyFoodAP(amount);
            }
        });
        return amount;
    }

    // Modify crystal pickup amount (Diviner's Spade)
    modifyCrystalFound(baseAmount) {
        let amount = baseAmount;
        this.gameState.activeAmulets.forEach(amulet => {
            const definition = this.amuletDefinitions[amulet.id];
            if (definition && definition.modifyCrystalFound) {
                amount = definition.modifyCrystalFound(amount);
            }
        });
        return amount;
    }

    // Sum of extraStartNonEnemyReveals from all equipped amulets (Wayfinder's Compass)
    getExtraNonEnemyReveals() {
        let total = 0;
        this.gameState.activeAmulets.forEach(amulet => {
            const definition = this.amuletDefinitions[amulet.id];
            if (definition && definition.extraStartNonEnemyReveals) {
                total += definition.extraStartNonEnemyReveals;
            }
        });
        return total;
    }

    // Sum of bonusShopSlots from all equipped amulets (Merchant's Seal)
    getBonusShopSlots() {
        let total = 0;
        this.gameState.activeAmulets.forEach(amulet => {
            const definition = this.amuletDefinitions[amulet.id];
            if (definition && definition.bonusShopSlots) {
                total += definition.bonusShopSlots;
            }
        });
        return total;
    }

    // Combined charm chance — sum from all equipped amulets (Siren's Perfume)
    getCharmChance() {
        let chance = 0;
        this.gameState.activeAmulets.forEach(amulet => {
            const definition = this.amuletDefinitions[amulet.id];
            if (definition && definition.charmChance) {
                chance += definition.charmChance;
            }
        });
        return chance;
    }

    // Combined deathDropChance — Mask of Hollow Whispers
    getDeathDropChance() {
        let chance = 0;
        this.gameState.activeAmulets.forEach(amulet => {
            const definition = this.amuletDefinitions[amulet.id];
            if (definition && definition.deathDropChance) {
                chance += definition.deathDropChance;
            }
        });
        return chance;
    }

    // Watcher's Lamp — wants one trap revealed at floor start
    wantsTrapPreview() {
        return this.gameState.activeAmulets.some(a =>
            this.amuletDefinitions[a.id]?.previewOneTrap
        );
    }

    // Lute of First Light — first melee attack per floor is no-damage
    hasCharmingTune() {
        return this.gameState.activeAmulets.some(a =>
            this.amuletDefinitions[a.id]?.charmingTune
        );
    }

    // Traveler's Journal — recompute the max HP bonus based on unique amulets.
    // Called on every addAmulet so the bonus updates when you grow your collection.
    recalculateJournalBonus() {
        const hasJournal = this.hasAmulet('travelersJournal');
        const prevBonus = this.gameState.journalBonusHP || 0;
        const newBonus = hasJournal
            ? new Set(this.gameState.activeAmulets.map(a => a.id)).size * 2
            : 0;
        const delta = newBonus - prevBonus;
        if (delta === 0) return;
        this.gameState.maxHealth = Math.max(1, this.gameState.maxHealth + delta);
        if (delta > 0) {
            this.gameState.playerHealth = Math.min(
                this.gameState.maxHealth,
                this.gameState.playerHealth + delta
            );
        } else {
            this.gameState.playerHealth = Math.min(this.gameState.maxHealth, this.gameState.playerHealth);
        }
        this.gameState.journalBonusHP = newBonus;
        if (delta > 0) {
            this.scene.createFloatingText(
                this.scene.playerAvatar.x,
                this.scene.playerAvatar.y - 14,
                `+${delta} Max HP (Journal)`,
                0x66ff88
            );
        }
    }

    // True if any equipped amulet lets you open chests without a key
    canBypassChestKey() {
        return this.gameState.activeAmulets.some(a =>
            this.amuletDefinitions[a.id]?.bypassChestKey
        );
    }

    // True if any equipped amulet wants one card per floor converted to food
    wantsFoodCardConversion() {
        return this.gameState.activeAmulets.some(a =>
            this.amuletDefinitions[a.id]?.convertOneCardToFood
        );
    }
    
    // Modify spell healing (for restoration and soul drain)
    modifySpellHealing(baseAmount) {
        let amount = baseAmount;
        this.gameState.activeAmulets.forEach(amulet => {
            const definition = this.amuletDefinitions[amulet.id];
            // Apply healing ring effects to spell healing too
            if (definition && definition.modifyPotionHealing) {
                amount = definition.modifyPotionHealing(amount);
            }
        });
        return amount;
    }
    
    // Check health cap (for berserker belt)
    getMaxHealthCap() {
        let cap = 1; // 100% by default
        this.gameState.activeAmulets.forEach(amulet => {
            const definition = this.amuletDefinitions[amulet.id];
            if (definition && definition.maxHealthCap) {
                cap = Math.min(cap, definition.maxHealthCap);
            }
        });
        return cap;
    }
    
    // Check for free action chance (Quickhand Gloves amulet)
    getFreeActionChance() {
        if (this.hasAmulet('speedBoots')) {
            return 0.15; // 15% chance for a free action with Quickhand Gloves
        }
        return 0;
    }
    
    // Initialize all equipped amulet effects (call on game start/load)
    initializeEquippedAmulets() {
        this.gameState.activeAmulets.forEach(amulet => {
            const definition = this.amuletDefinitions[amulet.id];
            if (definition && definition.onEquip) {
                definition.onEquip.call(this);
            }
        });
    }
    
    // Check if player has free first action (Quickhand Gloves)
    hasFreeFirstAction() {
        return this.hasAmulet('speedBoots') && !this.gameState.firstActionUsed;
    }
}

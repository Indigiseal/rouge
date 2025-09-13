export class AmuletManager {
    constructor(scene) {
        this.scene = scene;
        this.gameState = scene.gameState;
        
        // Define all amulets and their effects
        this.amuletDefinitions = {
            // REGULAR AMULETS
            regeneration: {
                name: 'Amulet of Regeneration',
                description: 'Restores 5 HP at end of each floor',
                rarity: 'uncommon',
                sprite: 'amulet',
                stackable: true,
                maxLevel: 2,
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
                name: 'Healing Ring',
                description: 'Potions heal 20% more',
                rarity: 'uncommon',
                sprite: 'Healing Ring',
                modifyPotionHealing: (amount) => Math.floor(amount * 1.2)
            },
            
            invulnerability: {
                name: 'Amulet of Invulnerability',
                description: 'Prevents death once per run',
                rarity: 'legendary',
                sprite: 'amulet_invuln',
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
                name: 'Boots of Evasion',
                description: '10% dodge chance',
                rarity: 'uncommon',
                sprite: 'Boots of Evasion',
                dodgeChance: 0.1
            },
            
            dragonClaw: {
                name: 'Dragon Claw',
                description: '+1 weapon damage',
                rarity: 'uncommon',
                sprite: 'dragonClaw',
                modifyWeaponDamage: (damage) => damage + 1
            },
            
            greedPouch: {
                name: 'Pouch of Greed',
                description: '+30% gold found',
                rarity: 'uncommon',
                sprite: 'amulet_pouch',
                modifyGoldFound: (amount) => Math.floor(amount * 1.3)
            },
            
            golemHeart: {
                name: "Golem's Heart",
                description: '+5 max health',
                rarity: 'uncommon',
                sprite: 'AmuletOfVigor',
                onEquip: function() {
                    this.gameState.maxHealth += 5;
                    this.gameState.playerHealth += 5;
                }
            },
            
            goldenHammer: {
                name: 'Golden Hammer',
                description: 'Merge different tier items',
                rarity: 'legendary',
                sprite: 'amulet_hammer',
                allowCrossTierMerge: true
            },
            
            chronosHeart: {
                name: 'Chronos Heart',
                description: '+3 max action points',
                rarity: 'uncommon',
                sprite: 'amulet_chronos',
                onEquip: function() {
                    this.gameState.maxActions += 3;
                }
            },
            
            speedBoots: {
                name: 'Speed Boots',
                description: '15% chance for free actions',
                rarity: 'uncommon',
                sprite: 'amulet_speed',
                freeActionChance: 0.15
            },
            
            abyssHourglass: {
                name: 'Abyss Hourglass',
                description: '+2 AP after completing floor',
                rarity: 'uncommon',
                sprite: 'amulet_hourglass',
                onFloorEnd: () => {
                    this.gameState.actionsLeft = Math.min(
                        this.gameState.maxActions,
                        this.gameState.actionsLeft + 1
                    );
                    this.scene.createFloatingText(
                        this.scene.playerAvatar.x,
                        this.scene.playerAvatar.y,
                        '+1 AP (Hourglass)',
                        0x00ffff
                    );
                }
            },
            
            temperedSteel: {
                name: 'Tempered Steel',
                description: 'Weapons lose half durability',
                rarity: 'uncommon',
                sprite: 'amulet_steel',
                weaponDurabilityRate: 0.5
            },
            
            bottomlessBag: {
                name: 'Bottomless Bag',
                description: '+2 inventory slots',
                rarity: 'uncommon',
                sprite: 'Bottomless Bag',
                onEquip: function() {
                    // Set bonus slots in game state
                    this.gameState.bonusInventorySlots = (this.gameState.bonusInventorySlots || 0) + 2;
                    
                    // Update the inventory system to show the new slots
                    if (this.scene.inventorySystem) {
                        this.scene.inventorySystem.expandInventory(2);
                    }
                }
            },
            
            travelKitchen: {
                name: 'Travel Kitchen',
                description: 'Food restores 50% more AP',
                rarity: 'uncommon',
                sprite: 'amulet_kitchen',
                modifyFoodAP: (amount) => Math.floor(amount * 1.5)
            },
            
            // CURSED AMULETS (with debuffs)
            hungryDagger: {
                name: 'Dagger of the Hungry Spirit',
                description: 'Instant kill at 1 HP, but heals enemies otherwise',
                rarity: 'cursed',
                sprite: 'amulet_hungry',
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
                name: 'Ring of the Bloody Harvest',
                description: '+3 HP per kill, -30% max health',
                rarity: 'cursed',
                sprite: 'amulet_blood',
                cursed: true,
                onEquip: function() {
                    this.gameState.maxHealth = Math.floor(this.gameState.maxHealth * 0.7);
                    this.gameState.playerHealth = Math.min(
                        this.gameState.playerHealth,
                        this.gameState.maxHealth
                    );
                },
                onEnemyKill: () => {
                    this.gameState.playerHealth = Math.min(
                        this.gameState.maxHealth,
                        this.gameState.playerHealth + 1
                    );
                    this.scene.createFloatingText(
                        this.scene.playerAvatar.x,
                        this.scene.playerAvatar.y,
                        '+1 HP (Blood)',
                        0xff0000
                    );
                }
            },
            
            vampiricRing: {
                name: 'Vampiric Ring',
                description: 'Heal 2 HP per enemy kill',
                rarity: 'uncommon',
                sprite: 'amulet_vampiric',
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
                name: 'Soul Harvester',
                description: 'Heal 1 HP per kill, +3 AP every 3 kills',
                rarity: 'rare',
                sprite: 'amulet_soul',
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
                name: 'Amulet of Eternal Rage',
                description: '+20% damage below 30% HP, +10% damage taken',
                rarity: 'cursed',
                sprite: 'amulet_rage',
                cursed: true,
                modifyWeaponDamage: (damage) => {
                    const healthPercent = this.gameState.playerHealth / this.gameState.maxHealth;
                    return healthPercent < 0.3 ? Math.floor(damage * 1.2) : damage;
                },
                modifyDamageTaken: (damage) => Math.floor(damage * 1.1)
            },
            
            berserkerBelt: {
                name: 'Berserker Belt',
                description: '+50% damage below 50% HP, cannot heal above 50%',
                rarity: 'cursed',
                sprite: 'amulet_berserker',
                cursed: true,
                modifyWeaponDamage: (damage) => {
                    const healthPercent = this.gameState.playerHealth / this.gameState.maxHealth;
                    return healthPercent < 0.5 ? Math.floor(damage * 1.5) : damage;
                },
                maxHealthCap: 0.5 // Can't heal above 50%
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
    
    // Check if cross-tier merging is allowed
    canCrossTierMerge() {
        return this.hasAmulet('goldenHammer');
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
    
    // Check for free action chance (Speed Boots amulet)
    getFreeActionChance() {
        if (this.hasAmulet('speedBoots')) {
            return 0.15; // 15% chance for free action with Speed Boots
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
    
    // Check if player has free first action (Speed Boots)
    hasFreeFirstAction() {
        return this.hasAmulet('speedBoots') && !this.gameState.firstActionUsed;
    }
}
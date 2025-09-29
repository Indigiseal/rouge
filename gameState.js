export class GameState {
    constructor(scene) {
        this.scene = scene;
        this.playerHealth = 50;
        this.maxHealth = 50;
        this.coins = 0;
        this.crystals = 0;
        this.activeAmulets = [];
        this.playerEffects = [];
        this.actionsLeft = 15;
        this.maxActions = 15;
        this.currentFloor = 1;
        this.equippedArmor = null;
        this.inventory = new Array(5).fill(null);

        // Room/route tracking
        this.roomType = 'COMBAT';
        this.roomInitialized = false;
        this.activeRoomId = 0;
        
        
        this.blockNextAttack = false;
        
        // Magic card effects
        this.shadowBlade = null;
        this.magicShield = null;
        this.boneWall = 0;
        this.mirrorShield = false;
        
        // Amulet-related properties
        this.firstActionUsed = false; // For Speed Boots
        this.bonusInventorySlots = 0; // For Bottomless Bag
        this.baseMaxHealth = 50; // Store base max health for cursed amulets
        
        // Meta progression tracking
        this.damageTracking = {
            totalDamageTaken: 0,
            damageBySource: {
                enemies: 0,
                traps: 0,
                exhaustion: 0,
                environmental: 0
            },
            enemiesKilledBy: {}, // Track what enemies killed the player
            lastDamageSource: null,
            deathCause: null,
            runStats: {
                floorsReached: 1,
                enemiesDefeated: 0,
                trapsTriggered: 0,
                coinsEarned: 0,
                crystalsEarned: 0
            }
        };
    }

    nextFloor() {
        this.currentFloor++;
        
        // Make sure inventory syncs from the actual inventory system
        const gameScene = this.scene.scene.get('GameScene');
        if (gameScene && gameScene.inventorySystem) {
            this.inventory = [...gameScene.inventorySystem.slots]; // Create a copy
        }
        
        this.blockNextAttack = false;
        this.firstActionUsed = false;
        
        if (this.scene.amuletManager) {
            this.scene.amuletManager.processFloorEnd();
        }
    }

    takeDamage(amount, enemyIndex = -1, source = 'enemy') {
        // Check for dodge (from amulets)
        if (this.scene.amuletManager && this.scene.amuletManager.checkDodge()) {
            this.scene.createFloatingText(this.scene.playerAvatar.x, this.scene.playerAvatar.y, 'Dodged!', 0x00ff00);
            return { actualDamage: 0, tookDamage: false };
        }
        
        // Modify damage taken (cursed amulets)
        if (this.scene.amuletManager) {
            amount = this.scene.amuletManager.modifyDamageTaken(amount);
        }
        
        let protection = 0;
        let reflectedDamage = 0;
        
        if (this.equippedArmor) {
            // Handle Dodge from equipped armor
            if (this.equippedArmor.dodgeChance && Math.random() < this.equippedArmor.dodgeChance) {
                this.scene.createFloatingText(this.scene.playerAvatar.x, this.scene.playerAvatar.y, 'Dodge!', 0x00ff00);
                return { actualDamage: 0, tookDamage: false };
            }
            
            // Add protection from equipped armor
            let baseProtection = this.equippedArmor.protection;
            
            // Apply magic shield bonus (20% increase)
            if (this.magicShield && this.magicShield.turns > 0) {
                baseProtection = Math.floor(baseProtection * this.magicShield.multiplier);
            }
            
            protection += baseProtection;
            
            // Handle reflection
            if (this.equippedArmor.reflection > 0 && enemyIndex !== -1) {
                reflectedDamage = Math.floor(amount * (this.equippedArmor.reflection / 100));
                
                // Reflection cannot kill bosses
                const enemyCard = this.scene.cardSystem.boardCards[enemyIndex];
                if (enemyCard && enemyCard.data.type === 'boss') {
                    const enemyHealth = enemyCard.data.health;
                    reflectedDamage = Math.min(reflectedDamage, enemyHealth - 1);
                }
                
                if (reflectedDamage > 0) {
                    const enemySprite = this.scene.cardSystem.boardCards[enemyIndex]?.sprite;
                    this.scene.cardSystem.attackEnemy(enemyIndex, reflectedDamage, true);
                    if (enemySprite) {
                        this.scene.createFloatingText(enemySprite.x, enemySprite.y - 20, `-${reflectedDamage} (Reflect)`, 0x00ffff);
                    }
                }
            }
            
            // Durability decreases on every hit
            this.equippedArmor.durability--;
            if (this.equippedArmor.durability <= 0) {
                this.scene.createFloatingText(this.scene.playerAvatar.x, this.scene.playerAvatar.y + 20, `${this.equippedArmor.name} broke!`, 0xffa500);
                this.equippedArmor = null;
                this.scene.updateUI();
            }
        }
        
        const actualDamage = Math.max(0, amount - protection);
        
        // Reduce armor durability after damage calculation
        if (this.equippedArmor && amount > 0) {
            amount = Math.max(0, amount - this.equippedArmor.protection);
            this.equippedArmor.durability -= 1;
            console.log('Armor dur now:', this.equippedArmor.durability);
            if (this.equippedArmor.durability <= 0) {
                this.equippedArmor = null;
                this.scene.createFloatingText(this.scene.playerAvatar.x, this.scene.playerAvatar.y, 'Armor Broke!', 0xff0000);
            }
        }
        
        const wouldKill = this.playerHealth - actualDamage <= 0;
        
        // Check for invulnerability amulet
        if (wouldKill && this.scene.amuletManager && this.scene.amuletManager.checkLethalPrevention()) {
            // Cancel all damage this turn
            return { actualDamage: 0, tookDamage: false };
        }
        
        this.playerHealth = Math.max(0, this.playerHealth - actualDamage);
        const tookDamage = actualDamage > 0;
        
        // Track damage for meta progression
        if (actualDamage > 0) {
            this.trackDamage(actualDamage, source, enemyIndex);
        }
        
        // Check for game over immediately after health change
        if (this.playerHealth <= 0) {
            this.setDeathCause(source, enemyIndex);
            this.scene.time.delayedCall(100, () => this.scene.gameOver());
        }
        
        return { actualDamage, tookDamage };
    }

    addPlayerEffect(effect) {
        // Prevent stacking the same effect, refresh duration instead
        const existingEffect = this.playerEffects.find(e => e.type === effect.type);
        if (existingEffect) {
            existingEffect.turns = effect.turns;
        } else {
            this.playerEffects.push(effect);
        }
    }
    
    // New method to handle healing with health cap check
    heal(amount) {
        const maxCap = this.scene.amuletManager ? 
            this.scene.amuletManager.getMaxHealthCap() : 1;
        
        const cappedMaxHealth = Math.floor(this.maxHealth * maxCap);
        this.playerHealth = Math.min(cappedMaxHealth, this.playerHealth + amount);
    }
    
    // Method to check if action should be free (Speed Boots)
    shouldUseFreeAction() {
        if (this.scene.amuletManager && this.scene.amuletManager.hasFreeFirstAction()) {
            this.firstActionUsed = true;
            return true;
        }
        return false;
    }
    
    // Meta progression tracking methods
    trackDamage(amount, source, enemyIndex = -1) {
        this.damageTracking.totalDamageTaken += amount;
        this.damageTracking.lastDamageSource = source;
        
        // Track damage by source type
        switch (source) {
            case 'enemy':
                this.damageTracking.damageBySource.enemies += amount;
                // Track specific enemy if available
                if (enemyIndex !== -1 && this.scene.cardSystem && this.scene.cardSystem.boardCards[enemyIndex]) {
                    const enemyCard = this.scene.cardSystem.boardCards[enemyIndex];
                    const enemyType = enemyCard.data.name || 'Unknown Enemy';
                    if (!this.damageTracking.enemiesKilledBy[enemyType]) {
                        this.damageTracking.enemiesKilledBy[enemyType] = 0;
                    }
                }
                break;
            case 'trap':
                this.damageTracking.damageBySource.traps += amount;
                this.damageTracking.runStats.trapsTriggered++;
                break;
            case 'exhaustion':
                this.damageTracking.damageBySource.exhaustion += amount;
                break;
            case 'environmental':
                this.damageTracking.damageBySource.environmental += amount;
                break;
        }
    }
    
    setDeathCause(source, enemyIndex = -1) {
        this.damageTracking.deathCause = source;
        
        // If killed by enemy, track which enemy
        if (source === 'enemy' && enemyIndex !== -1 && this.scene.cardSystem && this.scene.cardSystem.boardCards[enemyIndex]) {
            const enemyCard = this.scene.cardSystem.boardCards[enemyIndex];
            const enemyType = enemyCard.data.name || 'Unknown Enemy';
            this.damageTracking.enemiesKilledBy[enemyType] = (this.damageTracking.enemiesKilledBy[enemyType] || 0) + 1;
        }
        
        // Update final run stats
        this.damageTracking.runStats.floorsReached = this.currentFloor;
        this.damageTracking.runStats.coinsEarned = this.coins;
        this.damageTracking.runStats.crystalsEarned = this.crystals;
    }
    
    // Method to get death statistics for meta progression
    getDeathStats() {
        return {
            cause: this.damageTracking.deathCause,
            totalDamage: this.damageTracking.totalDamageTaken,
            damageBySource: { ...this.damageTracking.damageBySource },
            enemiesKilledBy: { ...this.damageTracking.enemiesKilledBy },
            runStats: { ...this.damageTracking.runStats },
            floor: this.currentFloor
        };
    }
    
    // Method to track enemy defeats
    trackEnemyDefeat(enemyName) {
        this.damageTracking.runStats.enemiesDefeated++;
    }
}
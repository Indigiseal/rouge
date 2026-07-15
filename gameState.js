import { SoundHelper } from './utils/SoundHelper.js';

export class GameState {
    constructor(scene) {
        this.scene = scene;
        // Bumped from 100 to 115 — act 1 was killing players too often before
        // they could find armor or gems. Extra buffer covers the early ramp.
        this.playerHealth = 115;
        this.maxHealth = 115;
        this.coins = 0;
        this.crystals = 0;
        this.activeAmulets = [];
        this.playerEffects = [];
        this.actionsLeft = 15;
        this.maxActions = 15;
        this.currentFloor = 1;
        this.roomType = 'COMBAT';
        this.mapCursor = null;
        this.companionHistory = {};
        this.companionRoomParticipants = {};
        this.dungeonMap = null;
        this.pendingActShop = null;
        this.equippedWeapon = null;
        this.equippedArmor = null;
        this.inventory = new Array(5).fill(null);
        this.startingCardsGranted = false; // Guards the one-time starting swords (prevents resume/restart dupes)
        this.discardedCardsThisRun = 0;
        this.discardCritChance = 0;
        this.storyRun = {
            caravanSeen: false,
            donkeySaved: false,
            donkeyLost: false,
            banditsStopped: false,
            banditsEscaped: false,
            merchantGrateful: false,
            hermitState: 'unknown',
            banditTrailFound: false,
            cheerfulHermitVisited: false,
            caravanResolved: false,
            caravanEnding: 'unresolved',
            caravanEpilogueSeen: false,
            caravanEpilogueChoice: 'none',
            boxState: 'unknown',
            boxFollowing: false,
            boxHasCog: false,
            boxPrep: 'none',
            boxRepairChance: 50,
            birdAngry: false,
            stoleBirdEgg: false,
            latchboxRewardClaimed: false,
            goblinEngineerResolved: false,
            chickHatched: false,
            skeletonCompanionObtained: false,
            angryNestmotherRollFloor: null,
            mirrorSeen: false,
            tooNiceRoomSeen: false,
            wellSeen: false,
            slimyPrisonSeen: false,
            bookWormSeen: false,
            briarRoomSeen: false,
            pendingEvents: []
        };
        this.heroMemory = {
            learnedBanditsThreatenHermit: false,
            learnedDonkeyCanBeSaved: false,
            solvedCaravanPerfectly: false,
            learnedMusicBoxExplodes: false,
            learnedBirdNestHasCog: false,
            learnedEngineerCanRepairBox: false,
            chickRareShopUnlocked: false,
            skeletonRareShopUnlocked: false
        };
        
        
        this.blockNextAttack = false;
        
        // Magic card effects
        this.shadowBlade = null;
        this.magicShield = null;
        this.boneWall = 0;
        this.mirrorShield = false;
        
        // Amulet-related properties
        this.firstActionUsed = false; // For Quickhand Gloves
        this.bonusInventorySlots = 0; // For Bottomless Bag / Diviner's Spade
        this.baseMaxHealth = 50; // Store base max health for cursed amulets
        this.journalBonusHP = 0; // Traveler's Journal: tracks HP added so it isn't double-applied
        this.mapBonusAP = 0; // Wayfarer's Map: AP gained so far (cap 15)
        this.mapFloorCount = 0; // Wayfarer's Map: floors counted toward the every-other cadence
        
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

    takeDamage(amount, enemyIndex = -1, source = 'enemy', armorPierce = 0) {
        if (source === 'poison' && (
            this.relicEffects?.poisonImmunity
            || this.scene?.amuletManager?.isPoisonImmune?.()
        )) {
            if (this.scene?.playerAvatar) {
                this.scene.createFloatingText(this.scene.playerAvatar.x, this.scene.playerAvatar.y, 'Poison Immune!', 0x66ff66);
            }
            return { actualDamage: 0, tookDamage: false };
        }

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
            
            // Durability tick if armor was used and damage was dealt.
            // Ironhide Tonic relic: chance to skip the durability loss entirely,
            // roughly doubling how long the armor lasts.
            const durabilitySave = this.relicEffects?.armorDurabilitySave || 0;
            const skipTick = durabilitySave > 0 && Math.random() < durabilitySave;
            if (protection > 0 && amount > 0 && !skipTick) {
                this.equippedArmor.durability--;
                if (this.equippedArmor.durability <= 0) {
                    SoundHelper.playVariant(this.scene, 'armor_break', 0.55);
                    this.scene.createFloatingText(this.scene.playerAvatar.x, this.scene.playerAvatar.y + 20, `${this.equippedArmor.name} broke!`, 0xffa500);
                    this.scene.grantCardSpentRelicBonus?.(this.equippedArmor, this.scene.playerAvatar.x, this.scene.playerAvatar.y);
                    this.equippedArmor = null;
                    this.scene.updateUI();
                }
            }
        }

        // Trained guard companions provide passive protection while carried.
        protection += this.scene?.getCompanionProtectionBonus?.() || 0;
        
        // armor_break (boss ability) pierces some of the player's protection so the
        // hit lands harder. Never turns armor into a damage bonus — just reduces it.
        const effectiveProtection = Math.max(0, protection - Math.max(0, armorPierce));
        const actualDamage = Math.max(0, amount - effectiveProtection);
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
        
        // SINGLE authority for combat death: every lethal hit schedules
        // gameOver() here, so callers must not schedule their own duplicate.
        // (EventScene damage bypasses takeDamage and invokes gameOver()
        // directly on wake — see EventScene.continueAdventure.)
        if (this.playerHealth <= 0) {
            this.setDeathCause(source, enemyIndex);
            this.scene.time.delayedCall(100, () => this.scene.gameOver());
        }
        
        return { actualDamage, tookDamage };
    }

    addPlayerEffect(effect) {
        if (effect?.type === 'poison' && (
            this.relicEffects?.poisonImmunity
            || this.scene?.amuletManager?.isPoisonImmune?.()
        )) {
            if (this.scene?.playerAvatar) {
                this.scene.createFloatingText(this.scene.playerAvatar.x, this.scene.playerAvatar.y, 'Poison Immune!', 0x66ff66);
            }
            return false;
        }

        // Prevent stacking the same effect, refresh duration instead
        const existingEffect = this.playerEffects.find(e => e.type === effect.type);
        if (existingEffect) {
            existingEffect.turns = effect.turns;
            if (effect.killedBy) existingEffect.killedBy = effect.killedBy;
        } else {
            this.playerEffects.push(effect);
        }
        return true;
    }
    
    // General healing — rest rooms, events, and spells all use this. It ignores
    // amulet heal caps on purpose: only healing POTIONS are capped (see
    // healCapped). Never heals past max HP.
    heal(amount) {
        this.playerHealth = Math.min(this.maxHealth, this.playerHealth + amount);
    }

    // Capped healing used ONLY by healing potions, so a Berserker's Warbelt can
    // hold potion healing to 50% max HP while rest/events/spells heal freely.
    healCapped(amount) {
        const maxCap = this.scene.amuletManager ?
            this.scene.amuletManager.getMaxHealthCap() : 1;

        const cappedMaxHealth = Math.floor(this.maxHealth * maxCap);
        // Heal up toward the cap, but never DROP health: a wearer already above
        // 50% (e.g. equipped the belt at high HP) must not lose HP from a potion.
        const healed = Math.min(cappedMaxHealth, this.playerHealth + amount);
        this.playerHealth = Math.max(this.playerHealth, healed);
    }
    
    // Method to check if action should be free (Quickhand Gloves)
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

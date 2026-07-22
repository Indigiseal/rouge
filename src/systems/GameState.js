import { CombatSequencer } from './combat/CombatSequencer.js';
import {
    isEnemyRangedAttack as isEnemyRangedAttackResolved,
    resolvePlayerDamage,
} from './combat/PlayerDamageResolver.js';
import {
    createDefaultHeroMemory,
    createDefaultStoryRun,
} from '../content/story/StoryDefaults.js';

export const PLAYER_START_HP = 100;

export class GameState {
    constructor(scene) {
        this.scene = scene;
        this.playerHealth = PLAYER_START_HP;
        this.maxHealth = PLAYER_START_HP;
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
        this.characterId = 'rogue';
        // Optional sim/experiment override: ['chain'] | ['plate'] | ['chain','plate'].
        // null → use character class armorTypes.
        this.armorPool = null;
        this.talentEffects = {};
        this.discardedCardsThisRun = 0;
        this.discardCritChance = 0;
        this.storyRun = createDefaultStoryRun();
        this.heroMemory = createDefaultHeroMemory();
        
        
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

    // Ironhide Tonic relic + armor-durability earrings + Rivets talent:
    // chance to skip the loss on any armor durability tick.
    tickEquippedArmorDurability() {
        if (!this.equippedArmor) return;
        const relicSave = this.relicEffects?.armorDurabilitySave || 0;
        const amuletSave = this.scene?.amuletManager?.getArmorDurabilitySaveChance?.() || 0;
        const rivets = this.talentEffects?.rivetsChance || 0;
        const durabilitySave = Math.min(0.95, relicSave + amuletSave + rivets);
        if (durabilitySave > 0 && Math.random() < durabilitySave) {
            if (rivets > 0 && this.scene?.playerAvatar) {
                this.scene.createFloatingText(
                    this.scene.playerAvatar.x,
                    this.scene.playerAvatar.y + 16,
                    'Rivets!',
                    0xc0c0c0
                );
            }
            return;
        }

        this.equippedArmor.durability--;
        if (this.equippedArmor.durability <= 0) {
            CombatSequencer.playVariant(this.scene, 'break', 'armor_break', 0.55);
            CombatSequencer.floatingText(this.scene, 'break',
                this.scene.playerAvatar.x, this.scene.playerAvatar.y + 20, `${this.equippedArmor.name} broke!`, 0xffa500);
            this.scene.grantCardSpentRelicBonus?.(this.equippedArmor, this.scene.playerAvatar.x, this.scene.playerAvatar.y);
            this.equippedArmor = null;
            this.scene.updateUI();
        }
    }

    /** Ranged enemy hits (archers). Bosses count as melee, same as thorns. */
    isEnemyRangedAttack(card) {
        return isEnemyRangedAttackResolved(card);
    }

    takeDamage(amount, enemyIndex = -1, source = 'enemy', armorPierce = 0) {
        return resolvePlayerDamage(this, amount, enemyIndex, source, armorPierce);
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

        if (effect?.type === 'poison') {
            const existingPoison = this.playerEffects.find(e => e.type === 'poison');
            if (existingPoison) {
                existingPoison.turns = Math.max(0, existingPoison.turns || 0) + Math.max(0, effect.turns || 0);
                existingPoison.damage = Math.max(existingPoison.damage || 0, effect.damage || 0);
                existingPoison.stacks = Math.max(1, existingPoison.stacks || 1) + Math.max(1, effect.stacks || 1);
                if (effect.killedBy) existingPoison.killedBy = effect.killedBy;
                return true;
            }
            this.playerEffects.push({ ...effect, stacks: Math.max(1, effect.stacks || 1) });
            return true;
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

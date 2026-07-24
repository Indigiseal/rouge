import { createAmuletDefinitions } from '../content/amulets/index.js';
import { areAmuletsDisabled } from '../config/TestOptions.js';

export class AmuletManager {
    constructor(scene) {
        this.scene = scene;
        this.gameState = scene.gameState;
        
        this.amuletDefinitions = createAmuletDefinitions(this);
    }

    // Check if player has a specific amulet
    hasAmulet(amuletId) {
        return this.gameState.activeAmulets.some(a => a.id === amuletId);
    }
    
    // Get amulet data (for tracking uses, etc.)
    getAmuletData(amuletId) {
        return this.gameState.activeAmulets.find(a => a.id === amuletId);
    }

    isPoisonImmune() {
        return this.gameState.activeAmulets.some(amulet => (
            this.amuletDefinitions[amulet.id]?.poisonImmunity
        ));
    }

    // Sum a numeric definition property across all active amulets.
    sumAmuletProperty(prop) {
        return this.gameState.activeAmulets.reduce((total, amulet) => (
            total + (this.amuletDefinitions[amulet.id]?.[prop] || 0)
        ), 0);
    }

    shouldReturnMagicCard() {
        const chance = this.sumAmuletProperty('magicCardReturnChance');
        return chance > 0 && Math.random() < Math.min(1, chance);
    }

    getDiscardCoinBonus() {
        return this.sumAmuletProperty('coinsPerDiscard');
    }

    // Golden Seed — permanent max HP gained per card discarded.
    getDiscardMaxHpBonus() {
        return this.sumAmuletProperty('maxHpPerDiscard');
    }

    // Fire Rune — extra pixels added to the fire gem's splash radius.
    getFireSplashRadiusBonus() {
        return this.sumAmuletProperty('fireSplashRadiusBonus');
    }

    // Remove an equipped amulet and reverse its onUnequip / max-HP bonus.
    removeAmulet(amuletId, { silent = false } = {}) {
        const index = this.gameState.activeAmulets.findIndex((a) => a.id === amuletId);
        if (index < 0) return false;
        const definition = this.amuletDefinitions[amuletId];
        if (definition?.onUnequip) {
            definition.onUnequip.call(this);
        }
        this.gameState.activeAmulets.splice(index, 1);
        if (!silent) {
            this.scene.createFloatingText(320, 160, `${definition?.name || amuletId} replaced`, 0xffaa66);
        }
        return true;
    }

    // True if an owned amulet already replaces this id (upgrade present).
    isReplacedByOwned(amuletId) {
        return this.gameState.activeAmulets.some((owned) => {
            const replaces = this.amuletDefinitions[owned.id]?.replaces;
            return Array.isArray(replaces) && replaces.includes(amuletId);
        });
    }

    // Would addAmulet() succeed for this id? Offers are built when a card
    // spawns but redeemed much later, by which point the player may already own
    // what was rolled — callers use this to drop dead options before showing a
    // choice, and before charging for one.
    // Keep the rejection reasons here in step with addAmulet() below.
    canAddAmulet(amuletId, { force = false } = {}) {
        if (areAmuletsDisabled() && !force) return false;
        const definition = this.amuletDefinitions[amuletId];
        if (!definition) return false;
        if (this.isReplacedByOwned(amuletId)) return false;
        if (this.hasAmulet(amuletId) && !definition.stackable) return false;
        return true;
    }

    // Every still-takeable option from a (possibly stale) offer list.
    takeableOptions(options) {
        return (options || []).filter((o) => o?.id && this.canAddAmulet(o.id));
    }

    // Add an amulet to the player.
    // force=true bypasses the "amulets disabled" test option — used by the
    // balance sim for controlled solo-amulet sweeps (starting loadout only;
    // floor/shop drops stay blocked while the option is on).
    addAmulet(amuletId, { force = false } = {}) {
        if (areAmuletsDisabled() && !force) return false;

        const definition = this.amuletDefinitions[amuletId];
        if (!definition) return false;

        // Already have a stronger version that replaces this one.
        if (this.isReplacedByOwned(amuletId)) {
            this.scene.createFloatingText(320, 180, 'Already upgraded!', 0xffa500);
            return false;
        }
        
        // Check if stackable or already owned
        if (this.hasAmulet(amuletId) && !definition.stackable) {
            this.scene.createFloatingText(320, 180, 'Already owned!', 0xff0000);
            return false;
        }

        // Upgrade path: strip replaced weaker amulets first (undo their bonuses).
        if (Array.isArray(definition.replaces)) {
            for (const oldId of definition.replaces) {
                if (this.hasAmulet(oldId)) this.removeAmulet(oldId, { silent: true });
            }
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

    // Process start-of-floor effects (regen rings, Philosopher's Stone, …)
    processFloorStart() {
        let healTotal = 0;
        this.gameState.activeAmulets.forEach((amulet) => {
            const definition = this.amuletDefinitions[amulet.id];
            if (!definition) return;
            if (definition.onFloorStart) {
                definition.onFloorStart(amulet.level || 1);
            }
            if (definition.floorStartHeal) {
                healTotal += definition.floorStartHeal * (amulet.level || 1);
            }
        });
        if (healTotal <= 0) return;
        const before = this.gameState.playerHealth;
        this.gameState.playerHealth = Math.min(
            this.gameState.maxHealth,
            this.gameState.playerHealth + healTotal
        );
        const gained = this.gameState.playerHealth - before;
        if (gained > 0 && this.scene.playerAvatar) {
            this.scene.createFloatingText(
                this.scene.playerAvatar.x,
                this.scene.playerAvatar.y,
                `+${gained} HP (Regen)`,
                0x00ff00
            );
        }
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
    
    // Fire any amulet hooks that respond to drinking a healing potion
    // (e.g. Carrion Oath's poison purge). Call AFTER the heal is applied.
    processPotionUse() {
        this.gameState.activeAmulets.forEach(amulet => {
            const definition = this.amuletDefinitions[amulet.id];
            if (definition && definition.onPotionUse) {
                definition.onPotionUse(amulet.level || 1);
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
    
    // Fire AP-restore amulets (Tea Room Bell) when the player enters a
    // non-battle room (shop, rest, anvil, event, treasure). AP carries into the
    // next fight, so this is a small economy boost between battles.
    processNonBattleSceneEnter() {
        let total = 0;
        this.gameState.activeAmulets.forEach(amulet => {
            const definition = this.amuletDefinitions[amulet.id];
            if (definition && definition.restoreApOnNonBattle) {
                total += definition.restoreApOnNonBattle;
            }
        });
        if (total <= 0) return;

        const before = this.gameState.actionsLeft || 0;
        this.gameState.actionsLeft = Math.min(this.gameState.maxActions, before + total);
        const gained = this.gameState.actionsLeft - before;
        if (gained <= 0) return;

        this.scene.updateActionPointUI?.();
        this.scene.updateUI?.();
        if (this.scene.playerAvatar) {
            this.scene.createFloatingText?.(
                this.scene.playerAvatar.x,
                this.scene.playerAvatar.y - 20,
                `+${gained} AP (Bell)`,
                0x66ddff
            );
        }
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

    // Monocle — chance to find a crystal on kill. Caller grants currency + FX.
    rollMonocleCrystalReward() {
        const chance = this.sumAmuletProperty('crystalOnKillChance');
        if (chance <= 0 || Math.random() >= chance) return null;
        return { kind: 'crystal', amount: 1 };
    }

    // Vampire Fang — heal for a % of weapon damage dealt (ceil).
    processLifesteal(damageDealt) {
        const percent = this.sumAmuletProperty('lifestealPercent');
        if (percent <= 0 || damageDealt <= 0) return 0;
        const heal = Math.ceil(damageDealt * percent);
        if (heal <= 0) return 0;
        const before = this.gameState.playerHealth;
        this.gameState.playerHealth = Math.min(
            this.gameState.maxHealth,
            this.gameState.playerHealth + heal
        );
        const gained = this.gameState.playerHealth - before;
        if (gained > 0 && this.scene.playerAvatar) {
            this.scene.createFloatingText(
                this.scene.playerAvatar.x,
                this.scene.playerAvatar.y - 12,
                `+${gained} HP (Life)`,
                0xff6688
            );
        }
        return gained;
    }

    getArmorDurabilitySaveChance() {
        return Math.min(0.95, this.sumAmuletProperty('armorDurabilitySaveChance'));
    }

    // Probability of SPENDING 1 weapon durability (1 = always spend).
    getWeaponDurabilityRate() {
        let rate = 1;
        this.gameState.activeAmulets.forEach(amulet => {
            const definition = this.amuletDefinitions[amulet.id];
            if (definition && definition.weaponDurabilityRate) {
                rate *= definition.weaponDurabilityRate;
            }
        });
        const save = Math.min(0.95, this.sumAmuletProperty('weaponDurabilitySaveChance'));
        return Math.max(0, Math.min(1, rate * (1 - save)));
    }

    // Scale gem hit damage: hermit gloves (+20% all) or typed runes.
    modifyGemDamage(baseDamage, gemType) {
        let damage = baseDamage;
        const allBonus = this.sumAmuletProperty('allGemDamageBonus');
        if (allBonus > 0) {
            damage = Math.ceil(damage * (1 + allBonus));
            return Math.max(1, damage);
        }
        let typed = 0;
        if (gemType === 'fire') typed = this.sumAmuletProperty('fireGemDamageBonus');
        else if (gemType === 'lightning' || gemType === 'zap') typed = this.sumAmuletProperty('zapGemDamageBonus');
        if (typed > 0) damage = Math.ceil(damage * (1 + typed));
        return Math.max(1, damage);
    }

    getPoisonGemTickBonus() {
        if (this.sumAmuletProperty('allGemDamageBonus') > 0) {
            // Hermit gloves replace poison rune; +20% on tick 1 → ceil(1.2)=2 vs +1 flat.
            // Spec: gloves = +20% all gem damage. Poison ticks are gem damage.
            return 0; // percent applied in modifyGemDamage for poison stacks below
        }
        return this.sumAmuletProperty('poisonGemTickBonus');
    }

    modifyPoisonGemTickDamage(baseDamage) {
        const allBonus = this.sumAmuletProperty('allGemDamageBonus');
        if (allBonus > 0) return Math.max(1, Math.ceil(baseDamage * (1 + allBonus)));
        return Math.max(1, baseDamage + this.sumAmuletProperty('poisonGemTickBonus'));
    }

    // Prospector's Pick — 10% chance per kill to find 1-2 coins OR a crystal.
    // Returns { kind: 'coin'|'crystal', amount } or null. The caller grants the
    // currency and plays the pickup animation on the enemy's defeat tile.
    rollProspectorPickReward() {
        if (!this.hasAmulet('prospectorsPick')) return null;
        if (Math.random() >= 0.10) return null;
        if (Math.random() < 0.5) {
            return { kind: 'coin', amount: 1 + Math.floor(Math.random() * 2) }; // 1 or 2
        }
        return { kind: 'crystal', amount: 1 };
    }

    // Lucky Streak (Fortune Card) — when the player lands a CRIT, a 25% chance to
    // shake loose 1-2 coins or a crystal. Returns { kind: 'coin'|'crystal', amount }
    // or null. The caller grants it and plays the coin-jump / crystal-scatter fx.
    rollLuckyStreakCritReward() {
        if (!this.hasAmulet('fortuneCard')) return null;
        if (Math.random() >= 0.25) return null;
        if (Math.random() < 0.65) {
            return { kind: 'coin', amount: 1 + Math.floor(Math.random() * 2) }; // 1 or 2
        }
        return { kind: 'crystal', amount: 1 };
    }

    // Cross-tier merging was granted by Golden Hammer, which has been removed
    // for being too powerful. Kept as a stub (always false) so existing callers
    // in inventorySystem keep working.
    canCrossTierMerge() {
        return false;
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

    getCriticalChanceBonus() {
        return this.sumAmuletProperty('critChanceBonus');
    }

    processCardReward(cardData) {
        if (!cardData || cardData.type === 'coin' || cardData.type === 'crystal') return;
        const bonus = this.sumAmuletProperty('crystalOnFirstCardReward');
        if (bonus <= 0) return;

        const floor = this.gameState.currentFloor || 1;
        if (this.gameState.fortuneCardRewardFloor === floor) return;
        this.gameState.fortuneCardRewardFloor = floor;
        this.gameState.crystals = (this.gameState.crystals || 0) + bonus;
        this.scene.updateUI?.();
        this.scene.createFloatingText?.(512, 382, `+${bonus} crystal (Fortune)`, 0x66ddff);
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

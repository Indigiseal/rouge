// MetaProgressionManager.js

import { SaveManager } from './SaveManager.js';
import { CardDataGenerator } from './CardDataGenerator.js';

export class MetaProgressionManager {
    constructor(scene) {
        this.scene = scene;
        this.saveManager = new SaveManager();
        this.loadMetaProgression();
    }

    loadMetaProgression() {
        const data = this.saveManager.loadMetaProgression();
        this.unlockedRelics = data.unlockedRelics || [];
        this.totalDeaths = data.totalDeaths || 0;
        this.bestFloor = data.bestFloor || 1;
        this.enemyKillStats = data.enemyKillStats || {};
        this.totalRuns = data.totalRuns || 0;
        this.totalEnemiesKilled = data.totalEnemiesKilled || 0;
    }

    saveMetaProgression() {
        this.saveManager.saveMetaProgression({
            unlockedRelics: this.unlockedRelics,
            totalDeaths: this.totalDeaths,
            bestFloor: this.bestFloor,
            enemyKillStats: this.enemyKillStats,
            totalRuns: this.totalRuns,
            totalEnemiesKilled: this.totalEnemiesKilled,
        });
    }

    // ─── Relic roster ────────────────────────────────────────────────────────
    // Each relic is triggered/conditional so it changes how you play, not just
    // a flat stat bump. Effect keys are consumed at these hook points:
    //   weaponPoisonChance/poisonDamage/poisonTurns → CardSystem.applyWeaponPoison
    //   poisonDamageBonus                            → CardSystem.applyWeaponPoison
    //   slowChance                                   → CardSystem.applyRelicSlow
    //   firstAttackDoubleDamage                      → CardSystem.attackEnemy
    //   lifestealOnKill                              → CardSystem.removeDefeatedEnemy
    //   healPerFloor / revealExtraCard               → CardSystem.spawnFloorCards
    //   coinMultiplier                               → AmuletManager.modifyGoldFound
    //   weaponDurabilityRate                         → AmuletManager.getWeaponDurabilityRate
    //   poisonImmunity                               → GameState.addPlayerEffect
    //   reviveOncePerRun                             → GameState.takeDamage
    //   bonus/startingX, maxHPPenalty, startingWeapon → applyRelicEffects (below)
    //
    // Unlock sources:
    //   killedBy: 'spider' | 'skeleton' | 'goblin'  → substring match on killer
    //   killedBy: '<exact boss name>'               → Giant Spider / Skeleton King / Dragon
    //   unlockCondition: 'deaths_N' | 'floor_N'     → milestone
    getRelicDefinitions() {
        return {
            // ── Spider line ──────────────────────────────────────────────
            spiderVenom: {
                id: 'spiderVenom',
                name: 'Venom Glands',
                description: 'Every weapon hit poisons the enemy (2 dmg, 3 turns).',
                icon: 'relic_spider',
                killedBy: 'spider',
                effect: { weaponPoisonChance: 1.0, poisonDamage: 2, poisonTurns: 3 },
            },
            webWeaver: {
                id: 'webWeaver',
                name: 'Web Weaver',
                description: '25% chance to freeze an enemy for a turn when you hit it.',
                icon: 'relic_web',
                killedBy: 'spider',
                tier: 2,
                effect: { slowChance: 0.25 },
            },

            // ── Skeleton line ────────────────────────────────────────────
            secondWind: {
                id: 'secondWind',
                name: 'Second Wind',
                description: 'Once per run, survive a lethal hit at 1 HP.',
                icon: 'relic_bone',
                killedBy: 'skeleton',
                effect: { reviveOncePerRun: true },
            },
            gravekeeper: {
                id: 'gravekeeper',
                name: 'Gravekeeper',
                description: 'Heal 4 HP at the start of every floor.',
                icon: 'relic_skull',
                killedBy: 'skeleton',
                tier: 2,
                effect: { healPerFloor: 4 },
            },

            // ── Goblin line ──────────────────────────────────────────────
            bloodMoney: {
                id: 'bloodMoney',
                name: 'Blood Money',
                description: 'Enemy coin drops +50%, and killing blows heal 1 HP.',
                icon: 'relic_coin_pouch',
                killedBy: 'goblin',
                effect: { coinMultiplier: 1.5, lifestealOnKill: 1 },
            },

            // ── Boss relics (exact name match) ───────────────────────────
            broodmother: {
                id: 'broodmother',
                name: "Broodmother's Spite",
                description: 'Immune to poison. Your poison deals +2 damage.',
                icon: 'relic_crown',
                killedBy: 'Giant Spider',
                boss: true,
                effect: { poisonImmunity: true, poisonDamageBonus: 2 },
            },
            giantsGrip: {
                id: 'giantsGrip',
                name: "Giant's Grip",
                description: 'Weapons lose durability half as often.',
                icon: 'relic_giant',
                killedBy: 'Skeleton King',
                boss: true,
                effect: { weaponDurabilityRate: 0.5 },
            },
            dragonHunger: {
                id: 'dragonHunger',
                name: "Dragon's Hunger",
                description: 'Heal 3 HP per kill, but −15 max HP.',
                icon: 'relic_lich',
                killedBy: 'Dragon',
                boss: true,
                cursed: true,
                effect: { lifestealOnKill: 3, maxHPPenalty: -15 },
            },

            // ── Milestone relics ─────────────────────────────────────────
            quartermaster: {
                id: 'quartermaster',
                name: 'Quartermaster',
                description: 'Start each run with an uncommon weapon in your pack.',
                icon: 'relic_boots',
                unlockCondition: 'deaths_3',
                effect: { startingWeapon: 'uncommon' },
            },
            cartographer: {
                id: 'cartographer',
                name: 'Cartographer',
                description: 'Reveal 2 extra cards at the start of each floor.',
                icon: 'relic_eye',
                unlockCondition: 'floor_10',
                effect: { revealExtraCard: 2 },
            },
            executioner: {
                id: 'executioner',
                name: 'Executioner',
                description: 'Your first attack each floor deals double damage.',
                icon: 'relic_giant',
                unlockCondition: 'floor_20',
                effect: { firstAttackDoubleDamage: true },
            },
        };
    }

    // ─── Death → reward ──────────────────────────────────────────────────────

    handlePlayerDeath(killedBy, floor) {
        this.totalDeaths++;
        if (floor > this.bestFloor) this.bestFloor = floor;
        this.enemyKillStats[killedBy] = (this.enemyKillStats[killedBy] || 0) + 1;

        const newRelic = this.determineRelicReward(killedBy);
        if (newRelic && !this.hasRelic(newRelic.id)) {
            this.unlockRelic(newRelic.id);
            this.saveMetaProgression();
            return newRelic;
        }

        const milestoneRelic = this.checkMilestoneUnlocks();
        if (milestoneRelic) {
            this.unlockRelic(milestoneRelic.id);
            this.saveMetaProgression();
            return milestoneRelic;
        }

        this.saveMetaProgression();
        return null;
    }

    determineRelicReward(killedBy) {
        const relics = Object.values(this.getRelicDefinitions());
        const killer = (killedBy || '').toLowerCase();

        // Boss relics match the EXACT killer name. Check these first — boss
        // names like "Giant Spider" / "Skeleton King" contain the substrings
        // used for regular-enemy relics, so substring matching would otherwise
        // steal boss kills and the boss relics would be unreachable.
        const bossRelic = relics.find(r =>
            r.boss && r.killedBy === killedBy && !this.hasRelic(r.id)
        );
        if (bossRelic) return bossRelic;

        // Regular enemies match by family substring (spider / skeleton / goblin).
        const family = killer.includes('spider') ? 'spider'
            : killer.includes('skeleton') ? 'skeleton'
            : killer.includes('goblin') ? 'goblin'
            : null;
        if (!family) return null;

        // Prefer lower-tier relics first so the line unlocks in order.
        const familyRelics = relics
            .filter(r => !r.boss && r.killedBy === family && !this.hasRelic(r.id))
            .sort((a, b) => (a.tier || 1) - (b.tier || 1));
        return familyRelics[0] || null;
    }

    checkMilestoneUnlocks() {
        const relics = this.getRelicDefinitions();
        const milestones = [
            { relic: relics.quartermaster, ok: this.totalDeaths >= 3 },
            { relic: relics.cartographer,  ok: this.bestFloor >= 10 },
            { relic: relics.executioner,   ok: this.bestFloor >= 20 },
        ];
        for (const m of milestones) {
            if (m.ok && m.relic && !this.hasRelic(m.relic.id)) return m.relic;
        }
        return null;
    }

    hasRelic(relicId) {
        return this.unlockedRelics.includes(relicId);
    }

    unlockRelic(relicId) {
        if (!this.hasRelic(relicId)) this.unlockedRelics.push(relicId);
    }

    // ─── Apply at run start ──────────────────────────────────────────────────

    applyRelicEffects(gameState, applyStartingBonuses = true) {
        const relics = this.getRelicDefinitions();
        gameState.relicEffects = {};

        this.unlockedRelics.forEach(relicId => {
            const relic = relics[relicId];
            if (!relic || !relic.effect) return;
            const effect = relic.effect;

            if (applyStartingBonuses && effect.bonusStartingHP) {
                gameState.maxHealth += effect.bonusStartingHP;
                gameState.playerHealth += effect.bonusStartingHP;
            }
            if (applyStartingBonuses && effect.maxHPPenalty) {
                gameState.maxHealth += effect.maxHPPenalty; // negative
                gameState.playerHealth = Math.min(gameState.playerHealth, gameState.maxHealth);
            }
            if (applyStartingBonuses && effect.startingCoins) {
                gameState.coins += effect.startingCoins;
            }
            if (applyStartingBonuses && effect.bonusStartingAP) {
                gameState.actionsLeft += effect.bonusStartingAP;
                gameState.maxActions += effect.bonusStartingAP;
            }
            if (applyStartingBonuses && effect.startingArmor && !gameState.equippedArmor) {
                gameState.equippedArmor = {
                    type: 'armor', name: 'Uncommon Bone Armor', armorType: 'bone',
                    protection: effect.startingArmor, rarity: 'uncommon',
                    sprite: 'boneArmor_U', durability: 25, maxDurability: 25,
                };
            }
            if (applyStartingBonuses && effect.startingWeapon) {
                this.grantStartingWeapon(gameState, effect.startingWeapon);
            }

            // Copy ALL effect flags through for runtime consumers to read.
            Object.assign(gameState.relicEffects, effect);
        });
    }

    // Places a generated weapon into the first empty inventory slot. Runs in
    // GameScene.init (after initNewRun built the inventory array, before the
    // InventorySystem reads gameState.inventory), so it shows up in the pack.
    grantStartingWeapon(gameState, rarity) {
        if (!Array.isArray(gameState.inventory)) return;
        const slot = gameState.inventory.findIndex(s => s === null);
        if (slot === -1) return;
        try {
            this._gen = this._gen || new CardDataGenerator();
            const weapon = this._gen.createCardData('weapon', 1, false, null, rarity);
            if (weapon) gameState.inventory[slot] = weapon;
        } catch (e) {
            console.warn('Quartermaster: failed to grant starting weapon', e);
        }
    }

    getUnlockedRelics() {
        const relics = this.getRelicDefinitions();
        return this.unlockedRelics.map(id => relics[id]).filter(r => r);
    }

    resetProgression() {
        this.unlockedRelics = [];
        this.totalDeaths = 0;
        this.bestFloor = 1;
        this.enemyKillStats = {};
        this.totalRuns = 0;
        this.totalEnemiesKilled = 0;
        this.saveMetaProgression();
    }
}

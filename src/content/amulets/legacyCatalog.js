// Retired amulet catalog (rarity marked "old" at registry load).
// Event grants and combat hooks still work; these ids are excluded from offers.
import { getAmuletAtlasPresentation } from './RelicsOthersAtlas.js';

/** @param {object} mgr AmuletManager instance (bound as `this` for arrow hooks). */
export function buildLegacyAmuletDefinitions(mgr) {
    return (function () {
        return {

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
                description: '+10 max health',
                rarity: 'uncommon',
                onEquip: function() {
                    this.gameState.maxHealth += 10;
                    this.gameState.playerHealth += 10;
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
                        this.gameState.actionsLeft + 2
                    );
                    this.scene.createFloatingText(
                        this.scene.playerAvatar.x,
                        this.scene.playerAvatar.y,
                        '+2 AP (Moonwell)',
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
                // Displayed as "Carrion Oath" (bird-skull art). Reworked from the old
                // confusing "instant kill at exactly 1 HP / otherwise heal the enemy"
                // effect into a clear poison-cleanse: potions purge poison and the
                // toxin is turned back into healing.
                description: 'Drinking a healing potion cures all poison and heals +2 HP per poison stack removed',
                rarity: 'rare',
                onPotionUse: () => {
                    const effects = this.gameState.playerEffects || [];
                    const poisonStacks = effects
                        .filter(e => e.type === 'poison')
                        .reduce((sum, effect) => sum + Math.max(1, effect.stacks || 1), 0);
                    if (poisonStacks <= 0) return;
                    // Purge poison and convert it into bonus healing.
                    this.gameState.playerEffects = effects.filter(e => e.type !== 'poison');
                    const bonus = poisonStacks * 2;
                    this.gameState.playerHealth = Math.min(
                        this.gameState.maxHealth,
                        this.gameState.playerHealth + bonus
                    );
                    this.scene.createFloatingText(
                        this.scene.playerAvatar.x,
                        this.scene.playerAvatar.y - 16,
                        `Poison Purged +${bonus} HP`,
                        0x66ff66
                    );
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
                description: '+50% damage below 50% HP, potions cannot heal above 50%',
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
            },

            goldenSeed: {
                ...getAmuletAtlasPresentation('goldenSeed'),
                description: '+1 max HP whenever you discard a card',
                rarity: 'uncommon',
                maxHpPerDiscard: 1
            },

            fireRuneStone: {
                ...getAmuletAtlasPresentation('fireRuneStone'),
                description: 'Fire gems burn farther.',
                rarity: 'rare',
                fireSplashRadiusBonus: 25
            },

            // A small, opt-in echo of the old per-kill coin faucet (removed as a
            // baseline mechanic for flooding the economy) — low odds, small payout,
            // so it stays a flavorful trickle rather than reopening that faucet.
            // The roll + grant lives in CardSystem.removeDefeatedEnemy (via
            // rollProspectorPickReward) so the coin-jump / crystal-scatter pickup
            // can play on the tile where the enemy actually died, not up at the
            // player portrait like the HP-on-kill amulets.
            prospectorsPick: {
                ...getAmuletAtlasPresentation('prospectorsPick'),
                description: '10% chance to find 1-2 coins or a crystal per kill',
                rarity: 'uncommon'
            },

            // Special reward from the Too-Nice Room event. Not in the random
            // amulet pool (amuletTypes) — only the fairy hands it out.
            teaRoomBell: {
                ...getAmuletAtlasPresentation('teaRoomBell'),
                description: 'Restores 4 AP whenever you enter a non-battle room',
                rarity: 'rare',
                restoreApOnNonBattle: 4
            },

            // Standalone rewards from The Book Worm. These stay out of the
            // random amulet pool and can only be earned through the event.
            mothWingDust: {
                ...getAmuletAtlasPresentation('mothWingDust'),
                description: 'Magic cards have a 25% chance to return after use',
                rarity: 'rare',
                magicCardReturnChance: 0.25
            },

            wormVenomCharm: {
                ...getAmuletAtlasPresentation('wormVenomCharm'),
                description: 'Poison attacks are nullified and poison cannot be applied',
                rarity: 'rare',
                poisonImmunity: true,
                onEquip: () => {
                    this.gameState.playerEffects = (this.gameState.playerEffects || [])
                        .filter(effect => effect?.type !== 'poison');
                }
            },

            stolenInkPen: {
                ...getAmuletAtlasPresentation('stolenInkPen'),
                description: 'Gain 1 coin whenever you discard a card',
                rarity: 'rare',
                coinsPerDiscard: 1
            },

            // Special reward from the carnival hag in Something Wicked.
            luckyClover: {
                ...getAmuletAtlasPresentation('luckyClover'),
                description: '+3% crit chance',
                rarity: 'rare',
                critChanceBonus: 0.03
            },

            // Special reward from The Brass Wizard. "Lucky Streak": raises crit
            // chance, and landing a crit has a small chance to shake loose a coin
            // or crystal (see AmuletManager.rollLuckyStreakCritReward).
            fortuneCard: {
                ...getAmuletAtlasPresentation('fortuneCard'),
                name: 'Fortune Card',
                description: '+8% crit chance; critical hits sometimes drop a coin or crystal',
                rarity: 'rare',
                critChanceBonus: 0.08
            },

            // Gem-synergy stone runes — earned from The Screaming Head, never from
            // the regular amulet pool. Gem effects wired up later (OPEN-QUESTIONS).
            poisonRune: {
                ...getAmuletAtlasPresentation('poisonRune'),
                description: 'Poison gems stack more poison.',
                rarity: 'rare'
            },

            lightningRune: {
                ...getAmuletAtlasPresentation('lightningRune'),
                description: 'Zap hits one extra enemy.',
                rarity: 'rare'
            }
        
        };
    }).call(mgr);
}

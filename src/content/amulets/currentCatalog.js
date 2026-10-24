// Current offerable amulet catalog (common → legendary).
import { getAmuletAtlasPresentation } from './RelicsOthersAtlas.js';
import { SANDGLASS_SCARAB } from './sandglassScarab.js';
import { spiceFoodActions } from './sandspicePouch.js';

/** @param {object} mgr AmuletManager instance (bound as `this` for arrow hooks). */
// Max action points from an amulet, both the cap and the points in hand.
function raiseMaxActions(mgr, amount) {
    const gs = mgr.gameState;
    gs.maxActions = Math.max(1, (gs.maxActions || 0) + amount);
    gs.actionsLeft = Math.max(0, Math.min(gs.maxActions, (gs.actionsLeft || 0) + amount));
    mgr.scene?.updateUI?.();
}

// Stable export name for the renamed Sandglass Scarab's run cap.
export const GLUTTON_MAX_AP = SANDGLASS_SCARAB.maxAp;

export function buildCurrentAmuletDefinitions(mgr) {
    return (function () {
        return {

            ringOfRegeneration: {
                ...getAmuletAtlasPresentation('ringOfRegeneration'),
                name: 'Ring of Regeneration',
                description: '+8 HP at the start of each combat floor, +1 more every 3 floors',
                rarity: 'common',
                // Depth-scaled: 8 HP on F1 -> ~21 on F45. A flat 10 was worth
                // nothing by act 2 (0% of its act-1 value in sim).
                floorStartHeal: { base: 8, perFloor: 0.3 },
            },
            markOfHesitation: {
                ...getAmuletAtlasPresentation('markOfHesitation'),
                name: 'Mark of Hesitation',
                description: 'One random enemy per floor is marked. 50% chance it skips its attack.',
                rarity: 'common',
                controlHesitation: true,
            },
            tacticiansPin: {
                ...getAmuletAtlasPresentation('tacticiansPin'),
                name: "Tactician's Pin",
                description: 'At the start of combat, one face-down enemy is marked.',
                rarity: 'common',
                strategyScout: true,
                onEquip: () => this.applyStrategyScout(),
            },
            // Common find. A small chance to bounce an enemy attack back, and
            // the item the Mirror Twin event turns into the Twinned Mirror.
            handMirror: {
                ...getAmuletAtlasPresentation('handMirror'),
                name: 'Hand Mirror',
                description: '5% chance to reflect an enemy attack back at the attacker. You take no damage.',
                rarity: 'common',
                reflectChance: 0.05,
            },

            ringOfGreaterRegeneration: {
                ...getAmuletAtlasPresentation('ringOfGreaterRegeneration'),
                name: 'Ring of Greater Regeneration',
                description: '+12 HP at the start of each combat floor, +1 more every 2 floors. Replaces Ring of Regeneration.',
                rarity: 'uncommon',
                floorStartHeal: { base: 12, perFloor: 0.45 },
                replaces: ['ringOfRegeneration'],
            },
            alchemistBag: {
                ...getAmuletAtlasPresentation('alchemistBag'),
                name: 'Alchemist Bag',
                description: 'Potions heal 15% more and cure poison',
                rarity: 'uncommon',
                modifyPotionHealing: (amount) => Math.ceil(amount * 1.15),
                onPotionUse: () => {
                    const effects = this.gameState.playerEffects || [];
                    if (!effects.some((e) => e.type === 'poison')) return;
                    this.gameState.playerEffects = effects.filter((e) => e.type !== 'poison');
                    this.scene.createFloatingText(
                        this.scene.playerAvatar.x,
                        this.scene.playerAvatar.y - 16,
                        'Poison Cured',
                        0x71800b
                    );
                },
            },
            monocle: {
                ...getAmuletAtlasPresentation('monocle'),
                rarity: 'uncommon',
                crystalOnKillChance: 0.03,
            },
            goblinSpyglass: {
                ...getAmuletAtlasPresentation('goblinSpyglass'),
                rarity: 'uncommon',
                scoutOnHitChance: 0.15,
            },
            boneSpool: {
                ...getAmuletAtlasPresentation('boneSpool'),
                rarity: 'uncommon',
                repairOnDiscard: true,
            },
            mossyStone: {
                ...getAmuletAtlasPresentation('mossyStone'),
                rarity: 'uncommon',
                maxHpPerMerge: 1,
            },
            duneQuiver: {
                ...getAmuletAtlasPresentation('duneQuiver'),
                rarity: 'uncommon',
                bowDamageBonus: 1,
            },
            travelKitchen: {
                ...getAmuletAtlasPresentation('travelKitchen'),
                rarity: 'uncommon',
                modifyFoodAP: spiceFoodActions,
            },
            pouchOfGreed: {
                ...getAmuletAtlasPresentation('pouchOfGreed'),
                name: 'Pouch of Greed',
                description: '+20% gold found',
                rarity: 'uncommon',
                modifyGoldFound: (amount) => Math.ceil(amount * 1.2),
            },
            markOfTreachery: {
                ...getAmuletAtlasPresentation('markOfTreachery'),
                name: 'Mark of Treachery',
                description: 'One random enemy per floor is marked. It attacks another revealed enemy instead of you. Replaces Mark of Hesitation.',
                rarity: 'uncommon',
                controlTreachery: true,
                replaces: ['markOfHesitation'],
            },
            forcedMarch: {
                ...getAmuletAtlasPresentation('forcedMarch'),
                name: 'Forced March',
                description: 'The first revealed ranged enemy not on the front row swaps with a random front-row card.',
                rarity: 'common',
                strategyRangedMarch: true,
            },
            runeOfFire: {
                ...getAmuletAtlasPresentation('runeOfFire'),
                rarity: 'uncommon',
                fireSplashRadiusMultiplier: 1.5,
            },
            runeOfZap: {
                ...getAmuletAtlasPresentation('runeOfZap'),
                rarity: 'uncommon',
                lightningExtraBounces: 1,
            },
            runeOfPoison: {
                ...getAmuletAtlasPresentation('runeOfPoison'),
                rarity: 'uncommon',
                poisonGemSplashTargets: 1,
            },

            vampireFang: {
                ...getAmuletAtlasPresentation('vampireFang'),
                name: 'Vampire Fang',
                description: 'Heal for 15% of damage dealt (rounded up)',
                rarity: 'rare',
                lifestealPercent: 0.15,
            },
            newDragonClaw: {
                ...getAmuletAtlasPresentation('newDragonClaw'),
                name: 'Dragon Claw',
                description: '+15% damage dealt (rounded up)',
                rarity: 'rare',
                modifyWeaponDamage: (damage) => Math.ceil(damage * 1.15),
            },
            greaterRuneOfFire: {
                ...getAmuletAtlasPresentation('greaterRuneOfFire'),
                rarity: 'rare',
                fireGemDamageBonus: 0.2,
            },
            greaterRuneOfZap: {
                ...getAmuletAtlasPresentation('greaterRuneOfZap'),
                rarity: 'rare',
                zapGemDamageBonus: 0.2,
            },
            greaterRuneOfPoison: {
                ...getAmuletAtlasPresentation('greaterRuneOfPoison'),
                rarity: 'rare',
                poisonGemTickBonus: 2,
            },
            sirensPendant: {
                ...getAmuletAtlasPresentation('sirensPendant'),
                description: '15% chance enemies attack their own kind instead of you',
                rarity: 'rare',
                charmChance: 0.15,
            },
            maskOfHollowWhispers: {
                ...getAmuletAtlasPresentation('maskOfHollowWhispers'),
                name: 'Mask of Hollow Whispers',
                description: '25% chance a killed enemy leaves a non-trap, non-enemy, non-empty card',
                rarity: 'rare',
                deathDropChance: 0.25,
            },
            twinMarks: {
                ...getAmuletAtlasPresentation('twinMarks'),
                name: 'Twin Marks',
                description: 'One marked enemy has a 50% chance to skip its attack. Another marked enemy attacks its own kind. Replaces Marks of Hesitation and Treachery.',
                rarity: 'rare',
                controlHesitation: true,
                controlTreachery: true,
                replaces: ['markOfHesitation', 'markOfTreachery'],
            },
            vacancyStep: {
                ...getAmuletAtlasPresentation('vacancyStep'),
                rarity: 'rare',
                strategyCluster: true,
            },
            provisionersBell: {
                ...getAmuletAtlasPresentation('provisionersBell'),
                name: "Provisioner's Bell",
                description: 'Active: reveal every food card on the board. Cooldown: 10 player turns.',
                rarity: 'rare',
                activeAbility: 'revealFood',
                cooldownTurns: 10,
            },
            shiftingMedallion: {
                ...getAmuletAtlasPresentation('shiftingMedallion'),
                name: 'Shifting Medallion',
                description: 'Active: choose two board cards and swap their positions. Cooldown: 15 player turns.',
                rarity: 'rare',
                activeAbility: 'swapCards',
                cooldownTurns: 15,
            },
            keepersWard: {
                ...getAmuletAtlasPresentation('keepersWard'),
                name: "Keeper's Ward",
                description: '30% chance not to spend weapon durability on attack or armor durability on block/dodge.',
                rarity: 'rare',
                weaponDurabilitySaveChance: 0.3,
                armorDurabilitySaveChance: 0.3,
            },
            armsfindersCharm: {
                ...getAmuletAtlasPresentation('armsfindersCharm'),
                name: "Armsfinder's Charm",
                description: 'Active: reveal one random weapon card on the board. Cooldown: 10 player turns.',
                rarity: 'rare',
                activeAbility: 'revealWeapon',
                cooldownTurns: 10,
            },
            apothecarysEye: {
                ...getAmuletAtlasPresentation('apothecarysEye'),
                name: "Apothecary's Eye",
                description: 'Active: reveal one random potion card on the board. Cooldown: 10 player turns.',
                rarity: 'rare',
                activeAbility: 'revealPotion',
                cooldownTurns: 10,
            },
            gemseekersLens: {
                ...getAmuletAtlasPresentation('gemseekersLens'),
                name: "Gemseeker's Lens",
                description: 'Active: reveal one random gem card on the board. Cooldown: 10 player turns.',
                rarity: 'rare',
                activeAbility: 'revealGem',
                cooldownTurns: 10,
            },

            glovesOfHermitWizard: {
                ...getAmuletAtlasPresentation('glovesOfHermitWizard'),
                name: 'Gloves of the Hermit Wizard',
                description: '+35% damage from all gems (rounded up). Replaces Fire/Zap/Poison runes.',
                rarity: 'legendary',
                allGemDamageBonus: 0.35,
                replaces: [
                    'runeOfFire', 'runeOfZap', 'runeOfPoison',
                    'greaterRuneOfFire', 'greaterRuneOfZap', 'greaterRuneOfPoison',
                ],
            },
            collarOfBinding: {
                ...getAmuletAtlasPresentation('collarOfBinding'),
                name: 'Collar of Binding',
                description: 'Twin Marks, and a killed marked non-boss enemy joins your bag as a companion if a slot is free. Stays until discarded. Replaces the control marks.',
                rarity: 'legendary',
                controlHesitation: true,
                controlTreachery: true,
                bindOnKill: true,
                replaces: ['markOfHesitation', 'markOfTreachery', 'twinMarks'],
            },
            generalsTable: {
                ...getAmuletAtlasPresentation('generalsTable'),
                name: "General's Glasses",
                description: 'Once per act, on the map, you may pick any room on the next floor instead of following the branches.',
                rarity: 'legendary',
                strategyDetour: true,
            },
            plagueHeart: {
                ...getAmuletAtlasPresentation('plagueHeart'),
                name: 'Plague Heart',
                description: 'A poisoned enemy explodes on death, dealing 10 damage to every adjacent enemy.',
                rarity: 'legendary',
                poisonDeathExplosionDamage: 10,
            },

            // ── Sigils branch ──────────────────────────────────────────────
            // The map's fog of war (map/MapFog.js reads these by id).
            cartographersInk: {
                ...getAmuletAtlasPresentation('cartographersInk'),
                name: "Cartographer's Ink",
                description: "Your sight through the map's fog reaches much further.",
                rarity: 'uncommon',
            },
            oraclesFishbowl: {
                ...getAmuletAtlasPresentation('oraclesFishbowl'),
                name: "Oracle's Eye",
                description: 'The map has no fog: every floor is in sight.',
                rarity: 'rare',
                replaces: ['cartographersInk'],
            },
            // Max action points. onEquip runs once, when the amulet is taken
            // (a loaded save already holds the raised maximum).
            quickstepCharm: {
                ...getAmuletAtlasPresentation('quickstepCharm'),
                name: 'Quickstep Charm',
                description: '+1 max action point.',
                rarity: 'uncommon',
                onEquip: function() { raiseMaxActions(this, 1); },
                onUnequip: function() { raiseMaxActions(this, -1); },
            },
            heartOfHours: {
                ...getAmuletAtlasPresentation('heartOfHours'),
                name: 'Heart of Hours',
                description: '+2 max action points.',
                rarity: 'rare',
                onEquip: function() { raiseMaxActions(this, 2); },
                onUnequip: function() { raiseMaxActions(this, -2); },
            },
            gluttonsCharm: {
                ...getAmuletAtlasPresentation('gluttonsCharm'),
                name: SANDGLASS_SCARAB.name,
                description: SANDGLASS_SCARAB.description,
                originLocationId: SANDGLASS_SCARAB.originLocationId,
                rarity: 'rare',
                foodMaxActionGain: 1,
            },
            leadershipBanner: {
                ...getAmuletAtlasPresentation('leadershipBanner'),
                name: 'Leadership Banner',
                description: 'Each companion that attacks has a 10% chance to act once more. Extra actions cannot chain.',
                rarity: 'rare', originLocationId: 'thornwake',
                companionExtraActionChance: 0.1,
            },
            // One more bag slot: slots are scarce, so it is a rare find.
            veteransCarryall: {
                ...getAmuletAtlasPresentation('veteransCarryall'),
                name: "Veteran's Carryall",
                description: '+1 bag slot.',
                rarity: 'rare',
                onEquip: function() {
                    if (this.scene.inventorySystem) this.scene.inventorySystem.expandInventory(1);
                    else this.gameState.bonusInventorySlots = (this.gameState.bonusInventorySlots || 0) + 1;
                },
            },
            // Won from the Soup Stand's robbers (cards/robbers.js), never dropped: the same
            // bag slot as the Carryall, made certain by the fight that earns it.
            robberSatchel: {
                ...getAmuletAtlasPresentation('robberSatchel'),
                name: "Robber's Satchel",
                description: '+1 bag slot.',
                rarity: 'uncommon',
                onEquip: function() {
                    if (this.scene.inventorySystem) this.scene.inventorySystem.expandInventory(1);
                    else this.gameState.bonusInventorySlots = (this.gameState.bonusInventorySlots || 0) + 1;
                },
            },
            // Taya's new art (sigils branch).
            heartbloodVial: {
                ...getAmuletAtlasPresentation('heartbloodVial'),
                name: 'Heartblood Vial',
                description: 'Healing potions heal 25% more.',
                rarity: 'uncommon',
                modifyPotionHealing: (amount) => Math.ceil(amount * 1.25),
            },
            starfallPendant: {
                ...getAmuletAtlasPresentation('starfallPendant'),
                name: 'Starfall Pendant',
                description: '+5% chance of a critical hit (x1.5) with every weapon.',
                rarity: 'rare',
                critChanceBonus: 0.05,
            },
            wayfarersLamp: {
                ...getAmuletAtlasPresentation('wayfarersLamp'),
                name: "Wayfarer's Lamp",
                description: 'At the start of each fight, one random face-down card turns over.',
                rarity: 'uncommon',
                revealsAtFightStart: 1,
            },
            trapwiseBoots: {
                ...getAmuletAtlasPresentation('trapwiseBoots'),
                name: 'Trapwise Boots',
                description: 'Traps deal half damage, rounded down. Poison traps poison for half as much.',
                rarity: 'uncommon',
                trapDamageShare: 0.5,
            },
            sapphireBrooch: {
                ...getAmuletAtlasPresentation('sapphireBrooch'),
                name: 'Sapphire Brooch',
                description: 'Twice as many elite rewards are a Sigil Room.',
                rarity: 'rare',
                eliteChestSigil: true,
            },
            gildedLeaf: {
                ...getAmuletAtlasPresentation('gildedLeaf'),
                name: 'Gilded Leaf',
                description: 'The shop pays 50% more for what you sell.',
                rarity: 'uncommon',
                sellPriceMultiplier: 1.5,
            },
            lookingGlass: {
                ...getAmuletAtlasPresentation('lookingGlass'),
                name: 'Looking Glass',
                description: 'Secret rooms show one floor earlier on the map.',
                rarity: 'uncommon',
            },
            maskOfEmbers: {
                ...getAmuletAtlasPresentation('maskOfEmbers'),
                name: 'Mask of Embers',
                description: 'An enemy that hurts you catches fire and takes 2 damage.',
                rarity: 'rare',
                emberRetaliation: 2,
            },

            bloodSignet: {
                ...getAmuletAtlasPresentation('bloodSignet'),
                name: 'Blood Signet',
                description: 'Your critical hits deal x1.8 instead of x1.5.',
                rarity: 'rare',
                critMultiplier: 1.8,
            },

            // Not in the drop catalog: the Old Chute hands out the shard (the
            // mother's leg). The spiderling amulet is kept for older saves;
            // the egg now hatches into the Crystal Spiderling companion.
            spiderCrystalShard: {
                name: 'Spider Crystal Shard',
                sprite: 'spiderCrystalShardIcon',
                spriteFrame: 0,
                description: '15% chance to find a crystal when killing an enemy.',
                rarity: 'rare',
                crystalOnKillChance: 0.15,
            },
            crystalSpiderling: {
                name: 'Crystal Spiderling',
                sprite: 'crystalSpiderlingIcon',
                spriteFrame: 0,
                description: 'At the start of each fight, it crawls ahead and turns one face-down card over.',
                rarity: 'rare',
                revealsAtFightStart: 1,
            },

            // Not in the drop catalog: a Tollroad story will hand it out.
            tollWrit: {
                ...getAmuletAtlasPresentation('tollWrit'),
                name: 'Toll Writ',
                description: "Goblins can't steal your coins.",
                rarity: 'rare',
                blocksCoinTheft: true,
            },
        
        };
    }).call(mgr);
}

// Current offerable amulet catalog (common → legendary).
import { getAmuletAtlasPresentation } from './RelicsOthersAtlas.js';

/** @param {object} mgr AmuletManager instance (bound as `this` for arrow hooks). */
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
            earringOfArmorDurability: {
                ...getAmuletAtlasPresentation('earringOfArmorDurability'),
                name: 'Earring of Armor Durability',
                description: '25% chance not to spend armor durability on block/dodge',
                rarity: 'common',
                armorDurabilitySaveChance: 0.25,
            },
            earringOfWeaponDurability: {
                ...getAmuletAtlasPresentation('earringOfWeaponDurability'),
                name: 'Earring of Weapon Durability',
                description: '30% chance not to spend weapon durability on attack',
                rarity: 'common',
                weaponDurabilitySaveChance: 0.3,
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
            },

            ringOfGreaterRegeneration: {
                ...getAmuletAtlasPresentation('ringOfGreaterRegeneration'),
                name: 'Ring of Greater Regeneration',
                description: '+12 HP at the start of each combat floor, +1 more every 2 floors. Replaces Ring of Regeneration.',
                rarity: 'uncommon',
                floorStartHeal: { base: 12, perFloor: 0.45 },
                replaces: ['ringOfRegeneration'],
            },
            earringOfGreaterArmorDurability: {
                ...getAmuletAtlasPresentation('earringOfGreaterArmorDurability'),
                name: 'Earring of Greater Armor Durability',
                description: '35% chance not to spend armor durability on block/dodge. Replaces Earring of Armor Durability.',
                rarity: 'uncommon',
                armorDurabilitySaveChance: 0.35,
                replaces: ['earringOfArmorDurability'],
            },
            earringOfGreaterWeaponDurability: {
                ...getAmuletAtlasPresentation('earringOfGreaterWeaponDurability'),
                name: 'Earring of Greater Weapon Durability',
                description: '40% chance not to spend weapon durability on attack. Replaces Earring of Weapon Durability.',
                rarity: 'uncommon',
                weaponDurabilitySaveChance: 0.4,
                replaces: ['earringOfWeaponDurability'],
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
                        0x66ff66
                    );
                },
            },
            monocle: {
                ...getAmuletAtlasPresentation('monocle'),
                name: 'Monocle',
                description: '10% chance to find a crystal when killing an enemy',
                rarity: 'uncommon',
                crystalOnKillChance: 0.1,
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
                rarity: 'uncommon',
                strategyRangedMarch: true,
            },
            runeOfFire: {
                ...getAmuletAtlasPresentation('runeOfFire'),
                name: 'Rune of Fire',
                description: 'Fire gem splash radius x1.5',
                rarity: 'uncommon',
                fireSplashRadiusMultiplier: 1.5,
            },
            runeOfZap: {
                ...getAmuletAtlasPresentation('runeOfZap'),
                name: 'Rune of Zap',
                description: 'Lightning gems bounce to 1 extra enemy',
                rarity: 'uncommon',
                lightningExtraBounces: 1,
            },
            runeOfPoison: {
                ...getAmuletAtlasPresentation('runeOfPoison'),
                name: 'Rune of Poison',
                description: 'Poison gems also poison 1 nearby enemy in fire-gem range',
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
                name: 'Greater Rune of Fire',
                description: '+20% fire gem damage (rounded up)',
                rarity: 'rare',
                fireGemDamageBonus: 0.2,
            },
            greaterRuneOfZap: {
                ...getAmuletAtlasPresentation('greaterRuneOfZap'),
                name: 'Greater Rune of Zap',
                description: '+20% Zap gem damage (rounded up)',
                rarity: 'rare',
                zapGemDamageBonus: 0.2,
            },
            greaterRuneOfPoison: {
                ...getAmuletAtlasPresentation('greaterRuneOfPoison'),
                name: 'Greater Rune of Poison',
                description: '+2 poison gem tick damage',
                rarity: 'rare',
                poisonGemTickBonus: 2,
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
                name: 'Close Order',
                description: 'The first time two or more enemies are revealed they swap with face-down cards to stand as row or column neighbors.',
                rarity: 'rare',
                strategyCluster: true,
            },

            legendaryWhetstone: {
                ...getAmuletAtlasPresentation('legendaryWhetstone'),
                name: 'Legendary Whetstone',
                description: '40% chance not to spend weapon durability on attack and +10% weapon damage. Replaces Weapon Durability earrings.',
                rarity: 'legendary',
                weaponDurabilitySaveChance: 0.4,
                modifyWeaponDamage: (damage) => Math.ceil(damage * 1.1),
                replaces: ['earringOfWeaponDurability', 'earringOfGreaterWeaponDurability'],
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
                name: "General's Table",
                description: 'Once per act, on the map, you may pick any room on the next floor instead of following the branches.',
                rarity: 'legendary',
                strategyDetour: true,
            },
        
        };
    }).call(mgr);
}

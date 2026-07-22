// Current offerable amulet catalog (common → legendary).
import { getAmuletAtlasPresentation } from './RelicsOthersAtlas.js';

/** @param {object} mgr AmuletManager instance (bound as `this` for arrow hooks). */
export function buildCurrentAmuletDefinitions(mgr) {
    return (function () {
        const hp = (bonus) => ({
            maxHealthBonus: bonus,
            onEquip() {
                this.gameState.maxHealth += bonus;
                this.gameState.playerHealth += bonus;
            },
            onUnequip() {
                this.gameState.maxHealth = Math.max(1, this.gameState.maxHealth - bonus);
                this.gameState.playerHealth = Math.min(
                    this.gameState.playerHealth,
                    this.gameState.maxHealth
                );
            },
        });

        return {

            amuletOfEvasion: {
                ...getAmuletAtlasPresentation('amuletOfEvasion'),
                name: 'Amulet of Evasion',
                description: '10% dodge chance',
                rarity: 'common',
                dodgeChance: 0.1,
            },
            ringOfHealth: {
                ...getAmuletAtlasPresentation('ringOfHealth'),
                name: 'Ring of Health',
                description: '+15 max HP',
                rarity: 'common',
                ...hp(15),
            },
            amuletOfProtection: {
                ...getAmuletAtlasPresentation('amuletOfProtection'),
                name: 'Amulet of Protection',
                description: 'Reduce all incoming damage by 20% (rounded up)',
                rarity: 'common',
                modifyDamageTaken: (damage) => Math.ceil(damage * 0.8),
            },
            ringOfRegeneration: {
                ...getAmuletAtlasPresentation('ringOfRegeneration'),
                name: 'Ring of Regeneration',
                description: '+10 HP at the start of each combat floor',
                rarity: 'common',
                floorStartHeal: 10,
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

            amuletOfGreaterEvasion: {
                ...getAmuletAtlasPresentation('amuletOfGreaterEvasion'),
                name: 'Amulet of Greater Evasion',
                description: '20% dodge chance. Replaces Amulet of Evasion.',
                rarity: 'uncommon',
                dodgeChance: 0.2,
                replaces: ['amuletOfEvasion'],
            },
            ringOfGreaterHealth: {
                ...getAmuletAtlasPresentation('ringOfGreaterHealth'),
                name: 'Ring of Greater Health',
                description: '+20 max HP. Replaces Ring of Health.',
                rarity: 'uncommon',
                ...hp(20),
                replaces: ['ringOfHealth'],
            },
            amuletOfGreaterProtection: {
                ...getAmuletAtlasPresentation('amuletOfGreaterProtection'),
                name: 'Amulet of Greater Protection',
                description: 'Reduce all incoming damage by 30% (rounded up). Replaces Amulet of Protection.',
                rarity: 'uncommon',
                modifyDamageTaken: (damage) => Math.ceil(damage * 0.7),
                replaces: ['amuletOfProtection'],
            },
            ringOfGreaterRegeneration: {
                ...getAmuletAtlasPresentation('ringOfGreaterRegeneration'),
                name: 'Ring of Greater Regeneration',
                description: '+15 HP at the start of each combat floor. Replaces Ring of Regeneration.',
                rarity: 'uncommon',
                floorStartHeal: 15,
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
            runeOfFire: {
                ...getAmuletAtlasPresentation('runeOfFire'),
                name: 'Rune of Fire',
                description: '+20% fire gem damage (rounded up)',
                rarity: 'rare',
                fireGemDamageBonus: 0.2,
            },
            runeOfZap: {
                ...getAmuletAtlasPresentation('runeOfZap'),
                name: 'Rune of Zap',
                description: '+20% Zap gem damage (rounded up)',
                rarity: 'rare',
                zapGemDamageBonus: 0.2,
            },
            runeOfPoison: {
                ...getAmuletAtlasPresentation('runeOfPoison'),
                name: 'Rune of Poison',
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

            philosophersStone: {
                ...getAmuletAtlasPresentation('philosophersStone'),
                name: "Philosopher's Stone",
                description: '+20 max HP and +8 HP at the start of each combat floor. Replaces Health and Regeneration rings.',
                rarity: 'legendary',
                ...hp(20),
                floorStartHeal: 8,
                replaces: [
                    'ringOfHealth',
                    'ringOfGreaterHealth',
                    'ringOfRegeneration',
                    'ringOfGreaterRegeneration',
                ],
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
            lostNobleDiadem: {
                ...getAmuletAtlasPresentation('lostNobleDiadem'),
                name: 'Lost Noble Diadem',
                description: 'Prevents death once per run and heals 50% max HP',
                rarity: 'legendary',
                usesPerRun: 1,
                onLethalDamage: () => {
                    const data = this.getAmuletData('lostNobleDiadem');
                    if (data?.usesLeft > 0) {
                        data.usesLeft--;
                        const healAmount = Math.ceil(this.gameState.maxHealth * 0.5);
                        this.gameState.playerHealth = Math.min(
                            this.gameState.maxHealth,
                            this.gameState.playerHealth + healAmount
                        );
                        if (this.scene?.playerAvatar) {
                            this.scene.createFloatingText(
                                this.scene.playerAvatar.x,
                                this.scene.playerAvatar.y,
                                'INVULNERABLE!',
                                0xffd700
                            );
                        }
                        return true;
                    }
                    return false;
                },
            },
            glovesOfHermitWizard: {
                ...getAmuletAtlasPresentation('glovesOfHermitWizard'),
                name: 'Gloves of the Hermit Wizard',
                description: '+35% damage from all gems (rounded up). Replaces Fire/Zap/Poison runes.',
                rarity: 'legendary',
                allGemDamageBonus: 0.35,
                replaces: ['runeOfFire', 'runeOfZap', 'runeOfPoison'],
            },
        
        };
    }).call(mgr);
}

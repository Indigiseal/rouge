import { CardDataGenerator } from '../loot/CardDataGenerator.js';
import { applyArmorTalentMods } from '../../content/talents/index.js';
import {
    createWeaponCardData,
    createArmorCardData,
    potionNameForHealAmount,
    foodNameForActionAmount,
} from '../../content/cards/index.js';

export const CardMergeRules = {
    canCardsMerge(cardA, cardB, canCrossTier = false) {
        cardA = this.normalizeCardIdentity(cardA);
        cardB = this.normalizeCardIdentity(cardB);
        if (!cardA || !cardB) return false;
        if (cardA.type === 'companion' || cardB.type === 'companion') return false;
        if (cardA.type === 'magic' || cardB.type === 'magic') return false;
        if (cardA.type === 'gem' || cardB.type === 'gem') return false;
        if (cardA.type === 'key' || cardB.type === 'key') return false;
        if (cardA.type !== cardB.type) return false;
        if (!canCrossTier && cardA.rarity !== cardB.rarity) return false;
        if (this.getMergeKey(cardA) !== this.getMergeKey(cardB)) return false;
        if (!canCrossTier && this.getMergeStatsKey(cardA) !== this.getMergeStatsKey(cardB)) return false;
        return true;
    },
    getMergeKey(card) {
        card = this.normalizeCardIdentity(card);
        if (!card) return '';
        if (card.type === 'weapon') return `weapon:${this.getWeaponTypeFromCard(card)}`;
        if (card.type === 'armor') return `armor:${this.getArmorTypeFromCard(card)}`;
        if (card.type === 'thorns') return 'thorns';
        if (card.type === 'potion') return `potion:${card.healAmount ? 'healing' : card.name || card.sprite}`;
        if (card.type === 'food') return `food:${card.actionAmount ? 'action' : card.name || card.sprite}`;
        return `${card.type}:${card.id || card.sprite || card.name}`;
    },
    getMergeStatsKey(card) {
        card = this.normalizeCardIdentity(card);
        if (!card) return '';
        if (card.type === 'weapon') {
            const canonical = this.getCanonicalWeaponStats(card);
            if (canonical) {
                return [
                    canonical.damage || 0,
                    canonical.special || '',
                    canonical.range || 'melee',
                    canonical.poisonDamage || 0,
                    canonical.poisonTurns || 0,
                    canonical.poisonStackable ? 1 : 0
                ].join('|');
            }
            return [
                card.damage || 0,
                card.special || '',
                card.range || 'melee',
                card.poisonDamage || 0,
                card.poisonTurns || 0,
                card.poisonStackable ? 1 : 0
            ].join('|');
        }
        if (card.type === 'armor') {
            const canonical = this.getCanonicalArmorStats(card);
            if (canonical) {
                return [
                    canonical.protection || 0,
                    canonical.dodgeChance || 0,
                    canonical.reflection || 0
                ].join('|');
            }
            return [
                card.protection || 0,
                card.dodgeChance || 0,
                card.reflection || 0
            ].join('|');
        }
        if (card.type === 'thorns') return `${card.thornDamage || 0}`;
        if (card.type === 'potion') return `${card.healAmount || 0}`;
        if (card.type === 'food') return `${card.actionAmount || 0}`;
        return '';
    },
    getCanonicalWeaponStats(card) {
        const weaponType = this.getWeaponTypeFromCard(card);
        const rarity = card?.rarity;
        return this.scene?.cardSystem?.cardDataGenerator?.weapons?.[weaponType]?.[rarity]
            || this.scene?.cardSystem?.cardDataGenerator?.weaponUnlocks?.[weaponType]?.[rarity]
            || null;
    },
    getCanonicalArmorStats(card) {
        const armorType = this.getArmorTypeFromCard(card);
        const rarity = card?.rarity;
        return this.scene?.cardSystem?.cardDataGenerator?.armors?.[armorType]?.[rarity]
            || this.scene?.cardSystem?.cardDataGenerator?.armorUnlocks?.[armorType]?.[rarity]
            || null;
    },
    // Heal legacy off-canonical stats so same-rarity cards never display
    // different values. Thorns power is purely a function of rarity (see
    // CardDataGenerator.getThornStats), but the old merge formula could stamp a
    // rare with 4 damage instead of the canonical 3 — snap it back so it reads
    // correctly and merges with shop copies again. New merges are already
    // canonical, so this only ever touches cards from older saves.
    canonicalizeCardStats(card) {
        if (card?.type === 'thorns' && card.rarity) {
            const canonical = this.scene?.cardSystem?.cardDataGenerator?.getThornStats?.(card.rarity);
            if (canonical && typeof canonical.thornDamage === 'number') {
                card.thornDamage = canonical.thornDamage;
            }
        }
        return card;
    },
    normalizeCardIdentity(card) {
        if (!card || (card.type !== 'armor' && card.type !== 'weapon')) return card;

        const unlocks = card.type === 'armor'
            ? this.scene?.cardSystem?.cardDataGenerator?.armorUnlocks
            : this.scene?.cardSystem?.cardDataGenerator?.weaponUnlocks;
        if (!unlocks) return card;

        const family = card.type === 'armor'
            ? this.getArmorTypeFromCard(card)
            : this.getWeaponTypeFromCard(card);
        const tiers = unlocks[family];
        if (!tiers) return card;

        const nameRarity = this.getRarityFromName(card.name);
        const statRarity = Object.entries(tiers).find(([, data]) => (
            card.type === 'armor'
                ? data.protection === card.protection
                : data.damage === card.damage
        ))?.[0];
        const fixedRarity = nameRarity && tiers[nameRarity] ? nameRarity : statRarity;
        if (!fixedRarity || card.rarity === fixedRarity) return card;

        card.rarity = fixedRarity;
        return card;
    },
    getRarityFromName(name = '') {
        const text = name.toString().toLowerCase();
        if (text.includes('legendary')) return 'legendary';
        if (text.includes('epic')) return 'epic';
        if (text.includes('uncommon')) return 'uncommon';
        if (text.includes('common')) return 'common';
        if (text.includes('rare')) return 'rare';
        return '';
    },
    normalizeCardText(value) {
        return (value || '').toString().toLowerCase().replace(/[_\-\s]+/g, '');
    },
    getWeaponTypeFromCard(card) {
        if (!card) return '';
        if (card.weaponType) return card.weaponType;

        const text = this.normalizeCardText(`${card.name || ''} ${card.sprite || ''} ${card.id || ''}`);
        if (text.includes('dagger')) return 'dagger';
        if (text.includes('bow')) return 'bow';
        if (text.includes('sword')) return 'sword';
        if (text.includes('axe')) return 'axe';

        return card.sprite || card.name || '';
    },
    getArmorTypeFromCard(card) {
        if (!card) return '';
        if (card.armorType) return card.armorType;

        const text = this.normalizeCardText(`${card.name || ''} ${card.sprite || ''} ${card.id || ''}`);
        if (text.includes('leather')) return 'leather';
        if (text.includes('chain')) return 'chain';
        if (text.includes('plate')) return 'plate';

        return card.sprite || card.name || '';
    },
    createMergedCard(baseCard, secondCard) {
        // Get the next rarity tier
        const rarityMap = {
            common: 'uncommon',
            uncommon: 'rare',
            rare: 'epic',
            epic: 'legendary'
        };
        const newRarity = rarityMap[baseCard.rarity] || 'legendary';
        
        // Use CardDataGenerator to create the proper upgraded card
        let upgradedCard;
        
        if (baseCard.type === 'weapon') {
            upgradedCard = this.scene.cardSystem.createCardData('weapon', this.scene.gameState.currentFloor);
            // Override with specific weapon type and rarity
            upgradedCard = this.forceWeaponTypeAndRarity(upgradedCard, baseCard, newRarity);
        } else if (baseCard.type === 'armor') {
            upgradedCard = this.scene.cardSystem.createCardData('armor', this.scene.gameState.currentFloor);
            // Override with specific armor type and rarity  
            upgradedCard = this.forceArmorTypeAndRarity(upgradedCard, baseCard, newRarity);
        } else if (baseCard.type === 'thorns') {
            // Rebuild from the canonical per-rarity table (createThornsCard) so a
            // merged thorns matches a shop thorns of the same rarity exactly — a
            // rare is always 3 damage, never an off-table 4. No more "why is my
            // merged thorns stronger than the shop one?" mismatch.
            upgradedCard = this.scene.cardSystem.createCardData(
                'thorns', this.scene.gameState.currentFloor, false, null, newRarity
            );
        } else if (baseCard.type === 'potion') {
            // Climb the canonical potion ladder (35 -> 70 -> 110 -> 200) instead
            // of multiplying into off-ladder heal values that got mislabeled
            // (e.g. a 63-heal potion named "Strong"). A merged potion is now
            // always a real shop-tier potion.
            upgradedCard = this.scene.cardSystem.cardDataGenerator.getUpgradedPotion(baseCard.healAmount || 0);
        } else {
            // Food (and any other simple item): keep the multiplier upgrade.
            const multiplier = newRarity === 'uncommon' ? 1.8 : newRarity === 'rare' ? 2.5 : 3;
            const actionAmount = baseCard.actionAmount ? Math.floor(baseCard.actionAmount * multiplier) : undefined;
            upgradedCard = {
                ...baseCard,
                name: baseCard.type === 'food'
                    ? this.getFoodNameForActionAmount(actionAmount)
                    : baseCard.name?.replace(/Common|Uncommon|Rare/, newRarity.charAt(0).toUpperCase() + newRarity.slice(1)),
                rarity: newRarity,
                actionAmount,
                sprite: baseCard.sprite
            };
        }
        
        // Merging fully refreshes durability — the upgraded card already
        // comes out at maxDurability from forceWeaponTypeAndRarity/forceArmor...
        // (Previous behavior summed the two worn-down cards' remaining pips,
        // which meant two beat-up daggers gave a weak uncommon dagger.)
        if (baseCard.type === 'weapon' || baseCard.type === 'armor' || baseCard.type === 'thorns') {
            upgradedCard.durability = upgradedCard.maxDurability;
            this.scene.createFloatingText(512, 380, `Refreshed: ${upgradedCard.maxDurability} pips`, 0x00ff00);
        }

        // Briar upgrades belong to the card, not its current rarity. Carry the
        // permanent bonus through merging, combining it when both inputs were blessed.
        if (baseCard.type === 'weapon' || baseCard.type === 'armor') {
            const briarBonus = (baseCard.briarDamageBonus || 0) + (secondCard.briarDamageBonus || 0);
            if (briarBonus > 0) {
                upgradedCard.briarDamageBonus = briarBonus;
                if (baseCard.type === 'weapon') {
                    upgradedCard.damage = (upgradedCard.damage || 0) + briarBonus;
                } else {
                    upgradedCard.thornDamage = briarBonus;
                }
            }
        }

        if (baseCard.type === 'weapon') {
            const baseGem = baseCard.gemEffect ? baseCard : null;
            const secondGem = secondCard.gemEffect ? secondCard : null;

            if (baseGem && secondGem && baseGem.gemEffect === secondGem.gemEffect) {
                // Same gem type — combine stacks, clamp to new rarity's slots.
                // Overflow discard UI: docs/OPEN-QUESTIONS.md.
                upgradedCard.gemEffect = baseGem.gemEffect;
                upgradedCard.gemName = baseGem.gemName;
                upgradedCard.gemColor = baseGem.gemColor;
                const slots = CardDataGenerator.weaponGemSlots(upgradedCard);
                upgradedCard.gemCount = Math.min(
                    slots,
                    (baseGem.gemCount || 1) + (secondGem.gemCount || 1)
                );
            } else {
                // Different (or only one) — take whichever has a gem, clamp to slots.
                const gemSource = baseGem || secondGem;
                if (gemSource) {
                    upgradedCard.gemEffect = gemSource.gemEffect;
                    upgradedCard.gemName = gemSource.gemName;
                    upgradedCard.gemColor = gemSource.gemColor;
                    const slots = CardDataGenerator.weaponGemSlots(upgradedCard);
                    upgradedCard.gemCount = Math.min(slots, gemSource.gemCount || 1);
                }
            }
        }
        
        return upgradedCard;
    },
    getPotionNameForHealAmount(healAmount = 0) {
        return potionNameForHealAmount(healAmount);
    },
    getFoodNameForActionAmount(actionAmount = 0) {
        return foodNameForActionAmount(actionAmount);
    },
    forceWeaponTypeAndRarity(generatedCard, originalCard, targetRarity) {
        const weaponType = this.getWeaponTypeFromCard(originalCard);
        return createWeaponCardData(weaponType, targetRarity) || generatedCard;
    },
    forceArmorTypeAndRarity(generatedCard, originalCard, targetRarity) {
        const armorType = this.getArmorTypeFromCard(originalCard);
        const card = createArmorCardData(armorType, targetRarity);
        if (!card) return generatedCard;
        applyArmorTalentMods(card, this.scene.gameState?.talentEffects);
        return card;
    },
    getWeaponTypeFromName(name) {
        return this.getWeaponTypeFromCard({ name });
    },
    getArmorTypeFromName(name) {
        return this.getArmorTypeFromCard({ name });
    },
};

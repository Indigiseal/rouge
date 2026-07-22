import { CardSystem } from '../systems/CardSystem.js';
import { SoundHelper } from '../audio/SoundHelper.js';
import { t, translateItemName } from '../i18n/i18n.js';
import { createTitle } from '../ui/titleText.js';
import { StationRoomBase } from './StationRoomBase.js';
import { openAmuletChoiceOverlay } from '../ui/AmuletChoiceOverlay.js';
import {
    createWeaponCardData,
    isWeaponSpawnableAtFloor,
} from '../content/cards/index.js';
import {
    RARE_SHOP_COMPANION_CHANCE,
    RARE_SHOP_COMPANION_CRYSTAL_EXTRA,
    rareShopAmuletCrystalPrice,
    rareShopArmorPrice,
    rareShopBonusItemPrice,
    rareShopGemPrice,
    rareShopThornsPrice,
    rareShopWeaponPrice,
} from '../content/economy/shop.js';

export class RareShopScene extends StationRoomBase {
    constructor() {
        super({ key: 'RareShopScene' });
    }

    create(data) {
        this.gameState = data.gameState;
        this.shopItems = [];

        this.gameScene = this.scene.get('GameScene');
        this.enableShopStation();

        createTitle(this, 320, 30, t(this, 'ui.shop.rareTitle'), {
            color: '#DA70D6',
            fallbackSize: '28px'
        });

        this.shopBoardTexture = 'gamingBoard2';
        this.generateShopItems();
        this.displayShopItems();
        this.createShopIllustrationBoard(0, 1, 174);

        this.createStationContinueButton(595, 50, 'Next', () => this.closeStation());
    }

    generateShopItems() {
        const cardGenerator = new CardSystem(this);
        const floor = this.gameState.currentFloor;

        // The rare shop is the premium store — its goods cost a clear premium.
        // 1. Amulet offer (costs crystals) — uncommon/rare/legendary by rates
        const amuletData = cardGenerator.createCardData('amulet', floor, false, this.gameState, 'rare_shop');
        let amuletPrice = null;
        if (amuletData) {
            amuletPrice = rareShopAmuletCrystalPrice(amuletData, floor);
            this.shopItems.push({
                data: amuletData,
                price: amuletPrice,
                currency: 'crystals',
                purchased: false
            });
        }

        // 2. Uncommon weapon (rescue option)
        const firstWeapon = this.createUpgradedWeapon();
        this.shopItems.push({
            data: firstWeapon,
            price: rareShopWeaponPrice(floor),
            currency: 'coins',
            purchased: false
        });

        // 3. Uncommon armor — always pair the weapon with a piece of armor so the
        // shop offers a weapon AND armor instead of two of the same weapon type
        // (the uncommon weapon pool can be a single type, e.g. dagger-only).
        const armorData = cardGenerator.createCardData('armor', floor, false, this.gameState,
            cardGenerator.capRewardRarity('uncommon', floor));
        this.shopItems.push({
            data: armorData || this.createUpgradedWeapon(firstWeapon?.weaponType),
            price: rareShopArmorPrice(floor),
            currency: 'coins',
            purchased: false
        });

        // 4. Thorns card — capped by act so it follows the same reward-tier
        // schedule (uncommon in act 1, rare in act 2, etc).
        this.shopItems.push({
            data: cardGenerator.createCardData('thorns', floor, false, null, cardGenerator.capRewardRarity('rare', floor)),
            price: rareShopThornsPrice(floor),
            currency: 'coins',
            purchased: false
        });

        // 5. One random socket gem
        const gemEffects = ['fire', 'poison', 'lightning'];
        const randomGem = gemEffects[Math.floor(Math.random() * gemEffects.length)];
        this.shopItems.push({
            data: this.createGemCard(randomGem),
            price: rareShopGemPrice(floor),
            currency: 'coins',
            purchased: false
        });

        // Cross-run Chick unlock: after a hero dies following a successful
        // hatch, future heroes have a chance to find the unique companion here.
        const liveInventory = this.gameScene?.inventorySystem?.slots || this.gameState.inventory || [];
        const alreadyHasChick = liveInventory.some(item => item?.id === 'chickCompanion');
        if (this.gameState.heroMemory?.chickRareShopUnlocked
            && !alreadyHasChick
            && amuletPrice != null
            && Math.random() < RARE_SHOP_COMPANION_CHANCE) {
            this.shopItems.push({
                data: cardGenerator.cardDataGenerator.createChickCompanionCard(),
                // Unique companions are priced like an amulet (crystals), a touch
                // dearer — not like a normal coin-priced card.
                price: amuletPrice + RARE_SHOP_COMPANION_CRYSTAL_EXTRA,
                currency: 'crystals',
                purchased: false
            });
        }

        // Cross-run Skeleton Warrior unlock: after a hero who freed the skeleton
        // mage dies, future heroes have a chance to buy the companion here too.
        const alreadyHasSkeleton = liveInventory.some(item => item?.id === 'skeletonWarriorCompanion');
        if (this.gameState.heroMemory?.skeletonRareShopUnlocked
            && !alreadyHasSkeleton
            && amuletPrice != null
            && Math.random() < RARE_SHOP_COMPANION_CHANCE) {
            this.shopItems.push({
                data: cardGenerator.cardDataGenerator.createSkeletonWarriorCompanionCard(),
                // Priced like an amulet (crystals), a touch dearer.
                price: amuletPrice + RARE_SHOP_COMPANION_CRYSTAL_EXTRA,
                currency: 'crystals',
                purchased: false
            });
        }

        // Merchant's Seal bonus slots — even better items in the rare shop
        const bonusSlots = this.gameScene?.amuletManager?.getBonusShopSlots?.() || 0;
        for (let i = 0; i < bonusSlots; i++) {
            const bonusItem = this.createMerchantBonusItem(cardGenerator, floor);
            if (bonusItem) this.shopItems.push(bonusItem);
        }

        // Shuffle
        this.shopItems.sort(() => Math.random() - 0.5);
    }

    // Rare shop's bonus slot — capped via capRewardRarity so it follows the
    // same act-based schedule as boss rewards and chests. Act-3 threshold
    // raised so epics don't appear the instant act 3 starts; they wait until
    // mid-act 3 when the player has the gold for the rare shop anyway.
    createMerchantBonusItem(cardGenerator, floor) {
        const rawQuality = floor >= 38 ? 'epic' : 'rare';
        const quality = cardGenerator.capRewardRarity(rawQuality, floor);
        const type = Math.random() < 0.5 ? 'weapon' : 'armor';
        let item = cardGenerator.createCardData(type, floor, false, null, quality);
        if (!item) return null;
        // Axe & plate are act-3 endgame gear: the rare shop may stock them but never
        // at epic/legendary. Re-roll those types down to rare at most.
        if ((item.weaponType === 'axe' || item.armorType === 'plate') &&
            (item.rarity === 'epic' || item.rarity === 'legendary')) {
            item = cardGenerator.createCardData(type, floor, false, null, 'rare');
            if (!item) return null;
        }
        const price = rareShopBonusItemPrice(floor);
        return { data: item, price, currency: 'coins', purchased: false };
    }

    createGemCard(effect) {
        const gems = {
            fire:      { name: 'Fire Gem',      frame: 0,  color: 0xff7040 },
            poison:    { name: 'Poison Gem',    frame: 6,  color: 0x66ff66 },
            lightning: { name: 'Lightning Gem', frame: 12, color: 0xffe066 }
        };
        const gem = gems[effect] || gems.fire;
        return {
            type: 'gem',
            gemEffect: effect,
            name: gem.name,
            sprite: 'gemsRGY',
            spriteFrame: gem.frame,
            color: gem.color,
            rarity: 'common'
        };
    }

    createUpgradedWeapon(excludeType = null) {
        const floor = this.gameState.currentFloor;
        const weaponTypes = ['dagger', 'bow', 'sword', 'axe'];
        let availableWeapons = weaponTypes.filter((weaponType) => (
            isWeaponSpawnableAtFloor(weaponType, 'uncommon', floor)
        ));

        // Prefer a different weapon type than the one already offered — but only
        // if excluding it still leaves at least one option (on early floors the
        // pool can be a single type, e.g. dagger-only before floor 18).
        if (excludeType && availableWeapons.some((t) => t !== excludeType)) {
            availableWeapons = availableWeapons.filter((t) => t !== excludeType);
        }

        if (availableWeapons.length === 0) {
            return createWeaponCardData('sword', 'uncommon');
        }

        const selectedType = availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
        return createWeaponCardData(selectedType, 'uncommon');
    }

    displayShopItems() {
        // Combat-style board: cards fly in face-down, then flip open one by one.
        this.displayItemsAsBoard();
    }

    getItemDisplayName(item) {
        return translateItemName(this, item) || item?.name || t(this, 'tooltip.item');
    }

    getCurrencyDisplay(currency) {
        return currency === 'crystals'
            ? t(this, 'ui.shop.currencyCrystals')
            : t(this, 'ui.shop.currencyCoins');
    }

    buyItem(item, button) {
        if (item.purchased) return;

        const hasEnoughCurrency = item.currency === 'coins'
            ? this.gameState.coins >= item.price
            : this.gameState.crystals >= item.price;

        if (!hasEnoughCurrency) {
            this.showFeedback({ key: 'float.notEnoughCurrency', vars: { currency: this.getCurrencyDisplay(item.currency) } }, 0xff0000, 100);
            return;
        }

        // Amulets: pay, then pick 1 of 3 of the rolled rarity
        if (item.data.type === 'amulet') {
            if (this.gameScene?.amuletManager) {
                const offer = item.data.pendingChoice && item.data.options?.length ? item.data : null;
                if (offer?.options?.length) {
                    if (item.currency === 'coins') this.gameState.coins -= item.price;
                    else this.gameState.crystals -= item.price;
                    SoundHelper.playSound(this, 'shop_buy', 0.5);
                    item.purchased = true;
                    this.coinsText?.setText?.(t(this, 'ui.shop.coins', { amount: this.gameState.coins }));
                    this.crystalsText?.setText?.(t(this, 'ui.shop.crystals', { amount: this.gameState.crystals }));
                    this.markButtonDone(button, t(this, 'ui.shop.sold'));
                    this.refreshStationInventoryDisplay();
                    openAmuletChoiceOverlay(this, {
                        rarity: offer.rarity,
                        options: offer.options,
                        amuletManager: this.gameScene.amuletManager,
                        title: `Rare shop — ${offer.rarity} amulet`,
                        onPicked: () => this.gameScene?.updateUI?.(),
                    });
                    return;
                }
                if (item.data.id) {
                    if (!this.gameScene.amuletManager.addAmulet(item.data.id)) {
                        this.showFeedback('Already owned!', 0xff0000, 100);
                        return;
                    }
                    this.showFeedback({ key: 'float.equippedItem', vars: { name: this.getItemDisplayName(item.data) } }, 0x9932cc, 100);
                } else {
                    this.consumeAmulet(item.data);
                }
            } else {
                this.consumeAmulet(item.data);
            }
        } else {
            // Inventory items
            if (this.gameScene?.inventorySystem) {
                if (!this.gameScene.inventorySystem.addCard(item.data)) {
                    this.showFeedback('Inventory Full!', 0xff0000, 100);
                    return;
                }
            } else {
                const emptySlot = this.gameState.inventory.findIndex(slot => slot === null);
                if (emptySlot === -1) {
                    this.showFeedback('Inventory Full!', 0xff0000, 100);
                    return;
                }
                this.gameState.inventory[emptySlot] = item.data;
            }
            this.showFeedback('Purchased!', 0x00ff00, 100);
        }

        // Deduct (concrete amulet / non-amulet path)
        if (item.currency === 'coins') this.gameState.coins -= item.price;
        else this.gameState.crystals -= item.price;

        SoundHelper.playSound(this, 'shop_buy', 0.5);
        item.purchased = true;

        this.coinsText?.setText?.(t(this, 'ui.shop.coins', { amount: this.gameState.coins }));
        this.crystalsText?.setText?.(t(this, 'ui.shop.crystals', { amount: this.gameState.crystals }));
        this.markButtonDone(button, t(this, 'ui.shop.sold'));
        this.refreshStationInventoryDisplay();
        this.gameScene?.updateUI?.();
    }

    consumeAmulet(amulet) {
        if (amulet.effect === 'health') {
            this.gameState.maxHealth += amulet.value;
            this.gameState.playerHealth += amulet.value;
            this.showFeedback(`+${amulet.value} Max HP!`, 0x00ff00, 100);
        } else if (amulet.effect === 'max_actions') {
            this.gameState.maxActions += amulet.value;
            this.showFeedback(`+${amulet.value} Max Actions!`, 0x00ff00, 100);
        } else {
            this.showFeedback({ key: 'float.equippedItem', vars: { name: this.getItemDisplayName(amulet) } }, 0x9932cc, 100);
        }
        this.gameState.activeAmulets.push(amulet);
    }
}

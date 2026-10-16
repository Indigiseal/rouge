import { CardSystem } from '../systems/CardSystem.js';
import { SoundHelper } from '../audio/SoundHelper.js';
import { bagArrivalSoundKey } from '../content/audio/armorSounds.js';
import { t, translateItemName } from '../i18n/i18n.js';
import { createTitle } from '../ui/titleText.js';
import { StationRoomBase } from './StationRoomBase.js';
import { flyCurrencyGain } from '../ui/CurrencyFlight.js';
import { openAmuletChoiceOverlay } from '../ui/AmuletChoiceOverlay.js';
import { potionNameForHealAmount, shopPotionCards } from '../content/cards/index.js';
import {
    shopAmuletCrystalPrice,
    shopItemBuyPrice,
    shopItemSellPrice,
} from '../content/economy/shop.js';
import { recordHumanRunEvent, snapshotHumanRunCard } from '../systems/HumanRunRecorder.js';

// The sell box: the discard box's mirror on the right of the bag, same size.
const SELL_ZONE = Object.freeze({ x: 601, y: 314, w: 64, h: 76 });

export class ShopScene extends StationRoomBase {
    constructor() {
        super({ key: 'ShopScene' });
    }

    create(data) {
        this.gameState = data.gameState;
        this.shopItems = [];

        // Get reference to GameScene for inventory access
        this.gameScene = this.scene.get('GameScene');
        this.enableShopStation();
        this.addOptionsCog();

        // Title
        createTitle(this, 320, 20, t(this, 'ui.shop.title'), {
            color: '#fef0cf',
            fallbackSize: '28px'
        });

        // Generate and display shop items
        this.generateShopItems();
        this.displayShopItems();
        this.createShopIllustrationBoard(1, 0, 164);

        // Selling: drag a bag card onto the sell box.
        this.createSellZone();
        this.events.once('shutdown', () => this.destroySellZone());

        // Continue button
        this.createStationContinueButton(595, 50, 'Next', () => this.closeStation());
    }

    // enableShopStation / closeStation now live on StationRoomBase

    // Helper method to get current inventory
    getCurrentInventory() {
        if (this.gameScene && this.gameScene.inventorySystem) {
            return this.gameScene.inventorySystem.slots;
        }
        // Fallback to gameState inventory for backward compatibility
        return this.gameState.inventory || [];
    }

    // Helper method to get inventory size
    getInventorySize() {
        if (this.gameScene && this.gameScene.inventorySystem) {
            return this.gameScene.inventorySystem.slots.length;
        }
        return 5; // Default size
    }

    generateShopItems() {
        /*
        // Hide game scene UI
        if (this.gameScene && this.gameScene.inventorySystem) {
            this.gameScene.inventorySystem.setVisibility(false);
        }
        */

        // Use a temporary CardSystem to generate card data
        const cardGenerator = new CardSystem(this);
        const floor = this.gameState.currentFloor;

        // Clear existing items
        this.shopItems = [];

        // Slots 1-2: two healing potions a tier apart (shopPotionCards).
        shopPotionCards(floor).forEach((potionData) => {
            this.shopItems.push({
                data: potionData,
                price: this.calculateItemPrice(potionData),
                currency: 'coins',
                purchased: false
            });
        });

        // Slot 2: Regular weapon (guaranteed)
        const weaponData = cardGenerator.createCardData('weapon', floor);
        if (weaponData) {
            this.shopItems.push({
                data: weaponData,
                price: this.calculateItemPrice(weaponData),
                currency: 'coins',
                purchased: false
            });
        }

        // Slot 3: Armor (guaranteed) - FIXED to use CardDataGenerator
        const armorData = cardGenerator.createCardData('armor', floor, false, this.gameState);
        if (armorData) {
            const armorPrice = this.calculateItemPrice(armorData);
            this.shopItems.push({
                data: armorData,
                price: armorPrice,
                currency: 'coins',
                purchased: false
            });
        }

        // Slot 5: Thorns Card (guaranteed)
        const thornsData = cardGenerator.createCardData('thorns', floor);
        if (thornsData) {
            const thornsPrice = this.calculateItemPrice(thornsData);
            this.shopItems.push({
                data: thornsData,
                price: thornsPrice,
                currency: 'coins',
                purchased: false
            });
        }

        // Slot 6: Magic Spell (guaranteed)
        const magicData = cardGenerator.createCardData('magic', floor);
        if (magicData) {
            const magicPrice = this.calculateItemPrice(magicData);
            this.shopItems.push({
                data: magicData,
                price: magicPrice,
                currency: 'coins',
                purchased: false
            });
        }

        // Slot 7: Random duplicate from available types (weighted toward weapons)
        const duplicateTypes = ['weapon', 'weapon', 'weapon', 'magic', 'potion', 'thorns', 'armor', 'food'];
        for (let i = 0; i < 1; i++) {
            const randomType = duplicateTypes[Math.floor(Math.random() * duplicateTypes.length)];
            const itemData = cardGenerator.createCardData(randomType, floor);

            if (itemData) {
                const itemPrice = this.calculateItemPrice(itemData);
                this.shopItems.push({
                    data: itemData,
                    price: itemPrice,
                    currency: 'coins',
                    purchased: false
                });
            }
        }

        // Slot 8: Amulet offer (costs CRYSTALS) — rarity rolled, pick 1 of 3 on buy
        const amuletData = cardGenerator.createCardData('amulet', floor, false, this.gameState, 'shop');
        if (amuletData) {
            const crystalPrice = this.calculateAmuletCrystalPrice(amuletData);
            this.shopItems.push({
                data: amuletData,
                price: crystalPrice,
                currency: 'crystals',
                purchased: false
            });
        }

        // Bonus slots from Merchant's Seal — one higher-quality item per amulet stack
        const bonusSlots = this.gameScene?.amuletManager?.getBonusShopSlots?.() || 0;
        for (let i = 0; i < bonusSlots; i++) {
            const bonusItem = this.createMerchantBonusItem(cardGenerator, floor);
            if (bonusItem) this.shopItems.push(bonusItem);
        }

        // A merchant robbed at the toll chain never made it here. Two of the
        // ordinary coin-priced slots are simply missing for the rest of the run
        // — the amulet slot is left alone so the crystal economy is untouched.
        if (this.gameState?.storyRun?.merchantRobbed) {
            this.shopItems = this.thinRobbedShopStock(this.shopItems, 2);
        }
    }

    /**
     * Removes up to `count` coin-priced, unpurchased items. Leaves crystal
     * (amulet) slots and anything already bought alone, and never empties the
     * shop completely — a stall with nothing in it reads as a bug, not a story.
     */
    thinRobbedShopStock(items, count = 2) {
        const removable = items
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => item && !item.purchased && item.currency !== 'crystals');
        const keepAtLeast = 2;
        const canRemove = Math.max(0, Math.min(count, removable.length - keepAtLeast));
        if (canRemove <= 0) return items;

        const doomed = new Set(
            Phaser.Utils.Array.Shuffle(removable.slice()).slice(0, canRemove).map(entry => entry.index)
        );
        return items.filter((_, index) => !doomed.has(index));
    }

    // Creates a higher-rarity weapon or armor that appears as the Merchant's Seal
    // bonus slot. The regular shop tops out at RARE — epics and legendaries are
    // reserved for boss rewards and the rare shop's late-game tier so they stay
    // a treat.
    createMerchantBonusItem(cardGenerator, floor) {
        let quality = floor >= 15 ? 'rare' : 'uncommon';
        const type = Math.random() < 0.5 ? 'weapon' : 'armor';
        let item = cardGenerator.createCardData(type, floor, false, null, quality);
        if (!item) return null;
        // Axe & plate are act-3 endgame gear: shops may stock them but never at
        // epic/legendary. Re-roll those types down to rare at most.
        if ((item.weaponType === 'axe' || item.armorType === 'plate') &&
            (item.rarity === 'epic' || item.rarity === 'legendary')) {
            item = cardGenerator.createCardData(type, floor, false, null, 'rare');
            if (!item) return null;
        }
        const price = this.calculateItemPrice(item);
        return { data: item, price, currency: 'coins', purchased: false };
    }

    calculateAmuletCrystalPrice(amulet) {
        return shopAmuletCrystalPrice(amulet, this.gameState.activeAmulets?.length || 0);
    }

    calculateItemPrice(item, isArtifact = false) {
        return shopItemBuyPrice(item, this.gameState.currentFloor, { isArtifact });
    }

    calculateSellPrice(item) {
        return shopItemSellPrice(item, this.gameState.currentFloor);
    }

    getItemDisplayName(item) {
        if (!item) return t(this, 'tooltip.item');
        if (item.type === 'potion') {
            return translateItemName(this, { ...item, name: this.getPotionDisplayName(item) });
        }
        return translateItemName(this, item) || item.name || t(this, 'tooltip.item');
    }

    getPotionDisplayName(item) {
        return potionNameForHealAmount(item.healAmount || 0);
    }

    getCurrencyDisplay(currency) {
        return currency === 'crystals'
            ? t(this, 'ui.shop.currencyCrystals')
            : t(this, 'ui.shop.currencyCoins');
    }

    displayShopItems() {
        // Combat-style board: cards fly in face-down, then flip open one by one.
        this.displayItemsAsBoard();
    }

    // buildItemCard / createItemSprite / getRarityColor live on StationRoomBase

    capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

    // ─── Selling ─────────────────────────────────────────────────────────────
    // A box beside the bag, the mirror of the discard box on its other side:
    // drag a bag card onto it to sell it. While a card is over it, the price
    // shows above it. (Placeholder look — a dark see-through panel — until
    // its art is drawn.) Drawn in GameScene, with the bag, so a dragged card
    // passes over it instead of under it.
    createSellZone() {
        const inv = this.gameScene?.inventorySystem;
        const host = this.gameScene;
        if (!inv || !host?.add) return;
        this.sellZone = host.add.rectangle(SELL_ZONE.x, SELL_ZONE.y, SELL_ZONE.w, SELL_ZONE.h, 0x0e0b10, 0.55)
            .setStrokeStyle(1, 0x6e7470)
            .setDepth(199);
        this.sellZoneLabel = host.add.text(SELL_ZONE.x, SELL_ZONE.y, t(this, 'ui.shop.sell'), {
            fontSize: '12px', fill: '#d3beb2', fontFamily: '"HoMM Pixel", Arial, sans-serif',
        }).setOrigin(0.5).setDepth(199.5);
        this.sellPriceLabel = host.add.text(SELL_ZONE.x, SELL_ZONE.y - SELL_ZONE.h / 2 - 10, '', {
            fontSize: '12px', fill: '#ffcf7f', fontFamily: '"HoMM Pixel", Arial, sans-serif',
            stroke: '#1c130a', strokeThickness: 3,
        }).setOrigin(0.5, 1).setDepth(3000).setVisible(false);

        inv.addDropZone(this.sellZone, (slotIndex, cardData, cardSprite) => (
            this.sellDroppedCard(slotIndex, cardSprite)
        ), { sound: null });
        inv.onCardDrag = (slotIndex, cardSprite) => this.updateSellPreview(slotIndex, cardSprite);
    }

    destroySellZone() {
        const inv = this.gameScene?.inventorySystem;
        if (inv) {
            inv.clearDropZones?.();
            inv.onCardDrag = null;
        }
        [this.sellZone, this.sellZoneLabel, this.sellPriceLabel].forEach((o) => o?.destroy?.());
        this.sellZone = this.sellZoneLabel = this.sellPriceLabel = null;
    }

    closeStation() {
        this.destroySellZone();
        super.closeStation();
    }

    // The price, shown while a card is held over the box.
    updateSellPreview(slotIndex, cardSprite) {
        if (!this.sellZone?.scene || !this.sellPriceLabel) return;
        const item = slotIndex >= 0 ? this.getCurrentInventory()[slotIndex] : null;
        const over = Boolean(item && cardSprite?.getBounds
            && Phaser.Geom.Intersects.RectangleToRectangle(cardSprite.getBounds(), this.sellZone.getBounds()));
        this.sellZone.setFillStyle(0x0e0b10, over ? 0.8 : 0.55).setStrokeStyle(1, over ? 0xffcf7f : 0x6e7470);
        if (!over) {
            this.sellPriceLabel.setVisible(false);
            return;
        }
        this.sellPriceLabel
            .setText(t(this, 'ui.shop.sellPrice', { price: this.calculateSellPrice(item) }))
            .setVisible(true);
    }

    // A card let go over the box is sold: it leaves the bag the way a
    // discarded one does, and the coins come to the counter.
    sellDroppedCard(slotIndex, cardSprite) {
        const inv = this.gameScene?.inventorySystem;
        const item = inv?.slots?.[slotIndex];
        if (!item) return false;
        this.updateSellPreview(-1, null);
        inv.cleanupCardSprites(slotIndex, cardSprite);
        inv.removeCard(slotIndex, false, 'sold');
        cardSprite?.destroy?.();
        this.completeSale(slotIndex, item, SELL_ZONE.x, SELL_ZONE.y);
        return true;
    }

    // The coins for a card already taken out of the bag (from slot `index`).
    completeSale(index, item, x, y) {
        const sellPrice = this.calculateSellPrice(item);
        const coinsBefore = this.gameState.coins;
        this.gameState.coins += sellPrice;

        SoundHelper.playSound(this, 'coin_collect', 0.4);
        // The sale's coin flies from the sell box to the coin counter.
        flyCurrencyGain(this, x, y, 'coins');
        this.showFeedback({
            key: 'ui.shop.soldFeedback',
            vars: { name: this.getItemDisplayName(item), price: sellPrice, before: coinsBefore, after: this.gameState.coins }
        }, 0xfbad19);

        this.coinsText?.setText?.(t(this, 'ui.shop.coins', { amount: this.gameState.coins }));
        this.refreshStationInventoryDisplay();

        // Update GameScene UI if it exists
        if (this.gameScene && this.gameScene.updateUI) {
            this.gameScene.updateUI();
        }
        recordHumanRunEvent(this, 'shop_item_sold', {
            sourceSlot: index,
            item: snapshotHumanRunCard(item),
            price: sellPrice,
            currency: 'coins',
        });
    }

    buyItem(item, button) {
        if (item.purchased) return;

        // Check currency type
        const hasEnoughCurrency = item.currency === 'crystals'
            ? this.gameState.crystals >= item.price
            : this.gameState.coins >= item.price;

        if (!hasEnoughCurrency) {
            SoundHelper.playVariant(this, 'invalid_action', 0.5);
            this.showFeedback({ key: 'float.notEnoughCurrency', vars: { currency: this.getCurrencyDisplay(item.currency) } }, 0xb51f1e);
            return;
        }

        if (item.data.type === 'gem') {
            this.showFeedback({ key: 'float.dragGemOntoWeapon' }, 0xffcf7f);
            return;
        }

        // Check if it's an amulet - rarity offer opens a 3-pick overlay
        if (item.data.type === 'amulet') {
            if (this.gameScene && this.gameScene.amuletManager) {
                const offer = item.data.pendingChoice && item.data.options?.length
                    ? item.data
                    : null;
                // Never charge for a shelf of amulets the player already owns —
                // the offer was rolled when the shop was built, not now.
                const takeable = this.gameScene.amuletManager.takeableOptions?.(offer?.options)
                    ?? offer?.options ?? [];
                if (offer?.options?.length && !takeable.length) {
                    this.showFeedback({ key: 'float.alreadyOwned' }, 0xb51f1e);
                    return;
                }
                if (takeable.length) {
                    // Charge first, then let the player pick.
                    if (item.currency === 'crystals') {
                        this.gameState.crystals -= item.price;
                        this.crystalsText?.setText?.(t(this, 'ui.shop.crystals', { amount: this.gameState.crystals }));
                    } else {
                        this.gameState.coins -= item.price;
                        this.coinsText?.setText?.(t(this, 'ui.shop.coins', { amount: this.gameState.coins }));
                    }
                    item.purchased = true;
                    this.markButtonDone(button, t(this, 'ui.shop.sold'));
                    SoundHelper.playSound(this, 'shop_buy', 0.5);

                    openAmuletChoiceOverlay(this, {
                        rarity: offer.rarity,
                        options: takeable,
                        amuletManager: this.gameScene.amuletManager,
                        title: `Shop — ${offer.rarity} amulet`,
                        onPicked: () => this.gameScene.updateUI?.(),
                    });
                    return;
                }

                if (item.data.id) {
                    const success = this.gameScene.amuletManager.addAmulet(item.data.id);
                    if (success) {
                        SoundHelper.playSound(this, 'shop_buy', 0.5);
                        if (item.currency === 'crystals') {
                            this.gameState.crystals -= item.price;
                            this.crystalsText?.setText?.(t(this, 'ui.shop.crystals', { amount: this.gameState.crystals }));
                        } else {
                            this.gameState.coins -= item.price;
                            this.coinsText?.setText?.(t(this, 'ui.shop.coins', { amount: this.gameState.coins }));
                        }
                        this.showFeedback({ key: 'float.equippedItem', vars: { name: this.getItemDisplayName(item.data) } }, 0x712a65);
                        item.purchased = true;
                        this.markButtonDone(button, t(this, 'ui.shop.sold'));
                        if (this.gameScene.updateUI) this.gameScene.updateUI();
                    } else {
                        this.showFeedback('Already owned!', 0xb51f1e);
                    }
                }
            }
            return;
        }

        // For non-amulet items, add to inventory system
        let destinationSlot = null;
        if (this.gameScene && this.gameScene.inventorySystem) {
            if (!this.gameScene.inventorySystem.addCard(item.data)) {
                this.showFeedback('Inventory Full!', 0xb51f1e);
                return;
            }
            destinationSlot = this.gameScene.inventorySystem.lastAddedSlot;
        } else {
            // Fallback for old system
            const emptySlot = this.gameState.inventory.findIndex(slot => slot === null);
            if (emptySlot === -1) {
                this.showFeedback('Inventory Full!', 0xb51f1e);
                return;
            }
            this.gameState.inventory[emptySlot] = item.data;
            destinationSlot = emptySlot;
        }

        SoundHelper.playSound(this, bagArrivalSoundKey(this, item.data, 'shop_buy'), 0.5);

        // Deduct appropriate currency
        if (item.currency === 'crystals') {
            this.gameState.crystals -= item.price;
            this.crystalsText?.setText?.(t(this, 'ui.shop.crystals', { amount: this.gameState.crystals }));
        } else {
            this.gameState.coins -= item.price;
            this.coinsText?.setText?.(t(this, 'ui.shop.coins', { amount: this.gameState.coins }));
        }

        item.purchased = true;
        recordHumanRunEvent(this, 'shop_item_bought', {
            shop: 'regular',
            destinationSlot,
            item: snapshotHumanRunCard(item.data),
            price: item.price,
            currency: item.currency,
        });
        this.markButtonDone(button, t(this, 'ui.shop.sold'));
        this.showFeedback('Purchased!', 0x71800b);
        this.refreshStationInventoryDisplay();

        // Update GameScene UI
        if (this.gameScene && this.gameScene.updateUI) {
            this.gameScene.updateUI();
        }
    }

    // showFeedback lives on StationRoomBase
}

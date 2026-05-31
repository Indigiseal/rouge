import { CardSystem } from '../cardSystem.js';
import { SoundHelper } from '../utils/SoundHelper.js';
import { StationRoomBase } from './StationRoomBase.js';

export class RareShopScene extends StationRoomBase {
    constructor() {
        super({ key: 'RareShopScene' });
    }

    create(data) {
        this.gameState = data.gameState;
        this.shopItems = [];

        this.gameScene = this.scene.get('GameScene');
        this.enableShopStation();

        this.add.text(320, 30, 'Rare Goods', {
            fontSize: '28px',
            fill: '#DA70D6',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);

        this.coinsText = this.add.text(450, 60, `Coins: ${this.gameState.coins}`, {
            fontSize: '16px',
            fill: '#ffd700',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);

        this.crystalsText = this.add.text(190, 60, `Crystals: ${this.gameState.crystals}`, {
            fontSize: '16px',
            fill: '#00ffff',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);

        const _rareAct = Math.floor((this.gameState.currentFloor - 1) / 15) + 1;
        this.add.text(580, 12, `Act ${_rareAct}  Floor ${this.gameState.currentFloor}`, {
            fontSize: '11px',
            fill: '#a78f70',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);

        this.generateShopItems();
        this.displayShopItems();

        this.add.text(320, 330, 'Continue to Next Floor', {
            fontSize: '18px',
            fill: '#00ff00',
            fontFamily: '"HoMM Pixel"'
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.closeStation());
    }

    generateShopItems() {
        const cardGenerator = new CardSystem(this);
        const floor = this.gameState.currentFloor;

        // The rare shop is the premium store — its goods cost a clear premium.
        // 1. Amulet (costs crystals)
        const amuletData = cardGenerator.createCardData('amulet', floor, false, this.gameState);
        this.shopItems.push({
            data: amuletData,
            price: Math.max(2, Math.floor(floor / 10) + 2),
            currency: 'crystals',
            purchased: false
        });

        // 2. Uncommon weapon (rescue option)
        this.shopItems.push({
            data: this.createUpgradedWeapon(),
            price: 20 + floor * 5,
            currency: 'coins',
            purchased: false
        });

        // 3. Second uncommon weapon
        this.shopItems.push({
            data: this.createUpgradedWeapon(),
            price: 25 + floor * 5,
            currency: 'coins',
            purchased: false
        });

        // 4. Thorns card — capped by act so it follows the same reward-tier
        // schedule (uncommon in act 1, rare in act 2, etc).
        this.shopItems.push({
            data: cardGenerator.createCardData('thorns', floor, false, null, cardGenerator.capRewardRarity('rare', floor)),
            price: 15 + floor * 4,
            currency: 'coins',
            purchased: false
        });

        // 5. One random socket gem
        const gemEffects = ['fire', 'poison', 'lightning'];
        const randomGem = gemEffects[Math.floor(Math.random() * gemEffects.length)];
        this.shopItems.push({
            data: this.createGemCard(randomGem),
            price: 18 + floor * 4,
            currency: 'coins',
            purchased: false
        });

        // Merchant's Pact bonus slots — even better items in the rare shop
        const bonusSlots = this.gameScene?.amuletManager?.getBonusShopSlots?.() || 0;
        for (let i = 0; i < bonusSlots; i++) {
            const bonusItem = this.createMerchantBonusItem(cardGenerator, floor);
            if (bonusItem) this.shopItems.push(bonusItem);
        }

        // Shuffle
        this.shopItems.sort(() => Math.random() - 0.5);
    }

    // Rare shop's bonus slot — capped via capRewardRarity so it follows the
    // same act-based schedule as boss rewards and chests.
    createMerchantBonusItem(cardGenerator, floor) {
        const rawQuality = floor >= 30 ? 'epic' : 'rare';
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
        const price = 30 + floor * 5;
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

    createUpgradedWeapon() {
        const cardGenerator = new CardSystem(this);
        const floor = this.gameState.currentFloor;

        const weaponTypes = ['dagger', 'spear', 'sword', 'axe'];
        const availableWeapons = [];

        weaponTypes.forEach(weaponType => {
            const weaponUnlocks = cardGenerator.cardDataGenerator.weaponUnlocks[weaponType];
            if (weaponUnlocks && weaponUnlocks.uncommon && floor >= weaponUnlocks.uncommon.floor) {
                availableWeapons.push({ type: weaponType, data: weaponUnlocks.uncommon });
            }
        });

        if (availableWeapons.length === 0) {
            return {
                type: 'weapon',
                name: 'Uncommon Sword',
                weaponType: 'sword',
                damage: 7,
                rarity: 'uncommon',
                sprite: 'sword_U',
                special: null,
                range: 'melee',
                durability: 8,
                maxDurability: 8
            };
        }

        const selected = availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
        const weaponData = selected.data;
        const weaponName = selected.type.charAt(0).toUpperCase() + selected.type.slice(1);

        const durabilityMap = {
            dagger: 5, spear: 6, sword: 8, axe: 8
        };
        const maxDurability = durabilityMap[selected.type] ?? 6;

        return {
            type: 'weapon',
            name: `Uncommon ${weaponName}`,
            weaponType: selected.type,
            damage: weaponData.damage,
            rarity: 'uncommon',
            sprite: weaponData.sprite,
            special: weaponData.special,
            range: weaponData.range || 'melee',
            poisonDamage: weaponData.poisonDamage || 0,
            poisonTurns: weaponData.poisonTurns || 0,
            poisonStackable: weaponData.poisonStackable || false,
            durability: maxDurability,
            maxDurability: maxDurability
        };
    }

    displayShopItems() {
        // Combat-style board: cards fly in face-down, then flip open one by one.
        this.displayItemsAsBoard();
    }

    buyItem(item, button) {
        if (item.purchased) return;

        const hasEnoughCurrency = item.currency === 'coins'
            ? this.gameState.coins >= item.price
            : this.gameState.crystals >= item.price;

        if (!hasEnoughCurrency) {
            this.showFeedback(`Not enough ${item.currency}!`, 0xff0000, 100);
            return;
        }

        // Amulets go straight to the amulet manager
        if (item.data.type === 'amulet') {
            if (this.gameScene?.amuletManager && item.data.id) {
                if (!this.gameScene.amuletManager.addAmulet(item.data.id)) {
                    this.showFeedback('Already owned!', 0xff0000, 100);
                    return;
                }
                this.showFeedback(`${item.data.name} equipped!`, 0x9932cc, 100);
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

        // Deduct
        if (item.currency === 'coins') this.gameState.coins -= item.price;
        else this.gameState.crystals -= item.price;

        SoundHelper.playSound(this, 'shop_buy', 0.5);
        item.purchased = true;

        this.coinsText.setText(`Coins: ${this.gameState.coins}`);
        this.crystalsText.setText(`Crystals: ${this.gameState.crystals}`);
        this.markButtonDone(button, 'Sold');
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
            this.showFeedback(`${amulet.name} equipped!`, 0x9932cc, 100);
        }
        this.gameState.activeAmulets.push(amulet);
    }
}

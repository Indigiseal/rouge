// Base class shared by Shop, RareShop and the boss reward room.
// Handles inventory station mode, common card UI, currency feedback and
// loot scatter effects so the individual scenes can focus on their unique
// generation/buy logic.

import { CardSystem } from '../cardSystem.js';
import { SoundHelper } from '../utils/SoundHelper.js';
import { showItemTooltip, hideItemTooltip } from '../utils/ItemTooltip.js';
import { snapOriginToPixelGrid } from '../utils/PixelSnap.js';
import { t } from '../utils/i18n.js';

export class StationRoomBase extends Phaser.Scene {
    // ─── Inventory station mode ──────────────────────────────────────────────

    enableShopStation() {
        this.gameScene = this.gameScene || this.scene.get('GameScene');
        if (!this.gameScene?.inventorySystem) return;
        this.scene.wake('GameScene', { shopStation: true });
        this.gameScene.inventorySystem.setStationMode(true);
        this.gameScene.inventorySystem.setVisibility(true);
    }

    closeStation() {
        this.clearShopBoard();
        this.stationInventoryLayerActive = false;
        if (this.gameScene?.inventorySystem) {
            this.gameScene.inventorySystem.setStationMode(false);
            this.restoreGameInventoryLayering();
            this.gameScene.inventorySystem.setVisibility(false);
            this.scene.sleep('GameScene');
        }
        this.scene.stop();
        this.scene.wake('MapViewScene');
    }

    // ─── Card UI ─────────────────────────────────────────────────────────────

    // Renders an item sprite at native size with no scaling. Returns null when
    // the texture isn't loaded — callers should guard.
    createItemSprite(data, x, y) {
        if (!data?.sprite || !this.textures.exists(data.sprite)) return null;
        return snapOriginToPixelGrid(data.spriteFrame !== undefined
            ? this.add.image(x, y, data.sprite, data.spriteFrame)
            : this.add.image(x, y, data.sprite));
    }

    // Helper — flips a button to its "done" state. Use after a successful buy/take.
    markButtonDone(button, label) {
        button.setText(label).setStyle({ fill: '#888888' }).removeInteractive();
    }

    // ─── Combat-style item board ───────────────────────────────────────────────
    // Lays the shop's items out on the gaming board exactly like a battle floor:
    // the board tweens in, every item starts face-down, then the cards flip open
    // one after another from the top-left. Each card gets a small price label.
    //
    // Requires this.shopItems to be populated and the scene to implement buyItem.
    displayItemsAsBoard() {
        // Tear down any previous board visuals
        this.clearShopBoard();

        const boardHelper = new CardSystem(this);
        this.boardHelper = boardHelper;
        this.shopCards = [];
        this.shopBoardObjects = [];
        const renderScene = this.gameScene || this;

        const n = this.shopItems.length;
        if (n === 0) return;

        // Keep buy cards clear of the inventory bar while the board art can tuck behind it.
        const SHOP_BOARD_BOTTOM = 336;
        const SHOP_BOARD_Y_OFFSET = -20;
        const cells = boardHelper.buildCompactBrickCluster(n);
        const place = boardHelper.computePlacement(cells, {
            areaBottom: SHOP_BOARD_BOTTOM,
        });
        place.cx -= 46;
        place.cy += SHOP_BOARD_Y_OFFSET;
        const boardTexture = this.shopBoardTexture || 'gamingBoard';
        const panel = this.createStationFloorBoardPanel(boardHelper, cells, place, boardTexture);
        if (panel) {
            const panelBottom = panel.y + panel.displayHeight / 2;
            if (panelBottom > SHOP_BOARD_BOTTOM) panel.y -= (panelBottom - SHOP_BOARD_BOTTOM);
        }
        this.refreshStationInventoryDisplay();

        // Lay every item face-down (cardBack) at its brick position.
        this.shopItems.forEach((item, i) => {
            const { r, c } = cells[i];
            const { x, y } = boardHelper.brickToPixel(r, c, place);
            const sprite = renderScene.add.sprite(x, y, 'cardBack').setScale(1).setDepth(9);
            const entry = { item, sprite, x, y };
            this.shopCards.push(entry);
            this.shopBoardObjects.push(sprite);
        });

        // Wait for the board to settle, then flip cards one-by-one (top-left first)
        const boardSettleMs = 520;   // panel tween (~440ms) + a small beat
        const perCardMs = 90;
        this.time.delayedCall(boardSettleMs, () => {
            this.shopCards.forEach((entry, i) => {
                this.time.delayedCall(i * perCardMs, () => this.flipShopCard(entry));
            });
            this.time.delayedCall(this.shopCards.length * perCardMs + 20, () => {
                this.syncStationInventoryLayering();
            });
        });
    }

    createStationFloorBoardPanel(boardHelper, cells, place, textureKey = 'gamingBoard') {
        const targetScene = this.gameScene || this;
        if (!targetScene?.textures?.exists?.(textureKey)) return null;

        const points = cells.map(({ r, c }) => boardHelper.brickToPixel(r, c, place));
        const minX = Math.min(...points.map(p => p.x));
        const maxX = Math.max(...points.map(p => p.x));
        const minY = Math.min(...points.map(p => p.y));
        const maxY = Math.max(...points.map(p => p.y));
        const cam = targetScene.cameras.main;
        const x = ((minX + maxX) / 2) + 10;
        const y = Math.min(cam.height - 122, ((minY + maxY) / 2) + 8) - 18;

        const panel = targetScene.add.image(x, y, textureKey).setDepth(6);
        this.stationFloorBoardPanel = panel;
        return panel;
    }

    flipShopCard(entry) {
        if (!entry.sprite?.scene) return;
        SoundHelper.playSound(this, 'card_flip', 0.5);
        if (this.anims.exists('card_flip_anim')) {
            entry.sprite.play('card_flip_anim');
            entry.sprite.once('animationcomplete', () => this.revealShopCard(entry));
        } else {
            this.revealShopCard(entry);
        }
    }

    revealShopCard(entry) {
        const { item, sprite, x, y } = entry;
        if (!sprite.scene) return;
        const data = item.data;
        const renderScene = sprite.scene;

        // Swap to the item's art
        if (data?.sprite && renderScene.textures.exists(data.sprite)) {
            if (data.spriteFrame !== undefined) sprite.setTexture(data.sprite, data.spriteFrame);
            else sprite.setTexture(data.sprite);
            snapOriginToPixelGrid(sprite);
        }
        sprite.setScale(1);

        // Price label underneath the card
        const glyph = item.currency === 'crystals' ? '◆' : '¢';
        const priceText = renderScene.add.text(x, y + 26, item.purchased ? t(this, 'ui.shop.sold') : `${item.price}${glyph}`, {
            fontSize: '11px',
            fill: item.purchased ? '#888888' : (item.currency === 'crystals' ? '#00ffff' : '#ffd700'),
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        });
        priceText.setOrigin(0.5).setDepth(10);
        entry.priceText = priceText;
        this.shopBoardObjects.push(priceText);

        if (item.purchased) {
            sprite.setAlpha(0.55);
            return;
        }

        sprite.setInteractive({ useHandCursor: true });
        sprite.on('pointerover', () => {
            sprite.setTint(0xffe9a8);
            this.showItemTooltip(item.data, sprite.x, sprite.y);
        });
        sprite.on('pointerout', () => {
            sprite.clearTint();
            this.hideItemTooltip();
        });
        sprite.on('pointerdown', () => {
            const wasPurchased = item.purchased;
            this.buyItem(item, priceText);
            this.refreshStationInventoryDisplay();
            if (item.purchased && !wasPurchased) {
                sprite.clearTint();
                sprite.removeInteractive();
                sprite.setAlpha(0.55);
                this.hideItemTooltip();
            }
        });
    }

    createShopIllustrationBoard(frame = 1, boardFrame = 0, y = 224) {
        if (!this.textures.exists('gamingBoardSideSmall')) return;
        if (this.shopIllustrationBoard) {
            this.shopIllustrationBoard.scene?.tweens?.killTweensOf?.(this.shopIllustrationBoard);
            this.shopIllustrationBoard.destroy();
        }

        const targetScene = this.gameScene || this;
        if (!targetScene?.add) return;

        const targetX = 486;
        const targetY = y - 5;
        const slideDistance = 56;
        const container = targetScene.add.container(targetX - slideDistance, targetY).setDepth(4).setAlpha(0);
        container.add(targetScene.add.image(0, 0, 'gamingBoardSideSmall', boardFrame).setOrigin(0.5));

        if (targetScene.textures.exists('eventsShops')) {
            container.add(targetScene.add.image(17, -5, 'eventsShops', frame).setOrigin(0.5));
        }

        this.shopIllustrationBoard = container;
        targetScene.tweens.add({
            targets: container,
            x: targetX,
            alpha: 1,
            duration: 320,
            ease: 'Cubic.easeOut'
        });
    }

    syncStationInventoryLayering() {
        if (!this.stationInventoryLayerActive) return;
        const inv = this.gameScene?.inventorySystem;
        if (!inv) return;

        const raise = object => {
            if (!object?.scene) return;
            object.scene.children?.bringToTop?.(object);
        };

        inv.inventoryPanelPieces?.forEach(piece => {
            piece?.setDepth?.(200);
            raise(piece);
        });
        inv.slotSprites?.forEach(slot => {
            slot?.background?.setDepth?.(201);
            raise(slot?.background);
            slot?.shadow?.setDepth?.(202);
            raise(slot?.shadow);
            slot?.card?.setDepth?.(203);
            raise(slot?.card);

            const infoText = slot?.card?.getData?.('infoText');
            infoText?.setDepth?.(204);
            raise(infoText);

            slot?.hoverSprite?.setDepth?.(205);
            raise(slot?.hoverSprite);
            slot?.gemEffectSprite?.setDepth?.(206);
            raise(slot?.gemEffectSprite);
            slot?.gemIndicator?.setDepth?.(207);
            raise(slot?.gemIndicator);
            slot?.twinkleSprite?.setDepth?.(208);
            raise(slot?.twinkleSprite);
        });
    }

    refreshStationInventoryDisplay() {
        const inv = this.gameScene?.inventorySystem;
        if (!inv) return;

        this.stationInventoryLayerActive = true;
        inv.setStationMode?.(true);
        inv.uiGroup?.setVisible?.(true);
        inv.rebuildInventorySprites?.();
        this.syncStationInventoryLayering();
        this.gameScene.time?.delayedCall?.(0, () => this.syncStationInventoryLayering());
    }

    restoreGameInventoryLayering() {
        const inv = this.gameScene?.inventorySystem;
        if (!inv) return;

        inv.inventoryPanelPieces?.forEach(piece => piece?.setDepth?.(10));
        inv.slotSprites?.forEach(slot => {
            slot?.background?.setDepth?.(11);
            slot?.shadow?.setDepth?.(11);
            slot?.card?.setDepth?.(12);

            const infoText = slot?.card?.getData?.('infoText');
            infoText?.setDepth?.(1001);

            slot?.hoverSprite?.setDepth?.(13);
            slot?.gemEffectSprite?.setDepth?.(14);
            slot?.gemIndicator?.setDepth?.(15);
            slot?.twinkleSprite?.setDepth?.(100);
        });
    }

    // ─── Item tooltip (hover info) ───────────────────────────────────────────
    // Thin wrappers so legacy in-scene calls keep working; the actual render
    // lives in utils/ItemTooltip.js, shared with the gaming board.
    createStationContinueButton(x, y, label, onClick) {
        const baseY = y;
        let button;
        if (this.textures.exists('nextTurnUp')) {
            button = this.add.image(x, y, 'nextTurnUp')
                .setInteractive({ useHandCursor: true });
        } else {
            button = this.add.rectangle(x, y, 78, 30, 0x080808, 0.66)
                .setInteractive({ useHandCursor: true });
        }

        const text = this.add.text(x, y, label, {
            fontSize: '12px',
            fill: '#e5bca4',
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0.5);

        button.on('pointerdown', () => {
            if (button.setTexture && this.textures.exists('nextTurnDown')) button.setTexture('nextTurnDown');
            if (button.setTint) button.setTint(0x888888);
            button.y = baseY + 1;
            text.y = baseY + 1;
            onClick?.();
        });
        button.on('pointerup', () => {
            if (button.clearTint) button.clearTint();
            if (button.setTexture && this.textures.exists('nextTurnUp')) button.setTexture('nextTurnUp');
            button.y = baseY;
            text.y = baseY;
        });
        button.on('pointerover', () => {
            if (button.setTint) button.setTint(0xd4eaf7);
            else button.setFillStyle?.(0x151515, 0.78);
        });
        button.on('pointerout', () => {
            if (button.clearTint) {
                button.clearTint();
                if (button.setTexture && this.textures.exists('nextTurnUp')) button.setTexture('nextTurnUp');
            } else {
                button.setFillStyle?.(0x080808, 0.66);
            }
            button.y = baseY;
            text.y = baseY;
        });

        return { button, text };
    }

    showItemTooltip(data, cardX, cardY) {
        // Amulet descriptions live on the game scene's AmuletManager; expose
        // it via this.amuletManager so the util can find them without
        // hard-coding a lookup through gameScene.
        if (!this.amuletManager && this.gameScene?.amuletManager) {
            this.amuletManager = this.gameScene.amuletManager;
        }
        showItemTooltip(this, data, cardX, cardY);
    }

    hideItemTooltip() {
        hideItemTooltip(this);
    }

    setShopBoardVisible(visible) {
        (this.shopBoardObjects || []).forEach(o => o?.setVisible?.(visible));
        this.stationFloorBoardPanel?.setVisible?.(visible);
        this.shopIllustrationBoard?.setVisible?.(visible);
    }

    clearShopBoard() {
        this.hideItemTooltip?.();
        (this.shopBoardObjects || []).forEach(o => o?.destroy?.());
        this.shopBoardObjects = [];
        this.shopCards = [];
        if (this.boardHelper) {
            this.boardHelper = null;
        }
        if (this.stationFloorBoardPanel) {
            this.stationFloorBoardPanel.scene?.tweens?.killTweensOf?.(this.stationFloorBoardPanel);
            this.stationFloorBoardPanel.destroy();
            this.stationFloorBoardPanel = null;
        }
        if (this.shopIllustrationBoard) {
            this.shopIllustrationBoard.scene?.tweens?.killTweensOf?.(this.shopIllustrationBoard);
            this.shopIllustrationBoard.destroy();
            this.shopIllustrationBoard = null;
        }
    }

    // Fallback capitalize so tooltip code doesn't depend on subclasses
    // providing one. ShopScene already has its own.
    capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

    // ─── Colour & feedback ───────────────────────────────────────────────────

    getRarityColor(rarity, currency) {
        if (currency === 'crystals') return 0x00ffff;
        const colors = {
            common: 0xb8b8b8,
            uncommon: 0x66dd66,
            rare: 0x66aaff,
            epic: 0xa040ff,
            legendary: 0xffcc33,
            cursed: 0xff6666
        };
        return colors[rarity] || 0xb8b8b8;
    }

    showFeedback(message, color, y = 300) {
        const now = this.time.now;
        this.feedbackTextSlots = (this.feedbackTextSlots || []).filter(slot => slot > now);
        const lane = this.feedbackTextSlots.length;
        this.feedbackTextSlots.push(now + 1700);

        const text = this.add.text(320, y - lane * 18, t(this, message), {
            fontSize: '15px',
            fill: Phaser.Display.Color.IntegerToColor(color).rgba,
            fontFamily: '"HoMM Pixel", Arial, sans-serif',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 3,
            shadow: {
                offsetX: 1,
                offsetY: 1,
                color: '#000000',
                blur: 0,
                fill: true
            }
        }).setOrigin(0.5).setDepth(10000);

        this.tweens.add({
            targets: text,
            alpha: 0,
            y: text.y - 26,
            duration: 1600,
            onComplete: () => text.destroy()
        });
    }

    // ─── Loot scatter effect (used by treasure room) ─────────────────────────

    playLootScatter(x, y, coins, crystals) {
        const splash = this.add.sprite(x, y, 'splash1');
        splash.setScale(1.2);
        if (this.anims.exists('splash_anim')) splash.play('splash_anim');
        splash.once('animationcomplete', () => splash.destroy());
        this.time.delayedCall(700, () => splash.active && splash.destroy());

        const coinCount = Math.min(6, Math.max(2, Math.ceil(coins / 15)));
        const crystalCount = Math.min(4, Math.max(1, crystals));
        for (let i = 0; i < coinCount; i++) {
            this.scatterLootSprite(x, y, 'coinUI', 0xffd36b);
        }
        for (let i = 0; i < crystalCount; i++) {
            this.scatterLootSprite(x, y, 'CrystalUI', 0x66ffff);
        }
    }

    scatterLootSprite(x, y, texture, tint) {
        const sprite = this.add.sprite(x, y, texture).setScale(1);
        sprite.setTint(tint);
        const angle = Phaser.Math.FloatBetween(-Math.PI, 0);
        const distance = Phaser.Math.Between(35, 95);
        const targetX = x + Math.cos(angle) * distance;
        const targetY = y + Math.sin(angle) * distance;
        this.tweens.add({
            targets: sprite,
            x: targetX,
            y: targetY,
            alpha: 0,
            duration: 700,
            ease: 'Cubic.Out',
            onComplete: () => sprite.destroy()
        });
    }
}

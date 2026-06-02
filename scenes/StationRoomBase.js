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
        if (this.gameScene?.inventorySystem) {
            this.gameScene.inventorySystem.setStationMode(false);
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

        const n = this.shopItems.length;
        if (n === 0) return;

        // Confine the shop board so it doesn't overlap the inventory bar.
        // The bar sits at y=309 (70px tall), so its top edge is ~274.
        // Passing no areaBottom lets computePlacement use the same natural
        // centring as battle rooms, matching the board position players expect.
        const INVENTORY_TOP = 274;
        // Shops with bonus slots or a busy lineup get the wing. We compute
        // the placement with extra width so the cards actually spread across
        // the main board AND the wing instead of bunching up.
        const bonusSlots = this.gameScene?.amuletManager?.getBonusShopSlots?.() || 0;
        const wantsWing = n >= 6 || bonusSlots > 0;
        const cells = boardHelper.buildCompactBrickCluster(n);
        const place = boardHelper.computePlacement(cells, {
            areaBottom: INVENTORY_TOP,
            ...(wantsWing ? { extraRightWidth: 100, maxHStep: 78 } : {}),
        });
        boardHelper.createFloorBoardPanel(cells, place, false);
        const panel = boardHelper.floorBoardPanel;
        if (panel) {
            panel.setDepth(-1);
            const panelBottom = panel.y + panel.displayHeight / 2;
            if (panelBottom > INVENTORY_TOP) panel.y -= (panelBottom - INVENTORY_TOP);
        }
        if (wantsWing) {
            boardHelper.createSideExtraPanel('right', { delayMs: 140 });
            if (boardHelper.sideExtraPanel) boardHelper.sideExtraPanel.setDepth(-2);
        }

        // Lay every item face-down (cardBack) at its brick position.
        this.shopItems.forEach((item, i) => {
            const { r, c } = cells[i];
            const { x, y } = boardHelper.brickToPixel(r, c, place);
            const sprite = this.add.sprite(x, y, 'cardBack').setScale(1);
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
        });
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

        // Swap to the item's art
        if (data?.sprite && this.textures.exists(data.sprite)) {
            if (data.spriteFrame !== undefined) sprite.setTexture(data.sprite, data.spriteFrame);
            else sprite.setTexture(data.sprite);
            snapOriginToPixelGrid(sprite);
        }
        sprite.setScale(1);

        // Price label underneath the card
        const glyph = item.currency === 'crystals' ? '◆' : '¢';
        const priceText = this.add.text(x, y + 26, item.purchased ? t(this, 'ui.shop.sold') : `${item.price}${glyph}`, {
            fontSize: '11px',
            fill: item.purchased ? '#888888' : (item.currency === 'crystals' ? '#00ffff' : '#ffd700'),
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0.5);
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
            if (item.purchased && !wasPurchased) {
                sprite.clearTint();
                sprite.removeInteractive();
                sprite.setAlpha(0.55);
                this.hideItemTooltip();
            }
        });
    }

    // ─── Item tooltip (hover info) ───────────────────────────────────────────
    // Thin wrappers so legacy in-scene calls keep working; the actual render
    // lives in utils/ItemTooltip.js, shared with the gaming board.
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
        if (this.boardHelper?.floorBoardPanel) {
            this.boardHelper.floorBoardPanel.setVisible(visible);
        }
    }

    clearShopBoard() {
        this.hideItemTooltip?.();
        (this.shopBoardObjects || []).forEach(o => o?.destroy?.());
        this.shopBoardObjects = [];
        this.shopCards = [];
        if (this.boardHelper) {
            this.boardHelper.clearFloorBoardPanel?.();
            this.boardHelper = null;
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

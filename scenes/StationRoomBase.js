// Base class shared by Shop, RareShop and the boss reward room.
// Handles inventory station mode, common card UI, currency feedback and
// loot scatter effects so the individual scenes can focus on their unique
// generation/buy logic.

import { CardSystem } from '../cardSystem.js';
import { SoundHelper } from '../utils/SoundHelper.js';

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
        return data.spriteFrame !== undefined
            ? this.add.image(x, y, data.sprite, data.spriteFrame)
            : this.add.image(x, y, data.sprite);
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

        // Confine the shop board to the UPPER region so it never overlaps the
        // inventory bar at the bottom (~y 248+). ShopScene has no background of
        // its own, so GameScene's inventory bar shows through below the board.
        const INVENTORY_TOP = 240;
        const cells = boardHelper.buildCompactBrickCluster(n);
        const place = boardHelper.computePlacement(cells, { areaBottom: INVENTORY_TOP });
        // animate=false so we can reposition the board immediately without a
        // tween overriding our y adjustment below.
        boardHelper.createFloorBoardPanel(cells, place, false);
        // Keep the board behind the shop cards, and shift it up so its bottom
        // edge never reaches the inventory bar (no covering, no z-fighting).
        const panel = boardHelper.floorBoardPanel;
        if (panel) {
            panel.setDepth(-1);
            const panelBottom = panel.y + panel.displayHeight / 2;
            if (panelBottom > INVENTORY_TOP) panel.y -= (panelBottom - INVENTORY_TOP);
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
        }
        sprite.setScale(1);

        // Price label underneath the card
        const glyph = item.currency === 'crystals' ? '◆' : '¢';
        const priceText = this.add.text(x, y + 26, item.purchased ? 'Sold' : `${item.price}${glyph}`, {
            fontSize: '11px',
            fill: item.purchased ? '#888888' : (item.currency === 'crystals' ? '#00ffff' : '#ffd700'),
            fontFamily: '"HoMM Pixel"'
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
    // Builds a one-instance tooltip that appears above the hovered card. Used
    // for amulets (pulls description from AmuletManager) as well as weapons,
    // armor, magic and gems so the player can read what they're buying
    // without clicking through.
    showItemTooltip(data, cardX, cardY) {
        if (!data) return;
        this.hideItemTooltip();

        const lines = this.getTooltipLines(data);
        if (!lines.name && !lines.body) return;

        const padX = 6;
        const padY = 5;
        const maxWidth = 200;

        const nameColor = data.type === 'amulet' && data.rarity === 'cursed'
            ? '#ff8888'
            : this.getTooltipRarityFill(data.rarity);

        const nameText = this.add.text(0, 0, lines.name, {
            fontSize: '11px',
            fill: nameColor,
            fontFamily: '"HoMM Pixel"',
            wordWrap: { width: maxWidth },
            align: 'center',
        }).setOrigin(0.5, 0);

        const bodyText = lines.body
            ? this.add.text(0, nameText.height + 3, lines.body, {
                fontSize: '10px',
                fill: '#dddddd',
                fontFamily: '"HoMM Pixel"',
                wordWrap: { width: maxWidth },
                align: 'center',
                lineSpacing: 2,
            }).setOrigin(0.5, 0)
            : null;

        const contentWidth = Math.max(nameText.width, bodyText?.width ?? 0);
        const contentHeight = nameText.height + (bodyText ? bodyText.height + 3 : 0);
        const boxWidth = Math.min(maxWidth, contentWidth) + padX * 2;
        const boxHeight = contentHeight + padY * 2;

        const bg = this.add.rectangle(0, 0, boxWidth, boxHeight, 0x1a120a, 0.95)
            .setStrokeStyle(1, 0xb89968)
            .setOrigin(0.5, 0);

        // Position: prefer above the card; if it would clip the top of the
        // viewport, flip it below.
        let tipY = cardY - 60 - boxHeight;
        if (tipY < 4) tipY = cardY + 60;
        const tipX = Phaser.Math.Clamp(
            cardX,
            boxWidth / 2 + 4,
            640 - boxWidth / 2 - 4
        );

        const children = [bg, nameText];
        if (bodyText) children.push(bodyText);

        this.itemTooltip = this.add.container(tipX, tipY, children).setDepth(2000);
    }

    hideItemTooltip() {
        if (this.itemTooltip) {
            this.itemTooltip.destroy(true);
            this.itemTooltip = null;
        }
    }

    // Decide the name + body text shown in the tooltip for any item type the
    // shop / chest / reward rooms can show.
    getTooltipLines(data) {
        const name = data.name || this.capitalize?.(data.type) || 'Item';
        let body = '';

        if (data.type === 'amulet') {
            // Amulet descriptions live in AmuletManager (the runtime owner of
            // the effect callbacks), not on the card data itself.
            const def = this.gameScene?.amuletManager?.amuletDefinitions?.[data.id];
            body = def?.description || data.description || '';
            if (data.rarity) body = `${this.capitalize?.(data.rarity) || data.rarity}\n${body}`.trim();
        } else if (data.type === 'weapon') {
            const dmg = data.damage ?? 0;
            const dur = data.durability ?? data.maxDurability ?? 0;
            const kind = this.boardHelper?.isRangedWeapon?.(data) ? 'Ranged'
                : this.boardHelper?.isMeleeWeapon?.(data) ? 'Melee' : 'Weapon';
            body = `${data.rarity ? this.capitalize?.(data.rarity) + ' ' : ''}${kind}\n${dmg} DMG  •  ${dur} DUR`;
        } else if (data.type === 'armor') {
            const def = data.protection ?? 0;
            const dur = data.durability ?? data.maxDurability ?? 0;
            body = `${data.rarity ? this.capitalize?.(data.rarity) + ' Armor' : 'Armor'}\n${def} DEF  •  ${dur} DUR`;
        } else if (data.type === 'potion') {
            body = `Heals ${data.healAmount ?? 0} HP`;
        } else if (data.type === 'food') {
            body = `Restores ${data.actionAmount ?? 0} AP`;
        } else if (data.type === 'magic') {
            body = data.description || 'Magic spell';
        } else if (data.type === 'gem') {
            const effect = data.effect ? this.capitalize?.(data.effect) : 'Gem';
            body = `Socket: ${effect}`;
        } else if (data.type === 'thorns') {
            body = `${data.thornDamage ?? 0} Thorn DMG  •  ${data.durability ?? 0} DUR`;
        } else if (data.description) {
            body = data.description;
        }

        return { name, body };
    }

    getTooltipRarityFill(rarity) {
        switch (rarity) {
            case 'uncommon':  return '#66dd66';
            case 'rare':      return '#66aaff';
            case 'epic':      return '#cc88ff';
            case 'legendary': return '#ffcc33';
            case 'cursed':    return '#ff6666';
            default:          return '#ffffff';
        }
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
        const text = this.add.text(320, y, message, {
            fontSize: '16px',
            fill: Phaser.Display.Color.IntegerToColor(color).rgba,
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);

        this.tweens.add({
            targets: text,
            alpha: 0,
            y: y - 20,
            duration: 1500,
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

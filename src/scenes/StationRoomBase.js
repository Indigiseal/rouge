// Base class shared by Shop, RareShop and the boss reward room.
// Handles inventory station mode, common card UI, currency feedback and
// loot scatter effects so the individual scenes can focus on their unique
// generation/buy logic.

import { CardSystem } from '../systems/CardSystem.js';
import { SoundHelper } from '../audio/SoundHelper.js';
import { createOptionsCog } from '../ui/OptionsCog.js';
import { setHoverLight } from '../ui/HoverLight.js';
import { createExitDoor } from '../ui/ExitDoor.js';
import { hideGemSockets, showGemSockets } from '../ui/GemSockets.js';
import { attachGemShine } from '../ui/GemShine.js';
import { showItemTooltip, hideItemTooltip, TOOLTIP_DEPTH, STATION_TOOLTIP_GAP } from '../ui/ItemTooltip.js';
import { snapOriginToPixelGrid } from '../ui/PixelSnap.js';
import { t } from '../i18n/i18n.js';
import { exitToSandboxHub, isSandboxMode } from '../sandbox/SandboxMode.js';
import { bindCardRiders, cardRiders, pinRider } from '../ui/CardRiders.js';
import { flyAmuletToBar } from '../ui/RewardFlight.js';
import { flyCurrencyGain } from '../ui/CurrencyFlight.js';
import { recordHumanRunEvent, snapshotHumanRunCard } from '../systems/HumanRunRecorder.js';
import { cameraWorldSize } from '../config/renderScale.js';
import { boardArtFor } from '../content/locations/boardArt.js';

// The mark after a price: a coin for coins, a diamond for crystals. Both 7x7,
// drawn row by row from Taya's assets/art/priceExample.png (one span of filled
// pixels per row: [first x, width]) in the colours she painted them.
const PRICE_MARKS = Object.freeze({
    coins: {
        key: 'priceMarkCoin',
        color: 0xcf8834,
        rows: [[2, 3], [1, 5], [0, 7], [0, 7], [0, 7], [1, 5], [2, 3]],
    },
    crystals: {
        key: 'priceMarkCrystal',
        color: 0xa83c69,
        rows: [[3, 1], [2, 3], [1, 5], [0, 7], [1, 5], [2, 3], [3, 1]],
    },
});
const PRICE_MARK_SIZE = 7;
// Where a seller image stands in the side board's container: its bottom-centre
// point. The figures on the eventsShops 80x80 frames sit at x 17 with their
// feet on row 23; the rare shop's seller is placed 15px right and 10px lower
// than that, by eye.
const SELLER_X = 17 + 15;
const SELLER_BOTTOM_Y = 25 + 10;
// The price tag hangs off the bottom of its card. It sat at +31 from the card's
// centre, covering 13 of its 18px with the card; PRICE_TAG_DROP lowers it.
const PRICE_TAG_DROP = 6;
const PRICE_TAG_Y = 31 + PRICE_TAG_DROP;
// Extra pixels between neighbouring shop cards, on top of the shared spacing.
const SHOP_SPREAD_X = 8;

export class StationRoomBase extends Phaser.Scene {
    // ─── Inventory station mode ──────────────────────────────────────────────

    // Every station room wears the same cog in the same corner. It pauses the
    // room the way ESC pauses a fight; the pause menu resumes whatever it was
    // handed.
    addOptionsCog() {
        createOptionsCog(this, () => {
            if (this.scene.isActive('PauseMenuScene')) return;
            this.scene.launch('PauseMenuScene', { pausedScene: this.scene.key });
            this.scene.pause();
        });
    }

    enableShopStation({ backdropFloor = null } = {}) {
        this.gameScene = this.gameScene || this.scene.get('GameScene');
        if (!this.gameScene?.inventorySystem) return;
        // Inter-act shops still stand on the road just cleared, even though
        // progression and shop prices have already advanced to the next act.
        this.gameScene._stationBackdropFloor = backdropFloor;
        this.scene.wake('GameScene', { shopStation: true });
        this.gameScene.refreshFightBackground?.('SHOP');
        // The fight underneath still has its own door up (it stays once used).
        // This room puts its own door in the same spot; one is enough.
        this.gameScene.hideExitUnderStation?.();
        this.gameScene.inventorySystem.setStationMode(true);
        this.gameScene.inventorySystem.setVisibility(true);
        // Station headings occupy the centre; the fight's header sits aside.
        this.gameScene.floorText?.setPosition(455, 15);
    }

    closeStation() {
        if (this.gameScene) this.gameScene._stationBackdropFloor = null;
        recordHumanRunEvent(this, 'station_departed', {
            station: this.scene?.key || this.sys?.settings?.key || null,
            offers: Array.isArray(this.shopItems)
                ? this.shopItems.map((offer, index) => ({
                    index,
                    item: snapshotHumanRunCard(offer?.data),
                    price: offer?.price ?? null,
                    currency: offer?.currency || null,
                    purchased: Boolean(offer?.purchased),
                }))
                : [],
            unclaimedTreasure: snapshotHumanRunCard(this.pendingLoot),
        });
        this.clearShopBoard();
        this.stationInventoryLayerActive = false;
        if (this.gameScene?.inventorySystem) {
            this.gameScene.inventorySystem.setStationMode(false);
            this.restoreGameInventoryLayering();
            this.gameScene.inventorySystem.setVisibility(false);
            this.scene.sleep('GameScene');
        }
        if (isSandboxMode(this) || isSandboxMode(this.gameScene)) {
            exitToSandboxHub(this);
            return;
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
        // Drop the price banner with the price it framed — "Sold" is wider than
        // the 30px art in several languages, and there's no price left to frame.
        button._priceTag?.destroy();
        button._priceTag = null;
        button._priceCoin?.destroy();
        button._priceCoin = null;
        button.x = button._priceCentreX ?? button.x;
        button.setText(label).setStyle({ fill: '#869089' }).removeInteractive();
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
        const cells = this.shopMaxPerRow
            ? this.buildShopRows(n, this.shopMaxPerRow)
            : boardHelper.buildCompactBrickCluster(n);
        // The shop owns its own play area and its own tuning. These values are
        // the combat board's former defaults, pinned here so the shop layout
        // stays exactly as drawn while the combat rect moves independently.
        const place = boardHelper.computePlacement(cells, {
            area: { left: 184, top: 40, right: 456, bottom: 332 },
            areaBottom: SHOP_BOARD_BOTTOM,
            padX: 24, padY: 16, gap: 0, maxHStep: 65,
            nudgeX: 20, nudgeY: -27,
        });
        place.cx -= 46;
        place.cy += SHOP_BOARD_Y_OFFSET;
        // Room under each row for the price tag, which hangs below its card.
        // Shared placement caps rows at 75px apart, where a tag's bottom met
        // the top of the card below — so the tag could not move off its own
        // card. Rows here are PRICE_TAG_DROP + 1 further apart, and the grid
        // moves down half the gain so its top row stays put.
        const rowGain = PRICE_TAG_DROP + 1;
        const rows = new Set(cells.map(({ r }) => r)).size;
        place.VSTEP += rowGain;
        // And a little more air between cards in a row, in both shops: the
        // shared placement packs them 62-65px apart, near touching. The grid
        // grows to the left only — the rightmost card stays put, so the shelf
        // does not spread further over the seller's board on the right.
        const widest = Math.max(...cells.map(({ c }) => c)) - Math.min(...cells.map(({ c }) => c));
        place.HSTEP += SHOP_SPREAD_X;
        place.cx -= (SHOP_SPREAD_X * widest) / 2;
        place.cy += (rowGain * (rows - 1)) / 2;
        const boardTexture = this.shopBoardTexture || 'gamingBoard';
        const panel = this.createStationFloorBoardPanel(boardHelper, cells, place, boardTexture);
        if (panel) {
            const panelBottom = panel.y + panel.displayHeight / 2;
            if (panelBottom > SHOP_BOARD_BOTTOM) panel.y -= (panelBottom - SHOP_BOARD_BOTTOM);
            // A shop's own nudge for its board art, after the clamp so the clamp
            // cannot undo it. Moves the board only, not the cards on it.
            panel.y += this.shopBoardOffsetY || 0;
            if (this.shopBoardBounce) this.playShopBoardBounce(panel);
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

    // The board rises into place the way the bag and the village boards do:
    // from a little low, a few pixels past its spot, then settling back. Same
    // drop, length and overshoot as the bag's entrance (InventoryView), on
    // whole pixels so the art never smears. It lands before the cards flip
    // (boardSettleMs above).
    playShopBoardBounce(panel) {
        const DROP = 20;
        const MS = 480;
        const OVERSHOOT = 2.5;
        const restY = panel.y;
        const scene = panel.scene;
        panel.y = restY + DROP;
        scene.tweens.addCounter({
            from: DROP,
            to: 0,
            duration: MS,
            ease: 'Back.easeOut',
            easeParams: [OVERSHOOT],
            onUpdate: (tween) => { if (panel.scene) panel.y = restY + Math.round(tween.getValue()); },
            onComplete: () => { if (panel.scene) panel.y = restY; },
        });
    }

    // The currency mark after a price (PRICE_MARKS), drawn once into a texture.
    // The number and the mark are centred on the tag together, 1px apart; the
    // label's own centre is kept so "Sold" can go back to it.
    addPriceMark(scene, priceText, currency) {
        const mark = PRICE_MARKS[currency === 'crystals' ? 'crystals' : 'coins'];
        if (!scene.textures.exists(mark.key)) {
            const g = scene.make.graphics({ x: 0, y: 0, add: false });
            g.fillStyle(mark.color, 1);
            mark.rows.forEach(([x, w], y) => g.fillRect(x, y, w, 1));
            g.generateTexture(mark.key, PRICE_MARK_SIZE, PRICE_MARK_SIZE);
            g.destroy();
        }
        const GAP = 1;
        const centreX = priceText.x;
        const textW = Math.round(priceText.width);
        const left = Math.round(centreX - (textW + GAP + PRICE_MARK_SIZE) / 2);
        priceText._priceCentreX = centreX;
        priceText.x = left + Math.round(textW / 2);
        // Top-left origin on whole pixels: centring an odd-sized image would
        // put it on a half pixel and smear it.
        const image = scene.add.image(
            left + textW + GAP,
            Math.round(priceText.y) - Math.floor(PRICE_MARK_SIZE / 2),
            mark.key
        ).setOrigin(0, 0).setDepth(priceText.depth);
        priceText._priceCoin = image;
        return image;
    }

    // A shop's own row layout: as few rows as `maxPerRow` allows (at least
    // two), the items split as evenly as they go with any extra on top. Each
    // row is centred exactly — a row of two sits under the middle of a row of
    // three — by giving it half-step columns where it needs them. The combat
    // cluster snaps rows to whole columns, which pushed short rows to the
    // right. The rare shop uses it for two rows of up to four.
    buildShopRows(n, maxPerRow) {
        const rows = Math.max(2, Math.ceil(n / maxPerRow));
        const base = Math.floor(n / rows);
        const extra = n % rows;
        const cells = [];
        for (let r = 0; r < rows; r++) {
            const cols = base + (r < extra ? 1 : 0);
            for (let k = 0; k < cols; k++) cells.push({ r, c: k - (cols - 1) / 2 });
        }
        return cells;
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
        // Viewport in world units, not device pixels — see cameraWorldSize.
        const { width: camW, height: camH } = cameraWorldSize(cam);
        const x = ((minX + maxX) / 2) + 10;
        const y = Math.min(camH - 122, ((minY + maxY) / 2) + 8) - 18;

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

        // Pips and value, built by the same code that draws them on a bag
        // card, so a card reads the same on the shelf as it will in the bag.
        // The shop used to write its own number here — no pips, and its own
        // positions and colours. It is drawn in the scene that holds the card
        // (usually GameScene, under the bag), and rides the card from here on.
        const cardFx = (renderScene === this.gameScene && this.gameScene.cardSystem) || this.boardHelper;
        const infoCard = { sprite, data, infoText: null };
        cardFx?.createCardInfoText?.(infoCard);
        if (infoCard.infoText) {
            // Above the price tag (9.5), whose footprint the value slot and the
            // lower labels overlap.
            infoCard.infoText.setDepth(10);
            this.shopBoardObjects.push(infoCard.infoText);
        }
        bindCardRiders(renderScene, sprite);

        // Price label underneath the card, on a little banner: the number and
        // a pixel mark for its currency (it used to be a ¢ or ◆ character).

        // The banner is 30px wide — sized for a short numeric price. A sold item
        // has no price to frame, and the localized "Sold" (RU 'Продано') would
        // overrun the art, so sold cards show bare text and get no tag.
        //
        // Depth 9.5 threads a narrow gap: above the card (9) so it reads as a tag
        // pinned to it, but below the stat labels (10), whose footprints overlap
        // this one — a potion's heal sits dead centre at y+19 and a weapon's
        // damage at x+17, so a tag drawn over them would hide the numbers.
        if (!item.purchased && renderScene.textures.exists('priceTag')) {
            const tag = snapOriginToPixelGrid(renderScene.add.image(x, y + PRICE_TAG_Y, 'priceTag'));
            tag.setDepth(9.5);
            entry.priceTag = tag;
            this.shopBoardObjects.push(tag);
        }

        // The number rides 3px above the tag's centre so it sits on the tag's
        // face rather than its bottom edge.
        const priceText = renderScene.add.text(x, y + PRICE_TAG_Y - 3, item.purchased ? t(this, 'ui.shop.sold') : `${item.price}`, {
            fontSize: '11px',
            fill: item.purchased ? '#869089' : (item.currency === 'crystals' ? '#a83c69' : '#cf8834'),
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        });
        priceText.setOrigin(0.5).setDepth(11);
        if (!item.purchased) {
            const mark = this.addPriceMark(renderScene, priceText, item.currency);
            if (mark) this.shopBoardObjects.push(mark);
        }
        // markButtonDone() only ever receives this text, so hang the tag off it
        // — that's the one choke point every shop routes a purchase through.
        priceText._priceTag = entry.priceTag || null;
        entry.priceText = priceText;
        this.shopBoardObjects.push(priceText);

        // Amulets/gems/relics are not cards — they get no float, shadow or shine.
        const isCard = data.type !== 'amulet' && data.type !== 'gem' && data.type !== 'relic';

        // Drop-shadow (cards only). Starts hidden; shown on hover.
        let shadow = null;
        if (isCard) {
            shadow = renderScene.add.rectangle(x, y + 28, 52, 15, 0x000000, 0.6);
            shadow.setAlpha(0);
            shadow.setDepth(8);
            this.shopBoardObjects.push(shadow);
        }

        // Hover shine sprite (cards only). Use setAlpha(0) + setVisible(false) so
        // no first-frame flash appears when the card is revealed — matching the exact
        // same approach the inventory uses in addCardDirect.
        let hoverSprite = null;
        if (isCard && renderScene.textures.exists('hoverCardsUpSheet')) {
            hoverSprite = snapOriginToPixelGrid(renderScene.add.sprite(x, y, 'hoverCardsUpSheet', 0));
            hoverSprite.setVisible(false);
            hoverSprite.setAlpha(0);
            hoverSprite.setBlendMode(Phaser.BlendModes.SCREEN);
            // Above the card (9) but under the price tag (9.5): the shine is a
            // highlight on the card art, not something that washes over the tag.
            hoverSprite.setDepth(9.2);
            this.shopBoardObjects.push(hoverSprite);
            pinRider(sprite, 'hoverShine', hoverSprite);
        }

        if (item.purchased) {
            sprite.setAlpha(0.55);
            return;
        }

        sprite.setInteractive({ useHandCursor: true, draggable: data.type === 'gem' });
        sprite.on('pointerover', () => {
            if (sprite.getData('shopGemDragging')) return;
            if (isCard) SoundHelper.playSound(this, 'ui_card_hover', 0.35);
            if (data.type === 'gem') {
                showGemSockets(this, data);
                sprite.gemShine?.start();
            }
            // Float card up; its value, pips and shine ride it.
            renderScene.tweens.add({ targets: sprite, y: y - 5, duration: 150, ease: 'Power2' });
            // Show shadow at original position (card lifts above it)
            if (shadow) {
                shadow.x = x;
                shadow.y = y + 28;
                shadow.setAlpha(0.6);
            }
            if (hoverSprite && renderScene.anims?.exists?.('hover_cards_anim')) {
                hoverSprite.setVisible(true);
                hoverSprite.setAlpha(1);
                hoverSprite.play('hover_cards_anim');
            }
            this.showItemTooltip(item.data, sprite.x, sprite.y);
        });
        sprite.on('pointerout', () => {
            if (sprite.getData('shopGemDragging')) return;
            if (data.type === 'gem') {
                hideGemSockets(this);
                sprite.gemShine?.stop();
            }
            // Return card to original position; its riders come with it.
            renderScene.tweens.add({ targets: sprite, y: y, duration: 150, ease: 'Power2' });
            if (hoverSprite) {
                hoverSprite.setVisible(false);
                hoverSprite.setAlpha(0);
                hoverSprite.stop?.();
            }
            if (shadow) shadow.setAlpha(0);
            this.hideItemTooltip();
        });
        if (data.type === 'gem') {
            this.enableShopGemDrag(entry, priceText, { x, y, hoverSprite, shadow });
            return;
        }
        sprite.on('pointerdown', () => {
            const wasPurchased = item.purchased;
            this.buyItem(item, priceText);
            this.refreshStationInventoryDisplay();
            if (item.purchased && !wasPurchased) {
                renderScene.tweens.killTweensOf(sprite);
                sprite.y = y;
                if (hoverSprite) {
                    hoverSprite.setVisible(false);
                    hoverSprite.setAlpha(0);
                    hoverSprite.stop?.();
                }
                if (shadow) shadow.setAlpha(0);
                sprite.removeInteractive();
                sprite.setAlpha(0.55);
                this.hideItemTooltip();
            }
        });
    }

    animateAmuletPurchase(item, id) {
        const entry = this.shopCards?.find(card => card.item === item);
        if (!entry || !id) return;
        // Wait until purchase handlers have finished refreshing the HUD.
        this.time.delayedCall(0, () => {
            flyAmuletToBar(this, id, entry.x, entry.y, { hop: true });
        });
    }

    enableShopGemDrag(entry, priceText, extras) {
        const { sprite, item } = entry;
        const { x, y, hoverSprite, shadow } = extras;
        const renderScene = sprite.scene;
        let dragged = false;

        // The shelf gem catches the light the same way a socketed one does.
        // Drawn in the scene that owns the sprite, masked to the stone.
        attachGemShine(renderScene, sprite);

        sprite.on('dragstart', () => {
            dragged = true;
            sprite.setData('shopGemDragging', true);
            // item is the SHELF ENTRY here ({ data, price, purchased }), not the
            // card — the hover handler above works on item.data. Passing the
            // wrapper meant canSocketGem saw type undefined, matched nothing,
            // and the hint vanished the moment the gem was picked up.
            showGemSockets(this, item.data);
            sprite.gemShine?.start();
            renderScene.tweens.killTweensOf(sprite);
            this.hideItemTooltip();
            sprite.setDepth(2500);
            if (hoverSprite) {
                hoverSprite.setVisible(false);
                hoverSprite.setAlpha(0);
                hoverSprite.stop?.();
            }
            if (shadow) shadow.setAlpha(0);
        });
        sprite.on('drag', (_pointer, dragX, dragY) => {
            sprite.x = Phaser.Math.Clamp(dragX, 0, 640);
            sprite.y = Phaser.Math.Clamp(dragY, 0, 360);
            sprite.gemShine?.sync();
        });
        sprite.on('dragend', () => {
            const slotIndex = this.findShopGemWeaponSlot(sprite);
            if (slotIndex >= 0 && this.purchaseShopGem(item, priceText, slotIndex)) {
                renderScene.tweens.killTweensOf(sprite);
                sprite.x = x;
                sprite.y = y;
                if (hoverSprite) {
                    hoverSprite.setVisible(false);
                    hoverSprite.setAlpha(0);
                    hoverSprite.stop?.();
                }
                if (shadow) shadow.setAlpha(0);
                sprite.removeInteractive();
                sprite.setAlpha(0.55);
                this.hideItemTooltip();
                return;
            }
            dragged = false;
            hideGemSockets(this);
            sprite.gemShine?.stop();
            sprite.setData('shopGemDragging', false);
            sprite.setDepth(9);
            sprite.x = x;
            sprite.y = y;
        });
        sprite.on('pointerup', () => {
            if (dragged || item.purchased) return;
            this.showFeedback({ key: 'float.dragGemOntoWeapon' }, 0xffcf7f);
        });
    }

    // The bag slot a shop gem was dropped on: a weapon to socket it into, or
    // an empty slot to carry it in. -1 for anywhere else.
    findShopGemWeaponSlot(sprite) {
        const inv = this.gameScene?.inventorySystem;
        if (!inv?.slotSprites || !sprite) return -1;
        const cx = sprite.getBounds().centerX;
        const cy = sprite.getBounds().centerY;
        for (let i = 0; i < inv.slotSprites.length; i++) {
            const slotSprite = inv.slotSprites[i];
            const target = inv.slots[i];
            // A weapon socket, or an empty slot to carry the gem in.
            if ((target && target.type !== 'weapon') || !slotSprite?.background) continue;
            if (Phaser.Geom.Rectangle.Contains(slotSprite.background.getBounds(), cx, cy)) {
                return i;
            }
        }
        return -1;
    }

    purchaseShopGem(item, button, weaponSlotIndex) {
        if (!item || item.purchased || item.data?.type !== 'gem') return false;

        const hasEnoughCurrency = item.currency === 'coins'
            ? this.gameState.coins >= item.price
            : this.gameState.crystals >= item.price;
        if (!hasEnoughCurrency) {
            SoundHelper.playVariant(this, 'invalid_action', 0.5);
            this.showFeedback({
                key: 'float.notEnoughCurrency',
                vars: { currency: this.getCurrencyDisplay?.(item.currency) || item.currency },
            }, 0xb51f1e);
            return false;
        }

        const inv = this.gameScene?.inventorySystem;
        if (!inv?.applyGemToWeapon) return false;
        // Onto a weapon it is socketed; into an empty slot it is carried.
        const carried = inv.slots[weaponSlotIndex] === null;
        const placed = carried
            ? inv.addCard(item.data, weaponSlotIndex)
            : inv.applyGemToWeapon(item.data, weaponSlotIndex);
        if (!placed) return false;

        if (item.currency === 'coins') this.gameState.coins -= item.price;
        else this.gameState.crystals -= item.price;

        SoundHelper.playSound(this, 'shop_buy', 0.5);
        // Carried, it also clinks into the bag, as a gem from the board does.
        if (carried) SoundHelper.playSound(this, 'gem_pickup', 0.5);
        item.purchased = true;
        recordHumanRunEvent(this, 'shop_item_bought', {
            shop: this.sys?.settings?.key === 'RareShopScene' ? 'rare' : 'regular',
            destinationSlot: weaponSlotIndex,
            item: snapshotHumanRunCard(item.data),
            price: item.price,
            currency: item.currency,
            socketed: !carried,
        });
        this.coinsText?.setText?.(t(this, 'ui.shop.coins', { amount: this.gameState.coins }));
        this.crystalsText?.setText?.(t(this, 'ui.shop.crystals', { amount: this.gameState.crystals }));
        this.markButtonDone(button, t(this, 'ui.shop.sold'));
        this.refreshStationInventoryDisplay();
        this.gameScene?.updateUI?.();
        return true;
    }

    // `sellerKey` swaps the eventsShops frame for a seller drawn as his own
    // image (the rare shop's). He stands on the frame art's baseline, so a
    // taller figure grows upward rather than sinking into the board.
    createShopIllustrationBoard(frame = 1, boardFrame = 0, y = 224, sellerKey = null) {
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
        // The location's own side panel when it has one (content/locations/boardArt.js).
        const sideArt = boardArtFor(targetScene, this.gameState);
        container.add(targetScene.add.image(0, 0, sideArt.sideSmall, sideArt.sideSmallFrame ?? boardFrame).setOrigin(0.5));

        // The seller (or the shop's picture) is kept: in the shop a bag card is
        // sold by dropping it on him (ShopScene.createSellZone).
        this.shopSellerImage = null;
        if (sellerKey && targetScene.textures.exists(sellerKey)) {
            // Bottom-centre origin on whole pixels (the art is 56 wide).
            this.shopSellerImage = targetScene.add.image(SELLER_X, SELLER_BOTTOM_Y, sellerKey).setOrigin(0.5, 1);
        } else if (targetScene.textures.exists('eventsShops')) {
            this.shopSellerImage = targetScene.add.image(17, -5, 'eventsShops', frame).setOrigin(0.5);
        }
        if (this.shopSellerImage) container.add(this.shopSellerImage);

        this.shopIllustrationBoard = container;
        targetScene.tweens.add({
            targets: container,
            x: targetX,
            alpha: 1,
            duration: 320,
            ease: 'Cubic.easeOut'
        });
    }

    // Keep the bag above the shop's board, which is drawn into GameScene with
    // it. The depths come from the bag's own table (station mode: 200 and up);
    // each piece is also raised in draw order so a tie can never put a shelf
    // card over a bag card. The pieces riding each card are taken from the
    // card (CardRiders) — this used to be its own list, and it had no briar
    // frame or web on it.
    syncStationInventoryLayering() {
        if (!this.stationInventoryLayerActive) return;
        const inv = this.gameScene?.inventorySystem;
        if (!inv) return;

        inv.applyInventoryVisualDepths?.();
        const raise = object => {
            if (!object?.scene) return;
            object.scene.children?.bringToTop?.(object);
        };
        inv.inventoryPanelPieces?.forEach(raise);
        inv.slotSprites?.forEach(slot => {
            raise(slot?.background);
            raise(slot?.shadow);
            raise(slot?.card);
            cardRiders(slot?.card)
                .sort((p, q) => (p.depth || 0) - (q.depth || 0))
                .forEach(raise);
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

    // Back to the combat depths, from the bag's own table.
    restoreGameInventoryLayering() {
        this.gameScene?.inventorySystem?.applyInventoryVisualDepths?.();
    }

    // ─── Item tooltip (hover info) ───────────────────────────────────────────
    // Thin wrappers so legacy in-scene calls keep working; the actual render
    // lives in utils/ItemTooltip.js, shared with the gaming board.
    // The room's way out. The location's door, in the spot a fight's door
    // stands; the labelled plate below is only for a location with no door art.
    createStationContinueButton(x, y, label, onClick) {
        const door = createExitDoor(this, onClick);
        if (door) return { button: door, text: null };

        const baseY = y;
        let button;
        if (this.textures.exists('nextTurnUp')) {
            button = this.add.image(x, y, 'nextTurnUp')
                .setInteractive({ useHandCursor: true });
        } else {
            button = this.add.rectangle(x, y, 78, 30, 0x050505, 0.66)
                .setInteractive({ useHandCursor: true });
        }

        const text = this.add.text(x, y, label, {
            fontSize: '12px',
            fill: '#e5bca4',
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0.5);

        button.on('pointerdown', () => {
            SoundHelper.playVariant(this, 'button_click', 0.5);
            if (button.setTexture && this.textures.exists('nextTurnDown')) button.setTexture('nextTurnDown');
            if (button.setTint) button.setTint(0x888888);
            button.y = baseY + 1;
            text.y = baseY + 1;
            onClick?.();
        });
        button.on('pointerup', () => {
            if (button.clearTint) button.clearTint();
            setHoverLight(button, false);
            if (button.setTexture && this.textures.exists('nextTurnUp')) button.setTexture('nextTurnUp');
            button.y = baseY;
            text.y = baseY;
        });
        button.on('pointerover', () => {
            SoundHelper.playVariant(this, 'hover_button', 0.4);
            if (button.setTint) setHoverLight(button, true);
            else button.setFillStyle?.(0x0a1514, 0.78);
        });
        button.on('pointerout', () => {
            setHoverLight(button, false);
            if (button.clearTint) {
                button.clearTint();
                if (button.setTexture && this.textures.exists('nextTurnUp')) button.setTexture('nextTurnUp');
            } else {
                button.setFillStyle?.(0x050505, 0.66);
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
        showItemTooltip(this, data, cardX, cardY, TOOLTIP_DEPTH, STATION_TOOLTIP_GAP);
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
        if (currency === 'crystals') return 0x71b1ae;
        const colors = {
            common: 0xafafa2,
            uncommon: 0x4a884f,
            rare: 0x6c6885,
            epic: 0x712a65,
            legendary: 0xfbad19,
            cursed: 0xc45c45
        };
        return colors[rarity] || 0xafafa2;
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
        const splash = this.add.sprite(x, y, 'splashSheet');
        splash.setScale(1.2);
        if (this.anims.exists('splash_anim')) splash.play('splash_anim');
        splash.once('animationcomplete', () => splash.destroy());
        this.time.delayedCall(700, () => splash.active && splash.destroy());

        const coinCount = Math.min(6, Math.max(2, Math.ceil(coins / 15)));
        const crystalCount = Math.min(4, Math.max(1, crystals));
        for (let i = 0; i < coinCount; i++) {
            this.scatterLootSprite(x, y, 'coinUI', 0xffcf7f);
        }
        for (let i = 0; i < crystalCount; i++) {
            this.scatterLootSprite(x, y, 'CrystalUI', 0x71b1ae);
        }
        // Then one coin and one crystal leave the burst for their counters on
        // the HUD, so the haul is seen landing where it is counted.
        if (coins > 0) this.time.delayedCall(160, () => flyCurrencyGain(this, x, y, 'coins'));
        if (crystals > 0) this.time.delayedCall(240, () => flyCurrencyGain(this, x, y, 'crystals'));
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

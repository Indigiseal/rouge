import { SoundHelper } from '../audio/SoundHelper.js';
import { createTitle } from '../ui/titleText.js';
import { fitLabel, serifStyle } from '../ui/uiFont.js';
import { exitToSandboxHub, isSandboxMode } from '../sandbox/SandboxMode.js';
import { totalRepairCost } from '../content/economy/repair.js';
import { recordHumanRunEvent, snapshotHumanRunCard } from '../systems/HumanRunRecorder.js';
import { t } from '../i18n/i18n.js';
import { BoardCardFx } from '../systems/board/BoardCardFx.js';
import { snapOriginToPixelGrid } from '../ui/PixelSnap.js';

// Floating "repaired" / "not enough coins" message. Sits above the carried card
// (depth 10) and the hammer sparks (11), and is readable before it fades.
const FEEDBACK_DEPTH = 100;
const FEEDBACK_HOLD_MS = 1400;
const FEEDBACK_FADE_MS = 900;

export class AnvilScene extends Phaser.Scene {
    constructor() {
        super({ key: 'AnvilScene' });
    }

    create(data) {
        this.gameState = data.gameState;
        this.itemSlotsUI = [];
        this.feedbackText = null;
        this.repairEntries = null;
        this.repairInProgress = false;
        this.input.enabled = true;
        this.cardFx = new BoardCardFx({ scene: this });

        this.add.rectangle(320, 180, 640, 360, 0x2a2325);
        this.add.image(320, 0, 'anvilIllustration').setOrigin(0.5, 0);
        this.add.image(320, 44, 'anvilBanner');
        createTitle(this, 320, 42, t(this, 'ui.sandbox.encounter.anvil'), { color: '#f5e6c8' });

        this.add.image(22, 19, 'coinUI');
        this.coinsText = this.label(64, 19,
            t(this, 'ui.anvil.coins', { amount: this.gameState.coins }), '16px', '#f5e6c8');

        this.anvilDropZone = this.add.rectangle(320, 140, 68, 88, 0x000000, 0.58)
            .setStrokeStyle(1, 0x9f7c63);
        if (!this.anims.exists('anvil_drop_loop')) {
            this.anims.create({
                key: 'anvil_drop_loop',
                frames: this.anims.generateFrameNumbers('anvilDropAnim', { start: 0, end: 6 }),
                frameRate: 14, repeat: -1,
            });
        }
        this.anvilDropAnimation = this.add.sprite(320, 140, 'anvilDropAnim', 0).setVisible(false);
        if (!this.anims.exists('anvil_clank')) {
            this.anims.create({
                key: 'anvil_clank',
                frames: this.anims.generateFrameNumbers('anvilClankAnim', { start: 0, end: 4 }),
                frameRate: 20, repeat: 0,
            });
        }
        this.anvilClankAnimation = this.add.sprite(320, 140, 'anvilClankAnim', 0)
            .setDepth(11).setVisible(false);
        this.anvilClankAnimation.on('animationcomplete', () => this.anvilClankAnimation.setVisible(false));

        this.displayRepairableItems();
        this.createPaintedButton(568, 340, t(this, 'ui.hud.leave'), () => {
            if (isSandboxMode(this)) {
                exitToSandboxHub(this);
                return;
            }
            this.scene.stop();
            this.scene.wake('MapViewScene');
        });
    }

    label(x, y, value, size = '14px', color = '#f0dfbb') {
        return this.add.text(x, y, value, serifStyle(size, color)).setOrigin(0.5);
    }

    createPaintedButton(x, y, text, action, enabled = true) {
        const plate = this.add.image(0, 0, 'nextTurnUp');
        const label = this.label(0, -3, text, '14px', enabled ? '#fff0cc' : '#b6a994');
        fitLabel(label, plate.width - 8, '14px');
        const button = this.add.container(x, y, [plate, label]);
        if (!enabled) {
            plate.setTint(0x777777);
            return button;
        }
        plate.setInteractive({ useHandCursor: true });
        plate.on('pointerover', () => {
            SoundHelper.playVariant(this, 'hover_button', 0.4);
            plate.setTint(0xffe0a3);
        });
        plate.on('pointerout', () => { plate.setTexture('nextTurnUp'); plate.clearTint(); label.y = -3; });
        plate.on('pointerdown', () => {
            SoundHelper.playVariant(this, 'button_click', 0.5);
            plate.setTexture('nextTurnDown');
            label.y = -2;
        });
        plate.on('pointerup', () => {
            plate.setTexture('nextTurnUp');
            plate.clearTint();
            label.y = -3;
            action();
        });
        return button;
    }

    displayRepairableItems() {
        this.itemSlotsUI.forEach(slot => slot.destroy());
        this.itemSlotsUI = [];
        const repairableItems = this.repairEntries || [];
        const gameScene = this.scene.get('GameScene');
        const inventory = gameScene?.inventorySystem?.slots ?? this.gameState.inventory ?? [];
        if (!this.repairEntries) inventory.forEach((item, index) => {
            if (item && ['weapon', 'armor', 'thorns'].includes(item.type)
                && item.maxDurability && item.durability < item.maxDurability) {
                repairableItems.push({ item, index, isEquipped: false });
            }
        });
        const armor = this.gameState.equippedArmor;
        if (!this.repairEntries && armor?.maxDurability && armor.durability < armor.maxDurability) {
            repairableItems.push({ item: armor, index: -1, isEquipped: true });
        }
        // Keep this visit's slots stable, including items just repaired.
        this.repairEntries = repairableItems;

        // Only damaged gear gets a slot. The row used to be six fixed plates
        // whether or not anything sat on them, which read as "put something
        // here" — and nothing can be. It centres on the anvil, so a single card
        // sits under it rather than at the left end of a rank of empties.
        const SLOT_W = 58;
        const SLOT_PITCH = 66;
        const ROW_CENTER_X = 320;
        const ROW_Y = 276;
        const count = repairableItems.length;

        if (!count) {
            this.itemSlotsUI.push(this.label(ROW_CENTER_X, ROW_Y, t(this, 'ui.anvil.none'), '14px'));
            return;
        }

        // A Bottomless Bag can push the count past the six this row was drawn
        // for, so the pitch tightens rather than running the last card off the
        // right edge. 16px of air at each end.
        const pitch = count > 1
            ? Math.min(SLOT_PITCH, (640 - SLOT_W - 32) / (count - 1))
            : SLOT_PITCH;
        const firstX = ROW_CENTER_X - (pitch * (count - 1)) / 2;

        repairableItems.forEach((data, index) => {
            const x = Math.round(firstX + pitch * index);
            const slot = this.add.rectangle(x, ROW_Y, SLOT_W, 76, 0x0e0b10, 0.7)
                .setStrokeStyle(1, 0x000000);
            this.itemSlotsUI.push(slot);
            this.createRepairItemUI(data, x, ROW_Y + 8);
        });
    }

    // The anvil's "put it here" loop. Driven by hovering a repairable card
    // rather than by picking one up: by the time the card is in hand the player
    // has already decided, and the anvil was inviting a drop that was underway.
    showAnvilDropHint() {
        if (this.anvilDropAnimation.visible) return;
        this.anvilDropAnimation.setVisible(true).play('anvil_drop_loop');
    }

    hideAnvilDropHint() {
        this.anvilDropAnimation.stop();
        this.anvilDropAnimation.setVisible(false);
    }

    createRepairItemUI(data, x, y) {
        const { item } = data;
        const container = this.add.container(x, y);
        container.setData({ homeX: x, homeY: y });
        this.itemSlotsUI.push(container);
        const shadow = this.add.rectangle(0, 20, 52, 15, 0x000000, 0.6).setAlpha(0);
        const face = this.add.container(0, -8);
        container.add([shadow, face]);
        if (item.sprite && this.textures.exists(item.sprite)) {
            const icon = snapOriginToPixelGrid(this.add.image(0, 0, item.sprite, item.spriteFrame ?? 0));
            face.add(icon);
            // Use the combat inventory's exact value and durability rendering.
            const card = { sprite: icon, data: item, infoText: null };
            this.cardFx.createCardInfoText(card);
            if (card.infoText) face.add(card.infoText);
            container.setData('card', card);
            const light = snapOriginToPixelGrid(this.add.image(0, 0, item.sprite, item.spriteFrame ?? 0))
                .setTintFill(0xffe9b0).setAlpha(0);
            face.add(light);
            container.setData('repairLight', light);
        }
        const shine = this.textures.exists('hoverCardsUpSheet')
            ? snapOriginToPixelGrid(this.add.sprite(0, 0, 'hoverCardsUpSheet', 0))
                .setBlendMode(Phaser.BlendModes.SCREEN).setVisible(false)
            : null;
        if (shine) face.add(shine);
        let dragging = false;
        const stopHover = () => {
            shine?.stop();
            shine?.setVisible(false);
            shadow.setAlpha(0);
            this.tweens.killTweensOf(face);
        };
        const lift = (targetY) => {
            this.tweens.killTweensOf(face);
            this.tweens.add({
                targets: face, y: targetY, duration: 150, ease: 'Power2',
                onUpdate: () => { face.y = Math.round(face.y); },
            });
        };
        container.on('pointerover', () => {
            if (dragging) return;
            if (shine && this.anims.exists('hover_cards_anim')) {
                shine.setVisible(true).play('hover_cards_anim');
            }
            // Invite the drop while the card is being considered, not once it
            // has already been picked up. A card that no longer needs repairing
            // has had its draggable flag cleared, so it invites nothing.
            if (container.input?.draggable) this.showAnvilDropHint();
            shadow.setAlpha(1);
            lift(-13);
        });
        container.on('pointerout', () => {
            if (dragging) return;
            this.hideAnvilDropHint();
            stopHover();
            lift(-8);
        });
        container.once('destroy', () => {
            this.tweens.killTweensOf(face);
            this.tweens.killTweensOf(container);
        });
        const missing = item.maxDurability - item.durability;
        const totalCost = totalRepairCost(item, missing, this.getWeaponType(item.name));
        const tag = this.add.image(0, 40, 'anvilPriceTag');
        const cost = this.label(0, 40, String(totalCost), '11px', '#2a2325');
        container.add([tag, cost]);
        container.setData({ face, cost, tag });

        container.setSize(68, 88).setInteractive({ useHandCursor: true });
        this.input.setDraggable(container, missing > 0);
        container.on('dragstart', () => {
            dragging = true;
            // The price belongs to the slot the card came from. It used to ride
            // along to the anvil, where the repair sequence hides it anyway.
            tag.setVisible(false);
            cost.setVisible(false);
            stopHover();
            face.y = -8;
            this.tweens.killTweensOf(container);
            container.setDepth(10);
        });
        container.on('drag', (_pointer, dragX, dragY) => {
            container.setPosition(Math.round(dragX), Math.round(dragY));
        });
        container.on('dragend', () => {
            dragging = false;
            this.hideAnvilDropHint();
            // Restore the tag on every path out of the drag, including the ones
            // that refuse the repair. A drop that is accepted hides it again on
            // the next line, before a frame is drawn.
            tag.setVisible(true);
            cost.setVisible(true);
            const droppedOnAnvil = Phaser.Geom.Intersects.RectangleToRectangle(
                container.getBounds(), this.anvilDropZone.getBounds());
            if (!droppedOnAnvil) {
                this.returnRepairCard(container);
                return;
            }
            this.repairItem(data, missing, container);
        });
    }

    returnRepairCard(container, onComplete = null) {
        this.tweens.add({
            targets: container,
            x: container.getData('homeX'),
            y: container.getData('homeY'),
            duration: 140,
            ease: 'Quad.easeOut',
            onComplete: () => {
                container.setDepth(0);
                onComplete?.();
            },
        });
    }

    getWeaponType(itemName) {
        const name = itemName.toLowerCase();
        if (name.includes('dagger')) return 'dagger';
        if (name.includes('bow')) return 'bow';
        if (name.includes('sword')) return 'sword';
        if (name.includes('axe')) return 'axe';
        return 'sword';
    }

    repairItem(data, repairAmount, draggedCard = null) {
        if (this.repairInProgress) return;
        const { item, index, isEquipped } = data;
        repairAmount = Math.min(repairAmount, item.maxDurability - item.durability);
        if (repairAmount <= 0) {
            if (draggedCard) this.returnRepairCard(draggedCard);
            return;
        }
        const before = snapshotHumanRunCard(item);
        const totalCost = totalRepairCost(item, repairAmount, this.getWeaponType(item.name));

        if (this.gameState.coins < totalCost) {
            this.showFeedback(t(this, 'ui.anvil.notEnoughCoins'), 0xff0000);
            if (draggedCard?.scene) this.returnRepairCard(draggedCard);
            return;
        }

        this.gameState.coins -= totalCost;
        item.durability = Math.min(item.maxDurability, item.durability + repairAmount);
        recordHumanRunEvent(this, 'anvil_repair', {
            inventoryIndex: index,
            isEquipped: Boolean(isEquipped),
            cost: totalCost,
            requestedRepair: repairAmount,
            before,
            after: snapshotHumanRunCard(item),
        });
        this.coinsText.setText(t(this, 'ui.anvil.coins', { amount: this.gameState.coins }));
        if (draggedCard) this.playRepairSequence(draggedCard, item);
        else this.displayRepairableItems();

        const gameScene = this.scene.get('GameScene');
        gameScene?.updateUI?.();
    }

    playRepairSequence(container, item) {
        this.repairInProgress = true;
        this.input.enabled = false;
        const light = container.getData('repairLight');
        const face = container.getData('face');
        container.getData('tag').setVisible(false);
        container.getData('cost').setVisible(false);
        const restY = this.anvilDropZone.y + 8;
        const finish = () => {
            const card = container.getData('card');
            if (card) {
                this.cardFx.destroyCardInfoText(card);
                this.cardFx.createCardInfoText(card);
                if (card.infoText) face.add(card.infoText);
            }
            this.input.setDraggable(container, false);
            this.returnRepairCard(container, () => {
                container.getData('tag').setVisible(true);
                container.getData('cost').setText('0').setVisible(true);
                this.repairInProgress = false;
                this.input.enabled = true;
                this.showFeedback(`${item.name} fully repaired!`, 0xffd700);
            });
        };
        const strike = (remaining) => {
            // Every hammer hit starts the sparks, jump, flash, shake and sound together.
            this.anvilClankAnimation.setVisible(true).play('anvil_clank');
            SoundHelper.playSound(this, 'anvil_upgrade', 0.6);
            this.cameras.main.shake(100, 0.0025);
            if (light) {
                light.setAlpha(0.65);
                this.tweens.add({ targets: light, alpha: 0, duration: 220 });
            }
            this.tweens.add({
                targets: container, y: restY - 12, duration: 65, ease: 'Quad.easeOut',
                onComplete: () => this.tweens.add({
                    targets: container, y: restY, duration: 150, ease: 'Quad.easeIn',
                    onComplete: () => this.time.delayedCall(160,
                        () => remaining > 1 ? strike(remaining - 1) : finish()),
                }),
            });
        };
        // Settle on the anvil, take two jumping hits, then return to the same slot.
        this.tweens.add({
            targets: container, x: this.anvilDropZone.x, y: restY,
            duration: 180, ease: 'Quad.easeOut',
            onComplete: () => strike(2),
        });
    }

    showFeedback(message, color) {
        if (this.feedbackText) {
            this.tweens.killTweensOf(this.feedbackText);
            this.feedbackText.destroy();
        }
        const feedbackText = this.feedbackText = this.label(320, 88, message, '12px',
            color === 0xff0000 ? '#8b3025' : '#614019');
        fitLabel(feedbackText, 500, '12px');
        // Above everything on this screen: the drop plate, the card being carried
        // (depth 10) and the hammer sparks (11). It was drawn at depth 0 and so
        // slid behind the drop plate it floats over.
        feedbackText.setDepth(FEEDBACK_DEPTH);

        // Hold at full strength long enough to be read, then fade — the old
        // single tween started fading from the first frame, so the message was
        // half gone by the time the eye reached it.
        this.tweens.add({
            targets: feedbackText,
            y: 74,
            duration: FEEDBACK_HOLD_MS + FEEDBACK_FADE_MS,
            ease: 'Sine.easeOut',
        });
        this.tweens.add({
            targets: feedbackText,
            alpha: 0,
            delay: FEEDBACK_HOLD_MS,
            duration: FEEDBACK_FADE_MS,
            onComplete: () => {
                if (this.feedbackText === feedbackText) this.feedbackText = null;
                feedbackText.destroy();
            },
        });
    }
}

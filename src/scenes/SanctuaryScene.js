// The Sanctuary: where Support is spent between runs. It replaces the village. Each
// statue stands for one of the village's buildings (content/sanctuary/preview.js,
// `building`), so ranks, costs and run effects are the village's own
// (content/village/catalog.js, MetaProgressionManager). The Phoenix, at the centre,
// stays dormant until the four guardians around it have each been restored once.
import { SoundHelper } from '../audio/SoundHelper.js';
import { MusicManager } from '../audio/MusicManager.js';
import { MetaProgressionManager } from '../managers/MetaProgressionManager.js';
import { getVillageBuilding } from '../content/village/index.js';
import { SANCTUARY_STATUES } from '../content/sanctuary/preview.js';
import { t } from '../i18n/i18n.js';
import { createPaintedButton } from '../ui/PaintedButton.js';
import { createTitle } from '../ui/titleText.js';
import { createOptionsCog } from '../ui/OptionsCog.js';
import { openConfirmModal } from '../ui/ConfirmModal.js';
import { setHoverLight } from '../ui/HoverLight.js';
import { fitLabel } from '../ui/uiFont.js';
import { devToolsEnabled } from '../config/DevTools.js';

const FONT = '"HoMM Pixel", Arial, sans-serif';
const STAR_STEP = 6;
const LOCKED_TINT = 0x444b53;
const UNRESTORED_TINT = 0x90948b;

export class SanctuaryScene extends Phaser.Scene {
    constructor() { super({ key: 'SanctuaryScene' }); }

    preload() {
        // The statues are frames of the packed sanctuary strip, loaded at boot.
        if (!this.textures.exists('sanctuaryBackground')) {
            this.load.image('sanctuaryBackground', 'assets/art/backgrounds/bonefloodOssuary.png');
        }
    }

    create() {
        this.characterId = 'rogue';
        this.meta = new MetaProgressionManager(this);
        this.selectedId = 'forge';
        this.busy = false;
        this.views = new Map();

        this.add.rectangle(320, 180, 640, 360, 0x161c20);
        const background = this.add.image(320, 180, 'sanctuaryBackground');
        background.setScale(Math.max(640 / background.width, 360 / background.height));
        this.add.rectangle(320, 180, 640, 360, 0x10151b, 0.36);

        createTitle(this, 320, 22, t(this, 'ui.sanctuary.title'), { color: '#ecdbb3' });
        this.detailText = this.add.text(320, 46, '', {
            fontSize: '9px', fill: '#a5a394', fontFamily: FONT, align: 'center',
            wordWrap: { width: 420 }, stroke: '#10151b', strokeThickness: 3,
        }).setOrigin(0.5, 0);
        this.supportText = this.add.text(24, 24, '', { fontSize: '11px', fill: '#f2d3aa', fontFamily: FONT });
        createOptionsCog(this, () => this.openOptions());

        // The guardians form an arc around the final, central shrine.
        this.add.image(320, 288, 'sigilRoomFloor').setAlpha(0.65);
        for (const statue of SANCTUARY_STATUES) this.drawStatue(statue);

        this.backButton = createPaintedButton(this, 80, 340, t(this, 'ui.village.back'), () => this.back());
        this.restoreButton = createPaintedButton(this, 320, 340, t(this, 'ui.sanctuary.restore'), () => this.restoreSelected());
        this.nextButton = createPaintedButton(this, 560, 340, t(this, 'ui.village.leave'), () => this.leave());
        if (devToolsEnabled()) {
            createPaintedButton(this, 200, 340, '+25', () => {
                if (!devToolsEnabled()) return;
                this.meta.grantDebugXp(this.characterId, 25);
                this.refresh();
            }, { size: '12px' });
            createPaintedButton(this, 440, 340, t(this, 'ui.village.debugResetMeta'), () => this.confirmResetMetaProgression(), { size: '9px' });
        }
        this.input.keyboard?.on('keydown-ESC', () => this.openOptions());

        this.refresh();
        this.cameras.main.fadeIn(250, 0, 0, 0);
        // Same level as the main menu, whose theme this carries on.
        MusicManager.play(this, 'menu_music', 0.6, 500);
    }

    drawStatue(statue) {
        const { x, bottom, building } = statue;
        const maxRank = getVillageBuilding(building)?.maxRank ?? 1;
        const ring = this.add.ellipse(x, bottom - 2, 100, 21, 0xc6a45d, 0.08)
            .setStrokeStyle(1, 0xdec58b, 0.25);
        const art = this.add.image(x, bottom, statue.texture).setOrigin(0.5, 1);
        const stars = [];
        if (this.textures.exists('villageRankStar')) {
            for (let i = 0; i < maxRank; i++) {
                stars.push(this.add.image(x, bottom - 9, 'villageRankStar').setVisible(false));
            }
        }
        const name = this.add.text(x, bottom + 8, t(this, `sanctuary.${building}.name`), {
            fontSize: '9px', fill: '#d9c9a7', fontFamily: FONT,
            stroke: '#10151b', strokeThickness: 3,
        }).setOrigin(0.5);
        const rule = this.add.text(x, bottom + 18, t(this, `sanctuary.${building}.rule`), {
            fontSize: '8px', fill: '#e1d6be', fontFamily: FONT,
            align: 'center', wordWrap: { width: 156 }, stroke: '#10151b', strokeThickness: 3,
        }).setOrigin(0.5, 0);
        // Bounds fit each sculpture, leaving neighbouring statues clickable.
        const hit = this.add.rectangle(x, bottom - 56, 100, 124, 0, 0).setInteractive({ useHandCursor: true });
        hit.on('pointerover', () => { if (!this.busy) setHoverLight(art, true); });
        hit.on('pointerout', () => setHoverLight(art, false));
        hit.on('pointerdown', () => {
            if (this.busy || this.selectedId === building) return;
            this.selectedId = building;
            SoundHelper.playVariant(this, 'button_click', 0.35);
            this.refresh();
        });
        this.views.set(building, { statue, art, ring, name, rule, stars, hit });
    }

    rank(building) { return this.meta.getBuildingRank(building); }

    refresh() {
        this.supportText.setText(t(this, 'ui.village.support', { amount: this.meta.getCharacterXp(this.characterId) }));
        this.supportText.setFontSize('11px');
        fitLabel(this.supportText, 90, '11px');
        for (const [building, view] of this.views) {
            const { statue } = view;
            const rank = this.rank(building);
            const locked = this.isLocked(building);
            view.art.setTexture(building === 'temple' && !rank ? 'sanctuaryPhoenixBroken' : statue.texture);
            view.art.setTint(locked ? LOCKED_TINT : rank ? 0xffffff : UNRESTORED_TINT).setAlpha(locked ? 0.55 : 1);
            // Rank stars, centred on the pedestal for however many restorations are bought.
            view.stars.forEach((star, i) => {
                star.setX(Math.round(statue.x + (i - (rank - 1) / 2) * STAR_STEP));
                star.setVisible(i < rank);
            });
            const selected = this.selectedId === building;
            view.ring.setAlpha(selected ? 1 : 0.3);
            view.ring.setStrokeStyle(1, 0xdec58b, selected ? 0.9 : 0.25);
            view.name.setColor(selected ? '#fff0c7' : '#d9c9a7');
        }
        this.detailText.setText(this.isLocked(this.selectedId)
            ? t(this, 'ui.sanctuary.phoenixLocked')
            : t(this, `sanctuary.${this.selectedId}.desc`));

        const check = this.meta.canUpgradeBuilding(this.characterId, this.selectedId);
        const label = this.restoreButton.list[1];
        if (check.reason === 'locked') {
            label.setText(t(this, 'ui.sanctuary.dormant'));
        } else if (check.reason === 'max') {
            label.setText(t(this, 'ui.sanctuary.restored'));
        } else if (check.reason === 'support') {
            label.setText(t(this, 'ui.village.need', { cost: check.cost }));
        } else {
            label.setText(`${t(this, 'ui.sanctuary.restore')}  ${check.cost}`);
        }
        this.restoreButton.setAlpha(check.ok ? 1 : 0.45);
    }

    // Only the Phoenix is ever locked: it waits on the four guardians.
    isLocked(building) {
        return this.meta.canUpgradeBuilding(this.characterId, building).reason === 'locked';
    }

    restoreSelected() {
        if (this.busy) return;
        const building = this.selectedId;
        const wasLocked = this.isLocked('temple');
        const result = this.meta.upgradeBuilding(this.characterId, building);
        if (!result.ok) {
            SoundHelper.playVariant(this, 'hover_button', 0.2);
            return;
        }
        this.busy = true;
        const view = this.views.get(building);
        // A heavy stone settle, then the shimmer of the repair.
        SoundHelper.playVariant(this, 'armor_break', 0.45);
        this.time.delayedCall(120, () => SoundHelper.playVariant(this, 'recovery', 0.5));
        this.tweens.add({
            targets: view.art, y: view.statue.bottom - 7, duration: 160, yoyo: true, ease: 'Sine.easeOut',
            onUpdate: () => { view.art.y = Math.round(view.art.y); },
            onComplete: () => {
                view.art.y = view.statue.bottom;
                this.busy = false;
                this.refresh();
                if (wasLocked && !this.isLocked('temple')) this.awakenPhoenix();
            },
        });
        if (building === 'temple') SoundHelper.playSound(this, 'revival', 0.55);
    }

    // The fourth guardian was just restored: the Phoenix stirs.
    awakenPhoenix() {
        const phoenix = this.views.get('temple').art;
        this.tweens.add({ targets: phoenix, alpha: { from: 0.3, to: 1 }, duration: 450 });
        SoundHelper.playSound(this, 'revival', 0.4);
    }

    confirmResetMetaProgression() {
        if (!devToolsEnabled()) return;
        openConfirmModal(this, {
            title: t(this, 'ui.village.resetMetaTitle'),
            body: t(this, 'ui.village.resetMetaBody'),
            confirmLabel: t(this, 'ui.options.reset'),
            cancelLabel: t(this, 'ui.options.cancel'),
            onConfirm: () => {
                if (!devToolsEnabled()) return;
                this.meta.resetProgression();
                this.refresh();
            },
        });
    }

    // Pauses the Sanctuary under the pause menu, as the rest room does.
    openOptions() {
        if (this.scene.isActive('PauseMenuScene')) return;
        this.scene.launch('PauseMenuScene', { pausedScene: this.scene.key });
        this.scene.pause();
    }

    back() {
        this.cameras.main.fadeOut(250, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MainMenuScene'));
    }

    leave() {
        // The music keeps going: Choose Your Road plays this same theme.
        this.cameras.main.fadeOut(350, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.input.enabled = false;
            this.scene.start('LocationPickScene', {
                mode: 'newRun',
                act: 1,
                characterId: this.characterId,
            });
        });
    }
}

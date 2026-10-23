import { SANCTUARY_STATUES, restorationCost,
    freshSanctuaryPreview, phoenixUnlocked, previewRestoration } from '../content/sanctuary/preview.js';
import { createPaintedButton } from '../ui/PaintedButton.js';
import { createTitle } from '../ui/titleText.js';
import { SoundHelper } from '../audio/SoundHelper.js';
import { MusicManager } from '../audio/MusicManager.js';
import { setHoverLight } from '../ui/HoverLight.js';
import { devToolsEnabled } from '../config/DevTools.js';

export class SanctuaryPreviewScene extends Phaser.Scene {
    constructor() { super({ key: 'SanctuaryPreviewScene' }); }

    preload() {
        // The statues are frames of the packed sanctuary strip, loaded at boot.
        if (!this.textures.exists('sanctuaryBackground')) {
            this.load.image('sanctuaryBackground', 'assets/art/backgrounds/bonefloodOssuary.png');
        }
    }

    create() {
        if (!devToolsEnabled()) { this.scene.start('MainMenuScene'); return; }
        this.state = this.game.sanctuaryPreview || freshSanctuaryPreview();
        this.game.sanctuaryPreview = this.state;
        this.selectedId = 'lion';
        this.busy = false;
        this.views = new Map();
        this.add.rectangle(320, 180, 640, 360, 0x161c20);
        const background = this.add.image(320, 180, 'sanctuaryBackground');
        background.setScale(Math.max(640 / background.width, 360 / background.height));
        this.add.rectangle(320, 180, 640, 360, 0x10151b, 0.36);
        createTitle(this, 320, 22, 'The Forgotten Court', { color: '#ecdbb3' });
        this.add.text(320, 44, 'Test Site preview', {
            fontSize: '10px', fill: '#a5a394', fontFamily: '"HoMM Pixel"',
        }).setOrigin(0.5);
        this.pointsText = this.add.text(24, 24, '', {
            fontSize: '11px', fill: '#f2d3aa', fontFamily: '"HoMM Pixel"',
        });

        // The guardians form an arc around the final, central shrine.
        this.add.image(320, 278, 'sigilRoomFloor').setAlpha(0.65);
        for (const statue of SANCTUARY_STATUES) this.drawStatue(statue);

        this.backButton = createPaintedButton(this, 80, 340, 'Back', () => this.leave());
        this.restoreButton = createPaintedButton(this, 320, 340, 'Restore', () => this.restoreSelected());
        this.resetButton = createPaintedButton(this, 560, 340, 'Reset preview', () => {
            if (this.busy) return;
            this.game.sanctuaryPreview = freshSanctuaryPreview();
            this.scene.restart();
        }, { size: '12px' });
        this.input.keyboard?.on('keydown-ESC', () => this.leave());
        this.refresh();
        MusicManager.play(this, 'menu_music', 0.45, 500);
    }

    drawStatue(statue) {
        const { x, bottom } = statue;
        const ring = this.add.ellipse(x, bottom - 2, 100, 21, 0xc6a45d, 0.08)
            .setStrokeStyle(1, 0xdec58b, 0.25);
        const art = this.add.image(x, bottom, statue.texture).setOrigin(0.5, 1);
        const inlays = [];
        for (let i = 0; i < (statue.id === 'phoenix' ? 1 : 5); i++) {
            inlays.push(this.add.image(x, bottom - 9, 'villageRankStar').setVisible(false));
        }
        const name = this.add.text(x, bottom + 8, statue.name, {
            fontSize: '9px', fill: '#d9c9a7', fontFamily: '"HoMM Pixel"',
            stroke: '#10151b', strokeThickness: 3,
        }).setOrigin(0.5);
        const rule = this.add.text(x, bottom + 18, statue.rule, {
            fontSize: '8px', fill: '#e1d6be', fontFamily: '"HoMM Pixel"',
            align: 'center', wordWrap: { width: 156 }, stroke: '#10151b', strokeThickness: 3,
        }).setOrigin(0.5, 0);
        // Bounds fit each sculpture, leaving neighbouring statues clickable.
        const hit = this.add.rectangle(x, bottom - 56, 100, 124, 0, 0).setInteractive({ useHandCursor: true });
        hit.on('pointerover', () => { if (!this.busy) setHoverLight(art, true); });
        hit.on('pointerout', () => setHoverLight(art, false));
        hit.on('pointerdown', () => {
            if (this.busy) return;
            this.selectedId = statue.id;
            SoundHelper.playVariant(this, 'button_click', 0.35);
            this.refresh();
        });
        this.views.set(statue.id, { art, ring, name, rule, inlays, hit });
    }

    refresh() {
        const unlocked = phoenixUnlocked(this.state.ranks);
        this.pointsText.setText(`Restoration: ${this.state.points}`);
        for (const statue of SANCTUARY_STATUES) {
            const view = this.views.get(statue.id);
            const rank = this.state.ranks[statue.id];
            const locked = statue.id === 'phoenix' && !unlocked;
            view.art.setTexture(statue.id === 'phoenix' && !rank ? 'sanctuaryPhoenixBroken' : statue.texture);
            view.art.setTint(locked ? 0x444b53 : rank ? 0xffffff : 0x90948b).setAlpha(locked ? 0.55 : 1);
            // Same native-size, overlapping rank stars as the village, centred
            // on the pedestal for however many restorations have been bought.
            view.inlays.forEach((star, i) => {
                star.setX(Math.round(statue.x + (i - (rank - 1) / 2) * 6));
                star.setVisible(i < rank);
            });
            view.ring.setAlpha(this.selectedId === statue.id ? 1 : 0.3);
            view.ring.setStrokeStyle(1, 0xdec58b, this.selectedId === statue.id ? 0.9 : 0.25);
            view.name.setColor(this.selectedId === statue.id ? '#fff0c7' : '#d9c9a7');
        }
        const statue = SANCTUARY_STATUES.find(entry => entry.id === this.selectedId);
        const rank = this.state.ranks[statue.id];
        const maxed = rank >= (statue.id === 'phoenix' ? 1 : 5);
        const locked = statue.id === 'phoenix' && !unlocked;
        const cost = restorationCost(statue.id, rank);
        this.restoreButton.list[1].setText(locked ? 'Dormant' : maxed ? 'Restored' : `Restore ${cost}`);
        this.restoreButton.setAlpha(locked || maxed || this.state.points < cost ? 0.45 : 1);
    }

    restoreSelected() {
        if (this.busy) return;
        const wasUnlocked = phoenixUnlocked(this.state.ranks);
        const result = previewRestoration(this.state, this.selectedId);
        if (!result.ok) return;
        this.busy = true;
        const statue = SANCTUARY_STATUES.find(entry => entry.id === this.selectedId);
        const view = this.views.get(statue.id);
        SoundHelper.playSound(this, 'magic_cast', 0.5);
        this.tweens.add({
            targets: view.art, y: statue.bottom - 7, duration: 160, yoyo: true, ease: 'Sine.easeOut',
            onUpdate: () => { view.art.y = Math.round(view.art.y); },
            onComplete: () => {
                view.art.y = statue.bottom;
                this.busy = false;
                this.refresh();
                if (!wasUnlocked && result.awakened) {
                    const phoenix = this.views.get('phoenix').art;
                    this.tweens.add({ targets: phoenix, alpha: { from: 0.3, to: 1 }, duration: 450 });
                    SoundHelper.playSound(this, 'recovery', 0.5);
                }
            },
        });
    }

    leave() { if (!this.busy) this.scene.start('SandboxHubScene'); }
}

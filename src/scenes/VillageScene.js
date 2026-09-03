// Village map: dedicated lots for named buildings. Empty lots wait for Support.
import { SoundHelper } from '../audio/SoundHelper.js';
import { MusicManager } from '../audio/MusicManager.js';
import { MetaProgressionManager } from '../managers/MetaProgressionManager.js';
import {
  VILLAGE_PLOTS,
  getVillageBuilding,
} from '../content/village/index.js';
import { t } from '../i18n/i18n.js';
import { createTitle } from '../ui/titleText.js';

export class VillageScene extends Phaser.Scene {
  constructor() {
    super({ key: 'VillageScene' });
  }

  init(data = {}) {
    this.characterId = data.characterId === 'warrior' ? 'warrior' : 'rogue';
    this.selectedId = null;
    this.plotViews = [];
  }

  create() {
    this.meta = new MetaProgressionManager(this);

    if (this.textures.exists('mainBG')) {
      this.add.image(320, 180, 'mainBG');
    } else {
      this.add.rectangle(320, 180, 640, 360, 0x1a1a1a);
    }
    this.add.rectangle(320, 180, 640, 360, 0x0d1a0c, 0.72);

    this.drawGround();

    createTitle(this, 320, 16, t(this, 'ui.village.title'), {
      color: '#f2d3aa',
      fallbackSize: '18px',
    });
    this.supportText = this.add.text(320, 34, '', {
      fontSize: '11px',
      fill: '#f0d78c',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);

    this.hintText = this.add.text(320, 48, t(this, 'ui.village.hint'), {
      fontSize: '10px',
      fill: '#8b949e',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);

    VILLAGE_PLOTS.forEach((plot) => this.drawPlot(plot));

    this.detailTitle = this.add.text(320, 292, '', {
      fontSize: '12px',
      fill: '#f0d78c',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);
    this.detailBody = this.add.text(320, 308, t(this, 'ui.village.pickPlot'), {
      fontSize: '10px',
      fill: '#c9d1d9',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
      align: 'center',
      wordWrap: { width: 520 },
    }).setOrigin(0.5);

    this.buildBtn = this.add.rectangle(466, 338, 132, 24, 0x3d2418, 0.95)
      .setStrokeStyle(1, 0xd4a017)
      .setInteractive({ useHandCursor: true });
    this.buildLabel = this.add.text(466, 338, t(this, 'ui.village.build'), {
      fontSize: '11px',
      fill: '#e6edf3',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);
    this.buildBtn.on('pointerdown', () => this.tryBuild());
    this.buildBtn.on('pointerover', () => {
      SoundHelper.playVariant(this, 'hover_button', 0.3);
      this.buildBtn.setStrokeStyle(1, 0xf2d3aa);
    });
    this.buildBtn.on('pointerout', () => this.buildBtn.setStrokeStyle(1, 0xd4a017));

    this.makeFooterButton(80, t(this, 'ui.village.back'), 0x2c1810, 0x8b6914, () => {
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('CharacterSelectScene');
      });
    });
    this.makeFooterButton(240, t(this, 'ui.village.leave'), 0x3d2418, 0xd4a017, () => this.leave());

    this.makeFooterButton(580, '+25', 0x1f3d2b, 0x4a9e6a, () => {
      this.meta.grantDebugXp(this.characterId, 25);
      this.refresh();
    });

    this.refresh();
    MusicManager.play(this, 'menu_music', 0.45, 500);
  }

  drawGround() {
    this.add.rectangle(320, 176, 16, 168, 0x5a4630, 1);
    this.add.rectangle(320, 176, 420, 14, 0x5a4630, 1);
    this.add.rectangle(320, 176, 10, 160, 0x6b5538, 1);
    this.add.rectangle(320, 176, 410, 8, 0x6b5538, 1);
  }

  drawPlot(plot) {
    const empty = !plot.id;
    const panel = this.add.rectangle(plot.x, plot.y, plot.w, plot.h, 0x2c1810, 0.92)
      .setStrokeStyle(1, empty ? 0x444c56 : 0x8b6914);
    const name = this.add.text(plot.x, plot.y - 14, '', {
      fontSize: '11px',
      fill: '#f2d3aa',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);
    const rank = this.add.text(plot.x, plot.y + 8, '', {
      fontSize: '10px',
      fill: '#c9d1d9',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);

    const view = { plot, panel, name, rank };
    this.plotViews.push(view);

    if (empty) {
      name.setText(t(this, 'ui.village.emptyLot'));
      rank.setText(t(this, 'ui.village.future'));
      name.setColor('#6e7681');
      rank.setColor('#555b63');
      return;
    }

    panel.setInteractive({ useHandCursor: true });
    panel.on('pointerover', () => {
      SoundHelper.playVariant(this, 'hover_button', 0.25);
      if (this.selectedId !== plot.id) panel.setStrokeStyle(1, 0xd4a017);
    });
    panel.on('pointerout', () => {
      panel.setStrokeStyle(1, this.selectedId === plot.id ? 0xd4a017 : 0x8b6914);
    });
    panel.on('pointerdown', () => {
      this.selectedId = plot.id;
      this.refresh();
    });
  }

  makeFooterButton(x, label, fill, stroke, onClick) {
    const btn = this.add.rectangle(x, 338, 110, 24, fill, 0.95)
      .setStrokeStyle(1, stroke)
      .setInteractive({ useHandCursor: true });
    this.add.text(x, 338, label, {
      fontSize: '11px',
      fill: '#e6edf3',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);
    btn.on('pointerover', () => {
      SoundHelper.playVariant(this, 'hover_button', 0.3);
      btn.setStrokeStyle(1, 0xd4a017);
    });
    btn.on('pointerout', () => btn.setStrokeStyle(1, stroke));
    btn.on('pointerdown', onClick);
  }

  tryBuild() {
    if (!this.selectedId) return;
    const result = this.meta.upgradeBuilding(this.characterId, this.selectedId);
    if (!result.ok) {
      SoundHelper.playVariant(this, 'hover_button', 0.2);
      return;
    }
    SoundHelper.playVariant(this, 'hover_button', 0.55);
    this.refresh();
  }

  leave() {
    MusicManager.stopIfPlaying(this, 'menu_music', 300);
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

  refresh() {
    const support = this.meta.getCharacterXp(this.characterId);
    this.supportText.setText(t(this, 'ui.village.support', { amount: support }));

    this.plotViews.forEach((view) => {
      const { plot, panel, name, rank } = view;
      if (!plot.id) return;
      const def = getVillageBuilding(plot.id);
      const current = this.meta.getBuildingRank(plot.id);
      const built = current > 0;
      name.setText(t(this, `village.${plot.id}.name`));
      rank.setText(built
        ? t(this, 'ui.village.rank', { rank: current, max: def.maxRank })
        : t(this, 'ui.village.vacant'));
      panel.setFillStyle(built ? 0x3d2a18 : 0x2c1810, built ? 0.95 : 0.9);
      panel.setStrokeStyle(1, this.selectedId === plot.id ? 0xd4a017 : 0x8b6914);
      name.setColor(built ? '#f2d3aa' : '#8b949e');
    });

    if (!this.selectedId) {
      this.detailTitle.setText('');
      this.detailBody.setText(t(this, 'ui.village.pickPlot'));
      this.buildLabel.setText(t(this, 'ui.village.build'));
      this.buildBtn.setAlpha(0.45);
      return;
    }

    const def = getVillageBuilding(this.selectedId);
    const current = this.meta.getBuildingRank(this.selectedId);
    const check = this.meta.canUpgradeBuilding(this.characterId, this.selectedId);
    this.detailTitle.setText(t(this, `village.${this.selectedId}.name`));
    this.detailBody.setText(t(this, `village.${this.selectedId}.desc`));
    if (!check.ok && check.reason === 'max') {
      this.buildLabel.setText(t(this, 'ui.village.maxed'));
      this.buildBtn.setAlpha(0.45);
    } else if (!check.ok && check.reason === 'support') {
      this.buildLabel.setText(t(this, 'ui.village.need', { cost: check.cost }));
      this.buildBtn.setAlpha(0.7);
    } else {
      const verb = current <= 0 ? t(this, 'ui.village.build') : t(this, 'ui.village.upgrade');
      this.buildLabel.setText(`${verb}  ${check.cost}`);
      this.buildBtn.setAlpha(1);
    }
  }
}

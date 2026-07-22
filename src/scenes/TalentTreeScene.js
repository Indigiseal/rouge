// Talent tree after character select. Shadow/Iron purchasable; other branches WIP.
// Purchases require at least 1 rank in the previous node of the same branch.
import { SoundHelper } from '../utils/SoundHelper.js';
import { MusicManager } from '../utils/MusicManager.js';
import { MetaProgressionManager } from '../MetaProgressionManager.js';
import {
  getBranchesForCharacter,
  getTalentNode,
  costForNextRank,
} from '../utils/TalentDefinitions.js';
import { isMetaProgressionDisabled } from '../utils/TestOptions.js';

export class TalentTreeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TalentTreeScene' });
  }

  init(data) {
    this.characterId = data?.characterId === 'warrior' ? 'warrior' : 'rogue';
  }

  create() {
    this.meta = new MetaProgressionManager(this);
    this.selectedTalentId = null;
    this.ui = [];

    if (this.textures.exists('mainBG')) {
      this.add.image(320, 180, 'mainBG');
    } else {
      this.add.rectangle(320, 180, 640, 360, 0x1a1a1a);
    }
    this.add.rectangle(320, 180, 640, 360, 0x000000, 0.62);

    const title = this.characterId === 'warrior' ? 'Warrior talents' : 'Rogue talents';
    this.add.text(320, 16, title, {
      fontSize: '18px',
      fill: '#e6edf3',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);

    this.xpText = this.add.text(320, 34, '', {
      fontSize: '11px',
      fill: '#f0d78c',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);

    this.detailBg = this.add.rectangle(320, 292, 520, 72, 0x2c1810, 0.95)
      .setStrokeStyle(1, 0x8b6914);
    this.detailTitle = this.add.text(80, 262, '', {
      fontSize: '12px',
      fill: '#f0d78c',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    });
    this.detailBody = this.add.text(80, 280, 'Select a talent', {
      fontSize: '10px',
      fill: '#c9d1d9',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
      wordWrap: { width: 360 },
    });

    this.buyBtn = this.add.rectangle(500, 292, 100, 28, 0x3d2418, 0.95)
      .setStrokeStyle(1, 0xd4a017)
      .setInteractive({ useHandCursor: true });
    this.buyLabel = this.add.text(500, 292, 'Buy', {
      fontSize: '12px',
      fill: '#e6edf3',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);
    this.buyBtn.on('pointerdown', () => this.tryBuy());

    this.createBranchColumns();
    this.createFooter();
    this.refresh();

    MusicManager.play(this, 'menu_music', 0.45, 500);
  }

  createBranchColumns() {
    const branches = getBranchesForCharacter(this.characterId);
    const colW = 190;
    const startX = 320 - ((branches.length - 1) * colW) / 2;

    branches.forEach((branch, bi) => {
      const x = startX + bi * colW;
      this.add.text(x, 52, branch.wip ? `${branch.name} (WIP)` : branch.name, {
        fontSize: '12px',
        fill: branch.wip ? '#6e7681' : '#f0d78c',
        fontFamily: '"HoMM Pixel", Arial, sans-serif',
      }).setOrigin(0.5);

      branch.nodes.forEach((talentId, ni) => {
        const y = 78 + ni * 32;
        const node = getTalentNode(talentId);
        const bg = this.add.rectangle(x, y, 176, 26, 0x2c1810, 0.92)
          .setStrokeStyle(1, branch.wip ? 0x444c56 : 0x8b6914)
          .setInteractive({ useHandCursor: true });
        const label = this.add.text(x, y, node?.name || talentId, {
          fontSize: '10px',
          fill: branch.wip ? '#8b949e' : '#e6edf3',
          fontFamily: '"HoMM Pixel", Arial, sans-serif',
        }).setOrigin(0.5);

        bg.on('pointerover', () => {
          SoundHelper.playVariant(this, 'hover_button', 0.3);
          bg.setStrokeStyle(1, 0xd4a017);
        });
        bg.on('pointerout', () => {
          bg.setStrokeStyle(1, this.selectedTalentId === talentId ? 0xd4a017 : (branch.wip ? 0x444c56 : 0x8b6914));
        });
        bg.on('pointerdown', () => this.selectTalent(talentId));

        this.ui.push({ talentId, bg, label, wip: Boolean(branch.wip) });
      });
    });
  }

  createFooter() {
    const back = this.add.rectangle(160, 340, 120, 24, 0x2c1810, 0.92)
      .setStrokeStyle(1, 0x8b6914)
      .setInteractive({ useHandCursor: true });
    this.add.text(160, 340, 'Back', {
      fontSize: '11px',
      fill: '#e6edf3',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);
    back.on('pointerover', () => back.setStrokeStyle(1, 0xd4a017));
    back.on('pointerout', () => back.setStrokeStyle(1, 0x8b6914));
    back.on('pointerdown', () => {
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('CharacterSelectScene');
      });
    });

    const start = this.add.rectangle(480, 340, 140, 24, 0x3d2418, 0.95)
      .setStrokeStyle(1, 0xd4a017)
      .setInteractive({ useHandCursor: true });
    this.add.text(480, 340, 'Start run', {
      fontSize: '11px',
      fill: '#e6edf3',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
    }).setOrigin(0.5);
    start.on('pointerover', () => {
      SoundHelper.playVariant(this, 'hover_button', 0.35);
      start.setFillStyle(0x5a3820, 0.98);
    });
    start.on('pointerout', () => start.setFillStyle(0x3d2418, 0.95));
    start.on('pointerdown', () => this.startRun());
  }

  selectTalent(talentId) {
    this.selectedTalentId = talentId;
    this.refresh();
  }

  refresh() {
    const xp = this.meta.getCharacterXp(this.characterId);
    this.xpText.setText(isMetaProgressionDisabled() ? 'Meta disabled' : `XP: ${xp}`);

    this.ui.forEach((row) => {
      const rank = this.meta.getTalentRank(this.characterId, row.talentId);
      const node = getTalentNode(row.talentId);
      const max = node?.maxRank || 1;
      const check = this.meta.canPurchaseTalent(this.characterId, row.talentId);
      const locked = check.reason === 'prereq';
      row.label.setText(
        `${locked ? '[ ] ' : ''}${node?.name || row.talentId}  ${rank}/${max}`
      );
      const selected = this.selectedTalentId === row.talentId;
      row.bg.setStrokeStyle(1, selected ? 0xd4a017 : (row.wip || locked ? 0x444c56 : 0x8b6914));
      if (rank > 0) row.bg.setFillStyle(0x3d2a18, 0.95);
      else row.bg.setFillStyle(0x2c1810, 0.92);
      row.label.setColor(locked && !row.wip ? '#6e7681' : (row.wip ? '#8b949e' : '#e6edf3'));
    });

    const node = getTalentNode(this.selectedTalentId);
    if (!node) {
      this.detailTitle.setText('');
      this.detailBody.setText('Select a talent');
      this.buyLabel.setText('Buy');
      return;
    }

    const rank = this.meta.getTalentRank(this.characterId, node.id);
    const descIdx = Math.min(Math.max(rank, 1), node.descriptionRanks.length) - 1;
    const nextDesc = node.descriptionRanks[Math.min(rank, node.descriptionRanks.length - 1)];
    this.detailTitle.setText(node.name + (node.wip ? '  [WIP]' : ''));
    this.detailBody.setText(rank > 0
      ? `Owned r${rank}: ${node.descriptionRanks[descIdx]}\nNext: ${rank >= node.maxRank ? 'MAX' : nextDesc}`
      : nextDesc);

    const check = this.meta.canPurchaseTalent(this.characterId, node.id);
    if (node.wip || check.reason === 'wip') {
      this.buyLabel.setText('WIP');
    } else if (check.reason === 'prereq') {
      const prev = getTalentNode(check.prereqId);
      this.buyLabel.setText('Locked');
      this.detailBody.setText(
        `${nextDesc}\nLocked: buy at least 1 rank in ${prev?.name || check.prereqId} first.`
      );
    } else if (check.reason === 'max') {
      this.buyLabel.setText('MAX');
    } else if (check.ok) {
      this.buyLabel.setText(`Buy ${check.cost}`);
    } else if (check.reason === 'xp') {
      const cost = costForNextRank(rank);
      this.buyLabel.setText(`${cost}?`);
    } else {
      this.buyLabel.setText('Buy');
    }
  }

  tryBuy() {
    if (!this.selectedTalentId) return;
    const node = getTalentNode(this.selectedTalentId);
    if (!node) return;
    if (node.wip) {
      SoundHelper.playVariant(this, 'invalid_action', 0.4);
      this.detailBody.setText('This branch is WIP — browsing only.');
      return;
    }

    const result = this.meta.purchaseTalent(this.characterId, this.selectedTalentId);
    if (!result.ok) {
      SoundHelper.playVariant(this, 'invalid_action', 0.4);
      if (result.reason === 'xp') this.detailBody.setText('Not enough XP.');
      else if (result.reason === 'wip') this.detailBody.setText('WIP — cannot buy yet.');
      else if (result.reason === 'prereq') {
        const prev = getTalentNode(result.prereqId);
        this.detailBody.setText(`Need 1 rank in ${prev?.name || result.prereqId} first.`);
      } else this.detailBody.setText('Cannot buy.');
      this.refresh();
      return;
    }
    SoundHelper.playVariant(this, 'hover_button', 0.5);
    this.refresh();
  }

  startRun() {
    const needsArmorPick = this.characterId === 'warrior'
      && this.meta.getTalentRank(this.characterId, 'armorerStart') > 0;

    MusicManager.stopIfPlaying(this, 'menu_music', 300);
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      if (needsArmorPick) {
        this.scene.start('ArmorerPickScene', { characterId: this.characterId });
      } else {
        this.scene.start('GameScene', { newGame: true, characterId: this.characterId });
      }
    });
  }
}

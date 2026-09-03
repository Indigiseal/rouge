// Talent tree after character select.
//
// Only the purchasable branch is drawn. The WIP branches used to take two of
// the three columns to show nothing buyable, which was affordable at five nodes
// per branch and stopped being affordable at ten — the real branch ran off the
// bottom of the screen. The freed width now carries a second node column and a
// permanent detail panel, so nothing overlaps and nothing scrolls.
//
// Purchases require at least 2 ranks in the previous node of the same branch.
import { SoundHelper } from '../audio/SoundHelper.js';
import { MusicManager } from '../audio/MusicManager.js';
import { MetaProgressionManager } from '../managers/MetaProgressionManager.js';
import {
  getBranchesForCharacter,
  getTalentNode,
  getTalentDisplay,
  costForNextRank,
} from '../content/talents/index.js';
import { isMetaProgressionDisabled } from '../config/TestOptions.js';
import { getGameLanguage, t } from '../i18n/i18n.js';
import { FONT_SIZE, serifStyle } from '../ui/uiFont.js';

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

    const title = t(this, this.characterId === 'warrior' ? 'ui.talents.warriorTitle' : 'ui.talents.rogueTitle');
    this.add.text(320, 16, title, serifStyle(FONT_SIZE.heading, '#e6edf3')).setOrigin(0.5);

    this.xpText = this.add.text(320, 34, '', serifStyle('14px', '#f0d78c')).setOrigin(0.5);

    // Detail panel owns the right half — a fixed home means the description can
    // never land on top of the nodes the way the old floating one did.
    this.detailBg = this.add.rectangle(466, 176, 332, 232, 0x2c1810, 0.95)
      .setStrokeStyle(1, 0x8b6914);
    this.detailTitle = this.add.text(312, 70, '', {
      ...serifStyle(FONT_SIZE.body, '#f0d78c'),
      wordWrap: { width: 308 },
    });
    this.detailBody = this.add.text(312, 92, t(this, 'ui.talents.selectTalent'), {
      ...serifStyle('13px', '#c9d1d9'),
      lineSpacing: 3,
      wordWrap: { width: 308 },
    });

    this.buyBtn = this.add.rectangle(466, 262, 120, 26, 0x3d2418, 0.95)
      .setStrokeStyle(1, 0xd4a017)
      .setInteractive({ useHandCursor: true });
    this.buyLabel = this.add.text(466, 262, t(this, 'ui.talents.buy'), serifStyle('14px', '#e6edf3')).setOrigin(0.5);
    this.buyBtn.on('pointerdown', () => this.tryBuy());

    this.createBranchColumns();
    this.createFooter();
    this.refresh();

    MusicManager.play(this, 'menu_music', 0.45, 500);
  }

  createBranchColumns() {
    const branch = getBranchesForCharacter(this.characterId).find((b) => b.purchasable)
      || getBranchesForCharacter(this.characterId)[0];
    if (!branch) return;

    const branchName = t(this, `ui.talents.branch.${branch.id}`);
    this.add.text(150, 50, branchName, serifStyle('14px', '#f0d78c')).setOrigin(0.5);

    // Two columns of five: read down the left, then down the right. A single
    // column of ten does not fit between the header and the footer.
    const PER_COL = 5;
    const COL_X = [78, 212];
    const ROW_Y = 74;
    const ROW_H = 30;

    branch.nodes.forEach((talentId, ni) => {
      const x = COL_X[Math.floor(ni / PER_COL)] ?? COL_X[COL_X.length - 1];
      const y = ROW_Y + (ni % PER_COL) * ROW_H;
      const node = getTalentNode(talentId);
      const display = getTalentDisplay(talentId, getGameLanguage(this)) || node;
      const descriptionRanks = [...(display?.descriptionRanks || [])];
      const displayName = display?.name || node?.name || talentId;

      const bg = this.add.rectangle(x, y, 128, 26, 0x2c1810, 0.92)
        .setStrokeStyle(1, 0x8b6914)
        .setInteractive({ useHandCursor: true });
      // Order number doubles as the prerequisite hint: the chain is walked in
      // this order, so "3" reads as "third purchase along the branch".
      const index = this.add.text(x - 58, y, String(ni + 1), serifStyle('9px', '#8b6914')).setOrigin(0, 0.5);
      const label = this.add.text(x - 44, y, displayName, serifStyle('9px', '#e6edf3'))
        .setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
      const rankText = this.add.text(x + 58, y, '', serifStyle('9px', '#c9d1d9')).setOrigin(1, 0.5);

      const select = () => this.selectTalent(talentId);
      bg.on('pointerover', () => {
        SoundHelper.playVariant(this, 'hover_button', 0.3);
        bg.setStrokeStyle(1, 0xd4a017);
      });
      bg.on('pointerout', () => {
        bg.setStrokeStyle(1, this.selectedTalentId === talentId ? 0xd4a017 : 0x8b6914);
      });
      bg.on('pointerdown', select);
      label.on('pointerdown', select);

      this.ui.push({
        talentId, bg, label, index, rankText,
        wip: false,
        name: displayName,
        maxRank: node?.maxRank || 1,
        descriptionRanks,
      });
    });
  }

  createFooter() {
    const mkButton = (x, w, label, fill, stroke, onClick) => {
      const btn = this.add.rectangle(x, 340, w, 24, fill, 0.95)
        .setStrokeStyle(1, stroke)
        .setInteractive({ useHandCursor: true });
      const text = this.add.text(x, 340, label, serifStyle('14px', '#e6edf3')).setOrigin(0.5);
      btn.on('pointerover', () => {
        SoundHelper.playVariant(this, 'hover_button', 0.35);
        btn.setStrokeStyle(1, 0xd4a017);
      });
      btn.on('pointerout', () => btn.setStrokeStyle(1, stroke));
      btn.on('pointerdown', onClick);
      return { btn, text };
    };

    mkButton(70, 110, t(this, 'ui.common.back'), 0x2c1810, 0x8b6914, () => {
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('CharacterSelectScene');
      });
    });

    mkButton(200, 130, t(this, 'ui.talents.startRun'), 0x3d2418, 0xd4a017, () => this.startRun());

    // Test build only: the meta ladder is 300 XP long and earning it honestly
    // takes ~40 runs, which is not a way to check the screen or tune numbers.
    // Distinct colour so it is obvious this is not shipping UI.
    mkButton(560, 120, '+25 XP  (debug)', 0x1f3d2b, 0x4a9e6a, () => {
      this.meta.grantDebugXp(this.characterId, 25);
      this.refresh();
    });
  }

  selectTalent(talentId) {
    this.selectedTalentId = talentId;
    this.refresh();
  }

  refresh() {
    const xp = this.meta.getCharacterXp(this.characterId);
    this.xpText.setText(isMetaProgressionDisabled() ? t(this, 'ui.talents.metaDisabled') : t(this, 'ui.talents.xp', { amount: xp }));

    this.ui.forEach((row) => {
      const rank = this.meta.getTalentRank(this.characterId, row.talentId);
      const max = row.maxRank || 1;
      const check = this.meta.canPurchaseTalent(this.characterId, row.talentId);
      const locked = check.reason === 'prereq';
      const maxed = rank >= max;
      // Name and rank are separate objects pinned to opposite edges, so a long
      // name can never push the counter out of the plate.
      row.label.setText(row.name || row.talentId);
      row.rankText.setText(`${rank}/${max}`);
      const selected = this.selectedTalentId === row.talentId;
      row.bg.setStrokeStyle(1, selected ? 0xd4a017 : (locked ? 0x444c56 : 0x8b6914));
      row.bg.setFillStyle(rank > 0 ? 0x3d2a18 : 0x2c1810, rank > 0 ? 0.95 : 0.92);
      row.label.setColor(locked ? '#6e7681' : '#e6edf3');
      row.rankText.setColor(maxed ? '#7bc47f' : (locked ? '#6e7681' : '#c9d1d9'));
      row.index.setColor(locked ? '#4a3a12' : '#8b6914');
    });

    // Always resolve copy fresh by selected id (do not trust row snapshots for body text).
    const selectedId = this.selectedTalentId;
    const display = selectedId ? getTalentDisplay(selectedId, getGameLanguage(this)) : null;
    const node = selectedId ? getTalentNode(selectedId) : null;
    if (!selectedId || !display || !node) {
      this.detailTitle.setText('');
      this.detailBody.setText(t(this, 'ui.talents.selectTalent'));
      this.buyLabel.setText(t(this, 'ui.talents.buy'));
      return;
    }

    const ranks = display.descriptionRanks || node.descriptionRanks || [];
    const rank = this.meta.getTalentRank(this.characterId, selectedId);
    const ownedDesc = ranks[Math.max(0, Math.min(rank, ranks.length) - 1)] || '';
    const nextDesc = ranks[Math.min(rank, Math.max(0, ranks.length - 1))] || '';
    const title = display.name + (node.wip ? '  [WIP]' : '');

    const check = this.meta.canPurchaseTalent(this.characterId, selectedId);
    let body = rank > 0
        ? t(this, 'ui.talents.ownedNext', { rank, owned: ownedDesc, next: rank >= (node.maxRank || 1) ? t(this, 'ui.talents.max') : nextDesc })
      : (nextDesc || t(this, 'ui.talents.noDescription'));

    if (node.wip || check.reason === 'wip') {
      this.buyLabel.setText(t(this, 'ui.talents.wip'));
    } else if (check.reason === 'prereq') {
      const prev = getTalentDisplay(check.prereqId, getGameLanguage(this)) || getTalentNode(check.prereqId);
      this.buyLabel.setText(t(this, 'ui.talents.locked'));
      body = t(this, 'ui.talents.lockedHint', { description: nextDesc || t(this, 'ui.talents.noDescription'), name: prev?.name || check.prereqId });
    } else if (check.reason === 'max') {
      this.buyLabel.setText(t(this, 'ui.talents.max'));
    } else if (check.ok) {
      this.buyLabel.setText(t(this, 'ui.talents.buyCost', { amount: check.cost }));
    } else if (check.reason === 'xp') {
      const cost = costForNextRank(rank);
      this.buyLabel.setText(`${cost}?`);
    } else {
      this.buyLabel.setText(t(this, 'ui.talents.buy'));
    }

    this.detailTitle.setText(title);
    this.detailBody.setText(body);
  }

  tryBuy() {
    if (!this.selectedTalentId) return;
    const node = getTalentNode(this.selectedTalentId);
    if (!node) return;
    if (node.wip) {
      SoundHelper.playVariant(this, 'invalid_action', 0.4);
      this.detailBody.setText(t(this, 'ui.talents.wipBranch'));
      return;
    }

    const result = this.meta.purchaseTalent(this.characterId, this.selectedTalentId);
    if (!result.ok) {
      SoundHelper.playVariant(this, 'invalid_action', 0.4);
      if (result.reason === 'xp') this.detailBody.setText(t(this, 'ui.talents.notEnoughXp'));
      else if (result.reason === 'wip') this.detailBody.setText(t(this, 'ui.talents.wipCannotBuy'));
      else if (result.reason === 'prereq') {
        const prev = getTalentNode(result.prereqId);
        this.detailBody.setText(t(this, 'ui.talents.needRank', { name: prev?.name || result.prereqId }));
      } else this.detailBody.setText(t(this, 'ui.talents.cannotBuy'));
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
        this.scene.start('LocationPickScene', {
          mode: 'newRun',
          act: 1,
          characterId: this.characterId,
        });
      }
    });
  }
}

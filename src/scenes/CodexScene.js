// The Codex: every enemy, boss, story, sigil and amulet in the game. What the
// player has met shows its art and name; the rest is a black silhouette and
// "???". Discovery is profile-wide (content/codex/Discoveries.js).
import { SoundHelper } from '../audio/SoundHelper.js';
import { MusicManager } from '../audio/MusicManager.js';
import { t, translateDescription, translateItemName } from '../i18n/i18n.js';
import { ENEMIES, SUMMON_ONLY_ENEMY_TYPES } from '../content/cards/enemies.js';
import { BOSSES } from '../content/cards/bosses.js';
import { EVENTS } from '../content/events/index.js';
import { SIGILS, SIGIL_ICONS_KEY } from '../content/sigils/sigils.js';
import { buildCurrentAmuletDefinitions } from '../content/amulets/currentCatalog.js';
import { EVENT_ILLUSTRATION_FRAMES } from './EventScene.js';
import { isDiscovered } from '../content/codex/Discoveries.js';
import { ENEMY_SHEET_KEY, sheetRowFor } from '../content/assets/enemyCards.js';

const FONT = '"HoMM Pixel", Arial, sans-serif';
// The scrolling window: under the tabs, above the description bar.
const LIST_TOP = 56;
const LIST_BOTTOM = 312;
const SCROLL_STEP = 40;
const DRAG_SLOP = 4;
// Board order for enemies: act 1 roads, then act 2.
const LOCATION_ORDER = ['thornwake', 'silkdeep', 'tollroad', 'boneflood', 'mireturn', 'veilbleed', 'ashhowl'];
const DEFAULT_EVENT_FRAME = 7;
const ENEMY_SHEET_COLUMNS = 8;

const TABS = Object.freeze([
  { id: 'enemies', labelKey: 'ui.codex.enemies', cell: { w: 64, h: 96 }, box: { w: 52, h: 70 } },
  { id: 'bosses', labelKey: 'ui.codex.bosses', cell: { w: 112, h: 118 }, box: { w: 92, h: 92 } },
  { id: 'stories', labelKey: 'ui.codex.stories', cell: { w: 104, h: 96 }, box: { w: 64, h: 64 } },
  { id: 'sigils', labelKey: 'ui.codex.sigils', cell: { w: 76, h: 58 }, box: { w: 32, h: 32 } },
  { id: 'amulets', labelKey: 'ui.codex.amulets', cell: { w: 76, h: 70 }, box: { w: 44, h: 44 } },
]);

function firstLines(text, max = 150) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export class CodexScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CodexScene' });
  }

  init(data = {}) {
    this.tabId = TABS.some((tab) => tab.id === data.tab) ? data.tab : 'enemies';
  }

  create() {
    if (this.textures.exists('mainBG')) this.add.image(320, 180, 'mainBG');
    else this.add.rectangle(320, 180, 640, 360, 0x0a1514);
    this.add.rectangle(320, 180, 640, 360, 0x000000, 0.6);

    this.add.text(320, 16, t(this, 'ui.codex.title'), { fontSize: '20px', fill: '#d6c2c1', fontFamily: FONT })
      .setOrigin(0.5);
    this.countText = this.add.text(620, 16, '', { fontSize: '11px', fill: '#869089', fontFamily: FONT })
      .setOrigin(1, 0.5);

    this.tabButtons = TABS.map((tab, i) => this.createButton(
      96 + i * 112, 40, t(this, tab.labelKey), () => this.showTab(tab.id), 104,
    ));

    // Description bar for whatever the pointer is over.
    this.add.rectangle(320, 330, 620, 30, 0x28150c, 0.85).setStrokeStyle(1, 0x9b6a1b);
    this.infoName = this.add.text(20, 322, '', { fontSize: '11px', fill: '#fef0cf', fontFamily: FONT })
      .setOrigin(0, 0.5);
    this.infoText = this.add.text(20, 337, '', {
      fontSize: '10px', fill: '#b9b0a0', fontFamily: FONT, wordWrap: { width: 600 },
    }).setOrigin(0, 0.5);

    this.createButton(320, 352, t(this, 'ui.codex.back'), () => this.goBack(), 140);

    this.listView = this.add.container(0, 0);
    const maskShape = this.make.graphics({ add: false });
    maskShape.fillRect(0, LIST_TOP, 640, LIST_BOTTOM - LIST_TOP);
    this.listView.setMask(maskShape.createGeometryMask());
    this.scrollThumb = null;
    this.attachScrolling();

    this.input.keyboard?.on('keydown-ESC', () => this.goBack());
    this.showTab(this.tabId);
    MusicManager.play(this, 'menu_music', 0.45, 600);
  }

  // ─── Entries ─────────────────────────────────────────────────────────────

  entriesFor(tabId) {
    if (tabId === 'enemies') return this.enemyEntries();
    if (tabId === 'bosses') return this.bossEntries();
    if (tabId === 'stories') return this.storyEntries();
    if (tabId === 'sigils') return this.sigilEntries();
    return this.amuletEntries();
  }

  enemyEntries() {
    const rank = (enemy) => {
      const i = LOCATION_ORDER.indexOf(enemy.monthId);
      return i < 0 ? LOCATION_ORDER.length : i;
    };
    return Object.entries(ENEMIES)
      .filter(([id]) => !SUMMON_ONLY_ENEMY_TYPES.has(id))
      .sort(([, a], [, b]) => rank(a) - rank(b))
      .map(([id, enemy]) => {
        // Undiscovered: the creature alone off the sheet, so the silhouette is
        // its shape rather than a black card.
        const row = sheetRowFor(enemy.monthId);
        const creature = row !== undefined && Number.isInteger(enemy.sheetColumn)
          ? { texture: ENEMY_SHEET_KEY, frame: row * ENEMY_SHEET_COLUMNS + enemy.sheetColumn }
          : null;
        return {
          id,
          known: isDiscovered('enemies', id),
          name: translateItemName(this, enemy.name) || enemy.name,
          info: enemy.monthId ? t(this, `location.${enemy.monthId}.name`) : '',
          texture: enemy.sprite,
          frame: enemy.spriteFrame,
          silhouette: creature,
        };
      });
  }

  bossEntries() {
    return Object.entries(BOSSES).map(([id, boss]) => ({
      id,
      known: isDiscovered('bosses', id),
      name: translateItemName(this, boss.name) || boss.name,
      info: t(this, 'ui.codex.actBoss', { act: boss.tier || 1 }),
      texture: boss.sprite,
    }));
  }

  storyEntries() {
    return EVENTS.map((event) => {
      let description = '';
      try {
        description = typeof event.description === 'function' ? event.description({ storyRun: {} }) : event.description;
      } catch {
        description = '';
      }
      return {
        id: event.id,
        known: isDiscovered('stories', event.id),
        name: translateDescription(this, event.title || event.id),
        info: firstLines(translateDescription(this, description)),
        texture: 'eventsShops',
        frame: EVENT_ILLUSTRATION_FRAMES[event.id] ?? DEFAULT_EVENT_FRAME,
      };
    });
  }

  sigilEntries() {
    return Object.entries(SIGILS).map(([id, sigil]) => {
      const rules = [
        sigil.player ? t(this, 'ui.codex.sigilYou', { rule: sigil.player }) : null,
        sigil.enemy ? t(this, 'ui.codex.sigilEnemy', { rule: sigil.enemy }) : null,
      ].filter(Boolean);
      return {
        id,
        known: isDiscovered('sigils', id),
        name: translateItemName(this, sigil.name) || sigil.name,
        info: rules.join('   '),
        texture: SIGIL_ICONS_KEY,
        frame: sigil.frame,
      };
    });
  }

  amuletEntries() {
    const defs = buildCurrentAmuletDefinitions({});
    return Object.entries(defs).map(([id, def]) => ({
      id,
      known: isDiscovered('amulets', id),
      name: translateItemName(this, def) || def.name,
      info: translateDescription(this, def.description || ''),
      texture: def.sprite,
      frame: def.spriteFrame,
    }));
  }

  // ─── Layout ──────────────────────────────────────────────────────────────

  showTab(tabId) {
    const tab = TABS.find((entry) => entry.id === tabId) || TABS[0];
    this.tabId = tab.id;
    this.tabButtons.forEach((button, i) => button.setSelected(TABS[i].id === tab.id));

    this.listView.removeAll(true);
    const entries = this.entriesFor(tab.id);
    const known = entries.filter((entry) => entry.known).length;
    this.countText.setText(`${known} / ${entries.length}`);

    const cols = Math.max(1, Math.floor(600 / tab.cell.w));
    const startX = 320 - ((cols - 1) * tab.cell.w) / 2;
    const startY = LIST_TOP + 8;
    entries.forEach((entry, i) => {
      const x = startX + (i % cols) * tab.cell.w;
      const y = startY + Math.floor(i / cols) * tab.cell.h;
      this.addCell(entry, x, y, tab);
    });

    const rows = Math.ceil(entries.length / cols);
    this.scrollMax = Math.max(0, startY + rows * tab.cell.h - LIST_BOTTOM);
    this.buildScrollBar();
    this.setScroll(0);
    this.setInfo(null);
  }

  addCell(entry, x, y, tab) {
    const artY = y + tab.box.h / 2;
    const look = !entry.known && entry.silhouette && this.textures.exists(entry.silhouette.texture)
      ? entry.silhouette
      : entry;
    const texture = this.textures.exists(look.texture) ? look.texture : null;
    let art;
    if (texture) {
      art = Number.isInteger(look.frame)
        ? this.add.image(x, artY, texture, look.frame)
        : this.add.image(x, artY, texture);
      const scale = Math.min(tab.box.w / art.width, tab.box.h / art.height);
      // Whole-number scale-ups keep pixel art crisp; big art only shrinks.
      art.setScale(scale >= 1 ? Math.floor(scale) : scale);
      if (!entry.known) art.setTintFill(0x000000);
    } else {
      art = this.add.rectangle(x, artY, tab.box.w, tab.box.h, 0x000000, 1).setStrokeStyle(1, 0x51484b);
    }

    const label = this.add.text(x, y + tab.box.h + 6, entry.known ? entry.name : '???', {
      fontSize: '10px',
      fill: entry.known ? '#d6c2c1' : '#51484b',
      fontFamily: FONT,
      align: 'center',
      wordWrap: { width: tab.cell.w - 6 },
    }).setOrigin(0.5, 0);

    const hit = this.add.rectangle(x, y + tab.cell.h / 2 - 4, tab.cell.w - 4, tab.cell.h - 4, 0xffffff, 0)
      .setInteractive();
    hit.on('pointerover', () => {
      hit.setFillStyle(0xd48e17, 0.08);
      this.setInfo(entry);
    });
    hit.on('pointerout', () => {
      hit.setFillStyle(0xffffff, 0);
      this.setInfo(null);
    });
    this.listView.add([hit, art, label]);
  }

  setInfo(entry) {
    if (!entry) {
      this.infoName.setText('');
      this.infoText.setText(t(this, 'ui.codex.hint'));
      return;
    }
    this.infoName.setText(entry.known ? entry.name : '???');
    this.infoText.setText(entry.known ? (entry.info || '') : t(this, 'ui.codex.undiscovered'));
  }

  // ─── Scrolling (same gestures as the Test Site story list) ──────────────

  buildScrollBar() {
    this.scrollTrack?.destroy();
    this.scrollThumb?.destroy();
    this.scrollTrack = null;
    this.scrollThumb = null;
    if (this.scrollMax <= 0) return;
    const visible = LIST_BOTTOM - LIST_TOP;
    this.scrollTrack = this.add.rectangle(632, LIST_TOP, 3, visible, 0x9b6a1b, 0.2).setOrigin(0.5, 0);
    const thumbH = Math.max(18, Math.round(visible * (visible / (visible + this.scrollMax))));
    this.scrollThumb = this.add.rectangle(632, LIST_TOP, 3, thumbH, 0xd48e17, 0.75).setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(this.scrollThumb);
    this.scrollThumb.on('drag', (pointer, dragX, dragY) => {
      const travel = visible - this.scrollThumb.height;
      if (travel > 0) this.setScroll(((dragY - LIST_TOP) / travel) * this.scrollMax);
    });
  }

  attachScrolling() {
    this.input.on('wheel', (pointer, over, dx, dy) => this.setScroll(this.scrollY + (dy > 0 ? SCROLL_STEP : -SCROLL_STEP)));
    this.input.on('pointerdown', (pointer) => {
      if (pointer.y < LIST_TOP || pointer.y > LIST_BOTTOM || pointer.x > 620) return;
      this._drag = { y: pointer.y, from: this.scrollY };
    });
    this.input.on('pointermove', (pointer) => {
      if (!this._drag || !pointer.isDown || Math.abs(pointer.y - this._drag.y) <= DRAG_SLOP) return;
      this.setScroll(this._drag.from - (pointer.y - this._drag.y));
    });
    this.input.on('pointerup', () => { this._drag = null; });
  }

  setScroll(value) {
    this.scrollY = this.scrollMax > 0 ? Phaser.Math.Clamp(value, 0, this.scrollMax) : 0;
    this.listView.y = -this.scrollY;
    if (this.scrollThumb) {
      const travel = (LIST_BOTTOM - LIST_TOP) - this.scrollThumb.height;
      this.scrollThumb.y = LIST_TOP + Math.round(travel * (this.scrollY / this.scrollMax));
    }
  }

  // ─── Buttons ─────────────────────────────────────────────────────────────

  createButton(x, y, label, onClick, width) {
    const bg = this.add.rectangle(x, y, width, 18, 0x28150c, 0.92)
      .setStrokeStyle(1, 0x9b6a1b)
      .setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, { fontSize: '11px', fill: '#d6c2c1', fontFamily: FONT }).setOrigin(0.5);
    let selected = false;
    const paint = (hover) => {
      bg.setFillStyle(selected ? 0x5a3a14 : (hover ? 0x46261b : 0x28150c), 0.95);
      bg.setStrokeStyle(1, selected || hover ? 0xd48e17 : 0x9b6a1b);
      text.setColor(selected ? '#fef0cf' : '#d6c2c1');
    };
    bg.on('pointerover', () => {
      SoundHelper.playVariant(this, 'hover_button', 0.35);
      paint(true);
    });
    bg.on('pointerout', () => paint(false));
    bg.on('pointerup', () => {
      SoundHelper.playVariant(this, 'button_click', 0.5);
      onClick?.();
    });
    return {
      bg,
      text,
      setSelected(value) {
        selected = value;
        paint(false);
      },
    };
  }

  goBack() {
    if (this._leaving) return;
    this._leaving = true;
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MainMenuScene'));
  }
}

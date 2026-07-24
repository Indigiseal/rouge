// Combat HUD: avatar, HP, AP, currency, combat log, armor/amulet/relic panels.
// Mixed into GameScene via Object.assign(GameScene.prototype, CombatHud).

import { snapOriginToPixelGrid } from './PixelSnap.js';
import { SoundHelper } from '../audio/SoundHelper.js';
import { t, translateDescription, translateItemName } from '../i18n/i18n.js';

export const CombatHud = {
    createUI() {
        // Player avatar
        this.playerAvatar = this.add.image(41, 44, 'MainPlayerAvatar');
        this.playerAvatar.setScale(1);
        // Health orb under avatar
        this.healthOrbEmpty = this.add.image(87, 102, 'healthOrb', 1).setOrigin(0.5, 1);
        this.healthOrbFull = this.add.image(87, 102, 'healthOrb', 0).setOrigin(0.5, 1);
        this.healthText = this.add.text(87, 105, '50/50', {
            fontSize: '10px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel", Arial, sans-serif',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5, 0);
        this.healthText.setDepth(30);

        // Armor equip panel under hero portrait
        this.armorPanel = snapOriginToPixelGrid(this.add.image(40, 138, 'panelArmor'));
        this.armorPanel.setInteractive();
        this.armorPanel.setDepth(5);
        this.armorPanelEquippedSprite = null;
        this.armorPanelBriarFrame = null;
        this.armorPanelInfoText = null;

        // Action points: each diamond is four AP, with spent quadrants darkened.
        this.actionPointSprites = [];
        this.actionPointOverlays = [];
        this.createActionPointUI();
        
        // Coin and Crystal UI under armor panel with animations
        this.coinSprite = this.add.sprite(26, 210, 'coinUI').setScale(1);
        this.coinsText = this.add.text(26, 227, '0', {
            fontSize: '12px',
            fill: '#cf8834',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);

        this.crystalSprite = this.add.sprite(54, 211, 'CrystalUI').setScale(1);
        this.crystalsText = this.add.text(54, 228, '0', {
            fontSize: '12px',
            fill: '#a83c69',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);
        this.updateCurrencyUILayout();
        
        // Store previous values to detect changes
        this.previousCoins = 0;
        this.previousCrystals = 0;
        
        this.actionsText = this.add.text(125, 45, '', {
            fontSize: '12px',
            fill: '#00ff00',
            fontFamily: '"HoMM Pixel"'
        }).setVisible(false);
        // Amulets displayed horizontally above armor info
        this.amuletUIGroup = this.add.group();
        this.relicUIGroup = this.add.group();
        this.amuletScrollOffset = 0; // which amulet is the first one shown
        this.armorTooltip = null; // tooltip shown on hover over equipped armor
        this.floorText = this.add.text(520, 15, 'Floor: 1', {
            fontSize: '12px',
            fill: '#a78f70',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);
        
        // Pause button - positioned in top right corner
        const pauseButton = this.add.rectangle(600, 15, 46, 18, 0x6f5452, 0.18)
            .setStrokeStyle(1, 0x6f5452)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => { SoundHelper.playVariant(this, 'hover_button', 0.4); pauseButton.setFillStyle(0x6f5452, 0.32); })
            .on('pointerout', () => pauseButton.setFillStyle(0x6f5452, 0.18))
            .on('pointerdown', () => { SoundHelper.playVariant(this, 'button_click', 0.5); this.pauseGame(); });
        
        this.add.text(600, 15, 'PAUSE', {
            fontSize: '9px',
            fill: '#6f5452',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);
        
        // Also add ESC key binding for pause
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        // Discard area
        this.discardArea = snapOriginToPixelGrid(this.add.image(601, 305, 'discardSprite'));
        this.add.text(601, 305, 'Discard', { fontSize: '12px', fill: '#d3beb2', fontFamily: '"HoMM Pixel"' }).setOrigin(0.5);
        // Rest button removed - players must manage action points carefully
        // Amulet UI
        // Player effects label
        this.add.text(45, 292, 'Effects', {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5, 0);
        this.playerEffectsUIGroup = this.add.group();
        // Next Floor Button (initially hidden) - top right, under pause
        this.nextFloorButton = snapOriginToPixelGrid(this.add.image(595, 50, 'nextTurnUp'))
            .setDepth(5000)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => { SoundHelper.playVariant(this, 'hover_button', 0.4); this.nextFloorButton.setTint(0xd4eaf7); })
            .on('pointerout', () => {
                this.nextFloorButton.clearTint();
                this.nextFloorButton.y = 50;
                if (this.nextFloorButtonText) this.nextFloorButtonText.y = 50;
            })
            .on('pointerdown', () => {
                SoundHelper.playVariant(this, 'button_click', 0.5);
                this.nextFloorButton.setTint(0x888888);
                this.nextFloorButton.y = 51;
                if (this.nextFloorButtonText) this.nextFloorButtonText.y = 51;
                this.floorCleared();
            })
            .on('pointerup', () => {
                this.nextFloorButton.clearTint();
                this.nextFloorButton.y = 50;
                if (this.nextFloorButtonText) this.nextFloorButtonText.y = 50;
            });
        this.nextFloorButtonText = this.add.text(595, 50, 'Next', {
            fontSize: '12px',
            fill: '#e5bca4',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5).setDepth(5001);
        this.nextFloorButton.setVisible(false);
        this.nextFloorButtonText.setVisible(false);

        // Running combat log on the right side.
        this.createCombatLog();
    },

    // A paper panel on the right that keeps a running, scrollable record of the
    // fight (damage, status effects, kills) so players can read back what the
    // fast-fading floating text already showed. Text uses the same muted brown
    // as the PAUSE label rather than the bright floating-text colors.
    createCombatLog() {
        // Narrow panel hugging the right edge (right edge fixed at ~639, so the
        // extra width grows leftward) that still clears the gaming board.
        const CX = 575, CY = 150, W = 128, H = 200;
        const BROWN = '#6f5452';
        this.combatLog = { lines: [], maxVisible: 12, scroll: 0, visible: false, objects: [] };
        this.combatLog.bounds = { left: CX - W / 2, right: CX + W / 2, top: CY - H / 2, bottom: CY + H / 2 };

        // Reuse the event paper art as a nine-slice panel (already preloaded).
        let panel = null;
        if (this.textures.exists('eventPaper9Slice')) {
            const addNineSlice = this.add.nineslice || this.add.nineSlice;
            if (addNineSlice) {
                try {
                    panel = addNineSlice.call(this.add, CX, CY, 'eventPaper9Slice', null, W, H, 32, 32, 32, 32);
                } catch { panel = null; }
            }
        }
        if (!panel) {
            // Fallback if the art/nine-slice helper is unavailable.
            panel = this.add.rectangle(CX, CY, W, H, 0xe8d6ad, 0.96).setStrokeStyle(2, 0x6f5452, 0.6);
        }
        panel.setDepth(40);

        const top = CY - H / 2;
        const title = this.add.text(CX, top + 8, 'Combat Log', {
            fontSize: '10px', fill: BROWN, fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5, 0).setDepth(42);
        const rule = this.add.rectangle(CX, top + 22, W - 18, 1, 0x6f5452, 0.4).setDepth(42);

        const bodyTop = top + 27;
        const body = this.add.text(CX - W / 2 + 7, bodyTop, '', {
            fontSize: '8px', fill: BROWN, fontFamily: '"HoMM Pixel"',
            lineSpacing: 2, wordWrap: { width: W - 14 }
        }).setOrigin(0, 0).setDepth(42);

        this.combatLog.panel = panel;
        this.combatLog.body = body;
        // Pixel height available for text before it would spill past the panel
        // bottom. Entries can wrap to 2+ lines, so we cap by height, not count.
        this.combatLog.bodyMaxHeight = (CY + H / 2 - 10) - bodyTop;

        // Scrollbar: shows there IS history above and where you are in it.
        // Hidden whenever everything already fits (see updateCombatLogScrollbar).
        const trackX = CX + W / 2 - 7;
        const track = this.add.rectangle(trackX, bodyTop, 3, this.combatLog.bodyMaxHeight, 0x6f5452, 0.18)
            .setOrigin(0.5, 0).setDepth(42);
        const thumb = this.add.rectangle(trackX, bodyTop, 3, 20, 0x6f5452, 0.7)
            .setOrigin(0.5, 0).setDepth(43);
        this.combatLog.track = track;
        this.combatLog.thumb = thumb;
        this.combatLog.trackX = trackX;
        this.combatLog.trackTop = bodyTop;
        this.combatLog.trackHeight = this.combatLog.bodyMaxHeight;
        this.combatLog.maxScroll = 0;

        this.combatLog.objects = [panel, title, rule, body, track, thumb];

        // Wheel over the panel scrolls back through the fight history. A
        // scene-level listener with a manual bounds check is far more reliable
        // than a per-object 'wheel' event (which frequently never fires).
        this.input.on('wheel', (pointer, over, dx, dy) => {
            if (!this.combatLogHasPointer(pointer)) return;
            // Wheel up (dy < 0) goes back in history; wheel down returns to newest.
            this.scrollCombatLog(dy > 0 ? -1 : 1);
        });

        // Drag the paper to scroll it — the only option on a trackpad or touch
        // screen, and a more obvious gesture than hunting for the wheel.
        this.input.on('pointerdown', (pointer) => {
            if (!this.combatLogHasPointer(pointer)) return;
            this.combatLog.drag = { y: pointer.y, from: this.combatLog.scroll };
        });
        this.input.on('pointermove', (pointer) => {
            const drag = this.combatLog?.drag;
            if (!drag || !pointer.isDown) return;
            // Pull down to reveal older lines, as if sliding the paper.
            const LINE_PX = 10;
            const moved = Math.round((pointer.y - drag.y) / LINE_PX);
            this.setCombatLogScroll(drag.from + moved);
        });
        this.input.on('pointerup', () => {
            if (this.combatLog) this.combatLog.drag = null;
        });

        this.setCombatLogVisible(false);
    },
    // True when the pointer is over the log panel and the log is on screen.
    combatLogHasPointer(pointer) {
        if (!this.combatLog?.visible) return false;
        const b = this.combatLog.bounds;
        return pointer.x >= b.left && pointer.x <= b.right
            && pointer.y >= b.top && pointer.y <= b.bottom;
    },

    // scroll counts lines hidden BELOW the view: 0 is pinned to the newest
    // entry, higher values walk back through the fight.
    setCombatLogScroll(value) {
        if (!this.combatLog) return;
        const max = this.combatLog.maxScroll || 0;
        const next = Phaser.Math.Clamp(Math.round(value), 0, max);
        if (next === this.combatLog.scroll) return;
        this.combatLog.scroll = next;
        this.renderCombatLog();
    },

    scrollCombatLog(delta) {
        this.setCombatLogScroll((this.combatLog?.scroll || 0) + delta);
    },

    renderCombatLog() {
        if (!this.combatLog?.body) return;
        const { lines, maxVisible, scroll, bodyMaxHeight } = this.combatLog;
        const body = this.combatLog.body;
        const end = Math.max(0, lines.length - scroll);
        let start = Math.max(0, end - maxVisible);
        body.setText(lines.slice(start, end).join('\n'));
        // Wrapped entries can push the text past the panel bottom — drop the
        // oldest visible lines until what's shown fits inside the paper.
        while (start < end - 1 && body.height > bodyMaxHeight) {
            start++;
            body.setText(lines.slice(start, end).join('\n'));
        }
        // How far back you can go is set by what actually fits, not by the line
        // count — otherwise scrolling runs on into blank paper.
        const shown = Math.max(1, end - start);
        this.combatLog.maxScroll = Math.max(0, lines.length - shown);
        this.updateCombatLogScrollbar(shown);
    },

    updateCombatLogScrollbar(shown) {
        const log = this.combatLog;
        if (!log?.track || !log.thumb) return;
        const total = log.lines.length;
        const overflows = total > shown;
        log.track.setVisible(log.visible && overflows);
        log.thumb.setVisible(log.visible && overflows);
        if (!overflows) return;

        const thumbH = Math.max(8, Math.round(log.trackHeight * (shown / total)));
        // scroll 0 (newest) parks the thumb at the bottom, like a chat window.
        const fromTop = log.maxScroll > 0 ? (log.maxScroll - log.scroll) / log.maxScroll : 1;
        log.thumb.setSize(3, thumbH);
        log.thumb.setPosition(log.trackX, log.trackTop + Math.round((log.trackHeight - thumbH) * fromTop));
    },

    // Push a fully-formed line into the log (no auto-attribution). Used for
    // explicitly-labelled entries like the player's own weapon hits.
    pushCombatLog(text) {
        if (!this.combatLog?.visible) return;
        const line = (text == null ? '' : String(text)).trim();
        if (!line) return;
        this.combatLog.lines.push(line);
        if (this.combatLog.lines.length > 200) this.combatLog.lines.shift();
        // Follow the newest entry only when already parked at the bottom. If the
        // player has scrolled back to read something, a fresh hit must not yank
        // the view out from under them — scroll counts from the end, so holding
        // position means stepping back one for the line just appended.
        if (this.combatLog.scroll > 0) this.combatLog.scroll += 1;
        this.renderCombatLog();
    },
    addCombatLog(message, x, y) {
        if (!this.combatLog?.visible) return;
        let text = (message == null ? '' : String(message)).trim();
        if (!text) return;
        // Attribute the event to whoever the floating text sits on.
        const label = (Number.isFinite(x) && Number.isFinite(y))
            ? this.combatLogLabel(x, y) : null;
        if (label) text = `${label} ${text}`;
        this.pushCombatLog(text);
    },
    // Record an event in the log at the moment it RESOLVES, for callers whose
    // floating text is deliberately delayed. The log is a transcript of the
    // fight in the order it actually happened; the timeline in CombatSequencer
    // only governs how that fight is narrated on screen.
    logCombatEvent(text, x, y) {
        this.addCombatLog(t(this, text), x, y);
    },
    clearCombatLog() {
        if (!this.combatLog) return;
        this.combatLog.lines = [];
        this.combatLog.scroll = 0;
        this.renderCombatLog();
    },
    setCombatLogVisible(v) {
        if (!this.combatLog) return;
        this.combatLog.visible = v;
        this.combatLog.objects.forEach(o => o?.setVisible?.(v));
        if (!v) this.combatLog.drag = null;
        // The blanket setVisible above would show the scrollbar even with
        // nothing to scroll — re-render so it re-decides.
        this.renderCombatLog();
    },
    refreshCombatLogVisibility() {
        this.setCombatLogVisible(['COMBAT', 'ELITE', 'BOSS'].includes(this.roomType));
    },

    // Works out who a floating-text event belongs to from its position: text on
    // the player avatar is "You", text on a revealed enemy card takes that
    // enemy's name. Returns null for centre-screen / global messages.
    combatLogLabel(x, y) {
        const pa = this.playerAvatar;
        if (pa) {
            const dx = pa.x - x, dy = pa.y - y;
            if (dx * dx + dy * dy <= 48 * 48) return 'You';
        }
        const cards = this.cardSystem?.boardCards || [];
        let best = null, bestD = 52 * 52;
        for (const c of cards) {
            if (!c?.sprite || !c.revealed || !c.data) continue;
            const dx = c.sprite.x - x, dy = c.sprite.y - y;
            const d = dx * dx + dy * dy;
            if (d < bestD) { bestD = d; best = c; }
        }
        return best?.data?.name || null;
    },
    updateUI() {
        // Force sync inventory EVERY time UI updates
        if (this.inventorySystem && this.inventorySystem.slots) {
            this.gameState.inventory = [...this.inventorySystem.slots];
        }
        
        this.healthText.setText(`${this.gameState.playerHealth}/${this.gameState.maxHealth}`);
        
        // Check for coin changes and play animation
        if (this.gameState.coins !== this.previousCoins) {
            this.previousCoins = this.gameState.coins;
            this.playCoinAnimation();
        }
        
        // Check for crystal changes and play animation
        if (this.gameState.crystals !== this.previousCrystals) {
            this.previousCrystals = this.gameState.crystals;
            this.playCrystalAnimation();
        }
        
        this.coinsText.setText(this.gameState.coins);
        this.crystalsText.setText(this.gameState.crystals);
        this.updateActionPointUI();
        this.updateCurrencyUILayout();
        const _act = Math.floor((this.gameState.currentFloor - 1) / 15) + 1;
        this.floorText.setText(`Act ${_act}  Floor: ${this.gameState.currentFloor}`);
        this.updateEquippedArmorPanel();
        
        // Update health orb
        const healthPercent = Math.max(0, this.gameState.playerHealth / this.gameState.maxHealth);
        const orbFrame = this.textures.getFrame('healthOrb', 0);
        const orbWidth = orbFrame?.width || 62;
        const orbHeight = orbFrame?.height || 54;
        const visibleHeight = Math.ceil(orbHeight * healthPercent);
        this.healthOrbFull.setCrop(0, orbHeight - visibleHeight, orbWidth, visibleHeight);
        this.updateAmuletsUI();
        this.updateRelicsUI();
        this.updatePlayerEffectsUI();
    },
    playCoinAnimation() {
        // Play the coin spin animation only (no scaling effects)
        this.coinSprite.play('coin_spin_anim');
    },
    playCrystalAnimation() {
        // Play the crystal glow animation only (no scaling or alpha effects)
        this.crystalSprite.play('crystal_glow_anim');
    },
    createActionPointUI() {
        this.actionPointSprites.forEach(sprite => sprite.destroy());
        this.actionPointOverlays.forEach(overlay => overlay.destroy());
        this.actionPointSprites = [];
        this.actionPointOverlays = [];

        const maxActions = Math.max(1, this.gameState?.maxActions || 1);
        const nodeCount = Math.ceil(maxActions / 4);
        // Stack into two rows once we have more than 5 nodes so the strip
        // doesn't run off the left edge of the screen on AP-heavy builds.
        const MAX_PER_ROW = 5;
        const rows = nodeCount > MAX_PER_ROW ? 2 : 1;
        const perRow = Math.ceil(nodeCount / rows);
        const spacing = 16; // = diamond width, so nodes butt together into one strip
        const rowGap = 18; // vertical gap between the two rows of nodes
        const centerX = 41;
        const baseY = 189;

        for (let i = 0; i < nodeCount; i++) {
            const row = Math.floor(i / perRow);
            const colInRow = i % perRow;
            const rowCount = (row === rows - 1) ? (nodeCount - row * perRow) : perRow;
            const startX = centerX - ((rowCount - 1) * spacing) / 2;
            const x = startX + colInRow * spacing;
            const y = baseY + row * rowGap;

            const sprite = this.add.image(x, y, 'actionPoint');
            sprite.setDepth(8);
            this.actionPointSprites.push(sprite);

            const overlay = this.add.graphics();
            overlay.setDepth(9);
            this.actionPointOverlays.push(overlay);
        }

        this.updateCurrencyUILayout();
    },
    updateCurrencyUILayout() {
        if (!this.coinSprite || !this.coinsText || !this.crystalSprite || !this.crystalsText) return;

        const maxActions = Math.max(1, this.gameState?.maxActions || 1);
        const nodeCount = Math.ceil(maxActions / 4);
        const hasExtraActionRow = nodeCount > 5;
        const yOffset = hasExtraActionRow ? 24 : 0;

        this.coinSprite.setPosition(26, 210 + yOffset);
        this.coinsText.setPosition(26, 227 + yOffset);
        this.crystalSprite.setPosition(54, 211 + yOffset);
        this.crystalsText.setPosition(54, 228 + yOffset);
    },
    updateActionPointUI() {
        const maxActions = Math.max(1, this.gameState.maxActions || 1);
        const actionsLeft = Phaser.Math.Clamp(this.gameState.actionsLeft || 0, 0, maxActions);
        const nodeCount = Math.ceil(maxActions / 4);

        if (this.actionPointSprites.length !== nodeCount) {
            this.createActionPointUI();
        }

        this.actionPointOverlays.forEach((overlay, nodeIndex) => {
            const sprite = this.actionPointSprites[nodeIndex];
            if (!overlay || !sprite) return;

            overlay.clear();
            overlay.fillStyle(0x000000, 0.62);

            for (let section = 0; section < 4; section++) {
                const actionIndex = nodeIndex * 4 + section;
                const unavailable = actionIndex >= maxActions || actionIndex >= actionsLeft;
                if (unavailable) {
                    this.drawActionPointSection(overlay, sprite.x, sprite.y, section);
                }
            }
        });
    },
    drawActionPointSection(graphics, x, y, section) {
        const half = 8;
        const pointsBySection = [
            [{ x, y }, { x, y: y - half }, { x: x + half, y }],
            [{ x, y }, { x: x + half, y }, { x, y: y + half }],
            [{ x, y }, { x, y: y + half }, { x: x - half, y }],
            [{ x, y }, { x: x - half, y }, { x, y: y - half }]
        ];
        graphics.fillPoints(pointsBySection[section], true);
    },
    updateEquippedArmorPanel() {
        if (this.armorTooltip) {
            this.armorTooltip.destroy();
            this.armorTooltip = null;
        }
        if (this.armorPanelEquippedSprite) {
            this.armorPanelEquippedSprite.destroy();
            this.armorPanelEquippedSprite = null;
        }
        if (this.armorPanelBriarFrame) {
            this.armorPanelBriarFrame.destroy();
            this.armorPanelBriarFrame = null;
        }
        if (this.armorPanelInfoText) {
            if (this.armorPanelInfoText.list) {
                this.armorPanelInfoText.destroy(true);
            } else {
                this.armorPanelInfoText.destroy();
            }
            this.armorPanelInfoText = null;
        }

        const armor = this.gameState.equippedArmor;
        if (!armor || !armor.sprite || !this.armorPanel) return;

        this.armorPanelEquippedSprite = snapOriginToPixelGrid(this.add.image(this.armorPanel.x, this.armorPanel.y - 6, armor.sprite));
        this.armorPanelEquippedSprite.setDepth(6);
        this.armorPanelEquippedSprite.setInteractive({ useHandCursor: true });
        if ((armor.briarDamageBonus || 0) > 0 && this.textures.exists('thornFrame')) {
            this.armorPanelBriarFrame = snapOriginToPixelGrid(
                this.add.image(this.armorPanelEquippedSprite.x, this.armorPanelEquippedSprite.y, 'thornFrame')
            );
            this.armorPanelBriarFrame
                .setDisplaySize(
                    this.armorPanelEquippedSprite.displayWidth || 54,
                    this.armorPanelEquippedSprite.displayHeight || 70
                )
                .setDepth(6.5);
        }
        this.armorPanelEquippedSprite.on('pointerdown', () => {
            this.inventorySystem?.unequipArmor?.();
        });
        this.armorPanelEquippedSprite.on('pointerover', () => {
            this.showArmorTooltip(armor);
        });
        this.armorPanelEquippedSprite.on('pointerout', () => {
            if (this.armorTooltip) {
                this.armorTooltip.destroy();
                this.armorTooltip = null;
            }
        });

        const armorCard = {
            sprite: this.armorPanelEquippedSprite,
            data: armor,
            infoText: null
        };
        this.cardSystem.createCardInfoText(armorCard);
        if (armorCard.infoText) {
            armorCard.infoText.setDepth(7);
            this.armorPanelInfoText = armorCard.infoText;
            this.armorPanelEquippedSprite.setData('infoText', armorCard.infoText);
        }
    },
    updateAmuletsUI() {
        this.amuletUIGroup.clear(true, true);
        if (this.amuletTooltip) {
            this.amuletTooltip.destroy();
            this.amuletTooltip = null;
        }

        const amulets = this.gameState.activeAmulets;
        const MAX_VISIBLE = 10;
        // Atlas icons are 32px frames with transparent padding around the art.
        // A 29px step overlaps frames by 3px without crowding the visible item.
        const SPACING = 29;
        const ROW_X = 125;
        const ROW_Y = 42;

        // Keep the offset in bounds (e.g. if amulets were removed since last scroll)
        const maxOffset = Math.max(0, amulets.length - MAX_VISIBLE);
        this.amuletScrollOffset = Phaser.Math.Clamp(this.amuletScrollOffset || 0, 0, maxOffset);

        const needsScroll = amulets.length > MAX_VISIBLE;

        // ── Left arrow ──────────────────────────────────────────────────────────
        if (needsScroll) {
            const leftArrow = this.add.text(ROW_X - 16, ROW_Y, '◄', {
                fontSize: '11px',
                fill: this.amuletScrollOffset > 0 ? '#ffd700' : '#554433',
                fontFamily: '"HoMM Pixel"'
            }).setOrigin(0.5).setDepth(22);
            if (this.amuletScrollOffset > 0) {
                leftArrow.setInteractive({ useHandCursor: true });
                leftArrow.on('pointerdown', () => {
                    this.amuletScrollOffset = Math.max(0, this.amuletScrollOffset - 1);
                    this.updateAmuletsUI();
                });
            }
            this.amuletUIGroup.add(leftArrow);
        }

        // ── Visible amulets ─────────────────────────────────────────────────────
        const visibleAmulets = amulets.slice(this.amuletScrollOffset, this.amuletScrollOffset + MAX_VISIBLE);
        visibleAmulets.forEach((amulet, i) => {
            const x = ROW_X + i * SPACING;
            const y = ROW_Y;

            // Always resolve sprite from the live definition
            const def = this.amuletManager?.amuletDefinitions?.[amulet.id];
            const spriteKey   = def?.sprite       ?? amulet.sprite       ?? 'relicsOthers';
            const spriteFrame = def?.spriteFrame  ?? amulet.spriteFrame  ?? 0;

            const amuletSprite = this.add.image(x, y, spriteKey, spriteFrame).setInteractive();
            amuletSprite.setDepth(22);
            this.amuletUIGroup.add(amuletSprite);

            // Level badge for stackable amulets
            if (amulet.level && amulet.level > 1) {
                const levelText = this.add.text(x + 8, y + 8, amulet.level.toString(), {
                    fontSize: '10px',
                    fill: '#ffffff',
                    fontFamily: '"HoMM Pixel"'
                }).setOrigin(0.5).setDepth(23);
                this.amuletUIGroup.add(levelText);
            }

            amuletSprite.on('pointerover', () => {
                this.showAmuletTooltip(amulet, amuletSprite.x + 20, amuletSprite.y);
            });
            amuletSprite.on('pointerout', () => {
                if (this.amuletTooltip) {
                    this.amuletTooltip.destroy();
                    this.amuletTooltip = null;
                }
            });
        });

        // ── Right arrow ─────────────────────────────────────────────────────────
        if (needsScroll) {
            const rightArrow = this.add.text(ROW_X + MAX_VISIBLE * SPACING, ROW_Y, '►', {
                fontSize: '11px',
                fill: this.amuletScrollOffset < maxOffset ? '#ffd700' : '#554433',
                fontFamily: '"HoMM Pixel"'
            }).setOrigin(0.5).setDepth(22);
            if (this.amuletScrollOffset < maxOffset) {
                rightArrow.setInteractive({ useHandCursor: true });
                rightArrow.on('pointerdown', () => {
                    this.amuletScrollOffset = Math.min(maxOffset, this.amuletScrollOffset + 1);
                    this.updateAmuletsUI();
                });
            }
            this.amuletUIGroup.add(rightArrow);

            // Small counter so the player knows how many are hidden: e.g. "3/14"
            const countText = this.add.text(
                ROW_X + MAX_VISIBLE * SPACING,
                ROW_Y + 12,
                `${this.amuletScrollOffset + 1}-${Math.min(this.amuletScrollOffset + MAX_VISIBLE, amulets.length)}/${amulets.length}`,
                { fontSize: '8px', fill: '#aaaaaa', fontFamily: '"HoMM Pixel"' }
            ).setOrigin(0.5).setDepth(22);
            this.amuletUIGroup.add(countText);
        }
    },
    updateRelicsUI() {
        this.relicUIGroup.clear(true, true);
        if (this.relicTooltip) {
            this.relicTooltip.destroy();
            this.relicTooltip = null;
        }

        const relics = this.metaManager?.getUnlockedRelics?.() || [];
        // Relic silhouettes are a little narrower inside the same atlas frame
        // so use a 5px overlap to make their visible spacing match the amulets.
        const RELIC_SPACING = 27;
        const RELIC_Y = 13;       // transparent frame edge may safely sit above y=0
        relics.forEach((relic, i) => {
            const x = 125 + i * RELIC_SPACING;
            const y = RELIC_Y;
            const usesSheet = relic.iconSheet && this.textures.exists(relic.iconSheet);
            const iconKey = usesSheet ? relic.iconSheet : this.textures.exists(relic.icon) ? relic.icon : 'amulet';
            const iconFrame = usesSheet ? relic.iconFrame : undefined;
            const relicSprite = this.add.image(x, y, iconKey, iconFrame).setInteractive();
            relicSprite.setDepth(20);
            this.relicUIGroup.add(relicSprite);

            relicSprite.on('pointerover', () => {
                this.showRelicTooltip(relic, relicSprite.x + 20, relicSprite.y);
            });
            relicSprite.on('pointerout', () => {
                if (this.relicTooltip) {
                    this.relicTooltip.destroy();
                    this.relicTooltip = null;
                }
            });

            // Progress pips for relics with a "per-N-cards" counter (e.g. Explorer Cape)
            const perCards = relic.effect?.discardCritPerCards;
            if (perCards && perCards > 0) {
                const discarded = this.gameState.discardedCardsThisRun || 0;
                const max = relic.effect.maxDiscardCritChance ?? 1;
                const step = relic.effect.discardCritPerStep || 0;
                const atMax = step > 0 && (this.gameState.discardCritChance || 0) >= max;
                const progress = atMax ? perCards : (discarded % perCards);

                const pipSize = 2;
                const pipSpacing = 3;
                const totalWidth = (perCards - 1) * pipSpacing;
                const pipY = y + 11;
                for (let p = 0; p < perCards; p++) {
                    const pipX = x - totalWidth / 2 + p * pipSpacing;
                    const filled = p < progress;
                    const color = atMax ? 0xffd700 : (filled ? 0xffd700 : 0x554433);
                    const pip = this.add.rectangle(pipX, pipY, pipSize, pipSize, color);
                    pip.setDepth(21);
                    this.relicUIGroup.add(pip);
                }
            }
        });
    },
    showRelicTooltip(relic, x, y) {
        if (this.relicTooltip) {
            this.relicTooltip.destroy();
        }

        const description = `${translateItemName(this, relic)}\n${translateDescription(this, relic.description)}`;
        const tooltipText = this.add.text(6, 6, description, {
            fontSize: '10px',
            fill: relic.cursed ? '#ff9999' : '#ffd700',
            fontFamily: '"HoMM Pixel", Arial, sans-serif',
            align: 'left',
            wordWrap: { width: 190 }
        }).setOrigin(0);

        const width = Math.ceil(Math.min(220, Math.max(120, tooltipText.width + 12)));
        const height = Math.ceil(tooltipText.height + 12);
        const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.9)
            .setOrigin(0)
            .setStrokeStyle(1, relic.cursed ? 0xff6666 : 0xffd700);

        const clampedX = Phaser.Math.Clamp(Math.round(x), 4, 640 - width - 4);
        const clampedY = Phaser.Math.Clamp(Math.round(y), 4, 360 - height - 4);

        this.relicTooltip = this.add.container(clampedX, clampedY, [bg, tooltipText]);
        this.relicTooltip.setDepth(1000);
    },
    showArmorTooltip(armor) {
        if (this.armorTooltip) {
            this.armorTooltip.destroy();
            this.armorTooltip = null;
        }
        let lines = `${translateItemName(this, armor)}\n${t(this, 'tooltip.protectionShort', { amount: armor.protection })}`;
        if (armor.dodgeChance) {
            lines += `\n${t(this, 'tooltip.dodge', { percent: Math.round(armor.dodgeChance * 100) })}`;
        }
        if (armor.meleeCounterChance) {
            lines += `\nMelee counter: ${Math.round(armor.meleeCounterChance * 100)}%`;
        }
        if (armor.rangedIgnoreChance) {
            lines += `\nIgnore ranged: ${Math.round(armor.rangedIgnoreChance * 100)}%`;
        }
        if (armor.reflection) {
            lines += `\n${t(this, 'tooltip.reflect', { value: `${armor.reflection}%` })}`;
        }
        lines += `\n${t(this, 'tooltip.pips', { value: `${armor.durability}/${armor.maxDurability}` })}`;

        const tooltipX = Math.round(this.armorPanel.x + 50);
        const tooltipY = Math.round(this.armorPanel.y - 20);
        const tooltipText = this.add.text(0, 0, lines, {
            fontSize: '10px',
            fill: '#66aaff',
            fontFamily: '"HoMM Pixel", Arial, sans-serif',
            align: 'center',
            lineSpacing: 2
        }).setOrigin(0, 0);
        // Auto-size the background to fit however many lines we have
        const lineCount = lines.split('\n').length;
        const width = Math.max(120, Math.ceil(tooltipText.width) + 10);
        const height = lineCount * 13 + 10;
        const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.85)
            .setOrigin(0, 0)
            .setStrokeStyle(1, 0x66aaff);
        tooltipText.setPosition(
            Math.round((width - Math.ceil(tooltipText.width)) / 2),
            5
        );

        this.armorTooltip = this.add.container(tooltipX, tooltipY, [bg, tooltipText]);
        this.armorTooltip.setDepth(1000);
    },
    updatePlayerEffectsUI() {
        this.playerEffectsUIGroup.clear(true, true);

        // Build a unified list of effects to display (debuffs + buffs + relic counters)
        const entries = [];

        // --- Debuffs / status effects from playerEffects array ---
        this.gameState.playerEffects.forEach((effect) => {
            switch (effect.type) {
                case 'poison':
                    entries.push({ text: `Poison ${effect.turns}`, color: '#66ff66' });
                    break;
                case 'burn':
                    entries.push({ text: `Burn (${effect.turns} turns)`, color: '#ff7040' });
                    break;
                case 'stun':
                    entries.push({ text: `Stunned (${effect.turns} turns)`, color: '#ffd700' });
                    break;
                case 'weakness':
                    entries.push({ text: `Weakened (${effect.turns} turns)`, color: '#aa66ff' });
                    break;
                default:
                    entries.push({
                        text: effect.turns != null
                            ? `${this.capitalizeEffect(effect.type)} (${effect.turns} turns)`
                            : this.capitalizeEffect(effect.type),
                        color: '#cccccc'
                    });
            }
        });

        // --- Buffs from magic spells ---
        const gs = this.gameState;
        if (gs.shadowBlade && gs.shadowBlade.turns > 0) {
            const mult = gs.shadowBlade.multiplier ? `+${Math.round((gs.shadowBlade.multiplier - 1) * 100)}% DMG` : '';
            entries.push({ text: `Shadow Blade ${mult} (${gs.shadowBlade.turns} turns)`, color: '#b266ff' });
        }
        if (gs.magicShield && gs.magicShield.turns > 0) {
            const mult = gs.magicShield.multiplier ? `+${Math.round((gs.magicShield.multiplier - 1) * 100)}% DEF` : '';
            entries.push({ text: `Magic Shield ${mult} (${gs.magicShield.turns} turns)`, color: '#33aaff' });
        }
        if (gs.boneWall && gs.boneWall > 0) {
            entries.push({ text: `Bone Wall (${gs.boneWall} ${gs.boneWall === 1 ? 'charge' : 'charges'})`, color: '#ffffff' });
        }
        if (gs.mirrorShield) {
            entries.push({ text: 'Mirror Shield', color: '#c0c0c0' });
        }
        if (gs.blockNextAttack) {
            entries.push({ text: 'Block Next Attack', color: '#88ccff' });
        }

        // --- Relic-driven counters ---
        if ((gs.discardCritChance || 0) > 0) {
            const percent = Math.round(gs.discardCritChance * 100);
            entries.push({ text: `Discard Crit +${percent}%`, color: '#ffd700' });
        } else {
            // Show progress toward first crit step if the relic is equipped but not yet earned
            const relic = gs.relicEffects || {};
            if (relic.discardCritPerCards && relic.discardCritPerStep) {
                const discarded = gs.discardedCardsThisRun || 0;
                const next = relic.discardCritPerCards - (discarded % relic.discardCritPerCards);
                if (discarded > 0 || relic.discardCritPerCards <= 10) {
                    entries.push({
                        text: `Discard Crit (${next} to +${Math.round(relic.discardCritPerStep * 100)}%)`,
                        color: '#ddaa66'
                    });
                }
            }
        }

        entries.forEach((entry, i) => {
            const y = 312 + i * 15;
            const text = this.add.text(10, y, entry.text, {
                fontSize: '12px',
                fill: entry.color,
                fontFamily: '"HoMM Pixel"'
            });
            this.playerEffectsUIGroup.add(text);
        });

        this.updatePlayerPoisonMarker();
    },

    // Animated poison icon pinned to the top-right corner of the hero portrait.
    // Runs continuously while the player has any poison effect, removed once it wears off.
    updatePlayerPoisonMarker() {
        const poisoned = this.gameState.playerEffects?.some(e => e.type === 'poison');

        if (poisoned) {
            if (!this.playerPoisonMarker && this.playerAvatar && this.textures.exists('poisonedStatus')) {
                const halfW = (this.playerAvatar.displayWidth || 0) / 2;
                const halfH = (this.playerAvatar.displayHeight || 0) / 2;
                const marker = this.add.sprite(
                    Math.round(this.playerAvatar.x + halfW - 2),
                    Math.round(this.playerAvatar.y - halfH + 2),
                    'poisonedStatus'
                );
                marker.setOrigin(1, 0);
                marker.setDepth(40);
                if (this.anims.exists('poison_status_anim')) marker.play('poison_status_anim');
                this.playerPoisonMarker = marker;
            }
        } else if (this.playerPoisonMarker) {
            this.playerPoisonMarker.destroy();
            this.playerPoisonMarker = null;
        }
    },
    capitalizeEffect(value) {
        const text = (value || '').toString();
        return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
    },
    showAmuletTooltip(amulet, x, y) {
        if (this.amuletTooltip) {
            this.amuletTooltip.destroy();
        }
        
        // Get amulet definition for better description
        const definition = this.amuletManager ? 
            this.amuletManager.amuletDefinitions[amulet.id] : null;
        
        let description = translateItemName(this, amulet);
        
        if (definition) {
            description += `\n${translateDescription(this, definition.description)}`;
            
            // Add level info for stackable amulets
            if (amulet.level && amulet.level > 1) {
                description += ` (${t(this, 'tooltip.level', { level: amulet.level })})`;
            }
            
            // Add cursed indicator
            if (definition.cursed) {
                description = `${t(this, 'tooltip.cursed')} ${description}`;
            }
        }
        
        const tooltipText = this.add.text(0, 0, description, {
            fontSize: '11px',
            fill: definition && definition.cursed ? '#ff6666' : '#ffffff',
            fontFamily: '"HoMM Pixel", Arial, sans-serif',
            backgroundColor: '#000000',
            padding: { x: 5, y: 3 },
            wordWrap: { width: 200 }
        }).setOrigin(0, 0.5);
        
        const tooltipBg = this.add.rectangle(0, 0, tooltipText.width, tooltipText.height, 0x000000, 0.7)
            .setStrokeStyle(1, definition && definition.cursed ? 0xff6666 : 0xffffff)
            .setOrigin(0, 0.5);
        
        this.amuletTooltip = this.add.container(x, y, [tooltipBg, tooltipText]);
        this.amuletTooltip.setDepth(100);
    },
};

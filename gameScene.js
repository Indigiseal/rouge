import { CardSystem } from './cardSystem.js';
import { InventorySystem } from './inventorySystem.js';
import { GameState } from './gameState.js';
import { AmuletManager } from './AmuletManager.js';
import { MusicManager } from './utils/MusicManager.js';
import { SoundHelper } from './utils/SoundHelper.js';
import { SaveManager } from './SaveManager.js';
import { MetaProgressionManager } from './MetaProgressionManager.js';
import { TutorialManager } from './TutorialManager.js';
import { snapOriginToPixelGrid } from './utils/PixelSnap.js';
import { t, translateDescription, translateItemName } from './utils/i18n.js';
import { loadHeroMemory, loadStoryProgress, saveHeroMemory } from './utils/StoryProgress.js';
import { loadVolumeSettings, saveVolumeSettings } from './utils/VolumeSettings.js';

export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this._transitioning = false;
        this.skipNextEnemyAttack = false;
        this._turnHandlersBound = false;
        this.enemyTurnTimers = [];
        this.enemyTurnQueued = false;
        this.pendingEnemyTurns = 0;
        this.stalemateEnemyTurnQueued = false;
    }

    init(data = {}) {
        this.saveManager = new SaveManager();
        this.metaManager = new MetaProgressionManager(this);
        // Phaser reuses the same Scene instance after Quit -> Main Menu -> New
        // Run. Never let run-local flags from the previous instance leak into
        // the next one (notably shouldLoadSave, which could restore an old floor).
        this.shouldLoadSave = Boolean(data.loadSave);
        // Guided tutorial: a self-contained rigged floor launched from the menu.
        // It never loads/saves and skips relic/story seeding so the lesson board
        // is identical every time.
        this.tutorialMode = Boolean(data.tutorial);
        if (this.tutorialMode) this.shouldLoadSave = false;
        this._transitioning = false;
        this._resultScreenShown = false;
        this._gameOverInProgress = false;
        // Reset per-scene-entry so a cleared-room restore flag can't leak into
        // the next run (Phaser reuses the GameScene instance across runs).
        this._floorEndAlreadyProcessed = false;
        this.events.off('endPlayerTurn');
        this.events.off('wake', this.wake, this);
        this._turnHandlersBound = false;
        
        if (this.shouldLoadSave) {
            // Load existing run
            this.gameState = new GameState(this);
            // Load will happen in create() after systems are initialized
            this.shouldLoadSave = true;
        } else {
            // New run
            this.gameState = new GameState(this);
            // Apply relic effects to fresh game state (skip for the tutorial so
            // its rigged board is deterministic).
            if (!this.tutorialMode) this.metaManager.applyRelicEffects(this.gameState);
            // Cross-run story memory: seed the fresh run from any saved story
            // progress so completed events don't repeat and story chains resume
            // where a past life left off. (Continues restore storyRun from the
            // run save instead, so we only seed brand-new runs.)
            const storedStory = loadStoryProgress();
            if (storedStory) {
                Object.assign(this.gameState.storyRun, storedStory);
                // birdAngry / angryNestmotherRollFloor are per-run combat
                // consequences (the angry nestmother spawns in elite rooms and
                // is cleared on kill in combat, which doesn't re-save story
                // progress). Don't let them carry across deaths, or the bird
                // would haunt every future run forever.
                this.gameState.storyRun.birdAngry = false;
                this.gameState.storyRun.angryNestmotherRollFloor = null;
                // The copying-mirror and the too-nice room are once-per-run bonus
                // encounters, not once-ever story beats — let each new run meet
                // them again.
                this.gameState.storyRun.mirrorSeen = false;
                this.gameState.storyRun.tooNiceRoomSeen = false;
                this.gameState.storyRun.wellSeen = false;
                this.gameState.storyRun.bookWormSeen = false;
                this.gameState.storyRun.briarRoomSeen = false;
                this.gameState.storyRun.slimyPrisonSeen = false;
            }
        }

        const storedHeroMemory = loadHeroMemory();
        if (storedHeroMemory) {
            Object.keys(this.gameState.heroMemory).forEach(key => {
                this.gameState.heroMemory[key] = Boolean(
                    this.gameState.heroMemory[key] || storedHeroMemory[key]
                );
            });
        }

        // Repair profiles created before the death check accepted the durable
        // hatch flag. The hatch event is persisted across runs, so it is enough
        // evidence to restore the shop unlock that should have been recorded.
        if (this.gameState.storyRun?.chickHatched
            && !this.gameState.heroMemory.chickRareShopUnlocked) {
            this.gameState.heroMemory.chickRareShopUnlocked = true;
            saveHeroMemory(this.gameState.heroMemory);
        }
        if (this.gameState.storyRun?.skeletonCompanionObtained
            && !this.gameState.heroMemory.skeletonRareShopUnlocked) {
            this.gameState.heroMemory.skeletonRareShopUnlocked = true;
            saveHeroMemory(this.gameState.heroMemory);
        }
        
        this.skipNextEnemyAttack = false;
        this.killedBy = null;
        this.roomType = data.roomType || 'COMBAT';
        this.clearEnemyTurnTimers();
    }
    
    create() {
        this.events.once('shutdown', this.shutdown, this);
        // Load saved volume settings. Master volume is kept internally at 1;
        // players adjust Music and Sound Effects directly.
        this.game.globalVolume = loadVolumeSettings();
        saveVolumeSettings(this.game.globalVolume);
        
        // Apply volume settings
        this.sound.volume = this.game.globalVolume.master;
        
        // Create tiled stone background
        this.createBackground();
        
        // Create animations
        this.createAnimations();
        
        // Initialize AmuletManager FIRST
        this.amuletManager = new AmuletManager(this);
        
        // Initialize systems
        this.cardSystem = new CardSystem(this);
        this.inventorySystem = new InventorySystem(this, this.gameState.inventory);
        
        // After this.inventorySystem = new InventorySystem(...)
        this.inventorySystem.slots = this.gameState.inventory || new Array(5).fill(null); // Load from state if exists
        this.gameState.inventory = this.inventorySystem.slots; // Sync back
        
        this.inventorySystem.setVisibility(true); // Ensure shown on start
        
        // Load saved run if continuing
        if (this.shouldLoadSave) {
            this.loadCurrentRun();
        }
        
        // Create UI
        this.createUI();
        
        // Room title
        this.roomTitle = null;

        // Restored combat rooms bypass startNewFloor(), so bind turn handling
        // before choosing between a fresh board and a saved one.
        this.bindEnemyTurnHandler();
        this.inventorySystem.setDiscardArea(this.discardArea);
        this.inventorySystem.setArmorPanel(this.armorPanel);

        // Decide where a loaded run resumes — the authoritative "where did the
        // player leave from" call, made purely from the save so it holds no
        // matter when the last save was written (floor-clear autosave, shop,
        // rest, elite chest, tab close, etc.).
        //
        // We only drop the player straight back INTO a room for two cases:
        //   - a genuine in-progress fight (combat/elite/boss, not yet cleared), or
        //   - an unclaimed boss-reward room.
        // Everything else resumes on the MAP, which owns the next-room choice:
        //   - a CLEARED combat room (its remaining cards are just uncollected
        //     loot, forfeited on leaving anyway) — restoring it would strand the
        //     player back in a fight they already won (the reported Continue bug), and
        //   - a save taken inside a shop/rest/anvil/event/treasure (roomType like
        //     'SHOP'/'REST'/…), e.g. after quitting from there.
        if (this.shouldLoadSave) {
            const rt = this.gameState.roomType;
            const inProgressCombat =
                ['COMBAT', 'ELITE', 'BOSS'].includes(rt) && !this._loadedEnemiesCleared;
            if (rt !== 'MAP' && rt !== 'BOSS_REWARD' && !inProgressCombat) {
                this.gameState.roomType = 'MAP';
                this.roomType = 'MAP';
            }
        }

        // Continue from the map before restoring a combat board. The map owns
        // the next-room choice, while the saved cursor keeps its exact position.
        this.events.on('wake', this.wake, this);
        if (this.shouldLoadSave && this.gameState.roomType === 'MAP') {
            this.scene.sleep();
            this.scene.launch('MapViewScene', { gameState: this.gameState });
            return;
        }
        
        // Start or restore the room. Boss rewards are already paid before the
        // player can pause; rebuilding them via setupBossRewardRoom() would pay
        // the currency twice, so restore only the still-unclaimed saved cards.
        if (this.shouldLoadSave && this.gameState.roomType === 'BOSS_REWARD') {
            this.restoreSavedBossRewardRoom();
        } else if (this.shouldLoadSave && this._loadedBoardAvailable) {
            this.restoreSavedCombatRoom();
        } else {
            this.startNewFloor();
        }
        
        // Update room title after loading
        this.updateRoomTitle();
        
        // Guided tutorial overlay drives the rigged board created above.
        if (this.tutorialMode) {
            this.tutorialManager = new TutorialManager(this);
            this.tutorialManager.start();
        }
    }

    update() {
        this.tutorialManager?.tick?.();
    }

    createAnimations() {
        // Create hover card animation
        if (!this.anims.exists('hover_cards_anim')) this.anims.create({
            key: 'hover_cards_anim',
            frames: this.anims.generateFrameNumbers('hoverCardsUpSheet', { start: 0, end: 4 }),
            frameRate: 12,
            repeat: 0
        });

        // Card disappear dissolve — played on top of a card as it is removed
        // (enemy defeated, weapon pips spent). 6 frames, plays once.
        if (this.textures.exists('cardDisappearSheet') && !this.anims.exists('card_disappear_anim')) this.anims.create({
            key: 'card_disappear_anim',
            frames: this.anims.generateFrameNumbers('cardDisappearSheet', { start: 0, end: 5 }),
            frameRate: 22,
            repeat: 0
        });

        // Card merge flicker — played on top of the merged card. 2 frames, looped
        // once so the flicker plays twice (repeat: 1). Legendary merges use a
        // separate, flashier sheet.
        if (this.textures.exists('mergeSheet') && !this.anims.exists('merge_anim')) this.anims.create({
            key: 'merge_anim',
            frames: this.anims.generateFrameNumbers('mergeSheet', { start: 0, end: 1 }),
            frameRate: 18,
            repeat: 1
        });
        if (this.textures.exists('mergeLegendarySheet') && !this.anims.exists('merge_legendary_anim')) this.anims.create({
            key: 'merge_legendary_anim',
            frames: this.anims.generateFrameNumbers('mergeLegendarySheet', { start: 0, end: 1 }),
            frameRate: 18,
            repeat: 1
        });
        
        // Create coin animation. Now sourced from the coinAnimSheet spritesheet
        // (frame 0 = old coinAnimation1 ... frame 5 = coinAnimation6). Sequence
        // preserved: the old anim used coinAnimation2-6 = sheet frames 1-5.
        if (!this.anims.exists('coin_spin_anim')) this.anims.create({
            key: 'coin_spin_anim',
            frames: this.anims.generateFrameNumbers('coinAnimSheet', { start: 1, end: 5 }),
            frameRate: 10,
            repeat: 0
        });

        // Create crystal animation. From crystalAnimSheet (frame 0 = old
        // crystalAnimation1). Old sequence was crystalAnimation2,3,4,5,1 —
        // i.e. sheet frames 1,2,3,4,0 (loops back to the rest frame) — preserved.
        if (!this.anims.exists('crystal_glow_anim')) this.anims.create({
            key: 'crystal_glow_anim',
            frames: [
                { key: 'crystalAnimSheet', frame: 1 },
                { key: 'crystalAnimSheet', frame: 2 },
                { key: 'crystalAnimSheet', frame: 3 },
                { key: 'crystalAnimSheet', frame: 4 },
                { key: 'crystalAnimSheet', frame: 0 }
            ],
            frameRate: 8,
            repeat: 0
        });
    }

    createBackground() {
        // Use the single dungeon background image
        const background = this.add.image(320, 180, 'stoneFloor');
        background.setDisplaySize(640, 360);
        background.setOrigin(0.5, 0.5);
    }

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
            .on('pointerover', () => pauseButton.setFillStyle(0x6f5452, 0.32))
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
            .on('pointerover', () => this.nextFloorButton.setTint(0xd4eaf7))
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
    }

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
        this.combatLog.objects = [panel, title, rule, body];

        // Wheel over the panel scrolls back through the fight history. A
        // scene-level listener with a manual bounds check is far more reliable
        // than a per-object 'wheel' event (which frequently never fires).
        this.input.on('wheel', (pointer, over, dx, dy) => {
            if (!this.combatLog?.visible) return;
            const b = this.combatLog.bounds;
            if (pointer.x < b.left || pointer.x > b.right
                || pointer.y < b.top || pointer.y > b.bottom) return;
            const maxScroll = Math.max(0, this.combatLog.lines.length - 1);
            // Wheel up (dy < 0) goes back in history; wheel down returns to newest.
            this.combatLog.scroll = Phaser.Math.Clamp(
                this.combatLog.scroll + (dy > 0 ? -1 : 1), 0, maxScroll
            );
            this.renderCombatLog();
        });

        this.setCombatLogVisible(false);
    }

    renderCombatLog() {
        if (!this.combatLog?.body) return;
        const { lines, maxVisible, scroll, bodyMaxHeight } = this.combatLog;
        const body = this.combatLog.body;
        const end = lines.length - scroll;
        let start = Math.max(0, end - maxVisible);
        body.setText(lines.slice(start, end).join('\n'));
        // Wrapped entries can push the text past the panel bottom — drop the
        // oldest visible lines until what's shown fits inside the paper.
        while (start < end - 1 && body.height > bodyMaxHeight) {
            start++;
            body.setText(lines.slice(start, end).join('\n'));
        }
    }

    // Push a fully-formed line into the log (no auto-attribution). Used for
    // explicitly-labelled entries like the player's own weapon hits.
    pushCombatLog(text) {
        if (!this.combatLog?.visible) return;
        const line = (text == null ? '' : String(text)).trim();
        if (!line) return;
        this.combatLog.lines.push(line);
        if (this.combatLog.lines.length > 200) this.combatLog.lines.shift();
        this.combatLog.scroll = 0; // pin to newest on a fresh event
        this.renderCombatLog();
    }

    addCombatLog(message, x, y) {
        if (!this.combatLog?.visible) return;
        let text = (message == null ? '' : String(message)).trim();
        if (!text) return;
        // Attribute the event to whoever the floating text sits on.
        const label = (Number.isFinite(x) && Number.isFinite(y))
            ? this.combatLogLabel(x, y) : null;
        if (label) text = `${label} ${text}`;
        this.pushCombatLog(text);
    }

    clearCombatLog() {
        if (!this.combatLog) return;
        this.combatLog.lines = [];
        this.combatLog.scroll = 0;
        this.renderCombatLog();
    }

    setCombatLogVisible(v) {
        if (!this.combatLog) return;
        this.combatLog.visible = v;
        this.combatLog.objects.forEach(o => o?.setVisible?.(v));
    }

    refreshCombatLogVisibility() {
        this.setCombatLogVisible(['COMBAT', 'ELITE', 'BOSS'].includes(this.roomType));
    }

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
    }

    startNewFloor() {
        this.clearEnemyTurnTimers();
        this.clearFloatingTexts();
        this._floorEndAlreadyProcessed = false;
        this._transitioning = false;
        this.enemiesCleared = false;
        if (this.nextFloorButton) {
            this.nextFloorButton.setVisible(false);
            this.nextFloorButtonText?.setVisible(false);
            this.nextFloorButton.setInteractive();
            this.nextFloorButton.y = 50;
            if (this.nextFloorButtonText) this.nextFloorButtonText.y = 50;
            this.nextFloorButton.clearTint();
        }
        // Grace is now per-enemy (card.justRevealed) — a freshly revealed enemy sits
        // out the action that revealed it. No global first-turn skip needed.
        this.gameState.playerHealth = Math.max(1, Math.floor(this.gameState.playerHealth || 55));  // Sanitize HP
        this.gameState.maxHealth = Math.max(1, Math.floor(this.gameState.maxHealth || 55));
        if (this.gameState.playerHealth > this.gameState.maxHealth) this.gameState.playerHealth = this.gameState.maxHealth;
        
        // Armor safety net
        if (this.gameState.equippedArmor) {
            this.gameState.equippedArmor.protection = Math.max(0, Math.floor(this.gameState.equippedArmor.protection || 0));
            this.gameState.equippedArmor.durability = Math.max(0, Math.floor(this.gameState.equippedArmor.durability || 25));
        }
        
        // Refresh type before spawn
        this.roomType = this.gameState.roomType || 'COMBAT';
        this.updateRoomTitle();
        // Fresh fight → fresh log, shown only in combat rooms.
        this.clearCombatLog();
        this.refreshCombatLogVisibility();
        // Boss floors get their own battle-drums track; everything else is silent.
        if (this.roomType === 'BOSS') this.startBossMusic(); else this.stopBossMusic();
        // Reset per-floor amulet flags
        this.gameState.charmingTuneUsed = false;
        if (this.tutorialMode) {
            // Rigged lesson board. No starter swords — the tutorial hands them
            // out on the board so the player learns to pick them up.
            this.cardSystem.spawnTutorialCards();
        } else {
            this.cardSystem.spawnFloorCards();
            this.inventorySystem.addStartingCards();
        }
        // DON'T replenish action points here
        this.updateUI();
        this.cardSystem.checkFloorClear();
    }

    startBossMusic() {
        MusicManager.play(this, 'boss_music', 0.6, 700);
    }

    stopBossMusic() {
        MusicManager.stopIfPlaying(this, 'boss_music', 600);
    }

    showNextFloorButton() {
        if (this.tutorialMode) return;
        if (this._transitioning || this.gameState?.playerHealth <= 0) return;
        if (this.nextFloorButton) {
            this.nextFloorButton
                .setVisible(true)
                .setDepth(5000)
                .setInteractive({ useHandCursor: true })
                .clearTint();
        }
        if (this.nextFloorButtonText) {
            this.nextFloorButtonText.setVisible(true).setDepth(5001);
        }
    }

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
    }
    
    playCoinAnimation() {
        // Play the coin spin animation only (no scaling effects)
        this.coinSprite.play('coin_spin_anim');
    }
    
    playCrystalAnimation() {
        // Play the crystal glow animation only (no scaling or alpha effects)
        this.crystalSprite.play('crystal_glow_anim');
    }

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
        const spacing = 18;
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
    }

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
    }

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
    }

    drawActionPointSection(graphics, x, y, section) {
        const half = 8;
        const pointsBySection = [
            [{ x, y }, { x, y: y - half }, { x: x + half, y }],
            [{ x, y }, { x: x + half, y }, { x, y: y + half }],
            [{ x, y }, { x, y: y + half }, { x: x - half, y }],
            [{ x, y }, { x: x - half, y }, { x, y: y - half }]
        ];
        graphics.fillPoints(pointsBySection[section], true);
    }

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
    }

    bindEnemyTurnHandler() {
        if (this._turnHandlersBound) return;
        this._turnHandlersBound = true;
        this.events.on('endPlayerTurn', () => this.runEnemyTurn());
    }

    useAction() {
        if (this.isEnemyTurn) return false;

        // Check if player will be exhausted BEFORE consuming the action
        const willBeExhausted = this.gameState.actionsLeft <= 0;
        
        // Check for Quickhand Gloves free first action
        if (this.gameState.shouldUseFreeAction()) {
            this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y, 'Free Action!', 0x00ff00);
            this.updateUI();
            // After any action, revealed enemies attack
            this.scheduleEnemyTurn();
            return true;
        }
        
        // Check for other free action chances
        let actionConsumed = true;
        
        if (this.amuletManager) {
            const freeActionChance = this.amuletManager.getFreeActionChance();
            if (freeActionChance > 0 && Math.random() < freeActionChance) {
                actionConsumed = false;
                this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y, 'Free Action!', 0x00ff00);
            }
        }
        
        // REMOVED: Exhaustion damage - player is just weakened now
        // Only show the weakened message when out of action points
        if (willBeExhausted && actionConsumed) {
            // Just show weakened state, no damage
            this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y, 'Weakened!', 0xff6600);
        }
        
        // Consume action point if not a free action and player has AP
        if (actionConsumed && this.gameState.actionsLeft > 0) {
            this.gameState.actionsLeft--;
        }
        
        this.updateUI();
        // After any action, emit one enemy turn. Extra clicks before it fires should not stack turns.
        this.scheduleEnemyTurn();
        
        return true; // Always return true to allow actions
    }

    scheduleEnemyTurn() {
        if (this._transitioning || this.enemiesCleared) return;
        // Queue one enemy turn per action. Rapid actions no longer coalesce into
        // a single attack — each one earns its own enemy response.
        this.pendingEnemyTurns = (this.pendingEnemyTurns || 0) + 1;
        this._drainEnemyTurns();
    }

    hasCombatStalemate() {
        if (this._transitioning || this.enemiesCleared || this.gameState?.playerHealth <= 0) return false;

        const board = this.cardSystem?.boardCards || [];
        const enemiesRemain = board.some(card => (
            card?.revealed
            && this.isEnemyCard(card)
            && (card.data?.health ?? 1) > 0
        ));
        if (!enemiesRemain) return false;

        // A remaining board card can still reveal or provide a way forward.
        if (board.some(card => card && !this.isEnemyCard(card))) return false;

        const inventory = this.inventorySystem?.slots || this.gameState?.inventory || [];
        const hasUsableWeapon = inventory.some(card => (
            card?.type === 'weapon' && (card.durability ?? 1) > 0
        )) || (
            this.gameState?.equippedWeapon?.type === 'weapon'
            && (this.gameState.equippedWeapon.durability ?? 1) > 0
        );
        if (hasUsableWeapon) return false;

        // Magic can still change or resolve a fight without a weapon.
        return !inventory.some(card => card?.type === 'magic');
    }

    queueStalemateEnemyTurn() {
        if (this.stalemateEnemyTurnQueued || this.enemyTurnQueued || this.isEnemyTurn) return;
        if ((this.pendingEnemyTurns || 0) > 0 || !this.hasCombatStalemate()) return;

        this.stalemateEnemyTurnQueued = true;
        const timer = this.time.delayedCall(900, () => {
            this.stalemateEnemyTurnQueued = false;
            if (this.hasCombatStalemate()) this.scheduleEnemyTurn();
        });
        this.enemyTurnTimers.push(timer);
    }

    _drainEnemyTurns() {
        if (this.enemyTurnQueued || this.isEnemyTurn || this._transitioning || this.enemiesCleared) return;
        if (!this.pendingEnemyTurns || this.pendingEnemyTurns <= 0) return;
        this.enemyTurnQueued = true;
        const timer = this.time.delayedCall(500, () => {
            this.enemyTurnQueued = false;
            this.pendingEnemyTurns = Math.max(0, (this.pendingEnemyTurns || 0) - 1);
            this.events.emit('endPlayerTurn');
        });
        this.enemyTurnTimers.push(timer);
    }
    // Also add a method to check if player is currently exhausted (for weapon damage calculation)
    isPlayerExhausted() {
        return this.gameState.actionsLeft <= 0;
    }

    // endTurn() method removed - no more Rest button to restore action points

    // enemyTurn() method removed - enemies now attack after each player action
    // The revealedEnemiesAttack method handles all enemy responses
    
    startPlayerTurn() {
        this.isEnemyTurn = false;
        // Action points no longer reset automatically
        this.updateUI();
    }
    
    runEnemyTurn() {
      this.enemyTurnQueued = false;
      if (this.isEnemyTurn) return;
      this.isEnemyTurn = true;
      this.revealedEnemiesAttack();
    }
    revealedEnemiesAttack() {
        if (this.gameState.playerHealth <= 0) return; // Don't attack a dead player.

        // Snapshot which enemies are eligible to act this action. A freshly revealed
        // enemy sits out the action that revealed it (a one-action grace so flipping
        // into an enemy doesn't zap you on the same click), then joins the fight on
        // the next action. This is PER-ENEMY: revealing a new enemy no longer cancels
        // attacks from enemies already on the board.
        const eligible = this.cardSystem.boardCards
            .map((card, index) => ({ card, index }))
            .filter(({ card }) => card && card.revealed && this.isEnemyCard(card) && !card.justRevealed);
        // Clear the grace flag now that we've snapshotted — they act next turn.
        this.cardSystem.boardCards.forEach(card => {
            if (card && card.justRevealed) card.justRevealed = false;
        });
        if (eligible.length === 0) {
            this.finishEnemyTurnEffects({ runCompanions: false });
            return;
        }

        // Check if player is blocking with bow
        if (this.gameState.blockNextAttack) {
            this.gameState.blockNextAttack = false; // Reset block
            SoundHelper.playSound(this, 'armor_equip', 0.5);
            this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y, 'Blocked!', 0x00aaff);
            
            // Visual effect for successful block
            const blockEffect = this.add.circle(this.playerAvatar.x, this.playerAvatar.y, 30, 0x00aaff, 0.5);
            this.tweens.add({
                targets: blockEffect,
                alpha: 0,
                scale: 2,
                duration: 500,
                onComplete: () => blockEffect.destroy()
            });
            
            this.finishEnemyTurnWithCompanion();
            return; // Block prevents ALL enemy attacks this action
        }
        
        // Check for bone wall reflection FIRST (before individual enemy attacks)
        if (this.gameState.boneWall && this.gameState.boneWall > 0) {
            // Find the first eligible (non-frozen) attacking enemy
            const firstAttacker = eligible.find(({ card }) => !(card.data.frozen && card.data.frozen > 0)) || null;

            if (firstAttacker) {
                this.gameState.boneWall--;
                SoundHelper.playSound(this, 'armor_equip', 0.5);
                
                // Reflect damage back to enemy
                const reflectedDamage = firstAttacker.card.data.attack;
                this.cardSystem.attackEnemy(firstAttacker.index, reflectedDamage, true);
                this.createFloatingText(firstAttacker.card.sprite.x, firstAttacker.card.sprite.y, `-${reflectedDamage} (Reflected)`, 0xffffff);
                this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y, 'Bone Wall!', 0xffffff);
                this.updateUI(); // Refresh so the remaining Bone Wall charges update
                this.finishEnemyTurnWithCompanion();
                return; // Bone wall blocks all attacks this action
            }
        }
        
        // Check for mirror shield (one-time full reflection)
        if (this.gameState.mirrorShield) {
            // Find the first eligible (non-frozen) attacking enemy
            const firstAttacker = eligible.find(({ card }) => !(card.data.frozen && card.data.frozen > 0)) || null;

            if (firstAttacker) {
                this.gameState.mirrorShield = false;
                SoundHelper.playSound(this, 'armor_equip', 0.5);
                
                // Reflect full damage back
                const reflectedDamage = firstAttacker.card.data.attack;
                this.cardSystem.attackEnemy(firstAttacker.index, reflectedDamage, true);
                this.createFloatingText(firstAttacker.card.sprite.x, firstAttacker.card.sprite.y, `-${reflectedDamage} (Mirrored)`, 0xc0c0c0);
                this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y, 'Mirror Shield!', 0xc0c0c0);
                this.updateUI(); // Refresh so Mirror Shield drops off the effects panel
                this.finishEnemyTurnWithCompanion();
                return; // Mirror shield blocks all attacks this action
            }
        }
        
        const attackers = eligible;

        let attackerIndex = 0;
        const attackNext = () => {
            if (this._transitioning || this.enemiesCleared || this.gameState.playerHealth <= 0 || attackerIndex >= attackers.length) {
                this.finishEnemyTurnEffects();
                return;
            }

            const { index } = attackers[attackerIndex++];
            const card = this.cardSystem.boardCards[index];
            if (card && card.revealed && this.isEnemyCard(card)) {
                this.processEnemyAttack(card, index);
                this.updateUI();
            }

            const timer = this.time.delayedCall(320, attackNext);
            this.enemyTurnTimers.push(timer);
        };

        attackNext();
    }

    clearEnemyTurnTimers() {
        if (!this.enemyTurnTimers) {
            this.enemyTurnTimers = [];
            return;
        }
        this.enemyTurnTimers.forEach(timer => timer?.remove?.(false));
        this.enemyTurnTimers = [];
        this.enemyTurnQueued = false;
        this.pendingEnemyTurns = 0;
        this.stalemateEnemyTurnQueued = false;
        this.isEnemyTurn = false;
    }

    isEnemyCard(card) {
        return !!this.cardSystem?.isEnemyType(card?.data?.type);
    }

    processEnemyAttack(card, index) {
        // Process frozen duration BEFORE checking if enemy can attack
        if (card.data.frozen && card.data.frozen > 0) {
            const wasShocked = (card.data.shockedTurns || 0) > 0;
            card.data.frozen--;
            if (wasShocked) card.data.shockedTurns--;

            if (card.data.frozen === 0 && card.sprite) {
                card.sprite.clearTint();
                this.cardSystem.removeFrozenFrame(card);
                if (wasShocked) {
                    card.shockMarker?.destroy?.();
                    card.shockMarker = null;
                    card.data.shockedTurns = 0;
                    this.createFloatingText(card.sprite.x, card.sprite.y, 'Shock Wore Off!', 0x99ddff);
                } else {
                    this.createFloatingText(card.sprite.x, card.sprite.y, 'Thawed!', 0xffffff);
                }
            } else {
                this.createFloatingText(card.sprite.x, card.sprite.y, `Frozen (${card.data.frozen})`, 0x00ccff);
            }
            return;
        }

        // Mimic escape countdown — runs out after 3 enemy turns if still alive
        if (card.data.isMimic) {
            if (card.data.escapeTurnsLeft === undefined) {
                card.data.escapeTurnsLeft = card.data.escapeTurns || 3;
            }
            card.data.escapeTurnsLeft--;
            if (card.data.escapeTurnsLeft <= 0) {
                this.cardSystem.mimicEscape(index);
                return; // gone — no attack this turn
            }
            this.createFloatingText(card.sprite.x, card.sprite.y - 28, `${card.data.escapeTurnsLeft} left!`, 0xffaa00);
            // Mimic still takes its small bite below
        }

        // Lute of First Light — first melee enemy on each floor skips its first attack
        if (this.amuletManager?.hasCharmingTune?.() &&
            !this.gameState.charmingTuneUsed &&
            card.data.role === 'MELEE') {
            this.gameState.charmingTuneUsed = true;
            this.createFloatingText(card.sprite.x, card.sprite.y - 20, 'Charmed (Lute)', 0xff66ff);
            return;
        }

        // Siren's Perfume — chance to redirect attack onto another enemy
        const charmChance = this.amuletManager?.getCharmChance?.() || 0;
        if (charmChance > 0 && Math.random() < charmChance) {
            const others = this.cardSystem.boardCards
                .map((c, i) => ({ card: c, index: i }))
                .filter(({ card: c, index: i }) =>
                    c && c.revealed && i !== index && this.isEnemyCard(c)
                );
            if (others.length > 0) {
                const target = others[Math.floor(Math.random() * others.length)];
                this.createFloatingText(card.sprite.x, card.sprite.y - 20, 'Charmed!', 0xff66ff);
                this.cardSystem.attackEnemy(target.index, card.data.attack, false);
                return; // skip player damage
            }
        }

        // BOSS SUMMONING ABILITY - Process before attack (now spawns multiple)
        if (card.data.type === 'boss' && card.data.abilities) {
            card.data.abilities.forEach(ability => {
                if (ability.type === 'summon' && Math.random() < ability.chance) {
                    const n = ability.count || 1;
                    for (let k = 0; k < n; k++) this.cardSystem.summonEnemy(ability.enemyType, card);
                }
            });
        }

        let damageDealt = card.data.attack;

        // RAGE — when the boss drops below its HP threshold it hits harder. Shows
        // an "ENRAGED!" cue the first time it kicks in so the spike is legible.
        const rage = card.data.abilities?.find(a => a.type === 'rage');
        if (rage) {
            const maxHp = card.data.maxHealth || card.data.health;
            if (maxHp > 0 && (card.data.health / maxHp) <= (rage.threshold ?? 0.3)) {
                damageDealt = Math.ceil(damageDealt * (rage.damageBoost || 1.5));
                if (!card.data._rageShown) {
                    card.data._rageShown = true;
                    this.createFloatingText(card.sprite.x, card.sprite.y - 24, 'ENRAGED!', 0xff3333);
                }
            }
        }

        // ARMOR BREAK — this hit pierces some of the player's protection.
        const armorBreak = card.data.abilities?.find(a => a.type === 'armor_break');
        const armorPierce = armorBreak?.amount || 0;
        if (armorPierce > 0 && this.gameState.equippedArmor) {
            this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y - 16, 'Armor Broken!', 0xffa500);
        }

        this.createDamageEffect(card.sprite.x, card.sprite.y);

        // Apply abilities like poison on hit
        card.data.abilities?.forEach(ability => {
            if (ability.type === 'poison') {
                const killedBy = card.data.name || card.data.type || 'Enemy';
                if (this.gameState.addPlayerEffect({ ...ability, killedBy })) {
                    this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y, 'Poisoned!', 0x00ff00);
                }
            } else if (ability.type === 'coin_steal') {
                // Goblin coin stealing ability
                if (Math.random() < ability.chance && this.gameState.coins > 0) {
                    const stolenAmount = Math.min(ability.amount, this.gameState.coins);
                    this.gameState.coins -= stolenAmount;
                    this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y, `-${stolenAmount} coins stolen!`, 0xffd700);
                    this.createFloatingText(card.sprite.x, card.sprite.y, `+${stolenAmount}`, 0xffd700);
                }
            }
        });

        const playerHealthBeforeDamage = this.gameState.playerHealth;
        const { actualDamage, tookDamage } = this.gameState.takeDamage(damageDealt, index, 'enemy', armorPierce);

        if (tookDamage) {
            SoundHelper.playSound(this, 'player_hurt', 0.5);
            this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y, `-${actualDamage}`, 0xff0000);

            if (playerHealthBeforeDamage > 0 && this.gameState.playerHealth <= 0) {
                this.killedBy = card.data.name || card.data.type || 'Enemy';
            }
        }

        // Boss LIFESTEAL — the leech heals from the damage it ACTUALLY landed on
        // the player (after armor). Basing it on real damage means good armor
        // throttles the heal, and fully blocking a hit stops it entirely — so a
        // defensive build can out-race a healing boss like the Lich instead of
        // watching it top itself off off a number your armor never touched.
        const leech = card.data.abilities?.find(a => a.type === 'lifesteal');
        if (leech && actualDamage > 0) {
            const heal = Math.max(1, Math.ceil(actualDamage * (leech.percentage || 0.3)));
            if (card.data.maxHealth === undefined) card.data.maxHealth = card.data.health;
            card.data.health = Math.min(card.data.maxHealth, card.data.health + heal);
            this.cardSystem.updateEnemyInfoText?.(card);
            if (card.sprite) this.createFloatingText(card.sprite.x, card.sprite.y - 16, `+${heal} Leech`, 0x66ff66);
        }

        this.applyThornsDamage(card, index, tookDamage);
    }

    getActiveThornsCard() {
        const slots = this.inventorySystem?.slots || this.gameState.inventory || [];
        for (let i = 0; i < slots.length; i++) {
            const item = slots[i];
            if (item?.type === 'thorns' && item.durability > 0) {
                return { item, index: i };
            }
        }
        return null;
    }

    applyThornsDamage(card, index, playerTookDamage = false) {
        if (this.cardSystem.boardCards[index] !== card) return;
        // Thorns only reflect onto melee attackers. Skip back-row (RANGED) enemies
        // and archers — a front-row archer's role is forced to MELEE by position,
        // but it still attacks from range, so its intrinsic ranged flag exempts it.
        // Bosses have no row/role (they occupy a fixed slot) but strike the player
        // in melee, so they always count as melee attackers for thorns.
        const isBoss = card.data.type === 'boss';
        const isMelee = isBoss || (card.data.role === 'MELEE' && !card.data.isRangedType);
        const thorns = isMelee ? this.getActiveThornsCard() : null;
        // Armor thorns (Briar Room bonus) also only bite melee attackers — a ranged
        // archer never touches your armor, so it shouldn't take thorn damage.
        const armorDamage = (isMelee && playerTookDamage)
            ? (this.gameState.equippedArmor?.thornDamage || 0)
            : 0;
        const cardDamage = thorns ? (thorns.item.thornDamage || 2) : 0;
        const damage = armorDamage + cardDamage;
        if (damage <= 0) return;
        const x = card.sprite?.x || this.playerAvatar.x;
        const y = card.sprite?.y || this.playerAvatar.y;

        this.cardSystem.attackEnemy(index, damage, true);
        SoundHelper.playSound(this, 'thorns_hit', 0.45);
        this.createFloatingText(x, y, `-${damage} Thorns`, 0x9dff7a);

        if (!thorns) return;
        thorns.item.durability = Math.max(0, thorns.item.durability - 1);
        if (thorns.item.durability <= 0) {
            this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y + 20, 'Thorns broke!', 0x9dff7a);
            this.grantCardSpentRelicBonus(thorns.item, this.playerAvatar.x, this.playerAvatar.y);
            if (this.inventorySystem) {
                this.inventorySystem.removeCard(thorns.index);
            } else if (this.gameState.inventory) {
                this.gameState.inventory[thorns.index] = null;
            }
        } else if (this.inventorySystem) {
            this.inventorySystem.rebuildInventorySprites();
        }
    }

    finishEnemyTurnEffects({ runCompanions = true } = {}) {
        // Process magic buff durations AFTER enemy attacks
        if (this.gameState.shadowBlade) {
            this.gameState.shadowBlade.turns--;
            if (this.gameState.shadowBlade.turns <= 0) {
                this.gameState.shadowBlade = null;
                this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y, 'Shadow Blade faded', 0x666666);
            }
        }
        
        if (this.gameState.magicShield) {
            this.gameState.magicShield.turns--;
            if (this.gameState.magicShield.turns <= 0) {
                this.gameState.magicShield = null;
                this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y, 'Magic Shield faded', 0x666666);
            }
        }

        this.cardSystem.processEnemyPoisonEffects();
        
        // Process player poison effects
        let effectDamage = 0;
        let poisonKilledBy = null;
        for (let i = this.gameState.playerEffects.length - 1; i >= 0; i--) {
            const effect = this.gameState.playerEffects[i];
            if (effect.type === 'poison') {
                effectDamage += effect.damage;
                poisonKilledBy = effect.killedBy || poisonKilledBy;
            }
            effect.turns--;
            if (effect.turns <= 0) {
                this.gameState.playerEffects.splice(i, 1);
                this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y + 20, 'Poison Wore Off', 0xcccccc);
            }
        }
        
        if (effectDamage > 0) {
            const playerHealthBeforePoison = this.gameState.playerHealth;
            SoundHelper.playSound(this, 'player_hurt', 0.5);
            const { actualDamage, tookDamage } = this.gameState.takeDamage(effectDamage, -1, 'poison');
            this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y, `-${actualDamage} (Poison)`, 0x00ff00);
            
            // Track poison death
            if (playerHealthBeforePoison > 0 && this.gameState.playerHealth <= 0) {
                this.killedBy = poisonKilledBy || 'Poison';
            }
            
            // Lethal poison: gameState.takeDamage() already scheduled
            // gameOver(). Just halt the turn so companion/end-of-turn
            // effects don't run on a dead player.
            if (this.gameState.playerHealth <= 0) {
                this.isEnemyTurn = false;
                return;
            }
        }
        
        this.updateUI();
        if (this.gameState.playerHealth <= 0) {
            this.isEnemyTurn = false;
            return;
        }
        if (runCompanions) {
            this.finishEnemyTurnWithCompanion();
            return;
        }

        this.isEnemyTurn = false;
        this.updateUI();
        this._drainEnemyTurns();
        this.queueStalemateEnemyTurn();
    }

    getChickCompanionEntry() {
        const slots = this.inventorySystem?.slots || this.gameState?.inventory || [];
        const index = slots.findIndex(item => item?.id === 'chickCompanion');
        return index >= 0 ? { companion: slots[index], index } : null;
    }

    getSkeletonCompanionEntry() {
        // The id is unchanged by the Slimebone Guard upgrade, so this catches
        // both the base and the trained form.
        const slots = this.inventorySystem?.slots || this.gameState?.inventory || [];
        const index = slots.findIndex(item => item?.id === 'skeletonWarriorCompanion');
        return index >= 0 ? { companion: slots[index], index } : null;
    }

    getCompanionEntries() {
        const slots = this.inventorySystem?.slots || this.gameState?.inventory || [];
        return slots
            .map((companion, index) => ({ companion, index }))
            .filter(({ companion }) => companion?.type === 'companion');
    }

    getCompanionKey(companion) {
        const raw = companion?.companionId
            || companion?.id
            || companion?.companionType
            || companion?.name;
        return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
    }

    syncCompanionHistory() {
        if (!this.gameState.companionHistory || typeof this.gameState.companionHistory !== 'object') {
            this.gameState.companionHistory = {};
        }
        this.getCompanionEntries().forEach(({ companion }) => {
            const key = this.getCompanionKey(companion);
            if (!key || this.gameState.companionHistory[key]) return;
            this.gameState.companionHistory[key] = {
                name: companion.name || 'Companion',
                roomsFought: 0,
                acquiredFloor: this.gameState.currentFloor || 1,
                lastCountedFloor: null,
                lastCountedRoomId: null,
                upgraded: false
            };
        });
        return this.gameState.companionHistory;
    }

    getCurrentCombatRoomId() {
        const cursor = this.gameState.mapCursor || {};
        return [
            cursor.act ?? 'act',
            cursor.floor ?? this.gameState.currentFloor ?? 1,
            cursor.node ?? 'node',
            this.gameState.roomType || this.roomType || 'COMBAT'
        ].join(':');
    }

    markCompanionParticipated(companion) {
        const combatTypes = new Set(['COMBAT', 'ELITE', 'HARD', 'BOSS']);
        const roomType = this.gameState.roomType || this.roomType;
        if (!combatTypes.has(roomType)) return false;
        this.syncCompanionHistory();
        const key = this.getCompanionKey(companion);
        if (!key) return false;
        if (!this.gameState.companionRoomParticipants || typeof this.gameState.companionRoomParticipants !== 'object') {
            this.gameState.companionRoomParticipants = {};
        }
        this.gameState.companionRoomParticipants[key] = this.getCurrentCombatRoomId();
        return true;
    }

    finalizeCompanionCombatHistory() {
        const combatTypes = new Set(['COMBAT', 'ELITE', 'HARD', 'BOSS']);
        const roomType = this.gameState.roomType || this.roomType;
        if (!combatTypes.has(roomType)) return 0;

        const history = this.syncCompanionHistory();
        const participants = this.gameState.companionRoomParticipants || {};
        const roomId = this.getCurrentCombatRoomId();
        let counted = 0;
        Object.entries(participants).forEach(([key, participatedRoomId]) => {
            const entry = history[key];
            if (!entry || participatedRoomId !== roomId || entry.lastCountedRoomId === roomId) return;
            entry.roomsFought = (Number(entry.roomsFought) || 0) + 1;
            entry.lastCountedFloor = this.gameState.currentFloor || 1;
            entry.lastCountedRoomId = roomId;
            counted++;
        });
        this.gameState.companionRoomParticipants = {};
        return counted;
    }

    getCompanionProtectionBonus() {
        return this.getCompanionEntries().reduce((total, { companion }) => (
            total + Math.max(0, Number(companion.guardProtection) || 0)
        ), 0);
    }

    selectCompanionTarget(companion) {
        const candidates = (this.cardSystem?.boardCards || [])
            .map((card, index) => ({ card, index }))
            .filter(({ card }) => (
                card?.revealed
                && card?.sprite
                && this.isEnemyCard(card)
                && (card.data?.health || 0) > 0
            ));
        if (candidates.length === 0) return null;

        if (companion?.attackStyle === 'melee' || companion?.range === 'melee') {
            const frontline = candidates.filter(({ card }) => (
                card.data?.role === 'MELEE' || card.data?.type === 'boss'
            ));
            if (frontline.length === 0) return null;
            return frontline[Math.floor(Math.random() * frontline.length)];
        }

        const archers = candidates.filter(({ card }) => card.data?.isRangedType === true);
        const pool = archers.length > 0 ? archers : candidates;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    finishEnemyTurnWithCompanion() {
        this.runCompanionTurns(() => {
            this.isEnemyTurn = false;
            this.updateUI();
            // Run the next queued enemy turn, if any actions stacked up during this one.
            this._drainEnemyTurns();
            this.queueStalemateEnemyTurn();
        });
    }

    runCompanionTurns(onComplete = () => {}) {
        const entries = this.getCompanionEntries();
        const runNext = (position) => {
            if (position >= entries.length) {
                onComplete();
                return;
            }
            this.runCompanionTurn(entries[position], () => runNext(position + 1));
        };
        runNext(0);
    }

    runCompanionTurn(entry, onComplete = () => {}) {
        const target = this.selectCompanionTarget(entry?.companion);
        if (!entry || !target || this._transitioning || this.gameState.playerHealth <= 0) {
            onComplete();
            return false;
        }

        const slot = this.inventorySystem?.slotSprites?.[entry.index];
        const cardSprite = slot?.card;
        const restY = slot?.originalY ?? cardSprite?.y;
        const hoverSprite = slot?.hoverSprite;

        if (cardSprite && Number.isFinite(restY)) {
            if (hoverSprite) {
                hoverSprite.setVisible(true);
                hoverSprite.play('hover_cards_anim');
            }
            this.tweens.add({
                targets: [cardSprite, hoverSprite].filter(Boolean),
                y: restY - 5,
                duration: 120,
                ease: 'Power2',
                yoyo: true,
                onComplete: () => {
                    if (hoverSprite?.scene) {
                        hoverSprite.stop();
                        hoverSprite.setVisible(false);
                        hoverSprite.y = restY;
                    }
                    if (cardSprite?.scene) cardSprite.y = restY;
                }
            });
        }

        const attackTimer = this.time.delayedCall(120, () => {
            const currentTarget = this.cardSystem.boardCards[target.index];
            if (currentTarget === target.card && currentTarget?.data?.health > 0) {
                this.markCompanionParticipated(entry.companion);
                // Evasive enemies (Lost Soul) can dodge a companion's strike too —
                // rollEvade shows "Miss!" and we skip the damage and the shock.
                if (!this.cardSystem.rollEvade(currentTarget)) {
                    const isMelee = entry.companion.attackStyle === 'melee'
                        || entry.companion.range === 'melee';
                    this.cardSystem.damageGemTarget(
                        target.index,
                        entry.companion.attack || 2,
                        isMelee ? 'Skeleton Slash' : 'Chick Zap',
                        isMelee ? 0xd8d8c8 : 0xffe066,
                        isMelee ? null : 'lightning'
                    );
                    if ((entry.companion.shockChance || 0) > 0
                        && Math.random() < entry.companion.shockChance) {
                        const shockedTarget = this.cardSystem.boardCards[target.index];
                        if (shockedTarget === target.card && shockedTarget?.data?.health > 0) {
                            this.cardSystem.applyShockStatus(shockedTarget, 1);
                        }
                    }
                }
            }
            const finishTimer = this.time.delayedCall(220, onComplete);
            this.enemyTurnTimers.push(finishTimer);
        });
        this.enemyTurnTimers.push(attackTimer);
        return true;
    }

    createDamageEffect(x, y) {
        const flash = this.add.circle(x, y, 50, 0xff0000, 0.5);
        this.tweens.add({
            targets: flash,
            alpha: 0,
            scale: 1.5,
            duration: 300,
            onComplete: () => flash.destroy()
        });
    }
    // takeDamage method is now primarily handled in GameState
    // This is kept for calls that might not have been updated yet
    takeDamage(rawDamage, enemyIndex = -1) {
        // Player takes damage and reflection is handled inside takeDamage
        const { actualDamage, tookDamage } = this.gameState.takeDamage(rawDamage, enemyIndex);
        if (tookDamage) {
            SoundHelper.playSound(this, 'player_hurt', 0.5);
            this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y, `-${actualDamage}`, 0xff0000);
        }
    }
    createFloatingText(x, y, text, color, fontSize = '15px', opts = {}) {
        const message = t(this, text);
        // Mirror every combat event into the running log (brown, not the
        // bright floating-text color) so players can read the fight back. The
        // position tells us who the number belongs to (You / enemy name).
        // Callers that log the event themselves pass { skipLog: true }.
        if (!opts.skipLog) this.addCombatLog(message, x, y);
        const slot = this.reserveFloatingTextSlot(x, y);
        const startX = Phaser.Math.Clamp(x + slot.xOffset, 32, 608);
        const startY = Phaser.Math.Clamp(y + slot.yOffset, 24, 336);
        const fill = Phaser.Display.Color.IntegerToColor(color).rgba;
        const floatText = this.add.text(startX, startY, message, {
            fontSize,
            fill,
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

        // Track the live text so a floor transition (which sleeps the scene and
        // freezes its tweens mid-flight) can sweep away any stragglers instead
        // of leaving them frozen on the next floor's board.
        (this._floatingTexts || (this._floatingTexts = [])).push(floatText);
        floatText.once('destroy', () => {
            const list = this._floatingTexts;
            if (!list) return;
            const idx = list.indexOf(floatText);
            if (idx !== -1) list.splice(idx, 1);
        });

        this.tweens.add({
            targets: floatText,
            y: floatText.y - 28,
            duration: 650,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: floatText,
                    alpha: 0,
                    duration: 450,
                    delay: 450,
                    ease: 'Linear',
                    onComplete: () => {
                        slot.active = false;
                        floatText.destroy();
                    }
                });
            }
        });
    }

    reserveFloatingTextSlot(x, y) {
        const now = this.time.now;
        this.floatingTextSlots = (this.floatingTextSlots || []).filter(slot => slot.active && slot.expiresAt > now);

        const nearby = this.floatingTextSlots.filter(slot =>
            Math.abs(slot.x - x) < 72 && Math.abs(slot.y - y) < 48
        ).length;
        const lane = nearby % 6;
        const row = Math.floor(nearby / 6);
        const slot = {
            x,
            y,
            xOffset: ((lane % 3) - 1) * 10,
            yOffset: -lane * 15 - row * 10,
            expiresAt: now + 1700,
            active: true
        };
        this.floatingTextSlots.push(slot);
        return slot;
    }

    // Immediately destroy any live floating numbers/labels and free their
    // layout slots. Called on floor transitions and scene shutdown so a text
    // whose fade-out tween was paused (scene slept mid-flight) can't linger on
    // the next floor's board.
    clearFloatingTexts() {
        if (Array.isArray(this._floatingTexts)) {
            // Copy first: destroy() fires the 'destroy' handler that splices the
            // live array, which would corrupt a direct iteration.
            [...this._floatingTexts].forEach(txt => {
                if (!txt) return;
                this.tweens?.killTweensOf(txt);
                txt.destroy();
            });
        }
        this._floatingTexts = [];
        this.floatingTextSlots = [];
    }
    
    createSlashEffect(x, y) {
        const slash = this.add.graphics();
        slash.lineStyle(5, 0xffffff, 1);
        slash.beginPath();
        slash.moveTo(-25, -25);
        slash.lineTo(25, 25);
        slash.closePath();
        slash.strokePath();
        slash.x = x;
        slash.y = y;
        slash.setAngle(Phaser.Math.Between(-20, 20));
        this.tweens.add({
            targets: slash,
            alpha: 0,
            scale: 1.4,
            duration: 250,
            ease: 'Cubic.easeOut',
            onComplete: () => slash.destroy()
        });
    }
    
    shakeCard(cardSprite) {
        const originalX = cardSprite.x;
        const intensity = 4;
        const duration = 50;
        this.tweens.add({
            targets: cardSprite,
            x: originalX - intensity,
            yoyo: true,
            repeat: 2,
            duration: duration,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                cardSprite.x = originalX;
            }
        });
    }
    
    gameOver() {
        if (this._resultScreenShown || this._gameOverInProgress) return;
        this._gameOverInProgress = true;
        this._transitioning = true;
        this.stopBossMusic();
        this.clearEnemyTurnTimers();
        this.nextFloorButton?.disableInteractive();

        const killedBy = this.killedBy || 'Unknown Enemy';
        const floor = this.gameState?.currentFloor ?? 1;
        let deathStats = { killedBy, floor };
        let newRelic = null;

        try {
            deathStats = this.gameState.getDeathStats();
            deathStats.killedBy = killedBy;
            deathStats.floor = floor;

            this.unlockChickForRareShopAfterDeath();
            this.unlockSkeletonForRareShopAfterDeath();
            this.saveManager?.clearCurrentRun();

            if (this.metaManager) {
                this.metaManager.totalRuns++;
                if (floor > this.metaManager.bestFloor) {
                    this.metaManager.bestFloor = floor;
                }
                // Carry an unhatched egg to the next run (consumed at run start).
                const hasEgg = (this.gameState.inventory || []).some(
                    item => item?.id === 'monsterEgg' || item?.name === 'Egg'
                );
                this.metaManager.setPendingEgg(hasEgg);
                newRelic = this.metaManager.handlePlayerDeath(killedBy, floor);
            }
        } catch (error) {
            // Death UI is critical. Meta/save failures must never strand the run
            // at zero health with no way back to the main menu.
            console.error('Failed to finish death bookkeeping:', error);
        }

        try {
            this.showDefeatResult(deathStats, newRelic);
            this._resultScreenShown = true;
        } catch (error) {
            console.error('Failed to render the full defeat screen:', error);
            this.showDefeatFallback(deathStats);
            this._resultScreenShown = true;
        } finally {
            this._gameOverInProgress = false;
        }
    }

    showDefeatFallback(deathStats) {
        const depth = 12000;
        this.add.rectangle(320, 180, 640, 360, 0x000000, 0.9)
            .setDepth(depth)
            .setInteractive();
        this.add.text(320, 105, 'DEFEAT', {
            fontSize: '28px',
            fill: '#ffffff',
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5).setDepth(depth + 1);
        this.add.text(320, 160, `Killed by ${deathStats.killedBy}\nReached Floor ${deathStats.floor}`, {
            fontSize: '16px',
            fill: '#d8d1d8',
            fontFamily: 'Arial, sans-serif',
            align: 'center'
        }).setOrigin(0.5).setDepth(depth + 1);
        this.add.text(320, 245, 'Continue', {
            fontSize: '18px',
            fill: '#ffffff',
            backgroundColor: '#513c2c',
            padding: { x: 18, y: 10 },
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5).setDepth(depth + 1).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('MainMenuScene'));
    }

    unlockChickForRareShopAfterDeath() {
        // Hatching is the achievement that unlocks the Chick for later heroes.
        // Checking only the live inventory here was brittle: the companion can
        // be removed by an event (or the inventory view can be between syncs)
        // before gameOver runs even though this run did hatch it.
        const chickWasHatched = Boolean(
            this.gameState?.storyRun?.chickHatched
            || this.getChickCompanionEntry()
        );
        if (!chickWasHatched) return false;
        this.gameState.heroMemory.chickRareShopUnlocked = true;
        saveHeroMemory(this.gameState.heroMemory);
        return true;
    }

    unlockSkeletonForRareShopAfterDeath() {
        // Obtaining the Skeleton Warrior (Slimy Prison → "Pull him free") is the
        // achievement that lets future heroes buy it from the rare shop. Uses the
        // durable story flag OR the live inventory, mirroring the Chick unlock.
        const skeletonWasObtained = Boolean(
            this.gameState?.storyRun?.skeletonCompanionObtained
            || this.getSkeletonCompanionEntry()
        );
        if (!skeletonWasObtained) return false;
        this.gameState.heroMemory.skeletonRareShopUnlocked = true;
        saveHeroMemory(this.gameState.heroMemory);
        return true;
    }

    addResultPanel(x, y, width, height, frame, depth) {
        const addNineSlice = this.add.nineslice || this.add.nineSlice;
        if (addNineSlice) {
            return addNineSlice.call(this.add, x, y, 'resultPanels', frame, width, height, 12, 12, 12, 12)
                .setOrigin(0.5)
                .setDepth(depth);
        }

        return this.add.image(x, y, 'resultPanels', frame)
            .setOrigin(0.5)
            .setDisplaySize(width, height)
            .setDepth(depth);
    }

    addResultButton(x, y, label, onClick, depth) {
        const button = this.add.image(x, y, 'nextTurnUp')
            .setOrigin(0.5)
            .setDepth(depth)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', onClick);

        this.add.text(x, y - 1, label, {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0.5).setDepth(depth + 1);

        return button;
    }

    showDefeatResult(deathStats, newRelic) {
        const resultDepth = 11000;
        // Interactive (even with no handlers) so it swallows clicks and stops them
        // reaching buttons underneath, like a still-visible Next Floor button.
        this.add.rectangle(320, 180, 640, 360, 0x000000, 0.78).setOrigin(0.5).setDepth(resultDepth).setInteractive();
        this.add.image(320, 36, 'resultBanners', 0).setOrigin(0.5).setDepth(resultDepth + 2);
        this.add.text(320, 37, 'DEFEAT', {
            fontSize: '24px',
            fill: '#948b9b',
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0.5).setDepth(resultDepth + 3).setScale(1, 0.75);

        this.addResultPanel(320, 154, 304, 188, 0, resultDepth + 1);
        this.add.text(320, 86, 'YOU HAVE FALLEN', {
            fontSize: '20px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0.5).setDepth(resultDepth + 2);
        this.add.text(320, 116, `Killed by ${deathStats.killedBy}`, {
            fontSize: '14px',
            fill: '#d8d1d8',
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0.5).setDepth(resultDepth + 2);
        this.add.text(320, 142, `Reached Floor ${deathStats.floor}`, {
            fontSize: '14px',
            fill: '#d8d1d8',
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0.5).setDepth(resultDepth + 2);
        this.add.text(320, 177, `Total Deaths: ${this.metaManager?.totalDeaths ?? 0}`, {
            fontSize: '13px',
            fill: '#b8b0b8',
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0.5).setDepth(resultDepth + 2);
        this.add.text(320, 199, `Best Floor: ${this.metaManager?.bestFloor ?? deathStats.floor}`, {
            fontSize: '13px',
            fill: '#b8b0b8',
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0.5).setDepth(resultDepth + 2);

        this.addResultPanel(320, 262, 304, 78, 1, resultDepth + 1);
        if (newRelic) {
            this.add.text(320, 237, 'NEW RELIC UNLOCKED!', {
                fontSize: '15px',
                fill: '#fed991',
                fontFamily: '"HoMM Pixel", Arial, sans-serif'
            }).setOrigin(0.5).setDepth(resultDepth + 2);
            this.addRelicIcon(newRelic, 214, 264, resultDepth + 2);
            this.add.text(336, 256, translateItemName(this, newRelic), {
                fontSize: '14px',
                fill: '#ffffff',
                fontFamily: '"HoMM Pixel", Arial, sans-serif'
            }).setOrigin(0.5).setDepth(resultDepth + 2);
            this.add.text(336, 281, translateDescription(this, newRelic.description), {
                fontSize: '11px',
                fill: '#d8d1d8',
                fontFamily: '"HoMM Pixel", Arial, sans-serif',
                wordWrap: { width: 200 },
                align: 'center'
            }).setOrigin(0.5).setDepth(resultDepth + 2);
            this.createUnlockParticles(resultDepth + 2);
        } else {
            this.add.text(320, 253, 'No new relic this time', {
                fontSize: '15px',
                fill: '#d8d1d8',
                fontFamily: '"HoMM Pixel", Arial, sans-serif'
            }).setOrigin(0.5).setDepth(resultDepth + 2);
            this.add.text(320, 279, 'Try dying to different enemies to unlock more relics.', {
                fontSize: '11px',
                fill: '#b8b0b8',
                fontFamily: '"HoMM Pixel", Arial, sans-serif',
                wordWrap: { width: 236 },
                align: 'center'
            }).setOrigin(0.5).setDepth(resultDepth + 2);
        }

        this.addResultButton(320, 336, 'Continue', () => this.scene.start('MainMenuScene'), resultDepth + 4);
    }

    addRelicIcon(relic, x, y, depth) {
        this.add.circle(x, y, 18, 0x2c1810, 0.75).setStrokeStyle(1, 0xfed991).setDepth(depth);
        const usesSheet = relic.iconSheet && this.textures.exists(relic.iconSheet);
        if (usesSheet) {
            this.add.image(x, y, relic.iconSheet, relic.iconFrame).setDepth(depth + 1);
        } else if (relic.icon && this.textures.exists(relic.icon)) {
            this.add.image(x, y, relic.icon).setDepth(depth + 1);
        }
    }

    createUnlockParticles(depth = 11002) {
        for (let i = 0; i < 10; i++) {
            const particle = this.add.circle(
                320 + Phaser.Math.Between(-50, 50),
                262 + Phaser.Math.Between(-20, 20),
                3,
                0xfed991
            ).setDepth(depth);

            this.tweens.add({
                targets: particle,
                y: particle.y - 42,
                alpha: 0,
                duration: 1000,
                delay: i * 50,
                ease: 'Cubic.easeOut',
                onComplete: () => particle.destroy()
            });
        }
    }
    
    floorCleared() {
        if (this._transitioning) return;
        // Player already dead (e.g. a mutual kill via Thorns/reflect) — don't let a
        // stray click on the Next Floor button revive them via setupBossRewardRoom().
        if (this.gameState.playerHealth <= 0) return;

        // Leaving any floor ends the boss track (harmless no-op off boss floors).
        this.stopBossMusic();

        // Boss reward room → leaving means advancing to the next act
        if (this.gameState.roomType === 'BOSS_REWARD') {
            this.leaveBossRewardRoom();
            return;
        }

        this._transitioning = true;
        this.clearEnemyTurnTimers();
        // Hard-disable the button so it can't be clicked again
        if (this.nextFloorButton) this.nextFloorButton.disableInteractive();
        this.nextFloorButtonText?.setVisible(false);
        // Elite rooms still use the chest-click TreasureScene flow
        const rewardChestMode = this.gameState.roomType === 'ELITE' ? 'elite' : null;

        // Process amulet floor end effects before moving to next floor.
        // Skip when leaving a combat room that was already cleared before a
        // save/restore — its floor-end effects ran the first time it cleared, so
        // running them again on Continue would double-apply (e.g. bonus HP/AP).
        if (this.amuletManager && !this._floorEndAlreadyProcessed) {
            this.amuletManager.processFloorEnd();
        }
        this._floorEndAlreadyProcessed = false;

        // Use the SAME signals the boss-spawn uses, so spawning and completing the
        // boss always agree. Relying on roomType alone was fragile: if it drifted to
        // COMBAT (act transition / save-load / sub-scene return) the boss would spawn
        // via the map-cursor fallback but never be recognized as completed — so the
        // game kept handing out normal floors past the final boss instead of winning.
        const bossFloors = [15, 30, 45];
        const completedActBoss =
            bossFloors.includes(this.gameState.currentFloor) ||
            this.gameState.roomType === 'BOSS' ||
            (this.gameState.mapCursor?.floor ?? -1) >= 14;

        if (completedActBoss) {
            // Final boss → straight to victory, no reward room. Detect the final act
            // by the map cursor's act (robust to a 1-floor currentFloor drift) and
            // keep the floor check as a fallback.
            const isFinalAct = (this.gameState.mapCursor?.act >= 3) || this.gameState.currentFloor >= 45;
            if (isFinalAct) {
                this.saveCurrentRun();
                this.time.delayedCall(1500, () => this.gameWon());
                return;
            }
            // Otherwise stay in-scene and switch to the boss reward room
            this.time.delayedCall(700, () => this.setupBossRewardRoom());
            return;
        }

        // AUTO-SAVE the current run
        this.saveCurrentRun();

        this.time.delayedCall(500, () => {
            this.scene.sleep();
            if (rewardChestMode) {
                this.scene.launch('TreasureScene', {
                    gameState: this.gameState,
                    rewardMode: rewardChestMode
                });
            } else {
                this.scene.stop('MapViewScene');
                this.scene.launch('MapViewScene', { gameState: this.gameState });
            }
        });
    }

    // Replaces the previous TreasureScene boss flow. Stays inside GameScene so the
    // player keeps their avatar, inventory and full UI — just swaps the board.
    setupBossRewardRoom() {
        this.gameState.roomType = 'BOSS_REWARD';
        this.roomType = 'BOSS_REWARD';
        this.updateRoomTitle();

        // Full restore as the act boss bonus
        const healedHP = this.gameState.maxHealth - this.gameState.playerHealth;
        const refilledAP = this.gameState.maxActions - this.gameState.actionsLeft;
        this.gameState.playerHealth = this.gameState.maxHealth;
        this.gameState.actionsLeft = this.gameState.maxActions;
        if (healedHP > 0) {
            this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y, `+${healedHP} HP`, 0x66ff88);
        }
        if (refilledAP > 0) {
            this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y + 14, `+${refilledAP} AP`, 0x66ddff);
        }

        // Currency reward — scales with floor
        const floor = this.gameState.currentFloor;
        const coinBonus = 25 + floor;
        const crystalBonus = 4 + Math.floor(floor / 6);
        this.gameState.coins += coinBonus;
        this.gameState.crystals += crystalBonus;
        this.createFloatingText(320, 140, `+${coinBonus} Coins  +${crystalBonus} Crystals`, 0xffd700);

        // Generate 3 reward items: amulet, weapon/armor (boss-quality), gem.
        // Quality is the "natural" boss-act tier, then run through capRewardRarity
        // so act-1 boss gives UNCOMMON (was rare), act-2 boss gives RARE (was epic),
        // and act-3 boss still gives LEGENDARY. Earned epics/legendaries are now
        // reserved for endgame instead of trivializing mid-run.
        const gen = this.cardSystem.cardDataGenerator;
        const rawQuality = floor >= 31 ? 'legendary' : floor >= 16 ? 'epic' : 'rare';
        const quality = gen.capRewardRarity(rawQuality, floor);
        const items = [
            gen.createCardData('amulet', floor, false, this.gameState),
            gen.createCardData(Math.random() < 0.5 ? 'weapon' : 'armor', floor, false, null, quality),
            this.makeBossRewardGem()
        ];

        // Spawn chest + reward cards on the existing board
        this.cardSystem.spawnBossRewardBoard(items);

        // Re-enable the Next button so the player can leave when ready
        this._transitioning = false;
        this.enemiesCleared = true;
        this.showNextFloorButton();

        this.updateUI();
    }

    restoreSavedBossRewardRoom() {
        this.gameState.roomType = 'BOSS_REWARD';
        this.roomType = 'BOSS_REWARD';
        this.updateRoomTitle();

        const items = (this._loadedBoardCards || [])
            .filter(card => card?.data)
            .map(card => card.data);
        this.cardSystem.spawnBossRewardBoard(items);
        this._loadedBoardCards = null;
        this._transitioning = false;
        this.enemiesCleared = true;
        this.showNextFloorButton();
        this.updateUI();
    }

    restoreSavedCombatRoom() {
        this.clearEnemyTurnTimers();
        this._transitioning = false;
        this.roomType = this.gameState.roomType || 'COMBAT';
        this.updateRoomTitle();

        const cards = this._loadedBoardCards || [];
        const restored = this.cardSystem.restoreSavedBoard(cards, this._loadedBoardLayout);
        this._loadedBoardCards = null;
        this._loadedBoardLayout = null;
        this._loadedBoardAvailable = false;
        this.enemiesCleared = !!this._loadedEnemiesCleared;
        this._loadedEnemiesCleared = false;

        // A save can carry an empty/all-null board (corrupted, or written right
        // at floor-clear so every card had already been removed). Restoring that
        // strands the player in a hollow, card-less combat room. Whenever there
        // are no live cards, recover by rolling this floor fresh — it keeps the
        // player on their current floor (no rewind) with a playable board.
        // startNewFloor() resets enemiesCleared and hides the Next button, so a
        // stale "cleared" flag from the save can't leak into the new floor.
        const hasLiveCards = this.cardSystem.boardCards.some(card => card);
        if (!restored || !hasLiveCards) {
            this.startNewFloor();
            return;
        }

        // The inventory came from the same save; the starting-card guard keeps
        // this idempotent while preserving the normal new-run initialization.
        this.inventorySystem.addStartingCards();
        this.updateUI();
        if (this.enemiesCleared) {
            // This room's floor-end amulet effects already ran when it first
            // cleared (before the save). Guard the next floorCleared() so they
            // don't fire again when the player clicks Next.
            this._floorEndAlreadyProcessed = true;
            this.showNextFloorButton();
        } else {
            this.cardSystem.checkFloorClear();
            this.queueStalemateEnemyTurn();
        }
    }

    makeBossRewardGem() {
        const gems = [
            { effect: 'fire',      name: 'Fire Gem',      frame: 0,  color: 0xff7040 },
            { effect: 'poison',    name: 'Poison Gem',    frame: 6,  color: 0x66ff66 },
            { effect: 'lightning', name: 'Lightning Gem', frame: 12, color: 0xffe066 }
        ];
        const gem = gems[Math.floor(Math.random() * gems.length)];
        return {
            type: 'gem',
            gemEffect: gem.effect,
            name: gem.name,
            sprite: 'gemsRGY',
            spriteFrame: gem.frame,
            color: gem.color,
            rarity: 'common'
        };
    }

    leaveBossRewardRoom() {
        this._transitioning = true;
        if (this.nextFloorButton) this.nextFloorButton.disableInteractive();
        this.nextFloorButtonText?.setVisible(false);

        // Clean up the chest visual
        this.cardSystem?.clearBossRewardChest?.();

        // Advance to next act now that the player is done picking
        this.gameState.currentFloor++;
        const nextAct = Math.floor((this.gameState.currentFloor - 1) / 15) + 1;
        this.upgradeCompanionsForNextAct(nextAct);
        this.gameState.mapCursor = { act: nextAct, floor: 0, node: 0 };
        const nextActMap = this.gameState.dungeonMap?.[`act${nextAct}`];
        if (nextActMap?.floors?.[0]?.[0]) {
            nextActMap.floors[0][0].visited = true;
        }
        this.createFloatingText(320, 120, `Act ${nextAct}`, 0xf2d3aa);

        // Reset roomType so MapViewScene can set the next node's type
        this.gameState.roomType = 'COMBAT';

        // Queue a post-act shop: player gets to visit a shop before the new act begins.
        // 35% chance of a Rare Shop, otherwise a normal Shop.
        this.gameState.pendingActShop = Math.random() < 0.35 ? 'RARE_SHOP' : 'SHOP';

        this.saveCurrentRun();

        this.time.delayedCall(500, () => {
            this.scene.sleep();
            this.scene.stop('MapViewScene');
            this.scene.launch('MapViewScene', { gameState: this.gameState });
        });
    }

    upgradeCompanionsForNextAct(nextAct) {
        // Acts 2 and 3 are the only real crossings. Guarding the act number
        // keeps a final-victory transition from granting a meaningless upgrade.
        if (nextAct < 2 || nextAct > 3) return 0;

        const slots = this.inventorySystem?.slots || this.gameState?.inventory || [];
        const companions = slots.filter(item => item?.type === 'companion');
        companions.forEach(companion => {
            companion.attack = Math.max(0, Number(companion.attack) || 0) + 1;
            companion.actUpgrades = (Number(companion.actUpgrades) || 0) + 1;
            this.createFloatingText(
                320,
                145 + companions.indexOf(companion) * 14,
                `${companion.name || 'Companion'} +1 ATK`,
                0xffe066
            );
        });

        if (companions.length > 0) {
            this.gameState.inventory = slots;
            this.inventorySystem?.rebuildInventorySprites?.();
            this.updateUI();
        }
        return companions.length;
    }
    
    onEnemiesCleared() {
        this.clearEnemyTurnTimers();
        this.finalizeCompanionCombatHistory();
        this.enemiesCleared = true;
        if (this.tutorialMode) {
            this.updateUI?.();
            return;
        }

        // Floor-clear coin reward. Coins are no longer paid per enemy kill (that
        // faucet was flooding the economy); instead you're paid once for clearing
        // a battle floor. Boss floors are skipped here — they hand out their own
        // reward room. Honors the amulet gold modifier like the old kill payout.
        // Formula tuned via sim/balance-sim.js's shop-affordability probe to hit
        // "3-4 items affordable per regular shop visit, 2-3 per rare shop visit,
        // no act-3 coin hoarding" — see its "Shop affordability" report section.
        // Flattened from 20+floor*3: act 1 was coin-starved (2.7/6 affordable)
        // while acts 2-3 hoarded 500-750 unspent coins (4.5/6 affordable).
        const floor = this.gameState.currentFloor;
        const isBossFloor = [15, 30, 45].includes(floor);
        if (!isBossFloor) {
            const base = Math.floor(24 + floor * 1.2);
            const reward = this.amuletManager ? this.amuletManager.modifyGoldFound(base) : base;
            this.gameState.coins += reward;
            this.createFloatingText(320, 140, `+${reward} coins`, 0xffd700);
            this.updateUI?.();
        }
        // Null-guard: if the button hasn't been (re)created yet, do NOT throw
        // — that would leave enemiesCleared=true with a still-hidden button,
        // and the next checkFloorClear would short-circuit on !enemiesCleared.
        this.showNextFloorButton();
        this.createFloatingText(320, 100, 'All enemies defeated!', 0x00ff00);
        this.createFloatingText(320, 120, 'Clear remaining cards or proceed.', 0xffffff);
    }

    getVictoryStorySummary() {
        const story = this.gameState?.storyRun || {};
        const lines = [];

        if (story.latchboxRewardClaimed) {
            if (story.boxState === 'repaired') {
                lines.push('The Loyal Latchbox carries one more burden than your pack should hold.');
            } else {
                lines.push('The broken trap box coughed up its valuables and retired in disgrace.');
            }
        } else if (story.boxState && story.boxState !== 'unknown') {
            lines.push('A tiny robber box is still loose somewhere in the dungeon.');
        }

        return lines.length > 0
            ? lines.join('\n')
            : 'You have conquered the dungeon, though many stories remain untold.';
    }

    getResolvedStoryCount() {
        const story = this.gameState?.storyRun || {};
        return Number(Boolean(story.latchboxRewardClaimed));
    }
    
    gameWon() {
        const resultDepth = 11000;
        // Interactive (even with no handlers) so it swallows clicks and stops them
        // reaching buttons underneath, like a still-visible Next Floor button.
        this.add.rectangle(320, 180, 640, 360, 0x000000, 0.78).setOrigin(0.5).setDepth(resultDepth).setInteractive();
        this.add.image(320, 36, 'resultBanners', 1).setOrigin(0.5).setDepth(resultDepth + 2);
        this.add.text(320, 32, 'VICTORY!', {
            fontSize: '24px',
            fill: '#fed991',
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0.5).setDepth(resultDepth + 3).setScale(1, 0.75);

        this.addResultPanel(320, 160, 304, 200, 2, resultDepth + 1);
        this.add.text(320, 110, 'The dungeon is conquered.', {
            fontSize: '20px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0.5).setDepth(resultDepth + 2);
        this.add.text(320, 156, this.getVictoryStorySummary(), {
            fontSize: '11px',
            fill: '#5b3b26',
            fontFamily: '"HoMM Pixel", Arial, sans-serif',
            wordWrap: { width: 260 },
            align: 'center'
        }).setOrigin(0.5).setDepth(resultDepth + 2);

        this.addResultPanel(320, 262, 304, 78, 3, resultDepth + 1);
        this.add.text(320, 253, `Stories resolved: ${this.getResolvedStoryCount()}/1`, {
            fontSize: '15px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0.5).setDepth(resultDepth + 2);
        this.add.text(320, 279, 'No relic is granted for victory. Glory will have to do.', {
            fontSize: '11px',
            fill: '#5b3b26',
            fontFamily: '"HoMM Pixel", Arial, sans-serif',
            wordWrap: { width: 236 },
            align: 'center'
        }).setOrigin(0.5).setDepth(resultDepth + 2);

        // Victory ends the run: clear the saved run so it can't be "continued",
        // then return to the main menu instead of dropping straight into a new game.
        this.addResultButton(320, 336, 'Main Menu', () => {
            this.saveManager?.clearCurrentRun();
            this.scene.start('MainMenuScene');
        }, resultDepth + 4);
    }

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
    }

    updateRelicsUI() {
        this.relicUIGroup.clear(true, true);
        if (this.relicTooltip) {
            this.relicTooltip.destroy();
            this.relicTooltip = null;
        }

        const relics = this.metaManager?.getUnlockedRelics?.() || [];
        // Relic silhouettes are a little narrower inside the same atlas frame,
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
    }

    showRelicTooltip(relic, x, y) {
        if (this.relicTooltip) {
            this.relicTooltip.destroy();
        }

        const description = `${translateItemName(this, relic)}\n${translateDescription(this, relic.description)}`;
        const bg = this.add.rectangle(0, 0, 200, 44, 0x000000, 0.85)
            .setStrokeStyle(1, relic.cursed ? 0xff6666 : 0xffd700);
        const tooltipText = this.add.text(0, 0, description, {
            fontSize: '10px',
            fill: relic.cursed ? '#ff9999' : '#ffd700',
            fontFamily: '"HoMM Pixel", Arial, sans-serif',
            align: 'center',
            wordWrap: { width: 190 }
        }).setOrigin(0.5);

        this.relicTooltip = this.add.container(x, y, [bg, tooltipText]);
        this.relicTooltip.setDepth(1000);
    }

    showArmorTooltip(armor) {
        if (this.armorTooltip) {
            this.armorTooltip.destroy();
            this.armorTooltip = null;
        }
        let lines = `${translateItemName(this, armor)}\n${t(this, 'tooltip.protectionShort', { amount: armor.protection })}`;
        if (armor.dodgeChance) {
            lines += `\n${t(this, 'tooltip.dodge', { percent: Math.round(armor.dodgeChance * 100) })}`;
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
    }

    grantCardSpentRelicBonus(card, x = this.playerAvatar.x, y = this.playerAvatar.y) {
        const amount = this.gameState.relicEffects?.cardSpentMaxHP || 0;
        if (!amount || !card) return;

        this.gameState.maxHealth += amount;
        this.gameState.playerHealth = Math.min(
            this.gameState.maxHealth,
            this.gameState.playerHealth + amount
        );
        this.createFloatingText(x, y - 18, `+${amount} Max HP (Camp)`, 0xffd78a);
        this.updateUI();
    }

    recordCardDiscarded(card, x = this.playerAvatar.x, y = this.playerAvatar.y) {
        if (!card) return;

        this.gameState.discardedCardsThisRun = (this.gameState.discardedCardsThisRun || 0) + 1;

        const coinBonus = this.amuletManager?.getDiscardCoinBonus?.() || 0;
        if (coinBonus > 0) {
            this.gameState.coins = (this.gameState.coins || 0) + coinBonus;
            this.createFloatingText(x, y - 18, `+${coinBonus} Coin (Ink Pen)`, 0xffd700);
            this.playCoinAnimation?.();
            this.updateUI();
        }

        const maxHpBonus = this.amuletManager?.getDiscardMaxHpBonus?.() || 0;
        if (maxHpBonus > 0) {
            this.gameState.maxHealth += maxHpBonus;
            this.gameState.playerHealth += maxHpBonus;
            this.createFloatingText(x, y - 32, `+${maxHpBonus} Max HP (Seed)`, 0x9dff7a);
            this.updateUI();
        }

        // Refresh the relic pip display immediately so the Explorer Cape progress
        // is visible right when the item is discarded, not on the next unrelated UI update.
        this.updateRelicsUI();

        const effects = this.gameState.relicEffects || {};
        const perCards = effects.discardCritPerCards || 0;
        const perStep = effects.discardCritPerStep || 0;
        const maxCrit = effects.maxDiscardCritChance || 0;
        if (!perCards || !perStep || !maxCrit) return;

        const oldCrit = this.gameState.discardCritChance || 0;
        const steps = Math.floor(this.gameState.discardedCardsThisRun / perCards);
        const newCrit = Math.min(maxCrit, steps * perStep);
        this.gameState.discardCritChance = newCrit;

        if (newCrit > oldCrit) {
            const percent = Math.round(newCrit * 100);
            this.createFloatingText(x, y - 18, `Crit ${percent}%`, 0xffd700);
        }
    }
    
    updatePlayerEffectsUI() {
        this.playerEffectsUIGroup.clear(true, true);

        // Build a unified list of effects to display (debuffs + buffs + relic counters)
        const entries = [];

        // --- Debuffs / status effects from playerEffects array ---
        this.gameState.playerEffects.forEach((effect) => {
            switch (effect.type) {
                case 'poison':
                    entries.push({ text: `Poison (${effect.turns} turns)`, color: '#66ff66' });
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
    }

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
    }

    capitalizeEffect(value) {
        const text = (value || '').toString();
        return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
    }
    
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
    }
    
    pauseGame() {
        // Don't allow pausing during transitions or game over
        if (this._transitioning || this.gameState.playerHealth <= 0) return;
        
        // Pause the current scene
        this.scene.pause();
        
        // Launch the pause menu scene
        this.scene.launch('PauseMenuScene', { pausedScene: 'GameScene' });
    }
    
    // Save current run method
    saveCurrentRun() {
        if (this.saveManager) {
            const saved = this.saveManager.saveCurrentRun(
                this.gameState,
                this.inventorySystem,
                this.cardSystem
            );
            
            if (saved) {
                this.createFloatingText(570, 320, 'Game Saved', 0x00ff00);
            }
        }
    }
    
    // Load current run method
    loadCurrentRun() {
        if (!this.saveManager) return false;
        const runData = this.saveManager.loadCurrentRun();
        if (!runData) return false;
        // Player stats
        this.gameState.playerHealth = runData.player.health;
        this.gameState.maxHealth = runData.player.maxHealth;
        this.gameState.actionsLeft = runData.player.actionsLeft;
        this.gameState.maxActions = runData.player.maxActions;
        this.gameState.coins = runData.player.coins;
        this.gameState.crystals = runData.player.crystals;
        this.gameState.currentFloor = runData.player.currentFloor;
        this.gameState.bonusInventorySlots = runData.player.bonusInventorySlots;
        this.gameState.firstActionUsed = runData.player.firstActionUsed;
        this.gameState.baseMaxHealth = runData.player.baseMaxHealth;
        this.gameState.bottomlessBagApplied = runData.player.bottomlessBagApplied;
        this.gameState.discardedCardsThisRun = runData.player.discardedCardsThisRun || 0;
        this.gameState.discardCritChance = runData.player.discardCritChance || 0;
        this.gameState.journalBonusHP = runData.player.journalBonusHP || 0;
        this.gameState.mapBonusAP = runData.player.mapBonusAP || 0;
        this.gameState.mapFloorCount = runData.player.mapFloorCount || 0;
        // Equipment
        this.gameState.equippedWeapon = runData.equipment.equippedWeapon;
        this.gameState.equippedArmor = runData.equipment.equippedArmor;
        // Effects (properly restore objects)
        this.gameState.activeAmulets = runData.effects.activeAmulets;
        this.gameState.playerEffects = runData.effects.playerEffects;
        this.gameState.shadowBlade = runData.effects.shadowBlade;
        this.gameState.magicShield = runData.effects.magicShield;
        this.gameState.boneWall = runData.effects.boneWall;
        this.gameState.mirrorShield = runData.effects.mirrorShield;
        this.gameState.blockNextAttack = runData.effects.blockNextAttack;
        // Damage tracking
        this.gameState.damageTracking = runData.damageTracking;
        this.gameState.companionHistory = runData.companions?.history || {};
        this.gameState.companionRoomParticipants = runData.companions?.roomParticipants || {};
        // Story consequence state
        if (runData.story?.storyRun) {
            this.gameState.storyRun = runData.story.storyRun;
        }
        if (runData.story?.heroMemory) {
            const storedHeroMemory = loadHeroMemory() || {};
            this.gameState.heroMemory = {
                ...this.gameState.heroMemory,
                ...runData.story.heroMemory
            };
            Object.keys(this.gameState.heroMemory).forEach(key => {
                this.gameState.heroMemory[key] = Boolean(
                    this.gameState.heroMemory[key] || storedHeroMemory[key]
                );
            });
        }
        // Keep the numerical floor and map position as one saved unit. Older
        // saves only had currentFloor, which could resume at Floor 6 with a
        // freshly generated Act 1 map cursor at its start node.
        if (runData.navigation) {
            this.gameState.roomType = runData.navigation.roomType || 'COMBAT';
            this.gameState.mapCursor = runData.navigation.mapCursor || null;
            this.gameState.dungeonMap = runData.navigation.dungeonMap || null;
            this.gameState.pendingActShop = runData.navigation.pendingActShop || null;
            this.roomType = this.gameState.roomType;
        }
        this._loadedBoardCards = Array.isArray(runData.board?.cards)
            ? runData.board.cards
            : [];
        this._loadedBoardLayout = runData.board?.layout || null;
        this._loadedEnemiesCleared = !!runData.board?.enemiesCleared;
        this._loadedBoardAvailable = this._loadedBoardCards.some(Boolean)
            || this._loadedEnemiesCleared;
        // Inventory
        if (this.inventorySystem && runData.equipment.inventory) {
            this.inventorySystem.slots = runData.equipment.inventory;
            this.gameState.inventory = this.inventorySystem.slots;
            this.inventorySystem.createInventoryUI();
            this.inventorySystem.rebuildInventorySprites();
        }
        // A loaded run already contains its starter swords in the saved
        // inventory — never re-grant them on Continue/resume/restart.
        this.gameState.startingCardsGranted = true;
        // Re-apply relic effects on top of loaded state
        if (this.metaManager) {
            this.metaManager.applyRelicEffects(this.gameState, false);
        }
        return true;
    }
    
    updateRoomTitle() {
        if (!this.roomTitle) return;
        let title = 'Combat Room';
        if (this.roomType === 'ELITE') title = 'Elite Combat';
        if (this.roomType === 'BOSS') title = 'Boss Fight';
        if (this.roomType === 'BOSS_REWARD') title = 'Victory Spoils';
        this.roomTitle.setText(title);
    }
    
    shutdown() {
        this.tutorialManager?.destroy?.();
        this.tutorialManager = null;
        this.stopBossMusic();
        this.clearEnemyTurnTimers();
        this.clearFloatingTexts();
        this.input.keyboard.off('keydown-ESC');
        this.events.off('endPlayerTurn');  // Unbind to avoid doubles
        this.events.off('wake', this.wake, this);
        this._turnHandlersBound = false;
    }
    wake(sys, data) {
        // A lethal hit schedules gameOver() via delayedCall (gameState.takeDamage);
        // that timer pauses while the scene sleeps and fires right after wake.
        // Don't rebuild combat state underneath the pending death screen —
        // EventScene deaths also wake us first and then call gameOver() directly.
        if (this.gameState?.playerHealth <= 0) return;

        // Always sync inventory on wake
        if (this.inventorySystem) {
            this.inventorySystem.slots = this.gameState.inventory || this.inventorySystem.slots;
            this.gameState.inventory = this.inventorySystem.slots;
            this.inventorySystem.rebuildInventorySprites();
            this.inventorySystem.setVisibility(true);
        }
        if (data?.shopStation) {
            // Arriving at the shop completes the floor-clear transition. Clear the
            // flag or pauseGame()/ESC stay dead here (they bail while _transitioning
            // is true) — the reported "pause button does nothing in the shop" bug.
            this._transitioning = false;
            this.inventorySystem?.setStationMode(true);
            // Clear the previous floor's cards so they don't bleed through the shop UI.
            this.cardSystem?.clearBoard?.();
            // Also hide the room title (it would still say "Combat Room" from the prior floor).
            if (this.roomTitle) this.roomTitle.setText('');
            // The shop is a station inside the combat scene, so roomType is still
            // 'COMBAT' here — hide the fight log explicitly.
            this.setCombatLogVisible(false);
            this.updateUI();
            return;
        }

        // A sleeping scene can strand station/turn state when an event, shop,
        // map transition, or companion timer stops before its cleanup callback.
        // Normal gameplay wake-ups must always start from an interactive combat
        // state or every weapon/spell drop silently bounces out of useAction().
        this.clearEnemyTurnTimers();
        this.inventorySystem?.setDragOverlayScene?.(null);
        this.inventorySystem?.clearDropZones?.();
        this.inventorySystem?.setStationMode(false);

        // Restore current room type from gameState
        this.roomType = this.gameState.roomType || 'COMBAT';
        this.updateRoomTitle();
        // Show the log for combat rooms, hide it when we wake into loot/reward
        // rooms; startNewFloor() below re-clears it only for genuinely new fights.
        this.refreshCombatLogVisibility();
        // Resume/stop boss drums to match the room we woke into (startBossMusic
        // guards against double-play if startNewFloor also fires below).
        if (this.roomType === 'BOSS') this.startBossMusic(); else this.stopBossMusic();

        // Check if this is actually a new floor/room transition
        const isNewRoom = data?.isNewRoom || false;
        
        if (['COMBAT', 'ELITE', 'BOSS'].includes(this.roomType)) {
            // Check if we need to spawn new enemies.
            const hasEnemies = this.cardSystem.boardCards &&
                this.cardSystem.boardCards.some(c => this.isEnemyCard(c));

            if (!hasEnemies || isNewRoom) {
                this.startNewFloor();
            } else {
                this.updateUI(); // Refresh UI without spawning
                // Defensive: if the board genuinely has no live enemies on
                // wake (e.g. we returned from a non-combat scene mid-room
                // with everything already dead), make sure the Next button
                // surfaces instead of leaving the player stuck.
                this.cardSystem.checkFloorClear?.();
            }
        }
    }
}

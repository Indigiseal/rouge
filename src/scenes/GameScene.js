import { CardSystem } from '../systems/CardSystem.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { GameState, PLAYER_START_HP } from '../systems/GameState.js';
import { AmuletManager } from '../managers/AmuletManager.js';
import { MusicManager } from '../audio/MusicManager.js';
import { SoundHelper } from '../audio/SoundHelper.js';
import { SaveManager } from '../managers/SaveManager.js';
import { MetaProgressionManager } from '../managers/MetaProgressionManager.js';
import { TutorialManager } from '../managers/TutorialManager.js';
import { CombatHud } from '../ui/CombatHud.js';
import {
    showDefeatFallback as showDefeatFallbackOverlay,
    addResultPanel as addResultPanelOverlay,
    addResultButton as addResultButtonOverlay,
    showDefeatResult as showDefeatResultOverlay,
    addRelicIcon as addRelicIconOverlay,
    createUnlockParticles as createUnlockParticlesOverlay,
    gameWon as showVictoryResult,
} from '../ui/RunResultOverlay.js';
import {
    setupBossRewardRoom as setupBossRewardRoomUi,
    restoreSavedBossRewardRoom as restoreSavedBossRewardRoomUi,
    makeBossRewardGem as makeBossRewardGemUi,
    leaveBossRewardRoom as leaveBossRewardRoomUi,
} from '../ui/BossRewardRoom.js';
import { t } from '../i18n/i18n.js';
import { loadHeroMemory, loadStoryProgress, saveHeroMemory } from '../content/story/StoryProgress.js';
import { isMetaProgressionDisabled } from '../config/TestOptions.js';
import { loadVolumeSettings, saveVolumeSettings } from '../audio/VolumeSettings.js';
import { CombatTurnController } from '../systems/combat/CombatTurnController.js';
import {
    applySandboxLoadout,
    exitToSandboxHub,
    getSandboxEncounter,
    isSandboxMode,
} from '../sandbox/SandboxMode.js';

export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this._transitioning = false;
        this.skipNextEnemyAttack = false;
        this.combatTurns = new CombatTurnController(this);
    }

    get isEnemyTurn() {
        return this.combatTurns?.isEnemyTurn ?? false;
    }

    set isEnemyTurn(value) {
        if (this.combatTurns) this.combatTurns.isEnemyTurn = value;
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
        // Test polygon: forced single encounter, then back to the hub.
        this.sandboxMode = Boolean(data.sandbox);
        this.sandboxRoom = data.sandboxRoom || null;
        if (this.sandboxMode) this.shouldLoadSave = false;
        this._transitioning = false;
        this._resultScreenShown = false;
        this._gameOverInProgress = false;
        // Reset per-scene-entry so a cleared-room restore flag can't leak into
        // the next run (Phaser reuses the GameScene instance across runs).
        this._floorEndAlreadyProcessed = false;
        this.events.off('endPlayerTurn');
        this.events.off('wake', this.wake, this);
        this.combatTurns?.resetBinding?.();
        
        if (this.shouldLoadSave) {
            // Load existing run
            this.gameState = new GameState(this);
            // Load will happen in create() after systems are initialized
            this.shouldLoadSave = true;
        } else {
            // New run
            this.gameState = new GameState(this);
            this.gameState.characterId = data.characterId || 'rogue';
            // Apply talent effects to fresh game state (skip for the tutorial so
            // its rigged board is deterministic).
            if (!this.tutorialMode && !this.sandboxMode && !isMetaProgressionDisabled()) {
                const opts = {};
                if (data.armorerArmorType === 'chain' || data.armorerArmorType === 'plate') {
                    opts.armorerArmorType = data.armorerArmorType;
                }
                this.metaManager.applyRelicEffects(this.gameState, true, opts);
            }
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
        this.roomType = data.roomType || (this.sandboxMode && this.sandboxRoom) || 'COMBAT';
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

        if (this.sandboxMode && this.sandboxRoom) {
            this.bootSandboxEncounter();
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

    bootSandboxEncounter() {
        this.gameState.sandboxMode = true;
        const encounter = getSandboxEncounter(this.sandboxRoom);
        applySandboxLoadout(this, this.sandboxRoom);

        if (this.sandboxRoom === 'BOSS_REWARD') {
            this.setupBossRewardRoom();
            this.updateRoomTitle();
            return;
        }

        if (encounter?.kind === 'station' && encounter.sceneKey) {
            const roomType = this.sandboxRoom.startsWith('TREASURE')
                ? (this.sandboxRoom === 'TREASURE_GOOD' ? 'TREASURE_GOOD' : 'TREASURE')
                : this.sandboxRoom;
            this.gameState.roomType = roomType;
            this.roomType = roomType;
            this.scene.sleep();
            const payload = { gameState: this.gameState };
            if (encounter.rewardMode) payload.rewardMode = encounter.rewardMode;
            this.scene.launch(encounter.sceneKey, payload);
            return;
        }

        this.gameState.roomType = this.sandboxRoom;
        this.roomType = this.sandboxRoom;
        this.startNewFloor();
        this.updateRoomTitle();
    }

    leaveSandboxOrMenu() {
        if (this.sandboxMode || isSandboxMode(this)) {
            exitToSandboxHub(this);
            return;
        }
        this.scene.start('MainMenuScene');
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

    startNewFloor() {
        this.clearEnemyTurnTimers();
        this.clearFloatingTexts();
        // Fresh combat floor reached (restores bypass startNewFloor()).
        SoundHelper.playVariant(this, 'new_level', 0.5);
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
        this.gameState.playerHealth = Math.max(1, Math.floor(this.gameState.playerHealth || PLAYER_START_HP));  // Sanitize HP
        this.gameState.maxHealth = Math.max(1, Math.floor(this.gameState.maxHealth || PLAYER_START_HP));
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
        this.amuletManager?.processFloorStart?.();
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

    bindEnemyTurnHandler() {
        this.combatTurns.bindEnemyTurnHandler();
    }

    useAction() {
        if (this.isEnemyTurn) return false;

        // Check if player is already exhausted BEFORE consuming the action
        const wasExhausted = this.gameState.actionsLeft <= 0;
        
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
        if (wasExhausted && actionConsumed) {
            // Just show weakened state, no damage. Empty stomach = out of energy.
            this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y, 'Weakened!', 0xff6600);
        }
        
        // Consume action point if not a free action and player has AP
        if (actionConsumed && this.gameState.actionsLeft > 0) {
            this.gameState.actionsLeft--;
            if (this.gameState.actionsLeft <= 0) {
                SoundHelper.playVariant(this, 'empty_stomach', 0.5);
            }
        }
        
        this.updateUI();
        // After any action, emit one enemy turn. Extra clicks before it fires should not stack turns.
        this.scheduleEnemyTurn();
        
        return true; // Always return true to allow actions
    }

    scheduleEnemyTurn() {
        this.combatTurns.scheduleEnemyTurn();
    }

    hasCombatStalemate() {
        return this.combatTurns.hasCombatStalemate();
    }

    queueStalemateEnemyTurn() {
        this.combatTurns.queueStalemateEnemyTurn();
    }

    _drainEnemyTurns() {
        this.combatTurns._drainEnemyTurns();
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
        this.combatTurns.runEnemyTurn();
    }

    clearEnemyTurnTimers() {
        this.combatTurns.clearEnemyTurnTimers();
    }

    isEnemyCard(card) {
        return !!this.cardSystem?.isEnemyType(card?.data?.type);
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
            SoundHelper.playVariant(this, 'player_hurt', 0.5);
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
        SoundHelper.playVariant(this, 'hero_death', 0.6);
        this.stopBossMusic();
        this.clearEnemyTurnTimers();
        this.nextFloorButton?.disableInteractive();

        const killedBy = this.killedBy || 'Unknown Enemy';
        const floor = this.gameState?.currentFloor ?? 1;
        let deathStats = { killedBy, floor };
        let xpResult = null;

        try {
            deathStats = this.gameState.getDeathStats();
            deathStats.killedBy = killedBy;
            deathStats.floor = floor;

            this.unlockChickForRareShopAfterDeath();
            this.unlockSkeletonForRareShopAfterDeath();
            if (!this.sandboxMode) this.saveManager?.clearCurrentRun();

            if (!this.sandboxMode && this.metaManager && !isMetaProgressionDisabled()) {
                this.metaManager.totalRuns++;
                if (floor > this.metaManager.bestFloor) {
                    this.metaManager.bestFloor = floor;
                }
                // Carry an unhatched egg to the next run (consumed at run start).
                const hasEgg = (this.gameState.inventory || []).some(
                    item => item?.id === 'monsterEgg' || item?.name === 'Egg'
                );
                this.metaManager.setPendingEgg(hasEgg);
                const characterId = this.gameState.characterId || 'rogue';
                xpResult = this.metaManager.handlePlayerDeath(killedBy, floor, characterId);
            }
        } catch (error) {
            // Death UI is critical. Meta/save failures must never strand the run
            // at zero health with no way back to the main menu.
            console.error('Failed to finish death bookkeeping:', error);
        }

        try {
            this.showDefeatResult(deathStats, xpResult);
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
        return showDefeatFallbackOverlay(this, deathStats);
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
        return addResultPanelOverlay(this, x, y, width, height, frame, depth);
    }

    addResultButton(x, y, label, onClick, depth) {
        return addResultButtonOverlay(this, x, y, label, onClick, depth);
    }

    showDefeatResult(deathStats, xpResult) {
        return showDefeatResultOverlay(this, deathStats, xpResult);
    }

    addRelicIcon(relic, x, y, depth) {
        return addRelicIconOverlay(this, relic, x, y, depth);
    }

    createUnlockParticles(depth = 11002) {
        return createUnlockParticlesOverlay(this, depth);
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
        // Hard-disable AND hide the button so it can't be clicked again — and so
        // the label and its skin vanish together, not just the "Next" text.
        if (this.nextFloorButton) {
            this.nextFloorButton.disableInteractive();
            this.nextFloorButton.setVisible(false);
        }
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

        // Test polygon: after a fight (or boss reward leave), return to the hub.
        // Elite still opens its chest first; TreasureScene exits back to the hub.
        if (this.sandboxMode) {
            const bossFloors = [15, 30, 45];
            const completedActBoss =
                bossFloors.includes(this.gameState.currentFloor) ||
                this.gameState.roomType === 'BOSS';
            if (completedActBoss) {
                this.time.delayedCall(700, () => this.setupBossRewardRoom());
                return;
            }
            this.time.delayedCall(500, () => {
                this.scene.sleep();
                if (rewardChestMode) {
                    this.scene.launch('TreasureScene', {
                        gameState: this.gameState,
                        rewardMode: rewardChestMode,
                    });
                } else {
                    exitToSandboxHub(this);
                }
            });
            return;
        }

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
        return setupBossRewardRoomUi(this);
    }

    restoreSavedBossRewardRoom() {
        return restoreSavedBossRewardRoomUi(this);
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
        return makeBossRewardGemUi(this);
    }

    leaveBossRewardRoom() {
        return leaveBossRewardRoomUi(this);
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
        const floor = this.gameState.currentFloor;
        const isBossFloor = [15, 30, 45].includes(floor);
        if (this.roomType === 'BOSS' || this.gameState.roomType === 'BOSS' || isBossFloor) {
            this.stopBossMusic();
        }
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
        return showVictoryResult(this);
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
        if (this.sandboxMode) return;
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
        this.gameState.characterId = runData.player.characterId || 'rogue';
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
        if (this.metaManager && !isMetaProgressionDisabled()) {
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
        this.combatTurns?.resetBinding?.();
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

Object.assign(GameScene.prototype, CombatHud);

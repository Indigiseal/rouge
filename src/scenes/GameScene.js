import { CardSystem } from '../systems/CardSystem.js';
import { applyOverlayLight } from '../ui/OverlayLightPipeline.js';
import { CombatFeedback } from '../ui/CombatFeedback.js';
import { playBossVictoryParticles } from '../ui/BossVictoryParticles.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { GameState, PLAYER_START_HP } from '../systems/GameState.js';
import { AmuletManager } from '../managers/AmuletManager.js';
import { MusicManager } from '../audio/MusicManager.js';
import { SoundHelper } from '../audio/SoundHelper.js';
import { ensureDoorOpenAnim, isLocationDoorTexture, locationDoorArt } from '../content/assets/locationCards.js';
// Where the way out stands: the Next plate, the open door, and the shut door
// that waits there during the fight all share this spot.
// Every other room's door stands here too (ui/ExitDoor.js).
const NEXT_EXIT_X = EXIT_DOOR_X;
const NEXT_EXIT_Y = EXIT_DOOR_Y;
// Pause between the killing blow's last sound starting and the door opening,
// so the death is heard as its own event before the room announces it's clear.
const ROOM_CLEAR_ANNOUNCE_PAD_MS = 200;
// Let the boss fanfare play before the normal reward/victory handoff.
const BOSS_FANFARE_DELAY_MS = 1500;
// Must match the event screen's dim (EventScene create), so where the dim ends
// the backdrop carries on in the same colour.
const EVENT_BACKDROP_COLOR = 0x2b1f32;
import { getLocationIdForFloor } from '../content/locations/index.js';
import { locationIdsForRunStart, queueLocationAssets } from '../content/assets/locationAssets.js';
import { fightBackdropKey, TOP_PINNED_BACKGROUNDS } from '../content/locations/fightBackgrounds.js';
import { DEV_START_AMULETS, DEV_START_CARDS, devToolsEnabled } from '../config/DevTools.js';
import { SaveManager } from '../managers/SaveManager.js';
import { MetaProgressionManager } from '../managers/MetaProgressionManager.js';
import { TutorialManager } from '../managers/TutorialManager.js';
import { CombatHud } from '../ui/CombatHud.js';
import { setHoverLight } from '../ui/HoverLight.js';
import { EXIT_DOOR_X, EXIT_DOOR_Y } from '../ui/ExitDoor.js';
import { scaleGoldReward } from '../content/economy/gold.js';
import { normalizeCharacterId } from '../content/characters/CharacterClasses.js';
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
import { t, translateItemName } from '../i18n/i18n.js';
import { loadHeroMemory, loadStoryProgress, saveHeroMemory } from '../content/story/StoryProgress.js';
import { createDefaultStoryRun } from '../content/story/StoryDefaults.js';
import { ROBBER_SATCHEL_AMULET } from '../content/cards/robbers.js';
import { onBossRow } from '../map/MapGenerator.js';
import { flyAmuletToBar } from '../ui/RewardFlight.js';
import { playCrowFlyby, CROW_TOP_Y } from '../ui/CrowFlyby.js';
import { areAmuletsDisabled } from '../config/TestOptions.js';
import { loadVolumeSettings, saveVolumeSettings } from '../audio/VolumeSettings.js';
import { CombatTurnController } from '../systems/combat/CombatTurnController.js';
import { CombatSequencer } from '../systems/combat/CombatSequencer.js';
import { installStatusOverlays } from '../systems/combat/StatusOverlay.js';
import { applyLocationChoice, emptyActLocationIds, normalizeActLocationIds, normalizeLocationOffers } from '../content/locations/index.js';
import { HEALER_RARITIES, healerRarityForRank } from '../content/village/index.js';
import { openAmuletChoiceOverlay } from '../ui/AmuletChoiceOverlay.js';
import {
    applySandboxLoadout,
    applySandboxStorySetup,
    exitToSandboxHub,
    getSandboxEncounter,
    isSandboxMode,
} from '../sandbox/SandboxMode.js';
import { humanRunRecorder, recordHumanRunEvent } from '../systems/HumanRunRecorder.js';
import { openNoticeModal } from '../ui/ConfirmModal.js';
import { isSilkCocoonCacheRoom, boardHasOpenCocoonEnemies } from '../systems/board/CocoonCacheBoard.js';
import { playSmokeBurst, SMOKE_BURST_MS } from '../ui/SmokeBurst.js';
import { pendingLocationAftermath } from '../content/locations/index.js';
import { canOfferSigil, offerableSigils } from '../ui/SigilOffer.js';
import { SIGIL_ROOM_CHANCE, SIGIL_ROOM_CHANCE_BROOCH } from '../content/sigils/sigilStamps.js';
import { createCrystalLairEnemies } from '../content/cards/crystalLair.js';
import { EGG_HATCH_ROOMS, eggFightsLeft, isHatchingEgg } from '../content/cards/eggHatching.js';
import { CardDataGenerator } from '../systems/loot/CardDataGenerator.js';
import { applyStars } from '../content/cards/legendaryStars.js';
import { createArmorCardData, createWeaponCardData } from '../content/cards/index.js';
import { COMPANION_POWER_UP_STAGGER_MS, playCompanionPowerUp } from '../ui/CompanionPowerUp.js';

// The Crystal Lair's reward when no card can take its sigil.
const CRYSTAL_LAIR_FALLBACK_CRYSTALS = 3;

// Rooms that play the battle loop (boss rooms have their own drums).
const FIGHT_ROOM_TYPES = new Set(['COMBAT', 'ELITE']);
// The battle loop's track, or null for none. Off while a track that fits is
// found: normal and elite fights then play nothing of their own, as before
// the loop was added. Set it back to 'battle_music' (and restore that entry in
// DEFERRED_AUDIO) to turn it on.
const BATTLE_MUSIC_KEY = null;
// Under the boss drums' 0.6: the loop runs every fight and sits beneath the
// combat sounds rather than with them.
const BATTLE_MUSIC_VOLUME = 0.45;

// The pause between clicking a cleared room's door and the next screen.
const LEAVE_ROOM_DELAY_MS = 150;

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

    // The current location's painting and boards are not in the boot manifest:
    // load them before create() runs (content/assets/locationAssets.js).
    preload() {
        const data = this._startData || {};
        const saved = data.loadSave && !data.tutorial && !data.sandbox ? this.saveManager?.loadCurrentRun?.() : null;
        this.load.setCORS('anonymous');
        queueLocationAssets(this, locationIdsForRunStart(data, saved, getLocationIdForFloor));
    }

    init(data = {}) {
        this._startData = data;
        this._stationBackdropFloor = null;
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
        // Test Site: forced single encounter, then back to the hub.
        this.sandboxMode = Boolean(data.sandbox);
        this.sandboxRoom = data.sandboxRoom || null;
        // The location a Test Site fight happens in; without one it is the first act's default.
        this.sandboxLocation = data.sandboxLocation || null;
        // A specific story picked from the Test Site, rather than whichever one
        // the story rules would have served next.
        this.sandboxEventId = data.sandboxEventId || null;
        this.sandboxStorySetupId = data.sandboxStorySetupId || this.sandboxEventId;
        if (this.sandboxMode) this.shouldLoadSave = false;
        this._transitioning = false;
        this._bossVictoryPending = false;
        this._resultScreenShown = false;
        this._gameOverInProgress = false;
        this._pauseRequested = false;
        this._pauseWaitTimer = null;
        // Reset per-scene-entry so a cleared-room restore flag can't leak into
        // the next run (Phaser reuses the GameScene instance across runs).
        this._floorEndAlreadyProcessed = false;
        this._roomClearRewarded = false;
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
            this.gameState.characterId = normalizeCharacterId(data.characterId);
            this.gameState.actLocationIds = emptyActLocationIds();
            this.gameState.locationOffers = normalizeLocationOffers(data.locationOffers);
            this.gameState.calendarMonthIndex = 0;
            if (this.tutorialMode || this.sandboxMode) {
              applyLocationChoice(this.gameState, 'thornwake');
            } else if (data.locationId) {
              applyLocationChoice(this.gameState, data.locationId);
            }
            // Village buildings always apply. Talent tree is live-off (flag).
            if (!this.tutorialMode && !this.sandboxMode) {
                const opts = {};
                if (data.armorerArmorType === 'chain' || data.armorerArmorType === 'plate') {
                    opts.armorerArmorType = data.armorerArmorType;
                }
                this.metaManager.applyRelicEffects(this.gameState, true, opts);
            }
            // Every story can come back in a new run (Taya): a fresh run starts
            // from fresh story state, so the Music Box, the Porter, the
            // carnival and the rest are all there to meet again. What a past
            // life learned is kept in heroMemory, not here. The story saved by
            // the last run is read only for the two shop unlocks older profiles
            // recorded in it (below). Continues restore storyRun from the run
            // save instead; the Test Site never reads it.
            const storedStory = this.sandboxMode ? null : loadStoryProgress();
            this._legacyStoryUnlocks = {
                chick: Boolean(storedStory?.chickHatched),
                skeleton: Boolean(storedStory?.skeletonCompanionObtained),
            };
            this.gameState.storyRun = createDefaultStoryRun();
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
        if ((this.gameState.storyRun?.chickHatched || this._legacyStoryUnlocks?.chick)
            && !this.gameState.heroMemory.chickRareShopUnlocked) {
            this.gameState.heroMemory.chickRareShopUnlocked = true;
            saveHeroMemory(this.gameState.heroMemory);
        }
        if ((this.gameState.storyRun?.skeletonCompanionObtained || this._legacyStoryUnlocks?.skeleton)
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
        // LocationPick / Village sit after GameScene in the scene list.
        // Phaser InputManager is globalTopOnly: if those scenes are still
        // running, their cards swallow pointerup and the weapon never gets
        // dragend (same bug as the EventScene glass cases).
        this.stopScenesAboveCombat({ keepMap: true });
        // Load saved volume settings. Master volume is kept internally at 1;
        // players adjust Music and Sound Effects directly.
        this.game.globalVolume = loadVolumeSettings();
        saveVolumeSettings(this.game.globalVolume);
        
        // Apply volume settings
        this.sound.volume = this.game.globalVolume.master;
        
        // Create tiled stone background
        this.createBackground();

        // Warm light sheet over the whole frame, in Aseprite's Overlay mode.
        // A camera post-process, so it covers the board, the cards, the HUD
        // and the bag together rather than needing to out-depth them.
        applyOverlayLight(this);
        
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
        } else if (!this.tutorialMode && !this.sandboxMode && this.metaManager
            && !this.gameState.villageEffects) {
            this.metaManager.applyVillageEffects(this.gameState, false);
        }
        
        // Create UI
        this.createUI();
        // Effect colours over enemies and the hero (poisoned, charmed, shocked).
        installStatusOverlays(this);
        
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

        this.stopScenesAboveCombat({ keepMap: false });

        if (this.sandboxMode && this.sandboxRoom) {
            this.bootSandboxEncounter();
            return;
        }
        
        // Start or restore the room. Boss rewards are already paid before the
        // player can pause; rebuilding them via setupBossRewardRoom() would pay
        // the currency twice, so restore only the still-unclaimed saved cards.
        if (this.shouldLoadSave && this.gameState.roomType === 'BOSS_REWARD') {
            // Migration for saves already stranded in the reward room by the
            // old profile-wide "seen" guard: show the missing scene first, then
            // restore these exact reward cards without paying currency twice.
            const aftermath = pendingLocationAftermath(this.gameState);
            if (aftermath) {
                this._restoreBossRewardAfterNarrative = true;
                this.scene.sleep();
                this.scene.launch(aftermath.sceneKey, { gameState: this.gameState });
            } else {
                this.restoreSavedBossRewardRoom();
            }
        } else if (this.shouldLoadSave && this._loadedBoardAvailable) {
            this.restoreSavedCombatRoom();
        } else {
            this.startNewFloor();
            this.grantDevStartAmulets();
            this.grantDevStartCards();
            this.offerHealerAmuletIfNeeded();
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
        // A boss picked by location: the first act takes that road, so its boss,
        // board and background are the ones fought.
        if (this.sandboxLocation) {
            this.gameState.actLocationIds = emptyActLocationIds();
            this.gameState.actLocationIds[0] = this.sandboxLocation;
            this.gameState.pinCalendarMonth = false;
        }

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
            if (this.sandboxEventId) {
                // Seed whatever this story needs before it opens — a recovered
                // cog, an egg, a companion with service behind it.
                applySandboxStorySetup(this, this.sandboxStorySetupId);
                payload.forcedEventId = this.sandboxEventId;
            }
            this.scene.launch(encounter.sceneKey, payload);
            return;
        }

        // The Crystal Lair is an ordinary fight room with its own board.
        if (this.sandboxRoom === 'CRYSTAL_LAIR') {
            this.gameState.storyRun = this.gameState.storyRun || {};
            this.gameState.storyRun.crystalLairCleared = false;
            this.gameState.pendingAmbush = {
                id: 'crystal_lair',
                enemies: createCrystalLairEnemies(this.gameState.currentFloor || 8),
            };
            this.gameState.roomType = 'COMBAT';
            this.roomType = 'COMBAT';
            this.startNewFloor();
            this.updateRoomTitle();
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
        // The rainbow sweep for starred Legendaries: the sheet's second row.
        if (!this.anims.exists('hover_cards_rainbow_anim')
            && (this.textures.get('hoverCardsUpSheet')?.frameTotal || 0) > 10) this.anims.create({
            key: 'hover_cards_rainbow_anim',
            frames: this.anims.generateFrameNumbers('hoverCardsUpSheet', { start: 5, end: 9 }),
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
        // The player's-card dissolve, at the enemy one's speed.
        if (this.textures.exists('cardBreakSheet') && !this.anims.exists('card_break_anim')) this.anims.create({
            key: 'card_break_anim',
            frames: this.anims.generateFrameNumbers('cardBreakSheet', { start: 0, end: 5 }),
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
        this._eventBackdropOn = false;
        const background = this.add.image(320, 180, 'stoneFloor');
        background.setDisplaySize(640, 360);
        background.setOrigin(0.5, 0.5);
        // Under the board frame and top HUD (month / floor / pause).
        background.setDepth(-10);
        this.backgroundImage = background;
        this.refreshFightBackground();
    }

    refreshFightBackground(roomType = this.roomType) {
        if (!this.backgroundImage?.scene) return;
        const backdropState = Number.isFinite(this._stationBackdropFloor)
            ? { ...this.gameState, currentFloor: this._stationBackdropFloor }
            : this.gameState;
        const key = fightBackdropKey(backdropState, roomType);
        // dungeon.png is the foreground frame; its transparent centre reveals
        // the location painting beneath it.
        this.backgroundImage.setTexture('stoneFloor');
        const show = key !== 'stoneFloor' && this.textures.exists(key);
        if (show && !this.fightBackgroundImage?.scene) {
            this.fightBackgroundImage = this.add.image(320, 180, key)
                .setOrigin(0.5).setScale(1).setDepth(-11);
        }
        if (show) {
            this.fightBackgroundImage.setTexture(key).setScale(1);
            // Top-pinned paintings hang from the top of the screen.
            const pinned = TOP_PINNED_BACKGROUNDS.has(key);
            this.fightBackgroundImage.setOrigin(0.5, pinned ? 0 : 0.5);
            this.fightBackgroundImage.x = 320;
            this.fightBackgroundImage.y = pinned ? 0 : 180;
        }
        this.fightBackgroundImage?.setVisible(show);
    }

    // Events keep a location's illustration visible beneath their panels.
    // Locations awaiting art retain the flat event backdrop and bag footer.
    setEventBackdrop(on) {
        this._eventBackdropOn = on;
        const key = fightBackdropKey(this.gameState, this.roomType);
        const hasLocationArt = key !== 'stoneFloor' && this.textures.exists(key);
        const useFlatBackdrop = on && !hasLocationArt;
        if (useFlatBackdrop && !this.eventBackdrop?.scene) {
            this.eventBackdrop = this.add.rectangle(320, 180, 640, 360, EVENT_BACKDROP_COLOR)
                .setDepth(-9);
            this.underInventoryPanel = this.textures.exists('panelUnderInventory')
                ? this.add.image(320, 360, 'panelUnderInventory').setOrigin(0.5, 1).setDepth(-8)
                : null;
        }
        this.eventBackdrop?.setVisible(useFlatBackdrop);
        this.underInventoryPanel?.setVisible(useFlatBackdrop);
        this.backgroundImage?.setVisible(!useFlatBackdrop);
        this.refreshFightBackground();
    }

    stopScenesAboveCombat({ keepMap = false } = {}) {
        const keep = new Set(['GameScene', 'PreloadScene']);
        if (keepMap) keep.add('MapViewScene');
        this.game.scene.getScenes(false).forEach((scene) => {
            const key = scene.sys.settings.key;
            if (keep.has(key)) return;
            // INIT scenes still canInput() in Phaser 3.70. A leftover
            // LocationPick card list would swallow pointerup over the board.
            if (scene.input) scene.input.enabled = false;
            if (scene.sys.isActive() || scene.sys.isSleeping()) {
                this.scene.stop(key);
            }
        });
    }

    // Developer mode: a new run starts wearing DEV_START_AMULETS.
    grantDevStartAmulets() {
        if (!devToolsEnabled() || this.shouldLoadSave || this.tutorialMode || this.sandboxMode) return;
        if (areAmuletsDisabled()) return;
        DEV_START_AMULETS.forEach((id) => {
            if (!this.amuletManager?.hasAmulet?.(id)) this.amuletManager?.addAmulet?.(id);
        });
        this.updateAmuletsUI?.();
    }

    // Developer mode: a new run starts with DEV_START_CARDS in the bag.
    grantDevStartCards() {
        if (!devToolsEnabled() || this.shouldLoadSave || this.tutorialMode || this.sandboxMode) return;
        DEV_START_CARDS.forEach(({ type, kind, stars }) => {
            const card = type === 'armor'
                ? createArmorCardData(kind, 'legendary')
                : createWeaponCardData(kind, 'legendary');
            if (!card) return;
            applyStars(card, stars);
            this.inventorySystem?.addCard?.(card);
        });
    }

    offerHealerAmuletIfNeeded() {
        if (this.shouldLoadSave || this.tutorialMode || this.sandboxMode) return;
        if (areAmuletsDisabled()) return;
        const rank = this.gameState?.talentEffects?.healerRank || 0;
        const rolled = healerRarityForRank(rank);
        if (!rolled) return;
        // The rarity is a roll now, so it can land on a tier with nothing
        // left to offer. Step down a tier at a time rather than give nothing.
        const tiers = HEALER_RARITIES.slice(0, HEALER_RARITIES.indexOf(rolled) + 1).reverse();
        let rarity = null;
        let options = [];
        for (const tier of tiers) {
            options = this.cardSystem?.cardDataGenerator?.createAmuletChoice(
                this.gameState.currentFloor || 1,
                tier,
                3,
                this.gameState,
                { ignoreMinFloor: true },
            ) || [];
            if (options.length) { rarity = tier; break; }
        }
        if (!options.length) return;
        // The Trinket Keeper's crow brings it: a caw, its shadow crossing the top of the screen,
        // and the amulet dropped as it passes over the middle, flying down to the amulet bar.
        this.time.delayedCall(350, () => {
            playCrowFlyby(this, {
                dropAtX: 320,
                onDrop: () => openAmuletChoiceOverlay(this, {
                    rarity,
                    options,
                    amuletManager: this.amuletManager,
                    title: t(this, 'ui.village.healerTitle'),
                    onPicked: (id) => this.time.delayedCall(0, () => flyAmuletToBar(this, id, 320, CROW_TOP_Y + 6, { hop: true })),
                }),
            });
        });
    }

    startNewFloor() {
        this._roomClearRewarded = false;
        this.clearEnemyTurnTimers();
        this.clearFloatingTexts();
        // Fresh combat floor reached (restores bypass startNewFloor()).
        SoundHelper.playVariant(this, 'new_level', 0.5);
        this._floorEndAlreadyProcessed = false;
        this._transitioning = false;
        this.enemiesCleared = false;
        this._bossVictoryPending = false;
        if (this.nextFloorButton) {
            this.nextFloorButton.setVisible(false);
            this.nextFloorButtonText?.setVisible(false);
            this.nextFloorButton.setInteractive();
            this.nextFloorButton.y = NEXT_EXIT_Y;
            if (this.nextFloorButtonText) this.nextFloorButtonText.y = NEXT_EXIT_Y;
            this.nextFloorButton.clearTint();
            this._doorOpenSounded = false;
            // The road is visible from the first turn, shut. It opens when the
            // board is cleared. Rooms with no door drawn keep the old plate,
            // hidden until then.
            // Stop a door that was still swinging, or it would keep writing
            // its frames over the plate.
            this.nextFloorButton.anims?.stop?.();
            this.nextFloorButton.setTexture('nextTurnUp');
            this.showClosedDoorExit();
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
        this.refreshDebugVictoryButton?.();
        // Fresh fight → fresh log, shown only in combat rooms.
        this.clearCombatLog();
        this.refreshCombatLogVisibility();
        // Boss floors get their own battle-drums track; everything else is silent.
        this.syncFightMusic();
        // Reset per-floor amulet flags
        this.gameState.charmingTuneUsed = false;
        this.gameState.twinnedMirrorUsed = false;
        this.gameState.strategyMarchUsed = false;
        this.gameState.strategyClusterUsed = false;
        if (this.tutorialMode) {
            // Rigged lesson board. No starter swords — the tutorial hands them
            // out on the board so the player learns to pick them up.
            this.cardSystem.spawnTutorialCards();
        } else {
            this.cardSystem.spawnFloorCards();
            this.inventorySystem.addStartingCards();
        }
        this.amuletManager?.processFloorStart?.();
        this.checkpointCombat();
        recordHumanRunEvent(this, 'floor_started', {
            floor: this.gameState.currentFloor,
            roomType: this.roomType,
        });
        // DON'T replenish action points here
        this.updateUI();
        this.cardSystem.checkFloorClear();
        // Last, so the bag it lifts already holds this floor's starting cards.
        this.inventorySystem?.playPanelIntro?.();
    }

    startBossMusic() {
        MusicManager.play(this, 'boss_music', 0.6, 700);
    }

    // The room's fight music: the boss drums in a boss room, the battle loop in
    // a normal or elite fight, nothing anywhere else. Starting one crossfades
    // out whatever was playing (MusicManager keeps a single track).
    syncFightMusic() {
        if (this.roomType === 'BOSS') {
            this.startBossMusic();
        } else if (BATTLE_MUSIC_KEY && FIGHT_ROOM_TYPES.has(this.roomType)) {
            MusicManager.play(this, BATTLE_MUSIC_KEY, BATTLE_MUSIC_VOLUME, 700);
        } else {
            this.stopBossMusic();
        }
    }

    // Ends the fight's music, boss drums or battle loop — the name is older
    // than the battle loop. A no-op when neither is playing.
    stopBossMusic() {
        MusicManager.stopIfPlaying(this, 'boss_music', 600);
        MusicManager.stopIfPlaying(this, 'battle_music', 600);
    }

    // The tutorial's own exit. showNextFloorButton stays shut in tutorial mode
    // because clearing the rigged board is not the end of the lesson; the door
    // opens only when the step that teaches it asks, and floorCleared turns the
    // click into that step's progress instead of an actual departure.
    showTutorialExit() {
        if (!this.tutorialMode || !this.nextFloorButton) return;
        this.nextFloorButton
            .setVisible(true)
            .setActive(true)
            .setAlpha(1)
            .setScale(1)
            .setInteractive({ useHandCursor: true })
            .clearTint();
        this.nextFloorButtonText?.setVisible(true);
        this.showOpenDoorExit();
    }

    showNextFloorButton() {
        if (this.tutorialMode) return;
        if (this._bossVictoryPending) return;
        if (this._transitioning || this.gameState?.playerHealth <= 0) return;
        if (this.nextFloorButton) {
            this.nextFloorButton
                .setVisible(true)
                .setActive(true)
                .setAlpha(1)
                .setScale(1)
                .setDepth(5000)
                .setInteractive({ useHandCursor: true })
                .clearTint();
        }
        if (this.nextFloorButtonText) {
            this.nextFloorButtonText.setVisible(true).setDepth(5001);
        }
        this.showOpenDoorExit();
    }

    /**
     * The board is clear, so the road opens.
     *
     * Rather than a Next plate, the door for the location this act is being
     * walked shows in its open state, and you hear it go. Falls back to the
     * plate for a road with no door drawn (Duskhold, Starfold) and for any room
     * that reaches this with no location resolved.
     */
    /**
     * The shut door, standing where the exit will be while enemies remain.
     *
     * Its OWN image, not the Next button wearing a door texture. That was the
     * first shape of this and it was wrong: the button is a control with a
     * pointerdown that calls floorCleared(), and anything that re-armed it —
     * startNewFloor does, and so does a station room handing the fight back —
     * turned the scenery back into a live button. Clicking the shut door then
     * ended the floor, which looked like the door vanishing.
     *
     * A separate image can never be clicked, because it is never interactive.
     */
    showClosedDoorExit() {
        const art = locationDoorArt(this, getLocationIdForFloor(this.gameState), { fallback: true });
        if (!art) {
            this.closedDoorMarker?.setVisible(false);
            return;
        }

        if (!this.closedDoorMarker?.scene) {
            this.closedDoorMarker = this.add
                .image(NEXT_EXIT_X, NEXT_EXIT_Y, art.key, art.shut)
                .setDepth(4999);
        }
        this.closedDoorMarker
            .setTexture(art.key, art.shut)
            .setVisible(true)
            .setActive(true)
            .setAlpha(1)
            .setScale(1)
            .setDepth(4999);
    }

    /** The shut door comes down whenever the way out is real. */
    hideClosedDoorExit() {
        this.closedDoorMarker?.setVisible(false);
    }

    // A shop, treasure room or chest opens over this scene with its own door
    // in the same spot. Take this room's exit down so only one door shows;
    // the next fight's startNewFloor() puts it back.
    hideExitUnderStation() {
        this.nextFloorButton?.disableInteractive?.();
        this.nextFloorButton?.setVisible(false);
        this.nextFloorButtonText?.setVisible(false);
        this.hideClosedDoorExit();
    }

    showOpenDoorExit() {
        const button = this.nextFloorButton;
        if (!button?.scene) return;

        const art = locationDoorArt(this, getLocationIdForFloor(this.gameState), { fallback: true });
        if (!art) return;

        this.hideClosedDoorExit();
        // The first time this floor's door opens, a door with its own sheet
        // swings open from shut. Every later call (this runs again whenever
        // the clear is re-checked) just shows it open, so it never swings twice.
        const opening = !this._doorOpenSounded;
        const anim = opening ? ensureDoorOpenAnim(this, art) : null;
        button
            .setTexture(art.key, anim ? art.shut : art.open)
            .setVisible(true)
            .setActive(true)
            .setAlpha(1)
            .setScale(1)
            .setDepth(5000);
        if (anim && button.play) button.play(anim);
        // The plate's label would sit across the doorway.
        this.nextFloorButtonText?.setVisible(false);
        if (opening) {
            this._doorOpenSounded = true;
            SoundHelper.playSound(this, 'door_open', 0.6);
        }
    }

    /**
     * Silk Cache ambush: leave anytime no hatched enemies remain (cocoons alone
     * are optional). Reuses the Next control with a Leave label until a real
     * enemy hatches or the room fully clears.
     */
    refreshSilkCocoonLeaveButton() {
        if (this.tutorialMode || this._transitioning || this.gameState?.playerHealth <= 0) return;
        if (!isSilkCocoonCacheRoom(this.gameState)) return;

        if (this.enemiesCleared) {
            this._silkCocoonLeaveOffer = false;
            this.nextFloorButtonText?.setText(t(this, 'ui.hud.next'));
            return;
        }

        if (boardHasOpenCocoonEnemies(this.cardSystem?.boardCards)) {
            if (this._silkCocoonLeaveOffer) {
                this._silkCocoonLeaveOffer = false;
                this.nextFloorButton?.disableInteractive();
                this.nextFloorButton?.setVisible(false);
                this.nextFloorButtonText?.setVisible(false);
                this.nextFloorButtonText?.setText(t(this, 'ui.hud.next'));
            }
            return;
        }

        this._silkCocoonLeaveOffer = true;
        this.nextFloorButtonText?.setText(t(this, 'ui.hud.leave'));
        this.showNextFloorButton();
    }

    bindEnemyTurnHandler() {
        this.combatTurns.bindEnemyTurnHandler();
    }

    useAction() {
        if (this.isEnemyTurn) return false;

        // Goblin club_stun: skip this action, then enemies still respond.
        if ((this.gameState.playerStunnedTurns || 0) > 0) {
            this.gameState.playerStunnedTurns--;
            this.amuletManager?.processPlayerTurn?.();
            this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y, 'Stunned!', 0xffcf7f);
            this.updateUI();
            this.scheduleEnemyTurn();
            return false;
        }

        // Check if player is already exhausted BEFORE consuming the action
        const wasExhausted = this.gameState.actionsLeft <= 0;
        
        // Check for Quickhand Gloves free first action
        if (this.gameState.shouldUseFreeAction()) {
            this.amuletManager?.processPlayerTurn?.();
            this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y, 'Free Action!', 0x71800b);
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
                this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y, 'Free Action!', 0x71800b);
            }
        }
        
        // REMOVED: Exhaustion damage - player is just weakened now
        // Only show the weakened message when out of action points
        if (wasExhausted && actionConsumed) {
            // Just show weakened state, no damage. Empty stomach = out of energy.
            this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y, 'Weakened!', 0xef7c4b);
        }
        
        // Consume action point if not a free action and player has AP
        if (actionConsumed && this.gameState.actionsLeft > 0) {
            this.gameState.actionsLeft--;
            this.playActionPointSpend(this.gameState.actionsLeft + 1, this.gameState.actionsLeft);
            if (this.gameState.actionsLeft <= 0) {
                SoundHelper.playVariant(this, 'empty_stomach', 0.5);
            }
        }

        this.amuletManager?.processPlayerTurn?.();
        
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

    // `keepNarration` leaves the sounds and numbers of blows already struck to
    // play out. Only the room-clear wants that: it fires on the killing blow,
    // and that blow should still be heard. Every other caller is leaving the
    // room or the run, where leftover narration would bleed into what's next.
    clearEnemyTurnTimers({ keepNarration = false } = {}) {
        this.combatTurns.clearEnemyTurnTimers();
        if (!keepNarration) CombatSequencer.cancelAll(this);
    }

    isEnemyCard(card) {
        return !!this.cardSystem?.isEnemyType(card?.data?.type);
    }

    debugDefeatAllEnemies() {
        // Refused outright in a tester build. The button is gone there, but a
        // method on the scene is reachable from the console.
        if (!devToolsEnabled()) return 0;
        const roomType = this.gameState?.roomType || this.roomType;
        if (!['COMBAT', 'ELITE', 'BOSS'].includes(roomType)
            || this.enemiesCleared
            || this._transitioning
            || this.gameState?.playerHealth <= 0) {
            return 0;
        }

        this.clearEnemyTurnTimers();

        // A debug clear means the whole floor, not merely the currently dealt
        // wave. Cancel undealt reinforcements before normal clear checks run.
        if (this.cardSystem?._waveState) {
            this.cardSystem._waveState.wavesLeft = 0;
            this.cardSystem._waveState.cardsPending = 0;
            this.cardSystem._waveState.dropping = false;
        }

        let defeated = 0;
        const cards = this.cardSystem?.boardCards || [];
        // Defeat one card at a time. Setting every HP value to zero up front
        // would let the first death falsely look like the last one.
        cards.slice().forEach((card, index) => {
            if (cards[index] !== card || !this.isEnemyCard(card) || (card.data?.health ?? 1) <= 0) return;
            // The developer shortcut clears pending reassembly as well.
            if (card.data.sigils?.some(sigil => sigil.id === 'reassemble')) card.data.reassembled = true;
            card.data.health = 0;
            card.sprite?.disableInteractive?.();
            this.cardSystem.removeDefeatedEnemy(index, card);
            defeated++;
        });

        // Preserve the regular win pipeline: floor reward, Next button, boss
        // reward and Tollroad aftermath are all driven by checkFloorClear().
        this.cardSystem?.checkFloorClear?.();
        this.refreshDebugVictoryButton?.();
        return defeated;
    }

    // An elite's reward: a chest, or SIGIL_ROOM_CHANCE of the time (doubled by
    // the Sapphire Brooch) a Sigil Room. Only when some card in the bag could
    // actually take a sigil; otherwise the room would have nothing to offer.
    pickEliteRewardMode() {
        const chance = this.amuletManager?.hasEliteChestSigil?.() ? SIGIL_ROOM_CHANCE_BROOCH : SIGIL_ROOM_CHANCE;
        if (Math.random() >= chance || !offerableSigils(this).length) return 'elite';
        return 'sigil';
    }

    // The robbers of the Soup Stand (cards/robbers.js) were carrying a satchel: beating them
    // earns the +1 bag slot amulet. Paid once; if it cannot be worn, coins instead.
    rewardRobberSatchel() {
        const story = this.gameState.storyRun || (this.gameState.storyRun = {});
        if (story.robberSatchelTaken) return;
        story.robberSatchelTaken = true;
        this.time.delayedCall(700, () => {
            const id = ROBBER_SATCHEL_AMULET;
            if (this.amuletManager?.canAddAmulet?.(id) && this.amuletManager.addAmulet(id)) {
                flyAmuletToBar(this, id, 320, 160, { hop: true });
                return;
            }
            const coins = scaleGoldReward(25);
            this.gameState.coins += coins;
            this.playCurrencyGainFlight?.(320, 160, 'coins');
            this.updateUI?.();
        });
    }

    // The Crystal Lair is won: the room shuts for the run, and the door out
    // leads to a Sigil Room with the Crystal Brood stamp (the drag-and-drop
    // room, SigilRoom.js), the way an elite's Sigil Room does. Kept in the
    // story state so it survives a save. With nothing that can take it, crystals.
    rewardCrystalLair() {
        const story = this.gameState.storyRun || (this.gameState.storyRun = {});
        if (story.crystalLairCleared) return;
        story.crystalLairCleared = true;
        if (canOfferSigil(this, 'crystalBrood')) {
            story.crystalLairSigilPending = true;
            return;
        }
        this.time.delayedCall(700, () => {
            this.gameState.crystals = (this.gameState.crystals || 0) + CRYSTAL_LAIR_FALLBACK_CRYSTALS;
            this.playCurrencyGainFlight?.(320, 160, 'crystals');
            this.updateUI?.();
        });
    }

    // Eggs hatch by fights (content/cards/eggHatching.js): each fight room
    // cleared takes one off every egg in the bag, and an egg at zero cracks
    // open in its own slot: the chick's egg into the Chick, the crystal egg
    // into the Crystal Spiderling. Counted once per room.
    tickEggHatching() {
        const room = this.roomType || this.gameState?.roomType;
        if (!EGG_HATCH_ROOMS.includes(room)) return 0;
        const floor = this.gameState.currentFloor;
        if (this.gameState.eggHatchTickFloor === floor) return 0;
        this.gameState.eggHatchTickFloor = floor;

        const slots = this.inventorySystem?.slots || this.gameState?.inventory || [];
        const gen = this.cardSystem?.cardDataGenerator || new CardDataGenerator();
        let changed = false;
        const hatched = [];
        slots.forEach((item, index) => {
            if (!isHatchingEgg(item)) return;
            item.hatchFightsLeft = Math.max(0, eggFightsLeft(item) - 1);
            changed = true;
            if (item.hatchFightsLeft > 0) return;
            const crystal = item.id === 'crystalSpiderEgg';
            const companion = crystal
                ? gen.createCrystalSpiderlingCompanionCard()
                : gen.createChickCompanionCard();
            // One of each: a second egg waits while its companion is in the bag.
            if (slots.some((other) => other?.id === companion.id)) return;
            slots[index] = companion;
            if (!crystal && this.gameState.storyRun) this.gameState.storyRun.chickHatched = true;
            hatched.push(crystal ? 'ui.egg.hatched.crystal' : 'ui.egg.hatched.chick');
        });
        if (!changed) return 0;
        this.gameState.inventory = slots;
        this.inventorySystem?.rebuildInventorySprites?.();
        hatched.forEach((key, i) => this.createFloatingText?.(320, 150 - i * 16, t(this, key), 0x9fd8ff));
        if (hatched.length) SoundHelper.playSound(this, 'egg_hatch', 0.6);
        return hatched.length;
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
        const flash = this.add.circle(x, y, 50, 0xb51f1e, 0.5);
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
            this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y, `-${actualDamage}`, 0xb51f1e);
        }
    }
    createFloatingText(x, y, text, color, fontSize = '15px', opts = {}) {
        this.showCombatFeedback({ x, y, message: text, ...opts });
    }

    // A screen drawn above this one with its own panels (an event: dim,
    // wooden frames) names itself here, and floating text is drawn in it, at
    // the same world coordinates, instead of underneath. null = draw here.
    setFeedbackScene(scene = null) {
        this.feedbackScene = scene;
    }

    showCombatFeedback({ x, y, message, ...options }) {
        const above = this.feedbackScene;
        if (above && above !== this && above.sys?.isActive?.()) {
            if (!above._combatFeedback) {
                above._combatFeedback = new CombatFeedback(above);
                above.events.once('shutdown', () => { above._combatFeedback = null; });
            }
            above._combatFeedback.emit(x, y, message, options);
            return;
        }
        this.combatFeedback ||= new CombatFeedback(this);
        this.combatFeedback.emit(x, y, message, options);
    }

    clearFloatingTexts() {
        this.combatFeedback?.clear();
    }

    createSlashEffect(x, y) {
        const slash = this.add.graphics();
        slash.lineStyle(5, 0xfef0cf, 1);
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
    
    // The hit stack (docs/VISUAL-IDEAS-STUDIO-IGOR.md #2) on a struck board
    // card: a white flash that holds the card still for a moment (hit-stop),
    // then a knockback of a few whole pixels away from the hero that springs
    // back. `strong` (a crit) holds longer and pushes further; `soft` (a
    // poison tick) skips the flash and only nudges.
    shakeCard(cardSprite, { strong = false, soft = false } = {}) {
        if (!cardSprite?.scene) return;
        const boardCard = this.cardSystem?.boardCards?.find(card => card?.sprite === cardSprite);
        // Where the card belongs. Remembered while a knockback is under way,
        // so a second hit mid-push does not take the pushed spot as home.
        const rests = (this._hitStackRest ||= new Map());
        const known = rests.get(cardSprite);
        const restX = Number.isFinite(boardCard?.restX) ? boardCard.restX : (known?.x ?? cardSprite.x);
        const restY = Number.isFinite(boardCard?.restY) ? boardCard.restY : (known?.y ?? cardSprite.y);
        rests.set(cardSprite, { x: restX, y: restY });
        // Overlapping cleave/gem impacts used to capture an already-shifted
        // position as their new origin, leaving the card apart from its
        // HP/ATK overlay. Always start from rest.
        this.tweens.killTweensOf(cardSprite);
        this._hitStackTimers?.get(cardSprite)?.remove(false);
        // Finish the previous flash before recording this hit's base tint.
        // Otherwise a second impact saves solid white as the original colour;
        // a poison nudge can also cancel the only timer that would clear it.
        this._hitStackRestoreTint?.get(cardSprite)?.();
        cardSprite.setPosition(restX, restY);
        const infoText = boardCard?.infoText;
        const infoOffsetY = infoText?.scene ? infoText.y - restY : 0;
        const syncStats = () => {
            if (!infoText?.scene) return;
            infoText.x = Math.round(cardSprite.x);
            infoText.y = Math.round(cardSprite.y + infoOffsetY);
        };

        // Away from the hero, in whole pixels.
        const hero = this.playerAvatar;
        const dx = restX - (hero?.x ?? restX);
        const dy = restY - (hero?.y ?? restY + 100);
        const len = Math.hypot(dx, dy) || 1;
        const push = soft ? 2 : (strong ? 5 : 3);
        const toX = Math.round(restX + (dx / len) * push);
        const toY = Math.round(restY + (dy / len) * push);

        // Flash, keeping whatever tint the card wore (frozen, marked) to put back.
        const tint = cardSprite.isTinted
            ? { fill: cardSprite.tintFill, color: cardSprite.tintTopLeft }
            : null;
        if (!soft) cardSprite.setTintFill(0xffffff);
        const restoreTint = () => {
            this._hitStackRestoreTint?.delete(cardSprite);
            if (!cardSprite.scene || soft) return;
            if (!tint) cardSprite.clearTint();
            else if (tint.fill) cardSprite.setTintFill(tint.color);
            else cardSprite.setTint(tint.color);
        };
        if (!soft) (this._hitStackRestoreTint ||= new Map()).set(cardSprite, restoreTint);

        const hold = soft ? 0 : (strong ? 80 : 45);
        (this._hitStackTimers ||= new Map()).set(cardSprite, this.time.delayedCall(hold, () => {
            this._hitStackTimers.delete(cardSprite);
            restoreTint();
            if (!cardSprite.scene) {
                rests.delete(cardSprite);
                return;
            }
            this.tweens.add({
                targets: cardSprite,
                x: toX,
                y: toY,
                duration: 55,
                ease: 'Quad.easeOut',
                onUpdate: syncStats,
                onComplete: () => {
                    if (!cardSprite.scene) return;
                    this.tweens.add({
                        targets: cardSprite,
                        x: restX,
                        y: restY,
                        duration: 150,
                        ease: 'Back.easeOut',
                        onUpdate: () => {
                            // Whole pixels only, so the card art never smears.
                            cardSprite.x = Math.round(cardSprite.x);
                            cardSprite.y = Math.round(cardSprite.y);
                            syncStats();
                        },
                        onComplete: () => {
                            rests.delete(cardSprite);
                            cardSprite.setPosition(restX, restY);
                            syncStats();
                        },
                    });
                },
            });
        }));
    }
    
    gameOver() {
        if (this._resultScreenShown || this._gameOverInProgress) return;
        this._gameOverInProgress = true;
        this._transitioning = true;
        SoundHelper.playVariant(this, 'hero_death', 0.6);
        this.stopBossMusic();
        this.clearEnemyTurnTimers();
        this.nextFloorButton?.disableInteractive();

        const trackedDeathCause = this.gameState?.getDeathStats?.()?.cause;
        const killedBy = trackedDeathCause === 'poison'
            ? 'Poison'
            : (this.killedBy || 'Unknown Enemy');
        const floor = this.gameState?.currentFloor ?? 1;
        humanRunRecorder.finishAndDownload(this, 'defeat', { killedBy, floor });
        let deathStats = { killedBy, floor };
        let xpResult = null;

        try {
            deathStats = this.gameState.getDeathStats();
            deathStats.killedBy = killedBy;
            deathStats.floor = floor;

            this.unlockChickForRareShopAfterDeath();
            this.unlockSkeletonForRareShopAfterDeath();
            if (!this.sandboxMode) this.saveManager?.clearCurrentRun();

            if (!this.sandboxMode && this.metaManager) {
                this.metaManager.totalRuns++;
                if (floor > this.metaManager.bestFloor) {
                    this.metaManager.bestFloor = floor;
                }
                // Carry an unhatched egg to the next run (consumed at run start).
                const hasEgg = (this.gameState.inventory || []).some(
                    item => item?.id === 'monsterEgg' || item?.name === 'Egg'
                );
                this.metaManager.setPendingEgg(hasEgg);
                this.queueNextRunMonth();
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

        // In the tutorial the door is a lesson, not a way out: stepping through
        // it completes the step, and the tutorial's own Finish ends the floor.
        if (this.tutorialMode) {
            this.events.emit('tutorialProgress', 'leftRoom');
            this.tutorialManager?._handleProgress?.('leftRoom');
            return;
        }

        // Ink and webs never leave the room with the player.
        this.inventorySystem?.clearAllHandWebs?.();

        // Silk Cache Leave: walk away while only cocoons/loot remain — no clear payout.
        if (this._silkCocoonLeaveOffer && !this.enemiesCleared) {
            this.clearEnemyTurnTimers();
            this.enemiesCleared = true;
            this.inventorySystem?.clearAllHandWebs?.();
            this._silkCocoonLeaveOffer = false;
            this.nextFloorButtonText?.setText(t(this, 'ui.hud.next'));
            this.gameState.ambushId = null;
        }

        recordHumanRunEvent(this, 'floor_departed', {
            floor: this.gameState.currentFloor,
            roomType: this.gameState.roomType,
        });

        // Leaving any floor ends the boss track (harmless no-op off boss floors).
        this.stopBossMusic();

        // Boss reward room → leaving means advancing to the next act
        if (this.gameState.roomType === 'BOSS_REWARD') {
            this.leaveBossRewardRoom();
            return;
        }

        this._transitioning = true;
        this.refreshDebugVictoryButton?.();
        this.clearEnemyTurnTimers();
        // Hard-disable the button so it can't be clicked again. The plate is
        // hidden so its label and skin vanish together; an open door stays,
        // because the player has just walked through it, not used it up.
        if (this.nextFloorButton) {
            const button = this.nextFloorButton;
            button.disableInteractive();
            if (isLocationDoorTexture(button.texture?.key)) {
                // Disabling it here swallows the pointerup and pointerout that
                // would normally undo the press, so undo it now: no press
                // shade, no hover light, back on its spot.
                button.clearTint();
                setHoverLight(button, false);
                button.y = NEXT_EXIT_Y;
            } else {
                button.setVisible(false);
            }
        }
        this.nextFloorButtonText?.setVisible(false);
        if (!this._bossVictoryPending) this.hideClosedDoorExit();
        // Elite rooms lead to the chest-click TreasureScene, or now and then to
        // a Sigil Room instead (pickEliteRewardMode).
        let rewardChestMode = this.gameState.roomType === 'ELITE' ? this.pickEliteRewardMode() : null;
        // The Crystal Lair's door leads to its Sigil Room (rewardCrystalLair).
        let rewardSigilId;
        if (this.gameState.storyRun?.crystalLairSigilPending) {
            this.gameState.storyRun.crystalLairSigilPending = false;
            rewardChestMode = 'sigil';
            rewardSigilId = 'crystalBrood';
        }

        // Process amulet floor end effects before moving to next floor.
        // Skip when leaving a combat room that was already cleared before a
        // save/restore — its floor-end effects ran the first time it cleared, so
        // running them again on Continue would double-apply (e.g. bonus HP/AP).
        if (this.amuletManager && !this._floorEndAlreadyProcessed) {
            this.amuletManager.processFloorEnd();
        }
        this._floorEndAlreadyProcessed = false;

        // Test Site: after a fight (or boss reward leave), return to the hub.
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
                        sigilId: rewardSigilId,
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
            onBossRow(this.gameState);

        if (completedActBoss) {
            // Final boss → straight to victory, no reward room. Detect the final act
            // by the map cursor's act (robust to a 1-floor currentFloor drift) and
            // keep the floor check as a fallback.
            const isFinalAct = (this.gameState.mapCursor?.act >= 3) || this.gameState.currentFloor >= 45;
            if (isFinalAct) {
                this.lockInputForRunEnd();
                this.saveCurrentRun();
                this.time.delayedCall(1500, () => this.gameWon());
                return;
            }
            // Tollroad has a durable post-boss story beat before the normal
            // reward room. Other roads continue straight to the spoils.
            this.time.delayedCall(700, () => this.continueBossVictory());
            return;
        }

        // AUTO-SAVE the current run — only on the way to an elite's chest. On
        // the way to the map it would be the first of two saves (the map saves
        // as it opens), both run before the map is drawn.
        if (rewardChestMode) this.saveCurrentRun();

        // A short beat after the door is clicked (it was 500ms, which read as
        // the game hanging), then the map or the elite's chest.
        this.time.delayedCall(LEAVE_ROOM_DELAY_MS, () => {
            this.scene.sleep();
            if (rewardChestMode) {
                this.scene.launch('TreasureScene', {
                    gameState: this.gameState,
                    rewardMode: rewardChestMode,
                    sigilId: rewardSigilId,
                });
            } else {
                this.scene.stop('MapViewScene');
                this.scene.launch('MapViewScene', { gameState: this.gameState });
            }
        });
    }

    // Replaces the previous TreasureScene boss flow. Stays inside GameScene so the
    // player keeps their avatar, inventory and full UI — just swaps the board.
    setupBossRewardRoom(options) {
        return setupBossRewardRoomUi(this, options);
    }

    continueBossVictory() {
        const aftermath = pendingLocationAftermath(this.gameState);
        if (aftermath) {
            this.scene.sleep();
            this.scene.launch(aftermath.sceneKey, { gameState: this.gameState });
            return;
        }
        this.setupBossRewardRoom();
    }

    restoreSavedBossRewardRoom() {
        return restoreSavedBossRewardRoomUi(this);
    }

    restoreSavedCombatRoom() {
        this.clearEnemyTurnTimers();
        this._transitioning = false;
        this.roomType = this.gameState.roomType || 'COMBAT';
        this.updateRoomTitle();
        // createCombatLog() starts hidden. Fresh rooms reveal it from
        // startNewFloor(), but a continued fight bypasses that path.
        this.refreshCombatLogVisibility();

        const cards = this._loadedBoardCards || [];
        const restored = this.cardSystem.restoreSavedBoard(
            cards, this._loadedBoardLayout, this._loadedWaveState
        );
        this._loadedBoardCards = null;
        this._loadedBoardLayout = null;
        this._loadedWaveState = null;
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

    // A line in the combat log when a companion's attack goes up.
    logCompanionAttackUp(companion, amount) {
        if (!companion) return;
        this.pushCombatLog?.(t(this, 'log.companionAttackUp', {
            name: translateItemName(this, companion),
            amount,
            attack: Math.max(0, Number(companion.attack) || 0),
        }));
    }

    // +1 attack for every companion carried into a new act. Done once per act:
    // the boss reward room does it first, with the golden swirl on each card
    // (ui/CompanionPowerUp.js); leaving the room only catches up a save made
    // before that. Returns how many companions grew.
    upgradeCompanionsForNextAct(nextAct, { celebrate = false } = {}) {
        // Acts 2 and 3 are the only real crossings. Guarding the act number
        // keeps a final-victory transition from granting a meaningless upgrade.
        if (nextAct < 2 || nextAct > 3) return 0;
        if (this.gameState.companionsUpgradedForAct === nextAct) return 0;
        this.gameState.companionsUpgradedForAct = nextAct;

        const slots = this.inventorySystem?.slots || this.gameState?.inventory || [];
        const grown = [];
        slots.forEach((companion, index) => {
            if (companion?.type !== 'companion') return;
            companion.attack = Math.max(0, Number(companion.attack) || 0) + 1;
            companion.actUpgrades = (Number(companion.actUpgrades) || 0) + 1;
            grown.push(index);
        });

        if (grown.length > 0) {
            this.gameState.inventory = slots;
            this.inventorySystem?.rebuildInventorySprites?.();
            this.updateUI();
            grown.forEach((index, n) => {
                this.logCompanionAttackUp(slots[index], 1);
                const card = this.inventorySystem?.slotSprites?.[index]?.card;
                if (celebrate) playCompanionPowerUp(this, card, { delay: n * COMPANION_POWER_UP_STAGGER_MS });
                else this.createFloatingText(card?.x ?? 320, (card?.y ?? 260) - 40, t(this, 'float.atkGain', { amount: 1 }), 0xffcf7f);
            });
        }
        return grown.length;
    }
    
    onEnemiesCleared() {
        // The killing blow is what got us here, and its sounds and numbers are
        // still on the narration timeline. Keep them.
        this.clearEnemyTurnTimers({ keepNarration: true });
        const firstClear = !this._roomClearRewarded;
        this._roomClearRewarded = true;
        if (firstClear) this.finalizeCompanionCombatHistory();
        this.enemiesCleared = true;
        this.refreshDebugVictoryButton?.();
        this.inventorySystem?.clearAllHandWebs?.();
        const floor = this.gameState.currentFloor;
        if (firstClear) recordHumanRunEvent(this, 'floor_cleared', {
            floor,
            roomType: this.roomType || this.gameState.roomType,
        });
        const isBossFloor = [15, 30, 45].includes(floor);
        const isBossVictory = this.roomType === 'BOSS' || this.gameState.roomType === 'BOSS' ||
            isBossFloor || onBossRow(this.gameState);
        if (isBossVictory) {
            this._bossVictoryPending = true;
            this.stopBossMusic();
        }
        if (this.tutorialMode) {
            this.updateUI?.();
            return;
        }
        if (firstClear) this.tickEggHatching();

        // Floor-clear coin reward. Coins are no longer paid per enemy kill (that
        // faucet was flooding the economy); instead you're paid once for clearing
        // a battle floor. Boss floors are skipped here — they hand out their own
        // reward room. Honors the amulet gold modifier like the old kill payout.
        // Formula tuned via sim/balance-sim.js's shop-affordability probe to hit
        // "3-4 items affordable per regular shop visit, 2-3 per rare shop visit,
        // no act-3 coin hoarding" — see its "Shop affordability" report section.
        // Flattened from 20+floor*3: act 1 was coin-starved (2.7/6 affordable)
        // while acts 2-3 hoarded 500-750 unspent coins (4.5/6 affordable).
        let reward = 0;
        if (!isBossFloor && firstClear) {
            const base = Math.floor(24 + floor * 1.2);
            reward = this.amuletManager ? this.amuletManager.modifyGoldFound(base) : scaleGoldReward(base);
            this.gameState.coins += reward;
            this.updateUI?.();
            // From the middle of the board, where the fight was won.
            this.playCurrencyGainFlight?.(320, 160, 'coins');
        }
        this._silkCocoonLeaveOffer = false;
        if (firstClear && this.gameState?.ambushId === 'crystal_lair') this.rewardCrystalLair();
        if (firstClear && this.gameState?.ambushId === 'soup_robbers') this.rewardRobberSatchel();

        // The room is cleared as of now; it just isn't announced yet. The door,
        // its sound and the victory text wait until the killing blow has been
        // heard, so the fight ends on the enemy's death and then the door
        // rather than the door opening under the last hit.
        const announce = () => {
            if (this._transitioning || !this.enemiesCleared) return;
            if (isBossVictory) {
                if (this.gameState.playerHealth <= 0) return;
                playBossVictoryParticles(this);
                this.createFloatingText(320, 100, 'All enemies defeated!', 0x71800b);
                this.time.delayedCall(BOSS_FANFARE_DELAY_MS, () => {
                    if (this._transitioning || !this.enemiesCleared ||
                        this.gameState.playerHealth <= 0 || this.gameState.roomType === 'BOSS_REWARD') return;
                    this.floorCleared();
                });
                return;
            }
            if (reward > 0) this.createFloatingText(320, 140, `+${reward} coins`, 0xfbad19);
            // Null-guard: if the button hasn't been (re)created yet, do NOT
            // throw — that would leave enemiesCleared=true with a still-hidden
            // button, and the next checkFloorClear would short-circuit on
            // !enemiesCleared.
            this.nextFloorButtonText?.setText(t(this, 'ui.hud.next'));
            this.showNextFloorButton();
            this.createFloatingText(320, 100, 'All enemies defeated!', 0x71800b);
            this.createFloatingText(320, 120, 'Clear remaining cards or proceed.', 0xfef0cf);
        };
        const wait = CombatSequencer.remainingMs(this);
        if (wait > 0) CombatSequencer.after(this, wait + ROOM_CLEAR_ANNOUNCE_PAD_MS, announce);
        else announce();
    }

    handleTollVeteranDefeat(veteranIndex) {
        if (this.gameState?.ambushId !== 'toll_collectors') return false;
        const story = this.gameState.storyRun;
        const survivors = (this.cardSystem?.boardCards || [])
            .map((card, index) => ({ card, index }))
            .filter(({ card, index }) => index !== veteranIndex && card?.data?.tollGuard);
        if (!survivors.length) {
            story.tollGuardsEscaped = 0;
            return false;
        }

        // Show the smoke before the words: the bomb goes off, and only once
        // the haze is up does the notice explain where they went.
        story.tollEscapeNoticeShown = true;
        story.tollGuardsEscaped = survivors.length;
        playSmokeBurst(this, { x: 320, y: 170 });
        survivors.forEach(({ index }) => this.cardSystem.removeCard(index));
        this.time.delayedCall(SMOKE_BURST_MS, () => openNoticeModal(this, {
            title: t(this, 'ui.notice.smokeBombTitle'),
            body: t(this, 'ui.notice.smokeBombBody'),
        }));
        return true;
    }

    getVictoryStorySummary() {
        const story = this.gameState?.storyRun || {};
        const lines = [];

        if (story.latchboxRewardClaimed) {
            if (story.boxState === 'repaired') {
                lines.push(t(this, 'ui.victoryStory.latchbox'));
            } else {
                lines.push(t(this, 'ui.victoryStory.retiredBox'));
            }
        } else if (story.boxState === 'exploded') {
            lines.push(t(this, 'ui.victoryStory.boxSlag'));
        } else if (story.boxState && story.boxState !== 'unknown') {
            lines.push(t(this, 'ui.victoryStory.boxLoose'));
        }

        return lines.length > 0
            ? lines.join('\n')
            : t(this, 'ui.victoryStory.default');
    }

    getResolvedStoryCount() {
        const story = this.gameState?.storyRun || {};
        return Number(Boolean(story.latchboxRewardClaimed));
    }
    
    // The run is won the moment the final boss falls, but the victory screen
    // waits a beat for the death to play out. Nothing may be done in that beat:
    // a weapon the boss dropped could be picked up and merged, a potion drunk.
    // A card already in hand goes back to its slot, any hover tip closes, and
    // every pointer and key in this scene goes dead until gameWon turns the
    // pointer back on for the result screen's own buttons.
    lockInputForRunEnd() {
        if (this._runEndLocked) return;
        this._runEndLocked = true;
        this.inventorySystem?.finishStuckInventoryDrag?.(null, true);
        this.inventorySystem?.hideCardTooltip?.();
        this.hidePlayerEffectsTooltip?.();
        if (this.input) this.input.enabled = false;
        if (this.input?.keyboard) this.input.keyboard.enabled = false;
    }

    gameWon() {
        // The result screen is clickable; the rest of the board stays locked
        // behind its full-screen shade.
        if (this.input) this.input.enabled = true;
        humanRunRecorder.finishAndDownload(this, 'victory', {
            floor: this.gameState?.currentFloor ?? null,
        });
        if (!this.sandboxMode && !this.tutorialMode && this.metaManager) {
            this.queueNextRunMonth();
        }
        return showVictoryResult(this);
    }

    /** Location pick replaced calendar rotation; next New Run always chooses. */
    queueNextRunMonth() {
        return;
    }

    grantCardSpentRelicBonus(card, x = this.playerAvatar.x, y = this.playerAvatar.y) {
        const amount = this.gameState.relicEffects?.cardSpentMaxHP || 0;
        if (!amount || !card) return;

        this.gameState.maxHealth += amount;
        this.gameState.playerHealth = Math.min(
            this.gameState.maxHealth,
            this.gameState.playerHealth + amount
        );
        this.createFloatingText(x, y - 18, `+${amount} Max HP (Camp)`, 0xfed991);
        this.updateUI();
    }

    recordCardDiscarded(card, x = this.playerAvatar.x, y = this.playerAvatar.y) {
        if (!card) return;

        this.amuletManager?.processCardDiscard?.(card);

        this.gameState.discardedCardsThisRun = (this.gameState.discardedCardsThisRun || 0) + 1;

        const coinBonus = this.amuletManager?.getDiscardCoinBonus?.() || 0;
        if (coinBonus > 0) {
            const scaledCoinBonus = scaleGoldReward(coinBonus);
            this.gameState.coins = (this.gameState.coins || 0) + scaledCoinBonus;
            this.createFloatingText(x, y - 18, `+${scaledCoinBonus} Coin (Ink Pen)`, 0xfbad19);
            this.playCurrencyGainFlight?.(x, y, 'coins');
            this.updateUI();
        }

        const maxHpBonus = this.amuletManager?.getDiscardMaxHpBonus?.() || 0;
        if (maxHpBonus > 0) {
            this.gameState.maxHealth += maxHpBonus;
            this.gameState.playerHealth += maxHpBonus;
            this.createFloatingText(x, y - 32, `+${maxHpBonus} Max HP (Seed)`, 0x71800b);
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
            this.createFloatingText(x, y - 18, `Crit ${percent}%`, 0xfbad19);
        }
    }
    
    pauseGame() {
        // Don't allow pausing during transitions or game over
        if (this._transitioning || this._bossVictoryPending || this.gameState.playerHealth <= 0) return;

        // Finish the action and its enemy/companion response before pausing.
        // A paused timer cannot be serialized, so quitting halfway through used
        // to erase the attacks that had not landed yet.
        if (this.hasUnsettledCombat()) {
            if (this._pauseRequested) return;
            this._pauseRequested = true;
            this.input.enabled = false;
            const waitForExchange = () => {
                if (this._transitioning || this.gameState.playerHealth <= 0 || !this.hasUnsettledCombat()) {
                    this._pauseRequested = false;
                    this._pauseWaitTimer = null;
                    this.input.enabled = true;
                    this.pauseGame();
                    return;
                }
                this._pauseWaitTimer = this.time.delayedCall(50, waitForExchange);
            };
            this._pauseWaitTimer = this.time.delayedCall(50, waitForExchange);
            return;
        }
        
        // Pause the current scene
        this.scene.pause();
        this.scene.launch('PauseMenuScene', { pausedScene: 'GameScene' });
        const pause = this.scene.get('PauseMenuScene');
        if (pause?.input) pause.input.enabled = true;
    }

    hasUnsettledCombat() {
        const turns = this.combatTurns;
        return !!(turns?.isEnemyTurn || turns?.enemyTurnQueued || turns?.pendingEnemyTurns > 0
            || this.cardSystem?.openingRevealsPending?.());
    }

    checkpointCombat() {
        if (this.sandboxMode || this.tutorialMode || this._transitioning || this.enemiesCleared
            || this.gameState?.playerHealth <= 0 || this.hasUnsettledCombat()
            || !['COMBAT', 'ELITE', 'BOSS'].includes(this.gameState?.roomType)) return;
        this.saveManager?.saveCurrentRun(this.gameState, this.inventorySystem, this.cardSystem);
    }
    
    // Save current run method
    // Returns whether the run reached storage, so Save & Quit can warn when it did not.
    saveCurrentRun() {
        if (this.sandboxMode) return true;
        if (!this.saveManager) return false;
        const saved = this.saveManager.saveCurrentRun(
            this.gameState,
            this.inventorySystem,
            this.cardSystem
        );
        if (saved) {
            this.createFloatingText(570, 320, 'Game Saved', 0x71800b);
        }
        return Boolean(saved);
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
        this.gameState.gluttonMaxApGained = runData.player.gluttonMaxApGained || 0;
        this.gameState.mossyMaxHpGained = runData.player.mossyMaxHpGained || 0;
        this.gameState.coins = runData.player.coins;
        this.gameState.crystals = runData.player.crystals;
        this.gameState.currentFloor = runData.player.currentFloor;
        this.gameState.calendarMonthIndex = runData.player.calendarMonthIndex ?? 0;
        this.gameState.actLocationIds = normalizeActLocationIds(
            runData.player.actLocationIds,
            runData.player.calendarMonthIndex ?? 0
        );
        this.gameState.locationOffers = normalizeLocationOffers(runData.player.locationOffers);
        this.gameState.bonusInventorySlots = runData.player.bonusInventorySlots;
        this.gameState.firstActionUsed = runData.player.firstActionUsed;
        this.gameState.baseMaxHealth = runData.player.baseMaxHealth;
        this.gameState.bottomlessBagApplied = runData.player.bottomlessBagApplied;
        this.gameState.discardedCardsThisRun = runData.player.discardedCardsThisRun || 0;
        this.gameState.discardCritChance = runData.player.discardCritChance || 0;
        this.gameState.characterId = normalizeCharacterId(runData.player.characterId);
        this.gameState.journalBonusHP = runData.player.journalBonusHP || 0;
        this.gameState.mapBonusAP = runData.player.mapBonusAP || 0;
        this.gameState.mapFloorCount = runData.player.mapFloorCount || 0;
        this.gameState.secondWindUsed = runData.player.secondWindUsed || 0;
        this.gameState.strategyDetourUsedAct = runData.player.strategyDetourUsedAct || 0;
        // Equipment
        this.gameState.equippedWeapon = runData.equipment.equippedWeapon;
        this.gameState.equippedArmor = runData.equipment.equippedArmor;
        // Effects (properly restore objects)
        this.gameState.activeAmulets = runData.effects.activeAmulets;
        this.gameState.playerEffects = runData.effects.playerEffects;
        this.gameState.shadowBlade = runData.effects.shadowBlade;
        this.gameState.magicShield = runData.effects.magicShield;
        this.gameState.boneWall = runData.effects.boneWall;
        this.gameState.briarShield = runData.effects.briarShield || 0;
        this.gameState.mirrorSigilFloor = runData.effects.mirrorSigilFloor ?? null;
        this.gameState.mirrorSigilUses = runData.effects.mirrorSigilUses || 0;
        this.gameState.riposteReady = runData.effects.riposteReady || false;
        this.gameState.playerSapped = runData.effects.playerSapped || false;
        this.gameState.playerShocked = runData.effects.playerShocked || false;
        this.gameState.playerSandstormed = runData.effects.playerSandstormed || false;
        this.gameState.playerFrozenAttacks = runData.effects.playerFrozenAttacks || 0;
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
            this.gameState.companionsUpgradedForAct = runData.navigation.companionsUpgradedForAct ?? null;
            this.roomType = this.gameState.roomType;
        }
        this._loadedBoardCards = Array.isArray(runData.board?.cards)
            ? runData.board.cards
            : [];
        this._loadedBoardLayout = runData.board?.layout || null;
        this._loadedWaveState = runData.board?.waves || null;
        this._loadedEnemiesCleared = !!runData.board?.enemiesCleared;
        this._roomClearRewarded = !!runData.board?.clearRewardsGranted;
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
        // Re-apply village (and talents if the flag is on) on top of loaded state
        if (this.metaManager) {
            this.metaManager.applyRelicEffects(this.gameState, false);
        }
        return true;
    }
    
    updateRoomTitle() {
        this.refreshFightBackground();
        if (!this.roomTitle) return;
        let title = t(this, 'ui.room.combat');
        if (this.roomType === 'ELITE') title = t(this, 'ui.room.elite');
        if (this.roomType === 'BOSS') title = t(this, 'ui.room.boss');
        if (this.roomType === 'BOSS_REWARD') title = t(this, 'ui.room.spoils');
        this.roomTitle.setText(title);
    }
    
    shutdown() {
        if (this._pauseRequested && this.input) this.input.enabled = true;
        this._pauseWaitTimer?.remove?.(false);
        this._pauseWaitTimer = null;
        this._pauseRequested = false;
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
        if (data?.bossNarrativeComplete) {
            this.clearEnemyTurnTimers();
            this.inventorySystem?.setDragOverlayScene?.(null);
            this.setFeedbackScene(null);
            this.inventorySystem?.clearDropZones?.();
            this.inventorySystem?.setStationMode(false);
            // The pendant flag and the generated reward cards must land in the
            // same save. Continue then restores the reward room without either
            // replaying the vision or paying its currency a second time. A fresh
            // room offers its cards only after the companions' swirl, so it
            // saves once they are on the board, not before.
            if (this._restoreBossRewardAfterNarrative) {
                this._restoreBossRewardAfterNarrative = false;
                this.restoreSavedBossRewardRoom();
                this.saveCurrentRun();
            } else {
                this.setupBossRewardRoom({ onRewardsShown: () => this.saveCurrentRun() });
            }
            return;
        }
        if (data?.shopStation) {
            this.refreshFightBackground('SHOP');
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
        this.setFeedbackScene(null);
        this.inventorySystem?.clearDropZones?.();
        this.inventorySystem?.setStationMode(false);
        this.stopScenesAboveCombat({ keepMap: true });

        // Restore current room type from gameState
        this.roomType = this.gameState.roomType || 'COMBAT';
        this.updateRoomTitle();
        this.refreshDebugVictoryButton?.();
        // Show the log for combat rooms, hide it when we wake into loot/reward
        // rooms; startNewFloor() below re-clears it only for genuinely new fights.
        this.refreshCombatLogVisibility();
        // Resume/stop boss drums to match the room we woke into (startBossMusic
        // guards against double-play if startNewFloor also fires below).
        this.syncFightMusic();

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
